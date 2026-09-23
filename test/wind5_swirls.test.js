// WIND5 - THE WIND'S FLOURISHES (2026-09-23, Mac: "lets reduce the amount
// of wind streaks and change their design to be more swirly like the
// image" - a sheet of calligraphic wind flourishes: a flowing stroke that
// ends in a curl).
//   - fewer: 240 at a gale (WIND4's 650), a couple of dozen in a calm;
//   - a ribbon of WISP_SEGMENTS segments along a path - an arched or S
//     stroke down the wind, then a spiral tightening as it turns - each
//     leaning its curl's plane its own way and curling up or down;
//   - drawn on and off along the path, soft across its width like ink;
//   - the sandstorm's look keeps its straight streak, one quad a grain.
// What it looks like is tools/wind5SwirlProbe.mjs's (a real GPU); these pin
// the law, the ribbon and the plumbing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WISP_VS, WISP_FS, WISP_LOOK, SAND_LOOK, WISP_MAX, WISP_FLOOR, WISP_SEGMENTS, WISP_STROKE, WISP_ARCH, WISP_CURL_R,
  WISP_CURL_TURNS, WISP_CURL_TIGHT, WISP_LEAN, WISP_DRAW_HEAD, WISP_DRAW_TAIL, WindWispsRenderer, ribbon, wispCount,
} from '../src/render/windWisps.js';

const lit = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

// the shader's path, term for term (swirl() in WISP_VS), at a curl of one
function swirl(s, seed, curl = 1) {
  const fract = (x) => x - Math.floor(x);
  const sc = 1 + (WISP_STROKE - 1) * curl;
  const arch = (WISP_ARCH + fract(seed * 19.3) * WISP_ARCH) * curl;
  if (s <= sc) {
    const a = s / sc, r = Math.sin(Math.PI * a);
    const wave = fract(seed * 53.9) < 0.5 ? 1 : 2 * (1 - 2 * a);
    return [s, arch * sc * r * r * wave];
  }
  const k = (s - sc) / (1 - sc);
  const R0 = WISP_CURL_R * (0.8 + fract(seed * 29.7) * 0.4);
  const th = k * WISP_CURL_TURNS * 2 * Math.PI;
  const r = R0 * (1 - (1 - WISP_CURL_TIGHT) * k * k);
  return [sc + r * Math.sin(th), R0 - r * Math.cos(th)];
}

test('WIND5: fewer - 240 at a gale, a couple of dozen in a calm; the sand untouched', () => {
  assert.equal(WISP_MAX, 240);
  assert.equal(WISP_FLOOR, 0.08);
  assert.equal(wispCount(1), 240); assert.equal(wispCount(0), 19);
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
  // a straight streak at a curl of 0 - the sand's
  for (const s of [0, 0.3, 0.7, 1]) assert.deepEqual(swirl(s, 0.4, 0).map((x) => x + 0), [s, 0]);   // + 0: a zero arch times an S's negative half is -0
  // the shader IS that path
  assert.ok(WISP_VS.includes(`float sc = mix(1.0, ${lit(WISP_STROKE)}, uCurl);`));
  assert.ok(WISP_VS.includes(`float arch = (${lit(WISP_ARCH)} + fract(seed*19.3)*${lit(WISP_ARCH)}) * uCurl;`));
  assert.ok(WISP_VS.includes('float wave = fract(seed*53.9) < 0.5 ? 1.0 : 2.0 * (1.0 - 2.0 * a);'));
  assert.ok(WISP_VS.includes('return vec2(s, arch * sc * r * r * wave);'));
  assert.ok(WISP_VS.includes(`float R0 = ${lit(WISP_CURL_R)} * (0.8 + fract(seed*29.7)*0.4);`));
  assert.ok(WISP_VS.includes(`float th = k * ${lit(WISP_CURL_TURNS)} * 2.0 * PI;`));
  assert.ok(WISP_VS.includes(`float r = R0 * (1.0 - ${lit(1 - WISP_CURL_TIGHT)} * k * k);`), 'eased in - a linear tightening kinked the join by four degrees');
  assert.ok(WISP_VS.includes('return vec2(sc, R0) + r * vec2(sin(th), -cos(th));'));
  // placed down the wind and across it in the curl's plane, the ribbon facing the eye along the path's own tangent
  assert.ok(WISP_VS.includes('p += (vel * (c.x - 0.5) + up * c.y) * len;'));
  assert.ok(WISP_VS.includes(`float lean = (fract(seed*41.3) * 2.0 - 1.0) * ${lit(WISP_LEAN)};`));
  assert.ok(WISP_VS.includes('vec3 up = (cos(lean) * vec3(0.0, 1.0, 0.0) + sin(lean) * across) * (fract(seed*7.7) < 0.5 ? 1.0 : -1.0);'), 'leaning off the vertical about the wind, curling up or down');
  assert.ok(WISP_VS.includes('vec3 t3 = vel * tg.x + up * tg.y;') && WISP_VS.includes('vec3 c0 = cross(length(t3) > 1e-6 ? t3 : vel, toEye);'));
  assert.doesNotMatch(WISP_VS.replace(/\/\/[^\n]*/g, ''), /\bflat\b/, 'no variable named flat - GLSL ES 3.00 reserves it and the program would not compile');
});

test('WIND5: THE PEN AND THE INK - swelling from the tail, thinning into the curl, drawn on and off along the path', () => {
  assert.deepEqual([WISP_DRAW_HEAD, WISP_DRAW_TAIL], [0.55, 0.45]);
  assert.ok(WISP_VS.includes('float pen = mix(1.0, smoothstep(0.0, 0.12, sAt) * (1.0 - 0.75 * smoothstep(0.3, 1.0, sAt)), uCurl);'));
  assert.ok(WISP_VS.includes(`vDraw = vec2(smoothstep(0.0, ${lit(WISP_DRAW_HEAD)}, ph) * 1.05, smoothstep(${lit(WISP_DRAW_TAIL)}, 1.0, ph) * 1.05 - 0.05);`), 'the head runs the path, the tail follows it off');
  assert.ok(WISP_FS.includes('float drawn = smoothstep(vDraw.y, vDraw.y + 0.06, vT) * (1.0 - smoothstep(vDraw.x - 0.06, vDraw.x, vT));'));
  assert.ok(WISP_FS.includes('float ink = 1.0 - pow(abs(vAcross * 2.0 - 1.0), 3.0);'));
  assert.ok(WISP_FS.includes('a = mix(a, drawn * ink * 1.6, uCurl);'), 'a straight streak keeps its old head-to-tail fade');
  assert.ok(WISP_FS.includes('a *= vLife * (uAlpha.x + uAlpha.y * uStrength);'), 'never more than a breath');
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
