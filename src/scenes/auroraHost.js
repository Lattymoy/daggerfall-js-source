// @ts-check
// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): the aurora in the sky controller (scenes/shared.js
// createSkyController, the enhanced lane's) - the sky's own aurora (world/tamriel/skyrimAurora.js auroraSky) at the
// player's pixel, eased in real seconds so a border or a cloud deck fades it, times the dark at the frame's game minute
// (so a rest or a jump into the day never leaves it in daylight), and the pass (render/auroraPass.js) built once the
// driver has its program, its curtains on the sky's walk clock. `?aurora=off` builds nothing; `?aurora=on` or a number
// in 0..1 stands it at that weight anywhere, at any hour (the sky lab and the probes).
import { compiledPass } from '../render/glProgram.js';
import { AuroraPass, AURORA_PROGRAMS, AURORA_QUALITY, AURORA_LIGHT } from '../render/auroraPass.js';
import { WIND_SECONDS_PER_MINUTE } from '../render/enhancedSky.js';
import { auroraSky, auroraDark, AURORA_DIALS, NO_AURORA } from '../world/tamriel/skyrimAurora.js';
import { pixelHere } from '../characters/provinceFolk.js';

/** Real seconds the sky's own aurora takes to move about two thirds of the way to the law's. */
export const AURORA_EASE_S = 6;
/** Under this the pass is not drawn. */
export const AURORA_DRAWN_FROM = 0.002;
/** Real seconds between two of the sky's frames (an interior, a hitch) past which the water's dome map is marched afresh. */
export const AURORA_DOME_GAP_S = 0.5;

/** The `?aurora=` door: 'off', a weight 0..1 (`on` is 1), or null for the law. @param {string|null} v */
export function auroraDoor(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'off') return 'off';
  if (s === 'on' || s === '') return 1;
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}

/** The sky's moonlight term (render/enhancedSky.js moonlightTerm: {dir, scale, color, ambient}, or null) with the aurora's
 *  light added to its ambient - a moonless night under an aurora answers a term with no key. Every reader of the moonlight
 *  (the land's ambient, the water's body, the night air) takes it so. @param {any} moon @param {ArrayLike<number>|null} light */
export function withAuroraLight(moon, light) {
  if (!light) return moon;
  if (!moon) return { dir: [0, 1, 0], scale: 0, color: [0, 0, 0], ambient: [light[0], light[1], light[2]] };
  return { ...moon, ambient: [moon.ambient[0] + light[0], moon.ambient[1] + light[1], moon.ambient[2] + light[2]] };
}

/** The sky's aurora, or null where the door turns it off.
 *  @param {any} gl @param {URLSearchParams} params
 *  @param {{ here?: () => ({ x: number, y: number } | null), clock?: () => number, quality?: string }} [opts] the player's
 *    map pixel (the world host's door), real milliseconds, and the clouds' quality tier (the march's steps and map) */
export function createAuroraHost(
  gl,
  params,
  {
    here = pixelHere,
    clock = () => (typeof performance !== 'undefined' ? performance.now() : 0),
    quality = 'default',
  } = {},
) {
  const door = auroraDoor(params.get('aurora'));
  if (door === 'off') return null;
  const tier = AURORA_QUALITY[/** @type {keyof typeof AURORA_QUALITY} */ (quality)] ?? AURORA_QUALITY.default;
  const pass = compiledPass(
    gl,
    AURORA_PROGRAMS,
    () => new AuroraPass(gl, tier),
    (e) => console.warn('[aurora] its program failed - no aurora is drawn', e?.message ?? e),
  );
  let sky = 0,
    dark = 0,
    seconds = 0,
    hang = /** @type {number} */ (AURORA_DIALS.hangNorth),
    last = /** @type {number|null} */ (null);
  // what the last draw showed: the sky's own aurora by the veil (0 when it drew none), the frame it drew, the minute
  let shown = 0,
    frame = 0,
    drawnFrame = -Infinity,
    stale = true,
    minute = 0;
  const light = new Float32Array(3),
    skyMap = { tex: /** @type {any} */ (null) };
  const darkAt = (m) => (typeof door === 'number' ? 1 : auroraDark(m));
  return {
    tier,
    /** the weight the last `use` left, 0..1 */
    get weight() {
      return sky * dark;
    },
    get hang() {
      return hang;
    },
    /** The ambient the aurora adds to the land's light ([r, g, b], AURORA_LIGHT by the weight the last draw showed), or
     *  null. `atMinute` a view out of a building's clock minute: the dark at that minute, not at the last frame's. */
    light(atMinute = minute) {
      const w = shown * darkAt(atMinute);
      if (!(w >= AURORA_DRAWN_FROM)) return null;
      for (let c = 0; c < 3; c++) light[c] = AURORA_LIGHT[c] * w;
      return light;
    },
    /** The dome map the water reflects ({ tex }, render/auroraPass.js AuroraPass domeTex) - only on a frame the aurora drew. */
    get skyMap() {
      skyMap.tex = drawnFrame === frame ? (pass()?.domeTex ?? null) : null;
      return skyMap.tex ? skyMap : null;
    },
    /** The frame's sky: its minute of the day, the sky's own clock, the eased cloud cover, whether the weather leaves the
     *  night sky out, whether the sky draws its own cloud decks, and the walk clock's game minutes (the curtains' time).
     *  The first call after a `jump` takes it whole. */
    use(minuteOfDay, skyMinutes, cover, nightSky = true, decks = false, walkMinutes = 0) {
      let want = /** @type {import('../world/tamriel/skyrimAurora.js').Aurora} */ (NO_AURORA);
      if (typeof door === 'number') want = { weight: door, hang: AURORA_DIALS.hangNorth };
      else {
        const p = here();
        if (p) want = auroraSky({ px: p.x, py: p.y, skyMinutes, cover, nightSky, decks });
      }
      // a bad frame (a NaN weight or clock) never latches it: the weight is read as none, the clock as a jump
      const now = clock(),
        dt = last === null || !Number.isFinite(now - last) ? Infinity : Math.max(0, (now - last) / 1000);
      last = Number.isFinite(now) ? now : null;
      sky += ((Number.isFinite(want.weight) ? want.weight : 0) - sky) * (1 - Math.exp(-dt / AURORA_EASE_S));
      dark = typeof door === 'number' ? 1 : auroraDark(minuteOfDay);
      if (want.weight > 0) hang = want.hang; // a fading aurora keeps where it hung
      seconds = Number.isFinite(walkMinutes) ? walkMinutes * WIND_SECONDS_PER_MINUTE : 0;
      frame++;
      minute = minuteOfDay;
      if (!(dt < AURORA_DOME_GAP_S)) stale = true;
    },
    /** A load, a travel's landing, a respawn: the next frame takes the aurora whole (the sky's weatherJump). */
    jump() {
      last = null;
    },
    /** Drawn into the world image's rect `viewport` ([x, y, w, h]), `veil` (0..1) of it - a Hollow's brass air dims it. */
    draw(yaw, pitch, fovY, aspect, viewport, veil = 1) {
      const v = Math.max(0, Math.min(1, veil)),
        w = sky * dark * v,
        p = w >= AURORA_DRAWN_FROM ? pass() : null;
      shown = p ? sky * v : 0; // no pass yet, or a failed one: no light either
      if (!p) return;
      p.draw(yaw, pitch, fovY, aspect, w, hang, seconds, viewport, stale || drawnFrame < frame - 1);
      drawnFrame = frame;
      stale = false;
    },
  };
}
