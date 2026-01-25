import express from 'express';

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'LeadHunter API',
        version: '1.0.0'
    });
});

/**
 * Readiness check endpoint
 * GET /api/health/ready
 */
router.get('/ready', async (req, res) => {
    try {
        const { supabaseAdmin } = await import('../config/supabase.js');

        // Test database connection
        const { error } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .limit(1);

        if (error) {
            return res.status(503).json({
                status: 'ERROR',
                message: 'Database connection failed',
                error: error.message
            });
        }

        res.json({
            status: 'READY',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (err) {
        res.status(503).json({
            status: 'ERROR',
            message: 'Service not ready',
            error: err.message
        });
    }
});

export default router;
