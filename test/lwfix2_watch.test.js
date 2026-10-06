// LW-FIX2 (2026-10-05, bible/06-Systems/Living-World.md "LW-FIX2"): THE SEAMS' THREE - an audit of every seam the living
// world's host reads found a struck watchman's guard ended by a method no town has (a crash the moment he fell), his
// guard never found on a swing (looked for among the watch standing after it was stood), and a room's doors reading the
// street's stopped minute (a word noted on the day the player went in - or on day -1 after a load made indoors). Each
// pinned here, on the synthetic town and mock guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations, EVENTS } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { watchStep, WATCH_WAIT } from '../src/scenes/livingWatch.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

function makeTown(extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND, ...extra,
  });
  return { town, clock };
}

test('LW-FIX2 the turned watch: a struck watchman\'s guard followed by the mark the conversion put on it (never another guard stood after); cut down by the player, the town\'s whole deed (`slain`: the hand\'s turn at that minute, his household turned, taken off the street); the guard gone with the crime let be - WATCH-FIX: PIN MOVED, his END read (a body the player made), never any `dead`, and he is back on his day (test/watchfix_watch.test.js) (mutants: the mark, the deed, the gone)', () => {
  assert.equal(WATCH_WAIT, 600);
  const rel = createRelations();
  const slays = [];
  const { town, clock } = makeTown({ relations: () => rel, slay: (res, at, seen) => slays.push({ id: res.id, at, seen }) });
  town._now = clock.t;
  const day = town.dayOf(clock.t);
  const watch = town.peopleOf(day).find((r) => r.roll === 'w') ?? town.residents.find((r) => r.roll === 'w');
  assert.ok(watch, 'one of the watch');
  const person = { living: { id: watch.id, res: watch, town }, pos: [0, 0, 0], guard: true };   // LW-FIX5: by the struck body's identity
  const turned = [];
  const other = { livingFrom: null, dead: false }, his = { livingFrom: person.living, dead: false, corpse: false, ai: { feet: [1, 0, 2] } };
  const guards = [other];
  watchStep(turned, guards);
  assert.equal(turned.length, 0, 'another guard stood after: not his - nobody followed');
  guards.push(his);
  watchStep(turned, guards);
  assert.equal(turned[0]?.guard, his, 'his, by its mark');
  assert.ok(town._lent.has(watch.id), 'lent to his guard (WATCH-FIX)');
  his.dead = true; his.corpse = true; his.killedBy = 'player';
  watchStep(turned, guards);
  assert.equal(turned.length, 0);
  assert.deepEqual(slays, [{ id: watch.id, at: clock.t, seen: slays[0]?.seen ?? false }], 'the hand\'s turn at this minute');
  for (const kin of town.kinOf(watch)) assert.equal(rel.regard(kin.id, day), EVENTS.slain, `${kin.id}: his household turned`);
  // the guard gone with the crime: no body - let be, and back on his day
  const second = makeTown({ relations: () => createRelations(), slay: () => assert.fail('a walk-away is no deed') });
  second.town._now = second.clock.t;
  const w2 = second.town.peopleOf(day).find((r) => r.roll === 'w');
  const g2 = { livingFrom: { id: w2.id, res: w2, town: second.town }, dead: false, corpse: false };
  const gone = [];
  watchStep(gone, [g2]);
  g2.dead = true;   // walked away with the crime - DFU's despawn, no corpse
  watchStep(gone, [g2]);
  assert.equal(gone.length, 0, 'gone: let be');
  assert.equal(second.town._lent.has(w2.id), false, 'back to his day');
});

test('LW-FIX2 a room\'s doors read the clock\'s own minute: a word, a tone, a refusal asked while the street stands still (its minute the one the player went in, or nought after a load made indoors) are noted on today (mutants: the word, the tone, the refusal)', () => {
  const rel = createRelations();
  const { town, clock } = makeTown({ relations: () => rel });
  town._now = 0;   // the street never stood since the load
  const day = town.dayOf(clock.t);
  const r = town.residents[0];
  const person = { living: { id: r.id, res: r, town }, nameNPC: r.name };
  town.talked(person);
  assert.equal(rel.regard(r.id, day), EVENTS.talk, 'the word counts, today');
  assert.equal(rel.entries().find((e) => e.id === r.id).seen, day, 'seen today');
  town.toned(person, 0);
  assert.equal(rel.regard(r.id, day), EVENTS.talk + EVENTS.polite, 'the tone, today');
  const foe = town.residents[1];
  rel.note(foe.id, 'slain', day);
  assert.ok(town.refuses({ living: { id: foe.id, res: foe, town }, nameNPC: foe.name }), 'hostile today: refused');
  const rel2 = createRelations();
  const eased = makeTown({ relations: () => rel2 });
  eased.town._now = 0;
  rel2.note(foe.id, 'struck', day - 60);   // an enemy sixty days ago - eased to -15 by today (an enemy still, read on day -1)
  assert.equal(eased.town.refuses({ living: { id: foe.id, res: foe, town: eased.town }, nameNPC: foe.name }), null, 'today\'s standing, eased');
});

test('LW-FIX2 the conversions mark their guards: every arm\'s guard (scenes/cityGuards.js turnNpc - WATCH-FIX: PIN MOVED, one law for every arm) and the trample\'s (systems/rrRidingHost.js) carries whom it stands for, and the host follows the watch through it (mutants: each mark, the host)', () => {
  const cg = rd('src/scenes/cityGuards.js');
  assert.match(cg, /const g = await spawnGuardAt\(p\.pos, p\.fwdYaw, attackerFeet, opts\);\n\s*if \(!g\) return null;\n\s*if \(p\.person\?\.living\) g\.livingFrom = p\.person\.living;\n\s*p\.disable\(\);/);
  assert.match(cg, /setCrimeCommitted\(playerEntity, CRIME_ASSAULT\);[^\n]*\n\s*await turnNpc\(best, playerFeet \?\? null\);/, 'the swing\'s, through the one law');
  const rr = rd('src/systems/rrRidingHost.js');
  assert.match(rr, /\.then\(\(g\) => \{ if \(g\) \{ g\.livingFrom = from; chargeFoe\(g, fwd\); \} \}\)/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /const livingWatchStep = \(\) => watchStep\(_livingWatchTurned, cityGuards\.guards, \{ resolve: livingResidentOf, localOf: livingLocalOf \}\);/);
});
