// @ts-check
// STEADY-BALANCE (2026-10-04, Discord: "shadows too dark and too light where they should be normal ... light of candles too
// bright ... it fixed the flickering tho"): under Steady shadows the player's own card casts into the TWO lamps nearest it
// (SHADOW_SELF_LAMPS), as it does with the switch off - not into every lamp with a full map, which stacked a silhouette
// per lamp behind the player at the crosshair and opened the eye until the candles blew out. And the calmer eye is its
// own chip (prefs 'calmEye', off), no longer ridden on Steady shadows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { SHADOW_TUNING, SHADOW_SELF_LAMPS, SHADOW_POINT_CASTERS } from '../../src/render/shadowPass.js';
import { AIR_TUNING } from '../../src/render/airPass.js';
import { PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';

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

/** Six lamps about a player standing at the origin, every one in reach of the card. */
const SIX = [1, 2.5, 0, 12, -1, 2.5, 0, 12, 0, 2.5, 1.2, 12, 0, 2.5, -1.2, 12, 3, 2.5, 3, 12, -3, 2.5, -3, 12];
/** The slots whose live layers took the player's card this frame. */
const cardSlots = (sp, calls) => {
  const out = [];
  for (let k = 0; k < SHADOW_POINT_CASTERS; k++) if (slotWork(sp, calls, k).self > 0) out.push(k);
  return out;
};

test('STEADY-BALANCE: under Steady shadows the card casts into the two lamps nearest it, every frame, the same two - not into all six', () => {
  SHADOW_TUNING.override = true; SHADOW_TUNING.selfLamps = null;
  try {
    assert.equal(SHADOW_SELF_LAMPS, 2);
    const { sp, frame } = room(SIX);
    frame(); frame(); frame();
    let first = null;
    for (let f = 0; f < 12; f++) {
      const st = frame();
      const slots = cardSlots(sp, st.calls);
      assert.equal(slots.length, 2, `frame ${f}: two lamps take the card (the bug: all six, one silhouette each)`);
      assert.equal(st.selfLamps, 2, `frame ${f}: and the debug log's count says so`);
      first ??= slots.join();
      assert.equal(slots.join(), first, `frame ${f}: the same two - no hop`);
      // the two are the lamps nearest the card (lights 0-3 stand 1-1.2 off it, 4 and 5 over four)
      for (const k of slots) assert.ok(sp.shadowIndex[k] <= 3, `frame ${f}: slot ${k} is a near lamp`);
      // and every lamp is still redrawn every frame (Steady shadows' own law): six slots of six faces of the walls
      assert.equal(sp.casters, 6);
    }
  } finally { SHADOW_TUNING.override = null; SHADOW_TUNING.selfLamps = null; }
});

test('STEADY-BALANCE: the console knob puts FLICKER-FIX\'s every-lamp card back, to compare (selfLamps = 12)', () => {
  SHADOW_TUNING.override = true; SHADOW_TUNING.selfLamps = 12;
  try {
    const { sp, frame } = room(SIX);
    frame(); frame(); frame();
    const st = frame();
    assert.equal(cardSlots(sp, st.calls).length, 6, 'all six lamps take the card - the look the players reported');
  } finally { SHADOW_TUNING.override = null; SHADOW_TUNING.selfLamps = null; }
});

test('STEADY-BALANCE: with Steady shadows off the card\'s lamps are the two they always were', () => {
  SHADOW_TUNING.override = false; SHADOW_TUNING.selfLamps = null;
  try {
    const { sp, frame } = room(SIX);
    frame(); frame(); frame();
    for (let f = 0; f < 6; f++) assert.equal(cardSlots(sp, frame().calls).length, 2, `frame ${f}`);
  } finally { SHADOW_TUNING.override = null; }
});

test('STEADY-BALANCE: the calmer eye is its own chip - off by default, and Steady shadows no longer turns it on', () => {
  assert.equal(PREF_DEFAULTS.calmEye, false, 'off by default');
  SHADOW_TUNING.override = true; SHADOW_TUNING.calmForce = null;
  try {
    const { frame } = room(SIX);
    frame();
    assert.equal(AIR_TUNING.calm, false, 'Steady shadows on, the eye at its usual rate (the bug: a third of it)');
    SHADOW_TUNING.calmForce = true; frame();
    assert.equal(AIR_TUNING.calm, true, 'the chip (or the console) turns it on');
    SHADOW_TUNING.override = false; frame();
    assert.equal(AIR_TUNING.calm, true, 'whatever Steady shadows says');
  } finally { SHADOW_TUNING.override = null; SHADOW_TUNING.calmForce = null; AIR_TUNING.calm = false; }
});
