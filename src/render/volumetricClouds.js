// VC3 (2026-09-07): THE VOLUMETRIC CLOUDS.
//
// Mac: "true volumetric clouds that move across the sky, build during
// weather". A raymarched cloud SLAB - a layer of the atmosphere between
// two altitudes, in world metres, over a flat earth that fades into the
// dome's horizon with distance - lit by the sun (or the moon at night)
// with a short light march, shaped by the two noise volumes VC2 made,
// and driven by the SAME numbers the rest of the outdoors already
// keeps: the eased weather row (cover, softness, greyness, the two
// cloud colours), a per-weather PROFILE eased on the same clock, and
// the one wind integral (WIND2's drift), so the clouds build over a
// front's lead as the rain and the wind do, and drift as the ground's
// shadow will (VC4).
//
// NOT PER SCREEN PIXEL. The march writes a SKY-SPACE MAP - an
// equirectangular hemisphere, azimuth across, elevation up - which is
// camera-independent because a cloud is at infinity for translation.
// A stripe of the map is re-marched each frame (a full sweep every
// SWEEP_FRAMES), with a per-texel jitter that is FIXED (a hash of the
// texel, not the clock) so the dithered banding never flickers; the
// composite pass then draws the whole sky with one bilinear sample per
// pixel, blending the map's colour over the dome by its transmittance
// (ONE, SRC_ALPHA: sky * T + cloud). The stars and the sun's disc show
// through the gaps by construction.
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
import { WEATHER_EASE_SECONDS } from './enhancedSky.js';

/** The quality tiers: the map's texels and the march's steps. */
export const QUALITY = Object.freeze({
  lo: Object.freeze({ width: 512, height: 128, steps: 32, light: 4 }),
  default: Object.freeze({ width: 1024, height: 256, steps: 56, light: 5 }),
  hi: Object.freeze({ width: 2048, height: 512, steps: 80, light: 6 }),
});
/** A full sweep of the map takes this many frames. */
export const SWEEP_FRAMES = 8;
/** One unit of the WIND2 drift integral is this many world metres -
 *  1 / 0.0038, the scale the terrain's shadow field has always moved
 *  by, so the sky drifts at the pace the ground was already keeping. */
export const WORLD_PER_DRIFT = 1 / 0.0038;
/** The shape volume tiles every this many metres; the detail volume
 *  every DETAIL_METRES. */
export const SHAPE_METRES = 12000;
export const DETAIL_METRES = 900;
/** Extinction per metre at density 1. */
export const EXTINCTION = 0.006;

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
 *  (enhancedSky.js easeWeather), on the same `dt` the controller
 *  stretches across a front, so the slab rises and thickens at the
 *  pace the cover does. Pure. */
export function easeProfile(from, to, dt, seconds = WEATHER_EASE_SECONDS) {
  if (!from) return { ...to };
  const k = seconds <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / seconds);
  const out = {};
  for (const key of PROFILE_KEYS) out[key] = from[key] + (to[key] - from[key]) * k;
  return out;
}

/** The light the clouds take: the sun while it is up, else the
 *  brighter visible moon (EV5's colour, dimmed), else none. Pure. */
export function cloudLight(state) {
  if (state.sunDir[1] > 0.0) return { dir: state.sunDir, color: state.sun, day: 1 };
  const moons = [state.masser, state.secunda].filter((m) => m && m.dir[1] > 0.02 && m.vis > 0);
  if (moons.length) {
    const m = moons.reduce((a, b) => (a.vis * a.color[0] >= b.vis * b.color[0] ? a : b));
    return { dir: m.dir, color: [m.color[0] * 0.12 * m.vis, m.color[1] * 0.12 * m.vis, m.color[2] * 0.14 * m.vis], day: 0 };
  }
  return { dir: [0, 1, 0], color: [0, 0, 0], day: 0 };
}

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** The march: one texel of the sky map per fragment. */
export const MARCH_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D uShape;
uniform sampler3D uDetail;
uniform vec2 uMapSize;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uHorizonColor;
uniform float uCover;
uniform float uSoft;
uniform float uBase;
uniform float uTop;
uniform float uDensity;
uniform float uDark;
uniform float uFlat;
uniform float uShear;
uniform vec2 uDrift;      // world metres
uniform float uFlash;     // lightning: the whole sky lit for a frame
uniform int uSteps;
uniform int uLightSteps;
out vec4 outColor;
const float PI = 3.14159265;
const float EXT = ${EXTINCTION.toFixed(4)};
const float SHAPE_M = ${SHAPE_METRES.toFixed(1)};
const float DETAIL_M = ${DETAIL_METRES.toFixed(1)};
float remap(float v, float lo, float hi, float nlo, float nhi) { return nlo + (v - lo) / (hi - lo) * (nhi - nlo); }
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// the towers' profile against a stratus lid's, by the weather's flatness
float heightGradient(float h) {
  float towers = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.5, 1.0, h));
  float lid = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.25, 0.5, h));
  return mix(towers, lid, uFlat);
}
float density(vec3 p, float mip) {
  float h = clamp((p.y - uBase) / max(uTop - uBase, 1.0), 0.0, 1.0);
  vec3 q = vec3(p.x + uDrift.x + uShear * (p.y - uBase), p.y, p.z + uDrift.y);
  vec4 s = textureLod(uShape, q / SHAPE_M, mip);
  float lowFbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;
  float base = remap(s.r, -(1.0 - lowFbm), 1.0, 0.0, 1.0) * heightGradient(h);
  // the weather's own variation over the land: the shape's R read as a 2D field, fourteen kilometres a tile
  float variation = textureLod(uShape, vec3(q.x / 14000.0, 0.37, q.z / 14000.0), 0.0).r;
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
  float t0 = uBase / dir.y, t1 = min(uTop / dir.y, 32000.0);
  if (t0 >= t1) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float ds = (t1 - t0) / float(uSteps);
  float t = t0 + ds * hash12(gl_FragCoord.xy);
  float cosTheta = dot(dir, uLightDir);
  float phase = min(mix(hg(cosTheta, 0.55), hg(cosTheta, -0.1), 0.4) * 4.0 * PI, 2.5);   // the average over the sphere is 1; the forward peak capped
  vec3 col = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < 96; i++) {
    if (i >= uSteps) break;
    vec3 p = dir * t;
    float mip = clamp(t / 12000.0, 0.0, 2.0);
    float rho = density(p, mip);
    if (rho > 0.0) {
      float h = clamp((p.y - uBase) / max(uTop - uBase, 1.0), 0.0, 1.0);
      float light = lightMarch(p);
      // the ambient carries the field's own low-frequency structure, so a
      // lid is mottled and an underside is not one flat grey
      float mottle = textureLod(uShape, vec3(p.x + uDrift.x, p.y, p.z + uDrift.y) / (SHAPE_M * 0.5), 1.0).g;
      vec3 ambient = mix(uCloudShade, uCloudLit, h) * (0.75 + 0.5 * mottle) * (1.0 - 0.5 * uDark * (1.0 - h));
      vec3 S = uLightColor * light * phase * 0.7 * (1.0 - 0.8 * uDark) + ambient * (1.0 + uFlash * 3.0);
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

/** The composite: the whole sky, one sample per pixel, over the dome. */
export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uMap;
uniform float uYaw;
uniform float uPitch;
uniform float uTanHalfFov;
uniform float uAspect;
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
  outColor = texture(uMap, uv);
}`;

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

export const MARCH_UNIFORMS = ['uShape', 'uDetail', 'uMapSize', 'uLightDir', 'uLightColor', 'uCloudLit', 'uCloudShade', 'uHorizonColor',
  'uCover', 'uSoft', 'uBase', 'uTop', 'uDensity', 'uDark', 'uFlat', 'uShear', 'uDrift', 'uFlash', 'uSteps', 'uLightSteps'];
export const COMPOSITE_UNIFORMS = ['uMap', 'uYaw', 'uPitch', 'uTanHalfFov', 'uAspect'];

export class VolumetricClouds {
  /** `quality` a QUALITY key; `viewport` the caller's rect to restore
   *  after the noise is generated (a draw path at construction). */
  constructor(gl, quality = 'default', viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]) {
    this.gl = gl;
    this.q = QUALITY[quality] ?? QUALITY.default;
    this.noise = new CloudNoise(gl, viewport);
    this.map = createRenderTarget(gl, this.q.width, this.q.height, { filter: 'LINEAR', wrapS: 'REPEAT', wrapT: 'CLAMP_TO_EDGE' });
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.marchProgram = link(gl, VS, MARCH_FS);
    this.compositeProgram = link(gl, VS, COMPOSITE_FS);
    this.mu = {}; for (const n of MARCH_UNIFORMS) this.mu[n] = gl.getUniformLocation(this.marchProgram, n);
    this.cu = {}; for (const n of COMPOSITE_UNIFORMS) this.cu[n] = gl.getUniformLocation(this.compositeProgram, n);
    this.profile = null;      // the eased profile
    this.weather = null;
    this.state = null;        // the dome's skyState
    this.row = null;          // the eased weather row
    this.drift = [0, 0];
    this.flash = 0;
    this.stripe = 0;
    this.sweeps = 0;          // full sweeps completed (the probe waits for one)
    this.full = true;         // the first update marches the whole map
  }

  /** Per frame, from the controller: the dome's state, the eased row,
   *  the sim's weather word and the (front-stretched) ease dt, the
   *  drift integral, the lightning flash. */
  setState(state, row, weather, easeDt, drift, flash = 0) {
    this.state = state; this.row = row;
    const target = VC_PROFILE[weather] ?? VC_PROFILE.sunny;
    this.profile = (this.weather === null || this.weather === weather) && this.profile ? easeProfile(this.profile, target, easeDt) : easeProfile(this.profile, target, easeDt);
    this.weather = weather;
    this.drift = [drift[0] * WORLD_PER_DRIFT, drift[1] * WORLD_PER_DRIFT];
    this.flash = flash;
  }

  /** DRAW PATH: march this frame's stripe of the map (the whole map on
   *  the first call). `viewport` the caller's rect to restore. */
  update(viewport) {
    if (!this.state || !this.profile) return;
    const gl = this.gl, u = this.mu, q = this.q, s = this.state, r = this.row, p = this.profile;
    const light = cloudLight(s);
    const rows = this.full ? q.height : Math.ceil(q.height / SWEEP_FRAMES);
    const y0 = this.full ? 0 : this.stripe * rows;
    gl.useProgram(this.marchProgram);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, this.noise.shape.tex); gl.uniform1i(u.uShape, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.noise.detail.tex); gl.uniform1i(u.uDetail, 1);
    gl.uniform2f(u.uMapSize, q.width, q.height);
    gl.uniform3fv(u.uLightDir, light.dir); gl.uniform3fv(u.uLightColor, light.color);
    gl.uniform3fv(u.uCloudLit, s.cloudLit); gl.uniform3fv(u.uCloudShade, s.cloudShade);
    gl.uniform3fv(u.uHorizonColor, s.horizon);
    gl.uniform1f(u.uCover, r.cover); gl.uniform1f(u.uSoft, r.soft);
    gl.uniform1f(u.uBase, p.base); gl.uniform1f(u.uTop, p.top); gl.uniform1f(u.uDensity, p.density);
    gl.uniform1f(u.uDark, p.dark); gl.uniform1f(u.uFlat, p.flat); gl.uniform1f(u.uShear, p.shear);
    gl.uniform2f(u.uDrift, this.drift[0], this.drift[1]);
    gl.uniform1f(u.uFlash, this.flash);
    gl.uniform1i(u.uSteps, q.steps); gl.uniform1i(u.uLightSteps, q.light);
    gl.bindVertexArray(this.vao);
    withTarget(gl, this.map, viewport, () => {
      gl.viewport(0, y0, q.width, Math.min(rows, q.height - y0));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, null);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    if (this.full) { this.full = false; this.sweeps = 1; }
    else {
      this.stripe++;
      if (this.stripe * rows >= q.height) { this.stripe = 0; this.sweeps++; }
    }
  }

  /** DRAW PATH: the composite over the dome. Same contract as the
   *  dome's draw; the host's marker after the sky covers it. */
  draw(yaw, pitch, fovY, aspect) {
    if (this.sweeps === 0) return;
    const gl = this.gl, u = this.cu;
    gl.useProgram(this.compositeProgram);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.SRC_ALPHA);   // sky * T + cloud
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.map.tex); gl.uniform1i(u.uMap, 0);
    gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2)); gl.uniform1f(u.uAspect, aspect);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }
}
