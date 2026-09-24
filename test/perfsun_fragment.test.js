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
import { SHADOW_GLSL, SHADOW_CASCADES, SHADOW_PCF_CASCADES, SHADOW_SUN_SIZE, ShadowPass } from '../src/render/shadowPass.js';
import { EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_BB_FS } from '../src/render/enhancedLighting.js';
import { waterSurfaceFs } from '../src/render/waterSurface.js';
import { floraSwayOn, floraSwayOf, swayDisabled } from '../src/systems/windDrive.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PERF-SUN1: the far cascade takes ONE tap, and the near ones keep the kernel', () => {
  // Each tap is ALREADY a hardware 2x2: the sun map is
  // COMPARE_REF_TO_TEXTURE with LINEAR filtering, so `texture()` on it is
  // a bilinear PCF over four texels and the 3x3 loop is an effective 4x4.
  // THE SUN MAP'S OWN PARAMETERS, not the file. The cube map sets the
  // same two parameters on the same target, so a file-wide grep passed
  // clean over the sun's removal - the first draft of this pin did, and
  // two mutants walked through it. AUDIT 68 S17-shadowpass-layer-dup: the
  // arrays share one builder now, so the pin reads what the real pass SETS
  // on the texture it keeps as its sun map, not a block of its text.
  const params = new Map();
  let bound = null;
  const gl = new Proxy({}, {
    get: (_, k) => {
      if (typeof k !== 'string') return undefined;
      if (k === 'bindTexture') return (target, tex) => { if (target === 'TEXTURE_2D_ARRAY') bound = tex; };
      if (k === 'texParameteri') return (target, pname, value) => { if (target === 'TEXTURE_2D_ARRAY') params.set(bound, { ...params.get(bound), [pname]: value }); };
      if (k === k.toUpperCase()) return k;   // gl.LINEAR and friends, by name
      if (k.startsWith('create')) return () => ({});
      return () => {};
    },
  });
  const pass = new ShadowPass(gl, { build: () => ({}), vs: {} });
  const sun = params.get(pass.sunTex);
  assert.ok(sun, 'the sun map is a TEXTURE_2D_ARRAY the pass set parameters on');
  assert.equal(sun.TEXTURE_COMPARE_MODE, 'COMPARE_REF_TO_TEXTURE', 'the comparison sampler - without it a single tap really would be one texel');
  assert.equal(sun.TEXTURE_MIN_FILTER, 'LINEAR', '...filtered, which is what makes one tap a 2x2');
  // the branch, and which side of it each cascade falls
  assert.match(SHADOW_GLSL, /if \(!soft && c >= 2\) return texture\(uSunShadow, vec4\(p\.xy, float\(c\), ref\)\);/,
    'the far cascade returns on one tap, before the loop (TREES1: for a per-fragment caller)');
  assert.equal(SHADOW_PCF_CASCADES, 2);
  assert.ok(SHADOW_PCF_CASCADES < SHADOW_CASCADES.length, 'at least one cascade is cheap, or the change does nothing');
  assert.ok(SHADOW_PCF_CASCADES >= 1, 'and at least one keeps the kernel, or EL7’s contact hairline goes');
  // the loop is still there for the near cascades
  assert.match(SHADOW_GLSL, /for \(int y = -1; y <= 1; y\+\+\)/);
  assert.match(SHADOW_GLSL, /return lit \/ 9\.0;/);
  // ...and the return is BEFORE the loop, or it saves exactly nothing
  assert.ok(SHADOW_GLSL.indexOf('if (!soft && c >= 2) return texture(uSunShadow') < SHADOW_GLSL.indexOf('for (int y = -1; y <= 1; y++)'),
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
  // COUNT OVER THE CODE, NOT THE PROSE. The note above each of these
  // quotes the expression it is about, and a pin that counts its own
  // explanation is measuring the wrong thing - the first draft did. So
  // whole comment lines go, and so do TRAILING ones: the water's own
  // `#version` line ends in "the water receives the lane's sun shadow",
  // which a word-boundary search for `shadow` counted as a use of the
  // variable. GLSL has no string literals, so cutting at `//` is safe.
  const code = (src) => src.split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .filter((l) => l.trim())
    .join('\n');
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
  // AUDIT F3: `shadow` IS THE LOAD-BEARING VARIABLE HERE, NOT `diff`, and
  // the first draft of this pin counted the wrong one. The water has TWO
  // consumers of `shadow` - the diffuse term and a sun SPECULAR - so
  // proving `diff` has a single consumer proved nothing about the second.
  // It is still output-identical, and this is why: every consumer of
  // `shadow` is itself multiplied by `uSunScale`, so forcing it to zero
  // where uSunScale is zero cannot move a pixel. Found by looking for
  // them all rather than by assuming there was one.
  const shadowUses = water.split('\n').filter((l) => /\bshadow\b/.test(l) && !/float shadow =/.test(l));
  assert.equal(shadowUses.length, 2, `the water has ${shadowUses.length} consumers of shadow - every one must be under uSunScale`);
  assert.ok(shadowUses.some((l) => /spec .*uSunScale \* shadow/.test(l)), 'the sun specular is one of them, and it carries uSunScale itself');
  assert.ok(shadowUses.some((l) => /float diff = max\(dot\(n, uLightDir\), 0\.0\) \* shadow;/.test(l)), 'the diffuse term is the other');
  assert.equal((water.match(/\buSunScale\s*\*\s*diff\b/g) ?? []).length, 1, 'and the diffuse term reaches the light exactly once');
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
  assert.match(bb, /vec3 sunLit = dot\(uBBSun, uBBSun\) > 0\.0 \? uBBSun \* cloudShadowAt\(vBBWorld\) \* sunShadowSoftAt\(base, vec3\(0\.0, 1\.0, 0\.0\)\) : vec3\(0\.0\);/);
  assert.match(bb, /uTint \+ sunLit \+ elPointFlat/, 'and it enters the sum exactly where the product did');
  assert.doesNotMatch(bb, /uBBSun \* cloudShadowAt\(vBBWorld\) \* sunShadowSoftAt\(base[^)]*\)\) \+ elPointFlat/, 'the inline product is gone');
  // the shadow is still read at the flat's BASE, once for the whole
  // sprite - a sprite in its own map would shadow itself (EL2)
  assert.match(bb, /sunShadowSoftAt\(base, vec3\(0\.0, 1\.0, 0\.0\)\)/);
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


// ---- AUDIT PERF-SUN / PERF-FOG (2026-09-19) ------------------------------

test('AUDIT F4: three decoded colours, three scratches - the billboard tint\u2019s moon term was reading the SUN', async () => {
  // PRE-EXISTING, found by the audit that had just pinned `_fogLin`
  // against this exact hazard one method away. `_c3` writes into a scratch
  // the caller names, and the billboard tint site named `_decB` TWICE: so
  // `mc` and `sc` were the same Float32Array, `sc`'s decode overwrote
  // `mc`'s contents, and the very next statement built uBBTint from a
  // "moon colour" that held the sun's. Every flat in the world, at night.
  const r = read('src/render/renderer.js');
  assert.match(r, /const am = this\._c3\(this\._ambient, this\._decA\), mc = this\._c3\(this\._moonColor, this\._decB\), sc = this\._c3\(this\._sunColor, this\._decC\);/,
    'three colours, three scratches');
  assert.match(r, /this\._decA = new Float32Array\(3\); this\._decB = new Float32Array\(3\); this\._decC = new Float32Array\(3\);/);
  // AND THE RULE, held generally rather than at the one site: no statement
  // may take two decoded colours into the same scratch. That is what makes
  // this a law instead of a patch - the next caller who needs a fourth
  // colour fails here rather than in the field.
  for (const line of r.split('\n')) {
    const scratches = [...line.matchAll(/this\._c3\([^)]*?,\s*this\.(_dec[A-Z])\)/g)].map((m) => m[1]);
    assert.equal(new Set(scratches).size, scratches.length, `two decodes into one scratch: ${line.trim()}`);
  }
});

test('AUDIT F2: the cheap tap runs OUTWARD from its index, and the note says so', () => {
  const sp = read('src/render/shadowPass.js');
  // The test is `c >= SHADOW_PCF_CASCADES`, so a fourth cascade would be
  // cheap too. That is the RIGHT behaviour - the cascades ascend by
  // radius, so a further one is always the coarser map - but the note
  // first written here claimed the opposite, and a false claim about a
  // safe direction is exactly what this slice's own lesson was about.
  assert.match(SHADOW_GLSL, /if \(!soft && c >= 2\) return/, 'outward from the index, not the last cascade alone');
  assert.doesNotMatch(sp, /A cascade count this does not cover keeps the kernel/, 'the false note is gone');
  assert.match(sp, /EVERY cascade from/, '...and the true one is there');
  for (let i = 1; i < SHADOW_CASCADES.length; i++) {
    assert.ok(SHADOW_CASCADES[i] > SHADOW_CASCADES[i - 1], 'the cascades ascend, so a later index is always the coarser map');
  }
});

test('AUDIT F5/F6: the numbers behind what was taken and what was left', () => {
  // F6 (REFUTED): the seam at the cascade 1/2 boundary gets LESS visible,
  // not more. A hardware tap is a 2x2 and the 3x3 loop an effective 4x4,
  // so the blur width in world units is texel x kernel.
  const blur = (r, taps) => (2 * r / SHADOW_SUN_SIZE) * (taps === 9 ? 4 : 2);
  const near = blur(SHADOW_CASCADES[1], 9);
  const farWas = blur(SHADOW_CASCADES[2], 9), farNow = blur(SHADOW_CASCADES[2], 1);
  assert.ok(farNow < farWas, 'the far cascade is SHARPER than it was, not blurrier');
  assert.ok(farNow / near < farWas / near,
    `the step across the boundary fell from ${(farWas / near).toFixed(1)}x to ${(farNow / near).toFixed(1)}x`);
  // F5 (RECORDED, NOT TAKEN): cascade 1's texel is about a pixel and a
  // half at thirty metres, so the same arithmetic that made the far
  // cascade cheap applies to it too. It keeps the kernel anyway, because
  // there the 3x3 is a soft EDGE - a look - and not only antialiasing.
  // Written in numbers so the next reader re-opens it as a choice rather
  // than rediscovering it as an oversight.
  const pixelAt = (d) => d * (2 * Math.tan(Math.PI / 6)) / 1080;
  const c1Texel = 2 * SHADOW_CASCADES[1] / SHADOW_SUN_SIZE;
  assert.ok(c1Texel / pixelAt(30) < 2, `cascade 1's texel is ${(c1Texel / pixelAt(30)).toFixed(1)} pixels at 30 m - the same case, and it keeps the kernel by choice`);
  assert.equal(SHADOW_PCF_CASCADES, 2, 'the choice, written down');
});

test('AUDIT F1: the sway door\u2019s state is declared ABOVE its reader', () => {
  // A `let` below the function that reads it is in the temporal dead zone
  // until the module finishes evaluating. Nothing calls this during module
  // init today - but this port has already lost a boot to one end of a
  // module cycle reaching the other too early (the HOTFIX black screen),
  // and the fix for that class is to not write the shape at all.
  const w = read('src/systems/windDrive.js');
  const decl = w.indexOf('let _swaySearch;');
  const reader = w.indexOf('export function swayDisabled');
  assert.ok(decl > 0 && reader > 0, 'both are there');
  assert.ok(decl < reader, 'the state is declared before the function that reads it');
  assert.ok(w.indexOf('let _swayOff;') < reader, '...and so is its sibling');
});


// ---- TREES1 (2026-09-19) -------------------------------------------------

test('TREES1: a FLAT keeps the kernel at every distance, because it samples once for a whole sprite', () => {
  // Mac: "there's this weird darkening effect happening to trees."
  //
  // PERF-SUN1's cheap far tap is an ANTIALIASING trade, and it only holds
  // for a surface that shades PER FRAGMENT - the terrain and the meshes,
  // where neighbouring pixels smooth a coarse filter whatever the lookup
  // returns. A flat is not like that: it reads ONE value at its base and
  // wears it over the whole sprite (EL2 - sampled at its own fragment a
  // sprite would shadow itself), so the kernel is not softening an edge
  // there, it is the only gradation the tree has. One tap flips a tree
  // whose foot sits near a shadow edge between fully lit and fully dark,
  // and jumps again at the cascade boundary as you walk toward it.
  assert.match(SHADOW_GLSL, /float sunShadowTap\(vec3 wp, vec3 n, bool soft\) \{/, 'one body');
  assert.match(SHADOW_GLSL, /if \(!soft && c >= 2\) return texture\(uSunShadow/, 'the cheap tap is the NOT-soft path');
  assert.match(SHADOW_GLSL, /float sunShadowAt\(vec3 wp, vec3 n\) \{ return sunShadowTap\(wp, n, false\); \}/);
  assert.match(SHADOW_GLSL, /float sunShadowSoftAt\(vec3 wp, vec3 n\) \{ return sunShadowTap\(wp, n, true\); \}/);
  // the FLAT takes the soft one, and it is the ONLY caller that does -
  // every per-fragment surface keeps the cheap far tap, which is where
  // the saving was
  // THE CALL SITE, NOT THE PASTED BLOCK. Every one of these shaders
  // contains BOTH function names, because it pastes SHADOW_GLSL which
  // defines them - so the question "which does this shader use" can only
  // be asked of what is left when the block is taken out.
  const body = (raw) => raw.replace(SHADOW_GLSL, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const bb = body(EL_BB_FS);
  assert.match(bb, /sunShadowSoftAt\(base, vec3\(0\.0, 1\.0, 0\.0\)\)/, 'the flat reads the soft one');
  assert.doesNotMatch(bb, /(?<!Soft)At\(base[^)]*\)\s*:/, '...and never the cheap one');
  assert.ok(!/[^t]sunShadowAt\(/.test(bb), 'no call to the cheap lookup survives in the flat\u2019s own body');
  for (const [n, raw] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    const src = body(raw);
    assert.match(src, /sunShadowAt\(vWorldPos, n\)/, `${n}: shades per fragment, so it keeps the cheap far tap`);
    assert.doesNotMatch(src, /sunShadowSoftAt\(/, `${n}: and does not pay for a kernel its neighbours already give it`);
  }
  const water = body(waterSurfaceFs('', SHADOW_GLSL));
  assert.match(water, /sunShadowAt\(vWorldPos, n\)/, 'the water shades per fragment too');
  assert.doesNotMatch(water, /sunShadowSoftAt\(/);
  // and the soft path really is the kernel, for EVERY cascade - a `soft`
  // that still fell through to the cheap tap somewhere would be the bug
  // this fixes, wearing the name of the fix
  const tap = /float sunShadowTap\(vec3 wp, vec3 n, bool soft\) \{([\s\S]*?)\n\}/.exec(SHADOW_GLSL);
  assert.ok(tap, 'the body is where this pin thinks it is');
  assert.equal((tap[1].match(/return texture\(uSunShadow/g) ?? []).length, 1, 'exactly one early return, and it is behind !soft');
  assert.match(tap[1], /return lit \/ 9\.0;/, 'and the kernel is what everything else reaches');
});
