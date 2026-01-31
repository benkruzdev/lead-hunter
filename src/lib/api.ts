import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Make authenticated API request to backend
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({
            error: 'Request failed',
            message: response.statusText,
        }));
        const err = new Error(error.message || error.error || 'Request failed') as any;
        err.status = response.status;
        throw err;
    }

    return response.json();
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
    note?: string
): Promise<{
    exportId: string;
    downloadUrl: string;
    fileName: string;
    leadCount: number;
}> {
    return apiRequest(`/api/exports`, {
        method: 'POST',
        body: JSON.stringify({ listId, format, note }),
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
    return apiRequest<{
        credits: number;
    }>('/api/credits/balance');
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
    id: number;
    name: string;
    category: string;
    district: string;
    rating: number;
    reviews: number;
    isOpen: boolean;
    phone: string;
    website: string;
    address: string;
    hours: string;
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
        displayName: string;
        credits: number;
        price: number;
        currency: string;
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
