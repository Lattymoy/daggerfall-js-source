// PERF-ON2 + PERF-CPU (2026-09-19, Mac: "Online mode needs further
// performance improvements", with a readout: 51 fps, frame 19.7 ms,
// script 23.3 ms, draws 1365, binds 820).
//
// A frame whose SCRIPT outruns its frame time is CPU-bound, and every
// instrument the port had measured the GPU. These pins hold the two
// answers: the peers are culled like everything else is, and the frame
// can now be tiled on the clock it is actually losing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frustumPlanes, aabbOutside } from '../src/render/frustum.js';
import { perspective, lookAt, multiply } from '../src/world/mat4.js';
import { PerfMeter, perfOn, perfZones, perfCpu, perfZoneLine, PERF_EVERY } from '../src/render/perfMeter.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The frame's planes, from an eye at the origin looking down -z. */
const planesFor = (eye = [0, 1.7, 0], at = [0, 1.7, -10]) => {
  const proj = perspective(Math.PI / 3, 16 / 9, 0.2, 6000);
  const view = lookAt(eye, at, [0, 1, 0]);
  const out = new Float32Array(24);
  frustumPlanes(multiply(proj, view, new Float32Array(16)), out);
  return out;
};

/** The billboard VS's own extent, as world.js builds it: bottom-anchored,
 *  standing `h` up from the origin and reaching `w / 2` in any horizontal
 *  direction, because the quad turns to face the eye. */
const peerBox = (origin, w, h) =>
  [origin[0] - w / 2, origin[1], origin[2] - w / 2, origin[0] + w / 2, origin[1] + h, origin[2] + w / 2];

test('PERF-ON2: a peer outside the frustum is skipped, and one inside is kept - the same test every world flat already got', () => {
  const planes = planesFor();
  const seen = (origin) => !aabbOutside(planes, peerBox(origin, 1.2, 2.0), 0, 0, 0);
  assert.ok(seen([0, 0, -10]), 'straight ahead');
  assert.ok(seen([3, 0, -12]), 'off to the side, still in view');
  assert.ok(!seen([0, 0, 10]), 'BEHIND the camera - the case that was costing a draw and two binds every frame');
  assert.ok(!seen([600, 0, -10]), 'far off to the side');
  assert.ok(!seen([0, 0, -9000]), 'past the far plane');
  // the box is BOTTOM-ANCHORED: a peer whose feet are below the view but
  // whose head is in it is still drawn, which is what the shader does
  // (`uUp * ((aCorner.y + 0.5) * uSize.y)` runs 0..h from the origin).
  const low = [0, -1.9, -10];
  assert.ok(seen(low), 'feet under the eye line, head in view');
  assert.ok(!aabbOutside(planes, peerBox(low, 1.2, 2.0), 0, 0, 0));
  const noHeight = [0, -1.9, -10];
  assert.ok(aabbOutside(planes, peerBox(noHeight, 0, 0), 0, 0, 0) === aabbOutside(planes, [noHeight[0], noHeight[1], noHeight[2], noHeight[0], noHeight[1], noHeight[2]], 0, 0, 0),
    'a zero-sized batch is its own point');
});

test('PERF-ON2: the host culls the peers, with the shader’s own box, and allocates nothing to do it', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(remotePlayers\) for \(const b of remotePlayers\.batches\(\)\) \{[\s\S]{0,200}?if \(cullOn && peerBatchOutside\(b\)\) continue;[\s\S]{0,80}?allBatches\.push\(b\);/,
    'every peer batch is tested before it is submitted');
  assert.doesNotMatch(w, /if \(remotePlayers\) for \(const b of remotePlayers\.batches\(\)\) allBatches\.push\(b\);/, 'the unconditional push is gone');
  // the box: bottom-anchored, half the width either way, the height up
  assert.match(w, /_peerBox\[0\] = o\[0\] - hw; _peerBox\[1\] = o\[1\]; _peerBox\[2\] = o\[2\] - hw;/, 'the low corner sits AT the origin in y - the sprite stands on it');
  assert.match(w, /_peerBox\[3\] = o\[0\] \+ hw; _peerBox\[4\] = o\[1\] \+ h; _peerBox\[5\] = o\[2\] \+ hw;/, 'and the high corner is a height up');
  assert.match(w, /const hw = \(b\.size\?\.w \?\? 0\) \* 0\.5, h = b\.size\?\.h \?\? 0;/, 'half the WIDTH, because the quad turns to face the eye');
  // PERF10's own lesson, one module over: the test runs once a peer a
  // frame and must not mint an array to do it.
  assert.match(w, /const _peerBox = new Float32Array\(6\);/, 'one scratch box, reused');
  // and the billboard shader really is bottom-anchored, or the box is wrong
  const r = read('src/render/renderer.js');
  assert.match(r, /\+ uUp \* \(\(aCorner\.y \+ 0\.5\) \* uSize\.y\)/, 'the VS stands the quad from the origin up');
  assert.match(r, /\+ uRight \* \(aCorner\.x \* uSize\.x\)/, 'and spreads it about the origin sideways');
});

test('PERF-CPU: `?perf=cpu` is its own door, and it does not turn the zone door on', () => {
  assert.equal(perfCpu('?perf=cpu'), true);
  assert.equal(perfOn('?perf=cpu'), true, 'the meter is built at all');
  assert.equal(perfZones('?perf=cpu'), false, 'but the GPU zone arm stays off');
  assert.equal(perfCpu('?perf'), false);
  assert.equal(perfCpu('?perf=zones'), false);
  assert.equal(perfCpu(''), false);
  assert.match(read('src/render/renderer.js'), /new PerfMeter\(gl, perfZones\(\), perfCpu\(\)\)/, 'and the renderer passes it');
});

test('PERF-CPU: the zones TILE on the main thread’s clock - they sum to the frame, nothing is double-counted, and the line names its clock', () => {
  const gl = new Proxy({}, { get: (o, k) => (k === 'getExtension' ? () => null : () => ({})) });
  const m = new PerfMeter(gl, false, true);
  let t = 0; m._now = () => t;
  let line = null;
  for (let f = 0; f < PERF_EVERY; f++) {
    m.markCpu('online'); t += 2;
    m.markCpu('sim'); t += 5;
    m.mark('grass'); t += 1;       // a GPU mark marks the CPU clock too
    m.mark('world'); t += 8;
    m.stop();
    line = m.frame({ draws: 1365 });
  }
  assert.ok(line, `a line every ${PERF_EVERY} frames`);
  assert.match(line, /^\[perf\] cpu 16\.00ms \| world 8\.00 \| sim 5\.00 \| online 2\.00 \| grass 1\.00 \| draws 1365$/,
    'the zones sum to the 16 ms the frame spent, heaviest first, on a clock the line names');
  assert.equal(m.cpuOpen, null, 'no span is left open to leak into the next frame');
  assert.equal(m.samples.length, 0, 'and the GPU clock never ran, so nothing accumulates in a list the CPU arm never drains');
});

test('PERF-CPU: `frame()` closes the frame whether or not `stop()` was called - a span left open would leak into the next one', () => {
  // The renderer calls stop() then frame(), so in this tree the close in
  // frame() is belt-and-braces - and a mutant that removed it survived
  // the pin above for exactly that reason. It is kept and pinned rather
  // than recorded equivalent, because the contract "frame() ends the
  // frame" is the cheap one to guarantee and the failure it prevents is
  // silent: a zone accumulating across frames reads as a phase that
  // grows the longer you play.
  const gl = new Proxy({}, { get: (o, k) => (k === 'getExtension' ? () => null : () => ({})) });
  const m = new PerfMeter(gl, false, true);
  let t = 0; m._now = () => t;
  let line = null;
  for (let f = 0; f < PERF_EVERY; f++) {
    m.markCpu('online'); t += 2;
    m.markCpu('sim'); t += 5;
    line = m.frame({ draws: 1 });   // NO stop() - the host forgot, or another host never had one
  }
  assert.equal(m.cpuOpen, null, 'the open span is closed by frame() itself');
  assert.match(line, /^\[perf\] cpu 7\.00ms \| sim 5\.00 \| online 2\.00 \| draws 1$/,
    'and every frame is 7 ms - not a `sim` that grows by 5 ms a frame because its span never closed');
});

test('PERF-CPU: markCpu leaves the GPU arm exactly as it was', () => {
  const src = read('src/render/perfMeter.js');
  assert.match(src, /markCpu\(name\) \{ if \(this\.cpu\) this\._cpuMark\(name\); \}/, 'it touches openZone and the query stack not at all');
  assert.match(src, /if \(this\.cpu\) return;\n\s+if \(!this\.ext \|\| this\.active \|\| this\.zones\) return;/, 'and the GPU clock does not run under ?perf=cpu');
  // the host marks the phases a script-bound frame is actually spending in
  const w = read('src/scenes/world.js');
  for (const zone of ['online', 'sim', 'batches', 'flats', 'people']) {
    assert.match(w, new RegExp(`markCpu\\('${zone}'\\)`), `the frame marks '${zone}'`);
  }
  assert.match(read('src/render/perfMeter.js'), /export function perfZoneLine\(zones, counts, clock = 'gpu'\)/, 'and a GPU line still says gpu');
  assert.match(perfZoneLine(new Map([['a', 1]]), { draws: 2 }), /^\[perf\] gpu 1\.00ms/, 'by default');
});

test('PERF-FLICKER: a lantern’s flicker cannot rebuild its shadow cube - the far plane is the light’s range rounded UP, and never inside it', async () => {
  const { shadowFarFor, SHADOW_FAR_QUANTUM } = await import('../src/render/shadowPass.js');
  const { CityLightAnimator } = await import('../src/world/worldClock.js');
  const { CITY_LIGHT_RANGE } = await import('../src/world/cityLights.js');
  // NEVER INSIDE THE LANTERN'S REACH: a far plane short of the range would
  // clip a shadow before the light stops lighting.
  for (let r = 0.5; r < 60; r += 0.25) assert.ok(shadowFarFor(r) >= r, `far ${shadowFarFor(r)} >= range ${r}`);
  assert.equal(shadowFarFor(SHADOW_FAR_QUANTUM * 3), SHADOW_FAR_QUANTUM * 3, 'a range already on the quantum is untouched - the rounding is UP, not a blanket widening');
  // AND THE WHOLE FLICKER BAND IS ONE VALUE. This is the fix: the animator
  // wanders a light's range every step, the shadow pass compared that number
  // to decide a slot had changed, and so every caster rebuilt all six of its
  // faces every frame - EL8's near/far schedule could never fire.
  const anim = new CityLightAnimator(1, CITY_LIGHT_RANGE);
  const seen = new Set();
  let moved = 0, last = anim.ranges[0];
  for (let f = 0; f < 600; f++) {
    anim.tick(1 / 60);
    if (anim.ranges[0] !== last) { moved++; last = anim.ranges[0]; }
    seen.add(shadowFarFor(anim.ranges[0]));
  }
  assert.ok(moved > 50, `the flicker really does move the range (${moved} of 600 frames) - without this the pin proves nothing`);
  assert.equal(seen.size, 1, `...and every one of those frames maps to ONE shadow far plane (${[...seen]}), so the cube is not rebuilt`);
  // the source: the shadow's far is the quantised one everywhere it matters
  assert.match(read('src/render/shadowPass.js'), /const far = shadowFarFor\(L\[i \* 4 \+ 3\]\);/, 'the matrices, the change test and pointParams all take it');
});

test('PERF-LIGHTS: the night’s lanterns are a pool - the same selection, with nothing minted per lantern per frame', async () => {
  const { nearestLights } = await import('../src/world/cityLights.js');
  const rnd = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  for (let t = 0; t < 60; t++) {
    const n = (rnd() * 200) | 0;
    const fresh = []; for (let i = 0; i < n; i++) fresh.push({ x: (rnd() - 0.5) * 200, y: (rnd() - 0.5) * 40, z: (rnd() - 0.5) * 200 });
    // the pool as the host keeps it: the live entries, and STALE ones past them
    const pool = fresh.map((o) => ({ ...o }));
    for (let i = 0; i < 50; i++) pool.push({ x: 9e9, y: 9e9, z: 9e9 });
    const ranges = new Float32Array(n + 50); for (let i = 0; i < ranges.length; i++) ranges[i] = 17 + rnd();
    const pos = [(rnd() - 0.5) * 50, 2, (rnd() - 0.5) * 50];
    assert.deepEqual([...nearestLights(pool, pos, 16, ranges, null, 0, n)], [...nearestLights(fresh, pos, 16, ranges)],
      'the pool with a count picks exactly what a freshly built list picks');
  }
  // and the default is still the whole array, for every caller that passes no count
  const some = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }];
  assert.equal(nearestLights(some, [0, 0, 0], 16, 5).length, 8, 'no count: the whole list');
  assert.equal(nearestLights(some, [0, 0, 0], 16, 5, null, 0, 1).length, 4, 'a count: only that much of it');
  const w = read('src/scenes/world.js');
  assert.match(w, /const e = _sceneLights\[n\] \?\? \(_sceneLights\[n\] = \{ x: 0, y: 0, z: 0 \}\);/, 'the objects are refilled, not re-minted');
  assert.match(w, /const t = state\.pixelTranslation\(p\.px, p\.py, _lightT\);/, 'and the translation writes into the one triple');
  assert.doesNotMatch(w, /sceneLights\.push\(\{ x: l\[0\]/, 'the per-lantern object literal is gone');
});
