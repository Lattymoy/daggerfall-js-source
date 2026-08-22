// AUDIT 24 (the full-codebase parity sweep), player group: the water
// line the port measured from the wrong capsule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, CAPSULE_HEIGHT, CROUCH_HEIGHT } from '../src/player/motor.js';

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
    assert.ok(call.slice(0, call.indexOf(';')).endsWith(', player.height)'),
      `${f}: and hands that height to the breath/ambience pass`);
  }
  const dc = rd('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/playerHeight \/ 2 \+ 76 \* 0\.025 - 0\.95/g) ?? []).length, 2,
    'both submerged tests read the threaded height');
  assert.equal(/\+ 0\.9 \+ 76 \* 0\.025/.test(dc), false, 'and no standing constant is left behind');
});
