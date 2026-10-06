// LEGACY6 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 10; Mac: "World Influence"): WHAT THE WORLD REMEMBERS OF
// THE HOUSE - the law (systems/legacy/influence.js), the regard handed down (livingWorld/relations.js inherit), the
// killer remembered (revenant.js killerOf / inheritRevenant), the towns' talk (lines.js KIN_NEWS, livingTown.js
// familyNews) and the host's doors (scenes/legacyHost.js) through the real save records and store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  memberStanding, readStanding, inheritStanding, inheritRegards, noteNews, newsFor, mergeNews, readNews,
  STANDING_SHARE, REGARD_SHARE, FACTIONS_KEPT, REGARDS_KEPT, REGARD_FLOOR, HOUSE_NEWS_DAYS, NEWS_MAX,
} from '../src/systems/legacy/influence.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { createFactionRep, getReputation } from '../src/systems/factionRep.js';
import { foundFamily, readFamily, personOf, familyRng, MODELS, LEGACY_MOD } from '../src/systems/legacy/family.js';
import { mergeFacts, loadFamily } from '../src/systems/legacy/store.js';
import { createLegacyHost, LEGACY_TEXT } from '../src/scenes/legacyHost.js';
import { modSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { KIN_NEWS, newsScript, fillLine, TOKEN_FALLBACK } from '../src/systems/livingWorld/lines.js';
import { circleLine, circleSlots, slotSpoken, exchangeScript } from '../src/systems/livingWorld/meetups.js';
import { killerOf, inheritRevenant, revenantsFor, REVENANT_STORE_PREFIX, REVENANT_RETURN_MIN_MINUTES, _resetRevenantForTests } from '../src/systems/revenant.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { synthTown } from './lwTown.mjs';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const factions = (reps) => createFactionRep(new Map(Object.entries(reps).map(([id, rep]) => [Number(id), { id: Number(id), rep, parent: 0, children: [] }])));

test('LEGACY6 the standing a member leaves: the law in every region, the furthest faction standings, the strongest regards - read back held to its shape', () => {
  const rel = createRelations();
  rel.note('L5001.3', 'saved', 0);   // 35
  rel.note('L5001.4', 'polite', 0);  // 1 - under the floor
  rel.note('L5001.5', 'struck', 0);  // -45
  const reps = Object.fromEntries(Array.from({ length: FACTIONS_KEPT + 5 }, (_, i) => [100 + i, i + 1]));
  const e = { legalRep: { 17: 40, 20: 0, 3: -250, x: 9 }, factionRep: factions({ ...reps, 99: 0 }) };
  const st = memberStanding(e, rel, 0);
  assert.deepEqual(st.legal, { 17: 40, 3: -100 }, 'every region, none at nothing, held to DFU\'s bounds');
  assert.equal(Object.keys(st.factions).length, FACTIONS_KEPT, 'the furthest from nothing');
  assert.equal(st.factions['99'], undefined);
  assert.equal(st.factions['100'], undefined, 'the nearest to nothing let go first');
  assert.equal(st.factions[String(100 + FACTIONS_KEPT + 4)], FACTIONS_KEPT + 5);
  assert.deepEqual(st.regard, { 'L5001.3': 35, 'L5001.5': -45 }, `a regard of REGARD_FLOOR (${REGARD_FLOOR}) or more, either way`);
  assert.deepEqual(memberStanding(e, null, 0).regard, {}, 'no Living World, no regard');
  // read back: the shape held, junk dropped
  const back = readStanding({ legal: { 17: 400, bad: 3 }, factions: { 40: 7, x: 2 }, regard: { [''.padEnd(41, 'z')]: 50, ok: -500 } });
  assert.deepEqual(back, { legal: { 17: 100 }, factions: { 40: 7 }, regard: { ok: -100 } });
  assert.equal(readStanding(null), null);
  const many = Object.fromEntries(Array.from({ length: REGARDS_KEPT + 10 }, (_, i) => [`L1.${i}`, 20 + i]));
  assert.equal(Object.keys(readStanding({ regard: many }).regard).length, REGARDS_KEPT);
});

test('LEGACY6 the birth\'s share: a quarter of the law and the guilds over the child\'s own start, half of every regard - no word counted, no crime said', () => {
  const child = { legalRep: { 17: 4 }, factionRep: factions({ 40: 10, 41: 0 }) };
  const parent = { legal: { 17: 44, 20: -40, 21: 2 }, factions: { 40: 50, 41: -20, 77: 30 }, regard: { 'L5001.3': 35, 'L5001.5': -45, 'L5001.6': 1 } };
  const moved = inheritStanding(child, parent);
  assert.equal(STANDING_SHARE, 0.25);
  assert.equal(child.legalRep[17], 4 + 10, 'a quarter of what the parent held over the child\'s start');
  assert.equal(child.legalRep[20], -10);
  assert.equal(child.legalRep[21], undefined, 'a share under a point moves nothing');
  assert.equal(getReputation(child.factionRep, 40), 20);
  assert.equal(getReputation(child.factionRep, 41), -5);
  assert.equal(moved, 4, 'a faction the child\'s dictionary lacks is not invented');
  const rel = createRelations();
  assert.equal(REGARD_SHARE, 0.5);
  assert.equal(inheritRegards(rel, parent, 3), 2);
  assert.equal(rel.regard('L5001.3', 3), 17, '"your mother saved my son"');
  assert.equal(rel.regard('L5001.5', 3), -22, 'and a grudge is half a grudge');
  assert.equal(rel.known('L5001.6'), false);
  assert.equal(rel.snapshot().people['L5001.3'].talked, -1, 'no word counted for it - the day\'s talk is still to come');
  assert.equal(inheritStanding(child, null), 0);
  assert.equal(inheritRegards(rel, null, 3), 0);
});

test('LEGACY6 the house\'s news: told in the town where it happened and in the seat, for seven days, once - merged as a fact, read back held to its shape', () => {
  const f = foundFamily({ name: 'Ysolde Hlaalu', race: 'DarkElf', gender: 'female', chargenDone: true, characterId: 'c1' }, { id: 'fam-n', seat: { region: 'Daggerfall', loc: 'Gothway Garden', mapId: 5001 } });
  assert.equal(noteNews(f, 'died', 'Ysolde Hlaalu', 1000, 7002), true);
  assert.equal(noteNews(f, 'died', 'Ysolde Hlaalu', 1000, 7002), false, 'once');
  assert.equal(noteNews(f, 'eaten', 'Ysolde Hlaalu', 1000, 7002), false, 'a kind the towns have no words for');
  noteNews(f, 'wed', 'Aldo Marane', 2000, 8003);
  const at = (mapId, t) => newsFor(f, mapId, t).map((n) => [n.kind, n.who]);
  assert.deepEqual(at(7002, 1500), [['died', 'Ysolde Hlaalu']], 'where it happened');
  assert.deepEqual(at(5001, 2500), [['wed', 'Aldo Marane'], ['died', 'Ysolde Hlaalu']], 'the seat hears all of it, newest first');
  assert.deepEqual(at(8003, 1500), [], 'not before it happened');
  assert.deepEqual(at(9999, 2500), [], 'a town it never touched');
  assert.deepEqual(at(7002, 1000 + HOUSE_NEWS_DAYS * 1440), [], 'old news after seven days');
  const n = newsFor(f, 7002, 1500)[0];
  assert.deepEqual([n.kin, n.house, n.seen], [true, 'Hlaalu', true], 'in the shape the town\'s news takes, by name and by house');
  for (let i = 0; i < NEWS_MAX + 3; i++) noteNews(f, 'born', `Kid ${i}`, 3000 + i, null);
  assert.equal(f.news.length, NEWS_MAX, 'bounded - the oldest go');
  // a fact of the store: never unheard by a write
  const other = readFamily(JSON.parse(JSON.stringify(f)));
  noteNews(other, 'rested', 'Old Bones', 9000, 5001);
  const mine = readFamily(JSON.parse(JSON.stringify(f)));
  mergeFacts(mine, other);
  assert.ok(mine.news.some((x) => x.k === 'rested'), 'the other copy\'s news merged in');
  assert.deepEqual(mergeNews(null, [{ k: 'wed', who: 'A', t: 1, m: 2 }]), [{ k: 'wed', who: 'A', t: 1, m: 2 }]);
  assert.deepEqual(readNews([{ k: 'died', who: '', t: 1 }, { k: 'died', who: 'X', t: 'no' }, { k: 'born', who: 'Y', t: 5, m: -1 }]), [{ k: 'born', who: 'Y', t: 5, m: 4294967295 }]);
  assert.equal(readFamily(JSON.parse(JSON.stringify(f))).news.length, NEWS_MAX, 'the record keeps it');
});

test('LEGACY6 the towns\' words: a kinsman\'s news has its own lines, by name and by house, and a town tells it beside the road\'s', () => {
  const item = { kind: 'wed', kin: true, who: 'Aldo Marane', house: 'Hlaalu', foe: '', place: '', t: 0, seen: true };
  let told = null;
  for (let seed = 0; seed < 200 && !told; seed++) told = newsScript(seed, [item]);
  assert.ok(told, 'told');
  assert.ok(KIN_NEWS.wed.includes(told.script), 'the house\'s own words, never the road\'s');
  for (const k of ['died', 'rested', 'wed', 'born']) assert.ok(KIN_NEWS[k].length >= 2, k);
  assert.equal(fillLine('House {house}', {}), `House ${TOKEN_FALLBACK.house}`, 'never a brace on the screen');
  // a meeting says it - LW-TALK (main's #630, at Project Legacy's merge of it): PIN MOVED - told in an exchange, on the
  // exchange's own draw (meetups.js exchangeScript), its first line the slot's opener's; the old circle of a billion
  // minutes laid its exchanges' slots past the array's bound
  const members = [{ id: 'a2', name: 'Ana Two', job: 'crafter' }, { id: 'b3', name: 'Bo Three', job: 'crafter' }];
  let line = null;
  for (let seed = 0; seed < 4000 && !line; seed++) {
    const c = { members, seed, start: 0, end: 200, from: 0, index: 0 };
    const k = circleSlots(c, 2).findIndex((_, i) => slotSpoken(c, i));
    const got = k < 0 ? null : exchangeScript(c, k, 2, { news: [item], player: 'Ysolde' }, null);
    if (got?.told && KIN_NEWS.wed.includes(got.script)) line = circleLine(c, circleSlots(c, 2)[k], 2, { news: [item], player: 'Ysolde' })?.text ?? null;
  }
  assert.ok(line && /Aldo/.test(line) && /Hlaalu/.test(line) && !/\{/.test(line), `a meeting says it, by name and by house: ${line}`);
  // a town tells it: the host's news in its talk's context, beside the road's
  const { nav, buildings, doors } = synthTown();
  const t = new LivingTown(nav, {
    town: { mapId: 5001, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
    clock: () => 600, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND,
    familyNews: (at) => (at >= 0 ? [item] : []),
  });
  assert.deepEqual(t.lineCtx(600).news, [item]);
});

test('LEGACY6 the killer remembered: the foe that ended a character, off their own mirror - and handed to the heir, who it hunts, once', () => {
  const storage = mem();
  const was = globalThis.localStorage;
  globalThis.localStorage = /** @type {any} */ (storage);
  try {
    _resetRevenantForTests();
    const rec = (over = {}) => ({ id: 'rv1', rev: 3, mobileType: 7, gender: 'male', given: 'Grushnak', epithet: 'the Butcher', name: 'Grushnak the Butcher', rank: 2, history: [{ deed: 'fled', at: 100 }, { deed: 'slew', at: 500 }], ...over });
    storage.setItem(`${REVENANT_STORE_PREFIX}c-dead`, JSON.stringify({ v: 1, list: [rec(), rec({ id: 'rv2', given: 'Other', name: 'Other One', history: [{ deed: 'slew', at: 200 }] })] }));
    assert.equal(killerOf('c-dead', 501)?.name, 'Grushnak the Butcher', 'the kill as they fell');
    assert.equal(killerOf('c-dead', 510), null, 'a kill of another day is not this death\'s');
    assert.equal(killerOf('c-none', 501), null);
    storage.setItem(`${REVENANT_STORE_PREFIX}c-dead2`, JSON.stringify({ v: 1, list: [rec({ defeated: true })] }));
    assert.equal(killerOf('c-dead2', 500), null, 'a slain one hunts nobody');
    const heir = { characterId: 'c-heir', name: 'Ilse Hlaalu' };
    const foe = killerOf('c-dead', 500);
    assert.equal(inheritRevenant(heir, foe, { now: 1000, rolls: () => 0 }), true);
    assert.equal(inheritRevenant(heir, foe, { now: 1000, rolls: () => 0 }), false, 'once');
    const kept = JSON.parse(storage.getItem(`${REVENANT_STORE_PREFIX}c-heir`)).list;
    assert.equal(kept.length, 1, 'in the heir\'s own mirror - a new game\'s reset and a load\'s merge keep it');
    assert.equal(kept[0].dueAt, 1000 + REVENANT_RETURN_MIN_MINUTES, 'it comes for them, as any revenant returns');
    assert.equal(kept[0].out, false);
    assert.deepEqual(revenantsFor(heir).map((r) => r.name), ['Grushnak the Butcher'], 'the heir\'s list');
  } finally {
    globalThis.localStorage = was;
    _resetRevenantForTests();
  }
});

/** One world: the host over shared storage with the Living World's relations and a faction dictionary on the entity. */
function person(cid, name = 'Ysolde Hlaalu', { legalRep = {}, reps = { 40: 0 } } = {}) {
  return {
    name, gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), legalRep: { ...legalRep }, factionRep: factions(reps),
  };
}
function world() {
  _resetModSaveData();
  _resetModSettings();
  const storage = mem(), tab = mem();
  const w = { said: [], now: 100, sky: 5000, rel: createRelations(), foes: [], storage, tab };
  w.e = person('c-ysolde', 'Ysolde Hlaalu', { legalRep: { 17: 44 }, reps: { 40: 60 } });
  w.rel.note('L5001.3', 'saved', 0);
  w.host = createLegacyHost({
    get entity() { return w.e; },
    storage: () => storage, tab: () => tab, on: () => true, online: () => false, now: () => w.now, own: () => 0,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity, mapId: 7002, world: { x: 0, z: 0 } }),
    town: (h) => ({ region: h.region, loc: h.loc, mapId: h.mapId }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => 1000, say: (l) => w.said.push(l), boot: () => {}, search: () => '?world', loadCharacter: () => false,
    saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(7),
    regards: () => w.rel, regardDay: () => 0, sky: () => w.sky,
    killerOf: (cid, ownAt) => (cid === 'c-ysolde' && ownAt === 0 ? { id: 'rv1', name: 'Grushnak the Butcher' } : null),
    inheritFoe: (rec) => { w.foes.push([String(w.e.characterId), rec.id]); return true; },
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  w.host.found(MODELS.bloodline);
  _resetModSettings();
  return w;
}

test('LEGACY6 the host: the standing written as the member is saved; their fall is news; the heir is born with a share of it, hunted by the killer the death quest names', () => {
  const w = world();
  const f = w.host.family;
  const founder = personOf(f, f.currentId);
  modSaveRecords();   // a save: the standing written with it
  assert.deepEqual(founder.standing.legal, { 17: 44 });
  assert.deepEqual(founder.standing.factions, { 40: 60 });
  assert.deepEqual(founder.standing.regard, { 'L5001.3': 35 });
  w.host.deathOutcome();
  assert.deepEqual(w.host.newsFor(7002, w.sky + 60).map((n) => [n.kind, n.who, n.house]), [['died', 'Ysolde Hlaalu', 'Hlaalu']], 'where they fell, by the towns\' minute');
  assert.equal(w.host.newsFor(f.seat.mapId, w.sky).length, 1, 'and the seat');
  w.host.succeed({ newborn: true });
  const id = w.host.current().id;
  const b = w.host.takeBorn(id);
  w.e = person('c-heir', `${b.person.given} ${b.person.surname}`, { legalRep: { 17: 4 }, reps: { 40: 0 } });
  w.rel = createRelations();   // a new character knows nobody
  w.host.onBorn();
  assert.equal(w.e.legalRep[17], 4 + 10, 'a quarter of the parent\'s standing in the region\'s law');
  assert.equal(getReputation(w.e.factionRep, 40), 15, 'and the guild\'s');
  assert.equal(w.rel.regard('L5001.3', 0), 17, 'half the town\'s regard');
  // the new game's fresh relations, landing after the birth, take the share again
  const fresh = createRelations();
  assert.equal(w.host.seedRegards(fresh), 1);
  assert.equal(fresh.regard('L5001.3', 0), 17);
  const heir = personOf(w.host.family, id);
  assert.ok(w.host.newsFor(7002, w.sky).some((n) => n.kind === 'born' && n.who === `${heir.given} ${heir.surname}`), 'a birth is news');
  // the killer remembered
  assert.deepEqual(w.foes, [['c-heir', 'rv1']], 'handed to the heir');
  assert.ok(w.said.includes(LEGACY_TEXT.hunted('Grushnak the Butcher', 'Ysolde')));
  const fallen = personOf(w.host.family, founder.id);
  assert.equal(fallen.died.by, 'Grushnak the Butcher', 'the record names it');
  const q = w.host.questLogEntries()[0];
  assert.ok(q.messages[0].includes('It was Grushnak the Butcher that struck them down.'), 'the death quest names it');
  assert.equal(loadFamily(w.storage, f.id).news.length, 2, 'the store holds the news');
});

test('LEGACY6 the host: a share only for the one born on this page - a load forgets it; a member who never was saved hands down nothing', () => {
  const w = world();
  assert.equal(w.host.seedRegards(createRelations()), 0, 'nobody was born here');
  const f = w.host.family;
  const founder = personOf(f, f.currentId);
  founder.standing = null;
  w.host.deathOutcome();
  w.host.family.people.find((p) => p.id === founder.id).standing = null;   // the death's own write took it - a record from before LEGACY6
  w.host.succeed({ newborn: true });
  const b = w.host.takeBorn(w.host.current().id);
  w.e = person('c-heir', `${b.person.given} ${b.person.surname}`, { legalRep: { 17: 4 } });
  w.rel = createRelations();
  w.host.onBorn();
  assert.equal(w.e.legalRep[17], 4, 'no standing, no share');
  assert.equal(w.rel.size(), 0);
});

test('LEGACY6 wiring: the world host hands the host the town\'s regard, the sky and the revenant law, tells the house\'s news in its towns, and a new game\'s relations take the birth\'s share', () => {
  const src = rd('src/scenes/world.js');
  assert.match(src, /regards: \(\) => livingRelations, regardDay: livingRegardDay, sky: \(\) => skyMinutes\(\),/);
  assert.match(src, /killerOf: \(cid, ownAt\) => revenantKillerOf\(cid, ownAt\), inheritFoe: \(rec\) => inheritRevenant\(playerEntity, rec\),/);
  assert.match(src, /familyNews: \(t\) => legacyHost\?\.newsFor\(livingTown\.mapId, t\) \?\? null,/);
  assert.match(src, /newGame: \(\) => \{ livingRelations = createRelations\(\); legacyHost\?\.seedRegards\(livingRelations\); \},/);
  assert.match(rd('src/systems/livingWorld/meetups.js'), /house: told\?\.item\.house \?\? null,/);
  // the house's news at each of its doors: a laying to rest, a wedding, a child of the house
  const host = rd('src/scenes/legacyHost.js');
  assert.match(host, /delete r\.first;\n\s*tellNews\('rested', r\.name, deps\.here\(\)\?\.mapId\);/);
  assert.match(host, /tellNews\('wed', fullNameOf\(s\.given, s\.surname\), c\.mapId\);/);
  assert.match(host, /tellNews\('born', fullNameOf\(kid\.given, kid\.surname\), spouseOf\(family, p\)\?\.mapId\);/);
  assert.match(rd('src/systems/livingWorld/livingTown.js'), /const kin = this\.o\.familyNews\?\.\(t\) \?\? \[\];/);
});
