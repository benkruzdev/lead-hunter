import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// Admin check helper
function isAdmin(user) {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    return adminEmails.includes(user.email);
}

/**
 * GET /api/billing/packages
 * Get active credit packages (public)
 */
router.get('/packages', async (req, res) => {
    try {
        const lang = req.headers['accept-language']?.startsWith('en') ? 'en' : 'tr';

        const { data: packages, error } = await supabaseAdmin
            .from('credit_packages')
            .select('id, name, display_name_tr, display_name_en, credits, price_try, price_usd, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('[Billing] Failed to fetch packages:', error);
            return res.status(500).json({ error: 'Failed to fetch credit packages' });
        }

        // Format response based on language
        const formattedPackages = packages.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            displayName: lang === 'en' ? pkg.display_name_en : pkg.display_name_tr,
            credits: pkg.credits,
            price: pkg.price_try,
            currency: 'TRY'
        }));

        res.json({ packages: formattedPackages });

    } catch (err) {
        console.error('[Billing] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/billing/orders
 * Get user's order history
 */
router.get('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                package_id,
                payment_method,
                amount,
                currency,
                credits,
                status,
                created_at,
                credit_packages!inner(display_name_tr, display_name_en)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Billing] Failed to fetch orders:', error);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        const lang = req.headers['accept-language']?.startsWith('en') ? 'en' : 'tr';

        // Format response
        const formattedOrders = orders.map(order => ({
            id: order.id,
            packageName: lang === 'en'
                ? order.credit_packages.display_name_en
                : order.credit_packages.display_name_tr,
            amount: order.amount,
            currency: order.currency,
            credits: order.credits,
            status: order.status,
            paymentMethod: order.payment_method,
            createdAt: order.created_at
        }));

        res.json({ orders: formattedOrders });

    } catch (err) {
        console.error('[Billing] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/billing/orders
 * Create new order
 */
router.post('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { packageId, paymentMethod } = req.body;

        if (!packageId || !paymentMethod) {
            return res.status(400).json({ error: 'packageId and paymentMethod are required' });
        }

        // Validate payment method
        const validMethods = ['manual', 'paytr', 'iyzico', 'shopier'];
        if (!validMethods.includes(paymentMethod)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }

        // For V1, only manual is allowed
        if (paymentMethod !== 'manual') {
            return res.status(400).json({
                error: 'Payment method coming soon',
                details: 'Only manual payment is currently supported. Other payment methods will be available soon.'
            });
        }

        // Fetch package
        const { data: pkg, error: pkgError } = await supabaseAdmin
            .from('credit_packages')
            .select('id, credits, price_try')
            .eq('id', packageId)
            .eq('is_active', true)
            .single();

        if (pkgError || !pkg) {
            return res.status(404).json({ error: 'Credit package not found' });
        }

        // Create order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                user_id: userId,
                package_id: packageId,
                payment_method: paymentMethod,
                amount: pkg.price_try,
                currency: 'TRY',
                credits: pkg.credits,
                status: 'pending'
            })
            .select()
            .single();

        if (orderError) {
            console.error('[Billing] Failed to create order:', orderError);
            return res.status(500).json({ error: 'Failed to create order' });
        }

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency
        });

    } catch (err) {
        console.error('[Billing] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/billing/orders/:orderId/complete
 * Complete manual payment (Admin only)
 */
router.post('/orders/:orderId/complete', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;

        // Admin check
        if (!isAdmin(req.user)) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Call RPC to complete order and add credits atomically
        const { data, error } = await supabaseAdmin.rpc('complete_order_and_add_credits', {
            p_order_id: orderId
        });

        if (error) {
            console.error('[Billing] Failed to complete order:', error);

            // Check for specific error messages
            if (error.message?.includes('ORDER_INVALID')) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(500).json({ error: 'Failed to complete order' });
        }

        res.json({
            success: true,
            userId: data.userId,
            creditsAdded: data.creditsAdded
        });

    } catch (err) {
        console.error('[Billing] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
