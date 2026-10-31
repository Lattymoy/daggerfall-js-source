// @ts-check
// WET1 (bible/07-Rendering/Weather-Arc.md WET1): the wet world on the enhanced lane - the ground darkens and shines,
// puddles stand on the flat, drops ring them while it rains, and the sun and every lamp glint in them. Fed by
// systems/weather/wetness.js through one uniform; zero on every frame no host wets, so the classic look is untouched.
// The sky in the wet is the fog's colour (the horizon's), mixed in display space after the fog, as a mirror shows it.
import { glslFloat } from './airPass.js';
import { SNOW_TILE_M } from './snowCoverGlsl.js';

/** How dark a soaked surface's albedo goes (ground, then walls), and a puddle's on top of it. */
export const WET_DARK = 0.55;
export const WET_WALL_DARK = 0.8;
export const PUDDLE_DARK = 0.45;   // WET1b: darker glass under the glint (was 0.7 - read as matte stone)
/** A wall's gloss. Ground splits: soil almost matte, a road a dull sheen, a puddle a mirror (wetGlossGround). */
export const WET_SHEEN = 0.4;
export const WET_SHEEN_SOIL = 0.04;
export const WET_SHEEN_ROAD = 0.22;
/** How wide the puddle's edge is, in the noise's 0..1 - a hard step read as a drawn line. */
export const PUDDLE_EDGE = 0.22;
/** Puddles: the flat they need (n.y), their noise salt, and how far their face's threshold falls at a full fill. */
export const PUDDLE_FLAT = Object.freeze([0.96, 0.995]);
export const PUDDLE_SALT = 0x50554444;   // 'PUDD'
export const PUDDLE_SPREAD = 0.45;
/** Ripples: a drop cell's side (m), drops a second in a cell (times 1000 a whole number: the clock wraps there), the
 *  distance they fade out by (m), and the slope a ring puts on the face. */
export const RIPPLE_CELL_M = 0.5;
export const RIPPLE_RATE = 1;
export const RIPPLE_NEAR_M = 30;
export const RIPPLE_SLOPE = 0.55;   // WET1b: rings catch the lamps
/** The most of the sky a wet surface shows. */
export const WET_SKY_MAX = 0.9;

const f = glslFloat;

/** The shared half: uWet, the ripples, the albedo, the sun's glint and the sky. After the lantern loop (wetFresnel). */
export const RAIN_WET_GLSL = `
uniform vec4 uWet;   // WET1: x the ground's wetness, y the puddles' fill, z seconds (the ripples' clock), w the rain now
float wetHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
// one drop a cell, its centre inside the middle half so its ring never leaves the cell; a light rain drops in fewer cells
vec2 wetRipple(vec2 m) {
  vec2 q = m / ${f(RIPPLE_CELL_M)}, c = floor(q);
  float h = wetHash(c);
  if (h > uWet.w) return vec2(0.0);
  vec2 d = q - (c + 0.25 + 0.5 * vec2(wetHash(c + 17.0), wetHash(c + 31.0)));
  float r = length(d), age = fract(uWet.z * ${f(RIPPLE_RATE)} + h * 7.0);
  float x = (r - 0.25 * age) / 0.06;
  float ring = sin(x * 3.14159) * exp(-x * x) * (1.0 - age);
  return r > 1e-4 ? d / r * ring : vec2(0.0);
}
vec3 wetAlbedo(vec3 a, vec2 w, float dark) { return a * mix(1.0, dark, w.x) * mix(1.0, ${f(PUDDLE_DARK)}, w.y); }
// a wall takes half the rain a roof does, and stands no puddle
vec2 wetWall(vec3 n) { return vec2(uWet.x * mix(0.5, 1.0, max(n.y, 0.0)), 0.0); }
float wetGloss(vec2 w) { return max(w.x * ${f(WET_SHEEN)}, w.y); }
// soil stays matte, a road takes a dull sheen, a puddle takes the mirror - the edge fades with the puddle
float wetGlossGround(vec2 w, float road) {
  float sheen = mix(${f(WET_SHEEN_SOIL)}, ${f(WET_SHEEN_ROAD)}, road) * w.x;
  return mix(sheen, 1.0, w.y);
}
// a puddle's face is level, and rings where drops fall near the eye
vec3 wetNormal(vec3 n, vec2 w, vec2 m, float dist) {
  if (w.y <= 0.0) return n;
  vec2 r = (uWet.w > 0.0 && dist < ${f(RIPPLE_NEAR_M)}) ? wetRipple(m) * (uWet.w * (1.0 - dist / ${f(RIPPLE_NEAR_M)})) : vec2(0.0);
  return normalize(mix(n, normalize(vec3(-r.x * ${f(RIPPLE_SLOPE)}, 1.0, -r.y * ${f(RIPPLE_SLOPE)})), w.y));
}
// the sun in the wet, V toward the eye: a lobe that tightens from a sheen's to a puddle's, normalised so the tight one
// is a bright point
vec3 wetSunGlint(vec3 n, vec3 V, float sunVis, float gloss) {
  if (gloss <= 0.0 || sunVis <= 0.0 || uSunScale <= 0.0) return vec3(0.0);
  vec3 H = normalize(uLightDir + V);
  float s = mix(24.0, 256.0, gloss);
  return uSunColor * (uSunScale * sunVis * gloss * pow(max(dot(n, H), 0.0), s) * (s + 2.0) / 8.0 * wetFresnel(dot(V, H)));
}
// the sky in the wet, on the finished display colour - fog alone is black at night, so the ambient rides with it
vec3 wetSky(vec3 col, vec3 n, vec3 V, float gloss) {
  if (gloss <= 0.0) return col;
  vec3 mir = max(uFogColor, uAmbient);
  return mix(col, mir, min(wetFresnel(dot(n, V)) * gloss, ${f(WET_SKY_MAX)}));
}
`;

/** The ground's half, after snowCoverGlsl (snowNoise, uEcoOrigin): x the wetness, y the puddle at pixel-local metres
 *  `local`, under snow `snow`, at a footprint of `fw` tiles a screen pixel (puddles past a tile a pixel are gone). */
export const RAIN_GROUND_GLSL = `
vec2 wetGround(vec2 local, vec3 n, float snow, float fw) {
  float wet = uWet.x * (1.0 - snow);
  if (wet <= 0.0) return vec2(0.0);
  float pud = 0.0;
  if (uWet.y > 0.0) {
    vec2 lt = local / ${f(SNOW_TILE_M)};
    float a = clamp(2.0 - 2.0 * fw, 0.0, 1.0);
    float p = mix(0.5, 0.6 * snowNoise(lt, 1, ${PUDDLE_SALT}u) + 0.4 * snowNoise(lt, 4, ${PUDDLE_SALT + 1}u), a);
    float th = 1.0 - ${f(PUDDLE_SPREAD)} * uWet.y;
    pud = smoothstep(th - ${f(PUDDLE_EDGE)} * 0.35, th + ${f(PUDDLE_EDGE)}, p) * smoothstep(${f(PUDDLE_FLAT[0])}, ${f(PUDDLE_FLAT[1])}, n.y) * (1.0 - snow);
  }
  return vec2(wet, pud);
}
`;
