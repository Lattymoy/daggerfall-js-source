// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RELIEF-PEAKS (2026-10-27, bible/03-World/Tamriel.md RELIEF-PEAKS; KPbICA on the game's Discord, forwarded by the owner:
// "No mountains ... Instead we're getting strange looking canyons", "No 'Red Mountain' in Morrowind") - THE RANGES PAST THE
// BAY STAND AS MOUNTAINS, AND RED MOUNTAIN AS A CONE.
//
// THE RELIEF HAS NOTHING UNDER ITS GRAIN. The owner's heightmap is a cell every 6.3 km (TAMRIEL-RELIEF: two a picture
// unit, a picture unit 15.5 map pixels), so the continent's bytes are its cells read bilinearly with a hash of two: on the
// freeware's trace a byte past the Bay stood within 1.3 of its 15-pixel mean (its standard deviation), where WOODS.WLD's own
// mountains stand 4.5 to 10 bytes off theirs. Every range past the Bay was a dome: Skyrim's summit country spanned 442 m
// over 10 km, the Jerall 274 m, Red Mountain 376 m, where the Bay's Dragontails span 1,449 m and its Wrothgarians 1,032 m.
//
// UNDER THE GRAIN, IN THE SHAPER - NEVER IN THE BYTES. The ranges are laid on the land inside the kernel's shaper past the
// Bay (world/landforms.js, beside BREATHTAKER3's landforms), a function of world position and the land's own height:
//   - The bytes are every reader's - the roads' router, the places, the ports, the dry ground - and the roads, the places
//     and the ports stand where they stood.
//   - DFU's cubic (terrainSampler.js cubicInterpolator, verbatim) takes twice Catmull-Rom's tangent, so a byte ramp's
//     slope swings from half to twice itself across every pixel: relief laid in the bytes at the ranges' own wavelengths
//     stood as a plaid of pixel-wide bands in the hill-shade (measured on the first cut of this slice). The shaper's ground
//     is Perlin's, smooth at every sample.
//
//   - RIDGES AND VALLEYS (`ridges`, `rangeAt`): a ridged field, its crests a network and its valleys between - four octaves
//     from 11.5 km to 1.1 km, the finer riding the coarser's crests. Its swing grows with the land's height (`foot` to
//     `full`), so the plains, the coasts and the low country stand as they stood and the high ground is mountains. Where
//     the land has room under the ceiling the field is centred on it (its mean is the relief's own height); toward the
//     ceiling (byte 180's ground - with TAMRIEL_TOP over it world/landforms.js CONTINENT_CEILING, which every reader of the
//     ground counts on) its crests stand at the land's own height and its valleys are cut into it, and a rise past `knee`
//     under it is held softly under it. Never under the land's height and the foot, whichever is lower: no valley reaches
//     the beach line.
//   - THE WATERS' VALLEYS: none within WATER of a carved river's course or a lake's shore (world/tamriel/tamrielWaters.js
//     CARVED_RIVERS, LAKES - their static courses, never the compiled law, which reads the ground), whole past it - a river
//     runs down a valley of the mountains, never through a gorge it would have to cut.
//   - RED MOUNTAIN (`CONE`): the volcano at its relief's own summit (tamrielRelief.js namedSummit - where its zone stands),
//     a cone from the land round its rim to CONE.top, its flanks concave (steep at the top, easing at the foot), ribbed
//     down its sides, a crater at its top. The relief's dome there (40 bytes over 35 km) is the cone blurred to the
//     heightmap's grain: inside its rim the land is the cone.
//
// THE FAR VIEWS READ IT: world/landforms.js centreGround and nodeGroundAt add it at a vertex's own point, so the far ring
// and the far field stand the mountains the ground stands.
//
// PURE IN WORLD POSITION, AND ONE FLOAT IN EVERY ENGINE (AUDIT LANDFORMS III A8): Perlin noise, square roots and rational
// functions only (no Math.cos, Math.exp, Math.hypot or `**`); a sample on a pixel's edge is one number from both pixels.
// ═══════════════════════════════════════════════════════════════════
import { perlinNoise } from '../perlin.js';
import { nodeGround } from '../landforms.js';   // called, never read at load (the modules import each other)
import { STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION, HEIGHTMAP_DIMENSION } from '../terrain/terrainSampler.js';
import { namedSummit, reliefStands } from './tamrielRelief.js';
import { MOUNTAIN_RANGES } from './tamrielGeography.js';
import { pictureToBay, tamrielFit } from './tamrielFrame.js';
import { tamrielLandVersion } from './tamrielLand.js';
import { CARVED_RIVERS, LAKES } from './tamrielWaters.js';   // their static courses (read at call time: the modules import each other)
import { tamrielHeightByte } from './tamrielGround.js';   // the cone's foot (called, never read at load)
import { MAP_HEIGHT } from '../../formats/woodsFile.js';

const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const signed = (x, y) => 2 * perlinNoise(x, y) - 1;
const SPAN = HEIGHTMAP_DIMENSION - 1;
/** Metres over the sea of a height in the kernel's units, and back. */
const metresOf = (u) => (u - SCALED_OCEAN_ELEVATION) * STREAMING_TERRAIN_SCALE;
const unitsOf = (m) => m / STREAMING_TERRAIN_SCALE + SCALED_OCEAN_ELEVATION;

/** THE RANGES' DIALS (LANDFORM_DIALS' rule: one place). Heights in metres over the sea; the field's lengths in the kernel's
 *  samples (6.4 m), the waters' in Bay pixels (819.2 m). `foot` the land's height where the ranges begin and `full` where
 *  they stand whole; `high` their swing there (crest to valley floor); the ridged octaves' `waves` and `gains`; the
 *  domain's `warp` over `warpWave`; `crest` the height from which the relief's crest stands at the land's own (the Bay's
 *  tallest ground, byte 109's) and `ceilingByte` the byte whose ground is the most the ranges stand (CONTINENT_LIFT's top:
 *  TAMRIEL-RELIEF's CEILING_BYTE); `knee` under it the soft clip's; `water` no relief within the first of a carved river's
 *  course or a lake's shore, whole past the second. */
export const RANGE_DIALS = Object.freeze({
  foot: 1000, full: 2300, high: 1250,
  waves: Object.freeze([1800, 820, 380, 175]), gains: Object.freeze([1, 0.55, 0.3, 0.16]),
  warp: 420, warpWave: 3100,
  crest: 2500, ceilingByte: 180, knee: 260,
  water: Object.freeze([2, 7]),
});
/** The ridged field's mean over the land (measured over 200,000 world points - test/world/reliefpeaks.test.js holds it
 *  within 0.01): the centre the relief stands on where the land has room above it. */
export const RANGE_MEAN = 0.61;

/** RED MOUNTAIN: the range a zone names (tamrielGeography.js MOUNTAIN_RANGES), its province; `top` its summit (m over the
 *  sea, its crater's rim); `radius` (Bay pixels) where the cone meets the land (25 km - the relief's own dome there spans
 *  some 35 km); `steep` its profile's (coneProfile); `rim` how much of its radius, at its edge, it blends into the land
 *  over; `calm` how many of its radii past half of one the land's own ranges come back over (so no range about it stands
 *  as tall); the crater's `crater` radius (Bay pixels) and `depth` (m); the ribs' `ribs` (their noise's turns round the
 *  cone) and `rib` their depth (m, at mid-flank). */
export const CONE = Object.freeze({
  range: 'Red Mountain', province: 'Morrowind',
  top: 3250, radius: 30, steep: 6, rim: 0.4, calm: 1.5,
  crater: 2.2, depth: 240,
  ribs: 9, rib: 130,
});

// ── THE CEILING ───────────────────────────────────────────────────
/** The most the land stands under the ranges (kernel units): byte `ceilingByte`'s ground at its node, the whole lift
 *  and its continuation (world/landforms.js nodeGround) - with TAMRIEL_TOP over it, CONTINENT_CEILING. */
let _ceiling = NaN;
export const rangeCeiling = () => (_ceiling === _ceiling ? _ceiling : (_ceiling = nodeGround(RANGE_DIALS.ceilingByte, 1, 1)));

// ── THE RIDGES ────────────────────────────────────────────────────
/** THE RIDGED FIELD at a world sample (x east, y north): about 0..1, 1 on a crest - each octave's crest the zero line of
 *  its noise, squared off it; the finer octaves weighted by the coarser's height, so the valleys stay smooth and the
 *  crests branch into spurs. */
export function ridges(gx, gy) {
  const D = RANGE_DIALS;
  const wx = gx + D.warp * signed(gx / D.warpWave + 3.17, gy / D.warpWave + 7.71);
  const wy = gy + D.warp * signed(gx / D.warpWave + 11.3, gy / D.warpWave + 1.93);
  let sum = 0, norm = 0, weight = 1;
  for (let o = 0; o < D.waves.length; o++) {
    const w = D.waves[o], n = signed(wx / w + 17.1 * (o + 1), wy / w + 5.3 * (o + 1));
    const a = 1 - (n < 0 ? -n : n), r = a * a;
    sum += D.gains[o] * weight * r; norm += D.gains[o];
    weight = r * 1.6 > 1 ? 1 : r * 1.6;
  }
  return sum / norm;
}
/** The ranges' swing on a land of `h` kernel units, kernel units: nothing to the foot, the whole `high` from `full`. */
export function rangeSwing(h) {
  const D = RANGE_DIALS;
  return (D.high / STREAMING_TERRAIN_SCALE) * smooth01((metresOf(h) - D.foot) / (D.full - D.foot));
}
/** Where the field stands on a land of `h` kernel units, 0..1 of it: its mean (RANGE_MEAN) while the land has room above
 *  it, its crest (1) at the ceiling - so a summit country's crests are the land's own height and its valleys cut. */
export function rangeCentre(h) {
  const D = RANGE_DIALS;
  return RANGE_MEAN + (1 - RANGE_MEAN) * smooth01((metresOf(h) - D.crest) / (metresOf(rangeCeiling()) - D.crest));
}
/** The most the ridges stand over the land anywhere (kernel units): the swing's over-centre share at its largest, measured
 *  over the land's heights once. */
let _up = -1;
export function rangeUp() {
  if (_up < 0) {
    const top = rangeCeiling();
    _up = 0;
    for (let h = SCALED_OCEAN_ELEVATION; h <= top + 4; h += 4) _up = Math.max(_up, rangeSwing(h) * (1 - rangeCentre(h)));
  }
  return _up;
}
/** THE HIGHEST the ranges stand a land whose highest is `top` kernel units, at map pixel (px, py) - a BOUND (world/landforms.js
 *  groundTopOf): the ridges' rise held under the ceiling, and Red Mountain's top where its cone reaches the pixel. */
export function rangeBound(px, py, top) {
  if (!reliefStands()) return top;
  const s = coneSummit(), up = Math.max(top, Math.min(rangeCeiling(), top + rangeUp()));
  if (!s) return up;
  const dx = Math.max(0, Math.abs(px + 0.5 - s[0]) - 0.5), dy = Math.max(0, Math.abs(py + 0.5 - s[1]) - 0.5);
  return dx * dx + dy * dy < CONE.radius * CONE.radius ? Math.max(up, unitsOf(CONE.top)) : up;
}

// ── THE WATERS' VALLEYS ───────────────────────────────────────────
let _waters = /** @type {any} */ (null), _watersFit = /** @type {any} */ (null), _watersLand = -1;
const WATER_CELL = 16;
/** The carved rivers' segments and the lakes (Bay pixels) on a grid of WATER_CELL pixels, made once a fit and a land. */
function waterIndex() {
  const fit = tamrielFit(), land = tamrielLandVersion();
  if (_waters && _watersFit === fit && _watersLand === land) return _waters;
  const reach = RANGE_DIALS.water[1], grid = new Map();
  const add = (x0, y0, x1, y1, item) => {
    for (let gy = Math.floor((Math.min(y0, y1) - reach) / WATER_CELL); gy <= Math.floor((Math.max(y0, y1) + reach) / WATER_CELL); gy++) {
      for (let gx = Math.floor((Math.min(x0, x1) - reach) / WATER_CELL); gx <= Math.floor((Math.max(x0, x1) + reach) / WATER_CELL); gx++) {
        const k = gx * 65536 + gy;
        let l = grid.get(k);
        if (!l) grid.set(k, (l = []));
        l.push(item);
      }
    }
  };
  if (fit) {
    for (const r of CARVED_RIVERS) {
      const pts = r.pts.map(([px, py]) => pictureToBay(px, py));
      for (let i = 0; i + 1 < pts.length; i++) add(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], { seg: [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]] });
    }
    for (const l of LAKES) {
      const [cx, cy] = pictureToBay(l.at[0], l.at[1]), rad = Math.max(l.r[0], l.r[1]) * fit.ppu;
      add(cx - rad, cy - rad, cx + rad, cy + rad, { lake: [cx, cy, rad] });
    }
  }
  _waters = grid; _watersFit = fit; _watersLand = land;
  return grid;
}
/** How far (Bay pixels) a Bay point lies from the nearest carved river's course or lake's shore - WATER's reach past it. */
export function waterDistance(x, y) {
  const reach = RANGE_DIALS.water[1], list = waterIndex().get(Math.floor(x / WATER_CELL) * 65536 + Math.floor(y / WATER_CELL));
  if (!list) return reach;
  let best = reach;
  for (const it of list) {
    let d;
    if (it.seg) {
      const [ax, ay, bx, by] = it.seg, vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)) : 0, qx = x - ax - vx * t, qy = y - ay - vy * t;
      d = Math.sqrt(qx * qx + qy * qy);
    } else {
      const qx = x - it.lake[0], qy = y - it.lake[1];
      d = Math.max(0, Math.sqrt(qx * qx + qy * qy) - it.lake[2]);
    }
    if (d < best) best = d;
  }
  return best;
}

// ── RED MOUNTAIN ──────────────────────────────────────────────────
let _summit = /** @type {[number, number]|null} */ (null), _summitFit = /** @type {any} */ (null), _summitLand = -1, _summitAsked = false;
/** Red Mountain's summit, Bay coordinates: its relief's own (tamrielRelief.js namedSummit), or null (no relief, no fit). */
export function coneSummit() {
  const fit = tamrielFit(), land = tamrielLandVersion();
  if (_summitAsked && _summitFit === fit && _summitLand === land) return _summit;
  const range = MOUNTAIN_RANGES.find((r) => r.name === CONE.range);
  const at = fit && range && reliefStands() ? namedSummit(CONE.province, CONE.range, range.pts) : null;
  _summit = at ? /** @type {[number, number]} */ (pictureToBay(at[0], at[1])) : null;
  _summitFit = fit; _summitLand = land; _summitAsked = true;
  return _summit;
}
/** The cone's profile at `t` of its radius (0 the summit, 1 the foot): 1 to its crater's rim, then concave down its flanks
 *  - steep under the rim, easing out, level at its foot - as a stratovolcano's is. */
export function coneProfile(t) {
  const rim = CONE.crater / CONE.radius, u = t <= rim ? 0 : (t - rim) / (1 - rim);
  return u >= 1 ? 0 : ((1 - u) * (1 - u)) / (1 + CONE.steep * u);
}
let _foot = NaN, _footOf = /** @type {any} */ (null);
/** The foot's ring: 32 points, a sixteenth of a half turn apart - their cosine and sine by the half angle's square roots. */
const FOOT_RING = 32;
const RING_C = Math.sqrt((1 + Math.sqrt((1 + Math.SQRT1_2) / 2)) / 2), RING_S = Math.sqrt(1 - RING_C * RING_C);
/** The cone's foot (kernel units): the land's mean ground round its rim (its bytes' own nodes, world/landforms.js
 *  nodeGround) - so the cone rises out of the land it meets, with no moat and no step. */
function coneFoot(s) {
  if (_footOf === s) return _foot;
  let sum = 0, u = 1, q = 0;
  for (let k = 0; k < FOOT_RING; k++) {   // turned a step at a time (no Math.cos: one float in every engine)
    sum += nodeGround(tamrielHeightByte(Math.floor(s[0] + CONE.radius * u), Math.floor(s[1] + CONE.radius * q)), 1, 1);
    const nu = u * RING_C - q * RING_S;
    q = u * RING_S + q * RING_C; u = nu;
  }
  _foot = sum / FOOT_RING; _footOf = s;
  return _foot;
}
/** THE CONE at Bay point (x, y): `{ h, w, quiet }` - the volcano's ground there (kernel units: from its foot to CONE.top
 *  by its profile, ribbed, its crater cut), how much of the land it stands in place of (1 inside its rim's blend, 0 at its
 *  edge and past it), and how much of the land's own ranges stand about it (none on its upper flanks, whole CONE.calm
 *  radii past half its radius: the volcano stands alone over its country) - or null past that. */
export function coneAt(x, y) {
  const s = coneSummit();
  if (!s) return null;
  const dx = x - s[0], dy = y - s[1], r = Math.sqrt(dx * dx + dy * dy), t = r / CONE.radius;
  if (!(t < 0.5 + CONE.calm)) return null;
  const quiet = smooth01((t - 0.5) / CONE.calm);
  if (!(t < 1)) return { h: 0, w: 0, quiet };
  let cut = 0;
  // the ribs: ridges and gullies down the flanks - a ridged noise of the bearing alone (the unit vector's), deepest at mid-flank
  if (r > 0) {
    const n = signed((dx / r) * CONE.ribs * 0.5 + 41.7, (dy / r) * CONE.ribs * 0.5 + 9.3), a = 1 - (n < 0 ? -n : n);
    cut += CONE.rib * 4 * t * (1 - t) * (1 - a * a) * smooth01(t / 0.12);
  }
  // the crater: a bowl at the top, its rim the summit's ring
  const c = r / CONE.crater;
  if (c < 1) cut += CONE.depth * (1 - c * c) * (1 - c * c);
  const foot = coneFoot(s);
  return { h: foot + (unitsOf(CONE.top) - foot) * coneProfile(t) - cut / STREAMING_TERRAIN_SCALE, w: smooth01((1 - t) / CONE.rim), quiet };
}

// ── THE RANGES ON THE LAND ────────────────────────────────────────
/**
 * THE RANGES at world sample (gx east, gy north) on a land standing `h` kernel units (the kernel's two terms and the
 * lift there): how far they move it, kernel units - the ridges' relief at the land's swing (none by the waters), Red
 * Mountain's cone in place of the land inside its rim, held softly under the ceiling and never under the land's own height
 * and the foot, whichever is lower. 0 where no relief stands (the authored law's land is its own shape).
 * @param {number} gx @param {number} gy @param {number} h
 * @returns {number}
 */
export function rangeAt(gx, gy, h) {
  return reliefStands() ? rangeOn(gx, gy, h, true, true) : 0;
}
/** THE RANGES FOR ONE PIXEL's samples (the shaper's): rangeAt, with what the pixel can meet asked once - Red Mountain's
 *  cone and the waters' valleys - or null where no relief stands. */
export function rangeShaper(px, py) {
  if (!reliefStands()) return null;
  const s = coneSummit(), reach = RANGE_DIALS.water[1] + 2;
  const near = CONE.radius * (0.5 + CONE.calm) + 2, cone = !!s && (px + 0.5 - s[0]) * (px + 0.5 - s[0]) + (py + 0.5 - s[1]) * (py + 0.5 - s[1]) < near * near;
  let water = false;
  for (let gy = Math.floor((py - reach) / WATER_CELL); gy <= Math.floor((py + 1 + reach) / WATER_CELL) && !water; gy++)
    for (let gx = Math.floor((px - reach) / WATER_CELL); gx <= Math.floor((px + 1 + reach) / WATER_CELL); gx++) if (waterIndex().has(gx * 65536 + gy)) { water = true; break; }
  return (gx, gy, h) => rangeOn(gx, gy, h, cone, water);
}
function rangeOn(gx, gy, h, nearCone, nearWater) {
  const D = RANGE_DIALS, bx = gx / SPAN, by = MAP_HEIGHT + 1 - gy / SPAN;   // the sample's Bay point (y south)
  const cone = nearCone ? coneAt(bx, by) : null;
  let swing = rangeSwing(h);
  if (swing > 0 && nearWater) swing *= smooth01((waterDistance(bx, by) - D.water[0]) / (D.water[1] - D.water[0]));
  if (cone) swing *= cone.quiet;
  if (!(swing > 0) && !cone) return 0;
  let out = h;
  if (swing > 0) out += swing * (ridges(gx, gy) - rangeCentre(h));
  // a rise held softly under the ceiling, from `knee` under it (the land itself is under it: its bytes stop at its byte)
  const ceiling = rangeCeiling(), from = Math.max(h, ceiling - D.knee / STREAMING_TERRAIN_SCALE);
  if (out > from && ceiling > from) { const q = (out - from) / (ceiling - from); out = from + (ceiling - from) * (q / (1 + q)); }
  if (cone && cone.w > 0) out += (cone.h - out) * cone.w;   // CONE.top is under the ceiling
  const floor = Math.min(h, unitsOf(D.foot));
  return (out < floor ? floor : out) - h;
}
