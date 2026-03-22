/**
 * Country coverage configuration — product-level source of truth.
 *
 * status:
 *   'active'     — fully supported; structured subregion data may be available.
 *   'comingSoon' — reserved for future use; currently unused in UI gating.
 *   'hidden'     — never shown in the selector.
 *
 * hasSubregions:
 *   true  — structured region/subregion datasets available (e.g. turkey.json).
 *           City field uses a searchable dropdown; district field uses dropdown.
 *   false — no structured dataset; city and district are professional free-text
 *           inputs with clear placeholders. Search still works via Google.
 *
 * To activate a new country with structured data:
 *   1. Add a data file (e.g. src/data/germany.json) with the same schema as turkey.json.
 *   2. Set hasSubregions: true here.
 *   3. Import and route the file in SearchPage's city/district logic.
 *   Everything else (search, cache, session, history) adapts automatically.
 */
export interface CountryEntry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** English display name */
  name: string;
  /** Emoji flag */
  flag: string;
  /** Whether structured region/subregion dropdown data is available */
  hasSubregions: boolean;
  /** Coverage status — 'hidden' entries are excluded from the selector */
  status: 'active' | 'comingSoon' | 'hidden';
}

export const COUNTRIES: CountryEntry[] = [
  // ── Active with structured subregion data ──────────────────────────────────
  { code: 'TR', name: 'Türkiye',        flag: '🇹🇷', hasSubregions: true,  status: 'active' },

  // ── Active via free-text fallback (Google handles geo-context) ─────────────
  { code: 'US', name: 'United States',  flag: '🇺🇸', hasSubregions: false, status: 'active' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', hasSubregions: false, status: 'active' },
  { code: 'DE', name: 'Germany',        flag: '🇩🇪', hasSubregions: false, status: 'active' },
  { code: 'FR', name: 'France',         flag: '🇫🇷', hasSubregions: false, status: 'active' },
  { code: 'NL', name: 'Netherlands',    flag: '🇳🇱', hasSubregions: false, status: 'active' },
  { code: 'ES', name: 'Spain',          flag: '🇪🇸', hasSubregions: false, status: 'active' },
  { code: 'IT', name: 'Italy',          flag: '🇮🇹', hasSubregions: false, status: 'active' },
  { code: 'PL', name: 'Poland',         flag: '🇵🇱', hasSubregions: false, status: 'active' },
  { code: 'AE', name: 'UAE',            flag: '🇦🇪', hasSubregions: false, status: 'active' },
  { code: 'SA', name: 'Saudi Arabia',   flag: '🇸🇦', hasSubregions: false, status: 'active' },
  { code: 'EG', name: 'Egypt',          flag: '🇪🇬', hasSubregions: false, status: 'active' },
  { code: 'NG', name: 'Nigeria',        flag: '🇳🇬', hasSubregions: false, status: 'active' },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦', hasSubregions: false, status: 'active' },
  { code: 'IN', name: 'India',          flag: '🇮🇳', hasSubregions: false, status: 'active' },
  { code: 'PK', name: 'Pakistan',       flag: '🇵🇰', hasSubregions: false, status: 'active' },
  { code: 'BD', name: 'Bangladesh',     flag: '🇧🇩', hasSubregions: false, status: 'active' },
  { code: 'ID', name: 'Indonesia',      flag: '🇮🇩', hasSubregions: false, status: 'active' },
  { code: 'MY', name: 'Malaysia',       flag: '🇲🇾', hasSubregions: false, status: 'active' },
  { code: 'SG', name: 'Singapore',      flag: '🇸🇬', hasSubregions: false, status: 'active' },
  { code: 'PH', name: 'Philippines',    flag: '🇵🇭', hasSubregions: false, status: 'active' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺', hasSubregions: false, status: 'active' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦', hasSubregions: false, status: 'active' },
  { code: 'MX', name: 'Mexico',         flag: '🇲🇽', hasSubregions: false, status: 'active' },
  { code: 'BR', name: 'Brazil',         flag: '🇧🇷', hasSubregions: false, status: 'active' },
  { code: 'AR', name: 'Argentina',      flag: '🇦🇷', hasSubregions: false, status: 'active' },
  { code: 'RU', name: 'Russia',         flag: '🇷🇺', hasSubregions: false, status: 'active' },
  { code: 'UA', name: 'Ukraine',        flag: '🇺🇦', hasSubregions: false, status: 'active' },
  { code: 'GR', name: 'Greece',         flag: '🇬🇷', hasSubregions: false, status: 'active' },
  { code: 'RO', name: 'Romania',        flag: '🇷🇴', hasSubregions: false, status: 'active' },
];

/** O(1) lookup by ISO code. */
export const COUNTRY_BY_CODE = new Map<string, CountryEntry>(
  COUNTRIES.map(c => [c.code, c])
);

/** Countries shown in the selector (excludes hidden). */
export const VISIBLE_COUNTRIES = COUNTRIES.filter(c => c.status !== 'hidden');

/** Countries with full active support. */
export const ACTIVE_COUNTRIES = COUNTRIES.filter(c => c.status === 'active');
