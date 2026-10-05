// LW6d (2026-10-05, bible/06-Systems/Living-World.md "LW6d", Mac: "make friends or enemies, and explore a dynamic
// world"): THE TOWN'S WORD OF IT - a keepsake carried home (LW6c) is a tale the town tells: the character's record of it
// (relations.js TALE_KINDS `home`, with its minute and the name it tells of), the town's talk of it (livingTown.js
// deedNews beside the deeds), in its own words (lines.js HOME_NEWS). The town is the synthetic one (test/lwTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { LivingTown, DEED_KNOWN_MIN } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations, TALE_KINDS, HAND_KINDS, MARK_KINDS } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { mintKeepsake } from '../src/systems/livingWorld/keepsake.js';
import { HOME_NEWS, newsScript } from '../src/systems/livingWorld/lines.js';
import { NEWS_DAYS } from '../src/systems/livingWorld/trips.js';

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

test('LW6d the character\'s record: a tale (`home`, a keepsake carried home) kept with its minute and the name it tells of, once, beside - not among - the hand deaths; written into the save only once there is one, and read back (mutants: the kind, the minute, the name, the once, the save, the read)', () => {
  assert.deepEqual([...TALE_KINDS], ['home']);
  assert.deepEqual([...HAND_KINDS], ['slain', 'died'], 'the hand deaths as they were');
  assert.deepEqual([...MARK_KINDS], ['laid']);
  const rel = createRelations();
  rel.turn('spared', 'L5.t2@3');
  assert.equal(rel.snapshot().turns.home, undefined, 'none yet: none written');
  assert.equal(rel.turn('home', 'L12345.t9@home', { who: 'Ada Lark' }), false, 'a tale has its minute');
  assert.equal(rel.turn('home', 'L12345.t9@home', { t: 1000, who: 'Ada Lark' }), true);
  assert.equal(rel.turn('home', 'L12345.t9@home', { t: 2000, who: 'Ada Lark' }), false, 'once');
  assert.deepEqual(rel.turns().home.get('L12345.t9@home'), { t: 1000, seen: true, who: 'Ada Lark' });
  assert.equal(rel.turns().slain.size + rel.turns().died.size, 0, 'no hand death');
  assert.deepEqual(rel.snapshot().turns.home, [['L12345.t9@home', 1000, 'Ada Lark']]);
  const back = createRelations(JSON.parse(JSON.stringify(rel.snapshot())));
  assert.deepEqual(back.turns().home.get('L12345.t9@home'), { t: 1000, seen: true, who: 'Ada Lark' }, 'read back');
});

test('LW6d the town\'s word: a keepsake carried home is a tale its town tells - known DEED_KNOWN_MIN after, for NEWS_DAYS, by the name of the one it was, in its own words (HOME_NEWS, the player named); another town\'s, not its talk (mutants: the record at the hand-over, the known minute, the window, the town, the words)', () => {
  const rel = createRelations();
  const carried = [];
  const { town, clock } = makeTown({ relations: () => rel, playerName: () => 'Mac', keepsakes: () => carried, takeKeepsake: (it) => carried.splice(carried.indexOf(it), 1) });
  const day = town.dayOf(clock.t);
  town._now = clock.t;
  const byHome = new Map();
  for (const r of town.peopleOf(day)) if (r.home != null) byHome.set(r.home, [...(byHome.get(r.home) ?? []), r]);
  const [home, family] = [...byHome].find(([, rs]) => rs.length >= 2);
  const fallen = { id: `L${TOWN.mapId}.t9`, name: 'Ada Lark', town: TOWN.mapId, home };
  carried.push(mintKeepsake(fallen));
  assert.ok(town.moment({ living: { id: family[0].id, res: family[0] }, nameNPC: family[0].name }));
  assert.deepEqual(rel.turns().home.get(`L${TOWN.mapId}.t9@home`), { t: clock.t, seen: true, who: 'Ada Lark' }, 'the tale, at the hand-over');
  const at = (t) => town.deedNews(t).filter((n) => n.kind === 'home');
  assert.deepEqual(at(clock.t + DEED_KNOWN_MIN - 1), [], 'not before the town knows it');
  assert.deepEqual(at(clock.t + DEED_KNOWN_MIN).map((n) => [n.kind, n.who, n.seen]), [['home', 'Ada Lark', true]], 'then the town tells it');
  assert.equal(at(clock.t + DEED_KNOWN_MIN + NEWS_DAYS * DAY_MIN - 1).length, 1);
  assert.deepEqual(at(clock.t + DEED_KNOWN_MIN + NEWS_DAYS * DAY_MIN), [], 'for the news days');
  rel.turn('home', 'L999.t1@home', { t: clock.t, who: 'Far Away' });
  assert.ok(!at(clock.t + DEED_KNOWN_MIN).some((n) => n.who === 'Far Away'), 'another town\'s, not its talk');
  // the words
  let told = null;
  for (let seed = 1; seed < 4000 && !told; seed++) told = newsScript(seed, [{ kind: 'home', who: 'Ada Lark', foe: '', place: '', seen: true }]);
  assert.ok(told && HOME_NEWS.includes(told.script), 'its own words');
  assert.ok(HOME_NEWS.every((sc) => sc.some((l) => l.includes('{player}')) && sc.some((l) => l.includes('{who}'))), 'the player and the one it was named');
});
