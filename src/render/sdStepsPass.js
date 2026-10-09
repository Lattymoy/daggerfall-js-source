// @ts-check
// SD-LOOK S9 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 8): THE STEPS' GHOSTS - one additive draw
// for the whole course: a gone Beat plate, and a Crumble pin my own foot broke, hang as a thin gold outline exactly
// where the law will stand them again (the law's own box at the law's own anchored time - world/sdStepsModel.js
// stepEdges), each with its hand running back to XII as the return comes, brightening over its last moments.
//
// Lines as screen-width quads, SD_GHOST.px wide (gateTelegraph.js telegraphLineW's law - wider on a short screen), never
// GL_LINES (WebGL caps those at one pixel, gone on a high-DPI phone): a static buffer of every ghostable step's twelve
// edges and its hand, placed and lit by two uniform arrays the Steps write in place a frame (`step` - each top's centre,
// the scene's frame; `state` - alpha, the hand's share of a turn, brightness), so a frame makes nothing (AUDIT SD II L2
// F9). Posterized through the ordered dither (SD_PIXEL_GLSL), depth-tested and never written, fogged as the world is.
//
// A foreign pass: it owns its program and its state; the host marks it. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from './orderedDither.js';
import { telegraphLineW } from './gateTelegraph.js';
import { SD_LIGHT } from '../world/sdLook.js';
import { SD_STEPS_COURSE } from '../world/sdSteps.js';
import { stepEdges } from '../world/sdStepsModel.js';

/** The ghosts: their width (px), the hand's reach and lift over the top (m), their gold, their light at rest and at
 *  the return (L3), and how long before the return it brightens (s - a Beat plate's; a Crumble pin's over its rewind). */
export const SD_GHOST = Object.freeze({ px: 2, hand: 0.9, lift: 0.02, color: SD_LIGHT.gold, base: 0.45, peak: 1.1, rise: 0.3 });
/** The steps a ghost can stand for, in the course's order: the Beat's plates and the Crumble's pins. */
export const SD_GHOST_STEPS = Object.freeze(SD_STEPS_COURSE.filter((s) => s.kind === 'beat' || s.kind === 'crumble'));
/** A ghost's segments: its box's twelve edges, then its hand. */
const SEGS = 13;
const FLOATS = 10;   // aA xyz, aB xyz, aM (slot, side, end, hand)
/** THE STATIC BUFFER: every ghost's segments as quads (six vertices each), in its step's own frame. Pure. */
export function sdGhostVertices() {
  const v = new Float32Array(SD_GHOST_STEPS.length * SEGS * 6 * FLOATS);
  let o = 0;
  const put = (a, b, slot, hand) => {
    for (const [side, end] of [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]) {
      v[o++] = a[0]; v[o++] = a[1]; v[o++] = a[2]; v[o++] = b[0]; v[o++] = b[1]; v[o++] = b[2];
      v[o++] = slot; v[o++] = side; v[o++] = end; v[o++] = hand;
    }
  };
  SD_GHOST_STEPS.forEach((s, slot) => {
    for (const [a, b] of stepEdges(s.kind)) put(a, b, slot, 0);
    put([0, 0, 0], [0, 0, 0], slot, 1);   // the hand: placed by its state
  });
  return v;
}

const N = SD_GHOST_STEPS.length;
export const SD_STEPS_PASS_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aA;
layout(location = 1) in vec3 aB;
layout(location = 2) in vec4 aM;   // its ghost, its side (-1, 1), its end (0, 1), whether it is the hand
uniform mat4 uVP;
uniform vec4 uStep[${N}];    // each ghost's top centre (the scene's frame)
uniform vec4 uState[${N}];   // alpha (0: none), the hand's share of a turn (1 at XII), brightness
uniform vec2 uViewport;      // px
uniform float uWidth;        // px
out float vK;
out vec3 vWorld;
const float LIFT = ${SD_GHOST.lift.toFixed(3)}, HAND = ${SD_GHOST.hand.toFixed(3)};
void main() {
  int i = int(aM.x + 0.5);
  vec4 st = uState[i];
  vK = 0.0; vWorld = vec3(0.0);
  if (st.x <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // no ghost: outside every clip
  vec3 A = aA, B = aB;
  // the hand: clockwise from XII (+z) as the eye sees it from above (+x on the right through the camera's one mirror)
  if (aM.w > 0.5) { float a = st.y * 6.283185307179586; A = vec3(0.0, LIFT, 0.0); B = vec3(sin(a) * HAND, LIFT, cos(a) * HAND); }
  vec3 wa = uStep[i].xyz + A, wb = uStep[i].xyz + B;
  vec4 ca = uVP * vec4(wa, 1.0), cb = uVP * vec4(wb, 1.0);
  const float E = 0.01;   // an end behind the eye: the segment cut at the near side
  if (ca.w < E && cb.w < E) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (ca.w < E) { float k = (E - ca.w) / (cb.w - ca.w); ca = mix(ca, cb, k); wa = mix(wa, wb, k); }
  else if (cb.w < E) { float k = (E - cb.w) / (ca.w - cb.w); cb = mix(cb, ca, k); wb = mix(wb, wa, k); }
  vec2 h = uViewport * 0.5, sa = ca.xy / ca.w * h, sb = cb.xy / cb.w * h, d = sb - sa;
  float L = length(d);
  d = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  bool far = aM.z > 0.5;
  vec4 c = far ? cb : ca;
  c.xy += (n * aM.y + d * (far ? 1.0 : -1.0)) * (uWidth * 0.5) / h * c.w;   // square caps: the corners meet
  gl_Position = c;
  vK = st.x * st.z;
  vWorld = far ? wb : wa;
}`;
export const SD_STEPS_PASS_FS = `#version 300 es
precision highp float;
in float vK;
in vec3 vWorld;
uniform vec3 uColor;
uniform float uSteps;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}
void main() {
  if (vK <= 0.0) discard;
  o = vec4(sdPixel(uColor * vK, floor(gl_FragCoord.xy), uSteps) * fogFactorAt(vWorld), 1.0);
}`;

/** The ghosts' pass. */
export class SdStepsPass {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, SD_STEPS_PASS_VS, SD_STEPS_PASS_FS, 'sd steps ghosts');
    this.u = {};
    for (const n of ['uVP', 'uStep', 'uState', 'uViewport', 'uWidth', 'uColor', 'uSteps', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.program, n);
    const verts = sdGhostVertices();
    this.count = verts.length / FLOATS;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const S = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 24);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    this._viewport = new Float32Array(2);
    this.drawn = false;
  }
  /** Add the ghosts (`step`, `state`: SD_GHOST_STEPS.length vec4s each, written in place by the Steps) onto the frame,
   *  `steps` the pixel law's levels, `vw` x `vh` the world image (px - the drawing buffer's when not said). Answers
   *  whether any drew. */
  draw(proj, view, step, state, fog = null, steps = 10, vw = 0, vh = 0) {
    this.drawn = false;
    let any = false;
    for (let i = 0; i < N; i++) if (state[i * 4] > 0) { any = true; break; }
    if (!any) return false;
    const gl = this.gl, U = this.u, V = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) V[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    const h = vh || gl.drawingBufferHeight;
    this._viewport[0] = vw || gl.drawingBufferWidth; this._viewport[1] = h;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, V);
    gl.uniform4fv(U.uStep, step); gl.uniform4fv(U.uState, state);
    gl.uniform2fv(U.uViewport, this._viewport);
    gl.uniform1f(U.uWidth, SD_GHOST.px * telegraphLineW(h));
    gl.uniform3f(U.uColor, SD_GHOST.color[0], SD_GHOST.color[1], SD_GHOST.color[2]);
    gl.uniform1f(U.uSteps, steps);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_FOG_RANGE3);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    this.drawn = true;
    return true;
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
  }
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOG_RANGE3 = new Float32Array(3);
