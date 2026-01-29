import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import { generateCSV, generateXLSX } from '../utils/exportUtils.js';

const router = express.Router();

/**
 * POST /api/exports
 * Create a new export
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { listId, format, note } = req.body;

        if (!listId || !format) {
            return res.status(400).json({ error: 'listId and format are required' });
        }

        if (format !== 'csv' && format !== 'xlsx') {
            return res.status(400).json({ error: 'Invalid format. Must be csv or xlsx' });
        }

        // Verify list ownership
        const { data: list, error: listError } = await supabaseAdmin
            .from('lead_lists')
            .select('id, name')
            .eq('id', listId)
            .eq('user_id', userId)
            .single();

        if (listError || !list) {
            return res.status(404).json({ error: 'List not found' });
        }

        // Fetch lead list items
        const { data: items, error: itemsError } = await supabaseAdmin
            .from('lead_list_items')
            .select('name, phone, website, email, score, pipeline, note, tags')
            .eq('list_id', listId)
            .eq('user_id', userId);

        if (itemsError) {
            console.error('[Exports] Failed to fetch items:', itemsError);
            return res.status(500).json({ error: 'Failed to fetch list items' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'List has no items to export' });
        }

        // Generate export file
        const fileContent = format === 'csv'
            ? generateCSV(items)
            : generateXLSX(items);

        const fileName = `${list.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${format}`;
        const storagePath = `${userId}/${fileName}`;

        // Upload to Supabase Storage (private bucket: exports)
        const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('exports')
            .upload(storagePath, fileContent, {
                contentType: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                upsert: false
            });

        if (uploadError) {
            console.error('[Exports] Upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload export file' });
        }

        // Create export record
        const { data: exportRecord, error: exportError } = await supabaseAdmin
            .from('exports')
            .insert({
                user_id: userId,
                list_id: listId,
                format,
                file_name: fileName,
                storage_path: storagePath,
                lead_count: items.length,
                note: note || null
            })
            .select()
            .single();

        if (exportError) {
            console.error('[Exports] Failed to create record:', exportError);
            return res.status(500).json({ error: 'Failed to create export record' });
        }

        // Generate signed URL for download (valid for 1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
            .storage
            .from('exports')
            .createSignedUrl(storagePath, 3600);

        if (signedUrlError) {
            console.error('[Exports] Failed to generate signed URL:', signedUrlError);
            return res.status(500).json({ error: 'Failed to generate download URL' });
        }

        res.json({
            exportId: exportRecord.id,
            downloadUrl: signedUrlData.signedUrl,
            fileName: fileName,
            leadCount: items.length
        });

    } catch (err) {
        console.error('[Exports] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/exports
 * List user's exports
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: exports, error } = await supabaseAdmin
            .from('exports')
            .select(`
                id,
                list_id,
                format,
                file_name,
                lead_count,
                note,
                created_at,
                lead_lists!inner(name)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Exports] Failed to fetch exports:', error);
            return res.status(500).json({ error: 'Failed to fetch exports' });
        }

        // Flatten the response
        const formattedExports = exports.map(exp => ({
            id: exp.id,
            listId: exp.list_id,
            listName: exp.lead_lists?.name || 'Unknown List',
            format: exp.format,
            fileName: exp.file_name,
            leadCount: exp.lead_count,
            note: exp.note,
            createdAt: exp.created_at
        }));

        res.json({ exports: formattedExports });

    } catch (err) {
        console.error('[Exports] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/exports/:exportId/download
 * Get signed download URL for an export
 */
router.get('/:exportId/download', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { exportId } = req.params;

        // Verify ownership and get export
        const { data: exportRecord, error: exportError } = await supabaseAdmin
            .from('exports')
            .select('storage_path, file_name')
            .eq('id', exportId)
            .eq('user_id', userId)
            .single();

        if (exportError || !exportRecord) {
            return res.status(404).json({ error: 'Export not found' });
        }

        // Generate signed URL (valid for 1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
            .storage
            .from('exports')
            .createSignedUrl(exportRecord.storage_path, 3600);

        if (signedUrlError) {
            console.error('[Exports] Failed to generate signed URL:', signedUrlError);
            return res.status(500).json({ error: 'Failed to generate download URL' });
        }

        res.json({
            downloadUrl: signedUrlData.signedUrl,
            fileName: exportRecord.file_name
        });

    } catch (err) {
        console.error('[Exports] Download error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
