// ═══════════════════════════════════════════════════════════════════
// LANDFORM1-3 (2026-10-06, Mac, with a picture of the Iliac Bay's
// heightmap: "Can we adjust the heightmap to be more of this? and allow
// roads to carve through terrian and caverns without breaking anything
// and rivers to actually have depth, not just lying flat on land").
// THE PORT'S OWN TERRAIN, behind the Features row `landforms`
// (scenes/shared.js landformsOn) - off on the classic skin, where the
// ground is DFU's to the bit.
//
// ONE FUNCTION OF WORLD POSITION, RUN INSIDE THE KERNEL. The shaper is
// handed to terrainSampler.js's sampleKernel (its `landform`), so every
// reader of the kernel takes the same ground: the pixel's own grid, the
// ghost rows its edge normals read (EV4), a promotion's restride
// (PERF-EXT26), the gate's beacon (GATE-SEEN). Nothing here reads a
// pixel's own tilemap or its location: what a sample becomes depends on
// where it is in the world and on the world's data alone - WOODS.WLD and
// the road network every kernel already holds - so the sample on a
// pixel's edge is the same number from both of the pixels that share it.
// (Basic Roads' own smoother writes samples 1..127 only, and every road
// bed it smooths returns to raw ground at every pixel edge: a carve made
// that way would step at every seam.)
//
// THE LAW EVERYTHING ELSE STANDS ON - AT OR UNDER THE KNEE, A HEIGHT IS
// DFU'S. The knee is the beach line with its jitter (terrainTiles.js:
// SCALED_BEACH_ELEVATION + BEACH_JITTER, 41.5): every height at or under
// it is returned as the kernel made it, and every height over it stays
// over it. So the sea, the beach and every tile the classifier draws
// from a height stand exactly where they stood, and with them every
// reader that asks only "is it water" - the Deep Waters bake, the roads'
// own router, the travel map's sea, the dry-ground gates.
//
// LANDFORM1 - THE HEIGHTMAP, RAISED. The picture is WOODS.WLD's small
// heightmap, the 1000 x 500 one the kernel reads at BASE_HEIGHT_SCALE.
// "More of this" is that map standing taller in the world: the kernel's
// own small-heightmap term (`low`, 8 x the bicubic byte) lifts each
// sample by reliefLift(low) - nothing under the median land, then a
// smooth rise to 0.9 x that term itself, which stands the highest real
// ground about half as tall again (the Dragontail summit 1.7 -> 2.7 km). Only
// that term is lifted: the large heightmap's hills and the ground noise
// keep DFU's scale, so the massifs grow and the footing under a walker
// is the footing DFU gives (a lifted ground noise is 25-metre spikes).
// The lift is a function of `low` alone, so the far ring - which reads
// the same byte at a pixel's centre - takes it too (farRing.js).
// THE CEILING. The shaper is handed DFU's height as DFU stands it -
// clamped at MAX_TERRAIN_HEIGHT - and the lift stops rising at the
// heightmap's 7-bit top, so nothing stands over LANDFORM_CEILING. Real
// ground never reaches either (its bytes stop at 109); WOODS.WLD's one
// byte over 127 does - a 255 at map pixel (470, 355), in the sea off
// Tigonus, which DFU stands as a 1.9 km pillar clamped flat at its
// ceiling and the landforms stand at theirs, 3 km, not 5.
//
// LANDFORM2 - THE ROADS ARE CUT IN. A road or a track is graded to the
// kernel's macro height (both bicubic terms, the lift, no ground noise)
// read at the nearest point of its centre line: flat across, cut into a
// hillside with a bank up to the land, and on the low side a bank down
// to it over the same width (AUDIT LANDFORMS E1); the ground noise eased
// back in over a verge past the bank. The centre line
// is the network's own (roadNetwork.js's compass mask: each arm from a
// pixel's centre to its edge or corner), the one the painter paints -
// the cardinal road down the seam of tiles 63 and 64, the diagonal down
// x == y - so the cut runs under the painted tiles. A CHANNEL IS THE
// WATER'S (AUDIT LANDFORMS E2): a road or track crossing a river or a
// stream stands there on its own bed alone - the causeway's top - and
// its bank and verge give way to the channel, so the painted water lies
// on the channel's floor right up to the causeway.
//
// LANDFORM3 - THE RIVERS LIE IN THE LAND. Basic Roads' rivers and
// streams (painted when RiversAndStreams is on) take the same cut,
// dropped under the land: the water's floor flat across the whole
// painted width, so WATER1's film - the ground's own triangles, lifted a
// hand's breadth - lies flat in a channel with banks above it instead
// of on the field; on a hillside the low bank is a levee, never lower
// than the land at the river's own centre line. The player swims on that film as DFU swims them
// (MAC2's law: the swim is where the surface is drawn), so nothing about
// water changes but where it lies. A river is cut wherever it is painted
// and nowhere else - the network's `water`, the mod's own switch. Online
// that switch is the room's (2026-10-06, Mac: "Yes rivers should be
// online" - onlineLane.js ONLINE_ROOM_MOD_KEYS): a river cut into the
// land is ground, and a room stands on one ground.
//
// ALL THE DIALS ARE IN ONE PLACE, LANDFORM_DIALS (ROAD_DIALS' rule).
// Distances are in samples (6.4 m), heights in the kernel's units
// (1.25 m - STREAMING_TERRAIN_SCALE).
// ═══════════════════════════════════════════════════════════════════

import { SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION, BASE_HEIGHT_SCALE, NOISE_MAP_SCALE, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION, kernelTerms, sampleKernel, generateSamples } from './terrainSampler.js';
import { BEACH_JITTER, blendLocationTerrain } from './terrainTiles.js';
import { DIR_DELTA, MAP_W, MAP_H } from './roadNetwork.js';


/** At or under this, a height is DFU's: the beach line with its jitter, the highest height the tile classifier can
 *  still call beach (terrainTiles.js generateTileData). */
export const LANDFORM_KNEE = SCALED_BEACH_ELEVATION + BEACH_JITTER;
/** A cut never takes ground under the smaller of its own height and this - half a unit over the knee, clear of the
 *  float32 round trip the tile classifier makes of a sample. */
export const LANDFORM_FLOOR = LANDFORM_KNEE + 0.5;

export const LANDFORM_DIALS = Object.freeze({
  // LANDFORM1: `low` - LANDFORM_KNEE at which the small heightmap starts to rise (a byte of about 30, the median of
  // the land on the picture), at which it has risen fully (about 118, the Wrothgarian peaks), and how much taller the
  // fully risen ground stands (1 + gain times).
  relief: Object.freeze({ from: 200, full: 900, gain: 0.9 }),
  // LANDFORM2/3, per path: `flat` the half-width of the level floor, `bank` the width of the slope from it to its top,
  // `verge` the distance past the bank over which the land comes back (the ground noise with it), `drop` how far the
  // floor lies under the land it is graded to (a river's water under its banks) - and the least a river's or a
  // stream's bank top stands over its floor, so one on a hillside is held by a levee on its low side; a road's or a
  // track's low bank falls to the land (AUDIT LANDFORMS E1). Paint order is the lerp order, last wins: stream, river,
  // track, road (roadPainter.js: the first painter to write a tile keeps it, and roads paint first - a road over a
  // river is a causeway, on its own bed: AUDIT LANDFORMS E2).
  stream: Object.freeze({ flat: 1, bank: 1.25, verge: 4, drop: 0.8 }),     // the bank art's water down the middle: 1 m under
  river: Object.freeze({ flat: 2, bank: 1.5, verge: 6, drop: 1.92 }),      // the whole painted width, 2.4 m under
  track: Object.freeze({ flat: 1.25, bank: 2, verge: 5, drop: 0 }),
  road: Object.freeze({ flat: 1.25, bank: 2.5, verge: 6, drop: 0 }),
  // the height over the knee across which a cut fades in from nothing, so a path that reaches the beach meets it
  // without a step (the knee is a hard line for heights; a cut must not be)
  coast: 12,
});

/** The four path layers in lerp order, with the network field each reads. */
const LAYERS = Object.freeze([
  Object.freeze({ key: 'streams', dial: LANDFORM_DIALS.stream, water: true }),
  Object.freeze({ key: 'rivers', dial: LANDFORM_DIALS.river, water: true }),
  Object.freeze({ key: 'tracks', dial: LANDFORM_DIALS.track, water: false }),
  Object.freeze({ key: 'roads', dial: LANDFORM_DIALS.road, water: false }),
]);

const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const smoothstep = (a, b, v) => smooth01((v - a) / (b - a));

/** The small heightmap's top as `low`: WOODS.WLD's bytes are 7-bit, and DFU's MAX_TERRAIN_HEIGHT is built on 127. */
const LOW_TOP = 127 * BASE_HEIGHT_SCALE;

/**
 * LANDFORM1: how far the small heightmap lifts a sample, in kernel units. `low` is the kernel's small-heightmap term
 * (the bicubic byte times BASE_HEIGHT_SCALE). Nothing up to `from` over the knee, then `gain * e` eased in over
 * [from, full] - smooth, never negative, rising with `low` up to the heightmap's 7-bit top and level past it.
 * @param {number} low
 * @returns {number}
 */
export function reliefLift(low) {
  const { from, full, gain } = LANDFORM_DIALS.relief;
  const e = (low < LOW_TOP ? low : LOW_TOP) - LANDFORM_KNEE;
  if (!(e > from)) return 0;
  return gain * e * smooth01((e - from) / (full - from));
}

/** LANDFORM1: the highest the landforms stand anything, in kernel units - DFU's ceiling and the most the lift adds
 *  (about 3,020 m). Only WOODS.WLD's one glitch byte reaches it (the header, THE CEILING). */
export const LANDFORM_CEILING = MAX_TERRAIN_HEIGHT + reliefLift(LOW_TOP);

/** LANDFORM1: a map-pixel byte's macro height with the lift, in kernel units - the far ring's law (farRing.js
 *  ringHeight), max(byte * 8, ocean) plus the lift its own `low` earns. */
export function reliefByteHeight(byte) {
  const low = byte * BASE_HEIGHT_SCALE;
  return Math.max(low, SCALED_OCEAN_ELEVATION) + reliefLift(low);
}

/**
 * LANDFORM1: how far the landforms move DFU's ground at a point of a pixel, in kernel units - what a height written in
 * one frame is moved by to stand on the other (world.js groundFrameHeight and restandHeight: a save, a cached scene,
 * an anchor). The one step DFU takes after the kernel that moves a point's ground - a location's blend, which lerps
 * every sample toward the pixel's mean - is linear in the samples, so a point's move is a FIELD taken through that
 * same blend (blendLocationTerrain itself, over the field): exact over a town's levelled ground, exact in the wild.
 * AUDIT LANDFORMS B2: with the world's `landforms` the field is the kernel's own shaped samples less DFU's, so a road's
 * cut and fill and a river's channel are followed too; it was the lift alone, and a record from before the row stood
 * up to 29.8 m over a road's cut (a fall billing over 120 HP) - on the real data now 1.6 m over at worst, 2.0 m under
 * (the mod's SmoothRoads, which smooths DFU's own road and not the level bed). Without them, the lift alone (no
 * network). Not followed: World of Daggerfall's flatten.
 * @param {object} woods - the sampler's three-method surface.
 * @param {number} px
 * @param {number} py
 * @param {number} sx - the point's x in the pixel's sample space (0..128, east)
 * @param {number} sy - its y (0..128, north)
 * @param {?{xMin: number, xMax: number, yMin: number, yMax: number}} [locationRect] - the pixel's location rect
 *   (setLocationTiles' answer), or null in the wild.
 * @param {number} [hDim]
 * @param {?object} [landforms] - createLandforms over the network the pixel is cut along, or null: the lift alone
 * @returns {number}
 */
export function landformLift(woods, px, py, sx, sy, locationRect = null, hDim = HEIGHTMAP_DIMENSION, landforms = null) {
  return landformLiftField(woods, px, py, locationRect, hDim, landforms)(sx, sy);
}

/**
 * LANDFORM1: landformLift for every point of one pixel - the field made once, then read at each point. A load
 * re-stands a whole save's records at once, most of them in one town. A town's is all its samples through the blend
 * (with the landforms, one kernel pass: the shaped samples and DFU's beside them, generateSamples' `classic`); in the
 * wild a sample is asked of the two kernels when a point first reads it, so a far record costs its four corners.
 * @returns {(sx: number, sy: number) => number}
 */
export function landformLiftField(woods, px, py, locationRect = null, hDim = HEIGHTMAP_DIMENSION, landforms = null) {
  const span = hDim - 1;
  let f;
  if (landforms && !locationRect) {
    const shaped = sampleKernel(woods, px, py, hDim, true, landforms), plain = sampleKernel(woods, px, py, hDim, true, null);
    const memo = new Map();   // a sample as generateSamples keeps it, float32 - the ground the pixel is built of
    f = (x, y) => {
      const k = x * hDim + y;
      let v = memo.get(k);
      if (v === undefined) memo.set(k, v = (Math.fround(shaped(x, y)) - Math.fround(plain(x, y))) * MAX_TERRAIN_HEIGHT);
      return v;
    };
  } else {
    const { base } = kernelTerms(woods, px, py, hDim);
    const at = (x, y) => reliefLift(base(x, y) * BASE_HEIGHT_SCALE);
    if (!locationRect) return at;
    const field = new Float32Array(hDim * hDim);
    let sum = 0;
    if (landforms) {
      const classic = new Float32Array(hDim * hDim), shaped = generateSamples(woods, px, py, hDim, landforms, classic);
      for (let i = 0; i < field.length; i++) sum += (field[i] = (shaped[i] - classic[i]) * MAX_TERRAIN_HEIGHT);
    } else {
      for (let x = 0; x < hDim; x++) for (let y = 0; y < hDim; y++) sum += (field[x * hDim + y] = at(x, y));
    }
    blendLocationTerrain(field, sum / field.length, locationRect, hDim);
    f = (x, y) => field[x * hDim + y];
  }
  // the field between its samples: bilinear, the read the collider's own floor takes (world.js heightAt)
  return (sx, sy) => {
    const cx = Math.max(0, Math.min(span, sx)), cy = Math.max(0, Math.min(span, sy));
    const ix = Math.min(span - 1, Math.floor(cx)), iy = Math.min(span - 1, Math.floor(cy));
    const fx = cx - ix, fy = cy - iy;
    return f(ix, iy) * (1 - fx) * (1 - fy) + f(ix + 1, iy) * fx * (1 - fy) + f(ix, iy + 1) * (1 - fx) * fy + f(ix + 1, iy + 1) * fx * fy;
  };
}

/**
 * The landforms for one world: WOODS.WLD, and the road network every terrain kernel already holds (the worker's own,
 * or the main thread's fallback copy - the same arrays). Holds no cache: a pixel's shaper builds its own path profiles
 * and drops them with the pixel, so a long walk grows nothing.
 *
 * @param {object} o
 * @param {object} o.woods - the sampler's three-method surface.
 * @param {?{roads: Uint8Array, tracks: Uint8Array, rivers?: ?Uint8Array, streams?: ?Uint8Array, water?: boolean}} [o.roads]
 *   - the network; null shapes the relief alone (a world whose network has not landed yet - ROADS 25 rebuilds the
 *   pixels it painted without one, and they come back cut).
 *   Rivers and streams are cut where they are PAINTED and only there (the network's `water`, RiversAndStreams - the
 *   room's online): a channel with no water in it is a ditch. `rivers` answers whether they are.
 * @param {number} [o.hDim]
 * @returns {{ pixel: (px: number, py: number) => (x: number, y: number, h: number, low: number, g: number) => number, rivers: boolean }}
 */
export function createLandforms({ woods, roads = null, hDim = HEIGHTMAP_DIMENSION } = {}) {
  const span = hDim - 1;
  const half = span / 2;
  const cutRivers = !!roads?.water;
  const nets = LAYERS.map((l) => (l.water && !cutRivers ? null : roads?.[l.key] ?? null));
  return { pixel: (px, py) => pixelShaper(woods, nets, px, py, span, half, hDim), rivers: cutRivers };
}

/** One pixel's shaper: its paths' segments gathered from the 3x3 pixels round it, and the closure the kernel calls. */
function pixelShaper(woods, nets, px, py, span, half, hDim) {
  // the pixel's own sample origin in world samples: x east from the map's west edge, y NORTH from its south edge (the
  // ground noise's own frame, terrainSampler.js `noisey`), so pixel (px, py)'s (128, y) is (px + 1, py)'s (0, y) and
  // its (x, 128) is (px, py - 1)'s (x, 0) - one number each, from either pixel
  const ox = px * span;
  const oy = (MAP_H - py) * span;
  const terms = new Map();
  const termsOf = (qx, qy) => {
    const k = qy * MAP_W + qx;
    let t = terms.get(k);
    if (!t) terms.set(k, t = kernelTerms(woods, qx, qy, hDim));
    return t;
  };
  // Each layer's segments within its reach of this pixel's box, in ONE global order - by pixel row, column, then the
  // compass in DIR_DELTA's order - so the two pixels on a seam sum a shared sample's segments in the same order and
  // land on the same float.
  const layers = [];
  for (let li = 0; li < LAYERS.length; li++) {
    const net = nets[li];
    if (!net) continue;
    const dial = LAYERS[li].dial;
    const reach = dial.flat + dial.bank + dial.verge;
    const segs = [];
    for (let qy = py - 1; qy <= py + 1; qy++) {
      if (qy < 0 || qy >= MAP_H) continue;
      for (let qx = px - 1; qx <= px + 1; qx++) {
        if (qx < 0 || qx >= MAP_W) continue;
        const mask = net[qy * MAP_W + qx];
        if (!mask) continue;
        const cx = qx * span + half;
        const cy = (MAP_H - qy) * span + half;
        for (const [bit, mdx, mdy] of DIR_DELTA) {
          if (!(mask & bit)) continue;
          const dx = mdx, dy = -mdy;   // the compass's map Y runs south; this frame's y runs north
          const ex = cx + dx * half, ey = cy + dy * half;
          // a box test first: the segment's own box against the pixel's, widened by the reach
          if (Math.max(cx, ex) < ox - reach || Math.min(cx, ex) > ox + span + reach
            || Math.max(cy, ey) < oy - reach || Math.min(cy, ey) > oy + span + reach) continue;
          const len = half * Math.sqrt(dx * dx + dy * dy);
          segs.push({ ax: cx, ay: cy, ux: (dx * half) / len, uy: (dy * half) / len, len, dx, dy, qx, qy, prof: null });
        }
      }
    }
    if (segs.length) layers.push({ dial, reach, segs, water: LAYERS[li].water });
  }
  // The macro height a path is graded to, along one arm: at each whole sample of the arm (the arm runs from the centre
  // (64, 64) of its own pixel by a whole sample a step - a diagonal's steps are its own samples' diagonal), the
  // kernel's two bicubic terms of the pixel the arm belongs to, the lift, no ground noise; between them, linear.
  const profileOf = (s) => {
    if (s.prof) return s.prof;
    const { base, noise } = termsOf(s.qx, s.qy);
    const prof = new Float64Array(half + 1);
    for (let k = 0; k <= half; k++) {
      const lx = half + s.dx * k, ly = half + s.dy * k;
      const b = base(lx, ly);
      const low = b * BASE_HEIGHT_SCALE;
      const macro = low + noise(lx, ly) * NOISE_MAP_SCALE;
      prof[k] = Math.min(Math.max(macro, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT) + reliefLift(low);   // DFU's macro as DFU stands it
    }
    return (s.prof = prof);
  };
  const graded = (s, t) => {
    const prof = profileOf(s);
    const f = (t / s.len) * half;
    const i = Math.min(half - 1, Math.floor(f));
    return prof[i] + (prof[i + 1] - prof[i]) * (f - i);
  };
  const targets = new Float64Array(LAYERS.length);   // each layer's own ground at the sample
  const weights = new Float64Array(LAYERS.length);
  const dmins = new Float64Array(LAYERS.length);   // how far the sample lies from each layer's nearest centre line

  /**
   * @param {number} x - the sample's x in its pixel (0..128)
   * @param {number} y
   * @param {number} h - the kernel's height, ocean clamp applied
   * @param {number} low - its small-heightmap term
   * @param {number} g - its ground-noise term (0 when the kernel leaves it out)
   * @returns {number} the shaped height, kernel units
   */
  return (x, y, h, low, g) => {
    if (!(h > LANDFORM_KNEE)) return h;   // the knee: DFU's own height, the sea and the beach whole
    const land = h + reliefLift(low);
    if (!layers.length) return land;
    const gx = ox + x, gy = oy + y;
    let touched = false;
    for (let li = 0; li < layers.length; li++) {
      const { dial, reach, segs } = layers[li];
      let dmin = Infinity, ws = 0, wf = 0;
      for (let si = 0; si < segs.length; si++) {
        const s = segs[si];
        const vx = gx - s.ax, vy = gy - s.ay;
        let t = vx * s.ux + vy * s.uy;
        const past = t < 0 ? -t : t > s.len ? t - s.len : 0;   // how far the sample lies beyond the arm's end
        if (t < 0) t = 0; else if (t > s.len) t = s.len;
        const qx = vx - s.ux * t, qy = vy - s.uy * t;
        const d = Math.sqrt(qx * qx + qy * qy);
        if (!(d < reach)) continue;
        if (d < dmin) dmin = d;
        // the arms near a sample grade it together, the nearest all but alone: a bend's inside or a junction is graded
        // to a blend of its arms, never to a step where one arm hands over to the next. An arm the sample lies BEYOND
        // the end of (its nearest point its end) all but stands down a sample past it - a straight road is two arms
        // meeting at a centre and at every pixel edge, and the one alongside is the one that grades it
        const q = d * d + 0.25;
        const w = (((1 - d / reach) ** 2) / (q * q)) * (1e-3 + 0.999 * (1 - smooth01(past)));
        ws += w;
        wf += w * graded(s, t);
      }
      dmins[li] = dmin;
      if (dmin === Infinity) { weights[li] = 0; continue; }
      touched = true;
      // the cross-section: the floor, a bank to its top - the smooth land, or for a river or a stream `drop` over its
      // floor where the land lies lower (a levee) - and past the bank the land again, its ground noise with it, over the
      // verge. AUDIT LANDFORMS E1: a road's or a track's top is the smooth land on both sides - its low bank falls to the
      // land as its high bank rises to it. Its top was `floor + 0` there, a level shelf the bank's whole width: a bed
      // 32 m wide on a hillside, and on the real WOODS.WLD fills to 11 m where 4 now stand.
      const floor = wf / ws - dial.drop;
      const smoothLand = land - g;
      const top = dial.drop > 0 && !(smoothLand > floor + dial.drop) ? floor + dial.drop : smoothLand;
      const edge = dial.flat + dial.bank;
      targets[li] = dmin <= edge
        ? floor + (top - floor) * smoothstep(dial.flat, edge, dmin)
        : top + (land - top) * smoothstep(edge, reach, dmin);
      weights[li] = 1 - smoothstep(edge, reach, dmin);
    }
    if (!touched) return land;
    const fade = smoothstep(LANDFORM_KNEE, LANDFORM_KNEE + LANDFORM_DIALS.coast, land);
    // AUDIT LANDFORMS E2: how far into a channel the sample lies - 1 on a river's or a stream's floor, 0 at its bank's top.
    // There a road or a track stands on its own bed alone (a causeway's top); its bank and verge give way to the channel
    // by as much. They refilled it: on the real WOODS.WLD the painted water climbed up to 19 m out of its floor beside
    // 629 crossings and riverside roads.
    let chan = 0;
    for (let li = 0; li < layers.length; li++) {
      if (!layers[li].water || !(weights[li] > 0)) continue;
      const d = layers[li].dial, c = 1 - smoothstep(d.flat, d.flat + d.bank, dmins[li]);
      if (c > chan) chan = c;
    }
    let out = land;
    for (let li = 0; li < layers.length; li++) {
      let a = weights[li] * fade;
      if (chan > 0 && !layers[li].water && dmins[li] > layers[li].dial.flat) a *= 1 - chan;
      if (a > 0) out += (targets[li] - out) * a;
    }
    const least = land < LANDFORM_FLOOR ? land : LANDFORM_FLOOR;
    return out > least ? out : least;
  };
}
