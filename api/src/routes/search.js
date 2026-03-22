import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logEvent } from '../utils/eventLogger.js';

/**
 * MANDATORY DB MIGRATION — run once before deploying this version:
 *
 *   ALTER TABLE search_sessions
 *     ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'TR';
 *
 * This is additive and non-breaking: existing rows receive 'TR' as default.
 * Country-aware query identity, session restore, and cache isolation all
 * depend on this column being present.
 */

const router = express.Router();

const PAGE_SIZE = 20;
const PLACES_BASE = 'https://places.googleapis.com/v1';
const CACHE_TTL_DAYS = 90;
const GOOGLE_TIMEOUT_MS = 15_000;

// Abort-signal timeout helper for Google API calls
function googleSignal() {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), GOOGLE_TIMEOUT_MS);
    return ctrl.signal;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getGoogleMapsApiKey() {
    const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('google_maps_api_key')
        .eq('id', 1)
        .single();
    if (error || !data?.google_maps_api_key) return null;
    return data.google_maps_api_key;
}

async function getCreditsPerPage() {
    const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('credits_per_page')
        .eq('id', 1)
        .single();
    if (error || data?.credits_per_page == null) return 10;
    return data.credits_per_page;
}

function buildSearchQuery(province, district, category, keyword, countryCode) {
    const parts = [province];
    if (district) parts.push(district);
    parts.push(category);
    if (keyword) parts.push(keyword);
    // For non-TR countries append the country name so Google returns the right
    // geographic context without relying solely on regionCode.
    if (countryCode && countryCode !== 'TR') parts.push(countryCode);
    return parts.join(' ');
}

/**
 * Build a deterministic, normalized query cache key.
 * All args lowercased + trimmed. Empty/null fields become empty string.
 * countryCode is included so the same city+category in different countries
 * produces different cache entries and different Google results.
 */
function buildQueryKey(province, district, category, keyword, minRating, minReviews, countryCode) {
    const norm = (v) => (v ? String(v).toLowerCase().trim() : '');
    return [
        norm(countryCode || 'tr'),
        norm(province),
        norm(district),
        norm(category),
        norm(keyword),
        minRating ? String(minRating) : '',
        minReviews ? String(minReviews) : '',
    ].join('|');
}

function cacheExpiry(days = CACHE_TTL_DAYS) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

// ── Address component district extractor ─────────────────────────────────────
function extractDistrict(place) {
    if (Array.isArray(place.addressComponents)) {
        const level3 = place.addressComponents.find(c =>
            c.types?.includes('administrative_area_level_3')
        );
        if (level3?.longText) return level3.longText;
    }

    const addr = place.formattedAddress;
    if (addr) {
        const segments = addr.split(',');
        for (const seg of segments) {
            const trimmed = seg.trim();
            const slashIdx = trimmed.indexOf('/');
            if (slashIdx > 0) {
                const beforeSlash = trimmed.slice(0, slashIdx).trim();
                const withoutPostal = beforeSlash.replace(/^\d+\s+/, '');
                if (withoutPostal.length > 0) return withoutPostal;
            }
        }
    }

    if (Array.isArray(place.addressComponents)) {
        const FALLBACK_TYPES = [
            'administrative_area_level_4',
            'sublocality_level_1',
            'sublocality',
        ];
        for (const type of FALLBACK_TYPES) {
            const comp = place.addressComponents.find(c => c.types?.includes(type));
            if (comp?.longText) return comp.longText;
        }
    }

    return null;
}

/**
 * Map a single Places API (New) place object to our frontend SearchResult shape.
 * Opening hours REMOVED — not fetched, not stored.
 */
function mapPlace(place) {
    const district = extractDistrict(place);
    const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || null;

    return {
        id: place.id || '',
        name: place.displayName?.text || place.name || '',
        category: place.primaryTypeDisplayName?.text || place.types?.[0] || '',
        district,
        rating: place.rating || 0,
        reviews: place.userRatingCount || 0,
        phone,
        website: place.websiteUri || null,
        address: place.formattedAddress || null,
    };
}

/**
 * Perform Places Text Search (New) with optional rating filter.
 * Returns all unique place IDs (up to 60).
 */
async function collectPlaceIdsFiltered(apiKey, query, minRating, countryCode, maxResults = 60) {
    const placeIds = [];
    let pageToken = undefined;
    const maxPages = Math.ceil(Math.min(maxResults, 60) / PAGE_SIZE);

    // Map countryCode to a sensible languageCode for display names.
    // Default to 'tr' for TR (existing behaviour), 'en' for all others.
    const langCode = countryCode === 'TR' ? 'tr' : 'en';
    const regionCode = countryCode || 'TR';

    for (let i = 0; i < maxPages; i++) {
        const body = {
            textQuery: query,
            languageCode: langCode,
            regionCode: regionCode,
            maxResultCount: PAGE_SIZE,
        };
        if (pageToken) body.pageToken = pageToken;
        if (minRating && minRating > 0) body.minRating = parseFloat(minRating);

        const resp = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,nextPageToken',
            },
            body: JSON.stringify(body),
            signal: googleSignal(),
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('[Places] Text Search error:', resp.status, errText);
            break;
        }

        const data = await resp.json();
        const ids = (data.places || []).map(p => p.id).filter(Boolean);
        placeIds.push(...ids);
        pageToken = data.nextPageToken || null;

        if (!pageToken || placeIds.length >= maxResults) break;
    }

    return { placeIds, total: placeIds.length };
}

/**
 * Fetch full details for an array of place_ids directly from Google.
 * Returns array of mapped SearchResult objects.
 * NO opening hours requested — Essentials SKU only.
 */
async function fetchPlaceDetails(apiKey, placeIds) {
    // Field mask without regularOpeningHours → stays in Essentials pricing tier
    const fieldMask = [
        'id',
        'displayName',
        'formattedAddress',
        'addressComponents',
        'internationalPhoneNumber',
        'nationalPhoneNumber',
        'websiteUri',
        'rating',
        'userRatingCount',
        'primaryTypeDisplayName',
        'types',
    ].join(',');

    const results = await Promise.all(
        placeIds.map(async (id) => {
            try {
                const resp = await fetch(`${PLACES_BASE}/places/${id}`, {
                    headers: {
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': fieldMask,
                    },
                    signal: googleSignal(),
                });
                if (!resp.ok) return null;
                const place = await resp.json();
                return mapPlace(place);
            } catch (e) {
                console.error('[Places] Detail fetch error for', id, e.message);
                return null;
            }
        })
    );

    return results.filter(Boolean);
}

/**
 * Fetch place details using shared place_cache first.
 * Only calls Google for cache misses.
 * Preserves original placeIds order in output.
 */
async function fetchPlaceDetailsWithCache(apiKey, placeIds) {
    if (!placeIds || placeIds.length === 0) return [];

    const now = new Date().toISOString();

    // 1. Batch-check place_cache for all IDs
    const { data: cachedRows } = await supabaseAdmin
        .from('place_cache')
        .select('place_id, data_json')
        .in('place_id', placeIds)
        .gt('expires_at', now);

    const hitMap = {};
    const hitIds = [];
    for (const row of cachedRows || []) {
        hitMap[row.place_id] = row.data_json;
        hitIds.push(row.place_id);
    }

    // 2. Increment hit_count for cache hits (fire-and-forget)
    if (hitIds.length > 0) {
        supabaseAdmin
            .rpc('increment_place_cache_hits', { p_place_ids: hitIds })
            .then(() => {})
            .catch(() => {});
    }

    // 3. Fetch misses from Google
    const missIds = placeIds.filter(id => !hitMap[id]);
    let fetchedMap = {};

    if (missIds.length > 0) {
        const fetched = apiKey
            ? await fetchPlaceDetails(apiKey, missIds)
            : [];

        // 4. Write new places to place_cache
        if (fetched.length > 0) {
            const expiry = cacheExpiry();
            const rows = fetched.map(p => ({
                place_id: p.id,
                data_json: p,
                cached_at: now,
                expires_at: expiry,
                hit_count: 0,
            }));
            // Upsert — ignore conflicts gracefully
            supabaseAdmin
                .from('place_cache')
                .upsert(rows, { onConflict: 'place_id' })
                .then(() => {})
                .catch(err => console.error('[Cache] place_cache write error:', err));

            for (const p of fetched) fetchedMap[p.id] = p;
        }
    }

    // 5. Reconstruct in original order
    return placeIds
        .map(id => hitMap[id] || fetchedMap[id] || null)
        .filter(Boolean);
}

// ─── POST /api/search ────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { province, district, category, keyword, minRating, minReviews, sessionId } = req.body;
        // countryCode defaults to 'TR' for full backward compatibility.
        const countryCode = (req.body.countryCode || 'TR').toUpperCase();

        // ── A. Session restore (history → search page) ──────────────────────
        if (sessionId) {
            const { data: existingSession, error: sessionError } = await supabaseAdmin
                .from('search_sessions')
                .select('*')
                .eq('id', sessionId)
                .eq('user_id', userId)
                .single();

            if (sessionError || !existingSession) {
                return res.status(404).json({ error: 'Session not found' });
            }

            if (new Date(existingSession.expires_at) < new Date()) {
                return res.status(410).json({ error: 'Session expired' });
            }

            const qKey = existingSession.query_key;

            // Try page 1 from query page cache (cache-first restore)
            if (qKey) {
                const { data: pageRow } = await supabaseAdmin
                    .from('search_query_pages')
                    .select('results_json, place_ids')
                    .eq('query_key', qKey)
                    .eq('page_number', 1)
                    .gt('expires_at', new Date().toISOString())
                    .maybeSingle();

                if (pageRow) {
                    // Increment hit counts via SQL RPCs (fire-and-forget)
                    supabaseAdmin
                        .rpc('increment_query_cache_hit', { p_query_key: qKey })
                        .then(() => {}).catch(() => {});
                    supabaseAdmin
                        .rpc('increment_page_cache_hit', { p_query_key: qKey, p_page_number: 1 })
                        .then(() => {}).catch(() => {});

                    return res.json({
                        sessionId: existingSession.id,
                        results: pageRow.results_json,
                        totalResults: existingSession.total_results,
                        currentPage: 1,
                        fromCache: true,
                    });
                }
            }

            // Fallback: use place_ids stored in session (old sessions without query_key)
            const apiKey = await getGoogleMapsApiKey();
            const allIds = Array.isArray(existingSession.place_ids) ? existingSession.place_ids : [];
            const pageIds = allIds.slice(0, PAGE_SIZE);

            let results = [];
            if (pageIds.length > 0) {
                results = await fetchPlaceDetailsWithCache(apiKey, pageIds);
            }

            const sessionMinRating = existingSession.min_rating;
            const sessionMinReviews = existingSession.min_reviews;
            if (sessionMinRating) results = results.filter(r => r.rating >= sessionMinRating);
            if (sessionMinReviews) results = results.filter(r => r.reviews >= sessionMinReviews);

            return res.json({
                sessionId: existingSession.id,
                results,
                totalResults: existingSession.total_results,
                currentPage: 1,
            });
        }

        // ── B. New search ────────────────────────────────────────────────────
        if (!province || !category) {
            return res.status(400).json({ error: 'Province and category are required' });
        }

        const queryKey = buildQueryKey(province, district, category, keyword, minRating, minReviews, countryCode);
        const now = new Date().toISOString();

        // 1. Check query cache
        const { data: queryCacheRow } = await supabaseAdmin
            .from('search_query_cache')
            .select('*')
            .eq('query_key', queryKey)
            .gt('expires_at', now)
            .maybeSingle();

        let totalResults;
        let allPlaceIds;
        let fromCache = false;

        if (queryCacheRow) {
            totalResults = queryCacheRow.total_results;
            allPlaceIds = queryCacheRow.all_place_ids || [];
            fromCache = true;

            // Increment query cache hit
            supabaseAdmin
                .rpc('increment_query_cache_hit', { p_query_key: queryKey })
                .then(() => {}).catch(() => {});

            // 2. Check page 1 cache
            const { data: page1Row } = await supabaseAdmin
                .from('search_query_pages')
                .select('results_json, place_ids')
                .eq('query_key', queryKey)
                .eq('page_number', 1)
                .gt('expires_at', now)
                .maybeSingle();

            if (page1Row) {
                // Full cache hit — no Google calls
                supabaseAdmin
                    .rpc('increment_page_cache_hit', { p_query_key: queryKey, p_page_number: 1 })
                    .then(() => {}).catch(() => {});

                // Create session pointing to query_key
                const { data: session } = await supabaseAdmin
                    .from('search_sessions')
                    .insert({
                        user_id: userId,
                        country_code: countryCode,
                        province,
                        district: district || null,
                        category,
                        keyword: keyword || null,
                        min_rating: minRating || null,
                        min_reviews: minReviews || null,
                        total_results: totalResults,
                        viewed_pages: [1],
                        query_key: queryKey,
                        // keep place_ids compatible — store first page IDs from cache
                        place_ids: allPlaceIds,
                    })
                    .select()
                    .single();

                return res.json({
                    sessionId: session?.id,
                    results: page1Row.results_json,
                    totalResults,
                    currentPage: 1,
                    fromCache: true,
                });
            }
        }

        // 3. Cache miss — call Google
        const apiKey = await getGoogleMapsApiKey();
        if (!apiKey) {
            return res.status(503).json({
                error: 'Google Maps API not configured',
                message: 'Admin panelinden Google Maps API key ayarlayın.',
            });
        }

        console.log('[Search] Cache miss — hitting Google. Query:', queryKey);

        const query = buildSearchQuery(province, district, category, keyword, countryCode);
        const { placeIds } = await collectPlaceIdsFiltered(apiKey, query, minRating, countryCode);

        // Apply minReviews filter: fetch details for all, filter, keep IDs ordered
        let filteredIds = placeIds;
        let page1Results;

        if (minReviews) {
            const allDetails = await fetchPlaceDetailsWithCache(apiKey, placeIds);
            const filtered = allDetails.filter(r => r.reviews >= minReviews);
            filteredIds = filtered.map(r => r.id);
            page1Results = filtered.slice(0, PAGE_SIZE);
        } else {
            const page1Ids = placeIds.slice(0, PAGE_SIZE);
            page1Results = await fetchPlaceDetailsWithCache(apiKey, page1Ids);
        }

        totalResults = filteredIds.length;
        allPlaceIds = filteredIds;

        const expiry = cacheExpiry();

        // 4. Write/update query cache
        await supabaseAdmin
            .from('search_query_cache')
            .upsert({
                query_key: queryKey,
                province: province || null,
                district: district || null,
                category: category || null,
                keyword: keyword || null,
                min_rating: minRating || null,
                min_reviews: minReviews || null,
                total_results: totalResults,
                all_place_ids: allPlaceIds,
                created_at: now,
                expires_at: expiry,
                hit_count: 0,
            }, { onConflict: 'query_key', ignoreDuplicates: false })
            .then(() => {}).catch(err => console.error('[Cache] query_cache write error:', err));

        // 5. Write page 1 to page cache
        await supabaseAdmin
            .from('search_query_pages')
            .upsert({
                query_key: queryKey,
                page_number: 1,
                results_json: page1Results,
                place_ids: filteredIds.slice(0, PAGE_SIZE),
                created_at: now,
                expires_at: expiry,
                hit_count: 0,
            }, { onConflict: 'query_key,page_number', ignoreDuplicates: false })
            .then(() => {}).catch(err => console.error('[Cache] page_cache write error:', err));

        // 6. Create session
        let session, sessionError;
        ({ data: session, error: sessionError } = await supabaseAdmin
            .from('search_sessions')
            .insert({
                user_id: userId,
                country_code: countryCode,
                province,
                district: district || null,
                category,
                keyword: keyword || null,
                min_rating: minRating || null,
                min_reviews: minReviews || null,
                total_results: totalResults,
                viewed_pages: [1],
                place_ids: allPlaceIds,   // kept for backward compat
                query_key: queryKey,
            })
            .select()
            .single());

        if (sessionError) {
            console.error('[Search] Failed to create session:', sessionError);
            return res.status(500).json({
                error: 'Failed to create search session',
                details: sessionError.message,
            });
        }

        console.log('[Search] Session created:', session.id, 'total:', totalResults, 'fromCache:', fromCache);

        // Log search_started event (non-fatal)
        await logEvent(supabaseAdmin, {
            level: 'info',
            source: 'search',
            event_type: 'search_started',
            actor_user_id: userId,
            target_type: 'search_session',
            target_id: session.id,
            message: `Arama başlatıldı: ${province}${district ? ' / ' + district : ''} — ${category}`,
            credit_delta: 0,
            metadata: { province, district, category, keyword, total_results: totalResults, from_cache: fromCache },
        });

        res.json({
            sessionId: session.id,
            results: page1Results,
            totalResults,
            currentPage: 1,
            fromCache,
        });

    } catch (err) {
        console.error('[Search] Error:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ─── GET /api/search/:sessionId/page/:pageNumber ─────────────────────────────

router.get('/:sessionId/page/:pageNumber', requireAuth, async (req, res) => {
    try {
        const { sessionId, pageNumber } = req.params;
        const userId = req.user.id;
        const page = parseInt(pageNumber);

        if (!Number.isInteger(page) || page < 1) {
            return res.status(400).json({ error: 'Invalid page', message: 'Invalid page number' });
        }

        console.log('[Search] Page request:', { sessionId, page, userId });

        const { data: session, error: sessionError } = await supabaseAdmin
            .from('search_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single();

        if (sessionError || !session) {
            return res.status(404).json({ error: 'Search session not found' });
        }

        const totalPages = Math.max(1, Math.ceil(session.total_results / PAGE_SIZE));
        if (page > totalPages) {
            return res.status(404).json({ error: 'Page not found', message: 'Requested page is out of range' });
        }

        const viewedPages = Array.isArray(session.viewed_pages) ? session.viewed_pages : [];
        const alreadyViewed = viewedPages.includes(page);
        const creditsPerPage = await getCreditsPerPage();
        const creditCost = alreadyViewed ? 0 : creditsPerPage;

        // Deduct credits BEFORE fetch (lock the page-view intent).
        // viewed_pages is updated AFTER successful fetch to avoid
        // "credits deducted but page never loaded" inconsistency.
        if (!alreadyViewed) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();

            if ((profile?.credits || 0) < creditCost) {
                return res.status(402).json({
                    error: 'Insufficient credits',
                    message: 'Yeterli krediniz yok',
                    required: creditCost,
                    available: profile?.credits || 0,
                });
            }

            const { error: deductError } = await supabaseAdmin
                .rpc('decrement_credits', { user_id: userId, amount: creditCost });

            if (deductError) {
                console.error('[Search] Credit deduction failed:', deductError);
                return res.status(500).json({ error: 'Failed to deduct credits' });
            }
            // NOTE: viewed_pages written after successful content fetch below
        }

        const now = new Date().toISOString();
        const queryKey = session.query_key;

        // ── Cache-first page fetch ───────────────────────────────────────────
        if (queryKey) {
            const { data: pageRow } = await supabaseAdmin
                .from('search_query_pages')
                .select('results_json, place_ids')
                .eq('query_key', queryKey)
                .eq('page_number', page)
                .gt('expires_at', now)
                .maybeSingle();

            if (pageRow) {
                console.log('[Search] Page cache hit:', { queryKey, page });
                supabaseAdmin
                    .rpc('increment_page_cache_hit', { p_query_key: queryKey, p_page_number: page })
                    .then(() => {}).catch(() => {});

                // Write viewed_pages + event after confirming we have results
                if (!alreadyViewed && creditCost > 0) {
                    supabaseAdmin.from('search_sessions')
                        .update({ viewed_pages: [...viewedPages, page] })
                        .eq('id', sessionId)
                        .then(() => {}).catch(() => {});
                    logEvent(supabaseAdmin, {
                        level: 'info', source: 'search', event_type: 'page_view_paid',
                        actor_user_id: userId, target_type: 'search_session', target_id: sessionId,
                        message: `Ödeyerek sayfa görüntülendi: sayfa ${page}`,
                        credit_delta: -creditCost,
                        metadata: { session_id: sessionId, page, credits_per_page: creditsPerPage },
                    }).catch(() => {});
                }

                return res.json({
                    results: pageRow.results_json,
                    currentPage: page,
                    totalResults: session.total_results,
                    creditCost,
                    alreadyViewed,
                    fromCache: true,
                });
            }
        }

        // ── Cache miss — fetch from Google (place_cache first) ───────────────
        const apiKey = await getGoogleMapsApiKey();

        // Determine which place IDs belong to this page
        let pageIds = [];
        if (queryKey) {
            const { data: qcRow } = await supabaseAdmin
                .from('search_query_cache')
                .select('all_place_ids')
                .eq('query_key', queryKey)
                .maybeSingle();

            if (qcRow?.all_place_ids) {
                const start = (page - 1) * PAGE_SIZE;
                pageIds = qcRow.all_place_ids.slice(start, start + PAGE_SIZE);
            }
        }

        // Fallback to session place_ids (old sessions without query_key)
        if (pageIds.length === 0 && Array.isArray(session.place_ids)) {
            const start = (page - 1) * PAGE_SIZE;
            pageIds = session.place_ids.slice(start, start + PAGE_SIZE);
        }

        let results = [];
        if (pageIds.length > 0) {
            results = await fetchPlaceDetailsWithCache(apiKey, pageIds);
        } else if (!apiKey) {
            console.warn('[Search] No API key and no cached place IDs for page fetch');
        }

        // Compensation guard: credits were deducted but fetch returned nothing.
        // Attempt refund synchronously so we can report actual outcome to client.
        if (results.length === 0 && !alreadyViewed && creditCost > 0) {
            console.warn('[Search] Empty results after credit deduction — attempting compensation refund', {
                userId, sessionId, page, creditCost,
            });
            let compensationSucceeded = false;
            try {
                const { error: refundErr } = await supabaseAdmin
                    .rpc('decrement_credits', { user_id: userId, amount: -creditCost });
                if (refundErr) {
                    console.error('[Search] Compensation refund failed (RPC error):', refundErr);
                } else {
                    compensationSucceeded = true;
                    console.info('[Search] Compensation refund succeeded', { userId, creditCost });
                }
            } catch (refundEx) {
                console.error('[Search] Compensation refund threw:', refundEx);
            }
            return res.status(502).json({
                error: 'No results returned',
                message: compensationSucceeded
                    ? 'Sayfa verisi alınamadı. Krediniz iade edildi.'
                    : 'Sayfa verisi alınamadı. Kredi iadesi denendi ancak doğrulanamadı; lütfen destek ile iletişime geçin.',
                compensation_attempted: true,
                compensation_succeeded: compensationSucceeded,
            });
        }

        // Write this page to page cache if we have a query_key
        if (queryKey && results.length > 0) {
            const expiry = cacheExpiry();
            supabaseAdmin.from('search_query_pages')
                .upsert({
                    query_key: queryKey,
                    page_number: page,
                    results_json: results,
                    place_ids: pageIds,
                    created_at: now,
                    expires_at: expiry,
                    hit_count: 0,
                }, { onConflict: 'query_key,page_number', ignoreDuplicates: false })
                .then(() => {}).catch(err => console.error('[Cache] page write error:', err));
        }

        // Write viewed_pages + event AFTER successful fetch
        if (!alreadyViewed && creditCost > 0) {
            supabaseAdmin.from('search_sessions')
                .update({ viewed_pages: [...viewedPages, page] })
                .eq('id', sessionId)
                .then(() => {}).catch(() => {});
            logEvent(supabaseAdmin, {
                level: 'info', source: 'search', event_type: 'page_view_paid',
                actor_user_id: userId, target_type: 'search_session', target_id: sessionId,
                message: `Ödeyerek sayfa görüntülendi: sayfa ${page}`,
                credit_delta: -creditCost,
                metadata: { session_id: sessionId, page, credits_per_page: creditsPerPage },
            }).catch(() => {});
        }

        res.json({
            results,
            currentPage: page,
            totalResults: session.total_results,
            creditCost,
            alreadyViewed,
            fromCache: false,
        });

    } catch (err) {
        console.error('[Search] Page fetch error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/search/credit-cost ─────────────────────────────────────────────

router.get('/credit-cost', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('system_settings')
            .select('credits_per_page, credits_per_enrichment, credits_per_lead')
            .eq('id', 1)
            .single();

        if (error || !data) {
            return res.json({ credits_per_page: 10, credits_per_enrichment: 1, credits_per_lead: 1 });
        }

        res.json({
            credits_per_page: data.credits_per_page ?? 10,
            credits_per_enrichment: data.credits_per_enrichment ?? 1,
            credits_per_lead: data.credits_per_lead ?? 1,
        });
    } catch (err) {
        console.error('[Search] Credit cost fetch error:', err);
        res.json({ credits_per_page: 10, credits_per_enrichment: 1 });
    }
});

// ─── GET /api/search/sessions ────────────────────────────────────────────────

router.get('/sessions', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: sessions, error } = await supabaseAdmin
            .from('search_sessions')
            .select('*')
            .eq('user_id', userId)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Sessions] List error:', error.message);
            return res.status(500).json({ error: 'Failed to fetch sessions', details: error.message });
        }

        const normalizedSessions = sessions.map(row => ({
            id: row.id,
            country_code: row.country_code ?? 'TR',
            province: row.province ?? row.filters?.province ?? null,
            district: row.district ?? row.filters?.district ?? null,
            category: row.category ?? row.filters?.category ?? null,
            keyword: row.keyword ?? row.filters?.keyword ?? null,
            min_rating: row.min_rating ?? row.filters?.minRating ?? null,
            min_reviews: row.min_reviews ?? row.filters?.minReviews ?? null,
            total_results: row.total_results ?? 0,
            viewed_pages: Array.isArray(row.viewed_pages) ? row.viewed_pages : [],
            created_at: row.created_at,
            expires_at: row.expires_at,
        }));

        res.json({ sessions: normalizedSessions });
    } catch (err) {
        console.error('[Sessions] Error:', err.message);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ─── GET /api/search/sessions/:sessionId ─────────────────────────────────────

router.get('/sessions/:sessionId', requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        const { data: session, error } = await supabaseAdmin
            .from('search_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single();

        if (error || !session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (new Date(session.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Session expired' });
        }

        res.json({ session });
    } catch (err) {
        console.error('[Sessions] Detail error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
