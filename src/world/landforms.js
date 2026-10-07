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
// THE LIFT FADES BESIDE THE SEA (AUDIT LANDFORMS II I1, Mac: "Is it too
// steep?", then "Go ahead"). The lift steepens a slope by up to 2.8
// times, most where the land already rises fastest, and nowhere does it
// rise faster than out of the sea: Menevia's plateau (bytes of 75 a pixel
// from the sea) stood its rim at 70 degrees, a road down it dropped a
// walker 95 m, and every 51 m grade over 63 degrees the lift made new lay
// within three map pixels of a sea byte. So the lift is faded by its
// distance to the sea: none within a pixel of it, all of it three pixels
// in (`cliff`), a byte node's fade read through the kernel's own bicubic
// window - the rim stands as DFU stands it and the plateau behind it rises
// to its whole lift. The lift is a function of `low` and the bytes about
// it alone, so the far ring - which reads the same byte at a pixel's
// centre - takes it too, faded the same (farRing.js, cliffFadeAt).
// THE CEILING. The shaper is handed DFU's height as DFU stands it -
// clamped at MAX_TERRAIN_HEIGHT - and the lift stops rising at the
// heightmap's 7-bit top, so nothing stands over LANDFORM_CEILING. Real
// ground never reaches either (its bytes stop at 109); WOODS.WLD's one
// byte over 127 does - a 255 at map pixel (470, 355), in the sea off
// Tigonus, which DFU stands as a 1.9 km pillar clamped flat at its
// ceiling. Unfaded the landforms stood it at theirs, 3 km, not 5; beside
// the sea the lift fades (AUDIT LANDFORMS II I1), and a sea byte lies a
// diagonal step from it, so it keeps a ninth of the lift: about 2.5 km.
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
// WATER'S (AUDIT LANDFORMS E2): a road crossing a river or a stream
// stands there on its own bed alone - the causeway's top - and its bank
// and verge give way to the channel, so the painted water lies on the
// channel's floor right up to the causeway. A track gives way on its own
// bed too (AUDIT LANDFORMS II J1): the painter paints the water over a
// track, so a track crosses water by a ford.
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
// LANDFORM4 - A TOWN STANDS IN ITS LAND (2026-10-07, Mac, of a town
// walled in by its own levelling: "I dont care about DFU. I want
// detailed generation, rolling hills, varied terrian"). DFU levels a
// location to its pixel's mean and ramps back to raw ground by the
// pixel's edge, so the whole rise between the town and the land round it
// is taken inside one pixel - and with the lift, that rise stood as a
// wall a hundred metres and more tall. Here every one of the game's own
// locations (`sites`, landformSites - the same table on every thread and
// every client) pulls the ground toward its level with a falloff that
// reaches past its pixel's edge into the neighbours (`site`): the town's
// rect at its level, the land easing back over hundreds of metres. The
// level is its pixel's mean over a coarse grid (siteLevel), so DFU's own
// blend after the kernel - still run, still the location's - finds the
// pixel already all but level and moves little.
//
// LANDFORM5 - THE LAND ROLLS. A field of hills over every land sample
// (hillsAt): a domain-warped sum of three octaves, its height set by a
// region field (some country rolls hard, some lies almost flat) and by
// the small heightmap (uplands roll taller), eased out toward the beach so
// it never reaches the knee, and stilled along the painted rivers
// (waterFade), so a river lies in its valley rather than climbing a
// hill. A road and a track are graded to the land WITH its hills, so they
// ride them; a town's pull levels them.
//
// ALL THE DIALS ARE IN ONE PLACE, LANDFORM_DIALS (ROAD_DIALS' rule).
// Distances are in samples (6.4 m), heights in the kernel's units
// (1.25 m - STREAMING_TERRAIN_SCALE).
// ═══════════════════════════════════════════════════════════════════

import { SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION, BASE_HEIGHT_SCALE, NOISE_MAP_SCALE, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION, TERRAIN_SIZE, STREAMING_TERRAIN_SCALE, kernelTerms, sampleKernel, generateSamples, cubicInterpolator } from './terrainSampler.js';
import { BEACH_JITTER, WORLD_MAP_TILE_DIM, blendLocationTerrain, locationFootprintRect } from './terrainTiles.js';
import { DIR_DELTA, MAP_W, MAP_H } from './roadNetwork.js';
import { perlinNoise } from './perlin.js';


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
  // track's low bank falls to the land (AUDIT LANDFORMS E1). The lerp runs stream, river, track, road, last wins
  // (roadPainter.js paints a tile road, river, stream, track, the first to write it keeping it): a road over water is a
  // causeway on its own bed (AUDIT LANDFORMS E2), and a track over water a ford, the channel the water's across its
  // bed too, as the water is painted there (AUDIT LANDFORMS II J1 - lerped after the water, it was a causeway the
  // painter painted the river over: the water stood up to 7.9 m over its channel at a track's crossing).
  stream: Object.freeze({ flat: 1, bank: 1.25, verge: 4, drop: 0.8 }),     // the bank art's water down the middle: 1 m under
  river: Object.freeze({ flat: 2, bank: 1.5, verge: 6, drop: 1.92 }),      // the whole painted width, 2.4 m under
  track: Object.freeze({ flat: 1.25, bank: 2, verge: 5, drop: 0 }),
  road: Object.freeze({ flat: 1.25, bank: 2.5, verge: 6, drop: 0 }),
  // the height over the knee across which a cut fades in from nothing, so a path that reaches the beach meets it
  // without a step (the knee is a hard line for heights; a cut must not be)
  coast: 12,
  // AUDIT LANDFORMS II I2: how much steeper than its hillside a road's or a track's bank may stand (a grade, rise over
  // run) - its cut and fill are held to the smooth land within what a bank of its width carries at that (bankHold)
  bankGrade: 0.5,
  // AUDIT LANDFORMS II I1: the lift beside the sea - none at a byte node within `from` map pixels of a sea byte, all of it
  // from `full`, a smoothstep between (cliffFadeAt)
  cliff: Object.freeze({ from: 1, full: 3 }),
  // LANDFORM5: the hills. `low`/`high` their height (kernel units, either side of the land) where the region field lies
  // flat and where it rolls hardest; `upland` how much taller they stand on the high ground (fully from `uplandAt` of
  // `low` over the knee); `coast` the height over the knee across which they ease in from nothing (it keeps them off the
  // knee: their height never reaches the land's own over it); `region` the region field's wavelength, `warp` how far the
  // octaves' domain is pushed about (over `warpScale`), and the octaves' wavelengths and weights (samples).
  hills: Object.freeze({ low: 4, high: 48, upland: 1.6, uplandAt: 700, coast: 96, region: 2400, warp: 80, warpScale: 520, scales: Object.freeze([300, 125, 50]), weights: Object.freeze([1, 0.36, 0.1]) }),
  // LANDFORM4: a site's pull - it reaches `reach` samples past its rect plus `per` times its rect's half-extent, never
  // more than `most` (so no further than the pixels beside its own); `grid` the stride of the level's mean over its pixel.
  site: Object.freeze({ reach: 40, per: 3, most: 124, grid: 8 }),
});

/** The four path layers in lerp order, with the network field each reads; `ford`, a layer the water is painted over
 *  where they cross (a track), so the channel is the water's across its bed too. */
const LAYERS = Object.freeze([
  Object.freeze({ key: 'streams', dial: LANDFORM_DIALS.stream, water: true }),
  Object.freeze({ key: 'rivers', dial: LANDFORM_DIALS.river, water: true }),
  Object.freeze({ key: 'tracks', dial: LANDFORM_DIALS.track, water: false, ford: true }),   // AUDIT LANDFORMS II J1
  Object.freeze({ key: 'roads', dial: LANDFORM_DIALS.road, water: false }),
]);

const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const smoothstep = (a, b, v) => smooth01((v - a) / (b - a));

/** AUDIT LANDFORMS II I1: the fade at a byte node by its squared distance (in map pixels) to the nearest sea byte, past
 *  the last entry 1 - smoothstep(from, full, d) in 1024ths: the kernel's cubic over values of so few bits is exact, so
 *  a pixel's edge, read through its own window and its neighbour's, is one number from both (THE SEAMS). */
const CLIFF_FADE = (() => {
  const { from, full } = LANDFORM_DIALS.cliff;
  const out = new Float64Array(Math.floor(full * full) + 1);
  for (let d2 = 0; d2 < out.length; d2++) out[d2] = Math.round(smooth01((Math.sqrt(d2) - from) / (full - from)) * 1024) / 1024;
  return out;
})();
const CLIFF_REACH = Math.ceil(LANDFORM_DIALS.cliff.full);

/**
 * AUDIT LANDFORMS II I1: how much of the lift a byte node keeps beside the sea - 0 within `cliff.from` map pixels of a
 * sea byte (one whose `low` stands at or under the knee: the beach line's own byte, 5, and under), 1 from `cliff.full`,
 * a smoothstep between in 1024ths. A pure function of the bytes about the node.
 * @param {(x: number, y: number) => number} byteAt - the small heightmap's byte, its coordinates clamped to the map as
 *   WOODS.WLD's own reader clamps them
 * @param {number} qx
 * @param {number} qy
 * @returns {number}
 */
export function cliffFadeAt(byteAt, qx, qy) {
  let best = CLIFF_FADE.length;
  for (let dy = -CLIFF_REACH; dy <= CLIFF_REACH; dy++) {
    for (let dx = -CLIFF_REACH; dx <= CLIFF_REACH; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 < best && byteAt(qx + dx, qy + dy) * BASE_HEIGHT_SCALE <= LANDFORM_KNEE) best = d2;
    }
  }
  return best < CLIFF_FADE.length ? CLIFF_FADE[best] : 1;
}

/**
 * AUDIT LANDFORMS II I1: the lift's fade over one pixel's samples - its sixteen byte nodes' cliffFadeAt through the
 * kernel's own bicubic window (terrainSampler.js kernelTerms' `base`, the same nodes and the same arithmetic), or null
 * where every node keeps its whole lift (all but the coasts).
 * @param {object} woods
 * @param {number} px
 * @param {number} py
 * @param {number} hDim
 * @returns {?(x: number, y: number) => number}
 */
function cliffFade(woods, px, py, hDim) {
  const x0 = px - 2 - CLIFF_REACH, y0 = py - 2 - CLIFF_REACH, side = 4 + 2 * CLIFF_REACH;
  const win = woods.getHeightMapValuesRange1Dim(x0, y0, side);
  const byteAt = (x, y) => win[(x - x0) + (y - y0) * side];
  const f = new Float64Array(16);
  let whole = true;
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      const v = cliffFadeAt(byteAt, px - 2 + r, py - 2 + c);
      f[r + c * 4] = v;
      if (v !== 1) whole = false;
    }
  }
  if (whole) return null;
  const at = (r, c) => f[r + c * 4];
  return (x, y) => {
    const sx = x / (hDim - 1), sy = y / (hDim - 1);
    const x1 = cubicInterpolator(at(0, 3), at(1, 3), at(2, 3), at(3, 3), sx);
    const x2 = cubicInterpolator(at(0, 2), at(1, 2), at(2, 2), at(3, 2), sx);
    const x3 = cubicInterpolator(at(0, 1), at(1, 1), at(2, 1), at(3, 1), sx);
    const x4 = cubicInterpolator(at(0, 0), at(1, 0), at(2, 0), at(3, 0), sx);
    const v = cubicInterpolator(x1, x2, x3, x4, sy);
    return v <= 0 ? 0 : v >= 1 ? 1 : v;
  };
}

/**
 * AUDIT LANDFORMS II I2: A BANK IS NEVER A LAUNCH RAMP. How far a road's or a track's cut or fill may part from the smooth
 * land, in kernel units: what its bank (`bank` samples, its smoothstep peaking at 1.5 over the width) climbs at
 * `bankGrade` over the hillside. Level across, a bench on a steep hillside stood banks about twice the hillside's grade -
 * 72 degrees, 19 m tall, on a 53-degree hillside at (627, 282) - and a run down across one launched into falls of 20 to
 * 49 m where DFU's ground is safe. Held, a bank is never more than `bankGrade` steeper than its hillside; the bed stays
 * level wherever its cut is under the hold and leans with a hillside too steep for it (2 of 300 straight roads sampled
 * on the real data, the most 0.98 m across the painted tiles; 10 of 1,500 path pixels move at all). A river's or a
 * stream's floor is never held - its water is level.
 * @param {{bank: number}} dial
 * @param {number} span - the pixel's samples less one (128)
 */
const bankHold = (dial, span) => (LANDFORM_DIALS.bankGrade * (TERRAIN_SIZE / span / STREAMING_TERRAIN_SCALE) * dial.bank) / 1.5;

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

/** LANDFORM5: the most a hill stands over (or a dale under) the land, in kernel units - the hills' top height on the
 *  high ground (76.8 units, 96 m). */
export const HILLS_TOP = LANDFORM_DIALS.hills.high * LANDFORM_DIALS.hills.upland;

/** LANDFORM1: the highest the landforms stand anything, in kernel units - DFU's ceiling, the most the lift adds and the
 *  tallest hill (about 3,116 m). Only WOODS.WLD's one glitch byte reaches it (the header, THE CEILING). */
export const LANDFORM_CEILING = MAX_TERRAIN_HEIGHT + reliefLift(LOW_TOP) + HILLS_TOP;

/** LANDFORM5: the octaves' offsets into the noise, so no two octaves (and neither field) share a lattice. */
const HILL_OFFSETS = Object.freeze([[11.3, 47.9], [83.1, 5.7], [29.5, 71.3]]);
const signed = (x, y) => 2 * perlinNoise(x, y) - 1;
/** LANDFORM5: the slow fields' lattice, in samples - the region field (15 km) and the warp (3.3 km) are read at its
 *  nodes, which sit on world positions (every pixel's origin is one), and between them bilinearly: half the noise
 *  reads a sample costs, the same number from every pixel. */
const HILL_NODE = 16;

/** LANDFORM5: the slow fields at one lattice node - the region's height share (0..1) and the warp's two pushes. */
function hillNode(nx, ny, out, o) {
  const H = LANDFORM_DIALS.hills;
  const gx = nx * HILL_NODE, gy = ny * HILL_NODE;
  out[o] = smooth01((perlinNoise(gx / H.region + 31.7, gy / H.region + 57.3) - 0.3) / 0.4);
  out[o + 1] = H.warp * signed(gx / H.warpScale + 5.2, gy / H.warpScale + 1.3);
  out[o + 2] = H.warp * signed(gx / H.warpScale + 9.7, gy / H.warpScale + 3.1);
}

/**
 * LANDFORM5: the slow fields' nodes over a box of world samples, made once (a pixel's shaper makes one for its own
 * samples); a node outside it is made where it is asked. Every node is hillNode's, so a box changes no number.
 * @param {number} x0 - the box's west edge, world samples
 * @param {number} y0 - its south edge
 * @param {number} size - its side, samples
 */
function hillLattice(x0, y0, size) {
  const nx0 = Math.floor(x0 / HILL_NODE), ny0 = Math.floor(y0 / HILL_NODE);
  const side = Math.ceil(size / HILL_NODE) + 2;
  const vals = new Float64Array(side * side * 3);
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) hillNode(nx0 + i, ny0 + j, vals, (j * side + i) * 3);
  return { nx0, ny0, side, vals };
}
const _node = new Float64Array(12);
const HILL_OCTAVES = LANDFORM_DIALS.hills.scales.length;
const HILL_WEIGHT = LANDFORM_DIALS.hills.weights.reduce((t, w) => t + w, 0);

/**
 * LANDFORM5: the hills at a world sample, in kernel units - a pure function of world position (x east, y north, in
 * samples: a pixel's edge is one number from both pixels) and the land's own macro height. Their height is the region
 * field's (`low` to `high`), taller on the high ground, eased in over `coast` over the knee - so a hill or a dale is
 * always smaller than the land's height over the knee, and nothing it touches crosses it. The region and the warp are
 * read off the lattice (HILL_NODE); the three octaves at the sample itself.
 * @param {number} gx
 * @param {number} gy
 * @param {number} macro - the land's macro height (DFU's, no ground noise), kernel units
 * @param {number} low - its small-heightmap term
 * @param {?ReturnType<typeof hillLattice>} [lattice] - nodes made already (a pixel's own); the same numbers without
 * @returns {number}
 */
export function hillsAt(gx, gy, macro, low, lattice = null) {
  const H = LANDFORM_DIALS.hills;
  const e = macro - LANDFORM_KNEE;
  if (!(e > 0)) return 0;
  const fx = gx / HILL_NODE, fy = gy / HILL_NODE, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
  let vals = _node, i00 = 0, i10 = 3, i01 = 6, i11 = 9;
  const li = lattice ? ix - lattice.nx0 : -1, lj = lattice ? iy - lattice.ny0 : -1;
  if (lattice && li >= 0 && lj >= 0 && li + 1 < lattice.side && lj + 1 < lattice.side) {
    vals = lattice.vals;
    i00 = (lj * lattice.side + li) * 3; i10 = i00 + 3; i01 = i00 + lattice.side * 3; i11 = i01 + 3;
  } else {
    hillNode(ix, iy, _node, 0); hillNode(ix + 1, iy, _node, 3); hillNode(ix, iy + 1, _node, 6); hillNode(ix + 1, iy + 1, _node, 9);
  }
  const a = (1 - u) * (1 - v), b = u * (1 - v), c = (1 - u) * v, d = u * v;
  const region = vals[i00] * a + vals[i10] * b + vals[i01] * c + vals[i11] * d;
  const up = smooth01((low - LANDFORM_KNEE) / H.uplandAt);
  const amp = (H.low + (H.high - H.low) * region) * (1 + (H.upland - 1) * up) * smooth01(e / H.coast);
  const wx = gx + (vals[i00 + 1] * a + vals[i10 + 1] * b + vals[i01 + 1] * c + vals[i11 + 1] * d);
  const wy = gy + (vals[i00 + 2] * a + vals[i10 + 2] * b + vals[i01 + 2] * c + vals[i11 + 2] * d);
  let n = 0;
  for (let i = 0; i < HILL_OCTAVES; i++) n += signed(wx / H.scales[i] + HILL_OFFSETS[i][0], wy / H.scales[i] + HILL_OFFSETS[i][1]) * H.weights[i];
  n /= HILL_WEIGHT;
  return amp * (n < -1 ? -1 : n > 1 ? 1 : n);
}

/** LANDFORM5: createLandforms' `hills: false` - no hills. */
const NO_HILLS = () => 0;

/**
 * LANDFORM5: how much of the hills a world sample keeps beside the painted water - a node at every map pixel's centre,
 * 1 where a river or a stream is painted in the pixel, read through a smoothstep-weighted bilinear, so a channel's
 * centre line between two of its pixels keeps none and the hills come back over about a third of a pixel. null with no
 * water cut (every sample keeps them all).
 * @param {Array<?Uint8Array>} nets - the layers' networks, LAYERS' order (the water's null when it is not cut)
 * @param {number} span
 * @returns {?(gx: number, gy: number) => number}
 */
function waterFade(nets, span) {
  const streams = nets[0], rivers = nets[1];
  if (!streams && !rivers) return null;
  const node = (qx, qy) => {
    if (qx < 0 || qy < 0 || qx >= MAP_W || qy >= MAP_H) return 0;
    const i = qy * MAP_W + qx;
    return (rivers && rivers[i]) || (streams && streams[i]) ? 1 : 0;
  };
  return (gx, gy) => {
    const fx = gx / span - 0.5, fy = MAP_H + 0.5 - gy / span;   // pixel centres at whole numbers; the row runs south
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const u = smooth01(fx - ix), v = smooth01(fy - iy);
    const b = (node(ix, iy) * (1 - u) + node(ix + 1, iy) * u) * (1 - v) + (node(ix, iy + 1) * (1 - u) + node(ix + 1, iy + 1) * u) * v;
    return 1 - smooth01(b * 2);
  };
}

/** LANDFORM4: a site rect's bytes stand this far over its tile values (a city's clearance runs under 0). */
const SITE_BIAS = 16;

/**
 * LANDFORM4: the game's own locations as the landforms read them - for every map pixel its footprint rect
 * (terrainTiles.js locationFootprintRect), four bytes a pixel (xMin, xMax, yMin, yMax, each SITE_BIAS over its tile
 * value; zero where no site stands). Made once from the map table, on the main thread, and handed whole to the worker:
 * every kernel of the world reads the same sites, so a seam is one number from both pixels and a room one ground.
 * @param {Iterable<{px: number, py: number, loc: object}>} rows - the game's own rows (never a mod's addition or a spawn)
 * @returns {Uint8Array}
 */
export function landformSites(rows) {
  const out = new Uint8Array(4 * MAP_W * MAP_H);
  const b = (v) => Math.max(1, Math.min(255, v + SITE_BIAS));
  for (const { px, py, loc } of rows) {
    if (!loc?.exterior?.exteriorData || !loc.mapTableData || px < 0 || py < 0 || px >= MAP_W || py >= MAP_H) continue;
    const r = locationFootprintRect(loc);
    const i = 4 * (py * MAP_W + px);
    out[i] = b(r.xMin); out[i + 1] = b(r.xMax); out[i + 2] = b(r.yMin); out[i + 3] = b(r.yMax);
  }
  return out;
}

/** LANDFORM4: the levels asked, per world (its WoodsFile) - a pure function of the bytes, kept while they are read. */
const _siteLevels = new WeakMap();
const SITE_LEVELS_KEPT = 4096;

/**
 * LANDFORM4: the level a site pulls its ground to, in kernel units - the mean of its pixel's land on a coarse grid
 * (every `site.grid` samples, its edges included): DFU's kernel, the lift faded as the shaper fades it, the hills - no
 * path's cut, no water's stilling and no site's pull, so it is one number however the network stands. The sea and the
 * beach count as they stand.
 * @param {object} woods
 * @param {number} sx
 * @param {number} sy
 * @param {number} hDim
 * @param {Function} hill - the shaper's hills (NO_HILLS leaves them out of the level too)
 * @returns {number}
 */
function siteLevel(woods, sx, sy, hDim, hill) {
  let kept = _siteLevels.get(woods);
  if (!kept) _siteLevels.set(woods, kept = new Map());
  const k = ((sy * MAP_W + sx) * 1024 + hDim) * 2 + (hill === NO_HILLS ? 1 : 0);
  let level = kept.get(k);
  if (level !== undefined) return level;
  const span = hDim - 1, step = LANDFORM_DIALS.site.grid;
  const kernel = sampleKernel(woods, sx, sy, hDim, true, null);
  const { base, noise } = kernelTerms(woods, sx, sy, hDim);
  const cliff = cliffFade(woods, sx, sy, hDim);
  const ox = sx * span, oy = (MAP_H - sy) * span;
  let sum = 0, n = 0;
  for (let x = 0; x <= span; x += step) {
    for (let y = 0; y <= span; y += step) {
      const h = kernel(x, y) * MAX_TERRAIN_HEIGHT;
      n++;
      if (!(h > LANDFORM_KNEE)) { sum += h; continue; }
      const low = base(x, y) * BASE_HEIGHT_SCALE;
      const macro = Math.min(Math.max(low + noise(x, y) * NOISE_MAP_SCALE, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT);
      sum += h + (cliff ? reliefLift(low) * cliff(x, y) : reliefLift(low)) + (hill === NO_HILLS ? 0 : hillsAt(ox + x, oy + y, macro, low));
    }
  }
  level = sum / n;
  if (kept.size >= SITE_LEVELS_KEPT) kept.clear();
  kept.set(k, level);
  return level;
}

/**
 * LANDFORM4: the sites about one pixel - every site in the 5x5 of pixels round it (a path's profile is read in the
 * 3x3, and a site reaches no further than the pixels beside its own), in ONE global order, by pixel row then column, so
 * two pixels that share a sample fold the same sites into it in the same order and land on the same float.
 * @returns {Array<{x0: number, x1: number, y0: number, y1: number, reach: number, level: () => number}>}
 */
function sitesAbout(woods, sites, px, py, span, hDim, hill) {
  const out = [];
  if (!sites) return out;
  const { reach, per, most } = LANDFORM_DIALS.site;
  const scale = span / WORLD_MAP_TILE_DIM;
  for (let qy = py - 2; qy <= py + 2; qy++) {
    if (qy < 0 || qy >= MAP_H) continue;
    for (let qx = px - 2; qx <= px + 2; qx++) {
      if (qx < 0 || qx >= MAP_W) continue;
      const i = 4 * (qy * MAP_W + qx);
      if (!sites[i]) continue;
      const ox = qx * span, oy = (MAP_H - qy) * span;
      const x0 = ox + (sites[i] - SITE_BIAS) * scale, x1 = ox + (sites[i + 1] - SITE_BIAS) * scale;
      const y0 = oy + (sites[i + 2] - SITE_BIAS) * scale, y1 = oy + (sites[i + 3] - SITE_BIAS) * scale;
      let level;
      out.push({ x0, x1, y0, y1, reach: Math.min(most, reach + per * Math.max(x1 - x0, y1 - y0) / 2), level: () => (level ??= siteLevel(woods, qx, qy, hDim, hill)) });
    }
  }
  return out;
}

/**
 * LANDFORM4: the sites' pull at a world sample - each site's weight 1 inside its rect, easing to 0 at its reach past it
 * (1 - smoothstep); together they keep `keep` = the product of (1 - weight) of the land, and the rest goes to their
 * levels, each weighted by its weight to the fourth (the nearest all but alone where two reach). Writes `keep` to
 * `out[0]` and answers the pulled height.
 * @param {ReturnType<typeof sitesAbout>} list
 * @param {number} gx
 * @param {number} gy
 * @param {number} land
 * @param {Float64Array} out
 * @returns {number}
 */
function pullTo(list, gx, gy, land, out) {
  let keep = 1, ws = 0, wt = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const dx = gx < s.x0 ? s.x0 - gx : gx > s.x1 ? gx - s.x1 : 0;
    const dy = gy < s.y0 ? s.y0 - gy : gy > s.y1 ? gy - s.y1 : 0;
    if (!(dx < s.reach && dy < s.reach)) continue;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!(d < s.reach)) continue;
    const w = 1 - smooth01(d / s.reach);
    keep *= 1 - w;
    const w4 = w * w * w * w;
    ws += w4;
    wt += w4 * s.level();
  }
  out[0] = keep;
  return keep === 1 || !(ws > 0) ? land : keep * land + (1 - keep) * (wt / ws);
}

/** LANDFORM1: a map-pixel byte's macro height with the lift, in kernel units - the far ring's law (farRing.js
 *  ringHeight), max(byte * 8, ocean) plus the lift its own `low` earns, faded beside the sea by the node's own
 *  cliffFadeAt (AUDIT LANDFORMS II I1). */
export function reliefByteHeight(byte, fade = 1) {
  const low = byte * BASE_HEIGHT_SCALE;
  return Math.max(low, SCALED_OCEAN_ELEVATION) + reliefLift(low) * fade;
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
 * (the mod's SmoothRoads, which smooths DFU's own road and not the level bed). Without them - no network - the relief's
 * lift, through the same kernel (AUDIT LANDFORMS II J9: it was a second formula the game never ran, and the pins that
 * read it as "the real pipeline" read that). Not followed: World of Daggerfall's flatten.
 * @param {object} woods - the sampler's three-method surface.
 * @param {number} px
 * @param {number} py
 * @param {number} sx - the point's x in the pixel's sample space (0..128, east)
 * @param {number} sy - its y (0..128, north)
 * @param {?{xMin: number, xMax: number, yMin: number, yMax: number}} [locationRect] - the pixel's location rect
 *   (setLocationTiles' answer), or null in the wild.
 * @param {number} [hDim]
 * @param {?object} [landforms] - createLandforms over the network the pixel is cut along, or null: the relief alone
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
  const lf = landforms ?? createLandforms({ woods, hDim });   // AUDIT LANDFORMS II J9: no network - the relief alone, the kernel's own way
  let f;
  if (!locationRect) {
    const shaped = sampleKernel(woods, px, py, hDim, true, lf), plain = sampleKernel(woods, px, py, hDim, true, null);
    const memo = new Map();   // a sample as generateSamples keeps it, float32 - the ground the pixel is built of
    f = (x, y) => {
      const k = x * hDim + y;
      let v = memo.get(k);
      if (v === undefined) memo.set(k, v = (Math.fround(shaped(x, y)) - Math.fround(plain(x, y))) * MAX_TERRAIN_HEIGHT);
      return v;
    };
  } else {
    const field = new Float32Array(hDim * hDim);
    let sum = 0;
    const classic = new Float32Array(hDim * hDim), shaped = generateSamples(woods, px, py, hDim, lf, classic);
    for (let i = 0; i < field.length; i++) sum += (field[i] = (shaped[i] - classic[i]) * MAX_TERRAIN_HEIGHT);
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
 * @param {?Uint8Array} [o.sites] - LANDFORM4: landformSites' table, the game's own locations; null pulls no ground (a
 *   world whose map table is not read - a test, a tool).
 * @param {boolean} [o.hills] - LANDFORM5: false leaves the hills out - the land the paths' own pins read their cuts on
 *   (test/auditlandforms.test.js); no kernel of the game passes it.
 * @param {number} [o.hDim]
 * @returns {{ pixel: (px: number, py: number) => (x: number, y: number, h: number, low: number, g: number) => number, rivers: boolean }}
 */
export function createLandforms({ woods, roads = null, sites = null, hills = true, hDim = HEIGHTMAP_DIMENSION } = {}) {
  const span = hDim - 1;
  const half = span / 2;
  const cutRivers = !!roads?.water;
  const nets = LAYERS.map((l) => (l.water && !cutRivers ? null : roads?.[l.key] ?? null));
  const still = hills ? waterFade(nets, span) : null;   // LANDFORM5: the hills stilled along the painted water
  const hill = !hills ? NO_HILLS : still ? (gx, gy, macro, low, lattice) => hillsAt(gx, gy, macro, low, lattice) * still(gx, gy) : hillsAt;
  return { pixel: (px, py) => pixelShaper(woods, nets, hill, sites, px, py, span, half, hDim), rivers: cutRivers };
}

/** One pixel's shaper: its paths' segments gathered from the 3x3 pixels round it, the sites about it, and the closure
 *  the kernel calls. */
function pixelShaper(woods, nets, hill, sites, px, py, span, half, hDim) {
  // the pixel's own sample origin in world samples: x east from the map's west edge, y NORTH from its south edge (the
  // ground noise's own frame, terrainSampler.js `noisey`), so pixel (px, py)'s (128, y) is (px + 1, py)'s (0, y) and
  // its (x, 128) is (px, py - 1)'s (x, 0) - one number each, from either pixel
  const ox = px * span;
  const oy = (MAP_H - py) * span;
  const cliff = cliffFade(woods, px, py, hDim);   // AUDIT LANDFORMS II I1: the lift's fade beside the sea, null inland
  // LANDFORM4: the sites a path's profile may meet (the 5x5), and the ones that reach this pixel's own box
  const around = sitesAbout(woods, sites, px, py, span, hDim, hill);
  const near = around.filter((s) => s.x1 + s.reach > ox && s.x0 - s.reach < ox + span && s.y1 + s.reach > oy && s.y0 - s.reach < oy + span);
  const kept = new Float64Array(1);
  const lattice = hill === NO_HILLS ? null : hillLattice(ox, oy, span);   // LANDFORM5: the slow fields' nodes over this pixel
  /** LANDFORMS 1, 4, 5: the land at a world sample - DFU's height, the lift, the hills (stilled by the water) - pulled to
   *  the sites about it; `kept[0]` the share of the land's own left (so of its ground noise). */
  const landAt = (gx, gy, h, macro, low, fade, list) => {
    const l = h + reliefLift(low) * fade + hill(gx, gy, macro, low, lattice);
    if (!list.length) { kept[0] = 1; return l; }
    return pullTo(list, gx, gy, l, kept);
  };
  const terms = new Map();
  const termsOf = (qx, qy) => {
    const k = qy * MAP_W + qx;
    let t = terms.get(k);
    if (!t) terms.set(k, t = { ...kernelTerms(woods, qx, qy, hDim), cliff: cliffFade(woods, qx, qy, hDim) });   // AUDIT LANDFORMS II I1
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
    if (segs.length) layers.push({ dial, reach, segs, water: LAYERS[li].water, ford: !!LAYERS[li].ford, hold: LAYERS[li].water ? Infinity : bankHold(dial, span) });
  }
  // The macro height a path is graded to, along one arm: at each whole sample of the arm (the arm runs from the centre
  // (64, 64) of its own pixel by a whole sample a step - a diagonal's steps are its own samples' diagonal), the
  // kernel's two bicubic terms of the pixel the arm belongs to, the lift, no ground noise; between them, linear.
  const profileOf = (s) => {
    if (s.prof) return s.prof;
    const { base, noise, cliff } = termsOf(s.qx, s.qy);
    const prof = new Float64Array(half + 1);
    const sox = s.qx * span, soy = (MAP_H - s.qy) * span;
    for (let k = 0; k <= half; k++) {
      const lx = half + s.dx * k, ly = half + s.dy * k;
      const b = base(lx, ly);
      const low = b * BASE_HEIGHT_SCALE;
      const macro = Math.min(Math.max(low + noise(lx, ly) * NOISE_MAP_SCALE, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT);   // DFU's macro as DFU stands it
      // the lift faded beside the sea (AUDIT LANDFORMS II I1); LANDFORMS 4/5: the hills and the sites' pull, so a road
      // rides the land's hills and comes into a town on its level
      prof[k] = macro > LANDFORM_KNEE ? landAt(sox + lx, soy + ly, macro, macro, low, cliff ? cliff(lx, ly) : 1, around) : macro;
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
    const gx = ox + x, gy = oy + y;
    // the lift faded beside the sea (AUDIT LANDFORMS II I1), the hills, the sites' pull (LANDFORMS 4/5). A hill never
    // takes the land under the knee (hillsAt); a site's level can lie under it (a pixel mostly sea), so the pulled land is
    // held over it as a cut is - never under the smaller of the unpulled land and LANDFORM_FLOOR
    const raw = h + (cliff ? reliefLift(low) * cliff(x, y) : reliefLift(low));
    const least = raw < LANDFORM_FLOOR ? raw : LANDFORM_FLOOR;
    let land = landAt(gx, gy, h, h - g, low, cliff ? cliff(x, y) : 1, near);
    if (land < least) land = least;
    const keep = kept[0];
    if (!layers.length) return land;
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
      const smoothLand = land - g * keep;   // LANDFORM4: a site's pull levels the ground noise by as much as the land
      const top = dial.drop > 0 && !(smoothLand > floor + dial.drop) ? floor + dial.drop : smoothLand;
      const edge = dial.flat + dial.bank;
      targets[li] = dmin <= edge
        ? floor + (top - floor) * smoothstep(dial.flat, edge, dmin)
        : top + (land - top) * smoothstep(edge, reach, dmin);
      // AUDIT LANDFORMS II I2: a road's or a track's floor and bank held to the smooth land (bankHold) - past its bank the
      // verge hands the ground noise back, which no hold may take
      if (dmin <= edge) {
        const hold = layers[li].hold;
        if (targets[li] > smoothLand + hold) targets[li] = smoothLand + hold;
        else if (targets[li] < smoothLand - hold) targets[li] = smoothLand - hold;
      }
      weights[li] = 1 - smoothstep(edge, reach, dmin);
    }
    if (!touched) return land;
    const fade = smoothstep(LANDFORM_KNEE, LANDFORM_KNEE + LANDFORM_DIALS.coast, land);
    // AUDIT LANDFORMS E2: how far into a channel the sample lies - 1 on a river's or a stream's floor, 0 at its bank's top.
    // There a road stands on its own bed alone (a causeway's top); its bank and verge give way to the channel by as much,
    // and a track's bed with them (a ford, AUDIT LANDFORMS II J1). They refilled it: on the real WOODS.WLD the painted
    // water climbed up to 19 m out of its floor beside 629 crossings and riverside roads.
    let chan = 0;
    for (let li = 0; li < layers.length; li++) {
      if (!layers[li].water || !(weights[li] > 0)) continue;
      const d = layers[li].dial, c = 1 - smoothstep(d.flat, d.flat + d.bank, dmins[li]);
      if (c > chan) chan = c;
    }
    let out = land;
    for (let li = 0; li < layers.length; li++) {
      let a = weights[li] * fade;
      if (chan > 0 && !layers[li].water && (layers[li].ford || dmins[li] > layers[li].dial.flat)) a *= 1 - chan;
      if (a > 0) out += (targets[li] - out) * a;
    }
    return out > least ? out : least;
  };
}
