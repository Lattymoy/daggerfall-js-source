// DISC24-C (2026-09-24, icebreyker on Discord, "Lights/shadows are still bugged": "Sorry for being annoying, but i am
// still getting this problem with Enhanced Lighting" - DISC13-A's flicker, in a lit interior, with the player's whole
// silhouette thrown up the wall by a ceiling lamp).
//
// THE CAUSE: the player's own sprite body (player/eotbBody.js - "Shadows Only" in first person, the body in third) is
// the one caster that moves with the view, and the lamps' shadow laws handled it as any flat:
//  - STILL WHEN THE PLAYER STOPPED: SHADOW_DYNAMIC_HOLD frames after a pause it joined the static cache of every
//    lamp in reach, and the next step or turn threw it out - every one of those caches rebuilt in one frame, and its
//    shadow jumped between the cache and the dynamic lane's cadence;
//  - A LAMP PAST THE NEAREST TWO redraws every third frame, so there the silhouette trailed the player by up to two
//    frames and caught up in a jerk;
//  - TURNED TO FACE EACH LAMP, which the mod's card never is (Unity draws a ShadowsOnly renderer's shadow in its own
//    transform - Eye_Of_The_Beholder.il IL_4e42), so walking round a lamp swung the silhouette through a half turn.
//
// Driven through the real Renderer and its real shadow pass on a recording fake GL (sc1_shadowcache's), with the card
// flagged as player/eotbBody.js flags it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_DYNAMIC_HOLD, SHADOW_FAR_CASTER_EVERY } from '../src/render/shadowPass.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A view matrix that stands the eye at (x, y, z). */
const eyeAt = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);

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
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** A room with lamps, the player's card and whatever else `extra` draws. */
function room(lights) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('201_1', { id: 't2011' }); r.textures.set('1_1', { id: 't11' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  const walls = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 12]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const self = { archive: 201, record: 1, vao: { id: 'vao-self' }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: [0, 0, 0], bounds: new Float32Array([0, 0.9, 0, 1]), selfCard: true };
  const camRight = new Float32Array([1, 0, 0]);
  let view = I;
  const frame = (extra = () => {}) => {
    r.setPointLights(new Float32Array(lights), new Float32Array(lights.length / 4 * 3).fill(1));
    calls.length = 0;
    r.beginFrame(I, view, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
    const st = { ...r.shadows.stats, calls: calls.slice() };
    r.drawMesh(walls, I, null);
    r.drawBillboards([self], camRight, new Float32Array([0, 1, 0]));
    extra();
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp: r.shadows, self, frame, setEye: (x, y, z) => { view = eyeAt(x, y, z); } };
}
/** The draws into slot k's live layers this frame, the blits into them, and whether the player's card (drawn at
 *  `selfX`) was one of the draws. */
function slotWork(sp, calls, k, selfX = 0) {
  const fbos = new Set(sp.pointFbos.slice(k * 6, k * 6 + 6));
  let into = false, draws = 0, blits = 0, self = 0, origin = null;
  for (const c of calls) {
    if (c[0] === 'bindFramebuffer' && c[1] === 36160) into = fbos.has(c[2]);
    else if (c[0] === 'bindFramebuffer' && c[1] === 36009) { if (fbos.has(c[2])) blits++; }
    else if (c[0] === 'bindFramebuffer') into = false;
    else if (c[0] === 'uniform3f' && c[1] === 'uOrigin') origin = c[2];
    else if (c[0] === 'drawElements' && into) { draws++; if (origin === selfX) self++; origin = null; }
  }
  return { draws, blits, self };
}
/** A townsman who never stands still, at (x, 0, z). */
function walker(x, z) {
  const w = { archive: 201, record: 1, vao: { id: `vao-walker-${x}` }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: [x, 0, z], bounds: new Float32Array([0, 0.9, 0, 1]) };
  w.step = () => { w.origin = [w.origin[0], 0, w.origin[2] + 0.01]; };
  return w;
}
const slotOfLight = (sp, i) => [...sp.shadowIndex].indexOf(i);

test('DISC24-C: the player\'s card is never still - a pause does not bake it into the lamps\' caches, so a step does not rebuild them', () => {
  const { self, frame } = room([0, 2.5, 0, 10]);
  frame(); frame();
  let rebuilt = 0, lane = 0;
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 20; f++) {   // the player stands still through the hold and past it
    const st = frame();
    if (f > 0 && st.staticFaces) rebuilt++;
    if (st.dynFaces) lane++;
    assert.equal(self._shDyn, true, `frame ${f}: still a mover`);
  }
  assert.equal(rebuilt, 0, 'the cache was never rebuilt to take the card in (the bug: once at the hold\'s end)');
  assert.equal(lane, SHADOW_DYNAMIC_HOLD + 20, 'it is drawn on top every frame, the nearest lamp\'s cadence');
  self.origin = [0.3, 0, 0];   // the next step
  const st = frame();
  assert.equal(st.staticFaces, 0, 'and a step rebuilds nothing (the bug: every cache in reach, in one frame)');
});

test('DISC24-C: the card casts only into maps redrawn EVERY frame - never into a far lamp\'s third-frame map, where it trailed the player', () => {
  // two lamps beside the player (the nearest two: every frame) and one across the room (every third frame), all in reach
  const { sp, frame } = room([1, 2.5, 0, 12, -1, 2.5, 0, 12, 6, 2.5, 0, 12]);
  frame(); frame(); frame();
  const far = slotOfLight(sp, 2);
  assert.ok(far >= 0, 'the far lamp holds a slot');
  for (let f = 0; f < 3 * SHADOW_FAR_CASTER_EVERY; f++) {
    const st = frame();
    assert.equal(st.dynFaces, 12, `frame ${f}: the two near lamps redraw the card every frame, and only they (the bug: 18 on the far lamp's frame)`);
    assert.equal(slotWork(sp, st.calls, far).draws, 0, `frame ${f}: nothing drawn into the far lamp's map`);
  }
});

test('DISC24-C: a far lamp that IS redrawn - for a townsman walking under it - draws him and never the player\'s card', () => {
  const { r, sp, frame } = room([1, 2.5, 0, 12, -1, 2.5, 0, 12, 6, 2.5, 0, 12]);
  const man = walker(6.5, 0.5);
  const him = () => { man.step(); r.drawBillboards([man], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
  frame(him); frame(him); frame(him);
  const far = slotOfLight(sp, 2);
  let redrawn = 0;
  for (let f = 0; f < 3 * SHADOW_FAR_CASTER_EVERY; f++) {
    const w = slotWork(sp, frame(him).calls, far);
    if (w.draws) redrawn++;
    assert.equal(w.self, 0, `frame ${f}: the card is not in the far lamp's map (the bug: every third frame, two frames late)`);
  }
  assert.equal(redrawn, 3, 'the far lamp redrew on its own cadence, for the townsman');
});

test('DISC24-C: a lamp whose rank changes takes the card in, or lets it go, on THAT frame - no stale silhouette', () => {
  const { sp, frame, setEye } = room([1, 2.5, 0, 12, -1, 2.5, 0, 12, 6, 2.5, 0, 12]);
  frame(); frame(); frame();
  const west = slotOfLight(sp, 1), east = slotOfLight(sp, 2);
  // the player walks east: the far lamp becomes the nearest, the west lamp the farthest
  setEye(6, 1.6, 0);
  let st = frame();
  const w = slotWork(sp, st.calls, west), e = slotWork(sp, st.calls, east);
  assert.equal(w.draws, 0, 'the west lamp draws nothing more');
  assert.equal(w.blits, 6, 'and its map is put back to the cache at once - the card it held is gone this frame');
  assert.ok(e.draws > 0, 'the east lamp takes the card in this frame');
  // the next frames: the west lamp is quiet (the card is no reason to redraw it), the east one redraws every frame
  for (let f = 0; f < SHADOW_FAR_CASTER_EVERY; f++) {
    st = frame();
    assert.deepEqual(slotWork(sp, st.calls, west), { draws: 0, blits: 0, self: 0 }, `frame ${f}: the far lamp idle`);
    assert.ok(slotWork(sp, st.calls, east).draws > 0, `frame ${f}: the near lamp, every frame`);
  }
});

test('DISC24-C: a lamp that falls in rank with a townsman still under it lets the card go on THAT frame, whatever its cadence', () => {
  for (let phase = 0; phase < SHADOW_FAR_CASTER_EVERY; phase++) {
    const { r, sp, frame, setEye } = room([1, 2.5, 0, 12, -1, 2.5, 0, 12, 6, 2.5, 0, 12]);
    const man = walker(-1.5, 0.5);
    const him = () => { man.step(); r.drawBillboards([man], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); };
    for (let f = 0; f < 3 + phase; f++) frame(him);
    const west = slotOfLight(sp, 1);
    assert.ok(slotWork(sp, frame(him).calls, west).self > 0, `phase ${phase}: the near west lamp holds the card`);
    setEye(6, 1.6, 0);
    const w = slotWork(sp, frame(him).calls, west);
    assert.ok(w.draws > 0, `phase ${phase}: the west lamp is redrawn on the frame it falls (the bug: at its next third frame)`);
    assert.equal(w.self, 0, `phase ${phase}: without the card`);
  }
});

test('DISC24-C: the card casts as it is DRAWN, never turned to the lamp; every other flat still faces the lamp', () => {
  const { r, self, frame } = room([0, 2.5, 0, 12]);
  self.origin = [2, 0, 0];
  const npc = { archive: 201, record: 1, vao: { id: 'vao-npc' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [-2, 0, 0], bounds: new Float32Array([0, 1, 0, 1.2]), _dyn: true };
  const both = () => r.drawBillboards([npc], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  frame(both); frame(both);
  // the card stands east of the lamp: turned to it, its right would be (0,0,1); drawn, it is the camera's (1,0,0)
  const { calls } = frame(both);
  let right = null, origin = null;
  const seen = { self: [], npc: [] };
  for (const c of calls) {
    if (c[0] === 'uniform3fv' && c[1] === 'uRight') right = [...c[2]];
    else if (c[0] === 'uniform3f' && c[1] === 'uOrigin') origin = [c[2], c[3], c[4]];
    else if (c[0] === 'drawElements' && origin && right) {
      if (origin[0] === 2) seen.self.push(right);
      if (origin[0] === -2) seen.npc.push(right);
    }
  }
  assert.ok(seen.self.length > 0, 'the card was drawn into the lamp\'s map');
  for (const v of seen.self) assert.deepEqual(v.map((n) => Math.round(n * 1e6) / 1e6), [1, 0, 0], 'in the basis it was drawn with (the bug: turned to face the lamp)');
  assert.ok(seen.npc.length > 0);
  for (const v of seen.npc) assert.deepEqual(v.map((n) => Math.round(n * 1e6) / 1e6), [0, 0, -1], 'a townsman west of the lamp still turns to face it');
});
