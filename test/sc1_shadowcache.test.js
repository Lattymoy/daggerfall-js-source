// SC1 (2026-09-23, Mac: "make some insane improvements to our lighting system ... while also improving
// performance"; the second step): THE STATIC CASTERS ARE DRAWN ONCE.
//
// A lantern's cube map was replayed - six faces of everything in its range - every frame for the two nearest
// slots and every third for the rest, whether or not anything in that range had moved. render/shadowPass.js now
// classifies every record as it is recorded (a mesh at the matrix it was drawn with last frame is static, one
// that moved is dynamic, a rig always is, a flat while its origin moves), keeps a CACHE of each slot's static
// casters in a second depth array drawn only when the light or the static set in its reach changes (a signature
// over identities and positions), and blits that cache into the live layers with the dynamics drawn on top at
// EL8's cadence - nothing at all when no dynamic is near. Slots are STICKY: a light keeps its slot, matched by its
// position, while it stays among the picked.
//
// Pinned on the fake GL: a still room costs zero point draws after its first replay; a mesh that moves is drawn
// alone over a blitted cache, and the cache is not redrawn for it; a new static caster in reach redraws the cache
// (the signature), one out of reach does not; the walker gone, one blit puts the cache back and then nothing;
// a moved light redraws its cache; slots stick to their light across a re-sorted light list; a moving flat is a
// dynamic; the door restores the old path whole; the classification helpers and the signature's order-freedom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_POINT_CASTERS, SHADOW_NEAR_CASTERS, SHADOW_DYNAMIC_HOLD, shadowCacheOn, spheresTouch, foldSignature } from '../src/render/shadowPass.js';

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

/** A room: a bounded static mesh (two sub-meshes), a terrain tile, a lantern at the origin; the lane, no sun. */
function stand() {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  r.textures.set('1_1', { id: 't11' }); r.textures.set('201_1', { id: 't2011' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 6]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }, { textureArchive: 1, textureRecord: 1, startIndex: 6, primitiveCount: 2 }] };
  const crate = { vao: { id: 'vao-crate' }, buffers: [], bounds: new Float32Array([0, 0.5, 0, 0.8]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
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
  return { r, sp, calls, room, crate, tile, frame };
}

test('SC1: a still room costs zero point draws after its first replay - the cache drawn once (six faces, the room and the tile), then every frame served from it with no blit, no clear and no draw (mutants: the cache never trusted; the signature ignored)', () => {
  const { r, sp, room, tile, frame } = stand();
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  frame(draw);   // records
  const first = frame(draw);   // the first replay
  assert.equal(first.staticFaces, 6, 'the cache drawn');
  assert.equal(first.pointDraws, 6 * 2, 'six faces of the room and the tile - the room\'s two sub-meshes meet, one run (PERF-EXT2)');
  assert.equal(first.dynFaces, 0); assert.equal(first.blit, 6, 'and blitted into the live layers once');
  for (let f = 0; f < 5; f++) {
    const st = frame(draw);
    assert.equal(st.pointDraws, 0, `frame ${f}: nothing replayed`);
    assert.equal(st.staticFaces, 0); assert.equal(st.dynFaces, 0); assert.equal(st.blit, 0);
    assert.equal(st.cachedSlots, 1, 'the one slot served from its cache');
    assert.equal(st.casters, 1);
  }
  assert.equal(sp.kind, 'point');
});

test('SC1: a mesh that MOVES is a dynamic - drawn alone over the blitted cache every frame it is near (the nearest slot), the cache untouched; gone, one blit puts the cache back and then nothing (mutants: the dynamic replay drawing the statics too; the cache redrawn for a mover; the stale walker left in the live layers)', () => {
  const { r, room, crate, tile, frame } = stand();
  let x = 1;
  const still = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  const walking = () => { still(); r.drawMesh(crate, at(x, 0, 0), null); };
  frame(walking); frame(walking);   // records; the first replay: the crate's first sight is still, so it is in the cache
  let st = frame(walking);
  assert.equal(st.pointDraws, 0, 'nothing moved yet');
  x = 1.5;
  frame(walking);   // the crate moved: recorded dynamic
  st = frame(walking);
  assert.equal(st.staticFaces, 6, 'the crate LEFT the static set: the cache is drawn again without it');
  assert.equal(st.dynFaces, 6, 'and the crate alone on top');
  assert.ok(st.pointDraws > 6 * 2 && st.pointDraws <= 6 * 3, `the room's two (one run, PERF-EXT2) and the tile into the cache (every face - they wrap the light); the crate into the live layers, in the faces that see it (${st.pointDraws})`);
  x = 2;
  frame(walking);
  st = frame(walking);
  assert.equal(st.staticFaces, 0, 'the cache stands');
  assert.equal(st.dynFaces, 6); assert.ok(st.pointDraws >= 1 && st.pointDraws <= 6, `the crate alone, in the faces that see it (${st.pointDraws})`);
  assert.equal(st.blit, 6, 'over a fresh blit of the cache');
  // the walker leaves the room's draws (culled by the host): one blit, then nothing
  frame(still);
  st = frame(still);
  assert.equal(st.pointDraws, 0); assert.equal(st.blit, 6, 'the cache back into the live layers');
  st = frame(still);
  assert.equal(st.pointDraws, 0); assert.equal(st.blit, 0, 'and then nothing at all');
});

test('SC1: the static signature - a new still caster IN REACH redraws the cache, one out of reach does not; a light that moves redraws its cache; the fold is order-free (mutants: the signature folded in draw order; the reach test dropped)', () => {
  const { r, room, tile, frame } = stand();
  const far = { vao: { id: 'vao-far' }, buffers: [], bounds: new Float32Array([40, 1, 0, 1]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const near = { vao: { id: 'vao-near' }, buffers: [], bounds: new Float32Array([3, 1, 0, 1]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const base = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  frame(base); frame(base); frame(base);
  const withFar = () => { base(); r.drawMesh(far, I, null); };
  frame(withFar);
  let st = frame(withFar);
  assert.equal(st.staticFaces, 0, 'a crate forty units off is outside the lantern\'s reach: the cache stands');
  const withNear = () => { base(); r.drawMesh(near, I, null); };
  frame(withNear);
  st = frame(withNear);
  assert.equal(st.staticFaces, 6, 'a crate three units off is in reach: the cache is drawn again');
  assert.ok(st.pointDraws > 6 * 2 && st.pointDraws <= 6 * 3, `with the crate in it - the room one run (PERF-EXT2), the tile, the crate where a face sees it (${st.pointDraws})`);
  // the same draws in another order: the same signature, no redraw
  const reordered = () => { r.drawMesh(near, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawMesh(room, I, null); };
  frame(reordered);
  st = frame(reordered);
  assert.equal(st.staticFaces, 0, 'order-free');
  // the light moves: its slot's cache is stale (the lights are this frame's: drawn on the frame it moves)
  st = frame(reordered, new Float32Array([0.5, 2, 0, 10]));
  assert.equal(st.staticFaces, 6, 'a moved light redraws its cache');
  st = frame(reordered, new Float32Array([0.5, 2, 0, 10]));
  assert.equal(st.staticFaces, 0, 'once');
  assert.equal(foldSignature(foldSignature(0, 7), 11), foldSignature(foldSignature(0, 11), 7), 'the fold commutes');
  assert.notEqual(foldSignature(0, 7), foldSignature(0, 8));
  assert.equal(spheresTouch(0, 0, 0, 1, 1.5, 0, 0, 1), true); assert.equal(spheresTouch(0, 0, 0, 1, 3, 0, 0, 1), false);
});

test('SC1: STICKY SLOTS - a light keeps its slot, matched by position, when the host re-sorts its list; a new light takes a free slot; the cadence reads the light\'s rank, not its slot (mutants: slots by index; the rank as the slot)', () => {
  const { r, sp, room, tile, frame } = stand();
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  const A = [0, 2, 0, 10], B = [4, 2, 0, 10], C = [-4, 2, 3, 10];
  frame(draw, new Float32Array([...A, ...B]));
  let st = frame(draw, new Float32Array([...A, ...B]));
  assert.deepEqual(st.index.slice(0, 2), [0, 1], 'A in slot 0, B in slot 1');
  assert.equal(st.staticFaces, 12, 'two caches');
  // the host re-sorts: B first
  frame(draw, new Float32Array([...B, ...A]));
  st = frame(draw, new Float32Array([...B, ...A]));
  assert.deepEqual([...sp.shadowIndex.slice(0, 2)], [1, 0], 'A is still slot 0 (now light 1), B still slot 1 (now light 0)');
  assert.equal(st.staticFaces, 0, 'and neither cache was thrown away');
  assert.deepEqual([...sp.casterOf.slice(0, 2)], [1, 0], 'the table follows: light 0 (B) -> slot 1, light 1 (A) -> slot 0');
  // a third light: the free slot (the lights are this frame's, so the new slot's cache is drawn on the frame it arrives)
  st = frame(draw, new Float32Array([...B, ...A, ...C]));
  assert.deepEqual([...sp.shadowIndex.slice(0, 3)], [1, 0, 2]);
  assert.equal(st.staticFaces, 6, 'one new cache');
  st = frame(draw, new Float32Array([...B, ...A, ...C]));
  assert.equal(st.staticFaces, 0, 'and it stands');
  // B gone: its slot is emptied, A and C keep theirs
  frame(draw, new Float32Array([...A, ...C]));
  st = frame(draw, new Float32Array([...A, ...C]));
  assert.deepEqual([...sp.shadowIndex.slice(0, 3)], [0, -1, 1]);
  assert.equal(st.staticFaces, 0);
  assert.equal(SHADOW_NEAR_CASTERS, 2);
  // DISC24-C: the rank is read once (the player's own card rides it too) and the cadence off it
  assert.match(rd('src/render/shadowPass.js'), /const near = nearestRank\(casters, L, f\.eye, rank\) < SHADOW_NEAR_CASTERS;[^\n]*\n(?:\s*\/\/[^\n]*\n)*[^\n]*\n[^\n]*\n\s*const due = near \|\| \(this\.frameNo \+ k\) % SHADOW_FAR_CASTER_EVERY === 0;/, 'the cadence by rank');
});

test('SC1: a flat whose origin moves is a dynamic (per batch, on the batch), a still one is in the cache; the door restores the old path whole - every caster in range at the cadence into the live layers, no cache, no blit (mutants: the batch\'s word ignored; the door ignored)', () => {
  const { r, sp, room, tile, frame } = stand();
  const npc = { archive: 201, record: 1, vao: { id: 'vao-npc' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [2, 0, 0], bounds: new Float32Array([0, 0, 0, 1.2]) };
  const tree = { archive: 201, record: 1, vao: { id: 'vao-tree' }, indexCount: 6, size: { w: 1, h: 3 }, origin: [-3, 0, 1], bounds: new Float32Array([0, 0, 0, 1.6]) };
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawBillboards([npc, tree], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
  frame(draw); frame(draw);
  let st = frame(draw);
  assert.equal(st.pointDraws, 0, 'two still flats: in the cache');
  assert.equal(npc._shDyn, false); assert.equal(tree._shDyn, false);
  npc.origin = [2.2, 0, 0];
  frame(draw);
  assert.equal(npc._shDyn, true, 'the walker'); assert.equal(tree._shDyn, false, 'the tree stands');
  st = frame(draw);
  assert.equal(st.staticFaces, 6, 'the walker left the static set: the cache redrawn without it');
  assert.equal(st.dynFaces, 6);
  assert.ok(st.pointDraws > 6 * 2 && st.pointDraws <= 6 * 4, `the room's two (one run, PERF-EXT2), the tile and the tree into the cache; the walker alone on top, in the faces that see them (${st.pointDraws})`);
  // the door
  r.setShadowCache(false);
  assert.equal(sp.cacheOn, false);
  frame(draw);
  st = frame(draw);
  assert.equal(st.staticFaces, 0); assert.equal(st.dynFaces, 0); assert.equal(st.blit, 0, 'no cache, no blit');
  assert.equal(st.facesDrawn, 6); assert.ok(st.pointDraws > 6 * 2 && st.pointDraws <= 6 * 4, `the old path: everything in range, six faces - the room one run (PERF-EXT2) (${st.pointDraws})`);
  st = frame(draw);
  assert.equal(st.facesDrawn, 6, 'and again every frame (the nearest slot)');
  r.setShadowCache(true);
  assert.equal(sp.cacheOn, true);
  assert.equal(shadowCacheOn(''), true); assert.equal(shadowCacheOn('?shadowcache=off'), false);
  assert.match(rd('src/render/enhancedLighting.js'), /renderer\.setShadowCache\?\.\(shadowCacheOn\(search\)\);/, 'read at the lane\'s install, like the air\'s');
});

test('SC1: a rig is always dynamic, and a dead mesh is neither in the signature nor drawn (mutants: the rig cached; the dead mesh kept in the signature, so its removal redraws nothing)', () => {
  const { r, room, tile, frame } = stand();
  const rig = { vao: { id: 'vao-rig' }, count: 36, bounds: new Float32Array([1, 1, 0, 1]) };
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawCharacter(rig, at(1, 0, 0)); };
  frame(draw); frame(draw);
  let st = frame(draw);
  assert.equal(st.dynFaces, 6, 'the rig on top every frame (the nearest slot)');
  assert.equal(st.staticFaces, 0);
  assert.ok(st.pointDraws >= 1 && st.pointDraws <= 6, `the rig alone, in the faces that see it (${st.pointDraws})`);
  const crate = { vao: { id: 'vao-crate' }, buffers: [], bounds: new Float32Array([2, 0.5, 0, 0.8]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const withCrate = () => { draw(); r.drawMesh(crate, I, null); };
  frame(withCrate); frame(withCrate); frame(withCrate);
  r.destroyMesh(crate);
  st = frame(withCrate);   // the signature reads the mesh as it IS (dead now, though recorded alive): the cache is drawn again on this frame
  assert.equal(st.staticFaces, 6, 'the crate died: the static set changed, the cache is drawn again');
  assert.ok(st.pointDraws >= 6 * 2 + 1 && st.pointDraws <= 6 * 2 + 6, `without it - the room (one run, PERF-EXT2), the tile, and the rig on top (${st.pointDraws})`);
});

test('SC1: THE HOLD - a caster that moved stays dynamic for SHADOW_DYNAMIC_HOLD recorded frames after it stops (drawn alone on top, the cache untouched), and joins the cache once when the hold runs out (mutants: no hold, so a walker who pauses redraws every cache in reach on each step; the hold never ending)', () => {
  const { r, room, crate, tile, frame } = stand();
  let x = 1;
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawMesh(crate, at(x, 0, 0), null); };
  frame(draw); frame(draw); frame(draw);
  x = 1.5; frame(draw);
  let st = frame(draw);   // the move seen: the cache without the crate, the crate on top
  assert.equal(st.staticFaces, 6); assert.equal(st.dynFaces, 6);
  // it stands still now - and stays dynamic through the hold
  let stills = 0;
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD - 3; f++) { st = frame(draw); stills++; assert.equal(st.staticFaces, 0, `still frame ${f}: the cache untouched`); assert.equal(st.dynFaces, 6, `still frame ${f}: the crate on top`); }
  // the hold runs out: the crate joins the cache, once
  let joined = 0;
  for (let f = 0; f < 6; f++) { st = frame(draw); if (st.staticFaces) joined++; }
  assert.equal(joined, 1, 'one cache redraw with the crate in it');
  assert.equal(st.dynFaces, 0, 'and nothing on top any more');
  assert.equal(st.pointDraws, 0);
  assert.equal(SHADOW_DYNAMIC_HOLD, 60);
  assert.ok(stills > 50);
});
