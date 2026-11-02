// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { activeMemberships, joinedGuildOfGroup } from '../systems/guild/guilds.js';
import { diseaseCount } from '../systems/diseases.js';
import { freeShipTravel, freeTavernRooms } from '../systems/guild/guildServices.js';
import { goldAmount, totalGoldAmount } from '../systems/court.js';
import { GUILD_GROUPS } from '../formats/factionFile.js';
import { isOnShip } from '../systems/ship.js';
import { orderOf } from '../systems/guild/guildVariants.js';
import { ownsShip } from '../systems/banking.js';
import { playerEntity } from '../characters/playerEntity.js';
import { poisonCount } from '../systems/poisons.js';
import { sharedClockOn } from '../systems/worldTick.js';
import { TRANSPORT_HORSE, TRANSPORT_SMALL_CART } from '../systems/shopStock.js';

/** @param {any} host */
export function createTravelFareDeps(host) {
  const { hasTransport, locationIndex, playerTravelPixel, refreshTravelOptionsSettings, townTalk, travelOriginMapId } =
    host;
  /** PARTY-TRAVEL (2026-09-25): THE TRAVEL POPUP'S OWN DEP BAG - every read ui/travel/travelPopUp.js prices a trip with and
   *  its gold check asks, lifted out of buildTravelMapWindow's bag (which spreads it, so both maps read it as before)
   *  so the party's journeys price a trip through the SAME popup without opening a map (partyTripFare). One bag: a
   *  fare the map charges and a fare the party's prompt names cannot drift apart. */
  function travelFareDeps() {
    return {
      // TP1: the popup's GuildManager.FastTravel fold reads the
      // player's guild memberships off the entity.
      playerEntity: () => playerEntity,
      // GetGoldAmount is coins PLUS letters of credit; the popup's
      // second test and its label want the coins alone.
      gold: () => totalGoldAmount(playerEntity),
      goldPieces: () => goldAmount(playerEntity),
      // Items.Contains(Transportation, Horse / Small_cart)
      // (DaggerfallTravelPopUp.cs:216-217) - a town's Stable and Wagon
      // Yard sell both (MERCHANT-YARDS; DFU's General Store did), so the
      // calculator's transport modifier is real.
      hasHorse: () => hasTransport(TRANSPORT_HORSE),
      hasCart: () => hasTransport(TRANSPORT_SMALL_CART),
      // `DaggerfallBankManager.OwnsShip || GuildManager.FreeShipTravel()`
      // (DaggerfallTravelPopUp.cs:219), read at OnPush like the two
      // above. FreeShipTravel is base-false everywhere and overridden
      // only by the knightly orders (KnightlyOrder.cs:167-170: rank 6),
      // so the order slot of the membership book is the only one that
      // can answer yes; the record keys by GROUP and carries the
      // guild's name, so the order is recoverable from it (the tavern
      // window's free-rooms read does the same).
      hasShip: () => {
        if (ownsShip(playerEntity)) return true;
        const km = joinedGuildOfGroup(activeMemberships(playerEntity), GUILD_GROUPS.KnightlyOrder);
        const order = km?.guild?.startsWith('Order:') ? orderOf(km.guild.slice('Order:'.length)) : null;
        return !!order && freeShipTravel(order, km);
      },
      // TravelTimeCalculator.cs:163 - `GetGuild(KnightlyOrder)
      // .FreeTavernRooms()`, read inside CalculateTripCost, so the inn
      // nights of a fare are waived for the same knight the tavern
      // window already houses free. The order is recovered from the
      // membership exactly as hasShip above does; the region is
      // PlayerGPS.CurrentLocation.RegionIndex, which is 0 in open
      // wilderness because CurrentLocation is a default struct there.
      freeTavernRooms: () => {
        const km = joinedGuildOfGroup(activeMemberships(playerEntity), GUILD_GROUPS.KnightlyOrder);
        const order = km?.guild?.startsWith('Order:') ? orderOf(km.guild.slice('Order:'.length)) : null;
        if (!order) return false;
        const px = playerTravelPixel();
        return freeTavernRooms(order, km, {
          regionIndex: locationIndex.get(`${px.x},${px.y}`)?.regionIndex ?? 0,
          orderRegion: townTalk.factionDict?.get(order.factionId)?.region ?? null,
        });
      },
      diseaseCount: () => diseaseCount(playerEntity),
      poisonCount: () => poisonCount(playerEntity),
      noWorldTime: () => sharedClockOn(), // OL2: online the trip takes no world time (WORLD5), and the popup says so
      // TO1: the mod itself, and the six reads its additions to the
      // map need. Every one is guarded on the other side - with
      // Travel Options off `travelOptions` answers null and the map is
      // DFU's own, whole.
      travelOptions: () => {
        refreshTravelOptionsSettings();
        return host.travelOptions;
      }, // TO-LIVE: the live keys as they stand at the map's open
      // AUDIT-TO1 D1: PlayerGPS.CurrentLocation's MapId (null in open wilderness, the C#'s !Loaded) and
      // TransportManager.IsOnShip - the two reads IsNotAtPort / HasNoOceanTravel need. SHIP-PORT (2026-09-28,
      // Discord: "a player is at a port but unable to set sail"): ON THE SHIP, the port it was boarded at. The deck
      // ("Your Ship", 2,2 or 5,5) is in neither port list, so the passage was refused from it while every trip is
      // reckoned from the boarding pixel. The mod meets the same dead end; its HasNoOceanTravel names IsOnShip, the
      // passage from the deck it meant (DEPARTURE, Travel-Options.md).
      currentLocationMapId: () => travelOriginMapId(),
      isOnShip: () => isOnShip(playerEntity, playerEntity.boardShipPosition ?? null, playerTravelPixel()),
    };
  }
  return { travelFareDeps };
}
