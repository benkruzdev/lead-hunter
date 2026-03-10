/**
 * shopierService.js — Shopier payment init + callback skeleton.
 *
 * Shopier uses a redirect payment link flow:
 *   1. Backend generates an HMAC-SHA256 signed payment link.
 *   2. User is redirected to Shopier hosted payment page.
 *   3. Shopier POSTs callback to platform_order_id endpoint with status.
 *
 * ⚠️  STATUS: SKELETON — Shopier's public API docs are limited.
 *     The payment link and hash logic here follow Shopier's PHP SDK patterns.
 *     CANNOT be fully tested without live Shopier merchant credentials.
 *     The endpoint structure is complete and will work once valid credentials are set.
 *
 * Required payment_providers fields for shopier:
 *   api_key    → Shopier API ID (Uygulama Kimliği)
 *   secret_key → Shopier API Secret (Uygulama Şifresi)
 */

import crypto from 'crypto';

const SHOPIER_PAYMENT_URL = 'https://www.shopier.com/ShowProduct/api_pay4.php';

/**
 * Generate a Shopier payment redirect URL.
 *
 * @param {object} config   payment_providers row (shopier)
 * @param {object} order    { id, amount, user_email, user_name, user_phone }
 * @returns {{ redirectUrl: string, providerReference: string }}
 */
export function initShopier(config, order) {
    const apiId     = config.api_key;
    const apiSecret = config.secret_key;

    if (!apiId || !apiSecret) {
        throw new Error('Shopier credentials not configured (api_key, secret_key required)');
    }

    const platformOrderId = order.id;
    const amount          = order.amount.toFixed(2);
    const currency        = config.supported_currencies?.[0] || 'TRY';

    // Shopier hash: HMAC-SHA256 of (api_id + amount + platform_order_id + currency)
    const hashData  = `${apiId}${amount}${platformOrderId}${currency}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(hashData).digest('base64');

    const params = new URLSearchParams({
        API_id:            apiId,
        website_index:     '1',
        platform_order_id: platformOrderId,
        product_name:      'Kredi Paketi',
        product_type:      '0',       // 0 = dijital ürün
        buyer_name:        (order.user_name || 'Ad').split(' ').slice(0, -1).join(' ') || 'Ad',
        buyer_surname:     (order.user_name || 'Soyad').split(' ').pop() || 'Soyad',
        buyer_email:       order.user_email || '',
        buyer_account_age: '0',
        buyer_city:        '34',      // İstanbul
        buyer_country:     'TR',
        buyer_phone:       (order.user_phone || '').replace(/\D/g, ''),
        billing_address:   'Türkiye',
        billing_city:      '34',
        billing_country:   'TR',
        currency,
        total_order_value: amount,
        signature,
    });

    return {
        redirectUrl: `${SHOPIER_PAYMENT_URL}?${params.toString()}`,
        providerReference: platformOrderId,
    };
}

/**
 * Verify Shopier callback POST.
 * Shopier sends the same fields back with a recalculated signature.
 *
 * @param {object} config
 * @param {object} body   Callback POST body
 * @returns {boolean}
 */
export function verifyShopierCallback(config, body) {
    const apiId     = config.api_key;
    const apiSecret = config.secret_key;

    if (!apiId || !apiSecret) return false;

    const { platform_order_id, total_order_value, currency, random_nr, signature } = body;
    const hashData = `${apiId}${total_order_value}${platform_order_id}${currency}${random_nr}`;
    const expected = crypto.createHmac('sha256', apiSecret).update(hashData).digest('base64');

    return expected === signature;
}
