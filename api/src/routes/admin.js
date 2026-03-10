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
