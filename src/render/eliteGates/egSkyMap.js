// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 6):
// THE SPIRE'S SKIES, PAINTED - each band's realm in an octahedral map, SD5b's law (render/superDungeon/sdSky.js SdSkyMap): an
// EG_SKY_MAP x EG_SKY_MAP picture of the whole sky, one texel about 0.35 degrees (Daggerfall's own sky is pi/512 a pixel),
// NEAREST, painted a quadrant a frame by THE BAND'S PAINTER (its own fragment shader - EG_SKY_PAINT_FS[band]), every
// texel through the pixel law (render/orderedDither.js SD_PIXEL_GLSL), fetched by one triangle at the far plane
// (render/eliteGates/egSkyPass.js) at the band's gain against its fog. Four realms, the halls fallen through them:
//   THE DEADLANDS over the Broken Galleries - a blood-red sky under a lid of ash lit from beneath, the fire-sea below the
//     horizon with its slow bright currents, black volcano spires standing out of the haze, a vent's fire on the tallest;
//   THE SOUL CAIRN - violet-black, thick with soul-stars (cold white and cyan, crowding in a stream of the dead across the
//     sky), a pale soul-aurora, and below a sea of mist rolling outward in slow banded swells to the horizon, black
//     cairns of stacked stones standing out of it;
//   THE EVERGLOAM over the Shade Perilous - near-black, a HUGE low moon on the key light's own bearing (world/eliteGates/egAtmos.js:
//     the moon IS the light) with its seas and craters and a cold halo, a scatter of stars, a thin silver aurora, black
//     glass thorns against its lower limb, and below the dark with silver mist glinting, the moon's glade across it;
//   THE HAVOC WELLHEAD - a red-orange sky under heavy ash lit from below, the crater's basalt cliffs round the line,
//     eruption columns standing on its rim and churning up into the ash, the magma lake below with its crust plates.
// THE HORIZON IS THE FOG: every layer is hazed by one law (EG_SKY_HAZE) that keeps all of the band's fog colour on the line
// itself, so the far wreck (world/eliteGates/egVista.js) melts into the sky it stands against. The map is painted in the band's own
// air (world/eliteGates/egAtmos.js - its fog and its sky's colours, never the frame's), and the fetch scales it by the gain the host
// hands (render/deadlands.js skyGain - the lane's dungeon fog against the band's), so the line meets the frame's fog on
// both lanes. THE SPIRE'S UNDERSIDE is not painted: it is the wreck's model (one underside, never two).
// Only slow drifts are live, and only through the paint (a quadrant a frame - each moves under a texel between refreshes):
// the ash, the currents, the aurorae, the swells, the mist, the plumes - every one a whole number of cycles over
// EG_SKY_PERIOD on the sky's clock (the Hour's - world.js hands deadlandsSeconds), so the sky never jumps.
//
// THE PIXEL LAW on the eye's own ramp: each texel's colour is posterized through sdPixel in the square root of its value
// and squared back (a palette's ramp, its dark steps close - Daggerfall's sky's own), so the void dithers between dark
// steps instead of speckling black with the first step's dots; every texel still goes through SD_PIXEL_GLSL.
//
// A foreign pass's map: it owns its target and its painters (built a band at a time, kept for the breach); `release()`
// frees all of it. Not a DFU member. Ledger A (ELITE-GATES).
import { buildProgram } from '../glProgram.js';
import { DEAD_NOISE_GLSL } from '../deadlands.js';
import { createRenderTarget, withTarget } from '../renderTarget.js';
import { SD_OCT_GLSL, SD_SKY_PERIOD, SD_SKY_STEPS } from '../superDungeon/sdSky.js';
import { egAtmosOf } from '../../world/eliteGates/egAtmos.js';

/** The map's side (texels): the Hour's. */
export const EG_SKY_MAP = 512;
/** Every live drift is whole cycles over this many seconds - the Hour's sky period, one clock. */
export const EG_SKY_PERIOD = SD_SKY_PERIOD;
/** The sky's clock wrapped to the period (in double, before it reaches a float). */
export const egSkyClock = (seconds) => ((seconds % EG_SKY_PERIOD) + EG_SKY_PERIOD) % EG_SKY_PERIOD;
/** The pixel law's steps on the lane and on the classic set (SD-LOOK's). */
export const EG_SKY_STEPS = SD_SKY_STEPS;
/** THE HORIZON LAW, a band a row: how fast the fog gives way above the line and below it (1/rad) - a ray at elevation e
 *  keeps exp(-|e| k) of the fog, all of it on the line. The far landmarks are hazed by the same law at `far` of their
 *  elevation (they stand further off than the sky's own glow). */
export const EG_SKY_HAZE = Object.freeze([
  Object.freeze({ up: 16, down: 7, far: 0.6 }),
  Object.freeze({ up: 11, down: 4.5, far: 0.5 }),
  Object.freeze({ up: 14, down: 6, far: 0.5 }),
  Object.freeze({ up: 10, down: 6, far: 0.5 }),
]);
/** EG_SKY_HAZE's law in JS: the share of the fog a ray at elevation `e` (rad) keeps in band `band`. Pure - the painters'. */
export function egSkyHaze(band, e) { const H = EG_SKY_HAZE[band]; return e >= 0 ? Math.exp(-e * H.up) : Math.exp(e * H.down); }
/** THE LIVE DRIFTS, whole cycles a period, a band a row (the painters read them): the ash lid's loop, the fire-sea's
 *  and the magma lake's loop, the currents' pulses, a vent's smoke and the plumes' churn, the aurorae, the swells, the
 *  mist, the stars' breath and the mist's glints. */
export const EG_SKY_DRIFT = Object.freeze([
  Object.freeze({ ash: 1, sea: 1, pulse: 6, smoke: 9 }),
  Object.freeze({ stream: 1, aurora: 2, swell: 5, mist: 1, breath: 3 }),
  Object.freeze({ aurora: 2, mist: 1, glint: 9 }),
  Object.freeze({ ash: 1, lake: 1, lava: 4, plume: 8 }),
]);
/** THE DEADLANDS' VOLCANO SPIRES: azimuth (rad from +z toward +x), the crag's elevation, the foot's half-width (rad), a
 *  vent burning at its crag (1). */
export const EG_SKY_SPIRES = Object.freeze([
  [0.42, 0.22, 0.065, 1], [0.78, 0.1, 0.036, 0], [0.12, 0.07, 0.026, 0], [1.6, 0.13, 0.05, 0], [2.35, 0.2, 0.06, 1], [3.0, 0.09, 0.035, 0],
  [-0.5, 0.14, 0.048, 0], [-0.82, 0.08, 0.03, 0], [-1.25, 0.17, 0.055, 1], [-2.05, 0.11, 0.04, 0], [-2.7, 0.065, 0.028, 0],
].map((s) => Object.freeze(s)));
/** THE SOUL CAIRN'S CAIRNS on the mist's line: azimuth, the top's elevation, the foot's half-width, a seed (its stones). */
export const EG_SKY_CAIRNS = Object.freeze([
  [0.3, 0.06, 0.008, 1], [0.95, 0.045, 0.007, 2], [1.9, 0.07, 0.009, 3], [2.8, 0.05, 0.007, 4], [-0.7, 0.055, 0.008, 5], [-1.6, 0.04, 0.006, 6], [-2.4, 0.065, 0.009, 7],
].map((s) => Object.freeze(s)));
/** THE SOUL-STREAM's pole (the stars crowd along the great circle about it). */
export const EG_SKY_STREAM = Object.freeze((() => { const v = [0.35, 0.25, -0.9], l = Math.hypot(...v); return v.map((x) => x / l); })());
/** THE EVERGLOAM'S MOON: its bearing - THE SHADE'S KEY LIGHT'S own (world/eliteGates/egAtmos.js: "a cold silver key from the
 *  moon's bearing" - the key's azimuth, toward the light), so the moon hangs where the light falls from; its elevation
 *  (rad - low: its lower limb a few degrees over the line, where every hall's view sees it) and its angular radius: huge.
 *  `dir` its centre's direction. */
export const EG_SKY_MOON = Object.freeze((() => {
  const k = egAtmosOf(2).key.dir, az = Math.atan2(k[0], k[2]), elev = 0.3;
  return { az, elev, r: 0.21, dir: Object.freeze([Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)]) };
})());
/** The moon's craters on its face (u right, v up, its radius 1): centre, radius, rays (1: a young crater's bright rays). */
export const EG_SKY_CRATERS = Object.freeze([
  [-0.35, 0.3, 0.2, 0], [0.42, -0.2, 0.16, 1], [0.1, -0.55, 0.11, 0], [-0.52, -0.36, 0.09, 0], [0.32, 0.5, 0.12, 0], [0.64, 0.22, 0.07, 0], [-0.1, 0.05, 0.06, 0], [-0.72, 0.04, 0.08, 0],
].map((s) => Object.freeze(s)));
/** THE EVERGLOAM'S THORNS: black glass spines standing up against the moon's lower limb - azimuth off the moon's, the
 *  tip's elevation, the foot's half-width, how far the tip bends (rad). */
export const EG_SKY_THORNS = Object.freeze([
  [-0.13, 0.33, 0.012, 0.03], [0.04, 0.22, 0.009, -0.02], [0.16, 0.29, 0.011, -0.04], [-0.3, 0.14, 0.008, 0.02], [0.33, 0.12, 0.007, -0.015],
].map((s) => Object.freeze(s)));
/** THE WELLHEAD'S CRATER: its basalt columns round the line (a whole number - no seam at the back), the cliffs' foot
 *  height and how much higher they rise (rad). */
export const EG_SKY_CRATER = Object.freeze({ columns: 720, base: 0.035, rise: 0.06 });
/** THE WELLHEAD'S ERUPTIONS, standing on the crater's rim: azimuth, the fountain's half-width, the plume's top (its
 *  elevation), how wide the plume spreads at its top (rad). */
export const EG_SKY_ERUPTIONS = Object.freeze([
  [0.55, 0.012, 0.42, 0.34], [-0.9, 0.009, 0.32, 0.28], [2.4, 0.014, 0.48, 0.4], [-2.6, 0.008, 0.26, 0.26],
].map((s) => Object.freeze(s)));

const f4 = (v) => v.toFixed(4);
const v3 = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
const vec4s = (name, rows) => `const vec4 ${name}[${rows.length}] = vec4[${rows.length}](${rows.map((r) => `vec4(${r.map(f4).join(', ')})`).join(', ')});`;
const turns = (k) => `${Number(k).toFixed(1)}`;

/** The paint's vertex stage: the quadrant painted (`uQuad` - its corner and its size on the map, 0..1). */
export const EG_SKY_PAINT_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
uniform vec4 uQuad;
out vec2 vUv;
const float HALF = 0.5;
void main() { vUv = uQuad.xy + (aPos * HALF + HALF) * uQuad.zw; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** Every painter's head: its band's haze law and colours, the noise, the octahedral decode, the drifts. */
function paintHead(band) {
  const A = egAtmosOf(band), H = EG_SKY_HAZE[band];
  return `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;    // the sky's clock, wrapped to the period
out vec4 o;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
const float PERIOD = ${EG_SKY_PERIOD.toFixed(1)};
const float MAP = ${EG_SKY_MAP.toFixed(1)};
const float HAZE_UP = ${f4(H.up)};
const float HAZE_DOWN = ${f4(H.down)};
const float HAZE_FAR = ${f4(H.far)};
const vec3 ZEN = ${v3(A.sky.zenith)};
const vec3 HOR = ${v3(A.sky.horizon)};
const vec3 DEEP = ${v3(A.sky.deep)};
const vec3 GLOW = ${v3(A.sky.glow)};
${DEAD_NOISE_GLSL}${SD_OCT_GLSL}
float wrapPi(float a) { return mod(a + PI, TAU) - PI; }
// k whole cycles a period, as an angle - every live drift is one
float spin(float k) { return TAU * k * uTime / PERIOD; }
// a drift round a closed loop of radius r, k times a period: it comes home
vec2 orbit(float k, float r) { float a = spin(k); return vec2(cos(a), sin(a)) * r; }
// THE ENDLESS FLOW: noise slid along dir by len a cycle, k cycles a period, two layers half a cycle apart crossfaded (the
// Deadlands' falls' law) - it never jumps
float flowNoise(vec2 p, vec2 dir, float len, float k) {
  float ph = fract(k * uTime / PERIOD), ph2 = fract(ph + 0.5);
  float a = dnoise(p + dir * ph * len), b = dnoise(p + dir * ph2 * len + 31.7);
  return mix(b, a, 1.0 - abs(2.0 * ph - 1.0));
}
// THE HORIZON LAW: the share of the fog a ray at elevation e keeps - all of it on the line
float hazeAt(float e) { return e >= 0.0 ? exp(-e * HAZE_UP) : exp(e * HAZE_DOWN); }
// a far landmark's: hazier than the sky's own glow at its elevation, all fog on the line
float hazeFar(float e) { return hazeAt(e * HAZE_FAR); }
// where a ray meets a deck over the eye or a sea under it (its own units)
vec2 deckAt(vec3 d, float lift) { return d.xz / (abs(d.y) + lift); }
// four hard steps - Deluxe Paint's bands (the fetch's pixel law dithers between them, on the sky's own cells)
float band4(float k) { return floor(clamp(k, 0.0, 1.0) * 4.0 + 0.5) / 4.0; }
`;
}
// every painter's foot: the texel's direction, and what it holds - the realm's colour behind the haze (kept in its square
// root - the dark steps the 8 bits hold close), and the share of the fog in front of it (the fetch mixes the frame's own
// fog in by it, and lays the pixel law over the whole)
const PAINT_MAIN = `
vec4 paintTexel(vec2 cell) {
  vec4 c = skyAt(octDecode((cell + 0.5) / MAP), cell);
  return vec4(sqrt(max(c.rgb, vec3(0.0))), c.a);
}
void main() { o = paintTexel(floor(vUv * MAP)); }`;
// the ash lid's thickness where a ray meets it (the Deadlands' and the Wellhead's)
const LID_GLSL = `float lidAt(vec2 p) { vec2 w = vec2(dfbm(p * 0.45 + 3.1, 3), dfbm(p * 0.45 + 7.7, 3)); return dfbm(p * 0.85 + w * 1.7, 5); }
`;

// ── THE DEADLANDS (the Broken Galleries) ──────────────────────────────────────────────────────────────────────────────
function deadlandsFs() {
  const S = /** @type {any} */ (egAtmosOf(0).sky), D = /** @type {any} */ (EG_SKY_DRIFT[0]);
  return paintHead(0) + `const vec3 LID = ${v3(S.lid)};
const vec3 LIT = ${v3(S.lit)};
const vec3 ROCK = ${v3(S.rock)};
${vec4s('SPIRE', EG_SKY_SPIRES)}
${LID_GLSL}
// a volcano spire s at (az, e): 1 in its rock, a crooked cone with crags, leaning; wd its half-width there
float spireAt(vec4 s, float dx, float e, out float wd) {
  float h = clamp(e / s.y, 0.0, 1.0);
  float crag = 0.7 + 0.6 * dnoise(vec2(floor(e * 70.0), s.x * 13.0));
  wd = s.z * pow(1.0 - h, 1.5) * crag + 0.0025;
  return step(abs(dx - s.z * 0.35 * h * h), wd) * step(-0.03, e) * step(e, s.y);
}
vec4 skyAt(vec3 d, vec2 cell) {
  float e = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, d.z);
  vec3 col;
  if (e >= 0.0) {
    // the air under the lid: blood red low, black-red at its crown
    col = mix(HOR, ZEN, smoothstep(0.0, 0.75, e));
    // THE LID: ash over all the sky, met along the ray, drifting round a closed loop a period, lit from beneath - the
    // bellies that face the fire on the line, its masses' rims, the light falling off up the lid
    vec2 p = deckAt(d, 0.06) * 0.8 + orbit(${turns(D.ash)}, 1.4);
    float n = lidAt(p);
    vec2 outward = d.xz / max(length(d.xz), 1e-4);
    float face = clamp((n - lidAt(p + outward * 0.2)) * 6.0, 0.0, 1.0);
    float rim = smoothstep(0.3, 0.42, n) * (1.0 - smoothstep(0.42, 0.58, n));
    float cover = smoothstep(0.32, 0.5, n) * smoothstep(0.03, 0.2, e);
    float lit = band4((face * 0.85 + rim * 0.5) * exp(-e * 1.8) + 0.06);
    col = mix(col, mix(LID, LIT, lit) * mix(1.0, 0.3, smoothstep(0.4, 1.2, e)), step(0.5, cover));
  } else {
    // THE FIRE-SEA, far below: a black crust broken by currents - thin bright threads along the warped net's crests, round
    // a closed loop a period, pulses sliding along them - and a few broad pools; toward the line its detail sinks into the
    // crust's own dark, and the haze
    vec2 q = deckAt(d, 0.02) * 1.3;
    vec2 w = vec2(dfbm(q * 0.3 + orbit(${turns(D.sea)}, 0.8) + 1.3, 3), dfbm(q * 0.3 - orbit(${turns(D.sea)}, 0.8) + 5.1, 3));
    float r = dfbm(q * 0.55 + w * 2.4, 4);
    float vein = 1.0 - smoothstep(0.0, 0.035, abs(r - 0.5));
    float pulse = flowNoise(q * 1.8 + w, vec2(0.8, 0.6), 3.0, ${turns(D.pulse)});
    float pool = smoothstep(0.76, 0.92, dfbm(q * 0.18 + w * 0.8 + 9.0, 3));
    float near = smoothstep(0.05, 0.3, -e);
    float heat = band4(mix(0.1, vein * (0.45 + 0.7 * pulse) + pool * 0.6, near));
    col = mix(DEEP * (0.45 + 0.4 * dnoise(q * 2.5)), GLOW, heat);
  }
  float hz = hazeAt(e);
  // THE VOLCANO SPIRES: black against the glow, their feet in the haze on the line, their flanks lit by the fire below; a
  // vent's fire at a crag and its smoke rising into the lid
  for (int k = 0; k < ${EG_SKY_SPIRES.length}; k++) {
    vec4 s = SPIRE[k];
    float dx = wrapPi(az - s.x), wd;
    if (e < -0.03 || e > s.y + 0.22 || abs(dx) > s.z * 1.8 + 0.08) continue;
    if (spireAt(s, dx, e, wd) > 0.5) {
      float x = abs(dx - s.z * 0.35 * (e / s.y) * (e / s.y));
      col = ROCK + GLOW * 0.2 * step(wd * 0.72, x) * exp(-max(e, 0.0) * 16.0);
      if (s.w > 0.5 && e > s.y * 0.9) col = mix(col, GLOW * 0.9, step(x, wd * 0.7));
      hz = hazeFar(e);
    } else if (s.w > 0.5 && e > s.y) {
      float t = (e - s.y) / 0.22;
      float sx = dx - s.z * 0.35 - 0.012 * sin(e * 40.0);
      float smoke = step(abs(sx), 0.006 + 0.035 * t) * (1.0 - t) * step(0.45, flowNoise(vec2(sx * 40.0, e * 30.0), vec2(0.0, -1.0), 4.0, ${turns(D.smoke)}));
      col = mix(col, mix(LID, LIT * 0.6, (1.0 - t) * 0.6), smoke * 0.85);
      hz = mix(hz, hazeFar(e), smoke);
    }
  }
  return vec4(col, hz);
}` + PAINT_MAIN;
}

// ── THE SOUL CAIRN ────────────────────────────────────────────────────────────────────────────────────────────────────
function soulCairnFs() {
  const S = /** @type {any} */ (egAtmosOf(1).sky), D = /** @type {any} */ (EG_SKY_DRIFT[1]), P = EG_SKY_STREAM;
  // the stream's own frame: two directions across its pole
  const a = Math.abs(P[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const c1 = [P[1] * a[2] - P[2] * a[1], P[2] * a[0] - P[0] * a[2], P[0] * a[1] - P[1] * a[0]], l1 = Math.hypot(...c1), S1 = c1.map((v) => v / l1);
  const S2 = [P[1] * S1[2] - P[2] * S1[1], P[2] * S1[0] - P[0] * S1[2], P[0] * S1[1] - P[1] * S1[0]];
  return paintHead(1) + `const vec3 STAR = ${v3(S.star)};
const vec3 SOUL = ${v3(S.soul)};
const vec3 AURORA = ${v3(S.aurora)};
const vec3 HEM = ${v3(S.hem)};
const vec3 ROCK = ${v3(S.rock)};
const vec3 STREAM = vec3(${P.map(f4).join(', ')});
const vec3 STREAM_A = vec3(${S1.map(f4).join(', ')});
const vec3 STREAM_B = vec3(${S2.map(f4).join(', ')});
${vec4s('CAIRN', EG_SKY_CAIRNS)}
// a star of the stream at this texel: the brightest few carry a four-point glint into their neighbours
float brightAt(vec2 c) { return step(0.9986, dhash(c * 0.7071 + 5.3)); }
vec4 skyAt(vec3 d, vec2 cell) {
  float e = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, d.z);
  vec3 col;
  if (e >= 0.0) {
    // violet-black
    col = mix(HOR, ZEN, smoothstep(0.0, 0.85, e));
    // THE SOUL-STREAM: a river of the dead across the sky - a faint violet glow where the stars crowd, drifting
    float off = dot(d, STREAM);
    vec2 along = vec2(dot(d, STREAM_A), dot(d, STREAM_B));
    float crowd = exp(-off * off * 40.0) * (0.5 + 0.5 * dfbm(along * 3.0 + vec2(off * 6.0) + orbit(${turns(D.stream)}, 0.3), 3));
    col += AURORA * 0.09 * band4(crowd);
    // THE SOUL-STARS: thick - single texels of cold white or cyan, crowding in the stream, breathing slowly
    float up = smoothstep(0.015, 0.1, e);
    if (dhash(cell * 0.7071 + 5.3) > 0.984 - 0.07 * crowd) {
      float which = dhash(cell + 2.9), b = dhash(cell + 8.1);
      float breath = 0.75 + 0.25 * sin(spin(${turns(D.breath)} + floor(which * 4.0)) + b * TAU);
      col = max(col, (which > 0.55 ? SOUL : STAR) * (0.24 + 0.5 * b * b) * breath * up);
    }
    float glint = max(max(brightAt(cell + vec2(1.0, 0.0)), brightAt(cell - vec2(1.0, 0.0))), max(brightAt(cell + vec2(0.0, 1.0)), brightAt(cell - vec2(0.0, 1.0))));
    col = max(col, STAR * 0.3 * glint * up);
    if (brightAt(cell) > 0.5) col = max(col, mix(STAR, SOUL, dhash(cell + 1.3)) * 0.8 * up);
    // THE PALE SOUL-AURORA: curtains hanging from a wandering hem, fine rays, four steps, drifting
    if (e > 0.34 && e < 1.15) {
      vec2 ring = vec2(cos(az), sin(az));
      float curtain = sin(az * 2.0 + dfbm(ring * (0.8 + 1.6 * e) + orbit(${turns(D.aurora)}, 0.6), 4) * 4.5 + spin(${turns(D.aurora)}));
      float hemE = 0.39 + 0.1 * dnoise(ring * 2.2 + orbit(${turns(D.aurora)}, 0.4));
      float rise = e - hemE;
      float body = step(0.0, rise) * exp(-rise * 3.2) * smoothstep(0.3, 0.85, curtain) * (1.0 - smoothstep(0.95, 1.15, e));
      float rays = 0.45 + 0.55 * step(0.5, fract(az / TAU * 120.0 + 1.7 * dnoise(ring * 6.0)));
      float k = band4(body * rays);
      float hem = step(0.0, rise) * step(rise, 0.025) * step(0.3, curtain);
      col += mix(AURORA * 0.32, HEM * 0.42, hem) * k;
    }
  } else {
    // THE SEA OF MIST: swells rolling outward from under the halls to the horizon, banded, a body of slow mist on them
    vec2 q = deckAt(d, 0.015);
    float warp = dfbm(q * 0.22 + orbit(${turns(D.mist)}, 0.7), 3);
    float swell = 0.5 + 0.5 * sin(length(q) * 1.5 + warp * 2.6 - spin(${turns(D.swell)}));
    float crest = smoothstep(0.6, 0.95, swell);
    float body = dfbm(q * 0.8 + vec2(warp) + orbit(${turns(D.mist)}, 0.5), 4);
    float near = smoothstep(0.02, 0.16, -e);
    col = mix(DEEP, GLOW, band4(mix(0.35, crest * 0.75 + body * 0.4 - 0.1, near)));
    // soul-light deep in the mist
    float g = dhash(cell * 1.31 + 9.7);
    if (g > 0.9965) col = max(col, SOUL * 0.32 * (0.6 + 0.4 * sin(spin(${turns(D.breath)}) + g * 997.0)));
  }
  float hz = hazeAt(e);
  // THE CAIRNS: black stones stacked, standing out of the mist on the line
  for (int k = 0; k < ${EG_SKY_CAIRNS.length}; k++) {
    vec4 s = CAIRN[k];
    float x = abs(wrapPi(az - s.x));
    if (e < -0.02 || e > s.y || x > s.z * 1.5) continue;
    float h = clamp(e / s.y, 0.0, 1.0), course = floor(h * 7.0);
    float wd = s.z * (1.0 - 0.45 * h) * (0.8 + 0.4 * dhash(vec2(course, s.w)));
    if (h > 0.86) wd *= (1.0 - h) / 0.14;   // its capstone, pointed
    if (x < wd) { col = ROCK; hz = hazeFar(e); }
  }
  return vec4(col, hz);
}` + PAINT_MAIN;
}

// ── THE EVERGLOAM (the Shade Perilous) ────────────────────────────────────────────────────────────────────────────────
function evergloamFs() {
  const S = /** @type {any} */ (egAtmosOf(2).sky), D = /** @type {any} */ (EG_SKY_DRIFT[2]), M = EG_SKY_MOON.dir;
  // the moon's face: right and up across its bearing
  const r0 = [M[2], 0, -M[0]], lr = Math.hypot(...r0), R1 = r0.map((v) => v / lr);
  const U1 = [M[1] * R1[2] - M[2] * R1[1], M[2] * R1[0] - M[0] * R1[2], M[0] * R1[1] - M[1] * R1[0]];
  const up = U1[1] < 0 ? U1.map((v) => -v) : U1, right = U1[1] < 0 ? R1.map((v) => -v) : R1;
  const moonAz = Math.atan2(M[0], M[2]);
  return paintHead(2) + `const vec3 MOON = vec3(${M.map(f4).join(', ')});   // the key light's own bearing
const vec3 MOON_R = vec3(${right.map(f4).join(', ')});
const vec3 MOON_U = vec3(${up.map(f4).join(', ')});
const float MOON_RAD = ${f4(EG_SKY_MOON.r)};
const float MOON_AZ = ${f4(moonAz)};
const vec2 LIGHT2 = vec2(-0.6, 0.8);   // the face's light, from the upper left
const vec3 MOONC = ${v3(S.moon)};
const vec3 MARE = ${v3(S.mare)};
const vec3 HIGH = ${v3(S.high)};
const vec3 HALO = ${v3(S.halo)};
const vec3 STAR = ${v3(S.star)};
const vec3 AURORA = ${v3(S.aurora)};
const vec3 ROCK = ${v3(S.rock)};
${vec4s('CRATER', EG_SKY_CRATERS)}
${vec4s('THORN', EG_SKY_THORNS)}
// THE MOON'S FACE at (u, v) of its disc: the limb darkening, the seas, each crater a bowl - its far wall lit, its near
// wall in shadow, its rim raised and lit on the light's side - a young one's rays; five tones
vec3 moonFace(vec2 uv) {
  float r = length(uv);
  float t = 0.8 - 0.22 * r * r - 0.3 * smoothstep(0.5, 0.64, dfbm(uv * 1.7 + 3.0, 4));
  for (int k = 0; k < ${EG_SKY_CRATERS.length}; k++) {
    vec4 c = CRATER[k];
    vec2 q = (uv - c.xy) / c.z;
    float l = length(q);
    vec2 n = q / max(l, 1e-3);
    if (l < 0.88) t += -0.12 + 0.2 * dot(-n, LIGHT2) * smoothstep(0.25, 0.88, l);
    else if (l < 1.15) t += 0.13 * max(dot(n, LIGHT2), 0.0);
    if (c.w > 0.5 && l > 1.1 && l < 4.5) t += 0.1 * step(0.86, fract(atan(q.y, q.x) / TAU * 14.0 + 0.3 * dnoise(q * 1.3))) * (1.0 - l / 4.5);
  }
  t = floor(clamp(t, 0.0, 1.0) * 5.0 + 0.5) / 5.0;
  return t < 0.5 ? mix(MARE, MOONC, t * 2.0) : mix(MOONC, HIGH, t * 2.0 - 1.0);
}
vec4 skyAt(vec3 d, vec2 cell) {
  float e = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, d.z);
  float ang = acos(clamp(dot(d, MOON), -1.0, 1.0));
  vec3 col;
  if (e >= 0.0) {
    col = mix(HOR, ZEN, smoothstep(0.0, 0.6, e));
    // a scatter of cold stars, washed out about the moon
    float up = smoothstep(0.02, 0.15, e) * smoothstep(MOON_RAD * 1.3, MOON_RAD * 3.2, ang);
    if (dhash(cell * 0.7071 + 13.1) > 0.9958) col = max(col, STAR * (0.25 + 0.5 * dhash(cell + 7.7)) * up);
    // THE THIN SILVER AURORA: one ribbon, broken, drifting
    if (e > 0.55 && e < 0.95) {
      vec2 ring = vec2(cos(az), sin(az));
      float hemE = 0.62 + 0.07 * dnoise(ring * 2.0 + orbit(${turns(D.aurora)}, 0.4));
      float rise = e - hemE;
      float on = smoothstep(0.45, 0.7, dfbm(ring * 1.4 + orbit(${turns(D.aurora)}, 0.5) + 2.0, 3));
      float rays = 0.5 + 0.5 * step(0.5, fract(az / TAU * 160.0 + 1.3 * dnoise(ring * 7.0)));
      col += AURORA * 0.22 * band4(step(0.0, rise) * exp(-rise * 14.0) * on * rays);
    }
    // THE COLD HALO: a glow hugging the moon and a thin ring out at nearly twice its radius
    float hr = (ang - MOON_RAD * 1.85) / 0.012;
    if (ang > MOON_RAD) col += HALO * band4(exp(-(ang - MOON_RAD) / 0.06) * 0.9 + exp(-hr * hr) * 0.55);
    else col = moonFace(vec2(dot(d, MOON_R), dot(d, MOON_U)) / sin(MOON_RAD));
  } else {
    // the dark below, silver mist drifting in it and glinting - and the moon's glade across it, widening as it nears
    vec2 q = deckAt(d, 0.02);
    float mist = smoothstep(0.52, 0.78, dfbm(q * 0.35 + orbit(${turns(D.mist)}, 0.9), 4));
    float dz = wrapPi(az - MOON_AZ);
    float glade = exp(-dz * dz / (0.012 + 0.08 * (-e)));
    col = DEEP + GLOW * 0.22 * band4(mist * (0.45 + 0.9 * glade));
    float g = dhash(cell * 1.17 + 4.4);
    if (g > 0.97 - 0.05 * glade && mist > 0.1) col = max(col, GLOW * (0.35 + 0.5 * glade) * (0.5 + 0.5 * sin(spin(${turns(D.glint)}) + g * 997.0)));
  }
  float hz = hazeAt(e);
  // THE THORNS: black glass spines against the moon's lower limb, bending
  for (int k = 0; k < ${EG_SKY_THORNS.length}; k++) {
    vec4 s = THORN[k];
    if (e < -0.02 || e > s.y) continue;
    float h = clamp(e / s.y, 0.0, 1.0);
    float x = abs(wrapPi(az - MOON_AZ - s.x - s.w * h * h));
    if (x < s.z * (1.0 - h) + 0.0015) { col = ROCK; hz = hazeFar(e); }
  }
  return vec4(col, hz);
}` + PAINT_MAIN;
}

// ── THE HAVOC WELLHEAD ────────────────────────────────────────────────────────────────────────────────────────────────
function wellheadFs() {
  const S = /** @type {any} */ (egAtmosOf(3).sky), D = /** @type {any} */ (EG_SKY_DRIFT[3]), K = EG_SKY_CRATER;
  return paintHead(3) + `const vec3 LID = ${v3(S.lid)};
const vec3 LIT = ${v3(S.lit)};
const vec3 ROCK = ${v3(S.rock)};
const vec3 FIRE = ${v3(S.fire)};
const float COLS = ${K.columns.toFixed(1)};
${vec4s('ERUPT', EG_SKY_ERUPTIONS)}
${LID_GLSL}
// the crust's plates: the nearest seam's distance, the plate's own draw
vec2 plates(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + vec2(dhash(i + g), dhash(i + g + 19.19)) - f;
    float dd = dot(r, r);
    if (dd < d1) { d2 = d1; d1 = dd; id = dhash(i + g + 7.7); } else if (dd < d2) d2 = dd;
  }
  return vec2(sqrt(d2) - sqrt(d1), id);
}
// the crater's rim over the line at azimuth az: its basalt columns' tops
float rimAt(float az) {
  float id = mod(floor((az + PI) / TAU * COLS), COLS);
  return ${f4(K.base)} + ${f4(K.rise)} * dfbm(vec2(cos(az), sin(az)) * 2.2 + 4.0, 3) + 0.01 * (dhash(vec2(id, 3.0)) - 0.5);
}
vec4 skyAt(vec3 d, vec2 cell) {
  float e = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, d.z);
  float near = 0.0;
  for (int k = 0; k < ${EG_SKY_ERUPTIONS.length}; k++) near = max(near, exp(-abs(wrapPi(az - ERUPT[k].x)) * 6.0));
  vec3 col;
  if (e >= 0.0) {
    // red-orange low, its crown black-red
    col = mix(HOR, ZEN, smoothstep(0.0, 0.6, e));
    // HEAVY ASH: a lid low and thick, lit from beneath - brightest over the eruptions
    vec2 p = deckAt(d, 0.05) + orbit(${turns(D.ash)}, 1.6);
    float n = lidAt(p);
    vec2 outward = d.xz / max(length(d.xz), 1e-4);
    float face = clamp((n - lidAt(p + outward * 0.2)) * 6.0, 0.0, 1.0);
    float rim = smoothstep(0.24, 0.36, n) * (1.0 - smoothstep(0.36, 0.52, n));
    float cover = smoothstep(0.24, 0.42, n) * smoothstep(0.012, 0.12, e);
    float lit = band4((face * 0.8 + rim * 0.45) * exp(-e * 2.0) * (0.55 + 0.9 * near) + 0.05);
    col = mix(col, mix(LID, LIT, lit) * mix(1.0, 0.3, smoothstep(0.4, 1.2, e)), step(0.5, cover));
  } else {
    // THE MAGMA LAKE: crust plates on fire, drifting round a closed loop, the molten seams between them pulsing, a thin
    // plate glowing through - the eruptions' light on it; the detail giving way to its glow toward the line
    vec2 q = deckAt(d, 0.02) * 3.2 + orbit(${turns(D.lake)}, 1.8);
    vec2 v = plates(q + vec2(dnoise(q * 0.6), dnoise(q * 0.6 + 5.3)) * 0.9);
    float seam = (1.0 - smoothstep(0.02, 0.07, v.x)) * (0.55 + 0.45 * step(0.3, dnoise(q * 0.9 + 2.0)));
    float flat0 = smoothstep(0.06, 0.32, -e);
    float heat = band4(mix(0.2, seam * (0.75 + 0.25 * flowNoise(q * 3.0, vec2(0.6, 0.8), 2.0, ${turns(D.lava)})) + step(v.y, 0.12) * 0.35, flat0) + near * 0.12 * exp(e * 8.0));
    col = mix(DEEP * (0.6 + 0.6 * v.y), GLOW, heat);
  }
  float hz = hazeAt(e);
  // THE CRATER'S BASALT CLIFFS: columns round the line - a joint, a lit face, a turned face - their feet lit by the lake,
  // the far wall in the smoke and the line itself the fog
  float top = rimAt(az);
  if (e > -0.03 && e < top) {
    float facet = fract((az + PI) / TAU * COLS);
    float faceK = facet < 0.12 ? 0.35 : facet < 0.55 ? 1.0 : 0.7;
    col = ROCK * faceK + GLOW * 0.3 * exp(-(e + 0.03) * 45.0) * (0.6 + 0.8 * near);
    hz = mix(0.45, 1.0, exp(-max(e, 0.0) * 30.0));
  }
  // THE ERUPTIONS: a fountain of fire on the rim, its plume churning up into the ash, lit from below
  for (int k = 0; k < ${EG_SKY_ERUPTIONS.length}; k++) {
    vec4 s = ERUPT[k];
    float foot = rimAt(s.x) - 0.004;
    if (e < foot || e > s.z) continue;
    float x = wrapPi(az - s.x), t = (e - foot) / (s.z - foot);
    float wd = s.y + s.w * t * 0.25;
    float churn = flowNoise(vec2(x / wd * 1.5, e * 18.0), vec2(0.0, -1.0), 3.0, ${turns(D.plume)});
    if (abs(x) > wd * (0.8 + 0.4 * churn)) continue;
    float fire = exp(-t * 6.0);
    col = mix(LID, LIT, band4(0.2 + 0.55 * churn * exp(-t * 2.5) + fire));
    if (t < 0.12 && abs(x) < s.y * 1.1) col = FIRE;
    hz = hazeFar(e) * 0.85 * (1.0 - fire * 0.5);
  }
  return vec4(col, hz);
}` + PAINT_MAIN;
}

/** THE PAINTERS, a band each (index the band). */
export const EG_SKY_PAINT_FS = Object.freeze([deadlandsFs(), soulCairnFs(), evergloamFs(), wellheadFs()]);

/** THE MAP: its target and its painters (a band's built the first time it paints, kept until `release`); painted a
 *  quadrant a call - all four when it has never been painted in this band and these steps. `lite` (the phones' tier):
 *  a quadrant every fourth call (the whole every sixteen - SD-LOOK's phone column). */
export class EgSkyMap {
  /** @param {WebGL2RenderingContext} gl @param {{ lite?: boolean }} [o] */
  constructor(gl, { lite = false } = {}) {
    this.gl = gl;
    this.lite = !!lite;
    this.target = createRenderTarget(gl, EG_SKY_MAP, EG_SKY_MAP, { filter: 'NEAREST' });
    /** @type {Array<{ program: WebGLProgram, u: Record<string, WebGLUniformLocation|null> } | null>} */
    this.painters = [null, null, null, null];
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    /** the band the map holds (-1: none yet), the next quadrant, the calls made, the quadrants painted */
    this.band = -1;
    this.next = 0;
    this.calls = 0;
    this.painted = 0;
    this._quad = new Float32Array(4);
    this._vp = new Int32Array(4);
    this._all = false;
    this._u = /** @type {any} */ (null);
    // the quadrants' draw made once (AUDIT SD V P4's law: no closure a frame)
    this._quads = () => {
      for (let k = 0; k < 4; k++) {
        if (!this._all && k !== this.next) continue;
        const qx = k & 1, qy = k >> 1, h = EG_SKY_MAP / 2;
        this.gl.viewport(qx * h, qy * h, h, h);
        this._quad[0] = qx * 0.5; this._quad[1] = qy * 0.5; this._quad[2] = 0.5; this._quad[3] = 0.5;
        this.gl.uniform4fv(this._u.uQuad, this._quad);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }
  /** Band `band`'s painter, built the first time it is asked. */
  painter(band) {
    const b = Math.max(0, Math.min(3, band | 0));
    if (!this.painters[b]) {
      const program = buildProgram(this.gl, EG_SKY_PAINT_VS, EG_SKY_PAINT_FS[b], 'eg sky paint');
      const u = {};
      for (const n of ['uQuad', 'uTime']) u[n] = this.gl.getUniformLocation(program, n);
      this.painters[b] = { program, u };
    }
    return this.painters[b];
  }
  /** Whether the map holds band `band` whole (the fetch draws only then). */
  holds(band) { return this.band === band && this.painted >= 4; }
  /**
   * Paint band `band`'s next quadrant at `seconds` on the sky's clock (wrapped here) - the whole map when it held another
   * band. `viewport` the world viewport to hand back (null: the drawing buffer's). A DRAW PATH: binds its target and
   * hands back the frame's (render/renderTarget.js). Answers whether it painted.
   */
  paint(band, seconds, viewport = null) {
    const gl = this.gl, b = Math.max(0, Math.min(3, band | 0));
    const all = this.band !== b || this.painted < 4;
    this.calls++;
    if (!all && this.lite && (this.calls & 3) !== 0) return false;
    const P = this.painter(b);
    this._all = all; this._u = P.u;
    let vp = viewport;
    if (!vp) { const V = this._vp; V[0] = 0; V[1] = 0; V[2] = gl.drawingBufferWidth; V[3] = gl.drawingBufferHeight; vp = V; }
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(P.program);
    gl.uniform1f(P.u.uTime, egSkyClock(seconds));
    gl.bindVertexArray(this.vao);
    withTarget(gl, this.target, vp, this._quads);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    if (all) { this.band = b; this.painted = 4; this.next = 0; } else { this.next = (this.next + 1) & 3; this.painted++; }
    return true;
  }
  get texture() { return this.target.tex; }
  /** Every GL object it made, freed once. */
  release() {
    const gl = this.gl;
    if (!this.target) return;
    gl.deleteTexture(this.target.tex); gl.deleteFramebuffer(this.target.fbo);
    for (const p of this.painters) if (p) gl.deleteProgram(p.program);
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao);
    this.painters = [null, null, null, null];
    this.target = /** @type {any} */ (null);
    this.band = -1; this.painted = 0;
  }
}
