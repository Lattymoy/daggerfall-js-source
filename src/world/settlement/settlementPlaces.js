// @ts-check
// THE SETTLEMENTS THAT STAND, AS DATA. settlements.json
// publishes each one's inputs and nothing derived from the player's ground: its name, kind, style, seed, its point on the
// map picture (so it keeps to its land whatever the fit), its site in its pixel, the structure fixed by the toolchain (its
// layout and centre, a river town's shore) and its key ledger. Every client lays it out on its own ground and agrees.
// Its map ids are a lane of their own, 0x342, past the capitals' 0x341. Worker-safe: world/ alone.
import DATA from './settlements.json' with { type: 'json' };
import { pictureToBay, inBay, tamrielFit } from '../tamriel/tamrielFrame.js';
import { worldPixelKey } from '../worldWide/worldGrid.js';

/** The settlements' lane of map ids (world/worldWide/worldLanes.js: the countryside 0x300-0x33f, lairs 0x340, capitals 0x341). */
export const SETTLEMENT_LANE = 0x342;
/** The registry's name for this list (world/worldWide/worldPlaces.js registerLive). */
export const SETTLEMENTS_SOURCE = 'settlements';
/** Raised when a row's shape changes. */
export const SETTLEMENTS_DATA_VERSION = 1;
/** A settlement's map id by its ordinal: the lane, the made-place flag (its low 20 bits past every Bay pixel's), the ordinal. */
export const settlementPlaceId = (/** @type {number} */ ordinal) => ((SETTLEMENT_LANE << 20) | 0x80000 | (ordinal & 0x7ffff)) >>> 0;
/** @param {unknown} id */
export const isSettlementPlaceId = (id) => ((Number(id) >>> 20) & 0xfff) === SETTLEMENT_LANE && (Number(id) & 0x80000) !== 0;

/**
 * @typedef {{ ordinal: number, name: string, province: string, type: number, archetype: string, style: string, seed: number,
 *   at: [number, number], site: { east: number, north: number, radius: number }, fix?: { layout?: string, centre?: [number, number],
 *   shore?: { dir: [number, number], at: number } }, params?: any, roads?: number[], ledger?: { next: number, keys: Record<string, number>, retired: number[] } }} SettlementRow
 */
/** @type {readonly SettlementRow[]} */
export const SETTLEMENT_ROWS = Object.freeze(/** @type {SettlementRow[]} */ (/** @type {any} */ (DATA.settlements ?? [])).map((r) => Object.freeze(r)));

/** A row's pixel under the fit now: its picture point in the Bay's coordinates. @param {SettlementRow} row */
export function settlementPixel(row) {
  const [x, y] = pictureToBay(row.at[0], row.at[1]);
  return [Math.floor(x), Math.floor(y)];
}

let _byPixel = null, _fitSeen = null;
/** The settlement on a pixel, or null: never on the Bay, whose ground DFU's places hold. @param {number} px @param {number} py */
export function settlementOnPixel(px, py) {
  if (_fitSeen !== tamrielFit()) {
    _fitSeen = tamrielFit();
    _byPixel = new Map();
    for (const row of SETTLEMENT_ROWS) {
      const [x, y] = settlementPixel(row);
      if (!inBay(x, y)) _byPixel.set(worldPixelKey(x, y), row);
    }
  }
  return _byPixel.get(worldPixelKey(px, py)) ?? null;
}

/** The generator's input for a row on its pixel. @param {SettlementRow} row @param {number} px @param {number} py */
export function settlementInput(row, px, py) {
  return {
    place: settlementPlaceId(row.ordinal), origin: { px, py, east: 0, north: 0 }, seed: row.seed, archetype: row.archetype, style: row.style,
    site: row.site, fix: row.fix, params: row.params ?? {}, roads: row.roads ?? [],
    ledger: row.ledger ? { place: settlementPlaceId(row.ordinal), next: row.ledger.next, keys: row.ledger.keys, retired: row.ledger.retired } : undefined,
  };
}

/** The registry's rows (world/worldWide/worldPlaces.js PlaceRow): a place a pixel, no RMB location behind it. */
export function settlementPlaceRows() {
  return SETTLEMENT_ROWS.map((row) => {
    const [px, py] = settlementPixel(row);
    return { mapId: settlementPlaceId(row.ordinal), name: row.name, px, py, type: row.type, w: 1, h: 1 };
  }).filter((r) => !inBay(r.px, r.py));
}
