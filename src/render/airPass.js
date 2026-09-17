// @ts-check
// EL3 (2026-09-17, the Enhanced Lighting arc, tier three - DEPTH AND AIR).
//
// WHAT THIS IS. Three screen-space effects the lane adds on top of EL1's
// light and EL2's shadows, all fed by ONE new thing: a depth image of the
// world from the camera, drawn at the top of the frame from the shadow
// pass's records (render/shadowPass.js - the same replay, the camera's
// view-projection instead of the light's). Off that depth:
//
//   1. AMBIENT OCCLUSION (SSAO at half resolution): a hemisphere of
//      twelve samples about the surface normal reconstructed from the
//      depth, each projected back and tested against the depth image,
//      range-checked, rotated per pixel by a hash so the pattern is noise
//      and not a stamp, then a 4x4 box blur. The lane's mesh, terrain and
//      character shaders read the result by screen position (AIR_AO_GLSL)
//      and multiply their AMBIENT term - the light that has no direction
//      is the light a crevice loses; the sun and the lanterns keep theirs.
//   2. BLOOM (quarter resolution): sourced from what actually emits -
//      every window's emission map and every self-lit record (the
//      records replayed with an emission-only program), and a glare
//      sprite at each lantern, sized by its range, hidden when the depth
//      image says a wall is in front of it - then a separable 9-tap
//      gaussian, twice, added over the frame.
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
// output linear, which is the one thing this pass does not touch.
//
// This module imports nothing of the renderer or the lane; the renderer
// hands it its own vertex shaders and its program builder, as the shadow
// pass takes them.

import { multiply } from '../world/mat4.js';
import { setFrameTarget } from './renderTarget.js';

/** The kill door: `?air=off` keeps EL1 and EL2 and drops the three effects. */
export function airOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('air') !== 'off';
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
/** The bloom's gain on the composite, and the glare sprite's size per
 *  square root of a lantern's range (range 18 -> ~1.5 units). */
export const AIR_BLOOM_STRENGTH = 0.6;
export const AIR_GLARE_SIZE = 0.35;
/** The shafts: taps along the ray, the per-tap decay, the gain, the
 *  angular reach of the sun's mask (in the shaft image's UV). */
export const AIR_SHAFT_TAPS = 32;
export const AIR_SHAFT_DECAY = 0.96;
export const AIR_SHAFT_STRENGTH = 0.35;
export const AIR_SHAFT_REACH = 0.35;
/** The reserved texture unit for the AO image (the shadow maps are 13 and 14, the cloud shadow 15). */
export const AIR_AO_UNIT = 12;
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

/** THE RECEIVER BLOCK for the lane's lit shaders: the AO image by screen
 *  position, 1.0 while the pass is off (params.z, the viewport's width). */
export const AIR_AO_GLSL = `
uniform sampler2D uAO;
uniform vec4 uAOInfo;   // the world viewport x, y, w, h in pixels; w 0 = no AO
float aoAt() {
  if (uAOInfo.z <= 0.0) return 1.0;
  vec2 uv = (gl_FragCoord.xy - uAOInfo.xy) / uAOInfo.zw;
  return texture(uAO, uv).r;
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
uniform vec4 uRect;     // the world rect in canvas pixels
uniform vec2 uCanvas;
${CODEC_GLSL}
out vec4 outColor;
void main() {
  vec2 uv = (uRect.xy + vUV * uRect.zw) / uCanvas;
  vec3 c = airDecode(texture(uFrame, uv).rgb);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float v = (log2(max(lum, 1e-9)) - (${AIR_LUM_LOG_RANGE[0]}.0)) / ${AIR_LUM_LOG_RANGE[1] - AIR_LUM_LOG_RANGE[0]}.0;
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
${CODEC_GLSL}
out vec4 outColor;
void main() {
  vec3 c = airDecode(texture(uFrame, vUV).rgb);
  vec2 wuv = (vUV * uCanvas - uRect.xy) / uRect.zw;
  if (wuv.x >= 0.0 && wuv.x <= 1.0 && wuv.y >= 0.0 && wuv.y <= 1.0) {
    c += texture(uBloom, wuv).rgb * uGrade.x + texture(uShaft, wuv).rgb * uGrade.y;
    float r = length((wuv - 0.5) * 2.0);
    c *= 1.0 - uGrade.z * smoothstep(0.55, 1.35, r);
    c = (c - 0.18) * uGrade.w + 0.18;
  }
  outColor = vec4(airEncode(max(c, vec3(0.0))), 1.0);
}`;

const AO_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uDepth;
uniform vec4 uProjInfo;     // proj[0], proj[5], proj[10], proj[14]
uniform vec3 uKernel[${AIR_AO_SAMPLES}];
uniform vec4 uAOParams;     // radius, strength, bias, unused
out vec4 outColor;
vec3 posAt(vec2 uv) {
  float z = texture(uDepth, uv).r * 2.0 - 1.0;
  float vz = -uProjInfo.w / (z + uProjInfo.z);
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * (-vz) / uProjInfo.x, ndc.y * (-vz) / uProjInfo.y, vz);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float d0 = texture(uDepth, vUV).r;
  if (d0 >= 0.99999) { outColor = vec4(1.0); return; }
  vec3 p = posAt(vUV);
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (dot(n, -p) < 0.0) n = -n;   // a normal faces the eye whatever the projection's handedness did to the derivatives
  vec3 rnd = normalize(vec3(hash(gl_FragCoord.xy) * 2.0 - 1.0, hash(gl_FragCoord.yx + 7.0) * 2.0 - 1.0, 0.0));
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

const BOX_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  float acc = 0.0;
  for (int y = -2; y < 2; y++) {
    for (int x = -2; x < 2; x++) {
      acc += texture(uSrc, vUV + (vec2(float(x), float(y)) + 0.5) * uTexel).r;
    }
  }
  outColor = vec4(vec3(acc / 16.0), 1.0);
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
uniform sampler2D uDepth;
uniform vec2 uSun;          // the sun's screen position, uv
uniform vec4 uShaftParams;  // decay, strength, reach, aspect
uniform vec3 uSunColor;
out vec4 outColor;
float mask(vec2 uv) {
  float sky = texture(uDepth, uv).r >= 0.99999 ? 1.0 : 0.0;
  vec2 d = (uv - uSun) * vec2(uShaftParams.w, 1.0);
  return sky * smoothstep(uShaftParams.z, 0.0, length(d));
}
void main() {
  vec2 step = (uSun - vUV) / ${AIR_SHAFT_TAPS}.0;
  vec2 uv = vUV;
  float acc = 0.0, w = 1.0;
  for (int i = 0; i < ${AIR_SHAFT_TAPS}; i++) {
    acc += mask(uv) * w;
    w *= uShaftParams.x;
    uv += step;
  }
  outColor = vec4(uSunColor * (acc / ${AIR_SHAFT_TAPS}.0 * uShaftParams.y), 1.0);
}`;

/** The emission-only fragment shaders for the bloom source: a solid's
 *  emission map in its colour (the window style, or white for a self-lit
 *  record); a flat's emission map behind its cutout. */
export const EMIT_MESH_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uEmissionTex;
uniform vec3 uEmissionColor;
out vec4 outColor;
void main() {
  outColor = vec4(texture(uEmissionTex, vUV).rgb * uEmissionColor, 1.0);
}`;
export const EMIT_BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
out vec4 outColor;
void main() {
  if (texture(uTex, vUV).a < 0.5) discard;
  outColor = vec4(texture(uEmissionTex, vUV).rgb, 1.0);
}`;

/** The lantern glare: a camera-facing quad at the light, collapsed to
 *  nothing when the depth image holds a surface in front of its centre. */
const GLARE_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCenter;
uniform float uSize;
uniform sampler2D uDepth;
out vec2 vUV;
out float vVis;
void main() {
  vec4 vc = uView * vec4(uCenter, 1.0);
  vec4 clip = uProj * vc;
  float vis = 0.0;
  if (clip.w > 0.0) {
    vec3 ndc = clip.xyz / clip.w;
    if (abs(ndc.x) < 1.2 && abs(ndc.y) < 1.2) {
      float d = texture(uDepth, ndc.xy * 0.5 + 0.5).r;
      vis = (ndc.z * 0.5 + 0.5) <= d + 0.002 ? 1.0 : 0.0;
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
      ao: P(QUAD_VS, AO_FS, ['uDepth', 'uProjInfo', 'uKernel', 'uAOParams']),
      box: P(QUAD_VS, BOX_FS, ['uSrc', 'uTexel']),
      gauss: P(QUAD_VS, GAUSS_FS, ['uSrc', 'uDir']),
      shaft: P(QUAD_VS, SHAFT_FS, ['uDepth', 'uSun', 'uShaftParams', 'uSunColor']),
      emitMesh: P(opts.vs.mesh, EMIT_MESH_FS, ['uProj', 'uView', 'uModel', 'uEmissionTex', 'uEmissionColor']),
      emitBb: P(opts.vs.bb, EMIT_BB_FS, ['uProj', 'uView', 'uRight', 'uUp', 'uOrigin', 'uSize', 'uTex', 'uEmissionTex', 'uFlatWind', 'uSway']),
      glare: P(GLARE_VS, GLARE_FS, ['uProj', 'uView', 'uCenter', 'uSize', 'uDepth', 'uColor']),
      // EL4
      lum: P(QUAD_VS, LUM_FS, ['uFrame', 'uRect', 'uCanvas']),
      adapt: P(QUAD_VS, ADAPT_FS, ['uPrev', 'uLum', 'uAdaptParams', 'uAdaptRates']),
      bright: P(QUAD_VS, BRIGHT_FS, ['uFrame', 'uRect', 'uCanvas', 'uThreshold']),
      resolve: P(QUAD_VS, RESOLVE_FS, ['uFrame', 'uBloom', 'uShaft', 'uRect', 'uCanvas', 'uGrade']),
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
    this.aoInfo = new Float32Array(4);
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
    this._now = opts.now ?? (() => (globalThis.performance?.now?.() ?? Date.now()));
    this.stats = { emitDraws: 0, glares: 0, shafts: false };
    this._identityView = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
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
    // the depth image: a depth texture, sampled plainly (no compare)
    const depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depthFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    const aw = Math.max(1, Math.round(w * AIR_AO_SCALE)), ah = Math.max(1, Math.round(h * AIR_AO_SCALE));
    const bw = Math.max(1, Math.round(w * AIR_BLOOM_SCALE)), bh = Math.max(1, Math.round(h * AIR_BLOOM_SCALE));
    this.targets = {
      depth: { tex: depthTex, fbo: depthFbo, w, h },
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
   *  renderbuffer, (re)allocated when the canvas changes size. */
  _ensureFrame(W, H) {
    const gl = this.gl;
    if (this.frame && this.frame.w === W && this.frame.h === H) return this.frame;
    if (this.frame) { gl.deleteTexture(this.frame.tex); gl.deleteRenderbuffer(this.frame.rb); gl.deleteFramebuffer(this.frame.fbo); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.frame = { tex, rb, fbo, w: W, h: H };
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
    const f = this._ensureFrame(W, H);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, f.fbo);
    setFrameTarget(f.fbo);
    this.canvas[0] = W; this.canvas[1] = H;
    return f.fbo;
  }

  /**
   * Draw the frame's images. `f`: { proj, view, lightDir, sunScale,
   * sunColor, pointLights, pointColors (decoded vec3s), viewport [x,y,w,h],
   * shadows (the ShadowPass: its records and its depth programs), textures,
   * emissionTextures, blackTex, windowEmission, isSpectral, bindVao }.
   * Leaves no framebuffer bound; the caller's program shadow is dirty.
   */
  render(f) {
    const gl = this.gl, sp = f.shadows;
    const [, , w, h] = f.viewport;
    this.resize(w, h);
    const T = this.targets;
    this.stats.emitDraws = 0; this.stats.glares = 0; this.stats.shafts = false;
    projInfo(f.proj, this.projInfo);
    const vp = multiply(f.proj, f.view, this._vp);
    // 1. the depth image, from the records
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.depth.fbo);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    if (sp && sp.count > 0) sp.replay({ bindVao: f.bindVao, textures: f.textures, isSpectral: f.isSpectral }, vp, null);
    gl.colorMask(true, true, true, true);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    // 2. the ambient occlusion, then its box blur
    const quad = (prog, target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(prog.p);
      gl.bindVertexArray(this.quadVao);
    };
    gl.activeTexture(gl.TEXTURE0);
    quad(this.programs.ao, T.ao);
    gl.bindTexture(gl.TEXTURE_2D, T.depth.tex);
    gl.uniform1i(this.programs.ao.uDepth, 0);
    gl.uniform4fv(this.programs.ao.uProjInfo, this.projInfo);
    gl.uniform3fv(this.programs.ao.uKernel, this.kernel);
    gl.uniform4fv(this.programs.ao.uAOParams, this.aoParams);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    quad(this.programs.box, T.aoBlur);
    gl.bindTexture(gl.TEXTURE_2D, T.ao.tex);
    gl.uniform1i(this.programs.box.uSrc, 0);
    gl.uniform2f(this.programs.box.uTexel, 1 / T.ao.w, 1 / T.ao.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.aoInfo[0] = f.viewport[0]; this.aoInfo[1] = f.viewport[1]; this.aoInfo[2] = w; this.aoInfo[3] = h;
    // 3. the bloom source: the emitters, and a glare per lantern
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.bloom.fbo);
    gl.viewport(0, 0, T.bloom.w, T.bloom.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);   // the emitters and the glares add; the target has no depth, the glares hide by the depth image themselves
    gl.blendFunc(gl.ONE, gl.ONE);
    if (sp && sp.count > 0) this._replayEmission(f, sp, vp);
    this._glares(f);
    gl.disable(gl.BLEND);
    // EL4: the bright pass joins them at the resolve, and the blur runs there, once the frame is whole
    // 4. the shafts, when the sun is up and in front of the camera
    const sun = f.sunScale > 0.01 && f.lightDir && f.lightDir[1] > 0 ? sunScreenUV(f.proj, f.view, f.lightDir) : null;
    quad(this.programs.shaft, T.shaft);
    if (sun) {
      gl.bindTexture(gl.TEXTURE_2D, T.depth.tex);
      gl.uniform1i(this.programs.shaft.uDepth, 0);
      gl.uniform2f(this.programs.shaft.uSun, sun[0], sun[1]);
      this.shaftParams[3] = w / h;
      gl.uniform4fv(this.programs.shaft.uShaftParams, this.shaftParams);
      gl.uniform3fv(this.programs.shaft.uSunColor, f.sunColor);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.shafts = true;
    } else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(f.clearColor[0], f.clearColor[1], f.clearColor[2], f.clearColor[3]);
    this.rect.set(f.viewport);
    this.pending = true;
  }

  _replayEmission(f, sp, vp) {
    const gl = this.gl, P = this.programs;
    let bound = null;
    for (let i = 0; i < sp.count; i++) {
      const r = sp.records[i];
      if (r.kind === 0) {
        const mesh = r.mesh;
        if (!mesh?.vao || mesh._dead || !mesh.subMeshes?.length) continue;
        if (bound !== P.emitMesh) { bound = P.emitMesh; gl.useProgram(bound.p); gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView); gl.uniform1i(bound.uEmissionTex, 1); }
        gl.uniformMatrix4fv(P.emitMesh.uModel, false, r.matrix);
        f.bindVao(mesh.vao);
        for (const sm of mesh.subMeshes) {
          const emis = sm._evEmis;
          if (!emis || emis === f.blackTex) continue;   // nothing to bloom: the main pass resolved no mask, or the black one
          gl.uniform3fv(P.emitMesh.uEmissionColor, sm._evEmisWhite ? this._white : f.windowEmission);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, emis);
          gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
          this.stats.emitDraws++;
        }
      } else if (r.kind === 2) {
        for (const b of r.batches) {
          if (!b?.vao || b._dead || b.conceal) continue;
          const key = b._bbKey ?? (b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`);
          const emis = f.emissionTextures.get(key);
          const tex = f.textures.get(key);
          if (!emis || !tex) continue;
          if (bound !== P.emitBb) {
            bound = P.emitBb; gl.useProgram(bound.p);
            gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView);
            gl.uniform1i(bound.uTex, 0); gl.uniform1i(bound.uEmissionTex, 1);
            gl.uniform4fv(bound.uFlatWind, r.flatWind);
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

  _glares(f) {
    const gl = this.gl, P = this.programs.glare, L = f.pointLights, C = f.pointColors;
    const n = L.length >> 2;
    if (n === 0) return;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.uProj, false, f.proj);
    gl.uniformMatrix4fv(P.uView, false, f.view);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.depth.tex);
    gl.uniform1i(P.uDepth, 0);
    gl.bindVertexArray(this.glareVao);
    for (let i = 0; i < n; i++) {
      const range = L[i * 4 + 3];
      if (!(range > 0)) continue;
      gl.uniform3f(P.uCenter, L[i * 4], L[i * 4 + 1], L[i * 4 + 2]);
      gl.uniform1f(P.uSize, glareSize(range));
      gl.uniform3f(P.uColor, C ? C[i * 3] : 1, C ? C[i * 3 + 1] : 1, C ? C[i * 3 + 2] : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.glares++;
    }
  }

  /** Bind the AO image on its unit and upload the receiver's two uniforms
   *  for one program (`loc`: ao, aoInfo). */
  upload(loc) {
    const gl = this.gl;
    if (!this.targets) return;
    gl.activeTexture(gl.TEXTURE0 + AIR_AO_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.aoBlur.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.ao, AIR_AO_UNIT);
    gl.uniform4fv(loc.aoInfo, this.aoInfo);
    this.uploadAdapt(loc);
  }
  /** EL4: bind the adaptation image on its unit for one program (`loc.adapt`). */
  uploadAdapt(loc) {
    const gl = this.gl;
    if (!this.adapt || !loc?.adapt) return;
    gl.activeTexture(gl.TEXTURE0 + AIR_ADAPT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.adapt[this.adaptIndex].tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.adapt, AIR_ADAPT_UNIT);
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
    // 1. the luminance image and its mean
    quad(P.lum, this.lum);
    gl.bindTexture(gl.TEXTURE_2D, F.tex);
    gl.uniform1i(P.lum.uFrame, 0);
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
