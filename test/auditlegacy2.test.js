// AUDIT LEGACY II (2026-10-05, Mac: "let's do a deep comprehensive audit on everything so far"): the six-lens audit of
// Project Legacy - LEGACY1-LEGACY4, AUDIT LEGACY's fixes and LEGACY-HOME - bible/01-Overview/Audit-Legacy-II.md, every
// finding pinned here by its id. The law end to end through the real host (scenes/legacyHost.js), the real save
// records (systems/modSaveData.js), the real store (systems/legacy/store.js), the real Living World town
// (systems/livingWorld/livingTown.js on the synthetic town) and the real transfer law (systems/itemTransfer.js); the
// windows and the world host's wiring by source (their reproductions were driven in Chromium - the record says how).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLegacyHost, mergeFamily, LEGACY_TEXT } from '../src/scenes/legacyHost.js';
import { foundFamily, readFamily, addChild, personOf, familyRng, MODELS, recordDeath, touch, LEGACY_VENDOR, LEGACY_MOD } from '../src/systems/legacy/family.js';
import { loadFamily, storeFamily, mergeFacts, leaveBirth, readBirth } from '../src/systems/legacy/store.js';
import { syncHouses, familyHome, kinOf, residentOf, sameHouse } from '../src/systems/legacy/household.js';
import { layoutTree } from '../src/systems/legacy/tree.js';
import { mintRemainsItem, isRemainsItem, REMAINS_LIST } from '../src/systems/legacy/heirloom.js';
import { modSaveRecords, restoreModSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { offlineCopyOf, onlineCopyOf } from '../src/systems/offlineCopy.js';
import { planStore } from '../src/systems/itemTransfer.js';
import { LivingTown, householdKeyOf } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { isDomFocusWalk } from '../src/ui/input.js';
import { walkButtons } from '../src/ui/legacyDoor.js';
import { windowPrompts } from '../src/ui/plusPad.js';
import { setItemFields, mintCondition } from '../src/systems/itemTemplates.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { synthTown } from './lwTown.mjs';
import { mintKeepsake } from '../src/systems/livingWorld/keepsake.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const sword = () => ({ ...mintCondition(setItemFields({ group: 'Weapons', templateIndex: 120, material: 4, flags: 0, variant: 0, message: 0, stackCount: 1 })), equipSlot: 1 });
const HOUSE_A = Object.freeze({ regionIndex: 17, mapId: 5001, buildingKey: 0x10203, location: 'Gothway Garden' });
const HOUSE_B = Object.freeze({ regionIndex: 20, mapId: 7002, buildingKey: 0x20304, location: 'Sentinel' });

function person(cid, name = 'Ysolde Hlaalu') {
  return {
    name, gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40,
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), items: [sword()], wagonItems: [],
  };
}

/** One world: the host over shared storage; the entity swappable (a load is a new character in the same slot); the saves
 *  the game holds (`w.saved`, by character id) are what `hasSave` and `loadCharacter` read. */
function world({ model = MODELS.bloodline, storage = mem(), tab = mem(), siblings = false } = {}) {
  _resetModSaveData();
  _resetModSettings();
  const w = { said: [], booted: [], loads: [], saveOk: true, now: 100, online: false, fight: false, gold: 1000, at: false, opened: [], held: [], here: null, saved: new Map(), living: true };
  w.e = person('c-ysolde');
  w.storage = storage; w.tab = tab;
  w.host = createLegacyHost({
    get entity() { return w.e; },
    storage: () => storage, tab: () => tab, on: () => true, online: () => w.online,
    now: () => w.now, own: () => 0,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity, mapId: 5001, world: { x: 0, z: 0 } }),
    town: (h) => ({ region: h.region, loc: h.loc, mapId: h.mapId }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => w.gold, say: (l) => w.said.push(l), boot: (s) => w.booted.push(s), search: () => '?world',
    loadCharacter: (cid) => { if (!w.saved.has(cid)) return false; w.loads.push(cid); return true; },
    saveNow: () => { if (!w.saveOk) return false; const rec = modSaveRecords().ProjectLegacy; w.saved.set(String(w.e.characterId), JSON.parse(JSON.stringify(rec))); return true; },
    hasSave: (cid) => w.saved.has(cid),
    inFight: () => w.fight, payEstate: (n) => w.said.push(`estate ${n}`), rng: familyRng(7),
    atPlace: () => w.at, openRemains: (r, items) => { w.opened.push(items); return true; }, carried: () => [...w.e.items, ...w.e.wagonItems],
    heldHouses: () => w.held, houseHere: () => w.here, livingWorld: () => w.living,
  });
  if (!siblings) setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  w.host.found(model);
  _resetModSettings();
  w.saved.set('c-ysolde', JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy)));
  return w;
}
/** A load: the save's record restored with `entity` as the one in the slot. */
function load(w, rec, entity) { w.e = entity; restoreModSaveRecords({ ProjectLegacy: JSON.parse(JSON.stringify(rec)) }); }
/** The born page: the boot's takeBorn, finishChargen's entity, onBorn. */
function bear(w, id, cid) {
  const b = w.host.takeBorn(id);
  if (!b) return null;
  w.e = person(cid, `${b.person.given} ${b.person.surname}`);
  w.e.items = [];
  w.host.onBorn();
  return b.person;
}

// ---- lens A: the law and the host --------------------------------------------------------------------------------

test('AUDIT LEGACY II A1: after the Succession hands the line on, the dying page acts for no one - no estate paid into it, no remains claimed', () => {
  const w = world();
  w.host.deathOutcome();
  w.at = true;   // the fallen lies where they fell - their own remains beside them
  assert.equal(w.host.succeed({ newborn: true }), true);
  for (let i = 0; i < 3; i++) w.host.tick();   // the boot has not landed: the old page ticks on
  assert.ok(!w.said.some((l) => /^estate /.test(l)), 'nothing paid into the dying page');
  assert.equal(w.opened.length, 0, 'nothing opened for the heir on the fallen\'s page');
  assert.equal(w.host.family.remains[0].by, null);
  const heir = bear(w, w.host.current().id, 'c-heir');
  assert.ok(w.said.includes('estate 250'), 'the estate paid on the heir\'s first day, once');
  assert.equal(heir.estatePaid, 250);
});

test('AUDIT LEGACY II A1: a switch hands the line on - until the other\'s boot lands, the page left acts for no one', () => {
  const w = world();
  const f = w.host.family;
  const sib = addChild(f, null, { rng: familyRng(3) }).person;
  sib.parents = []; sib.gen = 0; sib.characterId = 'c-sib'; sib.estate = 300;   // their estate, unpaid - it is theirs to take
  w.saved.set('c-sib', JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy)));
  f.remains = [{ id: 'r9', of: 9, name: 'X', items: [mintRemainsItem({ line: f.id, of: 9, name: 'X' })], first: [], state: 'lying', by: null, place: { pixel: { x: 1, y: 1 } }, found: false }];
  w.at = true;
  assert.equal(w.host.switchTo(sib.id).ok, true);
  w.said.length = 0;
  for (let i = 0; i < 3; i++) w.host.tick();   // the load has not landed: the founder's page ticks on
  assert.ok(!w.said.some((l) => /^estate /.test(l)), 'the sibling\'s estate is never paid into the founder\'s pack');
  assert.equal(w.opened.length, 0, 'no list opened for them on a page not theirs');
  assert.equal(sib.estatePaid | 0, 0);
});

test('AUDIT LEGACY II A2/B1/H3: a birth stands only with its save - a refused first save undoes it, and the reload bears the heir again with the estate', () => {
  const w = world();
  w.host.deathOutcome();
  w.host.succeed({ newborn: true });
  const id = w.host.current().id;
  assert.ok(w.host.family.pending, 'B1: the fall waits until the heir lands');
  w.saveOk = false;
  bear(w, id, 'c-heir');
  const stored = loadFamily(w.storage, w.host.family.id);
  assert.equal(personOf(stored, id).characterId, null, 'no character id stands without a save');
  assert.ok(stored.pending, 'the fall still waits');
  assert.ok(readBirth(w.tab, id), 'the handoff waits');
  assert.ok(w.said.includes(LEGACY_TEXT.notBorn(personOf(stored, id).given)), 'said');
  // the reload: born again, and this time saved
  w.saveOk = true;
  w.said.length = 0;
  const heir = bear(w, id, 'c-heir2');
  assert.ok(heir, 'the birth door takes them');
  assert.equal(heir.characterId, 'c-heir2');
  assert.ok(w.said.includes('estate 250'), 'the estate, paid with the save that holds it');
  assert.equal(loadFamily(w.storage, w.host.family.id).pending, null, 'the fall answered as the heir landed');
  assert.equal(readBirth(w.tab, id), null);
});

test('AUDIT LEGACY II A2/B1: a member whose saves are gone is born again from their person - never a Succession that loads no one', () => {
  const w = world();
  const sib = addChild(w.host.family, null, { rng: familyRng(3) }).person;
  sib.parents = []; sib.gen = 0; sib.characterId = 'c-sib';   // played once - and their saves deleted since
  w.host.deathOutcome();
  assert.equal(w.host.succeed({ personId: sib.id }), true);
  assert.deepEqual(w.loads, [], 'no save to load');
  assert.equal(new URLSearchParams(w.booted.at(-1)).get('legacyborn'), String(sib.id), 'their birth asked instead');
  assert.ok(w.host.family.pending, 'the fall waits on the record until they land');
  assert.equal(loadFamily(w.storage, w.host.family.id).people.find((p) => p.id === sib.id).characterId, null, 'the play door cleared the id no save holds - the record says so at once');
  const born = bear(w, sib.id, 'c-sib2');
  assert.ok(born, 'the birth door takes a person whose id no save holds');
  assert.equal(w.host.family.pending, null);
});

test('AUDIT LEGACY II A2: the birth door asks the play door\'s question - an id no save holds was never born; one a save holds is never born twice', () => {
  const w = world();
  const f = w.host.family;
  const sib = addChild(f, null, { rng: familyRng(3) }).person;
  sib.parents = []; sib.gen = 0; sib.characterId = 'c-gone';
  touch(f);
  storeFamily(w.storage, f);
  leaveBirth(w.tab, { familyId: f.id, personId: sib.id, region: 'Daggerfall', loc: 'Gothway Garden', estate: 0 });
  assert.ok(w.host.takeBorn(sib.id), 'their saves are gone: born from their person');
  w.saved.set('c-kept', {});
  const other = addChild(w.host.family, null, { rng: familyRng(4) }).person;
  other.characterId = 'c-kept';
  touch(w.host.family);
  storeFamily(w.storage, w.host.family);
  leaveBirth(w.tab, { familyId: f.id, personId: other.id, region: 'Daggerfall', loc: 'Gothway Garden', estate: 0 });
  assert.equal(w.host.takeBorn(other.id), null, 'a save of them stands: loaded, never born twice');
});

test('AUDIT LEGACY II A3/H2: a claim stands through a rewind and lapses onto the list as its claimant left it - one heirloom, never two', () => {
  const stored = foundFamily(person('c-a'), { id: 'fam-c' });
  const heir = addChild(stored, 1, { rng: familyRng(2) }).person;
  heir.characterId = 'c-t';
  const items = [mintRemainsItem({ line: 'fam-c', of: 1, name: 'A' }), sword(), { templateIndex: 276, stackCount: 100 }];
  stored.remains = [{ id: 'r1', of: 1, name: 'A', items: [items[0]], first: items, state: 'lying', by: heir.id, place: null }];
  stored.rev = 9;
  // the heir rewinds to a save made BEFORE they opened the list: the list comes back with their bag - and stays THEIR claim
  const before = JSON.parse(JSON.stringify(stored));
  before.remains = [];
  before.rev = 3;
  const m = mergeFamily(readFamily(stored), readFamily(before), 'c-t');
  assert.equal(m.remains[0].items.length, 3, 'their rewind restores the list');
  assert.equal(m.remains[0].by, heir.id, 'H2: the claim is the store\'s, and stands');
  // another member's save never rewinds a list it did not claim
  const sib = addChild(stored, null, { rng: familyRng(4) }).person;
  sib.characterId = 'c-s';
  const sibSave = JSON.parse(JSON.stringify(stored));
  sibSave.remains[0] = { ...sibSave.remains[0], items: JSON.parse(JSON.stringify(items)), by: null };
  sibSave.rev = 4;
  const m2 = mergeFamily(readFamily(stored), readFamily(sibSave), 'c-s');
  assert.equal(m2.remains[0].items.length, 1, 'A3: a save\'s older copy of a list it never claimed is no grant');
  // ...nor of a list NOBODY claims now (a lapsed claim): the store's list lies as it was left
  const lapsed = readFamily(JSON.parse(JSON.stringify(stored)));
  lapsed.remains[0].by = null;
  const m3 = mergeFamily(lapsed, readFamily(sibSave), 'c-s');
  assert.equal(m3.remains[0].items.length, 1, 'nobody\'s row: the store\'s');
});

test('AUDIT LEGACY II A3: a lapsed claim leaves the list as the claimant left it - the next claimant\'s rewind returns to that', () => {
  const w = world({ siblings: false });
  const f = w.host.family;
  const a = addChild(f, 1, { rng: familyRng(2) }).person;
  a.characterId = 'c-claimant';
  const items = [mintRemainsItem({ line: f.id, of: 1, name: 'Old' }), sword()];
  f.remains = [{ id: 'r1', of: 1, name: 'Old', items: [items[0]], first: JSON.parse(JSON.stringify(items)), state: 'lying', by: a.id, place: { pixel: { x: 1, y: 1 } }, found: true }];
  recordDeath(f, a.id, { at: 5 });   // the claimant falls, the heirloom they took with them
  w.host.questLogEntries();   // the claim lapses as the one played seeks the remains
  const r = f.remains[0];
  assert.equal(r.by, null);
  assert.equal(r.first.length, 1, 'the list as first laid is gone - what lies now is what the lapsed one left');
  assert.equal(loadFamily(w.storage, f.id).remains[0].first.length, 1, 'and the store knows it at once');
});

test('AUDIT LEGACY II A4/P1: a write never loses a fact the store holds - a second tab\'s death stands; a refused write is said and tried again', () => {
  const s = mem();
  const tab1 = foundFamily(person('c-a'), { id: 'fam-t' });
  addChild(tab1, 1, { rng: familyRng(1) });
  storeFamily(s, tab1);
  const tab2 = readFamily(JSON.parse(JSON.stringify(tab1)));
  recordDeath(tab2, 2, { at: 7 });
  tab2.rev = 6;
  storeFamily(s, tab2);   // tab 2 wrote ahead
  recordDeath(tab1, 1, { at: 8 });
  tab1.rev = 5;
  assert.equal(storeFamily(s, tab1), true, 'tab 1\'s death is written, never refused');
  const both = loadFamily(s, 'fam-t');
  assert.ok(personOf(both, 1).died && personOf(both, 2).died, 'both deaths stand');
  assert.equal(both.rev, 7);
  assert.ok(personOf(tab1, 2).died, 'and tab 1 plays on knowing tab 2\'s');
  // a fall the other copy left waiting is taken in only by a copy that never heard of that death
  const x = readFamily(JSON.parse(JSON.stringify(both)));
  const y = readFamily(JSON.parse(JSON.stringify(both)));
  y.pending = { fallenId: 1, at: 8, estate: 9, bequest: [] };
  assert.equal(mergeFacts(x, y).pending, null, 'heard of it, answered it');
  // the storage refuses: said once, tried at every tick, landed when it can
  const w = world();
  const real = w.storage.setItem;
  w.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  w.host.deathOutcome();
  assert.ok(w.said.includes(LEGACY_TEXT.notStored), 'said');
  assert.equal(loadFamily(w.storage, w.host.family.id).people[0].died, null);
  w.storage.setItem = real;
  w.host.tick();
  assert.ok(loadFamily(w.storage, w.host.family.id).people[0].died, 'the death lands at the next tick');
});

test('AUDIT LEGACY II A5: the line\'s houses keep their places - the family home never moves with whoever is played', () => {
  const f = foundFamily(person('c-a'), { id: 'fam-h', seat: { region: 'X', loc: 'Elsewhere' } });
  syncHouses(f, 1, [HOUSE_A]);
  syncHouses(f, 2, [HOUSE_B]);
  const home = familyHome(f);
  for (let i = 0; i < 3; i++) { syncHouses(f, 1, [HOUSE_A]); syncHouses(f, 2, [HOUSE_B]); }
  assert.ok(sameHouse(familyHome(f), home), 'the first house stays the first');
  assert.equal(syncHouses(f, 1, [HOUSE_A]), false, 'and nothing changed is no write');
  syncHouses(f, 1, []);
  assert.deepEqual(f.houses.map((h) => h.location), ['Sentinel'], 'a sale leaves its place');
});

test('AUDIT LEGACY II A6/A7/F2/B4: the line learns a deed and where a member stands with the SAVE that holds them - never a tick, a rise or online', () => {
  const w = world({ model: MODELS.enduring });
  const f = w.host.family;
  w.held = [HOUSE_A];
  w.host.tick();
  assert.deepEqual(f.houses, [], 'A6: an unsaved purchase is no house of the line\'s');
  modSaveRecords();   // saved in the street: the line knows the house, and the founder is not parked
  assert.equal(f.people[0].parked, null);
  w.here = { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey };
  assert.equal(w.host.deathOutcome().kind, 'rise');
  assert.equal(f.people[0].parked, null, 'A7: a rise in the house made no save - nobody is parked by it');
  modSaveRecords();
  assert.deepEqual(f.houses.map((h) => h.location), ['Gothway Garden'], 'the save holds the deed: the line\'s');
  assert.deepEqual(f.people[0].parked, { mapId: HOUSE_A.mapId, buildingKey: HOUSE_A.buildingKey }, 'and the save says where they stand');
  // F2/B4 (AUDIT LEGACY II): online the line learned whatever the host handed it, against the arc. LEGACY7 part five
  // (PIN MOVED, the law changed by its own slice - Legacy-Arc 10b): the realm keeps the line now, and online the world
  // hands this realm character's online homes - learned with the save as a deed is offline; a list not read yet (null)
  // learns nothing and drops nothing (test/legacy7_homes.test.js holds the online law whole)
  const o = world({ model: MODELS.enduring });
  o.online = true;
  o.held = null;
  modSaveRecords();
  assert.deepEqual(o.host.family.houses, [], 'F2/B4: the realm\'s homes not read yet - nothing is learned');
  o.held = [HOUSE_B];
  o.host.tick();
  assert.deepEqual(o.host.family.houses, [], 'A6 online: never a tick');
  modSaveRecords();
  assert.deepEqual(o.host.family.houses.map((h) => h.location), ['Sentinel'], 'the save learns the realm\'s home');
});

test('AUDIT LEGACY II A8/P3: the line\'s residents are the same objects while nothing they are made of changes - a save, a rev, a reload; new when they change', () => {
  const w = world();
  const f = w.host.family;
  const sib = addChild(f, null, { rng: familyRng(4) }).person;
  sib.parents = []; sib.gen = 0;
  const lend = () => 42;
  const a = w.host.residentsOf(5001, lend);
  assert.equal(a.length, 1);
  modSaveRecords(); touch(f); touch(f);
  const b = w.host.residentsOf(5001, lend);
  assert.equal(b, a, 'a save or a rev: the same list');
  assert.equal(b[0], a[0], '...and the same resident');
  const sib2 = addChild(f, null, { rng: familyRng(6) }).person;
  sib2.parents = []; sib2.gen = 0;
  const two = w.host.residentsOf(5001, lend);
  assert.equal(two.length, 2);
  assert.equal(two.find((r) => r.legacy.personId === sib.id), a[0], 'another joined: this one is the same resident');
  sib.level = 12;
  const c = w.host.residentsOf(5001, lend);
  assert.notEqual(c.find((r) => r.legacy.personId === sib.id), a[0], 'one of them changed: dressed anew');
  assert.equal(c.find((r) => r.legacy.personId === sib2.id), two.find((r) => r.legacy.personId === sib2.id), '...and only them');
  // A8: an in-page load of another member's save - the one now played is never served as a resident
  sib.characterId = 'c-sib';
  w.saved.set('c-sib', JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy)));
  load(w, w.saved.get('c-sib'), person('c-sib', `${sib.given} ${sib.surname}`));
  assert.ok(!w.host.residentsOf(5001, lend).some((r) => r.legacy.personId === sib.id), 'the one played stands nowhere');
});

test('AUDIT LEGACY II A9: no one is their own ancestor - a damaged record\'s cycle is cut at the read, and kinship never walks one', () => {
  const f = foundFamily(person('c-a'), { id: 'fam-k' });
  const kid = addChild(f, 1, { rng: familyRng(1) }).person;
  f.people[0].parents = [kid.id];   // the founder made the child's child - damaged
  const back = readFamily(JSON.parse(JSON.stringify(f)));
  assert.deepEqual(personOf(back, 1).parents, [], 'the link that closes the cycle is dropped');
  assert.deepEqual(personOf(back, kid.id).parents, [1]);
  f.people[0].parents = [1];
  assert.deepEqual(personOf(readFamily(JSON.parse(JSON.stringify(f))), 1).parents, [], 'nor their own parent');
  // and kinOf is bounded even on a record never read
  const raw = foundFamily(person('c-b'), { id: 'fam-k2' });
  const c = addChild(raw, 1, { rng: familyRng(1) }).person;
  raw.people[0].parents = [c.id];
  assert.doesNotThrow(() => kinOf(raw, raw.people[0], c));
});

test('AUDIT LEGACY II F11 (A9 of AUDIT LEGACY, unpinned until now): a load resets the visit - a death latched, an outcome, the past', () => {
  const w = world();
  w.host.deathOutcome();
  assert.ok(w.host.family.pending);
  const fallen = JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy));
  load(w, fallen, person('c-ysolde'));
  assert.ok(w.host.past, 'the fallen\'s save is the past');
  assert.equal(w.host.willRise(), false, 'no outcome of the last visit rides into this one');
  assert.match(rd('src/scenes/legacyHost.js'), /function adopt\(rec\) \{\n\s*past = null; outcome = null; deathSeen = false; elderSaid = false;/);
});

test('AUDIT LEGACY II A10: a remains row\'s list as laid is held to its shape - a damaged one never becomes the list', () => {
  const f = foundFamily(person('c-a'), { id: 'fam-r' });
  f.remains = [{ id: 'r1', of: 1, name: 'A', items: [{ templateIndex: 1810 }], first: { broken: true }, state: 'lying', by: null }];
  const back = readFamily(JSON.parse(JSON.stringify(f)));
  assert.ok(Array.isArray(back.remains[0].first));
  assert.equal(back.remains[0].first.length, 1, 'the list as it lies, when the laid one is damaged');
});

// ---- lens H: heirlooms, the remains, the estate --------------------------------------------------------------------

test('AUDIT LEGACY II H1: a copy between the lanes is a new character of no house - both doors drop the record, and a record with no person for the played lets go', () => {
  const snap = { name: 'Y', characterId: 'c-y', classicMinutes: 1000, worldMinutes: 900, modData: { [LEGACY_VENDOR]: { v: 1 }, other: { x: 1 } } };
  assert.equal(offlineCopyOf(snap).modData[LEGACY_VENDOR], undefined, 'copy to offline');
  assert.equal(onlineCopyOf(snap, 5000).modData[LEGACY_VENDOR], undefined, 'customs');
  assert.deepEqual(onlineCopyOf(snap, 5000).modData.other, { x: 1 }, 'nothing else of the save touched');
  assert.equal(offlineCopyOf({ ...snap, classicMinutes: undefined }).modData[LEGACY_VENDOR], undefined, 'whatever the clocks say');
  // a save carrying another character's record: the host lets it go, and the character founds its own house
  const w = world();
  const theirs = JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy));
  load(w, theirs, person('c-copy', 'Copy Hlaalu'));
  assert.equal(w.host.family, null, 'not theirs');
  w.host.afterBoot();
  assert.ok(w.host.family && w.host.family.id !== theirs.id, 'a house of its own');
});

test('AUDIT LEGACY II H4: the bones go back into their own list or stay in the character\'s keeping - never a chest, a pile or the ground', () => {
  const bones = mintRemainsItem({ line: 'f', of: 3, name: 'A' });
  assert.equal(planStore(bones, { remote: [] }).refusal?.reason, 'remains', 'a chest, a pile, the ground');
  const own = [];
  Object.defineProperty(own, REMAINS_LIST, { value: 3, enumerable: false });
  assert.equal(planStore(bones, { remote: own }).ok, true, 'their own list, open');
  const other = [];
  Object.defineProperty(other, REMAINS_LIST, { value: 9, enumerable: false });
  assert.equal(planStore(bones, { remote: other }).ok, false, 'another fallen\'s list');
  assert.equal(planStore(bones, { remote: [], usingWagon: true }).ok, true, 'the wagon is the character\'s keeping');
  assert.equal(planStore(sword(), { remote: [] }).ok, true, 'anything else as before');
  assert.equal(JSON.stringify(own), '[]', 'the mark is never saved');
});

test('AUDIT LEGACY II H5/P6: a list is claimed by the member who changes it - opened and left, it is nobody\'s; others see whose search it is; a rest lays the rest to rest', () => {
  const w = world();
  w.host.deathOutcome();
  w.host.succeed({ newborn: true });
  const heir = bear(w, w.host.current().id, 'c-heir');
  w.at = true;
  w.host.tick();
  const row = w.host.family.remains[0];
  assert.equal(w.opened.length, 1);
  assert.equal(row.by, null, 'opened, unchanged: nobody\'s');
  row.items.splice(1, 1);
  w.host.tick();
  assert.equal(row.by, heir.id, 'changed: the heir\'s');
  // another member sees whose search it is
  const sib = addChild(w.host.family, null, { rng: familyRng(5) }).person;
  sib.characterId = 'c-sib2';
  w.saved.set('c-sib2', JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy)));
  load(w, w.saved.get('c-sib2'), person('c-sib2', `${sib.given} ${sib.surname}`));
  const log = w.host.questLogEntries();
  assert.equal(log.length, 1);
  assert.match(log[0].messages[0][0], new RegExp(`${heir.given} .* has taken up the search`));
  assert.deepEqual(w.host.mapMarks(), [], 'no ring for a search that is another\'s');
  // P6: laid to rest, a row keeps no lists
  assert.match(rd('src/scenes/legacyHost.js'), /r\.restedAt = deps\.now\(\);\n[^\n]*\n[^\n]*\n\s*r\.items = \[\];\n\s*delete r\.first;/);
});

// ---- lens B: the world's wiring -----------------------------------------------------------------------------------

function town(extra, keepsakes = []) {
  const { nav, buildings, doors } = synthTown();
  return new LivingTown(nav, {
    keepsakes: () => keepsakes, takeKeepsake: (it) => keepsakes.splice(keepsakes.indexOf(it), 1),
    town: { mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
    clock: () => 600, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND,
    extraPeople: () => extra.list,
  });
}

test('AUDIT LEGACY II B2: the line is its own household - a census house lent to it shares no kin, no grief and no keepsake with its census people', () => {
  const extra = { list: [] };
  const pack = [];
  const t = town(extra, pack);
  const lent = t.homeFor('fam-h');
  const census = t.residents.filter((r) => r.home === lent);
  pack.push(mintKeepsake({ id: `${census[0].id}~fallen`, name: 'A fallen neighbour', town: 12345, home: lent }));   // one of the lent house's census, fallen
  assert.ok(census.length > 0, 'the fixture lends a lived-in house');
  const f = foundFamily(person('c-a'), { id: 'fam-h' });
  const a = addChild(f, 1, { rng: familyRng(1) }).person;
  const b = addChild(f, 1, { rng: familyRng(2) }).person;
  extra.list = [residentOf(f, a, { mapId: 12345, buildingKey: lent }), residentOf(f, b, { mapId: 12345, buildingKey: lent })];
  assert.equal(householdKeyOf(extra.list[0]), 'Ffam-h');
  assert.equal(householdKeyOf(census[0]), `H${lent}`);
  assert.deepEqual(t.kinOf(extra.list[0]).map((r) => r.id), [extra.list[1].id], 'their kin: the line alone');
  assert.ok(!t.kinOf(census[0]).some((r) => r.legacy), 'a census household\'s: never the line');
  assert.equal(t.moment({ living: { res: extra.list[0] } }), null, 'no keepsake moment is the line\'s');
  assert.equal(pack.length, 1, 'the census household\'s keepsake still carried - for its own');
});

test('AUDIT LEGACY II B3/P7: a resident whose home changed is planned again at once; the town lists its houses once', () => {
  const extra = { list: [] };
  const t = town(extra);
  const f = foundFamily(person('c-a'), { id: 'fam-h' });
  const a = addChild(f, 1, { rng: familyRng(1) }).person;
  const first = t.homeFor('fam-h');
  const other = [...t.places.doors.keys()].find((k) => k !== first && t.places.types.get(k) === t.places.types.get(first)) ?? first;
  extra.list = [residentOf(f, a, { mapId: 12345, buildingKey: first })];
  const day = t.dayOf(600);
  const p1 = t.planOf(extra.list[0], day);
  extra.list = [residentOf(f, a, { mapId: 12345, buildingKey: other })];
  const p2 = t.planOf(extra.list[0], day);
  assert.notEqual(p2, p1, 'planned again for the new house, the same day');
  assert.equal(t.planOf(extra.list[0], day), p2, 'and kept while it stands');
  const list = t._homes;
  t.homeFor('x'); t.homeFor('y');
  assert.equal(t._homes, list, 'the houses listed once');
});

test('AUDIT LEGACY II B5/B6: the line stands only where the Living World runs; the meeting\'s Talk only while the body is still theirs', () => {
  const w = world();
  const sib = addChild(w.host.family, null, { rng: familyRng(4) }).person;
  sib.parents = []; sib.gen = 0;
  assert.equal(w.host.residentsOf(5001, () => 42).length, 1);
  w.living = false;
  assert.deepEqual(w.host.residentsOf(5001, () => 42), [], 'B5: no Living World, no line in its towns');
  const src = rd('src/scenes/world.js');
  assert.match(src, /livingWorld: \(\) => livingWorldOn\(\),   \/\/ AUDIT LEGACY II B5/);
  assert.match(src, /inWorld: \(\) => legacySettings\(\)\.familyInWorld && livingWorldOn\(\),/);
  assert.match(src, /talk: \(\) => \{ if \(person\.living\?\.res\?\.id === resId\) talk\(\); else townTalk\.say\(`\$\{kin\.person\.given\} has gone on their way\.`\); \},/, 'B6');
  // PIN MOVED (LEGACY7): online the realm's living characters are the word (a tombstone is none)
  assert.match(src, /hasSave: \(cid\) => \(legacyRealmLine \? !legacyRealmRoster \|\| legacyRealmRoster\.has\(String\(cid\)\) : newestSaveOf\(enumerateSaves\(\)\.info, cid\) >= 0\),/, 'A2/B1: the game\'s saves are the host\'s word');
});

// ---- lens P: persistence and the tests' truth ----------------------------------------------------------------------

test('AUDIT LEGACY II P2: of a save and the store, a NEWER save is the base, and the merged copy is never behind the store', () => {
  const stored = foundFamily(person('c-a'), { id: 'fam-p' });
  stored.rev = 4;
  const saved = readFamily(JSON.parse(JSON.stringify(stored)));
  saved.rev = 9;
  saved.houses = [{ ...HOUSE_A, by: 1 }];   // learned by a save the store never heard of (a refused write)
  const m = mergeFamily(readFamily(stored), saved, 'c-a');
  assert.deepEqual(m.houses.map((h) => h.location), ['Gothway Garden'], 'the newer save is the base');
  assert.equal(m.rev, 9);
  const older = readFamily(JSON.parse(JSON.stringify(stored)));
  older.rev = 2;
  const ahead = readFamily(JSON.parse(JSON.stringify(stored)));
  ahead.rev = 12;
  assert.equal(mergeFamily(ahead, older, 'c-a').rev, 12, 'never below the store - a lower copy\'s every write would merge forever');
});

// ---- lens U: the windows -----------------------------------------------------------------------------------------

test('AUDIT LEGACY II U1/U2/U11/U14: a held key presses once; the meeting lights Talk and asks Play as twice; a refusal is a sentence and stays in the walk; no Back over the Succession', () => {
  const clicks = [];
  const btn = { disabled: false, click: () => clicks.push(1), focus() {} };
  const root = { querySelectorAll: () => [btn], ownerDocument: { activeElement: btn } };
  walkButtons(root, 'Enter', { repeat: true });
  assert.deepEqual(clicks, [], 'U1: a repeat presses nothing');
  walkButtons(root, 'Enter', { repeat: false });
  assert.deepEqual(clicks, [1]);
  const succ = rd('src/ui/legacySuccession.js');
  assert.match(succ, /if \(e\.repeat && \(e\.key === 'Enter' \|\| e\.key === ' '\)\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); \}/, 'U1: the browser\'s own repeat press too');
  assert.match(succ, /if \(c\.confirm && armed !== c\.key\) \{ armed = c\.key; draw\(\); return; \}/, 'U2: asked twice');
  assert.match(succ, /go\.setAttribute\('aria-disabled', 'true'\);\n\s*go\.setAttribute\('aria-describedby', shut\.id\);/, 'U14: in the walk, described');
  const door = rd('src/ui/legacyDoor.js');
  assert.match(door, /lit: 'lgs-act-talk',/, 'U2: Talk lit');
  assert.match(door, /confirm: `Yes - \$\{deps\.act/);
  // U11: the switch's marker never reaches the card as a word
  const w = world();
  const sib = addChild(w.host.family, null, { rng: familyRng(4) }).person;
  sib.parents = []; sib.gen = 0;
  const res = w.host.residentsOf(5001, () => 42)[0];
  w.host.family.pending = { fallenId: 1, at: 1, estate: 0, bequest: [] };
  assert.equal(w.host.kinOfResident(res).refusal, LEGACY_TEXT.pending);
  w.host.family.pending = null;
  w.host.family.currentId = sib.id;   // the marker's own case: the resident is the one played
  assert.equal(w.host.kinOfResident(res).refusal, LEGACY_TEXT.notNow);
  // U14: the pad's bar offers no Back over a window that has none
  assert.ok(windowPrompts({ back: false }).every(([, words]) => words !== 'Back'));
  assert.ok(windowPrompts({}).some(([, words]) => words === 'Back'));
  assert.match(door, /host\.setAttribute\?\.\('data-no-back', ''\);/);
});

test('AUDIT LEGACY II U3: Tab walks a DOM window that owns the focus - both hosts\' overlay rungs let it through', () => {
  const inside = { closest: (sel) => (sel === '[data-dom-focus]' ? {} : null) };
  const outside = { closest: () => null };
  assert.equal(isDomFocusWalk({ key: 'Tab', target: inside }), true);
  assert.equal(isDomFocusWalk({ key: 'Tab', target: outside }), false, 'the canvas: the host\'s');
  assert.equal(isDomFocusWalk({ key: 'Enter', target: inside }), false, 'Tab alone');
  assert.match(rd('src/scenes/townTalk.js'), /if \(isDomFocusWalk\(e\)\) return true;/);
  assert.match(rd('src/ui/input.js'), /if \(ctx\.uiOverlayActive && isDomFocusWalk\(e\)\) return false;/);
  assert.match(rd('src/ui/pauseDoor.js'), /host\.setAttribute\?\.\('data-dom-focus', ''\);/);
});

test('AUDIT LEGACY II U4-U10/U12/U13: the Family pages - no hidden scroll, a seen focus, the keyboard kept on armed acts and the homes, drags that end, five tabs on a phone, tags and names that wrap, a finger\'s links', () => {
  const fam = rd('src/ui/familyPages.js');
  assert.match(fam, /view\.onscroll = \(\) => \{ if \(view\.scrollLeft \|\| view\.scrollTop\) \{ view\.scrollLeft = 0; view\.scrollTop = 0; \} \};/, 'U4');
  assert.match(fam, /\.px-sys \.fam-node:focus-visible \{ outline: 2px dashed #f3cf86;/, 'U5');
  assert.match(fam, /\.px-sys \.fam-kin button:focus-visible \{ outline: 1px solid #f3cf86;/, 'U5');
  assert.match(fam, /b\.setAttribute\('data-focus', 'fam-act-switch'\);/, 'U6');
  assert.match(fam, /b\.setAttribute\('data-focus', 'fam-act-mantle'\);/, 'U6');
  assert.match(rd('src/ui/domRepaint.js'), /if \(!n\) \{\n\s*n = \[\.\.\.host\.querySelectorAll\(k\.tag\)\]\.find\(\(x\) => placeOf\(host, x\) === k\.place\) \?\? null;/, 'U6: the key wins over the words');
  assert.match(fam, /is the family home now\./, 'U7: said');
  assert.match(fam, /n\.setAttribute\('data-focus', 'fam-home-said'\);/, 'U7: the keyboard kept on the homes');
  assert.match(fam, /if \(drag && e\.buttons !== undefined && !\(e\.buttons & 1\)\) \{ endDrag\(\); return; \}/, 'U8');
  assert.match(fam, /view\.onpointercancel = endDrag;/, 'U8');
  assert.match(rd('src/ui/enhancedStyle.js'), /@media \(max-width: 420px\) \{\n\s*\.px-tabs \{ gap: 2px;/, 'U9');
  assert.match(rd('src/ui/enhancedPlusStyle.js'), /\.lvl-opt-head \{ display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; \}/, 'U10');
  assert.match(rd('src/ui/legacySuccession.js'), /\.lgs-name \{ font-size: 15px; color: #f3cf86; overflow-wrap: anywhere; \}/, 'U12');
  assert.match(fam, /display: inline-block; padding: 5px 0; \}/, 'U13');
  assert.match(rd('src/ui/legacySuccession.js'), /@media \(max-width: 520px\) \{ \.lgs-card \{ grid-template-columns: 52px minmax\(0, 1fr\); \} \.lgs-card \.lgs-go \{ grid-column: 1 \/ -1; \} \}/, 'F11: AUDIT LEGACY U9, the phone\'s two-column card, pinned at last');
});

// ---- lens F: the records -------------------------------------------------------------------------------------------

test('AUDIT LEGACY II F1/F3-F5/F12/F14: the records say what is built', () => {
  const arc = rd('bible/06-Systems/Legacy-Arc.md');
  assert.doesNotMatch(arc, /capped at 10,000/, 'F1: the estate is 9,900');
  assert.match(arc, /9,900/);
  assert.match(arc, /struck down by the one played[^.]*leaves? no remains/, 'F3');
  assert.doesNotMatch(arc, /the death's purse\) - offline too/, 'F5');
  assert.match(arc, /LoadSettings[^.]*never clears/, 'F12');
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /\(15\) THE SWITCH REACHES ANY LIVING MEMBER OF THE BLOOD/, 'F4');
  assert.doesNotMatch(rd('src/systems/legacy/tree.js'), /&& false\)/, 'F14: no dead clause');
  // the layout is unchanged by it: a spouse who married in is never a root
  const f = foundFamily(person('c-a'), { id: 'fam-tr' });
  const sp = addChild(f, 1, { rng: familyRng(1) }).person;
  sp.kind = 'resident'; sp.parents = [];
  assert.ok(layoutTree(f).nodes.some((n) => n.id === sp.id), 'kept, at the right');
  assert.equal(isRemainsItem(mintRemainsItem({ line: 'f', of: 1, name: 'A' })), true);
});
