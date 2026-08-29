// BG1 - THE BUILDING GREETING: what kind of shop, and who lives here.
//
// PlayerActivate.cs:585-628 and PresentShopQuality (:1332-1391), 1:1
// from Daggerfall Unity (MIT, Daggerfall Workshop).
//
// Open a shop door in classic and it tells you what you have walked
// into - "Incense and soft music soothe your nerves" for a fine one,
// "Rusty relics lie wherever they were last tossed" for a hovel. Open
// a stranger's front door and someone greets you. The port did
// neither: every door opened onto silence.
//
// THE GATE IS TWO VARIABLES AND THEY ARE NOT THE SAME QUESTION
// (:517-518, :595-607):
//
//     var isBrokenIn = isBash;                      // bashing IS breaking in
//     if (!buildingUnlocked && !isBash && HandleOpenEffectOnExteriorDoor(...))
//         buildingUnlocked = isBrokenIn = true;     // the Open SPELL sets both
//     ... a successful PICK sets isBrokenIn alone, never buildingUnlocked
//
//     if (buildingUnlocked && House1..House4
//         && factionID != Thieves_Guild && factionID != Dark_Brotherhood
//         && !IsHouseOwned(buildingKey))
//     {
//         if (!isBrokenIn) mb = MessageBox(GetRandomText(256));
//     }
//     else mb = PresentShopQuality(building);
//
// so the four reachable answers are:
//
//   walked in during open hours   -> the house greeting, or the shop's quality
//   opened with the OPEN SPELL    -> NOTHING. buildingUnlocked is true, so the
//                                    else-arm never runs; isBrokenIn is true,
//                                    so the greeting does not either. A house
//                                    you magicked your way into does not greet
//                                    you, and its quality is never presented.
//   PICKED the lock               -> buildingUnlocked stayed false, so the
//                                    else-arm runs: a shop states its quality
//                                    even to a burglar, a house says nothing
//                                    (PresentShopQuality answers null off a
//                                    non-shop).
//   your OWN house, TG, DB        -> the else-arm, and the same null.
//
// The nesting is the law: `!isBrokenIn` is INSIDE the house branch, not
// beside it, so failing it does not fall through to the shop arm.
//
// AND THE BOX DEFERS THE DOOR (:617-623). When a message box is shown
// the interior transition waits for it to close, which is why this
// module answers a DECISION rather than performing one.

import { BUILDING_TYPES } from '../world/buildingNames.js';
import { getInt } from './settings.js';

/** GetRandomText(256) - the householder's greeting, one of the
 *  record's variants. */
export const HOUSE_GREETING_TEXT_ID = 256;

/** PresentShopQuality's five records (:1334-1338), best to worst. */
export const SHOP_QUALITY_TEXT_IDS = Object.freeze([266, 267, 268, 269, 270]);

/** FactionFile.FactionIDs - the two guilds whose "houses" are not
 *  homes (:600-601). Named here rather than imported from
 *  crimeGuilds.js so this module stays a leaf. */
export const GREETING_EXCLUDED_FACTION_IDS = Object.freeze([42, 108]);

/** The quality bands (:1355-1366). DFU's own note: "UESP states this
 *  is building quality / 4 but Daggerfall uses manual thresholds" -
 *  and the thresholds are NOT four apart (3/7/13/17), which is
 *  exactly why the division would be wrong. */
export function shopQualityTextId(quality) {
  if (quality <= 3) return 270;    // 01-03
  if (quality <= 7) return 269;    // 04-07
  if (quality <= 13) return 268;   // 08-13
  if (quality <= 17) return 267;   // 14-17
  return 266;                      // 18-20
}

/** DFLocation.BuildingTypes House1..House4 (:597-598), the inclusive
 *  band the greeting is offered for. House5/House6/Ship are outside
 *  it, as in DFU. The bounds come from the table rather than the two
 *  numbers - buildingLocks.js reads the same one. */
export const isGreetingHouse = (buildingType) =>
  buildingType >= BUILDING_TYPES.House1 && buildingType <= BUILDING_TYPES.House4;

/**
 * The whole decision, as data. Answers null when nothing is said -
 * which is most of the time, and is the arm the port had by accident
 * before it had this one on purpose.
 *
 *   { kind: 'house', textId: 256 }        -> a RANDOM variant of the record
 *   { kind: 'shopQuality', textId: 26x }  -> the quality line
 *
 * `isShop` is passed as a value rather than imported so this module
 * does not pull the shop-stock layer in behind it; the caller has the
 * predicate already.
 */
export function buildingGreeting({
  buildingType, quality = 0, factionId = 0,
  buildingUnlocked = false, isBrokenIn = false, houseOwned = false, isShop = false,
} = {}) {
  if (buildingUnlocked
    && isGreetingHouse(buildingType)
    && !GREETING_EXCLUDED_FACTION_IDS.includes(factionId)
    && !houseOwned) {
    // INSIDE the branch, not beside it: a house you broke into says
    // nothing AND never reaches the shop arm.
    return isBrokenIn ? null : { kind: 'house', textId: HOUSE_GREETING_TEXT_ID };
  }
  // PresentShopQuality's own first gate (:1350-1351): not a shop, no line.
  if (!isShop) return null;
  return { kind: 'shopQuality', textId: shopQualityTextId(quality) };
}

/** SettingsManager's ShopQualityPresentation (:1372-1390): 0 shows the
 *  classic popup, 1 puts the record's text lines on the HUD at
 *  ShopQualityHUDDelay, 2 (and any other value, via `default`) shows
 *  nothing. It gates the SHOP line only - the house greeting is not
 *  behind it.
 *
 *  The read lives HERE rather than at the call site because that is
 *  where DFU reads it: the switch is inside PresentShopQuality, not in
 *  the door arm that calls it. restSession's `illegalRestWarning()` is
 *  the port's precedent for a law owning its own setting. The
 *  parameter is a test seam and nothing in src/ passes it. */
export function shopQualityPresentation(setting = getInt('GUI', 'ShopQualityPresentation', 0, 2)) {
  if (setting === 0) return 'popup';
  if (setting === 1) return 'hud';
  return 'none';
}
