import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/lists
 * List user's lead lists with item counts
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: lists, error } = await supabaseAdmin
            .from('lead_lists')
            .select('id, name, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Lists] List error:', error);
            return res.status(500).json({
                error: 'Failed to fetch lists',
                details: error.message || 'Unknown error',
                code: error.code,
                hint: error.hint
            });
        }

        // Get item counts for each list
        const listsWithCounts = await Promise.all(lists.map(async (list) => {
            const { count, error: countError } = await supabaseAdmin
                .from('lead_list_items')
                .select('*', { count: 'exact', head: true })
                .eq('list_id', list.id);

            return {
                ...list,
                lead_count: countError ? 0 : (count || 0)
            };
        }));

        res.json({ lists: listsWithCounts });
    } catch (err) {
        console.error('[Lists] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/lists
 * Create new lead list
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'List name is required' });
        }

        const { data: list, error } = await supabaseAdmin
            .from('lead_lists')
            .insert({ user_id: userId, name: name.trim() })
            .select()
            .single();

        if (error) {
            console.error('[Lists] Create error:', error);
            return res.status(500).json({ error: 'Failed to create list' });
        }

        res.json({ list: { ...list, lead_count: 0 } });
    } catch (err) {
        console.error('[Lists] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/lists/:listId
 * Get list metadata
 */
router.get('/:listId', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { listId } = req.params;

        const { data: list, error } = await supabaseAdmin
            .from('lead_lists')
            .select('*')
            .eq('id', listId)
            .eq('user_id', userId)
            .single();

        if (error || !list) {
            return res.status(404).json({ error: 'List not found' });
        }

        res.json({ list });
    } catch (err) {
        console.error('[Lists] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/lists/:listId/items
 * Get list items
 */
router.get('/:listId/items', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { listId } = req.params;

        // Verify list ownership
        const { data: list, error: listError } = await supabaseAdmin
            .from('lead_lists')
            .select('id')
            .eq('id', listId)
            .eq('user_id', userId)
            .single();

        if (listError || !list) {
            return res.status(404).json({ error: 'List not found' });
        }

        const { data: items, error } = await supabaseAdmin
            .from('lead_list_items')
            .select('*')
            .eq('list_id', listId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Lists] Items error:', error);
            return res.status(500).json({ error: 'Failed to fetch items' });
        }

        res.json({ items });
    } catch (err) {
        console.error('[Lists] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/lists/:listId/items
 * Add leads to list (bulk)
 * PRODUCT_SPEC 4: 1 credit per lead
 */
router.post('/:listId/items', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { listId } = req.params;
        const { leads, dryRun } = req.body;

        if (!Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'Leads array is required' });
        }

        const { data, error } = await supabaseAdmin.rpc('add_leads_to_list_atomic', {
            p_user_id: userId,
            p_list_id: listId,
            p_leads: leads,
            p_dry_run: dryRun === true
        });

        if (error) {
            console.error('[Lists] RPC error:', error);

            switch (error.message) {
                case 'LIST_NOT_FOUND':
                    return res.status(404).json({ error: 'List not found' });

                case 'INSUFFICIENT_CREDITS':
                    try {
                        const detail = JSON.parse(error.details || '{}');
                        return res.status(402).json({
                            error: 'Insufficient credits',
                            required: detail.required || 0,
                            available: detail.available || 0
                        });
                    } catch (parseError) {
                        return res.status(402).json({
                            error: 'Insufficient credits',
                            required: 0,
                            available: 0
                        });
                    }

                case 'INVALID_PAYLOAD':
                    return res.status(400).json({ error: 'Invalid payload format' });

                case 'INVALID_LEAD':
                    return res.status(400).json({
                        error: 'Invalid lead data',
                        detail: error.details || 'missing_place_id'
                    });

                default:
                    return res.status(500).json({ error: 'Failed to add leads' });
            }
        }

        res.json(data);
    } catch (err) {
        console.error('[Lists] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/lists/:listId/items/bulk
 * Bulk update items
 */
router.patch('/:listId/items/bulk', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { listId } = req.params;
        const { itemIds, updates } = req.body;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'Item IDs required' });
        }

        // Verify list ownership
        const { data: list, error: listError } = await supabaseAdmin
            .from('lead_lists')
            .select('id')
            .eq('id', listId)
            .eq('user_id', userId)
            .single();

        if (listError || !list) {
            return res.status(404).json({ error: 'List not found' });
        }

        const updateData = { updated_at: new Date().toISOString() };

        if (updates.tags !== undefined) updateData.tags = updates.tags;
        if (updates.note !== undefined) updateData.note = updates.note;
        if (updates.pipeline !== undefined) updateData.pipeline = updates.pipeline;
        if (updates.score !== undefined) updateData.score = updates.score;

        const { error } = await supabaseAdmin
            .from('lead_list_items')
            .update(updateData)
            .in('id', itemIds)
            .eq('list_id', listId)
            .eq('user_id', userId);

        if (error) {
            console.error('[Lists] Bulk update error:', error);
            return res.status(500).json({ error: 'Failed to update items' });
        }

        res.json({ updated: itemIds.length });
    } catch (err) {
        console.error('[Lists] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/lists/:listId/items/bulk
 * Bulk delete items
 */
router.delete('/:listId/items/bulk', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { listId } = req.params;
        const { itemIds } = req.body;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'Item IDs required' });
        }

        // Verify list ownership
        const { data: list, error: listError } = await supabaseAdmin
            .from('lead_lists')
            .select('id')
            .eq('id', listId)
            .eq('user_id', userId)
            .single();

        if (listError || !list) {
            return res.status(404).json({ error: 'List not found' });
        }

        const { error } = await supabaseAdmin
            .from('lead_list_items')
            .delete()
            .in('id', itemIds)
            .eq('list_id', listId)
            .eq('user_id', userId);

        if (error) {
            console.error('[Lists] Bulk delete error:', error);
            return res.status(500).json({ error: 'Failed to delete items' });
        }

        res.json({ deleted: itemIds.length });
    } catch (err) {
        console.error('[Lists] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
