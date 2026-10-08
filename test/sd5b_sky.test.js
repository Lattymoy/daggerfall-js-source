// SD5b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR'S SKY
// (render/sdSky.js) - painted as the Deadlands' is: a void of brass light and stars, slow aurorae, three of the Bay's
// skylines hanging upside down and drifting round, and a clock-face of stars over the arena whose hands run backwards;
// every rate whole cycles over its period on the realm's anchored clock, so every screen shows one moment and the sky
// never jumps. (Its GLSL was compiled and linked in Chromium's WebGL2 when it was written; these pin its laws.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SdSkyRenderer, SD_SKY_VS, SD_SKY_FS, SD_SKY_PERIOD, sdSkyClock, SD_CLOCK_FACE, SD_SKY_SHARDS, SD_SHARD_TOP, SD_AURORA } from '../src/render/sdSky.js';
import { DEAD_NOISE_GLSL } from '../src/render/deadlands.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SD5b the clock: wrapped to its period, every rate a whole number of cycles over it - the hands, the aurorae, each shard - so the sky never jumps when the clock wraps (mutants: a rate that does not divide the period)', () => {
  assert.equal(sdSkyClock(0), 0);
  assert.equal(sdSkyClock(SD_SKY_PERIOD + 5), 5);
  assert.equal(sdSkyClock(-5), SD_SKY_PERIOD - 5);
  for (const k of [SD_CLOCK_FACE.hourTurns, SD_CLOCK_FACE.minuteTurns, SD_AURORA.turns, ...SD_SKY_SHARDS.map((s) => s.turns)]) assert.ok(Number.isInteger(k) && k !== 0, `${k} whole turns`);
  assert.match(SD_SKY_FS, new RegExp(`const float PERIOD = ${SD_SKY_PERIOD.toFixed(1)};`));
  assert.equal((SD_SKY_FS.match(/uTime \/ PERIOD/g) ?? []).length, 2 + SD_SKY_SHARDS.length, 'the hands\' turn, the aurorae\'s drift and each shard\'s, all over the one period');
});

test('SD5b the clock-face hangs over the arena (+z, the realm\'s forward), its hands turning BACKWARDS - the Hour unwinding; the minute hand twelve times the hour\'s (mutants: the hands run forwards)', () => {
  assert.equal(SD_CLOCK_FACE.az, 0, 'toward the arena');
  assert.ok(SD_CLOCK_FACE.elev > 0 && SD_CLOCK_FACE.elev + SD_CLOCK_FACE.r < Math.PI / 2, 'above the horizon, under the zenith');
  assert.match(SD_SKY_FS, /float back = -TAU \* uTime \/ PERIOD;/, 'backwards');
  assert.equal(SD_CLOCK_FACE.minuteTurns, 12 * SD_CLOCK_FACE.hourTurns);
  assert.match(SD_SKY_FS, /float az = atan\(d\.x, d\.z\);/, 'azimuth from +z');
});

test('SD5b the shards: Daggerfall\'s towers, Sentinel\'s domes and Wayrest\'s bridge, hanging from the upper sky, round the sides and behind - never over the arena\'s clock - drifting their own ways (mutants: a shard over the clock-face)', () => {
  assert.deepEqual(SD_SKY_SHARDS.map((s) => s.name), ['daggerfall', 'sentinel', 'wayrest']);
  for (const s of SD_SKY_SHARDS) {
    assert.ok(Math.abs(Math.atan2(Math.sin(s.az - SD_CLOCK_FACE.az), Math.cos(s.az - SD_CLOCK_FACE.az))) > SD_CLOCK_FACE.r + s.halfW, `${s.name} clear of the clock at the clock's zero`);
    assert.ok(SD_SHARD_TOP - s.depth > 0.4, `${s.name} hangs in the upper sky`);
  }
  assert.ok(new Set(SD_SKY_SHARDS.map((s) => Math.sign(s.turns))).size === 2, 'not all one way');
  for (let i = 0; i < SD_SKY_SHARDS.length; i++) assert.match(SD_SKY_FS, new RegExp(`float skyline${i}\\(float u, float v\\)`));
  assert.ok(SD_AURORA.low > 0 && SD_AURORA.high < Math.PI / 2 && SD_AURORA.low < SD_AURORA.high);
});

test('SD5b the shaders: the Deadlands\' ray and noise, one triangle at the far plane, the uniforms the draw sets (mutants: the sky off the far plane)', () => {
  assert.match(SD_SKY_VS, /gl_Position = vec4\(aPos, 1\.0, 1\.0\);/, 'at the far plane');
  assert.match(SD_SKY_VS, /vRay = uRight \* \(\(aPos\.x \+ uProj\.z\) \/ uProj\.x\) \+ uUp \* \(\(aPos\.y \+ uProj\.w\) \/ uProj\.y\) \+ uFwd;/, 'the Deadlands\' own ray');
  assert.ok(SD_SKY_FS.includes(DEAD_NOISE_GLSL), 'the Deadlands\' noise');
  for (const u of ['uTime', 'uHaze', 'uGain']) assert.match(SD_SKY_FS, new RegExp(`uniform [a-z0-9]+ ${u};`));
  assert.match(SD_SKY_FS, /^#version 300 es\nprecision highp float;/);
});

/** A WebGL2 that records what is asked of it. */
function fakeGl() {
  const calls = [];
  const gl = new Proxy({ calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
      return (...a) => { calls.push([k, ...a]); if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray') return { k }; if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return undefined; };
    },
  });
  return gl;
}

test('SD5b the draw: depth-tested at LEQUAL and never written, no blend, both faces - and every one of them handed back; the clock wrapped, the haze the frame\'s fog, the gain the realm\'s (mutants: depth written; the compare left at LEQUAL)', () => {
  const gl = fakeGl();
  const sky = new SdSkyRenderer(/** @type {any} */ (gl));
  gl.calls.length = 0;
  const id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(sky.draw(id, id, SD_SKY_PERIOD + 7, { color: [0.3, 0.2, 0.1] }, 0.8), true);
  const names = gl.calls.map((c) => c[0]);
  const at = (k, ...a) => gl.calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  assert.ok(at('depthMask', false) >= 0 && at('depthMask', false) < at('drawArrays', 'TRIANGLES', 0, 3), 'never written');
  assert.ok(at('depthFunc', 'LEQUAL') < at('drawArrays', 'TRIANGLES', 0, 3), 'only where nothing nearer drew');
  assert.ok(at('depthFunc', 'LESS') > at('drawArrays', 'TRIANGLES', 0, 3), 'the compare handed back');
  assert.ok(at('depthMask', true) > at('drawArrays', 'TRIANGLES', 0, 3), 'the depth write handed back');
  assert.ok(at('enable', 'CULL_FACE') > at('drawArrays', 'TRIANGLES', 0, 3), 'culling handed back');
  assert.ok(names.includes('disable') && at('disable', 'BLEND') >= 0);
  assert.deepEqual(gl.calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uTime').slice(2), [7], 'wrapped');
  assert.deepEqual(gl.calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uHaze')[2], [0.3, 0.2, 0.1]);
  assert.deepEqual(gl.calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uGain').slice(2), [0.8]);
  assert.equal(sky.drawn, true);
});

test('SD5b the hosts by source: the dungeon arm paints it after the Hour\'s islands and before its flats; the world host builds it once, on the realm\'s anchored clock, in its haze and at its gain, a foreign pass marked (mutants: the sky unpainted)', () => {
  const W = read('src/scenes/worldModes.js');
  const back = W.indexOf('if (isGateArena(dungeonLoc)) host.drawGateBackdrop?.({ proj, view, eye: mwv.eye });');
  const sky = W.indexOf('if (isSdRealm(dungeonLoc)) host.drawSdSky?.({ proj, view, eye: mwv.eye });');
  const statics = W.indexOf('for (const d of dungeonCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, dungeonCtx.texRemap);');
  const flats = W.indexOf('renderer.drawBillboards([...dungeonCtx.billboardBatches,');
  assert.ok(back > 0 && sky > back && sky > statics && sky < flats, 'after the islands, before the flats');
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(p\?\.draw\(proj, view, deadlandsSeconds\(\), courtFogNow\(\), skyGain\(renderer\._fogColor, SD_REALM_FOG\.color\)\)\) renderer\.markForeignPass\(\);/);
  assert.match(w, /if \(_sdSkyPass === undefined\) \{ try \{ _sdSkyPass = new SdSkyRenderer\(renderer\.gl\); \}/);
  assert.match(w, /const deadlandsSeconds = anchoredClock\(\{ perf: \(\) => performance\.now\(\), wall: \(\) => Date\.now\(\) \+ _sharedOffsetMs \}\);/, 'the realm\'s clock is the Deadlands\' anchored one - the relay\'s');
  assert.match(read('bible/07-Rendering/Rendering.md'), /`sdSky\.js` - SD5b:/);
  assert.match(read('bible/11-Multiplayer/Super-Dungeons.md'), /### SD5b - shipped 2026-10-07/);
});
