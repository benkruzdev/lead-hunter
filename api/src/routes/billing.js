import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import { listProviders, getProvider, stripSecrets } from '../utils/paymentProviders.js';
import { completeOrder, failOrder } from '../utils/orderCompletion.js';
import { initPayTR, verifyPayTRCallback, paytrOidToOrderId } from '../services/paytrService.js';
import { initIyzico, retrieveIyzicoPayment } from '../services/iyzicoService.js';
import { initShopier, verifyShopierCallback } from '../services/shopierService.js';
import { initStripe, verifyStripeWebhook } from '../services/stripeService.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAdmin(user) {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    return adminEmails.includes(user.email);
}

/** Derive the backend base URL for building callback URLs. */
function getBaseUrl(req) {
    return process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

/** Region guard: TR providers must not be used for global-only use-cases. */
const TR_PROVIDERS   = ['paytr', 'iyzico', 'shopier'];
const GLOBAL_PROVIDERS = ['stripe'];
const ALL_PROVIDERS  = [...TR_PROVIDERS, ...GLOBAL_PROVIDERS];

// ---------------------------------------------------------------------------
// GET /api/billing/packages
// ---------------------------------------------------------------------------
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

        const formattedPackages = packages.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            displayName: lang === 'en' ? pkg.display_name_en : pkg.display_name_tr,
            credits: pkg.credits,
            price: pkg.price_try,
            currency: 'TRY',
        }));

        res.json({ packages: formattedPackages });
    } catch (err) {
        console.error('[Billing] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// GET /api/billing/orders
// ---------------------------------------------------------------------------
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
                checkout_url,
                provider_reference,
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
            checkoutUrl: order.checkout_url || null,
            providerReference: order.provider_reference || null,
            createdAt: order.created_at,
        }));

        res.json({ orders: formattedOrders });
    } catch (err) {
        console.error('[Billing] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// POST /api/billing/orders
// Create order + initiate payment.
//
// User-facing paymentMethod values (what the UI sends):
//   'card'           — resolves to the first active TR gateway (paytr/iyzico/shopier),
//                      or Stripe if no TR provider is active.
//   'bank_transfer'  — pending order awaiting manual admin confirmation.
//
// Legacy direct provider codes (paytr/iyzico/shopier/stripe/manual) are still
// accepted so that existing admin tooling / curl tests don't break.
// ---------------------------------------------------------------------------
router.post('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        let { packageId, paymentMethod } = req.body;

        if (!packageId || !paymentMethod) {
            return res.status(400).json({ error: 'packageId and paymentMethod are required' });
        }

        const VALID_UI_METHODS  = ['card', 'bank_transfer'];
        const VALID_RAW_METHODS = [...ALL_PROVIDERS, 'manual'];

        if (!VALID_UI_METHODS.includes(paymentMethod) && !VALID_RAW_METHODS.includes(paymentMethod)) {
            return res.status(400).json({
                error: `Invalid paymentMethod. Supported: ${[...VALID_UI_METHODS, ...VALID_RAW_METHODS].join(', ')}`,
            });
        }

        // --- Resolve 'card' → active TR provider (or Stripe fallback) ---
        let resolvedProvider = null;  // the actual gateway code, null for bank_transfer

        if (paymentMethod === 'card') {
            const allProviders = await listProviders(supabaseAdmin);
            // Prefer active TR provider in sorted order
            const trProvider = allProviders.find(p => p.enabled && TR_PROVIDERS.includes(p.provider_code));
            const stripeProvider = allProviders.find(p => p.enabled && p.provider_code === 'stripe');

            if (trProvider) {
                resolvedProvider = trProvider.provider_code;
            } else if (stripeProvider) {
                resolvedProvider = 'stripe';
            } else {
                return res.status(503).json({ error: 'No active payment provider available. Please use bank transfer.' });
            }
            paymentMethod = resolvedProvider;  // downstream logic reuses provider-level code
        }

        // --- bank_transfer / manual: create pending order, no provider init ---
        const isBankTransfer = (paymentMethod === 'bank_transfer' || paymentMethod === 'manual');

        // Legacy 'manual' was admin-only — now bank_transfer is open to all users.
        // Direct 'manual' keyword from admin tooling is also allowed without auth check.

        // Fetch package.
        const { data: pkg, error: pkgError } = await supabaseAdmin
            .from('credit_packages')
            .select('id, credits, price_try, price_usd')
            .eq('id', packageId)
            .eq('is_active', true)
            .single();

        if (pkgError || !pkg) {
            return res.status(404).json({ error: 'Credit package not found' });
        }

        // Determine currency and amount.
        const isGlobal = resolvedProvider ? GLOBAL_PROVIDERS.includes(resolvedProvider) : false;
        const currency = isGlobal ? 'USD' : 'TRY';
        const amount   = isGlobal ? (pkg.price_usd || pkg.price_try / 30) : pkg.price_try;

        // Fetch user info.
        const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(userId);
        const userEmail = userAuth?.user?.email || '';
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, phone')
            .eq('id', userId)
            .single();

        // Create order (pending).
        const storedMethod = isBankTransfer ? 'bank_transfer' : resolvedProvider || paymentMethod;
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                user_id: userId,
                package_id: packageId,
                payment_method: storedMethod,
                amount,
                currency,
                credits: pkg.credits,
                status: 'pending',
            })
            .select()
            .single();

        if (orderError) {
            console.error('[Billing] Failed to create order:', orderError);
            return res.status(500).json({ error: 'Failed to create order' });
        }

        // ---- bank_transfer / manual: return immediately ----
        if (isBankTransfer) {
            return res.json({
                orderId: order.id,
                paymentMethod: 'bank_transfer',
                amount,
                currency,
                status: 'pending',
            });
        }

        // ---- Provider-level gateway init ----
        const provConfig = await getProvider(supabaseAdmin, paymentMethod);
        if (!provConfig || !provConfig.enabled) {
            await supabaseAdmin.from('orders').delete().eq('id', order.id);
            return res.status(503).json({ error: `Payment provider is not enabled` });
        }

        const orderCtx = {
            id:         order.id,
            amount,
            currency,
            user_id:    userId,
            user_email: userEmail,
            user_name:  profile?.full_name || '',
            user_phone: profile?.phone || '',
            user_ip:    req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        };

        const baseUrl = getBaseUrl(req);

        // ---- PayTR ----
        if (paymentMethod === 'paytr') {
            const callbackUrl = `${baseUrl}/api/billing/callback/paytr`;
            const result = await initPayTR(provConfig, orderCtx, callbackUrl);

            await supabaseAdmin.from('orders').update({
                provider_reference: result.providerReference,
                checkout_url: result.iframeUrl,
            }).eq('id', order.id);

            return res.json({
                orderId: order.id,
                paymentMethod: 'card',
                resolvedProvider: paymentMethod,
                iframeUrl: result.iframeUrl,
                token: result.token,
            });
        }

        // ---- iyzico ----
        if (paymentMethod === 'iyzico') {
            const callbackUrl = `${baseUrl}/api/billing/callback/iyzico`;
            const result = await initIyzico(provConfig, orderCtx, callbackUrl);

            await supabaseAdmin.from('orders').update({
                provider_reference: result.providerReference,
            }).eq('id', order.id);

            return res.json({
                orderId: order.id,
                paymentMethod: 'card',
                resolvedProvider: paymentMethod,
                token: result.token,
                checkoutFormContent: result.checkoutFormContent,
                paymentPageUrl: result.paymentPageUrl,
            });
        }

        // ---- Shopier ----
        if (paymentMethod === 'shopier') {
            const result = initShopier(provConfig, orderCtx);

            await supabaseAdmin.from('orders').update({
                provider_reference: result.providerReference,
                checkout_url: result.redirectUrl,
            }).eq('id', order.id);

            return res.json({
                orderId: order.id,
                paymentMethod: 'card',
                resolvedProvider: paymentMethod,
                redirectUrl: result.redirectUrl,
            });
        }

        // ---- Stripe ----
        if (paymentMethod === 'stripe') {
            const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/billing?payment=success&order=${order.id}`;
            const cancelUrl  = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/billing?payment=cancelled&order=${order.id}`;
            const result = await initStripe(provConfig, orderCtx, successUrl, cancelUrl);

            await supabaseAdmin.from('orders').update({
                provider_reference: result.providerReference,
                checkout_url: result.sessionUrl,
            }).eq('id', order.id);

            return res.json({
                orderId: order.id,
                paymentMethod: 'card',
                resolvedProvider: paymentMethod,
                sessionId: result.sessionId,
                sessionUrl: result.sessionUrl,
            });
        }

        return res.status(400).json({ error: 'Unhandled payment method' });

    } catch (err) {
        console.error('[Billing] Order init error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// POST /api/billing/orders/:orderId/complete   (Admin manual completion)
// ---------------------------------------------------------------------------
router.post('/orders/:orderId/complete', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!isAdmin(req.user)) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const result = await completeOrder(supabaseAdmin, orderId, 'admin-manual');

        if (result.alreadyCompleted) {
            return res.status(409).json({ error: 'Order already completed or not in pending state' });
        }

        res.json({ success: true, userId: result.userId, creditsAdded: result.credits });
    } catch (err) {
        console.error('[Billing] Manual complete error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// ---------------------------------------------------------------------------
// POST /api/billing/callback/paytr
// PayTR posts to this URL with hash-verified payload.
// MUST respond with "OK" string on success, "FAIL" on error (PayTR spec).
// This is a public endpoint — NO requireAuth.
// ---------------------------------------------------------------------------
router.post('/callback/paytr', express.urlencoded({ extended: false }), async (req, res) => {
    try {
        const body = req.body;
        const { merchant_oid, status } = body;

        const provConfig = await getProvider(supabaseAdmin, 'paytr');
        if (!provConfig) {
            console.error('[Billing/PayTR] Provider config not found');
            return res.send('FAIL');
        }

        // Verify HMAC signature.
        if (!verifyPayTRCallback(provConfig, body)) {
            console.warn('[Billing/PayTR] Hash mismatch — possible replay / tampered callback');
            return res.send('FAIL');
        }

        const orderId = paytrOidToOrderId(merchant_oid);

        if (status === 'success') {
            await completeOrder(supabaseAdmin, orderId, 'paytr-callback', { merchant_oid });
        } else {
            await failOrder(supabaseAdmin, orderId, `PayTR status: ${status}`);
        }

        res.send('OK');
    } catch (err) {
        console.error('[Billing/PayTR] Callback error:', err);
        res.send('FAIL');
    }
});

// ---------------------------------------------------------------------------
// POST /api/billing/callback/iyzico
// iyzico posts token here; we retrieve payment status from iyzico API.
// MUST redirect user back or render a page.
// This is a public endpoint — NO requireAuth.
// ---------------------------------------------------------------------------
router.post('/callback/iyzico', express.urlencoded({ extended: false }), async (req, res) => {
    try {
        const { token, conversationId, status } = req.body;
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';

        if (!token) {
            return res.redirect(`${frontendBase}/app/billing?payment=error`);
        }

        const provConfig = await getProvider(supabaseAdmin, 'iyzico');
        if (!provConfig) {
            return res.redirect(`${frontendBase}/app/billing?payment=error`);
        }

        // Retrieve real payment status from iyzico API.
        const detail = await retrieveIyzicoPayment(provConfig, token);

        // conversationId is the order UUID we sent in init.
        const orderId = detail.conversationId || conversationId;

        if (detail.status === 'success') {
            await completeOrder(supabaseAdmin, orderId, 'iyzico-callback', { token, paymentId: detail.paymentId });
            return res.redirect(`${frontendBase}/app/billing?payment=success&order=${orderId}`);
        } else {
            await failOrder(supabaseAdmin, orderId, `iyzico status: ${detail.status}`);
            return res.redirect(`${frontendBase}/app/billing?payment=failed&order=${orderId}`);
        }
    } catch (err) {
        console.error('[Billing/iyzico] Callback error:', err);
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendBase}/app/billing?payment=error`);
    }
});

// ---------------------------------------------------------------------------
// POST /api/billing/callback/shopier
// Shopier posts form data here with hash-verified payload.
// This is a public endpoint — NO requireAuth.
// ---------------------------------------------------------------------------
router.post('/callback/shopier', express.urlencoded({ extended: false }), async (req, res) => {
    try {
        const body = req.body;
        const { platform_order_id, status } = body;

        const provConfig = await getProvider(supabaseAdmin, 'shopier');
        if (!provConfig) {
            console.error('[Billing/Shopier] Provider config not found');
            return res.status(500).send('FAIL');
        }

        if (!verifyShopierCallback(provConfig, body)) {
            console.warn('[Billing/Shopier] Signature mismatch — ignoring callback');
            return res.status(400).send('INVALID_SIGNATURE');
        }

        const orderId = platform_order_id;

        if (status === '1' || status === 'success') {
            await completeOrder(supabaseAdmin, orderId, 'shopier-callback', { platform_order_id });
        } else {
            await failOrder(supabaseAdmin, orderId, `Shopier status: ${status}`);
        }

        res.send('OK');
    } catch (err) {
        console.error('[Billing/Shopier] Callback error:', err);
        res.status(500).send('FAIL');
    }
});

// ---------------------------------------------------------------------------
// POST /api/billing/webhook/stripe
// Stripe webhook endpoint. Must receive raw body (not JSON-parsed).
// We listen for checkout.session.completed only.
// This is a public endpoint — NO requireAuth.
// Express.json() is disabled for this route via express.raw().
// ---------------------------------------------------------------------------
router.post(
    '/webhook/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            const sig = req.headers['stripe-signature'];

            const provConfig = await getProvider(supabaseAdmin, 'stripe');
            if (!provConfig) {
                console.error('[Billing/Stripe] Provider config not found');
                return res.status(503).json({ error: 'Stripe not configured' });
            }

            let event;
            try {
                event = await verifyStripeWebhook(provConfig, req.body, sig);
            } catch (err) {
                console.warn('[Billing/Stripe] Webhook signature verification failed:', err.message);
                return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
            }

            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;
                const orderId = session.metadata?.order_id;

                if (!orderId) {
                    console.warn('[Billing/Stripe] Webhook: no order_id in session metadata');
                    return res.json({ received: true });
                }

                await completeOrder(supabaseAdmin, orderId, 'stripe-webhook', {
                    stripe_session_id: session.id,
                    payment_intent: session.payment_intent,
                });
            }
            // All other event types are acknowledged but ignored in this turn.

            res.json({ received: true });
        } catch (err) {
            console.error('[Billing/Stripe] Webhook error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// ---------------------------------------------------------------------------
// GET /api/billing/payment-providers (public — for checkout UI)
// ---------------------------------------------------------------------------
router.get('/payment-providers', async (req, res) => {
    try {
        const { region } = req.query;

        const providers = await listProviders(supabaseAdmin, {
            enabledOnly: true,
            region: region || undefined,
        });

        const safe = providers.map(stripSecrets);
        res.json({ providers: safe });
    } catch (err) {
        console.error('[Billing] payment-providers error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
