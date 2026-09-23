// WEATHER2c (Mac, 2026-09-14: "different generative cloud types, like being able to see a thunderhead in the distance
// with the weather happening elsewhere"): CLOUD TYPES BY PLACE. The one volumetric field had one profile for the whole
// sky - the zone's word, eased. It takes CELLS now: a world position, a radius and a soft rim, a profile of its own with
// its weather's cover and grey, blended over the zone's terms by the rim's weight at every sample both marches take,
// under a slab that is the union of the zone's and the cells' (SLAB-SPAN: each ray's own, since - see the spans' tests). Ships with the `?cloudcell=` door (one static cell) and
// takes the weather field's cells (slice B) through setState's last argument.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUALITY, MAX_CELLS, CELL_EDGE, CELL_TINT, VC_PROFILE, CURTAIN_FALL, cellOf, packCells, parseCloudCellDoor,
  CLOUD_FIELD_GLSL, MARCH_FS, SHADOW_FS, FIELD_UNIFORMS, MARCH_UNIFORMS, SHADOW_UNIFORMS, VolumetricClouds,
} from '../src/render/volumetricClouds.js';
import { WEATHER_SKY, skyState } from '../src/render/enhancedSky.js';
import { glslFunctions } from './glsl.mjs';
import { ZONE, cellUniforms, fieldFns, marchFns, unit } from './cloudSky.mjs';
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
    assert.deepEqual(c, { x: 100, z: -200, r: 3000, edge: 3000 * CELL_EDGE, ...VC_PROFILE[w], word: w, cover: WEATHER_SKY[w].cover, grey: WEATHER_SKY[w].grey, fall: CURTAIN_FALL[w]?.[0] ?? 0, fallKind: CURTAIN_FALL[w]?.[1] ?? 0, ...(CELL_TINT[w] ? { tint: CELL_TINT[w] } : {}) }, `${w}: the profile, the row's cover and grey (WEATHER2d: and a tint where the word has one; VC7a: and the word, for the day's convection; VC7c: and what falls under it)`);
  }
  const storm = cellOf('thunder', 0, 0, 3000);
  assert.equal(storm.top, 4200); assert.equal(storm.dark, 0.7); assert.equal(storm.cover, 1.0); assert.ok(storm.grey > 0.9, 'a thunderhead is dark');
  assert.equal(cellOf('hail', 0, 0, 1), null, 'no profile, no cell');
});

test('SLAB-SPAN a ray\'s own slab: the zone\'s alone with no cells; a cell widens it only over its own disc; every height the resolved profile can hold cloud at lies in a span, on shaped and clipped cells; the spans sorted and disjoint', () => {
  // the shader's own raySpans and resolveAt, run in JS (test/glsl.mjs)
  const within = (f, t) => { for (let k = 0; k < f.globals.spanN; k++) if (t >= f.globals.spanA[k] - 1e-6 && t <= f.globals.spanB[k] + 1e-6) return true; return false; };
  const spans = (f) => Array.from({ length: f.globals.spanN }, (_, k) => [f.globals.spanA[k], f.globals.spanB[k]]);
  const d = unit([0, 0.05, 1]);
  let f = fieldFns([]);
  assert.ok(Math.abs(f.raySpans([0, 0, 0], d) - (ZONE.uTop - ZONE.uBase) / d[1]) < 1e-6);
  assert.deepEqual(spans(f).map((s) => s.map((v) => Math.round(v))), [[ZONE.uBase / d[1], ZONE.uTop / d[1]].map((v) => Math.round(v))], 'no cells: the zone\'s slab along the ray, as the union slab was');
  // a thunderhead 14 km east: a ray north never meets its disc, and the cell changes nothing about it
  const storm = cellOf('thunder', 14000, 0, 6000);
  f = fieldFns([storm]);
  f.raySpans([0, 0, 0], d);
  assert.deepEqual(spans(f).map((s) => s.map((v) => Math.round(v))), [[ZONE.uBase / d[1], ZONE.uTop / d[1]].map((v) => Math.round(v))], 'a cell the ray never passes adds nothing - the union slab started every ray at the storm\'s base');
  const e = unit([1, 0.05, 0]);
  f.raySpans([0, 0, 0], e);
  assert.ok(Math.abs(f.globals.spanA[0] - storm.base / e[1]) < 1e-6, 'toward it, the ray starts at the storm\'s base over its disc');
  // the superset law, on shaped and clipped cells of every kind: wherever the column the resolved profile gives holds the
  // ray's height, the ray is inside a span - so no march can skip cloud by walking the spans alone
  const cells = [
    { ...cellOf('thunder', 9000, 4000, 5000), shape: [1, 0.2, -0.1, 0.12, 0.05, -0.06, 0.03], clip: [7000, 3000, 7000, [1, -0.15, 0.1, 0, 0.08, 0.05, 0]] },
    { ...cellOf('fog', -6000, 12000, 4000), shape: [0.9, 0, 0.25, -0.1, 0, 0.04, 0.06] },
    { ...cellOf('sandstorm', 20000, -15000, 9000) },
    { ...cellOf('rain', -18000, -9000, 7000), shape: [1.1, -0.2, 0, 0.1, -0.1, 0, 0.05] },
  ];
  f = fieldFns(cells);
  let checked = 0;
  for (let a = 0; a < 24; a++) for (const el of [0.01, 0.03, 0.08, 0.2, 0.6]) {
    const az = (a / 24) * 2 * Math.PI, dir = unit([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
    const o = [a * 137 - 1500, 0, -a * 211 + 900];
    f.raySpans(o, dir);
    for (let k = 1; k < f.globals.spanN; k++) assert.ok(f.globals.spanA[k] > f.globals.spanB[k - 1], 'sorted and disjoint');
    for (let t = 0; t < 150000; t += 150) {
      const p = [o[0] + dir[0] * t, dir[1] * t, o[2] + dir[2] * t];
      f.resolveAt([p[0], p[2]]);
      if (p[1] >= f.globals.fBase && p[1] <= f.globals.fTop) { checked++; assert.ok(within(f, t), `cloud may stand at t=${t} (az ${a}, el ${el}) outside every span`); }
    }
  }
  assert.ok(checked > 5000, `the law bit on ${checked} points`);
  // the outline's own reach, not its circle's: in a lobe past n (the circle's radius), where the cell's weight still
  // lowers the column under the zone's base, a ray through that point is inside a span
  const lobed = { ...cellOf('thunder', 8000, 0, 3000), shape: [1, 0.35, 0, 0, 0, 0, 0] };   // cos 2theta: lobes along x
  f = fieldFns([lobed]);
  let lobe = null;
  for (let x = 8000 + 3000 * 1.02; x < 8000 + 3000 * 1.35 && !lobe; x += 10) { f.resolveAt([x, 0]); if (f.globals.fBase < ZONE.uBase - 100) lobe = [x, (f.globals.fBase + ZONE.uBase) / 2, 0]; }
  assert.ok(lobe, 'the lobe reaches past the circle and still lowers the column');
  const toLobe = unit(lobe);
  f.raySpans([0, 0, 0], toLobe);
  assert.ok(within(f, Math.hypot(...lobe)), 'the ray through the lobe is inside a span');
  // a sandstorm's column reaches the ground: a ray from inside its disc starts at the eye
  f = fieldFns([cellOf('sandstorm', 0, 0, 9000)]);
  f.raySpans([0, 0, 0], unit([0, 0.1, 1]));
  assert.equal(f.globals.spanA[0], 0, 'from the ground up');
});

test('SLAB-SPAN both marches: a cell a ray never passes changes nothing it draws - the sky at the horizon away from a storm, the ground\'s shadow far from it - and toward it the deck behind the storm is still walked', () => {
  const tex = (s, c) => { const v = 0.5 + 0.45 * Math.sin(c[0] * 7.1 + c[2] * 5.3 + c[1] * 3.1); return [v, v, v, v]; };
  const sky = (cells, frag) => { const f = marchFns(cells, { textureLod: tex, uCover: 0.55, gl_FragCoord: frag }); f.main(); return f.globals.outColor; };
  const storm = cellOf('rain', 14000, 0, 6000);
  // the map's rows: az = x / width of a turn, el = y / height of a quarter; west (az 3/4) and north (0) never meet a storm
  // 14 km east, at the grazing rows where the union slab left bare dome (T = 1) and higher
  for (const az of [0, 0.75]) for (const elDeg of [0.5, 1, 2, 4, 10]) {
    const frag = [az * ZONE.uMapSize[0] + 0.5, (elDeg / 90) * ZONE.uMapSize[1], 0, 1];
    const a = sky([], frag), b = sky([storm], frag);
    assert.deepEqual(b.map((v) => v.toFixed(9)), a.map((v) => v.toFixed(9)), `az ${az}, ${elDeg} degrees: the storm to the east changes nothing here`);
  }
  // toward it, the grazing rows are opaque: the storm, and the deck behind it the union slab ran out before
  const toward = sky([storm], [0.25 * ZONE.uMapSize[0] + 0.5, (1 / 90) * ZONE.uMapSize[1], 0, 1]);
  assert.ok(toward[3] < 0.01, `opaque toward the storm (T ${toward[3]})`);
  // a thin low cell in front, the deck far behind it: the window is the spans' first 24 km, the air between them jumped -
  // measured from the cell's entry, or walked, the window runs out before the deck and the hole opens again
  const thin = { ...cellOf('fog', 20000, 0, 3000), base: 200, top: 600, density: 0 };
  const el1 = (1 / 90) * ZONE.uMapSize[1], east = 0.25 * ZONE.uMapSize[0] + 0.5;
  const behind = sky([thin], [east, el1, 0, 1]);
  const bare = sky([], [east, el1, 0, 1]);
  assert.ok(behind[3] < 0.05, `the deck behind a thin cell is still walked (T ${behind[3]}, without the cell ${bare[3]})`);
  // and it keeps its own distance's haze: each span is faded by where it begins, so a cell that holds nothing leaves the
  // deck behind it the colour it has without the cell (by the ray's first entry, it came out a pale block the cell's shape)
  for (const elDeg of [1, 2]) {
    const frag = [east, (elDeg / 90) * ZONE.uMapSize[1], 0, 1], a = sky([thin], frag), b = sky([], frag);
    assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 0.01), `${elDeg} degrees: ${a.map((v) => v.toFixed(3))} against ${b.map((v) => v.toFixed(3))} without the cell`);
  }
  // the aerial perspective itself: what the horizon's colour adds is its share of the cloud's opacity, fade(entry) (1 - T)
  // - the one span's entry for all of it with no cells, as the fade over the whole ray was
  for (const elDeg of [3, 8, 20]) {
    const frag = [0.6 * ZONE.uMapSize[0] + 0.5, (elDeg / 90) * ZONE.uMapSize[1], 0, 1];
    const run = (H) => { const f = marchFns([], { textureLod: tex, uCover: 0.55, uHorizonColor: H, gl_FragCoord: frag }); f.main(); return f.globals.outColor; };
    const a = run([0, 0, 0]), b = run([1, 1, 1]);
    const el = ((frag[1] / ZONE.uMapSize[1]) * Math.PI) / 2, fade = 1 - Math.exp(-(ZONE.uBase / Math.sin(el)) / 14000);
    assert.ok(a[3] < 0.99, `${elDeg} degrees: cloud on the ray (T ${a[3]})`);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(b[i] - a[i] - fade * (1 - a[3])) < 1e-9, `${elDeg} degrees: the horizon's share is fade(entry) (1 - T)`);
  }
  // the ground's shadow: a square far west of the storm is the no-cell square, texel for texel
  const shadow = (cells, frag) => { const f = glslFunctions(SHADOW_FS, { ...ZONE, ...cellUniforms(cells), textureLod: tex, uCover: 0.55, uMapSize: [64, 64], uOrigin: [-30000, -3000], uExtent: 6000, uSteps: 12, gl_FragCoord: frag }); f.main(); return f.globals.outColor[0]; };
  for (let gx = 0; gx < 64; gx += 16) for (let gy = 0; gy < 64; gy += 16) assert.equal(shadow([storm], [gx + 0.5, gy + 0.5, 0, 1]), shadow([], [gx + 0.5, gy + 0.5, 0, 1]), 'the shadow far from the storm');
  // and where the sun's ray crosses a storm and the zone's deck, the shadow is the midpoint rule over the ray's spans laid
  // end to end - the shader's own spans, density and resolveAt, summed here: a step past one span's end goes on in the
  // next, and the air between is never sampled
  const low = cellOf('thunder', 0, 0, 3000), sun = unit([0.9, 0.12, 0.1]);   // a low sun: its ray crosses the storm's disc below the zone's base
  const bind = { ...ZONE, ...cellUniforms([low]), textureLod: tex, uCover: 0.55, uMapSize: [8, 8], uOrigin: [-9000, -2000], uExtent: 4000, uSteps: 12, uLightDir: sun };
  let split = 0;
  for (const frag of [[0.5, 0.5], [3.5, 4.5], [6.5, 2.5], [7.5, 7.5], [1.5, 3.5], [0.5, 4.5]]) {
    const f = glslFunctions(SHADOW_FS, { ...bind, gl_FragCoord: [...frag, 0, 1] });
    f.main();
    const g = [-9000 + (frag[0] / 8) * 4000, -2000 + (frag[1] / 8) * 4000];
    const len = f.raySpans([g[0], 0, g[1]], sun), A = [...f.globals.spanA], B = [...f.globals.spanB], n = f.globals.spanN;
    if (n > 1) split++;
    const steps = Math.min(24, Math.max(12, Math.ceil(len / 150))), ds = len / steps;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      let u = (i + 0.5) * ds, k = 0;
      while (k < n && u > B[k] - A[k]) { u -= B[k] - A[k]; k++; }
      if (k >= n) break;
      const t = A[k] + u, p = [g[0] + sun[0] * t, sun[1] * t, g[1] + sun[2] * t];
      f.resolveAt([p[0], p[2]]);
      sum += f.density(p, 0.5) * ds;
    }
    assert.ok(n >= 1 && Math.abs(f.globals.outColor[0] - Math.exp(-sum * f.globals.EXT)) < 1e-9, `the midpoint rule over the spans at texel ${frag} (${n} spans)`);
  }
  assert.ok(split > 0, 'and some sun rays cross the storm and the deck as two spans, with air between');
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
  assert.doesNotMatch(CLOUD_FIELD_GLSL, /uSlab/, 'SLAB-SPAN: no union slab - each ray finds its own (raySpans)');
  assert.match(CLOUD_FIELD_GLSL, /uniform float uDark;/, 'the dark moved into the field - a cell has its own');
  assert.match(CLOUD_FIELD_GLSL, /float fBase, fTop, fDensity, fFlat, fShear, fCover, fDark, fGrey, fVary;\s*\n\s*vec3 fTint;\s*\n\s*void resolveAt\(vec2 xz\) \{/);   // WEATHER2d: and the tint; VC6a: and the type variation
  assert.match(CLOUD_FIELD_GLSL, /fBase = uBase; fTop = uTop; fDensity = uDensity; fFlat = uFlat; fShear = uShear; fCover = uCover; fDark = uDark; fGrey = 0\.0; fTint = vec3\(1\.0\); fVary = uVary;/, 'the zone\'s terms first');
  assert.match(CLOUD_FIELD_GLSL, /fVary = mix\(fVary, uCellC\[i\]\.w, w\);/, 'VC6a: a cell brings its own type variation, on the tint array\'s spare lane');
  assert.match(CLOUD_FIELD_GLSL, /for \(int i = 0; i < 8; i\+\+\) \{\s*\n\s*if \(i >= uCellCount\) break;/, 'a fixed loop under a uniform count');
  // WEATHER3h: in the cell's own shape's measure - a circle's shape (1, 0, 0, 0 | 0, 0, 0, 0) is length() exactly
  assert.match(CLOUD_FIELD_GLSL, /float dc = shapedDist\(xz - c\.xy, uCellS\[i\], uCellU\[i\]\);\n    float w = 1\.0 - smoothstep\(c\.z - c\.w, c\.z, dc\);/, 'the rim\'s weight, on its own outline (VC7c: the stride\'s reach asks the outline itself - rimReach)');
  assert.match(CLOUD_FIELD_GLSL, /fBase = mix\(fBase, a\.x, w\); fTop = mix\(fTop, a\.y, w\); fDensity = mix\(fDensity, a\.z, w\); fFlat = mix\(fFlat, a\.w, w\);/);
  assert.match(CLOUD_FIELD_GLSL, /fDark = mix\(fDark, b\.x, w\); fShear = mix\(fShear, b\.y, w\); fCover = mix\(fCover, b\.z, w\); fGrey = mix\(fGrey, b\.w, w\);/);
  const dens = CLOUD_FIELD_GLSL.slice(CLOUD_FIELD_GLSL.indexOf('float density(vec3 p, float mip) {'));
  assert.doesNotMatch(dens, /\bu(Base|Top|Density|Flat|Shear|Cover|Dark)\b/, 'the density reads the resolved terms, never the zone\'s uniforms');
  assert.match(dens, /return clamp\(base, 0\.0, 1\.0\) \* fDensity;/);
  assert.match(CLOUD_FIELD_GLSL, /return mix\(towers, lid, lidness\);/, 'VC6a: the flatness is the PLACE\'s, handed in - the zone\'s moved by the variation field');
  assert.doesNotMatch(CLOUD_FIELD_GLSL, /float heightGradient\(float h, float flat\)/, 'VC6a: never `flat` - GLSL ES 3.00 reserves it as an interpolation qualifier and the shader does not compile');
  // the marches
  assert.match(MARCH_FS, /float len = raySpans\(cam, dir\);\s*\n\s*float t0 = spanA\[0\];/, 'SLAB-SPAN: the sky march walks the ray\'s own spans');
  assert.match(MARCH_FS, /resolveAt\(\(cam \+ dir \* t0\)\.xz\);[^\n]*\n\s*for \(int i = 0; i < 96; i\+\+\) \{[\s\S]{0,1000}?vec3 p = cam \+ dir \* t;\s*\n\s*if \(uCellCount > 0\) resolveAt\(p\.xz\);/, 'resolved before the march and at every step while cells stand');
  assert.match(MARCH_FS, /float ds = \(fTop - fBase\) \/ float\(uLightSteps\) \* 0\.5;/, 'the light march reads what the step resolved');
  assert.match(MARCH_FS, /mix\(uCloudShade, uCloudLit, sideLit \* \(1\.0 - fGrey\)\)/, 'a cell\'s grey (VC6b: over the height ramp the low sun rolls over)');
  assert.match(MARCH_FS, /\(1\.0 - 0\.8 \* fDark\) \* \(1\.0 - 0\.5 \* fGrey\) \* fTint \+ ambient;/);   // WEATHER2d: and the cell's tint
  assert.doesNotMatch(MARCH_FS.replace(CLOUD_FIELD_GLSL, ''), /uniform float uDark;/, 'declared once, in the field');
  assert.match(SHADOW_FS, /float len = raySpans\(vec3\(g\.x, 0\.0, g\.y\), uLightDir\);/, 'SLAB-SPAN: and the shadow march its ground point\'s');
  assert.match(SHADOW_FS, /resolveAt\(g\);[^\n]*\n\s*for \(int i = 0; i < 24; i\+\+\) \{\s*\n\s*if \(i >= steps\) break;[^\n]*\n[^\n]*\n[^\n]*\n\s*if \(span >= spanN\) break;\s*\n\s*vec3 p = vec3\(g\.x, 0\.0, g\.y\) \+ uLightDir \* t;\s*\n\s*if \(uCellCount > 0\) resolveAt\(p\.xz\);/, 'the shadow is the cell\'s where it stands');
  // every uniform the field declares is on the list both programs fetch
  for (const n of ['uDark', 'uCellCount', 'uCell', 'uCellA', 'uCellB']) assert.ok(FIELD_UNIFORMS.includes(n), `${n} fetched`);
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

test('WEATHER2c the class and the controller: setState takes the cells (the controller\'s, joined by the door\'s) capped by the tier, uploads the packed arrays with the dark (SLAB-SPAN: no slab - each ray finds its own), shifts the test cell on a recenter; both controller paths hand the field\'s cells', () => {
  const vc = rd('src/render/volumetricClouds.js');
  assert.match(vc, /setState\(state, row, weather, easeDt, drift, flash = 0, pos = null, cells = null\) \{/);
  assert.match(vc, /if \(this\.testCellSpec && !this\.testCell && pos\) this\.testCell = parseCloudCellDoor\(this\.testCellSpec, pos\);/);
  // AUDIT-VC7: the door's cell JOINS the host's - the game hosts always hand a list (the map's, empty in clear air), and
  // a cell taken only in its place never stood in the game; capped by the tier (WEATHER3c's pickCells), convected (VC7a)
  const c = Object.create(VolumetricClouds.prototype);
  Object.assign(c, { q: { cells: 8 }, cam: [0, 0], shift: [0, 0], profile: null, cirrusCover: null, testCellSpec: 'rain,15000,6000' });
  const st = skyState({ minuteOfDay: 600, weather: 'sunny', classicMinutes: 600 });
  c.setState(st, WEATHER_SKY.sunny, 'sunny', 1e9, [0, 0], 0, [100, 0, 200], []);
  assert.deepEqual(c.cells.map((x) => [x.word, x.x, x.z]), [['rain', 15100, 200]], 'clear air from the map, and the door\'s storm east of the eye');
  const mapCell = cellOf('overcast', -9000, 0, 7000);
  c.setState(st, WEATHER_SKY.sunny, 'sunny', 1, [0, 0], 0, [100, 0, 200], [mapCell]);
  assert.deepEqual(c.cells.map((x) => x.word).sort(), ['overcast', 'rain'], 'beside the map\'s own');
  c.testCellSpec = null; c.testCell = null;
  c.setState(st, WEATHER_SKY.sunny, 'sunny', 1, [0, 0], 0, [100, 0, 200], null);
  assert.deepEqual(c.cells, [], 'no list and no door: no cells');
  assert.match(vc, /gl\.uniform1f\(u\.uDark, p\.dark\); gl\.uniform1f\(u\.uVary, p\.vary \?\? 0\);[^\n]*\n\s*\/\/ WEATHER2c: the cells \(SLAB-SPAN: each ray finds its own slab among them\)\s*\n\s*const k = packCells/, 'uploaded with the field, for both marches (VC6a: the zone\'s type variation beside the dark)');
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
