// EV2 - THE ALLOCATION SWEEP, pinned. The render loop was minting
// thousands of short-lived objects per frame: drawMesh's per-sub-mesh
// `${archive}_${record}` string (the single largest GC source),
// mat4.multiply's unconditional Float32Array(16), one {l,index,d}
// object per light per frame in nearestLights, and twenty-two
// `[0,1,0]` up-axis literals. Each fix is pinned two ways: the
// behavior is IDENTICAL, and the allocation is gone (source pins,
// identity checks, or a counting stub - the audit26_dungeonfoes
// Proxy-GL precedent).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { multiply, trs, identity, UP_Y } from '../src/world/mat4.js';
import { nearestLights } from '../src/world/cityLights.js';
import { Renderer } from '../src/render/renderer.js';
import { BODY } from '../src/world/windmillMesh.js';   // the frozen bake the field crash drew
import { StreamingWorldState } from '../src/world/streamingWorld.js';

test('EV2: multiply - same product, provided out returned, aliasing safe, no allocation in the body', () => {
  const a = trs(1, 2, 3, 30, 60, 90);
  const b = trs(-4, 5, 0, 0, 45, 0);
  const reference = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
    reference[col * 4 + row] = s;
  }
  const out = new Float32Array(16);
  assert.equal(multiply(a, b, out), out, 'the provided out comes back');
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(out[i] - reference[i]) < 1e-6);
  // aliasing: out === a must not corrupt the product mid-multiply
  const a2 = new Float32Array(a);
  multiply(a2, b, a2);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(a2[i] - reference[i]) < 1e-6, 'aliased out is exact');
  // the source pin: the body allocates nothing (the scratch is module-level)
  const src = readFileSync('src/world/mat4.js', 'utf8');
  const body = src.slice(src.indexOf('export function multiply'), src.indexOf('const DEG2RAD'));
  assert.ok(!/const r = new Float32Array/.test(body), 'the per-call scratch is gone');
});

test('EV2: nearestLights - the bounded selection answers EXACTLY what map/sort/slice answered, ties and all', () => {
  // A deterministic fixture with deliberate distance TIES, including at
  // the cut boundary - the case where an unstable selection diverges.
  const lights = [];
  let seed = 0xbeef;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  for (let i = 0; i < 60; i++) {
    const d = Math.floor(rnd() * 12);   // heavy tie collisions
    lights.push({ x: d, y: 0, z: 0, i });
  }
  const pos = [0, 0, 0];
  // the old implementation, verbatim, as the oracle
  const oracle = (max, range, colorOf) => {
    const perLight = typeof range !== 'number' ? range : null;
    const sorted = lights.map((l, index) => {
      const dx = l.x - pos[0], dy = l.y - pos[1], dz = l.z - pos[2];
      return { l, index, d: dx * dx + dy * dy + dz * dz };
    }).sort((a, b) => a.d - b.d).slice(0, max);
    const out = new Float32Array(sorted.length * 4);
    for (let i = 0; i < sorted.length; i++) {
      out[i * 4] = sorted[i].l.x; out[i * 4 + 1] = sorted[i].l.y; out[i * 4 + 2] = sorted[i].l.z;
      out[i * 4 + 3] = perLight ? perLight[sorted[i].index] : range;
    }
    if (!colorOf) return out;
    const colors = new Float32Array(sorted.length * 3);
    for (let i = 0; i < sorted.length; i++) {
      const c = colorOf(sorted[i].l, sorted[i].index);
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    return { data: out, colors };
  };
  const ranges = lights.map((_, i) => 10 + i);
  const colorOf = (l, i) => [i / 60, l.x / 12, 0.5];
  assert.deepEqual([...nearestLights(lights, pos, 16, 18)], [...oracle(16, 18)]);
  assert.deepEqual([...nearestLights(lights, pos, 16, ranges)], [...oracle(16, ranges)]);
  const got = nearestLights(lights, pos, 16, 18, colorOf);
  const want = oracle(16, 18, colorOf);
  assert.deepEqual([...got.data], [...want.data], 'positions match with ties at the cut');
  assert.deepEqual([...got.colors], [...want.colors], 'the colour arm rides the SAME selection');
  // fewer lights than the cap: the count follows the population
  const few = lights.slice(0, 5);
  const gotFew = nearestLights(few, pos, 16, 18);
  assert.equal(gotFew.length, 5 * 4);
  const sortedFew = few.map((l, index) => ({ l, index, d: l.x * l.x })).sort((a, b) => a.d - b.d);
  for (let i = 0; i < 5; i++) assert.equal(gotFew[i * 4], sortedFew[i].l.x);
});

test('EV2: drawMesh resolves each sub-mesh texture ONCE per generation, not per frame', () => {
  // The audit26_dungeonfoes stubGl precedent: enough of a WebGL2
  // context, as a Proxy, for the Renderer to construct and draw.
  const calls = { getProgramParameter: 0 };
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
      return () => {};
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  const r = new Renderer(canvas);
  // a fake uploaded texture, and a counting Map in front of the real one
  let lookups = 0;
  const realGet = Map.prototype.get.bind(r.textures);
  r.textures.set('7_3', { fake: true });
  r.textures.get = (k) => { lookups++; return realGet(k); };
  const mesh = {
    vao: {},
    subMeshes: [{ textureArchive: 7, textureRecord: 3, primitiveCount: 2, startIndex: 0 }],
  };
  const m = identity();
  r.drawMesh(mesh, m);
  assert.equal(lookups, 1, 'first draw resolves');
  r.drawMesh(mesh, m);
  r.drawMesh(mesh, m);
  assert.equal(lookups, 1, 'later draws ride the cache');
  assert.equal(r.stats.draws, 3, 'and the stats counter saw all three');
  // a texture upload bumps the generation and the next draw re-resolves
  r._texGen++;
  r.drawMesh(mesh, m);
  assert.equal(lookups, 2, 'a generation bump re-resolves once');
  // a different remap identity re-resolves too (per-scene remaps)
  const remap = new Map([['7_3', '7_3']]);
  r.drawMesh(mesh, m, remap);
  assert.equal(lookups, 3, 'a new remap object cannot ride the old cache');
});

test('EV2 HOTFIX: a FROZEN model draws and caches - createMesh copies the sub-meshes it stamps', () => {
  // Field crash (2026-08-31, Firefox): "can't define property _evTex:
  // Object is not extensible". The windmill bake ships its sub-meshes
  // as FROZEN module constants, createMesh reused them by reference,
  // and EV2's cache write threw on the first mill drawn, taking the
  // frame loop down. The law: the renderer stamps renderer-private
  // fields only on objects it OWNS - createMesh copies. Driven here
  // with the REAL frozen bake, not a fixture.
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  const r = new Renderer(canvas);
  assert.ok(Object.isFrozen(BODY.subMeshes[0]), 'the bake really is frozen - the case from the field');
  const mesh = r.createMesh(BODY);
  assert.notEqual(mesh.subMeshes[0], BODY.subMeshes[0], 'the gpu mesh owns copies, not the bake\'s constants');
  let lookups = 0;
  const realGet = Map.prototype.get.bind(r.textures);
  for (const sm of BODY.subMeshes) r.textures.set(`${sm.textureArchive}_${sm.textureRecord}`, { fake: true });
  r.textures.get = (k) => { lookups++; return realGet(k); };
  r.drawMesh(mesh, identity());
  r.drawMesh(mesh, identity());
  assert.equal(lookups, BODY.subMeshes.length, 'resolved once, cached on the copies - no throw, no re-lookup');
  assert.ok(!('_evTex' in BODY.subMeshes[0]), 'and the frozen bake itself is untouched');
});

test('EV2: the shared up axis is one array, and the draw loops use it', () => {
  assert.deepEqual([...UP_Y], [0, 1, 0]);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!src.includes('new Float32Array([0, 1, 0])'), `${f} still allocates the up axis`);
    assert.ok(/\bUP_Y\b/.test(src), `${f} rides the shared axis`);
  }
  // and precipitation neither queries CURRENT_PROGRAM nor restores it -
  // the R9 law: every draw entry point owns its program binding
  const precip = readFileSync('src/render/precipitation.js', 'utf8');
  assert.ok(!precip.includes('CURRENT_PROGRAM'), 'the per-frame driver query is gone');
});

test('EV2: pixelTranslation with out reuses the array and answers identically', () => {
  const s = new StreamingWorldState(3);
  s.init(207, 213);
  const fresh = s.pixelTranslation(208, 212);
  const scratch = [0, 0, 0];
  const back = s.pixelTranslation(208, 212, scratch);
  assert.equal(back, scratch, 'out comes back');
  assert.deepEqual([...back], [...fresh]);
});
