// ═══════════════════════════════════════════════════════════════════
// WW7-4 (2026-10-25, the owner: "The tower in the middle needs an
// interior, ensure all castles have interiors") - EVERY CAPITAL'S CASTLE
// HAS ITS HALLS (bible/04-World/World-Wide.md WW7-4).
//
// DFU's reference: a crown city's castle is that location's own dungeon
// (MAPS.BSA: Daggerfall's S0000160, Sentinel's S0000040-41, Wayrest's
// S0000080-81 - the five RDBs whose start marker carries a magnitude,
// RDBLayout's castle block: its guards keep the peace, its own light and
// music, no rest), entered by a dungeon door in the city's palace model.
// Past the Bay no capital had either.
//
// DEPARTURE (named): Daggerfall keeps no castle past the Bay, so each
// capital's halls are a Bay castle's palace blocks, laid as the Bay lays
// them, under names of the port's own - and the Bay's court stood down:
// every person's flat (world/npcFlatArchives.js) but the castle's guards
// (the 199 markers), its bards and its children is taken out, with the
// quest markers (199.11, 199.18) - no King Gothryd in the Blue Palace.
// The halls' open sides are closed by the Bay castle's own border blocks.
// The castle is the capital's centre's dungeon (its map id the crown
// seat's key, scenes/tamrielPlacesHost.js seatPlaces), its door the
// palace's (capitalShapes.js entranceDoor).
// ═══════════════════════════════════════════════════════════════════
import { isNpcFlat } from './npcFlatArchives.js';
import { RDB_RESOURCE_TYPES } from '../formats/blocksFile.js';

/** The port blocks' fixed indices (formats/worldData/worldDataReplacement.js registerPortBlockOf): past the capitals'
 *  own (tamrielCapitals.js CAPITAL_BLOCK_INDEX on, 442 of them today). */
export const CASTLE_BLOCK_INDEX = 905000;
/** A castle's dungeon type: the crown castles' (MAPS.BSA: HumanStronghold) - its foes, its loot, its rest. */
export const CASTLE_DUNGEON_TYPE = 2;
/** The Bay castles whose halls a capital borrows: their palace blocks (name, x, z - MAPS.BSA's own places, the first
 *  the starting block) and their border blocks in MAPS.BSA's order. Measured on the freeware's MAPS.BSA. */
export const BAY_CASTLE_HALLS = Object.freeze({
  daggerfall: Object.freeze({ halls: Object.freeze([['S0000160.RDB', 0, 0]]),
    borders: Object.freeze(['B0000010.RDB', 'B0000011.RDB', 'B0000012.RDB', 'B0000013.RDB', 'B0000014.RDB', 'B0000001.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'B0000005.RDB']) }),
  sentinel: Object.freeze({ halls: Object.freeze([['S0000040.RDB', 0, 0], ['S0000041.RDB', -1, 0]]),
    borders: Object.freeze(['B0000005.RDB', 'B0000006.RDB', 'B0000007.RDB', 'B0000008.RDB', 'B0000010.RDB', 'B0000011.RDB', 'B0000012.RDB', 'B0000013.RDB', 'B0000014.RDB', 'B0000001.RDB', 'B0000002.RDB']) }),
  wayrest: Object.freeze({ halls: Object.freeze([['S0000080.RDB', 0, 0], ['S0000081.RDB', -1, 0]]),
    borders: Object.freeze(['B0000006.RDB', 'B0000007.RDB', 'B0000008.RDB', 'B0000009.RDB', 'B0000010.RDB', 'B0000011.RDB', 'B0000012.RDB', 'B0000013.RDB', 'B0000014.RDB', 'B0000001.RDB', 'B0000002.RDB']) }),
});
/** Whose halls each capital (tamrielCapitals.js CAPITALS, by index) borrows: the White-Gold Tower and Mournhold
 *  Wayrest's palace, Solitude and Torval Sentinel's, Alinor, Falinesti and Helstrom Daggerfall's. */
export const CAPITAL_CASTLE_HALLS = Object.freeze(['wayrest', 'sentinel', 'wayrest', 'daggerfall', 'daggerfall', 'sentinel', 'daggerfall']);
/** A Bay palace block's port copy's name: its S kept (formats/blocksFile.js getRdbType: a quest block, as the Bay's), a C
 *  where the Bay's has its first nought - no name BLOCKS.BSA has. */
export const castleBlockName = (name) => `SC${name.slice(2)}`;
/** The port copies, in order: each Bay palace block once. */
export const CASTLE_BLOCKS = Object.freeze([...new Set(Object.values(BAY_CASTLE_HALLS).flatMap((c) => c.halls.map(([n]) => n)))]
  .map((from, i) => Object.freeze({ name: castleBlockName(from), from, index: CASTLE_BLOCK_INDEX + i })));

/** The four sides, in the closing order (world/tamrielDungeons.js lairLayout's): north, west, east, south. */
const SIDES = Object.freeze([[0, -1], [-1, 0], [1, 0], [0, 1]]);
/**
 * CAPITAL k'S CASTLE: its halls (its Bay castle's palace blocks, under their port names, where the Bay lays them, the
 * first the starting block), then every open side of every hall, in their order and SIDES order, closed by the Bay
 * castle's border blocks in turn - the dungeon's blocks, as MAPS.BSA lists a location's. Null for no capital.
 * @param {number} k @returns {?{ blockName: string, x: number, z: number, isStartingBlock: boolean }[]}
 */
export function capitalCastleBlocks(k) {
  const src = BAY_CASTLE_HALLS[CAPITAL_CASTLE_HALLS[k]];
  if (!src) return null;
  const at = new Set(src.halls.map(([, x, z]) => `${x},${z}`)), closed = new Set();
  const blocks = src.halls.map(([name, x, z], i) => ({ blockName: castleBlockName(name), x, z, isStartingBlock: i === 0 }));
  let b = 0;
  for (const [, x, z] of src.halls) {
    for (const [dx, dz] of SIDES) {
      const key = `${x + dx},${z + dz}`;
      if (at.has(key) || closed.has(key)) continue;
      closed.add(key);
      blocks.push({ blockName: src.borders[b++ % src.borders.length], x: x + dx, z: z + dz, isStartingBlock: false });
    }
  }
  return blocks;
}
/** CAPITAL k'S CASTLE AS ITS LOCATION CARRIES IT (MAPS.BSA's dungeon record's shape, formats/mapsFile.js): its blocks
 *  and its own dungeon id - the capital's map id (`mapId`), as a lair's is (world/tamrielDungeons.js
 *  synthesizeLairLocation): the dungeon's memory, stream and texture table its own. Null for no capital. */
export function capitalCastleDungeon(k, mapId) {
  const blocks = capitalCastleBlocks(k);
  return blocks ? { header: { blockCount: blocks.length }, recordElement: { header: { locationId: mapId } }, blocks } : null;
}

/** The castle's own folk, who are no court's: its bards, its prostitutes and its children (FACTION.TXT 511, 512, 514) -
 *  and a flat no faction claims. */
const CASTLE_FOLK = Object.freeze(new Set([0, 511, 512, 514]));
/** The quest markers (archive 199): a quest's item (11) and its person (18) - the Bay's quests', none here. */
const QUEST_MARKERS = Object.freeze(new Set([11, 18]));
/** Does a castle's port copy keep this RDB object? Its court's people and its quest markers, no. */
export function castleKeeps(o) {
  if (o?.type !== RDB_RESOURCE_TYPES.Flat) return true;
  const f = o.resources?.flatResource;
  if (!f) return true;
  if (f.textureArchive === 199) return !QUEST_MARKERS.has(f.textureRecord);
  return !isNpcFlat(f.textureArchive) || CASTLE_FOLK.has(f.factionOrMobileId);
}
/**
 * A BAY PALACE BLOCK'S PORT COPY (`dfBlock`, BLOCKS.BSA's, read): the same block under its port name and index, every
 * object it keeps (castleKeeps) - and every object an action chain names kept whatever it is, so no chain breaks.
 * @param {any} dfBlock @param {{ name: string, index: number }} copy
 */
export function castleBlockOf(dfBlock, copy) {
  const rdb = dfBlock?.rdbBlock;
  if (!rdb) return null;
  const linked = new Set();
  for (const g of rdb.objectRootList ?? []) for (const o of g.rdbObjects ?? []) {
    const a = o.resources?.modelResource?.actionResource, f = o.resources?.flatResource;
    if (o.type === RDB_RESOURCE_TYPES.Model && a) { if (a.nextObjectOffset > 0) linked.add(a.nextObjectOffset); if (a.previousObjectOffset > 0) linked.add(a.previousObjectOffset); }
    if (o.type === RDB_RESOURCE_TYPES.Flat && f?.nextObjectOffset > 0) linked.add(f.nextObjectOffset);
  }
  return {
    ...dfBlock, index: copy.index, name: copy.name, servedName: copy.name,
    rdbBlock: { ...rdb, objectRootList: (rdb.objectRootList ?? []).map((g) => ({ ...g, rdbObjects: g.rdbObjects ? g.rdbObjects.filter((o) => linked.has(o.position) || castleKeeps(o)) : g.rdbObjects })) },
  };
}
