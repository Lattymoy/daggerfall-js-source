// @ts-check
// AURA-PIXEL (2026-10-31, the owner: "a comprehensive pass on all auras and while keeping their holographic designs, add
// some pixelation and bring it more inline with the daggerfall athestic"): EVERY AURA AND AURA ARMORY PIECE IN DAGGERFALL'S
// PIXELS. A look is answered at the middle of its texel - about a flat's pixel (AURA_TEXEL_M) on the surface it is drawn
// on, never coarser - and its light cut to AURA_PIXEL_STEPS levels through the ordered dither, so a glow reads as a
// painted sprite's. Where a texel would be no bigger than the screen's pixel it is answered per pixel. The designs are
// unchanged: only where they are sampled and how many levels they show. bible/04-Characters/Aura-Armory.md section 13.
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { BAYER_GLSL } from './orderedDither.js';

/** A texel's side (m): a Daggerfall flat's pixel at scale 0 (DFU GetScaledBillboardSize), the pixel the bodies wear. An
 *  Aura Armory piece takes half of it (ARMORY_TEXEL_M): it is a hand's breadth on the body, and its detail was asked for
 *  (Aura-Armory.md section 6) - at a whole flat's pixel the Ember Heart's veins and the Bracers' links were lost. */
export const AURA_TEXEL_M = GLOBAL_SCALE;
export const ARMORY_TEXEL_M = GLOBAL_SCALE / 2;
/** The light's levels, spaced by their square root so a dim glow keeps fine steps and is not dotted out - the Hour's
 *  shader surfaces take 8 to 10 (bible/11-Multiplayer/Super-Dungeons-Look.md "The pixel law"). */
export const AURA_PIXEL_STEPS = 10;

/** Texels to a unit of a surface coordinate that spans `metres` - a power of two, so a finer grid nests in a coarser
 *  where a curved mesh changes scale, and a whole number round a ring; rounded up, so a texel is `texel` at most and
 *  half of it at least. The shader's own law, in node. Pure. */
export const auraTexelsPer = (/** @type {number} */ metres, texel = AURA_TEXEL_M) =>
  metres > 0 ? 2 ** Math.max(0, Math.ceil(Math.log2(metres / texel) - 1e-6)) : 1;

/** The fragment half: `auraTexel(p, w, texel)` snaps a surface coordinate `p` to its texel's middle (measured from how
 *  far the world point `w` moves per unit of it) and keeps that texel in `auraCell` for the dither; `auraPixel(c, covers)`
 *  cuts a colour - an added light's brightness, or a covering one's cover (its colour kept, as the Crystal Resonance's
 *  one purple must be). Carries its own bayer4: a source that holds one already takes AURA_PIXEL_CORE. */
export const AURA_PIXEL_CORE = `
const float AURA_TEXEL = ${AURA_TEXEL_M.toFixed(4)}, ARMORY_TEXEL = ${ARMORY_TEXEL_M.toFixed(4)};
const float AURA_STEPS = ${AURA_PIXEL_STEPS.toFixed(1)};
vec2 auraCell;
// a texel no bigger than the screen's pixel, or a surface seen edge on: answered per pixel, the dither on the screen's
vec2 auraTexel(vec2 p, vec3 w, float texel) {
  vec2 px = dFdx(p), py = dFdy(p);
  vec3 wx = dFdx(w), wy = dFdy(w);
  float det = px.x * py.y - py.x * px.y;
  auraCell = floor(gl_FragCoord.xy);
  if (abs(det) < 1e-14) return p;
  vec2 m = vec2(length(wx * py.y - wy * px.y), length(wy * px.x - wx * py.x)) / abs(det);
  vec2 n = exp2(max(ceil(log2(max(m, vec2(1e-6)) / texel) - 1e-6), vec2(0.0)));
  vec2 foot = abs(px) + abs(py);
  if (any(lessThanEqual(1.0 / n, foot))) return p;
  auraCell = floor(p * n);
  return (auraCell + 0.5) / n;
}
// a light's brightest channel to its level by the square root (its hue kept), through the dither at its texel
vec3 auraLevels(vec3 c) {
  c = max(c, vec3(0.0));
  float l = max(max(c.r, c.g), c.b);
  if (l <= 1e-5) return vec3(0.0);
  float q = floor(sqrt(l) * AURA_STEPS + bayer4(auraCell) + 0.03125) / AURA_STEPS;
  return c * (q * q / l);
}
vec4 auraPixel(vec4 c, bool covers) {
  if (!covers) return vec4(auraLevels(c.rgb), c.a);
  float a = clamp(c.a, 0.0, 1.0), q = min(floor(a * AURA_STEPS + bayer4(auraCell) + 0.03125) / AURA_STEPS, 1.0);
  if (a * AURA_STEPS < 1.0) return vec4(auraLevels(c.rgb), q);   // a faint cover: its light alone, the cover dithered
  return vec4(c.rgb * (q / a), q);
}
`;
export const AURA_PIXEL_GLSL = BAYER_GLSL + AURA_PIXEL_CORE;
