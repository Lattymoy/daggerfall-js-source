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
// TWO PROFILES ARE TWO PROGRAMS (precipitation.js's doctrine): the four
// fragment shaders here REPLACE the renderer's mesh, billboard, terrain
// and character fragment shaders when the lane is installed
// (Renderer.setLightingLane), under the SAME uniform names the renderer
// already uploads plus this lane's own (uELExposure, uELScatter). The
// classic lane never compiles them; a shader fault is still a boot fault
// the probe sees, at the host's mount. Nothing in the classic shaders
// changes.
//
// The pure functions below are the shader's terms in JS, term for term,
// so a test can pin the arithmetic the GPU runs without a GPU.

import { getPref } from '../systems/uiPrefs.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { SHADOW_GLSL, SHADOW_CASTER_MIN_DISTANCE } from './shadowPass.js';   // EL2: the receiver block - the sun map on the sun term, the cube map on its lantern; F3: the hand's distance
import { AIR_ADAPT_GLSL, AIR_CONTACT_GLSL, AIR_CONTACT_RANGE_FRACTION, airOn, contactOn, glslFloat } from './airPass.js';   // EL6: no AO block - the resolve's; EL8: the contact block
import { BAYER_GLSL, BAYER_MEAN } from './orderedDither.js';   // EL6: the dither at the encode - the port's one Bayer
import { SHADE_DARK } from '../systems/concealDraw.js';   // AUDIT-EL F14: the shade's pull toward black, interpolated as the classic BB_FS does   // EL3: the ambient occlusion image by screen position, and its kill door; EL4: the adapted exposure

/** The lane's light cap - the classic lane's sixteen, tripled. Forty-eight
 *  vec4 + forty-eight vec3 are 96 uniform vectors; ES 3.0 guarantees 224
 *  for a fragment shader. */
export const EL_MAX_LIGHTS = 48;
/** The classic lane's cap, restated here so the renderer's cap is one of
 *  two named numbers and never a literal. */
export const EL_CLASSIC_MAX_LIGHTS = 16;
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
/** The near-field gain and the falloff's knee (elAttenuation). */
export const EL_LIGHT_GAIN = 2;
export const EL_LIGHT_KNEE = 16;
/** EL4: the lanterns' glint - Blinn-Phong gloss and strength, on the mesh,
 *  terrain and character shaders (a flat has no normal). */
export const EL_SPEC_GLOSS = 24;
export const EL_SPEC_STRENGTH = 0.12;
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
 *  ~0.05, W maps to 1.0, above W clips. Per channel. */
export function elTonemap(x, white = EL_WHITE) {
  if (!(x > 0)) return 0;
  return x * (1 + x / (white * white)) / (1 + x);
}

/** The single-scattering integral of a point light along a view ray:
 *  the eye at the origin looking down unit `dir` to a surface `dist`
 *  away, the light at `light` (relative to the eye) with `range`. The
 *  in-scattered radiance of a uniform medium with `density` is
 *  density * (atan((t1 - t0) / h) - atan((ta - t0) / h)) / h, where t0
 *  is the light's foot on the ray, h its distance off the ray, and
 *  [ta, t1] is the ray clipped to [0, dist] and to the light's range
 *  about t0 - so the medium beyond the light's reach contributes
 *  nothing. The GLSL in EL_GLSL is this, term for term. */
export function elScatter(light, range, dir, dist, density) {
  if (!(range > 0) || !(density > 0) || !(dist > 0)) return 0;
  const t0 = light[0] * dir[0] + light[1] * dir[1] + light[2] * dir[2];
  const hx = light[0] - dir[0] * t0, hy = light[1] - dir[1] * t0, hz = light[2] - dir[2] * t0;
  const h = Math.max(Math.sqrt(hx * hx + hy * hy + hz * hz), 0.25);
  const ta = Math.max(0, t0 - range), tb = Math.min(dist, t0 + range);
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
export const EL_GLSL = `
uniform float uELExposure;   // EL1: scene exposure before the tonemap
uniform float uELScatter;    // EL1: in-scatter gain x the fog's density (0 = no fog, no glow)
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
vec3 elTonemap(vec3 x) {
  return x * (1.0 + x / ${EL_WHITE}.0 / ${EL_WHITE}.0) / (1.0 + x);
}
// the single-scattering integral (elScatter in enhancedLighting.js), for
// one light at L (relative to the eye) along the unit ray dir to dist
float elScatter(vec3 L, float range, vec3 dir, float dist) {
  float t0 = dot(L, dir);
  float h = max(length(L - dir * t0), 0.25);
  float ta = max(0.0, t0 - range), tb = min(dist, t0 + range);
  if (tb <= ta) return 0.0;
  return (atan((tb - t0) / h) - atan((ta - t0) / h)) / h;
}
`;

const EL_FOG_GLSL = `
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }
  return exp(-uFogDensity * d);
}
`;

// The lantern loop and the in-scatter loop, shared by the three lit
// programs. `n` is the surface normal (the billboard passes none and
// takes the attenuation alone - it has no normal, as in the classic lane).
const EL_POINT_LIT_GLSL = `
vec3 elPointLit(vec3 wp, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${EL_MAX_LIGHTS}; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - wp;
    float d = length(L);
    if (d >= uPointLights[i].w) continue;   // EL5: outside the window the term is exactly zero - no shadow taps, no glint, no pow for it
    vec3 Ln = L / max(d, 1e-4);
    int k = uCasterOf[i];   // EL8: the light's caster slot in one lookup
    // EL2: the lantern's map; EL8: every other lantern a contact shadow off the previous frame's depth;
    // F3: never for the light in the hand (the torch, a hand's width from every corner - shadowPass's SHADOW_CASTER_MIN_DISTANCE, the same law that keeps it out of the caster slots);
    // F5: and only within the share of the range where the light is worth a shadow
    float sh = k >= 0 ? pointShadowAt(k, wp, n)
      : (k == -2 || d > uPointLights[i].w * ${glslFloat(AIR_CONTACT_RANGE_FRACTION)} || length(uPointLights[i].xyz - uCamPos) < ${glslFloat(SHADOW_CASTER_MIN_DISTANCE)}) ? 1.0   // MAC-T1: -2 is the hand's light, by name
      : contactShadow(wp, n, Ln, d);
    // EL4: a glint - Blinn-Phong, a low gloss for stone and wood, a twelfth of the light: wet stone under a torch
    vec3 H = normalize(Ln + normalize(uCamPos - wp));
    float spec = pow(max(dot(n, H), 0.0), ${EL_SPEC_GLOSS}.0) * ${EL_SPEC_STRENGTH};
    acc += sh * elAttenuation(d, uPointLights[i].w) * (max(dot(n, Ln), 0.0) + spec) * uPointColors[i];
  }
  return acc;
}
// a flat's lantern term, attenuation only; its shadow is read at the
// flat's base (one value for the whole sprite - a sprite in its own map
// would shadow itself)
vec3 elPointFlat(vec3 wp, vec3 base) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${EL_MAX_LIGHTS}; i++) {
    if (i >= uPointCount) break;
    float d = length(uPointLights[i].xyz - wp);
    if (d >= uPointLights[i].w) continue;   // EL5
    float sh = shadowOfLight(i, base, vec3(0.0, 1.0, 0.0));   // EL2; EL5: any caster's
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
  vec3 tm = elTonemap(lit * ex);
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
  col += elTonemap(elInScatter(wp) * ex);
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
uniform sampler2D uCloudShadowMap;
uniform vec4 uCloudShadowRect;
float cloudShadowAt(vec3 wp) {
  if (uCloudShadowRect.w <= 0.0) return 1.0;
  vec2 uv = (wp.xz - uCloudShadowRect.xy) * uCloudShadowRect.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  return 1.0 - (1.0 - texture(uCloudShadowMap, uv).r) * uCloudShadowRect.w;
}
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
uniform sampler2D uCloudShadowMap;
uniform vec4 uCloudShadowRect;
float cloudShadowAt(vec3 wp) {
  if (uCloudShadowRect.w <= 0.0) return 1.0;
  vec2 uv = (wp.xz - uCloudShadowRect.xy) * uCloudShadowRect.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  return 1.0 - (1.0 - texture(uCloudShadowMap, uv).r) * uCloudShadowRect.w;
}
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
uniform sampler2D uCloudShadowMap;
uniform vec4 uCloudShadowRect;
float cloudShadowAt(vec3 wp) {
  if (uCloudShadowRect.w <= 0.0) return 1.0;
  vec2 uv = (wp.xz - uCloudShadowRect.xy) * uCloudShadowRect.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  return 1.0 - (1.0 - texture(uCloudShadowMap, uv).r) * uCloudShadowRect.w;
}
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
uniform sampler2D uCloudShadowMap;
uniform vec4 uCloudShadowRect;
float cloudShadowAt(vec3 wp) {
  if (uCloudShadowRect.w <= 0.0) return 1.0;
  vec2 uv = (wp.xz - uCloudShadowRect.xy) * uCloudShadowRect.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  return 1.0 - (1.0 - texture(uCloudShadowMap, uv).r) * uCloudShadowRect.w;
}
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
  vec3 col = mix(elTonemap(lit * ex), elDecode(uFogColor), min(base + rim, 1.0));
  outColor = vec4(elEncode(col) + (bayer4(gl_FragCoord.xy) - ${BAYER_MEAN}) / 255.0, 1.0);   // EL6: the ring's sky gradient, dithered at the byte
}`;

/** THE LANE the renderer installs (Renderer.setLightingLane): the four
 *  fragment shaders, the light cap, the colour decode, and the lane's
 *  own uniforms' values. One frozen object, so a renderer can tell "the
 *  same lane again" by identity and keep its compiled programs. */
export const EL_LANE = Object.freeze({
  key: 'enhanced-lighting',
  meshFs: EL_MESH_FS,
  bbFs: EL_BB_FS,
  terrainFs: EL_TERRAIN_FS,
  charFs: EL_CHAR_FS,
  farRingFs: EL_FAR_RING_FS,
  shadows: true,   // EL2: the renderer builds its ShadowPass for this lane
  air: true,       // EL3: and its AirPass, behind `?air=off` (syncLightingLane reads the door)
  maxLights: EL_MAX_LIGHTS,
  decode3: elDecode3,
  decodeN: elDecodeN,
  scatterDensity: elScatterDensity,
  scatter: EL_SCATTER,
});

/** THE HOST'S ONE CALL, at mount (the sky's pattern: a flip of the pref
 *  takes effect when the world next loads): install the lane on the
 *  renderer when the switch is on, the classic set when it is not. Returns
 *  whether the lane is on, which the host uses to pick its flame colour. */
export function syncLightingLane(renderer, search = globalThis.location?.search ?? '') {
  const on = enhancedLightingOn(search);
  renderer.setLightingLane(on ? EL_LANE : null);
  if (on) { renderer.setExposure(exposureFor(search)); renderer.setAir(airOn(search)); renderer.setContact?.(contactOn(search)); }   // EL3: the door is the page's, read here alone; EL8: the contact door too
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
