import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import { listProviders, getProvider, stripSecrets } from '../utils/paymentProviders.js';
import { completeOrder, failOrder } from '../utils/orderCompletion.js';
import { logEvent } from '../utils/eventLogger.js';
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

/**
 * Thin wrapper to write a payment lifecycle event non-fatally.
 * Accepts a pre-set context object so callers don't repeat themselves.
 */
function logPayEvent(supabase, eventType, level, message, context = {}, extraMeta = {}) {
    const {
        orderId = null, userId = null, providerCode = null,
        paymentMethod = null, amount = null, currency = null,
    } = context;

    return logEvent(supabase, {
        level,
        source: providerCode || 'billing',
        event_type: eventType,
        subject_user_id: userId,
        target_type: 'order',
        target_id: orderId,
        message,
        credit_delta: null,
        metadata: {
            order_id: orderId,
            provider_code: providerCode,
            payment_method: paymentMethod,
            amount,
            currency,
            ...extraMeta,
        },
    }).catch(err => console.warn(`[Billing] logPayEvent ${eventType} failed (non-fatal):`, err.message));
}

/** Mark order failure_reason + last_payment_event_at without flipping status (for non-pending errors). */
async function patchOrderFailureNote(supabase, orderId, reason, failureCode = null) {
    const patch = {
        failure_reason: (reason || '').slice(0, 500),
        last_payment_event_at: new Date().toISOString(),
    };
    if (failureCode) patch.failure_code = failureCode.slice(0, 100);
    await supabase.from('orders').update(patch).eq('id', orderId).catch(() => {});
}

// ---------------------------------------------------------------------------
// GET /api/billing/packages
// ---------------------------------------------------------------------------
router.get('/packages', async (req, res) => {
    try {
        const { data: packages, error } = await supabaseAdmin
            .from('credit_packages')
            .select('id, name, display_name_tr, display_name_en, credits, price_try, price_usd, is_active, is_featured, sort_order, description, features')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('[Billing] Failed to fetch packages:', error);
            return res.status(500).json({ error: 'Failed to fetch credit packages' });
        }

        // Return raw snake_case fields so the frontend normalizer can handle
        // localization, pricing context, and featured badge correctly.
        // is_featured, description, and features are intentionally included so
        // the public billing page can render them without inferring from position.
        res.json({ packages });
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
                failure_reason,
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
            failureReason: order.failure_reason || null,
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

        // Build context object for lifecycle events.
        const evtCtx = {
            orderId: order.id,
            userId,
            providerCode: paymentMethod,
            paymentMethod: storedMethod,
            amount,
            currency,
        };

        // Log payment_init_started (non-fatal).
        logPayEvent(supabaseAdmin, 'payment_init_started', 'info',
            `Ödeme başlatılıyor — ${paymentMethod} — sipariş: ${order.id}`,
            evtCtx, { stage: 'init' });

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
            try {
                const callbackUrl = `${baseUrl}/api/billing/callback/paytr`;
                const result = await initPayTR(provConfig, orderCtx, callbackUrl);

                await supabaseAdmin.from('orders').update({
                    provider_reference: result.providerReference,
                    checkout_url: result.iframeUrl,
                    last_payment_event_at: new Date().toISOString(),
                }).eq('id', order.id);

                logPayEvent(supabaseAdmin, 'payment_redirect_created', 'info',
                    `PayTR iframe token oluşturuldu — sipariş: ${order.id}`,
                    evtCtx, {
                        provider_reference: result.providerReference,
                        iframe_url: result.iframeUrl,
                        stage: 'redirect_created',
                    });

                return res.json({
                    orderId: order.id,
                    paymentMethod: 'card',
                    resolvedProvider: paymentMethod,
                    iframeUrl: result.iframeUrl,
                    token: result.token,
                });
            } catch (initErr) {
                console.error('[Billing/PayTR] Init error:', initErr.message);
                await failOrder(supabaseAdmin, order.id, `PayTR init error: ${initErr.message}`, {
                    providerCode: 'paytr',
                    meta: { stage: 'init', error_message: initErr.message },
                });
                logPayEvent(supabaseAdmin, 'payment_init_failed', 'error',
                    `PayTR başlatma hatası — ${initErr.message}`,
                    evtCtx, { stage: 'init', error_message: initErr.message });
                return res.status(502).json({ error: `Payment init failed: ${initErr.message}` });
            }
        }

        // ---- iyzico ----
        if (paymentMethod === 'iyzico') {
            try {
                const callbackUrl = `${baseUrl}/api/billing/callback/iyzico`;
                const result = await initIyzico(provConfig, orderCtx, callbackUrl);

                await supabaseAdmin.from('orders').update({
                    provider_reference: result.providerReference,
                    last_payment_event_at: new Date().toISOString(),
                }).eq('id', order.id);

                logPayEvent(supabaseAdmin, 'payment_redirect_created', 'info',
                    `iyzico checkout form oluşturuldu — sipariş: ${order.id}`,
                    evtCtx, {
                        provider_reference: result.providerReference,
                        stage: 'redirect_created',
                    });

                return res.json({
                    orderId: order.id,
                    paymentMethod: 'card',
                    resolvedProvider: paymentMethod,
                    token: result.token,
                    checkoutFormContent: result.checkoutFormContent,
                    paymentPageUrl: result.paymentPageUrl,
                });
            } catch (initErr) {
                console.error('[Billing/iyzico] Init error:', initErr.message);
                await failOrder(supabaseAdmin, order.id, `iyzico init error: ${initErr.message}`, {
                    providerCode: 'iyzico',
                    meta: { stage: 'init', error_message: initErr.message },
                });
                logPayEvent(supabaseAdmin, 'payment_init_failed', 'error',
                    `iyzico başlatma hatası — ${initErr.message}`,
                    evtCtx, { stage: 'init', error_message: initErr.message });
                return res.status(502).json({ error: `Payment init failed: ${initErr.message}` });
            }
        }

        // ---- Shopier ----
        if (paymentMethod === 'shopier') {
            try {
                const result = initShopier(provConfig, orderCtx);

                await supabaseAdmin.from('orders').update({
                    provider_reference: result.providerReference,
                    checkout_url: result.redirectUrl,
                    last_payment_event_at: new Date().toISOString(),
                }).eq('id', order.id);

                logPayEvent(supabaseAdmin, 'payment_redirect_created', 'info',
                    `Shopier ödeme linki oluşturuldu — sipariş: ${order.id}`,
                    evtCtx, {
                        provider_reference: result.providerReference,
                        redirect_url: result.redirectUrl,
                        stage: 'redirect_created',
                    });

                return res.json({
                    orderId: order.id,
                    paymentMethod: 'card',
                    resolvedProvider: paymentMethod,
                    redirectUrl: result.redirectUrl,
                });
            } catch (initErr) {
                console.error('[Billing/Shopier] Init error:', initErr.message);
                await failOrder(supabaseAdmin, order.id, `Shopier init error: ${initErr.message}`, {
                    providerCode: 'shopier',
                    meta: { stage: 'init', error_message: initErr.message },
                });
                logPayEvent(supabaseAdmin, 'payment_init_failed', 'error',
                    `Shopier başlatma hatası — ${initErr.message}`,
                    evtCtx, { stage: 'init', error_message: initErr.message });
                return res.status(502).json({ error: `Payment init failed: ${initErr.message}` });
            }
        }

        // ---- Stripe ----
        if (paymentMethod === 'stripe') {
            try {
                const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/billing?payment=success&order=${order.id}`;
                const cancelUrl  = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/billing?payment=cancelled&order=${order.id}`;
                const result = await initStripe(provConfig, orderCtx, successUrl, cancelUrl);

                await supabaseAdmin.from('orders').update({
                    provider_reference: result.providerReference,
                    checkout_url: result.sessionUrl,
                    last_payment_event_at: new Date().toISOString(),
                }).eq('id', order.id);

                logPayEvent(supabaseAdmin, 'payment_redirect_created', 'info',
                    `Stripe Checkout Session oluşturuldu — sipariş: ${order.id}`,
                    evtCtx, {
                        provider_reference: result.providerReference,
                        session_id: result.sessionId,
                        stage: 'redirect_created',
                    });

                return res.json({
                    orderId: order.id,
                    paymentMethod: 'card',
                    resolvedProvider: paymentMethod,
                    sessionId: result.sessionId,
                    sessionUrl: result.sessionUrl,
                });
            } catch (initErr) {
                console.error('[Billing/Stripe] Init error:', initErr.message);
                await failOrder(supabaseAdmin, order.id, `Stripe init error: ${initErr.message}`, {
                    providerCode: 'stripe',
                    meta: { stage: 'init', error_message: initErr.message },
                });
                logPayEvent(supabaseAdmin, 'payment_init_failed', 'error',
                    `Stripe başlatma hatası — ${initErr.message}`,
                    evtCtx, { stage: 'init', error_message: initErr.message });
                return res.status(502).json({ error: `Payment init failed: ${initErr.message}` });
            }
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
    const body = req.body;
    const { merchant_oid, status, total_amount, fail_reason_msg } = body;
    const orderId = merchant_oid ? paytrOidToOrderId(merchant_oid) : null;

    try {
        const provConfig = await getProvider(supabaseAdmin, 'paytr');
        if (!provConfig) {
            console.error('[Billing/PayTR] Provider config not found');
            return res.send('FAIL');
        }

        const evtCtx = {
            orderId,
            providerCode: 'paytr',
            paymentMethod: 'paytr',
        };

        // Log callback received.
        logPayEvent(supabaseAdmin, 'payment_callback_received', 'info',
            `PayTR callback alındı — merchant_oid: ${merchant_oid}`,
            evtCtx, {
                merchant_oid,
                raw_status: status,
                total_amount,
                stage: 'callback_received',
            });

        // Verify HMAC signature.
        if (!verifyPayTRCallback(provConfig, body)) {
            console.warn('[Billing/PayTR] Hash mismatch — possible replay / tampered callback');
            if (orderId) {
                logPayEvent(supabaseAdmin, 'payment_callback_verification_failed', 'error',
                    `PayTR callback imza doğrulaması başarısız`,
                    evtCtx, { stage: 'callback_verify', merchant_oid });
                await patchOrderFailureNote(supabaseAdmin, orderId, 'PayTR: callback hash mismatch');
            }
            return res.send('FAIL');
        }

        if (status === 'success') {
            await completeOrder(supabaseAdmin, orderId, 'paytr-callback', {
                merchant_oid,
                provider_code: 'paytr',
                total_amount,
            });
        } else {
            const reason = `PayTR status: ${status}${fail_reason_msg ? ` — ${fail_reason_msg}` : ''}`;
            await failOrder(supabaseAdmin, orderId, reason, {
                providerCode: 'paytr',
                meta: {
                    merchant_oid,
                    raw_status: status,
                    fail_reason_msg: fail_reason_msg || null,
                    stage: 'callback_complete',
                },
            });
        }

        res.send('OK');
    } catch (err) {
        console.error('[Billing/PayTR] Callback error:', err);
        if (orderId) {
            logPayEvent(supabaseAdmin, 'payment_webhook_error', 'error',
                `PayTR callback işleme hatası: ${err.message}`,
                { orderId, providerCode: 'paytr', paymentMethod: 'paytr' },
                { stage: 'callback_complete', error_message: err.message });
            await patchOrderFailureNote(supabaseAdmin, orderId, `PayTR callback error: ${err.message}`);
        }
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
    const { token, conversationId, status } = req.body;
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!token) {
        return res.redirect(`${frontendBase}/app/billing?payment=error`);
    }

    let orderId = conversationId || null;
    const evtCtx = { orderId, providerCode: 'iyzico', paymentMethod: 'iyzico' };

    try {
        const provConfig = await getProvider(supabaseAdmin, 'iyzico');
        if (!provConfig) {
            return res.redirect(`${frontendBase}/app/billing?payment=error`);
        }

        logPayEvent(supabaseAdmin, 'payment_callback_received', 'info',
            `iyzico callback alındı — token: ${token?.slice(0, 12)}…`,
            evtCtx, { token_prefix: token?.slice(0, 12), raw_status: status, stage: 'callback_received' });

        // Retrieve real payment status from iyzico API.
        const detail = await retrieveIyzicoPayment(provConfig, token);

        // conversationId is the order UUID we sent in init.
        orderId = detail.conversationId || conversationId;
        evtCtx.orderId = orderId;

        if (detail.status === 'success') {
            await completeOrder(supabaseAdmin, orderId, 'iyzico-callback', {
                token,
                paymentId: detail.paymentId,
                provider_code: 'iyzico',
            });
            return res.redirect(`${frontendBase}/app/billing?payment=success&order=${orderId}`);
        } else {
            const providerStatus = detail.raw?.paymentStatus || detail.status;
            const errorMsg = detail.raw?.errorMessage || detail.raw?.errorCode || providerStatus;
            await failOrder(supabaseAdmin, orderId, `iyzico: ${errorMsg}`, {
                providerCode: 'iyzico',
                failureCode: detail.raw?.errorCode ? String(detail.raw.errorCode) : null,
                meta: {
                    token,
                    payment_status: providerStatus,
                    error_message: detail.raw?.errorMessage,
                    error_code: detail.raw?.errorCode,
                    stage: 'callback_complete',
                },
            });
            return res.redirect(`${frontendBase}/app/billing?payment=failed&order=${orderId}`);
        }
    } catch (err) {
        console.error('[Billing/iyzico] Callback error:', err);
        if (orderId) {
            logPayEvent(supabaseAdmin, 'payment_webhook_error', 'error',
                `iyzico callback işleme hatası: ${err.message}`,
                evtCtx, { stage: 'callback_complete', error_message: err.message });
            await patchOrderFailureNote(supabaseAdmin, orderId, `iyzico callback error: ${err.message}`);
        }
        res.redirect(`${frontendBase}/app/billing?payment=error`);
    }
});

// ---------------------------------------------------------------------------
// POST /api/billing/callback/shopier
// Shopier posts form data here with hash-verified payload.
// This is a public endpoint — NO requireAuth.
// ---------------------------------------------------------------------------
router.post('/callback/shopier', express.urlencoded({ extended: false }), async (req, res) => {
    const body = req.body;
    const { platform_order_id, status } = body;
    const orderId = platform_order_id || null;
    const evtCtx = { orderId, providerCode: 'shopier', paymentMethod: 'shopier' };

    try {
        const provConfig = await getProvider(supabaseAdmin, 'shopier');
        if (!provConfig) {
            console.error('[Billing/Shopier] Provider config not found');
            return res.status(500).send('FAIL');
        }

        logPayEvent(supabaseAdmin, 'payment_callback_received', 'info',
            `Shopier callback alındı — order: ${orderId}`,
            evtCtx, { raw_status: status, stage: 'callback_received' });

        if (!verifyShopierCallback(provConfig, body)) {
            console.warn('[Billing/Shopier] Signature mismatch — ignoring callback');
            logPayEvent(supabaseAdmin, 'payment_callback_verification_failed', 'error',
                `Shopier callback imza doğrulaması başarısız`,
                evtCtx, { stage: 'callback_verify' });
            if (orderId) await patchOrderFailureNote(supabaseAdmin, orderId, 'Shopier: callback signature mismatch');
            return res.status(400).send('INVALID_SIGNATURE');
        }

        if (status === '1' || status === 'success') {
            await completeOrder(supabaseAdmin, orderId, 'shopier-callback', {
                platform_order_id,
                provider_code: 'shopier',
            });
        } else {
            await failOrder(supabaseAdmin, orderId, `Shopier status: ${status}`, {
                providerCode: 'shopier',
                meta: { platform_order_id, raw_status: status, stage: 'callback_complete' },
            });
        }

        res.send('OK');
    } catch (err) {
        console.error('[Billing/Shopier] Callback error:', err);
        logPayEvent(supabaseAdmin, 'payment_webhook_error', 'error',
            `Shopier callback işleme hatası: ${err.message}`,
            evtCtx, { stage: 'callback_complete', error_message: err.message });
        if (orderId) await patchOrderFailureNote(supabaseAdmin, orderId, `Shopier callback error: ${err.message}`);
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
        const sig = req.headers['stripe-signature'];
        let orderId = null;
        const evtCtx = { providerCode: 'stripe', paymentMethod: 'stripe' };

        try {
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
                logPayEvent(supabaseAdmin, 'payment_callback_verification_failed', 'error',
                    `Stripe webhook imza doğrulaması başarısız: ${err.message}`,
                    evtCtx, { stage: 'webhook_verify', error_message: err.message });
                return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
            }

            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;
                orderId = session.metadata?.order_id;
                evtCtx.orderId = orderId;

                if (!orderId) {
                    console.warn('[Billing/Stripe] Webhook: no order_id in session metadata');
                    logPayEvent(supabaseAdmin, 'payment_webhook_error', 'warn',
                        'Stripe webhook: session metadata içinde order_id yok',
                        evtCtx, { stripe_session_id: session.id, stage: 'webhook_verify' });
                    return res.json({ received: true });
                }

                logPayEvent(supabaseAdmin, 'payment_callback_received', 'info',
                    `Stripe checkout.session.completed alındı — sipariş: ${orderId}`,
                    evtCtx, {
                        stripe_session_id: session.id,
                        payment_intent: session.payment_intent,
                        stage: 'webhook_received',
                    });

                await completeOrder(supabaseAdmin, orderId, 'stripe-webhook', {
                    stripe_session_id: session.id,
                    payment_intent: session.payment_intent,
                    provider_code: 'stripe',
                });
            } else if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
                const session = event.data.object;
                orderId = session.metadata?.order_id;
                evtCtx.orderId = orderId;

                if (orderId) {
                    const reason = event.type === 'checkout.session.expired'
                        ? 'Stripe: Checkout session expired'
                        : `Stripe: Payment failed — ${session.last_payment_error?.message || 'Unknown'}`;
                    await failOrder(supabaseAdmin, orderId, reason, {
                        providerCode: 'stripe',
                        meta: { stripe_event_type: event.type, stage: 'webhook_received' },
                    });
                }
            }
            // All other event types are acknowledged but ignored.

            res.json({ received: true });
        } catch (err) {
            console.error('[Billing/Stripe] Webhook error:', err);
            logPayEvent(supabaseAdmin, 'payment_webhook_error', 'error',
                `Stripe webhook işleme hatası: ${err.message}`,
                { ...evtCtx, orderId },
                { stage: 'webhook_complete', error_message: err.message });
            if (orderId) await patchOrderFailureNote(supabaseAdmin, orderId, `Stripe webhook error: ${err.message}`);
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
