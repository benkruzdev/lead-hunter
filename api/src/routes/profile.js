import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Update user profile (full_name, phone)
 * PUT /api/profile
 */
router.put('/', requireAuth, async (req, res) => {
    try {
        const { fullName, phone } = req.body;

        if (!fullName && !phone) {
            return res.status(400).json({
                error: 'Missing fields',
                message: 'Provide at least one field to update (fullName or phone)'
            });
        }

        const updates = {};

        if (fullName !== undefined) {
            if (typeof fullName !== 'string' || fullName.trim().length === 0) {
                return res.status(400).json({
                    error: 'Invalid full name',
                    message: 'Full name must be a non-empty string'
                });
            }
            updates.full_name = fullName.trim();
        }

        if (phone !== undefined) {
            // Validate Turkish phone format (05XX XXX XX XX)
            const phoneDigits = phone.replace(/\D/g, '');
            if (phoneDigits.length !== 11 || !phoneDigits.startsWith('05')) {
                return res.status(400).json({
                    error: 'Invalid phone format',
                    message: 'Phone must be in format: 05XX XXX XX XX'
                });
            }
            updates.phone = phoneDigits;
        }

        updates.updated_at = new Date().toISOString();

        // Update profile
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', req.user.id)
            .eq('is_deleted', false)
            .select()
            .single();

        if (error) {
            console.error('[Profile] Update failed:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                error: 'Profile not found',
                message: 'Profile does not exist or has been deleted'
            });
        }

        res.json({
            success: true,
            profile: data
        });

    } catch (err) {
        console.error('[Profile] Update error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to update profile'
        });
    }
});

/**
 * Soft delete user account
 * POST /api/profile/delete
 */
router.post('/delete', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Soft delete profile
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('[Profile] Soft delete failed:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                error: 'Profile not found'
            });
        }

        // Optionally disable auth user (commented out for safety - can enable if needed)
        // await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // 100 years

        console.log('[Profile] Account soft deleted:', userId);

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (err) {
        console.error('[Profile] Delete error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to delete account'
        });
    }
});

export default router;
