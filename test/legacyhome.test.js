// LEGACY-HOME (2026-10-05, bible/06-Systems/Legacy-Arc.md section 10b; Mac: "I think your bloodline should be visible
// when not playing, and if a house is owned should live in the house ... With the ability to switch by interacting with
// them or by using the ui ... itll be default on but can be toggled off"): THE BLOODLINE IN THE WORLD - the household
// law, the host's residents, the town's day carrying them, the meeting, and the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  familyResId, familyResOf, isFamilyRes, FAMILY_JOB, FAMILY_ROLL, FAMILY_SLOT_BASE, CLASS_MOBILE_BASE, sameHouse,
  syncHouses, familyHome, setFamilyHome, homeOf, householdOf, residentOf, kinOf, kinGreeting, kinLine,
} from '../src/systems/legacy/household.js';
import { foundFamily, addChild, readFamily, familyRng, MODELS, personOf, LEGACY_MOD, recordDeath, touch } from '../src/systems/legacy/family.js';
import { loadFamily } from '../src/systems/legacy/store.js';
import { createLegacyHost, LEGACY_TEXT } from '../src/scenes/legacyHost.js';
import { _resetModSaveData } from '../src/systems/modSaveData.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { modSaveRecords, restoreModSaveRecords } from '../src/systems/modSaveData.js';
import { MOD_CURATED } from '../src/systems/features.js';
import { legacySettings } from '../src/systems/legacy/settings.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { PERSON_TEXTURES } from '../src/characters/mobilePerson.js';
import { raceArt } from '../src/systems/races.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { isHome } from '../src/systems/livingWorld/census.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { livesLine } from '../src/ui/familyPages.js';
import { synthTown } from './lwTown.mjs';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const entity = (over = {}) => ({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', raceId: 4, faceIndex: 3, careerIndex: 5,
  career: { name: 'Nightblade', primarySkills: [28, 22, 16], majorSkills: [19, 24, 13], minorSkills: [1, 2, 3, 4, 5, 6] },
  level: 7, characterId: 'c-ysolde', chargenDone: true, levelingSystem: 'virtue',
  stats: { strength: 60, intelligence: 72, willpower: 55, agility: 80, endurance: 50, personality: 40, speed: 70, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => 10 + i),
  ...over,
});
const memStore = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
};
const HOUSE_A = Object.freeze({ regionIndex: 17, mapId: 5001, buildingKey: 0x10203, location: 'Gothway Garden' });
const HOUSE_B = Object.freeze({ regionIndex: 20, mapId: 7002, buildingKey: 0x20304, location: 'Sentinel' });

/** A family of three: the founder (played), a sibling never played, a child never played. */
function threeOf(seat = { region: 'Daggerfall', loc: 'Gothway Garden', mapId: 5001 }) {
  const f = foundFamily(entity(), { rng: familyRng(3), id: 'fam-h', seat });
  const sib = addChild(f, null, { rng: familyRng(4) }).person;   // a parentless member of the founder's generation
  sib.parents = []; sib.gen = 0;
  const child = addChild(f, 1, { rng: familyRng(5) }).person;
  return { f, founder: f.people[0], sib, child };
}

// ---- the household law ----------------------------------------------------------------------------------------------

test('LEGACY-HOME: a family resident\'s id is never a census id, and reads back', () => {
  assert.equal(familyResId('fam-h', 7), 'Ffam-h.7');
  assert.deepEqual(familyResOf('Ffam-h.7'), { familyId: 'fam-h', personId: 7 });
  assert.equal(familyResOf('L5001.3'), null, 'a census resident');
  // PIN MOVED (LEGACY5): the TAG says whose they are - a spouse who wed in keeps their census id
  assert.equal(isFamilyRes({ id: 'Ffam-h.7', legacy: { familyId: 'fam-h', personId: 7 } }), true);
  assert.equal(isFamilyRes({ id: 'Ffam-h.7' }), false, 'no tag, none of the line');
  assert.equal(isFamilyRes({ id: 'L1.2', legacy: {} }), false, 'a tag that names no one');
  assert.equal(isFamilyRes({ id: 'L1.2', legacy: { familyId: 'fam-h', personId: 9 } }), true, 'a spouse: their census id, the line\'s tag');
});

test('LEGACY-HOME: the line\'s houses are what each holder holds - the one played\'s rows replaced, every other kept, nothing doubled', () => {
  const { f } = threeOf();
  assert.equal(syncHouses(f, 1, [HOUSE_A, { ...HOUSE_B, buildingKey: 0 }, { regionIndex: 3, mapId: 0, buildingKey: 9 }]), true);
  assert.deepEqual(f.houses, [{ ...HOUSE_A, by: 1 }], 'an empty slot and a house of no town are no house');
  assert.equal(syncHouses(f, 1, [HOUSE_A]), false, 'unchanged');
  f.houses.push({ ...HOUSE_B, by: 2 });
  assert.equal(syncHouses(f, 1, []), true, 'sold or slept away');
  assert.deepEqual(f.houses, [{ ...HOUSE_B, by: 2 }], 'a sibling\'s deed is theirs, kept');
  assert.equal(syncHouses(f, 1, [HOUSE_B]), false, 'one house is one row, whoever else holds it');
  assert.equal(f.houses.length, 1);
});

test('LEGACY-HOME: THE FAMILY HOME - the marked one, else the one in the seat, else the first; only a house of theirs is marked', () => {
  const { f } = threeOf();
  assert.equal(familyHome(f), null);
  f.houses = [{ ...HOUSE_B, by: 1 }, { ...HOUSE_A, by: 1 }];
  assert.ok(sameHouse(familyHome(f), HOUSE_A), 'the seat\'s');
  f.seat = { region: 'Daggerfall', loc: 'Elsewhere' };
  assert.ok(sameHouse(familyHome(f), HOUSE_B), 'the first');
  assert.equal(setFamilyHome(f, { mapId: 1, buildingKey: 1 }), false);
  assert.equal(setFamilyHome(f, HOUSE_A), true);
  assert.deepEqual(f.home, { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey });
  assert.ok(sameHouse(familyHome(f), HOUSE_A), 'the marked one');
});

test('LEGACY-HOME: WHERE EACH LIVES - the never-played at the family home (or the seat, lent); a played member parked in a house of the line, else on their own journey; the dead and the played nowhere', () => {
  const { f, founder, sib, child } = threeOf();
  assert.deepEqual(homeOf(f, sib), { mapId: 5001, buildingKey: 0, lent: true }, 'no house: the seat\'s town, a house lent');
  assert.equal(homeOf(f, founder), null, 'the one played');
  founder.parked = { mapId: 5001, buildingKey: 9 };
  f.houses = [{ regionIndex: 17, mapId: 5001, buildingKey: 9, location: 'Gothway Garden', by: 1 }];
  assert.equal(homeOf(f, founder), null, 'never beside themselves - their last save made at home');
  f.houses = [];
  founder.parked = null;
  f.seat = { region: 'Daggerfall', loc: 'Gothway Garden' };
  assert.equal(homeOf(f, sib), null, 'a seat whose town is not known yet stands nobody');
  f.houses = [{ ...HOUSE_A, by: 1 }, { ...HOUSE_B, by: 1 }];
  assert.deepEqual(homeOf(f, sib), { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey, lent: false }, 'the family home');
  // the child, once played, saved in the other house: parked there; saved anywhere else: away
  child.characterId = 'c-child';
  assert.equal(homeOf(f, child), null, 'on their own journey');
  child.parked = { mapId: HOUSE_B.mapId, buildingKey: HOUSE_B.buildingKey };
  assert.deepEqual(homeOf(f, child), { mapId: HOUSE_B.mapId, buildingKey: HOUSE_B.buildingKey, lent: false });
  child.parked = { mapId: 1, buildingKey: 2 };
  assert.equal(homeOf(f, child), null, 'a house no longer the line\'s');
  // the retired keep the family home, played or not
  child.retired = 100;
  assert.deepEqual(homeOf(f, child), { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey, lent: false });
  sib.died = { at: 1, cause: 'fell', place: null, by: null };
  assert.deepEqual(householdOf(f).map((x) => x.person.id), [child.id], 'the dead stand nowhere');
  child.kind = 'resident';
  assert.equal(homeOf(f, child), null, 'one wed in is not of the blood');
});

test('LEGACY-HOME: THE MEMBER AS A RESIDENT - the census\'s shape, the homemaker\'s day, their own name, a class sprite for a stock career, their own chargen head', () => {
  const { f, sib } = threeOf();
  const res = residentOf(f, sib, { mapId: 5001, buildingKey: 77 });
  assert.equal(res.id, familyResId('fam-h', sib.id));
  assert.equal(res.roll, FAMILY_ROLL);
  assert.equal(res.slot, FAMILY_SLOT_BASE + sib.id);
  assert.equal(res.job, FAMILY_JOB);
  assert.equal(FAMILY_JOB, 'homemaker');
  assert.equal(res.home, 77);
  assert.equal(res.town, 5001);
  assert.equal(res.name, `${sib.given} ${sib.surname}`);
  assert.equal(res.guard, false);
  assert.equal(res.work, null);
  const sex = sib.gender === 'female' ? 'female' : 'male';
  assert.equal(res.sex, sex);
  assert.ok(Object.values(PERSON_TEXTURES).some((byRace) => byRace[sex].includes(res.archive)), 'an outfit of the town\'s tables');
  assert.equal(res.cls, CLASS_MOBILE_BASE + sib.careerIndex);
  assert.equal(residentOf(f, { ...sib, careerIndex: -1 }, { mapId: 1, buildingKey: 1 }).cls, null);
  assert.deepEqual(res.portrait, { archive: raceArt(sib.race, sex).heads, record: sib.face });
  assert.equal(residentOf(f, { ...sib, face: 99 }, { mapId: 1, buildingKey: 1 }).portrait.record, 9, 'one of the ten heads');
  assert.deepEqual(res.legacy, { familyId: 'fam-h', personId: sib.id });
  assert.deepEqual(residentOf(f, sib, { mapId: 5001, buildingKey: 77 }), res, 'the same every day');
});

test('LEGACY-HOME: kinship - what each is to the other, and how they greet the one played', () => {
  const { f, founder, sib, child } = threeOf();
  assert.equal(kinOf(f, child, founder), founder.gender === 'female' ? 'mother' : 'father');
  assert.equal(kinOf(f, founder, child), child.gender === 'female' ? 'daughter' : 'son');
  assert.equal(kinOf(f, founder, sib), sib.gender === 'female' ? 'sister' : 'brother', 'the founder\'s generation, parentless, are siblings');
  assert.equal(kinOf(f, child, sib), sib.gender === 'female' ? 'aunt' : 'uncle');
  assert.equal(kinOf(f, sib, child), child.gender === 'female' ? 'niece' : 'nephew');
  assert.equal(kinOf(f, founder, founder), 'kin');
  const g = kinGreeting(f, founder, child);
  assert.equal(g.word, kinOf(f, child, founder), 'their word for the one played');
  assert.equal(g.is, kinLine(f, founder, child));
  assert.match(g.is, /^Your (son|daughter)\.$/);
  assert.match(g.lines[0], /^"(Father|Mother)! You're home\."$/);
  assert.equal(kinLine(f, founder, { id: 99, parents: [], gen: 4 }), 'One of your house.');
});

test('LEGACY-HOME: the record keeps the houses, the home, each member\'s parking and the seat\'s town; a damaged row reads as none', () => {
  const { f, child } = threeOf();
  f.houses = [{ ...HOUSE_A, by: 1 }, { mapId: 'x', buildingKey: 3 }, { mapId: 4, buildingKey: 0 }];
  f.home = { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey };
  child.parked = { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey };
  const back = readFamily(JSON.parse(JSON.stringify(f)));
  assert.deepEqual(back.houses, [{ ...HOUSE_A, by: 1 }]);
  assert.deepEqual(back.home, f.home);
  assert.deepEqual(personOf(back, child.id).parked, child.parked);
  assert.equal(back.seat.mapId, 5001);
  const bad = readFamily({ ...JSON.parse(JSON.stringify(f)), houses: 'x', home: { mapId: 'y' }, people: f.people.map((p) => ({ ...p, parked: { mapId: 2.5 } })) });
  assert.deepEqual(bad.houses, []);
  assert.equal(bad.home, null);
  assert.ok(bad.people.every((p) => p.parked === null));
  assert.equal(foundFamily(entity(), { rng: familyRng(1), seat: { region: 'R', loc: 'L', mapId: 9 } }).seat.mapId, 9, 'a seat founded where its town is known keeps it');
});

// ---- the host -------------------------------------------------------------------------------------------------------

function homeWorld({ model = MODELS.enduring } = {}) {
  _resetModSaveData();
  const storage = memStore(), tab = memStore();
  const w = { said: [], held: [], here: null, online: false, fight: false, saved: 0, booted: [], loc: 'Gothway Garden' };
  const e = entity();
  const host = createLegacyHost({
    entity: e, storage: () => storage, tab: () => tab, on: () => true, online: () => w.online, now: () => 100, own: () => 0,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: w.loc, locationType: LOCATION_TYPES.TownCity, mapId: w.loc === 'Gothway Garden' ? 5001 : 6001 }),
    town: (h) => ({ region: h.region, loc: h.loc, mapId: h.mapId }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => 100, say: (l) => w.said.push(l), boot: (q) => w.booted.push(q), search: () => '?world', loadCharacter: () => true,
    // AUDIT LEGACY II P8: a save is the real one - the host's own record written (getSaveData), as the game's save does
    saveNow: () => { w.saved++; w.save = modSaveRecords().ProjectLegacy; return true; }, inFight: () => w.fight, rng: familyRng(9),
    heldHouses: () => w.held, houseHere: () => w.here,
  });
  // AUDIT LEGACY II P8: a line of one, founded so - no rolled siblings (the old fixture cut them from memory alone, and
  // the store kept them under the ids the tests then minted again)
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  host.found(model);
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 50);
  assert.equal(host.family.people.length, 1);
  return { host, storage, w, e };
}

test('LEGACY-HOME: the host stands the line in its town - the seat lent with no house, the family home once one is held; the same list while nothing changed; none with the dial off or the past played', () => {
  _resetModSettings();
  const { host, w, storage } = homeWorld();
  const f = host.family;
  const sib = addChild(f, null, { rng: familyRng(4) }).person;
  sib.parents = []; sib.gen = 0;
  // AUDIT LEGACY II P4: a seat noted before it knew its town - learned only in that town, never another's
  delete f.seat.mapId;
  w.loc = 'Sentinel';
  host.tick();
  assert.equal(f.seat.mapId, undefined, 'another town teaches the seat nothing');
  w.loc = 'Gothway Garden';
  host.tick();
  assert.equal(f.seat.mapId, 5001, 'the seat learns its town');
  const lend = (seed) => (seed === f.id ? 42 : 0);
  const a = host.residentsOf(5001, lend);
  assert.deepEqual(a.map((r) => [r.id, r.home]), [[familyResId(f.id, sib.id), 42]], 'lent a house of the seat');
  assert.equal(host.residentsOf(5001, lend), a, 'the same list - the town keeps its day by it');
  assert.deepEqual(host.residentsOf(9999, lend), [], 'another town');
  assert.deepEqual(host.residentsOf(5001, () => 0), [], 'a town with no house to lend stands nobody');
  // a house bought: the line moves in - with the save that holds the deed (AUDIT LEGACY II A6)
  w.held = [HOUSE_A];
  host.tick();
  assert.deepEqual(f.houses, [], 'an unsaved deed is no house of the line\'s');
  modSaveRecords();
  assert.deepEqual(loadFamily(storage, f.id).houses, [{ ...HOUSE_A, by: 1 }], 'the store knows the line\'s houses');
  const b = host.residentsOf(HOUSE_A.mapId, lend);
  assert.notEqual(b, a);
  assert.deepEqual(b.map((r) => r.home), [HOUSE_A.buildingKey]);
  assert.equal(host.isFamilyHouse(HOUSE_A), true);
  assert.equal(host.isFamilyHouse(HOUSE_B), false);
  // AUDIT LEGACY II P3: a save changes nothing a resident is made of - the same residents, the same list
  const before = host.residentsOf(HOUSE_A.mapId, lend);
  modSaveRecords();
  assert.equal(host.residentsOf(HOUSE_A.mapId, lend), before, 'the same list after a save');
  sib.level = 9;
  touch(f);
  const after = host.residentsOf(HOUSE_A.mapId, lend);
  assert.notEqual(after, before, 'one of them changed: a new list');
  assert.notEqual(after[0], before[0]);
  // the dial
  assert.equal(MOD_SETTINGS['project-legacy'].keys['Legacy.Family In World'].default, true, 'on by default');
  assert.equal(legacySettings().familyInWorld, true);
  setModSetting(LEGACY_MOD, 'Legacy.Family In World', false);
  assert.equal(legacySettings().familyInWorld, false);
  assert.deepEqual(host.residentsOf(HOUSE_A.mapId, lend), []);
  assert.equal(host.isFamilyHouse(HOUSE_A), false, 'its rooms the census\'s again');
  _resetModSettings();
  assert.equal(host.residentsOf(HOUSE_A.mapId, lend).length, 1);
  assert.ok(MOD_CURATED['project-legacy'].includes('Legacy.Family In World'), 'on the tile');
});

test('AUDIT LEGACY II P5: the past played back stands no one of the line, and holds no house of theirs', () => {
  _resetModSettings();
  const { host, w } = homeWorld();
  const f = host.family;
  const sib = addChild(f, null, { rng: familyRng(4) }).person;
  sib.parents = []; sib.gen = 0;
  w.held = [HOUSE_A];
  const lend = () => 42;
  modSaveRecords();
  assert.equal(host.residentsOf(HOUSE_A.mapId, lend).length, 1);
  const fallenSave = JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy));
  recordDeath(f, 1, { at: 1 });
  touch(f);
  modSaveRecords();
  restoreModSaveRecords({ ProjectLegacy: fallenSave });
  assert.ok(host.past, 'the fallen founder\'s save is the past');
  assert.deepEqual(host.residentsOf(HOUSE_A.mapId, lend), [], 'none');
  assert.equal(host.isFamilyHouse(HOUSE_A), false);
});

test('LEGACY-HOME: a save made in a house of the line PARKS the member there; one made elsewhere sends them on their own journey', () => {
  _resetModSettings();
  const { host, w } = homeWorld();
  const f = host.family;
  w.held = [HOUSE_A];
  modSaveRecords();
  const sib = addChild(f, null, { rng: familyRng(4) }).person;
  sib.parents = []; sib.gen = 0;
  w.here = { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey };
  assert.equal(host.switchTo(sib.id).ok, true);
  assert.deepEqual(f.people[0].parked, w.here, 'the founder waits at home');
  assert.deepEqual(homeOf(f, f.people[0]), { ...w.here, lent: false });
  // the founder played again, saved in the street: away
  f.currentId = 1;
  w.here = null;
  assert.equal(host.switchTo(sib.id).ok, true);
  assert.equal(f.people[0].parked, null);
  assert.equal(homeOf(f, f.people[0]), null);
});

test('LEGACY-HOME: met in the world - who they are, their greeting, and why Play as is refused (a fight, online, a retired elder)', () => {
  _resetModSettings();
  const { host, w } = homeWorld();
  const f = host.family;
  const child = addChild(f, 1, { rng: familyRng(5) }).person;
  host.tick();
  const res = host.residentsOf(5001, () => 42)[0];
  const kin = host.kinOfResident(res);
  assert.equal(kin.person, child);
  assert.equal(kin.name, `${child.given} ${child.surname}`);
  assert.match(kin.is, /^Your (son|daughter)\.$/);
  assert.equal(kin.refusal, null);
  w.fight = true;
  assert.equal(host.kinOfResident(res).refusal, LEGACY_TEXT.fight);
  w.fight = false;
  w.online = true;
  assert.equal(host.kinOfResident(res).refusal, null, 'PIN MOVED (LEGACY7): online too - a member is a realm character of their own');
  w.online = false;
  child.retired = 50;
  assert.equal(host.kinOfResident(res).refusal, LEGACY_TEXT.retiredKin(child.given));
  assert.equal(host.kinOfResident({ id: 'Fother.2', legacy: {} }), null, 'another family\'s');
  assert.equal(host.kinOfResident({ id: 'L5001.1' }), null, 'a townsperson');
});

test('LEGACY-HOME: a kin STRUCK DOWN by the one played dies in the record - by whose hand, said - and stands no more', () => {
  _resetModSettings();
  const { host, w, storage } = homeWorld();
  const f = host.family;
  const child = addChild(f, 1, { rng: familyRng(5) }).person;
  host.tick();
  const res = host.residentsOf(5001, () => 42)[0];
  assert.equal(host.kinSlain(res), true);
  assert.equal(child.died.cause, 'slain');
  assert.equal(child.died.by, 'Ysolde Hlaalu');
  assert.equal(loadFamily(storage, f.id).people.find((p) => p.id === child.id).died.cause, 'slain', 'a world fact: the store\'s');
  assert.equal(w.said.at(-1), LEGACY_TEXT.kinSlain(`${child.given} ${child.surname}`));
  assert.deepEqual(host.residentsOf(5001, () => 42), []);
  assert.equal(host.kinSlain(res), false, 'once');
});

test('LEGACY-HOME: the House page marks the family home; the card says where each lives', () => {
  _resetModSettings();
  const { host, w, storage } = homeWorld();
  const f = host.family;
  w.held = [HOUSE_A, HOUSE_B];
  modSaveRecords();
  const sib = addChild(f, null, { rng: familyRng(4) }).person;
  assert.equal(livesLine(f, sib), 'At the family home in Gothway Garden');
  assert.equal(host.markHome(HOUSE_B), true);
  assert.deepEqual(loadFamily(storage, f.id).home, { mapId: HOUSE_B.mapId, buildingKey: HOUSE_B.buildingKey }, 'AUDIT LEGACY II P5: the mark is the store\'s at once');
  assert.equal(livesLine(f, sib), 'At the family home in Sentinel');
  assert.equal(host.markHome({ mapId: 1, buildingKey: 1 }), false);
  sib.characterId = 'c-sib';
  assert.equal(livesLine(f, sib), 'On their own journey');
  sib.parked = { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey };
  assert.equal(livesLine(f, sib), 'In their own house in Gothway Garden');
  assert.equal(livesLine(f, f.people[0]), null, 'the one played');
  f.houses = [];
  sib.characterId = null;
  assert.equal(livesLine(f, sib), 'In Gothway Garden, among its townsfolk');
});

// ---- the town -------------------------------------------------------------------------------------------------------

test('LEGACY-HOME: the town reads the line beside its census - the same day\'s people while the list stands, again when it changes; a house lent by seed, a residence with a door', () => {
  const { nav, buildings, doors } = synthTown();
  let extra = [];
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
    clock: () => 600, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND,
    extraPeople: () => extra,
  });
  const lent = town.homeFor('fam-h');
  assert.ok(lent > 0 && isHome(town.places.types.get(lent)) && town.places.doors.has(lent), 'a residence with a door');
  assert.ok([...town.places.doors.keys()].some((k) => !isHome(town.places.types.get(k))), 'the fixture has doors that are no house');
  for (let i = 0; i < 64; i++) assert.ok(isHome(town.places.types.get(town.homeFor(`fam-${i}`))), 'never a shop, a temple or a tavern');
  assert.equal(town.homeFor('fam-h'), lent, 'the same for the same line');
  const day = town.dayOf(600);
  const before = town.peopleOf(day);
  assert.equal(before.length, town.residents.length);
  const { f, sib } = threeOf();
  extra = [residentOf(f, sib, { mapId: 12345, buildingKey: lent })];
  const withKin = town.peopleOf(day);
  assert.equal(withKin.length, before.length + 1);
  assert.equal(withKin.at(-1), extra[0]);
  assert.equal(town.peopleOf(day), withKin, 'kept while the list stands');
  assert.ok(town.planOf(extra[0], day).length > 0, 'a day of their own');
  extra = [];
  assert.equal(town.peopleOf(day).length, before.length, 'gone with the list');
});

// ---- the wiring -----------------------------------------------------------------------------------------------------

test('LEGACY-HOME wiring: the town\'s extra people are the host\'s; a family house holds the line only; a kin slain is the record\'s; the talk door meets them first; their own head in the window', () => {
  const w = rd('src/scenes/world.js');
  // PIN MOVED (LEGACY5): and the census's own record of a spouse who wed in
  assert.match(w, /extraPeople: \(day, town\) => legacyHost\?\.residentsOf\(livingTown\.mapId, \(seed\) => town\.homeFor\(seed\), \(id\) => town\.residents\.find\(\(r\) => r\.id === id\) \?\? null\) \?\? null,/);
  assert.match(w, /if \(legacyHost\?\.isFamilyHouse\(\{ mapId: b\.townMapId \?\? 0, buildingKey: b\.buildingKey \}\)\) return \{ key: b\.buildingKey, town, only: isFamilyRes \};/);
  assert.match(w, /return modes\?\.interiorCtx\?\.ownedRoom \? null : \{ key: b\.buildingKey, town \};/, 'AUDIT-E1 stands for every other room of the player\'s');
  assert.match(w, /if \(isFamilyRes\(res\)\) return false;   \/\/ LEGACY-HOME/);
  assert.match(w, /if \(isFamilyRes\(res\)\) \{ legacyHost\?\.kinSlain\(res\); return; \}/);
  assert.match(w, /kin: \(person, talk\) => legacyMeetKin\(person, talk\) \}/);
  // PIN MOVED (LEGACY7 part five): offline the deeds as before; online the realm character's homes (test/legacy7_homes)
  assert.match(w, /heldHouses: \(\) => \(isOnlinePage\(\) \? \(realmSession \? _legacyOnlineHomes : null\) : \(playerEntity\.houses \?\? \[\]\)\.filter\(\(h\) => \(h\?\.buildingKey \| 0\) > 0 && deedStands\(h\)\)\),/);
  assert.match(w, /play: \(\) => legacyHost\?\.switchTo\(kin\.person\.id, \{ here: true \}\)/);
  const t = rd('src/scenes/townTalk.js');
  const i = t.indexOf('if (livingTalk?.kin?.(target.person, () => converse(target))) return;');
  assert.ok(i > t.indexOf("const moment = target.person?.living?.town?.moment?.(target.person) ?? null;"), 'after the refusal and the moment');
  assert.ok(i < t.indexOf('function converse(target) {'), 'before the words');
  assert.equal((t.match(/portrait: portraitOf\(/g) ?? []).length, 2, 'both mobile doors');
  assert.match(t, /person\?\.living\?\.res\?\.portrait \?\? \{ archive: 'CommonFaces'/);
  assert.match(rd('src/ui/nativeTalk.js'), /PORTRAIT_ARCHIVE\[archive\] \?\? \(HEADS_FILE\.test\(String\(archive\)\) \? String\(archive\) : PORTRAIT_ARCHIVE\.CommonFaces\)/);
  assert.match(rd('src/scenes/livingIndoors.js'), /\.filter\(\(x\) => !b\.only \|\| b\.only\(x\.res\)\)/);
});

test('LEGACY-HOME: Play as from the meeting - a member never played is born in the town they were met in; from the Family tab, at the seat', () => {
  _resetModSettings();
  const { host, w } = homeWorld();
  const f = host.family;
  host.tick();
  const a = addChild(f, 1, { rng: familyRng(5) }).person;
  w.loc = 'Sentinel';
  assert.equal(host.switchTo(a.id, { here: true }).ok, true);
  assert.equal(new URLSearchParams(w.booted.at(-1)).get('loc'), 'Sentinel', 'where they stood');
  f.currentId = 1;
  const b = addChild(f, 1, { rng: familyRng(6) }).person;
  assert.equal(host.switchTo(b.id).ok, true);
  assert.equal(new URLSearchParams(w.booted.at(-1)).get('loc'), 'Gothway Garden', 'the seat');
});
