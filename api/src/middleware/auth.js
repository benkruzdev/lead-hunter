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
            return res.status(401).json({
                error: 'Unauthorized',
                message: error || 'Invalid token'
            });
        }

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
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated'
            });
        }

        const { supabaseAdmin } = await import('../config/supabase.js');
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (error || !profile || profile.role !== 'admin') {
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
