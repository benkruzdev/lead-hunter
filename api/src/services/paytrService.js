/**
 * paytrService.js — PayTR payment init + callback verification skeleton.
 *
 * PayTR uses an iframe or redirect flow:
 *   1. Backend POSTs form data to https://www.paytr.com/odeme/api/get-token
 *      with HMAC-SHA256 signed payload → receives a token.
 *   2. Frontend embeds iFrame: https://www.paytr.com/odeme/guvenli/<token>
 *      OR redirects to PayTR hosted form.
 *   3. PayTR POSTs callback to merchant_ok_url / merchant_fail_url
 *      with status + hash for verification.
 *
 * ⚠️  STATUS: SKELETON — Token generation and callback verification logic
 *     are implemented correctly per PayTR docs, but CANNOT be fully tested
 *     without live PayTR merchant credentials.  The endpoint structure is
 *     complete and will work once valid credentials are set in admin panel.
 *
 * Required payment_providers fields for paytr:
 *   merchant_id      → PayTR Mağaza No
 *   api_key          → PayTR API Anahtarı (merchant_key)
 *   secret_key       → PayTR Gizli Anahtar (merchant_salt)
 */

import crypto from 'crypto';

const PAYTR_API_URL = 'https://www.paytr.com/odeme/api/get-token';

/**
 * Initiate a PayTR payment and return the iframe token.
 *
 * @param {object} config    Row from payment_providers (paytr)
 * @param {object} order     { id, amount, currency, user_id, user_email, user_ip, user_name, user_phone }
 * @param {string} callbackUrl  Your backend callback URL (merchant_ok_url / merchant_fail_url)
 * @returns {{ token: string, iframeUrl: string }}
 */
export async function initPayTR(config, order, callbackUrl) {
    const merchantId   = config.merchant_id;
    const merchantKey  = config.api_key;          // PayTR "API Anahtarı"
    const merchantSalt = config.secret_key;       // PayTR "Gizli Anahtar"

    if (!merchantId || !merchantKey || !merchantSalt) {
        throw new Error('PayTR credentials not configured (merchant_id, api_key, secret_key required)');
    }

    const merchantOid   = String(order.id).replace(/-/g, '').slice(0, 64); // max 64 chars, no hyphens
    const paymentAmount = String(Math.round(order.amount * 100));           // kuruş
    const currency      = config.supported_currencies?.[0] || 'TL';
    const testMode      = config.mode === 'test' ? '1' : '0';

    // basket: JSON array [[name, price, qty], ...]
    const basketItems = JSON.stringify([[`Kredi paketi #${order.id.slice(0, 8)}`, paymentAmount, 1]]);
    const basketBase64 = Buffer.from(basketItems).toString('base64');

    // HMAC payload as per PayTR docs
    const hashStr = `${merchantId}${order.user_ip}${merchantOid}${paymentAmount}${currency}${testMode}${basketBase64}${merchantSalt}`;
    const paytrToken = crypto.createHmac('sha256', merchantKey).update(hashStr).digest('base64');

    const postData = new URLSearchParams({
        merchant_id:    merchantId,
        user_ip:        order.user_ip || '127.0.0.1',
        merchant_oid:   merchantOid,
        email:          order.user_email || '',
        payment_amount: paymentAmount,
        paytr_token:    paytrToken,
        user_basket:    basketBase64,
        debug_on:       testMode === '1' ? '1' : '0',
        no_installment: '1',
        max_installment:'0',
        user_name:      order.user_name || '',
        user_address:   '',
        user_phone:     order.user_phone || '',
        merchant_ok_url:  callbackUrl + '?result=success',
        merchant_fail_url:callbackUrl + '?result=fail',
        timeout_limit:  '30',
        currency,
        test_mode: testMode,
        lang: 'tr',
    });

    const response = await fetch(PAYTR_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postData.toString(),
    });

    const json = await response.json();

    if (json.status !== 'success') {
        throw new Error(`PayTR token error: ${json.reason || JSON.stringify(json)}`);
    }

    return {
        token: json.token,
        iframeUrl: `https://www.paytr.com/odeme/guvenli/${json.token}`,
        providerReference: merchantOid,
    };
}

/**
 * Verify PayTR callback POST hash.
 * Returns true if the callback is authentic.
 *
 * @param {object} config   payment_providers row (paytr)
 * @param {object} body     Raw POST body from PayTR callback
 */
export function verifyPayTRCallback(config, body) {
    const merchantKey  = config.api_key;
    const merchantSalt = config.secret_key;

    if (!merchantKey || !merchantSalt) return false;

    const { merchant_oid, status, total_amount, hash } = body;
    const hashStr = `${merchantSalt}${merchant_oid}${total_amount}${status}${merchantKey}`;
    const expected = crypto.createHmac('sha256', merchantKey).update(hashStr).digest('base64');

    return expected === hash;
}

/**
 * Parse the merchant_oid back to an order UUID.
 * (We stripped hyphens on init — just add them back)
 */
export function paytrOidToOrderId(oid) {
    // Format: 8-4-4-4-12
    if (!oid || oid.length < 32) return oid;
    const h = oid.slice(0, 32);
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}
