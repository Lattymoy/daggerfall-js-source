// @ts-check
// RED-MOUNTAIN (bible/03-World/Red-Mountain.md): the volcano's fire - the lava lake on its crater's floor, lava down the
// upper foyada, and the ash plume whose foot the fire lights. The lava lies at the levels the kernel lays the land to
// (redMountain.js redMountainGround), so it lies on the ground near and far. Drawn last of the far ring's pass, twice: by
// the world's lens nearer than its far plane, and past it by its own lens at the far plane, where the far pass has no
// depth - there the cone hides it analytically (`hidden`: the eye's ray stepped against the cone's profile).
// Not a DFU member. Ledger A (RED-MOUNTAIN).
import { buildProgram } from './glProgram.js';
import { perspective, mirrorProjectionX } from '../world/mat4.js';
import { TERRAIN_SIZE, STREAMING_TERRAIN_SCALE } from '../world/terrain/terrainSampler.js';
import { RED_MOUNTAIN_DIALS, coneProfile, RED_MOUNTAIN_REACH } from '../world/tamriel/redMountain.js';
import { BAY_H } from '../world/tamriel/tamrielFrame.js';

const D = RED_MOUNTAIN_DIALS;
/** THE FIRE'S DIALS (metres, seconds, linear colours). */
export const FIRE = Object.freeze({
  /** the clock its motion runs on: each layer's phase a whole period, two layers crossfaded so the wrap never shows */
  period: 90,
  /** the lake's radius over the crater floor's, and how far over the floor it lies; a river's half-width over its
   *  trough's, how far over its floor, and the least half-width a metre from the eye */
  lake: 0.92, lakeOver: 3, river: 0.42, riverOver: 1.5, widen: 0.0012,
  /** the lava: its crust and its melt, the glow it is drawn at, and the share of the haze's colour it takes at most */
  crust: Object.freeze([0.06, 0.03, 0.025]), molten: Object.freeze([1.0, 0.34, 0.05]), glow: 1.6, hazeHold: 0.35,
  /** the plume: its height over the floor, its radius at its foot and its top, how it swells, its lean by its top (east,
   *  north - the way the trade winds carry the ash, every day), the metres its foot fades in over, its billows' size at
   *  its foot and its top (metres, world-space), how far they bulge its outline, and how many they climb a period */
  plume: Object.freeze({ height: 8500, footR: 1500, topR: 9000, swell: 0.6, lean: Object.freeze([6500, 2600]), foot: 150,
    billow: Object.freeze([900, 2600]), lump: 0.45, rise: 2 }),
  /** its ash's colour and thickness, the least of the frame's light it takes, the share its side away from the sun keeps,
   *  the least of it the haze leaves */
  ash: Object.freeze([0.22, 0.2, 0.19]), alpha: 0.92, lightMin: 0.06, shade: 0.45, hazeFloor: 0.5,
  /** the fire in its foot: its colour, how fast it falls with height (by e, metres), how bright at night, and the share
   *  of that a full day leaves (the sun outshines it) */
  ember: Object.freeze([1.0, 0.32, 0.08]), emberM: 1100, emberGlow: 2.2, dayGlow: 0.2,
  /** the cone's profile the far draw is hidden behind: its samples out to the volcano's reach, the steps a ray takes,
   *  the depth under the profile a point may lie before it is hidden (a river's trough and the kernel's own noise), and
   *  how far from the centre a ray is asked (past it the land, not the cone, is what stands) */
  profile: 128, steps: 24, margin: Object.freeze({ lava: 110, plume: 0 }), hide: D.rim + 20000,
  /** the column's rings round and up */
  segments: 32, rows: 48, ringSegments: 48,
});

const SAMPLE_M = TERRAIN_SIZE / 128;
const f1 = (v) => Number(v).toFixed(5);
const v3 = (a) => `vec3(${a.map(f1).join(', ')})`;

/** THE CONE'S COLOUR ON THE HORIZON (0-255): its lower flanks dark ash, its summit cone red-brown rock - laid over the
 *  far views' tint (the overworld's, which reads the relief's high bytes as a snowfield) by how far the cone lifts the
 *  land there (metres): the ash whole by `ash`, the rock coming in from `rock[0]` to `rock[1]` at `rockShare`. */
export const ASH_TINT = Object.freeze({ ash: Object.freeze([58, 52, 49]), rock: Object.freeze([96, 58, 44]), full: 600, rockFrom: 2200, rockTo: 3800, rockShare: 0.7 });
/** A far view's tint `rgb` (0-255) under the cone's `lift` (metres over the land there). Pure. */
export function ashTint(rgb, lift) {
  if (!(lift > 0)) return rgb;
  const A = ASH_TINT, s = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const k = s(0, A.full, lift), r = s(A.rockFrom, A.rockTo, lift) * A.rockShare, out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const ash = rgb[c] + (A.ash[c] - rgb[c]) * k;
    out[c] = Math.round(ash + (A.rock[c] - ash) * r);
  }
  return out;
}

/** Sample i of the profile's distance from the centre (metres): the reach by the square of its share, so the samples
 *  crowd the crater and the summit cone, where the profile turns. */
export const profileR = (i) => ((i / (FIRE.profile - 1)) ** 2) * RED_MOUNTAIN_REACH;
/** THE PROFILE the far draw hides behind: the smooth cone's height over the land at the centre (metres) at FIRE.profile
 *  distances out to the reach (profileR) - the crater's wall inside the rim, the flank past it, never crowned. Pure. */
export function fireProfile() {
  const out = new Float32Array(FIRE.profile);
  for (let i = 0; i < FIRE.profile; i++) {
    const r = profileR(i), d = r - D.rim;
    if (d >= 0) { out[i] = coneProfile(d); continue; }
    const t = Math.min(1, -d / (D.rim - D.floor)), s = t * t * (3 - 2 * t);
    out[i] = D.lift - D.depth * s;
  }
  return out;
}

/**
 * THE FIRE'S MESH in the frame of the pixel under the centre (render/farLandmarks.js's: x east, z north from its south-west
 * corner, y the world's heights). A vertex: its place, its sideways for the widening (none on the lake), and down the
 * lava 0..1, across -1..1, its half-width, its kind (0 the lake, 1 a river). With the pixel, the centre and the land's
 * level there (the profile's foot). Pure.
 * @param {import('../world/tamriel/redMountain.js').RedMountainFrame} frame
 * @param {import('../world/tamriel/redMountain.js').RedMountainGround} ground
 */
export function fireMesh(frame, ground) {
  const px = Math.floor(frame.bx), py = Math.floor(frame.by);
  const ox = px * 128, oy = (BAY_H - py) * 128;
  const local = (gx, gy) => [(gx - ox) * SAMPLE_M, (gy - oy) * SAMPLE_M];
  const verts = [];
  const push = (x, y, z, sx, sz, along, across, half, kind) => verts.push(x, y, z, sx, 0, sz, along, across, half, kind);
  // the lake: a fan on the crater's floor
  const [cx, cz] = local(frame.cx, frame.cy), floorY = ground.floor * STREAMING_TERRAIN_SCALE, ly = floorY + FIRE.lakeOver;
  const lr = D.floor * FIRE.lake, n = FIRE.ringSegments;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
    push(cx, ly, cz, 0, 0, 0, 0, lr, 0);
    push(cx + Math.cos(a0) * lr, ly, cz + Math.sin(a0) * lr, 0, 0, 1, 0, lr, 0);
    push(cx + Math.cos(a1) * lr, ly, cz + Math.sin(a1) * lr, 0, 0, 1, 0, lr, 0);
  }
  // the rivers: a strip down each foyada's line from the breach, as far as its lava runs, on its floor
  frame.foyada.forEach((line, fi) => {
    const lv = ground.chan[fi], m = line.s.length, len = line.s[m - 1], run = len * D.trough.lava;
    const pts = [];
    for (let i = 0; i < m && line.s[i] <= run; i++) {
      const [x, z] = local(line.pts[2 * i], line.pts[2 * i + 1]);
      const j = Math.min(m - 1, i + 1), k = Math.max(0, i - 1);
      const ex = line.pts[2 * j] - line.pts[2 * k], ez = line.pts[2 * j + 1] - line.pts[2 * k + 1], el = Math.hypot(ex, ez) || 1;
      const half = (D.trough.halfTop + (D.trough.halfFoot - D.trough.halfTop) * (line.s[i] / len)) * FIRE.river;
      pts.push({ x, z, y: lv[i] * STREAMING_TERRAIN_SCALE + FIRE.riverOver, sx: -ez / el, sz: ex / el, half, along: line.s[i] / run });
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = (p, s) => push(p.x + p.sx * p.half * s, p.y, p.z + p.sz * p.half * s, p.sx * s, p.sz * s, p.along, s, p.half, 1);
      L(a, -1); L(b, -1); L(b, 1); L(a, -1); L(b, 1); L(a, 1);
    }
  });
  return { px, py, centre: [cx, floorY, cz], base: floorY - (D.lift - D.depth), lava: new Float32Array(verts), count: verts.length / 10 };
}

/** The plume's column, (around, up) pairs, two triangles a cell (render/riteSmoke.js smokeVertices'). Pure. */
export function plumeVertices(segments = FIRE.segments, rows = FIRE.rows) {
  const out = new Float32Array(segments * rows * 12);
  let o = 0;
  for (let j = 0; j < rows; j++) {
    const v0 = j / rows, v1 = (j + 1) / rows;
    for (let i = 0; i < segments; i++) {
      const a = i / segments, b = (i + 1) / segments;
      for (const [u, v] of [[a, v0], [b, v0], [b, v1], [a, v0], [b, v1], [a, v1]]) { out[o++] = u; out[o++] = v; }
    }
  }
  return out;
}

const HEAD = `#version 300 es
precision highp float;
`;
/** The cone the far draw is hidden behind: its centre (scene x, z), the land's level at it and whether to ask (w). */
const HIDE = `uniform vec4 uCone;
uniform float uProf[${FIRE.profile}];
uniform vec3 uEye;
float coneAt(vec2 xz) {
  float f = sqrt(length(xz - uCone.xy) / ${f1(RED_MOUNTAIN_REACH)}) * ${f1(FIRE.profile - 1)};   // profileR's inverse
  if (f >= ${f1(FIRE.profile - 1)}) return -1e9;
  int i = int(floor(f));
  return uCone.z + mix(uProf[i], uProf[min(i + 1, ${FIRE.profile - 1})], fract(f));
}
// is p hidden from the eye by the cone itself: the ray stepped against its profile within hide's reach of its centre,
// and at its crossings of the rim (the crest a step would miss); the profile stands on the land at the centre, so what
// it stands over the eye's own ground is its error there, given back (the land falls away from the plateau)
bool under(vec3 q, float m) { return q.y < coneAt(q.xz) - m; }
bool hidden(vec3 p, float margin) {
  if (uCone.w < 0.5) return false;
  float m = margin + max(0.0, coneAt(uEye.xz) - uEye.y);
  vec2 o = uEye.xz - uCone.xy, d = p.xz - uEye.xz;
  float a = dot(d, d), b = dot(o, d), c0 = dot(o, o);
  if (a < 1.0) return false;
  float disc = b * b - a * (c0 - ${f1(FIRE.hide * FIRE.hide)});
  if (disc <= 0.0) return false;
  float s = sqrt(disc), t0 = max((-b - s) / a, 0.0), t1 = min((-b + s) / a, 0.97);
  if (t1 <= t0) return false;
  for (int k = 0; k <= ${FIRE.steps}; k++) {
    if (under(mix(uEye, p, mix(t0, t1, float(k) / ${f1(FIRE.steps)})), m)) return true;
  }
  float rd = b * b - a * (c0 - ${f1(D.rim * D.rim)});
  if (rd <= 0.0) return false;
  float rs = sqrt(rd), ta = (-b - rs) / a, tb = (-b + rs) / a;
  float crest = uCone.z + ${f1(D.lift)} - m;   // the rim's own height, where the table's samples round it off
  return (ta > 0.0 && ta < 0.97 && mix(uEye, p, ta).y < crest) || (tb > 0.0 && tb < 0.97 && mix(uEye, p, tb).y < crest);
}
`;
const NOISE = `float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 q) {
  vec2 i = floor(q), f = fract(q), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 q) { return 0.55 * vnoise(q) + 0.3 * vnoise(q * 2.03 + 7.1) + 0.15 * vnoise(q * 4.11 + 3.3); }
// two layers half a period apart, each carried by its own phase and crossfaded at its wrap: the flow never jumps
float flow(vec2 q, vec2 dir, float t) {
  float p0 = fract(t), p1 = fract(t + 0.5), w = abs(p0 - 0.5) * 2.0;
  return mix(fbm(q - dir * p0), fbm(q - dir * p1 + 17.3), w);
}
`;
/** Distance haze in the fire's two draws: the far ring's ramp to its hold over the rim (its fog's colour), the world's
 *  linear fog nearer. */
const HAZE = `uniform vec3 uFogColor;
uniform vec4 uHaze;   // the ramp's start and end, the most of the colour taken, and 1 far / 0 near
float hazeAt(float d) { return min(smoothstep(uHaze.x, uHaze.y, d), uHaze.z); }
`;

export const LAVA_VS = HEAD + `layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aSide;
layout(location = 2) in vec4 aInfo;
uniform mat4 uVP;
uniform vec3 uOrigin;
uniform vec3 uEye;
out vec3 vWorld;
out vec4 vInfo;
out vec2 vLocal;
void main() {
  vec3 p = uOrigin + aPos;
  // a river never thinner than a few pixels: widened across by the eye's distance
  float extra = max(0.0, distance(p, uEye) * ${f1(FIRE.widen)} - aInfo.z);
  p += aSide * extra;
  vWorld = p;
  vInfo = aInfo;
  vLocal = aPos.xz;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const LAVA_FS = HEAD + `in vec3 vWorld;
in vec4 vInfo;
in vec2 vLocal;
uniform float uTime;
${HIDE}${HAZE}out vec4 o;
${NOISE}void main() {
  if (hidden(vWorld, ${f1(FIRE.margin.lava)})) discard;
  bool lake = vInfo.w < 0.5;
  // the lake churns slowly; a river runs down its line, faster than the lake, hottest at its source
  float n = lake ? flow(vLocal / 160.0, vec2(0.7, 0.4), uTime) : flow(vec2(vInfo.y * 1.3, vInfo.x * 40.0), vec2(0.0, 3.0), uTime * 1.6);
  float hot = lake ? 0.85 : mix(0.95, 0.45, vInfo.x);
  float melt = smoothstep(0.62 - 0.3 * hot, 0.78 - 0.2 * hot, n) * (lake ? 1.0 : 1.0 - 0.5 * abs(vInfo.y));
  vec3 col = mix(${v3(FIRE.crust)}, ${v3(FIRE.molten)} * ${f1(FIRE.glow)}, melt);
  col = mix(col, uFogColor, hazeAt(distance(vWorld, uEye)) * ${f1(FIRE.hazeHold)} * (1.0 - 0.6 * melt));
  o = vec4(col, 1.0);
}`;

/** The plume's billows: world-space value noise about its foot (no seam round the column, none when the world recentres),
 *  its cells growing as they climb, carried up by two phases crossfaded at their wraps. */
const BILLOWS = `float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise3(vec3 q) {
  vec3 i = floor(q), f = fract(q), u = f * f * (3.0 - 2.0 * f);
  float a = mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), u.x), b = mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), u.x);
  float c = mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), u.x), d = mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}
float fbm3(vec3 q) { return 0.55 * vnoise3(q) + 0.3 * vnoise3(q * 2.03 + 7.1) + 0.15 * vnoise3(q * 4.11 + 3.3); }
float billows(vec3 rel, float h, float t) {
  vec3 q = rel / mix(${f1(FIRE.plume.billow[0])}, ${f1(FIRE.plume.billow[1])}, h);
  float p0 = fract(t), p1 = fract(t + 0.5), w = abs(p0 - 0.5) * 2.0;
  return mix(fbm3(q - vec3(0.0, p0 * ${f1(FIRE.plume.rise)}, 0.0)), fbm3(q - vec3(0.0, p1 * ${f1(FIRE.plume.rise)}, 0.0) + 17.3), w);
}
`;

export const PLUME_VS = HEAD + `layout(location = 0) in vec2 aUV;   // x around 0..1, y up 0..1
uniform mat4 uVP;
uniform vec3 uFoot;   // the plume's foot, on the lake
uniform vec3 uEye;
uniform float uTime;
out vec2 vUV;
out vec3 vWorld;
out vec3 vNormal;
${BILLOWS}vec3 axisAt(float h) { return uFoot + vec3(${f1(FIRE.plume.lean[0])} * h * h, h * ${f1(FIRE.plume.height)}, ${f1(FIRE.plume.lean[1])} * h * h); }   // scene z is north
vec3 placeAt(vec2 uv) {
  float a = uv.x * 6.283185307179586, h = clamp(uv.y, 0.0, 1.0);
  vec3 dir = vec3(cos(a), 0.0, sin(a)), c = axisAt(h);
  float r0 = mix(${f1(FIRE.plume.footR)}, ${f1(FIRE.plume.topR)}, pow(h, ${f1(FIRE.plume.swell)}));
  float r = r0 * (1.0 + ${f1(FIRE.plume.lump)} * (billows(c - uFoot + dir * r0, h, uTime) - 0.5) * 2.0);
  return c + dir * max(r, distance(uEye.xz, uFoot.xz) * 0.006);
}
void main() {
  vec3 p = placeAt(aUV);
  vec2 e = vec2(${f1(0.25 / FIRE.segments)}, ${f1(0.25 / FIRE.rows)});
  vec3 n = normalize(cross(placeAt(aUV + vec2(0.0, e.y)) - placeAt(aUV - vec2(0.0, e.y)), placeAt(aUV + vec2(e.x, 0.0)) - placeAt(aUV - vec2(e.x, 0.0))));
  vNormal = dot(n, p - axisAt(clamp(aUV.y, 0.0, 1.0))) < 0.0 ? -n : n;   // outward
  vUV = aUV;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const PLUME_FS = HEAD + `in vec2 vUV;
in vec3 vWorld;
in vec3 vNormal;
uniform float uTime;
uniform float uLight;
uniform vec3 uLightDir;
uniform vec3 uFoot;
${HIDE}${HAZE}out vec4 o;
${BILLOWS}void main() {
  if (hidden(vWorld, ${f1(FIRE.margin.plume)})) discard;
  float h = vUV.y;
  vec3 N = normalize(vNormal);
  float n = billows(vWorld - uFoot, h, uTime);
  float core = smoothstep(0.0, 0.5, abs(dot(N, normalize(uEye - vWorld))));
  float puff = smoothstep(0.32, 0.62, n) * core;
  float body = smoothstep(0.0, ${f1(FIRE.plume.foot / FIRE.plume.height)}, h) * (1.0 - smoothstep(0.6, 1.0, h));
  float a = clamp(puff * body * ${f1(FIRE.alpha)}, 0.0, 1.0);
  float hz = hazeAt(distance(vWorld, uEye));
  a *= max(1.0 - hz, ${f1(FIRE.hazeFloor)});
  // lit as the frame is, its side to the sun brighter, the haze's colour over it far off
  float lit = max(uLight, ${f1(FIRE.lightMin)}) * mix(${f1(FIRE.shade)}, 1.0, max(dot(N, uLightDir), 0.0));
  vec3 ash = mix(${v3(FIRE.ash)} * lit, uFogColor, hz * 0.7);
  // the crater's fire lighting the ash from under it: light added, the sun outshining most of it by day
  float night = 1.0 - ${f1(1 - FIRE.dayGlow)} * clamp(uLight, 0.0, 1.0);
  vec3 glow = ${v3(FIRE.ember)} * (${f1(FIRE.emberGlow)} * exp(-h * ${f1(FIRE.plume.height / FIRE.emberM)}) * (0.35 + 0.65 * puff) * body * night * (1.0 - hz * 0.5));
  o = vec4(ash * a + glow, a);
}`;

/** The fire's shader text the Ghostfence's glow draws with in the same pass (render/ghostfenceGlow.js): the head, the
 *  cone it hides behind, the noise and the haze. */
export const FIRE_GLSL = Object.freeze({ HEAD, HIDE, NOISE, HAZE });

/** FIRST-USE: the pass's two programs, as its constructor builds them. */
export const FIRE_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[LAVA_VS, LAVA_FS], [PLUME_VS, PLUME_FS]]));

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

/** The volcano's fire: its lava and its plume, drawn by the far ring (render/farRing.js) in its pass. */
export class RedMountainFire {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.lavaProgram = buildProgram(gl, LAVA_VS, LAVA_FS, 'red mountain lava');
    this.plumeProgram = buildProgram(gl, PLUME_VS, PLUME_FS, 'red mountain plume');
    const names = ['uVP', 'uOrigin', 'uEye', 'uTime', 'uCone', 'uProf', 'uFogColor', 'uHaze', 'uFoot', 'uLight', 'uLightDir'];
    const locs = (p) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
    this.lu = locs(this.lavaProgram);
    this.pu = locs(this.plumeProgram);
    this.profile = fireProfile();
    const plume = plumeVertices();
    this.plumeVao = gl.createVertexArray();
    gl.bindVertexArray(this.plumeVao);
    this.plumeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.plumeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, plume, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.plumeCount = plume.length / 2;
    this.lavaVao = null; this.lavaBuf = null; this.mesh = null;
    this._key = null;
    this._vp = new Float32Array(16);
    this._origin = new Float32Array(3);
    this._lensKey = ''; this._lens = null;
    this.drawn = 0;
  }

  /** The mesh for the law's frame and ground, built when either moves (the trace landing, a fit, another world). */
  update(frame, ground) {
    if (!frame || !ground) { this.mesh = null; return; }
    if (this._key && this._key[0] === frame && this._key[1] === ground) return;
    const gl = this.gl;
    this.mesh = fireMesh(frame, ground);
    this._key = [frame, ground];
    if (!this.lavaVao) { this.lavaVao = gl.createVertexArray(); this.lavaBuf = gl.createBuffer(); }
    gl.bindVertexArray(this.lavaVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lavaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.mesh.lava, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.bindVertexArray(null);
  }

  /**
   * Draw the fire in the far ring's pass: `ringOrigin` the ring's origin and (baseX, baseY) its base pixel (the mesh's
   * pixel stands at the origin moved by the pixels between), `view` the world's, `worldProj` the world's lens (the near
   * draw, and the far draw's near plane), `fovY`/`aspect`/`far` the far lens, `eye` the eye, `fog` { color, start, end
   * } the world's linear fog, `rim` [start, end] the far ring's haze ramp, `hold` its haze's most, `light` the frame's
   * light 0..1 and `lightDir` the sun's, `seconds` any clock.
   */
  draw({ ringOrigin, baseX, baseY, view, worldProj, fovY, aspect, far, eye, fog, rim, hold, light, lightDir, seconds }) {
    this.drawn = 0;
    const m = this.mesh;
    if (!m || !eye || !worldProj) return;
    const gl = this.gl, o = this._origin;
    o[0] = ringOrigin[0] + (m.px - baseX) * TERRAIN_SIZE; o[1] = ringOrigin[1]; o[2] = ringOrigin[2] - (m.py - baseY) * TERRAIN_SIZE;
    const worldFar = worldProj[14] / (worldProj[10] + 1);
    const key = `${fovY},${aspect},${far},${worldFar}`;
    if (key !== this._lensKey) { this._lens = mirrorProjectionX(perspective(fovY, aspect, worldFar * 0.98, far)); this._lensKey = key; }
    const t = ((seconds % FIRE.period) + FIRE.period) % FIRE.period / FIRE.period;
    const foot = [o[0] + m.centre[0], o[1] + m.centre[1] + FIRE.lakeOver, o[2] + m.centre[2]];
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    for (const pass of ['far', 'near']) {
      const isFar = pass === 'far';
      mat4Multiply(this._vp, isFar ? /** @type {Float32Array} */ (this._lens) : worldProj, view);
      gl.depthRange(isFar ? 1 : 0, 1);
      const haze = isFar ? [rim[0], rim[1], hold, 1] : [fog.start, fog.end, 1, 0];
      const setCommon = (U) => {
        gl.uniformMatrix4fv(U.uVP, false, this._vp);
        gl.uniform3fv(U.uEye, eye);
        gl.uniform1f(U.uTime, t);
        gl.uniform4f(U.uCone, o[0] + m.centre[0], o[2] + m.centre[2], o[1] + m.base, isFar ? 1 : 0);
        gl.uniform1fv(U.uProf, this.profile);
        gl.uniform3fv(U.uFogColor, fog.color);
        gl.uniform4fv(U.uHaze, haze);
      };
      // the lava, opaque, its own light
      gl.disable(gl.BLEND);
      gl.useProgram(this.lavaProgram);
      setCommon(this.lu);
      gl.uniform3fv(this.lu.uOrigin, o);
      gl.bindVertexArray(this.lavaVao);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
      // the plume over it, premultiplied
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.plumeProgram);
      setCommon(this.pu);
      gl.uniform3fv(this.pu.uFoot, foot);
      gl.uniform1f(this.pu.uLight, Math.max(0, Math.min(1, light)));
      gl.uniform3fv(this.pu.uLightDir, lightDir);
      gl.bindVertexArray(this.plumeVao);
      gl.drawArrays(gl.TRIANGLES, 0, this.plumeCount);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthRange(0, 1);
  }

  /** The cone the far draw hides behind, in the scene: uCone's x, z and the land's level at the centre (`draw`'s own) -
   *  null with no mesh. For the Ghostfence's glow, drawn after it in the pass (render/ghostfenceGlow.js). */
  coneIn(ringOrigin, baseX, baseY) {
    const m = this.mesh;
    if (!m) return null;
    return [ringOrigin[0] + (m.px - baseX) * TERRAIN_SIZE + m.centre[0], ringOrigin[2] - (m.py - baseY) * TERRAIN_SIZE + m.centre[2], ringOrigin[1] + m.base];
  }

  /** Free the GL objects (every allocation has an owner: the far ring's dispose). */
  dispose() {
    const gl = this.gl;
    for (const b of [this.plumeBuf, this.lavaBuf]) if (b) gl.deleteBuffer(b);
    for (const v of [this.plumeVao, this.lavaVao]) if (v) gl.deleteVertexArray(v);
    gl.deleteProgram(this.lavaProgram); gl.deleteProgram(this.plumeProgram);
    this.plumeBuf = this.lavaBuf = null; this.plumeVao = this.lavaVao = null; this.mesh = null;
  }
}
