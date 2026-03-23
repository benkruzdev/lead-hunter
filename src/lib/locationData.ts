/**
 * Country-aware location dataset loader.
 *
 * Provides structured region/subregion data for countries that have it.
 * Returns null for countries without a structured dataset — SearchPage
 * uses free-text inputs in that case.
 *
 * Schema contract:
 *   regions    — ordered list of first-level location names (province/state/emirate)
 *   subregions — map from region name → list of second-level names (district/city/area)
 *
 * Adding a new country:
 *   1. Import your raw data file (any shape is fine — transform it here).
 *   2. Add an entry to LOCATION_DATASETS keyed by ISO 3166-1 alpha-2.
 *   3. Set hasSubregions: true in src/config/countries.ts.
 *   That's all — SearchPage, session restore, and labels adapt automatically.
 */

import turkeyRaw from '@/data/turkey.json';

export interface LocationDataset {
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  /** Ordered list of first-level location names */
  regions: string[];
  /**
   * Map from region name → list of second-level location names.
   * A region key missing from this map means no subregions for that region.
   */
  subregions: Record<string, string[]>;
}

// ── Turkey ────────────────────────────────────────────────────────────────────
const TR_DATASET: LocationDataset = {
  countryCode: 'TR',
  regions: (turkeyRaw as any).provinces.map((p: any) => p.name as string),
  subregions: Object.fromEntries(
    (turkeyRaw as any).provinces.map((p: any) => [p.name, p.districts as string[]])
  ),
};

// ── Registry ──────────────────────────────────────────────────────────────────
const LOCATION_DATASETS: Record<string, LocationDataset> = {
  TR: TR_DATASET,
  // Future countries:
  // DE: DE_DATASET,
  // US: US_DATASET,
};

/**
 * Return structured location data for a country, or null if none exists.
 * null → SearchPage renders free-text city/district inputs.
 */
export function getLocationData(countryCode: string): LocationDataset | null {
  return LOCATION_DATASETS[countryCode] ?? null;
}
