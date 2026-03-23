/**
 * Country-aware location dataset loader.
 *
 * All selectable countries have a structured dataset — no free-text fallback.
 * Schema: { countryCode, regions[], subregions: Record<region, string[]> }
 *
 * Adding a new country:
 *   1. Create src/data/locations/<cc>.json with the unified schema.
 *   2. Import it below and add to LOCATION_DATASETS.
 *   3. Add/update the entry in src/config/countries.ts.
 *   Everything else (SearchPage, session restore, labels) adapts automatically.
 */

import turkeyRaw  from '@/data/turkey.json';
import usData     from '@/data/locations/us.json';
import gbData     from '@/data/locations/gb.json';
import deData     from '@/data/locations/de.json';
import frData     from '@/data/locations/fr.json';
import nlData     from '@/data/locations/nl.json';
import esData     from '@/data/locations/es.json';
import itData     from '@/data/locations/it.json';
import plData     from '@/data/locations/pl.json';
import aeData     from '@/data/locations/ae.json';
import saData     from '@/data/locations/sa.json';
import egData     from '@/data/locations/eg.json';
import ngData     from '@/data/locations/ng.json';
import zaData     from '@/data/locations/za.json';
import inData     from '@/data/locations/in.json';
import pkData     from '@/data/locations/pk.json';
import bdData     from '@/data/locations/bd.json';
import idData     from '@/data/locations/id.json';
import myData     from '@/data/locations/my.json';
import sgData     from '@/data/locations/sg.json';
import phData     from '@/data/locations/ph.json';
import auData     from '@/data/locations/au.json';
import caData     from '@/data/locations/ca.json';
import mxData     from '@/data/locations/mx.json';
import brData     from '@/data/locations/br.json';
import arData     from '@/data/locations/ar.json';
import ruData     from '@/data/locations/ru.json';
import uaData     from '@/data/locations/ua.json';
import grData     from '@/data/locations/gr.json';
import roData     from '@/data/locations/ro.json';

export interface LocationDataset {
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  /** Ordered list of first-level location names (state / province / emirate / region) */
  regions: string[];
  /**
   * Map from region name → list of second-level location names.
   * A region key absent from this map means no subregions for that region.
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
  US: usData as LocationDataset,
  GB: gbData as LocationDataset,
  DE: deData as LocationDataset,
  FR: frData as LocationDataset,
  NL: nlData as LocationDataset,
  ES: esData as LocationDataset,
  IT: itData as LocationDataset,
  PL: plData as LocationDataset,
  AE: aeData as LocationDataset,
  SA: saData as LocationDataset,
  EG: egData as LocationDataset,
  NG: ngData as LocationDataset,
  ZA: zaData as LocationDataset,
  IN: inData as LocationDataset,
  PK: pkData as LocationDataset,
  BD: bdData as LocationDataset,
  ID: idData as LocationDataset,
  MY: myData as LocationDataset,
  SG: sgData as LocationDataset,
  PH: phData as LocationDataset,
  AU: auData as LocationDataset,
  CA: caData as LocationDataset,
  MX: mxData as LocationDataset,
  BR: brData as LocationDataset,
  AR: arData as LocationDataset,
  RU: ruData as LocationDataset,
  UA: uaData as LocationDataset,
  GR: grData as LocationDataset,
  RO: roData as LocationDataset,
};

/**
 * Return structured location data for a country.
 * All selectable countries are in the registry — this returns null only for
 * truly unknown codes so callers never need to handle free-text fallback.
 */
export function getLocationData(countryCode: string): LocationDataset | null {
  return LOCATION_DATASETS[countryCode] ?? null;
}
