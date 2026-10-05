// @ts-check
// TACT4 - A FOE'S TELEGRAPH ON THE GROUND (bible/12-Enhanced-AI/Tactics-Arc.md): the world boss's floor telegraph
// (render/gateTelegraph.js) at a foe's scale - one flat quad at the foe's feet, the shape the fragment's question
// against ai/foeBlows.js inBlow (the pins hold `blowField` to it point for point, and the shader's text to it): a dim
// outline at once, filling outward as the wind-up runs, a bright flash at the landing. Depth-tested and never
// depth-written, lifted and offset off the ground. TELL2 (bible/12-Enhanced-AI/Feud-Arc.md 4.4): drawn in the boss's
// readable line (render/telegraphStyle.js), premultiplied over the frame (ONE, ONE_MINUS_SRC_ALPHA) - it was added on
// (ONE, ONE), which could only brighten; TELL3: an iron blow's second rim and hatch; TELL5: a cut feint fades dashed;
// TELL9: the player's telegraph contrast (a part of the Enhanced AI row) bolder over all of it.
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';   // AUDIT TACT D9: the renderer's one fog block
import { BLOW, TELL_NOW } from '../ai/blowShapes.js';   // the leaf - the brain stays off the renderer's boot graph
import { TELEGRAPH_STYLE_GLSL } from './telegraphStyle.js';   // TELL2: the boss's readable line, at a foe's scale (a leaf)
import { getPref } from '../systems/uiPrefs.js';   // TELL9: the telegraph contrast, the player's own

/** TELL9 (bible/12-Enhanced-AI/Feud-Arc.md 11.3): the player's telegraph contrast - thicker lines, a white keyline, a
 *  pattern for every guard. Read each draw: the switch flips the next frame. */
export const telegraphContrastOn = () => getPref('telegraphContrast') === true;

/** The shapes as the shader's `uKind` says them. */
export const BLOW_KIND = Object.freeze({ lunge: 0, sweep: 1, slam: 2, ring: 3, charge: 0, leap: 2, aimed: 0, pyre: 2 });   // RVN5: the pyre's disc the slam's too   // TELL6: the charge's lane and the aimed line are the lunge's branch, the leap's disc the slam's - each its own numbers
/** TELL6: a shape's reach from the foe's feet (its farthest point). */
const REACH = Object.freeze({ lunge: BLOW.lunge.len, sweep: BLOW.sweep.r, slam: BLOW.slam.ahead + BLOW.slam.r, ring: BLOW.ring.rOut, charge: BLOW.charge.len, leap: BLOW.leap.range + BLOW.leap.r, aimed: 0, pyre: BLOW.pyre.range + BLOW.pyre.r });
/** TELL6: a blow's quad half-extent - its own shape and the line's glow past its outline (TELL2 draws 0.5 m out), so a
 *  long shape does not enlarge every quad. A leap's by its own point (`ahead`). */
export const quadHalf = (kind, ahead = null) => (Number.isFinite(ahead) && (kind === 'leap' || kind === 'aimed' || kind === 'pyre') ? ahead + (kind === 'leap' ? BLOW.leap.r : kind === 'pyre' ? BLOW.pyre.r : 0) : REACH[kind] ?? BLOW_QUAD_HALF) + 0.6;   // the aimed line: its own length; RVN5: a pyre's by its point
/** The quad's half-extent about the foe's feet - every shape fits (TELL6: the charge's lane is the longest). */
export const BLOW_QUAD_HALF = Math.max(...Object.values(REACH)) + 0.3;
export const BLOW_LIFT = 0.06;
const OUTLINE = 0.12;   // metres of rim

/**
 * The shader's own reading in JS: at (across, along) in the blow's frame, the shape's field - `inside` (the point is
 * in the shape, inBlow's law), `edge` (0..1 how far out toward the rim: the fill's reach), and `rim` (within the
 * outline of the rim).
 */
export function blowField(kind, across, along, ahead = 0) {
  if (kind === 'lunge' || kind === 'charge') {   // TELL6: the charge's lane, the lunge's law
    const P = BLOW[kind];
    const inside = along >= -0.3 && along <= P.len && Math.abs(across) <= P.halfW;
    const edge = Math.max(0, (along + 0.3) / (P.len + 0.3));
    const rim = inside && (P.len - along < OUTLINE || along + 0.3 < OUTLINE || P.halfW - Math.abs(across) < OUTLINE);
    return { inside, edge, rim };
  }
  if (kind === 'sweep') {
    const P = BLOW.sweep, d = Math.hypot(across, along);
    const ang = d < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, along / d)));
    const inside = d <= P.r && (d < 0.5 || ang <= P.halfArc);
    const rim = inside && (P.r - d < OUTLINE || (d >= 0.5 && (P.halfArc - ang) * d < OUTLINE));
    return { inside, edge: d / P.r, rim };
  }
  if (kind === 'ring') {   // TELL6: the annulus, filling outward from its inner edge
    const P = BLOW.ring, d = Math.hypot(across, along);
    const inside = d >= P.rIn && d <= P.rOut;
    return { inside, edge: Math.max(0, (d - P.rIn) / (P.rOut - P.rIn)), rim: inside && (d - P.rIn < OUTLINE || P.rOut - d < OUTLINE) };
  }
  if (kind === 'aimed') {   // TELL6: the lunge's lane, its own length and width
    const W = BLOW.aimed.halfW, inside = along >= -0.3 && along <= ahead && Math.abs(across) <= W;
    return { inside, edge: Math.max(0, (along + 0.3) / (ahead + 0.3)), rim: inside && (ahead - along < OUTLINE || W - Math.abs(across) < OUTLINE) };
  }
  if (kind === 'leap' || kind === 'pyre') {   // TELL6: the slam's disc, at its own point (RVN5: a pyre's at its target's feet)
    const r = BLOW[kind].r, d = Math.hypot(across, along - ahead);
    return { inside: d <= r, edge: d / r, rim: d <= r && r - d < OUTLINE };
  }
  const P = BLOW.slam, d = Math.hypot(across, along - P.ahead);
  const inside = d <= P.r;
  return { inside, edge: d / P.r, rim: inside && P.r - d < OUTLINE };
}

const VS = `#version 300 es
layout(location = 0) in vec2 aCorner;
uniform mat4 uVP;
uniform vec3 uOrigin;
uniform float uYaw;
uniform float uHalf;
uniform float uLift;
uniform vec2 uSlope;   // AUDIT TACT D8: the ground's rise per metre (across, along) - the quad lies on the slope it marks
out vec2 vLocal;   // (across, along) in the blow's frame
out vec3 vWorld;   // AUDIT TACT D9: where the fog measures from
void main() {
  vec2 f = vec2(sin(uYaw), cos(uYaw));
  vec2 w = vec2(-f.y, f.x);   // across, as inBlow reads it: (-fz, fx)
  vLocal = aCorner * uHalf;
  vec2 xz = uOrigin.xz + w * vLocal.x + f * vLocal.y;
  vWorld = vec3(xz.x, uOrigin.y + uLift + dot(uSlope, vLocal), xz.y);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vLocal;
uniform int uKind;
uniform float uT;
uniform float uFlash;
uniform vec3 uColor;
uniform vec4 uP;   // lunge (TELL6: and the charge): len, halfW / sweep: r, halfArc / slam (and the leap): r, ahead / TELL6 ring: rIn, rOut
uniform float uNow;   // TELL2: 0..1 through the last stretch before the landing
uniform float uNearFloor;   // TELL2: the fog's floor for a mark near the player (0 none)
uniform float uIron;   // TELL3: 1 an iron blow - its second rim and its hatch
uniform float uCut;   // TELL5: a cut feint's fade, 1..0 (0 none) - it goes out dashed
uniform float uShatter;   // AUDIT TELL (3.2): a broken wind-up's shatter, 1..0 (0 none) - white and cracked, going out
uniform float uContrast;   // TELL9: 1 the player's telegraph contrast - the bolder line, the white keyline, the dots
in vec3 vWorld;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 oColor;
${FOG_FACTOR_GLSL}
${TELEGRAPH_STYLE_GLSL}
void main() {
  float across = vLocal.x, along = vLocal.y;
  bool inside = false;
  float edge = 0.0;   // the fill coordinate: 0 at its root, 1 at its far edge
  float dist = 0.0;   // TELL2: metres to the outline, unsigned (the line's, the keyline's and the glow's)
  if (uKind == 0) {
    inside = along >= -0.3 && along <= uP.x && abs(across) <= uP.y;
    edge = max(0.0, (along + 0.3) / (uP.x + 0.3));
    vec2 q = abs(vec2(across, along - (uP.x - 0.3) * 0.5)) - vec2(uP.y, (uP.x + 0.3) * 0.5);
    dist = abs(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));
  } else if (uKind == 1) {
    float d = length(vec2(across, along));
    float ang = d < 1e-9 ? 0.0 : acos(clamp(along / d, -1.0, 1.0));
    inside = d <= uP.x && (d < 0.5 || ang <= uP.y);
    edge = d / uP.x;
    // AUDIT TELL U8: the disc at its feet is the shape's too (ai/foeBlows.js inBlow) and wears the outline - behind the
    // arc its rim is the edge, and outside both the nearer of the two is
    dist = inside ? (d < 0.5 && ang > uP.y ? 0.5 - d : min(uP.x - d, d >= 0.5 ? (uP.y - ang) * d : 1e3)) : min(max(d - uP.x, (ang - uP.y) * d), d - 0.5);
  } else if (uKind == 2) {
    float d = length(vec2(across, along - uP.y));
    inside = d <= uP.x;
    edge = d / uP.x;
    dist = abs(uP.x - d);
  } else {   // TELL6: the ring - safe at its feet
    float d = length(vec2(across, along));
    inside = d >= uP.x && d <= uP.y;
    edge = max(0.0, (d - uP.x) / (uP.y - uP.x));
    dist = inside ? min(d - uP.x, uP.y - d) : (d < uP.x ? uP.x - d : d - uP.y);
  }
  // TELL2: the line, the keyline and the glow reach a little past the outline; nothing else outside it is drawn - AUDIT
  // TELL U10: drawn as nothing (below), never dropped ahead of the style's derivatives, which a 2x2 block shares
  bool beyond = !inside && dist > 0.5;
  // AUDIT TACT D9: fogged as the ground it lies on - never a glow through the murk; TELL2: never lost a step away
  float fogK = max(fogFactorAt(vWorld), uNearFloor);
  oColor = telegraphStyle(dist, inside ? 1.0 : 0.0, edge, uT, uNow, uFlash, uColor, fogK);
  if (uIron > 0.5) oColor = telegraphIron(oColor, dist, inside ? 1.0 : 0.0, vec2(across, along), uColor, fogK);   // TELL3
  if (uContrast > 0.5) oColor = telegraphContrast(oColor, dist, inside ? 1.0 : 0.0, vec2(across, along), uIron, uColor, fogK);   // TELL9
  if (uShatter > 0.0) {   // AUDIT TELL (3.2): the mark white and whole-filled, broken into shards along two crossing cracks
    float cr = min(abs(fract(across * 1.9 + along * 0.7) - 0.5), abs(fract(along * 1.3 - across * 0.6) - 0.5));
    float shard = inside ? smoothstep(0.04, 0.09, cr) : 1.0;
    oColor = telegraphStyle(dist, inside ? 1.0 : 0.0, edge, 1.0, 0.0, 0.0, vec3(1.0), fogK) * (uShatter * shard);
  }
  if (uCut > 0.0) oColor *= uCut * step(0.5, fract((across + along) * 2.5));   // TELL5: a feint cut - dashed, fading
  if (beyond) oColor = vec4(0.0);   // AUDIT TELL U10: premultiplied nothing - the blend leaves the floor as it was
}`;

const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOG_RANGE3 = new Float32Array([0, 0, 0]);
const NO_FOCUS = new Float32Array([0, 0, 0, 0]);

export class FoeTelegraphPass {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, VS, FS, 'foeTelegraph');
    this.u = {};
    for (const n of ['uVP', 'uOrigin', 'uYaw', 'uHalf', 'uLift', 'uKind', 'uT', 'uFlash', 'uColor', 'uP', 'uSlope', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uNow', 'uNearFloor', 'uIron', 'uCut', 'uContrast', 'uShatter']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** how many shapes the last draw put down (stats, tests) */
    this.drawn = 0;
  }

  /** Draw each { blow, phase, nearFloor } (ai/foeBlows.js drawableBlows) under the camera `proj` x `view`, in the frame's
   *  `fog` ({ mode, density, range, camPos }; none draws unfogged). TELL9: `contrast` the bold look (the preference's
   *  by default). */
  draw(list, proj, view, fog = null, { contrast = telegraphContrastOn() } = {}) {
    this.drawn = 0;
    if (!list?.length || !proj || !view) return 0;
    const gl = this.gl, U = this.u;
    mul(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uLift, BLOW_LIFT);
    gl.uniform1f(U.uContrast, contrast ? 1 : 0);   // TELL9
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_FOG_RANGE3);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);   // AUDIT DEEP R-1's law: under the travel view the fog is the traveller's
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // TELL2: premultiplied - the keyline darkens the floor, the line and the fill light it
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    for (const { blow: b, phase, nearFloor = 0 } of list) {
      gl.uniform3f(U.uOrigin, b.origin[0], b.origin[1], b.origin[2]);
      gl.uniform1f(U.uYaw, b.yaw);
      gl.uniform2f(U.uSlope, b.slope?.[0] ?? 0, b.slope?.[1] ?? 0);
      gl.uniform1i(U.uKind, BLOW_KIND[b.kind] ?? 0);
      gl.uniform1f(U.uHalf, quadHalf(b.kind, b.ahead));   // TELL6: each its own size
      const P = BLOW[b.kind];
      if (b.kind === 'lunge' || b.kind === 'charge') gl.uniform4f(U.uP, P.len, P.halfW, 0, 0);
      else if (b.kind === 'sweep') gl.uniform4f(U.uP, P.r, P.halfArc, 0, 0);
      else if (b.kind === 'ring') gl.uniform4f(U.uP, P.rIn, P.rOut, 0, 0);
      else if (b.kind === 'leap' || b.kind === 'pyre') gl.uniform4f(U.uP, P.r, b.ahead ?? 0, 0, 0);   // RVN5: the pyre's disc at its point
      else if (b.kind === 'aimed') gl.uniform4f(U.uP, b.ahead ?? 0, P.halfW, 0, 0);
      else gl.uniform4f(U.uP, P.r, P.ahead, 0, 0);
      gl.uniform1f(U.uT, phase.t);
      gl.uniform1f(U.uFlash, phase.flash);
      gl.uniform1f(U.uNow, phase.flash > 0 ? 0 : nowShare(b, phase));   // TELL2
      gl.uniform1f(U.uNearFloor, nearFloor > 0 ? nearFloor : 0);
      gl.uniform1f(U.uIron, b.guard === 'iron' ? 1 : 0);   // TELL3
      gl.uniform1f(U.uCut, phase.cut > 0 ? phase.cut : 0);   // TELL5
      gl.uniform1f(U.uShatter, phase.shatter > 0 ? phase.shatter : 0);   // AUDIT TELL (3.2)
      const c = b.color ?? [1, 0.42, 0.12];
      gl.uniform3f(U.uColor, c[0], c[1], c[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.drawn++;
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return this.drawn;
  }
}

/** TELL2: how far through the last TELL_NOW before its landing a blow stands (0 before it, 1 at the landing). */
export function nowShare(b, phase) {
  const toLand = (b.land - b.start) * (1 - phase.t);
  return Math.max(0, Math.min(1, 1 - toLand / TELL_NOW));
}

function mul(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
