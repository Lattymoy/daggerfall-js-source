// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT1d (2026-10-01, Mac: "Finish the seats"; "Continue") - A HELD SEAT
// AS THIS CLIENT LIVES IT (bible/11-Multiplayer/Seats-Arc.md 7.2, 7.3,
// 7.6): the seat town's shops priced for its holder's members and on
// Market Day; the town's news after its arrival line (Unrest, the Edict
// that rules); the Festive buff a Festival gives everyone who comes into
// the town; Curfew's stronger night watch and its doubled crime; the
// Bounty's camps - their loot doubled, each one cleared claimed.
//
// Every one of them is the player's own client acting on its own play -
// the members' discount is "their own gold, nothing to cheat but
// themselves" (7.2), and so is a Festival's buff or a Curfew's guard.
// What moves Drakes (the Bounty's twenty) is the service's, bounded there
// (seatHolding.js claimBounty). The seat a town is comes dressed from the
// seats' book (net/townSeatBook.js dressed: its holder, its Standing, the
// Edict that rules) - nothing here reads the service itself.
// ═════════════════════════════════════════════════════════════════════
import { seatShopFactor, seatArrivalNews, bailiwickOf, bountySitePixel, CURFEW, FESTIVE } from '../net/townSeatLaw.js';
import { isNight } from '../world/worldClock.js';

/** The entity fold's name the Festive buff rides (systems/entityMods.js registerEntityFold). */
export const FESTIVE_FOLD = 'seat-festive';
/** What the HUD says as the Festive buff takes, and as a Bounty pays. */
export const FESTIVE_TEXT = 'The town is at Festival. You feel Festive.';
export const bountyPaidText = (n) => `The Bounty pays you ${n} silver for the camp.`;
const MINUTES_A_DAY = 1440;

/** The Festive buff's mods: +5 to every attribute (`keys` statMods.js STAT_KEYS_ORDER). */
export const festiveMods = (keys) => ({ stats: Object.fromEntries(keys.map((k) => [k, FESTIVE.attributes])) });

/** SEASON1 part two: an Orc Raid's camp counted for the guild. */
export const ORC_CAMP_TEXT = 'The Orc Raids: your guild gains 50 influence at its seat in the region.';
/**
 * @param {{ seatAt: (mapId: any) => any, here: () => any, seats: () => any[], guildId: () => (string|null),
 *   minutes: () => number, regionAt: (px: number, py: number) => number, say?: (line: string, s?: number) => void,
 *   claim?: (site: string, region: number) => Promise<{ paid: number }>, onFestive?: () => void,
 *   tideAt?: (region: number) => string, orcCamp?: (site: string, region: number) => Promise<{ counted: boolean }> }} host   SEASON1 part two: the land's Tide, an Orc Raid's camp
 *   `seatAt` a town's seat, dressed (null where none); `here` the map id the player stands in; `seats` every seat this
 *   client knows, dressed; `guildId` the playing character's own guild; `minutes` the game clock; `regionAt` a map
 *   pixel's region.
 */
export function createSeatEdicts(host) {
  let festiveUntil = -Infinity;
  const edictAt = (mapId) => host.seatAt(mapId)?.holder?.edict ?? null;
  const curfew = () => edictAt(host.here()) === 'curfew';
  /** The seat whose bailiwick a map pixel in `region` lies in, dressed - null where the region holds none. */
  const bailiwick = (region, pixel) => bailiwickOf(host.seats() ?? [], region, pixel);
  const bountyAt = (region, pixel) => bailiwick(region, pixel)?.holder?.edict === 'bounty';
  return {
    /** THE SHOP'S FACTOR (7.2, 7.6): what a seat town's shop asks this player, as a share of its price - its building's
     *  town (`b.townMapId`), 1 anywhere else. */
    shopFactor: (b) => seatShopFactor(host.seatAt(b?.townMapId), host.guildId()),
    /** THE ARRIVAL (7.3, 7.6): the town's news said after its line, and a Festival's buff taken for a game day. */
    arrived(seat) {
      const news = seatArrivalNews(seat);
      if (news) host.say?.(news, 5);
      if (seat?.holder?.edict === 'festival') {
        festiveUntil = host.minutes() + FESTIVE.gameDays * MINUTES_A_DAY;
        host.say?.(FESTIVE_TEXT, 5);
        host.onFestive?.();
      }
    },
    /** Whether the Festive buff holds now. */
    festive: () => host.minutes() < festiveUntil,
    /** CURFEW (7.6): the levels a town watchman stands stronger, at night in a Curfew town. */
    guardLevelBonus: (minuteOfDay) => (curfew() && isNight(((minuteOfDay % MINUTES_A_DAY) + MINUTES_A_DAY) % MINUTES_A_DAY) ? CURFEW.guardLevels : 0),
    /** CURFEW: what a crime in this town costs, as a multiple of its legal reputation. */
    crimeFactor: () => (curfew() ? CURFEW.crimeFactor : 1),
    /** THE BOUNTY (7.6): whether a World of Daggerfall camp at map pixel (`px`, `py`) lies in a Bounty seat's
     *  bailiwick - its loot doubled. */
    bountyAt: (px, py) => bountyAt(host.regionAt(px, py), [px, py]),
    /** SEASON1 part two (Seats-Arc 9.3): whether an Orc Raid is the Tide at map pixel (`px`, `py`) - its camps doubled. */
    orcsAt: (px, py) => (host.tideAt?.(host.regionAt(px, py)) ?? 'calm') === 'orcs',
    /** A camp cleared by this player - `site` its id (src/world/worldOfDaggerfall/wodShared.js wodSiteId, naming its pixel), claimed where a
     *  Bounty rules (and, SEASON1 part two, where an Orc Raid is the Tide - its influence). Answers the Drakes paid. */
    async campCleared(site) {
      const pixel = typeof site === 'string' ? bountySitePixel(site) : null;
      if (!pixel || !host.claim) return 0;
      const region = host.regionAt(pixel[0], pixel[1]);
      if ((host.tideAt?.(region) ?? 'calm') === 'orcs' && host.orcCamp) {
        host.orcCamp(site, region).then((r) => { if (r?.counted) host.say?.(ORC_CAMP_TEXT, 4); }).catch(() => {});
      }
      if (!bountyAt(region, pixel)) return 0;
      const r = await host.claim(site, region).catch(() => ({ paid: 0 }));
      if (r.paid > 0) host.say?.(bountyPaidText(r.paid), 4);
      return r.paid;
    },
  };
}
