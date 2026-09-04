// M3-slice (AUDIT 23 motor-3): CLIMBING - ClimbingMotor's classic
// path. The chance/speed formulas, the check machine's cadences and
// quirks, and a LIVE climb up a real wall through the motor+collider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  climbingChance, climbingSpeed, ClimbingState,
  START_CLIMB_MIN_CHANCE, CONTINUE_CLIMB_MIN_CHANCE, REGAIN_HOLD_MIN_CHANCE, GRASP_WALL_MIN_CHANCE,
  START_CLIMB_SKILL_CHECK_FREQUENCY, CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY, REGAIN_HOLD_SKILL_CHECK_FREQUENCY,
} from '../src/player/climbing.js';
import { PlayerMotor, SYSTEM_TIMER_UPDATES_DIVISOR, walkSpeed } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const DIV = SYSTEM_TIMER_UPDATES_DIVISOR;

test('climbing: CalculateClimbingChance verbatim - lerps, the Khajiit +30, the 5..95 clamp', () => {
  // (int)(Lerp(base,100,skill/100) + Lerp(0,10,luck/100))
  assert.equal(climbingChance(70, 50, 50), 90, '70 + 30*0.5 + 5');
  assert.equal(climbingChance(50, 40, 0), 70, 'no luck term at 0');
  // Khajiit racial: skill 20 + 30 = 50
  assert.equal(climbingChance(70, 20, 50, { khajiit: true }), 90);
  // the clamp floor: skill 0 -> 5
  assert.equal(climbingChance(70, 0, 0), Math.trunc(70 + 30 * 0.05));
  // the clamp ceiling: an inflated skill reads 95 (and Lerp clamps luck's t at 1)
  assert.equal(climbingChance(70, 200, 150), Math.trunc(70 + 30 * 0.95 + 10));
  // the Climbing effect doubles BEFORE the clamp
  assert.equal(climbingChance(70, 40, 0, { enhanced: true }), Math.trunc(70 + 30 * 0.8));
  // GetClimbingSpeed: baseSpeed/3, x2 enhanced
  assert.equal(climbingSpeed(4.5), 1.5);
  assert.equal(climbingSpeed(4.5, true), 3);
});

const ctx = (over = {}) => ({
  forward: true, back: false, anyMove: true, falling: false, grounded: true,
  levitating: false, riding: false, touchingSides: true, horizontalPos: [0, 0],
  tooCloseToGround: () => false, ...over,
});

test('climbing: the start countdown, the fail-retry-per-frame quirk, the grasp reset', () => {
  let tallies = 0;
  let roll = 0.99;   // fails any chance < 100
  const said = [];
  const cs = new ClimbingState({ tally: () => tallies++, inputs: () => ({ climbing: 50, luck: 0 }), rolls: () => roll, say: (m) => said.push(m) });
  const dt = 1 / 60;
  // hold forward against the wall: no check until 14 units accrue -
  // the timer increments while its ENTRY value is <= DIV*14, so the
  // pure-countdown step count is floor(threshold/dt) + 1
  const steps = Math.floor((DIV * START_CLIMB_SKILL_CHECK_FREQUENCY) / dt) + 1;
  for (let i = 0; i < steps; i++) cs.step(dt, ctx());
  assert.equal(tallies, 0, 'the countdown draws no checks');
  assert.equal(cs.isClimbing, false);
  // past the timer: a FAILED ground start re-checks EVERY step - the
  // timer is NOT reset (:430-433, the verbatim tally-spam quirk)
  cs.step(dt, ctx());
  cs.step(dt, ctx());
  cs.step(dt, ctx());
  assert.equal(tallies, 3, 'one tally per step once the timer is past (TallySkill rides every check)');
  assert.equal(cs.isClimbing, false);
  // the roll turns: the very next step climbs (no new countdown)
  roll = 0;
  cs.step(dt, ctx());
  assert.equal(cs.isClimbing, true);
  // ClimbingMotor.cs:601-605 pushes the HUD line once an attempt, and
  // AddHUDText is handed `climbingMode` verbatim - the ROW's two
  // words (Internal_Strings.csv:371), written out rather than read
  // back through the constant the source uses.
  assert.deepEqual(said, ['Climbing mode.'], 'the climbingMode HUD line, once');
  cs.step(dt, ctx());
  assert.deepEqual(said, ['Climbing mode.'], 'and only once per attempt (:601-605)');
  // the airborne GRASP is different: a fail RESETS the timer (:434-437)
  roll = 0.99;
  const grasp = new ClimbingState({ tally: () => {}, inputs: () => ({ climbing: 50, luck: 0 }), rolls: () => roll });
  for (let i = 0; i < steps + 1; i++) grasp.step(dt, ctx({ falling: true, grounded: false }));   // countdown + the failed 40% grasp check
  assert.equal(grasp.isClimbing, false);
  assert.equal(grasp.startTimer, 0, 'the failed mid-air grasp starts the countdown over');
});

test('climbing: the continue/slip cadences - slip at 15 units, regain at 5, stand-still clears', () => {
  let roll = 0;
  const rolls = () => roll;
  const cs = new ClimbingState({ tally: () => {}, inputs: () => ({ climbing: 50, luck: 0 }), rolls });
  const dt = 1 / 60;
  const run = (n, c) => { for (let i = 0; i < n; i++) cs.step(dt, c); };
  const units = (u) => Math.ceil((DIV * u) / dt) + 2;
  run(units(START_CLIMB_SKILL_CHECK_FREQUENCY) + 1, ctx());
  assert.equal(cs.isClimbing, true);
  // off the ground now (a slip while GROUNDED aborts via
  // slippedToGround - that abort is test 4's case)
  const air = { grounded: false };
  // fail the 15-unit continue check -> slipping
  roll = 0.99;
  run(units(CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY), ctx(air));
  assert.equal(cs.isSlipping, true, 'the failed continue check slips');
  assert.equal(cs.isClimbing, true, 'slipping is still climbing');
  // the regain runs on the FASTER 5-unit cadence and succeeds
  roll = 0;
  run(units(REGAIN_HOLD_SKILL_CHECK_FREQUENCY), ctx(air));
  assert.equal(cs.isSlipping, false, 'the regain-hold check reclaims the wall');
  // slip again, then STAND STILL: the cadence clears the slip with no roll
  roll = 0.99;
  run(units(CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY), ctx(air));
  assert.equal(cs.isSlipping, true);
  run(units(REGAIN_HOLD_SKILL_CHECK_FREQUENCY), ctx({ grounded: false, anyMove: false }));
  assert.equal(cs.isSlipping, false, '"don\'t allow slipping if not moving" (:449-454)');
  assert.equal(cs.isClimbing, true);
});

test('climbing: the abort ladder and the water forgiveness', () => {
  const mk = (extra = {}) => new ClimbingState({ tally: () => {}, inputs: () => ({ climbing: 50, luck: 0 }), rolls: () => 0, ...extra });
  const dt = 1 / 60;
  const climbUp = (cs) => { for (let i = 0; i < Math.ceil((DIV * 14) / dt) + 3; i++) cs.step(dt, ctx()); assert.equal(cs.isClimbing, true); };
  // releasing forward aborts (the classic abort key :332)
  const a = mk(); climbUp(a);
  a.step(dt, ctx({ forward: false }));
  assert.equal(a.isClimbing, false);
  // losing the wall aborts
  const b = mk(); climbUp(b);
  b.step(dt, ctx({ touchingSides: false }));
  assert.equal(b.isClimbing, false);
  // a slip that reaches the ground aborts
  const c = mk(); climbUp(c);
  c.isSlipping = true;
  c.step(dt, ctx({ grounded: true }));
  assert.equal(c.isClimbing, false);
  // a start that drifts past the 0.12 tolerance aborts the countdown
  const d = mk();
  d.step(dt, ctx());
  d.step(dt, ctx({ horizontalPos: [0.5, 0] }));
  assert.equal(d.startTimer, 0, 'nonOrthogonalStart resets the countdown');
  // UNDERWATER a failed roll is forgiven ("Water makes it easier to
  // climb", :837-843) - the climb starts on a hopeless roll
  const w = mk({ rolls: () => 0.999, waterForgiven: () => true });
  climbUp(w);
});

test('climbing M3 LIVE: the motor climbs a real wall, and the release falls from the top', () => {
  const col = new Collider(() => -100);
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  // floor y=0
  col.addMesh('floor', new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), [0, 1, 2, 0, 2, 3], I);
  // wall at z=0.4, 6 high, facing the player
  col.addMesh('wall', new Float32Array([-5, 0, 0.4, 5, 0, 0.4, 5, 6, 0.4, -5, 6, 0.4]), [0, 1, 2, 0, 2, 3], I);
  let tallies = 0;
  let said = 0;
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => tallies++, rolls: () => 0, say: () => said++ },
  });
  m.spawn(0, 0.02, 0);
  const fwd = { forward: 1, strafe: 0, run: false, jump: false };
  for (let i = 0; i < 60; i++) m.update(1 / 30, fwd, 0);   // 2 s pushing the wall
  assert.equal(m.climb.isClimbing, true, 'the countdown + check started the climb');
  assert.ok(m.pos[1] > 0.5, `the capsule ROSE up the wall (y=${m.pos[1].toFixed(2)})`);
  assert.ok(tallies >= 1, 'the Climbing skill tallied');
  assert.equal(said, 1, 'the climbingMode line spoke once for the attempt');
  const topY = m.pos[1];
  // release: the climb stops and the fall anchors at the RELEASE
  // height (acrobat.Falling = isSlipping while hugging)
  const idle = { forward: 0, strafe: 0, run: false, jump: false };
  let landed = 0;
  for (let i = 0; i < 90 && !landed; i++) { m.update(1 / 30, idle, 0); if (m.landedFallDistance > 0) landed = m.landedFallDistance; }
  assert.equal(m.climb.isClimbing, false);
  assert.ok(m.grounded, 'the drop landed');
  assert.ok(Math.abs(landed - topY) < 0.6, `the fall billed from the release height (landed=${landed.toFixed(2)} vs top=${topY.toFixed(2)})`);
});

test('X3 climbing LIVE: the Climbing SPELL doubles the climb SPEED, not just the skill check', () => {
  // PlayerSpeedChanger.GetClimbingSpeed reads player.IsEnhancedClimbing
  // at the move (:424-431) - the port called climbingSpeed with one
  // argument, so the spell's speed half was dead and only the skill
  // check doubled. Both walls, both climbs, one difference.
  const wall = (enhanced) => {
    const col = new Collider(() => -100);
    const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    col.addMesh('floor', new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), [0, 1, 2, 0, 2, 3], I);
    col.addMesh('wall', new Float32Array([-5, 0, 0.4, 5, 0, 0.4, 5, 40, 0.4, -5, 40, 0.4]), [0, 1, 2, 0, 2, 3], I);
    const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
      climbing: { inputs: () => ({ climbing: 50, luck: 50, enhanced }), tally: () => {}, rolls: () => 0, say: () => {} },
    });
    m.spawn(0, 0.02, 0);
    const fwd = { forward: 1, strafe: 0, run: false, jump: false };
    for (let i = 0; i < 60; i++) m.update(1 / 30, fwd, 0);
    assert.equal(m.climb.isClimbing, true);
    return m.pos[1];
  };
  const plain = wall(false);
  const spelled = wall(true);
  assert.ok(plain > 0.5, `the unbuffed climb rose (y=${plain.toFixed(2)})`);
  // the climb starts on the same frame in both runs (rolls() => 0
  // passes every check), so the whole difference is the x2 speed
  assert.ok(spelled > plain * 1.8,
    `the spell climbs about twice as fast (plain=${plain.toFixed(2)} spelled=${spelled.toFixed(2)})`);
  assert.ok(spelled < plain * 2.2, 'about twice - not some other multiplier');
});
