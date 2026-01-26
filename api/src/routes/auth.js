import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get current user's profile
 * GET /api/auth/profile
 */
router.get('/profile', requireAuth, async (req, res) => {
    try {
        // Get profile from database
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (profileError) {
            return res.status(500).json({
                error: 'Database error',
                message: profileError.message
            });
        }

        // Get email from auth.users
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(req.user.id);

        if (userError) {
            console.error('Failed to get user email:', userError);
        }

        res.json({
            profile: {
                ...profile,
                email: userData?.user?.email || null
            }
        });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch profile'
        });
    }
});

router.patch('/profile', requireAuth, async (req, res) => {
    try {
        const { full_name, phone, onboarding_completed } = req.body;

        const updates = {};
        if (full_name !== undefined) updates.full_name = full_name;
        if (phone !== undefined) updates.phone = phone;

        // Handle onboarding completion (can only be set to true, not reverted)
        if (onboarding_completed === true) {
            updates.onboarding_completed = true;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'No updates provided',
                message: 'Provide at least one field to update'
            });
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json({
            success: true,
            profile: data
        });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to update profile'
        });
    }
});

/**
 * Verify JWT token
 * POST /api/auth/verify
 * Body: { token }
 */
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                error: 'Missing token',
                message: 'Token is required'
            });
        }

        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                error: 'Invalid token',
                message: error?.message || 'Token verification failed'
            });
        }

        res.json({
            valid: true,
            user: {
                id: data.user.id,
                email: data.user.email
            }
        });
    } catch (err) {
        console.error('Verify token error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Token verification failed'
        });
    }
});

/**
 * Register new user with reCAPTCHA verification
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, phone, recaptchaToken } = req.body;

        // 1. Validate required fields
        if (!email || !password || !fullName || !phone || !recaptchaToken) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, password, full name, phone, and reCAPTCHA token are required'
            });
        }

        // 2. Normalize email (trim and lowercase)
        const normalizedEmail = email.trim().toLowerCase();

        // 3. Validate phone format (Turkish mobile: 05XX XXX XX XX)
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 11 || !phoneDigits.startsWith('05')) {
            return res.status(400).json({
                error: 'Invalid phone format',
                message: 'Phone must be in format: 05XX XXX XX XX'
            });
        }

        // 4. Get reCAPTCHA configuration from system_settings
        const { data: settings } = await supabaseAdmin
            .from('system_settings')
            .select('recaptcha_enabled, recaptcha_secret_key')
            .eq('id', 1)
            .single();

        // Hard fail if system_settings row doesn't exist
        if (!settings) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'System settings not initialized'
            });
        }

        // Return 403 if reCAPTCHA is disabled
        if (!settings.recaptcha_enabled) {
            return res.status(403).json({
                error: 'Registration disabled',
                message: 'Registration is temporarily disabled'
            });
        }

        // Return 503 if secret key is missing
        if (!settings.recaptcha_secret_key) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'reCAPTCHA not configured. Contact administrator.'
            });
        }

        // 5. Verify reCAPTCHA with Google API
        const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
        const verifyResponse = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: settings.recaptcha_secret_key,
                response: recaptchaToken
            })
        });

        const verifyData = await verifyResponse.json();
        const score = typeof verifyData.score === 'number' ? verifyData.score : 0;

        // Detailed logging for debugging
        console.info('[Register] reCAPTCHA verification:', {
            success: verifyData.success,
            score,
            action: verifyData.action,
            hostname: verifyData.hostname,
        });

        // Validate reCAPTCHA success and score
        if (!verifyData.success || score < 0.5) {
            console.error('[Register] reCAPTCHA verification failed:', verifyData);
            return res.status(400).json({
                error: 'reCAPTCHA verification failed',
                message: 'Please try again or contact support if issue persists'
            });
        }

        // Validate reCAPTCHA action
        if (verifyData.action !== 'register') {
            return res.status(400).json({
                error: 'Invalid reCAPTCHA action',
                message: 'reCAPTCHA action mismatch'
            });
        }

        // Validate reCAPTCHA hostname
        const allowedHosts = [
            process.env.FRONTEND_HOSTNAME,
            'localhost',
            '127.0.0.1'
        ].filter(Boolean);

        if (allowedHosts.length === 0) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'FRONTEND_HOSTNAME not configured'
            });
        }

        if (!allowedHosts.includes(verifyData.hostname)) {
            console.error('[Register] Invalid hostname:', verifyData.hostname);
            return res.status(400).json({
                error: 'Invalid reCAPTCHA hostname',
                message: 'reCAPTCHA hostname mismatch'
            });
        }

        // 6. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password,
            user_metadata: {
                full_name: fullName,
                phone: phoneDigits
            }
        });

        if (authError) {
            console.error('[Register] Supabase Auth error:', authError);
            return res.status(400).json({
                error: 'Registration failed',
                message: authError.message
            });
        }

        console.log('[Register] User created successfully:', authData.user.id);

        // Profile auto-created by database trigger (handle_new_user)
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: {
                id: authData.user.id,
                email: authData.user.email
            }
        });
    } catch (err) {
        console.error('[Register] Error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Registration failed'
        });
    }
});

export default router;
