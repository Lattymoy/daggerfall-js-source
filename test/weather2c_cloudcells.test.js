// WEATHER2c (Mac, 2026-09-14: "different generative cloud types, like being able to see a thunderhead in the distance
// with the weather happening elsewhere"): CLOUD TYPES BY PLACE. The one volumetric field had one profile for the whole
// sky - the zone's word, eased. It takes CELLS now: a world position, a radius and a soft rim, a profile of its own with
// its weather's cover and grey, blended over the zone's terms by the rim's weight at every sample both marches take,
// under a slab that is the union of the zone's and the cells'. Ships with the `?cloudcell=` door (one static cell) and
// takes the weather field's cells (slice B) through setState's last argument.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUALITY, MAX_CELLS, CELL_EDGE, CELL_TINT, VC_PROFILE, cellOf, slabOf, packCells, parseCloudCellDoor,
  CLOUD_FIELD_GLSL, MARCH_FS, SHADOW_FS, FIELD_UNIFORMS, MARCH_UNIFORMS, SHADOW_UNIFORMS,
} from '../src/render/volumetricClouds.js';
import { WEATHER_SKY } from '../src/render/enhancedSky.js';
import { WEATHER_TYPES } from '../src/world/weather.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('WEATHER2c cells: every tier caps its cells under the shader\'s eight; a cell is its weather\'s profile with the row\'s cover and grey and a rim a third of its radius', () => {
  assert.equal(MAX_CELLS, 8);
  for (const q of Object.values(QUALITY)) assert.ok(q.cells >= 1 && q.cells <= MAX_CELLS, 'a tier caps under the arrays');
  assert.equal(QUALITY.lo.cells, 3, 'the low tier pays for three');
  assert.equal(QUALITY.default.cells, MAX_CELLS); assert.equal(QUALITY.hi.cells, MAX_CELLS);
  assert.equal(CELL_EDGE, 0.35);
  for (const w of WEATHER_TYPES) {
    const c = cellOf(w, 100, -200, 3000);
    assert.deepEqual(c, { x: 100, z: -200, r: 3000, edge: 3000 * CELL_EDGE, ...VC_PROFILE[w], word: w, cover: WEATHER_SKY[w].cover, grey: WEATHER_SKY[w].grey, ...(CELL_TINT[w] ? { tint: CELL_TINT[w] } : {}) }, `${w}: the profile, the row's cover and grey (WEATHER2d: and a tint where the word has one; VC7a: and the word, for the day's convection)`);
  }
  const storm = cellOf('thunder', 0, 0, 3000);
  assert.equal(storm.top, 4200); assert.equal(storm.dark, 0.7); assert.equal(storm.cover, 1.0); assert.ok(storm.grey > 0.9, 'a thunderhead is dark');
  assert.equal(cellOf('hail', 0, 0, 1), null, 'no profile, no cell');
});

test('WEATHER2c the union slab: the zone\'s alone with no cells; a thunderhead under a sunny zone lowers the base and raises the top; a fog bank lowers the base only', () => {
  assert.deepEqual(slabOf(VC_PROFILE.sunny, []), { base: 1400, top: 3200 });
  assert.deepEqual(slabOf(VC_PROFILE.sunny, null), { base: 1400, top: 3200 });
  assert.deepEqual(slabOf(VC_PROFILE.sunny, [cellOf('thunder', 0, 0, 3000)]), { base: 500, top: 4200 });
  assert.deepEqual(slabOf(VC_PROFILE.sunny, [cellOf('fog', 0, 0, 3000)]), { base: 150, top: 3200 });
  assert.deepEqual(slabOf(VC_PROFILE.thunder, [cellOf('sunny', 0, 0, 3000)]), { base: 500, top: 4200 }, 'a lighter cell never narrows the slab');
});

test('WEATHER2c packing: three arrays of four per cell, the count capped by the tier and the arrays, a rim never narrower than a metre, the arrays reused', () => {
  const cells = [cellOf('thunder', 10, 20, 3000), cellOf('rain', -5000, 8000, 6000), { x: 1, z: 2, r: 100, edge: 0, base: 1, top: 2, density: 3, dark: 4, flat: 5, shear: 6, cover: 7 }];
  const k = packCells(cells, 8);
  assert.equal(k.count, 3);
  assert.deepEqual([...k.c.slice(0, 4)], [10, 20, 3000, 3000 * CELL_EDGE]);
  assert.deepEqual([...k.a.slice(0, 4)].map((v) => Math.round(v * 100) / 100), [500, 4200, 1, 0.5]);
  assert.deepEqual([...k.b.slice(0, 4)].map((v) => Math.round(v * 100) / 100), [0.7, 0.5, 1, 0.95]);
  assert.deepEqual([...k.c.slice(8, 12)], [1, 2, 100, 1], 'a zero rim is a metre - smoothstep\'s edges stay ordered');
  assert.deepEqual([...k.b.slice(8, 12)], [4, 6, 7, 0], 'no grey is 0');
  assert.equal(packCells(cells, 2).count, 2, 'the tier\'s cap');
  assert.equal(packCells(new Array(12).fill(cells[0]), 99).count, MAX_CELLS, 'the arrays\' cap');
  assert.equal(packCells(null, 8).count, 0); assert.equal(packCells([], 8).count, 0);
  const out = { c: new Float32Array(32), a: new Float32Array(32), b: new Float32Array(32) };
  assert.equal(packCells(cells, 8, out), out, 'the caller\'s arrays, filled in place');
  assert.equal(out.c.length, 32); assert.equal(out.count, 3);
});

test('WEATHER2c the door: a weather, metres ahead (east) and a radius, with defaults; nothing for no door, no position, an unknown weather or a bad number', () => {
  const pos = [10, 5, 20];
  assert.deepEqual(parseCloudCellDoor('thunder,6000,3000', pos), cellOf('thunder', 6010, 20, 3000));
  assert.deepEqual(parseCloudCellDoor('rain', pos), cellOf('rain', 6010, 20, 3000), 'the defaults: 6 km ahead, 3 km across');
  assert.deepEqual(parseCloudCellDoor('fog,-1500', pos), cellOf('fog', -1490, 20, 3000), 'behind is a negative distance');
  assert.equal(parseCloudCellDoor(null, pos), null); assert.equal(parseCloudCellDoor('', pos), null);
  assert.equal(parseCloudCellDoor('thunder', null), null, 'no position yet');
  assert.equal(parseCloudCellDoor('hail', pos), null); assert.equal(parseCloudCellDoor('thunder,abc', pos), null); assert.equal(parseCloudCellDoor('thunder,100,0', pos), null);
});

test('WEATHER2c the field: the cells and the slab declared once for both marches, the profile resolved at a place before each march and at every step while cells stand, the density on the resolved terms, and every uniform declared', () => {
  assert.match(CLOUD_FIELD_GLSL, /uniform int uCellCount;/); assert.match(CLOUD_FIELD_GLSL, /uniform vec4 uCell\[8\];/);
  assert.match(CLOUD_FIELD_GLSL, /uniform vec4 uCellA\[8\];/); assert.match(CLOUD_FIELD_GLSL, /uniform vec4 uCellB\[8\];/);
  assert.match(CLOUD_FIELD_GLSL, /uniform float uSlabBase;/); assert.match(CLOUD_FIELD_GLSL, /uniform float uSlabTop;/);
  assert.match(CLOUD_FIELD_GLSL, /uniform float uDark;/, 'the dark moved into the field - a cell has its own');
  assert.match(CLOUD_FIELD_GLSL, /float fBase, fTop, fDensity, fFlat, fShear, fCover, fDark, fGrey, fVary;\s*\n\s*vec3 fTint;\s*\n\s*void resolveAt\(vec2 xz\) \{/);   // WEATHER2d: and the tint; VC6a: and the type variation
  assert.match(CLOUD_FIELD_GLSL, /fBase = uBase; fTop = uTop; fDensity = uDensity; fFlat = uFlat; fShear = uShear; fCover = uCover; fDark = uDark; fGrey = 0\.0; fTint = vec3\(1\.0\); fVary = uVary;/, 'the zone\'s terms first');
  assert.match(CLOUD_FIELD_GLSL, /fVary = mix\(fVary, uCellC\[i\]\.w, w\);/, 'VC6a: a cell brings its own type variation, on the tint array\'s spare lane');
  assert.match(CLOUD_FIELD_GLSL, /for \(int i = 0; i < 8; i\+\+\) \{\s*\n\s*if \(i >= uCellCount\) break;/, 'a fixed loop under a uniform count');
  // WEATHER3h: in the cell's own shape's measure - a circle's shape (1, 0, 0, 0 | 0, 0, 0, 0) is length() exactly
  assert.match(CLOUD_FIELD_GLSL, /float w = 1\.0 - smoothstep\(c\.z - c\.w, c\.z, shapedDist\(xz - c\.xy, uCellS\[i\], uCellU\[i\]\)\);/, 'the rim\'s weight');
  assert.match(CLOUD_FIELD_GLSL, /fBase = mix\(fBase, a\.x, w\); fTop = mix\(fTop, a\.y, w\); fDensity = mix\(fDensity, a\.z, w\); fFlat = mix\(fFlat, a\.w, w\);/);
  assert.match(CLOUD_FIELD_GLSL, /fDark = mix\(fDark, b\.x, w\); fShear = mix\(fShear, b\.y, w\); fCover = mix\(fCover, b\.z, w\); fGrey = mix\(fGrey, b\.w, w\);/);
  const dens = CLOUD_FIELD_GLSL.slice(CLOUD_FIELD_GLSL.indexOf('float density(vec3 p, float mip) {'));
  assert.doesNotMatch(dens, /\bu(Base|Top|Density|Flat|Shear|Cover|Dark)\b/, 'the density reads the resolved terms, never the zone\'s uniforms');
  assert.match(dens, /return clamp\(base, 0\.0, 1\.0\) \* fDensity;/);
  assert.match(CLOUD_FIELD_GLSL, /return mix\(towers, lid, lidness\);/, 'VC6a: the flatness is the PLACE\'s, handed in - the zone\'s moved by the variation field');
  assert.doesNotMatch(CLOUD_FIELD_GLSL, /float heightGradient\(float h, float flat\)/, 'VC6a: never `flat` - GLSL ES 3.00 reserves it as an interpolation qualifier and the shader does not compile');
  // the marches
  assert.match(MARCH_FS, /float t0 = uSlabBase \/ dir\.y, t1 = min\(uSlabTop \/ dir\.y, t0 \+ 24000\.0\);/, 'the sky march walks the union slab');
  assert.match(MARCH_FS, /resolveAt\(\(cam \+ dir \* t0\)\.xz\);[^\n]*\n\s*for \(int i = 0; i < 96; i\+\+\) \{[\s\S]{0,600}?vec3 p = cam \+ dir \* t;\s*\n\s*if \(uCellCount > 0\) resolveAt\(p\.xz\);/, 'resolved before the march and at every step while cells stand');
  assert.match(MARCH_FS, /float ds = \(fTop - fBase\) \/ float\(uLightSteps\) \* 0\.5;/, 'the light march reads what the step resolved');
  assert.match(MARCH_FS, /mix\(uCloudShade, uCloudLit, sideLit \* \(1\.0 - fGrey\)\)/, 'a cell\'s grey (VC6b: over the height ramp the low sun rolls over)');
  assert.match(MARCH_FS, /\(1\.0 - 0\.8 \* fDark\) \* \(1\.0 - 0\.5 \* fGrey\) \* fTint \+ ambient;/);   // WEATHER2d: and the cell's tint
  assert.doesNotMatch(MARCH_FS.replace(CLOUD_FIELD_GLSL, ''), /uniform float uDark;/, 'declared once, in the field');
  assert.match(SHADOW_FS, /float t0 = uSlabBase \/ uLightDir\.y, t1 = uSlabTop \/ uLightDir\.y;/, 'the shadow march walks the union slab');
  assert.match(SHADOW_FS, /resolveAt\(g\);[^\n]*\n\s*for \(int i = 0; i < 24; i\+\+\) \{\s*\n\s*if \(i >= steps\) break;\s*\n\s*vec3 p = vec3\(g\.x, 0\.0, g\.y\) \+ uLightDir \* t;\s*\n\s*if \(uCellCount > 0\) resolveAt\(p\.xz\);/, 'the shadow is the cell\'s where it stands');
  // every uniform the field declares is on the list both programs fetch
  for (const n of ['uDark', 'uSlabBase', 'uSlabTop', 'uCellCount', 'uCell', 'uCellA', 'uCellB']) assert.ok(FIELD_UNIFORMS.includes(n), `${n} fetched`);
  assert.equal(MARCH_UNIFORMS.filter((n) => n === 'uDark').length, 1, 'once'); assert.ok(SHADOW_UNIFORMS.includes('uCellCount'));
  // AUDIT 47's own law over the two templates: every uniform used is declared
  const field = CLOUD_FIELD_GLSL;
  for (const [label, body] of [['MARCH_FS', MARCH_FS], ['SHADOW_FS', SHADOW_FS]]) {
    const declared = new Set([...body.matchAll(/uniform\s+\w+\s+([^;]+);/g)].flatMap((x) => x[1].split(',').map((v) => v.trim().replace(/\[.*?\]/, '').split('//')[0].trim())));
    const used = new Set([...body.matchAll(/\bu[A-Z]\w*/g)].map((x) => x[0]));
    assert.deepEqual([...used].filter((u) => !declared.has(u)), [], `${label} uses undeclared`);
    assert.ok(body.includes(field), `${label} carries the field`);
  }
});

test('WEATHER2c the class and the controller: setState takes the cells (the controller\'s, else the door\'s one) capped by the tier, uploads the slab and the packed arrays with the dark, shifts the test cell on a recenter; both controller paths hand the field\'s cells', () => {
  const vc = rd('src/render/volumetricClouds.js');
  assert.match(vc, /setState\(state, row, weather, easeDt, drift, flash = 0, pos = null, cells = null\) \{/);
  assert.match(vc, /if \(this\.testCellSpec && !this\.testCell && pos\) this\.testCell = parseCloudCellDoor\(this\.testCellSpec, pos\);/);
  assert.match(vc, /this\.cells = pickCells\(cells \?\? \(this\.testCell \? \[this\.testCell\] : \[\]\), this\.q\.cells \?\? MAX_CELLS\)\.map\(\(c\) => convectCell\(c, this\.conv\)\);/, 'capped by the tier (WEATHER3c: through pickCells - a list with no importance is cut in its own order, as before; VC7a: then the day\'s convection on the fair ones)');
  assert.match(vc, /gl\.uniform1f\(u\.uDark, p\.dark\); gl\.uniform1f\(u\.uVary, p\.vary \?\? 0\);[^\n]*\n[^\n]*\n\s*const slab = slabOf\(p, this\.cells\);\s*\n\s*gl\.uniform1f\(u\.uSlabBase, slab\.base\); gl\.uniform1f\(u\.uSlabTop, slab\.top\);/, 'uploaded with the field, for both marches (VC6a: the zone\'s type variation beside the dark)');
  assert.match(vc, /const k = packCells\(this\.cells, this\.q\.cells \?\? MAX_CELLS, this\._packed\);\s*\n\s*gl\.uniform1i\(u\.uCellCount, k\.count\);\s*\n\s*if \(k\.count > 0\) \{ gl\.uniform4fv\(u\.uCell, k\.c\); gl\.uniform4fv\(u\.uCellA, k\.a\); gl\.uniform4fv\(u\.uCellB, k\.b\); gl\.uniform4fv\(u\.uCellC, k\.t\); gl\.uniform4fv\(u\.uCellK, k\.k\); gl\.uniform4fv\(u\.uCellS, k\.s\); gl\.uniform4fv\(u\.uCellU, k\.u\); gl\.uniform4fv\(u\.uCellKS, k\.ks\); gl\.uniform4fv\(u\.uCellKU, k\.ku\); \}/, 'the arrays only when there are cells');
  assert.match(vc, /if \(this\.testCell\) \{ this\.testCell\.x \+= offset\[0\]; this\.testCell\.z \+= offset\[2\]; \}/, 'the recenter');
  assert.equal((vc.match(/gl\.uniform1f\(u\.uDark, p\.dark\);/g) || []).length, 1, 'the dark is uploaded once, by the field');
  assert.equal((vc.match(/gl\.uniform1f\(u\.uVary, p\.vary \?\? 0\);/g) || []).length, 1, 'VC6a: and the variation once, beside it');
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /if \(clouds\) clouds\.testCellSpec = params\.get\('cloudcell'\);/);
  assert.equal((shared.match(/extra\?\.cells \?\? null\);/g) || []).length, 2, 'the dome path and the mod path both hand the cells');
});

test('WEATHER2c records: the arc page\'s C, the clouds arc\'s decision, the ledger row and the testing row', () => {
  assert.match(rd('bible/07-Rendering/Weather-Arc.md'), /^## C - CLOUD TYPES BY PLACE \(WEATHER2c, 2026-09-14\)/m);
  assert.match(rd('bible/07-Rendering/Volumetric-Clouds-Arc.md'), /\*\*Cells \(WEATHER2c\)\.\*\*/);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /^\| \*\*CLOUD TYPES BY PLACE \(WEATHER2c, 2026-09-14\)\*\*/m);
  assert.match(rd('bible/09-Testing/Testing.md'), /^\| weather2c_cloudcells\.test\.js \| \d+ \| WEATHER2c/m);
});
