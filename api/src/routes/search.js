import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/search
 * Perform search (0 credits - initial search is free per PRODUCT_SPEC)
 * 
 * Request body:
 * - province: string
 * - district: string (optional)
 * - category: string
 * - keyword: string (optional)
 * - minRating: number (optional)
 * - minReviews: number (optional)
 * 
 * Response:
 * - sessionId: UUID
 * - results: array (page 1, 20 items)
 * - totalResults: number
 * - currentPage: 1
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

            // Use session filters to generate results
            const sessionProvince = existingSession.province || existingSession.filters?.province || province;
            const sessionCategory = existingSession.category || existingSession.filters?.category || category;
            const mockResults = generateMockResults(200, sessionProvince, sessionCategory);

            // Return page 1 (always free for existing session)
            return res.json({
                sessionId: existingSession.id,
                results: mockResults.slice(0, 20),
                totalResults: mockResults.length,
                currentPage: 1
            });
        }

        // PRODUCT_SPEC 5.3: Create new session
        if (!province || !category) {
            return res.status(400).json({ error: 'Province and category are required' });
        }

        console.log('[Search] New search request:', { province, district, category, userId });

        // TODO: Actual search logic with Google Maps API
        // For now, return mock data
        const mockResults = generateMockResults(200, province, category);

        // Create search session
        let session, sessionError;

        // Try insert with keyword first (Section 5.4)
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
                total_results: mockResults.length,
                viewed_pages: [1] // Page 1 is always free
            })
            .select()
            .single());

        // Fallback: if keyword column doesn't exist, retry without it
        if (sessionError && (sessionError.message?.includes('keyword') || sessionError.message?.includes('schema cache'))) {
            console.log('[Search] Keyword column not found, retrying without keyword');
            ({ data: session, error: sessionError } = await supabaseAdmin
                .from('search_sessions')
                .insert({
                    user_id: userId,
                    province,
                    district,
                    category,
                    min_rating: minRating || null,
                    min_reviews: minReviews || null,
                    total_results: mockResults.length,
                    viewed_pages: [1]
                })
                .select()
                .single());
        }

        if (sessionError) {
            console.error('[Search] Failed to create session:', sessionError);
            return res.status(500).json({
                error: 'Failed to create search session',
                details: sessionError.message
            });
        }

        console.log('[Search] Session created:', session.id);

        // Return first page (20 results)
        res.json({
            sessionId: session.id,
            results: mockResults.slice(0, 20), // Page 1
            totalResults: mockResults.length,
            currentPage: 1
        });
    } catch (err) {
        console.error('[Search] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/search/:sessionId/page/:pageNumber
 * Get specific page of search results
 * 
 * Cost: 
 * - 10 credits if page not viewed before
 * - 0 credits if page already viewed
 * 
 * Responses:
 * - 200: Success with results
 * - 402: Insufficient credits
 * - 404: Session not found
 */
router.get('/:sessionId/page/:pageNumber', requireAuth, async (req, res) => {
    try {
        const { sessionId, pageNumber } = req.params;
        const userId = req.user.id;
        const page = parseInt(pageNumber);

        // PR4.1: Page number validation
        if (!Number.isInteger(page) || page < 1) {
            return res.status(400).json({
                error: 'Invalid page',
                message: 'Invalid page number'
            });
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

        // PR4.1: Upper bound validation
        const totalPages = Math.max(1, Math.ceil(session.total_results / 20));
        if (page > totalPages) {
            return res.status(404).json({
                error: 'Page not found',
                message: 'Requested page is out of range'
            });
        }

        // PR4.1: Null safety for viewed_pages
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
                    available: profile?.credits || 0
                });
            }

            // Deduct credits using RPC
            const { data: newCredits, error: deductError } = await supabaseAdmin
                .rpc('decrement_credits', {
                    user_id: userId,
                    amount: creditCost
                });

            if (deductError) {
                console.error('[Search] Credit deduction failed:', deductError);
                return res.status(500).json({ error: 'Failed to deduct credits' });
            }

            console.log('[Search] Credits deducted:', { amount: creditCost, newBalance: newCredits });

            // Mark page as viewed
            await supabaseAdmin
                .from('search_sessions')
                .update({
                    viewed_pages: [...viewedPages, page]
                })
                .eq('id', sessionId);

            console.log('[Search] Page added to viewed:', page);
        }

        // Get results for this page
        // TODO: Fetch from actual data source
        const mockResults = generateMockResults(session.total_results, session.province, session.category);
        const startIndex = (page - 1) * 20;
        const endIndex = startIndex + 20;
        const pageResults = mockResults.slice(startIndex, endIndex);

        res.json({
            results: pageResults,
            currentPage: page,
            totalResults: session.total_results,
            creditCost,
            alreadyViewed
        });
    } catch (err) {
        console.error('[Search] Page fetch error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Generate mock search results
 * TODO: Replace with actual Google Maps API integration
 */
function generateMockResults(count, province, category) {
    const categories = ["Restoran", "Kafe", "Berber", "Kuaför", "Market", "Eczane", "Veteriner", "Emlak"];
    const districts = ["Kadıköy", "Beşiktaş", "Şişli", "Fatih", "Üsküdar", "Beyoğlu", "Çankaya", "Keçiören"];
    const adjectives = ["Modern", "Lezzet", "Tarihi", "Yeni", "Anadolu", "Karadeniz", "Ege", "Akdeniz"];

    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `${adjectives[i % adjectives.length]} ${category || categories[i % categories.length]} ${Math.floor(i / 10) + 1}`,
        category: category || categories[i % categories.length],
        district: districts[i % districts.length],
        rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
        reviews: Math.floor(Math.random() * 3000) + 100,
        isOpen: i % 3 !== 0,
        phone: `+90 ${210 + (i % 6)}${(i % 10).toString().padStart(2, '0')} 555 ${String(1000 + i).slice(-4)}`,
        website: `www.business${i + 1}.com`,
        address: `${province || 'İstanbul'} / ${districts[i % districts.length]} Mah. No:${i + 1}`,
        hours: i % 3 === 0 ? "09:00 - 23:00" : "08:00 - 22:00",
    }));
}

/**
 * GET /api/search/sessions
 * List user's search sessions (PRODUCT_SPEC 5.4 - Search History)
 * Only returns active sessions (expires_at > now())
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
            console.error('[Sessions] List error:', error);
            console.error('[Sessions] Error details:', error.message, error.details);
            return res.status(500).json({
                error: 'Failed to fetch sessions',
                details: error.message
            });
        }

        // Normalize response for schema compatibility
        const normalizedSessions = sessions.map(row => ({
            id: row.id,
            province: row.province ?? row.filters?.province ?? row.filters?.city ?? null,
            district: row.district ?? row.filters?.district ?? row.filters?.town ?? null,
            category: row.category ?? row.filters?.category ?? null,
            keyword: row.keyword ?? row.filters?.keyword ?? null,
            min_rating: row.min_rating ?? row.filters?.minRating ?? null,
            min_reviews: row.min_reviews ?? row.filters?.minReviews ?? null,
            total_results: row.total_results ?? row.filters?.totalResults ?? 0,
            viewed_pages: Array.isArray(row.viewed_pages) ? row.viewed_pages :
                (Array.isArray(row.filters?.viewed_pages) ? row.filters.viewed_pages : []),
            created_at: row.created_at,
            expires_at: row.expires_at
        }));

        res.json({ sessions: normalizedSessions });
    } catch (err) {
        console.error('[Sessions] Error:', err);
        console.error('[Sessions] Error stack:', err.stack);
        res.status(500).json({
            error: 'Internal server error',
            details: err.message
        });
    }
});

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

        // Check if expired
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
