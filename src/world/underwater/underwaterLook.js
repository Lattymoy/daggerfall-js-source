// @ts-check
// ═══════════════════════════════════════════════════════════════════
// UNDER-LOOK and UNDER-RAYS (FIELD BUGS 2026-10-01 #4, #5): "Underwater
// should have a water look to it, not as clear", and "Underwater should
// have sun rays that dynamically show through the water". The port's own
// look over Iliac Puddle No More's sea, a DEPARTURE from the mod (Mac:
// "We're our own thing now"); what the mod draws - its distance fog
// (deepWaterLook.js distanceFogUniforms, per fragment in every world
// program) - stands, made thicker here and coloured over by the port's
// pass (render/deepWatersRender.js drawUnderwaterLook).
//
// Why the sea read as clear: the mod's fog leaves a pixel at the eye
// untouched and takes it to the fog's colour over its vision distance
// (66.5 m at the sliders' defaults), absorbing ~2% of its red a metre;
// the world fog over it is a thin neutral grey; nothing tints the water
// body and nothing lights it. So a swimmer at 2 m saw the seabed 20 m off
// at four fifths of its own colour, and no hue at all.
//
//   THE MURK: the mod's vision distance, times UNDERWATER_MURK - every
//   term the fog derives from it (the absorption and scatter per metre,
//   the bands it closes over, the sky's distance) follows, so the
//   sliders still scale it as they did.
//   THE BODY: a pixel of the frame becomes c * keep + body - the water
//   takes red first, then green; it keeps less, and adds less light, the
//   deeper the eye and the darker the day.
//   THE SHAFTS: the sun, refracted at the surface (Snell, n = 1.333), lit
//   through a drifting pattern of the surface's focus - each point the
//   view's ray crosses is lit by the surface where the light reaching it
//   came in - so the rays lean with the sun, converge toward it, sweep as
//   the surface moves and fade with the eye's depth, with night, and
//   with a cloud over the sun (the frame's own sun scale).
//
// Pure: the pass reads these; test/world/fb1001_underwater.test.js pins them.
// ═══════════════════════════════════════════════════════════════════

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The sea's vision distance under the port's look, as a share of the mod's. */
export const UNDERWATER_MURK = 0.55;
/** Water's index of refraction (air 1). */
export const WATER_REFRACTION = 1.333;
/** What the water body keeps of a pixel at the surface, and at BODY_DEEP_M under it: red goes first. */
export const BODY_KEEP = Object.freeze([0.66, 0.86, 0.88]);
export const BODY_KEEP_DEEP = Object.freeze([0.26, 0.48, 0.55]);
/** The depth (m) the body's keep reaches BODY_KEEP_DEEP at. */
export const BODY_DEEP_M = 40;
/** The light the body adds, at full daylight and at the surface; to NIGHT_BODY_SHARE of it by night. */
export const BODY_COLOR = Object.freeze([0.016, 0.075, 0.085]);
export const NIGHT_BODY_SHARE = 0.2;
/** The shafts' strength at the surface under a full sun, and the eye depth (m) they fall by e over. */
export const SHAFT_STRENGTH = 0.9;
/** The water's colour on the sun's light along a shaft. */
export const SHAFT_TINT = Object.freeze([0.72, 0.96, 0.92]);
export const SHAFT_FADE_M = 28;
/** How far (m) the shafts are marched along the view - the near water, where a shaft reads. */
export const SHAFT_REACH_M = 24;

/**
 * The direction toward the light, under the surface: the sun's, bent at
 * the water (Snell's law), so its angle from straight up shrinks by the
 * index. null when the sun is under the horizon - no shaft by night.
 * @param {ArrayLike<number>} toSun - unit, world, toward the sun
 * @param {number[]} [out]
 * @returns {number[]|null}
 */
export function refractedSun(toSun, out = [0, 0, 0]) {
  const y = toSun[1];
  if (!(y > 0)) return null;
  const h = Math.hypot(toSun[0], toSun[2]);   // sin of the angle from straight up (toSun is unit)
  const sinW = Math.min(1, h) / WATER_REFRACTION;
  const s = h > 1e-6 ? sinW / h : 0;
  out[0] = toSun[0] * s; out[1] = Math.sqrt(1 - sinW * sinW); out[2] = toSun[2] * s;
  return out;
}

/**
 * The pass's values for a frame, written into `out` (the host keeps one, so a frame under the sea allocates nothing).
 * @param {{depth: number, daylight: number, toSun: ArrayLike<number>, sunColor: ArrayLike<number>, sunScale: number}} f -
 *   the eye's depth under the sea (m, 0 at the surface), the mod's daylight factor (0..1), the world's direction toward
 *   the sun, the sun's colour and the frame's sun scale (the weather and the cloud in front of the sun in it)
 * @param {{keep: number[], body: number[], sunW: number[], shaft: number[]}} [out]
 * @returns {{keep: number[], body: number[], sunW: number[], shaft: number[]}} - the shaft colour is 0 when no shaft draws
 */
export function underwaterLookUniforms({ depth, daylight, toSun, sunColor, sunScale }, out = { keep: [0, 0, 0], body: [0, 0, 0], sunW: [0, 0, 0], shaft: [0, 0, 0] }) {
  const d = Math.max(0, depth);
  const deep = clamp01(d / BODY_DEEP_M);
  const day = clamp01(daylight);
  const night = NIGHT_BODY_SHARE + (1 - NIGHT_BODY_SHARE) * day;
  const sun = refractedSun(toSun, out.sunW);
  if (!sun) { out.sunW[0] = 0; out.sunW[1] = 1; out.sunW[2] = 0; }
  const lit = sun ? SHAFT_STRENGTH * Math.max(0, sunScale) * day * Math.exp(-d / SHAFT_FADE_M) : 0;
  for (let i = 0; i < 3; i++) {
    out.keep[i] = (BODY_KEEP[i] + (BODY_KEEP_DEEP[i] - BODY_KEEP[i]) * deep) * (0.85 + 0.15 * day);
    out.body[i] = BODY_COLOR[i] * night * (1 - 0.6 * deep);
    out.shaft[i] = (sunColor[i] ?? 1) * SHAFT_TINT[i] * lit;
  }
  return out;
}
