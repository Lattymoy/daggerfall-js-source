// @ts-check
// WB6a (2026-09-25, Mac, having walked the Burning Court: "the transition and the arena needs to be an oblivion
// masterpiece ... the outside bounds arent a perfect square, maybe somehow introduce distant skybox design or some
// other ambient detail. Whole thing needs to feel alive"): THE DEADLANDS' SKY AND SEA - what stands round the court
// and burns under it. Design: bible/11-Multiplayer/World-Bosses.md section 4 ("The Deadlands").
//
// WHAT THEY REPLACE. The court stood on a SQUARE of fire 520 m across under a shell of flat fog-red: the fog hid the
// square's middle and never its edge, and the shell was one colour. Both are gone from the court's mesh
// (world/gateArena.js buildCourtModel); these two passes stand in their place, drawn in the court's world pass AFTER
// its solid geometry and BEFORE its flats (PERF2's law, render/skyRenderer.js: the court, the players and the boss's
// body are drawn first, so the sea burns and the sky churns only where they show, and a flat blended over the sky is
// drawn over it, never under).
//
// THE SKY is painted, not built: one triangle over the screen AT THE FAR PLANE, depth-tested and never written, each
// pixel reading its own ray. From the
// zenith down: a churning overcast of smoke lit from below (domain-warped value noise on a cloud deck, drifting on a
// closed path so the clock can wrap); the VORTEX - Oblivion's own sign, a whirl in the clouds over the great tower,
// its eye burning, its arms turning faster toward it; the BEAM, a column of fire from the tower's crown up into the
// eye; the TOWERS, black Daedric spires with horns and a crown, the great one behind the boss as the players arrive
// and lesser ones round the horizon; three rings of JAGGED RIDGES, far to near, hazier the further, each lit at its
// crest and glowing at its foot where the fire meets it; and under them the glow of a sea of fire going on for ever.
// Lightning (`deadlandsFlash`) lights the deck from within at seeded moments. Every rate is a whole number of cycles
// over DEAD_CLOCK_PERIOD and the clock is handed wrapped, so the sky never jumps (the gate's own law, gatePass.js).
//
// THE SEA is built: a disc SEA_R across round the court, rings closer near the middle, depth-tested and written, so
// the court and everything on it stand in front of it. Its fire moves - crust plates drifting on molten channels, fine cracks
// glowing in the plates, a slow pulse - fogged by the frame's own fog, and at its rim it becomes exactly the sky's
// horizon (the one GLSL function both read, HORIZON_GLSL), so no edge is ever seen: not a square, not a circle.
//
// THE LIGHT the court stands in is here too (`courtLighting`): a trilight red from above and fire-orange from below,
// and the vortex's fire as a key light from behind the boss - the dungeon's dark ambient is no place's but a dungeon's.
//
// Colours are DISPLAY-encoded (the frame image the lit lane draws foreign passes into is 8-bit and display encoded -
// duelWall.js), scaled by `gain` with the court's fog (the lane darkens a dungeon's fog, and the sky must meet it).
//
// WB6b (2026-09-25, the same ask - "Whole thing needs to feel alive"): THE AIR'S LIFE (`drawLife`) - embers rising off
// the sea round the court and off its braziers, turning with the drift of the air (`deadlandsWind`), cooling as they
// climb, and ash falling through it all - one vertex a mote, every life a whole number a period. And a strike LIGHTS
// THE COURT (`courtLighting(flash)`): the trilight's sky flares and the key light swings toward the strike while it
// outshines the vortex. The clock the hosts hand is the relay's (world.js deadlandsSeconds), so a strike, its light and
// its thunder (scenes/deadlandsAir.js) are the same moment on every screen.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';

/** Every rate is whole cycles over this many seconds; the clock is handed wrapped to it. */
export const DEAD_CLOCK_PERIOD = 600;
export const deadClock = (seconds) => ((seconds % DEAD_CLOCK_PERIOD) + DEAD_CLOCK_PERIOD) % DEAD_CLOCK_PERIOD;
/** Azimuths are measured from the court's -z (toward the boss from the arrival), turning toward +x. */
export const deadAzimuth = (dx, dz) => Math.atan2(dx, -dz);

/** THE GREAT TOWER: its azimuth, its foot and crown (elevations, radians), its half-width at the foot. */
export const SIGIL_TOWER = Object.freeze({ az: 0.2, foot: -0.02, top: 0.36, w: 0.05 });
/** The lesser towers round the horizon: azimuth, foot, crown, half-width. */
export const LESSER_TOWERS = Object.freeze([
  Object.freeze({ az: -1.25, foot: -0.01, top: 0.14, w: 0.022 }),
  Object.freeze({ az: 1.55, foot: -0.01, top: 0.11, w: 0.018 }),
  Object.freeze({ az: 2.55, foot: -0.01, top: 0.17, w: 0.026 }),
  Object.freeze({ az: -2.35, foot: -0.01, top: 0.095, w: 0.016 }),
]);
/** The vortex: over the great tower, this high (radians), turning this many times a period at its rim. */
export const VORTEX_ELEV = 0.78;
export const VORTEX_TURNS = 12;
/** ...and pouring inward: one doubling of its scale every period / VORTEX_INFLOW_TURNS seconds. */
export const VORTEX_INFLOW_TURNS = 75;
/** The cloud deck's drift: once round a closed loop a period (so the clock can wrap); the sea's twice. */
export const CLOUD_LOOP_TURNS = 1;
export const SEA_LOOP_TURNS = 2;
/** The beam's bands climbing, the great tower's heart beating, the sea's slow pulse: cycles a period. */
export const BEAM_CLIMB_TURNS = 300;
export const SPINE_TURNS = 240;
export const SEA_PULSE_TURNS = 60;
/** The falls of fire down the near range: their grain slides down this many times a period. */
export const FALL_TURNS = 180;
/** A rate of `turns` cycles a period, as the shader's radians a second. */
const w = (turns) => ((turns / DEAD_CLOCK_PERIOD) * 2 * Math.PI).toFixed(6);
/** The ridges, far to near: base elevation, rise, features round the horizon, jaggedness, haze toward the horizon. */
export const RIDGES = Object.freeze([
  Object.freeze({ base: 0.012, rise: 0.05, freq: 5.0, sharp: 1.6, haze: 0.62 }),
  Object.freeze({ base: -0.004, rise: 0.07, freq: 8.0, sharp: 2.2, haze: 0.38 }),
  Object.freeze({ base: -0.02, rise: 0.11, freq: 13.0, sharp: 3.0, haze: 0.14 }),
]);
/** The sea: its radius (inside the host's 500 m far plane from anywhere on the court), the span over which its rim
 *  becomes the horizon, its rings and spokes. */
export const SEA_R = 460;
export const SEA_FADE = Object.freeze([260, 450]);
export const SEA_RINGS = 36;
export const SEA_SPOKES = 96;
/** The sea's depth under the court's floor (world/gateArena.js LAVA_Y - pinned equal; render/ reads no world/ module). */
export const DEAD_SEA_Y = -36;
/** THE AIR'S LIFE: embers rising off the sea round the court (from past its edge, never up through its floor), a few
 *  off each brazier, and ash falling over it all - how many, and how long each lives (whole cycles a period, so the
 *  clock can wrap: a life is DEAD_CLOCK_PERIOD / turns). */
export const SEA_EMBERS = 520;
export const BRAZIER_EMBERS = 16;
export const ASH_FLAKES = 280;
export const EMBER_TURNS = Object.freeze([60, 110]);
export const BRAZIER_EMBER_TURNS = Object.freeze([90, 150]);
export const ASH_TURNS = Object.freeze([10, 16]);
/** Where the sea's embers rise (metres from the court's centre) and how high the ash starts over the floor. */
export const EMBER_RING = Object.freeze([27, 95]);
export const ASH_TOP = 45;
export const ASH_RADIUS = 60;
/** The most braziers the pass takes (world/gateArena.js courtBraziers has five - the sixth is the bridge's gap). */
export const LIFE_BRAZIERS_MAX = 6;
/** The air's drift over the court: its speed (metres a second) and its turns round the compass a period. */
export const WIND_SPEED = 1.4;
export const WIND_TURNS = 2;
/** The drift at `seconds`: `[x, z]` metres a second, turning WIND_TURNS times round a period (whole, so the clock wraps). */
export function deadlandsWind(seconds) {
  const a = (deadClock(seconds) / DEAD_CLOCK_PERIOD) * WIND_TURNS * 2 * Math.PI;
  return [Math.cos(a) * WIND_SPEED, Math.sin(a) * WIND_SPEED];
}
/** Lightning: the period cut into FLASH_SLOTS slots of FLASH_SLOT_S (whole - WB6b: a 7 s slot left a 5 s stub at the
 *  wrap), about half of them striking, each strike lit for FLASH_S, flickering. */
export const FLASH_SLOT_S = 7.5;
export const FLASH_SLOTS = DEAD_CLOCK_PERIOD / FLASH_SLOT_S;
export const FLASH_S = 0.55;
/** How far off a strike is (metres - its thunder's lateness at the speed of sound, and its loudness). */
export const FLASH_DIST = Object.freeze([350, 2600]);
/** THE COURT'S LIGHT - display-encoded, the dungeon host's own units. */
export const COURT_TRILIGHT = Object.freeze({
  sky: Object.freeze([0.34, 0.1, 0.07]),
  equator: Object.freeze([0.3, 0.1, 0.06]),
  ground: Object.freeze([0.72, 0.3, 0.1]),
});
/** The vortex's fire as a key light: toward the vortex over the great tower (a unit vector), its strength, its colour. */
export const COURT_KEY_LIGHT = Object.freeze({
  scale: 0.55,
  dir: Object.freeze((() => {
    const e = 0.55, a = SIGIL_TOWER.az;
    return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
  })()),
  color: Object.freeze([1.0, 0.46, 0.22]),
});

/** WB6b: A STRIKE'S LIGHT on the court at its full strength - what it adds to the trilight's sky and equator, what it
 *  adds to the key (which swings toward it as it outshines the vortex), and its colour: the white heart of the
 *  Deadlands' fire. */
export const FLASH_LIGHT = Object.freeze({ sky: 0.62, equator: 0.3, key: 1.25, color: Object.freeze([1.0, 0.8, 0.64]) });

/** The court's lighting: the trilight and the key, for the dungeon host to set over its own - fresh copies. WB6b:
 *  `flash` the strike lit now (deadlandsFlash), or null. */
export function courtLighting(flash = null) {
  const s = Math.max(0, Math.min(1, Number(flash?.strength) || 0));
  const lift = (c, k) => c.map((v, i) => v + s * k * FLASH_LIGHT.color[i]);
  const tri = { sky: lift(COURT_TRILIGHT.sky, FLASH_LIGHT.sky), equator: lift(COURT_TRILIGHT.equator, FLASH_LIGHT.equator), ground: [...COURT_TRILIGHT.ground] };
  if (!(s > 0) || !Number.isFinite(flash.az) || !Number.isFinite(flash.elev)) return { tri, key: { scale: COURT_KEY_LIGHT.scale, dir: [...COURT_KEY_LIGHT.dir], color: [...COURT_KEY_LIGHT.color] } };
  // the key goes over to the strike by its share of the light: all the vortex's in the dark, most of the strike's at its peak
  const w = (s * FLASH_LIGHT.key) / (s * FLASH_LIGHT.key + COURT_KEY_LIGHT.scale);
  const to = [Math.sin(flash.az) * Math.cos(flash.elev), Math.sin(flash.elev), -Math.cos(flash.az) * Math.cos(flash.elev)];
  const d = COURT_KEY_LIGHT.dir.map((v, i) => v + (to[i] - v) * w);
  const l = Math.hypot(d[0], d[1], d[2]);
  return { tri, key: { scale: COURT_KEY_LIGHT.scale + s * FLASH_LIGHT.key, dir: l > 1e-6 ? d.map((v) => v / l) : to, color: COURT_KEY_LIGHT.color.map((v, i) => v + (FLASH_LIGHT.color[i] - v) * w) } };
}

/** A small seeded hash, [0, 1). */
const hash01 = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

/**
 * A SLOT'S STRIKE, pure: the strike slot `n` of the period throws (wrapped to FLASH_SLOTS) - `{ slot, at, az, elev,
 * dist }`: when it lights (seconds into the period), where on the sky, how far off (FLASH_DIST) - or null, as about
 * half the slots are. WB6b: the one answer the sky's flash and the thunder (scenes/deadlandsAir.js) both read.
 */
export function flashOfSlot(n) {
  const slot = ((Math.floor(n) % FLASH_SLOTS) + FLASH_SLOTS) % FLASH_SLOTS;
  if (hash01(slot * 3 + 1) < 0.45) return null;
  return {
    slot,
    at: slot * FLASH_SLOT_S + hash01(slot * 3 + 2) * (FLASH_SLOT_S - FLASH_S),
    az: (hash01(slot * 3 + 3) * 2 - 1) * Math.PI,
    elev: 0.25 + hash01(slot * 7 + 5) * 0.5,
    dist: FLASH_DIST[0] + hash01(slot * 11 + 7) * (FLASH_DIST[1] - FLASH_DIST[0]),
  };
}

/**
 * LIGHTNING, pure of everything but the clock: the strike lit at `seconds` (the Deadlands' clock, wrapped or not) -
 * `{ strength, az, elev, slot }` - or null. A slot's strike (flashOfSlot) flickers twice as it dies. The same on
 * every screen the clock is.
 */
export function deadlandsFlash(seconds) {
  const t = deadClock(seconds);
  const f = flashOfSlot(t / FLASH_SLOT_S);
  if (!f) return null;
  const u = (t - f.at) / FLASH_S;
  if (u < 0 || u >= 1) return null;
  const flicker = u < 0.18 ? 1 : u < 0.3 ? 0.25 : u < 0.46 ? 0.8 : (1 - u) * 0.9;
  return { strength: Math.max(0, Math.min(1, flicker)), az: f.az, elev: f.elev, slot: f.slot };
}

const HEAD = `#version 300 es
precision highp float;
`;
/** The noise both passes read: value noise, fbm with a turn between octaves. */
export const DEAD_NOISE_GLSL = `float dhash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float dnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dhash(i), dhash(i + vec2(1.0, 0.0)), u.x), mix(dhash(i + vec2(0.0, 1.0)), dhash(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 DROT = mat2(0.8, -0.6, 0.6, 0.8);
float dfbm(vec2 p, int oct) { float v = 0.0, a = 0.5; for (int k = 0; k < 6; k++) { if (k >= oct) break; v += a * dnoise(p); p = DROT * p * 2.03 + 11.7; a *= 0.5; } return v; }
`;
/** THE HORIZON, one function both passes read: the sky's colour just under the level of the eye along `d` - the glow
 *  of the sea going on for ever, meeting the frame's haze. The sea's rim becomes exactly this. */
export const HORIZON_GLSL = `vec3 deadHorizon(vec3 d) {
  float e = asin(clamp(d.y, -1.0, 1.0));
  vec3 glow = vec3(0.86, 0.3, 0.075) * uGain;
  float band = exp(-abs(e) * 9.0);
  vec3 c = mix(uHaze, glow, 0.55 * band);
  // far below the eye the glow gives way to the haze over the sea
  return mix(c, uHaze * 1.1, smoothstep(0.02, 0.35, -e));
}
`;

// ── the sky ──────────────────────────────────────────────────────────
export const DEAD_SKY_VS = HEAD + `layout(location = 0) in vec2 aPos;
uniform vec3 uRight, uUp, uFwd;
uniform vec4 uProj;   // proj[0], proj[5], proj[8], proj[9] - the lens, and its offset if it has one
out vec3 vRay;
void main() {
  vRay = uRight * ((aPos.x + uProj.z) / uProj.x) + uUp * ((aPos.y + uProj.w) / uProj.y) + uFwd;
  gl_Position = vec4(aPos, 1.0, 1.0); }`;

const towerGlsl = (name, t) => `float ${name}(float az, float e) {
  return tower(az, e, ${t.az.toFixed(4)}, ${t.foot.toFixed(4)}, ${t.top.toFixed(4)}, ${t.w.toFixed(4)});
}
`;

export const DEAD_SKY_FS = HEAD + `in vec3 vRay;
uniform float uTime;     // deadClock's seconds
uniform vec3 uHaze;      // the frame's fog colour: the air everything far fades into
uniform float uGain;     // the court's light against its own at full (the lane scales a dungeon's fog)
uniform vec4 uFlash;     // lightning: its azimuth, its elevation, its strength, -
out vec4 o;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
${DEAD_NOISE_GLSL}
${HORIZON_GLSL}
float adiff(float a, float b) { float d = a - b; return d - TAU * floor((d + PI) / TAU); }
// a ridge's height round the horizon - the noise read round a circle, so -PI and PI meet with no seam
float ridge(float az, float freq, float seed, float sharp) {
  vec2 c = vec2(cos(az), sin(az)) * freq + seed;
  float n = dfbm(c, 4);
  float r = 1.0 - abs(2.0 * n - 1.0);
  return pow(r, sharp);
}
// inside a half-width, softened over the pixel's own width (no stair on a silhouette)
float inside(float x, float hw, float aa) { return 1.0 - smoothstep(hw - aa, hw + aa, x); }
// a Daedric tower on the sky: a spire narrowing to its crown, two horns out and up from its waist, a crown of claws
float tower(float az, float e, float at, float foot, float top, float w) {
  float x = adiff(az, at) * cos(e);
  float H = top - foot;
  float h = (e - foot) / H;
  if (h < 0.0 || h > 1.12 || abs(x) > w * 3.0) return 0.0;
  float aa = max(fwidth(x), 1e-5);
  float body = w * pow(max(1.0 - h, 0.0), 1.35) * (1.0 + 0.25 * sin(h * 23.0));
  float m = inside(abs(x), body, aa);
  // the horns: from the waist out and up, curling in at their tips
  if (h > 0.42 && h < 0.78) {
    float t = (h - 0.42) / 0.36;
    float cx = w * (0.35 + 1.9 * sin(t * 1.9));
    float th = w * 0.32 * (1.0 - t);
    m = max(m, inside(abs(abs(x) - cx), th, aa));
  }
  // the crown: short claws round the spire's top
  float ch = (h - 0.86) / 0.26;
  if (ch > 0.0 && ch < 1.0) {
    float claws = abs(sin(x / w * 7.5)) * (1.0 - ch * 0.6);
    m = max(m, inside(abs(x), w * 0.55, aa) * (1.0 - smoothstep(claws - 0.05, claws + 0.05, ch)));
  }
  return m;
}
${towerGlsl('sigil', SIGIL_TOWER)}${LESSER_TOWERS.map((t, i) => towerGlsl(`lesser${i}`, t)).join('')}
void main() {
  vec3 d = normalize(vRay);
  float e = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  float t = uTime;

  // ── the air: black-red at the top, the fire's glow at the horizon
  vec3 zenith = vec3(0.075, 0.01, 0.008) * uGain;
  vec3 mid = vec3(0.3, 0.045, 0.022) * uGain;
  vec3 col = mix(mid, zenith, smoothstep(0.08, 1.2, e));
  col = mix(col, deadHorizon(d), smoothstep(0.22, 0.0, e));

  // ── the clouds: a deck over the court, read where the ray meets it, turned into the vortex
  float up = max(d.y, 0.0);
  vec3 V = vec3(sin(${SIGIL_TOWER.az.toFixed(4)}) * cos(${VORTEX_ELEV.toFixed(4)}), sin(${VORTEX_ELEV.toFixed(4)}), -cos(${SIGIL_TOWER.az.toFixed(4)}) * cos(${VORTEX_ELEV.toFixed(4)}));
  vec2 p = d.xz / (up + 0.09) * 0.55;
  vec2 pv = V.xz / (V.y + 0.09) * 0.55;
  vec2 rel = p - pv;
  float r = length(rel);
  // THE DECK: domain-warped, drifting once round a closed loop a period
  float loop = t * ${w(CLOUD_LOOP_TURNS)};
  vec2 drift = vec2(cos(loop), sin(loop)) * 5.0;
  vec2 warp = vec2(dfbm(p * 0.55 + drift * 0.35 + 3.1, 3), dfbm(p * 0.55 - drift * 0.3 + 7.7, 3));
  float n = dfbm(p * 1.05 + warp * 1.5 + drift, 5);
  n += (dfbm(p * 4.2 + warp * 2.2 + drift * 1.3, 3) - 0.5) * 0.2;   // the smoke's own grain over the masses
  // THE VORTEX: a spiral that turns WHOLE (no shear piles up as the clock runs) and pours inward - two layers read at
  // a scale that doubles over each cycle, half a cycle apart, each faded out as it wraps (the endless-zoom law)
  float sw = exp(-r * 0.85);
  float spin = t * ${w(VORTEX_TURNS)};
  vec2 vr = rel;
  if (sw > 0.02) {
    float ang = spin + 2.4 / (r + 0.28);
    vr = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * rel;
    float ph = fract(t * ${(VORTEX_INFLOW_TURNS / DEAD_CLOCK_PERIOD).toFixed(6)});
    float s1 = exp2(ph), s2 = exp2(fract(ph + 0.5));
    float k1 = 1.0 - abs(2.0 * ph - 1.0);
    float v1 = dfbm(vr * 1.6 * s1 + 2.3, 4), v2 = dfbm(vr * 1.6 * s2 + 9.1, 4);
    float nv = mix(v2, v1, k1);
    n = mix(n, nv, sw);
  }
  float cover = smoothstep(0.36, 0.64, n);
  float rim = smoothstep(0.3, 0.44, n) * (1.0 - smoothstep(0.44, 0.62, n));
  // lit from below: by the fire at the horizon, by the vortex's eye, by the lightning
  float eye = exp(-r * 3.2);
  float fromBelow = 0.35 + 0.65 * exp(-e * 5.0);
  vec3 cloudDark = vec3(0.06, 0.011, 0.009) * uGain;
  vec3 cloudLit = vec3(0.95, 0.36, 0.085) * uGain;
  float lit = clamp(rim * 1.05 * fromBelow + eye * 1.1 + (1.0 - cover) * 0.12 * fromBelow, 0.0, 1.5);
  vec3 cloud = mix(cloudDark, cloudLit, min(lit, 1.0)) + cloudLit * max(lit - 1.0, 0.0);
  if (uFlash.z > 0.0) {
    vec3 F = vec3(sin(uFlash.x) * cos(uFlash.y), sin(uFlash.y), -cos(uFlash.x) * cos(uFlash.y));
    float near = pow(max(dot(d, F), 0.0), 18.0);
    cloud += vec3(1.0, 0.82, 0.7) * uGain * uFlash.z * near * (0.35 + 0.9 * n);
    col += vec3(0.5, 0.22, 0.12) * uGain * uFlash.z * near * 0.3;
  }
  float deck = smoothstep(0.015, 0.2, e);
  col = mix(col, cloud, cover * deck * 0.92);
  // the eye itself: a furnace in the middle of the turning
  col += vec3(1.0, 0.62, 0.26) * uGain * pow(eye, 3.0) * 1.3 * deck;
  // its arms: the brighter streaks that wind into it
  float arms = sin(atan(vr.y, vr.x) * 3.0 + 6.0 / (r + 0.4));
  col += vec3(0.9, 0.3, 0.06) * uGain * smoothstep(0.55, 1.0, arms) * exp(-r * 1.4) * 0.35 * deck;

  // ── the beam: from the great tower's crown up into the eye, bands of fire climbing it
  {
    float x = adiff(az, ${SIGIL_TOWER.az.toFixed(4)}) * cos(e);
    float wb = 0.0045 + 0.004 * max(e - ${SIGIL_TOWER.top.toFixed(4)}, 0.0);
    float along = smoothstep(${(SIGIL_TOWER.top + 0.01).toFixed(4)}, ${(SIGIL_TOWER.top + 0.05).toFixed(4)}, e) * (1.0 - smoothstep(${(VORTEX_ELEV - 0.08).toFixed(4)}, ${(VORTEX_ELEV + 0.02).toFixed(4)}, e));
    float core = exp(-pow(x / wb, 2.0));
    float halo = exp(-abs(x) / (wb * 6.0));
    float bands = 0.75 + 0.25 * sin(e * 140.0 - t * ${w(BEAM_CLIMB_TURNS)});
    col += (vec3(1.0, 0.62, 0.3) * core * bands + vec3(0.9, 0.25, 0.05) * halo * 0.35) * along * uGain;
  }

  // ── the horizon's ranges, far to near, and the towers stood among them
  ${RIDGES.map((R, i) => `{
    float hgt = ${R.base.toFixed(4)} + ${R.rise.toFixed(4)} * ridge(az, ${R.freq.toFixed(2)}, ${(i * 17.3 + 4.1).toFixed(2)}, ${R.sharp.toFixed(2)});
    float aa = fwidth(e) * 1.5;
    float m = 1.0 - smoothstep(hgt - aa, hgt + aa, e);
    ${i === 0 ? `m = max(m, lesser0(az, e)); m = max(m, lesser3(az, e));` : ''}${i === 1 ? `m = max(m, lesser1(az, e)); m = max(m, lesser2(az, e));` : ''}${i === 2 ? `m = max(m, sigil(az, e));` : ''}
    vec3 rock = vec3(0.028, 0.006, 0.005) * uGain;
    float crest = smoothstep(hgt - 0.012, hgt, e) * (1.0 - smoothstep(hgt, hgt + 0.002, e));   // the ridge's own crest, never a tower's face
    float foot = exp(-max(e + 0.02, 0.0) * 40.0);
    vec3 land = rock + vec3(0.55, 0.14, 0.03) * uGain * (crest * 0.35 + foot * 0.8);
    ${i === 2 ? `{
      // falls of fire down the near range: a thread at a few high places, widening as it falls, pouring (its grain
      // slides down with the clock) into a glow at the foot
      float cell = az * 22.0;
      float id = floor(cell);
      float on = step(0.82, dhash(vec2(id, 7.0)));
      float lip = hgt - 0.012, sole = ${RIDGES[2].base.toFixed(4)} + 0.004;   // from under the crest to the range's foot
      float drop = clamp((lip - e) / max(lip - sole, 0.01), 0.0, 1.0);
      float cx = 0.3 + 0.4 * dhash(vec2(id, 3.0)) + 0.012 * sin(e * 140.0 + id);
      float hw = 0.015 + 0.04 * drop;                                  // in cells: a thread that spreads as it falls
      float thread = 1.0 - smoothstep(hw * 0.5, hw, abs(fract(cell) - cx));
      float pour = 0.55 + 0.45 * dnoise(vec2(id * 3.1, e * 260.0 + t * ${w(FALL_TURNS)}));
      float span = step(e, lip) * step(sole, e) * smoothstep(0.0, 0.12, drop);
      float pool = exp(-max(e - sole, 0.0) * 160.0) * (1.0 - smoothstep(0.0, 0.35, abs(fract(cell) - cx))) * step(sole - 0.004, e);
      land += vec3(1.0, 0.45, 0.1) * uGain * on * (thread * pour * span * (0.45 + 0.55 * drop) + pool * 0.6);
    }` : ''}
    land = mix(land, deadHorizon(d), ${R.haze.toFixed(3)});
    col = mix(col, land, m);
  }`).join('\n  ')}
  // the great tower's heart: a thread of fire up its spine, pulsing
  {
    float x = adiff(az, ${SIGIL_TOWER.az.toFixed(4)}) * cos(e);
    float h = (e - ${SIGIL_TOWER.foot.toFixed(4)}) / ${(SIGIL_TOWER.top - SIGIL_TOWER.foot).toFixed(4)};
    float spine = exp(-pow(x / 0.0018, 2.0)) * step(0.08, h) * step(h, 0.95) * sigil(az, e);
    col += vec3(1.0, 0.5, 0.15) * uGain * spine * (0.55 + 0.45 * sin(h * 30.0 - t * ${w(SPINE_TURNS)}));
  }
  o = vec4(col, 1.0);
}`;

// ── the sea ──────────────────────────────────────────────────────────
export const DEAD_SEA_VS = HEAD + `layout(location = 0) in vec2 aXZ;   // metres from the court's centre
uniform mat4 uVP;
uniform vec3 uCentre;   // the court's centre on the sea's plane (its y the sea's)
out vec3 vWorld;
out vec2 vLocal;
void main() {
  vec3 p = uCentre + vec3(aXZ.x, 0.0, aXZ.y);
  vWorld = p;
  vLocal = aXZ;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const DEAD_SEA_FS = HEAD + `in vec3 vWorld;
in vec2 vLocal;
uniform float uTime;
uniform vec3 uHaze;
uniform float uGain;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
const float TAU = 6.283185307179586;
${DEAD_NOISE_GLSL}
${HORIZON_GLSL}
${FOG_FACTOR_GLSL}
void main() {
  vec2 uv = vLocal;
  float loop = uTime * ${w(SEA_LOOP_TURNS)};
  vec2 drift = vec2(cos(loop), sin(loop)) * 6.0;
  vec2 warp = vec2(dfbm(uv * 0.018 + drift * 0.2 + 5.0, 3), dfbm(uv * 0.018 - drift * 0.2 - 3.0, 3));
  float n = dfbm(uv * 0.045 + warp * 2.4 + drift * 0.35, 4);
  // crust plates over molten channels, and fine cracks glowing in the plates
  float crust = smoothstep(0.445, 0.49, n);
  float cr = 1.0 - abs(2.0 * dfbm(uv * 0.22 + warp * 3.0, 3) - 1.0);
  float crack = smoothstep(0.9, 0.985, cr) * crust;
  float core = smoothstep(0.33, 0.21, n);                      // the hottest of the channels, far from any plate
  float edge = 1.0 - smoothstep(0.0, 0.035, abs(n - 0.462));  // where the melt meets a plate it burns brightest
  float pulse = 0.86 + 0.14 * sin(uTime * ${w(SEA_PULSE_TURNS)} + n * 11.0);
  vec3 molten = mix(vec3(0.8, 0.17, 0.025), vec3(1.0, 0.7, 0.26), core) * pulse;
  vec3 plate = vec3(0.05, 0.01, 0.008) + vec3(0.12, 0.02, 0.005) * (1.0 - smoothstep(0.49, 0.6, n));   // a plate's own edge still warm
  vec3 col = mix(molten, plate, crust) + vec3(1.0, 0.5, 0.12) * edge * 0.55 + vec3(1.0, 0.38, 0.06) * crack * 0.9;
  col *= uGain;
  // the frame's own fog, then the rim become the horizon itself
  col = mix(uHaze, col, fogFactorAt(vWorld));
  float rimT = smoothstep(${SEA_FADE[0].toFixed(1)}, ${SEA_FADE[1].toFixed(1)}, length(vLocal));
  col = mix(col, deadHorizon(normalize(vWorld - uCamPos)), rimT);
  o = vec4(col, 1.0);
}`;

/** The sea's disc: rings closer near the middle (the eye is over it), triangles facing up. Pure. */
export function seaVertices(rings = SEA_RINGS, spokes = SEA_SPOKES, radius = SEA_R) {
  const out = [];
  const R = (i) => radius * Math.pow(i / rings, 1.6);
  for (let i = 0; i < rings; i++) {
    const r0 = R(i), r1 = R(i + 1);
    for (let k = 0; k < spokes; k++) {
      const a0 = (k / spokes) * Math.PI * 2, a1 = ((k + 1) / spokes) * Math.PI * 2;
      const p00 = [Math.cos(a0) * r0, Math.sin(a0) * r0], p01 = [Math.cos(a1) * r0, Math.sin(a1) * r0];
      const p10 = [Math.cos(a0) * r1, Math.sin(a0) * r1], p11 = [Math.cos(a1) * r1, Math.sin(a1) * r1];
      // wound counter-clockwise seen from above (+y): the face is up
      out.push(...p00, ...p11, ...p10);
      if (i > 0) out.push(...p00, ...p01, ...p11);
    }
  }
  return new Float32Array(out);
}

// ── the air's life ───────────────────────────────────────────────────
/** One vertex a mote: kind (0 an ember off the sea, 1 off a brazier, 2 ash), three draws in [0, 1). Seeded, pure:
 *  the embers first, then the ash, so each is one draw of its own blend. */
export function lifeVertices(seed = 0xe3be5, braziers = LIFE_BRAZIERS_MAX) {
  let x = seed >>> 0;
  const r = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  const out = [];
  for (let i = 0; i < SEA_EMBERS; i++) out.push(0, r(), r(), r());
  for (let i = 0; i < BRAZIER_EMBERS * braziers; i++) out.push(1, (Math.floor(i / BRAZIER_EMBERS) + 0.5) / braziers, r(), r());
  for (let i = 0; i < ASH_FLAKES; i++) out.push(2, r(), r(), r());
  return new Float32Array(out);
}
export const DEAD_LIFE_VS = HEAD + `layout(location = 0) in vec4 aSeed;   // kind, three draws in [0, 1)
uniform mat4 uVP;
uniform vec3 uCentre;      // the court's centre on its floor, in the dungeon's frame
uniform float uTime;       // deadClock's seconds
uniform float uPxPerM;     // pixels a metre at one metre off (the viewport's height over the lens)
uniform vec3 uBraziers[${LIFE_BRAZIERS_MAX}];   // the fire beds, the court's frame
uniform int uBrazierCount;
uniform vec2 uWind;        // the air's drift, metres a second (turning once round a period - deadlandsWind)
out float vHeat;
out float vAlpha;
out vec3 vWorld;
const float PERIOD = ${DEAD_CLOCK_PERIOD.toFixed(1)};
const float TAU = 6.283185307179586;
void main() {
  float a = aSeed.y, b = aSeed.z, c = aSeed.w;
  vec3 p; float size;
  if (aSeed.x < 0.5) {
    // an ember off the sea: from past the court's edge, rising and wandering, cooling as it goes
    float life = PERIOD / floor(${EMBER_TURNS[0].toFixed(1)} + a * ${(EMBER_TURNS[1] - EMBER_TURNS[0]).toFixed(1)});
    float age = mod(uTime + b * life, life), u = age / life;
    float ang = c * TAU, rad = ${EMBER_RING[0].toFixed(1)} + pow(fract(a * 7.31 + b * 3.7), 0.8) * ${(EMBER_RING[1] - EMBER_RING[0]).toFixed(1)};
    float rise = 3.0 + c * 4.0;
    vec2 wander = vec2(sin(age * 1.3 + a * 20.0), cos(age * 1.1 + b * 20.0)) * (0.6 + age * 0.35) + uWind * age;
    p = vec3(cos(ang) * rad + wander.x, ${DEAD_SEA_Y.toFixed(1)} + 1.0 + age * rise, sin(ang) * rad + wander.y);
    size = 0.35 + 0.4 * b;
    vHeat = 1.0 - u;
    vAlpha = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.65, 1.0, u));
  } else if (aSeed.x < 1.5) {
    // an ember off a brazier: up out of its fire bed, a short life
    int bi = int(floor(a * ${LIFE_BRAZIERS_MAX.toFixed(1)}));
    float live = bi < uBrazierCount ? 1.0 : 0.0;
    vec3 bed = uBraziers[min(bi, ${LIFE_BRAZIERS_MAX - 1})];
    float life = PERIOD / floor(${BRAZIER_EMBER_TURNS[0].toFixed(1)} + b * ${(BRAZIER_EMBER_TURNS[1] - BRAZIER_EMBER_TURNS[0]).toFixed(1)});
    float age = mod(uTime + c * life, life), u = age / life;
    vec2 wander = vec2(sin(age * 2.1 + b * 30.0), cos(age * 1.7 + c * 30.0)) * (0.15 + age * 0.3) + uWind * age * 0.6;
    p = bed + vec3(wander.x, 1.2 + age * (1.6 + b * 1.6), wander.y);
    size = 0.14 + 0.14 * c;
    vHeat = 1.0 - u * 0.8;
    vAlpha = live * smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.6, 1.0, u));
  } else {
    // ash: drifting down over the court from far above, swaying, to the sea below
    float life = PERIOD / floor(${ASH_TURNS[0].toFixed(1)} + a * ${(ASH_TURNS[1] - ASH_TURNS[0]).toFixed(1)});
    float age = mod(uTime + b * life, life), u = age / life;
    float ang = c * TAU, rad = sqrt(fract(a * 13.7 + c)) * ${ASH_RADIUS.toFixed(1)};
    vec2 sway = vec2(sin(age * 0.7 + a * 9.0), cos(age * 0.5 + b * 9.0)) * 2.5 + uWind * (age - life * 0.5) * 0.5;
    p = vec3(cos(ang) * rad + sway.x, ${ASH_TOP.toFixed(1)} - u * ${(ASH_TOP - DEAD_SEA_Y).toFixed(1)}, sin(ang) * rad + sway.y);
    size = 0.1 + 0.1 * b;
    vHeat = 0.0;
    vAlpha = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.9, 1.0, u));
  }
  vWorld = uCentre + p;
  vec4 cp = uVP * vec4(vWorld, 1.0);
  gl_Position = cp;
  gl_PointSize = clamp(size * uPxPerM / max(cp.w, 0.1), 1.0, 40.0);
}`;
export const DEAD_LIFE_FS = HEAD + `in float vHeat;
in float vAlpha;
in vec3 vWorld;
uniform int uAsh;          // 0 the embers (added), 1 the ash (laid over)
uniform float uGain;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = dot(q, q);
  if (d > 1.0 || vAlpha <= 0.001) discard;
  float f = fogFactorAt(vWorld);
  if (uAsh == 1) {
    float k = (1.0 - d) * 0.55 * vAlpha * f;
    o = vec4(vec3(0.075, 0.06, 0.055) * uGain * k, k);   // premultiplied: a dark flake, the fog thinning it
    return;
  }
  float core = exp(-d * 5.0), halo = exp(-d * 1.6) * 0.35;
  vec3 hot = mix(vec3(0.9, 0.22, 0.04), vec3(1.0, 0.86, 0.5), vHeat * vHeat);
  o = vec4(hot * (core * 1.4 + halo) * vAlpha * f * uGain, 1.0);
}`;

/** The camera's basis and lens off a view and a projection (column-major): what the sky's triangle turns into rays. */
export function skyBasis(view, proj) {
  return {
    right: [view[0], view[4], view[8]],
    up: [view[1], view[5], view[9]],
    fwd: [-view[2], -view[6], -view[10]],
    lens: [proj[0], proj[5], proj[8], proj[9]],
  };
}

/** The sky's gain against the court's own fog: the frame's fog colour over COURT_FOG's, by its red (the lane scales
 *  all three alike). */
export function skyGain(fogColor, courtFogColor) {
  const want = courtFogColor?.[0] ?? 0, have = fogColor?.[0] ?? 0;
  return want > 0 && have > 0 ? Math.min(1.5, have / want) : 1;
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export class DeadlandsRenderer {
  constructor(gl) {
    this.gl = gl;
    this.sky = buildProgram(gl, DEAD_SKY_VS, DEAD_SKY_FS);
    this.sea = buildProgram(gl, DEAD_SEA_VS, DEAD_SEA_FS);
    this.us = {};
    for (const n of ['uRight', 'uUp', 'uFwd', 'uProj', 'uTime', 'uHaze', 'uGain', 'uFlash']) this.us[n] = gl.getUniformLocation(this.sky, n);
    this.ue = {};
    for (const n of ['uVP', 'uCentre', 'uTime', 'uHaze', 'uGain', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.ue[n] = gl.getUniformLocation(this.sea, n);
    // the sky's one triangle over the screen
    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    this.skyVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    // the sea's disc
    const verts = seaVertices();
    this.seaCount = verts.length / 2;
    this.seaVao = gl.createVertexArray();
    gl.bindVertexArray(this.seaVao);
    this.seaVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.seaVbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    // the air's life: one vertex a mote
    this.life = buildProgram(gl, DEAD_LIFE_VS, DEAD_LIFE_FS);
    this.ul = {};
    for (const n of ['uVP', 'uCentre', 'uTime', 'uPxPerM', 'uBraziers', 'uBrazierCount', 'uWind', 'uAsh', 'uGain', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.ul[n] = gl.getUniformLocation(this.life, n);
    const motes = lifeVertices();
    this.emberCount = SEA_EMBERS + BRAZIER_EMBERS * LIFE_BRAZIERS_MAX;
    this.ashCount = ASH_FLAKES;
    this.lifeVao = gl.createVertexArray();
    gl.bindVertexArray(this.lifeVao);
    this.lifeVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, motes, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    this._beds = new Float32Array(LIFE_BRAZIERS_MAX * 3);
    /** what the last draw drew, for the stats and the tests: 'sky', 'sea' - and the life's: 'ash', 'embers' */
    this.drawn = [];
    this.lifeDrawn = [];
  }

  /**
   * THE AIR'S LIFE - the ash laid over the frame and the embers added onto it, depth-tested and never written: after
   * the court's flats, beside its telegraph. `centre` the court's centre on its floor (the dungeon's frame),
   * `braziers` the fire beds in the court's frame (world/gateArena.js courtBraziers), `viewH` the world image's height in
   * pixels (RETRO1's - render/lightningBolts.js reads it the same way; the drawing buffer's when not handed).
   */
  drawLife(proj, view, centre, seconds, fog = null, gain = 1, braziers = [], viewH = 0) {
    const gl = this.gl;
    this.lifeDrawn = [];
    if (!Array.isArray(centre) || centre.length !== 3 || !centre.every(Number.isFinite)) return false;
    const L = this.ul;
    gl.useProgram(this.life);
    mat4Multiply(this._vp, proj, view);
    gl.uniformMatrix4fv(L.uVP, false, this._vp);
    gl.uniform3fv(L.uCentre, centre);
    gl.uniform1f(L.uTime, deadClock(seconds));
    gl.uniform2fv(L.uWind, deadlandsWind(seconds));
    gl.uniform1f(L.uPxPerM, (Math.max(1, viewH || gl.drawingBufferHeight || 720) * proj[5]) / 2);   // proj[5] = 1 / tan(fov / 2): a metre at one metre off, in pixels
    const beds = (Array.isArray(braziers) ? braziers : []).filter((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)).slice(0, LIFE_BRAZIERS_MAX);
    this._beds.fill(0);
    beds.forEach((p, i) => this._beds.set(p, i * 3));
    gl.uniform3fv(L.uBraziers, this._beds);
    gl.uniform1i(L.uBrazierCount, beds.length);
    gl.uniform1f(L.uGain, gain);
    gl.uniform1i(L.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(L.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(L.uFogRange, fog?.range ?? [0, 1]);
    gl.uniform3fv(L.uCamPos, fog?.camPos ?? [0, 0, 0]);
    gl.bindVertexArray(this.lifeVao);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    // the ash first, laid over (premultiplied); then the embers, added - light on whatever the ash left
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(L.uAsh, 1);
    gl.drawArrays(gl.POINTS, this.emberCount, this.ashCount);
    this.lifeDrawn.push('ash');
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1i(L.uAsh, 0);
    gl.drawArrays(gl.POINTS, 0, this.emberCount);
    this.lifeDrawn.push('embers');
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return true;
  }

  /**
   * Draw the sea (depth-tested and written) and then the sky (at the far plane, tested, never written) - in the court's
   * world pass after its solid geometry, before its flats. `centre` the court's centre on the sea's plane (the
   * dungeon's frame), `seconds` any clock (wrapped here), `fog` the frame's fog as the renderer set it ({ mode,
   * density, range, color, camPos }), `gain` skyGain's.
   */
  draw(proj, view, centre, seconds, fog = null, gain = 1) {
    const gl = this.gl;
    const t = deadClock(seconds);
    const haze = fog?.color ?? [0.32, 0.05, 0.02];
    const b = skyBasis(view, proj);
    const f = deadlandsFlash(t);
    this.drawn = [];
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    // THE SEA: solid - only what of it the court leaves showing burns
    if (Array.isArray(centre) && centre.length === 3 && centre.every(Number.isFinite)) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.useProgram(this.sea);
      const E = this.ue;
      mat4Multiply(this._vp, proj, view);
      gl.uniformMatrix4fv(E.uVP, false, this._vp);
      gl.uniform3fv(E.uCentre, centre);
      gl.uniform1f(E.uTime, t); gl.uniform3fv(E.uHaze, haze); gl.uniform1f(E.uGain, gain);
      gl.uniform1i(E.uFogMode, fog ? fog.mode : 0);
      gl.uniform1f(E.uFogDensity, fog?.density ?? 0);
      gl.uniform2fv(E.uFogRange, fog?.range ?? [0, 1]);
      gl.uniform3fv(E.uCamPos, fog?.camPos ?? [0, 0, 0]);
      gl.bindVertexArray(this.seaVao);
      gl.drawArrays(gl.TRIANGLES, 0, this.seaCount);
      this.drawn.push('sea');
    }
    // THE SKY: whatever nothing nearer has drawn
    gl.useProgram(this.sky);
    const S = this.us;
    gl.uniform3fv(S.uRight, b.right); gl.uniform3fv(S.uUp, b.up); gl.uniform3fv(S.uFwd, b.fwd); gl.uniform4fv(S.uProj, b.lens);
    gl.uniform1f(S.uTime, t); gl.uniform3fv(S.uHaze, haze); gl.uniform1f(S.uGain, gain);
    gl.uniform4f(S.uFlash, f ? f.az : 0, f ? f.elev : 0, f ? f.strength : 0, 0);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);   // PERF2: only where nothing nearer has drawn - z is the far plane
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawn.push('sky');
    gl.depthFunc(gl.LESS);   // PERF2: the renderer's own compare back
    gl.depthMask(true);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    return true;
  }
}
