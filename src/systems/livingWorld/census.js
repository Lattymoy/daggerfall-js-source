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
// the climate's people for the billboard (PERSON_TEXTURES, one of four outfits a sex), the talk portrait's record law
// (PERSON_FACE_RECORDS + one of 24), the region's name bank (MobilePersonNPC.cs:214) - drawn ONCE from the resident's
// seed instead of at every spawn. The watch rides GUARD_TEXTURE, male, outfit 0 (RandomiseNPC's guard arm). The armed -
// adventurers, sellswords, couriers - carry a CLASS too (LW0 decision 5): the sprite they wear beyond the walls.
//
// Slot ids are the town's and the slot's: `L<mapId>.<slot>` for a household, `L<mapId>.t<slot>` for a traveller,
// `L<mapId>.w<slot>` for the watch - the same person for every reader, the key a relation is saved under (relations.js).
import { PERSON_TEXTURES, PERSON_FACE_RECORDS, NUM_PERSON_FACE_VARIANTS, GUARD_TEXTURE } from '../../characters/mobilePerson.js';
import { fullName, getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { srand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { MOBILE_TYPES } from '../../characters/mobileTypes.js';
import { seededRng } from '../wind.js';
import { lwSeed, rollInt, pickOf, pickWeighted } from './seed.js';

/** The most residents one town keeps - the households trimmed past it, plain hands first (a city's two hundred houses
 *  would otherwise mint six hundred people, and a day is drawn for each). */
export const CENSUS_MAX = 260;

/** The climate's People (FactionFile numbering, as the walkers' race reads it) -> the billboard tables' race. */
export const RACE_OF_PEOPLE = Object.freeze({ 0: 'Nord', 2: 'Redguard', 3: 'Breton' });
/** @param {number|undefined} people */
export const raceOfPeople = (people) => RACE_OF_PEOPLE[/** @type {0|2|3} */ (people)] ?? 'Breton';

/** What a resident does - the day's plan reads it (dayPlan.js), the lines read it (lines.js). */
export const JOBS = Object.freeze({
  keeper: 'keeper', helper: 'helper', smith: 'smith', clerk: 'clerk', scholar: 'scholar', innkeeper: 'innkeeper',
  server: 'server', priest: 'priest', guildsman: 'guildsman', courtier: 'courtier', guard: 'guard',
  labourer: 'labourer', farmer: 'farmer', fisher: 'fisher', crafter: 'crafter', homemaker: 'homemaker', beggar: 'beggar',
  merchant: 'merchant', mercenary: 'mercenary', adventurer: 'adventurer', sailor: 'sailor', pilgrim: 'pilgrim',
  courier: 'courier', pedlar: 'pedlar',
});
/** The jobs that travel (trips.js): the traveller roster's own. */
export const TRAVELLER_JOBS = Object.freeze(['merchant', 'mercenary', 'adventurer', 'sailor', 'pilgrim', 'courier', 'pedlar']);

/** The shops a keeper keeps, and the trade it makes them. */
const SHOP_JOB = Object.freeze({
  [BUILDING_TYPES.Alchemist]: 'keeper', [BUILDING_TYPES.Armorer]: 'smith', [BUILDING_TYPES.Bank]: 'clerk',
  [BUILDING_TYPES.Bookseller]: 'scholar', [BUILDING_TYPES.ClothingStore]: 'keeper', [BUILDING_TYPES.FurnitureStore]: 'keeper',
  [BUILDING_TYPES.GemStore]: 'keeper', [BUILDING_TYPES.GeneralStore]: 'keeper', [BUILDING_TYPES.Library]: 'scholar',
  [BUILDING_TYPES.PawnShop]: 'keeper', [BUILDING_TYPES.WeaponSmith]: 'smith',
});
/** A building a household lives in: House1-House6 (IsResidence is House1-4; 5 and 6 are lived in all the same). */
export const isHome = (type) => type >= BUILDING_TYPES.House1 && type <= BUILDING_TYPES.House6;
export const hasShopJob = (type) => Object.prototype.hasOwnProperty.call(SHOP_JOB, type);

/** The classes a traveller of each job walks out in (MOBILE_TYPES 128-145): an adventurer any of the eighteen, a
 *  sellsword the fighting ones, a courier the light-footed. */
export const ADVENTURER_CLASSES = Object.freeze([128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145]);
export const MERCENARY_CLASSES = Object.freeze([MOBILE_TYPES.Warrior, MOBILE_TYPES.Knight, MOBILE_TYPES.Barbarian, MOBILE_TYPES.Archer,
  MOBILE_TYPES.Ranger, MOBILE_TYPES.Spellsword, MOBILE_TYPES.Battlemage]);
export const COURIER_CLASSES = Object.freeze([MOBILE_TYPES.Acrobat, MOBILE_TYPES.Ranger, MOBILE_TYPES.Rogue]);

/**
 * @typedef {{ mapId: number, name?: string, px?: number, py?: number, type?: number, region?: number, people?: number,
 *   blocks: number, port?: boolean }} LwTown - a town as its MAPS row says it: `blocks` its RMB grid's cells, `people`
 *   the climate's (0 Nord, 2 Redguard, 3 Breton), `port` whether ships put in
 * @typedef {{ key: number, type: number, quality?: number, factionId?: number }} LwBuilding - a building summary's own
 *   columns (world/buildingSummaries.js: buildingKey, buildingType, quality, factionId)
 * @typedef {{ id: string, town: number, slot: number, roll: 'h'|'t'|'w', name: string, gender: number, sex: 'male'|'female',
 *   race: string, variant: number, archive: number, face: number, guard: boolean, job: string, home: number|null,
 *   work: number|null, temper: 0|1|2, social: number, pious: number, drink: number, cls: number|null, level: number,
 *   faction: number }} Resident - `gender` GENDERS' number (the walkers' own field), `sex` the class sprites' word;
 *   `temper` 0 a lark, 1 the day's own, 2 a night owl; `cls` the class sprite beyond the walls (null: none)
 */

/** A resident's name: FullName on the bank, on the resident's own seed - DFU's global stream put back as it stood
 *  (shipCrew.js handName's pattern). @param {number} seed @param {number} bank @param {number} gender */
export function residentName(seed, bank, gender) {
  const saved = getSeed();
  try {
    srand((seed >>> 0) || 1);
    return fullName(bank, gender);
  } finally { setSeed(saved); }
}

/** The tempers by job: [lark, day, owl] weights. */
const TEMPER_OF = Object.freeze({
  farmer: [6, 3, 0], fisher: [6, 3, 0], innkeeper: [0, 2, 6], server: [0, 2, 6], guard: [2, 6, 2], beggar: [1, 4, 3],
  adventurer: [1, 5, 3], mercenary: [1, 5, 3], sailor: [4, 4, 1], priest: [5, 4, 0],
});
const DEFAULT_TEMPER = Object.freeze([2, 7, 1]);

/**
 * One resident from the town, the roll, the slot and the job. LW4: `at.gen` - a NEWCOMER to a place the road emptied
 * (lives.js): the cycle of the death they came after, in the seed and the id (`L<map>.t<slot>~<gen>`), so the same
 * place holds the same newcomer for every reader.
 * @param {LwTown} town @param {'h'|'t'|'w'} roll @param {number} slot @param {string} job
 * @param {{ home?: number|null, work?: number|null, faction?: number, gen?: number|null }} [at]
 * @returns {Resident}
 */
export function mintResident(town, roll, slot, job, at = {}) {
  const gen = at.gen ?? null;
  const seed = gen == null ? lwSeed(town.mapId >>> 0, roll.charCodeAt(0), slot) : lwSeed(town.mapId >>> 0, roll.charCodeAt(0), slot, 0x67656e, gen);   // 'gen'
  const rng = seededRng(seed);
  const race = raceOfPeople(town.people);
  const guard = job === 'guard';
  const female = !guard && rng() < 0.5;
  const tables = PERSON_TEXTURES[race] ?? PERSON_TEXTURES.Breton;
  const set = female ? tables.female : tables.male;
  const variant = guard ? 0 : Math.floor(rng() * set.length);
  const faces = PERSON_FACE_RECORDS[race] ?? PERSON_FACE_RECORDS.Breton;
  const face = (female ? faces.female : faces.male)[variant] + Math.floor(rng() * NUM_PERSON_FACE_VARIANTS);
  const gender = female ? GENDERS.Female : GENDERS.Male;
  const w = TEMPER_OF[/** @type {keyof typeof TEMPER_OF} */ (job)] ?? DEFAULT_TEMPER;
  const temper = /** @type {0|1|2} */ (Number(pickWeighted(rng, { 0: w[0], 1: w[1], 2: w[2] }) ?? 1));
  const social = rng(), pious = rng(), drink = rng();
  let cls = null, level = rollInt(rng, 1, 5);
  if (job === 'adventurer') { cls = pickOf(rng, ADVENTURER_CLASSES); level = 1 + Math.floor(19 * Math.pow(rng(), 1.6)); }
  else if (job === 'mercenary') { cls = pickOf(rng, MERCENARY_CLASSES); level = rollInt(rng, 3, 14); }
  else if (job === 'courier') { cls = pickOf(rng, COURIER_CLASSES); level = rollInt(rng, 2, 8); }
  else if (job === 'guard') level = rollInt(rng, 5, 15);
  return {
    id: `L${town.mapId >>> 0}.${roll === 'h' ? '' : roll}${slot}${gen == null ? '' : `~${gen}`}`,
    town: town.mapId >>> 0, slot, roll,
    name: residentName(seed ^ 0x5eed1e55, getNameBankOfRegion(town.region ?? -1), gender),
    gender, sex: female ? 'female' : 'male', race, variant,
    archive: guard ? GUARD_TEXTURE : set[variant], face, guard, job,
    home: at.home ?? null, work: at.work ?? null, temper, social, pious, drink, cls, level, faction: at.faction ?? 0,
  };
}

/** How many of each traveller a town of `blocks` keeps (a port its sailors). @param {LwTown} town */
export function travellerCounts(town) {
  const b = Math.max(1, town.blocks | 0);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    merchant: b >= 4 ? clamp(1 + Math.floor(b / 8), 1, 5) : (b >= 2 ? 1 : 0),
    mercenary: b >= 9 ? clamp(Math.floor(b / 8), 1, 6) : 0,
    adventurer: b >= 4 ? clamp(1 + Math.floor(b / 10), 1, 6) : 0,
    sailor: town.port ? clamp(2 + Math.floor(b / 10), 2, 6) : 0,
    pilgrim: b >= 2 ? 1 + (b >= 16 ? 1 : 0) : 0,
    courier: b >= 16 ? 1 + (b >= 36 ? 1 : 0) : 0,
    pedlar: clamp(1 + Math.floor(b / 6), 1, 6),
  };
}

/** The watch a town of `blocks` keeps: none in a hamlet, two to twelve in a town. @param {LwTown} town */
export const townWatchCount = (town) => {
  const b = Math.max(1, town.blocks | 0);
  return b >= 4 ? Math.max(2, Math.min(12, 1 + Math.floor(b / 4))) : (b >= 2 ? 1 : 0);
};

/**
 * THE TRAVELLERS - minted from the town's MAPS row alone (so a caravan seen on a road far from its town is the same
 * caravan its town's readers see). Each job's slots in TRAVELLER_JOBS order, numbered on from 0.
 * @param {LwTown} town @returns {Resident[]}
 */
export function travellerRoster(town) {
  const counts = travellerCounts(town);
  const out = [];
  let slot = 0;
  for (const job of TRAVELLER_JOBS) {
    for (let i = 0; i < counts[/** @type {keyof ReturnType<typeof travellerCounts>} */ (job)]; i++) out.push(mintResident(town, 't', slot++, job));
  }
  return out;
}

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
 * a city's beggars and labourers). Trimmed to CENSUS_MAX, the common hands first.
 * @param {LwTown} town @param {readonly LwBuilding[]} buildings @returns {Resident[]}
 */
export function householdCensus(town, buildings) {
  const rng = seededRng(lwSeed(town.mapId >>> 0, 0x686f));   // 'ho'
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
      for (let i = 0, n = q >= 12 ? 2 : 1; i < n; i++) trades.push({ job: 'server', work: b.key, faction: b.factionId ?? 0, livesAt: b.key });
    } else if (b.type === BUILDING_TYPES.Temple) {
      for (let i = 0; i < 2; i++) trades.push({ job: 'priest', work: b.key, faction: b.factionId ?? 0, livesAt: b.key });
    } else if (b.type === BUILDING_TYPES.GuildHall) {
      for (let i = 0; i < 2; i++) trades.push({ job: 'guildsman', work: b.key, faction: b.factionId ?? 0, livesAt: null });
    } else if (b.type === BUILDING_TYPES.Palace) {
      for (let i = 0; i < 2; i++) trades.push({ job: 'courtier', work: b.key, faction: b.factionId ?? 0, livesAt: b.key });
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
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const blocks = Math.max(1, town.blocks | 0);
  /** The common work of the town: a port fishes, a village farms, a city has its beggars. */
  const commonJob = () => {
    const w = {
      labourer: blocks >= 9 ? 5 : 2, farmer: blocks >= 16 ? 0.5 : 5, fisher: town.port ? 3 : 0, crafter: 3, homemaker: 4,
      beggar: blocks >= 16 ? 0.6 : 0,
    };
    return pickWeighted(rng, w) ?? 'labourer';
  };
  /** @type {{ job: string, home: number|null, work: number|null, faction: number }[]} */
  const placed = [];
  let k = 0;
  for (const t of trades) {
    if (t.livesAt != null) { placed.push({ job: t.job, home: t.livesAt, work: t.work, faction: t.faction }); continue; }
    if (k < order.length) { placed.push({ job: t.job, home: people[order[k++]], work: t.work, faction: t.faction }); continue; }
    placed.push({ job: t.job, home: t.work, work: t.work, faction: t.faction });   // no house left: lives where it works
  }
  const common = [];
  for (; k < order.length; k++) common.push({ job: commonJob(), home: people[order[k]], work: null, faction: 0 });
  // trimmed: the trades kept whole, the common hands to the cap
  const keep = placed.concat(common.slice(0, Math.max(0, CENSUS_MAX - placed.length)));
  return keep.map((p, slot) => mintResident(town, 'h', slot, p.job, { home: p.home, work: p.work, faction: p.faction }));
}

/**
 * THE TOWN - its households, its watch and its travellers, every traveller and every one of the watch given a home:
 * a house of the town (the slot's own pick, so the same house for every reader), the palace for the watch where there
 * is one, the tavern for an adventurer with no house to go to.
 * @param {LwTown} town @param {readonly LwBuilding[]} buildings @returns {Resident[]}
 */
export function townCensus(town, buildings) {
  const households = householdCensus(town, buildings);
  const houses = (buildings ?? []).filter((b) => b && isHome(b.type)).map((b) => b.key).sort((a, b) => a - b);
  const palace = (buildings ?? []).find((b) => b?.type === BUILDING_TYPES.Palace)?.key ?? null;
  const tavern = (buildings ?? []).filter((b) => b?.type === BUILDING_TYPES.Tavern).map((b) => b.key).sort((a, b) => a - b);
  const homeOf = (r) => {
    const pick = lwSeed(r.town, r.roll.charCodeAt(0), r.slot, 0x686d);   // 'hm'
    if (r.guard && palace != null) return palace;
    if (r.job === 'adventurer' && tavern.length && (!houses.length || (pick & 3) === 0)) return tavern[pick % tavern.length];
    return houses.length ? houses[pick % houses.length] : (tavern.length ? tavern[pick % tavern.length] : null);
  };
  const others = [...watchRoster(town), ...travellerRoster(town)].map((r) => ({ ...r, home: homeOf(r) }));
  return households.concat(others);
}
