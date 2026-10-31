// @ts-check
// RED-MOUNTAIN (bible/03-World/Red-Mountain.md; the owner: "An absolute massive volcano true to lore that towers in the
// distance"): the volcano at Vvardenfell's heart, a law of world position the kernel stands on the land past the Bay
// (world/landforms.js landAt). A stratovolcano's cone over the relief's summit (tamrielBiomes.js heartsAnchor), its crater
// one flat floor, gullies down its flanks, three foyada from breaches in its rim. Pure and one float in every engine (no
// Math.cos, Math.exp, Math.atan2 or `**`): the terrain worker reads it too. World samples (6.4 m) and kernel units (1.25 m).
import { heartsAnchor, RED_MOUNTAIN } from './tamrielBiomes.js';
import { pictureToBay, tamrielFit, BAY_H } from './tamrielFrame.js';
import { tamrielLandVersion } from './tamrielLand.js';
import { perlinNoise } from '../perlin.js';
import { TERRAIN_SIZE, STREAMING_TERRAIN_SCALE } from '../terrain/terrainSampler.js';

/** Metres a world sample (a map pixel's 128) and a kernel unit. */
const SAMPLE_M = TERRAIN_SIZE / 128;
const UNIT_M = STREAMING_TERRAIN_SCALE;
/** The map's rows: a Bay row's world samples count north from the map's south edge. */
const MAP_ROWS = BAY_H;

/** ALL THE DIALS IN ONE PLACE (LANDFORM_DIALS' rule). Lengths and heights in metres; a tier's `power` a whole number
 *  or a half (products and a square root, never `**`). */
export const RED_MOUNTAIN_DIALS = Object.freeze({
  /** the crater: the rim's radius from the centre, the flat floor's, and how far the floor stands under the rim */
  rim: 2600,
  floor: 1300,
  depth: 700,
  /** the lift at the rim over the land, and its wander round the crater (a share of it; the noise's circle radius) */
  lift: 4500,
  lobes: Object.freeze({ amp: 0.05, radius: 1.6 }),
  /** THE FLANK, three tiers summed - each its share of the lift, its reach past the rim and its power: the summit cone
   *  (half the lift within 5 km of the rim, about 29 degrees under it), the body (a quarter left at 14 km) and the shield
   *  (a tenth at 35 km, nothing past 95) - a stratovolcano's concave flank */
  tiers: Object.freeze([
    Object.freeze({ share: 0.54, reach: 10000, power: 2 }),
    Object.freeze({ share: 0.2, reach: 35000, power: 2 }),
    Object.freeze({ share: 0.26, reach: 95000, power: 2 }),
  ]),
  /** the land's own shapes come back from the rim over this reach */
  keep: 16000,
  /** the gullies: their depth on the steepest flank, the polar noise's grain (its circle's radius per fourth root of a
   *  metre), and how far past the rim they reach */
  gully: Object.freeze({ depth: 45, grain: 4, reach: 24000 }),
  /** THE FOYADA: each from a breach in the rim (`az` a fraction of a turn from east toward north) down the flank, its
   *  length and its wander either side; `trough` their depth under the cone past the breach (at the breach the crater's,
   *  so the lake spills into them), their half-width at the rim and at the foot, the step their lines are laid at, and
   *  how far down each the lava runs */
  foyada: Object.freeze([
    Object.freeze({ name: 'south-west', az: 0.62, length: 11000, wander: 600, seed: 3.7 }),
    Object.freeze({ name: 'north-east', az: 0.13, length: 9000, wander: 500, seed: 11.3 }),
    Object.freeze({ name: 'north-west', az: 0.36, length: 7000, wander: 450, seed: 23.9 }),
  ]),
  trough: Object.freeze({ depth: 60, halfTop: 220, halfFoot: 260, step: 200, lava: 0.7 }),
});

const D = RED_MOUNTAIN_DIALS;
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** (1 - t)^(h / 2) for t in 0..1, h a whole number of halves - products and one square root. */
function falloff(t, halves) {
  if (!(t < 1)) return 0;
  const u = t <= 0 ? 1 : 1 - t;
  let p = halves & 1 ? Math.sqrt(u) : 1;
  for (let i = 0; i < halves >> 1; i++) p *= u;
  return p;
}
/** A turn's fraction as a direction (x east, y north) - its cosine and sine by series of correctly rounded steps (the
 *  landforms' cosPi's, here so this module imports nothing of the kernel's). */
export function dirOf(turn) {
  const cosPi = (v) => {
    let x = v - 2 * Math.round(v / 2),
      sign = 1; // into -1..1: cos(pi v) has period 2
    if (x < 0) x = -x;
    if (x > 0.5) {
      x = 1 - x;
      sign = -1;
    }
    const y = Math.PI * x,
      y2 = y * y;
    let p = 1;
    for (let k = 20; k >= 2; k -= 2) p = 1 - (y2 * p) / (k * (k - 1));
    return sign * p;
  };
  return [cosPi(2 * turn), cosPi(2 * turn - 0.5)];
}

/** The lift at the rim and on the flanks, metres - `d` metres past the rim (0 at it). */
export function coneProfile(d) {
  let f = 0;
  for (const t of D.tiers) f += t.share * falloff(d / t.reach, t.power * 2);
  return D.lift * f;
}
/** The flank's fall at `d` metres past the rim, rise over run - coneProfile's own slope, each tier's power's derivative
 *  (p (1 - t)^(p - 1) / reach: the falloff of one half fewer). */
export function coneGrade(d) {
  let g = 0;
  for (const t of D.tiers) g += (t.share * t.power * falloff(d / t.reach, t.power * 2 - 2)) / t.reach;
  return D.lift * g;
}
/** A foyada's segments a box (nearFoyada's skip). */
const CHUNK = 8;
/** The farthest the flank reaches past the rim, and the volcano from its centre, metres. */
const FLANK_REACH = Math.max(...D.tiers.map((t) => t.reach));
export const RED_MOUNTAIN_REACH = D.rim + FLANK_REACH;

/**
 * @typedef {{ cx: number, cy: number, bx: number, by: number, reach: number,
 *   foyada: ReadonlyArray<{ name: string, pts: Float64Array, s: Float64Array, x0: number, x1: number, y0: number, y1: number, chunks: Float64Array }> }} RedMountainFrame
 *   the centre in world samples (cx, cy) and Bay pixels (bx, by, continuous: a pixel's centre is x + 0.5), the reach in
 *   samples, and each foyada's line (x, y pairs in world samples, `s` its length to each point in metres) and its box
 */
/** @type {RedMountainFrame|null} */
let _frame = null;
let _land = -1,
  _fit = /** @type {any} */ (null);

/** THE FRAME the law stands in for the land and the fit in use - made once a land and a fit (the trace landing, the
 *  Bay's fit moving it), or null where Morrowind has no Red Mountain to stand it on. */
export function redMountainFrame() {
  const land = tamrielLandVersion(),
    fit = tamrielFit();
  if (land === _land && fit === _fit) return _frame;
  _land = land;
  _fit = fit;
  const at = heartsAnchor('Morrowind', RED_MOUNTAIN);
  if (!at) return (_frame = null);
  const [bx, by] = pictureToBay(at[0], at[1]);
  const cx = bx * 128,
    cy = (MAP_ROWS + 1 - by) * 128,
    k = 1 / SAMPLE_M;
  const foyada = D.foyada.map((f) => {
    const [ux, uy] = dirOf(f.az),
      n = Math.floor(f.length / D.trough.step) + 1;
    const pts = new Float64Array(2 * n),
      s = new Float64Array(n);
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const along = i * D.trough.step,
        r = D.rim + along;
      // the wander across the fall line, eased in from the notch so the ravine leaves the rim straight
      const side =
        f.wander * smooth01(along / 2000) * (2 * perlinNoise(along / 2600 + f.seed, f.seed * 0.37 + 0.5) - 1);
      const x = cx + (ux * r - uy * side) * k,
        y = cy + (uy * r + ux * side) * k;
      pts[2 * i] = x;
      pts[2 * i + 1] = y;
      s[i] = along;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const pad = 2 * D.trough.halfFoot * k + 1; // nearFoyada's reach: twice the half-width
    // a box a run of CHUNK segments (x0, x1, y0, y1), so a sample asks the few runs it stands in, not every segment
    const runs = Math.ceil((n - 1) / CHUNK),
      chunks = new Float64Array(4 * runs);
    for (let c = 0; c < runs; c++) {
      let a0 = Infinity,
        a1 = -Infinity,
        b0 = Infinity,
        b1 = -Infinity;
      for (let i = c * CHUNK; i <= Math.min(n - 1, (c + 1) * CHUNK); i++) {
        const x = pts[2 * i],
          y = pts[2 * i + 1];
        if (x < a0) a0 = x;
        if (x > a1) a1 = x;
        if (y < b0) b0 = y;
        if (y > b1) b1 = y;
      }
      chunks[4 * c] = a0 - pad;
      chunks[4 * c + 1] = a1 + pad;
      chunks[4 * c + 2] = b0 - pad;
      chunks[4 * c + 3] = b1 + pad;
    }
    return Object.freeze({ name: f.name, pts, s, x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad, chunks });
  });
  return (_frame = Object.freeze({ cx, cy, bx, by, reach: RED_MOUNTAIN_REACH * k, foyada: Object.freeze(foyada) }));
}

/** Does the volcano reach the box of world samples [x0, x1] x [y0, y1]? (A pixel's shaper asks once.) */
export function redMountainReaches(x0, y0, x1, y1) {
  const f = redMountainFrame();
  return !!f && x1 > f.cx - f.reach && x0 < f.cx + f.reach && y1 > f.cy - f.reach && y0 < f.cy + f.reach;
}

/** THE CROWN: the rim's height wanders round the crater, and the flank under it with it - a share of the lift by the
 *  direction (ux, uy) from the centre, read on a circle in the noise's plane (no angle asked). */
const crownOf = (ux, uy) =>
  1 + D.lobes.amp * (2 * perlinNoise(ux * D.lobes.radius + 17.31, uy * D.lobes.radius + 5.77) - 1);
/** The crown on the direction (ux, uy) from the centre - the share of the lift the cone stands at there (the far draws'
 *  hiding: render/redMountainFire.js fireCrown). */
export const redMountainCrown = crownOf;
/** The smooth cone at `r` metres from the centre on the direction (ux, uy), metres over the land - crowned, no crater. */
const coneAt = (r, ux, uy) => coneProfile(r > D.rim ? r - D.rim : 0) * crownOf(ux, uy);
/** A foyada's own depth under the smooth cone, metres, `along` metres down its line of `len`: the crater's at the
 *  breach in the rim, the trough's after the first 1.5 km, none over its last 1 km. */
const troughDeep = (along, len) =>
  (D.depth + (D.trough.depth - D.depth) * smooth01(along / 1500)) * (1 - smooth01((along - (len - 1000)) / 1000));

/**
 * @typedef {{ floor: number, chan: ReadonlyArray<Float64Array> }} RedMountainGround the crater floor's level and each
 *   foyada's floor at each point of its line, kernel units - the levels the lava lies at
 */
/** @type {WeakMap<object, { frame: RedMountainFrame, ground: RedMountainGround }>} */
const _grounds = new WeakMap();
/**
 * THE LEVELS THE LAVA LIES AT, read off `baseAt(gx, gy)` - the land without the volcano (world/landforms.js byteBase,
 * one reader on every thread): the crater's floor, and down each foyada a floor that only falls (the land under its
 * line, the cone, less the trough), never over the lake's. The kernel lays the ravines to these and the lava lies on
 * them. Made once a frame and a reader (`key`).
 * @param {(gx: number, gy: number) => number} baseAt @param {object} key @returns {RedMountainGround|null}
 */
export function redMountainGround(baseAt, key) {
  const f = redMountainFrame();
  if (!f) return null;
  const kept = _grounds.get(key);
  if (kept?.frame === f) return kept.ground;
  const floor = baseAt(f.cx, f.cy) + CRATER_FLOOR_LIFT;
  const chan = f.foyada.map((line) => {
    const n = line.s.length,
      len = line.s[n - 1],
      lv = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const x = line.pts[2 * i],
        y = line.pts[2 * i + 1],
        dx = (x - f.cx) * SAMPLE_M,
        dy = (y - f.cy) * SAMPLE_M,
        r = Math.sqrt(dx * dx + dy * dy);
      const own = baseAt(x, y) + (coneAt(r, dx / r, dy / r) - troughDeep(line.s[i], len)) / UNIT_M;
      const above = i ? lv[i - 1] : floor;
      lv[i] = own < above ? own : above;
    }
    return lv;
  });
  const ground = Object.freeze({ floor, chan: Object.freeze(chan) });
  _grounds.set(key, { frame: f, ground });
  return ground;
}

/** The nearest foyada to world sample (gx, gy) within twice its half-width: [its line, the point's place across it (the
 *  distance over the half-width), its floor's level there] into `out` - false when none is near. */
function nearFoyada(f, ground, gx, gy, out) {
  let best = Infinity;
  const T = D.trough,
    k = SAMPLE_M;
  for (let fi = 0; fi < f.foyada.length; fi++) {
    const line = f.foyada[fi];
    if (gx < line.x0 || gx > line.x1 || gy < line.y0 || gy > line.y1) continue;
    const p = line.pts,
      n = line.s.length,
      len = line.s[n - 1],
      lv = ground.chan[fi],
      ch = line.chunks;
    for (let i = 0; i + 1 < n; i++) {
      if (i % CHUNK === 0) {
        // a run's box: past it, its segments are skipped whole
        const c = 4 * (i / CHUNK);
        if (gx < ch[c] || gx > ch[c + 1] || gy < ch[c + 2] || gy > ch[c + 3]) {
          i += CHUNK - 1;
          continue;
        }
      }
      const ax = p[2 * i],
        ay = p[2 * i + 1],
        ex = p[2 * i + 2] - ax,
        ey = p[2 * i + 3] - ay,
        l2 = ex * ex + ey * ey;
      let t = l2 > 0 ? ((gx - ax) * ex + (gy - ay) * ey) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = gx - ax - ex * t,
        dy = gy - ay - ey * t,
        half = T.halfTop + (T.halfFoot - T.halfTop) * ((line.s[i] + (line.s[i + 1] - line.s[i]) * t) / len);
      const q = (Math.sqrt(dx * dx + dy * dy) * k) / half;
      if (!(q < 2) || !(q < best)) continue;
      best = q;
      out[0] = q;
      out[1] = lv[i] + (lv[i + 1] - lv[i]) * t;
    }
  }
  return best < 2;
}
const _near = new Float64Array(2);

/**
 * THE LAND WITH THE VOLCANO STOOD ON IT at world sample (gx, gy), kernel units: `base` the land under its landforms
 * (DFU's height and the lift), `hills` its landforms' own shapes, `ground` the levels the lava lies at
 * (redMountainGround - the crater's floor, the foyada's). Past the volcano's reach, base + hills unchanged. A foyada's
 * floor is flat across its middle half, its walls rising to the land over the rest of its half-width, and the gullies
 * and the land's own shapes still beside it (within twice its half-width), so its floor is its level to the bit.
 * @param {number} gx @param {number} gy @param {number} base @param {number} hills @param {RedMountainGround} ground
 */
export function redMountainLand(gx, gy, base, hills, ground) {
  const f = redMountainFrame();
  if (!f) return base + hills;
  const dx = gx - f.cx,
    dy = gy - f.cy;
  if (!(dx < f.reach && dx > -f.reach && dy < f.reach && dy > -f.reach)) return base + hills;
  const r = Math.sqrt(dx * dx + dy * dy) * SAMPLE_M;
  if (!(r < RED_MOUNTAIN_REACH)) return base + hills;
  const ux = r > 0 ? (dx * SAMPLE_M) / r : 1,
    uy = r > 0 ? (dy * SAMPLE_M) / r : 0;
  const d = r - D.rim;
  const near = nearFoyada(f, ground, gx, gy, _near),
    still = near ? 1 - smooth01(2 - _near[0]) : 1; // the land's own shapes stilled about a foyada
  let lift = coneAt(r, ux, uy);
  if (d > 0 && d < D.gully.reach) {
    // the gullies: polar noise stretched down the fall line, deepest where it is steep
    const q = D.gully.grain * Math.sqrt(Math.sqrt(r));
    const v = 2 * perlinNoise(ux * q + 41.13, uy * q + 29.71) - 1;
    const grade = coneGrade(d); // the flank's own fall, rise over run
    const reach = 1 - smooth01((d - 0.6 * D.gully.reach) / (0.4 * D.gully.reach));
    lift +=
      D.gully.depth *
      (2 * (v < 0 ? -v : v) - 0.8) *
      (grade < 0.5 ? grade / 0.5 : 1) *
      reach *
      smooth01(d / 400) *
      still;
  }
  let land = base + hills * smooth01(d / D.keep) * still + lift / UNIT_M;
  if (near && _near[1] < land) land += (_near[1] - land) * (1 - smooth01((_near[0] - 0.5) / 0.5)); // the foyada's floor
  if (d >= 0) return land;
  // the crater: the inner wall from the rim down to one flat floor
  const s = smooth01((D.rim - r) / (D.rim - D.floor));
  return land + (ground.floor - land) * s;
}

/** The crater floor's level over the land at the centre, kernel units - the lift at the rim less the crater's depth
 *  (world/landforms.js redMountainFloor adds the land's own level at the centre's byte). */
export const CRATER_FLOOR_LIFT = (D.lift - D.depth) / UNIT_M;
/** The most the volcano stands over the land anywhere, kernel units - its crowned rim and the gullies' ridges. */
export const RED_MOUNTAIN_TOP = (D.lift * (1 + D.lobes.amp) + 1.2 * D.gully.depth) / UNIT_M;

/** The most the volcano stands over the land in Bay pixel (px, py), kernel units (0 past its reach) - the bound a
 *  reader of the land's top adds (world/landforms.js groundTopOf: the snowpack's levels). The profile falls with the
 *  distance, so its value at the pixel's nearest point to the centre bounds it, crowned, with the gullies' ridges. */
export function redMountainTopNear(px, py) {
  const f = redMountainFrame();
  if (!f) return 0;
  const x0 = px * 128,
    y0 = (MAP_ROWS - py) * 128;
  const dx = f.cx < x0 ? x0 - f.cx : f.cx > x0 + 128 ? f.cx - x0 - 128 : 0;
  const dy = f.cy < y0 ? y0 - f.cy : f.cy > y0 + 128 ? f.cy - y0 - 128 : 0;
  const d = Math.sqrt(dx * dx + dy * dy) * SAMPLE_M - D.rim;
  if (!(d < FLANK_REACH)) return 0;
  return (coneProfile(d > 0 ? d : 0) * (1 + D.lobes.amp) + 1.2 * D.gully.depth) / UNIT_M;
}

/** THE SMOOTH CONE at world sample (gx, gy), kernel units over the land: crowned, the crater at its floor's depth under
 *  the rim - no gully and no foyada. What a reader that has no feet on the ground asks: the far views (a vertex every
 *  819 m would alias the ravines - redMountainLiftAt), the air's mean ground and its fire (systems/weather/airGround.js),
 *  the summits' snow line (world/peaks/snowcap.js). 0 past the reach. */
export function redMountainSmooth(gx, gy) {
  const f = redMountainFrame();
  if (!f) return 0;
  const dx = gx - f.cx,
    dy = gy - f.cy;
  if (!(dx < f.reach && dx > -f.reach && dy < f.reach && dy > -f.reach)) return 0;
  const r = Math.sqrt(dx * dx + dy * dy) * SAMPLE_M,
    d = r - D.rim;
  if (!(d < FLANK_REACH)) return 0;
  const lift = coneProfile(d > 0 ? d : 0) * crownOf(r > 0 ? (dx * SAMPLE_M) / r : 1, r > 0 ? (dy * SAMPLE_M) / r : 0);
  if (d >= 0) return lift / UNIT_M;
  return (lift - (lift - (D.lift - D.depth)) * smooth01(-d / (D.rim - D.floor))) / UNIT_M;
}

/** THE FAR VIEWS' VOLCANO at Bay pixel (px, py), kernel units over the land (render/farRing.js ringGroundAt: the far
 *  ring, the middle ring's eased rim and the travel view; ringTintAt its ash): the smooth cone at the pixel's centre. 0
 *  past the reach. */
export function redMountainLiftAt(px, py) {
  return redMountainSmooth((px + 0.5) * 128, (MAP_ROWS - py) * 128 + 64);
}
/** The smooth cone at Bay point (x, y) - a pixel corner, where a far field vertex stands on its node's ground (RELIEF-PEAKS:
 *  render/farField.js, the vertex's node), kernel units over the land. 0 past the reach. */
export function redMountainNodeLift(x, y) {
  return redMountainSmooth(x * 128, (MAP_ROWS + 1 - y) * 128);
}

/** LAVA-CLEAR: is world sample (gx, gy) on a bed the lava lies in - the crater's floor, or a foyada's flat floor (the
 *  middle half of its width) down its lava's run? The lava (render/redMountainFire.js: its lake 0.92 of the floor, a
 *  river 0.42 of the trough) lies within, at least 17 m inside a bed's edge: a thing whose middle is off every bed, and
 *  whose reach is under that, stands off the lava. */
export function redMountainLavaBed(gx, gy) {
  const f = redMountainFrame();
  if (!f) return false;
  const dx = (gx - f.cx) * SAMPLE_M,
    dy = (gy - f.cy) * SAMPLE_M,
    T = D.trough;
  if (dx * dx + dy * dy < D.floor * D.floor) return true;
  for (const line of f.foyada) {
    if (gx < line.x0 || gx > line.x1 || gy < line.y0 || gy > line.y1) continue;
    const p = line.pts,
      n = line.s.length,
      len = line.s[n - 1],
      run = len * T.lava;
    for (let i = 0; i + 1 < n && line.s[i] < run; i++) {
      const ax = p[2 * i],
        ay = p[2 * i + 1],
        ex = p[2 * i + 2] - ax,
        ey = p[2 * i + 3] - ay,
        l2 = ex * ex + ey * ey;
      let t = l2 > 0 ? ((gx - ax) * ex + (gy - ay) * ey) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const along = line.s[i] + (line.s[i + 1] - line.s[i]) * t;
      if (along > run) continue;
      const half = 0.5 * (T.halfTop + (T.halfFoot - T.halfTop) * (along / len)),
        qx = (gx - ax - ex * t) * SAMPLE_M,
        qy = (gy - ay - ey * t) * SAMPLE_M;
      if (qx * qx + qy * qy < half * half) return true;
    }
  }
  return false;
}

/** @type {Set<string>|null} */
let _lavaPx = null,
  _lavaOf = /** @type {RedMountainFrame|null} */ (null);
/** LAVA-CLEAR: does a lava bed reach Bay pixel (px, py)? A place there would flatten the bed under it (a location levels
 *  its whole pixel), so no lair or spawn stands on one. Over the beds: a box about the crater's floor and about each
 *  piece of a foyada's run, so a pixel it names may hold none. Made once a frame. */
export function redMountainLavaIn(px, py) {
  const f = redMountainFrame();
  if (!f) return false;
  if (_lavaOf !== f || !_lavaPx) {
    const out = new Set(),
      k = 1 / SAMPLE_M;
    const mark = (x0, y0, x1, y1) => {
      for (let y = Math.floor(MAP_ROWS + 1 - y1 / 128); y <= Math.floor(MAP_ROWS + 1 - y0 / 128); y++)
        for (let x = Math.floor(x0 / 128); x <= Math.floor(x1 / 128); x++) out.add(`${x},${y}`);
    };
    mark(f.cx - D.floor * k, f.cy - D.floor * k, f.cx + D.floor * k, f.cy + D.floor * k);
    const pad = 0.5 * D.trough.halfFoot * k;
    for (const line of f.foyada) {
      const p = line.pts,
        n = line.s.length,
        run = line.s[n - 1] * D.trough.lava;
      for (let i = 0; i + 1 < n && line.s[i] < run; i++) {
        mark(
          Math.min(p[2 * i], p[2 * i + 2]) - pad,
          Math.min(p[2 * i + 1], p[2 * i + 3]) - pad,
          Math.max(p[2 * i], p[2 * i + 2]) + pad,
          Math.max(p[2 * i + 1], p[2 * i + 3]) + pad,
        );
      }
    }
    _lavaOf = f;
    _lavaPx = out;
  }
  return _lavaPx.has(`${px},${py}`);
}
