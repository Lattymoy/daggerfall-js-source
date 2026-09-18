// @ts-check
// EL3 (2026-09-17, the Enhanced Lighting arc, tier three - DEPTH AND AIR).
//
// WHAT THIS IS. Three screen-space effects the lane adds on top of EL1's
// light and EL2's shadows, all fed by ONE depth: THE FRAME'S OWN (EL6 -
// before it, a depth image was drawn at the top of the frame by replaying
// the shadow pass's records from the camera: a third walk of the town per
// frame, one frame stale, and the emitters that bloomed off it were never
// tested against it). The images are drawn at the RESOLVE, once the world
// pass has written the frame's depth (a texture on the frame's
// framebuffer):
//
//   1. AMBIENT OCCLUSION (SSAO at half resolution): a hemisphere of
//      twelve samples about the surface normal reconstructed from the
//      depth, each projected back and tested against it, range-checked,
//      rotated per pixel by a 4x4 ORDERED pattern (EL6: a hash was grain
//      that the blur never cancelled - in the dark the grain was all a
//      texture had), then a 4x4 box blur that averages exactly one tile.
//      The RESOLVE multiplies the decoded frame by it over the world rect
//      (AIR_AO_RESOLVE of it) - EL6: the world shaders read no AO at all,
//      which is one texture fetch fewer per fragment and no sampler unit
//      to keep bound (AUDIT-EL F2/F12's cases cannot recur).
//   2. BLOOM (quarter resolution): sourced from what actually emits -
//      every window's emission map and every self-lit record (THIS frame's
//      records replayed with an emission-only program, each fragment
//      discarding when the frame's depth holds a nearer surface - EL6:
//      "all lighting sources can be seen through walls" was the emitters
//      drawing with no depth test), and a glare sprite at each lantern,
//      sized by its range, faded by the depth in world units (EL5) - then
//      a separable 9-tap gaussian, twice, added over the frame.
//   3. LIGHT SHAFTS (quarter resolution, outdoors): the sky's mask (depth
//      at the far plane) weighted toward the sun's screen position, radially
//      blurred toward it with decay - the classic screen-space god rays -
//      in the sun's colour, added over the frame when the sun is in front
//      of the camera.
//
// WHERE IT LANDS. The bloom and the shafts are composited with additive
// blending by the first screen-space draw of the frame (drawScreenQuad,
// which is where the 2D pass begins and the world pass has ended for every
// host, foreign passes included) over the world viewport.
//
// EL4 (same day, Mac: "Polished and exceptional detail. Proper darker
// dungeons. The goal isn't a half visioned system"): THE FRAME. EL3 had
// recorded a departure - the world stayed on the canvas because "six
// foreign passes restore bindFramebuffer(null)". The survey that followed
// found TWO restore sites in the tree (render/renderTarget.js's withTarget
// and finishVolume, and the clouds' blit), and both now restore the FRAME
// TARGET (renderTarget.js setFrameTarget). So:
//
//   4. THE FRAME IMAGE: with the lane on, the whole world - the renderer's
//      passes and every foreign pass alike - draws into a canvas-sized
//      image with its own depth, bound at beginFrame. The frame's first
//      screen-space draw RESOLVES it to the canvas: the frame decoded to
//      linear, the bloom and the shafts added, a vignette over the world
//      rect, a touch of contrast about mid-grey, encoded once.
//   5. EYE ADAPTATION: the resolve measures the frame's mean log
//      luminance over the world rect (a 32x32 image and its mip chain), and
//      a 1x1 image carries the adapted exposure multiplier - eased toward
//      key / luminance each frame, fast when the eye closes (into light),
//      slow when it opens (into dark), clamped to [AIR_ADAPT_MIN,
//      AIR_ADAPT_MAX]. The lane's shaders and the far ring multiply their
//      exposure by it (uAdapt, unit 11) - which is why a walk from noon
//      into a dungeon goes near-black and opens over seconds, and why the
//      dungeon stays dark once it has: the multiplier's ceiling is the
//      floor of the dark.
//   6. BLOOM FROM THE FRAME: the bright pass of the decoded frame (above
//      AIR_BRIGHT_THRESHOLD) joins the emitters and the glares in the
//      bloom source before the blur, so a sunlit wall and a flame both
//      glow, not only what carries an emission map.
//
// The frame is 8-bit and display-encoded: the lane's forward tonemap keeps
// the headroom (a torch's near field still blooms to white inside EL1's
// shoulder), and the foreign passes keep writing the display values they
// always wrote - a float frame would need every one of their shaders to
// output linear, which is the one thing this pass does not touch. EL6:
// both encodes (the lane's, the resolve's) are DITHERED at the byte
// (orderedDither.js's bayer4, zero-mean) - a lantern's falloff on a dark floor was bands.
//
// This module imports nothing of the renderer or the lane; the renderer
// hands it its own vertex shaders and its program builder, as the shadow
// pass takes them.

import { multiply } from '../world/mat4.js';
import { setFrameTarget } from './renderTarget.js';
import { BAYER_GLSL, BAYER_MEAN } from './orderedDither.js';   // EL6: the port's one Bayer - the dither at the byte, the AO's rotation
import { spherePlanes, recordVisible, subMeshVisible, batchVisible } from './bounds.js';   // EL5: the emission replay culls by the records' spheres too (a leaf's import: bounds.js touches no GL)

/** The kill door: `?air=off` keeps EL1 and EL2 and drops the three effects. */
export function airOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('air') !== 'off';
}
/** EL8: the contact shadows' door - `?contact=off` (the air's shape). */
export function contactOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('contact') !== 'off';
}

/** The AO image's scale of the world viewport, and the bloom's and shafts'. */
export const AIR_AO_SCALE = 0.5;
export const AIR_BLOOM_SCALE = 0.25;
/** The hemisphere's radius in world units (a door is ~2 tall), the sample
 *  count, the strength (1 = a fully occluded crevice loses all ambient),
 *  and the depth bias against self-occlusion. */
export const AIR_AO_RADIUS = 0.8;
export const AIR_AO_SAMPLES = 12;
export const AIR_AO_STRENGTH = 1.0;
export const AIR_AO_BIAS = 0.02;
/** EL6: how much of the AO the resolve applies to the whole frame (the
 *  occlusion is read off the frame's own depth now, at the resolve, and
 *  multiplies the lit result - not the ambient alone in the world shaders). */
export const AIR_AO_RESOLVE = 0.75;
/** EL6: an emitter's own slack against the frame's depth, world units - it
 *  is IN the depth image (the same draw), so its own texel passes; a wall in
 *  front of it does not. */
export const AIR_EMIT_SLACK = 0.15;
/** The bloom's gain on the composite, and the glare sprite's size per
 *  square root of a lantern's range (range 18 -> ~1.5 units). */
export const AIR_BLOOM_STRENGTH = 0.6;
export const AIR_GLARE_SIZE = 0.25;   // EL7: a glare the size of a flame, not a ball (0.35 was a unit and a half across at a lantern's range)
/** EL5: the world-unit slack of a glare's occlusion test; EL7: it is a
 *  PRESENCE test now - the frame's depth must hold a surface within this of
 *  the light (the flame flat under it), else there is no glare: a light
 *  floating in air (the torch in the player's hand, the Light spell's
 *  candle, a lantern placed above its flat) drew a bright ball "not
 *  connected to the source". */
export const AIR_GLARE_SLACK = 0.25;   // F4 (2026-09-17, Mac: "bloom circle disconnected from light sources and still reports of light bloom balls appearing behind floors/ceilings"): a QUARTER unit, either side. At a unit the band took a ceiling 0.4 in front of a hanging lantern and a wall 0.5 behind a bare light for "a flame" - the ball through the floor above, the ball beside a light with no flat. A flame flat is a camera-facing quad THROUGH the light, so its opaque texels sit at the light's own planar depth: a quarter unit holds the flat and nothing else
/** EL7: no glare for a light this close to the eye - the carried torch and the candle. */
export const AIR_GLARE_MIN_DISTANCE = 1.5;
/** EL8: SCREEN-SPACE CONTACT SHADOWS - for every lantern that has no caster
 *  slot (the forty-two past the six), a march from the fragment toward the
 *  light through the PREVIOUS frame's depth, reprojected by the previous
 *  frame's view-projection (the current frame's depth is being written
 *  while the world pass reads - a frame old and reprojected is the depth a
 *  forward renderer can have): the length in world units, the thickness a
 *  ray may pass behind a surface and still count it an occluder, the steps,
 *  and the floor a contact shadow darkens to (an approximation is not
 *  black). The reserved unit is the AO's old one. */
export const AIR_CONTACT_LENGTH = 0.6;
export const AIR_CONTACT_THICKNESS = 0.8;
export const AIR_CONTACT_STEPS = 4;   // F5: four over 0.6 units is a step every 15 cm under a thickness of 80 - the contact it finds, six found
export const AIR_CONTACT_FLOOR = 0.15;
export const AIR_CONTACT_UNIT = 12;
/** F5: the march runs only for a light within this share of its range of
 *  the fragment - past it the windowed falloff has the light under a tenth
 *  and a contact shadow on it is invisible; a town's forty lanterns each
 *  reached every fragment in their window with four depth taps. */
export const AIR_CONTACT_RANGE_FRACTION = 0.7;
/** EL7: a JS number as a GLSL float literal. `${1.0}` is "1" - an int to the
 *  compiler, and "'<=' : wrong operand types" on a real GPU (the probe's
 *  catch; the fake GL compiles anything). Every whole-number constant that
 *  reaches a shader goes through here. */
export const glslFloat = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
/** AUDIT-EL F11: a light with a range past this is the storm's flash (Dynamic
 *  Skies: 500..1000), not a lantern, and gets no glare. */
export const AIR_GLARE_MAX_RANGE = 120;
/** The shafts: taps along the ray, the per-tap decay, the gain, the
 *  angular reach of the sun's mask (in the shaft image's UV). */
export const AIR_SHAFT_TAPS = 32;
export const AIR_SHAFT_DECAY = 0.96;
export const AIR_SHAFT_STRENGTH = 0.35;
export const AIR_SHAFT_REACH = 0.35;
/** EL4: the adapted-exposure image's unit, below the AO's. */
export const AIR_ADAPT_UNIT = 11;
/** EL4: the luminance image's side (its mip chain's top is the mean). */
export const AIR_LUM_SIZE = 32;
/** EL4: the adaptation - the mid-grey the eye aims the mean luminance at,
 *  the multiplier's floor and ceiling (the ceiling is what keeps a dark
 *  dungeon dark once the eye has opened), the rates per second toward a
 *  brighter multiplier (opening, into dark) and a dimmer one (closing,
 *  into light - the eye closes faster than it opens). */
export const AIR_ADAPT_KEY = 0.18;
export const AIR_ADAPT_MIN = 0.7;
export const AIR_ADAPT_MAX = 1.8;
export const AIR_ADAPT_OPEN = 0.6;
export const AIR_ADAPT_CLOSE = 3.0;
/** EL4: the 8-bit encodings - log2 luminance over [-12, 4] stops, log2
 *  multiplier over [-2, 2]. */
export const AIR_LUM_LOG_RANGE = Object.freeze([-12, 4]);
export const AIR_ADAPT_LOG_RANGE = Object.freeze([-2, 2]);
/** EL4: the bright pass's threshold on the decoded frame, the vignette's
 *  strength at the corners of the world rect, the contrast about mid-grey. */
export const AIR_BRIGHT_THRESHOLD = 0.85;
export const AIR_VIGNETTE = 0.28;
export const AIR_CONTRAST = 1.04;
/** EL4: the longest step the adaptation integrates (a hitch is not a second). */
export const AIR_ADAPT_MAX_DT = 0.1;

/** EL4: the 8-bit log encodings, JS of the shaders' - term for term. */
export function packLog(x, range) {
  const v = (Math.log2(Math.max(x, 1e-9)) - range[0]) / (range[1] - range[0]);
  return Math.min(Math.max(v, 0), 1);
}
export function unpackLog(v, range) {
  return Math.pow(2, range[0] + v * (range[1] - range[0]));
}
/** EL4: one adaptation step - the JS of ADAPT_FS. `prev` and the result are
 *  multipliers, `lum` the frame's mean luminance (linear), `dt` seconds. */
export function adaptStep(prev, lum, dt) {
  const target = Math.min(Math.max(AIR_ADAPT_KEY / Math.max(lum, 1e-6), AIR_ADAPT_MIN), AIR_ADAPT_MAX);
  const rate = target > prev ? AIR_ADAPT_OPEN : AIR_ADAPT_CLOSE;
  const t = 1 - Math.exp(-Math.min(Math.max(dt, 0), AIR_ADAPT_MAX_DT) * rate);
  return prev + (target - prev) * t;
}

/** The four numbers a shader needs to undo the renderer's perspective
 *  (world/mat4.js's `perspective`, mirrored or not): [0] and [5] the focal
 *  terms, [10] and [14] the depth terms. */
export function projInfo(proj, out = new Float32Array(4)) {
  out[0] = proj[0]; out[1] = proj[5]; out[2] = proj[10]; out[3] = proj[14];
  return out;
}

/** View-space depth (negative, the camera looks down -z) from an NDC depth
 *  z in [-1, 1] - the JS of the shader's reconstruction, term for term. */
export function viewDepth(zNdc, p10, p14) {
  return -p14 / (zNdc + p10);
}

/** The sun's position on screen as [u, v] in [0, 1] of the viewport, or
 *  null when it is behind the camera. `lightDir` is the direction TOWARD
 *  the sun; a directional light projects as a point at infinity (w = 0). */
export function sunScreenUV(proj, view, lightDir) {
  const vx = view[0] * lightDir[0] + view[4] * lightDir[1] + view[8] * lightDir[2];
  const vy = view[1] * lightDir[0] + view[5] * lightDir[1] + view[9] * lightDir[2];
  const vz = view[2] * lightDir[0] + view[6] * lightDir[1] + view[10] * lightDir[2];
  const cx = proj[0] * vx + proj[4] * vy + proj[8] * vz;
  const cy = proj[1] * vx + proj[5] * vy + proj[9] * vz;
  const cw = proj[3] * vx + proj[7] * vy + proj[11] * vz;
  if (!(cw > 1e-6)) return null;
  return [cx / cw * 0.5 + 0.5, cy / cw * 0.5 + 0.5];
}

/** The hemisphere kernel: n samples in the +z hemisphere, more of them
 *  near the origin (scale = lerp(0.1, 1, (i/n)^2)), from a fixed
 *  linear-congruential stream so every page draws the same noise. */
export function aoKernel(n = AIR_AO_SAMPLES) {
  const out = new Float32Array(n * 3);
  let seed = 0x2545F491;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd();
    const l = Math.hypot(x, y, z) || 1;
    x /= l; y /= l; z /= l;
    const t = i / n;
    const scale = (0.1 + 0.9 * t * t) * rnd();
    out[i * 3] = x * scale; out[i * 3 + 1] = y * scale; out[i * 3 + 2] = z * scale;
  }
  return out;
}

/** A lantern's glare sprite size, world units, from its range. */
export function glareSize(range) {
  return AIR_GLARE_SIZE * Math.sqrt(Math.max(range, 0));
}

/** EL6: THE DEPTH BLOCK, for every pass that reads the frame's depth: the
 *  texel's view distance and the sample at a world-rect uv (the frame is
 *  canvas-sized; the images are the world rect's). */
const DEPTH_GLSL = `
uniform sampler2D uDepth;
uniform vec4 uProjInfo;   // proj[0], proj[5], proj[10], proj[14]
uniform vec4 uRect;       // the world rect in canvas pixels
uniform vec2 uCanvas;
float viewDist(float d01) {
  float z = d01 * 2.0 - 1.0;
  return uProjInfo.w / (z + uProjInfo.z);   // -viewZ: positive, along the eye's -z
}
float depthAt(vec2 wuv) {
  return texture(uDepth, (uRect.xy + wuv * uRect.zw) / uCanvas).r;
}
`;



/** EL8: THE CONTACT BLOCK, for the lit lane shaders (a solid's, the terrain's,
 *  a rig's - not a flat's): light i without a caster slot takes a contact
 *  shadow off the previous frame's depth. `toLight` is the unit direction,
 *  `dist` the distance; the march covers min(dist, AIR_CONTACT_LENGTH). */
export const AIR_CONTACT_GLSL = `
uniform sampler2D uPrevDepth;
uniform mat4 uPrevVP;
uniform vec4 uPrevProjInfo;   // the previous frame's projection terms (viewDist)
uniform vec4 uContactParams;  // x length, y thickness, z floor, w 1 = on
float contactShadow(vec3 wp, vec3 n, vec3 toLight, float dist) {
  if (uContactParams.w <= 0.0) return 1.0;
  float len = min(dist, uContactParams.x);
  vec3 start = wp + n * 0.02;
  // F3: THE SURFACE MUST HAVE BEEN THERE. The march reads LAST frame's depth,
  // and a wall just revealed round a corner was not in it: its pixels
  // reproject onto the corner's near face, every sample lands "behind" it,
  // and the whole wall wore a shadow that swam with the turn. So the point
  // itself is reprojected first, and only a point the previous frame saw
  // where it stands - its depth there within the thickness - is marched.
  vec4 c0 = uPrevVP * vec4(start, 1.0);
  if (c0.w <= 0.0) return 1.0;
  vec2 uv0 = c0.xy / c0.w * 0.5 + 0.5;
  if (uv0.x < 0.0 || uv0.x > 1.0 || uv0.y < 0.0 || uv0.y > 1.0) return 1.0;
  float z0 = texture(uPrevDepth, uv0).r * 2.0 - 1.0;
  if (abs(c0.w - uPrevProjInfo.w / (z0 + uPrevProjInfo.z)) > uContactParams.y) return 1.0;
  for (int i = 1; i <= ${AIR_CONTACT_STEPS}; i++) {
    vec3 p = start + toLight * (len * float(i) / ${glslFloat(AIR_CONTACT_STEPS)});
    vec4 c = uPrevVP * vec4(p, 1.0);
    if (c.w <= 0.0) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float z = texture(uPrevDepth, uv).r * 2.0 - 1.0;
    float sceneDist = uPrevProjInfo.w / (z + uPrevProjInfo.z);
    float behind = c.w - sceneDist;   // c.w is the point's view distance under that projection
    if (behind > 0.02 && behind < uContactParams.y) return uContactParams.z;
  }
  return 1.0;
}
`;

/** EL4: THE ADAPTATION BLOCK, for every shader that exposes: the 1x1
 *  image's multiplier, decoded from its log encoding. */
export const AIR_ADAPT_GLSL = `
uniform sampler2D uAdapt;
float elAdapt() {
  return exp2(texture(uAdapt, vec2(0.5)).r * ${AIR_ADAPT_LOG_RANGE[1] - AIR_ADAPT_LOG_RANGE[0]}.0 + (${AIR_ADAPT_LOG_RANGE[0]}.0));
}
`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// the sRGB codec, the lane's (enhancedLighting.js elDecode / elEncode) restated - this module imports nothing of the lane
const CODEC_GLSL = `
vec3 airDecode(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(hi, lo, step(c, vec3(0.04045)));
}
vec3 airEncode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(hi, lo, step(c, vec3(0.0031308)));
}
`;

/** EL4: the frame's log luminance over the world rect, into the 32x32 image. */
const LUM_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uFrame;
uniform sampler2D uPrev;   // AUDIT-EL F16: the eye's own multiplier, divided out - the frame is the ADAPTED image
uniform vec4 uRect;     // the world rect in canvas pixels
uniform vec2 uCanvas;
${CODEC_GLSL}
out vec4 outColor;
void main() {
  // AUDIT-EL F16: sixteen taps over this texel's cell of the world rect, not
  // one - a torch crossing a single tap moved the mean a stop as the camera
  // panned; and the luminance is the SCENE's, the eye divided out, so the
  // step aims at the unadapted world and not at its own output
  float prev = exp2(texture(uPrev, vec2(0.5)).r * ${AIR_ADAPT_LOG_RANGE[1] - AIR_ADAPT_LOG_RANGE[0]}.0 + (${AIR_ADAPT_LOG_RANGE[0]}.0));
  vec2 cell = 1.0 / vec2(${AIR_LUM_SIZE}.0);
  float acc = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 t = vUV + (vec2(float(x), float(y)) + 0.5) * cell * 0.25 - cell * 0.5;
      vec2 uv = (uRect.xy + t * uRect.zw) / uCanvas;
      vec3 c = airDecode(texture(uFrame, uv).rgb);
      acc += log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)) / prev, 1e-9));
    }
  }
  float v = (acc / 16.0 - (${AIR_LUM_LOG_RANGE[0]}.0)) / ${AIR_LUM_LOG_RANGE[1] - AIR_LUM_LOG_RANGE[0]}.0;
  outColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}`;

/** EL4: one adaptation step (adaptStep, term for term) from the previous
 *  1x1 image and the luminance image's top mip. */
const ADAPT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uPrev;
uniform sampler2D uLum;
uniform vec4 uAdaptParams;   // dt, key, min, max
uniform vec2 uAdaptRates;    // open, close
out vec4 outColor;
void main() {
  float prev = exp2(texture(uPrev, vec2(0.5)).r * ${AIR_ADAPT_LOG_RANGE[1] - AIR_ADAPT_LOG_RANGE[0]}.0 + (${AIR_ADAPT_LOG_RANGE[0]}.0));
  float lv = textureLod(uLum, vec2(0.5), ${Math.log2(AIR_LUM_SIZE)}.0).r;
  float lum = exp2(lv * ${AIR_LUM_LOG_RANGE[1] - AIR_LUM_LOG_RANGE[0]}.0 + (${AIR_LUM_LOG_RANGE[0]}.0));
  float target = clamp(uAdaptParams.y / max(lum, 1e-6), uAdaptParams.z, uAdaptParams.w);
  float rate = target > prev ? uAdaptRates.x : uAdaptRates.y;
  float t = 1.0 - exp(-uAdaptParams.x * rate);
  float next = prev + (target - prev) * t;
  float v = (log2(next) - (${AIR_ADAPT_LOG_RANGE[0]}.0)) / ${AIR_ADAPT_LOG_RANGE[1] - AIR_ADAPT_LOG_RANGE[0]}.0;
  outColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}`;

/** EL4: the bright pass - what the decoded frame holds above the threshold, over the world rect. */
const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uFrame;
uniform vec4 uRect;
uniform vec2 uCanvas;
uniform float uThreshold;
${CODEC_GLSL}
out vec4 outColor;
void main() {
  vec2 uv = (uRect.xy + vUV * uRect.zw) / uCanvas;
  vec3 c = airDecode(texture(uFrame, uv).rgb);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(uThreshold, 1.0, lum);
  outColor = vec4(c * k, 1.0);
}`;

/** EL4: THE RESOLVE - the frame to the canvas: decoded, the bloom and the
 *  shafts added over the world rect, the vignette, the contrast, encoded. */
const RESOLVE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uFrame;
uniform sampler2D uBloom;
uniform sampler2D uShaft;
uniform vec4 uRect;      // the world rect in canvas pixels
uniform vec2 uCanvas;
uniform vec4 uGrade;     // bloom gain, shaft gain, vignette, contrast
uniform sampler2D uAO;   // EL6: the occlusion off the frame's own depth
uniform float uAOMix;
${CODEC_GLSL}
${BAYER_GLSL}
out vec4 outColor;
void main() {
  vec3 c = airDecode(texture(uFrame, vUV).rgb);
  vec2 wuv = (vUV * uCanvas - uRect.xy) / uRect.zw;
  if (wuv.x >= 0.0 && wuv.x <= 1.0 && wuv.y >= 0.0 && wuv.y <= 1.0) {
    c *= mix(1.0, texture(uAO, wuv).r, uAOMix);   // EL6: the crevice loses its light here, once, whole
    c += texture(uBloom, wuv).rgb * uGrade.x + texture(uShaft, wuv).rgb * uGrade.y;
    float r = length((wuv - 0.5) * 2.0);
    c *= 1.0 - uGrade.z * smoothstep(0.55, 1.35, r);
  }
  // EL5: THE CONTRAST IS IN DISPLAY SPACE. Around 0.18 in linear light it sent
  // everything under 0.007 linear (byte 18) to black - most of a dungeon, all
  // of a night street: the frame came back with six pixels in ten pure black.
  // Around mid-grey of the encoded value the same 1.04 is a grade, not a gate.
  vec3 e = airEncode(max(c, vec3(0.0)));
  e = (e - 0.5) * uGrade.w + 0.5;
  e += (bayer4(gl_FragCoord.xy) - ${BAYER_MEAN}) / 255.0;   // EL6: the dither, at the byte, zero-mean
  outColor = vec4(clamp(e, 0.0, 1.0), 1.0);
}`;

const AO_FS = `#version 300 es
precision highp float;
in vec2 vUV;
${DEPTH_GLSL}
${BAYER_GLSL}
uniform vec3 uKernel[${AIR_AO_SAMPLES}];
uniform vec4 uAOParams;     // radius, strength, bias, unused
out vec4 outColor;
vec3 posAt(vec2 uv) {
  float z = depthAt(uv) * 2.0 - 1.0;
  float vz = -uProjInfo.w / (z + uProjInfo.z);
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * (-vz) / uProjInfo.x, ndc.y * (-vz) / uProjInfo.y, vz);
}
void main() {
  float d0 = depthAt(vUV);
  if (d0 >= 0.99999) { outColor = vec4(1.0); return; }
  vec3 p = posAt(vUV);
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (dot(n, -p) < 0.0) n = -n;   // a normal faces the eye whatever the projection's handedness did to the derivatives
  // EL6: the kernel's rotation is a 4x4 ORDERED pattern, not a hash - the 4x4
  // box blur after it averages exactly one tile, so the pattern cancels; a
  // hash was grain that never cancelled, and in the dark the grain was all
  // a texture had ("textures in the dark look weird")
  float ang = bayer4(gl_FragCoord.xy) * 6.2831853;
  vec3 rnd = vec3(cos(ang), sin(ang), 0.0);
  vec3 t = normalize(rnd - n * dot(rnd, n));
  vec3 b = cross(n, t);
  mat3 tbn = mat3(t, b, n);
  float radius = uAOParams.x;
  float occ = 0.0;
  for (int i = 0; i < ${AIR_AO_SAMPLES}; i++) {
    vec3 s = p + tbn * uKernel[i] * radius;
    vec2 suv = vec2(s.x * uProjInfo.x, s.y * uProjInfo.y) / (-s.z) * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
    float sz = posAt(suv).z;
    float range = smoothstep(0.0, 1.0, radius / abs(p.z - sz));
    occ += (sz >= s.z + uAOParams.z ? 1.0 : 0.0) * range;
  }
  float ao = 1.0 - occ / ${AIR_AO_SAMPLES}.0 * uAOParams.y;
  outColor = vec4(vec3(ao), 1.0);
}`;

// EL7: THE BLUR IS DEPTH-AWARE. A plain box averaged a wall's occlusion into
// the sky beside it and a pillar's into the floor behind it - a halo at every
// edge. A tap counts only while its view distance is within uBlurRange of
// the centre's (the AO radius: what could have occluded it at all).
const BOX_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uBlurRange;
${DEPTH_GLSL}
out vec4 outColor;
void main() {
  float here = viewDist(depthAt(vUV));
  float acc = 0.0, wsum = 0.0;
  for (int y = -2; y < 2; y++) {
    for (int x = -2; x < 2; x++) {
      vec2 uv = vUV + (vec2(float(x), float(y)) + 0.5) * uTexel;
      float w = abs(viewDist(depthAt(uv)) - here) <= uBlurRange ? 1.0 : 0.0;
      acc += texture(uSrc, uv).r * w;
      wsum += w;
    }
  }
  outColor = vec4(vec3(wsum > 0.0 ? acc / wsum : 1.0), 1.0);
}`;

const GAUSS_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uDir;   // the texel step along the axis blurred
out vec4 outColor;
const float W[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
void main() {
  vec3 acc = texture(uSrc, vUV).rgb * W[0];
  for (int i = 1; i < 5; i++) {
    acc += texture(uSrc, vUV + uDir * float(i)).rgb * W[i];
    acc += texture(uSrc, vUV - uDir * float(i)).rgb * W[i];
  }
  outColor = vec4(acc, 1.0);
}`;

const SHAFT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
${DEPTH_GLSL}
uniform vec2 uSun;          // the sun's screen position, uv
uniform vec4 uShaftParams;  // decay, strength, reach, aspect
uniform vec3 uSunColor;
out vec4 outColor;
float mask(vec2 uv) {
  float sky = depthAt(uv) >= 0.99999 ? 1.0 : 0.0;
  vec2 d = (uv - uSun) * vec2(uShaftParams.w, 1.0);
  return sky * smoothstep(uShaftParams.z, 0.0, length(d));
}
void main() {
  vec2 ray = (uSun - vUV) / ${AIR_SHAFT_TAPS}.0;   // AUDIT-EL F17: not 'step' - a built-in's name
  vec2 uv = vUV;
  float acc = 0.0, w = 1.0;
  for (int i = 0; i < ${AIR_SHAFT_TAPS}; i++) {
    acc += mask(uv) * w;
    w *= uShaftParams.x;
    uv += ray;
  }
  outColor = vec4(uSunColor * (acc / ${AIR_SHAFT_TAPS}.0 * uShaftParams.y), 1.0);
}`;

/** The emission-only fragment shaders for the bloom source: a solid's
 *  emission map in its colour (the window style, or white for a self-lit
 *  record); a flat's emission map behind its cutout. */
// EL6: AN EMITTER BEHIND A WALL DOES NOT BLOOM. The bloom source has no depth
// of its own (a quarter-res colour target), so every emitter used to draw
// whatever stood in front of it - a torch two rooms away bloomed through
// the stone ("all lighting sources can be seen through walls"). Each
// fragment now asks the frame's depth at its own screen position and
// discards when a nearer surface is there, with its own slack (it IS in
// that image).
const EMIT_OCCLUSION_GLSL = `
uniform vec2 uBloomSize;
bool occluded() {
  vec2 wuv = gl_FragCoord.xy / uBloomSize;
  return viewDist(gl_FragCoord.z) > viewDist(depthAt(wuv)) + ${glslFloat(AIR_EMIT_SLACK)};
}
`;
export const EMIT_MESH_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uEmissionTex;
uniform vec3 uEmissionColor;
${CODEC_GLSL}
${DEPTH_GLSL}
${EMIT_OCCLUSION_GLSL}
out vec4 outColor;
void main() {
  if (occluded()) discard;   // EL6
  outColor = vec4(airDecode(texture(uEmissionTex, vUV).rgb * uEmissionColor), 1.0);   // AUDIT-EL F20: linear, like the glares and the bright pass beside it
}`;
export const EMIT_BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
${CODEC_GLSL}
${DEPTH_GLSL}
${EMIT_OCCLUSION_GLSL}
out vec4 outColor;
void main() {
  if (texture(uTex, vUV).a < 0.5) discard;
  if (occluded()) discard;   // EL6
  outColor = vec4(airDecode(texture(uEmissionTex, vUV).rgb), 1.0);   // AUDIT-EL F20
}`;

/** The lantern glare: a camera-facing quad at the light, collapsed to
 *  nothing when the depth image holds a surface in front of its centre. */
const GLARE_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCenter;
uniform float uSize;
${DEPTH_GLSL}
out vec2 vUV;
out float vVis;
// EL5: THE OCCLUSION IS IN WORLD UNITS. The depth image is hyperbolic: a
// constant 0.002 off it hid nothing past twenty units, and a town's lanterns
// glared through its walls (the first field report).
// EL7: AND A GLARE NEEDS A FLAME UNDER IT. The test is presence, not
// "nothing nearer": the frame's depth at the tap must hold a surface within
// AIR_GLARE_SLACK of the light's own distance - the flame flat. A light in
// open air draws nothing; a light behind a wall draws nothing; seven taps
// over the glare's footprint (the centre, one and two half-sizes above and
// below it - a city light sits at the TOP of its flat, a dungeon light at
// its BASE, and a flat stands on its point - and either side), so a flame
// half behind a post is half a glare.
float flame(vec4 vc, float lantern) {
  vec4 clip = uProj * vc;
  if (clip.w <= 0.0) return 0.0;
  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return abs(viewDist(depthAt(uv)) - lantern) <= ${glslFloat(AIR_GLARE_SLACK)} ? 1.0 : 0.0;
}
void main() {
  vec4 vc = uView * vec4(uCenter, 1.0);
  vec4 clip = uProj * vc;
  float vis = 0.0;
  if (clip.w > 0.0) {
    vec3 ndc = clip.xyz / clip.w;
    if (abs(ndc.x) < 1.2 && abs(ndc.y) < 1.2) {
      float lantern = -vc.z;
      float s = uSize * 0.5;
      vis = (flame(vc, lantern)
           + flame(vc + vec4(0.0, s, 0.0, 0.0), lantern) + flame(vc + vec4(0.0, 2.0 * s, 0.0, 0.0), lantern)
           + flame(vc + vec4(0.0, -s, 0.0, 0.0), lantern) + flame(vc + vec4(0.0, -2.0 * s, 0.0, 0.0), lantern)
           + flame(vc + vec4(s, 0.0, 0.0, 0.0), lantern) + flame(vc + vec4(-s, 0.0, 0.0, 0.0), lantern)) / 7.0;
      // JAN1 (2026-09-18, Janome: "lights still shining thru attics at certain angles" - BUGS-5 F4's remainder).
      // Presence alone takes a FLOOR for the flame: an oblique surface sweeps a wide range of depths across the
      // seven taps, and at some pitches one tap lands within the slack of the light's own depth - a 1/7 halo painted
      // on the floor above a lamp in the room below. The other half of the law: a surface NEARER than the light at
      // the light's OWN pixel is an occluder, whatever the footprint found. A flame flat is a camera-facing quad
      // through the light and sits at its exact depth, so it never trips this; a city light at the top of its flat
      // shows the flat or the wall behind, both at or past the depth; an open-air light's centre is sky.
      vec2 cuv = ndc.xy * 0.5 + 0.5;
      if (cuv == clamp(cuv, vec2(0.0), vec2(1.0)) && viewDist(depthAt(cuv)) < lantern - ${glslFloat(AIR_GLARE_SLACK)}) vis = 0.0;
    }
  }
  vVis = vis;
  vUV = aCorner;
  gl_Position = uProj * (vc + vec4(aCorner * uSize, 0.0, 0.0));
}`;
const GLARE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in float vVis;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  float r = length(vUV) * 2.0;
  float a = max(0.0, 1.0 - r * r);
  outColor = vec4(uColor * a * a * vVis, 1.0);
}`;

/**
 * The pass. `opts.build(vs, fs)` compiles; `opts.vs` is { mesh, bb } - the
 * renderer's own vertex shaders for the emission replay.
 */
export class AirPass {
  constructor(gl, opts) {
    this.gl = gl;
    const u = (p, n) => gl.getUniformLocation(p, n);
    const P = (vs, fs, names) => { const p = opts.build(vs, fs); const o = { p }; for (const n of names) o[n] = u(p, n); return o; };
    this.programs = {
      ao: P(QUAD_VS, AO_FS, ['uDepth', 'uProjInfo', 'uKernel', 'uAOParams', 'uRect', 'uCanvas']),
      box: P(QUAD_VS, BOX_FS, ['uSrc', 'uTexel', 'uBlurRange', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas']),
      gauss: P(QUAD_VS, GAUSS_FS, ['uSrc', 'uDir']),
      shaft: P(QUAD_VS, SHAFT_FS, ['uDepth', 'uSun', 'uShaftParams', 'uSunColor', 'uProjInfo', 'uRect', 'uCanvas']),
      emitMesh: P(opts.vs.mesh, EMIT_MESH_FS, ['uProj', 'uView', 'uModel', 'uEmissionTex', 'uEmissionColor', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas', 'uBloomSize']),
      emitBb: P(opts.vs.bb, EMIT_BB_FS, ['uProj', 'uView', 'uRight', 'uUp', 'uOrigin', 'uSize', 'uTex', 'uEmissionTex', 'uFlatWind', 'uSway', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas', 'uBloomSize']),
      glare: P(GLARE_VS, GLARE_FS, ['uProj', 'uView', 'uCenter', 'uSize', 'uDepth', 'uColor', 'uProjInfo', 'uRect', 'uCanvas']),
      // EL4
      lum: P(QUAD_VS, LUM_FS, ['uFrame', 'uPrev', 'uRect', 'uCanvas']),
      adapt: P(QUAD_VS, ADAPT_FS, ['uPrev', 'uLum', 'uAdaptParams', 'uAdaptRates']),
      bright: P(QUAD_VS, BRIGHT_FS, ['uFrame', 'uRect', 'uCanvas', 'uThreshold']),
      resolve: P(QUAD_VS, RESOLVE_FS, ['uFrame', 'uBloom', 'uShaft', 'uRect', 'uCanvas', 'uGrade', 'uAO', 'uAOMix']),
    };
    // the fullscreen quad and the glare's corner quad
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.glareVao = gl.createVertexArray();
    gl.bindVertexArray(this.glareVao);
    const gb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.kernel = aoKernel();
    this.projInfo = new Float32Array(4);
    this.aoParams = new Float32Array([AIR_AO_RADIUS, AIR_AO_STRENGTH, AIR_AO_BIAS, 0]);
    this.shaftParams = new Float32Array([AIR_SHAFT_DECAY, AIR_SHAFT_STRENGTH, AIR_SHAFT_REACH, 1]);
    this.f = null;   // EL6: the frame's inputs, from prepare() to composite()
    // EL8: the previous frame's view-projection and projection terms, for the contact march; valid once a frame has been prepared
    this.prevVP = new Float32Array(16); this.prevProjInfo = new Float32Array(4); this.prevValid = false;
    this.contactParams = new Float32Array([AIR_CONTACT_LENGTH, AIR_CONTACT_THICKNESS, AIR_CONTACT_FLOOR, 0]);
    this.pending = false;   // a resolve is owed to the frame
    this.width = 0; this.height = 0;
    this.targets = null;
    // EL4: the frame image (canvas-sized), the luminance image and the two adaptation images
    this.frame = null;
    this.lum = null;
    this.adapt = null;      // [a, b], this.adaptIndex the current
    this.adaptIndex = 0;
    this.grade = new Float32Array([AIR_BLOOM_STRENGTH, 1, AIR_VIGNETTE, AIR_CONTRAST]);
    this.adaptParams = new Float32Array([0, AIR_ADAPT_KEY, AIR_ADAPT_MIN, AIR_ADAPT_MAX]);
    this.adaptRates = new Float32Array([AIR_ADAPT_OPEN, AIR_ADAPT_CLOSE]);
    this.canvas = new Float32Array(2);
    this.rect = new Float32Array(4);
    this._lastResolve = 0;
    this.measured = false;   // AUDIT-EL F10
    this._now = opts.now ?? (() => (globalThis.performance?.now?.() ?? Date.now()));
    this.stats = { emitDraws: 0, glares: 0, shafts: false };
    this._identityView = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this._planes = new Float32Array(24);   // EL5: the emission replay's frustum
    this._black = new Float32Array(3);
    this._white = new Float32Array([1, 1, 1]);
    this._zeroWind = new Float32Array(4);
    this._vp = new Float32Array(16);
  }

  /** (Re)allocate the images for a world viewport of w x h pixels. */
  resize(w, h) {
    if (this.targets && this.width === w && this.height === h) return;
    const gl = this.gl;
    if (this.targets) this._free();
    this.width = w; this.height = h;
    const color = (cw, ch) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo, w: cw, h: ch };
    };
    // EL6: no depth image of its own - the frame's depth is the one every pass reads
    const aw = Math.max(1, Math.round(w * AIR_AO_SCALE)), ah = Math.max(1, Math.round(h * AIR_AO_SCALE));
    const bw = Math.max(1, Math.round(w * AIR_BLOOM_SCALE)), bh = Math.max(1, Math.round(h * AIR_BLOOM_SCALE));
    this.targets = {
      ao: color(aw, ah), aoBlur: color(aw, ah),
      bloom: color(bw, bh), bloomB: color(bw, bh),
      shaft: color(bw, bh),
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  _free() {
    const gl = this.gl, t = this.targets;
    for (const k of Object.keys(t)) { gl.deleteTexture(t[k].tex); gl.deleteFramebuffer(t[k].fbo); }
    this.targets = null;
  }

  /** EL4: the frame image for a canvas of W x H - RGBA8 with a 24-bit depth
   *  TEXTURE (EL6: the AO, the glares, the emitters and the shafts read it
   *  at the resolve - the frame's own depth, no replay), (re)allocated when
   *  the canvas changes size. */
  _ensureFrame(W, H) {
    const gl = this.gl;
    if (this.frame && this.frame.w === W && this.frame.h === H) return this.frame;
    if (this.frame) { gl.deleteTexture(this.frame.tex); for (const d of this.frame.depths) gl.deleteTexture(d); for (const f of this.frame.depthFbos) gl.deleteFramebuffer(f); gl.deleteFramebuffer(this.frame.fbo); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // EL8: TWO depth textures the frames ping-pong between - the one being
    // written, and the previous frame's for the contact march; each cleared to
    // the far plane at birth through its own framebuffer
    const depths = [], depthFbos = [];
    for (let k = 0; k < 2; k++) {
      const depth = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, W, H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const dfbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, dfbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      depths.push(depth); depthFbos.push(dfbo);
    }
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depths[0], 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.frame = { tex, depths, depthFbos, depthIndex: 0, depth: depths[0], prevDepth: depths[1], fbo, w: W, h: H };
    this.prevValid = false;   // a new frame image: the previous depth is the far plane
    if (!this.lum) this._ensureAdapt();
    return this.frame;
  }
  /** EL4: the luminance image with its mip chain and the two 1x1
   *  adaptation images, the current one starting at a multiplier of 1. */
  _ensureAdapt() {
    const gl = this.gl;
    const lumTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lumTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AIR_LUM_SIZE, AIR_LUM_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const lumFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, lumFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lumTex, 0);
    this.lum = { tex: lumTex, fbo: lumFbo, w: AIR_LUM_SIZE, h: AIR_LUM_SIZE };
    const one = Math.round(packLog(1, AIR_ADAPT_LOG_RANGE) * 255);
    this.adapt = [0, 1].map(() => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([one, one, one, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo, w: 1, h: 1 };
    });
    this.adaptIndex = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  /** EL4: the current adaptation image - what the lane's shaders and the far ring read. */
  get adaptTexture() { return this.adapt ? this.adapt[this.adaptIndex].tex : null; }

  /** EL4: bind the frame image for the world pass of a W x H canvas, and
   *  make it the frame target every pass restores to. Returns its fbo. */
  beginFrameTarget(W, H) {
    if (!(W > 0 && H > 0)) return null;   // AUDIT-EL F18
    const f = this._ensureFrame(W, H);
    const gl = this.gl;
    // EL8: this frame writes the other depth; the one just written is the previous
    f.depthIndex ^= 1;
    f.depth = f.depths[f.depthIndex]; f.prevDepth = f.depths[f.depthIndex ^ 1];
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, f.depth, 0);
    setFrameTarget(f.fbo);
    this.canvas[0] = W; this.canvas[1] = H;
    this.pending = true;   // AUDIT-EL F5: a bound frame is a resolve owed, whether or not the passes ran for it
    return f.fbo;
  }

  /**
   * EL6: TAKE THE FRAME'S INPUTS, at the top of a world frame - nothing is
   * drawn here. `f`: { proj, view, lightDir, sunScale, sunColor,
   * pointLights, pointColors (decoded vec3s), viewport [x,y,w,h], shadows
   * (the ShadowPass: its records and its depth programs), textures,
   * emissionTextures, blackTex, windowEmission, isSpectral, bindVao,
   * clearColor }. The images are drawn at the resolve, off the frame's own
   * depth: the AO, the bloom source (the emitters and the glares, both
   * occluded by that depth), the shafts. Before EL6 they were drawn HERE,
   * off a depth image the records were replayed into - a third walk of the
   * town per frame, one frame stale, and the emitters drew through walls.
   */
  prepare(f) {
    const [, , w, h] = f.viewport;
    if (!(w > 0 && h > 0)) { this.f = null; return; }   // AUDIT-EL F18: a hidden canvas has no images to draw (texStorage2D refuses 0)
    this.resize(w, h);
    // EL8: the frame just resolved becomes the previous - its view-projection and terms, for the contact march
    if (this.f) { this.prevVP.set(this._vp); this.prevProjInfo.set(this.projInfo); this.prevValid = !!this.frame; }
    this.f = f;
    this.rect.set(f.viewport);
    projInfo(f.proj, this.projInfo);
    multiply(f.proj, f.view, this._vp);
    this.measured = false;   // AUDIT-EL F10: set at the resolve, by whether the world drew
    this.stats.emitDraws = 0; this.stats.glares = 0; this.stats.shafts = false;   // this frame's, counted at the resolve
  }

  /** EL6: the images, at the resolve, off the frame's depth. */
  _images() {
    const gl = this.gl, f = this.f, sp = f.shadows, T = this.targets, F = this.frame;
    this.stats.emitDraws = 0; this.stats.glares = 0; this.stats.shafts = false;
    this.measured = !!(sp && sp.count > 0);   // AUDIT-EL F10: a frame with no world in it (a video, a menu) is not one the eye adapts to
    const vp = multiply(f.proj, f.view, this._vp);
    const quad = (prog, target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(prog.p);
      gl.bindVertexArray(this.quadVao);
    };
    const depthOn = (prog) => {   // the depth block's four uniforms, the depth on unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, F.depth);
      gl.uniform1i(prog.uDepth, 0);
      gl.uniform4fv(prog.uProjInfo, this.projInfo);
      gl.uniform4fv(prog.uRect, this.rect);
      gl.uniform2fv(prog.uCanvas, this.canvas);
    };
    // 1. the ambient occlusion, then its box blur (exactly one tile of the ordered rotation)
    quad(this.programs.ao, T.ao);
    depthOn(this.programs.ao);
    gl.uniform3fv(this.programs.ao.uKernel, this.kernel);
    gl.uniform4fv(this.programs.ao.uAOParams, this.aoParams);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    quad(this.programs.box, T.aoBlur);
    depthOn(this.programs.box);   // EL7: the blur reads the depth too - on unit 0; the AO on unit 1
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.ao.tex); gl.uniform1i(this.programs.box.uSrc, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(this.programs.box.uTexel, 1 / T.ao.w, 1 / T.ao.h);
    gl.uniform1f(this.programs.box.uBlurRange, AIR_AO_RADIUS);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // 2. the bloom source: the emitters (this frame's records, culled, occluded), and a glare per lantern
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.bloom.fbo);
    gl.viewport(0, 0, T.bloom.w, T.bloom.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);   // the emitters and the glares add; the target has no depth - both hide by the frame's depth themselves
    gl.blendFunc(gl.ONE, gl.ONE);
    if (sp && sp.count > 0) this._replayEmission(f, sp, vp, depthOn);
    this._glares(f, depthOn);
    gl.disable(gl.BLEND);
    // EL4: the bright pass joins them, and the blur runs, once the frame is whole
    // 3. the shafts, when the sun is up and in front of the camera
    const sun = f.sunScale > 0.01 && f.lightDir && f.lightDir[1] > 0 ? sunScreenUV(f.proj, f.view, f.lightDir) : null;
    quad(this.programs.shaft, T.shaft);
    if (sun) {
      depthOn(this.programs.shaft);
      gl.uniform2f(this.programs.shaft.uSun, sun[0], sun[1]);
      this.shaftParams[3] = T.shaft.w / T.shaft.h;
      gl.uniform4fv(this.programs.shaft.uShaftParams, this.shaftParams);
      gl.uniform3fv(this.programs.shaft.uSunColor, f.sunColor);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.shafts = true;
    } else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.clearColor(f.clearColor[0], f.clearColor[1], f.clearColor[2], f.clearColor[3]);
  }

  _replayEmission(f, sp, vp, depthOn) {
    const gl = this.gl, P = this.programs, T = this.targets;
    const planes = spherePlanes(vp, this._planes);   // EL5: the eye's frustum - what it cannot see cannot bloom
    let bound = null;
    for (let i = 0; i < sp.count; i++) {
      const r = sp.records[i];
      if (r.kind !== 2 && !recordVisible(planes, r)) continue;
      if (r.kind === 0) {
        const mesh = r.mesh;
        if (!mesh?.vao || mesh._dead || !mesh.subMeshes?.length) continue;
        let vaoBound = false;
        for (let k = 0; k < mesh.subMeshes.length; k++) {
          const sm = mesh.subMeshes[k];
          const emis = sm._evEmis;
          if (!emis || emis === f.blackTex) continue;   // nothing to bloom: the main pass resolved no mask, or the black one
          if (!subMeshVisible(planes, r, k)) continue;   // EL5
          if (bound !== P.emitMesh) { bound = P.emitMesh; gl.useProgram(bound.p); gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView); gl.uniform1i(bound.uEmissionTex, 1); this._emitDepth(bound, depthOn, T); }
          if (!vaoBound) { gl.uniformMatrix4fv(P.emitMesh.uModel, false, r.matrix); f.bindVao(mesh.vao); vaoBound = true; }
          gl.uniform3fv(P.emitMesh.uEmissionColor, sm._evEmisWhite ? this._white : f.windowEmission);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, emis);
          gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
          this.stats.emitDraws++;
        }
      } else if (r.kind === 2) {
        for (const b of r.batches) {
          if (!b?.vao || b._dead || b.conceal) continue;
          if (!batchVisible(planes, b)) continue;   // EL5
          const key = b._bbKey ?? (b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`);
          const emis = f.emissionTextures.get(key);
          const tex = f.textures.get(key);
          if (!emis || !tex) continue;
          if (bound !== P.emitBb) {
            bound = P.emitBb; gl.useProgram(bound.p);
            gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView);
            gl.uniform1i(bound.uTex, 0); gl.uniform1i(bound.uEmissionTex, 1);
            gl.uniform4fv(bound.uFlatWind, r.flatWind);
            this._emitDepth(bound, depthOn, T);
          }
          gl.uniform3fv(P.emitBb.uRight, r.right); gl.uniform3fv(P.emitBb.uUp, r.up);   // the camera basis the batch was drawn with
          const o = b.origin || [0, 0, 0];
          gl.uniform3f(P.emitBb.uOrigin, o[0], o[1], o[2]);
          gl.uniform2f(P.emitBb.uSize, b.size.w, b.size.h);
          gl.uniform1f(P.emitBb.uSway, b.sway || 0);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, emis);
          f.bindVao(b.vao);
          gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
          this.stats.emitDraws++;
        }
      }
    }
    gl.activeTexture(gl.TEXTURE0);
  }
  /** EL8: the contact block's uniforms for one lane program - the previous
   *  frame's depth on its unit, its view-projection and terms, the params
   *  (off when no previous frame exists or the caller says so). */
  uploadContact(loc, on = true) {
    const gl = this.gl;
    const live = on && this.prevValid && this.frame;
    gl.activeTexture(gl.TEXTURE0 + AIR_CONTACT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, live ? this.frame.prevDepth : (this.frame ? this.frame.prevDepth : null));
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.prevDepth, AIR_CONTACT_UNIT);
    gl.uniformMatrix4fv(loc.prevVP, false, this.prevVP);
    gl.uniform4fv(loc.prevProjInfo, this.prevProjInfo);
    this.contactParams[3] = live ? 1 : 0;
    gl.uniform4fv(loc.contactParams, this.contactParams);
  }

  /** EL6: the frame's depth for an emitter program - on unit 2 (0 and 1 are its own textures). */
  _emitDepth(prog, depthOn, T) {
    const gl = this.gl;
    depthOn(prog);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.depth);
    gl.uniform1i(prog.uDepth, 2);
    gl.uniform2f(prog.uBloomSize, T.bloom.w, T.bloom.h);
    gl.activeTexture(gl.TEXTURE0);
  }

  _glares(f, depthOn) {
    const gl = this.gl, P = this.programs.glare, L = f.pointLights, C = f.pointColors;
    const n = L.length >> 2;
    if (n === 0) return;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.uProj, false, f.proj);
    gl.uniformMatrix4fv(P.uView, false, f.view);
    depthOn(P);   // EL5/EL6: the depth's reconstruction, off the frame's own
    gl.bindVertexArray(this.glareVao);
    const eye = f.eye;
    for (let i = 0; i < n; i++) {
      const range = L[i * 4 + 3];
      if (!(range > 0) || range > AIR_GLARE_MAX_RANGE) continue;   // AUDIT-EL F11: the lightning flash (range 500..1000 over the player) is no lantern
      if (eye && Math.hypot(L[i * 4] - eye[0], L[i * 4 + 1] - eye[1], L[i * 4 + 2] - eye[2]) < AIR_GLARE_MIN_DISTANCE) continue;   // EL7: the torch in the hand, the candle
      gl.uniform3f(P.uCenter, L[i * 4], L[i * 4 + 1], L[i * 4 + 2]);
      gl.uniform1f(P.uSize, glareSize(range));
      gl.uniform3f(P.uColor, C ? C[i * 3] : 1, C ? C[i * 3 + 1] : 1, C ? C[i * 3 + 2] : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.glares++;
    }
  }


  /** EL4: THE RESOLVE. Called by the frame's first screen-space draw; a
   *  no-op until a render is owed. Measures the frame (the luminance image,
   *  the adaptation step), finishes the bloom (the bright pass, the blur),
   *  then draws the frame to the canvas through RESOLVE_FS and releases the
   *  frame target. Leaves the canvas bound at the full canvas viewport. */
  composite() {
    if (!this.pending || !this.targets || !this.frame) return;
    this.pending = false;
    const gl = this.gl, P = this.programs, T = this.targets, F = this.frame;
    const now = this._now();
    const dt = this._lastResolve ? Math.min(Math.max((now - this._lastResolve) / 1000, 0), AIR_ADAPT_MAX_DT) : 0;
    this._lastResolve = now;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadVao);
    const quad = (prog, target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(prog.p);
    };
    gl.activeTexture(gl.TEXTURE0);
    // 0. EL6: the images, off the frame's depth (the frame is whole now)
    if (this.f) this._images();
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadVao);
    // 1. the luminance image and its mean - AUDIT-EL F10: not off a frame the
    // world never drew (the passes saw no records): the eye would adapt to
    // the clear colour behind a video or a menu and swing back on return
    if (this.measured) {
    quad(P.lum, this.lum);
    gl.bindTexture(gl.TEXTURE_2D, F.tex);
    gl.uniform1i(P.lum.uFrame, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.adapt[this.adaptIndex].tex); gl.uniform1i(P.lum.uPrev, 1);   // AUDIT-EL F16
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4fv(P.lum.uRect, this.rect);
    gl.uniform2fv(P.lum.uCanvas, this.canvas);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, this.lum.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    // 2. the adaptation step, into the other 1x1 image
    const prev = this.adapt[this.adaptIndex], next = this.adapt[1 - this.adaptIndex];
    quad(P.adapt, next);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prev.tex); gl.uniform1i(P.adapt.uPrev, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.lum.tex); gl.uniform1i(P.adapt.uLum, 1);
    gl.activeTexture(gl.TEXTURE0);
    this.adaptParams[0] = dt;
    gl.uniform4fv(P.adapt.uAdaptParams, this.adaptParams);
    gl.uniform2fv(P.adapt.uAdaptRates, this.adaptRates);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.adaptIndex = 1 - this.adaptIndex;
    }
    // 3. the bright pass joins the emitters and the glares, then the blur, twice
    quad(P.bright, T.bloom);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindTexture(gl.TEXTURE_2D, F.tex);
    gl.uniform1i(P.bright.uFrame, 0);
    gl.uniform4fv(P.bright.uRect, this.rect);
    gl.uniform2fv(P.bright.uCanvas, this.canvas);
    gl.uniform1f(P.bright.uThreshold, AIR_BRIGHT_THRESHOLD);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    for (let pass = 0; pass < 2; pass++) {
      quad(P.gauss, T.bloomB);
      gl.bindTexture(gl.TEXTURE_2D, T.bloom.tex);
      gl.uniform1i(P.gauss.uSrc, 0);
      gl.uniform2f(P.gauss.uDir, 1 / T.bloom.w, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      quad(P.gauss, T.bloom);
      gl.bindTexture(gl.TEXTURE_2D, T.bloomB.tex);
      gl.uniform2f(P.gauss.uDir, 0, 1 / T.bloom.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // 4. the frame to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    setFrameTarget(null);
    gl.viewport(0, 0, F.w, F.h);
    gl.useProgram(P.resolve.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.tex); gl.uniform1i(P.resolve.uFrame, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.bloom.tex); gl.uniform1i(P.resolve.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.shaft.tex); gl.uniform1i(P.resolve.uShaft, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.aoBlur.tex); gl.uniform1i(P.resolve.uAO, 3);   // EL6
    gl.uniform1f(P.resolve.uAOMix, this.f ? AIR_AO_RESOLVE : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4fv(P.resolve.uRect, this.rect);
    gl.uniform2fv(P.resolve.uCanvas, this.canvas);
    gl.uniform4fv(P.resolve.uGrade, this.grade);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
  }

  /** EL4: drop the frame target without resolving (the door closed, the lane left mid-frame). */
  release() {
    if (this.frame) setFrameTarget(null);
    this.pending = false;
  }
}
