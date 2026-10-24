// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 25.3 and 25.6, and
// layer two's "still owed" tells): THE SPIRE'S LINES - THE EDGE LINE along every edge a member could fall from, the Rail's
// and the Drum's dashed track under its whole travel, and the Gust's streamers across its section, in one pass.
//
// SD-LOOK's ghosts' technique (render/superDungeon/sdStepsPass.js): every segment a screen-width quad (never GL_LINES - WebGL caps those
// at one pixel, gone on a high-DPI phone), two pixels on a desktop and three on a phone (world/eliteGates/egLook.js egEdgeLinePx),
// placed in the vertex stage from its two ends. The circle's edges and tracks are one static buffer made once a circle
// (world/eliteGates/egLook.js egCircleEdges); the streamers a small dynamic one written a frame from the breath's clock.
//   THE EDGE LINE  gold at its luminance (EG_EDGE_LINE.luma, the ambient rung - never pulsing), opaque over what it lies on;
//   A TRACK        the same gold, dashed EG_TRACK.dash on and off along its travel;
//   A STREAMER     white (the place's own timed hazard), throbbing at two beats a second (under WCAG's three);
//   THE TRAIL      AUDIT EG V (h; section 8.2): the first across's route once a span's door opens, the same gold faint
//                  (EG_TRAIL.alpha) and wider (EG_TRAIL.width), never pulsing - a small dynamic buffer of its own, written a
//                  frame (world/eliteGates/egLook.js egTrailSegs), freed with the pass.
// READABLE IN THE FOG (section 25.6): every line keeps a fog visibility of at least EG_FOG_FLOOR.floor within its
// `within` metres (world/eliteGates/egLook.js egFogKept - the same numbers), mixed toward the frame's own fog colour, and is drawn
// after every transparent volume (the mist - render/eliteGates/egMistPass.js) by its host (scenes/eliteGates/egLookDraw.js). Depth-tested,
// never written, pulled a hair toward the eye so it wins over the stone it lies on.
//
// A foreign pass: it owns its program and its state; the host marks it. Not a DFU member. Ledger A (ELITE-GATES).
import { buildProgram } from '../glProgram.js';
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { EG_LINE_KIND, EG_TRACK, EG_FOG_FLOOR, EG_TRAIL, egEdgeLineColor, egEdgeLinePx } from '../../world/eliteGates/egLook.js';

/** Floats a vertex: aA xyz, aB xyz, aM (side, end, kind, alpha). */
export const EG_LINE_FLOATS = 10;
/** The streamers' room (segments) - a hall's sections' worth, written a frame. */
export const EG_STREAMERS_MAX = 64;
/** The six corners of a segment's quad: [side, end]. */
const CORNERS = Object.freeze([[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]);

/**
 * Segments (six floats each - two ends) as the pass's vertices: six a segment, `kind` (EG_LINE_KIND) and an alpha each
 * (`alphas[i]`, 1 when none). Into `out` at vertex `at` when given (the dynamic buffer), else a new array. Pure.
 */
export function egLineVertices(segs, kind, alphas = null, n = segs.length / 6, out = null, at = 0) {
  const v = out ?? new Float32Array(n * 6 * EG_LINE_FLOATS);
  let o = at * EG_LINE_FLOATS;
  for (let i = 0; i < n; i++) {
    const a = alphas ? alphas[i] : 1;
    for (const [side, end] of CORNERS) {
      v[o++] = segs[i * 6]; v[o++] = segs[i * 6 + 1]; v[o++] = segs[i * 6 + 2]; v[o++] = segs[i * 6 + 3]; v[o++] = segs[i * 6 + 4]; v[o++] = segs[i * 6 + 5];
      v[o++] = side; v[o++] = end; v[o++] = kind; v[o++] = a;
    }
  }
  return v;
}

export const EG_LINE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aA;
layout(location = 1) in vec3 aB;
layout(location = 2) in vec4 aM;   // its side (-1, 1), its end (0, 1), its kind, its alpha
uniform mat4 uVP;
uniform vec2 uViewport;   // px
uniform float uWidth;     // px
out vec3 vWorld;
out float vAlong;         // metres from its A end
flat out int vKind;
out float vAlpha;
void main() {
  vec3 wa = aA, wb = aB;
  vec4 ca = uVP * vec4(wa, 1.0), cb = uVP * vec4(wb, 1.0);
  float L = length(wb - wa);
  vKind = int(aM.z + 0.5); vAlpha = aM.w; vAlong = 0.0; vWorld = wa;
  const float E = 0.01;   // an end behind the eye: the segment cut at the near side
  if ((ca.w < E && cb.w < E) || aM.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float ka = 0.0, kb = 1.0;
  if (ca.w < E) { ka = (E - ca.w) / (cb.w - ca.w); ca = mix(ca, cb, ka); wa = mix(aA, aB, ka); }
  else if (cb.w < E) { kb = 1.0 - (E - cb.w) / (ca.w - cb.w); cb = mix(ca, cb, kb); wb = mix(aA, aB, kb); }
  vec2 h = uViewport * 0.5, sa = ca.xy / ca.w * h, sb = cb.xy / cb.w * h, d = sb - sa;
  float l = length(d);
  d = l > 1e-4 ? d / l : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  bool far = aM.y > 0.5;
  vec4 c = far ? cb : ca;
  float w = vKind == ${EG_LINE_KIND.streamer} ? uWidth * 0.75 : vKind == ${EG_LINE_KIND.trail} ? uWidth * ${EG_TRAIL.width.toFixed(1)} : uWidth;
  c.xy += (n * aM.x + d * (far ? 1.0 : -1.0)) * (w * 0.5) / h * c.w;   // square caps: the corners meet
  c.z -= 0.0004 * c.w;   // a hair toward the eye: the line wins over the stone it lies on
  gl_Position = c;
  vWorld = far ? wb : wa;
  vAlong = (far ? kb : ka) * L;
}`;
export const EG_LINE_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in float vAlong;
flat in int vKind;
in float vAlpha;
uniform vec3 uGold;       // the edge line's gold at its luminance
uniform vec3 uWhite;      // the place's own hazard
uniform vec3 uFogColor;
uniform vec3 uFogFloor;   // floor, within, ease (m) - world/eliteGates/egLook.js EG_FOG_FLOOR
uniform float uTime;      // s
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  vec3 c = uGold;
  float a = 1.0;
  if (vKind == ${EG_LINE_KIND.track}) { if (fract(vAlong / ${(2 * EG_TRACK.dash).toFixed(3)}) > 0.5) discard; c = uGold * 0.85; }
  else if (vKind == ${EG_LINE_KIND.streamer}) { c = uWhite; a = vAlpha * (0.75 + 0.25 * cos(6.283185307179586 * 2.0 * uTime)); }
  else if (vKind == ${EG_LINE_KIND.trail}) a = ${EG_TRAIL.alpha.toFixed(2)};
  float d = distance(vWorld, uCamPos);
  float kept = uFogFloor.x * (1.0 - smoothstep(uFogFloor.y, uFogFloor.y + uFogFloor.z, d));
  float f = max(fogFactorAt(vWorld), kept);
  o = vec4(mix(uFogColor, c, f) * a, a);
}`;

/** FIRST-USE (#1144): the pass's one program, as its constructor builds it - what the hall's load starts and the
 *  look's door waits on (render/glProgram.js startPrograms, compiledPass). */
export const EG_LINE_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[EG_LINE_VS, EG_LINE_FS]]));

/** The pass. */
export class EgLinePass {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [[vs, fs]] = EG_LINE_PROGRAMS;
    this.program = buildProgram(gl, vs, fs, 'eg lines');
    this.u = {};
    for (const n of ['uVP', 'uViewport', 'uWidth', 'uGold', 'uWhite', 'uFogColor', 'uFogFloor', 'uTime', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.program, n);
    const mk = (usage, bytes) => {
      const vao = gl.createVertexArray(), vbo = gl.createBuffer();
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, bytes, usage);
      const S = EG_LINE_FLOATS * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 24);
      gl.bindVertexArray(null);
      return { vao, vbo };
    };
    this._static = null; this.staticCount = 0;
    this._dyn = mk(gl.DYNAMIC_DRAW, EG_STREAMERS_MAX * 6 * EG_LINE_FLOATS * 4);
    this._dynData = new Float32Array(EG_STREAMERS_MAX * 6 * EG_LINE_FLOATS);
    this._trail = mk(gl.DYNAMIC_DRAW, EG_TRAIL.max * 6 * EG_LINE_FLOATS * 4);   // AUDIT EG V (h): THE TRAIL's own
    this._trailData = new Float32Array(EG_TRAIL.max * 6 * EG_LINE_FLOATS);
    this._mk = mk;
    this._vp = new Float32Array(16);
    this._gold = egEdgeLineColor();
    this._white = EG_LINE_WHITE;
    this._pal = 'standard';
    this.drawn = 0;
  }
  /** AUDIT EG III (lane4 #5, sections 25.2, 25.3 and 25.7): the danger palette the lines are drawn in (ui/eliteGates/egAccess.js) -
   *  THE EDGE LINE in its safety at the line's luminance (world/eliteGates/egLook.js egEdgeLineColor), the tracks and streamers in its
   *  hazard; made again only when the palette changes. None: the Standard. */
  palette(pal) {
    const key = pal?.key ?? 'standard';
    if (key === this._pal) return;
    this._pal = key;
    this._gold = egEdgeLineColor(pal);
    this._white = Array.isArray(pal?.hazard) ? pal.hazard : EG_LINE_WHITE;
  }
  /** The circle's edges and tracks (world/eliteGates/egLook.js egCircleEdges), made the static buffer - once a circle. */
  setCircle(edges) {
    const gl = this.gl;
    if (this._static) { gl.deleteBuffer(this._static.vbo); gl.deleteVertexArray(this._static.vao); this._static = null; }
    if (!edges) { this.staticCount = 0; return; }
    const ne = edges.edge.length / 6, nt = edges.track.length / 6, v = new Float32Array((ne + nt) * 6 * EG_LINE_FLOATS);
    egLineVertices(edges.edge, EG_LINE_KIND.edge, null, ne, v, 0);
    egLineVertices(edges.track, EG_LINE_KIND.track, null, nt, v, ne * 6);
    this._static = this._mk(gl.STATIC_DRAW, v);
    this.staticCount = (ne + nt) * 6;
  }
  /**
   * Draw the circle's lines and `streamers` (six floats a segment, `n` of them, an alpha each in `alphas`) onto the frame
   * - `fog` the frame's ({ mode, density, range, color, camPos }), `seconds` any clock, `vw` x `vh` the world image (px).
   * AUDIT EG V (h): and THE TRAIL's `tn` segments `trail` (six floats a segment). Answers whether anything drew.
   */
  draw(proj, view, eye, seconds, fog = null, streamers = null, n = 0, alphas = null, vw = 0, vh = 0, trail = null, tn = 0) {
    this.drawn = 0;
    if (!this.staticCount && !(n > 0) && !(tn > 0 && trail)) return false;
    const gl = this.gl, U = this.u, V = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) V[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    const h = vh || gl.drawingBufferHeight;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, V);
    gl.uniform2f(U.uViewport, vw || gl.drawingBufferWidth, h);
    gl.uniform1f(U.uWidth, egEdgeLinePx(h));
    gl.uniform3f(U.uGold, this._gold[0], this._gold[1], this._gold[2]);
    gl.uniform3f(U.uWhite, this._white[0], this._white[1], this._white[2]);
    const fc = fog?.color ?? NO_FOG_COLOR;
    gl.uniform3f(U.uFogColor, fc[0], fc[1], fc[2]);
    gl.uniform3f(U.uFogFloor, EG_FOG_FLOOR.floor, EG_FOG_FLOOR.within, EG_FOG_FLOOR.ease);
    gl.uniform1f(U.uTime, seconds % 60);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? NO_FOG_COLOR);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    if (this.staticCount) { gl.bindVertexArray(this._static.vao); gl.drawArrays(gl.TRIANGLES, 0, this.staticCount); this.drawn++; }
    if (n > 0 && streamers) {
      const k = Math.min(n, EG_STREAMERS_MAX);
      egLineVertices(streamers, EG_LINE_KIND.streamer, alphas, k, this._dynData, 0);
      gl.bindVertexArray(this._dyn.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this._dyn.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._dynData, 0, k * 6 * EG_LINE_FLOATS);
      gl.drawArrays(gl.TRIANGLES, 0, k * 6);
      this.drawn++;
    }
    if (tn > 0 && trail) {
      const k = Math.min(tn, EG_TRAIL.max);
      egLineVertices(trail, EG_LINE_KIND.trail, null, k, this._trailData, 0);
      gl.bindVertexArray(this._trail.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this._trail.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._trailData, 0, k * 6 * EG_LINE_FLOATS);
      gl.drawArrays(gl.TRIANGLES, 0, k * 6);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    return this.drawn > 0;
  }
  destroy() {
    const gl = this.gl;
    this.setCircle(null);
    gl.deleteBuffer(this._dyn.vbo); gl.deleteVertexArray(this._dyn.vao); gl.deleteProgram(this.program);
    gl.deleteBuffer(this._trail.vbo); gl.deleteVertexArray(this._trail.vao);   // AUDIT EG V (h): THE TRAIL's
  }
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOG_COLOR = new Float32Array(3);
/** The place's white under the Standard (ui/eliteGates/egAccess.js EG_DANGER_PALETTES.standard.hazard - the tracks' and streamers'). */
const EG_LINE_WHITE = Object.freeze([0.95, 0.95, 1.0]);
