// DISC15 (2026-09-24, Mac: "Constant reports of interior light flickering ... Its not solved"): EVERY LIGHT IN A
// ROOM CASTS.
//
// The cause, measured on the real TVRNGM03 (a tavern: twenty lamps of range 15-18) through the real renderer on
// SwiftShader: only the eight lamps nearest the eye had a cube map, and a lamp without one lit through the ceiling
// at full strength (and took EL8's contact march over a frame-old depth, which flashed 40% of the screen dark on the
// first frame the eye moved). Every walk across the room swapped lamps in and out of the eight, and each swap moved
// 30-98% of the screen by 12+ levels in one frame - DISC6's keep margin only moved where the swap happened. The lo
// tier (render/shadowPass.js) gives every light a 256 map of the room's static casters in a room its host draws
// whole (renderer.everyLightCasts, the two building hosts), so a lamp past the eight reads its own map and the
// eight changing changes a shadow's resolution, never whether the ceiling is there.
//
// Pinned on the fake GL: a light past the eight reads a lo slot through the caster table (SHADOW_POINT_CASTERS + j),
// the eight their 512 slots, the hand's light neither; the lo maps are drawn once and then served with no draw;
// slots stick to their light across a re-sorted list; a light gone frees its slot and a light arriving is drawn at
// once; a changed static set redraws at most SHADOW_LO_REBUILDS a frame; the first frame through a door drops the street's
// records, so no map is drawn from them; a host that
// does not ask never has it; the array grows by SHADOW_LO_STEP; the shaders read either tier; the hosts ask.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_BB_FS } from '../src/render/enhancedLighting.js';
import { SHADOW_POINT_CASTERS, SHADOW_LO_SIZE, SHADOW_LO_STEP, SHADOW_LO_REBUILDS, SHADOW_LO_UNIT, SHADOW_GLSL, shadowFarFor } from '../src/render/shadowPass.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const at = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

/** A recording fake GL (sc1's shape). */
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

/** A tavern: a static room mesh reaching every lamp, `n` lamps of range 15 in a row along x, the lane, no sun. */
function tavern() {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  r.textures.set('1_1', { id: 't11' });
  r.setLighting(new Float32Array([0.18, 0.18, 0.18]), 0);
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 40]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const crate = { vao: { id: 'vao-crate' }, buffers: [], bounds: new Float32Array([0, 0.5, 0, 0.8]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const lamps = (n, order = null) => {
    const idx = order ?? [...Array(n).keys()];
    const L = new Float32Array(idx.length * 4);
    idx.forEach((k, i) => L.set([k * 1.5, 2, 3, 15], i * 4));
    return L;
  };
  const lightDir = new Float32Array([0.45, 0.8, 0.35]);
  const frame = (draw, lights, every = true, carried = null) => {
    if (carried) lights.carried = carried;
    r.setPointLights(lights, new Float32Array([1, 1, 1]));
    if (every) r.everyLightCasts();
    calls.length = 0;
    r.beginFrame(I, I, lightDir, WORLD_FRAME);
    const st = { ...sp.stats, casterOf: [...sp.casterOf], loCap: sp._loCap, storage: calls.filter((c) => c[0] === 'texStorage3D') };   // the table and the array as the frame's passes left them
    draw();
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp, calls, room, crate, lamps, frame };
}

test('DISC15: past the eight, every lamp reads its own lo map through the caster table - SHADOW_POINT_CASTERS + its slot; the eight their 512 slots; the lo maps drawn once (six faces each, the room in every face) and then served with no draw (mutants: the lo slot never written to the table; the lo maps redrawn every frame; the eight left without a lo map)', () => {
  const t = tavern();
  const L = t.lamps(20);
  const go = (every = true) => t.frame(() => t.r.drawMesh(t.room, I, null), L, every);
  go();   // the entry frame: records the room; the street's records dropped, no tier
  const first = go();
  assert.equal(first.loSlots, 20, 'every lamp holds a lo slot, the eight included');
  assert.equal(first.loFaces, 6 * 20, 'six faces a lamp, drawn at once');
  const hi = first.casterOf.slice(0, 20).filter((k) => k >= 0 && k < SHADOW_POINT_CASTERS);
  const lo = first.casterOf.slice(0, 20).filter((k) => k >= SHADOW_POINT_CASTERS);
  assert.equal(hi.length, SHADOW_POINT_CASTERS, 'the eight read their 512 maps');
  assert.equal(lo.length, 20 - SHADOW_POINT_CASTERS, 'every other lamp its lo map - none is left unshadowed');
  assert.equal(new Set(lo).size, lo.length, 'each its own slot');
  assert.ok(first.casterOf.slice(0, 20).every((k) => k >= 0), 'no lamp without a map (-1)');
  for (let f = 0; f < 4; f++) {
    const st = go();
    assert.equal(st.loFaces, 0, `frame ${f}: the lo maps are served, not redrawn`);
    assert.equal(st.pointDraws, 0, `frame ${f}: a still room draws nothing`);
    assert.deepEqual(st.casterOf, first.casterOf, `frame ${f}: the same table`);
  }
});

test('DISC15: lo slots STICK to their light across a re-sorted list (the hosts sort by distance every frame) - no map redrawn for a new order; a lamp gone frees its slot, a lamp arriving takes one and is drawn at once (mutants: matched by index; the newcomer deferred)', () => {
  const t = tavern();
  const draw = () => t.r.drawMesh(t.room, I, null);
  const order = [...Array(12).keys()];
  t.frame(draw, t.lamps(12, order)); const a = t.frame(draw, t.lamps(12, order));
  const slotOfLamp = (st, ord) => new Map(ord.map((k, i) => [k, st.casterOf[i]]));
  const before = slotOfLamp(a, order);
  const shuffled = [5, 11, 0, 3, 9, 1, 7, 2, 10, 4, 8, 6];
  const b = t.frame(draw, t.lamps(12, shuffled));
  assert.equal(b.loFaces, 0, 'a new order draws nothing');
  const after = slotOfLamp(b, shuffled);
  for (const k of order) if (before.get(k) >= SHADOW_POINT_CASTERS && after.get(k) >= SHADOW_POINT_CASTERS) assert.equal(after.get(k), before.get(k), `lamp ${k} keeps its lo slot`);
  // lamp 11 gone, lamp 12 arrives
  const next = [...Array(11).keys(), 12];
  const c = t.frame(draw, t.lamps(13, next));
  assert.equal(c.loFaces, 6, 'the newcomer is drawn at once, and only it');
  assert.equal(c.loSlots, 12);
});

test('DISC15: a changed static set redraws at most SHADOW_LO_REBUILDS lo maps a frame, the old map standing meanwhile - the same light\'s (mutant: every map at once, the hitch of a door coming to rest in a twenty-lamp room)', () => {
  const t = tavern();
  const L = t.lamps(16);
  const still = () => t.r.drawMesh(t.room, I, null);
  const withCrate = () => { still(); t.r.drawMesh(t.crate, at(4, 0, 3), null); };
  t.frame(still, L); t.frame(still, L);
  t.frame(withCrate, L);   // records the crate - a first sight is static
  const st = t.frame(withCrate, L);   // the static set in every lamp's reach changed
  assert.ok(st.loFaces <= 6 * SHADOW_LO_REBUILDS, `at most ${SHADOW_LO_REBUILDS} lo maps this frame (${st.loFaces / 6})`);
  assert.ok(st.loFaces > 0, 'but the redraw has begun');
  assert.ok(st.casterOf.slice(0, 16).every((k) => k >= 0), 'every lamp keeps a map while it waits');
  // the lamps whose reach the crate is in (its sphere against shadowFarFor of the range) - the two at the far end are not
  const inReach = [...Array(16).keys()].filter((k) => Math.hypot(k * 1.5 - 4, 2 - 0.5, 0) <= shadowFarFor(15) + 0.8).length;
  assert.equal(inReach, 14);
  let frames = 1, total = st.loFaces;
  for (; frames < 20 && total < 6 * inReach; frames++) total += t.frame(withCrate, L).loFaces;
  assert.equal(total, 6 * inReach, 'and in a few frames every lamp in the crate\'s reach has it - the two out of reach are never redrawn');
  assert.equal(t.frame(withCrate, L).loFaces, 0, 'then nothing');
});

test('DISC15: THE DOOR - the first frame through the door drops the street\'s records (no map is drawn from them), the tier runs from the next on the room\'s own, and a host that does not ask never has it (mutants: the flag sticky; the street\'s records replayed for the tavern\'s lamps)', () => {
  const t = tavern();
  const draw = () => t.r.drawMesh(t.room, I, null);
  const L = t.lamps(12);
  // the street: never asks
  t.frame(draw, L, false);
  const street = t.frame(draw, L, false);
  assert.equal(street.loSlots, 0, 'a host that does not ask has no lo tier');
  assert.ok(street.casterOf.slice(0, 12).some((k) => k === -1), 'past the eight, no map - the street as it was');
  // through the door: this frame asks, the last did not - the street's records are no room's
  const entry = t.frame(draw, L, true);
  assert.equal(entry.records, 0, 'the entry frame replays nothing of the street');
  assert.equal(entry.loSlots, 0); assert.equal(entry.facesDrawn, 0);
  const second = t.frame(draw, L, true);
  assert.equal(second.loSlots, 12, 'the second frame: every lamp, from the room\'s own records');
  // out again: the tier stops the frame the host stops asking
  const out = t.frame(draw, L, false);
  assert.equal(out.loSlots, 0);
  assert.ok(out.casterOf.slice(0, 12).every((k) => k < SHADOW_POINT_CASTERS));
});

test('DISC15: the hand\'s light is -2 in either tier (MAC-T1), and the storm\'s flash takes no lo slot (F11) - the pick\'s own two laws (mutant: the lo tier handing the carried torch a map)', () => {
  const t = tavern();
  const draw = () => t.r.drawMesh(t.room, I, null);
  const L = new Float32Array(4 * 11);
  for (let i = 0; i < 10; i++) L.set([i * 1.5, 2, 3, 15], i * 4);
  L.set([0, 1.7, 0, 600], 40);   // the flash
  const carried = new Uint8Array(11); carried[0] = 1;
  t.frame(draw, L, true, carried);
  const st = t.frame(draw, L, true, carried);
  assert.equal(st.casterOf[0], -2, 'the torch in the hand: no map, no march');
  assert.equal(st.casterOf[10], -1, 'the flash: no map');
  assert.equal(st.loSlots, 9, 'the nine lamps that may cast');
});

test('DISC15: the array is made on the first room that asks, grown by SHADOW_LO_STEP, 256 square, compared - and a one-texel stand-in before, so the sampler always has a depth array under it (mutants: the array made with the lane; the stand-in missing)', () => {
  const t = tavern();
  const draw = () => t.r.drawMesh(t.room, I, null);
  assert.equal(t.sp._loCap, 0, 'nothing at the lane\'s install but the stand-in');
  const installed = t.calls.filter((c) => c[0] === 'texStorage3D');
  assert.ok(installed.some((c) => c[4] === 1 && c[5] === 1 && c[6] === 6), 'the one-texel stand-in, six layers (a face\'s worth), at the install');
  assert.ok(!installed.some((c) => c[4] === SHADOW_LO_SIZE), 'and no lo array until a room asks');
  t.frame(draw, t.lamps(5)); const a = t.frame(draw, t.lamps(5));
  assert.equal(a.loCap, SHADOW_LO_STEP);
  assert.ok(a.storage.some((c) => c[4] === SHADOW_LO_SIZE && c[6] === 6 * SHADOW_LO_STEP), 'six layers a slot at 256');
  const b = t.frame(draw, t.lamps(20));
  assert.equal(b.loCap, 3 * SHADOW_LO_STEP, 'grown to hold twenty');
  assert.equal(b.loFaces, 6 * 20, 'a grown array draws every slot afresh');
  const c = t.frame(draw, t.lamps(5));
  assert.equal(c.loCap, 3 * SHADOW_LO_STEP, 'never shrunk');
});

test('DISC15: the shaders read either tier - the lit loop and the flat through casterShadowAt / shadowOfLight with the light itself, the lo lookup on its own sampler with the far the JS draws to, the air\'s march too; every program binds the sampler to SHADOW_LO_UNIT', () => {
  assert.match(SHADOW_GLSL, /uniform sampler2DArrayShadow uPointShadowLo;/);
  assert.match(SHADOW_GLSL, /float loFarOf\(float range\) \{ return ceil\(range \/ 4\.0\) \* 4\.0; \}/, 'shadowFarFor, term for term');
  for (const w of [15, 18, 20, 7.5, 5, 12, 16]) assert.equal(Math.ceil(Math.fround(w) / 4) * 4, shadowFarFor(Math.fround(w)), `the far of a range ${w}`);
  assert.match(SHADOW_GLSL, /return k < 8 \? pointShadowAt\(k, wp, n\) : pointShadowLoAt\(k - 8, L, wp, n\);/, 'below the eight a 512 slot, past it a lo one');
  assert.match(SHADOW_GLSL, /float t = 1\.5 \/ 256\.0;/, 'the lo kernel a texel and a half of a 256 face');
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.match(fs, /float sh = k >= 0 \? casterShadowAt\(k, uPointLights\[i\], wp, n\)/, `${name}: either tier`);
  }
  assert.match(EL_BB_FS, /shadowOfLight\(i, uPointLights\[i\], base, vec3\(0\.0, 1\.0, 0\.0\)\)/, 'the flat: either tier');
  assert.match(rd('src/render/airPass.js'), /sum \+= casterShadowOne\(k, Lr, uCamPos \+ dir \* t\)/, 'the air\'s march: either tier');
  assert.equal(SHADOW_LO_UNIT, 8);
  const sp = rd('src/render/shadowPass.js');
  assert.match(sp, /gl\.activeTexture\(gl\.TEXTURE0 \+ SHADOW_LO_UNIT\);\n\s+gl\.bindTexture\(gl\.TEXTURE_2D_ARRAY, this\.loTex\);/, 'upload binds the lo array on its unit');
  assert.match(sp, /if \(loc\.pointShadowLo\) gl\.uniform1i\(loc\.pointShadowLo, SHADOW_LO_UNIT\);/);
  const rr = rd('src/render/renderer.js'), air = rd('src/render/airPass.js');
  assert.equal((rr.match(/pointShadowLo: gl\.getUniformLocation\(p, 'uPointShadowLo'\)/g) || []).length, 2, 'the lane programs and the water');
  assert.match(air, /pointShadowLo: u\(p, 'uPointShadowLo'\)/, 'the air\'s march');
});

test('DISC15: the building hosts ask for the tier every frame, before beginFrame - the world\'s interior arm and the dev route; nothing else does', () => {
  const wm = rd('src/scenes/worldModes.js'), it = rd('src/scenes/interior.js');
  assert.match(wm, /renderer\.setPointLights\(_itLit\.data, null, _itLit\.colors\);\n\s+renderer\.everyLightCasts\(\);/);
  assert.ok(wm.indexOf('renderer.everyLightCasts();') < wm.indexOf('renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);   // AUDIT-EL F5: a WORLD frame - the lane replays its records for this one\n    mwViewDrawBody'), 'before the interior arm\'s beginFrame');
  assert.match(it, /renderer\.setPointLights\(lit\.data, null, lit\.colors\);\n\s+renderer\.everyLightCasts\(\);/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/dungeonContext.js']) assert.ok(!rd(f).includes('everyLightCasts'), `${f}: a host that culls by view never asks`);
});
