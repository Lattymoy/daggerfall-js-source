// @ts-check
// YARDS-FOUND (2026-10-10, from play: "The new stable and transport merchant shops dont show on town maps/overworld"):
// THE YARDS ON THE TOWN MAP. Both town maps draw a town off its blocks' own automap bytes (the classic window -
// ui/exteriorAutomapWindow.js buildExteriorLayout; the held map's sheet - ui/inkTown.js townBytes) and letter the
// buildings of its list, and a yard is neither: its ground is open street to the bytes (a navgrid cell is open only
// where its byte is 0 - world/cityNavigation.js setBlockData - and a yard stands on open cells alone), and no building
// record names it. So a Stable stood in the street and the map showed paving.
//
// The Arena's own law (world/arenaCity.js arenaAutoMap, arenaTownLandmark - ARENA-MAP), taken for the yards: the yard's
// ground is drawn in a shop's byte - the General Store's, the counter that sold the horse and the cart before the yards
// took them (systems/shopStock.js) - so both maps wash it in the shop quarter's colour; and its name stands over its
// middle by the plate law, always, as the colosseum's does (a block row's `places`, beside its `landmark`).
//
// Pure: the host's rows in, new rows out (a block a yard touches has its bytes copied, never written in place - the
// block's own bytes are the navgrid's and the next build's). Not a DFU member. Ledger A (YARDS-FOUND).
import { NAV_CELL, NAV_CELLS_PER_BLOCK } from './cityNavigation.js';
import { BUILDING_TYPES } from './buildingNames.js';
import { yardName, validYardKind } from '../systems/merchantYards.js';

/** The type a yard is drawn and lettered as: the General Store's - a shop's quarter, its colour and its ink. */
export const YARD_MAP_TYPE = BUILDING_TYPES.GeneralStore;
/** The byte a yard's ground is drawn in (an automap byte is its building type + 1). */
export const YARD_MAP_BYTE = YARD_MAP_TYPE + 1;
/** A block's side, metres: its 64 cells of NAV_CELL (1.6 m) - RMB_DIMENSION * 0.025, the plates' own block. */
export const YARD_MAP_BLOCK_M = NAV_CELLS_PER_BLOCK * NAV_CELL;

/**
 * The town map's block rows (`{ x, y, autoMap, landmark }`, the hosts' toggleExteriorAutomap) with the town's yards on
 * them: every cell of a yard's ground (`gx`, `gy` its south-west cell, `nx` by `nz` cells - world/merchantYardSites.js
 * yardSite) drawn in YARD_MAP_BYTE in the block that holds it, the data rows running against +z as the navgrid's do;
 * and its name in `places` of the block its middle (`x`, `z`, the location's frame) stands in, at its place in that
 * block (metres - the landmark's own frame, nameplateAnchor's). `sites` none: the rows as handed.
 * @param {Array<any>} rows @param {Array<any>|null|undefined} sites
 */
export function yardTownBlocks(rows, sites) {
  if (!Array.isArray(rows) || !sites?.length) return rows;
  const N = NAV_CELLS_PER_BLOCK;
  const out = rows.map((r) => ({ ...r }));
  const copied = new Set();
  const rowAt = (bx, by) => out.find((r) => r.x === bx && r.y === by) ?? null;
  for (const s of sites) {
    const kind = validYardKind(s?.kind);
    if (!kind) continue;
    for (let cy = s.gy; cy < s.gy + s.nz; cy++) {
      for (let cx = s.gx; cx < s.gx + s.nx; cx++) {
        const bx = Math.floor(cx / N), by = Math.floor(cy / N);
        const r = rowAt(bx, by);
        if (!r?.autoMap?.length) continue;
        if (!copied.has(r)) { r.autoMap = r.autoMap.slice(); copied.add(r); }
        r.autoMap[(N - 1 - (cy - by * N)) * N + (cx - bx * N)] = YARD_MAP_BYTE;
      }
    }
    const bx = Math.floor(s.x / YARD_MAP_BLOCK_M), by = Math.floor(s.z / YARD_MAP_BLOCK_M);
    const r = rowAt(bx, by);
    if (!r) continue;
    r.places = [...(r.places ?? []), { name: yardName(kind, s.keeper?.name), position: [s.x - bx * YARD_MAP_BLOCK_M, 0, s.z - by * YARD_MAP_BLOCK_M], buildingType: YARD_MAP_TYPE, yard: kind }];
  }
  return out;
}
