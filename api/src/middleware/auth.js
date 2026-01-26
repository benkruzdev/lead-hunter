import { verifyUserToken } from '../config/supabase.js';

/**
 * Middleware to verify JWT token from Authorization header
 */
export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[requireAuth] Missing or invalid Authorization header:', authHeader);
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('[requireAuth] Validating token (length: %d)', token.length);

        const { user, error } = await verifyUserToken(token);

        if (error || !user) {
            console.error('[requireAuth] Token validation failed:', error);
            return res.status(401).json({
                error: 'Unauthorized',
                message: error || 'Invalid token'
            });
        }

        console.log('[requireAuth] Token valid for user:', user.id);
        // Attach user to request object
        req.user = user;
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

        console.log('[requireAdmin] AUTH USER:', JSON.stringify(req.user, null, 2));
        const userId = req.user?.id;

        if (!userId) {
            console.error('[requireAdmin] req.user.id is missing');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User ID not found'
            });
        }

        console.log('[requireAdmin] Looking up admin role for user ID:', userId);

        const { supabaseAdmin } = await import('../config/supabase.js');
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        console.log('[requireAdmin] ADMIN LOOKUP - id:', userId, 'profile:', profile, 'error:', error);

        if (error || !profile || profile.role !== 'admin') {
            console.error('[requireAdmin] Access denied - role check failed');
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Admin access required'
            });
        }

        console.log('[requireAdmin] Admin verified successfully');
        next();
    } catch (err) {
        console.error('Admin middleware error:', err);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Authorization check failed'
        });
    }
}
