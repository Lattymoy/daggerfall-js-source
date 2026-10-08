// SD7a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE UNMOORED STEPS' LAW
// (world/sdSteps.js) - the course from the Orrery's first step to the Last Moment's arena: the Drift, the Beat and the
// Crumble, their checkpoints, how each step moves on the realm's clock, the Warp's breath, and the void's cast-back.
// Its fairness is pinned to the engine's own numbers (player/motor.js, player/parkour.js), not to the design's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SD_STEPS_COURSE, SD_CHECKPOINTS, SD_COURSE_END, SD_STEPS_FREE, SD_VOID_Y, SD_CAST_BACK_LOSS, SD_RISER_H, SD_STEP_THICK,
  SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_BEAT_HALF, SD_BEAT_BLINK, SD_CRUMBLE_DELAY, SD_CRUMBLE_BACK, SD_CRUMBLE_FALL_G,
  SD_GUST_EVERY, SD_GUST_FOR, SD_GUST_SPEED, SD_GUST_WARN, stepAt, beatStands, beatBlinks, crumbleAfter, gustAt, inBreath,
  inVoid, castBackTo, spanAt,
} from '../src/world/sdSteps.js';
import { SD_ARENA, SD_STEPS } from '../src/net/sdBrain.js';
import { SD_FIRST_STEP } from '../src/world/sdHall.js';
import { runSpeed, JUMP_SPEED, GRAVITY, JUMP_FWD_BOOST, CAPSULE_RADIUS, FALL_DAMAGE_THRESHOLD } from '../src/player/motor.js';
import { wallRunHeight, PARKOUR_REACH_MIN } from '../src/player/parkour.js';

const near = (s) => s.z - s.d / 2, far = (s) => s.z + s.d / 2;
/** The course in order: A, the steps and B, C where they fall, then the arena's near edge. */
function walk() {
  const out = [{ kind: 'check', y: 0, near: SD_CHECKPOINTS[0].z - SD_CHECKPOINTS[0].r, far: SD_CHECKPOINTS[0].z + SD_CHECKPOINTS[0].r }];
  for (const s of SD_STEPS_COURSE) {
    for (const c of SD_CHECKPOINTS.slice(1)) if (c.z < s.z && out.every((o) => o.c !== c)) out.push({ kind: 'check', c, y: c.y, near: c.z - c.r, far: c.z + c.r });
    out.push({ kind: s.kind, s, y: s.y, near: near(s), far: far(s) });
  }
  out.push({ kind: 'arena', y: 0, near: SD_ARENA.z - SD_ARENA.r, far: SD_ARENA.z + SD_ARENA.r });
  return out;
}
/** A plain running jump's flight (m) - the reference build's: an endgame character of modest athletics (Speed 40,
 *  Running 20, Jumping 0), taken at 95% of the closed form (the motor's fixed step flies a little shorter). */
const PLAIN_LEAP = (runSpeed(40, 20) + JUMP_SPEED * JUMP_FWD_BOOST) * ((2 * JUMP_SPEED) / GRAVITY) * 0.95;

test('SD7a THE COURSE: from the first step (A) to the arena, three spans - eight Drift steps, seven Beat steps and two risers, eight Crumble steps - with B and C before the Beat and the Crumble; laid end to end along +z, ending at the arena\'s near edge, all inside the Steps\' span (mutants: a step out of the line; the course short of the arena)', () => {
  const kinds = SD_STEPS_COURSE.map((s) => s.kind);
  assert.equal(kinds.filter((k) => k === 'drift').length, 8);
  assert.equal(kinds.filter((k) => k === 'beat').length, 7);
  assert.equal(kinds.filter((k) => k === 'riser').length, 2);
  assert.equal(kinds.filter((k) => k === 'crumble').length, 8);
  assert.deepEqual(SD_STEPS_COURSE.map((s) => s.span), kinds.map((k) => (k === 'drift' ? 0 : k === 'crumble' ? 2 : 1)));
  assert.equal(SD_CHECKPOINTS.length, 3);
  assert.deepEqual([SD_CHECKPOINTS[0].x, SD_CHECKPOINTS[0].z, SD_CHECKPOINTS[0].r], [SD_FIRST_STEP.x, SD_FIRST_STEP.z, SD_FIRST_STEP.r], 'A is the first step');
  const path = walk();
  for (let k = 1; k < path.length; k++) assert.ok(path[k].near >= path[k - 1].far - 1e-9, `${k}: in order along +z`);
  assert.ok(Math.abs(SD_COURSE_END - (SD_ARENA.z - SD_ARENA.r)) < 1e-6, 'the course ends at the arena\'s near edge');
  assert.ok(SD_STEPS.z0 <= SD_CHECKPOINTS[0].z && SD_COURSE_END <= SD_STEPS.z1 + 1e-6, 'inside the Steps\' span');
  for (const s of SD_STEPS_COURSE) assert.equal(s.x, 0, 'on the course\'s line at rest');
  assert.equal(SD_STEP_THICK, 0.6);
});

test('SD7a FAIR TO THE ENGINE: every gap a jump (2.4 m at least) and no more than a modest build\'s plain running jump at Jumping 0 (the motor\'s own speeds and gravity); every riser rises against the step before it, past any jump and inside every wall run\'s reach at skill 0; every step down well short of a fall\'s damage (mutants: a gap past the jump; a riser too tall to run; a riser one can jump)', () => {
  const path = walk();
  assert.ok(PLAIN_LEAP > 3 && PLAIN_LEAP < 3.4, `the reference jump flies ${PLAIN_LEAP.toFixed(2)} m`);
  for (let k = 1; k < path.length; k++) {
    const p = path[k], prev = path[k - 1], gap = p.near - prev.far;
    if (p.kind === 'riser') {
      assert.ok(Math.abs(gap) < 1e-9, 'a riser stands against the step before it');
      assert.ok(Math.abs(p.y - prev.y - SD_RISER_H) < 1e-9, 'a riser high above it');
      continue;
    }
    assert.ok(gap >= 2.4 - 1e-9, `${k} (${p.kind}): ${gap.toFixed(2)} m needs a jump`);
    assert.ok(gap <= PLAIN_LEAP + CAPSULE_RADIUS, `${k} (${p.kind}): ${gap.toFixed(2)} m inside the reference jump`);
    assert.ok(p.y <= prev.y + 1e-9, `${k}: never a step up but a riser`);
    assert.ok(prev.y - p.y < 1, `${k}: a step down well short of a hard fall`);
  }
  assert.ok(FALL_DAMAGE_THRESHOLD > 1);
  const highest = (JUMP_SPEED * 1.5) ** 2 / (2 * GRAVITY);   // Jumping 100's rise, a skill's best (a Jump spell's is more - magic is a way up too)
  assert.ok(SD_RISER_H > highest + 0.5, 'past any skill\'s jump: run, climb, or cast');
  assert.ok(SD_RISER_H <= wallRunHeight(0, 0) + PARKOUR_REACH_MIN, 'inside the wall run\'s reach at skill 0');
});

test('SD7a THE DRIFT: each step swings across the line, 1 to 2 m either way, once in 4 to 7 s, each its own phase - back where it was a period on (mutants: a swing past 2 m; a step standing still)', () => {
  const drift = SD_STEPS_COURSE.filter((s) => s.kind === 'drift');
  for (const s of drift) {
    assert.ok(s.amp >= 1 && s.amp <= 2, `${s.i} swings ${s.amp} m`);
    assert.ok(s.period >= 4 && s.period <= 7);
    const t = 1_800_000_123.25;
    const a = stepAt(s, t), b = stepAt(s, t + s.period);
    assert.ok(Math.abs(a[0] - b[0]) < 1e-5 && a[1] === s.y && a[2] === s.z, 'a period on, where it was');
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 200; k++) { const x = stepAt(s, t + (k / 200) * s.period)[0]; lo = Math.min(lo, x); hi = Math.max(hi, x); }
    assert.ok(Math.abs(hi - s.amp) < 0.02 && Math.abs(lo + s.amp) < 0.02, 'its full swing');
  }
  assert.equal(new Set(drift.map((s) => s.phase)).size, drift.length, 'each its own phase');
  for (const s of SD_STEPS_COURSE.filter((x) => x.kind !== 'drift')) assert.deepEqual(stepAt(s, 12.5), [s.x, s.y, s.z], 'the rest stand still');
});

test('SD7a THE BEAT: a step stands 2.4 s of every 3.6, alternate steps half a beat apart, blinking the last 0.4 s before it goes; the risers always stand (mutants: a step that never goes; all on one beat; no warning)', () => {
  assert.equal(SD_BEAT_CYCLE, 3.6); assert.equal(SD_BEAT_SOLID, 2.4); assert.equal(SD_BEAT_HALF, 1.8); assert.equal(SD_BEAT_BLINK, 0.4);
  const beats = SD_STEPS_COURSE.filter((s) => s.kind === 'beat');
  for (const [k, s] of beats.entries()) {
    assert.equal(s.beat, (k % 2) * SD_BEAT_HALF, 'alternate steps half a beat apart');
    let up = 0, blink = 0;
    const N = 3600;
    for (let j = 0; j < N; j++) { const t = 1_800_000_000 + (j / N) * SD_BEAT_CYCLE; if (beatStands(s, t)) up++; if (beatBlinks(s, t)) { blink++; assert.ok(beatStands(s, t), 'it blinks while it stands'); } }
    assert.ok(Math.abs(up / N - SD_BEAT_SOLID / SD_BEAT_CYCLE) < 0.002, 'solid two thirds of the beat');
    assert.ok(Math.abs(blink / N - SD_BEAT_BLINK / SD_BEAT_CYCLE) < 0.002);
  }
  // the moment the first goes, the second has stood 0.6 s
  const [b0, b1] = beats;
  assert.ok(!beatStands(b0, b0.beat + SD_BEAT_SOLID + 0.01) && beatStands(b1, b0.beat + SD_BEAT_SOLID + 0.01));
  assert.ok(beatBlinks(b0, b0.beat + SD_BEAT_SOLID - 0.1) && !beatBlinks(b0, b0.beat + SD_BEAT_SOLID - 0.5));
  for (const r of SD_STEPS_COURSE.filter((s) => s.kind === 'riser')) for (let t = 0; t < 8; t += 0.1) assert.ok(beatStands(r, t) && !beatBlinks(r, t));
});

test('SD7a THE CRUMBLE: a touched step shakes 0.7 s, falls under gravity, and stands whole again 5 s after it fell; untouched it stands (mutants: no shaking; never back)', () => {
  assert.equal(SD_CRUMBLE_DELAY, 0.7); assert.equal(SD_CRUMBLE_BACK, 5);
  assert.deepEqual(crumbleAfter(null), { drop: 0, whole: true, shaking: false });
  assert.deepEqual(crumbleAfter(0.3), { drop: 0, whole: true, shaking: true });
  const f = crumbleAfter(SD_CRUMBLE_DELAY + 1);
  assert.equal(f.whole, false); assert.ok(Math.abs(f.drop - 0.5 * SD_CRUMBLE_FALL_G) < 1e-9);
  assert.deepEqual(crumbleAfter(SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK + 0.01), { drop: 0, whole: true, shaking: false }, 'whole again');
  assert.ok(crumbleAfter(SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK - 0.01).drop > 100, 'well gone below the course before it comes back');
});

test('SD7a THE WARP\'S BREATH: a gust every 6 s, a second long, 3 m/s across - +x, then -x, by turns - its wind rising the second before; felt over the Crumble alone (mutants: the gust one way only; no warning; the breath over the Beat)', () => {
  assert.equal(SD_GUST_EVERY, 6); assert.equal(SD_GUST_FOR, 1); assert.equal(SD_GUST_SPEED, 3); assert.equal(SD_GUST_WARN, 1);
  const T = 1_800_000_000 - (1_800_000_000 % 12);   // a gust's start, an even one
  assert.deepEqual(gustAt(T + 0.5), { push: 3, warn: false });
  assert.deepEqual(gustAt(T + 2), { push: 0, warn: false });
  assert.deepEqual(gustAt(T + 5.5), { push: 0, warn: true });
  assert.deepEqual(gustAt(T + 6.5), { push: -3, warn: false }, 'the next the other way');
  const C = SD_CHECKPOINTS[2];
  assert.ok(!inBreath(C.z) && inBreath(C.z + C.r + 1) && inBreath(SD_COURSE_END - 0.5) && !inBreath(SD_COURSE_END + 1));
  assert.ok(!inBreath(SD_CHECKPOINTS[1].z + 10), 'not over the Beat');
});

test('SD7a THE VOID: below y -30 a body is cast back to its span\'s checkpoint - A over the Drift, B over the Beat, C over the Crumble - 15% of its health lost; the edge lets go from the first step to the arena (mutants: the void higher; cast back to the wrong stone)', () => {
  assert.equal(SD_VOID_Y, -30); assert.equal(SD_CAST_BACK_LOSS, 0.15);
  assert.ok(inVoid(-30.01) && !inVoid(-29.99));
  const [A, B, C] = SD_CHECKPOINTS;
  assert.equal(spanAt(A.z - A.r - 1), -1);
  assert.equal(spanAt(A.z), 0); assert.equal(spanAt(B.z - B.r - 0.1), 0);
  assert.equal(spanAt(B.z), 1); assert.equal(spanAt(C.z - C.r - 0.1), 1);
  assert.equal(spanAt(C.z), 2); assert.equal(spanAt(SD_COURSE_END - 1), 2);
  for (const s of SD_STEPS_COURSE) assert.equal(spanAt(s.z), s.span, `step ${s.i} in its span`);
  assert.deepEqual(castBackTo(0), [A.x, A.y, A.z]);
  assert.deepEqual(castBackTo(2), [C.x, C.y, C.z]);
  assert.deepEqual(castBackTo(-1), [A.x, A.y, A.z], 'before A, A');
  assert.ok(SD_STEPS_FREE.z0 > A.z && SD_STEPS_FREE.z0 < A.z + A.r, 'from just inside the first step\'s far edge');
  assert.ok(SD_STEPS_FREE.z1 > SD_ARENA.z - SD_ARENA.r && SD_STEPS_FREE.z1 < SD_ARENA.z, 'to just inside the arena\'s near edge');
});
