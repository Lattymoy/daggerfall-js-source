import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  StreamingWorldState, worldCoordToMapPixel, mapPixelToWorldCoords, TERRAIN_DISTANCE,
} from '../src/world/streamingWorld.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';

function approx(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);
}

test('streaming: world coordinate conversions, verbatim', () => {
  // Daggerfall pixel corner and round trip.
  assert.deepEqual(mapPixelToWorldCoords(207, 213), { x: 207 * 32768, z: 286 * 32768 });
  assert.deepEqual(worldCoordToMapPixel(207 * 32768, 286 * 32768), { x: 207, y: 213 });
  // Anywhere inside the pixel maps back (truncating division).
  assert.deepEqual(worldCoordToMapPixel(207 * 32768 + 32767, 286 * 32768 + 1), { x: 207, y: 213 });
});

test('streaming: init builds the nearest-first 7x7 grid', () => {
  const s = new StreamingWorldState();
  const list = s.init(207, 213);
  assert.equal(TERRAIN_DISTANCE, 3);
  assert.equal(list.length, 49);
  // Player pixel first, then the distance-1 ring.
  assert.deepEqual(list[0], { px: 207, py: 213 });
  for (let i = 1; i <= 8; i++) {
    const d = Math.max(Math.abs(list[i].px - 207), Math.abs(list[i].py - 213));
    assert.equal(d, 1);
  }
  // Unique keys, all inside the grid.
  const keys = new Set(list.map((p) => `${p.px},${p.py}`));
  assert.equal(keys.size, 49);
});

test('streaming: east crossing recenters and swaps one column', () => {
  const s = new StreamingWorldState();
  s.init(207, 213);
  const cam = [TERRAIN_SIZE / 2, 100, TERRAIN_SIZE / 2];
  assert.equal(s.update(cam).pixelChanged, false);

  cam[0] += TERRAIN_SIZE; // step one pixel east
  const r = s.update(cam);
  assert.equal(r.pixelChanged, true);
  assert.deepEqual(r.current, { x: 208, y: 213 });
  // Verbatim FloatingOrigin offset: (-dX * 819.2, 0, +dY * 819.2).
  approx(r.offset[0], -TERRAIN_SIZE);
  approx(r.offset[2], 0);
  assert.equal(r.load.length, 7);
  assert.ok(r.load.every((p) => p.px === 211));
  assert.equal(r.unload.length, 7);
  assert.ok(r.unload.every((p) => p.px === 204));

  // Applying the offset returns the camera to the same local position.
  cam[0] += r.offset[0];
  approx(cam[0], TERRAIN_SIZE / 2);
  // Floating-origin invariant: the current pixel's frame sits at origin.
  approx(s.pixelTranslation(208, 213)[0], 0);
  approx(s.pixelTranslation(208, 213)[2], 0);

  // Unloads are re-reported until released, gone after.
  cam[0] += TERRAIN_SIZE;
  const r2 = s.update(cam);
  assert.equal(r2.unload.length, 14); // 204 column (unreleased) + 205 column
  for (const u of r2.unload) s.release(u.px, u.py);
  cam[0] += r2.offset[0] + TERRAIN_SIZE;
  const r3 = s.update(cam);
  assert.equal(r3.unload.length, 7); // only the newly out-of-range column
});

test('streaming: south crossing sign and two-pixel jumps', () => {
  const s = new StreamingWorldState();
  s.init(207, 213);
  const cam = [TERRAIN_SIZE / 2, 100, TERRAIN_SIZE / 2];

  cam[2] -= TERRAIN_SIZE; // south = local -z
  let r = s.update(cam);
  assert.deepEqual(r.current, { x: 207, y: 214 });
  approx(r.offset[2], TERRAIN_SIZE);
  cam[2] += r.offset[2];
  for (const u of r.unload) s.release(u.px, u.py);

  // A teleport spanning two pixels resolves in one update.
  cam[0] += 2 * TERRAIN_SIZE;
  r = s.update(cam);
  assert.deepEqual(r.current, { x: 209, y: 214 });
  approx(r.offset[0], -2 * TERRAIN_SIZE);
  assert.equal(r.load.length, 14);
  assert.equal(r.unload.length, 14);
});

test('streaming: vertical recenter past the 500 threshold', () => {
  const s = new StreamingWorldState();
  s.init(207, 213);
  const cam = [TERRAIN_SIZE / 2, 600, TERRAIN_SIZE / 2];
  const r = s.update(cam);
  assert.equal(r.pixelChanged, false);
  assert.deepEqual(r.offset, [0, -600, 0]);
  cam[1] += r.offset[1];
  assert.equal(cam[1], 0);
  approx(s.compensation[1], -600);
  // Below the threshold nothing fires.
  assert.equal(s.update([TERRAIN_SIZE / 2, 499, TERRAIN_SIZE / 2]).offset, null);
});

test('streaming: long flight keeps the origin floating and coords exact', () => {
  const s = new StreamingWorldState();
  s.init(207, 213);
  const cam = [TERRAIN_SIZE / 2, 100, TERRAIN_SIZE / 2];
  // 20 pixels east, 10 south, one crossing at a time.
  for (let i = 0; i < 20; i++) {
    cam[0] += TERRAIN_SIZE;
    const r = s.update(cam);
    if (r.offset) for (let a = 0; a < 3; a++) cam[a] += r.offset[a];
    for (const u of r.unload) s.release(u.px, u.py);
  }
  for (let i = 0; i < 10; i++) {
    cam[2] -= TERRAIN_SIZE;
    const r = s.update(cam);
    if (r.offset) for (let a = 0; a < 3; a++) cam[a] += r.offset[a];
    for (const u of r.unload) s.release(u.px, u.py);
  }
  assert.deepEqual(s.current, { x: 227, y: 223 });
  // Camera never drifted from the local pixel centre.
  approx(cam[0], TERRAIN_SIZE / 2);
  approx(cam[2], TERRAIN_SIZE / 2);
  // Floating-origin invariant after 30 recenters.
  const t = s.pixelTranslation(227, 223);
  approx(t[0], 0);
  approx(t[2], 0);
  // Native coordinates map back to the exact pixel.
  const w = s.worldCoords(cam);
  assert.deepEqual(worldCoordToMapPixel(w.x, w.z), { x: 227, y: 223 });
  // Loaded set stays exactly the 7x7.
  assert.equal(s.loaded.size, 49);
});

test('streaming: 2000-step fuzz holds every invariant', async () => {
  const { UMRandom } = await import('../src/formats/umRandom.js');
  const rng = new UMRandom(0xdead1234);
  const s = new StreamingWorldState();
  s.init(207, 213);
  const cam = [TERRAIN_SIZE / 2, 100, TERRAIN_SIZE / 2];
  for (let step = 0; step < 2000; step++) {
    const roll = rng.nextFloat();
    if (roll < 0.75) {
      // Wander with sub-pixel jitter, sometimes crossing.
      cam[0] += rng.nextFloatRange(-900, 900);
      cam[2] += rng.nextFloatRange(-900, 900);
    } else if (roll < 0.9) {
      // Teleport several pixels.
      cam[0] += rng.nextIntRange(-4, 5) * TERRAIN_SIZE;
      cam[2] += rng.nextIntRange(-4, 5) * TERRAIN_SIZE;
    } else {
      // Vertical spike.
      cam[1] = rng.nextFloatRange(-900, 900);
    }
    const r = s.update(cam);
    if (r.offset) for (let a = 0; a < 3; a++) cam[a] += r.offset[a];
    for (const u of r.unload) s.release(u.px, u.py);

    // Invariants after every step:
    // 1) Vertical stays inside the threshold post-recenter.
    assert.ok(cam[1] >= -500 && cam[1] <= 500, `y ${cam[1]}`);
    // 2) The current pixel's frame floats at the origin (x/z).
    const t = s.pixelTranslation(s.current.x, s.current.y);
    assert.ok(Math.abs(t[0]) < 1e-6 && Math.abs(t[2]) < 1e-6, `frame ${t}`);
    // 3) The camera sits inside the current pixel's local frame.
    assert.ok(cam[0] - t[0] >= -1e-6 && cam[0] - t[0] < TERRAIN_SIZE + 1e-6, `x ${cam[0]}`);
    assert.ok(cam[2] - t[2] >= -1e-6 && cam[2] - t[2] < TERRAIN_SIZE + 1e-6, `z ${cam[2]}`);
    // 4) Native coordinates round-trip to the current pixel.
    const w = s.worldCoords(cam);
    assert.deepEqual(worldCoordToMapPixel(w.x, w.z), { x: s.current.x, y: s.current.y });
    // 5) The loaded set is exactly the desired 7x7 after releases.
    assert.equal(s.loaded.size, 49);
    for (const p of s.loaded.values()) assert.ok(s.inRange(p.px, p.py));
  }
});

test('D1: the grid radius is the LIVE Land View Distance - DFU sizes and DFU clamp (StreamingWorld.cs:51-56)', () => {
  // the constructor takes the distance; (2d+1)^2 tiles, 1->9 ... 4->81
  for (const [d, tiles] of [[1, 9], [2, 25], [3, 49], [4, 81]]) {
    const s = new StreamingWorldState(d);
    assert.equal(s.init(100, 100).length, tiles, `distance ${d} streams ${tiles} pixels`);
    assert.equal(s.inRange(100 + d, 100 - d), true);
    assert.equal(s.inRange(100 + d + 1, 100), false);
  }
  // the bare constructor stays DFU's default 3 (the 7x7)
  assert.equal(new StreamingWorldState().terrainDistance, TERRAIN_DISTANCE);
  assert.equal(TERRAIN_DISTANCE, 3);
  // and the world host really passes the setting, with DFU's own 1..4
  // clamp (SettingsManager.cs:952-963 - clamp on parse, MIN on failure;
  // the port's getInt carries the identical law)
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /new StreamingWorldState\(getInt\('Experimental', 'TerrainDistance', 1, 4\)\)/);
});
