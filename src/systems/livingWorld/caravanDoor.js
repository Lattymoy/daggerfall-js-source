// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW11 (2026-10-09, bible/06-Systems/Living-World-II.md "LW11"): THE CARAVAN'S DOOR - what a party on the road offers
// the player, and what a deed against it costs. Mac: "caravans ... that can be assaulted, protected or traded with".
// Pure: the trip's own data and the clock in, the law out; the host (scenes/world.js) opens the windows and keeps the
// character's records (relations.js `wares`, `reports`, `escort`).
//
// THE COUNTER (`counterOf`). A caravan's merchant, a pedlar on their round and a carter on the way to market keep a
// counter on the road: a merchant's and a carter's a general store's, a pedlar's a pawnbroker's, its quality by its
// town's size (`CARAVAN_QUALITY`), its PURSE (`purseOf`) all the coin it has for what the player sells it on the trip.
// Its stock is the counter's own roll (shopStock.js stockShopShelf), seeded by the trip - the same all trip - and what
// the character bought or took stays gone (their `wares`).
//
// A DEED ON THE ROAD (Living World II decision 5) is a crime against the REGION where the road runs, charged only when a
// witness reaches a town alive (`reportAt`: the party's next arrival - the town it set out for on the way out, home on
// the way back); the character killing every witness first voids it.
//
// THE HOLD-UP (`yields`). A party whose armed are all down while its leader stands YIELDS: the purse and the goods are
// the player's to take, and the party walks home robbed.
//
// THE ESCORT (`escortOffer`, `escortPay`). A merchant offers the road to the player before setting out (within
// ESCORT_OFFER_MIN of it) or on the way out: paid ESCORT_GOLD_DAY a day of the walk out (by the player's level) and
// ESCORT_FIGHT a foe of each fight won, at the town it was bound for; broken by falling ESCORT_KEEP_M behind for
// ESCORT_LOST_MIN of the clock.
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { WALK_FROM_H, WALK_TO_H, partyAt, membersAt } from './trips.js';

/** The kinds of trip that keep a counter on the road, and its kind of shop. */
export const COUNTERS = Object.freeze({ merchant: BUILDING_TYPES.GeneralStore, carter: BUILDING_TYPES.GeneralStore, pedlar: BUILDING_TYPES.PawnShop });
/** A counter's quality by its town's size: 6 and one each four blocks, to 20. @param {any} trip */
export const CARAVAN_QUALITY = (trip) => Math.max(1, Math.min(20, 6 + Math.floor((trip.from?.blocks | 0) / 4)));
/** The coin a counter's purse holds for a trip, by its quality. */
export const PURSE_PER_QUALITY = 300;
/** A friend's counter takes this off its prices (a share). */
export const FRIEND_DISCOUNT = 0.1;
/** A merchant offers the road this many minutes before setting out, and on the way out. */
export const ESCORT_OFFER_MIN = 18 * 60;
/** The escort's pay: a day of the walk out at its base and a level's more, and each foe of a fight won. */
export const ESCORT_GOLD_DAY = 60;
export const ESCORT_GOLD_LEVEL = 15;
export const ESCORT_FIGHT = 100;
/** The escort broken: this far behind the party (m) this long (minutes of the clock). */
export const ESCORT_KEEP_M = 300;
export const ESCORT_LOST_MIN = 60;

/**
 * THE COUNTER a trip keeps on the road - its shop's kind, quality, name and purse - or null (a trip that keeps none).
 * @param {any} trip @returns {{ buildingType: number, quality: number, name: string, purse: number } | null}
 */
export function counterOf(trip) {
  const buildingType = COUNTERS[/** @type {keyof typeof COUNTERS} */ (trip?.kind)];
  if (buildingType == null) return null;
  const quality = CARAVAN_QUALITY(trip);
  const name = trip.kind === 'merchant' ? `${trip.leader?.name ?? 'The'}'s caravan` : `${trip.leader?.name ?? 'The'}'s pack`;
  return { buildingType, quality, name, purse: purseOf(quality) };
}
/** A counter's purse for its trip, by its quality. @param {number} quality */
export const purseOf = (quality) => PURSE_PER_QUALITY * Math.max(1, quality);

/**
 * WHO KEEPS THE COUNTER: the trip's leader, on the road (out or home, not fighting) at minute `t` - the merchant at
 * their wagon, the pedlar, the carter - and standing.
 * @param {any} trip @param {any} res @param {number} t
 */
export function keepsCounter(trip, res, t) {
  if (!counterOf(trip) || res?.id !== trip.leader?.id) return false;
  const at = partyAt(trip, t);
  if ((at.phase !== 'out' && at.phase !== 'back') || at.fight) return false;
  return membersAt(trip, t).some((m) => m.id === res.id);
}

/** WHERE A WITNESS CARRIES IT: the minute the party next reaches a town - the one it set out for on the way out (a
 *  party turned home: home), else home. @param {any} trip @param {number} t */
export const reportAt = (trip, t) => (t < trip.outT1 && !trip.turned ? trip.outT1 : trip.backT1);

/**
 * THE HOLD-UP: the party had armed, none of them stands at `t`, and its leader does - it yields.
 * @param {any} trip @param {number} t @param {(res: any) => boolean} [down] - beside the trip's own fallen, one down by the
 *   host's word (a hand's death the trip has not read yet)
 */
export function yields(trip, t, down = () => false) {
  const armed = trip.party.filter((m) => m.cls != null);
  if (!armed.length) return false;
  const standing = membersAt(trip, t).filter((m) => !down(m));
  return !standing.some((m) => m.cls != null) && standing.some((m) => m.id === trip.leader?.id);
}

/**
 * THE ROAD OFFERED: a merchant's trip the player may hire on to at minute `t` - from ESCORT_OFFER_MIN before it sets out
 * until it is in.
 * @param {any} trip @param {number} t
 */
export function escortOffer(trip, t) {
  return trip?.kind === 'merchant' && !trip.turned && !trip.sea && t >= trip.outT0 - ESCORT_OFFER_MIN && t < trip.outT1;
}

/** THE ESCORT'S PAY at the town: the days of the walk out (each from WALK_FROM_H to WALK_TO_H, a part a whole) at the
 *  day's rate for the player's level, and each foe of the fights won. @param {any} trip @param {number} level @param {number} foes */
export function escortPay(trip, level, foes = 0) {
  const walk = Math.max(0, trip.way.len - trip.trim0 - trip.trim1) / Math.max(1e-9, trip.pace);
  const days = Math.max(1, Math.ceil(walk / ((WALK_TO_H - WALK_FROM_H) * 60)));
  return days * (ESCORT_GOLD_DAY + ESCORT_GOLD_LEVEL * Math.max(1, level | 0)) + ESCORT_FIGHT * Math.max(0, foes | 0);
}

/** A ware's place on its counter's first roll, carried on the item (the record's `gone` names these). */
export const WARE_KEY = '_lwWare';
