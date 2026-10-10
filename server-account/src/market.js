// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET, AS THE SERVICE KEEPS
// IT: listings of Stores materials and crafted pieces, their sales and
// couriers, buy orders and their fills, the prices' history, reports and
// removal (bible/06-Systems/Professions-Arc.md 10.2-10.5 and 26; the
// numbers are src/net/marketLaw.js, which the client reads too).
//
// ═══ OPEN WHERE THE BOARD, THE PROFESSIONS AND THE MARKS ARE ═══════
//
// The market is the board's tab, sells the Stores and moves Marks, so it
// is open to an account only while BOARD_OPEN, PROFESSIONS_OPEN and
// MARKS_OPEN all are (PROF0 26: no switch of its own). Registered accounts
// alone, as the Stores are.
//
// ═══ ONE STATEMENT DECIDES, AND A REQUEST ASKED TWICE IS ONE ════════
//
// PROF1's law, whole: each act is one `db.batch` whose FIRST statement
// writes its row with a fresh nonce `n` only where every condition holds
// against the rows as they stand - the listing still open with the units,
// the buyer's Marks, the seller's room under the cap, the Stores' room -
// and every statement after it moves goods and Marks only where that row
// carries this request's nonce. The row is looked for BEFORE the switch
// (AUDIT 28 M2): a request that was made is answered, `repeat`.
//
// ═══ SETTLED ON READ ════════════════════════════════════════════════
//
// Nothing here runs on a clock. A listing past its 72 hours, an order past
// its seventh day, a courier's load that has arrived - each is settled on
// its owner's next read of the market, one row a batch (so a full Stores
// keeps one load waiting without refusing the rest), each keyed on its
// row's own id, so it happens once.
//
// ═══ THE LEDGER'S LINES (AUDIT 30 S1-S4) ════════════════════════════
//
// Every Marks line an act writes carries its OWN name in the one ledger's `(actor, rid)` namespace - the request id and
// a suffix no client id can hold (`:fee`, `:sale`, `:tax`, `:courier`, `:escrow`, `:fill`, `:filltax`) - and is a plain
// INSERT: a line that cannot be written (a clash, a balance its trigger would break) throws and rolls the whole act
// back, where INSERT OR IGNORE let the act stand with its Marks unmoved (and swallowed the trigger's CHECK). The rows
// that answer a repeat are pruned after 90 days (section 20) but the ledger is forever, so each decision also refuses
// a request whose first line the ledger already holds - a request id is spent once, whatever was pruned since.
//
// ═══ PROF5b: TIMED AUCTIONS (Professions-Arc 27) ════════════════════
//
// A Masterwork posted at an opening bid for 24 hours; each bid escrowed with its courier, 5% over the standing one,
// and a bid in the last two minutes adds two. An auction past its end is closed by the next market read of ANYONE
// (its seller, its winner and its outbid bidders each need it) - at most SETTLE_MAX a read, one batch each, keyed on
// its own nonce `cn`; an outbid bid's escrow comes back on its bidder's own read, under the Marks cap.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, mintId, overRate } from './accounts.js';
import { canModerate } from './titles.js';
import { marksOpenFor, balanceOf } from './marks.js';
import { boardOpenFor } from './board.js';
import { titheAt } from './seatHolding.js';   // SEAT1d: the bailiwick's Tithe
import { listingsCapAt } from './seatForts.js';   // SEAT2b: a Market Hall's listings
import { titheOf, TITHE_CAP } from '../../src/net/townSeatLaw.js';
import { marketHallTitheCap } from '../../src/net/fortLaw.js';
import { tideNow } from './tides.js';   // SEASON1 part two: a Bandit Summer's couriers (9.3)
import { tideCourier } from '../../src/net/tideLaw.js';
import { profOpenFor, spendStatements, spendOrigins, spendableSql, storeOf } from './professions.js';
import { REALM_ID_RE, realmActFirst, prepareRealmRecord, mustChange, dropIfUnnamed, recordMovedOf, dropObjects, realmHoldOf } from './realm.js';   // GOLD-MARKET
import { lawfulItem, itemWorth } from '../../src/systems/itemLaw.js';   // INT1: no piece the law cannot stand behind is listed; LW15: a patron's judge
import {
  patronHour, patronCands, patronHours, patronWorth, patronTakes, PATRON_HOUR_S, PATRON_TOWN_HOUR, PATRON_SELLER_HOUR, PATRON_SELLER_DAY_GOLD,
} from '../../src/net/patronLaw.js';   // LW15: the patrons
import { countedDb } from './metrics.js';   // AUDIT LW-II P5: a read's reckoning counted, as the cron's is
import { faucetStatement } from './budget.js';   // LW15: the service's own faucet, measured
import { ledgerKeyOf } from './judge.js';   // AUDIT LW-II-2 S2: a patron's piece's key in the ledger
import { escrowSpentSteps } from './ledger.js';   // AUDIT LW-II-2 S2: and the ledger told it is gone
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';   // GOLD-MARKET: a gold sale moves a realm record's gold
import { CHAR_ID_RE } from './service.js';
import { MARKS_MAX, MARK_WORTH_GOLD, utcDay } from '../../src/net/marksLaw.js';
import { STORES_MAX } from '../../src/net/professionLaw.js';
import { material, regionOk, WITNESS } from '../../src/net/nodeLaw.js';
import { recipeById, RECIPES } from '../../src/net/recipeLaw.js';
import {
  MARKET_LISTING_S, MARKET_ORDER_S, MARKET_ORDERS_MAX, MARKET_POSTS_MAX, MARKET_OPS_MAX, MARKET_WINDOW_S,
  MARKET_SHOWN, MARKET_HISTORY_SHOWN, MARKET_TRADES_SHOWN, MARKET_MEDIAN_DAYS, MARKET_KEEP_DAYS, MARKET_RID_RE, MARKET_ID_RE,
  MARKET_VIEWS, CRAFTED_FAMILIES, unitsOk, priceOk, wearOk, provenanceOk, listingFee, saleTaxOn, saleTithe, saleTitheOn, hubReport, hubPixelOk,
  MARKET_WORTH_MAX, UNYIELDED, pieceListable, MARKET_TAX_PCT, MARKET_TITHE_PCT,
  hubPixel, roadPixels, courierFee, courierSeconds, medianOf, medianLine, marketCatalogue,
  AUCTION_S, AUCTION_LATE_S, AUCTION_ADD_S, AUCTION_GRACE_S, bidOk, auctionNext, auctionable,
  currencyOk, goldSaleOf, MARKET_GOLD_HELD_MAX,
  goodRefusal, goodFamily, GOOD_GROUP_FAMILIES, MARKET_HELD_MAX,   // MARKET-ANY
  fillTaxOn,   // MARKET-AUDIT S2
} from '../../src/net/marketLaw.js';
import { MASTERWORK, PROVENANCE_RE } from '../../src/net/recipeLaw.js';
import { takeTradeGoods, giveTradeGoods } from '../../src/net/realmTradeLaw.js';   // MARKET-ANY: a piece out of one record and into another, as a trade moves it
import { vendorOf, VENDOR_STATION, VENDOR_LISTING_S, VENDOR_STOCK_SHOWN, VENDOR_STOCK_MAX, VENDOR_BOARD_SHOWN } from '../../src/net/vendorLaw.js';   // HOME-VENDOR: a home's trader

const DAY_S = 86_400;
/** GOLD-MARKET: the Stores origin of units bought in the row's own currency (a listing's or a sale's `currency`). */
const BOUGHT_ORIGIN_SQL = "CASE WHEN currency = 'gold' THEN 'gold' ELSE 'bought' END";
/** How far back "My listings" shows a closed listing or order, and "Your trades" reaches. */
const RECENT_S = 7 * DAY_S;
/** Rows one settle works, at most - a read settles the rest next time. */
export const SETTLE_MAX = 20;

/** Whether the market is open to this account: the board, the professions and the Marks, each at its switch. */
export function marketOpenFor(player, env) {
  return boardOpenFor(player, env) && profOpenFor(player, env) && marksOpenFor(player, env);
}
const charOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);
/** The first door: a registered account, its character, and (for an act) a request id. */
function asks(player, { character, rid, needRid = true, needChar = true }) {
  if (accountKind(player) !== 'linked') return { error: 'prof-need-account' };
  if (needChar && !charOk(character)) return { error: 'prof-character' };
  if (needRid && (typeof rid !== 'string' || !MARKET_RID_RE.test(rid))) return { error: 'prof-rid' };
  return null;
}
const shut = (player, env) => (marketOpenFor(player, env) ? null : { error: 'market-closed' });
/** HOME-VENDOR: a trader standing - the home's piece `?1`/`?2` (its town, its id), indoors, made the vendor station. The
 *  query joins it as `d` to its home `h`. */
const VENDOR_STANDS_SQL = `d.map_id = ?1 AND d.id = ?2 AND d.yard = 0 AND json_extract(d.place, '$.station') = '${VENDOR_STATION}'`;
const idOk = (id) => typeof id === 'string' && MARKET_ID_RE.test(id);
/** An account a week registered may witness (SEAT0 3.2), as a harvest's does. */
const witnessOf = (player, nowS) => (Number.isSafeInteger(player.registered_at) && player.registered_at <= nowS - WITNESS.ageS ? 1 : 0);

/** The hubs a request carries - `{ [region]: [x, y] }`, the client's own derivation - as a Map of region to pixel;
 *  anything out of shape is left out, never refused. */
function hubsOf(hubs) {
  const out = new Map();
  if (!hubs || typeof hubs !== 'object' || Array.isArray(hubs)) return out;
  for (const [k, v] of Object.entries(hubs).slice(0, 62)) {
    const r = Number(k);
    if (!regionOk(r) || !Array.isArray(v)) continue;
    const [x, y] = v;
    if (hubPixelOk(x, y)) out.set(r, { x, y });
  }
  return out;
}
/** THE ROADS' ENDS: each region's hub as the witnesses say it is, else as this client derived it (marketLaw hubPixel). */
async function hubsAt(db, regions, own) {
  const keys = [...new Set(regions)].map(String);
  const out = new Map();
  if (!keys.length) return out;
  const { results = [] } = await db.prepare(`SELECT key, account, report, at FROM world_witness WHERE kind = 'hub' AND key IN (${keys.map((_, i) => `?${i + 1}`).join(', ')})`)
    .bind(...keys).all();
  for (const k of keys) {
    const rows = results.filter((r) => r.key === k).map((r) => ({ account: r.account, report: r.report, at: Number(r.at) }));
    out.set(Number(k), hubPixel(rows, own.get(Number(k)) ?? null));
  }
  return out;
}
/** The courier between two regions: `{ courier, seconds, road }` - nothing on the same region, null with no road.
 *  SEASON1 part two: `slow` the Tide's factor on its seconds where it is bound (tideLaw.js tideCourier). */
function courierOf(hubs, from, to, units, slow = 1) {
  if (from === to) return { courier: 0, seconds: 0, road: 0 };
  const a = hubs.get(from), b = hubs.get(to);
  if (!a || !b) return null;
  const road = roadPixels(a, b);
  return { courier: courierFee(units, road), seconds: courierSeconds(road) * slow, road };
}
/** SEASON1 part two (9.3): a Bandit Summer where a courier is bound, while a Season is counted. */
const courierSlow = (env, nowS, to) => tideCourier(tideNow(env, nowS, to));
/** AUDIT 30 S3: whether the ledger already holds this account's line `rid` + `suffix` - a request id spent, though the
 *  row that would answer its repeat was pruned. */
const spent = async (db, me, rid, suffix) => !!(await db.prepare('SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2').bind(me, `${rid}${suffix}`).first());
/** The witness statements an act writes for the regions it names (SEAT0 3.2), each where its decision stands. */
function witnessStatements(db, player, nowS, regions, own, guardSql, guardBinds) {
  if (!witnessOf(player, nowS)) return [];
  const out = [];
  for (const r of new Set(regions)) {
    const px = own.get(r);
    if (!px) continue;
    out.push(db.prepare(`INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at)
      SELECT 'hub', ?1, ?2, ?3, ?4, ?5 WHERE ${guardSql}`).bind(String(r), player.id, hubReport(px.x, px.y), r, nowS, ...guardBinds));
  }
  return out;
}

// ─── WHAT A ROW LOOKS LIKE TO THE CLIENT ─────────────────────────────

const pieceOf = (p, wear) => (p ? {
  provenance: p.provenance, recipe: p.recipe, quality: Number(p.quality), seed: Number(p.seed), maker: p.maker ?? null,
  marked: Number(p.marked) === 1, template: Number(p.template), material: Number(p.material), wear: Number(wear),
  ...(p.dye == null ? {} : { dye: Number(p.dye) }),   // PROF7: a garment is the colour it was sewn in
  ...(p.hand == null ? {} : { hand: Number(p.hand) }),   // PROF9: a dish keeps its cook's hand (0069)
} : null);
/** AUDIT PROF-541 R2-S4: an auction's piece's recipe - its products row's, or, the piece disenchanted since (the row
 *  deleted), its disenchant's (prof_disenchants.provenance is UNIQUE: one look-up). `a` the auction, `p` its row. */
const GONE_RECIPE_SQL = 'COALESCE(p.recipe, (SELECT recipe FROM prof_disenchants WHERE provenance = a.provenance)) AS recipe';
/** MARKET-ANY: a piece from a pack, as its listing or its delivery carries it - its record, or null. */
const goodOf = (text) => {
  let v = null;
  try { v = typeof text === 'string' ? JSON.parse(text) : null; } catch { v = null; }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
};
// Only source-owned group names enter this SQL; the requested family remains a bound parameter.
// Guard malformed persisted JSON before extracting its group; goodOf still validates every returned record.
const goodSqlText = (value) => `'${value.replaceAll("'", "''")}'`;
const GOODS_FAMILY_SQL = `CASE WHEN json_valid(item) THEN CASE json_extract(item, '$.group')
  ${GOOD_GROUP_FAMILIES.map(([group, family]) => `WHEN ${goodSqlText(group)} THEN ${goodSqlText(family)}`).join(' ')}
  ELSE 'other' END ELSE NULL END`;
// Recipe families are source-owned. One JSON binding keeps filtering ahead of the row cutoff
// without spending one D1 parameter per recipe; truthy unsupported families retain their empty result.
const RECIPE_FAMILY_KEYS = new Map([...new Set(RECIPES.map((r) => r.family))]
  .map((family) => [family, JSON.stringify(RECIPES.filter((r) => r.family === family).map((r) => r.id))]));
const recipeFamilyKeys = (family) => family ? (RECIPE_FAMILY_KEYS.get(family) ?? '[]') : null;
function listingView(l, me, extra = {}) {
  return {
    id: l.id, kind: l.kind, region: Number(l.region), ...(l.material ? { material: l.material } : {}),
    ...(l.kind === 'item' ? { item: goodOf(l.item) } : {}),   // MARKET-ANY: the piece's record
    units: Number(l.own) + Number(l.bought), listed: Number(l.units), price: Number(l.price), fee: Number(l.fee),
    ...(l.wear != null ? { wear: Number(l.wear) } : {}), at: Number(l.at), expiresAt: Number(l.expires_at), state: l.state,
    currency: l.currency === 'gold' ? 'gold' : 'marks',   // GOLD-MARKET: what its price is in
    mine: l.seller === me, ...extra,
  };
}
/** PROF5b: an auction as the tab reads it - its standing bid (or none), the least next bid, its end. */
function auctionView(a, me, extra = {}) {
  const high = a.high == null ? null : Number(a.high);
  return {
    id: a.id, kind: 'auction', region: Number(a.region), opening: Number(a.opening), high, bids: Number(a.bids),
    next: auctionNext(high, Number(a.opening)), fee: Number(a.fee), wear: Number(a.wear), at: Number(a.at), endsAt: Number(a.ends_at),
    state: a.state, mine: a.seller === me, ...extra,
  };
}
const bidView = (b) => ({
  id: b.id, auction: b.auction, amount: Number(b.amount), courier: Number(b.courier), region: Number(b.region), state: b.state,
  returned: Number(b.returned) === 1, at: Number(b.at),
});
/** PROF5b: a sale's tax and Tithe off its whole, in SQL - `x`'s floor of hundredths, as saleTax and saleTithe are. */
const netSql = (x) => `${x} - (${x} * ${MARKET_TAX_PCT}) / 100 - (${x} * ${MARKET_TITHE_PCT}) / 100`;
/** AUDIT SCALE A1: the most any seat's Tithe can take of a sale - the crown's cap and a Market Hall's whole rise
 *  (townSeatLaw.js TITHE_CAP, fortLaw.js marketHallTitheCap) - and so the least a seller can be owed. */
export const TITHE_PCT_MOST = marketHallTitheCap(Math.max(...Object.values(TITHE_CAP)), Infinity);
const leastNetSql = (x) => `${x} - (${x} * ${MARKET_TAX_PCT}) / 100 - (${x} * ${TITHE_PCT_MOST}) / 100`;
/** SEAT1d: a board's town pixel as a request names it (`board: [x, y]`), or null - an older client's names none. */
const boardOf = (b) => (Array.isArray(b) && b.length === 2 && hubPixelOk(b[0], b[1]) ? [b[0], b[1]] : null);
/** SEAT1d: a row's board pixel (a listing's, an auction's), or null. */
const rowBoard = (r) => (r?.board_x == null ? null : [Number(r.board_x), Number(r.board_y)]);
/** SEAT1d (SEAT0 7.2): a Tithe line's end - the holder's Drake treasury where the guild stands and its cap takes it,
 *  else burnt (PROF0 18: "SEAT1 writes the Tithe's line (to the holder, or burnt)"). `g` the guild id's parameter, `amt`
 *  the amount's expression. */
const titheEnd = (g, amt) => `EXISTS (SELECT 1 FROM guilds WHERE id = ${g}) AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ${g}), 0) + ${amt} <= ${MARKS_MAX}`;
/** MARKET-AUDIT: a home's traders' stock an account (`?1`) stands - its own count (VENDOR_STOCK_MAX), never the board's
 *  thirty: "such a listing stands on no regional board" (vendorLaw.js), yet thirty pieces at a stall shut the board. */
const stallSalesSql = () => `(SELECT COUNT(*) FROM market_listings WHERE seller = ?1 AND state = 'open' AND vendor_id IS NOT NULL)`;
/** PROF5b: the open sales an account (`?1`) stands - its listings and its auctions (10.2's thirty are both); AUDIT 31
 *  L1: an auction past its end, a won one waiting on its seller's Marks cap, stands no longer - the moment at `now`. */
const openSalesSql = (now) => `((SELECT COUNT(*) FROM market_listings WHERE seller = ?1 AND state = 'open' AND vendor_id IS NULL)   -- MARKET-AUDIT: a trader's stock is its own count
  + (SELECT COUNT(*) FROM market_auctions WHERE seller = ?1 AND state = 'open' AND ends_at > ${now}))`;
const orderView = (o, me) => ({
  id: o.id, region: Number(o.region), material: o.material, units: Number(o.units), left: Number(o.left_units), price: Number(o.price),
  escrow: Number(o.escrow), at: Number(o.at), expiresAt: Number(o.expires_at), state: o.state, mine: o.poster === me,
});

// ─── SETTLED ON READ ─────────────────────────────────────────────────

/**
 * An account's own market, settled: its listings past their hours closed and their goods returned (a material's units
 * to the listing character's Stores where there is room, a piece a delivery to collect), its orders past their days
 * closed and their escrow returned (under the Marks cap), its couriers' loads that have arrived put in the Stores
 * (where there is room). One row a batch; SETTLE_MAX rows a read.
 */
async function settle(ctx, player) {
  const { db, nowS, rand } = ctx;
  const me = player.id;
  /** AUDIT 30 U1: the Stores this settle moved, `char_id|material`, so a read can answer them */
  const touched = new Set();
  // SCALE4b (2026-10-08): ASKED BEFORE IT IS WRITTEN. Both updates went on every market read, nearly always changing
  // nothing - two writes on the market's every look, which a read replica can never serve. One read says whether any
  // of the account's listings or orders is past its time; only then do the same two updates go, word for word (a race
  // that closes one meanwhile leaves its update nothing to change, as before).
  const due = await db.prepare(`SELECT EXISTS (SELECT 1 FROM market_listings WHERE seller = ?1 AND state = 'open' AND expires_at <= ?2)
      OR EXISTS (SELECT 1 FROM market_orders WHERE poster = ?1 AND state = 'open' AND expires_at <= ?2) AS due`).bind(me, nowS).first();
  if (Number(due?.due)) {
    await db.batch([
      db.prepare(`UPDATE market_listings SET state = 'expired', closed_at = ?2 WHERE seller = ?1 AND state = 'open' AND expires_at <= ?2`).bind(me, nowS),
      db.prepare(`UPDATE market_orders SET state = 'expired', closed_at = ?2 WHERE poster = ?1 AND state = 'open' AND expires_at <= ?2`).bind(me, nowS),
    ]);
  }
  // the listings' goods back
  // AUDIT 30 S7: only what can settle now - a return a full Stores cannot take waits without holding back the rest
  const { results: back = [] } = await db.prepare(`SELECT * FROM market_listings WHERE seller = ?1 AND state IN ('expired', 'removed') AND returned = 0
      AND (kind IN ('piece', 'item') OR COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = market_listings.seller AND char_id = market_listings.char_id
        AND material = market_listings.material), 0) + own + bought <= ?2)
    ORDER BY closed_at LIMIT ${SETTLE_MAX}`).bind(me, STORES_MAX).all();
  for (const l of back) {
    const nonce = mintId(rand);
    if (l.kind === 'item') {
      // MARKET-ANY: a piece from a pack back to its seller - a delivery its character's record collects (collectGood)
      await db.batch([
        db.prepare(`UPDATE market_listings SET returned = 1, rn = ?2 WHERE id = ?1 AND returned = 0`).bind(l.id, nonce),
        db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, item, why, from_region, arrives_at, at)
          SELECT id, seller, char_id, item, 'returned', region, ?2, ?2 FROM market_listings WHERE id = ?1 AND rn = ?3 AND kind = 'item'`).bind(l.id, nowS, nonce),
      ]);
      continue;
    }
    if (l.kind === 'piece') {
      await db.batch([
        db.prepare(`UPDATE market_listings SET returned = 1, rn = ?2 WHERE id = ?1 AND returned = 0`).bind(l.id, nonce),
        db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
          SELECT id, seller, char_id, provenance, wear, 'returned', region, ?2, ?2 FROM market_listings WHERE id = ?1 AND rn = ?3`).bind(l.id, nowS, nonce),
        db.prepare(`UPDATE products SET listed = 0 WHERE provenance = (SELECT provenance FROM market_listings WHERE id = ?1 AND rn = ?2)`).bind(l.id, nonce),
      ]);
      continue;
    }
    await db.batch([
      db.prepare(`UPDATE market_listings SET returned = 1, rn = ?2 WHERE id = ?1 AND returned = 0
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = market_listings.seller AND char_id = market_listings.char_id AND material = market_listings.material), 0)
          + own + bought <= ?3`).bind(l.id, nonce, STORES_MAX),
      ...backToStores(db, l.id, nonce),
    ]);
    touched.add(`${l.char_id}|${l.material}`);
  }
  // PROF5b: an unsold or removed auction's piece back to its seller, a delivery to collect
  const { results: unsold = [] } = await db.prepare(`SELECT id FROM market_auctions WHERE seller = ?1 AND state IN ('unsold', 'removed') AND returned = 0
    ORDER BY closed_at LIMIT ${SETTLE_MAX}`).bind(me).all();
  for (const a of unsold) {
    const nonce = mintId(rand);
    await db.batch([
      db.prepare(`UPDATE market_auctions SET returned = 1, rn = ?2 WHERE id = ?1 AND returned = 0 AND state IN ('unsold', 'removed')`).bind(a.id, nonce),
      db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
        SELECT id, seller, char_id, provenance, wear, 'returned', region, ?2, ?2 FROM market_auctions WHERE id = ?1 AND rn = ?3`).bind(a.id, nowS, nonce),
      db.prepare(`UPDATE products SET listed = 0 WHERE provenance = (SELECT provenance FROM market_auctions WHERE id = ?1 AND rn = ?2)`).bind(a.id, nonce),
    ]);
  }
  // PROF5b: an outbid bid's escrow (or a removed auction's) back to its bidder, under the Marks cap - one line keyed on
  // the bid's own id, so it happens once
  const { results: outbid = [] } = await db.prepare(`SELECT id FROM market_bids WHERE bidder = ?1 AND state IN ('outbid', 'void') AND returned = 0
      AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + amount + courier <= ?2
    ORDER BY at LIMIT ${SETTLE_MAX}`).bind(me, MARKS_MAX).all();
  for (const b of outbid) {
    await db.batch([
      db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'escrow', id, 'account', bidder, 'bid-return', amount + courier, ?2, ?3, bidder, auction, 'bid-return:' || id FROM market_bids
        WHERE id = ?1 AND state IN ('outbid', 'void') AND returned = 0
          AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = market_bids.bidder AND rid = 'bid-return:' || ?1)
          AND COALESCE((SELECT balance FROM marks WHERE account = market_bids.bidder), 0) + amount + courier <= ?4`).bind(b.id, utcDay(nowS), nowS, MARKS_MAX),
      db.prepare(`UPDATE market_bids SET returned = 1 WHERE id = ?1 AND returned = 0
        AND EXISTS (SELECT 1 FROM marks_ledger WHERE actor = market_bids.bidder AND rid = 'bid-return:' || ?1)`).bind(b.id),
    ]);
  }
  // the orders' escrow back
  const { results: shutOrders = [] } = await db.prepare(`SELECT id FROM market_orders WHERE poster = ?1 AND state != 'open' AND returned = 0
      AND (escrow = 0 OR COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + escrow <= ?2)
    ORDER BY closed_at LIMIT ${SETTLE_MAX}`).bind(me, MARKS_MAX).all();
  for (const o of shutOrders) await db.batch(orderReturn(db, o.id, nowS));
  // the couriers' loads that have arrived
  const { results: loads = [] } = await db.prepare(`SELECT rid, char_id, material FROM market_sales WHERE buyer = ?1 AND kind = 'material' AND delivered = 0 AND arrives_at <= ?2
      AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = market_sales.char_id AND material = market_sales.material), 0) + units <= ?3
    ORDER BY arrives_at LIMIT ${SETTLE_MAX}`).bind(me, nowS, STORES_MAX).all();
  for (const s of loads) {
    const nonce = mintId(rand);
    await db.batch([
      db.prepare(`UPDATE market_sales SET delivered = 1, dn = ?3 WHERE buyer = ?1 AND rid = ?2 AND delivered = 0
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = market_sales.char_id AND material = market_sales.material), 0) + units <= ?4`)
        .bind(me, s.rid, nonce, STORES_MAX),
      db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
        SELECT buyer, char_id, material, ${BOUGHT_ORIGIN_SQL}, units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND dn = ?3
        ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, s.rid, nonce),
    ]);
    touched.add(`${s.char_id}|${s.material}`);
  }
  return touched;
}
/**
 * PROF5b: THE AUCTIONS PAST THEIR END, closed - anyone's read runs it (the seller, the winner and the outbid bidders
 * each need it). Sold: the winner's escrow pays the seller the bid less its tax, the tax and the courier burnt, the
 * piece's owner moved and the winner's delivery written (at once from the auction's region, else after the courier's
 * time). Unsold: closed, its piece back on its seller's read. A sale the seller's Marks cap cannot take waits -
 * AUDIT 31 S3: AUCTION_GRACE_S at most, then the winning bid is void (its escrow back on its bidder's read) and the
 * auction closes unsold. AUDIT 31 S1: a standing bid whose row is gone (its bidder's account deleted - no route does
 * it, Professions-Arc 18) closes it unsold too, never a sale to no one: the owner written NULL failed every read after.
 */
export async function closeAuctions(ctx) {
  const { db, nowS, rand } = ctx;
  const live = (a) => `EXISTS (SELECT 1 FROM market_bids WHERE id = ${a}.high_bid AND state = 'high')`;
  const balance = (a) => `COALESCE((SELECT balance FROM marks WHERE account = ${a}.seller), 0)`;
  // AUDIT SCALE A1: THE SELLER'S ROOM IS DECIDED HERE, AFTER THE SEAT'S TITHE, BY THE `gets` BOTH DECISIONS GUARD ON. It
  // was decided in this SELECT by the Tithe-free proceeds (netSql's MARKET_TITHE_PCT is 0), while the decisions guard on
  // the proceeds less the seat's real Tithe - so a won auction under a Tithe, its seller within the Tithe of the Marks
  // cap, waited out the whole grace though the sale fitted, and then was picked every time and closed by neither: the
  // unsold close saw the room the SELECT had denied. Twenty of them held the page, and no auction after them closed.
  // The candidates now are every auction that COULD close - unbid, past the grace, or with room at the least any Tithe
  // could leave (TITHE_PCT_MOST) - the surely closable first, so one that turns out to wait never holds the page.
  const { results: due = [] } = await db.prepare(`SELECT id, high, region, board_x, board_y, ends_at, ${live('a')} AS live, ${balance('a')} AS balance FROM market_auctions a
      WHERE state = 'open' AND ends_at <= ?1
        AND (NOT ${live('a')} OR ${balance('a')} + ${leastNetSql('high')} <= ?2 OR ends_at + ?3 <= ?1)
    ORDER BY (NOT ${live('a')} OR ${balance('a')} + ${netSql('high')} <= ?2 OR ends_at + ?3 <= ?1) DESC, ends_at LIMIT ${SETTLE_MAX}`).bind(nowS, MARKS_MAX, AUCTION_GRACE_S).all();
  const day = utcDay(nowS);
  let closed = 0;
  for (const a of due) {
    if (ctx.budget && !ctx.budget()) break;   // SCALE4b / AUDIT SCALE A2: the clock's firing keeps under D1's statements an invocation
    const nonce = mintId(rand);
    const high = a.high == null ? null : Number(a.high);
    // SEAT1d: the Tithe of the seat the auction's board belongs to, from the seller's proceeds
    const tt = high == null ? null : await titheAt(db, nowS, Number(a.region), rowBoard(a));
    const tithe = tt ? saleTithe(high, tt.pct) : 0;
    const tax = high == null ? 0 : saleTaxOn(0, high), gets = high == null ? 0 : high - tax - tithe;
    const room = Number(a.balance) + gets <= MARKS_MAX;
    // a sale the cap cannot take yet, inside its grace: it waits, and nothing is written
    if (Number(a.live) && !room && Number(a.ends_at) + AUCTION_GRACE_S > nowS) continue;
    // the winning bid, once this close marked it won (the second statement) - every line and the owner keyed on it
    const won = `FROM market_auctions a JOIN market_bids b ON b.id = a.high_bid AND b.state = 'won' WHERE a.id = ?1 AND a.cn = ?2`;
    if (!Number(a.live) || !room) {
      const out = await db.batch([
        // THE DECISION: still open, past its end, the standing bid the one read - none, or gone, or one the seller's cap
        // has not taken in the grace
        db.prepare(`UPDATE market_auctions SET state = 'unsold', closed_at = ?3, cn = ?2, returned = 0
          WHERE id = ?1 AND state = 'open' AND ends_at <= ?3 AND high IS ?4
            AND (NOT ${live('market_auctions')} OR (ends_at + ?5 <= ?3
              AND COALESCE((SELECT balance FROM marks WHERE account = market_auctions.seller), 0) + ?6 > ?7))`)
          .bind(a.id, nonce, nowS, high, AUCTION_GRACE_S, gets, MARKS_MAX),
        // the winning bid void - its escrow back on its bidder's read (settle's)
        db.prepare(`UPDATE market_bids SET state = 'void' WHERE id = (SELECT high_bid FROM market_auctions WHERE id = ?1 AND cn = ?2) AND state = 'high'`)
          .bind(a.id, nonce),
      ]);
      closed += Number(out?.[0]?.meta?.changes ?? 0);
      continue;
    }
    const sold = await db.batch([
      // THE DECISION: still open, past its end, the standing bid the one read and standing, the seller's room under the cap
      db.prepare(`UPDATE market_auctions SET state = 'sold', closed_at = ?3, cn = ?2, returned = 1, tithe = ?7
        WHERE id = ?1 AND state = 'open' AND ends_at <= ?3 AND high IS ?4 AND ${live('market_auctions')}
          AND COALESCE((SELECT balance FROM marks WHERE account = market_auctions.seller), 0) + ?5 <= ?6`)
        .bind(a.id, nonce, nowS, high, gets, MARKS_MAX, tithe),
      db.prepare(`UPDATE market_bids SET state = 'won' WHERE id = (SELECT high_bid FROM market_auctions WHERE id = ?1 AND cn = ?2) AND state = 'high'`).bind(a.id, nonce),
      db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'escrow', b.id, 'account', a.seller, 'auction-sale', ?3, ?4, ?5, b.bidder, a.id, 'auction:' || a.id || ':sale' ${won}`)
        .bind(a.id, nonce, gets, day, nowS),
      ...(tax > 0 ? [db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'escrow', b.id, 'burn', NULL, 'market-tax', ?3, ?4, ?5, b.bidder, a.id, 'auction:' || a.id || ':tax' ${won}`)
        .bind(a.id, nonce, tax, day, nowS)] : []),
      // SEAT1d: the Tithe to the auction's seat's holder - or burnt
      ...(tithe > 0 ? [db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'escrow', b.id, CASE WHEN ${titheEnd('?6', '?3')} THEN 'guild' ELSE 'burn' END, CASE WHEN ${titheEnd('?6', '?3')} THEN ?6 END,
          'tithe', ?3, ?4, ?5, b.bidder, a.id, 'auction:' || a.id || ':tithe' ${won}`)
        .bind(a.id, nonce, tithe, day, nowS, tt.guild)] : []),
      db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'escrow', b.id, 'burn', NULL, 'courier', b.courier, ?3, ?4, b.bidder, a.id, 'auction:' || a.id || ':courier' ${won} AND b.courier > 0`)
        .bind(a.id, nonce, day, nowS),
      // the owner moved only to a bid that won - never to no one
      db.prepare(`UPDATE products SET owner = (SELECT b.bidder ${won}), credited = 0, listed = 0, bought_with = 'marks'   -- GOLD-MARKET: won with Drakes
        WHERE provenance = (SELECT provenance FROM market_auctions WHERE id = ?1 AND cn = ?2)
          AND EXISTS (SELECT 1 ${won})`).bind(a.id, nonce),
      db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
        SELECT ?3, b.bidder, b.char_id, a.provenance, a.wear, 'bought', a.region, ?4 + b.seconds, ?4 ${won}`)
        .bind(a.id, nonce, mintId(rand), nowS),
    ]);
    closed += Number(sold?.[0]?.meta?.changes ?? 0);
  }
  // SCALE4b: the service's clock asks again while a full page closed. AUDIT SCALE A2: the auctions CLOSED - the
  // decisions' own changes - never the ones picked: a page picked and not closed (A1's) was asked again every round,
  // twenty-five rounds a minute
  return closed;
}
/**
 * THE MARKET'S HISTORY KEPT MARKET_KEEP_DAYS (section 20: 90 days) - every price and fill past it, and every listing,
 * order, delivery, bid and auction long closed and settled (and, LW15, every patron's sale). SCALE4b (2026-10-08): the
 * service's clock's (server-account/src/cron.js, each hour); the History view pruned first, nine writes on a read. AUDIT
 * SCALE A5: each table's delete takes `rows` at most, and the clock asks again while one took a full page - one
 * unbounded batch, a backlog's worth, could outrun D1's thirty seconds a batch, roll back, and only grow (the auctions'
 * delete walked every bid for each auction it took, until 0091 indexed market_bids by its auction). Answers
 * `{ changed, full }`.
 * @param {any} db @param {number} nowS @param {number} rows
 */
export async function pruneMarketHistory(db, nowS, rows) {
  const keepFrom = utcDay(nowS) - MARKET_KEEP_DAYS;
  const bounded = (/** @type {string} */ table, /** @type {string} */ where, /** @type {number} */ cutoff) =>
    db.prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${where} LIMIT ?2)`).bind(cutoff, rows);
  const out = await db.batch([
    bounded('market_prices', 'day < ?1', keepFrom),
    bounded('market_gold_prices', 'day < ?1', keepFrom),   // GOLD-MARKET
    bounded('market_sales', 'day < ?1 AND delivered = 1', keepFrom),
    bounded('market_fills', 'day < ?1', keepFrom),
    bounded('market_listings', "state != 'open' AND closed_at < ?1 AND (returned = 1 OR state = 'sold')", keepFrom * DAY_S),
    bounded('market_orders', "state != 'open' AND closed_at < ?1 AND returned = 1", keepFrom * DAY_S),
    bounded('market_deliveries', 'collected = 1 AND at < ?1', keepFrom * DAY_S),
    // PROF5b: a closed auction's settled bids, then the auction itself once nothing of it waits (its ids stay spent -
    // AUDIT 30 S3: every decision asks the ledger)
    bounded('market_bids', "at < ?1 AND state != 'high' AND (returned = 1 OR state = 'won')", keepFrom * DAY_S),
    bounded('market_auctions', `state != 'open' AND closed_at < ?1 AND returned = 1
      AND NOT EXISTS (SELECT 1 FROM market_bids WHERE auction = market_auctions.id)`, keepFrom * DAY_S),
    // AUDIT LW-II P6: a patron's sale, kept as its listing is (the Vendor page reads it beside its listing) - kept for
    // ever, and the region's read of its last day walked them all
    bounded('market_patron_sales', 'day < ?1', keepFrom),
  ]);
  const changes = out.map((/** @type {any} */ r) => Number(r?.meta?.changes ?? 0));
  return { changed: changes.reduce((n, c) => n + c, 0), full: changes.some((c) => c >= rows) };
}

/** A closed listing's units back into its character's Stores, each with its origin - where its return carries `nonce`. */
function backToStores(db, id, nonce) {
  // GOLD-MARKET: a gold listing's `bought` column holds its gold units - they go back as gold's
  return ['own', 'bought'].map((col) => db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT seller, char_id, material, ${col === 'own' ? "'own'" : BOUGHT_ORIGIN_SQL}, ${col} FROM market_listings WHERE id = ?1 AND rn = ?2 AND kind = 'material' AND ${col} > 0
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(id, nonce));
}
/** What is left of a closed order's escrow back to its poster - one line keyed on the order's own id, under the Marks
 *  cap (else it waits) - then the order marked returned. */
function orderReturn(db, id, nowS) {
  return [
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', id, 'account', poster, 'order-return', escrow, ?2, ?3, poster, material, 'order-close:' || id FROM market_orders
      WHERE id = ?1 AND state != 'open' AND returned = 0 AND escrow > 0
        AND COALESCE((SELECT balance FROM marks WHERE account = market_orders.poster), 0) + escrow <= ?4`).bind(id, utcDay(nowS), nowS, MARKS_MAX),
    db.prepare(`UPDATE market_orders SET escrow = 0, returned = 1 WHERE id = ?1 AND state != 'open' AND returned = 0
      AND (escrow = 0 OR EXISTS (SELECT 1 FROM marks_ledger WHERE actor = market_orders.poster AND rid = 'order-close:' || ?1))`).bind(id),
  ];
}
/** What is on its way to this account: couriers' loads not yet in the Stores and pieces not yet collected. */
async function roadOf(db, me, nowS) {
  const { results: loads = [] } = await db.prepare(`SELECT rid, char_id, material, units, from_region, arrives_at FROM market_sales
    WHERE buyer = ?1 AND kind = 'material' AND delivered = 0 ORDER BY arrives_at LIMIT 50`).bind(me).all();
  const { results: pieces = [] } = await db.prepare(`SELECT d.id, d.char_id, d.wear, d.why, d.from_region, d.arrives_at, p.recipe, p.quality, p.seed, p.maker, p.marked, p.dye, p.hand,
    p.template, p.material, p.provenance FROM market_deliveries d JOIN products p ON p.provenance = d.provenance
    WHERE d.player = ?1 AND d.collected = 0 ORDER BY d.arrives_at LIMIT 50`).bind(me).all();
  // MARKET-ANY: and pieces from packs, bought or come back - each its record
  const { results: goods = [] } = await db.prepare(`SELECT id, char_id, why, from_region, arrives_at, item FROM market_deliveries
    WHERE player = ?1 AND collected = 0 AND item IS NOT NULL ORDER BY arrives_at LIMIT 50`).bind(me).all();
  return [
    ...loads.map((s) => ({ kind: 'material', id: s.rid, character: s.char_id, material: s.material, units: Number(s.units), from: Number(s.from_region),
      arrivesAt: Number(s.arrives_at), waiting: Number(s.arrives_at) <= nowS })),
    ...pieces.map((d) => ({ kind: 'piece', id: d.id, character: d.char_id, why: d.why, from: d.from_region == null ? null : Number(d.from_region),
      arrivesAt: Number(d.arrives_at), ready: Number(d.arrives_at) <= nowS, piece: pieceOf(d, d.wear) })),
    ...goods.map((d) => ({ kind: 'item', id: d.id, character: d.char_id, why: d.why, from: d.from_region == null ? null : Number(d.from_region),
      arrivesAt: Number(d.arrives_at), ready: Number(d.arrives_at) <= nowS, item: goodOf(d.item) })),
  ];
}

// ─── THE READ ────────────────────────────────────────────────────────

/**
 * MARKET-ANY: THE CRAFTED PIECES A TAB HOLDS (`pieces`, their provenance ids - at most MARKET_HELD_MAX, the rest unsaid),
 * each as the counting-house sees it, so the List form offers each its own way (AUDIT 30 U13: what must fail is not
 * offered): `yours` - its record names this account and it stands nowhere else: it lists as a crafted piece; `other` -
 * its record names another (a trade, a shelf, a room's container or a looted body moved the piece, never its record):
 * only that owner sells it as a crafted piece, and it lists from the pack, for gold; `elsewhere` - this account's, but on
 * the market, on the road or standing in a home: the save's is a copy and lists neither way; `none` - no record at all.
 */
async function pieceWays(db, me, pieces) {
  const ids = Array.isArray(pieces) ? [...new Set(pieces.filter((p) => typeof p === 'string' && PROVENANCE_RE.test(p)))].slice(0, MARKET_HELD_MAX) : [];
  if (!ids.length) return {};
  const { results: rows = [] } = await db.prepare(`SELECT p.provenance, p.owner, p.listed,
      EXISTS (SELECT 1 FROM market_deliveries d WHERE d.provenance = p.provenance AND d.collected = 0) AS road,
      EXISTS (SELECT 1 FROM home_decor h WHERE json_extract(h.item, '$.pv') = p.provenance) AS standing
    FROM products p WHERE p.provenance IN (SELECT value FROM json_each(?1))`).bind(JSON.stringify(ids)).all();   // SCALE1: one bound array
  const out = Object.fromEntries(ids.map((p) => [p, 'none']));
  for (const r of rows) out[r.provenance] = r.owner !== me ? 'other' : (Number(r.listed) || Number(r.road) || Number(r.standing)) ? 'elsewhere' : 'yours';
  return out;
}

/** The medians and lines of `keys` over the last MARKET_MEDIAN_DAYS UTC days (10.2): a Map of key to { median, line }. */
async function mediansOf(db, keys, today, currency = 'marks') {
  const out = new Map();
  if (!keys.length) return out;
  const table = currency === 'gold' ? 'market_gold_prices' : 'market_prices';   // GOLD-MARKET: gold's own history, never the Drakes'
  // SCALE1: the keys as ONE bound JSON array (json_each) - a view's hundred materials bound one each were 101
  // parameters, past the 100 D1 takes in one statement (node:sqlite, the pins' database, takes 32766)
  const { results = [] } = await db.prepare(`SELECT day, material, price, units FROM ${table} WHERE day > ?1 AND material IN
    (SELECT value FROM json_each(?2))`).bind(today - MARKET_MEDIAN_DAYS, JSON.stringify(keys)).all();
  for (const k of keys) {
    const rows = results.filter((r) => r.material === k).map((r) => ({ day: Number(r.day), price: Number(r.price), units: Number(r.units) }));
    out.set(k, { median: medianOf(rows), line: medianLine(rows, today) });
  }
  return out;
}

/**
 * THE MARKET TAB: `{ character, region, view, family?, tier?, material?, hubs? }` - the board's region and one of its
 * views (marketLaw MARKET_VIEWS), after the account's own market is settled. Every answer carries what is on its way
 * to the account, its balance and its live counts.
 */
export async function marketRead(ctx, player, env, { character, region, view, family = null, tier = null, material: key = null, materials = null, hubs, currency = 'marks', pieces = null, board = null } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { character, needRid: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!MARKET_VIEWS.some(([v]) => v === view)) return { error: 'bad-act' };
  if (!currencyOk(currency)) return { error: 'bad-act' };   // GOLD-MARKET: the Materials and Crafted views show one currency at a time
  await closeAuctions(ctx);   // PROF5b: every reader's - the auctions past their end, anyone's
  const touched = await settle(ctx, player);
  const me = player.id;
  const today = utcDay(nowS);
  const own = hubsOf(hubs);
  const moderator = canModerate(player, env);
  // AUDIT 30 U1: this character's Stores the settle moved, answered so the pages read them
  const stores = [];
  for (const t of touched) {
    const [c, m] = t.split('|');
    if (c === character) stores.push(await storeOf(db, me, c, m));
  }
  const base = async () => {
    // PROF5b: an open auction is among the thirty; the bids standing, and what every bid not yet back holds
    const counts = await db.prepare(`SELECT ${openSalesSql('?2')} AS listings,
        (SELECT COUNT(*) FROM market_orders WHERE poster = ?1 AND state = 'open') AS orders,
        (SELECT COUNT(*) FROM market_bids WHERE bidder = ?1 AND state = 'high') AS bids,
        (SELECT COALESCE(SUM(amount + courier), 0) FROM market_bids WHERE bidder = ?1 AND (state = 'high' OR (state IN ('outbid', 'void') AND returned = 0))) AS held`)
      .bind(me, nowS).first();
    // GOLD-MARKET: the gold this character's sales hold for it, to collect
    const gold = await db.prepare('SELECT gold FROM market_gold WHERE player = ?1 AND char_id = ?2').bind(me, character).first();
    return {
      ok: true, view, region, currency, road: await roadOf(db, me, nowS), balance: await balanceOf(db, me),
      counts: { listings: Number(counts?.listings ?? 0), orders: Number(counts?.orders ?? 0), bids: Number(counts?.bids ?? 0) },
      // AUDIT SEATS-3 D2: the open listings this account may hold at the board read from (`board`, its map pixel, as the
      // post's), a Market Hall's quarter a tier in it - the count's measure, so the board never says thirty where it lists more
      listingsMax: await listingsCapAt(db, nowS, boardOf(board)),
      held: Number(counts?.held ?? 0), stores, goldHeld: Number(gold?.gold ?? 0),
    };
  };
  const reportsOf = async (ids) => {
    if (!moderator || !ids.length) return new Map();
    const { results = [] } = await db.prepare(`SELECT listing, COUNT(*) AS n FROM market_reports WHERE listing IN (${ids.map((_, i) => `?${i + 1}`).join(', ')}) GROUP BY listing`)
      .bind(...ids).all();
    return new Map(results.map((r) => [r.listing, Number(r.n)]));
  };
  const quote = async (rows, unitsOf) => {
    const at = await hubsAt(db, [region, ...rows.map((l) => Number(l.region))], own);
    return rows.map((l) => courierOf(at, Number(l.region), region, unitsOf(l), courierSlow(env, nowS, region)));
  };

  if (view === 'materials') {
    // AUDIT 30 U2: the materials asked for chosen in the query itself - one, a search's matches, or a family's and a
    // tier's - so a rare material is never lost behind the five hundred cheapest of everything else
    const keys = key ? [key]
      : Array.isArray(materials) ? materials.filter((k) => typeof k === 'string' && material(k)).slice(0, 120)
        : (family || tier) ? marketCatalogue().filter((c) => (!family || c.family === family) && (!tier || c.tier === tier)).map((c) => c.key)
          : null;
    if (keys && !keys.length) return { ...(await base()), rows: [], medians: {} };
    // GOLD-MARKET: one currency a view - a gold price and a Drakes price sort nothing together
    // MARKET-AUDIT: the Bay's cheapest listed AND this board's own region's - a hundred cheaper listings elsewhere hid the
    // ones here, which may be the cheapest landed (the tab sorts by the courier's share)
    const listedSql = (local) => `SELECT * FROM market_listings WHERE state = 'open' AND kind = 'material' AND expires_at > ?1 AND currency = '${currency}'
      ${keys ? 'AND material IN (SELECT value FROM json_each(?2))' : ''} ${local ? `AND region = ?${keys ? 3 : 2}` : ''} ORDER BY price, at LIMIT ${local ? MARKET_SHOWN / 2 : MARKET_SHOWN}`;
    const binds = [nowS, ...(keys ? [JSON.stringify(keys)] : [])];   // SCALE1: one bound array - a search's 120 were 121 parameters
    const { results: bay = [] } = await db.prepare(listedSql(false)).bind(...binds).all();
    const { results: home = [] } = await db.prepare(listedSql(true)).bind(...binds, region).all();
    const results = [...new Map([...bay, ...home].map((l) => [l.id, l])).values()];
    const rows = results.filter((l) => material(l.material));
    const quotes = await quote(rows, (l) => Number(l.own) + Number(l.bought));
    const medians = await mediansOf(db, [...new Set(rows.map((l) => l.material))], today, currency);
    const reports = await reportsOf(rows.map((l) => l.id));
    return {
      ...(await base()),
      rows: rows.map((l, i) => listingView(l, me, { road: quotes[i], ...(moderator ? { reports: reports.get(l.id) ?? 0 } : {}) })),
      medians: Object.fromEntries([...medians].map(([k, v]) => [k, v])),
    };
  }
  if (view === 'crafted') {
    const { results = [] } = await db.prepare(`SELECT l.*, p.recipe, p.quality, p.seed, p.maker, p.marked, p.dye, p.hand, p.template, p.material AS dfu_material
      FROM market_listings l JOIN products p ON p.provenance = l.provenance
      WHERE l.state = 'open' AND l.kind = 'piece' AND l.expires_at > ?1 AND l.currency = '${currency}'
        AND (?2 IS NULL OR p.recipe IN (SELECT value FROM json_each(?2)))
      ORDER BY l.price, l.at LIMIT 500`).bind(nowS, recipeFamilyKeys(family)).all();   // GOLD-MARKET
    const famOk = (f) => !family || f === family;
    const rows = results.filter((l) => famOk(recipeById(l.recipe)?.family ?? null) && CRAFTED_FAMILIES.some(([f]) => f === recipeById(l.recipe)?.family))
      .slice(0, MARKET_SHOWN);
    const quotes = await quote(rows, () => 1);
    const reports = await reportsOf(rows.map((l) => l.id));
    return {
      ...(await base()),
      rows: rows.map((l, i) => listingView(l, me, {
        road: quotes[i], piece: pieceOf({ ...l, material: l.dfu_material }, l.wear), ...(moderator ? { reports: reports.get(l.id) ?? 0 } : {}),
      })),
    };
  }
  if (view === 'goods') {
    // MARKET-ANY: every piece listed from a pack, cheapest first, each with its courier to this board - for gold alone
    // Legacy truthy non-string filters match nothing; never pass their objects/arrays to a D1 binding.
    const familyFilter = family ? (typeof family === 'string' ? family : '') : null;
    const { results = [] } = await db.prepare(`SELECT * FROM market_listings WHERE state = 'open' AND kind = 'item' AND expires_at > ?1
      AND (?2 IS NULL OR (${GOODS_FAMILY_SQL}) = ?2)
      AND vendor_id IS NULL ORDER BY price, at LIMIT 500`).bind(nowS, familyFilter).all();   // HOME-VENDOR: a trader's stock stands at it alone
    const rows = results.filter((l) => { const it = goodOf(l.item); return !!it && (!family || goodFamily(it) === family); }).slice(0, MARKET_SHOWN);
    const quotes = await quote(rows, () => 1);
    const reports = await reportsOf(rows.map((l) => l.id));
    return { ...(await base()), rows: rows.map((l, i) => listingView(l, me, { road: quotes[i], ...(moderator ? { reports: reports.get(l.id) ?? 0 } : {}) })) };
  }
  if (view === 'auctions') {
    // PROF5b: every open auction, ending soonest first, each with its courier to this board (one piece)
    const { results = [] } = await db.prepare(`SELECT a.*, p.recipe, p.quality, p.seed, p.maker, p.marked, p.dye, p.hand, p.template, p.material AS dfu_material,
        (SELECT bidder FROM market_bids WHERE id = a.high_bid) AS high_bidder
      FROM market_auctions a JOIN products p ON p.provenance = a.provenance
      WHERE a.state = 'open' AND a.ends_at > ?1
        AND (?2 IS NULL OR p.recipe IN (SELECT value FROM json_each(?2)))
      ORDER BY a.ends_at, a.at LIMIT 500`).bind(nowS, recipeFamilyKeys(family)).all();
    const famOk = (f) => !family || f === family;
    const rows = results.filter((a) => famOk(recipeById(a.recipe)?.family ?? null)).slice(0, MARKET_SHOWN);
    const quotes = await quote(rows, () => 1);
    const reported = new Map();
    if (moderator && rows.length) {
      const { results: rr = [] } = await db.prepare(`SELECT auction, COUNT(*) AS n FROM market_auction_reports WHERE auction IN (${rows.map((_, i) => `?${i + 1}`).join(', ')})
        GROUP BY auction`).bind(...rows.map((a) => a.id)).all();
      for (const r of rr) reported.set(r.auction, Number(r.n));
    }
    return {
      ...(await base()),
      rows: rows.map((a, i) => auctionView(a, me, {
        road: quotes[i], piece: pieceOf({ ...a, material: a.dfu_material }, a.wear), leading: a.high_bidder === me,
        ...(moderator ? { reports: reported.get(a.id) ?? 0 } : {}),
      })),
    };
  }
  if (view === 'mine') {
    const { results: listings = [] } = await db.prepare(`SELECT l.*, p.recipe, p.quality, p.seed, p.maker, p.marked, p.dye, p.hand, p.template, p.material AS dfu_material
      FROM market_listings l LEFT JOIN products p ON p.provenance = l.provenance
      WHERE l.seller = ?1 AND (l.state = 'open' OR l.closed_at > ?2) ORDER BY l.state = 'open' DESC, l.at DESC LIMIT ${MARKET_SHOWN}`)
      .bind(me, nowS - RECENT_S).all();
    const { results: orders = [] } = await db.prepare(`SELECT * FROM market_orders WHERE poster = ?1 AND (state = 'open' OR closed_at > ?2)
      ORDER BY state = 'open' DESC, at DESC LIMIT ${MARKET_SHOWN}`).bind(me, nowS - RECENT_S).all();
    // PROF5b: this account's auctions and its bids (the standing ones, and a week of the rest), each with its piece -
    // AUDIT PROF-541 R2-S4: its row LEFT joined, as the listings' are: a piece disenchanted since (its products row
    // deleted - alchemy.js disenchantPiece) keeps its history, named by its disenchant's recipe
    const { results: auctions = [] } = await db.prepare(`SELECT a.*, ${GONE_RECIPE_SQL}, p.quality, p.seed, p.maker, p.marked, p.dye, p.hand, p.template, p.material AS dfu_material
      FROM market_auctions a LEFT JOIN products p ON p.provenance = a.provenance
      WHERE a.seller = ?1 AND (a.state = 'open' OR a.closed_at > ?2) ORDER BY a.state = 'open' DESC, a.at DESC LIMIT ${MARKET_SHOWN}`).bind(me, nowS - RECENT_S).all();
    const { results: bids = [] } = await db.prepare(`SELECT b.*, a.state AS auction_state, a.ends_at, a.high, a.opening, a.bids AS count, a.region AS auction_region,
        a.wear, ${GONE_RECIPE_SQL}, p.quality, p.seed, p.maker, p.marked, p.dye, p.hand, p.template, p.material AS dfu_material, a.provenance
      FROM market_bids b JOIN market_auctions a ON a.id = b.auction LEFT JOIN products p ON p.provenance = a.provenance   -- AUDIT PROF-541 R2-S4
      WHERE b.bidder = ?1 AND (b.state = 'high' OR b.at > ?2 OR a.closed_at > ?2)   -- AUDIT 31 S3: and a week from its auction's close
      ORDER BY b.state = 'high' DESC, b.at DESC LIMIT ${MARKET_SHOWN}`).bind(me, nowS - RECENT_S).all();
    return {
      ...(await base()),
      rows: listings.map((l) => listingView(l, me, l.kind === 'piece' ? { piece: pieceOf({ ...l, material: l.dfu_material }, l.wear) } : {})),
      ways: await pieceWays(db, me, pieces),   // MARKET-ANY: the List form's crafted pieces, each its own way
      orders: orders.map((o) => orderView(o, me)),
      auctions: auctions.map((a) => auctionView(a, me, { piece: pieceOf({ ...a, material: a.dfu_material }, a.wear) })),
      bids: bids.map((b) => ({
        ...bidView(b), auctionState: b.auction_state, endsAt: Number(b.ends_at), high: b.high == null ? null : Number(b.high),
        next: auctionNext(b.high == null ? null : Number(b.high), Number(b.opening)), auctionRegion: Number(b.auction_region),
        piece: pieceOf({ ...b, material: b.dfu_material }, b.wear),
      })),
    };
  }
  if (view === 'orders') {
    // GLOBAL-MARKET: every board's open orders, dearest first, each with its road from this board (a fill from another
    // region pays the courier out of its pay) - MARKET-AUDIT S4: a family's chosen in the query, before the cutoff, as the
    // Materials view's (a hundred dearer orders of any other family hid it)
    const familyKeys = family ? JSON.stringify([...marketCatalogue().map((c) => c.key), ...UNYIELDED].filter((k) => material(k)?.family === family)) : null;
    const { results: rows = [] } = await db.prepare(`SELECT * FROM market_orders WHERE state = 'open' AND expires_at > ?1
      AND (?2 IS NULL OR material IN (SELECT value FROM json_each(?2))) ORDER BY price DESC, at LIMIT ${MARKET_SHOWN}`).bind(nowS, familyKeys).all();
    const quotes = await quote(rows, () => 1);
    const medians = await mediansOf(db, [...new Set(rows.map((o) => o.material))], today);
    return { ...(await base()), orders: rows.map((o, i) => ({ ...orderView(o, me), road: quotes[i] })), medians: Object.fromEntries(medians) };
  }
  // history - kept 90 days (section 20); SCALE4b: pruned by the service's clock (pruneMarketHistory), never this read
  // GOLD-MARKET: the History in the view's currency - gold's own table, never the Drakes'
  const { results: top = [] } = await db.prepare(`SELECT material, SUM(units) AS units FROM ${currency === 'gold' ? 'market_gold_prices' : 'market_prices'} WHERE day > ?1 GROUP BY material
    ORDER BY units DESC, material LIMIT ${MARKET_HISTORY_SHOWN}`).bind(today - MARKET_MEDIAN_DAYS).all();
  const medians = await mediansOf(db, top.map((t) => t.material), today, currency);
  // AUDIT 30 U15: the Marks each side moved - a buyer the price and the courier, a seller the price less the tax and the
  // Tithe, a filler the pay, an orderer the price
  // GOLD-MARKET: each trade in its own currency - a gold seller's the price less the tax and the fee its sale paid
  // MARKET-ANY: a piece from a pack named by its listing's record (`good`)
  const goodSql = "CASE WHEN kind = 'item' THEN (SELECT item FROM market_listings l WHERE l.id = market_sales.listing) END";
  const { results: sales = [] } = await db.prepare(`SELECT 'bought' AS side, kind, material, provenance, units, price, total + courier AS total, at, currency, ${goodSql} AS good FROM market_sales WHERE buyer = ?1 AND at > ?2
    UNION ALL SELECT 'sold', kind, material, provenance, units, price, MAX(0, total - tax - tithe - fee), at, currency, ${goodSql} FROM market_sales WHERE seller = ?1 AND at > ?2
    UNION ALL SELECT 'filled', 'material', material, NULL, units, price, pay, at, 'marks', NULL FROM market_fills WHERE filler = ?1 AND at > ?2
    UNION ALL SELECT 'ordered', 'material', material, NULL, units, price, units * price, at, 'marks', NULL FROM market_fills WHERE poster = ?1 AND at > ?2
    UNION ALL SELECT 'won', 'piece', NULL, a.provenance, 1, a.high, a.high + b.courier, a.closed_at, 'marks', NULL FROM market_auctions a JOIN market_bids b ON b.id = a.high_bid
      WHERE a.state = 'sold' AND b.bidder = ?1 AND a.closed_at > ?2
    UNION ALL SELECT 'auctioned', 'piece', NULL, provenance, 1, high, ${netSql('high')} - tithe, closed_at, 'marks', NULL FROM market_auctions
      WHERE state = 'sold' AND seller = ?1 AND closed_at > ?2
    ORDER BY at DESC LIMIT ${MARKET_TRADES_SHOWN}`).bind(me, nowS - MARKET_KEEP_DAYS * DAY_S).all();
  return {
    ...(await base()),
    history: top.map((t) => ({ material: t.material, units: Number(t.units), ...(medians.get(t.material) ?? { median: null, line: [] }) })),
    trades: sales.map((s) => ({ side: s.side, kind: s.kind, material: s.material ?? null, provenance: s.provenance ?? null, units: Number(s.units),
      price: Number(s.price), total: Number(s.total), at: Number(s.at), currency: s.currency === 'gold' ? 'gold' : 'marks',
      ...(s.kind === 'item' ? { item: goodOf(s.good) } : {}) })),
  };
}

// ─── A LISTING (10.2) ────────────────────────────────────────────────

/**
 * LIST: `{ character, region, kind, material?, units?, provenance?, wear?, price, hubs?, rid, currency? }` - a Stores
 * material's `units` (bought first out of the Stores, the split kept) at a unit price, or a crafted piece this account
 * owns and has not listed, at its whole price and wear - on the boards of `region` for 72 hours, for the listing fee
 * burnt.
 * GOLD-MARKET: `currency` 'gold' prices it in gold - a realm character's alone (its proceeds are collected into its
 * record); its units its own and those bought with gold (gold's first), never those bought with Drakes; a piece never
 * bought, or bought with gold; its fee taken out of each sale (goldSaleOf), none now. A Drakes listing never takes gold's
 * units, nor a piece bought with gold (the wall).
 * MARKET-ANY: `kind` 'item' - a piece from the pack, with `item`, `pick` and `realm` (listGood).
 */
export async function marketList(ctx, player, env, { character, region, kind, material: key = null, units = 1, provenance = null, wear = null, price, hubs, rid, currency = 'marks', board = null, item = null, pick = null, realm = null, vendor = null } = {}) {
  // MARKET-ANY: a piece from the pack moves its seller's realm record - its own door, where the record stands asked first
  if (kind === 'item') return listGood(ctx, player, env, { character, region, item, pick, price, hubs, rid, currency, realm, board, vendor });   // AUDIT SEATS-3 D2: and its board
  if (vendor != null) return { error: 'bad-vendor' };   // HOME-VENDOR: a trader sells pieces from the pack alone
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, listing: listingView(row, me), balance: await balanceOf(db, me),
    ...(row.kind === 'material' ? { store: await storeOf(db, me, row.char_id, row.material) } : {}),
  });
  const prior = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!priceOk(price)) return { error: 'bad-price' };
  if (!currencyOk(currency)) return { error: 'bad-act' };
  if (currency === 'gold' && !REALM_ID_RE.test(character)) return { error: 'market-gold-realm' };   // GOLD-MARKET: gold is a realm record's
  const gold = currency === 'gold';
  const listingsMax = await listingsCapAt(db, nowS, boardOf(board));   // SEAT2b (7.5): a Market Hall's town lists a quarter more a tier
  const other = gold ? 'gold' : 'bought';   // GOLD-MARKET: the listing's second origin - bought in its own currency
  if (kind === 'material') {
    if (!material(key)) return { error: 'bad-material' };
    if (!unitsOk(units)) return { error: 'bad-units' };
    provenance = null; wear = null;   // AUDIT 30 S9: a kind's own fields alone - another's would break the row's CHECK
  } else if (kind === 'piece') {
    if (!provenanceOk(provenance)) return { error: 'bad-provenance' };
    if (!wearOk(wear)) return { error: 'bad-wear' };
    units = 1;
    key = null;
    // AUDIT 30 L2/S8: a piece of a family the market lists - never arrows (the crafter's quiver stays whole) nor a siege
    // work; the recipe is the product row's, fixed at the craft
    const made = await db.prepare('SELECT recipe FROM products WHERE provenance = ?1').bind(provenance).first();
    if (made && !pieceListable(made.recipe)) return { error: 'market-not-listable' };
  } else return { error: 'bad-act' };
  if (units * price > MARKET_WORTH_MAX) return { error: 'bad-price' };   // AUDIT 30 L8: no balance could pay its fee or buy it
  const held = await realmHoldOf(db, me, character);   // INT3 (AUDIT INT): a held character lists nothing - its craft, its Stores
  if (held) return held;
  if (await overRate(ctx, `market-post:${me}`, MARKET_POSTS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await settle(ctx, player);
  const fee = listingFee(units * price);
  const nonce = mintId(rand);
  const id = mintId(rand);
  const mine = 'EXISTS (SELECT 1 FROM market_listings WHERE seller = ?1 AND rid = ?5 AND n = ?6)';
  const boughtHeld = `COALESCE((SELECT qty FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?6 AND origin = '${other}'), 0)`;
  const own = hubsOf(hubs);
  await db.batch([
    // THE DECISION: the fee held, a place among the thirty, and the goods - the units in the Stores, or the piece this
    // account's and listed nowhere
    db.prepare(`INSERT OR IGNORE INTO market_listings (id, seller, char_id, region, kind, material, provenance, units, own, bought, price, wear, fee, at, expires_at, rid, n, currency)
      SELECT ?3, ?1, ?2, ?4, ?5, ?6, ?7, ?8,
        CASE WHEN ?5 = 'material' THEN ?8 - MIN(?8, ${boughtHeld}) ELSE 1 END,
        CASE WHEN ?5 = 'material' THEN MIN(?8, ${boughtHeld}) ELSE 0 END,
        ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?17
      WHERE (?17 = 'gold' OR COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?11)   -- GOLD-MARKET: a gold listing's fee comes of its sales
        AND ${openSalesSql('?12')} < ?16   -- PROF5b: an auction is among the thirty
        -- GOLD-MARKET: its own units and those bought in its own currency - never the other's (the wall)
        AND ((?5 = 'material' AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?6 AND origin IN ('own', ?18)), 0) >= ?8)
          OR (?5 = 'piece' AND EXISTS (SELECT 1 FROM products WHERE provenance = ?7 AND owner = ?1 AND listed = 0 AND (bought_with IS NULL OR bought_with = ?17))
            AND NOT EXISTS (SELECT 1 FROM market_listings WHERE provenance = ?7 AND state = 'open')
            -- AUDIT 30 S5: not while a delivery of it waits to be collected (the pack does not hold it yet)
            AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = ?7 AND collected = 0)
            -- AUDIT 30 S6: not while it stands in a home
            AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?7)))
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?14 || ':fee')`)
      .bind(me, character, id, region, kind, key, provenance, units, price, wear, fee, nowS, nowS + MARKET_LISTING_S, rid, nonce, listingsMax, currency, other),
    // a material's units out of the Stores, bought first - GOLD-MARKET: a gold listing's gold's first, then its own
    ...(kind === 'material' ? (gold
      ? spendOrigins(db, { player: me, character, materialSql: '?3', qtySql: '?4', guard: mine, binds: [key, units, rid, nonce], order: ['gold', 'own'] })
      : spendStatements(db, { player: me, character, materialSql: '?3', qtySql: '?4', guard: mine, binds: [key, units, rid, nonce] })) : []),
    // a piece marked listed
    db.prepare(`UPDATE products SET listed = 1 WHERE provenance = ?2 AND EXISTS (SELECT 1 FROM market_listings WHERE seller = ?1 AND rid = ?3 AND n = ?4)`)
      .bind(me, provenance, rid, nonce),
    // SEAT1d: the board it was posted at - its Tithe's seat (SEAT0 7.2's bailiwick)
    ...(boardOf(board) ? [db.prepare('UPDATE market_listings SET board_x = ?4, board_y = ?5 WHERE seller = ?1 AND rid = ?2 AND n = ?3')
      .bind(me, rid, nonce, boardOf(board)[0], boardOf(board)[1])] : []),
    // the fee burnt - GOLD-MARKET: a Drakes listing's; a gold listing's comes of each sale
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', ?1, 'burn', NULL, 'market-fee', fee, ?2, at, ?1, id, rid || ':fee' FROM market_listings WHERE seller = ?1 AND rid = ?3 AND n = ?4 AND currency = 'marks'`)
      .bind(me, utcDay(nowS), rid, nonce),
    ...witnessStatements(db, player, nowS, [region], own, 'EXISTS (SELECT 1 FROM market_listings WHERE seller = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':fee')) return { error: 'prof-rid' };
  if (!gold && (await balanceOf(db, me)) < fee) return { error: 'marks-short' };
  const open = await db.prepare(`SELECT ${openSalesSql('?2')} AS n`).bind(me, nowS).first();
  if (Number(open?.n ?? 0) >= listingsMax) return { error: 'market-listings-max' };
  if (kind === 'material') {
    // GOLD-MARKET: short only of units the other currency bought - the wall's own word
    const st = await storeOf(db, me, character, key);
    const mayList = st.own + (gold ? (st.gold ?? 0) : st.bought);
    if (mayList < units && st.own + st.bought + (st.gold ?? 0) >= units) return { error: gold ? 'market-drakes-goods' : 'market-gold-goods' };
    return { error: 'stores-short' };
  }
  const p = await db.prepare('SELECT owner, listed, bought_with FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!p) return { error: 'market-no-record' };   // AUDIT 31 H1: no record at all - never "another owner's"
  if (p.owner !== me) return { error: 'market-not-yours' };
  if (p.bought_with && p.bought_with !== currency) return { error: p.bought_with === 'gold' ? 'market-gold-goods' : 'market-drakes-goods' };   // GOLD-MARKET
  if (await db.prepare('SELECT 1 FROM market_deliveries WHERE provenance = ?1 AND collected = 0').bind(provenance).first()) return { error: 'market-uncollected' };
  if (await db.prepare("SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?1").bind(provenance).first()) return { error: 'market-standing' };
  return { error: 'market-listed' };
}

/**
 * MARKET-ANY: LIST A PIECE FROM THE PACK - `{ character, region, item, pick, price, hubs?, rid, currency: 'gold', realm }`.
 * The piece is the RECORD at index `pick` of the realm record the seller's tab last checkpointed (`realm`, where it
 * stands - asked before any other word, AUDIT REALM L1-F2), which must be `item` as the wire projects it (realmTradeLaw
 * recordIsOffered - every field but the volatile ones, both ways) and which the law lets go (marketLaw goodRefusal): it
 * leaves that record in the listing's own batch (prepareRealmRecord's steps, GUARDED - no listing, no piece out of the
 * record) and rides the listing, for gold alone, 72 hours on the boards of `region`, among the thirty. No fee now: each
 * sale pays its 1% and the tax, as every gold listing's. A crafted piece whose maker's record names this account lists
 * as a crafted piece ('market-piece-route' - its record's owner then moves with its sale); one whose record names
 * another lists from the pack like any piece. Answers the listing and the record's new sequence (`realm.seq`).
 */
async function listGood(ctx, player, env, { character, region, item, pick, price, hubs, rid, currency, realm, board = null, vendor = null }) {
  const { db, bucket, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const side = await realmActFirst(db, me, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'market-gold-realm' };   // a piece from the pack is a realm record's
  const answer = (row, extra = {}) => ({ ok: true, ...extra, listing: listingView(row, me) });
  const prior = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  // HOME-VENDOR: a piece stocked at the seller's own trader - its home's region the listing's, its stall its only door
  const vend = vendor == null ? null : vendorOf(vendor);
  if (vendor != null && !vend) return { error: 'bad-vendor' };
  if (vend) {
    const h = await db.prepare(`SELECT h.region FROM home_decor d JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
      WHERE ${VENDOR_STANDS_SQL} AND h.player = ?3 AND h.char_id = ?4`).bind(vend.map, vend.id, me, character).first();
    if (!h) return { error: 'vendor-not-yours' };
    region = Number(h.region);
  }
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!priceOk(price)) return { error: 'bad-price' };
  if (currency !== 'gold') return { error: 'market-goods-gold' };   // law 3: what a save holds never becomes Drakes
  if (!Number.isSafeInteger(pick) || pick < 0) return { error: 'bad-act' };
  if (goodRefusal(item)) return { error: 'market-not-good' };
  if (typeof item.provenance === 'string') {
    const p = await db.prepare('SELECT owner, bought_with FROM products WHERE provenance = ?1').bind(item.provenance).first();
    if (p?.owner === me) return { error: 'market-piece-route' };
    // AUDIT PROF-541 R2-S2: another's make keeps its wall from the pack too - a piece bought with Drakes (or made of goods
    // they bought, B7) never lists for gold, as the piece route's rule (listPiece's bought_with); this route lists for
    // gold alone, so a gold-bought piece passes
    if (p?.bought_with === 'marks') return { error: 'market-drakes-goods' };
  }
  if (await overRate(ctx, `market-post:${me}`, MARKET_POSTS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await settle(ctx, player);
  // MARKET-AUDIT: a trader's stock its own count, a board listing the board's - each its own cap
  const salesSql = vend ? stallSalesSql() : openSalesSql('?2');
  const open = await db.prepare(`SELECT ${salesSql} AS n`).bind(...(vend ? [me] : [me, nowS])).first();
  const listingsMax = vend ? VENDOR_STOCK_MAX : await listingsCapAt(db, nowS, boardOf(board));   // AUDIT SEATS-3 D2: a Market Hall's town lists a piece a quarter more a tier too, as every other listing
  if (Number(open?.n ?? 0) >= listingsMax) return { error: vend ? 'vendor-full' : 'market-listings-max' };
  // THE RECORD'S OWN PIECE: the very record at `pick`, as offered, out of it - never what the tab says it holds
  let moved = null;
  const prep = await prepareRealmRecord(ctx, me, side.at, (save) => {
    if (goodRefusal(Array.isArray(save.items) ? save.items[pick] : null)) return 'market-not-good';
    if (!lawfulItem(save.items[pick])) return 'market-not-good';   // INT1: and a piece the item law can stand behind
    const out = takeTradeGoods(save, { items: [item], gold: 0 }, [pick]);
    if (!out) return 'market-good-gone';
    moved = out[0];
    return null;
  }, { outbound: true, escrow: true });   // INT3: a listing hands the piece to the market's buyers; INT4: and the ledger holds it the market's
  if (prep.error) return prep;
  const id = mintId(rand);
  const nonce = mintId(rand);
  try {
    await db.batch([
      ...prep.steps,
      // THE DECISION: a place among the thirty, the id not spent - the record's piece on the listing, for gold
      // HOME-VENDOR: a trader's piece at its stall (`vendor_map`, `vendor_id`), its thirty days, while the stall stands
      db.prepare(`INSERT OR IGNORE INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, rid, n, currency, item, vendor_map, vendor_id)
        SELECT ?3, ?1, ?2, ?4, 'item', 1, 1, 0, ?5, ?6, ?7, ?8, ?9, ?10, 'gold', ?11, ?13, ?14 WHERE ${vend ? stallSalesSql() : openSalesSql('?7')} < ?12
          AND (?14 IS NULL OR EXISTS (SELECT 1 FROM home_decor d JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
            WHERE d.map_id = ?13 AND d.id = ?14 AND d.yard = 0 AND json_extract(d.place, '$.station') = '${VENDOR_STATION}' AND h.player = ?1 AND h.char_id = ?2))`)
        .bind(me, character, id, region, price, listingFee(price), nowS, nowS + (vend ? VENDOR_LISTING_S : MARKET_LISTING_S), rid, nonce, JSON.stringify(moved), listingsMax,
          vend?.map ?? null, vend?.id ?? null),
      mustChange(db),   // no listing, no piece out of the record: the record's step rolls back with it
      ...witnessStatements(db, player, nowS, [region], hubsOf(hubs), 'EXISTS (SELECT 1 FROM market_listings WHERE seller = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, me, side.at.id, prep.key);   // AUDIT REALM2 S3
    const moved2 = await recordMovedOf(db, me, side.at);
    if (moved2) return moved2;
    return { error: 'market-listings-max' };   // another listing took the last place between
  }
  await dropObjects(bucket, [prep.prev]);
  const made = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  return answer(made, { realm: { seq: prep.seq } });
}

// ─── BUYING (10.4) ───────────────────────────────────────────────────

/**
 * BUY: `{ character, region, listing, units?, max, hubs?, rid }` - `units` of a material listing (a piece whole) at its
 * price, and the courier when the listing stands in another region than the board's; `max` the most the buyer agreed
 * to pay in all. Here, a material goes into the Stores at once and a piece is answered to the pack; elsewhere the goods
 * go by courier. The seller is paid at the sale; a piece's owner moves to the buyer in the same batch.
 */
export async function marketBuy(ctx, player, env, { character, region, listing: id, units = 1, max, hubs, rid, realm = null, board = null, vendor = null } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  // GOLD-MARKET: a gold buy moves its buyer's record - where the record stands answered before any other word (AUDIT
  // REALM L1-F2: a lost answer asked again reads "one on" as its act, landed)
  let at = null;
  if (realm != null) {
    const side = await realmActFirst(db, me, character, realm);
    if (side.error) return side;
    if (!side.at) return { error: 'market-gold-realm' };
    at = side.at;
  }
  const answer = async (row, extra = {}) => {
    const out = {
      ok: true, ...extra,
      sale: {
        listing: row.listing, kind: row.kind, ...(row.material ? { material: row.material } : {}), units: Number(row.units), price: Number(row.price),
        total: Number(row.total), tax: Number(row.tax), courier: Number(row.courier), arrivesAt: Number(row.arrives_at), here: Number(row.from_region) === Number(row.to_region),
        from: Number(row.from_region),
      },
      balance: await balanceOf(db, me),
    };
    if (row.kind === 'material') out.store = await storeOf(db, me, row.char_id, row.material);
    if (row.kind === 'item') {
      // MARKET-ANY: a piece from a pack always comes as a delivery (here, arrived at once) - its record's collect is the
      // act that puts it into the buyer's record; the sale names it (`dn`)
      const d = row.dn ? await db.prepare('SELECT id, arrives_at FROM market_deliveries WHERE id = ?1 AND player = ?2').bind(row.dn, me).first() : null;
      if (d) out.delivery = { id: d.id, arrivesAt: Number(d.arrives_at) };
    }
    if (row.kind === 'piece') {
      const d = await db.prepare(`SELECT id, arrives_at FROM market_deliveries WHERE player = ?1 AND provenance = ?2 AND why = 'bought' AND at = ?3`).bind(me, row.provenance, row.at).first();
      if (d) out.delivery = { id: d.id, arrivesAt: Number(d.arrives_at) };
      else {
        const p = await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(row.provenance).first();
        const l = await db.prepare('SELECT wear FROM market_listings WHERE id = ?1').bind(row.listing).first();
        out.piece = pieceOf(p, l?.wear ?? 1000);
      }
    }
    return out;
  };
  const prior = await db.prepare('SELECT * FROM market_sales WHERE buyer = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!idOk(id)) return { error: 'bad-listing' };
  if (!Number.isSafeInteger(max) || max < 1) return { error: 'bad-price' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const l = await db.prepare('SELECT * FROM market_listings WHERE id = ?1').bind(id).first();
  if (!l || l.state !== 'open' || Number(l.expires_at) <= nowS) return { error: 'market-gone' };
  if (l.seller === me) return { error: 'market-own' };
  // HOME-VENDOR: a trader's piece is bought at its trader alone - the buyer's word names the listing's own stall, in its
  // home's region, and the stall still stands; any other listing is no trader's
  const vend = vendor == null ? null : vendorOf(vendor);
  if (vendor != null && !vend) return { error: 'bad-vendor' };
  if (l.vendor_id != null || vend) {
    if (!vend) return { error: 'vendor-only' };
    if (l.vendor_id !== vend.id || Number(l.vendor_map) !== vend.map || Number(l.region) !== region) return { error: 'vendor-not-here' };
    const stands = await db.prepare(`SELECT 1 AS y FROM home_decor d JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
      WHERE ${VENDOR_STANDS_SQL} AND h.player = ?3`).bind(vend.map, vend.id, l.seller).first();
    if (!stands) return { error: 'vendor-gone' };
  }
  // GOLD-MARKET: a gold listing is bought with a realm record's gold, a Drakes listing with the account's Drakes
  if ((l.currency === 'gold') !== (at != null)) return { error: at ? 'market-currency' : 'market-gold-realm' };
  if (l.kind === 'piece' || l.kind === 'item') units = 1;   // MARKET-ANY: a piece from a pack, whole
  else if (!unitsOk(units)) return { error: 'bad-units' };
  // INT1 (AUDIT INT): a piece listed before the item law read listings is read as it is bought - one no honest client
  // mints is sold to nobody (it waits for staff, and its buyer's trade is never held over it)
  if (l.kind === 'item' && !lawfulItem(goodOf(l.item))) return { error: 'market-not-good' };
  if (units > Number(l.own) + Number(l.bought)) return { error: 'market-short' };
  const from = Number(l.region);
  const own = hubsOf(hubs);
  const road = courierOf(await hubsAt(db, [from, region], own), from, region, units, courierSlow(env, nowS, region));
  if (!road) return { error: 'market-no-road' };
  if (at) return buyWithGold(ctx, player, { character, region, l, units, max, rid, road, own, at, answer });
  const total = units * Number(l.price);
  // AUDIT 30 L6: the tax of the listing's running total - what it has sold before this, units x its price
  const left = Number(l.own) + Number(l.bought);
  // SEAT1d (SEAT0 7.2): the Tithe of the seat the listing's board belongs to, from the seller's proceeds; the share of
  // the courier the buyer's board's seat takes, out of what is burnt
  const tt = await titheAt(db, nowS, from, rowBoard(l));
  const before = (Number(l.units) - left) * Number(l.price);   // AUDIT-SEATS L4: the Tithe of the running total too, as the tax
  const tax = saleTaxOn(before, total), tithe = tt ? saleTitheOn(before, total, tt.pct) : 0;
  const gets = total - tax - tithe;
  const ct = road.courier > 0 ? await titheAt(db, nowS, region, boardOf(board)) : null;
  const courierTithe = ct ? titheOf(road.courier, ct.pct) : 0;
  if (total + road.courier > max) return { error: 'market-price-moved' };
  const here = from === region;
  const delivered = l.kind === 'piece' || here ? 1 : 0;
  const nonce = mintId(rand);
  const day = utcDay(nowS);
  const sold = 'EXISTS (SELECT 1 FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3)';
  await db.batch([
    // THE DECISION: the listing open with the units, the buyer's Marks, the seller's room under the cap, and here, the
    // Stores' room for a material
    db.prepare(`INSERT OR IGNORE INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, provenance, units, price, total, tax, tithe,
        courier, road, from_region, to_region, arrives_at, delivered, at, day, n)
      SELECT ?1, ?2, ?3, l.id, l.seller, l.kind, l.material, l.provenance, ?4, l.price, ?5, ?6, ?7, ?8, ?9, l.region, ?10, ?11, ?12, ?13, ?14, ?15
      FROM market_listings l WHERE l.id = ?16 AND l.state = 'open' AND l.expires_at > ?13 AND l.seller != ?1 AND l.own + l.bought >= ?4
        AND l.price * ?4 = ?5
        AND l.own + l.bought = ?20   -- the running total the tax was taken on (AUDIT 30 L6)
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid IN (?2 || ':sale', ?2 || ':tax', ?2 || ':tithe'))   -- AUDIT 30 S3; MARKET-AUDIT S1: a sale paying its seller nothing spends its id by its tax's or Tithe's line
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?5 + ?8
        AND COALESCE((SELECT balance FROM marks WHERE account = l.seller), 0) + ?17 <= ?18
        AND (?12 = 0 OR l.kind = 'piece'
          OR COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?3 AND material = l.material), 0) + ?4 <= ?19)`)
      .bind(me, rid, character, units, total, tax, tithe, road.courier, road.road, region, nowS + road.seconds, delivered, nowS, day, nonce,
        id, gets, MARKS_MAX, STORES_MAX, left),
    // the units out of the listing, bought first (the seller keeps its own for a cancel), and a listing sold out closed
    db.prepare(`UPDATE market_listings SET own = own - MAX(0, ?4 - bought), bought = MAX(0, bought - ?4),
        state = CASE WHEN own + bought = ?4 THEN 'sold' ELSE state END, closed_at = CASE WHEN own + bought = ?4 THEN ?5 ELSE closed_at END
      WHERE id = ?6 AND ${sold}`).bind(me, rid, nonce, units, nowS, id),
    // the Marks: the proceeds to the seller, the tax and the courier burnt
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, 'account', seller, 'market-sale', total - tax - tithe, day, at, buyer, listing, rid || ':sale'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND total - tax - tithe > 0`).bind(me, rid, nonce),   // MARKET-AUDIT S1: a one-Mark unit its tax took whole pays its seller nothing - no line of 0 (the ledger's CHECK threw the sale, 500)
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, 'burn', NULL, 'market-tax', tax, day, at, buyer, listing, rid || ':tax'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND tax > 0`).bind(me, rid, nonce),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, 'burn', NULL, 'courier', courier - ?4, day, at, buyer, listing, rid || ':courier'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND courier - ?4 > 0`).bind(me, rid, nonce, courierTithe),
    // SEAT1d: the Tithe to the listing's seat's holder, and the courier's share to the buyer's board's - or burnt
    ...(tithe > 0 ? [db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, CASE WHEN ${titheEnd('?4', 'tithe')} THEN 'guild' ELSE 'burn' END, CASE WHEN ${titheEnd('?4', 'tithe')} THEN ?4 END,
        'tithe', tithe, day, at, buyer, listing, rid || ':tithe'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND tithe > 0`).bind(me, rid, nonce, tt.guild)] : []),
    ...(courierTithe > 0 ? [db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, CASE WHEN ${titheEnd('?4', '?5')} THEN 'guild' ELSE 'burn' END, CASE WHEN ${titheEnd('?4', '?5')} THEN ?4 END,
        'tithe', ?5, day, at, buyer, listing, rid || ':ctithe'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce, ct.guild, courierTithe)] : []),
    // a material here, into the Stores as bought
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT buyer, char_id, material, 'bought', units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'material' AND delivered = 1
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, rid, nonce),
    // a piece's owner moved, and by courier its delivery written
    db.prepare(`UPDATE products SET owner = ?1, credited = 0, listed = 0, bought_with = 'marks' WHERE provenance = (SELECT provenance FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'piece')`)
      .bind(me, rid, nonce),   // GOLD-MARKET: bought with Drakes - it lists for Drakes alone
    db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
      SELECT ?4, s.buyer, s.char_id, s.provenance, l.wear, 'bought', s.from_region, s.arrives_at, s.at
      FROM market_sales s JOIN market_listings l ON l.id = s.listing
      WHERE s.buyer = ?1 AND s.rid = ?2 AND s.n = ?3 AND s.kind = 'piece' AND s.from_region != s.to_region`).bind(me, rid, nonce, mintId(rand)),
    // the price table (10.2's History) - a material's sale
    db.prepare(`INSERT INTO market_prices (day, material, price, units)
      SELECT day, material, price, units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'material'
      ON CONFLICT (day, material, price) DO UPDATE SET units = market_prices.units + excluded.units`).bind(me, rid, nonce),
    ...witnessStatements(db, player, nowS, [from, region], own, 'EXISTS (SELECT 1 FROM market_sales WHERE buyer = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_sales WHERE buyer = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':sale')) return { error: 'prof-rid' };
  const now = await db.prepare('SELECT * FROM market_listings WHERE id = ?1').bind(id).first();
  if (!now || now.state !== 'open') return { error: 'market-gone' };
  if (Number(now.own) + Number(now.bought) < units) return { error: 'market-short' };
  if (Number(now.own) + Number(now.bought) !== left) return { error: 'market-price-moved' };   // another sold between: its tax moved
  if ((await balanceOf(db, me)) < total + road.courier) return { error: 'marks-short' };
  if ((await balanceOf(db, l.seller)) + gets > MARKS_MAX) return { error: 'market-seller-full' };
  return { error: 'stores-full' };
}

/**
 * GOLD-MARKET: A GOLD BUY - `units` of a gold listing paid off the buyer's realm record (purse, letters, then `region`'s
 * account - realmGoldLaw payFromSave), the courier's a Mark's worth of gold a Mark (MARK_WORTH_GOLD); `max` its exact cost
 * (the price and the courier), which the buyer's tab has taken out of its purse as it asks. One batch: the
 * record moved (prepareRealmRecord's steps), the sale decided - the listing open with the units, the seller's held gold
 * with room, here the Stores' room - and GUARDED (mustChange: a sale not written rolls the record back), the listing
 * drawn down, the seller's share held for it (market_gold), the goods the buyer's: a material into the Stores as
 * gold's, a piece's owner moved and marked bought with gold. The tax and the fee, and the courier, are burnt: gold no
 * row holds. Answers the sale and the record's new sequence (`realm.seq`).
 */
async function buyWithGold(ctx, player, { character, region, l, units, max, rid, road, own, at, answer }) {
  const { db, bucket, nowS, rand } = ctx;
  const me = player.id;
  const courier = road.courier * MARK_WORTH_GOLD;
  const total = units * Number(l.price);
  const left = Number(l.own) + Number(l.bought);
  const { tax, fee, tithe, gets } = goldSaleOf((Number(l.units) - left) * Number(l.price), total);
  // the exact cost the buyer's tab took out of its purse as it asked - never less, or the purse and the record part
  if (total + courier !== max) return { error: 'market-price-moved' };
  const from = Number(l.region);
  const here = from === region;
  const delivered = l.kind === 'piece' || l.kind === 'item' || here ? 1 : 0;   // MARKET-ANY: a pack's piece's delivery written at once
  const prep = await prepareRealmRecord(ctx, me, at, (save) => (payFromSave(save, total + courier, region) ? null : 'realm-gold'), { outbound: true });   // INT3: a purchase pays the seller
  if (prep.error) return prep;
  const nonce = mintId(rand);
  const day = utcDay(nowS);
  const sold = 'EXISTS (SELECT 1 FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3)';
  try {
    await db.batch([
      ...prep.steps,
      // THE DECISION: the gold listing open with the units at the running total the tax was taken on, the seller's held
      // gold with room, and here the Stores' room
      db.prepare(`INSERT OR IGNORE INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, provenance, units, price, total, tax, tithe,
          courier, road, from_region, to_region, arrives_at, delivered, at, day, n, currency, fee, dn)
        SELECT ?1, ?2, ?3, l.id, l.seller, l.kind, l.material, l.provenance, ?4, l.price, ?5, ?6, ?7, ?8, ?9, l.region, ?10, ?11, ?12, ?13, ?14, ?15, 'gold', ?21,
          CASE WHEN l.kind = 'item' THEN ?22 END   -- MARKET-ANY: the delivery a pack's piece comes by
        FROM market_listings l WHERE l.id = ?16 AND l.state = 'open' AND l.currency = 'gold' AND l.expires_at > ?13 AND l.seller != ?1 AND l.own + l.bought >= ?4
          AND l.price * ?4 = ?5
          AND l.own + l.bought = ?20
          AND COALESCE((SELECT gold FROM market_gold WHERE player = l.seller AND char_id = l.char_id), 0) + ?17 <= ?18
          AND (?12 = 0 OR l.kind IN ('piece', 'item')
            OR COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?3 AND material = l.material), 0) + ?4 <= ?19)`)
        .bind(me, rid, character, units, total, tax, tithe, courier, road.road, region, nowS + road.seconds, delivered, nowS, day, nonce,
          l.id, gets, MARKET_GOLD_HELD_MAX, STORES_MAX, left, fee, mintId(rand)),
      mustChange(db),   // no sale, no gold moved: the record's step rolls back with it
      db.prepare(`UPDATE market_listings SET own = own - MAX(0, ?4 - bought), bought = MAX(0, bought - ?4),
          state = CASE WHEN own + bought = ?4 THEN 'sold' ELSE state END, closed_at = CASE WHEN own + bought = ?4 THEN ?5 ELSE closed_at END
        WHERE id = ?6 AND ${sold}`).bind(me, rid, nonce, units, nowS, l.id),
      // the seller's share, held for its character until its own record collects it
      db.prepare(`INSERT INTO market_gold (player, char_id, gold)
        SELECT seller, (SELECT char_id FROM market_listings WHERE id = listing), MAX(0, total - tax - tithe - fee) FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3
        ON CONFLICT (player, char_id) DO UPDATE SET gold = market_gold.gold + excluded.gold`).bind(me, rid, nonce),   // MARKET-AUDIT S3: goldSaleOf's floor - a 1-gold unit's tax and fee past it broke the CHECK, said `stores-full`
      // a material here, into the Stores as gold's (the wall)
      db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
        SELECT buyer, char_id, material, 'gold', units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'material' AND delivered = 1
        ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, rid, nonce),
      // a piece's owner moved, marked bought with gold (it lists for gold alone), and by courier its delivery written
      db.prepare(`UPDATE products SET owner = ?1, credited = 0, listed = 0, bought_with = 'gold' WHERE provenance = (SELECT provenance FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'piece')`)
        .bind(me, rid, nonce),
      db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
        SELECT ?4, s.buyer, s.char_id, s.provenance, l.wear, 'bought', s.from_region, s.arrives_at, s.at
        FROM market_sales s JOIN market_listings l ON l.id = s.listing
        WHERE s.buyer = ?1 AND s.rid = ?2 AND s.n = ?3 AND s.kind = 'piece' AND s.from_region != s.to_region`).bind(me, rid, nonce, mintId(rand)),
      // MARKET-ANY: a piece from a pack on its way - here arrived at once, else after the courier's time - its record the
      // listing's, collected into the buyer's realm record by its own act (collectGood)
      db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, item, why, from_region, arrives_at, at)
        SELECT s.dn, s.buyer, s.char_id, l.item, 'bought', s.from_region, s.arrives_at, s.at
        FROM market_sales s JOIN market_listings l ON l.id = s.listing
        WHERE s.buyer = ?1 AND s.rid = ?2 AND s.n = ?3 AND s.kind = 'item'`).bind(me, rid, nonce),
      // gold's own price table
      db.prepare(`INSERT INTO market_gold_prices (day, material, price, units)
        SELECT day, material, price, units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'material'
        ON CONFLICT (day, material, price) DO UPDATE SET units = market_gold_prices.units + excluded.units`).bind(me, rid, nonce),
      ...witnessStatements(db, player, nowS, [from, region], own, 'EXISTS (SELECT 1 FROM market_sales WHERE buyer = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, me, at.id, prep.key);   // AUDIT REALM2 S3
    const moved = await recordMovedOf(db, me, at);
    if (moved) return moved;
    const now = await db.prepare('SELECT * FROM market_listings WHERE id = ?1').bind(l.id).first();
    if (!now || now.state !== 'open') return { error: 'market-gone' };
    if (Number(now.own) + Number(now.bought) < units) return { error: 'market-short' };
    if (Number(now.own) + Number(now.bought) !== left) return { error: 'market-price-moved' };
    const held = await db.prepare('SELECT gold FROM market_gold WHERE player = ?1 AND char_id = ?2').bind(l.seller, l.char_id).first();
    if (Number(held?.gold ?? 0) + gets > MARKET_GOLD_HELD_MAX) return { error: 'market-gold-full' };
    return { error: 'stores-full' };
  }
  await dropObjects(bucket, [prep.prev]);
  const made = await db.prepare('SELECT * FROM market_sales WHERE buyer = ?1 AND rid = ?2').bind(me, rid).first();
  return answer(made, { realm: { seq: prep.seq } });
}

// ─── CANCEL (10.2: "a cancelled listing returns its goods, the fee kept") ─

/** CANCEL: `{ character, listing, rid }` - this account's open listing closed; a material's units back to the listing
 *  character's Stores (refused while they would not fit), a piece answered back to the pack. */
export async function marketCancel(ctx, player, env, { character, listing: id, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => {
    const out = { ok: true, ...extra, listing: listingView(row, me), balance: await balanceOf(db, me) };
    if (row.kind === 'material') out.store = await storeOf(db, me, row.char_id, row.material);
    else if (row.kind === 'item') out.delivery = { id: row.id };   // MARKET-ANY: back by a delivery its record collects
    else out.piece = pieceOf(await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(row.provenance).first(), row.wear);
    return out;
  };
  const prior = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND cancel_rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  // PROF5b: an auction's cancel, answered again the same
  const priorAuction = await db.prepare('SELECT * FROM market_auctions WHERE seller = ?1 AND cancel_rid = ?2').bind(me, rid).first();
  if (priorAuction) return auctionCancelled(db, me, priorAuction, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!idOk(id)) return { error: 'bad-listing' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const l = await db.prepare('SELECT * FROM market_listings WHERE id = ?1 AND seller = ?2').bind(id, me).first();
  if (!l && (await db.prepare('SELECT 1 FROM market_auctions WHERE id = ?1 AND seller = ?2').bind(id, me).first())) return auctionCancel(ctx, player, id, rid);
  if (!l || l.state !== 'open') return { error: 'market-gone' };
  const nonce = mintId(rand);
  await db.batch([
    db.prepare(`UPDATE market_listings SET state = 'cancelled', closed_at = ?3, returned = 1, cancel_rid = ?4, rn = ?5
      WHERE id = ?1 AND seller = ?2 AND state = 'open' AND (kind IN ('piece', 'item')
        OR COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?2 AND char_id = market_listings.char_id AND material = market_listings.material), 0)
          + own + bought <= ?6)`).bind(id, me, nowS, rid, nonce, STORES_MAX),
    ...backToStores(db, id, nonce),
    db.prepare(`UPDATE products SET listed = 0 WHERE provenance = (SELECT provenance FROM market_listings WHERE id = ?1 AND rn = ?2)`).bind(id, nonce),
    // MARKET-ANY: a piece from a pack back to the character that listed it - a delivery arrived at once, which its record
    // collects (collectGood): the cancel moves no record, so it asks none
    db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, item, why, from_region, arrives_at, at)
      SELECT id, seller, char_id, item, 'returned', region, ?2, ?2 FROM market_listings WHERE id = ?1 AND rn = ?3 AND kind = 'item'`).bind(id, nowS, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND cancel_rid = ?2').bind(me, rid).first();
  if (made?.rn === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  const now = await db.prepare('SELECT state FROM market_listings WHERE id = ?1').bind(id).first();
  return { error: now?.state === 'open' ? 'stores-full' : 'market-gone' };
}

// ─── BUY ORDERS (10.3) ───────────────────────────────────────────────

/** ORDER: `{ character, region, material, units, price, hubs?, rid }` - a standing order at the board's region for 7
 *  days, its Marks (units x price) escrowed at once - a line to the ledger's `escrow` end, the order's id. */
export async function marketOrder(ctx, player, env, { character, region, material: key, units, price, hubs, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({ ok: true, ...extra, order: orderView(row, me), balance: await balanceOf(db, me) });
  const prior = await db.prepare('SELECT * FROM market_orders WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!material(key)) return { error: 'bad-material' };
  if (UNYIELDED.includes(key)) return { error: 'market-unyielded' };   // AUDIT 30 L7: nobody could fill it
  if (!unitsOk(units)) return { error: 'bad-units' };
  if (!priceOk(price) || units * price > MARKET_WORTH_MAX) return { error: 'bad-price' };
  if (await overRate(ctx, `market-post:${me}`, MARKET_POSTS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await settle(ctx, player);
  const cost = units * price;
  const nonce = mintId(rand);
  const id = mintId(rand);
  const own = hubsOf(hubs);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n)
      SELECT ?3, ?1, ?2, ?4, ?5, ?6, ?6, ?7, ?8, ?9, ?10, ?11, ?12
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?8
        AND (SELECT COUNT(*) FROM market_orders WHERE poster = ?1 AND state = 'open') < ?13
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?11 || ':escrow')`)
      .bind(me, character, id, region, key, units, price, cost, nowS, nowS + MARKET_ORDER_S, rid, nonce, MARKET_ORDERS_MAX),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', poster, 'escrow', id, 'order-escrow', escrow, ?4, at, poster, material, rid || ':escrow'
      FROM market_orders WHERE poster = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce, utcDay(nowS)),
    ...witnessStatements(db, player, nowS, [region], own, 'EXISTS (SELECT 1 FROM market_orders WHERE poster = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_orders WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':escrow')) return { error: 'prof-rid' };
  return { error: (await balanceOf(db, me)) < cost ? 'marks-short' : 'market-orders-max' };
}

/**
 * FILL: `{ character, region, order, units, hubs?, rid, least?, board? }` - `units` of an open order of any board from
 * this character's Stores (bought first); the pay out of the escrow less the tax and, GLOBAL-MARKET, the courier when the
 * order stands in another region than this board's (by the load, as a buy's - the filler's not going, burnt, its Tithe
 * share to this board's seat); the units to the orderer's Stores at once as bought (refused past their room). `least` the
 * least pay the filler agreed to - a courier or a tax moved past it is `market-price-moved`.
 */
export async function marketFill(ctx, player, env, { character, region, order: id, units, hubs, rid, least = null, board = null } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, fill: { order: row.order_id, material: row.material, units: Number(row.units), price: Number(row.price), pay: Number(row.pay), tax: Number(row.tax),
      courier: Number(row.units) * Number(row.price) - Number(row.pay) - Number(row.tax) },   // GLOBAL-MARKET: what the road took of it
    store: await storeOf(db, me, row.char_id, row.material), balance: await balanceOf(db, me),
  });
  const prior = await db.prepare('SELECT * FROM market_fills WHERE filler = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!idOk(id)) return { error: 'bad-order' };
  if (!unitsOk(units)) return { error: 'bad-units' };
  const frozen = await realmHoldOf(db, me, character);   // INT3 (AUDIT INT): a held character fills no order from its Stores
  if (frozen) return frozen;
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const o = await db.prepare('SELECT * FROM market_orders WHERE id = ?1').bind(id).first();
  if (!o || o.state !== 'open' || Number(o.expires_at) <= nowS) return { error: 'market-gone' };
  if (o.poster === me) return { error: 'market-own' };
  if (units > Number(o.left_units)) return { error: 'market-short' };
  const total = units * Number(o.price);
  const own = hubsOf(hubs);
  // GLOBAL-MARKET: an order of another region filled from here - the courier carries the units to it, out of the pay
  const to = Number(o.region);
  const road = courierOf(await hubsAt(db, [region, to], own), region, to, units);
  if (!road) return { error: 'market-no-road' };
  // AUDIT 30 L6: the tax of the order's running total - what it has bought before this fill; MARKET-AUDIT S2: its last units
  // here pay at least a Mark (marketLaw fillTaxOn), and any other fill the tax or the courier would leave paying nothing
  // is refused, said why
  const tax = fillTaxOn((Number(o.units) - Number(o.left_units)) * Number(o.price), total, road.courier === 0 && units === Number(o.left_units));
  const pay = total - tax - road.courier;
  if (pay < 1) return { error: road.courier > 0 ? 'market-courier-dear' : 'market-taxed-out' };
  if (Number.isSafeInteger(least) && pay < least) return { error: 'market-price-moved' };
  const ct = road.courier > 0 ? await titheAt(db, nowS, region, boardOf(board)) : null;
  const fillTithe = ct ? titheOf(road.courier, ct.pct) : 0;   // the buy's courier share (SEAT1d), the filler's board's
  const nonce = mintId(rand);
  const day = utcDay(nowS);
  const filled = 'EXISTS (SELECT 1 FROM market_fills WHERE filler = ?1 AND rid = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION: the order open with the units and their escrow, the filler's units, the orderer's room, the filler's
    // room under the Marks cap
    db.prepare(`INSERT OR IGNORE INTO market_fills (filler, rid, char_id, order_id, poster, material, units, price, pay, tax, at, day, n)
      SELECT ?1, ?2, ?3, o.id, o.poster, o.material, ?4, o.price, ?5, ?6, ?7, ?8, ?9 FROM market_orders o
      WHERE o.id = ?10 AND o.state = 'open' AND o.expires_at > ?7 AND o.poster != ?1 AND o.region = ?11 AND o.left_units >= ?4
        AND o.escrow >= o.price * ?4 AND o.price * ?4 = ?5 + ?6 + ?15
        AND o.left_units = ?14   -- the running total the tax was taken on (AUDIT 30 L6)
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2 || ':fill')   -- AUDIT 30 S3
        AND ${spendableSql('?1', '?3', 'o.material')} >= ?4   -- GOLD-MARKET: a Drakes order is never filled with gold's units
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = o.poster AND char_id = o.char_id AND material = o.material), 0) + ?4 <= ?12
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + ?5 <= ?13`)
      .bind(me, rid, character, units, pay, tax, nowS, day, nonce, id, to, STORES_MAX, MARKS_MAX, Number(o.left_units), road.courier),
    // the order drawn down, a filled one closed
    db.prepare(`UPDATE market_orders SET left_units = left_units - ?3, escrow = escrow - price * ?3,
        state = CASE WHEN left_units = ?3 THEN 'filled' ELSE state END, closed_at = CASE WHEN left_units = ?3 THEN ?4 ELSE closed_at END
      WHERE id = ?2 AND EXISTS (SELECT 1 FROM market_fills WHERE filler = ?1 AND rid = ?5 AND n = ?6)`).bind(me, id, units, nowS, rid, nonce),
    // the filler's units out, bought first; the orderer's in, bought
    ...spendStatements(db, { player: me, character, materialSql: '?3', qtySql: '?4', guard: filled, binds: [o.material, units, rid, nonce] }),
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT poster, ?4, material, 'bought', units FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, rid, nonce, o.char_id),
    // the Marks: the pay out of the escrow, the tax burnt from it
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', order_id, 'account', filler, 'order-fill', pay, day, at, filler, material, rid || ':fill'
      FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', order_id, 'burn', NULL, 'market-tax', tax, day, at, filler, material, rid || ':filltax'
      FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3 AND tax > 0`).bind(me, rid, nonce),
    // GLOBAL-MARKET: the courier out of the escrow, burnt - its Tithe share to this board's seat's holder, or burnt
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', order_id, 'burn', NULL, 'courier', ?4, day, at, filler, material, rid || ':fillcourier'
      FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3 AND ?4 > 0`).bind(me, rid, nonce, road.courier - fillTithe),
    ...(fillTithe > 0 ? [db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', order_id, CASE WHEN ${titheEnd('?4', '?5')} THEN 'guild' ELSE 'burn' END, CASE WHEN ${titheEnd('?4', '?5')} THEN ?4 END,
        'tithe', ?5, day, at, filler, material, rid || ':fillctithe'
      FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce, ct.guild, fillTithe)] : []),
    db.prepare(`INSERT INTO market_prices (day, material, price, units)
      SELECT day, material, price, units FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (day, material, price) DO UPDATE SET units = market_prices.units + excluded.units`).bind(me, rid, nonce),
    ...witnessStatements(db, player, nowS, [region, to], own, 'EXISTS (SELECT 1 FROM market_fills WHERE filler = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_fills WHERE filler = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':fill')) return { error: 'prof-rid' };
  const now = await db.prepare('SELECT * FROM market_orders WHERE id = ?1').bind(id).first();
  if (!now || now.state !== 'open') return { error: 'market-gone' };
  if (Number(now.left_units) < units) return { error: 'market-short' };
  if (Number(now.left_units) !== Number(o.left_units)) return { error: 'market-price-moved' };   // another filled between
  const held = await storeOf(db, me, character, o.material);
  if (held.own + held.bought < units) return { error: held.own + held.bought + (held.gold ?? 0) >= units ? 'market-gold-goods' : 'stores-short' };   // GOLD-MARKET
  if ((await balanceOf(db, me)) + pay > MARKS_MAX) return { error: 'marks-full' };
  return { error: 'market-order-full' };
}

/** UNORDER: `{ order, rid }` - this account's open order closed, what is left of its escrow back (under the cap; else
 *  on a later read). Asked again, a closed order of this account's answers as done. */
export async function marketUnorder(ctx, player, env, { order: id, rid } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { rid, needChar: false });
  if (refused) return refused;
  const me = player.id;
  if (!idOk(id)) return { error: 'bad-order' };
  const o = await db.prepare('SELECT * FROM market_orders WHERE id = ?1 AND poster = ?2').bind(id, me).first();
  if (!o) return { error: 'market-gone' };
  if (o.state === 'cancelled') return { ok: true, repeat: true, order: orderView(o, me), balance: await balanceOf(db, me) };
  const closed = shut(player, env);
  if (closed) return closed;
  if (o.state !== 'open') return { error: 'market-gone' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await db.batch([
    db.prepare(`UPDATE market_orders SET state = 'cancelled', closed_at = ?3 WHERE id = ?1 AND poster = ?2 AND state = 'open'`).bind(id, me, nowS),
    ...orderReturn(db, id, nowS),
  ]);
  const now = await db.prepare('SELECT * FROM market_orders WHERE id = ?1').bind(id).first();
  if (now?.state !== 'cancelled') return { error: 'market-gone' };
  return { ok: true, order: orderView(now, me), balance: await balanceOf(db, me) };
}

// ─── COLLECT (a piece arrived, or come back) ─────────────────────────

/** COLLECT: `{ character, delivery, rid }` - a piece whose courier has arrived, or whose listing expired or was
 *  removed, answered to this character's pack once; asked again with the same id, answered again. */
export async function marketCollect(ctx, player, env, { character, delivery: id, rid, realm = null } = {}) {
  // MARKET-ANY: a piece from a pack goes into the collecting character's realm record - its own door, the record first
  if (realm != null) return collectGood(ctx, player, env, { character, delivery: id, rid, realm });
  const { db, nowS } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (d, extra = {}) => ({
    ok: true, ...extra, delivery: { id: d.id, why: d.why },
    piece: pieceOf(await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(d.provenance).first(), d.wear),
  });
  const prior = await db.prepare('SELECT * FROM market_deliveries WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!idOk(id)) return { error: 'bad-delivery' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const d = await db.prepare('SELECT * FROM market_deliveries WHERE id = ?1 AND player = ?2').bind(id, me).first();
  if (!d || Number(d.collected) === 1) return { error: 'market-gone' };
  if (d.char_id !== character) return { error: 'market-other-character' };
  if (Number(d.arrives_at) > nowS) return { error: 'market-on-road' };
  if (d.item != null) return { error: 'realm-needed' };   // MARKET-ANY: a pack's piece goes into a record, never minted
  // AUDIT 30 S5: only a piece still this account's - never one id handed out twice
  await db.prepare(`UPDATE market_deliveries SET collected = 1, rid = ?3 WHERE id = ?1 AND player = ?2 AND char_id = ?4 AND collected = 0 AND arrives_at <= ?5
      AND EXISTS (SELECT 1 FROM products WHERE provenance = market_deliveries.provenance AND owner = ?2)`)
    .bind(id, me, rid, character, nowS).run();
  const made = await db.prepare('SELECT * FROM market_deliveries WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  return made ? answer(made) : { error: 'market-gone' };
}

/**
 * MARKET-ANY: COLLECT A PIECE FROM A PACK - `{ character, delivery, rid, realm }`: one bought, or come back to its seller
 * (cancelled, expired, removed), whose courier has arrived - its record put into this character's realm record (`realm`,
 * where it stands, asked before any other word) in the collect's own batch, the delivery marked collected and GUARDED
 * (mustChange: a delivery another collect took first rolls the record back). Answers the piece's record and the record's
 * new sequence (`realm.seq`); asked again with the same id, the delivery again.
 */
async function collectGood(ctx, player, env, { character, delivery: id, rid, realm }) {
  const { db, bucket, nowS } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const side = await realmActFirst(db, me, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'market-gold-realm' };
  const answer = (d, extra = {}) => ({ ok: true, ...extra, delivery: { id: d.id, why: d.why }, item: goodOf(d.item) });
  const prior = await db.prepare('SELECT * FROM market_deliveries WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!idOk(id)) return { error: 'bad-delivery' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const d = await db.prepare('SELECT * FROM market_deliveries WHERE id = ?1 AND player = ?2').bind(id, me).first();
  if (!d || Number(d.collected) === 1) return { error: 'market-gone' };
  if (d.char_id !== character) return { error: 'market-other-character' };
  if (Number(d.arrives_at) > nowS) return { error: 'market-on-road' };
  const item = goodOf(d.item);
  if (!item) return { error: 'bad-delivery' };   // a crafted piece's delivery is minted at the pack, no record moved
  const prep = await prepareRealmRecord(ctx, me, side.at, (save) => { giveTradeGoods(save, [item], 0); return null; });
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare(`UPDATE market_deliveries SET collected = 1, rid = ?3 WHERE id = ?1 AND player = ?2 AND char_id = ?4 AND collected = 0 AND arrives_at <= ?5
        AND item IS NOT NULL`).bind(id, me, rid, character, nowS),
      mustChange(db),   // no delivery collected, no piece into the record
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, me, side.at.id, prep.key);   // AUDIT REALM2 S3
    const moved = await recordMovedOf(db, me, side.at);
    if (moved) return moved;
    return { error: 'market-gone' };   // another collect took it first
  }
  await dropObjects(bucket, [prep.prev]);
  const made = await db.prepare('SELECT * FROM market_deliveries WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  return answer(made, { realm: { seq: prep.seq } });
}

/**
 * GOLD-MARKET: COLLECT GOLD - `{ character, realm, region }`: every gold this character's sales hold for it, into its
 * realm record's account at `region` (the board's - realmGoldLaw creditSave `bank`; the purse where the record keeps no
 * account there). One batch: the record moved (its steps) and the held gold emptied, GUARDED (mustChange) - both or
 * neither. Answers what it collected and the record's new sequence. Nothing to collect is refused before the record
 * moves.
 */
export async function marketGoldCollect(ctx, player, env, { character, realm = null, region } = {}) {
  const { db, bucket } = ctx;
  const refused = asks(player, { character, needRid: false });
  if (refused) return refused;
  const me = player.id;
  const side = await realmActFirst(db, me, character, realm);   // AUDIT REALM L1-F2: where the record stands, first
  if (side.error) return side;
  if (!side.at) return { error: 'market-gold-realm' };
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  const row = await db.prepare('SELECT gold FROM market_gold WHERE player = ?1 AND char_id = ?2').bind(me, character).first();
  const gold = Number(row?.gold ?? 0);
  if (gold < 1) return { error: 'market-gold-none' };
  const prep = await prepareRealmRecord(ctx, me, side.at, (save) => (creditSave(save, gold, { bank: region }) ? null : 'bad-gold'));
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare('UPDATE market_gold SET gold = gold - ?3 WHERE player = ?1 AND char_id = ?2 AND gold >= ?3').bind(me, character, gold),
      mustChange(db),
      db.prepare('DELETE FROM market_gold WHERE player = ?1 AND char_id = ?2 AND gold = 0').bind(me, character),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, me, side.at.id, prep.key);
    const moved = await recordMovedOf(db, me, side.at);
    if (moved) return moved;
    return { error: 'market-gold-none' };   // another collect emptied it first
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, gold, region, realm: { seq: prep.seq } };
}

// ─── PROF5b: TIMED AUCTIONS (10.2, Professions-Arc 27) ───────────────

/**
 * AUCTION: `{ character, region, provenance, wear, opening, hubs?, rid }` - a crafted Masterwork this account owns and
 * has not listed, posted at an opening bid on the boards of `region` for 24 hours, for the listing fee burnt (1% of the
 * opening bid). The piece leaves the save (the book keeps it) and comes back unsold on the seller's read.
 */
export async function marketAuction(ctx, player, env, { character, region, provenance = null, wear = null, opening, hubs, rid, board = null } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => {
    const p = await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(row.provenance).first();
    return { ok: true, ...extra, auction: auctionView(row, me, { piece: pieceOf(p, row.wear) }), balance: await balanceOf(db, me) };
  };
  const prior = await db.prepare('SELECT * FROM market_auctions WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!provenanceOk(provenance)) return { error: 'bad-provenance' };
  if (!wearOk(wear)) return { error: 'bad-wear' };
  const auctionsMax = await listingsCapAt(db, nowS, boardOf(board));   // SEAT2b (7.5): a Market Hall's town lists a quarter more a tier
  if (!priceOk(opening)) return { error: 'bad-price' };
  const made = await db.prepare('SELECT recipe, quality FROM products WHERE provenance = ?1').bind(provenance).first();
  if (made && !pieceListable(made.recipe)) return { error: 'market-not-listable' };
  if (made && !auctionable(made.recipe, Number(made.quality))) return { error: 'auction-not-masterwork' };
  const held = await realmHoldOf(db, me, character);   // INT3 (AUDIT INT): a held character auctions nothing
  if (held) return held;
  if (await overRate(ctx, `market-post:${me}`, MARKET_POSTS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await settle(ctx, player);   // MARKET-AUDIT: as a listing posted - a listing past its hours, unsettled, stood among the thirty
  if (await db.prepare('SELECT 1 FROM market_deliveries WHERE provenance = ?1 AND collected = 0').bind(provenance).first()) return { error: 'market-uncollected' };
  if (await db.prepare("SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?1").bind(provenance).first()) return { error: 'market-standing' };
  const fee = listingFee(opening);
  const id = mintId(rand);
  const nonce = mintId(rand);
  const own = hubsOf(hubs);
  const posted = 'EXISTS (SELECT 1 FROM market_auctions WHERE seller = ?1 AND rid = ?2 AND n = ?3)';
  await db.batch([
    // THE DECISION: the fee held, a place among the thirty, and the piece - this account's Masterwork, on no sale, on no
    // road, standing in no home - and the id not spent
    db.prepare(`INSERT OR IGNORE INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, rid, n)
      SELECT ?3, ?1, ?2, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?8
        AND ${openSalesSql('?9')} < ?13
        AND EXISTS (SELECT 1 FROM products WHERE provenance = ?5 AND owner = ?1 AND listed = 0 AND quality = ?14 AND COALESCE(bought_with, '') != 'gold')   -- GOLD-MARKET
        AND NOT EXISTS (SELECT 1 FROM market_listings WHERE provenance = ?5 AND state = 'open')
        AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = ?5 AND collected = 0)
        AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?5)
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?11 || ':afee')`)
      .bind(me, character, id, region, provenance, wear, opening, fee, nowS, nowS + AUCTION_S, rid, nonce, auctionsMax, MASTERWORK),
    db.prepare(`UPDATE products SET listed = 1 WHERE provenance = ?4 AND ${posted}`).bind(me, rid, nonce, provenance),
    // SEAT1d: the board it was posted at - its Tithe's seat
    ...(boardOf(board) ? [db.prepare('UPDATE market_auctions SET board_x = ?4, board_y = ?5 WHERE seller = ?1 AND rid = ?2 AND n = ?3')
      .bind(me, rid, nonce, boardOf(board)[0], boardOf(board)[1])] : []),
    // the fee burnt - `:afee`, never a listing's `:fee`, so one id cannot hold both
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', ?1, 'burn', NULL, 'market-fee', fee, ?4, at, ?1, id, rid || ':afee' FROM market_auctions WHERE seller = ?1 AND rid = ?2 AND n = ?3`)
      .bind(me, rid, nonce, utcDay(nowS)),
    ...witnessStatements(db, player, nowS, [region], own, 'EXISTS (SELECT 1 FROM market_auctions WHERE seller = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const row = await db.prepare('SELECT * FROM market_auctions WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  if (row?.n === nonce) return answer(row);
  if (row) return answer(row, { repeat: true });
  if (await spent(db, me, rid, ':afee')) return { error: 'prof-rid' };
  if ((await balanceOf(db, me)) < fee) return { error: 'marks-short' };
  const open = await db.prepare(`SELECT ${openSalesSql('?2')} AS n`).bind(me, nowS).first();
  if (Number(open?.n ?? 0) >= auctionsMax) return { error: 'market-listings-max' };
  const p = await db.prepare('SELECT owner, listed, quality, bought_with FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!p) return { error: 'market-no-record' };   // AUDIT 31 H1: no record at all - never "another owner's"
  if (p.owner !== me) return { error: 'market-not-yours' };
  if (Number(p.quality) !== MASTERWORK) return { error: 'auction-not-masterwork' };
  if (p.bought_with === 'gold') return { error: 'market-gold-goods' };   // GOLD-MARKET: an auction is in Drakes
  return { error: 'market-listed' };
}

/**
 * BID: `{ character, region, auction, amount, hubs?, rid }` - at least the auction's next bid, escrowed with the courier
 * from this board's region to the auction's; the standing bid outbid (its escrow back on its bidder's read), the end
 * moved two minutes on by a bid in its last two. The decision is the auction row's own update, keyed on the standing
 * bid the next was read from - one standing bid an auction is an index, so the new bid's row follows the old one's
 * outbidding.
 */
export async function marketBid(ctx, player, env, { character, region, auction: id, amount, hubs, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (b, extra = {}) => {
    const a = await db.prepare('SELECT * FROM market_auctions WHERE id = ?1').bind(b.auction).first();
    return { ok: true, ...extra, bid: bidView(b), ...(a ? { auction: auctionView(a, me, { leading: a.high_bid === b.id }) } : {}), balance: await balanceOf(db, me) };
  };
  const prior = await db.prepare('SELECT * FROM market_bids WHERE bidder = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!idOk(id)) return { error: 'bad-listing' };
  if (!bidOk(amount)) return { error: 'bad-bid' };   // AUDIT 31 L6: a bid's bound is the Marks cap, never a price's
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const a = await db.prepare(`SELECT a.*, (SELECT bidder FROM market_bids WHERE id = a.high_bid) AS high_bidder FROM market_auctions a WHERE a.id = ?1`).bind(id).first();
  if (!a || a.state !== 'open' || Number(a.ends_at) <= nowS) return { error: 'market-gone' };
  if (a.seller === me) return { error: 'market-own' };
  if (a.high_bidder === me) return { error: 'auction-leading' };
  const high = a.high == null ? null : Number(a.high);
  const next = auctionNext(high, Number(a.opening));
  if (amount < next) return { error: 'auction-low' };
  const from = Number(a.region);
  const own = hubsOf(hubs);
  const road = courierOf(await hubsAt(db, [from, region], own), from, region, 1, courierSlow(env, nowS, region));
  if (!road) return { error: 'market-no-road' };
  const held = amount + road.courier;
  const bidId = mintId(rand);
  const nonce = mintId(rand);
  const decided = 'EXISTS (SELECT 1 FROM market_auctions WHERE id = ?1 AND bn = ?2 AND high_bid = ?3)';
  await db.batch([
    // THE DECISION: still open and not ended, not the seller's, the standing bid the one the next was read from and not
    // this bidder's, the amount at least the next, the bidder's Marks for it and its courier, the id not spent
    db.prepare(`UPDATE market_auctions SET high = ?4, high_bid = ?5, bids = bids + 1, bn = ?6,
        ends_at = CASE WHEN ends_at - ?7 < ?8 THEN ends_at + ?9 ELSE ends_at END
      WHERE id = ?1 AND state = 'open' AND ends_at > ?7 AND seller != ?2 AND high IS ?3
        AND NOT EXISTS (SELECT 1 FROM market_bids WHERE id = market_auctions.high_bid AND bidder = ?2)
        AND ?4 >= ?10
        AND COALESCE((SELECT balance FROM marks WHERE account = ?2), 0) >= ?11
        AND NOT EXISTS (SELECT 1 FROM market_bids WHERE bidder = ?2 AND rid = ?12)
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?2 AND rid = ?12 || ':bid')`)
      .bind(id, me, high, amount, bidId, nonce, nowS, AUCTION_LATE_S, AUCTION_ADD_S, next, held, rid),
    // the standing bid outbid - its escrow back on its bidder's read
    db.prepare(`UPDATE market_bids SET state = 'outbid' WHERE auction = ?1 AND state = 'high' AND id != ?3 AND ${decided}`).bind(id, nonce, bidId),
    db.prepare(`INSERT INTO market_bids (id, auction, bidder, char_id, region, amount, courier, road, seconds, state, at, rid, n)
      SELECT ?3, ?1, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'high', ?11, ?12, ?2 WHERE ${decided}`)
      .bind(id, nonce, bidId, me, character, region, amount, road.courier, road.road, road.seconds, nowS, rid),
    // the bid and its courier held on the ledger's escrow end, under the bid's own id
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', bidder, 'escrow', id, 'bid-escrow', amount + courier, ?3, at, bidder, auction, rid || ':bid' FROM market_bids WHERE id = ?1 AND n = ?2`)
      .bind(bidId, nonce, utcDay(nowS)),
    ...witnessStatements(db, player, nowS, [from, region], own, 'EXISTS (SELECT 1 FROM market_bids WHERE bidder = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_bids WHERE bidder = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':bid')) return { error: 'prof-rid' };
  const now = await db.prepare(`SELECT a.*, (SELECT bidder FROM market_bids WHERE id = a.high_bid) AS high_bidder FROM market_auctions a WHERE a.id = ?1`).bind(id).first();
  if (!now || now.state !== 'open' || Number(now.ends_at) <= nowS) return { error: 'market-gone' };
  if (now.high_bidder === me) return { error: 'auction-leading' };
  const nowNext = auctionNext(now.high == null ? null : Number(now.high), Number(now.opening));
  if (amount < nowNext) return { error: 'auction-low' };   // another bid landed between: the refusal a word, the next on the re-read
  if ((await balanceOf(db, me)) < held) return { error: 'marks-short' };
  // AUDIT 31 S4: another bid landed between the read and the decision, and this one would still beat it - never "no
  // longer on the market" while it stands; the tab reads it again
  return { error: 'auction-moved' };
}

/** An auction cancelled by its seller while no bid stands - its piece answered back to the pack, the fee kept. */
async function auctionCancel(ctx, player, id, rid) {
  const { db, nowS, rand } = ctx;
  const me = player.id;
  const a = await db.prepare('SELECT * FROM market_auctions WHERE id = ?1 AND seller = ?2').bind(id, me).first();
  if (!a || a.state !== 'open') return { error: 'market-gone' };
  if (a.high_bid != null) return { error: 'auction-bid-standing' };
  const nonce = mintId(rand);
  await db.batch([
    db.prepare(`UPDATE market_auctions SET state = 'cancelled', closed_at = ?3, returned = 1, cancel_rid = ?4, rn = ?5
      WHERE id = ?1 AND seller = ?2 AND state = 'open' AND high_bid IS NULL`).bind(id, me, nowS, rid, nonce),
    db.prepare(`UPDATE products SET listed = 0 WHERE provenance = (SELECT provenance FROM market_auctions WHERE id = ?1 AND rn = ?2)`).bind(id, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM market_auctions WHERE seller = ?1 AND cancel_rid = ?2').bind(me, rid).first();
  if (made) return auctionCancelled(db, me, made, made.rn === nonce ? {} : { repeat: true });
  const now = await db.prepare('SELECT state, high_bid FROM market_auctions WHERE id = ?1').bind(id).first();
  return { error: now?.state === 'open' && now.high_bid != null ? 'auction-bid-standing' : 'market-gone' };
}
async function auctionCancelled(db, me, a, extra = {}) {
  const p = await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(a.provenance).first();
  return { ok: true, ...extra, auction: auctionView(a, me), piece: pieceOf(p, a.wear), balance: await balanceOf(db, me) };
}

// ─── REPORTS AND REMOVAL (section 20) ────────────────────────────────

/** REPORT: `{ listing }` - once a registered reader; counted for the moderators, hiding nothing. */
export async function marketReport(ctx, player, env, { listing: id } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { needRid: false, needChar: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  if (!idOk(id)) return { error: 'bad-listing' };
  if (await overRate(ctx, `market:${player.id}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const l = await db.prepare('SELECT seller, state FROM market_listings WHERE id = ?1').bind(id).first();
  // PROF5b: an auction is reported as a listing is, in its own table
  const a = l ? null : await db.prepare('SELECT seller, state FROM market_auctions WHERE id = ?1').bind(id).first();
  const row = l ?? a;
  if (!row || row.state !== 'open') return { error: 'market-gone' };
  if (row.seller === player.id) return { error: 'market-own' };
  if (l) await db.prepare('INSERT OR IGNORE INTO market_reports (listing, reporter, at) VALUES (?1, ?2, ?3)').bind(id, player.id, nowS).run();
  else await db.prepare('INSERT OR IGNORE INTO market_auction_reports (auction, reporter, at) VALUES (?1, ?2, ?3)').bind(id, player.id, nowS).run();
  return { ok: true };
}

/** REMOVE: `{ listing }` - a moderator's: the listing off every board, its goods returned on its seller's next read.
 *  PROF5b: an auction likewise - its standing bid voided (its escrow back on its bidder's read), its piece returned. */
export async function marketRemove(ctx, player, env, { listing: id } = {}) {
  const { db, nowS, rand } = ctx;
  if (!canModerate(player, env)) return { error: 'not-moderator' };
  if (!idOk(id)) return { error: 'bad-listing' };
  const r = await db.prepare(`UPDATE market_listings SET state = 'removed', closed_at = ?2 WHERE id = ?1 AND state = 'open'`).bind(id, nowS).run();
  if (r.meta?.changes) return { ok: true };
  const nonce = mintId(rand);
  await db.batch([
    db.prepare(`UPDATE market_auctions SET state = 'removed', closed_at = ?2, cn = ?3 WHERE id = ?1 AND state = 'open'`).bind(id, nowS, nonce),
    db.prepare(`UPDATE market_bids SET state = 'void' WHERE auction = ?1 AND state = 'high'
      AND EXISTS (SELECT 1 FROM market_auctions WHERE id = ?1 AND cn = ?2 AND state = 'removed')`).bind(id, nonce),
  ]);
  const a = await db.prepare('SELECT cn FROM market_auctions WHERE id = ?1').bind(id).first();
  return a?.cn === nonce ? { ok: true } : { error: 'market-gone' };
}

// ─── HOME-VENDOR: A HOME'S TRADER, AND THE REGION'S TRADERS ─────────────────

/** A trader as its stock's reader sees it: where it stands and whose it is. */
const vendorView = (v, me) => ({ map: Number(v.map_id), id: v.id, buildingKey: Number(v.building_key), region: Number(v.region), owner: v.owner_name, mine: v.player === me });

/**
 * HOME-VENDOR: A TRADER'S STOCK - `{ vendor: { map, id } }`, read by anyone the market is open to (a visitor at the
 * stall, its owner stocking it): the trader, and its open pieces, newest first. 'vendor-gone' where no trader stands.
 */
export async function marketVendor(ctx, player, env, { vendor = null } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { needRid: false, needChar: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  const vend = vendorOf(vendor);
  if (!vend) return { error: 'bad-vendor' };
  const v = await db.prepare(`SELECT d.map_id, d.id, h.building_key, h.region, h.owner_name, h.player FROM home_decor d
    JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key WHERE ${VENDOR_STANDS_SQL}`).bind(vend.map, vend.id).first();
  if (!v) return { error: 'vendor-gone' };
  await reckonPatrons(ctx, { maps: [vend.map] }, env).catch(() => null);   // LW15: the town's patrons first, lazily
  const { results = [] } = await db.prepare(`SELECT * FROM market_listings WHERE vendor_map = ?1 AND vendor_id = ?2 AND state = 'open'
    AND expires_at > ?3 AND seller = ?4 ORDER BY at DESC LIMIT ${VENDOR_STOCK_SHOWN}`).bind(vend.map, vend.id, nowS, v.player).all();
  // AUDIT LW-II-2 S7: its own house's sales alone - a piece's id is its owner's client's, so another's trader of the same
  // id in the town told its sales at this one's stall (AUDIT LW-II P9's case, at the trader's own read)
  const patrons = (await patronsTold(db, [vend.map], nowS).catch(() => [])).filter((p) => p.vendor === vend.id && p.buildingKey === Number(v.building_key));
  return { ok: true, vendor: vendorView(v, player.id), rows: results.map((l) => listingView(l, player.id)), patrons };
}

/**
 * HOME-VENDOR: THE REGION'S TRADERS - `{ region, character? }`: every open piece standing at a trader of a home in that
 * region, newest first, each with its trader (the Notice Board's Vendors tab searches these by the item, the owner, the
 * town) and its house's DOOR as the town answer says it (homes.js townHomes: `entry`, `mine`, `guildmate`, `tenant`) for
 * the character named - so the client keeps only the traders that character may walk in on (net/homeLaw.js homeMayEnter,
 * the door's own law; a party's names are the relay's, never the service's). A guild's hall stands no trader.
 */
export async function marketVendors(ctx, player, env, { region, character = null } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { needRid: false, needChar: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  await reckonPatrons(ctx, { region }, env).catch(() => null);   // LW15: the region's patrons first, lazily
  const me = typeof character === 'string' && CHAR_ID_RE.test(character) ? character : '';
  const columns = `l.*, d.map_id AS v_map, d.id AS v_id, h.building_key AS v_key, h.owner_name AS v_owner, h.player AS v_player,
      h.entry AS v_entry, (h.player = ?3 AND h.char_id = ?4) AS v_mine,
      (h.entry = 'guild' AND EXISTS (SELECT 1 FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id
        WHERE a.player = h.player AND a.char_id = h.char_id AND b.player = ?3 AND b.char_id = ?4)) AS v_guildmate,
      (SELECT MAX(r.until) FROM home_rooms r WHERE r.map_id = h.map_id AND r.building_key = h.building_key AND r.tenant = ?3 AND r.tenant_char = ?4 AND r.until > ?1) AS v_tenancy`;
  const { results: newest = [] } = await db.prepare(`SELECT ${columns}
    FROM market_listings l JOIN home_decor d ON d.map_id = l.vendor_map AND d.id = l.vendor_id
    JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
    WHERE l.state = 'open' AND l.expires_at > ?1 AND l.vendor_id IS NOT NULL AND h.region = ?2 AND h.player = l.seller AND d.yard = 0
      AND h.guild_id IS NULL AND json_extract(d.place, '$.station') = '${VENDOR_STATION}'
    ORDER BY l.at DESC LIMIT ${VENDOR_BOARD_SHOWN}`).bind(nowS, region, player.id, me).all();
  // AUDIT LW-II-2 W6: AND EVERY PUBLIC TRADER OF THE REGION its patrons may buy of - each such house's newest piece, where
  // the board's VENDOR_BOARD_SHOWN newest left the house out: the towns' word reads its traders off these rows (world.js
  // livingPatronsStep), and a quieter trader under a busier region's newest three hundred stood in no town - no browser
  // came, and its town's word was forgotten. Bounded as the board is: a house a row, VENDOR_BOARD_SHOWN of them
  const { results: houses = [] } = await db.prepare(`SELECT * FROM (SELECT ${columns},
      ROW_NUMBER() OVER (PARTITION BY d.map_id, d.building_key, d.id ORDER BY l.at DESC, l.id) AS v_rank
    ${PATRON_FROM} WHERE ${PATRON_SQL} AND l.expires_at > ?1 AND h.region = ?2) WHERE v_rank = 1
    ORDER BY at DESC LIMIT ${VENDOR_BOARD_SHOWN}`).bind(nowS, region, player.id, me).all();
  const traderOf = (/** @type {any} */ l) => `${l.v_map}:${l.v_key}:${l.v_id}`;
  const shown = new Set(newest.map(traderOf));
  const results = [...newest, ...houses.filter((l) => !shown.has(traderOf(l)))];
  return {
    ok: true, region,
    patrons: await patronsTold(db, { region }, nowS).catch(() => []),   // LW15: the region's patrons' purchases, for its towns to draw
    rows: results.map((l) => listingView(l, player.id, {
      vendor: { map: Number(l.v_map), id: l.v_id }, map: Number(l.v_map), buildingKey: Number(l.v_key), owner: l.v_owner,
      // the house's door, as the town answer says it to this character (homeMayEnter's own fields)
      home: { owner: l.v_owner, entry: l.v_entry, mine: Number(l.v_mine) === 1,
        ...(Number(l.v_guildmate) === 1 ? { guildmate: true } : {}), ...(Number.isSafeInteger(l.v_tenancy) && l.v_tenancy > nowS ? { tenant: Number(l.v_tenancy) } : {}) },
    })),
  };
}

/**
 * HOME-VENDOR: MY TRADERS - `{ character }`: the Vendor page's read (the pause window's, beside the Professions). Every
 * trader of this character's homes (where it stands), the pieces standing at them, the pieces they have SOLD (newest
 * first, while the market keeps the sale's listing), and the gold the sales hold to collect at any board.
 */
export async function marketMyVendors(ctx, player, env, { character } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { character, needRid: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  const me = player.id;
  const { results: traders = [] } = await db.prepare(`SELECT d.map_id, d.id, h.building_key, h.region, h.owner_name, h.player FROM home_decor d
    JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
    WHERE h.player = ?1 AND h.char_id = ?2 AND d.yard = 0 AND json_extract(d.place, '$.station') = '${VENDOR_STATION}' ORDER BY h.map_id, d.id`).bind(me, character).all();
  await reckonPatrons(ctx, { maps: [...new Set(traders.map((v) => Number(v.map_id)))] }, env).catch(() => null);   // LW15: my traders' towns' patrons first
  const { results: stock = [] } = await db.prepare(`SELECT * FROM market_listings WHERE seller = ?1 AND char_id = ?2 AND vendor_id IS NOT NULL AND state = 'open'
    AND expires_at > ?3 ORDER BY at DESC LIMIT ${VENDOR_STOCK_SHOWN * 2}`).bind(me, character, nowS).all();
  const { results: sold = [] } = await db.prepare(`SELECT s.listing, s.price, s.total, s.tax, s.tithe, s.fee, s.at, l.item, l.vendor_map, l.vendor_id
    FROM market_sales s JOIN market_listings l ON l.id = s.listing
    WHERE s.seller = ?1 AND l.char_id = ?2 AND l.vendor_id IS NOT NULL ORDER BY s.at DESC LIMIT ${VENDOR_STOCK_SHOWN}`).bind(me, character).all();
  const gold = await db.prepare('SELECT gold FROM market_gold WHERE player = ?1 AND char_id = ?2').bind(me, character).first();
  // LW15: what the town's patrons bought - the buyer the seed the client deals to a resident of the town
  const { results: patronSold = [] } = await db.prepare(`SELECT s.listing, s.map, s.hour, s.minute, s.seed, s.price, s.tax, s.fee, s.gets, s.at, l.item, l.vendor_map, l.vendor_id
    FROM market_patron_sales s JOIN market_listings l ON l.id = s.listing WHERE s.seller = ?1 AND s.char_id = ?2 ORDER BY s.at DESC LIMIT ${VENDOR_STOCK_SHOWN}`).bind(me, character).all();
  return {
    ok: true,
    patronSold: patronSold.map((s) => ({
      listing: s.listing, item: goodOf(s.item), price: Number(s.price), total: Number(s.price), gets: Number(s.gets), at: Number(s.at),
      vendor: { map: Number(s.vendor_map), id: s.vendor_id }, patron: { map: Number(s.map), seed: Number(s.seed), hour: Number(s.hour), minute: Number(s.minute) },
    })),
    traders: traders.map((v) => vendorView(v, me)),
    stock: stock.map((l) => listingView(l, me, { vendor: { map: Number(l.vendor_map), id: l.vendor_id } })),
    sold: sold.map((s) => ({
      listing: s.listing, item: goodOf(s.item), price: Number(s.price), total: Number(s.total),
      gets: Math.max(0, Number(s.total) - Number(s.tax) - Number(s.tithe) - Number(s.fee ?? 0)), at: Number(s.at),
      vendor: { map: Number(s.vendor_map), id: s.vendor_id },
    })),
    gold: Number(gold?.gold ?? 0),
  };
}

// ─── LW15: THE PATRONS (bible/06-Systems/Living-World-II.md "LW15") ─

/** The towns one firing of the hour's cron reckons (the rest the next, or their next read). */
export const PATRON_CRON_TOWNS = 40;
/** AUDIT LW-II P5: THE STATEMENTS ONE READ'S RECKONING MAY RUN - counted as the cron's share is (cron.js countedDb), a
 *  third of a firing's: D1 answers an invocation a thousand queries, and one read of a region two days behind ran 5,826.
 *  Spent, the reckoning stops between hours and marks the last it finished; the next read, or the hour's cron, goes on. */
export const PATRON_READ_STATEMENTS = 200;
/** How far back a trader's answer tells its patrons' purchases (the client draws the buyer coming in). */
export const PATRON_TOLD_S = 86_400;
/** A trader's home the patrons see: one the town may enter (`public`) whose owner stocks it, the trader standing in it
 *  (`d` the trader, `h` its home, `l` the listing). */
const PATRON_HOME_SQL = `h.entry = 'public' AND h.player = l.seller AND d.yard = 0 AND h.guild_id IS NULL
  AND json_extract(d.place, '$.station') = '${VENDOR_STATION}'`;
/** A trader's listings the patrons see: gold, a pack's piece, at such a home. */
const PATRON_SQL = `l.state = 'open' AND l.vendor_id IS NOT NULL AND l.currency = 'gold' AND l.kind = 'item' AND ${PATRON_HOME_SQL}`;
const PATRON_FROM = `FROM market_listings l JOIN home_decor d ON d.map_id = l.vendor_map AND d.id = l.vendor_id
  JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key`;
/** AUDIT LW-II P4: a listing's seller the judge holds (realm.js holdRefusal's own: held, or a record no checkpoint has
 *  read) - `l` the listing. Asked in the sale's write; AUDIT LW-II-2 S5: and with the town's listings, so a held seller's
 *  pieces are no candidates - refused in the write alone they stayed the hour's lowest draws, every hour, and an honest
 *  seller beside four held ones sold a fraction of what it sold alone. */
const PATRON_HELD_SQL = `EXISTS (SELECT 1 FROM realm_characters c WHERE c.id = l.char_id AND c.player = l.seller AND (c.held IS NOT NULL OR c.judged_seq IS NULL))`;
/** A TOWN'S TRADERS' LISTINGS, every open one its reckoning's mark moves - each once, with the house a patron may walk into
 *  for it (`bkey`; none, a listing no patron sees) and whether its seller is held (`held`). AUDIT LW-II P7: a town whose
 *  traders stand all in homes no patron may enter is marked too, so its hours never wait to be paid when a door opens;
 *  AUDIT LW-II P5: and the mark is written only where one would move. */
const PATRON_TOWN_SQL = `SELECT l.id, l.seller, l.char_id, l.kind, l.price, l.item, l.at, l.expires_at, l.patron_hour,
    (SELECT h.building_key FROM home_decor d JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
      WHERE d.map_id = l.vendor_map AND d.id = l.vendor_id AND ${PATRON_HOME_SQL} LIMIT 1) AS bkey, ${PATRON_HELD_SQL} AS held
  FROM market_listings l WHERE l.vendor_map = ?1 AND l.state = 'open' AND l.vendor_id IS NOT NULL AND l.currency = 'gold'`;
/** AUDIT LW-II P5/P6: AN HOUR'S COUNTS, ONE ASK - the town's sales in the hour (`seller` NULL) and each of the hour's
 *  candidates' sellers' sales in it and gold that real day, by the day (idx_patron_sales_seller): `?1` the town, `?2` the
 *  hour, `?3` its day, `?4` the sellers (JSON). Asked only for an hour some listing draws under its odds. */
export const PATRON_COUNTS_SQL = `SELECT NULL AS seller, COUNT(*) AS n, 0 AS g FROM market_patron_sales WHERE map = ?1 AND hour = ?2
  UNION ALL SELECT seller, SUM(hour = ?2), SUM(price) FROM market_patron_sales WHERE day = ?3 AND seller IN (SELECT value FROM json_each(?4)) GROUP BY seller`;
/** AUDIT LW-II P6: the region's read of its last day's sales (idx_patron_sales_region), and the towns' (`?2...`). */
export const PATRON_TOLD_SQL = (/** @type {string} */ where) => `SELECT s.listing, s.map, s.hour, s.minute, s.seed, s.price, s.at, s.building_key, l.item, l.vendor_id
  FROM market_patron_sales s JOIN market_listings l ON l.id = s.listing WHERE ${where} AND s.at > ?1 ORDER BY s.at DESC LIMIT ${VENDOR_BOARD_SHOWN}`;

/**
 * AUDIT LW-II P10: THE DRAW'S SECRET (patronLaw.js patronDraw) - the service's own, derived from a secret it already keeps
 * (`IDENTITY_PRIVATE_KEY`, the identity token's signing key: a SHA-256 of it under this purpose's own words, never the
 * key itself). The same every reckoning, so reckoned late is reckoned on time; '' for a service with no key (the draw
 * then the listing's and the hour's alone).
 * @param {any} env @returns {Promise<string>}
 */
export async function patronSalt(env) {
  const key = typeof env?.IDENTITY_PRIVATE_KEY === 'string' ? env.IDENTITY_PRIVATE_KEY : '';
  if (!key) return '';
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lw15-patron-draw\n${key}`)));
  return Array.from(hash.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** AUDIT LW-II P11: the sale's own guard refusing (realm.js mustChange: its INSERT wrote nothing - sold already, taken
 *  back, the purse full, a ceiling reached, the seller held) - the one failure a patron passes the piece by for. */
const guardRefused = (/** @type {any} */ e) => /moved = expected/.test(`${e?.message ?? e} ${e?.cause?.message ?? ''}`);

/**
 * LW15: THE PATRONS RECKONED (src/net/patronLaw.js, both ends' law) - each town's traders' listings over the whole hours
 * since they were last reckoned (at most PATRON_RECKON_HOURS): the hour's sales, each its own batch - the piece sold
 * (gone from the realm: no delivery), the 5% tax and the 1% fee burnt, the rest to the seller's held gold (never past
 * MARKET_GOLD_HELD_MAX: a patron passes by a trader whose purse is full), the gold written to the service's own faucet
 * (budget.js, kind `patron`). Keyed by the listing (market_patron_sales): reckoned twice, sold once; reckoned late, the
 * same sales (the dice are the listing's, the hour's and the service's secret's - `env`'s, patronSalt). `maps` the
 * towns to reckon, `region` a region's, else (the hour's cron) the towns waiting, PATRON_CRON_TOWNS of them - the
 * longest waiting first. A read (no `ctx.budget`) runs PATRON_READ_STATEMENTS at most.
 * AUDIT LW-II-2 S3: only while the market is open to EVERYONE (marketOpenFor, no account's) - behind `dev` a developer's
 * read of a region reckoned every seller's towns, their pieces sold and their gold minted while each of their own routes
 * answered 'market-closed' (the hour's cron marks the hours instead: markPatronsShut).
 * @param {any} ctx @param {{ maps?: number[] | null, region?: number | null }} [o] @param {any} [env]
 */
export async function reckonPatrons(ctx, { maps = null, region = null } = {}, env = null) {
  if (!marketOpenFor(null, env)) return { sold: 0, towns: 0 };
  const { nowS } = ctx;
  const tally = { n: 0 };
  const db = ctx.budget ? ctx.db : countedDb(ctx.db, tally);
  const budget = ctx.budget ?? (() => tally.n < PATRON_READ_STATEMENTS);
  const salt = await patronSalt(env);
  const hourNow = Math.floor(nowS / PATRON_HOUR_S);
  let towns = Array.isArray(maps) ? maps.filter((m) => Number.isSafeInteger(m)) : null;
  if (!towns) {
    // AUDIT LW-II P5: the towns waiting LONGEST first - in the map's own order a firing's share reached the same towns
    // every hour, and the rest never (47 of 60 never reckoned in a day)
    const { results = [] } = await db.prepare(`SELECT l.vendor_map AS map ${PATRON_FROM} WHERE ${PATRON_SQL}
      AND COALESCE(l.patron_hour, l.at / ${PATRON_HOUR_S}) < ?1 - 1 ${regionOk(region) ? 'AND h.region = ?2' : ''}
      GROUP BY l.vendor_map ORDER BY MIN(COALESCE(l.patron_hour, l.at / ${PATRON_HOUR_S})), l.vendor_map LIMIT ${PATRON_CRON_TOWNS}`)
      .bind(hourNow, ...(regionOk(region) ? [region] : [])).all();
    towns = results.map((r) => Number(r.map));
  }
  let sold = 0;
  for (const map of towns) {
    if (!budget()) break;   // the share spent: the rest the next
    const { results: rows = [] } = await db.prepare(PATRON_TOWN_SQL).bind(map).all();
    const ls = [];
    for (const r of rows) {
      if (r.bkey == null || r.kind !== 'item') continue;   // no patron sees it: its mark moves, and nothing else
      const item = goodOf(r.item);
      // AUDIT LW-II-2 S8: each listing judged alone - a piece the judge throws on (one listed before a law, read again by
      // it) is passed by, never the reckoning of every town the cron reaches after it (its town waited longest, so the
      // job threw there every firing and no town was reckoned)
      let worth = 0, takes = false, key = null;
      try {
        worth = item ? patronWorth(item, itemWorth) : 0;
        // AUDIT LW-II P3: the item law's re-reading, as a player's buy asks it (marketBuy: a piece listed before the law,
        // or one a later law refuses, is sold to nobody); AUDIT LW-II-2 S5: never a held seller's
        takes = !Number(r.held) && patronTakes(item) && lawfulItem(item) && !goodRefusal(item);
        key = item ? ledgerKeyOf(item) : null;   // AUDIT LW-II-2 S2: the piece the ledger follows
      } catch { worth = 0; takes = false; }
      ls.push({ id: r.id, seller: r.seller, char: r.char_id, price: Number(r.price), at: Number(r.at), expires: Number(r.expires_at), last: r.patron_hour == null ? null : Number(r.patron_hour),
        bkey: Number(r.bkey), worth, takes, key });
    }
    const hours = [...new Set(ls.flatMap((l) => patronHours(l.last, l.at, nowS)))].sort((a, b) => a - b);
    const gone = new Set();
    let partial = false, reached = null;
    try {
      for (const hour of hours) {
        if (!budget()) { partial = true; break; }   // an hour unreckoned stays to reckon: the mark moved to the last whole one
        const open = ls.filter((l) => !gone.has(l.id) && Math.floor(l.at / PATRON_HOUR_S) + 1 <= hour && l.expires >= (hour + 1) * PATRON_HOUR_S && (l.last == null || l.last < hour));
        // AUDIT LW-II P5: the law's dice first - an hour no listing draws under its odds asks the database nothing
        const cands = patronCands(open, hour, salt).map((c) => c.l);
        if (cands.length) {
          const day = utcDay(hour * PATRON_HOUR_S);
          const { results: counts = [] } = await db.prepare(PATRON_COUNTS_SQL).bind(map, hour, day, JSON.stringify([...new Set(cands.map((l) => l.seller))])).all();
          let townN = 0;
          const sellerHour = new Map(), sellerDay = new Map();
          for (const c of counts) {
            if (c.seller == null) townN = Number(c.n ?? 0);
            else { sellerHour.set(c.seller, Number(c.n ?? 0)); sellerDay.set(c.seller, Number(c.g ?? 0)); }
          }
          for (const sale of patronHour(cands, hour, { sold: townN, sellerHour, sellerDay, salt })) {
            const l = /** @type {any} */ (cands.find((x) => x.id === sale.id));
            const { tax, fee, gets } = goldSaleOf(0, sale.price);
            const at = hour * PATRON_HOUR_S + sale.minute * 60;
            // AUDIT LW-II-2 S2: a piece the ledger follows lies in its escrow (INT4 - listed, the market's): the claim standing
            // on it, read for the sale to tell the ledger the piece is gone
            const claim = l.key ? ((await db.prepare("SELECT claim_char FROM item_uids WHERE uid = ?1 AND state = 'escrow'").bind(l.key).first())?.claim_char ?? null) : null;
            try {
              await db.batch([
                // THE DECISION: the listing open at its price, its seller's held gold with room - the sale its own row, once.
                // AUDIT LW-II P1: and THE CEILINGS asked in the write itself - the town's hour, the seller's hour and the
                // seller's day, as the sales stand when it lands (read before it, a region's towns reckoned at once each
                // sold its seller to the ceiling: twelve an hour, 48,337 a day). AUDIT LW-II P4: never a seller the judge
                // holds (realm.js holdRefusal's own: held, or a record no checkpoint has read)
                db.prepare(`INSERT OR IGNORE INTO market_patron_sales (listing, map, hour, minute, seed, seller, char_id, region, price, tax, fee, gets, at, day, building_key)
                  SELECT l.id, ?2, ?3, ?4, ?5, l.seller, l.char_id, l.region, l.price, ?6, ?7, ?8, ?9, ?10, ?13 FROM market_listings l WHERE l.id = ?1 AND l.state = 'open'
                    AND l.price = ?11 AND COALESCE((SELECT gold FROM market_gold WHERE player = l.seller AND char_id = l.char_id), 0) + ?8 <= ?12
                    AND (SELECT COUNT(*) FROM market_patron_sales WHERE map = ?2 AND hour = ?3) < ${PATRON_TOWN_HOUR}
                    AND (SELECT COUNT(*) FROM market_patron_sales WHERE seller = l.seller AND day = ?10 AND hour = ?3) < ${PATRON_SELLER_HOUR}
                    AND (SELECT COALESCE(SUM(price), 0) FROM market_patron_sales WHERE seller = l.seller AND day = ?10) + l.price <= ${PATRON_SELLER_DAY_GOLD}
                    AND NOT ${PATRON_HELD_SQL}`)
                  .bind(l.id, map, hour, sale.minute, sale.seed, tax, fee, gets, at, day, sale.price, MARKET_GOLD_HELD_MAX, l.bkey),
                mustChange(db),
                db.prepare(`UPDATE market_listings SET own = 0, bought = 0, state = 'sold', closed_at = ?2 WHERE id = ?1`).bind(l.id, at),
                db.prepare(`INSERT INTO market_gold (player, char_id, gold) VALUES (?1, ?2, ?3)
                  ON CONFLICT (player, char_id) DO UPDATE SET gold = market_gold.gold + excluded.gold`).bind(l.seller, l.char, gets),
                faucetStatement(db, 'patron', hour, gets),
                // AUDIT LW-II-2 S2: the ledger told - the piece out of the realm, a copy claiming it charged to its claimant
                ...(l.key ? escrowSpentSteps(db, l.key, claim, nowS) : []),
              ]);
              gone.add(l.id);
              sold++;
            } catch (e) {
              // the guard's own: sold already, taken back, the purse full, a ceiling reached, the seller held - the patron
              // passes it by. AUDIT LW-II P11: anything else stops the town here, its hours from this one reckoned again
              if (!guardRefused(e)) throw e;
            }
          }
        }
        reached = hour;
      }
    } catch (e) {
      partial = true;
      console.warn('[patrons] a town\'s reckoning stopped', map, e?.message ?? e);
    }
    // the hours reckoned: each listing still open, to the last whole hour - or, the budget spent (or the reckoning
    // stopped), to the last hour it finished (the next firing goes on from it: a town nobody reads is reckoned through,
    // firing by firing). AUDIT LW-II P5: written only where a mark moves - a read in an hour already reckoned writes nothing
    const mark = partial ? reached : hourNow - 1;
    if (mark != null && rows.some((r) => !gone.has(r.id) && (r.patron_hour == null || Number(r.patron_hour) < mark))) {
      await db.prepare(`UPDATE market_listings SET patron_hour = ?2 WHERE vendor_map = ?1 AND state = 'open' AND vendor_id IS NOT NULL AND currency = 'gold'
        AND (patron_hour IS NULL OR patron_hour < ?2)`).bind(map, mark).run();
    }
  }
  return { sold, towns: towns.length };
}

/** AUDIT LW-II-2 S3: THE HOURS THE MARKET STOOD SHUT - while it is not open to everyone (shut, or its developers' alone)
 *  the hour's cron sells to no patron and MARKS every open trader listing reckoned to the hour it runs in, so the hours
 *  it stood shut are never paid when it opens (shut thirty hours, its first firing after opening paid every one of them:
 *  P8 stopped the selling, not the hours waiting). Answers the listings marked. @param {any} ctx */
export async function markPatronsShut({ db, nowS }) {
  const r = await db.prepare(`UPDATE market_listings SET patron_hour = ?1 WHERE state = 'open' AND kind = 'item' AND vendor_id IS NOT NULL AND currency = 'gold'
    AND (patron_hour IS NULL OR patron_hour < ?1)`).bind(Math.floor(nowS / PATRON_HOUR_S)).run();
  return Number(r?.meta?.changes ?? 0);
}

/** LW15: a town's patrons' purchases told to a reader (the client deals each seed to a resident and draws them coming
 *  in at the house the trader stood in at the sale - AUDIT LW-II P9: the sale's own, never a piece of the same id's):
 *  within PATRON_TOLD_S, newest first - of the towns `maps`, or of a region's (a trader sold out still tells its last
 *  day's). @param {any} db @param {number[] | { region: number }} of @param {number} nowS */
async function patronsTold(db, of, nowS) {
  const maps = Array.isArray(of) ? of : null;
  if (maps && !maps.length) return [];
  const where = maps ? `s.map IN (${maps.map((_, i) => `?${i + 2}`).join(', ')})` : 's.region = ?2';
  const { results = [] } = await db.prepare(PATRON_TOLD_SQL(where))
    .bind(nowS - PATRON_TOLD_S, ...(maps ?? [/** @type {{ region: number }} */ (of).region])).all();
  return results.map((r) => ({ listing: r.listing, map: Number(r.map), vendor: r.vendor_id, buildingKey: r.building_key == null ? null : Number(r.building_key),
    hour: Number(r.hour), minute: Number(r.minute), seed: Number(r.seed), price: Number(r.price), at: Number(r.at), name: String(goodOf(r.item)?.name ?? '') }));
}
