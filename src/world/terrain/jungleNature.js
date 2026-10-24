// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA1 (bible/03-World/Bantha-Jungle.md; the owner: "populate the area in a dense jungle like format ... insanely
// detailed and not hurt performance") - THE JUNGLE'S LAYOUT: where the jungle's trees stand, in four storeys.
//
// The pixel's own layout (world/terrain/terrainNature.js layoutNature - DFU's scatter or Real forests, and the
// ecotone's border) is laid first; then each tile the jungle owns is laid again by the jungle's own law and the
// pixel's flats on it give way. A tile is the jungle's where the field's share (world/jungle/jungleRegion.js
// jungleShare - whole inside the jungle's region, none past its wandering edge) beats the tile's own draw, so the jungle comes in at
// its edge as stands that grow and join, never a line.
//
//   - THE CANOPY. The land is cut into cells JUNGLE.cell tiles square (12.8 m), and every other cell is a canopy SITE -
//     a quincunx on the world's lattice (SPREAD, 2026-10-19, the owner: "Lets spread out on the distance between
//     trees": a canopy tree every cell stood 12.8 m from the next and as near as 5 m), so the canopy's trunks stand
//     18 m apart and never nearer than 9 m, and the owner's crowns, 16-19 m across, still meet overhead. A site stands
//     one canopy tree somewhere in its middle (JUNGLE.inset) - JUNGLE.canopy of the sites where the jungle is whole -
//     unless it falls in a GLADE: a second reading of the forests' own field (FOREST1 forestCover, offset so a glade is
//     not a plain), open where it is low - about a tenth of the land. Clearings open round towns and close round
//     dungeons, ruins and shrines (FOREST1's places).
//   - THE EMERGENTS. JUNGLE.emergent of the canopy trees stand above the rest (JUNGLE.emergentScale), and only the two
//     whose crowns are made to be seen from above: the kapok's parasols and the mahogany's tall dome.
//   - THE UNDERSTOREY AND THE MID STOREY. A cell stands at most one young tree (JUNGLE.underScale) or one of the
//     rainforest's own Trees (JUNGLE.palm - World of Daggerfall's Tree records of archive 500: its palms, which Low
//     Poly Trees stands in 3D), at its own place in it (JUNGLE.underInset) - so they keep a cell's distance from each
//     other (SPREAD: a tile's dice stood two young trees 1.3 m apart) - thicker in a light gap, where no canopy crown
//     reaches (JUNGLE.crown, at the trunk's scale: JUNGLE.gapUnder), than under one (JUNGLE.under), never within
//     JUNGLE.underClear (at the trunk's scale) of a canopy trunk, its cell's or a neighbour's, a neighbour pixel's too.
//     Mostly the low flame tree; some young figs, banyans and mahoganies.
//   - THE FLOOR. On most tiles the rainforest's own cover - its ferns, shrubs and flowers (archive 500's other
//     records): denser in a glade's light.
//   - THE SPECIES. Each tree's species is drawn from weights: a base, a GROVE (each species' own value noise, cells
//     JUNGLE.grove.cell tiles - so a slope of figs gives way to a stand of mahoganies), the ground's height above the
//     beach (banyans and figs crowd the low wet ground, kapoks and mahoganies the high), and light (the flame tree takes
//     the glades' edges).
//
// EVERY TREE ITS OWN DICE (FOREST1's law): every draw is a hash of a WORLD tile or cell (terrainNature.js tileDraw), so a
// tree stands where it stands whatever was laid before it, on every client and on the worker - Logging's trees stand
// where the room sees them. A jungle tree is a flat of the rainforest's archive with one of its Tree records
// (world/jungle/jungleModels.js JUNGLE_SPECIES), carrying `jungle` (its species) and `js` (its scale): the host stands
// the owner's tree there, and gameplay reads it as the Tree it is.
// ═══════════════════════════════════════════════════════════════════
import {
  tileDraw, forestCover, placesPull, groundAt, isTreeRecord, TREE_RECORDS, SLOPE_SINK_RATIO, NATURE_CLEARANCE,
} from './terrainNature.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE, SCALED_BEACH_ELEVATION } from './terrainSampler.js';
import { WORLD_MAP_TILE_DIM, sampleHeight } from './terrainTiles.js';
import { jungleDepthAt, jungleShare, JUNGLE_EDGE, JUNGLE_WANDER_MAX } from '../jungle/jungleRegion.js';
import { JUNGLE_ARCHIVE, JUNGLE_SPECIES, JUNGLE_MEASURES } from '../jungle/jungleModels.js';
import { trailClear, trailsReach } from '../jungle/jungleTrails.js';
import { standPairs, JUNGLE_ROADSIDE } from '../jungle/jungleRoadside.js';   // JUNGLE-ROADSIDE: the owner's pairs astride the roads
import { ecoNoise, ecoOrigin } from '../ecotone.js';

/** The jungle's numbers, in one place. Tiles are DFU's (6.4 m); a species is JUNGLE_SPECIES's index (0 banyan, 1 kapok,
 *  2 fig, 3 flame, 4 mahogany). */
export const JUNGLE = Object.freeze({
  /** a cell's side (tiles - a power of two dividing a pixel's 128, so cells never straddle a pixel); SPREAD: every other
   *  cell is a canopy site (canopySite - a quincunx on the world's lattice) */
  cell: 2,
  /** a whole jungle site's chance of a canopy tree */
  canopy: 0.9,
  /** the glades: forestCover read this far off (tiles), open below edge[0], closed canopy above edge[1] */
  glade: Object.freeze({ off: Object.freeze([4096.5, -2048.5]), edge: Object.freeze([0.385, 0.44]) }),
  /** a canopy tree's share standing above the rest, and the two storeys' scales (the owner's tree is 1) */
  emergent: 0.08,
  emergentScale: Object.freeze([1.28, 1.55]),
  canopyScale: Object.freeze([0.8, 1.18]),
  /** the understorey (SPREAD: a cell's, at most one - a young tree or a palm): a cell's chance of a young tree under a
   *  crown and in a light gap, its scale, and how far (m, times the trunk's own scale) it keeps from every canopy trunk
   *  about it - its cell's, a neighbour's, a neighbour pixel's (DOC-20) */
  under: 0.16,
  gapUnder: 0.42,
  underScale: Object.freeze([0.36, 0.62]),
  underClear: 4.5,
  /** how far a canopy tree's crown reaches over the ground (m, times its scale - the owner's crowns 8.7 to 9.6 m): past
   *  every crown is a light gap */
  crown: 9,
  /** a jungle cell's chance of one of the rainforest's own Trees, the mid storey */
  palm: 0.05,
  /** the floor: a tile's chance of the rainforest's cover, under the canopy and in a glade; none within this (m) of a
   *  canopy trunk */
  cover: 0.5,
  gladeCover: 0.68,
  coverClear: 2.2,
  /** the ground's share of every chance, by DFU's tile record (1 dirt, 2 grass, 3 stone); anything else grows nothing */
  ground: Object.freeze({ 1: 0.7, 2: 1, 3: 0.2 }),
  /** no jungle TREE (the canopy, the young) stands steeper than this (degrees); the palms and the floor stand to DFU's
   *  own 50 (terrainNature.js MAX_STEEPNESS - AUDIT BANTHA1 LAY-2: a 40-degree hillside of the jungle's was bare) */
  maxSteep: 34,
  floorSteep: 50,
  /** THE BORDER'S STANDS (AUDIT BANTHA1 LAY-9): across the line a tile is the jungle's where its share beats this patch
   *  noise - ECOTONE1's own law (two octaves, a cell in tiles dividing 128 and a weight each, stretched about a half) -
   *  so the jungle comes in by stands that grow and join, never a tile's white noise */
  stands: Object.freeze({ octaves: Object.freeze([Object.freeze({ cell: 8, weight: 0.65 }), Object.freeze({ cell: 2, weight: 0.35 })]), stretch: 2, salt: 541 }),
  /** where in its site a canopy tree may stand, a fraction of the cell each way (SPREAD: its middle half - two sites'
   *  trunks never nearer than 9 m) */
  inset: Object.freeze([0.25, 0.75]),
  /** where in its cell an understorey tree or a palm may stand */
  underInset: Object.freeze([0.2, 0.8]),
  /** where in its tile a plant of the floor may stand */
  tileInset: Object.freeze([0.1, 0.9]),
  /** the species' base weights, and their groves: a value noise a species (cells of `cell` tiles), the weight times
   *  floor + gain * noise */
  base: Object.freeze([1.0, 0.75, 1.0, 0.45, 0.95]),
  grove: Object.freeze({ cell: 32, floor: 0.25, gain: 1.5, salt: 523 }),   // AUDIT BANTHA1 LAY-1: a cell dividing 128, so the world's lattice - 24 restarted every pixel's groves at its edge
  /** the ground's height above the beach (m): `low` and under is wet lowland, `high` and over is upland - each a
   *  species' weight multiplied by its row's own at full */
  low: 25,
  high: 120,
  lowland: Object.freeze([1.8, 0.7, 1.4, 1.0, 0.7]),
  upland: Object.freeze([0.6, 1.6, 0.9, 0.8, 1.5]),
  /** the flame tree's gain in the light: its weight times 1 + light * this, light 1 in a glade */
  light: 3,
  /** the emergents' and the understorey's own pools (species, weight) */
  emergents: Object.freeze([Object.freeze([1, 1.0]), Object.freeze([4, 0.8])]),
  young: Object.freeze([Object.freeze([3, 0.5]), Object.freeze([2, 0.25]), Object.freeze([0, 0.15]), Object.freeze([4, 0.1])]),
});

/** The rainforest's own Trees (the mid storey) and its cover (the floor) - archive 500's records, as World of
 *  Daggerfall's Tree table splits them (terrainNature.js TREE_RECORDS). */
export const JUNGLE_PALMS = TREE_RECORDS[JUNGLE_ARCHIVE];
export const JUNGLE_COVER = Object.freeze(Array.from({ length: 31 }, (_, i) => i + 1).filter((r) => !isTreeRecord(JUNGLE_ARCHIVE, r)));

/** tan(JUNGLE.maxSteep) and tan(JUNGLE.floorSteep) squared - the steepness tests on the gradient itself. */
const TAN_MAX_SQ = Math.tan(JUNGLE.maxSteep * Math.PI / 180) ** 2;
const TAN_FLOOR_SQ = Math.tan(JUNGLE.floorSteep * Math.PI / 180) ** 2;

/** A tile's stand noise in [0, 1] (JUNGLE.stands), pixel-local tiles - the world's lattice, so continuous across edges. */
export function jungleStandNoise(origin, tx, tz) {
  const S = JUNGLE.stands;
  let n = 0;
  for (let k = 0; k < S.octaves.length; k++) n += S.octaves[k].weight * ecoNoise(origin, tx, tz, S.octaves[k].cell, S.salt + k);
  return Math.min(1, Math.max(0, (n - 0.5) * S.stretch + 0.5));
}

/** SPREAD: whether the cell whose first world tile is (wx, wz) is a canopy site - every other cell, a quincunx on the
 *  world's lattice (so the same at every pixel's edge: a pixel's first tile is a multiple of 128). */
export const canopySite = (wx, wz) => (((wx + wz) / JUNGLE.cell) & 1) === 0;

/** PERF-6 (AUDIT BANTHA1): whether the jungle owns every tile of a pixel whose 3x3 is `nine` - its own layout is then
 *  never read (the kernel lays none). */
export function jungleWhole(nine) {
  if (!nine) return false;
  let lo = Infinity;
  for (let k = 0; k < 9; k++) lo = Math.min(lo, nine[k]);
  return lo * TERRAIN_SIZE - JUNGLE_WANDER_MAX >= JUNGLE_EDGE.in;
}
/** The beach line in the ground's metres (natureStandsAt asks it of the raw sample; groundAt answers metres). */
const BEACH_M = SCALED_BEACH_ELEVATION * STREAMING_TERRAIN_SCALE;

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** A pick from `pool` ([species, weight] pairs, or weights by species index) at a draw in [0, 1). */
function pick(weights, draw) {
  let sum = 0;
  for (const w of weights) sum += w;
  let at = draw * sum;
  for (let i = 0; i < weights.length; i++) { at -= weights[i]; if (at < 0) return i; }
  return weights.length - 1;
}

/**
 * A canopy tree's species at its place: the base, its grove, its ground's height above the beach and the light.
 * @param {number[]} origin ecoOrigin's @param {number} tx @param {number} tz pixel-local tiles
 * @param {number} above the ground's height over the beach (m) @param {number} light 0 under closed canopy, 1 a glade
 * @param {number} draw [0, 1)
 */
export function canopySpecies(origin, tx, tz, above, light, draw) {
  const lowW = 1 - smoothstep(0, JUNGLE.low, above), highW = smoothstep(JUNGLE.low, JUNGLE.high, above);
  const w = JUNGLE.base.map((b, s) => {
    const grove = JUNGLE.grove.floor + JUNGLE.grove.gain * ecoNoise(origin, tx, tz, JUNGLE.grove.cell, JUNGLE.grove.salt + s);
    const ground = lerp(1, JUNGLE.lowland[s], lowW) * lerp(1, JUNGLE.upland[s], highW);
    return b * grove * ground * (s === 3 ? 1 + JUNGLE.light * light : 1);
  });
  return pick(w, draw);
}

/** A species from one of the fixed pools ([species, weight] pairs). */
const fromPool = (pool, draw) => pool[pick(pool.map((p) => p[1]), draw)][0];

/** The glades' lattice (tiles - FOREST1's own lattice step, a power of two dividing 128). */
export const GLADE_LATTICE = 4;
/**
 * A PIXEL'S GLADE FIELD: the forests' field (forestCover) read JUNGLE.glade.off away, sampled on the world's
 * GLADE_LATTICE lattice over the pixel and its far edge and read bilinearly between - FOREST1's forestField's way, so a
 * pixel samples it 1,089 times and not a tile's 16,384, and two pixels read their shared edge alike. `(x, y) => cover`, tiles.
 * @param {number} px @param {number} py
 */
export function gladeField(px, py) {
  const L = GLADE_LATTICE, n = WORLD_MAP_TILE_DIM / L + 1;
  const ox = px * WORLD_MAP_TILE_DIM + JUNGLE.glade.off[0], oz = -py * WORLD_MAP_TILE_DIM + JUNGLE.glade.off[1];
  const g = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g[j * n + i] = forestCover(ox + i * L, oz + j * L);
  return (x, y) => {
    const fx = x / L, fy = y / L;
    const i = Math.min(n - 2, Math.floor(fx)), j = Math.min(n - 2, Math.floor(fy));
    const u = fx - i, v = fy - j;
    return (g[j * n + i] * (1 - u) + g[j * n + i + 1] * u) * (1 - v) + (g[(j + 1) * n + i] * (1 - u) + g[(j + 1) * n + i + 1] * u) * v;
  };
}

/**
 * JUNGLE-ROADSIDE: WHERE A ROADSIDE PAIR'S TRUNK MAY STAND - a tile (tx, ty) its tree would stand on as the jungle's
 * own: the jungle whole (`share`), a ground that grows (`groundOf` - and no track, clearing or beach), no steeper than
 * the trees' maxSteep (`g2Of`, its gradient squared), no place's fields (`openOf`). The layout's own tile arrays (below).
 * @param {Float32Array} share @param {Float32Array} groundOf @param {Float32Array} g2Of @param {Float32Array} openOf
 */
export const pairTile = (share, groundOf, g2Of, openOf) => (tx, ty) => {
  const ti = ty * WORLD_MAP_TILE_DIM + tx;
  return share[ti] >= 1 && groundOf[ti] > 0 && g2Of[ti] <= TAN_MAX_SQ && openOf[ti] === 0;
};

/**
 * THE JUNGLE OVER A PIXEL'S LAYOUT. `own` - layoutNature's flats; `opts` - its options with `jungle`: `{ nine, pois,
 * paths, net }` (the field's 3x3 - world/jungle/jungleRegion.js jungleNine - FOREST1's places, the road painter's track
 * mask, null for none, and JUNGLE-ROADSIDE: the road network the painter painted with, null for none). Answers the
 * pixel's flats: its own on every tile the jungle does not own, the jungle's on the tiles it does. A pixel the jungle
 * cannot reach answers `own` itself. jungleLayout's flats alone.
 * @param {Array<any>} own
 * @param {Float32Array} heightmapData @param {Uint8Array} tilemapData
 * @param {{ mapPixelX: number, mapPixelY: number, locationRect: any, beach?: ?Float32Array,
 *   jungle?: ?{ nine: ArrayLike<number>, pois?: any[], paths?: ?Uint8Array, net?: any } }} opts
 */
export const withJungle = (own, heightmapData, tilemapData, opts) => jungleLayout(own, heightmapData, tilemapData, opts).flats;

/**
 * THE JUNGLE OVER A PIXEL'S LAYOUT, WITH ITS ROADS' PAIRS: `{ flats, pairs }` - withJungle's flats, and JUNGLE-ROADSIDE:
 * the pixel's roadside pairs (world/jungle/jungleRoadside.js standPairs), beside the flats and never among them (AUDIT
 * JUNGLE-ROADSIDE PERF-2: carried as seven of the flats' columns they grew the wire 88% for 0.2% of its flats).
 * @param {Array<any>} own
 * @param {Float32Array} heightmapData @param {Uint8Array} tilemapData
 * @param {Parameters<typeof withJungle>[3]} opts
 * @returns {{ flats: Array<any>, pairs: ReturnType<typeof standPairs> }}
 */
export function jungleLayout(own, heightmapData, tilemapData, opts) {
  const jg = opts.jungle;
  if (!jg?.nine) return { flats: own, pairs: [] };
  let hi = -Infinity;
  for (let k = 0; k < 9; k++) hi = Math.max(hi, jg.nine[k]);
  if (hi * TERRAIN_SIZE + JUNGLE_WANDER_MAX <= -JUNGLE_EDGE.out) return { flats: own, pairs: [] };   // the line, wander and all, cannot reach a tile
  const whole = jungleWhole(jg.nine);   // ...nor leave one: every tile the jungle's
  const tDim = WORLD_MAP_TILE_DIM, hDim = HEIGHTMAP_DIMENSION, scale = TERRAIN_SIZE / tDim;
  const px = opts.mapPixelX, py = opts.mapPixelY;
  const ox = px * tDim, oz = -py * tDim;   // the pixel's first world tile (FOREST1's frame: z north)
  const origin = ecoOrigin(px, py);
  // which tiles are the jungle's, and how much: the share at the tile's middle against the tile's own draw
  const share = new Float32Array(tDim * tDim);
  const mine = new Uint8Array(tDim * tDim);
  let any = false;
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const j = whole ? 1 : jungleShare(jungleDepthAt(px, py, jg.nine, (x + 0.5) * scale, (y + 0.5) * scale));
      if (j <= 0) continue;
      share[y * tDim + x] = j;
      if (j >= 1 || jungleStandNoise(origin, x + 0.5, y + 0.5) < j) { mine[y * tDim + x] = 1; any = true; }   // LAY-9: by stands
    }
  }
  if (!any) return { flats: own, pairs: [] };

  const yScale = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  const cell = TERRAIN_SIZE / (hDim - 1);
  const at = (a, b) => heightmapData[a * hDim + b] * yScale;
  const clear = [opts.locationRect, ...(jg.pois ?? [])].filter((r) => r && r.xMax > r.xMin && r.yMax > r.yMin).map((r) => ({
    xMin: r.xMin - NATURE_CLEARANCE, xMax: r.xMax + NATURE_CLEARANCE, yMin: r.yMin - NATURE_CLEARANCE, yMax: r.yMax + NATURE_CLEARANCE,
  }));
  const pois = jg.pois ?? [];
  const paths = jg.paths ?? null;
  // EACH TILE'S STANDING, once: the ground's share of every chance (0 - nothing of the jungle's stands there: not its
  // tile, not a ground that grows, a track, a clearing, steeper than DFU's 50, under the beach line), its gradient
  // squared, and its light - how open the sky is over it, 1 in a glade and 0 under closed canopy (the glade field less
  // the places' pull) - its glade's light alone (AUDIT BANTHA1 LAY-3), and how far it lies in a place's fields (`openOf`:
  // a town's ring is open ground - no canopy, no young trees, no palms - never the jungle's thickest light gap)
  const groundOf = new Float32Array(tDim * tDim), g2Of = new Float32Array(tDim * tDim), lightOf = new Float32Array(tDim * tDim);
  const gladeOf = new Float32Array(tDim * tDim), openOf = new Float32Array(tDim * tDim);
  const glade = gladeField(px, py);
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const ti = y * tDim + x;
      if (!mine[ti]) continue;
      const ground = JUNGLE.ground[tilemapData[ti] & 0x3f];
      if (!ground || paths?.[ti]) continue;
      if (clear.some((r) => x >= r.xMin && x < r.xMax && y >= r.yMin && y < r.yMax)) continue;
      const hl = at(Math.max(0, x - 1), y), hr = at(Math.min(hDim - 1, x + 1), y);
      const hd = at(x, Math.max(0, y - 1)), hu = at(x, Math.min(hDim - 1, y + 1));
      const gx = (hr - hl) / (2 * cell), gz = (hu - hd) / (2 * cell);
      const g2 = gx * gx + gz * gz;
      if (g2 > TAN_FLOOR_SQ) continue;   // LAY-2: DFU's own 50 - the trees' 34 is theirs alone (below)
      const hx = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (x / tDim))));
      const hy = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (y / tDim))));
      if (sampleHeight((opts.beach ?? heightmapData)[hy + hx * hDim]) < SCALED_BEACH_ELEVATION) continue;   // the beach line, as every flat's
      groundOf[ti] = ground;
      g2Of[ti] = g2;
      const closed = smoothstep(JUNGLE.glade.edge[0], JUNGLE.glade.edge[1], glade(x, y)), pull = placesPull(pois, x, y);
      lightOf[ti] = 1 - Math.min(1, Math.max(0, closed + pull));
      gladeOf[ti] = 1 - closed;
      openOf[ti] = Math.min(1, Math.max(0, -pull));
    }
  }
  const placeAt = (mx, mz, g2) => groundAt(heightmapData, mx, mz) - Math.atan(Math.sqrt(g2)) * (180 / Math.PI) / SLOPE_SINK_RATIO;
  // JUNGLE-TRAILS: a tree keeps its FOOT off a trail's dirt as VERGE1 keeps it off a road - its roots, buttresses and
  // curtains at its own scale (jungleModels.js JUNGLE_MEASURES) - where the trails run: the jungle whole (the painter's
  // own gate, world/jungle/jungleTrails.js trailClear); the palms and the floor keep off its tiles (`paths`, above)
  const trails = whole || trailsReach(jg.nine);
  const onTrail = (ti, mx, mz, species, js) => trails && share[ti] >= 1 && !trailClear(px, py, mx, mz, JUNGLE_MEASURES[species].foot * js);
  // JUNGLE-ROADSIDE: the owner's pairs astride the roads, stood before the storeys - on whole jungle, off the roads and
  // the trails by their feet, sunk to the lowest ground under them (world/jungle/jungleRoadside.js standPairs) - and
  // every tree and plant after them keeping its trunk JUNGLE_ROADSIDE.clear (the floor JUNGLE.coverClear) off theirs,
  // as off a canopy trunk; `nearPairTile` marks the tiles a pair's clearance can reach, so a spot off them - every spot
  // of a pixel with none - is answered at once
  const pairs = jg.net ? standPairs({
    px, py, net: jg.net, heightmapData,
    tileOk: pairTile(share, groundOf, g2Of, openOf),
    trailOk: (x, z, r) => !trails || trailClear(px, py, x, z, r),
  }) : [];
  const pairTrunks = [], nearPairTile = pairs.length ? new Uint8Array(tDim * tDim) : null;
  for (const p of pairs) {
    for (const t of p.trees) {
      pairTrunks.push(t.x, t.z, p.js);
      const reach = Math.ceil((JUNGLE_ROADSIDE.clear * p.js) / scale) + 1;
      const tx = Math.floor(t.x / scale), ty = Math.floor(t.z / scale);
      for (let y = Math.max(0, ty - reach); y <= Math.min(tDim - 1, ty + reach); y++) nearPairTile.fill(1, y * tDim + Math.max(0, tx - reach), y * tDim + Math.min(tDim - 1, tx + reach) + 1);
    }
  }
  /** whether (mx, mz) stands within `clear` (m, at each pair's own scale) of a pair's trunk */
  const nearPair = (mx, mz, clear) => {
    if (!nearPairTile?.[Math.min(tDim - 1, Math.floor(mz / scale)) * tDim + Math.min(tDim - 1, Math.floor(mx / scale))]) return false;
    for (let i = 0; i < pairTrunks.length; i += 3) {
      const dx = mx - pairTrunks[i], dz = mz - pairTrunks[i + 1], r = clear * pairTrunks[i + 2];
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };

  // the pixel's own flats, but those on the jungle's tiles
  const out = own.filter((f) => !mine[Math.min(tDim - 1, Math.floor(f.z / scale + 1e-6)) * tDim + Math.min(tDim - 1, Math.floor(f.x / scale + 1e-6))]);

  // THE CANOPY, a cell at a time - and each cell's tree kept for the storeys under it
  const C = JUNGLE.cell, cells = tDim / C;
  const trunks = new Float32Array(cells * cells * 3).fill(NaN);   // a cell's canopy tree: x, z (m) and its scale
  const [in0, in1] = JUNGLE.inset;
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const wx = ox + cx * C, wz = oz + cy * C;
      if (!canopySite(wx, wz)) continue;   // SPREAD: every other cell
      const tx = cx * C + C * (in0 + (in1 - in0) * tileDraw(wx, wz, 20));
      const tz = cy * C + C * (in0 + (in1 - in0) * tileDraw(wx, wz, 21));
      const ti = Math.floor(tz) * tDim + Math.floor(tx);
      if (!groundOf[ti] || g2Of[ti] > TAN_MAX_SQ) continue;   // LAY-2: no canopy tree up a slope past 34
      const light = lightOf[ti];
      if (tileDraw(wx, wz, 22) >= JUNGLE.canopy * share[ti] * (1 - light) * groundOf[ti]) continue;
      const mx = tx * scale, mz = tz * scale;
      const above = groundAt(heightmapData, mx, mz) - BEACH_M;
      const emergent = tileDraw(wx, wz, 23) < JUNGLE.emergent;
      const species = emergent ? fromPool(JUNGLE.emergents, tileDraw(wx, wz, 24)) : canopySpecies(origin, tx, tz, above, light, tileDraw(wx, wz, 24));
      const [s0, s1] = emergent ? JUNGLE.emergentScale : JUNGLE.canopyScale;
      const js = s0 + (s1 - s0) * tileDraw(wx, wz, 25);
      if (onTrail(ti, mx, mz, species, js)) continue;
      if (nearPair(mx, mz, JUNGLE_ROADSIDE.clear)) continue;   // JUNGLE-ROADSIDE: no canopy tree crowds a pair's trunk
      const k = (cy * cells + cx) * 3;
      trunks[k] = mx; trunks[k + 1] = mz; trunks[k + 2] = js;
      out.push({ record: JUNGLE_SPECIES[species].record, x: mx, y: placeAt(mx, mz, g2Of[ti]), z: mz, wood: 1, archive: JUNGLE_ARCHIVE, jungle: species, js });
    }
  }

  /** a cell's canopy trunk into `t` ([x, z] m pixel-local, scale): this pixel's where it stands (false where none); a
   *  NEIGHBOUR pixel's cell (AUDIT BANTHA1 LAY-7) by its pure tile hashes - where it would stand, held as standing, so
   *  nothing under it crowds a trunk across the edge */
  const _t = [0, 0, 0];
  const trunkAt = (i, j, t) => {
    if (i >= 0 && i < cells && j >= 0 && j < cells) {
      const k = (j * cells + i) * 3;
      if (Number.isNaN(trunks[k])) return false;
      t[0] = trunks[k]; t[1] = trunks[k + 1]; t[2] = trunks[k + 2];
      return true;
    }
    const wx = ox + i * C, wz = oz + j * C;
    if (!canopySite(wx, wz)) return false;   // SPREAD: no site, no trunk
    t[0] = (i * C + C * (in0 + (in1 - in0) * tileDraw(wx, wz, 20))) * scale;
    t[1] = (j * C + C * (in0 + (in1 - in0) * tileDraw(wx, wz, 21))) * scale;
    const [s0, s1] = tileDraw(wx, wz, 23) < JUNGLE.emergent ? JUNGLE.emergentScale : JUNGLE.canopyScale;
    t[2] = s0 + (s1 - s0) * tileDraw(wx, wz, 25);
    return true;
  };
  /** whether (mx, mz) stands within `clear` (m, at each tree's own scale) of a canopy trunk - its cell's or a neighbour's,
   *  across the pixel's edge too (PERF-6: squared distances) */
  const crowded = (mx, mz, cx, cy, clear) => {
    for (let j = cy - 1; j <= cy + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        if (!trunkAt(i, j, _t)) continue;
        const dx = mx - _t[0], dz = mz - _t[1], r = clear * _t[2];
        if (dx * dx + dz * dz < r * r) return true;
      }
    }
    return false;
  };

  // THE UNDERSTOREY AND THE MID STOREY, a cell at a time (SPREAD): one young tree or palm at most a cell, at its own
  // place in it - so they keep a cell's distance from each other as the canopy's trunks do; its tile is taken, so no plant
  // of the floor grows out of its trunk (a tile stood one of the three, on one roll, before SPREAD)
  const [u0, u1] = JUNGLE.underInset;
  const taken = new Uint8Array(tDim * tDim);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const wx = ox + cx * C, wz = oz + cy * C;
      const tx = cx * C + C * (u0 + (u1 - u0) * tileDraw(wx, wz, 40)), tz = cy * C + C * (u0 + (u1 - u0) * tileDraw(wx, wz, 41));
      const ti = Math.floor(tz) * tDim + Math.floor(tx), ground = groundOf[ti];
      if (!ground) continue;
      const mx = tx * scale, mz = tz * scale, g2 = g2Of[ti], j = share[ti];
      const fields = 1 - openOf[ti];   // LAY-3: a place's fields stand no young tree and no palm
      const gap = !crowded(mx, mz, cx, cy, JUNGLE.crown);   // a light gap: no canopy crown reaches over it
      const under = g2 > TAN_MAX_SQ ? 0 : (gap ? JUNGLE.gapUnder : JUNGLE.under) * j * ground * fields;   // LAY-2: no young tree past 34
      const palm = JUNGLE.palm * j * ground * fields;
      const roll = tileDraw(wx, wz, 42);
      if (roll >= under + palm || crowded(mx, mz, cx, cy, JUNGLE.underClear)) continue;
      if (nearPair(mx, mz, JUNGLE_ROADSIDE.clear)) continue;   // JUNGLE-ROADSIDE: nor a young tree or a palm
      if (roll < under) {
        const species = fromPool(JUNGLE.young, tileDraw(wx, wz, 43));
        const [s0, s1] = JUNGLE.underScale;
        const js = s0 + (s1 - s0) * tileDraw(wx, wz, 44);
        if (onTrail(ti, mx, mz, species, js)) continue;
        out.push({ record: JUNGLE_SPECIES[species].record, x: mx, y: placeAt(mx, mz, g2), z: mz, wood: 1, archive: JUNGLE_ARCHIVE, jungle: species, js });
      } else {
        out.push({ record: JUNGLE_PALMS[Math.floor(tileDraw(wx, wz, 45) * JUNGLE_PALMS.length)], x: mx, y: placeAt(mx, mz, g2), z: mz, wood: 1, archive: JUNGLE_ARCHIVE });
      }
      taken[ti] = 1;
    }
  }

  // THE FLOOR, a tile at a time
  const [t0, t1] = JUNGLE.tileInset;
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const ti = y * tDim + x, ground = groundOf[ti];
      if (!ground || taken[ti]) continue;
      const wx = ox + x, wz = oz + y;
      const cx = Math.floor(x / C), cy = Math.floor(y / C);
      const mx = (x + t0 + (t1 - t0) * tileDraw(wx, wz, 30)) * scale, mz = (y + t0 + (t1 - t0) * tileDraw(wx, wz, 31)) * scale;
      const cover = lerp(JUNGLE.cover, JUNGLE.gladeCover, gladeOf[ti]) * share[ti] * ground;   // LAY-3: the floor by the glade's light, never a place's
      if (tileDraw(wx, wz, 32) >= cover || crowded(mx, mz, cx, cy, JUNGLE.coverClear) || nearPair(mx, mz, JUNGLE.coverClear)) continue;   // JUNGLE-ROADSIDE: nor a pair's
      out.push({ record: JUNGLE_COVER[Math.floor(tileDraw(wx, wz, 36) * JUNGLE_COVER.length)], x: mx, y: placeAt(mx, mz, g2Of[ti]), z: mz, wood: 1, archive: JUNGLE_ARCHIVE });
    }
  }
  return { flats: out, pairs };
}
