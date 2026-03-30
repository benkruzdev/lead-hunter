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
        .update({ status: 'completed', completed_at: new Date().toISOString() })
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
    // Records the credit addition with traceability back to the originating order.
    const { error: ledgerErr } = await supabase
        .from('credit_ledger')
        .insert({
            user_id: order.user_id,
            order_id: orderId,      // FK added in migration 020 — links ledger to order for audit
            source: 'billing',      // source column added in migration 020
            amount: order.credits,
            type: 'order_complete',
            description: `Ödeme tamamlandı (${order.payment_method}) — sipariş: ${orderId}`,
            created_at: new Date().toISOString(),
        });

    if (ledgerErr) {
        console.warn('[orderCompletion] Ledger write failed (non-fatal):', ledgerErr.message);
    }

    // Step 5: System event — payment_completed + order_complete (non-fatal).
    const evtMeta = {
        order_id: orderId,
        provider_code: order.payment_method,
        payment_method: order.payment_method,
        amount: order.amount,
        currency: order.currency,
        new_balance: newBalance,
        ...meta,
    };

    await logEvent(supabase, {
        level: 'success',
        source: actorLabel,
        event_type: 'payment_completed',
        subject_user_id: order.user_id,
        target_type: 'order',
        target_id: orderId,
        message: `Ödeme tamamlandı — ${order.payment_method} — sipariş: ${orderId}`,
        credit_delta: order.credits,
        metadata: evtMeta,
    }).catch(e => console.warn('[orderCompletion] logEvent payment_completed failed (non-fatal):', e.message));

    await logEvent(supabase, {
        level: 'success',
        source: actorLabel,
        event_type: 'order_complete',
        subject_user_id: order.user_id,
        target_type: 'order',
        target_id: orderId,
        message: `Sipariş tamamlandı (${order.payment_method}) — ${orderId}`,
        credit_delta: order.credits,
        metadata: evtMeta,
    }).catch(e => console.warn('[orderCompletion] logEvent order_complete failed (non-fatal):', e.message));

    console.log(`[orderCompletion] Order ${orderId} completed: +${order.credits} credits → user ${order.user_id}`);

    return {
        success: true,
        userId: order.user_id,
        credits: order.credits,
        newBalance,
    };
}

/**
 * Fail a pending order (mark as failed) with an optional reason.
 * Stores failure_reason in orders table and logs a payment_failed event.
 * No credits are touched.
 *
 * @param {object} supabase
 * @param {string} orderId
 * @param {string} reason     Short human-readable failure reason
 * @param {object} [opts]
 * @param {string} [opts.failureCode]     Short machine-readable code (e.g. provider error code)
 * @param {string} [opts.providerCode]    e.g. 'paytr', 'iyzico'
 * @param {object} [opts.meta]            extra metadata for logEvent
 */
export async function failOrder(supabase, orderId, reason = 'Payment failed', opts = {}) {
    const { failureCode = null, providerCode = null, meta = {} } = opts;

    const updatePayload = {
        status: 'failed',
        failure_reason: reason.slice(0, 500),
    };
    if (failureCode) updatePayload.failure_code = failureCode.slice(0, 100);
    if (updatePayload.failure_reason) updatePayload.last_payment_event_at = new Date().toISOString();

    const { data: updated, error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('status', 'pending')  // Only fail if still pending — do not overwrite completed.
        .select('id, user_id, payment_method, amount, currency');

    if (error) {
        console.error(`[orderCompletion] failOrder error for ${orderId}:`, error.message);
        return;
    }

    if (!updated || updated.length === 0) {
        console.warn(`[orderCompletion] failOrder: order ${orderId} not in pending state — skipping.`);
        return;
    }

    const order = updated[0];
    console.log(`[orderCompletion] Order ${orderId} marked failed: ${reason}`);

    // Log payment_failed event (non-fatal).
    await logEvent(supabase, {
        level: 'error',
        source: providerCode || 'payment',
        event_type: 'payment_failed',
        subject_user_id: order.user_id,
        target_type: 'order',
        target_id: orderId,
        message: `Ödeme başarısız — ${order.payment_method}: ${reason}`,
        credit_delta: null,
        metadata: {
            order_id: orderId,
            provider_code: providerCode || order.payment_method,
            payment_method: order.payment_method,
            amount: order.amount,
            currency: order.currency,
            failure_reason: reason,
            failure_code: failureCode,
            ...meta,
        },
    }).catch(e => console.warn('[orderCompletion] logEvent payment_failed failed (non-fatal):', e.message));
}
