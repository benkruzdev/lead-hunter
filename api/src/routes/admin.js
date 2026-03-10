import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

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
 * Operational cost/usage summary derived from existing tables (admin only)
 * Returns: api_calls summary, credit/revenue summary, last-30-day daily breakdown
 */
router.get('/costs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const today = new Date().toISOString().slice(0, 10);

        // ── API Calls summary ──────────────────────────────────────────────────
        // Total search sessions (each session = 1 Google Places text search call)
        const { count: totalSearchSessions } = await supabaseAdmin
            .from('search_sessions')
            .select('id', { count: 'exact', head: true });

        // Search sessions this month
        const { count: searchSessionsThisMonth } = await supabaseAdmin
            .from('search_sessions')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo);

        // Total page views across all sessions (sum of viewed_pages array lengths)
        const { data: allSessions } = await supabaseAdmin
            .from('search_sessions')
            .select('viewed_pages')
            .gte('created_at', thirtyDaysAgo);

        const totalPageViews = (allSessions || []).reduce(
            (sum, s) => sum + (Array.isArray(s.viewed_pages) ? s.viewed_pages.length : 0), 0
        );

        // Total exports
        const { count: totalExports } = await supabaseAdmin
            .from('exports')
            .select('id', { count: 'exact', head: true });

        const { count: exportsThisMonth } = await supabaseAdmin
            .from('exports')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo);

        // Total leads exported
        const { data: exportSums } = await supabaseAdmin
            .from('exports')
            .select('lead_count')
            .gte('created_at', thirtyDaysAgo);
        const totalLeadsExported = (exportSums || []).reduce((sum, e) => sum + (e.lead_count || 0), 0);

        // ── Credit / Revenue summary ───────────────────────────────────────────
        // Credits issued (positive entries in credit_ledger)
        const { data: ledgerEntries } = await supabaseAdmin
            .from('credit_ledger')
            .select('amount')
            .gte('created_at', thirtyDaysAgo);

        const creditsIssued = (ledgerEntries || [])
            .filter(e => e.amount > 0)
            .reduce((sum, e) => sum + e.amount, 0);

        const creditsConsumed = (ledgerEntries || [])
            .filter(e => e.amount < 0)
            .reduce((sum, e) => sum + Math.abs(e.amount), 0);

        // Completed orders revenue this month
        const { data: completedOrders } = await supabaseAdmin
            .from('orders')
            .select('amount, credits')
            .eq('status', 'completed')
            .gte('created_at', thirtyDaysAgo);

        const revenueThisMonth = (completedOrders || []).reduce((sum, o) => sum + (o.amount || 0), 0);
        const creditsSoldThisMonth = (completedOrders || []).reduce((sum, o) => sum + (o.credits || 0), 0);

        // Pending orders
        const { count: pendingOrders } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

        // ── Daily breakdown (last 30 days) ────────────────────────────────────
        // search_sessions per day
        const { data: dailySearchRaw } = await supabaseAdmin
            .from('search_sessions')
            .select('created_at')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: true });

        // exports per day
        const { data: dailyExportRaw } = await supabaseAdmin
            .from('exports')
            .select('created_at, lead_count')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: true });

        // Build daily map
        const dailyMap = {};
        (dailySearchRaw || []).forEach(r => {
            const day = r.created_at.slice(0, 10);
            if (!dailyMap[day]) dailyMap[day] = { date: day, searches: 0, exports: 0, leads_exported: 0 };
            dailyMap[day].searches++;
        });
        (dailyExportRaw || []).forEach(r => {
            const day = r.created_at.slice(0, 10);
            if (!dailyMap[day]) dailyMap[day] = { date: day, searches: 0, exports: 0, leads_exported: 0 };
            dailyMap[day].exports++;
            dailyMap[day].leads_exported += r.lead_count || 0;
        });

        const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            api_calls: {
                total_search_sessions: totalSearchSessions || 0,
                search_sessions_30d: searchSessionsThisMonth || 0,
                page_views_30d: totalPageViews,
                total_exports: totalExports || 0,
                exports_30d: exportsThisMonth || 0,
                leads_exported_30d: totalLeadsExported,
            },
            credits: {
                issued_30d: creditsIssued,
                consumed_30d: creditsConsumed,
                sold_30d: creditsSoldThisMonth,
                pending_orders: pendingOrders || 0,
                revenue_try_30d: revenueThisMonth,
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
                'id, user_id, package_id, payment_method, amount, currency, credits, status, created_at, credit_packages(display_name_tr)',
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
            amount: o.amount,
            currency: o.currency,
            credits: o.credits,
            status: o.status,
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

        // Step 4: Log in credit_ledger (non-fatal)
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

        // Write to credit_ledger
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

        res.json({ success: true, settings: data });
    } catch (err) {
        console.error('[Admin] Update system settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
