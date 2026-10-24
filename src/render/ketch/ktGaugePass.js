// @ts-check
// KETCH-LOOK KL3 (bible/11-Multiplayer/Sky-Ketch-Look.md "The shared kit", "The state language"): EVERY INSTRUMENT ON THE
// SHIP IN ONE INSTANCED DRAW (the Hour's ghost pass the precedent: render/superDungeon/sdStepsPass.js) - up to
// KT_GAUGE_MAX faces, each 12 floats: its centre (xyz), its face's right and up half-axes (xyz each - the wall it stands a
// hair proud of), its kind, its value `a` (0..1) and its second `b`. The kinds speak the state language:
//   dial     TIME LEFT - a 270-degree sweep, full at the lower right, its red pin at the lower left; the needle falls
//   glass    A LEVEL - a sight-glass filling from its foot (glass shows a level: a cell drains)
//   lamps    A COUNT - a row of `b` studs, `a` of them lit from the left
//   ring     A SHARE - a flat ring filled clockwise from the top
//   pulse    A FLOW - a pulse running along a segment
// Each face's look is a pure function of (kind, meaning, a, b, u, v) - ktGaugeAt, the fragment's JS twin term for term,
// the test's eye - posterized through the ordered dither on the face's own texel grid (render/orderedDither.js
// SD_PIXEL_GLSL: 10 steps on the lane, 8 on the classic set), fogged as the world is. Its meaning (world/ketch/ketchLook.js
// KT_MEANING: LAMP, AETHER, EMBER, RED) rides its kind: `kind + KT_GAUGE_MEANING_STRIDE * meaning`. Faces stand on L2
// (bezels, studs dark), signals on L3 (needles, lit glass, lit studs) - the value ladder (KT_LADDER).
//
// A foreign pass: it owns its program and its state, and its host marks it (renderer.markForeignPass). Not a DFU member.
// Ledger A (KETCH).
import { buildProgram } from '../glProgram.js';
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from '../orderedDither.js';

export const KT_GAUGE_MAX = 96;
export const KT_GAUGE_FLOATS = 12;
/** The kinds, and how a meaning rides one (`kind + stride * meaning`). */
export const KT_GAUGE_KIND = Object.freeze({ dial: 0, glass: 1, lamps: 2, ring: 3, pulse: 4 });
export const KT_GAUGE_MEANING = Object.freeze({ lamp: 0, aether: 1, ember: 2, red: 3 });
export const KT_GAUGE_MEANING_STRIDE = 10;
/** The face's colours (display): its signal by meaning (L3), the bezel and a dark stud (L2), the face's dark (L1), the
 *  dial's red sector; the texels a face is posterized on, across. */
export const KT_GAUGE_LOOK = Object.freeze({
  signal: Object.freeze([Object.freeze([0.95, 0.76, 0.42]), Object.freeze([0.5, 0.82, 0.98]), Object.freeze([1.0, 0.56, 0.14]), Object.freeze([0.88, 0.18, 0.14])]),
  bezel: Object.freeze([0.5, 0.42, 0.2]), stud: Object.freeze([0.2, 0.16, 0.1]), face: Object.freeze([0.07, 0.07, 0.08]), red: Object.freeze([0.62, 0.16, 0.12]),
  texels: 32, steps: Object.freeze({ lane: 10, classic: 8 }),
});
/** The dial's sweep (radians from up, clockwise): its pin at the lower left, full at the lower right; its red sector. */
export const KT_DIAL = Object.freeze({ from: (-135 * Math.PI) / 180, sweep: (270 * Math.PI) / 180, red: (24 * Math.PI) / 180 });

/** The parts a face's point is (ktGaugeAt's `part`). */
export const KT_GAUGE_PART = Object.freeze({ none: 0, face: 1, bezel: 2, signal: 3, dark: 4, red: 5 });

/**
 * A FACE'S POINT: kind `k` (with its meaning), its value `a`, its second `b`, at face point (`u`, `v`) in -1..1 - which part
 * it is (KT_GAUGE_PART). Pure; the fragment shader's twin, term for term.
 */
export function ktGaugeAt(k, a, b, u, v) {
  const kind = k % KT_GAUGE_MEANING_STRIDE, r = Math.hypot(u, v), P = KT_GAUGE_PART;
  switch (kind) {
    case KT_GAUGE_KIND.dial: {
      if (r > 1) return P.none;
      if (r > 0.86) return P.bezel;
      const th = Math.atan2(u, v);   // from up, clockwise
      const needle = KT_DIAL.from + KT_DIAL.sweep * Math.max(0, Math.min(1, a));
      const off = Math.abs(Math.atan2(Math.sin(th - needle), Math.cos(th - needle)));
      if (r < 0.1) return P.signal;
      if (r < 0.78 && off * r < 0.05) return P.signal;
      const s = th - KT_DIAL.from, inSweep = ((s % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (r > 0.7 && r < 0.82 && inSweep <= KT_DIAL.red) return P.red;
      return P.face;
    }
    case KT_GAUGE_KIND.glass: {
      if (Math.abs(u) > 1 || Math.abs(v) > 1) return P.none;
      if (Math.abs(u) > 0.7 || Math.abs(v) > 0.92) return P.bezel;
      const top = -0.92 + 1.84 * Math.max(0, Math.min(1, a));
      return v <= top ? P.signal : P.dark;
    }
    case KT_GAUGE_KIND.lamps: {
      const n = Math.max(1, Math.min(16, Math.round(b))), cell = 2 / n;
      const i = Math.min(n - 1, Math.floor((u + 1) / cell)), cu = -1 + cell * (i + 0.5);
      const rr = Math.hypot(u - cu, v) / Math.min(1, cell / 2);   // round studs on the plate, whatever their count
      if (rr > 0.8) return Math.abs(v) <= 1 ? P.bezel : P.none;
      return i < Math.round(Math.max(0, Math.min(1, a)) * n) ? P.signal : P.dark;
    }
    case KT_GAUGE_KIND.ring: {
      if (r > 1) return P.none;
      if (r < 0.62 || r > 0.9) return r > 0.9 ? P.bezel : P.face;
      const th = Math.atan2(u, v), turned = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return turned <= 2 * Math.PI * Math.max(0, Math.min(1, a)) ? P.signal : P.dark;
    }
    case KT_GAUGE_KIND.pulse: {
      if (Math.abs(v) > 0.3 || Math.abs(u) > 1) return P.none;
      if (Math.abs(v) > 0.22) return P.bezel;
      return Math.abs(u - (-1 + 2 * Math.max(0, Math.min(1, a)))) < 0.12 ? P.signal : P.dark;
    }
    default: return P.none;
  }
}

/** A JS number as a GLSL float literal, every digit kept (the dial's edges the twin's to the last bit). */
const glf = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

export const KT_GAUGE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aAt;
layout(location = 2) in vec3 aRight;
layout(location = 3) in vec3 aUp;
layout(location = 4) in vec3 aKind;   // kind (with its meaning), a, b
uniform mat4 uView, uProj;
out vec2 vQ;
out vec3 vWorld;
flat out vec3 vKind;
void main() {
  vec3 p = aAt + aRight * aCorner.x + aUp * aCorner.y;
  vQ = aCorner; vWorld = p; vKind = aKind;
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;
export const KT_GAUGE_FS = `#version 300 es
precision highp float;
in vec2 vQ;
in vec3 vWorld;
flat in vec3 vKind;
uniform vec3 uSignal[4];
uniform vec3 uBezel, uStud, uFace, uRed;
uniform float uSteps, uTexels, uLane;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos, uFogColor;
out vec4 o;
${FOG_FACTOR_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}
const float PI = ${glf(Math.PI)};
// ktGaugeAt's twin: 0 none, 1 face, 2 bezel, 3 signal, 4 dark, 5 red
int partAt(float kind, float a, float b, float u, float v) {
  float r = length(vec2(u, v));
  a = clamp(a, 0.0, 1.0);
  if (kind < 0.5) {
    if (r > 1.0) return 0;
    if (r > 0.86) return 2;
    float th = atan(u, v), needle = ${glf(KT_DIAL.from)} + ${glf(KT_DIAL.sweep)} * a;
    float off = abs(atan(sin(th - needle), cos(th - needle)));
    if (r < 0.1) return 3;
    if (r < 0.78 && off * r < 0.05) return 3;
    float s = mod(th - ${glf(KT_DIAL.from)}, 2.0 * PI);
    if (r > 0.7 && r < 0.82 && s <= ${glf(KT_DIAL.red)}) return 5;
    return 1;
  }
  if (kind < 1.5) {
    if (abs(u) > 0.7 || abs(v) > 0.92) return 2;
    return v <= -0.92 + 1.84 * a ? 3 : 4;
  }
  if (kind < 2.5) {
    float n = clamp(floor(b + 0.5), 1.0, 16.0), cell = 2.0 / n;
    float i = min(n - 1.0, floor((u + 1.0) / cell)), cu = -1.0 + cell * (i + 0.5);
    float rr = length(vec2(u - cu, v)) / min(1.0, cell / 2.0);
    if (rr > 0.8) return 2;
    return i < floor(a * n + 0.5) ? 3 : 4;
  }
  if (kind < 3.5) {
    if (r > 1.0) return 0;
    if (r < 0.62 || r > 0.9) return r > 0.9 ? 2 : 1;
    return mod(atan(u, v), 2.0 * PI) <= 2.0 * PI * a ? 3 : 4;
  }
  if (abs(v) > 0.3) return 0;
  if (abs(v) > 0.22) return 2;
  return abs(u - (-1.0 + 2.0 * a)) < 0.12 ? 3 : 4;
}
void main() {
  float kind = mod(vKind.x, ${glf(KT_GAUGE_MEANING_STRIDE)}), meaning = floor(vKind.x / ${glf(KT_GAUGE_MEANING_STRIDE)} + 0.001);
  vec2 cell = floor((vQ * 0.5 + 0.5) * uTexels);
  vec2 q = (cell + 0.5) / uTexels * 2.0 - 1.0;   // the face's own texel grid
  int part = partAt(kind, vKind.y, vKind.z, q.x, q.y);
  if (part == 0) discard;
  vec3 c = part == 1 ? uFace : part == 2 ? uBezel : part == 3 ? uSignal[int(clamp(meaning, 0.0, 3.0))] : part == 4 ? uStud : uRed;
  c = sdPixel(c, cell, uSteps);
  if (uLane > 0.5) c = pow(c, vec3(2.2));   // the lane takes linear light
  o = vec4(mix(uFogColor, c, fogFactorAt(vWorld)), 1.0);
}`;

/** FIRST-USE: the pass's one program, as its constructor builds it. */
export const KT_GAUGE_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[KT_GAUGE_VS, KT_GAUGE_FS]]));
const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
const NO_RANGE = new Float32Array([0, 1]), NO_CAM = new Float32Array(3), NO_FOG = new Float32Array(3);

/** The gauges, one foreign pass. `instances` a Float32Array of `count` faces, KT_GAUGE_FLOATS each. */
export class KtGaugeRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [[vs, fs]] = KT_GAUGE_PROGRAMS;
    this.prog = buildProgram(gl, vs, fs, 'kt gauge');
    this.u = {};
    for (const n of ['uView', 'uProj', 'uSignal', 'uBezel', 'uStud', 'uFace', 'uRed', 'uSteps', 'uTexels', 'uLane', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFogColor']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.inst = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, KT_GAUGE_MAX * KT_GAUGE_FLOATS * 4, gl.DYNAMIC_DRAW);
    const S = KT_GAUGE_FLOATS * 4;
    for (const [loc, off] of [[1, 0], [2, 12], [3, 24], [4, 36]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, S, off); gl.vertexAttribDivisor(loc, 1); }
    gl.bindVertexArray(null);
    this.signal = new Float32Array(KT_GAUGE_LOOK.signal.flat());
    this.drawn = 0;
  }
  /** Draw `count` faces of `instances` (the world frame), `lane` the enhanced lane's (linear light, its steps). Answers
   *  whether any drew. */
  draw(proj, view, instances, count, { lane = false, fog = null } = {}) {
    const gl = this.gl, U = this.u, n = Math.min(count | 0, KT_GAUGE_MAX), L = KT_GAUGE_LOOK;
    this.drawn = 0;
    if (!n || !this.prog) return false;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(U.uView, false, view); gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform3fv(U.uSignal, this.signal);
    gl.uniform3fv(U.uBezel, L.bezel); gl.uniform3fv(U.uStud, L.stud); gl.uniform3fv(U.uFace, L.face); gl.uniform3fv(U.uRed, L.red);
    gl.uniform1f(U.uSteps, lane ? L.steps.lane : L.steps.classic); gl.uniform1f(U.uTexels, L.texels); gl.uniform1f(U.uLane, lane ? 1 : 0);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_CAM);
    gl.uniform3fv(U.uFogColor, fog?.color ?? NO_FOG);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, n * KT_GAUGE_FLOATS);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    this.drawn = n;
    return true;
  }
  /** Every GL object it made, freed once. */
  destroy() {
    const gl = this.gl;
    if (!this.prog) return;
    gl.deleteBuffer(this.quad); gl.deleteBuffer(this.inst); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
    this.prog = /** @type {any} */ (null);
  }
}

/**
 * A FACE into `out` at instance `i` (KT_GAUGE_FLOATS each): its centre, its right and up half-axes (the world frame), its
 * kind and meaning, its `a` and `b`. Answers `i + 1`.
 */
export function ktGaugePut(out, i, at, right, up, kind, meaning, a, b = 0) {
  const o = i * KT_GAUGE_FLOATS;
  out[o] = at[0]; out[o + 1] = at[1]; out[o + 2] = at[2];
  out[o + 3] = right[0]; out[o + 4] = right[1]; out[o + 5] = right[2];
  out[o + 6] = up[0]; out[o + 7] = up[1]; out[o + 8] = up[2];
  out[o + 9] = kind + KT_GAUGE_MEANING_STRIDE * meaning; out[o + 10] = a; out[o + 11] = b;
  return i + 1;
}
