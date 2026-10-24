// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA1 (bible/03-World/Bantha-Jungle.md; the owner: "When traveling inside the area there should be a fog-like haze
// that reduces visability ... not hurt performance. No band aids") - THE JUNGLE'S HAZE: how thick, how high, what
// colour, and what it hides. PURE - the host (scenes/jungleHost.js) hands it the frame's eye, clock and weather and
// hands its answer to the renderer (render/hazeGlsl.js is the shader's half: hazeTransmittance below is its CPU twin,
// term for term).
//
//   - WHERE. The haze's share is the jungle's own field (world/jungle/jungleRegion.js jungleDepthAt) read at the eye,
//     across a wider band than the trees' (JUNGLE_HAZE.edge: it drifts out past the last trees and thickens further in), so
//     walking into the jungle the air closes in over a kilometre, and never at a line.
//   - HOW THICK. Its extinction at the floor is JUNGLE_HAZE.density at full share, by the hour (JUNGLE_HAZE.day - the dawn's mist is
//     the thickest, the afternoon's the thinnest), by the weather (JUNGLE_HAZE.weather - rain thickens it), and by DRIFTING
//     BANKS: a slow value noise over the world (JUNGLE_HAZE.drift) blown along by the wind, so the air thins and thickens as
//     the player walks and waits.
//   - HOW HIGH. Whole up to a FLOOR - the canopy's height (JUNGLE_HAZE.layer) over the ground: the ground under the eye, or the
//     land about it (the eye's 3x3 of pixels' mean) where that is lower - and falling off by e every JUNGLE_HAZE.falloff
//     metres above it. In a valley the floor is the valley's; on a summit above the land about it the eye climbs out
//     and looks over a sea of haze.
//   - EASED. Share, density and floor each follow their target with their own lag (JUNGLE_HAZE.lag), never a step - a step
//     across the line, up a cliff or into a bank is a fade - and snap only where the eye jumped (a teleport, a load).
//   - ITS COLOUR. The weather's own fog colour (the sky's horizon by the hour) made humid: leaned to grey and to green
//     (JUNGLE_HAZE.grey, JUNGLE_HAZE.tint). The frame's one fog colour is the weather's and the haze's weighed by their extinctions
//     at JUNGLE_HAZE.weighAt (fogColorWith) - so the ground, the sky's horizon (hazeSkyUniform) and the far ring all close
//     into the same colour.
//   - WHAT IT HIDES. A box whose nearest point, at its highest, sends less than JUNGLE_HAZE.cull of its light to the eye is
//     drawn as nothing but haze colour - so it is not drawn (hazeHides: a bound, never a guess - the optical depth along
//     any ray into the box is at least the depth to its nearest point at its top height). Inside the jungle the streamed
//     world past a kilometre or so costs nothing: the haze PAYS for the jungle.
// ═══════════════════════════════════════════════════════════════════
import { ecoHash } from '../ecotone.js';
import { fogFactor } from '../weather.js';

/** The haze's numbers, in one place. Metres, seconds, hours. */
export const JUNGLE_HAZE = Object.freeze({
  /** the share across the jungle's line (m of depth, jungleDepthAt): none this far outside it, whole this far inside */
  edge: Object.freeze({ out: 320, in: 760 }),
  /** extinction at the floor (1/m) at full share, fair weather, the day's middling hour: 50% of the light at 126 m */
  density: 0.0055,
  /** the floor: this far over the ground (the canopy), and the falloff above it (m) */
  layer: 28,
  falloff: 90,
  /** the clear space about the eye (m) - the player's own hands and feet are never in haze */
  start: 8,
  /** the density's factor through the day: [hour, factor], read linearly between, round the clock */
  day: Object.freeze([
    Object.freeze([0, 1.25]), Object.freeze([4.5, 1.35]), Object.freeze([6.5, 1.65]), Object.freeze([9, 1.15]),
    Object.freeze([13, 0.82]), Object.freeze([16, 0.9]), Object.freeze([18.5, 1.08]), Object.freeze([21, 1.2]), Object.freeze([24, 1.25]),
  ]),
  /** ...by the weather (world/weather.js WEATHER_TYPES - DFU's WeatherType by name, and the port's sandstorm) */
  weather: Object.freeze({ sunny: 1, cloudy: 1.05, overcast: 1.12, fog: 1.4, rain: 1.3, thunder: 1.42, snow: 1.15, sandstorm: 1 }),
  /** the drifting banks: a value noise of `cell` metres, the density times 1 +- `amp`, blown at `speed` m/s along the
   *  wind (or `still` m/s east with none) */
  drift: Object.freeze({ cell: 540, amp: 0.24, speed: 1.6, still: 0.35, salt: 811 }),
  /** how slowly each follows its target (s): the share, the density and the floor */
  lag: Object.freeze({ share: 1.4, density: 2.5, floor: 3.5 }),
  /** an eye that moved this far (m) in one frame jumped: everything snaps to its target */
  jump: 250,
  /** the colour: leaned this far to its own grey, then tinted (normalised to keep its brightness) */
  grey: 0.42,
  tint: Object.freeze([0.88, 1.0, 0.85]),
  /** the distance (m) the weather's fog and the haze are weighed at for the frame's one colour */
  weighAt: 300,
  /** a box sending less than this share of its light through the haze is not drawn */
  cull: 1 / 512,
});

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The haze's share at a depth into the jungle (m): 0 past JUNGLE_HAZE.edge.out outside, 1 past JUNGLE_HAZE.edge.in inside. */
export const hazeShare = (depth) => smoothstep(-JUNGLE_HAZE.edge.out, JUNGLE_HAZE.edge.in, depth);

/** The day's factor at an hour (0-24, fractional). */
export function hazeDayFactor(hour) {
  const h = ((hour % 24) + 24) % 24, k = JUNGLE_HAZE.day;
  for (let i = 1; i < k.length; i++) {
    if (h <= k[i][0]) {
      const t = (h - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t;
    }
  }
  return k[k.length - 1][1];
}

/** The weather's factor (its WEATHER_TYPES name; anything else fair). */
export const hazeWeatherFactor = (weather) => (Object.hasOwn(JUNGLE_HAZE.weather, weather) ? JUNGLE_HAZE.weather[weather] : 1);

/** The drifting banks' factor at a world point (m - absolute, the floating origin's shift added by the caller) and a
 *  time (s), blown along `wind` ([x, z] - its way alone; null or still, east at JUNGLE_HAZE.drift.still): a smoothstepped
 *  value noise on the ecotone's own hash. */
export function hazeDrift(x, z, t, wind = null) {
  const d = JUNGLE_HAZE.drift, wl = wind ? Math.hypot(wind[0], wind[1]) : 0;   // the wind's way alone - the banks keep their own pace
  const wx = wl > 1e-6 ? (wind[0] / wl) * d.speed : d.still, wz = wl > 1e-6 ? (wind[1] / wl) * d.speed : 0;
  const qx = (x - wx * t) / d.cell, qz = (z - wz * t) / d.cell;
  const ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = ecoHash(ix, iz, d.salt), b = ecoHash(ix + 1, iz, d.salt), c = ecoHash(ix, iz + 1, d.salt), e = ecoHash(ix + 1, iz + 1, d.salt);
  const n = (a + (b - a) * ux) + ((c + (e - c) * ux) - (a + (b - a) * ux)) * uz;
  return 1 + d.amp * (2 * n - 1);
}

/** The mean density along a ray from height `a` to `b` - each in falloffs over the floor - as a share of the floor's
 *  (render/hazeGlsl.js hazeMean, term for term). */
export function hazeMean(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (hi <= 0) return 1;
  const span = hi - lo;
  if (span < 1e-4) return Math.exp(-Math.max(lo, 0));
  const lo0 = Math.max(lo, 0);
  return ((lo0 - lo) + (Math.exp(-lo0) - Math.exp(-hi))) / span;
}

/**
 * THE SHARE OF A POINT'S LIGHT THAT REACHES THE EYE through the haze (render/hazeGlsl.js hazeAt, term for term): 1
 * clear, 0 all haze. `u` the eight uniforms (hazeUniforms); `eye` and `p` [x, y, z].
 * @param {ArrayLike<number>} u @param {ArrayLike<number>} eye @param {ArrayLike<number>} p
 */
export function hazeTransmittance(u, eye, p) {
  if (!(u[4] >= 0.5)) return 1;
  const run = Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) - u[3];
  if (run <= 0) return 1;
  return Math.exp(-u[0] * run * hazeMean((eye[1] - u[1]) * u[2], (p[1] - u[1]) * u[2]));
}

/** A haze's live state, eased frame to frame (stepHaze). */
export function createHazeState() {
  return { share: 0, density: 0, floor: 0, eye: null, primed: false };
}

/**
 * THE FRAME'S STEP: each of share, density and floor eased toward its target by its lag (JUNGLE_HAZE.lag) over `dt`
 * seconds - snapped on the first frame, and wherever the eye jumped (JUNGLE_HAZE.jump).
 * @param {ReturnType<typeof createHazeState>} s
 * @param {{ dt: number, eye: ArrayLike<number>, share: number, density: number, floor: number }} target
 */
export function stepHaze(s, { dt, eye, share, density, floor }) {
  const jumped = !s.primed || !s.eye || Math.hypot(eye[0] - s.eye[0], eye[2] - s.eye[2]) > JUNGLE_HAZE.jump;
  s.share = eased(jumped, s.share, share, dt, JUNGLE_HAZE.lag.share);
  s.density = eased(jumped, s.density, density, dt, JUNGLE_HAZE.lag.density);
  s.floor = eased(jumped, s.floor, floor, dt, JUNGLE_HAZE.lag.floor);
  const e = (s.eye ??= [0, 0, 0]);   // AUDIT BANTHA1 HOST-8: the state's own, never a frame's allocation
  e[0] = eye[0]; e[1] = eye[1]; e[2] = eye[2];
  s.primed = true;
  return s;
}
const eased = (jumped, from, to, dt, lag) => (jumped ? to : from + (to - from) * (1 - Math.exp(-Math.max(0, dt) / lag)));

/**
 * THE EIGHT UNIFORMS (render/hazeGlsl.js uJungleHaze): [extinction at the floor, the floor's height, 1 / falloff, the clear
 * start, on, 0, 0, 0] - `out` written when handed. Off (on 0) where the share has gone.
 * @param {ReturnType<typeof createHazeState>} s @param {Float32Array} [out]
 */
export function hazeUniforms(s, out = new Float32Array(8)) {
  const k = s.share * s.density;
  out[0] = k; out[1] = s.floor; out[2] = 1 / JUNGLE_HAZE.falloff; out[3] = JUNGLE_HAZE.start;
  out[4] = k > 1e-7 ? 1 : 0; out[5] = 0; out[6] = 0; out[7] = 0;
  return out;
}

/** The extinction (1/m) at a height, under the uniforms: the floor's below it, falling off above. */
export const hazeDensityAt = (u, y) => (u[4] >= 0.5 ? u[0] * Math.exp(-Math.max(0, (y - u[1]) * u[2])) : 0);

/** The optical depth straight up from an eye at `y` - the floor's share under the floor and the falloff's above it. */
export function hazeColumn(u, y) {
  if (!(u[4] >= 0.5)) return 0;
  const under = Math.max(0, u[1] - y);
  return u[0] * (under + Math.exp(-Math.max(0, (y - u[1]) * u[2])) / u[2]);
}

/** The haze's own colour from the weather's fog colour: leaned to its grey and tinted, its brightness kept. */
export function hazeColorOf(fog, out = new Float32Array(3)) {
  const lum = 0.299 * fog[0] + 0.587 * fog[1] + 0.114 * fog[2];
  const t = JUNGLE_HAZE.tint, tl = 0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2];
  for (let c = 0; c < 3; c++) out[c] = Math.min(1, Math.max(0, (fog[c] + (lum - fog[c]) * JUNGLE_HAZE.grey) * (t[c] / tl)));
  return out;
}

/**
 * THE FRAME'S ONE FOG COLOUR: the weather's (`fogColor`, its row `fogRow` - weather.js's shape) and the haze's own,
 * weighed by their optical depths at JUNGLE_HAZE.weighAt from an eye at `eyeY` - each medium scatters in its own colour in
 * proportion to what it takes out. No haze, the weather's exactly.
 * @param {ArrayLike<number>} fogColor @param {any} fogRow @param {ArrayLike<number>} u hazeUniforms's @param {number} eyeY
 * @param {Float32Array} [out]
 */
const _hazeColour = new Float32Array(3);   // HOST-8: fogColorWith's scratch
export function fogColorWith(fogColor, fogRow, u, eyeY, out = new Float32Array(3)) {
  const th = hazeDensityAt(u, eyeY) * Math.max(0, JUNGLE_HAZE.weighAt - (u[3] ?? 0));
  if (!(th > 0)) { out[0] = fogColor[0]; out[1] = fogColor[1]; out[2] = fogColor[2]; return out; }
  const fw = fogRow ? fogFactor(fogRow, JUNGLE_HAZE.weighAt) : 1;
  const tw = -Math.log(Math.max(1e-4, Math.min(1, fw)));
  const h = hazeColorOf(fogColor, _hazeColour), w = th / (th + tw);
  for (let c = 0; c < 3; c++) out[c] = fogColor[c] + (h[c] - fogColor[c]) * w;
  return out;
}

/** The sky's uniform (render/hazeGlsl.js uHazeSky): the frame's fog colour and the depth straight up from the eye. */
export function hazeSkyUniform(color, u, eyeY, out = new Float32Array(4)) {
  out[0] = color[0]; out[1] = color[1]; out[2] = color[2]; out[3] = hazeColumn(u, eyeY);
  return out;
}

/**
 * WHETHER THE HAZE HIDES A BOX - every point of it sending less than JUNGLE_HAZE.cull of its light to the eye THROUGH THE
 * HAZE. A bound: the run to the box's nearest point, at the box's highest (where the layer is thinnest - hazeMean falls
 * as the far end rises), is the least any ray into it can cross. `box` [x0, y0, z0, x1, y1, z1] moved by `t` ([x, y, z]).
 * AUDIT BANTHA1 HOST-4: the haze ALONE - what a hidden box leaves is the sky (or the far ring) behind it, and the sky's
 * haze along that ray is the whole column past the box (hazeSkyMix: depth / rise), at least the box's own depth, so the
 * sky shown there is the fog colour the box would have drawn. The weather's fog multiplied in hid land the haze barely
 * touched (past 2.4 km at the haze's fringe) and showed a sky the weather never fogs (`excludeSky`) in its place.
 * @param {ArrayLike<number>} u @param {ArrayLike<number>} eye @param {ArrayLike<number>} box @param {ArrayLike<number>} [t]
 */
const ZERO3 = Object.freeze([0, 0, 0]);
export function hazeHides(u, eye, box, t = ZERO3) {
  if (!(u[4] >= 0.5)) return false;
  const nx = Math.max(box[0] + t[0] - eye[0], 0, eye[0] - (box[3] + t[0]));
  const ny = Math.max(box[1] + t[1] - eye[1], 0, eye[1] - (box[4] + t[1]));
  const nz = Math.max(box[2] + t[2] - eye[2], 0, eye[2] - (box[5] + t[2]));
  const d = Math.hypot(nx, ny, nz);
  const run = d - u[3];
  if (run <= 0) return false;
  return Math.exp(-u[0] * run * hazeMean((eye[1] - u[1]) * u[2], (box[4] + t[1] - u[1]) * u[2])) < JUNGLE_HAZE.cull;
}
