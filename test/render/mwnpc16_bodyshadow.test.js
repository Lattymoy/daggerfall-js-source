// MWNPC16 (2026-10-11, a player's screenshot via Mac: "With morrowind assets attached. Old sprite shadows still show" -
// bible/04-Characters/Morrowind-NPCs.md section 24): A MORROWIND BODY CASTS ITS OWN SHAPE. MWNPC1 turned a GPU-skinned
// body away at the shadow pass's door and MWNPC5b kept each NPC's classic billboard in the pass to cast for it
// (`castOnly`) - so a man in Morrowind's steel threw a Daggerfall sprite's silhouette on the wall. The body now replays
// through the world's own skinned vertex shader off its palette, a run of its ranges in one depth draw, and the flat
// under it casts nothing; the lane asks it of an NPC's body alone, in the view and out of it (SHADOW-REACH's law).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ShadowPass, DEPTH_FS, DEPTH_BB_FS, SHADOW_TUNING } from '../../src/render/shadowPass.js';
import { Renderer } from '../../src/render/renderer.js';
import { SKIN_PALETTE_UNIT } from '../../src/render/skinPalette.js';
import { ortho, perspective, lookAt, multiply } from '../../src/world/mat4.js';
import { PeerBodies } from '../../src/net/peer/peerBodies.js';
import { createNpcBodies, createPopulationLane } from '../../src/characters/npcBodies.js';
import { createFpArm } from '../../src/combat/fpArm.js';
import { fixtureBodyDeps, countingRenderer } from '../fixtures/mw/bodyRig.mjs';
import { setBatchDissolve, dissolveShadowless, DISSOLVE_SHADOWLESS } from '../../src/systems/dissolve.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };

/** A GL that records every call, and a pass whose programs say which shaders built them. */
function pass({ throwOn = null } = {}) {
  const calls = [];
  const gl = new Proxy({}, { get: (_, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, nm) => `${p.name}.${nm}`;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: Math.random() });
    if (k === 'getParameter') return () => new Float32Array(4);
    if (typeof k === 'string' && k.toUpperCase() === k) return k === 'TEXTURE0' ? 33984 : 1;
    return (...a) => { calls.push([k, ...a]); };
  } });
  const names = { mesh: 'MESH', bb: 'BB', terrain: 'TERRAIN', char: 'CHAR', charSkin: 'SKIN' };
  const built = [];
  const build = (vs, fs) => {
    if (vs === throwOn) throw new Error('link failed');   // AUDIT MWNPC16-18 N2: buildProgram throws on a failed link
    const name = `${vs}/${fs === DEPTH_FS ? 'depth' : fs === DEPTH_BB_FS ? 'cut' : 'other'}`;
    built.push(name);
    return { name };
  };
  const sp = new ShadowPass(gl, { build, vs: names });
  const held = [];
  const f = { bindVao: (v) => calls.push(['bindVao', v]), textures: new Map(), isSpectral: () => false, holdSkin: (t) => held.push(t) };
  return { sp, gl, calls, f, held, built };
}
const VP = multiply(ortho(50, 50, -100, 100), lookAt([0, 50, 0], [0, 0, 0], [0, 0, -1]));   // a sun looking straight down on a 100 m square
/** AUDIT MWNPC16-18 E2: a frame render() takes - a lamp 8 m about [0, 2, 0], night (no sun); `everyLight` a room drawn whole */
const lampFrame = (f, lights = new Float32Array([0, 2, 0, 8]), everyLight = false) => ({ ...f, eye: [0, 1.6, 4], lightDir: [0, -1, 0], sunScale: 0, pointLights: lights, carried: null, cascadeScale: 1, everyLight, cut: false });
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const draws = (calls) => calls.filter((c) => c[0] === 'drawArrays').map((c) => [c[2], c[3]]);
const usedProgram = (calls) => calls.filter((c) => c[0] === 'useProgram').map((c) => c[1].name);

/** A body's mesh as createSkinnedCharacterMesh makes it, ranges laid end to end as packSkinStream lays them. */
function skinnedBody(ranges, { pairs = 2, tex = { palette: 1 } } = {}) {
  return { vao: { body: 1 }, count: 150, skin: { tex, pairs, width: 3, height: 1 }, ranges };
}
const five = () => [
  { first: 0, count: 30 },
  { first: 30, count: 30, hidden: true },                          // a sheathed blade
  { first: 60, count: 30 },
  { first: 90, count: 30, alphaCut: 0.5, tex: { hair: 1 } },       // hair, a cut-out picture
  { first: 120, count: 30 },
];

test('MWNPC16a the shadow pass replays a skinned body through the skinned depth program off its own palette - a run of ranges one draw, a hidden range a break, a cut-out range its own draw through its picture\'s cut; the programs built in the pass\'s own time (render), the first frame a body casts, never at its record (AUDIT MWNPC16-18 E2: driven through render(), not by hand. Mutants: the skin turned away; the runs drawn one by one; the cut range in the run; render never builds them; a body never asks)', () => {
  const { sp, calls, f, held } = pass();
  assert.equal(sp.programs.body, undefined, 'nothing built before a body casts');
  const mesh = skinnedBody(five());
  sp.recordCharacter(mesh, IDENTITY, [0, 1, 0, 1.2], true);
  assert.equal(sp.count, 1, 'a skinned body is recorded - the door no longer turns it away');
  assert.equal(sp.records[0].bounded, true);
  assert.deepEqual([...sp.records[0].sphere], [0, 1, 0, Math.fround(1.2)], 'under the sphere it was handed (its posed box)');
  assert.equal(sp.records[0].dynamic, true, 'a body is never still');
  assert.equal(sp.programs.body, undefined, 'not at the record - inside the world pass, behind the renderer\'s back');
  sp.render(lampFrame(f));   // the pass's own GL time: built before its first replay
  held.length = 0;   // (the lamp's own faces drew it)
  assert.equal(sp.programs.body.p.name, 'SKIN/depth', 'the world\'s skinned VS over the plain depth');
  assert.equal(sp.programs.bodyCut.p.name, 'SKIN/cut', 'and over the flats\' half-alpha cut');
  assert.equal(sp.programs.charCut.p.name, 'CHAR/cut');
  const samplers = calls.filter((c) => c[0] === 'uniform1i').map((c) => [c[1], c[2]]);
  assert.ok(samplers.some(([l, v]) => l === 'SKIN/depth.uSkinPalette' && v === SKIN_PALETTE_UNIT), 'the palette read on the lit draw\'s unit');
  assert.ok(samplers.some(([l, v]) => l === 'SKIN/cut.uTex' && v === 0), 'the cut\'s picture on 0');
  assert.ok(samplers.some(([l, v]) => l === 'SKIN/cut.uSkinPalette' && v === SKIN_PALETTE_UNIT), 'the cut\'s palette on the palette\'s unit (AUDIT MWNPC16-18 R2: unset, it skins off unit 0 - the hair\'s own picture)');
  calls.length = 0;
  const n = sp.replay(f, VP, null);
  assert.deepEqual(draws(calls), [[0, 30], [60, 30], [90, 30], [120, 30]], 'the first piece, the run after the blade, the hair alone, the last');
  assert.equal(n, 4);
  assert.deepEqual(usedProgram(calls), ['SKIN/depth', 'SKIN/cut', 'SKIN/depth'], 'the hair through the cut, the body back for the rest');
  assert.deepEqual(held, [mesh.skin.tex], 'its palette, through the renderer\'s door');
  assert.ok(calls.some((c) => c[0] === 'uniform1f' && c[1] === 'SKIN/depth.uSkin' && c[2] === 2), 'uSkin its pairs');
  assert.ok(calls.some((c) => c[0] === 'uniform1f' && c[1] === 'SKIN/cut.uSkin' && c[2] === 2), 'the cut skinned as well');
  assert.ok(calls.some((c) => c[0] === 'bindTexture' && c[2]?.hair === 1), 'the hair\'s own picture for its cut');
  // AUDIT MWNPC16-18 R2: BUILT ONCE - a second frame compiles nothing (three programs a frame, never freed, where the guard
  // fell); and the cut program is every body's, so each body's hair is drawn under ITS matrix, never the last body's
  const twice = pass();
  const at = (x) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1]);
  const hairy = () => skinnedBody([{ first: 0, count: 30 }, { first: 30, count: 30, alphaCut: 0.5, tex: { hair: 1 } }]);
  for (let i = 0; i < 2; i++) {
    twice.sp.discard();   // a frame: its records let go, as the renderer does
    twice.sp.recordCharacter(hairy(), at(1), [1, 1, 0, 1.2], true);
    twice.sp.recordCharacter(hairy(), at(-1), [-1, 1, 0, 1.2], true);
    twice.sp.render(lampFrame(twice.f));
  }
  assert.equal(twice.built.filter((nm) => nm.startsWith('SKIN/')).length, 2, 'the body programs built once across two frames');
  twice.calls.length = 0;
  twice.sp.replay(twice.f, VP, null);
  const hairUnder = [];
  let cutModel = null;
  for (const c of twice.calls) {
    if (c[0] === 'uniformMatrix4fv' && c[1] === 'SKIN/cut.uModel') cutModel = c[3][12];
    if (c[0] === 'drawArrays' && c[2] === 30 && c[3] === 30) hairUnder.push(cutModel);
  }
  assert.deepEqual(hairUnder.slice(0, 2).sort(), [-1, 1], 'each body\'s hair under its own matrix');
  // nothing hidden and nothing cut: the whole body in one draw
  const one = pass();
  one.sp.recordCharacter(skinnedBody([{ first: 0, count: 50 }, { first: 50, count: 40 }, { first: 90, count: 60 }]), IDENTITY, [0, 1, 0, 1.2], true);
  one.sp.render(lampFrame(one.f));
  one.calls.length = 0;
  one.sp.replay(one.f, VP, null);
  assert.deepEqual(draws(one.calls), [[0, 150]], 'three pieces end to end: one depth draw');
});

test('MWNPC16b a body let go casts nothing - its palette deleted or its mesh dead since the record; a body out of the replay\'s frustum is culled by its sphere; an unskinned rig keeps CHAR_VS - and a CPU-skinned body\'s cut-out hair casts through its picture\'s cut, never as a solid card (AUDIT MWNPC16-18 A1 / B F3: the cut program was built only for a skinned body. Mutants: the palette test gone; the sphere ignored; a cut range never asks)', () => {
  const { sp, calls, f } = pass();
  sp.recordCharacter(skinnedBody(five(), { tex: null }), IDENTITY, [0, 1, 0, 1.2]);
  const dead = skinnedBody(five()); dead._dead = true;
  sp.recordCharacter(dead, IDENTITY, [0, 1, 0, 1.2]);
  sp.recordCharacter(skinnedBody(five()), IDENTITY, [500, 1, 0, 1.2]);   // 450 m off the square
  sp._ensureBodyPrograms();
  calls.length = 0;
  assert.equal(sp.replay(f, VP, null), 0, 'none of the three draws');
  assert.equal(sp.stats.culled, 1, 'the far one by its sphere');
  const rig = pass();
  rig.sp.recordCharacter({ vao: { rig: 1 }, count: 36, bounds: null }, IDENTITY, [0, 1, 0, 1]);
  rig.calls.length = 0;
  rig.sp.replay(rig.f, VP, null);
  assert.deepEqual(usedProgram(rig.calls), ['CHAR/depth'], 'a packed rig (the CPU skin\'s) through CHAR_VS, as EL7 cast it');
  assert.deepEqual(draws(rig.calls), [[0, 36]]);
  assert.deepEqual(rig.held, [], 'no palette asked for');
  assert.equal(rig.sp.programs.body, undefined, 'and no skinned program built for it');
  // ?gpuskin=off, or a layout the shader refused: the packed body, its hair a cut-out range
  const cpu = pass();
  cpu.sp.recordCharacter({ vao: { packed: 1 }, count: 90, ranges: [{ first: 0, count: 30 }, { first: 30, count: 30, alphaCut: 0.5, tex: { hair: 1 } }, { first: 60, count: 30 }] }, IDENTITY, [0, 1, 0, 1.2], true);
  cpu.sp.render(lampFrame(cpu.f));
  assert.equal(cpu.sp.programs.charCut?.p.name, 'CHAR/cut', 'the plain rig\'s cut, built for its hair');
  cpu.calls.length = 0;
  cpu.sp.replay(cpu.f, VP, null);
  assert.deepEqual(draws(cpu.calls), [[0, 30], [30, 30], [60, 30]], 'the hair its own draw');
  assert.deepEqual(usedProgram(cpu.calls), ['CHAR/depth', 'CHAR/cut', 'CHAR/depth'], 'through its picture\'s cut');
  // AUDIT MWNPC16-18 N2: a body program that will not link never escapes render() - the frame goes on, the body casts nothing
  const bad = pass({ throwOn: 'SKIN' });
  bad.sp.recordCharacter(skinnedBody(five()), IDENTITY, [0, 1, 0, 1.2], true);
  const warn = console.warn; console.warn = () => {};
  try { bad.sp.render(lampFrame(bad.f)); } finally { console.warn = warn; }
  assert.equal(bad.sp.programs.body, null, 'none made');
  assert.equal(bad.sp.programs.charCut?.p.name, 'CHAR/cut', 'the others built as ever');
  bad.calls.length = 0;
  assert.equal(bad.sp.replay(bad.f, VP, null), 0, 'and the body casts nothing');
});

test('MWNPC16c a cast-only flat casts nothing - not drawn into a map, never a mover that redraws a lantern, never in a cache\'s signature - while its neighbour casts as ever (mutants: castOnly dropped from the replay; from the movers)', () => {
  const { sp, calls, f } = pass();
  const tex = { pic: 1 };
  const flat = (castOnly) => ({ vao: { flat: 1 }, archive: 182, record: 1, size: { w: 1, h: 1.8 }, origin: [0, 0, 0], bounds: null, indexCount: 6, castOnly, _dyn: true });   // a walker: built dynamic
  const body = flat(true), plain = flat(false);
  sp.recordBillboards([body, plain], new Float32Array(4), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  assert.equal(sp.records[0].dynamic, true);
  const keyed = f.textures;
  f.textures = { get: () => tex };   // whatever the key, the picture is in hand
  calls.length = 0;
  sp.replay(f, VP, null);
  assert.equal(calls.filter((c) => c[0] === 'drawElements').length, 1, 'the plain flat alone');
  f.textures = keyed;
  assert.equal(sp._dynamicNear([0, 1, 0], 20, () => false), 2, 'the plain flat moves by the lantern');
  plain.castOnly = true;
  assert.equal(sp._dynamicNear([0, 1, 0], 20, () => false), 0, 'a cast-only one is no reason to redraw it');
  const src = rd('src/render/shadowPass.js');
  assert.equal((src.match(/b\.noShadow \|\| b\.castOnly/g) || []).length, 4, 'every door a noShadow flat is turned away at - the replay, the movers and both signatures');
});

test('MWNPC16d the rig: drawThird records its body for the maps where it is asked - its mesh, its model, a sphere about its posed box - and never a veiled body\'s; castThird records the body out of the view at the same place, where its sphere reaches a map (mutants: the cast unasked; the veil cast; castThird past the reach)', async () => {
  const cast = [];
  let reach = true;
  const r = countingRenderer();
  const quads = [];
  const renderer = { ...r, drawCharacterSpriteQuad: (_t, at, halfW, halfH) => quads.push({ at: [...at], halfW, halfH }), recordShadowBody: (mesh, model, sphere, anchored) => cast.push({ mesh, model: [...model], sphere: [...sphere], anchored }), shadowReachSphere: () => reach };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
  assert.equal((await arm.build({ race: 'fprace', deps: fixtureBodyDeps() })).ok, true);
  arm.setViewMode('third');
  arm.update(1 / 60, { pose: true });
  const proj = perspective(1, 1, 0.1, 100), view = lookAt([0, 1.6, 4], [0, 1, 0], [0, 1, 0]);
  const at = { proj, view, eye: [0, 1.6, 4], feet: [2, 0, -1], yaw: 0.7 };
  assert.equal(arm.drawThird({}, at), true);
  assert.equal(cast.length, 0, 'not asked: nothing recorded (the player\'s own, a peer\'s)');
  assert.equal(arm.drawThird({}, { ...at, cast: true }), true);
  assert.equal(cast.length, 1, 'asked: its body');
  const [c] = cast;
  assert.ok(c.mesh && c.mesh.vao, 'the third body\'s own mesh');
  assert.ok(Math.abs(c.model[12] - 2) < 1e-6 && Math.abs(c.model[13]) < 1e-6 && Math.abs(c.model[14] + 1) < 1e-6, 'its model stands it on its feet');
  const q = quads.at(-1);   // the picture it was drawn as (the fixture's body is a few centimetres tall)
  assert.ok(Math.hypot(q.at[0] - c.sphere[0], q.at[1] - c.sphere[1], q.at[2] - c.sphere[2]) < c.sphere[3], 'the picture\'s middle inside the sphere');
  assert.ok(c.sphere[3] >= q.halfH * 0.9 && c.sphere[3] < 4 * Math.hypot(q.halfW, q.halfH), `a sphere of the body's own size (${c.sphere[3]} against ${q.halfW} x ${q.halfH})`);
  assert.ok(Math.hypot(c.sphere[0] - 2, c.sphere[2] + 1) < 2 * c.sphere[3] && c.sphere[1] > 0, 'about its feet, above the ground');
  assert.equal(arm.drawThird({}, { ...at, cast: true, conceal: { mode: 1, alpha: 0.3, t: 0, phase: 0 } }), true);
  assert.equal(cast.length, 1, 'a veiled body casts nothing');
  assert.equal(arm.castThird({ feet: [2, 0, -1], yaw: 0.7 }), true);
  assert.equal(cast.length, 2);
  assert.deepEqual(cast[1].model, c.model, 'out of the view: the same place, the same model');
  assert.deepEqual(cast[1].sphere, c.sphere, 'and the same sphere');
  assert.equal(cast[1].anchored, false);
  assert.equal(arm.castThird({ feet: [2, 0, -1], yaw: 0.7, anchored: true }), true);
  assert.equal(cast[2].anchored, true, 'one that never walks says so (the lo tier\'s lamps take it)');
  assert.equal(arm.drawThird({}, { ...at, cast: true, anchored: true }), true);
  assert.equal(cast[3].anchored, true, 'drawn as well');
  cast.length = 2;
  reach = false;
  assert.equal(arm.castThird({ feet: [2, 0, -1], yaw: 0.7 }), false, 'past every map\'s reach: not recorded');
  assert.equal(cast.length, 2);
  // AUDIT MWNPC16-18 N3: asked first about its feet, in a sphere that holds its box's wherever it turns - the exact one
  // only for a body that may reach
  const asked = [];
  renderer.shadowReachSphere = (x, y, z, rad) => { asked.push([x, y, z, rad]); return false; };
  assert.equal(arm.castThird({ feet: [2, 0, -1], yaw: 0.7 }), false);
  assert.equal(asked.length, 1, 'one question, about its feet');
  assert.deepEqual(asked[0].slice(0, 3), [2, 0, -1]);
  assert.ok(asked[0][3] >= Math.hypot(c.sphere[0] - 2, c.sphere[1], c.sphere[2] + 1) + c.sphere[3] - 1e-6, 'and wide enough to hold the box\'s own sphere');
  asked.length = 0;
  renderer.shadowReachSphere = (x, y, z, rad) => { asked.push([x, y, z, rad]); return y === 0; };   // the feet's sphere reaches, the box's does not
  assert.equal(arm.castThird({ feet: [2, 0, -1], yaw: 0.7 }), false, 'the box\'s own sphere asked last, and it decides');
  assert.equal(asked.length, 2);
  assert.equal(cast.length, 2);
  renderer.shadowReachSphere = () => reach;
  // AUDIT MWNPC16-18 R2: A LARGER BODY CASTS AT ITS SIZE - the gate's boss stands larger (MWNPC10's scale), and out of
  // the view his shadow is still his body's, at the grow he is drawn at
  reach = true;
  cast.length = 0;
  assert.equal(arm.castThird({ feet: [2, 0, -1], yaw: 0.7, grow: 2 }), true);
  const big = cast[0], scaleOfModel = (m) => Math.hypot(m[0], m[1], m[2]);
  assert.ok(Math.abs(scaleOfModel(big.model) / scaleOfModel(c.model) - 2) < 1e-6, 'its model twice the size');
  assert.ok(Math.abs(big.sphere[3] / c.sphere[3] - 2) < 1e-6, 'and its sphere');
  arm.setViewMode('first');
  assert.equal(arm.castThird({ feet: [2, 0, -1], yaw: 0.7 }), false, 'no third body standing: nothing');
});

/** a rig that records how it was drawn and cast */
const recording = (rigs) => () => {
  const r = { mode: 'first', draws: [], anchors: [], casts: [], skinned: false,
    attach() {}, async build() { await flush(); return { ok: true }; },
    canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
    thirdActive: () => r.mode === 'third' && r.skinned,
    update(dt, opts) { if (opts?.pose !== false) r.skinned = true; },
    drawThird(_c, o) { r.draws.push(o.cast); r.anchors.push(o.anchored); return r.thirdActive(); },
    castThird(o) { r.casts.push(o); return true; },
    unload() {}, setSheathed() {}, revive() {},
  };
  rigs.push(r);
  return r;
};
const toScene = (p) => [p.x, p.y, p.z];
const peer = (id, z) => ({ id, name: '', told: true, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, cn: 0 } });
const PROJ = perspective(1.2, 1.5, 0.1, 200), VIEW = lookAt([0, 1.6, 0], [0, 1.6, -1], [0, 1, 0]);   // looking down -z

test('MWNPC16e PeerBodies asks the cast of a lane that casts: a seen body drawn casting, an unseen one cast where it stands, a veiled one neither, a body the travel view grows neither; the peers\' lane none at all; every NPC lane casts (mutants: casts on for the peers; the unseen not cast; the grow ignored)', async () => {
  const run = async (casts, grow = null) => {
    const rigs = [];
    const pb = new PeerBodies({ renderer: {}, createRig: recording(rigs), buildOpts: () => ({}), now: () => 1000, casts });
    for (let i = 0; i < 4; i++) { pb.sync([peer('front', -5), peer('back', 5)], toScene, 1 / 60, [0, 0, 0]); await settle(); pb.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0], grow }); }
    return rigs;
  };
  const [front, back] = await run(true);
  assert.ok(front.draws.length > 0 && front.draws.every((c) => c === true), 'seen: drawn casting');
  assert.equal(front.casts.length, 0, 'and not cast a second time');
  assert.equal(back.draws.length, 0, 'behind the eye: not drawn');
  assert.ok(back.casts.length > 0, 'but cast where it stands');
  assert.deepEqual(back.casts.at(-1), { feet: [0, 0, 5], yaw: 0, grow: 1, anchored: false });
  const peers = await run(false);
  assert.ok(peers[0].draws.every((c) => c === false), 'a peer\'s body: no cast asked');
  assert.equal(peers[1].casts.length, 0, 'nor out of the view');
  // AUDIT MWNPC16-18 R2: a body larger by its own scale (MWNPC10's boss) casts, seen and unseen, at that size - only the
  // travel view's grow takes the cast away
  const scaledRun = async () => {
    const rigs = [];
    const pb = new PeerBodies({ renderer: {}, createRig: recording(rigs), buildOpts: () => ({}), now: () => 1000, casts: true });
    for (let i = 0; i < 4; i++) { pb.sync([peer('front', -5), peer('back', 5)], toScene, 1 / 60, [0, 0, 0]); await settle(); pb.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0], scaleOf: () => 1.5 }); }
    return rigs;
  };
  const [bossFront, bossBack] = await scaledRun();
  assert.ok(bossFront.draws.length > 0 && bossFront.draws.every((c) => c === true), 'the boss, seen: drawn casting');
  assert.ok(bossBack.casts.length > 0 && bossBack.casts.at(-1).grow === 1.5, 'unseen: cast at his own size');
  const grown = await run(true, () => 6);
  assert.ok(grown[0].draws.length > 0 && grown[0].draws.every((c) => c === false), 'the travel view\'s grown body casts no giant\'s shadow');
  assert.equal(grown[1].casts.length, 0);
  // the veiled: drawn in the late pass, never cast
  const rigs = [];
  const pb = new PeerBodies({ renderer: {}, createRig: recording(rigs), buildOpts: () => ({}), now: () => 1000, casts: true });
  const veil = { mode: 1, alpha: 0.3, t: 0, phase: 0 };
  for (let i = 0; i < 4; i++) { pb.sync([peer('ghost', -5), peer('shade', 5)], toScene, 1 / 60, [0, 0, 0], { conceal: () => veil }); await settle(); pb.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0] }); pb.drawVeiled(); }
  assert.ok(rigs[0].draws.length > 0 && rigs[0].draws.every((c) => c === false), 'a veiled body is drawn, casting nothing');
  assert.equal(rigs[1].casts.length, 0, 'nor out of the view');
  // every NPC lane is a casting one
  const laneRigs = [];
  const lane = createNpcBodies({ renderer: {}, createRig: recording(laneRigs), now: () => 1000 });
  for (let i = 0; i < 4; i++) {
    lane.begin(); lane.stand('folk', { id: 1, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, feet: [0, 0, -4] });
    lane.end(1 / 60, [0, 0, 0]); await settle(); lane.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0] });
  }
  assert.ok(laneRigs[0].draws.length > 0 && laneRigs[0].draws.every((c) => c === true), 'an NPC\'s body casts its own shadow');
  lane.destroy();
});

test('MWNPC16f the wiring: the renderer hands the pass the skinned VS and its palette door, records a body for the maps alone (a body\'s record, and whether it never walks), and its door binds the palette on its unit even when the selector\'s word says the unit is selected - the pass selects units raw - keeping the unit\'s word; the rig marks a released mesh dead (AUDIT MWNPC16-18 E7: the door and the release driven, not read. Mutants: the selector not forgotten; the unit\'s word not kept; the release not marked)', async () => {
  const r = rd('src/render/renderer.js');
  assert.match(r, /recordShadowBody\(mesh, modelMatrix, sphere, anchored = false\) \{ if \(this\._casting && mesh\?\.vao\) this\._shadows\.recordCharacter\(mesh, modelMatrix, sphere, true, anchored\); \}/);
  assert.match(r, /holdSkin: this\._holdSkinFn,/, 'the palette door in the frame the pass is handed');
  assert.match(r, /shadowReachSphere\(x, y, z, r\) \{ return this\._casting && this\._shadows\.reachesSphere\(x, y, z, r\); \}/);
  // the door, on a real renderer over a recording GL
  const glCalls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, TEXTURE_2D: 3553 };
  const gl = new Proxy({}, { get(_, k) {
    if (k in consts) return consts[k];
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k === 'getAttribLocation') return () => 0;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
    if (k === 'getParameter') return () => new Float32Array(4);
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return (...a) => { glCalls.push([k, ...a]); };
  } });
  const ren = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const palette = { id: 'palette' };
  ren._activeTexture(1000 + SKIN_PALETTE_UNIT);   // the renderer's own word: the palette unit is selected...
  ren._skinUnitHolds = null;
  glCalls.length = 0;   // ...and the pass then selected unit 0 raw, behind it (gl.activeTexture(gl.TEXTURE0))
  ren._holdSkin(palette);
  const seq = glCalls.filter((c) => c[0] === 'activeTexture' || c[0] === 'bindTexture');
  assert.deepEqual(seq, [['activeTexture', 1000 + SKIN_PALETTE_UNIT], ['bindTexture', 3553, palette], ['activeTexture', 1000]], 'the unit selected again, whatever the word said, its palette bound, unit 0 back');
  assert.equal(ren._skinUnitHolds, palette, 'the unit\'s word kept');
  glCalls.length = 0;
  ren._holdSkin(palette);
  assert.deepEqual(glCalls.filter((c) => c[0] === 'bindTexture'), [], 'held already: nothing bound twice');
  // the release, on the fixture body
  const cast = [];
  const counting = countingRenderer();
  const renderer = { ...counting, gl: { deleteVertexArray() {}, deleteBuffer() {}, deleteTexture() {} }, releaseCharacterTexture() {}, releaseParticleEffect() {}, recordShadowBody: (mesh) => cast.push(mesh), shadowReachSphere: () => true };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
  assert.equal((await arm.build({ race: 'fprace', deps: fixtureBodyDeps() })).ok, true);
  arm.setViewMode('third');
  arm.update(1 / 60, { pose: true });
  assert.equal(arm.castThird({ feet: [0, 0, 0], yaw: 0 }), true);
  const mesh = cast[0];
  assert.ok(mesh && !mesh._dead, 'standing: alive');
  arm.unload();
  assert.equal(mesh._dead, true, 'let go: a record made before it went casts nothing');
  assert.match(rd('src/characters/npcBodies.js'), /gate: BODY_BUILD_GATE, casts: true,/);
});

test('MWNPC16g A LAMP WHOSE ONLY MOVERS ARE BODIES THAT DID NOT CHANGE KEEPS THE FACES IT DREW - a body out of the view is never posed, and it held its lamps\' six dynamic faces redrawn every frame to draw it as it was; posed, turned, a range hidden, gone, or with a mover beside it, the lamp draws again (AUDIT MWNPC16-18 A2: a still body cost 10 face operations a frame where its flat cost none. Mutants: the look blind to the pose; to the matrix; to a hidden range; held through a mover; the generation never bumped)', () => {
  SHADOW_TUNING.override = true;   // Steady shadows, the default: every lamp with a mover redraws every frame
  try {
    const run = (frames, rec) => {
      const { sp, f } = pass();
      const wall = { vao: { w: 1 }, subMeshes: [{ startIndex: 0, primitiveCount: 2 }], bounds: null };
      const per = [];
      for (let i = 0; i < frames; i++) { sp.recordMesh(wall, IDENTITY, null, 0); rec(sp, i); sp.render(lampFrame(f)); per.push(sp.stats.dynFaces); sp.discard(); }
      return per;
    };
    const body = () => skinnedBody([{ first: 0, count: 90 }]);
    const still = body();
    assert.deepEqual(run(6, (sp) => sp.recordCharacter(still, IDENTITY, [1, 1, 0, 1], true)), [6, 0, 0, 0, 0, 0], 'drawn once, then held');
    const posing = body();
    assert.deepEqual(run(4, (sp) => { posing._poseGen = (posing._poseGen ?? 0) + 1; sp.recordCharacter(posing, IDENTITY, [1, 1, 0, 1], true); }), [6, 6, 6, 6], 'a new pose every frame: drawn every frame');
    const turning = body();
    assert.deepEqual(run(4, (sp, i) => { const m = new Float32Array(IDENTITY); m[0] = Math.cos(i); m[2] = Math.sin(i); sp.recordCharacter(turning, m, [1, 1, 0, 1], true); }), [6, 6, 6, 6], 'turned to the eye: drawn');
    const sheathing = body();
    assert.deepEqual(run(4, (sp, i) => { sheathing.ranges[0].hidden = i === 2; sp.recordCharacter(sheathing, IDENTITY, [1, 1, 0, 1], true); }), [6, 0, 6, 6], 'a range hidden, and shown again: drawn');
    const leaving = body();
    assert.deepEqual(run(4, (sp, i) => sp.recordCharacter(leaving, IDENTITY, i < 2 ? [1, 1, 0, 1] : [400, 1, 0, 1], true)), [6, 0, 0, 0], 'gone out of reach: the cache again (no dynamic draw)');
    const crowd = body();
    const walker = { vao: { walker: 1 }, archive: 182, record: 1, size: { w: 1, h: 1.8 }, origin: [0, 0, 0], bounds: null, indexCount: 6, _dyn: true };
    assert.deepEqual(run(5, (sp, i) => { sp.recordCharacter(crowd, IDENTITY, [1, 1, 0, 1], true); if (i < 2) sp.recordBillboards([walker], new Float32Array(4), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); }), [6, 6, 6, 0, 0], 'a walker beside it: drawn while it walks, and once more to take it out');
    // beside a swaying wood (off Steady shadows, the sway's cadence is every fourth frame): a mover's cadence, as before
    SHADOW_TUNING.override = false;
    const swaying = body();
    const tree = { vao: { tree: 1 }, archive: 504, record: 1, size: { w: 2, h: 4 }, origin: [0, 0, 1], bounds: new Float32Array([0, 0, 0, 2.3]), indexCount: 6, sway: 1 };
    const wind = new Float32Array([0, 5, 12.5, 0.4]);   // shadowreach's blowing wind: the tree leans past the floor
    const swayRun = run(8, (sp) => { swaying._poseGen = (swaying._poseGen ?? 0) + 1; sp.recordCharacter(swaying, IDENTITY, [1, 1, 0, 1], true); sp.recordBillboards([tree], wind, new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); });
    assert.ok(swayRun.slice(1).every((n) => n === 6), `posed beside a swaying tree: drawn every frame (${swayRun})`);
    SHADOW_TUNING.override = true;
    const rig = { vao: { voxel: 1 }, count: 36, bounds: null };
    assert.deepEqual(run(3, (sp) => sp.recordCharacter(rig, IDENTITY, [1, 1, 0, 1])), [6, 6, 6], 'a voxel rig (EL7\'s) is the mover it always was');
  } finally { SHADOW_TUNING.override = undefined; }
  // the renderer's every pose upload is a new generation
  const r = rd('src/render/renderer.js');
  for (const fn of ['  updateSkinPalette(mesh, data) {', '  updateSkinStream(mesh, offset, data) {', '  updateCharacterMesh(mesh, packed) {']) {
    const at = r.indexOf(fn);
    assert.ok(at > 0 && /mesh\._poseGen = \(mesh\._poseGen \?\? 0\) \+ 1;/.test(r.slice(at, r.indexOf('\n  }\n', at))), `${fn.trim()} bumps the pose's generation`);
  }
});

test('MWNPC16h THE LO TIER\'S LAMPS TAKE A BODY THAT NEVER WALKS - past the twelve full maps a room drawn whole casts from its lo maps, and a standing person in a body cast into none of them (the body a mover, its flat cast-only); one whose flat has no origin now casts there, by its id and its place (a new pose is no rebuild, a move is); a body that walks still does not (AUDIT MWNPC16-18 A3 / B F1. Mutants: the lo replay blind to it; the lo signature blind to it; the lane\'s word dropped; a flat with an origin taken)', async () => {
  const { sp, calls, f } = pass();
  const anchored = skinnedBody([{ first: 0, count: 30 }]), walking = skinnedBody([{ first: 30, count: 30 }]);
  sp.recordCharacter(anchored, IDENTITY, [0, 0.9, 0, 1], true, true);
  sp.recordCharacter(walking, IDENTITY, [0, 0.9, 0, 1], true, false);
  sp.render(lampFrame(f));
  const pos = [2, 1, 0], vp = multiply(perspective(Math.PI / 2, 1, 0.05, 20), lookAt(pos, [0, 1, 0], [0, 1, 0]));
  calls.length = 0;
  assert.equal(sp.replay(f, vp, pos, false, 0, 0, 3), 1, 'the lo tier (REPLAY_LO) draws the one that never walks');
  assert.deepEqual(draws(calls), [[0, 30]]);
  calls.length = 0;
  assert.equal(sp.replay(f, vp, pos, false, 0, 0, 1), 0, 'the static replay neither - a body is never baked into a full map\'s cache');
  // the lo signature: by its id and place
  const sig = () => [...sp._staticSignature(pos, 8)];
  const with1 = sig();
  sp.discard();
  sp.recordCharacter(walking, IDENTITY, [0, 0.9, 0, 1], true, false);
  assert.notDeepEqual(sig(), with1, 'its coming and going rebuilds the lo map');
  sp.discard();
  anchored._poseGen = 99;
  sp.recordCharacter(anchored, IDENTITY, [0, 0.9, 0, 1], true, true);
  sp.recordCharacter(walking, IDENTITY, [0, 0.9, 0, 1], true, false);
  assert.deepEqual(sig(), with1, 'a new pose: no rebuild (the lo map holds the pose it was drawn in, as a flat animating in place)');
  sp.discard();
  const moved = new Float32Array(IDENTITY); moved[12] = 1;
  sp.recordCharacter(anchored, moved, [1, 0.9, 0, 1], true, true);
  sp.recordCharacter(walking, IDENTITY, [0, 0.9, 0, 1], true, false);
  assert.notDeepEqual(sig(), with1, 'moved: rebuilt');
  // the word, from the lane: a flat with no origin (its centre in its vertices, never moved by them) never walks
  const rigs = [];
  const lane = createPopulationLane({ laneName: 'people', renderer: {}, want: () => true, make: () => createNpcBodies({ renderer: {}, createRig: recording(rigs), now: () => 1000 }) });
  const look = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
  const flats = { still: { origin: null }, walker: { origin: [0, 0, 0] }, moved: { origin: null, _dyn: true } };
  for (let i = 0; i < 4; i++) {
    lane.frame();
    lane.offer({ id: 'still', look, feet: [0, 0, -4] }, flats.still);
    lane.offer({ id: 'walker', look, feet: [1, 0, -4] }, flats.walker);
    lane.offer({ id: 'moved', look, feet: [-1, 0, -4] }, flats.moved);
    await settle();
    lane.draw({}, PROJ, VIEW, [0, 1.6, 0], 1 / 60);
  }
  assert.deepEqual(rigs.map((r) => r.anchors.at(-1)), [true, false, false], 'the still one\'s body never walks; an origin\'s, or a batch its vertices move, may');
  lane.destroy();
});

test('MWNPC16i AN UNSEEN BODY CASTS ONLY THE POSE OF WHO IT STANDS FOR - a spare taken out of the view wears the last wearer\'s skin until it is seen, and a death out of the view is not yet posed: neither casts until posed for its actor (AUDIT MWNPC16-18 B F2: a living skeleton cast its spare\'s corpse. Mutants: the posed test dropped; a flip left posed)', async () => {
  const rigs = [];
  const pb = new PeerBodies({ renderer: {}, createRig: recording(rigs), buildOpts: () => ({}), now: () => 1000, casts: true });
  const seen = (z) => [peer('a', z)];
  for (let i = 0; i < 4; i++) { pb.sync(seen(5), toScene, 1 / 60, [0, 0, 0]); await settle(); pb.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0] }); }
  const [a] = rigs;
  assert.ok(a.casts.length > 0, 'posed at its build, out of the view: cast');
  const b = pb._bodies.get('a');
  b.posedAt = 0;   // as a spare is taken (its record new), or a life flips (_react)
  a.casts.length = 0;
  pb.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0] });
  assert.equal(a.casts.length, 0, 'not posed for its actor: no cast');
  const dead = { ...peer('a', 5), shown: { ...peer('a', 5).shown, dd: 1 } };
  b.posedAt = 7;
  pb._react(b, dead.shown);
  assert.equal(b.posedAt, 0, 'a death flips it unposed');
});

test('MWNPC16j A BODY MORE BURNT AWAY THAN WHOLE CASTS NO SHADOW - the dissolve\'s own law (systems/dissolve.js: past half, its flat takes noShadow), kept for the body standing in the flat\'s place, seen or not: a foe burnt nine parts away or a companion not yet through its portal threw a whole man\'s shadow, its flat cast-only (AUDIT MWNPC16-18 R1. Mutants: the dissolve unread; the threshold moved; the unseen cast past it)', async () => {
  // the dissolve as the producer mints it (setBatchDissolve - the flat's own field, foeBodies.js foeFx hands it on)
  const burnt = (share) => { const f = {}; setBatchDissolve(f, share); return f; };
  assert.equal(burnt(0.5).noShadow, undefined, 'half gone: the flat still casts');
  assert.equal(burnt(0.51).noShadow, true, 'more gone than whole: the flat casts nothing');
  const run = async (share) => {
    const rigs = [];
    const f = burnt(share);
    const pb = new PeerBodies({ renderer: {}, createRig: recording(rigs), buildOpts: () => ({}), now: () => 1000, casts: true });
    const fxOf = () => (f.dissolve ? { glint: null, elite: 0, time: 0, dissolve: f.dissolve } : null);
    for (let i = 0; i < 4; i++) { pb.sync([peer('front', -5), peer('back', 5)], toScene, 1 / 60, [0, 0, 0]); await settle(); pb.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0], fxOf }); }
    return rigs;
  };
  const [front, back] = await run(0.9);
  assert.ok(front.draws.length > 0 && front.draws.every((c) => c === false), 'seen, nine parts gone: drawn, casting nothing');
  assert.equal(back.casts.length, 0, 'unseen, nine parts gone: not cast');
  const [f2, b2] = await run(0.5);
  assert.ok(f2.draws.length > 0 && f2.draws.every((c) => c === true), 'half gone: cast, as the flat');
  assert.ok(b2.casts.length > 0, 'and unseen');
  const [f3] = await run(0);
  assert.ok(f3.draws.every((c) => c === true), 'whole: cast');
  assert.equal(dissolveShadowless(null), false);
  assert.equal(DISSOLVE_SHADOWLESS, 0.5);
});

test('MWNPC16k A STANDING FLAT THAT TURNS CAST-ONLY LEAVES THE STATIC SIGNATURE - so the cache it was baked into is drawn again without it: a person\'s still flat sits in a lamp\'s static cache, and when their body stands the replay passes the flat over, but a signature that still folded it kept the sprite\'s shadow baked in the cache (the report this arc began from, "Old sprite shadows still show"); the STATIC-WHO log\'s set reads the same (AUDIT MWNPC16-18 R2: 16c counted the doors in the source, and either could read castOnly and do nothing. Mutants: the signature\'s door; the log\'s)', () => {
  const { sp } = pass();
  const still = { vao: { flat: 1 }, archive: 182, record: 1, size: { w: 1, h: 1.8 }, origin: [0, 0, 0], bounds: null, indexCount: 6, castOnly: false, _dyn: false };   // a standing person: built still
  sp.recordBillboards([still], new Float32Array(4), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  const before = [...sp._staticSignature([0, 1, 0], 20)];
  assert.equal(before[1], 1, 'the still flat is in the lamp\'s static set');
  sp._debugStaticDiff();
  assert.equal(sp._dbgStatic.size, 1, 'and in the log\'s');
  still.castOnly = true;   // its body stands (the lane's offer)
  const after = [...sp._staticSignature([0, 1, 0], 20)];
  assert.equal(after[1], 0, 'cast-only: out of the static set');
  assert.notEqual(after[0], before[0], 'the signature moved: the cache is drawn again, without the sprite');
  sp._debugStaticDiff();
  assert.equal(sp._dbgStatic.size, 0, 'and out of the log\'s');
});
