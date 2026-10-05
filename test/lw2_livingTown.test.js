// LW2 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING TOWN - the residents on the street, in the wandering
// pool's own shape, and its wiring in the streaming host. The town is the synthetic one (test/lwTown.mjs); the bodies
// are the real ResidentWalker; the clock is the calendar's (DFU's walking pace over CLASSIC_MINUTES_PER_SECOND).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown, LIVING_RANGE, CATCH_UP, GREET_RANGE, LIVING_REFUSAL, LINE_HEAD_M, SNAP_M, WALK_FAST, DOOR_POP_MIN, ARRIVAL_JUMP_MIN, ARRIVAL_STEP_M } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { MobilePerson, PERSON_IDLE_RECORD, PERSON_GUARD_IDLE_RECORD, MOVE_RECORDS, MOVE_FLIPS, PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { mobileOrientation } from '../src/characters/mobileUnit.js';
import { POP_VISIBLE_RANGE, maxPopulationFor } from '../src/systems/townPopulation.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { LIVING_GREETINGS, firstNameOf } from '../src/systems/livingWorld/lines.js';
import { circleLine, lineMinutes } from '../src/systems/livingWorld/meetups.js';
import { DAY_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { livingWorldOn, LIVING_WORLD_KEY, LIVING_WORLD_TUNING } from '../src/systems/livingWorld/livingSwitch.js';
import { FEATURES } from '../src/systems/features.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

function makeTown({ minute, relations = null, suppress = () => false, playerName = 'Mac' } = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: minute };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM, suppressSpawns: suppress,
    relations: () => relations, playerName: () => playerName, townName: 'Synth', regionName: 'Daggerfall',
  });
  return { town, clock, nav };
}
const SQUARE = [96 * 1.6 + 0.8, 0, 96 * 1.6 + 0.8];
/** Run `seconds` of real time at 30 frames a second, the clock with it; the player standing at `at`. */
function run(t, seconds, at = SQUARE, stop = () => false, viewYaw = 0) {
  const dt = 1 / 30;
  let seats = [];
  for (let i = 0; i < Math.round(seconds * 30); i++) { t.clock.t += dt * RATE; seats = t.town.update(dt, at, viewYaw, at, true, stop); }
  return seats;
}

test('LW2 the body: a ResidentWalker is a MobilePerson (every seam that takes a walker takes it) wearing the walker\'s billboard on a yaw of its own - the MoveAnims wheel through mobileOrientation, idle record 5 (the watch\'s 15), the frame reset at each change of state; it claims no grid tile (mutants: the wheel off the yaw, the guard\'s idle, the reset)', () => {
  const p = new ResidentWalker({}, { archive: 385, frameCount: () => 4, groundY: () => 0 });
  assert.ok(p instanceof MobilePerson);
  p.pos = [0, 0, 0]; p.yaw = 1.0; p.moving = true;
  const eye = [5, 1.6, -3];
  const o = mobileOrientation(1.0, p.pos, eye);
  assert.notEqual(o, mobileOrientation(0, p.pos, eye), 'the fixture tells a yaw from none');
  const out = p.update(0.1, eye, false);
  assert.deepEqual([out.record, out.flip], [MOVE_RECORDS[o], MOVE_FLIPS[o]]);
  assert.equal(p.facingYaw, 1.0, 'the facing the watch\'s conversion reads');
  for (let i = 0; i < 6; i++) p.update(0.1, eye, false);
  assert.equal(p.frame, 2, 'two walking frames in, at 4 fps');
  const idle = p.update(0.01, eye, true);
  assert.equal(idle.record, PERSON_IDLE_RECORD, 'the politeness gate stands it');
  assert.equal(idle.frame, 0, 'its idle cycle from its first frame');
  assert.equal(p.frame, 0);
  const g = new ResidentWalker({}, { archive: 399, guard: true, frameCount: () => 1, groundY: () => 0 });
  g.pos = [0, 0, 0];
  assert.equal(g.update(0.1, eye, false).record, PERSON_GUARD_IDLE_RECORD);
  assert.doesNotThrow(() => p.release(), 'nothing on the grid to release');
});

test('LW2 the street by day: the residents out of doors near the player stand on it, never past DFU\'s cap (maxPopulationFor); each where their day has them - a walk on its path, a stay at its spot; at three in the morning the street is all but empty; the same residents for every reader (mutants: the cap, the outdoor test, the range)', () => {
  const day = 100;
  const a = makeTown({ minute: day * DAY_MIN + 10 * 60 });
  const seats = run(a, 6);
  assert.ok(seats.length >= 6, `a morning street (${seats.length})`);
  assert.ok(seats.length <= maxPopulationFor(TOWN.blocks));
  for (const { person } of seats) {
    const res = person.living.res;
    const w = a.town.where(res, a.clock.t, false);
    assert.ok(w, `${res.id} is out of doors`);
    assert.ok(isOutdoor(w.e), `${res.id}: an outdoor entry`);
    assert.ok(Math.hypot(person.pos[0] - SQUARE[0], person.pos[2] - SQUARE[2]) < LIVING_RANGE + 10);
    assert.ok(Math.hypot(person.pos[0] - w.x, person.pos[2] - w.z) < 2.5, `${res.id}: where its day has it`);
    assert.equal(person.pos[1], 0.25, 'on the ground the host answers');
    assert.equal(person.nameNPC, res.name); assert.equal(person.personFaceRecordId, res.face); assert.equal(person.archive, res.archive);
  }
  const b = makeTown({ minute: day * DAY_MIN + 10 * 60 });
  assert.deepEqual(run(b, 6).map((s) => s.person.living.id).sort(), seats.map((s) => s.person.living.id).sort(), 'another reader, the same street');
  const night = makeTown({ minute: day * DAY_MIN + 3 * 60 + 1 });
  assert.ok(run(night, 6).length <= 2, 'the small hours');
  // the range: from outside the town's corner, nobody past LIVING_RANGE is stood though the cap has room
  const corner = [-90, 0, -90];
  const c = makeTown({ minute: day * DAY_MIN + 10 * 60 });
  const far = run(c, 6, corner);
  assert.ok(far.length < maxPopulationFor(TOWN.blocks), 'room under the cap');
  for (const { person } of far) assert.ok(Math.hypot(person.pos[0] - corner[0], person.pos[2] - corner[2]) < LIVING_RANGE + 2, `${person.living.id} within range`);
  assert.ok(c.town.residents.some((r) => { const w = c.town.where(r, c.clock.t, false); return w && Math.hypot(w.x - corner[0], w.z - corner[2]) > LIVING_RANGE + 10; }), 'and someone out of doors beyond it');
  // a body stood afresh faces its way on the very frame it is first seen
  const fresh = makeTown({ minute: day * DAY_MIN + 10 * 60 });
  const was = new Set();
  let facing = 0;
  for (let f = 0; f < 90; f++) {
    fresh.clock.t += RATE / 30;
    for (const { person } of fresh.town.update(1 / 30, SQUARE, 0, SQUARE, true)) {
      if (was.has(person)) continue;
      was.add(person);
      const w = fresh.town.where(person.living.res, fresh.clock.t, false);
      if (w?.moving && Math.abs(w.yaw) > 1e-6) { assert.ok(Math.abs(person.yaw - w.yaw) < 1e-6, `${person.living.id} faces its walk`); facing++; }
    }
  }
  assert.ok(facing > 0, 'someone first seen walking a way that is not north');
});

test('LW2 a walk: the body walks its day\'s path at the day\'s pace - never slower, a long path to WALK_FAST times it - facing the way it goes, and goes through the door at the end; it holds for the player standing before it (the street\'s politeness gate) and owes those minutes, walking them off CATCH_UP faster (mutants: the pace, the facing, the owed minutes dropped, the catch-up)', () => {
  const t = makeTown({ minute: 100 * DAY_MIN + 9 * 60 });
  let walker = null;
  for (let i = 0; i < 120 && !walker; i++) {
    walker = run(t, 1).find((s) => {
      const w = s.person.moving && t.town.where(s.person.living.res, t.clock.t, false);
      return w && w.e.kind === 'walk' && !w.pending && (w.e.t1 - t.clock.t) > 3 * RATE * 8;
    }) ?? null;
  }
  assert.ok(walker, 'someone walking, a while yet to go');
  const p = walker.person, res = p.living.res;
  const w0 = t.town.where(res, t.clock.t, false);
  assert.equal(w0.e.kind, 'walk');
  assert.ok(Math.abs(p.yaw - w0.yaw) < 1e-9, 'facing its leg');
  const at0 = [...p.pos];
  run(t, 1);
  const moved = Math.hypot(p.pos[0] - at0[0], p.pos[2] - at0[2]);
  assert.ok(moved > PERSON_MOVE_SPEED * 0.8 && moved < PERSON_MOVE_SPEED * WALK_FAST * 1.1, `a second's walk (${moved.toFixed(2)} m)`);
  // the gate: stood for two seconds, it does not move and owes the minutes
  const before = [...p.pos];
  run(t, 2, SQUARE, (q) => q === p);
  if (t.town.where(res, t.clock.t, false)?.e.kind === 'walk') {
    assert.ok(Math.hypot(p.pos[0] - before[0], p.pos[2] - before[2]) < 1e-6, 'held');
    const owed = t.town._lag.get(res.id);
    assert.ok(Math.abs(owed - 2 * RATE) < 1e-6, 'owes two seconds of the clock');
    run(t, 1);
    assert.ok(Math.abs(t.town._lag.get(res.id) - (2 * RATE - RATE * CATCH_UP)) < 1e-6, 'walks it off');
  }
  assert.equal(CATCH_UP, 0.35); assert.equal(WALK_FAST, 1.6); assert.equal(SNAP_M, 30);
});

test('LW2 coming onto the street: on ARRIVAL (the first frame, a jump of the clock past ARRIVAL_JUMP_MIN) the street is as the day has it - those in plain sight included; after it a resident wanted near the player in view comes on only out of a door (a walk begun from one within DOOR_POP_MIN), otherwise beyond POP_VISIBLE_RANGE or behind the player, DFU\'s own hiding; a resident taken off the street (retired by the trample, disabled by the watch\'s conversion) is gone for the day; a racial override holds new ones in (mutants: the arrival, the hiding, the taken day, the override)', () => {
  const t = makeTown({ minute: 100 * DAY_MIN + 10 * 60 });
  const inSight = (p) => { const dx = p.pos[0] - SQUARE[0], dz = p.pos[2] - SQUARE[2]; return Math.hypot(dx, dz) <= POP_VISIBLE_RANGE && dx * Math.sin(0) + dz * Math.cos(0) > 0; };
  const arrived = run(t, 0.5);
  assert.ok(arrived.some((s) => inSight(s.person) && !t.town.where(s.person.living.res, t.clock.t, false)?.fromDoor), 'arriving, the street in plain sight is peopled');
  // the street's churn under a tight cap: one more stood as another goes in, near and in sight, waits to be unseen
  t.town.maxPopulation = 3;
  run(t, 4);
  const seen = new Set(t.town.pool.filter((r) => r.visible && r.res).map((r) => r.res.id));
  let checked = 0;
  for (let f = 0; f < 30 * 40; f++) {
    t.clock.t += RATE / 30;
    const seats = t.town.update(1 / 30, SQUARE, 0, SQUARE, true);
    const now = new Set();
    for (const { person } of seats) {
      const id = person.living.id;
      now.add(id);
      if (seen.has(id)) continue;
      const w = t.town.where(person.living.res, t.clock.t, false);
      assert.ok(!inSight(person) || (w?.fromDoor && w.e.kind === 'walk' && t.clock.t - w.e.t0 < DOOR_POP_MIN), `${id}: popped in in plain sight`);
      checked++;
    }
    seen.clear(); for (const id of now) seen.add(id);
  }
  let waited = 0;
  for (const r of t.town.pool) if (r.active && r.res && !r.visible && r.scheduleEnable && inSight(r.person)) waited++;
  // a rest's jump of the clock is an arrival again, and so is the player's (a Recall)
  t.town.maxPopulation = maxPopulationFor(TOWN.blocks);
  t.clock.t += ARRIVAL_JUMP_MIN + 60;
  t.town.update(1 / 30, SQUARE, 0, SQUARE, true);
  assert.equal(t.town._arriving, true);
  run(t, 1);
  t.town.update(1 / 30, [SQUARE[0] - ARRIVAL_STEP_M - 30, 0, SQUARE[2]], 0, SQUARE, true);
  assert.equal(t.town._arriving, true, 'a teleport is an arrival');
  assert.ok(checked + waited > 0, 'the churn happened: someone came on unseen, or waits in sight to be');
  assert.ok(waited > 0, 'and one wanted in plain sight is waiting, not popped in');
  const seats = run(t, 3);
  const gone = seats[0].person;
  const id = gone.living.id;
  assert.equal(t.town.retire(gone), true);
  run(t, 3);
  assert.ok(!t.town.pool.some((r) => r.res?.id === id), 'retired: not stood again today');
  const other = run(t, 1)[0];
  const row = t.town.pool.find((r) => r.person === other.person);
  const id2 = row.res.id;
  row.active = false; row.visible = false;   // the watch's conversion's inline free
  run(t, 1);
  assert.ok(!t.town.pool.some((r) => r.res?.id === id2), 'converted: gone for the day');
  assert.equal(t.town._taken.get(id2), t.town.dayOf(t.clock.t));
  const held = makeTown({ minute: 100 * DAY_MIN + 10 * 60, suppress: () => true });
  assert.equal(run(held, 3).length, 0, 'the transformed lycanthrope: nobody comes out');
});

test('LW2 what the street says: a circle\'s line is its own (circleLine at this minute - every reader hears it) over the speaker alone; a word to the player passing close is by their regard - a friend calls them by name, an enemy\'s is cold - and an enemy will not talk (LIVING_REFUSAL); a word exchanged is noted once a day (mutants: the speaker, the regard\'s pool, the refusal, the note)', () => {
  const relations = createRelations();
  const t = makeTown({ minute: 100 * DAY_MIN + 18 * 60, relations });
  run(t, 20);
  const lineMin = lineMinutes(RATE);
  let heard = 0, silent = 0;
  for (let k = 0; k < 240 && heard < 6; k++) {
    run(t, 0.5);
    const said = t.town.speech(SQUARE, 500);
    for (const l of said) {
      const c = t.town._inCircle.get(l.person.living.id);
      if (!c) continue;
      const expect = circleLine(c.circle, t.clock.t, lineMin, { town: 'Synth', region: 'Daggerfall', weather: null, hour: 18 });
      assert.ok(expect, 'a circle line is said now');
      assert.equal(expect.who.id, l.person.living.id, 'by its speaker');
      assert.equal(l.text, expect.text);
      heard++;
      // the circle's other members stand silent while it is said
      for (const m of c.circle.members) if (m.id !== l.person.living.id && said.some((x) => x.person.living?.id === m.id && x.text === l.text)) silent--;
    }
  }
  assert.ok(heard > 0, 'circles talked within earshot');
  assert.equal(silent, 0, 'one speaker a line');
  // a friend greets by name, an enemy coldly; an enemy refuses the talk
  const seat = run(t, 0.5).find((s) => !t.town._inCircle.has(s.person.living.id));
  if (seat) {
    const p = seat.person, id = p.living.id;
    const day = t.town.dayOf(t.clock.t);
    relations.note(id, 'saved', day); relations.note(id, 'saved', day);
    t.town._greeted.clear();
    t.town._greet(p.living.res, p, 1, false);
    const said = t.town._greetings.find((g) => g.person === p);
    assert.ok(said && LIVING_GREETINGS.friend.some((g) => g.replace('{player}', 'Mac') === said.text), 'a friend\'s word');
    relations.note(id, 'struck', day); relations.note(id, 'struck', day); relations.note(id, 'struck', day);
    t.town._greeted.clear();
    t.town._greet(p.living.res, p, 1, false);
    assert.ok(LIVING_GREETINGS.enemy.includes(t.town._greetings.find((g) => g.person === p).text), 'an enemy\'s');
    assert.equal(t.town.refuses(p), LIVING_REFUSAL.replace('{a}', firstNameOf(p.nameNPC)));
    t.town._greeted.clear();
    t.town._greet(p.living.res, p, GREET_RANGE + 0.5, false);
  }
  const fresh = run(t, 0.5)[0].person;
  const id = fresh.living.id;
  assert.equal(t.town.refuses(fresh) === null || relations.standing(id, t.town.dayOf(t.clock.t)) !== 'neutral', true);
  const before = relations.regard(id, t.town.dayOf(t.clock.t));
  assert.equal(t.town.talked(fresh), id);
  t.town.talked(fresh);
  assert.equal(relations.regard(id, t.town.dayOf(t.clock.t)), before + 3, 'once a day');
  assert.equal(LINE_HEAD_M, 2.1);
});

test('LW2 the switch: the Features row `living-world` (on, the player\'s own online, the enhanced lane\'s); livingWorldOn reads the row on the enhanced skin alone (mutants: the row\'s default, the online answer)', () => {
  const row = FEATURES.find((f) => f.id === 'living-world');
  assert.ok(row);
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: LIVING_WORLD_KEY, initial: true, online: 'player' });
  assert.deepEqual([...row.kinds], ['enhanced']);
  LIVING_WORLD_TUNING.override = false;
  assert.equal(livingWorldOn(), false);
  LIVING_WORLD_TUNING.override = null;
  const src = rd('src/systems/livingWorld/livingSwitch.js');
  assert.match(src, /isEnhanced\(\) && getPref\(LIVING_WORLD_KEY\) !== false/);
});

test('LW2 the streaming host: where the row is on, the population block stands a LivingTown on the same navgrid, bodies (ResidentWalker on the same collider, ground and batches) and racial override; DFU\'s pool otherwise, as it was; every door names its building (the block\'s grid cell); the regards ride the save as `LivingWorld`; the residents speak through the crew\'s one layer; the talk ray asks the body\'s town for a refusal and notes the word (mutants: each seam removed)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /population = livingWorldOn\(\) \? new LivingTown\(nav, \{/);
  assert.match(w, /\}\) : new TownPopulation\(nav, \{/);
  assert.match(w, /const person = new ResidentWalker\(nav, \{ archive, guard, frameCount: \(rec, a\) => personTex\.get\(a\)\.getFrameCount\(rec\), collider: personCollider, groundY: personGroundY \}\);\n\s+personBatches\.set\(person, renderer\.createBillboardBatch\(archive, 0, \{ w: 1, h: 1 \}, \[\[0, 0, 0\]\]\)\);/);
  assert.match(w, /groundY: personGroundY,   \/\/ JAN1/);
  assert.match(w, /door, pixelKey: key, dfBlock: b\.dfBlock, blockX: b\.x, blockY: b\.y,/);
  assert.match(w, /key: makeBuildingKey\(d\.blockX, d\.blockY, d\.recordIndex\)/);
  assert.match(w, /clock: skyMinutes, rate: livingRate, mpm: PERSON_MOVE_SPEED \/ livingBaseRate\(\),/);
  assert.match(w, /const livingBaseRate = \(\) => \(params\.has\('online'\) \? skyMinutesPerMsAt\(Date\.now\(\) \+ _sharedOffsetMs\) \* 1000 : CLASSIC_MINUTES_PER_SECOND\);/);
  assert.match(w, /const livingRate = \(\) => \(params\.has\('online'\) \? livingBaseRate\(\) : CLASSIC_MINUTES_PER_SECOND \* worldTimeScale\(\)\);/);
  assert.match(w, /registerModSaveData\(LIVING_WORLD_VENDOR, \{\n\s+newSaveData: \(\) => null,\n\s+getSaveData: \(\) => livingRelations\.snapshot\(\),\n\s+restoreSaveData: \(rec\) => \{ livingRelations = createRelations\(rec\); \},/);
  const lines = w.slice(w.indexOf('function navalCrewLines('), w.indexOf('function livingLinePoints('));
  assert.match(lines, /livingLinePoints\(points, w, h, rect, proj, view, eye\);/);
  assert.ok(lines.indexOf('livingLinePoints(') < lines.indexOf('drawCrewLines('), 'merged before the one draw');
  assert.match(w, /livingTalk: \{ refuses: \(person\) => person\?\.living\?\.town\?\.refuses\(person\) \?\? null, talked: \(person\) => person\?\.living\?\.town\?\.talked\(person\), caught: \(person\) => person\?\.living\?\.town\?\.caught\?\.\(person\) \},/);
  const tt = rd('src/scenes/townTalk.js');
  const act = tt.slice(tt.indexOf('function activate(target, dist)'));
  assert.ok(act.indexOf('livingTalk?.refuses?.(target.person)') > 0 && act.indexOf('livingTalk?.refuses?.(target.person)') < act.indexOf('const eng0 = engine();'), 'the refusal before the conversation');
  assert.ok(act.indexOf('livingTalk?.talked?.(target.person);') > act.indexOf('_talkNpc = target.person;'), 'the word noted once it is a conversation');
});
