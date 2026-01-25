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
        // TODO: In future, fetch from system_settings table when Admin Panel is implemented
        // const settings = await db.query('SELECT * FROM system_settings WHERE id = 1');

        // For now, return disabled config
        // This will be updated when Admin Panel configuration is implemented
        const config = {
            recaptchaEnabled: false,
            recaptchaSiteKey: null,
            googleOAuthEnabled: false,
        };

        res.json(config);
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
