// @ts-check
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md sections 1 and 2): THE RIFT'S WINDOW AND ITS LIGHT ON
// THE FLOOR, and THE RETURN'S WINDOW HOME - one foreign pass (the gate membrane's law, render/gatePass.js: depth-tested,
// never written, fogged, both faces, every rate whole over its wrapped clock), drawn by the dungeon arm after the flats.
//
//   THE WINDOW - a disc in the ring's plane between the iris's leaves (world/sdRiftModel.js: the leaves shut it from both
//     sides by depth, so the aperture IS the state and leaves and window always agree). Each fragment snaps to a grid of
//     SD_WINDOW_CELLS across (chunky as the wall's texels) and looks down the eye's own ray through its point - true
//     parallax - turned into the ring's frame, so looking straight in from its front looks toward the Hour's +z where its
//     clock hangs: one tap of the Hour's own painted sky (render/sdSky.js SD_SKY_FETCH_GLSL - the very map the Hour
//     draws, hands and all). Gold filaments drag inward from the rim in a slow spiral and meet the brass at a white-gold
//     lip; a refusal clouds it to ember; a step through ripples it from the point of entry.
//   THE FLOOR LIGHT - a flat disc a hair over the floor about its foot, added on: its edge the hall's own (eight radii
//     from the stand's rays, so it stops at the walls), twelve hour ticks and six cracks seeping from the crater, the
//     gear's 36 teeth turning across it as spokes (a gobo, never a shadow), pulsed outward on each toll.
//   THE WAY BACK'S WINDOW (the Rift seen from the Hour's side, `window.hollow`) - the Hollow you came from: a dark hall of
//     coursed Daggerfall stone behind the ring, in true parallax (an INTERIOR MAPPING - the eye's ray met with the planes
//     of a room 6 m deep and 6 m wide that is not there), lit only from the front in the Rift's gold, cold and small, a
//     faint silver glow on its right wall where the Return stands. The stone is the code's own (the Hollow's textures
//     may be gone after the step) and is never a live view of the real hall.
//   THE RETURN'S WINDOW - its lancet opening, looking home: the Bay's sky at the hour of the world (day, dusk, night - the
//     game's clock, never the Hour's), slow pixel clouds, at night the stars and Masser and Secunda, and along its sill
//     the city the Hollow rose by, right way up, a few windows warm. It goes out by clouding over from the top.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from './orderedDither.js';
import { DEAD_NOISE_GLSL } from './deadlands.js';
import { SD_SKY_FETCH_GLSL, SD_SKYLINE_GLSL, sdSkyClock } from './sdSky.js';

/** The window's grid across its disc; the floor light's cell (m); the disc's and the floor's triangles. */
export const SD_WINDOW_CELLS = 128;
export const SD_FLOOR_CELL_M = 0.08;
export const SD_WINDOW_FAN = 48;
/** The way back's room behind its ring (m): its depth, its half-width, its ceiling over the floor; a stone texel and
 *  the courses (texels a course, texels a block). */
export const SD_HOLLOW_ROOM = Object.freeze({ deep: 9, half: 2.6, ceil: 3.8, texel: 0.0625, course: 8, block: 16 });
/** The window's magnification about the ring's heart, and its sky's gain over the Hour's own (a portal glows). */
export const SD_WINDOW_ZOOM = 2.6;
export const SD_WINDOW_GAIN = 1.5;
/** The floor light's bearings (its edge's radii) - the stand casts one ray each. */
export const SD_FLOOR_BEARINGS = 8;

const HEAD = `#version 300 es
precision highp float;
`;
const FOG_UNIFORMS = `uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
`;

export const SD_WINDOW_VS = HEAD + `layout(location = 0) in vec2 aDisc;
uniform mat4 uView, uProj, uModel;
uniform vec2 uSize;   // the opening's half-size across and up (m) - a disc's radius twice, an arch's own
out vec2 vDisc;
out vec3 vWorld;
void main() {
  vDisc = aDisc;
  vec4 w = uModel * vec4(aDisc * uSize, 0.0, 1.0);
  vWorld = w.xyz;
  gl_Position = uProj * uView * w;
}`;

/** The Rift's window. */
export const SD_WINDOW_FS = HEAD + `in vec2 vDisc;
in vec3 vWorld;
uniform mat4 uModel;
uniform mat3 uToLocal;   // the world's directions into the ring's frame
uniform vec2 uSize;
uniform vec3 uEye;
uniform float uLight;    // the state's light, 0..1
uniform float uEmber;    // a refusal's ember, 0..1
uniform vec4 uRipple;    // a step through: its point (disc coords), its strength, its age (s)
uniform float uSteps;
${FOG_UNIFORMS}out vec4 o;
${SD_SKY_FETCH_GLSL}${DEAD_NOISE_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}${FOG_FACTOR_GLSL}
const vec3 GOLD = vec3(1.0, 0.78, 0.4);
const vec3 HOUR_AIR = vec3(0.2, 0.15, 0.07);   // the Hour's own haze (world/sdRealm.js SD_REALM_FOG) - its air seen through
const vec3 LIP = vec3(1.0, 0.92, 0.62);
const vec3 EMBER = vec3(1.0, 0.376, 0.157);
// the window's ray at its point g (-1..1 across): a step through ripples it from its point, inward; then the eye's own ray
// through the point, MAGNIFIED about the ring's heart (a window into another place shows more of it than its opening
// would: the whole face from the hall, true parallax kept), turned into the ring's frame
vec3 windowRay(vec2 g) {
  vec2 rp = g - uRipple.xy;
  float wave = uRipple.z > 0.0 ? uRipple.z * exp(-uRipple.w * 2.5) * sin(length(rp) * 18.0 - uRipple.w * 14.0) * exp(-length(rp) * 2.0) : 0.0;
  vec3 wp = (uModel * vec4(g * uSize * (1.0 + 0.04 * wave), 0.0, 1.0)).xyz;
  vec3 rc = normalize((uModel * vec4(0.0, 0.0, 0.0, 1.0)).xyz - uEye), rw = normalize(wp - uEye);
  return uToLocal * normalize(rc + (rw - rc) * ${SD_WINDOW_ZOOM.toFixed(2)});
}
void main() {
  vec2 cell = floor((vDisc * 0.5 + 0.5) * ${SD_WINDOW_CELLS.toFixed(1)});
  vec2 g = (cell + 0.5) / ${SD_WINDOW_CELLS.toFixed(1)} * 2.0 - 1.0;
  float r = length(g);
  if (r > 1.0) discard;
  float ang = atan(g.x, g.y);
  vec3 ray = windowRay(g);
  vec3 col = sdSkyAt(ray) * ${SD_WINDOW_GAIN.toFixed(2)} + HOUR_AIR * (0.35 + 0.4 * r);
  // the gold dragged inward from the rim, spiralling slowly
  float lr = log(max(r, 1e-3));
  float flow = dnoise(vec2(ang * 3.0 + lr * 4.0 + uTime * 0.35, lr * 7.0 - uTime * 0.9)) * 0.6 + dnoise(vec2(ang * 7.0 - lr * 3.0, lr * 13.0 - uTime * 1.6)) * 0.4;
  float fil = step(0.68, flow) * smoothstep(0.55, 0.95, r);
  col = mix(col, GOLD * (0.55 + 0.45 * r), fil * 0.85);
  col = mix(col, LIP, step(0.955, r));
  col += GOLD * 0.35 * (1.0 - smoothstep(0.0, 0.32, r));   // the core
  col = mix(col, EMBER * (0.4 + 0.5 * dnoise(g * 6.0 + uTime)), uEmber * 0.85);
  col *= uLight;
  col = mix(uFogColor, col, fogFactorAt(vWorld));
  o = vec4(sdPixel(col, cell, uSteps), 1.0);
}`;

/** The way back's window: the Hollow's hall behind the ring, interior-mapped. */
export const SD_HOLLOW_FS = HEAD + `in vec2 vDisc;
in vec3 vWorld;
uniform mat4 uModel;
uniform mat3 uToLocal;
uniform vec2 uSize;
uniform vec3 uEye;
uniform float uFloor;    // the floor under the ring's heart, in the ring's frame (m, below it)
uniform float uLight;
uniform float uTime;
uniform float uSteps;
${FOG_UNIFORMS}out vec4 o;
${DEAD_NOISE_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}${FOG_FACTOR_GLSL}
const vec3 GOLD = vec3(1.0, 0.78, 0.4);
const vec3 LIP = vec3(1.0, 0.92, 0.62);
const vec3 MOON = vec3(0.85, 0.9, 1.0);
// the classic dungeon's brown stone, three tones and its mortar
const vec3 STONE0 = vec3(0.32, 0.25, 0.18), STONE1 = vec3(0.4, 0.31, 0.22), STONE2 = vec3(0.26, 0.2, 0.15), MORTAR = vec3(0.12, 0.09, 0.07);
// a face of coursed stone at (u, v) metres: courses SD_HOLLOW_ROOM.course texels high, blocks .block long, every other
// course half a block over, a 1-texel joint; three tones by hash, a little grain
vec3 stone(vec2 uv, float seed) {
  vec2 tx = floor(uv / ${SD_HOLLOW_ROOM.texel.toFixed(4)});
  float row = floor(tx.y / ${SD_HOLLOW_ROOM.course.toFixed(1)});
  float col = floor((tx.x + mod(row, 2.0) * ${(SD_HOLLOW_ROOM.block / 2).toFixed(1)}) / ${SD_HOLLOW_ROOM.block.toFixed(1)});
  float jx = mod(tx.x + mod(row, 2.0) * ${(SD_HOLLOW_ROOM.block / 2).toFixed(1)}, ${SD_HOLLOW_ROOM.block.toFixed(1)}), jy = mod(tx.y, ${SD_HOLLOW_ROOM.course.toFixed(1)});
  if (jx < 1.0 || jy < 1.0) return MORTAR;
  float h = dhash(vec2(col, row) + seed);
  vec3 c = h < 0.33 ? STONE0 : h < 0.66 ? STONE1 : STONE2;
  if (jy > ${(SD_HOLLOW_ROOM.course - 1.5).toFixed(1)}) c *= 1.18;   // each block's top edge catches the light
  return c * (0.88 + 0.24 * dhash(tx * 0.37 + seed));
}
// the eye's ray into the room behind the ring (+z, away from the eye), and where it meets the room: its colour there
vec3 hollowAt(vec2 g) {
  vec3 o3 = vec3(g * uSize, 0.0);
  vec3 e = uToLocal * (uEye - (uModel * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
  vec3 wp = (uModel * vec4(g * uSize, 0.0, 1.0)).xyz;
  vec3 d = uToLocal * normalize(wp - uEye);
  if (e.z > 0.0) { d.z = -d.z; d.x = -d.x; }   // the room is always behind the ring as the eye stands (its right the eye's right)
  d.z = max(d.z, 0.05);
  float W = ${SD_HOLLOW_ROOM.half.toFixed(2)}, D = ${SD_HOLLOW_ROOM.deep.toFixed(2)}, F = -uFloor, C = -uFloor + ${SD_HOLLOW_ROOM.ceil.toFixed(2)};
  float tx = ((d.x > 0.0 ? W : -W) - o3.x) / (abs(d.x) < 1e-4 ? 1e-4 : d.x);
  float ty = ((d.y > 0.0 ? C : F) - o3.y) / (abs(d.y) < 1e-4 ? 1e-4 : d.y);
  float tz = (D - o3.z) / d.z;
  float t = min(tx, min(ty, tz));
  vec3 h = o3 + d * t;
  vec3 c;
  float face;   // the face's light from the front: walls and the floor lit, the ceiling least
  if (t == tz) {
    c = stone(vec2(h.x + 7.0, h.y - F), 1.0); face = 1.0;
    // a doorway in the far wall, round-headed, black beyond: the hall goes on
    vec2 dq = vec2(h.x, h.y - F);
    if (abs(dq.x) < 0.8 && (dq.y < 2.0 || length(vec2(dq.x, dq.y - 2.0)) < 0.8)) c = vec3(0.015, 0.012, 0.01);
    else if (abs(dq.x) < 0.95 && (dq.y < 2.0 || length(vec2(dq.x, dq.y - 2.0)) < 0.95)) c *= 1.35;   // its dressed jambs
  }
  else if (t == tx) { c = stone(vec2(h.z, h.y - F), d.x > 0.0 ? 2.0 : 3.0); face = 0.8; }
  else if (d.y < 0.0) { c = stone(vec2(h.x * 0.5 + 9.0, h.z * 2.0), 4.0) * 0.9; face = 0.9; }
  else { c = stone(vec2(h.x, h.z), 5.0) * 0.6; face = 0.4; }
  // lit only from the front, in the Rift's gold, falling off into the dark; the Return's silver on the right wall
  float fall = 1.0 / (1.0 + h.z * h.z * 0.06);
  vec3 lit = c * GOLD * (0.3 + 1.5 * fall * face);
  if (t == tx && d.x > 0.0) {
    vec2 q = vec2((h.z - 4.5) / 1.3, (h.y - F - 1.6) / 1.6);
    lit += c * MOON * 1.1 * (1.0 - smoothstep(0.0, 1.0, length(q)));
  }
  return lit;
}
void main() {
  vec2 cell = floor((vDisc * 0.5 + 0.5) * ${SD_WINDOW_CELLS.toFixed(1)});
  vec2 g = (cell + 0.5) / ${SD_WINDOW_CELLS.toFixed(1)} * 2.0 - 1.0;
  float r = length(g);
  if (r > 1.0) discard;
  vec3 col = hollowAt(g);
  // the ring's own gold at its rim, the white-gold lip, as the Rift's
  float ang = atan(g.x, g.y), lr = log(max(r, 1e-3));
  float fil = step(0.7, dnoise(vec2(ang * 3.0 - lr * 4.0 - uTime * 0.35, lr * 7.0 + uTime * 0.9))) * smoothstep(0.7, 0.98, r);
  col = mix(col, GOLD * 0.8, fil * 0.7);
  col = mix(col, LIP, step(0.955, r));
  col *= uLight;
  col = mix(uFogColor, col, fogFactorAt(vWorld));
  o = vec4(sdPixel(col, cell, uSteps), 1.0);
}`;

/** The floor light, in the ring's foot frame: x across, z through (the disc's own xy - see the VS, laid flat). */
export const SD_FLOOR_VS = HEAD + `layout(location = 0) in vec2 aDisc;
uniform mat4 uView, uProj, uModel;
uniform float uReach;
out vec2 vP;
out vec3 vWorld;
void main() {
  vP = aDisc * uReach;
  vec4 w = uModel * vec4(vP.x, 0.02, vP.y, 1.0);
  vWorld = w.xyz;
  gl_Position = uProj * uView * w;
}`;
export const SD_FLOOR_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
uniform float uRadii[${SD_FLOOR_BEARINGS}];   // the hall's edge along each bearing (m), the first along +x, turning toward +z
uniform float uCrater;   // the crater's rim (m) - the light seeps from it
uniform float uGear;     // the gear's turn (radians)
uniform float uPulse;    // the toll's wave: how far out it has run (m), < 0 none
uniform vec3 uColor;     // the light's colour at its state
uniform float uSteps;
${FOG_UNIFORMS}out vec4 o;
${DEAD_NOISE_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}${FOG_FACTOR_GLSL}
const float TAU = 6.283185307179586;
void main() {
  vec2 cell = floor(vP / ${SD_FLOOR_CELL_M.toFixed(3)});
  vec2 p = (cell + 0.5) * ${SD_FLOOR_CELL_M.toFixed(3)};
  float r = length(p), a = mod(atan(p.y, p.x) + TAU, TAU);
  float f = a / TAU * ${SD_FLOOR_BEARINGS.toFixed(1)};
  int i0 = int(floor(f)) % ${SD_FLOOR_BEARINGS}, i1 = (i0 + 1) % ${SD_FLOOR_BEARINGS};
  float edge = mix(uRadii[i0], uRadii[i1], fract(f));
  if (r > edge || r < uCrater * 0.85) discard;
  float t = (r - uCrater) / max(edge - uCrater, 0.1);
  float base = 0.32 * (1.0 - smoothstep(0.0, 1.0, t)) * (1.0 - smoothstep(0.85, 1.0, r / edge));
  // twelve hour ticks seeping from the crater, and six cracks running to the walls
  float ha = mod(atan(p.x, p.y) + TAU, TAU);
  float tick = step(abs(fract(ha / TAU * 12.0 + 0.5) - 0.5), 0.035) * (1.0 - smoothstep(0.0, 0.45, t));
  float jag = (dnoise(vec2(r * 2.2, 3.0)) - 0.5) * 0.12;
  float crack = step(abs(fract((ha + jag) / TAU * 6.0 + 0.25) - 0.5), 0.012 + 0.01 * (1.0 - t));
  // the gear's teeth turning across it - a gobo of 36 spokes
  float spoke = 0.55 + 0.45 * step(0.5, fract((ha - uGear) / TAU * 36.0));
  float pulse = uPulse > 0.0 ? exp(-(r - uPulse) * (r - uPulse) * 3.0) * (1.0 - smoothstep(0.0, 1.0, uPulse / max(edge, 0.1))) : 0.0;
  float k = (base * spoke + 0.45 * tick + 0.35 * crack * (1.0 - t * 0.6)) + 0.25 * pulse;
  vec3 col = uColor * k * fogFactorAt(vWorld);
  o = vec4(sdPixel(col, cell, uSteps), 1.0);
}`;

/** The Return's window home: the Bay's sky at the world's hour, its clouds, its moons, its city on the sill. */
export const SD_BAY_FS = HEAD + `in vec2 vDisc;
in vec3 vWorld;
uniform vec2 uSize;
uniform float uHour;     // the game's hour, 0..24
uniform float uClouds;   // the clouds' drift (s)
uniform float uFade;     // its going out, 0 (clear) .. 1 (clouded over)
uniform float uSteps;
${FOG_UNIFORMS}out vec4 o;
${DEAD_NOISE_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}${FOG_FACTOR_GLSL}${SD_SKYLINE_GLSL}
const vec3 DAY_LO = vec3(0.361, 0.549, 0.824);
const vec3 DAY_HI = vec3(0.588, 0.745, 0.922);
const vec3 DUSK_LO = vec3(0.824, 0.471, 0.235);
const vec3 DUSK_HI = vec3(0.353, 0.235, 0.431);
const vec3 NIGHT = vec3(0.055, 0.078, 0.173);
void main() {
  vec2 cell = floor((vDisc * 0.5 + 0.5) * vec2(48.0, 80.0));
  vec2 g = (cell + 0.5) / vec2(48.0, 80.0);   // 0..1 across, 0..1 up
  // the hour: day 7-17, dusk 17-20 and 5-7, night otherwise
  float h = mod(uHour, 24.0);
  float day = smoothstep(5.5, 7.5, h) * (1.0 - smoothstep(17.0, 19.0, h));
  float dusk = (smoothstep(4.5, 6.0, h) * (1.0 - smoothstep(6.0, 7.5, h))) + (smoothstep(16.5, 18.0, h) * (1.0 - smoothstep(19.0, 20.5, h)));
  vec3 sky = mix(DAY_LO, DAY_HI, g.y) * day + mix(DUSK_LO, DUSK_HI, g.y) * dusk;
  float night = clamp(1.0 - day - dusk, 0.0, 1.0);
  sky += NIGHT * night;
  // the clouds: two sheets of value noise on the window's grid
  float c = dnoise(vec2(g.x * 5.0 + uClouds * 0.02, g.y * 3.0)) * 0.6 + dnoise(vec2(g.x * 11.0 - uClouds * 0.035, g.y * 6.0 + 3.0)) * 0.4;
  float cloud = step(0.62, c) * (0.4 + 0.6 * g.y);
  sky = mix(sky, mix(vec3(0.85, 0.86, 0.9), vec3(0.3, 0.3, 0.4), night) * (0.6 + 0.4 * day), cloud * 0.8);
  // at night the stars, red Masser and pale Secunda
  if (night > 0.3) {
    if (dhash(cell * 0.71 + 3.1) > 0.985) sky += vec3(0.8, 0.82, 0.9) * night;
    if (length((g - vec2(0.3, 0.72)) * vec2(1.0, 1.66)) < 0.11) sky = mix(sky, vec3(0.85, 0.3, 0.25), night);
    if (length((g - vec2(0.68, 0.8)) * vec2(1.0, 1.66)) < 0.065) sky = mix(sky, vec3(0.85, 0.86, 0.9), night);
  }
  // the city along the sill, right way up: Daggerfall's towers (v down from their tops reads up the window)
  if (g.y < 0.42) {
    float v = g.y / 0.42;   // up from the sill: the ground along it, the towers rising, their spires
    float m = skyline0(g.x * 2.0 - 1.0, v);
    vec3 town = vec3(0.04, 0.035, 0.05);
    if (m > 0.5 && g.y > 0.05 && fract(g.y * 40.0) < 0.5 && fract(g.x * 24.0) < 0.5 && dhash(floor(vec2(g.x * 24.0, g.y * 40.0)) + 7.0) > 0.78) town = vec3(1.0, 0.7, 0.32) * (0.4 + 0.6 * night);
    sky = mix(sky, town, m);
  }
  // going out: clouded over from the top, in a dither
  float fade = step(1.0 - uFade * 1.15 + bayer4(cell) * 0.15, g.y);
  sky = mix(sky, vec3(0.22, 0.22, 0.24), fade);
  sky = mix(uFogColor, sky, fogFactorAt(vWorld));
  o = vec4(sdPixel(sky * 0.85, cell, uSteps), 1.0);
}`;

/** A fan of `n` triangles over the unit disc (-1..1), as xy pairs. */
function discFan(n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    out.push(0, 0, Math.sin(a0), Math.cos(a0), Math.sin(a1), Math.cos(a1));
  }
  return new Float32Array(out);
}
/** The Return's opening as a fan over -1..1 (its sill at y -1, its apex at +1): `outline` the opening's edge in
 *  (x, y) of the arch's own frame and `size` its half-size. */
export function archFan(outline, half) {
  const out = [], cx = 0, cy = 0;
  for (let k = 0; k + 1 < outline.length; k++) {
    const a = outline[k], b = outline[k + 1];
    out.push(cx, cy, a[0] / half[0], a[1] / half[1], b[0] / half[0], b[1] / half[1]);
  }
  return new Float32Array(out);
}

const FOGS = ['uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFogColor'];
function bindFog(gl, U, fog) {
  gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
  gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
  gl.uniform2fv(U.uFogRange, fog?.range ?? [0, 1]);
  gl.uniform3fv(U.uCamPos, fog?.camPos ?? [0, 0, 0]);
  gl.uniform3fv(U.uFogColor, fog?.color ?? [0, 0, 0]);
}

/** The pass: the window, the floor light and the Return's window. */
export class SdRiftRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const mk = (vs, fs, label, names) => { const prog = buildProgram(gl, vs, fs, label), u = {}; for (const n of names) u[n] = gl.getUniformLocation(prog, n); return { prog, u }; };
    this.win = mk(SD_WINDOW_VS, SD_WINDOW_FS, 'sd rift window', ['uView', 'uProj', 'uModel', 'uSize', 'uToLocal', 'uEye', 'uLight', 'uEmber', 'uRipple', 'uSteps', 'uSkyMap', 'uTime', 'uGain', 'uClock', ...FOGS]);
    this.floor = mk(SD_FLOOR_VS, SD_FLOOR_FS, 'sd rift floor', ['uView', 'uProj', 'uModel', 'uReach', 'uRadii', 'uCrater', 'uGear', 'uPulse', 'uColor', 'uSteps', ...FOGS]);
    this.bay = mk(SD_WINDOW_VS, SD_BAY_FS, 'sd return window', ['uView', 'uProj', 'uModel', 'uSize', 'uHour', 'uClouds', 'uFade', 'uSteps', ...FOGS]);
    this.hollow = mk(SD_WINDOW_VS, SD_HOLLOW_FS, 'sd way back window', ['uView', 'uProj', 'uModel', 'uSize', 'uToLocal', 'uEye', 'uFloor', 'uLight', 'uTime', 'uSteps', ...FOGS]);
    const vao = (data) => {
      const v = gl.createVertexArray();
      gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindVertexArray(null);
      return { vao: v, count: data.length / 2 };
    };
    this.disc = vao(discFan(SD_WINDOW_FAN));
    this._arches = new Map();
    this._vao = vao;
    this._radii = new Float32Array(SD_FLOOR_BEARINGS);
    this._size = new Float32Array(2);
    this.drawn = 0;
  }
  /** The Return's opening's fan, made once for its outline. */
  archOf(key, outline, half) {
    let a = this._arches.get(key);
    if (!a) { a = this._vao(archFan(outline, half)); this._arches.set(key, a); }
    return a;
  }
  _common(U, proj, view, model, fog) {
    const gl = this.gl;
    gl.uniformMatrix4fv(U.uView, false, view); gl.uniformMatrix4fv(U.uProj, false, proj); gl.uniformMatrix4fv(U.uModel, false, model);
    bindFog(gl, U, fog);
  }
  /**
   * Draw what `look` asks: `{ window?: { model, toLocal, radius, eye, light, ember, ripple, sky: { map, seconds, gain,
   * clock }, hollow?: { floor } }, floor?: { model, reach, radii, crater, gear, pulse, color }, bay?: { model, key, outline, half, hour,
   * clouds, fade } }` - each in the frame's fog, at the pixel law's `steps`. Answers whether anything drew.
   */
  draw(proj, view, look, fog = null, steps = 10) {
    const gl = this.gl;
    let n = 0;
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    if (look.window?.hollow) {
      // the way back's window: the Hollow's hall behind the ring
      const w = look.window, P = this.hollow, U = P.u;
      gl.disable(gl.BLEND);
      gl.useProgram(P.prog);
      this._common(U, proj, view, w.model, fog);
      this._size[0] = this._size[1] = w.radius;
      gl.uniform2fv(U.uSize, this._size);
      gl.uniformMatrix3fv(U.uToLocal, false, w.toLocal);
      gl.uniform3fv(U.uEye, w.eye);
      gl.uniform1f(U.uFloor, w.hollow.floor); gl.uniform1f(U.uLight, w.light ?? 1);
      gl.uniform1f(U.uTime, sdSkyClock(w.sky?.seconds ?? 0)); gl.uniform1f(U.uSteps, steps);
      gl.bindVertexArray(this.disc.vao);
      gl.drawArrays(gl.TRIANGLES, 0, this.disc.count);
      n++;
    } else if (look.window?.sky?.map) {
      const w = look.window, P = this.win, U = P.u;
      gl.disable(gl.BLEND);
      gl.useProgram(P.prog);
      this._common(U, proj, view, w.model, fog);
      this._size[0] = this._size[1] = w.radius;
      gl.uniform2fv(U.uSize, this._size);
      gl.uniformMatrix3fv(U.uToLocal, false, w.toLocal);
      gl.uniform3fv(U.uEye, w.eye);
      gl.uniform1f(U.uLight, w.light ?? 1); gl.uniform1f(U.uEmber, w.ember ?? 0);
      gl.uniform4fv(U.uRipple, w.ripple ?? [0, 0, 0, 9]);
      gl.uniform1f(U.uSteps, steps);
      gl.uniform1f(U.uTime, sdSkyClock(w.sky.seconds)); gl.uniform1f(U.uGain, w.sky.gain ?? 1); gl.uniform4fv(U.uClock, w.sky.clock ?? [0, 0, 0, 0]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, w.sky.map); gl.uniform1i(U.uSkyMap, 0);
      gl.bindVertexArray(this.disc.vao);
      gl.drawArrays(gl.TRIANGLES, 0, this.disc.count);
      n++;
    }
    if (look.bay) {
      const b = look.bay, P = this.bay, U = P.u, arch = this.archOf(b.key, b.outline, b.half);
      gl.disable(gl.BLEND);
      gl.useProgram(P.prog);
      this._common(U, proj, view, b.model, fog);
      this._size[0] = b.half[0]; this._size[1] = b.half[1];
      gl.uniform2fv(U.uSize, this._size);
      gl.uniform1f(U.uHour, b.hour ?? 12); gl.uniform1f(U.uClouds, b.clouds ?? 0); gl.uniform1f(U.uFade, b.fade ?? 0);
      gl.uniform1f(U.uSteps, steps);
      gl.bindVertexArray(arch.vao);
      gl.drawArrays(gl.TRIANGLES, 0, arch.count);
      n++;
    }
    if (look.floor) {
      const f = look.floor, P = this.floor, U = P.u;
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(P.prog);
      this._common(U, proj, view, f.model, fog);
      for (let k = 0; k < SD_FLOOR_BEARINGS; k++) this._radii[k] = f.radii?.[k] ?? f.reach;
      gl.uniform1f(U.uReach, f.reach); gl.uniform1fv(U.uRadii, this._radii); gl.uniform1f(U.uCrater, f.crater);
      gl.uniform1f(U.uGear, f.gear ?? 0); gl.uniform1f(U.uPulse, f.pulse ?? -1); gl.uniform3fv(U.uColor, f.color); gl.uniform1f(U.uSteps, steps);
      gl.bindVertexArray(this.disc.vao);
      gl.drawArrays(gl.TRIANGLES, 0, this.disc.count);
      gl.disable(gl.BLEND);
      n++;
    }
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.enable(gl.CULL_FACE);
    this.drawn = n;
    return n > 0;
  }
}
