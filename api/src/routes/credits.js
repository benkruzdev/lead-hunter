import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get current user's credit balance
 * GET /api/credits/balance
 */
router.get('/balance', requireAuth, async (req, res) => {
    try {
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('credits')
            .eq('id', req.user.id)
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json({
            credits: profile?.credits || 0
        });
    } catch (err) {
        console.error('Get balance error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch credit balance'
        });
    }
});

/**
 * Get credit transaction history
 * GET /api/credits/history?limit=50
 */
router.get('/history', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);

        const { data: ledger, error } = await supabaseAdmin
            .from('credit_ledger')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        res.json({
            transactions: ledger || []
        });
    } catch (err) {
        console.error('Get history error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch credit history'
        });
    }
});

/**
 * Deduct credits (internal use - called by other endpoints)
 * POST /api/credits/deduct
 * Body: { amount, type, description }
 */
router.post('/deduct', requireAuth, async (req, res) => {
    try {
        const { amount, type, description } = req.body;

        // Validate input
        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'Invalid amount',
                message: 'Amount must be greater than 0'
            });
        }

        if (!type) {
            return res.status(400).json({
                error: 'Missing type',
                message: 'Transaction type is required'
            });
        }

        // Call deduct_credits function
        const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
            p_user_id: req.user.id,
            p_amount: amount,
            p_type: type,
            p_description: description || null
        });

        if (error) {
            return res.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }

        // data is boolean (true = success, false = insufficient credits)
        if (!data) {
            return res.status(402).json({
                error: 'Insufficient credits',
                message: `You need ${amount} credits but don't have enough`,
                required: amount
            });
        }

        res.json({
            success: true,
            charged: amount,
            message: 'Credits deducted successfully'
        });
    } catch (err) {
        console.error('Deduct credits error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to deduct credits'
        });
    }
});

export default router;
