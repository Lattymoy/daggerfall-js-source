// RAIN-LEAK (2026-10-11, asked "Does rain have a memory leak" - no; then "Take care of all 3"): the three things the
// read found that were not a leak but read like one. RAIN-CLOCK: the fall's own clock, re-origined where nothing sees
// it, so a long session's float32 never steps the rain. The rain's loops let go of every node they built. The hosts
// hand the falling weather one eye array a frame, not a fresh one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PrecipitationRenderer, PRECIP_REST_S, PRECIP_CLOCK_MAX_S, BETTER_FALL, BETTER_FALL_VS, LAB_WX_VS, LAB_COUNTS, betterFallSwitches } from '../../src/render/precipitation.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';   // OWN-WORK4 AUDIT: Better Ambience's switches
import { glslFunctions } from '../glsl.mjs';   // OWN-WORK4 AUDIT: our fall's vertex stage, run as written
import { AudioEngine, releaseNodes } from '../../src/systems/audio.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A recording GL (the audit26/renderalloc/glstate Proxy-GL precedent): every uniform upload, by its location's name. */
function recordingGl() {
  const ups = [];
  const gl = new Proxy({}, { get: (o, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, name) => ({ name });
    if (k === 'createProgram' || k === 'createShader' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ({});
    if (typeof k === 'string' && k.startsWith('uniform')) return (loc, ...v) => { ups.push([loc?.name, v.length === 1 && v[0]?.length !== undefined ? [...v[0]] : v]); };
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
    return () => {};
  } });
  return { gl, ups };
}
const M = new Float32Array(16), E = new Float32Array(3);
/** The uTime one draw uploaded, and the windOff it uploaded beside it (the lab's lane only). */
function drawOnce(r, ups, mode, seconds) {
  ups.length = 0;
  r.draw(mode, M, M, E, E, seconds);
  const t = ups.find((u) => u[0] === 'uTime');
  const w = ups.find((u) => u[0] === 'uWindOff');
  return { t: t ? t[1][0] : null, w: w ? w[1] : null };
}

test('RAIN-CLOCK: the fall counts from its own origin, not the page\'s uptime - re-origined on the first draw, after a rest off the screen, on a clock run backwards, and at the hour; the wind\'s travel goes back to 0 with it (mutants: the uptime handed through; no rest; no hour; travel kept)', () => {
  for (const enhanced of [false, true]) {
    const { gl, ups } = recordingGl();
    const r = new PrecipitationRenderer(gl, { enhanced });
    const T = 86400;   // a page open a whole day
    assert.equal(drawOnce(r, ups, 'rain', T).t, 0, `${enhanced ? 'lab' : 'classic'}: the first draw is the clock's origin, not a day of uptime`);
    assert.equal(drawOnce(r, ups, 'rain', T + 0.5).t, 0.5, 'and it runs on with the frames');
    // a steady fall, frame after frame, under the rest
    let s = T + 0.5;
    for (let i = 0; i < 20; i++) { s += PRECIP_REST_S * 0.9; drawOnce(r, ups, 'rain', s); }
    assert.ok(Math.abs(drawOnce(r, ups, 'rain', s + 1).t - (s + 1 - T)) < 1e-9, 'frames closer than the rest never move the origin');
    // the weather left the screen for longer than the rest: the next spell starts a new clock
    const back = s + 1 + PRECIP_REST_S + 0.001;
    assert.equal(drawOnce(r, ups, 'rain', back).t, 0, 'a spell after a rest begins at 0');
    // a host clock that went backwards (a reload's performance.now never does, a test's might)
    assert.equal(drawOnce(r, ups, 'rain', back - 5).t, 0, 'a clock run backwards begins again, never a negative time');
    // an hour of unbroken weather: re-origined at the cap, so the float32 never runs past it
    let u = back - 5, maxT = 0;
    while (u < back - 5 + PRECIP_CLOCK_MAX_S * 2.5) { u += 1; maxT = Math.max(maxT, drawOnce(r, ups, 'snow', u).t); }
    assert.ok(maxT < PRECIP_CLOCK_MAX_S && maxT >= PRECIP_CLOCK_MAX_S - 1, `the clock tops out under the hour: ${maxT}`);
  }
  // the lab's travel: the host integrates it (+= wd.step) and the re-origin zeroes it before it is uploaded
  const { gl, ups } = recordingGl();
  const r = new PrecipitationRenderer(gl, { enhanced: true });
  r.windOff[0] = 5e6; r.windOff[1] = -3e6;   // a day of a gale, added up
  assert.deepEqual(drawOnce(r, ups, 'rain', 100).w, [0, 0], 'the first draw uploads no travel from before it');
  r.windOff[0] += 0.25; r.windOff[1] += -0.5;
  assert.deepEqual(drawOnce(r, ups, 'rain', 100.016).w, [0.25, -0.5], 'a steady fall keeps its travel');
  r.windOff[0] += 1e4;
  assert.deepEqual(drawOnce(r, ups, 'rain', 100.016 + PRECIP_REST_S + 1).w, [0, 0], 'and a rest drops it with the clock');
  // the pixel snow (DS1) reads the same clock
  r.pixelSnow = { minParticleSize: 0.001, maxParticleSize: 0.003 }; r.pixelTex = {};
  assert.equal(drawOnce(r, ups, 'snow', 5000).t, 0, 'the pixel snow: a new spell at 0');
  assert.equal(drawOnce(r, ups, 'snow', 5000.25).t, 0.25);
});

test('RAIN-CLOCK: a frame that draws nothing is no frame of the fall - an enhanced front at no intensity keeps neither the clock\'s origin nor its last frame (mutant: the clock read before the count)', () => {
  const { gl, ups } = recordingGl();
  const r = new PrecipitationRenderer(gl, { enhanced: true });
  drawOnce(r, ups, 'rain', 10);
  drawOnce(r, ups, 'rain', 11);
  r.intensity = 0;
  for (let s = 12; s < 12 + PRECIP_REST_S * 3; s += 1) assert.equal(drawOnce(r, ups, 'rain', s).t, null, 'nothing drawn, nothing uploaded');
  r.intensity = 1;
  assert.equal(drawOnce(r, ups, 'rain', 12 + PRECIP_REST_S * 3).t, 0, 'the front coming back in after the rest is a new spell');
});

test('RAIN-LEAK: the rain\'s loops - flat and placed, cut or faded - let go of every node they built, not the source alone (mutants: the gain kept; the filter kept; the panner kept; the fade\'s end the source alone)', () => {
  const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} });
  const nodes = [];
  const node = (kind, extra = {}) => { const n = { kind, cut: 0, connect(m) { return m; }, disconnect() { this.cut++; }, ...extra }; nodes.push(n); return n; };
  const ctx = {
    state: 'running', currentTime: 0,
    createGain: () => node('gain', { gain: param() }),
    createBiquadFilter: () => node('filter', { frequency: param(), Q: param() }),
    createPanner: () => node('panner', { positionX: param(), positionY: param(), positionZ: param() }),
    createBufferSource: () => node('source', { buffer: null, playbackRate: param(), loop: false, start() {}, stop() {}, context: ctx }),
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  e._out = () => ({ connect(m) { return m; } });
  e._buffer = () => ({ duration: 1 });
  e._panner = () => node('panner', { positionX: param(), positionY: param(), positionZ: param() });
  const made = (fn) => { nodes.length = 0; const h = fn(); return { h, built: [...nodes] }; };
  const allCut = (built, what) => {
    assert.deepEqual(built.map((n) => n.kind).sort(), what.slice().sort(), 'the chain that was built');
    for (const n of built) assert.ok(n.cut >= 1, `the ${n.kind} let go`);
  };
  for (const [name, fn, kinds] of [
    ['loop', () => e.loop(1, 0.5), ['source', 'gain']],
    ['loop, low-passed (the indoor rain)', () => e.loop(1, 0.5, { lowpass: 4236 }), ['source', 'gain', 'filter']],
    ['loop3d (the rain at a dungeon\'s exit)', () => e.loop3d(1, [0, 0, 0], 0.5), ['source', 'gain', 'panner']],
    ['loop3d, low-passed', () => e.loop3d(1, [0, 0, 0], 0.5, { lowpass: 4236 }), ['source', 'gain', 'panner', 'filter']],
  ]) {
    const cut = made(fn);
    cut.h.stop();
    allCut(cut.built, kinds);
    const faded = made(fn);
    faded.h.fadeStop(0.4);
    const src = faded.built.find((n) => n.kind === 'source');
    assert.equal(typeof src.onended, 'function', `${name}: the fade lets go when the source ends`);
    src.onended();
    allCut(faded.built, kinds);
  }
  releaseNodes(null, undefined, { disconnect() { throw new Error('gone'); } });   // a node already gone is no fault
});

test('RAIN-LEAK: both exterior hosts hand the falling weather (the sand, the rain and snow, the wisps) one eye array a frame, filled in place - never a fresh Float32Array a frame (mutants: a copy back in a draw; the array never filled)', () => {
  for (const [host, eye, scratch, from, to] of [
    ['src/scenes/world.js', 'wxEye', 'wxEye32', 'const drawFalling = () => {', '    // BOLT: the burning channels'],
    ['src/scenes/exterior.js', 'eye', 'eye32', '// WX2: what falls is what the front SHOWS (world.js\'s twin note)', '// C9: the exterior FP weapon'],
  ]) {
    const s = rd(host);
    assert.equal((s.match(new RegExp(`const ${scratch} = new Float32Array\\(3\\);`, 'g')) || []).length, 1, `${host}: one array, made at boot`);
    assert.ok(s.includes(`${scratch}[0] = ${eye}[0]; ${scratch}[1] = ${eye}[1]; ${scratch}[2] = ${eye}[2];`), `${host}: filled from the frame's eye`);
    const i = s.indexOf(from), j = s.indexOf(to, i);
    assert.ok(i > 0 && j > i, `${host}: the falling weather's block`);
    const block = s.slice(i, j);
    for (const call of ['dryFall.draw(', 'precip.drawFall(', 'wisps.draw(']) {   // PRECIP1: the fall at the air's snow share   // PIN MOVED (ASHFALL1, 2026-10-27): the sand's renderer is the dry falls' (render/dryFall.js), the ash's with it
      const line = block.includes(call) ? block.slice(block.indexOf(call)).split('\n')[0] : '';
      assert.ok(line.includes(`, ${scratch}, `) && !line.includes('new Float32Array('), `${host}: ${call} takes ${scratch}, and mints no array`);
    }
  }
});

// OWN-WORK4 AUDIT (2026-11-01): BETTER AMBIENCE'S RAIN AND SNOW, OURS - its two switches pick our fall on the enhanced
// lane; off, the lab's program draws exactly as before.
test('OWN-WORK4 AUDIT Better Ambience\'s fall: the switches pick our program on the enhanced lane, the mod\'s own switch over both; off, the lab\'s draws; a storm denser than rain (mutants: the switch unread; the master switch unread; the storm no denser)', () => {
  const reads = (vals) => (vendor, key) => vals[key];
  assert.deepEqual(betterFallSwitches(reads({ Enabled: true, 'Better Rain.enableBetterRain': true, 'Better Rain.enableBetterSnow': false })), { rain: true, snow: false });
  assert.deepEqual(betterFallSwitches(reads({ Enabled: false, 'Better Rain.enableBetterRain': true, 'Better Rain.enableBetterSnow': true })), { rain: false, snow: false }, 'the mod off: both off');
  assert.deepEqual(betterFallSwitches(() => { throw new Error('no store'); }), { rain: false, snow: false });
  const used = [], counts = [];
  const gl = new Proxy({}, { get: (o, k) => {
    if (k === 'useProgram') return (p) => used.push(p);
    if (k === 'drawArraysInstanced') return (m, f, n, c) => counts.push(c);
    if (k === 'getUniformLocation') return (p, name) => ({ name });
    if (k === 'createProgram') return () => ({ id: Symbol('program') });
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => ({});
  } });
  const r = new PrecipitationRenderer(gl, { enhanced: true });
  r.intensity = 1;
  try {
    for (const [rain, snow] of [[false, false], [true, true]]) {
      setModSetting('better-ambience', 'Better Rain.enableBetterRain', rain);
      setModSetting('better-ambience', 'Better Rain.enableBetterSnow', snow);
      used.length = 0; counts.length = 0;
      for (const mode of ['rain', 'storm', 'snow']) r.draw(mode, M, M, E, E, 1);
      const want = rain ? r.betterProgram : r.labProgram;
      assert.deepEqual(used, [want, want, want], rain ? 'on: ours' : 'off: the lab\'s, as before');
      assert.deepEqual(counts, rain ? [BETTER_FALL.count.rain, BETTER_FALL.count.storm, BETTER_FALL.count.snow] : [LAB_COUNTS.rain, LAB_COUNTS.storm, LAB_COUNTS.snow]);
    }
    assert.ok(BETTER_FALL.count.storm > BETTER_FALL.count.rain && BETTER_FALL.count.storm <= LAB_COUNTS.rain, 'a storm denser, inside the lab\'s instances');
  } finally { _resetModSettings(); }
});

test('OWN-WORK4 AUDIT Better Ambience\'s fall, as drawn: a drop\'s streak along its own velocity - slanted and lengthened by the wind, longer in a storm; a flake slower than the lab\'s, carried by the wind, its size spread from small to clumps (mutants: the streak unslanted; the storm no faster; the flake as fast as the lab\'s; the flakes one size)', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const at = (vs, u, corner, seed) => {
    const f = glslFunctions(vs, { uVP: I, uEye: [21, 21, 21], uRight: [1, 0, 0], uUp: [0, 1, 0], uTime: 0, uKind: 0, uBox: 42, uFall: 22, uStorm: 0, uWindV: [0, 0], uWindOff: [0, 0], aCorner: corner, aSeed: seed, ...u });
    f.main();
    return f.globals.gl_Position.slice(0, 3);
  };
  const seed = [20, 20, 20, 0.37];
  const streak = (u) => { const a = at(BETTER_FALL_VS, u, [0.5, 0], seed), b = at(BETTER_FALL_VS, u, [0.5, 1], seed); return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; };
  const len = (v) => Math.hypot(...v);
  const still = streak({}), windy = streak({ uWindV: [12, 0] }), storm = streak({ uStorm: 1 });
  assert.ok(Math.abs(still[0]) < 1e-6 && still[1] < 0, 'no wind: straight down');
  assert.ok(windy[0] > 0.1 && len(windy) > len(still), `the wind slants and lengthens it (${windy.map((v) => v.toFixed(2))})`);
  assert.ok(len(storm) > len(still) * 1.1, 'a storm\'s drops faster, their streaks longer');
  // a flake's fall over a second, against the lab's flake on the same seed
  const fallOf = (vs, s) => at(vs, { uKind: 1, uFall: 1.6, uTime: 0 }, [0.5, 0.5], s)[1] - at(vs, { uKind: 1, uFall: 1.6, uTime: 1 }, [0.5, 0.5], s)[1];
  let ours = 0, lab = 0;
  for (let i = 0; i < 20; i++) { const s = [20, 30, 20, (i + 0.5) / 20]; ours += fallOf(BETTER_FALL_VS, s); lab += fallOf(LAB_WX_VS, s); }
  assert.ok(ours < lab * 0.8, `slower than the lab's (${ours.toFixed(2)} against ${lab.toFixed(2)})`);
  const sizes = Array.from({ length: 40 }, (_, i) => { const s = [20, 20, 20, (i + 0.5) / 40]; const a = at(BETTER_FALL_VS, { uKind: 1 }, [0, 0.5], s), b = at(BETTER_FALL_VS, { uKind: 1 }, [1, 0.5], s); return b[0] - a[0]; });
  assert.ok(Math.max(...sizes) / Math.min(...sizes) > 3, 'small flakes and clumps');
  const carried = at(BETTER_FALL_VS, { uKind: 1, uWindOff: [5, 0] }, [0.5, 0.5], seed)[0] - at(BETTER_FALL_VS, { uKind: 1 }, [0.5, 0.5], seed)[0];
  assert.ok(carried > 4.5, `the wind's travel carries a flake at least as far as it went (${carried.toFixed(2)})`);
});
