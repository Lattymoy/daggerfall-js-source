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
//     (Wrenninge), normalised so no depth outshines an unshadowed path - a
//     DECK's only (AUDIT-VC7: they brightened every fair cloud), each octave
//     its own flattening;
//   - THE AMBIENT THROUGH THE COLUMN: the sky's light comes down through
//     the column ABOVE the point (never the sun's sideways path, which
//     blackened dusk), weighted by the same deck amount, so a fair or
//     cloudy sky's tuned looks and a low sun's gold are untouched.
// What renders is the sky lab's (before/after in the arc); these run the
// laws on the shader's own functions (cloudSky.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MS_OCTAVES, MS_A, MS_B, MS_C, msSum, AMBIENT_THROUGH_K, AMBIENT_FLOOR, CELL_EDGE_LO, CELL_EDGE_HI,
  DECK_COVER_LO, DECK_COVER_HI, CELL_BASE_LIFT, CELL_THIN, COLUMN_FILL, EXTINCTION, CLOUD_FIELD_GLSL, MARCH_FS, SHADOW_FS,
  DECK_VARY_FULL, VC_PROFILE,
} from '../src/render/volumetricClouds.js';
import { WEATHER_SKY } from '../src/render/enhancedSky.js';
import { glslFunctions } from './glsl.mjs';
import { marchFns, fieldFns } from './cloudSky.mjs';

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

// THE LAW, written from its definition (Wrenninge): octave 0 is Beer's law with the powder term at the phase; octave i
// carries MS_A^i of the light, extinguished by MS_B^i of the depth, its phase flattened MS_C^i of the way toward
// isotropic; the whole divided by the octaves' total share - and a DECK's alone, weighed in by how much of one the sky
// is (a fair sky takes the single scattering it was tuned with). The tests below hold the SHADER to it (cloudSky.mjs).
const single = (tau, phase = 1) => Math.exp(-tau) * (1 - 0.4 + 0.4 * (1 - Math.exp(-tau * 2))) * phase;
function spec(tau, phase, deck) {
  let sum = single(tau, phase), a = 1, b = 1, c = 1;
  for (let o = 1; o < MS_OCTAVES; o++) { a *= MS_A; b *= MS_B; c *= MS_C; sum += a * Math.exp(-b * tau) * (1 + (phase - 1) * c); }
  return single(tau, phase) + (sum / msSum() - single(tau, phase)) * deck;
}
const light = (tau) => spec(tau, 1, 1);

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
  // THE SHADER IS THAT LAW, run on its own text - at every depth, phase and deck weight
  const f = marchFns();
  for (const tau of [0, 0.3, 1, 2.5, 6, 12]) for (const phase of [0.4, 1, 2.5]) for (const deck of [0, 0.3, 1]) {
    assert.ok(Math.abs(f.lightOctaves(tau, phase, deck) - spec(tau, phase, deck)) < 1e-12, `tau ${tau}, phase ${phase}, deck ${deck}`);
  }
  // AUDIT-VC7 (B1): A FAIR SKY IS THE LAW IT WAS TUNED WITH - Beer and the powder at the phase, nothing added
  for (const tau of [0, 0.5, 2]) assert.equal(f.lightOctaves(tau, 1.7, 0), single(tau, 1.7));
  // AUDIT-VC7 (C4): EACH OCTAVE ITS OWN FLATTENING - the light's slope in the phase is octave 0's whole, octave i's
  // MS_C^i: a phase taken once over the octaves' sum would give octave 2 MS_C, not MS_C^2
  for (const tau of [0.5, 3]) {
    const slope = (f.lightOctaves(tau, 1.5, 1) - f.lightOctaves(tau, 0.5, 1)) / 1.0;
    let want = single(tau), a = 1, b = 1, c = 1;
    for (let o = 1; o < MS_OCTAVES; o++) { a *= MS_A; b *= MS_B; c *= MS_C; want += a * Math.exp(-b * tau) * c; }
    assert.ok(Math.abs(slope - want / msSum()) < 1e-12, `tau ${tau}`);
  }
  assert.ok(MARCH_FS.includes('float light = lightOctaves(tau, phase, deckHere);') && MARCH_FS.includes('float tau = lightDepth(p);'));
  // THE LIGHT MARCH, on its own text over a stand-in field: its steps reach past the slab (they grow), and it stops
  // only where the term that sees furthest stops seeing - the last octave's where the sky is a deck, the single
  // scattering's where it is not
  const depth = fnBody(MARCH_FS, 'float lightDepth(vec3 p)');
  const run = (deck, ext, inside) => glslFunctions(`uniform int uLightSteps; uniform vec3 uLightDir; float fBase; float fTop; float fDeck;
const float EXT = ${lit(ext)};
float deckWeight() { return fDeck; }
float density(vec3 p, float mip) { return ${inside}; }
${depth}`, { uLightSteps: 6, uLightDir: [0, 1, 0] });
  const whole = run(0, 1e-9, '1.0');
  Object.assign(whole.globals, { fBase: 800, fTop: 1600, fDeck: 0 });
  assert.ok(whole.lightDepth([0, 800, 0]) / 1e-9 >= 800, 'the steps together reach through the whole slab above');
  // a slab deep enough that the whole march is 12.5 of depth: a fair sky's light stops at the first step past 6; a
  // deck's last octave sees on past 6 / MS_B^2 (49), so its march goes all the way
  const ds = 100000 / 6 * 0.5, steps = [0, 1, 2, 3, 4, 5].map((i) => ds * (1 + i * 0.6) * 1e-4), full = steps.reduce((a, b) => a + b);
  let past6 = 0; for (const s of steps) { past6 += s; if (past6 > 6) break; }
  for (const [deck, want] of [[0, past6], [1, full]]) {
    const f2 = run(deck, 1e-4, '1.0');
    Object.assign(f2.globals, { fBase: 0, fTop: 100000, fDeck: deck });
    assert.ok(Math.abs(f2.lightDepth([0, 0, 0]) - want) < 1e-9, `deck ${deck}: ${f2.lightDepth([0, 0, 0]).toFixed(3)}, the march to ${want.toFixed(3)}`);
  }
  assert.ok(past6 < full, 'the fair sky does stop early (else this is vacuous)');
  assert.match(depth, /return sum \* EXT;/);
});

test('VC7e: THE DECK\'S CELLS - whole columns thinned in the lanes, scaled in with the cover; ONE column function for the density and the ambient', () => {
  // on the shader's own columnAt: the variation read answers a cells' weight a at one variation (r makes up the rest)
  let a = 0;
  const V = 0.6;
  const textureLod = (sampler, c) => (sampler === 'uShape' && Math.abs(c[1] - 0.37) < 1e-9 ? [(V - 0.35 * a) / 0.65, 0.5, 0.5, a] : [0.5, 0.5, 0.5, 0.5]);
  const smooth = (lo, hi, x) => { const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };
  const column = (over, at) => {
    const f = fieldFns([], { ...over, textureLod });
    f.resolveAt([0, 0]);
    a = at;
    return f.columnAt([0, 1000, 0], { value: null }, { value: null });
  };
  for (const [sky, row, vary] of [['overcast', WEATHER_SKY.overcast, VC_PROFILE.overcast.vary], ['a storm', WEATHER_SKY.thunder, VC_PROFILE.thunder.vary]]) {
    const over = { uCover: row.cover, uVary: vary, uBase: 800, uTop: 1600, uFlat: 0.5 };
    const deck = smooth(DECK_COVER_LO, DECK_COVER_HI, row.cover) * smooth(0, DECK_VARY_FULL, vary);
    const core = column(over, 1), lane = column(over, 0);
    const h0 = (1000 - 800) / 800, ceiling = 1 - vary * (1 - V) * 0.8;
    assert.ok(Math.abs(core[0] - h0) < 1e-12 && Math.abs(core[1] - ceiling) < 1e-12, `${sky}: a core is the column as it was`);
    assert.ok(Math.abs(lane[0] - (h0 - deck * CELL_BASE_LIFT)) < 1e-12, `${sky}: a lane's base lifts by ${CELL_BASE_LIFT} of the band at a whole deck`);
    assert.ok(Math.abs(lane[1] - ceiling * (1 - deck * CELL_THIN)) < 1e-12, `${sky}: and its top comes down by ${CELL_THIN}`);
  }
  // AUDIT-VC7 (B3): fog and a sandstorm ARE one thing everywhere - no lanes, whatever their cover; nor a fair sky
  for (const [sky, cover, vary] of [['fog', WEATHER_SKY.fog.cover, VC_PROFILE.fog.vary], ['a sandstorm', WEATHER_SKY.sandstorm.cover, VC_PROFILE.sandstorm.vary], ['a sunny sky', WEATHER_SKY.sunny.cover, VC_PROFILE.sunny.vary]]) {
    const over = { uCover: cover, uVary: vary, uBase: 800, uTop: 1600, uFlat: 0.5 };
    assert.deepEqual(column(over, 0), column(over, 1), `${sky}: lane and core alike`);
  }
  // ...and a cell's rim eases between: half the least varying row's vary is part of a deck
  const half = column({ uCover: 0.94, uVary: DECK_VARY_FULL / 2, uBase: 800, uTop: 1600 }, 0)[0], none = (1000 - 800) / 800;
  assert.ok(Math.abs(half - (none - CELL_BASE_LIFT * smooth(DECK_COVER_LO, DECK_COVER_HI, 0.94) * 0.5)) < 1e-12, 'eased, not snapped: half the lift at half the least varying row\'s vary');
  // UNDER A LANE'S LIFTED BASE, NOTHING - and the core beside it, at the very same height, is cloud: a storm's full
  // cover, the shape at its fullest, a point a twentieth of the band up
  const storm = { uCover: WEATHER_SKY.thunder.cover, uVary: VC_PROFILE.thunder.vary, uBase: 500, uTop: 4200, uFlat: 0.5, uDensity: 1, uSoft: 0 };
  // the shape at its fullest, the detail's erosion at its least - so only the lane's base can answer zero
  const at = (cells) => { const f = fieldFns([], { ...storm, textureLod: (sampler, c) => (sampler === 'uShape' && Math.abs(c[1] - 0.37) < 1e-9 ? [(V - 0.35 * cells) / 0.65, 0.5, 0.5, cells] : sampler === 'uShape' ? [1, 1, 1, 1] : [0, 0, 0, 0]) }); f.resolveAt([0, 0]); return f.density([0, 500 + 0.05 * 3700, 0], 0); };
  assert.equal(at(0), 0, 'a lane\'s base is lifted over it');
  assert.ok(at(1) > 0, 'a core comes down to it');
  assert.equal(DECK_VARY_FULL, Math.min(...Object.values(VC_PROFILE).map((r) => r.vary).filter((v) => v > 0)));
  const col = fnBody(CLOUD_FIELD_GLSL, 'vec4 columnAt(vec3 p, out vec4 v, out vec2 span)');
  assert.equal((col.match(/textureLod\(/g) || []).length, 1, 'one read - the variation sample density always took');
  const den = fnBody(CLOUD_FIELD_GLSL, 'float density(vec3 p, float mip)');
  assert.match(den, /vec4 col = columnAt\(p, v, span\);/);
  assert.equal((den.match(/textureLod\(/g) || []).length, 2, 'the shape and the detail - the column read is columnAt\'s');
  const above = fnBody(CLOUD_FIELD_GLSL, 'float columnAbove(vec3 p)');
  assert.match(above, /vec4 col = columnAt\(p, v, span\);/, 'the ambient reads the SAME column the density is made of');
  assert.match(above, /float top = col\.y \* mix\(1\.0, 0\.5, col\.z\);/, 'the towers end at 1, the lid at 0.5');
  assert.ok(above.includes(`return EXT * fDensity * ${lit(COLUMN_FILL)} * (fTop - fBase) * max(top - max(col.x, 0.0), 0.0);`));
  // one deck weight for the lanes, the stride's evidence and the octaves
  assert.equal((CLOUD_FIELD_GLSL.match(/smoothstep\([^;]*DECK|smoothstep\(0\.4, 0\.95, fCover\)/g) || []).length, 1, 'one place the deck is weighed');
  assert.ok(MARCH_FS.includes(CLOUD_FIELD_GLSL) && SHADOW_FS.includes(CLOUD_FIELD_GLSL), 'both marches take the field - the ground\'s shadow is cast by the same cells');
  assert.equal(EXTINCTION, 0.006);
});

test('VC7e: THE AMBIENT THROUGH THE COLUMN ABOVE - never the sun\'s path, and only as much as the sky is a deck', () => {
  assert.ok(MARCH_FS.includes('float deckHere = deckWeight();'), 'the cells\' own weight');
  assert.ok(MARCH_FS.includes(`ambient *= mix(1.0, max(${lit(AMBIENT_FLOOR)}, exp(-columnAbove(p) * ${lit(AMBIENT_THROUGH_K)})), deckHere);`));
  assert.doesNotMatch(MARCH_FS, /ambient \*=[^;\n]*tau/, 'the sun\'s sideways depth never dims the sky\'s light - at dusk it runs through kilometres of deck and blackened the gold');
  // the weights: a fair sky takes nothing of it, a cloudy sky a little, a deck all of it
  const w = (c) => { const t = Math.min(1, Math.max(0, (c - DECK_COVER_LO) / (DECK_COVER_HI - DECK_COVER_LO))); return t * t * (3 - 2 * t); };
  assert.equal(w(WEATHER_SKY.sunny.cover), 0, 'sunny');
  assert.ok(w(WEATHER_SKY.cloudy.cover) < 0.2, `cloudy: ${w(WEATHER_SKY.cloudy.cover).toFixed(3)}`);
  assert.ok(w(WEATHER_SKY.overcast.cover) > 0.99 && w(WEATHER_SKY.thunder.cover) === 1, 'overcast and the storm');
  // and a storm's thin lane is lighter than its core, through the floor
  const amb = (tau) => Math.max(AMBIENT_FLOOR, Math.exp(-tau * AMBIENT_THROUGH_K));
  assert.ok(amb(3) / amb(6) > 2, 'the floor sits under a storm core\'s light, so the contrast survives it (the 0.35 floor erased it)');
});
