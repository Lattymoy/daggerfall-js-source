// SD14c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7 and section 16's SD14c;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S MOTES (render/sdMotes.js) - over a thousand
// where the Deadlands carry 896: the hall's brass dust turning with the Orrery, the void's sparks rising under the
// Steps and gone by a body's height, the Hour's gold-green motes orbiting the arena against the clock, the shards' dust
// falling out of the sky. Their law (sdMoteAt) keeps each kind in its place, whole over the sky's period, every jump at
// a life's wrap unseen; the vertex shader RUN holds the same law; a mote under two pixels drawn two wide and faded; the
// world host draws it in the Hour's world pass in its fog and its sky's light. In a real browser: tools/sdMotesProbe.mjs.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import {
  sdMoteVertices, sdMoteAt, sdMotePx, SdMotesRenderer, SD_MOTES, SD_MOTES_TOTAL, SD_MOTE_TURNS, SD_MOTE_HALL, SD_MOTE_VOID, SD_MOTE_ARENA,
  SD_MOTE_SKY, SD_MOTE_MIN_PX, SD_MOTES_VS, SD_MOTES_FS,
} from '../src/render/sdMotes.js';
import { lifeVertices } from '../src/render/deadlands.js';
import { SD_SKY_PERIOD } from '../src/render/sdSky.js';
import { SD_ORRERY, SD_ARENA, SD_REALM_ORIGIN } from '../src/net/sdBrain.js';
import { SD_FIRST_STEP } from '../src/world/sdHall.js';
import { SD_COURSE_END } from '../src/world/sdSteps.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const V = sdMoteVertices();
const motes = Array.from({ length: V.length / 4 }, (_, i) => [V[i * 4], V[i * 4 + 1], V[i * 4 + 2], V[i * 4 + 3]]);
const TIMES = [0, 13.7, 97.25, 359.9, 512.5, 719.95];

test('SD14c OVER A THOUSAND: four kinds, seeded and pure - more than the Deadlands\' own air carries; every draw in [0, 1) (mutants: a kind unseeded; fewer than the Deadlands\')', () => {
  assert.equal(SD_MOTES_TOTAL, 1220);
  assert.ok(SD_MOTES_TOTAL > 1000 && SD_MOTES_TOTAL > lifeVertices().length / 4, `${SD_MOTES_TOTAL} against the Deadlands' ${lifeVertices().length / 4}`);
  assert.equal(motes.length, SD_MOTES_TOTAL);
  assert.deepEqual([0, 1, 2, 3].map((k) => motes.filter((m) => m[0] === k).length), [SD_MOTES.dust, SD_MOTES.sparks, SD_MOTES.hour, SD_MOTES.shards]);
  assert.ok(motes.every((m) => m.slice(1).every((x) => x >= 0 && x < 1)));
  assert.deepEqual(sdMoteVertices(), V, 'pure');
  assert.notDeepEqual(sdMoteVertices(7), V, 'its seed');
});

test('SD14c EACH IN ITS PLACE: the hall\'s dust inside its ring and its height round the Orrery; the void\'s sparks under the course - between the first step and its end, under a body\'s height; the Hour\'s motes round the arena at its height; the shards\' dust in the sky; every size and alpha in bounds (mutants: the dust out of the hall; the sparks above the Steps; the Hour\'s off the arena)', () => {
  for (const t of TIMES) {
    for (const [k, a, b, c] of motes) {
      const m = sdMoteAt(k, a, b, c, t), [x, y, z] = m.p;
      assert.ok(m.size > 0 && m.size < 1 && m.alpha >= 0 && m.alpha <= 1 && m.heat >= 0 && m.heat <= 1);
      if (k === 0) {
        assert.ok(Math.hypot(x - SD_ORRERY.x, z - SD_ORRERY.z) <= SD_MOTE_HALL.r + 1e-9 && y >= SD_MOTE_HALL.y[0] - 1e-9 && y <= SD_MOTE_HALL.y[1] + 1e-9, `dust at ${m.p}`);
        assert.ok(z < SD_FIRST_STEP.z - SD_FIRST_STEP.r && Math.hypot(x - SD_ORRERY.x, z - SD_ORRERY.z) <= SD_ORRERY.r + 4, 'the hall\'s alone - never out over the Steps');
      }
      if (k === 1) {
        assert.ok(Math.abs(x) <= SD_MOTE_VOID.halfW + 0.81 && y >= SD_MOTE_VOID.y[0] - 1e-9 && y <= SD_MOTE_VOID.y[1] + 1e-9, `a spark at ${m.p}`);
        assert.ok(z >= SD_FIRST_STEP.z && z <= SD_COURSE_END, 'under the course');
        assert.ok(y <= 1.5, 'gone by a body\'s height');
      }
      if (k === 2) { const r = Math.hypot(x - SD_ARENA.x, z - SD_ARENA.z); assert.ok(r >= SD_MOTE_ARENA.r[0] - 1e-9 && r <= SD_MOTE_ARENA.r[1] + 1e-9 && y >= SD_MOTE_ARENA.y[0] - 1e-9 && y <= SD_MOTE_ARENA.y[1] + 1e-9); }
      if (k === 3) { assert.ok(y >= SD_MOTE_SKY.y[0] - 1e-9 && y <= SD_MOTE_SKY.y[1] + 1e-9 && Math.hypot(x, z - (SD_ORRERY.z + SD_ARENA.z) / 2) <= SD_MOTE_SKY.r + 1e-9); }
    }
  }
});

test('SD14c ON THE HOUR\'S CLOCK: every mote whole over the sky\'s period (the same at t and a period on), each kind\'s lives whole turns; between two frames no mote seen jumps - a life\'s wrap only where it is unseen; the Hour\'s motes orbiting AGAINST the clock and the hall\'s dust with it (mutants: a rate not whole; a spark seen at its wrap; the orbit with the clock)', () => {
  for (const [, [lo, hi]] of Object.entries(SD_MOTE_TURNS)) assert.ok(Number.isInteger(lo) && Number.isInteger(hi) && lo > 0 && hi > lo);
  for (const [k, a, b, c] of motes.filter((_, i) => i % 7 === 0)) {
    for (const t of [3.3, 401.1]) {
      const m0 = sdMoteAt(k, a, b, c, t), m1 = sdMoteAt(k, a, b, c, t + SD_SKY_PERIOD);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(m0.p[i] - m1.p[i]) < 1e-6, 'whole over the period');
      assert.ok(Math.abs(m0.alpha - m1.alpha) < 1e-9);
    }
    // a frame on: a jump only where it is unseen
    for (let t = 0; t < SD_SKY_PERIOD; t += 4.3) {
      const m0 = sdMoteAt(k, a, b, c, t), m1 = sdMoteAt(k, a, b, c, t + 1 / 60);
      const d = Math.hypot(m1.p[0] - m0.p[0], m1.p[1] - m0.p[1], m1.p[2] - m0.p[2]);
      if (d > 0.5) assert.ok(Math.min(m0.alpha, m1.alpha) < 0.02, `kind ${k} jumped ${d.toFixed(2)} m seen (${m0.alpha.toFixed(3)}, ${m1.alpha.toFixed(3)})`);
    }
  }
  const angAt = (m) => Math.atan2(m.p[2] - SD_ARENA.z, m.p[0] - SD_ARENA.x);
  const hour = motes.find((m) => m[0] === 2), h0 = sdMoteAt(...hour, 100), h1 = sdMoteAt(...hour, 100.5);
  assert.ok(Math.sin(angAt(h1) - angAt(h0)) < 0, 'the Hour\'s motes against the clock');
  const dust = motes.find((m) => m[0] === 0), d0 = sdMoteAt(...dust, 100), d1 = sdMoteAt(...dust, 101);
  const dAng = (m) => Math.atan2(m.p[2] - SD_ORRERY.z, m.p[0] - SD_ORRERY.x);
  assert.ok(Math.sin(dAng(d1) - dAng(d0)) > 0, 'the hall\'s dust with it');
});

test('SD14c THE SHADER HOLDS THE LAW - its vertex stage RUN for motes of every kind at several times puts each where sdMoteAt does, at its alpha and warmth (the realm\'s origin added); a mote under SD_MOTE_MIN_PX drawn that wide and faded by how much smaller it is (mutants: the shader off the law; small motes dropped; small motes at full light)', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const pick = [0, 1, 2, 3].flatMap((k) => motes.filter((m) => m[0] === k).slice(0, 5));
  for (const t of [11.25, 333.3]) {
    for (const m of pick) {
      const f = glslFunctions(SD_MOTES_VS, { aSeed: m, uVP: I, uOrigin: SD_REALM_ORIGIN, uTime: t, uPxPerM: 1e6 });
      f.main();
      const g = f.globals, law = sdMoteAt(...m, t);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(g.vWorld[i] - (SD_REALM_ORIGIN[i] + law.p[i])) < 1e-6, `kind ${m[0]}: the shader's place is the law's`);
      assert.ok(Math.abs(g.vAlpha - law.alpha) < 1e-6 && Math.abs(g.vHeat - law.heat) < 1e-9);
    }
  }
  // far: drawn SD_MOTE_MIN_PX across, faded by its true width
  const m = pick[0], law = sdMoteAt(...m, 50);
  const far = glslFunctions(SD_MOTES_VS, { aSeed: m, uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uOrigin: [0, 0, -1e5], uTime: 50, uPxPerM: 10 });
  far.main();
  const want = sdMotePx(law.size, far.globals.gl_Position[3], 10);
  assert.equal(far.globals.gl_PointSize, SD_MOTE_MIN_PX);
  assert.ok(want.keep < 1 && Math.abs(far.globals.vAlpha - law.alpha * want.keep) < 1e-9, 'faded by how much smaller');
  assert.deepEqual(sdMotePx(0.5, 1, 100), { px: 32, keep: 1 }, 'near: as wide as it is, to the bound');
  assert.match(SD_MOTES_FS, /if \(d > 1\.0 \|\| vAlpha <= 0\.001\) discard;/);
});

test('SD14c DRAWN: one draw of every mote, added, depth-tested and never written, its program\'s fog and the realm\'s origin set; the world host draws it in the Hour\'s world pass beside its blows and loot lines, in their fog and the sky\'s light (mutants: written into the depth; never drawn; drawn out of the pass)', () => {
  const calls = [];
  const gl = new Proxy({ drawingBufferHeight: 720, POINTS: 0, DEPTH_TEST: 1, BLEND: 2, ONE: 3, ARRAY_BUFFER: 4, STATIC_DRAW: 5, FLOAT: 6, VERTEX_SHADER: 7, FRAGMENT_SHADER: 8, COMPILE_STATUS: 9, LINK_STATUS: 10 }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      return (...a) => { calls.push([k, ...a]); return {}; };
    },
  });
  const r = new SdMotesRenderer(gl);
  const P = [1, 0, 0, 0, 0, 1.6, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0];
  assert.equal(r.draw(P, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 12, { mode: 2, density: 0.02, range: [0, 1], camPos: [1, 2, 3] }, 1.2, 600), true);
  assert.equal(r.drawn, SD_MOTES_TOTAL);
  const draw = calls.find((c) => c[0] === 'drawArrays');
  assert.deepEqual(draw.slice(1), [0, 0, SD_MOTES_TOTAL]);
  assert.ok(calls.some((c) => c[0] === 'depthMask' && c[1] === false) && calls.findIndex((c) => c[0] === 'depthMask' && c[1] === false) < calls.indexOf(draw), 'never written');
  assert.ok(calls.some((c) => c[0] === 'blendFunc' && c[1] === 3 && c[2] === 3), 'added');
  assert.ok(calls.some((c) => c[0] === 'uniform3fv' && c[2] === SD_REALM_ORIGIN), 'the realm\'s origin');
  assert.equal(r.draw(P, P, NaN), false, 'no clock: nothing');
  assert.match(W, /const motes = !!sdMotesPassOf\(\)\?\.draw\(proj, view, deadlandsSeconds\(\), fog, skyGain\(renderer\._fogColor, SD_REALM_FOG\.color\), renderer\.worldViewportPx\?\.\[3\]\); if \(blows \|\| lines \|\| motes\)/);
});
