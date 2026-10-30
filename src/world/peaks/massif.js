// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PEAKS2 (2026-10-26, the owner: "The world of daggerfall mountains need to be completely redesigned from the ground up
// with more integration into the terrian ..."; bible/03-World/Peaks.md PEAKS2) - A RANGE IS THE LAND RISING: the massif's
// own relief over the macro ground, for the kernel's shaper to stand where LANDFORM8's cones stood (world/landforms.js
// peakField: one cone to a 2.3 km cell, a separate bump on the land).
//
// NOT WIRED YET. This module is the shape, whole and pinned (test/world/peaks2_massif.test.js); it goes into the kernel
// once the coast's work in world/landforms.js has landed and the mountain land's pins can be moved deliberately - the next
// release. Nothing reads it today.
//
// THE SHAPE, a sum of two fields, each centred on the land (its mean the macro's own, so the heightmap's shape stands):
//   - SPURS AND VALLEYS on a range's flanks: a ridged field stretched DOWN the macro's fall line (BREATHTAKER3's oriented
//     frames, world/tamriel/tamrielLandforms.js orient - the two fixed frames nearest the fall line, blended), a crest
//     every `across` with spurs off its flanks; the troughs between are the valleys, smooth-floored, falling with the land.
//   - THE CREST on the high ground, where the macro lies flat: a slow ridged field with no direction - its zero lines the
//     range's main crests - its height modulated along them by a slower field, so a crest rises to summits and falls to
//     SADDLES (the passes) between them; the crests meet in knots, the high peaks.
// The two blend by the macro's grade (`flank`): a flank is spurs, a summit plateau is crests, never a seam between. The
// amplitude grows with the land's height over the knee (`massifAmp`): nothing on the low ground, the FOOTHILLS a low
// swell that grows into the range, the whole relief from `crest` up - so a range rises out of the land and nothing stands
// as an object on it.
//
// PURE, AND ONE FLOAT IN EVERY ENGINE (AUDIT LANDFORMS III A8): a world position, the macro's fall line and grade and its
// height in, a height out - no Math.cos, Math.exp or `**`; the fall line is the caller's, read at the lattice's nodes on
// world positions (world/landforms.js HILL_NODE), so a sample on a pixel's edge is one number from both pixels.
// ═══════════════════════════════════════════════════════════════════
import { perlinNoise } from '../perlin.js';
import { orient, FRAME_C, FRAME_S, FRAME_OFF } from '../tamriel/tamrielLandforms.js';

/** THE DIALS (LANDFORM_DIALS' rule: one place). Heights in kernel units (1.25 m), lengths in samples (6.4 m).
 *  `foot` the land's height over the knee where the massif begins (300 m) and `crest` where it stands whole (1.9 km);
 *  `high` its relief there, over the macro and under it (375 m); the spurs `across` apart (2.4 km), `stretch` times longer
 *  down the fall line, their first crease rounded over `sharp`; the crests' wavelength `crestScale` (7 km) and their
 *  saddles' `saddleScale` (summit to summit, 5.8 km), a saddle falling to `saddle` of its crest; the grade (rise over run)
 *  `flank` past which the ground is a flank, the crest field fading out over its half either side. */
export const MASSIF_DIALS = Object.freeze({
  foot: 240,
  crest: 1500,
  high: 300,
  across: 380,
  stretch: 2.2,
  sharp: 0.05,
  crestScale: 1100,
  saddleScale: 900,
  saddle: 0.35,
  flank: 0.06,
});

const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const signed = (x, y) => 2 * perlinNoise(x, y) - 1;
/** |x| with its crease rounded over `k` (world/landforms.js softAbs's law). */
const softAbs = (x, k) => Math.sqrt(x * x + k * k) - k;

/** The massif's relief at a land `e` kernel units over the knee: nothing to `foot`, the whole `high` from `crest`, a
 *  smoothstep between - the foothills. Pure. */
export function massifAmp(e) {
  const D = MASSIF_DIALS;
  return D.high * smooth01((e - D.foot) / (D.crest - D.foot));
}

/** THE SPURS in frame `k`: a ridged multifractal `stretch` times longer along the frame's axis (the fall line) than across
 *  it - a crest every `across`, the finer octave riding the coarser's high ground (spurs off the spurs, the valleys kept
 *  smooth). About 0..1.5. `noise` signed noise (the pins count its calls). */
function spursIn(k, wx, wy, noise) {
  const D = MASSIF_DIALS,
    c = FRAME_C[k],
    s = FRAME_S[k],
    [ox, oy] = FRAME_OFF[k];
  const u = (wx * c + wy * s) / D.stretch,
    v = wy * c - wx * s;
  const a1 = 1 - softAbs(noise(u / D.across + ox + 101.3, v / D.across + oy + 7.9), D.sharp),
    a = a1 * a1;
  const b1 = 1 - softAbs(noise(u / (D.across * 0.42) + oy + 3.1, v / (D.across * 0.42) + ox + 55.7), 0.09),
    b = b1 * b1;
  return a + 0.5 * a * b;
}
/** THE CREST: a slow ridged field with no direction (its zero lines the main crests), its height along them modulated by
 *  a slower field - summits, and saddles falling to `saddle` of them between. About 0..1. */
function crestField(wx, wy, noise) {
  const D = MASSIF_DIALS;
  const a1 = 1 - softAbs(noise(wx / D.crestScale + 13.7, wy / D.crestScale + 71.1), 0.03),
    a = a1 * a1 * a1;
  const m = 0.5 + 0.5 * noise(wx / D.saddleScale + 47.3, wy / D.saddleScale + 2.9);
  return a * (D.saddle + (1 - D.saddle) * m);
}

/** The spurs' and the crest's means over the land and their gains (measured on a 60 km field of world positions,
 *  test/world/peaks2_massif.test.js holds them): `(field - mean) * gain` about -1..1. */
export const MASSIF_NORM = Object.freeze({ spurs: Object.freeze([0.979, 1.6]), crest: Object.freeze([0.401, 2.68]) });

const _f = new Float64Array(4);
/**
 * THE MASSIF'S SHAPE at world sample (wx, wy) - about -1..1, centred on the land: the spurs read in the two frames nearest
 * the fall line (`c2`, `s2`: its doubled angle's cosine and sine, unit - a slope and its opposite read one frame), blended
 * with the crest by the macro's `grade` (rise over run, metres). Pure in its arguments. `noise` signed noise in [-1, 1]
 * (perlin's, the default; the pins count its calls).
 * @param {number} wx @param {number} wy @param {number} c2 @param {number} s2 @param {number} grade
 * @param {(x: number, y: number) => number} [noise]
 */
export function massifShape(wx, wy, c2, s2, grade, noise = signed) {
  const D = MASSIF_DIALS,
    N = MASSIF_NORM;
  const flank = smooth01((grade - D.flank * 0.5) / D.flank); // 0 on a summit's plateau, 1 on a flank
  let out = 0;
  if (flank > 0) {
    orient(c2, s2, _f);
    let sp = _f[1] * spursIn(_f[0], wx, wy, noise);
    if (_f[3] > 0) sp += _f[3] * spursIn(_f[2], wx, wy, noise);
    out += flank * (sp - N.spurs[0]) * N.spurs[1];
  }
  if (flank < 1) out += (1 - flank) * (crestField(wx, wy, noise) - N.crest[0]) * N.crest[1];
  return out;
}

/** THE MASSIF'S RELIEF at world sample (wx, wy), kernel units: its shape times its amplitude at the land's height `e`
 *  over the knee (massifAmp). 0 on the low ground, whatever the shape. Pure. */
export function massifAt(wx, wy, c2, s2, grade, e, noise = signed) {
  const amp = massifAmp(e);
  return amp > 0 ? amp * massifShape(wx, wy, c2, s2, grade, noise) : 0;
}
