// @ts-check
// ═══════════════════════════════════════════════════════════════════
// URBANIZER U3 (bible/03-World/Urban-Fabric.md section 6) - A TOWN'S FABRIC STOOD: which towns are dressed, where their
// main streets run, and the plan and model each is given, kept while it is near.
//
// WHICH: every town past the Bay - Arena's places (world/arenaLocations.js), the countryside's towns
// (world/tamrielCountry.js - never a lair) and the capitals but the Imperial City (TESA11's own districts, another's
// work). The Bay's towns are Daggerfall's and stand as Daggerfall lays them.
// WHERE ITS MAIN STREETS RUN (fabricEnds): a city walled on its outline from each of its gates (TS4, world/townWalls.js
// townWallGatesOf - a gate's middle a few paces in), a capital from the middle of each side its gates face
// (world/tamrielCapitals.js CAPITALS `gates`) to its anchor; a city from the middle of each of its four sides to its
// middle, a hamlet from the middle of the two ends of its longer axis; a village and the countryside's lesser places none -
// their ways are Daggerfall's, their yards fenced.
// THE HOST (scenes/pixelBuild.js): a town pixel's build asks townFabricFor as it lays the town out - before its yards and
// its walkers are placed (world/townWalls.js townWalkShut reads shutTownFabric) - and stands the model at the location's
// origin, merged into the pixel's static batch and solid as its blocks' models are.
// KEPT (EVERY ALLOCATION HAS AN OWNER): the plans and their models, by the town's map id, the TOWN_FABRIC_KEEP most
// recently built - a town past them has its model taken off the model door (its GPU mesh is the pixel's hold's, freed with
// the pixel, scenes/dataPipeline.js PLACE-LRU) and is planned again when it is built again, the same plan. A model's id is
// never reused in a session, so no mesh a pixel still holds answers for another town.
// ═══════════════════════════════════════════════════════════════════
import { registerCustomModel, unregisterCustomModel } from '../customModels.js';
import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { provinceKeyBeyondBay } from '../tamriel/tamrielLand.js';
import { CAPITALS, BLOCK_M } from '../tamrielCapitals.js';
import { townWallGatesOf } from '../townWalls.js';
import { FABRIC_CELLS, fabricGrid, planSteps } from './townFabric.js';
import { townFabricModel, townFabricModelSliced, FABRIC_PIECES } from './townFabricModel.js';
import { styleOf } from './urbanRecords.js';

/** The fabric's model ids: past every other custom model's (the capitals' 910xxx, TS4's walls' 1,000,000 + 20 bits - AUDIT
 *  RELEASE R1-1 - and IC-GRAND's families at 3,000,000 and 3,100,000). */
export const TOWN_FABRIC_MODEL_BASE = 5000000;
/** How many towns' plans and models are kept. */
export const TOWN_FABRIC_KEEP = 24;
/** How far in from a city's gate its main street starts, metres. */
export const GATE_IN_M = 12;
/** A port block's name - a cell no fabric is laid on (a left-out cell, a wall's carrier, a capital's own blocks, gardens and
 *  lakes: world/townOutline.js TOWN_OUTLINE_BLOCK, world/townWalls.js townWallBlockName, world/tamrielCapitals.js). */
export const isPortCell = (name) => /^TES[AGLW]/i.test(String(name ?? ''));

/** Is a location a town the fabric dresses (the header's WHICH). */
export function fabricTown(dfLocation) {
  if (!dfLocation?.exterior?.exteriorData) return false;
  if (dfLocation.capital) return dfLocation.capital.k !== 0;
  if (dfLocation.country) return !dfLocation.country.dungeon;
  return !!dfLocation.arena;
}

/**
 * WHERE A TOWN'S MAIN STREETS RUN: its ends and its middle, in cells of its grid (x east, z north from its south-west),
 * and whether it has main streets at all.
 * @param {any} dfLocation @param {number} W @param {number} H its grid's cells
 * @returns {{ mains: boolean, ends: Array<[number, number]>, centre: [number, number] }}
 */
export function fabricEnds(dfLocation, W, H) {
  const mid = /** @type {[number, number]} */ ([W / 2, H / 2]);
  /** @type {Record<string, [number, number]>} */
  const side = { N: [W / 2, H], S: [W / 2, 0], E: [W, H / 2], W: [0, H / 2] };
  if (dfLocation.capital) {
    const cap = CAPITALS[dfLocation.capital.k];
    if (!cap) return { mains: false, ends: [], centre: mid };
    const rows = Math.min(8, cap.plan.length);   // its slice's rows (a shore capital's land slice is the plan's first eight)
    const [ax, ar] = cap.anchor, centre = /** @type {[number, number]} */ ([(ax * BLOCK_M) / 1.6, ((rows - ar) * BLOCK_M) / 1.6]);
    return { mains: true, ends: (cap.gates ?? []).map((s) => side[s]).filter(Boolean), centre };
  }
  const gates = dfLocation.outline?.walled ? townWallGatesOf(dfLocation) : null;
  if (gates?.length) return { mains: true, ends: gates.map((g) => /** @type {[number, number]} */ ([(g.at[0] - g.out[0] * GATE_IN_M) / 1.6, (g.at[1] - g.out[1] * GATE_IN_M) / 1.6])), centre: mid };
  const type = dfLocation.mapTableData?.locationType;
  if (type === LOCATION_TYPES.TownCity) return { mains: true, ends: [side.N, side.S, side.E, side.W], centre: mid };
  if (type === LOCATION_TYPES.TownHamlet && Math.max(W, H) > FABRIC_CELLS) return { mains: true, ends: W >= H ? [side.W, side.E] : [side.S, side.N], centre: mid };
  return { mains: false, ends: [], centre: mid };
}

/** A laid-out block (world/locationLayout.js layoutLocation's) as the plan reads it - its town map, its ground and its
 *  misc models' and flats' places in its own metres; a port cell none. */
export function fabricBlockOf(b) {
  if (!b || isPortCell(b.blockName)) return null;
  const rmb = b.dfBlock?.rmbBlock, fh = rmb?.fldHeader;
  if (!fh?.autoMapData) return null;
  const gt = fh.groundData?.groundTiles;
  return {
    automap: fh.autoMapData,
    ground: (tx, ty) => gt?.[tx]?.[ty]?.textureRecord ?? 1,
    records: [...(rmb.misc3dObjectRecords ?? []), ...(rmb.miscFlatObjectRecords ?? [])].map((r) => ({ x: r.xPos * 0.025, z: (r.zPos + 4096) * 0.025 })),
  };
}

const _fabrics = new Map();   // map id -> { plan, modelId, style }
let _next = 0;

/**
 * A TOWN'S FABRIC: its plan and its model's id, planned when first asked (the plan's steps each a breath apart -
 * `breathe`, the build's), kept by its map id; null for a town the fabric does not dress.
 * @param {any} dfLocation @param {Array<any>} blocks layoutLocation's blocks
 * @param {{ px: number, py: number, breathe?: () => any }} at the town's pixel, and the build's breather
 */
export async function townFabricFor(dfLocation, blocks, { px, py, breathe = () => null }) {
  if (!fabricTown(dfLocation)) return null;
  const mapId = (dfLocation.mapTableData?.mapId ?? 0) >>> 0, had = _fabrics.get(mapId);
  if (had) { _fabrics.delete(mapId); _fabrics.set(mapId, had); return had; }
  const ed = dfLocation.exterior.exteriorData, at = new Map(blocks.map((b) => [b.y * ed.width + b.x, b]));
  const grid = fabricGrid(ed.width, ed.height, (bx, by) => fabricBlockOf(at.get(by * ed.width + bx)));
  const { mains, ends, centre } = fabricEnds(dfLocation, grid.W, grid.H);
  const steps = planSteps(grid, { ends, centre, seed: mapId, mains });
  let r = steps.next();
  while (!r.done) { await breathe(); r = steps.next(); }
  const plan = r.value;
  const province = dfLocation.arena?.province ?? (dfLocation.capital ? CAPITALS[dfLocation.capital.k]?.province : null) ?? provinceKeyBeyondBay(px, py);
  const style = styleOf(province), cobbles = dfLocation.mapTableData?.locationType === LOCATION_TYPES.TownCity;
  if (_fabrics.has(mapId)) return _fabrics.get(mapId);   // planned meanwhile by another build of it
  const modelId = TOWN_FABRIC_MODEL_BASE + _next++;
  const opts = (ctx) => ({ cobbles, classicModel: (id) => ctx?.classicModel?.(id) ?? null });
  registerCustomModel(modelId, (ctx) => townFabricModel(plan, style, opts(ctx)), () => true, {
    needs: Object.values(FABRIC_PIECES),
    buildSliced: (ctx, breathe) => townFabricModelSliced(plan, style, opts(ctx), breathe),   // made a breath at a time as it was planned
  });
  const made = Object.freeze({ plan, modelId, style });
  _fabrics.set(mapId, made);
  for (const [id, f] of _fabrics) {
    if (_fabrics.size <= TOWN_FABRIC_KEEP) break;
    _fabrics.delete(id);
    unregisterCustomModel(f.modelId);
  }
  return made;
}

/** A town's fabric as kept (null: none planned, or let go). */
export const townFabricOf = (dfLocation) => _fabrics.get((dfLocation?.mapTableData?.mapId ?? 0) >>> 0) ?? null;

/** THE WALKERS (world/townWalls.js townWalkShut): a town's walk grid shut where its fabric shuts it - a fence's yard side,
 *  a dead end's wall. @param {{ grid: Uint8Array }} nav @param {any} dfLocation */
export function shutTownFabric(nav, dfLocation) {
  const f = townFabricOf(dfLocation);
  if (!f || nav.grid.length !== f.plan.shut.length) return;
  for (let i = 0; i < f.plan.shut.length; i++) if (f.plan.shut[i]) nav.grid[i] = 0;
}

/** A town's walk shut (world/townWalls.js townWalkShut's) with its fabric's after it - the pixel build's one shut.
 *  @param {(nav: any) => void} shut @param {any} dfLocation */
export const fabricWalkShut = (shut, dfLocation) => (nav) => { shut(nav); shutTownFabric(nav, dfLocation); };

/** Test seam. */
export function _resetTownFabrics() {
  for (const f of _fabrics.values()) unregisterCustomModel(f.modelId);
  _fabrics.clear();
}
