import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logEvent } from '../utils/eventLogger.js';
import { listProviders, upsertProvider, maskSecret } from '../utils/paymentProviders.js';

const router = express.Router();

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/config
 * Get system configuration (admin only)
 * SPEC 6.1: Admin routes are hidden behind secret path
 */
router.get('/config', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('system_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('Failed to fetch system settings:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json({ config: data });
    } catch (err) {
        console.error('Get admin config error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/${ADMIN_ROUTE_SECRET}/admin/config
 * Update system configuration (admin only)
 * SPEC 6.1: Admin routes are hidden behind secret path
 */
router.patch('/config', requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            recaptcha_enabled,
            recaptcha_site_key,
            recaptcha_secret_key,
            google_oauth_enabled,
            google_client_id,
            google_client_secret,
            google_maps_api_key
        } = req.body;

        const updates = { updated_at: new Date().toISOString() };

        if (recaptcha_enabled !== undefined) updates.recaptcha_enabled = recaptcha_enabled;
        if (recaptcha_site_key !== undefined) updates.recaptcha_site_key = recaptcha_site_key;
        if (recaptcha_secret_key !== undefined) updates.recaptcha_secret_key = recaptcha_secret_key;
        if (google_oauth_enabled !== undefined) updates.google_oauth_enabled = google_oauth_enabled;
        if (google_client_id !== undefined) updates.google_client_id = google_client_id;
        if (google_client_secret !== undefined) updates.google_client_secret = google_client_secret;
        if (google_maps_api_key !== undefined) updates.google_maps_api_key = google_maps_api_key;

        const { data, error } = await supabaseAdmin
            .from('system_settings')
            .update(updates)
            .eq('id', 1)
            .select()
            .single();

        if (error) {
            console.error('Failed to update system settings:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json({ success: true, config: data });
    } catch (err) {
        console.error('Update admin config error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/dashboard
 * Get admin dashboard statistics (admin only)
 * SPEC 6.2: Admin dashboard metrics
 */
router.get('/dashboard', requireAuth, requireAdmin, async (req, res) => {
    try {
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

        // Total users count (active users only - exclude soft-deleted)
        let totalUsers = 0;

        const { count: usersCount, error: usersError } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('is_deleted', false);

        if (usersError) {
            // Fallback: try deleted_at if is_deleted column doesn't exist
            const { count: totalUsersFallback, error: usersFallbackError } = await supabaseAdmin
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null);

            if (usersFallbackError) {
                console.error('Failed to count users:', usersFallbackError);
                return res.status(500).json({
                    error: 'Database error',
                    message: usersFallbackError.message
                });
            }

            totalUsers = totalUsersFallback || 0;
        } else {
            totalUsers = usersCount || 0;
        }

        // Daily search count (search_sessions created today)
        const { count: dailySearchCount, error: searchError } = await supabaseAdmin
            .from('search_sessions')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfToday.toISOString());

        if (searchError) {
            console.error('Failed to count searches:', searchError);
            return res.status(500).json({
                error: 'Database error',
                message: searchError.message
            });
        }

        // Daily credits spent (sum of negative amounts in credit_ledger today)
        const { data: creditData, error: creditError } = await supabaseAdmin
            .from('credit_ledger')
            .select('amount')
            .lt('amount', 0)
            .gte('created_at', startOfToday.toISOString());

        if (creditError) {
            console.error('Failed to query credits:', creditError);
            return res.status(500).json({
                error: 'Database error',
                message: creditError.message
            });
        }

        const dailyCreditsSpent = Math.abs(
            (creditData || []).reduce((sum, row) => sum + row.amount, 0)
        );

        // Daily exports count
        const { count: dailyExportsCount, error: exportsError } = await supabaseAdmin
            .from('exports')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfToday.toISOString());

        if (exportsError) {
            console.error('Failed to count exports:', exportsError);
            return res.status(500).json({
                error: 'Database error',
                message: exportsError.message
            });
        }

        res.json({
            total_users: totalUsers,
            daily_search_count: dailySearchCount || 0,
            daily_credits_spent: dailyCreditsSpent,
            daily_exports_count: dailyExportsCount || 0
        });
    } catch (err) {
        console.error('Get admin dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/users
 * List users with search and pagination (admin only)
 * SPEC 6.3: Admin user management
 */
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { query = '', limit = 25, offset = 0 } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 25, 100);
        const parsedOffset = parseInt(offset) || 0;

        // Try with status first (SPEC field name)
        const selectFields = 'id,full_name,phone,plan,credits,status,role,is_deleted,deleted_at,created_at,updated_at,email';

        let usersQuery = supabaseAdmin
            .from('profiles')
            .select(selectFields, { count: 'exact' });

        // Search filter
        if (query) {
            usersQuery = usersQuery.or(`email.ilike.%${query}%,full_name.ilike.%${query}%,phone.ilike.%${query}%`);
        }

        // Apply pagination
        usersQuery = usersQuery
            .range(parsedOffset, parsedOffset + parsedLimit - 1)
            .order('created_at', { ascending: false });

        const { data: users, count, error } = await usersQuery;

        if (error) {
            // Check if status column is missing (need to fallback to is_active)
            const statusMissing = error.message && error.message.includes('status');
            const emailMissing = error.message && error.message.includes('email');

            if (statusMissing || emailMissing) {
                // Build fallback select fields
                let fallbackFields = 'id,full_name,phone,plan,credits,role,is_deleted,deleted_at,created_at,updated_at';

                // Add status or is_active
                if (statusMissing) {
                    fallbackFields += ',is_active';  // Fallback to is_active
                } else {
                    fallbackFields += ',status';
                }

                // Add email if not missing
                if (!emailMissing) {
                    fallbackFields += ',email';
                }

                let retryQuery = supabaseAdmin
                    .from('profiles')
                    .select(fallbackFields, { count: 'exact' });

                if (query) {
                    if (emailMissing) {
                        retryQuery = retryQuery.or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`);
                    } else {
                        retryQuery = retryQuery.or(`email.ilike.%${query}%,full_name.ilike.%${query}%,phone.ilike.%${query}%`);
                    }
                }

                retryQuery = retryQuery
                    .range(parsedOffset, parsedOffset + parsedLimit - 1)
                    .order('created_at', { ascending: false });

                const { data: retryUsers, count: retryCount, error: retryError } = await retryQuery;

                if (retryError) {
                    console.error('Failed to fetch users:', retryError);
                    return res.status(500).json({
                        error: 'Database error',
                        message: retryError.message
                    });
                }

                // Map is_active to status if we used fallback
                const mappedUsers = (retryUsers || []).map(user => {
                    if (statusMissing && user.is_active !== undefined) {
                        const { is_active, ...rest } = user;
                        return { ...rest, status: is_active };
                    }
                    return user;
                });

                return res.json({
                    users: mappedUsers,
                    total: retryCount || 0
                });
            }

            console.error('Failed to fetch users:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json({
            users: users || [],
            total: count || 0
        });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/users/:id
 * Get single user by ID (admin only)
 * SPEC 6.3: Admin user management
 */
router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Try with status first (SPEC field name)
        const selectFields = 'id,full_name,phone,plan,credits,status,role,is_deleted,deleted_at,created_at,updated_at,email';

        const { data: user, error } = await supabaseAdmin
            .from('profiles')
            .select(selectFields)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Not found',
                    message: 'User not found'
                });
            }

            // Check what's missing
            const statusMissing = error.message && error.message.includes('status');
            const emailMissing = error.message && error.message.includes('email');

            if (statusMissing || emailMissing) {
                // Build fallback select fields
                let fallbackFields = 'id,full_name,phone,plan,credits,role,is_deleted,deleted_at,created_at,updated_at';

                // Add status or is_active
                if (statusMissing) {
                    fallbackFields += ',is_active';  // Fallback to is_active
                } else {
                    fallbackFields += ',status';
                }

                // Add email if not missing
                if (!emailMissing) {
                    fallbackFields += ',email';
                }

                const { data: retryUser, error: retryError } = await supabaseAdmin
                    .from('profiles')
                    .select(fallbackFields)
                    .eq('id', id)
                    .single();

                if (retryError) {
                    if (retryError.code === 'PGRST116') {
                        return res.status(404).json({
                            error: 'Not found',
                            message: 'User not found'
                        });
                    }
                    console.error('Failed to fetch user:', retryError);
                    return res.status(500).json({
                        error: 'Database error',
                        message: retryError.message
                    });
                }

                // Map is_active to status if we used fallback
                if (statusMissing && retryUser.is_active !== undefined) {
                    const { is_active, ...rest } = retryUser;
                    return res.json({ ...rest, status: is_active });
                }

                return res.json(retryUser);
            }

            console.error('Failed to fetch user:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json(user);
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/${ADMIN_ROUTE_SECRET}/admin/users/:id
 * Update user (admin only)
 * SPEC 6.3: Admin user management
 */
router.patch('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, credits, status, role, is_deleted } = req.body;

        // Validate inputs
        if (role !== undefined && !['user', 'admin'].includes(role)) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Role must be either "user" or "admin"'
            });
        }

        if (credits !== undefined) {
            const parsedCredits = parseInt(credits);
            if (isNaN(parsedCredits) || parsedCredits < 0) {
                return res.status(400).json({
                    error: 'Invalid input',
                    message: 'Credits must be a non-negative integer'
                });
            }
        }

        // Build updates object
        const updates = {};

        if (plan !== undefined) updates.plan = plan;
        if (credits !== undefined) updates.credits = parseInt(credits);
        if (status !== undefined) updates.status = status;  // Try status first
        if (role !== undefined) updates.role = role;

        // Handle is_deleted
        if (is_deleted !== undefined) {
            const parsedDeleted = is_deleted === true || is_deleted === 'true';
            updates.is_deleted = parsedDeleted;
            updates.deleted_at = parsedDeleted ? new Date().toISOString() : null;
        }

        // Try to set updated_at if column exists
        updates.updated_at = new Date().toISOString();

        const { data: updatedUser, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            // Handle column-specific errors independently
            const retryUpdates = { ...updates };
            let needsRetry = false;

            // Handle updated_at missing
            if (error.message && error.message.includes('updated_at')) {
                delete retryUpdates.updated_at;
                needsRetry = true;
            }

            // Handle status missing -> fallback to is_active
            if (error.message && error.message.includes('status') && status !== undefined) {
                retryUpdates.is_active = status;
                delete retryUpdates.status;
                needsRetry = true;
            }

            // Handle is_deleted missing
            if (error.message && error.message.includes('is_deleted') && is_deleted !== undefined) {
                delete retryUpdates.is_deleted;
                needsRetry = true;
            }

            // Handle deleted_at missing
            if (error.message && error.message.includes('deleted_at') && updates.deleted_at !== undefined) {
                delete retryUpdates.deleted_at;
                needsRetry = true;
                // If both is_deleted and deleted_at are missing, soft delete not supported
                if (!retryUpdates.is_deleted && is_deleted !== undefined) {
                    return res.status(400).json({
                        error: 'Invalid input',
                        message: 'Soft delete is not supported in this schema'
                    });
                }
            }

            // Handle credits missing
            if (error.message && error.message.includes('credits') && credits !== undefined) {
                return res.status(400).json({
                    error: 'Invalid input',
                    message: 'Credits field is not supported in this schema'
                });
            }

            if (needsRetry) {
                const { data: retryUser, error: retryError } = await supabaseAdmin
                    .from('profiles')
                    .update(retryUpdates)
                    .eq('id', id)
                    .select()
                    .single();

                if (retryError) {
                    // Check if is_active also missing (both status and is_active don't exist)
                    if (retryError.message && retryError.message.includes('is_active') && status !== undefined) {
                        return res.status(400).json({
                            error: 'Invalid input',
                            message: 'Status field is not supported in this schema'
                        });
                    }

                    if (retryError.code === 'PGRST116') {
                        return res.status(404).json({
                            error: 'Not found',
                            message: 'User not found'
                        });
                    }

                    console.error('Failed to update user (retry):', retryError);
                    return res.status(500).json({
                        error: 'Database error',
                        message: retryError.message
                    });
                }

                return res.json(retryUser);
            }

            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Not found',
                    message: 'User not found'
                });
            }

            console.error('Failed to update user:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json(updatedUser);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/costs
 * Operational usage + Places API (New) cost estimation (admin only).
 *
 * Places API (New) pricing used (USD, as of 2024):
 *   Text Search (New): $0.004 / call
 *   Place Details (New): $0.005 / call
 *
 * Estimation logic (derived from search.js code, NOT from live telemetry):
 *   Per new search session:
 *     - Text Search calls: collectPlaceIdsFiltered runs up to ceil(60/20)=3 TextSearch calls.
 *       We can't tell from DB how many pages it actually fetched, so we use AVG=2.
 *       If session.min_reviews is set, we also fetched details for ALL placeIds:
 *         that costs an extra up to 60 Place Details calls on top of page-1 calls.
 *     - Place Details (first page, always free to user): always 1 batch of up to 20 details calls.
 *   Per paid page view recorded in viewed_pages[]:
 *     - Place Details: 1 batch of up to 20 details calls (we use PAGE_SIZE=20 as upper bound).
 *
 * These are UPPER-BOUND ESTIMATES. Actual call counts may be lower (fewer results, early break).
 */
router.get('/costs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // ── Places API pricing constants ────────────────────────────────────────
        const PRICE_TEXT_SEARCH = 0.004;  // USD per call
        const PRICE_PLACE_DETAILS = 0.005; // USD per call
        const PAGE_SIZE = 20;              // results per page (matches search.js)
        const AVG_TEXT_SEARCH_CALLS_PER_SESSION = 2; // estimated avg (up to 3 possible)
        const DETAILS_PER_PAGE = PAGE_SIZE; // max details per page view

        // ── Load system_settings for credits_per_page ──────────────────────────
        const { data: settings } = await supabaseAdmin
            .from('system_settings')
            .select('credits_per_page, credits_per_enrichment, credits_per_lead')
            .eq('id', 1)
            .single();
        const creditsPerPage = settings?.credits_per_page ?? 10;
        const creditsPerEnrichment = settings?.credits_per_enrichment ?? 1;

        // ── Search sessions summary ─────────────────────────────────────────────
        const { count: totalSearchSessions } = await supabaseAdmin
            .from('search_sessions')
            .select('id', { count: 'exact', head: true });

        const { data: sessions30d } = await supabaseAdmin
            .from('search_sessions')
            .select('viewed_pages, min_reviews, min_rating, total_results')
            .gte('created_at', thirtyDaysAgo);

        const sessionCount30d = (sessions30d || []).length;

        // Aggregate page-view counts and filter flags
        let totalPageViews30d = 0;
        let sessionsWithMinReviews = 0;
        let paidPageViews30d = 0;

        (sessions30d || []).forEach(s => {
            const pages = Array.isArray(s.viewed_pages) ? s.viewed_pages : [];
            totalPageViews30d += pages.length;
            // page 1 is always free — paid pages are those > 1
            paidPageViews30d += pages.filter(p => p > 1).length;
            if (s.min_reviews && s.min_reviews > 0) sessionsWithMinReviews++;
        });

        // ── Places API call estimates ───────────────────────────────────────────
        // Text Search calls:
        //   Each session → up to 3 TextSearch calls, avg 2
        const estimatedTextSearchCalls = sessionCount30d * AVG_TEXT_SEARCH_CALLS_PER_SESSION;

        // Place Details calls:
        //   - First page (every session): up to PAGE_SIZE details
        //   - Paid pages (viewed_pages > 1): up to PAGE_SIZE details each
        //   - minReviews filter: fetches ALL place_ids for filtering (up to 60 extra Details on top of page-1)
        const detailsFromFirstPages = sessionCount30d * DETAILS_PER_PAGE;
        const detailsFromPaidPages = paidPageViews30d * DETAILS_PER_PAGE;
        const detailsFromMinReviewsFilter = sessionsWithMinReviews * 60; // fetches all 60 to filter
        const estimatedPlaceDetailsCalls = detailsFromFirstPages + detailsFromPaidPages + detailsFromMinReviewsFilter;

        // ── Cost estimates (USD) ───────────────────────────────────────────────
        const estimatedTextSearchCostUsd = estimatedTextSearchCalls * PRICE_TEXT_SEARCH;
        const estimatedDetailsCostUsd = estimatedPlaceDetailsCalls * PRICE_PLACE_DETAILS;
        const estimatedTotalCostUsd = estimatedTextSearchCostUsd + estimatedDetailsCostUsd;

        // ── Breakdown: free vs paid surface ────────────────────────────────────
        // "Free to user" = what we pay but user doesn't pay credits for:
        //   - ALL Text Search calls (user pays 0 credits for these)
        //   - First-page Details (page 1, always free)
        //   - minReviews extra Details (user pays 0 credits for filter overhead)
        const freeSurfaceCostUsd = estimatedTextSearchCostUsd
            + (detailsFromFirstPages * PRICE_PLACE_DETAILS)
            + (detailsFromMinReviewsFilter * PRICE_PLACE_DETAILS);

        // What the user pays credits for: paid page views
        const paidSurfaceCostUsd = detailsFromPaidPages * PRICE_PLACE_DETAILS;

        // ── Credits & revenue ──────────────────────────────────────────────────
        const { data: ledgerEntries } = await supabaseAdmin
            .from('credit_ledger')
            .select('amount')
            .gte('created_at', thirtyDaysAgo);

        const creditsIssued30d = (ledgerEntries || [])
            .filter(e => e.amount > 0)
            .reduce((sum, e) => sum + e.amount, 0);

        const creditsConsumed30d = (ledgerEntries || [])
            .filter(e => e.amount < 0)
            .reduce((sum, e) => sum + Math.abs(e.amount), 0);

        const { data: completedOrders } = await supabaseAdmin
            .from('orders')
            .select('amount, credits')
            .eq('status', 'completed')
            .gte('created_at', thirtyDaysAgo);

        const revenueTry30d = (completedOrders || []).reduce((sum, o) => sum + (o.amount || 0), 0);
        const creditsSold30d = (completedOrders || []).reduce((sum, o) => sum + (o.credits || 0), 0);

        const { count: pendingOrders } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

        // ── Exports summary ────────────────────────────────────────────────────
        const { count: totalExports } = await supabaseAdmin
            .from('exports')
            .select('id', { count: 'exact', head: true });

        const { count: exports30d } = await supabaseAdmin
            .from('exports')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo);

        const { data: exportSums } = await supabaseAdmin
            .from('exports')
            .select('lead_count')
            .gte('created_at', thirtyDaysAgo);
        const leadsExported30d = (exportSums || []).reduce((sum, e) => sum + (e.lead_count || 0), 0);

        // ── Daily breakdown ────────────────────────────────────────────────────
        const { data: dailySearchRaw } = await supabaseAdmin
            .from('search_sessions')
            .select('created_at, viewed_pages, min_reviews')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: true });

        const { data: dailyExportRaw } = await supabaseAdmin
            .from('exports')
            .select('created_at, lead_count')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: true });

        const dailyMap = {};
        (dailySearchRaw || []).forEach(r => {
            const day = r.created_at.slice(0, 10);
            if (!dailyMap[day]) dailyMap[day] = {
                date: day, searches: 0, exports: 0, leads_exported: 0,
                est_text_search_calls: 0, est_details_calls: 0
            };
            const pages = Array.isArray(r.viewed_pages) ? r.viewed_pages : [];
            const paidPages = pages.filter(p => p > 1).length;
            const hasMinReviews = r.min_reviews && r.min_reviews > 0;
            dailyMap[day].searches++;
            dailyMap[day].est_text_search_calls += AVG_TEXT_SEARCH_CALLS_PER_SESSION;
            dailyMap[day].est_details_calls += DETAILS_PER_PAGE // first page
                + (paidPages * DETAILS_PER_PAGE)               // paid pages
                + (hasMinReviews ? 60 : 0);                    // filter overhead
        });
        (dailyExportRaw || []).forEach(r => {
            const day = r.created_at.slice(0, 10);
            if (!dailyMap[day]) dailyMap[day] = {
                date: day, searches: 0, exports: 0, leads_exported: 0,
                est_text_search_calls: 0, est_details_calls: 0
            };
            dailyMap[day].exports++;
            dailyMap[day].leads_exported += r.lead_count || 0;
        });

        const dailyBreakdown = Object.values(dailyMap).map(d => ({
            ...d,
            est_cost_usd: parseFloat(
                (d.est_text_search_calls * PRICE_TEXT_SEARCH + d.est_details_calls * PRICE_PLACE_DETAILS).toFixed(4)
            ),
        })).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            usage: {
                sessions_30d: sessionCount30d,
                total_sessions: totalSearchSessions || 0,
                total_page_views_30d: totalPageViews30d,
                paid_page_views_30d: paidPageViews30d,
                sessions_with_min_reviews_30d: sessionsWithMinReviews,
                exports_30d: exports30d || 0,
                total_exports: totalExports || 0,
                leads_exported_30d: leadsExported30d,
            },
            places_estimates: {
                // NOTE: these are upper-bound estimates from code logic, not live telemetry
                text_search_calls_30d: estimatedTextSearchCalls,
                place_details_calls_30d: estimatedPlaceDetailsCalls,
                details_from_first_pages: detailsFromFirstPages,
                details_from_paid_pages: detailsFromPaidPages,
                details_from_min_reviews_filter: detailsFromMinReviewsFilter,
                cost_text_search_usd: parseFloat(estimatedTextSearchCostUsd.toFixed(4)),
                cost_details_usd: parseFloat(estimatedDetailsCostUsd.toFixed(4)),
                cost_total_usd: parseFloat(estimatedTotalCostUsd.toFixed(4)),
                cost_free_surface_usd: parseFloat(freeSurfaceCostUsd.toFixed(4)),
                cost_paid_surface_usd: parseFloat(paidSurfaceCostUsd.toFixed(4)),
                price_text_search_usd: PRICE_TEXT_SEARCH,
                price_details_usd: PRICE_PLACE_DETAILS,
            },
            credits: {
                per_page: creditsPerPage,
                per_enrichment: creditsPerEnrichment,
                issued_30d: creditsIssued30d,
                consumed_30d: creditsConsumed30d,
                sold_30d: creditsSold30d,
                revenue_try_30d: revenueTry30d,
                pending_orders: pendingOrders || 0,
            },
            daily_breakdown: dailyBreakdown,
        });
    } catch (err) {
        console.error('[Admin] Costs error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/payments
 * Paginated order records across all users (admin only)
 * Query params: limit, offset, status, query (user name/email)
 */
router.get('/payments', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, query = '', status = '' } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 50, 200);
        const parsedOffset = parseInt(offset) || 0;

        // Resolve matching user_ids from profiles if query given
        let filteredUserIds = null;
        if (query) {
            const { data: matchedProfiles } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(100);
            filteredUserIds = (matchedProfiles || []).map(p => p.id);
        }

        let ordersQuery = supabaseAdmin
            .from('orders')
            .select(
                'id, user_id, package_id, payment_method, amount, currency, credits, status, provider_reference, checkout_url, failure_reason, failure_code, last_payment_event_at, created_at, credit_packages(display_name_tr)',
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(parsedOffset, parsedOffset + parsedLimit - 1);

        if (status) {
            ordersQuery = ordersQuery.eq('status', status);
        }

        if (filteredUserIds !== null) {
            if (filteredUserIds.length > 0) {
                ordersQuery = ordersQuery.in('user_id', filteredUserIds);
            } else {
                // No user match — return empty result set
                return res.json({ orders: [], total: 0 });
            }
        }

        const { data: orders, count, error } = await ordersQuery;

        if (error) {
            console.error('[Admin] Payments error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        // Enrich with user info
        const userIds = [...new Set((orders || []).map(o => o.user_id))];
        const profileMap = {};

        if (userIds.length > 0) {
            const { data: profilesWithEmail, error: emailErr } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

            if (!emailErr && profilesWithEmail) {
                profilesWithEmail.forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: p.email }; });
            } else {
                const { data: profilesNoEmail } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                (profilesNoEmail || []).forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: null }; });
            }

            const missingEmailIds = userIds.filter(id => !profileMap[id]?.email);
            if (missingEmailIds.length > 0) {
                await Promise.allSettled(missingEmailIds.map(async (id) => {
                    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
                    if (authUser?.user?.email) {
                        if (profileMap[id]) profileMap[id].email = authUser.user.email;
                        else profileMap[id] = { full_name: null, email: authUser.user.email };
                    }
                }));
            }
        }

        const enriched = (orders || []).map(o => ({
            id: o.id,
            user_id: o.user_id,
            user_name: profileMap[o.user_id]?.full_name || null,
            user_email: profileMap[o.user_id]?.email || null,
            package_name: o.credit_packages?.display_name_tr || null,
            payment_method: o.payment_method,
            provider_reference: o.provider_reference || null,
            checkout_url: o.checkout_url || null,
            amount: o.amount,
            currency: o.currency,
            credits: o.credits,
            status: o.status,
            failure_reason: o.failure_reason || null,
            failure_code: o.failure_code || null,
            last_payment_event_at: o.last_payment_event_at || null,
            created_at: o.created_at,
        }));

        res.json({ orders: enriched, total: count || 0 });
    } catch (err) {
        console.error('[Admin] Payments error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/${ADMIN_ROUTE_SECRET}/admin/payments/:orderId/complete
 * Complete a pending manual order and add credits to user (admin only).
 *
 * Idempotency guard: orders.status is flipped pending→completed FIRST with a
 * conditional eq('status','pending') filter.  If the update matches 0 rows the
 * order was already completed (or never existed) and credits are NOT touched.
 */
router.post('/payments/:orderId/complete', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const adminId = req.user.id;

        // Step 1: Atomically flip status pending → completed.
        // The eq('status','pending') ensures this only matches once even under
        // concurrent requests.  We omit updated_at to avoid column-not-found errors.
        const { data: updatedRows, error: flipError } = await supabaseAdmin
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId)
            .eq('status', 'pending')
            .select('id, user_id, credits, amount, currency');

        if (flipError) {
            console.error('[Admin] Order status flip error:', flipError);
            return res.status(500).json({ error: 'Failed to update order status', message: flipError.message });
        }

        if (!updatedRows || updatedRows.length === 0) {
            // Either not found or already completed — safe to reject
            return res.status(400).json({
                error: 'Order cannot be completed',
                message: 'Order not found, not in pending status, or already completed.',
            });
        }

        const order = updatedRows[0];

        // Step 2: Fetch current profile credits
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, credits')
            .eq('id', order.user_id)
            .single();

        if (profileError || !profile) {
            // Order is already marked completed. Log and return partial success.
            console.error('[Admin] Profile not found after order flip:', profileError);
            return res.status(500).json({ error: 'Order marked completed but user profile not found' });
        }

        const newBalance = (profile.credits || 0) + order.credits;

        // Step 3: Update profiles.credits
        const { error: creditsError } = await supabaseAdmin
            .from('profiles')
            .update({ credits: newBalance })
            .eq('id', order.user_id);

        if (creditsError) {
            console.error('[Admin] Failed to update user credits:', creditsError);
            // Order is already completed — do NOT retry. Log prominently.
            return res.status(500).json({
                error: 'Order marked completed but credits update failed',
                message: creditsError.message,
                action: 'Manual credit adjustment required',
            });
        }

        // Step 4: Log in credit_ledger (non-fatal, legacy)
        const { error: ledgerError } = await supabaseAdmin
            .from('credit_ledger')
            .insert({
                user_id: order.user_id,
                amount: order.credits,
                type: 'order_complete',
                description: `Manuel sipariş onaylandı (${orderId}) — admin: ${adminId}`,
                created_at: new Date().toISOString(),
            });

        if (ledgerError) {
            console.error('[Admin] Ledger write error (non-fatal):', ledgerError);
        }

        // Step 5: Write to system_events
        await logEvent(supabaseAdmin, {
            level: 'success',
            source: 'admin',
            event_type: 'order_complete',
            actor_user_id: adminId,
            subject_user_id: order.user_id,
            target_type: 'order',
            target_id: orderId,
            message: `Manuel sipariş onaylandı (${orderId}) — admin: ${adminId}`,
            credit_delta: order.credits,
            metadata: {
                order_id: orderId,
                amount: order.amount,
                currency: order.currency,
                new_balance: newBalance,
            },
        });

        console.log(`[Admin] Order ${orderId} completed by admin ${adminId}: +${order.credits} credits → user ${order.user_id}`);

        res.json({
            success: true,
            order_id: orderId,
            user_id: order.user_id,
            credits_added: order.credits,
            new_balance: newBalance,
        });
    } catch (err) {
        console.error('[Admin] Complete order error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/payments/:orderId/events
 * Return the last 20 payment lifecycle events for a specific order (admin only).
 * Reads from system_events where target_id = orderId.
 */
router.get('/payments/:orderId/events', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;

        const { data: events, error } = await supabaseAdmin
            .from('system_events')
            .select('id, level, source, event_type, message, metadata, created_at')
            .eq('target_type', 'order')
            .eq('target_id', orderId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('[Admin] Order events error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        res.json({ events: events || [] });
    } catch (err) {
        console.error('[Admin] Order events error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/${ADMIN_ROUTE_SECRET}/admin/payments/:orderId/reject
 * Reject a pending order (admin only). Sets status pending → failed.
 *
 * Idempotency guard: the update is filtered by eq('status','pending'),
 * so a second call matches 0 rows and returns 400 without side-effects.
 * No credits are touched (none were ever dispensed for a pending order).
 */
router.post('/payments/:orderId/reject', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const adminId = req.user.id;

        // Atomically flip pending → failed (idempotent guard)
        const { data: updatedRows, error: flipError } = await supabaseAdmin
            .from('orders')
            .update({ status: 'failed' })
            .eq('id', orderId)
            .eq('status', 'pending')
            .select('id, user_id, amount, currency, credits');

        if (flipError) {
            console.error('[Admin] Order reject flip error:', flipError);
            return res.status(500).json({ error: 'Failed to update order status', message: flipError.message });
        }

        if (!updatedRows || updatedRows.length === 0) {
            return res.status(400).json({
                error: 'Order cannot be rejected',
                message: 'Order not found or not in pending status.',
            });
        }

        const order = updatedRows[0];

        // Log to system_events (non-fatal)
        await logEvent(supabaseAdmin, {
            level: 'warn',
            source: 'admin',
            event_type: 'order_rejected',
            actor_user_id: adminId,
            subject_user_id: order.user_id,
            target_type: 'order',
            target_id: orderId,
            message: `Sipariş reddedildi (${orderId}) — admin: ${adminId}`,
            credit_delta: 0,
            metadata: {
                order_id: orderId,
                amount: order.amount,
                currency: order.currency,
            },
        }).catch(err => console.error('[Admin] Reject logEvent error (non-fatal):', err));

        console.log(`[Admin] Order ${orderId} rejected by admin ${adminId}`);

        res.json({
            success: true,
            order_id: orderId,
            user_id: order.user_id,
        });
    } catch (err) {
        console.error('[Admin] Reject order error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/exports
 * Paginated export records across all users (admin only)
 * Query params: limit, offset, query (user name/email search)
 */
router.get('/exports', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, query = '' } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 50, 200);
        const parsedOffset = parseInt(offset) || 0;

        // Optional: resolve matching user_ids when query is a user name/email
        let filteredUserIds = null;
        if (query) {
            const { data: matchedProfiles } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(100);
            filteredUserIds = (matchedProfiles || []).map(p => p.id);
        }

        let exportsQuery = supabaseAdmin
            .from('exports')
            .select(
                'id, user_id, list_id, format, file_name, lead_count, note, created_at, lead_lists(name)',
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(parsedOffset, parsedOffset + parsedLimit - 1);

        if (filteredUserIds !== null) {
            if (filteredUserIds.length === 0) {
                // No user match — filter on file_name/format instead
                exportsQuery = exportsQuery.or(
                    `format.ilike.%${query}%,file_name.ilike.%${query}%`
                );
            } else {
                exportsQuery = exportsQuery.in('user_id', filteredUserIds);
            }
        }

        const { data: exports_, count, error } = await exportsQuery;

        if (error) {
            console.error('[Admin] Exports error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        // Enrich with user info
        const userIds = [...new Set((exports_ || []).map(e => e.user_id))];
        const profileMap = {};

        if (userIds.length > 0) {
            const { data: profilesWithEmail, error: emailErr } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

            if (!emailErr && profilesWithEmail) {
                profilesWithEmail.forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: p.email }; });
            } else {
                const { data: profilesNoEmail } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                (profilesNoEmail || []).forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: null }; });
            }

            const missingEmailIds = userIds.filter(id => !profileMap[id]?.email);
            if (missingEmailIds.length > 0) {
                await Promise.allSettled(missingEmailIds.map(async (id) => {
                    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
                    if (authUser?.user?.email) {
                        if (profileMap[id]) profileMap[id].email = authUser.user.email;
                        else profileMap[id] = { full_name: null, email: authUser.user.email };
                    }
                }));
            }
        }

        const enriched = (exports_ || []).map(e => ({
            id: e.id,
            user_id: e.user_id,
            user_name: profileMap[e.user_id]?.full_name || null,
            user_email: profileMap[e.user_id]?.email || null,
            list_name: e.lead_lists?.name || null,
            format: e.format,
            file_name: e.file_name,
            lead_count: e.lead_count,
            note: e.note,
            created_at: e.created_at,
        }));

        res.json({ exports: enriched, total: count || 0 });
    } catch (err) {
        console.error('[Admin] Exports error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/search-logs
 * Paginated search session logs across all users (admin only)
 * Query params: limit, offset, query (user email/name search)
 */
router.get('/search-logs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, query = '' } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 50, 200);
        const parsedOffset = parseInt(offset) || 0;

        // If searching by user, first resolve matching user_ids from profiles
        let filteredUserIds = null;
        if (query) {
            const { data: matchedProfiles } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(100);
            filteredUserIds = (matchedProfiles || []).map(p => p.id);
            // If no profiles match, also check by province/district/category keyword
        }

        let sessionsQuery = supabaseAdmin
            .from('search_sessions')
            .select(
                'id, user_id, province, district, category, keyword, min_rating, min_reviews, total_results, viewed_pages, created_at',
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(parsedOffset, parsedOffset + parsedLimit - 1);

        if (filteredUserIds !== null) {
            if (filteredUserIds.length === 0) {
                // No users matched — also try matching on text fields
                sessionsQuery = sessionsQuery.or(
                    `province.ilike.%${query}%,district.ilike.%${query}%,category.ilike.%${query}%,keyword.ilike.%${query}%`
                );
            } else {
                sessionsQuery = sessionsQuery.in('user_id', filteredUserIds);
            }
        }

        const { data: sessions, count, error } = await sessionsQuery;

        if (error) {
            console.error('[Admin] Search logs error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        // Enrich with user info
        const userIds = [...new Set((sessions || []).map(s => s.user_id))];
        const profileMap = {};

        if (userIds.length > 0) {
            // Try with email first; fall back to full_name only
            const { data: profilesWithEmail, error: emailErr } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

            if (!emailErr && profilesWithEmail) {
                profilesWithEmail.forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: p.email }; });
            } else {
                const { data: profilesNoEmail } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                (profilesNoEmail || []).forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: null }; });
            }

            // Auth email fallback for users still missing email
            const missingEmailIds = userIds.filter(id => !profileMap[id]?.email);
            if (missingEmailIds.length > 0) {
                await Promise.allSettled(missingEmailIds.map(async (id) => {
                    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
                    if (authUser?.user?.email) {
                        if (profileMap[id]) profileMap[id].email = authUser.user.email;
                        else profileMap[id] = { full_name: null, email: authUser.user.email };
                    }
                }));
            }
        }

        const enriched = (sessions || []).map(s => ({
            ...s,
            user_name: profileMap[s.user_id]?.full_name || null,
            user_email: profileMap[s.user_id]?.email || null,
            pages_viewed: Array.isArray(s.viewed_pages) ? s.viewed_pages.length : 0,
        }));

        res.json({ logs: enriched, total: count || 0 });
    } catch (err) {
        console.error('[Admin] Search logs error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/credits/ledger
 * Paginated credit transaction ledger across all users (admin only)
 */
router.get('/credits/ledger', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, user_id } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 50, 200);
        const parsedOffset = parseInt(offset) || 0;

        let query = supabaseAdmin
            .from('credit_ledger')
            .select('id, user_id, amount, type, description, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(parsedOffset, parsedOffset + parsedLimit - 1);

        if (user_id) {
            query = query.eq('user_id', user_id);
        }

        const { data: transactions, count, error } = await query;

        if (error) {
            console.error('[Admin] Credits ledger error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        const userIds = [...new Set((transactions || []).map(t => t.user_id))];
        const profileMap = {};

        if (userIds.length > 0) {
            // Stage 1a: try profiles with email column
            const { data: profilesWithEmail, error: emailColError } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

            if (!emailColError && profilesWithEmail) {
                profilesWithEmail.forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: p.email }; });
            } else {
                // Stage 1b: email column missing — select without it
                const { data: profilesNoEmail } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                (profilesNoEmail || []).forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: null }; });
            }

            // Stage 2: for users still missing email, fetch from auth admin
            const missingEmailIds = userIds.filter(id => profileMap[id] && !profileMap[id].email);
            if (missingEmailIds.length > 0) {
                await Promise.allSettled(
                    missingEmailIds.map(async (id) => {
                        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
                        if (authUser?.user?.email) {
                            if (profileMap[id]) {
                                profileMap[id].email = authUser.user.email;
                            } else {
                                profileMap[id] = { full_name: null, email: authUser.user.email };
                            }
                        }
                    })
                );
            }
        }

        const enriched = (transactions || []).map(t => ({
            ...t,
            user_name: profileMap[t.user_id]?.full_name || null,
            user_email: profileMap[t.user_id]?.email || null,
        }));

        res.json({ transactions: enriched, total: count || 0 });
    } catch (err) {
        console.error('[Admin] Credits ledger error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * POST /api/${ADMIN_ROUTE_SECRET}/admin/credits/adjust
 * Manually add or deduct credits for a user (admin only)
 * Body: { user_id, amount, description }
 * amount > 0 = add, amount < 0 = deduct
 */
router.post('/credits/adjust', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { user_id, amount, description } = req.body;
        const adminId = req.user.id;

        if (!user_id || amount === undefined || amount === null) {
            return res.status(400).json({ error: 'user_id and amount are required' });
        }

        const parsedAmount = parseInt(amount);
        if (isNaN(parsedAmount) || parsedAmount === 0) {
            return res.status(400).json({ error: 'amount must be a non-zero integer' });
        }

        // Check user exists — do NOT select 'email'; that column may not exist in profiles
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, credits')
            .eq('id', user_id)
            .single();

        if (profileError) {
            console.error('[Admin] Credits adjust profile fetch error:', profileError);
            return res.status(500).json({ error: 'Database error', message: profileError.message });
        }
        if (!profile) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newBalance = (profile.credits || 0) + parsedAmount;
        if (newBalance < 0) {
            return res.status(400).json({
                error: 'Insufficient credits',
                current: profile.credits,
                attempted_deduction: Math.abs(parsedAmount)
            });
        }

        // Update credits directly
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ credits: newBalance, updated_at: new Date().toISOString() })
            .eq('id', user_id);

        if (updateError) {
            console.error('[Admin] Credits adjust update error:', updateError);
            return res.status(500).json({ error: 'Failed to update credits', message: updateError.message });
        }

        // Write to credit_ledger (legacy, keep for backward compat)
        const ledgerDesc = description || (parsedAmount > 0 ? 'Admin credit grant' : 'Admin credit deduction');
        const { error: ledgerError } = await supabaseAdmin
            .from('credit_ledger')
            .insert({
                user_id,
                amount: parsedAmount,
                type: parsedAmount > 0 ? 'admin_grant' : 'admin_deduction',
                description: ledgerDesc,
                created_at: new Date().toISOString(),
            });

        if (ledgerError) {
            // Non-fatal: credits are already updated
            console.error('[Admin] Ledger write error (non-fatal):', ledgerError);
        }

        // Write to system_events
        const eventType = parsedAmount > 0 ? 'admin_grant' : 'admin_deduction';
        await logEvent(supabaseAdmin, {
            level: 'warn',
            source: 'admin',
            event_type: eventType,
            actor_user_id: adminId,
            subject_user_id: user_id,
            target_type: 'user',
            target_id: user_id,
            message: ledgerDesc,
            credit_delta: parsedAmount,
            metadata: {
                previous_balance: profile.credits || 0,
                new_balance: newBalance,
            },
        });

        console.log(`[Admin] Credits adjusted for ${user_id}: ${parsedAmount > 0 ? '+' : ''}${parsedAmount} by admin ${adminId}`);

        res.json({
            success: true,
            user_id,
            previous_balance: profile.credits || 0,
            adjustment: parsedAmount,
            new_balance: newBalance,
        });
    } catch (err) {
        console.error('[Admin] Credits adjust error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/system-settings
 * Get credit rules and plan defaults (admin only)
 */
router.get('/system-settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('system_settings')
            .select('credits_per_page, credits_per_enrichment, credits_per_lead, new_user_credits')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('[Admin] Failed to fetch system settings:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        res.json({ settings: data });
    } catch (err) {
        console.error('[Admin] Get system settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/${ADMIN_ROUTE_SECRET}/admin/system-settings
 * Update credit rules and plan defaults (admin only)
 */
router.patch('/system-settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { credits_per_page, credits_per_enrichment, credits_per_lead, new_user_credits } = req.body;

        const updates = { updated_at: new Date().toISOString() };

        if (credits_per_page !== undefined) {
            const val = parseInt(credits_per_page);
            if (isNaN(val) || val < 0) return res.status(400).json({ error: 'credits_per_page must be a non-negative integer' });
            updates.credits_per_page = val;
        }
        if (credits_per_enrichment !== undefined) {
            const val = parseInt(credits_per_enrichment);
            if (isNaN(val) || val < 0) return res.status(400).json({ error: 'credits_per_enrichment must be a non-negative integer' });
            updates.credits_per_enrichment = val;
        }
        if (credits_per_lead !== undefined) {
            const val = parseInt(credits_per_lead);
            if (isNaN(val) || val < 0) return res.status(400).json({ error: 'credits_per_lead must be a non-negative integer' });
            updates.credits_per_lead = val;
        }
        if (new_user_credits !== undefined) {
            const val = parseInt(new_user_credits);
            if (isNaN(val) || val < 0) return res.status(400).json({ error: 'new_user_credits must be a non-negative integer' });
            updates.new_user_credits = val;
        }

        const adminIdForSettings = req.user?.id || null;

        const { data, error } = await supabaseAdmin
            .from('system_settings')
            .update(updates)
            .eq('id', 1)
            .select('credits_per_page, credits_per_enrichment, credits_per_lead, new_user_credits')
            .single();

        if (error) {
            console.error('[Admin] Failed to update system settings:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        await logEvent(supabaseAdmin, {
            level: 'warn',
            source: 'admin',
            event_type: 'system_settings_updated',
            actor_user_id: adminIdForSettings,
            message: 'Sistem ayarları güncellendi',
            target_type: 'system',
            target_id: 'system_settings',
            metadata: { updated_fields: Object.keys(req.body) },
        });

        res.json({ success: true, settings: data });
    } catch (err) {
        console.error('[Admin] Update system settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/system-logs
 * System event log from system_events table (admin only).
 *
 * Query params:
 *   limit      (default 50, max 200)
 *   offset     (default 0)
 *   event_type (optional — filter by system_events.event_type exact match)
 */
router.get('/system-logs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, event_type = '' } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 50, 200);
        const parsedOffset = parseInt(offset) || 0;

        // ── Fetch system_events ─────────────────────────────────────────────────
        let logsQuery = supabaseAdmin
            .from('system_events')
            .select(
                'id, level, source, event_type, actor_user_id, subject_user_id, target_type, target_id, message, credit_delta, metadata, created_at',
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(parsedOffset, parsedOffset + parsedLimit - 1);

        if (event_type) {
            logsQuery = logsQuery.eq('event_type', event_type);
        }

        const { data: logs, count, error: logsError } = await logsQuery;

        if (logsError) {
            console.error('[Admin] System logs fetch error:', logsError);
            return res.status(500).json({ error: 'Database error', message: logsError.message });
        }

        // ── Collect user IDs to enrich ──────────────────────────────────────────
        const actorIds = (logs || []).map(l => l.actor_user_id).filter(Boolean);
        const subjectIds = (logs || []).map(l => l.subject_user_id).filter(Boolean);
        const userIds = [...new Set([...actorIds, ...subjectIds])];
        const profileMap = {};

        if (userIds.length > 0) {
            const { data: profilesWithEmail, error: emailErr } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

            if (!emailErr && profilesWithEmail) {
                profilesWithEmail.forEach(p => {
                    profileMap[p.id] = { full_name: p.full_name, email: p.email };
                });
            } else {
                const { data: profilesNoEmail } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                (profilesNoEmail || []).forEach(p => {
                    profileMap[p.id] = { full_name: p.full_name, email: null };
                });
            }

            // Fill missing emails from auth admin
            const missingEmailIds = userIds.filter(id => profileMap[id] && !profileMap[id].email);
            if (missingEmailIds.length > 0) {
                await Promise.allSettled(missingEmailIds.map(async (id) => {
                    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
                    if (authUser?.user?.email) {
                        if (profileMap[id]) profileMap[id].email = authUser.user.email;
                        else profileMap[id] = { full_name: null, email: authUser.user.email };
                    }
                }));
            }
        }

        const events = (logs || []).map(l => ({
            id: l.id,
            level: l.level,
            source: l.source,
            event_type: l.event_type,
            actor_user_id: l.actor_user_id || null,
            actor_name: l.actor_user_id ? (profileMap[l.actor_user_id]?.full_name || null) : null,
            actor_email: l.actor_user_id ? (profileMap[l.actor_user_id]?.email || null) : null,
            subject_user_id: l.subject_user_id || null,
            subject_name: l.subject_user_id ? (profileMap[l.subject_user_id]?.full_name || null) : null,
            subject_email: l.subject_user_id ? (profileMap[l.subject_user_id]?.email || null) : null,
            target_type: l.target_type,
            target_id: l.target_id,
            message: l.message,
            credit_delta: l.credit_delta,
            metadata: l.metadata,
            created_at: l.created_at,
        }));

        res.json({ events, total: count || 0 });
    } catch (err) {
        console.error('[Admin] System logs error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/payment-providers
 * List all payment providers with full config (admin only).
 * Secret fields (secret_key, webhook_secret) are masked for display.
 */
router.get('/payment-providers', requireAuth, requireAdmin, async (req, res) => {
    try {
        const providers = await listProviders(supabaseAdmin);
        // Mask secrets for admin display — raw values stay in DB only
        const masked = providers.map(p => ({
            ...p,
            secret_key: maskSecret(p.secret_key),
            webhook_secret: maskSecret(p.webhook_secret),
        }));
        res.json({ providers: masked });
    } catch (err) {
        console.error('[Admin] payment-providers GET error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

/**
 * PUT /api/${ADMIN_ROUTE_SECRET}/admin/payment-providers/:code
 * Create or update a payment provider configuration (admin only).
 *
 * Secret fields (secret_key, webhook_secret) are written to DB only when
 * the request body contains a non-masked, non-empty value.
 * Sending '••••••••' (the mask placeholder) is treated as "no change".
 */
router.put('/payment-providers/:code', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { code } = req.params;

        const VALID_CODES = ['paytr', 'iyzico', 'shopier', 'stripe', 'bank_transfer'];
        if (!VALID_CODES.includes(code)) {
            return res.status(400).json({ error: 'Invalid provider_code' });
        }

        // Strip masked placeholder — those fields should not overwrite stored secrets
        const MASK_PLACEHOLDER = '••••••••';
        const body = { ...req.body };
        if (body.secret_key === MASK_PLACEHOLDER) delete body.secret_key;
        if (body.webhook_secret === MASK_PLACEHOLDER) delete body.webhook_secret;

        // Region is immutable via this endpoint — enforced by product rule
        const REGION_MAP = { paytr: 'tr', iyzico: 'tr', shopier: 'tr', stripe: 'global', bank_transfer: 'tr' };
        body.region = REGION_MAP[code];

        const provider = await upsertProvider(supabaseAdmin, code, body);

        // Return with masked secrets
        res.json({
            success: true,
            provider: {
                ...provider,
                secret_key: maskSecret(provider.secret_key),
                webhook_secret: maskSecret(provider.webhook_secret),
            },
        });
    } catch (err) {
        console.error('[Admin] payment-providers PUT error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

/**
 * GET /api/${ADMIN_ROUTE_SECRET}/admin/packages
 * List all credit packages including inactive (admin only).
 */
router.get('/packages', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Try full select including optional columns (description, features).
        // If those columns don't exist yet (pending DB migration), fall back
        // to the core columns so the endpoint never 500s before migration.
        let { data, error } = await supabaseAdmin
            .from('credit_packages')
            .select('id, name, display_name_tr, display_name_en, credits, price_try, price_usd, is_active, sort_order, description, features, created_at')
            .order('sort_order', { ascending: true });

        if (error && (error.message.includes('description') || error.message.includes('features'))) {
            // Columns not yet migrated — fall back to core columns
            const fallback = await supabaseAdmin
                .from('credit_packages')
                .select('id, name, display_name_tr, display_name_en, credits, price_try, price_usd, is_active, sort_order, created_at')
                .order('sort_order', { ascending: true });
            if (fallback.error) {
                console.error('[Admin] Packages GET error:', fallback.error);
                return res.status(500).json({ error: 'Database error', message: fallback.error.message });
            }
            // Normalise: add null placeholders for missing columns
            data = (fallback.data || []).map(p => ({ ...p, description: null, features: null }));
            error = null;
        }

        if (error) {
            console.error('[Admin] Packages GET error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }
        res.json({ packages: data || [] });
    } catch (err) {
        console.error('[Admin] Packages GET error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/${ADMIN_ROUTE_SECRET}/admin/packages
 * Create a new credit package (admin only).
 */
router.post('/packages', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, display_name_tr, display_name_en, credits, price_try, price_usd, is_active, sort_order, description, features } = req.body;

        if (!name || !display_name_tr || !display_name_en || credits === undefined || price_try === undefined || price_usd === undefined) {
            return res.status(400).json({ error: 'name, display_name_tr, display_name_en, credits, price_try, price_usd are required' });
        }

        const parsedCredits = parseInt(credits);
        const parsedPriceTry = parseFloat(price_try);
        const parsedPriceUsd = parseFloat(price_usd);

        if (isNaN(parsedCredits) || parsedCredits < 0) return res.status(400).json({ error: 'credits must be a non-negative integer' });
        if (isNaN(parsedPriceTry) || parsedPriceTry < 0) return res.status(400).json({ error: 'price_try must be a non-negative number' });
        if (isNaN(parsedPriceUsd) || parsedPriceUsd < 0) return res.status(400).json({ error: 'price_usd must be a non-negative number' });

        const row = {
            name: name.trim(),
            display_name_tr: display_name_tr.trim(),
            display_name_en: display_name_en.trim(),
            credits: parsedCredits,
            price_try: parsedPriceTry,
            price_usd: parsedPriceUsd,
            is_active: is_active !== undefined ? Boolean(is_active) : true,
            sort_order: parseInt(sort_order) || 0,
        };
        if (description !== undefined) row.description = description || null;
        if (features !== undefined) row.features = Array.isArray(features) ? features : null;

        const { data, error } = await supabaseAdmin
            .from('credit_packages')
            .insert(row)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'A package with that name already exists' });
            console.error('[Admin] Packages POST error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }
        res.status(201).json({ success: true, package: data });
    } catch (err) {
        console.error('[Admin] Packages POST error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/${ADMIN_ROUTE_SECRET}/admin/packages/:id
 * Update a credit package (admin only).
 */
router.patch('/packages/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, display_name_tr, display_name_en, credits, price_try, price_usd, is_active, sort_order, description, features } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (display_name_tr !== undefined) updates.display_name_tr = display_name_tr.trim();
        if (display_name_en !== undefined) updates.display_name_en = display_name_en.trim();
        if (credits !== undefined) {
            const v = parseInt(credits);
            if (isNaN(v) || v < 0) return res.status(400).json({ error: 'credits must be a non-negative integer' });
            updates.credits = v;
        }
        if (price_try !== undefined) {
            const v = parseFloat(price_try);
            if (isNaN(v) || v < 0) return res.status(400).json({ error: 'price_try must be non-negative' });
            updates.price_try = v;
        }
        if (price_usd !== undefined) {
            const v = parseFloat(price_usd);
            if (isNaN(v) || v < 0) return res.status(400).json({ error: 'price_usd must be non-negative' });
            updates.price_usd = v;
        }
        if (is_active !== undefined) updates.is_active = Boolean(is_active);
        if (sort_order !== undefined) updates.sort_order = parseInt(sort_order) || 0;
        if (description !== undefined) updates.description = description || null;
        if (features !== undefined) updates.features = Array.isArray(features) ? features : null;

        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

        const { data, error } = await supabaseAdmin
            .from('credit_packages')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: 'Package not found' });
            if (error.code === '23505') return res.status(409).json({ error: 'A package with that name already exists' });
            console.error('[Admin] Packages PATCH error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }
        res.json({ success: true, package: data });
    } catch (err) {
        console.error('[Admin] Packages PATCH error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/${ADMIN_ROUTE_SECRET}/admin/packages/:id
 * Delete a credit package — blocked if any orders reference it (admin only).
 * Prefer PATCH is_active=false when orders exist.
 */
router.delete('/packages/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { count: orderCount } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('package_id', id);

        if (orderCount > 0) {
            return res.status(409).json({
                error: 'Cannot delete — this package has existing orders. Set is_active=false instead.',
                order_count: orderCount,
            });
        }

        const { error } = await supabaseAdmin
            .from('credit_packages')
            .delete()
            .eq('id', id);

        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: 'Package not found' });
            console.error('[Admin] Packages DELETE error:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[Admin] Packages DELETE error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

