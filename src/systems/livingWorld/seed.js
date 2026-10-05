// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING WORLD'S SEEDS. Every resident, plan, meeting and trip
// is a pure function of the world's data, a seed and the sky's clock (LW0 decision 2), and this is where the seeds are
// made: the port's one integer mix (`world/spawnedDungeons.js hash32`, FNV-1a with two avalanche steps) under the
// living world's own salt, and the port's one small generator (`systems/wind.js seededRng`, mulberry32) over it - so no
// part of the living world rolls on Math.random or on DFRandom's global stream (a name draw puts that stream back as it
// stood, `census.js residentName`).
import { hash32 } from '../../world/spawnedDungeons.js';
import { seededRng } from '../wind.js';

/** The living world's salt: changing it re-rolls every resident in the world. */
export const LW_SALT = 0x11fe;

/** A seed from a few small integers, under the living world's salt. @param {...number} parts */
export const lwSeed = (...parts) => hash32(LW_SALT, ...parts);
/** A generator on `lwSeed(...parts)`. @param {...number} parts */
export const lwRng = (...parts) => seededRng(lwSeed(...parts));
/** One draw in [0, 1) on `lwSeed(...parts)` - a single answer without a generator. @param {...number} parts */
export const lwRoll = (...parts) => lwSeed(...parts) / 4294967296;

/** An integer in [lo, hi] off `rng`. @param {() => number} rng @param {number} lo @param {number} hi */
export const rollInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
/** One entry of `list` off `rng`. @template T @param {() => number} rng @param {readonly T[]} list @returns {T} */
export const pickOf = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
/**
 * One key of `weights` ({ key: weight }) off `rng`, by weight; none above zero answers null.
 * @param {() => number} rng @param {Record<string, number>} weights @returns {string|null}
 */
export function pickWeighted(rng, weights) {
  let total = 0;
  for (const k in weights) if (weights[k] > 0) total += weights[k];
  if (!(total > 0)) return null;
  let r = rng() * total;
  let last = null;
  for (const k in weights) {
    if (!(weights[k] > 0)) continue;
    last = k;
    r -= weights[k];
    if (r < 0) return k;
  }
  return last;
}

/** A short string as a small integer (a building key, a place key) - FNV-1a over its char codes. @param {string} s */
export function textSeed(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
