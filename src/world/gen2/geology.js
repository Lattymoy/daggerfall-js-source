// @ts-check
// WG2 GEOLOGY (Phase 2): the canon laid on a region's grid, the rocks under it and the
// land before the water works it. Terranes are a warped Voronoi on ONE lattice over the whole world, so a rock's edge
// runs on across two regions' seam. A range is the canon's spine raised as ridges that run along it (ridged noise
// stretched along the spine), not as cones; the hills' height follows the rock's hardness; hard flat-bedded rock
// in a dry land stands as benches and mesas.
import { Field, D8X, D8Y } from './field.js';
import { canonTheatre, canonRelief, canonRange, worldToPicture, segmentD2 } from './canon.js';
import { nodeGround } from '../landforms.js';
import { SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } from '../terrain/terrainSampler.js';
import { MOUNTAIN_RANGES } from '../tamriel/tamrielGeography.js';
import { fbmExact, ridgedExact, noise2, rand01, seedOf, smoothExact, clampExact } from './exact.js';
import { ROCKS, rock as rockOf, provinceProfile } from './tables.js';
import { routeFlow, hollowsOf } from './drainage.js';

/** @typedef {import('./canon.js').Fit} Fit */
/** @typedef {{ name: string, w: number, gain: number, pts: number[][] }} AuthoredRange world pixels: half-width w, spine pts */
/** @typedef {{ id: string, rect: { x: number, y: number, w: number, h: number }, res: number, seed: number, fit: Fit,
 *   ranges?: AuthoredRange[], springs?: { name: string, x: number, y: number, flow: number }[], erosion?: { steps?: number, k?: number } }} RegionSpec */

/** Metres over the sea for a WOODS byte, by the far views' law (landforms.js nodeGround, the lift past the Bay whole). */
export const byteMetres = (b) => (nodeGround(b, 1, 1) - SCALED_OCEAN_ELEVATION) * STREAMING_TERRAIN_SCALE;

/** The grid of a region: its size in cells, a cell's metres and a cell's centre in world pixels. @param {RegionSpec} spec */
export function regionGrid(spec) {
  const w = spec.rect.w * spec.res, h = spec.rect.h * spec.res;
  return { w, h, cellM: 819.2 / spec.res, frame: { x0: spec.rect.x, y0: spec.rect.y, res: spec.res },
    /** @param {number} i @param {number} j @returns {[number, number]} */
    centre: (i, j) => [spec.rect.x + (i + 0.5) / spec.res, spec.rect.y + (j + 0.5) / spec.res] };
}

/**
 * THE CANON ON THE GRID: each cell's theatre (0 at sea), the relief in metres, the strongest range's lift (0..1, the
 * canon's spines and the region's own authored ones) and the spine's direction there.
 * @param {RegionSpec} spec
 */
export function canonGrid(spec) {
  const g = regionGrid(spec);
  const theatre = new Field(g.w, g.h, g.frame, Uint8Array), relief = new Field(g.w, g.h, g.frame);
  const lift = new Field(g.w, g.h, g.frame), dirX = new Field(g.w, g.h, g.frame), dirY = new Field(g.w, g.h, g.frame);
  const own = (spec.ranges ?? []).flatMap((r) => r.pts.slice(1).map((b, i) => ({ r, ax: r.pts[i][0], ay: r.pts[i][1], bx: b[0], by: b[1] })));
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    const [x, y] = g.centre(i, j), [px, py] = worldToPicture(spec.fit, x, y), k = j * g.w + i;
    theatre.data[k] = canonTheatre(px, py);
    relief.data[k] = byteMetres(canonRelief(px, py));
    const c = canonRange(px, py);
    let best = c.lift, dx = 0, dy = 0;
    if (c.range >= 0) [dx, dy] = spineDir(MOUNTAIN_RANGES[c.range].pts, px, py);
    for (const s of own) {
      const d2 = segmentD2(x, y, s.ax, s.ay, s.bx, s.by);
      if (d2 >= s.r.w * s.r.w) continue;
      const l = s.r.gain * (1 - Math.sqrt(d2) / s.r.w);
      if (l > best) { best = l; [dx, dy] = unit(s.bx - s.ax, s.by - s.ay); }
    }
    lift.data[k] = best; dirX.data[k] = dx; dirY.data[k] = dy;
  }
  return { theatre, relief, lift, dirX, dirY };
}

const unit = (x, y) => { const l = Math.sqrt(x * x + y * y); return l > 0 ? [x / l, y / l] : [1, 0]; };
/** The direction of a spine's segment nearest a picture point. */
function spineDir(pts, px, py) {
  let best = Infinity, d = [1, 0];
  for (let i = 0; i + 1 < pts.length; i++) {
    const d2 = segmentD2(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d2 < best) { best = d2; d = unit(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); }
  }
  return d;
}

/** Terranes: one seed a lattice cell of this many world pixels. */
export const TERRANE_PX = 20;
/** The land at or over this many metres is upland, a range's band where the lift passes RANGE_LIFT. */
export const UPLAND_M = 900;
export const RANGE_LIFT = 0.25;

/** A weighted draw from a suite ({ key: weight }) by a uniform number. @param {Record<string, number>} suite @param {number} u */
function draw(suite, u) {
  const keys = Object.keys(suite).sort();
  let total = 0;
  for (const k of keys) total += suite[k];
  let t = u * total;
  for (const k of keys) { t -= suite[k]; if (t < 0) return k; }
  return keys[keys.length - 1];
}

/** The rock of the terrane seed in lattice cell (a, b): its province's suite for the seed's setting. Pure in the world:
 *  the same seed answers the same rock from any region. @param {RegionSpec} spec @param {number} a @param {number} b */
export function terraneSeed(spec, a, b) {
  const seed = seedOf(spec.seed, 'terrane');
  const x = (a + 0.15 + 0.7 * rand01(seed, a, b, 1)) * TERRANE_PX, y = (b + 0.15 + 0.7 * rand01(seed, a, b, 2)) * TERRANE_PX;
  const [px, py] = worldToPicture(spec.fit, x, y);
  const t = canonTheatre(px, py), prof = provinceProfile(t), relief = byteMetres(canonRelief(px, py)), range = canonRange(px, py).lift;
  const setting = range > RANGE_LIFT ? 'range' : relief > UPLAND_M ? 'upland' : 'lowland';
  return { x, y, rock: rockOf(draw(prof.rocks[setting] ?? prof.rocks.lowland, rand01(seed, a, b, 3))).id, setting };
}

/**
 * THE ROCKS AND THE LAND BEFORE THE WATER: `rock` (data/rocks.json ids), `uplift` (0..1, where the land is being
 * raised - the ranges and the uplands - so erosion keeps their tops), and `elev` in metres over the sea.
 * @param {RegionSpec} spec @param {ReturnType<typeof canonGrid>} canon
 */
export function geology(spec, canon) {
  const g = regionGrid(spec), seed = seedOf(spec.seed, 'geology');
  const rock = new Field(g.w, g.h, g.frame, Uint8Array), uplift = new Field(g.w, g.h, g.frame), elev = new Field(g.w, g.h, g.frame);
  /** @type {Map<string, ReturnType<typeof terraneSeed>>} */
  const seeds = new Map();
  const seedAt = (a, b) => { const k = `${a},${b}`; let s = seeds.get(k); if (!s) seeds.set(k, s = terraneSeed(spec, a, b)); return s; };
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    const [x, y] = g.centre(i, j), k = j * g.w + i, t = canon.theatre.data[k];
    // the terrane: the nearest seed to the point moved by a slow warp, so the rocks' edges wander
    const wx = x + 0.35 * TERRANE_PX * fbmExact(seed + 1, x / 40, y / 40, 3), wy = y + 0.35 * TERRANE_PX * fbmExact(seed + 2, x / 40, y / 40, 3);
    const a0 = Math.floor(wx / TERRANE_PX), b0 = Math.floor(wy / TERRANE_PX);
    let best = Infinity, r = 0;
    for (let b = b0 - 1; b <= b0 + 1; b++) for (let a = a0 - 1; a <= a0 + 1; a++) {
      const s = seedAt(a, b), d = (s.x - wx) * (s.x - wx) + (s.y - wy) * (s.y - wy);
      if (d < best) { best = d; r = s.rock; }
    }
    rock.data[k] = r;
    const rk = ROCKS[r], prof = provinceProfile(t), L = canon.lift.data[k], base = canon.relief.data[k];
    if (t === 0) { elev.data[k] = Math.min(base, -4); continue; }
    const dx = canon.dirX.data[k], dy = canon.dirY.data[k];
    // a range: ridges that run with the spine (stretched 2.5 to 1 along it, the frame warped so they wander and branch)
    // over isotropic crests for the spurs between them
    const wu = 1.6 * fbmExact(seed + 7, x / 22, y / 22, 2), wv = 1.6 * fbmExact(seed + 8, x / 22, y / 22, 2);
    const u = (x * dx + y * dy) / 15 + wu, v = (-x * dy + y * dx) / 6 + wv;
    const crest = 0.65 * ridgedExact(seed + 3, u, v, 4) + 0.35 * ridgedExact(seed + 9, x / 7, y / 7, 3);
    const rangeM = L > 0 ? prof.range * L * (0.45 + 0.55 * crest) * smoothExact(0, 0.35, L) : 0;
    const upland = smoothExact(UPLAND_M * 0.6, UPLAND_M * 1.4, base);
    const amp = prof.rugged * (40 + 110 * upland + 160 * L) * (0.45 + 0.55 * rk.hardness);
    let e = base + rangeM + amp * fbmExact(seed + 4, x / 9, y / 9, 5);
    // benches and mesas: flat-bedded rock in a dry land stands in steps where a slow mask says so
    if (rk.terrace && prof.precip < 600) {
      const mask = smoothExact(0.1, 0.45, fbmExact(seed + 5, x / 50, y / 50, 2));
      if (mask > 0) {
        const step = 45 + 25 * rk.hardness, q = e / step, f = q - Math.floor(q);
        const stepped = (Math.floor(q) + smoothExact(0.72, 0.95, f)) * step;
        e += (stepped - e) * mask;
      }
    }
    elev.data[k] = e;
    uplift.data[k] = clampExact(0.75 * L + 0.25 * upland, 0, 1);
  }
  infillCanon(spec, canon, elev);
  return { rock, uplift, elev };
}

/** `infill` with the canon's sea and the provinces' dryness. @param {RegionSpec} spec @param {ReturnType<typeof canonGrid>} canon @param {Field} elev */
export function infillCanon(spec, canon, elev) {
  infill(elev, regionGrid(spec).cellM, (k) => canon.theatre.data[k] === 0, (k) => provinceProfile(canon.theatre.data[k]).precip < ARID_MM, seedOf(spec.seed, 'infill'));
}

/** The wet lowlands' hollows, laid after the last fill: small closed basins that hold ponds and pools (a province whose
 *  `wet` is half or more). @param {RegionSpec} spec @param {ReturnType<typeof canonGrid>} canon @param {Field} elev */
export function wetHollows(spec, canon, elev) {
  const g = regionGrid(spec), seed = seedOf(spec.seed, 'geology');
  for (let k = 0; k < elev.data.length; k++) {
    const prof = provinceProfile(canon.theatre.data[k]);
    if (prof.wet < 0.5 || !canon.theatre.data[k]) continue;
    const [x, y] = g.centre(k % g.w, (k / g.w) | 0), upland = smoothExact(UPLAND_M * 0.6, UPLAND_M * 1.4, canon.relief.data[k]);
    elev.data[k] -= prof.wet * 7 * clampExact(noise2(seed + 6, x * 1.3, y * 1.3), 0, 1) * (1 - upland);
  }
}

/** Before the water works the land every closed hollow is filled to its spill - the alluvium of ages, an intermontane
 *  flat where a range's troughs closed - save a dry land's great basins: this deep, this wide (km2), and in a province
 *  under ARID_MM, where a basin keeps its water to the air and stays closed. */
export const BASIN_DEPTH = 45;
export const BASIN_KM2 = 60;
export const ARID_MM = 500;
/** Fill the hollows of `elev` in place, graded toward the spill so the water finds its way across.
 *  @param {Field} elev @param {number} cellM @param {(k: number) => boolean} isSea @param {(k: number) => boolean} arid */
export function infill(elev, cellM, isSea, arid, seed = 0) {
  const rt = routeFlow(elev, cellM, isSea), cellKm2 = (cellM * cellM) / 1e6, w = elev.w;
  const steps = new Int32Array(elev.data.length).fill(-1);
  for (const hw of hollowsOf(rt, elev)) {
    if (hw.deep >= BASIN_DEPTH && hw.cells.length * cellKm2 >= BASIN_KM2 && arid(hw.outlet)) continue;
    // the fill falls gently to its spill (FLAT_RISE over its reach) with a grain of its own, so a stream across it finds
    // its own way and never a straight line; a pit the grain leaves is the drainage's to fill
    const inside = new Set(hw.cells), q = [hw.outlet];
    steps[hw.outlet] = 0;
    for (let c = 0; c < q.length; c++) {
      const k = q[c], ki = k % w, kj = (k / w) | 0;
      for (let d = 0; d < 8; d++) {
        const nk = (kj + D8Y[d]) * w + ki + D8X[d];
        if (inside.has(nk) && steps[nk] < 0) { steps[nk] = steps[k] + 1; q.push(nk); }
      }
    }
    const far = steps[q[q.length - 1]] || 1, level = rt.filled[hw.outlet];
    for (const c of hw.cells) {
      const x = elev.x0 + ((c % w) + 0.5) / elev.res, y = elev.y0 + (((c / w) | 0) + 0.5) / elev.res;
      elev.data[c] = level + FLAT_RISE * (steps[c] / far) + FLAT_GRAIN * fbmExact(seed + 11, x / 3, y / 3, 3);
    }
  }
}
/** A filled flat's fall from its far side to its spill, and the grain on it, metres. */
export const FLAT_RISE = 4;
export const FLAT_GRAIN = 1.2;
