// @ts-check
// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md; the owner, 2026-10-29: "let's develop an aurora for the skyrim
// sky then"): when and where the night sky wears an aurora. Pure: the place, the sun's depth, the cloud cover and the
// night's own strength. The pass is render/auroraPass.js, the sky controller's door scenes/auroraHost.js. DFU's sky has
// no aurora; TES V's Skyrim does, so this is the port's own (Port-Ledger A, SKYRIM-AURORA).
import { theatreAt, THEATRE_KEYS } from '../worldWide/worldGrid.js';
import { bayToPicture } from './tamrielFrame.js';
import { dayFraction, MINUTES_PER_DAY } from '../worldClock.js';

/** Skyrim's theatre (world/worldWide/worldGrid.js): the one province whose sky wears it. */
export const SKYRIM_THEATRE = THEATRE_KEYS.indexOf('Skyrim');

export const AURORA_DIALS = Object.freeze({
  /** the sun's elevation in degrees where the aurora starts to show, and where it is whole */
  sunFrom: -6, sunFull: -16,
  /** the sky's eased cloud cover (render/enhancedSky.js WEATHER_SKY) where it starts to hide, and where it is gone: a
   *  cloudy night (0.55) keeps it whole, the clouds drawn over it; an overcast one (0.94) hides it */
  coverFrom: 0.6, coverGone: 0.9,
  /** Skyrim's picture rows (world/tamriel/tamrielGeography.js PROVINCES): its north coast and its south edge */
  northY: 22, southY: 78,
  /** the strength at the south edge, of the north coast's */
  south: 0.6,
  /** how far north of the eye the arcs hang, in the curtains' base heights: at the south edge (low over the north
   *  horizon) and on the north coast (nearly overhead) */
  hangSouth: 3.2, hangNorth: 0.4,
  /** game minutes a night's slow swell takes, and how much of its strength it moves */
  swellMinutes: 150, swell: 0.2,
});

/** The nights by their roll: a quiet night, a common one and a strong one - each its share and its strength range. */
export const AURORA_NIGHTS = Object.freeze([
  Object.freeze({ share: 0.2, from: 0.3, to: 0.5 }),
  Object.freeze({ share: 0.55, from: 0.6, to: 0.85 }),
  Object.freeze({ share: 0.25, from: 0.9, to: 1 }),
]);

/** @typedef {{ readonly weight: number, readonly hang: number }} Aurora */
/** The frame with no aurora. @type {Aurora} */
export const NO_AURORA = Object.freeze({ weight: 0, hang: AURORA_DIALS.hangNorth });

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 at `a`, 1 at `b` (either order), smooth between. */
const ramp = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** A whole number's roll in [0, 1), salted - the same on every machine, so a room sees one sky. */
export function auroraRoll(n, salt) {
  let h = Math.imul((n | 0) ^ salt, 0x9e3779b1);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The night a sky minute belongs to: an evening and the morning after share one, changing at noon. */
export const auroraNight = (skyMinutes) => Math.floor((skyMinutes + MINUTES_PER_DAY / 2) / MINUTES_PER_DAY);

/** A night's own strength, 0..1: its tier by one roll (AURORA_NIGHTS' shares), its place in the tier by another. */
export function auroraNightBase(night) {
  let r = auroraRoll(night, 0x51a7), tier = AURORA_NIGHTS[AURORA_NIGHTS.length - 1];
  for (const t of AURORA_NIGHTS) { if (r < t.share) { tier = t; break; } r -= t.share; }
  return tier.from + (tier.to - tier.from) * auroraRoll(night, 0x0b0e);
}

/** A night's strength at a sky minute, 0..1: its own, swelling slowly through the night. */
export function auroraNightStrength(skyMinutes) {
  const night = auroraNight(skyMinutes);
  const base = auroraNightBase(night);
  const phase = 2 * Math.PI * auroraRoll(night, 0x5e11);
  const { swellMinutes, swell } = AURORA_DIALS;
  return base * (1 - swell + swell * 0.5 * (1 + Math.sin(2 * Math.PI * skyMinutes / swellMinutes + phase)));
}

/** How dark it is for the aurora at a minute of the day, 0..1, by the sun's depth (worldClock's arc, continued under
 *  the horizon as render/enhancedSky.js sunSkyDirection continues it). */
export function auroraDark(minuteOfDay) {
  const elevDeg = Math.asin(Math.sin(Math.PI * dayFraction(minuteOfDay))) * 180 / Math.PI;
  return ramp(AURORA_DIALS.sunFrom, AURORA_DIALS.sunFull, elevDeg);
}

/** How much of the aurora the cloud cover leaves, 0..1. */
export const auroraClear = (cover) => 1 - ramp(AURORA_DIALS.coverFrom, AURORA_DIALS.coverGone, Number(cover) || 0);

/** Where in Skyrim a world pixel is, 0 at its south edge and 1 on its north coast - or null past Skyrim. */
export function auroraLatitude(px, py) {
  if (!Number.isInteger(px) || !Number.isInteger(py) || theatreAt(px, py) !== SKYRIM_THEATRE) return null;
  const y = bayToPicture(px + 0.5, py + 0.5)[1];
  return clamp01((AURORA_DIALS.southY - y) / (AURORA_DIALS.southY - AURORA_DIALS.northY));
}

/** The aurora the sky should wear: `weight` 0..1 and `hang`, how far north its arcs stand (render/auroraPass.js uHang).
 *  `nightSky` false is a weather that puts the night sky out (DaggerfallSky.cs:363-367's WeatherStyle).
 *  @param {{ px: number, py: number, minuteOfDay: number, skyMinutes: number, cover: number, nightSky?: boolean }} at
 *  @returns {Aurora} */
export function auroraTarget({ px, py, minuteOfDay, skyMinutes, cover, nightSky = true }) {
  if (!nightSky) return NO_AURORA;
  const lat = auroraLatitude(px, py);
  if (lat === null) return NO_AURORA;
  const d = AURORA_DIALS;
  const weight = (d.south + (1 - d.south) * lat) * auroraDark(minuteOfDay) * auroraClear(cover) * auroraNightStrength(skyMinutes);
  return { weight, hang: d.hangSouth * (1 - lat) + d.hangNorth * lat };
}
