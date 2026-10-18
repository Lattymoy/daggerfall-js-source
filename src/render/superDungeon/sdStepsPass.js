// @ts-check
// SD-LOOK S9 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 8): THE STEPS' GHOSTS - one additive draw
// for the whole course: a gone Beat plate, and a Crumble pin my own foot broke, hang as a thin gold outline exactly
// where the law will stand them again (the law's own box at the law's own anchored time - world/superDungeon/sdStepsModel.js
// stepEdges), each with its hand running back to XII as the return comes, brightening over its last moments.
//
// Lines as screen-width quads, SD_GHOST.px wide (gateTelegraph.js telegraphLineW's law - wider on a short screen), never
// GL_LINES (WebGL caps those at one pixel, gone on a high-DPI phone): a static buffer of every ghostable step's twelve
// edges and its hand, placed and lit by two uniform arrays the Steps write in place a frame (`step` - each top's centre,
// the scene's frame; `state` - alpha, the hand's share of a turn, brightness), so a frame makes nothing (AUDIT SD II L2
// F9). Posterized through the ordered dither (SD_PIXEL_GLSL), depth-tested and never written, fogged as the world is.
//
// EG-ZL (2026-10-12, bible/11-Multiplayer/Elite-Gates.md sections 10.3, 10.8 and 25.6): THE SPIRE'S GHOSTS through the
// same pass - a circle's gone Beats and my fallen Crumbles (and the Ossuary's bone bridges, the Crumble's law), as many as
// the circle lays (`max` - the uniforms' count for that pass; the Hour's stays its fifteen); A GHOST SLAB (`slab`): each
// ghost's top filled too, at its state's fourth share - a peer standing on a Crumble I have seen fall is drawn standing on
// it; and THE FOG FLOOR the Spire's lines keep (`fogFloor` - world/eliteGates/egLook.js EG_FOG_FLOOR: a fog visibility of at least its
// floor within its reach). Built without them, its text and its buffer are the Hour's, byte for byte.
//
// A foreign pass: it owns its program and its state; the host marks it. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from '../glProgram.js';
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from '../orderedDither.js';
import { telegraphLineW } from '../gate/gateTelegraph.js';
import { SD_LIGHT } from '../../world/superDungeon/sdLook.js';
import { SD_COURSE } from '../../world/superDungeon/sdSteps.js';
import { stepEdges } from '../../world/superDungeon/sdStepsModel.js';

/** The ghosts: their width (px), the hand's reach and lift over the top (m), their gold, their light at rest and at
 *  the return (L3), and how long before the return it brightens (s - a Beat plate's; a Crumble pin's over its rewind). */
export const SD_GHOST = Object.freeze({ px: 2, hand: 0.9, lift: 0.02, color: SD_LIGHT.gold, base: 0.45, peak: 1.1, rise: 0.3 });
/** The steps a ghost can stand for in `course` (EG-H3, EG4: a course record - net/eliteGates/egSpanLaw.js courseOf), in its order:
 *  the Beat's plates and the Crumble's pins. */
export const sdGhostStepsOf = (course) => course.steps.filter((s) => s.kind === 'beat' || s.kind === 'crumble');
/** The Hour's. */
export const SD_GHOST_STEPS = Object.freeze(sdGhostStepsOf(SD_COURSE));
/** EG-H3 (EG4): the pass's uniform count is a MAXIMUM - the Hour's fifteen; a course with more ghosts draws its first
 *  SD_GHOSTS_MAX. */
export const SD_GHOSTS_MAX = SD_GHOST_STEPS.length;
/** A ghost's segments: its box's twelve edges, then its hand. */
const SEGS = 13;
const FLOATS = 10;   // aA xyz, aB xyz, aM (slot, side, end, hand)
/** EG-ZL: a ghost slab's vertices - its top, two triangles (aM.w 2). */
const SLAB_VERTS = 6;
/** THE STATIC BUFFER: every ghost's segments as quads (six vertices each), in its step's own frame - `ghosts` a course's
 *  (sdGhostStepsOf; the Hour's by default), SD_GHOSTS_MAX at most. EG-ZL: `max` another count at most (a Spire circle's),
 *  and `slab` each ghost's top after its segments. Pure. */
export function sdGhostVertices(ghosts = SD_GHOST_STEPS, { max = SD_GHOSTS_MAX, slab = false } = {}) {
  const list = ghosts.slice(0, max);
  const v = new Float32Array(list.length * (SEGS * 6 + (slab ? SLAB_VERTS : 0)) * FLOATS);
  let o = 0;
  const put = (a, b, slot, hand) => {
    for (const [side, end] of [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]) {
      v[o++] = a[0]; v[o++] = a[1]; v[o++] = a[2]; v[o++] = b[0]; v[o++] = b[1]; v[o++] = b[2];
      v[o++] = slot; v[o++] = side; v[o++] = end; v[o++] = hand;
    }
  };
  list.forEach((s, slot) => {
    const edges = stepEdges(s.kind);
    for (const [a, b] of edges) put(a, b, slot, 0);
    put([0, 0, 0], [0, 0, 0], slot, 1);   // the hand: placed by its state
    if (!slab) return;
    // EG-ZL: its top, the box's four top corners (its first four edges' starts), wound up
    const c = [edges[0][0], edges[1][0], edges[2][0], edges[3][0]];
    for (const k of [0, 3, 2, 0, 2, 1]) { v[o++] = c[k][0]; v[o++] = c[k][1]; v[o++] = c[k][2]; v[o++] = 0; v[o++] = 0; v[o++] = 0; v[o++] = slot; v[o++] = 0; v[o++] = 0; v[o++] = 2; }
  });
  return v;
}

/** The vertex stage for `n` ghosts (EG-ZL: a Spire circle's count; the Hour's fifteen by default), and `slab` its tops'
 *  fill. */
export const sdStepsPassVs = (n = SD_GHOSTS_MAX, slab = false) => `#version 300 es
precision highp float;
layout(location = 0) in vec3 aA;
layout(location = 1) in vec3 aB;
layout(location = 2) in vec4 aM;   // its ghost, its side (-1, 1), its end (0, 1), whether it is the hand
uniform mat4 uVP;
uniform vec4 uStep[${n}];    // each ghost's top centre (the scene's frame)
uniform vec4 uState[${n}];   // alpha (0: none), the hand's share of a turn (1 at XII), brightness${slab ? ', its slab\'s fill' : ''}
uniform vec2 uViewport;      // px
uniform float uWidth;        // px
out float vK;
out vec3 vWorld;
const float LIFT = ${SD_GHOST.lift.toFixed(3)}, HAND = ${SD_GHOST.hand.toFixed(3)};
void main() {
  int i = int(aM.x + 0.5);
  vec4 st = uState[i];
  vK = 0.0; vWorld = vec3(0.0);
  if (st.x <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // no ghost: outside every clip${slab ? `
  if (aM.w > 1.5) {   // EG-ZL: its slab's top, lit while a peer stands on it
    if (st.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vWorld = uStep[i].xyz + aA + vec3(0.0, LIFT, 0.0);
    gl_Position = uVP * vec4(vWorld, 1.0);
    vK = st.x * st.z * st.w;
    return;
  }` : ''}
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
export const SD_STEPS_PASS_VS = sdStepsPassVs();
/** The fragment stage - EG-ZL: with `fogFloor`, its light keeps the Spire's fog floor (world/eliteGates/egLook.js egFogKept's law). */
export const sdStepsPassFs = (fogFloor = false) => `#version 300 es
precision highp float;
in float vK;
in vec3 vWorld;
uniform vec3 uColor;
uniform float uSteps;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;${fogFloor ? `
uniform vec3 uFogFloor;   // floor, within, ease (m)` : ''}
out vec4 o;
${FOG_FACTOR_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}
void main() {
  if (vK <= 0.0) discard;${fogFloor ? `
  float kept = uFogFloor.x * (1.0 - smoothstep(uFogFloor.y, uFogFloor.y + uFogFloor.z, distance(vWorld, uCamPos)));
  o = vec4(sdPixel(uColor * vK, floor(gl_FragCoord.xy), uSteps) * max(fogFactorAt(vWorld), kept), 1.0);` : `
  o = vec4(sdPixel(uColor * vK, floor(gl_FragCoord.xy), uSteps) * fogFactorAt(vWorld), 1.0);`}
}`;
export const SD_STEPS_PASS_FS = sdStepsPassFs();

/** The ghosts' pass. */
export class SdStepsPass {
  /** @param {WebGL2RenderingContext} gl @param {ReadonlyArray<any>} [ghosts] a course's ghosts (sdGhostStepsOf - EG-H3)
   *  @param {{ max?: number, slab?: boolean, fogFloor?: { floor: number, within: number, ease: number } | null }} [opts] EG-ZL:
   *  the Spire's - its count, its slabs and its fog floor */
  constructor(gl, ghosts = SD_GHOST_STEPS, { max = SD_GHOSTS_MAX, slab = false, fogFloor = null } = {}) {
    this.gl = gl;
    this.n = max;
    this.fogFloor = fogFloor;
    this.program = buildProgram(gl, max === SD_GHOSTS_MAX && !slab ? SD_STEPS_PASS_VS : sdStepsPassVs(max, slab), fogFloor ? sdStepsPassFs(true) : SD_STEPS_PASS_FS, 'sd steps ghosts');
    this.u = {};
    for (const n of ['uVP', 'uStep', 'uState', 'uViewport', 'uWidth', 'uColor', 'uSteps', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFogFloor']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.slab = slab;
    const verts = sdGhostVertices(ghosts, { max, slab });
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
   *  whether any drew. AUDIT EG III (lane4 #5): `color` their line's (the Steps' gold when not said - the Spire's
   *  ghosts take the danger palette's safety, scenes/eliteGates/egSpan.js egGhostRgb). */
  draw(proj, view, step, state, fog = null, steps = 10, vw = 0, vh = 0, color = SD_GHOST.color) {
    this.drawn = false;
    let any = false;
    for (let i = 0; i < this.n; i++) if (state[i * 4] > 0) { any = true; break; }
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
    gl.uniform3f(U.uColor, color[0], color[1], color[2]);
    gl.uniform1f(U.uSteps, steps);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_FOG_RANGE3);
    if (this.fogFloor) gl.uniform3f(U.uFogFloor, this.fogFloor.floor, this.fogFloor.within, this.fogFloor.ease);   // EG-ZL
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    this.drawn = true;
    return true;
  }
  /** EG-PERFECT's audit: the slots stand for other ghosts (`ghosts`, as the constructor's - this.n at most): their boxes laid
   *  again, the program and its uniforms kept (scenes/eliteGates/egSpan.js aimGhosts - a circle past its slots). */
  ghosts(ghosts) {
    const gl = this.gl, verts = sdGhostVertices(ghosts, { max: this.n, slab: this.slab });
    this.count = verts.length / FLOATS;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
  }
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOG_RANGE3 = new Float32Array(3);
