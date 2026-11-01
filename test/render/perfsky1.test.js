// PERF-SKY1 (2026-10-10, the stars' part of the perf pass v5's slice - bible/07-Rendering/Performance-Crowd.md): THE
// STARS ARE A NIGHT'S. The Dynamic Skies pass weighs its stars by the night, and by day the night is 0 - so every sky
// pixel's star work would be multiplied by nothing. It runs under a night above 0 alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FS } from '../../src/render/dynamicSkiesRenderer.js';
import { skyFrame } from '../../src/systems/dynamicSkies/dynamicSkies.js';
import { glslFunctions } from '../glsl.mjs';

const stars = FS.slice(FS.indexOf('  // Stars'), FS.indexOf('  // End of Stars'));

test('PERF-SKY1: the stars\' layers and the river\'s tap run under a night above 0 alone - by a branch the frame alone decides (mutants: the branch dropped; a branch on the pixel\'s own place)', () => {
  const open = '  if (uNight > 0.0) {';
  assert.match(stars, /\n {2}vec3 stars = vec3\(0\.0\);\n {2}if \(uNight > 0\.0\) \{\n/, 'the stars are nothing until the night branch fills them');
  const branch = stars.slice(stars.indexOf(open), stars.indexOf('\n  }\n', stars.indexOf(open)));
  assert.equal((branch.match(/texture\(/g) ?? []).length, 1, 'the river\'s one tap inside it');
  assert.equal((stars.match(/texture\(/g) ?? []).length, 1, 'and none outside it');
  assert.equal((branch.match(/starLayer\(/g) ?? []).length, 2, 'both layers\' hashes inside it');
  assert.match(FS, /uniform float uNight;/, 'the night is the frame\'s, one for every fragment');
  assert.doesNotMatch(open, /dir|gl_FragCoord|vNdc/, 'never the pixel\'s own place');
  // THREE, run: a noon and a midnight frame, the moons and the layers out - by day no tap, by night the river's one
  const run = (minute) => {
    const st = skyFrame({ minuteOfDay: minute });
    let taps = 0;
    const f = glslFunctions(FS, {
      uYaw: 0.4, uPitch: 0.9, uTanHalfFov: 1, uAspect: 1, vNdc: [0, 0], uBandDither: 1, uDread: 0, uBrass: 0, uHazeSky: [0, 0, 0, 0],
      uSunDir: st.sunDir, uZenith: st.zenith, uHorizon: st.horizon, uGround: st.ground, uGlow: st.glow, uGlowPower: st.glowPower,
      uSunDisc: st.sunDisc, uSunCos: st.sunCos, uNight: st.night, uStarPole: st.starPole, uStarTurn: st.starTurn, uTwinkle: 1,
      uMasser: [0, 1, 0, 0.05], uSecunda: [0, 1, 0, 0.05], uMasserLight: [0, 1, 0], uSecundaLight: [0, 1, 0], uMasserColor: [0, 0, 0], uSecundaColor: [0, 0, 0],
      uCloudLow: [0, 0, 1, 0.1], uCloudHigh: [0, 0, 1, 0.1], uCloudOffset: [0, 0, 0, 0], uCloudLit: [1, 1, 1], uCloudShade: [0, 0, 0],
      uFogColor: [0, 0, 0], uFogMix: 0, texture: () => { taps++; return [0.5, 0.5, 0.5, 1]; },
    });
    f.main();
    return { taps, night: st.night };
  };
  const noon = run(720), midnight = run(0);
  assert.equal(noon.night, 0); assert.equal(noon.taps, 0, 'by day the stars cost no tap');
  assert.ok(midnight.night > 0.9); assert.equal(midnight.taps, 1, 'by night the river\'s one');
});
