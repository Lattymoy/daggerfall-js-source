// @ts-check
// THE NEW ERA, DRAWN: the world's part of world/newEraEvent.js's show, one foreign pass after the world's, as the
// Rocket's. The sky at the far plane (its burning, each blast's glow, its cracks), the gunship and its bombs (meshes
// built here; the propellers discs cut to spinning blades), a grid laid on the ground cut to its cracks, each shock's
// dome, and the mushroom clouds' puffs, far to near. The white canvas over the whole picture is ui/newEraCanvas.js's.
// The shaders carry no colour of their own: every colour comes from world/newEraEvent.js.
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { multiply } from '../world/mat4.js';
import {
  NEWERA_HULL,
  NEWERA_HULL_DARK,
  NEWERA_GUN,
  NEWERA_COAT,
  NEWERA_MANE,
  NEWERA_BLAZE,
  NEWERA_EYE,
  NEWERA_BOMB,
  NEWERA_FIRE,
  NEWERA_SMOKE,
  NEWERA_BURN,
  NEWERA_WHITE,
  NEWERA_SKY_CRACKS,
  NEWERA_DROPS,
} from '../world/newEraEvent.js';

const fixed = (value) => value.toFixed(4);
const vec3 = (rgb) => `vec3(${rgb.map(fixed).join(', ')})`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
const FOG = `uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
`;
const HASH = `float rh(float n) { return fract(sin(n) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), q = fract(p);
  q = q * q * (3.0 - 2.0 * q);
  float a = rh(dot(i, vec2(1.0, 57.0))), b = rh(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
  float c = rh(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0))), d = rh(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, q.x), mix(c, d, q.x), q.y);
}
`;
const FOG_UNIFORMS = ['uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze', 'uFogColor'];
/** The most blasts the sky glows round at once: one a bomb. */
export const NEWERA_GLOWS_MAX = NEWERA_DROPS.length;

// ── The sky ───────────────────────────────────────────────────────
export const NEWERA_SKY_VS =
  HEAD +
  `layout(location = 0) in vec2 aP;
out vec2 vNdc;
void main() { vNdc = aP; gl_Position = vec4(aP, 1.0, 1.0); }`;
export const NEWERA_SKY_FS =
  HEAD +
  `in vec2 vNdc;
uniform mat4 uView;
uniform vec2 uInvP;
uniform float uBurn;
uniform float uCrack;
uniform vec3 uFrom[${NEWERA_SKY_CRACKS}];
uniform vec3 uOffset;
uniform vec3 uGlowDir[${NEWERA_GLOWS_MAX}];
uniform float uGlow[${NEWERA_GLOWS_MAX}];
out vec4 o;
vec3 h3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
// the gap between the nearest two cell points: small on a cell's edge, where the sky cracks
float edge3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    float d = length(g + h3(i + g) - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
void main() {
  vec3 dir = normalize(transpose(mat3(uView)) * vec3(vNdc.x * uInvP.x, vNdc.y * uInvP.y, -1.0));
  float e = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(${vec3(NEWERA_BURN)}, ${vec3(NEWERA_BURN)} * 0.45, pow(e, 0.6));
  float a = uBurn * 0.55;
  for (int i = 0; i < ${NEWERA_GLOWS_MAX}; i++) {
    float g = uGlow[i];
    if (g <= 0.001) continue;
    float c = max(dot(dir, uGlowDir[i]), 0.0);
    float k = clamp(g * (pow(c, 24.0) + 0.35 * pow(c, 4.0)), 0.0, 1.0);
    vec3 fire = mix(${vec3(NEWERA_FIRE[1])}, ${vec3(NEWERA_FIRE[0])}, pow(c, 40.0));
    col = mix(col, fire, k / max(a + k, 0.001));
    a = max(a, k);
  }
  if (uCrack > 0.001) {
    float near = 9.0;
    for (int j = 0; j < ${NEWERA_SKY_CRACKS}; j++) near = min(near, acos(clamp(dot(dir, uFrom[j]), -1.0, 1.0)));
    float reach = uCrack * 2.6;
    if (near < reach) {
      vec3 p = dir * 2.6 + uOffset + 0.05 * sin(dir.zxy * 23.0 + dir.yzx * 17.0);
      float d = edge3(p);
      float width = min(0.028, 0.004 + (reach - near) * 0.015);
      float core = 1.0 - smoothstep(width * 0.3, width, d);
      float rim = 1.0 - smoothstep(width, width * 2.4, d);
      col = mix(col, vec3(0.02), rim * (1.0 - core) * 0.85);
      col = mix(col, ${vec3(NEWERA_WHITE)}, core);
      a = max(a, max(core, rim * 0.7));
    }
  }
  if (a <= 0.002) discard;
  o = vec4(col, a);
}`;

// ── The gunship and its bombs ─────────────────────────────────────
/** A mesh vertex: `aP` its place in the model, `aN` its normal, `aC` its colour, `aUv` a propeller disc's own place
 *  (-1..1), or 9 9 on a solid part. */
export const NEWERA_MESH_VS =
  HEAD +
  `layout(location = 0) in vec3 aP;
layout(location = 1) in vec3 aN;
layout(location = 2) in vec3 aC;
layout(location = 3) in vec2 aUv;
uniform mat4 uVP;
uniform mat4 uModel;
out vec3 vWorld;
out vec3 vN;
out vec3 vC;
out vec2 vUv;
void main() {
  vec4 w = uModel * vec4(aP, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(uModel) * aN);
  vC = aC;
  vUv = aUv;
  gl_Position = uVP * w;
}`;
export const NEWERA_MESH_FS =
  HEAD +
  `in vec3 vWorld;
in vec3 vN;
in vec3 vC;
in vec2 vUv;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSun;
uniform float uTime;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}${HASH}
void main() {
  vec3 col = vC;
  if (vUv.x < 5.0) {
    // a propeller: four blades turning too fast to see, a dithered blur
    float r = length(vUv);
    if (r > 1.0) discard;
    float blade = pow(abs(cos(2.0 * (atan(vUv.y, vUv.x) - uTime * 9.0))), 12.0);
    float cover = (0.16 + 0.5 * blade) * (1.0 - 0.3 * r);
    if (rh(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) > cover) discard;
    col = ${vec3(NEWERA_GUN)};
  }
  vec3 n = normalize(vN);
  vec3 lit = uAmbient + vec3(0.18) + uSun * max(dot(n, uLightDir), 0.0);
  lit *= mix(0.72, 1.0, smoothstep(-0.6, 0.3, n.y));
  o = vec4(mix(uFogColor, col * lit, max(fogFactorAt(vWorld), 0.55)), 1.0);
}`;

// ── The ground's cracks ───────────────────────────────────────────
export const NEWERA_GROUND_VS =
  HEAD +
  `layout(location = 0) in vec3 aP;
uniform mat4 uVP;
out vec3 vWorld;
void main() { vWorld = aP; gl_Position = uVP * vec4(aP, 1.0); }`;
export const NEWERA_GROUND_FS =
  HEAD +
  `in vec3 vWorld;
uniform vec2 uAnchor;   // the scene's origin against where the cracks were first seen, metres
uniform vec2 uOrigin;   // where they spread from, in the scene
uniform float uCrack;
uniform float uReach;
uniform float uCell;
uniform float uLight;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}${HASH}
vec2 h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// the distance to the nearest edge between two cells: a crack runs along every edge
float edge2(vec2 p) {
  vec2 n = floor(p), f = fract(p), mg = vec2(0.0), mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)), r = g + h2(n + g) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j)), r = g + h2(n + g) - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}
void main() {
  vec2 w = vWorld.xz + uAnchor;
  float from = length(vWorld.xz - uOrigin);
  float front = uCrack * uReach * 1.15 - from + (vn(w * 0.05) - 0.5) * 30.0;
  if (front <= 0.0) discard;
  vec2 warp = vec2(vn(w * 0.15), vn(w * 0.15 + 31.7)) - 0.5;
  float d = edge2((w + warp * 6.0) / uCell) * uCell;
  float width = min(0.5, 0.06 + front * 0.004) * smoothstep(0.0, 0.35, uCrack);
  float core = 1.0 - smoothstep(width * 0.35, width, d);
  float rim = 1.0 - smoothstep(width, width * 2.2, d);
  float a = max(core, rim * 0.8) * (1.0 - smoothstep(uReach * 0.85, uReach, from));
  if (a <= 0.01) discard;
  vec3 col = mix(vec3(0.05, 0.04, 0.03) * uLight, ${vec3(NEWERA_WHITE)}, core);
  o = vec4(mix(uFogColor, col, max(fogFactorAt(vWorld), core * 0.8)), a);
}`;

// ── The shock's domes ─────────────────────────────────────────────
/** A dome: the unit half-sphere `aP`, each one's `aA` (ground zero, radius) and `aB` (how much it shows). */
export const NEWERA_DOME_VS =
  HEAD +
  `layout(location = 0) in vec3 aP;
layout(location = 1) in vec4 aA;
layout(location = 2) in vec4 aB;
uniform mat4 uVP;
out vec3 vWorld;
out vec3 vCentre;
out float vAlpha;
void main() {
  vCentre = aA.xyz;
  vWorld = aA.xyz + aP * aA.w;
  vAlpha = aB.x;
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
export const NEWERA_DOME_FS =
  HEAD +
  `in vec3 vWorld;
in vec3 vCentre;
in float vAlpha;
uniform vec3 uEye;
uniform float uTime;
out vec4 o;
${HASH}
void main() {
  vec3 n = normalize(vWorld - vCentre);
  float rim = 1.0 - abs(dot(n, normalize(uEye - vWorld)));
  float shimmer = 0.6 + 0.4 * vn(vec2(atan(n.z, n.x) * 9.0 + uTime * 0.7, n.y * 14.0 - uTime));
  float a = vAlpha * pow(rim, 3.0) * shimmer;
  if (a <= 0.003) discard;
  o = vec4(mix(${vec3(NEWERA_WHITE)}, ${vec3(NEWERA_FIRE[1])}, 0.25), a);
}`;

// ── The clouds ────────────────────────────────────────────────────
/** A puff: `aA` its place and size, `aB` its heat, its alpha and its seed. Upright to the eye. */
export const NEWERA_PUFF_VS =
  HEAD +
  `layout(location = 0) in vec2 aQ;
layout(location = 1) in vec4 aA;
layout(location = 2) in vec4 aB;
uniform mat4 uVP;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUv;
out vec3 vWorld;
out float vHeat;
out float vAlpha;
out float vSeed;
void main() {
  vUv = aQ;
  vHeat = aB.x;
  vAlpha = aB.y;
  vSeed = aB.z;
  vWorld = aA.xyz + (uRight * aQ.x + uUp * aQ.y) * aA.w;
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
export const NEWERA_PUFF_FS =
  HEAD +
  `in vec2 vUv;
in vec3 vWorld;
in float vHeat;
in float vAlpha;
in float vSeed;
uniform float uLight;
uniform float uTime;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}${HASH}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
void main() {
  vec2 p = vUv;
  float r = length(p);
  float n = fbm(p * 2.2 + vSeed * 17.0 + vec2(uTime * 0.05, -uTime * 0.08));
  float cover = 1.0 - smoothstep(0.45 + 0.35 * n, 1.0, r);
  if (cover <= 0.01) discard;
  float h = clamp(vHeat * (1.15 - r * 0.5) + (n - 0.5) * 0.25, 0.0, 1.0);
  vec3 fire = h > 0.66 ? mix(${vec3(NEWERA_FIRE[1])}, ${vec3(NEWERA_FIRE[0])}, (h - 0.66) / 0.34)
                       : mix(${vec3(NEWERA_FIRE[2])}, ${vec3(NEWERA_FIRE[1])}, h / 0.66);
  vec3 smoke = ${vec3(NEWERA_SMOKE)} * (0.55 + 0.6 * n) * clamp(uLight, 0.4, 1.2) * mix(0.8, 1.1, smoothstep(-0.8, 0.8, p.y));
  vec3 col = mix(smoke, fire, smoothstep(0.08, 0.5, h));
  o = vec4(mix(uFogColor, col, max(fogFactorAt(vWorld), 0.5 + 0.5 * h)), cover * vAlpha);
}`;

/** The pass's programs, as the constructor builds them. */
export const NEWERA_PROGRAMS = Object.freeze([
  Object.freeze([NEWERA_SKY_VS, NEWERA_SKY_FS]),
  Object.freeze([NEWERA_MESH_VS, NEWERA_MESH_FS]),
  Object.freeze([NEWERA_GROUND_VS, NEWERA_GROUND_FS]),
  Object.freeze([NEWERA_DOME_VS, NEWERA_DOME_FS]),
  Object.freeze([NEWERA_PUFF_VS, NEWERA_PUFF_FS]),
]);

// ── The meshes, built ─────────────────────────────────────────────
const SOLID = [9, 9];
/** Floats a mesh vertex holds: place, normal, colour, disc place. */
export const NEWERA_MESH_STRIDE = 11;

const vertex = (out, pos, nrm, rgb, uv = SOLID) => out.push(...pos, ...nrm, ...rgb, ...uv);
const unit = (vec) => {
  const len = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  return [vec[0] / len, vec[1] / len, vec[2] / len];
};
const crossOf = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const quad = (out, corners, nrm, rgb) => {
  const [first, second, third, fourth] = corners;
  for (const pos of [first, second, third, first, third, fourth]) vertex(out, pos, nrm, rgb);
};

/** A box: its centre, its size along x, y, z, and its colour. */
function box(out, centre, size, rgb) {
  const [midX, midY, midZ] = centre,
    [halfX, halfY, halfZ] = size.map((side) => side / 2);
  const corner = (signX, signY, signZ) => [midX + signX * halfX, midY + signY * halfY, midZ + signZ * halfZ];
  quad(out, [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)], [1, 0, 0], rgb);
  quad(out, [corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1), corner(-1, -1, -1)], [-1, 0, 0], rgb);
  quad(out, [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1)], [0, 1, 0], rgb);
  quad(out, [corner(-1, -1, 1), corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1)], [0, -1, 0], rgb);
  quad(out, [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)], [0, 0, 1], rgb);
  quad(out, [corner(1, -1, -1), corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1)], [0, 0, -1], rgb);
}

/** A tube: from one point to another, its radius at each end, closed at both. */
function tube(out, from, to, radius0, radius1, rgb, segs = 12) {
  const axis = unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  const side = unit(crossOf(Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], axis));
  const other = crossOf(axis, side);
  const ring = (centre, radius, angle) => {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const way = [side[0] * cos + other[0] * sin, side[1] * cos + other[1] * sin, side[2] * cos + other[2] * sin];
    return { pos: [centre[0] + way[0] * radius, centre[1] + way[1] * radius, centre[2] + way[2] * radius], way };
  };
  const back = [-axis[0], -axis[1], -axis[2]];
  for (let i = 0; i < segs; i++) {
    const angle0 = (i / segs) * 2 * Math.PI,
      angle1 = ((i + 1) / segs) * 2 * Math.PI;
    const p00 = ring(from, radius0, angle0),
      p01 = ring(from, radius0, angle1),
      p10 = ring(to, radius1, angle0),
      p11 = ring(to, radius1, angle1);
    for (const corner of [p00, p10, p11, p00, p11, p01]) vertex(out, corner.pos, corner.way, rgb);
    vertex(out, from, back, rgb);
    vertex(out, p01.pos, back, rgb);
    vertex(out, p00.pos, back, rgb);
    vertex(out, to, axis, rgb);
    vertex(out, p10.pos, axis, rgb);
    vertex(out, p11.pos, axis, rgb);
  }
}

/** A blob: an ellipsoid at its centre, its radii along x, y, z. */
function blob(out, centre, radii, rgb, rings = 8, segs = 12) {
  const spot = (ringIndex, segIndex) => {
    const lat = (ringIndex / rings) * Math.PI - Math.PI / 2,
      lon = (segIndex / segs) * 2 * Math.PI;
    const sphere = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    return {
      pos: [centre[0] + sphere[0] * radii[0], centre[1] + sphere[1] * radii[1], centre[2] + sphere[2] * radii[2]],
      nrm: unit([sphere[0] / radii[0], sphere[1] / radii[1], sphere[2] / radii[2]]),
    };
  };
  for (let ringIndex = 0; ringIndex < rings; ringIndex++)
    for (let segIndex = 0; segIndex < segs; segIndex++) {
      const p00 = spot(ringIndex, segIndex),
        p01 = spot(ringIndex, segIndex + 1),
        p10 = spot(ringIndex + 1, segIndex),
        p11 = spot(ringIndex + 1, segIndex + 1);
      for (const corner of [p00, p10, p11, p00, p11, p01]) vertex(out, corner.pos, corner.nrm, rgb);
    }
}

/** A propeller's disc, facing +z. */
function disc(out, centre, radius) {
  const [midX, midY, midZ] = centre;
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const index of [0, 1, 2, 0, 2, 3]) {
    const [discX, discY] = corners[index];
    vertex(out, [midX + discX * radius, midY + discY * radius, midZ], [0, 0, 1], NEWERA_GUN, [discX, discY]);
  }
}

/**
 * THE GUNSHIP'S MODEL, in a real gunship's metres: +z its nose, +y its roof, +x its port side. A high wing with four
 * engines and their propellers, a tail with its fin, the landing gear's pods, three guns out of the port side, and in
 * place of the nose a horse's head: its neck, its head and muzzle, a white blaze, its eyes, ears, nostrils and mane.
 * Pure.
 */
export function gunshipMesh() {
  const out = [];
  const coatDark = NEWERA_COAT.map((part) => part * 0.8);
  tube(out, [0, 0, -12], [0, 0, 12], 2.2, 2.2, NEWERA_HULL, 16);
  tube(out, [0, 0.3, -12], [0, 1.6, -21], 2.2, 0.5, NEWERA_HULL, 16);
  box(out, [0, 2.3, 1.5], [40, 0.55, 4.4], NEWERA_HULL);
  for (const [x, y, z0, z1] of [
    [5.6, 1.7, -1, 4.6],
    [-5.6, 1.7, -1, 4.6],
    [10.8, 1.8, -0.8, 4.4],
    [-10.8, 1.8, -0.8, 4.4],
  ]) {
    tube(out, [x, y, z0], [x, y, z1], 0.8, 0.65, NEWERA_HULL_DARK);
    blob(out, [x, y, z1 + 0.3], [0.35, 0.35, 0.6], NEWERA_GUN, 6, 8);
    disc(out, [x, y, z1 + 0.45], 2.05);
  }
  box(out, [0, 5.5, -18.2], [0.45, 7.5, 4.2], NEWERA_HULL);
  box(out, [0, 1.6, -18.6], [15, 0.35, 3], NEWERA_HULL);
  box(out, [2.15, -1.3, 0.5], [1.1, 1.3, 7], NEWERA_HULL_DARK);
  box(out, [-2.15, -1.3, 0.5], [1.1, 1.3, 7], NEWERA_HULL_DARK);
  tube(out, [2.1, -0.4, -5.5], [4.8, -0.9, -5.5], 0.35, 0.3, NEWERA_GUN);
  tube(out, [2.1, -0.3, -1.8], [4, -0.6, -1.8], 0.25, 0.22, NEWERA_GUN);
  tube(out, [2.1, -0.5, 7.5], [3.6, -0.7, 7.5], 0.3, 0.3, NEWERA_GUN);
  tube(out, [0, 0.2, 11.5], [0, 1.2, 16.5], 2.1, 1.5, NEWERA_COAT, 16);
  blob(out, [0, 1.6, 18.5], [1.55, 1.8, 2.8], NEWERA_COAT);
  blob(out, [0, 0.6, 21.2], [1.25, 1.15, 1.7], coatDark);
  blob(out, [0, 1.95, 20.2], [0.35, 0.9, 1.6], NEWERA_BLAZE, 6, 8);
  for (const side of [1, -1]) {
    blob(out, [side * 1.42, 2.2, 19.2], [0.32, 0.4, 0.4], NEWERA_EYE, 5, 8);
    blob(out, [side * 0.55, 0.3, 22.75], [0.22, 0.22, 0.22], NEWERA_EYE, 4, 6);
    tube(out, [side * 0.7, 3, 17.6], [side * 0.85, 4.6, 17], 0.45, 0.05, NEWERA_COAT, 8);
  }
  for (let k = 0; k < 7; k++) box(out, [0, 2.25 + 0.1 * k, 11.5 + k], [0.5, 0.9, 0.95], NEWERA_MANE);
  box(out, [0, 3.3, 18.2], [0.5, 0.6, 1], NEWERA_MANE);
  return new Float32Array(out);
}

/** AN ATOMIC BOMB'S MODEL, about 3.3 m long: its round body, its tail cone and the box of fins round it; +z its nose.
 *  Pure. */
export function bombMesh() {
  const out = [];
  blob(out, [0, 0, 0.35], [0.76, 0.76, 1.15], NEWERA_BOMB, 8, 14);
  tube(out, [0, 0, -0.6], [0, 0, -1.2], 0.5, 0.25, NEWERA_BOMB);
  for (const [x, y, wide, tall] of [
    [0, 0.62, 1.3, 0.06],
    [0, -0.62, 1.3, 0.06],
    [0.62, 0, 0.06, 1.3],
    [-0.62, 0, 0.06, 1.3],
  ])
    box(out, [x, y, -1.25], [wide, tall, 0.7], NEWERA_BOMB);
  return new Float32Array(out);
}

/** The shock's dome: a unit half-sphere, `rings` up from the ground, `segs` round. Triangles, xyz a vertex. Pure. */
export function domeMesh(rings = 8, segs = 24) {
  const out = [];
  const spot = (ringIndex, segIndex) => {
    const lat = (ringIndex / rings) * (Math.PI / 2),
      lon = (segIndex / segs) * 2 * Math.PI;
    return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
  };
  for (let ringIndex = 0; ringIndex < rings; ringIndex++)
    for (let segIndex = 0; segIndex < segs; segIndex++) {
      const p00 = spot(ringIndex, segIndex),
        p01 = spot(ringIndex, segIndex + 1),
        p10 = spot(ringIndex + 1, segIndex),
        p11 = spot(ringIndex + 1, segIndex + 1);
      out.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
    }
  return new Float32Array(out);
}

/** A model's matrix (column major): its x axis along `left`, y along `up`, z along `forward`, scaled, at `pos`. Pure. */
export function newEraModel(pos, left, up, forward, scale) {
  return new Float32Array([
    left[0] * scale,
    left[1] * scale,
    left[2] * scale,
    0,
    up[0] * scale,
    up[1] * scale,
    up[2] * scale,
    0,
    forward[0] * scale,
    forward[1] * scale,
    forward[2] * scale,
    0,
    pos[0],
    pos[1],
    pos[2],
    1,
  ]);
}

/** The frame of a thing flying along `dir`: a left and an up square to it, the up as near the sky's as it can be. */
export function newEraFrameOf(dir) {
  const forward = unit(dir);
  const left = unit(crossOf(Math.abs(forward[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0], forward));
  return { forward, left, up: crossOf(forward, left) };
}

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const NO_HAZE = new Float32Array(8);
const GREY = new Float32Array([0.5, 0.5, 0.5]);
const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
const FULL = new Float32Array([-1, -1, 3, -1, -1, 3]);
const uniforms = (gl, program, names) =>
  Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));

/** The New Era's pass. */
export class NewEraPassRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [sky, mesh, ground, dome, puff] = NEWERA_PROGRAMS;
    this.sky = buildProgram(gl, sky[0], sky[1], 'newEraSky');
    this.uSky = uniforms(gl, this.sky, ['uView', 'uInvP', 'uBurn', 'uCrack', 'uFrom', 'uOffset', 'uGlowDir', 'uGlow']);
    this.mesh = buildProgram(gl, mesh[0], mesh[1], 'newEraMesh');
    this.uMesh = uniforms(gl, this.mesh, ['uVP', 'uModel', 'uLightDir', 'uAmbient', 'uSun', 'uTime', ...FOG_UNIFORMS]);
    this.ground = buildProgram(gl, ground[0], ground[1], 'newEraGround');
    this.uGround = uniforms(gl, this.ground, [
      'uVP',
      'uAnchor',
      'uOrigin',
      'uCrack',
      'uReach',
      'uCell',
      'uLight',
      ...FOG_UNIFORMS,
    ]);
    this.dome = buildProgram(gl, dome[0], dome[1], 'newEraDome');
    this.uDome = uniforms(gl, this.dome, ['uVP', 'uEye', 'uTime']);
    this.puff = buildProgram(gl, puff[0], puff[1], 'newEraPuffs');
    this.uPuff = uniforms(gl, this.puff, ['uVP', 'uRight', 'uUp', 'uLight', 'uTime', ...FOG_UNIFORMS]);
    this.buffers = [];
    this.vaos = [];
    const buf = (data, usage) => {
      const made = gl.createBuffer();
      this.buffers.push(made);
      gl.bindBuffer(gl.ARRAY_BUFFER, made);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      return made;
    };
    const vao = () => {
      const made = gl.createVertexArray();
      this.vaos.push(made);
      gl.bindVertexArray(made);
      return made;
    };
    /** @param {number} loc @param {number} size @param {number} stride @param {number} off @param {boolean} inst */
    const attr = (loc, size, stride, off, inst) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
      if (inst) gl.vertexAttribDivisor(loc, 1);
    };
    const meshVao = (data) => {
      const made = vao();
      buf(data, gl.STATIC_DRAW);
      const stride = NEWERA_MESH_STRIDE * 4;
      attr(0, 3, stride, 0, false);
      attr(1, 3, stride, 12, false);
      attr(2, 3, stride, 24, false);
      attr(3, 2, stride, 36, false);
      return { vao: made, count: data.length / NEWERA_MESH_STRIDE };
    };
    this.fullVao = vao();
    buf(FULL, gl.STATIC_DRAW);
    attr(0, 2, 8, 0, false);
    this.plane = meshVao(gunshipMesh());
    this.bomb = meshVao(bombMesh());
    this.groundVao = vao();
    this.groundBuf = buf(new Float32Array(9), gl.DYNAMIC_DRAW);
    attr(0, 3, 12, 0, false);
    this.groundN = 0;
    const domeData = domeMesh();
    this.domeCount = domeData.length / 3;
    this.domeVao = vao();
    buf(domeData, gl.STATIC_DRAW);
    attr(0, 3, 12, 0, false);
    this.domeInst = buf(new Float32Array(8), gl.DYNAMIC_DRAW);
    attr(1, 4, 32, 0, true);
    attr(2, 4, 32, 16, true);
    this.puffVao = vao();
    buf(QUAD, gl.STATIC_DRAW);
    attr(0, 2, 8, 0, false);
    this.puffInst = buf(new Float32Array(8), gl.DYNAMIC_DRAW);
    attr(1, 4, 32, 0, true);
    attr(2, 4, 32, 16, true);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** what the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  /** The grid the ground's cracks are cut from: triangles, xyz a vertex, in the scene (the host lays it). */
  setGround(positions) {
    const gl = this.gl,
      data = positions instanceof Float32Array && positions.length >= 9 ? positions : new Float32Array(9);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.groundBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    this.groundN = positions instanceof Float32Array ? Math.floor(positions.length / 3) : 0;
  }

  _fog(loc, fog, eye) {
    const gl = this.gl;
    gl.uniform1i(loc.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(loc.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(loc.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(loc.uCamPos, fog?.camPos ?? eye);
    gl.uniform3fv(loc.uFogColor, fog?.color ?? GREY);
    if (loc.uFocus) gl.uniform4fv(loc.uFocus, fog?.focus ?? NO_FOCUS);
    if (loc.uJungleHaze) gl.uniform4fv(loc.uJungleHaze, fog?.haze ?? NO_HAZE);
  }

  /**
   * Draw the frame's New Era: `show` `{ burn, glows: [{ dir, k }], sky: { crack, from, offset }, ground: { crack,
   * anchor, origin, reach, cell }, plane: model | null, bombs: [model], domes: [{ at, radius, alpha }], puffs: [{ at,
   * size, heat, alpha, seed }] }` (the host's, off world/newEraEvent.js), at `seconds` on its own clock, under `light`
   * `{ dir, ambient, sun }` and `fog` (the renderer's). Answers how many draws it made; nothing to draw, nothing touched.
   */
  draw(show, proj, view, eye, seconds, light = null, fog = null) {
    this.drawn = 0;
    const burn = Math.max(0, Math.min(1, show?.burn ?? 0));
    const glows = (show?.glows ?? []).filter((glow) => glow?.k > 0.001).slice(0, NEWERA_GLOWS_MAX);
    const skyCrack = Math.max(0, Math.min(1, show?.sky?.crack ?? 0));
    const groundCrack = Math.max(0, Math.min(1, show?.ground?.crack ?? 0));
    const bombs = show?.bombs ?? [];
    const domes = (show?.domes ?? []).filter((dome) => dome?.alpha > 0.001 && dome.radius > 0);
    const puffs = (show?.puffs ?? []).filter(
      (puff) => puff?.at?.every?.(Number.isFinite) && puff.size > 0 && puff.alpha > 0.001,
    );
    const skyOn = burn > 0.001 || glows.length > 0 || skyCrack > 0.001;
    const groundOn = groundCrack > 0.001 && this.groundN > 0;
    if (!skyOn && !show?.plane && !bombs.length && !groundOn && !domes.length && !puffs.length) return 0;
    const gl = this.gl;
    const time = ((seconds % 600) + 600) % 600;
    multiply(proj, view, this._vp);
    const lum = light?.ambient
      ? Math.max(0.35, (light.ambient[0] + light.ambient[1] + light.ambient[2]) / 3 + 0.6 * (light.sun ?? 0))
      : 1;
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    if (skyOn) {
      const loc = this.uSky;
      gl.useProgram(this.sky);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.uniformMatrix4fv(loc.uView, false, view);
      gl.uniform2f(loc.uInvP, 1 / proj[0], 1 / proj[5]);
      gl.uniform1f(loc.uBurn, burn);
      gl.uniform1f(loc.uCrack, skyCrack);
      const from = new Float32Array(NEWERA_SKY_CRACKS * 3);
      (show?.sky?.from ?? []).slice(0, NEWERA_SKY_CRACKS).forEach((way, i) => from.set(way, i * 3));
      gl.uniform3fv(loc.uFrom, from);
      gl.uniform3fv(loc.uOffset, show?.sky?.offset ?? [0, 0, 0]);
      const dirs = new Float32Array(NEWERA_GLOWS_MAX * 3),
        strengths = new Float32Array(NEWERA_GLOWS_MAX);
      glows.forEach((glow, i) => {
        dirs.set(glow.dir, i * 3);
        strengths[i] = glow.k;
      });
      gl.uniform3fv(loc.uGlowDir, dirs);
      gl.uniform1fv(loc.uGlow, strengths);
      gl.bindVertexArray(this.fullVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.drawn++;
      gl.disable(gl.BLEND);
      gl.depthFunc(gl.LESS);
    }
    gl.depthMask(true);
    if (show?.plane || bombs.length) {
      const loc = this.uMesh;
      gl.useProgram(this.mesh);
      gl.uniformMatrix4fv(loc.uVP, false, this._vp);
      gl.uniform3fv(loc.uLightDir, light?.dir ?? [0, 1, 0]);
      gl.uniform3fv(loc.uAmbient, light?.ambient ?? GREY);
      gl.uniform1f(loc.uSun, light?.sun ?? 0.5);
      gl.uniform1f(loc.uTime, time);
      this._fog(loc, fog, eye);
      for (const [model, kind] of [
        ...(show?.plane ? [[show.plane, this.plane]] : []),
        ...bombs.map((one) => [one, this.bomb]),
      ]) {
        gl.uniformMatrix4fv(loc.uModel, false, model);
        gl.bindVertexArray(kind.vao);
        gl.drawArrays(gl.TRIANGLES, 0, kind.count);
        this.drawn++;
      }
    }
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    if (groundOn) {
      const loc = this.uGround,
        layer = show.ground;
      gl.useProgram(this.ground);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -4);
      gl.depthFunc(gl.LEQUAL);
      gl.uniformMatrix4fv(loc.uVP, false, this._vp);
      gl.uniform2fv(loc.uAnchor, layer.anchor ?? [0, 0]);
      gl.uniform2fv(loc.uOrigin, layer.origin ?? [0, 0]);
      gl.uniform1f(loc.uCrack, groundCrack);
      gl.uniform1f(loc.uReach, layer.reach ?? 150);
      gl.uniform1f(loc.uCell, layer.cell ?? 12);
      gl.uniform1f(loc.uLight, lum);
      this._fog(loc, fog, eye);
      gl.bindVertexArray(this.groundVao);
      gl.drawArrays(gl.TRIANGLES, 0, this.groundN);
      this.drawn++;
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthFunc(gl.LESS);
    }
    if (domes.length) {
      const loc = this.uDome,
        data = new Float32Array(domes.length * 8);
      domes.forEach((dome, i) =>
        data.set([dome.at[0], dome.at[1], dome.at[2], dome.radius, dome.alpha, 0, 0, 0], i * 8),
      );
      gl.useProgram(this.dome);
      gl.uniformMatrix4fv(loc.uVP, false, this._vp);
      gl.uniform3fv(loc.uEye, eye);
      gl.uniform1f(loc.uTime, time);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.domeInst);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(this.domeVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, this.domeCount, domes.length);
      this.drawn++;
    }
    if (puffs.length) {
      const loc = this.uPuff;
      const far = (puff) => (puff.at[0] - eye[0]) ** 2 + (puff.at[1] - eye[1]) ** 2 + (puff.at[2] - eye[2]) ** 2;
      const sorted = puffs.map((puff) => ({ puff, away: far(puff) })).sort((one, two) => two.away - one.away);
      const data = new Float32Array(sorted.length * 8);
      sorted.forEach(({ puff }, i) =>
        data.set(
          [puff.at[0], puff.at[1], puff.at[2], puff.size, puff.heat, puff.alpha, puff.seed ?? (i * 0.618034) % 1, 0],
          i * 8,
        ),
      );
      gl.useProgram(this.puff);
      gl.uniformMatrix4fv(loc.uVP, false, this._vp);
      gl.uniform3f(loc.uRight, view[0], view[4], view[8]);
      gl.uniform3f(loc.uUp, view[1], view[5], view[9]);
      gl.uniform1f(loc.uLight, lum);
      gl.uniform1f(loc.uTime, time);
      this._fog(loc, fog, eye);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.puffInst);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(this.puffVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, sorted.length);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    return this.drawn;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the five programs, their buffers and their arrays. */
  dispose() {
    const gl = this.gl;
    for (const program of [this.sky, this.mesh, this.ground, this.dome, this.puff]) gl.deleteProgram(program);
    for (const made of this.buffers) gl.deleteBuffer(made);
    for (const made of this.vaos) gl.deleteVertexArray(made);
    this.buffers = [];
    this.vaos = [];
  }
}
