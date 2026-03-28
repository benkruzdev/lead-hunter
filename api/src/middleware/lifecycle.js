import { supabaseAdmin } from '../config/supabase.js';

/**
 * Middleware to enforce strict account lifecycle states.
 * Rejects requests from accounts that are inactive, suspended, or soft-deleted.
 * Designed to wrap canonical endpoints and major mutation gateways.
 */
export async function requireActiveLifecycle(req, res, next) {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Missing user context' });
        }

        const userId = req.user.id;

        // Fetch canonical lifecycle state (plus legacy fallbacks for safety)
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('account_status, is_deleted')
            .eq('id', userId)
            .single();

        // Separate real systemic query failures from actual missing rows
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
            }
            console.error('[requireActiveLifecycle] Database querying error:', error);
            return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to access profile lifecycle table' });
        }

        if (!profile) {
            return res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
        }

        // Canonical explicit lifecycle check
        if (profile.account_status === 'soft_deleted' || profile.is_deleted === true) {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Account has been deleted.',
                lifecycle_status: 'soft_deleted'
            });
        }

        if (profile.account_status === 'inactive') {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Account is currently inactive or suspended.',
                lifecycle_status: 'inactive'
            });
        }

        if (profile.account_status === 'pending_hard_delete') {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Account is scheduled for permanent deletion.',
                lifecycle_status: 'pending_hard_delete'
            });
        }

        // Must be exactly active
        if (profile.account_status !== 'active') {
             return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Invalid account state.',
                lifecycle_status: profile.account_status
            });
        }

        // If active, proceed
        next();
    } catch (err) {
        console.error('[requireActiveLifecycle] Middleware error:', err);
        return res.status(500).json({ error: 'Internal server error', message: 'Lifecycle validation failed' });
    }
}
