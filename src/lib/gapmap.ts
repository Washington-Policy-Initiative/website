/**
 * Washington Library Gap Map: build-time data.
 *
 * Reads the CSV and GeoJSON copied from the original project (src/data/gapmap/) and
 * turns them into (1) the figures and table rendered into the page's HTML, and
 * (2) the compact JSON the page's script loads for the map, report, and charts.
 * Runs only at build time (in Node), so no CSV parser ships to the browser.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/*
 * Data files are read from the project root (where `astro dev` and `astro build` run),
 * not relative to this module: Astro bundles this module into a temporary folder.
 */
const dataFile = (name: string) => path.join(process.cwd(), 'src', 'data', 'gapmap', name);

export const YEARS = [
  '2015-16',
  '2016-17',
  '2017-18',
  '2018-19',
  '2019-20',
  '2020-21',
  '2021-22',
  '2022-23',
  '2023-24',
  '2024-25',
] as const;
export const LATEST = YEARS.length - 1;
/** "2024-25" -> "2024–25" (en dash) for display. */
export const yearLabel = (y: string) => y.replace('-', '–');

/** The six locale groups, in the original project's order (rural to urban). */
export const TIERS = ['Distant Rural', 'Rural', 'Mid-size', 'Suburban', 'Urban', 'Large Urban'] as const;
export type Tier = (typeof TIERS)[number];

/** NCES locale categories behind each group (for the About the data section). */
export const TIER_DEFINITIONS: { tier: Tier; nces: string }[] = [
  { tier: 'Distant Rural', nces: 'Rural: Distant (42) and Rural: Remote (43)' },
  { tier: 'Rural', nces: 'Rural: Fringe (41)' },
  { tier: 'Mid-size', nces: 'Town: Fringe, Distant, and Remote (31–33)' },
  { tier: 'Suburban', nces: 'Suburb: Large, Midsize, and Small (21–23)' },
  { tier: 'Urban', nces: 'City: Midsize and Small (12–13)' },
  { tier: 'Large Urban', nces: 'City: Large (11)' },
];

/** Staffing categories used on the map (2024–25). */
export type StaffingCategory = 'full' | 'part' | 'none';
export const CATEGORY_LABELS: Record<StaffingCategory, string> = {
  full: 'At least one full-time librarian (1.0 FTE or more)',
  part: 'Part-time librarian (less than 1.0 FTE)',
  none: 'No librarian',
};
export const categoryOf = (fte: number | null): StaffingCategory =>
  fte !== null && fte >= 1 ? 'full' : fte !== null && fte > 0 ? 'part' : 'none';

/** Display names that need fixing beyond removing the "(WA)" suffix. */
const NAME_OVERRIDES: Record<string, string> = {
  'Wa State Center For Childhood Deafness And Hearing Loss':
    'Washington State Center for Childhood Deafness and Hearing Loss',
  'Office Of The Governor (Sch For Blind)': 'Office of the Governor (School for the Blind)',
};

export interface District {
  /** URL-safe id, used in ?district= links. */
  id: string;
  name: string;
  county: string | null;
  /** False for the three entities with no map shape. */
  hasShape: boolean;
  /** Per year (YEARS order). */
  fte: (number | null)[];
  studentsPerLibrarian: (number | null)[];
  librariansPerSchool: (number | null)[];
  tier: (Tier | null)[];
  /** 2024–25 Smarter Balanced ELA, % met standard (Level 3–4); null when not published. */
  grade4: number | null;
  grade8: number | null;
}

// ---------------------------------------------------------------------------
// Parsing (the files have no quoted fields; checked when they were copied)

function readCsv(name: string): Record<string, string>[] {
  const [head, ...lines] = readFileSync(dataFile(name), 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    if (cells.length !== cols.length) throw new Error(`${name}: unexpected column count in "${line}"`);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const SMALL_WORDS = /\s(Of|And|The|For)\s/g;
function displayName(raw: string): string {
  const base = raw.replace(/ \(WA\)$/, '');
  return NAME_OVERRIDES[base] ?? base.replace(SMALL_WORDS, (m) => m.toLowerCase());
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---------------------------------------------------------------------------
// Load everything once (module scope = once per build)

interface RawFeature {
  type: 'Feature';
  properties: { district: string; county: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}
const geo = JSON.parse(readFileSync(dataFile('wa_district_boundaries.geojson'), 'utf8')) as {
  features: RawFeature[];
};
const countyByRaw = new Map(geo.features.map((f) => [f.properties.district, f.properties.county]));

const rows = readCsv('wa_librarians_full.csv');
const byDistrict = new Map<string, Record<string, string>[]>();
for (const r of rows) {
  if (!byDistrict.has(r.district)) byDistrict.set(r.district, []);
  byDistrict.get(r.district)!.push(r);
}

export const districts: District[] = [...byDistrict.entries()]
  .map(([raw, list]) => {
    const forYear = (y: string) => list.find((r) => r.year === y);
    const latest = forYear(YEARS[LATEST]);
    const name = displayName(raw);
    return {
      id: slugify(name),
      name,
      county: countyByRaw.get(raw) ?? null,
      hasShape: countyByRaw.has(raw),
      fte: YEARS.map((y) => num(forYear(y)?.librarian_fte)),
      studentsPerLibrarian: YEARS.map((y) => num(forYear(y)?.students_per_librarian)),
      librariansPerSchool: YEARS.map((y) => num(forYear(y)?.librarians_per_school)),
      tier: YEARS.map((y) => {
        const t = forYear(y)?.locale_tier ?? '';
        return (TIERS as readonly string[]).includes(t) ? (t as Tier) : null;
      }),
      grade4: num(latest?.ela_pct_met_grade4),
      grade8: num(latest?.ela_pct_met_grade8),
      raw,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(({ raw: _raw, ...d }) => d);

if (new Set(districts.map((d) => d.id)).size !== districts.length) {
  throw new Error('Gap Map: two districts produced the same id');
}
const idByRaw = new Map([...byDistrict.keys()].map((raw) => [raw, slugify(displayName(raw))]));

/** OSPI's official statewide figures (enrollment-weighted), by year. */
const stateEla = new Map(readCsv('state_ela_trend.csv').map((r) => [r.year, r]));
export const STATE_READING_LATEST = {
  grade4: num(stateEla.get(YEARS[LATEST])?.grade4_pct_met),
  grade8: num(stateEla.get(YEARS[LATEST])?.grade8_pct_met),
};

// ---------------------------------------------------------------------------
// Figures

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const fteAt = (d: District, i: number) => d.fte[i] ?? 0;

export function statewide(i: number) {
  const total = sum(districts.map((d) => fteAt(d, i)));
  const zero = districts.filter((d) => fteAt(d, i) === 0).length;
  return { total, zero, count: districts.length };
}

const first = statewide(0);
const last = statewide(LATEST);
const ratios = districts
  .map((d) => d.studentsPerLibrarian[LATEST])
  .filter((v): v is number => v !== null)
  .sort((a, b) => a - b);

export const KEY_FIGURES = {
  zeroLatest: last.zero,
  zeroFirst: first.zero,
  count: last.count,
  zeroPctLatest: Math.round((last.zero / last.count) * 100),
  zeroPctFirst: Math.round((first.zero / first.count) * 100),
  fteFirst: first.total,
  fteLatest: last.total,
  fteChangePct: ((last.total - first.total) / first.total) * 100,
  medianStudentsPerLibrarian: ratios[Math.floor(ratios.length / 2)],
  districtsWithLibrarian: ratios.length,
};

export const CATEGORY_COUNTS: Record<StaffingCategory, number> = { full: 0, part: 0, none: 0 };
for (const d of districts) CATEGORY_COUNTS[categoryOf(d.fte[LATEST])] += 1;

export const UNMAPPED = districts.filter((d) => !d.hasShape).map((d) => d.name);

/** Percent change in FTE since 2015–16, or null when there was no librarian then. */
export function fteChangeSinceFirst(d: District): number | null {
  const f = d.fte[0];
  const l = d.fte[LATEST];
  if (f === null || f === 0 || l === null) return null;
  return ((l - f) / f) * 100;
}

// ---------------------------------------------------------------------------
// Payloads served next to the page (see src/pages/research/washington-library-gap-map/)

/** Everything the page script needs, compact (arrays by year, ids not names as keys). */
export function clientData() {
  return {
    years: YEARS,
    tiers: TIERS,
    stateReading: STATE_READING_LATEST,
    districts: districts.map((d) => ({
      id: d.id,
      name: d.name,
      county: d.county,
      shape: d.hasShape,
      fte: d.fte,
      spl: d.studentsPerLibrarian,
      lps: d.librariansPerSchool,
      tier: d.tier.map((t) => (t === null ? -1 : TIERS.indexOf(t))),
      g4: d.grade4,
      g8: d.grade8,
    })),
  };
}

/**
 * District shapes for the map. Longitudes are scaled by cos(mean latitude) so the map
 * can be drawn with a simple flat projection without looking stretched (the same
 * correction the original project used), coordinates are rounded to 0.001° (about
 * 100 m, finer than a screen pixel at this scale), and each shape carries only its
 * district id.
 */
export function mapShapes() {
  let minLat = Infinity;
  let maxLat = -Infinity;
  const walkLat = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const lat = (c as number[])[1];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else (c as unknown[]).forEach(walkLat);
  };
  geo.features.forEach((f) => walkLat(f.geometry.coordinates));
  const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const round = (v: number) => Math.round(v * 1000) / 1000;

  const ring = (pts: number[][]) => {
    const out: number[][] = [];
    for (const [lon, lat] of pts) {
      const p = [round(lon * cosLat), round(lat)];
      const prev = out[out.length - 1];
      if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
    }
    return out.length >= 4 ? out : null;
  };
  const polygon = (rings: number[][][]) => {
    const kept = rings.map(ring).filter((r): r is number[][] => r !== null);
    return kept.length ? kept : null;
  };

  return {
    type: 'FeatureCollection',
    features: geo.features.flatMap((f) => {
      const id = idByRaw.get(f.properties.district);
      if (!id) throw new Error(`Gap Map: map shape "${f.properties.district}" has no data`);
      const g = f.geometry;
      const coordinates =
        g.type === 'Polygon'
          ? polygon(g.coordinates as number[][][])
          : (g.coordinates as number[][][][]).map(polygon).filter((p) => p !== null);
      if (!coordinates || (Array.isArray(coordinates) && coordinates.length === 0)) return [];
      return [{ type: 'Feature', properties: { id }, geometry: { type: g.type, coordinates } }];
    }),
  };
}
