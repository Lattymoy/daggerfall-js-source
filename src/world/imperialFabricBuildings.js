// @ts-check
// BLD (2026-10-26, the owner, having walked the Imperial City: "... no doors/interiors ..."; and "No band aids for any of
// this"; bible/03-World/Arena-Provinces.md IC-GRAND, BLD) - THE FABRIC'S BUILDINGS ENTERED, as Daggerfall's are.
//
// DFU's reference: a city block's building is a SUBRECORD and a BUILDING RECORD of its RMB (RMBLayout: its exterior's
// models laid at the subrecord's place - a door on a model is that building's door, StaticDoor.recordIndex its record;
// DaggerfallInterior: its interior's models, flats, people and doors laid in the frame of the building model the door is
// on; BuildingDirectory: its record's type, quality, faction and name seed - the town map's label, the shop's keeper and
// stock, the Where-is answer, a quest's site). The fabric's buildings had none of it: facades.
//
// HERE each street-front building of a cell's layout (world/imperialFabric.js) is given what a block's building has:
//   - A RECORD: its type by its district's trade and its own hash (DISTRICT_TRADE - a shopfront on a main or side street a
//     shop of the district's, a corner on one a tavern now and then, a guild hall seldom where its guild keeps house,
//     every other a residence of its footprint's size), its quality by its district's wealth (DISTRICT_QUALITY), a guild's
//     faction (systems/guild/guildFactions.js), a name seed of its own;
//   - A DONOR: a building of Daggerfall's own blocks of that type (FABRIC_DONORS, read off the freeware: a ground-floor
//     entrance, its keeper in), the same donor on every client (the record's hash picks it, nearest the building's
//     footprint in size) - IC-INTERIORS (2026-10-27): its CAST, read from the player's BLOCKS.BSA when the interior is first
//     asked for (its people, its quest, rest and treasure markers, its lights' pictures);
//   - ITS OWN INTERIOR (IC-INTERIORS, world/interior/fabricInterior.js): laid from Daggerfall's own interior kit to the
//     building's footprint, its storeys, its kind and its door, its windows where its walls show them, its rooms cut by
//     its key - the donor's cast stood again in it. BLD had handed it the donor's interior whole: a long shop a square
//     room, every house of a size the same three rooms;
//   - A DOOR on its widest street's front, at the bay nearest the front's middle where the street before it is open: a
//     model of a door (Daggerfall's own door picture, TEXTURE.374 - DFU's building door law, world/meshReader.js
//     BUILDING_DOORS - in a stone surround) whose door face is the game's door (DOOR_TYPE.BUILDING), laid as a
//     subrecord's one exterior model; the subrecord turned and placed so its interior's street door (FABRIC_ENTRANCE)
//     stands at that door, its interior laid in that frame (the landing at its enter marker and its door,
//     player/enterExit.js).
// The back ranges in the courts (no street reaches them - the walkers' ground is shut there), and a front whose every
// bay has a way up or a canal before it, keep no door: facades, as before.
//
// IC-PROPS (2026-10-27, the owner: "Old daggerfall city layout placements are in imperial city"): the 671 of Daggerfall's
// city blocks the plan laid among the city's own are gone (world/imperialCity.js cellOf), and what they carried that the
// grand city means to keep is the fabric's now - each district's signature trade among its shops: the Temple District's
// temples of the Eight (the `temple` donors, each its own god's - the record's faction), Talos Plaza's and the Market's
// banks and general stores, the Waterfront's Thieves Guild (a house of the guild's faction, as Daggerfall's THIE blocks
// keep it), and the Arcane University's Mages Guild halls and libraries inside its curtain (world/imperialFabric.js
// universityGrounds).
import {
  fabricCell,
  fabricGroundIn,
  outwardOf,
  streetKind,
  centroid,
  inQuad,
  GROUND,
  BAY,
  STOREY,
  stairGround,
} from './imperialFabric.js';
import { IMPERIAL_CELLS, IMPERIAL_SPAN, imperialDistrictAt, imperialCell, imperialCodeCell } from './imperialCity.js';
import { FABRIC_DONOR_MARKED, FABRIC_SITE_SETS, FABRIC_SLICE_SETS } from './imperialFabricSites.js';
import { BUILDING_TYPES } from './buildingNames.js';
import { GUILD_FACTION_IDS } from '../systems/guild/guildFactions.js';
import { hash32, BLOCK_M } from './spawnedDungeons.js';
import { MeshBuilder } from './detStandIns.js';
import { partyEdges } from './imperialFabricModels.js'; // IC-INTERIORS: a party wall's windows are blind inside too
import { fabricInteriorGrid, fabricInteriorPlan, fabricInteriorRecord } from './interior/fabricInterior.js'; // IC-INTERIORS
import { DOOR_TYPE, GLOBAL_SCALE } from './meshReader.js';
import { CAPITAL_ART, art } from './capitalShapes.js';
import { registerCustomModelFamily } from './customModels.js';
import { imperialBlockOf, imperialBlockIndex } from './imperialBlocks.js';
import { blockFromJson } from '../formats/worldData/worldDataReplacement.js';
import { ROTATION_DIVISOR, RMB_DIMENSION } from '../formats/blocksFile.js';
import { makeBuildingKey } from '../systems/talk/talkTopics.js';

const HALF = IMPERIAL_CELLS / 2,
  B = BLOCK_M;
/** The ground a door opens onto: the street, the square, and (IC-STAIRS) the street under a stair's upper flights.
 *  @type {ReadonlyArray<number>} */
const DOOR_GROUND = Object.freeze([GROUND.street, GROUND.square, GROUND.under]);
const SALT = 0xb1d5;
/** The most buildings a cell's block carries: a classic block's list has 32 slots (BlocksFile), the world-data door's
 *  JSON as many as it lists (formats/worldData/worldDataReplacement.js blockFromJson, DFU's WorldDataReplacement), and a
 *  building's key holds its record in eight bits (systems/talk/talkTopics.js makeBuildingKey: BuildingDirectory's). */
export const FABRIC_BUILDINGS_PER_CELL = 255;

/**
 * THE DONORS - buildings of Daggerfall's own blocks whose casts the fabric's take, by pool: [pool, block, record,
 * BuildingType, the interior's extent (x, z metres)]. Read off the freeware's 920 RMB blocks (the BLD record): of each
 * pool's blocks one building a block, spread over the pool, each with an enter marker, a door on its ground floor and
 * (but a home's) its people in. Its numbers are pinned against the player's own BLOCKS.BSA where one is at hand
 * (test/world/icbld_buildings.test.js). IC-INTERIORS: a donor gives its building its type, its cast (its people, its
 * markers, its lights' pictures - fabricBuildingInterior) and its size (the pick's: donorOf); BLD's columns for the donor's
 * own entrance (its door's middle and its way out) are gone with the donor's interior - the building's frame is
 * FABRIC_ENTRANCE.
 */
export const FABRIC_DONORS = Object.freeze(
  /** @type {Array<[string, string, number, number, number, number, number?]>} */ ([
    ['house3', 'RESIAL00.RMB', 0, 19, 9.5, 9.6],
    ['house3', 'RESIAL09.RMB', 8, 19, 9.6, 12.7],
    ['house3', 'RESIAM03.RMB', 13, 19, 9.5, 9.6],
    ['house3', 'RESIAM02.RMB', 3, 19, 9.6, 12.7],
    ['house2', 'RESIAL00.RMB', 2, 18, 9.3, 13.6],
    ['house2', 'RESIAL04.RMB', 0, 18, 15.7, 15.7],
    ['house2', 'RESIAL08.RMB', 0, 18, 12.5, 15.7],
    ['house2', 'RESIAM01.RMB', 0, 18, 9.6, 12.7],
    ['house2', 'RESIAM05.RMB', 0, 18, 9.3, 12.5],
    ['house2', 'RESIAM09.RMB', 0, 18, 6.1, 12.5],
    ['house2', 'RESIAS06.RMB', 0, 18, 9.3, 15.7],
    ['house2', 'RESIBS02.RMB', 0, 18, 9.3, 18.9],
    ['house1', 'MANRAL00.RMB', 0, 17, 12.5, 18.9],
    ['house1', 'MANRAM02.RMB', 14, 17, 12.5, 18.9],
    ['house1', 'MANRAS02.RMB', 8, 17, 12.5, 18.9],
    ['house4', 'RESIBL00.RMB', 0, 20, 18.9, 9.3],
    ['house4', 'RESIBM01.RMB', 0, 20, 18.9, 9.3],
    ['house4', 'RESIGL03.RMB', 0, 20, 25.3, 25.3],
    ['alchemist', 'ALCHAL00.RMB', 7, 0, 12.5, 15.7],
    ['alchemist', 'ALCHAS01.RMB', 0, 0, 12.5, 15.7],
    ['alchemist', 'ALCHBL01.RMB', 0, 0, 9.5, 6.4],
    ['armorer', 'ARMRAL00.RMB', 0, 2, 12.5, 18.9],
    ['armorer', 'ARMRAM01.RMB', 0, 2, 12.5, 18.9],
    ['armorer', 'ARMRGL01.RMB', 0, 2, 12.5, 18.9],
    ['bank', 'BANKAL00.RMB', 0, 3, 12.5, 15.7],
    ['bank', 'BANKAM00.RMB', 15, 3, 13.8, 15.7],
    ['bookseller', 'BOOKAL00.RMB', 1, 5, 12.5, 15.7],
    ['bookseller', 'BOOKAS01.RMB', 6, 5, 13.8, 15.7],
    ['bookseller', 'BOOKBM00.RMB', 7, 5, 9.5, 6.4],
    ['clothing', 'CLOTAL00.RMB', 1, 6, 15.9, 18.9],
    ['clothing', 'CLOTAM03.RMB', 0, 6, 15.9, 18.9],
    ['furniture', 'FURNAL01.RMB', 17, 7, 12.5, 15.7],
    ['furniture', 'FURNAM02.RMB', 0, 7, 12.5, 15.7],
    ['gems', 'GEMSAL00.RMB', 0, 8, 12.5, 15.7],
    ['gems', 'GEMSAS00.RMB', 11, 8, 12.5, 15.7],
    ['general', 'GENRAL00.RMB', 18, 9, 12.5, 15.7],
    ['general', 'GENRAM00.RMB', 14, 9, 6.4, 6.4],
    ['general', 'GENRAS01.RMB', 10, 9, 12.5, 15.7],
    ['general', 'GENRBL02.RMB', 0, 9, 12.5, 15.7],
    ['library', 'LIBRAL00.RMB', 0, 10, 13.8, 15.7],
    ['library', 'LIBRAL03.RMB', 3, 10, 18.9, 18.9],
    ['pawn', 'PAWNAL00.RMB', 14, 12, 12.5, 15.7],
    ['pawn', 'PAWNBS00.RMB', 0, 12, 19.3, 15.9],
    ['weaponsmith', 'WEAPAL00.RMB', 0, 13, 12.5, 15.7],
    ['weaponsmith', 'WEAPAM00.RMB', 0, 13, 15.7, 18.9],
    ['weaponsmith', 'WEAPBM00.RMB', 7, 13, 6.4, 6.4],
    ['tavern', 'TVRNAL00.RMB', 0, 15, 25.5, 19.2],
    ['tavern', 'TVRNAL10.RMB', 0, 15, 12.5, 15.7],
    ['tavern', 'TVRNBM04.RMB', 5, 15, 15.7, 15.7],
    ['mages', 'MAGEAA00.RMB', 0, 11, 19.2, 25.3],
    ['mages', 'MAGEBA03.RMB', 0, 11, 28.5, 25.3],
    ['fighters', 'FIGHAA00.RMB', 16, 11, 9.3, 9.3],
    ['fighters', 'FIGHAA01.RMB', 0, 11, 9.3, 9.3],
    // IC-PROPS: the temples of the Eight, each block's temple (its record's faction its god's), and the Thieves Guild's
    // houses (THIE blocks' House2 of the guild's faction) - the trade of Daggerfall's blocks the plan no longer lays
    ['temple', 'TEMPAAA0.RMB', 0, 14, 16.8, 18.5, 21],
    ['temple', 'TEMPAAB0.RMB', 16, 14, 18.4, 18.7, 22],
    ['temple', 'TEMPAAC0.RMB', 21, 14, 16.8, 15.9, 24],
    ['temple', 'TEMPAAD0.RMB', 22, 14, 12.8, 20.6, 92],
    ['temple', 'TEMPAAE0.RMB', 0, 14, 15.9, 14.9, 29],
    ['temple', 'TEMPAAF0.RMB', 21, 14, 16.6, 15.9, 27],
    ['temple', 'TEMPAAG0.RMB', 20, 14, 17, 16.3, 33],
    ['temple', 'TEMPAAH0.RMB', 13, 14, 16.4, 18.3, 35],
    ['thieves', 'THIEAL00.RMB', 16, 18, 17.4, 14.6, 42],
    ['thieves', 'THIEAM00.RMB', 0, 18, 23.4, 13.6, 42],
  ]).map(([pool, block, record, type, w, d, faction = 0]) =>
    Object.freeze({ pool, block, record, type, size: Object.freeze([w, d]), faction }),
  ),
);
/** IC-INTERIORS: THE STREET DOOR OF A FABRIC BUILDING'S INTERIOR, in the interior's own metres - its middle at the frame's
 *  origin, the way out toward -z (world/interior/fabricInterior.js lays every building's cells from it: x along its
 *  front, z in from it). Every building's subrecord stands its interior so this stands at its door (subRecordFrame), and
 *  its door model stands here (fabricDoorModel). */
export const FABRIC_ENTRANCE = Object.freeze({ door: Object.freeze([0, 0]), out: -90 });
/** Each pool's donors' indices. */
const POOLS = (() => {
  const m = new Map();
  FABRIC_DONORS.forEach((d, i) => {
    if (!m.has(d.pool)) m.set(d.pool, []);
    m.get(d.pool).push(i);
  });
  return m;
})();

/** EACH DISTRICT'S TRADE on its streets: the shops its shopfronts keep (by pool), the share of them that are shops, and
 *  the guild that keeps a hall there (its pool), if any - the districts' own lore (the Market's stalls, smiths and bank,
 *  the Arena District's armourers and the Fighters Guild, the Temple District's books and the Mages Guild, Talos Plaza's
 *  bank, jewellers and general stores, the Elven Gardens' alchemists, the Waterfront's general stores and pawnshops).
 *  IC-PROPS: and its SIGNATURE HALLS (`halls`: [pool, one main street front in so many]) - what Daggerfall's blocks of
 *  its signature (world/imperialCity.js's IMPERIAL_SIGNATURE, till 2026-10-27) stood it, about as many as they stood: the
 *  Temple District's temples of the Eight (its 33 TEMP blocks, a temple each), the Waterfront's Thieves Guild houses
 *  (its 15 THIE blocks, a guild house each), the Arcane University's Mages Guild halls (its 14 MAGE blocks, two or three
 *  each) - the University its own trade besides, its libraries, books and alchemists; Talos Plaza's general stores and
 *  the Market's bank (their GENR and BANK blocks) among their shops. */
export const DISTRICT_TRADE = Object.freeze({
  'Market District': Object.freeze({
    shops: [
      'general',
      'clothing',
      'gems',
      'alchemist',
      'pawn',
      'bookseller',
      'furniture',
      'armorer',
      'weaponsmith',
      'general',
      'bank',
    ],
    share: 0.7,
    guild: null,
  }),
  'Arena District': Object.freeze({
    shops: ['armorer', 'weaponsmith', 'general', 'pawn', 'armorer'],
    share: 0.5,
    guild: 'fighters',
  }),
  'Arboretum': Object.freeze({ shops: ['bookseller', 'alchemist', 'library', 'clothing'], share: 0.4, guild: null }),
  'Temple District': Object.freeze({
    shops: ['alchemist', 'bookseller', 'library', 'general', 'clothing'],
    share: 0.5,
    guild: 'mages',
    halls: [['temple', 340]],
  }),
  'Talos Plaza District': Object.freeze({
    shops: ['bank', 'gems', 'clothing', 'furniture', 'gems', 'library', 'general'],
    share: 0.5,
    guild: null,
  }),
  'Elven Gardens District': Object.freeze({
    shops: ['alchemist', 'clothing', 'bookseller', 'gems', 'alchemist'],
    share: 0.5,
    guild: 'mages',
  }),
  'Waterfront District': Object.freeze({
    shops: ['general', 'pawn', 'furniture', 'armorer', 'general'],
    share: 0.6,
    guild: 'fighters',
    halls: [['thieves', 500]],
  }),
  'Arcane University': Object.freeze({
    shops: ['library', 'alchemist', 'bookseller', 'library'],
    share: 0.6,
    guild: 'mages',
    halls: [['mages', 10]],
  }),
});
/** Each district's buildings' quality (BuildingData.Quality, 1-20: a shop's stock and prices, its rooms' fittings). */
export const DISTRICT_QUALITY = Object.freeze({
  'Market District': [8, 15],
  'Arena District': [5, 11],
  'Arboretum': [12, 18],
  'Temple District': [10, 16],
  'Talos Plaza District': [14, 20],
  'Elven Gardens District': [12, 18],
  'Waterfront District': [4, 10],
  'Arcane University': [14, 20],
});
/** A tavern is a corner building on a main or side street, one in FABRIC_TAVERN_EVERY; a guild hall a main street's front, one
 *  in FABRIC_GUILD_EVERY. */
export const FABRIC_TAVERN_EVERY = 9,
  FABRIC_GUILD_EVERY = 60;
/** The residences by footprint (m2 under its roof): House3 the smallest, then House2, House1, House4 (their donors'). */
const HOMES = Object.freeze([
  [80, 'house3'],
  [150, 'house2'],
  [240, 'house1'],
  [Infinity, 'house4'],
]);
const GUILD_FACTION = Object.freeze({ mages: GUILD_FACTION_IDS.MagesGuild, fighters: GUILD_FACTION_IDS.FightersGuild });
/** The way the street's rank goes: a door on its widest street, a main street's first. */
const RANK = Object.freeze({ main: 0, side: 1, lane: 2, alley: 3 });
const u01 = (...k) => hash32(SALT, ...k) / 4294967296;

/** A building's door on its front: the edge, its middle bay's centre (whole bays, world/imperialFabricModels.js
 *  wholeBay's law) out from which the street is open, its outward normal - or null where no bay of any front is. */
function doorOf(L, p) {
  const fronts = [0, 1, 2, 3]
    .filter((e) => p.out & (1 << e))
    .sort(
      (a, b) =>
        RANK[streetKind(p.sw?.[a] ?? 0)] - RANK[streetKind(p.sw?.[b] ?? 0)] ||
        (p.sw?.[b] ?? 0) - (p.sw?.[a] ?? 0) ||
        a - b,
    );
  for (const e of fronts) {
    const a = p.q[e],
      b = p.q[(e + 1) & 3],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outwardOf(p.q, e);
    const bays = Math.max(1, Math.round(len / BAY)),
      bay = len / bays,
      t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const order = [...Array(bays).keys()].sort(
      (i, j) => Math.abs(i + 0.5 - bays / 2) - Math.abs(j + 0.5 - bays / 2) || i - j,
    );
    for (const k of order) {
      const s = (k + 0.5) * bay,
        at = [a[0] + t[0] * s, a[1] + t[1] * s];
      // IC-STAIRS: its surround clear of a way up's shut ground (a stair's base, pier or low flight beside the bay)
      const side = FABRIC_DOOR.w / 2 + FABRIC_DOOR.jamb;
      if (
        [-1, 0, 1].some((k2) =>
          L.ground.stairs.some(
            (st) =>
              stairGround(st, at[0] + t[0] * k2 * side + n[0] * 0.3, at[1] + t[1] * k2 * side + n[1] * 0.3) ===
              GROUND.stair,
          ),
        )
      )
        continue;
      const g = fabricGroundIn(L, at[0] + n[0] * 0.8, at[1] + n[1] * 0.8),
        g2 = fabricGroundIn(L, at[0] + n[0] * 2, at[1] + n[1] * 2);
      if (DOOR_GROUND.includes(g) && DOOR_GROUND.includes(g2))
        return { edge: e, at, n, street: streetKind(p.sw?.[e] ?? 0) }; // IC-STAIRS: under a stair's upper flights too
    }
  }
  return null;
}
/** The pool a building's record draws from. */
function poolOf(p, door, district, area) {
  const trade = DISTRICT_TRADE[district],
    h = p.key;
  const corner = [0, 1, 2, 3].filter((e) => p.out & (1 << e)).length >= 2;
  // IC-PROPS: its signature halls first, each a main street's front off its own hash
  if (door.street === 'main')
    for (const [pool, every] of trade?.halls ?? []) if (hash32(SALT, h, 14) % every === 0) return pool;
  if (trade?.guild && door.street === 'main' && hash32(SALT, h, 3) % FABRIC_GUILD_EVERY === 0) return trade.guild;
  if (corner && (door.street === 'main' || door.street === 'side') && hash32(SALT, h, 4) % FABRIC_TAVERN_EVERY === 0)
    return 'tavern';
  if (
    trade &&
    (door.street === 'main' || door.street === 'side') &&
    (p.ground === 'groundShop' || u01(h, 5) < 0.35) &&
    u01(h, 6) < trade.share
  )
    return trade.shops[hash32(SALT, h, 7) % trade.shops.length];
  return HOMES.find(([max]) => area < max)[1];
}
/** The donor of a pool nearest a building's footprint, its hash breaking the ties (the same on every client). IC-PROPS: a
 *  temple's donor is its god (its record's faction - DFU's temple is its faction's), each of the Eight alike off the
 *  plot's hash, its hall's size no matter. */
function donorOf(pool, p, area) {
  const list = POOLS.get(pool);
  if (pool === 'temple') return list[hash32(SALT, p.key, 9) % list.length];
  const near = Math.min(...list.map((i) => Math.abs(FABRIC_DONORS[i].size[0] * FABRIC_DONORS[i].size[1] - area)));
  const fits = list.filter((i) => Math.abs(FABRIC_DONORS[i].size[0] * FABRIC_DONORS[i].size[1] - area) <= near + 60);
  return fits[hash32(SALT, p.key, 9) % fits.length];
}
/** IC-PROPS: the donor a building of a pool with a plot's `key` and footprint (`area`, m2) takes (donorOf) - for the pins. */
export const fabricDonorOf = (pool, key, area) => donorOf(pool, { key }, area);
/** A quad's area (m2). */
const areaOf = (q) =>
  Math.abs(
    q.reduce((s, v, i) => {
      const w = q[(i + 1) & 3];
      return s + v[0] * w[1] - w[0] * v[1];
    }, 0),
  ) / 2;

const _cells = new Map();
const KEEP = 1024;
/**
 * A CELL'S BUILDINGS (row r, column c of the plan): each street-front building of its own with a door, in the order its
 * records stand in its block - `{ key, plot, recordIndex, type, pool, donor, party, quality, factionId, nameSeed, door:
 * { edge, at, n, street } }`, the city's metres (x east, z south); `party` its party walls' bits (world/
 * imperialFabricModels.js partyEdges - IC-INTERIORS: blind inside as out). Kept (an LRU).
 */
export function fabricCellBuildings(r, c) {
  const k = r * 4096 + c;
  let out = _cells.get(k);
  if (out) return out;
  out = Object.freeze(makeBuildings(r, c));
  _cells.set(k, out);
  if (_cells.size > KEEP) _cells.delete(_cells.keys().next().value);
  return out;
}
function makeBuildings(r, c) {
  const L = fabricCell(r, c),
    cand = [];
  for (const p of L.plots) {
    if (!p.out) continue;
    const door = doorOf(L, p);
    if (door) cand.push({ p, door });
  }
  // as many as a block holds: the main streets' first, then each street's in its hash's order; laid in the plots' own order
  cand.sort((u, v) => RANK[u.door.street] - RANK[v.door.street] || hash32(SALT, u.p.key, 1) - hash32(SALT, v.p.key, 1));
  const kept = new Set(cand.slice(0, FABRIC_BUILDINGS_PER_CELL).map((x) => x.p));
  return cand
    .filter((x) => kept.has(x.p))
    .sort((u, v) => L.plots.indexOf(u.p) - L.plots.indexOf(v.p))
    .map(({ p, door }, recordIndex) => {
      const m = centroid(p.q),
        district = imperialDistrictAt(m[0], m[1]),
        area = areaOf(p.q);
      const pool = poolOf(p, door, district, area),
        donor = donorOf(pool, p, area),
        [qlo, qhi] = DISTRICT_QUALITY[district] ?? [8, 14];
      return Object.freeze({
        key: p.key,
        plot: p,
        recordIndex,
        pool,
        donor,
        type: FABRIC_DONORS[donor].type,
        party: partyEdges(L, p),
        quality: qlo + (hash32(SALT, p.key, 11) % (qhi - qlo + 1)),
        factionId: GUILD_FACTION[pool] ?? FABRIC_DONORS[donor].faction, // IC-PROPS: a temple its god's, the Thieves Guild's house the guild's (its donor's record's)
        nameSeed: (hash32(SALT, p.key, 13) % 65535) + 1,
        door: Object.freeze(door),
      });
    });
}

/**
 * THE FABRIC'S BUILDINGS OF A SLICE (the plan's 8 x 8 cells of slice `s`), for the living world's census and the city's
 * map: each `{ key, buildingKey, r, c, recordIndex, type, quality, factionId, nameSeed, door, local }` - the plot's own
 * key (world/imperialFabric.js, world/imperialHomes.js's), the building's key in its location's directory
 * (systems/talk/talkTopics.js makeBuildingKey over its block's grid cell and its record - the key its door and its
 * interior answer to), its cell, its record in its block, its door's middle on the wall and its outward normal in the
 * city's metres (`door`: x east, z south) and in its slice's location frame (`local`: east and north of the slice's
 * south-west corner, the walkers' grid's - world/city/cityNavigation.js).
 * @param {number} s
 */
export function fabricBuildingsIn(s) {
  const sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN),
    out = [];
  const ox = (sx * 8 - HALF) * B,
    oz = (sy * 8 + 8 - HALF) * B;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const r = sy * 8 + i,
        c = sx * 8 + j;
      for (const b of fabricCellBuildings(r, c)) {
        const [x, z] = b.door.at,
          [nx, nz] = b.door.n;
        out.push(
          Object.freeze({
            key: b.key,
            buildingKey: makeBuildingKey(j, 7 - i, b.recordIndex),
            r,
            c,
            recordIndex: b.recordIndex,
            type: b.type,
            quality: b.quality,
            factionId: b.factionId,
            nameSeed: b.nameSeed,
            door: Object.freeze({ x, z, nx, nz }),
            local: Object.freeze({ x: x - ox, z: oz - z, nx, nz: -nz }),
          }),
        );
      }
    }
  return out;
}
/** Is a building type a residence (RMBLayout.IsResidence's House1-House4) - for a reader of fabricBuildingsIn. */
export const isFabricHome = (type) => type >= BUILDING_TYPES.House1 && type <= BUILDING_TYPES.House4;
/** A cell's block-local frame: the city's map metres (x east, z south) to its block's metres (x east, z north). */
export const blockLocal = (r, c, x, z) => [(HALF - c) * B + x, (r + 1 - HALF) * B - z];

// ---------------------------------------------------------------- the doors

/** The door models' ids (world/customModels.js family): one a donor - its door where its entrance is, in its interior's
 *  own frame - past the fabric's and the skylines' (world/imperialBlocks.js). */
export const IMPERIAL_DOOR_MODEL = 7_200_000;
export const fabricDoorModelId = (donor) => IMPERIAL_DOOR_MODEL + donor;
export const isFabricDoorId = (id) => id >= IMPERIAL_DOOR_MODEL && id < IMPERIAL_DOOR_MODEL + FABRIC_DONORS.length;
/** A door's measures, metres: its leaf (Daggerfall's door picture, 64 x 128 - TEXTURE.374, the temperate set's, swapped
 *  for its climate as a block's are), how far proud of the wall it stands, and its stone surround (jambs and lintel) -
 *  26 triangles, solid as a block's door is. */
export const FABRIC_DOOR = Object.freeze({
  archive: 374,
  w: 1.3,
  h: 2.5,
  proud: 0.06,
  jamb: 0.22,
  lintel: 0.3,
  depth: 0.16,
});
/** The door picture a pool wears: a home's a plank door (its donor's parity - IC-PROPS: the Thieves Guild's house's too), a
 *  shop's the barred one, a tavern's, a guild's, a bank's, a library's or (IC-PROPS) a temple's the iron-bound. */
const doorPicture = (donor) => {
  const d = FABRIC_DONORS[donor];
  return d.pool.startsWith('house') || d.pool === 'thieves'
    ? donor & 1
    : ['tavern', 'mages', 'fighters', 'bank', 'library', 'temple'].includes(d.pool)
      ? 3
      : 2;
};
/**
 * A DONOR'S DOOR MODEL: in its interior's own frame (DaggerfallInterior lays the interior in the frame of the building
 * model the door is on - scenes/interiorContext.js, the door's `matrix`), so it stands at the origin of its subrecord and
 * its door at the interior's street door (FABRIC_ENTRANCE - IC-INTERIORS; BLD's stood at its donor's entrance): Daggerfall's
 * door picture (its donor's pool's) on a leaf FABRIC_DOOR.proud out of the wall in a stone surround, and its door face
 * (world/meshReader.js's door: three corners, the first and third across it, its normal out of the building) the game's
 * building door.
 * @param {number} id
 */
export function fabricDoorModel(id) {
  const k = id - IMPERIAL_DOOR_MODEL,
    d = FABRIC_DONORS[k],
    E = FABRIC_ENTRANCE;
  if (!d) return null;
  const D = FABRIC_DOOR,
    a = (E.out * Math.PI) / 180,
    o = [Math.cos(a), Math.sin(a)],
    t = [-o[1], o[0]];
  const P = (s, y, e) => [E.door[0] + t[0] * s + o[0] * e, y, E.door[1] + t[1] * s + o[1] * e];
  const mb = new MeshBuilder(),
    stone = art(CAPITAL_ART.wallStone),
    PIC = 1.6;
  /** A box against the wall: across s0-s1, up y0-y1, out e0-e1 - its front, its two ends and its top. */
  const box = (s0, s1, y0, y1, e0, e1) => {
    const uv = (u0, u1, w0, w1) => [
      [u0 / PIC, w0 / PIC],
      [u1 / PIC, w0 / PIC],
      [u1 / PIC, w1 / PIC],
      [u0 / PIC, w1 / PIC],
    ];
    mb.quad(stone, P(s0, y0, e1), P(s1, y0, e1), P(s1, y1, e1), P(s0, y1, e1), [o[0], 0, o[1]], uv(s0, s1, y0, y1));
    mb.quad(stone, P(s0, y0, e0), P(s0, y0, e1), P(s0, y1, e1), P(s0, y1, e0), [-t[0], 0, -t[1]], uv(e0, e1, y0, y1));
    mb.quad(stone, P(s1, y0, e1), P(s1, y0, e0), P(s1, y1, e0), P(s1, y1, e1), [t[0], 0, t[1]], uv(e0, e1, y0, y1));
    mb.quad(stone, P(s0, y1, e1), P(s1, y1, e1), P(s1, y1, e0), P(s0, y1, e0), [0, 1, 0], uv(s0, s1, e0, e1));
  };
  const w = D.w / 2;
  box(-w - D.jamb, -w, 0, D.h + D.lintel, 0, D.depth);
  box(w, w + D.jamb, 0, D.h + D.lintel, 0, D.depth);
  box(-w, w, D.h, D.h + D.lintel, 0, D.depth);
  // the leaf: the whole picture, its top row at its top (v rising up it, world/meshReader.js's law)
  mb.quad(
    [D.archive, doorPicture(k)],
    P(-w, 0, D.proud),
    P(w, 0, D.proud),
    P(w, D.h, D.proud),
    P(-w, D.h, D.proud),
    [o[0], 0, o[1]],
    [
      [0, -1],
      [1, -1],
      [1, 0],
      [0, 0],
    ],
  );
  const m = mb.build(),
    C = (s, y) => {
      const [x, yy, z] = P(s, y, D.proud);
      return { x, y: yy, z };
    };
  return {
    ...m,
    doors: [
      {
        index: 0,
        type: DOOR_TYPE.BUILDING,
        vert0: C(-w, 0),
        vert1: C(w, 0),
        vert2: C(w, D.h),
        normal: { x: o[0], y: 0, z: o[1] },
      },
    ],
  };
}
let _doors = false;
/** The door models' family, once (world/customModels.js): solid, its picture swapped for the climate as a block's door is. */
export function installFabricDoors() {
  if (_doors) return;
  _doors = true;
  registerCustomModelFamily({
    owns: isFabricDoorId,
    build: fabricDoorModel,
    keep: FABRIC_DONORS.length,
    climateFree: false,
  });
}

// ---------------------------------------------------------------- the block's buildings

/**
 * A BUILDING'S SUBRECORD FRAME: turned so its interior's street door (FABRIC_ENTRANCE) faces its street (`door.n`) and
 * placed so that door stands at its door (`door.at`), in its block's record units (RMBLayout's subrecord matrix:
 * T(XPos, 0, RMBDimension - ZPos) * GlobalScale, R(0, -YRotation / RotationDivisor, 0) - world/rmbLayout.js). The block's
 * frame: x east, z north.
 * @param {number} r @param {number} c @param {{ door: { at: number[], n: number[] } }} b
 */
export function subRecordFrame(r, c, b) {
  const d = FABRIC_ENTRANCE,
    [bx, bz] = blockLocal(r, c, b.door.at[0], b.door.at[1]),
    n = [b.door.n[0], -b.door.n[1]];
  // trs's turn about y by f takes a local (x, z) to (x cos f + z sin f, -x sin f + z cos f): a way turned by -f
  const phi = d.out - (Math.atan2(n[1], n[0]) * 180) / Math.PI,
    yRotation = Math.round(-phi * ROTATION_DIVISOR);
  const f = ((-yRotation / ROTATION_DIVISOR) * Math.PI) / 180,
    cf = Math.cos(f),
    sf = Math.sin(f);
  const [dx, dz] = d.door,
    ox = bx - (cf * dx + sf * dz),
    oz = bz - (-sf * dx + cf * dz);
  return { xPos: Math.round(ox / GLOBAL_SCALE), zPos: Math.round(RMB_DIMENSION - oz / GLOBAL_SCALE), yRotation };
}
/** A building's grid sector in its slice's location (world/tamrielCapitals.js capitalBlockNames: rows from the south). */
export const sectorOf = (r, c) => (7 - (r % 8)) * 8 + (c % 8);
const EMPTY_DATA = Object.freeze({
  Header: Object.freeze({
    Num3dObjectRecords: 0,
    NumFlatObjectRecords: 0,
    NumSection3Records: 0,
    NumPeopleRecords: 0,
    NumDoorRecords: 0,
  }),
  Block3dObjectRecords: [],
  BlockFlatObjectRecords: [],
  BlockSection3Records: [],
  BlockPeopleRecords: [],
  BlockDoorRecords: [],
});
let _interiors = new WeakMap();
/** A donor's interior, read from the player's BLOCKS.BSA once (the parsed record's own - read, never written): the cast a
 *  fabric building's own interior takes (IC-INTERIORS) - kept by the file it was read from. */
function donorInterior(blocksFile, d) {
  if (!blocksFile) return null;
  let byDonor = _interiors.get(blocksFile);
  if (!byDonor) {
    byDonor = new Map();
    _interiors.set(blocksFile, byDonor);
  }
  const k = `${d.block}#${d.record}`;
  if (!byDonor.has(k))
    byDonor.set(k, blocksFile.getBlockByName?.(d.block)?.rmbBlock?.subRecords?.[d.record]?.interior ?? null);
  return byDonor.get(k);
}
/** IC-INTERIORS: the buildings' own interiors, by the BLOCKS.BSA their casts were read from and the plot's key (an LRU a
 *  file - the same object every time a building is asked for while it is kept, its records made once). */
let _built = new WeakMap();
const BUILT_KEEP = 1024;
let _madeCount = 0;
/** The records a made interior makes when one of them is first read (RMB's subrecord interior's, interiorLayout.js's). */
const MADE_RECORDS = Object.freeze([
  'header',
  'block3dObjectRecords',
  'blockFlatObjectRecords',
  'blockSection3Records',
  'blockPeopleRecords',
  'blockDoorRecords',
]);
/**
 * IC-INTERIORS: A FABRIC BUILDING'S OWN INTERIOR (world/interior/fabricInterior.js) - its grid off its footprint and its
 * door (fabricInteriorGrid: its party walls blind), its plan off its pool, the storeys its walls show (its eave over a
 * storey, world/imperialFabric.js STOREY) and its plot's key, its record with its donor's cast (donorInterior) stood in
 * it. A MADE interior (world/interior/interiorLayout.js interiorCast): its records are made when one is first read - the
 * scene's layout, a quest's mount - and `cast` is its donor's, which a walk over the city's buildings reads instead (its
 * people's names and its quest markers, in the donor's frame: the questor pool, a quest's site search - thousands of
 * buildings a slice, none of them made). The same object for the same building and BLOCKS.BSA while it is kept.
 * @param {{ key: number, pool: string, donor: number, party?: number, plot: { q: number[][], h: number }, door: { at: number[], n: number[] }, cacheKey?: string }} b
 * @param {any} blocksFile
 */
export function fabricBuildingInterior(b, blocksFile) {
  const host = blocksFile ?? NO_FILE;
  let byKey = _built.get(host);
  if (!byKey) {
    byKey = new Map();
    _built.set(host, byKey);
  }
  const id = b.cacheKey ?? b.key; // RMB-CONTRACTS RMBC4: a settlement's building files under its own name, never an Imperial plot's hash
  let out = byKey.get(id);
  if (out) {
    byKey.delete(id);
    byKey.set(id, out);
    return out;
  }
  const cast = donorInterior(blocksFile, FABRIC_DONORS[b.donor]);
  /** @type {any} */
  let made = null;
  const record = () => {
    if (!made) {
      made = fabricInteriorRecord(fabricBuildingPlan(b), cast);
      _madeCount++;
    }
    return made;
  };
  out = { made: true, cast };
  for (const k of MADE_RECORDS) Object.defineProperty(out, k, { get: () => record()[k], enumerable: true });
  out = Object.freeze(out);
  byKey.set(id, out);
  if (byKey.size > BUILT_KEEP) byKey.delete(byKey.keys().next().value);
  return out;
}
const NO_FILE = Object.freeze({});
/** IC-INTERIORS: a fabric building's plan (world/interior/fabricInterior.js fabricInteriorPlan) - its grid off its footprint
 *  and its door, its party walls blind, the storeys its eave shows, its key the seed. */
export function fabricBuildingPlan(b) {
  const grid = fabricInteriorGrid(b.plot.q, b.door.at, b.door.n, b.party ?? 0);
  return fabricInteriorPlan({
    key: b.key,
    pool: b.pool,
    cells: grid.cells,
    blind: grid.blind,
    storeys: Math.floor(b.plot.h / STOREY + 1e-6),
  });
}
/** Test seam: the donors' interiors read again, the buildings' made again. */
export function _resetFabricInteriors() {
  _interiors = new WeakMap();
  _built = new WeakMap();
  _madeCount = 0;
}
/** Test seam (IC-INTERIORS): how many buildings' records have been made since the last reset - none by a walk over them. */
export const _fabricInteriorsMade = () => _madeCount;
/** A building's automap byte (RMBLayout's: its BuildingType + 1 - the town map's colour for it and its name's place). */
export const automapByteOf = (type) => (type + 1) & 0xff;
/**
 * A CELL'S OWN BLOCK WITH ITS BUILDINGS - the block's JSON as the city's family made it (world/imperialBlocks.js
 * imperialBlockJson, or the city's worker's), given each building's record (FldHeader.BuildingDataList: its type, its
 * quality, its faction, its name seed, its sector) and its subrecord (its door model, at subRecordFrame), its footprint's
 * automap bytes its type's, then read as the door reads every block (formats/worldData/worldDataReplacement.js
 * blockFromJson) - each subrecord's interior its own (IC-INTERIORS), its donor's cast read from the player's BLOCKS.BSA
 * when first asked. The block
 * names its own buildings (`ownNamedBuildings`: systems/talk/talkTopics.js drawNamedBuildings draws none of the
 * location's list for them). A far block, the lake's, a cell of no building, or no BLOCKS.BSA: handed back as it came.
 * @param {any} made @param {string} name @param {any} blocksFile
 */
export function withFabricBuildings(made, name, blocksFile) {
  const b = imperialBlockOf(name);
  if (!b || b.kind !== 'own' || !made?.RmbBlock || !blocksFile) return made;
  const { r, c } = b,
    recs = fabricCellBuildings(r, c);
  if (!recs.length) return made;
  installFabricDoors();
  const fh = made.RmbBlock.FldHeader;
  fh.BuildingDataList = fabricRecordsJson(r, c, recs);
  made.RmbBlock.SubRecords = recs.map((x) => {
    const id = fabricDoorModelId(x.donor);
    const door = {
      ModelId: String(id),
      ModelIdNum: id,
      ObjectType: 0,
      XPos: 0,
      YPos: 0,
      ZPos: 0,
      XRotation: 0,
      YRotation: 0,
      ZRotation: 0,
    };
    return fabricSubRecordJson(r, c, x, {
      ...EMPTY_DATA,
      Header: { ...EMPTY_DATA.Header, Num3dObjectRecords: 1 },
      Block3dObjectRecords: [door],
    });
  });
  // the town map's bytes: a building's footprint its type's (each automap cell whose middle stands in it)
  const auto = fh.AutoMapData;
  if (auto)
    for (const x of recs) {
      const q = x.plot.q,
        byte = automapByteOf(x.type);
      for (let ay = 0; ay < 64; ay++)
        for (let ax = 0; ax < 64; ax++) {
          const px = (c - HALF) * B + (ax + 0.5) * (B / 64),
            pz = (r + 1 - HALF) * B - (63 - ay + 0.5) * (B / 64);
          if (inQuad(q, px, pz)) auto[ay * 64 + ax] = byte;
        }
    }
  return withDonors(blockFromJson(made, imperialBlockIndex(name)), recs, blocksFile);
}
/** A cell's building records as its block's JSON holds them (FldHeader.BuildingDataList). */
const fabricRecordsJson = (r, c, recs) =>
  recs.map((x) => ({
    NameSeed: x.nameSeed,
    FactionId: x.factionId,
    Sector: sectorOf(r, c),
    LocationId: 0,
    BuildingType: x.type,
    Quality: x.quality,
  }));
/** A building's subrecord as its block's JSON holds it: placed at subRecordFrame, its exterior `exterior`. */
const fabricSubRecordJson = (r, c, x, exterior) => {
  const f = subRecordFrame(r, c, x);
  return { XPos: f.xPos, ZPos: f.zPos, YRotation: f.yRotation, Exterior: exterior, Interior: EMPTY_DATA };
};
/** A read block given its buildings' donors: each subrecord's interior the building's own (IC-INTERIORS -
 *  fabricBuildingInterior: its donor's cast in it), made when first asked, and the block naming its own buildings. */
function withDonors(block, recs, blocksFile) {
  block.rmbBlock.subRecords.forEach((sub, i) => {
    const b = recs[i];
    Object.defineProperty(sub, 'interior', {
      get: () => fabricBuildingInterior(b, blocksFile),
      enumerable: true,
      configurable: true,
    });
    sub.footprintM2 = areaOf(b.plot.q); // IC-HOMES: its ground, m2 - its one model a door, which measures no house (onlineHomes.js)
  });
  block.ownNamedBuildings = true;
  return block;
}
/**
 * QUEST-FABRIC (2026-10-26, the owner: "Let quests use them"; bible/06-Systems/Quest-Arc.md QUEST-FABRIC): A CELL'S
 * BUILDINGS AS A QUEST READS THEM - withFabricBuildings' records, subrecords and donors' interiors over an empty block,
 * without the cell's ground, models, lamps or town-map bytes. A quest's site search reads every block of a town
 * (systems/quest/place.js townBlockGrid); the made block is a cell's whole fabric, some 15 ms, and a temple's remote dart
 * over the city stood eighty slices of them - 83 s against 0.25 s. This is the same records at a cell's plan's price, and
 * never a block the scene's cache holds. Null for a block that is not a cell of the city's own, or with no BLOCKS.BSA (the
 * made block has no buildings then either).
 * @param {string} name @param {any} blocksFile
 */
export function fabricQuestBlock(name, blocksFile) {
  const b = imperialBlockOf(name);
  if (!b || b.kind !== 'own' || !blocksFile) return null;
  const { r, c } = b,
    recs = fabricCellBuildings(r, c);
  const json = {
    Name: name,
    RmbBlock: {
      FldHeader: { BuildingDataList: fabricRecordsJson(r, c, recs) },
      SubRecords: recs.map((x) => fabricSubRecordJson(r, c, x, EMPTY_DATA)),
    },
  };
  const block = blockFromJson(json, imperialBlockIndex(name));
  return recs.length ? withDonors(block, recs, blocksFile) : block;
}

/**
 * QUEST-FABRIC: THE KINDS A SLICE'S FABRIC GIVES A QUEST - each `type:faction` of a building of its own cells (the cells its
 * plan lays an own block in: world/imperialCity.js imperialCell's code, its block world/imperialBlocks.js imperialOwnName
 * of imperialCodeCell's cell) whose donor's interior holds a quest marker (`marked`, by FABRIC_DONORS' order), sorted. A
 * sites index's half for the fabric (systems/quest/place.js townSitesIndex reads a building's type and faction alone), laid
 * out cell by cell - some 0.1 s a slice, which is why it is baked (tools/bakeFabricSites.mjs, world/imperialFabricSites.js).
 * @param {number} s @param {readonly (boolean | number)[]} marked
 */
export function fabricSliceKindsOf(s, marked) {
  const sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN),
    kinds = new Set();
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const rc = imperialCodeCell(imperialCell(sy * 8 + i, sx * 8 + j));
      if (rc)
        for (const b of fabricCellBuildings(rc[0], rc[1])) if (marked[b.donor]) kinds.add(`${b.type}:${b.factionId}`);
    }
  return [...kinds].sort();
}
const _sliceSites = new Map();
/**
 * QUEST-FABRIC: SLICE `s`'S FABRIC AS A SITES INDEX READS IT - `{ buildingType, factionId }` of each kind fabricSliceKindsOf
 * gives, from the baked table (world/imperialFabricSites.js): the index's walk over the slice's Daggerfall blocks takes it
 * beside its own (scenes/questWorld.js sitesIndexOf), and never lays a cell out. Frozen; none for a slice past the plan.
 * @param {number} s
 */
export function fabricSliceSites(s) {
  const set = FABRIC_SLICE_SETS[s];
  if (set == null) return NO_SITES;
  let out = _sliceSites.get(set);
  if (!out) {
    out = Object.freeze(
      FABRIC_SITE_SETS[set]
        .split(' ')
        .filter(Boolean)
        .map((k) => {
          const [t, f] = k.split(':').map(Number);
          return Object.freeze({ buildingType: t, factionId: f });
        }),
    );
    _sliceSites.set(set, out);
  }
  return out;
}
const NO_SITES = Object.freeze([]);
/** QUEST-FABRIC: a block of no building, for the index's walk to read an own cell as (its fabric is fabricSliceSites'). */
export const FABRIC_NO_BUILDINGS = Object.freeze({
  name: '',
  ownNamedBuildings: true,
  rmbBlock: Object.freeze({
    fldHeader: Object.freeze({ buildingDataList: Object.freeze([]), numBlockDataRecords: 0 }),
    subRecords: Object.freeze([]),
  }),
});
/** QUEST-FABRIC: the donors whose interiors hold a quest marker, by FABRIC_DONORS' order (baked off BLOCKS.BSA). */
export const fabricDonorMarked = () => FABRIC_DONOR_MARKED;
