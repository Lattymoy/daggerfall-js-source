// ---------------------------------------------------------------------------
// MAC-A - THE CAMERA'S OBSTACLE GUARDS ARE SPHERE CASTS (2026-09-17, Mac:
// "Going in some interiors with roof pillars interacts negatively with the
// 3rd person camera").
//
// The reference casts a SPHERE for both of them - `rayCasting->castSphere`
// at camera.cpp:186 (the focal's ceiling guard, radius
// `focalObstacleLimit` = 10) and :200 (the camera's pull-in, radius
// `cameraObstacleLimit` = 5). The port cast a RAY for each and then took
// the limit off the END of the distance.
//
// A ray and a five-unit sphere disagree in exactly the place Mac found.
// A pillar is thin: one ray from the head to the camera threads PAST one
// that a sphere of radius 5 hits square, so the camera slides THROUGH the
// pillar, it fills the frame, and it pops out the far side. And when the
// ray does catch an edge, `hit - limit` changes by the whole width of the
// pillar between one frame and the next, so the camera snaps in and out
// as you walk by. Both are one mistake: a line where the reference has a
// volume.
//
// The distance is the swept sphere's own, with NOTHING taken off it.
// OpenMW re-derives the sphere's centre at contact
// (`hitPos + hitNormal * limit`) and measures that back to the focal -
// and that centre is exactly what a swept-sphere cast reports as the
// distance travelled, which is what `collider.sphereCast` returns
// ("how far the sphere's CENTRE travels before the leading cap touches").
// Subtracting the limit again would pay for the clearance twice.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mwCamera, CAMERA_OBSTACLE_LIMIT, FOCAL_OBSTACLE_LIMIT, MW_UNITS_PER_METER } from '../src/player/mwCamera.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const u = 1 / MW_UNITS_PER_METER;

/** Third person, looking straight down +Z, from a standing player. */
function thirdPerson() {
  mwCamera.restore({ firstPerson: false, baseDistance: 200 });
  return { fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, heightScale: 1 };
}

test('MAC-A: the pull-in is a SPHERE cast, and its radius is the clearance', () => {
  const asked = [];
  const out = mwCamera.eye({
    ...thirdPerson(),
    spherecast: (o, r, d, m) => { asked.push({ o: [...o], r, d: [...d], m }); return d[1] === 1 ? null : 1.25; },
  });
  const pull = asked.find((a) => a.d[1] !== 1);
  assert.ok(pull, 'the camera cast one');
  assert.equal(pull.r, CAMERA_OBSTACLE_LIMIT * u, 'radius = cameraObstacleLimit (camera.cpp:200)');
  // ...and the distance is the cast's OWN. `1.25 - limit` would be the
  // old answer and is a different number.
  assert.ok(Math.abs(out.distance - 1.25) < 1e-9,
    `the swept sphere's distance stands (got ${out.distance})`);
  assert.notEqual(out.distance, 1.25 - CAMERA_OBSTACLE_LIMIT * u, 'the clearance is not paid twice');
});

test('MAC-A: the focal guard is a sphere cast too, at the focal limit', () => {
  const asked = [];
  mwCamera.eye({
    ...thirdPerson(),
    spherecast: (o, r, d, m) => { asked.push({ r, d: [...d], m }); return null; },
  });
  const up = asked.find((a) => a.d[1] === 1);
  assert.ok(up, 'the focal guard cast one');
  assert.equal(up.r, FOCAL_OBSTACLE_LIMIT * u, 'radius = focalObstacleLimit (camera.cpp:186)');
  assert.ok(Math.abs(up.m - FOCAL_OBSTACLE_LIMIT * u * 2) < 1e-9, 'over the guard’s own span, both ways');
});

test('MAC-A: A PILLAR A RAY MISSES - the whole report, as two answers to one frame', () => {
  const base = thirdPerson();
  // The ray threads past: nothing hit, so the camera goes to its
  // preferred distance and stands INSIDE the pillar.
  const byRay = mwCamera.eye({ ...base, raycast: () => null });
  // The sphere catches it at 0.9m.
  const bySphere = mwCamera.eye({ ...thirdPerson(), spherecast: (o, r, d) => (d[1] === 1 ? null : 0.9) });
  assert.ok(byRay.distance > bySphere.distance,
    'the ray puts the camera further back than the sphere lets it go - which is through the pillar');
  assert.ok(Math.abs(bySphere.distance - 0.9) < 1e-9);
});

test('MAC-A: a host with only a ray keeps the old line, subtraction and all', () => {
  const out = mwCamera.eye({ ...thirdPerson(), raycast: (o, d) => (d[1] === 1 ? null : 1.25) });
  assert.ok(Math.abs(out.distance - (1.25 - CAMERA_OBSTACLE_LIMIT * u)) < 1e-9,
    'no sphere seam, no change - the headless pins and any older caller are untouched');
});

test('MAC-A: first person casts nothing at all, as it always did', () => {
  mwCamera.restore({ firstPerson: true, baseDistance: 200 });
  let asked = 0;
  const out = mwCamera.eye({ fpEye: [1, 2, 3], feet: [0, 0, 0], yaw: 0, pitch: 0, spherecast: () => { asked++; return 0.1; } });
  assert.deepEqual(out.eye, [1, 2, 3]);
  assert.equal(out.thirdPerson, false);
  assert.equal(asked, 0);
});

test('MAC-A: every host hands the seam over, off its own collider', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const s = rd(f);
    assert.match(s, /spherecast: \(o, r, d, m\) =>/, `${f}: the camera gets a sphere seam`);
    assert.match(s, /sphereCast\??\.?\(o, r, d, m\)/, `${f}: off the collider's own castSphere`);
    // Infinity is the collider's "clear sweep"; the camera's contract is
    // null for a miss, so the seam translates rather than leaking it.
    assert.match(s, /Number\.isFinite\(h\) \? h : null/, `${f}: a clear sweep is a MISS, not an infinite distance`);
  }
  // ...and mwView passes it through rather than inventing one.
  assert.match(rd('src/player/mwView.js'), /mwCamera\.eye\(\{ fpEye, feet, yaw, pitch, heightScale, raycast, spherecast \}\)/);
});
