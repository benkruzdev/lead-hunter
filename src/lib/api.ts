import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_ROUTE_SECRET;

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Rejects after `ms` milliseconds with a user-friendly timeout error (status 408).
 * Returns a cleanup handle so the timer can be cancelled on success.
 */
function makeTimeoutPromise(ms: number): { promise: Promise<never>; cancel: () => void } {
    let timerId: ReturnType<typeof setTimeout>;
    const promise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
            const err = new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.') as any;
            err.status = 408;
            reject(err);
        }, ms);
    });
    return { promise, cancel: () => clearTimeout(timerId!) };
}

/**
 * Deduplicates concurrent supabase.auth.getSession() calls.
 *
 * When multiple apiRequest() calls fire simultaneously (e.g. load-more +
 * profile refresh + credits refresh) each one was starting its own
 * getSession() round-trip. Supabase serialises these internally, so the
 * second and third calls queue behind the first and can exhaust the timeout
 * window before they even reach the network.
 *
 * Solution: share one in-flight promise across all concurrent callers.
 * The promise is nulled after it settles so the next batch always gets
 * a fresh call.
 */
let inFlightGetSession: Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>> | null = null;

function getSessionOnce() {
    if (!inFlightGetSession) {
        inFlightGetSession = supabase.auth.getSession().finally(() => {
            inFlightGetSession = null;
        });
    }
    return inFlightGetSession;
}

/**
 * Make authenticated API request to backend.
 * - getSession() is deduped: concurrent calls share one in-flight promise.
 * - getSession() is raced against REQUEST_TIMEOUT_MS (per-caller).
 * - The fetch itself keeps its own AbortController so the in-flight network
 *   request is genuinely cancelled (not just ignored on the JS side).
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    console.debug('[DEBUG][apiRequest] start', { endpoint, method });

    // ── 1. getSession with timeout (deduped) ────────────────────────────────
    console.debug('[DEBUG][apiRequest] getSession:start', { endpoint, reuse: !!inFlightGetSession });
    const sessionTimeout = makeTimeoutPromise(REQUEST_TIMEOUT_MS);
    let session: any;
    try {
        const result = await Promise.race([
            getSessionOnce(),
            sessionTimeout.promise,
        ]);
        session = result.data.session;
        console.debug('[DEBUG][apiRequest] getSession:done', { endpoint, hasSession: !!session });
    } finally {
        sessionTimeout.cancel();
    }


    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // ── 2. fetch with AbortController (genuine network cancel) ──────────────
    const fullUrl = `${API_URL}${endpoint}`;
    console.debug('[DEBUG][apiRequest] fetch:start', { url: fullUrl, method });

    const controller = new AbortController();
    const fetchTimeout = makeTimeoutPromise(REQUEST_TIMEOUT_MS);
    const abortOnTimeout = fetchTimeout.promise.catch((err) => {
        console.warn('[DEBUG][apiRequest] fetch:timeout — aborting', { url: fullUrl });
        controller.abort();
        throw err;
    });

    let response: Response;
    try {
        response = await Promise.race([
            fetch(fullUrl, {
                ...options,
                headers,
                signal: controller.signal,
            }),
            abortOnTimeout,
        ]);
        console.debug('[DEBUG][apiRequest] fetch:done', { url: fullUrl, status: response.status, ok: response.ok });
    } catch (e: any) {
        if (e?.name === 'AbortError' || e?.status === 408) {
            console.warn('[DEBUG][apiRequest] fetch:aborted/timeout', { url: fullUrl, name: e?.name, status: e?.status });
            const err = new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.') as any;
            err.status = 408;
            throw err;
        }
        console.warn('[DEBUG][apiRequest] fetch:error', { url: fullUrl, name: e?.name, message: e?.message });
        throw e;
    } finally {
        fetchTimeout.cancel();
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({
            error: 'Request failed',
            message: response.statusText,
        }));
        console.warn('[DEBUG][apiRequest] response:non-ok', { url: fullUrl, status: response.status, error: error.error, message: error.message });
        const err = new Error(error.message || error.error || 'Request failed') as any;
        err.status = response.status;
        if (error.required !== undefined) err.required = error.required;
        if (error.available !== undefined) err.available = error.available;
        throw err;
    }

    const data = await response.json();
    console.debug('[DEBUG][apiRequest] complete', { endpoint, status: response.status });
    return data;
}


/**
 * Enrich lead list item with email and social links
 * PRODUCT_SPEC 5.7: 1 credit per successful enrichment
 */
export async function enrichLeadListItem(listId: string, itemId: string): Promise<{
    status: 'success' | 'failed';
    email: string | null;
    social_links: Record<string, string>;
    creditSpent: number;
}> {
    return apiRequest(`/api/lists/${listId}/items/${itemId}/enrich`, {
        method: 'POST',
    });
}

/**
 * Create export
 * PRODUCT_SPEC 5.8: Export lead lists as CSV or XLSX
 */
export async function createExport(
    listId: string,
    format: 'csv' | 'xlsx',
    note?: string,
    scope?: 'compact' | 'full',
    fileName?: string,
    leadCount?: number,
): Promise<{
    exportId: string;
    downloadUrl: string;
    fileName: string;
    leadCount: number;
}> {
    return apiRequest(`/api/exports`, {
        method: 'POST',
        body: JSON.stringify({ listId, format, note, scope, fileName, leadCount }),
    });
}

/**
 * Get user's export history
 */
export async function getExports(): Promise<{
    exports: Array<{
        id: string;
        listId: string;
        listName: string;
        format: string;
        scope?: string;
        fileName: string;
        leadCount: number;
        note: string | null;
        createdAt: string;
    }>;
}> {
    return apiRequest('/api/exports');
}

/**
 * Get download URL for an export
 */
export async function downloadExport(exportId: string): Promise<{
    downloadUrl: string;
    fileName: string;
}> {
    return apiRequest(`/api/exports/${exportId}/download`);
}



/**
 * Get current user's profile
 * GET /api/auth/profile
 */
export async function getProfile() {
    return apiRequest<{
        profile: {
            id: string;
            full_name: string | null;
            phone: string | null;
            plan: string;
            credits: number;
            role: string;
            is_active: boolean;
            onboarding_completed: boolean;
            email: string | null;
            created_at: string;
            updated_at: string;
        };
    }>('/api/auth/profile');
}

/**
 * Update user's profile
 * PATCH /api/auth/profile
 */
export async function updateProfile(data: {
    full_name?: string;
    phone?: string;
    onboarding_completed?: boolean;
}) {
    return apiRequest<{
        success: boolean;
        profile: any;
    }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}


/**
 * Get current credit balance
 * GET /api/credits/balance
 */
export async function getCredits() {
    return apiRequest<{
        credits: number;
    }>('/api/credits/balance');
}

/**
 * Get credit transaction history
 * GET /api/credits/history
 */
export async function getCreditHistory(limit = 50) {
    return apiRequest<{
        transactions: Array<{
            id: string;
            user_id: string;
            amount: number;
            type: string;
            description: string | null;
            created_at: string;
        }>;
    }>(`/api/credits/history?limit=${limit}`);
}

/**
 * Deduct credits (called by backend operations like search, add to list)
 * POST /api/credits/deduct
 */
export async function deductCredits(data: {
    amount: number;
    type: string;
    description?: string;
}) {
    return apiRequest<{
        success: boolean;
        charged: number;
        message: string;
    }>('/api/credits/deduct', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Verify JWT token
 * POST /api/auth/verify
 */
export async function verifyToken(token: string) {
    return apiRequest<{
        valid: boolean;
        user: {
            id: string;
            email: string;
        };
    }>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
    });
}

/**
 * Get admin configuration (admin only)
 * GET /api/${ADMIN_SECRET}/admin/config
 */
export async function getAdminConfig() {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured. Admin panel cannot function.');
    }
    return apiRequest<{
        config: {
            id: number;
            recaptcha_enabled: boolean;
            recaptcha_site_key: string | null;
            recaptcha_secret_key: string | null;
            google_oauth_enabled: boolean;
            google_client_id: string | null;
            google_client_secret: string | null;
            google_maps_api_key: string | null;
            updated_at: string;
        };
    }>(`/api/${ADMIN_SECRET}/admin/config`);
}

/**
 * Update admin configuration (admin only)
 * PATCH /api/${ADMIN_SECRET}/admin/config
 */
export async function updateAdminConfig(data: {
    recaptcha_enabled?: boolean;
    recaptcha_site_key?: string;
    recaptcha_secret_key?: string;
    google_oauth_enabled?: boolean;
    google_client_id?: string;
    google_client_secret?: string;
    google_maps_api_key?: string;
}) {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured. Admin panel cannot function.');
    }
    return apiRequest<{
        success: boolean;
        config: any;
    }>(`/api/${ADMIN_SECRET}/admin/config`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

/**
 * Get admin system settings — credit rules & plan defaults (admin only)
 * GET /api/${ADMIN_SECRET}/admin/system-settings
 */
export async function getAdminSystemSettings(): Promise<{
    settings: {
        credits_per_page: number | null;
        credits_per_enrichment: number | null;
        credits_per_lead: number | null;
        new_user_credits: number | null;
    };
}> {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    }
    return apiRequest(`/api/${ADMIN_SECRET}/admin/system-settings`);
}

/**
 * Update admin system settings — credit rules & plan defaults (admin only)
 * PATCH /api/${ADMIN_SECRET}/admin/system-settings
 */
export async function updateAdminSystemSettings(data: {
    credits_per_page?: number;
    credits_per_enrichment?: number;
    credits_per_lead?: number;
    new_user_credits?: number;
}): Promise<{ success: boolean; settings: any }> {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    }
    return apiRequest(`/api/${ADMIN_SECRET}/admin/system-settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

/**
 * Get admin cost/usage summary (admin only)
 * GET /api/${ADMIN_SECRET}/admin/costs
 */
export async function getAdminCosts(): Promise<{
    usage: {
        sessions_30d: number;
        total_sessions: number;
        total_page_views_30d: number;
        paid_page_views_30d: number;
        sessions_with_min_reviews_30d: number;
        exports_30d: number;
        total_exports: number;
        leads_exported_30d: number;
    };
    places_estimates: {
        text_search_calls_30d: number;
        place_details_calls_30d: number;
        details_from_first_pages: number;
        details_from_paid_pages: number;
        details_from_min_reviews_filter: number;
        cost_text_search_usd: number;
        cost_details_usd: number;
        cost_total_usd: number;
        cost_free_surface_usd: number;
        cost_paid_surface_usd: number;
        price_text_search_usd: number;
        price_details_usd: number;
    };
    credits: {
        per_page: number;
        per_enrichment: number;
        issued_30d: number;
        consumed_30d: number;
        sold_30d: number;
        revenue_try_30d: number;
        pending_orders: number;
    };
    daily_breakdown: Array<{
        date: string;
        searches: number;
        exports: number;
        leads_exported: number;
        est_text_search_calls: number;
        est_details_calls: number;
        est_cost_usd: number;
    }>;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/costs`);
}

/**
 * Get admin order/payment records (admin only)
 * GET /api/${ADMIN_SECRET}/admin/payments
 */
export async function getAdminPayments(params?: {
    limit?: number;
    offset?: number;
    query?: string;
    status?: string;
}): Promise<{
    orders: Array<{
        id: string;
        user_id: string;
        user_name: string | null;
        user_email: string | null;
        package_name: string | null;
        payment_method: string;
        provider_reference: string | null;
        checkout_url: string | null;
        amount: number;
        currency: string;
        credits: number;
        status: string;
        failure_reason: string | null;
        failure_code: string | null;
        last_payment_event_at: string | null;
        created_at: string;
    }>;
    total: number;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.query) q.set('query', params.query);
    if (params?.status) q.set('status', params.status);
    return apiRequest(`/api/${ADMIN_SECRET}/admin/payments?${q.toString()}`);
}

/**
 * Get payment lifecycle events for a specific order (admin only)
 * GET /api/${ADMIN_SECRET}/admin/payments/:orderId/events
 */
export async function getAdminOrderEvents(orderId: string): Promise<{
    events: Array<{
        id: string;
        level: string;
        source: string;
        event_type: string;
        message: string;
        metadata: Record<string, unknown>;
        created_at: string;
    }>;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/payments/${orderId}/events`);
}

/**
 * Complete a pending order (admin only)
 * POST /api/${ADMIN_SECRET}/admin/payments/:orderId/complete
 */
export async function completeAdminOrder(orderId: string): Promise<{
    success: boolean;
    order_id: string;
    user_id: string;
    credits_added: number;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/payments/${orderId}/complete`, {
        method: 'POST',
    });
}

/**
 * Reject a pending order (admin only)
 * POST /api/${ADMIN_SECRET}/admin/payments/:orderId/reject
 */
export async function rejectAdminOrder(orderId: string): Promise<{
    success: boolean;
    order_id: string;
    user_id: string;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/payments/${orderId}/reject`, {
        method: 'POST',
    });
}

/**
 * Get admin export records (admin only)
 * GET /api/${ADMIN_SECRET}/admin/exports
 */
export async function getAdminExports(params?: {
    limit?: number;
    offset?: number;
    query?: string;
}): Promise<{
    exports: Array<{
        id: string;
        user_id: string;
        user_name: string | null;
        user_email: string | null;
        list_name: string | null;
        format: string;
        file_name: string;
        lead_count: number;
        note: string | null;
        created_at: string;
    }>;
    total: number;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.query) q.set('query', params.query);
    return apiRequest(`/api/${ADMIN_SECRET}/admin/exports?${q.toString()}`);
}

/**
 * Get admin search session logs (admin only)
 * GET /api/${ADMIN_SECRET}/admin/search-logs
 */
export async function getAdminSearchLogs(params?: {
    limit?: number;
    offset?: number;
    query?: string;
}): Promise<{
    logs: Array<{
        id: string;
        user_id: string;
        user_name: string | null;
        user_email: string | null;
        province: string | null;
        district: string | null;
        category: string | null;
        keyword: string | null;
        min_rating: number | null;
        min_reviews: number | null;
        total_results: number;
        pages_viewed: number;
        created_at: string;
    }>;
    total: number;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.query) q.set('query', params.query);
    return apiRequest(`/api/${ADMIN_SECRET}/admin/search-logs?${q.toString()}`);
}

/**
 * Get credit transaction ledger (admin only)
 * GET /api/${ADMIN_SECRET}/admin/credits/ledger
 */
export async function getAdminCreditsLedger(params?: {
    limit?: number;
    offset?: number;
    user_id?: string;
}): Promise<{
    transactions: Array<{
        id: string;
        user_id: string;
        user_name: string | null;
        user_email: string | null;
        amount: number;
        type: string;
        description: string | null;
        created_at: string;
    }>;
    total: number;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.user_id) q.set('user_id', params.user_id);
    return apiRequest(`/api/${ADMIN_SECRET}/admin/credits/ledger?${q.toString()}`);
}

/**
 * Get system event log from system_events table (admin only)
 * GET /api/${ADMIN_SECRET}/admin/system-logs
 */
export async function getAdminSystemLogs(params?: {
    limit?: number;
    offset?: number;
    event_type?: string;
}): Promise<{
    events: Array<{
        id: string;
        level: 'info' | 'warn' | 'error' | 'success';
        source: string;
        event_type: string;
        actor_user_id: string | null;
        actor_name: string | null;
        actor_email: string | null;
        subject_user_id: string | null;
        subject_name: string | null;
        subject_email: string | null;
        target_type: string | null;
        target_id: string | null;
        message: string;
        credit_delta: number | null;
        metadata: Record<string, unknown>;
        created_at: string;
    }>;
    total: number;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.event_type) q.set('event_type', params.event_type);
    return apiRequest(`/api/${ADMIN_SECRET}/admin/system-logs?${q.toString()}`);
}

/**
 * Manually adjust credits for a user (admin only)
 * POST /api/${ADMIN_SECRET}/admin/credits/adjust
 */
export async function adjustAdminUserCredits(data: {
    user_id: string;
    amount: number;
    description?: string;
}): Promise<{
    success: boolean;
    user_id: string;
    previous_balance: number;
    adjustment: number;
    new_balance: number;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/credits/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Get admin dashboard metrics (admin only)
 * GET /api/${ADMIN_SECRET}/admin/dashboard
 */
export async function getAdminDashboard() {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured. Admin panel cannot function.');
    }
    return apiRequest<{
        total_users: number;
        daily_search_count: number;
        daily_credits_spent: number;
        daily_exports_count: number;
    }>(`/api/${ADMIN_SECRET}/admin/dashboard`);
}

/**
 * Get admin users list (admin only)
 * GET /api/${ADMIN_SECRET}/admin/users
 */
export async function getAdminUsers(params?: { query?: string; limit?: number; offset?: number }) {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured. Admin panel cannot function.');
    }
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set('query', params.query);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const url = `/api/${ADMIN_SECRET}/admin/users${queryString ? `?${queryString}` : ''}`;

    return apiRequest<{
        users: Array<{
            id: string;
            email: string | null;
            full_name: string;
            phone: string | null;
            plan: string;
            credits: number;
            status: boolean;
            role: string;
            created_at: string;
            updated_at: string | null;
            last_sign_in_at: string | null;
            last_login_ip: string | null;
        }>;
        total: number;
    }>(url);
}

/**
 * Get single admin user (admin only)
 * GET /api/${ADMIN_SECRET}/admin/users/:id
 */
export async function getAdminUser(id: string) {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured. Admin panel cannot function.');
    }
    return apiRequest<{
        id: string;
        email: string | null;
        full_name: string;
        phone: string | null;
        plan: string;
        credits: number;
        status: boolean;
        role: string;
        created_at: string;
        updated_at: string | null;
        last_sign_in_at: string | null;
        last_login_ip: string | null;
    }>(`/api/${ADMIN_SECRET}/admin/users/${id}`);
}

/**
 * Get user activity summary (admin only)
 * GET /api/${ADMIN_SECRET}/admin/users/:id/activity
 */
export async function getAdminUserActivity(id: string): Promise<{
    stats: {
        total_searches: number;
        searches_30d: number;
        total_exports: number;
        last_search_at: string | null;
        last_export_at: string | null;
        last_order_at: string | null;
        last_credit_at: string | null;
        pending_orders: number;
    };
    recent_searches: Array<{
        id: string;
        province: string | null;
        district: string | null;
        category: string | null;
        keyword: string | null;
        total_results: number | null;
        created_at: string;
    }>;
    recent_exports: Array<{
        id: string;
        list_name: string | null;
        format: string;
        lead_count: number;
        created_at: string;
    }>;
    recent_orders: Array<{
        id: string;
        payment_method: string;
        amount: number;
        currency: string;
        credits: number;
        status: string;
        package_name: string | null;
        created_at: string;
    }>;
    recent_ledger: Array<{
        id: string;
        amount: number;
        type: string;
        description: string | null;
        created_at: string;
    }>;
}> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/users/${id}/activity`);
}


/**
 * Update admin user (admin only)
 * PATCH /api/${ADMIN_SECRET}/admin/users/:id
 */
export async function updateAdminUser(id: string, data: {
    plan?: string;
    credits?: number;
    status?: boolean;
    role?: string;
}) {
    if (!ADMIN_SECRET) {
        throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured. Admin panel cannot function.');
    }
    return apiRequest<any>(`/api/${ADMIN_SECRET}/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

/**
 * Register new user with reCAPTCHA verification
 * POST /api/auth/register
 */
export async function registerUser(data: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    recaptchaToken: string;
}) {
    return apiRequest<{
        success: boolean;
        message: string;
        user: {
            id: string;
            email: string;
        };
    }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}


// ============================================================================
// SEARCH API (Phase 4 PR4)
// ============================================================================

export interface SearchParams {
    province: string;
    district?: string;
    category: string;
    keyword?: string;
    minRating?: number;
    minReviews?: number;
    sessionId?: string;
}

export interface SearchResult {
    id: string;
    name: string;
    category: string;
    district: string;
    rating: number;
    reviews: number;
    phone: string | null;
    website: string | null;
    address: string | null;
}

export interface SearchResponse {
    sessionId: string;
    results: SearchResult[];
    totalResults: number;
    currentPage: number;
}

export interface SearchPageResponse {
    results: SearchResult[];
    currentPage: number;
    totalResults: number;
    creditCost: number;
    alreadyViewed: boolean;
}

/**
 * Perform search (0 credits - initial search is free)
 * POST /api/search
 */
export async function performSearch(params: SearchParams): Promise<SearchResponse> {
    return apiRequest<SearchResponse>('/api/search', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

/**
 * Get specific page of search results
 * GET /api/search/:sessionId/page/:pageNumber
 * 
 * Cost:
 * - 10 credits if page not viewed before
 * - 0 credits if page already viewed
 * 
 * Throws 402 error if insufficient credits:
 * {
 *   error: 'Insufficient credits',
 *   message: 'Yeterli krediniz yok',
 *   required: 10,
 *   available: 5
 * }
 */
export async function getSearchPage(
    sessionId: string,
    pageNumber: number
): Promise<SearchPageResponse> {
    return apiRequest<SearchPageResponse>(
        `/api/search/${sessionId}/page/${pageNumber}`
    );
}

// ============================================================================
// SEARCH SESSIONS API (Section 5.4)
// ============================================================================

export interface SearchSession {
    id: string;
    province: string;
    district: string | null;
    category: string;
    keyword: string | null;
    min_rating: number | null;
    min_reviews: number | null;
    total_results: number;
    viewed_pages: number[];
    created_at: string;
    expires_at: string;
}

/**
 * Get user's search sessions (PRODUCT_SPEC 5.4 - Search History)
 * GET /api/search/sessions
 */
export async function getSearchSessions(): Promise<{ sessions: SearchSession[] }> {
    return apiRequest<{ sessions: SearchSession[] }>('/api/search/sessions');
}

/**
 * Get specific session detail (PRODUCT_SPEC 5.4 - Continue search)
 * GET /api/search/sessions/:sessionId
 */
export async function getSearchSession(sessionId: string): Promise<{ session: SearchSession }> {
    return apiRequest<{ session: SearchSession }>(`/api/search/sessions/${sessionId}`);
}

/**
 * Get current credit costs from system_settings for UI display
 * GET /api/search/credit-cost
 */
export async function getSearchCreditCost(): Promise<{
    credits_per_page: number;
    credits_per_enrichment: number;
    credits_per_lead: number;
}> {
    return apiRequest('/api/search/credit-cost');
}

// ============================================================================
// ADMIN CACHE MANAGEMENT API
// ============================================================================

export interface QueryCacheEntry {
    query_key: string;
    province: string | null;
    district: string | null;
    category: string | null;
    keyword: string | null;
    min_rating: number | null;
    min_reviews: number | null;
    total_results: number;
    created_at: string;
    expires_at: string;
    hit_count: number;
}

export interface PlaceCacheEntry {
    place_id: string;
    name: string | null;
    phone: string | null;
    website: string | null;
    cached_at: string;
    expires_at: string;
    hit_count: number;
}

export interface CacheStats {
    query_cache_count: number;
    place_cache_count: number;
    query_cache_expired: number;
    place_cache_expired: number;
    total_query_hits: number;
    total_place_hits: number;
}

export async function getAdminCacheStats(): Promise<CacheStats> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/cache/stats`);
}

export async function getAdminQueryCache(params?: { limit?: number; offset?: number }): Promise<{ entries: QueryCacheEntry[]; total: number }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiRequest(`/api/${ADMIN_SECRET}/admin/cache/queries?${q.toString()}`);
}

export async function deleteAdminQueryCacheEntry(key: string): Promise<{ success: boolean }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/cache/queries/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

export async function deleteAdminQueryCache(body: { mode: 'selected' | 'expired' | 'all'; keys?: string[] }): Promise<{ success: boolean; deleted: number }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/cache/queries`, {
        method: 'DELETE',
        body: JSON.stringify(body),
    });
}

export async function getAdminPlaceCache(params?: { limit?: number; offset?: number }): Promise<{ entries: PlaceCacheEntry[]; total: number }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiRequest(`/api/${ADMIN_SECRET}/admin/cache/places?${q.toString()}`);
}

export async function deleteAdminPlaceCacheEntry(placeId: string): Promise<{ success: boolean }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/cache/places/${encodeURIComponent(placeId)}`, { method: 'DELETE' });
}

export async function deleteAdminPlaceCache(body: { mode: 'selected' | 'expired' | 'all'; ids?: string[] }): Promise<{ success: boolean; deleted: number }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/cache/places`, {
        method: 'DELETE',
        body: JSON.stringify(body),
    });
}

// PRODUCT_SPEC 5.5: Lead Lists

export interface LeadList {
    id: string;
    name: string;
    lead_count: number;
    created_at: string;
    updated_at: string;
}

export interface LeadListItem {
    id: string;
    list_id: string;
    place_id: string;
    name: string | null;
    phone: string | null;
    website: string | null;
    email: string | null;
    rating: number | null;
    reviews_count: number | null;
    score: string | null;
    pipeline: string | null;
    note: string | null;
    tags: string[] | null;
    social_links: {
        instagram?: string;
        facebook?: string;
        x?: string;
        youtube?: string;
        tiktok?: string;
        linkedin?: string;
        [key: string]: string | undefined;
    } | null;
    enrichment_status: 'success' | 'failed' | null;
    enriched_at: string | null;
    raw: any;
    created_at: string;
    updated_at: string;
}

export async function getLeadLists(): Promise<{ lists: LeadList[] }> {
    return apiRequest<{ lists: LeadList[] }>('/api/lists');
}

export async function createLeadList(name: string): Promise<{ list: LeadList }> {
    return apiRequest<{ list: LeadList }>('/api/lists', {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
}

export async function renameLeadList(listId: string, name: string): Promise<{ list: LeadList }> {
    return apiRequest<{ list: LeadList }>(`/api/lists/${listId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
    });
}

export async function deleteLeadList(listId: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/lists/${listId}`, {
        method: 'DELETE',
    });
}

export async function getLeadList(listId: string): Promise<{ list: LeadList }> {
    return apiRequest<{ list: LeadList }>(`/api/lists/${listId}`);
}

export async function getLeadListItems(listId: string): Promise<{ items: LeadListItem[] }> {
    return apiRequest<{ items: LeadListItem[] }>(`/api/lists/${listId}/items`);
}

export async function addLeadsToList(
    listId: string,
    leads: any[],
    options?: { dryRun?: boolean }
): Promise<{ addedCount?: number; skippedCount?: number; creditCost?: number; wouldAddCount?: number; wouldSkipCount?: number }> {
    return apiRequest<any>(`/api/lists/${listId}/items`, {
        method: 'POST',
        body: JSON.stringify({ leads, dryRun: options?.dryRun }),
    });
}

export async function bulkUpdateListItems(
    listId: string,
    itemIds: string[],
    updates: { tags?: string[]; note?: string; pipeline?: string; score?: string }
): Promise<{ updated: number }> {
    return apiRequest<{ updated: number }>(`/api/lists/${listId}/items/bulk`, {
        method: 'PATCH',
        body: JSON.stringify({ itemIds, updates }),
    });
}

export async function bulkDeleteListItems(listId: string, itemIds: string[]): Promise<{ deleted: number }> {
    return apiRequest<{ deleted: number }>(`/api/lists/${listId}/items/bulk`, {
        method: 'DELETE',
        body: JSON.stringify({ itemIds }),
    });
}

// ============================================================================
// Billing
// ============================================================================

export async function getCreditPackages(): Promise<{
    packages: Array<{
        id: string;
        name: string;
        // Real backend fields (snake_case from admin source of truth)
        display_name_tr: string;
        display_name_en: string;
        credits: number;
        price_try: number;
        price_usd: number;
        description: string | null;
        features: string[] | null;
        is_active: boolean;
        is_featured?: boolean;
        sort_order: number;
        // Legacy camelCase aliases (may be present in older backend versions)
        displayName?: string;
        isFeatured?: boolean;
        price?: number;
        currency?: string;
    }>;
}> {
    return apiRequest('/api/billing/packages');
}

export async function getOrders(): Promise<{
    orders: Array<{
        id: string;
        packageName: string;
        amount: number;
        currency: number;
        credits: number;
        status: string;
        paymentMethod: string;
        createdAt: string;
    }>;
}> {
    return apiRequest('/api/billing/orders');
}

export async function createOrder(
    packageId: string,
    paymentMethod: string
): Promise<{
    orderId: string;
    amount: number;
    currency: string;
}> {
    return apiRequest('/api/billing/orders', {
        method: 'POST',
        body: JSON.stringify({ packageId, paymentMethod }),
    });
}

// ============================================================================
// Settings / Profile
// ============================================================================

export async function updateUserProfile(fullName: string, phone: string): Promise<{ success: boolean; profile: any }> {
    return apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, phone }),
    });
}

export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
    });
}

export async function deleteUserAccount(): Promise<{ success: boolean }> {
    return apiRequest('/api/profile/delete', {
        method: 'POST',
    });
}

// ============================================================================
// PAYMENT PROVIDERS API
// ============================================================================

export interface PaymentProvider {
    id: number;
    provider_code: 'paytr' | 'iyzico' | 'shopier' | 'stripe' | 'bank_transfer';
    display_name: string;
    enabled: boolean;
    mode: 'test' | 'live';
    region: 'tr' | 'global';
    supported_currencies: string[];
    merchant_id: string | null;
    api_key: string | null;
    /** Masked to '••••••••' on admin endpoint; absent on public endpoint. */
    secret_key: string | null;
    public_key: string | null;
    /** Masked to '••••••••' on admin endpoint; absent on public endpoint. */
    webhook_secret: string | null;
    extra_config: Record<string, unknown>;
    sort_order: number;
    // bank_transfer-specific fields (null for all other providers)
    bank_name: string | null;
    account_holder: string | null;
    iban: string | null;
    payment_note: string | null;
    created_at: string;
    updated_at: string;
}

export type PaymentProviderUpdate = Partial<Omit<PaymentProvider, 'id' | 'provider_code' | 'region' | 'created_at' | 'updated_at'>>;

/**
 * Get all payment providers with masked secrets (admin only).
 * GET /api/${ADMIN_SECRET}/admin/payment-providers
 */
export async function getAdminPaymentProviders(): Promise<{ providers: PaymentProvider[] }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/payment-providers`);
}

/**
 * Create or update a payment provider config (admin only).
 * PUT /api/${ADMIN_SECRET}/admin/payment-providers/:code
 * Region is enforced server-side and cannot be overridden.
 */
export async function upsertAdminPaymentProvider(
    code: 'paytr' | 'iyzico' | 'shopier' | 'stripe' | 'bank_transfer',
    data: PaymentProviderUpdate
): Promise<{ success: boolean; provider: PaymentProvider }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/payment-providers/${code}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

/**
 * Get the bank_transfer provider row for checkout display (public — no auth).
 * Returns null when bank_transfer is disabled or not configured.
 * GET /api/billing/payment-providers (filtered client-side)
 */
export async function getBankTransferProvider(): Promise<PaymentProvider | null> {
    try {
        const res = await apiRequest<{ providers: PaymentProvider[] }>('/api/billing/payment-providers');
        return res.providers.find(p => p.provider_code === 'bank_transfer') ?? null;
    } catch {
        return null;
    }
}

/**
 * Get enabled payment providers for checkout (public — no auth required).
 * Secrets are stripped server-side.
 * GET /api/billing/payment-providers?region=tr|global
 */
export async function getCheckoutProviders(region?: 'tr' | 'global'): Promise<{ providers: Omit<PaymentProvider, 'secret_key' | 'webhook_secret'>[] }> {
    const q = region ? `?region=${region}` : '';
    return apiRequest(`/api/billing/payment-providers${q}`);
}

// ============================================================================
// ADMIN PACKAGE MANAGEMENT API
// ============================================================================

export interface AdminCreditPackage {
    id: string;
    name: string;
    display_name_tr: string;
    display_name_en: string;
    credits: number;
    price_try: number;
    price_usd: number;
    is_active: boolean;
    is_featured: boolean;
    sort_order: number;
    description: string | null;
    features: string[] | null;
    created_at: string;
}

/**
 * List all credit packages (admin only — includes inactive).
 * GET /api/${ADMIN_SECRET}/admin/packages
 */
export async function getAdminPackages(): Promise<{ packages: AdminCreditPackage[] }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/packages`);
}

/**
 * Create a new credit package (admin only).
 * POST /api/${ADMIN_SECRET}/admin/packages
 */
export async function createAdminPackage(data: {
    name: string;
    display_name_tr: string;
    display_name_en: string;
    credits: number;
    price_try: number;
    price_usd: number;
    is_active?: boolean;
    is_featured?: boolean;
    sort_order?: number;
    description?: string | null;
    features?: string[] | null;
}): Promise<{ success: boolean; package: AdminCreditPackage }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/packages`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Update a credit package (admin only).
 * PATCH /api/${ADMIN_SECRET}/admin/packages/:id
 */
export async function updateAdminPackage(
    id: string,
    data: Partial<Omit<AdminCreditPackage, 'id' | 'created_at'>>
): Promise<{ success: boolean; package: AdminCreditPackage }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/packages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

/**
 * Delete a credit package (admin only — blocked if orders reference it).
 * DELETE /api/${ADMIN_SECRET}/admin/packages/:id
 */
export async function deleteAdminPackage(id: string): Promise<{ success: boolean }> {
    if (!ADMIN_SECRET) throw new Error('VITE_ADMIN_ROUTE_SECRET is not configured.');
    return apiRequest(`/api/${ADMIN_SECRET}/admin/packages/${id}`, {
        method: 'DELETE',
    });
}
