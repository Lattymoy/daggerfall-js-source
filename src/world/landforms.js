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
// it never reaches the knee, and carved into valleys along the painted
// rivers and streams (AUDIT LANDFORMS III C1: the water lies under every
// hill across its valley) rather than climbing a hill or riding one. A road and a track are graded to the land WITH its hills, so they
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
import { CLIMATES } from '../formats/mapsTables.js';


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
  // LANDFORM5: the hills, every land's. `uplandAt` the height of `low` over the knee from which a land's hills stand
  // their whole `upland` (below); `coast` how many times its tallest hill (`high` x `upland`) the land must stand over the
  // knee before its hills stand whole - they ease in from nothing across it, so a hill or a dale is never taller than the
  // land's own height over the knee (at most 0.9 of it); `region` the region field's wavelength, `warp` how far the
  // shapes' domain is pushed about (over `warpScale`), and the rolling octaves' wavelengths and weights (samples).
  hills: Object.freeze({ uplandAt: 700, coast: 1.25, region: 2400, warp: 80, warpScale: 520, scales: Object.freeze([300, 125, 50]), weights: Object.freeze([1, 0.36, 0.1]) }),
  // LANDFORM8 (WOD-PEAKS, 2026-10-09, the owner: "can you place more rounded not SUPER HUGE mountains?"): a mountain
  // land's `peaks` - rounded mountains standing on its hills where World of Daggerfall's faceted spires stood
  // (modSettings.js world-of-daggerfall `Mountains`, now off): one to a `cell` (samples) of the cells `fill` holds,
  // each a bell (a cosine from its summit to its foot - round on top, easing out at the foot, never a crease) of its
  // own girth (0.24 to 0.42 of a cell across its radius - 550 m to a kilometre in the mountains) and lean, as tall as
  // `high` (kernel units) at most on the high ground - 200 m in the mountains, 140 m in the mountain woods - and lower
  // on the low ground by the land's own `upland`; where two meet the taller stands. Centred as the hills are (PEAK_MEAN),
  // so the land's average height stays DFU's, lifted; at most some 30 degrees on a bell's flank.
  // LANDFORM6: THE LAND WEARS ITS CLIMATE - each climate's hills: `low`/`high` their height (kernel units, either side of
  // the land) where the region field lies flat and where it rolls hardest, `upland` how much taller on the high ground,
  // and their `shape` (shapeRaw); a desert's `rockFrom` the slow rock field's level past which its sand gives way to mesas
  // (higher, more sand), the knolls' `cell` (how far apart, samples), `fill` (the share of cells that hold one), `edge`
  // (how much of a knoll's radius its side takes - the smaller, the steeper) and `roll` (how much rolling land they stand
  // on).
  lands: Object.freeze({
    woodlands: Object.freeze({ low: 4, high: 48, upland: 1.6, shape: 'rolling' }),
    mountainWoods: Object.freeze({ low: 8, high: 56, upland: 1.6, shape: 'foothills', peaks: Object.freeze({ cell: 380, fill: 0.34, high: 112 }) }),
    mountain: Object.freeze({ low: 16, high: 80, upland: 1.6, shape: 'ridged', peaks: Object.freeze({ cell: 360, fill: 0.5, high: 160 }) }),
    desert: Object.freeze({ low: 6, high: 26, upland: 1.3, shape: 'desert', rockFrom: 0.3 }),
    desert2: Object.freeze({ low: 6, high: 30, upland: 1.3, shape: 'desert', rockFrom: -0.1 }),
    rainforest: Object.freeze({ low: 8, high: 50, upland: 1.4, shape: 'knolls', cell: 120, fill: 0.62, edge: 0.88, roll: 0.15 }),
    subtropical: Object.freeze({ low: 6, high: 44, upland: 1.4, shape: 'knolls', cell: 210, fill: 0.6, edge: 1, roll: 0.7 }),
    swamp: Object.freeze({ low: 2, high: 6, upland: 1, shape: 'hummocks' }),
    haunted: Object.freeze({ low: 6, high: 40, upland: 1.5, shape: 'broken' }),
    ocean: Object.freeze({ low: 2, high: 24, upland: 1.6, shape: 'rolling' }),
  }),
  // AUDIT LANDFORMS III C1: A RIVER CUTS ITS VALLEY - how far from a painted river's or stream's centre line (samples) the
  // hills ease down to the deepest dale their land can stand: the water lies under every hill across its valley
  valley: Object.freeze({ river: 120, stream: 96 }),
  // LANDFORM7: A ROAD EASES THE HILLS - within `road` samples of a road's centre line (`track` of a track's) the hills
  // ease down to `keep` of themselves at the line (1 - smoothstep of the distance), so a road finds the smooth ground
  // through the country rather than climbing every hill
  ease: Object.freeze({ road: 40, track: 28, keep: 0.35 }),
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

/** LANDFORM6: the lands in one order (their index is a climate's land everywhere below) and the climate each one is -
 *  CLIMATE.PAK's values, mapsTables.js CLIMATES; any other value stands as woodlands. */
const LAND_NAMES = Object.freeze(['woodlands', 'mountainWoods', 'mountain', 'desert', 'desert2', 'rainforest', 'subtropical', 'swamp', 'haunted', 'ocean']);
const LANDS = Object.freeze(LAND_NAMES.map((k) => LANDFORM_DIALS.lands[k]));
const LAND_OF_CLIMATE = (() => {
  const lut = new Uint8Array(256);   // 0: woodlands
  const of = { [CLIMATES.Ocean]: 'ocean', [CLIMATES.Desert]: 'desert', [CLIMATES.Desert2]: 'desert2', [CLIMATES.Mountain]: 'mountain', [CLIMATES.Rainforest]: 'rainforest', [CLIMATES.Swamp]: 'swamp', [CLIMATES.Subtropical]: 'subtropical', [CLIMATES.MountainWoods]: 'mountainWoods', [CLIMATES.Woodlands]: 'woodlands', [CLIMATES.HauntedWoodlands]: 'haunted' };
  for (const [c, k] of Object.entries(of)) lut[Number(c)] = LAND_NAMES.indexOf(k);
  return lut;
})();
/** LANDFORM6: a land's tallest hill, kernel units - `high` x `upland`. */
const landTop = (land) => land.high * land.upland + (land.peaks ? land.peaks.high : 0);   // LANDFORM8: and its tallest peak
/** LANDFORM6: the tallest hill a climate stands (`climate` a CLIMATE.PAK value; the woodlands' for any other), kernel
 *  units - what its hills' ease over the knee is measured by. */
export function hillsTopOf(climate) {
  return landTop(LANDS[LAND_OF_CLIMATE[climate & 255]]);
}

/** LANDFORM5/6: the most a hill stands over (or a dale under) the land anywhere, in kernel units - the mountains' top
 *  (128 units, 160 m). */
export const HILLS_TOP = Math.max(...LANDS.map(landTop));

/** LANDFORM1: the highest the landforms stand anything, in kernel units - DFU's ceiling, the most the lift adds and the
 *  tallest hill (about 3,180 m). Only WOODS.WLD's one glitch byte reaches it (the header, THE CEILING). */
export const LANDFORM_CEILING = MAX_TERRAIN_HEIGHT + reliefLift(LOW_TOP) + HILLS_TOP;

/** LANDFORM5: the octaves' offsets into the noise, so no two octaves (and neither field) share a lattice. */
const HILL_OFFSETS = Object.freeze([[11.3, 47.9], [83.1, 5.7], [29.5, 71.3]]);
const signed = (x, y) => 2 * perlinNoise(x, y) - 1;
/** LANDFORM5: the slow fields' lattice, in samples - the region field (15 km), the warp (3.3 km) and a desert's rock
 *  field (17 km) are read at its nodes, which sit on world positions (every pixel's origin is one), and between them
 *  bilinearly: the same number from every pixel, for a fraction of the reads. */
const HILL_NODE = 16;
const NODE_VALUES = 4;
/** LANDFORM6: the rock field's wavelength, samples - where a desert's sand seas give way to mesas. */
const ROCK_SCALE = 2600;

/** LANDFORM5/6: the slow fields at one lattice node - the region's height share (0..1), the warp's two pushes and the
 *  rock field (-1..1). */
function hillNode(nx, ny, out, o) {
  const H = LANDFORM_DIALS.hills;
  const gx = nx * HILL_NODE, gy = ny * HILL_NODE;
  out[o] = smooth01((perlinNoise(gx / H.region + 31.7, gy / H.region + 57.3) - 0.3) / 0.4);
  out[o + 1] = H.warp * signed(gx / H.warpScale + 5.2, gy / H.warpScale + 1.3);
  out[o + 2] = H.warp * signed(gx / H.warpScale + 9.7, gy / H.warpScale + 3.1);
  out[o + 3] = signed(gx / ROCK_SCALE + 61.3, gy / ROCK_SCALE + 23.9);
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
  const vals = new Float64Array(side * side * NODE_VALUES);
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) hillNode(nx0 + i, ny0 + j, vals, (j * side + i) * NODE_VALUES);
  return { nx0, ny0, side, vals };
}
const _node = new Float64Array(4 * NODE_VALUES);
const HILL_OCTAVES = LANDFORM_DIALS.hills.scales.length;
const HILL_WEIGHT = LANDFORM_DIALS.hills.weights.reduce((t, w) => t + w, 0);

/**
 * AUDIT LANDFORMS III A8: cos and sin of pi * t (|t| <= 1) and e^-t (t >= 0) by their series, every step an add, a
 * multiply or a divide - each correctly rounded, so the ground is one float in every engine. Math.cos, Math.sin and
 * Math.exp are each engine's own approximation (the spec asks no more), and the landforms were the only ground of the
 * world that called one: a save stood in one browser and loaded in another read its hills a few ulps apart. Each within
 * 4.5e-16 of V8's own, absolute - the land they shape moves by less than a float32 sample's last bit.
 */
export function cosPi(t) {
  let a = t < 0 ? -t : t, sign = 1;
  if (a > 0.5) { a = 1 - a; sign = -1; }   // cos(pi - y) = -cos(y); exact (Sterbenz)
  const x = Math.PI * a, x2 = x * x;
  let p = 1;
  for (let k = 20; k >= 2; k -= 2) p = 1 - (x2 * p) / (k * (k - 1));
  return sign * p;
}

/** AUDIT LANDFORMS III A8: sin(pi * t), |t| <= 1 (cosPi's). */
export function sinPi(t) {
  let a = t < 0 ? -t : t;
  if (a > 0.5) a = 1 - a;   // sin(pi - y) = sin(y)
  const x = Math.PI * a, x2 = x * x;
  let p = 1;
  for (let k = 21; k >= 3; k -= 2) p = 1 - (x2 * p) / (k * (k - 1));
  return t < 0 ? -x * p : x * p;
}

/** AUDIT LANDFORMS III A8: e^-t, t >= 0 (cosPi's) - t less its whole multiple of ln 2, its series, halved back. Past 40
 *  it is under half an ulp of anything it is taken from. */
export function expNeg(t) {
  if (!(t < 40)) return 0;
  const n = Math.floor(t / Math.LN2), r = t - n * Math.LN2;
  let p = 1;
  for (let k = 18; k >= 1; k--) p = 1 - (r * p) / k;
  for (let i = 0; i < n; i++) p *= 0.5;
  return p;
}

/** LANDFORM6: the dunes' wind - their crests run across it, the long gentle face to windward and the slip face to lee -
 *  from a little south of west (the Alik'r's own, as the port stands it); and their spacing, samples (330 m). */
const DUNE_WIND = 0.35, DUNE_COS = cosPi(DUNE_WIND / Math.PI), DUNE_SIN = sinPi(DUNE_WIND / Math.PI);
const DUNE_SPACING = 64, DUNE_WINDWARD = 0.72;

/** LANDFORM5: the rolling octaves, -1..1 at the most; `sc` stretches their wavelengths. */
function rolling(wx, wy, sc) {
  const H = LANDFORM_DIALS.hills;
  let n = 0;
  for (let i = 0; i < HILL_OCTAVES; i++) n += signed(wx / (H.scales[i] * sc) + HILL_OFFSETS[i][0], wy / (H.scales[i] * sc) + HILL_OFFSETS[i][1]) * H.weights[i];
  return n / HILL_WEIGHT;
}

/** LANDFORM6: |x| with its crease rounded over `k` - a ridge's crest stays sharp only where it is meant to. */
const softAbs = (x, k) => Math.sqrt(x * x + k * k) - k;

/** LANDFORM6: the ranges' two trends - a mountain land's ridges run along one or the other, as the slow rock field says
 *  (so a range keeps its line for kilometres and turns between massifs), stretched `RANGE_STRETCH` times along it. */
const RANGE_A = 0.6, RANGE_B = -0.55, RANGE_STRETCH = 2.2;
const RANGE_AC = cosPi(RANGE_A / Math.PI), RANGE_AS = sinPi(RANGE_A / Math.PI), RANGE_BC = cosPi(RANGE_B / Math.PI), RANGE_BS = sinPi(RANGE_B / Math.PI);

/** LANDFORM6: one trend's ridgelines - a ridged multifractal along (`cs`, `sn`): each octave folded about zero (the
 *  noise's zero lines stand as crests) and squared (its far reaches fall away as valleys), the finer octaves riding the
 *  high ground of the coarser so the ridges carry spurs and the valleys stay smooth. Only the first crest is sharp. */
function ridgeline(wx, wy, cs, sn) {
  const u = (wx * cs + wy * sn) / RANGE_STRETCH, v = wy * cs - wx * sn;
  const a = 1 - softAbs(signed(u / 300 + 17.1, v / 300 + 3.9), 0.02);
  const b = 1 - softAbs(signed(u / 120 + 41.7, v / 120 + 66.2), 0.06);
  const c = 1 - softAbs(signed(wx / 55 + 7.3, wy / 55 + 91.4), 0.1);
  const r1 = a * a, r2 = b * b;
  return r1 + 0.45 * r1 * r2 + 0.16 * r1 * r2 * c * c;
}

/** LANDFORM6: the ridgelines' own centre and gain (the mountains', and the foothills' half of them). */
const RIDGED_NORM = Object.freeze([0.958, 1.4]);

/** LANDFORM6: ridgelines on the trend the rock field gives the point, blended across the turn between two. */
function ridged(wx, wy, rock) {
  const m = smooth01(0.5 + rock / 0.25);
  return (m < 1 ? (1 - m) * ridgeline(wx, wy, RANGE_AC, RANGE_AS) : 0) + (m > 0 ? m * ridgeline(wx, wy, RANGE_BC, RANGE_BS) : 0);
}

/** LANDFORM6: a sand sea's dunes - crests across the wind, each a long windward rise and a short steep slip face (a
 *  cosine either side of the crest, so neither the crest nor the trough is a crease), the phase pushed about so the
 *  crests wander, fork and break, and a field that thins them to bare pans between dune trains. 0..1. */
function dunes(wx, wy) {
  const u = wx * DUNE_COS + wy * DUNE_SIN, v = wy * DUNE_COS - wx * DUNE_SIN, L = DUNE_SPACING;
  const phase = u / L + 0.8 * signed(v / (L * 3.1) + 13.7, u / (L * 6.3) + 2.9) + 0.35 * signed(wx / (L * 1.7) + 37.1, wy / (L * 1.7) + 8.3);
  const f = phase - Math.floor(phase);
  const p = f < DUNE_WINDWARD ? 0.5 - 0.5 * cosPi(f / DUNE_WINDWARD) : 0.5 + 0.5 * cosPi((f - DUNE_WINDWARD) / (1 - DUNE_WINDWARD));
  return p * smooth01(0.55 + 1.3 * signed(v / (L * 5) + 71.9, u / (L * 5) + 44.1));
}

/** LANDFORM6: mesas and buttes - two flat-topped tiers with steep sides, cut where the noise crosses its levels. 0..1. */
function mesas(wx, wy) {
  const n = 0.8 * signed(wx / 220 + 27.3, wy / 220 + 81.1) + 0.2 * signed(wx / 80 + 5.9, wy / 80 + 33.3);
  return 0.6 * smooth01((n - 0.08) / 0.17) + 0.4 * smooth01((n - 0.32) / 0.14);
}

/** LANDFORM6: a cell's own numbers, 0..1 - an integer hash of the cell and the draw (world-placed: one number from
 *  every pixel). */
function cellHash(ix, iy, k) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(k, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** LANDFORM6: knolls - hills set one to a cell of `cell` samples (some cells bare - `fill` of them hold one), each at
 *  its own place, girth, height and lean (an ellipse up to 1.6 to 1, turned its own way), its side `edge` of its radius
 *  wide (a rainforest's: steep karst towers; a subtropical's: soft broad domes), a dome on its top; where two meet the
 *  taller stands. 0..1. */
function knollField(wx, wy, cell, fill, edge) {
  const fx = wx / cell, fy = wy / cell, cx = Math.floor(fx), cy = Math.floor(fy);
  // a knoll reaches no further than 0.29 of a cell past its own (its centre 0.15..0.85 in, its radius at most 0.44), so a
  // neighbouring cell is asked only from the near side of this one
  const i0 = fx - cx < 0.3 ? -1 : 0, i1 = fx - cx > 0.7 ? 1 : 0, j0 = fy - cy < 0.3 ? -1 : 0, j1 = fy - cy > 0.7 ? 1 : 0;
  let best = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const ix = cx + i, iy = cy + j;
      if (cellHash(ix, iy, 1) >= fill) continue;
      const kx = (ix + 0.15 + 0.7 * cellHash(ix, iy, 2)) * cell, ky = (iy + 0.15 + 0.7 * cellHash(ix, iy, 3)) * cell;
      const r = cell * (0.2 + 0.24 * cellHash(ix, iy, 4));
      if (!((wx - kx) * (wx - kx) + (wy - ky) * (wy - ky) < r * r)) continue;   // outside its circle, outside its ellipse
      const turn = 2 * cellHash(ix, iy, 6), ang = turn > 1 ? turn - 2 : turn, lean = 1 + 0.6 * cellHash(ix, iy, 7);   // its turn, in half turns
      const ca = cosPi(ang), sa = sinPi(ang), dx = wx - kx, dy = wy - ky;
      const ru = dx * ca + dy * sa, rv = (dy * ca - dx * sa) * lean;
      const d = Math.sqrt(ru * ru + rv * rv);
      if (!(d < r)) continue;
      const q = d / r, tall = 0.35 + 0.4 * cellHash(ix, iy, 5) + 0.25 * (r / cell - 0.2) / 0.24;   // the broad stand taller
      const v = tall * smooth01((1 - q) / edge) * (0.8 + 0.2 * (1 - q * q));
      if (v > best) best = v;
    }
  }
  return best;
}

/** LANDFORM6: knolls over a roll of their own (`roll`), and a little more roll on the flats between; the slow rock field
 *  gathers them - tall in clusters, dwindling to low mounds across the open country between (a height, never whether a
 *  knoll stands, so none is ever cut through). */
function knolls(wx, wy, rock, land) {
  const gather = 0.25 + 0.75 * smooth01(0.5 + rock / 0.5);
  return gather * knollField(wx, wy, land.cell, land.fill, land.edge) + land.roll * rolling(wx, wy, land.cell / 110) + 0.05 * signed(wx / 90 + 63.7, wy / 90 + 29.1);
}

/** LANDFORM8: the mean of peakField over the land per unit of `fill` - its own law, integrated: a held cell's peak is
 *  0.725 tall on average, its bell averages 0.2974 of that over its ellipse (1/2 - 2/pi^2), and the ellipse covers
 *  pi r^2 / lean of the cell - E[r^2] = 0.1116 cell^2, E[1/lean] = ln(1.4)/0.4 = 0.84118. Overlaps (the taller kept) are rare. */
export const PEAK_MEAN = 0.725 * (0.5 - 2 / (Math.PI * Math.PI)) * Math.PI * (0.0576 + 0.0864 * 0.5 + 0.0324 / 3) * 0.8411805915530323;   // ln(1.4)/0.4, written out: the ground asks no engine's own logarithm (AUDIT LANDFORMS III A8)

/** LANDFORM8: a mountain land's rounded peaks at a warped point - 0..1 of its `peaks.high`: one bell to a cell of the
 *  cells `fill` holds, at its own place, girth, height and lean (an ellipse up to 1.4 to 1, turned its own way); the
 *  taller where two meet. World-placed (cellHash): one number from every pixel and every client. */
export function peakField(wx, wy, cell, fill) {
  const fx = wx / cell, fy = wy / cell, cx = Math.floor(fx), cy = Math.floor(fy);
  // a peak's centre lies 0.15..0.85 into its cell and its radius is at most 0.42 - it reaches at most 0.27 past its cell
  const i0 = fx - cx < 0.3 ? -1 : 0, i1 = fx - cx > 0.7 ? 1 : 0, j0 = fy - cy < 0.3 ? -1 : 0, j1 = fy - cy > 0.7 ? 1 : 0;
  let best = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const ix = cx + i, iy = cy + j;
      if (cellHash(ix, iy, 11) >= fill) continue;
      const kx = (ix + 0.15 + 0.7 * cellHash(ix, iy, 12)) * cell, ky = (iy + 0.15 + 0.7 * cellHash(ix, iy, 13)) * cell;
      const r = cell * (0.24 + 0.18 * cellHash(ix, iy, 14));
      const dx = wx - kx, dy = wy - ky;
      if (!(dx * dx + dy * dy < r * r)) continue;
      const turn = 2 * cellHash(ix, iy, 15), ang = turn > 1 ? turn - 2 : turn, lean = 1 + 0.4 * cellHash(ix, iy, 16);
      const ca = cosPi(ang), sa = sinPi(ang);
      const ru = dx * ca + dy * sa, rv = (dy * ca - dx * sa) * lean;
      const q = Math.sqrt(ru * ru + rv * rv) / r;
      if (!(q < 1)) continue;
      const v = (0.45 + 0.55 * cellHash(ix, iy, 17)) * (0.5 + 0.5 * cosPi(q));
      if (v > best) best = v;
    }
  }
  return best;
}

/** LANDFORM6: a swamp's ground - near flat: broad shallow hollows and low hummocks, nothing a walker would call a hill. */
function hummocks(wx, wy) {
  return 0.55 * signed(wx / 380 + 12.1, wy / 380 + 70.3) + 0.3 * signed(wx / 95 + 93.9, wy / 95 + 41.5) + 0.15 * signed(wx / 34 + 2.7, wy / 34 + 61.9);
}

/** LANDFORM6: a haunted wood's broken ground - a rolling land gashed by ravines (narrow V cuts along a twisted noise's
 *  zero lines) and studded with crags, read through twice the warp (`gx`, `gy` the unwarped point), so it writhes. */
function broken(wx, wy, gx, gy) {
  const bx = 2 * wx - gx, by = 2 * wy - gy;
  const cut = 1 - softAbs(0.75 * signed(bx / 240 + 45.1, by / 240 + 9.7) + 0.25 * signed(bx / 90 + 77.7, by / 90 + 58.3), 0.015) / 0.35;
  const ravine = cut > 0 ? cut * cut * cut : 0;
  const crag = signed(bx / 60 + 31.3, by / 60 + 12.9);
  return rolling(wx, wy, 0.8) - 0.75 * ravine + 0.3 * (crag > 0.2 ? (crag - 0.2) * (crag - 0.2) * 3 : 0);
}

/**
 * LANDFORM6: a land's shape at a warped point, before it is centred - `wx`, `wy` the warped point, `gx`, `gy` the point
 * itself, `rock` the slow rock field (-1..1) there. Each land's centre and spread are LAND_NORMS'.
 * @returns {number}
 */
export function shapeRaw(shape, wx, wy, gx, gy, rock, land) {
  switch (shape) {
    case 'ridged': return ridged(wx, wy, rock);
    case 'foothills': return 0.55 * rolling(wx, wy, 1) + 0.45 * ((ridged(wx, wy, rock) - RIDGED_NORM[0]) * RIDGED_NORM[1]);
    case 'desert': {
      const r = smooth01(0.5 + (rock - land.rockFrom) / 0.35);
      const swell = 0.5 * signed(wx / 720 + 3.3, wy / 720 + 96.1) + 0.2 * signed(wx / 300 + 51.9, wy / 300 + 17.7);
      return (r < 1 ? (1 - r) * (0.65 * dunes(wx, wy) + 0.35 * swell) : 0) + (r > 0 ? r * (1.1 * mesas(wx, wy) + 0.15 * swell) : 0);
    }
    case 'knolls': return knolls(wx, wy, rock, land);
    case 'hummocks': return hummocks(wx, wy);
    case 'broken': return broken(wx, wy, gx, gy);
    default: return rolling(wx, wy, 1);
  }
}

/** LANDFORM6: each land's centre and gain (`(raw - centre) * gain`, then held to -1..1), measured over its own shape's
 *  field with its own dials, so its mean sits on the land and nine in ten of its points inside the range - the land's
 *  average height is DFU's, lifted, whatever shape it wears. By land, not by shape: two lands that share a shape (the
 *  deserts, the knolls) wear it with their own dials and so their own spread. The woodlands' and the coasts' rolling
 *  octaves are LANDFORM5's own, uncentred. AUDIT LANDFORMS III A2/A4: measured again over 200,000 points each - the
 *  foothills' centre was the one their ridgelines had before RIDGED_NORM was set (0.165 against their own -0.006), which
 *  stood every mountain wood 13-18 m low, mostly dales; the haunted woods' was -0.31 against -0.256. */
const LAND_NORMS = Object.freeze({
  woodlands: Object.freeze([0, 1]), mountainWoods: Object.freeze([0, 1.9]), mountain: RIDGED_NORM,
  desert: Object.freeze([0.173, 1.55]), desert2: Object.freeze([0.17, 1.22]), rainforest: Object.freeze([0.025, 1.25]),
  subtropical: Object.freeze([0.02, 1.5]), swamp: Object.freeze([-0.005, 2.6]), haunted: Object.freeze([-0.256, 1.25]),
  ocean: Object.freeze([0, 1]),
});
/** LANDFORM6: each land's centre and gain and its tallest hill, by its index, read once. */
const LAND_NORM = Object.freeze(LAND_NAMES.map((k) => LAND_NORMS[k]));
const LAND_TOP = Object.freeze(LANDS.map(landTop));

/** LANDFORM6: a shape's height held inside -1..1 without a crease - itself up to 0.6, then easing toward 1 (its slope
 *  whole at 0.6, so a valley floor or a summit the shape reaches past its spread rounds off instead of being cut flat). */
const SAT_KNEE = 0.6;
function saturate(v) {
  const a = v < 0 ? -v : v;
  if (a <= SAT_KNEE) return v;
  const o = SAT_KNEE + (1 - SAT_KNEE) * (1 - expNeg((a - SAT_KNEE) / (1 - SAT_KNEE)));
  return v < 0 ? -o : o;
}

/** LANDFORM6: land `j`'s centred shape, inside -1..1. */
function landShape(j, wx, wy, gx, gy, rock) {
  const land = LANDS[j], norm = LAND_NORM[j];
  return saturate((shapeRaw(land.shape, wx, wy, gx, gy, rock, land) - norm[0]) * norm[1]);
}

/** LANDFORM6: the share of each land at a world sample - a node at every map pixel's centre wearing its pixel's
 *  climate, read through a smoothstep-weighted bilinear (as the water's stilling is), so a climate's land holds whole
 *  over its own pixels and gives way to its neighbour's across about a pixel. Writes the shares into `_share` (by land)
 *  and answers the lands present as a bit mask. With no climates every sample is woodlands. */
const _share = new Float64Array(LANDS.length);
function landShares(gx, gy, climates, span) {
  if (!climates) { _share[0] = 1; return 1; }
  // pixel centres at whole numbers; the row runs south. AUDIT LANDFORMS III A7: the pixel's span is the shaper's own -
  // a world of another hDim read its climates off 128-sample pixels
  const fx = gx / span - 0.5, fy = MAP_H + 0.5 - gy / span;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  // the four nodes, their coordinates held to the map
  const x0 = ix < 0 ? 0 : ix >= MAP_W ? MAP_W - 1 : ix, x1 = ix + 1 < 0 ? 0 : ix + 1 >= MAP_W ? MAP_W - 1 : ix + 1;
  const r0 = (iy < 0 ? 0 : iy >= MAP_H ? MAP_H - 1 : iy) * MAP_W, r1 = (iy + 1 < 0 ? 0 : iy + 1 >= MAP_H ? MAP_H - 1 : iy + 1) * MAP_W;
  const l00 = LAND_OF_CLIMATE[climates[r0 + x0]], l10 = LAND_OF_CLIMATE[climates[r0 + x1]], l01 = LAND_OF_CLIMATE[climates[r1 + x0]], l11 = LAND_OF_CLIMATE[climates[r1 + x1]];
  if (l00 === l10 && l00 === l01 && l00 === l11) { _share[l00] = 1; return 1 << l00; }
  const u = smooth01(fx - ix), v = smooth01(fy - iy);
  _share[l00] = 0; _share[l10] = 0; _share[l01] = 0; _share[l11] = 0;
  _share[l00] += (1 - u) * (1 - v); _share[l10] += u * (1 - v); _share[l01] += (1 - u) * v; _share[l11] += u * v;
  return (1 << l00) | (1 << l10) | (1 << l01) | (1 << l11);
}

/**
 * LANDFORM5/6: the hills at a world sample, in kernel units - a pure function of world position (x east, y north, in
 * samples: a pixel's edge is one number from both pixels), the land's own macro height and the world's climates. Each
 * climate's land wears its own shape (LANDFORM_DIALS.lands), its height the region field's (`low` to `high`), taller on
 * the high ground; where climates meet their lands are blended by their shares (landShares). The whole eases in over
 * `coast` times the lands' tallest hill over the knee, so a hill or a dale is always smaller than the land's height over
 * the knee and nothing it touches crosses it. The slow fields are read off the lattice (HILL_NODE); the shapes at the
 * sample itself.
 * @param {number} gx
 * @param {number} gy
 * @param {number} macro - the land's macro height (DFU's, no ground noise), kernel units
 * @param {number} low - its small-heightmap term
 * @param {?ReturnType<typeof hillLattice>} [lattice] - nodes made already (a pixel's own); the same numbers without
 * @param {?Uint8Array} [climates] - landformClimates' table; null stands every sample in woodlands
 * @param {?Float64Array} [out] - AUDIT LANDFORMS III C1: takes the deepest dale the lands there can stand (`out[0]`, the
 *   height of their tallest hill at the sample, eased as the hills are - never less than the hills' own magnitude)
 * @param {number} [span] - a pixel's samples (hDim - 1), where its climate's node stands
 * @returns {number}
 */
export function hillsAt(gx, gy, macro, low, lattice = null, climates = null, out = null, span = HEIGHTMAP_DIMENSION - 1) {
  const H = LANDFORM_DIALS.hills;
  const e = macro - LANDFORM_KNEE;
  if (out) out[0] = 0;
  if (!(e > 0)) return 0;
  const fx = gx / HILL_NODE, fy = gy / HILL_NODE, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
  let vals = _node, i00 = 0, i10 = NODE_VALUES, i01 = 2 * NODE_VALUES, i11 = 3 * NODE_VALUES;
  const li = lattice ? ix - lattice.nx0 : -1, lj = lattice ? iy - lattice.ny0 : -1;
  if (lattice && li >= 0 && lj >= 0 && li + 1 < lattice.side && lj + 1 < lattice.side) {
    vals = lattice.vals;
    i00 = (lj * lattice.side + li) * NODE_VALUES; i10 = i00 + NODE_VALUES; i01 = i00 + lattice.side * NODE_VALUES; i11 = i01 + NODE_VALUES;
  } else {
    hillNode(ix, iy, _node, 0); hillNode(ix + 1, iy, _node, i10); hillNode(ix, iy + 1, _node, i01); hillNode(ix + 1, iy + 1, _node, i11);
  }
  const a = (1 - u) * (1 - v), b = u * (1 - v), c = (1 - u) * v, d = u * v;
  const region = vals[i00] * a + vals[i10] * b + vals[i01] * c + vals[i11] * d;
  const wx = gx + (vals[i00 + 1] * a + vals[i10 + 1] * b + vals[i01 + 1] * c + vals[i11 + 1] * d);
  const wy = gy + (vals[i00 + 2] * a + vals[i10 + 2] * b + vals[i01 + 2] * c + vals[i11 + 2] * d);
  const rock = vals[i00 + 3] * a + vals[i10 + 3] * b + vals[i01 + 3] * c + vals[i11 + 3] * d;
  const up = smooth01((low - LANDFORM_KNEE) / H.uplandAt);
  const mask = landShares(gx, gy, climates, span);
  let top = 0, sum = 0, deep = 0;
  for (let j = 0; j < LANDS.length; j++) {
    if (!(mask & (1 << j))) continue;
    const land = LANDS[j], w = _share[j];
    if (!(w > 0)) continue;
    top += w * LAND_TOP[j];
    const amp = w * (land.low + (land.high - land.low) * region) * (1 + (land.upland - 1) * up);
    deep += amp;
    sum += amp * landShape(j, wx, wy, gx, gy, rock);
    if (land.peaks) {   // LANDFORM8: a mountain land's rounded peaks, on its hills - taller on the high ground
      const pa = w * land.peaks.high * (1 + (land.upland - 1) * up) / land.upland;   // the land's own upland: low ground's peaks lower
      sum += pa * (peakField(wx, wy, land.peaks.cell, land.peaks.fill) - land.peaks.fill * PEAK_MEAN);   // centred: the land's mean stays its own
      deep += pa;   // a river's valley carves a peak down as it carves a hill (AUDIT LANDFORMS III C1)
    }
  }
  const ease = smooth01(e / (H.coast * top));
  if (out) out[0] = deep * ease;
  return sum * ease;
}

/**
 * LANDFORM6: the world's climates as the landforms read them - CLIMATE.PAK's value for every map pixel (`climateAt`,
 * MapsFile.getClimateIndex, after the boot's coastal dilation), one byte a pixel. Made once on the main thread and
 * handed whole to the worker beside the sites, so every kernel stands every land on the same climates.
 * @param {(x: number, y: number) => number} climateAt
 * @returns {Uint8Array}
 */
export function landformClimates(climateAt) {
  const out = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) out[y * MAP_W + x] = climateAt(x, y) & 255;
  return out;
}

/** LANDFORM5: createLandforms' `hills: false` - no hills. */
const NO_HILLS = () => 0;

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

/** LANDFORM4: the levels asked, per world (its WoodsFile) and its climates (LANDFORM6) - a pure function of the bytes,
 *  kept while they are read. */
const _siteLevels = new WeakMap();
const NO_CLIMATES = Object.freeze({});
const SITE_LEVELS_KEPT = 4096;

/**
 * LANDFORM4: the level a site pulls its ground to, in kernel units - the mean of its pixel's land on a coarse grid
 * (every `site.grid` samples, its edges included): DFU's kernel, the lift faded as the shaper fades it, the hills - no
 * path's cut, no water's valley and no site's pull, so it is one number however the network stands. AUDIT LANDFORMS III
 * D4: the LAND's, the samples over the knee - DFU's blend after the kernel averages the sea and the beach into the town
 * again, and a level that had counted them already stood six coastal towns under the beach line, 13 m under DFU's own;
 * a pixel with no land on the grid takes the mean of all of it (a level under the knee, whose pull is held at the
 * floor).
 * @param {object} woods
 * @param {number} sx
 * @param {number} sy
 * @param {number} hDim
 * @param {{hills: boolean, climates: ?Uint8Array}} ground - whether the shaper stands hills, and on which climates (the
 *   hills unstilled: a level is one number however the network stands)
 * @returns {number}
 */
function siteLevel(woods, sx, sy, hDim, ground) {
  let byWorld = _siteLevels.get(woods);
  if (!byWorld) _siteLevels.set(woods, byWorld = new WeakMap());
  let kept = byWorld.get(ground.climates ?? NO_CLIMATES);
  if (!kept) byWorld.set(ground.climates ?? NO_CLIMATES, kept = new Map());
  const k = ((sy * MAP_W + sx) * 1024 + hDim) * 2 + (ground.hills ? 0 : 1);
  let level = kept.get(k);
  if (level !== undefined) return level;
  const span = hDim - 1, step = LANDFORM_DIALS.site.grid;
  const kernel = sampleKernel(woods, sx, sy, hDim, true, null);
  const { base, noise } = kernelTerms(woods, sx, sy, hDim);
  const cliff = cliffFade(woods, sx, sy, hDim);
  const ox = sx * span, oy = (MAP_H - sy) * span;
  const lattice = ground.hills ? hillLattice(ox, oy, span) : null;
  let sum = 0, n = 0, wet = 0, nw = 0;
  for (let x = 0; x <= span; x += step) {
    for (let y = 0; y <= span; y += step) {
      const h = kernel(x, y) * MAX_TERRAIN_HEIGHT;
      if (!(h > LANDFORM_KNEE)) { wet += h; nw++; continue; }
      n++;
      const low = base(x, y) * BASE_HEIGHT_SCALE;
      const macro = Math.min(Math.max(low + noise(x, y) * NOISE_MAP_SCALE, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT);
      sum += h + (cliff ? reliefLift(low) * cliff(x, y) : reliefLift(low)) + (ground.hills ? hillsAt(ox + x, oy + y, macro, low, lattice, ground.climates, null, span) : 0);
    }
  }
  level = n ? sum / n : wet / nw;
  if (kept.size >= SITE_LEVELS_KEPT) kept.delete(kept.keys().next().value);   // AUDIT LANDFORMS III R7: the longest kept goes, not the lot
  kept.set(k, level);
  return level;
}

/**
 * LANDFORM4: the sites about one pixel - every site in the 5x5 of pixels round it (a path's profile is read in the
 * 3x3, and a site reaches no further than the pixels beside its own), in ONE global order, by pixel row then column, so
 * two pixels that share a sample fold the same sites into it in the same order and land on the same float. AUDIT
 * LANDFORMS III C4: a margin - a sample reads a neighbour's arm only at its last two profile points, on their shared
 * edge, where a site two pixels off stands its reach away at the nearest (124 samples, its clearance 3 past its pixel),
 * so the 3x3's sites would land on the same floats; the 5x5 keeps a seam whole should a dial reach further.
 * @returns {Array<{x0: number, x1: number, y0: number, y1: number, reach: number, level: () => number}>}
 */
function sitesAbout(woods, sites, px, py, span, hDim, ground) {
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
      out.push({ x0, x1, y0, y1, reach: Math.min(most, reach + per * Math.max(x1 - x0, y1 - y0) / 2), level: () => (level ??= siteLevel(woods, qx, qy, hDim, ground)) });
    }
  }
  return out;
}

/**
 * LANDFORM4: the sites' pull at a world sample - each site's weight 1 inside its rect, easing to 0 at its reach past it
 * (1 - smoothstep); together they keep `keep` = the product of (1 - weight) of the land, and the rest goes to their
 * levels, each weighted by its weight to the fourth (the nearest all but alone where two reach). AUDIT LANDFORMS III A1:
 * a pull UP is eased in by how far the land stands over the knee toward the level (smoothstep of (land - knee) /
 * (level - knee)) - at the beach line the land is DFU's, and a sample beside it was pulled whole to a town's level: walls
 * at the beach round coastal towns, 85 real pixels over 50 m past DFU's own step, the worst 149 m beside Penwold. Eased,
 * a coast's land rises to a town's level no more than 1.69 times as steeply as it rises on its own. Writes the share of
 * the land kept (`keep`, after the ease) to `out[0]` and answers the pulled height.
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
  if (keep === 1 || !(ws > 0)) { out[0] = 1; return land; }
  const level = wt / ws;
  const move = level > land ? (1 - keep) * smooth01((land - LANDFORM_KNEE) / (level - LANDFORM_KNEE)) : 1 - keep;
  out[0] = 1 - move;
  return land + (level - land) * move;
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
 * (the mod's SmoothRoads, which smooths DFU's own road and not the level bed). Without them - no network, no sites, no
 * climates - createLandforms' own defaults, the relief's lift and the hills in woodlands, through the same kernel (AUDIT
 * LANDFORMS II J9: it was a second formula the game never ran, and the pins that read it as "the real pipeline" read
 * that; AUDIT LANDFORMS III B4: this said "the relief alone" after LANDFORM5 gave the default its hills). Not followed: World of Daggerfall's flatten.
 * @param {object} woods - the sampler's three-method surface.
 * @param {number} px
 * @param {number} py
 * @param {number} sx - the point's x in the pixel's sample space (0..128, east)
 * @param {number} sy - its y (0..128, north)
 * @param {?{xMin: number, xMax: number, yMin: number, yMax: number}} [locationRect] - the pixel's location rect
 *   (setLocationTiles' answer), or null in the wild.
 * @param {number} [hDim]
 * @param {?object} [landforms] - createLandforms over the network the pixel is cut along, or null: its defaults (the
 *   relief and the woodlands' hills, no paths, no sites)
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
  const lf = landforms ?? createLandforms({ woods, hDim });   // AUDIT LANDFORMS II J9: no network - the defaults, the kernel's own way
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
 * @param {?Uint8Array} [o.climates] - LANDFORM6: landformClimates' table, the land each climate wears; null stands every
 *   sample in woodlands (a test, a tool).
 * @param {number} [o.hDim]
 * @returns {{ pixel: (px: number, py: number) => (x: number, y: number, h: number, low: number, g: number) => number, rivers: boolean }}
 */
export function createLandforms({ woods, roads = null, sites = null, hills = true, climates = null, hDim = HEIGHTMAP_DIMENSION } = {}) {
  const span = hDim - 1;
  const half = span / 2;
  const cutRivers = !!roads?.water;
  const nets = LAYERS.map((l) => (l.water && !cutRivers ? null : roads?.[l.key] ?? null));
  // LANDFORM6: the hills on the world's climates (a pixel's shaper carves them along its painted water - AUDIT LANDFORMS
  // III C1)
  const hill = !hills ? NO_HILLS : (gx, gy, macro, low, lattice, out) => hillsAt(gx, gy, macro, low, lattice, climates, out, span);
  const ground = { hills: !!hills, climates };   // what a site's level stands on
  return { pixel: (px, py) => pixelShaper(woods, nets, hill, ground, sites, px, py, span, half, hDim), rivers: cutRivers };
}

/** AUDIT LANDFORMS III C1, LANDFORM7: one network layer's arms from the pixels within `around` of (px, py), each a
 *  segment from its pixel's centre to its edge, in world samples (x east, y north). */
function armsAbout(net, px, py, around, span, half) {
  const segs = [];
  for (let qy = py - around; qy <= py + around; qy++) {
    if (qy < 0 || qy >= MAP_H) continue;
    for (let qx = px - around; qx <= px + around; qx++) {
      if (qx < 0 || qx >= MAP_W) continue;
      const mask = net[qy * MAP_W + qx];
      if (!mask) continue;
      const cx = qx * span + half, cy = (MAP_H - qy) * span + half;
      for (const [bit, mdx, mdy] of DIR_DELTA) {
        if (!(mask & bit)) continue;
        const len = half * Math.sqrt(mdx * mdx + mdy * mdy);
        segs.push({ ax: cx, ay: cy, ux: (mdx * half) / len, uy: (-mdy * half) / len, len });
      }
    }
  }
  return segs;
}

/** The squared distance from a world sample to the nearest of `segs`, `r2` if none is nearer - order-free, so a seam's
 *  sample is one number from both pixels. */
function nearestD2(segs, gx, gy, r2) {
  let d2 = r2;
  for (let si = 0; si < segs.length; si++) {
    const sg = segs[si];
    const vx = gx - sg.ax, vy = gy - sg.ay;
    let t = vx * sg.ux + vy * sg.uy;
    if (t < 0) t = 0; else if (t > sg.len) t = sg.len;
    const qx = vx - sg.ux * t, qy = vy - sg.uy * t, q = qx * qx + qy * qy;
    if (q < d2) d2 = q;
  }
  return d2;
}

/** One pixel's shaper: its paths' segments gathered from the 3x3 pixels round it, the sites about it, and the closure
 *  the kernel calls. */
function pixelShaper(woods, nets, hill, ground, sites, px, py, span, half, hDim) {
  // the pixel's own sample origin in world samples: x east from the map's west edge, y NORTH from its south edge (the
  // ground noise's own frame, terrainSampler.js `noisey`), so pixel (px, py)'s (128, y) is (px + 1, py)'s (0, y) and
  // its (x, 128) is (px, py - 1)'s (x, 0) - one number each, from either pixel
  const ox = px * span;
  const oy = (MAP_H - py) * span;
  const cliff = cliffFade(woods, px, py, hDim);   // AUDIT LANDFORMS II I1: the lift's fade beside the sea, null inland
  // LANDFORM4: the sites a path's profile may meet (the 5x5), and the ones that reach this pixel's own box
  const around = sitesAbout(woods, sites, px, py, span, hDim, ground);
  const near = around.filter((s) => s.x1 + s.reach > ox && s.x0 - s.reach < ox + span && s.y1 + s.reach > oy && s.y0 - s.reach < oy + span);
  const kept = new Float64Array(1);
  const lattice = hill === NO_HILLS ? null : hillLattice(ox, oy, span);   // LANDFORM5: the slow fields' nodes over this pixel
  // AUDIT LANDFORMS III C1: A RIVER CUTS ITS VALLEY. The first law stilled the hills to nothing along the painted water,
  // and where its land was a dale the water stood over it on an embankment - on the real map 215 of 2,882 inland water
  // pixels stood over every dry neighbour by more than 10 m, the worst 77 m. Now within `valley` of a river's or a
  // stream's centre line the hills ease down to the deepest dale their land can stand (1 - smoothstep of the distance):
  // the water lies under every hill across its valley, its floor flat a little way either side and its walls rising to
  // the land's own hills. The centre lines are the network's own arms from the 5x5 of pixels round this one (a sample of
  // this pixel or a path's profile point in the 3x3 lies nearer none further off than a valley's width), and a sample
  // takes the nearest - order-free, so a seam is one number from both pixels.
  const valleys = [];
  if (hill !== NO_HILLS) {
    for (const [li, radius] of [[0, LANDFORM_DIALS.valley.stream], [1, LANDFORM_DIALS.valley.river]]) {
      const segs = nets[li] ? armsAbout(nets[li], px, py, 2, span, half) : [];
      if (segs.length) valleys.push({ segs, radius, r2: radius * radius });
    }
  }
  // LANDFORM7: A ROAD EASES THE HILLS. The hills rode into a road's profile whole, so a road climbed every one: on the
  // real map the grade along a straight road at the 95th percentile rose from the bare land's 7.5% to 18.5% in the
  // deserts, 7.2% to 15.6% in the haunted woods, 22.6% to 28.8% in the mountains. Within `ease` of a road's or a
  // track's centre line the hills ease down to `keep` of themselves at the line, so the road and its verges lie on the
  // smooth ground through the country and the hills rise again beside it. The arms are the 3x3's: a sample, or a
  // profile point a sample reads (within two samples of a shared edge), lies nearer no arm of a pixel two off than 116
  // samples. Before the valleys' carve, which takes the water to its dale whatever the road does.
  const easeways = [];
  if (hill !== NO_HILLS && LANDFORM_DIALS.ease.keep < 1) {
    for (const [li, radius] of [[2, LANDFORM_DIALS.ease.track], [3, LANDFORM_DIALS.ease.road]]) {
      const segs = nets[li] ? armsAbout(nets[li], px, py, 1, span, half) : [];
      if (segs.length) easeways.push({ segs, radius, r2: radius * radius });
    }
  }
  /** LANDFORM7: the share of the hills a world sample keeps beside the roads - `keep` on a centre line, all of it past
   *  the way's reach; the nearest way's. */
  const easeAt = (gx, gy) => {
    let e = 1;
    for (let vi = 0; vi < easeways.length; vi++) {
      const v = easeways[vi], d2 = nearestD2(v.segs, gx, gy, v.r2);
      if (!(d2 < v.r2)) continue;
      const k = 1 - (1 - LANDFORM_DIALS.ease.keep) * (1 - smooth01(Math.sqrt(d2) / v.radius));
      if (k < e) e = k;
    }
    return e;
  };
  /** AUDIT LANDFORMS III C1: the hills `h` at a world sample carved down toward `deep` (the deepest dale its lands can
   *  stand) by its nearest painted water - never above `h`, never under `-deep`. */
  const carve = (gx, gy, h, deep) => {
    let out = h;
    for (let vi = 0; vi < valleys.length; vi++) {
      const v = valleys[vi], d2 = nearestD2(v.segs, gx, gy, v.r2);
      if (!(d2 < v.r2)) continue;
      const k = smooth01(Math.sqrt(d2) / v.radius);
      const c = h * k - deep * (1 - k);
      if (c < out) out = c;
    }
    return out;
  };
  const deepOut = new Float64Array(1);
  /** LANDFORMS 1, 4, 5, 7: the land at a world sample - DFU's height, the lift, the hills (eased beside the roads,
   *  carved into the painted water's valleys) - pulled to the sites about it; `kept[0]` the share of the land's own left
   *  (so of its ground noise). */
  const landAt = (gx, gy, h, macro, low, fade, list) => {
    let hh = 0;
    if (hill !== NO_HILLS) {
      hh = hill(gx, gy, macro, low, lattice, deepOut);
      if (easeways.length) hh *= easeAt(gx, gy);
      if (valleys.length) hh = carve(gx, gy, hh, deepOut[0]);
    }
    const l = h + reliefLift(low) * fade + hh;
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
        const q = d * d + 0.25, r = 1 - d / reach;   // AUDIT LANDFORMS III A8: r * r, not r ** 2 (an engine's own pow)
        const w = ((r * r) / (q * q)) * (1e-3 + 0.999 * (1 - smooth01(past)));
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
