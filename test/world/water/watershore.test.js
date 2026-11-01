// WATER-SHORE (2026-11-01, the owner after WATER-LEVEL: "It still looks tiled on the shorelines"): A SHORE IS A LINE, NOT A
// TILE'S EDGE (world/water/waterLevel.js shoreMap, render/waterSurface.js, render/groundEdgeGlsl.js shoreGlsl). The sea
// Deep Waters carved is the terrain's sheet's open sea, so a coast has one water and one edge; the cut field is smoothed,
// so that edge - and the silt and a shore's two kinds under it - is a curve. The record: bible/07-Rendering/Water-Arc.md
// WATER-SHORE. Mutants: tools/mutants/watershore.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waterVotes, shoreMap, fanCut, seaLevelAt, SEA_LEVEL_Y, SHORE_SIGMA, SHORE_HOLD, OPEN_SIGMA, RISE_SIGMA, RISE_MAX } from '../../../src/world/water/waterLevel.js';
import { waterBedOf, flatGrid } from '../../../src/world/water/waterBed.js';
import { streamLevelAt } from '../../../src/world/water/streamLevels.js';
import { inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { WATER_DRAW_MASK_TABLE, packWaterMask } from '../../../src/world/water/waterCorners.js';
import { CLIP_SENTINEL } from '../../../src/world/terrain/terrainSurface.js';
import { WATER_SURFACE_VS, waterSurfaceFs, WATER_SHORE_UNIT, OPEN_PATH, WATER_LIFT, RISE_FADE, SHORE_SOFTNESS, WATER_ABSORB } from '../../../src/render/waterSurface.js';
import { shoreGlsl, groundWanderGlsl, groundKindsGlsl, groundEdgeGlsl } from '../../../src/render/groundEdgeGlsl.js';
import { WATER_BED_GLSL } from '../../../src/render/waterBedGlsl.js';
import { EDGE_NOISE_GLSL, roadEdgeGlsl } from '../../../src/render/roadEdgeGlsl.js';
import { EL_TERRAIN_FS } from '../../../src/render/enhancedLighting.js';
import { groundEdgeWander, GROUND_EDGE, groundKindsOf, coastCutAt } from '../../../src/world/terrain/groundEdge.js';
import { Renderer } from '../../../src/render/renderer.js';
import { glslFunctions } from '../../glsl.mjs';
import { hostText } from '../../hostText.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const DRY = 2 << 2;
/** The draw's byte for a tile whose water corners are `bits` (bit 0 (0,0), 1 (1,0), 2 (0,1), 3 (1,1)). */
const BYTE = new Map();
for (let b = 0; b < 256; b++) if (!BYTE.has(WATER_DRAW_MASK_TABLE[b]) && [0, 5, 6, 7, 48, 2].includes(b >> 2)) BYTE.set(WATER_DRAW_MASK_TABLE[b], b);
/** A T x T map marched from a corner's water (a coast the kernel lays), or whole tiles. */
const marched = (T, wet) => { const b = new Uint8Array(T * T); for (let z = 0; z < T; z++) for (let x = 0; x < T; x++) b[z * T + x] = BYTE.get((wet(x, z) ? 1 : 0) | (wet(x + 1, z) ? 2 : 0) | (wet(x, z + 1) ? 4 : 0) | (wet(x + 1, z + 1) ? 8 : 0)); return b; };
const tiles = (T, wet) => { const b = new Uint8Array(T * T).fill(DRY); for (let z = 0; z < T; z++) for (let x = 0; x < T; x++) if (wet(x, z)) b[z * T + x] = 0; return b; };
/** A sheet's smoothed cut (r) at a tile coordinate, bilinear as the GPU reads it, -1 wet .. 1 dry. */
const field = (sheet, u, v) => {
  const { w, h, data } = sheet.shore, x = Math.min(w - 1.001, Math.max(0, 2 * u)), z = Math.min(h - 1.001, Math.max(0, 2 * v)), i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const at = (a, b) => data[(b * w + a) * 4] / 127.5 - 1;
  return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fz) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fz;
};
/** The fan's own cut at a tile coordinate (the vertices' and the centres', as waterSheet lays them). */
const fan = (sheet, T, u, v) => {
  const g = T + 1, x = Math.min(T - 1, Math.floor(u)), z = Math.min(T - 1, Math.floor(v)), i0 = z * g + x;
  let c = null;
  for (let t = 0; t < sheet.indices.length; t += 12) if (sheet.indices[t + 1] === i0) { c = sheet.indices[t]; break; }
  const k = (i) => (sheet.positions[i * 3 + 1] === 0 && sheet.cut[i] === 0 ? 1 : sheet.cut[i]);
  return c == null ? 1 : fanCut(k(i0), k(i0 + 1), k(i0 + g), k(i0 + g + 1), sheet.cut[c], u - x, v - z);
};
/** Where a row's water ends: the first point along z = v, walking +x, that the field calls dry. */
const shoreX = (f, v, T) => { for (let u = 0; u < T; u += 1 / 64) if (f(u, v) >= 0) return u; return T; };

test('WATER-SHORE the sea Deep Waters carved is the sheet\'s: a clip votes water at every corner and its quad is drawn - one water to the coast, never a sheet that stops at the clip\'s tiles; each vertex carries the clip\'s share about it and whether it stands at the sea\'s level (mutants: the clip voting dry; the clip\'s quad skipped; the share\'s tiles; the sea unmarked)', () => {
  const T = 8, b = tiles(T, (x) => x < 6);
  for (let z = 0; z < T; z++) for (let x = 0; x < 4; x++) b[z * T + x] = CLIP_SENTINEL;   // the carved sea west of x 4, the shallows to 6
  const s = waterBedOf(flatGrid(T, T, SEA_LEVEL_Y), b, { tileDim: T, levelAt: (vx, vz, y) => seaLevelAt(y) }).sheet, g = T + 1;
  assert.equal(waterVotes(b, { tileDim: T })[3 * g + 2], 1, 'a vertex among clips: wholly water');
  const quads = new Set(); for (let t = 1; t < s.indices.length; t += 12) quads.add(s.indices[t]);
  for (let x = 0; x < 6; x++) assert.ok(quads.has(3 * g + x), `the quad over tile (${x}, 3) - clip or shallows - stands`);
  const centre = (x, z) => { for (let t = 0; t < s.indices.length; t += 12) if (s.indices[t + 1] === z * g + x) return s.indices[t]; return -1; };
  assert.equal(s.sea[centre(1, 3) * 2], 1, 'a clip\'s middle: the clip whole');
  assert.equal(s.sea[centre(5, 3) * 2], 0, 'the shallows\' middle: none');
  assert.equal(s.sea[(3 * g + 4) * 2], 0.5, 'the clip\'s edge: half the tiles about it');
  assert.equal(s.sea[(3 * g + 2) * 2], 1);
  assert.equal(s.sea[0], 1, 'the map\'s corner: its one tile, a clip');
  for (const i of [3 * g + 1, 3 * g + 5, centre(2, 2)]) assert.equal(s.sea[i * 2 + 1], 1, 'every vertex at the sea\'s level is the sea\'s');
  const lake = waterBedOf(flatGrid(T, T, 50), tiles(T, (x) => x < 6), { tileDim: T }).sheet;
  assert.ok([...lake.sea].every((v) => v === 0), 'a lake above the sea: neither');
});

test('WATER-SHORE the shore is a line, not a tile\'s edge: the fan\'s field on a lattice of half tiles, blurred by SHORE_SIGMA and held within SHORE_HOLD of itself - a marched coast\'s staircase straightened, a straight shore where it was; a stream a tile wide keeps its heart and a lone pool its middle (mutants: the blur\'s spread; the hold dropped; the edge\'s middle; the centre\'s place)', () => {
  assert.equal(SHORE_SIGMA, 0.6); assert.equal(SHORE_HOLD, 0.7); assert.equal(OPEN_SIGMA, 1);
  const T = 40;
  // a coast at 2 in 1 across the tiles, marched as the kernel lays one: the fan's line steps, the smoothed one runs on
  const coast = waterBedOf(flatGrid(T, T, 10), marched(T, (x, z) => x + 2.13 * z < 40), { tileDim: T }).sheet;
  // the wobble: the shore's distance from its own straight line, across it (a tile's width the unit), its root mean square
  const line = (f) => { const xs = []; for (let v = 4; v < 14; v += 1 / 8) xs.push((shoreX(f, v, T) + 2.13 * v) / Math.hypot(1, 2.13)); const m = xs.reduce((a, b) => a + b) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
  const rough = line((u, v) => fan(coast, T, u, v)), smooth = line((u, v) => field(coast, u, v));
  assert.ok(smooth < rough * 0.65 && smooth < 0.13, `the staircase straightened: its wobble ${smooth.toFixed(3)} of a tile against the fan's ${rough.toFixed(3)}`);
  // a straight shore: where it was
  const straight = waterBedOf(flatGrid(T, T, 10), tiles(T, (x) => x < 20), { tileDim: T }).sheet;
  for (const v of [5.5, 20.25, 33.7]) assert.ok(Math.abs(shoreX((u, w) => field(straight, u, w), v, T) - 20) < 0.1, `a straight shore stays at its tiles' edge, within a tenth of a tile (z ${v})`);
  // a stream a tile wide and a pool a tile square: their hearts kept
  const thin = waterBedOf(flatGrid(T, T, 10), tiles(T, (x, z) => (x === 10 && z > 3 && z < 36) || (x === 30 && z === 30)), { tileDim: T }).sheet;
  for (let z = 5; z < 35; z++) assert.ok(field(thin, 10.5, z + 0.5) < 0, `the stream's heart, tile ${z}`);
  assert.ok(field(thin, 30.5, 30.5) < 0, 'the pool\'s middle');
  // the hold: never farther from the fan than SHORE_HOLD
  for (let u = 0.25; u < T; u += 0.5) for (let v = 0.25; v < T; v += 0.5) assert.ok(Math.abs(field(thin, u, v) - fan(thin, T, u, v)) <= SHORE_HOLD + 0.02, `held at (${u}, ${v})`);
  // shoreMap itself: a lattice point a half tile, a vertex's value, an edge's middle the mean of its ends, a centre its own
  const corner = Float32Array.from([1, -1, 1, -1]), mid = Float32Array.from([0.25]);
  const flat = shoreMap(2, 2, corner, mid, 1e-6, Infinity);
  assert.deepEqual([flat.w, flat.h], [3, 3]);
  assert.deepEqual([...flat.field].map((v) => +v.toFixed(6)), [1, 0, -1, 1, 0.25, -1, 1, 0, -1], 'unblurred: the fan sampled at half tiles');
});

test('WATER-SHORE the sheet\'s fields as texels: r the water\'s cut, g the bed\'s own water (the votes alone - a bank the ground rises through is dry to the silt though the plane runs on to it), b the clip\'s share spread by OPEN_SIGMA; a near grid\'s alone (mutants: the bed\'s field the cut\'s; the share unspread)', () => {
  const T = 12, b = tiles(T, (x) => x < 6), grid = flatGrid(T, T, 10);
  for (let z = 0; z < T; z++) for (let x = 6; x < T; x++) grid.positions[(z * (T + 1) + x) * 3 + 1] = 10 + (x - 5) * 2;   // the bank climbs from x 6
  for (let z = 0; z < T; z++) for (let x = 0; x < 3; x++) b[z * T + x] = CLIP_SENTINEL;
  const s = waterBedOf(grid, b, { tileDim: T }).sheet, w = 2 * T + 1, px = (u, v, c) => s.shore.data[(Math.round(2 * v) * w + Math.round(2 * u)) * 4 + c];
  assert.deepEqual([s.shore.w, s.shore.h, s.shore.data.length], [w, w, w * w * 4]);
  assert.ok(px(7, 6, 0) < 128, 'r: the plane runs on to the climbing bank - the ground, not the field, ends it there');
  assert.ok(px(7, 6, 1) > 200, 'g: to the silt that bank is dry');
  assert.ok(px(1, 6, 2) > 240 && px(5, 6, 2) < 64, 'b: the clip\'s share, whole inside it');
  const b3 = px(3, 6, 2), b4 = px(4, 6, 2);
  assert.ok(b3 > 64 && b3 < 192 && b4 > 0 && b4 < b3, `b: a band across the clip's edge, not a step (${b3}, ${b4})`);
  const far = waterBedOf(flatGrid(T, T, 10), b, { tileDim: T, stride: 4 }).sheet;
  assert.equal(far.shore, null, 'a strided grid keeps its vertices\' cut');
});

test('WATER-SHORE the bank\'s rise: where the ground rises through a law\'s plane the water fades on the rise\'s smoothed field and ends short of the ground\'s own line (WATER_LIFT over the plane) - a rounder curve inside the triangles\' polyline; a shelf at the level keeps its water; a vertex with no level is the most (mutants: the rise unclamped; the no-level vertex none; the rise unspread; the fade unread)', () => {
  assert.equal(RISE_SIGMA, 0.35); assert.equal(RISE_MAX, 0.5); assert.deepEqual(RISE_FADE, [0.025, 0.065]);
  assert.ok(RISE_FADE[1] < WATER_LIFT, 'the fade done before the plane meets the ground');
  // a bowl lake at a law's level (34 + its metres in World 2.0, a river's level in Cyrodiil), the ground a little uneven
  const T = 32, g = T + 1, LV = 10, at = (x, z) => LV - 0.6 + 0.12 * Math.hypot(x - 15.3, (z - 16.1) * 1.3) * (1 + 0.15 * Math.sin(x * 0.9) * Math.cos(z * 0.7));
  const grid = flatGrid(T, T, 0);
  for (let z = 0; z < g; z++) for (let x = 0; x < g; x++) grid.positions[(z * g + x) * 3 + 1] = at(x, z);
  const bytes = tiles(T, (x, z) => at(x + 0.5, z + 0.5) < LV);
  const bed = waterBedOf(grid, bytes, { tileDim: T, levelAt: () => LV }), s = bed.sheet, G = bed.ground.positions, w = s.shore.w;
  /** the drawn ground, its two triangles a quad on the (0,0)-(1,1) diagonal */
  const pl = (u, v) => { const x = Math.min(T - 1, Math.floor(u)), z = Math.min(T - 1, Math.floor(v)), fx = u - x, fz = v - z, i0 = z * g + x, h = (i) => G[i * 3 + 1];
    return fz >= fx ? h(i0) + fz * (h(i0 + g) - h(i0)) + fx * (h(i0 + g + 1) - h(i0 + g)) : h(i0) + fx * (h(i0 + 1) - h(i0)) + fz * (h(i0 + g + 1) - h(i0 + 1)); };
  const rise = (u, v) => { const X = 2 * u, Z = 2 * v, i = Math.floor(X), j = Math.floor(Z), fx = X - i, fz = Z - j, a = (p, q) => s.shore.data[(q * w + p) * 4 + 3] / 255 * RISE_MAX;
    return (a(i, j) * (1 - fx) + a(i + 1, j) * fx) * (1 - fz) + (a(i, j + 1) * (1 - fx) + a(i + 1, j + 1) * fx) * fz; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const alpha = (u, v) => 1 - smooth(RISE_FADE[0], RISE_FADE[1], rise(u, v));
  let onLine = 0;
  for (let v = 2; v < 30; v += 1 / 32) for (let u = 2; u < 30; u += 1 / 32) if (Math.abs(pl(u, v) - LV - WATER_LIFT) < 0.004) onLine = Math.max(onLine, alpha(u, v));
  assert.ok(onLine < 0.05, `the water gone where the ground meets the plane (${onLine.toFixed(3)})`);
  const ray = (f) => { const rs = []; for (let k = 0; k < 240; k++) { const t = (k / 240) * 2 * Math.PI; let r = 0; while (r < 14 && f(15.3 + r * Math.cos(t), 16.1 + r * Math.sin(t))) r += 1 / 1024; rs.push(r); } return rs; };
  const rough = (rs) => Math.sqrt(rs.reduce((a, r, k) => a + (rs[(k + 1) % rs.length] - 2 * r + rs[(k + rs.length - 1) % rs.length]) ** 2, 0) / rs.length);
  const line = ray((u, v) => pl(u, v) < LV + WATER_LIFT), edge = ray((u, v) => pl(u, v) < LV + WATER_LIFT && alpha(u, v) > 0.5);
  const inset = line.reduce((a, r, k) => a + r - edge[k], 0) / line.length;
  assert.ok(inset > 0.1 && inset < 0.8, `inside the ground's line by a fraction of a tile (${inset.toFixed(3)})`);
  assert.ok(rough(edge) < rough(line) * 0.85, `rounder than the triangles' polyline (${rough(edge).toFixed(4)} against ${rough(line).toFixed(4)})`);
  assert.ok(alpha(15.3, 16.1) === 1, 'the lake\'s heart whole');
  // a pond on flat ground at its level: no rise, the cut field its shore
  const flat = waterBedOf(flatGrid(T, T, 10), tiles(T, (x, z) => x > 8 && x < 24 && z > 8 && z < 24), { tileDim: T }).sheet;
  for (let k = 3; k < flat.shore.data.length; k += 4) { const p = (k - 3) / 4, i = p % flat.shore.w, j = (p - i) / flat.shore.w; if (i > 18 && i < 46 && j > 18 && j < 46) assert.ok(flat.shore.data[k] <= 3, `a shelf at the level keeps its water (${i}, ${j})`); }
  assert.ok(flat.shore.data[3] > 200, 'a vertex with no level: the most');
});

/** The water's share of the eye at a tile coordinate, as the sheet's program takes it from a sheet's fields (no wander,
 *  no swell, seen from above): the depth test, the cut's edge, the rise's fade and - `look` - Beer-Lambert's blue over the
 *  path (a shallow stream's own look is its silt and its glints, so its edge is the sheet's edge alone). */
function seenOf(bed, T, look = true) {
  const sh = bed.sheet.shore, w = sh.w, g = T + 1, G = bed.ground.positions, level = bed.sheet.positions;
  const at = (u, v, c) => { const X = Math.min(w - 1.001, 2 * u), Y = Math.min(w - 1.001, 2 * v), i = Math.floor(X), j = Math.floor(Y), fx = X - i, fz = Y - j, q = (p, r) => sh.data[(r * w + p) * 4 + c] / 255;
    return (q(i, j) * (1 - fx) + q(i + 1, j) * fx) * (1 - fz) + (q(i, j + 1) * (1 - fx) + q(i + 1, j + 1) * fx) * fz; };
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pl = (u, v) => { const x = Math.min(T - 1, Math.floor(u)), z = Math.min(T - 1, Math.floor(v)), fx = u - x, fz = v - z, i0 = z * g + x, h = (i) => G[i * 3 + 1];
    return fz >= fx ? h(i0) + fz * (h(i0 + g) - h(i0)) + fx * (h(i0 + g + 1) - h(i0 + g)) : h(i0) + fx * (h(i0 + 1) - h(i0)) + fz * (h(i0 + g + 1) - h(i0 + 1)); };
  let lv = -Infinity;   // these bodies stand flat: the plane's one level
  for (let i = 0; i < g * g; i++) lv = Math.max(lv, level[i * 3 + 1]);
  return (u, v) => {
    if (pl(u, v) > lv + WATER_LIFT) return 0;
    const edge = sm(0.5 - SHORE_SOFTNESS, 0.5 + SHORE_SOFTNESS, 1 - at(u, v, 0)) * (1 - sm(RISE_FADE[0], RISE_FADE[1], at(u, v, 3) * RISE_MAX));
    const open = at(u, v, 2), path = (lv + WATER_LIFT - pl(u, v)) * (1 - open) + OPEN_PATH * open + 0.02;
    return look ? edge * (1 - Math.exp(-WATER_ABSORB[2] * path)) : edge;
  };
}
/** Of a seen edge's points (where it crosses a half), the share within a sixteenth of a tile's line: a quarter for a
 *  line that knows no tiles, all of them for a staircase. */
function onTileLines(f, T) {
  let on = 0, all = 0;
  for (let v = 1; v < T - 1; v += 1 / 64) for (let u = 1; u < T - 1; u += 1 / 64) {
    const a = f(u, v) >= 0.5;
    if (a === (f(u + 1 / 64, v) >= 0.5) && a === (f(u, v + 1 / 64) >= 0.5)) continue;
    all++;
    if (Math.abs(u - Math.round(u)) < 1 / 16 || Math.abs(v - Math.round(v)) < 1 / 16) on++;
  }
  return { all, share: on / all };
}

test('WATER-SHORE THE COAST AS THE EYE READS IT: a coast Deep Waters\' cap clipped, with a notch of land the cap kept, on the Bay and past it, and a stream marched across a slope - the sea\'s edge and the stream\'s, as the program draws them from the sheet\'s fields, run on lines that know no tiles, and the ground the cap cuts lies out of sight under the sea; the clip\'s own edge, the old shore, is all tile lines (mutants: the open sea\'s depth unspread or unread; the cut unsmoothed)', () => {
  const T = 32, g = T + 1, SEA = SEA_LEVEL_Y;
  const landAt = (x, z) => z - (16 + 2.2 * Math.sin(x * 0.21) + (x >= 10 && x <= 12 ? -2 : 0));   // > 0 land
  const grid = flatGrid(T, T, 0);
  for (let z = 0; z < g; z++) for (let x = 0; x < g; x++) grid.positions[(z * g + x) * 3 + 1] = landAt(x, z) > 0 ? SEA + 0.15 * landAt(x, z) : SEA;
  const bytes = new Uint8Array(T * T).fill(DRY);
  for (let z = 0; z < T; z++) for (let x = 0; x < T; x++) if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => landAt(x + a, z + b) <= 0)) bytes[z * T + x] = CLIP_SENTINEL;
  // TAMRIEL-WIDE: the Bay's harbour (Sentinel's coast) and Topal Bay past it (by Leyawiin) - one sea, one law
  for (const [px, py] of [[398, 341], [2371, 1148]]) {
    assert.equal(inBay(px, py), px < 1000, `${px},${py}: ${px < 1000 ? 'the Bay' : 'past it'}`);
    const seen = seenOf(waterBedOf(grid, bytes, { tileDim: T, levelAt: streamLevelAt(px, py) }), T), coast = onTileLines(seen, T);
    assert.ok(coast.all > 500 && coast.share < 0.35, `${px},${py}: the sea's seen edge knows no tiles (${coast.share.toFixed(3)} of ${coast.all})`);
    // THE LAND'S EDGE: the ground the cap cuts (COAST-LOOK's line, inside the clipped tiles) lies under the open sea's
    // depth - out of sight, so it is no shore
    const cutAt = (cx, cy) => cx >= 0 && cy >= 0 && cx < T && cy < T && bytes[cy * T + cx] === CLIP_SENTINEL;
    const cut = (u, v) => coastCutAt(cutAt, u, v).cut;
    let under = 1, edges = 0;
    for (let v = 1; v < T - 1; v += 1 / 16) for (let u = 1; u < T - 1; u += 1 / 16) {
      if (!cut(u, v) || (cut(u + 1 / 16, v) && cut(u - 1 / 16, v) && cut(u, v + 1 / 16) && cut(u, v - 1 / 16))) continue;
      edges++; under = Math.min(under, seen(u, v));
    }
    assert.ok(edges > 100 && under > 0.85, `${px},${py}: the ground's cut is under the sea's own depth (${under.toFixed(3)} at ${edges} points of its edge)`);
  }
  const clip = onTileLines((u, v) => (bytes[Math.floor(v) * T + Math.floor(u)] === CLIP_SENTINEL ? 1 : 0), T);
  assert.ok(clip.share > 0.95, `the clip's edge, the old shore: tile lines (${clip.share.toFixed(3)})`);
  // a stream two tiles wide marched across the grid at 1 in 2.4, the kernel's own corners
  const S = 40, wet = (x, z) => Math.abs(z - 8 - x / 2.4) < 1.3;
  const sb = new Uint8Array(S * S);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) sb[z * S + x] = BYTE.get((wet(x, z) ? 1 : 0) | (wet(x + 1, z) ? 2 : 0) | (wet(x, z + 1) ? 4 : 0) | (wet(x + 1, z + 1) ? 8 : 0));
  const stream = onTileLines(seenOf(waterBedOf(flatGrid(S, S, 10), sb, { tileDim: S }), S, false), S);
  assert.ok(stream.all > 500 && stream.share < 0.35, `the stream's banks know no tiles (${stream.share.toFixed(3)} of ${stream.all})`);
});

test('WATER-SHORE the water program reads its shore off the field: the cut, the open sea\'s depth over the clip with a copy or without (the mod\'s floor and its cut\'s tiles no shore), its swell, its underside left to the mod; the sea under the mod\'s tint (mutants: the field\'s half-tile lattice; the open look\'s channel; the clip\'s swell; the tint unread)', () => {
  const fs = waterSurfaceFs('');
  assert.match(fs, /vec4 shoreAt\(\) \{ return textureLod\(uShore, \(2\.0 \* vLocalXZ \/ uTileSize \+ 0\.5\) \/ vec2\(textureSize\(uShore, 0\)\), 0\.0\); \}/);
  assert.match(fs, /vec4 sh = uShoreOn == 1 \? shoreAt\(\) : vec4\(0\.0\);\n\s+float cut = uShoreOn == 1 \? sh\.r \* 2\.0 - 1\.0 : vCut;/);
  assert.match(fs, /edge \*= 1\.0 - smoothstep\(0\.025, 0\.065, sh\.a \* 0\.500\);/, 'the bank\'s rise ends the water short of the ground\'s own line');
  assert.match(fs, /float open = uOpen == 1 \? 1\.0 : \(uShoreOn == 1 \? shoreAt\(\)\.b : vSea\.x\);/);
  assert.equal(OPEN_PATH, 60);
  assert.match(fs, /float bedPath = uOpen == 1 \? 0\.0 : \(mix\(vDepth\.y, 60\.0, open\) \+ 0\.02\) \/ slant;/, 'the bed\'s path: the open sea\'s over the clip');
  assert.match(fs, /float path = uOpen == 1 \? 60\.0 : bedPath;/);
  assert.match(fs, /path = max\(bedD - here, bedPath\);/, 'with a copy, never under it: the mod\'s floor and its cut\'s edge under the open sea\'s depth');
  assert.match(fs, /float vdepth = uSceneOn == 1 \? path \* slant : mix\(vDepth\.y, 60\.0, open\);/);
  assert.match(fs, /body = textureLod\(uTileArr, vec3\(0\.5, 0\.5, 0\.0\), 8\.0\)\.rgb \* uTint \* mix\(vec3\(1\.0\), uOpenColor, vSea\.y\);/);
  assert.match(fs, /if \(\(uOpen == 1 \|\| vSea\.x > 0\.5\) && uCamPos\.y - vWorldPos\.y \+ 0\.02 < 0\.0\) discard;/);
  assert.match(WATER_SURFACE_VS, /layout\(location=3\) in vec2 aSea;/);
  assert.match(WATER_SURFACE_VS, /vec2 sea = uOpen == 1 \? vec2\(0\.0\) : aSea;/, 'the open sea\'s sheets bind their uvs on 2 and nothing on 3');
  assert.match(WATER_SURFACE_VS, /float grow = uOpen == 1 \? 1\.0 : max\(smoothstep\(0\.0, 2\.500, aDepth\.x\), sea\.x\);/);
  // the lattice: a texel a half tile, its centre on the point - run on the evaluator
  const seen = [];
  const f = glslFunctions(`in vec2 vLocalXZ;\nuniform float uTileSize;\nuniform sampler2D uShore;\n${fs.slice(fs.indexOf('vec4 shoreAt()'), fs.indexOf('// the eye\'s distance'))}`, {
    vLocalXZ: [6.4 * 3.5, 6.4 * 2], uTileSize: 6.4, textureSize: () => [9, 9], textureLod: (n, uv) => { seen.push(uv); return [0, 0, 0, 1]; },
  });
  f.shoreAt();
  assert.deepEqual(seen[0].map((v) => +(v * 9).toFixed(6)), [7.5, 4.5], 'tile (3.5, 2): lattice point (7, 4), its texel\'s centre');
});

test('WATER-SHORE the ground under the water takes the same field: a shore\'s two kinds meet on it, the silt follows it - a whole water tile\'s art silt whole as before, a dry tile silted where the field says wet; off, the tiles\' own lines (mutants: the kinds\' field unread; the silt\'s field unread; the silt on a whole water tile\'s field)', () => {
  const wet = { v: 0.8 };
  const src = `uniform sampler2DArray uTileArr;\n${EDGE_NOISE_GLSL}\n${groundWanderGlsl()}\n${groundKindsGlsl()}\n${shoreGlsl()}\n${WATER_BED_GLSL}`;
  const bind = { uGroundEdge: 1, uWaterBed: 1, uShoreOn: 1, uSnowArr: [0, 0, 0, 0], textureSize: () => [257, 257], textureLod: () => [0, 1 - wet.v, 0, 1], textureGrad: () => [0, 0, 0, 0] };
  const words = packWaterMask(WATER_DRAW_MASK_TABLE);
  bind.uBedMask = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [...words.slice(4 * i, 4 * i + 4)]);
  const bed = glslFunctions(src, bind);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  assert.equal(bed.shoreWet([3.2, 4.7]), 0.8, 'the field\'s g read as the bed\'s water');
  const edge = BYTE.get(1 | 2), p = [70.3, 20.6];   // a shore, water at its south corners
  assert.ok(groundKindsOf(edge));
  const k = bed.bedCover(edge, [0.3, 0.6], p, [0.3, 0.6, edge >> 2], [0.01, 0], [0, 0.01], 0, true)[0];
  assert.ok(Math.abs(k - smooth(0.3, 0.7, 0.8 - groundEdgeWander(...p))) < 1e-9, 'a blended shore: the silt on the field, less the wander');
  wet.v = 0.2;
  assert.equal(bed.bedCover(0, [0.5, 0.5], p, [0.5, 0.5, 0], [0.01, 0], [0, 0.01], 0, false)[0], 1, 'a whole water tile\'s art: silt whole, wherever the field draws the line');
  wet.v = 0.8;
  assert.ok(bed.bedCover(DRY, [0.5, 0.5], p, [0.5, 0.5, 2], [0.01, 0], [0, 0.01], 0, false)[0] > 0.9, 'a dry tile the field calls wet: silted under the water');
  bed.globals.uShoreOn = 0;
  assert.deepEqual(bed.bedCover(DRY, [0.5, 0.5], p, [0.5, 0.5, 2], [0.01, 0], [0, 0.01], 0, false), [0, 0], 'off: a dry tile is no bed');
  // the kinds
  const tables = /const mat2 ROT\[4\] = mat2\[4\]\([\s\S]*?\);\nconst vec2 TRANS\[4\] = vec2\[4\]\([\s\S]*?\);/.exec(EL_TERRAIN_FS)[0];
  const ge = glslFunctions(`uniform highp usampler2D uTilemap;\nuniform sampler2DArray uTileArr;\n${tables}\n${roadEdgeGlsl('')}\n${groundEdgeGlsl('')}`, { ...bind, uRoadEdge: 1 });
  const A = { value: 0 }, B = { value: 0 }, S = { value: 0 };
  assert.equal(ge.groundMix(edge, [0.3, 0.6], p, A, B, S), true);
  assert.ok(Math.abs(S.value - smooth(0.5 - GROUND_EDGE.soft, 0.5 + GROUND_EDGE.soft, 0.2 + groundEdgeWander(...p))) < 1e-9, 'a shore\'s land on the field\'s dry share');
  ge.globals.uShoreOn = 0;
  ge.groundMix(edge, [0.3, 0.6], p, A, B, S);
  assert.ok(Math.abs(S.value - smooth(0.5 - GROUND_EDGE.soft, 0.5 + GROUND_EDGE.soft, 0.6 + groundEdgeWander(...p))) < 1e-9, 'off: the tile\'s own corners');
});

test('WATER-SHORE the renderer: a sheet\'s fields an RGBA8 texture on their own unit, read bilinear, known by the tilemap its ground draws with and freed with the sheet; the terrain\'s sheets take the sea\'s tint as the open sea does; the ground binds its water\'s fields under the enhanced water alone (mutants: the fields unregistered; the ground blind to them; the tint unsent)', () => {
  const calls = [], texs = [];
  const gl = new Proxy({}, { get: (_, k) => (k === 'createTexture' ? () => { const t = { id: texs.length }; texs.push(t); return t; } : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : (...a) => { calls.push([k, ...a]); return {}; }) });
  const r = Object.create(Renderer.prototype);
  Object.assign(r, { gl, _shoreOf: new WeakMap(), _bindVao() {}, _activeTexture(u) { calls.push(['active', u]); } });
  const ground = { tilemap: 1 }, shore = { w: 3, h: 3, data: new Uint8Array(36) };
  const sheet = r.createWaterSheet({ positions: new Float32Array(3), depths: new Float32Array(2), cut: new Float32Array(1), sea: new Float32Array(2), shore, indices: new Uint32Array(3) }, ground);
  assert.equal(r._shoreOf.get(ground), sheet.shore, 'known by its ground\'s tilemap');
  assert.ok(calls.some((c) => c[0] === 'texImage2D' && c[3] === 'RGBA8' && c[4] === 3 && c[5] === 3 && c[7] === 'RGBA' && c[8] === 'UNSIGNED_BYTE'));
  assert.ok(calls.some((c) => c[0] === 'texParameteri' && c[2] === 'TEXTURE_MAG_FILTER' && c[3] === 'LINEAR'));
  assert.ok(calls.some((c) => c[0] === 'active' && c[1] === 'TEXTURE0' + WATER_SHORE_UNIT), 'made on its own unit');
  assert.ok(calls.some((c) => c[0] === 'vertexAttribPointer' && c[1] === 3 && c[2] === 2), 'attribute 3: the sea\'s two marks');
  r.destroyWaterSurface(sheet);
  assert.equal(r._shoreOf.get(ground), undefined, 'freed with the sheet');
  assert.ok(calls.some((c) => c[0] === 'deleteTexture' && c[1] === sheet.shore));
  const src = read('src/render/renderer.js');
  assert.match(src, /this\._bindShore\(this\.waterBed \? this\._shoreOf\.get\(tilemapTex\) \?\? null : null, this\.tUShoreOn, null\);/, 'the ground: its water\'s fields under the enhanced water');
  assert.match(src, /this\._bindShore\(surface\.shore \?\? null, L\.shoreSwitch, L\);/, 'each sheet its own; the open sea\'s none');
  assert.match(src, /gl\.uniform3f\(L\.openColor, sea \? sea\[0\] : 1, sea \? sea\[1\] : 1, sea \? sea\[2\] : 1\);/, 'the terrain\'s sheets: the sea\'s tint, white with none');
  assert.equal(WATER_SHORE_UNIT, 26);
  const fixed = [...src.matchAll(/([A-Z_]+_UNIT) = (\d+)/g)].concat([...read('src/render/waterSurface.js').matchAll(/([A-Z_]+_UNIT) = (\d+)/g)]);
  assert.ok(!fixed.some(([, n, u]) => n !== 'WATER_SHORE_UNIT' && Number(u) === WATER_SHORE_UNIT), 'its unit no other\'s');
});

test('WATER-SHORE the hosts: from above, a coastal pixel\'s sea is its own sheet\'s - Deep Waters\' top drawn where no sheet stands (a hidden pixel\'s, the classic water, under the sea); the terrain\'s sheets in the mod\'s tint; every sheet made with its ground\'s tilemap (mutants: the top over the sheet; the tint unpassed)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /if \(\(cells \|\| p\._visible\) && h\?\.surface && !\(waterOn && !f\.underwater && p\.water && !p\.deepWaters\.hide\)\) _dwSurfaceList\.push\(\{ h, model: p\._pixelMatrix \}\);/);
  assert.equal((w.match(/drawWaterSurfaces\(_waterRows, n, 6\.4, (?:wu|_waterU), TERRAIN_TILE_DIM, _dwFrame\?\.look\.topColor\);/g) ?? []).length, 2, 'the frame\'s water and the street frame\'s');
  assert.equal((w.match(/createWaterSheet\([^)]*\)/g) ?? []).filter((c) => !/, (?:p\.)?tilemapTex\)$/.test(c)).length, 0, 'every sheet with its ground\'s tilemap');
  assert.match(read('src/scenes/exterior.js'), /renderer\.createWaterSheet\(townBed\.sheet, tilemapTex\)/);
});

test('WATER-SHORE the record: the arc\'s section with the owner\'s word, its departure in the ledger', () => {
  const arc = read('bible/07-Rendering/Water-Arc.md');
  assert.match(arc, /## WATER-SHORE - A SHORE IS A LINE, NOT A TILE'S EDGE \(2026-11-01\)/);
  assert.ok(arc.includes('It still looks tiled on the shorelines'));
  assert.match(read('bible/01-Overview/Port-Ledger.md'), /\*\*A SHORE IS A LINE, NOT A TILE'S EDGE \(WATER-SHORE, 2026-11-01/);
});
