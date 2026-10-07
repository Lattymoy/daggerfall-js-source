// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PUDDLE-DRY (2026-10-07, Mac: "removing the water puddles entirely from town layouts"; asked, "Puddles only" - the
// moats and the docks' water stay - and "Both skins"): A TOWN'S PUDDLES ARE DRY GROUND. THE PORT'S DEPARTURE.
//
// What a puddle is, MEASURED on BLOCKS.BSA (every RMB block's ground, a census in the record, Water-Arc PUDDLE-DRY):
// 920 blocks, 1,311 patches of water (4-connected, a tile counted wet where the draw's corner table gives it any water
// corner - world/waterCorners.js WATER_DRAW_MASK_TABLE, the shore ring part of its pond). 674 of them are ONE tile:
// 632 of those are DFU's shallow-water art (records 8, 9 and 23 - a pool painted on sand or grass, the "one square"
// WATER-PUDDLE drew in its art's shape), the rest a lone shore corner or edge (a sliver) or one of the two lone record-0
// tiles. The rest are ponds a block was laid out with - a water heart in its shore ring, a garden pond, the castles'
// moats (a CASTAA block's runs to 202 tiles with its ring - AUDIT WATER-NEXT m11), Sentinel's harbour - and they stay.
//
// THE RULE: a patch is a puddle when it is ONE tile, or every tile of it is shallow-water art (PUDDLE_RECORDS: DFU's
// PlayerMotor.OnShallowWaterTile records the shore families do not hold, world/waterCorners.js SHALLOW_WHOLE, and
// WATER-DRAW1's SHALLOW_DRAWN). A puddle's tiles take the ground most of their dry neighbours stand on (the eight
// round each, in the block; the most common byte, its turn and flip kept; on a tie the first in the walk's order), so
// a pool in the sand is sand. A patch with no dry neighbour is left as it is.
//
// ONE DOOR. It runs where a block is served (formats/blocksFile.js getBlock, BLOCKS.BSA's and a world-data mod's
// alike), so every reader of the ground - the streamed terrain's stamp (terrainTiles.js setLocationTiles), the fixed
// town (scenes/exterior.js), the streamed town's tilemap (scenes/world.js), the layout (rmbLayout.js
// buildGroundTilemap), the townsfolk's paths (cityNavigation.js), the town map (ui/inkTown.js) - sees one ground, and
// the feet, the grass and the paths follow it with no seam of their own. readClassicBlock (a mod's diff base) stays
// BLOCKS.BSA's bytes.
// ═══════════════════════════════════════════════════════════════════
import { waterCorners, WATER_DRAW_MASK_TABLE } from './waterCorners.js';
import { PUDDLE_RECORDS } from './puddleMask.js';   // the shallow-water art's records, one list (WATER-PUDDLE's)
import { convertTile } from './terrainSurface.js';
import { GROUND_RECORD_LIMIT as RECORD_LIMIT } from './terrainTiles.js';   // AUDIT WATER-NEXT m8: MeshReader.cs:487's marker, one home

/** The shallow-water art: a patch made of these alone is a puddle, whatever its size. */
const PUDDLE = new Set(PUDDLE_RECORDS);
/** An RMB block's ground is 16 tiles a side. */
const DIM = 16;
const NEIGHBOURS = Object.freeze([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]);
const STEPS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

/** Whether one RMB ground tile carries water as the draw sees it (the zero byte is record 0 whether or not it rides
 *  the stamps' 0xFF sentinel: convertTile answers 0 for both). */
export function groundTileWet(tile) {
  if (!tile || tile.textureRecord >= RECORD_LIMIT) return false;
  return waterCorners(convertTile(tile.tileBitfield), WATER_DRAW_MASK_TABLE) !== 0;
}

/** The reader's tile shape for a byte (formats/blocksFile.js _readRmbGroundTilesData). */
const tileOf = (bitfield) => ({
  tileBitfield: bitfield, textureRecord: bitfield & 0x3f, isRotated: (bitfield & 0x40) === 0x40, isFlipped: (bitfield & 0x80) === 0x80,
});

const _dried = new WeakSet();

/**
 * Dry a block's puddles, in place, once (a ground already dried is left). `groundTiles` is the reader's [x][y] grid.
 * @param {Array<Array<{tileBitfield:number,textureRecord:number}>>} groundTiles
 * @returns {number} the tiles dried
 */
export function dryPuddles(groundTiles) {
  if (!Array.isArray(groundTiles) || groundTiles.length !== DIM || _dried.has(groundTiles)) return 0;
  _dried.add(groundTiles);
  const at = (x, y) => (x >= 0 && y >= 0 && x < DIM && y < DIM ? groundTiles[x]?.[y] : null);
  const wet = (x, y) => groundTileWet(at(x, y));
  const seen = new Uint8Array(DIM * DIM);
  const plan = [];
  for (let x = 0; x < DIM; x++) {
    for (let y = 0; y < DIM; y++) {
      if (seen[x * DIM + y] || !wet(x, y)) continue;
      const patch = [];
      const stack = [[x, y]];
      seen[x * DIM + y] = 1;
      while (stack.length) {
        const [cx, cy] = /** @type {number[]} */ (stack.pop());
        patch.push([cx, cy]);
        for (const [dx, dy] of STEPS) {
          const nx = cx + dx, ny = cy + dy;
          if (wet(nx, ny) && !seen[nx * DIM + ny]) { seen[nx * DIM + ny] = 1; stack.push([nx, ny]); }
        }
      }
      if (patch.length > 1 && !patch.every(([px, py]) => PUDDLE.has(at(px, py).textureRecord))) continue;
      for (const [px, py] of patch) {
        const count = new Map();
        for (const [dx, dy] of NEIGHBOURS) {
          const n = at(px + dx, py + dy);
          if (!n || n.textureRecord >= RECORD_LIMIT || groundTileWet(n)) continue;
          count.set(n.tileBitfield, (count.get(n.tileBitfield) ?? 0) + 1);
        }
        let best = -1, most = 0;
        for (const [bits, n] of count) if (n > most) { most = n; best = bits; }
        if (best >= 0) plan.push([px, py, best]);
      }
    }
  }
  for (const [x, y, bits] of plan) groundTiles[x][y] = tileOf(bits);   // written after the walk: every choice is the art's own ground
  return plan.length;
}
