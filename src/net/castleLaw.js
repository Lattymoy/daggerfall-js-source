// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DOMAIN2 (2026-10-24, the owner: "Allowing the purchase of the actual
// castle in major cities (cyrodil excluded), using the instancing system";
// asked, "One owner per castle", "Silver", "Region holder buys it") - THE
// CASTLE'S LAW, one home for every end (bible/11-Multiplayer/Domains.md
// section 6).
//
// A CASTLE IS ITS REGION'S (Domains law 3). A crown's region keeps one -
// the Iliac Bay's three kingdoms', its crown city's own dungeon, whose map
// id is the crown seat's key (townSeats.js seatOfLocation: a seat's key
// IS its location's map id, and a crown city's castle is that location's
// dungeon) - so no castle's map id is typed here. Only the guild holding
// that region's Charter buys it, in silver from its treasury; it is the
// guild's own instance of the castle, whole (net/instanceRoom.js, its
// owner the guild's digest); and when the Charter leaves the guild by any
// road the castle goes with it, half its price home. Given up while the
// region is held, 85% - a hall's share (homeLaw.js HOME_SALE_SHARE).
//
// Pure, and no words: the account service (server-account/src/castles.js),
// the guild's book and the Guild window (ui/socialPanel.js, which says it
// in the player's language) read it. DOMAIN4 adds the provinces' crowns.
// ═══════════════════════════════════════════════════════════════════
import { CROWN_SEAT_REGIONS } from './townSeatLaw.js';
import { kingdomSeatName } from './kingdomLaw.js'; // AUDIT TESA III E2-2: a castle's city, its crown's seat
import { GUILD_RANK_MASTER } from './guild/guildLaw.js';
import { HOME_SALE_SHARE } from './homeLaw.js'; // a hall's share, one home
import { CASTLE_MAP_IDS } from './instanceRoom.js'; // AUDIT DOMAINS R2: the castles the relay admits a guild to

/** What a castle costs its region's holder, in silver from the guild's treasury - burnt (one and a half crown claim
 *  fees, townSeatLaw.js CLAIM_FEE.crown). */
export const CASTLE_PRICE = 120_000;
/** The share of the price that comes home when the Guildmaster gives the castle up while the region is held - a hall's
 *  (homeLaw.js HOME_SALE_SHARE). */
export const CASTLE_SALE_SHARE = HOME_SALE_SHARE;
/** The share that comes home when the region's Charter leaves the guild and takes the castle with it (the owner: "the
 *  old owner is refunded part of the price"). */
export const CASTLE_LOST_SHARE = 0.5;
/** Who may do what with a castle: the Guildmaster buys and gives it up; any member walks in (the relay's `guild` arm). */
export const CASTLE_POWERS = Object.freeze({
  buy: Object.freeze([GUILD_RANK_MASTER]),
  sell: Object.freeze([GUILD_RANK_MASTER]),
});
/** May a member of rank `rank` do `power` with a castle? */
export const castleMay = (rank, power) => (CASTLE_POWERS[power] ?? []).includes(rank);
/** Does region `r` keep a castle? The Bay's three crowns (DOMAIN4: each province's but Cyrodiil's). */
export const castleRegionOk = (r) =>
  Number.isSafeInteger(r) && Object.prototype.hasOwnProperty.call(CROWN_SEAT_REGIONS, r);
/** AUDIT DOMAINS R2: is `key` (a crown seat's, as the registry confirmed it) a castle the relay admits a guild to - a crown
 *  city's own dungeon (net/instanceRoom.js CASTLE_MAP_IDS)? A castle sold at any other would be a room no member enters. */
export const castleKeyOk = (key) => CASTLE_MAP_IDS.includes(key);
/** AUDIT TESA III E2-2 (bible/01-Overview/audits/Audit-Tesa-III-E2.md): THE CITY A REGION'S CASTLE STANDS IN - its crown's
 *  seat (net/kingdomLaw.js kingdomSeatName): Daggerfall, Wayrest and Sentinel the Bay's (their regions' own names), and past
 *  the Bay the province's capital - Solitude, Mournhold, Alinor, Falinesti, Torval, Helstrom - where the Guild window named
 *  the province itself: "Castle Skyrim", its door "in Sumurset Isle". Null for a region that keeps none. */
export const castleCityOf = (r) => (castleRegionOk(r) ? kingdomSeatName(CROWN_SEAT_REGIONS[r]) : null);
/** The regions that keep a castle, in order. */
export const CASTLE_REGIONS = Object.freeze(
  Object.keys(CROWN_SEAT_REGIONS)
    .map(Number)
    .sort((a, b) => a - b),
);
/** What comes home of `paid` when the castle is given up - rounded down. */
export const castleSaleRefund = (paid) => Math.floor(Math.max(0, Number(paid) || 0) * CASTLE_SALE_SHARE);
/** What comes home of `paid` when the region is lost - rounded down. */
export const castleLostRefund = (paid) => Math.floor(Math.max(0, Number(paid) || 0) * CASTLE_LOST_SHARE);
/**
 * THE CASTLES A GUILD MAY BUY - each region whose crown Charter it holds (`holds`: its Charters, `{ key, region, tier }`)
 * and whose castle nobody keeps (`kept`: the regions with a castle bought) and the relay admits a guild to (castleKeyOk),
 * `{ region, key }` in region order. Pure.
 * @param {{ key: number, region: number, tier: string }[]} holds @param {Iterable<number>} kept
 */
export function castleOffers(holds, kept) {
  const taken = new Set(kept ?? []);
  return (holds ?? [])
    .filter((h) => h?.tier === 'crown' && castleRegionOk(h.region) && castleKeyOk(h.key) && !taken.has(h.region)) // AUDIT DOMAINS R2: a castle the relay admits
    .map((h) => ({ region: h.region, key: h.key }))
    .sort((a, b) => a.region - b.region);
}
