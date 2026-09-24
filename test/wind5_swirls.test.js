// WIND5 - THE WIND'S FLOURISHES (2026-09-23, Mac: "lets reduce the amount
// of wind streaks and change their design to be more swirly like the
// image" - a sheet of calligraphic wind flourishes: a flowing stroke that
// ends in a curl).
//   - fewer: 240 at a gale (WIND4's 650), 19 in a calm (DISC17-A: 120 and 10);
//   - a ribbon of WISP_SEGMENTS segments along a path - an arched or S
//     stroke down the wind, then a spiral tightening as it turns - each
//     leaning its curl's plane its own way and curling up or down;
//   - drawn on and off along the path, soft across its width like ink;
//   - the sandstorm's look keeps its straight streak, one quad a grain.
// What it looks like is tools/wind5SwirlProbe.mjs's (a real GPU); these run
// the laws on the shaders' own swirl() and main()s (glsl.mjs), and pin the
// ribbon, the clock and the plumbing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WISP_VS, WISP_FS, WISP_LOOK, SAND_LOOK, WISP_MAX, WISP_FLOOR, WISP_SEGMENTS, WISP_STROKE, WISP_ARCH, WISP_CURL_R,
  WISP_CURL_TURNS, WISP_CURL_TIGHT, WISP_LEAN, WISP_DRAW_HEAD, WISP_DRAW_TAIL, WindWispsRenderer, ribbon, wispCount,
  WISP_CLOCK_PERIOD, WISP_WOBBLE_CYCLES, WISP_RATE_STEPS, wispClock,
} from '../src/render/windWisps.js';
import { glslFunctions } from './glsl.mjs';

const lit = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

// AUDIT-VC7 (lens 4): the laws run on the SHADER'S OWN swirl() and main() (glsl.mjs) - a replica in JS proved them on
// itself while five of swirl's lines went untested.
const vs = {};
const shader = (curl = 1) => (vs[curl] ??= glslFunctions(WISP_VS, { uCurl: curl }));
const swirl = (s, seed, curl = 1) => shader(curl).swirl(s, seed);
const fract = (x) => x - Math.floor(x);
// the vertex shader's main at one corner of one wisp: the world position (the view-projection the identity), and the
// varyings; `fp32` evaluates it at the GPU's precision
const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function corner(x, y, { seed = 0.37, time = 12.3, wind = [3, 4], eye = [0, 0, 0], curl = 1, fp32 = false } = {}) {
  const f = glslFunctions(WISP_VS, {
    uVP: I16, uEye: eye, uTime: time, uBox: 400, uStrength: 0.6, uWindV: wind, uWindOff: [0, 0], uLen: [4, 2], uCurl: curl,
    aCorner: [x, y], aSeed: [eye[0] + 5, eye[1] + 2, eye[2] - 7, seed],
  }, { fp32 });
  f.main();
  const g = f.globals;
  return { p: g.gl_Position.slice(0, 3), vT: g.vT, vLife: g.vLife, vAcross: g.vAcross, vDraw: g.vDraw };
}
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('WIND5: fewer - 240 at a gale, 19 in a calm (DISC17-A: 120, 10); the sand untouched', () => {
  assert.ok(WISP_MAX < 650, 'fewer than WIND4\'s gale');
  assert.equal(wispCount(1), WISP_MAX); assert.equal(wispCount(0), Math.round(WISP_MAX * WISP_FLOOR));
  // the ramp: the floor to a breeze of 0.05, all of them from 0.9, a smoothstep between - half the rest at its middle
  assert.equal(wispCount(0.05), wispCount(0));
  assert.equal(wispCount(0.9), WISP_MAX);
  assert.equal(wispCount(0.475), Math.round(WISP_MAX * (WISP_FLOOR + (1 - WISP_FLOOR) * 0.5)));
  for (let s = 0; s < 1; s += 0.05) assert.ok(wispCount(s + 0.05) >= wispCount(s), 'more wind, never fewer wisps');
  assert.equal(SAND_LOOK.count, 7000, 'the sandstorm is a wall of sand, not the wind\'s mark');
  assert.deepEqual([WISP_LOOK.curl, SAND_LOOK.curl], [1, 0]);
});

test('WIND5: THE FLOURISH\'S PATH - a stroke that meets its curl level and heading the same way, a curl that tightens as it turns', () => {
  assert.deepEqual([WISP_SEGMENTS, WISP_STROKE, WISP_ARCH, WISP_CURL_R, WISP_CURL_TURNS, WISP_CURL_TIGHT, WISP_LEAN], [40, 0.55, 0.08, 0.2, 1.6, 0.3, 1.05]);
  for (const seed of [0.07, 0.31, 0.5, 0.77, 0.93]) {
    const e = 1e-4;
    // the join: continuous, level, heading down the wind
    const a = swirl(WISP_STROKE - e, seed), b = swirl(WISP_STROKE + e, seed);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3, `seed ${seed}: no gap at the join`);
    const ta = [swirl(WISP_STROKE, seed)[0] - swirl(WISP_STROKE - e, seed)[0], swirl(WISP_STROKE, seed)[1] - swirl(WISP_STROKE - e, seed)[1]];
    const tb = [swirl(WISP_STROKE + e, seed)[0] - swirl(WISP_STROKE, seed)[0], swirl(WISP_STROKE + e, seed)[1] - swirl(WISP_STROKE, seed)[1]];
    const ang = (t) => Math.atan2(t[1], t[0]);
    assert.ok(Math.abs(ang(ta)) < 0.05 && Math.abs(ang(tb)) < 0.05, `seed ${seed}: both sides of the join head down the wind (${ang(ta).toFixed(3)}, ${ang(tb).toFixed(3)})`);
    // the stroke leaves level too, from the wisp's own origin
    assert.deepEqual(swirl(0, seed), [0, 0]);
    // the curl: it turns WISP_CURL_TURNS times about its centre and closes in
    const c = [WISP_STROKE, WISP_CURL_R * (0.8 + (seed * 29.7 - Math.floor(seed * 29.7)) * 0.4)];
    const rad = (s) => { const p = swirl(s, seed); return Math.hypot(p[0] - c[0], p[1] - c[1]); };
    let last = rad(WISP_STROKE + e), turned = 0, prev = null;
    for (let s = WISP_STROKE + 0.01; s <= 1.0001; s += 0.01) {
      const r = rad(s); assert.ok(r <= last + 1e-9, 'the curl tightens, never opens'); last = r;
      const p = swirl(s, seed), q = Math.atan2(p[1] - c[1], p[0] - c[0]);
      if (prev !== null) { let d = q - prev; if (d < -Math.PI) d += 2 * Math.PI; if (d > Math.PI) d -= 2 * Math.PI; turned += d; }
      prev = q;
    }
    assert.ok(Math.abs(Math.abs(turned) / (2 * Math.PI) - WISP_CURL_TURNS) < 0.05, `seed ${seed}: ${(turned / (2 * Math.PI)).toFixed(2)} turns`);
    assert.ok(Math.abs(rad(1) / c[1] - WISP_CURL_TIGHT) < 1e-6, 'closing to its tightness');
  }
  // a straight streak at a curl of 0 - the sand's: no stroke share to divide by, no curl
  for (const s of [0, 0.3, 0.55, 0.7, 1]) assert.deepEqual(swirl(s, 0.4, 0).map((x) => x + 0), [s, 0]);   // + 0: a zero arch times an S's negative half is -0
  // THE PATH IN THE WORLD: down the wind by the stroke's own measure - the curl's plane is square to the wind, leaning
  // about it (a wind along a diagonal, where a wrong perpendicular shows)
  for (const seed of [0.21, 0.58, 0.83]) {
    const wind = [3, 4], vel = [0.6, 0, 0.8], P = (s) => corner(0.5, s, { seed, wind }).p;
    const len = (4 + fract(seed * 13.1) * 2) * (0.5 + 0.6), p0 = P(0);
    for (const s of [0.2, 0.5, 0.8, 1]) assert.ok(Math.abs(dot(sub(P(s), p0), vel) - (swirl(s, seed)[0] - swirl(0, seed)[0]) * len) < 1e-9, `seed ${seed} at ${s}: its run down the wind`);
    // THE RIBBON FACES THE EYE along the path: its width square to the eye's ray and to the path's own tangent
    for (const s of [0.1, 0.4, 0.7, 0.95]) {
      const c = P(s), side = sub(corner(1, s, { seed, wind }).p, corner(0, s, { seed, wind }).p);
      const tan = sub(P(Math.min(s + 0.01, 1)), P(Math.max(s - 0.01, 0))), eye = sub([0, 0, 0], c);
      const n = Math.hypot(...side);
      assert.ok(n > 0 && Math.abs(dot(side, eye)) / (n * Math.hypot(...eye)) < 1e-9, `seed ${seed} at ${s}: square to the eye's ray`);
      assert.ok(Math.abs(dot(side, tan)) / (n * Math.hypot(...tan)) < 0.05, `seed ${seed} at ${s}: square to the path (${(dot(side, tan) / (n * Math.hypot(...tan))).toFixed(3)})`);
    }
  }
  // A VARIED HAND: over many wisps, both arches and S's; curl planes leaning every way up to WISP_LEAN; curls both up
  // and down - read off the paths the shader lays in the world
  let arches = 0, esses = 0, ups = 0, downs = 0, leanMin = Infinity, leanMax = 0;
  for (let k = 0; k < 60; k++) {
    const seed = (k + 0.5) / 60;
    const y1 = swirl(0.1, seed)[1], y2 = swirl(0.45, seed)[1];
    if (y1 * y2 > 0) arches++; else if (y1 * y2 < 0) esses++;
    const wind = [3, 4], vel = [0.6, 0, 0.8], P = (s) => corner(0.5, s, { seed, wind }).p;
    const len = (4 + fract(seed * 13.1) * 2) * (0.5 + 0.6), c0 = swirl(0, seed), c1 = swirl(0.8, seed);
    const D = sub(sub(P(0.8), P(0)), vel.map((v) => v * (c1[0] - c0[0]) * len));   // the curl plane's own share: up * dy * len
    const up = D.map((v) => v / ((c1[1] - c0[1]) * len));
    if (up[1] > 0) ups++; else downs++;
    const lean = Math.acos(Math.min(1, Math.abs(up[1])));
    leanMin = Math.min(leanMin, lean); leanMax = Math.max(leanMax, lean);
  }
  assert.ok(arches > 15 && esses > 15, `arches ${arches}, S's ${esses}`);
  assert.ok(ups > 15 && downs > 15, `curling up ${ups}, down ${downs}`);
  assert.ok(leanMin < 0.15 && leanMax > 0.8 && leanMax <= WISP_LEAN + 1e-9, `leaning ${leanMin.toFixed(2)} to ${leanMax.toFixed(2)} radians off the vertical`);
  assert.doesNotMatch(WISP_VS.replace(/\/\/[^\n]*/g, ''), /\bflat\b/, 'no variable named flat - GLSL ES 3.00 reserves it and the program would not compile');
});

test('WIND5: THE PEN AND THE INK - swelling from the tail, thinning into the curl, drawn on and off along the path', () => {
  assert.ok(WISP_DRAW_TAIL < WISP_DRAW_HEAD, 'the tail sets off before the head arrives - never the whole flourish at once, never nothing mid-life');
  // THE PEN, on the ribbon's own width: none at the tail, swelling, then thinning into the curl
  const width = (s) => Math.hypot(...sub(corner(1, s).p, corner(0, s).p));
  assert.ok(width(0) < 1e-12, 'a point at the tail');
  const ws = []; for (let s = 0; s <= 1.0001; s += 0.05) ws.push([s, width(s)]);
  const widest = ws.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.ok(widest[0] > 0 && widest[0] < WISP_STROKE, `widest in the stroke (${widest[0].toFixed(2)}), before the curl`);
  assert.ok(width(1) < 0.5 * widest[1], 'thin at the curl\'s heart');
  assert.ok(Math.abs(width(0) - Math.hypot(...sub(corner(1, 0, { curl: 0 }).p, corner(0, 0, { curl: 0 }).p))) > 0.05, 'the sand\'s streak keeps its width');
  // THE INK, drawn on and off: the life's phase at a chosen moment, through the shaders' own main()s
  const seed = 0.37, rate = 0.35 + Math.floor(fract(seed * 5.3) * WISP_RATE_STEPS) * (0.25 / WISP_RATE_STEPS);
  const at = (ph) => corner(0.5, 0.5, { seed, time: ((ph - fract(seed * 7) + 2) / rate) });
  const alpha = (v, vT, vAcross = 0.5) => {
    const f = glslFunctions(WISP_FS, { uStrength: 0.6, uColor: [1, 1, 1], uAlpha: [0.2, 0.3], uCurl: 1, vT, vLife: 1, vAcross, vDraw: v.vDraw });
    f.main();
    return f.globals.o[3];
  };
  for (const vT of [0, 0.3, 0.7, 1]) {
    assert.ok(alpha(at(0.001), vT) < 1e-6, `the life's start: nothing drawn yet (vT ${vT})`);
    assert.ok(alpha(at(0.9999), vT) < 1e-6, `its end: all of it drawn off (vT ${vT})`);
  }
  const mid = at((WISP_DRAW_TAIL + 0.02));
  assert.ok(alpha(mid, 0.5) > 0 && alpha(mid, 0.9) > 0, 'mid-life, the path is inked out to near its head');
  assert.ok(alpha(mid, 0.5, 0) < 1e-12 && alpha(mid, 0.5, 1) < 1e-12 && alpha(mid, 0.5, 0.5) > alpha(mid, 0.5, 0.25), 'soft across its width like ink - none at the edges, most at the middle');
  assert.ok(WISP_FS.includes('a *= vLife * (uAlpha.x + uAlpha.y * uStrength);'), 'never more than a breath');
});

test('WIND5: THE CLOCK WRAPS WHOLE - every rate is whole cycles over its period, so the hosts\' seconds wrap without a seam (AUDIT-VC7 G6)', () => {
  assert.ok(Number.isInteger(0.35 * WISP_CLOCK_PERIOD) && Number.isInteger((0.25 / WISP_RATE_STEPS) * WISP_CLOCK_PERIOD), 'every life\'s rate a whole number of lives a period');
  assert.ok(WISP_WOBBLE_CYCLES.every(Number.isInteger));
  assert.equal(wispClock(WISP_CLOCK_PERIOD * 216 + 12.5), 12.5);
  assert.equal(wispClock(-3), WISP_CLOCK_PERIOD - 3);
  // the shader at a wrapped clock is the shader at the whole one, for every wisp (float64: the arithmetic, not the GPU)
  for (const seed of [0.11, 0.37, 0.66, 0.92]) for (const T of [36000.3, 86400.77, 399.9, 400.1]) {
    const whole = corner(0.3, 0.6, { seed, time: T }), wrapped = corner(0.3, 0.6, { seed, time: wispClock(T) });
    assert.ok(Math.hypot(...sub(whole.p, wrapped.p)) < 1e-6 && Math.abs(whole.vLife - wrapped.vLife) < 1e-6 && Math.abs(whole.vDraw[0] - wrapped.vDraw[0]) < 1e-6, `seed ${seed} at ${T} s`);
  }
  // ...and at the GPU's own precision the wrap is what keeps a day-long session's phase: the whole clock at a day's
  // seconds steps a life by a large share of a frame; the wrapped one holds it to the frame's own grain
  const truth = corner(0.5, 0.5, { seed: 0.37, time: 86400.77 }).vLife;
  const raw = Math.abs(corner(0.5, 0.5, { seed: 0.37, time: 86400.77, fp32: true }).vLife - truth);
  const kept = Math.abs(corner(0.5, 0.5, { seed: 0.37, time: wispClock(86400.77), fp32: true }).vLife - truth);
  assert.ok(kept < 1e-3 && kept < raw / 10, `a day in: ${raw.toExponential(2)} off unwrapped, ${kept.toExponential(2)} wrapped`);
  // the renderer hands the wrapped clock
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray') return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 4;
      return (...a) => { calls.push([k, ...a]); };
    },
  });
  const w = new WindWispsRenderer(gl, WISP_LOOK), I = new Float32Array(I16);
  w.draw({ on: true, strength01: 1, windV: [5, -2], step: [0, 0] }, I, I, new Float32Array(3), 86400.77);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uTime').slice(2), [wispClock(86400.77)]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uWindV').slice(2), [5, -2], 'the wind as it blows - x then z');
});

test('WIND5: THE RIBBON - WISP_SEGMENTS segments of two triangles along the path for a flourish, the one old quad for the sand; the renderer draws what it built', () => {
  const r = ribbon(WISP_LOOK);
  assert.equal(r.length, WISP_SEGMENTS * 12);
  for (let i = 0; i < WISP_SEGMENTS; i++) {
    const seg = Array.from(r.slice(i * 12, i * 12 + 12));
    const a = i / WISP_SEGMENTS, b = (i + 1) / WISP_SEGMENTS;
    assert.deepEqual(seg, [0, a, 1, a, 1, b, 0, a, 1, b, 0, b].map((x) => Math.fround(x)), `segment ${i}`);
  }
  assert.deepEqual(Array.from(ribbon(SAND_LOOK)), [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 'the quad it always was');
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray') return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 4;
      return (...a) => { calls.push([k, ...a]); };
    },
  });
  const wd = { on: true, strength01: 1, windV: [5, 0], step: [0.1, 0] };
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  for (const [look, verts] of [[WISP_LOOK, WISP_SEGMENTS * 6], [SAND_LOOK, 6]]) {
    const w = new WindWispsRenderer(gl, look);
    assert.equal(w.verts, verts);
    calls.length = 0;
    w.draw(wd, I, I, new Float32Array(3), 1);
    const d = calls.find((c) => c[0] === 'drawArraysInstanced');
    assert.equal(d[3], verts, 'the ribbon\'s vertices');
    assert.equal(d[4], wispCount(1, look));
    assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uCurl').slice(2), [look.curl], 'the look\'s curl reaches the shader');
  }
});
