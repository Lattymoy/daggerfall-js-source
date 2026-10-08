// @ts-check
// SD5b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR'S SKY -
// "a void of brass light and slow aurorae, the Bay's skylines hanging upside down in it - Daggerfall's towers,
// Sentinel's domes, Wayrest's bridges - the shards of the endings, turning on the realm's clock; a great clock-face of
// stars behind the arena whose hands run backwards."
//
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 5): A PAINTED SKY, in two stages.
//
//   THE MAP - an octahedral SD_SKY_MAP x SD_SKY_MAP picture of the whole sky, one texel about 0.4 degrees (Daggerfall's
//     own sky is pi/512 a pixel - render/skyRenderer.js SKY_ANGLE_PER_PIXEL), NEAREST: painted by SD_SKY_PAINT_FS a
//     quadrant a frame (`SdSkyMap.paint`), so the whole refreshes every four, every texel forced to the posterized,
//     dithered steps of the pixel law (render/orderedDither.js SD_PIXEL_GLSL). Everything slow lives in it: the void in
//     eight dithered bands from the black overhead to the brass haze that meets the fog; stars, single crisp texels,
//     the brightest with four-point glints; the aurorae, banded curtains with rays, posterized to four steps; the
//     clock-face of stars - a dense rim, sixty minute dots, its twelve hours in Roman numerals plotted in stars, the six
//     Endings as constellations on its inner ring (world/sdSkyArt.js - the stones' own signs), the Hollow's own burning
//     in its light; six of the Bay's cities hanging upside down, black with warm windows; the mist below the horizon
//     deepening to black, and the furnace glowing at the nadir.
//   THE FETCH - one triangle at the far plane (the Deadlands' law, render/deadlands.js), each pixel one tap of the map
//     (SD_SKY_FETCH_GLSL - the Rift's window reads the same) and the LIVE things over it, snapped to the map's texels so
//     they are exactly as chunky as its stars: the hour and minute hands running BACKWARDS on the escapement (world/
//     sdLook.js sdTick), the second hand stepping back one tick each second on the Hour's tock, and what the sky says of
//     the fight (`uClock`: the Hour's length as a red arc, the Reset's hands sweeping to XII, the Dragon Break's doubled
//     face, the End's red, the collapse's hands running forward and its numerals going dark).
//
// THE FACE is lowered (elevation 0.20, radius 0.34) so from the end of the Crumble the Remnant's head stands at its hub,
// its lower edge sinking behind the arena like a rising sun. Azimuth is measured from the realm's +z - toward the arena,
// where the face hangs - turning toward +x. THE CLOCK is the realm's, anchored (world.js hands the Deadlands' own anchored
// relay clock), so every screen shows one moment; every rate is a whole number of cycles over SD_SKY_PERIOD and the clock
// is handed wrapped, so the sky never jumps.
//
// Colours are display-encoded (the lit lane's frame image), scaled by `gain` with the realm's fog (render/deadlands.js
// skyGain's law) at the fetch. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { DEAD_NOISE_GLSL } from './deadlands.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from './orderedDither.js';
import { createRenderTarget, withTarget } from './renderTarget.js';
import { sdSkySigns, SD_SKY_SIGN_GRID, SD_GLYPHS, SD_HOUR_NUMERALS, numeralWidth } from '../world/sdSkyArt.js';
import { SD_TICK_EASE_S } from '../world/sdLook.js';

/** Every rate is whole cycles over this many seconds; the clock is handed wrapped to it. */
export const SD_SKY_PERIOD = 720;
export const sdSkyClock = (seconds) => ((seconds % SD_SKY_PERIOD) + SD_SKY_PERIOD) % SD_SKY_PERIOD;
/** The clock-face: where it hangs (radians - over the arena, +z), how wide, and its hands' turns a period (backwards).
 *  SD-LOOK: lowered (it hung at 0.38, 0.36 wide) - the Remnant's head at its hub from the Crumble's end. */
export const SD_CLOCK_FACE = Object.freeze({ az: 0, elev: 0.2, r: 0.34, hourTurns: 1, minuteTurns: 12 });
/** The far skylines: each city's azimuth at the clock's zero, its half-width and depth (radians), its turns a period.
 *  SD-LOOK: six - Orsinium's tusked walls, the Underking's bone spire and the Blades' dragon keep beside the three. */
export const SD_SKY_SHARDS = Object.freeze([
  Object.freeze({ name: 'daggerfall', az: 2.2, halfW: 0.42, depth: 0.32, turns: 1 }),
  Object.freeze({ name: 'sentinel', az: -2.1, halfW: 0.38, depth: 0.26, turns: -1 }),
  Object.freeze({ name: 'wayrest', az: 3.05, halfW: 0.5, depth: 0.22, turns: 2 }),
  Object.freeze({ name: 'orsinium', az: 1.05, halfW: 0.36, depth: 0.24, turns: -1 }),
  Object.freeze({ name: 'underking', az: -1.0, halfW: 0.22, depth: 0.3, turns: 1 }),
  Object.freeze({ name: 'blades', az: -3.0, halfW: 0.34, depth: 0.28, turns: -2 }),
]);
/** The clock-face's rim: its half-width (in the face's radii) - and so the face's highest drawn point, its rim's outer
 *  edge over its centre (radians of elevation). */
export const SD_CLOCK_RING_W = 0.035;
export const SD_CLOCK_TOP = SD_CLOCK_FACE.elev + SD_CLOCK_FACE.r * (1 + SD_CLOCK_RING_W);
/** Where the skylines hang from (the upper sky, radians of elevation), the aurorae's band, and their slow drift's turns.
 *  AUDIT SD II (L2 F15): every skyline hangs wholly over the clock-face's highest point, SD_SHARD_CLEAR clear of it, so no
 *  drift ever carries one across it. SD-LOOK: the aurorae over the face's top, so it is never smoked over. */
export const SD_SHARD_CLEAR = 0.05;
export const SD_SHARD_TOP = SD_CLOCK_TOP + SD_SHARD_CLEAR + Math.max(...SD_SKY_SHARDS.map((s) => s.depth));
export const SD_AURORA = Object.freeze({ low: 0.62, high: 1.3, turns: 3 });
/** SD-LOOK: the map's side (texels), and the steps the pixel law posterizes its brightness to on the lane and the classic set. */
export const SD_SKY_MAP = 512;
export const SD_SKY_STEPS = Object.freeze({ lane: 10, classic: 8 });
/** SD-LOOK: the face's parts, in its radii - the minute dots' ring, the numerals' (their middle) and a numeral's cell,
 *  the constellations' (their middle) and a sign's size across. */
export const SD_CLOCK_PARTS = Object.freeze({ minutes: 0.915, numerals: 0.74, cell: 0.03, signs: 0.43, sign: 0.3 });
/** SD-LOOK: the fetch's word for the fight (`uClock.x`): none, a living fight (the Hour's length burning round the rim),
 *  the Reset's wind-up (the hands sweeping back to XII), the Dragon Break (the face doubled), the Hour Ends (red), the
 *  collapse (the hands running forward to XII, the numerals going dark). */
export const SD_SKY_MODE = Object.freeze({ none: 0, fight: 1, reset: 2, break: 3, end: 4, collapse: 5 });

const HEAD = `#version 300 es
precision highp float;
`;

export const SD_SKY_VS = HEAD + `layout(location = 0) in vec2 aPos;
uniform vec3 uRight, uUp, uFwd;
uniform vec4 uProj;
out vec3 vRay;
void main() {
  vRay = uRight * ((aPos.x + uProj.z) / uProj.x) + uUp * ((aPos.y + uProj.w) / uProj.y) + uFwd;
  gl_Position = vec4(aPos, 1.0, 1.0); }`;

const f4 = (v) => v.toFixed(4);
const f6 = (v) => v.toFixed(6);
/** AUDIT SD II (L2 F15): the clock-face's frame on the sky - its centre's direction (the realm's azimuth from +z toward
 *  +x, its elevation), the way its third hour lies (azimuth growing) and its twelfth (elevation growing). */
export const CLOCK_BASIS = Object.freeze((() => {
  const { az, elev } = SD_CLOCK_FACE;
  return {
    centre: Object.freeze([Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)]),
    right: Object.freeze([Math.cos(az), 0, -Math.sin(az)]),
    up: Object.freeze([-Math.sin(elev) * Math.sin(az), Math.cos(elev), -Math.sin(elev) * Math.cos(az)]),
  };
})());

/** SD-LOOK: THE OCTAHEDRAL MAP - a direction to its place on the map (0..1 each way) and back, +y the inner diamond. Pure
 *  (the shaders' own, pinned equal). */
export function octEncode(d) {
  const s = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]);
  let x = d[0] / s, z = d[2] / s;
  if (d[1] < 0) { const ox = x; x = (1 - Math.abs(z)) * (ox >= 0 ? 1 : -1); z = (1 - Math.abs(ox)) * (z >= 0 ? 1 : -1); }
  return [x * 0.5 + 0.5, z * 0.5 + 0.5];
}
export function octDecode(uv) {
  const fx = uv[0] * 2 - 1, fz = uv[1] * 2 - 1, y = 1 - Math.abs(fx) - Math.abs(fz), t = Math.max(-y, 0);
  const x = fx + (fx >= 0 ? -t : t), z = fz + (fz >= 0 ? -t : t), l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
export const SD_OCT_GLSL = `vec2 octEncode(vec3 d) {
  vec3 n = d / (abs(d.x) + abs(d.y) + abs(d.z));
  vec2 p = n.xz;
  if (n.y < 0.0) p = (1.0 - abs(n.zx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0);
  return p * 0.5 + 0.5;
}
vec3 octDecode(vec2 uv) {
  vec2 f = uv * 2.0 - 1.0;
  vec3 n = vec3(f.x, 1.0 - abs(f.x) - abs(f.y), f.y);
  float t = max(-n.y, 0.0);
  n.x += n.x >= 0.0 ? -t : t;
  n.z += n.z >= 0.0 ? -t : t;
  return normalize(n);
}
`;

/** THE CLOCK-FACE's own frame for a ray d, and back: AUDIT SD II (L2 F15) read on the sphere (the azimuthal equidistant
 *  frame about its centre) - the twelfth hour up, the third toward the arena's right; `faceDir` the direction of a
 *  point of the face. */
export const SD_CLOCK_GLSL = `const vec3 FACE_CENTRE = vec3(${CLOCK_BASIS.centre.map(f6).join(', ')});
const vec3 FACE_RIGHT = vec3(${CLOCK_BASIS.right.map(f6).join(', ')});
const vec3 FACE_UP = vec3(${CLOCK_BASIS.up.map(f6).join(', ')});
vec2 clockFaceAt(vec3 d) {
  vec2 t = vec2(dot(d, FACE_RIGHT), dot(d, FACE_UP));
  return t * (acos(clamp(dot(d, FACE_CENTRE), -1.0, 1.0)) / max(length(t), 1e-6)) / ${f6(SD_CLOCK_FACE.r)};
}
vec3 faceDir(vec2 p) {
  float l = length(p), th = l * ${f6(SD_CLOCK_FACE.r)};
  if (l < 1e-6) return FACE_CENTRE;
  return cos(th) * FACE_CENTRE + sin(th) * (p.x * FACE_RIGHT + p.y * FACE_UP) / l;
}
`;

/** The Bay's skylines, upside down: each (u across, -1..1; v down from the ground the city hangs from, 0..1) answers
 *  whether it is city. Read by the map's paint and (right way up) by the Return's window. */
export const SD_SKYLINE_GLSL = `float box(float u, float v, float c, float w, float h) { return step(abs(u - c), w) * step(v, h); }
// DAGGERFALL: towers of uneven height hanging from the shard's edge, each ending in a spire (pointing down)
float skyline0(float u, float v) {
  float m = 0.0;
  for (int i = 0; i < 7; i++) {
    float c = -0.82 + float(i) * 0.27, w = 0.06 + 0.03 * fract(float(i) * 0.618), h = 0.35 + 0.45 * fract(float(i) * 0.371 + 0.2);
    m = max(m, box(u, v, c, w, h));
    m = max(m, step(v, h + (w - abs(u - c)) * 2.2) * step(abs(u - c), w) * step(h, v));   // the spire
  }
  return max(m, step(v, 0.12));   // the ground they stand on, above them
}
// SENTINEL: domes bulging down from the edge, a minaret beside each
float skyline1(float u, float v) {
  float m = step(v, 0.1);
  for (int i = 0; i < 4; i++) {
    float c = -0.66 + float(i) * 0.44, w = 0.13 + 0.05 * fract(float(i) * 0.5);
    float d = length(vec2((u - c) / w, (v - 0.1) / (w * 1.6)));
    m = max(m, step(d, 1.0) * step(0.1, v));
    m = max(m, box(u, v, c + w * 1.35, 0.022, 0.62 + 0.15 * fract(float(i) * 0.77)));
  }
  return m;
}
// WAYREST: its bridge - the deck along the edge, its spans' arches bowed toward it between the piers, two gate towers
float skyline2(float u, float v) {
  float m = step(v, 0.08);                         // the city's edge
  float cell = fract((u + 1.0) * 2.0);             // four spans across the shard
  float arch = 2.0 * cell - 1.0;                   // AUDIT SD II (L2 F12): squared by itself - negative over half a span,
  float curve = 0.14 + 0.36 * arch * arch;         // where GLSL ES leaves a power of it undefined (D3D answers NaN)
  m = max(m, step(v, curve) * step(0.08, v));      // the deck, and the piers thickening to its arches' feet
  m = max(m, box(u, v, -0.5, 0.05, 0.62));
  m = max(m, box(u, v, 0.5, 0.05, 0.62));
  return m;
}
// SD-LOOK - ORSINIUM: a thick crenellated wall, and two great tusks curving down from it
float skyline3(float u, float v) {
  float m = step(v, 0.3) * step(abs(u), 0.9);
  m = max(m, step(v, 0.38) * step(0.5, fract(u * 6.0)) * step(abs(u), 0.9));   // the merlons
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0, t = clamp((v - 0.3) / 0.6, 0.0, 1.0), c = s * (0.45 - 0.25 * t * t);
    m = max(m, step(abs(u - c), 0.12 * (1.0 - t)) * step(0.3, v) * step(v, 0.9));
  }
  return m;
}
// SD-LOOK - THE UNDERKING: a spire of bone, its ribs reaching out either side
float skyline4(float u, float v) {
  float m = step(v, 0.1) * step(abs(u), 0.7);
  m = max(m, step(abs(u), 0.16 * (1.0 - v)) * step(v, 0.95));
  for (int i = 0; i < 4; i++) {
    float y = 0.22 + float(i) * 0.16, reach = 0.55 - float(i) * 0.1;
    m = max(m, step(abs(v - y - abs(u) * 0.35), 0.025) * step(abs(u), reach));
  }
  return m;
}
// SD-LOOK - THE BLADES: a keep, its roof's dragon wings spread, two small towers
float skyline5(float u, float v) {
  float m = step(v, 0.1) * step(abs(u), 0.85);
  m = max(m, box(u, v, 0.0, 0.25, 0.55));
  m = max(m, step(v, 0.55 + (0.7 - abs(u)) * 0.45) * step(0.55, v) * step(abs(u), 0.7) * step(abs(u), 0.25 + (v - 0.55) * 1.6));
  m = max(m, box(u, v, -0.62, 0.07, 0.42));
  m = max(m, box(u, v, 0.62, 0.07, 0.42));
  return m;
}
`;

/** The numerals as the paint draws them (world/sdSkyArt.js's glyphs, the cells of `numeralCell`): `numeralLit(h, cx,
 *  cy)` - hour h (0 the twelfth), cell cx from the numeral's left, cy from its top row. The veil's dial reads them too
 *  (render/sdVeil.js). */
export const SD_NUMERAL_GLSL = `const int GLYPH_I[7] = int[7](${SD_GLYPHS.I.rows.join(', ')});
const int GLYPH_V[7] = int[7](${SD_GLYPHS.V.rows.join(', ')});
const int GLYPH_X[7] = int[7](${SD_GLYPHS.X.rows.join(', ')});
float glyphBit(int g, int cx, int cy) {
  int row = g == 0 ? GLYPH_I[cy] : g == 1 ? GLYPH_V[cy] : GLYPH_X[cy];
  int w = g == 0 ? 1 : 5;
  return float((row >> (w - 1 - cx)) & 1);
}
int numeralWidth(int h) {
  ${SD_HOUR_NUMERALS.map((s, h) => `if (h == ${h}) return ${numeralWidth(s)};`).join(' ')}
  return 0;
}
float numeralLit(int h, int cx, int cy) {
  if (cy < 0 || cy > 6 || cx < 0) return 0.0;
${SD_HOUR_NUMERALS.map((s, h) => {
  let x = 0;
  const parts = [...s].map((ch) => { const g = SD_GLYPHS[ch], code = ch === 'I' ? 0 : ch === 'V' ? 1 : 2, at = x; x += g.w + 1; return `if (cx >= ${at} && cx < ${at + g.w}) return glyphBit(${code}, cx - ${at}, cy);`; });
  return `  if (h == ${h}) { ${parts.join(' ')} return 0.0; }`;
}).join('\n')}
  return 0.0;
}
`;

const skylineDraw = SD_SKY_SHARDS.map((s, i) => `  { float c = ${f4(s.az)} + ${f4(s.turns)} * TAU * uTime / PERIOD; float du = wrapPi(az - c) / ${f4(s.halfW)}; float dv = (${f4(SD_SHARD_TOP)} - e) / ${f4(s.depth)};
    if (abs(du) < 1.0 && dv > -0.05 && dv < 1.0) { float m = skyline${i}(du, dv); float rim = max(skyline${i}(du * 1.04, dv - 0.06), skyline${i}(du * 0.96, dv - 0.06)) * (1.0 - m);
      col = mix(col, SHARD_DARK, m * 0.95); col = max(col, BRASS * 0.75 * rim);
      if (m > 0.5 && dv > 0.14 && fract(dv * 11.0) < 0.45 && fract(du * 9.0) < 0.5 && dhash(floor(vec2(du * 9.0, dv * 11.0)) + ${f4(i * 17.3 + 4.1)}) > 0.55) col = WINDOW * (0.42 + 0.3 * dhash(cellF + 1.7)); } }`).join('\n');

/** THE PAINT: one texel of the map a fragment - its direction the octahedral decode of its centre. */
export const SD_SKY_PAINT_VS = HEAD + `layout(location = 0) in vec2 aPos;
uniform vec4 uQuad;   // the quadrant painted: its corner and its size on the map (0..1)
out vec2 vUv;
void main() { vUv = uQuad.xy + (aPos * 0.5 + 0.5) * uQuad.zw; gl_Position = vec4(aPos, 0.0, 1.0); }`;
export const SD_SKY_PAINT_FS = HEAD + `in vec2 vUv;
uniform float uTime;      // the realm's seconds, wrapped to the period
uniform vec3 uHaze;       // the frame's fog colour - the horizon meets it
uniform float uSteps;     // the pixel law's steps (SD_SKY_STEPS)
uniform sampler2D uSigns; // the six signs (world/sdSkyArt.js sdSkySigns)
uniform vec3 uEnding;     // the Hollow's own Ending's light
uniform float uEndingIdx; // its sign (-1: none)
out vec4 o;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
const float PERIOD = ${SD_SKY_PERIOD.toFixed(1)};
const float MAP = ${SD_SKY_MAP.toFixed(1)};
const vec3 V0 = vec3(0.0196, 0.0157, 0.0118);
const vec3 V1 = vec3(0.0471, 0.0353, 0.0235);
const vec3 V2 = vec3(0.0941, 0.0667, 0.0392);
const vec3 V3 = vec3(0.2, 0.149, 0.0706);
const vec3 V4 = vec3(0.3608, 0.2353, 0.0941);
const vec3 BRASS = vec3(0.62, 0.45, 0.2);
const vec3 BRASS_BRIGHT = vec3(1.0, 0.82, 0.48);
const vec3 MANTELLA = vec3(0.55, 1.0, 0.75);
const vec3 SILVER = vec3(0.8, 0.82, 0.88);
const vec3 SHARD_DARK = vec3(0.016, 0.012, 0.008);
const vec3 WINDOW = vec3(1.0, 0.7, 0.32);
ivec2 gTexel;   // the texel being painted
${DEAD_NOISE_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}${SD_OCT_GLSL}${SD_CLOCK_GLSL}${SD_SKYLINE_GLSL}${SD_NUMERAL_GLSL}
float wrapPi(float a) { return mod(a + PI, TAU) - PI; }
// whether the point p of the face falls on the texel being painted - a star of one texel, never a smear
bool onTexel(vec2 p) { return ivec2(floor(octEncode(faceDir(p)) * MAP)) == gTexel; }
vec3 vramp(float k) {
  float f = clamp(k, 0.0, 1.0) * 4.0, t = fract(f);
  if (f < 1.0) return mix(V0, V1, t);
  if (f < 2.0) return mix(V1, V2, t);
  if (f < 3.0) return mix(V2, V3, t);
  return f < 4.0 ? mix(V3, V4, t) : V4;
}
// THE VOID: eight dithered bands from the black overhead to the brass haze at the horizon (V3, the fog's own colour);
// below, the mist deepening to black, then the furnace at the nadir
vec3 voidAt(float e, vec2 cell) {
  float k = e >= 0.0 ? 0.75 * exp(-e * 3.2) : 0.75 * exp(e * 6.0) + 0.95 * smoothstep(0.95, 1.55, -e);
  vec3 c = vramp(floor(k * 8.0 + bayer4(cell)) / 8.0);
  return mix(c, uHaze, 0.45 * exp(-abs(e) * 14.0));
}
float auroraCurtain(float az, float e, float drift) {
  return sin(az * 3.0 + dfbm(vec2(cos(az), sin(az)) * (0.7 + 2.0 * e) + vec2(cos(drift), sin(drift)) * 0.7, 4) * 4.0 + drift);
}
void main() {
  gTexel = ivec2(floor(vUv * MAP));
  vec2 cellF = vec2(gTexel);
  vec3 d = octDecode((vec2(gTexel) + 0.5) / MAP);
  float e = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, d.z);
  vec3 col = voidAt(e, cellF);
  // THE STARS: single texels of pale silver, the brightest with a four-point glint
  float up = smoothstep(0.03, 0.2, e);
  if (up > 0.0) {
    float h = dhash(cellF * 0.7071 + 13.1);
    if (h > 0.9935) col = max(col, SILVER * (0.45 + 0.45 * dhash(cellF + 7.7)) * up);
    float g = max(max(dhash((cellF + vec2(1.0, 0.0)) * 0.7071 + 13.1), dhash((cellF - vec2(1.0, 0.0)) * 0.7071 + 13.1)), max(dhash((cellF + vec2(0.0, 1.0)) * 0.7071 + 13.1), dhash((cellF - vec2(0.0, 1.0)) * 0.7071 + 13.1)));
    if (g > 0.9988) col = max(col, SILVER * 0.38 * up);
  }
  // THE AURORAE: banded curtains hanging from a wandering hem - the Mantella's at the hem, brass rising to the crown -
  // cut by fine vertical rays, in four steps
  if (e > ${f4(SD_AURORA.low)} && e < ${f4(SD_AURORA.high)}) {
    float drift = ${f4(SD_AURORA.turns)} * TAU * uTime / PERIOD;
    float curtain = auroraCurtain(az, e, drift);
    float hemE = ${f4(SD_AURORA.low + 0.06)} + 0.12 * dnoise(vec2(cos(az), sin(az)) * 2.5 + vec2(drift * 0.3, 0.0));
    float rise = e - hemE;
    float body = step(0.0, rise) * exp(-rise * 2.6) * smoothstep(0.35, 0.9, curtain) * (1.0 - smoothstep(${f4(SD_AURORA.high - 0.25)}, ${f4(SD_AURORA.high)}, e));
    float rays = 0.45 + 0.55 * step(0.5, fract(az * 17.0 + 1.7 * dnoise(vec2(az * 6.0, 1.0))));
    float k = floor(body * rays * 4.0 + bayer4(cellF) * 0.6) / 4.0;
    float hem = step(0.0, rise) * step(rise, 0.02) * step(0.35, curtain);
    col += mix(BRASS * 0.8, MANTELLA * 0.45, hem) * k;
  }
  // THE CLOCK-FACE of stars: its rim, sixty minutes, twelve numerals, six constellations - sunk below the horizon's mist
  {
    vec2 p = clockFaceAt(d);
    float r = length(p), seen = smoothstep(-0.06, 0.02, e);
    if (r < 1.1 && seen > 0.0) {
      float ang = atan(p.x, p.y);
      vec3 face = vec3(0.0);
      if (abs(r - 1.0) < ${f4(SD_CLOCK_RING_W)} && dhash(cellF + 3.3) > 0.42) face = BRASS_BRIGHT * (0.42 + 0.3 * dhash(cellF + 5.5));
      float m = floor(ang / (TAU / 60.0) + 0.5) * TAU / 60.0;
      if (onTexel(${f4(SD_CLOCK_PARTS.minutes)} * vec2(sin(m), cos(m)))) face = max(face, BRASS_BRIGHT * (mod(floor(ang / (TAU / 60.0) + 0.5), 5.0) < 0.5 ? 0.85 : 0.5));
      // the numerals: the nearest hour's, its cells radial (its foot toward the hub), pixel letters of stars
      int hr = int(mod(floor(ang / (TAU / 12.0) + 0.5), 12.0));
      float phi = float(hr) * TAU / 12.0;
      vec2 rt = vec2(cos(phi), -sin(phi)), upv = vec2(sin(phi), cos(phi));
      vec2 q = p - ${f4(SD_CLOCK_PARTS.numerals)} * upv;
      vec2 local = vec2(dot(q, rt), dot(q, upv)) / ${f4(SD_CLOCK_PARTS.cell)};
      int cx = int(floor(local.x + float(numeralWidth(hr)) * 0.5)), cy = int(floor(3.5 - local.y));
      if (cx < numeralWidth(hr) && numeralLit(hr, cx, cy) > 0.5) face = max(face, BRASS_BRIGHT * (0.72 + 0.18 * dhash(cellF + 9.1)));
      // the six Endings as constellations, each about an odd hour: a star at each cell its sign fills
      int k = int(mod(floor(mod(ang + TAU, TAU) / (TAU / 6.0)), 6.0));
      float pk = float(2 * k + 1) * TAU / 12.0;
      vec2 rk = vec2(cos(pk), -sin(pk)), uk = vec2(sin(pk), cos(pk));
      vec2 qs = p - ${f4(SD_CLOCK_PARTS.signs)} * uk;
      vec2 sl = vec2(dot(qs, rk), dot(qs, uk)) / ${f4(SD_CLOCK_PARTS.sign)} + 0.5;
      if (sl.x >= 0.0 && sl.x < 1.0 && sl.y >= 0.0 && sl.y < 1.0) {
        ivec2 gc = ivec2(floor(sl * ${SD_SKY_SIGN_GRID.toFixed(1)}));
        vec2 gv = ((vec2(gc) + 0.5) / ${SD_SKY_SIGN_GRID.toFixed(1)} - 0.5) * ${f4(SD_CLOCK_PARTS.sign)};
        vec2 gp = ${f4(SD_CLOCK_PARTS.signs)} * uk + gv.x * rk + gv.y * uk;
        if (onTexel(gp)) {
          float s = texelFetch(uSigns, ivec2(k * ${SD_SKY_SIGN_GRID} + gc.x, ${SD_SKY_SIGN_GRID - 1} - gc.y), 0).r;
          vec3 ink = abs(float(k) - uEndingIdx) < 0.5 ? uEnding : BRASS_BRIGHT * 0.7;
          if (s > 0.2) face = max(face, ink * (s > 0.75 ? 1.0 : 0.55));
        }
      }
      col = max(col, face * seen);
    }
  }
  // THE BAY'S CITIES, hanging upside down from the upper sky, black, their windows warm
${skylineDraw}
  o = vec4(sdPixel(col, cellF, uSteps), 1.0);
}`;

/** THE FETCH - one tap of the map along a ray, and the live hands over it, snapped to its texels. `sdSkyAt(d)` - the
 *  sky's colour (display-encoded, at the gain) along d. The sky's pass and the Rift's window (render/sdRiftPass.js) read
 *  the one function. Uniforms: uSkyMap, uTime (wrapped), uGain, uClock (SD_SKY_MODE, a0, a1, lit numerals). */
export const SD_SKY_FETCH_GLSL = `uniform sampler2D uSkyMap;
uniform float uTime;
uniform float uGain;
uniform vec4 uClock;
const float SKY_TAU = 6.283185307179586;
const float SKY_PERIOD = ${SD_SKY_PERIOD.toFixed(1)};
const float SKY_MAP = ${SD_SKY_MAP.toFixed(1)};
const vec3 SKY_HAND = vec3(1.0, 0.84, 0.5);
const vec3 SKY_SECOND = vec3(0.86, 0.9, 1.0);
const vec3 SKY_RED = vec3(1.0, 0.32, 0.26);
${SD_OCT_GLSL}${SD_CLOCK_GLSL}
// the escapement (world/sdLook.js sdTick): whole each second, eased over its first ${SD_TICK_EASE_S} s and held
float skyTick(float t) { float s = floor(t), e = min(1.0, (t - s) / ${SD_TICK_EASE_S.toFixed(2)}); return s + e * e * (3.0 - 2.0 * e); }
float skySeg(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return step(length(pa - ba * t), w);
}
// a hand of packed stars at angle a (clockwise from XII as the face reads), its spade tip
float skyHand(vec2 p, float a, float len, float w, ivec2 tx) {
  vec2 dir = vec2(sin(a), cos(a)), tip = dir * len * 0.82, side = vec2(dir.y, -dir.x);
  float core = skySeg(p, vec2(0.0), dir * len, w);
  float spade = step(abs(dot(p - tip, dir)) / (len * 0.12) + abs(dot(p - tip, side)) / (w * 3.2), 1.0);
  float packed = ((tx.x + tx.y) & 1) == 0 ? 1.0 : 0.72;
  return max(core * packed, spade);
}
vec3 skyFaceLive(vec3 d, ivec2 tx) {
  vec2 p = clockFaceAt(d);
  float r = length(p);
  if (r > 1.12) return vec3(0.0);
  int mode = int(uClock.x + 0.5);
  float tk = skyTick(uTime);
  float hourA = -SKY_TAU * ${f4(SD_CLOCK_FACE.hourTurns)} * tk / SKY_PERIOD, minA = -SKY_TAU * ${f4(SD_CLOCK_FACE.minuteTurns)} * tk / SKY_PERIOD;
  if (mode == ${SD_SKY_MODE.reset}) { hourA = mix(mod(hourA, SKY_TAU) - SKY_TAU, -SKY_TAU, uClock.y); minA = mix(mod(minA, SKY_TAU) - SKY_TAU, -SKY_TAU, uClock.y); }
  if (mode == ${SD_SKY_MODE.collapse}) { hourA = mix(mod(hourA, SKY_TAU), SKY_TAU, uClock.y); minA = mix(mod(minA, SKY_TAU), SKY_TAU, uClock.y); }
  float secA = -floor(uTime) * SKY_TAU / 60.0;
  float glow = fract(uTime) < 0.08 ? 1.0 : 0.72;
  vec3 c = SKY_HAND * 0.9 * max(skyHand(p, hourA, 0.5, 0.032, tx), skyHand(p, minA, 0.8, 0.022, tx));
  c = max(c, SKY_SECOND * glow * skySeg(p, vec2(0.0), 0.9 * vec2(sin(secA), cos(secA)), 0.012));
  if (mode == ${SD_SKY_MODE.break}) c = max(c, SKY_SECOND * 0.7 * max(skyHand(p, -hourA, 0.5, 0.032, tx), skyHand(p, -minA, 0.8, 0.022, tx)));
  float cw = mod(atan(p.x, p.y) + SKY_TAU, SKY_TAU) / SKY_TAU;
  if (mode == ${SD_SKY_MODE.fight} && r > 1.045 && r < 1.085 && cw < uClock.y) c = max(c, SKY_RED * 0.85);
  return c;
}
vec3 sdSkyAt(vec3 d) {
  vec2 uv = octEncode(normalize(d));
  ivec2 tx = clamp(ivec2(floor(uv * SKY_MAP)), ivec2(0), ivec2(int(SKY_MAP) - 1));
  vec3 col = texelFetch(uSkyMap, tx, 0).rgb;
  vec3 ds = octDecode((vec2(tx) + 0.5) / SKY_MAP);   // the texel's own direction: the hands as chunky as the stars
  int mode = int(uClock.x + 0.5);
  if (mode == ${SD_SKY_MODE.break}) {
    vec2 p = clockFaceAt(ds);
    if (length(p) < 1.1) { vec3 ghost = texelFetch(uSkyMap, clamp(ivec2(floor(octEncode(normalize(ds + FACE_RIGHT * 0.035)) * SKY_MAP)), ivec2(0), ivec2(int(SKY_MAP) - 1)), 0).rgb; col = max(col, ghost * vec3(0.8, 0.86, 1.0)); }
  }
  if (mode == ${SD_SKY_MODE.collapse} || mode == ${SD_SKY_MODE.fight}) {
    vec2 p = clockFaceAt(ds);
    float r = length(p), ang = mod(atan(p.x, p.y) + SKY_TAU, SKY_TAU);
    int hr = int(mod(floor(ang / (SKY_TAU / 12.0) + 0.5), 12.0));
    if (mode == ${SD_SKY_MODE.collapse} && r > ${f4(SD_CLOCK_PARTS.numerals - 0.12)} && r < ${f4(SD_CLOCK_PARTS.numerals + 0.12)} && float(hr) >= uClock.w) col *= 0.15;
    if (mode == ${SD_SKY_MODE.fight} && uClock.z > 0.5 && abs(r - 1.0) < ${f4(SD_CLOCK_RING_W * 1.2)}) col = SKY_RED * max(max(col.r, col.g), col.b) * 1.2;
  }
  col += skyFaceLive(ds, tx);
  if (mode == ${SD_SKY_MODE.end}) {
    vec2 p = clockFaceAt(ds);
    float r = length(p), crack = step(abs(sin(atan(p.x, p.y) * 5.0 + r * 9.0)), 0.06) * step(r, 1.0);
    col = mix(col, SKY_RED * 0.9, crack);
    col *= vec3(1.25, 0.6, 0.5);
  }
  return col * uGain;
}
`;

export const SD_SKY_FS = HEAD + `in vec3 vRay;
uniform vec3 uHaze;      // the frame's fog colour (painted into the map; kept for the pass's word)
out vec4 o;
${SD_SKY_FETCH_GLSL}
void main() {
  vec3 d = normalize(vRay);
  o = vec4(sdSkyAt(d), 1.0);
}`;

/** AUDIT SD II (L2 F9): the sky's ray basis into `out`'s own arrays - render/deadlands.js skyBasis's reading, which makes
 *  four arrays a call (pinned equal to it). The pass's frame makes nothing. */
export function sdSkyBasisInto(view, proj, out) {
  out.right[0] = view[0]; out.right[1] = view[4]; out.right[2] = view[8];
  out.up[0] = view[1]; out.up[1] = view[5]; out.up[2] = view[9];
  out.fwd[0] = -view[2]; out.fwd[1] = -view[6]; out.fwd[2] = -view[10];
  out.lens[0] = proj[0]; out.lens[1] = proj[5]; out.lens[2] = proj[8]; out.lens[3] = proj[9];
  return out;
}

/** SD-LOOK: THE MAP - its target, its paint program, its signs strip; painted a quadrant a call. Owned by the sky's pass
 *  (SdSkyRenderer.map), which the host keeps for the session as it keeps the program; `release()` frees all of it. */
export class SdSkyMap {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.target = createRenderTarget(gl, SD_SKY_MAP, SD_SKY_MAP, { filter: 'NEAREST' });
    this.program = buildProgram(gl, SD_SKY_PAINT_VS, SD_SKY_PAINT_FS, 'sd sky paint');
    this.u = {};
    for (const n of ['uQuad', 'uTime', 'uHaze', 'uSteps', 'uSigns', 'uEnding', 'uEndingIdx']) this.u[n] = gl.getUniformLocation(this.program, n);
    const signs = sdSkySigns();
    this.signs = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.signs);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, signs.width, signs.height, 0, gl.RED, gl.UNSIGNED_BYTE, signs.data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    /** the next quadrant painted, and the look the map was last painted in (a change paints it whole) */
    this.next = 0;
    this.painted = 0;
    this._key = '';
    this._quad = new Float32Array(4);
  }
  /** Paint the map's next quadrant (the whole map when it has never been painted or its look changed): `seconds` the
   *  realm's clock, `haze` the fog's colour, `look` `{ steps, ending: [r, g, b] | null, endingIdx }`, `viewport` the
   *  world viewport handed back. A DRAW PATH: binds its target, and hands back the frame's (render/renderTarget.js). */
  paint(seconds, haze, look, viewport) {
    const gl = this.gl, U = this.u, steps = look?.steps ?? SD_SKY_STEPS.lane, idx = look?.endingIdx ?? -1, light = look?.ending ?? null;
    const key = `${steps}|${idx}|${light?.join(',') ?? ''}|${haze?.join?.(',') ?? ''}`;
    const all = this.painted === 0 || key !== this._key;
    this._key = key;
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.uniform1f(U.uTime, sdSkyClock(seconds));
    gl.uniform3fv(U.uHaze, haze ?? [0.2, 0.15, 0.07]);
    gl.uniform1f(U.uSteps, steps);
    gl.uniform3fv(U.uEnding, light ?? [0, 0, 0]);
    gl.uniform1f(U.uEndingIdx, idx);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.signs); gl.uniform1i(U.uSigns, 0);
    gl.bindVertexArray(this.vao);
    withTarget(gl, this.target, viewport, () => {
      for (let k = 0; k < 4; k++) {
        if (!all && k !== this.next) continue;
        const qx = k & 1, qy = k >> 1, h = SD_SKY_MAP / 2;
        gl.viewport(qx * h, qy * h, h, h);
        this._quad[0] = qx * 0.5; this._quad[1] = qy * 0.5; this._quad[2] = 0.5; this._quad[3] = 0.5;
        gl.uniform4fv(U.uQuad, this._quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    });
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    this.next = (this.next + 1) & 3;
    this.painted++;
  }
  get texture() { return this.target.tex; }
  release() {
    const gl = this.gl;
    gl.deleteTexture(this.target.tex); gl.deleteFramebuffer(this.target.fbo); gl.deleteTexture(this.signs);
    gl.deleteProgram(this.program); gl.deleteVertexArray(this.vao);
  }
}

/** The Hour's sky, one foreign pass - the fetch over the map it owns. */
export class SdSkyRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, SD_SKY_VS, SD_SKY_FS, 'sd sky');
    this.u = {};
    for (const n of ['uRight', 'uUp', 'uFwd', 'uProj', 'uTime', 'uHaze', 'uGain', 'uSkyMap', 'uClock']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    /** whether the last draw put the sky up (the stats and the tests) */
    this.drawn = false;
    /** the frame's basis, filled in place (sdSkyBasisInto) */
    this._b = { right: new Float32Array(3), up: new Float32Array(3), fwd: new Float32Array(3), lens: new Float32Array(4) };
    /** SD-LOOK: the painted map (made with the pass; the Rift's window reads it too) and the fight's word to the face */
    this.map = new SdSkyMap(gl);
    this.clock = new Float32Array(4);
  }

  /** SD-LOOK: the map's next quadrant (SdSkyMap.paint) - before the draw, in the frame's own air. */
  paint(seconds, fog, look, viewport) { this.map.paint(seconds, fog?.color ?? null, look, viewport); }

  /** Paint the sky where nothing nearer has drawn: `seconds` the realm's clock (wrapped here), `fog` the frame's (its
   *  colour the haze the horizon meets), `gain` the realm's light against its own; `clock` the fight's word to the face
   *  ([SD_SKY_MODE, a0, a1, lit] - none by default). Answers true. */
  draw(proj, view, seconds, fog = null, gain = 1, clock = null) {
    const gl = this.gl, U = this.u, b = sdSkyBasisInto(view, proj, this._b);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.uniform3fv(U.uRight, b.right); gl.uniform3fv(U.uUp, b.up); gl.uniform3fv(U.uFwd, b.fwd); gl.uniform4fv(U.uProj, b.lens);
    gl.uniform1f(U.uTime, sdSkyClock(seconds));
    gl.uniform3fv(U.uHaze, fog?.color ?? [0.2, 0.15, 0.07]);
    gl.uniform1f(U.uGain, gain);
    for (let k = 0; k < 4; k++) this.clock[k] = clock?.[k] ?? 0;
    gl.uniform4fv(U.uClock, this.clock);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.map.texture); gl.uniform1i(U.uSkyMap, 0);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);   // PERF2: only where nothing nearer has drawn - z is the far plane
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    this.drawn = true;
    return true;
  }
}
