/**
 * Export Utilities
 * PRODUCT_SPEC 5.8: CSV and XLSX generation for lead lists
 */

/**
 * Generate CSV from lead list items
 * @param {Array} items - Lead list items
 * @returns {string} CSV content
 */
export function generateCSV(items) {
    // CSV headers
    const headers = ['Name', 'Phone', 'Website', 'Email', 'Score', 'Pipeline', 'Note', 'Tags'];

    // Convert items to rows
    const rows = items.map(item => [
        item.name || '',
        item.phone || '',
        item.website || '',
        item.email || '',
        item.score || '',
        item.pipeline || '',
        item.note || '',
        Array.isArray(item.tags) ? item.tags.join(', ') : ''
    ]);

    // Build CSV content
    const csvLines = [headers, ...rows].map(row =>
        row.map(field => {
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
        }).join(',')
    );

    return csvLines.join('\n');
}

/**
 * Generate XLSX from lead list items
 * Note: This is a minimal implementation. For production, consider using a library like 'xlsx'
 * @param {Array} items - Lead list items
 * @returns {Buffer} XLSX file buffer
 */
export function generateXLSX(items) {
    // For now, return CSV as fallback
    // In production, use 'xlsx' library:
    // import XLSX from 'xlsx';
    // const ws = XLSX.utils.json_to_sheet(items);
    // const wb = XLSX.utils.book_new();
    // XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    // return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const csv = generateCSV(items);
    return Buffer.from(csv, 'utf-8');
}
