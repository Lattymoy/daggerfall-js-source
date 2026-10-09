// SD20c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "SD20 - AUDIT SD III"): THE HOUR
// SEEN, AUDITED A THIRD TIME - each finding measured on the arc's own scripts before it was fixed. The blows' spent sparks
// piled on panes in the air; the Hour-Hand's beam passed over the heads of the bodies the law struck, a third of the band
// it sweeps; the whole arena's shakes kicked the Hall and the Steps; a blow over my feet made 7-32 KB a frame, the beam
// 3.4 KB, the gears 1.7 KB, a Volley's mark 3 KB; the bodies faced each new aim in a frame, and a lost fight's body stood
// at its start at once; the brass air met the sky a step apart at the skyline; the gears flew flat whichever way they
// were thrown; the passes compiled in the frame of the first blow; reversed smoothstep edges; the brass light made a
// list every outdoor frame. The findings that moved older pins are the bible's PINS MOVED.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { glslFunctions } from './glsl.mjs';
import { createSdFx, SD_FX_KINDS, SD_FX_FLOOR_Y, SD_SHAKE } from '../src/scenes/sdFx.js';
import {
  SD_BLOWS, SD_BODY, SD_ARENA_SLACK, SD_PILLARS, SD_REM, SD_ECHO, SD_REM_START, SD_BREAK_MS,
  handSwept, behindPillar, keepInArena, inArena, blowShape,
} from '../src/net/sdRemnant.js';
import { SD_ARENA, SD_PILLAR_W, realmToDungeon } from '../src/net/sdBrain.js';
import { sdBodyAt } from '../src/net/sdFightLink.js';
import { handSweepOf, handSweepHas, sdWayOut, sdPerilAt } from '../src/scenes/sdArenaRead.js';
import { sdGearsAt, gearMatrix, sdBeamDraws, sdBeamsAt, sdKeptList } from '../src/scenes/sdRemnantRig.js';
import { SdBeamRenderer, SD_BEAM_VS, SD_BEAM_FS, SD_BEAM_W, SD_BEAM_MAX, SD_BEAM_MIN_RAD } from '../src/render/sdBeam.js';
import { SD_SKY_VS, SD_SKY_FS, SD_SKY_PAINT_FS } from '../src/render/sdSky.js';
import { createSdRemnant, remnantPose, echoPose, sdTurnToward, SD_TURN_RATE, SD_REM_SINK_MS, SD_ECHO_SINK_MS } from '../src/scenes/sdRemnant.js';
import { createSdRemnantBlows } from '../src/scenes/sdRemnantBlows.js';
import { SD_BRASS_GLSL, SD_BRASS_RAMP, sdBrassGrade } from '../src/world/sdBrassSky.js';
import { sdBrassLight, SD_BRASS_TINT } from '../src/systems/sdOmen.js';
import { realmLightsWith, SD_LIGHTS_CAP } from '../src/world/sdRealm.js';
import { wrapYaw } from '../src/net/gateBrain.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const W = read('src/scenes/world.js');
const T0 = 1_800_000_000_000;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const nearV = (a, b, e = 1e-9) => a.length === b.length && a.every((v, i) => near(v, b[i], e));
const at = (x, y, z) => realmToDungeon(SD_ARENA.x + x, y, SD_ARENA.z + z);
const blow = (A, i, landAt, more = {}) => ({ k: 'atk', b: SD_BODY.remnant, i, a: A.id, at: landAt, x: 0, z: 0, yw: 0, tg: [], ...more });
/** A fight, its Remnant at (0, 0) facing +z, awake a minute. */
const fight = (over = {}) => ({ fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, ...over });
/** The blows seen (scenes/sdFx.js) on a fight the test turns, a clock it moves, a camera that shakes; my feet in the
 *  arena's frame (null: out of the Hour). */
function rig(over = {}) {
  let t = T0, feet = null;
  const s = fight(over), shakes = [];
  const fx = createSdFx({ link: { state: () => s, now: () => t }, feet: () => (feet ? at(feet[0], 0, feet[1]) : null), shake: (k) => shakes.push(k) });
  return { s, fx, shakes, step: (ms = 16) => { t += ms; fx.frame(); }, at: () => t, setFeet: (f) => { feet = f; } };
}

test('SD20c THE SPARKS COME TO REST ON THE ARENA\'S FLOOR (V1): every burst the Hour throws says where its floor is - the arena\'s, in the dungeon\'s frame - so its spent sparks lie on the floor under it; eleven of the seventeen kinds said none, and the gate\'s pass rested those at their own height, panes of spent sparks 1.2-4.4 m in the air (mutant: the floor unsaid)', () => {
  assert.equal(SD_FX_FLOOR_Y, realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z)[1]);
  const r = rig({ ph: 2, ec: [{ h: 0, m: 100, up: T0, dn: 0, x: -6, z: 0, yw: 0, mv: null, atk: null }] });
  r.fx.frame();
  r.s.su = T0 + 9000;   // the stun, at its chest
  r.s.cx = { i: 7, m: 50, c: [[6, 0, 50]] };   // a Heart risen, 1.2 m up
  r.s.ec = [{ ...r.s.ec[0], h: 100 }];   // an Echo risen, at its middle
  r.s.clk = { ...blow(SD_BLOWS.pulse, 3, T0 + 10), b: SD_BODY.hour };   // the Pulse, 2 m over the arena's heart
  r.step(20);
  const seen = r.fx.bursts(r.at()), kinds = seen.map((b) => Object.keys(SD_FX_KINDS).find((k) => SD_FX_KINDS[k] === b.kind));
  assert.deepEqual(kinds.sort(), ['echoRise', 'heartRise', 'pulse', 'stun']);
  for (const b of seen) {
    assert.equal(b.floor, SD_FX_FLOOR_Y, 'on the arena\'s floor');
    assert.ok(b.at[1] - b.floor > 1, 'thrown from over it');
  }
  // the gate's pass: a burst's sparks rest on its floor when it says one - at its own height when it does not
  assert.match(read('src/render/gateFx.js'), /gl\.uniform1f\(S\.uFloor, Number\.isFinite\(b\.floor\) \? b\.floor : b\.at\[1\]\);/);
});

test('SD20c THE WHOLE ARENA\'S SHAKES ARE THE ARENA\'S (V4): the Pulse, the Reset, the End - blows that strike the whole arena and nobody off it - shake only a camera whose feet stand on it (its rim\'s slack the law\'s, SD_ARENA_SLACK); in the Hall or on the Steps, nothing; a blow with a reach still shakes by how near it fell, wherever I stand (mutant: felt anywhere in the Hour)', () => {
  const rim = SD_ARENA.r + SD_ARENA_SLACK;
  for (const [A, k] of [[SD_BLOWS.pulse, 'pulse'], [SD_BLOWS.end, 'end']]) {
    for (const [x, want] of [[rim - 0.5, [SD_SHAKE[k][0]]], [rim + 0.5, []], [0, [SD_SHAKE[k][0]]]]) {
      const r = rig(); r.fx.frame(); r.setFeet([x, 0]);
      r.s.clk = { ...blow(A, 3, T0 + 10), b: SD_BODY.hour }; r.step(20);
      assert.deepEqual(r.shakes, want, `${k} with my feet ${x} m out`);
      assert.equal(r.fx.bursts(r.at()).length, 1, 'seen wherever I stand');
    }
  }
  const off = rig({ ph: 3 }); off.fx.frame(); off.setFeet([0, rim + 4]);
  off.s.rem.atk = blow(SD_BLOWS.reset, 5, T0 + 10); off.step(20);
  assert.deepEqual(off.shakes, [], 'the Reset, from the Steps: nothing');
  // a Stomp at the arena's rim, my feet just past it: shaken by how near it fell, as the gate's landings shake
  const st = rig(); st.fx.frame(); st.setFeet([rim + 1, 0]);
  st.s.rem.atk = blow(SD_BLOWS.stomp, 6, T0 + 10, { x: SD_ARENA.r - 1, z: 0 }); st.step(20);
  const d = rim + 1 - (SD_ARENA.r - 1);
  assert.equal(st.shakes.length, 1);
  assert.ok(near(st.shakes[0], SD_SHAKE.stomp[0] * (1 - d / SD_SHAKE.stomp[1]), 1e-6));
});

/** A GL that records what the beam's pass says: each uniform's last word, and at each draw the words standing. */
function beamGl() {
  const now = {}, draws = [];
  const gl = { BLEND: 1, ONE: 1, CULL_FACE: 2, TRIANGLES: 4, drawArrays: () => draws.push({ ...now }) };
  for (const m of ['uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform2fv', 'uniform3fv']) gl[m] = (u, ...v) => { now[u] = v.length === 1 ? v[0] : v; };
  for (const m of ['useProgram', 'uniformMatrix4fv', 'bindVertexArray', 'enable', 'disable', 'blendFunc', 'depthMask']) gl[m] = () => {};
  const names = ['uVP', 'uA', 'uB', 'uW', 'uMinRad', 'uEye', 'uCore', 'uGlow', 'uAlpha', 'uTime', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFlat'];
  const pass = Object.assign(Object.create(SdBeamRenderer.prototype), { gl, u: Object.fromEntries(names.map((n) => [n, n])), _vp: new Float32Array(16), count: 48, drawn: 0, vao: {} });
  return { pass, draws };
}

test('SD20c THE HOUR-HAND\'S BAND ON THE FLOOR (V2): each beam drawn twice - the light out of its hand (a ribbon to the floor, SD_BEAM_W across, facing the eye) and the band it sweeps laid flat on the floor from its body\'s rim to its reach, the law\'s whole width across, level, never narrowed or widened by the eye; the law strikes a body within half that width of the bearing - the ribbon\'s 0.55-1.6 m passed over the heads of bodies the 3 m band struck; the band\'s int uniform one precision across the stages, or the program never links (mutants: the band never drawn; drawn at the ribbon\'s width; turned to the eye)', () => {
  const A = SD_BLOWS.hand, s = fight({ rem: { x: 0, z: 0, yw: Math.PI, mv: null, atk: blow(A, 1, T0, { yw: Math.PI, sw: 1 }) } });
  const [g] = sdBeamDraws(s, T0 + A.active / 2), [law] = sdBeamsAt(s, T0 + A.active / 2);
  assert.equal(g.w, A.width, 'the law\'s width');
  assert.ok(nearV(g.f0, at(law.f0[0], law.f0[1], law.f0[2])) && nearV(g.f1, at(law.f1[0], law.f1[1], law.f1[2])), 'from its rim to its reach, on the floor');
  const { pass, draws } = beamGl();
  assert.equal(pass.draw([g], new Float32Array(16), new Float32Array(16), [0, 2, 0], 1, null), true);
  assert.equal(draws.length, 2);
  assert.deepEqual([draws[0].uFlat, draws[0].uW, draws[0].uA, draws[0].uB], [0, [...SD_BEAM_W], [...g.a], [...g.b]], 'the ribbon: hand to floor');
  assert.deepEqual([draws[1].uFlat, draws[1].uW, draws[1].uA, draws[1].uB], [1, [g.w, g.w], [...g.f0], [...g.f1]], 'the band: rim to reach, its width whole');
  // a beam with no band drawn as it was; at most SD_BEAM_MAX; one unplaced passed over
  const two = beamGl();
  two.pass.draw([{ a: g.a, b: g.b, alpha: 1 }, { a: [NaN, 0, 0], b: g.b, alpha: 1 }, g, g, g], new Float32Array(16), new Float32Array(16), null, 1, null);
  assert.deepEqual(two.draws.map((d) => d.uFlat), [0, 0, 1, 0, 1]);
  assert.equal(two.pass.drawn, SD_BEAM_MAX);
  // the band, as the vertex stage lays it: level across the floor, its width whole however far the eye
  const f0 = [0, 0.04, 2], f1 = [0, 0.04, 30], I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const lay = (aP, flat, eye) => { const v = glslFunctions(SD_BEAM_VS, { aP, uVP: I, uA: f0, uB: f1, uW: [3, 3], uMinRad: SD_BEAM_MIN_RAD, uEye: eye, uFlat: flat }); v.main(); return v.globals.vWorld; };
  for (const eye of [[0, 2, 16], [40, 3000, 16]]) {   // the far one past the ribbon's min-angle: 0.003 x 3000 m is 9 m
    const L = lay([-1, 0.5], 1, eye), R = lay([1, 0.5], 1, eye);
    assert.ok(near(L[1], 0.04, 1e-9) && near(R[1], 0.04, 1e-9), 'level on the floor');
    assert.ok(near(Math.hypot(R[0] - L[0], R[2] - L[2]), 3, 1e-9) && near(R[2] - L[2], 0, 1e-9), 'across its length, its width whole');
  }
  const far = [lay([-1, 0.5], 0, [400, 2, 16]), lay([1, 0.5], 0, [400, 2, 16])];
  assert.ok(Math.hypot(far[1][0] - far[0][0], far[1][1] - far[0][1], far[1][2] - far[0][2]) > 1.075 + 0.1, 'the ribbon widened for a far eye (its min-angle) - the band never');
  // its int uniform: highp in the fragment stage as the vertex stage's default - a uniform's precision is one across
  // the program, or it does not link (render/sdBeam.js, found by tools/sdBodyProbe.mjs)
  assert.match(SD_BEAM_VS, /\nuniform int uFlat;/);
  assert.match(SD_BEAM_FS, /\nuniform highp int uFlat;/);
});

test('SD20c THE BODIES TURN AND KNEEL AS BODIES DO (V6): a drawn facing turned to the law\'s at SD_TURN_RATE, the short way round - it faced each new aim in a frame, up to 120 degrees at once; shown afresh, a body stands as it faces; a LOST fight\'s Remnant sinks where it stood and rises again at its start (it stood there at once), an Echo standing as it is lost sinks where it stood (mutants: turned in a frame; the long way round; the lost fight\'s body at its start)', () => {
  assert.equal(sdTurnToward(NaN, 1.2, 1 / 60), 1.2, 'shown afresh: as it faces');
  assert.ok(near(sdTurnToward(0, 2, 0.1), SD_TURN_RATE * 0.1), 'a step a frame');
  assert.ok(near(sdTurnToward(3, -3, 0.05), wrapYaw(3 + SD_TURN_RATE * 0.05)), 'across the wrap: the short way');
  assert.equal(sdTurnToward(1, 1.1, 0.1), 1.1, 'within a step: there');
  assert.ok(near(sdTurnToward(-1, -2, 0.1), -1 - SD_TURN_RATE * 0.1), 'either way');
  // the set: its Remnant faces 0, then the law turns it 120 degrees
  const draws = [];
  const renderer = { createMesh: () => ({}), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} };
  const S = fight();
  const set = createSdRemnant({ renderer, link: () => ({ state: () => S, now: () => T0, inDue: () => false, sentIn() {}, joined: () => true }) });
  set.stand({ dynamicDraws: draws });
  const yawOf = () => Math.atan2(draws[0].object.matrix[8], draws[0].object.matrix[0]);
  set.frame(1 / 60, null);
  assert.ok(near(yawOf(), 0, 1e-6));
  S.rem.yw = (2 * Math.PI) / 3;
  set.frame(1 / 60, null);
  assert.ok(near(yawOf(), SD_TURN_RATE / 60, 1e-6), `a frame's turn: ${yawOf().toFixed(4)}`);
  for (let f = 0; f < 60; f++) set.frame(1 / 60, null);
  assert.ok(near(yawOf(), (2 * Math.PI) / 3, 1e-6), 'turned to it inside a second');
  // a lost fight: where it stood, sinking; then at its start, rising
  const lost = fight({ lost: T0, rem: { x: 9, z: -4, yw: 1, mv: null, atk: null } });
  const p = remnantPose(lost, T0 + SD_REM_SINK_MS / 2);
  assert.deepEqual([p.x, p.z, p.yw, p.shown], [9, -4, 1, true]);
  assert.ok(near(p.sink, SD_REM.h / 2), 'half sunk where it stood');
  const q = remnantPose(lost, T0 + SD_REM_SINK_MS + SD_BREAK_MS / 2);
  assert.deepEqual([q.x, q.z, q.shown], [SD_REM_START[0], SD_REM_START[1], true]);
  assert.ok(near(q.sink, SD_REM.h / 2), 'half risen at its start');
  assert.equal(remnantPose(lost, T0 + SD_REM_SINK_MS + SD_BREAK_MS + 1).sink, 0);
  const lostOut = fight({ ph: 2, lost: T0, ec: [{ h: 50, m: 100, up: T0 - 9000, dn: 0, x: 6, z: 2, yw: 0.5, mv: null, atk: null }] });
  const e = echoPose(lostOut, 0, T0 + SD_ECHO_SINK_MS / 2);
  assert.deepEqual([e.x, e.z, e.yw, e.shown], [6, 2, 0.5, true]);
  assert.ok(near(e.sink, SD_ECHO.h / 2), 'the Echo half sunk where it stood');
});

test('SD20c THE GEARS FLY ON EDGE ALONG THEIR FLIGHT (V12): each gear stood in its flight\'s bearing and the vertical - its axle level and square to its flight - and spun as a wheel rolls forward: it flew flat to the arena\'s z whichever way it was thrown; the set stands each as the rig says (mutants: the bearing unread; spun backward)', () => {
  const vw = SD_BLOWS.volley.windup, tg = [[3, 9], [-6, 8], [10, -2], [-11, -4], [0, 14]];
  const s = fight({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: blow(SD_BLOWS.volley, 2, T0 + vw, { tg }) } });
  const t = T0 + vw - 100, gears = sdGearsAt(s, t);
  assert.equal(gears.length, tg.length);
  for (let i = 0; i < gears.length; i++) {
    const q = gears[i], m = gearMatrix(q.x, q.y, q.z, q.spin, new Float32Array(16), q.yaw);
    const fwd = [Math.sin(q.yaw), Math.cos(q.yaw)];
    const toMark = [tg[i][0] - q.x, tg[i][1] - q.z], d = Math.hypot(...toMark);
    assert.ok(near(fwd[0] * toMark[1] - fwd[1] * toMark[0], 0, 1e-6 * d) && fwd[0] * toMark[0] + fwd[1] * toMark[1] > 0, 'its bearing its mark\'s');
    const axle = [m[8], m[9], m[10]];
    assert.ok(near(axle[1], 0, 1e-6) && near(axle[0] * fwd[0] + axle[2] * fwd[1], 0, 1e-6), 'its axle level, square to its flight');
    const top = (spin) => { const n = gearMatrix(0, 0, 0, spin, new Float32Array(16), q.yaw); return [n[4], n[5], n[6]]; };   // its disc's (0, 1, 0)
    const a = top(0), b = top(0.01);
    assert.ok(near(a[1], 1, 1e-9) && (b[0] - a[0]) * fwd[0] + (b[2] - a[2]) * fwd[1] > 0.009, 'unspun, it stands upright, and its top rolls forward as it spins');
  }
  assert.match(read('src/scenes/sdRemnant.js'), /gearMatrix\(q\.x, q\.y, q\.z, q\.spin, d\.object\.matrix, q\.yaw\); d\.hidden = false;/);
});

test('SD20c THE BRASS AIR\'S GRADE ON THE SKY IS ITS HAZE\'S (V8): world/sdBrassSky.js\'s GLSL is its JS - generated from the same stops and weights, run here on the code the GPU runs and equal to sdBrassGrade over the colours a sky shows and every weight; each of the four passes that draw the sky (the classic, the enhanced, the dynamic, the clouds\' composite) includes it, grades its final colour by its own uBrass after the dread\'s, and uploads the weight the controller sets - the fogged land met the sky a step apart at the skyline (15/-4/-34 a clear noon); the water\'s sky graded as the sky over it (mutants: the sky ungraded; the ramp drifted)', () => {
  const brassGrade = glslFunctions(SD_BRASS_GLSL).brassGrade;
  const skies = [[0.62, 0.74, 0.92], [0.35, 0.38, 0.42], [0.95, 0.55, 0.3], [0.05, 0.06, 0.1], [0.5, 0.5, 0.5], [0.9, 0.92, 0.95], [0.2, 0.45, 0.8]];
  for (const c of skies) {
    for (const w of [0, 0.15, 0.4, 0.55, 1]) {
      const js = sdBrassGrade(c, w), gpu = brassGrade(c, w);
      assert.ok(nearV(gpu, js, 2e-4), `${c} at ${w}: ${gpu.map((v) => v.toFixed(4))} for ${js.map((v) => v.toFixed(4))}`);
    }
  }
  assert.ok(SD_BRASS_RAMP.every((st) => SD_BRASS_GLSL.includes(`vec3(${st.color.map((v) => v.toFixed(4)).join(', ')})`)), 'its stops');
  const passes = {
    'src/render/skyRenderer.js': /outColor = vec4\(brassGrade\(dreadGrade\(mix\(color, uFogColor, uFogMix\), uDread\), uBrass\), 1\.0\);/,
    'src/render/enhancedSky.js': /outColor = vec4\(brassGrade\(dreadGrade\(out3, uDread\), uBrass\), 1\.0\);/,
    'src/render/dynamicSkiesRenderer.js': /outColor = vec4\(brassGrade\(dreadGrade\(enc, uDread\), uBrass\), 1\.0\);/,
    'src/render/volumetricClouds.js': /vec3 cloud = op > 1e-4 \? brassGrade\(dreadGrade\(c\.rgb \/ op, uDread\), uBrass\) \* op : c\.rgb;/,
  };
  for (const [p, last] of Object.entries(passes)) {
    const src = read(p);
    assert.match(src, /import \{ SD_BRASS_GLSL \} from '\.\.\/world\/sdBrassSky\.js';/, p);
    assert.match(src, /\nuniform float uBrass;[^\n]*\n[\s\S]*?\$\{SD_BRASS_GLSL\}/, `${p}: its uniform and the grade`);
    assert.match(src, last, `${p}: its final colour graded after the dread's`);
    assert.match(src, /this\.brass = 0;/, `${p}: none until it is said`);
    assert.match(src, /gl\.uniform1f\((?:u\.|this\.)uBrass, this\.brass\);/, `${p}: the weight uploaded`);
  }
  const sh = read('src/scenes/shared.js');
  assert.match(sh, /const brassed = \(ws\) => \(brassW > 0 \? \{ \.\.\.ws, zenith: sdBrassGrade\(ws\.zenith, brassW\), horizon: sdBrassGrade\(ws\.horizon, brassW\) \} : ws\);\n\s+const dreaded = \(ws\) => brassed\(/, 'the water\'s sky');
  // the skyline: the haze graded in JS, the sky in GLSL - one colour at the horizon either side
  for (const c of skies) { const w = 0.55; assert.ok(nearV(brassGrade(c, w), sdBrassGrade(c, w), 2e-4)); }
});

/** Each smoothstep's two edges in a built shader - as numbers where both are numbers (a sum of literals is one), else null. */
function smoothEdges(glsl) {
  const out = [];
  for (const m of glsl.matchAll(/smoothstep\(/g)) {
    const args = [];
    let depth = 0, arg = '';
    for (let i = m.index + m[0].length; i < glsl.length; i++) {
      const ch = glsl[i];
      if (ch === '(') depth++;
      else if (ch === ')') { if (depth === 0) { args.push(arg); break; } depth--; }
      else if (ch === ',' && depth === 0) { args.push(arg); arg = ''; continue; }
      arg += ch;
    }
    const num = (e) => (/^[\d.\s+\-*/()]+$/.test(e) ? Number(Function(`return (${e});`)()) : null);
    out.push([num(args[0]), num(args[1]), args.slice(0, 2).join(',')]);
  }
  return out;
}

test('SD20c NO REVERSED SMOOTHSTEP IN ANY SHADER (V14): GLSL leaves smoothstep(a, b, x) undefined for a >= b - the beam\'s ends, the Hour\'s shards and clock, and ten more across the port (the Deadlands\' horizon and channels, the sky\'s near horizon, the gate veil\'s sparks, the ink dungeon\'s hatching, the sun baby\'s skin, shadow and horns) rose on drivers that honour the order and nowhere the spec promises; every one now rises, its fall written 1 - smoothstep - read in the source of every module, and in the Hour\'s shaders as they are built, their tables\' numbers in them (mutants: an edge reversed, a literal\'s and a table\'s)', () => {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true }).filter((f) => String(f).endsWith('.js'));
  let read1 = 0;
  for (const f of files) {
    const src = read(join('src', String(f)));
    for (const c of src.matchAll(/smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g)) { read1++; assert.ok(Number(c[1]) < Number(c[2]), `${f}: ${c[0]}`); }
  }
  assert.ok(read1 > 150, `${read1} read`);
  for (const [name, glsl] of [['the beam', SD_BEAM_VS + SD_BEAM_FS], ['the sky', SD_SKY_VS + SD_SKY_FS + SD_SKY_PAINT_FS]]   /* SD-LOOK (PIN MOVED): its paint holds its horizon and its face */) {
    const edges = smoothEdges(glsl), told = edges.filter(([a, b]) => a !== null && b !== null);
    assert.ok(told.length >= 5, `${name}: ${told.length} of ${edges.length} read`);   // SD-LOOK (PIN MOVED): the sky's five, now its paint's (it had six)
    for (const [a, b, src] of told) assert.ok(a < b, `${name}: smoothstep(${src}, ...)`);
  }
});

test('SD20c THE BRASS LIGHT MAKES NOTHING WITHOUT THE BRASS (V15): with no brass air the light the world hands in is the light handed back - the same array - and every outdoor frame made a list of it, near a Hollow or not; with brass, a new one leaned toward the tint (mutant: a list made at nought)', () => {
  const rgb = new Float32Array([0.5, 0.6, 0.7]);
  assert.equal(sdBrassLight(rgb, 0), rgb);
  assert.equal(sdBrassLight(rgb, NaN), rgb);
  const w = 0.5, lit = sdBrassLight(rgb, w);
  assert.notEqual(lit, rgb);
  assert.ok(nearV([...lit], [0, 1, 2].map((i) => Math.fround(rgb[i] * (1 + (SD_BRASS_TINT[i] - 1) * w))), 1e-6));
  assert.deepEqual([...rgb], [...new Float32Array([0.5, 0.6, 0.7])], 'never written');
  assert.ok(sdBrassLight([0.5, 0.6, 0.7], 0) instanceof Float32Array, 'a plain list answered as the light a renderer takes');
});

test('SD20c THE HOUR\'S PASSES BUILT AS IT IS STOOD IN (V13): the beam\'s, the sparks\' and the floor\'s telegraph compiled once as the Hour is first entered - each was built on its first use, a stall in the frame its first blow landed in; a pass that will not build is tried once, never again in a fight\'s frame (mutants: never warmed; warmed each frame)', () => {
  const warns = [], warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    let asked = 0;
    const gl = new Proxy({}, { get: () => { asked++; throw new Error('no context here'); } });
    const fx = createSdFx({ link: { state: () => null, now: () => T0 } });
    fx.warm(null);
    assert.equal(asked, 0, 'no context: nothing tried');
    fx.warm(gl);
    assert.ok(asked > 0 && warns.length === 1, 'built (and refused) as the Hour is stood in');
    const was = asked;
    fx.warm(gl);
    const r = rig(); r.fx.frame();
    assert.equal(asked, was, 'tried once');
    const blows = createSdRemnantBlows({ gl, link: { state: () => null, now: () => T0 } });
    blows.warm();
    assert.ok(asked > was && warns.length === 2, 'the telegraph\'s too');
  } finally { console.warn = warn; }
  assert.match(W, /let _sdPassesWarm = false;\n\s+const sdFightFrame = \(\) => \{/);
  assert.match(W, /if \(inRealm && !_sdPassesWarm\) \{ _sdPassesWarm = true; sdBeamPassOf\(\); sdFx\?\.warm\?\.\(renderer\.gl\); sdBlows\?\.warm\?\.\(\); \}/);
  assert.ok(W.indexOf('if (inRealm && !_sdPassesWarm)') < W.indexOf('if (inRealm) { try { sdBlows?.frame(); }'), 'before the frame\'s first blow');
});

test('SD20c A BUSY MOMENT NEVER PUTS OUT THE LAMPS NEAREST ME (V9): past the frame\'s SD_LIGHTS_CAP, the Hour\'s own lights and its lamps are sorted in together by how far the eye stands outside each one\'s reach - twenty landing flashes across the arena went first, and the lamps by the player went dark (mutant: the extras first)', () => {
  const lit = { data: Object.assign(new Float32Array(0), { carried: new Uint8Array(0) }), colors: new Float32Array(0) };
  const eye = at(0, 1.7, 20);
  const flashes = Array.from({ length: 20 }, (_, i) => ({ x: eye[0] - 200 - i * 10, y: eye[1], z: eye[2], range: 6, color: [1, 0.5, 0.2] }));
  const near1 = { x: eye[0] + 1, y: eye[1], z: eye[2], range: 8, color: [0.1, 0.2, 0.3] };
  const wide = { x: eye[0] - 30, y: eye[1], z: eye[2], range: 40, color: [0.3, 0.2, 0.1] };   // far, but I stand in its reach
  const out = realmLightsWith(lit, [...flashes, near1, wide], eye);
  const placed = Array.from({ length: out.data.length / 4 }, (_, i) => [out.data[i * 4], out.data[i * 4 + 2], out.data[i * 4 + 3]]);
  assert.ok(placed.length > SD_LIGHTS_CAP, 'a busy moment');
  assert.ok([placed[0], placed[1]].every((p) => [near1, wide].some((l) => nearV(p, [l.x, l.z, l.range], 1e-4))), 'the lights I stand in, first');
  const edge = (p) => Math.max(0, Math.hypot(p[0] - eye[0], p[1] - eye[2]) - p[2]);
  for (let i = 1; i < placed.length; i++) assert.ok(edge(placed[i - 1]) <= edge(placed[i]) + 1e-3, 'nearest first, by its reach\'s edge');
  const lampsKept = placed.slice(0, SD_LIGHTS_CAP).filter((p) => !flashes.some((f) => near(f.x, p[0], 1e-3) && near(f.z, p[1], 1e-3)));
  assert.ok(lampsKept.length >= 2, `the lamps by the player within the cap: ${lampsKept.length}`);
});

/** The old pillar test (before AUDIT SD III, V5): four lists a pillar a call - the reference the plain one is held to. */
function pillarRef(ox, oz, x, z) {
  const w = SD_PILLAR_W / 2;
  for (const [px, pz] of SD_PILLARS) {
    let t0 = 0, t1 = 1;
    const d = [x - ox, z - oz], o = [ox, oz], lo = [px - w, pz - w], hi = [px + w, pz + w];
    let hit = true;
    for (let k = 0; k < 2 && hit; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) hit = false; continue; }
      let a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) hit = false;
    }
    if (hit && t0 < 1) return true;
  }
  return false;
}

test('SD20c THE SAME LAW IN PLAIN NUMBERS (V5): the arena\'s read walks its own sums - the Hour-Hand\'s ground (handSweepHas) is the law\'s handSwept and its shade, the way out of every shape the same way sdWayOut finds over the law\'s own ground, behindPillar the old four-list test, keepInArena, sdBodyAt and inArena what they answered - over grids of places, moments, sweeps and shapes (mutants: the sweep\'s arc, its width, its shade, a slab of a pillar, a step of a walk)', () => {
  const Ah = SD_BLOWS.hand;
  const sweeps = [
    blow(Ah, 1, T0 + 800, { x: 2, z: -3, yw: 0.4, sw: 1 }),
    blow(Ah, 2, T0 + 800, { x: -5, z: 6, yw: 2.9, sw: -1 }),
    blow(Ah, 3, T0 + 800, { x: 0, z: 0, yw: -2.2, sw: 1, sh: { arc: Ah.arc * 1.4, active: Ah.active * 1.3 } }),
  ];
  let checked = 0, struck = 0;
  for (const atk of sweeps) {
    const S = blowShape(atk) ?? Ah;
    for (const t of [T0, T0 + 800, T0 + 800 + S.active / 2, T0 + 800 + S.active]) {
      for (const over of [false, true]) {
        const H = handSweepOf(atk, S, t, over);
        for (let x = -25; x <= 25; x += 1.7) {
          for (let z = -25; z <= 25; z += 1.7) {
            const law = handSwept(atk, x, z, Math.max(t, atk.at), atk.at + S.active) && (over || !behindPillar(atk.x, atk.z, x, z));
            assert.equal(handSweepHas(H, x, z), law, `(${x}, ${z}) at ${t - T0}${over ? ' over' : ''}`);
            checked++; struck += law ? 1 : 0;
          }
        }
      }
    }
  }
  assert.ok(checked > 10_000 && struck > 1000, `${struck} of ${checked} struck`);
  // the way out: the read's own walks against sdWayOut over the law's ground
  const As = SD_BLOWS.stomp, Av = SD_BLOWS.volley;
  const shapes = [
    [blow(As, 4, T0 + 2000, { x: 1, z: 1 }), (atk) => (x, z) => Math.hypot(x - atk.x, z - atk.z) <= (blowShape(atk) ?? As).r],
    [blow(Av, 5, T0 + 2000, { tg: [[3, 9], [-6, 8], [10, -2], [-11, -4], [0, 14]] }), (atk) => (x, z) => atk.tg.some((q) => Math.hypot(x - q[0], z - q[1]) <= (blowShape(atk) ?? Av).r)],
    [blow(Ah, 6, T0 + 2000, { x: 0, z: 0, yw: 0.6, sw: 1 }), (atk) => (x, z) => handSwept(atk, x, z, atk.at, atk.at + Ah.active) && !behindPillar(atk.x, atk.z, x, z)],
  ];
  const t = T0 + 1900;   // every one winding up
  let ways = 0;
  for (const [atk, inside] of shapes) {
    const s = fight({ rem: { x: 0, z: 0, yw: 0, mv: null, atk } }), law = inside(atk);
    for (let fx = -20; fx <= 20; fx += 2.3) {
      for (let fz = -20; fz <= 20; fz += 2.3) {
        const p = sdPerilAt(s, t, fx, fz, 0.3);
        if (!p) { assert.ok(!law(fx, fz) || fx * fx + fz * fz > SD_ARENA.r * SD_ARENA.r, `(${fx}, ${fz}) in its ground, unread`); continue; }
        const want = sdWayOut(law, fx, fz);
        assert.deepEqual(p.way && { dir: p.way.dir.map((v) => +v.toFixed(12)), m: p.way.m }, want && { dir: want.dir.map((v) => +v.toFixed(12)), m: want.m }, `${atk.a} from (${fx}, ${fz})`);
        ways++;
      }
    }
  }
  assert.ok(ways > 60, `${ways} ways`);
  // the pillars' shade, the arena's keep, a walking body, the arena's floor
  for (let ox = -24; ox <= 24; ox += 3.1) for (let oz = -24; oz <= 24; oz += 3.1) for (const [x, z] of [[11.3, 11.3], [-14, 2], [0, 25], [20, -20], [ox, -oz], [ox + 1e-12, 18]]) assert.equal(behindPillar(ox, oz, x, z), pillarRef(ox, oz, x, z), `(${ox}, ${oz}) to (${x}, ${z})`);
  const two = [0, 0];
  for (const [x, z, r] of [[3, 4, 24], [30, 4, 24], [-40, -30, 25.4], [0, 0, 1]]) {
    const o = keepInArena(x, z, r, two);
    assert.equal(o, two);
    assert.deepEqual([...o], keepInArena(x, z, r));
  }
  const B = { x: 0, z: 0, mv: { x: -9, z: -9, tx: 30, tz: 30, v: 2, at: T0 } };
  for (const t of [T0 - 1, T0 + 1000, T0 + 9000, T0 + 60_000]) assert.deepEqual([...sdBodyAt(B, t, two)], sdBodyAt(B, t));
  for (let x = -30; x <= 30; x += 0.5) for (const z of [0, 7.25, 16.5]) for (const pad of [0, SD_ARENA_SLACK]) assert.equal(inArena(x, z, pad), Math.hypot(x, z) <= SD_ARENA.r + pad);
});

test('SD20c A FRAME OF THE FIGHT MAKES NEXT TO NOTHING (V5) - measured in a child with a 64 MB young space (the least of six windows): the blows seen (a living fight\'s frame, its lights), the Ending\'s stone light, the set (three bodies walking, the Hearts, a Volley\'s gears in flight), the gears, the beam and its pass, the arena read with a blow over my feet (the Hand\'s sweep, the Stomp\'s disc, a Volley\'s mark - its way out asked), the Hour\'s lines past the cap, a walking body, the arena\'s keep, the pillars, the floor; each under its bound, against a control of three numbers into a fresh list a frame, which must show - they made 0.2-32 KB a frame (mutants: each kept list, scratch and walk given up)', () => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    const { createSdFx } = await import(${url('src/scenes/sdFx.js')});
    const { createSdRemnant } = await import(${url('src/scenes/sdRemnant.js')});
    const { sdGearsAt, sdBeamDraws, sdKeptList } = await import(${url('src/scenes/sdRemnantRig.js')});
    const { SdBeamRenderer } = await import(${url('src/render/sdBeam.js')});
    const { sdEndingStoneLight } = await import(${url('src/ui/sdMarksView.js')});
    const { sdPerilAt } = await import(${url('src/scenes/sdArenaRead.js')});
    const { realmLightsWith } = await import(${url('src/world/sdRealm.js')});
    const { sdBodyAt } = await import(${url('src/net/sdFightLink.js')});
    const { SD_BLOWS, SD_BODY, keepInArena, behindPillar, inArena } = await import(${url('src/net/sdRemnant.js')});
    const { sdMarksOf } = await import(${url('src/net/sdMarks.js')});
    const { realmToDungeon } = await import(${url('src/net/sdBrain.js')});
    const T0 = ${T0};
    // the fight's clock as the link hands it: numbers already made, over 300 ms (a call's own argument makes none)
    const clock = Array.from({ length: 4096 }, (_, k) => T0 + 100 + (k % 300)); clock.push('tagged');
    let k = 0;
    const tick = () => clock[(k = (k + 1) & 4095)];
    const bytes = (fn) => {
      for (let f = 0; f < 20000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    const out = {}, sink = [];
    const feet = realmToDungeon(0, 0, 243);
    out.control = bytes(() => { sink[0] = [feet[0] + 0.5, feet[1] + 0.5, feet[2] + 0.5]; });
    const walk = (x, z, tx, tz) => ({ x, z, tx, tz, v: 0.001, at: T0 });
    const echo = (x) => ({ h: 100, m: 100, up: T0 - 60_000, dn: 0, x, z: 0, yw: 0, mv: walk(x, 0, x, 9), atk: null });
    const mk = sdMarksOf(1);
    const live = { fi: 2, ph: 2, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: walk(-9, -9, 9, 9), atk: null }, ec: [echo(-6), echo(6)], clk: null, cx: { i: 3, m: 50, c: [[6, 0, 50], [-6, 0, 50]] }, fell: null, lost: 0, mk };
    let now = T0 + 100;
    const fx = createSdFx({ link: { state: () => live, now: () => now }, feet: () => feet, shake() {} });
    fx.frame();
    out.fxFrame = bytes(() => { now = tick(); fx.frame(); });
    const lit = { ...live, ph: 1, ec: null, cx: null, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null } };
    let lnow = T0;
    const fxl = createSdFx({ link: { state: () => lit, now: () => lnow }, feet: () => feet, shake() {} });
    fxl.frame(); lit.rem.atk = { k: 'atk', b: SD_BODY.remnant, i: 9, a: SD_BLOWS.stomp.id, at: T0 + 10, x: 0, z: 0, yw: 0, tg: [] }; lnow = T0 + 20; fxl.frame();
    out.fxLights = bytes(() => { sink[1] = fxl.lights(tick() - 50); });
    const stone = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0], stone: -1 };
    out.stoneLight = bytes(() => { sink[2] = sdEndingStoneLight(1, tick() / 1000, stone); });
    const vol = { k: 'atk', b: SD_BODY.remnant, i: 2, a: SD_BLOWS.volley.id, at: T0 + 400, x: 0, z: 0, yw: 0, tg: [[3, 9], [-6, 8], [10, -2], [-11, -4], [0, 14]] };
    const fought = { ...live, ph: 1, ec: null, cx: null, rem: { x: 0, z: 0, yw: 0, mv: walk(-9, -9, 9, 9), atk: vol } };
    const renderer = { createMesh: () => ({}), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} };
    let rnow = T0;
    const L = { state: () => fought, now: () => rnow, joined: () => true, inDue: () => false, sentIn() {} };
    const set = createSdRemnant({ renderer, link: () => L, ending: mk[0] });
    set.stand({ dynamicDraws: [] });
    out.remnantGears = bytes(() => { rnow = tick(); set.frame(1 / 60, feet); });
    const L2 = { ...L, state: () => live };
    const set2 = createSdRemnant({ renderer, link: () => L2, ending: mk[0] });
    set2.stand({ dynamicDraws: [] });
    out.remnantWalk = bytes(() => { rnow = tick(); set2.frame(1 / 60, feet); });
    const GK = sdKeptList();
    out.gears = bytes(() => { sink[3] = sdGearsAt(fought, tick(), GK); });
    const hand = { k: 'atk', b: SD_BODY.remnant, i: 1, a: SD_BLOWS.hand.id, at: T0, x: 0, z: 0, yw: 0.7, tg: [], sw: 1 };
    const swept = { ...live, ph: 1, ec: null, cx: null, rem: { x: 0, z: 0, yw: 0.7, mv: null, atk: hand } };
    const BK = sdKeptList();
    const gl = { BLEND: 1, ONE: 1, CULL_FACE: 2, TRIANGLES: 4 };
    for (const m of ['useProgram', 'uniformMatrix4fv', 'uniform1f', 'uniform1i', 'uniform2f', 'uniform2fv', 'uniform3f', 'uniform3fv', 'bindVertexArray', 'enable', 'disable', 'blendFunc', 'depthMask', 'drawArrays']) gl[m] = () => {};
    const pass = Object.assign(Object.create(SdBeamRenderer.prototype), { gl, u: {}, _vp: new Float32Array(16), count: 48, drawn: 0, vao: {} });
    const proj = new Float32Array(16), view = new Float32Array(16);
    out.beam = bytes(() => { const b = sdBeamDraws(swept, tick(), BK); sink[4] = pass.draw(b, proj, view, feet, 1, null); });
    const perilOf = (atk) => ({ ...live, ph: 1, ec: null, cx: null, rem: { x: 0, z: 0, yw: 0, mv: null, atk } });
    const pH = perilOf({ ...hand, at: T0 + 2000 });
    out.perilHand = bytes(() => { sink[5] = sdPerilAt(pH, tick(), 0.4, 6, 0.3); });
    const pS = perilOf({ k: 'atk', b: SD_BODY.remnant, i: 3, a: SD_BLOWS.stomp.id, at: T0 + 2000, x: 1, z: 1, yw: 0, tg: [] });
    out.perilStomp = bytes(() => { sink[6] = sdPerilAt(pS, tick(), 2, 2, 0.3); });
    const pV = perilOf({ ...vol, at: T0 + 2000 });
    out.perilVolley = bytes(() => { sink[7] = sdPerilAt(pV, tick(), 3, 9, 0.3); });
    const arm = { data: Object.assign(new Float32Array(8), { carried: new Uint8Array(2) }), colors: new Float32Array(6) };
    const flashes = Array.from({ length: 20 }, (_, i) => ({ x: feet[0] + i, y: feet[1] + 1, z: feet[2] - i, range: 6 + i, color: [1, 0.8, 0.4] }));
    out.hourLines = bytes(() => { sink[8] = realmLightsWith(arm, flashes, feet); });
    const two = [0, 0], B = { x: 0, z: 0, mv: walk(-9, -9, 9, 9) };
    out.bodyAt = bytes(() => { sink[9] = sdBodyAt(B, tick(), two); });
    out.keepIn = bytes(() => { sink[10] = keepInArena(30 + (tick() - T0) * 1e-3, 4, 24, two); });
    out.pillars = bytes(() => { sink[11] = behindPillar(0, 0, 20 + (tick() - T0) * 1e-3, 20); });
    out.inArena = bytes(() => { sink[12] = inArena(20 + (tick() - T0) * 1e-3, 3, 1.5); });
    console.log(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.ok(m.control >= 40, `the control made ${m.control.toFixed(2)} bytes a frame - the measure is blind`);
  // the bounds: nothing at all where nothing need be made; the beam's and the read's answers and the rig's own numbers
  // (a few hundred bytes - the measured residue, said in the bible) where a blow is in flight
  const BOUND = { fxFrame: 2, fxLights: 2, hourLines: 2, bodyAt: 2, keepIn: 2, pillars: 2, inArena: 2, stoneLight: 32, remnantWalk: 512, remnantGears: 1024, gears: 1024, beam: 1024, perilHand: 1024, perilStomp: 1024, perilVolley: 1024 };
  for (const [path, b] of Object.entries(BOUND)) assert.ok(m[path] < b, `${path}: ${m[path].toFixed(2)} bytes a frame (its bound ${b}, the control ${m.control.toFixed(2)})`);
});
