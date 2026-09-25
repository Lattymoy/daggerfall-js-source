// WISPS-RETURN (2026-09-25, Mac: "I want to return to the original wind wisps before our current design") - THE
// WISPS ARE STREAKS AGAIN. WIND5 (2026-09-23) had made each wisp a calligraphic flourish: a 40-segment ribbon along an
// arched or S stroke ending in a tightening curl, swelling and thinning like a pen, soft across like ink, drawn on and
// off along its path. That design is retired, and a wisp is WIND3's thin quad along the wind again: one straight
// streak its look's length, the same width end to end, faced to the eye, faint at the tail and brightest toward the
// head, fading in and out whole on its own clock. DISC17-A's count and alpha stay (disc17.test.js), as do AUDIT-VC7's
// whole clock (wind3_windworld.test.js) and AUDIT 68's exact wrap (audit68_render_b.test.js).
//
// Every pin here runs the real renderer's uploads through the shaders' own main()s (test/wispShade.mjs), so it holds
// what a frame of the game draws, not a restatement of it. Each fails on the base, where the renderer uploaded a curl
// and the shaders drew the flourish.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as windWisps from '../src/render/windWisps.js';
import { WISP_VS, WISP_FS, WISP_LOOK, SAND_LOOK, wispCount, wispClock } from '../src/render/windWisps.js';
import { drawOnce, shade } from './wispShade.mjs';

const fract = (x) => x - Math.floor(x);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(...a);
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const EYE = [0, 1.7, 0];
const WIND = [3, 4], VEL = [0.6, 0, 0.8];   // a wind along a diagonal, where a wrong axis shows

test('WISPS-RETURN: a wisp is one straight streak down the wind - its whole length on one line along the wind, the look\'s length at the strength, the same width end to end, square to the wind and to the eye\'s ray; the sand\'s grains the same shape', () => {
  for (const look of [WISP_LOOK, SAND_LOOK]) {
    for (const strength01 of [1, 0.3]) {
      const { uploads } = drawOnce(look, { on: true, strength01, windV: WIND, step: [0.7, -0.4] }, { eye: EYE, seconds: 3 });
      for (const seed of [0.07, 0.31, 0.58, 0.83]) {
        const what = `${look === SAND_LOOK ? 'sand' : 'wisps'} at ${strength01}, seed ${seed}`;
        const len = (look.len[0] + fract(seed * 13.1) * look.len[1]) * (0.5 + strength01);
        const sz = 0.05 + fract(seed * 11.7) * 0.05;
        const P = (y) => shade(uploads, [0.5, y], seed).p;
        const p0 = P(0);
        for (const y of [0.25, 0.5, 0.75, 1]) {
          const off = sub(P(y), p0), want = VEL.map((v) => v * y * len);
          assert.ok(norm(sub(off, want)) < 1e-9, `${what}: ${y} of the way along is ${y} of its length down the wind (off by ${norm(sub(off, want)).toExponential(2)} m)`);
        }
        for (const y of [0, 0.3, 0.6, 1]) {
          const c = P(y), w = sub(shade(uploads, [1, y], seed).p, shade(uploads, [0, y], seed).p), toEye = sub(uploads.uEye, c);   // the eye as uploaded (float32)
          assert.ok(Math.abs(norm(w) - sz) < 1e-9, `${what}: ${sz.toFixed(4)} m wide at ${y} (${norm(w).toFixed(4)}) - no pen`);
          assert.ok(Math.abs(dot(w, VEL)) / norm(w) < 1e-9, `${what}: its width square to the wind at ${y}`);
          assert.ok(Math.abs(dot(w, toEye)) / (norm(w) * norm(toEye)) < 1e-9, `${what}: its width square to the eye's ray at ${y}`);
        }
      }
    }
  }
});

test('WISPS-RETURN: the streak\'s fade is WIND3\'s - nothing at the tail, full from 0.45 of the way to 0.85, gone at the head, whole across its width, the look\'s alpha times its life - never drawn on', () => {
  const seed = 0.37, rate = 0.35 + Math.floor(fract(seed * 5.3) * windWisps.WISP_RATE_STEPS) * (0.25 / windWisps.WISP_RATE_STEPS);
  const shape = (t) => smoothstep(0, 0.45, t) * (1 - smoothstep(0.85, 1, t));
  for (const strength01 of [1, 0]) {
    for (const ph of [0.5, 0.2, 0.9]) {
      const seconds = (ph - fract(seed * 7) + 3) / rate;   // the moment the wisp's life is at `ph`
      const { uploads } = drawOnce(WISP_LOOK, { on: true, strength01, windV: WIND, step: [0, 0] }, { eye: EYE, seconds });
      const life = Math.sin(fract(wispClock(seconds) * rate + seed * 7) * 3.14159);
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const want = shape(t) * life * (WISP_LOOK.alpha[0] + WISP_LOOK.alpha[1] * strength01);
        for (const x of [0, 0.25, 0.5, 1]) {
          const got = shade(uploads, [x, t], seed).alpha;
          assert.ok(Math.abs(got - want) < 1e-9, `strength ${strength01}, life ${ph}, ${t.toFixed(2)} along, ${x} across: ${got} where WIND3's fade gives ${want}`);
        }
      }
    }
  }
});

test('WISPS-RETURN: the renderer draws one quad a wisp in both looks - the six corners it always had, uploads every uniform the shaders declare and nothing else; the flourish\'s constants, its ribbon and the looks\' curl are gone', () => {
  const declared = new Set([...(WISP_VS + WISP_FS).matchAll(/\buniform\s+\w+\s+([^;]+);/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())));
  for (const look of [WISP_LOOK, SAND_LOOK]) {
    const { built, frame, uploads } = drawOnce(look, { on: true, strength01: 1, windV: WIND, step: [0, 0] });
    const buffers = built.filter((c) => c[0] === 'bufferData').map((c) => Array.from(c[2]));
    assert.deepEqual(buffers[0], [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 'the quad: two triangles over (across, along)');
    assert.equal(buffers[1].length, look.count * 4, 'then the instances');
    assert.deepEqual(frame.filter((c) => c[0] === 'drawArraysInstanced'), [['drawArraysInstanced', 'TRIANGLES', 0, 6, wispCount(1, look)]], 'six corners a wisp, one draw');
    assert.deepEqual(new Set(built.filter((c) => c[0] === 'getUniformLocation').map((c) => c[1])), declared, 'the locations asked for are the declared uniforms');
    assert.deepEqual(new Set(Object.keys(uploads)), declared, 'and every one is uploaded, nothing else');
    assert.equal(Object.hasOwn(look, 'curl'), false, 'a look has no curl');
  }
  for (const gone of ['ribbon', 'WISP_SEGMENTS', 'WISP_STROKE', 'WISP_ARCH', 'WISP_CURL_R', 'WISP_CURL_TURNS', 'WISP_CURL_TIGHT', 'WISP_LEAN', 'WISP_DRAW_HEAD', 'WISP_DRAW_TAIL']) {
    assert.equal(Object.hasOwn(windWisps, gone), false, `${gone} retired with the flourish`);
  }
  assert.doesNotMatch(WISP_VS + WISP_FS, /\bswirl\b|\buCurl\b|\bvDraw\b|\bvAcross\b/, 'no path, curl, draw-on or ink in the shaders');
});
