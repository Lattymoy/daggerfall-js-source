// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TOWN-SHAPES TS3 (2026-10-25, the owner: "IC should be round, give other
// towns unique shapes. Its time to move away from perfect squares"; shown
// both ways, the mixed one: "#1 but players cant own a home yet outside the
// bay?"; bible/03-World/Town-Shapes.md TS3) - A TOWN PAST THE BAY LAID AS ITS
// OWN OUTLINE OF BLOCKS.
//
// DFU's reference: a town is its MAPS.BSA row's whole rectangle of blocks
// (DaggerfallLocation, RMBLayout - every cell of the row's grid laid).
//
// DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): a town past the Bay
// (a clone of one of the game's own - world/arenaLocations.js,
// world/tamrielCountry.js) keeps a blob of its template's cells on its own
// seed (its map id): the rim wandering by bearing (lobes, phase and depth off
// the seed, a value noise on top - world/townShape.js shapeWander), always one
// piece, and always holding one of each named building its template holds (a
// guild's hall, a god's temple, a shop of each kind, its tavern, its palace).
// Each cell it leaves out is open land (TOWN_OUTLINE_BLOCK: no tile of its
// own - the land's - no tree, no building, no town-map byte). The buildings a
// left-out cell drew are taken off the town's list - exactly those (systems/
// talk/talkTopics.js drawNamedBuildings; the arena's law, world/arena/
// arenaCity.js standArenaInLocation), so every kept building keeps the name,
// the guild and the key (its cell and record) it always had. A walled
// template's wall ring is left out with its cells: its walls are its
// outline's (TS4, world/townWalls.js - its south-west cell, the ring's corner,
// the block that carries them).
//
// THE BAY'S TOWNS KEEP EVERY BLOCK (a home there is its town's map id and its
// building's key - net/homeLaw.js); past the Bay no home can stand before
// WW7-5 deploys, and this ships with it, so no home is ever in a cell left
// out. Pure - the host (scenes/tamrielPlacesHost.js) lays a clone's outline
// as it stands it.
// ═══════════════════════════════════════════════════════════════════
import { shapeWander, isWallBlock, unwalledLocation } from './townShape.js';

export { unwalledLocation }; // TS7: a Bay city walled on its outline, read as its template (world/townShape.js)
import { drawNamedBuildings, blockBuildingCount, UNCARRIED_GUILD_FACTIONS } from '../systems/talk/talkTopics.js';
import { BUILDING_TYPES, isNamedBuildingType } from './buildingNames.js';
import {
  registerPortBlock,
  installWorldDataReplacement,
  registerLocationEdit,
} from '../formats/worldData/worldDataReplacement.js';
import { townWallBlockName, registerTownWall } from './townWalls.js'; // TS4: a walled city's south-west cell carries its wall; TS7: the Bay's too

/** THE OPEN CELL: a block of the port's own a town past the Bay leaves where it lays no block of its template - every
 *  ground tile record 63 (past GROUND_RECORD_LIMIT, world/terrain/terrainTiles.js: never stamped - the land's own tile),
 *  no tree, no town-map byte, no building, no model, no flat. Its index past the castles' (world/capitalCastles.js
 *  CASTLE_BLOCK_INDEX). */
export const TOWN_OUTLINE_BLOCK = 'TESAOPEN.RMB';
export const TOWN_OUTLINE_BLOCK_INDEX = 906000;
/** The open cell's ground: a tile record no stamp lays (GROUND_RECORD_LIMIT 56 and up, inside the bitfield's six bits). */
const OPEN_TILE = 63;

/** THE BLOB'S MEASURES, in the grid's own half-extents (a cell's centre at 1 on the rim of its grid's rectangle): the rim's
 *  reach, the lobes' depth (`depth[0]` and up to `depth[1]` off the seed), their count (`lobes[0]` and up to two more), the
 *  noise's depth and cell (in a cell's sevenths), the smallest grid - in cells a side, wall ring aside - a town is
 *  shaped on (a town of two by two keeps every cell), and the turns of its lobes a town tries (`turns` over half a turn:
 *  the first that keeps one of each kind of its buildings - townOutlineCells). */
/** @typedef {{ reach: number, depth: readonly number[], lobes: readonly number[], noise: number, noiseCell: number, min: number, turns: number }} OutlineMeasures */
/** @type {Readonly<OutlineMeasures>} */
export const TOWN_OUTLINE = Object.freeze({
  reach: 0.98,
  depth: Object.freeze([0.14, 0.24]),
  lobes: Object.freeze([3, 5]),
  noise: 0.08,
  noiseCell: 9,
  min: 3,
  turns: 8,
});
/** TS5 (the owner: "with the outskirt locations being circular also"): a ROUND town's - the Imperial City's outskirts
 *  (world/imperialCity.js IMPERIAL_OUTSKIRTS) - no lobe and no noise, its rim within a ring of its grid: a three by three
 *  leaves its corners out. */
/** @type {Readonly<OutlineMeasures>} */
export const ROUND_OUTLINE = Object.freeze({ ...TOWN_OUTLINE, reach: 0.9, depth: Object.freeze([0, 0]), noise: 0 });

/** The named building types whose every faction is a kind of its own (a guild's hall is the Mages' or the Fighters', a
 *  temple a god's) - the rest one kind a type. */
const BY_FACTION = /** @type {Set<number>} */ (new Set([BUILDING_TYPES.GuildHall, BUILDING_TYPES.Temple]));
/** A location's building's kind - what a town past the Bay always keeps one of. @param {{ buildingType: number, factionId?: number }} b */
export const buildingKind = (b) =>
  BY_FACTION.has(b.buildingType) ? `${b.buildingType}:${b.factionId ?? 0}` : `${b.buildingType}`;

/**
 * THE BLOB: the cells of a `w` x `h` grid a town keeps (1) on its seed - `isWall(bx, by)` a wall ring's cell (never kept:
 * its walls are its outline's). A cell is kept where its centre, in the half-extents of the grid's cells that are no
 * wall's, is within the rim's reach at its bearing; a grid narrower than TOWN_OUTLINE.min both ways keeps every cell.
 * `turn` turns the lobes by that many TOWN_OUTLINE.turns of half a turn; `O` the measures (TS5: ROUND_OUTLINE a round town's).
 * @param {number} w @param {number} h @param {number} seed @param {(bx: number, by: number) => boolean} [isWall]
 * @param {number} [turn] @param {Readonly<OutlineMeasures>} [O]
 * @returns {Uint8Array} row-major from the south-west (the grid's own order)
 */
export function outlineCells(w, h, seed, isWall = () => false, turn = 0, O = TOWN_OUTLINE) {
  const keep = new Uint8Array(w * h);
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      if (isWall(bx, by)) continue;
      keep[by * w + bx] = 1;
      x0 = Math.min(x0, bx);
      x1 = Math.max(x1, bx);
      y0 = Math.min(y0, by);
      y1 = Math.max(y1, by);
    }
  }
  const iw = x1 - x0 + 1,
    ih = y1 - y0 + 1;
  if (!(iw >= O.min || ih >= O.min)) return keep;
  const s = seed >>> 0,
    [dLo, dHi] = O.depth,
    [lLo, lHi] = O.lobes;
  const lobes = lLo + (s % (lHi - lLo + 1)),
    phase = (((s >>> 3) % 360) * Math.PI) / 180 + (turn * Math.PI) / O.turns;
  const depth = dLo + (((s >>> 9) % 10) / 9) * (dHi - dLo);
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    hx = Math.max(0.5, iw / 2),
    hy = Math.max(0.5, ih / 2);
  for (let by = y0; by <= y1; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      const i = by * w + bx;
      if (!keep[i]) continue;
      const dx = (bx - cx) / hx,
        dy = (by - cy) / hy;
      const rim =
        O.reach +
        depth * Math.sin(lobes * Math.atan2(dy, dx) + phase) +
        O.noise * shapeWander(s, bx * 7, by * 7, O.noiseCell);
      if (Math.hypot(dx, dy) > rim) keep[i] = 0;
    }
  }
  return keep;
}

/** The 4-connected pieces of a grid's kept cells, each a list of its cells. */
function pieces(keep, w, h) {
  const seen = new Uint8Array(w * h),
    out = [];
  for (let i = 0; i < w * h; i++) {
    if (!keep[i] || seen[i]) continue;
    const piece = [],
      stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = /** @type {number} */ (stack.pop()),
        x = c % w,
        y = (c - x) / w;
      piece.push(c);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const n = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && keep[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    out.push(piece);
  }
  return out;
}

/**
 * THE BLOB MADE WHOLE: `keep` (outlineCells') given back each cell the town's kinds need (`kindsOf(i)` a cell's kinds - one
 * of each kind the grid holds stays: the left-out cell holding it nearest the grid's centre, the lower index on a tie),
 * then joined into one piece - each piece apart from the largest joined to it by the cells of a shortest way between
 * them (never through a wall's). In place; answers `keep`.
 * @param {Uint8Array} keep @param {number} w @param {number} h @param {(i: number) => Iterable<string>} kindsOf
 * @param {(bx: number, by: number) => boolean} [isWall]
 */
export function wholeOutline(keep, w, h, kindsOf, isWall = () => false) {
  const cx = (w - 1) / 2,
    cy = (h - 1) / 2;
  const far = (i) => Math.hypot((i % w) - cx, Math.floor(i / w) - cy);
  const kept = new Set(),
    holders = new Map();
  for (let i = 0; i < w * h; i++) {
    for (const k of kindsOf(i)) {
      if (keep[i]) kept.add(k);
      else if (!holders.has(k) || far(i) < far(holders.get(k))) holders.set(k, i);
    }
  }
  for (const [k, i] of holders) if (!kept.has(k)) keep[i] = 1;
  const open = (i) => !isWall(i % w, Math.floor(i / w));
  for (let parts = pieces(keep, w, h); parts.length > 1; parts = pieces(keep, w, h)) {
    parts.sort((a, b) => b.length - a.length || a[0] - b[0]);
    const main = new Set(parts[0]),
      from = new Int32Array(w * h).fill(-1),
      queue = [...parts[0]];
    for (const i of queue) from[i] = i;
    let hit = -1;
    for (let q = 0; q < queue.length && hit < 0; q++) {
      const c = queue[q],
        x = c % w,
        y = (c - x) / w;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || from[n] >= 0 || !open(n)) continue;
        from[n] = c;
        if (keep[n] && !main.has(n)) {
          hit = n;
          break;
        }
        queue.push(n);
      }
    }
    if (hit < 0) break; // a piece no way reaches (walled off): left as it is
    for (let c = from[hit]; !main.has(c); c = from[c]) keep[c] = 1;
  }
  return keep;
}

/**
 * A TOWN'S CELLS: its blob at the first turn of its lobes (outlineCells, TOWN_OUTLINE.turns of them) that keeps one of each
 * kind its grid holds - else the turn that leaves the fewest kinds out, the first on a tie - made whole (wholeOutline).
 * @param {number} w @param {number} h @param {number} seed @param {(i: number) => string[]} kindsOf a cell's kinds
 * @param {(bx: number, by: number) => boolean} [isWall] @param {Readonly<OutlineMeasures>} [O] the measures (outlineCells')
 */
export function townOutlineCells(w, h, seed, kindsOf, isWall = () => false, O = TOWN_OUTLINE) {
  const all = new Set();
  for (let i = 0; i < w * h; i++) for (const k of kindsOf(i)) all.add(k);
  let best = null,
    bestMissing = Infinity;
  for (let turn = 0; turn < O.turns && bestMissing > 0; turn++) {
    const keep = outlineCells(w, h, seed, isWall, turn, O),
      kept = new Set();
    for (let i = 0; i < w * h; i++) if (keep[i]) for (const k of kindsOf(i)) kept.add(k);
    if (all.size - kept.size < bestMissing) {
      best = keep;
      bestMissing = all.size - kept.size;
    }
  }
  return wholeOutline(/** @type {Uint8Array} */ (best), w, h, kindsOf, isWall);
}

/** A classic block's building records, as the kinds read them - each record's type, the Order of the Raven's hall marked
 *  (RMBLayout.cs:677-683, systems/talk/talkTopics.js drawNamedBuildings: KRAVE01.HS2 a guild hall of faction 414) - kept
 *  by name: a block of BLOCKS.BSA is the same all session. */
const _records = new Map();
function classicRecords(name, classicOf) {
  if (_records.has(name)) return _records.get(name);
  const dfBlock = classicOf(name),
    fh = dfBlock?.rmbBlock?.fldHeader;
  const out = fh
    ? Array.from({ length: Math.min(fh.buildingDataList?.length ?? 0, blockBuildingCount(dfBlock) ?? 0) }, (_, i) => ({
        type: fh.buildingDataList[i].buildingType,
        raven: fh.otherNames?.[i] === 'KRAVE01.HS2',
      }))
    : null;
  _records.set(name, out);
  return out;
}

/**
 * THE KINDS EACH CELL HOLDS, AS THE GAME'S OWN FILES LAY THEM: the location's named entries drawn over its grid's classic
 * blocks (`classicOf(name)`, read past the world-data door - BlocksFile.readClassicBlock) in the readers' order, each named
 * record the next unused entry of its type (drawNamedBuildings' pool, a guild no hall of this game carries aside) - no
 * mod's block nor its building replacement, so every client keeps the same cells whatever it has loaded.
 * @param {any[]} buildings the location's list @param {string[]} names its grid's block names @param {(name: string) => any} classicOf
 * @returns {string[][]} each cell's kinds (buildingKind's)
 */
export function classicKinds(buildings, names, classicOf) {
  const pool = buildings.filter(
    (b) =>
      isNamedBuildingType(b.buildingType) &&
      !(b.buildingType === BUILDING_TYPES.GuildHall && UNCARRIED_GUILD_FACTIONS.has(b.factionId)),
  );
  const used = new Uint8Array(pool.length);
  return names.map((name) => {
    const kinds = [];
    for (const r of classicRecords(name, classicOf) ?? []) {
      if (!isNamedBuildingType(r.type)) continue;
      const at = pool.findIndex((b, i) => !used[i] && b.buildingType === r.type);
      if (at >= 0) used[at] = 1;
      if (r.raven) kinds.push(buildingKind({ buildingType: BUILDING_TYPES.GuildHall, factionId: 414 }));
      else if (at >= 0) kinds.push(buildingKind(pool[at]));
    }
    return kinds;
  });
}

/**
 * A TOWN PAST THE BAY'S OUTLINE: `dfLocation` (a clone - its own exterior data, its template's block names and building
 * list shared) answered as a NEW location whose grid keeps its blob's cells (townOutlineCells over the kinds each cell holds
 * in the game's own files - classicKinds) and lays TOWN_OUTLINE_BLOCK in every other - its building list stripped of
 * exactly what those cells draw as this client lays them (drawNamedBuildings over `servedOf`'s blocks, in the readers'
 * order: every kept building keeps the entry it draws) - and `outline` (how many cells it keeps and leaves out, and
 * whether its template was walled: TS4 walls its outline, its south-west cell the wall's carrier - townWallBlockName). The location itself where it keeps every cell, has no grid or
 * no block is read.
 * @param {any} dfLocation
 * @param {{ classicOf: (name: string) => any, servedOf: (name: string) => any }} blocks a block by its name: the game's
 *   own (BlocksFile.readClassicBlock) and as the layout reads it (BlocksFile.getBlockByName)
 * @param {{ round?: boolean }} [o] TS5: a round town's outline (ROUND_OUTLINE - the Imperial City's outskirts)
 */
export function outlineTownLocation(dfLocation, { classicOf, servedOf }, { round = false } = {}) {
  dfLocation = unwalledLocation(dfLocation); // TS7: a Bay city's template is its own ring
  const ed = dfLocation?.exterior?.exteriorData;
  if (!ed?.blockNames || !Array.isArray(dfLocation.exterior.buildings)) return dfLocation;
  const { width: w, height: h } = ed;
  const isWall = (bx, by) => isWallBlock(ed.blockNames[by * w + bx]);
  const seed = (dfLocation.mapTableData?.mapId ?? ed.mapId ?? 0) >>> 0;
  const kinds = classicKinds(dfLocation.exterior.buildings, ed.blockNames, classicOf);
  const list = [],
    cellOf = new Map();
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      const dfBlock = servedOf(ed.blockNames[by * w + bx]);
      if (!dfBlock) continue;
      const b = { dfBlock, x: bx, y: by };
      list.push(b);
      cellOf.set(b, by * w + bx);
    }
  }
  if (!list.length) return dfLocation;
  const keep = townOutlineCells(w, h, seed, (i) => kinds[i], isWall, round ? ROUND_OUTLINE : TOWN_OUTLINE);
  const left = keep.reduce((n, v) => n + (v ? 0 : 1), 0);
  if (!left || left === w * h) return dfLocation;
  const { drawn } = drawNamedBuildings(dfLocation.exterior.buildings, list, {
    locationIndex: dfLocation.locationIndex ?? 0,
  });
  const strip = new Set();
  for (const [b, entries] of drawn)
    if (!keep[/** @type {number} */ (cellOf.get(b))]) for (const e of entries) strip.add(e);
  const buildings = dfLocation.exterior.buildings.filter((b) => !strip.has(b));
  const walled = ed.blockNames.some((n) => isWallBlock(n));
  const open = (i) => (walled && i === 0 ? townWallBlockName(seed) : TOWN_OUTLINE_BLOCK); // TS4: its ring's corner (world/townWalls.js)
  return {
    ...dfLocation,
    exterior: {
      ...dfLocation.exterior,
      buildings,
      buildingCount: buildings.length,
      exteriorData: { ...ed, blockNames: ed.blockNames.map((n, i) => (keep[i] ? n : open(i))) },
    },
    outline: Object.freeze({ kept: w * h - left, left, walled }),
  };
}

/** The open cell's block in DFU's world-data JSON (formats/worldData/worldDataReplacement.js blockFromJson). */
export function townOutlineBlockJson() {
  const GroundTiles = [],
    GroundScenery = [],
    AutoMapData = new Array(64 * 64).fill(0);
  for (let i = 0; i < 256; i++) {
    GroundTiles.push({ TileBitfield: OPEN_TILE });
    GroundScenery.push({ TextureRecord: -1 });
  }
  return {
    Name: TOWN_OUTLINE_BLOCK,
    Type: 'Rmb',
    Position: 0,
    RmbBlock: {
      FldHeader: {
        GroundData: { GroundTiles, GroundScenery },
        AutoMapData,
        BuildingDataList: [],
        Name: TOWN_OUTLINE_BLOCK,
      },
      SubRecords: [],
      Misc3dObjectRecords: [],
      MiscFlatObjectRecords: [],
    },
  };
}

// ---------------------------------------------------------------- TS7: the Bay's cities walled on their outline

/** TS7: Daggerfall's own twelve wall blocks (WALLAA00-11) - a ring of them, and only them, is a ring the Bay's edit takes. */
const CLASSIC_WALL = /^WALLAA(0\d|1[01])\.RMB$/i;
/**
 * TS7 (2026-10-25, the owner: "Do all the open items" - the Bay's cities walled on their outline): A BAY CITY READ - the
 * port's edit of a location as the door reads it (formats/worldData/worldDataReplacement.js registerLocationEdit, after
 * the Arena's). A grid whose border is Daggerfall's wall ring and nothing else (every one of the Bay's 410 walled cities,
 * measured) has its ring cells open (TOWN_OUTLINE_BLOCK) but its south-west corner, its wall's carrier (townWallBlockName);
 * its own grid kept as `wallTook` (its gates' bearings and its template's: unwalledLocation), `outline` walled; and its
 * wall registered, made when its carrier is first laid out (world/townWalls.js registerTownWall - from the blocks as this
 * client serves them, what stands at its gates from the game's own). Every building is kept: Daggerfall's ring blocks
 * hold none. A ring a town mod rebuilt (Beautiful Cities' wall-and-farm and wall-and-tavern composites, its corners) is
 * not Daggerfall's and keeps its ring. Answers whether it walled the city.
 * @param {any} dfLocation @param {any} [maps] @param {any} [blocksFile]
 */
export function wallBayCity(dfLocation, maps = null, blocksFile = null) {
  const ed = dfLocation?.exterior?.exteriorData;
  if (!ed?.blockNames || !blocksFile || dfLocation.capital) return false; // a grid read again after its edit has no wall ring left: refused below
  const { width: w, height: h } = ed,
    names = ed.blockNames;
  if (!(w >= 3 && h >= 3) || names.length !== w * h) return false;
  const border = (i) => {
    const x = i % w,
      y = (i - x) / w;
    return x === 0 || y === 0 || x === w - 1 || y === h - 1;
  };
  if (!names.every((n, i) => (border(i) ? CLASSIC_WALL.test(String(n ?? '')) : !isWallBlock(n)))) return false;
  const mapId = (dfLocation.mapTableData?.mapId ?? 0) >>> 0;
  ed.blockNames = names.map((n, i) => (!border(i) ? n : i === 0 ? townWallBlockName(mapId) : TOWN_OUTLINE_BLOCK));
  ed.wallTook = names;
  dfLocation.outline = Object.freeze({ kept: (w - 2) * (h - 2), left: 2 * (w + h) - 4, walled: true, bay: true });
  registerTownWall(
    dfLocation,
    names,
    {
      servedOf: (n) => blocksFile.getBlockByName(n),
      classicOf: (n) => {
        const i = blocksFile.getBlockIndex(blocksFile.checkName(n));
        return i < 0 ? null : blocksFile.readClassicBlock(i);
      },
    },
    townOutlineBlockJson,
  );
  return true;
}
let _installed = false;
/** ONCE: the open cell's block on the world-data door, behind no switch (scenes/modWorldData.js, beside installCapitals);
 *  TS7: and the Bay's walled cities' edit. */
export function installTownOutline() {
  if (_installed) return false;
  _installed = true;
  installWorldDataReplacement();
  registerPortBlock(TOWN_OUTLINE_BLOCK, () => townOutlineBlockJson(), TOWN_OUTLINE_BLOCK_INDEX);
  registerLocationEdit(wallBayCity);
  return true;
}
