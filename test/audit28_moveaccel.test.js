import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MoveAxes, MOVE_ACCELERATION_CONST } from '../src/player/moveAxes.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W8: MOVEMENT ACCELERATION (InputManager.cs:1445-1497,
// wired at :432). The setting ships False; the port's hosts produced
// the movement axes as the bare held-key difference, so the setting sat
// stored. With it on, each axis climbs at 9.8/s toward +/-1 under a held
// key and friction decays it at 9.8/s toward 0 when its impulse was not
// raised; without it the axis IS the key.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const none = { forwards: false, backwards: false, left: false, right: false };

test('AUDIT 28 W8: OFF (the shipped default) - the axes are the held difference, exactly as before', () => {
  resetToDefaults();
  const a = new MoveAxes();
  assert.deepEqual(a.update(1 / 60, { ...none, forwards: true, right: true }), { forward: 1, strafe: 1 });
  assert.deepEqual(a.update(1 / 60, { ...none, backwards: true, left: true }), { forward: -1, strafe: -1 });
  assert.deepEqual(a.update(1 / 60, { ...none, forwards: true, backwards: true }), { forward: 0, strafe: 0 }, 'opposing keys: the neutral difference (DFU\'s "last wins" is keybind-order-dependent)');
  assert.deepEqual(a.update(1 / 60, none), { forward: 0, strafe: 0 }, '"just stop"');
});

test('AUDIT 28 W8: ON - the axis climbs at 9.8/s, clamps at 1, and friction decays it at 9.8/s to 0', () => {
  assert.equal(MOVE_ACCELERATION_CONST, 9.8);
  const a = new MoveAxes(); const dt = 1 / 60; const on = { acceleration: true };
  const r1 = a.update(dt, { ...none, forwards: true }, on);
  assert.ok(near(r1.forward, 9.8 / 60), `first frame ${r1.forward}`);
  assert.equal(r1.strafe, 0);
  let n = 1;
  while (a.update(dt, { ...none, forwards: true }, on).forward < 1 && n++ < 100) { /* climb */ }
  assert.equal(a.vertical, 1, 'clamped at 1');
  assert.ok(n >= 6 && n <= 8, `about 6.1 frames to full at 60fps, took ${n}`);
  // Release: friction, one step a frame, never past 0.
  const r2 = a.update(dt, none, on);
  assert.ok(near(r2.forward, 1 - 9.8 / 60));
  let m = 1;
  while (a.update(dt, none, on).forward > 0 && m++ < 100) { /* decay */ }
  assert.equal(a.vertical, 0, 'clamped at 0, not overshot negative');
  // Negative side, strafe.
  const b = new MoveAxes();
  b.update(0.5, { ...none, left: true }, on);
  assert.equal(b.horizontal, -1, 'a long frame clamps at -1');
  b.update(0.05, none, on);
  assert.ok(near(b.horizontal, -1 + 0.49));
});

test('AUDIT 28 W8: opposing keys with acceleration - both forces cancel and both impulses hold the axis where it is', () => {
  const a = new MoveAxes(); const on = { acceleration: true };
  a.update(0.05, { ...none, forwards: true }, on);   // 0.49
  const held = a.vertical;
  a.update(1 / 60, { ...none, forwards: true, backwards: true }, on);
  assert.ok(near(a.vertical, held), 'no net change, no friction');
  // A reversal under acceleration passes THROUGH zero rather than
  // snapping - and it moves TWO steps a frame while the axis is still
  // positive: the backward force (:1466) AND friction (:1481, posV not
  // raised and vertical > 0). Verbatim DFU arithmetic, not a bug.
  a.update(1 / 60, { ...none, backwards: true }, on);
  assert.ok(near(a.vertical, held - 2 * 9.8 / 60), `reversal ${a.vertical}`);
});

test('AUDIT 28 W8: the setting is the default source, read live, LIVE', () => {
  resetToDefaults();
  setValue('Controls', 'MovementAcceleration', true);
  const a = new MoveAxes();
  assert.ok(a.update(1 / 60, { ...none, forwards: true }).forward < 1, 'accelerating');
  resetToDefaults();
  assert.equal(new MoveAxes().update(1 / 60, { ...none, forwards: true }).forward, 1, 'off: instant');
  assert.equal(LIVE['Controls/MovementAcceleration'], 'src/player/moveAxes.js');
});

test('AUDIT 28 W8: all four producers hand the motor the axes, advanced only on frames the motor runs', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const s = read(host);
    assert.equal((s.match(/forward: \(mv\.forwards \? 1 : 0\) - \(mv\.backwards \? 1 : 0\)/g) || []).length, 0, `${host}: the bare difference still reaches the motor`);
    assert.match(s, /forward: axes\.forward,/, `${host}: forward from the axes`);
    assert.match(s, /strafe: axes\.strafe,/, `${host}: strafe from the axes`);
    assert.match(s, /const moveAxes = new MoveAxes\(\);/, `${host}: one axes filter`);
  }
  // The streaming hosts and the modal frame hold the axes still under an overlay (timeScale 0).
  for (const [host, flag] of [['src/scenes/world.js', '_overlayHeld'], ['src/scenes/exterior.js', '_overlayHeld'], ['src/scenes/worldModes.js', 'overlayHeld']]) {
    assert.match(read(host), new RegExp(`const axes = ${flag} \\? \\{ forward: moveAxes\\.vertical, strafe: moveAxes\\.horizontal \\} : moveAxes\\.update\\(dt, mv\\);`), `${host}: the overlay hold`);
  }
  // The standalone dungeon host's producer already sits inside its own `if (!overlayHeld)`.
  const d = read('src/scenes/dungeon.js');
  const at = d.indexOf('const axes = moveAxes.update(dt, mv);');
  const gate = d.lastIndexOf('if (walkMode && !overlayHeld) {', at);
  assert.ok(gate > 0 && at - gate < 3000, 'dungeon.js: the axes update is inside the walk-mode overlay gate');
  assert.equal(d.slice(gate, at).split('\n    }\n').length, 1, 'dungeon.js: no block close between the gate and the update');
});
