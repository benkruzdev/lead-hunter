// Export template definitions and CSV generation utilities
import { getMockSocials } from './socials';

export interface ExportTemplate {
    id: 'basic' | 'salesCrm' | 'outreach';
    columns: string[];
}

export const templates: Record<string, ExportTemplate> = {
    basic: {
        id: 'basic',
        columns: ['name', 'category', 'district', 'phone', 'website'],
    },
    salesCrm: {
        id: 'salesCrm',
        columns: ['name', 'phone', 'email', 'rating', 'reviews', 'isOpen'],
    },
    outreach: {
        id: 'outreach',
        columns: ['name', 'website', 'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube', 'outreach_ready', 'category', 'city'],
    },
};

// Slug generator: normalize Turkish chars and create URL-safe slug
function slugify(text: string): string {
    const turkishMap: Record<string, string> = {
        'ş': 's', 'Ş': 's',
        'ı': 'i', 'İ': 'i',
        'ö': 'o', 'Ö': 'o',
        'ü': 'u', 'Ü': 'u',
        'ç': 'c', 'Ç': 'c',
        'ğ': 'g', 'Ğ': 'g',
    };

    let normalized = text;
    for (const [tr, en] of Object.entries(turkishMap)) {
        normalized = normalized.replace(new RegExp(tr, 'g'), en);
    }

    return normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Generate mock email based on item ID
function generateMockEmail(item: any): string {
    if (item.id % 2 === 0) {
        const slug = slugify(item.name);
        return `info@${slug}.com`;
    }
    return '';
}

// Map a search result item to a flat record based on template
export function mapItemToRecord(item: any, template: ExportTemplate, city?: string): Record<string, string> {
    const record: Record<string, string> = {};

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
            case 'phone':
                record[col] = item.phone || '';
                break;
            case 'website':
                record[col] = item.website || '';
                break;
            case 'email':
                record[col] = generateMockEmail(item);
                break;
            case 'rating':
                record[col] = item.rating?.toString() || '';
                break;
            case 'reviews':
                record[col] = item.reviews?.toString() || '';
                break;
            case 'isOpen':
                record[col] = item.isOpen ? 'Yes' : 'No';
                break;
            case 'instagram':
            case 'facebook':
            case 'linkedin':
            case 'twitter':
            case 'tiktok':
            case 'youtube': {
                const socials = getMockSocials(item);
                record[col] = socials[col as keyof typeof socials] || '';
                break;
            }
            case 'outreach_ready': {
                const socials = getMockSocials(item);
                const socialCount = Object.keys(socials).length;
                record[col] = socialCount >= 2 ? 'yes' : 'no';
                break;
            }
            case 'city':
                record[col] = city || '';
                break;
            default:
                record[col] = '';
        }
    }

    return record;
}

// Generate CSV content from records with UTF-8 BOM for Excel compatibility
export function generateCSV(records: Record<string, string>[], columns: string[]): string {
    // UTF-8 BOM for Excel
    const BOM = '\uFEFF';

    // CSV header
    const header = columns.join(',');

    // CSV rows
    const rows = records.map(record => {
        return columns.map(col => {
            const value = record[col] || '';
            // Escape values containing commas, quotes, or newlines
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
    });

    return BOM + [header, ...rows].join('\n');
}

// Trigger CSV download in browser
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
