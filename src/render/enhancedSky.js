// THE ENHANCED SKY (ES1, 2026-08-27, Mac's call: "for the enhanced
// version of the game, I want us to develop our own take on the
// procedural sky system mod from DFU").
//
// Daggerfall's sky is 64 painted frames a day (SKY??.DAT) and one
// painted night (NITE??I0.IMG); DFU's Enhanced Sky mod (Lypyl) replaced
// them with a real sky - sun, two moons with phases, stars, cloud layers,
// weather - out of textures. This is OUR take, and it is entirely
// procedural: one fullscreen pass, no textures at all, so it ships
// with the port and needs no data. It lives behind the enhanced skin;
// the classic sky pass (skyRenderer.js) is untouched and stays verbatim.
//
// WHAT IS DFU'S AND WHAT IS OURS. The LAWS the sky reads are the port's
// verbatim ones: the sun's position (worldClock.sunDirection - dawn from
// map east, noon straight down), day and night (DawnHour 6 / DuskHour
// 18), the two moons' phases (gameDate.lunarPhase: Masser and Secunda on
// DFU's own 32-day ladder with its offsets), and the weather (weatherSim,
// WeatherManager verbatim). Everything that turns those into light is
// ours: the palette below, the moons' PLACES in the sky, the stars, the
// clouds.
//
// THE PALETTE IS A RECORD. `SKY_KEYS` is a table keyed by the sun's
// elevation in degrees - night, twilight, the horizon, the day - and
// every colour on the dome is an interpolation of it; `WEATHER_SKY` is
// a table per weather type. Change a row, change the sky. The shader
// carries no colours: it takes the interpolated palette as uniforms, so
// there is exactly one place a colour lives.
//
// THE MOONS' PLACES are our law with a physical spine: a moon sits on
// the sun's own arc, BEHIND the sun in the day's motion by its phase -
// new beside the sun (and so never seen at night), a waxing crescent a
// little behind it (in the west after sunset, setting soon after), full
// opposite it (rising as the sun sets, up all night), a waning half
// three quarters behind (rising at midnight, high at dawn) - so DFU's
// phase and the moon you see agree, and a lycanthrope's full moon is a
// full moon overhead at midnight. The terminator is a lit sphere, not
// a texture.

import { dayFraction, daylightScale, isNight } from '../world/worldClock.js';
import { lunarPhasesFromMinutes, LUNAR_PHASES } from '../systems/gameDate.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** The palette by the sun's elevation (degrees above the horizon).
 *  zenith / horizon: the dome's two ends. sun: the disc. glow: the
 *  colour and strength of the horizon glow on the sun's side. stars:
 *  how much of the star field shows. Between rows, everything is
 *  linear in elevation. */
export const SKY_KEYS = Object.freeze([
  { elev: -90, zenith: '#04060d', horizon: '#090c16', sun: '#000000', glow: '#000000', glowAmount: 0.0, stars: 1.0 },
  { elev: -18, zenith: '#060914', horizon: '#0f131f', sun: '#000000', glow: '#1a1420', glowAmount: 0.0, stars: 1.0 },
  { elev: -9,  zenith: '#0c1330', horizon: '#2b2238', sun: '#000000', glow: '#6a3a3a', glowAmount: 0.30, stars: 0.85 },
  { elev: -4,  zenith: '#1a2a5a', horizon: '#4e4258', sun: '#000000', glow: '#d6693a', glowAmount: 0.75, stars: 0.45 },
  // EE2 F3: THE SUNSET BAND. The ramp stepped -4 -> 0 -> 4, and the
  // whole of a sunrise or sunset happens inside those eight degrees, so
  // the most-looked-at sky in the game was one straight line between
  // three keys. Four keys where there were two, tuned in the lab: the
  // horizon goes ember, then peach; the zenith takes the violet that
  // exists for a few minutes either side of the horizon; the glow
  // swings warm and then cools as the sun clears the haze. The
  // interpolation is untouched - only the rungs are closer together
  // where the eye is looking.
  { elev: -2,  zenith: '#233674', horizon: '#8e6062', sun: '#e06a2c', glow: '#f07c3c', glowAmount: 0.92, stars: 0.24 },
  { elev: 0,   zenith: '#2c4d8e', horizon: '#c4a49a', sun: '#ffa64e', glow: '#ff9a4c', glowAmount: 1.0, stars: 0.10 },
  { elev: 2,   zenith: '#335ca4', horizon: '#e0b49c', sun: '#ffb96a', glow: '#ffac60', glowAmount: 0.84, stars: 0.03 },
  { elev: 4,   zenith: '#3a68b4', horizon: '#d9c6b4', sun: '#ffd39a', glow: '#ffbd7a', glowAmount: 0.6, stars: 0.0 },
  { elev: 7,   zenith: '#3c70c0', horizon: '#d2cfc8', sun: '#ffe0b8', glow: '#ffcf9c', glowAmount: 0.42, stars: 0.0 },
  { elev: 12,  zenith: '#3f77cc', horizon: '#c9dcf0', sun: '#ffefd2', glow: '#ffe1b8', glowAmount: 0.28, stars: 0.0 },
  { elev: 30,  zenith: '#336bc6', horizon: '#b6d0ec', sun: '#fff7e6', glow: '#fff0d8', glowAmount: 0.14, stars: 0.0 },
  { elev: 90,  zenith: '#2a5ab8', horizon: '#a8c8ea', sun: '#ffffff', glow: '#ffffff', glowAmount: 0.08, stars: 0.0 },
]);

/** The weather's hand on the sky: cloud cover (0..1), how soft the
 *  cloud edges are, how far the dome greys toward `grey`, the clouds'
 *  lit and shaded colours by day, and a wind (dome units per second). */
export const WEATHER_SKY = Object.freeze({
  sunny:    { cover: 0.32, soft: 0.34, grey: 0.00, lit: '#f4f6fa', shade: '#98a4b2', wind: [0.010, 0.004] },
  cloudy:   { cover: 0.55, soft: 0.28, grey: 0.25, lit: '#eef1f5', shade: '#8a95a2', wind: [0.016, 0.006] },
  overcast: { cover: 0.94, soft: 0.22, grey: 0.75, lit: '#a5adb6', shade: '#5f6873', wind: [0.014, 0.004] },
  fog:      { cover: 0.98, soft: 0.30, grey: 0.85, lit: '#aeb4ba', shade: '#7c838a', wind: [0.006, 0.002] },
  rain:     { cover: 0.97, soft: 0.20, grey: 0.85, lit: '#7f8890', shade: '#444b53', wind: [0.030, 0.010] },
  snow:     { cover: 0.95, soft: 0.26, grey: 0.80, lit: '#c3c8ce', shade: '#7f878f', wind: [0.012, 0.004] },
  thunder:  { cover: 1.00, soft: 0.18, grey: 0.95, lit: '#5b626b', shade: '#262b31', wind: [0.045, 0.016] },
});
export const GREY_ZENITH = '#66707c';
export const GREY_HORIZON = '#9aa3ac';

/** The moons: angular radius (radians) and colour. Masser is the big
 *  red one, Secunda the small pale one; Secunda rides a little higher. */
export const MOONS = Object.freeze({
  masser:  { radius: 0.040, color: '#d39a86', tilt: 0.00 },
  secunda: { radius: 0.021, color: '#e9e6dc', tilt: 0.22 },
});

/** The sun's angular radius (radians) - larger than the real sun, as
 *  every game sun is, so it reads at a glance. */
export const SUN_RADIUS = 0.032;

/* ── THE RETRO PASS (ES1e, 2026-08-27, Mac: "I really want to try and
   match the retro artwork aesthetic of Daggerfall") ──────────────────
   Daggerfall drew at 320x200 in a 256-colour palette, and its painted
   skies are 512x220 bitmaps the port already blits with NEAREST - so a
   smooth 24-bit dome next to a chunky classic sprite is the one thing
   in the enhanced sky that does NOT look like the game. Two knobs, both
   the era's own techniques rather than a filter over the top:

   PIXELS, AND THE RIGHT SIZE. Not a screen grid: the CLASSIC SKY'S OWN
   ANGULAR GRID. SKY??.DAT is 512 pixels across 180 degrees, which
   skyRenderer already names SKY_ANGLE_PER_PIXEL (PI/512), so the ray's
   azimuth and elevation are snapped to exactly that step before
   anything is computed. Three things follow, and they are the whole
   argument for doing it this way. The enhanced sky's pixels are the
   SAME SIZE as the painted sky's, so the two skins read as one game.
   They are fixed to the WORLD, not the screen - turn your head and the
   sky's pixels stay where they are, as a bitmap sky's do, instead of
   crawling with the camera. And they do not change with the field of
   view or the window, so a phone and a desktop see the same sky at the
   same scale. Everything is drawn ON that grid - the sun's disc, the
   moons' terminators, the stars, the cloud edges - so it is 1996 art
   rather than a modern render with a mosaic laid over it.

   LEVELS. Then the colour is posterised with an ORDERED (Bayer 4x4)
   dither - the exact thing a 256-colour gradient did in 1996, and the
   reason Daggerfall's own skies have that woven look up close. The
   smooth triangular dither of ES1c is for the SMOOTH pass; here the
   ordered one replaces it, because random noise on a posterised
   gradient is film grain and a Bayer pattern is a palette.

   `?sky=smooth` turns both off and keeps the modern dome. */
export const RETRO = Object.freeze({ step: Math.PI / 512, levels: 26 });   // step: SKY_ANGLE_PER_PIXEL, the painted sky's own pixel

/** ONE DOOR for the retro decision, so the game and the lab cannot
 *  disagree about what the sky looks like: retro unless `?sky=smooth`. */
export const retroFor = (search = globalThis.location?.search ?? '') =>
  (new URLSearchParams(search).get('sky') === 'smooth' ? null : RETRO);

/** The pole the star field turns about: north (+Z here, since the sun's
 *  arc is the XZ east-west line), leaned toward the zenith so the field
 *  wheels at an angle rather than spinning flat overhead. Ours - the
 *  Iliac Bay has no stated latitude. */
export const STAR_POLE = Object.freeze([0, 0.622244, 0.782823]);   // unit: the shader normalises anyway, but a direction should BE one

// ── THE CLOUD FIELD, ON THE CPU (ES1d) ───────────────────────────
// The shader's hash/value-noise/fbm, in JS, IDENTICALLY - so the port
// can ask "is a cloud in front of the sun right now" without reading a
// pixel back. The shader is the same three functions in GLSL, and
// test/enhancedSky.test.js pins the two texts against each other line
// for line, because a drift here is a sun that dims when the sky says
// it should not.
const fract = (x) => x - Math.floor(x);
export function hash21(x, y) {
  let px = fract(x * 123.34), py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d; py += d;
  return fract(px * py);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy), b = hash21(ix + 1, iy), c = hash21(ix, iy + 1), d = hash21(ix + 1, iy + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
export function fbm(x, y) {
  let v = 0, amp = 0.5, px = x, py = y;
  for (let i = 0; i < 5; i++) {
    v += amp * vnoise(px, py);
    const nx = px * 2.03 + 17.1, ny = py * 2.03 + 9.7;
    px = nx; py = ny; amp *= 0.5;
  }
  return v;
}
const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/** One deck's cover along a direction - the shader's `deck`, in JS. */
function deckCover(dir, scale, wind, cover, soft, time) {
  const k = 1 / (dir[1] + 0.18);
  const n = fbm(dir[0] * k * scale + wind[0] * time, dir[2] * k * scale + wind[1] * time);
  return smoothstep(1 - cover, 1 - cover + soft, n);
}

/**
 * ES1d - THE CLOUD IN FRONT OF THE SUN, 0..1 (Mac: the fifth fault).
 * The shader already draws it: the sun's disc is multiplied by
 * `1 - cloud` along the sun's own ray. This is that same number, on the
 * CPU, for the WORLD's light - so when a bank crosses the sun you SEE
 * the disc go and FEEL the ground go with it, and the two cannot
 * disagree, because it is one field evaluated at one direction.
 *
 * It is a dimming, not a projected shadow: the dome is infinitely far,
 * so the cover does not change as the player walks (a real cloud
 * shadow moves with the cloud, which this does - via the wind - and
 * with the walker, which this does not). Below the horizon there is no
 * sun to occlude and it is 0.
 */
export function sunOcclusion(state) {
  if (!state || state.sunDir[1] <= 0) return 0;
  const d = state.sunDir, w = state.wind, t = state.seconds;
  const hi = deckCover(d, 0.95, [w[0] * 0.55, w[1] * 0.55], state.cloudCover * 0.75, state.cloudSoft * 1.5, t);
  const lo = deckCover(d, 1.9, w, state.cloudCover, state.cloudSoft, t);
  const cov = clamp01(lo + hi * (1 - lo) * 0.7);
  // AUDIT 39 F54: the HORIZON term the shader applies to the same cover
  // before it dims the disc (`cloud = mix(cov, cov * uCloudCover, near)`)
  // - without it, a sun below ~16 degrees took up to half again as much
  // light off the ground as off the disc the player can still see, and
  // those are the hours the palette is built around.
  const near = smoothstep(0.28, 0, d[1]);
  // EE2 F4: thins exactly as the shader does - mix(cover, 1, 0.75)
  const thin = state.cloudCover + (1 - state.cloudCover) * 0.75;
  return cov * (1 - near) + cov * thin * near;
}

/** How much of the sun a full cover takes off the WORLD. Not 1: even
 *  under a solid deck the ground is lit, by the sky itself, and the
 *  weather's own sunlight scale (WeatherManager, verbatim) has already
 *  had its say - this is the moving cloud on top of that. */
export const CLOUD_SHADOW = 0.55;

/** Interpolate the palette at a sun elevation (degrees). Pure. */
export function paletteAt(elevDeg) {
  const keys = SKY_KEYS;
  if (elevDeg <= keys[0].elev) return rowOf(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (elevDeg <= keys[i].elev) {
      const a = keys[i - 1], b = keys[i];
      const t = (elevDeg - a.elev) / (b.elev - a.elev);
      return {
        zenith: mix3(hex(a.zenith), hex(b.zenith), t),
        horizon: mix3(hex(a.horizon), hex(b.horizon), t),
        sun: mix3(hex(a.sun), hex(b.sun), t),
        glow: mix3(hex(a.glow), hex(b.glow), t),
        glowAmount: a.glowAmount + (b.glowAmount - a.glowAmount) * t,
        stars: a.stars + (b.stars - a.stars) * t,
      };
    }
  }
  return rowOf(keys[keys.length - 1]);
}
const rowOf = (k) => ({ zenith: hex(k.zenith), horizon: hex(k.horizon), sun: hex(k.sun), glow: hex(k.glow), glowAmount: k.glowAmount, stars: k.stars });

/** The sun's place in the sky: worldClock's own arc - dawn at map east
 *  (+X), noon straight up, dusk at map west - CONTINUED below the
 *  horizon. sunDirection clamps its day fraction to [0, 1] because the
 *  sun rig is disabled at night; the sky needs to know how far under
 *  the horizon the sun is (twilight is a matter of degrees), so this
 *  takes the unclamped fraction (SunlightManager's t) through the same
 *  angle. Unit vector, y up; x is map east. */
export function sunSkyDirection(minuteOfDay) {
  const x = Math.PI * dayFraction(minuteOfDay);
  return [Math.cos(x), Math.sin(x), 0];
}

/** Rotate a vector about the Z axis (the sun's arc lies in the XY plane). */
function rotZ(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}
function rotX(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

/** Where a moon is: on the sun's arc, BEHIND the sun by its phase (new
 *  0, full half a turn - so a full moon rises as the sun sets and a
 *  waning half rises at midnight), tilted a little off the arc per
 *  moon. The arc runs east (+X) up (+Y) west (-X); behind is the
 *  negative turn about Z. */
export function moonSkyDirection(minuteOfDay, phase, tilt = 0) {
  const sun = sunSkyDirection(minuteOfDay);
  const p = phase === LUNAR_PHASES.None ? 0 : phase;   // 0..7, New=0 ... Full=4
  const angle = (p / 8) * Math.PI * 2;
  return rotX(rotZ(sun, -angle), tilt);
}

/* ── EV5: MOONLIGHT (Mac: "I want sunlight and moonlight to matter") ──
   The sky has computed both moons' directions, phases and
   visibilities every frame since ES1 and the world's light consumed
   none of it. The MASSER leads: it is the big moon, and its phase-lit
   fraction times its visibility (already dimmed by daylight and by the
   eased cloud cover - the same field the dome is drawn with) scales a
   second directional N.L term in the lit shaders, coloured like the
   disc. SECUNDA rides the AMBIENT: too small and too white for a
   readable second shadow direction, it lifts the night floor a little
   when it is up and lit. Both terms exist only while skyState answers
   night - by day the sun owns the sky - and only under the ENHANCED
   sky, because only it has this state at all: the classic lane keeps
   DFU's hard-off night verbatim. The two scales are the dials, the
   STUDIO_AMBIENT shape. */
export const MOONLIGHT = Object.freeze({
  masser: 0.25,    // full-Masser key scale (night ambient is 0.25 - a full moon roughly doubles a moonlit face)
  secunda: 0.06,   // full-Secunda ambient lift
});

/** How much of a moon's disc is lit, 0..1: New (0) none, Full (4)
 *  all, the halves half - the phase ring folded at Full. */
export function phaseLitFraction(phase) {
  const p = phase === LUNAR_PHASES.None ? 0 : phase;
  return p <= 4 ? p / 4 : (8 - p) / 4;
}

/** The world light's moon term for one frame, from skyState's own
 *  output: null when the sky is not night's, or when neither moon
 *  contributes. `dir`/`scale`/`color` drive the second directional
 *  term (the masser); `ambient` is secunda's additive floor lift. */
export function moonlightTerm(state) {
  if (!state.night) return null;
  const key = MOONLIGHT.masser * phaseLitFraction(state.masser.phase) * state.masser.vis;
  const lift = MOONLIGHT.secunda * phaseLitFraction(state.secunda.phase) * state.secunda.vis;
  if (key <= 0 && lift <= 0) return null;
  const sc = state.secunda.color;
  return {
    dir: state.masser.dir,
    scale: key,
    color: state.masser.color,
    ambient: [sc[0] * lift, sc[1] * lift, sc[2] * lift],
  };
}

/** Fold the secunda lift into a host's ambient, in place (the hosts
 *  mint the ambient array fresh each frame - no second allocation). */
export function withMoonAmbient(ambient, moon) {
  if (!moon) return ambient;
  ambient[0] += moon.ambient[0];
  ambient[1] += moon.ambient[1];
  ambient[2] += moon.ambient[2];
  return ambient;
}

/** THE WEATHER'S HAND, EASED (ES1c). The sim flips its type on one
 *  frame - sunny to rain, between two ticks - and the sky was rebuilt
 *  from the type every frame, so the whole dome changed in the time it
 *  takes to draw once. A weather row is a set of NUMBERS, so the sky
 *  keeps its own and walks them toward the row the sim is asking for:
 *  cover, softness, greyness, wind and the two cloud colours, all on
 *  one time constant. Pure and injectable: `dt` in, the eased row out.
 *  (The same lesson as the danger meter's slew - a slow, meaningful
 *  state should arrive slowly, and nothing about a sky changes in a
 *  frame.) */
export const WEATHER_EASE_SECONDS = 14;

export function easeWeather(from, to, dt, seconds = WEATHER_EASE_SECONDS) {
  if (!from) return { ...to };
  const k = seconds <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / seconds);
  const n = (a, b) => a + (b - a) * k;
  const v3 = (a, b) => [n(a[0], b[0]), n(a[1], b[1]), n(a[2], b[2])];
  return {
    cover: n(from.cover, to.cover), soft: n(from.soft, to.soft), grey: n(from.grey, to.grey),
    wind: [n(from.wind[0], to.wind[0]), n(from.wind[1], to.wind[1])],
    lit: v3(from.lit, to.lit), shade: v3(from.shade, to.shade),
  };
}

/** A weather row as numbers (colours resolved), for the ease. */
export const weatherRow = (weather) => {
  const w = WEATHER_SKY[weather] ?? WEATHER_SKY.sunny;
  return { cover: w.cover, soft: w.soft, grey: w.grey, wind: [...w.wind], lit: hex(w.lit), shade: hex(w.shade) };
};

/** The whole state the shader takes for one frame. Pure but for the
 *  clock it is handed. `row` overrides the weather's numbers with an
 *  eased set (the controller keeps one and walks it). */
export function skyState({ minuteOfDay, weather = 'sunny', classicMinutes = 0, seconds = 0, phases = null, row = null }) {
  const sunDir = sunSkyDirection(minuteOfDay);
  const elevDeg = Math.asin(Math.max(-1, Math.min(1, sunDir[1]))) * 180 / Math.PI;
  const pal = paletteAt(elevDeg);
  const w = row ?? weatherRow(weather);
  const day = daylightScale(minuteOfDay);
  // Weather greys the dome and hides the sun, the stars and the moons.
  const zenith = mix3(pal.zenith, hex(GREY_ZENITH), w.grey * (0.35 + 0.65 * day));
  const horizon = mix3(pal.horizon, hex(GREY_HORIZON), w.grey * (0.35 + 0.65 * day));
  const cloudLitDay = w.lit, cloudShadeDay = w.shade;
  // By night the clouds are the night's own colour, faintly lit by the moons.
  const nightLit = [0.16, 0.19, 0.25], nightShade = [0.07, 0.09, 0.13];
  const twilight = clamp01((elevDeg + 12) / 16);   // 0 well below the horizon, 1 by day
  const lit = mix3(nightLit, mix3(cloudLitDay, pal.sun, 0.25 * (1 - clamp01(elevDeg / 20))), twilight);
  const shade = mix3(nightShade, cloudShadeDay, twilight);
  const ph = phases ?? lunarPhasesFromMinutes(classicMinutes);
  const moon = (name, phase) => {
    const m = MOONS[name];
    const dir = moonSkyDirection(minuteOfDay, phase, m.tilt);
    const vis = dir[1] > -0.05 ? clamp01(1 - 0.9 * day) * (1 - w.cover * 0.35) : 0;   // faint by day; the clouds themselves hide it where they are
    return { dir, radius: m.radius, color: hex(m.color), vis, phase };
  };
  // ES1c: the field's turn. One full revolution a day about the pole -
  // the same clock the sun rides, so the two agree - and the pole is
  // north, tilted off the zenith the way a sky's is anywhere but the
  // pole itself.
  const starAngle = (minuteOfDay / 1440) * Math.PI * 2;
  const state = {
    sunDir, elevDeg, starAngle, starPole: STAR_POLE,
    zenith, horizon, sun: pal.sun, glow: pal.glow,
    glowAmount: pal.glowAmount * (1 - w.grey * 0.7),
    sunVis: sunDir[1] > -0.02 ? 1 : 0,               // the clouds occlude the disc where they are (shader)
    stars: pal.stars * (1 - w.cover * 0.5),          // a hazy sky dims the field; the clouds hide it where they are
    masser: moon('masser', ph.masser), secunda: moon('secunda', ph.secunda),
    cloudCover: w.cover, cloudSoft: w.soft, cloudLit: lit, cloudShade: shade,
    wind: w.wind, seconds,
    night: isNight(minuteOfDay),
    // What the hosts read for the distance haze and the clear (the
    // classic pass's clearColor/fillColor roles).
    clearColor: horizon, fillColor: zenith,
  };
  // ES1d: the cloud in front of the sun, for the world's light.
  state.sunOcclusion = sunOcclusion(state);
  return state;
}

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.9999, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform float uYaw, uPitch, uTanHalfFov, uAspect;
uniform vec3 uZenith, uHorizon, uSunColor, uGlowColor, uCloudLit, uCloudShade, uFogColor;
uniform vec3 uSunDir;
uniform float uSunRadius, uSunVis, uGlowAmount, uStars;
uniform vec4 uMoonA, uMoonB;          // xyz direction, w radius
uniform vec3 uMoonAColor, uMoonBColor;
uniform float uMoonAVis, uMoonBVis;
uniform float uCloudCover, uCloudSoft, uTime;
uniform vec2 uWind;
uniform float uFogMix;
uniform vec3 uStarPole;
uniform float uStarAngle;
uniform float uRetroStep;   // 0 = the smooth pass; else the angular pixel (radians)
uniform float uRetroLevels; // 0 = no posterise

// ES1f: A CELL ON THE CUBE, NOT ON A LAT-LONG GRID.
// Snapping azimuth and elevation put the grid's POLE at the zenith:
// the elevation rings became concentric circles and the azimuth cells
// converged to nothing, so looking straight up was a bullseye with
// everything woven into it. A cube has no pole. The direction is
// projected onto whichever of the six faces it points at, snapped on
// that face's square grid, and rebuilt - cells stay near-square
// everywhere, the zenith is an ordinary patch of an ordinary face, and
// the only cost is the cube's own mild corner distortion, which has no
// centre for the eye to find.
// The n argument is cells per face; the cell id (with the face folded in) comes
// back in cellOut for the dither and the star field.
vec3 cubeSnap(vec3 dir, float n, out vec2 cellOut) {
  vec3 a = abs(dir);
  float m = max(a.x, max(a.y, a.z));
  vec2 raw; float face;
  if (a.x >= m) { raw = dir.zy / a.x; face = dir.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= m) { raw = dir.xz / a.y; face = dir.y > 0.0 ? 2.0 : 3.0; }
  else { raw = dir.xy / a.z; face = dir.z > 0.0 ? 4.0 : 5.0; }
  // EQUI-ANGULAR faces (ES1f, second pass). A plain cube face is a
  // TANGENT plane, so its cells cover 2.6x less sky at the corners than
  // at the centre - and a cell size that varies across the frame beats
  // against the screen's own grid and draws curved moire rings, which
  // is the pole artifact's ghost rather than its cure. Warping the face
  // by atan (the equi-angular cubemap of 360 video) makes every cell
  // the SAME ANGLE everywhere, so the grid reads as an even bitmap in
  // every direction. A face spans 90 degrees, so n = (PI/2)/step gives
  // the painted sky's pixel: 256 a face, 512 across 180 degrees, which
  // is SKY??.DAT's own width.
  vec2 uv = atan(raw) * 1.27323954;                 // 4/PI: [-1,1] over the face
  vec2 cell = floor(uv * n);
  vec2 t = tan((cell + 0.5) / n * 0.78539816);      // PI/4: back to the tangent plane
  // AUDIT 39 F53: cellOut is CONTINUOUS - the cell id is floor(cellOut),
  // and its fraction is where the fragment sits INSIDE the cell, which
  // is what the star field draws a star at. Handing back the floored id
  // made fract() of it exactly zero, so the bright first star layer
  // could not produce a lit pixel anywhere on the sphere. Callers floor
  // it for the id; the face offset is integral, so flooring here or
  // there names the same cell.
  cellOut = uv * n + face * 977.0;                  // a face's cells are its own
  if (a.x >= m) return normalize(vec3(sign(dir.x), t.y, t.x));
  if (a.y >= m) return normalize(vec3(t.x, sign(dir.y), t.y));
  return normalize(vec3(t.x, t.y, sign(dir.z)));
}

// Bayer 4x4, the ordered dither a 256-colour gradient used.
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[i] / 16.0;
}
out vec4 outColor;

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1, 0)), c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }
  return v;
}

// ES1c: ONE CLOUD DECK. The far deck is given a smaller, slower,
// thinner treatment; sunAz is how much this ray points at the sun,
// which is what lights the deck. Returns cover (x) and the noise the
// colour is chosen by (y).
vec2 deck(vec3 dir, float scale, vec2 wind, float cover, float soft, float bias) {
  // EE2 F1: THE DECK STOPPED AT THE HORIZON. This projection runs away
  // as the ray flattens - at the horizon the lookup reaches the tens of
  // thousands, a float32 loses its fraction, and the noise returns a
  // CONSTANT, so the last band of sky carried no cloud whatever the
  // cover said. It is the largest part of the sky and the part a
  // player looks at most. Capped, the coordinates stay in a range the
  // noise can resolve and the deck runs to the horizon.
  vec2 p = dir.xz * min(1.0 / (dir.y + 0.18), 9.0) * scale + wind * uTime;
  float n = fbm(p) + bias;
  float cov = smoothstep(1.0 - cover, 1.0 - cover + soft, n);
  return vec2(cov, n);
}

vec3 moon(vec3 dir, vec4 m, vec3 col, float vis) {
  if (vis <= 0.0) return vec3(0.0);
  vec3 md = m.xyz; float r = m.w;
  float cosA = dot(dir, md);
  if (cosA < cos(r * 1.6)) return vec3(0.0);
  vec3 up = abs(md.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 ex = normalize(cross(up, md)); vec3 ey = cross(md, ex);
  vec2 uv = vec2(dot(dir, ex), dot(dir, ey)) / r;
  float rr = dot(uv, uv);
  float disc = 1.0 - smoothstep(0.88, 1.06, rr);
  // The sphere's normal at this point of the disc, facing the viewer.
  vec3 n = normalize(ex * uv.x + ey * uv.y - md * sqrt(max(0.0, 1.0 - min(rr, 1.0))));
  float lit = smoothstep(-0.06, 0.16, dot(n, uSunDir));
  float limb = 0.85 + 0.15 * (1.0 - rr);
  return col * (0.05 + 0.95 * lit) * limb * disc * vis;
}

float stars(vec3 dir, float amount) {
  if (amount <= 0.0 || dir.y < 0.0) return 0.0;
  float s = 0.0;
  // ES1c: THE FIELD WHEELS. The stars were fixed in world space, so
  // midnight's sky was dusk's sky exactly - the one thing about a night
  // sky everybody has seen is that it turns. It turns about a POLE
  // (uStarPole: north, tilted off the zenith), by uStarAngle, which the
  // clock advances a full turn a day, so the field rises in the east
  // and sets in the west like everything else.
  vec3 axis = normalize(uStarPole);
  float ca = cos(uStarAngle), sa = sin(uStarAngle);
  vec3 d = dir * ca + cross(axis, dir) * sa + axis * dot(axis, dir) * (1.0 - ca);   // Rodrigues
  // ES1f: the field is cast on the CUBE too. On a lat-long grid the
  // cells converged at the pole - a pinwheel of stars - and the density
  // piled up there, which is exactly wrong: a star field is even.
  for (int layer = 0; layer < 2; layer++) {
    // The cube covers the sphere with 6n^2 cells where the lat-long grid
    // used ~2*pi^2*scale^2, so the same star density wants a bigger n:
    // 6n^2 = 2*pi^2*70^2 gives n ~ 127, and the second layer follows.
    float scale = layer == 0 ? 127.0 : 236.0;

    // EE2 F2: THE STARS WERE RULED INTO ROWS. cubeSnap returns the
    // cell's INTEGER id, and fract() of an integer is a CONSTANT - so
    // every star sat at the same offset inside its cell, and a field of
    // stars all at one sub-cell position is a grid of lines. The cell
    // and the position must be the floor and the fract OF ONE NUMBER:
    // the face is chosen once, its equi-angular coordinate computed
    // once, and there is nothing left to disagree about.
    vec3 ad2 = abs(d);
    float md2 = max(ad2.x, max(ad2.y, ad2.z));
    vec2 raw2; float face2;
    if (ad2.x >= md2) { raw2 = d.zy / ad2.x; face2 = d.x > 0.0 ? 0.0 : 1.0; }
    else if (ad2.y >= md2) { raw2 = d.xz / ad2.y; face2 = d.y > 0.0 ? 2.0 : 3.0; }
    else { raw2 = d.xy / ad2.z; face2 = d.z > 0.0 ? 4.0 : 5.0; }
    vec2 g = atan(raw2) * 1.27323954 * scale + vec2(face2 * 977.0 + float(layer) * 31.7);
    vec2 cell = floor(g), f = fract(g);
    float h = hash21(cell + 7.3 * float(layer));
    float thresh = layer == 0 ? 0.955 : 0.985;
    if (h > thresh) {
      vec2 star = vec2(hash21(cell + 1.1), hash21(cell + 2.2)) * 0.7 + 0.15;
      float d = length(f - star);
      float b = 0.35 + 0.65 * (h - thresh) / (1.0 - thresh);
      s += b * (layer == 0 ? 1.4 : 0.8) * exp(-d * d * 60.0);
    }
  }
  return s * amount * smoothstep(0.0, 0.08, dir.y);   // the fade is on the REAL elevation: a star sets where the horizon is
}

void main() {
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 dir = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));

  // ES1e: THE ANGULAR PIXEL, on the painted sky's own scale
  // (SKY_ANGLE_PER_PIXEL) - and ES1f: on a CUBE, so it has no pole. The
  // direction is snapped BEFORE anything is computed, so every feature
  // below is drawn on the grid and the pixels are fixed to the world
  // rather than to the screen. The faces are equi-angular, so a face's
  // 90 degrees over n cells makes every cell exactly one step wide:
  // n = (PI/2)/step is 256 a face, 512 across 180 degrees - SKY??.DAT.
  vec2 cell = vec2(0.0);
  if (uRetroStep > 0.0) dir = cubeSnap(dir, 1.57079633 / uRetroStep, cell);
  cell = floor(cell);                               // F53: bayer4 indexes the CELL, not its interior

  // The dome: horizon to zenith.
  float e = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(uHorizon, uZenith, pow(e, 0.55));
  // BELOW THE HORIZON the terrain is what a player sees, but the sky is
  // drawn first and shows wherever the ground does not reach - and a
  // flat slab of the horizon colour with the full dawn glow on it read
  // as a bright BAND with a hard seam at the horizon (the first
  // render's one fault). So the dome keeps going down: the horizon
  // colour darkens toward the nadir, and the glow falls off below the
  // horizon as fast as it does above it, so the horizon is a line
  // rather than an edge.
  float below = clamp(-dir.y, 0.0, 1.0);
  color = mix(color, uHorizon * 0.55, pow(below, 0.7));

  // The glow on the sun's side of the horizon (dawn, dusk).
  vec2 dh = normalize(dir.xz + vec2(1e-5, 0.0));
  vec2 sh = normalize(uSunDir.xz + vec2(1e-5, 0.0));
  float az = max(dot(dh, sh), 0.0);
  color += uGlowColor * pow(az, 2.5) * exp(-abs(dir.y) * 9.0) * uGlowAmount;

  // Stars, then the moons, under the clouds.
  color += vec3(0.95, 0.97, 1.0) * stars(dir, uStars);
  color += moon(dir, uMoonA, uMoonAColor, uMoonAVis);
  color += moon(dir, uMoonB, uMoonBColor, uMoonBVis);

  // The sun: a disc and a halo.
  float cosSun = dot(dir, uSunDir);
  float disc = smoothstep(cos(uSunRadius), cos(uSunRadius * 0.6), cosSun) * uSunVis;
  float halo = (pow(max(cosSun, 0.0), 40.0) * 0.55 + pow(max(cosSun, 0.0), 8.0) * 0.10) * uSunVis;

  // ES1c: TWO DECKS, LIT BY THE SUN. One fbm sheet coloured by its own
  // noise was a smear: it had no depth (nothing moved against anything)
  // and no idea where the sun was, so a bank never had a bright rim and
  // never had a dark belly. Now a HIGH deck - small, slow, thin - sits
  // behind a LOW one - large, faster, thicker - and both are lit by
  // sunAz, how far this ray is from the sun: toward the sun a bank is
  // rimmed (the light coming through its edge), away from it the thick
  // parts go to the shade colour. The lighting fades out at night with
  // the palette's own sun colour, which is black below the horizon.
  float cloud = 0.0;
  if (dir.y > 0.0) {
    float near = smoothstep(0.28, 0.0, dir.y);
    vec2 hi = deck(dir, 0.95, uWind * 0.55, uCloudCover * 0.75, uCloudSoft * 1.5, 0.0);
    vec2 lo = deck(dir, 1.9, uWind, uCloudCover, uCloudSoft, 0.0);
    // The low deck covers the high one where it is; what is left of the
    // high deck shows through the gaps.
    float covHi = hi.x * (1.0 - lo.x) * 0.7;
    float cov = lo.x + covHi;
    // EE2 F4: the deck was thinned toward the horizon by multiplying
    // cover BY cover - at half cover a QUARTER of the cloud where the
    // sky is largest, so an overcast day kept a clear rim all round.
    // The haze stays (a deck does go pale with distance); the thinning
    // goes. sunOcclusion below mirrors this exactly, because that
    // function exists so the shadow on the ground and the dimming of
    // the disc cannot disagree.
    cloud = mix(cov, cov * mix(uCloudCover, 1.0, 0.75), near);
    float n = mix(hi.y, lo.y, lo.x);                       // the deck in front decides the colour
    float sunAz = max(dot(dir, uSunDir), 0.0);
    // The rim: strongest at the thin edges of a bank, and only near the sun.
    float edge = 1.0 - abs(n - (1.0 - uCloudCover)) * 3.0;
    float rim = clamp(edge, 0.0, 1.0) * pow(sunAz, 3.0);
    float thick = smoothstep(0.45, 0.95, n);
    vec3 cc = mix(uCloudShade, uCloudLit, thick * 0.75 + 0.25 * pow(sunAz, 1.5));
    cc += uSunColor * rim * 0.55 * uSunVis;                 // lit through the edge
    cc = mix(cc, cc * 0.86, (1.0 - pow(sunAz, 0.7)) * thick);   // the belly away from the sun
    cc = mix(cc, mix(uHorizon, cc, 0.55), near);            // into the haze at the horizon
    color = mix(color, cc, cloud);
  }
  color += uSunColor * disc * (1.0 - cloud) + uSunColor * halo * (1.0 - 0.7 * cloud);

  // ES1c: DITHER. A dome is one big smooth gradient and eight bits is
  // not enough for one: 46% of the rows in a noon frame came out
  // byte-identical to the row above, which is a visible stair. A
  // sub-bit of hash noise before the write breaks the stair and costs
  // two instructions; it is about one quantisation step, so it is never
  // itself visible. TRIANGULAR, not flat: two hashes summed give the
  // error a triangular distribution, which is the shape that fully
  // decorrelates it from the signal - a flat one left a third of the
  // rows still identical to the row above.
  vec3 out3 = mix(clamp(color, 0.0, 1.0), uFogColor, uFogMix);
  if (uRetroLevels > 0.0) {
    // ES1e: posterise with an ORDERED dither, indexed by the ANGULAR
    // cell - one Bayer cell per sky pixel, or it is a fine weave under a
    // coarse one, which is two eras at once, and it would crawl when the
    // camera turned.
    float b = bayer4(uRetroStep > 0.0 ? cell : gl_FragCoord.xy) - 0.5;
    out3 = floor(out3 * uRetroLevels + 0.5 + b) / uRetroLevels;
  } else {
    // The SMOOTH pass's dither. Interleaved gradient noise, not a hash:
    // the hash of ES1c measured well (46% of identical rows to 25%) but
    // it is STRUCTURED at integer coordinates - a visible weave under
    // magnification, which is the one thing a dither must not be. IGN is
    // the standard for exactly this and is three constants.
    float ign = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
    out3 += (ign - 0.5) / 255.0;
  }
  outColor = vec4(out3, 1.0);
}`;

/** The pass. Same contract as SkyRenderer: draw(yaw, pitch, fovY, aspect)
 *  after beginFrame; fogMix / fogColor set by the host; clearColor /
 *  fillColor read by the host for the haze. */
export class EnhancedSkyRenderer {
  constructor(gl) {
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.program = prog;
    this.u = {};
    for (const name of ['uYaw', 'uPitch', 'uTanHalfFov', 'uAspect', 'uZenith', 'uHorizon', 'uSunColor', 'uGlowColor', 'uCloudLit', 'uCloudShade',
      'uFogColor', 'uSunDir', 'uSunRadius', 'uSunVis', 'uGlowAmount', 'uStars', 'uMoonA', 'uMoonB', 'uMoonAColor', 'uMoonBColor',
      'uMoonAVis', 'uMoonBVis', 'uCloudCover', 'uCloudSoft', 'uTime', 'uWind', 'uFogMix', 'uStarPole', 'uStarAngle',
      'uRetroStep', 'uRetroLevels']) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.fogMix = 0;
    this.fogColor = new Float32Array([0.5, 0.5, 0.5]);
    this.clearColor = new Float32Array([0.66, 0.78, 0.92]);
    this.fillColor = new Float32Array([0.17, 0.35, 0.72]);
    this.state = null;
    // ES1e: the retro pass, on by default - Mac's call. `?sky=smooth`
    // clears it and the modern dome comes back.
    this.retro = RETRO;
  }

  /** The frame's state (skyState). Cheap: numbers into fields. */
  setState(state) {
    this.state = state;
    this.clearColor = new Float32Array(state.clearColor);
    this.fillColor = new Float32Array(state.fillColor);
  }

  draw(yaw, pitch, fovY, aspect) {
    const s = this.state;
    if (!s) return;
    const gl = this.gl, u = this.u;
    // EV6: no program save/restore and no getParameter round-trip -
    // the R9 law, as the classic pass; the hosts mark the seam.
    gl.useProgram(this.program);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform3fv(u.uZenith, s.zenith); gl.uniform3fv(u.uHorizon, s.horizon);
    gl.uniform3fv(u.uSunColor, s.sun); gl.uniform3fv(u.uGlowColor, s.glow);
    gl.uniform3fv(u.uCloudLit, s.cloudLit); gl.uniform3fv(u.uCloudShade, s.cloudShade);
    gl.uniform3fv(u.uFogColor, this.fogColor);
    gl.uniform3fv(u.uSunDir, s.sunDir);
    gl.uniform1f(u.uSunRadius, SUN_RADIUS); gl.uniform1f(u.uSunVis, s.sunVis);
    gl.uniform1f(u.uGlowAmount, s.glowAmount); gl.uniform1f(u.uStars, s.stars);
    gl.uniform4f(u.uMoonA, s.masser.dir[0], s.masser.dir[1], s.masser.dir[2], s.masser.radius);
    gl.uniform4f(u.uMoonB, s.secunda.dir[0], s.secunda.dir[1], s.secunda.dir[2], s.secunda.radius);
    gl.uniform3fv(u.uMoonAColor, s.masser.color); gl.uniform3fv(u.uMoonBColor, s.secunda.color);
    gl.uniform1f(u.uMoonAVis, s.masser.vis); gl.uniform1f(u.uMoonBVis, s.secunda.vis);
    gl.uniform1f(u.uCloudCover, s.cloudCover); gl.uniform1f(u.uCloudSoft, s.cloudSoft);
    gl.uniform1f(u.uTime, s.seconds); gl.uniform2f(u.uWind, s.wind[0], s.wind[1]);
    gl.uniform1f(u.uFogMix, this.fogMix);
    gl.uniform3fv(u.uStarPole, s.starPole);
    gl.uniform1f(u.uStarAngle, s.starAngle);
    gl.uniform1f(u.uRetroStep, this.retro ? this.retro.step : 0);
    gl.uniform1f(u.uRetroLevels, this.retro ? this.retro.levels : 0);
    // HANDEDNESS: as the classic pass - the triangle winds CCW under a
    // CW front face, so culling is off for it.
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }
}
