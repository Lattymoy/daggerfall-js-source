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
// PROVINCE-COURTS: and its court re-seated as the capital's own (CASTLE_SEATS
// below - the region's court through DFU's generic factions, in their looks).
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

/** PROVINCE-COURTS (bible/03-World/World-Wide.md): THE CASTLE'S COURT, THE CAPITAL'S OWN. A province has its court now
 *  (systems/faction/provinceFactions.js), so the Bay court's people are re-seated in the copy rather than stood down -
 *  under DFU's own generic factions, which a person's talk and work read as the region's court (npcSession.js
 *  getStaticNPCFactionData: Random_Ruler, Random_Noble and Random_Knight -> courtOfCurrentRegion; in the Blue Palace the
 *  Court of Skyrim), and its people as the region's people (a factionless person). Each seat by the FACTION.TXT ids the
 *  Bay's three palaces carry (measured on the freeware's BLOCKS.BSA - S0000160, S0000040-41, S0000080-81): the crown's
 *  ruler (its Province's first child - Gothryd, Akorithi, Eadwyre) on the throne, its nobles and its court, its
 *  knights, its commoners. A re-seated noble wears its generic faction's own flat (FACTION.TXT 852's and 242's 183.6 or
 *  183.8, 853's 183.3 or 183.14) by its own gender (the flat's flags bit 32) - no Bay royal's likeness in the copy; a
 *  commoner keeps the look it had. The rest of the Bay's people go as before: the vampire clans' spies, the scholars and
 *  guild members a Bay story names, a mobile's record. */
export const CASTLE_SEATS = Object.freeze({
  ruler: Object.freeze({ faction: 852, flats: Object.freeze([[183, 6], [183, 8]]), ids: Object.freeze([364, 380, 390]) }),
  noble: Object.freeze({ faction: 242, flats: Object.freeze([[183, 6], [183, 8]]),
    ids: Object.freeze([365, 366, 367, 371, 377, 387, 381, 382, 383, 386, 391, 392, 393, 394, 397, 499, 595, 596]) }),
  knight: Object.freeze({ faction: 853, flats: Object.freeze([[183, 3], [183, 14]]), ids: Object.freeze([368, 384, 408, 409]) }),
  people: Object.freeze({ faction: 0, flats: null, ids: Object.freeze([518, 523, 526]) }),
});
const SEAT_OF = new Map(Object.values(CASTLE_SEATS).flatMap((seat) => seat.ids.map((id) => [id, seat])));
/** The seat a Bay court person takes in a castle's copy - CASTLE_SEATS' - or null. @param {number} factionId */
export const castleSeatOf = (factionId) => SEAT_OF.get(factionId) ?? null;

/** Does a castle's port copy keep this RDB object? Its quest markers, no; a court person, only re-seated (castleSeated). */
export function castleKeeps(o) {
  if (o?.type !== RDB_RESOURCE_TYPES.Flat) return true;
  const f = o.resources?.flatResource;
  if (!f) return true;
  if (f.textureArchive === 199) return !QUEST_MARKERS.has(f.textureRecord);
  return !isNpcFlat(f.textureArchive) || CASTLE_FOLK.has(f.factionOrMobileId) || !!castleSeatOf(f.factionOrMobileId);
}
/** A kept object as the copy carries it: a court person under its seat's faction (its magnitude and sound index the id's
 *  two bytes, as BLOCKS.BSA packs it) and, a noble, its seat's flat by its gender; anything else as it is. */
export function castleSeated(o) {
  const f = o?.type === RDB_RESOURCE_TYPES.Flat ? o.resources?.flatResource : null;
  const seat = f && isNpcFlat(f.textureArchive) ? castleSeatOf(f.factionOrMobileId) : null;
  if (!seat) return o;
  const id = seat.faction;
  const look = seat.flats ? seat.flats[(f.flags & 32) === 32 ? 1 : 0] : null;
  return { ...o, resources: { ...o.resources, flatResource: { ...f, factionOrMobileId: id, magnitude: id & 0xff, soundIndex: id >> 8,
    ...(look ? { textureArchive: look[0], textureRecord: look[1], textureBitfield: (look[0] << 7) | look[1] } : {}) } } };
}
/**
 * A BAY PALACE BLOCK'S PORT COPY (`dfBlock`, BLOCKS.BSA's, read): the same block under its port name and index, every
 * object it keeps (castleKeeps) - and every object an action chain names kept whatever it is, so no chain breaks.
 * AUDIT FB1030 D1: and a flat that STARTS a chain - S0000160's foyer guard (183.3, his faction bytes his action's) asks
 * the terms and opens the two foyer doors; dropped, Alinor's, Falinesti's and Helstrom's courts stood behind them.
 * @param {any} dfBlock @param {{ name: string, index: number }} copy
 */
const chainHead = (o) => o.type === RDB_RESOURCE_TYPES.Flat && o.resources?.flatResource?.action > 0 && o.resources.flatResource.nextObjectOffset > 0;
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
    rdbBlock: { ...rdb, objectRootList: (rdb.objectRootList ?? []).map((g) => ({ ...g, rdbObjects: g.rdbObjects ? g.rdbObjects.filter((o) => linked.has(o.position) || chainHead(o) || castleKeeps(o)).map(castleSeated) : g.rdbObjects })) },
  };
}
