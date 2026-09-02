// R1: BUILDING OPENING HOURS + THE UNLOCKED LADDER - verbatim from
// DFU PlayerActivate.cs (MIT, Daggerfall Workshop). Until this slice
// the port entered every building unconditionally at any hour
// (worldModes.tryEnter routed BUILDING doors straight to
// buildInteriorContext); classic locks its town at night and this is
// the law that says when.
//
// The lockpick ATTEMPT lives with the door laws
// (world/actionSystem.js exteriorLockpickingChance + the attempt
// strings); the anti-grind record lives with discovery
// (systems/discovery.js lastLockpickAttempt). This module answers the
// two questions the exterior door arm asks first: is the building
// open, and what is its lock worth.

import { BUILDING_TYPES } from '../world/buildingNames.js';
import { isShop } from './shopStock.js';
import { HOLIDAYS } from './holidays.js';

/** Opening and closing hours by building type (PlayerActivate.cs:
 *  91-92), indexed by DFLocation.BuildingTypes 0..24. closeHours 25
 *  means "never closes" (Hour is always < 25); open 0 + close 25 is
 *  always open (taverns, temples); open 0 + close 0 is NEVER open -
 *  House1's row, so a House1 is permanently locked and only a pick
 *  or a quest opens it, classic's own shape. */
export const OPEN_HOURS = Object.freeze([7, 8, 9, 8, 0, 9, 10, 10, 9, 6, 9, 11, 9, 9, 0, 0, 10, 0, 6, 6, 6, 6, 6, 6, 0]);
export const CLOSE_HOURS = Object.freeze([22, 16, 19, 15, 25, 21, 19, 20, 18, 23, 23, 23, 20, 20, 25, 25, 16, 0, 18, 18, 18, 18, 18, 18, 25]);

/** IsBuildingOpen (:102-106): openHours <= hour < closeHours. */
export function isBuildingOpen(buildingType, hour) {
  return (OPEN_HOURS[buildingType] ?? 0) <= hour && (CLOSE_HOURS[buildingType] ?? 25) > hour;
}

/** GetBuildingLockValue (:669-681): quality / 2 - DFU's own comment
 *  says the classic method is unknown and this stands until a more
 *  accurate one is; at 20 quality that is lock 10, comfortably under
 *  the magic-held 20, "no exterior buildings are known to have
 *  magically held locks". */
export const buildingLockValue = (quality) => Math.trunc((quality ?? 0) / 2);

/**
 * BuildingIsUnlocked (:1258-1312), the ladder in DFU's own order.
 * `building` is the port's building-directory record ({ buildingType,
 * factionId, buildingKey, ... }); ctx supplies what the ladder reads:
 *   hour                          - the classic hour (0-23)
 *   holidayId                     - getHolidayId's answer (shops close
 *                                   on Suns Rest, :1296-1299)
 *   isHouseOwned(buildingKey)     - DaggerfallBankManager.IsHouseOwned
 *                                   (H1 WIRED IT: banking.js:172 over
 *                                   playerEntity.houses, handed in at
 *                                   scenes/worldModes.js:3256, so
 *                                   :69 - PlayerActivate.cs:1261-1262,
 *                                   the ladder's first test - now has
 *                                   a real answer instead of false)
 *   isActiveQuestBuilding(building) - the siteLinks walk (:1315-1329)
 *   guildForBuilding(factionId)   - -> { hallAccessAnytime, isMember }
 *                                   booleans resolved by the host's
 *                                   guild layer (Guild.HallAccessAnytime
 *                                   / IsMember)
 *   ownsShip                      - DaggerfallBankManager.OwnsShip
 *                                   (D6 WIRED IT: banking.js:274 over
 *                                   playerEntity.ownedShip, handed in
 *                                   at scenes/worldModes.js's
 *                                   buildingIsUnlocked call. The key
 *                                   had been omitted there, so it
 *                                   defaulted false and the Ship arm
 *                                   below - PlayerActivate.cs:1307-1308
 *                                   - could never fire; the bank's
 *                                   shipyard now sells the ship whose
 *                                   door it opens)
 */
export function buildingIsUnlocked(building, {
  hour = 12, holidayId = -1,
  isHouseOwned = null, isActiveQuestBuilding = null,
  guildForBuilding = null, ownsShip = false,
} = {}) {
  const type = building?.buildingType ?? BUILDING_TYPES.None;
  // Player owned house is always unlocked (:1262)
  if (isHouseOwned?.(building?.buildingKey) ?? false) return true;
  // Buildings part of an active quest are always unlocked (:1266)
  if (isActiveQuestBuilding?.(building) ?? false) return true;
  // Guild halls: members with anytime access, else public hours (:1278)
  if (type === BUILDING_TYPES.GuildHall) {
    const g = guildForBuilding?.(building?.factionId ?? 0);
    return (g?.hallAccessAnytime ?? false) || isBuildingOpen(type, hour);
  }
  // TG/DB houses: a House2 with a faction is members-only (:1281-1285)
  if (type === BUILDING_TYPES.House2 && (building?.factionId ?? 0) !== 0) {
    const g = guildForBuilding?.(building.factionId);
    return g?.isMember ?? false;
  }
  // House1-House4 by hours (:1289-1292 - House1's 0/0 row never opens)
  if (type >= BUILDING_TYPES.House1 && type <= BUILDING_TYPES.House4) {
    return isBuildingOpen(type, hour);
  }
  // Stores close on the Suns Rest holiday (:1294-1302)
  if (isShop(type)) {
    if (holidayId === HOLIDAYS.Suns_Rest) return false;
    return isBuildingOpen(type, hour);
  }
  // Other structures - temples, taverns, palaces (:1304-1307)
  if (type <= BUILDING_TYPES.Palace && type >= 0) {
    return isBuildingOpen(type, hour);
  }
  // Ships need ownership (:1308-1309); everything else stays locked -
  // DFU's `unlocked` starts false and no arm below Ship sets it
  if (type === BUILDING_TYPES.Ship && ownsShip) return true;
  return false;
}

/** The locked-door popup line ("lockedExteriorDoor" - prose ours,
 *  key cited; the look-at difficulty text follows it from
 *  actionSystem.lookAtLockText, classic's interior-formula oversight
 *  included). */
export const LOCKED_EXTERIOR_DOOR_TEXT = 'This door is locked.';
