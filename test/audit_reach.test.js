// AUDIT REACH (2026-09-23, Mac: "let's do an audit" - three lenses over SHADOW-REACH, VOL1 and BOUNCE1 and the audit
// commit before them): the shadow cache's motion memory paid twice more, and the recentre's records.
//
// B1: `_moved` matched a draw to the NEAREST remembered placement within the reach, so two still placements of one
// mesh closer than two units (double doors, an arrow beside another) overwrote each other every draw and read as
// moved for ever - the placement itself is matched first now. B2: the memory capped at 64 and never evicted, on a
// mesh cache that is never destroyed - a session's dungeons filled it and every door after was dynamic; 128 now,
// and a placement not drawn for a hold is evicted for a new one. B3: the flat memory watched `frame`, and a
// townsman's idle and a foe's swing rewrite `record` (the key is record#frame) and turn by the sign of size.w - the
// cache kept a stale silhouette; the record and the flip are in the memory. B4: the records in hand at a recentre
// were replayed against the moved lights and eye - the crossing's frame had no shadow and every cache was built
// twice; shiftOrigin moves them too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_INSTANCE_MAX, SHADOW_DYNAMIC_HOLD, SHADOW_GLSL } from '../src/render/shadowPass.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const at = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const count = (calls, name) => calls.filter((c) => c[0] === name).length;

function stand() {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  r.textures.set('1_1', { id: 't11' }); r.textures.set('201_1', { id: 't2011' }); r.textures.set('201_2', { id: 't2012' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 6]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const door = { vao: { id: 'vao-door' }, buffers: [], bounds: new Float32Array([0, 1, 0, 1.2]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const tile = { vao: { id: 'vao-t' }, indexCount: 6, bounds: new Float32Array([0, 0, 0, 10]) };
  const lightDir = new Float32Array([0.45, 0.8, 0.35]);
  const frame = (draw, lights = new Float32Array([0, 2, 0, 10])) => {
    r.setPointLights(lights, new Float32Array([1, 1, 1]));
    calls.length = 0;
    r.beginFrame(I, I, lightDir, WORLD_FRAME);
    const st = { ...sp.stats, casters: sp.casters, blit: count(calls, 'blitFramebuffer') };
    draw();
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp, calls, room, door, tile, frame };
}

test('AUDIT REACH B1: two still placements of one mesh closer than the reach are BOTH still - each draw is its own placement first (the first cut matched the nearest, and the pair overwrote each other every draw); one of them swinging is the dynamic alone (mutants: the nearest first; the exact match dropped)', () => {
  const { r, sp, room, door, tile, frame } = stand();
  let ax = 1.2;
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawMesh(door, at(ax, 0, 0), null); r.drawMesh(door, at(0, 0, 0), null); };   // a double door: 1.2 apart, within the reach of 2
  frame(draw); frame(draw);
  for (let f = 0; f < 3; f++) { frame(draw); assert.equal(sp.records[2].dynamic, false, 'the east leaf is still'); assert.equal(sp.records[3].dynamic, false, 'and the west'); }
  assert.equal(door._shInst.length, 2, 'two placements remembered');
  const st = frame(draw);
  assert.equal(st.pointDraws, 0, 'the still room draws nothing');
  ax += 0.05; frame(draw);
  assert.equal(sp.records[2].dynamic, true, 'the east leaf swings'); assert.equal(sp.records[3].dynamic, false, 'the west stands');
  assert.equal(door._shInst.length, 2, 'the swing is the east placement moving, not a third');
});

test('AUDIT REACH B2: the memory holds SHADOW_INSTANCE_MAX placements and EVICTS one not drawn for a hold when a new one comes - a session\'s dungeons no longer fill it (the first cut capped at 64 for ever, every door after dynamic); with every placement live the new one is dynamic, never wrong (mutants: no eviction; a live placement evicted)', () => {
  const { r, sp, room, door, tile, frame } = stand();
  assert.equal(SHADOW_INSTANCE_MAX, 128);
  const many = (n, from = 0) => () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); for (let i = 0; i < n; i++) r.drawMesh(door, at(from + i * 3, 0, 40), null); };
  frame(many(SHADOW_INSTANCE_MAX)); frame(many(SHADOW_INSTANCE_MAX));
  assert.equal(door._shInst.length, SHADOW_INSTANCE_MAX, 'full');
  // one more, with every placement drawn this frame: dynamic
  const full = () => { many(SHADOW_INSTANCE_MAX)(); r.drawMesh(door, at(-9, 0, 0), null); };
  frame(full);
  assert.equal(sp.records[2 + SHADOW_INSTANCE_MAX].dynamic, true, 'past a full, live memory: dynamic (never wrong, only dearer)');
  // the old placements stop being drawn; a hold later a new one evicts the stalest
  const fresh = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawMesh(door, at(-9, 0, 0), null); };
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 2; f++) frame(fresh);
  frame(fresh);
  assert.equal(sp.records[2].dynamic, false, 'the new placement took a stale one\'s place, and is still');
  assert.equal(door._shInst.length, SHADOW_INSTANCE_MAX, 'the memory did not grow');
});

test('AUDIT REACH B3: a flat whose RECORD changes (a townsman\'s idle, a foe\'s swing - the key is record#frame) or whose FLIP changes (a turn: the sign of size.w) has moved - the first cut watched `frame` alone and the cache kept a stale silhouette (mutants: the record forgotten; the flip forgotten)', () => {
  const { r, sp, room, tile, frame } = stand();
  const npc = { archive: 201, record: 1, vao: { id: 'vao-npc' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [2, 0, 0], bounds: new Float32Array([0, 0, 0, 1.2]) };
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawBillboards([npc], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
  frame(draw); frame(draw); frame(draw);
  assert.equal(npc._shDyn, false, 'standing still on one record: still');
  npc.record = 2; frame(draw);
  assert.equal(npc._shDyn, true, 'the record changed: moved');
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 1; f++) frame(draw);
  assert.equal(npc._shDyn, false, 'a hold later, still on the new record');
  npc.size = { w: -1, h: 2 }; frame(draw);
  assert.equal(npc._shDyn, true, 'turned about (the flip): moved');
  assert.equal(sp.records[2].dynamic, true);
});

test('AUDIT REACH B4: the records in hand follow the floating origin - told of a crossing, the pass moves the matrices and spheres it copied (a batch\'s origin is the host\'s own, already moved), so the crossing\'s frame replays them where the moved lights and eye are: one cache build, not an empty one and a real one (mutants: the records left behind)', () => {
  const { r, sp, room, tile, frame } = stand();
  const draw = (dx) => { r.drawMesh(room, at(dx, 0, 0), null); r.drawTerrain(tile, at(dx, 0, 0), {}, {}, 6.4); };
  frame(() => draw(0)); frame(() => draw(0));
  // the host moves the world and the light by the offset, and tells the pass, between two frames: the records of the
  // frame just drawn are still in hand
  const off = [819.2, 0, 0];
  assert.equal(sp.count, 2, 'two records in hand');
  const before = sp.records[0].matrix[12];
  r.shadowOriginShift(off);
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  assert.ok(near(sp.records[0].matrix[12], before + off[0]), 'the mesh\'s matrix moved with the origin'); assert.ok(near(sp.records[0].sphere[0], off[0]), 'and its sphere');
  assert.ok(near(sp.records[1].matrix[12], off[0]), 'the tile too');
  const L = new Float32Array([off[0], 2, 0, 10]);
  const st = frame(() => draw(off[0]), L);
  assert.equal(st.staticFaces, 6, 'the crossing\'s frame: the moved light\'s cache built once, from records where they stand');
  assert.ok(st.pointDraws >= 6 * 2, `and it holds the room and the tile (${st.pointDraws})`);
  const st2 = frame(() => draw(off[0]), L);
  assert.equal(st2.staticFaces, 0, 'and not again: the signature was whole the first time');
  assert.equal(st2.pointDraws, 0);
});

test('AUDIT REACH: the cube\'s faces are looked up in the cube\'s own order in BOTH lookups - +X is face 0, -X 1, +Y 2, -Y 3, +Z 4, -Z 5, the order the six layers were drawn in (CUBE_FACES) - the receiver\'s and the air\'s (mutant: a sign swapped, which the fake GL cannot see and no pin held)', () => {
  const faces = SHADOW_GLSL.match(/if \(a\.x >= a\.y && a\.x >= a\.z\) \{ face = d\.x > 0\.0 \? 0 : 1; m = a\.x; \}\n  else if \(a\.y >= a\.z\) \{ face = d\.y > 0\.0 \? 2 : 3; m = a\.y; \}\n  else \{ face = d\.z > 0\.0 \? 4 : 5; m = a\.z; \}/g) || [];
  // AUDIT 68 S17-shadowpass-layer-dup: the six lines live once, in cubeFaceUv, and all four readers take them
  assert.equal(faces.length, 1, 'the one face pick');
  assert.equal((SHADOW_GLSL.match(/vec2 uv = cubeFaceUv\(d, face, m\);/g) || []).length, 4, 'pointShadowAt and pointShadowOne, and DISC15\'s pointShadowLoAt and pointShadowLoOne');
  assert.match(SHADOW_GLSL, /float layer = float\(k \* 6 \+ face\);/);
  assert.match(SHADOW_GLSL, /vec4\(uv, float\(k \* 6 \+ face\), cubeDepthOfM/);
});
