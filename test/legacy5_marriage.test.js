// LEGACY5 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 8; Mac: "Surnames, Marriage, Children. Live through the
// world of Daggerfall, passing down your legacy, and continuing your adventures through your bloodline."): COURTING, THE
// WEDDING AND CHILDREN - the law (systems/legacy/marriage.js), the host's doors (scenes/legacyHost.js) and the talk's
// own rows (scenes/townTalk.js's livingTalk.topics door).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  topicsFor, topicLabel, topicQuestion, courtGain, court, propose, betrothalOf, wed, childStep, spouseOf, childrenTogether,
  splitName, residentInHouse, forgetCourtship, TOPIC, AFFECTION_MAX, CHILD_DAYS, CHILDREN_MAX, COURT_BASE, MARRIAGE_TEXT,
} from '../src/systems/legacy/marriage.js';
import { FRIEND_AT } from '../src/systems/livingWorld/relations.js';
import { foundFamily, familyRng, personOf, successors, MODELS } from '../src/systems/legacy/family.js';
import { createLegacyHost, LEGACY_TEXT } from '../src/scenes/legacyHost.js';
import { layoutTree } from '../src/systems/legacy/tree.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

function entity() {
  return {
    name: 'Ysolde Hlaalu', race: 'DarkElf', gender: 'female', faceIndex: 2, level: 4, chargenDone: true, characterId: 'c1',
    stats: { Strength: 50, Intelligence: 60, Willpower: 50, Agility: 55, Endurance: 50, Personality: 70, Speed: 50, Luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 1 ? 40 : 20)),
    career: { name: 'Bard', primarySkills: [1], majorSkills: [2], minorSkills: [3] }, careerIndex: 1,
  };
}
const RES = Object.freeze({ id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, town: 120, roll: 'h' });
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('LEGACY5 the topics: a friend is courted, a full heart hears a proposal, a betrothed waits on the wedding, a spouse asks after the family - and nobody else is offered a thing', () => {
  const f = foundFamily(entity(), { id: 'fam-m' });
  const me = personOf(f, f.currentId);
  assert.deepEqual(topicsFor(f, me, RES, FRIEND_AT - 1), [], 'not yet a friend');
  assert.deepEqual(topicsFor(f, me, RES, FRIEND_AT), [TOPIC.court]);
  court(me, RES, { day: 1, personality: 0, etiquette: 0, tone: 1, roll: 0.5 });
  assert.deepEqual(topicsFor(f, me, RES, 0), [TOPIC.court], 'a courtship begun goes on whatever the day\'s regard');
  assert.equal(propose(me, RES.id), false, 'a heart not yet full hears no proposal');
  me.courting[RES.id].affection = AFFECTION_MAX;
  assert.deepEqual(topicsFor(f, me, RES, 0), [TOPIC.propose]);
  assert.equal(propose(me, RES.id), true);
  assert.equal(propose(me, RES.id), false, 'once');
  assert.deepEqual(topicsFor(f, me, RES, 0), [TOPIC.wedding]);
  assert.deepEqual(betrothalOf(me)?.[0], RES.id);
  const s = wed(f, me, RES, 5000);
  assert.deepEqual(topicsFor(f, me, RES, 0), [TOPIC.family]);
  assert.deepEqual(topicsFor(f, me, { ...RES, id: 'L120.5' }, 100), [], 'the wed court no one else');
  assert.equal(residentInHouse(f, RES.id), true);
  assert.deepEqual(topicLabel(TOPIC.court), 'Courtship');
  assert.equal(topicQuestion(TOPIC.propose, 0), 'Will you do me the honour of marrying me?');
  assert.equal(spouseOf(f, me), s);
});

test('LEGACY5 a day\'s courtship: Personality, Etiquette and the tone on a roll, once a day, never past the full heart', () => {
  assert.equal(courtGain({ personality: 0, etiquette: 0, tone: 1, roll: 0.5 }), COURT_BASE);
  assert.equal(courtGain({ personality: 100, etiquette: 100, tone: 0, roll: 0.5 }), COURT_BASE + 5 + 5 + 3);
  assert.equal(courtGain({ personality: 0, etiquette: 0, tone: 2, roll: 0 }), Math.round((COURT_BASE - 3) * 0.75));
  assert.ok(courtGain({ personality: 0, etiquette: 0, tone: 2, roll: 0 }) >= 1);
  const me = { courting: {} };
  const a = court(me, RES, { day: 3, townName: 'Ashbury', personality: 50, etiquette: 40, tone: 0, roll: 1 });
  assert.equal(a.again, false);
  assert.ok(a.gained > 0);
  const b = court(me, RES, { day: 3, personality: 50, etiquette: 40, tone: 0, roll: 1 });
  assert.deepEqual(b, { gained: 0, affection: a.affection, again: true }, 'the day\'s was given');
  me.courting[RES.id].affection = AFFECTION_MAX - 1;
  assert.equal(court(me, RES, { day: 4, personality: 100, etiquette: 100, tone: 0, roll: 1 }).affection, AFFECTION_MAX);
  assert.equal(me.courting[RES.id].town, 'Ashbury', 'the town the courtship is in - where the wedding will be');
  forgetCourtship(me, RES.id);
  assert.equal(me.courting[RES.id], undefined);
});

test('LEGACY5 the wedding: the resident is the house\'s, keeping their own name and face for life; the other courtships end', () => {
  const f = foundFamily(entity(), { id: 'fam-w' });
  const me = personOf(f, f.currentId);
  court(me, { ...RES, id: 'L120.9', name: 'Other One' }, { day: 1 });
  const s = wed(f, me, RES, 7200);
  assert.equal(s.kind, 'resident');
  assert.equal(s.residentId, RES.id);
  assert.deepEqual([s.given, s.surname], splitName(RES.name));
  assert.equal(s.gender, 'male');
  assert.equal(s.race, 'Breton');
  assert.equal(s.residentFace, 312, 'the portrait the town knows them by');
  assert.equal(me.spouse, s.id);
  assert.equal(s.spouse, me.id);
  assert.deepEqual(me.courting, {}, 'every other courtship ends');
  assert.ok(!successors(f).includes(s), 'a spouse who married in never takes the mantle');
  const t = layoutTree(f);
  assert.ok(t.couples.some((c) => [c.a, c.b].includes(s.id) || JSON.stringify(c).includes(String(s.id))), 'the tree draws the two together');
});

test('LEGACY5 children: every thirty days a chance while both live, at most six, each a minor of both parents who never plays until the mantle', () => {
  const f = foundFamily(entity(), { id: 'fam-c' });
  const me = personOf(f, f.currentId);
  const s = wed(f, me, RES, 0);
  assert.equal(childStep(f, me, { day: CHILD_DAYS - 1, rng: () => 0, at: 1 }), null, 'not yet a month');
  const c = childStep(f, me, { day: CHILD_DAYS, rng: familyRng(3), at: CHILD_DAYS * 1440 });
  // the roll may miss; drive it until one comes, on the month boundaries only
  let child = c;
  for (let d = 2; !child && d < 40; d++) child = childStep(f, me, { day: CHILD_DAYS * d, rng: seq(0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5), at: d });
  assert.ok(child, 'a child comes');
  assert.equal(child.minor, true);
  assert.deepEqual(child.parents.sort(), [me.id, s.id].sort());
  assert.equal(child.surname, f.surname, 'the house\'s name');
  assert.ok(['DarkElf', 'Breton'].includes(child.race), 'either parent\'s race');
  assert.equal(childStep(f, me, { day: CHILD_DAYS * 40, rng: () => 0.99, at: 2 }), null, 'a miss');
  for (let d = 41; childrenTogether(f, me, s) < CHILDREN_MAX; d++) childStep(f, me, { day: CHILD_DAYS * d, rng: seq(0, 0.5), at: d });
  assert.equal(childStep(f, me, { day: CHILD_DAYS * 200, rng: () => 0, at: 3 }), null, 'six is the most');
  s.died = { at: 1, cause: 'fell' };
  assert.equal(spouseOf(f, me), null);
  assert.equal(childStep(f, me, { day: CHILD_DAYS * 300, rng: () => 0, at: 4 }), null, 'never once the spouse is gone');
});

// ---- the host ---------------------------------------------------------------------------------------------------------

function world(over = {}) {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  const said = [];
  const w = {
    said, clock: 1440 * 10, regard: FRIEND_AT, temple: false, loc: 'Ashbury', lives: true, asked: [],
    deps: null,
  };
  const ent = entity();
  w.entity = ent;
  w.deps = {
    entity: ent, storage: () => storage, tab: () => storage, on: () => true, online: () => false,
    now: () => w.clock, own: () => w.clock, here: () => ({ mode: w.temple ? 'interior' : 'exterior', loc: w.loc, region: 'Daggerfall', pixel: { x: 1, y: 1 } }),
    town: (h) => (h?.loc ? { region: h.region, loc: h.loc } : null), nearestTown: () => ({ region: 'Daggerfall', loc: 'Ashbury' }),
    gold: () => 0, say: (l) => said.push(l), boot: () => {}, search: () => '', loadCharacter: () => false, saveNow: () => {},
    inFight: () => false, payEstate: () => {}, rng: familyRng(9),
    regard: () => w.regard, regardNote: (id, kind) => w.asked.push(['note', id, kind]),
    residentOf: (id) => (id === RES.id ? { ...RES } : null), residentLives: () => w.lives,
    atTemple: () => w.temple, askWed: (row, yes) => { w.asked.push(['wed', row]); w.yes = yes; },
    ...over,
  };
  w.host = createLegacyHost(w.deps);
  w.host.found(MODELS.bloodline);
  return w;
}
const person = (res = RES) => ({ living: { id: res.id, res } });

function hostWorld({ online = false } = {}) {
  const store = new Map();
  const storage = { get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null, getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const w = { said: [], temple: null, asked: [], own: 0, online };
  w.e = entity();
  w.host = createLegacyHost({
    entity: w.e, storage: () => storage, tab: () => storage, on: () => true, online: () => w.online, now: () => w.own, own: () => w.own,
    here: () => ({ pixel: { x: 1, y: 1 }, region: 'Daggerfall', mode: 'exterior', loc: 'Ashbury', locationType: 0 }), town: () => null,
    nearestTown: () => ({ region: 'Daggerfall', loc: 'Ashbury' }), gold: () => 100, say: (l) => w.said.push(l), boot: () => {}, search: () => '?world',
    loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: () => 0,
    templeOf: () => w.temple, askWed: (name, house, done) => { w.asked.push([name, house]); w.done = done; return true; }, livingWorld: () => true,
  });
  w.host.found(MODELS.enduring);
  w.host.family.people = w.host.family.people.slice(0, 1);
  return w;
}

test('LEGACY5 the host: the Tell me about rows, the courtship answered and remembered, the proposal, the wedding asked at the temple of the town (the name asked with it), a child said', () => {
  const w = hostWorld();
  const f = w.host.family;
  const me = personOf(f, f.currentId);
  const ctx = { regard: FRIEND_AT, personality: 50, etiquette: 40, townName: 'Ashbury' };
  assert.deepEqual(w.host.topicRows({ ...RES, roll: 'w', guard: true }, ctx), [], 'never one of the watch');
  assert.deepEqual(w.host.topicRows({ ...RES, roll: 't' }, ctx), [], 'never a traveller on the roads');
  const rows = w.host.topicRows(RES, ctx);
  assert.deepEqual(rows.map((r) => r.label), ['Courtship']);
  assert.equal(rows[0].legacy.question(0), topicQuestion(TOPIC.court, 0));
  assert.match(rows[0].legacy.answer(0), /Aldo/);
  assert.ok(me.courting[RES.id].affection > 0, 'remembered');
  assert.match(rows[0].legacy.answer(0), /Tomorrow/, 'once a day');
  me.courting[RES.id].affection = AFFECTION_MAX;
  const ask = w.host.topicRows(RES, ctx);
  assert.deepEqual(ask.map((r) => r.label), ['Marriage']);
  assert.match(ask[0].legacy.answer(1), /says yes/);
  assert.equal(me.courting[RES.id].betrothed, true);
  // the wedding: asked at the temple of THEIR town, once a visit
  w.temple = 999; w.host.tick();
  assert.deepEqual(w.asked, [], 'another town\'s temple');
  w.temple = RES.town; w.host.tick(); w.host.tick();
  assert.deepEqual(w.asked, [['Aldo Marane', f.surname]], 'asked once a visit');
  w.done(true);
  const s = spouseOf(f, me);
  assert.ok(s, 'wed');
  assert.equal(s.surname, f.surname, 'the house\'s name taken');
  assert.equal(s.mapId, RES.town);
  assert.ok(w.said.some((l) => /are wed/.test(l)));
  assert.ok(w.host.holdsResident(RES.id), 'their census place is the line\'s now');
  assert.deepEqual(w.host.topicRows({ ...RES, name: s.given }, ctx).map((r) => r.label), ['Our family']);
  // the spouse stands in their town as the census's own, the line's household
  const census = { ...RES, roll: 'h', home: 77, archive: 385, variant: 0, job: 'crafter' };
  const res = w.host.residentsOf(RES.town, () => 0, (id) => (id === RES.id ? census : null));
  assert.equal(res.length, 1);
  assert.equal(res[0].id, RES.id, 'their own id - their regard and their day go on');
  assert.equal(res[0].household, `F${f.id}`);
  assert.equal(res[0].home, 77, 'their own house - the line holds none in their town');
  assert.equal(res[0].name, `${s.given} ${f.surname}`);
  assert.equal(w.host.kinOfResident(res[0]).refusal, LEGACY_TEXT.spouseKin(s.given), 'met: never played');
  // a child, on the played one's own clock
  w.said.length = 0;
  for (let d = 1; d <= 6 && !personOf(f, f.nextId - 1)?.minor; d++) { w.own = d * CHILD_DAYS * 1440; w.host.tick(); }
  const kid = f.people.find((p) => p.minor);
  assert.ok(kid, 'a child is born');
  assert.ok(w.said.some((l) => /A child is born/.test(l)));
  assert.equal(w.host.switchRefusal(kid.id), LEGACY_TEXT.minor(kid.given), 'a child is not played');
  assert.ok(successors(f).includes(kid), 'but may take the mantle');
});

test('LEGACY5 the host: a courted resident dead ends the courtship with word; a spouse struck down dies in the record', () => {
  const w = hostWorld();
  const f = w.host.family;
  const me = personOf(f, f.currentId);
  w.host.topicRows(RES, { regard: FRIEND_AT })[0].legacy.answer(1);
  assert.equal(w.host.residentDied(RES.id), true);
  assert.equal(me.courting[RES.id], undefined);
  assert.ok(w.said.includes(MARRIAGE_TEXT.lost('Aldo Marane')));
  const s = wed(f, me, RES, 0);
  const res = { ...RES, legacy: { familyId: f.id, personId: s.id } };
  assert.equal(w.host.kinSlain(res), true);
  assert.ok(s.died);
  assert.ok(w.host.holdsResident(RES.id), 'their place stays the line\'s - the dead do not come back as the census\'s');
});

test('LEGACY5 the wiring: the talk puts the host\'s rows first on Tell me about and answers them itself, both skins through the one hooks object; the world hands the doors over', () => {
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /const own = _toneTarget \? \(legacyTopics\?\.\(_toneTarget\) \?\? \[\]\) : \[\];/);
  assert.match(tt, /if \(row\.legacy\) return row\.legacy\.answer\(tone\);   \/\/ LEGACY5/);
  assert.match(tt, /question: \(row\) => \(row\.legacy \? row\.legacy\.question\(tone\) :/);
  const w = read('src/scenes/world.js');
  assert.match(w, /legacyTopics: \(person\) => legacyTopicRows\(person\),/);
  assert.match(w, /holderOf: \(res, day\) => \(legacyHost\?\.holdsResident\(res\.id\) \? null :/);
  assert.match(w, /\(id\) => town\.residents\.find\(\(r\) => r\.id === id\) \?\? null\) \?\? null,/);
  assert.match(w, /templeOf: \(\) => \{ const b = [^\n]*TALK_BUILDING_TYPES\.Temple/);
  assert.match(w, /legacyHost\?\.residentDied\(res\.id\);   \/\/ LEGACY5/);
  assert.match(w, /const livingDied = \(res, t\) => \{ legacyHost\?\.residentDied\(res\.id\);/);
});
