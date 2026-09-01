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
import { isOnShip } from './ship.js';   // TransportManager.IsOnShip, the origin rule's whole test

// TravelTimeCalculator.cs:30 - indexed by (climate - Ocean); also the
// dungeon-texture climate index table.
export const CLIMATE_INDICES = Object.freeze([0, 0, 0, 1, 2, 3, 4, 5, 5, 5]);
// :33 - per-terrain movement modifiers.
export const TERRAIN_MOVEMENT_MODIFIERS = Object.freeze([240, 220, 200, 200, 230, 250]);

/** The calculator's pixel walk (:64-157's loop head), extracted whole
 *  for U61: the overworld map draws its route line and flies its
 *  camera along the SAME pixels the time law charges, so the picture
 *  of the journey is the law's own path rather than a second reading.
 *  Returns every pixel visited AFTER each move - the start pixel is
 *  not in the list, exactly as the loop never charges it. The stepper
 *  is the classic longest-axis walk, NOT true Bresenham: the
 *  increment compares with > not >=, kept exactly. */
export function walkTravelPath(start, end) {
  let px = start.x, py = start.y;
  const dx = end.x - px, dy = end.y - py;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const furthest = adx <= ady ? ady : adx;
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;

  const path = [];
  let moves = 0, inc = 0;
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
    path.push({ x: px, y: py });
    ++moves;
  }
  return path;
}

/** CalculateTravelTime (:64-157). start/end are map pixels
 *  ({x, y}); getClimateIndex(x, y) answers CLIMATE.PAK (the
 *  MapsFile method). Returns { minutes, oceanPixels } - the ocean
 *  count feeds the trip cost exactly as the C# field did. */
/**
 * The per-pixel charge, lifted VERBATIM out of CalculateTravelTime's
 * loop body. Extracted, not rewritten: it returns exactly what the
 * inline expression returned, and every existing pin on
 * calculateTravelTime holds.
 *
 * It carried an enhanced-only ROAD TERM until the road system was
 * removed whole (2026-08-29, Mac's call). With it gone this function
 * is the C# loop body and nothing else - no departure, no optional
 * arm, and the >>8 idiom throughout as the source has it.
 */
export function travelPixelMinutes(terrain, transportModifier, {
  travelShip = false, sleepModeInn = false,
} = {}) {
  let thisMove;
  if (terrain === CLIMATES.Ocean) {
    thisMove = travelShip ? 51 : 255;
  } else {
    const idx = CLIMATE_INDICES[terrain - CLIMATES.Ocean];
    thisMove = (((102 * transportModifier) >> 8)
      * (256 - TERRAIN_MOVEMENT_MODIFIERS[idx] + 256)) >> 8;
  }
  if (!sleepModeInn) thisMove = (300 * thisMove) >> 8;
  return thisMove;
}

/** GetPlayerTravelPosition (:47-56) - the ONE origin every travel
 *  reckoning starts from, and the reason CalculateTravelTime resolves
 *  its own start in C# rather than taking one:
 *
 *      if (playerGPS && !transportManager.IsOnShip()) position = playerGPS.CurrentMapPixel;
 *      else position = MapsFile.WorldCoordToMapPixel(transportManager.BoardShipPosition...)
 *
 *  Aboard an owned ship the player's LIVE pixel is the ship's mooring
 *  - (2,2) or (5,5), open ocean either way - so DFU reckons from where
 *  they BOARDED instead. Without it (AUDIT 39 F114) a journey planned
 *  from the deck was priced and timed as a couple of hundred
 *  mostly-ocean pixels, and the same figure fed quest clock deadlines.
 *
 *  The port's boardShipPosition already carries its own map pixel
 *  (systems/ship.js's `position`), so there is no world coordinate to
 *  convert back. */
export function playerTravelPosition(player, boardShipPosition, currentPixel) {
  if (!isOnShip(player, boardShipPosition, currentPixel)) return currentPixel;
  const px = boardShipPosition.mapPixel;
  return px ? { x: px.x, y: px.y } : currentPixel;
}

/** CalculateTravelTime (:64-157). start/end are map pixels
 *  ({x, y}); getClimateIndex(x, y) answers CLIMATE.PAK (the
 *  MapsFile method). Returns { minutes, oceanPixels } - the ocean
 *  count feeds the trip cost exactly as the C# field did. `start` is
 *  the caller's because this module owns no GameManager: every caller
 *  gets it from playerTravelPosition above.
 *
 *  It carried two optional deps for the road system - a substitute
 *  pixel `path` and a `roadAt` class lookup - and both went with it
 *  (2026-08-29). What is left is the verbatim port: the classic
 *  longest-axis walk, priced pixel by pixel. */
export function calculateTravelTime(start, end, {
  speedCautious = false, sleepModeInn = false, travelShip = false,
  hasHorse = false, hasCart = false,
} = {}, getClimateIndex) {
  const transportModifier = hasHorse ? 128 : hasCart ? 192 : 256;

  let minutes = 0, oceanPixels = 0;
  for (const { x, y } of walkTravelPath(start, end)) {
    const terrain = getClimateIndex(x, y);
    if (terrain === CLIMATES.Ocean) ++oceanPixels;
    minutes += travelPixelMinutes(terrain, transportModifier, { travelShip, sleepModeInn });
  }

  if (!speedCautious) minutes = minutes >> 1;
  return { minutes, oceanPixels };
}

/** CalculateTripCost (:159-173). Taverns only accept gold PIECES -
 *  the split survives for when letters of credit land; today the
 *  port's gold is one pool and totalCost is what the host deducts.
 *  freeTavernRooms is DFU's own consult on this line
 *  (`GuildManager.GetGuild(KnightlyOrder).FreeTavernRooms()`), hoisted
 *  to a parameter because this module owns no GuildManager; every
 *  caller supplies it (AUDIT 39 F101/F115 - it defaulted false on
 *  every trip, so a knight paid the inn nights DFU waives). */
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
