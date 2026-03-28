import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabaseHost = (() => {
    try {
        return new URL(supabaseUrl).hostname;
    } catch {
        return 'invalid_supabase_url';
    }
})();

// TEMPORARY PRODUCTION DIAGNOSTICS: remove after /api/account investigation is complete.
console.log('[SUPABASE DEBUG] active backend target', {
    host: supabaseHost,
    projectRef: supabaseHost.split('.')[0] || null
});

// Admin client with service role key - bypasses RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper to verify user JWT token
export async function verifyUserToken(token) {
    if (!token) {
        console.error('[verifyUserToken] No token provided');
        return { user: null, error: 'No token provided' };
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
        console.error('[verifyUserToken] Validation failed:', error?.message);
        return { user: null, error: error?.message || 'Invalid token' };
    }

    return { user: data.user, error: null };
}
