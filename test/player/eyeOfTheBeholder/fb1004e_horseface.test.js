// FIELD BUGS 2026-10-04e - HORSE-FACE (bible/01-Overview/bugs/Field-Bugs-2026-10-04e.md, report 6).
//
// "When on the horse in the overworld, the sprite doesnt face the direction of travel." Eye Of The Beholder's body
// read a gallop under the Overworld's time scale as a PLACING every frame (ARENA-FIX 14: feet carried past
// PLACE_JUMP_M in one frame), and the placing wrote -1 into lastOrientation - which the walk loop's repaints then
// painted, sixteen a second, as orientation 7: one fixed front-three-quarter view whatever the heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEotbBody, PLACE_JUMP_M } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';

const renderer = () => ({
  uploadTexture() {}, createBillboardBatch(archive, rec, size) { return { archive, rec, size, origin: [0, 0, 0] }; },
  destroyBillboardBatch() {}, drawBillboards() {},
});
async function liveBody() {
  const b = createEotbBody({ count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
  b.attach(renderer(), () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, false);   // third person
  return b;
}
const ride = (feet, cameraOff, extra = {}) => ({
  riding: true, motion: { forward: 1, standing: false, speed: 9, grounded: true, height: 1.8, riding: true },
  feet, yaw: Math.PI / 2, cameraPos: [feet[0] + cameraOff[0], 2, feet[2] + cameraOff[2]], ...extra,
});
/** Ride +x for `n` frames at `step` metres a frame; the views shown, frame by frame. */
function gallop(b, n, step, cameraOff) {
  const seen = [];
  for (let i = 0; i < n; i++) { b.tick(1 / 60, ride([i * step, 0, 0], cameraOff)); seen.push(b.state().shown?.orientation ?? null); }
  return seen;
}

test('HORSE-FACE: a gallop under the Overworld\'s time scale (past PLACE_JUMP_M a frame) shows the view a slow ride shows - never the placing\'s -1 (mutants: the -1 written back; the moving gate gone and the facing turned to the view)', async () => {
  const fast = 3 * PLACE_JUMP_M;
  for (const [what, off] of [['from behind', [-6, 0, 0]], ['from the left', [0, 0, 6]], ['from the right', [0, 0, -6]], ['from ahead', [6, 0, 0]]]) {
    const slow = await liveBody();
    const want = gallop(slow, 90, 0.2, off).at(-1);
    assert.ok(Number.isInteger(want) && want >= 0 && want < 8, `the slow ride settles on a view (${what}): ${want}`);
    const b = await liveBody();
    const seen = gallop(b, 90, fast, off);
    assert.ok(!seen.includes(-1), `${what}: no frame paints the placing's -1: ${seen.join(',')}`);
    assert.deepEqual([...new Set(seen.slice(30))], [want], `${what}: the gallop shows the slow ride's view, every frame once settled`);
  }
});

test('HORSE-FACE: a placing at rest still faces the body the way the view was placed (ARENA-FIX 14), and repaints with a real view', async () => {
  const b = await liveBody();
  const still = (feet, yaw) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet, yaw, cameraPos: [feet[0], 1.5, feet[2] - 2] });
  for (let i = 0; i < 12; i++) b.tick(1 / 60, still([0, 0, 0], 0));
  b.tick(1 / 60, still([PLACE_JUMP_M + 5, 0, 0], Math.PI / 2));
  assert.deepEqual(b.state().lastMoveDirection.map((v) => Math.round(v)), [1, 0, 0], 'placed: facing the view\'s way');
  for (let i = 0; i < 12; i++) b.tick(1 / 60, still([PLACE_JUMP_M + 5, 0, 0], Math.PI / 2));
  const o = b.state().shown?.orientation;
  assert.ok(Number.isInteger(o) && o >= 0 && o < 8, `the repaint the placing asked for is a real view: ${o}`);
});

test('HORSE-FACE: the floating origin\'s shift moves the sprite\'s own feet - an origin shift is no placing (mutant: the rebase dropped)', async () => {
  const b = await liveBody();
  const at = (feet, yaw, forward) => ({ motion: { forward, standing: !forward, speed: forward ? 3 : 0, grounded: true, height: 1.8 }, feet, yaw, cameraPos: [feet[0], 1.5, feet[2] - 2] });
  for (let i = 0; i < 12; i++) b.tick(1 / 60, at([0, 0, i * 0.05], 0, 1));   // walking +z
  for (let i = 0; i < 4; i++) b.tick(1 / 60, at([0, 0, 0.6], Math.PI / 2, 0));   // stopped, the view turned to +x
  assert.deepEqual(b.state().lastMoveDirection.map((v) => Math.round(v)), [0, 0, 1], 'stopped: the walk\'s facing');
  b.rebase([-819.2, 0, 0]);
  b.tick(1 / 60, at([-819.2, 0, 0.6], Math.PI / 2, 0));
  assert.deepEqual(b.state().lastMoveDirection.map((v) => Math.round(v)), [0, 0, 1], 'the world moved under the feet: still the walk\'s facing');
});

test('HORSE-FACE: a ride is no placing - strafing past PLACE_JUMP_M a frame keeps the move\'s facing, never the view\'s; the host\'s origin shift reaches the body (mutants: the moving gate gone; mwViewRebase forgets the body)', async () => {
  const b = await liveBody();
  // strafing +x with the view looking +z (yaw 0): the move's facing is +x, the view's +z
  const strafe = (x) => ({ riding: true, motion: { forward: 0, strafe: 1, standing: false, speed: 9, grounded: true, height: 1.8, riding: true }, feet: [x, 0, 0], yaw: 0, cameraPos: [x, 2, -6] });
  for (let i = 0; i < 30; i++) b.tick(1 / 60, strafe(i * 0.2));
  assert.deepEqual(b.state().lastMoveDirection.map((v) => Math.round(v)), [1, 0, 0], 'strafing: the move\'s facing');
  let x = 6;
  for (let i = 0; i < 12; i++) {
    x += 3 * PLACE_JUMP_M;
    b.tick(1 / 60, strafe(x));
    assert.deepEqual(b.state().lastMoveDirection.map((v) => Math.round(v)), [1, 0, 0], `frame ${i}: a gallop's frame is no placing - never the view's +z`);
  }
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../../../src/player/mwView.js', import.meta.url), 'utf8'), /export function mwViewRebase\(delta\) \{\n\s*eotbCamera\.onPositionUpdate\(delta\);\n\s*eotbWagon\.rebase\(delta\);\n\s*eotbBody\.rebase\(delta\);/);
});

test('HORSE-FACE: a body carried with no input of its own (placed every frame - a journey\'s autopilot, a cart) never paints the placing\'s -1 (mutant: the -1 written back)', async () => {
  const b = await liveBody();
  const carried = (x) => ({ riding: true, motion: { forward: 0, strafe: 0, standing: false, speed: 9, grounded: true, height: 1.8, riding: true }, feet: [x, 0, 0], yaw: Math.PI / 2, cameraPos: [x - 6, 2, 0] });
  const seen = [];
  for (let i = 0; i < 60; i++) { b.tick(1 / 60, carried(i * 3 * PLACE_JUMP_M)); seen.push(b.state().shown?.orientation ?? null); }
  assert.ok(!seen.includes(-1), `every frame a real view: ${seen.join(',')}`);
  assert.ok(seen.slice(20).every((o) => o === seen.at(-1)), 'and one view, settled');
});
