// @ts-check
// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): the aurora in the sky controller (scenes/shared.js
// createSkyController, the enhanced lane's) - the sky's own aurora (world/tamriel/skyrimAurora.js auroraSky) at the
// player's pixel, eased in real seconds so a border or a cloud deck fades it, times the dark at the frame's game minute
// (so a rest or a jump into the day never leaves it in daylight), and the pass (render/auroraPass.js) built once the
// driver has its program, its curtains on the sky's walk clock. `?aurora=off` builds nothing; `?aurora=on` or a number
// in 0..1 stands it at that weight anywhere, at any hour (the sky lab and the probes).
import { compiledPass } from '../render/glProgram.js';
import { AuroraPass, AURORA_PROGRAMS, AURORA_QUALITY } from '../render/auroraPass.js';
import { WIND_SECONDS_PER_MINUTE } from '../render/enhancedSky.js';
import { auroraSky, auroraDark, AURORA_DIALS, NO_AURORA } from '../world/tamriel/skyrimAurora.js';
import { pixelHere } from '../characters/provinceFolk.js';

/** Real seconds the sky's own aurora takes to move about two thirds of the way to the law's. */
export const AURORA_EASE_S = 6;
/** Under this the pass is not drawn. */
export const AURORA_DRAWN_FROM = 0.002;

/** The `?aurora=` door: 'off', a weight 0..1 (`on` is 1), or null for the law. @param {string|null} v */
export function auroraDoor(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'off') return 'off';
  if (s === 'on' || s === '') return 1;
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}

/** The sky's aurora, or null where the door turns it off.
 *  @param {any} gl @param {URLSearchParams} params
 *  @param {{ here?: () => ({ x: number, y: number } | null), clock?: () => number, quality?: string }} [opts] the player's
 *    map pixel (the world host's door), real milliseconds, and the clouds' quality tier (the march's steps and map) */
export function createAuroraHost(gl, params, { here = pixelHere, clock = () => (typeof performance !== 'undefined' ? performance.now() : 0), quality = 'default' } = {}) {
  const door = auroraDoor(params.get('aurora'));
  if (door === 'off') return null;
  const tier = AURORA_QUALITY[/** @type {keyof typeof AURORA_QUALITY} */ (quality)] ?? AURORA_QUALITY.default;
  const pass = compiledPass(gl, AURORA_PROGRAMS, () => new AuroraPass(gl, tier), (e) => console.warn('[aurora] its program failed - no aurora is drawn', e?.message ?? e));
  let sky = 0, dark = 0, seconds = 0, hang = /** @type {number} */ (AURORA_DIALS.hangNorth), last = /** @type {number|null} */ (null);
  return {
    tier,
    /** the weight the last `use` left, 0..1 */
    get weight() { return sky * dark; },
    get hang() { return hang; },
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
      const now = clock(), dt = last === null || !Number.isFinite(now - last) ? Infinity : Math.max(0, (now - last) / 1000);
      last = Number.isFinite(now) ? now : null;
      sky += ((Number.isFinite(want.weight) ? want.weight : 0) - sky) * (1 - Math.exp(-dt / AURORA_EASE_S));
      dark = typeof door === 'number' ? 1 : auroraDark(minuteOfDay);
      if (want.weight > 0) hang = want.hang;   // a fading aurora keeps where it hung
      seconds = Number.isFinite(walkMinutes) ? walkMinutes * WIND_SECONDS_PER_MINUTE : 0;
    },
    /** A load, a travel's landing, a respawn: the next frame takes the aurora whole (the sky's weatherJump). */
    jump() { last = null; },
    /** Drawn into the world image's rect `viewport` ([x, y, w, h]), `veil` (0..1) of it - a Hollow's brass air dims it. */
    draw(yaw, pitch, fovY, aspect, viewport, veil = 1) {
      const w = sky * dark * Math.max(0, Math.min(1, veil));
      if (!(w >= AURORA_DRAWN_FROM)) return;
      pass()?.draw(yaw, pitch, fovY, aspect, w, hang, seconds, viewport);
    },
  };
}
