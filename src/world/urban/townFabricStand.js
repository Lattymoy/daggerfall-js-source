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
// origin, merged into the pixel's static batch and solid as its blocks' models are. TOWN-BOARDS: on the town's ground
// alone - the terrain job's townGround, the outline TS2 flattens to the level the model stands at (world/townShape.js
// onTownTile, the walkers' law): a yard, a street or a woodpile planned past it stood in the land's slope, its fences
// buried to their top rail or hung over falling ground at a village's and a hamlet's edges; and the job's painted paths
// its roads (TS10, as the walkers and the merchant yards read them) - no yard, fence or woodpile on a painted road.
// KEPT (EVERY ALLOCATION HAS AN OWNER): the plans and their models, by the town's map id, the TOWN_FABRIC_KEEP most
// recently built - a town past them has its model taken off the model door (its GPU mesh is the pixel's hold's, freed with
// the pixel, scenes/dataPipeline.js PLACE-LRU) and is planned again when it is built again, the same plan. A model's id is
// never reused in a session, so no mesh a pixel still holds answers for another town.
// ═══════════════════════════════════════════════════════════════════
import { registerCustomModel, unregisterCustomModel } from '../customModels.js';
import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { provinceKeyBeyondBay } from '../tamriel/tamrielLand.js';
import { CAPITALS, BLOCK_M, capitalBlockLift } from '../tamrielCapitals.js'; // SOLITUDE-RELIEF: a block's tier
import { townWallGatesOf, townWallWaits, townWallOf, townWallCells } from '../townWalls.js'; // ROAD-FOLLOW: a wall still waiting for its roads plans no streets yet
import { NAV_CELL } from '../city/cityNavigation.js';
import { onTownTile } from '../townShape.js';
import { getLocationTerrainTileOrigin } from '../terrain/terrainTiles.js';
import { FABRIC_CELLS, FOOT_FACED, fabricGrid, planSteps, isPortCell } from './townFabric.js';
import { miscModelMatrix } from '../rmbLayout.js'; // AUDIT PROP-GROUND: a foot plate where its block stands it
import {
  townFabricModel,
  townFabricModelSliced,
  fabricFaces,
  FABRIC_PIECES,
  FABRIC_FACE,
  FABRIC_ROAD_Y,
  FABRIC_PAVE_Y,
  FABRIC_LAND_Y,
} from './townFabricModel.js';
import { styleOf } from './urbanRecords.js';

/** The fabric's model ids: past every other custom model's (the capitals' 910xxx, TS4's walls' 1,000,000 + 20 bits - AUDIT
 *  RELEASE R1-1 - and IC-GRAND's families at 3,000,000 and 3,100,000). */
export const TOWN_FABRIC_MODEL_BASE = 5000000;
/** How many towns' plans and models are kept. */
export const TOWN_FABRIC_KEEP = 24;
/** How far in from a city's gate its main street starts, metres. */
export const GATE_IN_M = 12;
/** A port block's name - a cell no fabric is laid on (world/urban/townFabric.js isPortCell; IC-PROPS: it lives there now,
 *  where the yards' law reads it too - world/merchantYards/merchantYardSites.js). */
export { isPortCell };

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
    const rows = Math.min(8, cap.plan.length); // its slice's rows (a shore capital's land slice is the plan's first eight)
    const [ax, ar] = cap.anchor,
      centre = /** @type {[number, number]} */ ([(ax * BLOCK_M) / 1.6, ((rows - ar) * BLOCK_M) / 1.6]);
    return { mains: true, ends: (cap.gates ?? []).map((s) => side[s]).filter(Boolean), centre };
  }
  const gates = dfLocation.outline?.walled ? townWallGatesOf(dfLocation) : null;
  if (gates?.length)
    return {
      mains: true,
      ends: gates.map(
        (g) =>
          /** @type {[number, number]} */ ([
            (g.at[0] - g.out[0] * GATE_IN_M) / 1.6,
            (g.at[1] - g.out[1] * GATE_IN_M) / 1.6,
          ]),
      ),
      centre: mid,
    };
  const type = dfLocation.mapTableData?.locationType;
  if (type === LOCATION_TYPES.TownCity) return { mains: true, ends: [side.N, side.S, side.E, side.W], centre: mid };
  if (type === LOCATION_TYPES.TownHamlet && Math.max(W, H) > FABRIC_CELLS)
    return { mains: true, ends: W >= H ? [side.W, side.E] : [side.S, side.N], centre: mid };
  return { mains: false, ends: [], centre: mid };
}

/** AUDIT PROP-GROUND: a misc model's foot plate (townFabric.js FOOT_FACED.road) where its block stands it - the box round
 *  its rectangle's corners in the block's metres [x0, z0, x1, z1]; null for a model with none. */
export function footPlate(r) {
  const rect = FOOT_FACED.road[r.modelIdNum];
  if (!rect) return null;
  const m = miscModelMatrix(r),
    out = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, z] of [
    [rect[0], rect[1]],
    [rect[2], rect[1]],
    [rect[2], rect[3]],
    [rect[0], rect[3]],
  ]) {
    const wx = m[0] * x + m[8] * z + m[12],
      wz = m[2] * x + m[10] * z + m[14];
    out[0] = Math.min(out[0], wx);
    out[1] = Math.min(out[1], wz);
    out[2] = Math.max(out[2], wx);
    out[3] = Math.max(out[3], wz);
  }
  return out;
}

/** A laid-out block (world/locationLayout.js layoutLocation's) as the plan reads it - its town map, its ground and its
 *  misc models' and flats' places in its own metres; a port cell none. */
export function fabricBlockOf(b) {
  if (!b || isPortCell(b.blockName)) return null;
  const rmb = b.dfBlock?.rmbBlock,
    fh = rmb?.fldHeader;
  if (!fh?.autoMapData) return null;
  const gt = fh.groundData?.groundTiles;
  return {
    automap: fh.autoMapData,
    ground: (tx, ty) => gt?.[tx]?.[ty]?.textureRecord ?? 1,
    records: [
      ...(rmb.misc3dObjectRecords ?? []).map((r) => ({
        x: r.xPos * 0.025,
        z: (r.zPos + 4096) * 0.025,
        id: r.modelIdNum,
        plate: footPlate(r),
      })), // AUDIT PROP-GROUND: FOOT_FACED
      ...(rmb.miscFlatObjectRecords ?? []).map((r) => ({ x: r.xPos * 0.025, z: (r.zPos + 4096) * 0.025 })),
    ],
  };
}

const _fabrics = new Map(); // map id -> { plan, modelId, style, groundKey }
let _next = 0;

/** TOWN-BOARDS: the town's ground and its painted roads under its grid as a key (FNV-1a over its tiles, on and off each)
 *  - a plan is its town's and its ground's; '' where it has neither (a capital: its whole grid its own, before its roads
 *  land). @param {?ArrayLike<number>} ground @param {?ArrayLike<number>} paths @param {{x: number, y: number}} tilePos
 *  @param {number} tw @param {number} th the grid's tiles a side */
export function fabricGroundKey(ground, paths, tilePos, tw, th) {
  if (!ground && !paths) return '';
  let h = 0x811c9dc5;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      h = Math.imul(h ^ (ground && onTownTile(ground, tilePos, x * 4, y * 4) ? 1 : 2), 0x01000193) >>> 0;
      h = Math.imul(h ^ (paths && onTownTile(paths, tilePos, x * 4, y * 4) ? 3 : 4), 0x01000193) >>> 0;
    }
  }
  return h.toString(36);
}

/**
 * A TOWN'S FABRIC: its plan and its model's id, planned when first asked (the plan's steps each a breath apart -
 * `breathe`, the build's) on the town's own ground, kept by its map id (planned again when asked on another ground than
 * the one it was planned on); null for a town the fabric does not dress.
 * @param {any} dfLocation @param {Array<any>} blocks layoutLocation's blocks
 * @param {{ px: number, py: number, breathe?: () => any, ground?: ?ArrayLike<number>, paths?: ?ArrayLike<number> }} at the
 *   town's pixel, the build's breather, and TOWN-BOARDS: its ground (the terrain job's townGround, 128 x 128 tiles - null,
 *   its whole grid) and the roads its terrain painted (the job's paths - null, none)
 */
export async function townFabricFor(dfLocation, blocks, { px, py, breathe = () => null, ground = null, paths = null }) {
  if (!fabricTown(dfLocation)) return null;
  // ROAD-FOLLOW (world/townWalls.js): a walled town whose wall still waits for its pixel's roads has no gates to run its
  // streets to yet - none planned or kept now; its pixel is built again when its roads land, and planned then
  if (dfLocation.outline?.walled && townWallWaits(dfLocation)) return null;
  const ed = dfLocation.exterior.exteriorData,
    tilePos = getLocationTerrainTileOrigin(dfLocation);
  const mapId = (dfLocation.mapTableData?.mapId ?? 0) >>> 0,
    had = _fabrics.get(mapId),
    groundKey = fabricGroundKey(ground, paths, tilePos, ed.width * 16, ed.height * 16);
  if (had && had.groundKey === groundKey) {
    _fabrics.delete(mapId);
    _fabrics.set(mapId, had);
    return had;
  }
  if (had) {
    _fabrics.delete(mapId);
    unregisterCustomModel(had.modelId);
  } // its ground moved under it (the land or its roads landed): planned again
  const at = new Map(blocks.map((b) => [b.y * ed.width + b.x, b]));
  // WALL-FLICKER (bible/03-World/Town-Shapes.md section 15): nothing of it where its wall stands - a gate's floor lies on the
  // town's ground as its setts and cobbles do, a yard's fence ran in a length's face, and each pair drew in one plane;
  // every cell that touches a piece of the wall is off
  const wall = dfLocation.outline?.walled ? townWallOf(dfLocation) : null;
  const under = wall ? townWallCells(wall, ed.width, ed.height, NAV_CELL * Math.SQRT1_2) : null,
    W = ed.width * FABRIC_CELLS;
  const onGround =
    ground || under ? (x, z) => (!ground || onTownTile(ground, tilePos, x, z)) && !under?.[z * W + x] : null;
  const onRoad = paths ? (x, z) => onTownTile(paths, tilePos, x, z) : null;
  const grid = fabricGrid(ed.width, ed.height, (bx, by) => fabricBlockOf(at.get(by * ed.width + bx)), {
    onGround,
    onRoad,
  });
  const { mains, ends, centre } = fabricEnds(dfLocation, grid.W, grid.H);
  const steps = planSteps(grid, { ends, centre, seed: mapId, mains });
  let r = steps.next();
  while (!r.done) {
    await breathe();
    r = steps.next();
  }
  const plan = r.value;
  const province =
    dfLocation.arena?.province ??
    (dfLocation.capital ? CAPITALS[dfLocation.capital.k]?.province : null) ??
    provinceKeyBeyondBay(px, py);
  const style = styleOf(province),
    cobbles = dfLocation.mapTableData?.locationType === LOCATION_TYPES.TownCity;
  // planned meanwhile by another build of it: that one kept, whatever its ground - its model is never pulled from under a
  // build that has it in hand and has not stood it yet (a later build on another ground plans it again)
  const meanwhile = _fabrics.get(mapId);
  if (meanwhile) return meanwhile;
  const modelId = TOWN_FABRIC_MODEL_BASE + _next++;
  // SOLITUDE-RELIEF: a capital on a relief of its own lays each block's pieces on its block's tier (none elsewhere)
  const lift = CAPITALS[dfLocation.capital?.k]?.lift ? (bx, by) => capitalBlockLift(dfLocation, bx, by) : null;
  const opts = (ctx) => ({ cobbles, classicModel: (id) => ctx?.classicModel?.(id) ?? null, lift });
  registerCustomModel(
    modelId,
    (ctx) => townFabricModel(plan, style, opts(ctx)),
    () => true,
    {
      needs: Object.values(FABRIC_PIECES),
      buildSliced: (ctx, breathe) => townFabricModelSliced(plan, style, opts(ctx), breathe), // made a breath at a time as it was planned
    },
  );
  const made = Object.freeze({ plan, modelId, style, groundKey, faces: fabricFaces(plan, style, cobbles).faces }); // AUDIT PROP-GROUND: what is laid, for its flats
  _fabrics.set(mapId, made);
  for (const [id, f] of _fabrics) {
    if (_fabrics.size <= TOWN_FABRIC_KEEP) break;
    _fabrics.delete(id);
    unregisterCustomModel(f.modelId);
  }
  return made;
}

/** AUDIT PROP-GROUND: how far a flat Daggerfall stood on the land rises to stand on the street its fabric lays at
 *  (lx, lz) - the location's metres, x east, z north (the model's own frame): the face's height over the land
 *  (townFabricModel.js FABRIC_LAND_Y), 0 where none is laid or no fabric stands. @param {?{ plan: { W: number, H: number },
 *  faces: Uint8Array }} fabric @param {number} lx @param {number} lz */
export function fabricLift(fabric, lx, lz) {
  if (!fabric?.faces) return 0;
  const { W, H } = fabric.plan,
    x = Math.floor(lx / NAV_CELL),
    z = Math.floor(lz / NAV_CELL);
  if (x < 0 || z < 0 || x >= W || z >= H) return 0;
  const f = fabric.faces[z * W + x];
  return f === FABRIC_FACE.road
    ? FABRIC_ROAD_Y - FABRIC_LAND_Y
    : f === FABRIC_FACE.flags
      ? FABRIC_PAVE_Y - FABRIC_LAND_Y
      : 0;
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
 *  AUDIT BAY-LEFT F3: its `key` the town's shut's (TS10: the roads its terrain painted) and whether its fabric stands, read
 *  when asked - a fabric is planned as its town builds - so the yards' memo (scenes/world.js townPlacesFor) is made again
 *  when either moves; the wrapper had none, and the memo read 'shut' whatever the roads, keeping the yards placed before
 *  they landed. @param {((nav: any) => void) & { key?: string }} shut @param {any} dfLocation */
export const fabricWalkShut = (shut, dfLocation) => {
  const both = (nav) => {
    shut(nav);
    shutTownFabric(nav, dfLocation);
  };
  Object.defineProperty(both, 'key', {
    get: () => `${shut.key ?? 'shut'}|${townFabricOf(dfLocation) ? 'fabric' : ''}`,
  });
  return both;
};

/** Test seam. */
export function _resetTownFabrics() {
  for (const f of _fabrics.values()) unregisterCustomModel(f.modelId);
  _fabrics.clear();
}
