/**
 * stripeService.js — Stripe Checkout Session init + webhook skeleton.
 *
 * Stripe uses a Checkout Session redirect flow:
 *   1. Backend creates a Checkout Session → returns session.url.
 *   2. Frontend redirects user to stripe session.url.
 *   3. Stripe redirects back to success_url / cancel_url.
 *   4. Stripe POSTs webhook event to /api/billing/webhook/stripe.
 *      We listen for `checkout.session.completed`.
 *
 * ⚠️  STATUS: SKELETON — Correct Stripe implementation but requires:
 *     a) `npm install stripe` in api/
 *     b) Valid Stripe API key and Webhook Secret set in admin panel.
 *
 * Required payment_providers fields for stripe:
 *   secret_key     → Stripe Secret Key (sk_live_... or sk_test_...)
 *   webhook_secret → Stripe Webhook Signing Secret (whsec_...)
 *   public_key     → Stripe Publishable Key (pk_... — for frontend display only)
 *
 * Stripe region: GLOBAL only — do NOT use for TR checkout.
 */

/**
 * Lazily load the Stripe SDK.
 * Throws a clear error if `stripe` npm package is not installed.
 */
async function getStripe(secretKey) {
    let Stripe;
    try {
        const mod = await import('stripe');
        Stripe = mod.default || mod;
    } catch {
        throw new Error(
            'Stripe npm package is not installed. Run `npm install stripe` in the api/ directory.'
        );
    }
    return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

/**
 * Create a Stripe Checkout Session.
 *
 * @param {object} config   payment_providers row (stripe)
 * @param {object} order    { id, amount, currency, user_email }
 * @param {string} successUrl  Frontend redirect after success (include ?session_id={CHECKOUT_SESSION_ID})
 * @param {string} cancelUrl   Frontend redirect after cancel
 * @returns {{ sessionId: string, sessionUrl: string, providerReference: string }}
 */
export async function initStripe(config, order, successUrl, cancelUrl) {
    const secretKey = config.secret_key;

    if (!secretKey || secretKey === '••••••••') {
        throw new Error('Stripe secret_key not configured');
    }

    const stripe   = await getStripe(secretKey);
    const currency = (config.supported_currencies?.[0] || 'usd').toLowerCase();
    const amount   = Math.round(order.amount * 100); // Stripe uses smallest currency unit

    const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: order.user_email || undefined,
        line_items: [{
            price_data: {
                currency,
                product_data: { name: 'Kredi Paketi' },
                unit_amount: amount,
            },
            quantity: 1,
        }],
        metadata: { order_id: order.id },
        success_url: successUrl,
        cancel_url:  cancelUrl,
    });

    return {
        sessionId:         session.id,
        sessionUrl:        session.url,
        providerReference: session.id,
    };
}

/**
 * Verify and parse a Stripe webhook event.
 * Must be called with the raw request body (Buffer), not parsed JSON.
 *
 * @param {object} config        payment_providers row (stripe)
 * @param {Buffer} rawBody       Raw request body
 * @param {string} signatureHeader  Value of 'stripe-signature' header
 * @returns {object}  Stripe event object
 */
export async function verifyStripeWebhook(config, rawBody, signatureHeader) {
    const secretKey    = config.secret_key;
    const webhookSecret = config.webhook_secret;

    if (!secretKey || !webhookSecret) {
        throw new Error('Stripe credentials not configured (secret_key, webhook_secret required)');
    }

    const stripe = await getStripe(secretKey);

    // constructEvent throws if signature is invalid
    const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
    return event;
}
