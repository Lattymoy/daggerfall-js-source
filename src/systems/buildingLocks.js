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
import { sharedClockOn } from './worldTick.js';   // OL4 (AUDIT ALL O1): the shared clock IS the reason for the shift, and every other online law keys on it

/** Opening and closing hours by building type (PlayerActivate.cs:
 *  91-92), indexed by DFLocation.BuildingTypes 0..24. closeHours 25
 *  means "never closes" (Hour is always < 25); open 0 + close 25 is
 *  always open (taverns, temples); open 0 + close 0 is NEVER open -
 *  House1's row, so a House1 is permanently locked and only a pick
 *  or a quest opens it, classic's own shape. */
export const OPEN_HOURS = Object.freeze([7, 8, 9, 8, 0, 9, 10, 10, 9, 6, 9, 11, 9, 9, 0, 0, 10, 0, 6, 6, 6, 6, 6, 6, 0]);
export const CLOSE_HOURS = Object.freeze([22, 16, 19, 15, 25, 21, 19, 20, 18, 23, 23, 23, 20, 20, 25, 25, 16, 0, 18, 18, 18, 18, 18, 18, 25]);

/** Effective IsBuildingOpen; offline is :102-106, online shops layer OL4. */
export function isBuildingOpen(buildingType, hour, opts = {}) {
  return buildingHoursState(buildingType, { ...opts, hour }).open;
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
 *                                   (H1 WIRED IT: banking.js:175 over
 *                                   playerEntity.houses, handed in at
 *                                   scenes/worldModes.js:4407, so
 *                                   :69 - PlayerActivate.cs:1261-1262,
 *                                   the ladder's first test - now has
 *                                   a real answer instead of false)
 *   isActiveQuestBuilding(building) - the siteLinks walk (:1315-1329)
 *   guildForBuilding(factionId)   - -> { hallAccessAnytime, isMember }
 *                                   booleans resolved by the host's
 *                                   guild layer (Guild.HallAccessAnytime
 *                                   / IsMember)
 *   ownsShip                      - DaggerfallBankManager.OwnsShip
 *                                   (D6 WIRED IT: banking.js:293 over
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
  hour = 12, holidayId = -1, online = sharedClockOn(),
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
    // OL5: `online` is THREADED here, not left to the module default. The arm
    // took `isBuildingOpen(type, hour)` with no opts, so a caller that handed
    // buildingIsUnlocked an explicit `online` was silently ignored by this one
    // arm - harmless while guild halls had no relief, a lie the moment they do.
    return (g?.hallAccessAnytime ?? false) || isBuildingOpen(type, hour, { online });
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
    // OL4: the effective shop schedule keeps the preserved classic answer beside it.
    return buildingHoursState(type, { hour, holidayId, online }).open;
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

/**
 * THE BUILDING-CLOSED SENTENCE (PlayerActivate.cs:477-480), and its ONE
 * home. DFU picks one of two localized rows - `guildClosed` for a
 * GuildHall, `storeClosed` for everything else (Internal_Strings.csv:
 * 36-37) - then substitutes %d1/%d2 with this type's open and close
 * hours, ":00" suffixes and all.
 *
 * It lived as an inline template literal in the exterior activate arm
 * until the world hover needed to SAY the same sentence without
 * clicking. Two producers of one DFU member is the violation the bible
 * names first, so the sentence moved here beside the hours it reads and
 * both callers ask for it.
 *
 * `subject` overrides the Guild/Store word. Nothing in DFU passes it;
 * World Tooltips does, substituting "Palace" for a palace it looks at
 * (a departure of the mod's, recorded with the port of its ladder), and
 * the override is how that arm stays a caller instead of a second copy.
 */
export function buildingClosedText(buildingType, { subject = null } = {}) {
  const which = subject ?? (buildingType === BUILDING_TYPES.GuildHall ? 'Guild' : 'Store');
  return `${which} is closed. Open from ${OPEN_HOURS[buildingType]}:00 to ${CLOSE_HOURS[buildingType]}:00.`;
}

/** The locked-door popup line - `lockedExteriorDoor`, which
 *  PlayerActivate.cs:527 pops verbatim. The row is one word:
 *  Internal_Strings.csv:534, "Locked." (the look-at difficulty text
 *  follows it from actionSystem.lookAtLockText, classic's
 *  interior-formula oversight included). */
export const LOCKED_EXTERIOR_DOOR_TEXT = 'Locked.';

// OL4 - ONLINE COMMERCE (2026-09-17, a player complaint relayed by Mac:
// players could not shop at night online). A RECORDED DEPARTURE - Ledger
// A carries it as SHOPS STAFFED AROUND THE CLOCK ONLINE (OL4), naming
// this file. Classic's schedule remains a pure primitive; the
// shared-world policy is layered above it. Online players cannot
// advance the shared clock by resting, so a classic "sleep until the
// shop opens" schedule becomes a real-time lockout. Only storefronts
// gain a continuous relief shift. Houses, guild halls, temples,
// palaces, ships and every other building keep the exact R1 rules.
//
// The staffing answer is data on purpose. Today the existing shop
// people remain the visible staff. A later presentation slice can use
// ONLINE_SHIFT for a distinct night clerk without guessing from the
// clock or changing the access law again.
/**
 * OL5 (2026-09-20, Mac: "Town gates online, guild services, should all be
 * open at night time online mode"). THE BUILDINGS THE SHARED WORLD RELIEVES.
 * OL4 gave the relief shift to storefronts alone and its pin said so in as
 * many words ("guild access unchanged online"); this widens it by ONE subject
 * - the guild hall - and the reason is OL4's own, unchanged: an online player
 * cannot move the shared clock, so a classic schedule is a real-time lockout,
 * and a guild hall shut from 18:00 is a guild service nobody can buy for two
 * real hours. Everything OL4 left alone is still left alone: houses (a
 * residence is not a service), temples and taverns (already 0/25 - they never
 * closed), palaces, ships.
 *
 * It is a PREDICATE, not a second table: the day another service building
 * earns the shift it is named here and every caller - the door, the people,
 * the shelves - follows, because they all ask buildingHoursState.
 */
export const onlineReliefBuilding = (type) => isShop(type) || type === BUILDING_TYPES.GuildHall;

/** The staffing answer. OL4 minted it for shops; OL5 widened its subjects to
 *  `onlineReliefBuilding` - the name is kept because the OL4 Ledger row cites
 *  it and that row is a record of what happened, not a description of now. */
export const SHOP_STAFFING = Object.freeze({
  CLOSED: 'closed',
  CLASSIC: 'classic',
  ONLINE_SHIFT: 'online-shift',
});

/** PlayerActivate.IsBuildingOpen (:102-106), preserved exactly. */
export function classicBuildingOpen(buildingType, hour) {
  return (OPEN_HOURS[buildingType] ?? 0) <= hour && (CLOSE_HOURS[buildingType] ?? 25) > hour;
}

/**
 * One effective schedule for every caller. `classicOpen` records what
 * untouched Daggerfall would say; `open` is what this running world says.
 * Offline they are identical. Online, and only for a shop, a closure is
 * covered by ONLINE_SHIFT. Suns Rest is part of the classic shop closure,
 * so it is covered by the same policy rather than becoming a real-time
 * two-hour outage (a game day is 120 real minutes at TimeScale 12).
 *
 * `online` is injectable for node tests. Production defaults to the shared
 * clock standing (worldTick.sharedClockOn) - the one predicate every
 * clock-derived online law reads (RESTX2, OL3, ECON1).
 */
export function buildingHoursState(buildingType, {
  hour = 12,
  holidayId = -1,
  online = sharedClockOn(),   // AUDIT ALL O1: the clock, not the URL - a page that says ?online with no clock installed (the fixed city's dev door) is not the shared world
} = {}) {
  const type = buildingType ?? BUILDING_TYPES.None;
  const shop = isShop(type);
  const relieved = onlineReliefBuilding(type);   // OL5: shops, and the guild hall
  // Suns Rest is a SHOP closure in DFU (:1294-1302) and stays one - a guild
  // hall keeps its doors on the holiday because classic never shut them.
  const holidayClosed = shop && holidayId === HOLIDAYS.Suns_Rest;
  const classicOpen = classicBuildingOpen(type, hour) && !holidayClosed;
  if (relieved && online && !classicOpen) {
    return { open: true, classicOpen: false, staffing: SHOP_STAFFING.ONLINE_SHIFT };
  }
  return {
    open: classicOpen,
    classicOpen,
    staffing: relieved ? (classicOpen ? SHOP_STAFFING.CLASSIC : SHOP_STAFFING.CLOSED) : null,
  };
}
