// @ts-check
// ROCKET1 (2026-10-23): THE ROCKET, DRAWN - the mounds rising out of the earth, the poop they shoot into the sky, the
// horses farting across it and their clouds, and the frenzy's brown sky and falling poop (world/rocketEvent.js says
// what each is, and when). One foreign pass after the world's, as the Starfall's (render/starfall/starfallPass.js):
//
//   the frenzy's sky  - one triangle at the far plane (LEQUAL passes only the cleared depth: the land stands over it),
//                       blended over whatever sky the lane drew by the frenzy's weight - the sun baby's law
//                       (render/sunbabySkyRenderer.js), drawn after the land rather than before it
//   the mounds        - instanced half-ellipsoids on the ground, lit by the frame's own light, fogged, depth written
//   the poop          - instanced billboards cut out of a drawn swirl, depth written: a mound's fountain (each chunk's
//                       flight worked out in the shader from the clock - nothing is simulated) and the frenzy's fall
//   the horses        - instanced billboards cut out of a drawn galloping horse, facing the way they go on the screen
//   the farts' clouds - instanced soft billboards, blended, no depth written
//   the frenzy's wash - a breath of its brown over the whole picture
//
// The shader carries no colour of its own: every colour is generated from world/rocketEvent.js's tables, so the JS
// and the GLSL cannot drift. Not a DFU member. Ledger A (ROCKET).
import { buildProgram } from './glProgram.js';   // AUDIT 68 S17-gl-program-dup: the one compile and link
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { multiply } from '../world/mat4.js';
import {
  ROCKET_POOP, ROCKET_POOP_DARK, ROCKET_POOP_SHINE, ROCKET_MOUND, ROCKET_MOUND_TOP, ROCKET_GAS, ROCKET_GAS_EDGE,
  ROCKET_FRENZY_ZENITH, ROCKET_FRENZY_HORIZON, ROCKET_FRENZY_SWIRL, ROCKET_WASH, ROCKET_COATS, ROCKET_MANES,
  ROCKET_RAIN_SPAN_M, ROCKET_RAIN_TOP_M, ROCKET_HORSE_GIRTH, ROCKET_HORSE_LEGS,
} from '../world/rocketEvent.js';

const f = (v) => v.toFixed(4);
const v3 = (c) => `vec3(${c.map(f).join(', ')})`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;   // the int too: `uMode` is both stages' (a fragment shader's int is mediump by default - they would not link)
const FOG = `uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
`;
const HASH = 'float rh(float n) { return fract(sin(n) * 43758.5453); }\n';
const FOG_UNIFORMS = ['uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze', 'uFogColor'];

// ── The frenzy's sky, and its wash ────────────────────────────────
/** One triangle at the far plane; the ray rebuilt from the view's rotation and the projection's two scales. */
export const ROCKET_SKY_VS = HEAD + `layout(location = 0) in vec2 aP;
out vec2 vNdc;
void main() { vNdc = aP; gl_Position = vec4(aP, 1.0, 1.0); }`;
export const ROCKET_SKY_FS = HEAD + `in vec2 vNdc;
uniform mat4 uView;
uniform vec2 uInvP;     // 1 / proj[0], 1 / proj[5]
uniform float uWeight;  // the frenzy's weight, 0..1
uniform float uTime;
uniform int uMode;      // 0 the sky, 1 the wash
out vec4 o;
${HASH}float vn(vec2 p) {
  vec2 i = floor(p), q = fract(p);
  q = q * q * (3.0 - 2.0 * q);
  float a = rh(dot(i, vec2(1.0, 57.0))), b = rh(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
  float c = rh(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0))), d = rh(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, q.x), mix(c, d, q.x), q.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
void main() {
  if (uMode == 1) {
    // the wash: the frenzy's brown over the picture, thicker at its edges, dripping from its top
    vec2 q = vNdc;
    float edge = smoothstep(0.55, 1.35, length(q * vec2(0.8, 1.0)));
    float drip = smoothstep(0.0, 0.25, q.y - 0.72 + 0.22 * pow(vn(vec2(q.x * 9.0, 0.0)), 3.0) * (1.0 + 0.4 * sin(uTime * 0.6 + q.x * 5.0)));
    o = vec4(${v3(ROCKET_FRENZY_ZENITH)}, clamp(uWeight * (${f(ROCKET_WASH)} + 0.35 * edge + 0.5 * drip), 0.0, 0.85));
    return;
  }
  vec3 dir = normalize(transpose(mat3(uView)) * vec3(vNdc.x * uInvP.x, vNdc.y * uInvP.y, -1.0));
  float e = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(${v3(ROCKET_FRENZY_HORIZON)}, ${v3(ROCKET_FRENZY_ZENITH)}, pow(e, 0.55));
  // the churn: brown clouds on a ceiling over the land, swirling as they boil
  vec2 p = dir.xz / (max(dir.y, 0.0) + 0.18) * 1.6;
  float a = uTime * 0.07;
  p = mat2(cos(a), sin(a), -sin(a), cos(a)) * p + vec2(uTime * 0.09, uTime * -0.05);
  float n = fbm(p + 1.7 * fbm(p * 0.6 - uTime * 0.04));
  float up = smoothstep(-0.02, 0.12, dir.y);
  col = mix(col, ${v3(ROCKET_FRENZY_SWIRL)} * (0.7 + 0.6 * n), up * smoothstep(0.35, 0.75, n));
  col = mix(col, ${v3(ROCKET_POOP_DARK)}, up * 0.6 * smoothstep(0.62, 0.9, n));
  o = vec4(col, clamp(uWeight, 0.0, 1.0) * 0.94);
}`;

// ── The mounds ────────────────────────────────────────────────────
/** A mound: the unit half-ellipsoid `aP` (x, z on the unit disk, y its height - a skirt below 0 meets a slope), each
 *  one's `aA` (x, the ground, z, radius) and `aB` (height, seed, its surges' rate, -). */
export const ROCKET_MOUND_VS = HEAD + `layout(location = 0) in vec3 aP;
layout(location = 1) in vec4 aA;
layout(location = 2) in vec4 aB;
uniform mat4 uVP;
uniform float uRise;
uniform float uJet;
uniform float uTime;
out vec3 vWorld;
out vec3 vN;
out vec3 vLocal;
out float vSeed;
void main() {
  float r = aA.w, h = aB.x;
  float swell = 1.0 + 0.07 * uJet * (0.5 + 0.5 * sin(uTime * aB.z * 6.2832 + aB.y * 40.0));
  vec3 p = vec3(aP.x * r * swell, aP.y * h * swell - (1.0 - uRise) * (h + 0.4), aP.z * r * swell);
  vWorld = vec3(aA.x, aA.y, aA.z) + p;
  vN = normalize(vec3(aP.x / r, max(aP.y, 0.0) / h, aP.z / r));
  vLocal = aP;
  vSeed = aB.y;
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
export const ROCKET_MOUND_FS = HEAD + `in vec3 vWorld;
in vec3 vN;
in vec3 vLocal;
in float vSeed;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSun;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}${HASH}
void main() {
  float a = atan(vLocal.z, vLocal.x);
  float y = vLocal.y + 0.06 * sin(a * 7.0 + vSeed * 30.0);
  vec3 col = mix(${v3(ROCKET_MOUND)}, ${v3(ROCKET_MOUND_TOP)}, smoothstep(0.5, 0.8, y));
  col = mix(col, ${v3(ROCKET_POOP_DARK)}, smoothstep(0.86, 0.97, vLocal.y));   // the vent it shoots from
  col *= 0.85 + 0.3 * rh(floor(a * 9.0) + floor(y * 8.0) * 13.0 + vSeed);       // clods
  vec3 n = normalize(vN);
  vec3 lit = uAmbient + uSun * max(dot(n, uLightDir), 0.0);
  o = vec4(mix(uFogColor, col * lit, fogFactorAt(vWorld)), 1.0);
}`;

// ── The poop and the farts' clouds ────────────────────────────────
/** A billboard, by `uMode`: 0 a mound's chunk (`aA` the mound: x, the ground, z, its jet's height; `aB` its seed plus the
 *  chunk's index, a chunk's flight, its surges' rate, the mound's height), 1 the frenzy's falling chunk (`aA` its place
 *  in the square, its seed, its speed), 2 a fart's cloud (`aA` its place and size, `aB` its fade and seed). */
export const ROCKET_SPRITE_VS = HEAD + `layout(location = 0) in vec2 aQ;
layout(location = 1) in vec4 aA;
layout(location = 2) in vec4 aB;
uniform mat4 uVP;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uEye;
uniform int uMode;
uniform float uTime;
uniform float uJet;     // the jets' strength (world/rocketEvent.js rocketJetScale)
uniform float uRise;
uniform float uFrenzy;
out vec2 vUv;
out vec3 vWorld;
out float vSeed;
out float vFade;
${HASH}void main() {
  vec3 c;
  float size, spin = 0.0;
  vFade = 1.0;
  if (uMode == 0) {
    float idx = floor(aB.x), s0 = fract(aB.x);
    float str = uJet * uRise * (0.62 + 0.38 * sin(uTime * aB.z * 6.2832 + s0 * 40.0));
    float s = fract(uTime / (aB.y * (0.85 + 0.3 * rh(idx + 0.5))) + rh(s0 * 91.7 + idx * 3.1));
    float H = aA.w * str * (0.55 + 0.45 * rh(idx * 7.7 + s0));
    float th = 6.2832 * rh(idx * 1.37 + s0 * 13.1), L = (0.15 + 0.3 * rh(idx * 5.3 + s0)) * H;
    c = vec3(aA.x + cos(th) * L * s, aA.y + aB.w * 0.85 + H * 4.0 * s * (1.0 - s), aA.z + sin(th) * L * s);
    size = (0.55 + 0.5 * rh(idx * 2.9 + s0 * 7.0)) * (1.0 + 0.5 * uFrenzy) * smoothstep(0.02, 0.2, str);
    spin = 0.5 * sin(uTime * (1.5 + 2.0 * rh(idx + s0)) + idx);   // a wobble as it flies - a swirl tumbling end over end reads as a chip
    vSeed = rh(idx * 0.77 + s0);
  } else if (uMode == 1) {
    float span = ${f(ROCKET_RAIN_SPAN_M)}, top = ${f(ROCKET_RAIN_TOP_M)};
    c = vec3(uEye.x + (fract(aA.x - uEye.x / span) - 0.5) * span,
             uEye.y + top - mod(uTime * aA.w + aA.z * 97.0, top + 20.0),
             uEye.z + (fract(aA.y - uEye.z / span) - 0.5) * span);
    size = aA.z < uFrenzy ? 0.6 + 0.5 * rh(aA.z * 31.0) : 0.0;   // as many falling as the frenzy is whole
    spin = 0.6 * sin(uTime * (1.0 + 2.0 * rh(aA.z * 7.0)) + aA.z * 50.0);
    vSeed = aA.z;
  } else {
    c = aA.xyz;
    size = aA.w;
    vFade = aB.x;
    vSeed = aB.y;
  }
  vec2 q = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * aQ;
  vUv = aQ;
  vec3 w = c + (uRight * q.x + uUp * q.y) * size;
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const ROCKET_SPRITE_FS = HEAD + `in vec2 vUv;
in vec3 vWorld;
in float vSeed;
in float vFade;
uniform int uMode;
uniform float uLight;
uniform float uTime;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}${HASH}
float ell(vec2 p, vec2 c, vec2 r) { return (length((p - c) / r) - 1.0) * min(r.x, r.y); }
void main() {
  vec2 p = vUv;
  if (uMode == 2) {
    // a fart's cloud: four lumps, boiling, greener at its heart
    float cover = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2(rh(vSeed * 13.0 + fi) - 0.5, rh(vSeed * 29.0 + fi * 3.0) - 0.5) * 0.8;
      float r = 0.42 + 0.18 * rh(vSeed * 7.0 + fi) + 0.04 * sin(uTime * 2.0 + fi * 2.1 + vSeed * 9.0);
      cover = max(cover, 1.0 - smoothstep(r * 0.55, r, length(p - c)));
    }
    if (cover <= 0.01) discard;
    vec3 col = mix(${v3(ROCKET_GAS_EDGE)}, ${v3(ROCKET_GAS)}, cover) * clamp(uLight, 0.45, 1.25);
    o = vec4(mix(uFogColor, col, max(fogFactorAt(vWorld), 0.7)), cover * vFade * 0.78);
    return;
  }
  // a chunk of poop: three tiers of a swirl and its curled tip, outlined, its folds dark and its tops shining
  p.y += 0.12;
  float t0 = ell(p, vec2(0.0, -0.55), vec2(0.86, 0.32));
  float t1 = ell(p, vec2(0.02, -0.14), vec2(0.64, 0.27));
  float t2 = ell(p, vec2(0.03, 0.22), vec2(0.42, 0.22));
  float tip = length(p - vec2(0.10 + 0.04 * sin(p.y * 9.0), 0.50)) - 0.13;
  float d = min(min(t0, t1), min(t2, tip));
  if (d > 0.0) discard;
  // which tier: its own height inside it shades its fold and its shine
  float ty = t2 < 0.0 || tip < 0.0 ? (p.y - 0.22) / 0.22 : t1 < 0.0 ? (p.y + 0.14) / 0.27 : (p.y + 0.55) / 0.32;
  vec3 col = mix(${v3(ROCKET_POOP_DARK)}, ${v3(ROCKET_POOP)}, smoothstep(-0.9, -0.1, ty));
  col = mix(col, ${v3(ROCKET_POOP_SHINE)}, 0.7 * (1.0 - smoothstep(0.0, 0.22, length(vec2(p.x + 0.22, ty * 0.25 - 0.12)))));
  col *= 0.9 + 0.2 * vSeed;
  col = mix(col, ${v3(ROCKET_POOP_DARK)} * 0.6, smoothstep(-0.07, -0.02, d));   // its outline
  o = vec4(mix(uFogColor, col * clamp(uLight, 0.35, 1.3), fogFactorAt(vWorld)), 1.0);
}`;

// ── The horses ────────────────────────────────────────────────────
/** A horse: `aA` its place and length, `aB` the way it goes and its gallop's phase, `aC` its coat. The billboard stands
 *  upright to the eye, its nose the way it goes on the screen. */
export const ROCKET_HORSE_VS = HEAD + `layout(location = 0) in vec2 aQ;
layout(location = 1) in vec4 aA;
layout(location = 2) in vec4 aB;
layout(location = 3) in float aC;
uniform mat4 uVP;
uniform vec3 uEye;
out vec2 vP;
out vec3 vWorld;
out float vGallop;
flat out int vCoat;
void main() {
  vec3 toEye = normalize(uEye - aA.xyz);
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toEye));
  vec3 up = normalize(cross(toEye, side));
  float facing = dot(aB.xyz, side) < 0.0 ? -1.0 : 1.0;
  float half_ = aA.w * 0.5;
  vP = vec2(aQ.x * 1.15, aQ.y * 1.0 + 0.1);
  vec3 w = aA.xyz + side * (vP.x * facing * half_) + up * (vP.y * half_);
  vWorld = w;
  vGallop = aB.w;
  vCoat = int(aC + 0.5);
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const ROCKET_HORSE_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
in float vGallop;
flat in int vCoat;
uniform vec3 uCoat[${ROCKET_COATS.length}];
uniform vec3 uMane[${ROCKET_MANES.length}];
uniform float uLight;
${FOG}out vec4 o;
${FOG_FACTOR_GLSL}
float seg(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float ell(vec2 p, vec2 c, vec2 r) { return (length((p - c) / r) - 1.0) * min(r.x, r.y); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// one leg from its joint: the upper swung by a1 (from straight down, + toward the nose), the lower by a2, each l long;
// its hoof
float leg(vec2 p, vec2 j, float a1, float a2, float l, out float hoof) {
  vec2 k = j + l * vec2(sin(a1), -cos(a1));
  vec2 h = k + l * vec2(sin(a2), -cos(a2));
  hoof = seg(p, h, h + 0.05 * vec2(sin(a2), -cos(a2)), 0.05);
  return min(seg(p, j, k, 0.062), seg(p, k, h, 0.05));
}
void main() {
  vec2 p = vP;
  float g = vGallop * 6.2832;
  // THE FATASS HORSE (the owner, 2026-10-23: "have it make all the horses go into fatass rendering mode"): a barrel
  // ${f(ROCKET_HORSE_GIRTH)} times a horse's depth, its belly jiggling with the gallop, on stubby legs
  float G = ${f(ROCKET_HORSE_GIRTH)}, jig = 1.0 + 0.06 * sin(g * 2.0);
  float d = smin(smin(ell(p, vec2(0.0, 0.04), vec2(0.58, 0.22 * G * jig)), ell(p, vec2(0.37, 0.07), vec2(0.24, 0.21 * G)), 0.1), ell(p, vec2(-0.38, 0.08), vec2(0.26, 0.22 * G)), 0.1);
  d = smin(d, seg(p, vec2(0.42, 0.26), vec2(0.64, 0.58), 0.11), 0.07);   // the neck
  d = smin(d, seg(p, vec2(0.62, 0.62), vec2(0.86, 0.48), 0.075), 0.04);  // the head
  d = smin(d, ell(p, vec2(0.86, 0.475), vec2(0.075, 0.068)), 0.02);      // the muzzle
  d = min(d, seg(p, vec2(0.62, 0.68), vec2(0.59, 0.80), 0.028));          // the ear
  // the gallop, paddling: forelegs reaching and folding, hind legs driving, under the belly
  float hoof = 1e3, hf, L = 0.21 * ${f(ROCKET_HORSE_LEGS)}, under = 0.04 - 0.22 * G * 0.72;
  for (int i = 0; i < 2; i++) {
    float o2 = float(i) * 0.9;
    float sf = sin(g + o2), sh = sin(g + o2 + 3.1416);
    d = min(d, leg(p, vec2(0.33 - 0.07 * float(i), under), 0.25 + 0.6 * sf, 0.25 + 0.6 * sf - 1.1 * max(0.0, sin(g + o2 + 1.2)), L, hf)); hoof = min(hoof, hf);
    d = min(d, leg(p, vec2(-0.40 + 0.07 * float(i), under), -0.15 + 0.55 * sh, -0.15 + 0.55 * sh + 0.8 * max(0.0, sin(g + o2 + 4.3)), L, hf)); hoof = min(hoof, hf);
  }
  // the tail and the mane, flowing back
  float w1 = 0.05 * sin(g * 0.5), w2 = 0.08 * sin(g * 0.5 + 1.0);
  float hair = min(min(seg(p, vec2(-0.60, 0.26), vec2(-0.78, 0.22 + w1), 0.06), seg(p, vec2(-0.78, 0.22 + w1), vec2(-0.93, 0.11 + w2), 0.05)), seg(p, vec2(-0.93, 0.11 + w2), vec2(-1.03, -0.03 + w2 * 1.5), 0.04));
  hair = min(hair, seg(p, vec2(0.39, 0.37), vec2(0.60, 0.70), 0.045 + 0.012 * sin(p.y * 70.0)));
  float all_ = min(min(d, hoof), hair);
  if (all_ > 0.0) discard;
  vec3 coat = uCoat[vCoat], mane = uMane[vCoat];
  vec3 col = coat * (0.8 + 0.28 * smoothstep(-0.25, 0.3, p.y));   // the belly in its own shadow
  col = hair < 0.0 ? mane : hoof < 0.0 ? vec3(0.09, 0.07, 0.06) : col;
  col = mix(col, vec3(0.04), 1.0 - smoothstep(0.016, 0.026, length(p - vec2(0.71, 0.60))));   // the eye
  col = mix(col, vec3(1.0), 1.0 - smoothstep(0.004, 0.009, length(p - vec2(0.718, 0.607))));
  col = mix(col, vec3(0.05), 1.0 - smoothstep(0.008, 0.014, length(p - vec2(0.905, 0.505))));   // the nostril
  col = mix(col, coat * 0.25, smoothstep(-0.03, -0.012, all_));   // the outline
  o = vec4(mix(uFogColor, col * clamp(uLight, 0.45, 1.25), max(fogFactorAt(vWorld), 0.8)), 1.0);   // a sky thing: fogged, never under a floor of it (the star's law)
}`;

/** FIRST-USE (#1144): the pass's programs, as its constructor builds them. */
export const ROCKET_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([
  [ROCKET_SKY_VS, ROCKET_SKY_FS], [ROCKET_MOUND_VS, ROCKET_MOUND_FS], [ROCKET_SPRITE_VS, ROCKET_SPRITE_FS], [ROCKET_HORSE_VS, ROCKET_HORSE_FS],
]));

/** The mound's half-ellipsoid: `rings` rings from the skirt (y -0.6, a touch wider) up over the crown, `segs` round -
 *  triangles, xyz a vertex. */
export function moundMesh(rings = 7, segs = 16) {
  const ring = (i) => (i === 0 ? { r: 1.04, y: -0.6 } : { r: Math.cos(((i - 1) / (rings - 1)) * Math.PI / 2), y: Math.sin(((i - 1) / (rings - 1)) * Math.PI / 2) });
  const out = [];
  for (let i = 0; i < rings; i++) {
    const a = ring(i), b = ring(i + 1);
    for (let s = 0; s < segs; s++) {
      const t0 = (s / segs) * 2 * Math.PI, t1 = ((s + 1) / segs) * 2 * Math.PI;
      const P = (q, t) => [q.r * Math.cos(t), q.y, q.r * Math.sin(t)];
      out.push(...P(a, t0), ...P(b, t0), ...P(b, t1), ...P(a, t0), ...P(b, t1), ...P(a, t1));
    }
  }
  return new Float32Array(out);
}

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const NO_HAZE = new Float32Array(8);
const GREY = new Float32Array([0.5, 0.5, 0.5]);
const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
const FULL = new Float32Array([-1, -1, 3, -1, -1, 3]);
const uniforms = (gl, p, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
const COATS = new Float32Array(ROCKET_COATS.flat());
const MANES = new Float32Array(ROCKET_MANES.flat());

/** The Rocket's pass. */
export class RocketPassRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [sky, mound, sprite, horse] = ROCKET_PROGRAMS;
    this.sky = buildProgram(gl, sky[0], sky[1], 'rocketSky');
    this.uk = uniforms(gl, this.sky, ['uView', 'uInvP', 'uWeight', 'uTime', 'uMode']);
    this.mound = buildProgram(gl, mound[0], mound[1], 'rocketMounds');
    this.um = uniforms(gl, this.mound, ['uVP', 'uRise', 'uJet', 'uTime', 'uLightDir', 'uAmbient', 'uSun', ...FOG_UNIFORMS]);
    this.sprite = buildProgram(gl, sprite[0], sprite[1], 'rocketPoop');
    this.us = uniforms(gl, this.sprite, ['uVP', 'uRight', 'uUp', 'uEye', 'uMode', 'uTime', 'uJet', 'uRise', 'uFrenzy', 'uLight', ...FOG_UNIFORMS]);
    this.horse = buildProgram(gl, horse[0], horse[1], 'rocketHorses');
    this.uh = uniforms(gl, this.horse, ['uVP', 'uEye', 'uCoat', 'uMane', 'uLight', ...FOG_UNIFORMS]);
    this.buffers = [];
    const buf = (data, usage) => { const b = gl.createBuffer(); this.buffers.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b; };
    this.vaos = [];
    const vao = () => { const v = gl.createVertexArray(); this.vaos.push(v); gl.bindVertexArray(v); return v; };
    /** @param {number} loc @param {number} size @param {number} stride @param {number} off @param {boolean} inst */
    const attr = (loc, size, stride, off, inst) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); if (inst) gl.vertexAttribDivisor(loc, 1); };
    this.fullVao = vao(); buf(FULL, gl.STATIC_DRAW); attr(0, 2, 8, 0, false);
    const mesh = moundMesh();
    this.moundCount = mesh.length / 3;
    this.moundVao = vao(); buf(mesh, gl.STATIC_DRAW); attr(0, 3, 12, 0, false);
    this.moundInst = buf(new Float32Array(8), gl.DYNAMIC_DRAW); attr(1, 4, 32, 0, true); attr(2, 4, 32, 16, true);
    const quad = buf(QUAD, gl.STATIC_DRAW);
    // the sprites' two instance streams - the jets' (rebuilt when the mounds change) and the falling poop's (built once)
    // - and the clouds' (every frame); the horses' their own
    this.jetVao = vao(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); attr(0, 2, 8, 0, false);
    this.jetInst = buf(new Float32Array(8), gl.DYNAMIC_DRAW); attr(1, 4, 32, 0, true); attr(2, 4, 32, 16, true);
    this.rainVao = vao(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); attr(0, 2, 8, 0, false);
    this.rainInst = buf(new Float32Array(8), gl.STATIC_DRAW); attr(1, 4, 32, 0, true); attr(2, 4, 32, 16, true);
    this.puffVao = vao(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); attr(0, 2, 8, 0, false);
    this.puffInst = buf(new Float32Array(8), gl.DYNAMIC_DRAW); attr(1, 4, 32, 0, true); attr(2, 4, 32, 16, true);
    this.horseVao = vao(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); attr(0, 2, 8, 0, false);
    this.horseInst = buf(new Float32Array(9), gl.DYNAMIC_DRAW); attr(1, 4, 36, 0, true); attr(2, 4, 36, 16, true); attr(3, 1, 36, 32, true);
    gl.bindVertexArray(null);
    this.moundN = 0;
    this.jetN = 0;
    this.rainN = 0;
    this._vp = new Float32Array(16);
    /** what the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  /** The mounds and their jets' chunks, from the host's list (`[{ x, y, z, r, h, jetH, flight, pulse, seed }]`, scene
   *  places) - asked again only when the list changes. */
  setMounds(mounds, chunks) {
    const gl = this.gl, list = Array.isArray(mounds) ? mounds : [];
    const m = new Float32Array(Math.max(1, list.length) * 8), j = new Float32Array(Math.max(1, list.length * chunks) * 8);
    list.forEach((d, i) => {
      const s0 = (d.seed % 9973) / 9973;
      m.set([d.x, d.y, d.z, d.r, d.h, s0, d.pulse, 0], i * 8);
      for (let c = 0; c < chunks; c++) j.set([d.x, d.y, d.z, d.jetH, c + s0, d.flight, d.pulse, d.h], (i * chunks + c) * 8);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.moundInst); gl.bufferData(gl.ARRAY_BUFFER, m, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.jetInst); gl.bufferData(gl.ARRAY_BUFFER, j, gl.DYNAMIC_DRAW);
    this.moundN = list.length;
    this.jetN = list.length * chunks;
  }

  /** The frenzy's falling chunks: `n` of them, each its place in the square, its seed and its speed (built once). */
  setRain(n, speed, rng = Math.random) {
    const gl = this.gl, a = new Float32Array(Math.max(1, n) * 8);
    for (let i = 0; i < n; i++) a.set([rng(), rng(), (i + 0.5) / n, speed[0] + (speed[1] - speed[0]) * rng(), 0, 0, 0, 0], i * 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rainInst); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
    this.rainN = n;
  }

  _fog(U, fog, eye) {
    const gl = this.gl;
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    gl.uniform3fv(U.uFogColor, fog?.color ?? GREY);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    if (U.uJungleHaze) gl.uniform4fv(U.uJungleHaze, fog?.haze ?? NO_HAZE);
  }

  /**
   * Draw the frame's Rocket: `s` `{ rise, jet, frenzy, horses: [{ at, forward, len, coat, gallop }], puffs: [{ at, size,
   * fade }] }` (world/rocketEvent.js rocketPhase and rocketSky; `jet` already rocketJetScale's), at `seconds` on its own
   * clock, under `light` `{ dir, ambient, sun }` and `fog` (the renderer's). Answers how many draws it made; nothing to
   * draw, nothing touched.
   */
  draw(s, proj, view, eye, seconds, light = null, fog = null) {
    this.drawn = 0;
    const rise = Math.max(0, Math.min(1, s?.rise ?? 0)), jet = Math.max(0, s?.jet ?? 0), frenzy = Math.max(0, Math.min(1, s?.frenzy ?? 0));
    const horses = (s?.horses ?? []).filter((h) => h?.at?.every?.(Number.isFinite) && h.len > 0);
    const puffs = (s?.puffs ?? []).filter((p) => p?.at?.every?.(Number.isFinite) && p.size > 0 && p.fade > 0.001);
    const mounds = rise > 0.001 && this.moundN > 0, jets = mounds && jet > 0.001 && this.jetN > 0, rain = frenzy > 0.001 && this.rainN > 0;
    if (!mounds && !rain && !frenzy && !horses.length && !puffs.length) return 0;
    const gl = this.gl;
    const time = ((seconds % 600) + 600) % 600;
    multiply(proj, view, this._vp);
    const lum = light?.ambient ? Math.max(0.35, (light.ambient[0] + light.ambient[1] + light.ambient[2]) / 3 + 0.6 * (light.sun ?? 0)) : 1;
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    if (frenzy > 0.001) {
      const U = this.uk;
      gl.useProgram(this.sky);
      gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.uniformMatrix4fv(U.uView, false, view);
      gl.uniform2f(U.uInvP, 1 / proj[0], 1 / proj[5]);
      gl.uniform1f(U.uWeight, frenzy); gl.uniform1f(U.uTime, time); gl.uniform1i(U.uMode, 0);
      gl.bindVertexArray(this.fullVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.drawn++;
      gl.disable(gl.BLEND);
      gl.depthFunc(gl.LESS);
    }
    gl.depthMask(true);
    if (mounds) {
      const U = this.um;
      gl.useProgram(this.mound);
      gl.uniformMatrix4fv(U.uVP, false, this._vp);
      gl.uniform1f(U.uRise, rise); gl.uniform1f(U.uJet, Math.min(1, jet)); gl.uniform1f(U.uTime, time);
      gl.uniform3fv(U.uLightDir, light?.dir ?? [0, 1, 0]);
      gl.uniform3fv(U.uAmbient, light?.ambient ?? GREY);
      gl.uniform1f(U.uSun, light?.sun ?? 0.5);
      this._fog(U, fog, eye);
      gl.bindVertexArray(this.moundVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, this.moundCount, this.moundN);
      this.drawn++;
    }
    if (jets || rain || puffs.length) {
      const U = this.us;
      gl.useProgram(this.sprite);
      gl.uniformMatrix4fv(U.uVP, false, this._vp);
      gl.uniform3f(U.uRight, view[0], view[4], view[8]);
      gl.uniform3f(U.uUp, view[1], view[5], view[9]);
      gl.uniform3fv(U.uEye, eye);
      gl.uniform1f(U.uTime, time); gl.uniform1f(U.uJet, jet); gl.uniform1f(U.uRise, rise); gl.uniform1f(U.uFrenzy, frenzy);
      gl.uniform1f(U.uLight, lum);
      this._fog(U, fog, eye);
      if (jets) { gl.uniform1i(U.uMode, 0); gl.bindVertexArray(this.jetVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.jetN); this.drawn++; }
      if (rain) { gl.uniform1i(U.uMode, 1); gl.bindVertexArray(this.rainVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.rainN); this.drawn++; }
    }
    if (horses.length) {
      const U = this.uh, a = new Float32Array(horses.length * 9);
      horses.forEach((h, i) => a.set([h.at[0], h.at[1], h.at[2], h.len, h.forward[0], h.forward[1], h.forward[2], h.gallop, h.coat | 0], i * 9));
      gl.useProgram(this.horse);
      gl.uniformMatrix4fv(U.uVP, false, this._vp);
      gl.uniform3fv(U.uEye, eye);
      gl.uniform3fv(U.uCoat, COATS); gl.uniform3fv(U.uMane, MANES);
      gl.uniform1f(U.uLight, lum);
      this._fog(U, fog, eye);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.horseInst); gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(this.horseVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, horses.length);
      this.drawn++;
    }
    if (puffs.length) {
      const U = this.us, a = new Float32Array(puffs.length * 8);
      puffs.forEach((p, i) => a.set([p.at[0], p.at[1], p.at[2], p.size, p.fade, (i * 0.618034) % 1, 0, 0], i * 8));
      gl.useProgram(this.sprite);   // the clouds are the sprites' third kind - the horses' program stood between
      gl.uniform1i(U.uMode, 2);
      gl.depthMask(false);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.puffInst); gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(this.puffVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, puffs.length);
      this.drawn++;
    }
    if (frenzy > 0.001) {
      const U = this.uk;
      gl.useProgram(this.sky);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.uniform1f(U.uWeight, frenzy); gl.uniform1f(U.uTime, time); gl.uniform1i(U.uMode, 1);
      gl.bindVertexArray(this.fullVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.drawn++;
      gl.enable(gl.DEPTH_TEST);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    return this.drawn;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the four programs, their buffers and their arrays. */
  dispose() {
    const gl = this.gl;
    for (const p of [this.sky, this.mound, this.sprite, this.horse]) gl.deleteProgram(p);
    for (const b of this.buffers) gl.deleteBuffer(b);
    for (const v of this.vaos) gl.deleteVertexArray(v);
    this.buffers = []; this.vaos = [];
  }
}
