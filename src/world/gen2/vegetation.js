// @ts-check
// WG2 VEGETATION ("Plants"): which plant stands where, from each species' needs
// (data/species.json) - its warmth, its water, its soil, its slope and height, its sun - against the environment at the
// point. Plants grow in groves (a slow field at the species' cluster scale), not in an even sprinkle; a tree keeps its
// spacing from every tree placed before it, the taller kinds first. Pure in the point and the bake: the same rectangle
// grows the same plants on every machine, and `plantProblems` says which need a plant breaks (none, for any it placed).
import { rand01, noise2, seedOf, smoothExact } from './exact.js';
import { BIOME_TABLE, SOILS, species as speciesOf } from './tables.js';
import { TERRAIN_SIZE as PIXEL_M } from './../terrain/terrainSampler.js';   // a world pixel's metres
import { WATER_KIND } from './hydrology.js';

/** The kinds in the order they claim ground. */
const KIND_ORDER = Object.freeze(['tree', 'fungus', 'shrub', 'reed', 'grass']);
/** The water a wetland or a flood plain gives a plant, as if it were more rain (mm a year). */
export const GROUND_WATER_MM = 700;

/** The environment a plant reads at a world point. @param {import('./regionSampler.js').RegionSampler} s @param {number} x @param {number} y */
export function plantSite(s, x, y) {
  const e = /** @type {any} */ (s.env(x, y));
  const wet = e.water & (WATER_KIND.wetland | WATER_KIND.floodplain) ? GROUND_WATER_MM : 0;
  return { temp: e.temp, precip: e.precip + wet, soil: SOILS[e.soil].key, slope: s.slopeAt(x, y), elev: s.heightAt(x, y), solar: e.solar,
    biome: BIOME_TABLE[e.biome].key, water: (reach) => s.waterNear(x, y, reach), inWater: !!s.waterAt(x, y) };
}

/** Which of a species' needs the site breaks: none, where it may grow. @param {import('./tables.js').Species} sp @param {ReturnType<typeof plantSite>} site */
export function speciesProblems(sp, site) {
  const out = [];
  if (site.inWater && sp.kind !== 'reed') out.push('in water');
  if (site.temp < sp.temp[0] || site.temp > sp.temp[1]) out.push('temp');
  if (sp.water !== 'needs' && (site.precip < sp.precip[0] || site.precip > sp.precip[1])) out.push('precip');
  if (!sp.soils.includes(site.soil)) out.push('soil');
  if (site.slope > sp.slope) out.push('slope');
  if (site.elev > sp.elev) out.push('elev');
  if (sp.water === 'needs' && !(site.water(/** @type {number} */ (sp.reach)) <= /** @type {number} */ (sp.reach))) out.push('water');
  if (sp.sun === 'full' && site.solar < 0.55) out.push('sun');
  return out;
}

/**
 * The plants in a rectangle of world pixels: `{ species, x, y, scale }`. Each species of the biomes present walks its
 * own lattice (its spacing a side, jittered); a lattice point grows with the chance the species' density gives it,
 * thinned by its grove field and by how well it is suited (water it merely likes counts double near water).
 * @param {import('./regionSampler.js').RegionSampler} s @param {{ x: number, y: number, w: number, h: number }} r @param {{ cap?: number }} [o]
 */
export function plantsIn(s, r, o = {}) {
  const seed = seedOf(s.header.seed, 'plants'), cap = o.cap ?? 200000, out = [];
  const kinds = new Set();
  for (let y = Math.floor(r.y); y < r.y + r.h; y++) for (let x = Math.floor(r.x); x < r.x + r.w; x++) {
    if (!s.owns(x + 0.5, y + 0.5)) continue;
    for (const b of [BIOME_TABLE[/** @type {any} */ (s.env(x + 0.5, y + 0.5)).biome], BIOME_TABLE[/** @type {any} */ (s.env(x, y)).biome]]) for (const k of b.species) kinds.add(k);
  }
  const list = [...kinds].map(speciesOf).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.spacing - a.spacing || (a.key < b.key ? -1 : 1));
  /** @type {Map<number, { x: number, y: number, sp: number }[]>} the trees placed, filed by 20 m square */
  const trees = new Map(), BUCKET = 20 / PIXEL_M;
  const crowded = (x, y, sp) => {
    const bx = Math.floor(x / BUCKET), by = Math.floor(y / BUCKET), reach = Math.ceil(sp / 20);
    for (let j = by - reach; j <= by + reach; j++) for (let i = bx - reach; i <= bx + reach; i++) {
      for (const t of trees.get(j * 1048576 + i) ?? []) { const d = Math.sqrt((t.x - x) * (t.x - x) + (t.y - y) * (t.y - y)) * PIXEL_M; if (d < Math.max(sp, t.sp) * 0.8) return true; }
    }
    return false;
  };
  list.forEach((sp, si) => {
    const step = Math.max(2, sp.spacing) / PIXEL_M, chance = Math.min(1, (sp.density * sp.spacing * sp.spacing) / 10000);
    const i0 = Math.floor(r.x / step), i1 = Math.ceil((r.x + r.w) / step), j0 = Math.floor(r.y / step), j1 = Math.ceil((r.y + r.h) / step);
    for (let j = j0; j < j1 && out.length < cap; j++) for (let i = i0; i < i1; i++) {
      const x = (i + rand01(seed, si, i, j, 1)) * step, y = (j + rand01(seed, si, i, j, 2)) * step;
      if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h || !s.owns(x, y)) continue;
      const grove = smoothExact(-0.15, 0.45, noise2(seed + si * 131, (x * PIXEL_M) / sp.cluster, (y * PIXEL_M) / sp.cluster));
      if (rand01(seed, si, i, j, 3) >= chance * grove) continue;
      const biome = BIOME_TABLE[/** @type {any} */ (s.env(x, y)).biome];
      if (!biome.species.includes(sp.key)) continue;
      const site = plantSite(s, x, y);
      if (speciesProblems(sp, site).length) continue;
      if (sp.kind === 'tree' || sp.kind === 'fungus') {
        if (crowded(x, y, sp.spacing)) continue;
        const k = Math.floor(y / BUCKET) * 1048576 + Math.floor(x / BUCKET), b = trees.get(k);
        if (b) b.push({ x, y, sp: sp.spacing }); else trees.set(k, [{ x, y, sp: sp.spacing }]);
      }
      out.push({ species: sp.key, x, y, scale: 0.8 + 0.4 * rand01(seed, si, i, j, 4) });
    }
  });
  return out;
}

/** Which of its needs a placed plant breaks (none for any `plantsIn` placed). @param {import('./regionSampler.js').RegionSampler} s @param {{ species: string, x: number, y: number }} p */
export const plantProblems = (s, p) => speciesProblems(speciesOf(p.species), plantSite(s, p.x, p.y));
