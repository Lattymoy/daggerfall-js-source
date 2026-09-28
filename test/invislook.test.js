// INVIS-LOOK (2026-09-27, Mac: "Give invisibility the same invisibility we give enemies in enhanced AI. That transparent
// look"). INVIS-NET drew a concealed peer (the pose's `cv`) as the A5 law draws a concealed foe - not at all. Under
// Enhanced Combat Visuals a peer is drawn as that lane draws a concealed foe: Chameleon's translucent shimmer and ripple,
// a shade's dark silhouette - and, the one departure (asked for), an INVISIBLE player takes the shimmer where a foe's
// invisibility is still not drawn. Every figure that can stand for a peer carries it: the rider, the walker, the class
// sprite and the doll (their billboard batches, the renderer's blended phase), and the Morrowind body (its sprite box's
// quad, blended, drawn after each mode's opaque world). No name over a concealed peer. The classic lane is INVIS-NET's.
// Driven through the look's law, the real sprite layers, PeerBodies over a fake rig, the real renderer over a recording
// GL with the quad's own fragment shader run by test/glsl.mjs, and the hosts by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions, GlslDiscard } from './glsl.mjs';
import { peerDraw, peerPhase, foeDraw, CONCEAL_MODE, BLEND_ALPHA, BLEND_SHIMMER, SHADE_ALPHA, SHADE_DARK } from '../src/systems/combatVisuals.js';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { createPeerWalkers, createPeerRiders, createEotbArt } from '../src/net/peerRiders.js';
import { PeerBodies } from '../src/net/peerBodies.js';
import { Renderer } from '../src/render/renderer.js';
import { PAPERDOLL_W, PAPERDOLL_H } from '../src/ui/paperDoll.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = () => new Promise((r) => setTimeout(r, 5));
const toScene = (p) => [p.x, p.y, p.z];
const TWO_PI = 2 * Math.PI;

test('INVIS-LOOK: the look - open is plain; the classic lane hides every concealment (INVIS-NET); the enhanced lane draws a blending peer and an INVISIBLE one as the shimmer, a shade as the dark silhouette, invisible over blending over shade - where a foe\'s invisibility is still not drawn', () => {
  assert.equal(peerDraw(0, true, 1, 'p').kind, 'plain');
  assert.equal(peerDraw(8, true, 1, 'p').kind, 'plain', 'only the three bits');
  for (const bits of [1, 2, 4, 7]) assert.equal(peerDraw(bits, false, 1, 'p').kind, 'hidden', `off: ${bits} is not drawn`);
  const inv = peerDraw(1, true, 1, 'p');
  assert.equal(inv.kind, 'conceal', 'invisible: drawn');
  assert.equal(inv.visual.mode, CONCEAL_MODE.blend, 'as the shimmer');
  assert.ok(inv.visual.alpha >= BLEND_ALPHA - BLEND_SHIMMER - 1e-12 && inv.visual.alpha <= BLEND_ALPHA + BLEND_SHIMMER + 1e-12, `translucent (${inv.visual.alpha})`);
  assert.equal(peerDraw(2, true, 1, 'p').visual.mode, CONCEAL_MODE.blend, 'blending: the shimmer');
  const shade = peerDraw(4, true, 1, 'p').visual;
  assert.deepEqual([shade.mode, shade.alpha], [CONCEAL_MODE.shade, SHADE_ALPHA], 'a shade: the dark silhouette');
  for (const bits of [3, 5, 6, 7]) assert.equal(peerDraw(bits, true, 1, 'p').visual.mode, CONCEAL_MODE.blend, `${bits}: the stronger concealment wins`);
  // the departure is the peer's alone: a foe's invisibility on the same lane is still not drawn
  const foe = { entity: { activeEffects: [{ kind: 'invisNormal', roundsRemaining: 5 }] } };
  assert.equal(foeDraw(foe, true, 1).kind, 'hidden', 'a foe\'s invisibility: not drawn (ECV1)');
  // the shimmer moves with the clock, and each peer on its own phase, the same every frame
  assert.notEqual(peerDraw(1, true, 1, 'p').visual.alpha, peerDraw(1, true, 1.3, 'p').visual.alpha, 'it shimmers');
  assert.equal(peerDraw(1, true, 1, 'p').visual.phase, peerDraw(1, true, 9, 'p').visual.phase, 'one phase per peer');
  assert.notEqual(peerPhase('alice-0001'), peerPhase('bob-0002'), 'two peers do not shimmer in step');
  assert.notEqual(peerDraw(1, true, 1, 'alice-0001').visual.phase, peerDraw(1, true, 1, 'bob-0002').visual.phase, 'and the look takes each its own');
  for (const id of ['', 'a', 'alice-0001', 'x'.repeat(64), null]) { const ph = peerPhase(id); assert.ok(ph >= 0 && ph < TWO_PI, `${id}: ${ph}`); }
});

test('INVIS-LOOK executed: the doll and the body - a concealed peer\'s doll carries the look to the blended phase and drops its name; an open one is plain and named; back in the open, plain again', async () => {
  const renderer = { uploadTexture() {}, releaseTexture() {}, createBillboardBatch: (a, r, size) => ({ size, origin: null }), destroyBillboardBatch() {} };
  const figure = () => { const rgba = new Uint8Array(PAPERDOLL_W * PAPERDOLL_H * 4); for (let y = 10; y < 170; y++) for (let x = 30; x < 80; x++) rgba[(y * PAPERDOLL_W + x) * 4 + 3] = 255; return { width: PAPERDOLL_W, height: PAPERDOLL_H, rgba }; };
  const rp = new RemotePlayers({ renderer, deps: {}, compose: async () => figure() });
  const mk = (id, x) => ({ id, name: id, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: { x, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0 } });
  const ghost = mk('ghost', 0), open = mk('open', 3), bodied = mk('bodied', -3);
  const V = peerDraw(1, true, 2, 'ghost').visual;
  let veils = new Map([['ghost', V], ['bodied', V]]);
  const conceal = (id) => veils.get(id) ?? null;
  const bodyHeight = (id) => (id === 'bodied' ? PEER_HEIGHT : 0);
  rp.sync([ghost, open, bodied], undefined, { bodyHeight, conceal }); await flush(); await flush();
  rp.sync([ghost, open, bodied], undefined, { bodyHeight, conceal });
  const batchOf = (id) => rp._batches.get(id)?.batch;
  assert.equal(batchOf('ghost').conceal, V, 'the concealed doll: the look, to the renderer\'s blended phase');
  assert.equal(batchOf('open').conceal, null, 'the open one: plain');
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)); const view = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
  assert.deepEqual(rp.namePoints(proj, view, 1600, 900, [0, 1.7, 0]).map((n) => n.name), ['open'], 'no name over a concealed peer - doll or body');
  veils = new Map();
  rp.sync([ghost, open, bodied], undefined, { bodyHeight, conceal });
  assert.equal(batchOf('ghost').conceal, null, 'the spell ended: plain');
  assert.deepEqual(rp.namePoints(proj, view, 1600, 900, [0, 1.7, 0]).map((n) => n.name).sort(), ['bodied', 'ghost', 'open'], 'and named');
  rp.sync([ghost], undefined);
  assert.equal(batchOf('ghost').conceal, null, 'a host that hands no look: plain, as ever');
  // the class sprite takes the same two lines as the doll (its path builds off the enemy art, so it is read by source)
  const src = rd('src/net/remotePlayers.js');
  assert.equal((src.match(/entry\.batch\.conceal = veil;/g) ?? []).length, 2, 'the doll and the class sprite');
  assert.equal((src.match(/if \(!veil\) this\._shown\.push\(\{ peer, height: (?:bodyH|entry\.doll\.h|entry\.height) \}\);/g) ?? []).length, 3, 'no name: the body, the doll and the class sprite');
  assert.match(src, /this\._syncMobilePeer\(peer, bundle, toScene, dt, eye, veil\); continue; \}/);
});

test('INVIS-LOOK executed: the walker and the rider - the chosen set and the saddle carry the look, a sprite made later keeps it, and a concealed walker\'s lantern is not drawn', async () => {
  const made = [];
  const renderer = { uploadTexture() {}, createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; }, destroyBillboardBatch() {} };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  const pose = (o = {}) => ({ x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
  const V = peerDraw(2, true, 1, 'w').visual;
  const w = createPeerWalkers({ art });
  const walker = { id: 'w', look: { eo: 3 }, shown: pose() };
  w.sync([walker], toScene, { eye: [4, 1, 20], dt: 0, conceal: () => V }); await settle();
  w.sync([walker], toScene, { eye: [4, 1, 20], dt: 0, conceal: () => V });
  assert.equal(w.isWalking('w'), true);
  assert.equal(w.batches()[0].conceal, V, 'the walker: the look');
  // a new sprite (another set chosen) is a new batch - it keeps the figure's look
  const before = w.batches()[0];
  const other = { ...walker, look: { eo: 4 } };
  w.sync([other], toScene, { eye: [4, 1, 20], dt: 0, conceal: () => V }); await settle();
  w.sync([other], toScene, { eye: [4, 1, 20], dt: 0, conceal: () => V });
  assert.notEqual(w.batches()[0], before, 'a new sprite');
  assert.equal(w.batches()[0].conceal, V, 'still concealed');
  w.sync([walker], toScene, { eye: [4, 1, 20], dt: 0 });
  assert.equal(w.batches()[0].conceal, null, 'the spell ended: plain');
  // the lantern: from straight behind (the walker faces +Z, the eye on -Z) it is drawn - on a concealed walker it is not
  const lit = createEotbArt({ renderer: { ...renderer, drawBillboards() {} }, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }), loadLantern: async () => ({ width: 10, height: 20, colors: new Uint8ClampedArray(800) }) });
  const lw = createPeerWalkers({ art: lit });
  const back = (conceal) => { lw.sync([{ id: 'w', look: { eo: 3 }, shown: pose({ hl: 1 }) }], toScene, { eye: [4, 1.5, 7], right: [-1, 0, 0], dt: 1 / 60, conceal }); return lw.drawLanterns(); };
  back(() => null); await settle(); back(() => null); await settle();
  assert.equal(back(() => null), 1, 'open: the lantern at the hip, seen from behind');
  assert.equal(back(() => V), 0, 'concealed: not drawn');
  assert.equal(back(() => null), 1, 'the spell ended: back');
  // the rider
  const riders = createPeerRiders({ art });
  const rider = { id: 'r', shown: pose({ rd: 1, mv: 1 }) };
  riders.sync([rider], toScene, { eye: [4, 1, 20], dt: 0, conceal: () => V }); await settle();
  riders.sync([rider], toScene, { eye: [4, 1, 20], dt: 0.05, conceal: () => V });
  assert.equal(riders.isRiding('r'), true);
  assert.equal(riders.batches()[0].conceal, V, 'the rider: the look');
  riders.sync([rider], toScene, { eye: [4, 1, 20], dt: 0.05 });
  assert.equal(riders.batches()[0].conceal, null, 'no look handed: plain');
});

/** A fake rig: built in third, drawn at once. */
function fakeRigs(log) {
  return () => {
    const r = { mode: 'first', stepped: 0, draws: [],
      attach() {}, async build() { return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1,
      setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.stepped > 0,
      update() { r.stepped++; }, drawThird(canvas, p) { r.draws.push(p); log.push(p); return true; }, unload() {},
    };
    return r;
  };
}

test('INVIS-LOOK executed: the Morrowind body - a concealed peer\'s body keeps standing (no second figure under it) but is out of the body pass; the late pass draws it with the look and the camera the body pass took; nothing before a body pass', async () => {
  const log = [];
  const pb = new PeerBodies({ renderer: {}, createRig: fakeRigs(log), buildOpts: () => ({}), now: () => 1000 });
  const peer = (id, x) => ({ id, look: { race: 'Nord' }, shown: { x, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0 } });
  const a = peer('ghost', 0), b = peer('open', 2);
  const V = peerDraw(4, true, 1, 'ghost').visual;
  const conceal = (id) => (id === 'ghost' ? V : null);
  assert.equal(pb.drawVeiled(), 0, 'no body pass yet: nothing');
  pb.sync([a, b], toScene, 0.016, [0, 0, -10], { conceal }); for (let i = 0; i < 6; i++) await flush();
  pb.sync([a, b], toScene, 0.016, [0, 0, -10], { conceal });
  assert.equal(pb.has('ghost'), true, 'the concealed body still stands - the walker and the doll stand nothing for it');
  const CAM = { proj: [1], view: [2], eye: [0, 1, 0] };
  log.length = 0;
  assert.equal(pb.draw('canvas', CAM), 1, 'the body pass: the open one alone');
  assert.equal(log[0].conceal, null, 'drawn plain');
  log.length = 0;
  assert.equal(pb.drawVeiled(), 1, 'the late pass: the concealed one');
  assert.equal(log[0].conceal, V, 'with the look');
  assert.deepEqual([log[0].proj, log[0].view, log[0].eye], [CAM.proj, CAM.view, CAM.eye], 'and the body pass\'s camera');
  pb.sync([a, b], toScene, 0.016, [0, 0, -10]);
  log.length = 0;
  assert.equal(pb.draw('canvas', CAM), 2, 'no look handed: both in the body pass');
  assert.equal(pb.drawVeiled(), 0);
  pb.destroy();
  assert.equal(pb.drawVeiled(), 0, 'destroyed: nothing');
});

/** A GL that records every call and hands back each uniform's NAME as its location. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { BLEND: 3042, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, CULL_FACE: 2884, DEPTH_TEST: 2929, ARRAY_BUFFER: 34962, TRIANGLE_FAN: 6, VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632 };
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
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('INVIS-LOOK executed: the body\'s quad - with a look it uploads the look and draws BLENDED with no depth write, restoring both after; without one it uploads plain and touches neither (the opaque cut-out it always was)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  const V = { mode: CONCEAL_MODE.blend, alpha: 0.25, t: 1.5, phase: 0.7 };
  calls.length = 0;
  r.drawCharacterSpriteQuad({ id: 'sprite' }, [1, 2, 3], 0.5, 1, [1, 0, 0], 0.5, 0.25, 0, V);   // after HITFLASH1's flash (the merge)
  const k = calls.map((c) => c[0]);
  const draw = k.indexOf('drawArrays');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform4f' && c[1] === 'uConceal').slice(2), [V.mode, V.alpha, V.t, V.phase], 'the look');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uSpan').slice(2), [0.5, 0.25], 'the picture\'s span of the RT');
  const at = (name, arg) => calls.findIndex((c) => c[0] === name && c[1] === arg);
  assert.ok(at('enable', 3042) >= 0 && at('enable', 3042) < draw, 'blended');
  assert.ok(calls.findIndex((c) => c[0] === 'depthMask' && c[1] === false) < draw, 'no depth write');
  assert.ok(calls.findIndex((c, i) => i > draw && c[0] === 'depthMask' && c[1] === true) > draw, 'the depth write back after');
  assert.ok(calls.findIndex((c, i) => i > draw && c[0] === 'disable' && c[1] === 3042) > draw, 'and the blend off');
  calls.length = 0;
  r.drawCharacterSpriteQuad({ id: 'sprite' }, [1, 2, 3], 0.5, 1, [1, 0, 0], 1, 1);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform4f' && c[1] === 'uConceal').slice(2), [0, 0, 0, 0], 'no look: plain');
  assert.equal(calls.filter((c) => (c[0] === 'enable' || c[0] === 'disable') && c[1] === 3042).length, 0, 'the blend untouched');
  assert.equal(calls.filter((c) => c[0] === 'depthMask').length, 0, 'the depth write untouched');
});

test('INVIS-LOOK executed: the quad\'s own fragment shader - plain it is the old cut-out (a texel under half is gone, the rest opaque); the blend takes the look\'s opacity, keeps a faint texel and ripples within the picture\'s own span; the shade darkens by ECV1\'s own factor', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r._ensureCharQuadProgram();
  const fs = calls.filter((c) => c[0] === 'shaderSource').map((c) => c[2]).find((s) => s.includes('uniform vec2 uSpan;'));
  assert.ok(fs, 'the quad\'s fragment shader');
  const run = ({ texel, uv = [0.25, 0.1], span = [0.5, 0.5], conceal = [0, 0, 0, 0] }) => {
    const seen = [];
    const f = glslFunctions(fs, {
      vUV: uv, vWorld: [0, 0, 0], uFogColor: [0, 0, 0], uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0],
      uDwFog: Array.from({ length: 5 }, () => [0, 0, 0, 0]), uConceal: conceal, uSpan: span, outColor: [0, 0, 0, 0],
      texture: (_s, at) => { seen.push(at); return texel; },
    });
    try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return { discarded: true, seen }; throw e; }
    return { out: f.globals.outColor, seen };
  };
  const close = (a, b, m) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${m}: ${a} vs ${b}`));
  // plain: the old law, byte for byte
  close(run({ texel: [0.5, 0.4, 0.3, 1] }).out, [0.5, 0.4, 0.3, 1], 'plain, opaque');
  assert.equal(run({ texel: [0.5, 0.4, 0.3, 0.3] }).discarded, true, 'plain: the 0.5 cut');
  assert.deepEqual(run({ texel: [0.5, 0.4, 0.3, 1] }).seen[0], [0.25, 0.1], 'plain: sampled where it stands');
  // the blend: the opacity, the faint texel kept, the ripple
  const B = [CONCEAL_MODE.blend, 0.25, 1.5, 0.7];
  const blend = run({ texel: [0.5, 0.4, 0.3, 1], conceal: B });
  close(blend.out, [0.5, 0.4, 0.3, 0.25], 'blend: the colour, at the look\'s opacity');
  close(run({ texel: [0.5, 0.4, 0.3, 0.3], conceal: B }).out, [0.5, 0.4, 0.3, 0.3 * 0.25], 'a faint texel kept (the 0.1 cut), at its own share');
  assert.equal(run({ texel: [0.5, 0.4, 0.3, 0.05], conceal: B }).discarded, true, 'nothing under 0.1');
  const want = 0.25 + Math.sin((0.1 / 0.5) * 28 + 1.5 * 7 + 0.7) * 0.008 * 0.5;
  assert.ok(Math.abs(blend.seen[0][0] - want) < 1e-9 && blend.seen[0][1] === 0.1, `the ripple, measured in the picture's span: ${blend.seen[0]} vs ${want}`);
  const rip = Math.sin((0.35 / 0.5) * 28) * 0.008 * 0.5;
  assert.ok(rip > 0.002, `the ripple at that row pushes right (${rip})`);
  assert.equal(run({ texel: [1, 1, 1, 1], uv: [0.4999, 0.35], conceal: [CONCEAL_MODE.blend, 0.25, 0, 0] }).discarded, true, 'a ripple past the picture\'s edge is discarded - the RT beyond the span is not this picture');
  assert.equal(run({ texel: [1, 1, 1, 1], uv: [0.25, 0.35], conceal: [CONCEAL_MODE.blend, 0.25, 0, 0] }).discarded, undefined, 'inside it, drawn');
  // the shade
  close(run({ texel: [0.5, 0.4, 0.3, 1], conceal: [CONCEAL_MODE.shade, SHADE_ALPHA, 0, 0] }).out, [0.5 * SHADE_DARK, 0.4 * SHADE_DARK, 0.3 * SHADE_DARK, SHADE_ALPHA], 'the shade: dark, at its opacity');
});

test('INVIS-LOOK by source: the host - the look read once a frame and handed to every figure; the concealed on the classic lane stand nowhere; the concealed bodies drawn after each mode\'s opaque world, before the first screen quad', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const veilOn = combatVisualsOn\(\);[^\n]*\n\s*const seen = \[\];\n\s*for \(const d of drawable\) \{\n\s*const look = peerDraw\(d\.shown\?\.cv \| 0, veilOn, _veilT, d\.id\);\n\s*if \(look\.kind === 'hidden'\) \{ _hiddenPeers\.add\(d\.id\); continue; \}[^\n]*\n\s*if \(look\.kind === 'conceal'\) _veils\.set\(d\.id, look\.visual\);\n\s*seen\.push\(d\);\n\s*\}/, 'once a frame, off the shown pose');
  assert.match(w, /_veilT \+= dt > 0 \? dt : 0;\n\s*_veils\.clear\(\);/, 'the clock, and last frame\'s looks gone');
  for (const re of [/peerRiders\.sync\(seen, [^\n]*conceal: veilOf \}\);/, /peerBodies\.sync\(afoot, [^\n]*conceal: veilOf \}\);/, /peerWalkers\.sync\(seen, [^\n]*conceal: veilOf \}\);/, /remotePlayers\.sync\(drawable, [^\n]*conceal: veilOf, hidden: \(id\) => _hiddenPeers\.has\(id\) \}\);/]) assert.match(w, re);
  assert.match(w, /const drawVeiledPeerBodies = \(\) => \{ peerBodies\?\.drawVeiled\(\); \};/);
  assert.match(w, /drawVeiledPeerBodies: \(\) => drawVeiledPeerBodies\(\),/, 'the mode machine gets it');
  const grass = w.indexOf("renderer.markForeignPass();   // EV6: the grass changed programs behind the shadows' back");
  const late = w.indexOf('    drawVeiledPeerBodies();   // INVIS-LOOK');
  const wall = w.indexOf('duelWall.draw(rings, proj, view,');
  const flats = w.indexOf('if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, UP_Y);');
  assert.ok(flats > 0 && grass > flats && late > grass && wall > late, 'the exterior: after the flats and the grass, before the foreign passes that follow');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /lateWorldDraw: \(\) => host\.drawVeiledPeerBodies\?\.\(\),/, 'the dungeon: through its context');
  assert.match(m, /for \(const d of interiorCtx\.charDraws\) renderer\.drawCharacter\(d\.mesh, d\.matrix\);\n\s*host\.drawVeiledPeerBodies\?\.\(\);/, 'the building: after its last opaque draw');
  const d = rd('src/scenes/dungeonContext.js');
  const foes = d.indexOf('renderer.drawBillboards([..._mobileBatches, ..._dropBatches, ..._spellBatches],');
  const hook = d.indexOf('opts.lateWorldDraw?.();');
  const water = d.indexOf('renderer.drawWater(waterQuads, DUNGEON_WATER_COLOR,');
  const weapon = d.indexOf('if (playerFeet) weaponRig.draw({ paralyzed: _pParalyzed });');
  assert.ok(foes > 0 && hook > foes && water > hook && weapon > water, 'the dungeon: after the foes\' flats, before the water and the weapon\'s screen quads (WATER-D1)');
  assert.match(rd('src/combat/fpArm.js'), /drawRigSpriteBox\(renderer, canvas, thirdMesh, model, \{ center, halfW, halfH, anchor, hitFlash, conceal \}, proj, view, eye, MW_ARM_PIXEL\);/);
  assert.match(rd('src/render/characterSprite.js'), /renderer\.drawCharacterSpriteQuad\(sTex, at, halfW, halfH, right, pw \/ CHAR_SPRITE_RT_SIZE, ph \/ CHAR_SPRITE_RT_SIZE, hitFlash, conceal\);/);
});
