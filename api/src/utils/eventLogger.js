/**
 * eventLogger.js
 * Non-fatal helper to write to public.system_events table.
 * All callers: fire-and-forget. Never throws.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   level?: 'info'|'warn'|'error'|'success',
 *   source?: string,
 *   event_type: string,
 *   actor_user_id?: string|null,
 *   subject_user_id?: string|null,
 *   target_type?: string|null,
 *   target_id?: string|null,
 *   message: string,
 *   credit_delta?: number|null,
 *   metadata?: Record<string,unknown>,
 * }} payload
 */
export async function logEvent(supabase, payload) {
    try {
        const row = {
            level: payload.level ?? 'info',
            source: payload.source ?? 'system',
            event_type: payload.event_type,
            actor_user_id: payload.actor_user_id ?? null,
            subject_user_id: payload.subject_user_id ?? null,
            target_type: payload.target_type ?? null,
            target_id: payload.target_id ?? null,
            message: payload.message,
            credit_delta: payload.credit_delta ?? null,
            metadata: payload.metadata ?? {},
        };

        const { error } = await supabase.from('system_events').insert(row);

        if (error) {
            console.error('[EventLogger] Insert error (non-fatal):', error.message);
        }
    } catch (err) {
        console.error('[EventLogger] Unexpected error (non-fatal):', err.message);
    }
}
