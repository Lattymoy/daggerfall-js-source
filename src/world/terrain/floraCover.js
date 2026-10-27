// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAR-FLORA (2026-10-26, the owner: "on top of distant view, no flora/trees show. Its just a plain green flat texture.
// No band aids for any of this"; bible/06-Systems/Travel-View.md FAR-FLORA): THE WOODS PAST THE STREAMED GRID, BY THE
// NEAR LAW. The streamed grid stands its trees one tile at a time (world/terrain/terrainNature.js layoutNature: FOREST1's
// field and chances, or DFU's own scatter with the Real forests switch off); past its edge the middle ring and the far
// views stood the bare ground in one climate tint, so the woods ended in a line 4.5 km out. This module is the same law
// read where the far views stand a vertex - how many Trees a tile of the near ground grows there - and what that many
// crowns hide of the ground seen from afar (the canopy's cover, the share the far views paint in the trees' own art and
// raise to their own height: render/midRing.js, render/farRing.js, render/farField.js).
//
// AT A MIDDLE-RING SAMPLE (102.4 m, every 16th tile): the forest field (FOREST1's forestAt, the world tile's own number),
// and the ground classes at four of the tiles about it (DFU's tileDataAt: the sea, the beach's dirt, the Perlin's
// dirt/grass/stone - the very classes the near layout reads the chances by), a corner that grows nothing (the sea, the
// beach line, a face over MAX_STEEPNESS) counted as none. The climate is not asked here (the Bay's climate is the main
// thread's map): its share - the woods' law or DFU's scatter, the desert's quarter, the archive's Tree records - is laid
// on by `treesPerTile` where the vertex is built.
//
// WORKER-SAFE: pure, node-tested modules only (the terrain worker runs `midRingFloraPixel` beside the heights).
// ═══════════════════════════════════════════════════════════════════

import { forestAt, forestCover, FOREST, TREE_RECORDS, MAX_STEEPNESS, BASE_CHANCE_ON_DIRT, BASE_CHANCE_ON_GRASS, BASE_CHANCE_ON_STONE, DESERT_NATURE_SCALE, layoutNature, isTreeRecord, compileRecipe, recipeWood } from './terrainNature.js';
import { forestQuantile, landsNine } from '../tamriel/tamrielLands.js';   // TESA-LANDS: a zone's own woods past the Bay
import { inBay } from '../tamriel/tamrielFrame.js';
import { tileDataAt, WORLD_MAP_TILE_DIM, WATER, generateTileData, assignTiles } from './terrainTiles.js';
import { STREAMING_TERRAIN_SCALE, SCALED_BEACH_ELEVATION, TERRAIN_SIZE, HEIGHTMAP_DIMENSION, generateSamples } from './terrainSampler.js';

/**
 * THE DIALS (one place).
 *  - `dfu`: DefaultTerrainNature's chances by tile record (terrainNature.js BASE_CHANCE_ON_DIRT/GRASS/STONE, their one
 *    home) - the scatter with the Real forests switch off, and on a desert.
 *  - `desert`: the desert's scale on every chance (terrainNature.js DESERT_NATURE_SCALE).
 *  - `steep`: no tree stands on a face steeper than this (degrees - terrainNature.js MAX_STEEPNESS).
 *  - `woodShare`: how much of the land FOREST1's field makes woods (its record: "about 45% of the land is forest") - the
 *    far ring's and the far field's expectation, whose vertices stand 819 m and 6.55 km apart, past the field's waves.
 *  - `grazing`: how many crowns' widths of ground a crown hides seen from afar - the eye looks across the woods, not down
 *    into them, so the trunks' gaps close.
 *  - `lift`: the canopy's surface over the ground, a share of the trees' own height (crowns are not columns).
 *  - `ground`: the near ground's classes as tileDataAt lays them over the land (dirt 1, grass 2, stone 3 - the shares
 *    measured over 200,000 corners of the Bay's land, 2026-10-26): the far ring's and the far field's ground, whose
 *    vertices stand past the Perlin's 20-tile wave.
 */
export const FLORA = Object.freeze({
  dfu: Object.freeze({ 1: BASE_CHANCE_ON_DIRT, 2: BASE_CHANCE_ON_GRASS, 3: BASE_CHANCE_ON_STONE }),
  desert: DESERT_NATURE_SCALE,
  steep: MAX_STEEPNESS,
  woodShare: 0.45,
  grazing: 2.2,
  lift: 0.7,
  ground: Object.freeze({ 1: 0.054, 2: 0.927, 3: 0.019 }),
});

/** The bytes a sample's answer packs, one each: the forest field, and the shares of its corners that are dirt, grass and
 *  stone (the rest grow nothing) - x255. */
export const FLORA_WOOD = 0, FLORA_DIRT = 8, FLORA_GRASS = 16, FLORA_STONE = 24;
/** A sample's four corners, in tiles from it (a quarter of the 16-tile step each way: the Perlin's 20-tile wave read
 *  across the sample's own patch, not at one corner of it), kept inside its pixel's 129 corners. */
const CORNERS = Object.freeze([[-4, -4], [4, -4], [-4, 4], [4, 4]]);
const TAN_STEEP = Math.tan(FLORA.steep * Math.PI / 180);

/**
 * One middle-ring pixel's flora: (sub + 1) x (sub + 1) samples, row j (north) by column i (east) - midRingPixel's own
 * lattice - each a Uint32 packing [wood, dirt, grass, stone] (FLORA_* shifts). `heights` the pixel's own samples
 * (midRingPixel's, world units), `px`, `py` the pixel.
 * @param {ArrayLike<number>} heights @param {number} px @param {number} py @param {number} [sub]
 */
export function midRingFloraPixel(heights, px, py, sub = 8) {
  const w = sub + 1, step = WORLD_MAP_TILE_DIM / sub, cell = TERRAIN_SIZE / sub, out = new Uint32Array(w * w);
  const toSample = 1 / STREAMING_TERRAIN_SCALE;   // world units back to the sample's own height (sampleHeight's)
  const h = (i, j) => heights[Math.max(0, Math.min(sub, j)) * w + Math.max(0, Math.min(sub, i))];
  for (let j = 0; j <= sub; j++) {
    for (let i = 0; i <= sub; i++) {
      const hh = h(i, j);
      const gx = (h(i + 1, j) - h(i - 1, j)) / (2 * cell), gz = (h(i, j + 1) - h(i, j - 1)) / (2 * cell);
      const steep = gx * gx + gz * gz > TAN_STEEP * TAN_STEEP;
      const n = [0, 0, 0, 0];
      for (const [dx, dy] of CORNERS) {
        const x = Math.min(WORLD_MAP_TILE_DIM, Math.max(0, i * step + dx)), y = Math.min(WORLD_MAP_TILE_DIM, Math.max(0, j * step + dy));
        const height = hh * toSample;
        if (steep || height < SCALED_BEACH_ELEVATION) continue;   // natureStandsAt's: the beach line, the face
        const c = tileDataAt(height, x, y, px, py);
        if (c !== WATER) n[c]++;
      }
      const wood = forestAt(px * WORLD_MAP_TILE_DIM + Math.min(127, i * step), -py * WORLD_MAP_TILE_DIM + Math.min(127, j * step));
      const b = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
      out[j * w + i] = (b(wood) << FLORA_WOOD | b(n[1] / 4) << FLORA_DIRT | b(n[2] / 4) << FLORA_GRASS | b(n[3] / 4) << FLORA_STONE) >>> 0;
    }
  }
  return out;
}

/** A packed sample's [wood, dirt, grass, stone], 0..1. */
export function unpackFlora(v) {
  return [((v >>> FLORA_WOOD) & 255) / 255, ((v >>> FLORA_DIRT) & 255) / 255, ((v >>> FLORA_GRASS) & 255) / 255, ((v >>> FLORA_STONE) & 255) / 255];
}

/**
 * THE NEAR LAW'S TREES A TILE where a sample stands: `wood` the forest field, `dirt`, `grass`, `stone` the shares of its
 * ground; `spec` the climate's (floraSpec): with the woods' law (FOREST1: the switch, not a desert, an archive with a Tree
 * table) a Tree's chance by the field and the ground's share (terrainNature.js forestTiles); else DFU's scatter - the
 * ground's chance, the WOODS byte's elevation scale (`byte`), the desert's quarter, and the share of its 31 records that
 * are Trees. Pure.
 * @param {number} wood @param {number} dirt @param {number} grass @param {number} stone
 * @param {{ forests: boolean, desert: boolean, treeShare: number, coverShare?: number, lands?: any }} spec @param {number} [byte]
 */
export function treesPerTile(wood, dirt, grass, stone, spec, byte = 128) {
  if (!spec || !(spec.treeShare > 0 || spec.coverShare > 0)) return 0;
  if (spec.lands) return landsTrees(spec.lands, spec.lands.woodOf(wood), dirt, grass, stone);   // TESA-LANDS: a zone's own woods
  if (spec.forests) {
    const g = FOREST.ground;
    return (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * wood) * (g[1] * dirt + g[2] * grass + g[3] * stone);
  }
  const d = FLORA.dfu, elevation = Math.min(1, Math.max(0.4, byte / 128));
  return (d[1] * dirt + d[2] * grass + d[3] * stone) * elevation * (spec.desert ? FLORA.desert : 1) * spec.treeShare;
}

/** The climate's flora as the near law reads it: `natureArchive` its summer nature archive, `desert` its base type the
 *  desert's, `forests` the Real forests switch. Pure. */
export function floraSpec(natureArchive, desert, forests) {
  const trees = TREE_RECORDS[natureArchive];
  if (!trees) return { forests: false, desert, treeShare: 0 };
  return { forests: !!forests && !desert, desert, treeShare: (forests && !desert) ? 1 : trees.length / 31 };
}

/** THE CANOPY'S COVER: the share of the ground `trees` a tile's crowns hide from afar, each `crownM` metres across - one
 *  minus the chance a line across the woods meets no crown (FLORA.grazing widths). Pure. */
export function canopyCover(trees, crownM) {
  if (!(trees > 0)) return 0;
  const tile = (TERRAIN_SIZE / WORLD_MAP_TILE_DIM) ** 2;
  return 1 - Math.exp(-trees * FLORA.grazing * crownM * crownM * (Math.PI / 4) / tile);
}

/** THE GROUND A TREE STANDS ON, at a far vertex: not a face steeper than FLORA.steep (its normal's y `ny`), not under the
 *  beach line (`h` the sample's own height, sampleHeight's: unscaled) - natureStandsAt's two tests. Pure. */
export const standsTrees = (ny, h) => ny >= COS_STEEP && h >= SCALED_BEACH_ELEVATION;
const COS_STEEP = Math.cos(FLORA.steep * Math.PI / 180);

/** A far vertex's canopy where the field is past its resolution (the far ring, the far field): the woods' share of the
 *  land (FLORA.woodShare; TESA-LANDS a zone's own, its `woods`) on grass, read through the same law. Pure. */
export const expectedTrees = (spec, byte) => (spec?.lands && (spec.treeShare > 0 || spec.coverShare > 0) ? landsTrees(spec.lands, spec.lands.woods, 0, 1, 0) : treesPerTile(FLORA.woodShare, 0, 1, 0, spec, byte));

// ═══════════════════════════════════════════════════════════════════
// TESA-LANDS (bible/03-World/Tamriel-Lands.md): A ZONE'S WOODS AFAR. Past the Bay a zone lays its own flats (its recipe -
// world/tamriel/tamrielLands.js LANDS' `flora`, terrainNature.js landsTiles): its woods' edge on the forest field at its
// own quantile, its Trees' chance by its rate and its ground's shares. The far views read the same law: a sample's packed
// wood is FOREST1's (forestAt - the climates' 45%), so a zone's is its EXPECTATION GIVEN it (landsFloraSpec's woodOf):
// the field's own distribution (FOREST_QUANTILES) read at 4,096 quantiles, each one's FOREST1 wood and the zone's, the
// zone's averaged in the bins of FOREST1's - exact where FOREST1's edge is crossed, and where it is not (the field under
// or over FOREST1's edge) the zone's mean over that side. The Pinewoods' 80% stands where FOREST1's plain does; the
// Ashlands' 2% is a tenth of FOREST1's woods.
// ═══════════════════════════════════════════════════════════════════

/** The bins of FOREST1's wood the expectation is kept in (and its two ends: under FOREST1's edge, over it). */
export const LANDS_WOOD_BINS = 32;
const _landsSpecs = new WeakMap();
/**
 * A ZONE'S FLORA as the far views read it (floraSpec's shape, its `lands` the zone's law): `woods` its share of the land in
 * woods, `woodOf(w)` its woods' share expected at FOREST1's wood `w`, `ground` (DFU's tile record to its share of a Tree's
 * chance) its recipe's; `treeShare` the share of its `trees` (by weight) that are Trees (TREE_RECORDS - the far views'
 * canopy, the band's and the 3D trees' kind: a stump, a log or a snag the recipe stands among them is a flat), 0 where it
 * grows none, and `treeRate` its recipe's rate by that share - so a zone's far canopy is the Trees its pixels stand and
 * no more (AUDIT: a recipe's stumps and mossy rocks had read as canopy, thinning where the band took over); `coverShare`
 * and `coverRate` the same of its `cover` (the second audit, lane D: a Tree among a zone's cover stands at the cover's
 * chance - the Velothi Foothills' 506:14, a third of its near Trees - and the far views had counted none of it). Pure,
 * made once a recipe.
 * @param {any} recipe world/tamriel/tamrielLands.js LANDS' `flora`
 */
export function landsFloraSpec(recipe) {
  let s = _landsSpecs.get(recipe);
  if (s) return s;
  const c = compileRecipe(recipe), B = LANDS_WOOD_BINS, sum = new Float64Array(B + 2), n = new Float64Array(B + 2), N = 4096;
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let k = 0; k < N; k++) {
    const field = forestQuantile((k + 0.5) / N), w = smooth(FOREST.edge[0], FOREST.edge[1], field);
    const bin = w <= 0 ? 0 : w >= 1 ? B + 1 : 1 + Math.min(B - 1, Math.floor(w * B));
    sum[bin] += recipeWood(c, field); n[bin]++;
  }
  // a bin no quantile fell in (a sliver of FOREST1's edge) reads its nearest neighbour's
  const table = new Float64Array(B + 2);
  for (let b = 0; b < B + 2; b++) {
    let at = b;
    for (let d = 1; !n[at] && d < B + 2; d++) at = n[b - d] ? b - d : n[b + d] ? b + d : at;
    table[b] = n[at] ? sum[at] / n[at] : recipe.woods;
  }
  const share = treesShare(recipe.trees), coverShare = treesShare(recipe.cover);
  const lands = Object.freeze({
    woods: recipe.woods, treeRate: c.treeRate * share, coverRate: c.coverRate * coverShare, ground: c.ground,
    woodOf: (w) => table[w <= 0 ? 0 : w >= 1 ? B + 1 : 1 + Math.min(B - 1, Math.floor(w * B))],
    woodAt: (cover) => recipeWood(c, unpackCover(cover)),   // the zone's own edge on the field's own value (midRingCoverPixel)
  });
  s = Object.freeze({ forests: true, desert: false, treeShare: share, coverShare, lands });
  _landsSpecs.set(recipe, s);
  return s;
}
/** The share of a pool's picks ([archive, record, weight]) that are Trees, by weight (0 for none). */
const treesShare = (picks = []) => {
  const all = picks.reduce((a, p) => a + p[2], 0);
  return all > 0 ? picks.reduce((a, p) => a + (isTreeRecord(p[0], p[1]) ? p[2] : 0), 0) / all : 0;
};
/**
 * TESA-LANDS' second audit (lane D): A ZONE'S TREES AS ITS GROUND STANDS THEM - each Tree of its `trees` and its `cover`,
 * [archive, record, weight], its weight its share of the zone's Trees at its woods (a `trees` pick's at the tree's
 * chance, a `cover` pick's at the cover's - terrainNature.js's tile law at the zone's own woods): what the far views
 * colour their canopy by (render/farFlora.js landTreeArt). Pure.
 * @param {any} recipe LANDS' `flora` @returns {Array<[number, number, number]>}
 */
export function landsTreePicks(recipe) {
  const w = Number.isFinite(recipe.woods) ? recipe.woods : 0;
  const tree = (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * w) * (recipe.treeRate ?? 1);
  const under = (FOREST.plainCover + (FOREST.undergrowth - FOREST.plainCover) * w) * (recipe.coverRate ?? 1);
  const out = [];
  for (const [pool, chance] of [[recipe.trees ?? [], tree], [recipe.cover ?? [], under]]) {
    const all = pool.reduce((a, p) => a + p[2], 0);
    if (all > 0) for (const [a, r, wt] of pool) if (isTreeRecord(a, r)) out.push([a, r, (wt / all) * chance]);
  }
  return out;
}

/** A zone's Trees a tile at its woods' share `wz` (its own - `spec.lands.woodAt`'s) and its ground's shares. Pure. */
export const landsTreesAt = (spec, wz, dirt, grass, stone) => (spec?.lands && (spec.treeShare > 0 || spec.coverShare > 0) ? landsTrees(spec.lands, wz, dirt, grass, stone) : 0);

/**
 * TESA-LANDS (AUDIT): THE FOREST FIELD'S OWN VALUE AT THE MIDDLE RING'S SAMPLES. The packed `wood` is FOREST1's, and a
 * zone's woods read through it are only their expectation given it (landsFloraSpec's woodOf): where FOREST1's field is all
 * plain or all woods - most of the land - every sample read one mean, and the Pinewoods' glades or the Ashlands' few
 * clumps stood the middle ring as an even canopy against the near ground's woods. The field's own value, a byte a sample
 * over LANDS_COVER, lets the zone's own edge be drawn on it (landsFloraSpec's woodAt) - a world field, so the same at a
 * sample two pixels share. midRingFloraPixel's lattice; a pixel of the Bay's (never a zone's) answers nothing.
 */
export const LANDS_COVER = Object.freeze([0.15, 0.85]);
export const packCover = (c) => Math.round(Math.min(1, Math.max(0, (c - LANDS_COVER[0]) / (LANDS_COVER[1] - LANDS_COVER[0]))) * 255);
export const unpackCover = (b) => LANDS_COVER[0] + (b / 255) * (LANDS_COVER[1] - LANDS_COVER[0]);
/** @param {number} px @param {number} py @param {number} [sub] */
export function midRingCoverPixel(px, py, sub = 8) {
  const w = sub + 1, step = WORLD_MAP_TILE_DIM / sub, out = new Uint8Array(w * w);
  if (inBay(px, py)) return out;
  const ox = px * WORLD_MAP_TILE_DIM, oz = -py * WORLD_MAP_TILE_DIM;   // the pixel's first world tile (north up)
  for (let j = 0; j <= sub; j++) for (let i = 0; i <= sub; i++) out[j * w + i] = packCover(forestCover(ox + Math.min(127, i * step), oz + Math.min(127, j * step)));
  return out;
}

/** A zone's Trees a tile at its woods' share `wz` and its ground's shares - landsTiles' own chance (FOREST1's, at the
 *  zone's rate). Pure. */
function landsTrees(L, wz, dirt, grass, stone) {
  const g = L.ground, rates = (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * wz) * L.treeRate + (FOREST.plainCover + (FOREST.undergrowth - FOREST.plainCover) * wz) * L.coverRate;
  return rates * ((g[1] ?? 0) * dirt + (g[2] ?? 0) * grass + (g[3] ?? 0) * stone);
}


/**
 * FAR-TREES (the band past the grid, render/farTrees.js): A PIXEL'S TREES AS THE STREAM WOULD STAND THEM - the pixel's own
 * kernel samples (terrainSampler.js generateSamples, with the landforms the worker holds), its ground classes and their
 * squares (terrainTiles.js generateTileData, assignTiles) and the nature's own layout (terrainNature.js layoutNature:
 * FOREST1's woods with the switch, DFU's scatter without it or on a desert), kept to its Tree records: the very flats a
 * built pixel stands (its own dice, a tile at a time), so where the stream builds the pixel its trees land where the
 * band's stood. What it leaves out is a built pixel's own: a location's clearing and flattening, the roads' paint, a World
 * of Daggerfall site, a neighbour's climate at a border, the jungle's own layout. Answers `[x, y, z, record]` a tree, in
 * the pixel's own frame (x east, z north from its south-west corner; y the ground's height, world units). TESA-LANDS:
 * with `lands` (the row) a pixel past the Bay whose zone lays its own flats lays them (its recipe - landsNine), and a tree
 * of an archive of its own answers its archive with its record, `archive * 256 + record` (bandTreeCode).
 * @param {{ woods: any, px: number, py: number, archive: number, climateType: number, forests: boolean, landforms?: any, lands?: boolean }} o
 */
export function bandTreesPixel({ woods, px, py, archive, climateType, forests, landforms = null, lands = false }) {
  const samples = generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, landforms);
  const tilemap = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM);
  assignTiles(generateTileData(samples, px, py), tilemap, true);
  const nine = lands && !inBay(px, py) ? landsNine(px, py) : null;
  const flats = layoutNature(samples, tilemap, {
    mapPixelX: px, mapPixelY: py, rawWorldHeight: woods.getHeightMapValue(px, py), climateType, locationRect: null,
    forests: forests ? { archive, pois: [] } : null,
    lands: nine?.[4]?.flora ? { nine, blend: false, archive, pois: [], paths: null } : null,   // TESA-LANDS: its zone's own
  });
  const trees = flats.filter((f) => isTreeRecord(f.archive ?? archive, f.record));
  const out = new Float32Array(trees.length * 4);
  trees.forEach((f, k) => out.set([f.x, f.y, f.z, bandTreeCode(archive, f)], k * 4));   // a tree's foot and its art's record - no light (render/lightId.js's seam is the lights')
  return out;
}

/** TESA-LANDS: a band tree's art - its record, or `archive * 256 + record` for a flat of an archive not the pixel's
 *  (`archive`) - and its reading back (bandTreeArt: `[archive, record]`). Pure. */
export const bandTreeCode = (archive, f) => (f.archive != null && f.archive !== archive ? f.archive * 256 + f.record : f.record);
export const bandTreeArt = (archive, code) => (code >= 256 ? [Math.floor(code / 256), code % 256] : [archive, code]);
