// VC7e - CLOUD DETAIL (2026-09-23, Mac, on the cloudy blur and the flat
// storm lid: "Whatever is the most visually detailed and immersive").
// Measured first: a deck's optical depth along the sun varied by a tenth
// across the sky (overcast 0.56-0.80, thunder 5.1-6.3), so no lighting
// could draw structure into it, and Beer's law alone made every storm
// point the same black. Three things fix it:
//   - THE DECK'S CELLS: the 32-cell Worley of the variation sample (the
//     same at every height, so it shapes whole columns) thins the lanes -
//     a lower ceiling, a higher base - scaled in with the cover;
//   - THE OCTAVES: the light through a thick deck by multiple scattering
//     (Wrenninge), normalised so no depth outshines an unshadowed path;
//   - THE AMBIENT THROUGH THE COLUMN: the sky's light comes down through
//     the column ABOVE the point (never the sun's sideways path, which
//     blackened dusk), weighted by the same deck amount, so a fair or
//     cloudy sky's tuned looks and a low sun's gold are untouched.
// What renders is the sky lab's (before/after in the arc); these pin the
// laws.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MS_OCTAVES, MS_A, MS_B, MS_C, msSum, AMBIENT_THROUGH_K, AMBIENT_FLOOR, CELL_EDGE_LO, CELL_EDGE_HI,
  DECK_COVER_LO, DECK_COVER_HI, CELL_BASE_LIFT, CELL_THIN, COLUMN_FILL, EXTINCTION, CLOUD_FIELD_GLSL, MARCH_FS, SHADOW_FS,
} from '../src/render/volumetricClouds.js';

const lit = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
const fnBody = (src, sig) => {
  const i = src.indexOf(sig);
  assert.ok(i >= 0, `declares ${sig}`);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error(`unterminated ${sig}`);
};

// the shader's light law, term for term (lightOctaves, then the march's normalised sum at a phase of one)
const single = (tau) => Math.exp(-tau) * (1 - 0.4 + 0.4 * (1 - Math.exp(-tau * 2)));
const octaves = (tau) => { let m = 0, a = MS_A, b = MS_B; for (let o = 1; o < MS_OCTAVES; o++) { m += a * Math.exp(-b * tau); a *= MS_A; b *= MS_B; } return m; };
const light = (tau) => (single(tau) + octaves(tau)) / msSum();

test('VC7e: the constants', () => {
  assert.deepEqual([MS_OCTAVES, MS_A, MS_B, MS_C], [3, 0.5, 0.35, 0.5]);
  assert.equal(msSum(), 1.75, 'one, a half, a quarter');
  assert.deepEqual([AMBIENT_THROUGH_K, AMBIENT_FLOOR, COLUMN_FILL], [0.35, 0.15, 0.5]);
  assert.deepEqual([CELL_EDGE_LO, CELL_EDGE_HI, DECK_COVER_LO, DECK_COVER_HI, CELL_BASE_LIFT, CELL_THIN], [0.35, 0.65, 0.4, 0.95, 0.07, 0.55]);
  // a lane keeps (1 - CELL_THIN) of a core's depth, lifted by CELL_BASE_LIFT of the band: the lid holds cloud from the
  // lifted base to half the thinned ceiling above it. The first cut kept a fifth (0.8) and the storm and the overcast
  // went transparent in the lanes - holes to the dome; this keeps under half, and they stay closed
  const lane = [CELL_BASE_LIFT, CELL_BASE_LIFT + 0.5 * (1 - CELL_THIN)];
  assert.ok(lane[1] > lane[0] && 1 - CELL_THIN >= 0.4, `a lane keeps ${((1 - CELL_THIN) * 100).toFixed(0)}% of the column (${lane.map((x) => x.toFixed(3)).join(' to ')} of the band)`);
});

test('VC7e: THE OCTAVES - light through a thick deck falls off slowly, never outshines a clear path, and still falls', () => {
  // the storm's measured depths, 5.1 to 6.3: Beer's law alone left both black
  assert.ok(single(6) < 0.003, `single scattering alone, at a storm's depth: ${single(6).toFixed(4)}`);
  assert.ok(light(6) > 20 * single(6), `the octaves carry light into it: ${light(6).toFixed(4)}`);
  assert.ok(light(3) / light(6) > 1.4, 'and a thin place in the deck is visibly lighter than a thick one');
  for (let t = 0; t <= 20; t += 0.5) {
    assert.ok(light(t) <= light(0) + 1e-12, 'no depth outshines an unshadowed path');
    assert.ok(light(t + 0.5) < light(t), 'deeper is darker, always');
  }
  // the shader is that law
  const oct = fnBody(MARCH_FS, 'vec3 lightOctaves(float tau)');
  assert.match(oct, /float single = exp\(-tau\) \* mix\(1\.0, powder, 0\.4\);/, 'octave 0: the single scattering it always was');
  assert.ok(oct.includes(`for (int o = 1; o < ${MS_OCTAVES}; o++) { multi += a * exp(-b * tau); a *= ${lit(MS_A)}; b *= ${lit(MS_B)}; }`));
  assert.ok(oct.includes(`float multi = 0.0, a = ${lit(MS_A)}, b = ${lit(MS_B)};`));
  assert.ok(MARCH_FS.includes(`float light = (oct.x * phase + oct.y * mix(phase, 1.0, ${lit(1 - MS_C)})) / ${lit(msSum())};`), 'normalised; the octaves\' phase flattened');
  assert.ok(MARCH_FS.includes('vec3 oct = lightOctaves(tau);') && MARCH_FS.includes('float tau = lightDepth(p);'));
  const depth = fnBody(MARCH_FS, 'float lightDepth(vec3 p)');
  assert.ok(depth.includes(`if (sum * EXT * ${MS_B ** (MS_OCTAVES - 1)} > 6.0) break;`), 'the march stops where the LAST octave stops seeing');
  assert.match(depth, /return sum \* EXT;/);
});

test('VC7e: THE DECK\'S CELLS - whole columns thinned in the lanes, scaled in with the cover; ONE column function for the density and the ambient', () => {
  const col = fnBody(CLOUD_FIELD_GLSL, 'vec4 columnAt(vec3 p, out vec4 v)');
  assert.ok(col.includes(`float cells = smoothstep(${lit(CELL_EDGE_LO)}, ${lit(CELL_EDGE_HI)}, v.a);`), 'the 32-cell Worley of the variation sample - read at one height, so it shapes the column');
  assert.ok(col.includes(`float deck = smoothstep(${lit(DECK_COVER_LO)}, ${lit(DECK_COVER_HI)}, fCover);`));
  assert.ok(col.includes(`float h = (p.y - fBase) / max(fTop - fBase, 1.0) - deck * ${lit(CELL_BASE_LIFT)} * (1.0 - cells);`), 'a lane\'s base lifts');
  assert.ok(col.includes(`ceiling *= 1.0 - deck * ${lit(CELL_THIN)} * (1.0 - cells);`), 'and its top comes down');
  assert.equal((col.match(/textureLod\(/g) || []).length, 1, 'one read - the variation sample density always took');
  const den = fnBody(CLOUD_FIELD_GLSL, 'float density(vec3 p, float mip)');
  assert.match(den, /vec4 col = columnAt\(p, v\);/);
  assert.match(den, /float h = col\.x;\n  if \(h <= 0\.0\) return 0\.0;/, 'below a lane\'s lifted base, nothing');
  assert.equal((den.match(/textureLod\(/g) || []).length, 2, 'the shape and the detail - the column read is columnAt\'s');
  const above = fnBody(CLOUD_FIELD_GLSL, 'float columnAbove(vec3 p)');
  assert.match(above, /vec4 col = columnAt\(p, v\);/, 'the ambient reads the SAME column the density is made of');
  assert.match(above, /float top = col\.y \* mix\(1\.0, 0\.5, col\.z\);/, 'the towers end at 1, the lid at 0.5');
  assert.ok(above.includes(`return EXT * fDensity * ${lit(COLUMN_FILL)} * (fTop - fBase) * max(top - max(col.x, 0.0), 0.0);`));
  // both marches take the field, so the ground's shadow is cast by the same cells
  assert.ok(MARCH_FS.includes(CLOUD_FIELD_GLSL) && SHADOW_FS.includes(CLOUD_FIELD_GLSL));
  assert.equal(EXTINCTION, 0.006);
});

test('VC7e: THE AMBIENT THROUGH THE COLUMN ABOVE - never the sun\'s path, and only as much as the sky is a deck', () => {
  assert.ok(MARCH_FS.includes(`float deckHere = smoothstep(${lit(DECK_COVER_LO)}, ${lit(DECK_COVER_HI)}, fCover);`), 'the cells\' own weight');
  assert.ok(MARCH_FS.includes(`ambient *= mix(1.0, max(${lit(AMBIENT_FLOOR)}, exp(-columnAbove(p) * ${lit(AMBIENT_THROUGH_K)})), deckHere);`));
  assert.doesNotMatch(MARCH_FS, /ambient \*=[^;\n]*tau/, 'the sun\'s sideways depth never dims the sky\'s light - at dusk it runs through kilometres of deck and blackened the gold');
  // the weights: a fair sky takes nothing of it, a cloudy sky a little, a deck all of it
  const w = (c) => { const t = Math.min(1, Math.max(0, (c - DECK_COVER_LO) / (DECK_COVER_HI - DECK_COVER_LO))); return t * t * (3 - 2 * t); };
  assert.equal(w(0.32), 0, 'sunny');
  assert.ok(w(0.55) < 0.2, `cloudy: ${w(0.55).toFixed(3)}`);
  assert.ok(w(0.94) > 0.99 && w(1) === 1, 'overcast and the storm');
  // and a storm's thin lane is lighter than its core, through the floor
  const amb = (tau) => Math.max(AMBIENT_FLOOR, Math.exp(-tau * AMBIENT_THROUGH_K));
  assert.ok(amb(3) / amb(6) > 2, 'the floor sits under a storm core\'s light, so the contrast survives it (the 0.35 floor erased it)');
});
