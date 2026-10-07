// WATER-NEXT 4 - THE RIPPLES (world/waterRipples.js): the water answers what moves in it - a damped wave equation
// round the camera, stirred at a body's feet, stepped at a fixed rate, sliding with the eye a cell at a time. The
// record: bible/07-Rendering/Water-Arc.md WATER-NEXT 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRipples, stirOf, RIPPLE_CELLS, RIPPLE_SPAN, RIPPLE_HZ, RIPPLE_SCALE } from '../src/world/waterRipples.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('WATER-NEXT 4 a stir is a dimple, and it runs outward as a ring that dies away (mutants: the stir lifting; no propagation; no damping)', () => {
  const r = createRipples();
  r.recenter(0, 0);
  r.disturb(0, 0, 0.05, 1);
  assert.ok(r.heightAt(0, 0) < -0.04, 'pushed down at the feet');
  assert.equal(r.heightAt(5, 0), 0, 'nothing yet five units off');
  const peak = () => { let m = 0; for (let x = -20; x <= 20; x += 0.5) for (let z = -20; z <= 20; z += 0.5) m = Math.max(m, Math.abs(r.heightAt(x, z))); return m; };
  for (let i = 0; i < 3; i++) r.step(4 / RIPPLE_HZ);
  // the ring has left the middle and reached outward
  let far = 0;
  for (let x = 2; x <= 8; x += 0.5) far = Math.max(far, Math.abs(r.heightAt(x, 0)));
  assert.ok(far > 1e-3, 'the ring reached out');
  const p0 = peak();
  for (let i = 0; i < 30; i++) r.step(4 / RIPPLE_HZ);
  assert.ok(peak() < p0 * 0.25, 'and dies away');
});

test('WATER-NEXT 4 the rate is fixed: one long frame and many short ones run the same steps; a stalled frame runs four at most (mutants: dt read raw; the cap gone)', () => {
  const a = createRipples(), b = createRipples();
  for (const r of [a, b]) { r.recenter(0, 0); r.disturb(1, 1, 0.05); }
  assert.equal(a.step(4 / RIPPLE_HZ + 1e-6), 4);
  let k = 0;
  for (let i = 0; i < 8; i++) k += b.step(0.5 / RIPPLE_HZ + 1e-9);
  assert.equal(k, 4);
  assert.deepEqual(a.bytes, b.bytes, 'the same water');
  const c = createRipples(); c.recenter(0, 0); c.disturb(0, 0, 0.05);
  assert.equal(c.step(10), 4, 'a ten-second stall: four steps, never three hundred');
});

test('WATER-NEXT 4 the field follows the eye a whole cell at a time and its rings stay where they were left in the world; a jump past the field clears it (mutants: the contents left in place; the origin not snapped)', () => {
  const r = createRipples();
  r.recenter(0, 0);
  const cell = RIPPLE_SPAN / RIPPLE_CELLS;
  assert.equal(Math.abs(r.origin[0] % cell), 0, 'a whole number of cells');
  r.disturb(3, 2, 0.05);
  const h = r.heightAt(3, 2);
  assert.ok(h < 0);
  assert.equal(r.recenter(0.1, 0), false, 'under a cell: no move');
  assert.equal(r.recenter(5, -4), true);
  assert.equal(r.heightAt(3, 2), h, 'the dimple is where it was in the world');
  r.recenter(500, 500);
  assert.equal(r.heightAt(3, 2), 0, 'out of the field');
  r.recenter(0, 0);
  assert.equal(r.heightAt(3, 2), 0, 'a jump past the field cleared it');
});

test('WATER-NEXT 4 the bytes the shader reads: 128 still water, a step a RIPPLE_SCALE of height, never 0; the version moves only when a step ran; a still field sleeps (mutants: the bias; the version every call)', () => {
  const r = createRipples();
  r.recenter(0, 0);
  assert.equal(r.bytes[0], 128);
  assert.equal(r.step(1 / RIPPLE_HZ), 0, 'a still field sleeps: no step');
  const v = r.version();
  assert.equal(v, 0, 'and no new picture');
  r.disturb(0, 0, 0.6);
  r.step(1 / RIPPLE_HZ);
  assert.ok(r.version() > v);
  assert.ok(Math.min(...r.bytes) >= 1, 'clamped, never the zero byte');
  assert.equal(r.bytes[5], 128, 'a cell the ring has not reached is still water, after a step as before');
  const i = [...r.bytes].findIndex((b) => b !== 128);
  assert.ok(i >= 0);
  assert.equal(RIPPLE_SCALE, 0.012);
  assert.equal(r.step(0), 0, 'no time, no step, the same version');
});

test('WATER-NEXT 4 a body\'s stir: a still swimmer bobs, a wader\'s wake grows with its speed to a cap (mutants: speed ignored; no cap)', () => {
  assert.ok(stirOf(0, true) > stirOf(0, false), 'a swimmer stirs more than a still wader');
  assert.ok(stirOf(4, false) > stirOf(1, false));
  assert.equal(stirOf(20, false), stirOf(8, false), 'capped');
});

test('WATER-NEXT 4 the hosts and the shader: the world stirs with the player\'s own footsteps answer and every boat afloat, steps before its water draws and hands the field over; the water reads its slope inside the field, faded at its edge; the renderer uploads only a moved field and forgets unit 1\'s shadow (mutants: no stir; the field never handed; the shadow kept)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const ripples = waterOn && !renderer\.waterSimple \? createRipples\(\) : null;/);
  assert.match(w, /_rippleOnWater = _onWater;/);
  assert.match(w, /if \(_rippleOnWater\) stir\(player, player\.pos, !!player\.swimming\);/);
  assert.match(w, /for \(const boat of csaRuntime\?\.AllBoats \?\? \[\]\) \{/);
  assert.match(w, /if \(waterOn\) \{\n\s*stirRipples\(dt\);/);
  assert.match(w, /renderer\.setWaterRipples\(ripples, RIPPLE_SPAN, RIPPLE_CELLS\);/);
  const r = read('src/render/renderer.js');
  assert.match(r, /if \(v !== this\._rippleVersion\) \{/);
  assert.match(r, /this\._tex1Bound = null;   \/\/ unit 1 is the billboards' emission unit/);
  const ws = read('src/render/waterSurface.js');
  assert.match(ws, /if \(uRippleOn == 1\) \{/);
  assert.match(ws, /export const WATER_RIPPLE_UNIT = 1;/);
});
