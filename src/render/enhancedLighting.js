// @ts-check
// EL1 (2026-09-17, the Enhanced Lighting arc, tier one - FOUNDATIONS).
// Mac, on the fog Better Ambience brought into the dungeons: "we might
// need to update our enhanced lighting ... or we can take it a step
// further and enhance our lighting system tenfold". This is the floor
// every later tier stands on.
//
// WHAT THE CLASSIC LANE DOES, and why it cannot simply be tuned: the
// renderer's world programs light in DISPLAY space - a texel is read as
// the number the palette stored (an sRGB value), the scene's ambient,
// sun and lanterns are numbers tuned against that reading, the products
// and sums are written straight to the canvas. Light that adds in display
// space adds wrong (two half-lights make more than one full light), a
// lantern's `(1 - d/range)^2` is a shape chosen to look like Unity's on
// that wrong scale, and there is no headroom: a torch three feet from a
// wall clips to white where a real flame would bloom. Sixteen lights fill
// the cap on any lit street.
//
// WHAT THIS LANE DOES, in the order a fragment sees it:
//   1. DECODE the texel from sRGB to linear (elDecode / EL_GLSL) - the
//      textures stay the RGBA8 the classic lane uploads, so the decode is
//      per fragment, exact (NEAREST filtering samples one texel).
//   2. The scene's light values arrive DECODED too (the renderer runs
//      every colour it uploads through `decode` when the lane is
//      installed): a pure-gamma pipeline with both ends decoded lands the
//      one-light case exactly where the classic lane put it, and lands the
//      many-light case where physics puts it - lights ADD in linear space.
//   3. Lanterns fall off by a WINDOWED INVERSE SQUARE (elAttenuation):
//      hot near the flame (headroom the tonemap rolls off), the classic
//      shape's far field, and exactly zero at the range so a light popping
//      in and out of the nearest-N set never pops on screen. Forty-eight
//      of them (EL_MAX_LIGHTS), not sixteen.
//   4. Exposure, then an EXTENDED REINHARD tonemap (elTonemap): identity
//      in the dark end - a 0.12 dungeon ambient reads as it always did -
//      and a soft shoulder over 1.0, so a torch's near field blooms to
//      white instead of clipping there.
//   5. FOG IN-SCATTER (elScatter): the medium between the eye and the
//      wall glows where a lantern's light crosses it - the analytic single
//      scattering of a point light along the view ray, windowed to the
//      light's range and scaled by the fog's own density, so clear air
//      shows nothing and Better Ambience's foggy dungeons show every torch
//      as a halo.
//   6. ENCODE back to sRGB. The fog COLOUR is blended in decoded-then-
//      re-encoded form, so a fully fogged fragment is bit-for-bit the fog
//      colour - which is the sky's colour at the horizon, drawn by a
//      program this lane does not touch.
//
// TWO PROFILES ARE TWO PROGRAMS (precipitation.js's doctrine): the five
// fragment shaders here REPLACE the renderer's mesh, billboard, terrain,
// character and (MAC-BUG W6) decal fragment shaders when the lane is installed
// (Renderer.setLightingLane), under the SAME uniform names the renderer
// already uploads plus this lane's own (uELExposure, uELScatter). The
// classic lane never compiles them; a shader fault is still a boot fault
// the probe sees, at the host's mount. Nothing in the classic shaders
// changes.
//
// The pure functions below are the shader's terms in JS, term for term,
// so a test can pin the arithmetic the GPU runs without a GPU.

import { getPref } from '../systems/uiPrefs.js';
import { BLOOD_ABSORB, BLOOD_F0, BLOOD_MENISCUS, WET_THICK_LO, WET_THICK_HI, INK_DEPTH, WET_DARKEN } from '../combat/bloodArt.js';   // BLOOD3: the film's own law, beside the tints it already owns
import { isEnhanced } from '../systems/uiSkin.js';
import { SHADOW_GLSL, shadowCacheOn } from './shadowPass.js';   // EL2: the receiver block - the sun map on the sun term, the cube map on its lantern; SC1: the cache's door
import { FOG_GLSL as EL_FOG_GLSL } from './fogGlsl.js';   // AUDIT 68 S17-fog-glsl-dup: the fog law's one home, the classic lane's too (the lane's five interpolate it by this name)
import { AIR_ADAPT_GLSL, AIR_CONTACT_GLSL, AIR_CONTACT_RANGE_FRACTION, airOn, contactOn, glslFloat } from './airPass.js';   // EL6: no AO block - the resolve's; EL8: the contact block
import { BAYER_GLSL, BAYER_MEAN } from './orderedDither.js';
import { CLOUD_SHADOW_GLSL } from './cloudShadow.js';   // AUDIT 68 S16-el-cloudshadow-dup: the reader's one home, as the classic lane and the shafts take it - five hand copies were here
import { CLUSTER_X, CLUSTER_Y, CLUSTER_Z, CLUSTER_LIST_W, clustersOn } from './lightClusters.js';   // LC1: the grid the lantern loop walks, and its door   // EL6: the dither at the encode - the port's one Bayer
import { SHADE_DARK } from '../systems/concealDraw.js';   // AUDIT-EL F14: the shade's pull toward black, interpolated as the classic BB_FS does   // EL3: the ambient occlusion image by screen position, and its kill door; EL4: the adapted exposure

/** The lane's light cap - the classic lane's sixteen, tripled. Forty-eight
 *  vec4 + forty-eight vec3 are 96 uniform vectors; ES 3.0 guarantees 224
 *  for a fragment shader. */
export const EL_MAX_LIGHTS = 48;
/** The exposure the lane installs with. Chosen against the classic lane's
 *  numbers: a wall at ambient 0.12 lands at ~0.145, a 0.5 surface at ~0.52,
 *  a 1.0 surface at ~0.82 with the rest as headroom. `?exposure=` is the
 *  tuning door; Renderer.setExposure the host's. */
export const EL_EXPOSURE = 1.4;
/** The extended Reinhard white point: this linear value, after exposure,
 *  maps to display white. A flame's near field (elAttenuation's ~2x gain)
 *  lives under it. */
export const EL_WHITE = 4;
/** The in-scatter gain - how much of a lantern's light the fog gives back
 *  to the eye per unit of density. Tuned so a torch a stride off the view
 *  ray in Better Ambience's dungeon fog (linear, 0..~40 units) reads as a
 *  soft halo, not a searchlight. */
export const EL_SCATTER = 0.35;
// BOUNCE1 (2026-09-23), WITHDRAWN THE SAME DAY BY ITS AUDIT. A per-lantern bounce - a share of the light's attenuated
// colour weighted by facing the ground - was tried two ways and neither is sound: unshadowed it leaks through walls
// (a lantern in the next room bounced onto this room's wall, and every lantern past the eight casters has no map to
// shadow it by, so walls popped as lanterns took and lost their slots); shadowed by the lantern's cube map, a reach
// off the surface or at it, it fills nothing it was meant to fill (a pillar's flat back is deeper in the umbra a reach
// off, a wall between rooms is dark either way) and adds only where the light already lands. A bounce needs
// VISIBILITY FROM THE BOUNCE SOURCE - the lit floor - which a lantern's own map does not hold; that is a reflective
// shadow map (a colour and a normal beside the depth in the cube pass), its own step. Until then the fill is the
// lane's own: the trilight's ground and sky terms.
/** VOL1: `?volumetrics=off` - the lanterns' glow marched through their shadows (airPass.js VOL_FS) or the lane's
 *  own analytic glow per fragment, as before. */
export function volumetricsOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('volumetrics') !== 'off';
}
/** VC7b: the sun in the haze has its own door - `?haze=off` keeps the beams and drops the march. */
export function hazeOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('haze') !== 'off';
}
/** The near-field gain and the falloff's knee (elAttenuation). */
export const EL_LIGHT_GAIN = 2;
export const EL_LIGHT_KNEE = 16;
/** EL4: the lanterns' glint - Blinn-Phong gloss and strength, on the mesh,
 *  terrain and character shaders (a flat has no normal). */
export const EL_SPEC_GLOSS = 24;
export const EL_SPEC_STRENGTH = 0.12;
/** BLOOD2f: a WET surface's glint - fresh blood under a torch. Far
 *  tighter and far brighter than stone's low gloss above, scaled by the
 *  mark's own wetness (one fresh, zero dried), so the sheen is what
 *  says "wet" and it goes as the mark dries. */
export const EL_WET_GLOSS = 64;
export const EL_WET_STRENGTH = 0.55;   // BLOOD3: Schlick carries most of the reduction (4% head-on); this is what is left at a grazing angle, a sheen and not a mirror
/** EL4: PROPER DARK DUNGEONS. The lane scales a dungeon's ambient (DFU's
 *  flat 0.12 and Better Ambience's trilight alike; the Dungeon Brightness
 *  setting still rides on top) to this, so the light between the torches
 *  is the light the torches throw and the far end of a hall is dark. The
 *  eye's adaptation (airPass.js) opens over seconds into it and stops at
 *  its ceiling, so the dark stays dark. */
export const EL_DUNGEON_AMBIENT_SCALE = 0.35;
/** The warm flame the lane hands every lantern, torch and brazier whose
 *  host kept the classic white: a blackbody at ~1900 K, normalised to
 *  keep the green channel's brightness so the light is no dimmer than the
 *  white it replaces. Display-space, like every host colour. */
export const EL_FLAME_COLOR = Object.freeze([1.0, 0.72, 0.42]);

/** THE SWITCH, ONE HOME (waterSurface.js's waterSwitchOn pattern): the
 *  enhanced skin, the Enhanced Lighting pref, and `?lighting=classic` as
 *  the kill door. */
export function enhancedLightingOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('enhancedLighting') && new URLSearchParams(search).get('lighting') !== 'classic';
}

/** The exposure a page asks for: `?exposure=1.2` for tuning; EL_EXPOSURE
 *  otherwise. A non-number or a non-positive number is the default. */
export function exposureFor(search = globalThis.location?.search ?? '') {
  const v = Number(new URLSearchParams(search).get('exposure'));
  return Number.isFinite(v) && v > 0 ? v : EL_EXPOSURE;
}

/** sRGB -> linear, the IEC 61966-2-1 curve, per channel. */
export function elDecode(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
/** linear -> sRGB, the inverse of elDecode, clamped to [0, 1]. */
export function elEncode(c) {
  c = Math.min(Math.max(c, 0), 1);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
/** Decode three channels of `src` into `out` (a Float32Array the caller
 *  owns), and return `out`. The renderer runs every colour it uploads
 *  through this while the lane is installed. */
export function elDecode3(src, out) {
  out[0] = elDecode(src[0]); out[1] = elDecode(src[1]); out[2] = elDecode(src[2]);
  return out;
}
/** Decode `count` packed vec3 colours from `src` into `out`, and return the
 *  first count*3 of `out`. */
export function elDecodeN(src, out, count) {
  for (let i = 0; i < count * 3; i++) out[i] = elDecode(src[i]);
  return out.subarray ? out.subarray(0, count * 3) : out;
}

/** The lane's point-light falloff at distance d from a light of range r:
 *  a windowed inverse square - GAIN / (1 + KNEE (d/r)^2), times the
 *  smooth window (1 - (d/r)^4)^2 that reaches exactly zero at the range.
 *  Against the classic (1 - d/r)^2: hotter inside a fifth of the range,
 *  within a third of it beyond, zero at the same place. */
export function elAttenuation(d, range) {
  if (!(range > 0) || d >= range) return 0;
  const x = d / range;
  const x2 = x * x;
  let win = 1 - x2 * x2;
  win *= win;
  return EL_LIGHT_GAIN / (1 + EL_LIGHT_KNEE * x2) * win;
}

/** Extended Reinhard: x (1 + x / W^2) / (1 + x). Identity-like below
 *  ~0.05, W maps to 1.0, above W clips. The CURVE - one channel, or a
 *  luminance. */
export function elTonemap(x, white = EL_WHITE) {
  if (!(x > 0)) return 0;
  return x * (1 + x / (white * white)) / (1 + x);
}
/** HQ1 (2026-09-23, Mac: "make some insane improvements to our lighting system"): THE COLOUR THROUGH THE CURVE.
 *  Per-channel Reinhard bends HUE as it compresses: a torch's warm light (r > g > b) has its red channel on the
 *  shoulder while its blue is still on the slope, so the brighter the flame the more it went yellow-white and
 *  then flat white, and a sunlit red wall lost its red before it lost its light. This is the luminance-preserving
 *  blend ("Reinhard-Jodie"): the curve applied to the LUMINANCE keeps the colour's ratios (the flame stays orange
 *  as it brightens); the curve applied PER CHANNEL is what the eye expects at the very top (light desaturates
 *  toward white); the two are mixed by the per-channel result itself, so the dark and the mid-tones take the first
 *  and only the highlights the second. Every law of the curve holds: 0 to 0, identity in the dark end, the white
 *  point to display white, monotone, a grey unchanged (both terms agree on a grey). */
export function elTonemapRGB(c, white = EL_WHITE) {
  const r = Math.max(c[0], 0), g = Math.max(c[1], 0), b = Math.max(c[2], 0);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const tl = elTonemap(l, white);
  const tr = elTonemap(r, white), tg = elTonemap(g, white), tb = elTonemap(b, white);
  const k = l > 0 ? tl / l : 0;
  const w = (t) => Math.min(Math.max(t, 0), 1);
  return [r * k + (tr - r * k) * w(tr), g * k + (tg - g * k) * w(tg), b * k + (tb - b * k) * w(tb)];
}

/** The single-scattering integral of a point light along a view ray:
 *  the eye at the origin looking down unit `dir` to a surface `dist`
 *  away, the light at `light` (relative to the eye) with `range`. The
 *  in-scattered radiance of a uniform medium with `density` is
 *  density * (atan((tb - t0) / h) - atan((ta - t0) / h)) / h, where t0
 *  is the light's foot on the ray, h its distance off the ray, and
 *  [ta, tb] is the ray clipped to [0, dist] and to its CHORD through the
 *  light's sphere (t0 -+ sqrt(range^2 - h^2)) - so the medium beyond the
 *  light's reach contributes nothing, and a ray that misses the sphere
 *  gets nothing. EL_SCATTER_GLSL is this, term for term (AUDIT 68
 *  S16-elscatter-twin-drift: AUDIT VOL1 moved the GLSL to the chord and
 *  left this on the old slab of the range either side of t0). */
export function elScatter(light, range, dir, dist, density) {
  if (!(range > 0) || !(density > 0) || !(dist > 0)) return 0;
  const t0 = light[0] * dir[0] + light[1] * dir[1] + light[2] * dir[2];
  const hx = light[0] - dir[0] * t0, hy = light[1] - dir[1] * t0, hz = light[2] - dir[2] * t0;
  const h2 = hx * hx + hy * hy + hz * hz;
  const c2 = range * range - h2;
  if (c2 <= 0) return 0;
  const chord = Math.sqrt(c2);
  const h = Math.max(Math.sqrt(h2), 0.25);
  const ta = Math.max(0, t0 - chord), tb = Math.min(dist, t0 + chord);
  if (tb <= ta) return 0;
  return density * (Math.atan((tb - t0) / h) - Math.atan((ta - t0) / h)) / h;
}

/** The fog density the in-scatter integrates with, for the renderer's
 *  fog modes: 0 off, 1 linear over [start, end] (1 / span - the linear
 *  fog's mean extinction), 2 exp and 3 exp2 (the density itself). */
export function elScatterDensity(mode, density, start, end) {
  if (mode === 1) return 1 / Math.max(end - start, 1e-4);
  if (mode === 2 || mode === 3) return density;
  return 0;
}

/** THE SHARED BLOCK, interpolated into every shader below (the CLOUD_SHADOW_GLSL
 *  precedent: a declaration is visible only to its own compilation unit). */
/** HQ1's curve alone - shared with the air pass's volumetric glow (VOL1), which tonemaps its own light as elFinish does. */
export const EL_TONEMAP_GLSL = `
vec3 elTonemap(vec3 x) {
  return x * (1.0 + x / ${EL_WHITE}.0 / ${EL_WHITE}.0) / (1.0 + x);
}
// HQ1: the colour through the curve - the luminance's curve keeps the hue, the per-channel curve desaturates the
// highlights, mixed by the per-channel result (elTonemapRGB in enhancedLighting.js, term for term)
vec3 elTonemapRGB(vec3 c) {
  c = max(c, vec3(0.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float tl = (l * (1.0 + l / ${EL_WHITE}.0 / ${EL_WHITE}.0) / (1.0 + l));
  vec3 tc = elTonemap(c);
  vec3 hue = l > 0.0 ? c * (tl / l) : vec3(0.0);
  return mix(hue, tc, clamp(tc, 0.0, 1.0));
}
`;
/** The single-scattering integral for one light, closed form - shared with VOL1, whose march sums the same
 *  integrand (1 / (h^2 + s^2)) through a caster's cube. */
export const EL_SCATTER_GLSL = `
// the single-scattering integral (elScatter in enhancedLighting.js), for
// one light at L (relative to the eye) along the unit ray dir to dist
// AUDIT VOL1: over the ray's CHORD through the light's sphere, not a slab of the range either side of the closest
// point - a ray that misses the sphere glowed a little from air the light never reaches, and the march (which sums
// this integrand) walked its eight steps across every such slab
float elScatter(vec3 L, float range, vec3 dir, float dist) {
  float t0 = dot(L, dir);
  vec3 hv = L - dir * t0;
  float h2 = dot(hv, hv);
  float chord = range * range - h2;
  if (chord <= 0.0) return 0.0;
  chord = sqrt(chord);
  float h = max(sqrt(h2), 0.25);
  float ta = max(0.0, t0 - chord), tb = min(dist, t0 + chord);
  if (tb <= ta) return 0.0;
  return (atan((tb - t0) / h) - atan((ta - t0) / h)) / h;
}
`;
export const EL_GLSL = `
uniform float uELExposure;   // EL1: scene exposure before the tonemap
uniform float uELScatter;    // EL1: in-scatter gain x the fog's density (0 = no fog, no glow; VOL1: 0 on a world frame the air pass glows for)
uniform vec3 uFogColorLin;   // PERF-FOG: the fog colour ALREADY DECODED - see elFinish
${BAYER_GLSL}
${AIR_ADAPT_GLSL}
vec3 elDecode(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(hi, lo, step(c, vec3(0.04045)));
}
vec3 elEncode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(hi, lo, step(c, vec3(0.0031308)));
}
float elAttenuation(float d, float range) {
  float x = d / max(range, 1e-4);
  float x2 = x * x;
  float win = clamp(1.0 - x2 * x2, 0.0, 1.0);
  win *= win;
  return ${EL_LIGHT_GAIN}.0 / (1.0 + ${EL_LIGHT_KNEE}.0 * x2) * win;
}
${EL_TONEMAP_GLSL}
${EL_SCATTER_GLSL}
`;

/** LC1: THE CLUSTER BLOCK - the grid and the list (render/lightClusters.js), read once per fragment. With the
 *  grid off (`uClusterOn` 0: a sprite pass, a panel, an overflowed frame, `?clusters=off`) a cell is "every
 *  light", so the loop below has ONE body and two ways to count. Interpolated at the head of the lantern loop. */
export const EL_CLUSTER_GLSL = `
uniform highp usampler2D uClusterGrid;   // LC1: (offset, count) per cell, texel (x + y * CLUSTER_X, z)
uniform highp usampler2D uClusterList;   // LC1: the light indices, ${CLUSTER_LIST_W} to a row
uniform vec4 uClusterRect;               // LC1: the world viewport's x, y, and CLUSTER_X / w, CLUSTER_Y / h
uniform vec2 uClusterZ;                  // LC1: 1 / CLUSTER_NEAR, CLUSTER_Z / log(FAR / NEAR)
uniform vec4 uCamFwd;                    // LC1: the view's third row negated - dot(xyz, wp) + w is a point's view depth
uniform int uClusterOn;                  // LC1: 1 on a world frame with a grid built; 0 walks every light
// the fragment's cell as (offset, count) into the list - or (0, uPointCount) with the grid off
uvec2 elCluster(vec3 wp) {
  if (uClusterOn == 0) return uvec2(0u, uint(uPointCount));
  ivec2 t = clamp(ivec2((gl_FragCoord.xy - uClusterRect.xy) * uClusterRect.zw), ivec2(0), ivec2(${CLUSTER_X - 1}, ${CLUSTER_Y - 1}));
  float depth = dot(uCamFwd.xyz, wp) + uCamFwd.w;
  int z = clamp(int(log(max(depth * uClusterZ.x, 1.0)) * uClusterZ.y), 0, ${CLUSTER_Z - 1});
  return texelFetch(uClusterGrid, ivec2(t.x + t.y * ${CLUSTER_X}, z), 0).rg;
}
// the j-th light of a cell - the list's byte, or j itself with the grid off
int elClusterLight(uvec2 cell, int j) {
  if (uClusterOn == 0) return j;
  int at = int(cell.x) + j;
  return int(texelFetch(uClusterList, ivec2(at & ${CLUSTER_LIST_W - 1}, at >> ${Math.log2(CLUSTER_LIST_W)}), 0).r);
}
`;

// The lantern loop and the in-scatter loop, shared by the three lit
// programs. `n` is the surface normal (the billboard passes none and
// takes the attenuation alone - it has no normal, as in the classic lane).
// LC1: the loop walks the fragment's CELL (elCluster) - two or three
// lights where it walked forty-eight - and every light with the grid off.
const EL_POINT_LIT_GLSL = `
${EL_CLUSTER_GLSL}
// BLOOD2f / BLOOD AUDIT 5: the lantern loop with a WET surface's glint
// beside the diffuse - ONE loop, ONE shadow answer for both (a mark in a
// contact shadow is glint-shadowed as it is diffuse-shadowed), the
// highlight at the wet gloss skipped where it is zero, which is nearly
// all of a mark. \'wet\' zero is the plain loop; \'glint\' is the light's
// colour, not the surface's - the lamp seen in the wet.
// AUDIT BLOOD3 F5: SCHLICK FOR A SPECULAR LOBE IS F(V.H), NOT F(N.V).
// BLOOD3 shipped the latter, hoisted out in front of every light - and
// a (N.H)^64 lobe peaks where the half-vector lines up with the normal,
// which is a different regime from where N.V grazes. The two together
// took a mark underfoot with a torch at head height down by 82x: not
// "less shiny", but not wet at all. The angle belongs beside the lobe
// it scales, once per light, against that light's own half-vector.
float wetFresnel(float vdoth) {
  return ${glslFloat(BLOOD_F0)} + ${glslFloat(1 - BLOOD_F0)} * pow(1.0 - clamp(vdoth, 0.0, 1.0), 5.0);
}
vec3 elPointLitWet(vec3 wp, vec3 n, float wet, out vec3 glint) {
  vec3 acc = vec3(0.0);
  glint = vec3(0.0);
  uvec2 cell = elCluster(wp);   // LC1
  int cellCount = int(cell.y);
  for (int j = 0; j < ${EL_MAX_LIGHTS}; j++) {
    if (j >= cellCount) break;
    int i = elClusterLight(cell, j);
    vec3 L = uPointLights[i].xyz - wp;
    float d = length(L);
    if (d >= uPointLights[i].w) continue;   // EL5: outside the window the term is exactly zero - no shadow taps, no glint, no pow for it
    vec3 Ln = L / max(d, 1e-4);
    int k = uCasterOf[i];   // EL8: the light's caster slot in one lookup
    // EL2: the lantern's map; EL8: every other lantern a contact shadow off the previous frame's depth;
    // F3/MAC-T1: never for the light in the hand - by name, -2 in the caster table (LIGHT-NEAR1: and no longer by its distance to the camera, which dropped the lamp overhead too);
    // F5: and only within the share of the range where the light is worth a shadow
    float sh = k >= 0 ? casterShadowAt(k, uPointLights[i], wp, n)   // DISC15: a 512 slot or a lo one - indoors, every light has one
      : (k == -2 || d > uPointLights[i].w * ${glslFloat(AIR_CONTACT_RANGE_FRACTION)}) ? 1.0   // MAC-T1: -2 is the hand's light, by name
      : contactShadow(wp, n, Ln, d);
    // EL4: a glint - Blinn-Phong, a low gloss for stone and wood, a twelfth of the light: wet stone under a torch
    vec3 V = normalize(uCamPos - wp);
    vec3 H = normalize(Ln + V);
    float spec = pow(max(dot(n, H), 0.0), ${EL_SPEC_GLOSS}.0) * ${EL_SPEC_STRENGTH};
    float att = sh * elAttenuation(d, uPointLights[i].w);
    acc += att * (max(dot(n, Ln), 0.0) + spec) * uPointColors[i];
    if (wet > 0.0) {
      float g = pow(max(dot(n, H), 0.0), ${EL_WET_GLOSS}.0);
      if (g > 0.0) glint += att * g * wetFresnel(dot(V, H)) * uPointColors[i];   // AUDIT BLOOD3 F5: this light's own angle, beside this light's own lobe
    }
  }
  glint *= ${glslFloat(EL_WET_STRENGTH)} * wet;
  return acc;
}
vec3 elPointLit(vec3 wp, vec3 n) { vec3 g; return elPointLitWet(wp, n, 0.0, g); }
// a flat's lantern term, attenuation only; its shadow is read at the
// flat's base (one value for the whole sprite - a sprite in its own map
// would shadow itself)
vec3 elPointFlat(vec3 wp, vec3 base) {
  vec3 acc = vec3(0.0);
  uvec2 cell = elCluster(wp);   // LC1
  int cellCount = int(cell.y);
  for (int j = 0; j < ${EL_MAX_LIGHTS}; j++) {
    if (j >= cellCount) break;
    int i = elClusterLight(cell, j);
    float d = length(uPointLights[i].xyz - wp);
    if (d >= uPointLights[i].w) continue;   // EL5
    float sh = shadowOfLight(i, uPointLights[i], base, vec3(0.0, 1.0, 0.0));   // EL2; EL5: any caster's; DISC15: either tier
    acc += sh * elAttenuation(d, uPointLights[i].w) * uPointColors[i];
  }
  return acc;
}
vec3 elIndirectLit(vec3 wp, vec3 n) {
  vec3 iL = uIndirect.xyz - wp;
  float iD = length(iL);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  return iAtt * iAtt * max(dot(n, iL / max(iD, 1e-4)), 0.0) * uIndirectColor;
}
vec3 elIndirectFlat(vec3 wp) {
  float iD = length(uIndirect.xyz - wp);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  return iAtt * iAtt * uIndirectColor;
}
// the glow of the medium between the eye and wp, every lantern summed
vec3 elInScatter(vec3 wp) {
  if (uELScatter <= 0.0) return vec3(0.0);
  vec3 ray = wp - uCamPos;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-4);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${EL_MAX_LIGHTS}; i++) {
    if (i >= uPointCount) break;
    vec3 rel = uPointLights[i].xyz - uCamPos;
    if (length(rel) > dist + uPointLights[i].w) continue;   // EL6: a lantern farther than the ray reaches plus its range glows on no part of it
    acc += elScatter(rel, uPointLights[i].w, dir, dist) * uPointColors[i];
  }
  return acc * uELScatter;
}
// the lane's output: tonemap the lit surface, blend the (decoded) fog
// colour in linear, add the tonemapped glow, encode
vec3 elFinish(vec3 lit, vec3 wp) {
  float ex = uELExposure * elAdapt();   // EL4: the eye's own multiplier rides the scene's exposure
  vec3 tm = elTonemapRGB(lit * ex);   // HQ1: the colour through the curve
  // PERF-FOG (2026-09-19): THE FOG COLOUR ARRIVES DECODED. This line read
  // elDecode(uFogColor) - three pow() calls, per fragment, on a UNIFORM.
  // The value is the same for every pixel of the frame and it was being
  // recomputed for every one of them, in every lane shader there is: the
  // terrain, the meshes, the rigs and every flat in the world. GLSL has
  // nowhere to hoist a uniform-only expression to, so the only place it
  // can be done once is the host. The lane already carries that decoder -
  // elDecode3, the same piecewise sRGB curve as elDecode above, which the
  // renderer reaches through the lane it was handed - so this needs no
  // second copy of the law, only a place to keep the answer.
  vec3 col = mix(uFogColorLin, tm, fogFactorAt(wp));
  col += elTonemapRGB(elInScatter(wp) * ex);   // HQ1
  return elEncode(col) + (bayer4(gl_FragCoord.xy) - ${BAYER_MEAN}) / 255.0;   // EL6: dithered at the byte, zero-mean - a lantern's falloff on a dark floor is bands without it
}
`;

/** The mesh fragment shader of the lane - the classic FS's every term
 *  (the automap presentation, the trilight, emission's cancel-and-return,
 *  the cloud shadow) on the lane's pipeline. */
export const EL_MESH_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in vec3 vWorldPos;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
uniform float uTrilight;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform vec3 uLight3Dir;
uniform float uLight3Scale;
uniform vec3 uLight3Color;
uniform vec3 uEmissionColor;
uniform int uPointCount;
uniform vec4 uPointLights[${EL_MAX_LIGHTS}];
uniform vec3 uPointColors[${EL_MAX_LIGHTS}];
uniform vec4 uIndirect;
uniform vec3 uIndirectColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform float uClipY;
uniform float uAutomapMode;
uniform float uAutomapWaterLevel;
uniform vec4 uAutomapWaterColor;
${CLOUD_SHADOW_GLSL}
${EL_GLSL}
${SHADOW_GLSL}
${AIR_CONTACT_GLSL}
${EL_FOG_GLSL}
${EL_POINT_LIT_GLSL}
out vec4 outColor;
void main() {
  int amMode = int(uAutomapMode + 0.5);
  if (amMode >= 3) { if (vWorldPos.y <= uClipY) discard; }
  else if (vWorldPos.y > uClipY) discard;
  vec4 tex = texture(uTex, vUV);
  vec3 n = normalize(vNormal);
  // PERF-SUN2 (2026-09-19, Mac: "over 1000 calls and looking up in the sky
  // restores frame rate"): THE SUN'S SHADOW IS NOT READ WHERE THE SUN
  // CANNOT REACH. This was one flat product, and GLSL evaluates every
  // operand of one: a surface whose normal faces AWAY from the sun paid
  // nine hardware-PCF compares and a cloud-deck sample, and then
  // multiplied them by the zero sitting in front of them. Every
  // north-facing wall, every back slope, and the whole world whenever the
  // sun is low. The uSunScale half is a UNIFORM branch, so it is free
  // and it takes out dusk and dawn as well, where the map is still drawn
  // but the sun contributes nothing; diff reaches the light exactly
  // once, as uSunColor * (uSunScale * diff), so gating it on either is
  // output-identical rather than an approximation.
  float ndl = max(dot(n, uLightDir), 0.0);
  float diff = (uSunScale > 0.0 && ndl > 0.0) ? ndl * cloudShadowAt(vWorldPos) * sunShadowAt(vWorldPos, n) : 0.0;   // EL2: the sun map
  float mdiff = max(dot(n, uMoonDir), 0.0);
  float l3diff = max(dot(n, uLight3Dir), 0.0);
  // emission cancels other light (DaggerfallDefault.shader:83-85), in linear
  vec3 emission = elDecode(texture(uEmissionTex, vUV).rgb) * uEmissionColor;
  vec3 albedo = max(elDecode(tex.rgb) - emission, vec3(0.0));
  vec3 ambient = uTrilight > 0.5 ? (n.y >= 0.0 ? mix(uAmbient, uAmbientSky, n.y) : mix(uAmbient, uAmbientGround, -n.y)) : uAmbient;   // EL6: the crevice loses its light at the resolve, off the frame's depth
  vec3 lit = albedo * (ambient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff)
    + uLight3Color * (uLight3Scale * l3diff) + elPointLit(vWorldPos, n) + elIndirectLit(vWorldPos, n));
  outColor = vec4(elFinish(lit + emission, vWorldPos), 1.0);
  if (amMode > 0) {
    if (vWorldPos.y <= uAutomapWaterLevel) {
      outColor.rgb = mix(outColor.rgb, uAutomapWaterColor.rgb, uAutomapWaterColor.a);
    }
    if (amMode >= 5) outColor = (amMode >= 6) ? vec4(0.25, 0.25, 0.25, 0.6) : vec4(0.9, 0.9, 0.7, 0.6);
    else if (amMode >= 3) outColor.a = 0.75;
    float sliceDist = distance(min(vWorldPos.y, uClipY), uClipY);
    outColor.rgb *= 1.0 - clamp(sliceDist / 20.0, 0.0, 0.6);
    if (amMode % 2 == 0) {
      float grayValue = dot(outColor.rgb, vec3(0.3, 0.59, 0.11));
      outColor.rgb = vec3(grayValue);
    }
  }
}`;

/** The billboard fragment shader of the lane - the classic BB_FS's
 *  cutout, spectral, conceal and emission terms, lit on the lane's
 *  pipeline. uTint and uBBSun arrive decoded like every other colour. */
export const EL_BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vBBWorld;
in vec3 vBBBase;   // EL2: the flat's placement base (BB_VS)
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform int uSpectral;
uniform vec4 uConceal;
uniform vec3 uTint;
uniform vec3 uBBSun;
uniform int uPointCount;
uniform vec4 uPointLights[${EL_MAX_LIGHTS}];
uniform vec3 uPointColors[${EL_MAX_LIGHTS}];
uniform vec4 uIndirect;
uniform vec3 uIndirectColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${CLOUD_SHADOW_GLSL}
${EL_GLSL}
${SHADOW_GLSL}
${AIR_CONTACT_GLSL}
${EL_FOG_GLSL}
${EL_POINT_LIT_GLSL}
out vec4 outColor;
void main() {
  vec2 uv = vUV;
  if (uConceal.x == 1.0) {
    uv.x += sin(vUV.y * 28.0 + uConceal.z * 7.0 + uConceal.w) * 0.008;
    if (uv.x < 0.0 || uv.x > 1.0) discard;
  }
  vec4 tex = texture(uTex, uv);
  if (tex.a < ((uSpectral == 1 || uConceal.x > 0.0) ? 0.1 : 0.5)) discard;
  vec3 emission = elDecode(texture(uEmissionTex, uv).rgb);
  vec3 albedo = max(elDecode(tex.rgb) - emission, vec3(0.0));
  vec3 base = vBBBase + vec3(0.0, 0.5, 0.0);   // EL2: the shadow is read a half unit up the sprite's base, once for the whole flat
  // PERF-SUN2: a flat has no normal, so there is no n.L to gate on - but
  // there is still uBBSun, which is the sun's whole share of the tint
  // and is ZERO at night. A uniform branch, so every sprite in the world
  // stops paying nine shadow compares for a term that is not there.
  // TREES1: sunShadowSOFTat - a flat reads its shadow ONCE for the whole
  // sprite, so the kernel is the only gradation it gets and the far
  // cascade's one-tap trade does not apply to it.
  vec3 sunLit = dot(uBBSun, uBBSun) > 0.0 ? uBBSun * cloudShadowAt(vBBWorld) * sunShadowSoftAt(base, vec3(0.0, 1.0, 0.0)) : vec3(0.0);
  vec3 lit = albedo * (uTint + sunLit + elPointFlat(vBBWorld, base) + elIndirectFlat(vBBWorld)) + emission;
  if (uConceal.x == 2.0) lit *= ${SHADE_DARK};   // AUDIT-EL F14: a uniform nothing uploaded read 0 - every shade a black cut-out
  if (uConceal.x == 4.0) lit = vec3(0.0);
  float alpha = uSpectral == 1 ? tex.a : 1.0;
  if (uConceal.x > 0.0) alpha = tex.a * uConceal.y;
  outColor = vec4(elFinish(lit, vBBWorld), alpha);
}`;

/** MAC-BUG W6 (2026-09-20, Mac: "super dark coloring instead of red") -
 *  THE DECAL FRAGMENT SHADER OF THE LANE: the classic DECAL_FS's every
 *  term (renderer.js - MAC-BUG W4's flat model, term for term with the
 *  billboard pass), lit on the lane's pipeline.
 *
 *  WHY IT EXISTS. W4 left the decal "a fifth classic program with no
 *  lane twin", and pinned that as a limit about the LIGHT CAP (sixteen
 *  lanterns of forty-eight). The cap was the small half. Under the lane
 *  the renderer DECODES every colour it uploads - the ambient, the sun,
 *  the moon, the lanterns, the indirect (`_c3`, `_pointColorData`) -
 *  because the lane's shaders light in linear and encode at the end.
 *  The classic decal program took those linear values as if they were
 *  display ones, multiplied an UNDECODED texel by them, and wrote the
 *  product straight to the canvas: no exposure, no tonemap, no encode.
 *  A dungeon's 0.12 ambient decodes to 0.013, and 0.013 written raw is
 *  three units of red. Measured in a real context beside a sprite in
 *  the same light (tools/bloodProbe.mjs, the LANE rows): dusk 25
 *  against the sprite's 69, a dark dungeon 2 against 17, noon 128
 *  against 137. Every mark the port has drawn under its default
 *  lighting has been darker than the blood it came from.
 *
 *  THE MODEL IS THE FLAT'S, as W4 chose it: a mark has no normal in
 *  its vertex format, so it takes the billboard's attenuation-only
 *  lantern term, the sun's Lambert-average half, and the indirect on
 *  the same attenuation - EL_BB_FS above, term for term, so the two
 *  passes of one blow agree under this lane as they do under the
 *  classic one. `vColor` is the decal's tint and decodes WITH the
 *  texel, as EL_CHAR_FS decodes its vertex colour.
 *
 *  THE ONE THING A MARK HAS THAT A FLAT DOES NOT is a surface. A flat
 *  reads its shadows half a unit up from its base so the sprite cannot
 *  shadow itself; a mark on a CEILING read half a unit UP would read
 *  inside the rock. So the mark's normal is derived from its own quad
 *  (the screen-space derivatives of a planar quad are exact), turned
 *  to face the eye, and the shadow is read half a unit out along IT -
 *  a floor's mark reads up, a ceiling's down, a wall's into the room. */
export const EL_DECAL_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vColor; in vec3 vWorld; in float vWet;
uniform sampler2D uTex;
uniform vec3 uTint;
uniform vec3 uDecalSun;
uniform int uPointCount;
uniform vec4 uPointLights[${EL_MAX_LIGHTS}];
uniform vec3 uPointColors[${EL_MAX_LIGHTS}];
uniform vec4 uIndirect;
uniform vec3 uIndirectColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform vec3 uDecalMoon;   // BLOOD AUDIT 5: the moon, by N.L as the mesh takes it (W4 folded its half into the ambient)
uniform vec3 uMoonDir;
uniform float uTrilight;   // BLOOD AUDIT 5: and the trilight ambient the mesh takes
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
${CLOUD_SHADOW_GLSL}
${EL_GLSL}
${SHADOW_GLSL}
${AIR_CONTACT_GLSL}
${EL_FOG_GLSL}
${EL_POINT_LIT_GLSL}
out vec4 outColor;
void main() {
  vec4 t = texture(uTex, vUV);
  // A DEGENERATE SLOT still rasterises nothing, but a live one whose
  // texel is fully clear must not draw a black square either.
  if (t.a < 0.01) discard;
  // BLOOD3 (Mac: "the blood is too shiny and flat"): THE MARK IS A
  // FILM. The atlas's alpha is a THICKNESS - its shapes fall off at
  // their rims because there is less blood there - and the albedo read
  // it as coverage alone, so every texel of a pool was the same red and
  // the mark was a coloured sticker. Beer-Lambert through the film
  // instead, anchored at the deep end (at thick = 1 the factor is 1, so
  // the colour a full mark already had does not move): blood absorbs
  // green and blue far harder than red, so a thinning rim brightens and
  // turns toward orange while the body stays a deep maroon. See
  // combat/bloodArt.js BLOOD_ABSORB / filmColour.
  //
  // THE THICKNESS IS COVERAGE TIMES DENSITY (bloodArt.js filmThickness).
  // Alpha alone cancels itself out - it is also what the mark is blended
  // by, so the thin rim the law brightens is the rim that is fading out,
  // and the solid middle has no variation left to read. The ink carries
  // the rest: the shape's shade and its grain, which vary ACROSS a mark
  // at full coverage and were being spent as a flat darkener.
  // AUDIT BLOOD3 F1: THE INK IS THE THICKNESS, INVERTED. The sheet
  // stores '1 - INK_DEPTH * thickness' (bloodArt.js), the range and the
  // sense the hand-painted shade always had, so the lens that draws the
  // same sheet through the plain 2D quad is untouched. Undo that one
  // line and the film has a real depth to run on - 0 at a rim, 1 at a
  // heart, the whole range ACROSS a mark at full coverage, which is
  // what BLOOD3 wanted and read backwards.
  float thick = t.a * clamp((1.0 - t.r) / ${glslFloat(INK_DEPTH)}, 0.0, 1.0);
  // ...and the ink is NOT an albedo factor any more. It was the shape's
  // depth painted as a grey darkening; the film is that same darkening
  // done properly, per channel, so multiplying by both spent it twice
  // in opposite directions. The tint is decoded on its own (BLOOD1
  // AUDIT 3: the curve is not linear, so a tinted mark would be the
  // wrong colour on this lane alone). AUDIT BLOOD3 F5: and a WET mark
  // is DARKER - the light goes into the film before it comes back.
  // That, not a highlight, is what reads as wet from above.
  vec3 albedo = elDecode(vColor.rgb)
    * exp(vec3(${glslFloat(BLOOD_ABSORB[0])}, ${glslFloat(BLOOD_ABSORB[1])}, ${glslFloat(BLOOD_ABSORB[2])}) * (1.0 - thick))
    * mix(1.0, ${glslFloat(WET_DARKEN)}, clamp(vWet, 0.0, 1.0));
  // the mark's own surface, from its own quad, facing the eye - and a
  // quad seen edge-on has no derivative to speak of, so it takes up
  // rather than NaN (BLOOD1 AUDIT 3)
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);   // AUDIT BLOOD3 F2: taken ONCE, out here - GLSL ES 3.0 leaves a derivative in non-uniform control flow undefined, and the meniscus below wanted these inside its branch
  vec3 c = cross(dpx, dpy);
  vec3 n = dot(c, c) > 1e-12 ? normalize(c) : vec3(0.0, 1.0, 0.0);
  if (dot(n, uCamPos - vWorld) < 0.0) n = -n;
  // BLOOD3: AND THE MARK IS A HEIGHT FIELD, NOT A PLANE. A mark lit by
  // one flat normal is lit the same at its edge as at its middle, which
  // is the other half of "flat". Its thickness IS a height, so the
  // gradient of that thickness is the surface's own slope, and the
  // normal tilts away from the rise wherever the blood stands deeper.
  //
  // AUDIT BLOOD3 F10: and it is the WHOLE mark, not a rim lip. This was
  // recorded as "a pool has a raised edge" until a picture was finally
  // made of it (BLOOD_MENISCUS on against off, under a grazing sun):
  // the change is TWICE as strong in the body as in the rim band, mean
  // 10.7 against 4.95 of 255, because a pool's thickness is a smoothstep
  // and a smoothstep's gradient peaks in the MIDDLE of its ramp. The
  // rim is one case of the relief, not the point of it. Two taps, one texel along each axis of the atlas; a cell
  // keeps a clear two-texel border and its UV rect is inset by one, so
  // a tap at the outer edge reads the border's zero - a thinning edge,
  // which is the truth - and never the neighbouring cell. The tangent
  // frame is the quad's own derivatives solved for d(world)/d(uv), so
  // the tilt is in the surface, whatever the mark is stuck to.
  // AUDIT BLOOD3 F1: and BOTH taps read the SAME field the centre does.
  // They used to read the bare alpha and subtract 't.a * t.r', which is
  // not a difference at all - it left a constant pedestal of
  // alpha * (1 - ink) over a mark's whole body, where the true gradient
  // is zero. That is a fixed tilt along one atlas diagonal on every
  // mark, several times the rim signal it was meant to measure, and it
  // fed the diffuse, the shadow lookup, the ambient and the Fresnel.
  vec2 ts = 1.0 / vec2(textureSize(uTex, 0));
  vec4 tU = texture(uTex, vUV + vec2(ts.x, 0.0));
  vec4 tV = texture(uTex, vUV + vec2(0.0, ts.y));
  vec2 duv = vec2(tU.a * clamp((1.0 - tU.r) / ${glslFloat(INK_DEPTH)}, 0.0, 1.0),
                  tV.a * clamp((1.0 - tV.r) / ${glslFloat(INK_DEPTH)}, 0.0, 1.0)) - vec2(thick);
  vec2 dux = dFdx(vUV), duy = dFdy(vUV);
  float uvDet = dux.x * duy.y - duy.x * dux.y;
  // AUDIT BLOOD3 F2: the WORLD frame is guarded too. dot(c, c) is the
  // same test line 616 already makes before it falls back to world up -
  // without it a quad whose world derivatives are parallel hands
  // normalize() a zero vector and throws that fallback away as NaN.
  if (dot(c, c) > 1e-12 && abs(uvDet) > 1e-12 && dot(duv, duv) > 0.0) {
    vec3 tu = (duy.y * dpx - dux.y * dpy) / uvDet;
    vec3 tv = (dux.x * dpy - duy.x * dpx) / uvDet;
    vec3 slope = duv.x * normalize(tu) + duv.y * normalize(tv);
    n = normalize(n - slope * ${glslFloat(BLOOD_MENISCUS)});
  }
  // BLOOD AUDIT 4: THE SURFACE'S TERMS, not the flat's. The normal was
  // read here since AUDIT 3 and spent on the shadow lookups alone; the
  // sun still came as the flat's Lambert-average half, and the lanterns
  // attenuation-only - so a mark on a sunlit floor and one on a shaded
  // wall were the same brightness while the surfaces under them were
  // not. The mark lies ON the mesh, so it takes MESH_FS's law: the sun
  // by N.L under the cloud and the sun map, the lanterns and the
  // indirect through elPointLit / elIndirectLit (N.L, the lantern's
  // map, the contact shadow, the glint - wet blood glints).
  float ndl = max(dot(n, uLightDir), 0.0);
  // BLOOD AUDIT 5: the sun's visibility ONCE - the cloud and the nine-tap
  // sun map - for the diffuse and the glint both; the moon by N.L and the
  // trilight ambient, as the mesh under the mark takes them.
  float sunVis = (dot(uDecalSun, uDecalSun) > 0.0 && ndl > 0.0) ? cloudShadowAt(vWorld) * sunShadowAt(vWorld, n) : 0.0;
  vec3 sunLit = uDecalSun * (ndl * sunVis);
  vec3 moonLit = uDecalMoon * max(dot(n, uMoonDir), 0.0);
  vec3 ambient = uTrilight > 0.5 ? (n.y >= 0.0 ? mix(uTint, uAmbientSky, n.y) : mix(uTint, uAmbientGround, -n.y)) : uTint;
  // BLOOD3: THE SHEEN IS THE DEPTH, AND THEN THE ANGLE. A mark does not
  // dry evenly - the thin rim goes first and the deep middle holds the
  // wet - so how much of a mark is wet at all is its wetness gated on
  // its own thickness. That is this number, and it carries no angle:
  // AUDIT BLOOD3 F5 moved the angle to where it belongs, beside each
  // light's own half-vector (wetFresnel). One gate for both glints.
  float sheen = vWet * smoothstep(${glslFloat(WET_THICK_LO)}, ${glslFloat(WET_THICK_HI)}, thick);
  vec3 glint;
  vec3 lit = albedo * (ambient + sunLit + moonLit + elPointLitWet(vWorld, n, sheen, glint) + elIndirectLit(vWorld, n));
  // BLOOD2f: THE WET SHEEN. A fresh mark is wet, and wet is a glint: the
  // lamp seen in it, and the sun - Blinn-Phong at the wet gloss, on top
  // of the lit blood (a highlight is the light's colour, not the
  // surface's), scaled by the mark's own wetness, which the dry pass
  // takes away stage by stage. A dry mark is exactly the line above.
  vec3 sunGlint = vec3(0.0);
  if (sheen > 0.0) {
    vec3 V = normalize(uCamPos - vWorld);
    vec3 H = normalize(uLightDir + V);
    sunGlint = uDecalSun * (pow(max(dot(n, H), 0.0), ${EL_WET_GLOSS}.0) * ${glslFloat(EL_WET_STRENGTH)} * sheen * wetFresnel(dot(V, H)) * sunVis);
  }
  lit += glint + sunGlint;
  outColor = vec4(elFinish(lit, vWorld), t.a * vColor.a);
}`;

/** The terrain fragment shader of the lane - the classic TERRAIN_FS's
 *  tilemap read and rotation table, lit on the lane's pipeline. */
export const EL_TERRAIN_FS = `#version 300 es
precision highp float;
precision highp usampler2D;
precision highp sampler2DArray;
in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vLocalXZ;
uniform sampler2DArray uTileArr;
uniform usampler2D uTilemap;
uniform float uTileSize;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform int uPointCount;
uniform vec4 uPointLights[${EL_MAX_LIGHTS}];
uniform vec3 uPointColors[${EL_MAX_LIGHTS}];
uniform vec4 uIndirect;
uniform vec3 uIndirectColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${CLOUD_SHADOW_GLSL}
${EL_GLSL}
${SHADOW_GLSL}
${AIR_CONTACT_GLSL}
${EL_FOG_GLSL}
${EL_POINT_LIT_GLSL}
out vec4 outColor;
const mat2 ROT[4] = mat2[4](
  mat2(1.0, 0.0, 0.0, 1.0),
  mat2(0.0, -1.0, 1.0, 0.0),
  mat2(-1.0, 0.0, 0.0, -1.0),
  mat2(0.0, 1.0, -1.0, 0.0));
const vec2 TRANS[4] = vec2[4](
  vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, 0.0));
void main() {
  vec2 unwrapped = vLocalXZ / uTileSize;
  ivec2 cell = clamp(ivec2(floor(unwrapped)), ivec2(0), ivec2(127));
  uint data = texelFetch(uTilemap, cell, 0).r;
  int layer = int(data >> 2u);
  int t = int(data & 3u);
  vec2 tileUV = fract(unwrapped);
  vec2 tuv = ROT[t] * tileUV + TRANS[t];
  // GRAIN1 (2026-09-19, Mac: "distance terrian has a weird grain look"):
  // THE TILE ARRAY IS MIPMAPPED, AND THE GRADIENT IS THE UNWRAPPED ONE.
  //
  // The grain is minification aliasing: past a few tiles out a screen
  // pixel covers many texels and NEAREST picks one of them, so the ground
  // boils as the camera moves. The cure is a mipmap - and the reason
  // there was none is right here. tileUV is fract(unwrapped), so it
  // jumps 1 -> 0 at every tile edge, and texture() picks its mip from
  // the screen-space derivative of the coordinate it is handed: at each
  // of those jumps the derivative is a whole tile wide, the hardware
  // reads that as "this pixel covers the entire texture", and it samples
  // the coarsest mip. That is a blurred line drawn around all 16,384
  // tiles of every pixel - far worse than the grain.
  //
  // unwrapped does not jump. Its derivative is the true footprint, and
  // ROT[t] is constant across the fragment, so rotating it gives the
  // footprint in the rotated tile's own frame. textureGrad takes that
  // directly and the seams cannot happen. One sample either way.
  vec2 gx = ROT[t] * dFdx(unwrapped);
  vec2 gy = ROT[t] * dFdy(unwrapped);
  vec3 tex = elDecode(textureGrad(uTileArr, vec3(tuv, float(layer)), gx, gy).rgb);
  vec3 n = normalize(vNormal);
  // PERF-SUN2 (2026-09-19, Mac: "over 1000 calls and looking up in the sky
  // restores frame rate"): THE SUN'S SHADOW IS NOT READ WHERE THE SUN
  // CANNOT REACH. This was one flat product, and GLSL evaluates every
  // operand of one: a surface whose normal faces AWAY from the sun paid
  // nine hardware-PCF compares and a cloud-deck sample, and then
  // multiplied them by the zero sitting in front of them. Every
  // north-facing wall, every back slope, and the whole world whenever the
  // sun is low. The uSunScale half is a UNIFORM branch, so it is free
  // and it takes out dusk and dawn as well, where the map is still drawn
  // but the sun contributes nothing; diff reaches the light exactly
  // once, as uSunColor * (uSunScale * diff), so gating it on either is
  // output-identical rather than an approximation.
  float ndl = max(dot(n, uLightDir), 0.0);
  float diff = (uSunScale > 0.0 && ndl > 0.0) ? ndl * cloudShadowAt(vWorldPos) * sunShadowAt(vWorldPos, n) : 0.0;   // EL2: the sun map
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = tex * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff)
    + elPointLit(vWorldPos, n) + elIndirectLit(vWorldPos, n));   // EL3: the ambient under the AO image
  outColor = vec4(elFinish(lit, vWorldPos), 1.0);
}`;

/** The character fragment shader of the lane - the classic CHAR_FS's
 *  vertex colour x texel, lit on the lane's pipeline (the rig's vertex
 *  colours are display values like the texels, and decode the same way). */
export const EL_CHAR_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uUseTex;
uniform float uAlphaCut;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform int uPointCount;
uniform vec4 uPointLights[${EL_MAX_LIGHTS}];
uniform vec3 uPointColors[${EL_MAX_LIGHTS}];
uniform vec4 uIndirect;
uniform vec3 uIndirectColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${CLOUD_SHADOW_GLSL}
${EL_GLSL}
${SHADOW_GLSL}
${AIR_CONTACT_GLSL}
${EL_FOG_GLSL}
${EL_POINT_LIT_GLSL}
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  vec4 texel = uUseTex > 0.5 ? texture(uTex, vUV) : vec4(1.0);
  if (uAlphaCut > 0.0 && texel.a < uAlphaCut) discard;
  vec3 albedo = elDecode(vColor * texel.rgb);
  // PERF-SUN2 (2026-09-19, Mac: "over 1000 calls and looking up in the sky
  // restores frame rate"): THE SUN'S SHADOW IS NOT READ WHERE THE SUN
  // CANNOT REACH. This was one flat product, and GLSL evaluates every
  // operand of one: a surface whose normal faces AWAY from the sun paid
  // nine hardware-PCF compares and a cloud-deck sample, and then
  // multiplied them by the zero sitting in front of them. Every
  // north-facing wall, every back slope, and the whole world whenever the
  // sun is low. The uSunScale half is a UNIFORM branch, so it is free
  // and it takes out dusk and dawn as well, where the map is still drawn
  // but the sun contributes nothing; diff reaches the light exactly
  // once, as uSunColor * (uSunScale * diff), so gating it on either is
  // output-identical rather than an approximation.
  float ndl = max(dot(n, uLightDir), 0.0);
  float diff = (uSunScale > 0.0 && ndl > 0.0) ? ndl * cloudShadowAt(vWorldPos) * sunShadowAt(vWorldPos, n) : 0.0;   // EL2: the sun map
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = albedo * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff)
    + elPointLit(vWorldPos, n) + elIndirectLit(vWorldPos, n));   // EL3
  outColor = vec4(elFinish(lit, vWorldPos), 1.0);
}`;


/** The far ring's fragment shader of the lane (render/farRing.js: the
 *  province's mountains on the horizon, lit by the sun and moon alone,
 *  faded into the sky by the world fog's own ramp). Without this the
 *  ring stood at the classic lane's brightness a few pixels past where
 *  the streamed ground stopped at the lane's - a step the fog does not
 *  always hide. The ring's vertex colours are display values like a
 *  texel, and decode the same way. */
export const EL_FAR_RING_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in float vDist;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uRimStart;
uniform float uRimEnd;
uniform float uHazeHold;
${EL_GLSL}
out vec4 outColor;
void main() {
  gl_FragDepth = 1.0;
  float ex = uELExposure * elAdapt();   // EL4
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = elDecode(vColor) * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff));
  float base = uHazeHold * clamp((vDist - uFogStart) / max(uFogEnd - uFogStart, 1.0), 0.0, 1.0);
  float rim = (1.0 - uHazeHold) * smoothstep(uRimStart, uRimEnd, vDist);
  vec3 col = mix(elTonemapRGB(lit * ex), elDecode(uFogColor), min(base + rim, 1.0));   // HQ1
  outColor = vec4(elEncode(col) + (bayer4(gl_FragCoord.xy) - ${BAYER_MEAN}) / 255.0, 1.0);   // EL6: the ring's sky gradient, dithered at the byte
}`;

/** THE LANE the renderer installs (Renderer.setLightingLane): the five
 *  fragment shaders (MAC-BUG W6: the decal's), the light cap, the colour decode, and the lane's
 *  own uniforms' values. One frozen object, so a renderer can tell "the
 *  same lane again" by identity and keep its compiled programs. */
export const EL_LANE = Object.freeze({
  key: 'enhanced-lighting',
  meshFs: EL_MESH_FS,
  bbFs: EL_BB_FS,
  terrainFs: EL_TERRAIN_FS,
  charFs: EL_CHAR_FS,
  decalFs: EL_DECAL_FS,   // MAC-BUG W6: the blood marks' twin - without it a lane lights its marks on the classic program, which is the bug
  farRingFs: EL_FAR_RING_FS,
  shadows: true,   // EL2: the renderer builds its ShadowPass for this lane
  air: true,       // EL3: and its AirPass, behind `?air=off` (syncLightingLane reads the door)
  maxLights: EL_MAX_LIGHTS,
  decode3: elDecode3,
  decodeN: elDecodeN,
  scatterDensity: elScatterDensity,
  scatter: EL_SCATTER,
  tonemapGlsl: EL_TONEMAP_GLSL, scatterGlsl: EL_SCATTER_GLSL,   // VOL1: the air pass's glow tonemaps and integrates as the lane does, without importing it (it is a leaf)
});

/** THE HOST'S ONE CALL, at mount (the sky's pattern: a flip of the pref
 *  takes effect when the world next loads): install the lane on the
 *  renderer when the switch is on, the classic set when it is not. Returns
 *  whether the lane is on, which the host uses to pick its flame colour. */
export function syncLightingLane(renderer, search = globalThis.location?.search ?? '') {
  const on = enhancedLightingOn(search);
  renderer.setLightingLane(on ? EL_LANE : null);
  if (on) { renderer.setExposure(exposureFor(search)); renderer.setAir(airOn(search)); renderer.setContact?.(contactOn(search)); renderer.setClusters?.(clustersOn(search)); renderer.setShadowCache?.(shadowCacheOn(search)); renderer.setVolumetrics?.(volumetricsOn(search)); renderer.setHaze?.(hazeOn(search)); }   // EL3: the door is the page's, read here alone; EL8: the contact door too; LC1: the grid's; SC1: the cache's; VOL1: the glow's
  return on;
}

/** EL4: a dungeon host's ambient under the lane - scaled to the dark - and
 *  the host's own otherwise. `tri` is Better Ambience's { sky, equator,
 *  ground } or null. */
export function dungeonAmbient(on, rgb) {
  if (!on) return rgb;
  return new Float32Array([rgb[0] * EL_DUNGEON_AMBIENT_SCALE, rgb[1] * EL_DUNGEON_AMBIENT_SCALE, rgb[2] * EL_DUNGEON_AMBIENT_SCALE]);
}
/** AUDIT-EL F6: a dungeon's FOG colour goes down with its ambient - Better
 *  Ambience's fog colour is the colour its trilight is lerped toward, so a
 *  scaled ambient under an unscaled fog put the far end of a hall BRIGHTER
 *  than its near walls. The underwater override is not this one's. */
export function dungeonFog(on, fog) {
  if (!on || !fog?.color) return fog;
  const c = fog.color;
  return { ...fog, color: [c[0] * EL_DUNGEON_AMBIENT_SCALE, c[1] * EL_DUNGEON_AMBIENT_SCALE, c[2] * EL_DUNGEON_AMBIENT_SCALE] };
}
export function dungeonTrilight(on, tri) {
  if (!on || !tri) return tri;
  const k = (c) => [c[0] * EL_DUNGEON_AMBIENT_SCALE, c[1] * EL_DUNGEON_AMBIENT_SCALE, c[2] * EL_DUNGEON_AMBIENT_SCALE];
  return { sky: k(tri.sky), equator: k(tri.equator), ground: k(tri.ground) };
}

/** The colour a host hands its white lanterns under the lane - the flame
 *  at the host's own intensity (the classic grey's green channel: the
 *  city's 1, the dungeon's 0.8) - and the grey it always handed them
 *  otherwise, the same object. */
export function lanternColor(on, classic) {
  if (!on) return classic;
  const k = classic[1];
  return new Float32Array([EL_FLAME_COLOR[0] * k, EL_FLAME_COLOR[1] * k, EL_FLAME_COLOR[2] * k]);
}
