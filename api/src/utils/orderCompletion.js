/**
 * orderCompletion.js — Shared idempotent order completion helper.
 *
 * Rules:
 *  1. Update orders.status pending → completed in a single conditional UPDATE.
 *     If 0 rows are updated the order was already completed — credits are NOT touched.
 *  2. Add credits to user and write credit_ledger entry.
 *  3. All steps are non-atomic at the DB level (no Postgres txn across service role calls),
 *     but the conditional status flip ensures credits are loaded at most once.
 */

import { logEvent } from './eventLogger.js';

/**
 * Complete a pending order and add credits.
 *
 * @param {object} supabase       supabaseAdmin client
 * @param {string} orderId        orders.id (UUID)
 * @param {string} actorLabel     human label for logEvent (e.g. 'paytr-callback')
 * @param {object} [meta]         optional extra metadata for logEvent
 * @returns {{ success: boolean, alreadyCompleted?: boolean, credits?: number, userId?: string }}
 */
export async function completeOrder(supabase, orderId, actorLabel = 'payment-callback', meta = {}) {
    // Step 1: Atomic status flip pending → completed.
    // The eq('status','pending') guard is the idempotency lock — if it was already
    // completed this returns 0 rows and we bail without touching credits.
    const { data: flipped, error: flipErr } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId)
        .eq('status', 'pending')
        .select('id, user_id, credits, amount, currency, payment_method');

    if (flipErr) {
        console.error(`[orderCompletion] Status flip error for ${orderId}:`, flipErr);
        throw new Error(`DB error flipping order status: ${flipErr.message}`);
    }

    if (!flipped || flipped.length === 0) {
        // Order was not in pending state — already completed or does not exist.
        console.warn(`[orderCompletion] Order ${orderId} not in pending state — skipping credit load.`);
        return { success: false, alreadyCompleted: true };
    }

    const order = flipped[0];

    // Step 2: Fetch current credit balance.
    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, credits')
        .eq('id', order.user_id)
        .single();

    if (profileErr || !profile) {
        console.error(`[orderCompletion] Profile not found for user ${order.user_id} after order flip.`);
        throw new Error('Order completed but user profile not found — manual intervention needed.');
    }

    const newBalance = (profile.credits || 0) + order.credits;

    // Step 3: Update credits.
    const { error: creditErr } = await supabase
        .from('profiles')
        .update({ credits: newBalance })
        .eq('id', order.user_id);

    if (creditErr) {
        console.error(`[orderCompletion] Credit update failed for user ${order.user_id}:`, creditErr);
        throw new Error('Order completed but credit update failed — manual intervention needed.');
    }

    // Step 4: Credit ledger entry (non-fatal).
    const { error: ledgerErr } = await supabase
        .from('credit_ledger')
        .insert({
            user_id: order.user_id,
            amount: order.credits,
            type: 'order_complete',
            description: `Ödeme tamamlandı (${order.payment_method}) — sipariş: ${orderId}`,
            created_at: new Date().toISOString(),
        });

    if (ledgerErr) {
        console.warn('[orderCompletion] Ledger write failed (non-fatal):', ledgerErr.message);
    }

    // Step 5: System event (non-fatal).
    await logEvent(supabase, {
        level: 'success',
        source: actorLabel,
        event_type: 'order_complete',
        subject_user_id: order.user_id,
        target_type: 'order',
        target_id: orderId,
        message: `Sipariş tamamlandı (${order.payment_method}) — ${orderId}`,
        credit_delta: order.credits,
        metadata: {
            order_id: orderId,
            amount: order.amount,
            currency: order.currency,
            new_balance: newBalance,
            ...meta,
        },
    }).catch(e => console.warn('[orderCompletion] logEvent failed (non-fatal):', e.message));

    console.log(`[orderCompletion] Order ${orderId} completed: +${order.credits} credits → user ${order.user_id}`);

    return {
        success: true,
        userId: order.user_id,
        credits: order.credits,
        newBalance,
    };
}

/**
 * Fail a pending order (mark as failed).
 * Used when the payment gateway explicitly signals failure.
 *
 * @param {object} supabase
 * @param {string} orderId
 * @param {string} reason
 */
export async function failOrder(supabase, orderId, reason = 'Payment failed') {
    const { error } = await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId)
        .eq('status', 'pending');  // Only fail if still pending — do not overwrite completed.

    if (error) {
        console.error(`[orderCompletion] failOrder error for ${orderId}:`, error.message);
    } else {
        console.log(`[orderCompletion] Order ${orderId} marked failed: ${reason}`);
    }
}
