import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

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

    console.log('[verifyUserToken] Calling supabaseAdmin.auth.getUser()');
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
        console.error('[verifyUserToken] Validation failed:', error?.message);
        return { user: null, error: error?.message || 'Invalid token' };
    }

    console.log('[verifyUserToken] Token valid - User ID:', data.user.id, 'Email:', data.user.email);
    console.log('[verifyUserToken] Full user object:', JSON.stringify(data.user, null, 2));

    return { user: data.user, error: null };
}
