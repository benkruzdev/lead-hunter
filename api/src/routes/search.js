import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

const PAGE_SIZE = 20;
const PLACES_BASE = 'https://places.googleapis.com/v1';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch google_maps_api_key from system_settings table.
 * Returns null if not configured.
 */
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
 * Build a localized Turkish query string for Places Text Search.
 * e.g. "İstanbul Kadıköy restoran pasta"
 */
function buildSearchQuery(province, district, category, keyword) {
    const parts = [province];
    if (district) parts.push(district);
    parts.push(category);
    if (keyword) parts.push(keyword);
    return parts.join(' ');
}

/**
 * Map a single Places API (New) place object to our frontend SearchResult shape.
 */
function mapPlace(place) {
    // Extract district from addressComponents (sublocality > admin_level_3 > fallback)
    let district = null;
    if (Array.isArray(place.addressComponents)) {
        const sub = place.addressComponents.find(c =>
            c.types?.includes('sublocality_level_1') || c.types?.includes('sublocality')
        );
        const admin3 = place.addressComponents.find(c =>
            c.types?.includes('administrative_area_level_3')
        );
        district = sub?.longText || admin3?.longText || null;
    }

    // Phone: internationalPhoneNumber preferred
    const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || null;

    // Opening hours: first weekday description (Mon) or null
    const hours = place.regularOpeningHours?.weekdayDescriptions?.[0] || null;
    const isOpen = place.regularOpeningHours?.openNow ?? false;

    return {
        id: place.id || '', // String type to match Google Places ID, frontend handles string/number
        name: place.displayName?.text || place.name || '',
        category: place.primaryTypeDisplayName?.text || place.types?.[0] || '',
        district,
        rating: place.rating || 0,
        reviews: place.userRatingCount || 0,
        isOpen,
        phone,
        website: place.websiteUri || null,
        address: place.formattedAddress || null,
        hours,
    };
}

/**
 * Perform Places Text Search (New) and collect up to maxResults place_ids.
 * Returns { placeIds: string[], total: number }
 * maxResults capped at 60 (Places API Text Search limit: 3 pages × 20).
 */
async function collectPlaceIds(apiKey, query, maxResults = 60) {
    const placeIds = [];
    let pageToken = undefined;
    const maxPages = Math.ceil(Math.min(maxResults, 60) / PAGE_SIZE);

    for (let i = 0; i < maxPages; i++) {
        const body = {
            textQuery: query,
            languageCode: 'tr',
            regionCode: 'TR',
            maxResultCount: PAGE_SIZE,
        };
        if (pageToken) body.pageToken = pageToken;

        // Apply minRating directly in the Text Search request to reduce detailed fetches
        // minRating parameter matches Google Places API 'minRating' field range [0.0, 5.0]
        if (minRating && minRating > 0) {
            body.minRating = parseFloat(minRating);
        }

        const resp = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,nextPageToken',
            },
            body: JSON.stringify(body),
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
 * Perform Places Text Search (New) with rating filter.
 * Kept signature compatible. collectPlaceIds handles maxResults.
 */
async function collectPlaceIdsFiltered(apiKey, query, minRating, maxResults = 60) {
    const placeIds = [];
    let pageToken = undefined;
    const maxPages = Math.ceil(Math.min(maxResults, 60) / PAGE_SIZE);

    for (let i = 0; i < maxPages; i++) {
        const body = {
            textQuery: query,
            languageCode: 'tr',
            regionCode: 'TR',
            maxResultCount: PAGE_SIZE,
        };
        if (pageToken) body.pageToken = pageToken;
        // Text Search (New) supports minRating natively
        if (minRating && minRating > 0) {
            body.minRating = parseFloat(minRating);
        }

        const resp = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,nextPageToken',
            },
            body: JSON.stringify(body),
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
 * Fetch full details for an array of place_ids.
 * Returns array of mapped SearchResult objects.
 */
async function fetchPlaceDetails(apiKey, placeIds) {
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
        'regularOpeningHours',
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

// ─── POST /api/search ────────────────────────────────────────────────────────

/**
 * POST /api/search
 * Perform search (0 credits - initial search is free per PRODUCT_SPEC)
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { province, district, category, keyword, minRating, minReviews, sessionId } = req.body;

        // PRODUCT_SPEC 5.4: Resume existing session
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

            // Return page 1 from stored place_ids (free)
            const apiKey = await getGoogleMapsApiKey();
            const allIds = Array.isArray(existingSession.place_ids) ? existingSession.place_ids : [];
            const pageIds = allIds.slice(0, PAGE_SIZE);

            let results = [];
            if (apiKey && pageIds.length > 0) {
                results = await fetchPlaceDetails(apiKey, pageIds);
            }

            // Apply client-side filters if needed
            if (minRating) results = results.filter(r => r.rating >= minRating);
            if (minReviews) results = results.filter(r => r.reviews >= minReviews);

            return res.json({
                sessionId: existingSession.id,
                results,
                totalResults: existingSession.total_results,
                currentPage: 1,
            });
        }

        // PRODUCT_SPEC 5.3: New search
        if (!province || !category) {
            return res.status(400).json({ error: 'Province and category are required' });
        }

        // 1. Get API key
        const apiKey = await getGoogleMapsApiKey();
        if (!apiKey) {
            return res.status(503).json({
                error: 'Google Maps API not configured',
                message: 'Admin panelinden Google Maps API key ayarlayın.',
            });
        }

        console.log('[Search] New search request:', { province, district, category, keyword, userId });

        // 2. Text Search → collect place_ids (up to 60), pass minRating to API
        const query = buildSearchQuery(province, district, category, keyword);
        const { placeIds, total } = await collectPlaceIdsFiltered(apiKey, query, minRating);

        console.log('[Search] Places found:', total, 'query:', query);

        // 3. Fetch details for page 1 (first PAGE_SIZE ids)
        const page1Ids = placeIds.slice(0, PAGE_SIZE);
        let page1Results = page1Ids.length > 0 ? await fetchPlaceDetails(apiKey, page1Ids) : [];

        // 4. Apply filters (minReviews only, minRating already handled by collectPlaceIdsFiltered)
        let filteredIds = placeIds;
        if (minReviews) {
            // We need all details to filter globally by reviews; fetch all and rebuild id list
            const allDetails = await fetchPlaceDetails(apiKey, placeIds);
            const filtered = allDetails.filter(r => {
                if (minReviews && r.reviews < minReviews) return false;
                return true;
            });
            filteredIds = filtered.map(r => r.id);
            page1Results = filtered.slice(0, PAGE_SIZE);
        }

        const totalResults = filteredIds.length;

        // 5. Create session, store place_ids for pagination
        let session, sessionError;

        ({ data: session, error: sessionError } = await supabaseAdmin
            .from('search_sessions')
            .insert({
                user_id: userId,
                province,
                district,
                category,
                keyword: keyword || null,
                min_rating: minRating || null,
                min_reviews: minReviews || null,
                total_results: totalResults,
                viewed_pages: [1],
                place_ids: filteredIds,
            })
            .select()
            .single());

        // Do not silently fallback and insert a broken session if place_ids column is missing.
        // Pagination and credits depend entirely on place_ids. If it fails, report it loudly.
        if (sessionError && sessionError.message?.includes('place_ids')) {
            console.error('[Search] FATAL: search_sessions.place_ids column is missing. Run migration.');
            return res.status(500).json({
                error: 'Database schema incomplete',
                message: 'Admin sayfasına gidip search_sessions tablosuna place_ids TEXT[] eklemelisiniz.',
                details: sessionError.message
            });
        }


        if (sessionError) {
            console.error('[Search] Failed to create session:', sessionError);
            return res.status(500).json({
                error: 'Failed to create search session',
                details: sessionError.message,
            });
        }

        console.log('[Search] Session created:', session.id, 'total:', totalResults);

        res.json({
            sessionId: session.id,
            results: page1Results,
            totalResults,
            currentPage: 1,
        });

    } catch (err) {
        console.error('[Search] Error:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ─── GET /api/search/:sessionId/page/:pageNumber ─────────────────────────────

/**
 * GET /api/search/:sessionId/page/:pageNumber
 * Cost: 10 credits if page not viewed before, 0 if already viewed.
 */
router.get('/:sessionId/page/:pageNumber', requireAuth, async (req, res) => {
    try {
        const { sessionId, pageNumber } = req.params;
        const userId = req.user.id;
        const page = parseInt(pageNumber);

        if (!Number.isInteger(page) || page < 1) {
            return res.status(400).json({ error: 'Invalid page', message: 'Invalid page number' });
        }

        console.log('[Search] Page request:', { sessionId, page, userId });

        // Get search session
        const { data: session, error: sessionError } = await supabaseAdmin
            .from('search_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single();

        if (sessionError || !session) {
            console.error('[Search] Session not found:', sessionError);
            return res.status(404).json({ error: 'Search session not found' });
        }

        // Upper bound validation
        const totalPages = Math.max(1, Math.ceil(session.total_results / PAGE_SIZE));
        if (page > totalPages) {
            return res.status(404).json({ error: 'Page not found', message: 'Requested page is out of range' });
        }

        const viewedPages = Array.isArray(session.viewed_pages) ? session.viewed_pages : [];
        const alreadyViewed = viewedPages.includes(page);
        const creditCost = alreadyViewed ? 0 : 10;

        console.log('[Search] Page viewed check:', { page, alreadyViewed, creditCost });

        if (!alreadyViewed) {
            // Check credits
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();

            if ((profile?.credits || 0) < creditCost) {
                console.log('[Search] Insufficient credits:', { required: creditCost, available: profile?.credits });
                return res.status(402).json({
                    error: 'Insufficient credits',
                    message: 'Yeterli krediniz yok',
                    required: creditCost,
                    available: profile?.credits || 0,
                });
            }

            // Deduct credits
            const { error: deductError } = await supabaseAdmin
                .rpc('decrement_credits', { user_id: userId, amount: creditCost });

            if (deductError) {
                console.error('[Search] Credit deduction failed:', deductError);
                return res.status(500).json({ error: 'Failed to deduct credits' });
            }

            // Mark page as viewed
            await supabaseAdmin
                .from('search_sessions')
                .update({ viewed_pages: [...viewedPages, page] })
                .eq('id', sessionId);

            console.log('[Search] Credits deducted and page marked:', page);
        }

        // Fetch results for this page from stored place_ids
        const apiKey = await getGoogleMapsApiKey();
        const allIds = Array.isArray(session.place_ids) ? session.place_ids : [];
        const start = (page - 1) * PAGE_SIZE;
        const pageIds = allIds.slice(start, start + PAGE_SIZE);

        let results = [];
        if (apiKey && pageIds.length > 0) {
            results = await fetchPlaceDetails(apiKey, pageIds);
        } else if (!apiKey) {
            console.warn('[Search] No API key for page fetch — returning empty results');
        }

        res.json({
            results,
            currentPage: page,
            totalResults: session.total_results,
            creditCost,
            alreadyViewed,
        });

    } catch (err) {
        console.error('[Search] Page fetch error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/search/sessions ────────────────────────────────────────────────

/**
 * GET /api/search/sessions
 * List user's search sessions (PRODUCT_SPEC 5.4 - Search History)
 */
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

/**
 * GET /api/search/sessions/:sessionId
 * Get specific session detail (PRODUCT_SPEC 5.4 - Continue search)
 */
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
