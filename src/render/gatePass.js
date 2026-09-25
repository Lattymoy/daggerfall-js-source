// @ts-check
// WB2 (2026-09-25, Mac: "A gate model would be spawned with a timer that leads to a completely different area"):
// THE GATE'S FIRE AND ITS BEACON, DRAWN - the two things the stone (world/gateModel.js) cannot be.
//
// THE MEMBRANE. The portal between the horns: a slow vortex of fire, masked to the arch's own opening
// (world/gateModel.js gateArchProfile - measured off the built mesh, so it fits the stone whatever its numbers
// become), bright at its rim where it meets the stone. SEALED it is an ember - dim, slow, half seen through; OPEN
// it blazes and turns fast and hides what stands behind it. Blended PREMULTIPLIED (ONE, ONE_MINUS_SRC_ALPHA): its
// alpha is how much of the world behind it it hides, and its colour may run past that alpha, so it GLOWS as well as
// covers. No depth written, depth tested - the horns in front of it hide it, as the stone of a real arch would.
//
// THE BEACON. A column of red light straight up from the gate, BEACON_HEIGHT_M tall, from far below the ground
// (the terrain hides its foot wherever the ground stands) - ADDED onto the frame (ONE, ONE), both faces, bands of
// light climbing it. The gate is found by looking up: the fog thins the beacon as it thins the ground, but never
// below BEACON_FOG_FLOOR of its light, so a gate a few kilometres off still stands on the horizon.
//
// Both on the duel wall's law (render/duelWall.js): fixed geometry, every placement a uniform, every rate a whole
// number of cycles over GATE_CLOCK_PERIOD and the clock handed wrapped, fogged by the frame's own fog. Built in
// every skin - online is the enhanced lane, but a pass that will not build costs the gate its fire, never the game.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { ARCH_PROFILE_N, ARCH_Y0, ARCH_Y1, PORTAL_CENTRE_Y } from '../world/gateModel.js';

/** Every rate below is whole cycles over this many seconds; the clock is handed wrapped to it. */
export const GATE_CLOCK_PERIOD = 120;
export const gateClock = (seconds) => ((seconds % GATE_CLOCK_PERIOD) + GATE_CLOCK_PERIOD) % GATE_CLOCK_PERIOD;
/** The vortex's turns a second sealed and open, and the fire's rise through it (cycles a second). */
export const MEMBRANE_TURN_SEALED_HZ = 0.05;
export const MEMBRANE_TURN_OPEN_HZ = 0.25;
export const MEMBRANE_FLOW_HZ = 0.5;
/** How much of the world behind it the membrane hides, sealed and open. */
export const MEMBRANE_ALPHA_SEALED = 0.35;
export const MEMBRANE_ALPHA_OPEN = 0.92;
/** The membrane's widest half-width, for its quad (the mask narrows it to the arch). */
export const MEMBRANE_HALF_W = 5;
/** The beacon: its radius, how far below the gate it starts, how tall it stands, its colour (display-encoded, the
 *  frame image the passes draw into - duelWall.js), the bands climbing it (cycles a second, whole over the period),
 *  and the least of its light the fog may leave. */
export const BEACON_RADIUS_M = 1.6;
export const BEACON_BELOW_M = 400;
export const BEACON_HEIGHT_M = 1200;
export const BEACON_COLOR = Object.freeze([1.0, 0.24, 0.07]);
export const BEACON_CLIMB_HZ = 0.25;
export const BEACON_FOG_FLOOR = 0.3;
export const BEACON_SEGMENTS = 24;
/** How the column widens with distance - radius per metre away: some four pixels across on a 700-pixel view at the
 *  game's field of view, whatever the distance. */
export const BEACON_WIDEN = 0.006;
/** The column leaves the gate this far above its foot - over the horns' crown, so it never stands behind the fire. */
export const BEACON_START_M = 15;
/** The most gates a frame draws (one a day stands; a collapsing yesterday's beside it). */
export const GATE_PASS_MAX = 2;

const HEAD = `#version 300 es
precision highp float;
`;
const FOG_UNIFORMS = `uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
`;

// ── the membrane ─────────────────────────────────────────────────────
export const MEMBRANE_VS = HEAD + `layout(location = 0) in vec2 aXY;   // the quad: x across the arch (metres), y up it (metres, the gate's frame)
uniform mat4 uVP;
uniform vec3 uOrigin;   // the gate's foot in the scene (its rise already in y)
uniform float uYaw;     // the gate's turn about y
out vec2 vLocal;
out vec3 vWorld;
void main() {
  float c = cos(uYaw), s = sin(uYaw);
  vec3 p = uOrigin + vec3(aXY.x * c, aXY.y, -aXY.x * s);
  vLocal = aXY;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const MEMBRANE_FS = HEAD + `in vec2 vLocal;
in vec3 vWorld;
uniform float uProfile[${ARCH_PROFILE_N}];
uniform float uTime;    // gateClock's seconds
uniform float uOpen;    // 0 sealed .. 1 open
uniform float uFade;    // 0 gone .. 1 standing (the rise and the collapse)
${FOG_UNIFORMS}out vec4 o;
${FOG_FACTOR_GLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
float halfW(float y) {
  float t = clamp((y - ${ARCH_Y0.toFixed(4)}) / ${(ARCH_Y1 - ARCH_Y0).toFixed(4)}, 0.0, 1.0) * ${(ARCH_PROFILE_N - 1).toFixed(1)};
  int i = int(floor(t));
  int j = min(i + 1, ${ARCH_PROFILE_N - 1});
  return mix(uProfile[i], uProfile[j], fract(t));
}
void main() {
  if (vLocal.y < ${ARCH_Y0.toFixed(4)} || vLocal.y > ${ARCH_Y1.toFixed(4)}) discard;
  float inside = halfW(vLocal.y) - abs(vLocal.x);   // metres from the stone, inward
  if (inside <= 0.0) discard;
  // THE VORTEX WITHOUT AN ANGLE: the point is turned about the centre by an angle that grows inward and with time,
  // and the noise read at the turned point - an atan's branch cut would stand in the fire as a seam
  vec2 c = (vLocal - vec2(0.0, ${PORTAL_CENTRE_Y.toFixed(4)})) / vec2(1.0, 1.7);
  float r = length(c);
  float turn = mix(${MEMBRANE_TURN_SEALED_HZ.toFixed(3)}, ${MEMBRANE_TURN_OPEN_HZ.toFixed(3)}, uOpen);
  float ang = -uTime * turn * 6.283185307179586 + 2.2 / (0.6 + r);
  vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * c;
  float n = fbm(q * 1.35 + vec2(0.0, -uTime * ${MEMBRANE_FLOW_HZ.toFixed(2)}));
  float rim = 1.0 - smoothstep(0.0, 1.1, inside);
  vec3 dark = vec3(0.16, 0.015, 0.01), mid = vec3(0.92, 0.22, 0.05), hot = vec3(1.0, 0.72, 0.3);
  vec3 col = mix(dark, mid, smoothstep(0.25, 0.75, n));
  col = mix(col, hot, pow(clamp(n, 0.0, 1.0), 3.0) * (0.35 + 0.65 * uOpen));
  col += hot * rim * (0.35 + 0.5 * uOpen);
  float glow = mix(0.45, 1.25, uOpen);
  float alpha = mix(${MEMBRANE_ALPHA_SEALED.toFixed(2)}, ${MEMBRANE_ALPHA_OPEN.toFixed(2)}, uOpen) * (0.75 + 0.25 * n) * smoothstep(0.0, 0.25, inside);
  float f = fogFactorAt(vWorld);
  o = vec4(col * glow * f * uFade, alpha * uFade);
}`;

// ── the beacon ───────────────────────────────────────────────────────
export const BEACON_VS = HEAD + `layout(location = 0) in vec2 aUV;   // x around 0..1, y up 0..1
uniform mat4 uVP;
uniform vec3 uOrigin;
uniform vec3 uEye;
uniform float uRadius;
out vec2 vUV;
out vec3 vWorld;
void main() {
  float a = aUV.x * 6.283185307179586;
  // never thinner than a few pixels: far off, the column widens with its distance, so a gate kilometres away is
  // still a line on the sky and not a hair the screen cannot hold
  float rad = max(uRadius, length(uEye.xz - uOrigin.xz) * ${BEACON_WIDEN.toFixed(4)});
  vec3 p = uOrigin + vec3(cos(a) * rad, -${BEACON_BELOW_M.toFixed(1)} + aUV.y * ${BEACON_HEIGHT_M.toFixed(1)}, sin(a) * rad);
  vUV = aUV;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const BEACON_FS = HEAD + `in vec2 vUV;
in vec3 vWorld;
uniform vec3 uOrigin;
uniform float uTime;
uniform float uFade;
uniform vec3 uColor;
${FOG_UNIFORMS}out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  float h = vUV.y;
  float foot = ${((BEACON_BELOW_M + BEACON_START_M) / BEACON_HEIGHT_M).toFixed(4)};   // the column leaves the gate from its crown
  float above = clamp((h - foot) / (1.0 - foot), 0.0, 1.0);
  float bands = 0.6 + 0.4 * sin((above * 38.0 - uTime * ${BEACON_CLIMB_HZ.toFixed(2)}) * 6.283185307179586);
  float fall = pow(1.0 - above, 1.6);            // brightest over the gate, gone toward the top
  float rise = smoothstep(foot, foot + 0.01, h); // it grows out of the crown rather than starting on a line
  // soft across its width: brightest where the eye looks through the column's heart, faint at its edge
  vec3 axis = vec3(uOrigin.x, vWorld.y, uOrigin.z);
  float core = abs(dot(normalize(vWorld - axis), normalize(uCamPos - vWorld)));
  float light = (0.25 + 0.75 * fall) * bands * rise * core * core;
  float f = max(fogFactorAt(vWorld), ${BEACON_FOG_FLOOR.toFixed(2)});
  o = vec4(uColor * light * f * uFade, 1.0);
}`;

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/** The membrane's quad, two triangles over [-MEMBRANE_HALF_W, MEMBRANE_HALF_W] x [ARCH_Y0, ARCH_Y1]. Pure. */
export function membraneVertices() {
  const x0 = -MEMBRANE_HALF_W, x1 = MEMBRANE_HALF_W, y0 = ARCH_Y0, y1 = ARCH_Y1;
  return new Float32Array([x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1]);
}
/** The beacon's column, (around, up) pairs, two triangles a segment. Pure. */
export function beaconVertices(segments = BEACON_SEGMENTS) {
  const out = new Float32Array(segments * 12);
  let o = 0;
  for (let i = 0; i < segments; i++) {
    const a = i / segments, b = (i + 1) / segments;
    for (const [u, v] of [[a, 0], [b, 0], [b, 1], [a, 0], [b, 1], [a, 1]]) { out[o++] = u; out[o++] = v; }
  }
  return out;
}

const NO_FOG_RANGE = new Float32Array([0, 1]);
const WHITE = new Float32Array([1, 1, 1]);

/** The gates' fire and beacons, one foreign pass. */
export class GatePassRenderer {
  /** @param {WebGL2RenderingContext} gl @param {Float32Array} profile the arch's opening (gateArchProfile) */
  constructor(gl, profile) {
    this.gl = gl;
    this.membrane = buildProgram(gl, MEMBRANE_VS, MEMBRANE_FS, 'gate membrane');
    this.beacon = buildProgram(gl, BEACON_VS, BEACON_FS, 'gate beacon');
    const names = ['uVP', 'uOrigin', 'uEye', 'uYaw', 'uRadius', 'uProfile', 'uTime', 'uOpen', 'uFade', 'uColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos'];
    this.mu = {}; this.bu = {};
    for (const n of names) { this.mu[n] = gl.getUniformLocation(this.membrane, n); this.bu[n] = gl.getUniformLocation(this.beacon, n); }
    const vao = (verts) => {
      const v = gl.createVertexArray();
      gl.bindVertexArray(v);
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindVertexArray(null);
      return { vao: v, count: verts.length / 2 };
    };
    this.quad = vao(membraneVertices());
    this.column = vao(beaconVertices());
    this.profile = Float32Array.from(profile ?? new Float32Array(ARCH_PROFILE_N));
    this._vp = new Float32Array(16);
    /** the gates the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  _fog(U, fog, eye) {
    const gl = this.gl;
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? WHITE);
  }

  /**
   * Draw the gates: `gates` [{ origin: [x, y, z] the gate's foot in the scene (its rise already in y), yaw, open 0..1,
   * fade 0..1 }] (at most GATE_PASS_MAX, the faded skipped), `eye` the view's own eye, `seconds` any clock (wrapped
   * here), `fog` the frame's fog ({ mode, density, range, camPos }; none draws unfogged). Nothing to draw, nothing
   * touched.
   */
  draw(gates, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const list = (Array.isArray(gates) ? gates : []).filter((g) => g && Array.isArray(g.origin) && g.origin.length === 3 && g.origin.every(Number.isFinite) && Number.isFinite(g.yaw) && g.fade > 0.001).slice(0, GATE_PASS_MAX);
    if (!list.length) return;
    const gl = this.gl;
    mat4Multiply(this._vp, proj, view);
    const t = gateClock(seconds);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    // the beacons first, added: light behind the membrane shows through its sealed ember
    gl.useProgram(this.beacon);
    gl.uniformMatrix4fv(this.bu.uVP, false, this._vp);
    gl.uniform1f(this.bu.uTime, t);
    gl.uniform1f(this.bu.uRadius, BEACON_RADIUS_M);
    gl.uniform3fv(this.bu.uEye, eye ?? fog?.camPos ?? WHITE);
    gl.uniform3fv(this.bu.uColor, BEACON_COLOR);
    this._fog(this.bu, fog, eye);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.column.vao);
    for (const g of list) {
      gl.uniform3f(this.bu.uOrigin, g.origin[0], g.origin[1], g.origin[2]);
      gl.uniform1f(this.bu.uFade, Math.min(1, g.fade));
      gl.drawArrays(gl.TRIANGLES, 0, this.column.count);
    }
    // then the membranes, premultiplied: they hide the world behind them as much as they glow
    gl.useProgram(this.membrane);
    gl.uniformMatrix4fv(this.mu.uVP, false, this._vp);
    gl.uniform1f(this.mu.uTime, t);
    gl.uniform1fv(this.mu.uProfile, this.profile);
    this._fog(this.mu, fog, eye);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.quad.vao);
    for (const g of list) {
      gl.uniform3f(this.mu.uOrigin, g.origin[0], g.origin[1], g.origin[2]);
      gl.uniform1f(this.mu.uYaw, g.yaw);
      gl.uniform1f(this.mu.uOpen, Math.max(0, Math.min(1, g.open ?? 0)));
      gl.uniform1f(this.mu.uFade, Math.min(1, g.fade));
      gl.drawArrays(gl.TRIANGLES, 0, this.quad.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
