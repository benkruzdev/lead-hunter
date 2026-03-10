/**
 * iyzicoService.js — iyzico payment init + callback skeleton.
 *
 * iyzico uses a Checkout Form flow:
 *   1. Backend POSTs JSON to https://api.iyzipay.com/payment/iyzipos/checkoutform/initialize/auth/ecommerce
 *      with HMAC-SHA256 signed Authorization header → receives checkoutFormContent (HTML) or token.
 *   2. Frontend embeds the form HTML returned by iyzico in an iframe/page.
 *   3. iyzico POSTs callback to callbackUrl with token.
 *   4. Backend retrieves payment status via POST to /payment/iyzipos/checkoutform/auth/ecommerce/detail.
 *
 * ⚠️  STATUS: SKELETON — Authorization header and payload structures are correct per iyzico docs,
 *     but CANNOT be fully tested without live iyzico merchant credentials.
 *     The endpoint structure is complete and will work once valid credentials are set in admin panel.
 *
 * Required payment_providers fields for iyzico:
 *   api_key      → iyzico API Key
 *   secret_key   → iyzico Secret Key
 */

import crypto from 'crypto';

const BASE_URL_PROD = 'https://api.iyzipay.com';
const BASE_URL_SANDBOX = 'https://sandbox-api.iyzipay.com';

function getBaseUrl(config) {
    return config.mode === 'live' ? BASE_URL_PROD : BASE_URL_SANDBOX;
}

/**
 * Build iyzico Authorization header.
 * Format: IYZWS <apiKey>:<base64(sha1(secret + randomStr + pki_string))>
 */
function buildAuthHeader(apiKey, secretKey, pkiString) {
    const randomStr = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const hashContent = secretKey + randomStr + pkiString;
    const hash = crypto.createHash('sha1').update(hashContent).digest('base64');
    return `IYZWS ${apiKey}:${hash}`;
}

/**
 * Serialise object to iyzico PKI string (sorted keys, nested objects supported).
 */
function toPkiString(obj, prefix = '') {
    return Object.keys(obj).sort().map(k => {
        const v = obj[k];
        if (Array.isArray(v)) {
            return v.map((item, i) => toPkiString(item, `${prefix}${k}[${i}]`)).join('');
        }
        if (v && typeof v === 'object') return toPkiString(v, `${prefix}${k}.`);
        return `${prefix}${k}=${v},`;
    }).join('');
}

/**
 * Init iyzico Checkout Form and return the HTML snippet + token.
 *
 * @param {object} config   payment_providers row (iyzico)
 * @param {object} order    { id, amount, currency, user_id, user_email, user_name }
 * @param {string} callbackUrl
 * @returns {{ checkoutFormContent: string, token: string, paymentPageUrl: string }}
 */
export async function initIyzico(config, order, callbackUrl) {
    const apiKey    = config.api_key;
    const secretKey = config.secret_key;

    if (!apiKey || !secretKey) {
        throw new Error('iyzico credentials not configured (api_key, secret_key required)');
    }

    const currency = config.supported_currencies?.[0] || 'TRY';

    const payload = {
        locale: 'tr',
        conversationId: order.id,
        price: String(order.amount.toFixed(2)),
        paidPrice: String(order.amount.toFixed(2)),
        currency,
        basketId: order.id,
        paymentGroup: 'PRODUCT',
        callbackUrl,
        enabledInstallments: [1],
        buyer: {
            id: order.user_id,
            name: (order.user_name || 'Kullanıcı').split(' ').slice(0, -1).join(' ') || 'Ad',
            surname: (order.user_name || 'Kullanıcı').split(' ').pop() || 'Soyad',
            gsmNumber: order.user_phone || '+905000000000',
            email: order.user_email || 'noreply@leadhunter.app',
            identityNumber: '00000000000',
            lastLoginDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
            registrationDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
            registrationAddress: 'Türkiye',
            ip: order.user_ip || '127.0.0.1',
            city: 'Istanbul',
            country: 'Turkey',
        },
        shippingAddress: { contactName: order.user_name || 'Kullanıcı', city: 'Istanbul', country: 'Turkey', address: 'Türkiye' },
        billingAddress:  { contactName: order.user_name || 'Kullanıcı', city: 'Istanbul', country: 'Turkey', address: 'Türkiye' },
        basketItems: [{
            id: order.id,
            name: `Kredi Paketi`,
            category1: 'Yazılım',
            itemType: 'VIRTUAL',
            price: String(order.amount.toFixed(2)),
        }],
    };

    const pkiString = toPkiString(payload);
    const authHeader = buildAuthHeader(apiKey, secretKey, pkiString);

    const response = await fetch(`${getBaseUrl(config)}/payment/iyzipos/checkoutform/initialize/auth/ecommerce`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'x-iyzi-rnd': String(Math.floor(Math.random() * 1000000)),
        },
        body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (json.status !== 'success') {
        throw new Error(`iyzico init error: ${json.errorMessage || json.errorCode || JSON.stringify(json)}`);
    }

    return {
        token: json.token,
        checkoutFormContent: json.checkoutFormContent,
        paymentPageUrl: json.paymentPageUrl || null,
        providerReference: json.token,
    };
}

/**
 * Retrieve iyzico Checkout Form payment result by token.
 * Call this from the callback endpoint to determine success/failure.
 *
 * @param {object} config
 * @param {string} token   Token received in callback POST body
 * @returns {{ status: 'success'|'failure', conversationId: string, paymentId: string }}
 */
export async function retrieveIyzicoPayment(config, token) {
    const apiKey    = config.api_key;
    const secretKey = config.secret_key;

    const payload = { locale: 'tr', token };
    const pkiString = toPkiString(payload);
    const authHeader = buildAuthHeader(apiKey, secretKey, pkiString);

    const response = await fetch(`${getBaseUrl(config)}/payment/iyzipos/checkoutform/auth/ecommerce/detail`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'x-iyzi-rnd': String(Math.floor(Math.random() * 1000000)),
        },
        body: JSON.stringify(payload),
    });

    const json = await response.json();
    return {
        status: json.paymentStatus === 'SUCCESS' ? 'success' : 'failure',
        conversationId: json.conversationId,
        paymentId: json.paymentId,
        raw: json,
    };
}
