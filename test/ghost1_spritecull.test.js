// GHOST1 (2026-09-19) - THE SPRITES THAT WERE CULLED WHILE ON SCREEN.
//
// Two field reports from #bug-reports, one bug:
//   Clerical Error: "loaded from a save and we have ghost campfires now"
//     - a flame that is a blurred glow with no sprite under it.
//   kurkku: "sprites disappear and reappear at certain(?) angles".
//
// PERF-CROWD and PERF-CROWD2 gave the billboards a frustum cull and got
// two things wrong about it.
//
// 1. THE PLANES WERE NOT NORMALISED. `frustumPlanes` leaves them raw on
//    purpose - the box test only reads a sign - but `sphereInPlanes`
//    compares `dot + d < -r`, and that is only a world distance against a
//    world radius once the normal is a unit vector. On a 60 degree
//    frustum the side planes carry |n| = 1.4 and the top and bottom
//    |n| = 2.0, so a sprite's radius counted for as little as HALF of
//    itself and a flat still on screen was thrown away.
//
// 2. THE LIFT WAS IN THE WRONG PLACE. Both new culls hand-rolled the
//    bottom-anchor lift while `batchVisible` - which the shadow replay
//    and the AIR PASS's emission replay cull by - had none. The two
//    passes therefore answered different questions about the same sprite:
//    the main pass dropped a flat the emitters kept, and what was left on
//    screen was the bloom of a sprite that never drew. The ghost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { perspective, lookAt, multiply } from '../src/world/mat4.js';
import { frustumPlanes } from '../src/render/frustum.js';
import { spherePlanes, sphereInPlanes, boundsOf, batchVisible } from '../src/render/bounds.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The frame a player standing in a room sees. */
const framePv = (eye = [0, 1.7, 0], at = [0, 1.7, -1]) =>
  multiply(perspective(Math.PI / 3, 16 / 9, 0.2, 6000), lookAt(eye, at, [0, 1, 0]), new Float32Array(16));

/** A batch as `createBillboardBatch` builds one: the sphere over the
 *  placement points, the sprite's half-diagonal added to the radius. */
const batchAt = (base, w, h) => {
  const bounds = boundsOf(base);
  bounds[3] += Math.hypot(w, h) * 0.5;
  return { bounds, origin: null, size: { w, h } };
};

/** Is any of the quad the VS draws inside the clip box? Bottom-anchored:
 *  the quad runs 0..h up from the base and w/2 either side. */
const onScreen = (pv, base, w, h) => {
  for (const dx of [-w / 2, 0, w / 2]) for (const dy of [0, h / 2, h]) {
    const x = base[0] + dx, y = base[1] + dy, z = base[2];
    const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    if (cw <= 0) continue;
    const nx = (pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / cw;
    const ny = (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / cw;
    if (nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1) return true;
  }
  return false;
};

test('GHOST1: `frustumPlanes` really is unnormalised, and that is what the sphere test cannot take', () => {
  const pv = framePv();
  const raw = frustumPlanes(pv, new Float32Array(24));
  const nrm = spherePlanes(pv, new Float32Array(24));
  const mag = (p, k) => Math.hypot(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]);
  // left, right (i = 0) and bottom, top (i = 1) - the four a sprite meets
  for (const k of [0, 1]) assert.ok(mag(raw, k) > 1.3, `side plane ${k} carries |n| = ${mag(raw, k).toFixed(3)}, so a radius counted for 1/|n| of itself`);
  for (const k of [2, 3]) assert.ok(Math.abs(mag(raw, k) - 2) < 1e-3, `top/bottom plane ${k} carries |n| = 2 - a radius counted for HALF`);
  for (let k = 0; k < 6; k++) assert.ok(Math.abs(mag(nrm, k) - 1) < 1e-6 || mag(raw, k) === 0, `spherePlanes plane ${k} is unit length`);
});

test('GHOST1: the raw planes cull sprites that are ON SCREEN, and the normalised ones do not', () => {
  const pv = framePv();
  const raw = frustumPlanes(pv, new Float32Array(24));
  const nrm = spherePlanes(pv, new Float32Array(24));
  // a campfire (a 64px flat at GLOBAL_SCALE 0.025) and a person
  for (const [w, h, what] of [[1.6, 1.6, 'campfire'], [1.0, 3.0, 'person']]) {
    let overCulledRaw = 0, overCulledNrm = 0, onScreenSeen = 0;
    for (let z = -1; z >= -24; z -= 0.5) for (let x = -14; x <= 14; x += 0.5) for (let y = -3; y <= 3; y += 0.5) {
      const base = [x, y, z];
      if (!onScreen(pv, base, w, h)) continue;
      onScreenSeen++;
      const b = batchAt(base, w, h);
      const cy = b.bounds[1] + h * 0.5;
      if (!sphereInPlanes(raw, b.bounds[0], cy, b.bounds[2], b.bounds[3])) overCulledRaw++;
      if (!sphereInPlanes(nrm, b.bounds[0], cy, b.bounds[2], b.bounds[3])) overCulledNrm++;
    }
    assert.ok(onScreenSeen > 1000, `${what}: the sweep found ${onScreenSeen} on-screen placements to judge`);
    assert.ok(overCulledRaw > 0, `${what}: the UNNORMALISED planes threw away ${overCulledRaw} sprites that were on screen - the bug`);
    assert.equal(overCulledNrm, 0, `${what}: the normalised planes throw away none`);
  }
});

test('GHOST1: the cull is CONSERVATIVE - a sphere that touches the frustum is kept, so nothing visible is ever dropped', () => {
  const nrm = spherePlanes(framePv(), new Float32Array(24));
  // straight ahead, off to the side, behind, and past the far plane
  const keep = (base, w, h) => batchVisible(nrm, batchAt(base, w, h));
  assert.ok(keep([0, 0, -6], 1.6, 1.6), 'straight ahead');
  assert.ok(!keep([0, 0, 6], 1.6, 1.6), 'behind the camera is still culled - the saving is real');
  assert.ok(!keep([900, 0, -6], 1.6, 1.6), 'far off to the side');
  assert.ok(!keep([0, 0, -9000], 1.6, 1.6), 'past the far plane');
});

test('GHOST1: `batchVisible` lifts the sphere, so the main pass and the emission replay answer the SAME question', () => {
  // the ghost's mechanism: two tests over one sprite that disagree.
  const w = 1.0, h = 3.0;   // a person: taller than it is wide, the shape the unlifted sphere fails
  const b = batchAt([0, 0, 0], w, h);
  assert.ok(b.bounds[3] < h, `the stored sphere does not reach the sprite's top (r ${b.bounds[3].toFixed(2)} < ${h})`);
  // a half-space that keeps only y >= h - 0.2: the head is in, the feet are out
  const planes = new Float32Array(24);
  for (let k = 0; k < 6; k++) { planes[k * 4 + 1] = 1; planes[k * 4 + 3] = -(h - 0.2); }
  assert.equal(sphereInPlanes(planes, 0, 0, 0, b.bounds[3]), false, 'UNLIFTED: culled while the head is in view');
  assert.equal(batchVisible(planes, b), true, 'batchVisible keeps it - the lift is inside the one home');
  // and a batch with no bounds is always drawn, whatever the planes say
  assert.equal(batchVisible(planes, { bounds: null, origin: null, size: { w, h } }), true);
  // a NEGATIVE height (droppedTorches' flame, localScale.y negated) hangs
  // DOWN from its base, and the lift follows it down
  const flame = batchAt([0, 0, 0], 1, -2);
  const down = new Float32Array(24);
  for (let k = 0; k < 6; k++) { down[k * 4 + 1] = -1; down[k * 4 + 3] = -(2 - 0.2); }
  assert.equal(batchVisible(down, flame), true, 'the upside-down flame is bounded where it actually hangs');
});

test('GHOST1: ONE home - every sphere cull in the tree goes through bounds.js, on normalised planes', () => {
  const bounds = read('src/render/bounds.js');
  assert.match(bounds, /export function batchVisible\(planes, b\) \{/);
  assert.match(bounds, /\(b\.size\?\.h \?\? 0\) \* 0\.5/, 'the lift lives here and nowhere else');
  // the four readers of a billboard sphere
  const r = read('src/render/renderer.js'), w = read('src/scenes/world.js');
  assert.match(r, /if \(bbCull\) spherePlanes\(/, 'the billboard pass extracts NORMALISED planes');
  assert.doesNotMatch(r, /frustumPlanes\(mat4Multiply/, 'never the raw ones');
  assert.match(w, /if \(cullOn\) spherePlanes\(multiply\(proj, view, _pv\), _planes\);/, 'and so does the streaming host, whose _planes serve both tests');
  assert.match(r, /return batchVisible\(this\._bbPlanes, b\);/, 'the pass delegates');
  assert.match(w, /!batchVisible\(_planes, b\)/, 'the host delegates');
  for (const [f, what] of [['src/render/shadowPass.js', 'the shadow replay'], ['src/render/airPass.js', 'the emission replay']]) {
    assert.match(read(f), /batchVisible/, `${what} reads the same law`);
    assert.match(read(f), /spherePlanes\(/, `${what} extracts the same planes`);
  }
});

test('GHOST1: normalising `_planes` cannot change one EV3 box decision - the sign is all aabbOutside reads', async () => {
  const { aabbOutside } = await import('../src/render/frustum.js');
  const pv = framePv();
  const raw = frustumPlanes(pv, new Float32Array(24));
  const nrm = spherePlanes(pv, new Float32Array(24));
  let seen = 0;
  for (let z = -2; z >= -400; z -= 3.5) for (let x = -200; x <= 200; x += 7) for (let y = -40; y <= 40; y += 9) {
    const box = [x - 5, y - 5, z - 5, x + 5, y + 5, z + 5];
    assert.equal(aabbOutside(raw, box, 0, 0, 0), aabbOutside(nrm, box, 0, 0, 0), `the box at ${x},${y},${z} decides the same either way`);
    seen++;
  }
  assert.ok(seen > 10000, `${seen} boxes, every one identical - dividing by a positive length cannot move a sign`);
});
