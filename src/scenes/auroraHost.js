// @ts-check
// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): the aurora in the sky controller (scenes/shared.js
// createSkyController, the enhanced lane's) - the law's weight (world/tamriel/skyrimAurora.js) at the player's pixel,
// eased in real seconds so a border, a cloud deck or a fast travel fades it, and the pass (render/auroraPass.js) built
// once the driver has its program. `?aurora=off` builds nothing; `?aurora=on` or a number in 0..1 stands it at that
// weight anywhere, at any hour (the sky lab and the probes).
import { compiledPass } from '../render/glProgram.js';
import { AuroraPass, AURORA_PROGRAMS } from '../render/auroraPass.js';
import { auroraTarget, AURORA_DIALS, NO_AURORA } from '../world/tamriel/skyrimAurora.js';
import { pixelHere } from '../characters/provinceFolk.js';

/** Real seconds the weight takes to move about two thirds of the way to the law's. */
export const AURORA_EASE_S = 6;
/** Under this the pass is not drawn. */
export const AURORA_DRAWN_FROM = 0.002;

/** The `?aurora=` door: 'off', a weight 0..1 (`on` is 1), or null for the law. @param {string|null} v */
export function auroraDoor(v) {
  if (v === null || v === undefined) return null;
  if (v === 'off') return 'off';
  if (v === 'on' || v === '') return 1;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}

/** The sky's aurora, or null where the door turns it off.
 *  @param {any} gl @param {URLSearchParams} params
 *  @param {() => ({ x: number, y: number } | null)} [here] the player's map pixel (the world host's door)
 *  @param {() => number} [clock] real milliseconds */
export function createAuroraHost(gl, params, here = pixelHere, clock = () => (typeof performance !== 'undefined' ? performance.now() : 0)) {
  const door = auroraDoor(params.get('aurora'));
  if (door === 'off') return null;
  const pass = compiledPass(gl, AURORA_PROGRAMS, () => new AuroraPass(gl), (e) => console.warn('[aurora] its program failed - no aurora is drawn', e?.message ?? e));
  let weight = 0, hang = /** @type {number} */ (AURORA_DIALS.hangNorth), last = /** @type {number|null} */ (null);
  return {
    /** the weight the last `use` left, 0..1 */
    get weight() { return weight; },
    get hang() { return hang; },
    /** The frame's sky: its minute of the day, the sky's own clock, the eased cloud cover and whether the weather leaves
     *  the night sky out. The first call takes the law's weight whole. */
    use(minuteOfDay, skyMinutes, cover, nightSky = true) {
      let want = /** @type {import('../world/tamriel/skyrimAurora.js').Aurora} */ (NO_AURORA);
      if (typeof door === 'number') want = { weight: door, hang: AURORA_DIALS.hangNorth };
      else {
        const p = here();
        if (p) want = auroraTarget({ px: p.x, py: p.y, minuteOfDay, skyMinutes, cover, nightSky });
      }
      const now = clock(), dt = last === null ? Infinity : Math.max(0, (now - last) / 1000);
      last = now;
      weight += (want.weight - weight) * (1 - Math.exp(-dt / AURORA_EASE_S));
      if (want.weight > 0) hang = want.hang;   // a fading aurora keeps where it hung
    },
    draw(yaw, pitch, fovY, aspect) {
      if (!(weight >= AURORA_DRAWN_FROM)) return;
      pass()?.draw(yaw, pitch, fovY, aspect, weight, hang);
    },
  };
}
