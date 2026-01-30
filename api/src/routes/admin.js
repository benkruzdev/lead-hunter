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

        // Total users count
        const { count: totalUsers, error: usersError } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (usersError) {
            console.error('Failed to count users:', usersError);
            return res.status(500).json({
                error: 'Database error',
                message: usersError.message
            });
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
            total_users: totalUsers || 0,
            daily_search_count: dailySearchCount || 0,
            daily_credits_spent: dailyCreditsSpent,
            daily_exports_count: dailyExportsCount || 0
        });
    } catch (err) {
        console.error('Get admin dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
