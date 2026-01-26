import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/admin/config
 * Get system configuration (admin only)
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
 * PATCH /api/admin/config
 * Update system configuration (admin only)
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

export default router;
