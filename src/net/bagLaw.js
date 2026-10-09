// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAG1 (2026-10-03) — THE MATERIALS BAG AND WHAT A CHARACTER CARRIES:
// the shapes and bounds BOTH ends read (bible/06-Systems/Materials-
// Bag.md). The account service counts (server-account/src/
// professions.js); the client holds the items (systems/materialsBag.js).
// Pure: no clock, no DOM, no network.
//
// Asked (2026-10-03, from LostMyLeg's suggestion on the Discord):
// "implement a crafting mats bag that gets handled like the cart in an
// extra slot. It shouldnt carry unlimited weight but quite a lot";
// "make the bag available in every general store for like 500g";
// "Aslong theres no bag the mats just go into the players inventory" -
// and the request itself: "I definitely like this idea instead of the
// current go straight into your storage. Like having a new player
// actually buy the crafting bag, and still allowing crafting materials
// in the inventory itself."
//
// ═══ WHERE A GATHERED UNIT IS ══════════════════════════════════════
//
// A harvest lands in the MATERIALS BAG when the character owns one and
// it has room, else in the PACK - as the very item a withdrawal from
// the Stores always minted (systems/profItems.js) - and past the pack's
// weight before a unit is lost (PACK-OVER, FIELD BUGS 2026-10-04: every
// unit the service counts is made, as a withdrawal's is). The Stores stay: a
// character's storage, reached in a town (bible: the Stores page), and
// the market's, the writs' and the guild Stores' one door, as before.
//
// ═══ THE SERVICE COUNTS WHAT IT HANDED OVER (law 3, restated) ══════
//
// A pack is the save's, and a save is the client's word. So the
// service keeps, beside the Stores, a CARRIED count for each character
// and material (`prof_carried`, own / bought / gold like the Stores):
// every unit it handed to the bag or the pack and has not had back. A
// carried item reaches the Stores - and so a station, a writ, the
// market, the guild - only through a DEPOSIT, and a deposit moves at
// most what the count holds. The client says what it holds (`held`, the
// items of that material in its bag and pack); the count is first cut
// down to it (never raised), so an honest pack that sold, dropped or
// brewed some heals the count, and an edited save that holds more than
// the count adds nothing. Nothing reaches the economy past what the
// service itself handed out: law 3's guarantee, kept with the door open
// one way more.
// ═══════════════════════════════════════════════════════════════════
import { STORES_MAX, WITHDRAW_MAX } from './professionLaw.js';   // AUDIT2 BAG1 D16: the bounds this law shares, one home

/** The bag's template, in the professions' reserved range (Professions-Arc 4.8: 600 was unused). */
export const BAG_TEMPLATE = 600;
/** What it holds, in kg - "quite a lot", never unlimited: two fifths of a wagon's 750 (DFU ItemHelper.WagonKgLimit). A
 *  day's Logging (60 trees of 2-4 logs at 2 kg) is about 360 kg; the bag holds most of a day in one craft. */
export const BAG_KG_LIMIT = 300;
/** Its row's base price. DFU's shop price is 2 x (cost x (quality - 10) / 100 + cost) (shopStock.js calculateCost):
 *  500 gold at a middling shop, 456 to 550 by its quality (C#'s integer division), before the region and the haggle -
 *  "like 500g". */
export const BAG_BASE_PRICE = 250;
/** Its row, in the port's template columns (systems/profTemplates.js registers it): DFU's own Backpack picture
 *  (ItemTemplates 89: TEXTURE.205 record 44 - law 6, the picture is DFU's own), weightless as the Small Cart is
 *  (`hasNoEncumbrance`, template 93), one to a slot. Rarity 10: no shelf rolls it - a General Store shelves it by name
 *  (shopStock.js), online only. */
export const BAG_ROW = Object.freeze({
  index: BAG_TEMPLATE, name: 'Materials Bag', baseWeight: 1, hitPoints: 0, capacityOrTarget: 0, basePrice: BAG_BASE_PRICE,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 205, worldTextureRecord: 44,
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: false, hasNoEncumbrance: true,
});

/** Whether a record IS a Materials Bag - its template and its group, the one spelling every rule reads (the save's
 *  hands, the window, the shop, the trade, the realm's trade law: ONE DFU MEMBER, ONE EXPORT's rule, for the port's own). */
export const isBagItem = (item) => item?.templateIndex === BAG_TEMPLATE && item?.group === 'UselessItems2';
/** Whether a list (the pack) holds one - DFU's HasCart, for the bag: owning one is holding one. */
export const hasBag = (items) => Array.isArray(items) && items.some(isBagItem);
/** ONE-BAG (2026-10-04, Mac: "you shouldnt be able to hold multiple gathering bags"): whether any of `lists` - the pack, a
 *  trade's basket, the wagon - holds a Materials Bag other than `item` (the one being taken, which may sit in one of them). */
export const holdsOtherBag = (lists, item = null) => (lists ?? []).some((l) => Array.isArray(l) && l.some((x) => x !== item && isBagItem(x)));

/** The bag as a capacity the transfer ladder reads (systems/inventorySession.js storeCapacityOf's shape - the
 *  companion's pack's): its kg and its words ("Your Materials Bag cannot carry any more."). */
export const BAG_CAPACITY = Object.freeze({ kg: BAG_KG_LIMIT, name: 'Your Materials Bag' });

/** The most of one material the service counts as carried, every origin together - the Stores' own bound
 *  (professionLaw.js STORES_MAX), so a unit is never refused between the two. */
export const CARRIED_MAX = STORES_MAX;
/** AUDIT2 BAG1 S1: how long the service keeps a CARRIED harvest's row - the row a kept harvest asked again is answered by,
 *  and the only word that mints its items. An older client's harvest row (into the Stores) is kept two days, as it was. */
export const CARRIED_ROW_DAYS = 30;
/** One deposit, at most - a withdrawal's own bound (professionLaw.js WITHDRAW_MAX). */
export const DEPOSIT_MAX = WITHDRAW_MAX;
/** The origins a carried count keeps - the Stores' three (0041_gold_market.sql). */
export const CARRIED_ORIGINS = Object.freeze(['own', 'bought', 'gold']);
/** THE ORDER A COUNT IS CUT DOWN TO WHAT THE PACK HOLDS: gold's first, bought, then own - the order a withdrawal fills
 *  the pack in (professions.js withdrawStores), so the goods walled from every Marks act go first and a character's
 *  own, which raise a seat's influence (law 3), go last. A unit the pack no longer holds is gone; which one is unknown,
 *  and the count gives up the least precious. */
export const CLAMP_ORDER = Object.freeze(['gold', 'bought', 'own']);
/** THE ORDERS A DEPOSIT MOVES BY. `all` (the Stores page's Put in) every origin, as the count is cut; `spend` (a writ's or
 *  the market's shortfall, put in just before it spends) bought first then own - the order a craft spends the Stores in
 *  (professions.js spendStatements) - and never gold's, which no station may spend (GOLD-MARKET's wall). BAG-CRAFT
 *  (FIELD BUGS 2026-10-09c): `work`, a station's - `spend`'s order for the counted units, then the units the count does
 *  not hold (`looseOrder`). */
export const DEPOSIT_ORDERS = Object.freeze({ all: CLAMP_ORDER, spend: Object.freeze(['bought', 'own']), work: Object.freeze(['bought', 'own']) });
export const depositOrderOk = (o) => typeof o === 'string' && Object.hasOwn(DEPOSIT_ORDERS, o);
/** BAG-CRAFT (FIELD BUGS 2026-10-09d, Mac: "I just want players to also be able to craft from their inventory, not just
 *  the store"): whether a deposit by `o` may move units the carried count does not hold - a looted Red Rose, a log
 *  withdrawn before the bag, a stack traded from a friend - up to what the client says it holds past the count. A
 *  station's alone (a craft, a brew, a smelt, a temper): a writ, the market and the Stores page's Put in still move only
 *  what the service handed out. */
export const looseOrder = (o) => o === 'work';
/** BAG-CRAFT: the origin the Stores keep a unit the count did not hold under. AUDIT BAG-CRAFT A1: `loose` - its own, not
 *  bought: as bought it went to a writ, the guild Stores, a Drakes listing or fill, and a withdrawal counted it carried
 *  (every door law 3 walls), a `work` put-in being no station's act but a request any client may send. A station alone
 *  spends it (STATION_ORIGINS); everything else reads `own` and `bought` (WRIT_ORIGINS); a withdrawal gives it back to
 *  the pack uncounted. GOLD-MARKET's wall turned the other way (migration 0097_loose_origin.sql). */
export const LOOSE_ORIGIN = 'loose';
/** AUDIT BAG-CRAFT A1: what a writ, the guild Stores and the market's Drakes side spend of the Stores - never gold's
 *  (GOLD-MARKET), never loose (the stations' wall). */
export const WRIT_ORIGINS = Object.freeze(['own', 'bought']);
/** AUDIT BAG-CRAFT A1: what a station spends of the Stores, first to last - the loose units first (they are for nothing
 *  else), then bought, then own (the order a craft always spent in, so a character's own stay for writs, PROF0 7). */
export const STATION_ORIGINS = Object.freeze([LOOSE_ORIGIN, 'bought', 'own']);

/** A held count the client says: a whole number from 0 to CARRIED_MAX x 10 (a pack may hold looted pieces of the same
 *  template beside the carried ones - DFU's own Red Rose and a gathered one are one item) - or null. */
export const heldOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= CARRIED_MAX * 10;
/** AUDIT BAG1 B2: the count a client last heard, every origin together (a `seen`) - a whole number from 0 to three origins'
 *  bound - or anything else, which the service reads as unsaid. */
export const seenOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= CARRIED_MAX * CARRIED_ORIGINS.length;

/** What a count `c` (`{ own, bought, gold }`) is once cut to `held`, by CLAMP_ORDER - a copy; never raised. */
export function clampCarried(c, held) {
  const out = { own: Math.max(0, c?.own | 0), bought: Math.max(0, c?.bought | 0), gold: Math.max(0, c?.gold | 0) };
  let over = out.own + out.bought + out.gold - Math.max(0, held | 0);
  for (const o of CLAMP_ORDER) {
    if (over <= 0) break;
    const cut = Math.min(over, out[o]);
    out[o] -= cut;
    over -= cut;
  }
  return out;
}
/** A count's total, every origin. */
export const carriedTotal = (c) => (c?.own | 0) + (c?.bought | 0) + (c?.gold | 0);
/** What of a count a station, a craft or a writ may spend - never gold's (GOLD-MARKET). */
export const carriedSpendable = (c) => (c?.own | 0) + (c?.bought | 0);

/** THE UNITS OF A MATERIAL A CHARACTER MAY USE ON A STATION FROM WHAT IT CARRIES: the service's count, as far as the
 *  pack and the bag still hold them (`held` the items), never gold's. */
export const carriedUsable = (c, held) => carriedSpendable(clampCarried(c, held));
/** BAG-CRAFT: THE UNITS OF A MATERIAL A STATION MAY WORK FROM WHAT THE CHARACTER CARRIES - every unit the bag, the pack
 *  and the wagon hold (`held`), counted or not, but the gold-bought ones the count still names once cut to them
 *  (GOLD-MARKET's wall: a unit the pack no longer holds is gone, and gold's go first, CLAMP_ORDER). */
export const carriedWorkable = (c, held) => Math.max(0, Math.max(0, held | 0) - clampCarried(c, held).gold);

/** WHERE A HARVEST'S GOODS WENT, in the words its line ends on (scenes/gatherHost.js storesLine, fishHost.js haulLine) -
 *  the Stores (an older book's harvest), else the bag, the pack or both as the mint put them (net/profBook.js `put`),
 *  and what found no room said beside them. */
export function goodsWhere(d) {
  if (d?.carry !== true) return 'to your Stores';
  // PACK-OVER (FIELD BUGS 2026-10-04): what went into the pack past its weight (`over`) is the pack's, and said so
  const put = d.put ?? { bag: 0, pack: 0, left: 0 };
  const p = { ...put, pack: (put.pack | 0) + (put.over | 0) };
  const left = `left where ${p.left === 1 ? 'it was' : 'they were'} gathered`;
  // AUDIT2 BAG1 K11: none of it carried - said as such, never "to your bag" of goods that went nowhere
  if (!(p.bag > 0) && !(p.pack > 0) && p.left > 0) return `- all ${left}: no room in your bag or pack`;
  const to = p.bag > 0 && p.pack > 0 ? 'to your bag and pack' : p.pack > 0 ? 'to your pack' : 'to your bag';
  const said = (put.over | 0) > 0 ? `${to} - your pack is over its weight` : to;
  return p.left > 0 ? `${said} - ${p.left} ${left}: no room` : said;
}

/** AUDIT2 BAG1 K10: why a station's work stayed in the Stores (net/profBook.js carryOut's `why`) - a refusal's own words
 *  follow it (`text`). */
const STAYS_WHY = Object.freeze({
  room: 'no room in your bag or pack',
  busy: 'another withdrawal was still being counted',
  kept: 'take them out once it has',
});
/** AUDIT BAG1 B9: WHERE A STATION'S WORK WENT (net/profBook.js smelt's `put`: `{ bag, pack, stored, coming, why, text }`),
 *  as the sentence after the work's own - the bag, the pack, what is on its way (a withdrawal unanswered), and what
 *  stayed in the Stores and why. '' when nothing was carried out (an older book's work stays in the Stores, as it always
 *  did). AUDIT2 BAG1 K10: every rest was said as "no room" - a withdrawal busy, unanswered or refused too. */
export function madeWhere(p) {
  if (!p || typeof p !== 'object') return '';
  const bag = p.bag | 0, pack = p.pack | 0, stored = Math.max(0, p.stored | 0), coming = Math.max(0, p.coming | 0);
  const to = bag > 0 && pack > 0 ? 'Into your bag and pack' : pack > 0 ? 'Into your pack' : bag > 0 ? 'Into your bag' : '';
  const said = [];
  if (coming) said.push(`${coming} on ${coming === 1 ? 'its' : 'their'} way from your Stores: the counting-house has not answered yet`);
  if (stored) {
    const stay = `${stored} ${stored === 1 ? 'stays' : 'stay'} in your Stores`;
    said.push(p.why === 'refused' ? stay : `${stay}: ${STAYS_WHY[p.why] ?? STAYS_WHY.room}`);
  }
  if (!said.length) return to ? `${to}.` : '';
  const line = to ? `${to} - ${said.join('; ')}.` : `${said.join('; ')}.`;
  return p.why === 'refused' && stored && typeof p.text === 'string' && p.text ? `${line} ${p.text}` : line;
}

/** AUDIT2 BAG1 K8: a station's refusal after some of its inputs went into the Stores (net/profBook.js ensureInStores'
 *  `moved`) - said, so the player knows where they are: the next press spends them there. '' for none. */
export const movedFirstText = (r) => {
  const n = Number(r?.moved) || 0;
  return n > 0 ? ` ${n} of the materials went into your Stores first - the next try spends them there.` : '';
};

/** The bag's words, said where it is bought, where a harvest lands, and where it is refused. */
export const BAG_WORDS = Object.freeze({
  name: BAG_ROW.name,
  /** the first harvest of a session, said once (scenes/gatherHost.js) */
  // AUDIT BAG1: "or your pack while you have none" read as the pack only for a character with no bag - the pack takes
  // what the bag has no room for too
  where: 'Gathered goods go into your Materials Bag, then your pack. Every General Store sells the bag.',
  /** the bag's own refusals (systems/materialsBag.js bagStoreRefusal, inventorySession.js planBagToggle) - AUDIT BAG1:
   *  `full` was never said (the capacity ladder says a full bag) */
  onlyMaterials: 'Only crafting materials go in the Materials Bag.',
  /** ONE-BAG: a second bag taken, bought or picked up (systems/itemTransfer.js planTake, scenes/worldModes.js doBuy) */
  second: 'You already have a Materials Bag.',
  none: 'You have no Materials Bag. Every General Store sells one.',
  notEmpty: 'Empty your Materials Bag first.',
  /** AUDIT BAG1 H1: a reward tray is up - a piece taken from the bag beside it was taken as the reward */
  reward: 'Choose your reward first - your Materials Bag opens after.',
  /** a node's prompt when neither the bag nor the pack has room for one more unit */
  noRoom: 'No room in your bag or pack',
  /** PACK-OVER (FIELD BUGS 2026-10-04): a harvest's goods minted into the pack past its weight - said beside the haul card,
   *  which counts the goods and not the weight (scenes/gatherHost.js) */
  overWeight: 'Your pack is over its weight. Put materials in your Stores in any town, or carry them in a Materials Bag.',
  /** the Stores page, away from a town */
  town: 'Your Stores are kept in town. Go to any town to put materials in or take them out.',
});
