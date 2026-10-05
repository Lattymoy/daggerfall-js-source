// @ts-check
// NODE-MARKS (2026-10-01, Mac: "Any profession node, like herbs, should appear on the compass. The node itself should
// also stand out with a detailed slight glow or something"): A NODE'S GLOW - every gathering node standing near the
// player (a herb patch, a vein, a boulder, a tree, a school, a body: scenes/gatherHost.js marks) lit softly in its
// profession's colour (ui/nodeMarks.js - the colour its compass mark wears), so the eye finds what the compass points at.
//
// ONE CARD A NODE, turned about the upright to face the eye and stood a little toward it (NODE_GLOW_PULL), so the light
// lies over the node's own picture rather than behind it. Three things in it, each answered per pixel from where the
// fragment stands on the card in metres:
//   - THE HALO: soft across, rising out of nothing at the ground (so where the ground cuts the card no edge shows) to
//     its body low on the node and thinning to the node's crown; it breathes.
//   - THE SHIMMER: a soft band of light climbing the halo, once every few seconds.
//   - THE MOTES: NODE_GLOW_MOTES sparks drifting up out of the node, each at its own pace and place, twinkling as they
//     climb, born and gone dark (a herbalist's pollen, an ore's glints, a tree's sap-light).
// Slight by intent: a glow the eye finds, never a beacon - and dimmer still with distance, to nothing at NODE_GLOW_M.
//
// The duel wall's law (render/duelWall.js): fixed geometry (one quad) placed by uniforms; added onto the frame (ONE,
// ONE), so it only ever brightens what stands behind it; tested against the depth the world wrote (the node's own
// sprite, a rock or a wall in front hides it) and never writing it; fogged to the frame's fog, from the travel view's
// focus when one is set; every rate a whole number of cycles over the wrapped clock (NODE_GLOW_PERIOD), so the picture
// at the wrap is the picture at zero. Pure where it can be: `nodeGlows` (who is drawn, how bright) and `nodeGlowClock`.
//
// AUDIT NODE-MARKS (Mac: "Audit this"): UNDER REDUCED MOTION IT STANDS STILL - the halo steady, no shimmer, the motes
// held where they are (`uStill`), the professions' own law (ui/profHud.js: every act has a still form); its program is
// built at idle once a node is first marked, never on the frame that first lights one (PERF-WARM's law); and a pass that
// ran is a foreign pass whatever it drew.
//
// Not a DFU member.
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { nodeMarkRgb } from '../ui/nodeMarks.js';

/** The farthest a node glows from the eye (m), and where its fade toward nothing begins. */
export const NODE_GLOW_M = 120;
export const NODE_GLOW_FADE_M = 80;
/** The most nodes one frame lights (the gathering host's NODE_MARK_MAX, nearest first). */
export const NODE_GLOW_MAX = 16;
/** How far toward the eye a node's card stands off its base (m) - over the node's own picture. */
export const NODE_GLOW_PULL = 0.6;
/** The seconds a node's glow takes to kindle when it first stands near (it comes into reach, or the day stands it). */
export const NODE_GLOW_KINDLE_S = 0.6;
/** The clock every rate is whole over (s), and the rates (cycles a second): the halo's breath, the shimmer's climb, the
 *  motes' rise (the first mote's, and each next one's step over it) and their twinkle. */
export const NODE_GLOW_PERIOD = 60;
export const NODE_GLOW_RATES = Object.freeze({ breath: 0.25, shimmer: 0.2, mote: 0.3, moteStep: 0.05, twinkle: 1.5 });
/** The motes a node sends up, and a mote's radius (m). */
export const NODE_GLOW_MOTES = 6;
export const NODE_GLOW_MOTE_R = 0.045;
/** How much light each part adds at its brightest: the halo's body, the shimmer's band, a mote's heart. */
export const NODE_GLOW_GAIN = Object.freeze({ halo: 0.3, shimmer: 0.14, mote: 0.85 });

/** The clock, wrapped: whole cycles of every rate over its period, so no stutter at the wrap. Pure. */
export const nodeGlowClock = (seconds) => ((seconds % NODE_GLOW_PERIOD) + NODE_GLOW_PERIOD) % NODE_GLOW_PERIOD;
/** Every rate is whole over the period - the last mote's included. Pure. */
export const nodeGlowRatesWhole = () => [
  NODE_GLOW_RATES.breath, NODE_GLOW_RATES.shimmer, NODE_GLOW_RATES.twinkle,
  ...Array.from({ length: NODE_GLOW_MOTES }, (_, i) => NODE_GLOW_RATES.mote + i * NODE_GLOW_RATES.moteStep),
].every((r) => Math.abs(r * NODE_GLOW_PERIOD - Math.round(r * NODE_GLOW_PERIOD)) < 1e-9);

/** A node's seed (0..1) from its key - each node its own breath and its own motes, the same every frame. Pure. */
export function nodeGlowSeed(key) {
  let h = 2166136261;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1009) / 1009;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** AUDIT NODE-MARKS (the independent pass): a place is any three numbers - the renderer's camera is a Float32Array
 *  (`_camPos`), which `Array.isArray` refuses, and nothing was ever lit for it. */
const isVec3 = (v) => v != null && typeof v === 'object' && v.length >= 3;

/**
 * @typedef {{ at: number[], w: number, h: number, rgb: readonly number[], alpha: number, seed: number }} NodeGlow
 * @typedef {{ nodes: Map<string, { kindle: number, seen: number, seed: number }>, frame: number, lastS: number|null, pool: NodeGlow[] }} NodeGlowState
 */
/** A fresh state for `nodeGlows` - each node's kindling, by its key, and the records `out` is refilled from. */
export const createNodeGlowState = () => /** @type {NodeGlowState} */ ({ nodes: new Map(), frame: 0, lastS: null, pool: [] });

/**
 * WHO GLOWS THIS FRAME, AND HOW BRIGHT: of the gathering host's `marks` (`{ key, profession, at, w, h }`, nearest first),
 * those within NODE_GLOW_M of `eye`, at most NODE_GLOW_MAX - each kindling from nothing over NODE_GLOW_KINDLE_S when it
 * first stands near and fading toward nothing from NODE_GLOW_FADE_M to NODE_GLOW_M - written into `out` (one list,
 * refilled from the state's own records - AUDIT NODE-MARKS: none made a frame) and answered. A node no longer marked is
 * forgotten (it kindles again when it next stands near). `nowS` any clock in seconds. Pure but for `state` and `out`.
 * @param {ReadonlyArray<{ key: string, profession?: string, at: number[], w: number, h: number, rgb?: readonly number[], gain?: number }>|null|undefined} marks
 * @param {number[]|null|undefined} eye @param {number} nowS @param {NodeGlowState} state @param {NodeGlow[]} out
 */
export function nodeGlows(marks, eye, nowS, state, out) {
  out.length = 0;
  const dt = state.lastS === null ? 0 : Math.min(0.25, Math.max(0, nowS - state.lastS));
  state.lastS = nowS;
  const frame = ++state.frame;
  if (Array.isArray(marks) && isVec3(eye)) {
    for (const m of marks) {
      if (out.length >= NODE_GLOW_MAX) break;
      if (!m || !isVec3(m.at) || !(m.w > 0) || !(m.h > 0)) continue;
      const d = Math.hypot(m.at[0] - eye[0], m.at[1] - eye[1], m.at[2] - eye[2]);
      if (!(d <= NODE_GLOW_M)) continue;
      let n = state.nodes.get(m.key);
      if (!n) { n = { kindle: 0, seen: frame, seed: nodeGlowSeed(m.key) }; state.nodes.set(m.key, n); } else n.kindle = Math.min(1, n.kindle + dt / NODE_GLOW_KINDLE_S);
      n.seen = frame;
      // SENSE1: a mark may carry its own colour (`rgb`) and a gain over its kindling (`gain`, 0..1 - the sense pulse's
      // fade); a node carries neither and is lit as it always was
      const alpha = n.kindle * (1 - smooth(NODE_GLOW_FADE_M, NODE_GLOW_M, d)) * (Number.isFinite(m.gain) ? Math.min(1, Math.max(0, m.gain)) : 1);
      if (!(alpha > 0.001)) continue;
      const rgb = m.rgb ?? nodeMarkRgb(m.profession);
      const g = state.pool[out.length] ??= { at: m.at, w: 0, h: 0, rgb, alpha: 0, seed: 0 };
      g.at = m.at; g.w = m.w; g.h = m.h; g.rgb = rgb; g.alpha = alpha; g.seed = n.seed;
      out.push(g);
    }
  }
  for (const [key, n] of state.nodes) if (n.seen !== frame) state.nodes.delete(key);
  return out;
}

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
const f = (x) => x.toFixed(4);
/** One quad a node: x across (-1..1), y up (0 at its base, 1 at its crown). */
export const NODE_GLOW_VS = HEAD + `layout(location = 0) in vec2 aP;
uniform mat4 uVP;
uniform vec3 uAt;       // the node's base
uniform vec2 uSize;     // across, up (m)
uniform vec3 uEye;
uniform float uPull;    // how far toward the eye the card stands
out vec2 vM;            // metres on the card: across, up from the base
out vec3 vWorld;
void main() {
  vec3 toEye = uEye - uAt;
  vec2 fl2 = vec2(toEye.x, toEye.z);
  float fl = length(fl2);
  vec2 dir = fl > 1e-4 ? fl2 / fl : vec2(0.0, 1.0);
  vec3 across = vec3(dir.y, 0.0, -dir.x);                  // turned about the upright to face the eye
  vec3 base = uAt + vec3(dir.x, 0.0, dir.y) * min(uPull, fl * 0.5);   // stood toward it, never past half its way
  vM = vec2(aP.x * 0.5 * uSize.x, aP.y * uSize.y);
  vec3 p = base + across * vM.x + vec3(0.0, vM.y, 0.0);
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const NODE_GLOW_FS = HEAD + `in vec2 vM;
in vec3 vWorld;
uniform vec2 uSize;
uniform vec3 uColor;
uniform float uAlpha;   // its kindling and its distance's fade
uniform float uSeed;
uniform float uTime;    // nodeGlowClock's seconds
uniform float uStill;   // AUDIT NODE-MARKS: 1 under reduced motion - the halo steady, no shimmer, the motes held
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
const float TAU = 6.283185307179586;
float hash11(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
void main() {
  float hw = 0.5 * uSize.x, h = uSize.y;
  float qx = vM.x / hw, qy = vM.y / h;
  float tm = uTime * (1.0 - uStill);   // still: every moving part held at its seed's own place
  // THE HALO: soft across, narrowing as it climbs (a teardrop, not a column), and to nothing at the card's sides (no
  // edge shows); out of nothing at the ground, its body low on the node, thinning to its crown; breathing
  float across = exp(-qx * qx * (2.4 + 3.0 * qy)) * (1.0 - smoothstep(0.6, 1.0, abs(qx)));
  float up = smoothstep(0.0, 0.22, qy) * pow(max(1.0 - qy, 0.0), 1.5);
  float breath = mix(0.8 + 0.2 * sin(TAU * (tm * ${f(NODE_GLOW_RATES.breath)} + uSeed)), 0.9, uStill);
  float halo = across * up * breath;
  // THE SHIMMER: a soft band climbing it
  float band = exp(-pow((fract(qy - tm * ${f(NODE_GLOW_RATES.shimmer)} + uSeed) - 0.5) * 8.0, 2.0)) * across * up * (1.0 - uStill);
  // THE MOTES: each its own place, pace and twinkle, born and gone dark (so its leap from the crown to the root is unseen)
  float motes = 0.0;
  for (int i = 0; i < ${NODE_GLOW_MOTES}; i++) {
    float fi = float(i);
    float s = hash11(fi + uSeed * 31.0);
    float life = fract(tm * (${f(NODE_GLOW_RATES.mote)} + fi * ${f(NODE_GLOW_RATES.moteStep)}) + s);
    float mx = ((hash11(fi * 7.0 + uSeed * 13.0) * 2.0 - 1.0) * 0.6 + 0.08 * sin(life * TAU + fi * 2.3)) * hw;
    float my = (0.05 + 0.9 * life) * h;
    vec2 d = vM - vec2(mx, my);
    float r = ${f(NODE_GLOW_MOTE_R)} * (0.75 + 0.5 * s);
    float twinkle = 0.65 + 0.35 * sin(TAU * (tm * ${f(NODE_GLOW_RATES.twinkle)} + s));
    motes += exp(-dot(d, d) / (r * r)) * sin(life * 3.141592653589793) * twinkle;
  }
  float light = ${f(NODE_GLOW_GAIN.halo)} * halo + ${f(NODE_GLOW_GAIN.shimmer)} * band + ${f(NODE_GLOW_GAIN.mote)} * motes;
  o = vec4(uColor * light * uAlpha * fogFactorAt(vWorld), 1.0);
}`;

/** The card: x across (-1, 1), y up (0, 1). Pure. */
export function nodeGlowVertices() {
  return new Float32Array([-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1]);
}

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);   // no travel view - w 0, the fog measures from the camera
function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

export class NodeGlowRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, NODE_GLOW_VS, NODE_GLOW_FS, 'node glow');
    this.u = {};
    for (const n of ['uVP', 'uAt', 'uSize', 'uEye', 'uPull', 'uColor', 'uAlpha', 'uSeed', 'uTime', 'uStill', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus']) this.u[n] = gl.getUniformLocation(this.program, n);
    const verts = nodeGlowVertices();
    this.count = verts.length / 2;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** how many nodes the last draw lit, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Light the frame's nodes - `list` NodeGlows (already picked: nodeGlows) - with the frame's camera, its clock
   * (`seconds`, wrapped here) and its fog as the renderer set it ({ mode, density, range, camPos, focus }); `still` -
   * reduced motion's still form. Nothing to draw, nothing touched.
   * @param {ReadonlyArray<NodeGlow>} list
   */
  draw(list, proj, view, eye, seconds, fog = null, still = false) {
    this.drawn = 0;
    if (!Array.isArray(list) || !list.length || !eye) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, nodeGlowClock(seconds));
    gl.uniform1f(U.uStill, still ? 1 : 0);
    gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(U.uPull, NODE_GLOW_PULL);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    for (const g of list) {
      if (this.drawn >= NODE_GLOW_MAX) break;
      if (!g || !isVec3(g.at) || !(g.alpha > 0.001)) continue;
      gl.uniform3f(U.uAt, g.at[0], g.at[1], g.at[2]);
      gl.uniform2f(U.uSize, g.w, g.h);
      gl.uniform3f(U.uColor, g.rgb[0], g.rgb[1], g.rgb[2]);
      gl.uniform1f(U.uAlpha, Math.min(1, g.alpha));
      gl.uniform1f(U.uSeed, Number.isFinite(g.seed) ? g.seed : 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /** SENSE1 (EVERY ALLOCATION HAS AN OWNER): the program, the VAO and the buffer, freed - a dungeon's pass ends with
   *  its dungeon (the world host's lives as long as the page). */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.program); gl.deleteVertexArray(this.vao); gl.deleteBuffer(this.vbo);
    this.program = null; this.vao = null; this.vbo = null;
  }
}

/** AUDIT NODE-MARKS: the system's reduced motion, asked once a second at most - ui/profHud.js's own reading. */
function reducedMotionReader() {
  let at = -Infinity, reduced = false;
  return (nowS) => {
    if (nowS - at > 1) { at = nowS; try { reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { reduced = false; } }
    return reduced;
  };
}
/** PERF-WARM's idle wait (render/warmPrograms.js): a compile is moved to time the browser was going to spend idle. */
const idleCall = (fn) => (globalThis.requestIdleCallback ? globalThis.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0));

/**
 * THE WORLD HOST'S PASS: the gathering host's marks lit each frame under the camera and the fog the renderer drew the
 * world with (its `_proj`, `_view`, `_camPos`, `_fog*` and `_focus` - the auras' law), each node kindling as it first
 * stands near (nodeGlows). AUDIT NODE-MARKS: the program is built at IDLE once a node is first marked (`idle`, PERF-WARM's
 * wait) and nothing is lit until it stands - a node kindles from nothing over NODE_GLOW_KINDLE_S, so the wait is never
 * seen - in a try: a glow that will not build costs the glow, never the game, and is never tried again. A pass that ran
 * is a foreign pass (its program and its VAO went up whatever it drew). Under reduced motion it draws its still form
 * (`reduced`). `draw(marks)` answers how many it lit; `marks` null lights none and forgets every node.
 * @param {any} renderer
 * @param {{ now?: () => number, build?: (gl: any) => NodeGlowRenderer, idle?: (fn: () => void) => void, reduced?: (nowS: number) => boolean }} [o]
 */
export function createNodeGlowPass(renderer, { now = () => performance.now() / 1000, build = (gl) => new NodeGlowRenderer(gl), idle = idleCall, reduced = reducedMotionReader() } = {}) {
  const state = createNodeGlowState(), list = /** @type {NodeGlow[]} */ ([]);
  let pass = /** @type {NodeGlowRenderer|null} */ (null), asked = false, dead = false;
  const make = () => { if (dead) return; try { pass = build(renderer.gl); } catch (e) { console.warn('[prof] the nodes\' glow would not build', e?.message ?? e); pass = null; } };   // SENSE1: an idle build after the end builds nothing
  return {
    /** @param {Parameters<typeof nodeGlows>[0]} marks */
    draw(marks) {
      const proj = renderer._proj, view = renderer._view, eye = renderer._camPos;   // the frame's camera, the world's own
      const t = now();
      if (!asked && marks?.length) { asked = true; idle(make); }   // the first node marked: the compile, at idle
      if (!nodeGlows(marks, eye, t, state, list).length || !proj || !view || !pass) return 0;
      pass.draw(list, proj, view, eye, t, { mode: renderer._fogMode, density: renderer._fogDensity, range: renderer._fogRange, camPos: renderer._camPos, focus: renderer._focus }, reduced(t));
      renderer.markForeignPass();
      return pass.drawn;
    },
    /** SENSE1: the pass's end - its program freed, and never built again (an idle build still waiting builds nothing). */
    dispose() { dead = true; asked = true; pass?.dispose?.(); pass = null; },
  };
}
