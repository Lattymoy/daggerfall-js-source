// THE WATER CORNERS (MAC2, 2026-09-11): which corners of a terrain tile
// stand in water, by the CONVERTED tile byte - lifted out of
// render/waterSurface.js (WATER1) into a leaf the render pass and the
// player's feet share. The surface pass draws water where this table
// says; the exterior surface model (player/exteriorSurface.js) now
// swims the player where the same table puts water under the feet, so
// the picture and the physics cannot disagree by construction.
//
// WHICH TEXEL IS WATER. The tile byte says (the same byte the terrain
// pass decodes: record = data >> 2, transform = data & 3), through a
// 256-entry table of WATER CORNERS: which of the tile's four corners,
// in the TILEMAP'S OWN FRAME, stand in water. Record 0 is all four.
// The shore records are the marching-squares transitions
// (world/terrainTiles.js createLookupTable, DFU's AssignTilesJob): a
// shape's bits name the corners that are dirt, and the table maps that
// shape to a record plus its rotate/flip bits - so the table inverts
// exactly: the byte a shape wrote gets the shape's water corners back.
// The river painter (world/roadPainter.js) writes the same records with
// the same bits, and the water-grass (20-22, 49) and water-stone
// (30-32, 50) twins of the water-dirt shapes by the same columns, so
// they take the same corners. A shore record the painters never write
// as a SHAPE (8, 23, 33-36: town docks, moats and puddles) is one of
// DFU's own shallow-water tiles - PlayerMotor.OnShallowWaterTile
// (:551-563), "determined by if the water design takes up the majority
// of the texture" - and takes all four corners; its corner geometry is
// unknown here, and a majority-water tile whole is the nearer reading
// of its art than a bare classic tile. Record 9 is not in DFU's list
// and takes no water.
//
// WATER4 (2026-09-11): this table is the FALLBACK now. Where an
// archive's own bitmaps are read, world/waterArt.js decides the water
// by the art - its outline, its puddles - and hands the pass, the
// basin and the feet its own tables; this one draws only where no art
// is loaded (the tests, the lab's `?noart`).
import { createLookupTable } from './terrainTiles.js';
import { convertTile, WATER_TILE_INDEX } from './terrainSurface.js';

/** The water-dirt shore family and its water-grass / water-stone twins,
 *  by column: corner, edge, three-corner, saddle - the painter's own
 *  columns (roadPainter.js STREAM_TILES / RIVER_TILES). */
export const SHORE_FAMILIES = Object.freeze([
  Object.freeze([5, 6, 7, 48]),
  Object.freeze([20, 21, 22, 49]),
  Object.freeze([30, 31, 32, 50]),
]);
/** DFU's shallow-water records the painters never write as a shape -
 *  PlayerMotor.OnShallowWaterTile's list (:551-563) minus the shore
 *  families above (5, 6, 20, 21, 30, 31, 49, whose corners the table
 *  knows). Drawn whole (see the header). */
export const SHALLOW_WHOLE = Object.freeze([8, 23, 33, 34, 35, 36]);

/**
 * The 256-entry water-corner table, indexed by the CONVERTED tile byte
 * (record << 2 | transform). Bits: 1 = corner (0,0), 2 = (1,0),
 * 4 = (0,1), 8 = (1,1), in the tilemap's frame (x along the tile row,
 * y along the column - AssignTilesJob's b0..b3).
 */
export function buildWaterMaskTable() {
  const table = new Uint8Array(256);
  for (let t = 0; t < 4; t++) table[(WATER_TILE_INDEX << 2) | t] = 0xF;
  const lookup = createLookupTable();
  for (let shape = 0; shape < 16; shape++) {
    const raw = lookup[shape];               // ring 0: water below, dirt above
    const record = raw & 0x3f;
    const k = SHORE_FAMILIES[0].indexOf(record);
    if (k < 0) continue;                      // shape 0 is bare water (record 0, above), 15 bare dirt
    const t = convertTile(raw) & 3;
    const water = (~shape) & 0xF;             // the shape's bits are the DIRT corners
    for (const family of SHORE_FAMILIES) table[(family[k] << 2) | t] = water;
  }
  for (const r of SHALLOW_WHOLE) for (let t = 0; t < 4; t++) table[(r << 2) | t] = 0xF;   // MAC2: the docks, moats and puddles, whole
  return table;
}

export const WATER_MASK_TABLE = buildWaterMaskTable();

/** The table packed eight nibbles to a uint, as the shader's
 *  `uvec4 uWaterMask[8]` takes it: entry i is word i >> 3, nibble i & 7. */
export function packWaterMask(table = WATER_MASK_TABLE) {
  const words = new Uint32Array(32);
  for (let i = 0; i < 256; i++) words[i >> 3] |= (table[i] & 0xF) << ((i & 7) * 4);
  return words;
}


/** The water corners of one converted byte (the shader's own lookup, in JS). */
export const waterCorners = (convertedByte, table = WATER_MASK_TABLE) => table[convertedByte & 0xff];

/** The bilinear coverage the shader computes at (fx, fy) inside a tile -
 *  the JS twin of this file's own GLSL `coverage()` (the corner-bit
 *  order bit0=(0,0), bit1=(1,0), bit2=(0,1), bit3=(1,1)). No production
 *  caller: test/water.test.js holds the two bodies against each other. */
export function waterCoverage(mask, fx, fy) {
  const c00 = mask & 1, c10 = (mask >> 1) & 1, c01 = (mask >> 2) & 1, c11 = (mask >> 3) & 1;
  const top = c00 + (c10 - c00) * fx;
  const bottom = c01 + (c11 - c01) * fx;
  return top + (bottom - top) * fy;
}
