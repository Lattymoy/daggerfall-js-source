// @ts-check
// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): the aurora's pass, over the enhanced lane's sky and under its
// clouds (scenes/shared.js createSkyController draw). Its curtains are vertical sheets running east-west, hung north of
// the eye; each ray is marched up through them from their lower hem, each sample widened by its step, fine detail faded
// where a texel spans it. The march draws into a map at a share of the world image, and one triangle at the far plane
// ADDS it to the sky (one, one): the stars show through, the land stands over it. Every few frames a small dome map is
// marched by direction too, for the water to reflect. Page-lifetime, as the sky's other passes.
import { buildProgram } from './glProgram.js';
import { createRenderTarget, withTarget } from './renderTarget.js';
import { wrapAngle } from '../world/mat4.js';

/** By the clouds' quality tier (render/volumetricClouds.js QUALITY): the march's steps, and its map's share of the world
 *  image's width and height. */
export const AURORA_QUALITY = Object.freeze({
  lo: Object.freeze({ steps: 6, scale: 0.5 }),
  default: Object.freeze({ steps: 10, scale: 0.5 }),
  hi: Object.freeze({ steps: 12, scale: 0.75 }),
});
export const AURORA_MAX_STEPS = 16;
/** The curtains' depth above the hem, and the arcs' spacing north to south, in hem heights. */
export const AURORA_DEPTH = 1.5;
export const AURORA_ARC_GAP = 1.3;
/** Each arc's waves: [amplitude, radians a hem height, radians a second] - a second of the sky's walk clock (a game minute
 *  is five, render/enhancedSky.js WIND_SECONDS_PER_MINUTE). */
export const AURORA_WAVES = Object.freeze([
  Object.freeze([0.55, 0.62, 0.035]),
  Object.freeze([0.3, 1.37, -0.05]),
  Object.freeze([0.35, 2.9, 0.07]),
]);
/** The swell along an arc and the hem's rise and fall (radians a second), and the rays' drift (noise rows a second). */
export const AURORA_RATES = Object.freeze({ swell: -0.06, hem: 0.02, rays: 0.16 });
/** The rays' noise repeats every this many rows, so their clock wraps there without a seam; each arc's row is this far on. */
export const AURORA_RAY_ROWS = 256;
export const AURORA_ARC_ROW = 5.3;
/** The sheet's and the glow's own widths, as variances in hem heights squared: exp(-12 a^2) and exp(-2.5 a^2). */
export const AURORA_SHEET_VAR = 1 / 24;
export const AURORA_GLOW_VAR = 1 / 5;
/** How far past its centre an arc's waves and glow reach, hem heights: a march wholly past every arc draws nothing. */
export const AURORA_REACH = AURORA_WAVES.reduce((s, w) => s + w[0], 0) + 1.4;
/** The colours, display-encoded: the hem's green, the crown's teal-blue, the glow round both. */
export const AURORA_HEM = Object.freeze([0.25, 1.0, 0.55]);
export const AURORA_CROWN = Object.freeze([0.1, 0.6, 0.9]);
export const AURORA_GLOW = Object.freeze([0.08, 0.25, 0.85]);
/** THE LAND'S LIGHT: the ambient a full aurora adds to the land's, the water's body's and the night air's (scenes/auroraHost.js
 *  withAuroraLight, through the sky's moonlight term) - a green lift a fifth of the night's own 0.25. */
export const AURORA_LIGHT = Object.freeze([0.012, 0.06, 0.042]);
/** The light at a full weight, the brightest it rolls off toward, and the most the horizon's long path lifts it. */
export const AURORA_GAIN = 0.42;
export const AURORA_PEAK = 0.95;
export const AURORA_HORIZON_LIFT = 1.5;

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(+x.toFixed(6)));
const v3 = (c) => `vec3(${c.map(f).join(', ')})`;
const TAU = 2 * Math.PI;

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 1.0, 1.0); }`;

const [W0, W1, W2] = AURORA_WAVES;
// The march along one direction (x east, y up, z north), shared by the screen's map and the dome's: the aurora's light
// there, 0 where it is dark. pix: the radians a texel spans.
const AURORA_ALONG = `precision highp float;
in vec2 vNdc;
uniform float uWeight;   // 0..1, the frame's aurora (scenes/auroraHost.js)
uniform float uHang;     // how far north of the eye the middle arc hangs, in hem heights
uniform vec3 uWave;      // the three waves' phases, radians (the clock's, wrapped on the CPU)
uniform vec2 uDrift;     // the swell's and the hem's phases, radians
uniform vec3 uRayLo, uRayHi, uRayF;   // each arc's rays' noise rows (wrapped) and the blend between them
uniform float uPixel;    // radians a texel of the map spans
uniform float uSteps;    // the march's steps (the quality tier's)

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// value noise along one row of the lattice
float rowNoise(float x, float row) {
  float i = floor(x), u = fract(x);
  return mix(hash12(vec2(i, row)), hash12(vec2(i + 1.0, row)), u * u * (3.0 - 2.0 * u));
}
// One arc at Q (x east, y north, hem heights): its thin sheet with its rays, and the wide glow about it. inv and amp are
// the widened sheet's and glow's (the step's own span added, their light kept); lodR and lodW fade the rays and the
// finest wave where a texel spans them.
vec2 arcAt(vec2 Q, float k, float rowLo, float rowHi, float rowF, vec4 inv, float lodR, float lodW) {
  float x = Q.x;
  float wave = ${f(W0[0])} * sin(x * ${f(W0[1])} + uWave.x + k * 2.1) + ${f(W1[0])} * sin(x * ${f(W1[1])} + uWave.y + k * 4.7)
    + ${f(W2[0])} * (1.0 - lodW) * sin(x * ${f(W2[1])} + uWave.z + k * 1.3);
  float across = Q.y - (uHang + (k - 1.0) * ${f(AURORA_ARC_GAP)}) - wave;
  float a2 = across * across;
  float swell = 0.55 + 0.45 * sin(x * 0.9 + uDrift.x + k * 1.7);
  float es = a2 * inv.x, sheet = 0.0;
  if (es < 7.6) {   // the rays' noise only where the sheet is lit (exp(-7.6) is under 1/2000)
    float rx = x * 7.0 + wave * 3.0;
    float rays = 0.25 + 0.75 * smoothstep(0.2, 0.8, mix(rowNoise(rx, rowLo), rowNoise(rx, rowHi), rowF));
    sheet = exp(-es) * inv.y * mix(rays, 0.625, lodR);
  }
  return vec2(sheet, exp(-a2 * inv.z) * inv.w) * swell;
}
vec3 auroraAlong(vec3 dir) {
  if (dir.y <= 0.0) return vec3(0.0);   // the ground's texels cost nothing
  float up = max(dir.y, 0.035);
  vec2 q0 = dir.xz / up;   // where the ray crosses the hem's height
  // what a texel spans on the hem's plane, hem heights - steepest at the horizon - against each detail's frequency
  float span = uPixel / (up * up) * 1.75;
  float lodR = smoothstep(0.25, 0.6, span * 7.0 / 6.2832), lodW = smoothstep(0.25, 0.6, span * ${f(W2[1])} / 6.2832);
  float lodH = smoothstep(0.25, 0.6, span * 1.7 / 6.2832);
  float hemH = 1.0 + 0.22 * sin(q0.x * 0.8 + uDrift.y) + 0.3 * (1.0 - lodH) * (rowNoise(q0.x * 1.7, 3.0) - 0.5);   // a hem that rises and falls
  // the march's reach north and south; a ray that passes every arc's waves and glow by far is dark
  float yLo = min(q0.y * hemH, q0.y * (hemH + ${f(AURORA_DEPTH)})), yHi = max(q0.y * hemH, q0.y * (hemH + ${f(AURORA_DEPTH)}));
  if (yHi < uHang - ${f(AURORA_ARC_GAP + AURORA_REACH)} || yLo > uHang + ${f(AURORA_ARC_GAP + AURORA_REACH)}) return vec3(0.0);
  float jitter = hash12(gl_FragCoord.xy);
  float step2 = length(q0) * ${f(AURORA_DEPTH)} / uSteps;
  float sVar = ${f(AURORA_SHEET_VAR)} + step2 * step2 / 12.0, gVar = ${f(AURORA_GLOW_VAR)} + step2 * step2 / 12.0;
  vec4 inv = vec4(0.5 / sVar, sqrt(${f(AURORA_SHEET_VAR)} / sVar), 0.5 / gVar, sqrt(${f(AURORA_GLOW_VAR)} / gVar));
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${AURORA_MAX_STEPS}; i++) {
    if (float(i) >= uSteps) break;
    float hn = (float(i) + jitter) / uSteps;
    vec2 Q = q0 * (hemH + ${f(AURORA_DEPTH)} * hn);
    vec2 s = 0.7 * arcAt(Q, 0.0, uRayLo.x, uRayHi.x, uRayF.x, inv, lodR, lodW) + arcAt(Q, 1.0, uRayLo.y, uRayHi.y, uRayF.y, inv, lodR, lodW)
      + 0.55 * arcAt(Q, 2.0, uRayLo.z, uRayHi.z, uRayF.z, inv, lodR, lodW);
    float hem = smoothstep(0.0, 0.06 + 1.0 / uSteps, hn) * exp(-hn * 2.4);   // brightest at the lower hem, thinning upward - its edge a step wide at least
    col += (mix(${v3(AURORA_HEM)}, ${v3(AURORA_CROWN)}, smoothstep(0.2, 0.85, hn)) * s.x + ${v3(AURORA_GLOW)} * 0.12 * s.y) * hem;
  }
  // a longer path through the sheets near the horizon, lifted at most ${AURORA_HORIZON_LIFT}x and fading into its haze in the
  // last seven degrees
  col *= ${f(AURORA_GAIN)} * 12.0 / uSteps * uWeight * min(inversesqrt(up), ${f(AURORA_HORIZON_LIFT)}) * smoothstep(0.01, 0.12, dir.y);
  float m = max(col.g, col.b);   // a soft knee to the brightest, so a corona overhead never clips flat
  col *= m > 1e-5 ? ${f(AURORA_PEAK)} * (1.0 - exp(-m / ${f(AURORA_PEAK)})) / m : 1.0;
  col += (jitter - 0.5) / 255.0 * step(0.004, col.g + col.b);   // no bands in the dark sky's few levels
  return max(col, 0.0);
}`;

/** The march for the screen, into the map at the world image's share: every texel written, nothing blended. */
export const AURORA_FS = `#version 300 es
${AURORA_ALONG}
uniform float uYaw, uPitch, uTanHalfFov, uAspect;
out vec4 outColor;
void main() {
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  outColor = vec4(auroraAlong(normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy))), 1.0);
}`;

/** The march by direction, into the dome map the water reflects (render/waterSurface.js AURORA_DOME_UV_GLSL reads it): a
 *  texel's azimuth across, its height up. */
export const AURORA_DOME_FS = `#version 300 es
${AURORA_ALONG}
out vec4 outColor;
void main() {
  vec2 uv = vNdc * 0.5 + 0.5;
  float az = (uv.x - 0.5) * 6.2831853, y = uv.y, c = sqrt(max(0.0, 1.0 - y * y));
  outColor = vec4(auroraAlong(vec3(sin(az) * c, y, cos(az) * c)), 1.0);
}`;

/** The map ADDED to the sky at the far plane. */
export const AURORA_ADD_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uMap;
out vec4 outColor;
void main() { outColor = vec4(texture(uMap, vNdc * 0.5 + 0.5).rgb, 0.0); }`;

/** The march's uniforms, both programs': the screen's camera besides. */
export const AURORA_ALONG_UNIFORMS = Object.freeze([
  'uWeight',
  'uHang',
  'uWave',
  'uDrift',
  'uRayLo',
  'uRayHi',
  'uRayF',
  'uPixel',
  'uSteps',
]);
export const AURORA_UNIFORMS = Object.freeze(['uYaw', 'uPitch', 'uTanHalfFov', 'uAspect', ...AURORA_ALONG_UNIFORMS]);
/** The pass's three programs, as render/playPrograms.js starts them at the boot's idle and its door builds them. */
export const AURORA_PROGRAMS = Object.freeze([
  Object.freeze(/** @type {const} */ ([VS, AURORA_FS])),
  Object.freeze(/** @type {const} */ ([VS, AURORA_ADD_FS])),
  Object.freeze(/** @type {const} */ ([VS, AURORA_DOME_FS])),
]);
/** THE DOME MAP the water reflects: its size (azimuth x height), its march's steps, and every how many frames it is
 *  marched again (the curtains move slowly; a reflection a few frames old is the same). */
export const AURORA_DOME = Object.freeze({ width: 256, height: 64, steps: 6, every: 3 });

/** The phases the clock gives at `seconds` (the sky's walk clock), wrapped here in double precision so the shader's
 *  never jump: the three waves' and [the swell's, the hem's] in radians, and each arc's rays' noise rows - the two
 *  whole rows it lies between, wrapped on the noise's period, and the smoothed share of the second. */
export function auroraPhases(seconds) {
  const t = Number.isFinite(seconds) ? seconds : 0,
    wrap = (r) => wrapAngle(t * r);
  const lo = [],
    hi = [],
    share = [];
  for (let k = 0; k < 3; k++) {
    const row = (((t * AURORA_RATES.rays + k * AURORA_ARC_ROW) % AURORA_RAY_ROWS) + AURORA_RAY_ROWS) % AURORA_RAY_ROWS;
    const r0 = Math.floor(row),
      u = row - r0;
    lo.push(r0);
    hi.push((r0 + 1) % AURORA_RAY_ROWS);
    share.push(u * u * (3 - 2 * u));
  }
  return {
    wave: AURORA_WAVES.map((w) => wrap(w[2])),
    drift: [wrap(AURORA_RATES.swell), wrap(AURORA_RATES.hem)],
    lo,
    hi,
    share,
  };
}

export class AuroraPass {
  /** @param {any} gl @param {{ steps: number, scale: number }} [quality] the tier's (AURORA_QUALITY) */
  constructor(gl, quality = AURORA_QUALITY.default) {
    this.gl = gl;
    this.steps = Math.max(1, Math.min(AURORA_MAX_STEPS, Math.round(quality.steps)));
    this.scale = Math.max(0.25, Math.min(1, quality.scale));
    this.program = buildProgram(gl, VS, AURORA_FS, 'aurora');
    this.addProgram = buildProgram(gl, VS, AURORA_ADD_FS, 'aurora add');
    this.domeProgram = buildProgram(gl, VS, AURORA_DOME_FS, 'aurora dome');
    this.u = {};
    for (const name of AURORA_UNIFORMS) this.u[name] = gl.getUniformLocation(this.program, name);
    this.du = {};
    for (const name of AURORA_ALONG_UNIFORMS) this.du[name] = gl.getUniformLocation(this.domeProgram, name);
    this.uMap = gl.getUniformLocation(this.addProgram, 'uMap');
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    /** the march's map, made at the first draw and again when the world image's size changes */
    this.map = /** @type {ReturnType<typeof createRenderTarget>|null} */ (null);
    /** the dome map the water reflects (AURORA_DOME), made at the first draw; `domeDrawn` once it holds a march */
    this.dome = /** @type {ReturnType<typeof createRenderTarget>|null} */ (null);
    this.domeDrawn = false;
    this._domeTurn = 0;
  }

  /** The dome map's texture once a march is in it, or null - the water's reflection (render/waterSurface.js). */
  get domeTex() {
    return this.domeDrawn ? (this.dome?.tex ?? null) : null;
  }

  /** The march's uniforms on the program whose table `u` is: the weight, the arcs, the clock's phases, the texel's span. */
  _along(u, weight, hang, ph, pixel, steps) {
    const gl = this.gl;
    gl.uniform1f(u.uWeight, Math.min(1, weight));
    gl.uniform1f(u.uHang, hang);
    gl.uniform3f(u.uWave, ph.wave[0], ph.wave[1], ph.wave[2]);
    gl.uniform2f(u.uDrift, ph.drift[0], ph.drift[1]);
    gl.uniform3f(u.uRayLo, ph.lo[0], ph.lo[1], ph.lo[2]);
    gl.uniform3f(u.uRayHi, ph.hi[0], ph.hi[1], ph.hi[2]);
    gl.uniform3f(u.uRayF, ph.share[0], ph.share[1], ph.share[2]);
    gl.uniform1f(u.uPixel, pixel);
    gl.uniform1f(u.uSteps, steps);
  }

  /** The map for a world image `w` x `h`, made or made again at the tier's share of it. */
  _mapFor(w, h) {
    const mw = Math.max(1, Math.round(w * this.scale)),
      mh = Math.max(1, Math.round(h * this.scale));
    if (this.map && this.map.width === mw && this.map.height === mh) return this.map;
    this._freeMap();
    return (this.map = createRenderTarget(this.gl, mw, mh));
  }

  _freeMap() {
    if (!this.map) return;
    this.gl.deleteTexture(this.map.tex);
    this.gl.deleteFramebuffer(this.map.fbo);
    this.map = null;
  }

  /** Draw at `weight` (0 draws nothing) with the arcs `hang` hem heights north of the eye, at `seconds` on the sky's
   *  clock, into the world image's rect `viewport` ([x, y, w, h], restored after the march). `freshDome`: the last draw
   *  was not the frame before, so the water's map is marched now, never left from then. */
  draw(yaw, pitch, fovY, aspect, weight, hang, seconds, viewport, freshDome = false) {
    if (!(weight > 0)) return;
    const gl = this.gl,
      u = this.u,
      ph = auroraPhases(seconds),
      tanHalf = Math.tan(fovY / 2);
    const map = this._mapFor(viewport[2], viewport[3]);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    withTarget(gl, map, viewport, () => {
      gl.useProgram(this.program);
      gl.uniform1f(u.uYaw, yaw);
      gl.uniform1f(u.uPitch, pitch);
      gl.uniform1f(u.uTanHalfFov, tanHalf);
      gl.uniform1f(u.uAspect, aspect);
      this._along(u, weight, hang, ph, (2 * tanHalf) / map.height, this.steps);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    // the dome map the water reflects, every few frames: by direction, so a reflection a frame or two old still lines up
    if (freshDome || !this.domeDrawn) this._domeTurn = 0;
    if (this._domeTurn++ % AURORA_DOME.every === 0) {
      this.dome ??= createRenderTarget(gl, AURORA_DOME.width, AURORA_DOME.height, { wrapS: 'REPEAT' });
      withTarget(gl, this.dome, viewport, () => {
        gl.useProgram(this.domeProgram);
        this._along(this.du, weight, hang, ph, TAU / AURORA_DOME.width, AURORA_DOME.steps);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
      this.domeDrawn = true;
    }
    gl.useProgram(this.addProgram);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL); // only where nothing nearer has drawn - z is the far plane
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE); // light added to the sky; the buffer's alpha untouched
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, map.tex);
    gl.uniform1i(this.uMap, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
  }

  /** EVERY ALLOCATION HAS AN OWNER: the programs, the triangle, its VAO and both maps - for an owner that tears it down;
   *  the sky controller holds it for the page's life, as it holds the sky's other passes. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.addProgram);
    gl.deleteProgram(this.domeProgram);
    gl.deleteBuffer(this.vb);
    gl.deleteVertexArray(this.vao);
    this._freeMap();
    if (this.dome) {
      gl.deleteTexture(this.dome.tex);
      gl.deleteFramebuffer(this.dome.fbo);
      this.dome = null;
      this.domeDrawn = false;
    }
  }
}
