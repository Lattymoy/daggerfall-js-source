// @ts-check
// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md; the owner, 2026-10-29: "let's develop an aurora for the skyrim
// sky then"): when and where the night sky wears an aurora. Pure but for one cache of Skyrim's rows on the land in use.
// The pass is render/auroraPass.js, the sky controller's door scenes/auroraHost.js. DFU's sky has no aurora; TES V's
// Skyrim does, so this is the port's own (Port-Ledger A, SKYRIM-AURORA).
import { theatreAt, THEATRE_KEYS, worldPixelKey, inWorldGrid } from '../worldWide/worldGrid.js';
import { bayToPicture, inBay, PICTURE_W, PICTURE_H } from './tamrielFrame.js';
import { provinceKeyAt, tamrielLandVersion } from './tamrielLand.js';
import { hash32 } from '../blockHash.js';
import { dayFraction, MINUTES_PER_DAY } from '../worldClock.js';
import { smoothstep } from '../../systems/mathf.js';

/** Skyrim's theatre (world/worldWide/worldGrid.js): the one province whose sky wears it. */
export const SKYRIM_THEATRE = THEATRE_KEYS.indexOf('Skyrim');

export const AURORA_DIALS = Object.freeze({
  /** the sun's elevation in degrees where the aurora starts to show, and where it is whole */
  sunFrom: -6,
  sunFull: -16,
  /** the sky's eased cloud cover (render/enhancedSky.js WEATHER_SKY) where it starts to hide, and where it is gone: a
   *  cloudy night (0.55) keeps it whole, the volumetric clouds drawn over it; an overcast one (0.94) hides it */
  coverFrom: 0.6,
  coverGone: 0.9,
  /** the same while the sky draws its own cloud decks (no volumetric clouds yet, or `?clouds=off`): the aurora is drawn
   *  over those decks, so it goes from a sunny night's cover (0.32) and is gone by a cloudy one's */
  decksFrom: 0.35,
  decksGone: 0.55,
  /** the strength at Skyrim's south edge, of its north coast's */
  south: 0.6,
  /** how far north of the eye the arcs hang, in the curtains' base heights: at the south edge (low over the north
   *  horizon) and on the north coast (nearly overhead) */
  hangSouth: 3.2,
  hangNorth: 0.4,
  /** game minutes a night's slow swell takes, and how much of its strength it moves */
  swellMinutes: 150,
  swell: 0.2,
  /** at sea past the Bay, how far (picture units, 15.36 km each) the nearest land is looked for: its province's sky */
  seaReach: 10,
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

/** A whole number's roll in [0, 1), salted - the same on every machine, so a room sees one sky. */
export const auroraRoll = (n, salt) => hash32(n, salt) / 4294967296;

/** The night a sky minute belongs to: an evening and the morning after share one, changing at noon. */
export const auroraNight = (skyMinutes) => Math.floor((skyMinutes + MINUTES_PER_DAY / 2) / MINUTES_PER_DAY);

/** A night's own strength, 0..1: its tier by one roll (AURORA_NIGHTS' shares), its place in the tier by another. */
export function auroraNightBase(night) {
  let r = auroraRoll(night, 0x51a7),
    tier = AURORA_NIGHTS[AURORA_NIGHTS.length - 1];
  for (const t of AURORA_NIGHTS) {
    if (r < t.share) {
      tier = t;
      break;
    }
    r -= t.share;
  }
  return tier.from + (tier.to - tier.from) * auroraRoll(night, 0x0b0e);
}

/** A night's strength at a sky minute, 0..1: its own, swelling slowly through the night. */
export function auroraNightStrength(skyMinutes) {
  const night = auroraNight(skyMinutes);
  const phase = 2 * Math.PI * auroraRoll(night, 0x5e11);
  const { swellMinutes, swell } = AURORA_DIALS;
  return (
    auroraNightBase(night) *
    (1 - swell + swell * 0.5 * (1 + Math.sin((2 * Math.PI * skyMinutes) / swellMinutes + phase)))
  );
}

/** How dark it is for the aurora at a minute of the day, 0..1, by the sun's depth (worldClock's arc, continued under
 *  the horizon as render/enhancedSky.js sunSkyDirection continues it). */
export function auroraDark(minuteOfDay) {
  const elevDeg = (Math.asin(Math.sin(Math.PI * dayFraction(minuteOfDay))) * 180) / Math.PI;
  const dark = smoothstep(AURORA_DIALS.sunFrom, AURORA_DIALS.sunFull, elevDeg);
  return Number.isFinite(dark) ? dark : 0;
}

/** How much of the aurora the cloud cover leaves, 0..1 - `decks` while the sky draws its own cloud decks. */
export function auroraClear(cover, decks = false) {
  const d = AURORA_DIALS,
    c = Number.isFinite(cover) ? cover : 1;
  return decks ? 1 - smoothstep(d.decksFrom, d.decksGone, c) : 1 - smoothstep(d.coverFrom, d.coverGone, c);
}

// Skyrim's north and south picture rows on the land in use - the trace's once it lands, else the authored shape - found
// once a land version by scanning for its first and last row. Asked only in Skyrim, so the Bay never pays for it.
let _rows = /** @type {{ version: number, north: number, south: number }|null} */ (null);
/** Skyrim's [north, south] picture rows on the land in use. */
export function skyrimRows() {
  const version = tamrielLandVersion();
  if (_rows?.version !== version) {
    const has = (y) => {
      for (let x = 0.25; x < PICTURE_W; x += 0.5) if (provinceKeyAt(x, y) === 'Skyrim') return true;
      return false;
    };
    let north = 0.25,
      south = PICTURE_H - 0.25;
    while (north < PICTURE_H && !has(north)) north += 0.5;
    while (south > north && !has(south)) south -= 0.5;
    _rows = { version, north, south: Math.max(south, north + 1) };
  }
  return [_rows.north, _rows.south];
}

// At sea past the Bay a pixel's sky is the nearest land's within seaReach, found in rings outward; kept for the last
// pixel asked (a ship crosses a pixel in seconds) and its land version.
let _sea = /** @type {{ key: number, version: number, theatre: number }|null} */ (null);
function seaTheatre(px, py) {
  const key = worldPixelKey(px, py),
    version = tamrielLandVersion();
  if (_sea?.key === key && _sea.version === version) return _sea.theatre;
  const [cx, cy] = bayToPicture(px + 0.5, py + 0.5);
  let theatre = -1;
  for (let r = 0.5; r <= AURORA_DIALS.seaReach && theatre < 0; r += 0.5) {
    for (let i = -r; i <= r && theatre < 0; i += 0.5) {
      for (const [x, y] of [
        [cx + i, cy - r],
        [cx + i, cy + r],
        [cx - r, cy + i],
        [cx + r, cy + i],
      ]) {
        const k = provinceKeyAt(x, y);
        if (k !== null) {
          theatre = THEATRE_KEYS.indexOf(k);
          break;
        }
      }
    }
  }
  _sea = { key, version, theatre };
  return theatre;
}

/** The theatre whose sky a world pixel stands under: its own, or at sea past the Bay the nearest land's (-1 for none). */
export function skyTheatreAt(px, py) {
  const t = theatreAt(px, py);
  return t >= 0 || inBay(px, py) ? t : seaTheatre(px, py);
}

/** Where under Skyrim's sky a world pixel is, 0 at its south edge and 1 on its north coast (and the sea past it) - or
 *  null past Skyrim's sky. */
export function auroraLatitude(px, py) {
  if (!inWorldGrid(px, py) || skyTheatreAt(px, py) !== SKYRIM_THEATRE) return null;
  const [north, south] = skyrimRows();
  return clamp01((south - bayToPicture(px + 0.5, py + 0.5)[1]) / (south - north));
}

/** The sky's own aurora at a place, before the dark: `weight` 0..1 (where, the cloud cover and the night) and `hang`,
 *  how far north its arcs stand (render/auroraPass.js uHang). `nightSky` false is a weather that puts the night sky out
 *  (DaggerfallSky.cs:363-367's WeatherStyle); `decks` the sky drawing its own cloud decks.
 *  @param {{ px: number, py: number, skyMinutes: number, cover: number, nightSky?: boolean, decks?: boolean }} at
 *  @returns {Aurora} */
export function auroraSky({ px, py, skyMinutes, cover, nightSky = true, decks = false }) {
  if (!nightSky) return NO_AURORA;
  const lat = auroraLatitude(px, py);
  if (lat === null) return NO_AURORA;
  const d = AURORA_DIALS;
  const weight = (d.south + (1 - d.south) * lat) * auroraClear(cover, decks) * auroraNightStrength(skyMinutes);
  return { weight: Number.isFinite(weight) ? weight : 0, hang: d.hangSouth * (1 - lat) + d.hangNorth * lat };
}

/** The aurora a frame should wear: the sky's own (auroraSky) times the dark at its minute of the day.
 *  @param {{ px: number, py: number, minuteOfDay: number, skyMinutes: number, cover: number, nightSky?: boolean, decks?: boolean }} at
 *  @returns {Aurora} */
export function auroraTarget(at) {
  const sky = auroraSky(at),
    dark = auroraDark(at.minuteOfDay);
  return sky.weight > 0 && dark > 0 ? { weight: sky.weight * dark, hang: sky.hang } : NO_AURORA;
}
