// @ts-check
// PROF5 (2026-09-29, Mac: "Continue"): THE MARKET TAB of the Notice Board (bible/06-Systems/Professions-Arc.md 10.1,
// 10.2, 21's wireframe, 26) - drawn inside the board's window (ui/noticeWindow.js), beside Notices and Work.
//
// FIVE VIEWS, in the wireframe's row: MATERIALS (the Bay's listings of a material - search, family, tier - cheapest
// first, each "here" or its region with its courier and time, its 7-day median and line; the picked row's "Buy N for P
// Marks + C courier?"; the Weavers' counter's Linen and Wool), CRAFTED (the pieces listed - each its name as its record
// mints it, its quality, maker and wear), MY LISTINGS (this account's, Cancel; List a Stores material or a crafted
// piece), ORDERS (the Bay's buy orders - GLOBAL-MARKET: every board's, each "here" or its region, a fill from afar paying the
// courier out of its pay - Fill N from the Stores; this account's, Withdraw; Post an order) and HISTORY
// (the week's traded materials and their lines; "Your trades"). Above them, while anything travels, ON THE ROAD; below,
// Your Marks.
//
// Every act goes through the window's one-at-a-time door (`ui.run`), and every piece that enters or leaves the save
// goes through the market book's kept acts (net/marketBook.js).
//
// AUDIT 30: a search names the catalogue's materials and the service reads those (U2 - it filtered the hundred
// cheapest of everything, and a listed rarity read "Nothing listed"); an answer to a view since left is dropped (U3);
// the opening settle is an act through the door (U4); a number typed moves only the words that hang on it - never a
// full redraw that swallowed the next press - and the field keeps the focus through a read's redraw (U8, A12); a
// press the market says has moved reads again (U9); a piece that arrives while the tab stands is collected (U10);
// what must fail is not offered (U13); the rows run cheapest landed first (U16); one Mark is one Mark (U17); a row's
// courier is the pick's (U18); the shared clock (U21); every field named (U22).
//
// PROF5b (Professions-Arc 27): AUCTIONS beside Crafted - every open auction of a Masterwork, ending soonest first, the
// standing bid or the opening, the time left, the picked row's Bid at the next bid (or "Your bid leads", or the seller's
// Cancel while no bid stands); "An auction (Masterworks)" in the List form; the account's auctions and bids under My
// listings; what the bids hold beside "Your Marks".
//
// GOLD-MARKET (Professions-Arc 10.8): for a realm character, EACH VIEW IN ONE CURRENCY - Drakes or Gold, a switch beside
// the filters (Materials, Crafted, History): a gold row's price, courier (a Drake's worth of gold a Drake) and median in
// gold, its Buy the purse's (the exact cost out of it as the service is asked); the List form's "Priced in" for a Stores
// material or a piece - gold's units its own and those gold bought, never Drakes'; under My listings, the gold the sales
// hold and its Collect into the bank here. Any other character sees the Drakes' market alone, as before.
//
// BOARD-UI (2026-10-06, Mac: "Enhance organization of the market"; "Enhance the speed at which the notice board and
// market loads"; "Reduce overusage of bloated text"): the views in two parts - BUY (Materials, Crafted, Auctions, Goods)
// and SELL (the buy orders to fill, and My listings) - then History; Your silver at the top, not under the last row; a
// row of column names over the listings; the suppliers' counters folded away under one line (the sixteen measures of
// the Apothecaries' counter stood under every Materials read); My listings in named parts (the List form, your
// listings, auctions, bids, buy orders); each form's fields under their names, its terms one short line. The board
// reads the Materials view the moment it opens (`prefetch`), and the opening settle no longer holds the read back.
//
// MARKET-ANY (FIELD BUGS 2026-10-01, "The market doesn't allow you to list any item that isnt bound"): GOODS after
// the Auctions - the pieces players list from their packs, for gold, each its name and condition, its courier and Buy; the
// List form's "A piece from your pack" - a realm character's, for gold alone - offering every piece of the pack that may
// go and saying of the rest why not (worn, locked, bound, a quest's, arrows...); and the crafted pieces offered as the
// service says each may list (`ways` - a piece whose maker's record names another lists from the pack). A piece from a
// pack that arrives - bought, or come back - is collected into the record as a crafted one is minted.
import { accountRefusalText } from '../net/accountClient.js';
import { MARKET_MOVED, MARKET_KEPT_TEXT } from '../net/marketBook.js';   // AUDIT 31 B8
import {
  MARKET_VIEWS, MARKET_FAMILIES, CRAFTED_FAMILIES, MARKET_PRICE_MAX, MARKET_UNITS_MAX, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX, MARKET_WORTH_MAX,
  listingFee, saleTax, fillTaxOn, sellerGets, courierFee, wearOf, wearText, medianText, marketCatalogue, AUCTION_S, AUCTION_RAISE_PCT, AUCTION_LATE_S, AUCTION_ADD_S, AUCTION_BID_MAX,
  goldText, goldSaleOf, GOODS_FAMILIES, MARKET_HELD_MAX,
} from '../net/marketLaw.js';
import { QUALITY_NAMES, MASTERWORK } from '../net/recipeLaw.js';
import { marksText, MARK_WORTH_GOLD } from '../net/marksLaw.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e?.stopPropagation?.(); return onPress(); };
  return b;
};
/** A number field, named (AUDIT 30 U22) and keyed for the focus a redraw keeps (U8). */
const numberInput = (value, min, max, label, focus) => {
  const i = /** @type {HTMLInputElement} */ (el('input', 'notice-input market-num'));
  i.type = 'number'; i.min = String(min); i.max = String(max); i.value = String(value);
  i.setAttribute('aria-label', label);
  i.setAttribute('data-focus', focus);
  return i;
};
const select = (options, value, onChange, label = null) => {
  const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select market-select'));
  if (label) s.setAttribute('aria-label', label);
  for (const [v, label] of options) { const o = /** @type {HTMLOptionElement} */ (el('option', null, label)); o.value = v; if (v === value) o.selected = true; s.append(o); }
  s.onchange = () => onChange(s.value);
  return s;
};
const intOf = (s, lo, hi) => { const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
/** The units a picked row offers first, and its courier quotes for (AUDIT 30 U18). */
const PICK_UNITS = 20;
/** MARKET-ANY: the pack pieces the List form names, at most, of those that may not go. */
const GOODS_SAID = 8;
/** AUDIT 30 U9: the words that say the view a press was made from has moved - it is read again. */
/** The words that say the view a press was made from has moved - read again (AUDIT 31 B8: the book's own list, so the
 *  tab and the book never disagree - a bid that leads, a bid standing, a bid overtaken as it was decided). */
const MOVED = MARKET_MOVED;
/** AUDIT PROF-541 R2-C7: why a spoiled dish of your own make does not list. */
export const SPOILED_DISH_WHY = 'spoiled - only a fresh dish of your own make goes to the market';
/** MARKET-AUDIT: the material families the filters offer - those the market knows a material of (the Spoils of War, a
 *  family the Stores keep, has none: its two materials are a metal and a cloth, and its filter read nothing ever). */
const LISTED_FAMILIES = Object.freeze(MARKET_FAMILIES.filter(([f]) => marketCatalogue().some((c) => c.family === f)));
/** AUDIT 30 U11: the words that say the market is not this account's. */
const SHUT = ['market-closed', 'prof-need-account'];
/** BOARD-UI: THE VIEWS IN THEIR PARTS - what is for sale ("Buy"), where to sell (the buy orders to fill, and your own
 *  listings - "Sell"), and the record. Every view of MARKET_VIEWS once (a pin holds it). */
/** @type {ReadonlyArray<readonly [string, ReadonlyArray<string>]>} */
export const MARKET_VIEW_GROUPS = Object.freeze([
  /** @type {const} */ (['Buy', Object.freeze(['materials', 'crafted', 'auctions', 'goods'])]),
  /** @type {const} */ (['Sell', Object.freeze(['orders', 'mine'])]),
  /** @type {const} */ (['', Object.freeze(['history'])]),
].map((g) => Object.freeze(g)));
/** BOARD-UI: the market's fixed words, in one place. */
export const MARKET_WORDS = Object.freeze({
  reading: 'Reading the market...',
  slow: 'The market did not load.',
  settled: 'Your waiting trades are settled.',
  suppliers: 'Suppliers - fixed prices, straight into your Stores',
  noMaterials: 'Nothing like that is for sale.',
  noCrafted: 'No crafted pieces like that are for sale.',
  noGoods: 'Nobody is selling gear from their pack.',
  noGoodsKind: 'Nothing like that is for sale.',
  noOrders: 'No buy orders right now.',
  noHistory: 'Nothing has sold this week.',
  noListings: 'You have nothing on the market.',
  yourListings: 'Your listings',
  noStores: 'You have no materials to sell.',
});
const plural = (n, one) => `${n.toLocaleString('en-US')} ${one}${n === 1 ? '' : 's'}`;
/** GOLD-MARKET: an amount in its currency's words - "12 Drakes", "120 gold". */
export const priceText = (n, currency) => (currency === 'gold' ? goldText(n) : marksText(n));
/** GOLD-MARKET: the views whose rows are in one currency - the switch stands beside them. */
const CURRENCY_VIEWS = Object.freeze(['materials', 'crafted', 'history']);
/** GOLD-MARKET: the Stores units a listing in `currency` may take - its own, and what was bought in its own currency. */
export const listableUnits = (s, currency) => (s ? s.own + (currency === 'gold' ? (s.gold | 0) : s.bought) : 0);
/** "32 minutes", "2 hours", "arrived". */
export function arrivalText(atS, nowS) {
  const s = (Number(atS) || 0) - nowS;
  if (s <= 0) return 'arrived';
  const m = Math.ceil(s / 60);
  return m < 90 ? plural(m, 'minute') : plural(Math.round(m / 60), 'hour');
}
/** "2 days ago", "3 hours ago", "just now". */
const agoText = (atS, nowS) => {
  const s = Math.max(0, nowS - (Number(atS) || 0));
  if (s >= 86400) return `${plural(Math.floor(s / 86400), 'day')} ago`;
  if (s >= 3600) return `${plural(Math.floor(s / 3600), 'hour')} ago`;
  return 'just now';
};

/**
 * A material's line (10.2): its seven days' medians, a small polyline over the days that sold, scaled to its own low and
 * high. Nothing with fewer than two days sold.
 * @param {Array<number|null>} line
 */
export function medianLineNode(line) {
  const pts = (line ?? []).map((v, i) => [i, v]).filter(([, v]) => v != null);
  const doc = globalThis.document;
  if (pts.length < 2 || !doc.createElementNS) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const vals = pts.map(([, v]) => Number(v));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 16');
  svg.setAttribute('class', 'market-line');
  svg.setAttribute('aria-hidden', 'true');
  const poly = doc.createElementNS(NS, 'polyline');
  poly.setAttribute('points', pts.map(([i, v]) => `${((Number(i) / 6) * 58 + 1).toFixed(1)},${(hi === lo ? 8 : 15 - ((Number(v) - lo) / (hi - lo)) * 14).toFixed(1)}`).join(' '));
  svg.append(poly);
  return svg;
}

/**
 * THE TAB.
 * @param {{
 *   book: any, stores: () => Map<string, { material: string, own: number, bought: number }>,
 *   region: number, regionName: string, regionNameOf: (r: number) => string, hubs: Record<string, number[]>,
 *   name: (key: string) => string, countName: (key: string, n: number) => string,
 *   pieces: () => Array<{ item: any, where: string, name: string }>, take: (item: any, where: string) => boolean,
 *   putBack: (item: any, where: string) => void, mint: (piece: any, why: string) => void, pieceName: (piece: any) => string,
 *   drop?: (item: any, where: string) => void,
 *   weavers: ReadonlyArray<{ key: string, marks: number }>, stock: (key: string, n: number) => Promise<{ ok: boolean, text?: string }>,
 *   apothecaries?: ReadonlyArray<{ key: string, marks: number }>,
 *   goods?: () => Array<{ item: any, name: string, why: string|null }>, good?: (item: any) => { offered: any, pick: number, take: () => ((() => void) | null) },
 *   goodName?: (rec: any) => string,
 *   board?: number[]|null, tithe?: () => number|null,
 *   carried?: () => Map<string, number>, putIn?: (key: string, n: number) => Promise<{ ok: boolean, error?: string }>,
 * }} m the host's market (scenes/world.js); `drop` - a piece a settled listing took, out of the save (AUDIT 30 C3); MARKET-ANY:
 *   `goods` - the pack's pieces, each with why it may not list (null: it may), `good(item)` - the piece's wire record, its
 *   index in the save and its taking, `goodName` - a pack piece's record named as the pack names it; PROF12: `apothecaries` the
 *   Apothecaries' counter's sixteen (PROF0 4.5)
 *   SEAT1d: `board` the board's town pixel - a listing's, an auction's and a buy's courier's Tithe is its seat's;
 *   AUDIT SEATS-3 D3: `tithe()` that seat's Tithe in whole percents (0: unheld), or null while the seats' list is unread;
 *   MARKET-BAG (bible/06-Systems/Materials-Bag.md 6): `carried()` what the bag and the pack hold of each material that may go into
 *   the Stores (profBook carriedUsable), `putIn(key, n)` the Stores' shortfall of `n` put in from them (profBook ensureInStores)
 * @param {{ busy: () => boolean, run: (start: () => Promise<any>) => Promise<void>, rerender: () => void, nowS: () => number,
 *   alive: () => boolean, hush?: () => void }} ui the window's (`hush` - MARKET-AUDIT U6: the last act's word let go)
 */
export function createMarketTab(m, ui) {
  /** SEAT1d (Seats-Arc 7.2): the board's town pixel on every post and buy - the seat whose bailiwick it is takes the Tithe. */
  const at = () => (m.board ? { board: m.board } : {});
  const st = {
    view: 'materials', family: /** @type {string|null} */ (null), tier: 0, query: '', picked: /** @type {string|null} */ (null),
    qty: 1, data: /** @type {any} */ (null), error: /** @type {string|null} */ (null), stale: false, loading: false,
    list: { kind: 'material', material: '', units: 1, price: 1, piece: '', currency: 'marks', good: /** @type {any} */ (null) }, post: { material: '', units: 1, price: 1 },
    currency: 'marks',   // GOLD-MARKET: the currency the Materials, Crafted and History views show
    fills: /** @type {Record<string, number>} */ ({}), weave: /** @type {Record<string, number>} */ ({}),
    bid: /** @type {Record<string, number>} */ ({}),   // PROF5b: the bids typed, by auction
    suppliersOpen: false,   // BOARD-UI: the suppliers' counters opened
  };
  const balance = () => m.book.state.balance;
  const short = (marks) => balance() != null && balance() < marks;
  /** GOLD-MARKET: whether this character trades in gold (a realm character's), and what its save can pay here. */
  const goldOk = () => m.book.goldOk === true;
  const purse = () => m.book.purse?.(m.region) ?? null;
  const shortOf = (amount, currency) => (currency === 'gold' ? (purse() ?? 0) < amount : short(amount));
  const viewCurrency = () => (goldOk() && CURRENCY_VIEWS.includes(st.view) ? st.currency : 'marks');
  /** AUDIT 30 U2: a search's words as the catalogue's materials (their family and tier too) - the service reads those. */
  const searched = () => {
    const needle = st.query.trim().toLowerCase();
    if (!needle) return null;
    return marketCatalogue().filter((c) => (!st.family || c.family === st.family) && (!st.tier || c.tier === st.tier)
      && m.name(c.key).toLowerCase().includes(needle)).map((c) => c.key);
  };
  /** MARKET-ANY: a pack piece's name, and its stack ("x12"). */
  const goodName = (rec) => `${m.goodName?.(rec) ?? 'a piece'}${(rec?.stackCount ?? 1) > 1 ? ` x${rec.stackCount}` : ''}`;
  /** MARKET-ANY: the crafted pieces the save holds, for the service to say how each may list ("My listings" reads them). */
  const heldIds = () => [...new Set([...m.pieces().map((p) => p.item?.provenance), ...(m.goods?.() ?? []).map((g) => g.item?.provenance)]
    .filter((pv) => typeof pv === 'string'))].sort().slice(0, MARKET_HELD_MAX);
  const q = () => {
    const found = st.view === 'materials' ? searched() : null;
    return { region: m.region, hubs: m.hubs, ...(['materials', 'orders', 'crafted', 'auctions', 'goods'].includes(st.view) ? { family: st.family } : {}),
      ...at(),   // AUDIT SEATS-3 D2: the board read from - the listings its Market Hall allows answered with the counts
      ...(st.view === 'mine' ? { pieces: heldIds() } : {}),   // MARKET-ANY
      ...(st.view === 'materials' && st.tier ? { tier: st.tier } : {}), ...(found ? { materials: found } : {}),
      ...(viewCurrency() === 'gold' ? { currency: 'gold' } : {}) };   // GOLD-MARKET: a gold view asks gold's rows
  };
  /** AUDIT 30 U3: the last read asked - an answer to an earlier one (a view or a filter since left) is dropped. */
  let seq = 0;
  async function load(force = false) {
    const mine = ++seq;
    st.loading = true; ui.rerender();
    const r = await m.book.read(st.view, q(), { force });
    if (!ui.alive() || mine !== seq) return;
    st.loading = false;
    st.data = r.data; st.error = r.ok ? null : r.error; st.stale = !!r.stale;
    redraw();
    collectArrived();
  }
  /** MARKET-AUDIT: an answer's redraw waits while one of the tab's lists is held open - the window rebuilds every node, and a
   *  Family, Tier or Material list closed under the pointer mid-choice; it draws once the list is let go. */
  function redraw() {
    const a = /** @type {any} */ (globalThis.document?.activeElement);
    if (a?.tagName === 'SELECT' && a.classList?.contains?.('market-select')) {
      a.addEventListener?.('blur', () => { if (ui.alive()) ui.rerender(); }, { once: true });
      return;
    }
    ui.rerender();
  }
  /** AUDIT 30 U4: the kept acts settled and the arrived pieces collected - an act through the window's door, so no
   *  other press is made while it runs (the market book refuses one, `market-busy`, besides). */
  const settle = () => ui.run(async () => {
    const r = await m.book.settle(m.mint, m.putBack, m.drop ?? null);
    for (const x of arrived()) if (r?.ok) tried.add(x.id);
    if (r?.settled) load(true);
    // MARKET-AUDIT P5: a collect refused is said, and an act still kept - each was said nowhere, and asked after no more
    const refused = (r?.refused ?? []).find(Boolean);
    return { ok: !!r?.ok && !refused, text: refused ? accountRefusalText(refused) : r?.settled ? MARKET_WORDS.settled
      : !r?.ok ? accountRefusalText(r?.error) : m.book.pending ? MARKET_KEPT_TEXT : '' };
  });
  /** MARKET-AUDIT U7: whether a delivery is this character's - another of the account's waits for that one (the book's settle
   *  collects this character's alone), and is never asked after here. */
  const mine = (x) => x.character == null || m.book.me?.() == null || x.character === m.book.me();
  /** AUDIT 30 U10: a piece arrived while the tab stands is collected - each delivery asked once a showing (a refusal is
   *  said, and the next showing asks again). */
  const tried = new Set();
  const arrived = () => (m.book.state.road ?? []).filter((x) => (x.kind === 'piece' || x.kind === 'item') && x.ready && mine(x) && !tried.has(x.id));   // MARKET-ANY: a pack's piece too
  const collectArrived = () => { if (arrived().length && !ui.busy()) settle(); };
  /** On the tab shown: the kept acts settled (and the arrived pieces collected), and the view read - BOARD-UI: beside the
   *  settle, never after it (a settle that moved anything lets the book's cache go, and the read asks again). */
  async function open() {
    // MARKET-AUDIT P4: the opening settle reads as the read does - its kept acts may take a while, never a blank tab
    const settling = m.book.pending || arrived().length ? (st.loading = true, ui.rerender(), settle()) : null;
    // AUDIT 657 B4: a read the prefetch was refused is asked again - the book keeps a failed read its minute too, and the
    // first press said "did not load" of a market back up since (a read still under way is joined, as before)
    const again = prefetchFailed;
    prefetchFailed = false;
    await Promise.all([load(again), settling]);
  }
  /** BOARD-UI (Mac: "Enhance the speed at which the notice board and market loads"): the first view read as the board
   *  opens, before its tab is pressed - the book's minute's cache answers the press, or joins the read under way. Draws
   *  nothing. */
  let prefetchFailed = false;
  function prefetch() {
    try {
      Promise.resolve(m.book.read(st.view, q(), { force: false })).then((r) => { prefetchFailed = !r?.ok; }, () => { prefetchFailed = true; });
    } catch { /* the press reads it */ }
  }
  const go = (view) => { ui.hush?.(); st.view = view; st.picked = null; st.family = null; st.tier = 0; st.data = m.book.cached(view, q()); load(false); };   // MARKET-AUDIT U6: the last act's word is its view's
  /** An act through the window's door; its word, then the view read again - a press the market says has moved too. */
  const act = (start, okText) => ui.run(async () => {
    const r = await start();
    if (r?.ok) { st.picked = null; load(true); return { ok: true, text: typeof okText === 'function' ? okText(r.data) : okText }; }
    if (MOVED.includes(r?.error)) { st.picked = null; load(true); }
    return { ok: false, text: r?.text ?? accountRefusalText(r?.error) };
  });
  /** What the Stores may spend or sell for Drakes of a material - never what gold bought (GOLD-MARKET's wall). */
  const inStores = (key) => listableUnits(m.stores().get(key), 'marks');
  /** MARKET-BAG (FIELD, 2026-10-04: "the market board is broken" - since BAG1 every harvest is carried, and the List form and
   *  Fill read the Stores alone: a gatherer had nothing to sell): what the bag and the pack carry of it, put in first. */
  const carriedOf = (key) => Math.max(0, Math.floor(Number(m.carried?.().get(key)) || 0));
  const held = (key) => inStores(key) + carriedOf(key);
  /** MARKET-BAG: the Stores' shortfall of `n` put in from the bag and the pack (as a station's inputs are), then the act -
   *  a put-in refused is the act's word, and nothing is asked. */
  const fromCarried = async (key, n, then) => {
    if (m.putIn && n > inStores(key)) { const r = await m.putIn(key, n); if (!r?.ok) return { ok: false, error: r?.error ?? 'materials-short' }; }
    return then();
  };
  const where = (row) => (row.region === m.region ? 'here' : m.regionNameOf(row.region));
  /** The units a row's pick starts at, and its courier's quote is for. */
  const pickOf = (row) => (row.kind === 'piece' || row.kind === 'auction' || row.kind === 'item' ? 1 : Math.max(1, Math.min(row.units, PICK_UNITS)));
  // GOLD-MARKET: a gold row's courier a Drake's worth of gold a Drake, as the service charges it
  const courierOf = (row, units) => (row.region === m.region ? 0 : row.road ? courierFee(units, row.road.road) * (row.currency === 'gold' ? MARK_WORTH_GOLD : 1) : null);
  /** AUDIT 30 U16: a unit's price landed here - its courier's share of the pick's. */
  const landed = (row) => { const n = pickOf(row), c = courierOf(row, n); return c == null ? Infinity : row.price + c / n; };
  /** GLOBAL-MARKET: what a fill of `n` units of an order pays this filler - its price less the tax on the order's running
   *  total (fillTaxOn, as the service takes it) and the courier to the order's region; null with no road. */
  const fillPay = (o, n) => { const c = courierOf(o, n); return c == null ? null : n * o.price - fillTaxOn((o.units - o.left) * o.price, n * o.price, c === 0 && n === o.left) - c; };   // MARKET-AUDIT S2: the service's own tax
  const roadText = (row) => {
    if (row.region === m.region) return '';
    if (!row.road) return ' no courier knows the road';
    const n = pickOf(row);
    const c = courierOf(row, n);
    return ` +${row.currency === 'gold' ? goldText(c) : c} courier${row.kind === 'piece' || row.kind === 'item' ? '' : ` for ${n}`}, ${arrivalText(row.road.seconds, 0)}`;
  };

  function viewsNode() {
    const nav = el('nav', 'market-views');
    nav.setAttribute('aria-label', 'Market views');
    const labels = new Map(MARKET_VIEWS.map((r) => [String(r[0]), String(r[1])]));
    for (const [part, ids] of MARKET_VIEW_GROUPS) {
      const g = el('div', 'market-viewgroup');
      if (part) g.append(el('span', 'market-viewpart', part));
      for (const id of ids) {
        const t = el('button', `notice-tab market-view${st.view === id ? ' on' : ''}`, labels.get(id) ?? id);
        t.setAttribute('type', 'button');
        if (st.view === id) t.setAttribute('aria-current', 'page');
        t.onclick = () => { if (st.view !== id) go(id); };
        g.append(t);
      }
      nav.append(g);
    }
    return nav;
  }
  /** BOARD-UI: the column names over a list of rows (the rows' own grid) - a phone's two columns go without them. */
  function listHead(cls, names) {
    const h = el('div', `market-listhead ${cls}`);
    h.setAttribute('aria-hidden', 'true');
    for (const n of names) h.append(el('span', null, n));
    return h;
  }
  /** BOARD-UI: Your silver (and what bids hold, and the gold here) at the top of every view. */
  function walletNode() {
    const held = m.book.state.held ?? 0;
    const gold = goldOk() && purse() != null ? ` · Your gold here: ${goldText(purse())}` : '';   // GOLD-MARKET: the purse and the account here
    return el('p', 'market-wallet', `Your silver: ${balance() == null ? '-' : marksText(balance())}${held > 0 ? ` (${marksText(held)} held in bids)` : ''}${gold}${st.stale ? ' - the market may be out of date' : ''}`);
  }

  function roadNode() {
    const road = m.book.state.road ?? [];
    if (!road.length) return null;
    const box = el('div', 'market-road');
    box.append(el('h4', null, 'On the road'));
    for (const x of road) {
      const from = x.from == null ? '' : ` from ${m.regionNameOf(x.from)}`;
      const what = x.kind === 'material' ? `${x.units} ${m.countName(x.material, x.units)}` : x.kind === 'item' ? goodName(x.item) : m.pieceName(x.piece);
      const when = x.kind === 'material' ? (x.waiting ? 'arrived - waiting for room in your Stores' : arrivalText(x.arrivesAt, ui.nowS()))
        : !mine(x) && x.ready ? 'waiting for another of your characters'   // MARKET-AUDIT U7: never "arrived" forever
          : x.why === 'returned' ? 'back from the market' : arrivalText(x.arrivesAt, ui.nowS());
      box.append(el('p', 'market-roadline', `${what}${from} - ${when}`));
    }
    return box;
  }

  let typing = null;
  function filtersNode(families) {
    const row = el('div', 'market-filters');
    if (st.view === 'materials') {
      const search = /** @type {HTMLInputElement} */ (el('input', 'notice-input market-search'));
      search.placeholder = 'Search';
      search.setAttribute('aria-label', 'Search the materials');
      search.setAttribute('data-focus', 'search');
      search.value = st.query;
      // AUDIT 30 U2: the words read from the service once the typing rests - the field is never redrawn under the keys
      search.oninput = () => { st.query = search.value; st.picked = null; clearTimeout(typing); typing = setTimeout(() => load(false), 300); };
      row.append(search);
    }
    row.append(select([['', 'All'], ...families], st.family ?? '', (v) => { st.family = v || null; st.picked = null; load(false); }, 'Family'));
    const cur = currencyNode();
    if (cur) row.append(cur);
    if (st.view === 'materials') {
      row.append(select([['0', 'Any tier'], ...[1, 2, 3, 4, 5, 6, 7].map((t) => [String(t), `Tier ${t}`])], String(st.tier), (v) => { st.tier = Number(v) || 0; st.picked = null; load(false); }, 'Tier'));
    }
    return row;
  }

  /** GOLD-MARKET: the currency switch - a realm character's alone; a view shows one currency at a time. */
  function currencyNode() {
    if (!goldOk() || !CURRENCY_VIEWS.includes(st.view)) return null;
    return select([['marks', 'Silver'], ['gold', 'Gold']], st.currency, (v) => { st.currency = v === 'gold' ? 'gold' : 'marks'; st.picked = null; load(false); }, 'Currency');
  }

  const pick = (row) => { st.picked = st.picked === row.id ? null : row.id; st.qty = pickOf(row); ui.rerender(); };
  function rowButton(row, cls) {
    const b = el('button', `market-row${cls}${st.picked === row.id ? ' on' : ''}`);
    b.setAttribute('type', 'button');
    b.setAttribute('aria-expanded', st.picked === row.id ? 'true' : 'false');   // AUDIT 30 U22
    b.onclick = () => pick(row);
    return b;
  }
  function materialRow(row) {
    const med = st.data?.medians?.[row.material];
    const b = rowButton(row, '');
    b.append(el('b', null, `${m.name(row.material)} x${row.units.toLocaleString('en-US')}`),
      el('span', 'market-price', `${priceText(row.price, row.currency)} each`),
      el('span', 'market-where', `${where(row)}${roadText(row)}`),
      el('span', 'market-median', `median ${medianText(med?.median ?? null)}`));
    const line = medianLineNode(med?.line);
    if (line) b.append(line);
    if (row.mine) b.append(el('span', 'market-mine', 'yours'));
    if (row.reports != null) b.append(el('span', 'market-mod', plural(row.reports, 'report')));
    return b;
  }
  function pieceRow(row) {
    const p = row.piece;
    const b = rowButton(row, ' market-piece');
    b.append(el('b', null, m.pieceName(p)),
      el('span', 'market-quality', [QUALITY_NAMES[p.quality] ?? null, p.maker ? `made by ${p.maker}` : null, wearText(p.wear)].filter(Boolean).join(' · ')),
      el('span', 'market-price', priceText(row.price, row.currency)),
      el('span', 'market-where', `${where(row)}${roadText(row)}`));
    if (row.mine) b.append(el('span', 'market-mine', 'yours'));
    if (row.reports != null) b.append(el('span', 'market-mod', plural(row.reports, 'report')));
    return b;
  }
  /** MARKET-ANY: a piece listed from a pack - its name, its condition, its price in gold and where it stands. */
  function goodRow(row) {
    const it = row.item;
    const b = rowButton(row, ' market-piece market-good');
    b.append(el('b', null, goodName(it)),
      el('span', 'market-quality', wearText(wearOf(it)) ?? 'whole'),
      el('span', 'market-price', priceText(row.price, row.currency)),
      el('span', 'market-where', `${where(row)}${roadText(row)}`));
    if (row.mine) b.append(el('span', 'market-mine', 'yours'));
    if (row.reports != null) b.append(el('span', 'market-mod', plural(row.reports, 'report')));
    return b;
  }
  /** The picked row's bar: "Buy N for P Marks + C courier?", Buy; Report; a moderator's Remove. A number typed moves the
   *  words and the button that hang on it, never the bar (AUDIT 30 U8). */
  function pickedBar(row) {
    const bar = el('div', 'market-bar');
    const piece = row.kind === 'piece' || row.kind === 'item';   // MARKET-ANY: a pack's piece is bought whole
    const unitsNow = () => (piece ? 1 : intOf(st.qty, 1, row.units));
    const what = (units) => (row.kind === 'item' ? goodName(row.item) : piece ? m.pieceName(row.piece) : `${units} ${m.countName(row.material, units)}`);
    const ask = el('span', 'market-ask');
    ask.setAttribute('aria-live', 'polite');
    const gold = row.currency === 'gold';   // GOLD-MARKET: bought off the purse, at its exact cost
    const buy = button('primary market-buy', m.book.busy ? 'Buying...' : 'Buy', () => {
      const units = unitsNow(), courier = courierOf(row, units), w = what(units);
      return act(() => m.book.buy({ region: m.region, listing: row.id, units, max: units * row.price + (courier ?? 0), hubs: m.hubs, ...at(), ...(gold ? { currency: 'gold' } : {}) }, m.mint),
        (d) => (d?.sale?.here ? `Bought ${w}.` : `Bought ${w} - the courier brings it from ${m.regionNameOf(row.region)} in ${arrivalText(d?.sale?.arrivesAt, ui.nowS())}.`));
    });
    const refresh = () => {
      const units = unitsNow(), courier = courierOf(row, units), total = units * row.price;
      ask.textContent = courier == null ? `The couriers do not know the road to ${m.regionNameOf(row.region)} yet.`
        : gold ? `Buy ${what(units)} for ${goldText(total)}${courier ? ` + ${goldText(courier)} courier` : ''}? From your purse, then your account here.`
          : `Buy ${what(units)} for ${marksText(total)}${courier ? ` + ${courier} courier` : ''}?`;
      buy.disabled = ui.busy() || row.mine || courier == null || (gold && !goldOk()) || shortOf(total + (courier ?? 0), row.currency);
    };
    if (!piece) {
      const n = numberInput(unitsNow(), 1, row.units, 'Units to buy', `qty|${row.id}`);
      n.oninput = () => { st.qty = intOf(n.value, 1, row.units); refresh(); };
      bar.append(n);
    }
    refresh();
    bar.append(ask, buy);
    if (!row.mine) bar.append(button('market-report', 'Report', () => act(() => m.book.report(row.id), 'Reported. A moderator will look at it.')));
    if (row.reports != null) bar.append(button('market-remove', 'Remove', () => act(() => m.book.remove(row.id), 'Removed. Its goods go back to its seller.')));
    return bar;
  }

  // ─── PROF5b: THE AUCTIONS ────────────────────────────────────────
  const endsText = (endsAt) => (endsAt - ui.nowS() <= 0 ? 'ended' : `ends in ${arrivalText(endsAt, ui.nowS())}`);
  const standing = (a) => (a.high == null ? `opening ${marksText(a.opening)} - no bids yet` : `${marksText(a.high)} (${plural(a.bids, 'bid')})`);
  function auctionRow(a) {
    const p = a.piece;
    const b = rowButton(a, ' market-piece market-auction');
    b.append(el('b', null, m.pieceName(p)),
      el('span', 'market-quality', [QUALITY_NAMES[p.quality] ?? null, p.maker ? `made by ${p.maker}` : null, wearText(p.wear)].filter(Boolean).join(' · ')),
      el('span', 'market-price', standing(a)),
      el('span', 'market-where', `${where(a)}${roadText({ ...a, kind: 'piece' })} · ${endsText(a.endsAt)}`));
    if (a.mine) b.append(el('span', 'market-mine', 'yours'));
    else if (a.leading) b.append(el('span', 'market-mine', 'your bid leads'));
    if (a.reports != null) b.append(el('span', 'market-mod', plural(a.reports, 'report')));
    return b;
  }
  /** The picked auction's bar: the seller's Cancel while no bid stands; the leader's word; else Bid at the next bid, the
   *  courier with it - the number typed moves the words that hang on it (AUDIT 30 U8). */
  function auctionBar(a) {
    const bar = el('div', 'market-bar');
    if (a.mine) {
      bar.append(el('span', 'market-ask', a.bids ? `Your auction - ${standing(a)}. It cannot be cancelled once bid on.` : 'Your auction - no bids yet.'));
      if (!a.bids) bar.append(button('market-cancel', 'Cancel', () => act(() => m.book.cancel(a.id, m.mint), 'Cancelled. Your Masterwork is back; the fee is kept.')));
      return bar;
    }
    if (a.leading) {
      bar.append(el('span', 'market-ask', `Your bid of ${marksText(a.high)} leads. It is held until you are outbid or the auction ends.`));
    } else if (a.next > AUCTION_BID_MAX) {
      // AUDIT 31 L6: the next bid past what any balance can hold - said, never a Bid that cannot be pressed for no reason
      bar.append(el('span', 'market-ask', `The next bid (${marksText(a.next)}) is more than an account can hold.`));
    } else {
      const courier = courierOf({ ...a, kind: 'piece' }, 1);
      const amountNow = () => Math.max(a.next, intOf(st.bid[a.id] ?? a.next, a.next, AUCTION_BID_MAX));
      const n = numberInput(amountNow(), a.next, AUCTION_BID_MAX, 'Your bid in silver', `bid|${a.id}`);
      const ask = el('span', 'market-ask');
      ask.setAttribute('aria-live', 'polite');
      const go = button('primary market-bid', 'Bid', () => {
        const amount = amountNow();
        return act(() => m.book.bid({ region: m.region, auction: a.id, amount, hubs: m.hubs }),
          `Your bid of ${marksText(amount)} leads. It is held until you are outbid or the auction ends.`);
      });
      const refresh = () => {
        const amount = amountNow();
        ask.textContent = courier == null ? `The couriers do not know the road to ${m.regionNameOf(a.region)} yet.`
          : `Bid ${marksText(amount)}${courier ? ` + ${courier} courier` : ''}? At least ${marksText(a.next)}.`;
        go.disabled = ui.busy() || courier == null || short(amount + (courier ?? 0));
      };
      n.oninput = () => { st.bid[a.id] = intOf(n.value, a.next, AUCTION_BID_MAX); refresh(); };
      refresh();
      bar.append(n, ask, go);
    }
    bar.append(button('market-report', 'Report', () => act(() => m.book.report(a.id), 'Reported. A moderator will look at it.')));
    if (a.reports != null) bar.append(button('market-remove', 'Remove', () => act(() => m.book.remove(a.id), 'Removed. Its bid is returned and its piece goes back to its seller.')));
    return bar;
  }

  function weaversNode() {
    const box = el('div', 'market-counter');
    box.append(el('h4', null, 'The Weavers\' counter'));
    for (const w of m.weavers) {
      const row = el('div', 'market-counterrow');
      const count = () => intOf(st.weave[w.key] ?? 1, 1, 100);
      const inp = numberInput(count(), 1, 100, `Bolts of ${m.name(w.key)}`, `weave|${w.key}`);
      const b = button('market-weave', '', () => ui.run(() => m.stock(w.key, count())));
      const refresh = () => {
        b.textContent = `Buy for ${marksText(w.marks * count())}`;
        b.disabled = ui.busy() || short(w.marks * count());   // AUDIT 30 U12, U13
      };
      inp.oninput = () => { st.weave[w.key] = intOf(inp.value, 1, 100); refresh(); };
      refresh();
      row.append(el('b', null, m.name(w.key)), el('span', 'market-price', `${marksText(w.marks)} a bolt`), inp, b);
      box.append(row);
    }
    box.append(el('p', 'notice-tip', 'Into your Stores, for the loom.'));   // AUDIT 32 R5: Outfitting practised since PROF7 - a bolt withdraws, and sews
    return box;
  }

  /** BOARD-UI: the suppliers' counters under one line, folded until opened - and kept open across the window's redraws. */
  function suppliersNode() {
    const box = /** @type {any} */ (el('details', 'market-suppliers'));
    box.open = st.suppliersOpen === true;
    box.addEventListener?.('toggle', () => { st.suppliersOpen = !!box.open; });
    box.append(el('summary', null, MARKET_WORDS.suppliers), weaversNode());
    if ((m.apothecaries ?? []).length) box.append(apothecariesNode());   // PROF12
    return box;
  }
  /** PROF12 (PROF0 4.5: "The Apothecaries' counter, the supplier's second"): the sixteen ingredients DFU's potion recipes need
   *  and no gathering yields, a measure at a time, into the Stores for the alchemy station - the Weavers' counter's shape. */
  function apothecariesNode() {
    const box = el('div', 'market-counter');
    box.append(el('h4', null, 'The Apothecaries\' counter'));
    for (const w of m.apothecaries ?? []) {
      const row = el('div', 'market-counterrow');
      const count = () => intOf(st.weave[w.key] ?? 1, 1, 100);
      const inp = numberInput(count(), 1, 100, `Measures of ${m.name(w.key)}`, `apothecary|${w.key}`);
      const b = button('market-weave', '', () => ui.run(() => m.stock(w.key, count())));
      const refresh = () => {
        b.textContent = `Buy for ${marksText(w.marks * count())}`;
        b.disabled = short(w.marks * count()) || ui.busy();   // the Weavers' AUDIT 30 U12, U13
      };
      inp.oninput = () => { st.weave[w.key] = intOf(inp.value, 1, 100); refresh(); };
      refresh();
      row.append(el('b', null, m.name(w.key)), el('span', 'market-price', `${marksText(w.marks)} a measure`), inp, b);
      box.append(row);
    }
    box.append(el('p', 'notice-tip', 'For the alchemy station, into your Stores.'));
    return box;
  }

  /** MARKET-ANY: how the service says a crafted piece the save holds may list ("My listings" reads it, `ways`) - `yours`,
   *  `other`, `elsewhere`, `none` - or null while it has not said. */
  const heldState = (pv) => (st.view !== 'mine' ? null : st.data?.ways?.[pv] ?? (st.data?.ways && !heldIds().includes(pv) ? 'unasked' : null));   // MARKET-AUDIT U3: past MARKET_HELD_MAX, never asked
  /** A crafted piece offered as one: the service's `yours` - or, from a service that names none, every one (as before). */
  const pieceListedAsCrafted = (pv) => (st.data?.ways ? ['yours', 'unasked'].includes(/** @type {string} */ (heldState(pv))) : true);
  /** Why a pack piece with a maker's record does not list from the pack (null: it does - its record names another). */
  const craftedWhy = (item) => {
    if (typeof item?.provenance !== 'string') return null;
    const h = heldState(item.provenance);
    // AUDIT PROF-541 R2-C7: a dish of your own make spoiled since it was cooked lists neither way - its record mints it
    // fresh (smithItems.js asMinted), so the Crafted list leaves it out - and is said so, never "list it as a crafted piece"
    if (h === 'yours' && (item.foodStage ?? 0) > 0) return SPOILED_DISH_WHY;
    return h === 'other' || h === 'none' || h === 'unasked' ? null : h === 'yours' ? 'your own make - list it as a crafted piece' : h === 'elsewhere' ? 'on the market already' : 'being looked up';
  };
  /** BOARD-UI: a form's field under its name. */
  const field = (name, input, cls = '') => {
    const f = el('label', `market-field${cls ? ` ${cls}` : ''}`);
    f.append(el('span', 'notice-label', name), input);
    return f;
  };
  function listForm() {
    const box = el('div', 'market-listform');
    box.append(el('h4', null, 'List on the market'));
    const fields = el('div', 'market-fields');
    // MARKET-ANY: a realm character lists a piece from its pack too - for gold alone
    if (st.list.kind === 'item' && !(goldOk() && m.goods)) st.list.kind = 'material';
    const kinds = [['material', 'From the Stores'], ['piece', 'A crafted piece'], ['auction', 'An auction (Masterworks)'],
      ...(goldOk() && m.goods ? [['item', 'A piece from your pack (gold)']] : [])];
    fields.append(field('What', select(kinds, st.list.kind, (v) => { st.list.kind = v; ui.rerender(); }, 'What to list'), 'market-field-wide'));
    // GOLD-MARKET: a realm character prices a Stores material or a piece in Drakes or gold (an auction stays Drakes')
    const gold = goldOk() && st.list.kind !== 'auction' && (st.list.currency === 'gold' || st.list.kind === 'item');
    if (goldOk() && st.list.kind !== 'auction' && st.list.kind !== 'item') {
      fields.append(field('Priced in', select([['marks', 'Priced in silver'], ['gold', 'Priced in gold']], st.list.currency, (v) => { st.list.currency = v === 'gold' ? 'gold' : 'marks'; ui.rerender(); }, 'Currency')));
    }
    const cur = gold ? 'gold' : 'marks';
    const unitWord = gold ? 'gold' : 'silver';
    const price = numberInput(st.list.price, 1, MARKET_PRICE_MAX, `Price in ${unitWord}`, 'list-price');
    const hint = el('p', 'notice-tip');
    const notes = el('div', 'market-formnotes');
    const b = button('primary market-dolist', 'List', () => send());   // BOARD-UI: never `market-list`, the lists' own class - its rule took the press's padding
    const listingsMax = m.book.state.listingsMax ?? MARKET_LISTINGS_MAX;   // AUDIT SEATS-3 D2: the board's own cap, as the service says it
    const full = (m.book.state.counts?.listings ?? 0) >= listingsMax;
    let can = () => false, send = () => {}, worth = () => 0;
    if (st.list.kind === 'material') {
      // GOLD-MARKET: the units a listing in its currency may take - never the other currency's bought ones. MARKET-BAG: a
      // silver listing's what the bag and the pack carry too, put in first (a gold listing's are its Stores' own and gold's)
      const listable = (key) => (gold ? listableUnits(m.stores().get(key), cur) : held(key));
      const keys = [...new Set([...m.stores().keys(), ...(gold ? [] : [...(m.carried?.().keys() ?? [])])])].filter((k) => listable(k) > 0);
      if (!keys.includes(st.list.material)) st.list.material = keys[0] ?? '';
      const most = listable(st.list.material);
      st.list.units = intOf(st.list.units, 1, Math.max(1, Math.min(most, MARKET_UNITS_MAX)));
      const units = numberInput(st.list.units, 1, Math.max(1, Math.min(most, MARKET_UNITS_MAX)), 'Units to list', 'list-units');
      const carriedSaid = el('p', 'notice-tip');
      const sayCarried = () => {
        const short = gold || !st.list.material ? 0 : Math.max(0, st.list.units - inStores(st.list.material));
        carriedSaid.textContent = short ? `${plural(short, 'unit')} of it ${short === 1 ? 'goes' : 'go'} into your Stores from your bag and pack first.` : '';
      };
      units.oninput = () => { st.list.units = intOf(units.value, 1, Math.max(1, Math.min(most, MARKET_UNITS_MAX))); sayCarried(); refresh(); };
      fields.append(keys.length ? field('Material', select(keys.map((k) => [k, `${m.name(k)} (${listable(k).toLocaleString('en-US')})`]), st.list.material, (v) => { st.list.material = v; ui.rerender(); }, 'Material'), 'market-field-wide')
        : el('span', 'notice-tip', gold ? 'Your Stores hold nothing that sells for gold.' : MARKET_WORDS.noStores),
      field('Units', units), field(`${unitWord} each`, price));
      notes.append(carriedSaid);
      worth = () => st.list.units * st.list.price;
      can = () => !!st.list.material && most >= st.list.units && worth() <= MARKET_WORTH_MAX;   // MARKET-AUDIT: the worth the service takes
      const req = () => ({ region: m.region, kind: 'material', material: st.list.material, units: st.list.units, price: st.list.price, hubs: m.hubs, ...at(), ...(gold ? { currency: 'gold' } : {}) });
      send = () => act(() => (gold ? m.book.list(req()) : fromCarried(st.list.material, st.list.units, () => m.book.list(req()))),
        `Listed ${st.list.units} ${m.countName(st.list.material, st.list.units)} at ${priceText(st.list.price, cur)} each.`);
      sayCarried();
    } else if (st.list.kind === 'item') {
      // MARKET-ANY: every piece of the pack that may go, and of the rest why not - a crafted piece as the service says
      const all = (m.goods?.() ?? []).map((g) => ({ ...g, why: g.why ?? craftedWhy(g.item) }));
      const goods = all.filter((g) => !g.why);
      if (!goods.some((g) => g.item === st.list.good)) st.list.good = goods[0]?.item ?? null;
      const chosen = goods.find((g) => g.item === st.list.good) ?? null;
      fields.append(goods.length ? field('Piece', select(goods.map((g, i) => [String(i), goodName(g.item)]), String(goods.indexOf(/** @type {any} */ (chosen))), (v) => { st.list.good = goods[Number(v)]?.item ?? null; ui.rerender(); }, 'Piece from your pack'), 'market-field-wide')
        : el('span', 'notice-tip', 'Nothing in your pack can go on the market.'),
      field('Price in gold', price));
      const refused = all.filter((g) => g.why);
      if (refused.length) {
        const shown = refused.slice(0, GOODS_SAID).map((g) => `${goodName(g.item)} (${g.why})`).join('; ');
        notes.append(el('p', 'notice-tip market-refused', `Not for the market: ${shown}${refused.length > GOODS_SAID ? `; and ${plural(refused.length - GOODS_SAID, 'more')}` : ''}.`));
      }
      worth = () => st.list.price;
      can = () => !!chosen;
      send = () => act(() => {
        const g = /** @type {any} */ (m.good)?.(chosen?.item);
        if (!g?.offered || !(g.pick >= 0)) return Promise.resolve({ ok: false, error: 'piece-held' });
        const hub = m.hubs?.[m.region];
        return m.book.list({ region: m.region, kind: 'item', item: g.offered, pick: g.pick, price: st.list.price, hubs: hub ? { [m.region]: hub } : {}, currency: 'gold' }, null, g);
      }, `Listed ${chosen ? goodName(chosen.item) : 'it'} at ${goldText(st.list.price)}.`);
    } else {
      // PROF5b: an auction offers the Masterworks alone (10.2)
      const auction = st.list.kind === 'auction';
      // MARKET-ANY: only the pieces whose maker's record is this account's, standing nowhere else, as the service says
      const all = m.pieces().filter((p) => !auction || p.item.quality === MASTERWORK);
      const pieces = all.filter((p) => pieceListedAsCrafted(p.item.provenance));
      const others = all.filter((p) => heldState(p.item.provenance) === 'other' || heldState(p.item.provenance) === 'none').length;
      const elsewhere = all.filter((p) => heldState(p.item.provenance) === 'elsewhere').length;
      if (!pieces.some((p) => p.item.provenance === st.list.piece)) st.list.piece = pieces[0]?.item.provenance ?? '';
      const chosen = pieces.find((p) => p.item.provenance === st.list.piece) ?? null;
      // MARKET-AUDIT U2: each its quality (an auction's are all Masterworks) and wear - a Crude, a Fine and a worn piece of one
      // name were three like options
      const pieceLabel = (p) => [p.name, auction ? null : QUALITY_NAMES[p.item.quality] ?? null, wearText(wearOf(p.item)), p.where === 'home' ? 'your home' : null].filter(Boolean).join(', ');
      fields.append(pieces.length ? field('Piece', select(pieces.map((p) => [p.item.provenance, pieceLabel(p)]), st.list.piece, (v) => { st.list.piece = v; ui.rerender(); }, 'Crafted piece'), 'market-field-wide')
        : el('span', 'notice-tip', auction ? 'You carry no Masterwork to auction.' : 'You carry no crafted piece to sell.'),
      field(auction ? 'Opening bid (silver)' : `Price in ${unitWord}`, price));
      const them = (n) => (n === 1 ? 'it' : 'them');
      if (others) notes.append(el('p', 'notice-tip', `${plural(others, 'crafted piece')} you hold ${others === 1 ? 'is' : 'are'} another player's by its maker's record - only they sell ${them(others)} as crafted.${goldOk() && m.goods ? ` List ${them(others)} from your pack for gold instead.` : ''}`));
      if (elsewhere) notes.append(el('p', 'notice-tip', `${plural(elsewhere, 'crafted piece')} you hold ${elsewhere === 1 ? 'is' : 'are'} already listed, on the road or in a home.`));
      worth = () => st.list.price;
      can = () => !!chosen;
      const piece = () => ({ item: chosen.item, where: chosen.where, take: () => m.take(chosen.item, chosen.where), putBack: m.putBack });
      send = auction
        ? () => act(() => m.book.auction({ region: m.region, provenance: chosen.item.provenance, wear: wearOf(chosen.item), opening: st.list.price, hubs: m.hubs, ...at() }, piece()),
          `${chosen?.name} is up for auction, opening at ${marksText(st.list.price)}.`)
        : () => act(() => m.book.list({ region: m.region, kind: 'piece', provenance: chosen.item.provenance, wear: wearOf(chosen.item), price: st.list.price, hubs: m.hubs, ...at(), ...(gold ? { currency: 'gold' } : {}) }, piece()),
          `Listed ${chosen?.name} at ${priceText(st.list.price, cur)}.`);
    }
    // AUDIT 30 U13: a listing the fee or the board's limit would refuse is not offered - the words say which.
    // BOARD-UI: the terms in one short line each - the fee, how long, what reaches the seller
    const refresh = () => {
      const fee = listingFee(worth());
      // AUDIT SEATS-3 D3: a sale in Drakes pays the seat's Tithe at the board's bailiwick too - its rate where the seats' list
      // is read (m.tithe), else said
      const pct = m.tithe?.() ?? null;
      const less = pct > 0 ? `${saleTax(100)}% tax and the ${pct}% Tithe` : `${saleTax(100)}% tax`;
      const goldGets = goldText(goldSaleOf(0, worth()).gets);
      hint.textContent = full ? `You have ${listingsMax} listings up - the most allowed here. Cancel one or wait for a sale.`
        : worth() > MARKET_WORTH_MAX ? `A listing is worth at most ${priceText(MARKET_WORTH_MAX, cur)} - list fewer, or ask less.`   // MARKET-AUDIT: never offered to be refused
        // GOLD-MARKET: no fee now - each sale pays its share and the tax; the gold is held for the seller to collect
        // MARKET-ANY: a piece from the pack - where it goes, and why gold alone
        // AUDIT 657 B9: the 1% is a fee - the sale's (goldSaleOf), never the listing's
        : st.list.kind === 'item' ? `No fee to list. Up for 72 hours on every board. If it sells you get ${goldGets} (after a 1% fee and ${saleTax(100)}% tax), collected at a bank. It leaves your pack now and comes back if it does not sell.`
        : gold ? `No fee to list. Up for 72 hours on every board. If it all sells you get ${goldGets} (after a 1% fee and ${saleTax(100)}% tax), collected at a bank. Goods bought with silver, and pieces made with them, sell only for silver.`
        : st.list.kind === 'auction'
          ? `Fee ${marksText(fee)}, kept if you cancel (only before the first bid). Runs ${AUCTION_S / 3600} hours on every board; each bid beats the last by ${AUCTION_RAISE_PCT}%, and a bid in the last ${AUCTION_LATE_S / 60} minutes adds ${AUCTION_ADD_S / 60} minutes. You get the top bid, less ${less}${pct == null ? ' and any Tithe' : ''}.`
          : `Fee ${marksText(fee)}, kept if you cancel. Up for 72 hours on every board. If it all sells you get ${marksText(sellerGets(worth(), pct ?? 0))}, after ${less}${pct == null ? ', before any Tithe' : ''}.`;
      b.disabled = ui.busy() || full || !can() || (!gold && short(fee));
    };
    price.oninput = () => { st.list.price = intOf(price.value, 1, MARKET_PRICE_MAX); refresh(); };
    refresh();
    fields.append(b);
    box.append(fields, notes, hint);
    return box;
  }

  function orderForm() {
    const box = el('div', 'market-orderform');
    box.append(el('h4', null, 'Post a buy order'));
    const cat = marketCatalogue();
    if (!st.post.material) st.post.material = cat[0]?.key ?? '';
    const units = numberInput(st.post.units, 1, MARKET_UNITS_MAX, 'Units wanted', 'post-units');
    const price = numberInput(st.post.price, 1, MARKET_PRICE_MAX, 'Silver each', 'post-price');
    const fields = el('div', 'market-fields');
    fields.append(field('Material', select(cat.map((c) => [c.key, `${m.name(c.key)} (tier ${c.tier})`]), st.post.material, (v) => { st.post.material = v; ui.rerender(); }, 'Material wanted'), 'market-field-wide'),
      field('Units', units), field('Silver each', price));
    const hint = el('p', 'notice-tip');
    const full = (m.book.state.counts?.orders ?? 0) >= MARKET_ORDERS_MAX;
    const b = button('primary market-post', 'Post the order', () => act(() => m.book.order({ region: m.region, material: st.post.material, units: st.post.units, price: st.post.price, hubs: m.hubs }),
      `Your order for ${st.post.units} ${m.countName(st.post.material, st.post.units)} is up.`));
    const refresh = () => {
      const cost = st.post.units * st.post.price;
      hint.textContent = full ? `You have ${MARKET_ORDERS_MAX} orders up - the most allowed.`
        : `${marksText(cost)} is held while it stands (7 days, on every board). Sellers outside ${m.regionName} pay the courier. What is not filled comes back.`;
      b.disabled = ui.busy() || full || !st.post.material || short(cost);
    };
    units.oninput = () => { st.post.units = intOf(units.value, 1, MARKET_UNITS_MAX); refresh(); };
    price.oninput = () => { st.post.price = intOf(price.value, 1, MARKET_PRICE_MAX); refresh(); };
    refresh();
    fields.append(b);
    box.append(fields, hint);
    return box;
  }

  function orderRow(o) {
    const li = el('li', `market-order${o.mine ? ' mine' : ''}`);
    li.append(el('b', null, `${m.name(o.material)}`), el('span', 'market-price', `${o.left.toLocaleString('en-US')} of ${o.units.toLocaleString('en-US')} wanted at ${marksText(o.price)} each`));
    const med = st.data?.medians?.[o.material];
    if (med) li.append(el('span', 'market-median', `median ${medianText(med.median)}`));
    if (o.mine) {
      li.append(el('span', 'market-mine', 'yours'),
        el('span', 'market-state', o.state === 'open' ? `${plural(Math.max(0, Math.ceil((o.expiresAt - ui.nowS()) / 86400)), 'day')} left` : o.state));
      if (o.state === 'open') li.append(button('market-unorder', 'Withdraw', () => act(() => m.book.unorder(o.id), 'Withdrawn. What was held for it is back.')));
      return li;
    }
    const have = held(o.material);
    const most = Math.max(1, Math.min(have, o.left));
    const count = () => intOf(st.fills[o.id] ?? Math.min(have, o.left), 1, most);
    const inp = numberInput(count(), 1, most, `Units of ${m.name(o.material)} to fill`, `fill|${o.id}`);
    // MARKET-BAG: what the Stores lack of it put in from the bag and the pack first, as a station's inputs are
    const b = button('primary market-fill', '', () => { const n = count(); return act(() => fromCarried(o.material, n, () => m.book.fill({ region: m.region, order: o.id, units: n, hubs: m.hubs, least: fillPay(o, n) ?? 1, ...at() })),
      (d) => `Filled: ${marksText(d?.fill?.pay ?? 0)}.`); });
    const stores = inStores(o.material), carried = carriedOf(o.material);
    const haveText = `${stores.toLocaleString('en-US')} in your Stores${carried ? `, ${carried.toLocaleString('en-US')} carried` : ''}`;
    // GLOBAL-MARKET: what a fill pays here - the price less the tax and, from another region, the courier
    const says = el('span', 'notice-tip');
    says.setAttribute('aria-live', 'polite');
    const refresh = () => {
      const n = count(), pay = fillPay(o, n), c = courierOf(o, n);
      b.textContent = `Fill ${n} from the Stores`;
      b.disabled = ui.busy() || have < 1 || pay == null || pay < 1;
      says.textContent = `${haveText} - ${c == null ? `the couriers do not know the road to ${m.regionNameOf(o.region)} yet`
        : pay < 1 ? (c ? `the courier to ${m.regionNameOf(o.region)} would take all it pays` : 'after the tax it pays nothing - fill more at once') : `pays you ${marksText(pay)}${c ? ` after ${c} courier and tax` : ' after tax'}`}`;
    };
    inp.oninput = () => { st.fills[o.id] = intOf(inp.value, 1, most); refresh(); };
    refresh();
    li.append(el('span', 'market-where', where(o)), inp, b, says);
    return li;
  }

  /** GOLD-MARKET: the gold this character's sales hold, and its Collect into the bank of the board's region. */
  function goldHeldNode() {
    const n = m.book.state.goldHeld ?? 0;
    if (!goldOk() || !(n > 0)) return null;
    const box = el('div', 'market-goldheld');
    box.append(el('span', 'market-ask', `Your sales hold ${goldText(n)} for you.`),
      button('primary market-collectgold', 'Collect into your bank here', () => act(() => m.book.collectGold(m.region),
        (d) => `${goldText(d?.gold ?? n)} into your account at the bank of ${m.regionName}.`)));
    return box;
  }

  function mineNode() {
    const box = el('div', 'market-mine-view');
    const goldHeld = goldHeldNode();
    if (goldHeld) box.append(goldHeld);
    box.append(listForm());
    box.append(el('h4', null, MARKET_WORDS.yourListings));   // BOARD-UI: the listings under their own name
    const rows = st.data?.rows ?? [];
    const ul = el('ul', 'market-list');
    for (const l of rows) {
      const li = el('li', `market-listing state-${l.state}`);
      // MARKET-AUDIT: a closed listing's units are its listed whole - "5 of 10 left · cancelled" read as if five stood
      li.append(el('b', null, l.kind === 'piece' ? m.pieceName(l.piece) : l.kind === 'item' ? goodName(l.item) : l.state === 'open' ? `${m.name(l.material)} - ${l.units} of ${l.listed} left` : `${m.name(l.material)} x${l.listed}`),
        el('span', 'market-price', `${priceText(l.price, l.currency)}${l.kind === 'material' ? ' each' : ''}`),
        el('span', 'market-where', l.region === m.region ? 'here' : m.regionNameOf(l.region)),
        el('span', 'market-state', l.state === 'open' ? `${plural(Math.max(0, Math.ceil((l.expiresAt - ui.nowS()) / 3600)), 'hour')} left` : l.state));
      // MARKET-AUDIT: a gold listing (a pack's piece among them) paid no fee to keep
      if (l.state === 'open') li.append(button('market-cancel', 'Cancel', () => act(() => m.book.cancel(l.id, m.mint), l.currency === 'gold' ? 'Cancelled. The goods are back.' : 'Cancelled. The goods are back; the fee is kept.')));
      ul.append(li);
    }
    if (!rows.length && st.data) ul.append(el('li', 'notice-empty', MARKET_WORDS.noListings));
    box.append(ul);
    // PROF5b: this account's auctions and its bids
    const auctions = st.data?.auctions ?? [];
    if (auctions.length) {
      box.append(el('h4', null, 'Your auctions'));
      const al = el('ul', 'market-list');
      const said = { sold: (a) => `sold for ${marksText(a.high)}`, unsold: () => 'no bid came - it is on its way back', cancelled: () => 'cancelled', removed: () => 'removed by a moderator' };
      for (const a of auctions) {
        const li = el('li', `market-listing state-${a.state}`);
        li.append(el('b', null, m.pieceName(a.piece)), el('span', 'market-price', standing(a)),
          el('span', 'market-state', a.state === 'open' ? endsText(a.endsAt) : (said[a.state]?.(a) ?? a.state)));
        if (a.state === 'open' && !a.bids) li.append(button('market-cancel', 'Cancel', () => act(() => m.book.cancel(a.id, m.mint), 'Cancelled. Your Masterwork is back; the fee is kept.')));
        al.append(li);
      }
      box.append(al);
    }
    const bids = st.data?.bids ?? [];
    if (bids.length) {
      box.append(el('h4', null, 'Your bids'));
      const bl = el('ul', 'market-list');
      for (const b of bids) {
        const word = b.state === 'high' ? (b.auctionState === 'open' ? `leading - ${endsText(b.endsAt)}` : 'leading')
          : b.state === 'won' ? 'won - it comes to you'
            // AUDIT 31 S3: a void bid is a removed auction's, or a won one its seller could not be paid for in seven days;
            // U13: its Marks come back when this tab is next read - never "when you next open the market", which it is
            : b.state === 'void' ? (b.returned ? 'void - your silver is back' : 'void - your silver comes back at the next look')
              : b.returned ? 'outbid - your silver is back' : 'outbid - your silver comes back at the next look';
        bl.append(el('li', `market-listing state-${b.state}`, `${m.pieceName(b.piece)} - ${marksText(b.amount)}${b.courier ? ` + ${b.courier} courier` : ''} - ${word}`));
      }
      box.append(bl);
    }
    const orders = st.data?.orders ?? [];
    if (orders.length) {
      box.append(el('h4', null, 'Your buy orders'));
      const ol = el('ul', 'market-list');
      for (const o of orders) ol.append(orderRow(o));
      box.append(ol);
    }
    return box;
  }

  function historyNode() {
    const box = el('div', 'market-history');
    const cur = currencyNode();   // GOLD-MARKET: the week's prices in one currency
    if (cur) { const row = el('div', 'market-filters'); row.append(cur); box.append(row); }
    const ul = el('ul', 'market-list');
    for (const h of st.data?.history ?? []) {
      const li = el('li', 'market-histrow');
      li.append(el('b', null, m.name(h.material)), el('span', 'market-units', `${h.units.toLocaleString('en-US')} sold this week`),
        el('span', 'market-median', `median ${medianText(h.median)}`));
      const line = medianLineNode(h.line);
      if (line) li.append(line);
      ul.append(li);
    }
    if (st.data && !(st.data.history?.length)) ul.append(el('li', 'notice-empty', MARKET_WORDS.noHistory));
    box.append(ul);
    const trades = st.data?.trades ?? [];
    if (trades.length) {
      box.append(el('h4', null, 'Your trades'));
      const tl = el('ul', 'market-list');
      // AUDIT 30 U15: the Marks each trade moved - paid with its courier, or taken after the tax and the Tithe
      const verb = { bought: ['Bought', 'paid'], sold: ['Sold', 'to you'], filled: ['Filled an order with', 'to you'], ordered: ['Your order took', 'paid'],
        won: ['Won at auction', 'paid'], auctioned: ['Sold at auction', 'to you'] };   // PROF5b
      for (const t of trades) {
        const what = t.kind === 'piece' ? 'a crafted piece' : t.kind === 'item' ? goodName(t.item) : `${t.units} ${m.countName(t.material, t.units)}`;
        const [v, way] = verb[t.side] ?? [t.side, ''];
        tl.append(el('li', 'market-trade', `${v} ${what} - ${priceText(t.total, t.currency)} ${way} - ${agoText(t.at, ui.nowS())}`));
      }
      box.append(tl);
    }
    return box;
  }

  // AUDIT 30 U8, A12: the field that had the focus keeps it through a redraw - AUDIT 31 U1: the window's to keep
  // (ui/noticeWindow.js render), which looks before it empties itself; the tab only keys its fields (`data-focus`).

  /** The tab's body. BOARD-UI: Your silver and the views at the top, the road under them, then the view. */
  function body() {
    const box = el('div', 'notice-cork market-body');
    // AUDIT 30 U11: the service's own word - a shut market, or a session to sign in again for. AUDIT 657 B12: and alone -
    // the silver's strip stood over it, "Your silver: -", for a market that reads no silver
    const shut = !!st.error && !st.data && SHUT.includes(st.error);
    if (!shut) box.append(walletNode());
    box.append(viewsNode());
    const road = roadNode();
    if (road) box.append(road);
    if (st.error && !st.data) {
      const p = el('p', 'notice-empty', shut ? accountRefusalText(st.error) : st.error === 'offline' || st.error === 'server'
        ? MARKET_WORDS.slow : accountRefusalText(st.error));
      if (!shut) p.append(button('notice-retry', 'Try again', () => load(true)));
      box.append(p);
      // MARKET-AUDIT U5: a read that failed leaves the view's filters (a filter may be what to change) and the counters,
      // which read nothing of the market - only a shut market is the word alone
      if (shut) return box;
    }
    if (st.loading && !st.data) box.append(el('p', 'notice-empty', MARKET_WORDS.reading));
    if (st.view === 'auctions') {
      box.append(filtersNode(CRAFTED_FAMILIES));
      const rows = st.data?.rows ?? [];
      const list = el('div', 'market-rows');
      if (rows.length) list.append(listHead('market-auction', ['Masterwork', 'Quality', 'Standing bid']));
      for (const a of rows) {
        list.append(auctionRow(a));
        if (st.picked === a.id) list.append(auctionBar(a));
      }
      // AUDIT 31 U14: the empty words say the filter's kind, as the Crafted view's do
      if (st.data && !rows.length) list.append(el('p', 'notice-empty', st.family ? 'No Masterwork of that kind is up for auction.' : 'No Masterwork is up for auction.'));
      box.append(list);
    } else if (st.view === 'materials' || st.view === 'crafted') {
      box.append(filtersNode(st.view === 'materials' ? LISTED_FAMILIES : CRAFTED_FAMILIES));
      const rows = [...(st.data?.rows ?? [])].sort((a, b) => landed(a) - landed(b) || a.price - b.price);
      const list = el('div', 'market-rows');
      if (rows.length) list.append(st.view === 'materials' ? listHead('market-materialhead', ['Material', 'Price', 'From', '7-day median']) : listHead('market-piece', ['Piece', 'Quality', 'Price', 'From']));
      for (const r of rows) {
        list.append(st.view === 'materials' ? materialRow(r) : pieceRow(r));
        if (st.picked === r.id) list.append(pickedBar(r));
      }
      if (st.data && !rows.length) list.append(el('p', 'notice-empty', st.view === 'materials' ? MARKET_WORDS.noMaterials : MARKET_WORDS.noCrafted));
      box.append(list);
      if (st.view === 'materials') box.append(suppliersNode());   // BOARD-UI: the Weavers' and (PROF12) the Apothecaries' counters, folded
    } else if (st.view === 'goods') {
      // MARKET-ANY: the pieces listed from packs, in gold - bought off the purse as any gold row
      box.append(filtersNode(GOODS_FAMILIES));
      const rows = [...(st.data?.rows ?? [])].sort((a, b) => landed(a) - landed(b) || a.price - b.price);
      const list = el('div', 'market-rows');
      if (rows.length) list.append(listHead('market-piece', ['Piece', 'Condition', 'Price', 'From']));
      for (const r of rows) {
        list.append(goodRow(r));
        if (st.picked === r.id) list.append(pickedBar(r));
      }
      if (st.data && !rows.length) list.append(el('p', 'notice-empty', st.family ? MARKET_WORDS.noGoodsKind : MARKET_WORDS.noGoods));
      if (!goldOk()) list.append(el('p', 'notice-tip', accountRefusalText('market-gold-realm')));
      box.append(list);
    } else if (st.view === 'mine') box.append(mineNode());
    else if (st.view === 'orders') {
      box.append(filtersNode(LISTED_FAMILIES));
      const ul = el('ul', 'market-list');
      // AUDIT 30 U7: this account's own orders stand among the region's, Withdraw beside them
      const orders = st.data?.orders ?? [];
      for (const o of orders) ul.append(orderRow(o));
      if (st.data && !orders.length) ul.append(el('li', 'notice-empty', MARKET_WORDS.noOrders));
      box.append(ul, orderForm());
    } else box.append(historyNode());
    return box;
  }

  return { body, open, load, prefetch, state: st };
}
