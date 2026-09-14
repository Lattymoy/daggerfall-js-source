// WEATHER2b (2026-09-14, Mac: "a dynamic world space event system where
// weather can be traveled out of and into instead of just starting and
// stopping in your location") - THE WEATHER FIELD: the day's words as
// PLACES.
//
// DFU's weather is a state of the player's climate ZONE: PlayerEntity
// rolls six words a day (one per zone), WeatherManager applies the
// player's zone's word, and the sky is that word to the horizon - a
// rain day rains everywhere in the Woodlands at once, and a thunderstorm
// has no edge to walk out of. The classic lane keeps that, 1:1. The
// ENHANCED lane reads the same six words (the sim's array, the day's
// shared roll online - WORLD5) as a FIELD over the map:
//
//   A PRECIPITATING word - rain, thunder, snow - becomes CELLS scattered
//   over the zone's land: a jittered lattice at the word's spacing, each
//   candidate present by a seeded coin, each with its own radius from
//   the word's range, its centre's word the day's word for the CLIMATE
//   under it (so a thunder day over the mountains scatters thunderheads
//   on mountain pixels, and a woodland traveller sees them from the
//   plain). Between the cells the zone's BASE sky stands: overcast on a
//   rain or snow day, cloudy between the storms of a thunder day - so
//   the storms are seen coming, as Mac asked.
//   A word that is a state of the whole sky - sunny, cloudy, overcast,
//   fog - stays the zone's, as DFU has it: no cells.
//
//   THE CELLS DRIFT on the day's own wind (a heading seeded by the day,
//   DRIFT_M_PER_MIN), so a storm rolls over a standing player as well
//   as being walked into. Everything is seeded by the DAY, the lattice
//   index and the word: the same field for every player under the
//   shared clock, replayable, nothing to carry.
//
// The player's weather is what the field says AT THE PLAYER: the cell
// they stand in, else their zone's base. The sim funnels it through the
// ground (WEATHER2a) and the hosts hand the nearby cells to the clouds
// (WEATHER2c), so the storm on the horizon is the storm you walk into.
//
// PURE. Positions are FIELD METRES - the map's native units scaled to
// the streaming world's metres (a pixel is TERRAIN_SIZE, 819.2, on a
// side; x east, z north as the native z is). The hosts convert.

import { TERRAIN_SIZE, WORLD_MAP_TERRAIN_DIM } from '../world/terrainSampler.js';
import { MAX_MAP_PIXEL_Y, CLIMATES } from '../formats/mapsFile.js';
import { seededRng } from './wind.js';

/** Native world units to field metres (TERRAIN_SIZE per pixel). */
export const NATIVE_TO_METRES = TERRAIN_SIZE / WORLD_MAP_TERRAIN_DIM;
/** Field metres from native world coordinates (streamingWorld's worldCoords). */
export const fieldFromNative = (x, z) => [x * NATIVE_TO_METRES, z * NATIVE_TO_METRES];
/** ...and back. */
export const nativeFromField = (mx, mz) => [mx / NATIVE_TO_METRES, mz / NATIVE_TO_METRES];
/** The map pixel under a field position (MapsFile's y runs south). */
export function pixelOfField(mx, mz) {
  return { x: Math.floor(mx / TERRAIN_SIZE), y: MAX_MAP_PIXEL_Y - 1 - Math.floor(mz / TERRAIN_SIZE) };
}
/** A fixed location's host space (the ?exterior host: its pixel's local
 *  frame, x east, z north) to field metres, and back. */
export const fieldOfPixelLocal = (px, py, x, z) => [px * TERRAIN_SIZE + x, (MAX_MAP_PIXEL_Y - 1 - py) * TERRAIN_SIZE + z];
export const pixelLocalOfField = (px, py, mx, mz) => [mx - px * TERRAIN_SIZE, mz - (MAX_MAP_PIXEL_Y - 1 - py) * TERRAIN_SIZE];

/** The words that become cells: the lattice spacing (m), the radius
 *  range (m), the coin (the share of candidates that stand), and the
 *  BASE sky between them. */
export const CELL_WORDS = Object.freeze({
  rain:    Object.freeze({ spacing: 24000, radius: [9000, 16000], p: 0.62, base: 'overcast' }),
  thunder: Object.freeze({ spacing: 22000, radius: [3500, 7500],  p: 0.55, base: 'cloudy' }),
  snow:    Object.freeze({ spacing: 26000, radius: [10000, 18000], p: 0.62, base: 'overcast' }),
  // WEATHER2d: the sandstorm - never a zone's word; stood over the
  // DESERT tables' land (Desert, Desert2 - the climates weatherTableFor
  // sends to the desert table) on a day whose word there is cloudy or
  // thunder, a wall 8-14 km across, the zone's own sky between
  sandstorm: Object.freeze({ spacing: 30000, radius: [8000, 14000], p: 0.5, base: 'cloudy' }),
});
/** WEATHER2d: the zone words a sandstorm cell may stand under. */
export const SAND_FROM = Object.freeze(['cloudy', 'thunder']);
/** WEATHER2d: the desert tables' climates - where a sandstorm may seat. */
export const sandCountry = (climateIndex) => climateIndex === CLIMATES.Desert || climateIndex === CLIMATES.Desert2;
/** Does a cell of `word` stand on a seat whose climate is `climate` and
 *  whose zone word today is `zoneWord`? Pure. */
export function cellSeats(word, climate, zoneWord) {
  if (word === 'sandstorm') return sandCountry(climate) && SAND_FROM.includes(zoneWord);
  return zoneWord === word;
}
/** The lattice's jitter, as a fraction of the spacing either way. */
export const CELL_JITTER = 0.35;
/** The cells' drift on the day's wind, metres per game minute (~22 km a day). */
export const DRIFT_M_PER_MIN = 15;
/** How far from the player cells are gathered for the clouds (the sky
 *  march reaches 24 km; the widest cell is 18 km across the radius). */
export const FIELD_RANGE_M = 40000;
const FIELD_SEED = 0x4649454C;   // 'FIEL'
const WORD_SALT = Object.freeze({ rain: 1, thunder: 2, snow: 3, sandstorm: 4 });   // each word its own lattice of coins

/** The day's drift: a heading seeded by the day, the distance so far. Pure. */
export function driftOfDay(day, minuteOfDay) {
  const r = seededRng((day * 2654435761) ^ FIELD_SEED);
  const h = r() * Math.PI * 2;
  const d = DRIFT_M_PER_MIN * Math.max(0, minuteOfDay);
  return [Math.cos(h) * d, Math.sin(h) * d];
}

/** The candidate at lattice index (gx, gz) for `word` on `day`: null when
 *  the coin says no, else its undrifted centre and radius. Pure. */
export function cellCandidate(word, day, gx, gz) {
  const w = CELL_WORDS[word];
  if (!w) return null;
  const seed = (Math.imul(day, 73856093) ^ Math.imul(gx, 19349663) ^ Math.imul(gz, 83492791) ^ Math.imul(WORD_SALT[word], 2971215073) ^ FIELD_SEED) >>> 0;
  const r = seededRng(seed);
  if (r() >= w.p) return null;
  const jx = (r() - 0.5) * 2 * CELL_JITTER, jz = (r() - 0.5) * 2 * CELL_JITTER;
  const radius = w.radius[0] + r() * (w.radius[1] - w.radius[0]);
  return { x: (gx + 0.5 + jx) * w.spacing, z: (gz + 0.5 + jz) * w.spacing, r: radius };
}

/** The base sky a zone word leaves between its cells - the word itself
 *  when it makes none. Pure. */
export const baseWordOf = (word) => CELL_WORDS[word]?.base ?? word;

/**
 * THE FIELD AT A PLACE. `at` is [mx, mz] in field metres; `climateAt(px,
 * py)` answers the map's climate index; `wordOfClimate(climateIndex)`
 * answers the day's zone word for that climate (the sim's array).
 * Answers { word, inside, cells }: the word the sky wears here, the cell
 * the point is in (or null), and every cell within FIELD_RANGE_M (each
 * { x, z, r, word }, drifted, nearest first).
 */
export function fieldAt({ day, minuteOfDay, at, climateAt, wordOfClimate }) {
  const p0 = pixelOfField(at[0], at[1]);
  const here = climateAt(p0.x, p0.y);
  const zoneWord = wordOfClimate(here);
  const drift = driftOfDay(day, minuteOfDay);
  const ux = at[0] - drift[0], uz = at[1] - drift[1];   // the undrifted frame the lattice lives in
  const cells = [];
  for (const word of Object.keys(CELL_WORDS)) {
    const s = CELL_WORDS[word].spacing;
    const n = Math.ceil(FIELD_RANGE_M / s) + 1;
    const gx0 = Math.floor(ux / s), gz0 = Math.floor(uz / s);
    for (let gx = gx0 - n; gx <= gx0 + n; gx++) {
      for (let gz = gz0 - n; gz <= gz0 + n; gz++) {
        const c = cellCandidate(word, day, gx, gz);
        if (!c) continue;
        const cx = c.x + drift[0], cz = c.z + drift[1];
        const dx = cx - at[0], dz = cz - at[1];
        const d = Math.hypot(dx, dz);
        if (d - c.r > FIELD_RANGE_M) continue;
        // the cell's word is the day's word for the climate under its (undrifted) seat
        const p = pixelOfField(c.x, c.z);
        const seat = climateAt(p.x, p.y);
        if (!cellSeats(word, seat, wordOfClimate(seat))) continue;   // WEATHER2d: a sandstorm seats on desert land under a cloudy or thunder word
        cells.push({ x: cx, z: cz, r: c.r, word, d });
      }
    }
  }
  cells.sort((a, b) => a.d - b.d);
  const inside = cells.find((c) => c.d < c.r) ?? null;
  return { word: inside ? inside.word : baseWordOf(zoneWord), zoneWord, inside, cells };
}
