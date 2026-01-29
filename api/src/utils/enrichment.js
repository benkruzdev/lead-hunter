/**
 * Lead Enrichment Utility
 * PRODUCT_SPEC 5.7: Extract email and social links from business websites
 */

/**
 * Enrich a website by extracting email and social media links
 * @param {string} websiteUrl - The website URL to enrich
 * @returns {Promise<{email: string|null, social_links: object}>}
 */
export async function enrichWebsite(websiteUrl) {
    if (!websiteUrl) {
        return { email: null, social_links: {} };
    }

    // Normalize URL
    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    try {
        // Fetch HTML with timeout and size limit
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LeadHunter/1.0)',
            },
            redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('[Enrichment] HTTP error:', response.status);
            return { email: null, social_links: {} };
        }

        // Limit response size
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
            console.error('[Enrichment] Content too large:', contentLength);
            return { email: null, social_links: {} };
        }

        const html = await response.text();

        // Extract email
        const email = extractEmail(html);

        // Extract social links
        const social_links = extractSocialLinks(html);

        return { email, social_links };

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[Enrichment] Timeout:', websiteUrl);
        } else {
            console.error('[Enrichment] Error:', error.message);
        }
        return { email: null, social_links: {} };
    }
}

/**
 * Extract email from HTML content
 */
function extractEmail(html) {
    // Try mailto: links first
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch) {
        return mailtoMatch[1];
    }

    // Try plain email in text
    const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const matches = html.match(emailRegex);

    if (matches && matches.length > 0) {
        // Filter out common false positives
        const validEmails = matches.filter(email =>
            !email.includes('example.com') &&
            !email.includes('sentry.io') &&
            !email.includes('google.com') &&
            !email.includes('facebook.com')
        );

        if (validEmails.length > 0) {
            return validEmails[0];
        }
    }

    return null;
}

/**
 * Extract social media links from HTML content
 */
function extractSocialLinks(html) {
    const social_links = {};

    // Social media patterns
    const patterns = {
        instagram: /https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9._]+)/gi,
        facebook: /https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9._-]+)/gi,
        x: /https?:\/\/(www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9._]+)/gi,
        youtube: /https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|user\/|@)?([a-zA-Z0-9._-]+)/gi,
        tiktok: /https?:\/\/(www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)/gi,
        linkedin: /https?:\/\/(www\.)?linkedin\.com\/(company\/|in\/)?([a-zA-Z0-9._-]+)/gi,
    };

    for (const [platform, regex] of Object.entries(patterns)) {
        const match = html.match(regex);
        if (match && match.length > 0) {
            // Get the first valid match
            social_links[platform] = match[0];
        }
    }

    return social_links;
}
