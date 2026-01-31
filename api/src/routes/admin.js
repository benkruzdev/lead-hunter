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
            google_client_secret
        } = req.body;

        const updates = { updated_at: new Date().toISOString() };

        if (recaptcha_enabled !== undefined) updates.recaptcha_enabled = recaptcha_enabled;
        if (recaptcha_site_key !== undefined) updates.recaptcha_site_key = recaptcha_site_key;
        if (recaptcha_secret_key !== undefined) updates.recaptcha_secret_key = recaptcha_secret_key;
        if (google_oauth_enabled !== undefined) updates.google_oauth_enabled = google_oauth_enabled;
        if (google_client_id !== undefined) updates.google_client_id = google_client_id;
        if (google_client_secret !== undefined) updates.google_client_secret = google_client_secret;

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

export default router;
