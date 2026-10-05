// @ts-check
// LEGACY1 (2026-10-05, bible/06-Systems/Legacy-Arc.md): THE FAMILY - Project Legacy's record, as the port keeps it.
//
// Mac's own mod (vendor/project-legacy/, read off `Project Legacy.dll`'s IL) keeps its line as FIVE parallel lists in
// one save (`Project_Legacy_Data`: CharacterData, StatsData, SkillsData by id, plus the current three) and pours one
// member into the shared PlayerEntity to play them. The port keeps ONE record of PERSONS, each carrying their own
// stats, skills and career, and a person is played by being LOADED or BORN as their own character (the arc's
// section 3) - the pour is what made the mod's heir keep the dead's max health and spells (B1, B2, S1).
//
// PURE: no DOM, no storage, no clock. Every roll takes an injected `rng` (a [0,1) function), and the name banks'
// DFRandom stream is seeded from it and put back, so a family is a function of its seed and nothing else draws
// differently for its being there.
import { CLASS_CAREERS } from '../chargen.js';
import { RACES, FACES_PER_RACE } from '../races.js';
import { STAT_KEYS_ORDER } from '../statMods.js';
import { SKILL_COUNT } from '../skills.js';
import { firstName, surname as bankSurname, getNameBank, GENDERS } from '../../characters/nameHelper.js';
import { getSeed, setSeed } from '../../formats/dfRandom.js';
import { startAgeOf } from './age.js';

/** The save-data vendor - `modData.ProjectLegacy` (systems/modSaveData.js), the mod's IHasModSaveData. */
export const LEGACY_VENDOR = 'ProjectLegacy';
/** The Mods pane's vendor key (systems/modSettings.js) and the Features row's. */
export const LEGACY_MOD = 'project-legacy';
export const FAMILY_VERSION = 1;

/** The two models (the arc's section 6). A family is founded under one and never changes it. */
export const MODELS = Object.freeze({ bloodline: 'bloodline', enduring: 'enduring' });
export const isModel = (m) => m === MODELS.bloodline || m === MODELS.enduring;

/** The Mods pane's Descendants choice, the mod's own two (modsettings.json "Family"/"Descendants"). */
export const DESCENDANTS = Object.freeze({ random: 0, always: 1 });
/** B14: the mod shipped Max Siblings 0 and Siblings Probability 0, so a fresh install never saw a sibling. */
export const SIBLINGS_MAX_DEFAULT = 2;
export const SIBLINGS_CHANCE_DEFAULT = 50;
/** `HandlePlayerDeath`'s `Random.Range(0f, 1f) > 0.5f` - the "Random Descendants" odds, kept. */
export const HEIR_CHANCE = 0.5;
/** `RandomizeCharacterData`'s `Random.value < 0.7f` - the parent's race (B4: the roll now decides). */
export const RACE_INHERIT_CHANCE = 0.7;
/** `RandomizeCharacterData`'s `Random.value < 0.9f` - the family's surname, else "a lore surname change". */
export const SURNAME_KEEP_CHANCE = 0.9;
/** The arc's section 5: half the time the parent's career. */
export const CAREER_INHERIT_CHANCE = 0.5;
/** THE BLOOD: a stat's gift is `round((parent - 50) / 10)`, held to 0..3. */
export const BLOOD_MAX = 3;
/** THE HEARTH: a primary or major skill's gift is `floor(parent / 20)`, held to 0..3. */
export const HEARTH_MAX = 3;
/** THE ESTATE: a quarter of the purse the dead carried, at most what fits under the online birth's liquid ceiling
 *  beside the gold every birth carries (net/realmGoldLaw.js REALM_BIRTH_WEALTH_MAX less systems/startingGear.js
 *  STARTING_GOLD - restated, and pinned equal, so this leaf imports no net code). AUDIT LEGACY H7: it was the ceiling
 *  itself, and a born heir's first save would have carried 10,100. */
export const ESTATE_SHARE = 0.25;
export const ESTATE_MAX = 9_900;

const RACE_KEYS = Object.freeze(Object.keys(RACES));

// ---- the rolls --------------------------------------------------------------------------------------------------

/** A seeded [0,1) stream (mulberry32) - the family's own dice, so a test or a peer can replay a birth. */
export function familyRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, list) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The name banks draw on DFRandom's ONE stream; seed it from the family's dice and put it back, so a birth moves no
 *  other draw (the townsfolk's names, a quest's) off its DFU sequence. */
function withBankSeed(rng, fn) {
  const was = getSeed();
  setSeed(Math.floor(rng() * 0x7fffffff));
  try { return fn(); } finally { setSeed(was); }
}

/** The last word of a full name - `GetSurname` (`fullName.Split(' ')`, the last part when there are two or more). */
export function surnameOf(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
/** The given name - every word but the surname's (a one-word name is all given). */
export function givenOf(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] ?? '');
}
/** A person's whole name: given + surname, the surname left off when there is none. */
export const fullNameOf = (given, sur) => (sur ? `${given} ${sur}` : given);

// ---- the record -------------------------------------------------------------------------------------------------

/**
 * @typedef {{ at:number, cause:string, place:any, by?:string|null }} Death
 * @typedef {{
 *   id:number, gen:number, given:string, surname:string, gender:'male'|'female', race:string, raceId:number,
 *   face:number, careerIndex:number, className:string, career:any, level:number,
 *   stats:Record<string,number>|null, skills:number[]|null, groups:{primary:number[], major:number[], minor:number[]},
 *   blood:Record<string,number>, hearth:Record<string,number>, estate:number,
 *   parents:number[], children:number[], spouse:number|null, born:number, died:Death|null,
 *   heir:boolean|null, characterId:string|null, leveling:string|null, kind:'member'|'resident', residentId:string|null,
 *   startAge:number, toll:number, bornOwn:number, lived:number, retired:number|null, bequest?:any[],
 *   parked?:{mapId:number, buildingKey:number}|null, courting?:Record<string, any>, wedAt?:number|null,
 *   childDay?:number|null, minor?:boolean, residentFace?:number|null, mapId?:number
 * }} Person
 * @typedef {{ v:number, id:string, surname:string, model:string, seat:{region:string, loc:string, mapId?:number}|null, rev:number,
 *   nextId:number, currentId:number, founded:number, ended:number|null, people:Person[], remains:any[], settings?:any,
 *   pending:Pending|null, houses?:any[], home?:{mapId:number, buildingKey:number}|null }} Family
 * @typedef {{ fallenId:number, at:number, estate:number, bequest:any[] }} Pending - AUDIT LEGACY: a fall the Succession
 *   has not answered yet, ON THE RECORD - so a tab closed, a crash or a failed birth under the window leaves the line
 *   waiting for its answer, never stranded
 */

/** A blank person - every field present, so a record read back is the shape a record written is. */
/** LEGACY5: a person of the record, blank - a spouse who marries in is minted so (systems/legacy/marriage.js wed). */
export const newPerson = (id) => blankPerson(id);
function blankPerson(id) {
  return /** @type {Person} */ ({
    id, gen: 0, given: '', surname: '', gender: 'male', race: 'Breton', raceId: RACES.Breton, face: 0,
    careerIndex: 0, className: CLASS_CAREERS[0], career: null, level: 1, stats: null, skills: null,
    groups: { primary: [], major: [], minor: [] }, blood: {}, hearth: {}, estate: 0,
    parents: [], children: [], spouse: null, born: 0, died: null, heir: null, characterId: null, leveling: null,
    kind: 'member', residentId: null, startAge: 20, toll: 0, bornOwn: 0, lived: 0, retired: null, bequest: [], parked: null,
  });
}

/** A fresh family id - time and dice, so two founded in one millisecond never collide. */
export const mintFamilyId = (now = Date.now(), rng = Math.random) => `fam-${now.toString(36)}-${Math.floor(rng() * 36 ** 6).toString(36).padStart(6, '0')}`;

/** The career's three skill groups, read off a career object (DFCareer's primary/major/minor, the port's arrays). */
export function groupsOf(career) {
  const ids = (a) => (Array.isArray(a) ? a.filter((n) => Number.isInteger(n) && n >= 0 && n < SKILL_COUNT) : []);
  return { primary: ids(career?.primarySkills), major: ids(career?.majorSkills), minor: ids(career?.minorSkills) };
}

/** The PERMANENT eight (D6: the mod read GetLiveStatValue - a Fortify, a ring - and wrote it back permanent). The
 *  port's `entity.stats` IS the permanent value; the live modifiers ride beside it (systems/statMods.js). */
export function permanentStats(entity) {
  const out = {};
  for (const k of STAT_KEYS_ORDER) out[k] = Math.round(Number(entity?.stats?.[k]) || 0);
  return out;
}
/** The permanent thirty-five (D6, the skills' half). */
export function permanentSkills(entity) {
  const s = entity?.skills;
  return Array.from({ length: SKILL_COUNT }, (_, i) => Math.round(Number(s?.[i]) || 0));
}

/** A person's career as a record keeps it: the index (a custom career's is its affinity class, DFU's
 *  `classIndex`), the name, the three skill groups, and the career object WHOLE (plain CFG data, as save.js keeps
 *  it) - so a custom career is inherited as itself (S2: the mod looked a custom class up by name, missed, and kept the
 *  current character's). */
function careerFields(entity) {
  const idx = Number.isInteger(entity?.careerIndex) && entity.careerIndex >= 0 && entity.careerIndex < CLASS_CAREERS.length ? entity.careerIndex : 0;
  const career = entity?.career ?? null;
  return {
    careerIndex: idx,
    className: String(career?.name || CLASS_CAREERS[idx]),
    career: career ? JSON.parse(JSON.stringify(career)) : null,
    groups: groupsOf(career),
  };
}

/** Is a person's career a custom one - a career object whose name is not its index's stock name. */
export const isCustomCareer = (person) => !!person?.career && String(person.career.name ?? '') !== CLASS_CAREERS[person.careerIndex];

/** Write the PLAYED character into their person: identity, level, the permanent eight and thirty-five, the career and
 *  the character id. The mod's `SaveCurrentCharacter` / `SaveCharacterData`, the parts the port keeps (D8: no kit -
 *  a played person's kit is their own save's). Mutates and returns the person. */
export function writePlayer(person, entity) {
  const name = String(entity?.name ?? '').trim();
  const sur = surnameOf(name);
  person.given = givenOf(name) || person.given;
  if (sur) person.surname = sur;
  person.gender = entity?.gender === 'female' ? 'female' : 'male';
  if (RACE_KEYS.includes(entity?.race)) { person.race = entity.race; person.raceId = RACES[entity.race]; }
  person.face = clamp(Math.floor(Number(entity?.faceIndex) || 0), 0, FACES_PER_RACE - 1);
  Object.assign(person, careerFields(entity));
  person.level = Math.max(1, Math.floor(Number(entity?.level) || 1));
  person.stats = permanentStats(entity);
  person.skills = permanentSkills(entity);
  if (entity?.characterId) person.characterId = String(entity.characterId);
  if (entity?.levelingSystem) person.leveling = String(entity.levelingSystem);
  return person;
}

/**
 * FOUND A FAMILY around the character being played (D9: at birth or at the first load, not at the first save). The
 * surname is the founder's own last word, or "of <seat>" when they carry none (a Redguard). `heir` is rolled ONCE
 * (B12) by the Descendants setting.
 * @param {any} entity
 * @param {{ model?:string, seat?:{region:string,loc:string,mapId?:number}|null, at?:number, rng?:() => number, settings?:any, id?:string }} [o]
 * @returns {Family}
 */
export function foundFamily(entity, { model = MODELS.enduring, seat = null, at = 0, rng = Math.random, settings = {}, id } = {}) {
  const founder = writePlayer(blankPerson(1), entity);
  founder.born = at;
  founder.startAge = startAgeOf(founder.race);
  founder.heir = heirAnswer(settings, rng);
  const sur = founder.surname || (seat?.loc ? `of ${seat.loc}` : '');
  founder.surname = sur;
  /** @type {Family} */
  const family = {
    v: FAMILY_VERSION, id: id ?? mintFamilyId(Date.now(), rng), surname: sur, model: isModel(model) ? model : MODELS.enduring,
    seat: seat ? { region: String(seat.region), loc: String(seat.loc), ...(Number.isInteger(seat.mapId) ? { mapId: seat.mapId } : {}) } : null,
    rev: 1, nextId: 2, currentId: 1, founded: at, ended: null, people: [founder], remains: [], pending: null, houses: [], home: null,
  };
  return family;
}

/** B12: the heir answer, rolled once per person at birth - "Always" is true, "Random" the mod's 50%. */
export function heirAnswer(settings, rng = Math.random) {
  return (settings?.descendants ?? DESCENDANTS.random) === DESCENDANTS.always ? true : rng() > HEIR_CHANCE;
}

export const personOf = (family, id) => family?.people?.find((p) => p.id === id) ?? null;
export const currentOf = (family) => personOf(family, family?.currentId);
export const isAlive = (p) => !!p && !p.died;
export const parentsOf = (family, p) => (p?.parents ?? []).map((id) => personOf(family, id)).filter(Boolean);
export const childrenOf = (family, p) => (p?.children ?? []).map((id) => personOf(family, id)).filter(Boolean);
/** `GetSiblings`: anyone else sharing a parent - and for the founder's generation (no parents), the other parentless
 *  members of the founder's generation, as `GetLivingSiblings`' root arm reads them. */
export function siblingsOf(family, p) {
  if (!p) return [];
  if (!p.parents.length) return family.people.filter((o) => o.id !== p.id && !o.parents.length && o.kind === 'member' && o.gen === p.gen && o.spouse !== p.id);
  return family.people.filter((o) => o.id !== p.id && o.parents.some((id) => p.parents.includes(id)));
}

/** Bump the record's revision - the newer copy wins wherever two meet (the store and a save, the arc's section 3). */
export function touch(family) { family.rev = (family.rev | 0) + 1; return family; }

// ---- inheritance (the arc's section 5) --------------------------------------------------------------------------

/** B5: the career is drawn from the eighteen BY INDEX - DFU's `Enum.GetValues(ClassCareers)` sorts None (-1) last,
 *  so `Random.Range(1, Length)` skipped Mage and could land on None. Half the time the parent's - a custom one whole;
 *  a stock one is read fresh from its CLASS*.CFG at the birth (`career` null). */
export function inheritCareer(parent, rng = Math.random) {
  if (parent && rng() < CAREER_INHERIT_CHANCE) {
    return { careerIndex: parent.careerIndex, className: parent.className, career: isCustomCareer(parent) ? parent.career : null };
  }
  const i = Math.min(CLASS_CAREERS.length - 1, Math.floor(rng() * CLASS_CAREERS.length));
  return { careerIndex: i, className: CLASS_CAREERS[i], career: null };
}

/** B4: the parent's race at RACE_INHERIT_CHANCE (the mod assigned it before rolling, so it was always); otherwise
 *  the other parent's when there is one, else any of the eight. */
export function inheritRace(parent, other, rng = Math.random) {
  if (parent && rng() < RACE_INHERIT_CHANCE) return parent.race;
  if (other && RACE_KEYS.includes(other.race)) return other.race;
  return pick(rng, RACE_KEYS);
}

/** THE BLOOD: what each stat gains from the better parent - `round((parent - 50) / 10)` held to 0..BLOOD_MAX. */
export function bloodOf(...parents) {
  const out = {};
  for (const k of STAT_KEYS_ORDER) {
    const best = Math.max(0, ...parents.map((p) => Number(p?.stats?.[k]) || 0));
    out[k] = clamp(Math.round((best - 50) / 10), 0, BLOOD_MAX);
  }
  return out;
}

/** THE HEARTH: what each of the played parent's primary and major skills hands down - `floor(parent / 20)` held to
 *  0..HEARTH_MAX. Keyed by skill id. */
export function hearthOf(parent) {
  const out = {};
  if (!parent?.skills) return out;
  for (const id of [...(parent.groups?.primary ?? []), ...(parent.groups?.major ?? [])]) {
    const v = clamp(Math.floor((Number(parent.skills[id]) || 0) / 20), 0, HEARTH_MAX);
    if (v > 0) out[id] = v;
  }
  return out;
}

/** THE ESTATE: a quarter of the gold the dead carried, at most ESTATE_MAX. */
export const estateOf = (gold) => Math.min(ESTATE_MAX, Math.max(0, Math.floor((Number(gold) || 0) * ESTATE_SHARE)));

/**
 * The name of a child of `parent`: a first name from the child's race's bank, and the family's surname - or, one
 * time in ten, "a lore surname change" (`RandomizeCharacterData`'s HUD line, kept as `changed`).
 */
export function nameChild(family, raceKey, gender, rng = Math.random) {
  const bank = getNameBank(raceKey);
  const g = gender === 'female' ? GENDERS.Female : GENDERS.Male;
  return withBankSeed(rng, () => {
    const given = firstName(bank, g) || 'Nameless';
    const keep = rng() < SURNAME_KEEP_CHANCE;
    if (keep || !family.surname) {
      const sur = family.surname || bankSurname(bank) || '';
      return { given, surname: sur, changed: false };
    }
    const fresh = bankSurname(bank);
    return fresh && fresh !== family.surname ? { given, surname: fresh, changed: true } : { given, surname: family.surname, changed: false };
  });
}

/**
 * A NEW MEMBER, born to `parentId` (and their spouse, when they have one): the mod's `CreateCharacter`, with B3-B8
 * removed. The person is a RECORD - their values are rolled at their birth through the construction seam
 * (`bornValues`, with the career's own CLASS*.CFG in hand). Appends to the record and links parent and child.
 * @returns {{ person: Person, changed: boolean }}
 */
export function addChild(family, parentId, { rng = Math.random, at = 0, settings = {} } = {}) {
  const parent = personOf(family, parentId);
  const other = parent?.spouse != null ? personOf(family, parent.spouse) : null;
  const p = blankPerson(family.nextId++);
  p.gen = (parent?.gen ?? 0) + 1;   // D3/D5: generation is the parent's plus one, in one place
  p.gender = rng() < 0.5 ? 'male' : 'female';
  p.race = inheritRace(parent, other, rng);
  p.raceId = RACES[p.race];
  p.startAge = startAgeOf(p.race);
  p.face = Math.floor(rng() * FACES_PER_RACE);   // B6: every person is born with a face
  Object.assign(p, inheritCareer(parent, rng));
  const { given, surname, changed } = nameChild(family, p.race, p.gender, rng);
  p.given = given;
  p.surname = surname;
  p.blood = bloodOf(parent, other);
  p.hearth = hearthOf(parent);
  p.leveling = parent?.leveling ?? null;
  p.parents = [parent?.id, other?.id].filter((id) => id != null);
  p.born = at;
  p.heir = heirAnswer(settings, rng);
  family.people.push(p);
  for (const par of [parent, other]) if (par && !par.children.includes(p.id)) par.children.push(p.id);
  touch(family);
  return { person: p, changed };
}

/** `CreateRandomSiblings`: with the setting's probability, one to the setting's maximum children of the same parent
 *  (B14: the defaults are SIBLINGS_MAX_DEFAULT and SIBLINGS_CHANCE_DEFAULT). The founder's generation has no parent;
 *  their siblings are parentless members of generation 0, as the mod mints them at the first save. */
/** @param {any} family @param {number} personId @param {{ rng?: () => number, at?: number, settings?: any }} [o] */
export function rollSiblings(family, personId, { rng = Math.random, at = 0, settings = {} } = {}) {
  const p = personOf(family, personId);
  const max = clamp(Math.floor(settings?.maxSiblings ?? SIBLINGS_MAX_DEFAULT), 0, 10);
  const chance = clamp(Number(settings?.siblingChance ?? SIBLINGS_CHANCE_DEFAULT), 0, 100) / 100;
  if (!p || max < 1 || !(rng() < chance)) return [];
  const n = 1 + Math.floor(rng() * max);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (p.parents.length) out.push(addChild(family, p.parents[0], { rng, at, settings }).person);
    else out.push(addFounderSibling(family, p, { rng, at, settings }));
  }
  return out;
}

/** A sibling of a parentless member: their generation, their race 70%, the family's surname (no lore change - the
 *  family is the founder's own name). */
function addFounderSibling(family, of, { rng, at, settings }) {
  const s = blankPerson(family.nextId++);
  s.gen = of.gen;
  s.gender = rng() < 0.5 ? 'male' : 'female';
  s.race = rng() < RACE_INHERIT_CHANCE ? of.race : pick(rng, RACE_KEYS);
  s.raceId = RACES[s.race];
  s.startAge = startAgeOf(s.race);
  s.face = Math.floor(rng() * FACES_PER_RACE);
  Object.assign(s, inheritCareer(null, rng));
  s.given = withBankSeed(rng, () => firstName(getNameBank(s.race), s.gender === 'female' ? GENDERS.Female : GENDERS.Male) || 'Nameless');
  s.surname = family.surname;
  s.leveling = of.leveling;
  s.born = at;
  s.heir = heirAnswer(settings, rng);
  family.people.push(s);
  touch(family);
  return s;
}

/**
 * THE VALUES A PERSON IS BORN WITH, given their career object (the CLASS*.CFG the boot loads, or their custom
 * career): DFU's own chargen roll (`rollStats` + its pool spent lowest-first; `rollSkills` + its three pools) handed
 * in as `roll`, then the blood on each stat and the hearth on each skill. Stats are held to DFU's 100.
 * @param {{ blood:Record<string,number>, hearth:Record<string,number> }} person
 * @param {{ stats:Record<string,number>, skills:number[] }} rolled
 */
export function bornValues(person, rolled) {
  const stats = {};
  for (const k of STAT_KEYS_ORDER) stats[k] = clamp((rolled.stats[k] | 0) + (person.blood?.[k] | 0), 1, 100);
  const skills = rolled.skills.slice();
  for (const [id, v] of Object.entries(person.hearth ?? {})) {
    const i = Number(id);
    if (i >= 0 && i < SKILL_COUNT) skills[i] = clamp((skills[i] | 0) + (v | 0), 0, 100);
  }
  return { stats, skills };
}

// ---- deaths and the mantle ----------------------------------------------------------------------------------------

/** B13: EVERY final death is written - the mod wrote the dead only on its heir branch, so a line with no heir kept its
 *  dead "alive". `place` is the host's word for where (`{ kind, region, loc, pixel, pos, dungeon }`). */
export function recordDeath(family, id, { at = 0, cause = 'unknown', place = null, by = null } = {}) {
  const p = personOf(family, id);
  if (!p || p.died) return p;
  p.died = { at, cause: String(cause), place: place ?? null, by: by ?? null };
  touch(family);
  return p;
}

/** The members who may carry the line on (the Succession's list): living, not the one played, not a spouse who
 *  married in, not retired, born of the blood. Oldest generation first, then by id. */
export function successors(family) {
  return (family?.people ?? [])
    .filter((p) => isAlive(p) && p.id !== family.currentId && p.kind === 'member' && p.retired == null)
    .sort((a, b) => a.gen - b.gen || a.id - b.id);
}

/** May a newborn heir be asked for, for the fallen? The heir answer rolled at their birth (B12) - or the Descendants
 *  setting standing at "Always" NOW: the mod's HandlePlayerDeath reads `alwaysHaveDescendants` at the death
 *  (IL_17ce-17ed), so a dial turned to Always later answers for everyone already born (AUDIT LEGACY F5). The line's
 *  living members are always the other way on. */
export const newbornAllowed = (family, fallen, settings = null) => !!fallen
  && (fallen.heir === true || (settings?.descendants ?? DESCENDANTS.random) === DESCENDANTS.always);

/** Does the line go on after `fallen` - any successor, or a newborn heir? */
export const lineContinues = (family, fallen, settings = null) => successors(family).length > 0 || newbornAllowed(family, fallen, settings);

/** Close an extinct line (the Hall keeps it) - its waiting Succession answered with the end. */
export function endFamily(family, at = 0) {
  if (family.ended == null) { family.ended = at; family.pending = null; touch(family); }
  return family;
}

/** Make `id` the one played - the mod's `currentID`. */
export function setCurrent(family, id) {
  if (personOf(family, id) && family.currentId !== id) { family.currentId = id; touch(family); }
  return family;
}

// ---- the record read back -----------------------------------------------------------------------------------------

/** A record read off storage or a save, held to the shape `foundFamily` writes - or null when it is no family. Never
 *  throws: a damaged copy reads as none, and the other copy (store or save) stands. */
export function readFamily(rec) {
  if (!rec || typeof rec !== 'object' || rec.v !== FAMILY_VERSION || !Array.isArray(rec.people) || !rec.people.length) return null;
  if (typeof rec.id !== 'string' || !rec.id) return null;
  const people = [];
  for (const raw of rec.people) {
    if (!raw || !Number.isInteger(raw.id)) continue;
    const p = Object.assign(blankPerson(raw.id), raw);
    p.parents = Array.isArray(raw.parents) ? raw.parents.filter(Number.isInteger) : [];
    p.children = Array.isArray(raw.children) ? raw.children.filter(Number.isInteger) : [];
    // AUDIT LEGACY A7: every nested list held to its shape - a damaged group threw "not iterable" inside the
    // Succession's choose (hearthOf), a damaged remains row inside every tick
    const ids = (a) => (Array.isArray(a) ? a.filter((n) => Number.isInteger(n) && n >= 0 && n < SKILL_COUNT) : []);
    p.groups = { primary: ids(raw.groups?.primary), major: ids(raw.groups?.major), minor: ids(raw.groups?.minor) };
    p.stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : null;
    p.skills = Array.isArray(raw.skills) ? raw.skills.map((v) => Number(v) || 0) : null;
    p.blood = raw.blood && typeof raw.blood === 'object' ? raw.blood : {};
    p.hearth = raw.hearth && typeof raw.hearth === 'object' ? raw.hearth : {};
    p.estate = Math.max(0, Math.floor(Number(raw.estate) || 0));
    p.bequest = Array.isArray(raw.bequest) ? raw.bequest.filter((it) => it && typeof it === 'object') : [];
    p.died = raw.died && typeof raw.died === 'object' ? { at: Number(raw.died.at) || 0, cause: String(raw.died.cause ?? 'unknown'), place: raw.died.place ?? null, by: raw.died.by ?? null } : null;
    // LEGACY5: courtships, a wedding, children's clock, a minor, a spouse's own face - held to their shape
    p.courting = raw.courting && typeof raw.courting === 'object' && !Array.isArray(raw.courting)
      ? Object.fromEntries(Object.entries(raw.courting).filter(([k, c]) => typeof k === 'string' && c && typeof c === 'object')
        .map(([k, c]) => [k, { name: String(c.name ?? ''), mapId: c.mapId | 0, town: String(c.town ?? ''), affection: Math.max(0, Math.min(100, c.affection | 0)), day: Number.isInteger(c.day) ? c.day : -1, betrothed: !!c.betrothed }]))
      : {};
    p.wedAt = Number.isFinite(raw.wedAt) ? raw.wedAt : null;
    p.childDay = Number.isInteger(raw.childDay) ? raw.childDay : null;
    p.minor = !!raw.minor;
    p.residentFace = Number.isInteger(raw.residentFace) ? raw.residentFace : null;
    if (p.kind === 'resident') p.mapId = Number.isInteger(raw.mapId) ? raw.mapId : 0;   // LEGACY5: the town a spouse lives in
    // LEGACY-HOME: the house the member's newest save was made in (household.js homeOf), or none
    p.parked = raw.parked && Number.isInteger(raw.parked.mapId) && (raw.parked.buildingKey | 0) > 0 ? { mapId: raw.parked.mapId, buildingKey: raw.parked.buildingKey | 0 } : null;
    people.push(p);
  }
  if (!people.length) return null;
  // AUDIT LEGACY II A9: no one is their own ancestor - a damaged record's parent link that closes a cycle is dropped
  // (household.js kinOf walked it forever inside the talk door)
  const byId = new Map(people.map((p) => [p.id, p]));
  const ancestorOf = (p, id, seen = new Set()) => (p.parents ?? []).some((q) => q === id || (!seen.has(q) && (seen.add(q), byId.has(q)) && ancestorOf(byId.get(q), id, seen)));
  for (const p of people) p.parents = p.parents.filter((q) => q !== p.id && !(byId.has(q) && ancestorOf(byId.get(q), p.id)));
  const maxId = Math.max(...people.map((p) => p.id));
  return {
    v: FAMILY_VERSION, id: rec.id, surname: String(rec.surname ?? ''), model: isModel(rec.model) ? rec.model : MODELS.enduring,
    seat: rec.seat && typeof rec.seat === 'object' ? { region: String(rec.seat.region ?? ''), loc: String(rec.seat.loc ?? ''), ...(Number.isInteger(rec.seat.mapId) ? { mapId: rec.seat.mapId } : {}) } : null,
    rev: Math.max(1, rec.rev | 0), nextId: Math.max(maxId + 1, rec.nextId | 0),   // D4: ids from the record's own counter, never a constant
    currentId: people.some((p) => p.id === rec.currentId) ? rec.currentId : people[0].id,
    founded: Number(rec.founded) || 0, ended: rec.ended == null ? null : Number(rec.ended), people,
    remains: Array.isArray(rec.remains) ? rec.remains.map(readRemains).filter(Boolean) : [],   // LEGACY4: where the fallen lie
    pending: readPending(rec.pending, people),
    // LEGACY-HOME: the family's houses (each its holder's deed) and the one marked its home
    houses: Array.isArray(rec.houses) ? rec.houses.filter((h) => h && Number.isInteger(h.mapId) && (h.buildingKey | 0) > 0)
      .map((h) => ({ regionIndex: h.regionIndex | 0, mapId: h.mapId, buildingKey: h.buildingKey | 0, location: String(h.location ?? ''), by: Number.isInteger(h.by) ? h.by : null })) : [],
    home: rec.home && Number.isInteger(rec.home.mapId) ? { mapId: rec.home.mapId, buildingKey: rec.home.buildingKey | 0 } : null,
  };
}

/** The states remains pass through: lying where the fallen fell (their list the record's own), carried by the heir,
 *  laid to rest. */
export const REMAINS_STATES = Object.freeze(['lying', 'taken', 'rested']);
/** A remains row held to its shape, or null. */
function readRemains(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !Number.isInteger(r.of)) return null;
  return {
    ...r,
    name: String(r.name ?? ''), place: r.place && typeof r.place === 'object' ? r.place : null,
    items: Array.isArray(r.items) ? r.items.filter((it) => it && typeof it === 'object') : [],
    // AUDIT LEGACY II A10: the list as laid held to its shape too - a damaged one became the remains' list at a rewind,
    // and every tick after threw
    first: Array.isArray(r.first) ? r.first.filter((it) => it && typeof it === 'object') : (Array.isArray(r.items) ? r.items.filter((it) => it && typeof it === 'object') : []),
    state: REMAINS_STATES.includes(r.state) ? r.state : 'lying',
    by: Number.isInteger(r.by) ? r.by : null,
    killer: r.killer == null ? null : String(r.killer),
    at: Number(r.at) || 0,
  };
}
/** The waiting Succession held to its shape - its fallen a person of the record - or null. */
function readPending(p, people) {
  if (!p || typeof p !== 'object' || !people.some((x) => x.id === p.fallenId)) return null;
  return {
    fallenId: p.fallenId, at: Number(p.at) || 0, estate: Math.max(0, Math.floor(Number(p.estate) || 0)),
    bequest: Array.isArray(p.bequest) ? p.bequest.filter((it) => it && typeof it === 'object') : [],
  };
}

