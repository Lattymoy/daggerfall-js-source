// WATER5 (2026-09-11, Mac, of WATER4's trace: "It's still not a
// perfect trace. What can we do to make sure this is perfect"): PER
// TEXEL, AND THE DISTANCE TO THE SHORE. The field EXECUTES: the signed
// distance of every texel to the shore (±0.5 on either side of it, so
// the zero crossing is the texel boundary; ±SDF_RANGE for a record all
// water or all dry; the byte encoding round-trips), the water palette
// widened by colour with a palette to read (a near blue counts, a
// brown does not), the corner masks off the field. The shader is
// pinned: the field on a texture ARRAY of the tile array's own shape,
// read at the terrain's own ROT/TRANS uv, the edge the field's zero
// crossing over one screen pixel (fwidth) with no ramp and no bed ramp
// in the art arm, the foam band on the art's outline, the mask view;
// the renderer's array upload and unit 3 fallback; both hosts' and the
// lab's `?water=mask`; the probe's mask check; the record. Mutants:
// the distance sign flipped, the encoding's centre moved, the edge
// ramp reintroduced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SDF_RANGE, WATER_COLOUR_TOLERANCE, signedDistance, encodeDistance, decodeDistance, waterIndexSet, artDistance, artCornerMask, buildWaterArt,
} from '../src/world/waterArt.js';
import { waterSurfaceFs, waterUniforms, FOAM_TEXELS } from '../src/render/waterSurface.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const bm = (wet) => {
  const data = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) data[y * 64 + x] = wet(x, y) ? 200 : 1;
  return { width: 64, height: 64, data };
};
const maskOf = (wet) => { const m = new Uint8Array(4096); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) m[y * 64 + x] = wet(x, y) ? 1 : 0; return m; };

test('WATER5: the signed distance to the shore - ±0.5 on either side of it, the zero crossing on the texel boundary, Euclidean beyond, clamped at SDF_RANGE, ±SDF_RANGE for a record with no shore (mutant: the sign flipped)', () => {
  assert.equal(SDF_RANGE, 8, 'the foam band lives inside it');
  const half = signedDistance(maskOf((x) => x < 32));
  const at = (d, x, y) => d[y * 64 + x];
  assert.equal(at(half, 31, 10), 0.5, 'the last water texel');
  assert.equal(at(half, 32, 10), -0.5, 'the first dry texel');
  assert.equal(at(half, 30, 10), 1.5); assert.equal(at(half, 33, 10), -1.5);
  assert.equal(at(half, 0, 10), SDF_RANGE, 'clamped deep in the water'); assert.equal(at(half, 63, 10), -SDF_RANGE, 'and far on the dry');
  // Euclidean, not city-block: the corner of a square puddle
  const sq = signedDistance(maskOf((x, y) => x >= 16 && x < 48 && y >= 16 && y < 48));
  assert.ok(Math.abs(at(sq, 14, 14) - (-(Math.SQRT2 * 2 - 0.5))) < 1e-6, 'two texels diagonally off the corner: 2 root 2 less a half');
  assert.equal(at(sq, 32, 32), SDF_RANGE, 'the puddle\'s middle is past the range');
  assert.equal(at(sq, 16, 32), 0.5); assert.equal(at(sq, 15, 32), -0.5);
  // a one-texel stream: +0.5 on the texel, -0.5 beside it
  const line = signedDistance(maskOf((x) => x === 20));
  assert.equal(at(line, 20, 5), 0.5); assert.equal(at(line, 19, 5), -0.5); assert.equal(at(line, 21, 5), -0.5);
  // no shore at all
  assert.ok(signedDistance(maskOf(() => true)).every((v) => v === SDF_RANGE), 'all water');
  assert.ok(signedDistance(maskOf(() => false)).every((v) => v === -SDF_RANGE), 'all dry');
  // mutant: the sign flipped would put the water outside
  assert.ok(at(half, 0, 0) > 0 && at(half, 63, 0) < 0, 'positive is water');
});

test('WATER5: the byte - 128 is the shore, the ends ±SDF_RANGE, the round trip within the field\'s quantum, and the shader decodes it the same way (mutant: the centre moved)', () => {
  assert.equal(encodeDistance(0), 128); assert.equal(encodeDistance(SDF_RANGE), 255); assert.equal(encodeDistance(-SDF_RANGE), 1);
  assert.equal(encodeDistance(20), 255, 'clamped'); assert.equal(encodeDistance(-20), 1);
  assert.equal(decodeDistance(128), 0); assert.equal(decodeDistance(255), SDF_RANGE); assert.equal(decodeDistance(1), -SDF_RANGE);
  const q = SDF_RANGE / 127;
  for (const d of [0.5, -0.5, 1.5, -3.25, 7.9]) assert.ok(Math.abs(decodeDistance(encodeDistance(d)) - d) <= q / 2 + 1e-9, `${d} round-trips within half a quantum`);
  assert.ok(decodeDistance(encodeDistance(0.5)) > 0 && decodeDistance(encodeDistance(-0.5)) < 0, 'the two shore texels keep their sides');
  const fs = waterSurfaceFs('float cloudShadowAt(vec3 wp) { return 1.0; }');
  assert.match(fs, /const float SDF_RANGE = 8\.0;/, 'the leaf\'s range, templated');
  assert.match(fs, /return \(texture\(uWaterArt, vec3\(tuv, float\(layer\)\)\)\.r \* 255\.0 - 128\.0\) \* \(SDF_RANGE \/ 127\.0\);/, 'the shader\'s decode is decodeDistance');
});

test('WATER5: the water palette widened by colour - with a palette an index within the tolerance of one of record 0\'s colours is water, a brown is not; without a palette the set is record 0\'s own', () => {
  assert.equal(WATER_COLOUR_TOLERANCE, 24);
  const colours = { 200: { r: 30, g: 80, b: 160 }, 201: { r: 40, g: 90, b: 170 }, 202: { r: 30, g: 80, b: 200 }, 7: { r: 150, g: 120, b: 80 } };
  const palette = { get: (i) => colours[i] ?? { r: 0, g: 0, b: 0 } };
  const set = waterIndexSet({ data: new Uint8Array([200]), palette });
  assert.ok(set.has(200) && set.has(201), 'record 0\'s own, and its near blue (distance 17)');
  assert.ok(!set.has(202), 'a blue 40 away is not it'); assert.ok(!set.has(7), 'nor the brown');
  assert.ok(!set.has(0), 'nor black');
  assert.deepEqual([...waterIndexSet({ data: new Uint8Array([200]) })], [200], 'no palette: no widening');
  // through buildWaterArt: a shore record painted in the near blue is water
  const water = { ...bm(() => true), palette };
  const nearBlue = bm(() => false); nearBlue.data.fill(201, 0, 2048); nearBlue.palette = palette;
  const art = buildWaterArt([water, nearBlue]);
  assert.equal(artDistance(art, 1 << 2, 0.5, 0.1) > 0, true, 'the near blue rows are water');
  assert.equal(artDistance(art, 1 << 2, 0.5, 0.9) < 0, true, 'the rest dry');
  assert.equal(artCornerMask(art, 1 << 2), 0b0011, 'top corners wet');
  assert.equal(buildWaterArt([water, nearBlue], { tolerance: 0 }).any[1 << 2], 0, 'at zero tolerance the near blue is not water');
});

test('WATER5: the shader - the field on a texture ARRAY at the terrain\'s own uv, the edge its zero crossing over one screen pixel, no ramp and no bed ramp in the art arm, the foam band on the outline, the mask view; the corner arm untouched (mutant: a ramp reintroduced)', () => {
  const fs = waterSurfaceFs('float cloudShadowAt(vec3 wp) { return 1.0; }');
  assert.match(fs, /uniform sampler2DArray uWaterArt;/, 'the tile array\'s own shape');
  assert.match(fs, /uniform int uWaterDebug;/); assert.match(fs, /uniform float uFoamTexels;/);
  assert.doesNotMatch(fs, /uWaterArtRows|ART_GRID|ART_SHORE/, 'WATER4\'s cells are gone');
  assert.match(fs, /float artDistance\(uint data, vec2 f\) \{\s*\n\s*int layer = int\(data >> 2u\);\s*\n\s*int t = int\(data & 3u\);\s*\n\s*vec2 tuv = ROT\[t\] \* f \+ TRANS\[t\];\s*\n\s*return \(texture\(uWaterArt, vec3\(tuv, float\(layer\)\)\)/, 'the record\'s texel at the uv the ground draws it by - no clamp of its own, the sampler clamps as the tiles do');
  assert.match(fs, /float d = artDistance\(data, f\);\s*\n\s*float w = max\(fwidth\(d\), 1e-4\);\s*\n\s*edge = smoothstep\(-w, w, d\);\s*\n\s*if \(uWaterDebug == 1\) \{ if \(d < 0\.0\) discard; outColor = vec4\(1\.0, 0\.0, 1\.0, 0\.65\); return; \}\s*\n\s*if \(edge <= 0\.002\) discard;\s*\n\s*\/\/[^\n]*\n\s*depth = max\(vDepth, uShoreDepth\);\s*\n\s*shore = clamp\(d \/ \(uFoamTexels \* \(0\.6 \+ 0\.8 \* uWindStrength\)\), 0\.0, 1\.0\);\s*\n\s*\} else \{/, 'the art arm: the zero crossing, the mask view, the puddle\'s bed, the band on the outline');
  const artArm = fs.slice(fs.indexOf('if (uWaterArtOn == 1) {'), fs.indexOf('} else {', fs.indexOf('if (uWaterArtOn == 1) {')));
  assert.doesNotMatch(artArm, /uShoreSoft|smoothstep\(0\.0, uShoreDepth/, 'no ramp of its own, no bed ramp: the art is the shoreline\'s one authority');
  assert.match(fs, /edge \*= smoothstep\(0\.0, uShoreDepth, vDepth\);\s*\n\s*if \(edge <= 0\.002\) discard;\s*\n\s*depth = vDepth;\s*\n\s*shore = smoothstep\(0\.0, uFoamDepth \* \(0\.6 \+ 0\.8 \* uWindStrength\), vDepth\);/, 'the corner arm keeps WATER2\'s ramp and WATER3\'s band');
  assert.match(fs, /float shoreFoam = \(1\.0 - shore\) \* smoothstep\(0\.35, 0\.75, lace/, 'one band, both arms');
  assert.doesNotMatch(fs, /shoreFoam \*= smoothstep\(0\.0, 0\.05, vDepth\)/, 'WATER4\'s puddle gate is gone: the outline is the band');
  const u = waterUniforms({});
  assert.equal(u.foamTexels, FOAM_TEXELS); assert.equal(FOAM_TEXELS, 6); assert.ok(FOAM_TEXELS < SDF_RANGE, 'inside the field');
  assert.equal(u.debug, false); assert.equal(waterUniforms({ debug: true }).debug, true);
});

test('WATER5: the renderer, the hosts, the lab and the probe - the field uploaded as an R8 LINEAR texture array of the tile array\'s shape, unit 3 falls back to the tile array itself, the mask view rides `?water=mask` in both hosts and the lab, the probe checks it; and the record', () => {
  const r = rd('src/render/renderer.js');
  const up = r.slice(r.indexOf('  uploadWaterArt(archive, art) {'));
  const upBody = up.slice(0, up.indexOf('\n  }\n'));
  assert.match(upBody, /gl\.bindTexture\(gl\.TEXTURE_2D_ARRAY, tex\);[\s\S]*?gl\.texImage3D\(gl\.TEXTURE_2D_ARRAY, 0, gl\.R8, art\.size, art\.size, art\.records, 0, gl\.RED, gl\.UNSIGNED_BYTE, art\.sdf\);/);
  assert.match(upBody, /gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_MIN_FILTER, gl\.LINEAR\);\s*\n\s*gl\.texParameteri\(gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_MAG_FILTER, gl\.LINEAR\);/, 'the zero crossing between texels');
  assert.match(upBody, /gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_WRAP_S, gl\.CLAMP_TO_EDGE\);\s*\n\s*gl\.texParameteri\(gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_WRAP_T, gl\.CLAMP_TO_EDGE\);/, 'as the tiles clamp');
  assert.match(r, /waterArt: u\('uWaterArt'\), waterArtOn: u\('uWaterArtOn'\), waterDebug: u\('uWaterDebug'\), foamTexels: u\('uFoamTexels'\),/);
  const draw = r.slice(r.indexOf('  drawWaterSurface(surface, modelMatrix, arrayTex, tilemapTex, tileSize, u, tileDim = 128, art = null) {'));
  const body = draw.slice(0, draw.indexOf('\n  }\n'));
  assert.match(body, /gl\.activeTexture\(gl\.TEXTURE3\);\s*\n\s*gl\.bindTexture\(gl\.TEXTURE_2D_ARRAY, art\?\.tex \?\? arrayTex\);\s*\n\s*gl\.uniform1i\(L\.waterArt, 3\);\s*\n\s*gl\.uniform1i\(L\.waterArtOn, art \? 1 : 0\);\s*\n\s*gl\.uniform1i\(L\.waterDebug, u\.debug \? 1 : 0\);\s*\n\s*gl\.uniform1f\(L\.foamTexels, u\.foamTexels\);/, 'an array sampler needs an array bound even unread');
  for (const [name, src] of [['world', rd('src/scenes/world.js')], ['exterior', rd('src/scenes/exterior.js')]]) {
    assert.match(src, /const waterMaskDebug = new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('water'\) === 'mask';/, `${name}: the mask view's switch`);
    assert.match(src, /sky: sky\.waterSky\(\), debug: waterMaskDebug \}\)/, `${name}: handed to the pass`);
  }
  const lab = rd('src/tools/waterLab.js');
  assert.match(lab, /const maskView = params\.get\('water'\) === 'mask';/); assert.match(lab, /debug: maskView,/);
  const probe = rd('tools/waterProbe.mjs');
  assert.match(probe, /if \(r > 170 && b > 140 && g < 100\) magenta\+\+;/, 'the probe counts the mask\'s paint');
  assert.match(probe, /const shoreMask = await shoot\('shore-mask', '[^']*&water=mask'\);/);
  assert.ok(probe.includes('the mask view: the whole sea, part of the shore, none of the sky'), 'and checks it');
  assert.match(rd('src/player/exteriorSurface.js'), /if \(art\) return artCoverage\(art, byte, feet\[0\], feet\[1\]\);/, 'the feet: the fold, texel-exact');
  assert.match(rd('bible/07-Rendering/Water-Arc.md'), /## WATER5 - PER TEXEL, AND THE DISTANCE TO THE SHORE \(2026-09-11\)/);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /\| THE WATER IS THE ART'S \(WATER4, 2026-09-11\) \|[^\n]*WATER5 \(the same day,/, 'the row carries the refinement');
});
