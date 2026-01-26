import express from 'express';

const router = express.Router();

/**
 * GET /api/config/auth
 * Returns third-party integration configuration (reCAPTCHA, OAuth)
 * Configured via Admin Panel (future implementation)
 * 
 * For now, returns disabled config as default
 */
router.get('/auth', async (req, res) => {
    try {
        // Fetch from system_settings table
        const { supabaseAdmin } = await import('../config/supabase.js');
        const { data: settings, error } = await supabaseAdmin
            .from('system_settings')
            .select('recaptcha_enabled, recaptcha_site_key, google_oauth_enabled')
            .eq('id', 1)
            .single();

        if (error || !settings) {
            console.error('Failed to fetch system settings:', error);
            // Fallback to disabled config (safe default)
            return res.json({
                recaptchaEnabled: false,
                recaptchaSiteKey: null,
                googleOAuthEnabled: false,
            });
        }

        res.json({
            recaptchaEnabled: settings.recaptcha_enabled || false,
            recaptchaSiteKey: settings.recaptcha_site_key || null,
            googleOAuthEnabled: settings.google_oauth_enabled || false,
        });
    } catch (error) {
        console.error('Config fetch error:', error);

        // Always return disabled config on error (safe fallback)
        res.json({
            recaptchaEnabled: false,
            recaptchaSiteKey: null,
            googleOAuthEnabled: false,
        });
    }
});

export default router;
