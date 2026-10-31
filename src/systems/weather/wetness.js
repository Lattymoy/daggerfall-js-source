// @ts-check
// WET1 (bible/07-Rendering/Weather-Arc.md WET1): how wet the ground about the player is. It soaks while rain falls and
// dries after, on the game's clock, so a rest or a journey through a shower lands on ground that matches it. The lane's
// ground and walls read it (render/wetGlsl.js). Interiors and dungeons never set it, so they draw dry.
// DFU has no wet ground: a departure on the enhanced lane alone. `?wet=off` is the door back.
import { pageParam } from '../pageQuery.js';

/** Game minutes a full rain takes to soak the ground, and to fill the puddles; and those a dry spell takes to undo each. */
export const WET_SOAK_MIN = 10;
export const PUDDLE_FILL_MIN = 45;
export const WET_DRY_MIN = 120;
export const PUDDLE_DRY_MIN = 240;
/** A fall at this share of its profile soaks the ground whole; puddles stand only past PUDDLE_RAIN[0], full at [1]. */
export const WET_FULL_RAIN = 0.25;
export const PUDDLE_RAIN = Object.freeze([0.3, 0.8]);

/** `?wet=off` - the ground stays dry. Read off the page's query once a search. */
export function wetOn(search = globalThis.location?.search ?? '') {
  return pageParam('wet', search) !== 'off';
}

/** The rain falling now, 0..1: the front's shown fall and its intensity, less its snow. Sand and ash wet nothing. Pure. */
export function rainOf(shown, intensity, snowShare = 0) {
  if (shown !== 'rain' && shown !== 'storm') return 0;
  return Math.max(0, Math.min(1, Number(intensity) || 0)) * (1 - Math.max(0, Math.min(1, Number(snowShare) || 0)));
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const toward = (v, target, dt, up, down) => (v < target ? Math.min(target, v + dt / up) : Math.max(target, v - dt / down));

/** One step of the ground under `rain` for `dtMin` game minutes: { wet, puddle }, each 0..1. A first step or a clock run
 *  back (a load) lands on the weather whole; a long one (a rest, a journey) has run its course anyway. Pure. */
export function wetStep(state, rain, dtMin) {
  const wetTo = clamp01(rain / WET_FULL_RAIN), puddleTo = clamp01((rain - PUDDLE_RAIN[0]) / (PUDDLE_RAIN[1] - PUDDLE_RAIN[0]));
  if (!state || !(dtMin >= 0)) return { wet: wetTo, puddle: puddleTo };
  return {
    wet: toward(state.wet, wetTo, dtMin, WET_SOAK_MIN, WET_DRY_MIN),
    puddle: toward(state.puddle, puddleTo, dtMin, PUDDLE_FILL_MIN, PUDDLE_DRY_MIN),
  };
}

/** The host's ground: `tick` once a frame on the game's minutes and the front's fall; `uniform` is the frame's uWet. */
export function createWetness({ on = wetOn } = {}) {
  let state = null, minutes = null;
  const uniform = new Float32Array(4);
  return {
    uniform,
    /** @param {{ minutes: number, shown: string | null, intensity: number, snow?: number | null, tsec: number }} f */
    tick({ minutes: now, shown, intensity, snow, tsec }) {
      const live = on();
      const rain = live ? rainOf(shown, intensity, snow ?? 0) : 0;
      state = live ? wetStep(state, rain, minutes == null ? NaN : now - minutes) : { wet: 0, puddle: 0 };
      minutes = now;
      uniform[0] = state.wet; uniform[1] = state.puddle; uniform[2] = tsec % 1000; uniform[3] = rain;
      return uniform;
    },
  };
}
