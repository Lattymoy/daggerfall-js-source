// ONE-BAD-BODY (FIELD BUGS 2026-10-13b, "Morrowind assets Still missing" - "After update they seemed to work for a moment
// but now it stopped working again"; the owner: "people are saying with morrowind models, people are invisible", online
// only). 12g's BATCH-SHUT closed one way the body batch stood open; the bodies still went, online, all at once, until a
// restart. The batch (MWNPC2) packs every picture after the last - one picture whose size is not a number put every
// picture queued after it at NaN, drawn over the first tile (the player's own body's) and composited from nowhere - and
// the peer layer INTEGRATES its poses (the pace, the yaw), so one non-finite read stayed for as long as the body stood.
// The real Renderer over a recording GL and the real drawRigSpriteBox; the real PeerBodies over a stub rig; the real
// pace. (On a real GL - Chromium's - one non-finite horse of three put the third's picture at 0 texels; the probe is
// named on the page.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../../../src/render/renderer.js';
import { drawRigSpriteBox } from '../../../src/render/characterSprite.js';
import { lookAt, perspective } from '../../../src/world/mat4.js';
import { PeerBodies } from '../../../src/net/peer/peerBodies.js';
import { stepPeerPace } from '../../../src/net/peer/peerPace.js';

/** A GL that records every call (as mwnpc5_bodyfx builds one). */
function recordingGl() {
  const calls = []; let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, { get(_, k) {
    if (k in consts) return consts[k];
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k === 'getAttribLocation') return () => 0;
    if (k === 'checkFramebufferStatus') return () => 36053;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
    if (k === 'getParameter') return () => new Float32Array(4);
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return (...a) => { calls.push([k, ...a.map((x) => (ArrayBuffer.isView(x) ? Array.from(x) : x))]); };
  } });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 1280, clientHeight: 720, width: 1280, height: 720 } };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const PROJ = perspective(1.1, 1280 / 720, 0.1, 500), EYE = [0, 1.6, 6], VIEW = lookAt(EYE, [0, 1, 0], [0, 1, 0]);

/** One body pass of five bodies, `bad` (an index, or null) standing at a place that is not a number - as a peer whose
 *  drawn pose went non-finite stands. Answers the batch it queued and the flush's tile viewports and quad origins. */
function pass(bad) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]));
  r.beginCharacterSpriteBatch();
  const xs = [-3, -1.5, 0, 1.5, 3];
  const warn = console.warn, said = [];
  console.warn = (m) => said.push(String(m));
  try {
    xs.forEach((x, i) => {
      const c = i === bad ? [NaN, 1, 0] : [x, 1, 0];
      drawRigSpriteBox(r, canvas, { vao: { id: `body${i}` }, count: 3 }, I, { center: c, halfW: 0.4, halfH: 0.9, anchor: c }, PROJ, VIEW, EYE);
    });
  } finally { console.warn = warn; }
  const queued = r._spriteBatch.items.map((it) => it.mesh.vao.id);
  calls.length = 0;
  r.flushCharacterSpriteBatch();
  const tiles = calls.filter((c) => c[0] === 'viewport' && typeof c[3] === 'number').map((c) => [c[1], c[2], c[3], c[4]]);   // a tile's (the world's restore reads the drawing buffer)
  const origins = calls.filter((c) => c[0] === 'uniform2f' && c[1] === 'uOrigin').map((c) => [c[2], c[3]]);
  return { queued, tiles, origins, said };
}

test('ONE-BAD-BODY: one body whose picture cannot be measured is left out of the batch - every other body keeps its own tile and its own quad, and the first tile (the player\'s own) is drawn once (mutants: the door takes it; the door asks one side only)', () => {
  const good = pass(null);
  assert.equal(good.queued.length, 5, 'five measured bodies, five pictures');
  assert.equal(good.tiles.length, 5);
  for (const bad of [0, 1, 3]) {
    const p = pass(bad);
    assert.deepEqual(p.queued, ['body0', 'body1', 'body2', 'body3', 'body4'].filter((_, i) => i !== bad), `body ${bad} is refused at the door, the others queued`);
    assert.equal(p.tiles.length, 4, 'four tiles drawn');
    assert.ok(p.tiles.every((t) => t.every(Number.isFinite)), 'every tile at a place that is a number - the packer never met the NaN');
    assert.equal(new Set(p.tiles.map((t) => `${t[0]},${t[1]}`)).size, 4, 'no tile drawn over another');
    assert.equal(p.tiles.filter((t) => t[0] === 0 && t[1] === 0).length, 1, 'the first tile drawn once - no later picture drawn over the player\'s own');
    assert.equal(p.origins.length, 4, 'four quads composited');
    assert.ok(p.origins.every((o) => o.every(Number.isFinite)), 'each sampling its own tile, none from nowhere');
    assert.equal(p.said.filter((m) => m.includes('could not be measured')).length, 1, 'said once on the console');
  }
  // the door asks both sides of the picture: a width or a height alone not a number is no tile either
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.beginCharacterSpriteBatch();
  const base = { mesh: {}, model: I, proj: PROJ, view: VIEW, tx: 0, ty: 0, quad: { at: [0, 0, 0], halfW: 1, halfH: 1, right: [1, 0, 0], up: [0, 1, 0] } };
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(r.queueCharacterSprite({ ...base, pw: NaN, ph: 40 }), false, 'a width that is not a number');
    assert.equal(r.queueCharacterSprite({ ...base, pw: 40, ph: NaN }), false, 'a height that is not a number');
    assert.equal(r.queueCharacterSprite({ ...base, pw: 40, ph: 80 }), true, 'a measured picture');
  } finally { console.warn = warn; }
  assert.equal(r._spriteBatch.items.length, 1);
  r.flushCharacterSpriteBatch();
});

/** A stub rig shaped as mwbody1's: built at once, third person once stepped, every drawThird recorded. */
function stubRig(log) {
  return () => {
    const r = { mode: 'first', updates: 0, cam: null,
      attach(_renderer, cam) { r.cam = cam; },
      async build() { return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1, bodyHeight: () => 1.8,
      setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.updates > 0,
      update() { r.updates++; },
      drawThird(_canvas, p) { if (!r.thirdActive()) return false; log.push({ feet: [...p.feet], yaw: p.yaw }); return true; },
      unload() {},
    };
    return r;
  };
}
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setTimeout(res, 0)); };
const toScene = (p) => [p.x, p.y, p.z];
const shown = (x, yaw = 0.5) => ({ x, y: 0, z: -6, yaw, pitch: 0, mv: 0 });
const peerAt = (s) => ({ id: 'p1', name: 'p1', told: true, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, shown: s });
const V = { proj: perspective(1.1, 16 / 9, 0.1, 500), view: lookAt([0, 1.6, 4], [0, 1, -6], [0, 1, 0]), eye: [0, 1.6, 4] };

test('ONE-BAD-BODY: a peer whose drawn pose goes non-finite keeps its body where it last stood and its yaw a number, moves on with the next good pose, and a body born on a bad yaw takes the first good one (mutants: the place taken as it came; the yaw taken as it came; the bad yaw kept)', async (t) => {
  const draws = [], said = [];
  let now = 1000;
  const warn = console.warn;
  console.warn = (m) => said.push(String(m));   // the line is the console's own (L10N4: a console line is a call on `console`)
  t.after(() => { console.warn = warn; });
  const pb = new PeerBodies({ renderer: {}, createRig: stubRig(draws), buildOpts: () => ({}), now: () => now });
  const frame = (s, dt = 1 / 60) => { now += 16; pb.sync([peerAt(s)], toScene, dt, [0, 0, 0]); draws.length = 0; pb.draw({ clientWidth: 1280, clientHeight: 720 }, V); return draws.at(-1) ?? null; };
  frame(shown(1)); await settle(); frame(shown(1));
  const ok = frame(shown(1));
  assert.ok(ok, 'the body stands and draws');
  assert.deepEqual(ok.feet, [1, 0, -6]);
  const bad = frame({ ...shown(1), x: NaN });
  assert.ok(bad, 'a bad pose: the body still draws');
  assert.deepEqual(bad.feet, [1, 0, -6], 'where it last stood');
  assert.ok(Number.isFinite(bad.yaw));
  const noYaw = frame({ ...shown(2), yaw: NaN });
  assert.ok(Number.isFinite(noYaw.yaw), 'a pose with no yaw: the yaw it had stands');
  assert.deepEqual(noYaw.feet, [2, 0, -6], 'its place taken - only the yaw was bad');
  const back = frame(shown(3, 0.9));
  assert.deepEqual(back.feet, [3, 0, -6], 'the next good pose moves it on - nothing of the bad one stayed');
  assert.ok(Number.isFinite(back.yaw) && back.yaw > noYaw.yaw, 'the yaw eases on toward the new pose');
  assert.equal(said.filter((m) => m.includes('drawn pose is not finite')).length, 1, 'said once, with the numbers');
  assert.match(said.find((m) => m.includes('drawn pose is not finite')), /x NaN/);
  // a body BORN on a pose with no yaw takes the first good one, never stays NaN
  const draws2 = [];
  const pb2 = new PeerBodies({ renderer: {}, createRig: stubRig(draws2), buildOpts: () => ({}), now: () => now });
  const frame2 = (s) => { now += 16; pb2.sync([peerAt(s)], toScene, 1 / 60, [0, 0, 0]); draws2.length = 0; pb2.draw({ clientWidth: 1280, clientHeight: 720 }, V); return draws2.at(-1) ?? null; };
  frame2({ ...shown(1), yaw: NaN }); await settle(); frame2({ ...shown(1), yaw: NaN });
  const first = frame2(shown(1, 0.7));
  assert.equal(first.yaw, 0.7, 'the first good yaw taken whole');
});

test('ONE-BAD-BODY: the pace - a travel that is not a number is a jump and a pace that is not one starts over, so no NaN stays in it (mutants: NaN read as a stride; the bad pace kept)', () => {
  assert.equal(stepPeerPace(2, [0, 0, 0], [NaN, 0, 0], 1 / 60), 0, 'a travel that is not a number: a jump');
  assert.equal(stepPeerPace(NaN, [0, 0, 0], [0.05, 0, 0], 1 / 60), 0, 'a pace that is not a number: starts over');
  let s = stepPeerPace(0, [0, 0, 0], [0.05, 0, 0], 1 / 60);
  s = stepPeerPace(s, [0.05, 0, 0], [NaN, 0, 0], 1 / 60);
  s = stepPeerPace(s, [0.05, 0, 0], [0.1, 0, 0], 1 / 60);
  assert.ok(Number.isFinite(s) && s > 0, 'the next good stride is a pace again');
  assert.equal(stepPeerPace(2, [0, 0, 0], [6, 0, 0], 1 / 60), 0, 'a real jump still resets (JUMP_UNITS)');
  assert.ok(Math.abs(stepPeerPace(2, [0, 0, 0], [0.05, 0, 0], 0.025) - (2 * 0.8 + (0.05 / 0.025) * 0.2)) < 1e-9, 'an ordinary stride eases as it did');
});
