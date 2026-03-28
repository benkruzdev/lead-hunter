import { verifyUserToken } from '../config/supabase.js';

/**
 * Middleware to verify JWT token from Authorization header
 */
export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { user, error } = await verifyUserToken(token);

        if (error || !user) {
            console.error('[requireAuth] Token validation failed:', error);
            return res.status(401).json({
                error: 'Unauthorized',
                message: error || 'Invalid token'
            });
        }
        // Attach user to request object
        req.user = user;

        // [TEMPORARY PRODUCTION DIAGNOSTIC] Remove after /api/account investigation
        console.log('[AUTH DEBUG] token verification succeeded');
        console.log('[AUTH DEBUG] req.user.id:', req.user?.id);
        console.log('[AUTH DEBUG] req.user.email:', req.user?.email);
        console.log('[AUTH DEBUG] req.user.aud:', req.user?.aud || 'N/A');
        
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Authentication failed'
        });
    }
}

/**
 * Middleware to verify user is admin
 */
export async function requireAdmin(req, res, next) {
    try {
        if (!req.user) {
            console.error('[requireAdmin] No req.user - authentication failed');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const userId = req.user?.id;

        if (!userId) {
            console.error('[requireAdmin] req.user.id is missing');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User ID not found'
            });
        }

        const { supabaseAdmin } = await import('../config/supabase.js');
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error || !profile || profile.role !== 'admin') {
            console.error('[requireAdmin] Access denied for user:', userId);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Admin access required'
            });
        }

        next();
    } catch (err) {
        console.error('Admin middleware error:', err);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Authorization check failed'
        });
    }
}
