// FAST TRAVEL (F-slice). TravelTimeCalculator.cs verbatim (MIT,
// Daggerfall Workshop) + DaggerfallTravelPopUp's arrival-time clamps
// as pure minute math. The WINDOW and the host arrival live with
// their hosts; this module owns the LAWS.
//
// The calculator walks the overland line pixel by pixel (the classic
// longest-axis stepper, NOT true Bresenham - the increment compares
// with > not >=, kept exactly), reads each pixel's climate, and
// charges minutes through classic's >>8 fixed-point chain. Times are
// whole minutes; costs are gold.

import { CLIMATES } from '../formats/mapsFile.js';
import { MINUTES_PER_HOUR, MINUTES_PER_DAY } from './gameDate.js';

// TravelTimeCalculator.cs:30 - indexed by (climate - Ocean); also the
// dungeon-texture climate index table.
export const CLIMATE_INDICES = Object.freeze([0, 0, 0, 1, 2, 3, 4, 5, 5, 5]);
// :33 - per-terrain movement modifiers.
export const TERRAIN_MOVEMENT_MODIFIERS = Object.freeze([240, 220, 200, 200, 230, 250]);

/** CalculateTravelTime (:64-157). start/end are map pixels
 *  ({x, y}); getClimateIndex(x, y) answers CLIMATE.PAK (the
 *  MapsFile method). Returns { minutes, oceanPixels } - the ocean
 *  count feeds the trip cost exactly as the C# field did. */
export function calculateTravelTime(start, end, {
  speedCautious = false, sleepModeInn = false, travelShip = false,
  hasHorse = false, hasCart = false,
} = {}, getClimateIndex) {
  const transportModifier = hasHorse ? 128 : hasCart ? 192 : 256;

  let px = start.x, py = start.y;
  const dx = end.x - px, dy = end.y - py;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const furthest = adx <= ady ? ady : adx;
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;

  let moves = 0, inc = 0, minutes = 0, oceanPixels = 0;
  while (moves < furthest) {
    if (furthest === adx) {
      px += sx;
      inc += ady;
      if (inc > adx) { inc -= adx; py += sy; }
    } else {
      py += sy;
      inc += adx;
      if (inc > ady) { inc -= ady; px += sx; }
    }

    let thisMove;
    const terrain = getClimateIndex(px, py);
    if (terrain === CLIMATES.Ocean) {
      ++oceanPixels;
      thisMove = travelShip ? 51 : 255;
    } else {
      const idx = CLIMATE_INDICES[terrain - CLIMATES.Ocean];
      thisMove = (((102 * transportModifier) >> 8)
        * (256 - TERRAIN_MOVEMENT_MODIFIERS[idx] + 256)) >> 8;
    }

    if (!sleepModeInn) thisMove = (300 * thisMove) >> 8;
    minutes += thisMove;
    ++moves;
  }

  if (!speedCautious) minutes = minutes >> 1;
  return { minutes, oceanPixels };
}

/** CalculateTripCost (:159-173). Taverns only accept gold PIECES -
 *  the split survives for when letters of credit land; today the
 *  port's gold is one pool and totalCost is what the host deducts.
 *  freeTavernRooms = the Knightly Order perk hook (false until the
 *  guild perk wires). */
export function calculateTripCost(travelTimeMinutes, oceanPixels, {
  sleepModeInn = false, hasShip = false, travelShip = false, freeTavernRooms = false,
} = {}) {
  const hours = Math.trunc((travelTimeMinutes + 59) / 60);
  let piecesCost = 0;
  if (sleepModeInn && !freeTavernRooms) {
    piecesCost = 5 * Math.trunc((hours - oceanPixels) / 24);
    if (piecesCost < 0) piecesCost = 0;   // DFU's guard - absent from classic, kept (negative cost otherwise)
    piecesCost += 5;                      // always at least one stay at an inn
  }
  let totalCost = piecesCost;
  if (oceanPixels > 0 && !hasShip && travelShip) totalCost += 25 * (Math.trunc(oceanPixels / 24) + 1);
  return { piecesCost, totalCost };
}

/** The arrival-time clamps (DaggerfallTravelPopUp.performFastTravel
 *  :350-377), as EXTRA MINUTES to raise after the travel time lands:
 *   - a sun-averse traveler (vampire / DamageFromSunlight) arriving
 *     by day (6..17) is pushed to DUSK (hour 18, minute kept);
 *   - otherwise CAUTIOUS travel arriving at night is pushed to 7:10
 *     (before 7:10 same-day, after 17:00 next-day) - DFU's second
 *     term is literal, so an arrival at 7:0x lands at 7:10+ the
 *     residue; the port's clock is minute-granular (second = 0). */
export function arrivalClampMinutes(classicMinutes, { speedCautious = false, sunAverse = false } = {}) {
  const hour = Math.trunc(classicMinutes / MINUTES_PER_HOUR) % 24;
  const minute = classicMinutes % MINUTES_PER_HOUR;
  if (sunAverse) {
    if (hour >= 6 && hour < 18) return (18 - hour) * MINUTES_PER_HOUR;   // DuskHour - hour, whole hours
    return 0;
  }
  if (!speedCautious) return 0;
  if (hour < 7 || (hour === 7 && minute < 10)) return (7 - hour) * MINUTES_PER_HOUR + (10 - minute);
  if (hour > 17) return (31 - hour) * MINUTES_PER_HOUR + (10 - minute);
  return 0;
}

/** The popup's day display: classic shows whole days, rounded up. */
export const travelDays = (minutes) => Math.trunc((minutes + MINUTES_PER_DAY - 1) / MINUTES_PER_DAY);
