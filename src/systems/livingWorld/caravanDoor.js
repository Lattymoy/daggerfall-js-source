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
import { WALK_FROM_H, WALK_TO_H, NATIVE_PER_M, NATIVE_PIXEL, partyAt, membersAt } from './trips.js';

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
/** AUDIT LW-II C5b: the clock passed since the escort was last with the party (a step's, a rest's, a wait's, a
 *  journey's) is read back this often (minutes) for the party near. */
export const ESCORT_SAMPLE_MIN = 5;

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
 * THE HOLD-UP: the party's armed the road left standing at `t` are all down by the host's word, and its leader stands -
 * it yields.
 * AUDIT LW-II C4: the armed BEATEN - those the road left it (its own fallen are the road's: a party that lost its guards
 * to the dice had nobody for the player to beat, and yielded to whoever passed); `down` the host's word, the player's own
 * hand (a sellsword who died fighting beside the player, or one another hand took, was never beaten by them).
 * @param {any} trip @param {number} t @param {(res: any) => boolean} [down] - one down by the host's word (the player's hand)
 */
export function yields(trip, t, down = () => false) {
  const left = membersAt(trip, t);
  if (!left.some((m) => m.cls != null)) return false;
  const standing = left.filter((m) => !down(m));
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
 *  day's rate for the player's level, and each foe of the fights won. AUDIT LW-II C5a: hired on the way (`from`, the
 *  minute of the hire), the share of the walk still ahead of the party then - hired a minute short of the town, it paid
 *  the whole walk. @param {any} trip @param {number} level @param {number} foes @param {number} [from] */
export function escortPay(trip, level, foes = 0, from = -Infinity) {
  const len = Math.max(0, trip.way.len - trip.trim0 - trip.trim1);
  const walk = len / Math.max(1e-9, trip.pace);
  const days = Math.max(1, Math.ceil(walk / ((WALK_TO_H - WALK_FROM_H) * 60)));
  const at = from > trip.outT0 ? partyAt(trip, from) : null;
  const ahead = at?.s != null ? Math.min(1, Math.max(0, trip.way.len - trip.trim1 - at.s) / Math.max(1e-9, len)) : 1;
  return Math.round(days * (ESCORT_GOLD_DAY + ESCORT_GOLD_LEVEL * Math.max(1, level | 0)) * ahead) + ESCORT_FIGHT * Math.max(0, foes | 0);
}

/**
 * AUDIT LW-II C5b: THE LAST MINUTE THE ESCORT WAS WITH THE PARTY, to minute `t` - `since` the last the contract knew.
 * The clock since is read back each ESCORT_SAMPLE_MIN against where the player stands now (`here`): the last minute the
 * party stood within ESCORT_KEEP_M before a stretch of ESCORT_LOST_MIN without it. A party camped beside a sleeper keeps
 * them; one that walked off from a sleeper does not, nor one that came up to them after an hour of their sleep; and a
 * journey that set the player down beside it (by its town as it came in) was a stretch away - the party stood near
 * the journey's end only at its end (it was paid: the end alone was read). The host's own `travelWith` writes the road
 * it walked beside them. A party lodged at an inn is near anyone at that inn (a night slept under its roof).
 * @param {any} trip @param {{ x: number, z: number } | null} here @param {number} since @param {number} t
 */
export function escortNear(trip, here, since, t) {
  if (!here || !Number.isFinite(t) || !Number.isFinite(since)) return since;
  // a party lodged at an inn (LW9: placed on the road beside it, up to a pixel off) is with whoever is at that inn - its
  // location the one on its pixel
  const near = (/** @type {number} */ m) => {
    const at = partyAt(trip, m);
    if (at.inn && Math.floor(here.x / NATIVE_PIXEL) === at.inn.px && 499 - Math.floor(here.z / NATIVE_PIXEL) === at.inn.py) return true;
    return at.x != null && Math.hypot(here.x - /** @type {number} */ (at.x), here.z - /** @type {number} */ (at.z)) / NATIVE_PER_M <= ESCORT_KEEP_M;
  };
  let last = since;
  for (let m = since; ; m = Math.min(t, m + ESCORT_SAMPLE_MIN)) {
    if (m - last > ESCORT_LOST_MIN) return last;
    if (near(m)) last = Math.max(last, m);
    if (m >= t) return last;
  }
}

/** A ware's place on its counter's first roll, carried on the item (the record's `gone` names these). */
export const WARE_KEY = '_lwWare';
