// DISC29-E (2026-09-28, Kristian B on Discord: interior lighting flickers and throws shadows through walls, worst in
// the Mages Guild) - A LAMP'S SHADOW OF A FLAT FACES IT FROM THE FLAT, AND AN IDLING FLAT CASTS INTO EVERY LAMP.
//
// Traced on the real renderer over the real MAGEAA00/MAGEAA08 (a Mages Guild: ten people a hall, nearly half of them
// idling in place, fourteen floor braziers). Two faults compounded:
//  - A lamp's replay turned every flat to face it with ONE `right` a batch, from the batch's origin - and a batch whose
//    centres are baked into its vertices (every interior flat: createBillboardBatch, origin null) has none, so each
//    card faced the lamp from the WORLD'S origin, often edge-on: its silhouette on the wall a sliver, and its own base
//    shadowed, so the sprite went dark for that lamp (29% darker in the probe). BB_VS turns each flat to face the lamp
//    from its own centre now (uFacePoint), and the player's card, as DISC24-C law, never turns.
//  - An idling flat is a mover (its frame changes), movers cast only into the eight 512 maps, and the eight follow the
//    camera: as the view turned, a lamp left the eight and the idler's shadow vanished from it (and came back). An
//    idler whose place is still is classed apart (`_shAnim`) and the lo tier keeps it (REPLAY_LO), folded into the lo
//    signature by its id and place - a new frame is never a rebuild.
// And the player's own card, which casts only into maps redrawn every frame, took the two lamps nearest the EYE - in
// third person the eye circles the player, so turning the camera moved the silhouette from lamp to lamp. It takes the
// two nearest the card.
//
// The maps themselves do not leak: emulated against ray-cast truth over MAGEAA00, 0.05% of the lit energy reaches an
// occluded surface, and no lamp lit through a wall or a floor in the browser. What does light through walls is a
// CARRIED light (a torch, a lantern, a Light spell - and a peer's), which has no map: recorded, not changed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { SHADOW_DYNAMIC_HOLD, SHADOW_TUNING } from '../../src/render/shadowPass.js';
SHADOW_TUNING.override = false;   // FLICKER-FIX: these tests pin the old schedule (the card's lamps by eye, the far casters' cadence)

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const eyeAt = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
const FB = 36160, DRAW_FB = 36009;

/** A recording fake GL (DISC24-C's): every call kept, a uniform's location its name. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: DRAW_FB, FRAMEBUFFER: FB };
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
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** A lit interior: a room mesh reaching every lamp, `lamps` (x, y, z, range), the player's card, and what `extra` draws. */
function hall(lamps, { every = false } = {}) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['201_1', '201_2', '1_1']) r.textures.set(k, { id: `t${k}` });
  r.setLighting(new Float32Array([0.18, 0.18, 0.18]), 0);   // an interior: ambient, no sun
  const walls = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 40]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const self = { archive: 201, record: 1, vao: { id: 'vao-self' }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: [0, 0, 0], bounds: new Float32Array([0, 0.9, 0, 1]), selfCard: true };
  let view = I;
  let L = lamps;
  const frame = (extra = () => {}) => {
    r.setPointLights(new Float32Array(L), new Float32Array(L.length / 4 * 3).fill(1));
    if (every) r.everyLightCasts();
    calls.length = 0;
    r.beginFrame(I, view, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
    const st = { ...r.shadows.stats, calls: calls.slice() };
    r.drawMesh(walls, I, null);
    r.drawBillboards([self], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
    extra(r);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp: r.shadows, self, frame, setEye: (x, y, z) => { view = eyeAt(x, y, z); }, setLamps: (next) => { L = next; } };
}
/** Every draw into the framebuffers `fbos`, with the origin and the face point it was drawn under. */
function drawsInto(calls, fbos) {
  const into = new Set(fbos);
  const out = [];
  let bound = false, origin = null, face = null, vao = null;
  for (const c of calls) {
    if (c[0] === 'bindFramebuffer' && c[1] === FB) bound = into.has(c[2]);
    else if (c[0] === 'bindFramebuffer' && c[1] !== DRAW_FB) bound = false;
    else if (c[0] === 'uniform3f' && c[1] === 'uOrigin') origin = [c[2], c[3], c[4]];
    else if (c[0] === 'uniformMatrix4fv' && c[1] === 'uModel') origin = null;   // a mesh's draw
    else if (c[0] === 'uniform4f' && c[1] === 'uFacePoint') face = [c[2], c[3], c[4], c[5]];
    else if (c[0] === 'bindVertexArray') vao = c[1]?.id ?? null;
    else if (c[0] === 'drawElements' && bound) out.push({ origin, face, vao });
  }
  return out;
}
const at = (x) => (d) => d.origin && d.origin[0] === x;
const of = (b) => (d) => d.vao === b.vao.id;
/** AUDIT PRE-MERGE 0929 E1: a mage idling where the interior's build stood him - his centre baked into the vertices
 *  (no origin: nothing can walk him), as an interior's and a dungeon's flats are. */
function bakedIdler(x, z) {
  const b = { archive: 201, record: 1, vao: { id: `vao-mage-${x}` }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: null, bounds: new Float32Array([x, 0.9, z, 1]) };
  b.idle = () => { b.record = b.record === 1 ? 2 : 1; };
  return b;
}
/** A townsman idling where he stands: the record turns (an idle's frames), the place never moves. */
function idler(x, z) {
  const b = { archive: 201, record: 1, vao: { id: `vao-idler-${x}` }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: [x, 0, z], bounds: new Float32Array([0, 0.9, 0, 1]) };
  b.idle = () => { b.record = b.record === 1 ? 2 : 1; };
  return b;
}
function walker(x, z) {
  const b = { archive: 201, record: 1, vao: { id: `vao-walker-${x}` }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: [x, 0, z], bounds: new Float32Array([0, 0.9, 0, 1]) };
  b.step = () => { b.origin = [b.origin[0], 0, b.origin[2] + 0.05]; b.record = b.record === 1 ? 2 : 1; };
  return b;
}

test('DISC29-E: a lamp replay turns each flat to face it from its OWN centre (uFacePoint); the player\'s card never turns', () => {
  const lamp = [0, 2.5, 0, 12];
  const { r, sp, self, frame } = hall(lamp);
  self.origin = [-2, 0, 0];
  // a flat whose centre is baked into its vertices: no origin (createBillboardBatch, every interior flat)
  const baked = { archive: 201, record: 1, vao: { id: 'vao-baked' }, indexCount: 6, size: { w: 1, h: 2 }, origin: null, bounds: new Float32Array([3, 1, 0, 1.2]) };
  const draw = (rr) => rr.drawBillboards([baked], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  const calls = [];
  for (let f = 0; f < 3; f++) calls.push(...frame(draw).calls);
  const slot = [...sp.shadowIndex].indexOf(0);
  assert.ok(slot >= 0, 'the lamp holds a 512 slot');
  // the still flat is drawn into the slot's static cache (the frame it is built), the card into its live layers
  const draws = drawsInto(calls, [...sp.pointFbos.slice(slot * 6, slot * 6 + 6), ...sp.cacheFbos.slice(slot * 6, slot * 6 + 6)]);
  const flat = draws.filter((d) => d.origin && d.origin[0] === 0 && d.origin[1] === 0 && d.origin[2] === 0);   // ZERO_ORIGIN: the baked flat's
  const card = draws.filter(at(-2));
  assert.ok(flat.length > 0 && card.length > 0, 'both cast into the lamp');
  for (const d of flat) assert.deepEqual(d.face, [0, 2.5, 0, 1], 'the baked flat turns to the lamp from its own centre (w = 1)');
  for (const d of card) assert.equal(d.face[3], 0, 'DISC24-C: the card casts as it is drawn, never turned');
  // the lit pass never sets it: BB_VS's w defaults to 0 there, and uRight stands
  assert.equal(calls.filter((c) => c[0] === 'uniform4f' && c[1] === 'uFacePoint' && c[5] === 1 && (c[2] !== 0 || c[3] !== 2.5 || c[4] !== 0)).length, 0, 'only ever the lamp');
  void r;
});

test('DISC29-E: BB_VS faces the lamp per vertex - right = up x (lamp - flat) off each flat\'s own base, uRight when off or overhead', () => {
  const vs = rd('src/render/renderer.js');
  const bb = vs.slice(vs.indexOf('const BB_VS = `'), vs.indexOf('}`;', vs.indexOf('const BB_VS = `')));
  assert.match(bb, /uniform vec4 uFacePoint;/);
  assert.match(bb, /vec3 right = uRight;\n\s+if \(uFacePoint\.w > 0\.5\) \{\n\s+vec2 toLamp = uFacePoint\.xz - vBBBase\.xz;\n\s+float lampDist = length\(toLamp\);\n\s+if \(lampDist > 1e-4\) right = vec3\(toLamp\.y, 0\.0, -toLamp\.x\) \/ lampDist;/);
  assert.match(bb, /vec3 world = aCenter \+ uOrigin\n\s+\+ right \* \((?:aCorner|cn)\.x \* uSize\.x\)/, 'the quad is placed with that right');   // ELITE FOES: `cn` is aCorner, widened only for an elite
  // the same law the replay's per-batch fallback computes: (dz, 0, -dx) / |d| is perpendicular to the lamp's direction
  const faceRight = (lamp, base) => { const dx = lamp[0] - base[0], dz = lamp[2] - base[2], l = Math.hypot(dx, dz); return [dz / l, 0, -dx / l]; };
  const rgt = faceRight([0, 2.5, 0], [3, 0, 4]);
  assert.ok(Math.abs(rgt[0] * (0 - 3) + rgt[2] * (0 - 4)) < 1e-12, 'edge-on to nothing: the card faces the lamp');
  assert.match(rd('src/render/shadowPass.js'), /const face = perBatchRight && !b\.selfCard;/, 'the replay\'s word, per flat');
});

test('DISC29-E: a flat idling in place is its own class - a mover to the eight, kept by the lo tier; a walker is not. AUDIT PRE-MERGE 0929 E1: and only a flat that cannot walk - a foe, a peer or the Warden standing a second is still the eight\'s, and its walking off rebuilds no lo map and leaves no silhouette behind (mutants: the class for an origin\'s flat; the class judged by stillness)', () => {
  const lamps = [];
  for (let i = 0; i < 12; i++) lamps.push(i * 1.5, 2, 3, 15);
  // LIGHT-ID (re-aimed, Mac 2026-10-14): a lamp reading its 512 map keeps no lo map - two lamps past the twelve, within the
  // mage's reach, are the lo maps he must be in
  lamps.push(4, 2, 17.5, 15, 6, 2, 17.5, 15);
  const h = hall(lamps, { every: true });
  const mage = bakedIdler(4, 3), foe = idler(10, 3), feet = walker(7, 3);
  const draw = (rr) => rr.drawBillboards([mage, foe, feet], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  h.frame(draw);   // the entry frame
  // the walker's first step takes him out of every lamp's still set, and the lo tier catches up SHADOW_LO_REBUILDS a
  // frame (DISC15's own budget) - let it settle, and the foe stand past the hold that once made him an idler
  const warm = [];
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 12; f++) { mage.idle(); foe.idle(); feet.step(); warm.push(...h.frame(draw).calls); }
  const warmLo = drawsInto(warm, h.sp._loFbos);
  assert.ok(warmLo.some(of(mage)), 'the lamps within his reach drew the mage into their lo maps');
  assert.equal(warmLo.some(of(h.self)), false, 'and never the player\'s own card, a mover that stands still as often as not (DISC24-C: every frame, the eight alone)');
  // (the foe stood still on the entry frame, before his first idle - a static caster then, in the lo maps as on main;
  // his first idle made him a mover and took him out of them, as it always did)
  assert.equal(mage._shDyn, true, 'the idle is a mover to the 512 maps (its silhouette changes)');
  assert.equal(mage._shAnim, true, 'and animating IN PLACE');
  assert.equal(foe._shDyn, true);
  assert.equal(foe._shAnim, false, 'an origin places him: never in place, however long he stands');
  assert.equal(feet._shAnim, false, 'a walker is not');
  // the idle's frames are no rebuild of any lo map
  for (let f = 0; f < 3; f++) { mage.idle(); foe.idle(); feet.step(); const st = h.frame(draw); assert.equal(st.loFaces, 0, `frame ${f}: no lo face redrawn for a new frame`); }
  // the foe walks on: no lo map held him, so none is rebuilt and none shows him where he stood (the ghost E1 found)
  for (let f = 0; f < 6; f++) {
    mage.idle(); feet.step(); foe.origin = [foe.origin[0] + 0.3, 0, foe.origin[2]]; foe.idle();
    const st = h.frame(draw);
    assert.equal(st.loFaces, 0, `frame ${f}: the foe's walking off rebuilt a lo map`);
    assert.equal(drawsInto(st.calls, h.sp._loFbos).some(of(foe)), false);
  }
  // a lamp arrives: its lo map is drawn now, with the mage in it and neither the foe nor the walker
  const more = [...lamps, 18, 2, 3, 15];
  h.setLamps(more);
  mage.idle(); foe.idle(); feet.step();
  const st = h.frame(draw);
  const sl = h.sp._loSlotLight;
  let j = -1;
  for (let k = 0; k < h.sp._loCap; k++) if (sl[k * 4] === 18 && sl[k * 4 + 1] === 2 && sl[k * 4 + 2] === 3) j = k;
  assert.ok(j >= 0, 'the new lamp holds a lo slot');
  const lo = drawsInto(st.calls, h.sp._loFbos.slice(j * 6, j * 6 + 6));
  assert.ok(lo.some(of(mage)), 'the mage casts into the lo map (the bug: a lamp past the eight lost his shadow)');
  assert.equal(lo.some(of(feet)), false, 'the walker does not - the lo tier keeps what stands still');
  assert.equal(lo.some(of(foe)), false, 'nor the foe');
  // he is part of every lo map's signature (by his id and place), so when he is gone the maps that held him are
  // redrawn - a signature blind to him would leave his silhouette on the wall
  const gone = (rr) => rr.drawBillboards([foe, feet], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  let redrawn = 0;
  for (let f = 0; f < 8; f++) { feet.step(); redrawn += h.frame(gone).loFaces; }
  assert.ok(redrawn > 0, 'the lo maps that held him are drawn again without him');
});

test('DISC29-E / AUDIT PRE-MERGE 0929 E3: the card\'s two lamps are CASTERS - a camera far off (the setting runs to 10 m) picked the eight lamps nearest IT, the card\'s own were not among them, and the silhouette hopped from lamp to lamp as it circled (mutants: the card\'s lamps not reserved; a reserved lamp in place of another of the card\'s)', () => {
  // two lamps beside the card (x -1 and 1) and fourteen about a point 10 m off, nearer every camera below (FLICKER-FIX: past the twelve casters)
  const lamps = [-1, 2.5, 0, 12, 1, 2.5, 0, 12];
  for (let i = 0; i < 14; i++) lamps.push(8 + (i % 7) * 1.5, 2.5, i < 7 ? -3 : 3, 12);
  const { sp, self, frame, setEye } = hall(lamps);
  self.origin = [0, 0, 0];
  frame(); frame(); frame();
  const holdsCard = (st, slot) => drawsInto(st.calls, sp.pointFbos.slice(slot * 6, slot * 6 + 6)).some(at(0));
  for (const [x, z] of [[10, 0], [8, 6], [7, -7], [10, 3]]) {
    setEye(x, 1.6, z);   // the camera circles far off; the player does not move
    frame(); frame();
    const idx = [...sp.shadowIndex];
    const west = idx.indexOf(0), east = idx.indexOf(1);
    assert.ok(west >= 0 && east >= 0, `eye at ${x},${z}: the card's lamps are not casters (${idx})`);
    assert.equal(sp._slotSelf[west], 1, `eye at ${x},${z}: the west lamp holds the card`);
    assert.equal(sp._slotSelf[east], 1, `eye at ${x},${z}: the east lamp holds the card`);
    assert.ok(holdsCard(frame(), west), `eye at ${x},${z}: drawn into the west lamp`);
    assert.equal(idx.filter((i) => i >= 0).length, 12, 'twelve casters still - the eye\'s farthest gave way');
  }
  // the card is noted as it is recorded, not looked for (AUDIT PRE-MERGE 0929 E2: every batch of every record, every frame)
  assert.doesNotMatch(rd('src/render/shadowPass.js').slice(rd('src/render/shadowPass.js').indexOf('  _selfCardAt(out) {'), rd('src/render/shadowPass.js').indexOf('  _selfCardAt(out) {') + 400), /for \(/, 'no walk in _selfCardAt');
});

test('DISC29-E: the player\'s card casts into the two lamps nearest IT - a camera circling a still player moves nothing', () => {
  // lamps west (-1), near (1) and east (6); the card stands at 0
  const { sp, self, frame, setEye } = hall([-1, 2.5, 0, 12, 1, 2.5, 0, 12, 6, 2.5, 0, 12]);
  self.origin = [0, 0, 0];
  frame(); frame(); frame();
  const west = [...sp.shadowIndex].indexOf(0), east = [...sp.shadowIndex].indexOf(2);
  const holdsCard = (st, slot) => drawsInto(st.calls, sp.pointFbos.slice(slot * 6, slot * 6 + 6)).some(at(0));
  for (const [x, z] of [[4, 0], [3, 3], [-3, 3], [0, -4]]) {
    setEye(x, 1.6, z);   // the camera circles; the player does not move
    frame(); frame();
    assert.equal(sp._slotSelf[west], 1, `eye at ${x},${z}: the west lamp (1 m from the card) keeps the card`);
    assert.equal(sp._slotSelf[east], 0, `eye at ${x},${z}: the east lamp (6 m) never takes it`);
  }
  // ...and a lamp that holds the card is drawn EVERY frame (DISC24-C's law), even with the eye far from it
  setEye(8, 1.6, 0);
  frame();
  for (let f = 0; f < 3; f++) assert.ok(holdsCard(frame(), west), `frame ${f}: the card in the west lamp, every frame`);
  // the player walks east: the card's lamps follow the CARD
  self.origin = [6, 0, 0]; setEye(6, 1.6, 0);
  const st = frame();
  assert.equal(sp._slotSelf[east], 1, 'the east lamp takes the card');
  assert.equal(holdsCard(st, west), false, 'and the west lamp lets it go that frame');
});
