// @ts-check
// AUDIT SD III (V8, 2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's SD20c): THE
// BRASS AIR'S GRADE, for the land's haze AND the sky over it. SD19 graded the fog toward the brass near a standing
// Hollow and left the sky as it was: at the skyline the fogged land met the sky a step apart - 15/-4/-34 on a clear
// noon's horizon, 23/-6/-48 under an overcast dusk. The live event's dread is graded on both (world/dreadSky.js
// DREAD_GLSL, EVENT1), and so is the brass now: one ramp, its JS for the fog and the water's sky (systems/sdOmen.js
// re-exports it, SD19's door) and its GLSL for every pass that draws the sky - generated from the same stops, so the
// two cannot drift.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** The brass the haze leans to by its own brightness: the ramp's stops (luminance, colour). */
export const SD_BRASS_RAMP = Object.freeze([
  Object.freeze({ at: 0, color: Object.freeze([0.16, 0.1, 0.04]) }),
  Object.freeze({ at: 0.45, color: Object.freeze([0.62, 0.42, 0.16]) }),
  Object.freeze({ at: 0.9, color: Object.freeze([1.0, 0.8, 0.42]) }),
]);
const LUMA = [0.2126, 0.7152, 0.0722];
const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);

/** `rgb` (the land's haze, the sky's colour) graded toward the brass by `w` - a new array, `rgb` never written. Pure. */
export function sdBrassGrade(rgb, w) {
  const k = clamp01(w || 0);
  if (k === 0) return [rgb[0], rgb[1], rgb[2]];
  const l = LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2], [s0, s1, s2] = SD_BRASS_RAMP;
  const [a, b, f] = l < s1.at ? [s0.color, s1.color, clamp01((l - s0.at) / (s1.at - s0.at))] : [s1.color, s2.color, clamp01((l - s1.at) / (s2.at - s1.at))];
  return [0, 1, 2].map((i) => rgb[i] + (a[i] + (b[i] - a[i]) * f - rgb[i]) * k);
}

const glslVec = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
/** `sdBrassGrade` in GLSL - `vec3 brassGrade(vec3 c, float w)`, the same stops and weights (generated from them). A sky
 *  pass includes it and grades its final colour by its own `uBrass`, after the dread's. */
export const SD_BRASS_GLSL = (() => {
  const [s0, s1, s2] = SD_BRASS_RAMP, f = (v) => v.toFixed(4);
  return `
vec3 brassGrade(vec3 c, float w) {
  if (w <= 0.0) return c;
  float l = dot(c, vec3(${LUMA.map(f).join(', ')}));
  vec3 g = l < ${f(s1.at)} ? mix(${glslVec(s0.color)}, ${glslVec(s1.color)}, clamp((l - ${f(s0.at)}) / ${f(s1.at - s0.at)}, 0.0, 1.0))
                       : mix(${glslVec(s1.color)}, ${glslVec(s2.color)}, clamp((l - ${f(s1.at)}) / ${f(s2.at - s1.at)}, 0.0, 1.0));
  return mix(c, g, clamp(w, 0.0, 1.0));
}
`;
})();
