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

test('PERF-ON2 / PERF-CROWD: the host culls the peers AND the live crowd, by the batch\u2019s own sphere, lifted for the bottom anchor', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(cullOn && billboardOutside\(b\)\) continue;[\s\S]{0,80}?allBatches\.push\(b\);/,
    'every peer batch is tested before it is submitted');
  assert.doesNotMatch(w, /if \(remotePlayers\) for \(const b of remotePlayers\.batches\(\)\) allBatches\.push\(b\);/, 'the unconditional push is gone');
  // PERF-CROWD: and the townspeople, the watch, the foes, the piles, the
  // blow effects, the torches and the camps - the same list, never culled
  // at all until now, and in a town most of the frame's billboards.
  assert.match(w, /if \(cullOn && livePersonBatches\.length\) \{[\s\S]{0,400}?if \(!billboardOutside\(b\)\) livePersonBatches\[keep\+\+\] = b;\n\s*else if \(renderer\.shadowReachBatch\(b\)\) castBatches\.push\(b\);[\s\S]{0,160}?livePersonBatches\.length = keep;/,
    'the crowd is filtered IN PLACE - the cull mints no array of its own (SHADOW-REACH: a rejected townsman a shadow reaches goes to the casters\' list, which the frame already holds)');
  assert.doesNotMatch(w, /const peerBatchOutside/, 'one test for both lists, not two');
  // THE LIFT is the whole correctness of it: the sphere is stored about the
  // placement point and the sprite stands its full height above that point.
  // GHOST1: and it lives in ONE home now - this host asks `batchVisible`,
  // which is what the shadow replay and the air pass's emitters ask too.
  assert.match(w, /const billboardOutside = \(b\) => !batchVisible\(_planes, b\);/, 'the host delegates, it does not hand-roll the sphere');
  assert.doesNotMatch(w, /sphereInPlanes\(_planes/, 'no second copy of the test in the host');
  const bounds = read('src/render/bounds.js');
  assert.match(bounds, /s\[1\] \+ \(o \? o\[1\] : 0\) \+ \(b\.size\?\.h \?\? 0\) \* 0\.5/, 'the sphere centre is lifted half a height, in batchVisible');
  assert.match(bounds, /const s = b\.bounds;\n\s*if \(!s\) return true;/, 'a batch with no bounds is always drawn');
  const r = read('src/render/renderer.js');
  assert.match(r, /\+ uUp \* \(\(aCorner\.y \+ 0\.5\) \* uSize\.y\)/, 'the VS stands the quad from the placement point UP - which is why the lift exists');
  assert.match(r, /bounds\[3\] \+= Math\.hypot\(size\.w, size\.h\) \* 0\.5;/, 'and the stored radius already covers hypot(w, h) / 2, which is what the lifted centre needs');
});

test('PERF-ON2 / PERF-CROWD: the lifted sphere really does contain the sprite, and the unlifted one does not', async () => {
  const { sphereInPlanes, boundsOf } = await import('../src/render/bounds.js');
  // a person: tall and narrow, which is the shape the unlifted sphere fails on
  const w = 1.0, h = 3.0;
  const bounds = boundsOf([0, 0, 0]); bounds[3] += Math.hypot(w, h) * 0.5;
  assert.ok(bounds[3] < h, `the STORED sphere does not reach the sprite's top (r ${bounds[3].toFixed(2)} < ${h}) - culling by it would clip heads`);
  assert.ok(Math.abs(h - h * 0.5) <= bounds[3] + 1e-9, 'the LIFTED sphere does reach it');
  // a frustum that keeps only y >= h - 0.2: the head is in view, the feet are not
  const planes = new Float32Array(24);
  for (let k = 0; k < 6; k++) { planes[k * 4 + 1] = 1; planes[k * 4 + 3] = -(h - 0.2); }
  assert.equal(sphereInPlanes(planes, 0, 0, 0, bounds[3]), false, 'unlifted: the sprite is culled while its head is in view');
  assert.equal(sphereInPlanes(planes, 0, h * 0.5, 0, bounds[3]), true, 'lifted: it is kept');
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

test('PERF-BASIS: the shadow replay uploads the basis once, not once a flat - and the lantern arm still turns each flat to face it', () => {
  const sp = read('src/render/shadowPass.js');
  // WHAT IS HOISTED. `up` is the constant [0,1,0] (or the record's, fixed
  // for the record) and `right` is the frame's sun basis, set once in
  // frame() before the cascade loop - so three cascades deep, every frame,
  // a sun replay was paying two uniform uploads a flat for two numbers
  // that could not change.
  assert.match(sp, /const perBatchRight = !recordBasis && !!lightPos;/, 'exactly one of the four cases varies per flat');
  assert.match(sp, /gl\.uniform3fv\(P\.bb\.up, recordBasis \? r\.up : this\._up\);\n\s*if \(!perBatchRight\) gl\.uniform3fv\(P\.bb\.right, recordBasis \? r\.right : this\._right\);/,
    'and both go up ONCE a record, outside the batch loop');
  // WHAT IS NOT. A lantern's replay turns every flat to face the lantern -
  // that is EL6's own law, and hoisting it would flatten every sprite's
  // shadow to one direction. The mutation campaign found nothing in the
  // suite that could fail this, which is why it is stated here.
  assert.match(sp, /if \(perBatchRight\) \{[\s\S]{0,400}?this\._right\[0\] = dz \/ l; this\._right\[1\] = 0; this\._right\[2\] = -dx \/ l;\n\s*gl\.uniform3fv\(P\.bb\.right, this\._right\);/,
    'the lantern arm recomputes the basis per flat AND uploads it');
  assert.equal((sp.match(/gl\.uniform3fv\(P\.bb\.right/g) ?? []).length, 2, 'two uploads in the file: the hoisted one and the lantern\u2019s');
  // and the bind skips its repeats, as the main pass's has since PERF3
  assert.match(sp, /if \(tex !== lastTex\) \{ gl\.bindTexture\(gl\.TEXTURE_2D, tex\); lastTex = tex; \}/, 'a run of flats sharing a record binds once');
  assert.match(sp, /let lastTex = null;/, 'reset per record, so a record cannot inherit the last one\u2019s texture');
});

test('PERF-CROWD2: the billboard PASS culls, so no host can forget to - and it culls after the shadow record, so nothing stops casting', () => {
  const r = read('src/render/renderer.js');
  // the same bug was in every host: the dungeon's mobiles, drops and
  // spells, the interior's flats, the fixed city's townspeople, and
  // worldModes' five separate uncut calls. Seven call sites, and an
  // eighth waiting to be written. The test lives in the pass now.
  assert.match(r, /const bbCull = !this\._bbCullOff && !!this\._proj && !!this\._view;/, 'the pass decides, once a call');
  assert.match(r, /if \(this\._casting\) this\._shadows\.recordBillboards\([\s\S]*?if \(bbCull\) spherePlanes\(/,
    'the planes are taken AFTER the shadow record - everything still casts, only the drawing is culled');
  // AUDIT PERF-CROWD2 F1: keyOf runs BEFORE the cull. The shadow replay
  // and the air pass both read `b._bbKey` and both take it as it stands -
  // `?? recompute` fires only when it is ABSENT, never when it is STALE -
  // so a culled batch that never re-keyed would cast the silhouette of
  // whatever frame it was on when it left the view. A mobile animates by
  // writing its RECORD (MAC4), and the cascades reach 240 units.
  assert.match(r, /keyOf\(b\);\n\s*if \(bbCull && !this\._bbVisible\(b\)\) \{ this\.stats\.bbCulled\+\+; continue; \}[\s\S]{0,40}?opaque\.push\(b\);/,
    'the opaque partition keys every batch, THEN culls');
  for (const other of ['src/render/shadowPass.js', 'src/render/airPass.js']) {
    assert.match(read(other), /const key = b\._bbKey \?\? \(b\.frame == null/, `${other} reads the key this pass maintains`);
  }
  assert.match(r, /if \(bbCull && !this\._bbVisible\(b\)\) \{ this\.stats\.bbCulled\+\+; continue; \}[\s\S]{0,60}?\(blended \?\?= \[\]\)\.push\(b\);/, 'and the blended one - the ghosts and the concealed are billboards too');
  // GHOST1: the same test as the host's and the two replays' - the one home
  assert.match(r, /_bbVisible\(b\) \{\n\s*return batchVisible\(this\._bbPlanes, b\);\n\s*\}/, 'the pass delegates to batchVisible');
  // the ?cull=off door still turns everything off, as it does for EV3
  assert.match(r, /this\._bbCullOff = cullDisabled\(\);/, 'one read, at construction');
  assert.match(r, /bbCulled: 0/, 'and the frame says how many it skipped');
});

test('AUDIT PERF-LIGHTS F2: a per-light range array shorter than the light list gives a real range, not a silent NaN', async () => {
  const { nearestLights, CITY_LIGHT_RANGE } = await import('../src/world/cityLights.js');
  // PRE-EXISTING, found by the audit rather than caused by it: the world
  // host sizes its CityLightAnimator at 4096 lanterns and nothing checks
  // the light list against that. Past the end the range read `undefined`,
  // which lands in a Float32Array as NaN - and a NaN far plane goes on to
  // the point-shadow matrices and the shader's depth reconstruction,
  // where it fails silently and totally. A cliff with no edge marked.
  const lights = []; for (let i = 0; i < 20; i++) lights.push({ x: i, y: 0, z: 0 });
  const short = new Float32Array(5);        // five ranges for twenty lights
  const out = nearestLights(lights, [0, 0, 0], 16, short, null, 0, 20);
  const w = [...out].filter((_, i) => i % 4 === 3);
  assert.equal(w.some(Number.isNaN), false, 'not one NaN far plane');
  assert.ok(w.slice(5).every((v) => v === CITY_LIGHT_RANGE), 'past the end it is the module\u2019s own default range');
  assert.ok(w.slice(0, 5).every((v) => v === 0), 'and inside it, the array\u2019s own values, untouched');
  // a full-length array is unaffected in every entry
  const full = new Float32Array(20); for (let i = 0; i < 20; i++) full[i] = 11 + i;
  const ok = nearestLights(lights, [0, 0, 0], 16, full, null, 0, 20);
  assert.deepEqual([...ok].filter((_, i) => i % 4 === 3), [...Array(16)].map((_, i) => 11 + i), 'the ordinary path is byte for byte what it was');
});
