// @ts-check
// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): who lives in the air and on the ground round the player - the
// kinds by climate, the counts by hour, weather and season. DFU's AmbientEffectsPlayer is the reference: its SunnyDay
// preset is the birds heard and ClearNight the crickets (systems/ambientEffects.js presetForExterior), so the birds
// seen fly when the birds are heard, and the night's air is the bats' and the fireflies'. DFU draws none of them.
import { presetForExterior } from '../ambientEffects.js';
import { CLIMATES } from '../../formats/mapsTables.js';
import { hourOf, isNight, DUSK_HOUR } from '../../world/worldClock.js';

/** How the pass builds a kind (render/ambientLifePass.js): wings, a body on the ground, or a point of light. */
export const AL_SHAPE = Object.freeze({ wing: 0, ground: 1, glow: 2 });

/** @typedef {{ id: number, name: string, shape: number, a: readonly number[], b: readonly number[],
 *    colors: readonly (readonly number[])[], lift: number, flapHz: number, speed: number, flush: number }} AmbientKind */

/** A kind: `a` and `b` its body in metres (a wing's span, body, root and mid chord | tail, tail width, sweep, dihedral;
 *  a runner's body, half width, height, tail | tail width, tail raise, legs, sideways), `colors` the backs it may wear,
 *  `lift` its underside's way to pale, `speed` metres a second, `flush` how near the player comes before it runs. */
const kind = (id, name, shape, a, b, colors, lift, flapHz, speed, flush) =>
  Object.freeze({ id, name, shape, a: Object.freeze(a), b: Object.freeze(b), colors: Object.freeze(colors.map((c) => Object.freeze(c))), lift, flapHz, speed, flush });

const W = AL_SHAPE.wing, G = AL_SHAPE.ground;
export const AL_KINDS = Object.freeze({
  sparrow: kind(0, 'sparrow', W, [0.15, 0.15, 0.08, 0.07], [0.07, 0.035, 0.03, 0.12], [[0.36, 0.27, 0.18], [0.30, 0.24, 0.17], [0.42, 0.33, 0.22]], 0.4, 13, 7, 9),
  starling: kind(1, 'starling', W, [0.2, 0.2, 0.1, 0.08], [0.06, 0.04, 0.05, 0.08], [[0.1, 0.1, 0.11], [0.13, 0.12, 0.14]], 0.1, 10, 10, 14),
  crow: kind(2, 'crow', W, [0.45, 0.42, 0.2, 0.17], [0.14, 0.08, 0.06, 0.1], [[0.06, 0.06, 0.07], [0.09, 0.08, 0.09]], 0.04, 4.5, 8, 14),
  pigeon: kind(3, 'pigeon', W, [0.33, 0.3, 0.15, 0.12], [0.1, 0.06, 0.05, 0.12], [[0.46, 0.47, 0.52], [0.38, 0.39, 0.44], [0.55, 0.53, 0.52]], 0.25, 7, 9, 8),
  gull: kind(4, 'gull', W, [0.62, 0.42, 0.18, 0.14], [0.1, 0.07, 0.12, 0.08], [[0.72, 0.74, 0.78], [0.62, 0.64, 0.68]], 0.7, 3.2, 9, 12),
  parrot: kind(5, 'parrot', W, [0.3, 0.38, 0.13, 0.1], [0.22, 0.04, 0.06, 0.1], [[0.12, 0.55, 0.2], [0.75, 0.15, 0.1], [0.15, 0.35, 0.75]], 0.2, 8, 9, 11),
  hawk: kind(6, 'hawk', W, [0.62, 0.5, 0.28, 0.24], [0.2, 0.09, 0.08, 0.06], [[0.32, 0.22, 0.14], [0.26, 0.19, 0.13]], 0.5, 2.6, 10, 25),
  vulture: kind(7, 'vulture', W, [1.15, 0.7, 0.45, 0.42], [0.22, 0.13, 0.04, 0.1], [[0.16, 0.12, 0.1], [0.2, 0.15, 0.11]], 0.15, 1.8, 9, 30),
  bat: kind(8, 'bat', W, [0.2, 0.12, 0.1, 0.13], [0.0, 0.0, -0.02, 0.0], [[0.08, 0.06, 0.06], [0.1, 0.08, 0.07]], 0.05, 11, 7, 3),
  butterfly: kind(9, 'butterfly', W, [0.06, 0.03, 0.04, 0.07], [0.0, 0.0, -0.03, 0.2], [[0.95, 0.85, 0.3], [0.95, 0.95, 0.9], [0.9, 0.5, 0.15], [0.35, 0.5, 0.95]], 0.2, 11, 1.2, 1.2),
  rat: kind(10, 'rat', G, [0.2, 0.05, 0.07, 0.18], [0.008, 0.0, 0.03, 0], [[0.27, 0.23, 0.2], [0.22, 0.2, 0.18]], 0.2, 0, 3.4, 4.5),
  lizard: kind(11, 'lizard', G, [0.17, 0.04, 0.035, 0.2], [0.015, -0.01, 0.06, 0], [[0.45, 0.4, 0.24], [0.35, 0.42, 0.22], [0.5, 0.36, 0.25]], 0.3, 0, 4.2, 4),
  squirrel: kind(12, 'squirrel', G, [0.2, 0.055, 0.09, 0.2], [0.06, 0.16, 0.035, 0], [[0.48, 0.26, 0.12], [0.4, 0.37, 0.34]], 0.45, 0, 3.8, 5.5),
  crab: kind(13, 'crab', G, [0.11, 0.09, 0.05, 0.0], [0.0, 0.0, 0.1, 1], [[0.62, 0.26, 0.14], [0.5, 0.32, 0.18]], 0.35, 0, 1.6, 3),
  firefly: kind(14, 'firefly', AL_SHAPE.glow, [0.05, 0, 0, 0], [0, 0, 0, 0], [[1.0, 0.9, 0.38], [0.8, 1.0, 0.4]], 0, 0, 0.4, 0),
});
/** By id, for the pass's tables. */
export const AL_KIND_LIST = Object.freeze(Object.values(AL_KINDS).sort((p, q) => p.id - q.id));

/** @typedef {{ flock: string|null, wander: string, perch: string, soar: string|null, runner: string,
 *    butterflies: number, fireflies: number, bats: number, town: string }} AmbientPalette - `town` its towns' roof bird */
const palette = (p) => Object.freeze({ bats: 1, town: 'pigeon', ...p });
const WOODS = palette({ flock: 'starling', wander: 'sparrow', perch: 'pigeon', soar: 'hawk', runner: 'squirrel', butterflies: 1, fireflies: 0.8 });
const DESERT = palette({ flock: null, wander: 'sparrow', perch: 'crow', soar: 'vulture', runner: 'lizard', butterflies: 0, fireflies: 0 });
/** Each climate's (MapsFile.Climates - the same ten past the Bay, so a province reads its own). */
const PALETTES = /** @type {Map<number, AmbientPalette>} */ (new Map([
  [CLIMATES.Ocean, palette({ flock: 'gull', wander: 'gull', perch: 'gull', soar: 'gull', runner: 'crab', butterflies: 0, fireflies: 0, bats: 0.5, town: 'gull' })],
  [CLIMATES.Desert, DESERT],
  [CLIMATES.Desert2, DESERT],
  [CLIMATES.Mountain, palette({ flock: 'crow', wander: 'sparrow', perch: 'crow', soar: 'hawk', runner: 'lizard', butterflies: 0.4, fireflies: 0 })],
  [CLIMATES.Rainforest, palette({ flock: 'parrot', wander: 'parrot', perch: 'parrot', soar: 'hawk', runner: 'lizard', butterflies: 1.3, fireflies: 1.2, town: 'parrot' })],
  [CLIMATES.Swamp, palette({ flock: 'crow', wander: 'sparrow', perch: 'crow', soar: null, runner: 'rat', butterflies: 0.3, fireflies: 1.3 })],
  [CLIMATES.Subtropical, palette({ flock: 'starling', wander: 'sparrow', perch: 'pigeon', soar: 'hawk', runner: 'lizard', butterflies: 1, fireflies: 0.6 })],
  [CLIMATES.MountainWoods, palette({ flock: 'starling', wander: 'sparrow', perch: 'crow', soar: 'hawk', runner: 'squirrel', butterflies: 0.6, fireflies: 0.4 })],
  [CLIMATES.Woodlands, WOODS],
  [CLIMATES.HauntedWoodlands, palette({ flock: 'crow', wander: 'crow', perch: 'crow', soar: null, runner: 'rat', butterflies: 0, fireflies: 0, bats: 1.8, town: 'crow' })],
]));
/** A climate's palette; an index the map does not hold reads as the woods. @param {number} climate @returns {AmbientPalette} */
export const climatePalette = (climate) => PALETTES.get(climate) ?? WOODS;

/** The counts at full life, before the weather, the season and the player's `density`. */
export const AL_BASE = Object.freeze({ flocks: 1, wanderers: 5, perched: 8, soarers: 2, bats: 4, runners: 5, butterflies: 8, fireflies: 28 });
/** A flock's size by its kind. */
export const AL_FLOCK_SIZE = Object.freeze({ starling: [14, 26], crow: [6, 14], gull: [5, 10], parrot: [6, 12] });

/** @typedef {{ flocks: number, flockKind: string|null, wanderers: number, wanderKind: string, perched: number, perchKind: string,
 *    soarers: number, soarKind: string|null, bats: number, runners: number, runnerKind: string, butterflies: number,
 *    fireflies: number, roost: boolean }} AmbientCast - `roost`: night, the roofs' birds asleep and slower to go */

/** Who stands now: `weather` the port's word, `climate` the player's pixel's, `winter` the climate season's, `town`
 *  buildings round the player, `coast` water near, `density` 0..2 the player's. @returns {AmbientCast}
 *  @param {{ minuteOfDay: number, weather: string, climate: number, winter?: boolean, town?: boolean, coast?: boolean, density?: number }} f */
export function ambientCast({ minuteOfDay, weather, climate, winter = false, town = false, coast = false, density = 1 }) {
  const night = isNight(minuteOfDay);
  const preset = presetForExterior(weather, night);
  const p = climatePalette(climate);
  // what DFU's ear folds into a clear day or night (snow, fog, a cloudy sky) still thins what flies here
  const shelter = preset === 'rain' || preset === 'storm' || weather === 'sandstorm' || weather === 'ashfall';
  const snow = weather === 'snow', fog = weather === 'fog';
  const d = Math.max(0, Math.min(2, Number.isFinite(density) ? density : 1));
  const air = shelter ? 0 : (snow ? 0.5 : fog ? 0.6 : 1) * d;
  const day = preset === 'sunnyDay' && !shelter;
  const dusk = !shelter && hourOf(minuteOfDay) === DUSK_HOUR - 1;
  const n = (v) => Math.round(v);
  const gulls = coast && !shelter && p.wander !== 'gull';
  return {
    flocks: day && p.flock ? n(AL_BASE.flocks * Math.min(1, air)) : 0,
    flockKind: p.flock,
    wanderers: day ? n(AL_BASE.wanderers * air) : 0,
    wanderKind: gulls ? 'gull' : p.wander,
    // birds sit out a rain on the roofs, and roost there at night
    perched: n(AL_BASE.perched * (town ? 1.5 : 1) * (shelter ? 0.5 : night ? 0.5 : 1) * d),
    perchKind: town ? p.town : gulls ? 'gull' : p.perch,   // a town's roofs are its pigeons' (or the climate's own town bird)
    soarers: day && (p.soar || gulls) ? n(AL_BASE.soarers * air * (winter ? 0.5 : 1)) : 0,
    soarKind: gulls ? 'gull' : p.soar,
    bats: night || dusk ? n(AL_BASE.bats * p.bats * (shelter || snow ? 0 : 1) * (winter ? 0.3 : 1) * d) : 0,
    runners: snow || shelter ? 0 : n(AL_BASE.runners * (winter ? 0.4 : 1) * (night && town ? 1.4 : 1) * d),
    runnerKind: night && town ? 'rat' : p.runner,
    butterflies: day && !winter && !fog && !snow ? n(AL_BASE.butterflies * p.butterflies * d) : 0,
    fireflies: night && !winter && !shelter && !snow ? n(AL_BASE.fireflies * p.fireflies * d) : 0,
    roost: night,
  };
}

/** Nothing stands (indoors, the switch off). */
export const NO_CAST = Object.freeze(/** @type {AmbientCast} */ ({
  flocks: 0, flockKind: null, wanderers: 0, wanderKind: 'sparrow', perched: 0, perchKind: 'pigeon', soarers: 0, soarKind: null,
  bats: 0, runners: 0, runnerKind: 'rat', butterflies: 0, fireflies: 0, roost: false,
}));
