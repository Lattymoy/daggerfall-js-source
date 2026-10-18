// EG-ZL (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 10.3, 10.8 and 25):
// THE PIECES' TELLS ON THE SPANS - the Steps' own look on the Spire's pieces, batched a kind (scenes/eliteGates/egSpan.js,
// scenes/eliteGates/egPieceBatch.js): a kind that turns (a Drift's hang, a Crumble's chunks, a Gust island's banner) written through
// its slot's whole matrix, and a kind's own picture map; the circle's ghosts through the Hour's pass (render/superDungeon/sdStepsPass.js
// - its count, its slabs and the Spire's fog floor, the Hour's text untouched); a Beat's dial a kind a beat, its last 0.4 s
// the place's own white in the danger palette dissolving out and back in through cutout pictures (world/eliteGates/egBandArt.js); my
// Crumble's cracks, grit, chunks, ghost and rewind, its shake still under reduced motion; the Drift's chains and its band's
// anchor leaning with the law's swing; the islands' waystones lit for my cast-back, the Gust islands' banners and its wind;
// a peer on a Crumble I have seen fall drawn on a ghost slab (net/online.js `rideAt`, scenes/eliteGates/egClient.js rideDraw); the
// Rail's track ticked at each end and a Drop's wall lit (world/eliteGates/egLook.js, world/eliteGates/egHall.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../../glsl.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { createEgPieceBatch, EG_BATCH_HIDE_Y } from '../../../src/scenes/eliteGates/egPieceBatch.js';
import { spherePlanes } from '../../../src/render/bounds.js';
import { createEgSpan, egHangModel, egHangReach, egStepKey, EG_FLOOR_KEY, EG_GHOSTS_MAX, EG_GHOST_SLAB, EG_HANG_CABLE_M } from '../../../src/scenes/eliteGates/egSpan.js';
import { SD_BEAT_FRAMES, SD_STEPS_SOUNDS, SD_CHUNK, SD_CRUMBLE_SHAKE, SD_BEAT_OUT_STAGE_S, SD_BEAT_BLINK_HZ, sdChunkWays, sdChunkMatrix } from '../../../src/scenes/superDungeon/sdSteps.js';
import { SdStepsPass, SD_STEPS_PASS_VS, SD_STEPS_PASS_FS, SD_GHOSTS_MAX, sdStepsPassVs, sdStepsPassFs, sdGhostVertices } from '../../../src/render/superDungeon/sdStepsPass.js';
import { stepEdges, SD_PENDULUM, pendulumAngle, SD_BEAT_DISSOLVE, buildCrumbleChunks, sdWaystonesOf, sdVaneAt, vaneYawAt } from '../../../src/world/superDungeon/sdStepsModel.js';
import { SD_STEPS_RECORD, beatArt } from '../../../src/world/superDungeon/sdStepsArt.js';
import { BAYER4 } from '../../../src/world/superDungeon/sdPixelKit.js';
import { SD_CRUMBLE_DELAY, SD_CRUMBLE_BACK, SD_CRUMBLE_FALL_G, SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_BEAT_BLINK, SD_GUST_EVERY } from '../../../src/world/superDungeon/sdSteps.js';
import { SD_REALM_ARCHIVE } from '../../../src/world/superDungeon/sdRealm.js';
import { egBeatWarnArt, egBeatBackArt, egBeatTellMaps, egDissolveArt, egTellArchive, egBandArchive, EG_BEAT_TELL_RECORDS, EG_DISSOLVE_TEXELS } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_KIT_RECORD } from '../../../src/world/eliteGates/egKit.js';   // EG-LOOK: the Galleries' anchor rib's record
import { EG_BEAT_STONE_RECORDS, EG_CRUMBLE_TELL_RECORDS } from '../../../src/world/eliteGates/egPlatformArt.js';   // EG-LOOK: a Beat's stone dissolving with its dial
import { egCircleEdges, EG_TRACK, EG_FOG_FLOOR } from '../../../src/world/eliteGates/egLook.js';
import { egCircleLights, egToDungeon, EG_LAMP, EG_DROP_LAMP } from '../../../src/world/eliteGates/egHall.js';
import { egCircleSpecs, egBandOfCircle } from '../../../src/net/eliteGates/egLaw.js';
import { egPieceAt, EG_DROP_WALL_H } from '../../../src/net/eliteGates/egSpanLaw.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { EG_DANGER_PALETTES } from '../../../src/ui/eliteGates/egAccess.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { OnlineSession } from '../../../src/net/online.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { validEgOut } from '../../../src/net/wire.js';

const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
/** A renderer that keeps what the batch and the span ask of it: each mesh its positions and normals as last sent, every
 *  upload with its options. */
function fakeRenderer({ uploads = true } = {}) {
  const r = { made: [], moved: 0, destroyed: 0, up: [], emis: [] };
  r.createMesh = (m) => { const g = { model: m, subMeshes: m.subMeshes, positions: Float32Array.from(m.positions), normals: Float32Array.from(m.normals) }; r.made.push(g); return g; };
  r.updateMeshVertices = (g, p, n) => { r.moved++; g.positions.set(p); g.normals.set(n); };
  r.destroyMesh = () => { r.destroyed++; };
  if (uploads) { r.uploadTexture = (a, rec, img, o = {}) => r.up.push({ a, rec, img, o }); r.uploadEmissionTexture = (a, rec) => r.emis.push({ a, rec }); }
  return r;
}
/** A renderer with no batch: a draw a piece (the slots ARE the draws - their matrices as the pose writes them). */
const plainRenderer = () => ({ createMesh: (m) => ({ subMeshes: m.subMeshes, model: m }), destroyMesh: () => {} });
/** The first circle (of a few seeds) laying a step `pred` takes, and the step. */
function findStep(pred, { seeds = [7, 99, 12345], circles = 30 } = {}) {
  for (const seed of seeds) for (let c = 1; c <= circles; c++) for (const spec of egCircleSpecs(seed, c, 0)) { const s = spec.steps.find((q) => pred(q, spec)); if (s) return { seed, c, spec, s }; }
  throw new Error('no such step');
}
const stood = (seed, c, renderer, over = {}) => { const sounds = []; const audio = { playOneShot: (rec, vol, pitch = 1) => sounds.push({ rec, vol, pitch }), play3d: (rec, at, vol, o) => sounds.push({ rec, at, vol, pitch: o?.pitch ?? 1, at3: true }) }; const span = createEgSpan({ renderer, audio, seed, c, lite: false, ...over }), draws = []; span.stand({ dynamicDraws: draws, collider: null }); return { span, draws, sounds }; };
const trans = (m) => [m[12], m[13], m[14]];
/** Column-major M x v (a point). */
const xf = (M, v) => [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]];

test('EG-ZL A KIND THAT TURNS AND A KIND\'S OWN PICTURES (scenes/eliteGates/egPieceBatch.js): a kind added `turns` writes each copy through its slot\'s whole matrix - every vertex turned and moved, every normal turned - its cull sphere\'s centre turned with it, and re-lays a copy whose turn alone changed; a kind that only moves keeps the translation\'s law; a hidden turning copy put away; a kind\'s picture map on its one draw, set before the build or after (mutants: the turn ignored; the normals unturned; a turn alone never re-laid; the centre unturned; `turns` dropped; the map lost at the build or after it; a hidden copy drawn)', () => {
  const R = fakeRenderer(), batch = createEgPieceBatch({ renderer: R });
  // a bar along +x from 1 to 2 (its normals out), the eye ahead of a copy turned half round about y
  const P = [[1, 0, -0.1], [2, 0, -0.1], [2, 0.2, 0.1], [1, 0.2, 0.1]], N = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
  const model = { positions: new Float32Array(P.flat()), normals: new Float32Array(N.flat()), uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 1, textureRecord: 2, startIndex: 0, primitiveCount: 2 }] };
  const turned = (a, t) => { const c = Math.cos(a), s = Math.sin(a), m = new Float32Array(16); m[0] = c; m[2] = -s; m[5] = 1; m[8] = s; m[10] = c; m[15] = 1; m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m; };
  const spin = { object: { matrix: turned(Math.PI / 2, [5, 1, 0]) }, hidden: false }, still = { object: { matrix: turned(Math.PI / 2, [5, 1, 0]) }, hidden: false };
  const map = new Map([['1_2', '3_4']]);
  batch.add('spin', model, spin, { turns: true });
  batch.add('still', model, still);
  assert.equal(batch.remap('spin', map), true);
  assert.equal(batch.remap('nothing', map), false, 'no such kind');
  const draws = [];
  batch.build(draws);
  assert.equal(draws[0].texRemap, map, 'the map kept through the build');
  assert.equal(draws[1].texRemap, null);
  batch.cull(null);
  for (let p = 0; p < 4; p++) {
    const want = xf(spin.object.matrix, P[p]), got = batch.copyVertex('spin', 0, p);
    assert.ok(got.every((v, k) => near(v, want[k])), `vertex ${p} turned and moved: ${got} against ${want}`);
    const n = R.made[0].normals.subarray(p * 3, p * 3 + 3), wn = [spin.object.matrix[0] * N[p][0] + spin.object.matrix[4] * N[p][1] + spin.object.matrix[8] * N[p][2], spin.object.matrix[1] * N[p][0] + spin.object.matrix[5] * N[p][1] + spin.object.matrix[9] * N[p][2], spin.object.matrix[2] * N[p][0] + spin.object.matrix[6] * N[p][1] + spin.object.matrix[10] * N[p][2]];
    assert.ok([...n].every((v, k) => near(v, wn[k])), `normal ${p} turned`);
    const s = batch.copyVertex('still', 0, p);
    assert.ok(s.every((v, k) => near(v, P[p][k] + still.object.matrix[12 + k])), 'a kind that only moves: moved alone');
  }
  const sent = R.moved;
  batch.cull(null);
  assert.equal(R.moved, sent, 'nothing changed: nothing sent');
  const m = turned(Math.PI, [5, 1, 0]);
  spin.object.matrix.set(m);
  batch.cull(null);
  assert.equal(R.moved, sent + 1, 'the turn alone changed: re-laid');
  assert.ok(near(batch.copyVertex('spin', 0, 1)[0], 5 - 2), 'and written turned');
  // the cull's sphere turned with the copy: the bar's centre 1.5 out along +x, turned half round to -x, ahead of an eye at
  // (2, 0, 0) looking down -x; unturned it would stand behind the eye
  spin.object.matrix.set(turned(Math.PI, [0, 0, 0]));
  const eyeX = 0.2, view = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, -eyeX, 1]);
  const t = 1 / Math.tan(0.4), f = 100, nr = 0.1, proj = new Float32Array([t, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + nr) / (nr - f), -1, 0, 0, (2 * f * nr) / (nr - f), 0]);
  const vp = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) vp[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
  batch.cull(spherePlanes(vp));
  assert.ok(!draws[0].hidden && near(batch.copyVertex('spin', 0, 0)[0], -1), 'its turned centre ahead of the eye: drawn');
  spin.hidden = true;
  batch.cull(null);
  assert.equal(batch.copyVertex('spin', 0, 0)[1], EG_BATCH_HIDE_Y, 'a hidden turning copy put away');
  assert.ok(draws[0].hidden, 'its kind not drawn');
  const other = new Map([['1_2', '5_6']]);
  batch.remap('spin', other);
  assert.equal(draws[0].texRemap, other, 'a map set after the build is the draw\'s');
  batch.clear();
});

test('EG-ZL THE SPIRE\'S GHOSTS THROUGH THE HOUR\'S PASS (render/superDungeon/sdStepsPass.js; sections 10.3, 10.8 and 25.6): the Hour\'s vertex and fragment text and its buffer unchanged; a circle\'s count past the Hour\'s fifteen; each ghost\'s SLAB - its box\'s top after its segments - placed at its top plus the lift, lit only by its state\'s fourth share and at that share; the Spire\'s fragment stage keeping the fog floor within 30 m; the pass built with its count, its slabs and its floor, drawing a ghost past the fifteenth and sending the floor (mutants: no slab laid; a slab lit at nothing; its share ignored; the floor dropped; the count clipped to the Hour\'s; the loop on the Hour\'s count; the floor never sent)', () => {
  assert.equal(SD_STEPS_PASS_VS, sdStepsPassVs());
  assert.equal(SD_STEPS_PASS_FS, sdStepsPassFs());
  assert.ok(!SD_STEPS_PASS_VS.includes('aM.w > 1.5') && !SD_STEPS_PASS_FS.includes('uFogFloor'), 'the Hour\'s text carries neither');
  const ghosts = [{ kind: 'beat' }, { kind: 'crumble' }, { kind: 'crumble' }];
  assert.equal(sdGhostVertices(ghosts).length, 3 * 13 * 6 * 10, 'the Hour\'s buffer: no slab');
  const v = sdGhostVertices(ghosts, { max: EG_GHOSTS_MAX, slab: true }), per = 13 * 6 + 6;
  assert.equal(v.length, 3 * per * 10);
  const many = Array.from({ length: 20 }, () => ({ kind: 'beat' }));
  assert.equal(sdGhostVertices(many, { max: EG_GHOSTS_MAX }).length, 20 * 13 * 6 * 10, 'a circle\'s count, past the Hour\'s fifteen');
  assert.equal(sdGhostVertices(many).length, SD_GHOSTS_MAX * 13 * 6 * 10, 'the Hour\'s maximum by default');
  const top = stepEdges('crumble').slice(0, 4).map((e) => e[0]);
  for (let k = 0; k < 6; k++) {
    const o = (per + 13 * 6 + k) * 10;
    assert.equal(v[o + 9], 2, 'a slab vertex');
    assert.equal(v[o + 6], 1, 'its ghost');
    assert.ok(top.some((c) => c.every((q, j) => near(q, v[o + j]))), 'on its box\'s top');
  }
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const step = Array.from({ length: EG_GHOSTS_MAX }, () => [0, 0, 0, 0]), state = Array.from({ length: EG_GHOSTS_MAX }, () => [0, 0, 0, 0]);
  step[20] = [0.1, 0.2, 0.3, 0]; state[20] = [1, 0, 0.8, 0.5];
  const f = glslFunctions(sdStepsPassVs(EG_GHOSTS_MAX, true), { uVP: I, uStep: step, uState: state, uViewport: [200, 100], uWidth: 2 });
  const run = (aA, aM) => { f.globals.aA = aA; f.globals.aB = [0, 0, 0]; f.globals.aM = aM; f.main(); return { pos: f.globals.gl_Position.slice(), k: f.globals.vK }; };
  const a = run([0.5, 0, -0.4], [20, 0, 0, 2]);
  assert.deepEqual(a.pos.map((q) => +q.toFixed(5)), [0.6, 0.22, -0.1, 1].map((q) => +q.toFixed(5)), 'its top plus the lift');
  assert.ok(near(a.k, 1 * 0.8 * 0.5), 'its light the ghost\'s, by its share');
  state[20] = [1, 0, 0.8, 0]; f.globals.uState = state;
  assert.deepEqual(run([0.5, 0, -0.4], [20, 0, 0, 2]).pos, [2, 2, 2, 1], 'no peer: no slab');
  // the Spire's floor: within 30 m in a thick fog, at least 0.85 of its own light kept; past 34 m the world's fog alone
  const frag = (src, d) => {
    const fs = glslFunctions(src, { vK: 1, vWorld: [0, 0, d], uColor: [1, 0.8, 0.4], uSteps: 1000, uFogMode: 2, uFogDensity: 0.2, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], uFogFloor: [EG_FOG_FLOOR.floor, EG_FOG_FLOOR.within, EG_FOG_FLOOR.ease], gl_FragCoord: [0, 0, 0, 1] });
    fs.main(); return fs.globals.o[0];
  };
  assert.ok(frag(sdStepsPassFs(true), 20) >= 0.85 * 0.999, `kept through the fog within 30 m (${frag(sdStepsPassFs(true), 20)})`);
  assert.ok(frag(SD_STEPS_PASS_FS, 20) < 0.1, 'the Hour\'s fades as its fog says');
  assert.ok(near(frag(sdStepsPassFs(true), 40), frag(SD_STEPS_PASS_FS, 40), 1e-6), 'past its reach, the world\'s fog');
  // the pass: its own text, a ghost past the fifteenth drawn, its floor sent
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4, ARRAY_BUFFER: 1, FLOAT: 5, STATIC_DRAW: 7, VERTEX_SHADER: 8, FRAGMENT_SHADER: 9, drawingBufferHeight: 720, drawingBufferWidth: 1280 }, { get: (t, k) => (k in t ? t[k] : (...args) => { calls.push([k, ...args]); if (k === 'getProgramParameter' || k === 'getShaderParameter') return true; if (k === 'getUniformLocation') return args[1]; return {}; }) });
  const pass = new SdStepsPass(/** @type {any} */ (gl), many, { max: EG_GHOSTS_MAX, slab: true, fogFloor: EG_FOG_FLOOR });
  assert.ok(calls.some((c) => c[0] === 'shaderSource' && c[2] === sdStepsPassVs(EG_GHOSTS_MAX, true)), 'its own vertex stage');
  const ss = new Float32Array(EG_GHOSTS_MAX * 4), st = new Float32Array(EG_GHOSTS_MAX * 4);
  st[19 * 4] = 1; st[19 * 4 + 2] = 1;
  calls.length = 0;
  assert.equal(pass.draw(I, I, ss, st, null), true, 'the twentieth ghost drawn');
  assert.ok(calls.some((c) => c[0] === 'drawArrays' && c[3] === 20 * per), 'every ghost\'s segments and slab');
  assert.ok(calls.some((c) => c[0] === 'uniform3f' && c[1] === 'uFogFloor' && c[2] === EG_FOG_FLOOR.floor && c[3] === EG_FOG_FLOOR.within && c[4] === EG_FOG_FLOOR.ease), 'its floor sent');
  calls.length = 0;
  const hour = new SdStepsPass(/** @type {any} */ (gl));
  assert.ok(calls.some((c) => c[0] === 'shaderSource' && c[2] === SD_STEPS_PASS_VS) && calls.some((c) => c[0] === 'shaderSource' && c[2] === SD_STEPS_PASS_FS), 'the Hour\'s own text');
  void hour;
});

/** A circle laying Beats on both halves of the beat, and the Beat of each. */
function beatsBoth() {
  for (const seed of [7, 99, 12345]) for (let c = 1; c <= 20; c++) {
    const steps = egCircleSpecs(seed, c, 0).flatMap((s) => s.steps.map((q) => ({ q, spec: s })));
    const a = steps.find((x) => x.q.kind === 'beat' && x.q.beat === 0), b = steps.find((x) => x.q.kind === 'beat' && x.q.beat > 0);
    if (a && b) return { seed, c, a, b };
  }
  throw new Error('no circle');
}

test('EG-ZL A BEAT\'S TELLS (section 10.3: "a sector sweeping through the solid time; the last 0.4 s white, faltering at most 2.5 Hz; a gold ghost while it is gone"): a kind a beat, its one draw wearing its frame - the Steps\' dial hand by hand, dithering in over its first 0.15 s, over its last 0.4 s the place\'s own white dissolving out a stage a tenth of a second - while the other beat wears its own; the danger palette\'s warning; the Steps\' own frames with no pictures to hold; its ghost while it is gone, its hand running back (mutants: one kind for both beats; the warning stage frozen; the return\'s stage frozen; no warning; the frame off the clock; the palette ignored; the beat ghost on a solid plate)', () => {
  const { seed, c, a, b } = beatsBoth(), band = egBandOfCircle(c);
  const R = fakeRenderer(), { span, draws } = stood(seed, c, R);
  const beatDraw = (beat) => draws.find((d) => d.gpu.subMeshes.some((sm) => sm.textureRecord === SD_STEPS_RECORD.beat[0]) && R.made.indexOf(d.gpu) >= 0 && kindOf(d) === beat);
  const kinds = span.marks.beats.map((x) => x.kind).sort();
  assert.deepEqual(kinds, [`beat@0`, `beat@${Math.round(b.q.beat * 1000)}`], 'a kind a beat');
  // which draw is which: the batch lays a kind's copies in its own mesh, the beat's copies where its plates stand
  const plates = (beat) => egCircleSpecs(seed, c, 0).flatMap((s) => s.steps.filter((q) => q.kind === 'beat' && q.beat === beat).map((q) => realmToDungeon(s.x0 + q.x, q.y, q.z)));
  const kindOf = (d) => { const p = d.gpu.positions; for (const [beat, ps] of [[0, plates(0)], [b.q.beat, plates(b.q.beat)]]) if (ps.some((w) => Math.abs(p[0] - w[0]) < 2 && Math.abs(p[2] - w[2]) < 2)) return beat; return null; };
  const W = egBeatTellMaps(band, 'standard'), base = 0;
  // PIN MOVED (EG-LOOK, the spans' pieces - world/eliteGates/egPlatformModel.js egBeatModel): a Beat is the Steps' dial set in the band's
  // stone, so its warning's and its return's maps carry its dial's stage (the same picture as before) and its stone's own
  // stage beside it (world/eliteGates/egPlatformArt.js EG_BEAT_STONE_RECORDS) - it dissolves whole. Before: the dial's map alone.
  const D = (Wp, list, k) => new Map([...Wp[list][k], ...EG_BEAT_STONE_RECORDS.map((q) => [`${egBandArchive(band)}_${q.rec}`, `${egTellArchive(band)}_${q[list][k]}`])]);
  const same = (got, want, what) => { assert.ok(got instanceof Map && got.size === want.size && [...want].every(([k, v]) => got.get(k) === v), `${what}: ${got && [...got]} against ${[...want]}`); };
  const at = (u) => { span.ride(base + u, 0.016, null, false); span.cull(null, null); return { a: beatDraw(0)?.texRemap ?? null, b: beatDraw(b.q.beat)?.texRemap ?? null, marks: Object.fromEntries(span.marks.beats.map((x) => [x.kind, x.map])) }; };
  let m = at(0.5);
  assert.equal(m.marks['beat@0'], SD_BEAT_FRAMES[2], 'its dial at frame 2');
  assert.equal(m.a, SD_BEAT_FRAMES[2], 'on its draw');
  assert.equal(m.b, m.marks[`beat@${Math.round(b.q.beat * 1000)}`], 'the other beat on its own draw');
  m = at(b.q.beat + 0.07);
  assert.equal(m.marks['beat@0'], SD_BEAT_FRAMES[9]);
  same(m.marks[`beat@${Math.round(b.q.beat * 1000)}`], D(W, 'back', 1), 'the other beat dithering back in at its own 0.07 s');
  assert.equal(m.a, SD_BEAT_FRAMES[9]); same(m.b, D(W, 'back', 1), 'on its own draw'); assert.equal(m.b, m.marks[`beat@${Math.round(b.q.beat * 1000)}`]);
  for (let k = 0; k < 4; k++) same(at(SD_BEAT_SOLID - SD_BEAT_BLINK + (k + 0.5) * SD_BEAT_OUT_STAGE_S).marks['beat@0'], D(W, 'warn', k), `its warning, stage ${k}`);
  for (const [u, k] of [[0.02, 2], [0.07, 1], [0.12, 0]]) same(at(u).marks['beat@0'], D(W, 'back', k), `back in at ${u} s`);
  assert.equal(at(0.2).marks['beat@0'], SD_BEAT_FRAMES[1]);
  // the uploads: the warning's four and the return's three, as cutouts, under the band's tell archive, once
  // PIN MOVED (EG-LOOK): with them its stone's dissolving (cutouts too), and a circle's Crumbles' stages in the band's flags
  const crumbles = egCircleSpecs(seed, c, 0).some((sp) => sp.steps.some((q) => q.kind === 'crumble' || q.kind === 'bone'));
  const recs = R.up.filter((u) => u.a === egTellArchive(band)), stone = EG_BEAT_STONE_RECORDS.flatMap((q) => [...q.warn, ...q.back]);
  assert.deepEqual(recs.map((u) => u.rec).sort((x, y) => x - y), [...EG_BEAT_TELL_RECORDS.warn[0], ...EG_BEAT_TELL_RECORDS.back, ...stone, ...(crumbles ? EG_CRUMBLE_TELL_RECORDS : [])].sort((x, y) => x - y));
  assert.ok(recs.filter((u) => !EG_CRUMBLE_TELL_RECORDS.includes(u.rec)).every((u) => u.o.cutout === true), 'cutouts');
  // gone: its ghost, its hand running back
  at(3.0);
  const g = span.ghosts, slot = g.of.findIndex((q) => q.h === a.spec.h && q.i === a.q.i);
  assert.deepEqual([...g.state.subarray(slot * 4, slot * 4 + 2)].map((q) => +q.toFixed(4)), [1, +((SD_BEAT_CYCLE - 3.0) / (SD_BEAT_CYCLE - SD_BEAT_SOLID)).toFixed(4)]);
  at(1.0);
  assert.equal(span.ghosts.state[slot * 4], 0, 'standing: no ghost');
  // the danger palette: High contrast's warning, its own pictures
  try {
    setPref('dangerPalette', 'contrast');
    const Wc = egBeatTellMaps(band, 'contrast');
    assert.notEqual(Wc.warn[0], W.warn[0]);
    same(at(SD_BEAT_SOLID - SD_BEAT_BLINK + 0.05).marks['beat@0'], D(Wc, 'warn', 0), 'the palette\'s warning');
    assert.ok(R.up.some((u) => u.rec === EG_BEAT_TELL_RECORDS.warn[1][0]), 'its pictures up');
  } finally { setPref('dangerPalette', 'standard'); }
  // a renderer with no pictures to hold: the Steps' own frames through the warning
  const Q = stood(seed, c, fakeRenderer({ uploads: false }));
  Q.span.ride(base + SD_BEAT_SOLID - 0.1, 0.016, null, false);
  assert.equal(Q.span.marks.beats.find((x) => x.kind === 'beat@0').map, SD_BEAT_FRAMES[11]);
  span.clear(); Q.span.clear();
});

test('EG-ZL A BEAT\'S PICTURES (world/eliteGates/egBandArt.js; sections 10.3, 25.2 and 25.7): its warning\'s four stages each the Steps\' dial dissolved by the ordered dither - exactly the cells its stage keeps (SD_BEAT_DISSOLVE.keep of 16, cells of the Steps\' own three texels), the rest a hole and dark - frame 10 then its falter, the falter where the Steps\' own blink law falters; the warning\'s light the palette\'s hazard (white; High contrast\'s cyan, its rim line dashed); its return the dial\'s first frame dithering in (mutants: the dissolve keeping all; the falter a stage late; the warning\'s light the Hour\'s ember; the dash never drawn)', () => {
  assert.equal(EG_DISSOLVE_TEXELS, 3, 'the Steps\' cell, three texels');
  const kept = (img, keep) => { let n = 0, want = 0; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { if (img.colors[(y * img.width + x) * 4 + 3] > 0) n++; if (BAYER4[((Math.floor(y / 3) & 3) << 2) | (Math.floor(x / 3) & 3)] < keep) want++; } return [n, want]; };
  const glow = (img) => { let best = [0, 0, 0]; for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] + img.colors[i + 1] + img.colors[i + 2] > best[0] + best[1] + best[2]) best = [img.colors[i], img.colors[i + 1], img.colors[i + 2]]; return best; };
  for (const key of ['standard', 'contrast']) {
    const P = EG_DANGER_PALETTES[key], art = egBeatWarnArt(key);
    assert.deepEqual(art.map(([r]) => r), EG_BEAT_TELL_RECORDS.warn[key === 'standard' ? 0 : 1]);
    art.forEach(([, a], k) => { const [n, want] = kept(a.albedo, SD_BEAT_DISSOLVE.keep[k]); assert.equal(n, want, `${key} stage ${k}: the cells it keeps`); });
    // the falter by the Steps' own law: a stage falters where the warning, at its start, falters
    art.forEach(([, a], k) => {
      const w = k * SD_BEAT_OUT_STAGE_S + 1e-6, falters = Math.floor(w * 2 * SD_BEAT_BLINK_HZ) % 2 === 1, l = glow(a.emission);
      const l0 = glow(art[0][1].emission);
      assert.equal(l[0] + l[1] + l[2] < 0.5 * (l0[0] + l0[1] + l0[2]), falters, `${key} stage ${k}: ${falters ? 'faltered' : 'lit'}`);
    });
    const hot = glow(art[0][1].emission), hz = P.hazard;
    assert.ok(Math.abs(hot[0] / hot[2] - hz[0] / hz[2]) < 0.08 && Math.abs(hot[1] / hot[2] - hz[1] / hz[2]) < 0.08, `${key}: the warning's light the palette's hazard (${hot})`);
  }
  // High contrast dashes its warning's rim line; Standard keeps it whole
  const lineRow = (img) => { const out = []; for (let x = 64; x < 128; x++) out.push(img.colors[(16 * 128 + x) * 4] > 0 ? 1 : 0); return out; };
  const fresh = (key) => { const P = EG_DANGER_PALETTES[key]; return beatArt(10, false, undefined, { warn: P.hazard.map((v) => Math.round(v * 255)), dash: P.hatch === 1 }); };
  const sd = lineRow(fresh('standard').emission), hc = lineRow(fresh('contrast').emission);
  assert.ok(sd.every(Boolean), 'whole');
  assert.deepEqual(hc.slice(0, 16), [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0], 'dashed, four on and four off');
  // the dissolve: dropped texels clear and dark
  const one = egDissolveArt(fresh('standard'), 2);
  for (let i = 0; i < one.albedo.colors.length; i += 4) if (one.albedo.colors[i + 3] === 0) assert.equal(one.emission.colors[i] + one.emission.colors[i + 1] + one.emission.colors[i + 2], 0);
  const back = egBeatBackArt();
  assert.deepEqual(back.map(([r]) => r), EG_BEAT_TELL_RECORDS.back);
  back.forEach(([, a], k) => { const [n, want] = kept(a.albedo, SD_BEAT_DISSOLVE.keep[k]); assert.equal(n, want); });
  const maps = egBeatTellMaps(2, 'contrast');
  assert.deepEqual([...maps.warn[3]], [[`${SD_REALM_ARCHIVE}_${SD_STEPS_RECORD.beat[0]}`, `${egTellArchive(2)}_${EG_BEAT_TELL_RECORDS.warn[1][3]}`]]);
  assert.equal(egTellArchive(2), 38262, 'the Shade block\'s second archive');
});

test('EG-ZL MY CRUMBLE\'S TELLS (section 10.3: "three crack stages, and the rewind as it returns"; the Steps\' own): my foot on it grinds where it stands, its three crack stages across the shake (shaking, still under reduced motion), its grit pouring; fallen, its plate gone and its chunks falling by the Steps\' own law, out of sight past its depth; its ghost counting the return; in the last 0.6 s the chunks flying back; whole again its click home and a shudder (still under reduced motion); a bone bridge the same; two chunks on a phone (mutants: the stage frozen; the shake under reduced motion; the rewind skipped; the chunks at the fall\'s time; the plate shown fallen; no click home; no grind; no grit; no shudder home; no ghost; a bone bridge bare; the phone\'s two ignored)', () => {
  const { seed, c, spec, s } = findStep((q) => q.kind === 'crumble');
  const { span, sounds } = stood(seed, c, plainRenderer());
  const slot = span.slots.find((q) => q.h === spec.h && q.i === s.i), [x, y, z] = realmToDungeon(spec.x0 + s.x, s.y, s.z);
  const body = { pos: [x, y, z], grounded: true, groundKey: egStepKey(spec.h, s.i), height: 1.8 }, T0 = 100;
  span.ride(T0 - 0.016, 0.016, null, false);   // the spans stood a frame before my foot
  span.ride(T0, 0.016, body, true);
  assert.ok(sounds.some((q) => q.rec === SD_STEPS_SOUNDS.grind && q.at3 && near(q.at[0], x) && near(q.at[2], z)), 'it grinds where it stands');
  const away = { pos: [x, y + 50, z], grounded: false, groundKey: null, height: 1.8 };
  const shown = (d) => d && !d.hidden;
  for (const [since, n] of [[0.1, 1], [0.3, 2], [0.6, 3]]) {
    span.ride(T0 + since, 0.016, away, true);
    assert.ok(!shown(slot.draw) && slot.stages.every((d, k) => shown(d) === (k === n - 1)), `stage ${n} at ${since} s`);
    const t = T0 + since, m = slot.stages[n - 1].object.matrix;
    assert.ok(near(m[12], x + SD_CRUMBLE_SHAKE * Math.sin(t * 71)) && near(m[14], z + SD_CRUMBLE_SHAKE * Math.cos(t * 53)), 'shaking');
    assert.ok(shown(slot.grit), 'its grit pouring');
  }
  try {
    setPref('reducedMotion', true);
    span.ride(T0 + 0.35, 0.016, away, true);
    assert.ok(trans(slot.stages[1].object.matrix).every((q, k) => near(q, [x, y, z][k], 1e-4)), 'still under reduced motion: no shake');
  } finally { setPref('reducedMotion', false); }
  const ways = sdChunkWays(buildCrumbleChunks(4));
  const chunksAt = (tau) => slot.chunks.forEach((d, j) => { assert.ok(shown(d), `chunk ${j} shown`); const w = sdChunkMatrix(new Float32Array(16), ways[j], tau, x, y, z); assert.ok([...d.object.matrix].every((q, k) => near(q, w[k], 1e-3)), `chunk ${j} at tau ${tau}`); });
  span.ride(T0 + SD_CRUMBLE_DELAY + 0.3, 0.016, away, true);
  assert.ok(!shown(slot.draw) && slot.stages.every((d) => !shown(d)) && !shown(slot.grit), 'fallen: its plate gone, no cracks, no grit');
  chunksAt(0.3);
  const gi = span.ghosts.of.findIndex((q) => q.h === spec.h && q.i === s.i), gs = span.ghosts.state;
  assert.deepEqual([gs[gi * 4], +gs[gi * 4 + 1].toFixed(4)], [1, +((SD_CRUMBLE_BACK - 0.3) / SD_CRUMBLE_BACK).toFixed(4)], 'its ghost counting the return');
  const deep = Math.sqrt((2 * 40) / SD_CRUMBLE_FALL_G) + 0.1;
  span.ride(T0 + SD_CRUMBLE_DELAY + deep, 0.016, away, true);
  assert.ok(slot.chunks.every((d) => !shown(d)), 'out of sight past its depth');
  const back = SD_CRUMBLE_BACK - SD_CHUNK.rewind, f = back + 0.3, r = 1 - 0.3 / SD_CHUNK.rewind;
  span.ride(T0 + SD_CRUMBLE_DELAY + f, 0.016, away, true);
  chunksAt(SD_CHUNK.rise * r * r);
  sounds.length = 0;
  const home = T0 + SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK + 0.05;
  span.ride(home, 0.016, away, true);
  assert.equal(sounds.filter((q) => q.rec === SD_STEPS_SOUNDS.clack && q.pitch === 2.6 && q.at3).length, 1, 'its click home');
  assert.ok(shown(slot.draw) && slot.chunks.every((d) => !shown(d)) && gs[gi * 4] === 0, 'whole again, its ghost gone');
  const t1 = home + 0.05;
  span.ride(t1, 0.016, away, true);
  const k = 1 - (t1 - (T0 + SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK)) / SD_CHUNK.shudder;
  assert.ok(near(slot.draw.object.matrix[12], x + SD_CHUNK.settle * k * Math.sin(t1 * 83)), 'a shudder');
  try { setPref('reducedMotion', true); span.ride(t1 + 0.01, 0.016, away, true); assert.ok(near(slot.draw.object.matrix[12], x), 'still under reduced motion'); } finally { setPref('reducedMotion', false); }
  // a bone bridge: the Crumble's law, its tells
  const bone = findStep((q) => q.kind === 'bone');
  const B = stood(bone.seed, bone.c, plainRenderer()), bs = B.span.slots.find((q) => q.h === bone.spec.h && q.i === bone.s.i);
  assert.ok(bs.stages?.length === 3 && bs.chunks?.length === 4 && bs.grit, 'a bone bridge cracks, pours and breaks');
  const lite = stood(seed, c, plainRenderer(), { lite: true });
  assert.equal(lite.span.slots.find((q) => q.h === spec.h && q.i === s.i).chunks.length, 2, 'two chunks on a phone');
  span.clear(); B.span.clear(); lite.span.clear();
});

test('EG-ZL A DRIFT\'S HANG (section 10.3: "hangs on two chains from an anchor 18 m up (an arch rib, a ribcage, a moon-shard, a crane hook), leaning as it swings"): each band its own anchor over the same two chains, the chains down to their brackets beside the deck; the hang turned about its pivot SD_PENDULUM.len over the deck\'s rest by the law\'s own swing, its foot beside the deck where the law swings it; batched a kind a hall, its copies written turned (mutants: the pivot on the deck; the lean dropped; a kind that only moves; the hall\'s kinds one)', () => {
  const models = [0, 1, 2, 3].map((b) => egHangModel(b));
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.notDeepEqual([...models[i].positions].slice(-30), [...models[j].positions].slice(-30), `bands ${i} and ${j}: their own anchors`);
  // PIN MOVED (EG-LOOK, the spans' pieces): the Galleries' rib in the kit's voussoirs (world/eliteGates/egKit.js EG_KIT_RECORD.voussoir),
  // every hang in its band's own archive: [1, 56] under the Hour's before, moved by the dress
  assert.deepEqual(models[0].subMeshes.map((s) => s.textureRecord), [1, EG_KIT_RECORD.voussoir], 'the Galleries\' rib in voussoirs, gold leaf on its crown');
  models.forEach((m, b) => assert.ok(m.subMeshes.every((sm) => sm.textureArchive === egBandArchive(b)), `band ${b}: its own archive`));
  for (const m of models) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < m.positions.length; i += 3) { lo = Math.min(lo, m.positions[i]); hi = Math.max(hi, m.positions[i]); }
    assert.ok(near(lo, -(SD_PENDULUM.len + SD_PENDULUM.into) - SD_PENDULUM.rod / 2, 1e-4), 'down to the brackets');
    assert.ok(hi > 0, 'the anchor over the pivot');
  }
  const { seed, c, spec, s } = findStep((q) => q.kind === 'drift' && q.amp > 1);
  const { span } = stood(seed, c, plainRenderer());
  const slot = span.slots.find((q) => q.h === spec.h && q.i === s.i), t = (s.period / 4 - s.phase * s.period / (2 * Math.PI)) + 50 * s.period, dx = egPieceAt(s, t).dx;
  span.ride(t, 0.016, null, false);
  const M = slot.hang.object.matrix, pivot = realmToDungeon(spec.x0 + s.x, s.y + SD_PENDULUM.len, s.z), a = pendulumAngle(dx);
  assert.ok(Math.abs(dx) > 0.9, `swung (${dx})`);
  assert.ok(trans(M).every((q, k) => near(q, pivot[k], 1e-3)), 'about its pivot over the deck\'s rest');
  assert.ok(near(M[0], Math.cos(a)) && near(M[1], Math.sin(a)) && near(M[4], -Math.sin(a)), 'leaning by the law\'s swing');
  const foot = xf(M, [SD_PENDULUM.foot, -(SD_PENDULUM.len + SD_PENDULUM.into), 0]), [dxW] = realmToDungeon(spec.x0 + s.x + dx, s.y, s.z);
  assert.ok(Math.abs(foot[0] - (dxW + SD_PENDULUM.foot)) < 0.06, `its foot beside the swung deck (${foot[0]} against ${dxW + SD_PENDULUM.foot})`);
  assert.ok(!slot.hang.hidden);
  // batched: a kind a hall, turning
  const R = fakeRenderer(), Bt = stood(seed, c, R);
  Bt.span.ride(t, 0.016, null, false); Bt.span.cull(null, null);
  const hm = egHangModel(egBandOfCircle(c)), V = hm.positions.length / 3;
  // (EG-PERFECT: a hall whose drifts all hang whole - a drift capped under a floor over it hangs its own shorter model in its
  // hall's kind, egHangReach)
  const halls = egCircleSpecs(seed, c, 0).filter((q) => q.steps.some((p) => p.kind === 'drift') && q.steps.filter((p) => p.kind === 'drift').every((p) => full(egHangReach(q, p, egBandOfCircle(c)))));
  function full(R) { return R.len === SD_PENDULUM.len && R.over === EG_HANG_CABLE_M; }
  // a hang kind's mesh: its copies' texture places the hang's own, laid at the build
  const hangs = R.made.filter((g) => g.model.uvs.length % (V * 2) === 0 && g.model.uvs.length >= V * 2 && hm.uvs.every((q, k) => q === g.model.uvs[k]));
  assert.equal(hangs.length, halls.length, 'a kind a hall');
  const want = xf(M, [hm.positions[0], hm.positions[1], hm.positions[2]]);
  assert.ok(hangs.some((g) => { for (let o = 0; o < g.positions.length; o += V * 3) if ([0, 1, 2].every((k) => near(g.positions[o + k], want[k], 1e-3))) return true; return false; }), 'its copy written turned');
  span.clear(); Bt.span.clear();
});

test('EG-ZL THE ISLANDS\' WAYSTONES AND THE GUST\'S BANNERS AND WIND (section 10.3: "Islands carry the Steps\' waystone, lit gold while it is a member\'s cast-back point"; the Gust\'s "streamer banner on every island pointing the push 1 s ahead; the wind rising (AmbientWindMoanDeep)"): a stone on every island at the Steps\' own place beside its landing, lit while my cast-back point stands on its island, dark otherwise; the Steps\' vane on each island of a Gust section, swung by the breath\'s own clock; the wind and its clack once a gust over the section, nowhere else (mutants: no stone lit; the lit stone never moved; a stone lit only at its island\'s heart; the banner unswung; no banner; the wind every frame; the wind everywhere; the wind the Hour\'s blow)', () => {
  const { seed, c, spec } = findStep((q, sp) => q.kind === 'gust' && sp.islands.some((a) => sp.islands.some((b) => Math.abs(a.z - b.z) > 5)));
  const { span, sounds } = stood(seed, c, plainRenderer());
  const M = span.marks, all = egCircleSpecs(seed, c, 0);
  assert.equal(M.stones.length, all.reduce((n, s) => n + s.islands.length, 0), 'a stone on every island');
  for (const sp of all) { const w = sdWaystonesOf({ checkpoints: sp.islands }); sp.islands.forEach((isl, k) => { const st = M.stones.find((q) => q.h === sp.h && q.x === isl.x && q.z === isl.z); const want = realmToDungeon(sp.x0 + w[k][0], w[k][1], w[k][2]); for (const d of [st.lit, st.dark]) assert.ok(trans(d.object.matrix).every((q, j) => near(q, want[j], 1e-3)), 'at the Steps\' own place beside its landing'); }); }
  const i0 = spec.islands[0], i1 = spec.islands.find((q) => Math.abs(q.z - i0.z) > 5), at = (isl, off = 0) => ({ pos: realmToDungeon(spec.x0 + isl.x + off, isl.y, isl.z), grounded: true, groundKey: EG_FLOOR_KEY, height: 1.8 });
  const litOf = () => span.marks.stones.filter((q) => !q.lit.hidden).map((q) => [q.h, q.x, q.z]);
  span.ride(10, 0.016, at(i0), true); span.ride(10.02, 0.016, at(i0), true);
  assert.deepEqual(litOf(), [[spec.h, i0.x, i0.z]], 'my cast-back island\'s stone lit');
  assert.ok(span.marks.stones.every((q) => q.dark.hidden === !q.lit.hidden), 'every other dark');
  span.ride(10.04, 0.016, at(i1, i1.r - 0.4), true); span.ride(10.06, 0.016, at(i1, i1.r - 0.4), true);
  assert.deepEqual(litOf(), [[spec.h, i1.x, i1.z]], 'at the island\'s edge too, and one at a time');
  span.setSafe(realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z)); span.ride(10.08, 0.016, null, false);
  assert.deepEqual(litOf(), [], 'on a plate: none');
  // the banners: the Steps' vane on the Gust section's islands, swung by the breath's clock
  assert.ok(M.vanes.length >= 1, 'a banner on a Gust island');
  const t = 6 * 40 - 0.5;
  span.ride(t, 0.016, null, false);
  const yaw = vaneYawAt(t), v = M.vanes[0].object.matrix;
  assert.ok(Math.abs(yaw) > 0.5 && near(v[0], Math.cos(yaw)) && near(v[8], Math.sin(yaw)), `swung to the push (${yaw})`);
  // the wind: once a gust over the section, and its clack; off it, nothing
  const g = spec.steps.find((q) => q.kind === 'gust'), over = { pos: realmToDungeon(spec.x0 + g.x, g.y, g.z), grounded: true, groundKey: EG_FLOOR_KEY, height: 1.8 };
  sounds.length = 0;
  for (let k = 0; k < 13 * 60; k++) span.ride(600 + k / 60, 1 / 60, over, true);
  const winds = sounds.filter((q) => q.rec === SD_STEPS_SOUNDS.moan);
  assert.equal(winds.length, 2, 'AmbientWindMoanDeep once a gust');
  assert.ok(winds.every((q) => q.vol === 0.9) && sounds.filter((q) => q.rec === SD_STEPS_SOUNDS.clack && q.pitch === 2.2).length === 2, 'with its clack');
  sounds.length = 0;
  const plate = { pos: realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z), grounded: true, groundKey: EG_FLOOR_KEY, height: 1.8 };
  for (let k = 0; k < 13 * 60; k++) span.ride(700 + k / 60, 1 / 60, plate, true);
  assert.equal(sounds.filter((q) => q.rec === SD_STEPS_SOUNDS.moan).length, 0, 'off the section, nothing');
  void SD_GUST_EVERY;
  span.clear();
});

/** A peer's drawn pose standing on a step's top. */
const peerOn = (spec, s, dy = 0.05) => { const [x, y, z] = realmToDungeon(spec.x0 + s.x, s.y + dy, s.z); return { x, y, z }; };

test('EG-ZL A GHOST SLAB (section 10.8: "a peer on a crumble the viewer has seen fall is drawn on a ghost slab"): a peer\'s drawn feet on a Crumble fallen under my own foot light its ghost\'s top for a few frames - never on a whole Crumble, a foot off its top or a body over it; net/online.js tells `rideAt` of a peer on no ride, never moving it; the breach client hands the word to the spans; the ghosts\' pass built once with the Spire\'s floor and freed at the clear; the hosts\' seams (mutants: a whole Crumble slabbed; the slab held for ever; the height band dropped; no word for a peer on no ride; the client deaf to it; the pass never freed; no ghosts drawn; the pass without its floor)', () => {
  const { seed, c, spec, s } = findStep((q) => q.kind === 'crumble');
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4, ARRAY_BUFFER: 1, FLOAT: 5, STATIC_DRAW: 7, drawingBufferHeight: 720, drawingBufferWidth: 1280 }, { get: (t, k) => (k in t ? t[k] : (...args) => { calls.push([k, ...args]); if (k === 'getProgramParameter' || k === 'getShaderParameter') return true; if (k === 'getUniformLocation') return args[1]; return {}; }) });
  const R = { ...plainRenderer(), gl };
  const { span } = stood(seed, c, R);
  const p = peerOn(spec, s), T0 = 50;
  span.ride(T0, 0.016, null, false);
  assert.equal(span.peerOn(p.x, p.y, p.z), false, 'a whole Crumble: the peer stands on it');
  const foot = { pos: realmToDungeon(spec.x0 + s.x, s.y, s.z), grounded: true, groundKey: egStepKey(spec.h, s.i), height: 1.8 }, away = { pos: [0, 999, 0], grounded: false, groundKey: null, height: 1.8 };
  span.ride(T0 + 0.01, 0.016, foot, true);
  span.ride(T0 + SD_CRUMBLE_DELAY + 0.5, 0.016, away, true);
  const gi = span.ghosts.of.findIndex((q) => q.h === spec.h && q.i === s.i);
  assert.equal(span.ghosts.state[gi * 4 + 3], 0, 'fallen, nobody on it: no slab');
  assert.equal(span.peerOn(p.x, p.y, p.z), true, 'fallen under my foot, a peer on it');
  span.ride(T0 + SD_CRUMBLE_DELAY + 0.52, 0.016, away, true);
  assert.ok(near(span.ghosts.state[gi * 4 + 3], EG_GHOST_SLAB.fill, 1e-6), 'its slab lit');
  span.ride(T0 + SD_CRUMBLE_DELAY + 0.52 + EG_GHOST_SLAB.hold + 0.05, 0.016, away, true);
  assert.equal(span.ghosts.state[gi * 4 + 3], 0, 'the word not said again: let go');
  const off = peerOn(spec, { ...s, x: s.x + s.w / 2 + 0.6 }), high = peerOn(spec, s, 1.2);
  assert.equal(span.peerOn(off.x, off.y, off.z), false, 'a foot off its top');
  assert.equal(span.peerOn(high.x, high.y, high.z), false, 'a body over it');
  // the pass: built once with the Spire's floor, drawing the ghosts, freed at the clear
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(span.drawPass(I, I, null), true, 'the ghost drawn');
  span.drawPass(I, I, null);
  assert.equal(calls.filter((q) => q[0] === 'createProgram').length, 1, 'built once');
  assert.ok(calls.some((q) => q[0] === 'uniform3f' && q[1] === 'uFogFloor' && q[2] === EG_FOG_FLOOR.floor), 'the Spire\'s fog floor');
  span.clear();
  assert.ok(['deleteBuffer', 'deleteVertexArray', 'deleteProgram'].every((k) => calls.some((q) => q[0] === k)), 'freed at the clear');
  assert.equal(span.drawPass(I, I, null), false, 'nothing after');
  // net/online.js: a peer on no ride told, never moved - a ridden one still moved on its copy
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {};
  try {
    o.join('eg:0123456789abcdef', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 }); sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: { x: 10, y: 2, z: 30, yaw: 0, pitch: 0, mv: 0 } }], host: null, world: null });
    const told = [];
    o.rideAt = (q) => { told.push(q); if (Array.isArray(q.pl)) q.x += 1; };
    now += 10; o.tick();
    const eve = o.peers.get('eve-0003');
    assert.equal(told.length, 1, 'a peer on no ride told');
    assert.equal(told[0], eve.shown, 'its drawn pose itself');
    assert.deepEqual([eve.shown.x, eve.shown.y, eve.shown.z], [10, 2, 30], 'never moved');
  } finally { console.info = info; console.warn = warn; }
  // the breach client: a peer on no ride handed to the spans (the dungeon context's seam)
  const told = [];
  const C = breachClient({ egSpanPeer: (x, y, z) => { told.push([x, y, z]); return true; } });
  try {
    C.client.frame();
    C.online.rideAt({ x: 1, y: 2, z: 3 });
    assert.deepEqual(told, [[1, 2, 3]], 'handed to the spans');
  } finally { C.done(); }
  const D = readFileSync(new URL('../../../src/scenes/dungeonContext.js', import.meta.url), 'utf8'), E = readFileSync(new URL('../../../src/scenes/eliteGates/egClient.js', import.meta.url), 'utf8');
  assert.match(D, /egSpanDraw\(proj, view, fog\) \{ return !!egSpan\?\.drawPass\(proj, view, fog\); \}/);
  assert.match(D, /egSpanPeer\(x, y, z\) \{ return !!egSpan\?\.peerOn\(x, y, z\); \}/);
  assert.match(E, /const ghosts = !!modes\(\)\?\.dungeonCtx\?\.egSpanDraw\?\.\(proj, view, fog\);[^\n]*\n\s*const over = [^\n]*\n[^\n]*\n\s*return painted \|\| under \|\| air \|\| drew \|\| ghosts \|\| over \|\| lit;/, 'the client\'s pass draws them, before the lines');   // PIN MOVED (EG-LOOK SKY+AIR): the pass answers the sky's paint and THE AIR too
});

/** A breach client inside a span's trial (test/net/eliteGates/egint_client.test.js's harness, its dungeon context `ctx`). */
function breachClient(ctx = {}) {
  const realNow = Date.now, ME = 'acct-0', T0 = 1_800_000_000_000;
  let clock = T0 + EG_SEALED_MS + 60_000;
  const wall = clock - 4000;
  Date.now = () => wall;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 12345, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = 2; B.sg = 'trial'; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const spec = egHallOf(12345, 2, 0);
  const player = { pos: realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => 1, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [], ...ctx } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: () => true };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {} });
  client.word(validEgOut(JSON.parse(JSON.stringify(egStateOf(B, clock)))));
  void dungeonToRealm;
  return { client, online, done: () => { Date.now = realNow; } };
}

test('EG-ZL THE RAIL\'S TRACK TICKED AT EACH END AND A DROP\'S WALL LIT (section 10.3: "a dashed gold track between its plates, ticked at each end"; "the landing\'s edge line, gold; the wall\'s face lit"): across each side\'s track at each end of its travel a tick one dash long, at the track\'s own depth; a lamp over each Drop\'s landing before its far wall\'s face, up its wall, in the Spire\'s own light (mutants: no ticks; a tick at one end; a tick past a dash; no lamp; a lamp behind the wall)', () => {
  let ticked = 0, lit = 0;
  for (const seed of [7, 99]) for (let c = 1; c <= 20; c++) {
    const specs = egCircleSpecs(seed, c, 0), e = egCircleEdges(seed, c, 0), segs = [];
    for (let i = 0; i < e.track.length; i += 6) segs.push([[e.track[i], e.track[i + 1], e.track[i + 2]], [e.track[i + 3], e.track[i + 4], e.track[i + 5]]]);
    for (const spec of specs) for (const s of spec.steps) {
      if ((s.kind !== 'rail' && s.kind !== 'drum') || !(s.amp > 0)) continue;
      const y = s.y - EG_TRACK.under;
      for (const side of [-1, 1]) for (const z of [s.z - s.amp - s.d / 2, s.z + s.amp + s.d / 2]) {
        const mid = egToDungeon(spec, s.x + side * (s.w / 2 - 0.2), y, z);
        const tick = segs.find(([a, b]) => near(a[2], mid[2]) && near(b[2], mid[2]) && near((a[0] + b[0]) / 2, mid[0]) && near(a[1], mid[1]));
        assert.ok(tick, `hall ${spec.h} step ${s.i}: ticked at z ${z.toFixed(2)}`);
        assert.ok(near(Math.abs(tick[1][0] - tick[0][0]), EG_TRACK.dash), 'one dash long');
        ticked++;
      }
    }
    const lamps = egCircleLights(seed, c, 0);
    for (const spec of specs) for (const s of spec.steps) {
      if (s.kind !== 'drop') continue;
      const want = egToDungeon(spec, s.x, s.y + EG_DROP_LAMP.h, s.z + s.d / 2 - EG_DROP_LAMP.off), l = lamps.find((q) => near(q.x, want[0]) && near(q.y, want[1]) && near(q.z, want[2]));
      assert.ok(l, `hall ${spec.h}: its Drop's wall lit`);
      assert.deepEqual([l.color, l.range], [[...EG_LAMP.color], Number(EG_LAMP.range)]);
      const wall = egToDungeon(spec, s.x, s.y, s.z + s.d / 2)[2];
      assert.ok(l.z < wall && wall - l.z <= 2 && EG_DROP_LAMP.h < EG_DROP_WALL_H, 'over the landing, before its far wall\'s face, up the wall');
      lit++;
    }
  }
  assert.ok(ticked >= 8 && lit >= 2, `${ticked} ticks, ${lit} Drop walls lit`);
});
