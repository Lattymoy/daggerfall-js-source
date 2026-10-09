// MWNPC5 (2026-10-09, the MW-NPC arc's fifth slice - bible/04-Characters/Morrowind-NPCs.md section 10): A FOE'S TELLS ON
// ITS BODY. The billboard shader draws three things on a foe that the Morrowind body's quad did not: the wind-up's glint
// (TELL2 - a gameplay tell: the blow is coming), the elite's glow, outline and embers, and the dissolve (a revenant's fate
// burning it away, a companion through a portal). The quad takes all three now (`fx`), its texel reads inside the
// picture's own tile, and a body with a tell is pictured with the room it takes. Pinned here on a recording GL and the
// fixture rig: the uniforms each quad sends, a batch's quads each their own, the box's padding (a texel the size it was,
// the centre where it stood), and the tells handed down from the lane (PeerBodies `fxOf`) through the rig's drawThird.
// What a recording GL cannot say - that the shader compiles, draws the outline, the embers, the burn, and reads no
// neighbour's tile - tools/mwBodyFxProbe.mjs proves in Chromium.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/render/renderer.js';
import { drawRigSpriteBox, bodyFxPad } from '../src/render/characterSprite.js';
import { createFpArm } from '../src/combat/fpArm.js';
import { PeerBodies } from '../src/net/peerBodies.js';
import { lookAt, perspective } from '../src/world/mat4.js';
import { fixtureBodyDeps, countingRenderer } from './fixtures/mw/bodyRig.mjs';

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'checkFramebufferStatus') return () => 36053;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 640, clientHeight: 480, width: 640, height: 480 } };
}

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const PROJ = perspective(1.1, 640 / 480, 0.1, 500);
const VIEW = lookAt([0, 1.6, 6], [0, 1, 0], [0, 1, 0]);
const sent = (calls, name) => calls.filter((c) => c[1] === name && /^uniform/.test(c[0])).map((c) => c.slice(2));
const GLINT = [1, 0.3, 0.1, 0.8];

test('MWNPC5a the quad sends a body\'s tells - the glint, the elite\'s pulse and clock, the dissolve - and nothing for a body without them; a batch\'s quads each their own', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]));
  calls.length = 0;
  r.drawCharacterSpriteQuad({ id: 't' }, [0, 1, 0], 0.4, 0.9, [1, 0, 0], 0.2, 0.4, 0, null, null, null, { glint: GLINT, elite: 0.8, time: 3.5, dissolve: [0.4, 1, 0.5, 0.2] });
  assert.deepEqual(sent(calls, 'uGlint'), [GLINT]);
  assert.deepEqual(sent(calls, 'uElite'), [[0.8, 3.5]]);
  assert.deepEqual(sent(calls, 'uDissolve'), [[0.4, 1, 0.5, 0.2]]);
  calls.length = 0;
  r.drawCharacterSpriteQuad({ id: 't' }, [0, 1, 0], 0.4, 0.9, [1, 0, 0], 0.2, 0.4);
  assert.deepEqual(sent(calls, 'uGlint'), [[0, 0, 0, 0]], 'none: every tell off - a quad drawn after a glinting one carries none of it');
  assert.deepEqual(sent(calls, 'uElite'), [[0, 0]]);
  assert.deepEqual(sent(calls, 'uDissolve'), [[0, 0, 0, 0]]);
  calls.length = 0;
  r.drawCharacterSpriteQuad({ id: 't' }, [0, 1, 0], 0.4, 0.9, [1, 0, 0], 0.2, 0.4, 0, null, null, null, { elite: -0.5, time: 2 });
  assert.deepEqual(sent(calls, 'uElite'), [[-0.5, 2]], 'an elite\'s corpse: its negative pulse, the rim alone');
  // a batch: each queued body's quad sends its own
  const body = (fx, x) => drawRigSpriteBox(r, canvas, { vao: { id: `m${x}` }, count: 3 }, I, { center: [x, 1, 0], halfW: 0.4, halfH: 0.9, anchor: [x, 1, 0], fx }, PROJ, VIEW, [0, 1.6, 6]);
  r.beginCharacterSpriteBatch();
  body(null, -2); body({ glint: GLINT }, 0); body({ elite: 1, time: 4 }, 2);
  calls.length = 0;
  r.flushCharacterSpriteBatch();
  assert.deepEqual(sent(calls, 'uGlint'), [[0, 0, 0, 0], GLINT, [0, 0, 0, 0]], 'the second body glints, the others do not');
  assert.deepEqual(sent(calls, 'uElite'), [[0, 0], [0, 0], [1, 4]], 'the third glows');
});

test('MWNPC5b the box padded for the tells: two texels a side for an outline, twenty for an elite\'s embers, none for a body without (nor one burning away) - a texel the size it was, the centre where it stood', () => {
  assert.equal(bodyFxPad(null), 0);
  assert.equal(bodyFxPad({}), 0);
  assert.equal(bodyFxPad({ glint: [1, 0, 0, 0] }), 0, 'a glint at no strength is none');
  assert.equal(bodyFxPad({ glint: GLINT }), 2, 'the outline\'s two');
  assert.equal(bodyFxPad({ elite: -0.4 }), 2, 'a corpse\'s rim');
  assert.equal(bodyFxPad({ elite: 0.7 }), 20, 'the embers\' climb over the outline');
  assert.equal(bodyFxPad({ elite: 0.7, glint: GLINT }), 20);
  assert.equal(bodyFxPad({ elite: 0.7, dissolve: [0.3, 1, 1, 1] }), 0, 'burning away: no outline, no room');
  const queued = [];
  const r = { characterSpriteBatchOpen: true, queueCharacterSprite: (it) => queued.push(it) };
  const canvas = { clientHeight: 480 };
  const box = (fx) => drawRigSpriteBox(r, canvas, {}, I, { center: [0, 1, -4], halfW: 0.4, halfH: 0.9, fx }, PROJ, VIEW, [0, 1, 0]);
  const plain = box(null), out = box({ glint: GLINT }), ember = box({ elite: 1 });
  assert.equal(out.ph, plain.ph + 4, 'two texels top and bottom');
  assert.equal(out.pw, plain.pw + 4, 'and either side');
  assert.equal(ember.ph, plain.ph + 40);
  const texel = (2 * plain.halfH) / plain.ph;   // a texel's world size, up the picture
  for (const [b, pad] of [[out, 2], [ember, 20]]) {
    assert.ok(Math.abs(b.halfH / b.ph - plain.halfH / plain.ph) < 1e-9, 'a texel stays the size it was');
    assert.ok(Math.abs(b.halfW - (plain.halfW + pad * texel)) < 1e-9, 'the sides grown by the same texels');
    assert.deepEqual(b.center, plain.center, 'the quad stands where it stood');
  }
  assert.deepEqual(queued.map((q) => q.quad.fx), [null, { glint: GLINT }, { elite: 1 }], 'each queued quad carries its body\'s tells');
});

const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
const flush = () => new Promise((res) => setTimeout(res, 0));

test('MWNPC5c the tells come down from the lane: PeerBodies hands each body fxOf(its id), and the rig\'s drawThird hands them to the quad', async () => {
  const rec = countingRenderer();
  const quads = [];
  rec.drawCharacterSpriteQuad = (...a) => { quads.push(a[11] ?? null); };
  const rig = createFpArm(); rig.attach(rec, cam);
  assert.equal((await rig.build({ race: 'fprace', deps: fixtureBodyDeps() })).ok, true);
  rig.setViewMode('third'); rig.update(1 / 60, { pose: true });
  const eye = [0, 1.6, 6];
  assert.equal(rig.drawThird({ clientHeight: 480 }, { proj: PROJ, view: VIEW, eye, feet: [0, 0, 0], yaw: 1.5, fx: { glint: GLINT } }), true);
  assert.deepEqual(quads.at(-1), { glint: GLINT }, 'drawThird: the tells to the quad');
  rig.drawThird({ clientHeight: 480 }, { proj: PROJ, view: VIEW, eye, feet: [0, 0, 0], yaw: 1.5 });
  assert.equal(quads.at(-1), null, 'and none when none');
  // the lane: drawThird handed fxOf(id)
  const seen = [];
  const stub = () => ({ attach() {}, async build() { await flush(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1,
    setViewMode() { return true; }, thirdActive: () => true, update() {}, unload() {}, drawThird(_c, o) { seen.push(o.fx); return true; } });
  const pb = new PeerBodies({ renderer: {}, createRig: stub, buildOpts: () => ({}), now: () => 1000 });
  const peer = (id, z) => ({ id, name: '', told: true, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, cn: 0 } });
  for (let i = 0; i < 6; i++) { pb.sync([peer('a', -3), peer('b', -4)], (p) => [p.x, p.y, p.z], 1 / 60, [0, 0, 0]); for (let k = 0; k < 4; k++) await flush(); }
  const fx = { a: { glint: GLINT }, b: null };
  seen.length = 0;
  pb.draw({}, { proj: PROJ, view: lookAt([0, 1.6, 2], [0, 1, -3], [0, 1, 0]), eye: [0, 1.6, 2], fxOf: (id) => fx[id] });
  assert.deepEqual(seen.sort((x, y) => (x ? 1 : 0) - (y ? 1 : 0)), [null, { glint: GLINT }], 'each body its own');
  seen.length = 0;
  pb.draw({}, { proj: PROJ, view: lookAt([0, 1.6, 2], [0, 1, -3], [0, 1, 0]), eye: [0, 1.6, 2] });
  assert.deepEqual(seen, [null, null], 'a lane that names none: none');
});
