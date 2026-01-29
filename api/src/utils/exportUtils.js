/**
 * Export Utilities
 * PRODUCT_SPEC 5.8: CSV and XLSX generation for lead lists
 */

import XLSX from 'xlsx';

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
 * Generate XLSX from lead list items with formatting
 * @param {Array} items - Lead list items
 * @returns {Buffer} XLSX file buffer
 */
export function generateXLSX(items) {
    // Prepare data with headers
    const headers = ['Name', 'Phone', 'Website', 'Email', 'Score', 'Pipeline', 'Note', 'Tags'];

    const data = items.map(item => ({
        'Name': item.name || '',
        'Phone': item.phone || '',
        'Website': item.website || '',
        'Email': item.email || '',
        'Score': item.score || '',
        'Pipeline': item.pipeline || '',
        'Note': item.note || '',
        'Tags': Array.isArray(item.tags) ? item.tags.join(', ') : ''
    }));

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });

    // Calculate column widths based on content
    const colWidths = headers.map((header, idx) => {
        const headerLen = header.length;
        const maxLen = data.reduce((max, row) => {
            const val = String(row[header] || '');
            return Math.max(max, val.length);
        }, headerLen);
        // Min width 12, max width 40
        return { wch: Math.min(Math.max(maxLen, 12), 40) };
    });
    ws['!cols'] = colWidths;

    // Freeze first row (header)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Style header row (bold)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
            font: { bold: true },
            alignment: { vertical: 'center', horizontal: 'center' }
        };
    }

    // Make website column clickable hyperlinks and wrap Note column
    for (let row = 1; row <= range.e.r; row++) {
        // Website hyperlinks (column index 2)
        const websiteCell = XLSX.utils.encode_cell({ r: row, c: 2 });
        if (ws[websiteCell] && ws[websiteCell].v) {
            const url = ws[websiteCell].v;
            ws[websiteCell].l = { Target: url, Tooltip: url };
            ws[websiteCell].s = { font: { color: { rgb: "0563C1" }, underline: true } };
        }

        // Wrap text for Note column (column index 6)
        const noteCell = XLSX.utils.encode_cell({ r: row, c: 6 });
        if (ws[noteCell]) {
            ws[noteCell].s = { alignment: { wrapText: true, vertical: 'top' } };
        }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
}
