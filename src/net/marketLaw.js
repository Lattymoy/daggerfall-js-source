// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET: what a listing, a
// sale, a courier and a buy order are, and every bound both ends read.
// The record is bible/06-Systems/Professions-Arc.md 10.2-10.5 and 26.
//
// A LISTING is a Stores material (escrowed by the service - the units
// leave the Stores at once) or a crafted piece with a provenance id (the
// piece leaves the save), at a price in Marks, for 72 hours, standing on
// every board of the Bay (GLOBAL-MARKET). A buyer in the region it was
// listed in takes it at once; a buyer anywhere else pays the COURIER and
// waits for it - so a signature material is cheap at home and dear
// abroad, and hauling is a trade (10.2). A buy order stands on every
// board too; a fill from another region pays the courier out of its pay.
//
// THE ROAD. The courier is charged by the map pixels between the two
// regions' hub towns (HUB1). The service holds no ARENA2, so it learns a
// hub's pixel the way it learns a pixel's climate: from the clients that
// derived it (SEAT0 3.2's witnessed world, `world_witness` kind `hub`).
//
// Pure: no clock, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

import { STORES_MAX, MATERIAL_FAMILIES, MINED_KEYS, FOOD_KEYS, PLANT_GROUP_TEMPLATES } from './professionLaw.js';   // MARKET-ANY: and the Stores' forms
import { PROVENANCE_RE, recipeById, takesQuality, MASTERWORK, RECIPES } from './recipeLaw.js';   // BOARD-SIFT: a search's recipes
import { MARKS_MAX } from './marksLaw.js';
import { witnessedFact, factConfirmed, material } from './nodeLaw.js';
import { tradeableRecord, boundRecord, BOAT_TEMPLATES, GOLD_PIECES_TEMPLATE, VALUE_IS_IDENTITY_TEMPLATES } from './realm/realmTradeLaw.js';   // MARKET-ANY: the trade's own law of what may leave a record

/** A listing stands this long (10.2: 72 hours). */
export const MARKET_LISTING_S = 72 * 3600;
/** A buy order stands this long (10.3: 7 days). */
export const MARKET_ORDER_S = 7 * 86_400;
/** Live listings an account (materials and pieces together) and live buy orders an account (10.2, 10.3). */
export const MARKET_LISTINGS_MAX = 30;
export const MARKET_ORDERS_MAX = 20;
/** AUDIT 30 L8: a listing's or an order's whole worth (units x price), at most - what one balance can hold. */
export const MARKET_WORTH_MAX = MARKS_MAX;
/** A listing's or an order's units, at most: what one Stores can hold of a material (section 7). */
export const MARKET_UNITS_MAX = STORES_MAX;
/** A price - a material's a unit, a piece's whole (10.2: 1 to 1,000,000 Marks). */
export const MARKET_PRICE_MAX = 1_000_000;
/** Postings (a listing or an order) an account may make an hour (section 20: listings 60), and every other market
 *  act (a buy, a fill, a cancel, a collect) - the Marks' own hourly rate. */
export const MARKET_POSTS_MAX = 60;
export const MARKET_OPS_MAX = 120;
export const MARKET_WINDOW_S = 3600;
/** The sales tax, in hundredths of a sale, burnt from the seller's proceeds (10.4: 5%). */
export const MARKET_TAX_PCT = 5;
/** The Tithe, in hundredths (10.4: the holder's rate, 0-10% or 0-15%) - nought where no seat holds the board's
 *  bailiwick. SEAT1d: a sale's rate is its seat's holder's (server-account/src/seatHolding.js titheAt, passed to saleTithe),
 *  and its line goes to that holder's treasury (or is burnt) - this default the rest of the law's shape keeps. */
export const MARKET_TITHE_PCT = 0;
/** The courier (10.4): a load of this many units a trip, a road this many pixels a Mark, at least this many Marks. */
export const COURIER = Object.freeze({ load: 20, pixelsAMark: 25, least: 2, baseS: 900, pixelsAMinute: 10 });
/** Rows a view of the market shows, the History's materials, "Your trades", and the weekly report's medians. */
export const MARKET_SHOWN = 100;
export const MARKET_HISTORY_SHOWN = 30;
export const MARKET_TRADES_SHOWN = 20;
export const MARKET_REPORT_MEDIANS = 20;
/** The History's span (10.2: a 7-day median) and how long sales and prices are kept (section 20: 90 days). */
export const MARKET_MEDIAN_DAYS = 7;
export const MARKET_KEEP_DAYS = 90;
/** A piece's wear: its condition as a share of its most, in thousandths (PROF0 26). */
export const WEAR_WHOLE = 1000;
/** The Market tab's views, in its row's order (10.1; PROF5b: Auctions beside Crafted; MARKET-ANY: Goods after them - the
 *  pieces players list from their packs). */
export const MARKET_VIEWS = Object.freeze([
  Object.freeze(['materials', 'Materials']), Object.freeze(['crafted', 'Crafted']), Object.freeze(['auctions', 'Auctions']),
  Object.freeze(['goods', 'Goods']), Object.freeze(['mine', 'My listings']), Object.freeze(['orders', 'Orders']),
  Object.freeze(['history', 'History']),
]);
/** The crafted families that list - arrows carry no provenance and the siege works are never made (PROF0 25). */
export const CRAFTED_FAMILIES = Object.freeze([
  Object.freeze(['weapons', 'Weapons']), Object.freeze(['armour', 'Armour']), Object.freeze(['staves', 'Staves']),
  Object.freeze(['bows', 'Bows']), Object.freeze(['tools', 'Tools']), Object.freeze(['kits', 'Repair Kits']),
  Object.freeze(['furniture', 'Furniture']),
  // PROF7: the loom's - the leather armour, the clothing (its dye carried with the piece), the rugs, tapestries and skins
  Object.freeze(['leather', 'Leather Armor']), Object.freeze(['clothing', 'Clothing']), Object.freeze(['furnishings', 'Furnishings']),
  // PROF11: the mason's bench's - the Sculptor's column, bench, font and plinth (recipeLaw STONE_DECOR)
  Object.freeze(['stonework', 'Stonework']),
  // PROF9: the fire's - the four dishes (recipeLaw DISHES), a cook's hand carried with each
  Object.freeze(['dishes', 'Dishes']),
  // PROF10: the jeweller's bench's - DFU's eight pieces of jewellery (recipeLaw JEWEL_PIECES), a jeweller's hand with each
  Object.freeze(['jewellery', 'Jewellery']),
]);
/** The material families the Materials view filters by - the Stores' own (section 8). */
export const MARKET_FAMILIES = MATERIAL_FAMILIES;

// ─── BOARD-SIFT: PAGES, ORDERS, A SEARCH OF THE PIECES ───────────────
// (2026-10-21, feature-feedback: "The notice board market also doesnt show everything if there are too many
// weapons/armor/etc listed it stops after a certain number") - a view showed its first MARKET_SHOWN rows and nothing
// past them. The views of pieces and of buy orders turn pages of MARKET_SHOWN now, every filter read in the query
// itself so a page is a page (bible/06-Systems/Professions-Arc.md 10.13).

/** The views read a page at a time. Materials is not: its first look is the Bay's cheapest hundred of every material,
 *  and its search, family and tier reach any material - each to its own cheapest hundred, its market's front. */
export const MARKET_PAGED_VIEWS = Object.freeze(['crafted', 'goods', 'auctions', 'orders']);
/** The pages a view turns through, at most - MARKET_SHOWN x this many rows (AUDIT BOARD-SIFT: 50 pages were 5,000 rows,
 *  a market's busy week; 50,000 is past what the Bay holds - thirty listings an account). */
export const MARKET_PAGES_MAX = 500;
/** A page as the service reads it: its first (0) for anything but a whole number in range. */
export const marketPageOf = (n) => (Number.isSafeInteger(n) && n >= 0 && n < MARKET_PAGES_MAX ? n : 0);
/** The orders a view of pieces is read in - the first its own, as before (the cheapest; an auction the soonest to end). */
export const MARKET_SORTS = Object.freeze({
  crafted: Object.freeze(['cheap', 'dear', 'new', 'quality']),
  goods: Object.freeze(['cheap', 'dear', 'new']),
  auctions: Object.freeze(['ending', 'cheap', 'dear', 'new']),
});
/** A view's order as the service reads it - its first for anything it does not offer; null for a view with none. */
export const marketSortOf = (view, sort) => {
  const sorts = Object.hasOwn(MARKET_SORTS, view) ? /** @type {Record<string, ReadonlyArray<string>>} */ (MARKET_SORTS)[view] : null;
  return sorts ? (sorts.includes(sort) ? sort : sorts[0]) : null;
};
/** A search of the pieces, at most this long: trimmed, lower-cased; '' for none. */
export const MARKET_QUERY_MAX = 40;
export const marketQueryOf = (q) => (typeof q === 'string' ? q.trim().toLowerCase().slice(0, MARKET_QUERY_MAX) : '');
/** A search's words. */
export const searchWords = (q) => marketQueryOf(q).split(/\s+/).filter(Boolean);
const tight = (/** @type {string} */ s) => s.replace(/[\s\-'’]+/g, '');
/** AUDIT BOARD-SIFT: whether every word stands somewhere in `text` - or in it read without its spaces, hyphens and
 *  apostrophes ("shortbow" in "Short Bow", "daikatana" in "Dai-katana"). Pure; the Work tab's bar reads it too. */
export function wordsIn(/** @type {ReadonlyArray<string>} */ words, /** @type {string} */ text) {
  const hay = String(text ?? '').toLowerCase(), close = tight(hay);
  return words.every((w) => hay.includes(w) || close.includes(tight(w)));
}
/** The least quality a Crafted read asks (recipeLaw QUALITY_NAMES' index), 0 - any - for anything else. */
export const marketQualityOf = (n) => (Number.isSafeInteger(n) && n > 0 && n <= MASTERWORK ? n : 0);
/**
 * THE RECIPES A SEARCH OF THE PIECES NAMES - each word of it in the recipe's name or in the name its piece wears on the
 * board's rows (`shown`, the client's: AUDIT BOARD-SIFT - a row names its piece as its record mints it, and 52 recipes'
 * pieces wear another name than the recipe's: a Pine Staff is an "Iron Staff", a Warforged Dagger an "Ebony Dagger",
 * every Wakizashi DFU's "Wakazashi"), of `families` (null: every family). The client reads a search as these, as it reads
 * a materials search as the catalogue's materials (AUDIT 30 U2), and the service reads them. Pure.
 * @param {string} query @param {ReadonlyArray<string>|null} [families]
 * @param {((r: any) => string|null)|null} [shown]
 * @returns {string[]} recipe ids
 */
export function recipesNamed(query, families = null, shown = null) {
  const words = searchWords(query);
  return RECIPES.filter((r) => (!families || families.includes(r.family)) && wordsIn(words, shown ? `${r.name} ${shown(r) ?? ''}` : r.name)).map((r) => r.id);
}
/** AUDIT BOARD-SIFT: a search's recipes as the service reads them - known recipe ids, each once; null for no search (an
 *  empty list is a search that named none). */
export function marketRecipesOf(list) {
  if (!Array.isArray(list)) return null;
  return [...new Set(list.slice(0, 2 * RECIPES.length).filter((id) => typeof id === 'string' && !!recipeById(id)))];
}
/** A request id, as every account act's: 8-40 of [A-Za-z0-9_-]. A listing's or an order's id is the service's own
 *  (SOC1's id shape, minted by `mintId`). */
export const MARKET_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;
export const MARKET_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

/** A whole number of units, 1 up to `max`. */
export const unitsOk = (n, max = MARKET_UNITS_MAX) => Number.isSafeInteger(n) && n >= 1 && n <= max;
/** A price in Marks, 1 to 1,000,000. */
export const priceOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= MARKET_PRICE_MAX;
/** A piece's wear, 1 to 1,000 thousandths. */
export const wearOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= WEAR_WHOLE;
/** A piece's id, as its product record names it. */
export const provenanceOk = (p) => typeof p === 'string' && PROVENANCE_RE.test(p);

/** The listing fee (10.4): 1% of the listing's whole worth, rounded up, at least 1 Mark - burnt, kept on a cancel. */
export const listingFee = (worth) => Math.max(1, Math.ceil(worth / 100));
/** The sales tax on a sale (10.4: 5%), rounded DOWN - a one-Mark sale is not taxed to nothing (PROF0 26). */
export const saleTax = (total) => Math.floor((total * MARKET_TAX_PCT) / 100);
/** AUDIT 30 L6: the tax on a sale of `total` out of a listing (or a fill of an order) that has already sold `before`:
 *  5% of the running total, rounded down, less what the earlier sales paid - so a listing bought a unit at a time pays
 *  the tax it would have paid bought whole, and splitting a sale saves nothing. */
export const saleTaxOn = (before, total) => saleTax(before + total) - saleTax(before);
/** MARKET-AUDIT S2: the tax on a fill of `total` out of an order that has bought `before` - saleTaxOn's, except that the
 *  order's LAST units (`last`) pay their filler at least a Mark: a one-Mark order's twentieth unit, taxed whole, could never
 *  be filled (a fill pays at least a Mark - market_fills.pay). Any other fill the tax would leave paying nothing is refused. */
export const fillTaxOn = (before, total, last = false) => { const t = saleTaxOn(before, total); return last && total >= 1 && total - t < 1 ? total - 1 : t; };
/** The Tithe on a sale at `pct` hundredths, rounded down (nought until SEAT1). */
export const saleTithe = (total, pct = MARKET_TITHE_PCT) => Math.floor((Math.max(0, total) * Math.max(0, pct)) / 100);   // AUDIT-SEATS L10: townSeatLaw.js titheOf's rule, a negative none
/** AUDIT-SEATS L4: the Tithe on a sale of `total` out of a listing that has already sold `before` - as saleTaxOn: the
 *  rate's share of the running total, less what the earlier sales paid at it, so a listing bought a unit at a time pays
 *  the holder what it would have bought whole (ten 9-Drake units at 10% paid 0 apiece, 9 whole). */
export const saleTitheOn = (before, total, pct = MARKET_TITHE_PCT) => saleTithe(before + total, pct) - saleTithe(before, pct);
/** What the seller receives of a sale: the price less the tax and the Tithe (10.4). */
export const sellerGets = (total, tithePct = MARKET_TITHE_PCT) => total - saleTax(total) - saleTithe(total, tithePct);

// ─── GOLD-MARKET (2026-09-30, Mac: "Allow trading with gold or drakes on the marketplace"; "Gold listings, walled") ───
//
// A listing names its currency: Drakes (`marks`, the code's name for them) as ever, or GOLD - a realm character's own
// gold, paid off its record on the service and held for its seller until collected into a bank account. Buy orders,
// auctions and commissions stay in Drakes. THE WALL (law 8, "gold never becomes Marks", kept): goods bought with gold
// come into the Stores as their own origin, `gold`, and a piece bought with gold is marked (`bought_with`) - such goods
// go to the pack or back on the market for gold, and nowhere else: no Drakes listing, buy-order fill, station, craft,
// Court or guild writ, auction or commission takes them. And a Drakes listing's `bought` units - goods bought with
// Drakes - never list for gold, so the market is never the Bank's way round (its daily cap and its spread stand).

/** The two currencies a listing may name, the Drakes first. */
export const MARKET_CURRENCIES = Object.freeze(['marks', 'gold']);
export const currencyOk = (c) => MARKET_CURRENCIES.includes(c);
/** The Stores' three origins: gathered or made (`own`), bought with Drakes (`bought`), bought with gold (`gold`). */
export const STORE_ORIGINS = Object.freeze(['own', 'bought', 'gold']);
/** The origins a listing of `currency` may take units of - its own, and what was bought in its own currency. */
export const listableOrigins = (currency) => (currency === 'gold' ? Object.freeze(['own', 'gold']) : Object.freeze(['own', 'bought']));
/** The most gold a character's sales hold for it on the service, uncollected - ten times a Drakes balance's cap. */
export const MARKET_GOLD_HELD_MAX = 10 * MARKS_MAX;
/** A gold sale: its tax (5% of the listing's running total, as a Drakes sale's) and its listing fee, both burnt - a
 *  gold listing pays its fee out of each sale, 1% of it rounded up, where a Drakes listing pays it at listing (a gold
 *  seller holds no gold on the service to pay it from); `gets`, what is held for the seller. */
export function goldSaleOf(before, total) {
  const tax = saleTaxOn(before, total), fee = listingFee(total), tithe = saleTitheOn(before, total);
  return { tax, fee, tithe, gets: Math.max(0, total - tax - fee - tithe) };
}
/** An amount of gold in words, as the game's own windows say it. */
export const goldText = (n) => `${Number(n).toLocaleString('en-US')} gold`;

/** A map pixel as `world_witness` keeps a hub's: "x,y" - MAPS.BSA's 1000 x 500 (mapsFile.js). */
export const hubReport = (x, y) => `${x},${y}`;
export const hubPixelOk = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && x < 1000 && y >= 0 && y < 500;
export function parseHubReport(s) {
  const m = typeof s === 'string' ? /^(\d{1,3}),(\d{1,3})$/.exec(s) : null;
  if (!m) return null;
  const x = Number(m[1]), y = Number(m[2]);
  return hubPixelOk(x, y) ? { x, y } : null;
}
/**
 * A region's hub pixel as the witnesses say it is (PROF0 26): the confirmed answer, else the answer most give, else
 * the asking client's own - the unconfirmed answer is taken as given, because a short road buys nothing a lie about
 * the region does not (a buyer may say it stands in the listing's own region). Null with neither.
 * @param {Array<{ account: string, report: string, at: number }>} rows @param {{ x: number, y: number }|null} own
 */
export function hubPixel(rows, own = null) {
  const f = witnessedFact(rows, parseHubReport);
  if (f.state !== 'none' && Number.isSafeInteger(f.x)) return { x: /** @type {number} */ (f.x), y: /** @type {number} */ (f.y), confirmed: factConfirmed(f) };
  return own && hubPixelOk(own.x, own.y) ? { x: own.x, y: own.y, confirmed: false } : null;
}
/** The road between two hubs, in whole map pixels (the straight line, rounded). */
export const roadPixels = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y));
/** The courier's fee (10.4): ceil(ceil(units / 20) x (1 + pixels / 25)) Marks, at least 2 - by the load, so moving
 *  thousands of units across the Bay costs thousands, and regional prices hold. Integers throughout. */
export function courierFee(units, pixels) {
  const loads = Math.ceil(units / COURIER.load);
  return Math.max(COURIER.least, Math.ceil((loads * (COURIER.pixelsAMark + pixels)) / COURIER.pixelsAMark));
}
/** The courier's time (10.4): 15 minutes + 1 minute for every 10 pixels begun. */
export const courierSeconds = (pixels) => COURIER.baseS + 60 * Math.ceil(pixels / COURIER.pixelsAMinute);

/** A piece's wear from the pack's item: its condition over its most, in thousandths - at least 1, a whole piece
 *  1,000 (a piece with no condition to wear is whole). AUDIT 31 H9: whole only when it is - a piece worn by a point of
 *  a condition past 2,000 rounded up to whole and was sold, and handed to a commission, as new work. */
export function wearOf(item) {
  const max = Number(item?.maxCondition) || 0;
  if (max <= 0) return WEAR_WHOLE;
  const cur = Math.max(0, Number(item?.currentCondition) || 0);
  if (cur >= max) return WEAR_WHOLE;
  return Math.max(1, Math.min(WEAR_WHOLE - 1, Math.round((cur * WEAR_WHOLE) / max)));
}
/** A piece minted from its record takes its wear: the condition that share of its most, at least 1. */
export function wearCondition(maxCondition, wear) {
  if (!(maxCondition > 0)) return maxCondition;
  return Math.max(1, Math.min(maxCondition, Math.round((maxCondition * wear) / WEAR_WHOLE)));
}
/** A wear as a person reads it: "worn to 62%". Null for a whole piece. */
export const wearText = (wear) => (wear >= WEAR_WHOLE ? null : `worn to ${Math.max(1, Math.min(99, Math.round(wear / 10)))}%`);   // AUDIT 30 L5: a worn piece never reads 100%

/**
 * THE MEDIAN (10.2): the unit price the middle unit sold at - `rows` the day table's `{ price, units }` - weighted by
 * units; an even count's the mean of its two middle units' prices. Null with no sale.
 * @param {Array<{ price: number, units: number }>} rows
 */
export function medianOf(rows) {
  const sorted = (rows ?? []).filter((r) => r && r.units > 0 && r.price > 0).sort((a, b) => a.price - b.price);
  const n = sorted.reduce((s, r) => s + r.units, 0);
  if (!n) return null;
  const at = (k) => { let seen = 0; for (const r of sorted) { seen += r.units; if (seen >= k) return r.price; } return sorted[sorted.length - 1].price; };
  return n % 2 ? at((n + 1) / 2) : (at(n / 2) + at(n / 2 + 1)) / 2;
}
/**
 * A material's line (10.2): its daily medians over the `days` UTC days ending `today`, oldest first - null for a day
 * with no sale. `rows` the price table's `{ day, price, units }`.
 * @param {Array<{ day: number, price: number, units: number }>} rows @param {number} today
 */
export function medianLine(rows, today, days = MARKET_MEDIAN_DAYS) {
  const out = [];
  for (let d = today - days + 1; d <= today; d++) out.push(medianOf((rows ?? []).filter((r) => r.day === d)));
  return out;
}
/** A median as a person reads it: "8", "8.5", or a dash with no sale. */
export const medianText = (m) => (m == null ? '-' : Number.isInteger(m) ? String(m) : m.toFixed(1));

/** AUDIT 30 L7: the materials nothing yields yet - an order for one could only hold its Marks for a week. The Daedric
 *  Ingot waits on its heart and its stone (4.1, the Oblivion Gate's gift). PROF7: Hunting yields the Bear Hide now;
 *  AUDIT-SEATS: a siege's Spoils (SEAT2a, townSeatLaw.js SIEGE_SPOILS) yield the Warforged Steel Ingot and
 *  Standard-bearer's Silk now. */
export const UNYIELDED = Object.freeze(['ingot:daedric']);
/** AUDIT 30 L2: a crafted piece lists only of a family the market lists (CRAFTED_FAMILIES) - never arrows (a quiver's
 *  stack, re-minted whole) nor a siege work. */
export const pieceListable = (recipeId) => CRAFTED_FAMILIES.some(([f]) => f === recipeById(recipeId)?.family);

/** EVERY MATERIAL THE MARKET KNOWS (a buy order's choices): the registry's, the four foods and every herb the law
 *  gives a tier - each `material()`'s standing, in the families' order - less what nothing yields yet. */
export function marketCatalogue() {
  const herbs = Object.entries(PLANT_GROUP_TEMPLATES).flatMap(([g, ts]) => ts.map((t) => `${g}:${t}`));
  const all = [...MINED_KEYS, ...FOOD_KEYS, ...herbs].filter((k) => !UNYIELDED.includes(k)).map((k) => material(k)).filter(Boolean);
  const order = MATERIAL_FAMILIES.map(([f]) => f);
  return all.sort((a, b) => (order.indexOf(a.family) - order.indexOf(b.family)) || (a.tier - b.tier));
}

/** The switch: the market is open where the board, the professions and the Marks all are (PROF0 26 - section 20
 *  names three switches, and the market needs each). */
export const marketOpen = (board, prof, marks) => board === true && prof === true && marks === true;

// ─── PROF5b: TIMED AUCTIONS FOR MASTERWORKS (10.2, bible/06-Systems/Professions-Arc.md 27) ─────

/** An auction stands this long (10.2: 24 hours). */
export const AUCTION_S = 24 * 3600;
/** The least raise over the standing bid, in hundredths (10.2: 5%) - rounded up, at least a Mark. */
export const AUCTION_RAISE_PCT = 5;
/** 10.2: "a bid in the last 2 minutes adds 2" - a bid this near the end moves it this far on. */
export const AUCTION_LATE_S = 120;
export const AUCTION_ADD_S = 120;
/** A bid, at most: what one balance can hold. */
export const AUCTION_BID_MAX = MARKS_MAX;
/** A bid's amount in whole Marks, 1 up to AUCTION_BID_MAX. */
export const bidOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= AUCTION_BID_MAX;
/** The least next bid: the opening while none stands, else the standing bid and its 5%, rounded up, at least 1. */
export const auctionNext = (high, opening) => (high == null ? opening : high + Math.max(1, Math.ceil((high * AUCTION_RAISE_PCT) / 100)));
/** An auction's end after a bid at `atS`: moved AUCTION_ADD_S on when the bid came in its last AUCTION_LATE_S. */
export const auctionEnd = (endsAt, atS) => (endsAt - atS < AUCTION_LATE_S ? endsAt + AUCTION_ADD_S : endsAt);
/** AUDIT 31 S3: how long past its end a won auction waits for its seller's Marks cap to take the sale. Past it, the
 *  winning bid is void (its escrow back on its bidder's read) and the piece back to its seller, unsold - the winner's
 *  Marks are never held without end for a seller who does not spend. */
export const AUCTION_GRACE_S = 7 * 86_400;
/** What may be auctioned (10.2: "Masterworks only"): a Masterwork of a family the market lists - a piece that takes a
 *  quality (AUDIT 31 L9: a Repair Kit takes none, so no kit is a Masterwork). */
export const auctionable = (recipeId, quality) => quality === MASTERWORK && pieceListable(recipeId) && takesQuality(/** @type {any} */ (recipeById(recipeId)));

// ─── MARKET-ANY (FIELD BUGS 2026-10-01, the field: "The market doesn't allow you to list any item that isnt bound") ───
//
// A PIECE FROM THE PACK, FOR GOLD. The market listed a Stores material and a crafted piece with its maker's record, and
// nothing else (10.2: "Loot does not list: it has no provenance. TRADE1 stays how loot changes hands") - so to a player
// nothing they carried from the world could be sold there, and the List form offered only what a crafter had made.
// A realm character's pack is its record on the service now (REALM P1), and a realm trade already moves a piece out of
// one record and into another in one write (REALM P2.1, net/realm/realmTradeLaw.js). A piece from the pack lists the same way:
// the very record the seller's checkpoint holds, taken out of it in the listing's own batch (server-account/src/
// market.js), and put into the buyer's record - or back into the seller's, cancelled, expired or removed - by the
// collect's own batch. Nothing is copied: the piece is in one record, or on the listing, or on the road.
// FOR GOLD ALONE (law 8 and the wall of 10.8, kept): after its first save a record is its tab's own checkpoint - nothing
// the service witnessed made the piece - so a piece from the pack is the realm's gold economy, as its gold is, and never
// becomes Drakes (law 3: nothing edited into a save is laundered into the server's economy). Gold for a piece is what two
// realm characters' trade does face to face; the market only lets them not meet.

/** A piece's record on a listing, at most this many JSON characters - the market's routes carry it in their 4 KiB body
 *  (server-account/src/service.js MAX_BODY_BYTES) with the rest of the act. A piece the port mints is a few hundred. */
export const GOOD_RECORD_MAX = 2048;
/** The crafted pieces a tab names in its "My listings" read, at most - the service answers how each may list
 *  (server-account/src/market.js heldPieces). */
export const MARKET_HELD_MAX = 64;
/** DFU's arrow (systems/inventory.js ARROW_TEMPLATE, pinned equal) - a quiver's stack, never a board's. */
export const GOOD_ARROW_TEMPLATE = 131;
/** The Goods view's families, by DFU's item groups (goodFamily). */
export const GOODS_FAMILIES = Object.freeze([
  Object.freeze(['weapons', 'Weapons']), Object.freeze(['armour', 'Armour']), Object.freeze(['clothing', 'Clothing']),
  Object.freeze(['jewellery', 'Jewelry and gems']), Object.freeze(['other', 'Everything else']),
]);
/** One group-to-family table for both the client classifier and the service's pre-limit SQL filter. */
export const GOOD_GROUP_FAMILIES = Object.freeze([
  Object.freeze(['Weapons', 'weapons']), Object.freeze(['Armor', 'armour']),
  Object.freeze(['MensClothing', 'clothing']), Object.freeze(['WomensClothing', 'clothing']),
  Object.freeze(['Jewellery', 'jewellery']), Object.freeze(['Gems', 'jewellery']),
]);
/** A piece's family in the Goods view, by its DFU group. */
export function goodFamily(rec) {
  return GOOD_GROUP_FAMILIES.find(([group]) => group === rec?.group)?.[1] ?? 'other';
}
let _storesForms = /** @type {Set<string>|null} */ (null);
/** THE STORES' OWN MATERIALS AS THE PACK HOLDS THEM - every mined, smelted, cut, felled, skinned and gathered material
 *  with a template (systems/professions/profItems.js mintMaterialItem mints these; the custom 600-699 rows by their index alone,
 *  DFU's own by their group and index), as `group:index` or `*:index`. The four foods are left out: their templates are
 *  Climates & Calories' or Foraging's as the client is set, and a Drake's worth of them is none. */
export function storesForm(rec) {
  if (!_storesForms) {
    const keys = [...MINED_KEYS, ...Object.entries(PLANT_GROUP_TEMPLATES).flatMap(([g, ts]) => ts.map((t) => `${g}:${t}`))];
    _storesForms = new Set(keys.map((k) => material(k)).filter((m) => m && Number.isSafeInteger(m.templateIndex))
      .map((m) => (m.group ? `${m.group}:${m.templateIndex}` : `*:${m.templateIndex}`)));
  }
  return _storesForms.has(`${rec?.group}:${rec?.templateIndex}`) || _storesForms.has(`*:${rec?.templateIndex}`);
}
/**
 * WHY A PIECE OF THE PACK MAY NOT LIST - its record as the save holds it (plain data; both ends read it) - as a word, or
 * null. The trade's refusals first (realmTradeLaw tradeableRecord: worn, a quest's, summoned, bound, gold, a boat's),
 * then the market's own: LOCK1's lock (the player's own word closes selling - systems/item/itemLock.js), a letter of credit
 * (it IS gold, and its value is its identity), arrows (a quiver's stack), a Stores material (storesForm - THE WALL of
 * 10.8, kept: a material bought with Drakes and withdrawn to the pack would otherwise list for gold, "a way round the
 * Bank's daily cap and spread"; the Stores list it, in its own currency) and a record past GOOD_RECORD_MAX. A crafted
 * piece is not refused here: whether it lists as a crafted piece or from the pack is its record's owner's question,
 * which only the service can answer (market.js).
 * @param {any} rec
 */
export function goodRefusal(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec) || !Number.isSafeInteger(rec.templateIndex)) return 'shape';
  if (rec.equipSlot != null) return 'worn';
  if (rec.locked === true) return 'locked';
  if (rec.questItem) return 'quest';
  if ((rec.timeForItemToDisappear ?? 0) !== 0) return 'summoned';
  if (boundRecord(rec)) return 'bound';
  if (rec.templateIndex === GOLD_PIECES_TEMPLATE && rec.group === 'Currency') return 'gold';
  if (VALUE_IS_IDENTITY_TEMPLATES.includes(rec.templateIndex)) return 'letter';
  if (BOAT_TEMPLATES.includes(rec.templateIndex)) return 'boat';
  if (rec.templateIndex === GOOD_ARROW_TEMPLATE) return 'arrows';
  if (storesForm(rec)) return 'stores';
  if (!tradeableRecord(rec)) return 'shape';   // the trade's law, whole - nothing it refuses lists
  let text = null;
  try { text = JSON.stringify(rec); } catch { return 'shape'; }
  return text.length > GOOD_RECORD_MAX ? 'large' : null;
}
/** Each refusal in the List form's words (the piece's name before it). */
export const GOOD_REFUSAL_WORDS = Object.freeze({
  shape: 'not an item the market knows',
  worn: 'worn - take it off first',
  locked: 'locked - unlock it first',
  quest: 'a quest\'s',
  summoned: 'summoned',
  bound: 'bound to you',
  gold: 'gold sells as gold',
  letter: 'a letter of credit is gold',
  boat: 'a boat\'s',
  arrows: 'arrows go in a quiver',
  stores: 'a Stores material, sold only from your Stores',
  large: 'too much to write on a board',
});
