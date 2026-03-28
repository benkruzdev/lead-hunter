import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireActiveLifecycle } from '../middleware/lifecycle.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logEvent } from '../utils/eventLogger.js';

const router = express.Router();

/**
 * ============================================================================
 * 1. CANONICAL ACCOUNT SUMMARY
 * ============================================================================
 */

/**
 * GET /api/account
 * Returns an un-bloated aggregate of the user's canonical Account Center state.
 * Combines precise profile identity, system credits, explicit lifecycle state, and preferences.
 */
router.get('/', requireAuth, requireActiveLifecycle, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch core profile
        const { data: profile, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileErr || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Fetch preferences lazily
        let { data: prefs } = await supabaseAdmin
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Safe fallback initialization if migrations missed a user
        if (!prefs) {
            prefs = {
                language: 'tr',
                locale: 'tr-TR',
                timezone: 'Europe/Istanbul',
                default_search_country: 'TR',
                default_export_format: 'xlsx',
                default_export_scope: 'full',
                low_credit_warning_enabled: true,
                low_credit_warning_threshold: 100,
                product_updates_email_enabled: true,
                notifications_email_enabled: true
            };
        }

        return res.json({
            account: {
                id: profile.id,
                email: req.user.email, // Best-source from native JWT
                full_name: profile.full_name,
                phone: profile.phone,
                role: profile.role,
                plan: profile.plan,
                credits: profile.credits,
                lifecycle: {
                    status: profile.account_status,
                    is_active: profile.is_active, // Legacy bridge flag
                    is_deleted: profile.is_deleted // Legacy bridge flag
                },
                preferences: prefs,
                created_at: profile.created_at
            }
        });
    } catch (err) {
        console.error('[GET /api/account] Canonical read error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * ============================================================================
 * 2. PROFILE CORE MUTATIONS
 * ============================================================================
 */

/**
 * PATCH /api/account/profile
 * Safely updates core identity traits.
 */
router.patch('/profile', requireAuth, requireActiveLifecycle, async (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, phone } = req.body;

        const payload = { updated_at: new Date().toISOString() };
        
        // Clean partial application
        if (full_name !== undefined) payload.full_name = typeof full_name === 'string' ? full_name.trim() : null;
        if (phone !== undefined) payload.phone = typeof phone === 'string' ? phone.trim() : null;

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(payload)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        await logEvent(supabaseAdmin, {
            level: 'info',
            source: 'account_center',
            event_type: 'profile_updated',
            actor_user_id: userId,
            subject_user_id: userId,
            message: `User updated identity profile metadata`,
            metadata: { modified_fields: Object.keys(payload) }
        });

        return res.json({ success: true, profile: data });
    } catch (err) {
        console.error('[PATCH /api/account/profile] Save error:', err);
        return res.status(500).json({ error: 'Could not write profile metadata' });
    }
});


/**
 * ============================================================================
 * 3. PREFERENCES API
 * ============================================================================
 */

router.get('/preferences', requireAuth, requireActiveLifecycle, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_preferences')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Allow Not-Found

        return res.json({ success: true, preferences: data || {} });
    } catch (err) {
        return res.status(500).json({ error: 'System mapping query failed' });
    }
});

router.patch('/preferences', requireAuth, requireActiveLifecycle, async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body; // e.g., default_export_format, language

        // Pre-validate safety of payload properties against explicit schema
        const allowedKeys = [
            'language', 'locale', 'timezone',
            'default_search_country', 'default_export_format', 'default_export_scope',
            'low_credit_warning_enabled', 'low_credit_warning_threshold',
            'product_updates_email_enabled', 'notifications_email_enabled'
        ];

        const payload = { updated_at: new Date().toISOString() };
        for (const key of allowedKeys) {
             if (updates[key] !== undefined) payload[key] = updates[key];
        }

        const { data, error } = await supabaseAdmin
            .from('user_preferences')
            .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        await logEvent(supabaseAdmin, {
            level: 'info',
            source: 'account_center',
            event_type: 'preferences_updated',
            actor_user_id: userId,
            subject_user_id: userId,
            message: 'User modified interface and systemic preferences'
        });

        return res.json({ success: true, preferences: data });
    } catch (err) {
        console.error('[PATCH /api/account/preferences] Error:', err);
        return res.status(500).json({ error: 'Could not apply preferences changes' });
    }
});


/**
 * ============================================================================
 * 4. LIFECYCLE APIS
 * ============================================================================
 */

/**
 * POST /api/account/lifecycle/soft-delete
 * Soft-purges the user while preserving auditing metrics. Replaces explicit "DELETE USER".
 * Notice: This intentionally omits requireActiveLifecycle since a user could trigger it right
 * after a suspension flip pending their local JWT expiration.
 */
router.post('/lifecycle/soft-delete', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Ensure they aren't already hard-deleted or locked out completely.
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profile?.role === 'admin') {
            return res.status(403).json({ error: 'Admin accounts cannot be self-deleted.' });
        }

        const deletionStamp = new Date().toISOString();

        // Dual-write legacy bridge attributes AND canonical lifecycle attributes 
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                account_status: 'soft_deleted',
                is_deleted: true,          // Legacy compatibility
                status: false,             // Legacy compatibility
                is_active: false,          // Legacy compatibility
                deactivated_at: deletionStamp,
                lifecycle_reason: 'User explicitly triggered account retirement.',
                lifecycle_changed_by: userId,
                updated_at: deletionStamp
            })
            .eq('id', userId);

        if (error) throw error;

        await logEvent(supabaseAdmin, {
            level: 'warn',
            source: 'account_center',
            event_type: 'account_lifecycle_soft_delete',
            actor_user_id: userId,
            subject_user_id: userId,
            message: 'Account was moved to soft_deleted state via self-service action'
        });

        return res.json({ success: true, message: 'Account securely deactivated' });
    } catch (err) {
        console.error('[POST /lifecycle/soft-delete] System error:', err);
        return res.status(500).json({ error: 'Failed to initiate deletion phase' });
    }
});

/**
 * POST /api/account/lifecycle/deactivate
 * Safe deactivation freeze (a status block underneath true "deletion" intended for user pausing)
 */
router.post('/lifecycle/deactivate', requireAuth, requireActiveLifecycle, async (req, res) => {
    try {
        const userId = req.user.id;
        const stamp = new Date().toISOString();

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                account_status: 'inactive',
                is_active: false, // Legacy fallback sync
                status: false,    // Legacy fallback sync
                deactivated_at: stamp,
                lifecycle_changed_by: userId,
                lifecycle_reason: 'Voluntary deactivation'
            })
            .eq('id', userId);

        if (error) throw error;

        await logEvent(supabaseAdmin, {
            level: 'info',
            source: 'account_center',
            event_type: 'account_lifecycle_deactivated',
            actor_user_id: userId,
            subject_user_id: userId,
            message: 'User opted to pause / deactivate active status'
        });

        return res.json({ success: true, message: 'Account halted' });
    } catch (e) {
        return res.status(500).json({ error: 'Could not halt account' });
    }
});

/**
 * POST /api/account/lifecycle/reactivate
 * Allows an 'inactive' user to bounce back into the system without contacting support.
 * DO NOT use requireActiveLifecycle here.
 */
router.post('/lifecycle/reactivate', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const { data: profile } = await supabaseAdmin.from('profiles').select('account_status, is_deleted').eq('id', userId).single();
        
        // We only allow self-reactivation if they purposefully halted it (inactive) or if it's uniquely permissible.
        // Once explicitly 'soft_deleted', product policy requires admin/support intervention to prevent ghost account resurrections.
        if (!profile || profile.account_status === 'soft_deleted' || profile.is_deleted) {
            return res.status(403).json({ error: 'Reactivation blocked. Account must be retrieved by an administrator.' });
        }

        if (profile.account_status === 'active') {
            return res.json({ success: true, message: 'Already active' }); // No-op
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                account_status: 'active',
                is_active: true,
                status: true,
                reactivated_at: new Date().toISOString(),
                lifecycle_changed_by: userId,
                lifecycle_reason: 'Owner restored functionality'
            })
            .eq('id', userId);

        if (error) throw error;

        await logEvent(supabaseAdmin, {
            level: 'success',
            source: 'account_center',
            event_type: 'account_lifecycle_reactivated',
            actor_user_id: userId,
            subject_user_id: userId,
            message: 'Account bindings restored from inactivity manually'
        });

        return res.json({ success: true, message: 'Welcome back' });
    } catch (e) {
        return res.status(500).json({ error: 'Failed restoration task' });
    }
});

/**
 * ============================================================================
 * 5. SECURITY & PASSWORDS 
 * ============================================================================
 * Wrapping simple change-password routines into the overarching /account domain
 * makes unifying future MFA and session hooks seamless.
 */

router.post('/security/password', requireAuth, requireActiveLifecycle, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Missing security credentials in payload' });
        }

        // Must re-auth to prove knowledge of the prior vault secret 
        const { supabase } = await import('../config/supabase.js');
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: req.user.email,
            password: currentPassword
        });

        if (signInError) {
            await logEvent(supabaseAdmin, {
                level: 'warn',
                source: 'account_center',
                event_type: 'security_password_rejected',
                actor_user_id: req.user.id,
                message: 'Failed validation checkpoint before password mutation'
            });
            return res.status(403).json({ error: 'Invalid current password' });
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            req.user.id,
            { password: newPassword }
        );

        if (updateError) throw updateError;

        await logEvent(supabaseAdmin, {
            level: 'success',
            source: 'account_center',
            event_type: 'security_password_changed',
            actor_user_id: req.user.id,
            subject_user_id: req.user.id,
            message: 'User successfully regenerated core credential secret'
        });

        return res.json({ success: true, message: 'Credential boundary secured' });
    } catch (err) {
        console.error('[POST /api/account/security/password] Error:', err);
        return res.status(500).json({ error: 'Vault update rejected due to systemic failure' });
    }
});

export default router;
