// STAND-LIFE (2026-10-28, bible/06-Systems/Living-World.md "STAND-LIFE"; the owner: "Living world NPCs should not turn
// into static sprites when stopping"): ONE STANDING STIRS. A resident's billboard held the walk wheel's still frame for
// as long as they stood (LW-TALK), and one keeping their place alone stood as one of Daggerfall's still pictures, 55 of
// whose 63 are a single frame. Now a stand glances aside or shifts its weight every few seconds, on the body's own
// rhythm, and a still picture stands only where the game's own art moves. The town is the synthetic one (test/lwTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from '../../lwTown.mjs';
import { ResidentWalker, STAND_FRAME, IDLE_EVERY_S, IDLE_GLANCE_S, IDLE_GLANCE_YAW, IDLE_SHIFT_FPS, IDLE_SHIFT_FRAMES } from '../../../src/characters/residentWalker.js';
import { MOVE_RECORDS, MOVE_FLIPS, PERSON_IDLE_RECORD, PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { mobileOrientation } from '../../../src/characters/mobile/mobileUnit.js';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { stillFlatOf, stillRoleOf, MOVING_STILLS } from '../../../src/systems/livingWorld/looks.js';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const EYE = [5, 1.6, -3];
const body = (o = {}) => {
  const p = new ResidentWalker({}, { archive: 385, frameCount: () => 4, groundY: () => 0, ...o });
  p.pos = [0, 0, 0]; p.yaw = 0.4; p.moving = false;
  return p;
};
/** `seconds` of a body's frames at 30 a second: each frame's record, frame, flip and stir. */
function stand(p, seconds, stop = false) {
  const out = [];
  for (let i = 0; i < Math.round(seconds * 30); i++) {
    const f = p.update(1 / 30, EYE, stop);
    out.push({ t: (i + 1) / 30, record: f.record, frame: f.frame, flip: f.flip, stir: p.stir, shown: p.shownYaw });
  }
  return out;
}

test('STAND-LIFE the stir: a body standing holds the way it faces on STAND_FRAME, and every IDLE_EVERY_S (3-7 s, its own) it stirs - a glance aside of IDLE_GLANCE_YAW to one side for IDLE_GLANCE_S, or a shift of weight through IDLE_SHIFT_FRAMES at IDLE_SHIFT_FPS - and comes back to its stand; never the idle record (the politeness gate\'s alone) (mutants: the stir unrun, the glance unturned, the shift unstepped, the rhythm, the return)', () => {
  assert.deepEqual([IDLE_EVERY_S[0], IDLE_EVERY_S[1], IDLE_GLANCE_S, IDLE_GLANCE_YAW, IDLE_SHIFT_FPS, [...IDLE_SHIFT_FRAMES]], [3, 7, 1.6, 0.7, 3, [1, 2, 1]]);
  const p = body();
  p._talkSeed = 4242;
  const o = mobileOrientation(p.yaw, p.pos, EYE);
  const frames = stand(p, 60);
  const kinds = new Set(), starts = [];
  let last = null;
  for (const f of frames) {
    assert.notEqual(f.record, PERSON_IDLE_RECORD, 'never the idle record unasked');
    if (f.stir && f.stir !== last) { kinds.add(f.stir); starts.push(f.t); }
    if (!f.stir) assert.deepEqual([f.record, f.frame, f.flip], [MOVE_RECORDS[o], STAND_FRAME, MOVE_FLIPS[o]], `${f.t.toFixed(2)} s: their stand`);
    if (f.stir === 'glance') {
      assert.ok(Math.abs(Math.abs(f.shown - p.yaw) - IDLE_GLANCE_YAW) < 1e-9, 'aside by the glance');
      const g = mobileOrientation(f.shown, p.pos, EYE);
      assert.deepEqual([f.record, f.flip], [MOVE_RECORDS[g], MOVE_FLIPS[g]], 'drawn the way they glance');
    }
    if (f.stir === 'shift') { assert.equal(f.record, MOVE_RECORDS[o], 'a shift on their own facing'); assert.ok(IDLE_SHIFT_FRAMES.includes(f.frame), `a shift's step (${f.frame})`); }
    last = f.stir;
  }
  assert.deepEqual([...kinds].sort(), ['glance', 'shift'], 'both stirs in a minute');
  assert.ok(starts.length >= 60 / (IDLE_EVERY_S[1] + IDLE_GLANCE_S) - 1 && starts.length <= 60 / IDLE_EVERY_S[0] + 1, `${starts.length} stirs in a minute`);
  assert.ok(starts[0] >= IDLE_EVERY_S[0] - 1e-9, 'the first after a stand of its own');
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= IDLE_EVERY_S[0] - 1e-6, 'never two at once');
  // the shift steps through its frames at its pace, then stands
  const sh = frames.findIndex((f) => f.stir === 'shift');
  const run = [];
  for (let i = sh; i < frames.length && frames[i].stir === 'shift'; i++) run.push(frames[i].frame);
  assert.deepEqual([...new Set(run)], [1, 2], 'one, two, one');
  assert.ok(Math.abs(run.length / 30 - IDLE_SHIFT_FRAMES.length / IDLE_SHIFT_FPS) < 0.05, `the shift's length (${run.length} frames)`);
  const gl = frames.findIndex((f) => f.stir === 'glance');
  let n = 0;
  for (let i = gl; i < frames.length && frames[i].stir === 'glance'; i++) n++;
  assert.ok(Math.abs(n / 30 - IDLE_GLANCE_S) < 0.05, `the glance's length (${n} frames)`);
});

test('STAND-LIFE the rhythm is the body\'s own: off its talk seed once it is someone - the same seed stirs alike, two seeds apart, two bodies made together never as one; a walk or the politeness gate ends a stir and starts the stand\'s clock again (mutants: the seed unread, the bodies alike, the reset)', () => {
  const a = body(), b = body(), c = body(), d = body();
  a._talkSeed = 77; b._talkSeed = 77; c._talkSeed = 78;
  const sig = (p) => stand(p, 40).map((f) => f.stir ?? '-').join('');
  assert.equal(sig(a), sig(b), 'one seed, one rhythm');
  const sc = sig(c), sd = sig(d), se = sig(body());
  assert.notEqual(sig(Object.assign(body(), { _talkSeed: 77 })), sc, 'another seed, another');
  assert.notEqual(sd, se, 'two made together, unseeded: apart');
  const w = body();
  w._talkSeed = 77;
  stand(w, 4.2);
  w.moving = true;
  w.update(1 / 30, EYE, false);
  assert.equal(w.stir, null, 'walking: no stir');
  w.moving = false;
  const again = stand(w, IDLE_EVERY_S[0] - 0.1);
  assert.ok(again.every((f) => !f.stir), 'a fresh stand waits its own time');
  const g = stand(body({}), 2, true);
  assert.ok(g.every((f) => f.record === PERSON_IDLE_RECORD && !f.stir), 'the gate: turned to the player, no stir');
});

test('STAND-LIFE the still pictures: only those that move (MOVING_STILLS - a merchant\'s two, a priest\'s one, the court\'s four); a beggar at their pitch, a labourer and a fisher at their stint, a crafter at their stall and a woman of the market or the temple keep themselves (mutants: the filter off, the none)', () => {
  assert.equal(MOVING_STILLS.size, 7);
  const R = (id, o) => ({ id, name: id, sex: 'male', job: 'labourer', cls: null, work: null, faction: 0, ...o });
  for (const [job, kind] of [['beggar', 'beg'], ['labourer', 'stall'], ['fisher', 'stall'], ['crafter', 'stall']]) {
    for (const sex of ['male', 'female']) {
      const r = R(`L9.${job}${sex}`, { job, sex });
      const role = stillRoleOf(r, { kind, at: null });
      assert.ok(role, `${job}: a kind of their own`);
      assert.equal(stillFlatOf(r, /** @type {any} */ (role)), null, `${job} ${sex}: themselves`);
    }
  }
  assert.equal(stillFlatOf(R('L9.m', { job: 'merchant', sex: 'female' }), 'merchant'), null, 'a woman of the market: herself');
  assert.equal(stillFlatOf(R('L9.p', { job: 'priest', sex: 'female' }), 'priest'), null, 'a priestess: herself');
  const m = stillFlatOf(R('L9.n', { job: 'merchant', sex: 'male' }), 'merchant');
  assert.ok(m && MOVING_STILLS.has(`${m.archive}.${m.record}`), 'a merchant: one that moves');
});

test('STAND-LIFE on the street: of those standing in view at the square through a minute of the afternoon, none is drawn one way the whole time - every stand of ten seconds and more shows two pictures at the least (mutants: the stir unrun on the street)', () => {
  const fx = synthTown({ blocksW: 4, blocksH: 4 });
  const clock = { t: 100 * DAY_MIN + 16 * 60 };
  const lt = new LivingTown(fx.nav, {
    town: { mapId: 24680, blocks: 16, region: 17, people: 3, port: false }, buildings: fx.buildings, doors: fx.doors,
    makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE,
  });
  const sq = lt.places.square;
  const at = [sq.x, 0, sq.z];
  /** @type {Map<any, { since: number, looks: Set<string> }>} */
  const standing = new Map();
  let long = 0, still = 0;
  const close = (p, s, t) => { if (t - s.since >= 10) { long++; if (s.looks.size < 2) still++; } standing.delete(p); };
  for (let i = 0; i < 60 * 30; i++) {
    clock.t += RATE / 30;
    const seats = lt.update(1 / 30, at, 0, [at[0], 1.6, at[2]], true);
    const now = new Set();
    for (const s of seats) {
      const p = s.person;
      if (p.moving || p.armed || p.stillLook) { const was = standing.get(p); if (was) close(p, was, i / 30); continue; }
      now.add(p);
      const was = standing.get(p) ?? { since: i / 30, looks: new Set() };
      was.looks.add(`${s.out.record}.${s.out.frame}.${s.out.flip}`);
      standing.set(p, was);
    }
    for (const [p, s] of [...standing]) if (!now.has(p)) close(p, s, i / 30);
  }
  for (const [p, s] of [...standing]) close(p, s, 60);
  assert.ok(long >= 5, `stands of ten seconds and more (${long})`);
  assert.equal(still, 0, `${still} of ${long} stood one way`);
});
