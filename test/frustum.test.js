// EV3 - the frustum's pure laws, pinned with no GL and no game data:
// Gribb/Hartmann planes off the REAL matrix pipeline (perspective ->
// mirrorProjectionX -> lookAt, the port's own), the p-vertex outside
// test with its conservative direction (straddling and surrounding
// boxes always draw), the offset form the streamed world rides, and
// the build-time corner transforms.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frustumPlanes, aabbOutside, localAabb, transformedAabb, flatBatchAabb, cullDisabled } from '../src/render/frustum.js';
import { perspective, mirrorProjectionX, lookAt, multiply, trs, UP_Y } from '../src/world/mat4.js';

/** The port's own camera: eye at origin looking down -z unless told
 *  otherwise, the one mirror included (the handedness law). */
function camera(eye = [0, 0, 0], center = [0, 0, -1]) {
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const view = lookAt(eye, center, UP_Y);
  return frustumPlanes(multiply(proj, view));
}

const box = (cx, cy, cz, r = 1) => [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r];

test('EV3: ahead is visible, behind / beyond / beside is culled', () => {
  const planes = camera();
  assert.equal(aabbOutside(planes, box(0, 0, -50)), false, 'dead ahead');
  assert.equal(aabbOutside(planes, box(0, 0, 50)), true, 'behind the camera');
  assert.equal(aabbOutside(planes, box(0, 0, -7000)), true, 'past the far plane');
  assert.equal(aabbOutside(planes, box(200, 0, -50)), true, 'far right of a 60-degree cone');
  assert.equal(aabbOutside(planes, box(-200, 0, -50)), true, 'far left');
  assert.equal(aabbOutside(planes, box(0, 200, -50)), true, 'far above');
  assert.equal(aabbOutside(planes, box(0, -200, -50)), true, 'far below');
  // near the cone's edge at that depth: x ~ tan(fov/2*aspect-ish) * 50;
  // a box at the boundary must NOT cull (conservative direction)
  assert.equal(aabbOutside(planes, box(50, 0, -50, 5)), false, 'straddles the right plane - draws');
});

test('EV3: the conservative direction - straddling and surrounding boxes always draw', () => {
  const planes = camera();
  assert.equal(aabbOutside(planes, box(0, 0, 0, 3)), false, 'straddles the near plane');
  assert.equal(aabbOutside(planes, [-1e6, -1e6, -1e6, 1e6, 1e6, 1e6]), false, 'surrounds the whole frustum');
  assert.equal(aabbOutside(planes, box(0, 0, -6000, 100)), false, 'straddles the far plane');
});

test('EV3: a turned camera culls what is now behind it', () => {
  // eye at origin looking +x (east): the old ahead (-z) is now beside
  const planes = camera([0, 0, 0], [1, 0, 0]);
  assert.equal(aabbOutside(planes, box(50, 0, 0)), false, 'east is ahead now');
  assert.equal(aabbOutside(planes, box(-50, 0, 0)), true, 'west is behind');
});

test('EV3: the offset form answers exactly the inline box', () => {
  const planes = camera([10, 5, 20], [10, 5, -100]);
  for (const [b, o] of [
    [box(0, 0, -40), [10, 5, 20]],
    [box(0, 0, 40), [10, 5, 20]],
    [box(-819.2, 0, -819.2, 400), [819.2, 0, 0]],
  ]) {
    const inline = [b[0] + o[0], b[1] + o[1], b[2] + o[2], b[3] + o[0], b[4] + o[1], b[5] + o[2]];
    assert.equal(aabbOutside(planes, b, o[0], o[1], o[2]), aabbOutside(planes, inline));
  }
});

test('EV3: transformedAabb bounds every transformed point of the box', () => {
  const local = [-2, 0, -3, 4, 7, 1];
  const m = trs(12, -4, 30, 25, 130, 10, 1.5, 1, 2);
  const world = transformedAabb(local, m);
  // brute force: a lattice of points inside the local box stays inside
  let seed = 42;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  for (let i = 0; i < 500; i++) {
    const x = local[0] + rnd() * (local[3] - local[0]);
    const y = local[1] + rnd() * (local[4] - local[1]);
    const z = local[2] + rnd() * (local[5] - local[2]);
    const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
    const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
    assert.ok(tx >= world[0] - 1e-4 && tx <= world[3] + 1e-4, 'x bounded');
    assert.ok(ty >= world[1] - 1e-4 && ty <= world[4] + 1e-4, 'y bounded');
    assert.ok(tz >= world[2] - 1e-4 && tz <= world[5] + 1e-4, 'z bounded');
  }
});

test('EV3: flatBatchAabb - a full height off the base, half a width around the centers', () => {
  // centers are the flat's BASE (the renderer's createBillboardBatch
  // law); the quad yaws to face the camera, so w/2 pads both x and z
  assert.deepEqual(flatBatchAabb([[0, 5, 0], [10, 3, -4]], { w: 2, h: 6 }),
    [-1, 3, -5, 11, 11, 1]);
});

test('EV3: localAabb is the plain min/max scan', () => {
  assert.deepEqual(localAabb([1, 2, 3, -4, 5, -6, 0, -1, 9]), [-4, -1, -6, 1, 5, 9]);
});

test('EV3: culling is wired, escape-hatched, and never gates the non-draw work', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  const exterior = readFileSync('src/scenes/exterior.js', 'utf8');
  // both hosts consult the hatch once at build and the planes per frame
  for (const [name, src] of [['world', world], ['exterior', exterior]]) {
    assert.ok(src.includes('cullDisabled()'), `${name}: ?cull=off is the escape hatch`);
    assert.ok(src.includes('frustumPlanes('), `${name}: planes extracted from the live camera`);
    assert.ok(src.includes('aabbOutside('), `${name}: the outside test gates draws`);
  }
  // the streamed host: the windmill's ROTOR ANGLE and its HUM are not
  // presentation-gated - a mill behind you still turns and sounds
  const loop = world.slice(world.indexOf('const pixelVisible'), world.indexOf('const camRight = _camRight'));
  assert.ok(loop.indexOf('advanceRotor(') !== -1 && loop.indexOf('w.hum') !== -1,
    'rotor time and hum live in the loop');
  const visGate = loop.indexOf('if (pixelVisible)');
  assert.ok(visGate !== -1, 'the visibility gate exists');
  const gatedSpan = loop.slice(visGate, loop.indexOf('advanceRotor('));
  assert.ok(!gatedSpan.includes('w.hum'), 'the hum is not inside the draw gate');
});
