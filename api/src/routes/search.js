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

/**
 * Load the per-record credit rate from system_settings.
 * The DB column is still named `credits_per_page` — no schema migration required.
 * Runtime semantics: 1 credit = 1 newly-returned business record.
 * A full batch (20 results) → 20 credits. A 13-result batch → 13 credits.
 */
async function getCreditsPerRecord() {
    const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('credits_per_page')   // column name kept; value is interpreted as per-record rate
        .eq('id', 1)
        .single();
    if (error || data?.credits_per_page == null) return 1;
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
 * Returns all unique place IDs.
 * Safety ceiling is 200 — large enough for a real candidate pool,
 * not so large as to run uncontrolled Google API costs.
 */
async function collectPlaceIdsFiltered(apiKey, query, minRating, countryCode, maxResults = 200) {
    const placeIds = [];
    let pageToken = undefined;
    const maxPages = Math.ceil(maxResults / PAGE_SIZE);

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

// ── Controlled search expansion orchestrator ──────────────────────────────────
// Runs up to 4 deterministic query variants, deduplicates IDs in stable
// first-seen order, and stops early once the pool is large enough.
// Downstream billing/session/cache/page flow is unchanged.
//
// Thresholds:
//   EXPANSION_TARGET   — pool size considered "healthy enough" to stop early
//   EXPANSION_MIN_GAIN — min new IDs a fallback must add to continue (keyword path only)
//
const EXPANSION_TARGET   = 80;  // stop adding variants once pool ≥ this
const EXPANSION_MIN_GAIN = 10;  // skip keyword-off if gain < this (not used on no-keyword path)

/**
 * Deduplicate placeId arrays in stable first-seen order.
 */
function dedupeIds(arrays) {
    const seen = new Set();
    const result = [];
    for (const arr of arrays) {
        for (const id of arr) {
            if (!seen.has(id)) {
                seen.add(id);
                result.push(id);
            }
        }
    }
    return result;
}

/**
 * Collect an expanded candidate pool by running up to 4 deterministic query
 * variants and merging the results in stable first-seen dedup order.
 *
 * Variant policy:
 *   1. Base query              — always runs
 *   2. District-off query      — only if district is present AND pool is still shallow
 *   3a. Keyword-off query      — only if keyword is present AND pool is still shallow
 *       (min-gain bail-out applies: if district-off gained < EXPANSION_MIN_GAIN, stop)
 *   3b. District-focused query — only if NO keyword AND district is present AND pool is still shallow
 *       Uses district as the location anchor (no province prefix), surfacing results
 *       Google returns for the district name alone. Min-gain bail-out does NOT apply here
 *       so broad no-keyword searches always get this extra pass before giving up.
 *
 * Returns a deduplicated ordered array of placeIds for the downstream pipeline.
 */
async function collectExpandedCandidatePool(apiKey, { province, district, category, keyword, minRating, countryCode }) {
    const allBatches = [];

    // 1. Base query — always
    const baseQuery = buildSearchQuery(province, district, category, keyword, countryCode);
    const { placeIds: baseIds } = await collectPlaceIdsFiltered(apiKey, baseQuery, minRating, countryCode);
    allBatches.push(baseIds);
    let pool = dedupeIds(allBatches);
    console.log('[Search] Expansion base:', baseQuery, '| collected:', baseIds.length, '| pool:', pool.length);

    if (pool.length >= EXPANSION_TARGET) return pool;

    // 2. District-off variant — only if district exists and pool is still shallow
    let districtOffGain = 0;
    if (district) {
        const districtOffQuery = buildSearchQuery(province, null, category, keyword, countryCode);
        const { placeIds: districtOffIds } = await collectPlaceIdsFiltered(apiKey, districtOffQuery, minRating, countryCode);
        const before = pool.length;
        allBatches.push(districtOffIds);
        pool = dedupeIds(allBatches);
        districtOffGain = pool.length - before;
        console.log('[Search] Expansion district-off:', districtOffQuery, '| gained:', districtOffGain, '| pool:', pool.length);

        if (pool.length >= EXPANSION_TARGET) return pool;
    }

    if (keyword) {
        // 3a. Keyword-off variant — only if keyword exists and pool still shallow.
        // Apply min-gain bail-out: if district-off was weak, keyword-off is unlikely to help.
        // Guarded exception: if the pool is still shallow (< 2 pages worth of results),
        // try keyword-off once even when district-off gain was low — early bail-out is
        // too aggressive in this combination and leaves the pool unnecessarily thin.
        const poolIsShallow = pool.length < 40; // 2 × PAGE_SIZE
        if (districtOffGain < EXPANSION_MIN_GAIN && district && !poolIsShallow) return pool;

        const keywordOffQuery = buildSearchQuery(province, district, category, null, countryCode);
        const { placeIds: keywordOffIds } = await collectPlaceIdsFiltered(apiKey, keywordOffQuery, minRating, countryCode);
        const before = pool.length;
        allBatches.push(keywordOffIds);
        pool = dedupeIds(allBatches);
        const gain = pool.length - before;
        console.log('[Search] Expansion keyword-off:', keywordOffQuery, '| gained:', gain, '| pool:', pool.length);
    } else if (district) {
        // 3b. District-focused variant — no-keyword broad search only.
        // Uses district as the sole location anchor (province prefix omitted) so Google
        // applies a tighter geographic scope, often surfacing different results than
        // `province district category` or `province category`.
        // Min-gain bail-out is intentionally skipped: broad no-keyword searches need
        // this extra pass even when district-off was overlapping.
        const districtFocusedQuery = buildSearchQuery(district, null, category, null, countryCode);
        const { placeIds: districtFocusedIds } = await collectPlaceIdsFiltered(apiKey, districtFocusedQuery, minRating, countryCode);
        const before = pool.length;
        allBatches.push(districtFocusedIds);
        pool = dedupeIds(allBatches);
        const gain = pool.length - before;
        console.log('[Search] Expansion district-focused:', districtFocusedQuery, '| gained:', gain, '| pool:', pool.length);
    }

    return pool;
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
                        // authoritative hasMore: pool has more candidates beyond page 1
                        hasMore: (Array.isArray(pageRow.place_ids) ? pageRow.place_ids.length : (pageRow.results_json || []).length) >= PAGE_SIZE,
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
                // hasMore: more candidates beyond page 1 means the pool is larger than one page
                hasMore: allIds.length > PAGE_SIZE,
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
                    // authoritative hasMore: pool has candidates beyond the first page
                    hasMore: allPlaceIds.length > PAGE_SIZE,
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

        // Collect expanded candidate pool via controlled multi-variant orchestrator.
        // The orchestrator runs the base query first, then up to two deterministic
        // fallback variants (district-off, keyword-off) — only if the pool is shallow.
        // All downstream (billing / session / cache / page) contracts are unchanged.
        const allCandidateIds = await collectExpandedCandidatePool(apiKey, {
            province, district, category, keyword, minRating, countryCode,
        });

        // Apply minReviews filter: fetch details for all, filter, keep IDs ordered
        let filteredIds = allCandidateIds;
        let page1Results;

        if (minReviews) {
            const allDetails = await fetchPlaceDetailsWithCache(apiKey, allCandidateIds);
            const filtered = allDetails.filter(r => r.reviews >= minReviews);
            filteredIds = filtered.map(r => r.id);
            page1Results = filtered.slice(0, PAGE_SIZE);
        } else {
            const page1Ids = allCandidateIds.slice(0, PAGE_SIZE);
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
            // authoritative hasMore: pool has candidates beyond the first page
            hasMore: allPlaceIds.length > PAGE_SIZE,
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

        // ── Page-range validation ────────────────────────────────────────────
        // Use the actual candidate pool (all_place_ids or session.place_ids),
        // NOT total_results — that may be stale or from a pre-expansion session.
        const viewedPages = Array.isArray(session.viewed_pages) ? session.viewed_pages : [];
        const alreadyViewed = viewedPages.includes(page);

        let candidatePoolSize = session.total_results || 0; // safe fallback
        if (session.query_key) {
            const { data: qcRowForCount } = await supabaseAdmin
                .from('search_query_cache')
                .select('all_place_ids')
                .eq('query_key', session.query_key)
                .maybeSingle();
            if (qcRowForCount?.all_place_ids) candidatePoolSize = qcRowForCount.all_place_ids.length;
        } else if (Array.isArray(session.place_ids)) {
            candidatePoolSize = session.place_ids.length;
        }

        const totalPages = Math.max(1, Math.ceil(candidatePoolSize / PAGE_SIZE));
        if (page > totalPages) {
            return res.status(404).json({ error: 'Page not found', message: 'Requested page is out of range' });
        }

        // Billing model: 1 credit = 1 newly-returned business record.
        // Full batch (20 results) → 20 credits. Partial batch (e.g. 13) → 13 credits.
        // alreadyViewed page → 0 credits. Zero results → 0 credits.
        // Balance gate and deduction always use exact returned count — no overcharge, no refund.
        const creditsPerRecord = await getCreditsPerRecord();

        const now = new Date().toISOString();
        const queryKey = session.query_key;

        // ── Cache-first page fetch ───────────────────────────────────────────
        // For cache hits we know the exact result set BEFORE touching any credits.
        // This lets us compute the exact charge, check balance against it, and
        // deduct exactly — no overcharge, no refund needed on this path.
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

                const pageResults = pageRow.results_json || [];
                // Exact cost: 1 credit per returned business (capped at PAGE_SIZE).
                const exactCost = alreadyViewed ? 0 : Math.min(pageResults.length, PAGE_SIZE);

                if (!alreadyViewed && exactCost > 0) {
                    // Balance check against the actual charge — not a full-page estimate.
                    const { data: profile } = await supabaseAdmin
                        .from('profiles')
                        .select('credits')
                        .eq('id', userId)
                        .single();

                    if ((profile?.credits || 0) < exactCost) {
                        return res.status(402).json({
                            error: 'Insufficient credits',
                            message: 'Yeterli krediniz yok',
                            required: exactCost,
                            available: profile?.credits || 0,
                        });
                    }

                    const { error: deductError } = await supabaseAdmin
                        .rpc('decrement_credits', { user_id: userId, amount: exactCost });

                    if (deductError) {
                        console.error('[Search] Credit deduction failed:', deductError);
                        return res.status(500).json({ error: 'Failed to deduct credits' });
                    }
                }

                const hasMore = (page * PAGE_SIZE) < candidatePoolSize;

                if (!alreadyViewed && pageResults.length > 0) {
                    supabaseAdmin.from('search_sessions')
                        .update({ viewed_pages: [...viewedPages, page] })
                        .eq('id', sessionId)
                        .then(() => {}).catch(() => {});
                    logEvent(supabaseAdmin, {
                        level: 'info', source: 'search', event_type: 'page_view_paid',
                        actor_user_id: userId, target_type: 'search_session', target_id: sessionId,
                        message: `Ödeyerek sayfa görüntülendi: sayfa ${page} (${pageResults.length} işletme)`,
                        credit_delta: -exactCost,
                        metadata: { session_id: sessionId, page, results_returned: pageResults.length, credits_charged: exactCost },
                    }).catch(() => {});
                }

                return res.json({
                    results: pageResults,
                    currentPage: page,
                    totalResults: session.total_results,
                    creditCost: exactCost,
                    alreadyViewed,
                    hasMore,
                    fromCache: true,
                });
            }
        }

        // ── Cache miss — fetch from Google (place_cache first) ───────────────
        // Billing model: balance-gate → fetch → charge exact returned count.
        // No precharge, no refund on any normal path.
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

        // ── Billing step 1: pessimistic balance gate ─────────────────────────
        // Check the user can afford the maximum this page could cost (pageIds.length).
        // Short final pages already have fewer IDs → the gate is naturally lower.
        // This is NOT a deduction — it prevents fetching when the user clearly can't pay.
        const maxCost = alreadyViewed ? 0 : Math.min(pageIds.length, PAGE_SIZE);

        if (!alreadyViewed && maxCost > 0) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();

            if ((profile?.credits || 0) < maxCost) {
                return res.status(402).json({
                    error: 'Insufficient credits',
                    message: 'Yeterli krediniz yok',
                    // `required` is the worst-case cost. Actual charge ≤ this.
                    required: maxCost,
                    available: profile?.credits || 0,
                });
            }
        }

        // ── Billing step 2: fetch ────────────────────────────────────────────
        let results = [];
        if (pageIds.length > 0) {
            results = await fetchPlaceDetailsWithCache(apiKey, pageIds);
        } else if (!apiKey) {
            console.warn('[Search] No API key and no cached place IDs for page fetch');
        }

        // ── Billing step 3: charge exactly what was returned ─────────────────
        // actualCost = results.length. No overcharge, no refund on any normal path:
        //   - full page (20 results)       → charge 20
        //   - short final page (13 IDs)    → maxCost was 13, charge 13
        //   - Google failure, 0 returned  → charge 0, return 502 cleanly
        //   - partial Google failure       → charge only returned count
        const actualCost = alreadyViewed ? 0 : Math.min(results.length, PAGE_SIZE);

        if (!alreadyViewed && results.length === 0 && maxCost > 0) {
            // Fetch returned nothing; nothing was charged — safe to return error.
            console.warn('[Search] Cache-miss fetch returned 0 results — no credits charged', {
                userId, sessionId, page, pageIdCount: pageIds.length,
            });
            return res.status(502).json({
                error: 'No results returned',
                message: 'Sayfa verisi alınamadı. Krediniz düşülmedi.',
                credits_charged: 0,
            });
        }

        if (!alreadyViewed && actualCost > 0) {
            const { error: deductError } = await supabaseAdmin
                .rpc('decrement_credits', { user_id: userId, amount: actualCost });

            if (deductError) {
                // Deduction failed after we already served content. Log prominently.
                console.error('[Search] Credit deduction failed after fetch:', deductError);
                return res.status(500).json({ error: 'Failed to deduct credits' });
            }
        }

        const hasMore = (page * PAGE_SIZE) < candidatePoolSize;

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
        if (!alreadyViewed && results.length > 0) {
            supabaseAdmin.from('search_sessions')
                .update({ viewed_pages: [...viewedPages, page] })
                .eq('id', sessionId)
                .then(() => {}).catch(() => {});
            logEvent(supabaseAdmin, {
                level: 'info', source: 'search', event_type: 'page_view_paid',
                actor_user_id: userId, target_type: 'search_session', target_id: sessionId,
                message: `Ödeyerek sayfa görüntülendi: sayfa ${page} (${results.length} işletme)`,
                credit_delta: -actualCost,
                metadata: { session_id: sessionId, page, candidates: pageIds.length, results_returned: results.length, credits_charged: actualCost },
            }).catch(() => {});
        }

        res.json({
            results,
            currentPage: page,
            totalResults: session.total_results,
            creditCost: actualCost,
            alreadyViewed,
            hasMore,
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
            // credits_per_page column stores the per-record rate (1 credit = 1 business)
            .select('credits_per_page, credits_per_enrichment, credits_per_lead')
            .eq('id', 1)
            .single();

        if (error || !data) {
            // Record-based billing defaults:
            //   credits_per_record    — 1 credit = 1 newly-returned business (canonical)
            //   max_credits_per_batch — worst-case cost for a full 20-result batch
            //   credits_per_page      — legacy alias = max_credits_per_batch (NOT per-record)
            //                          kept so old consumers expecting page-level cost stay safe
            return res.json({
                credits_per_record:    1,
                max_credits_per_batch: 20,   // frontend shows "up to 20 credits"
                credits_per_page:      20,   // legacy alias: batch ceiling, NOT per-record cost
                credits_per_enrichment: 1,
                credits_per_lead: 1,
            });
        }

        // DB value = per-record rate. max_credits_per_batch = creditsPerRecord × 20.
        // credits_per_page is returned as the batch ceiling — NOT per-record — for legacy compat.
        const creditsPerRecord   = data.credits_per_page ?? 1;
        const maxCreditsPerBatch = creditsPerRecord * 20;   // e.g. 1 × 20 = 20

        res.json({
            credits_per_record:    creditsPerRecord,       // canonical: 1 credit = 1 record
            max_credits_per_batch: maxCreditsPerBatch,     // "up to N credits" per batch
            credits_per_page:      maxCreditsPerBatch,     // legacy: batch cost alias (NOT per-record)
            credits_per_enrichment: data.credits_per_enrichment ?? 1,
            credits_per_lead:      data.credits_per_lead ?? 1,
        });
    } catch (err) {
        console.error('[Search] Credit cost fetch error:', err);
        res.json({
            credits_per_record:    1,
            max_credits_per_batch: 20,
            credits_per_page:      20,
            credits_per_enrichment: 1,
        });
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
