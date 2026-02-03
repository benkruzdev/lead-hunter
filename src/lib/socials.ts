/**
 * Social Media Mock Generator
 * Deterministic social media links based on business ID and name
 * Single source of truth for all social media data in the app
 */

export type Socials = {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
};

/**
 * Slug generator: normalize Turkish characters and create URL-safe slug
 */
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

/**
 * Generate deterministic social media links for a business
 * Same business (id + name) always generates the same results
 * 
 * @param item Business item with id and name
 * @returns Socials object with available platforms (only defined if exists)
 */
export function getMockSocials(item: { id: number; name: string }): Socials {
    const base = slugify(item.name);
    const socials: Socials = {};

    // Deterministic platform assignment based on ID
    if (item.id % 2 === 0) {
        socials.instagram = `https://instagram.com/${base}`;
    }

    if (item.id % 3 === 0) {
        socials.facebook = `https://facebook.com/${base}`;
    }

    if (item.id % 5 === 0) {
        socials.linkedin = `https://linkedin.com/company/${base}`;
    }

    if (item.id % 7 === 0) {
        socials.twitter = `https://x.com/${base}`;
    }

    if (item.id % 11 === 0) {
        socials.tiktok = `https://tiktok.com/@${base}`;
    }

    if (item.id % 13 === 0) {
        socials.youtube = `https://youtube.com/@${base}`;
    }

    return socials;
}
