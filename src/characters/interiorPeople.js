// Interior people flats (Characters C1).
// 1:1 translation of DaggerfallInterior.AddPeople's DATA layer (MIT,
// Daggerfall Workshop). Verbatim:
//   - Position: (XPos, -YPos, ZPos) * GlobalScale. DFU spawns the
//     billboard pivot at that point then shifts +size.y/2, i.e. the
//     raw position is the BASE - exactly the contract our billboard
//     batches take, so consumers pass the position through untouched.
//   - Every person carries the StaticNPC layout inputs: textureArchive,
//     textureRecord, factionID, flags, and the raw block-record
//     position triple (DFU's position hash feeds from these).
//   - Visibility gates from AddPeople's tail (house ownership, shop
//     open hours, building-type open rules, GuildHall anytime-access,
//     the TG/DB House2 member rule) were ROUTED at C1 because they
//     depend on Systems the port did not have - banking above all.
//     H1 shipped house ownership, which was the last of them, and P1
//     takes the gate: `peopleAreVisible` below.

import { GLOBAL_SCALE } from '../world/meshReader.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { isShop } from '../systems/shopStock.js';
import { isBuildingOpen } from '../systems/buildingLocks.js';

/**
 * Collect the people of one building interior.
 * @param recordData - dfBlock.rmbBlock.subRecords[recordIndex]
 * @returns {Array<{x,y,z,textureArchive,textureRecord,factionID,flags,
 *   rawX,rawY,rawZ}>} base-positioned people (interior-local frame;
 *   hosts parent exactly like flats).
 */
export function collectInteriorPeople(recordData) {
  const out = [];
  for (const obj of recordData.interior.blockPeopleRecords) {
    out.push({
      x: obj.xPos * GLOBAL_SCALE,
      y: -obj.yPos * GLOBAL_SCALE,
      z: obj.zPos * GLOBAL_SCALE,
      textureArchive: obj.textureArchive,
      textureRecord: obj.textureRecord,
      factionID: obj.factionID,
      flags: obj.flags,
      rawX: obj.xPos, rawY: obj.yPos, rawZ: obj.zPos,
      // Q4-v: the record's stream position - DFU's obj.Position, the
      // StaticNPC nameSeed's identity component.
      position: obj.position,
    });
  }
  return out;
}

/**
 * AddPeople's VISIBILITY TAIL (DaggerfallInterior.cs:1206-1226), the
 * decision DFU makes per person immediately after standing them.
 *
 * It reads the same primitives as the door ladder in
 * systems/buildingLocks.js and combines them differently, and one of
 * them it INVERTS: a house you OWN is always unlocked to you
 * (buildingIsUnlocked :1262) and its people are always hidden
 * (:1209-1212). Both are right - you bought the place, so you can walk
 * in and the previous occupants are gone.
 *
 * The shop arm reads a LATCH, not the clock. `IsPlayerInsideOpenShop`
 * is computed once at the moment of entry (PlayerActivate.cs:1120,
 * `IsShop(type) && IsBuildingOpen(type)`) and then left alone, so a
 * shop's people do not blink out around the player at closing time.
 *
 * The non-shop arm is gated on `buildingType <= House4`, which is not
 * a tidy "residences only": Temple (14), Tavern (15) and Palace (16)
 * are all under it, so a Palace's people keep its 10:00-16:00 hours
 * while a House5 (21) or a Ship (24) is never gated at all.
 *
 * @param building - { buildingType, factionId, buildingKey }
 * @param ctx.hour              - the classic hour (0-23)
 * @param ctx.insideOpenShop    - PlayerEnterExit.IsPlayerInsideOpenShop,
 *                                the entry-time latch above
 * @param ctx.isHouseOwned(key) - DaggerfallBankManager.IsHouseOwned (H1)
 * @param ctx.guildForBuilding(factionId) -> { hallAccessAnytime, isMember }
 * @returns true if the person stands and is wired to the quest machine
 */
export function peopleAreVisible(building, {
  hour = 12, insideOpenShop = false,
  isHouseOwned = null, guildForBuilding = null,
} = {}) {
  const type = building?.buildingType ?? BUILDING_TYPES.None;
  const factionId = building?.factionId ?? 0;
  const g = guildForBuilding?.(factionId) ?? null;

  // "Disable people if player owns this house" (:1209-1212)
  if (isHouseOwned?.(building?.buildingKey) ?? false) return false;

  // A shop shows its people exactly when the player walked into an
  // OPEN one (:1215) - the latch, not the hour.
  if (isShop(type)) return insideOpenShop;

  // ...and every other building up to House4 keeps its hours, unless
  // it is a guild hall the player may enter at any time, or a TG/DB
  // house they are a member of (:1216-1220).
  const isTGDBHouseMember = type === BUILDING_TYPES.House2
    && factionId !== 0 && (g?.isMember ?? false);
  if (type <= BUILDING_TYPES.House4
    && !isBuildingOpen(type, hour)
    && !(type === BUILDING_TYPES.GuildHall && (g?.hallAccessAnytime ?? false))
    && !isTGDBHouseMember) return false;

  return true;
}

/**
 * ROAD-B B5 - DaggerfallInterior.UpdateNpcPresence (:341-361), whose
 * ONE caller in DFU's whole tree is DaggerfallRestWindow.OnPop
 * (:277-280): "Update NPC presence for shops and guilds after
 * resting/idling". Walk out of a rest window inside a building and the
 * people who were not standing when you walked in are re-rolled.
 *
 * It is NOT peopleAreVisible re-run, and the differences are the point:
 *
 *  - It only ever SetActive(TRUE) (:355-358). Nobody is ever taken
 *    away by it, so loitering until closing time does not empty the
 *    shop around you - the sleeper gains company, never loses it.
 *  - It does NOT consult house ownership. AddPeople's tail hides the
 *    people of a house you bought (:1209-1212); this member never asks,
 *    so its arms are reached for an owned house too. Harmless in
 *    practice (an owned house is a residence, and every residence's
 *    hours still have to pass) and left exactly as written rather than
 *    tidied into the visibility law next door.
 *  - The shop arm is the NEGATION of AddPeople's: there, a shop shows
 *    its people when the player walked into an OPEN one; here, the arm
 *    is taken when they did NOT - which is precisely the case worth
 *    re-rolling, the shop entered before opening time.
 *  - HouseForSale is excluded BY NAME (:349) even though its type (1)
 *    is under the House4 bound and its hours are ordinary. An empty
 *    house on the market stays empty.
 *  - The clock test is IsBuildingOpen (:352) - the same
 *    PlayerActivate.cs:102-106 hours buildingLocks.js already owns, and
 *    it sits INSIDE the gate rather than beside it, so a building that
 *    fails both arms is never asked about the hour at all.
 *
 * Answers whether the interior's people should now be made present;
 * the host does the SetActive walk over its own billboard list.
 *
 * @param buildingType - DFLocation.BuildingTypes
 * @param ctx.hour            - the classic hour (0-23)
 * @param ctx.insideOpenShop  - PlayerEnterExit.IsPlayerInsideOpenShop
 */
export function updateNpcPresence(buildingType, { hour = 12, insideOpenShop = false } = {}) {
  const type = buildingType ?? BUILDING_TYPES.None;
  const gate = (isShop(type) && !insideOpenShop)
    || (!isShop(type) && type <= BUILDING_TYPES.House4 && type !== BUILDING_TYPES.HouseForSale);
  if (!gate) return false;
  return isBuildingOpen(type, hour);
}
