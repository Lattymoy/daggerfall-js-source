// @ts-check
// RED-MOUNTAIN (bible/03-World/Red-Mountain.md): the volcano's fire - the lava lake on its crater's floor, lava down the
// upper foyada, and the ash plume whose foot the fire lights. The lava lies at the levels the kernel lays the land to
// (redMountainGround), so it lies on the ground near and far. Drawn in the far ring's pass, twice: by the world's lens
// nearer than its far plane, and past it by its own lens at the far plane. Where no depth stands (past the far plane, and
// past the streamed grid's built pixels) the cone hides it analytically (`hidden`: the eye's ray against the cone).
// Not a DFU member. Ledger A (RED-MOUNTAIN).
import { buildProgram } from './glProgram.js';
import { perspective, mirrorProjectionX } from '../world/mat4.js';
import { TERRAIN_SIZE, STREAMING_TERRAIN_SCALE } from '../world/terrain/terrainSampler.js';
import {
  RED_MOUNTAIN_DIALS,
  coneProfile,
  RED_MOUNTAIN_REACH,
  redMountainCrown,
  dirOf,
} from '../world/tamriel/redMountain.js';
import { HORIZON_HAZE_GLSL, SUMMIT_HOLD_GLSL } from './horizonHaze.js';
import { BAY_H } from '../world/tamriel/tamrielFrame.js';

const D = RED_MOUNTAIN_DIALS;
/** THE FIRE'S DIALS (metres, seconds, linear colours). */
export const FIRE = Object.freeze({
  /** the clock its motion runs on: each layer's phase a whole period, two layers crossfaded so the wrap never shows */
  period: 90,
  /** the lake's radius over the crater floor's, and how far over the floor it lies; a river's half-width over its
   *  trough's, how far over its floor, and the least half-width a metre from the eye */
  lake: 0.92,
  lakeOver: 3,
  river: 0.42,
  riverOver: 1.5,
  widen: 0.0012,
  /** the lava: its crust and its melt, the glow it is drawn at, and the share of the haze's colour it takes at most in
   *  clear air (a weather row's whole) */
  crust: Object.freeze([0.06, 0.03, 0.025]),
  molten: Object.freeze([1.0, 0.34, 0.05]),
  glow: 1.6,
  hazeHold: 0.35,
  /** the plume: its height over the floor, its radius at its foot (within the crater's floor, its lumps and all) and its
   *  top, how it swells once over the rim, its lean by its top (east, north - the way the trade winds carry the ash), the
   *  metres its foot fades in over, its billows' size at its foot and its top (metres, world-space), how far they bulge
   *  its outline, and how many they climb a period */
  plume: Object.freeze({
    height: 8500,
    footR: 850,
    topR: 9000,
    swell: 0.6,
    lean: Object.freeze([6500, 2600]),
    foot: 150,
    billow: Object.freeze([900, 2600]),
    lump: 0.45,
    rise: 2,
  }),
  /** its ash's colour and thickness, the least of the frame's light it takes, the share its side away from the sun keeps,
   *  the least of it the haze leaves in clear air (a weather row leaves none) */
  ash: Object.freeze([0.22, 0.2, 0.19]),
  alpha: 0.92,
  lightMin: 0.06,
  shade: 0.45,
  hazeFloor: 0.5,
  /** the fire in its foot: its colour, how fast it falls with height (by e, metres), how bright at night, and the share
   *  of that a full day leaves (the sun outshines it) */
  ember: Object.freeze([1.0, 0.32, 0.08]),
  emberM: 1100,
  emberGlow: 2.2,
  dayGlow: 0.2,
  /** the cone's profile the far draw is hidden behind: its samples out to the volcano's reach, the steps a ray takes,
   *  the depth under the profile a point may lie before it is hidden (a river's trough and the kernel's own noise), how
   *  far from the centre a ray is asked (past it the land, not the cone, is what stands), and how far short of the
   *  point it stops (metres: the point's own ground is not what hides it) */
  profile: 128,
  steps: 24,
  margin: Object.freeze({ lava: 110, plume: 0 }),
  hide: D.rim + 20000,
  stop: 300,
  /** the crown's samples round the crater (the rim's wander, which the profile alone misses by 160 m) */
  crown: 64,
  /** the column's rings round and up */
  segments: 32,
  rows: 48,
  ringSegments: 48,
});

const SAMPLE_M = TERRAIN_SIZE / 128;
const f1 = (v) => Number(v).toFixed(5);
const v3 = (a) => `vec3(${a.map(f1).join(', ')})`;

/** THE CONE'S COLOUR ON THE HORIZON (0-255): its lower flanks dark ash, its summit cone red-brown rock - laid over the
 *  far views' tint (the overworld's, which reads the relief's high bytes as a snowfield) by how far the cone lifts the
 *  land there (metres): the ash whole by `ash`, the rock coming in from `rock[0]` to `rock[1]` at `rockShare`. */
export const ASH_TINT = Object.freeze({
  ash: Object.freeze([58, 52, 49]),
  rock: Object.freeze([96, 58, 44]),
  full: 600,
  rockFrom: 2200,
  rockTo: 3800,
  rockShare: 0.7,
});
/** A far view's tint `rgb` (0-255) under the cone's `lift` (metres over the land there). Pure. */
export function ashTint(rgb, lift) {
  if (!(lift > 0)) return rgb;
  const A = ASH_TINT,
    s = (a, b, v) => {
      const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
  const k = s(0, A.full, lift),
    r = s(A.rockFrom, A.rockTo, lift) * A.rockShare,
    out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const ash = rgb[c] + (A.ash[c] - rgb[c]) * k;
    out[c] = Math.round(ash + (A.rock[c] - ash) * r);
  }
  return out;
}

/** Sample i of the profile's distance from the centre (metres): the reach by the square of its share, so the samples
 *  crowd the crater and the summit cone, where the profile turns. */
export const profileR = (i) => (i / (FIRE.profile - 1)) ** 2 * RED_MOUNTAIN_REACH;
/** THE PROFILE the far draw hides behind: the smooth cone's height over the land at the centre (metres) at FIRE.profile
 *  distances out to the reach (profileR) - the crater's wall inside the rim, the flank past it, never crowned. Pure. */
export function fireProfile() {
  const out = new Float32Array(FIRE.profile);
  for (let i = 0; i < FIRE.profile; i++) {
    const r = profileR(i),
      d = r - D.rim;
    if (d >= 0) {
      out[i] = coneProfile(d);
      continue;
    }
    const t = Math.min(1, -d / (D.rim - D.floor)),
      s = t * t * (3 - 2 * t);
    out[i] = D.lift - D.depth * s;
  }
  return out;
}

/** THE CROWN the far draw hides behind: the share of the lift the cone stands at, FIRE.crown directions round the crater
 *  from east toward north (redMountain.js redMountainCrown). Pure. */
export function fireCrown() {
  const out = new Float32Array(FIRE.crown);
  for (let i = 0; i < FIRE.crown; i++) {
    const [ux, uy] = dirOf(i / FIRE.crown);
    out[i] = redMountainCrown(ux, uy);
  }
  return out;
}

/**
 * THE CONE the far draws hide behind, in the frame of the pixel under the centre (fireMesh's): that pixel, the centre (x,
 * the crater floor's height, z) and the land's level at the centre (the profile's foot). Pure.
 * @param {import('../world/tamriel/redMountain.js').RedMountainFrame} frame
 * @param {import('../world/tamriel/redMountain.js').RedMountainGround} ground
 */
export function fireCone(frame, ground) {
  const px = Math.floor(frame.bx),
    py = Math.floor(frame.by),
    floorY = ground.floor * STREAMING_TERRAIN_SCALE;
  return {
    px,
    py,
    centre: [(frame.cx - px * 128) * SAMPLE_M, floorY, (frame.cy - (BAY_H - py) * 128) * SAMPLE_M],
    base: floorY - (D.lift - D.depth),
  };
}
/** The cone's uCone in the scene (x, z, the land's level at the centre): the ring's origin moved by the pixels between
 *  its base (baseX, baseY) and the cone's. */
export const coneIn = (cone, ringOrigin, baseX, baseY) => [
  ringOrigin[0] + (cone.px - baseX) * TERRAIN_SIZE + cone.centre[0],
  ringOrigin[2] - (cone.py - baseY) * TERRAIN_SIZE + cone.centre[2],
  ringOrigin[1] + cone.base,
];

/**
 * THE FIRE'S MESH in the frame of the pixel under the centre (render/farLandmarks.js's: x east, z north from its south-west
 * corner, y the world's heights). A vertex: its place, its sideways for the widening (none on the lake), and down the
 * lava 0..1, across -1..1, its half-width, its kind (0 the lake, 1 a river). With the pixel, the centre and the land's
 * level there (the profile's foot). Pure.
 * @param {import('../world/tamriel/redMountain.js').RedMountainFrame} frame
 * @param {import('../world/tamriel/redMountain.js').RedMountainGround} ground
 */
export function fireMesh(frame, ground) {
  const cone = fireCone(frame, ground),
    { px, py } = cone;
  const ox = px * 128,
    oy = (BAY_H - py) * 128;
  const local = (gx, gy) => [(gx - ox) * SAMPLE_M, (gy - oy) * SAMPLE_M];
  const verts = [];
  const push = (x, y, z, sx, sz, along, across, half, kind) =>
    verts.push(x, y, z, sx, 0, sz, along, across, half, kind);
  // the lake: a fan on the crater's floor
  const [cx, floorY, cz] = cone.centre,
    ly = floorY + FIRE.lakeOver;
  const lr = D.floor * FIRE.lake,
    n = FIRE.ringSegments;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI,
      a1 = ((i + 1) / n) * 2 * Math.PI;
    push(cx, ly, cz, 0, 0, 0, 0, lr, 0);
    push(cx + Math.cos(a0) * lr, ly, cz + Math.sin(a0) * lr, 0, 0, 1, 0, lr, 0);
    push(cx + Math.cos(a1) * lr, ly, cz + Math.sin(a1) * lr, 0, 0, 1, 0, lr, 0);
  }
  // the rivers: a strip down each foyada's line from the breach, as far as its lava runs, on its floor
  frame.foyada.forEach((line, fi) => {
    const lv = ground.chan[fi],
      m = line.s.length,
      len = line.s[m - 1],
      run = len * D.trough.lava;
    const pts = [];
    for (let i = 0; i < m && line.s[i] <= run; i++) {
      const [x, z] = local(line.pts[2 * i], line.pts[2 * i + 1]);
      const j = Math.min(m - 1, i + 1),
        k = Math.max(0, i - 1);
      const ex = line.pts[2 * j] - line.pts[2 * k],
        ez = line.pts[2 * j + 1] - line.pts[2 * k + 1],
        el = Math.hypot(ex, ez) || 1;
      const half = (D.trough.halfTop + (D.trough.halfFoot - D.trough.halfTop) * (line.s[i] / len)) * FIRE.river;
      pts.push({
        x,
        z,
        y: lv[i] * STREAMING_TERRAIN_SCALE + FIRE.riverOver,
        sx: -ez / el,
        sz: ex / el,
        half,
        along: line.s[i] / run,
      });
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i],
        b = pts[i + 1];
      const L = (p, s) =>
        push(p.x + p.sx * p.half * s, p.y, p.z + p.sz * p.half * s, p.sx * s, p.sz * s, p.along, s, p.half, 1);
      L(a, -1);
      L(b, -1);
      L(b, 1);
      L(a, -1);
      L(b, 1);
      L(a, 1);
    }
  });
  return { ...cone, lava: new Float32Array(verts), count: verts.length / 10 };
}

/** The plume's column, (around, up) pairs, two triangles a cell (render/riteSmoke.js smokeVertices'). Pure. */
export function plumeVertices(segments = FIRE.segments, rows = FIRE.rows) {
  const out = new Float32Array(segments * rows * 12);
  let o = 0;
  for (let j = 0; j < rows; j++) {
    const v0 = j / rows,
      v1 = (j + 1) / rows;
    for (let i = 0; i < segments; i++) {
      const a = i / segments,
        b = (i + 1) / segments;
      for (const [u, v] of [
        [a, v0],
        [b, v0],
        [b, v1],
        [a, v0],
        [b, v1],
        [a, v1],
      ]) {
        out[o++] = u;
        out[o++] = v;
      }
    }
  }
  return out;
}

const HEAD = `#version 300 es
precision highp float;
`;
/** The cone the far draw is hidden behind: its centre (scene x, z), the land's level at it and whether to ask (w); the box
 *  the world's depth stands over (the near draw's built pixels - an empty box in the far draw); its profile and crown. */
const HIDE = `uniform vec4 uCone;
uniform vec4 uDepth;
uniform float uProf[${FIRE.profile}];
uniform vec4 uCrown[${FIRE.crown / 4}];
uniform vec3 uEye;
float crownAt(vec2 v) {
  float f = fract(atan(v.y, v.x) / 6.283185307179586) * ${f1(FIRE.crown)};
  int i = int(floor(f)), j = (i + 1) % ${FIRE.crown};
  return mix(uCrown[i / 4][i % 4], uCrown[j / 4][j % 4], fract(f));
}
// the cone's height at xz: the profile crowned on the flank; in the crater the crowned rim falling to the one floor
float coneAt(vec2 xz) {
  vec2 v = xz - uCone.xy;
  float r = length(v), f = sqrt(r / ${f1(RED_MOUNTAIN_REACH)}) * ${f1(FIRE.profile - 1)};   // profileR's inverse
  if (f >= ${f1(FIRE.profile - 1)}) return -1e9;
  int i = int(floor(f));
  float p = mix(uProf[i], uProf[min(i + 1, ${FIRE.profile - 1})], fract(f)), c = r > 1.0 ? crownAt(v) : 1.0;
  if (r >= ${f1(D.rim)}) return uCone.z + p * c;
  float s = (${f1(D.lift)} - p) / ${f1(D.depth)};
  return uCone.z + ${f1(D.lift)} * c * (1.0 - s) + ${f1(D.lift - D.depth)} * s;
}
// is p hidden from the eye by the cone itself: the ray stepped against its profile within hide's reach of its centre,
// and at its crossings of the rim (the crest a step would miss), stopping short of p by stop; the profile stands on the
// land at the centre, so what it stands over the eye's own ground is its error there, given back at the eye and none by
// the rim (AUDIT RED-MOUNTAIN F1: given back the whole ray, a far eye saw through the summit)
bool under(vec3 q, float m) { return q.y < coneAt(q.xz) - m; }
float crestAt(vec3 p, float t, float m) { return mix(uEye, p, t).y - (uCone.z + ${f1(D.lift)} * crownAt(mix(uEye.xz, p.xz, t) - uCone.xy) - m); }
bool hidden(vec3 p, float margin) {
  if (uCone.w < 0.5 || (p.x > uDepth.x && p.x < uDepth.z && p.z > uDepth.y && p.z < uDepth.w)) return false;
  float slack = max(0.0, coneAt(uEye.xz) - uEye.y);
  vec2 o = uEye.xz - uCone.xy, d = p.xz - uEye.xz;
  float a = dot(d, d), b = dot(o, d), c0 = dot(o, o);
  if (a < 1.0) return false;
  float stop = 1.0 - ${f1(FIRE.stop)} / sqrt(a), far = max(sqrt(c0) - ${f1(D.rim)}, 1.0);
  float disc = b * b - a * (c0 - ${f1(FIRE.hide * FIRE.hide)});
  if (disc <= 0.0) return false;
  float s = sqrt(disc), t0 = max((-b - s) / a, 0.0), t1 = min((-b + s) / a, stop);
  if (t1 <= t0) return false;
  for (int k = 0; k <= ${FIRE.steps}; k++) {
    vec3 q = mix(uEye, p, mix(t0, t1, float(k) / ${f1(FIRE.steps)}));
    if (under(q, margin + slack * clamp((length(q.xz - uCone.xy) - ${f1(D.rim)}) / far, 0.0, 1.0))) return true;
  }
  float rd = b * b - a * (c0 - ${f1(D.rim * D.rim)});
  if (rd <= 0.0) return false;
  float rs = sqrt(rd), ta = (-b - rs) / a, tb = (-b + rs) / a;
  return (ta > 0.0 && ta < stop && crestAt(p, ta, margin) < 0.0) || (tb > 0.0 && tb < stop && crestAt(p, tb, margin) < 0.0);
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
/** Distance haze in the fire's two draws: the far ring's own law (its hold eased down over the summits; under a weather
 *  row the row's own, horizonHazeOf), one in both, so no step stands at the world's far plane; and the far draw's split -
 *  nearer than the far plane the near draw drew. */
const HAZE = `uniform vec3 uFogColor;
uniform vec4 uHaze;   // the world fog's start and end, the ring's rim ramp's start and end
uniform vec3 uHold;   // the ring's haze hold, its origin's height, the streamed grid's edge (metres out)
uniform vec2 uFogLaw;   // AUDIT FB1031 II G1: a weather row's law and density (horizonHazeOf), x 0 the linear ramp
uniform vec3 uHazeFrom;   // AUDIT FB1031 II G1: where the haze is measured from - the eye, a weather's traveller (TV1)
uniform float uSplit;   // the far draw's: the world's far plane (0 in the near draw)
${HORIZON_HAZE_GLSL}${SUMMIT_HOLD_GLSL}
float hazeAt(float d, float y) { return horizonHazeOf(uFogLaw, d, uHaze.x, uHaze.y, uHaze.z, uHaze.w, summitHoldAt(uHold.x, y - uHold.y, d, uHold.z)); }
float hazeOf(vec3 p) { return hazeAt(distance(p, uHazeFrom), p.y); }
// a look's own share, clear, kept through the draw distance's haze; under a weather row its share is the land's (weather)
float clearOr(float clear, float weather) { return uFogLaw.x < 0.5 ? clear : weather; }
bool nearDrawn() { return 1.0 / gl_FragCoord.w < uSplit; }
`;

export const LAVA_VS =
  HEAD +
  `layout(location = 0) in vec3 aPos;
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

export const LAVA_FS =
  HEAD +
  `in vec3 vWorld;
in vec4 vInfo;
in vec2 vLocal;
uniform float uTime;
${HIDE}${HAZE}out vec4 o;
${NOISE}void main() {
  if (nearDrawn() || hidden(vWorld, ${f1(FIRE.margin.lava)})) discard;
  bool lake = vInfo.w < 0.5;
  // the lake churns slowly; a river runs down its line, faster than the lake, hottest at its source
  float n = lake ? flow(vLocal / 160.0, vec2(0.7, 0.4), uTime) : flow(vec2(vInfo.y * 1.3, vInfo.x * 40.0), vec2(0.0, 3.0), uTime * 2.0);
  float hot = lake ? 0.85 : mix(0.95, 0.45, vInfo.x);
  float melt = smoothstep(0.62 - 0.3 * hot, 0.78 - 0.2 * hot, n) * (lake ? 1.0 : 1.0 - 0.5 * abs(vInfo.y));
  vec3 col = mix(${v3(FIRE.crust)}, ${v3(FIRE.molten)} * ${f1(FIRE.glow)}, melt);
  float hz = hazeOf(vWorld);
  col = mix(col, uFogColor, clearOr(hz * ${f1(FIRE.hazeHold)} * (1.0 - 0.6 * melt), hz));   // AUDIT FB1031 II G1: a weather's whole, as the land's
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

export const PLUME_VS =
  HEAD +
  `layout(location = 0) in vec2 aUV;   // x around 0..1, y up 0..1
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
  float up = clamp((h - ${f1(D.depth / FIRE.plume.height)}) / ${f1(1 - D.depth / FIRE.plume.height)}, 0.0, 1.0);   // over the rim
  float r0 = mix(${f1(FIRE.plume.footR)}, ${f1(FIRE.plume.topR)}, pow(up, ${f1(FIRE.plume.swell)}));
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

/** The plume's look, its parts by name: the ash's puffs, the column's body by height, its light, and the fire in its foot. */
const PLUME_LOOK = `// the ash's puffs at billow noise n, seen at facing (|N.V|): thin at the column's edge
float puffOf(float n, float facing) { return smoothstep(0.32, 0.62, n) * smoothstep(0.0, 0.5, facing); }
// the column by height (0 its foot, 1 its top): faded in over its foot, out over its top
float bodyOf(float h) { return smoothstep(0.0, ${f1(FIRE.plume.foot / FIRE.plume.height)}, h) * (1.0 - smoothstep(0.6, 1.0, h)); }
// lit as the frame is (light 0..1), its side to the sun (sunward, N.L) brighter
float litOf(float light, float sunward) { return max(light, ${f1(FIRE.lightMin)}) * mix(${f1(FIRE.shade)}, 1.0, max(sunward, 0.0)); }
// the crater's fire lighting the ash from under it at height h: light added, falling with height, outshone by day
vec3 emberOf(float h, float puff, float body, float light) {
  float night = 1.0 - ${f1(1 - FIRE.dayGlow)} * clamp(light, 0.0, 1.0);
  return ${v3(FIRE.ember)} * (${f1(FIRE.emberGlow)} * exp(-h * ${f1(FIRE.plume.height / FIRE.emberM)}) * (0.35 + 0.65 * puff) * body * night);
}
`;

export const PLUME_FS =
  HEAD +
  `in vec2 vUV;
in vec3 vWorld;
in vec3 vNormal;
uniform float uTime;
uniform float uLight;
uniform vec3 uLightDir;
uniform vec3 uFoot;
uniform float uFace;   // -1 its far side, drawn first; 1 its near side, over it
${HIDE}${HAZE}out vec4 o;
${BILLOWS}${PLUME_LOOK}void main() {
  vec3 N = normalize(vNormal);
  if (dot(N, uEye - vWorld) * uFace < 0.0 || nearDrawn() || hidden(vWorld, ${f1(FIRE.margin.plume)})) discard;
  float h = vUV.y, puff = puffOf(billows(vWorld - uFoot, h, uTime), abs(dot(N, normalize(uEye - vWorld)))), body = bodyOf(h);
  float a = clamp(puff * body * ${f1(FIRE.alpha)}, 0.0, 1.0);
  float dist = distance(vWorld, uEye), hz = hazeOf(vWorld);
  a *= max(1.0 - hz, clearOr(${f1(FIRE.hazeFloor)}, 0.0)) * (1.0 - smoothstep(uHaze.z, uHaze.w, dist));   // closed by the rim as the land is (F7)
  // AUDIT FB1031 II G1: under a weather row its ash, its colour and its fire fog whole, as the land does
  vec3 ash = mix(${v3(FIRE.ash)} * litOf(uLight, dot(N, uLightDir)), uFogColor, hz * clearOr(0.7, 1.0));
  o = vec4(ash * a + emberOf(h, puff, body, uLight) * (1.0 - hz * clearOr(0.5, 1.0)), a);
}`;

/** The fire's shader text the Ghostfence's glow draws with in the same pass (render/ghostfenceGlow.js): the head, the
 *  cone it hides behind, the noise and the haze. */
export const FIRE_GLSL = Object.freeze({ HEAD, HIDE, NOISE, HAZE });

/** FIRST-USE: the pass's two programs, as its constructor builds them. */
export const FIRE_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (
  Object.freeze([
    [LAVA_VS, LAVA_FS],
    [PLUME_VS, PLUME_FS],
  ])
);

/** How far the plume stands from its foot at most (metres, flat): its top's radius, lumped, and its lean. */
const PLUME_SPREAD = FIRE.plume.topR * (1 + FIRE.plume.lump) + Math.hypot(FIRE.plume.lean[0], FIRE.plume.lean[1]);

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

/** The far draw's tables, made once: the cone's profile and its crown (the fire's programs and the glow's set them once). */
let _tables = /** @type {{ profile: Float32Array, crown: Float32Array }|null} */ (null);
export const fireTables = () => (_tables ??= { profile: fireProfile(), crown: fireCrown() });
/** An empty box: the far draw has no depth anywhere. */
const NO_DEPTH = new Float32Array([1, 1, -1, -1]);
/** The hiding's and the haze's uniforms as plain values (test/glsl.mjs's bindings): the tables, no cone, no depth, no
 *  haze, the near draw's split. Pure. */
export function fireUniforms() {
  const { profile, crown } = fireTables();
  return {
    uCone: [0, 0, 0, 0],
    uDepth: Array.from(NO_DEPTH),
    uProf: Array.from(profile),
    uCrown: Array.from({ length: crown.length / 4 }, (_, i) => Array.from(crown.subarray(4 * i, 4 * i + 4))),
    uEye: [0, 0, 0],
    uFogColor: [0, 0, 0],
    uHaze: [0, 1, 1e9, 2e9],
    uHold: [0, 0, 0],
    uFogLaw: [0, 0],
    uHazeFrom: [0, 0, 0],
    uSplit: 0,
    gl_FragCoord: [0, 0, 0, 1],
  };
}

/**
 * The hiding and the haze both draws share, on the program in use (`U` its locations) - `pass` the far ring's (fire.draw's
 * arguments), `isFar` which lens, `vp` the view and lens, `cone` the cone in the scene (coneIn) or null (nothing hides).
 * The glow's too (render/ghostfenceGlow.js).
 */
export function setFireCommon(gl, U, pass, isFar, vp, cone) {
  gl.uniformMatrix4fv(U.uVP, false, vp);
  gl.uniform3fv(U.uEye, pass.eye);
  gl.uniform4f(U.uCone, cone?.[0] ?? 0, cone?.[1] ?? 0, cone?.[2] ?? 0, cone ? 1 : 0);
  const box = !isFar && pass.depth ? pass.depth : NO_DEPTH;
  gl.uniform4f(U.uDepth, box[0], box[1], box[2], box[3]);
  gl.uniform3fv(U.uFogColor, pass.fog.color);
  gl.uniform4f(U.uHaze, pass.fog.start, pass.fog.end, pass.rim[0], pass.rim[1]);
  gl.uniform3f(U.uHold, pass.hold, pass.ringOrigin[1], pass.summitFrom ?? 0);
  gl.uniform2f(U.uFogLaw, pass.fog.law ?? 0, pass.fog.density ?? 0); // AUDIT FB1031 II G1: a weather row's law, the ring's
  const from = pass.hazeFrom ?? pass.eye;
  gl.uniform3f(U.uHazeFrom, from[0], from[1], from[2]);
  gl.uniform1f(U.uSplit, isFar ? pass.worldFar : 0);
}
/** A program's locations of `names`, and the far draw's tables set on it once. */
export function fireLocations(gl, program, names) {
  const U = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
  const { profile, crown } = fireTables();
  gl.useProgram(program);
  gl.uniform1fv(U.uProf, profile);
  gl.uniform4fv(U.uCrown, crown);
  return U;
}
/** The uniforms the hiding and the haze read. */
export const FIRE_COMMON_UNIFORMS = Object.freeze([
  'uVP',
  'uEye',
  'uCone',
  'uDepth',
  'uProf',
  'uCrown',
  'uFogColor',
  'uHaze',
  'uHold',
  'uFogLaw',
  'uHazeFrom',
  'uSplit',
]);

/** The volcano's fire: its lava and its plume, drawn by the far ring (render/farRing.js) in its pass. */
export class RedMountainFire {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.lavaProgram = buildProgram(gl, LAVA_VS, LAVA_FS, 'red mountain lava');
    this.plumeProgram = buildProgram(gl, PLUME_VS, PLUME_FS, 'red mountain plume');
    const names = [...FIRE_COMMON_UNIFORMS, 'uOrigin', 'uTime', 'uFoot', 'uFace', 'uLight', 'uLightDir'];
    this.lu = fireLocations(gl, this.lavaProgram, names);
    this.pu = fireLocations(gl, this.plumeProgram, names);
    gl.useProgram(null);
    const plume = plumeVertices();
    this.plumeVao = gl.createVertexArray();
    gl.bindVertexArray(this.plumeVao);
    this.plumeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.plumeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, plume, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.plumeCount = plume.length / 2;
    this.lavaVao = null;
    this.lavaBuf = null;
    this.mesh = null;
    this._key = null;
    this._vp = new Float32Array(16);
    this._origin = new Float32Array(3);
    this._foot = new Float32Array(3);
    this._lensKey = '';
    this._lens = null;
    this.drawn = 0;
  }

  /** The mesh for the law's frame and ground, built when either moves (the trace landing, a fit, another world). */
  update(frame, ground) {
    if (!frame || !ground) {
      this.mesh = null;
      return;
    }
    if (this._key && this._key[0] === frame && this._key[1] === ground) return;
    const gl = this.gl;
    this.mesh = fireMesh(frame, ground);
    this._key = [frame, ground];
    if (!this.lavaVao) {
      this.lavaVao = gl.createVertexArray();
      this.lavaBuf = gl.createBuffer();
    }
    gl.bindVertexArray(this.lavaVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lavaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.mesh.lava, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.bindVertexArray(null);
  }

  /**
   * Draw the fire in the far ring's pass: `ringOrigin` the ring's origin and (baseX, baseY) its base pixel (the mesh's
   * pixel stands at the origin moved by the pixels between), `view` the world's, `worldProj` the world's lens (the near
   * draw) and `worldFar` its far plane, `fovY`/`aspect`/`far` the far lens, `eye` the eye, `fog` { color, start, end,
   * law, density } (ringFogOf's: law 0 the linear fog), `rim` the far ring's haze ramp, `hold` its haze's most,
   * `summitFrom` the streamed grid's edge (metres out), `hazeFrom` the haze's point (the eye without), `depth` the world's
   * depth's box (scene x0, z0, x1, z1), `light` the frame's light 0..1 and `lightDir` the sun's, `seconds` any clock.
   */
  draw(pass) {
    this.drawn = 0;
    const m = this.mesh,
      { ringOrigin, baseX, baseY, view, worldProj, fovY, aspect, far, eye, light, lightDir, seconds } = pass;
    if (!m || !eye || !worldProj) return;
    const gl = this.gl,
      o = this._origin,
      foot = this._foot;
    o[0] = ringOrigin[0] + (m.px - baseX) * TERRAIN_SIZE;
    o[1] = ringOrigin[1];
    o[2] = ringOrigin[2] - (m.py - baseY) * TERRAIN_SIZE;
    foot[0] = o[0] + m.centre[0];
    foot[1] = o[1] + m.centre[1] + FIRE.lakeOver;
    foot[2] = o[2] + m.centre[2];
    if (Math.hypot(eye[0] - foot[0], eye[2] - foot[2]) - PLUME_SPREAD > far) return; // nothing of it inside the far lens
    const key = `${fovY},${aspect},${far},${pass.worldFar}`;
    if (key !== this._lensKey) {
      this._lens = mirrorProjectionX(perspective(fovY, aspect, pass.worldFar * 0.98, far));
      this._lensKey = key;
    }
    const t = (((seconds % FIRE.period) + FIRE.period) % FIRE.period) / FIRE.period;
    const cone = coneIn(m, ringOrigin, baseX, baseY);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    for (const isFar of [true, false]) {
      mat4Multiply(this._vp, isFar ? /** @type {Float32Array} */ (this._lens) : worldProj, view);
      gl.depthRange(isFar ? 1 : 0, 1);
      // the lava, opaque, its own light
      gl.disable(gl.BLEND);
      gl.useProgram(this.lavaProgram);
      setFireCommon(gl, this.lu, pass, isFar, this._vp, cone);
      gl.uniform1f(this.lu.uTime, t);
      gl.uniform3fv(this.lu.uOrigin, o);
      gl.bindVertexArray(this.lavaVao);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
      // the plume over it, premultiplied: its far side first, its near side over it (AUDIT RED-MOUNTAIN F3)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.plumeProgram);
      setFireCommon(gl, this.pu, pass, isFar, this._vp, cone);
      gl.uniform1f(this.pu.uTime, t);
      gl.uniform3fv(this.pu.uFoot, foot);
      gl.uniform1f(this.pu.uLight, Math.max(0, Math.min(1, light)));
      gl.uniform3fv(this.pu.uLightDir, lightDir);
      gl.bindVertexArray(this.plumeVao);
      for (const face of [-1, 1]) {
        gl.uniform1f(this.pu.uFace, face);
        gl.drawArrays(gl.TRIANGLES, 0, this.plumeCount);
      }
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthRange(0, 1);
  }

  /** Free the GL objects (every allocation has an owner: the far ring's dispose). */
  dispose() {
    const gl = this.gl;
    for (const b of [this.plumeBuf, this.lavaBuf]) if (b) gl.deleteBuffer(b);
    for (const v of [this.plumeVao, this.lavaVao]) if (v) gl.deleteVertexArray(v);
    gl.deleteProgram(this.lavaProgram);
    gl.deleteProgram(this.plumeProgram);
    this.plumeBuf = this.lavaBuf = null;
    this.plumeVao = this.lavaVao = null;
    this.mesh = null;
  }
}
