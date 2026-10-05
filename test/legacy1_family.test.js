// LEGACY1-LEGACY3 (2026-10-05, bible/06-Systems/Legacy-Arc.md): PROJECT LEGACY - Mac's own mod, read off its IL with
// every bug fixed. Each pin below is aimed at one of the mod's bugs (the arc's section 2 table) or one of the port's own
// laws, and is built from the producer's own output (family.js's records, legacyHost's answers) - never a hand-built
// literal the running game would not mint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  familyRng, foundFamily, addChild, rollSiblings, recordDeath, successors, newbornAllowed, readFamily, newerFamily,
  inheritCareer, inheritRace, bloodOf, hearthOf, estateOf, bornValues, heirAnswer, surnameOf, givenOf, writePlayer,
  siblingsOf, isCustomCareer, MODELS, DESCENDANTS, SIBLINGS_MAX_DEFAULT, SIBLINGS_CHANCE_DEFAULT, ESTATE_MAX,
  RACE_INHERIT_CHANCE, CAREER_INHERIT_CHANCE, BLOOD_MAX, HEARTH_MAX, personOf,
} from '../src/systems/legacy/family.js';
import { ageOf, payToll, spanOf, startAgeOf, tollYears, isElder, isSpent, YEAR_MINUTES, SPANS } from '../src/systems/legacy/age.js';
import { loadFamily, storeFamily, leaveBirth, takeBirth, listFamilies, newestSaveOf, BIRTH_MAX_AGE_MS } from '../src/systems/legacy/store.js';
import { birthSearch, loadSearch, nearestTown, townAt } from '../src/systems/legacy/places.js';
import { layoutTree } from '../src/systems/legacy/tree.js';
import { createLegacyHost } from '../src/scenes/legacyHost.js';
import { zoomAbout, centreOn, personChips } from '../src/ui/familyPages.js';
import { legacyModelOptions } from '../src/ui/legacyModelChoice.js';
import { CLASS_CAREERS } from '../src/systems/chargen.js';
import { REALM_BIRTH_WEALTH_MAX } from '../src/net/realmGoldLaw.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { DEFAULT_BINDINGS, MOD_ACTIONS } from '../src/systems/inputActions.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { _resetModSaveData, modSaveRecords, restoreModSaveRecords } from '../src/systems/modSaveData.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** A played character as the port's entity carries one (chargen.applyCharacter's fields). */
const entity = (over = {}) => ({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', raceId: 4, faceIndex: 3, careerIndex: 5,
  career: { name: 'Nightblade', primarySkills: [28, 22, 16], majorSkills: [19, 24, 13], minorSkills: [1, 2, 3, 4, 5, 6] },
  level: 7, characterId: 'c-ysolde', chargenDone: true, levelingSystem: 'virtue',
  stats: { strength: 60, intelligence: 72, willpower: 55, agility: 80, endurance: 50, personality: 40, speed: 70, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => 10 + i),
  ...over,
});
/** A [0,1) stream that answers the listed values in turn, then 0.5. */
const seq = (...v) => { let i = 0; return () => (i < v.length ? v[i++] : 0.5); };
/** An in-memory Storage. */
const memStore = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
};

test('LEGACY1 B5: the career is drawn by index over all eighteen - Mage (0) reachable, None never', () => {
  // the mod's Random.Range(1, Enum.GetValues(ClassCareers).Length) skipped index 0 (Mage - None sorts LAST by unsigned
  // value) and could land on None (-1, a null career)
  assert.deepEqual(inheritCareer(null, seq(0)), { careerIndex: 0, className: 'Mage', career: null });
  assert.deepEqual(inheritCareer(null, seq(0.9999)), { careerIndex: 17, className: 'Knight', career: null });
  const seen = new Set();
  for (let i = 0; i < 18; i++) seen.add(inheritCareer(null, seq((i + 0.5) / 18)).careerIndex);
  assert.deepEqual([...seen].sort((a, b) => a - b), CLASS_CAREERS.map((_, i) => i));
  // the parent's career at CAREER_INHERIT_CHANCE - a custom career whole, a stock one read fresh at the birth
  const parent = writePlayer(foundFamily(entity()).people[0], entity());
  assert.equal(CAREER_INHERIT_CHANCE, 0.5);
  assert.deepEqual(inheritCareer(parent, seq(0.49)), { careerIndex: 5, className: 'Nightblade', career: null });
  const custom = writePlayer(foundFamily(entity()).people[0], entity({ career: { name: 'Spellthief', primarySkills: [13], majorSkills: [], minorSkills: [] } }));
  assert.equal(isCustomCareer(custom), true);
  assert.equal(inheritCareer(custom, seq(0.1)).career.name, 'Spellthief', 'a custom career is inherited as itself (S2)');
  assert.equal(inheritCareer(parent, seq(0.5, 0)).careerIndex, 0, 'the roll past the chance draws from the eighteen');
});

test('LEGACY1 B4: the parent\'s race is the 70% roll\'s, not a certainty', () => {
  const p = { race: 'Nord' };
  assert.equal(RACE_INHERIT_CHANCE, 0.7);
  assert.equal(inheritRace(p, null, seq(0.69)), 'Nord');
  assert.equal(inheritRace(p, { race: 'Redguard' }, seq(0.7)), 'Redguard', 'past the roll: the other parent');
  assert.equal(inheritRace(p, null, seq(0.7, 0)), 'Breton', 'past the roll with no other parent: any of the eight');
  assert.equal(inheritRace(p, null, seq(0.7, 0.999)), 'Argonian');
});

test('LEGACY1 B3: the blood and the hearth - the parent hands something down, within bounds', () => {
  assert.equal(BLOOD_MAX, 3);
  assert.equal(HEARTH_MAX, 3);
  const b = bloodOf({ stats: { strength: 85, intelligence: 50, willpower: 64, agility: 100, endurance: 20, personality: 55, speed: 66, luck: 45 } });
  assert.deepEqual(b, { strength: 3, intelligence: 0, willpower: 1, agility: 3, endurance: 0, personality: 1, speed: 2, luck: 0 });
  // the better of two parents
  assert.equal(bloodOf({ stats: { strength: 50 } }, { stats: { strength: 72 } }).strength, 2);
  const parent = writePlayer(foundFamily(entity()).people[0], entity({ skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 95 : i === 19 ? 40 : 10)) }));
  const h = hearthOf(parent);
  assert.equal(h[28], 3, 'a primary at 95: floor(95/20)=4, held to 3');
  assert.equal(h[19], 2, 'a major at 40: 2');
  assert.equal(h[1], undefined, 'a minor hands down nothing');
  // and they land on DFU's own roll, never past 100
  const v = bornValues({ blood: { strength: 3, luck: 1 }, hearth: { 28: 3 } }, { stats: { strength: 99, intelligence: 40, willpower: 40, agility: 40, endurance: 40, personality: 40, speed: 40, luck: 40 }, skills: Array.from({ length: 35 }, () => 30) });
  assert.equal(v.stats.strength, 100);
  assert.equal(v.stats.luck, 41);
  assert.equal(v.skills[28], 33);
  assert.equal(v.skills[27], 30);
});

test('LEGACY1: the estate is a quarter of the purse, held to the online birth\'s liquid ceiling', () => {
  assert.equal(ESTATE_MAX, REALM_BIRTH_WEALTH_MAX, 'the restated ceiling is the realm law\'s');
  assert.equal(estateOf(1000), 250);
  assert.equal(estateOf(1003), 250);
  assert.equal(estateOf(100_000), ESTATE_MAX);
  assert.equal(estateOf(-5), 0);
  assert.equal(estateOf(undefined), 0);
});

test('LEGACY1 B12: the heir answer is rolled once at a birth, by the Descendants setting', () => {
  assert.equal(heirAnswer({ descendants: DESCENDANTS.always }, seq(0)), true);
  assert.equal(heirAnswer({ descendants: DESCENDANTS.random }, seq(0.51)), true);
  assert.equal(heirAnswer({ descendants: DESCENDANTS.random }, seq(0.5)), false, 'Random.Range(0f,1f) > 0.5f, kept');
  const f = foundFamily(entity(), { rng: seq(0.1), settings: { descendants: DESCENDANTS.random } });
  assert.equal(f.people[0].heir, false, 'kept on the person - the death reads it, never rolls it again');
  assert.equal(newbornAllowed(f, f.people[0]), false);
});

test('LEGACY1 B14: siblings appear on a fresh install - the settings ship 2 and 50, and the roll reads them', () => {
  const ms = MOD_SETTINGS['project-legacy'].keys;
  assert.equal(ms['Family.Max Siblings'].default, SIBLINGS_MAX_DEFAULT);
  assert.equal(ms['Family.Siblings Probability'].default, SIBLINGS_CHANCE_DEFAULT);
  assert.equal(SIBLINGS_MAX_DEFAULT, 2);
  assert.equal(SIBLINGS_CHANCE_DEFAULT, 50);
  const f = foundFamily(entity(), { rng: familyRng(7) });
  // the founder's siblings are parentless members of generation 0
  const sibs = rollSiblings(f, 1, { rng: seq(0.2, 0.99), settings: { maxSiblings: 2, siblingChance: 50 } });
  assert.equal(sibs.length, 2);
  for (const s of sibs) { assert.equal(s.gen, 0); assert.deepEqual(s.parents, []); assert.equal(s.surname, 'Hlaalu'); }
  assert.deepEqual(siblingsOf(f, f.people[0]).map((p) => p.id), sibs.map((p) => p.id));
  assert.deepEqual(rollSiblings(f, 1, { rng: seq(0.5), settings: { maxSiblings: 2, siblingChance: 50 } }), [], 'a roll at the probability fails');
  assert.deepEqual(rollSiblings(f, 1, { rng: seq(0), settings: { maxSiblings: 0, siblingChance: 100 } }), [], 'the mod\'s 0 is honoured as none');
});

test('LEGACY1 B6/D3/D5: a child is generation +1 in one place, born with a face of their own, linked both ways', () => {
  const f = foundFamily(entity(), { rng: familyRng(3), id: 'fam-a' });
  const { person: c } = addChild(f, 1, { rng: familyRng(11), at: 5 });
  assert.equal(c.gen, 1);
  assert.deepEqual(c.parents, [1]);
  assert.ok(f.people[0].children.includes(c.id));
  assert.ok(c.face >= 0 && c.face < 10);
  assert.equal(c.id, 2, 'ids from the record\'s own counter');
  assert.equal(f.nextId, 3);
  assert.equal(c.startAge, startAgeOf(c.race));
});

test('LEGACY1: the lore surname change - the family\'s name nine times in ten, a new one the tenth', () => {
  const f = foundFamily(entity(), { id: 'fam-s' });
  // addChild's draws: gender, race, face, career (x1 or x2), then the bank seed, then the keep roll
  let keeps = 0, changes = 0;
  for (let i = 0; i < 200; i++) {
    const { person, changed } = addChild(f, 1, { rng: familyRng(1000 + i) });
    if (changed) { changes++; assert.notEqual(person.surname, 'Hlaalu'); } else { keeps++; assert.equal(person.surname, 'Hlaalu'); }
  }
  assert.ok(keeps > 150 && changes > 5, `kept ${keeps}, changed ${changes}`);
  assert.equal(surnameOf('Ysolde Hlaalu'), 'Hlaalu');
  assert.equal(surnameOf('Cyrus'), '', 'a one-word name carries no surname (GetSurname)');
  assert.equal(givenOf('Ysolde Ana Hlaalu'), 'Ysolde Ana');
});

test('LEGACY1 D6: the record keeps the PERMANENT stats and skills, never a live bonus', () => {
  const e = entity();
  e.statMods = { strength: 40 };   // a Fortify riding beside the permanent value (systems/statMods.js)
  const p = writePlayer(foundFamily(e).people[0], e);
  assert.equal(p.stats.strength, 60);
  assert.equal(p.skills.length, 35);
});

test('LEGACY1 B13/D4: every death is written, ids never collide, a damaged copy reads as none', () => {
  const f = foundFamily(entity(), { id: 'fam-d' });
  recordDeath(f, 1, { at: 9, cause: 'fell', place: { loc: 'Gothway Garden' } });
  assert.deepEqual(f.people[0].died, { at: 9, cause: 'fell', place: { loc: 'Gothway Garden' }, by: null });
  const back = readFamily(JSON.parse(JSON.stringify({ ...f, nextId: 1 })));
  assert.equal(back.nextId, 2, 'the counter is never behind the largest id');
  assert.equal(readFamily({ v: 1, id: 'x', people: [] }), null);
  assert.equal(readFamily(null), null);
  assert.equal(readFamily({ v: 2, id: 'x', people: [{ id: 1 }] }), null);
  // the newer of two copies of ONE family; two families are never merged
  const a = readFamily(f), b = readFamily({ ...f, rev: f.rev + 3 });
  assert.equal(newerFamily(a, b).rev, f.rev + 3);
  assert.equal(newerFamily(a, { ...b, id: 'other' }), null);
});

test('LEGACY1: who may carry the line - the living of the blood, not the one played, not a spouse who married in', () => {
  const f = foundFamily(entity(), { id: 'fam-x' });
  const { person: kid } = addChild(f, 1, { rng: familyRng(1) });
  f.people.push({ ...personOf(f, 2), id: 9, kind: 'resident', parents: [], children: [] });
  f.nextId = 10;
  assert.deepEqual(successors(f).map((p) => p.id), [kid.id], 'the one played, alive, never succeeds themself');
  recordDeath(f, 1, { at: 1 });
  assert.deepEqual(successors(f).map((p) => p.id), [kid.id]);
  recordDeath(f, kid.id, { at: 2 });
  assert.deepEqual(successors(f), []);
});

test('LEGACY2: the span and Arkay\'s toll - an Enduring death costs years, and the span spent makes the next the last', () => {
  assert.deepEqual(SPANS, { Breton: 90, Nord: 90, Redguard: 80, Khajiit: 85, Argonian: 85, WoodElf: 150, DarkElf: 180, HighElf: 200 });
  assert.equal(YEAR_MINUTES, 360 * 1440);
  const p = { race: 'Breton', startAge: startAgeOf('Breton'), toll: 0 };
  assert.equal(p.startAge, 23);
  assert.equal(ageOf(p, 2 * YEAR_MINUTES + 5), 25);
  assert.equal(tollYears('Breton', 0.06), 5);
  assert.equal(tollYears('HighElf', 0.06), 12);
  assert.equal(tollYears('Breton', 0.001), 1, 'never less than a year');
  const first = payToll(p, 0.06, 0);
  assert.deepEqual(first, { final: false, years: 5, age: 28, spent: false });
  assert.equal(p.toll, 5);
  assert.equal(isElder(p, 0), false);
  p.toll = 45;   // 68 = the elder's three quarters of 90 (67.5 -> 68)
  assert.equal(isElder(p, 0), true);
  p.toll = 63;   // 86: one more toll spends it
  const last = payToll(p, 0.06, 0);
  assert.equal(last.final, false, 'the death that spends the span still rises');
  assert.equal(last.spent, true);
  assert.equal(isSpent(p, 0), true);
  assert.deepEqual(payToll(p, 0.06, 0), { final: true, years: 0, age: 91, spent: true }, 'and the next is final');
  assert.equal(spanOf('Imperial'), 90, 'an unknown race reads as a Breton\'s span');
});

test('LEGACY1: the store keeps the newer copy, and a birth crosses the reload once, for its own person', () => {
  const s = memStore(), tab = memStore();
  const f = foundFamily(entity(), { id: 'fam-st' });
  assert.equal(storeFamily(s, f), true);
  assert.equal(storeFamily(s, { ...f, rev: 0 }), false, 'an older copy never writes over the store\'s');
  assert.equal(loadFamily(s, 'fam-st').rev, f.rev);
  assert.deepEqual(listFamilies(s).map((x) => x.id), ['fam-st']);
  leaveBirth(tab, { familyId: 'fam-st', personId: 4, region: 'Daggerfall', loc: 'Gothway Garden', estate: 0 }, 1000);
  assert.equal(takeBirth(tab, 5, 1001), null, 'another person\'s address births nobody - and spends the handoff');
  leaveBirth(tab, { familyId: 'fam-st', personId: 4, region: 'Daggerfall', loc: 'Gothway Garden', estate: 0 }, 1000);
  assert.equal(takeBirth(tab, 4, 1000 + BIRTH_MAX_AGE_MS + 1), null, 'a stale handoff is never taken');
  leaveBirth(tab, { familyId: 'fam-st', personId: 4, region: 'Daggerfall', loc: 'Gothway Garden', estate: 0 }, 1000);
  assert.deepEqual(takeBirth(tab, 4, 2000), { familyId: 'fam-st', personId: 4, region: 'Daggerfall', loc: 'Gothway Garden', estate: 0 });
  assert.equal(takeBirth(tab, 4, 2000), null, 'taken once - a reload of the born world births nobody twice');
  const info = new Map([[3, { characterId: 'a', dateAndTime: { realTime: 5 } }], [7, { characterId: 'a', dateAndTime: { realTime: 9 } }], [8, { characterId: 'b', dateAndTime: { realTime: 99 } }]]);
  assert.equal(newestSaveOf(info, 'a'), 7);
  assert.equal(newestSaveOf(info, 'z'), -1);
});

test('LEGACY1 B11: the heir is born in a TOWN by name, never a coordinate pair', () => {
  const region = {
    mapTable: [
      { locationType: LOCATION_TYPES.DungeonLabyrinth, longitude: 100 << 7, latitude: (499 - 10) << 7 },
      { locationType: LOCATION_TYPES.TownVillage, longitude: 30 * 128, latitude: (499 - 40) * 128 },
      { locationType: LOCATION_TYPES.TownCity, longitude: 300 * 128, latitude: (499 - 300) * 128 },
    ],
    mapNames: ['Old Crypt', 'Ashbury', 'Daggerfall'],
  };
  const near = nearestTown(region, 'Daggerfall', { x: 31, y: 41 });
  assert.equal(near.loc, 'Ashbury');
  assert.equal(townAt(region, 'Daggerfall', near.pixel)?.loc, 'Ashbury');
  assert.equal(townAt(region, 'Daggerfall', { x: 1, y: 1 }), null);
  const q = new URLSearchParams(birthSearch('?world&load&loadkey=3&classic', 4, { region: 'Daggerfall', loc: 'Ashbury' }));
  assert.equal(q.get('legacyborn'), '4');
  assert.equal(q.get('loc'), 'Ashbury');
  for (const k of ['load', 'loadkey', 'classic']) assert.equal(q.has(k), false, `${k} never rides into a birth`);
  // both reloads take the world host's scene door themselves - a page in play carries no `?world` (the menu's doors
  // set none), and the front door would clear the menu's keys and ask again, the birth or the load lost behind it
  assert.equal(new URLSearchParams(birthSearch('?online=1', 4, null)).get('world'), '1');
  const l = new URLSearchParams(loadSearch('?legacyborn=4&region=X&loc=Y', 12));
  assert.equal(l.get('world'), '1');
  assert.equal(l.get('load'), '1', 'the menu\'s Load door, as main.js sets it');
  assert.equal(l.get('classic'), '1', 'over the classic start, as the menu\'s Load');
  assert.equal(l.get('loadkey'), '12');
  for (const k of ['legacyborn', 'region', 'loc']) assert.equal(l.has(k), false, `${k} never rides into a load`);
});

test('LEGACY3 U5: the tree is a pure layout of the record - generations as rows, children under their parent', () => {
  const f = foundFamily(entity(), { id: 'fam-t' });
  rollSiblings(f, 1, { rng: seq(0, 0.99), settings: { maxSiblings: 1, siblingChance: 100 } });   // one founder-sibling
  const a = addChild(f, 1, { rng: familyRng(2) }).person;
  const b = addChild(f, 1, { rng: familyRng(3) }).person;
  const g = addChild(f, a.id, { rng: familyRng(4) }).person;
  const t = layoutTree(f);
  const at = new Map(t.nodes.map((n) => [n.id, n]));
  assert.equal(t.nodes.length, f.people.length, 'everyone drawn once');
  assert.equal(at.get(1).y, 0);
  assert.equal(at.get(a.id).y, 1);
  assert.equal(at.get(g.id).y, 2);
  assert.ok(at.get(1).x >= at.get(a.id).x && at.get(1).x <= at.get(b.id).x, 'the parent sits over the span of their children');
  assert.deepEqual(t.families.find((x) => x.parents[0] === 1).children, [a.id, b.id]);
  assert.equal(t.depth, 3);
  assert.deepEqual(layoutTree(f), t, 'the same record lays out the same tree (no static root)');
});

test('LEGACY3 U1: the wheel zooms about the pointer - the point under it stays under it', () => {
  const v = { zoom: 1, x: 40, y: 20 };
  const z = zoomAbout(v, 1.5, 200, 100);
  const worldX = (200 - v.x) / v.zoom, worldY = (100 - v.y) / v.zoom;
  assert.ok(Math.abs((z.x + worldX * z.zoom) - 200) < 1e-9);
  assert.ok(Math.abs((z.y + worldY * z.zoom) - 100) < 1e-9);
  assert.equal(zoomAbout({ zoom: 1.6, x: 0, y: 0 }, 2, 0, 0).zoom, 1.6, 'held to the range');
  const c = centreOn({ x: 2, y: 1 }, 500, 300, 1);
  assert.deepEqual(c, { x: 250 - (200 + 39), y: 150 - (136 + 48) });
});

test('LEGACY3 U2: the dead, the played and the not-yet-played each wear their own word', () => {
  const f = foundFamily(entity(), { id: 'fam-c' });
  const k = addChild(f, 1, { rng: familyRng(5) }).person;
  assert.deepEqual(personChips(f, f.people[0], 0).map((c) => c.text), ['Played']);
  assert.deepEqual(personChips(f, k, 0).map((c) => c.text), ['Not yet played']);
  recordDeath(f, k.id, { at: 1, cause: 'years' });
  assert.deepEqual(personChips(f, k, 0).map((c) => c.text), ['Died of years']);
});

test('LEGACY2: the model question offers Enduring first - Enter without reading never costs a character', () => {
  const o = legacyModelOptions();
  assert.deepEqual(o.map((x) => x.id), [MODELS.enduring, MODELS.bloodline]);
  assert.ok(o.every((x) => !x.locked));
});

test('LEGACY-KEY: the family tree is its own action with a free default, and the mod\'s keys are the registry\'s', () => {
  const owner = new Map(DEFAULT_BINDINGS.map(([c, a]) => [a, c]));
  assert.equal(owner.get('LegacyFamily'), 'NumpadDivide');
  assert.deepEqual(MOD_ACTIONS['project-legacy'].map((r) => r.action), ['LegacyFamily']);
  assert.match(rd('src/ui/input.js'), /case 'LegacyFamily': return ctx\.togglePause \? \(ctx\.togglePause\(\{ at: 'family', setPlayerPos \}\), true\) : false;/);
});

// ---- the host, headless ------------------------------------------------------------------------------------------

function hostWorld({ model = MODELS.bloodline, gold = 1000, online = false } = {}) {
  _resetModSaveData();
  const storage = memStore(), tab = memStore();
  const said = [];
  const booted = [];
  const loads = [];
  const world = { own: 0, now: 100, fight: false };
  const e = entity();
  const host = createLegacyHost({
    entity: e, storage: () => storage, tab: () => tab, on: () => true, online: () => online,
    now: () => world.now, own: () => world.own,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity }),
    town: (h) => ({ region: h.region, loc: h.loc }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => gold, say: (l) => said.push(l), boot: (s) => booted.push(s), search: () => '?world',
    loadCharacter: (cid) => { loads.push(cid); return true; }, saveNow: () => said.push('saved'),
    inFight: () => world.fight, payEstate: (n) => said.push(`estate ${n}`), rng: familyRng(99),
  });
  host.found(model);
  return { host, storage, tab, said, booted, loads, world, e };
}

test('LEGACY1: a Bloodline death falls - written dead, the estate set aside, the Succession\'s choices answered', () => {
  const w = hostWorld();
  const fam = w.host.family;
  assert.equal(fam.model, MODELS.bloodline);
  assert.equal(fam.seat.loc, 'Gothway Garden');
  const out = w.host.deathOutcome();
  assert.equal(out.kind, 'fall');
  assert.equal(out.estate, 250);
  assert.ok(fam.people[0].died, 'B13: the fallen is written dead');
  assert.equal(loadFamily(w.storage, fam.id).people[0].died.cause, 'fell', 'and the store knows it');
  assert.equal(w.host.deathOutcome().kind, 'none', 'a second reset asks nothing of a dead member');
  // a newborn heir of the fallen: a child, the estate on them, the boot asked with their birth
  assert.equal(w.host.succeed({ newborn: true }, { estate: out.estate, fallenId: 1 }), true);
  const heir = w.host.current();
  assert.deepEqual(heir.parents, [1]);
  assert.equal(heir.estate, 250);
  const q = new URLSearchParams(w.booted.at(-1));
  assert.equal(q.get('legacyborn'), String(heir.id));
  assert.equal(q.get('loc'), 'Gothway Garden', 'born at the family seat');
  assert.equal(takeBirth(w.tab, heir.id).familyId, fam.id);
});

test('LEGACY1: a member already played is LOADED, one never played is BORN - the switch is a save first, never mid-fight', () => {
  const w = hostWorld({ model: MODELS.enduring });
  const fam = w.host.family;
  const sib = addChild(fam, 1, { rng: familyRng(2) }).person;
  w.world.fight = true;
  assert.deepEqual(w.host.switchTo(sib.id), { ok: false, why: 'Not while you are in a fight.' }, 'S3');
  w.world.fight = false;
  assert.equal(w.host.switchRefusal(1), 'none', 'not the one played');
  assert.deepEqual(w.host.switchTo(sib.id), { ok: true });
  assert.ok(w.said.includes('saved'), 'the one left is saved where they stand (D7)');
  assert.equal(fam.currentId, sib.id);
  assert.match(w.booted.at(-1), /legacyborn=/);
  // and back to the first, who has a character: their save is loaded
  assert.deepEqual(w.host.switchTo(1), { ok: true });
  assert.deepEqual(w.loads, ['c-ysolde']);
});

test('LEGACY2: an Enduring death rises with the toll, until the span is spent', () => {
  const w = hostWorld({ model: MODELS.enduring });
  const p = w.host.current();
  const out = w.host.deathOutcome();
  assert.equal(out.kind, 'rise');
  assert.match(out.line, /^Arkay takes 11 years for the road back\. Ysolde is \d+\.$/);
  assert.equal(p.toll, 11);
  assert.equal(p.died, null);
  p.toll = 500;
  const last = w.host.deathOutcome();
  assert.equal(last.kind, 'fall');
  assert.equal(p.died.cause, 'years');
  assert.equal(last.newborn, p.heir === true);
});

test('LEGACY2: an elder passes the mantle - retired, saved, and the Succession asked; a young member cannot', () => {
  const w = hostWorld({ model: MODELS.enduring });
  const p = w.host.current();
  assert.equal(w.host.passMantle().ok, false);
  p.toll = 100;
  const r = w.host.passMantle();
  assert.equal(r.ok, true);
  assert.ok(p.retired != null && !p.died);
  assert.equal(r.outcome.newborn, true);
  assert.ok(w.said.includes('saved'));
});

test('LEGACY1: the save carries the family and a newer store copy wins at the load; a dead Bloodline save is the past', () => {
  const w = hostWorld();
  const rec = modSaveRecords().ProjectLegacy;
  assert.equal(rec.id, w.host.family.id);
  assert.equal(rec.people[0].stats.strength, 60, 'the played character written in at the save');
  // the store moves on (the member dies), then the older save is loaded
  w.host.deathOutcome();
  restoreModSaveRecords({ ProjectLegacy: rec });
  assert.ok(w.host.family.people[0].died, 'the store\'s newer copy stands over the save\'s');
  assert.ok(w.host.tick()?.deadLoad, 'and the dead member\'s save is answered as the past');
});

test('LEGACY1: THE FOUR HOSTS - the street and the modal hosts all reset a death through Project Legacy first', () => {
  const src = rd('src/scenes/world.js');
  assert.match(src, /onReset: \(\) => \(legacyDeathReset\(\) \|\| \(_deathWasOnline \? respawnOnlinePlayer\(\) : endRunToTitleMenu\(renderer\)\)\)/);
  assert.match(src, /onlineRespawn: \(\) => \{ if \(legacyDeathReset\(\)\) return true;/);
  // the interior and the dungeon hosts reset through that one door
  assert.match(rd('src/scenes/worldModes.js'), /onReset: \(\) => \{ if \(!host\.onlineRespawn\?\.\(\)\) endRunToTitleMenu\(renderer\); \}/);
  assert.match(rd('src/scenes/dungeonContext.js'), /onReset: \(\) => \{ if \(!opts\.onlineRespawn\?\.\(\)\) endRunToTitleMenu\(renderer\); \}/);
  // the born member through THE ONE CONSTRUCTION SEAM, never a hand-rolled character
  assert.match(src, /const r = host\?\.bornResult\(\{ careers, factionDict \}\);[\s\S]{0,400}finishChargen\(playerEntity, r, sbi\);/);
});
