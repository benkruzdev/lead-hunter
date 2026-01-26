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
        throw new Error(error.message || error.error || 'Request failed');
    }

    return response.json();
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
 * GET /api/admin/config
 */
export async function getAdminConfig() {
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
    }>('/api/admin/config');
}

/**
 * Update admin configuration (admin only)
 * PATCH /api/admin/config
 */
export async function updateAdminConfig(data: {
    recaptcha_enabled?: boolean;
    recaptcha_site_key?: string;
    recaptcha_secret_key?: string;
    google_oauth_enabled?: boolean;
    google_client_id?: string;
    google_client_secret?: string;
}) {
    return apiRequest<{
        success: boolean;
        config: any;
    }>('/api/admin/config', {
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


