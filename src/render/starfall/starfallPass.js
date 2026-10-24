// @ts-check
// STAR4 (2026-10-20): THE STARFALL IN THE SKY, DRAWN - the omen's new star, the fall's streak, the landing's flash and
// its ring of shock over the ground, and the star's beacon while it stands. Design: bible/11-Multiplayer/Starfall.md
// section 3. One foreign pass after the world's, ADDED onto the frame (ONE, ONE), depth tested, no depth written - the
// gate's beacon's law (render/gate/gatePass.js): its column is the gate's own, its shaders and geometry exported there
// and built again here under this pass's program (render/superDungeon/sdOmenPass.js's way - the gate's bytes untouched),
// in the star's violet, gold once it is held.
//
// THE SKY IS FAR, THE FRAME IS NOT. A star burns kilometres over its site and falls from further, past the camera's far
// plane (scenes/world.js: 6000 m): every sky thing is drawn SCALED ABOUT THE EYE to STAR_SKY_R (`skyClamp`) - the same
// direction, the same size on the screen - so it is never cut by the far plane, and a player across the region sees the
// same star come down the same way (net/starfall/starfallLaw.js starStreakBearing).
//
// Pure where it can be: the path (`streakAt`), the clamp, the ring's reach. Not a DFU member. Ledger A (STARFALL).
import { BEACON_DRAW_VS, BEACON_DRAW_FS, BEACON_RADIUS_M, beaconVertices, gateClock } from '../gate/gatePass.js';
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { buildProgram } from '../glProgram.js';
import { multiply } from '../../world/mat4.js';

/** The beacon's light, display-encoded as the gate's: the star's pale violet - and gold once it is held. */
export const STAR_BEACON_COLOR = Object.freeze([0.62, 0.48, 1.0]);
export const STAR_HELD_COLOR = Object.freeze([1.0, 0.78, 0.32]);
/** The beacon: how far under the ground its column's foot is, how high it rises, and where along it the light starts. */
export const STAR_BEACON_BELOW_M = 300;
export const STAR_BEACON_HEIGHT_M = 1000;
export const STAR_BEACON_START_M = 3;
/** Sky things farther than this are drawn scaled about the eye to it (inside the far plane, 6000 m). */
export const STAR_SKY_R = 4200;
/** The omen's star: how high over its site it burns, and its glow's size (metres at STAR_SKY_R) at the omen's first
 *  moment and its last. */
export const STAR_OMEN_ALT_M = 9000;
export const STAR_OMEN_W = Object.freeze([18, 70]);
/** The fall: where it starts (this far out along its bearing and this high), the trail's length, the head's glow. */
export const STAR_FALL_FROM_M = 8000;
export const STAR_FALL_ALT_M = 6000;
export const STAR_TRAIL_M = 2400;
export const STAR_HEAD_W = 60;
/** The landing: the flash's glow and how long it burns, the ring's reach and how long it runs, its width. */
export const STAR_FLASH_W = 140;
export const STAR_FLASH_MS = 1600;
export const STAR_RING_M = 90;
export const STAR_RING_MS = 1800;
export const STAR_RING_WIDTH_M = 6;
/** AUDIT STARFALL R3: the ring's bearings - its ground read at each, at its inner and its outer edge (the host's
 *  ringGround, `uGround`) - and how far over that ground it runs. */
export const STAR_RING_SEGS = 32;
export const STAR_RING_LIFT_M = 0.6;
/** The fall's colour, white at its heart. */
export const STAR_FALL_COLOR = Object.freeze([0.66, 0.5, 1.0]);

/**
 * WHERE THE STAR IS ON ITS FALL, `k` 0..1 through it: from STAR_FALL_FROM_M out along its bearing (radians from north
 * toward east, the way it comes FROM) and STAR_FALL_ALT_M up, down to `site` - gathering speed as it falls (the court
 * meteor's square). Answers the head `[x, y, z]` and `dir`, the unit way back up its path (the trail's). Pure.
 * @param {number[]} site the landing, the scene's @param {number} bearing @param {number} k
 */
export function streakAt(site, bearing, k) {
  const out = [Math.sin(bearing) * STAR_FALL_FROM_M, STAR_FALL_ALT_M, Math.cos(bearing) * STAR_FALL_FROM_M];
  const len = Math.hypot(out[0], out[1], out[2]), d = 1 - Math.min(1, Math.max(0, k)) ** 2;
  return { head: [site[0] + out[0] * d, site[1] + out[1] * d, site[2] + out[2] * d], dir: [out[0] / len, out[1] / len, out[2] / len] };
}
/** The omen's star over `site`: straight up its altitude, and its glow's size `k` 0..1 through the omen. Pure. */
export const omenAt = (site, k) => ({ at: [site[0], site[1] + STAR_OMEN_ALT_M, site[2]], w: STAR_OMEN_W[0] + (STAR_OMEN_W[1] - STAR_OMEN_W[0]) * Math.min(1, Math.max(0, k)) ** 2 });
/** A sky thing at `p` as the frame can hold it: scaled about `eye` to STAR_SKY_R when it is farther - `{ at, s }`, `s`
 *  the scale every length of it takes. Pure. */
export function skyClamp(eye, p) {
  const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2], d = Math.hypot(dx, dy, dz);
  const s = d > STAR_SKY_R ? STAR_SKY_R / d : 1;
  return { at: [eye[0] + dx * s, eye[1] + dy * s, eye[2] + dz * s], s };
}
/** The ring of shock `ms` after the landing: its radius and its strength (0 once it has run). Pure. */
export function shockRingAt(ms) {
  if (!(ms >= 0) || ms >= STAR_RING_MS) return { r: 0, fade: 0 };
  const k = ms / STAR_RING_MS;
  return { r: STAR_RING_M * (1 - (1 - k) ** 2), fade: (1 - k) ** 1.5 };
}

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;   // the int too: a fragment shader's is mediump by default, and `uKind` is both stages' (they would not link)
const FOG = `uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
`;
/** A glow (kind 1, camera-facing, round) or a trail (kind 0, a ribbon back up its path) - the court meteor's two shapes
 *  (render/gate/gateFx.js), the trail's way a uniform here (every star falls its own way). */
export const STAR_SKY_VS = HEAD + `layout(location = 0) in vec2 aP;
uniform mat4 uVP;
uniform int uKind;
uniform vec3 uHead;
uniform vec3 uDir;
uniform float uLen;
uniform float uW;
uniform vec3 uEye;
out vec2 vUv;
out vec3 vWorld;
void main() {
  vUv = aP;
  vec3 w;
  if (uKind == 0) {
    vec3 mid = uHead + uDir * uLen * aP.y;
    vec3 side = normalize(cross(uDir, uEye - mid));
    w = mid + side * aP.x * uW * (1.0 - 0.8 * aP.y);
  } else {
    vec3 f = normalize(uEye - uHead), side = normalize(cross(vec3(0.0, 1.0, 0.0), f)), up = cross(f, side);
    w = uHead + side * aP.x * uW + up * (aP.y * 2.0 - 1.0) * uW;
  }
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const STAR_SKY_FS = HEAD + `in vec2 vUv;
in vec3 vWorld;
uniform int uKind;
uniform vec3 uColor;
uniform float uLight;
uniform float uTime;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  float light;
  vec3 col;
  if (uKind == 0) {
    float across = 1.0 - abs(vUv.x);
    float flick = 0.85 + 0.15 * sin(vUv.y * 60.0 - uTime * 24.0);
    light = across * across * pow(1.0 - vUv.y, 2.2) * flick;
    col = mix(vec3(1.0, 0.98, 1.0), uColor, clamp(vUv.y * 2.5, 0.0, 1.0));
  } else {
    float r = length(vec2(vUv.x, vUv.y * 2.0 - 1.0));
    if (r > 1.0) discard;
    light = pow(1.0 - r, 2.0) * 1.6 + step(r, 0.12) * 0.8;
    col = mix(vec3(1.0, 0.98, 1.0), uColor, smoothstep(0.05, 0.7, r));
  }
  // the sky's light is the night's: fogged, never under a floor of it (the beacon's law - a star kilometres off still shows)
  o = vec4(col * light * uLight * max(fogFactorAt(vWorld), 0.35), 1.0);
}`;
/** The ring of shock: a band round the landing, bright at its running edge - AUDIT STARFALL R3: ON THE LAND. It was a
 *  flat square 0.6 m over the heart out to the ring's reach, and the land rises over that plane within 90 m of most of
 *  the map's ground (the audit's probe: 63.5% of its land pixels): the ring ran under the hills. Now a strip of
 *  STAR_RING_SEGS bearings, its inner and outer edge each lifted to its own ground (`uGround`, over the heart's, the
 *  host's read - [bearing * 2 + edge]). `aP` is (the bearing, the edge: 0 inner, 1 outer). */
export const STAR_RING_VS = HEAD + `layout(location = 0) in vec2 aP;
uniform mat4 uVP;
uniform vec3 uAt;
uniform float uR;
uniform float uWidth;
uniform float uGround[${STAR_RING_SEGS * 2}];
out float vD;
out vec3 vWorld;
vec3 ringPoint(vec2 p) {
  int i = int(p.x + 0.5) % ${STAR_RING_SEGS};
  int j = int(p.y + 0.5);
  float a = float(i) / ${STAR_RING_SEGS}.0 * 6.283185307179586;
  float r = j == 0 ? max(0.0, uR - uWidth) : uR + uWidth;
  return uAt + vec3(sin(a) * r, uGround[i * 2 + j] + ${STAR_RING_LIFT_M.toFixed(2)}, cos(a) * r);
}
void main() {
  vD = aP.y > 0.5 ? uR + uWidth : max(0.0, uR - uWidth);
  vec3 w = ringPoint(aP);
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const STAR_RING_FS = HEAD + `in float vD;
in vec3 vWorld;
uniform float uR;
uniform float uWidth;
uniform float uFade;
uniform vec3 uColor;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  float d = vD;
  float band = 1.0 - smoothstep(0.0, uWidth, abs(d - uR));
  if (band <= 0.0) discard;
  float inner = smoothstep(uR - uWidth * 3.0, uR, d);   // brighter at the running edge, a wake behind it
  o = vec4(uColor * band * (0.4 + 0.6 * inner) * uFade * fogFactorAt(vWorld), 1.0);
}`;

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const NO_HAZE = new Float32Array(8);
const WHITE = new Float32Array([1, 1, 1]);
const QUAD = new Float32Array([-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1]);
/** The ring's strip: each bearing's quad, inner edge to outer, to the next bearing (the last back to the first). */
export function ringStrip(segs = STAR_RING_SEGS) {
  const out = new Float32Array(segs * 12);
  let o = 0;
  for (let i = 0; i < segs; i++) for (const [u, v] of [[i, 0], [i + 1, 0], [i + 1, 1], [i, 0], [i + 1, 1], [i, 1]]) { out[o++] = u; out[o++] = v; }
  return out;
}
const FLAT_RING = new Float32Array(STAR_RING_SEGS * 2);
const vao = (gl, verts) => {
  const v = gl.createVertexArray();
  gl.bindVertexArray(v);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  return v;
};
const uniforms = (gl, p, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));

/** FIRST-USE (#1144): the pass's three programs, as its constructor builds them - what its warm starts and waits on
 *  (render/glProgram.js startPrograms). The beacon's is the gate's own, started with the passes play meets. */
export const STARFALL_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[BEACON_DRAW_VS, BEACON_DRAW_FS], [STAR_SKY_VS, STAR_SKY_FS], [STAR_RING_VS, STAR_RING_FS]]));

/** The Starfall's pass. */
export class StarfallPassRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [beacon, sky, ring] = STARFALL_PROGRAMS;
    this.beacon = buildProgram(gl, beacon[0], beacon[1], 'star beacon');
    this.ub = uniforms(gl, this.beacon, ['uVP', 'uOrigin', 'uEye', 'uRadius', 'uTime', 'uFade', 'uColor', 'uBelow', 'uHeight', 'uFoot', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze']);
    this.sky = buildProgram(gl, sky[0], sky[1], 'star sky');
    // AUDIT STARFALL R5: the travel view's focus and the jungle's haze, as the beacon's - the sky's and the ring's fog
    // read them (render/fogGlsl.js FOG_GLSL) and were never handed them
    this.us = uniforms(gl, this.sky, ['uVP', 'uKind', 'uHead', 'uDir', 'uLen', 'uW', 'uEye', 'uColor', 'uLight', 'uTime', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze']);
    this.ring = buildProgram(gl, ring[0], ring[1], 'star ring');
    this.ur = uniforms(gl, this.ring, ['uVP', 'uAt', 'uR', 'uWidth', 'uGround', 'uFade', 'uColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze']);
    const col = beaconVertices();
    this.colVao = vao(gl, col); this.colCount = col.length / 2;
    this.quadVao = vao(gl, QUAD);
    const strip = ringStrip();
    this.ringVao = vao(gl, strip); this.ringCount = strip.length / 2;
    this._vp = new Float32Array(16);
    /** what the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  _fog(U, fog, eye) {
    const gl = this.gl;
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? WHITE);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    if (U.uJungleHaze) gl.uniform4fv(U.uJungleHaze, fog?.haze ?? NO_HAZE);
  }

  /**
   * Draw the frame's Starfall: `sky` `{ beacons: [{ origin, scale, fade, held }], glows: [{ at, w, color, light }], trails:
   * [{ head, dir, len, w, color, light }], rings: [{ at, r, fade, color, ground }] }` - every place the scene's, every sky
   * thing already clamped (skyClamp - a beacon's `scale` the clamp's, its column's every length taken by it), a ring's
   * `ground` its edges' ground over `at` (STAR_RING_SEGS * 2, flat where none is given). Answers how many things it drew;
   * nothing to draw, nothing touched.
   */
  draw(sky, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const beacons = (sky?.beacons ?? []).filter((b) => b?.origin?.every?.(Number.isFinite) && b.fade > 0.001);
    const glows = (sky?.glows ?? []).filter((g) => g?.at?.every?.(Number.isFinite) && g.w > 0 && g.light > 0);
    const trails = (sky?.trails ?? []).filter((t) => t?.head?.every?.(Number.isFinite) && t.len > 0 && t.light > 0);
    const rings = (sky?.rings ?? []).filter((r) => r?.at?.every?.(Number.isFinite) && r.r > 0 && r.fade > 0.001);
    if (!beacons.length && !glows.length && !trails.length && !rings.length) return 0;
    const gl = this.gl;
    multiply(proj, view, this._vp);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.ONE, gl.ONE);
    const E = eye ?? fog?.camPos ?? WHITE;
    if (beacons.length) {
      const U = this.ub;
      gl.useProgram(this.beacon);
      gl.uniformMatrix4fv(U.uVP, false, this._vp);
      gl.uniform1f(U.uTime, gateClock(seconds));
      gl.uniform3fv(U.uEye, E);
      gl.uniform1f(U.uFoot, (STAR_BEACON_BELOW_M + STAR_BEACON_START_M) / STAR_BEACON_HEIGHT_M);
      this._fog(U, fog, E);
      gl.bindVertexArray(this.colVao);
      for (const b of beacons) {
        // AUDIT STARFALL R2: a column clamped about the eye is the same column on the screen - its width, its foot and its
        // height scaled with its place
        const s = b.scale > 0 && b.scale <= 1 ? b.scale : 1;
        gl.uniform1f(U.uRadius, BEACON_RADIUS_M * s);
        gl.uniform1f(U.uBelow, STAR_BEACON_BELOW_M * s);
        gl.uniform1f(U.uHeight, STAR_BEACON_HEIGHT_M * s);
        gl.uniform3fv(U.uColor, b.held ? STAR_HELD_COLOR : STAR_BEACON_COLOR);
        gl.uniform3f(U.uOrigin, b.origin[0], b.origin[1], b.origin[2]);
        gl.uniform1f(U.uFade, Math.min(1, b.fade));
        gl.drawArrays(gl.TRIANGLES, 0, this.colCount);
        this.drawn++;
      }
    }
    if (glows.length || trails.length) {
      const U = this.us;
      gl.useProgram(this.sky);
      gl.uniformMatrix4fv(U.uVP, false, this._vp);
      gl.uniform3fv(U.uEye, E);
      gl.uniform1f(U.uTime, ((seconds % 120) + 120) % 120);
      this._fog(U, fog, E);
      gl.bindVertexArray(this.quadVao);
      for (const t of trails) {
        gl.uniform1i(U.uKind, 0);
        gl.uniform3f(U.uHead, t.head[0], t.head[1], t.head[2]);
        gl.uniform3f(U.uDir, t.dir[0], t.dir[1], t.dir[2]);
        gl.uniform1f(U.uLen, t.len); gl.uniform1f(U.uW, t.w);
        gl.uniform3fv(U.uColor, t.color ?? STAR_FALL_COLOR); gl.uniform1f(U.uLight, t.light);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.drawn++;
      }
      for (const g of glows) {
        gl.uniform1i(U.uKind, 1);
        gl.uniform3f(U.uHead, g.at[0], g.at[1], g.at[2]);
        gl.uniform1f(U.uW, g.w);
        gl.uniform3fv(U.uColor, g.color ?? STAR_FALL_COLOR); gl.uniform1f(U.uLight, g.light);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.drawn++;
      }
    }
    if (rings.length) {
      const U = this.ur;
      gl.useProgram(this.ring);
      gl.uniformMatrix4fv(U.uVP, false, this._vp);
      gl.uniform1f(U.uWidth, STAR_RING_WIDTH_M);
      this._fog(U, fog, E);
      gl.bindVertexArray(this.ringVao);
      for (const r of rings) {
        gl.uniform3f(U.uAt, r.at[0], r.at[1], r.at[2]);
        gl.uniform1f(U.uR, r.r); gl.uniform1f(U.uFade, Math.min(1, r.fade));
        gl.uniform1fv(U.uGround, r.ground?.length === STAR_RING_SEGS * 2 ? r.ground : FLAT_RING);
        gl.uniform3fv(U.uColor, r.color ?? STAR_FALL_COLOR);
        gl.drawArrays(gl.TRIANGLES, 0, this.ringCount);
        this.drawn++;
      }
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return this.drawn;
  }
}
