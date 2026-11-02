// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE CENSUS - who lives in a town, minted from the town itself.
//
// TWO ROLLS, BECAUSE TWO READERS. A traveller is read from far off - the roads near the player, a town a caravan is
// bound for, the dungeon an adventurer dives - where nothing but the MAPS row is at hand; so a town's TRAVELLERS
// (`travellerRoster`) are minted from its row alone (its size, its people, its region, its port). A town's HOUSEHOLDS
// (`householdCensus`) are minted from its buildings, read only for the town the player stands in. `townCensus` is the
// whole town: both, every traveller given a home among the households' houses.
//
// A RESIDENT IS A DFU TOWNSPERSON WHO KEEPS THEIR IDENTITY FOR LIFE (LW0 decision 4): RandomiseNPC's own parts -
// the climate's people for the billboard - a Redguard region's Redguards (REGIONAL-FOLK, characters/mobile/mobilePerson.js walkerRace;
// FIELD BUGS 2026-10-10) - (PERSON_TEXTURES, one of four outfits a sex), the talk portrait's record law
// (PERSON_FACE_RECORDS + one of 24), the region's name bank (MobilePersonNPC.cs:214) - drawn ONCE from the resident's
// seed instead of at every spawn. The watch rides GUARD_TEXTURE, male, outfit 0 (RandomiseNPC's guard arm). The armed -
// adventurers, sellswords, couriers - carry a CLASS too (LW0 decision 5): the sprite they wear beyond the walls.
//
// Slot ids are the town's and the slot's: `L<mapId>.<slot>` for a household, `L<mapId>.t<slot>` for a traveller,
// `L<mapId>.w<slot>` for the watch - the same person for every reader, the key a relation is saved under (relations.js).
import {
  PERSON_TEXTURES,
  PERSON_FACE_RECORDS,
  NUM_PERSON_FACE_VARIANTS,
  GUARD_TEXTURE,
  walkerRace,
  spriteRaceOf,
} from '../../characters/mobile/mobilePerson.js';
import {
  folkOfArea,
  folkOfRegion,
  folkRace,
  folkNameBank,
  withZone,
  folkKeyOf,
} from '../../characters/provinceFolk.js'; // PROVINCE-FOLK
import { fullName, GENDERS } from '../../characters/nameHelper.js';
import { seededPersonName } from '../../characters/personNames.js'; // REGION-NAMES: a resident named by their people's customs and their town's
import { nameBankOfArea } from '../../characters/areaNameBank.js'; // WW1: an area's people - the region's bank on the Bay
import { srand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { MOBILE_TYPES } from '../../characters/mobile/mobileTypes.js';
import { seededRng } from '../wind/wind.js';
import { lwSeed, rollInt, pickOf, pickWeighted } from './seed.js';

/** The most residents one town keeps - the households trimmed past it, plain hands first (a city's two hundred houses
 *  would otherwise mint six hundred people, and a day is drawn for each). */
export const CENSUS_MAX = 260;
/** LW-DENSE (the owner: "Depending on the size of the city, the living world should be more dense"): a town keeps more
 *  people the bigger it is - CENSUS_PER_BLOCK a block of its grid, never fewer than CENSUS_MAX nor more than CENSUS_CAP.
 *  Trimmed at CENSUS_MAX, a city of 42 blocks kept six a block and a village seventeen. */
export const CENSUS_PER_BLOCK = 10;
export const CENSUS_CAP = 520;
/** LW-DENSE: from CROWD_FROM_BLOCKS a town's houses are fuller - each holds houseCrowdOf(town) more on average, to CENSUS_CROWD_MAX
 *  at twice that size: minted after everyone the town kept before, on a roll of their own ('c'), so no id moves. */
export const CROWD_FROM_BLOCKS = 16;
export const CENSUS_CROWD_MAX = 2;
/** LW-DENSE: the crowd's stream, apart from the households' ('cr'), so every one minted before is as they were. */
const CROWD_SALT = 0x6372;
/** @param {LwTown} town */
export const censusMaxOf = (town) =>
  Math.max(CENSUS_MAX, Math.min(CENSUS_CAP, CENSUS_PER_BLOCK * Math.max(1, town.blocks | 0)));
/** @param {LwTown} town */
export const houseCrowdOf = (town) => {
  const b = Math.max(1, town.blocks | 0);
  return b < CROWD_FROM_BLOCKS ? 0 : Math.min(CENSUS_CROWD_MAX, (b - CROWD_FROM_BLOCKS) / CROWD_FROM_BLOCKS);
};

/** The climate's People -> the billboard tables' race: the walkers' one table (characters/mobile/mobilePerson.js, REGIONAL-FOLK). */
export { RACE_OF_PEOPLE, raceOfPeople } from '../../characters/mobile/mobilePerson.js';

/** What a resident does - the day's plan reads it (dayPlan.js), the lines read it (lines.js). */
export const JOBS = Object.freeze({
  keeper: 'keeper',
  helper: 'helper',
  smith: 'smith',
  clerk: 'clerk',
  scholar: 'scholar',
  innkeeper: 'innkeeper',
  server: 'server',
  priest: 'priest',
  guildsman: 'guildsman',
  courtier: 'courtier',
  guard: 'guard',
  labourer: 'labourer',
  farmer: 'farmer',
  fisher: 'fisher',
  crafter: 'crafter',
  homemaker: 'homemaker',
  beggar: 'beggar',
  merchant: 'merchant',
  mercenary: 'mercenary',
  adventurer: 'adventurer',
  sailor: 'sailor',
  pilgrim: 'pilgrim',
  courier: 'courier',
  pedlar: 'pedlar',
  // LW9 (bible/06-Systems/Living-World-II.md): the road's new traffic
  carter: 'carter',
  hunter: 'hunter',
  patrol: 'patrol',
  noble: 'noble',
  retainer: 'retainer',
  minstrel: 'minstrel',
});
/** The jobs that travel (trips.js): the traveller roster's own. */
export const TRAVELLER_JOBS = Object.freeze([
  'merchant',
  'mercenary',
  'adventurer',
  'sailor',
  'pilgrim',
  'courier',
  'pedlar',
]);
/** LW9: THE ROAD'S NEW TRAFFIC, APPENDED - a traveller's id is `L<mapId>.t<slot>`, dealt in the jobs' order, so a job
 *  anywhere but after every one before it would re-key the regard and the turns of every traveller after it (Living
 *  World II decision 9): these are dealt after TRAVELLER_JOBS' own, in this order. A farm's or a village's CARTER takes
 *  its produce to market; a HUNTER goes into the wild; a city's PATROL keeps the region's roads; its NOBLE goes in
 *  procession with their RETAINERS; its MINSTREL plays the taverns of the towns about. */
export const ROAD_JOBS = Object.freeze(['carter', 'hunter', 'patrol', 'noble', 'retainer', 'minstrel']);

/** The shops a keeper keeps, and the trade it makes them. */
const SHOP_JOB = Object.freeze({
  [BUILDING_TYPES.Alchemist]: 'keeper',
  [BUILDING_TYPES.Armorer]: 'smith',
  [BUILDING_TYPES.Bank]: 'clerk',
  [BUILDING_TYPES.Bookseller]: 'scholar',
  [BUILDING_TYPES.ClothingStore]: 'keeper',
  [BUILDING_TYPES.FurnitureStore]: 'keeper',
  [BUILDING_TYPES.GemStore]: 'keeper',
  [BUILDING_TYPES.GeneralStore]: 'keeper',
  [BUILDING_TYPES.Library]: 'scholar',
  [BUILDING_TYPES.PawnShop]: 'keeper',
  [BUILDING_TYPES.WeaponSmith]: 'smith',
});
/** A building a household lives in: House1-House6 (IsResidence is House1-4; 5 and 6 are lived in all the same). */
export const isHome = (type) => type >= BUILDING_TYPES.House1 && type <= BUILDING_TYPES.House6;
export const hasShopJob = (type) => Object.prototype.hasOwnProperty.call(SHOP_JOB, type);

/** The classes a traveller of each job walks out in (MOBILE_TYPES 128-145): an adventurer any of the eighteen, a
 *  sellsword the fighting ones, a courier the light-footed. */
export const ADVENTURER_CLASSES = Object.freeze([
  128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145,
]);
export const MERCENARY_CLASSES = Object.freeze([
  MOBILE_TYPES.Warrior,
  MOBILE_TYPES.Knight,
  MOBILE_TYPES.Barbarian,
  MOBILE_TYPES.Archer,
  MOBILE_TYPES.Ranger,
  MOBILE_TYPES.Spellsword,
  MOBILE_TYPES.Battlemage,
]);
export const COURIER_CLASSES = Object.freeze([MOBILE_TYPES.Acrobat, MOBILE_TYPES.Ranger, MOBILE_TYPES.Rogue]);
/** LW9: a hunter goes out with a bow; a noble's retainers are the fighting gentry's; a minstrel is a bard. */
export const HUNTER_CLASSES = Object.freeze([MOBILE_TYPES.Archer, MOBILE_TYPES.Ranger]);
export const RETAINER_CLASSES = Object.freeze([MOBILE_TYPES.Knight, MOBILE_TYPES.Warrior, MOBILE_TYPES.Archer]);

/**
 * @typedef {{ mapId: number, name?: string, px?: number, py?: number, type?: number, region?: number, area?: number, people?: number,
 *   blocks: number, w?: number, h?: number, port?: boolean, wild?: boolean }} LwTown - a town as its MAPS row says it (WW1: or
 *   a provider past the Bay - `area` what it is grouped by, the region on the Bay and the province past it, `region`
 *   MapsFile's, -1 past the Bay):
 *   `blocks` its RMB grid's cells, WALL-WAY `w` and `h` the grid's own width (east) and height (north), `people` the climate's (0 Nord, 2 Redguard, 3 Breton), `port` whether ships put in; LW9 `wild` no town - a
 *   hunter's point in the wild (trips.js wildTrip)
 * @typedef {{ key: number, type: number, quality?: number, factionId?: number }} LwBuilding - a building summary's own
 *   columns (world/buildingSummaries.js: buildingKey, buildingType, quality, factionId)
 * @typedef {{ id: string, town: number, slot: number, roll: 'h'|'t'|'w'|'q', name: string, gender: number, sex: 'male'|'female',
 *   race: string, variant: number, archive: number, face: number, guard: boolean, job: string, home: number|null,
 *   work: number|null, temper: 0|1|2, social: number, pious: number, drink: number, cls: number|null, level: number,
 *   faction: number, civvies?: number }} Resident - `gender` GENDERS' number (the walkers' own field), `sex` the class
 *   sprites' word; `temper` 0 a lark, 1 the day's own, 2 a night owl; `cls` the class sprite beyond the walls (null:
 *   none); WATCH-DAY `civvies` one of the watch's own clothes, off duty
 */

/** A resident's name: FullName on the bank, on the resident's own seed - DFU's global stream put back as it stood
 *  (shipCrew.js handName's pattern). @param {number} seed @param {number} bank @param {number} gender */
export function residentName(seed, bank, gender) {
  const saved = getSeed();
  try {
    srand(seed >>> 0 || 1);
    return fullName(bank, gender);
  } finally {
    setSeed(saved);
  }
}

/** The tempers by job: [lark, day, owl] weights. */
const TEMPER_OF = Object.freeze({
  farmer: [6, 3, 0],
  fisher: [6, 3, 0],
  carter: [6, 3, 0],
  hunter: [6, 3, 0],
  minstrel: [0, 3, 6],
  innkeeper: [0, 2, 6],
  server: [0, 2, 6],
  guard: [2, 6, 2],
  beggar: [1, 4, 3],
  adventurer: [1, 5, 3],
  mercenary: [1, 5, 3],
  sailor: [4, 4, 1],
  priest: [5, 4, 0],
});
const DEFAULT_TEMPER = Object.freeze([2, 7, 1]);

/**
 * One resident from the town, the roll, the slot and the job. LW4: `at.gen` - a NEWCOMER to a place the road emptied
 * (lives.js): the cycle of the death they came after, in the seed and the id (`L<map>.t<slot>~<gen>`), so the same
 * place holds the same newcomer for every reader.
 * @param {LwTown} town @param {'h'|'t'|'w'|'q'} roll @param {number} slot @param {string} job
 * @param {{ home?: number|null, work?: number|null, faction?: number, gen?: number|null }} [at]
 * @returns {Resident}
 */
export function mintResident(town, roll, slot, job, at = {}) {
  const gen = at.gen ?? null;
  const seed =
    gen == null
      ? lwSeed(town.mapId >>> 0, roll.charCodeAt(0), slot)
      : lwSeed(town.mapId >>> 0, roll.charCodeAt(0), slot, 0x67656e, gen); // 'gen'
  const rng = seededRng(seed);
  const climate = walkerRace(town.people, town.area ?? town.region); // REGIONAL-FOLK: a Redguard region's residents are Redguards (WW1: an area's - Hammerfell's past the Bay too)
  // PROVINCE-FOLK: past the Bay a resident is one of the province's people, on a stream of their own (the rest of them
  // is drawn as it was); their picture their race's where Daggerfall draws one, else the town's
  const people = withZone(
    town.area != null ? folkOfArea(town.area) : folkOfRegion(town.region ?? -1),
    town.px,
    town.py,
  ); // AUDIT PROVINCE-FOLK B6: its zone's
  const race = folkRace(people, lwSeed(seed, 0x666f6c6b)) ?? climate; // 'folk'
  const sprite = spriteRaceOf(race, climate);
  const guard = job === 'guard';
  const female = !guard && rng() < 0.5;
  const tables = PERSON_TEXTURES[sprite] ?? PERSON_TEXTURES.Breton;
  const set = female ? tables.female : tables.male;
  const variant = guard ? 0 : Math.floor(rng() * set.length);
  const faces = PERSON_FACE_RECORDS[sprite] ?? PERSON_FACE_RECORDS.Breton;
  const face = (female ? faces.female : faces.male)[variant] + Math.floor(rng() * NUM_PERSON_FACE_VARIANTS);
  const gender = female ? GENDERS.Female : GENDERS.Male;
  const w = TEMPER_OF[/** @type {keyof typeof TEMPER_OF} */ (job)] ?? DEFAULT_TEMPER;
  const temper = /** @type {0|1|2} */ (Number(pickWeighted(rng, { 0: w[0], 1: w[1], 2: w[2] }) ?? 1));
  const social = rng(),
    pious = rng(),
    drink = rng();
  let cls = null,
    level = rollInt(rng, 1, 5);
  if (job === 'adventurer') {
    cls = pickOf(rng, ADVENTURER_CLASSES);
    level = 1 + Math.floor(19 * Math.pow(rng(), 1.6));
  } else if (job === 'mercenary') {
    cls = pickOf(rng, MERCENARY_CLASSES);
    level = rollInt(rng, 3, 14);
  } else if (job === 'courier') {
    cls = pickOf(rng, COURIER_CLASSES);
    level = rollInt(rng, 2, 8);
  } else if (job === 'hunter') {
    cls = pickOf(rng, HUNTER_CLASSES);
    level = rollInt(rng, 2, 8);
  } // LW9
  else if (job === 'patrol') {
    cls = MOBILE_TYPES.Knight;
    level = rollInt(rng, 6, 14);
  } else if (job === 'retainer') {
    cls = pickOf(rng, RETAINER_CLASSES);
    level = rollInt(rng, 4, 12);
  } else if (job === 'minstrel') {
    cls = MOBILE_TYPES.Bard;
    level = rollInt(rng, 2, 8);
  } else if (job === 'guard') level = rollInt(rng, 5, 15);
  return {
    id: `L${town.mapId >>> 0}.${roll === 'h' ? '' : roll}${slot}${gen == null ? '' : `~${gen}`}`,
    town: town.mapId >>> 0,
    slot,
    roll,
    name: seededPersonName(
      seed ^ 0x5eed1e55,
      people ? folkNameBank(race) : nameBankOfArea(town.area ?? town.region ?? -1),
      gender,
      { race, region: town.area ?? town.region ?? -1, home: folkKeyOf(people) },
    ), // WW1: the region's bank on the Bay; PROVINCE-FOLK: past it their own people's; REGION-NAMES: their customs, their town's region's
    gender,
    sex: female ? 'female' : 'male',
    race,
    variant,
    archive: guard ? GUARD_TEXTURE : set[variant],
    face,
    guard,
    job,
    // WATCH-DAY: a watchman's own clothes, for off duty - one of his people's outfits, drawn on its own stream so the
    // rest of him is as he was
    ...(guard ? { civvies: tables.male[lwSeed(seed, 0x63697673) % tables.male.length] } : {}),
    home: at.home ?? null,
    work: at.work ?? null,
    temper,
    social,
    pious,
    drink,
    cls,
    level,
    faction: at.faction ?? 0,
  };
}

/** How many of each traveller a town of `blocks` keeps (a port its sailors). @param {LwTown} town */
export function travellerCounts(town) {
  const b = Math.max(1, town.blocks | 0);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    merchant: b >= 4 ? clamp(1 + Math.floor(b / 8), 1, 5) : b >= 2 ? 1 : 0,
    mercenary: b >= 9 ? clamp(Math.floor(b / 8), 1, 6) : 0,
    adventurer: b >= 4 ? clamp(1 + Math.floor(b / 10), 1, 6) : 0,
    sailor: town.port ? clamp(2 + Math.floor(b / 10), 2, 6) : 0,
    pilgrim: b >= 2 ? 1 + (b >= 16 ? 1 : 0) : 0,
    courier: b >= 16 ? 1 + (b >= 36 ? 1 : 0) : 0,
    pedlar: clamp(1 + Math.floor(b / 6), 1, 6),
  };
}

/** LW9: a place's MAPS location type (formats/mapsFile.js LOCATION_TYPES): a city, a hamlet, a village, a farm. */
const CITY = 0,
  HAMLET = 1,
  VILLAGE = 2,
  FARM = 3;
/** LW9: a city keeps a patrol, a noble and a minstrel from this many blocks (a palace's city). */
export const CITY_COURT_BLOCKS = 16;
/** LW9: how many of each of the road's new travellers a place keeps, by its kind and its size - a farm one carter; a
 *  hamlet or a village one and one more each four blocks, to three, and a hunter; a city of CITY_COURT_BLOCKS a patrol of
 *  two (one more each thirty-two blocks, to four), a noble and the noble's two retainers, and a minstrel from nine
 *  blocks. Never TRAVELLER_JOBS' own (travellerCounts, pinned whole). @param {LwTown} town */
export function roadCounts(town) {
  const b = Math.max(1, town.blocks | 0);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rural = town.type === HAMLET || town.type === VILLAGE || town.type === FARM;
  const court = town.type === CITY && b >= CITY_COURT_BLOCKS;
  return {
    carter: town.type === FARM ? 1 : rural ? clamp(1 + Math.floor(b / 4), 1, 3) : 0,
    hunter: rural ? 1 : 0,
    patrol: court ? clamp(2 + Math.floor(b / 32), 2, 4) : 0,
    noble: court ? 1 : 0,
    retainer: court ? 2 : 0,
    minstrel: town.type === CITY && b >= 9 ? 1 : 0,
  };
}

/** LW9: MORE OF THE ROAD'S OWN - the first roster's pedlars, pilgrims and couriers again, dealt AFTER the new traffic
 *  (every id before them unchanged): a pedlar more for every six blocks from two (to four), a pilgrim more from four
 *  blocks, a courier more from nine. Never a merchant (the sellswords are dealt to the merchants by their count:
 *  formCaravans' contract - one more would move every sellsword's contract) nor a sellsword. @param {LwTown} town */
export function moreCounts(town) {
  const b = Math.max(1, town.blocks | 0);
  return {
    pedlar: b >= 2 ? Math.max(1, Math.min(4, Math.floor(b / 6))) : 0,
    pilgrim: b >= 4 ? 1 : 0,
    courier: b >= 9 ? 1 : 0,
  };
}
/** LW9: the order MORE_JOBS are dealt in, after ROAD_JOBS. */
export const MORE_JOBS = Object.freeze(['pedlar', 'pilgrim', 'courier']);

/** LW-WIDE (the owner: "Living world NPCs should be more dense in the entire world, more travellers, more dungeon
 *  divers"): A FOURTH RANK OF THE ROAD'S OWN, dealt after MORE_JOBS - every id before it unchanged. Its adventurers are
 *  the divers (trips.js WIDE_DIVE_CHANCE), in companies of their own (companies.js); the rest more of the road's traffic. */
export const WIDE_JOBS = Object.freeze(['adventurer', 'pedlar', 'pilgrim', 'courier', 'hunter']);
/** LW-WIDE: how many of each a town keeps by its size - a village's one diver, a hamlet's two, a city's eight to ten; a
 *  pedlar more each eight blocks (to six); a pilgrim a town of four blocks and one more each 24; a courier from nine; a
 *  hunter more in the country. Never a merchant or a sellsword (formCaravans' contract). @param {LwTown} town */
export function wideCounts(town) {
  const b = Math.max(1, town.blocks | 0);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rural = town.type === HAMLET || town.type === VILLAGE || town.type === FARM;
  return {
    adventurer: b >= 2 ? clamp(1 + Math.floor(b / 5), 1, 10) : 0,
    pedlar: b >= 2 ? clamp(1 + Math.floor(b / 8), 1, 6) : 0,
    pilgrim: b >= 4 ? 1 + Math.floor(b / 24) : 0,
    courier: b >= 9 ? 1 + Math.floor(b / 30) : 0,
    hunter: rural ? (b >= 4 ? 2 : 1) : 0,
  };
}

/** WATCH-DAY: the watch's companies - one to each day of its rotation (dayPlan.js watchDuty: the day's shift, the
 *  evening's, the night's, the day off). */
export const WATCH_COMPANIES = 4;
/** WATCH-DAY: the watch a shift in a town of `blocks` - none in a hamlet; one in a village (a lone patrol), a pair from
 *  nine blocks, and a gate's post for each nine more, to six (a pair and four gates). @param {LwTown} town */
export const watchShiftSize = (town) => {
  const b = Math.max(1, town.blocks | 0);
  return b >= 2 ? Math.max(1, Math.min(6, 1 + Math.floor(b / 9))) : 0;
};
/** WATCH-LIFE (the owner: "Guards should have a more Living world presence"): a city's watch walks more patrols - a pair
 *  more a shift from 25 blocks, two from 40, three from 60 - after the shift's own (dayPlan.js watchDuty: a rank past
 *  watchShiftSize patrols), so no post nor gate's law moves. A city of 64 blocks kept one pair a shift. @param {LwTown} town */
export const watchExtraOf = (town) => {
  const b = Math.max(1, town.blocks | 0);
  return b >= 25 ? 2 * Math.min(3, Math.floor(b / 20)) : 0;
};
/** The watch a town of `blocks` keeps: none in a hamlet; WATCH-DAY: four companies of its strength a shift (four to
 *  twenty-four - the first cut kept two to twelve on two shifts, and nobody kept the night); WATCH-LIFE: its extra
 *  patrols too. @param {LwTown} town */
export const townWatchCount = (town) => WATCH_COMPANIES * (watchShiftSize(town) + watchExtraOf(town));

/**
 * THE TRAVELLERS - minted from the town's MAPS row alone (so a caravan seen on a road far from its town is the same
 * caravan its town's readers see). Each job's slots in TRAVELLER_JOBS order, numbered on from 0. LW-WIDE: `wideFrom` the
 * fourth rank's first slot.
 * @param {LwTown} town @returns {Resident[] & { wideFrom: number }}
 */
export function travellerRoster(town) {
  const counts = travellerCounts(town);
  const out = [];
  let slot = 0;
  for (const job of TRAVELLER_JOBS) {
    for (let i = 0; i < counts[/** @type {keyof ReturnType<typeof travellerCounts>} */ (job)]; i++)
      out.push(mintResident(town, 't', slot++, job));
  }
  // LW9: the road's new traffic after them (ROAD_JOBS - every id before it unchanged)
  const more = roadCounts(town);
  for (const job of ROAD_JOBS) {
    for (let i = 0; i < more[/** @type {keyof ReturnType<typeof roadCounts>} */ (job)]; i++)
      out.push(mintResident(town, 't', slot++, job));
  }
  const again = moreCounts(town);
  for (const job of MORE_JOBS) {
    for (let i = 0; i < again[/** @type {keyof ReturnType<typeof moreCounts>} */ (job)]; i++)
      out.push(mintResident(town, 't', slot++, job));
  }
  // LW-WIDE: the fourth rank after them, its first slot kept on the roster (a place's holder any cycle is one of it by slot)
  const wideFrom = slot;
  const wide = wideCounts(town);
  for (const job of WIDE_JOBS) {
    for (let i = 0; i < wide[/** @type {keyof ReturnType<typeof wideCounts>} */ (job)]; i++)
      out.push(mintResident(town, 't', slot++, job));
  }
  return Object.assign(out, { wideFrom });
}
/** LW-WIDE: whether `res` holds a place of the roster's fourth rank. @param {{ slot: number }} res @param {any} roster */
export const isWidePlace = (res, roster) => res?.slot >= (roster?.wideFrom ?? Infinity);

/** The town's watch, minted from the row alone too (a crime is answered by a person the player may have met). @param {LwTown} town */
export function watchRoster(town) {
  const out = [];
  for (let i = 0, n = townWatchCount(town); i < n; i++) out.push(mintResident(town, 'w', i, 'guard'));
  return out;
}

/**
 * THE HOUSEHOLDS - minted from the town's buildings: each house its family of one to three, each shop its keeper (and
 * a hand at a good one), each tavern its keeper and its servers, each temple two priests, each guild hall two members,
 * the palace two of its court. The trades are dealt to the houses' people in a seeded order; a trade left over lives
 * where it works; a house's people left over take the common work of the town (a port's fishing, a village's fields,
 * a city's beggars and labourers). Trimmed to the town's cap (LW-DENSE censusMaxOf), the common hands first.
 * IC-GRAND: `quarter` a town of quarters' other quarter's (places.js): its households minted on their own roll and slots
 * ('q', the quarter's thousand) off a stream of their own, so no two of a town's people share an identity.
 * @param {LwTown} town @param {readonly LwBuilding[]} buildings @param {{ quarter?: number }} [o] @returns {Resident[]}
 */
export function householdCensus(town, buildings, { quarter = 0 } = {}) {
  const rng = seededRng(quarter ? lwSeed(town.mapId >>> 0, 0x686f, quarter) : lwSeed(town.mapId >>> 0, 0x686f)); // 'ho'
  const list = [...(buildings ?? [])].filter((b) => b && Number.isFinite(b.key)).sort((a, b) => a.key - b.key);
  const houses = list.filter((b) => isHome(b.type));
  /** @type {{ job: string, work: number|null, faction: number, livesAt: number|null }[]} */
  const trades = [];
  for (const b of list) {
    const q = b.quality ?? 0;
    if (hasShopJob(b.type)) {
      trades.push({ job: SHOP_JOB[b.type], work: b.key, faction: b.factionId ?? 0, livesAt: null });
      if (q >= 12 && rng() < 0.5) trades.push({ job: 'helper', work: b.key, faction: b.factionId ?? 0, livesAt: null });
    } else if (b.type === BUILDING_TYPES.Tavern) {
      trades.push({ job: 'innkeeper', work: b.key, faction: b.factionId ?? 0, livesAt: b.key });
      for (let i = 0, n = q >= 12 ? 2 : 1; i < n; i++)
        trades.push({ job: 'server', work: b.key, faction: b.factionId ?? 0, livesAt: b.key });
    } else if (b.type === BUILDING_TYPES.Temple) {
      for (let i = 0; i < 2; i++)
        trades.push({ job: 'priest', work: b.key, faction: b.factionId ?? 0, livesAt: b.key });
    } else if (b.type === BUILDING_TYPES.GuildHall) {
      for (let i = 0; i < 2; i++)
        trades.push({ job: 'guildsman', work: b.key, faction: b.factionId ?? 0, livesAt: null });
    } else if (b.type === BUILDING_TYPES.Palace) {
      for (let i = 0; i < 2; i++)
        trades.push({ job: 'courtier', work: b.key, faction: b.factionId ?? 0, livesAt: b.key });
    }
  }
  // the houses' people, each house its family
  /** @type {number[]} */
  const people = [];
  for (const h of houses) {
    const r = rng();
    const n = r < 0.25 ? 1 : r < 0.75 ? 2 : 3;
    for (let i = 0; i < n; i++) people.push(h.key);
  }
  // the trades dealt to the people in a seeded order (a Fisher-Yates on the town's own stream)
  const order = people.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const blocks = Math.max(1, town.blocks | 0);
  /** The common work of the town: a port fishes, a village farms, a city has its beggars. */
  const commonJob = (r = rng) => {
    const w = {
      labourer: blocks >= 9 ? 5 : 2,
      farmer: blocks >= 16 ? 0.5 : 5,
      fisher: town.port ? 3 : 0,
      crafter: 3,
      homemaker: 4,
      beggar: blocks >= 16 ? 0.6 : 0,
    };
    return pickWeighted(r, w) ?? 'labourer';
  };
  /** @type {{ job: string, home: number|null, work: number|null, faction: number }[]} */
  const placed = [];
  let k = 0;
  for (const t of trades) {
    if (t.livesAt != null) {
      placed.push({ job: t.job, home: t.livesAt, work: t.work, faction: t.faction });
      continue;
    }
    if (k < order.length) {
      placed.push({ job: t.job, home: people[order[k++]], work: t.work, faction: t.faction });
      continue;
    }
    placed.push({ job: t.job, home: t.work, work: t.work, faction: t.faction }); // no house left: lives where it works
  }
  const common = [];
  for (; k < order.length; k++) common.push({ job: commonJob(), home: people[order[k]], work: null, faction: 0 });
  // trimmed: the trades kept whole, the common hands to the cap - LW-DENSE: the town's, by its size
  const max = censusMaxOf(town);
  const keep = placed.concat(common.slice(0, Math.max(0, max - placed.length)));
  // LW-DENSE: a city's houses fuller - each house its houseCrowdOf share more, of the common work, after everyone kept above
  const crowd = houseCrowdOf(town);
  if (crowd > 0 && keep.length < max) {
    const crng = seededRng(
      quarter ? lwSeed(town.mapId >>> 0, CROWD_SALT, quarter) : lwSeed(town.mapId >>> 0, CROWD_SALT),
    );
    for (const h of houses) {
      const n = Math.floor(crowd) + (crng() < crowd % 1 ? 1 : 0);
      for (let i = 0; i < n && keep.length < max; i++)
        keep.push({ job: commonJob(crng), home: h.key, work: null, faction: 0 });
    }
  }
  return keep.map((p, slot) =>
    mintResident(town, quarter ? 'q' : 'h', quarter * QUARTER_SLOTS + slot, p.job, {
      home: p.home,
      work: p.work,
      faction: p.faction,
    }),
  );
}
/** IC-GRAND: a quarter's households' slots begin at its number times this (CENSUS_CAP a quarter at the most). */
export const QUARTER_SLOTS = 1000;
/**
 * IC-GRAND: A TOWN OF QUARTERS' PEOPLE (places.js `quarters`) - its own quarter's as townCensus mints a town's (its
 * households, its watch, its travellers, homed on its own quarter's doors), and each other quarter's households of that
 * quarter's buildings alone (householdCensus's `quarter`): each lives and works in its quarter. `opens` each quarter's
 * buildings (the keys of its door spots), the town's own first; a building of none counts as the town's own quarter's
 * (a home off the net: always in, as townCensus keeps it).
 * @param {LwTown} town @param {readonly LwBuilding[]} buildings @param {ReadonlyArray<ReadonlySet<number>>} opens
 * @returns {Resident[]}
 */
export function quarterCensus(town, buildings, opens) {
  const elsewhere = (/** @type {LwBuilding} */ b) => opens.some((keys, q) => q > 0 && keys.has(b.key));
  const out = townCensus(
    town,
    (buildings ?? []).filter((b) => b && !elsewhere(b)),
    opens[0],
  );
  for (let q = 1; q < opens.length; q++)
    out.push(
      ...householdCensus(
        town,
        (buildings ?? []).filter((b) => b && opens[q].has(b.key)),
        { quarter: q },
      ),
    );
  return out;
}

/**
 * THE TOWN - its households, its watch and its travellers, every traveller and every one of the watch given a home:
 * a house of the town (the slot's own pick, so the same house for every reader), the palace for the watch where there
 * is one, the tavern for an adventurer with no house to go to. LW-WALLS: `opens` the buildings whose doors open onto
 * the town's street (places.js - the keys of its door spots), where the town knows them: the watch's and a traveller's
 * home is one of those - the palace inside its own walled grounds (a separate street, its gate a covered cell, in 14 of
 * the game's 322 cities with a palace) kept the whole watch in, and a doorless house its watchman. A household keeps the
 * house it is minted from (its slot is its identity).
 * @param {LwTown} town @param {readonly LwBuilding[]} buildings @param {ReadonlySet<number>|null} [opens] @returns {Resident[]}
 */
export function townCensus(town, buildings, opens = null) {
  const households = householdCensus(town, buildings);
  const open = (/** @type {LwBuilding} */ b) => !opens || opens.has(b.key);
  const houses = (buildings ?? [])
    .filter((b) => b && isHome(b.type) && open(b))
    .map((b) => b.key)
    .sort((a, b) => a - b);
  const palace = (buildings ?? []).find((b) => b?.type === BUILDING_TYPES.Palace && open(b))?.key ?? null;
  const tavern = (buildings ?? [])
    .filter((b) => b?.type === BUILDING_TYPES.Tavern && open(b))
    .map((b) => b.key)
    .sort((a, b) => a - b);
  const homeOf = (r) => {
    const pick = lwSeed(r.town, r.roll.charCodeAt(0), r.slot, 0x686d); // 'hm'
    if (r.guard && palace != null) return palace;
    if (r.job === 'adventurer' && tavern.length && (!houses.length || (pick & 3) === 0))
      return tavern[pick % tavern.length];
    return houses.length ? houses[pick % houses.length] : tavern.length ? tavern[pick % tavern.length] : null;
  };
  const others = [...watchRoster(town), ...travellerRoster(town)].map((r) => ({ ...r, home: homeOf(r) }));
  return households.concat(others);
}
