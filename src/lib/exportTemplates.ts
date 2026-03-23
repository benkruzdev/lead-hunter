/**
 * Export template definitions and CSV generation utilities.
 *
 * mapItemToRecord accepts a locationCtx object so exports can include
 * country-aware context (city, country name, country code) without
 * breaking existing callers that still pass city as a plain string.
 */

export interface ExportTemplate {
    id: 'basic' | 'salesCrm' | 'outreach';
    columns: string[];
}

/** Location context passed from SearchPage into export mapping. */
export interface ExportLocationCtx {
    city?: string;
    country?: string;      // display name from COUNTRY_BY_CODE
    countryCode?: string;  // ISO 3166-1 alpha-2
}

export const templates: Record<string, ExportTemplate> = {
    basic: {
        id: 'basic',
        columns: ['name', 'category', 'district', 'city', 'country', 'phone', 'website'],
    },
    salesCrm: {
        id: 'salesCrm',
        columns: ['name', 'phone', 'email', 'rating', 'reviews', 'isOpen'],
    },
    outreach: {
        id: 'outreach',
        columns: ['name', 'website', 'instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube', 'outreach_ready', 'category', 'city', 'country'],
    },
};

/**
 * Map a lead list item to a flat record based on template columns.
 *
 * @param item         - Lead data object
 * @param template     - Export template definition
 * @param locationCtx  - Location context: city, country display name, countryCode
 *                       For backward compat, also accepts a plain string (treated as city).
 */
export function mapItemToRecord(
    item: any,
    template: ExportTemplate,
    locationCtx?: ExportLocationCtx | string
): Record<string, string> {
    // Backward-compat: old callers passing city as a plain string
    const ctx: ExportLocationCtx =
        typeof locationCtx === 'string'
            ? { city: locationCtx }
            : (locationCtx ?? {});

    const record: Record<string, string> = {};
    const socialLinks: Record<string, string> = item.social_links || {};

    for (const col of template.columns) {
        switch (col) {
            case 'name':
                record[col] = item.name || '';
                break;
            case 'category':
                record[col] = item.category || '';
                break;
            case 'district':
                record[col] = item.district || '';
                break;
            case 'city':
                record[col] = ctx.city || '';
                break;
            case 'country':
                record[col] = ctx.country || '';
                break;
            case 'country_code':
                record[col] = ctx.countryCode || '';
                break;
            case 'phone':
                record[col] = item.phone || '';
                break;
            case 'website':
                record[col] = item.website || '';
                break;
            case 'email':
                record[col] = item.email || '';
                break;
            case 'rating':
                record[col] = item.rating?.toString() || '';
                break;
            case 'reviews':
                record[col] = (item.reviews ?? item.reviews_count)?.toString() || '';
                break;
            case 'isOpen':
                record[col] = item.isOpen ? 'Yes' : 'No';
                break;
            case 'instagram':
            case 'facebook':
            case 'linkedin':
            case 'x':
            case 'tiktok':
            case 'youtube':
                record[col] = socialLinks[col] || '';
                break;
            case 'outreach_ready': {
                const socialCount = Object.values(socialLinks).filter(Boolean).length;
                record[col] = socialCount >= 2 ? 'yes' : (item.email ? 'yes' : 'no');
                break;
            }
            default:
                record[col] = '';
        }
    }

    return record;
}

/** Generate CSV content from records with UTF-8 BOM for Excel compatibility. */
export function generateCSV(records: Record<string, string>[], columns: string[]): string {
    const BOM = '\uFEFF';
    const header = columns.join(',');
    const rows = records.map(record =>
        columns.map(col => {
            const value = record[col] || '';
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',')
    );
    return BOM + [header, ...rows].join('\n');
}

/** Trigger CSV download in browser. */
export function downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
