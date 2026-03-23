/**
 * Country coverage configuration — product-level source of truth.
 *
 * status:
 *   'active'     — fully supported; structured subregion data may be available.
 *   'comingSoon' — reserved for future use; currently unused in UI gating.
 *   'hidden'     — never shown in the selector.
 *
 * hasSubregions:
 *   true  — structured region/subregion dataset exists (e.g. TR → tr.json).
 *           City field uses a searchable dropdown; district uses a dropdown too.
 *   false — no structured dataset; city and district are professional free-text
 *           inputs with clear placeholders. Search still works via Google.
 *
 * regionLabelKey / subregionLabelKey (optional):
 *   i18n keys for the City and District field labels, allowing country-specific
 *   terminology (e.g. "Province" vs "City" vs "State"). When absent, the generic
 *   searchPage.city / searchPage.district keys are used.
 *
 * To activate a new country with structured data:
 *   1. Add a dataset to src/lib/locationData.ts (import + register).
 *   2. Set hasSubregions: true here.
 *   Everything else (search, cache, session, history, labels) adapts automatically.
 */
export interface CountryEntry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** English display name */
  name: string;
  /** Emoji flag */
  flag: string;
  /**
   * Single capability signal: true when a structured location dataset exists
   * for this country. This is the only flag needed — dataset presence in
   * locationData.ts is the complementary runtime check.
   */
  hasSubregions: boolean;
  /** Coverage status — 'hidden' entries are excluded from the selector */
  status: 'active' | 'comingSoon' | 'hidden';
  /**
   * Optional i18n key for the first-level location field label.
   * Falls back to searchPage.city when absent.
   */
  regionLabelKey?: string;
  /**
   * Optional i18n key for the second-level location field label.
   * Falls back to searchPage.district when absent.
   */
  subregionLabelKey?: string;
}

export const COUNTRIES: CountryEntry[] = [
  // ── Active with structured subregion data ──────────────────────────────────
  {
    code: 'TR', name: 'Türkiye', flag: '🇹🇷',
    hasSubregions: true, status: 'active',
    regionLabelKey: 'searchPage.regionLabelTR',
    subregionLabelKey: 'searchPage.subregionLabelTR',
  },

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
