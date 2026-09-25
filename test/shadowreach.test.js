// SHADOW-REACH (2026-09-23, Mac: "Can you tackle the 2 limitations" - the audit's two): THE CASTERS THE VIEW CULL
// REJECTS, AND THE SWAY.
//
// The exterior hosts cull what they draw to the view frustum, and the shadow maps are replayed from what they drew -
// so a tree behind the camera cast no sun shadow into the view, a wall just off screen cast none from the lantern
// beside it, and SC1's caches churned as the camera turned (the still set in a lantern's reach changed with the
// view). The pass answers `reaches(box)` / `reachesSphere` against THIS frame's casters (a sun cascade's frustum,
// a point caster's range), the renderer exposes it (`shadowReach`, `shadowReachBatch`) beside record-only seams
// (`recordShadowMesh` / `recordShadowTerrain` / `recordShadowBillboards`: the records, none of the draw), and both
// exterior hosts ask at every cull gate. And a flora batch leaning in the wind is a DYNAMIC while the wind blows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_CASCADES, SHADOW_SUN_DEPTH, shadowFarFor, SHADOW_SWAY_STILL, SHADOW_SWAY_EVERY, swayLean } from '../src/render/shadowPass.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
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

/** the lane, a room, a tile; the sun on or off */
function stand({ sun = 0 } = {}) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  r.textures.set('1_1', { id: 't11' }); r.textures.set('201_1', { id: 't2011' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), sun, new Float32Array([1, 1, 1]));
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 6]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const tile = { vao: { id: 'vao-t' }, indexCount: 6, bounds: new Float32Array([0, 0, 0, 10]) };
  const lightDir = new Float32Array([0.3, 0.8, 0.2]);
  const l = Math.hypot(...lightDir); lightDir[0] /= l; lightDir[1] /= l; lightDir[2] /= l;
  const frame = (draw, lights = new Float32Array([0, 2, 0, 10])) => {
    r.setPointLights(lights, new Float32Array([1, 1, 1]));
    calls.length = 0;
    r.beginFrame(I, I, lightDir, WORLD_FRAME);
    const st = { ...sp.stats, casters: sp.casters, blit: count(calls, 'blitFramebuffer') };
    draw();
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp, calls, room, tile, lightDir, frame };
}
const box = (x, y, z, h = 1) => [x - h, y - h, z - h, x + h, y + h, z + h];

test('SHADOW-REACH: the pass answers for THIS frame\'s casters - a box within a lantern\'s range reaches, one past it does not, a translated box is tested where it stands; with no caster nothing reaches (mutants: the range ignored; the translation dropped)', () => {
  const { r, sp, room, tile, frame } = stand();
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  frame(draw);
  assert.equal(sp.reaches(box(4, 0, 4)), false, 'no caster picked before the first replay: nothing reaches');
  assert.equal(sp.reaches(box(0, 0, 0)), false, 'AUDIT REACH: nor does a box about the origin (an empty slot sits at the origin with no range - the guard)');
  frame(draw);   // the lantern at the origin, range 10, is this frame's caster
  assert.equal(sp.casters, 1);
  const far = sp.pointParams[3];   // the SHADOW's far - the range quantised up (PERF-FLICKER), which is what the map covers
  assert.equal(far, shadowFarFor(10)); assert.ok(far >= 10 && far < 30);
  const d = far / Math.SQRT2;   // a corner at (d, d) sits exactly at the far
  assert.equal(sp.reaches(box(4, 0, 4)), true, 'within the range');
  assert.equal(sp.reaches(box(d + 1.5, 0, d + 1.5)), false, 'the nearest corner half a unit past the far');
  assert.equal(sp.reaches(box(d + 0.5, 0, d + 0.5)), true, 'half a unit inside - the corner nearest the light is what is tested');
  assert.equal(sp.reaches(box(30, 0, 30)), false);
  assert.equal(sp.reaches(box(30, 0, 30), -26, 0, -26), true, 'translated to (4, 4): the box where it stands');
  assert.equal(sp.reaches(box(0, 30, 0)), false, 'thirty up: past the range'); assert.equal(sp.reaches(box(0, 30, 0), 0, -28, 0), true, 'and brought down by the translation');
  // AUDIT REACH: a lantern is tested against the box's ENCLOSING SPHERE - the cache's signature counts a caster by its
  // bounding sphere, and a caster in by the sphere and out by the box was recorded on screen and dropped off it
  const slab = [-10, -0.5, far + 1, 10, 0.5, far + 2];   // a wide wall a unit past the far: its box is out, its enclosing sphere (radius ~10) reaches in
  assert.equal(sp.reaches(slab), true, 'in by the sphere the signature counts it by');
  assert.equal(r.shadowReach(box(4, 0, 4)), true); assert.equal(r.shadowReach(box(30, 0, 30)), false);
  assert.equal(sp.reachesSphere(far - 1, 0, 0, 1.5), true, 'a sphere touching the range');
  assert.equal(sp.reachesSphere(far + 2, 0, 0, 1.5), false);
  assert.equal(r.shadowReachBatch({ bounds: new Float32Array([0, 0, 0, 1]), origin: [far - 1, 0, 0], size: { w: 1, h: 2 } }), true, 'a batch on the sphere batchVisible builds');
  assert.equal(r.shadowReachBatch({ bounds: new Float32Array([0, 0, 0, 1]), origin: [far + 2, 0, 0], size: { w: 1, h: 2 } }), false);
  assert.equal(r.shadowReachBatch({ origin: [50, 0, 0] }), true, 'a batch with no bounds is drawn by every replay - and so reaches');
  assert.equal(r.shadowReachBatch({ bounds: new Float32Array([0, 0, 0, 0.5]), origin: [0, -far - 1, 0], size: { w: 1, h: 2 * far + 2 } }), true, 'the sphere is lifted by half the flat\'s height, as batchVisible lifts it (a tall flat rooted far below the lantern)');
  assert.equal(r.shadowReachBatch({ bounds: new Float32Array([0, 0, 0, 0.5]), origin: [0, -far - 1, 0], size: { w: 1, h: 0.2 } }), false);
  frame(draw, new Float32Array(0));   // no lantern
  assert.equal(sp.reaches(box(4, 0, 4)), false, 'the lantern gone: nothing reaches (the sun is off)');
});

test('SHADOW-REACH: the sun\'s cascades reach - a box BEHIND the eye toward the light, inside the far cascade\'s orthographic box (SHADOW_SUN_DEPTH toward the light, the cascade\'s radius across), reaches; one across the light past every radius, or beyond the depth, does not; and the classic set (no pass) never reaches (mutant: the sun\'s arm dropped)', () => {
  const { r, sp, room, tile, lightDir, frame } = stand({ sun: 0.55 });
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  frame(draw, new Float32Array(0)); frame(draw, new Float32Array(0));
  assert.equal(sp.sunParams[3], 1, 'the sun casts');
  assert.equal(SHADOW_SUN_DEPTH, 600); assert.deepEqual([...SHADOW_CASCADES], [12, 48, 240]);
  const toward = (d) => box(lightDir[0] * d, lightDir[1] * d, lightDir[2] * d);
  assert.equal(sp.reaches(toward(100)), true, 'a hundred units toward the sun: in every cascade\'s column');
  assert.equal(sp.reaches(toward(500)), true, 'five hundred: still inside the depth');
  assert.equal(sp.reaches(toward(800)), false, 'past the depth: no cascade');
  // across the light: a perpendicular in the world's x-z (lightDir has y up, so a horizontal perpendicular)
  const px = -lightDir[2], pz = lightDir[0]; const pl = Math.hypot(px, pz);
  assert.equal(sp.reaches(box(px / pl * 200, 0, pz / pl * 200)), true, 'two hundred across: within the far cascade\'s 240');
  assert.equal(sp.reaches(box(px / pl * 400, 0, pz / pl * 400)), false, 'four hundred across: past every cascade');
  assert.equal(sp.reachesSphere(px / pl * 200, 0, pz / pl * 200, 5), true);
  assert.equal(sp.reachesSphere(px / pl * 400, 0, pz / pl * 400, 5), false);
  assert.equal(sp.reachesSphere(px / pl * 250, 0, pz / pl * 250, 20), true, 'the radius counts: a sphere centred past the far cascade reaching back in');
  assert.equal(sp.reachesSphere(px / pl * 250, 0, pz / pl * 250, 1), false);
  assert.equal(sp.reaches(box(0, 0, 0), px / pl * 200, 0, pz / pl * 200), true, 'a translated box against the sun');
  assert.equal(sp.reaches(box(0, 0, 0), px / pl * 400, 0, pz / pl * 400), false);
  // the sun moves: the cascades follow it, and so does the reach (the planes are the frame's, not the first frame's)
  const turned = new Float32Array([-lightDir[0], lightDir[1], -lightDir[2]]);
  const frame2 = (L) => { r.setPointLights(new Float32Array(0), new Float32Array([1, 1, 1])); r.beginFrame(I, I, L, WORLD_FRAME); draw(); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); };
  frame2(turned); frame2(turned);
  assert.equal(sp.reaches(toward(500)), false, 'five hundred toward the OLD sun: across the new one, past every radius');
  assert.equal(sp.reaches(box(turned[0] * 500, turned[1] * 500, turned[2] * 500)), true, 'five hundred toward the new sun');
  // the classic set
  const bare = new Renderer(recordingGl().canvas);
  assert.equal(bare.shadowReach(box(0, 0, 0)), false); assert.equal(bare.shadowReachBatch({ origin: [0, 0, 0] }), false);
});

test('SHADOW-REACH: the record-only seams put a caster in the maps and NOTHING on screen - a mesh, a tile and a batch recorded with no draw call, then replayed into the lantern\'s cube; a panel frame records nothing (mutants: the record a draw; the seam recording in a panel)', () => {
  const { r, sp, calls, room, tile, frame } = stand();
  const crate = { vao: { id: 'vao-crate' }, buffers: [], bounds: new Float32Array([0, 0.5, 0, 0.8]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const npc = { archive: 201, record: 1, vao: { id: 'vao-npc' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [2, 0, 0], bounds: new Float32Array([0, 0, 0, 1.2]) };
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); };
  frame(draw);
  const before = calls.length;
  r.recordShadowMesh(crate, I, null);
  r.recordShadowTerrain(tile, I, {}, {}, 6.4);
  r.recordShadowBillboards([npc], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  assert.equal(calls.length, before, 'not one GL call');
  assert.equal(sp.count, 5, 'the room, the tile, then the crate, the tile again and the batch: five records');
  assert.equal(sp.records[2].mesh, crate); assert.equal(sp.records[4].batches[0], npc);
  r.recordShadowMesh({ vao: null }, I, null); r.recordShadowBillboards([], null, null);
  assert.equal(sp.count, 5, 'a dead mesh and an empty list record nothing');
  const st = frame(draw);   // the replay draws the recorded casters into the cache
  assert.equal(st.staticFaces, 6);
  assert.ok(st.pointDraws > 6 * 2, `the crate and the batch drew beside the room and the tile (${st.pointDraws})`);
  // a panel frame: the seams are silent
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    const n = sp.count;
    r.recordShadowMesh(crate, I, null); r.recordShadowBillboards([npc], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
    assert.equal(sp.count, n, 'a panel records nothing');
  });
});

test('SHADOW-REACH (the sway), AUDIT REACH: a flora batch leaning past half a texel is a dynamic ON THE SWAY\'S OWN CADENCE - drawn over the cache every SHADOW_SWAY_EVERY frames, the cache holding no lean - a breeze under the floor is still, a wind along z alone counts, a post never leans, and the wind dropping stills the wood at once; a mover near the same lantern takes the mover\'s cadence (mutants: the lean ignored; the floor dropped; the x rate alone; the sway on the mover\'s cadence)', () => {
  const { r, sp, room, tile, frame } = stand();
  assert.equal(SHADOW_SWAY_STILL, 0.02); assert.equal(SHADOW_SWAY_EVERY, 4);
  assert.ok(swayLean(3, 1, 4) > SHADOW_SWAY_STILL && swayLean(0.5, 1, 4) < SHADOW_SWAY_STILL, 'the lean law: a rate of three leans a four-unit tree past the floor, a breeze of half does not');
  const tree = { archive: 201, record: 1, vao: { id: 'vao-tree' }, indexCount: 6, size: { w: 2, h: 4 }, origin: [-3, 0, 1], bounds: new Float32Array([0, 0, 0, 2.3]), sway: 1 };
  const post = { archive: 201, record: 1, vao: { id: 'vao-post' }, indexCount: 6, size: { w: 0.5, h: 4 }, origin: [3, 0, 1], bounds: new Float32Array([0, 0, 0, 2.1]), sway: 0 };   // as tall as the tree: a lean it does not have would pass the floor
  const draw = () => { r.drawMesh(room, I, null); r.drawTerrain(tile, I, {}, {}, 6.4); r.drawBillboards([tree, post], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
  r.setFlatWind(null);
  frame(draw); let st = frame(draw);
  assert.equal(tree._shDyn, false, 'calm: the tree is still'); assert.equal(post._shDyn, false);
  assert.equal(st.staticFaces, 6); assert.equal(st.dynFaces, 0);
  r.setFlatWind([0.5, 0, 12.5, 0.4]);
  frame(draw); st = frame(draw);
  assert.equal(tree._shDyn, false, 'a breeze under half a texel: still'); assert.equal(st.dynFaces, 0); assert.equal(st.staticFaces, 0, 'the cache stands');
  r.setFlatWind([0, 5, 12.5, 0.4]);   // along z alone
  frame(draw);
  assert.equal(tree._shDyn, true, 'the wind blows: the tree leans, a dynamic'); assert.equal(tree._shSway, true, 'by its sway alone'); assert.equal(post._shDyn, false, 'the post has no sway');
  st = frame(draw);
  assert.equal(st.staticFaces, 6, 'the cache redrawn once without the tree'); assert.equal(st.dynFaces, 6, 'the tree over it');
  const faces = []; for (let f = 0; f < 8; f++) { st = frame(draw); faces.push(st.dynFaces); }
  assert.equal(faces.reduce((a, b) => a + b, 0), 6 * 2, `the sway\'s own cadence: twice in eight frames (${faces})`);
  assert.ok(faces.every((v, i) => i === 0 || faces[i - 1] === 0 || v === 0), 'never two frames running');
  // a mover beside it: the mover\'s cadence, every frame for the nearest slot
  let x = 0;
  const walking = () => { draw(); r.drawMesh({ vao: { id: 'vao-crate' }, buffers: [], bounds: new Float32Array([0, 0.5, 0, 0.8]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] }, at(x += 0.2, 0, 0), null); };
  frame(walking); frame(walking); frame(walking);
  const every = []; for (let f = 0; f < 4; f++) { st = frame(walking); every.push(st.dynFaces); }
  assert.deepEqual(every, [6, 6, 6, 6], 'a mover near: every frame');
  r.setFlatWind(null);
  frame(draw);
  assert.equal(tree._shDyn, false, 'the wind dropped: still again, at once');
});

test('SHADOW-REACH: the hosts ask at every cull gate, by source - world.js (the pixel, its models, the sail, the flat batches, the crowd; the flats recorded after the crowd\'s draw) and exterior.js (the draw list, the sails, the flat batches); no other host culls (mutants: a gate that still only skips)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const pixelCasts = !pixelVisible && renderer\.shadowReach\(p\._box, t\[0\], t\[1\], t\[2\]\);/, 'the pixel gate');
  assert.match(w, /const off = cullOn && aabbOutside\(_planes, m\._box, t\[0\], t\[1\], t\[2\]\);\n\s*if \(off && !renderer\.shadowReach\(m\._box, t\[0\], t\[1\], t\[2\]\)\) continue;/, 'a model of a visible pixel');
  assert.match(w, /if \(off\) renderer\.recordShadowMesh\(m\.gpu, m\._world, p\.texRemap\);[^\n]*\n\s*else renderer\.drawMesh\(m\.gpu, m\._world, p\.texRemap\);/, 'recorded, not drawn');
  // DW-C: a pure-ocean pixel's ground is not drawn (the cap hides it) and a clipped one casts as it draws
  assert.match(w, /\} else if \(pixelCasts\) \{\n(?:\s*\/\/[^\n]*\n)*\s*(?:if \(!p\.deepWaters\?\.hide\) )?renderer\.recordShadowTerrain\((?:p\.dwTerrain \?\? )?p\.terrain, pixelMatrix, renderer\.tileArrays\.get\(p\.groundArchive\), p\.tilemapTex, 6\.4\);[^\n]*\n\s*if \(p\.staticBatch\) renderer\.recordShadowMesh\(p\.staticBatch, pixelMatrix, null\);/, 'an off-screen pixel in reach: its ground and its merged statics');
  assert.match(w, /else if \(pixelCasts\) renderer\.recordShadowMesh\(millParts\.rotor,/, 'the sail');
  assert.match(w, /if \(pixelVisible \|\| pixelCasts\) for \(const b of p\.batches\) \{\n\s*const off = !pixelVisible \|\| \(cullOn && aabbOutside\(_planes, b\._box, t\[0\], t\[1\], t\[2\]\)\);[^\n]*\n\s*if \(off && !renderer\.shadowReach\(b\._box, t\[0\], t\[1\], t\[2\]\)\) continue;[^\n]*\n\s*if \(!farFlatVisible\([^\n]*\n\s*b\.origin = t;\n\s*\(off \? castBatches : allBatches\)\.push\(b\);/, 'a flat batch (AUDIT REACH: a pixel neither seen nor reached walks none)');
  assert.match(w, /if \(cullOn && billboardOutside\(b\)\) \{ if \(renderer\.shadowReachBatch\(b\)\) castBatches\.push\(b\); continue; \}/, 'a peer (AUDIT REACH)');
  assert.match(w, /\} else if \(pixelCasts\) \{[\s\S]{0,700}?for \(const m of p\.models\) \{\n\s*if \(m\._batched \|\| !renderer\.shadowReach\(m\._box, t\[0\], t\[1\], t\[2\]\)\) continue;[\s\S]{0,300}?renderer\.recordShadowMesh\(m\.gpu, m\._world, p\.texRemap\);/, 'an off-screen pixel in reach: its odd models, each by its own reach');
  assert.match(rd('src/render/renderer.js'), /recordShadowBillboards\(batches, camRight, camUp\) \{ if \(this\._casting && batches\?\.length\) this\._shadows\.recordBillboards\(batches, this\._flatWind, camRight, camUp\); \}/, 'the seam records with the FRAME\'s wind (an off-screen wood casts a sun shadow that leans as the wood does)');
  assert.match(w, /else if \(renderer\.shadowReachBatch\(b\)\) castBatches\.push\(b\);/, 'a townsman');
  assert.match(w, /renderer\.drawBillboards\(livePersonBatches, camRight, UP_Y\);\n\s*if \(castBatches\.length\) renderer\.recordShadowBillboards\(castBatches, camRight, UP_Y\);/, 'recorded after the crowd, on the frame\'s wind');
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /if \(cullOn && aabbOutside\(_planes, d\.box\)\) \{[^\n]*\n\s*if \(renderer\.shadowReach\(d\.box\)\) renderer\.recordShadowMesh\(d\.mesh, d\.matrix, texRemap\);/, 'the draw list');
  assert.match(e, /if \(renderer\.shadowReach\(w\.box\)\) renderer\.recordShadowMesh\(millParts\.rotor, mountRotor\(w\.matrix, ROTOR_HUB, w\.state\.angle\), texRemap\);/, 'the sails');
  assert.match(e, /if \(renderer\.shadowReach\(b\._box\)\) _castBatches\.push\(b\);/, 'the flat batches');
  assert.match(e, /renderer\.drawBillboards\(_visBatches, camRight, UP_Y\);\n\s*if \(_castBatches\.length\) renderer\.recordShadowBillboards\(_castBatches, camRight, UP_Y\);/);
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js', 'src/scenes/interior.js']) assert.ok(!/aabbOutside\(/.test(rd(f)), `${f}: no view cull of casters to answer for`);
});
