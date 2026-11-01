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
export const PUDDLE_DARK = 0.1;   // WET1e: darker water so puddles read against the stone (was 0.2 - too close to wet ground)
/** WET1d: a puddle's wet lobe (a lamp's reflection is a point), its glint gain, and a lit window's glint gain. */
export const PUDDLE_GLOSS = 1024;   // WET1d: stretch does the column kill; 4500 pow() was GPU-heavy next to winGlint
export const PUDDLE_GLINT = 5;
export const PUDDLE_WIN_GLINT = 3;
/** WET1d: kill the Blinn column along the view on the ground (0 = isotropic). */
export const PUDDLE_STRETCH = 9;
/** WET1d: window glint - near keeps the lattice; far dissolves the hard square (soft + fade), metres to the window. */
export const WIN_GLINT_LOD0 = 0.5;   // WET1d: +25% stone scatter (was 0.4)
export const WIN_GLINT_LOD1 = 3.0;
export const WIN_GLINT_NEAR_M = 4;
export const WIN_GLINT_FAR_M = 16;
export const WIN_GLINT_FADE_M = 22;
/** WET1d: how much of the ambient a night mirror shows - all of it read as a grey sheet. */
export const WET_SKY_AMBIENT = 0.5;   // WET1e: stronger sky in the wet when the proxy misses
/** A wall's gloss. Ground splits: soil almost matte, a road a dull sheen, a puddle a mirror (wetGlossGround). */
export const WET_SHEEN = 0.2;   // walls/roofs only - ground mirrors are road puddles alone
export const WET_SHEEN_SOIL = 0.0;   // WET1f: soil never sheens
export const WET_SHEEN_ROAD = 0.0;   // WET1f: damp paving without a puddle is not a mirror
/** Soil never mirrors; road puddles take the glass (wetGlossGround). */
export const PUDDLE_SHEEN_SOIL = 0.0;
/** How wide the puddle's edge is, in the noise's 0..1 - a hard step read as a drawn line. */
export const PUDDLE_EDGE = 0.22;
/** Puddles: the flat they need (n.y), their noise salt, and how far their face's threshold falls at a full fill. */
export const PUDDLE_FLAT = Object.freeze([0.96, 0.995]);
export const PUDDLE_SALT = 0x50554444;   // 'PUDD'
export const PUDDLE_SPREAD = 0.45;
/** Ripples: a drop cell's side (m), drops a second in a cell (times 1000 a whole number: the clock wraps there), the
 *  distance they fade out by (m), ring half-width in cell units, and the slope a ring puts on the face. */
export const RIPPLE_CELL_M = 0.28;   // room for the ring to travel before the next cell's drop
export const RIPPLE_RATE = 1.25;   // was 3.5 - ~0.3 s life; waves died before they spread (~0.8 s now)
export const RIPPLE_NEAR_M = 30;
export const RIPPLE_WIDTH = 0.14;
export const RIPPLE_SLOPE = 0.32;
/** Ring radius in cell units grows from GROW0 to GROW0+GROW1 over the drop's life. */
export const RIPPLE_GROW0 = 0.08;
export const RIPPLE_GROW1 = 0.85;
/** The most of the sky a wet surface shows. */
export const WET_SKY_MAX = 0.9;

const f = glslFloat;

/** The shared half: uWet, the ripples, the albedo, the sun's glint and the sky. After the lantern loop (wetFresnel). */
export const RAIN_WET_GLSL = `
uniform vec4 uWet;   // WET1: x the ground's wetness, y the puddles' fill, z seconds (the ripples' clock), w the rain now
float wetHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
// one drop a cell; each remake picks centre, size and width (uniform rings read as stamps)
vec2 wetRipple(vec2 m) {
  vec2 q = m / ${f(RIPPLE_CELL_M)}, c = floor(q);
  float h = wetHash(c);
  if (h > uWet.w) return vec2(0.0);
  float phase = uWet.z * ${f(RIPPLE_RATE)} + h * 7.0;
  float age = fract(phase), tick = floor(phase);
  vec2 d = q - (c + 0.25 + 0.5 * vec2(wetHash(c + vec2(tick, 19.0)), wetHash(c + vec2(23.0, tick))));
  float r = length(d);
  float sz = mix(0.5, 1.55, wetHash(c + vec2(tick, 41.0)));
  float wid = ${f(RIPPLE_WIDTH)} * mix(0.6, 1.45, wetHash(c + vec2(13.0, tick)));
  float amp = mix(0.55, 1.3, wetHash(c + vec2(tick, 7.0)));
  float rad = (${f(RIPPLE_GROW0)} + ${f(RIPPLE_GROW1)} * age) * sz;
  float x = (r - rad) / max(wid, 1e-3);
  // fade only in the last quarter of life - earlier cut killed the wave mid-spread
  float ring = sin(x * 3.14159) * exp(-x * x * 0.5) * smoothstep(1.0, 0.78, age) * amp;
  return r > 1e-4 ? d / r * ring : vec2(0.0);
}
vec3 wetAlbedo(vec3 a, vec2 w, float dark) { return a * mix(1.0, dark, w.x) * mix(1.0, ${f(PUDDLE_DARK)}, w.y); }
// a wall takes half the rain a roof does, and stands no puddle
vec2 wetWall(vec3 n) { return vec2(uWet.x * mix(0.5, 1.0, max(n.y, 0.0)), 0.0); }
float wetGloss(vec2 w) { return max(w.x * ${f(WET_SHEEN)}, w.y); }
// WET1f: ground mirrors only in a road/paving puddle - soil and dry stone stay matte
float wetGlossGround(vec2 w, float road) {
  return w.y * road;
}
// a puddle's face is level, and rings where drops fall near the eye
vec3 wetNormal(vec3 n, vec2 w, vec2 m, float dist) {
  if (w.y <= 0.0) return n;
  float near = smoothstep(${f(RIPPLE_NEAR_M)}, ${f(RIPPLE_NEAR_M * 0.4)}, dist);
  vec2 r = (uWet.w > 0.0 && near > 0.001) ? wetRipple(m) * (uWet.w * near) : vec2(0.0);
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
// water running down a roof and off its low edge: threads moving downhill while it rains. A flat roof has no slope, so
// the flow takes one fixed heading. A wall (n.y low) is left alone.
vec3 roofRunoff(vec3 a, vec3 n, vec3 wp) {
  float roof = smoothstep(0.4, 0.72, n.y) * uWet.w;
  if (roof <= 0.001) return a;
  vec2 xz = -n.xz;
  vec3 down = normalize(vec3(length(xz) > 0.08 ? xz : vec2(1.0, 0.15), 0.0));
  float across = dot(wp.xz, vec2(down.z, -down.x));
  float along = dot(wp, down);
  float lane = smoothstep(0.78, 0.96, fract(across * 1.6));
  float bead = smoothstep(0.2, 0.85, fract(along * 0.45 - uWet.z * 1.1));
  return mix(a, a * 0.5 + vec3(0.55, 0.62, 0.7), roof * lane * bead);
}
// the sky in the wet, on the finished display colour - fog alone is black at night, so the ambient rides with it
vec3 wetSky(vec3 col, vec3 n, vec3 V, float gloss) {
  if (gloss <= 0.0) return col;
  vec3 mir = max(uFogColor, uAmbient * ${f(WET_SKY_AMBIENT)});
  return mix(col, mir, min(wetFresnel(dot(n, V)) * gloss, ${f(WET_SKY_MAX)}));
}
`;

/** The ground's half, after snowCoverGlsl (snowNoise, uEcoOrigin): x the wetness, y the puddle at pixel-local metres
 *  `local`, under snow `snow`, at a footprint of `fw` tiles a screen pixel (puddles past a tile a pixel are gone).
 *  `road` (0..1) - WET1f: puddles stand only on paving/street stone. */
export const RAIN_GROUND_GLSL = `
vec2 wetGround(vec2 local, vec3 n, float snow, float fw, float road) {
  float wet = uWet.x * (1.0 - snow);
  if (wet <= 0.0) return vec2(0.0);
  float pud = 0.0;
  if (uWet.y > 0.0 && road > 0.001) {
    vec2 lt = local / ${f(SNOW_TILE_M)};
    float a = clamp(2.0 - 2.0 * fw, 0.0, 1.0);
    float p = mix(0.5, 0.6 * snowNoise(lt, 1, ${PUDDLE_SALT}u) + 0.4 * snowNoise(lt, 4, ${PUDDLE_SALT + 1}u), a);
    float th = 1.0 - ${f(PUDDLE_SPREAD)} * uWet.y;
    pud = smoothstep(th - ${f(PUDDLE_EDGE)} * 0.35, th + ${f(PUDDLE_EDGE)}, p) * smoothstep(${f(PUDDLE_FLAT[0])}, ${f(PUDDLE_FLAT[1])}, n.y) * (1.0 - snow);
    pud *= smoothstep(0.2, 0.55, road);   // WET1f: soil and verge - wet dark, no puddle mirror
  }
  return vec2(wet, pud);
}
`;
