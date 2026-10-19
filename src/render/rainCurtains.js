// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV4 - THE CURTAINS, SEEN FROM ABOVE (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-27): "Every detail like weather patterns, should be 1:1
// in this mode." VC7c hangs a veil under every cell whose weather falls
// (render/volumetricClouds.js CURTAIN_*), and draws it into the SKY MAP
// - for rays that look up, composited only on far-plane pixels. From a
// camera 450 m up the ground fills the picture, so a storm three leagues
// off was a dark patch in the deck and nothing under it: the rain it was
// dropping stood nowhere in the view.
//
// This is the same veil, stood in the WORLD for the travel view: a
// cylinder of CURTAIN_SHARE of the cell's radius, from under the ground
// (the depth the world wrote cuts its foot where the hills stand) up
// into the cell's base (CURTAIN_INTO), its optical depth CURTAIN_EXT a
// metre at a full fall - the CHORD a ray of sight takes through the
// solid cylinder at that fragment (2 R cos of the angle to the face's
// normal: a back face's chord is none), so a curtain reads dense through
// its middle and thin at its rim, as a column of rain does - streaked by
// CURTAIN_STREAKS streaks around its axis sliding down with the fall,
// and fading as the eye comes over it (the falling rain takes over: the
// player's own precipitation, VC7c's `near` law). The fog thins it as it
// thins the ground, measured from the traveller (uFocus - the view's
// whole point, render/fogGlsl.js). Rain grey-blue, snow paler
// (CURTAIN_FALL's kind); the frame's own light greys it at night.
//
// NOTHING IS INVENTED: the cells are the weather map's (WEATHER3c
// skyCells through world.js fieldCellsHere, the ones the clouds draw), at
// the shared minute - two players in the view see the same storm in the
// same place. A sandstorm is a wall on the ground already; fog and cloud
// do not fall.
//
// A FOREIGN PASS on the world host alone (the renderer's markForeignPass
// follows it), drawn only while the travel view is up.
// ═══════════════════════════════════════════════════════════════════
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { ringVertices } from './duelWall.js';
import { shapeBound } from '../systems/weather/weatherMap.js';   // AUDIT DEEP2 D1: the most a storm's outline reaches
import { CURTAIN_SHARE, CURTAIN_EXT, CURTAIN_STREAKS, CURTAIN_INTO, CELL_EDGE } from './volumetricClouds.js';

/** Quads around a curtain. */
export const CURTAIN_SEGMENTS = 48;
/** The most curtains a frame draws - the nearest to the traveller. */
export const CURTAINS_MAX = 8;
/** How far past the view's reach a curtain may stand and still be drawn (m) - the far plane is 6 km off the eye. */
export const CURTAIN_REACH_M = 7000;
/** How far under the traveller's ground a curtain's foot reaches (m) - the world's depth cuts it wherever the land is. */
export const CURTAIN_BELOW_M = 300;
/** AUDIT TV D3: how far under the LOWEST ground about the curtain its foot reaches (m) - a storm over a valley deeper
 *  than CURTAIN_BELOW_M under the traveller hung its foot in the air over the valley floor. */
export const CURTAIN_FOOT_MARGIN_M = 40;
/** ...and where that ground is asked: the centre and this many points around the veil's rim. */
export const CURTAIN_FOOT_SAMPLES = 8;
/** AUDIT DEEP R-5: the most a veil thins for the traveller standing inside it (the eye still outside) - their own storm
 *  stays a storm from the air: the falling rain around them is 1.6 cm streaks, under a pixel from 150 m up. */
export const CURTAIN_OWN_ALPHA = 0.35;
/** PERF-TV: how far a veil drifts (m) before its lowest land is asked again. */
export const CURTAIN_MEMO_M = 32;
/** Rain's and snow's colour, display-encoded (the lit lane's frame image is 8-bit and display encoded - airPass.js). */
export const CURTAIN_RAIN_COLOR = Object.freeze([0.5, 0.54, 0.6]);
export const CURTAIN_SNOW_COLOR = Object.freeze([0.84, 0.86, 0.9]);
const _mix = new Float32Array(3);
/** PRECIP1: the curtain's colour at its snow share `k` (0 rain, 1 snow) - one scratch, read before the next. */
export function mixColor(a, b, k) {
  const t = Math.min(1, Math.max(0, Number(k) || 0));
  for (let i = 0; i < 3; i++) _mix[i] = a[i] + (b[i] - a[i]) * t;
  return _mix;
}
/** The streaks' fall, cycles a second up the curtain's height (a whole number over the clock's period, so it never
 *  stutters as a float's seconds grow - duelWall.js's law). */
export const CURTAIN_CLOCK_PERIOD = 120;
export const CURTAIN_FALL_HZ = 0.25;
export const curtainClock = (s) => ((s % CURTAIN_CLOCK_PERIOD) + CURTAIN_CLOCK_PERIOD) % CURTAIN_CLOCK_PERIOD;

/**
 * THE CURTAINS TO DRAW, nearest the traveller first: the cells that fall (VC7c's own `fall`, grown with its system),
 * whose veil stands within CURTAIN_REACH_M of the focus, at most CURTAINS_MAX, each a cylinder in the scene -
 * `centre` (x, foot y, z), `radius`, `height` (foot to a little into the base), `depth` (the extinction a metre),
 * `kind` (0 rain, 1 snow) and `alpha` (the fade as the eye - or the traveller - comes over it). A storm cell's clip keeps
 * its veil inside the disc it paints within. Pure.
 * @param {Array<any>} cells - world.js fieldCellsHere's, in the host's metres (volumetricClouds.js cellOfField)
 * @param {{ focus: number[], eye: number[], ground?: number, groundAt?: (x:number, z:number) => number, reach?: number,
 *   memo?: Map<string, number>|null }} at
 *   - the traveller's head, the view's eye, the traveller's ground (y) the deck's heights are measured from, the land's
 *   height anywhere (the host's: the built grid, the far ring past it) for the foot, and how far the frame's fog lets
 *   anything be seen (AUDIT DEEP R-6: a veil past it is wholly fogged - a slot and a fill for nothing), and `memo` a Map
 *   the host keeps and empties when its ground changes (PERF-TV)
 */
export function curtainsOf(cells, { focus, eye, ground = null, groundAt = null, reach = CURTAIN_REACH_M, memo = null }) {
  const far = Math.min(CURTAIN_REACH_M, Number.isFinite(reach) && reach > 0 ? reach : CURTAIN_REACH_M);
  const g = ground ?? focus?.[1] ?? 0;
  const out = [];
  for (const c of cells ?? []) {
    if (!c || !(c.fall > 0) || !Number.isFinite(c.x) || !Number.isFinite(c.z) || !(c.r > 0)) continue;
    // AUDIT DEEP2 D1: THE VEIL IS THE STORM'S OWN SHAPE (WEATHER3h, VC7c's veilAcross): its outline's reach at every
    // bearing, not a circle - rain stretches its outline to 1.67x and down to 0.22x. And a storm's CLIP (its front's core,
    // shaped too) is weighed in the shader across its rim, as VC7c weighs it - shrinking the radius to the clip made a
    // storm whose centre sat 50 m inside its front a column 50 m wide, where the sky drew a lens a kilometre across.
    const shape = packShape(c.shape);
    const radius = c.r * CURTAIN_SHARE;
    if (!(radius > 1)) continue;
    const reachOut = radius * shapeBound(c.shape);
    const clip = c.clip ? { x: c.clip[0], z: c.clip[1], r: c.clip[2], rim: Math.max(1, c.edge ?? c.r * CELL_EDGE), shape: packShape(c.clip[3]) } : null;
    if (clip && Math.hypot(c.x - clip.x, c.z - clip.z) - reachOut > clip.r * shapeBound(c.clip[3])) continue;   // wholly outside its front: nothing falls
    const d = Math.hypot(c.x - focus[0], c.z - focus[2]);
    if (d - reachOut > far) continue;
    const base = (c.base ?? 600) + ((c.top ?? c.base ?? 600) - (c.base ?? 600)) * CURTAIN_INTO;
    // VC7c's `near`: as the eye comes over the veil it thins to nothing - the rain the player stands in is theirs.
    // AUDIT TV D2: and as the TRAVELLER does - a traveller inside the veil with the eye still outside it was seen
    // through the whole cylinder's chord, the storm's full depth drawn in front of the very ground they stand on
    // AUDIT DEEP R-5: ...but only down to CURTAIN_OWN_ALPHA - the traveller's own storm stays a storm from the air
    const ramp = (dist) => Math.min(1, Math.max(0, (dist - radius * 0.85) / (radius * 0.3)));
    const alpha = ramp(Math.hypot(c.x - eye[0], c.z - eye[2])) * Math.max(CURTAIN_OWN_ALPHA, ramp(d));
    if (alpha <= 0.001) continue;
    out.push({ centre: [c.x, 0, c.z], radius, height: base, depth: CURTAIN_EXT * c.fall, kind: c.fallKind ?? 0, alpha, d, shape, clip });   // PRECIP1: the snow share, 0..1
  }
  out.sort((a, b) => a.d - b.d);
  const kept = [];
  // AUDIT DEEP R-4: the LOWEST LAND's rule wherever the host knows the land - the traveller's own (CURTAIN_BELOW_M under
  // their ground) only where it knows none. Kept under both, a storm off a coast hung 300 m of veil down through the
  // sea, whose surface writes no depth to cut it. PERF-TV: asked of the curtains DRAWN alone - seventeen samples of
  // the land a cell, for every falling cell in reach, was the pass's whole cost before a veil was stood
  for (const k of out) {
    if (kept.length >= CURTAINS_MAX) break;
    // PERF-TV: `memo` (a Map the host empties when its ground changes) keeps a veil's lowest land while it drifts
    // within CURTAIN_MEMO_M - a storm moves with the wind, the land under it does not
    const key = memo ? `${Math.round(k.centre[0] / CURTAIN_MEMO_M)},${Math.round(k.centre[2] / CURTAIN_MEMO_M)},${Math.round(k.radius / CURTAIN_MEMO_M)}` : null;
    let lo = key !== null ? memo.get(key) : undefined;
    if (lo === undefined) {
      lo = lowestGround(groundAt, k.centre[0], k.centre[2], k.radius);
      if (key !== null) { if (memo.size >= 256) memo.clear(); memo.set(key, lo); }
    }
    const foot = Number.isFinite(lo) ? lo - CURTAIN_FOOT_MARGIN_M : g - CURTAIN_BELOW_M;
    k.centre[1] = foot;
    k.height = g + k.height - foot;
    // AUDIT DEEP2 D5: a veil over land higher than its own top cannot be drawn - it takes no slot from the next one
    if (k.height > 0) kept.push(k);
  }
  return kept;
}

/** AUDIT DEEP2 D1: a WEATHER3h shape as the shader takes it - two vec4s, n c2 s2 c3 | s3 c4 s4 (0) - a circle for none. */
export function packShape(sh) {
  return sh ? [sh[0], sh[1], sh[2], sh[3], sh[4], sh[5], sh[6], 0] : [1, 0, 0, 0, 0, 0, 0, 0];
}

/** AUDIT TV D3: the lowest land under a veil - its centre, CURTAIN_FOOT_SAMPLES points on its rim and as many half way in
 *  (AUDIT DEEP R-4: the foot now stands on these alone, so a valley inside the veil is looked for too) - Infinity with no
 *  host, or none of it known: the traveller's own rule stands. */
export function lowestGround(groundAt, x, z, radius) {
  if (typeof groundAt !== 'function') return Infinity;
  let lo = Infinity;
  const at = (px, pz) => { const h = groundAt(px, pz); if (Number.isFinite(h) && h < lo) lo = h; };
  at(x, z);
  for (let i = 0; i < CURTAIN_FOOT_SAMPLES; i++) {
    const a = (i / CURTAIN_FOOT_SAMPLES) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    at(x + ca * radius, z + sa * radius);
    at(x + ca * radius * 0.5, z + sa * radius * 0.5);
  }
  return lo;
}

const HEAD = `#version 300 es
precision highp float;
`;
// AUDIT DEEP2 D1: volumetricClouds.js's shapeF, the same polynomial - the veil's outline and its clip's
const SHAPE_GLSL = `
float shapeF(vec4 a, vec4 b, vec2 u) {
  float c = u.x, s = u.y;
  float c2 = c * c - s * s, s2 = 2.0 * c * s, c3 = c * (4.0 * c * c - 3.0), s3 = s * (3.0 - 4.0 * s * s), c4 = 2.0 * c2 * c2 - 1.0, s4 = 2.0 * s2 * c2;
  return a.x * (1.0 + a.y * c2 + a.z * s2 + a.w * c3 + b.x * s3 + b.y * c4 + b.z * s4);
}
float shapedDist(vec2 v, vec4 a, vec4 b) { float l = length(v); return l / shapeF(a, b, v / max(l, 1e-3)); }
`;
export const CURTAIN_VS = HEAD + `layout(location = 0) in vec2 aUV;   // x: around 0..1, y: up 0..1
uniform mat4 uVP;
uniform vec3 uCentre;
uniform float uRadius;
uniform float uHeight;
uniform vec4 uShapeA;    // AUDIT DEEP2 D1: the storm's outline (WEATHER3h)
uniform vec4 uShapeB;
out vec2 vUV;
out vec3 vWorld;
out vec2 vNormal;
out float vReach;        // the outline's reach at this bearing (m)
${SHAPE_GLSL}
void main() {
  float a = aUV.x * 6.283185307179586;
  vec2 n = vec2(cos(a), sin(a));
  float r = uRadius * shapeF(uShapeA, uShapeB, n);
  vec3 p = uCentre + vec3(n.x * r, aUV.y * uHeight, n.y * r);
  vUV = aUV;
  vWorld = p;
  vNormal = n;
  vReach = r;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const CURTAIN_FS = HEAD + `in vec2 vUV;
in vec3 vWorld;
in vec2 vNormal;
in float vReach;
uniform vec3 uEye;       // the view's own eye - the chord is the line of sight's
uniform float uRadius;
uniform vec4 uClip;      // AUDIT DEEP2 D1: a storm's front: x, z, its reach (-1 none), the cell's rim
uniform vec4 uClipA;
uniform vec4 uClipB;
uniform float uHeight;
uniform float uDepth;    // extinction a metre (CURTAIN_EXT x the cell's fall)
uniform float uAlpha;
uniform float uTime;     // curtainClock's seconds
uniform vec3 uColor;
uniform float uLight;    // the frame's light on it, 0..1
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
${SHAPE_GLSL}
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  // THE CHORD: the line of sight through the solid cylinder from this front-face point - 2 R cos(angle to the
  // face's normal), taken on the ground plane (the veil is vertical)
  vec2 toEye = uEye.xz - vWorld.xz;
  float len = length(toEye);
  float c = len > 1e-3 ? max(0.0, dot(vNormal, toEye / len)) : 0.0;
  float chord = 2.0 * vReach * c;   // the outline's own reach here (AUDIT DEEP2 D1)
  // the streaks around its axis, sliding down with the fall, and their fibres
  float k = floor(vUV.x * ${CURTAIN_STREAKS}.0);
  float streak = 0.6 + 0.8 * hash(k);
  float fibre = 0.85 + 0.3 * hash(floor(vUV.x * ${CURTAIN_STREAKS * 3}.0) + 17.0);
  float slide = 0.9 + 0.1 * sin(6.283185307179586 * (vUV.y * 6.0 + uTime * ${CURTAIN_FALL_HZ.toFixed(2)}));
  float tau = uDepth * chord * streak * fibre * slide;
  // the top thins into the base it falls from; the foot is the ground's to cut
  float top = 1.0 - smoothstep(0.92, 1.0, vUV.y);
  // AUDIT DEEP2 D1: inside its front's core, across the cell's rim - VC7c's veilAcross, the same weight
  float clip = uClip.z > 0.0 ? 1.0 - smoothstep(uClip.z - uClip.w, uClip.z, shapedDist(vWorld.xz - uClip.xy, uClipA, uClipB)) : 1.0;
  float a = (1.0 - exp(-tau)) * top * clip * uAlpha * fogFactorAt(vWorld);
  o = vec4(uColor * uLight * a, a);   // premultiplied
}`;

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_WATER_FOG = new Float32Array(20);
const NO_HAZE = new Float32Array(8);   // BANTHA1: uJungleHaze off ([1].x 0)
const NO_FOCUS = new Float32Array(4);
const CIRCLE = packShape(null);

export class RainCurtainsRenderer {
  constructor(gl) {
    this.gl = gl;
    const prog = buildProgram(gl, CURTAIN_VS, CURTAIN_FS);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uCentre', 'uRadius', 'uHeight', 'uEye', 'uDepth', 'uAlpha', 'uTime', 'uColor', 'uLight', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uDwFog', 'uJungleHaze', 'uFocus', 'uShapeA', 'uShapeB', 'uClip', 'uClipA', 'uClipB']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = ringVertices(CURTAIN_SEGMENTS);
    this.count = verts.length / 2;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
    this._vp = new Float32Array(16);
    this.drawn = 0;
  }

  /**
   * Draw the curtains (curtainsOf's list) from `eye` - the frame's own - with `light` the frame's light on them and
   * `fog` the frame's fog as the renderer set it ({ mode, density, range, camPos, focus, dw }), `fade` the view's rise
   * (AUDIT TV D1: the curtains come in with the view as OPACITY - scaling the light instead drew them near black over
   * the ground while the camera rose). Nothing to draw, nothing touched. Returns how many it drew.
   */
  draw(curtains, proj, view, eye, seconds, { light = 1, fog = null, fade = 1 } = {}) {
    this.drawn = 0;
    const k = Math.max(0, Math.min(1, fade));
    const list = k > 0.001 ? (curtains ?? []).filter((c) => c && c.alpha > 0.001 && c.radius > 0 && c.height > 0).slice(0, CURTAINS_MAX) : [];
    if (!list.length) return 0;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(U.uTime, curtainClock(seconds));
    gl.uniform1f(U.uLight, Math.max(0, Math.min(1, light)));
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);   // TV1's focus: the fog is the traveller's
    if (U.uDwFog) gl.uniform4fv(U.uDwFog, fog?.dw ?? NO_WATER_FOG);
    if (U.uJungleHaze) gl.uniform4fv(U.uJungleHaze, fog?.haze ?? NO_HAZE);   // BANTHA1: the jungle's haze (renderer.setJungleHaze); none handed, off
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);   // both faces reach the shader: a back face's chord is zero, so it adds nothing (no winding to trust under the mirrored lens)
    for (const c of list) {
      gl.uniform3f(U.uCentre, c.centre[0], c.centre[1], c.centre[2]);
      gl.uniform1f(U.uRadius, c.radius);
      gl.uniform1f(U.uHeight, c.height);
      const sh = c.shape ?? CIRCLE, cl = c.clip;   // AUDIT DEEP2 D1
      gl.uniform4f(U.uShapeA, sh[0], sh[1], sh[2], sh[3]); gl.uniform4f(U.uShapeB, sh[4], sh[5], sh[6], sh[7]);
      if (cl) { gl.uniform4f(U.uClip, cl.x, cl.z, cl.r, cl.rim); const ks = cl.shape ?? CIRCLE; gl.uniform4f(U.uClipA, ks[0], ks[1], ks[2], ks[3]); gl.uniform4f(U.uClipB, ks[4], ks[5], ks[6], ks[7]); } else gl.uniform4f(U.uClip, 0, 0, -1, 1);
      gl.uniform1f(U.uDepth, c.depth);
      gl.uniform1f(U.uAlpha, Math.min(1, c.alpha) * k);
      gl.uniform3fv(U.uColor, mixColor(CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, c.kind));   // PRECIP1: a curtain over the snow line greys toward white
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return this.drawn;
  }
}
