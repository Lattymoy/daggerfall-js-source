// @ts-check
// LEGACY-HOME (2026-10-05, bible/06-Systems/Legacy-Arc.md section 10b; Mac: "I think your bloodline should be visible
// when not playing, and if a house is owned should live in the house ... With the ability to switch by interacting with
// them or by using the ui"): THE BLOODLINE IN THE WORLD - the law, pure. Who of the line stands in the world, in which
// house, as which Living World resident (systems/livingWorld/census.js's Resident shape, so the town's own day plans,
// walkers, rooms and talk carry them), and what they call the one played.
//
//  - WHO: a living member of the blood who is not the one played - never played, or PARKED (their newest save made in
//    one of the family's houses: `parked`), or retired to the seat. A member whose save stands anywhere else is on their
//    own journey and stands nowhere: what is seen and what is saved are one thing.
//  - WHERE: the family's HOUSES are every house a member has held (`family.houses`, each row its holder's - a house is a
//    character's own deed, banking.js, and the family's by being one of theirs). THE FAMILY HOME is the one the player
//    marks (`family.home`), else the one in the family's seat, else the first. A parked member lives in their own
//    house; the never-played and the retired live in the family home - or, with no house at all, in the family's seat
//    as its townsfolk, in a house of the town lent to the line (Mac's answer).
//  - AS WHOM: a resident of their town - a home, the homemaker's day (asleep at home by night, about the town by day),
//    their own name, sex and class (the census's `cls`, the class sprite a resident wears beyond the walls), an outfit
//    and a face of the town's tables in the street, and their own chargen head in the talk window.
//  - A HOUSE OF THE FAMILY'S holds the line and no one else (scenes/world.js livingIndoors' `only`); a kin struck down
//    dies in the record (legacyHost.js kinSlain), never in the town's lives.
import { CLASS_CAREERS } from '../chargen.js';
import { isAlive, personOf, fullNameOf, isCustomCareer } from './family.js';
import { PERSON_TEXTURES, PERSON_FACE_RECORDS } from '../../characters/mobilePerson.js';
import { GENDERS } from '../../characters/nameHelper.js';
import { raceArt, FACES_PER_RACE } from '../races.js';

/** A family resident's id - `F<familyId>.<personId>`: never a census id (`L...`), so the town's books keep them apart. */
export const familyResId = (familyId, personId) => `F${familyId}.${personId}`;
/** The id read back: `{ familyId, personId }`, or null for any other resident. */
export function familyResOf(id) {
  const m = /^F(.+)\.(\d+)$/.exec(String(id ?? ''));
  return m ? { familyId: m[1], personId: Number(m[2]) } : null;
}
/** One of the line among a town's residents - a member (`F<familyId>.<personId>`) or a spouse who wed in, who keeps
 *  their census id (LEGACY5): the `legacy` tag says whose they are. */
export const isFamilyRes = (res) => !!res?.legacy && Number.isInteger(res.legacy.personId);

/** The day a family resident keeps: the homemaker's (systems/livingWorld/dayPlan.js) - home-centred, the market and the
 *  town by day, findable. */
export const FAMILY_JOB = 'homemaker';
/** A family resident's census roll letter, and the slot offset that keeps their day's seed apart from the census's. */
export const FAMILY_ROLL = 'f';
export const FAMILY_SLOT_BASE = 9000;
/** Stock careers draw as their class's own sprite - the class enemies' 128 + index (net/remotePlayers.js classMobileType). */
export const CLASS_MOBILE_BASE = 128;

/** A house row: where it stands and whose deed it is. */
const houseKey = (h) => `${h?.mapId | 0}:${h?.buildingKey | 0}`;
export const sameHouse = (a, b) => !!a && !!b && houseKey(a) === houseKey(b);

/**
 * THE FAMILY'S HOUSES, as the one played holds them now: their own rows replaced by what they hold (a deed bought,
 * sold or slept away - banking.js deedStands - changes the line's houses with it), every other member's kept. Answers
 * whether anything changed. ACCOUNT-HOMES: `whole` - what is held is the line's every house (online, the account's
 * homes), and nothing another member learned is kept past it.
 * @param {any} family @param {number} personId @param {{ regionIndex:number, mapId:number, buildingKey:number, location?:string }[]} held
 * @param {{ whole?: boolean }} [opts]
 */
export function syncHouses(family, personId, held, { whole = false } = {}) {
  const mine = (held ?? []).filter((h) => (h?.buildingKey | 0) > 0 && (h?.mapId | 0) !== 0)
    .map((h) => ({ regionIndex: h.regionIndex | 0, mapId: h.mapId | 0, buildingKey: h.buildingKey | 0, location: String(h.location ?? ''), by: personId }));
  // AUDIT LEGACY II A5: the rows keep their places - one sold leaves its place, one bought joins at the end. Rebuilt
  // with the one played's rows last, "the first house" (the family home with none marked and none in the seat) was
  // always another member's, and the line moved house at every switch
  // ACCOUNT-HOMES (2026-10-06): `whole` - the held are every house of the line (online: the account's homes, each every
  // member's), so a row any member learned goes once it is not among them (another character of the account sold it)
  const was = family.houses ?? [];
  const next = was.filter((h) => (!whole && h.by !== personId) || mine.some((m) => sameHouse(m, h)));
  for (const m of mine) if (!next.some((h) => sameHouse(h, m))) next.push(m);
  if (JSON.stringify(next) === JSON.stringify(was)) return false;
  family.houses = next;
  return true;
}

/** THE FAMILY HOME: the house the player marked, else the one in the family's seat, else the first; null with none. */
export function familyHome(family) {
  const houses = family?.houses ?? [];
  if (!houses.length) return null;
  return houses.find((h) => sameHouse(h, family.home))
    ?? (family.seat?.loc ? houses.find((h) => h.location === family.seat.loc) : null)
    ?? houses[0];
}

/** Mark a house of the family's as the family home. Answers whether it is one of theirs. */
export function setFamilyHome(family, house) {
  const h = (family?.houses ?? []).find((x) => sameHouse(x, house));
  if (!h) return false;
  family.home = { mapId: h.mapId, buildingKey: h.buildingKey };
  return true;
}

/**
 * WHERE A MEMBER LIVES: `{ mapId, buildingKey, lent }` - a house of the family's (`lent` false), or, with no house, the
 * family's seat town (`lent` true, the building the host lends in that town) - or null: not of the blood, dead, the one
 * played, or on their own journey (played and saved anywhere but one of the family's houses).
 * @param {any} family @param {any} p
 */
export function homeOf(family, p) {
  if (!family || !p || !isAlive(p) || p.kind !== 'member' || p.id === family.currentId) return null;
  const houses = family.houses ?? [];
  if (p.characterId && p.retired == null) {
    const parked = p.parked ? houses.find((h) => sameHouse(h, p.parked)) : null;
    return parked ? { mapId: parked.mapId, buildingKey: parked.buildingKey, lent: false } : null;
  }
  const home = familyHome(family);
  if (home) return { mapId: home.mapId, buildingKey: home.buildingKey, lent: false };
  const seat = family.seat?.mapId ? family.seat.mapId | 0 : 0;
  return seat ? { mapId: seat, buildingKey: 0, lent: true } : null;
}

/** The members who stand in the world, each with where they live: `[{ person, home }]`. */
export function householdOf(family) {
  return (family?.people ?? []).map((p) => ({ person: p, home: homeOf(family, p) })).filter((x) => !!x.home);
}

/** A climate's tables for a race the town's walkers have no outfit for - the three human tables, by build. */
const outfitRaceOf = (race) => (race === 'Nord' || race === 'Redguard' || race === 'Breton' ? race
  : race === 'Khajiit' || race === 'Argonian' ? 'Redguard' : 'Breton');
/** A small stable hash of a string (the outfit's and the face's pick, the same every day). */
function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * THE MEMBER AS A RESIDENT of their town - the census's own shape (systems/livingWorld/census.js Resident), so the
 * town's day plans, walkers, rooms and talk carry them, and `legacy` saying whose they are. `home.buildingKey` the house
 * they live in (the lent one already resolved by the host when `home.lent`).
 * @param {any} family @param {any} p @param {{ mapId:number, buildingKey:number }} home
 */
export function residentOf(family, p, home) {
  const sex = p.gender === 'female' ? 'female' : 'male';
  const outfitRace = outfitRaceOf(p.race);
  const pick = hashOf(`${family.id}:${p.id}`);
  const set = PERSON_TEXTURES[outfitRace][sex];
  const variant = pick % set.length;
  const faces = PERSON_FACE_RECORDS[outfitRace][sex];
  const stock = Number.isInteger(p.careerIndex) && p.careerIndex >= 0 && p.careerIndex < CLASS_CAREERS.length && !isCustomCareer(p);
  return {
    id: familyResId(family.id, p.id), town: home.mapId >>> 0, slot: FAMILY_SLOT_BASE + p.id, roll: FAMILY_ROLL,
    name: fullNameOf(p.given, p.surname), gender: sex === 'female' ? GENDERS.Female : GENDERS.Male, sex, race: p.race,
    variant, archive: set[variant], face: faces[variant] + ((pick >>> 8) % 24), guard: false, job: FAMILY_JOB,
    home: home.buildingKey | 0, work: null, temper: 1, social: 0.6, pious: 0.4, drink: 0.2,
    cls: stock ? CLASS_MOBILE_BASE + p.careerIndex : null, level: Math.max(1, p.level | 0), faction: 0,
    legacy: { familyId: family.id, personId: p.id },
    household: `F${family.id}`,   // AUDIT LEGACY II B2: their own household, never the census house they may be lent (livingTown.js householdKeyOf)
    portrait: { archive: raceArt(p.race, sex).heads, record: Math.max(0, Math.min(FACES_PER_RACE - 1, p.face | 0)) },   // their own chargen head in the talk window (ui/nativeTalk.js setNpcPortrait)
    look: p.look ?? null,   // LEGACY7 part four: what they wore at their newest save - drawn in it, as an online peer is (world/familyBodies.js); none, the town's outfit
  };
}

// ---- kinship ---------------------------------------------------------------------------------------------------------

const ancestorsOf = (family, p, depth) => {
  const out = new Map();
  let ring = [p];
  for (let d = 1; d <= depth; d++) {
    const next = [];
    for (const x of ring) for (const id of x?.parents ?? []) { const q = personOf(family, id); if (q && !out.has(q.id)) { out.set(q.id, d); next.push(q); } }
    ring = next;
  }
  return out;
};

/**
 * WHAT `other` IS TO `viewer`: 'father' | 'mother' | 'son' | 'daughter' | 'brother' | 'sister' | 'grandfather' |
 * 'grandmother' | 'grandson' | 'granddaughter' | 'uncle' | 'aunt' | 'nephew' | 'niece' | 'husband' | 'wife' | 'cousin'
 * | 'kin'. The founder's generation, parentless, are siblings of one another (family.js siblingsOf's own root arm).
 * AUDIT LEGACY III A10/F8/U5: blood words are the blood's - one wed in (a spouse, the parent of no one here) is the
 * house's 'kin' to everyone but their own spouse and children: parentless in the record, they were the founder's
 * brother or sister, or every sibling's cousin.
 */
export function kinOf(family, viewer, other, depth = 0) {
  if (!viewer || !other || viewer.id === other.id || depth > 1) return 'kin';   // AUDIT LEGACY II A9: bounded - a damaged record's cycle never recurses
  const m = other.gender === 'female';
  if (viewer.spouse === other.id) return m ? 'wife' : 'husband';
  const up = ancestorsOf(family, viewer, 3), down = ancestorsOf(family, other, 3);
  if (up.get(other.id) === 1) return m ? 'mother' : 'father';
  if (up.get(other.id) === 2) return m ? 'grandmother' : 'grandfather';
  if (down.get(viewer.id) === 1) return m ? 'daughter' : 'son';
  if (down.get(viewer.id) === 2) return m ? 'granddaughter' : 'grandson';
  if ((viewer.kind ?? 'member') !== 'member' || (other.kind ?? 'member') !== 'member') return 'kin';   // an in-law
  const shared = viewer.parents.some((id) => other.parents.includes(id))
    || (!viewer.parents.length && !other.parents.length && viewer.gen === other.gen);
  if (shared) return m ? 'sister' : 'brother';
  // a parent's sibling, a sibling's child
  if ([...up].some(([id, d]) => d === 1 && kinOf(family, personOf(family, id), other, depth + 1).match(/^(brother|sister)$/))) return m ? 'aunt' : 'uncle';
  if ([...down].some(([id, d]) => d === 1 && kinOf(family, personOf(family, id), viewer, depth + 1).match(/^(brother|sister)$/))) return m ? 'niece' : 'nephew';
  if (other.gen === viewer.gen) return 'cousin';
  return 'kin';
}

/** What `other` is to the one played, as a line: "Your sister." - "One of your house." for kin further out. */
export function kinLine(family, viewer, other) {
  const is = kinOf(family, viewer, other);
  return is === 'kin' ? 'One of your house.' : `Your ${is}.`;
}

/** How a member greets the one played: their word for them, what they are to them, and a line by how the house fares. */
export function kinGreeting(family, viewer, other, { elder = false } = {}) {
  const word = kinOf(family, other, viewer);   // what the PLAYED one is to the speaker
  const address = {
    father: 'Father', mother: 'Mother', son: 'my son', daughter: 'my daughter', brother: 'brother', sister: 'sister',
    grandfather: 'Grandfather', grandmother: 'Grandmother', grandson: 'child', granddaughter: 'child', uncle: 'Uncle',
    aunt: 'Aunt', nephew: 'nephew', niece: 'niece', husband: 'my love', wife: 'my love', cousin: 'cousin', kin: 'kin',
  }[word] ?? 'kin';
  const fallen = (family.people ?? []).filter((p) => p.died).length;
  const lines = [
    `"${address[0].toUpperCase()}${address.slice(1)}! You're home."`,
    elder ? `"These old bones are glad of the company."` : fallen ? `"We remember the ones we lost. The house goes on because of you."` : `"The house is well. Tell me of the road."`,
  ];
  return { word, is: kinLine(family, viewer, other), lines };
}
