// PERF-SKY1 (2026-10-10, the stars' part of the perf pass v5's slice - bible/07-Rendering/Performance-Crowd.md): THE
// STARS ARE A NIGHT'S. The Dynamic Skies dome weighs its stars by night * horizonValue, and by day night is 0 - so every
// sky pixel's three star taps and its twinkle were multiplied by nothing. They run under a night above 0 alone now.
// mix(col, stars, 0) is col exactly for any finite stars (the taps are saturated), so the picture is the mod's to the
// bit: the real pass in Chromium, main against the change, 24 views from dawn round to the small hours - every one
// byte for byte the same. (The pass's other half - the frame's constants worked out once a draw in place of every
// pixel - is not taken: its own measure found texels flipped inside a moon's face, and the picture is kept.)
//
// ONE: the taps are inside the night's branch, and nothing else of the FS moved into it. TWO: `night` is the sun's
// light position's alone - the same in every fragment of the draw, so the branch is dynamically uniform and the taps'
// implicit derivatives stay defined. THREE: the mix is the mod's - at night 0 it is col, whatever stars holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FS } from '../../src/render/dynamicSkiesRenderer.js';

const stars = FS.slice(FS.indexOf('  // Stars'), FS.indexOf('  // End of Stars'));

test('PERF-SKY1: the stars\' three taps and the twinkle run under a night above 0 alone - by a branch the sun alone decides, and the mod\'s mix after it (mutants: the branch dropped; a branch on the pixel\'s own place)', () => {
  const branch = stars.slice(stars.indexOf('  if (night > 0.0) {'), stars.indexOf('\n  }\n', stars.indexOf('  if (night > 0.0) {')));
  assert.match(stars, /\n {2}vec3 stars = vec3\(0\.0\);\n {2}if \(night > 0\.0\) \{\n/, 'the stars are nothing until the night branch fills them');
  assert.equal((branch.match(/texture\(/g) ?? []).length, 3, 'the three taps - the stars, their twinkle\'s alpha, the twinkle - inside it');
  assert.equal((stars.match(/texture\(/g) ?? []).length, 3, 'and none outside it');
  assert.match(FS, /float sunDotUp = dot\(sunPos, vec3\(0\.0, 1\.0, 0\.0\)\);\n {2}float night = saturate\(Remap\(sunDotUp, vec2\(_NightStartHeight, _NightEndHeight\), vec2\(0\.0, 1\.0\)\)\);/, 'night is the sun\'s alone');
  assert.match(FS, /vec3 sunPos = _WorldSpaceLightPos0\.xyz;/, '...and the sun is the light\'s position, one for every fragment');
  assert.equal((stars.match(/finalStarsColor = mix\(col\.rgb, stars, night \* horizonValue\);/g) ?? []).length, 2, 'the mix is the mod\'s, above the horizon and below: at night 0 it is col');
});
