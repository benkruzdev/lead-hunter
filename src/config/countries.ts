/**
 * Country coverage configuration — product-level, not UI detail.
 *
 * status:
 *   'active'     — backend fully supports this country; search is live.
 *   'comingSoon' — country is shown in the selector (with a badge) but
 *                  cannot be selected; no broken search is triggered.
 *   'hidden'     — not shown in the selector at all.
 *
 * hasSubregions:
 *   true  — structured region/subregion data available (turkey.json etc.).
 *           City field uses a searchable dropdown; district field uses dropdown.
 *   false — no structured data; city and district are free-text inputs.
 *
 * To activate a new country:
 *   1. Change its status to 'active'.
 *   2. If structured data exists, set hasSubregions: true and import the
 *      data file in SearchPage (same pattern as turkey.json).
 *   3. Optionally customise regionLabel / subregionLabel for your locale.
 */
export interface CountryEntry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Display name (always English, i18n display handled in UI) */
  name: string;
  /** Emoji flag */
  flag: string;
  /** Whether structured region/subregion dropdown data is available */
  hasSubregions: boolean;
  /** Coverage status — controls selectability in the UI */
  status: 'active' | 'comingSoon' | 'hidden';
}

export const COUNTRIES: CountryEntry[] = [
  // ── Active ─────────────────────────────────────────────────────────────────
  { code: 'TR', name: 'Türkiye',        flag: '🇹🇷', hasSubregions: true,  status: 'active'     },

  // ── Coming Soon ────────────────────────────────────────────────────────────
  { code: 'US', name: 'United States',  flag: '🇺🇸', hasSubregions: false, status: 'comingSoon' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', hasSubregions: false, status: 'comingSoon' },
  { code: 'DE', name: 'Germany',        flag: '🇩🇪', hasSubregions: false, status: 'comingSoon' },
  { code: 'FR', name: 'France',         flag: '🇫🇷', hasSubregions: false, status: 'comingSoon' },
  { code: 'NL', name: 'Netherlands',    flag: '🇳🇱', hasSubregions: false, status: 'comingSoon' },
  { code: 'ES', name: 'Spain',          flag: '🇪🇸', hasSubregions: false, status: 'comingSoon' },
  { code: 'IT', name: 'Italy',          flag: '🇮🇹', hasSubregions: false, status: 'comingSoon' },
  { code: 'PL', name: 'Poland',         flag: '🇵🇱', hasSubregions: false, status: 'comingSoon' },
  { code: 'AE', name: 'UAE',            flag: '🇦🇪', hasSubregions: false, status: 'comingSoon' },
  { code: 'SA', name: 'Saudi Arabia',   flag: '🇸🇦', hasSubregions: false, status: 'comingSoon' },
  { code: 'EG', name: 'Egypt',          flag: '🇪🇬', hasSubregions: false, status: 'comingSoon' },
  { code: 'NG', name: 'Nigeria',        flag: '🇳🇬', hasSubregions: false, status: 'comingSoon' },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦', hasSubregions: false, status: 'comingSoon' },
  { code: 'IN', name: 'India',          flag: '🇮🇳', hasSubregions: false, status: 'comingSoon' },
  { code: 'PK', name: 'Pakistan',       flag: '🇵🇰', hasSubregions: false, status: 'comingSoon' },
  { code: 'BD', name: 'Bangladesh',     flag: '🇧🇩', hasSubregions: false, status: 'comingSoon' },
  { code: 'ID', name: 'Indonesia',      flag: '🇮🇩', hasSubregions: false, status: 'comingSoon' },
  { code: 'MY', name: 'Malaysia',       flag: '🇲🇾', hasSubregions: false, status: 'comingSoon' },
  { code: 'SG', name: 'Singapore',      flag: '🇸🇬', hasSubregions: false, status: 'comingSoon' },
  { code: 'PH', name: 'Philippines',    flag: '🇵🇭', hasSubregions: false, status: 'comingSoon' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺', hasSubregions: false, status: 'comingSoon' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦', hasSubregions: false, status: 'comingSoon' },
  { code: 'MX', name: 'Mexico',         flag: '🇲🇽', hasSubregions: false, status: 'comingSoon' },
  { code: 'BR', name: 'Brazil',         flag: '🇧🇷', hasSubregions: false, status: 'comingSoon' },
  { code: 'AR', name: 'Argentina',      flag: '🇦🇷', hasSubregions: false, status: 'comingSoon' },
  { code: 'RU', name: 'Russia',         flag: '🇷🇺', hasSubregions: false, status: 'comingSoon' },
  { code: 'UA', name: 'Ukraine',        flag: '🇺🇦', hasSubregions: false, status: 'comingSoon' },
  { code: 'GR', name: 'Greece',         flag: '🇬🇷', hasSubregions: false, status: 'comingSoon' },
  { code: 'RO', name: 'Romania',        flag: '🇷🇴', hasSubregions: false, status: 'comingSoon' },
];

/** Lookup by ISO code — O(1) for runtime use. */
export const COUNTRY_BY_CODE = new Map<string, CountryEntry>(
  COUNTRIES.map(c => [c.code, c])
);

/** Only countries that are visible in the selector (active + comingSoon). */
export const VISIBLE_COUNTRIES = COUNTRIES.filter(c => c.status !== 'hidden');

/** Only countries where search is fully live. */
export const ACTIVE_COUNTRIES = COUNTRIES.filter(c => c.status === 'active');
