// VC3 (2026-09-07): THE VOLUMETRIC CLOUDS. VC4: AND THEIR SHADOW.
//
// Mac: "true volumetric clouds that move across the sky, build during
// weather... on top of real cloud shadows that reflect on the ground".
// A raymarched cloud SLAB - a layer of the atmosphere between two
// altitudes, in world metres, over a flat earth that fades into the
// dome's horizon with distance - lit by the sun (or the moon at night)
// with a short light march, shaped by the two noise volumes VC2 made,
// and driven by the SAME numbers the rest of the outdoors already
// keeps: the eased weather row (cover, softness, greyness, the two
// cloud colours), a per-weather PROFILE eased on the same clock, and
// the one wind integral (WIND2's drift), so the clouds build over a
// front's lead as the rain and the wind do, and drift as the ground's
// shadow does.
//
// NOT PER SCREEN PIXEL. The march writes a SKY-SPACE MAP - an
// equirectangular hemisphere, azimuth across, elevation up - from the
// camera's own world position (a cloud is at infinity for the camera's
// rotation, not for its travel: a walk of a kilometre moves the bank
// overhead, and the shadow under it). A stripe of the map is
// re-marched each frame (a full sweep every SWEEP_FRAMES), with a
// per-texel jitter that is FIXED (a hash of the texel, not the clock)
// so the dithered banding never flickers; the composite pass then
// draws the whole sky with one bilinear sample per pixel, blending the
// map's colour over the dome by its transmittance (ONE, SRC_ALPHA:
// sky * T + cloud). The stars and the sun's disc show through the gaps
// by construction.
//
// THE SHADOW (VC4) is the SAME FIELD seen from the ground: a world-
// space map, a square of SHADOW_EXTENT metres snapped to the streaming
// world's 819.2-metre pixel grid around the camera, each texel the
// transmittance along the sun's ray from that ground point up through
// the slab - the projection of the bank overhead, not a noise that
// resembles it. THE FLOATING ORIGIN: a recenter shifts every world
// position by whole pixels; the controller hands the shift here
// (offsetOrigin) and both marches sample the field at the ABSOLUTE
// position (uShift, the shifts accumulated), so the clouds stay where
// they were over the land, the shadow square moves with the world and
// its map is kept, not re-marched. When the camera crosses a pixel
// without a recenter (the fixed city), the map is SHIFTED by whole
// texels (a blit) and only the uncovered strip is marched, over the
// next sweep, so a crossing costs no spike. The terrain, the models,
// the characters and the flats sample the map through one shared GLSL
// block (renderer.js CLOUD_SHADOW_GLSL); the sun's disc dims through
// the sky map's own transmittance, so the disc, the light and the
// ground agree because they are one field.
//
// The ray construction in the composite is the dome's own, line for
// line (test/volumetricClouds.test.js pins the two texts against each
// other), so a cloud sits where the dome's sun is.
//
// Behind Enhanced Environments only (the one switch), on the port's own
// dome only (never under the Dynamic Skies mod, whose sky is its own),
// `?clouds=off` the kill switch, `?clouds=lo|hi` the quality doors.

import { createRenderTarget, withTarget } from './renderTarget.js';
import { CloudNoise } from './cloudNoise.js';
import { WEATHER_EASE_MINUTES } from './enhancedSky.js';

/** The streaming world's pixel, in metres (terrainSampler.js TERRAIN_SIZE). */
export const PIXEL_METRES = 819.2;
/** The quality tiers: the sky map's texels, the march's steps, the
 *  shadow map's texels and steps. */
export const QUALITY = Object.freeze({
  lo: Object.freeze({ width: 512, height: 128, steps: 32, light: 4, shadow: 256, shadowSteps: 8 }),
  default: Object.freeze({ width: 1024, height: 256, steps: 56, light: 5, shadow: 512, shadowSteps: 12 }),
  hi: Object.freeze({ width: 2048, height: 512, steps: 80, light: 6, shadow: 1024, shadowSteps: 16 }),
});
/** A full sweep of either map takes this many frames. */
export const SWEEP_FRAMES = 8;
/** One unit of the WIND2 drift integral is this many world metres -
 *  1 / 0.0038, the scale the terrain's shadow field moved by before
 *  VC4, so the sky drifts at the pace the ground was already keeping. */
export const WORLD_PER_DRIFT = 1 / 0.0038;
/** The fields' periods, in whole pixels (the shape volume tiles every
 *  15, the detail every 1, the weather's variation every 16, the
 *  ambient's mottle every 5) - a recenter is answered by uShift, not
 *  by the periods; these keep the shadow square's texel grid exact. */
export const SHAPE_METRES = PIXEL_METRES * 15;
export const DETAIL_METRES = PIXEL_METRES;
export const VARIATION_METRES = PIXEL_METRES * 16;
export const MOTTLE_METRES = PIXEL_METRES * 5;
/** CLK1: the field's COMMON PERIOD - the least common multiple of the
 *  four periods above (15, 1, 16 and 5 pixels: 240), so a position
 *  moved by a whole number of it samples the same cloud. The drift and
 *  the recenter shift are both unbounded integrals (a year of game
 *  time is tens of thousands of kilometres of wind) and the shader
 *  takes them as float32; they are wrapped to this period at upload,
 *  so neither ever outgrows the mantissa. Pinned: every period divides
 *  it. */
export const FIELD_PERIOD_METRES = PIXEL_METRES * 240;
export const wrapField = (v) => v - Math.floor(v / FIELD_PERIOD_METRES) * FIELD_PERIOD_METRES;
/** Extinction per metre at density 1. */
export const EXTINCTION = 0.006;
/** The shadow map's square, in metres: SIXTEEN pixels a side, the
 *  camera's pixel in the middle, so the near edge stands 6144 m out -
 *  past the fog's end at Land View Distance 4 (3200 m) either way.
 *  Sixteen and not twelve: a pixel must be a WHOLE number of the map's
 *  texels at every tier (256/16, 512/16, 1024/16), which the crossing's
 *  texel shift (`_shiftShadowMap`) depends on - twelve left 0.67 of a
 *  texel behind at every crossing. Pinned. */
export const SHADOW_EXTENT = PIXEL_METRES * 16;
/** How much of the sun a full shadow takes (the ambient is never
 *  touched - a cloud dims the sun and leaves the sky's light alone). */
export const SHADOW_AMOUNT = 1.0;

/** Per-weather PROFILE, eased on the weather ease's own clock: the
 *  slab's base and top (metres), how dense the cloud is, how dark
 *  (the storm's underside), how flat (0 towers, 1 a stratus lid),
 *  and how far the tops lead the base per metre of height. */
export const VC_PROFILE = Object.freeze({
  sunny:    Object.freeze({ base: 1400, top: 3200, density: 0.60, dark: 0.00, flat: 0.10, shear: 0.35 }),
  cloudy:   Object.freeze({ base: 1200, top: 3000, density: 0.70, dark: 0.10, flat: 0.35, shear: 0.40 }),
  overcast: Object.freeze({ base: 800,  top: 1600, density: 0.80, dark: 0.30, flat: 0.90, shear: 0.20 }),
  fog:      Object.freeze({ base: 150,  top: 600,  density: 1.00, dark: 0.20, flat: 1.00, shear: 0.05 }),
  rain:     Object.freeze({ base: 600,  top: 2600, density: 0.90, dark: 0.50, flat: 0.70, shear: 0.30 }),
  snow:     Object.freeze({ base: 600,  top: 2000, density: 0.80, dark: 0.30, flat: 0.85, shear: 0.20 }),
  thunder:  Object.freeze({ base: 500,  top: 4200, density: 1.00, dark: 0.70, flat: 0.50, shear: 0.50 }),
});
const PROFILE_KEYS = ['base', 'top', 'density', 'dark', 'flat', 'shear'];

/** The profile's ease - the SAME exponential the weather row takes
 *  (enhancedSky.js easeWeather), on the same `dt` (game minutes, CLK1)
 *  the controller stretches across a front, so the slab rises and
 *  thickens at the pace the cover does. Pure. */
export function easeProfile(from, to, dt, span = WEATHER_EASE_MINUTES) {
  if (!from) return { ...to };
  const k = span <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / span);
  const out = {};
  for (const key of PROFILE_KEYS) out[key] = from[key] + (to[key] - from[key]) * k;
  return out;
}

/** The light the clouds take: the sun while it is up, else the
 *  brighter visible moon (EV5's colour, dimmed), else none. Pure. */
export function cloudLight(state) {
  // the sun's weight fades over its last degrees, so the light crosses
  // to the moon's (or to none) without a pop at the horizon
  const w = Math.min(1, Math.max(0, (state.sunDir[1] + 0.02) / 0.08));
  const moons = [state.masser, state.secunda].filter((m) => m && m.dir[1] > 0.02 && m.vis > 0);
  const m = moons.length ? moons.reduce((a, b) => (a.vis * a.color[0] >= b.vis * b.color[0] ? a : b)) : null;
  const moon = m ? [m.color[0] * 0.12 * m.vis, m.color[1] * 0.12 * m.vis, m.color[2] * 0.14 * m.vis] : [0, 0, 0];
  if (w > 0) return { dir: state.sunDir, color: [state.sun[0] * w + moon[0] * (1 - w), state.sun[1] * w + moon[1] * (1 - w), state.sun[2] * w + moon[2] * (1 - w)], day: w };
  return { dir: m ? m.dir : [0, 1, 0], color: moon, day: 0 };
}

/** VC4: the shadow map's square for a camera at (x, z): its corner,
 *  snapped to the pixel grid with the camera's pixel in the middle.
 *  Pure - the seam that keeps a recenter from moving the map. */
export function shadowOrigin(camX, camZ, extent = SHADOW_EXTENT, pixel = PIXEL_METRES) {
  return [Math.floor(camX / pixel) * pixel - extent / 2 + pixel / 2, Math.floor(camZ / pixel) * pixel - extent / 2 + pixel / 2];
}

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 1.0, 1.0); }`;   // PERF2: at the far plane for the composite's depth test; the marches test nothing

/** THE FIELD: the density at a world point, and everything both
 *  marches share. Declared with its own uniforms and interpolated into
 *  each march's template (the AUDIT 47 sweep expands it there). */
export const CLOUD_FIELD_GLSL = `
uniform sampler3D uShape;
uniform sampler3D uDetail;
uniform float uCover;
uniform float uSoft;
uniform float uBase;
uniform float uTop;
uniform float uDensity;
uniform float uFlat;
uniform float uShear;
uniform vec2 uDrift;      // world metres
uniform vec2 uShift;      // the floating origin's recenters, accumulated - added to every position so the field is sampled where it ABSOLUTELY is
uniform vec2 uCamXZ;      // the camera's world position, the sky map's own origin
const float EXT = ${EXTINCTION.toFixed(4)};
const float SHAPE_M = ${SHAPE_METRES.toFixed(1)};
const float DETAIL_M = ${DETAIL_METRES.toFixed(1)};
const float VARIATION_M = ${VARIATION_METRES.toFixed(1)};
const float MOTTLE_M = ${MOTTLE_METRES.toFixed(1)};
float remap(float v, float lo, float hi, float nlo, float nhi) { return nlo + (v - lo) / (hi - lo) * (nhi - nlo); }
// the towers' profile against a stratus lid's, by the weather's flatness
float heightGradient(float h) {
  float towers = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.5, 1.0, h));
  float lid = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.25, 0.5, h));
  return mix(towers, lid, uFlat);
}
float density(vec3 p, float mip) {
  float h = clamp((p.y - uBase) / max(uTop - uBase, 1.0), 0.0, 1.0);
  vec3 q = vec3(p.x + uShift.x + uDrift.x + uShear * (p.y - uBase), p.y, p.z + uShift.y + uDrift.y);
  vec4 s = textureLod(uShape, q / SHAPE_M, mip);
  float lowFbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;
  float base = remap(s.r, -(1.0 - lowFbm), 1.0, 0.0, 1.0) * heightGradient(h);
  // the weather's own variation over the land: the shape's R read as a 2D field
  float variation = textureLod(uShape, vec3(q.x / VARIATION_M, 0.37, q.z / VARIATION_M), 0.0).r;
  // the row's cover is the dome's deck's word; the slab's coverage is
  // sharper - a sunny 0.32 is a scattered sky, an overcast 0.94 a lid
  float coverage = clamp(pow(uCover, 1.6) * (0.6 + 0.8 * variation), 0.0, 1.0);
  base = remap(base, 1.0 - coverage, 1.0, 0.0, 1.0);
  if (base <= 0.0) return 0.0;
  vec4 d = textureLod(uDetail, q / DETAIL_M, mip);
  float dfbm = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;
  float erode = mix(dfbm, 1.0 - dfbm, clamp(h * 10.0, 0.0, 1.0));
  base = remap(base, erode * (0.15 + 0.35 * uSoft), 1.0, 0.0, 1.0);
  return clamp(base, 0.0, 1.0) * uDensity;
}
`;

/** The march: one texel of the sky map per fragment. */
export const MARCH_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uMapSize;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uHorizonColor;
uniform float uDark;
uniform int uSteps;
uniform int uLightSteps;
out vec4 outColor;
const float PI = 3.14159265;
${CLOUD_FIELD_GLSL}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// toward the light: a short march, Beer's law with the powder term
float lightMarch(vec3 p) {
  float sum = 0.0;
  float ds = (uTop - uBase) / float(uLightSteps) * 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= uLightSteps) break;
    float step = ds * (1.0 + float(i) * 0.6);
    p += uLightDir * step;
    sum += density(p, 0.0) * step;   // the field itself, not a blurred level - a blurred one never occludes
  }
  float beer = exp(-sum * EXT);
  float powder = 1.0 - exp(-sum * EXT * 2.0);
  return beer * mix(1.0, powder, 0.4);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uMapSize;
  float az = uv.x * 2.0 * PI, el = uv.y * 0.5 * PI;
  vec3 dir = vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el));
  if (dir.y <= 0.004) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // the march covers the slab, or the first 24 km of it at a grazing
  // angle - the aerial fade takes the rest, so the deck reaches the
  // horizon instead of stopping short of it in a rim of bare dome
  float t0 = uBase / dir.y, t1 = min(uTop / dir.y, t0 + 24000.0);
  if (t0 > 120000.0) { outColor = vec4(uHorizonColor, 0.0); return; }
  float ds = (t1 - t0) / float(uSteps);
  float t = t0 + ds * hash12(gl_FragCoord.xy);
  float cosTheta = dot(dir, uLightDir);
  float phase = min(mix(hg(cosTheta, 0.55), hg(cosTheta, -0.1), 0.4) * 4.0 * PI, 2.5);   // the average over the sphere is 1; the forward peak capped
  vec3 cam = vec3(uCamXZ.x, 0.0, uCamXZ.y);
  vec3 col = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < 96; i++) {
    if (i >= uSteps) break;
    vec3 p = cam + dir * t;
    float mip = clamp(t / 12000.0, 0.0, 2.0);
    float rho = density(p, mip);
    if (rho > 0.0) {
      float h = clamp((p.y - uBase) / max(uTop - uBase, 1.0), 0.0, 1.0);
      float light = lightMarch(p);
      // the ambient carries the field's own low-frequency structure, so a
      // lid is mottled and an underside is not one flat grey
      float mottle = textureLod(uShape, vec3(p.x + uShift.x + uDrift.x, p.y, p.z + uShift.y + uDrift.y) / MOTTLE_M, 1.0).g;
      vec3 ambient = mix(uCloudShade, uCloudLit, h) * (0.75 + 0.5 * mottle) * (1.0 - 0.5 * uDark * (1.0 - h));
      vec3 S = uLightColor * light * phase * 0.7 * (1.0 - 0.8 * uDark) + ambient;
      float Ti = exp(-rho * EXT * ds);
      col += T * S * (1.0 - Ti);
      T *= Ti;
      if (T < 0.01) break;
    }
    t += ds;
  }
  // aerial perspective: a far bank takes the horizon's colour
  float fade = 1.0 - exp(-t0 / 14000.0);
  col = mix(col, uHorizonColor * (1.0 - T), fade);
  outColor = vec4(col, T);
}`;

/** VC4: the shadow map - one ground texel per fragment, the
 *  transmittance along the sun's ray up through the slab. */
export const SHADOW_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uMapSize;
uniform vec2 uOrigin;      // the square's corner, world metres
uniform float uExtent;     // its side
uniform vec3 uLightDir;
uniform int uSteps;
out vec4 outColor;
${CLOUD_FIELD_GLSL}
void main() {
  if (uLightDir.y <= 0.05) { outColor = vec4(1.0); return; }   // no sun to shadow: the moon casts none
  vec2 g = uOrigin + gl_FragCoord.xy / uMapSize * uExtent;
  float t0 = uBase / uLightDir.y, t1 = uTop / uLightDir.y;
  // the steps follow the path: a low sun's long slant is sampled no
  // coarser than 150 m, the tier's count the floor, 24 the ceiling
  int steps = min(24, max(uSteps, int(ceil((t1 - t0) / 150.0))));
  float ds = (t1 - t0) / float(steps);
  float t = t0 + ds * 0.5;
  float sum = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= steps) break;
    vec3 p = vec3(g.x, 0.0, g.y) + uLightDir * t;
    sum += density(p, 0.5) * ds;
    t += ds;
  }
  float T = exp(-sum * EXT);
  outColor = vec4(T, T, T, 1.0);
}`;

/** The composite: the whole sky, one sample per pixel, over the dome. */
export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uMap;
uniform float uYaw;
uniform float uPitch;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uFlash;     // lightning: the WHOLE sky lit for the frame (the march writes one stripe a frame; the flash cannot ride it)
out vec4 outColor;
const float PI = 3.14159265;
void main() {
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 dir = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));
  float el = asin(clamp(dir.y, -1.0, 1.0));
  if (el <= 0.0) discard;
  float az = atan(dir.x, dir.z);
  vec2 uv = vec2(az / (2.0 * PI), el / (0.5 * PI));
  vec4 c = texture(uMap, uv);
  outColor = vec4(c.rgb * (1.0 + uFlash * 2.0), c.a);
}`;

/** The lab's shadow-map viewer: the square as a picture. */
export const SHADOW_VIEW_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uMap;
out vec4 outColor;
void main() { outColor = vec4(texture(uMap, vNdc * 0.5 + 0.5).rrr, 1.0); }`;

function link(gl, vs, fs) {
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

/** The field's uniforms, shared by both marches. */
export const FIELD_UNIFORMS = ['uShape', 'uDetail', 'uCover', 'uSoft', 'uBase', 'uTop', 'uDensity', 'uFlat', 'uShear', 'uDrift', 'uShift', 'uCamXZ'];
export const MARCH_UNIFORMS = [...FIELD_UNIFORMS, 'uMapSize', 'uLightDir', 'uLightColor', 'uCloudLit', 'uCloudShade', 'uHorizonColor', 'uDark', 'uSteps', 'uLightSteps'];
export const SHADOW_UNIFORMS = [...FIELD_UNIFORMS, 'uMapSize', 'uOrigin', 'uExtent', 'uLightDir', 'uSteps'];
export const COMPOSITE_UNIFORMS = ['uMap', 'uYaw', 'uPitch', 'uTanHalfFov', 'uAspect', 'uFlash'];

export class VolumetricClouds {
  /** `quality` a QUALITY key; `viewport` the caller's rect to restore
   *  after the noise is generated (a draw path at construction). */
  constructor(gl, quality = 'default', viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]) {
    this.gl = gl;
    this.q = QUALITY[quality] ?? QUALITY.default;
    this.noise = new CloudNoise(gl, viewport);
    this.map = createRenderTarget(gl, this.q.width, this.q.height, { filter: 'LINEAR', wrapS: 'REPEAT', wrapT: 'CLAMP_TO_EDGE' });
    // both shadow targets are born ALL LIGHT (T = 1): nothing samples an
    // unmarched texel as shadow, and nothing CLEARS (the renderer keeps a
    // JS shadow of the clear colour that a clear here would make a lie)
    this.white = new Uint8Array(this.q.shadow * this.q.shadow * 4).fill(255);
    this.shadowMap = createRenderTarget(gl, this.q.shadow, this.q.shadow, { filter: 'LINEAR', wrap: 'CLAMP_TO_EDGE', data: this.white });
    this.shadowScratch = createRenderTarget(gl, this.q.shadow, this.q.shadow, { filter: 'LINEAR', wrap: 'CLAMP_TO_EDGE', data: this.white });
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.marchProgram = link(gl, VS, MARCH_FS);
    this.shadowProgram = link(gl, VS, SHADOW_FS);
    this.compositeProgram = link(gl, VS, COMPOSITE_FS);
    this.viewProgram = link(gl, VS, SHADOW_VIEW_FS);
    this.mu = {}; for (const n of MARCH_UNIFORMS) this.mu[n] = gl.getUniformLocation(this.marchProgram, n);
    this.su = {}; for (const n of SHADOW_UNIFORMS) this.su[n] = gl.getUniformLocation(this.shadowProgram, n);
    this.cu = {}; for (const n of COMPOSITE_UNIFORMS) this.cu[n] = gl.getUniformLocation(this.compositeProgram, n);
    this.vu = { uMap: gl.getUniformLocation(this.viewProgram, 'uMap') };
    this.profile = null;      // the eased profile
    this.weather = null;
    this.state = null;        // the dome's skyState
    this.row = null;          // the eased weather row
    this.drift = [0, 0];
    this.shift = [0, 0];      // the floating origin's recenters, accumulated (metres)
    this.cam = [0, 0];        // the camera's world XZ
    this.flash = 0;
    this.stripe = 0;
    this.sweeps = 0;          // full sweeps of the sky map completed (the probe waits for one); the first is striped like every other - no stall
    this.origin = null;       // the shadow square's corner the camera asks for
    this.mapOrigin = null;    // the corner the map HOLDS - the deck's rect (the two differ for the frame between a crossing and its blit)
    this.shadowStripe = 0;
    this.shadowFull = true;   // the first march of the shadow map is whole (a quarter of a sky sweep)
    this.shadowMarched = false;
    this.pendingShift = null; // a pixel crossing's texel shift, applied on the next update (a draw path)
  }

  /** The host's recenter: every world position moved by `offset`; the
   *  field is sampled at the absolute position, so the shift is
   *  accumulated here, and the shadow square moves with the world - its
   *  map is the same land, kept. */
  offsetOrigin(offset) {
    this.shift[0] -= offset[0]; this.shift[1] -= offset[2];
    this.cam[0] += offset[0]; this.cam[1] += offset[2];
    if (this.origin) { this.origin[0] += offset[0]; this.origin[1] += offset[2]; }
    if (this.mapOrigin) { this.mapOrigin[0] += offset[0]; this.mapOrigin[1] += offset[2]; }
  }

  /** Per frame, from the controller: the dome's state, the eased row,
   *  the sim's weather word and the (front-stretched) ease dt, the
   *  drift integral, the lightning flash, the camera's world position. */
  setState(state, row, weather, easeDt, drift, flash = 0, pos = null) {
    this.state = state; this.row = row;
    const target = VC_PROFILE[weather] ?? VC_PROFILE.sunny;
    this.profile = easeProfile(this.profile, target, easeDt);
    this.weather = weather;
    this.drift = [wrapField(drift[0] * WORLD_PER_DRIFT), wrapField(drift[1] * WORLD_PER_DRIFT)];   // CLK1: wrapped to the field's period
    this.flash = flash;
    if (pos) { this.cam[0] = pos[0]; this.cam[1] = pos[2]; }
    const o = shadowOrigin(this.cam[0], this.cam[1]);
    if (!this.origin) { this.origin = o; this.mapOrigin = [o[0], o[1]]; this.shadowFull = true; }
    else if (Math.abs(o[0] - this.origin[0]) > 1e-3 || Math.abs(o[1] - this.origin[1]) > 1e-3) {
      // the camera crossed a pixel: the square moves by whole texels;
      // the map is shifted on the next update and the new strip marched
      const texel = SHADOW_EXTENT / this.q.shadow;
      const dx = Math.round((o[0] - this.origin[0]) / texel), dz = Math.round((o[1] - this.origin[1]) / texel);
      this.pendingShift = [(this.pendingShift?.[0] ?? 0) + dx, (this.pendingShift?.[1] ?? 0) + dz];
      this.origin = o;
    }
  }

  /** DRAW PATH: move the shadow map by whole texels (a blit into the
   *  scratch target, the uncovered strips left all light), so a pixel
   *  crossing keeps the land it already marched. */
  _shiftShadowMap(dx, dz, viewport) {
    const gl = this.gl, n = this.q.shadow;
    if (Math.abs(dx) >= n || Math.abs(dz) >= n) { this.shadowFull = true; this.pendingShift = null; return; }
    const dst = this.shadowScratch, src = this.shadowMap;
    withTarget(gl, dst, viewport, () => {});   // attached, if it never was
    // the strips the blit will not cover are re-filled ALL LIGHT by upload
    gl.bindTexture(gl.TEXTURE_2D, dst.tex);
    if (dx !== 0) gl.texSubImage2D(gl.TEXTURE_2D, 0, dx > 0 ? n - dx : 0, 0, Math.abs(dx), n, gl.RGBA, gl.UNSIGNED_BYTE, this.white.subarray(0, Math.abs(dx) * n * 4));
    if (dz !== 0) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, dz > 0 ? n - dz : 0, n, Math.abs(dz), gl.RGBA, gl.UNSIGNED_BYTE, this.white.subarray(0, Math.abs(dz) * n * 4));
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.fbo);
    // old texel (i, j) is new texel (i - dx, j - dz)
    const sx0 = Math.max(0, dx), sx1 = Math.min(n, n + dx), sy0 = Math.max(0, dz), sy1 = Math.min(n, n + dz);
    gl.blitFramebuffer(sx0, sy0, sx1, sy1, sx0 - dx, sy0 - dz, sx1 - dx, sy1 - dz, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    this.shadowMap = dst; this.shadowScratch = src;
    this.mapOrigin = [this.origin[0], this.origin[1]];
    this.pendingShift = null;
  }

  /** A weather JUMP (a load, a travel landing): the profile is dropped
   *  so the next setState takes the new weather whole, as the row does,
   *  and both maps are marched whole again - the old sky is not eased
   *  into the new one. */
  jump() { this.profile = null; this.stripe = 0; this.shadowFull = true; }

  /** VC4: what the ground samples - the map and its square, for the
   *  deck the controller hands the renderer. */
  get shadow() {
    if (!this.mapOrigin || !this.shadowMarched) return null;
    return { map: this.shadowMap.tex, rect: [this.mapOrigin[0], this.mapOrigin[1], 1 / SHADOW_EXTENT, SHADOW_AMOUNT] };
  }

  _fieldUniforms(u) {
    const gl = this.gl, r = this.row, p = this.profile;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, this.noise.shape.tex); gl.uniform1i(u.uShape, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.noise.detail.tex); gl.uniform1i(u.uDetail, 1);
    gl.uniform1f(u.uCover, r.cover); gl.uniform1f(u.uSoft, r.soft);
    gl.uniform1f(u.uBase, p.base); gl.uniform1f(u.uTop, p.top); gl.uniform1f(u.uDensity, p.density);
    gl.uniform1f(u.uFlat, p.flat); gl.uniform1f(u.uShear, p.shear);
    gl.uniform2f(u.uDrift, this.drift[0], this.drift[1]);
    gl.uniform2f(u.uShift, wrapField(this.shift[0]), wrapField(this.shift[1]));   // CLK1: wrapped to the field's period
    gl.uniform2f(u.uCamXZ, this.cam[0], this.cam[1]);
  }

  /** DRAW PATH: march this frame's stripe of the sky map and of the
   *  shadow map (both whole on the first call, the shadow map whole
   *  again whenever its square moves). `viewport` the caller's rect. */
  update(viewport) {
    if (!this.state || !this.profile) return;
    const gl = this.gl, q = this.q, s = this.state, p = this.profile;
    const light = cloudLight(s);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    if (this.pendingShift) this._shiftShadowMap(this.pendingShift[0], this.pendingShift[1], viewport);
    // the sky map, a stripe at a time from the first frame on
    {
      const u = this.mu;
      const rows = Math.ceil(q.height / SWEEP_FRAMES);
      const y0 = this.stripe * rows;
      gl.useProgram(this.marchProgram);
      this._fieldUniforms(u);
      gl.uniform2f(u.uMapSize, q.width, q.height);
      gl.uniform3fv(u.uLightDir, light.dir); gl.uniform3fv(u.uLightColor, light.color);
      gl.uniform3fv(u.uCloudLit, s.cloudLit); gl.uniform3fv(u.uCloudShade, s.cloudShade);
      gl.uniform3fv(u.uHorizonColor, s.horizon);
      gl.uniform1f(u.uDark, p.dark);
      gl.uniform1i(u.uSteps, q.steps); gl.uniform1i(u.uLightSteps, q.light);
      withTarget(gl, this.map, viewport, () => {
        gl.viewport(0, y0, q.width, Math.min(rows, q.height - y0));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
      this.stripe++;
      if (this.stripe * rows >= q.height) { this.stripe = 0; this.sweeps++; }
    }
    // the shadow map (VC4)
    {
      const u = this.su;
      const rows = this.shadowFull ? q.shadow : Math.ceil(q.shadow / SWEEP_FRAMES);
      const y0 = this.shadowFull ? 0 : this.shadowStripe * rows;
      gl.useProgram(this.shadowProgram);
      this._fieldUniforms(u);
      gl.uniform2f(u.uMapSize, q.shadow, q.shadow);
      gl.uniform2f(u.uOrigin, this.origin[0], this.origin[1]);
      gl.uniform1f(u.uExtent, SHADOW_EXTENT);
      gl.uniform3fv(u.uLightDir, s.sunDir);   // the SUN's: the moon casts none
      gl.uniform1i(u.uSteps, q.shadowSteps);
      withTarget(gl, this.shadowMap, viewport, () => {
        gl.viewport(0, y0, q.shadow, Math.min(rows, q.shadow - y0));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
      if (this.shadowFull) { this.shadowFull = false; this.shadowMarched = true; this.mapOrigin = [this.origin[0], this.origin[1]]; }
      else {
        this.shadowStripe++;
        if (this.shadowStripe * rows >= q.shadow) this.shadowStripe = 0;
      }
    }
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, null);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }

  /** DRAW PATH: the composite over the dome. Same contract as the
   *  dome's draw; the host's marker after the sky covers it. */
  draw(yaw, pitch, fovY, aspect) {
    if (this.sweeps === 0) return;
    const gl = this.gl, u = this.cu;
    gl.useProgram(this.compositeProgram);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.disable(gl.CULL_FACE);   // PERF2: only the sky's own pixels
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.SRC_ALPHA, gl.ZERO, gl.ONE);   // sky * T + cloud; the buffer's alpha untouched (ONE, SRC_ALPHA on both would leave it 2T)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.map.tex); gl.uniform1i(u.uMap, 0);
    gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uFlash, this.flash);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.depthFunc(gl.LESS); gl.depthMask(true); gl.enable(gl.CULL_FACE);   // PERF2
  }

  /** DRAW PATH, the lab's: the shadow map as a picture over the frame. */
  drawShadowView() {
    if (!this.origin) return;
    const gl = this.gl;
    gl.useProgram(this.viewProgram);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowMap.tex); gl.uniform1i(this.vu.uMap, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }
}
