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

export default router;
