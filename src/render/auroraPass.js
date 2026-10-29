// @ts-check
// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): the aurora's pass - one fullscreen triangle at the far plane
// over whichever sky the enhanced lane draws, under its clouds (scenes/shared.js createSkyController draw). Light, so
// it is ADDED (one, one): the stars and the moons show through it. Its curtains are vertical sheets running east-west,
// hung north of the eye; each ray is marched up through them from their lower hem, so a curtain overhead fans to the
// zenith and a far one stands low over the north horizon. The owner's reference: green, teal at the hem, a blue glow.
import { buildProgram } from './glProgram.js';

/** Steps up through the curtains, and their depth above the hem in hem heights. */
export const AURORA_STEPS = 12;
export const AURORA_DEPTH = 1.5;
/** The arcs' spacing north to south, in hem heights. */
export const AURORA_ARC_GAP = 1.3;
/** The colours, display-encoded: the hem's green, the crown's teal-blue, the glow round both. */
export const AURORA_HEM = Object.freeze([0.25, 1.0, 0.55]);
export const AURORA_CROWN = Object.freeze([0.1, 0.6, 0.9]);
export const AURORA_GLOW = Object.freeze([0.08, 0.25, 0.85]);
/** The light at a full weight, and the brightest it rolls off toward. */
export const AURORA_GAIN = 0.42;
export const AURORA_PEAK = 0.95;
/** How far past its centre an arc's waves and glow reach, hem heights: a march wholly past every arc draws nothing. */
export const AURORA_REACH = 2.6;

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const v3 = (c) => `vec3(${c.map(f).join(', ')})`;

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 1.0, 1.0); }`;

export const AURORA_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform float uYaw, uPitch, uTanHalfFov, uAspect;
uniform float uWeight;   // 0..1, the frame's aurora (scenes/auroraHost.js)
uniform float uHang;     // how far north of the eye the middle arc hangs, in hem heights
uniform float uTime;     // real seconds, wrapped
out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// One arc at Q (x east, y north, hem heights): its thin sheet with its rays, and the wide glow about it.
vec2 arcAt(vec2 Q, float k, float t) {
  float x = Q.x;
  float wave = 0.55 * sin(x * 0.62 + t * 0.035 + k * 2.1) + 0.3 * sin(x * 1.37 - t * 0.05 + k * 4.7)
    + 0.35 * sin(x * 2.9 + t * 0.07 + k * 1.3);
  float across = Q.y - (uHang + (k - 1.0) * ${f(AURORA_ARC_GAP)}) - wave;
  float a2 = across * across;
  float rays = 0.25 + 0.75 * smoothstep(0.2, 0.8, vnoise(vec2(x * 7.0 + wave * 3.0, t * 0.16 + k * 5.3)));
  float swell = 0.55 + 0.45 * sin(x * 0.9 - t * 0.06 + k * 1.7);
  return vec2(exp(-a2 * 12.0) * rays, exp(-a2 * 2.5)) * swell;
}
void main() {
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 dir = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));
  if (dir.y <= 0.0) discard;
  float up = max(dir.y, 0.035);
  vec2 q0 = dir.xz / up;   // where the ray crosses the hem's height
  float hemH = 1.0 + 0.22 * sin(q0.x * 0.8 + uTime * 0.02) + 0.3 * (vnoise(vec2(q0.x * 1.7, 3.0)) - 0.5);   // a hem that rises and falls
  // the march's reach north and south; a ray that passes every arc's waves and glow by far is dark
  float yLo = min(q0.y * hemH, q0.y * (hemH + ${f(AURORA_DEPTH)})), yHi = max(q0.y * hemH, q0.y * (hemH + ${f(AURORA_DEPTH)}));
  if (yHi < uHang - ${f(AURORA_ARC_GAP + AURORA_REACH)} || yLo > uHang + ${f(AURORA_ARC_GAP + AURORA_REACH)}) discard;
  float jitter = hash12(gl_FragCoord.xy);
  float t = uTime;
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${AURORA_STEPS}; i++) {
    float hn = (float(i) + jitter) / ${f(AURORA_STEPS)};
    vec2 Q = q0 * (hemH + ${f(AURORA_DEPTH)} * hn);
    vec2 s = 0.7 * arcAt(Q, 0.0, t) + arcAt(Q, 1.0, t) + 0.55 * arcAt(Q, 2.0, t);
    float hem = smoothstep(0.0, 0.06, hn) * exp(-hn * 2.4);   // brightest at the lower hem, thinning upward
    col += (mix(${v3(AURORA_HEM)}, ${v3(AURORA_CROWN)}, smoothstep(0.2, 0.85, hn)) * s.x + ${v3(AURORA_GLOW)} * 0.12 * s.y) * hem;
  }
  // a longer path through the sheets near the horizon, fading into its haze
  col *= ${f(AURORA_GAIN)} * uWeight * inversesqrt(up) * smoothstep(0.0, 0.16, dir.y);
  float m = max(col.g, col.b);   // a soft knee to the brightest, so a corona overhead never clips flat
  col *= m > 1e-5 ? ${f(AURORA_PEAK)} * (1.0 - exp(-m / ${f(AURORA_PEAK)})) / m : 1.0;
  col += (jitter - 0.5) / 255.0 * step(0.004, col.g + col.b);   // no bands in the dark sky's few levels
  outColor = vec4(max(col, 0.0), 0.0);
}`;

export const AURORA_UNIFORMS = Object.freeze(['uYaw', 'uPitch', 'uTanHalfFov', 'uAspect', 'uWeight', 'uHang', 'uTime']);
/** The pass's one program, as render/playPrograms.js starts it at the boot's idle and its door builds it. */
export const AURORA_PROGRAMS = Object.freeze([Object.freeze(/** @type {const} */ ([VS, AURORA_FS]))]);

/** The curtains' real-second clock wraps here, inside a float's fraction. */
const TIME_WRAP_S = 3600;

export class AuroraPass {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, VS, AURORA_FS, 'aurora');
    this.u = {};
    for (const name of AURORA_UNIFORMS) this.u[name] = gl.getUniformLocation(this.program, name);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  }

  /** Draw at `weight` (0 draws nothing) with the arcs `hang` hem heights north of the eye. */
  draw(yaw, pitch, fovY, aspect, weight, hang) {
    if (!(weight > 0)) return;
    const gl = this.gl, u = this.u;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    gl.useProgram(this.program);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);   // only where nothing nearer has drawn - z is the far plane
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);   // light added to the sky; the buffer's alpha untouched
    gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uWeight, Math.min(1, weight));
    gl.uniform1f(u.uHang, hang);
    gl.uniform1f(u.uTime, ((now - this.t0) / 1000) % TIME_WRAP_S);
    gl.disable(gl.CULL_FACE);   // the triangle winds CCW under a CW front face, as the sky's
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
  }

  /** EVERY ALLOCATION HAS AN OWNER: the program, its triangle and its VAO. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.vb);
    gl.deleteVertexArray(this.vao);
  }
}
