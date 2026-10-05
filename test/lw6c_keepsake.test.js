// LW6c (2026-10-05, bible/06-Systems/Living-World.md "LW6c", Mac: "make friends or enemies, and explore a dynamic
// world"): CARRIED HOME - each of the fallen of a dive carries a keepsake, found with their remains (LW6b); carried home,
// it is the household's moment: handed over, their words on the parchment, the one spoken with and the rest of the
// household remembering it. The town is the synthetic one (test/lwTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { mintKeepsake, isKeepsake, keepsakeFor, KEEPSAKE_TEMPLATE, KEEPSAKE_KINDS, KEEPSAKE_GROUP } from '../src/systems/livingWorld/keepsake.js';
import { LIVING_KEEPSAKE, fillLine } from '../src/systems/livingWorld/lines.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { itemLongName } from '../src/systems/itemInfo.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

test('LW6c the keepsake: an item of the port\'s own (template 1800, worth nothing, no shelf\'s, no stack) - each fallen\'s own kind by their id, named for them, marking whose it was; found among what the player carries by the town and the home they lived in - never their own place\'s (the fallen, a newcomer holding it), never another town\'s or home\'s (mutants: the template, the kind, the name, the mark, the town, the home, the place)', () => {
  assert.equal(KEEPSAKE_TEMPLATE, 1800);
  const row = templateByIndex(KEEPSAKE_TEMPLATE);
  assert.ok(row?.custom, 'registered');
  assert.deepEqual([row.name, row.basePrice, row.rarity, row.stackable], ['Keepsake', 1, 0, false]);
  assert.deepEqual([...KEEPSAKE_KINDS], ['locket', 'ring', 'brooch', 'charm']);
  const res = { id: 'L12345.t3', name: 'Ada Lark', town: 12345, home: 4097 };
  const k = mintKeepsake(res);
  assert.equal(k.group, KEEPSAKE_GROUP);
  assert.equal(k.templateIndex, KEEPSAKE_TEMPLATE);
  assert.ok(isKeepsake(k));
  assert.match(k.name, /^Ada Lark's (locket|ring|brooch|charm)$/);
  assert.equal(itemLongName(k), k.name, 'named for them in every list');
  assert.deepEqual(k.livingKeepsake, { id: 'L12345.t3', name: 'Ada Lark', town: 12345, home: 4097 });
  assert.equal(mintKeepsake(res).name, k.name, 'their own, by their id');
  assert.equal(new Set(Array.from({ length: 40 }, (_, i) => mintKeepsake({ ...res, id: `L12345.t${i}` }).name.split(' ').pop())).size, 4, 'the kinds over the people');
  assert.ok(!isKeepsake({ templateIndex: KEEPSAKE_TEMPLATE }), 'a keepsake marks whose it was');
  const carried = [{ templateIndex: 135 }, k];
  assert.equal(keepsakeFor(carried, 12345, 4097, 'L12345.h7'), k);
  assert.equal(keepsakeFor(carried, 12346, 4097, 'L12345.h7'), null, 'another town');
  assert.equal(keepsakeFor(carried, 12345, 4098, 'L12345.h7'), null, 'another home');
  assert.equal(keepsakeFor(carried, 12345, null, 'L12345.h7'), null, 'no home');
  assert.equal(keepsakeFor([mintKeepsake({ ...res, home: null })], 12345, null, 'L12345.h7'), null, 'one of no home: nobody\'s household');
  assert.equal(keepsakeFor(carried, 12345, 4097, 'L12345.t3'), null, 'the fallen\'s own place');
  assert.equal(keepsakeFor(carried, 12345, 4097, 'L12345.t3~2'), null, 'a newcomer holding it now');
});

function makeTown(extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND, ...extra,
  });
  return { town, clock };
}

test('LW6c carried home: speaking with one of the household the fallen lived with while carrying their keepsake - it is handed over, the one spoken with remembers it (saved) and the rest of the household too (helped), and theirs are the words (LIVING_KEEPSAKE, the fallen\'s first name and the player\'s); once; another household, or none carried, nothing (mutants: the hand-over, the saved, the household, the words, the once)', () => {
  const rel = createRelations();
  const carried = [];
  const taken = [];
  const { town } = makeTown({ relations: () => rel, playerName: () => 'Mac', keepsakes: () => carried, takeKeepsake: (it) => { taken.push(it); carried.splice(carried.indexOf(it), 1); } });
  const day = town.dayOf(town._now);
  const byHome = new Map();
  for (const r of town.peopleOf(day)) if (r.home != null) byHome.set(r.home, [...(byHome.get(r.home) ?? []), r]);
  const [home, family] = [...byHome].find(([, rs]) => rs.length >= 3);
  const [spoken, ...rest] = family;
  const fallen = { id: `L${TOWN.mapId}.t9`, name: 'Ada Lark', town: TOWN.mapId, home };
  const k = mintKeepsake(fallen);
  const person = (r) => ({ living: { id: r.id, res: r }, nameNPC: r.name });
  // none carried: nothing
  assert.equal(town.moment(person(spoken)), null);
  carried.push({ templateIndex: 135 }, k);
  // another household: nothing
  const other = [...byHome].find(([h]) => h !== home)[1][0];
  assert.equal(town.moment(person(other)), null, 'another household');
  assert.equal(carried.length, 2);
  const words = town.moment(person(spoken));
  assert.ok(Array.isArray(words) && words.length >= 2, 'their words');
  assert.ok(LIVING_KEEPSAKE.some((w) => JSON.stringify(w.map((l) => fillLine(l, { who: 'Ada', player: 'Mac' }))) === JSON.stringify(words)), 'LIVING_KEEPSAKE, the fallen and the player named');
  assert.deepEqual(taken, [k], 'handed over');
  assert.deepEqual(carried.map((x) => x.templateIndex), [135], 'gone from what the player carries');
  assert.equal(rel.regard(spoken.id, day), 35, 'the one spoken with: saved');
  for (const r of rest) assert.equal(rel.regard(r.id, day), 20, `${r.id}: the household, helped`);
  assert.equal(rel.regard(other.id, day), 0, 'nobody else');
  assert.equal(town.moment(person(spoken)), null, 'once');
  // the words vary by who and whose
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const r2 = createRelations();
    const c2 = [mintKeepsake({ ...fallen, id: `L${TOWN.mapId}.t${20 + i}` })];
    const t2 = makeTown({ relations: () => r2, playerName: () => 'Mac', keepsakes: () => c2, takeKeepsake: (it) => c2.splice(c2.indexOf(it), 1) }).town;
    seen.add(JSON.stringify(t2.moment(person(spoken))));
  }
  assert.ok(seen.size >= 2, 'not one set of words for every keepsake');
});

test('LW6c the hosts: the talk shows the household\'s moment on the parchment before any words (and no conversation that time); the body\'s town answers it - the street\'s own, the room\'s door, gives the town what the player carries and takes the keepsake handed over, and lays each fallen\'s keepsake with their remains (mutants: the parchment, the doors, the carried, the handed, the laid)', () => {
  const tt = rd('src/scenes/townTalk.js');
  assert.match(tt, /if \(refusal\) \{ setMidScreenText\(refusal\); return; \}\n(?:\s*\/\/[^\n]*\n)*\s*const moment = target\.person\?\.living\?\.town\?\.moment\?\.\(target\.person\) \?\? null;\n\s*if \(moment\) \{ showOverlay\(new ActionTextBox\(moment\)\); return; \}/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /moment: \(p\) => livingIndoors\?\.town\(\)\?\.moment\?\.\(p\) \?\? null,/);
  assert.match(w, /keepsakes: \(\) => playerEntity\.items \?\? \[\],/);
  assert.match(w, /takeKeepsake: \(item\) => \{ const i = playerEntity\.items\?\.indexOf\(item\) \?\? -1; if \(i >= 0\) playerEntity\.items\.splice\(i, 1\); \},/);
  assert.match(w, /items\.push\(mintKeepsake\(res\)\);/);
});
