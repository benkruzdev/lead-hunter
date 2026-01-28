const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

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
            return res.status(500).json({ error: 'Failed to fetch lists' });
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
        const { leads } = req.body;

        if (!Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'Leads array is required' });
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

        // Get existing items to avoid duplicates
        const { data: existingItems } = await supabaseAdmin
            .from('lead_list_items')
            .select('place_id')
            .eq('list_id', listId);

        const existingPlaceIds = new Set(existingItems?.map(item => item.place_id) || []);
        const newLeads = leads.filter(lead => !existingPlaceIds.has(lead.place_id || lead.id));

        if (newLeads.length === 0) {
            return res.json({ added: 0, message: 'All leads already in list' });
        }

        // Check credits (1 credit per lead)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('credits')
            .eq('id', userId)
            .single();

        if (!profile || profile.credits < newLeads.length) {
            return res.status(402).json({
                error: 'Insufficient credits',
                required: newLeads.length,
                available: profile?.credits || 0
            });
        }

        // Add leads
        const itemsToInsert = newLeads.map(lead => ({
            user_id: userId,
            list_id: listId,
            place_id: lead.place_id || lead.id?.toString() || `temp_${Date.now()}_${Math.random()}`,
            name: lead.name,
            phone: lead.phone,
            website: lead.website,
            email: lead.email || null,
            rating: lead.rating,
            reviews_count: lead.reviews || lead.reviews_count,
            raw: lead
        }));

        const { error: insertError } = await supabaseAdmin
            .from('lead_list_items')
            .insert(itemsToInsert);

        if (insertError) {
            console.error('[Lists] Insert error:', insertError);
            return res.status(500).json({ error: 'Failed to add leads' });
        }

        // Deduct credits
        const { error: creditError } = await supabaseAdmin
            .from('profiles')
            .update({ credits: profile.credits - newLeads.length })
            .eq('id', userId);

        if (creditError) {
            console.error('[Lists] Credit deduction error:', creditError);
        }

        res.json({ added: newLeads.length });
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

module.exports = router;
