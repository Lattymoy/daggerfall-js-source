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
import {
  seatShopFactor,
  seatArrivalNews,
  bailiwickOf,
  bountySitePixel,
  bountyClaimPixel,
  bountyDenId,
  CURFEW,
  FESTIVE,
} from '../net/townSeatLaw.js';
import { t } from './textManager.js'; // BAY-LEFT-SEA: a den's pay, in the player's language
import { isNight } from '../world/worldClock.js';

/** The entity fold's name the Festive buff rides (systems/entityMods.js registerEntityFold). */
export const FESTIVE_FOLD = 'seat-festive';
/** What the HUD says as the Festive buff takes, and as a Bounty pays. */
export const FESTIVE_TEXT = 'The town is at Festival. You feel Festive.';
export const bountyPaidText = (n) => `The Bounty pays you ${n} silver for the camp.`;
/** BAY-LEFT-SEA: what the HUD says as a Bounty pays for a den past the Bay. */
export const bountyDenPaidText = (n) => t('seat.bounty.denPaid', 'The Bounty pays you {n} silver for the den.', { n });
/** BAY-LEFT-SEA (net/townSeatLaw.js bountyDenId): the den a dungeon IS - a lair's (TESA8, past the Bay: its location's
 *  `country` names its pixel) - or null; the world host asks it of the dungeon the player stands in as a foe falls. */
export const lairDenOf = (loc) => (loc?.country?.dungeon ? bountyDenId('lair', loc.country.px, loc.country.py) : null);
/** BAY-LEFT-SEA: a den's claim is asked again no sooner than this (ms, the real clock) - a lair asks at a foe's fall, and
 *  a lair holds dozens; the service pays a den once a UTC day, so one ask a visit is the claim, and an ask that met no
 *  answer (offline) is asked again at a later foe. A camp's (the Bay's) is asked at each, as ever. */
export const BOUNTY_DEN_ASK_GAP_MS = 10 * 60 * 1000;
const MINUTES_A_DAY = 1440;

/** The Festive buff's mods: +5 to every attribute (`keys` statMods.js STAT_KEYS_ORDER). */
export const festiveMods = (keys) => ({ stats: Object.fromEntries(keys.map((k) => [k, FESTIVE.attributes])) });

/** SEASON1 part two: an Orc Raid's camp counted for the guild. */
export const ORC_CAMP_TEXT = 'The Orc Raids: your guild gains 50 influence at its seat in the region.';
/**
 * @param {{ seatAt: (mapId: any) => any, here: () => any, seats: () => any[], guildId: () => (string|null),
 *   minutes: () => number, regionAt: (px: number, py: number) => number, say?: (line: string, s?: number) => void,
 *   claim?: (site: string, region: number) => Promise<{ paid: number }>, onFestive?: () => void,
 *   tideAt?: (region: number) => string, orcCamp?: (site: string, region: number) => Promise<{ counted: boolean }>,
 *   nowMs?: () => number }} host   SEASON1 part two: the land's Tide, an Orc Raid's camp; BAY-LEFT-SEA: `nowMs` the real clock (Date.now)
 *   `seatAt` a town's seat, dressed (null where none); `here` the map id the player stands in; `seats` every seat this
 *   client knows, dressed; `guildId` the playing character's own guild; `minutes` the game clock; `regionAt` a map
 *   pixel's region.
 */
export function createSeatEdicts(host) {
  let festiveUntil = -Infinity;
  /** DOMAIN3: the Charter a town's shops, watch and news answer to - a holding's its region's (net/townSeatBook.js dressed
   *  `charterSeat`), every other seat its own. */
  const charterAt = (mapId) => {
    const s = host.seatAt(mapId);
    return s?.charterSeat ?? s ?? null;
  };
  const edictAt = (mapId) => charterAt(mapId)?.holder?.edict ?? null;
  const curfew = () => edictAt(host.here()) === 'curfew';
  /** The seat whose bailiwick a map pixel in `region` lies in, dressed - null where the region holds none. */
  const bailiwick = (region, pixel) => bailiwickOf(host.seats() ?? [], region, pixel);
  const bountyAt = (region, pixel) => bailiwick(region, pixel)?.holder?.edict === 'bounty';
  /** BAY-LEFT-SEA: each den's last ask (its id -> the real clock's ms), BOUNTY_DEN_ASK_GAP_MS apart. */
  const denAsked = new Map();
  /** A camp cleared, or a den past the Bay (campCleared's doc). */
  async function campCleared(site) {
    const pixel = typeof site === 'string' ? bountyClaimPixel(site) : null;
    if (!pixel || !host.claim) return 0;
    const region = host.regionAt(pixel[0], pixel[1]),
      camp = !!bountySitePixel(site);
    if (camp && (host.tideAt?.(region) ?? 'calm') === 'orcs' && host.orcCamp) {
      host
        .orcCamp(site, region)
        .then((r) => {
          if (r?.counted) host.say?.(ORC_CAMP_TEXT, 4);
        })
        .catch(() => {});
    }
    if (!bountyAt(region, pixel)) return 0;
    if (!camp) {
      const now = host.nowMs?.() ?? Date.now(),
        was = denAsked.get(site);
      if (was != null && now - was < BOUNTY_DEN_ASK_GAP_MS) return 0;
      denAsked.set(site, now);
    }
    const r = await host.claim(site, region).catch(() => ({ paid: 0 }));
    if (r.paid > 0) host.say?.(camp ? bountyPaidText(r.paid) : bountyDenPaidText(r.paid), 4);
    return r.paid;
  }
  /** BAY-LEFT-SEA: a den past the Bay cleared (bountyDenId; on the Bay none) - claimed as a camp is. */
  const denCleared = (kind, px, py) => campCleared(bountyDenId(kind, px, py));
  return {
    /** THE SHOP'S FACTOR (7.2, 7.6): what a seat town's shop asks this player, as a share of its price - its building's
     *  town (`b.townMapId`), 1 anywhere else. */
    shopFactor: (b) => seatShopFactor(charterAt(b?.townMapId), host.guildId()),
    /** THE ARRIVAL (7.3, 7.6): the town's news said after its line, and a Festival's buff taken for a game day. */
    arrived(town) {
      const seat = town?.charterSeat ?? town; // DOMAIN3: a holding's news is its Charter's
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
    guardLevelBonus: (minuteOfDay) =>
      curfew() && isNight(((minuteOfDay % MINUTES_A_DAY) + MINUTES_A_DAY) % MINUTES_A_DAY) ? CURFEW.guardLevels : 0,
    /** CURFEW: what a crime in this town costs, as a multiple of its legal reputation. */
    crimeFactor: () => (curfew() ? CURFEW.crimeFactor : 1),
    /** THE BOUNTY (7.6): whether a World of Daggerfall camp at map pixel (`px`, `py`) lies in a Bounty seat's
     *  bailiwick - its loot doubled. */
    bountyAt: (px, py) => bountyAt(host.regionAt(px, py), [px, py]),
    /** SEASON1 part two (Seats-Arc 9.3): whether an Orc Raid is the Tide at map pixel (`px`, `py`) - its camps doubled. */
    orcsAt: (px, py) => (host.tideAt?.(host.regionAt(px, py)) ?? 'calm') === 'orcs',
    /** A camp cleared by this player - `site` its id (src/world/worldOfDaggerfall/wodShared.js wodSiteId, naming its pixel), claimed where a
     *  Bounty rules (and, SEASON1 part two, where an Orc Raid is the Tide - its influence). Answers the Drakes paid.
     *  BAY-LEFT-SEA: or a den past the Bay (net/townSeatLaw.js bountyDenPixel), claimed the same way - never an Orc Raid's,
     *  and asked once in BOUNTY_DEN_ASK_GAP_MS (a lair's foe struck down: the world host hands its dungeon's den, lairDenOf). */
    campCleared,
    /** BAY-LEFT-SEA: a den past the Bay cleared - an outlaws' hideout routed (scenes/hideouts.js), a lair's foe struck
     *  down - claimed as a camp is (bountyDenId; on the Bay none). Answers the Drakes paid. */
    denCleared,
    /** BAY-LEFT-SEA: an outlaws' hideout routed (scenes/hideouts.js `routed`, its hideout `h` - its map pixel) - its den
     *  claimed, quietly. */
    hideoutRouted: (h) => {
      denCleared('hideout', h?.px, h?.py).catch(() => {});
    },
  };
}
