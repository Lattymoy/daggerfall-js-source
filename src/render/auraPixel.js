// @ts-check
// AURA-PIXEL (2026-10-31, the owner: "a comprehensive pass on all auras and while keeping their holographic designs, add
// some pixelation and bring it more inline with the daggerfall athestic"): EVERY AURA IN DAGGERFALL'S PIXELS. A look is
// answered at the middle of its texel - about a flat's pixel (AURA_TEXEL_M) on the surface it is drawn on, never coarser
// - and its light cut to AURA_PIXEL_STEPS levels through the ordered dither, so a glow reads as a painted sprite's. Where
// a texel would be no bigger than the screen's pixel it is answered per pixel. An Aura Armory piece takes the levels
// alone (AUDIT AURA-PIXEL D3). bible/04-Characters/Aura-Armory.md section 13.
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { BAYER_GLSL } from './orderedDither.js';

/** A texel's side (m): a Daggerfall flat's pixel at scale 0 (DFU GetScaledBillboardSize; AUDIT AURA-PIXEL D7: the
 *  Layered Gearing bodies are drawn a little finer, 1.9 cm a pixel - EOTB_FIGURE.mpp). */
export const AURA_TEXEL_M = GLOBAL_SCALE;
/** AUDIT AURA-PIXEL A1/A5/D3: surfaces the measured texel misleads take a count of their own - a card at least 32 a side
 *  (it grows, and a small one's measure jumped a size mid-flight; its runes and emblems were blocks at 8), the cloth 256
 *  each way (curved, its triangles measured apart; its clasp was a blob), a wing's strand 64 along it and none across (its
 *  core is narrower than a texel). A big glow's card is measured, never coarser than a flat's pixel. */
export const AURA_CARD_TEXELS = 32;
export const AURA_CLOTH_TEXELS = 256;
export const AURA_STRAND_TEXELS = 64;
/** The light's levels, spaced by their square root so a dim glow keeps fine steps and is not dotted out - the Hour's
 *  shader surfaces take 8 to 10 (bible/11-Multiplayer/Super-Dungeons-Look.md "The pixel law"). */
export const AURA_PIXEL_STEPS = 10;

/** Texels to a unit of a surface coordinate that spans `metres` - a power of two, so a finer grid nests in a coarser
 *  where a curved mesh changes scale, and a whole number round a ring; rounded up, so a texel is AURA_TEXEL_M at most and
 *  half of it at least; never under `least`. The shader's own law, in node. Pure. */
export const auraTexelsPer = (/** @type {number} */ metres, least = 1) =>
  Math.max(least, metres > 0 ? 2 ** Math.max(0, Math.ceil(Math.log2(metres / AURA_TEXEL_M) - 1e-6)) : 1);

/** The fragment half: `auraTexel(p, w, texel, least)` snaps a surface coordinate `p` to its texel's middle (measured from how
 *  far the world point `w` moves per unit of it) and keeps that texel in `auraCell` for the dither; `auraPixel(c, covers)`
 *  cuts a colour - an added light's brightness, or a covering one's cover (its colour kept, as the Crystal Resonance's
 *  one purple must be). Carries its own bayer4: a source that holds one already takes AURA_PIXEL_CORE. */
export const AURA_PIXEL_CORE = `
const float AURA_TEXEL = ${AURA_TEXEL_M.toFixed(4)};
const float AURA_STEPS = ${AURA_PIXEL_STEPS.toFixed(1)};
const float AURA_CARD_TEXELS = ${AURA_CARD_TEXELS.toFixed(1)}, AURA_CLOTH_TEXELS = ${AURA_CLOTH_TEXELS.toFixed(1)}, AURA_STRAND_TEXELS = ${AURA_STRAND_TEXELS.toFixed(1)};
vec2 auraCell;
// AUDIT AURA-PIXEL A2: the snapped texel's side (m), 0 per pixel - a look's own lines are drawn at least this wide
float auraPx = 0.0;
// p snapped to n texels a unit - per pixel, the dither on the screen's, where a texel is no bigger than the pixel
vec2 auraSnap(vec2 p, vec2 n) {
  vec2 foot = abs(dFdx(p)) + abs(dFdy(p));
  auraCell = floor(gl_FragCoord.xy);
  if (any(lessThanEqual(1.0 / n, foot))) return p;
  auraCell = floor(p * n);
  return (auraCell + 0.5) / n;
}
// the count off how far the world point moves a unit of the surface; edge on, per pixel
vec2 auraTexel(vec2 p, vec3 w, float texel, vec2 least) {
  vec2 px = dFdx(p), py = dFdy(p);
  vec3 wx = dFdx(w), wy = dFdy(w);
  float det = px.x * py.y - py.x * px.y;
  auraCell = floor(gl_FragCoord.xy);
  if (abs(det) < 1e-14) return p;
  vec2 m = vec2(length(wx * py.y - wy * px.y), length(wy * px.x - wx * py.x)) / abs(det);
  vec2 n = max(exp2(max(ceil(log2(max(m, vec2(1e-6)) / texel) - 1e-6), vec2(0.0))), least);
  vec2 q = auraSnap(p, n);
  auraPx = q == p ? 0.0 : max(m.x / n.x, m.y / n.y);
  return q;
}
// a light's brightest channel to one of the two levels about it - levels the squares of tenths, the hue kept - by the
// dither at its texel, weighed in light so the mean holds (AUDIT AURA-PIXEL D3: weighed by the root, a faint glow's
// card drew a dotted square)
vec3 auraLevels(vec3 c) {
  c = max(c, vec3(0.0));
  float l = max(max(c.r, c.g), c.b);
  if (l <= 1e-5) return vec3(0.0);
  float k = floor(sqrt(l) * AURA_STEPS), lo = k / AURA_STEPS, hi = (k + 1.0) / AURA_STEPS;
  float q = (l - lo * lo) / (hi * hi - lo * lo) + bayer4(auraCell) + 0.03125 >= 1.0 ? hi : lo;
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
