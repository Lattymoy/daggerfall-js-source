// T1 towns: CityNavigation (DFU CityNavigation.cs, MIT Daggerfall
// Workshop) - the wandering-NPC navgrid. "Combines inverse of automap
// to carve out navgrid then sets weighting by tile type": per RMB
// block, the 64x64 AutoMapData marks covered cells (buildings/models/
// flats - any nonzero byte blocks), and the walkable remainder takes
// its weight from the 16x16 ground tilemap (each ground tile spans
// 4x4 navgrid cells): Water family 0 (never), Stone 4, Dirt 6,
// Grass 12, Road family 15, everything else 7. Stored `weight << 4`
// with the low nibble as tile flags (Occupied = one mobile owns the
// tile). A navgrid cell is 64 classic units = 1.6 world units
// (DaggerfallUnitsPerTile); positions convert through the scene's
// block origins with the SAME direct tile->world mapping the
// rendered ground uses (probe-verified; DFU's own world-space
// gymnastics differ only by its floating-origin bookkeeping).

import { RMB_SIDE } from './locationLayout.js';   // 4096 * scale = 102.4, the city block side

export const NAV_CELLS_PER_BLOCK = 64;
export const NAV_CELL = RMB_SIDE / NAV_CELLS_PER_BLOCK;   // 1.6
export const HALF_CELL = NAV_CELL / 2;
export const TILE_FLAG_OCCUPIED = 1;

// GetTileWeight, verbatim (TileTypes -> weight).
export function tileWeight(tile) {
  switch (tile) {
    case 0: case 5: case 6: case 20: case 21: case 30: case 31:
      return 0;    // the Water family - never walk
    case 3: return 4;    // Stone hurts our feet, but walkable
    case 1: return 6;    // Dirt is OK
    case 2: return 12;   // Grass is nice!
    case 46: case 47: case 55: return 15;   // Roads are great!
    default: return 7;   // Everything else is average
  }
}

export class CityNavigation {
  /** @param blocksW/blocksH the location's block grid dimensions */
  constructor(blocksW, blocksH) {
    this.width = blocksW * NAV_CELLS_PER_BLOCK;
    this.height = blocksH * NAV_CELLS_PER_BLOCK;
    this.grid = new Uint8Array(this.width * this.height);
  }

  /** SetRMBData, verbatim carve: autoMap nonzero blocks the cell;
   *  weight from groundTiles[x>>2][y>>2] (textureRecord & 0x3f).
   *  autoMap = the 64x64 Uint8 automap (RMB-internal rows);
   *  groundTile(tx, ty) reads the block's OWN 16x16 grid in the same
   *  RMB frame. The RMB row axis is INVERTED vs world z - the
   *  rendered tilemap reads srcTiles[tx][15 - ty] (exterior.js's
   *  ground loop), so the navgrid applies the SAME per-block flip
   *  here and navToWorld stays direct. */
  setBlockData(xBlock, yBlock, autoMap, groundTile) {
    for (let y = 0; y < NAV_CELLS_PER_BLOCK; y++) {
      const worldRow = yBlock * NAV_CELLS_PER_BLOCK + (NAV_CELLS_PER_BLOCK - 1 - y);
      for (let x = 0; x < NAV_CELLS_PER_BLOCK; x++) {
        if (autoMap[y * NAV_CELLS_PER_BLOCK + x] !== 0) continue;   // covered: stays 0
        const w = tileWeight(groundTile(x >> 2, y >> 2) & 0x3f);
        this.grid[worldRow * this.width + (xBlock * NAV_CELLS_PER_BLOCK + x)] = (w << 4) & 0xff;
      }
    }
  }

  inBounds(gx, gy) { return gx >= 0 && gy >= 0 && gx < this.width && gy < this.height; }
  weightAt(gx, gy) { return this.inBounds(gx, gy) ? this.grid[gy * this.width + gx] >> 4 : 0; }
  occupied(gx, gy) { return this.inBounds(gx, gy) ? (this.grid[gy * this.width + gx] & TILE_FLAG_OCCUPIED) !== 0 : false; }
  setOccupied(gx, gy) { if (this.inBounds(gx, gy)) this.grid[gy * this.width + gx] |= TILE_FLAG_OCCUPIED; }
  clearOccupied(gx, gy) { if (this.inBounds(gx, gy)) this.grid[gy * this.width + gx] &= ~TILE_FLAG_OCCUPIED; }

  /** Nav cell -> world xz (cell center). */
  navToWorld(gx, gy) { return [gx * NAV_CELL + HALF_CELL, gy * NAV_CELL + HALF_CELL]; }
  worldToNav(x, z) { return [Math.floor(x / NAV_CELL), Math.floor(z / NAV_CELL)]; }

  /** GetRandomSpawnPosition, verbatim: up to maxAttempts uniform
   *  probes in the radius box; any weight > 0 cell wins. */
  getRandomSpawnPosition(originGx, originGy, radius = 64, maxAttempts = 10, rand = Math.random) {
    for (let i = 0; i <= maxAttempts; i++) {
      const gx = originGx + Math.floor(rand() * (radius * 2 + 1)) - radius;
      const gy = originGy + Math.floor(rand() * (radius * 2 + 1)) - radius;
      if (this.weightAt(gx, gy) > 0) return [gx, gy];
    }
    return null;
  }
}
