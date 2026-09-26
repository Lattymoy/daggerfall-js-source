// @ts-check
// WB4 (2026-09-25, Mac: "an oversized enemy with telegraphed attacks (like wind ups, etc)"): THE TELEGRAPH - every
// attack's shape drawn on the court's floor where it will land. Design: bible/11-Multiplayer/World-Bosses.md section 5
// ("On the ground: every shape is drawn where it will land - a dim outline at once, filling toward the edge as the
// wind-up runs, bright at the landing").
//
// ONE QUAD over the floor's disc, a hair above it, and the shape is the FRAGMENT'S question: its point in the court's
// frame against the attack the uniforms describe - the same law net/gateStrike.js inAttack answers for a struck
// player's feet (a cone about his facing that always holds his body, a disc about him or under each target, the lane
// his charge runs, the ring of the nova, the whole floor), so the ground shows exactly what lands. `telegraphField` is
// the shader's own reading in JS - the pins hold it to inAttack point for point, and the shader's text to it.
//
// The duel wall's law (render/duelWall.js): fixed geometry and uniforms, ADDED onto the frame (ONE, ONE) so it only
// brightens the floor, no depth written, tested against the depth the court wrote (a body standing on it hides it),
// fogged as the ground is, and every rate a whole number of cycles over the wrapped clock. A polygon offset keeps it
// off the floor it lies on.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { duelClock } from './duelWall.js';
import { ATTACK_BY_ID, BOSS_R, COURT_CENTRE, COURT_R, windupOf } from '../net/gateBrain.js';
import { telegraphAt } from '../net/gateStrike.js';
import { ATTACK_COLORS } from '../world/gateBoss.js';

/** The shapes, as the shader's `uKind` says them. */
export const TELEGRAPH_KIND = Object.freeze({ cone: 0, disc: 1, discs: 2, lane: 3, ring: 4, all: 5 });
/** The most discs one attack lays (Hellfire's two volleys of five in phase three - net/gateBrain.js). */
export const TELEGRAPH_POINTS_MAX = 10;
/** How far over the floor it lies, metres, and how far past its edge the quad reaches. */
export const TELEGRAPH_LIFT = 0.05;
export const TELEGRAPH_MARGIN = 0.5;
/** It comes up over this long at the word, and its landing's flash dies over this long after its span. */
export const TELEGRAPH_FADE_IN_MS = 150;
export const TELEGRAPH_FLASH_MS = 350;
/** The fill's pulse, beats a second (a whole number of cycles over duelWall.js DUEL_CLOCK_PERIOD). */
export const TELEGRAPH_PULSE_HZ = 2;

const DEG = Math.PI / 180;

/**
 * What the pass draws for an attack at `now` - the uniforms, as plain numbers - or null when there is nothing (no
 * attack, or its landing's flash is over). `t` is the wind-up's share (the fill's reach), `flash` 1 from the landing
 * on, `alpha` its fade in and out.
 * @param {{a: number, at: number, x: number, z: number, yw: number, tg: number[][]}|null} atk @param {number} phase @param {number} now
 */
export function telegraphShape(atk, phase, now) {
  /** @type {any} an attack of any shape - the fields its shape does not have read as none */
  const A = atk ? ATTACK_BY_ID[atk.a] : null;
  const tel = A ? telegraphAt(atk, phase, now) : null;
  if (!A || !tel) return null;
  const span = Math.max(A.active, 1);
  if (tel.since >= span + TELEGRAPH_FLASH_MS) return null;
  const start = atk.at - windupOf(A, phase);
  const fadeIn = Math.max(0, Math.min(1, (now - start) / TELEGRAPH_FADE_IN_MS));
  const fadeOut = tel.since > span ? 1 - (tel.since - span) / TELEGRAPH_FLASH_MS : 1;
  const kind = A.shape === 'disc' ? (A.aim === 'self' ? TELEGRAPH_KIND.disc : TELEGRAPH_KIND.discs) : TELEGRAPH_KIND[A.shape];
  const end = atk.tg?.[0] ?? [atk.x, atk.z];
  return {
    kind, origin: [atk.x, atk.z], yaw: atk.yw, r: A.r ?? 0, halfArc: ((A.arc ?? 0) / 2) * DEG, body: BOSS_R,
    end: [end[0], end[1]], halfW: (A.width ?? 0) / 2, r0: A.r0 ?? 0, r1: A.r1 ?? 0,
    points: A.aim === 'players' ? (atk.tg ?? []).slice(0, TELEGRAPH_POINTS_MAX).map((p) => [p[0], p[1]]) : [],
    t: tel.t, flash: tel.since >= 0 ? 1 : 0, alpha: fadeIn * Math.max(0, fadeOut), color: ATTACK_COLORS[A.key],
  };
}

const wrap = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const h = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  return [Math.hypot(px - (ax + vx * h), pz - (az + vz * h)), h];
}

/**
 * THE SHADER'S OWN READING, in JS: for a point of the court (its frame), whether it lies inside the shape, how far it
 * is from the shape's edge (metres - the outline's measure; near enough off a cone's side), and the fill's coordinate
 * (0 where the fill starts, 1 at its far edge: out from him for a cone or disc, down the lane for the charge, out from
 * the ring's inner edge for the nova, out from the centre for the whole floor).
 * @param {NonNullable<ReturnType<typeof telegraphShape>>} sh @param {number} px @param {number} pz
 */
export function telegraphField(sh, px, pz) {
  const rx = px - sh.origin[0], rz = pz - sh.origin[1], d = Math.hypot(rx, rz);
  switch (sh.kind) {
    case TELEGRAPH_KIND.cone: {
      const ang = Math.abs(wrap(Math.atan2(rx, rz) - sh.yaw));
      const inside = d <= sh.r && (d <= sh.body || ang <= sh.halfArc);
      const arcEdge = ang <= sh.halfArc ? Math.abs(d - sh.r) : Infinity, sideEdge = d > sh.body && d <= sh.r ? Math.abs(ang - sh.halfArc) * d : Infinity;
      return { inside, edge: Math.min(arcEdge, sideEdge), s: d / sh.r };
    }
    case TELEGRAPH_KIND.disc: return { inside: d <= sh.r, edge: Math.abs(d - sh.r), s: d / sh.r };
    case TELEGRAPH_KIND.discs: {
      let m = Infinity;
      for (const p of sh.points) m = Math.min(m, Math.hypot(px - p[0], pz - p[1]));
      return { inside: m <= sh.r, edge: Math.abs(m - sh.r), s: m / sh.r };
    }
    case TELEGRAPH_KIND.lane: {
      const [ld, h] = segDist(px, pz, sh.origin[0], sh.origin[1], sh.end[0], sh.end[1]);
      return { inside: ld <= sh.halfW, edge: Math.abs(ld - sh.halfW), s: h };
    }
    case TELEGRAPH_KIND.ring: return { inside: d >= sh.r0 && d <= sh.r1, edge: Math.min(Math.abs(d - sh.r0), Math.abs(d - sh.r1)), s: (d - sh.r0) / (sh.r1 - sh.r0) };
    case TELEGRAPH_KIND.all: { const c = Math.hypot(px, pz); return { inside: true, edge: Math.abs(COURT_R - c), s: c / COURT_R }; }
    default: return { inside: false, edge: Infinity, s: 0 };
  }
}

const HEAD = `#version 300 es
precision highp float;
`;
export const TELEGRAPH_VS = HEAD + `layout(location = 0) in vec2 aCourt;   // the quad's corner, the court's frame
uniform mat4 uVP;
uniform vec3 uCentre;    // the court's centre in the scene
uniform float uLift;
out vec2 vCourt;
out vec3 vWorld;
void main() {
  vCourt = aCourt;
  vWorld = uCentre + vec3(aCourt.x, uLift, aCourt.y);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
export const TELEGRAPH_FS = HEAD + `in vec2 vCourt;
in vec3 vWorld;
uniform int uKind;       // 0 cone, 1 disc, 2 discs, 3 lane, 4 ring, 5 all (TELEGRAPH_KIND)
uniform vec2 uOrigin;    // where he stood
uniform float uYaw;      // his facing, atan2(dx, dz)
uniform float uR;
uniform float uHalfArc;
uniform float uBody;     // his body's radius - a cone always holds it
uniform vec2 uEnd;       // the lane's end
uniform float uHalfW;
uniform float uR0;
uniform float uR1;
uniform vec2 uPts[${TELEGRAPH_POINTS_MAX}];
uniform int uCount;
uniform float uT;        // the wind-up's share: the fill's reach
uniform float uFlash;    // the landing
uniform float uAlpha;
uniform vec3 uColor;
uniform float uTime;     // duelClock's seconds
uniform float uFloorR;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
const float PI = 3.141592653589793;
float wrapAngle(float a) { return a - 2.0 * PI * floor((a + PI) / (2.0 * PI)); }
void main() {
  float c = length(vCourt);
  if (c > uFloorR) discard;
  vec2 rel = vCourt - uOrigin;
  float d = length(rel);
  bool inside = false;
  float edge = 1e3;
  float s = 0.0;
  if (uKind == 0) {
    float ang = abs(wrapAngle(atan(rel.x, rel.y) - uYaw));
    inside = d <= uR && (d <= uBody || ang <= uHalfArc);
    edge = min(ang <= uHalfArc ? abs(d - uR) : 1e3, d > uBody && d <= uR ? abs(ang - uHalfArc) * d : 1e3);   // the arc's own stretch, the sides' own length
    s = d / uR;
  } else if (uKind == 1) {
    inside = d <= uR; edge = abs(d - uR); s = d / uR;
  } else if (uKind == 2) {
    float m = 1e3;
    for (int i = 0; i < ${TELEGRAPH_POINTS_MAX}; i++) { if (i >= uCount) break; m = min(m, length(vCourt - uPts[i])); }
    inside = m <= uR; edge = abs(m - uR); s = m / uR;
  } else if (uKind == 3) {
    vec2 v = uEnd - uOrigin;
    float l2 = dot(v, v);
    float h = l2 > 0.0 ? clamp(dot(rel, v) / l2, 0.0, 1.0) : 0.0;
    float ld = length(vCourt - (uOrigin + v * h));
    inside = ld <= uHalfW; edge = abs(ld - uHalfW); s = h;
  } else if (uKind == 4) {
    inside = d >= uR0 && d <= uR1; edge = min(abs(d - uR0), abs(d - uR1)); s = (d - uR0) / (uR1 - uR0);
  } else {
    inside = true; edge = abs(uFloorR - c); s = c / uFloorR;
  }
  float fin = inside ? 1.0 : 0.0;
  float rim = 1.0 - smoothstep(0.06, 0.35, edge);
  if (fin + rim < 0.001) discard;
  float filled = fin * step(s, uT);
  float front = fin * exp(-pow((s - uT) * 18.0, 2.0)) * (1.0 - step(0.999, uT));
  float pulse = 0.8 + 0.2 * sin(uTime * 6.283185307179586 * ${TELEGRAPH_PULSE_HZ}.0);
  float light = 0.55 * rim + 0.07 * fin + 0.22 * filled * pulse + 0.7 * front;
  light = mix(light, 1.1 * fin + 0.6 * rim, uFlash);
  o = vec4(uColor * light * uAlpha * fogFactorAt(vWorld), 1.0);
}`;

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/** The quad over the floor's disc, two triangles facing up, in the court's frame. Pure. */
export function telegraphQuad(half = COURT_R + TELEGRAPH_MARGIN) {
  return new Float32Array([-half, -half, -half, half, half, half, -half, -half, half, half, half, -half]);
}

const NO_FOG_RANGE = new Float32Array([0, 1]);

export class GateTelegraphRenderer {
  constructor(gl) {
    this.gl = gl;
    const prog = buildProgram(gl, TELEGRAPH_VS, TELEGRAPH_FS);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uCentre', 'uLift', 'uKind', 'uOrigin', 'uYaw', 'uR', 'uHalfArc', 'uBody', 'uEnd', 'uHalfW', 'uR0', 'uR1', 'uPts', 'uCount',
      'uT', 'uFlash', 'uAlpha', 'uColor', 'uTime', 'uFloorR', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = telegraphQuad();
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
    this._pts = new Float32Array(TELEGRAPH_POINTS_MAX * 2);
    /** whether the last draw put a shape down, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw one attack's shape (`telegraphShape`'s answer; null draws nothing and touches nothing) over the court whose
   * centre stands at `centre` in the scene, `seconds` any clock (wrapped here), `fog` the frame's fog as the renderer
   * set it ({ mode, density, range, color, camPos }; none draws unfogged).
   */
  draw(shape, proj, view, eye, seconds, fog = null, centre = COURT_CENTRE) {
    this.drawn = 0;
    if (!shape || !(shape.alpha > 0.001)) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3f(U.uCentre, centre[0], centre[1], centre[2]);
    gl.uniform1f(U.uLift, TELEGRAPH_LIFT);
    gl.uniform1i(U.uKind, shape.kind);
    gl.uniform2f(U.uOrigin, shape.origin[0], shape.origin[1]);
    gl.uniform1f(U.uYaw, shape.yaw);
    gl.uniform1f(U.uR, shape.r);
    gl.uniform1f(U.uHalfArc, shape.halfArc);
    gl.uniform1f(U.uBody, shape.body);
    gl.uniform2f(U.uEnd, shape.end[0], shape.end[1]);
    gl.uniform1f(U.uHalfW, shape.halfW);
    gl.uniform1f(U.uR0, shape.r0);
    gl.uniform1f(U.uR1, shape.r1);
    this._pts.fill(0);
    shape.points.forEach((p, i) => { this._pts[i * 2] = p[0]; this._pts[i * 2 + 1] = p[1]; });
    gl.uniform2fv(U.uPts, this._pts);
    gl.uniform1i(U.uCount, shape.points.length);
    gl.uniform1f(U.uT, shape.t);
    gl.uniform1f(U.uFlash, shape.flash);
    gl.uniform1f(U.uAlpha, Math.min(1, shape.alpha));
    gl.uniform3fv(U.uColor, shape.color);
    gl.uniform1f(U.uTime, duelClock(seconds));
    gl.uniform1f(U.uFloorR, COURT_R);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? centre);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    this.drawn = 1;
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
