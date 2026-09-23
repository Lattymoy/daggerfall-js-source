// AUDIT LIGHTING (2026-09-23, Mac: "Before we do that can we audit everything so far"): three lenses over the day's
// five arcs - LIGHT-NEAR1, QL-WEIGHT1, LC1, SC1 and HQ1 - and the findings paid here, pinned by execution.
//
// SC1: the motion memory was one matrix PER MESH, and the hosts draw one GPU mesh at many matrices (a dungeon's
// action doors share a model), so two doors of one model read as moved on every draw and every lantern near them
// paid the dynamic replay forever; a flat's FRAME was not in the memory (an animated flat froze in the cache); a
// batch built dynamic (`_dyn`, the gibs) was classified by an origin it never moves; the floating origin's crossing
// made every still caster dynamic for a second; `_dynamicNear` counted dynamics the replay never draws (a moving
// flame, a short flat, a ghost); the cache's fifty megabytes were allocated under `?shadowcache=off`.
// LIGHT-NEAR1: the panel-frame snapshot dropped the carried mask, which is now the only thing keeping the hand's
// torch out of the caster slots. HQ1: the tonemap's laws in JS (the shader's twin is pinned by text in el4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, elTonemapRGB, elTonemap, EL_WHITE } from '../src/render/enhancedLighting.js';
import { SHADOW_POINT_CASTERS, SHADOW_INSTANCE_MAX, SHADOW_INSTANCE_REACH, SHADOW_STILL_EPS, SHADOW_LIGHT_FLATS } from '../src/render/shadowPass.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const at = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

/** A recording fake GL (el2's shape). */
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

/** sc1's room: a bounded static mesh (two sub-meshes), a terrain tile, a lantern at the origin; the lane, no sun. */
function stand() {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  r.textures.set('1_1', { id: 't11' }); r.textures.set('201_1', { id: 't2011' }); r.textures.set('201_1#0', { id: 't2011f0' }); r.textures.set('201_1#1', { id: 't2011f1' }); r.textures.set('210_1', { id: 't2101' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 6]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }, { textureArchive: 1, textureRecord: 1, startIndex: 6, primitiveCount: 2 }] };
  const door = { vao: { id: 'vao-door' }, buffers: [], bounds: new Float32Array([0, 1, 0, 1.2]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const tile = { vao: { id: 'vao-t' }, indexCount: 6, bounds: new Float32Array([0, 0, 0, 10]) };
  const lightDir = new Float32Array([0.45, 0.8, 0.35]);
  const frame = (draw, lights = new Float32Array([0, 2, 0, 10])) => {
    r.setPointLights(lights, new Float32Array([1, 1, 1]));
    calls.length = 0;
    r.beginFrame(I, I, lightDir, WORLD_FRAME);
    const st = { ...sp.stats, casters: sp.casters, index: [...sp.shadowIndex], blit: count(calls, 'blitFramebuffer') };
    draw();
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp, calls, room, door, tile, frame };
}
const bb = (extra = {}) => ({ archive: 201, record: 1, vao: { id: 'vao-bb' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [2, 0, 0], bounds: new Float32Array([0, 0, 0, 1.2]), ...extra });

test('AUDIT SC1: ONE MESH AT TWO PLACES - two doors of one model are both still (each draw matched to the remembered placement nearest it), and when one swings it is the dynamic alone: the cache is redrawn once without it and the other door stays in the cache (mutants: one placement per mesh, so the second door is dynamic; the swing unseen)', () => {
  const { r, sp, room, door, tile, frame } = stand();
  assert.equal(SHADOW_INSTANCE_MAX, 64); assert.equal(SHADOW_INSTANCE_REACH, 2); assert.equal(SHADOW_STILL_EPS, 1e-3);
  let ax = 3;
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawMesh(door, at(ax, 0, 0), null); r.drawMesh(door, at(-3, 0, 0), null); };
  frame(draw);
  const first = frame(draw);
  assert.equal(first.staticFaces, 6, 'the cache drawn once');
  assert.ok(first.pointDraws > 6 * (2 + 1) && first.pointDraws <= 6 * (2 + 1 + 1 + 1), `six faces of the room's two and the tile, and the doors on the faces that see them (${first.pointDraws})`);
  assert.equal(first.dynFaces, 0, 'neither door is a dynamic: two placements of one mesh, each still');
  assert.equal(door._shInst.length, 2, 'two placements remembered on the mesh');
  for (let f = 0; f < 3; f++) { const st = frame(draw); assert.equal(st.pointDraws, 0, `still: frame ${f} draws nothing`); assert.equal(st.blit, 0); }
  // the east door swings: a hand's breadth a frame
  ax += 0.05; let st = frame(draw);
  assert.equal(sp.records[2].dynamic, true, 'the east door is a dynamic');
  assert.equal(sp.records[3].dynamic, false, 'the west door, the same mesh, is not');
  ax += 0.05; st = frame(draw);
  assert.equal(st.staticFaces, 6, 'the cache redrawn once without the swinging door');
  assert.equal(st.dynFaces, 6, 'and the door drawn alone over it');
  ax += 0.05; st = frame(draw);
  assert.equal(st.staticFaces, 0, 'the cache stands'); assert.equal(st.dynFaces, 6); assert.ok(st.pointDraws >= 1 && st.pointDraws <= 6, `the one door alone, on the faces that see it (${st.pointDraws})`);
  assert.equal(door._shInst.length, 2, 'still two placements: the swing is the east one moving, not a third');
});

test('AUDIT SC1: THE FLOATING ORIGIN - told of the crossing, the pass rebases every remembered placement and origin on its next draw, so the room is still where it was: the caches are redrawn for the lights that moved and NOTHING is a dynamic; untold, every caster reads as moved (mutants: the shift a no-op; the batch\'s origin left behind)', () => {
  const { r, sp, room, tile, frame } = stand();
  const npc = bb();
  const draw = (dx) => { r.drawMesh(room, at(dx, 0, 0), null); r.drawTerrain(tile, at(dx, 0, 0), {}, {}, 6.4); r.drawBillboards([npc], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
  frame(() => draw(0)); frame(() => draw(0));
  // the crossing: the host moves every world position by the offset, the light with them, and tells the renderer
  const off = [819.2, 0, -819.2];
  r.shadowOriginShift(off);
  npc.origin = [npc.origin[0] + off[0], npc.origin[1] + off[1], npc.origin[2] + off[2]];
  const L = new Float32Array([off[0], 2, off[2], 10]);
  let st = frame(() => draw(off[0]), L);
  assert.equal(sp.records[0].dynamic, false, 'the room is still');
  assert.equal(sp.records[1].dynamic, false, 'the tile is still');
  assert.equal(npc._shDyn, false, 'the flat is still');
  st = frame(() => draw(off[0]), L);
  assert.equal(st.staticFaces, 6, 'the light moved with the world, so its cache is drawn again (its slot is matched by position)');
  assert.equal(st.dynFaces, 0, 'and nothing is dynamic');
  st = frame(() => draw(off[0]), L);
  assert.equal(st.pointDraws, 0, 'then nothing');
  assert.equal(sp._shiftGen, 1);
  // the mesh's z did not follow the world - a real move across the crossing is still seen
  frame(() => { r.drawMesh(room, at(off[0], 0, 0.5), null); r.drawTerrain(tile, at(off[0], 0, 0), {}, {}, 6.4); }, L);
  assert.equal(sp.records[0].dynamic, true, 'a move across the crossing is a move');
  // by source: the world host says so where it shifts everything else, and the renderer forwards it
  assert.match(rd('src/scenes/world.js'), /sky\.offsetOrigin\(r\.offset\);[^\n]*\n\s*renderer\.shadowOriginShift\?\.\(r\.offset\);/, 'world.js: beside the sky\'s and the guards\'');
  assert.match(rd('src/render/renderer.js'), /shadowOriginShift\(offset\) \{ this\._shadowPass\?\.shiftOrigin\(offset\); \}/);
});

test('AUDIT SC1: a batch built DYNAMIC is a dynamic from its first sight (moveBillboardBatch rewrites its vertices with the origin left null), and a flat whose FRAME changes has moved (its silhouette is the frame\'s) (mutants: `_dyn` ignored; the frame left out of the memory)', () => {
  const { r, sp, room, tile, frame } = stand();
  const gib = bb({ _dyn: true, vao: { id: 'vao-gib' } });
  const idle = bb({ frame: 0, vao: { id: 'vao-idle' }, origin: [-2, 0, 0] });
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawBillboards([gib, idle], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
  frame(draw);
  assert.equal(gib._shDyn, true, 'the gib batch: dynamic at first sight');
  assert.equal(idle._shDyn, false, 'the idle flat: still');
  frame(draw);
  assert.equal(gib._shDyn, true, 'and still dynamic, unmoved');
  idle.frame = 1; frame(draw);
  assert.equal(idle._shDyn, true, 'the frame changed: the flat has moved');
  assert.equal(sp.records[2].dynamic, true);
});

test('AUDIT SC1: a dynamic the replay would not DRAW is no reason to replay - a moving flame (SHADOW_LIGHT_FLATS), a flat under the minimum height: no blit, no dynamic faces, the slot served from its cache (mutant: the replay\'s skips left out of `_dynamicNear`)', () => {
  const { r, room, tile, frame } = stand();
  const flame = bb({ archive: SHADOW_LIGHT_FLATS, vao: { id: 'vao-flame' }, origin: [1, 1, 0], size: { w: 0.5, h: 0.8 } });
  const pebble = bb({ vao: { id: 'vao-pebble' }, origin: [-1, 0, 0], size: { w: 0.4, h: 0.3 } });
  let t = 0;
  const draw = () => { flame.origin = [1 + 0.01 * t, 1, 0]; pebble.origin = [-1 - 0.02 * t, 0, 0]; t++; r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawBillboards([flame, pebble], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
  frame(draw); frame(draw);   // records; the first replay (the two flats' first sight is still; they move on the next)
  frame(draw);
  for (let f = 0; f < 3; f++) {
    const st = frame(draw);
    assert.equal(flame._shDyn, true, 'the flame moves'); assert.equal(pebble._shDyn, true, 'the pebble moves');
    assert.equal(st.dynFaces, 0, `frame ${f}: no dynamic replay for casters that cast nothing`);
    assert.equal(st.blit, 0); assert.equal(st.cachedSlots, 1);
  }
});

test('AUDIT SC1: the static cache is made on the first frame that wants it - not at the lane\'s install, and never behind `?shadowcache=off` (mutant: allocated with the lane)', () => {
  const { r, sp, calls, room, tile, frame } = stand();
  assert.equal(count(calls, 'texStorage3D'), 2, 'the sun\'s and the casters\' arrays with the lane');
  assert.equal(sp.cacheTex, null);
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  frame(draw);
  assert.equal(sp.cacheTex, null, 'no caster replayed yet');
  const all = [];
  const gl = r.gl;
  const wrap = gl.texStorage3D;
  frame(draw);
  assert.notEqual(sp.cacheTex, null, 'made on the first replay with a caster');
  assert.equal(sp.cacheFbos.length, 6 * SHADOW_POINT_CASTERS);
  void all; void wrap;
  // the door shut before any frame: never made
  const other = stand();
  other.r.setShadowCache(false);
  other.frame(() => { other.r.drawMesh(other.room, I, null); }); other.frame(() => { other.r.drawMesh(other.room, I, null); });
  assert.equal(other.sp.cacheTex, null, 'shut: the old path, no cache');
  assert.equal(other.sp.cacheFbos.length, 0);
});

test('AUDIT LIGHT-NEAR1: the panel-frame snapshot carries the CARRIED MASK - a hand\'s torch is still the hand\'s after the automap or a paper doll drew a panel (mutant: the mask dropped on restore, so the torch takes a caster slot)', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const data = new Float32Array([0, 1.7, 0, 3, 5, 2, 1, 14]);
  data.carried = new Uint8Array([1, 0]);
  r.setPointLights(data, new Float32Array([1, 1, 1]));
  assert.deepEqual([...r._pointCarried], [1, 0]);
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    r.setPointLights(new Float32Array([0, 0, 0, 5]), new Float32Array([1, 1, 1]));
    assert.equal(r._pointCarried, null, 'the panel\'s own lights carry no mask');
  });
  assert.deepEqual([...r._pointCarried], [1, 0], 'restored with the lights');
  assert.match(rd('src/render/renderer.js'), /pointCarried: this\._pointCarried,/, 'in the snapshot');
  assert.match(rd('src/render/renderer.js'), /this\.setPointLights\(s\.pointLights, s\.pointColor, s\.pointColors\);\n\s*this\._pointCarried = s\.pointCarried \?\? null;/, 'and restored after the lights (setPointLights reads the mask off the array, and a subarray has none)');
});

test('AUDIT HQ1: the colour curve\'s laws in JS - black to black, a grey through the scalar curve unchanged, the white point to display white, monotone along a hue ray, and a saturated flame KEPT ITS HUE (brighter than the per-channel curve left it, and never past a few percent over one - the curve\'s own shape, clamped at the encode)', () => {
  assert.deepEqual(elTonemapRGB([0, 0, 0]), [0, 0, 0]);
  for (const g of [0.1, 0.5, 1, EL_WHITE, 3]) {
    const t = elTonemapRGB([g, g, g]);
    assert.ok(Math.abs(t[0] - elTonemap(g)) < 1e-9 && Math.abs(t[1] - t[0]) < 1e-9 && Math.abs(t[2] - t[0]) < 1e-9, `grey ${g} is the scalar curve`);
  }
  const w = elTonemapRGB([EL_WHITE, EL_WHITE, EL_WHITE]);
  assert.ok(Math.abs(w[0] - 1) < 1e-9, 'the white point is display white');
  let last = [0, 0, 0];
  for (let k = 0.05; k <= 6; k += 0.05) {
    const c = elTonemapRGB([k, k * 0.55, k * 0.2]);   // a flame's hue, brightening
    assert.ok(c[0] >= last[0] - 3e-4 && c[1] >= last[1] - 3e-4 && c[2] >= last[2] - 3e-4, `monotone at ${k.toFixed(2)}`);
    assert.ok(c.every((v) => v >= 0), `no negative at ${k.toFixed(2)}`);
    if (k <= EL_WHITE) assert.ok(c.every((v) => v <= 1.05), `bounded below the white point at ${k.toFixed(2)}: ${c}`);   // the curve lets a saturated hue a few percent over one below the white point (Reinhard-Jodie's own shape; elEncode clamps it)
    last = c;
  }
  const flame = elTonemapRGB([3, 0, 0]);
  assert.ok(flame[0] > elTonemap(3), 'the hue kept: brighter than the per-channel curve');
  assert.ok(flame[1] < 1e-9 && flame[2] < 1e-9, 'and still red');
  assert.deepEqual(elTonemapRGB([-1, 0.5, -2]), elTonemapRGB([0, 0.5, 0]), 'negatives clamped');
});
