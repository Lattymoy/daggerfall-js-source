// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAY-LEFT-B (2026-10-27, the audit "no system left behind in the Bay" B4; bible/06-Systems/Talk-Arc.md BAY-LEFT-B) -
// A LOCATION'S KEY FROM ITS BUILDINGS.
//
// MAPS.BSA's MapTable row carries a KEY (DFU's DFRegion.RegionMapTable.Key) that the talk's regional "Where is" reads
// (TalkManager.CheckLocationKeyForRegionalBuilding :1920-1990, systems/answerPipeline.js): three flag bytes, a bit for
// each kind of building the location holds - its temples by their divine in byte 0, its shops in byte 1, its guilds and
// halls in byte 2. DFU reads it and never writes it (the file's own). Measured on the freeware's MAPS.BSA, every one of
// its 15,251 rows carries exactly the key its own building list makes by this table (test/world/locationkey.test.js) -
// so the key IS the location's directory, and a place the port makes past the Bay (a capital of its own blocks,
// world/tamrielCapitals.js) carries its own buildings' key, where it carried the key of the city it borrowed its shape
// from (an Imperial City district with no building claimed a tavern, a bank and three guilds).
//
// The bits (the reader's own table, each read back by CheckLocationKeyForRegionalBuilding):
//   byte 0 - a temple of a divine (its building's faction, or its temple order's divine): Akatosh, Arkay, Dibella,
//            Julianos, Kynareth, Mara, Stendarr, Zenithar, bits 0 to 7;
//   byte 1 - a tavern, a weaponsmith, an armorer, an alchemist, a bank, a bookseller, a clothing store, a gem store;
//   byte 2 - a library, a knightly order's hall (KnightlyOrder.Orders, the ten), the Mages Guild, two bits no town sets,
//            the Fighters Guild, a pawn shop, a palace;
//   byte 3 - a general store (bit 24: every town of the Bay holds one; the reader asks none of byte 3).
// Pure: a building list in, a key out. Not a DFU member: DFU never writes the key (Ledger A, BAY-LEFT-B).
// ═══════════════════════════════════════════════════════════════════
import { BUILDING_TYPES as T } from './buildingNames.js';
import { DIVINES, ORDERS, GUILD_FACTION_IDS } from '../systems/guild/guildFactions.js'; // a leaf: Temple.Divines, KnightlyOrder.Orders, the guilds' ids

/** A divine's faction (Temple.Divines) -> its temple's bit (byte 0). */
export const DIVINE_KEY_BITS = Object.freeze({
  [DIVINES.Akatosh]: 0,
  [DIVINES.Arkay]: 1,
  [DIVINES.Dibella]: 2,
  [DIVINES.Julianos]: 3,
  [DIVINES.Kynareth]: 4,
  [DIVINES.Mara]: 5,
  [DIVINES.Stendarr]: 6,
  [DIVINES.Zenithar]: 7,
});
/** The temple orders a temple's building may name instead of its divine - FACTION.TXT's children of the eight (the
 *  freeware's FACTION.TXT, pinned against it): the order's faction -> its divine. GuildManager.GetGuild walks a templar
 *  order to its divine by the faction's parent (guildVariants.js getDivine); a building's key is read with no faction
 *  table to hand, so the eight are named. */
export const TEMPLE_ORDER_DIVINE = Object.freeze({
  92: DIVINES.Akatosh,
  82: DIVINES.Arkay,
  98: DIVINES.Dibella,
  94: DIVINES.Julianos,
  36: DIVINES.Kynareth,
  88: DIVINES.Mara,
  106: DIVINES.Stendarr,
  84: DIVINES.Zenithar,
});
/** A shop's building type -> its bit (byte 1), and the guilds' byte's and byte 3's typed bits. */
export const BUILDING_KEY_BITS = Object.freeze({
  [T.Tavern]: 8,
  [T.WeaponSmith]: 9,
  [T.Armorer]: 10,
  [T.Alchemist]: 11,
  [T.Bank]: 12,
  [T.Bookseller]: 13,
  [T.ClothingStore]: 14,
  [T.GemStore]: 15,
  [T.Library]: 16,
  [T.PawnShop]: 22,
  [T.Palace]: 23,
  [T.GeneralStore]: 24,
});
/** A guild hall's faction -> its bit (byte 2): the ten knightly orders (KnightlyOrder.Orders - one bit for all ten, as
 *  the reader asks it), the Mages Guild and the Fighters Guild. */
export const GUILD_KEY_BITS = Object.freeze({
  ...Object.fromEntries(Object.values(ORDERS).map((id) => [id, 17])),
  [GUILD_FACTION_IDS.MagesGuild]: 18,
  [GUILD_FACTION_IDS.FightersGuild]: 21,
});

/**
 * A location's MapTable key from its buildings (`{ buildingType, factionId }` each - an exterior's `buildings`).
 * @param {Iterable<{ buildingType?: number, factionId?: number }>} buildings @returns {number}
 */
export function locationKeyOf(buildings) {
  let key = 0;
  for (const b of buildings ?? []) {
    const type = b?.buildingType,
      f = b?.factionId ?? -1;
    const bit =
      type === T.Temple
        ? DIVINE_KEY_BITS[TEMPLE_ORDER_DIVINE[f] ?? f]
        : type === T.GuildHall
          ? GUILD_KEY_BITS[f]
          : BUILDING_KEY_BITS[type];
    if (bit != null) key |= 1 << bit;
  }
  return key >>> 0;
}
