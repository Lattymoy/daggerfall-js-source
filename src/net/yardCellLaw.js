// @ts-check
// YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md): A TOWN'S YARDS, ONE BLOCK AT A TIME.

// The law both ends read - the account service (server-account/src/yardCells.js), which keeps one row per block, and
// the client (scenes/yardCellSync.js), which asks for the blocks within reach. Pure: no clock, no DOM, no network.

// A CELL is one RMB block of one town. A building key is (blockX << 16) + (blockY << 8) + record
// (systems/talk/talkTopics.js makeBuildingKey), so `key >> 8` is the block. The one key outside that form,
// BUILDING_KEY_0 (1 << 24, block 0,0 record 0), lands in a cell of its own (65536). The cell is a partition key, not a
// place: the client finds where a cell stands from the buildings in it.

import { HOME_TOWN_BLOCKS_MAX, HOME_KEY_MAX } from './homeLaw.js';
import { DECOR_YARD_CAP } from './decorLaw.js';

/** The cell a building's yard is kept in. */
export const yardCellOf = (buildingKey) => Math.floor(buildingKey / 256);

/** The widest cell a building key can name: BUILDING_KEY_0's (HOME_KEY_MAX is 1 << 24). */
export const YARD_CELL_MAX = yardCellOf(HOME_KEY_MAX);

/** Whether `cell` can be a yard cell. */
export const yardCellOk = (cell) => Number.isSafeInteger(cell) && cell >= 0 && cell <= YARD_CELL_MAX;

/** The building keys of one cell, inclusive - the key range the service reads it by. */
export function yardCellKeys(cell) {
  const first = cell * 256;
  return [first, first + 255];
}

/** The most cells one request may ask: a whole town - its blocks and BUILDING_KEY_0's cell. A bound the game sets,
 *  not a count chosen for the service. */
export const YARD_CELLS_ASK_MAX = HOME_TOWN_BLOCKS_MAX + 1;

/** The most yard pieces one cell can hold by the key's law: 256 records a block, each a yard of DECOR_YARD_CAP. A
 *  block of Daggerfall's holds at most 32 records (BLOCKS.BSA's list), so a real cell holds 1,920 at most; this is the
 *  read's bound, never a placement's. */
export const YARD_CELL_PIECES_MAX = 256 * DECOR_YARD_CAP;

/**
 * @typedef {object} YardCellAsk
 * @property {number} mapId                  the town, unsigned
 * @property {Array<[number, number]>} cells  each cell asked and the version the asker holds (0 for none), nearest first
 */

/** A request for cells as the service takes it, or null. Each cell once, at most YARD_CELLS_ASK_MAX of them; a
 *  version is a whole number from 0. */
export function yardCellAskOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mapId = raw.mapId;
  if (!Number.isSafeInteger(mapId) || mapId <= 0 || mapId > 0xffffffff) return null;
  if (!Array.isArray(raw.cells) || raw.cells.length === 0 || raw.cells.length > YARD_CELLS_ASK_MAX) return null;
  const seen = new Set();
  /** @type {Array<[number, number]>} */
  const cells = [];
  for (const entry of raw.cells) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [cell, ver] = entry;
    if (!yardCellOk(cell) || !Number.isSafeInteger(ver) || ver < 0) return null;
    if (seen.has(cell)) return null;
    seen.add(cell);
    cells.push([cell, ver]);
  }
  return { mapId, cells };
}
