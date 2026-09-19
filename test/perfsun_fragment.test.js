// PERF-SUN (2026-09-19, Mac: "exterior shadows at a distance, tree sway at
// a distance, and whatever else can cause insane performance issues. On
// the outside, I'm receiving over 1000 calls and looking up in the sky
// restores frame rate").
//
// LOOKING UP IS THE DIAGNOSIS. The sun cascades are built around the EYE,
// not the view direction, and the shadow replays cull by the cascade's own
// frustum - none of that changes when the camera tilts. What DOES change
// is the number of shaded fragments. A frame that comes back when you look
// at the sky is a frame spending itself PER FRAGMENT, and the exterior's
// ground is nearly the whole of it.
//
// Two costs were being paid there, on every lit texel of the world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHADOW_GLSL, SHADOW_CASCADES, SHADOW_PCF_CASCADES, SHADOW_SUN_SIZE } from '../src/render/shadowPass.js';
import { EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_BB_FS } from '../src/render/enhancedLighting.js';
import { waterSurfaceFs } from '../src/render/waterSurface.js';
import { floraSwayOn, floraSwayOf, swayDisabled } from '../src/systems/windDrive.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PERF-SUN1: the far cascade takes ONE tap, and the near ones keep the kernel', () => {
  // Each tap is ALREADY a hardware 2x2: the sun map is
  // COMPARE_REF_TO_TEXTURE with LINEAR filtering, so `texture()` on it is
  // a bilinear PCF over four texels and the 3x3 loop is an effective 4x4.
  // THE SUN MAP'S OWN BLOCK, not the file. The cube map below sets the
  // same two parameters on the same target, so a file-wide grep passed
  // clean over the sun's removal - the first draft of this pin did, and
  // two mutants walked through it.
  const all = read('src/render/shadowPass.js');
  const sunFrom = all.indexOf('const sun = gl.createTexture();');
  const sunTo = all.indexOf('// the cube map', sunFrom);
  assert.ok(sunFrom > 0 && sunTo > sunFrom, 'the sun map\u2019s setup block is where this pin thinks it is');
  const sp = all.slice(sunFrom, sunTo);
  assert.match(sp, /gl\.texParameteri\(gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_COMPARE_MODE, gl\.COMPARE_REF_TO_TEXTURE\);/,
    'the comparison sampler - without it a single tap really would be one texel');
  assert.match(sp, /gl\.texParameteri\(gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_MIN_FILTER, gl\.LINEAR\);/, '...filtered, which is what makes one tap a 2x2');
  // the branch, and which side of it each cascade falls
  assert.match(SHADOW_GLSL, /if \(c >= 2\) return texture\(uSunShadow, vec4\(p\.xy, float\(c\), ref\)\);/,
    'the far cascade returns on one tap, before the loop');
  assert.equal(SHADOW_PCF_CASCADES, 2);
  assert.ok(SHADOW_PCF_CASCADES < SHADOW_CASCADES.length, 'at least one cascade is cheap, or the change does nothing');
  assert.ok(SHADOW_PCF_CASCADES >= 1, 'and at least one keeps the kernel, or EL7’s contact hairline goes');
  // the loop is still there for the near cascades
  assert.match(SHADOW_GLSL, /for \(int y = -1; y <= 1; y\+\+\)/);
  assert.match(SHADOW_GLSL, /return lit \/ 9\.0;/);
  // ...and the return is BEFORE the loop, or it saves exactly nothing
  assert.ok(SHADOW_GLSL.indexOf('if (c >= 2) return texture(uSunShadow') < SHADOW_GLSL.indexOf('for (int y = -1; y <= 1; y++)'),
    'the cheap tap returns before the kernel runs');
  // WHY the far one can afford it, in numbers rather than assertion: a
  // texel of the far cascade against a pixel at a hundred metres.
  const farTexel = 2 * SHADOW_CASCADES[SHADOW_CASCADES.length - 1] / SHADOW_SUN_SIZE;
  const nearTexel = 2 * SHADOW_CASCADES[0] / SHADOW_SUN_SIZE;
  assert.ok(nearTexel < 0.02, `the near cascade's texel is ${(nearTexel * 100).toFixed(1)} cm - the contact hairline, and it keeps its kernel`);
  const pixelAt100m = 100 * (2 * Math.tan(Math.PI / 6)) / 1080;   // a 60-degree field, 1080 rows
  assert.ok(farTexel / pixelAt100m < 3,
    `the far texel (${(farTexel * 100).toFixed(0)} cm) is ${(farTexel / pixelAt100m).toFixed(1)} pixels at 100 m - one hardware 2x2 already covers it`);
  // and the far cascade is MOST of an outdoor screen: everything past the
  // second radius, which is where the saving comes from
  assert.ok(SHADOW_CASCADES[1] < 60, `cascade 2 begins at ${SHADOW_CASCADES[1]} units, so it is nearly everything the eye sees outdoors`);
});

test('PERF-SUN2: the sun’s shadow is not read where the sun cannot reach', () => {
  // This was one flat product - `max(dot(n, L), 0) * cloudShadowAt() *
  // sunShadowAt()` - and GLSL evaluates every operand of one. A surface
  // facing AWAY from the sun paid nine hardware-PCF compares and a
  // cloud-deck sample and multiplied them by the zero in front of them:
  // every north-facing wall, every back slope, and the whole world
  // whenever the sun is low.
  // count over the CODE, not the prose: the note above each of these
  // quotes the expression it is about, and a pin that counts its own
  // explanation is measuring the wrong thing.
  const code = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const [name, raw] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    const src = code(raw);
    assert.match(src, /float ndl = max\(dot\(n, uLightDir\), 0\.0\);/, `${name}: n.L is taken first`);
    assert.match(src, /float diff = \(uSunScale > 0\.0 && ndl > 0\.0\) \? ndl \* cloudShadowAt\(vWorldPos\) \* sunShadowAt\(vWorldPos, n\) : 0\.0;/,
      `${name}: and the lookups sit behind it`);
    assert.doesNotMatch(src, /float diff = max\(dot\(n, uLightDir\), 0\.0\) \* cloudShadowAt/, `${name}: the flat product is gone`);
    // OUTPUT-IDENTICAL, and this is why: diff reaches the light exactly
    // once, multiplied by uSunScale. Gating on either factor cannot
    // change a pixel - it only skips arriving at the same zero.
    assert.equal((src.match(/\buSunScale\s*\*\s*diff\b/g) ?? []).length, 1, `${name}: diff has exactly one consumer`);
    assert.equal((src.match(/\bdiff\b/g) ?? []).length, 2, `${name}: ...and exactly one writer beside it`);
  }
  // the WATER takes the uniform half only: its `shadow` is a term of its
  // own and the ndl gate would be a second question about it
  const water = code(waterSurfaceFs('', SHADOW_GLSL));
  assert.match(water, /float shadow = uSunScale > 0\.0 \? cloudShadowAt\(vWorldPos\) \* sunShadowAt\(vWorldPos, n\) : 0\.0;/);
  assert.equal((water.match(/\buSunScale\s*\*\s*diff\b/g) ?? []).length, 1, 'the water’s diff has one consumer too');
  // and the water WITHOUT the lane still compiles as an expression - the
  // gate must not depend on the block that is not pasted in
  const plain = code(waterSurfaceFs('', ''));
  assert.match(plain, /float shadow = uSunScale > 0\.0 \? cloudShadowAt\(vWorldPos\) : 0\.0;/, 'the classic water takes the same gate without the sun map');
  assert.doesNotMatch(plain, /sunShadowAt/, '...and does not name a function it was never given');
});

test('PERF-SUN2: a FLAT has no normal, so its gate is the sun’s own share of the tint', () => {
  // Every sprite in the world - every tree, person, sign and weed - read
  // nine shadow compares per fragment at midnight, for a term that is
  // zero. uBBSun IS the sun's whole share, so this is a uniform branch:
  // free, coherent, and it takes out the entire night.
  const bb = EL_BB_FS.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.match(bb, /vec3 sunLit = dot\(uBBSun, uBBSun\) > 0\.0 \? uBBSun \* cloudShadowAt\(vBBWorld\) \* sunShadowAt\(base, vec3\(0\.0, 1\.0, 0\.0\)\) : vec3\(0\.0\);/);
  assert.match(bb, /uTint \+ sunLit \+ elPointFlat/, 'and it enters the sum exactly where the product did');
  assert.doesNotMatch(bb, /uBBSun \* cloudShadowAt\(vBBWorld\) \* sunShadowAt\(base[^)]*\)\) \+ elPointFlat/, 'the inline product is gone');
  // the shadow is still read at the flat's BASE, once for the whole
  // sprite - a sprite in its own map would shadow itself (EL2)
  assert.match(bb, /sunShadowAt\(base, vec3\(0\.0, 1\.0, 0\.0\)\)/);
});

test('PERF-SUN: the tree sway is CLEARED as a suspect - the lean is baked at build, not decided a frame', () => {
  // Mac named it. It is not a per-frame cost: `floraSwayOf` runs once per
  // BATCH when the pixel is built, the host uploads ONE wind vector a
  // frame for every flat in the world, and the shader's lean is a few
  // instructions on four vertices a sprite. Recorded here so the next
  // reader does not go looking again.
  assert.equal(floraSwayOf(500, 500, 3), 1, 'a tall flora flat leans');
  assert.equal(floraSwayOf(500, 500, 0.4), 0.6, 'a short one leans less');
  assert.equal(floraSwayOf(210, 500, 3), 0, 'and anything that is not the climate’s flora does not lean at all');
  const w = read('src/scenes/world.js'), ex = read('src/scenes/exterior.js');
  for (const [name, src] of [['world', w], ['exterior', ex]]) {
    assert.match(src, /batch\.sway = floraSwayOf\(archive, natureArchive, size\.h\);/, `${name}: set at BUILD`);
    assert.equal((src.match(/renderer\.setFlatWind\(/g) ?? []).length, 1, `${name}: one wind upload a frame, for every flat there is`);
  }
  assert.doesNotMatch(w, /floraSwayOf\([^)]*\)[^\n]*\n[^\n]*for \(const b of p\.batches\)/, 'nothing recomputes a lean inside the draw walk');
  // ...but the DOOR beside it was parsing the query string once a frame
  assert.match(read('src/systems/windDrive.js'), /let _swayOff;/, 'the ?sway=off door is read once, as ?cull=off is');
  assert.equal(swayDisabled('?sway=off'), true);
  assert.equal(swayDisabled('?sway=on'), false, 'and it re-reads when the search really changes');
  assert.equal(typeof floraSwayOn(''), 'boolean');
});
