// AUDIT 24 (the full-codebase parity sweep), player group: the water
// line the port measured from the wrong capsule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, CAPSULE_HEIGHT, CROUCH_HEIGHT, LEVITATE_MOVE_SPEED } from '../src/player/motor.js';

const DT = 1 / 60;
const noInput = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const floatUp = { ...noInput, up: true };

test('audit24 player: the swim surface clamp reads the LIVE capsule centre', () => {
  // LevitateMotor.cs:126 - `controller.transform.position.y + (50 *
  // GlobalScale) - 0.93f >= blockWaterLevel * -1 * GlobalScale`.
  // transform.position is the capsule CENTRE, and
  // PlayerHeightChanger.ControllerHeightChange (:477-478) keeps the
  // feet planted through a height change, so the centre is
  // feet + controller.height/2. A free swimmer is force-crouched
  // (:192-198), i.e. 0.9 tall, so the offset is 0.45 - the port
  // hardcoded the STANDING 0.9 and pinned the swimmer 0.45 too deep.
  const moves = [];
  const rec = { move(pos, dx, dy, dz) { pos[0] += dx; pos[1] += dy; pos[2] += dz; moves.push([dx, dy, dz]); return { grounded: false }; } };
  const p = new PlayerMotor(rec);
  p.spawn(0, 0, 0);
  p.swimming = true;
  p.waterSurfaceY = 100;
  assert.equal(p.height, CAPSULE_HEIGHT, 'starts standing');
  for (let i = 0; i < 60; i++) p.update(DT, noInput, 0, 0);   // past the medium timer
  assert.equal(p.crouching, true, 'the forced swim crouch completed');
  assert.equal(p.height, CROUCH_HEIGHT);
  // DFU's float point: feet + 0.45 + 1.25 - 0.93 >= 100 -> feet >= 99.23
  moves.length = 0;
  p.pos[1] = 99.30;
  p.update(DT, floatUp, 0, 0);
  assert.equal(moves[0][1], 0, 'at the DFU float point the rise is refused');
  moves.length = 0;
  p.pos[1] = 99.10;
  p.update(DT, floatUp, 0, 0);
  assert.ok(moves[0][1] > 0,
    'below it he still rises - the old feet+0.9 line stopped him 0.45 short of the surface');

  // AUDIT 24, the mutation campaign: the two constants in that line
  // were both live mutants, because 99.30 and 99.10 sit far enough
  // either side of the float point that a small shift moves nothing.
  // The boundary is derived, not guessed:
  //     feet + height/2 + 50 * GlobalScale - 0.93 >= surface
  const surface = 100;
  const boundary = surface - CROUCH_HEIGHT / 2 - 50 * 0.025 + 0.93;   // 99.23
  const rises = (feet) => {
    moves.length = 0;
    p.pos[1] = feet;
    p.update(DT, floatUp, 0, 0);
    return moves[0][1] > 0;
  };
  assert.equal(rises(boundary), false, 'AT the float point the rise is refused');
  assert.equal(rises(boundary - 0.01), true, 'and a centimetre below it he rises');
  // AN HONEST NON-KILL: the campaign also flips that `>=` to `>`, and
  // this harness cannot witness it. The two differ only when the sum
  // lands EXACTLY on the surface - one float wide - and at that point
  // the rise measures zero either way through the motor's public
  // update. The constant above is the mutant that mattered and it
  // dies; this one is recorded rather than chased.
  assert.equal(boundary + CROUCH_HEIGHT / 2 + 50 * 0.025 - 0.93, surface,
    'the derived boundary really is exact - the >= arm is reachable, just not distinguishable here');
  // 50 is GlobalScale's own multiplier: at 51 the float point moves
  // 0.025 DOWN, and this is the band that separates them
  const at51 = surface - CROUCH_HEIGHT / 2 - 51 * 0.025 + 0.93;      // 99.205
  assert.ok(at51 < boundary);
  assert.equal(rises((at51 + boundary) / 2), true,
    'between the two float points he still rises - a 51 here would have stopped him early');
});

test('audit24 player: every water line in the hosts measures the same live centre', () => {
  // PlayerEnterExit.cs:382 (the swim toggle, +50*GS) and :407 (the
  // submerged/breath test, +76*GS) read the same
  // player.transform.position.y. If the toggle kept the standing
  // constant while the clamp went live, a surfacing swimmer would
  // un-swim, stand up, sink, and swim again - the port's two halves
  // have to move together.
  const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(f), /player\.pos\[1\] \+ player\.height \/ 2 \+ 50 \* 0\.025 - 0\.95 < surf/,
      `${f}: the swim toggle rides the live capsule`);
    const call = rd(f).slice(rd(f).indexOf('drawFoes(dt, canvas, proj, view, cam.pos, player.pos,'));
    // MW-D15 added a trailing sneak argument, so the test is that the
    // height is THERE and live, not that it is last.
    assert.ok(call.slice(0, call.indexOf(';')).includes(', player.height'),
      `${f}: and hands that height to the breath/ambience pass`);
  }
  const dc = rd('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/playerHeight \/ 2 \+ 76 \* 0\.025 - 0\.95/g) ?? []).length, 2,
    'both submerged tests read the threaded height');
  assert.equal(/\+ 0\.9 \+ 76 \* 0\.025/.test(dc), false, 'and no standing constant is left behind');
});

test('audit24 player: AddMovement\'s three arms, in DFU\'s order', () => {
  // LevitateMotor.cs:116-140. The water-walking arm is FIRST and
  // unconditional on levitation, and it RETURNS - no surface clamp.
  // The swim arm is `playerSwimming && !playerLevitating`. Levitate
  // speed is only what moveSpeed falls back to when neither arm ran.
  const mk = () => {
    const moves = [];
    const rec = { move(pos, dx, dy, dz) { pos[0] += dx; pos[1] += dy; pos[2] += dz; moves.push([dx, dy, dz]); return { grounded: false }; } };
    const p = new PlayerMotor(rec, { speed: 50, running: 30, swimming: 30 });
    p.spawn(0, 0, 0);
    return { p, moves };
  };
  const fwd = { ...noInput, forward: 1 };
  const horiz = (m) => Math.hypot(m[0], m[2]);
  // 1. swimming + water walking: PlayerMotor.Speed, the STALE field -
  //    NOT a recomputation from this frame's run key.
  const a = mk();
  a.p.swimming = true; a.p.waterWalking = true;
  a.p.speed = 2.5;                      // whatever the last grounded frame wrote
  // AUDIT 39 (#57): the swim/levitate EDGE raises CancelMovement
  // (LevitateMotor :151/:159/:174/:182), and FixedUpdate spends one
  // whole step on the cancel block (:286-294) before the mode moves
  // anything - so the mode's first move is the SECOND step.
  a.p.update(DT, fwd, 0, 0); a.moves.length = 0;
  a.p.update(DT, fwd, 0, 0);
  assert.ok(Math.abs(horiz(a.moves[0]) - 2.5 * DT) < 1e-6, 'the frozen field, not walkSpeed');
  // ...and pressing run mid-swim changes nothing, because the field is
  // only written on a grounded frame.
  a.moves.length = 0;
  a.p.update(DT, { ...fwd, run: true }, 0, 0);
  assert.ok(Math.abs(horiz(a.moves[0]) - 2.5 * DT) < 1e-6, 'the run key cannot reach it');
  // 2. water walking WINS over levitation - DFU tests it first
  const b = mk();
  b.p.swimming = true; b.p.waterWalking = true; b.p.levitating = true;
  b.p.speed = 3.0;
  b.p.update(DT, fwd, 0, 0); b.moves.length = 0;   // the cancelMovement step (AUDIT 39 #57)
  b.p.update(DT, fwd, 0, 0);
  assert.ok(Math.abs(horiz(b.moves[0]) - 3.0 * DT) < 1e-6,
    'not the 4.0 levitate constant - the port used to short-circuit here');
  // 3. levitating, not swimming: the levitate constant
  const c = mk();
  c.p.levitating = true;
  c.p.speed = 3.0;
  c.p.update(DT, fwd, 0, 0); c.moves.length = 0;   // the cancelMovement step (AUDIT 39 #57)
  c.p.update(DT, fwd, 0, 0);
  assert.ok(Math.abs(horiz(c.moves[0]) - LEVITATE_MOVE_SPEED * DT) < 1e-6);
  // ...and the water-walking arm takes NO surface clamp: it returns
  // above it, so a water-walking swimmer can rise past the float point.
  const d = mk();
  d.p.swimming = true; d.p.waterWalking = true; d.p.speed = 3.0;
  d.p.waterSurfaceY = 1;
  d.p.pos[1] = 0.9;                     // well past the clamp threshold
  d.p.update(DT, floatUp, 0, 0); d.moves.length = 0;   // the cancelMovement step (AUDIT 39 #57)
  d.p.update(DT, floatUp, 0, 0);
  assert.ok(d.moves[0][1] > 0, 'the clamp lives inside the OTHER arm');
});
