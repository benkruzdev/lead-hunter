/**
 * Payment Provider Registry & Config Reader
 *
 * Centralised helper for reading and writing payment_providers table rows.
 * This module runs exclusively on the server side (service-role access).
 * Secret fields (secret_key, webhook_secret) are NEVER forwarded to the client
 * by the public-facing billing endpoint — only admin endpoints expose them.
 *
 * Supported providers:
 *  - paytr         → region: tr
 *  - iyzico        → region: tr
 *  - shopier       → region: tr
 *  - stripe        → region: global
 *  - bank_transfer → region: tr  (IBAN / havale — no gateway, manual approval)
 */

/** Fields that must NEVER be sent to the public checkout endpoint. */
export const SECRET_FIELDS = ['secret_key', 'webhook_secret'];

/** Default seed rows used for bootstrapping if the table is empty. */
export const SEED_PROVIDERS = [
    {
        provider_code: 'paytr',
        display_name: 'PayTR',
        enabled: false,
        mode: 'test',
        region: 'tr',
        supported_currencies: ['TRY'],
        sort_order: 1,
    },
    {
        provider_code: 'iyzico',
        display_name: 'iyzico',
        enabled: false,
        mode: 'test',
        region: 'tr',
        supported_currencies: ['TRY'],
        sort_order: 2,
    },
    {
        provider_code: 'shopier',
        display_name: 'Shopier',
        enabled: false,
        mode: 'test',
        region: 'tr',
        supported_currencies: ['TRY'],
        sort_order: 3,
    },
    {
        provider_code: 'stripe',
        display_name: 'Stripe',
        enabled: false,
        mode: 'test',
        region: 'global',
        supported_currencies: ['USD', 'EUR'],
        sort_order: 4,
    },
    {
        provider_code: 'bank_transfer',
        display_name: 'IBAN / Havale',
        enabled: false,
        mode: 'live',
        region: 'tr',
        supported_currencies: ['TRY'],
        sort_order: 5,
    },
];

/**
 * List payment providers.
 * @param {object} supabase  - supabaseAdmin client
 * @param {object} [opts]
 * @param {string} [opts.region]       - filter by region ('tr' | 'global')
 * @param {boolean} [opts.enabledOnly] - filter to enabled=true providers only
 * @returns {Promise<object[]>}
 */
export async function listProviders(supabase, { region, enabledOnly } = {}) {
    let query = supabase
        .from('payment_providers')
        .select('*')
        .order('sort_order', { ascending: true });

    if (region) query = query.eq('region', region);
    if (enabledOnly) query = query.eq('enabled', true);

    const { data, error } = await query;

    if (error) throw error;

    // Bootstrap: if table exists but has no rows, seed the defaults
    if (!data || data.length === 0) {
        await bootstrapProviders(supabase);
        const { data: seeded, error: seedErr } = await query;
        if (seedErr) throw seedErr;
        return seeded || [];
    }

    return data;
}

/**
 * Get a single provider by code.
 * @param {object} supabase
 * @param {string} code - provider_code
 * @returns {Promise<object|null>}
 */
export async function getProvider(supabase, code) {
    const { data, error } = await supabase
        .from('payment_providers')
        .select('*')
        .eq('provider_code', code)
        .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

/**
 * Upsert (create or update) a payment provider row.
 * Only whitelisted fields are accepted — unknown keys are dropped.
 * @param {object} supabase
 * @param {string} code   - provider_code (used as upsert key)
 * @param {object} fields - partial or full provider fields to set
 * @returns {Promise<object>}
 */
export async function upsertProvider(supabase, code, fields) {
    const ALLOWED = [
        'display_name', 'enabled', 'mode', 'region',
        'supported_currencies', 'merchant_id', 'api_key',
        'secret_key', 'public_key', 'webhook_secret',
        'extra_config', 'sort_order',
        // bank_transfer-specific fields
        'bank_name', 'account_holder', 'iban', 'payment_note',
    ];

    const sanitised = {};
    for (const key of ALLOWED) {
        if (fields[key] !== undefined) sanitised[key] = fields[key];
    }

    sanitised.provider_code = code;
    sanitised.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('payment_providers')
        .upsert(sanitised, { onConflict: 'provider_code' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Strip secret fields from a provider row before returning to public clients.
 * @param {object} provider
 * @returns {object}
 */
export function stripSecrets(provider) {
    const safe = { ...provider };
    for (const field of SECRET_FIELDS) {
        delete safe[field];
    }
    return safe;
}

/**
 * Mask a secret field for admin display:
 * if truthy → '••••••••', if falsy → null.
 * @param {string|null} value
 * @returns {string|null}
 */
export function maskSecret(value) {
    return value ? '••••••••' : null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Insert seed rows for all known providers.
 * Called automatically when the table exists but contains no rows.
 */
async function bootstrapProviders(supabase) {
    const { error } = await supabase
        .from('payment_providers')
        .insert(SEED_PROVIDERS);

    if (error) {
        console.error('[PaymentProviders] Bootstrap failed:', error.message);
    } else {
        console.log('[PaymentProviders] Bootstrapped default provider rows.');
    }
}
