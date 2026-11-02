// @ts-check
// TESA8 (2026-10-12, the owner: "Populating the world with its own dungeons"; bible/03-World/Arena-Provinces.md TESA8) -
// THE LAIRS PAST THE BAY: labyrinths, keeps, ruins and graveyards as thick on the ground as the Bay's, each laid
// out of Daggerfall's own dungeon blocks in a plan of its own - never a copy of a Bay dungeon's. Pure: the world host
// (scenes/world.js `_locationToBuild`) asks it of a pixel past the Bay that Arena's places and the countryside (TESA7,
// world/tamrielCountry.js) leave free, as the pixel builds, and stands the answer in its index.
//
// THE CELL. A dungeon an 8 x 8 cell of the countryside's grid (COUNTRY_GRID) at most, on the one pixel of the cell its hash
// names (lairSite) - so its cell's index is its identity, 19 bits, unique (tamrielCountry.js LAIR_LANE). Its chance is the
// Bay's: each climate's count of each kind over the Bay's land (tamrielCountry.js countryCounts, bayLand, countryRates over
// LAIR_TYPES), times the cell's 64 pixels, at most 1 (the Bay's thickest, its Woodlands, 1.02: every cell there stands one).
// The kind is the cell's roll in proportion; the template off the cell's hash in map-id order.
//
// THE PLAN IS ITS OWN (lairLayout, GenerateSmallerDungeon's law widened - world/smallerDungeons.js): as many interior blocks
// as the template has (Daggerfall's own sizes for that kind: a labyrinth 1 to 9, a keep or a ruin 2 to 4, a graveyard 1),
// grown cell by cell from the starting block into a shape of the dungeon's own on DFRandom seeded on its map id, each an
// interior block of the template's DUNGEON TYPE (a crypt's, a mine's, a spider nest's - every one MAPS.BSA lays for that
// type, so its foes and its look are the type's) laid once where the pool allows; the starting block one MAPS.BSA starts a
// dungeon in; every open side closed by a border block. The exterior (the entrance's ground) is the template's.
//
// THE NAME is the dungeon type's frame (a crypt's "The Barrow of %m", a gaol's "The Gaol of %s", a coven's "The Cabal of
// %w") round a stem: the province's people's for the people's places (world/tamrielPeople.js), DFU's own monster banks for
// the beasts' and the dead's (characters/nameHelper.js monsterName: Monster1 the orcs', Monster2 the daedra's, Monster3 the
// lords of the dead); a ruin is "Ruins of" a country place's name; a keep a castle's. The frames are the port's own words
// in the shape MAPS.BSA's names take.
import { mapPixelToLongitudeLatitude, LOCATION_TYPES, DUNGEON_TYPES } from '../formats/mapsFile.js';
import { hash32 } from './spawnedDungeons.js';
import { srand, rand, getSeed, setSeed } from '../formats/dfRandom.js';
import { firstName, monsterName, GENDERS, BANK_TYPES, withGameNameBanks } from '../characters/nameHelper.js';   // AUDIT TESA II P10: a lair's name on the game's own banks
import { COUNTRY_GRID, LAIR_LANE, countryName } from './tamrielCountry.js';
import { WATER_BYTE } from './roadsProducer.js';   // TESA14: the beach line a lair stands over
import { onGhostfence } from './tamriel/ghostfence.js';   // GHOSTFENCE: no lair on the Ghostfence's line
import { redMountainLavaIn } from './tamriel/redMountain.js';   // LAVA-CLEAR: nor where Red Mountain's lava runs

/** The cell hash's salt. Changing it moves every lair. */
export const LAIR_SALT = 0xd0c7;
/** The kinds, in the roll's order. */
export const LAIR_TYPES = Object.freeze([LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep, LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard]);
/** A cell's side, pixels. */
export const LAIR_CELL = 8;
/** The cells' grid: COUNTRY_GRID's, a cell LAIR_CELL pixels. */
export const LAIR_COLS = (1 << COUNTRY_GRID.wBits) / LAIR_CELL;
export const LAIR_ROWS = COUNTRY_GRID.h / LAIR_CELL;
/** The location indices count down from here, past the countryside's (-2,000,000 and down 2^25). */
export const LAIR_INDEX_BASE = 40000000;

/** The cell a pixel is in - its index, or -1 off the grid. */
export function lairCellOf(px, py) {
  const x = px + COUNTRY_GRID.x0, y = py + COUNTRY_GRID.y0;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= LAIR_COLS * LAIR_CELL || y >= LAIR_ROWS * LAIR_CELL) return -1;
  return Math.floor(y / LAIR_CELL) * LAIR_COLS + Math.floor(x / LAIR_CELL);
}
/** The one pixel of a cell a dungeon may stand on. */
export function lairSite(c) {
  const cx = c % LAIR_COLS, cy = Math.floor(c / LAIR_COLS), h = hash32(LAIR_SALT, cx, cy, 1);
  return { px: cx * LAIR_CELL + (h % LAIR_CELL) - COUNTRY_GRID.x0, py: cy * LAIR_CELL + ((h >>> 3) % LAIR_CELL) - COUNTRY_GRID.y0 };
}
/** A cell's map id, and its location index. */
export const lairPlaceId = (c) => ((LAIR_LANE << 20) | 0x80000 | c) >>> 0;
export const lairLocationIndex = (c) => -(LAIR_INDEX_BASE + c);
/** FIND-FOUND: a lair's map id read back to its pixel (lairPlaceId's inverse, its cell's site); null for any other id. */
export function lairPixelOfId(id) {
  const v = Number(id) >>> 0;
  if (((v >>> 20) & 0xfff) !== LAIR_LANE || (v & 0x80000) === 0) return null;
  const s = lairSite(v & 0x7ffff);
  return { x: s.px, y: s.py };
}

const idOf = (l) => (l?.mapTableData?.mapId ?? 0) >>> 0;
const isBorder = (b) => /^b/i.test(b?.blockName ?? '');
const interiorCount = (l) => l.dungeon.blocks.filter((b) => !isBorder(b)).length;

/**
 * THE TEMPLATES from the game's rows: a list a kind (LAIR_TYPES), in map-id order - an exterior and a dungeon with blocks
 * and at least one interior block; never a main-story place (`isMain`) nor one the port made.
 * @param {Iterable<any>} rows @param {(mapId: number) => boolean} [isMain]
 * @returns {Map<number, any[]>}
 */
export function lairTemplates(rows, isMain = () => false) {
  const list = [...(rows ?? [])].filter((l) => l?.exterior?.exteriorData && l.hasDungeon && l.dungeon?.blocks?.length && interiorCount(l) > 0
    && !l.spawned && !l.ether && !l.arena && !l.country && !isMain(idOf(l)));
  const out = new Map();
  for (const type of LAIR_TYPES) out.set(type, list.filter((l) => l.mapTableData?.locationType === type).sort((a, b) => idOf(a) - idOf(b)));
  return out;
}

/**
 * THE BLOCK POOLS of each dungeon type, off every template's blocks in map-id order: its interior blocks, the ones a
 * dungeon starts in, its border blocks - each name once, as first met.
 * @param {Map<number, any[]>} templates
 * @returns {Map<number, { interior: any[], start: any[], border: any[] }>}
 */
export function lairPools(templates) {
  const out = new Map();
  const all = [...templates.values()].flat().sort((a, b) => idOf(a) - idOf(b));
  for (const l of all) {
    const t = l.mapTableData?.dungeonType;
    if (!out.has(t)) out.set(t, { interior: [], start: [], border: [], seen: new Set() });
    const pool = out.get(t);
    for (const b of l.dungeon.blocks) {
      const k = `${isBorder(b) ? 'b' : b.isStartingBlock ? 's' : 'i'}:${b.blockName}`;
      if (!pool.seen.has(k)) {
        pool.seen.add(k);
        (isBorder(b) ? pool.border : b.isStartingBlock ? pool.start : pool.interior).push(b);
      }
      if (!isBorder(b) && b.isStartingBlock && !pool.seen.has(`i:${b.blockName}`)) { pool.seen.add(`i:${b.blockName}`); pool.interior.push(b); }
    }
  }
  for (const pool of out.values()) delete pool.seen;
  return out;
}

/**
 * WHAT A CELL STANDS by its roll: its kind (its site's climate's rates, times the cell's pixels, at most 1, the kind in
 * proportion) and its template (its list off the cell's hash) - or null.
 * @param {Map<number, Array<[number, number]>>} rates countryRates over LAIR_TYPES
 * @param {Map<number, any[]>} templates @param {number} climate @param {number} c the cell
 * @returns {?{ type: number, template: any }}
 */
export function lairPick(rates, templates, climate, c) {
  const steps = rates?.get(climate);
  if (!steps || c < 0) return null;
  const total = steps[steps.length - 1][1];
  const chance = Math.min(1, total * LAIR_CELL * LAIR_CELL);
  const cx = c % LAIR_COLS, cy = Math.floor(c / LAIR_COLS);
  const r = hash32(LAIR_SALT, cx, cy, 2) / 4294967296;
  if (r >= chance) return null;
  const t = (r / chance) * total;
  const step = steps.find(([, ceiling]) => t < ceiling) ?? steps[steps.length - 1];
  const list = templates?.get(step[0]);
  if (!list?.length) return null;
  return { type: step[0], template: list[hash32(LAIR_SALT, cx, cy, 3) % list.length] };
}

/**
 * TESA14: WHAT THE LAIRS STAND ON A PIXEL PAST THE BAY - the one roll the world host's build (scenes/world.js lairRollAt),
 * the held map's atlas and the roads' worker all read: where the pixel is its cell's one site and the cell's roll stands
 * one (lairPick), on the countryside's ground law (over the beach line, its plateau clear of the sea's edge) - `{ c, pick }`
 * or null. Whether it is laid out at all is lairPlanned's.
 * @param {{ rates: Map<number, Array<[number, number]>>, templates: ?Map<number, any[]>, climateAt: (x: number, y: number) => number,
 *   heightAt: (x: number, y: number) => number, ground: (x: number, y: number) => boolean }} at @param {number} px @param {number} py
 */
export function lairStandsAt({ rates, templates, climateAt, heightAt, ground }, px, py) {
  const c = templates ? lairCellOf(px, py) : -1;
  const site = c >= 0 ? lairSite(c) : null;
  const pick = site && site.px === px && site.py === py && !onGhostfence(px, py) && !redMountainLavaIn(px, py) ? lairPick(rates, templates, climateAt(px, py), c) : null;   // GHOSTFENCE: none on its line; LAVA-CLEAR: nor in the lava
  return pick && heightAt(px, py) > WATER_BYTE && ground(px, py) ? { c, pick } : null;
}
/** AUDIT TESA II Z7/Z9: MAY a lair stand on (px, py) - lairStandsAt without its dry plateau (tamrielCountry.js
 *  countryMayStandAt's law). @param {{ rates: any, templates: any, climateAt: (x: number, y: number) => number, heightAt: (x: number, y: number) => number }} roll */
export function lairMayStandAt({ rates, templates, climateAt, heightAt }, px, py) {
  const c = templates ? lairCellOf(px, py) : -1;
  const site = c >= 0 ? lairSite(c) : null;
  return !!(site && site.px === px && site.py === py && !onGhostfence(px, py) && !redMountainLavaIn(px, py) && lairPick(rates, templates, climateAt(px, py), c)) && heightAt(px, py) > WATER_BYTE;
}
/** TESA14: a lair template's interior blocks - its plan's size (a border block is none). */
export const lairBlockCount = (template) => template.dungeon.blocks.filter((b) => !/^b/i.test(b.blockName)).length;
/** TESA14: can a lair of a dungeon type's pool, `count` blocks, be laid out - lairLayout's one refusal. */
export const lairPlanned = (pool, count) => !!(pool?.interior.length && pool.start.length && pool.border.length && count >= 1);

/** The four sides, in the closing order: north, west, east, south (GenerateSmallerDungeon's). */
const SIDES = Object.freeze([[0, -1], [-1, 0], [1, 0], [0, 1]]);

/**
 * THE PLAN: `count` interior blocks grown from (0, 0) - each step a laid block's side, both drawn on DFRandom - the first
 * the starting block (from the type's starting pool), the rest from its interior pool, a block laid once while the pool
 * has one not laid (the next round from the drawn one, MEDIUM-DISTINCT's way); then every open side of every interior
 * block, in laying order and SIDES order, closed by a border block. DFRandom seeded on `seed` (the map id, as
 * GenerateSmallerDungeon seeds it), the stream's state put back after. Null for a type with no pool.
 * @param {{ interior: any[], start: any[], border: any[] } | undefined} pool @param {number} count @param {number} seed
 * @returns {?any[]}
 */
export function lairLayout(pool, count, seed) {
  if (!lairPlanned(pool, count)) return null;
  const saved = getSeed();
  try {
    srand(seed >>> 0);
    const cells = [[0, 0]], at = new Set(['0,0']);
    for (let guard = 0; cells.length < count && guard < count * 64; guard++) {
      const [x, z] = cells[rand() % cells.length];
      const [dx, dz] = SIDES[rand() % 4];
      const k = `${x + dx},${z + dz}`;
      if (!at.has(k)) { at.add(k); cells.push([x + dx, z + dz]); }
    }
    const laid = new Set();
    const draw = (list) => {
      let i = rand() % list.length;
      for (let k = 0; k < list.length && laid.has(list[i].blockName); k++) i = (i + 1) % list.length;
      laid.add(list[i].blockName);
      return list[i];
    };
    const blocks = cells.map(([x, z], i) => ({ ...draw(i === 0 ? pool.start : pool.interior), x, z, isStartingBlock: i === 0 }));
    const closed = new Set();
    for (const [x, z] of cells) {
      for (const [dx, dz] of SIDES) {
        const k = `${x + dx},${z + dz}`;
        if (at.has(k) || closed.has(k)) continue;
        closed.add(k);
        blocks.push({ ...pool.border[rand() % pool.border.length], x: x + dx, z: z + dz, isStartingBlock: false });
      }
    }
    return blocks;
  } finally {
    setSeed(saved);
  }
}

/** The stems: %s the province's people's surname-like stem (tamrielCountry.js's), %w a woman's first name, %m a monster
 *  bank's name (the frame's bank). */
const M_ORC = BANK_TYPES.Monster1, M_DAEDRA = BANK_TYPES.Monster2, M_LORD = BANK_TYPES.Monster3;
/** The dungeon types' frames and the monster bank their %m draws on. */
export const LAIR_NAME_FRAMES = Object.freeze({
  [DUNGEON_TYPES.Crypt]: [M_LORD, ['The Crypt of %m', 'The Tomb of %m', 'The Barrow of %m', 'The Sepulcher of %m', 'The Cairn of %m', 'The Vault of %m']],
  [DUNGEON_TYPES.OrcStronghold]: [M_ORC, ['%m']],
  [DUNGEON_TYPES.HumanStronghold]: [null, ['Castle %s', 'Tower %s', "%s's Guard", "%s's Hold", 'The Fortress of %s', 'The Stronghold of %s']],
  [DUNGEON_TYPES.Prison]: [null, ['The Gaol of %s', 'The %s Prison', 'The Prison of %s', "%s's Gaol", 'The Dungeon of %s', 'The %s Reformatory']],
  [DUNGEON_TYPES.DesecratedTemple]: [M_DAEDRA, ['The %m Manse', '%m Minster', 'The %m Hermitage', 'The %m Shrine', 'The Cathedral of %m', 'The Abbey of %m']],
  [DUNGEON_TYPES.Mine]: [null, ['The %s Pit', 'The Quarry of %s', 'The %s Tunnel', 'The %s Lode', 'The %s Excavation', 'The %s Mines']],
  [DUNGEON_TYPES.NaturalCave]: [M_DAEDRA, ['The %m Cave', 'The Hole of %m', '%m Hollow', 'The %m Cavern', 'The Lair of %m', 'The Cavern of %m']],
  [DUNGEON_TYPES.Coven]: [null, ['The %w Coven', 'The %w Tradition', 'The Cabal of %w', '%w Cultus', 'The Cult of %w']],
  [DUNGEON_TYPES.VampireHaunt]: [M_LORD, ['The House of %m', 'The Haunt of %m', 'The Manor of %m', 'The Hall of %m']],
  [DUNGEON_TYPES.Laboratory]: [null, ['%s Laboratory', 'The %s Academy', 'The Laboratory of %s']],
  [DUNGEON_TYPES.HarpyNest]: [M_ORC, ['The %m Nest', 'The Aviary of %m', 'The Roost of %m', 'The %m Mews', 'The %m Aerie', 'The Nest of %m']],
  [DUNGEON_TYPES.RuinedCastle]: [null, ["%s's Guard", 'The Citadel of %s', 'The Hold of %s', "%s's Hold", 'Tower %s', 'The Fortress of %s']],
  [DUNGEON_TYPES.SpiderNest]: [M_ORC, ["%m's Nest", 'The %m Web', "%m's Web", 'The %m Nest']],
  [DUNGEON_TYPES.GiantStronghold]: [M_ORC, ['%m']],
  [DUNGEON_TYPES.DragonsDen]: [M_DAEDRA, ['The Den of %m', "%m's Den", 'The Lair of %m']],
  [DUNGEON_TYPES.BarbarianStronghold]: [null, ['The %w Assembly', 'The Convocation of %w', 'The %w Council', 'The Circle of %w', 'The %w Convergence']],
  [DUNGEON_TYPES.VolcanicCaves]: [M_DAEDRA, ['The %m Cave', 'The %m Hole', 'The Hole of %m', '%m Hollow', 'The %m Cavern']],
  [DUNGEON_TYPES.ScorpionNest]: [M_ORC, ['The %m Web', 'The Web of %m', "%m's Nest", 'The %m Nest']],
  [DUNGEON_TYPES.Cemetery]: [null, ['The Tombs of %s', 'The %s Cemetery', 'The %s Vaults', 'The %s Graveyard', 'The Graves of %s', 'The Crypts of %s', 'The %s Burial Ground']],
});
/** A keep's frames, whatever its dungeon type: a castle's. */
export const KEEP_FRAMES = Object.freeze(['Castle %s', 'The Fortress of %s', 'The Citadel of %s', "%s's Guard", "%s's Hold", 'Tower %s', 'The Hold of %s']);
/** What a ruin was: the country kinds it is "Ruins of", and a keep. */
const RUIN_OF = Object.freeze([LOCATION_TYPES.HomeFarms, LOCATION_TYPES.HomeWealthy, LOCATION_TYPES.HomePoor, LOCATION_TYPES.DungeonKeep]);

const pick = (list) => list[rand() % list.length];
/** The province's surname-like stem, through the countryside's own law (its %s frame drawn bare). */
const peopleStem = (bank) => countryName(LOCATION_TYPES.TownHamlet, bank, rand());

/**
 * A LAIR'S NAME: a keep a castle's frame, a ruin "Ruins of" a country place's or a keep's name, any other its
 * dungeon type's frame - round the province's people's stems or the frame's monster bank, drawn on DFRandom off `seed`,
 * the stream's state put back after. The empty string for a dungeon type with no frame.
 * @param {number} type its location type @param {number} dungeonType @param {number} bank the province's name bank
 * @param {number} seed
 */
export function lairName(type, dungeonType, bank, seed) {
  return withGameNameBanks(() => lairNameDrawn(type, dungeonType, bank, seed));   // AUDIT TESA II P10: a place's name is the world's - every client's alike, whatever NameGen.txt a translation installed
}
function lairNameDrawn(type, dungeonType, bank, seed) {
  const saved = getSeed();
  try {
    srand(seed >>> 0);
    const fill = (frame, monster) => frame.replace(/%[swm]/g, (m) => (m === '%s' ? peopleStem(bank)
      : m === '%w' ? firstName(bank, GENDERS.Female) : monsterName(/** @type {any} */ (rand() & 1 ? GENDERS.Female : GENDERS.Male), () => 0, monster)));
    if (type === LOCATION_TYPES.DungeonKeep) return fill(pick(KEEP_FRAMES), null);
    if (type === LOCATION_TYPES.DungeonRuin) {
      const was = pick(RUIN_OF);
      return `Ruins of ${was === LOCATION_TYPES.DungeonKeep ? fill(pick(KEEP_FRAMES), null) : countryName(was, bank, rand())}`;
    }
    const entry = LAIR_NAME_FRAMES[dungeonType];
    return entry ? fill(pick(entry[1]), entry[0]) : '';
  } finally {
    setSeed(saved);
  }
}
/** A cell's name seed. */
export const lairNameSeed = (c) => hash32(LAIR_SALT, c % LAIR_COLS, Math.floor(c / LAIR_COLS), 4);

/**
 * A LAIR'S LOCATION: the template cloned onto its cell's site - its id (the map row's, the exterior's location and
 * map ids, its record's header, the dungeon's record's header), the pixel's longitude and latitude, its name, the region
 * the host says, its own location index, no harbour, its own plan (`blocks`; the header's count with it), and `country`
 * (its pixel, kind, template and cell - the countryside's flag: nothing clones a place it made).
 * @param {any} template
 * @param {{ c: number, px: number, py: number, type: number, name: string, blocks: any[] }} place
 * @param {{ regionIndex?: number, regionName?: string, politic?: number, climate?: any }} [where]
 */
export function synthesizeLairLocation(template, place, where = {}) {
  const mapId = lairPlaceId(place.c);
  const ll = mapPixelToLongitudeLatitude(place.px, place.py);
  return {
    ...template,
    name: place.name,
    regionIndex: where.regionIndex ?? template.regionIndex,
    regionName: where.regionName ?? template.regionName,
    politic: where.politic ?? template.politic,
    climate: where.climate ?? template.climate,
    locationIndex: lairLocationIndex(place.c),
    mapTableData: { ...template.mapTableData, mapId, longitude: ll.x, latitude: ll.y },
    exterior: {
      ...template.exterior,
      exteriorData: { ...template.exterior?.exteriorData, locationId: mapId, mapId, portTownAndUnknown: 0 },
      ...(template.exterior?.recordElement ? { recordElement: { ...template.exterior.recordElement, header: { ...template.exterior.recordElement.header, locationId: mapId } } } : {}),
    },
    dungeon: {
      ...template.dungeon,
      header: template.dungeon?.header ? { ...template.dungeon.header, blockCount: place.blocks.length } : template.dungeon?.header,
      recordElement: { ...template.dungeon?.recordElement, header: { ...template.dungeon?.recordElement?.header, locationId: mapId } },
      blocks: place.blocks,
    },
    country: Object.freeze({ px: place.px, py: place.py, type: place.type, template: idOf(template), cell: place.c, dungeon: true }),
  };
}
