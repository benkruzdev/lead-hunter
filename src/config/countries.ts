/**
 * Country coverage configuration — product-level source of truth.
 *
 * status:
 *   'active'     — fully supported; structured location dataset exists.
 *   'hidden'     — never shown in the selector.
 *
 * regionLabelKey / subregionLabelKey (optional):
 *   i18n keys for the Region and Area field labels, allowing country-specific
 *   terminology (e.g. "State", "Province", "Emirate"). When absent, the generic
 *   searchPage.region / searchPage.subregion keys are used.
 *
 * To activate a new country:
 *   1. Add a dataset to src/data/locations/<cc>.json.
 *   2. Register it in src/lib/locationData.ts.
 *   3. Add an entry here with status: 'active'.
 *   Everything else (search, session, history, labels) adapts automatically.
 */
export interface CountryEntry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** English display name */
  name: string;
  /** Emoji flag */
  flag: string;
  /** Coverage status — 'hidden' entries are excluded from the selector */
  status: 'active' | 'hidden';
  /**
   * Optional i18n key for the first-level location field label.
   * Falls back to searchPage.region when absent.
   */
  regionLabelKey?: string;
  /**
   * Optional i18n key for the second-level location field label.
   * Falls back to searchPage.subregion when absent.
   */
  subregionLabelKey?: string;
}

export const COUNTRIES: CountryEntry[] = [
  // Türkiye — province + district
  {
    code: 'TR', name: 'Türkiye', flag: '🇹🇷', status: 'active',
    regionLabelKey: 'searchPage.regionLabelTR',
    subregionLabelKey: 'searchPage.subregionLabelTR',
  },

  // United States — state + city
  {
    code: 'US', name: 'United States', flag: '🇺🇸', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // United Kingdom — country + city
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Germany — state + city
  {
    code: 'DE', name: 'Germany', flag: '🇩🇪', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // France — region + city
  {
    code: 'FR', name: 'France', flag: '🇫🇷', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Netherlands — province + city
  {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱', status: 'active',
    regionLabelKey: 'searchPage.regionLabelProvince',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Spain — community + city
  {
    code: 'ES', name: 'Spain', flag: '🇪🇸', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Italy — region + city
  {
    code: 'IT', name: 'Italy', flag: '🇮🇹', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Poland — voivodeship + city
  {
    code: 'PL', name: 'Poland', flag: '🇵🇱', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // UAE — emirate + area
  {
    code: 'AE', name: 'UAE', flag: '🇦🇪', status: 'active',
    regionLabelKey: 'searchPage.regionLabelEmirate',
    subregionLabelKey: 'searchPage.subregionLabelArea',
  },

  // Saudi Arabia — province + city
  {
    code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', status: 'active',
    regionLabelKey: 'searchPage.regionLabelProvince',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Egypt — governorate + area
  {
    code: 'EG', name: 'Egypt', flag: '🇪🇬', status: 'active',
    regionLabelKey: 'searchPage.regionLabelGovernorate',
    subregionLabelKey: 'searchPage.subregionLabelArea',
  },

  // Nigeria — state + city
  {
    code: 'NG', name: 'Nigeria', flag: '🇳🇬', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // South Africa — province + city
  {
    code: 'ZA', name: 'South Africa', flag: '🇿🇦', status: 'active',
    regionLabelKey: 'searchPage.regionLabelProvince',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // India — state + city
  {
    code: 'IN', name: 'India', flag: '🇮🇳', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Pakistan — province + city
  {
    code: 'PK', name: 'Pakistan', flag: '🇵🇰', status: 'active',
    regionLabelKey: 'searchPage.regionLabelProvince',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Bangladesh — division + district
  {
    code: 'BD', name: 'Bangladesh', flag: '🇧🇩', status: 'active',
    regionLabelKey: 'searchPage.regionLabelDivision',
    subregionLabelKey: 'searchPage.subregionLabelDistrict',
  },

  // Indonesia — province + city
  {
    code: 'ID', name: 'Indonesia', flag: '🇮🇩', status: 'active',
    regionLabelKey: 'searchPage.regionLabelProvince',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Malaysia — state + city
  {
    code: 'MY', name: 'Malaysia', flag: '🇲🇾', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Singapore — region + area
  {
    code: 'SG', name: 'Singapore', flag: '🇸🇬', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelArea',
  },

  // Philippines — region + city
  {
    code: 'PH', name: 'Philippines', flag: '🇵🇭', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Australia — state + city
  {
    code: 'AU', name: 'Australia', flag: '🇦🇺', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Canada — province + city
  {
    code: 'CA', name: 'Canada', flag: '🇨🇦', status: 'active',
    regionLabelKey: 'searchPage.regionLabelProvince',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Mexico — state + city
  {
    code: 'MX', name: 'Mexico', flag: '🇲🇽', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Brazil — state + city
  {
    code: 'BR', name: 'Brazil', flag: '🇧🇷', status: 'active',
    regionLabelKey: 'searchPage.regionLabelState',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Argentina — province + city
  {
    code: 'AR', name: 'Argentina', flag: '🇦🇷', status: 'active',
    regionLabelKey: 'searchPage.regionLabelProvince',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Russia — region + city
  {
    code: 'RU', name: 'Russia', flag: '🇷🇺', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Ukraine — oblast + city
  {
    code: 'UA', name: 'Ukraine', flag: '🇺🇦', status: 'active',
    regionLabelKey: 'searchPage.regionLabelOblast',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Greece — region + city
  {
    code: 'GR', name: 'Greece', flag: '🇬🇷', status: 'active',
    regionLabelKey: 'searchPage.regionLabelRegion',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },

  // Romania — county + city
  {
    code: 'RO', name: 'Romania', flag: '🇷🇴', status: 'active',
    regionLabelKey: 'searchPage.regionLabelCounty',
    subregionLabelKey: 'searchPage.subregionLabelCity',
  },
];

/** O(1) lookup by ISO code. */
export const COUNTRY_BY_CODE = new Map<string, CountryEntry>(
  COUNTRIES.map(c => [c.code, c])
);

/** Countries shown in the selector (excludes hidden). */
export const VISIBLE_COUNTRIES = COUNTRIES.filter(c => c.status !== 'hidden');

/** Countries with active support. */
export const ACTIVE_COUNTRIES = COUNTRIES.filter(c => c.status === 'active');
