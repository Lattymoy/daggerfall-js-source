// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL3-ECON (2026-10-22; design doc "DFO Staff Panel: design", build step 3: "Market and trades, Node activity,
// Economy (all read existing data)") - THE PANEL'S ECONOMY SCREENS, an Admin's alone (mob, 03:03Z: Moderators get the
// chat reports, Mute and Ban; "Admin sees and does everything"). Every answer is a read of what the service already
// keeps; nothing here writes a game table.
//
//   /v1/staff/econ/stream    MARKET AND TRADES: every market sale, order fill, auction bid, settled player trade and
//                            guild vault move in one stream, newest first, paged (`before`), filtered by player, item,
//                            price, region, time and kind - each row with its flags (below)
//   /v1/staff/econ/harvests  NODE ACTIVITY: per player, harvests an hour, which nodes and materials, the gaps between
//                            harvests and the longest unbroken run, over the last day (node_harvests) and week
//                            (progress_hours) - the even-gap loops of many hours first; or one player's, by name
//   /v1/staff/econ/economy   ECONOMY: where gold and Marks sit, Marks minted and burnt, the gold the service saw come
//                            and go, a day at a time over `days`, and the twenty richest characters and guilds
//   /v1/staff/econ/guilds    PER GUILD: gold (realm and unverified legacy), Marks and vault contents, sortable, paged
//
// ═══ THE FLAGS ON A ROW (design doc, "Market and trades"; weak spot "The market 5x flag compares to the wrong prices") ═══
//
// price     a material sold 5x above or below its usual price. The usual price is the median over MARKET_MEDIAN_DAYS of
//           that material's sales IN THE ROW'S OWN CURRENCY (gold's sales never set a Drakes price, nor the other way),
//           read from the sales themselves and not the day tables: each pair of accounts counts ONCE, at its own mean
//           price, and a sale an account made to itself never - so two accounts selling to each other again and again
//           cannot make their own price the usual one. A crafted piece or a pack item has no usual price: never flagged.
// repeat    the same two accounts dealing with each other again and again (sales, fills and trades together).
// new       an account younger than its days taking much more value than it gave: a trade's goods, or a sale's distance
//           from the usual price.
// one-sided a trade where one side gave gold or goods and the other gave nothing.
// The "linked account" flag is dropped (the weak spot: nothing the service keeps links two accounts).
// Every number is in ECON_LIMITS, one place: starting numbers for Admins to tune, not measured ones.
//
// ═══ SERVER LOAD (design doc, "Server load": the existing economy reads cost 37, 56 and 96 serial trips an open, and an
// unindexed read has reset the live database once) ═══
//
// Each read is ONE batch (one trip, service.js readAll) or two where the second needs the first's answer. The stream's
// span is STREAM_SPAN_DAYS at most and pages STREAM_PAGE rows; the economy reads ECON_DAYS_MAX days at most; node
// activity is a day and a week. The heavy answers (economy, guilds, node activity, the Home watch, usual prices) are
// kept in the isolate's memory ECON_KEEP_S (node activity HARVEST_KEEP_S), keyed by the database binding, and an answer
// says when it was read (`asOf`): the panel never polls them. Every statement stands on an index migration 0153 adds or
// one already there (test/server/staffpanel3econ.test.js asks EXPLAIN QUERY PLAN).
//
// ═══ WHAT THE SERVICE CANNOT SEE ═══
//
// A character's purse, bank and letters of credit live inside its save (realm.js, R2); no table holds them. The
// economy names the places the service holds gold itself, and ranks characters by the judge's wealth at their last
// checkpoint (purse, bank, deeds and goods - judge.js wealthOf), "as last saved". Totals over every save are the census's
// (design step 4). A harvest's `at` is the game's own clock, held within HARVEST_LATE_S of the service's; the hours a
// player harvested (progress_hours) are the service's.
import { displayName } from './accounts.js';
import { findAccount } from './sanctions.js';
import { readAll, DB_ROOT } from './service.js';
import { canModerate } from './titles.js';
import { medianOf, MARKET_MEDIAN_DAYS } from '../../src/net/marketLaw.js';
import { MARK_WORTH_GOLD, utcDay } from '../../src/net/marksLaw.js';
import { liquidWorthOf } from '../../src/net/realm/realmGoldLaw.js';
import { itemWorth } from '../../src/systems/item/itemLaw.js';

const DAY_S = 86_400;

/** THE FLAGS' AND THE LEVELS' NUMBERS, one place (design doc: "The numbers are starting points for Admins to tune, not
 *  measured values"). Gold throughout; a Drake is MARK_WORTH_GOLD gold. */
export const ECON_LIMITS = Object.freeze({
  /** A material's price this many times its usual price, or this many times under it; `high` a far one. A usual price
   *  needs `pairs` pairs of accounts behind it. */
  price: Object.freeze({ ratio: 5, high: 20, pairs: 3 }),
  /** The same two accounts dealing `n` times inside `days` (the Home watch: inside one day); `high` many more. */
  repeat: Object.freeze({ days: 7, n: 5, high: 15 }),
  /** An account younger than `days` taking `gold` more than it gave in one row; `high` far more. */
  fresh: Object.freeze({ days: 7, gold: 5_000, high: 50_000 }),
  /** A trade one side gave nothing for, the other `gold` or more; `high` far more. */
  oneSided: Object.freeze({ gold: 500, high: 20_000 }),
  /** NODE ACTIVITY: a gap longer than `breakS` ends a run of harvests. High: a run of `runHigh` hours over `nodesHigh`
   *  distinct nodes whose gaps vary by `evenHigh` of their mean or less (a coefficient of variation), or `weekHigh` hours
   *  in a row with harvests this week. Medium: `runMedium` hours at `evenMedium`, or `weekMedium` hours in a row. */
  harvest: Object.freeze({ breakS: 10 * 60, runHigh: 4, runMedium: 2, evenHigh: 0.25, evenMedium: 0.4, nodesHigh: 40, weekHigh: 16, weekMedium: 10 }),
});

/** The stream's rows a page. */
export const STREAM_PAGE = 50;
/** The stream's widest window - a realm trade is kept 7 days (realmTrade.js REALM_TRADE_KEEP_S) and every source is read
 *  newest first inside it, so a filter no index serves walks this much at most. */
export const STREAM_SPAN_DAYS = 7;
/** The economy's longest reach, and its default. */
export const ECON_DAYS_MAX = 14;
export const ECON_DAYS_DEFAULT = 7;
/** How long a heavy answer is kept (design doc: "Cache them for 5-10 minutes"); node activity the shorter. */
export const ECON_KEEP_S = 10 * 60;
export const HARVEST_KEEP_S = 5 * 60;
/** Node activity: the day's busiest harvesters ranked, the week's longest unbroken runs beside them, a page. */
export const HARVEST_DAY_RANKED = 200;
export const HARVEST_WEEK_RANKED = 50;
export const HARVEST_PAGE = 50;
/** One player's own harvests listed, at most. */
export const HARVEST_ONE_MAX = 500;
/** The richest characters and guilds named. */
export const RICHEST = 20;
/** A character this wealthy or more is in the rich index (migration 0153 idx_realm_characters_rich, whose condition this
 *  literal is - the statement must say it as the index does, or the index is not used). Below it, no list is needed. */
export const RICH_FLOOR = 250_000;
/** Guilds one ranked list holds; pages of GUILDS_PAGE. */
export const GUILDS_MAX = 2000;
export const GUILDS_PAGE = 50;
/** A read is written in the audit log once in this, a member and a view (staff.js STAFF_READ_ROW_S's reason). */
const READ_ROW_S = 10 * 60;

export const ECON_ROUTES = Object.freeze(['/v1/staff/econ/stream', '/v1/staff/econ/harvests', '/v1/staff/econ/economy', '/v1/staff/econ/guilds']);

const STREAM_KINDS = Object.freeze(['sale', 'fill', 'bid', 'trade', 'vault']);
const LEVELS = Object.freeze(['low', 'medium', 'high']);
const GUILD_SORTS = Object.freeze({ gold: 'treasury', realm: 'realm_gold', legacy: 'legacy', marks: 'marks', vault: 'vault_items', members: 'members' });

// ─── KEPT ANSWERS ────────────────────────────────────────────────────

/** @type {WeakMap<object, Map<string, { until: number, value: Promise<any> }>>} */
const keptBy = new WeakMap();
/** An answer kept `ttl` seconds in this isolate, per database binding (a request's counted Proxy names its binding,
 *  service.js DB_ROOT) - the promise itself, so a burst of opens reads once; a failed read is forgotten. */
export function kept(/** @type {any} */ db, /** @type {string} */ key, /** @type {number} */ nowS, /** @type {number} */ ttl, /** @type {() => Promise<any>} */ make) {
  const root = db?.[DB_ROOT] ?? db;
  let m = keptBy.get(root);
  if (!m) { m = new Map(); keptBy.set(root, m); }
  const k = m.get(key);
  if (k && k.until > nowS) return k.value;
  const value = make();
  m.set(key, { until: nowS + ttl, value });
  value.catch(() => { if (m?.get(key)?.value === value) m.delete(key); });
  for (const [x, v] of m) if (v.until <= nowS) m.delete(x);
  return value;
}

// ─── SMALL READERS ───────────────────────────────────────────────────

const int = (/** @type {unknown} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => (Number.isSafeInteger(v) && /** @type {number} */ (v) >= lo && /** @type {number} */ (v) <= hi ? /** @type {number} */ (v) : null);
const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 64) : null);
const num = (/** @type {unknown} */ v) => Number(v) || 0;
const json = (/** @type {unknown} */ t) => { try { return typeof t === 'string' ? JSON.parse(t) : null; } catch { return null; } };
const ids = (/** @type {Iterable<unknown>} */ list) => JSON.stringify([...new Set([...list].filter((x) => typeof x === 'string' && x))]);
const nameOf = (/** @type {Map<string, any>} */ who, /** @type {string|null} */ id) => (id && who.has(id) ? displayName(who.get(id)) : null);
/** An unordered pair of accounts, as one key. */
const pairKey = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** A row's level from its flags: high when any flag is a far one or two stand, medium for one, none without. */
const levelOf = (/** @type {Array<{ high?: boolean }>} */ flags) => (!flags.length ? null : flags.length >= 2 || flags.some((f) => f.high) ? 'high' : 'medium');
const goldOf = (/** @type {number} */ n, /** @type {string|null} */ currency) => (currency === 'marks' ? n * MARK_WORTH_GOLD : n);
const fmt = (/** @type {number} */ n) => Math.round(n).toLocaleString('en-US');

/**
 * What one side of a settled trade gave (realmTradeLaw.js settleRealmTrade keeps what each side RECEIVED, so a side gave
 * what the other got): its gold, its goods at their worth (a letter of credit or coins at what they hold, a piece at the
 * item law's worth - judge.js wealthOf's measure), how many pieces, and the first few names.
 * @param {any} got the other side's receipt
 */
export function tradeSideOf(got) {
  const items = Array.isArray(got?.items) ? got.items : [];
  const gold = Number.isSafeInteger(got?.gold) && got.gold > 0 ? got.gold : 0;
  const goods = items.reduce((/** @type {number} */ n, /** @type {any} */ it) => n + (liquidWorthOf(it) || itemWorth(it)), 0);
  return { gold, value: gold + goods, items: items.length, names: items.slice(0, 5).map((/** @type {any} */ it) => String(it?.name ?? 'an item').slice(0, 64)) };
}

// ─── MARKET AND TRADES ───────────────────────────────────────────────

/**
 * EACH SOURCE OF THE STREAM, every one answering the same columns (src, a, b, a_char, b_char, a_name, b_name, what,
 * material, provenance, name, units, price, total, cut, currency, region, region2, result, guild, guild_name, state): its rows, its time, its cursor key (unique and ordered within the source, the source's
 * letter first so keys never collide across sources), what a player filter asks of it (one statement a side, each on its
 * own index), and what an item, a price and a region filter ask - a source a filter cannot ask is left out while that
 * filter stands. `a` gives, `b` takes: a sale's seller and buyer, a fill's filler and the order's poster, an auction's
 * seller and its bidder, a trade's first and second sides.
 * @type {Record<string, { from: string, where?: string, at: string, key: string, cols: string, sides: string[], item: string, itemArgs?: number, price: string|null, region: string|null, regionArgs?: number, byName?: boolean }>}
 */
const SOURCES = {
  sale: {
    from: "market_sales s LEFT JOIN market_listings l ON s.kind = 'item' AND l.id = s.listing",
    at: 's.at', key: "'s:' || s.buyer || ':' || s.rid",
    cols: `'sale' AS src, s.seller AS a, s.buyer AS b, NULL AS a_char, s.char_id AS b_char, NULL AS a_name, NULL AS b_name, s.kind AS what, s.material, s.provenance,
      CASE WHEN s.kind = 'item' THEN json_extract(l.item, '$.name') END AS name, s.units, s.price, s.total, s.tax + s.fee AS cut, s.currency,
      s.from_region AS region, s.to_region AS region2, NULL AS result, NULL AS guild, NULL AS guild_name, NULL AS state`,
    sides: ['s.seller = ?', 's.buyer = ?'],
    item: "(s.material = ? OR s.provenance = ? OR json_extract(l.item, '$.name') = ?)", itemArgs: 3,
    price: 's.price', region: '(s.from_region = ? OR s.to_region = ?)', regionArgs: 2,
  },
  fill: {
    from: 'market_fills f LEFT JOIN market_orders o ON o.id = f.order_id',
    at: 'f.at', key: "'f:' || f.filler || ':' || f.rid",
    cols: `'fill' AS src, f.filler AS a, f.poster AS b, f.char_id AS a_char, o.char_id AS b_char, NULL AS a_name, NULL AS b_name, 'material' AS what, f.material, NULL AS provenance,
      NULL AS name, f.units, f.price, f.units * f.price AS total, f.tax AS cut, 'marks' AS currency, o.region AS region, NULL AS region2, NULL AS result, NULL AS guild, NULL AS guild_name, NULL AS state`,
    sides: ['f.filler = ?', 'f.poster = ?'],
    item: 'f.material = ?', price: 'f.price', region: 'o.region = ?',
  },
  bid: {
    from: 'market_bids d JOIN market_auctions u ON u.id = d.auction',
    at: 'd.at', key: "'b:' || d.id",
    cols: `'bid' AS src, u.seller AS a, d.bidder AS b, u.char_id AS a_char, d.char_id AS b_char, NULL AS a_name, NULL AS b_name, 'piece' AS what, NULL AS material, u.provenance,
      NULL AS name, 1 AS units, d.amount AS price, d.amount AS total, 0 AS cut, 'marks' AS currency, u.region AS region, d.region AS region2, NULL AS result, NULL AS guild, NULL AS guild_name, d.state`,
    sides: ['d.auction IN (SELECT id FROM market_auctions WHERE seller = ?)', 'd.bidder = ?'],
    item: 'u.provenance = ?', price: 'd.amount', region: '(u.region = ? OR d.region = ?)', regionArgs: 2,
  },
  trade: {
    from: 'realm_trades t LEFT JOIN realm_characters ca ON ca.id = t.a_char LEFT JOIN realm_characters cb ON cb.id = t.b_char',
    where: "t.state = 'done'",
    at: 't.created_at', key: "'t:' || t.sid",
    cols: `'trade' AS src, t.a_player AS a, t.b_player AS b, t.a_char, t.b_char, ca.name AS a_name, cb.name AS b_name, 'trade' AS what, NULL AS material, NULL AS provenance,
      NULL AS name, NULL AS units, NULL AS price, NULL AS total, 0 AS cut, 'gold' AS currency, NULL AS region, NULL AS region2, t.result, NULL AS guild, NULL AS guild_name, NULL AS state`,
    sides: ['t.a_player = ?', 't.b_player = ?'],
    // a piece's name as the trade's receipt writes it (JSON.stringify of the record)
    item: `instr(t.result, '"name":' || json_quote(?)) > 0`,
    // a trade's price filter is the gold it moved, both ways
    price: "(COALESCE(json_extract(t.result, '$.a.gold'), 0) + COALESCE(json_extract(t.result, '$.b.gold'), 0))", region: null,
  },
  vault: {
    from: 'guild_vault_log v LEFT JOIN guilds g ON g.id = v.guild_id',
    at: 'v.at', key: "'v:' || printf('%012d', v.seq)",
    cols: `'vault' AS src, NULL AS a, NULL AS b, NULL AS a_char, NULL AS b_char, v.who AS a_name, NULL AS b_name, v.kind AS what, NULL AS material, NULL AS provenance,
      v.name, v.count AS units, NULL AS price, NULL AS total, 0 AS cut, NULL AS currency, NULL AS region, NULL AS region2, NULL AS result, v.guild_id AS guild, g.name AS guild_name, NULL AS state`,
    // the log keeps the name the member had, never an account (guildVault.js displayName)
    sides: ['v.who = ?'], byName: true,
    item: 'v.name = ?', price: null, region: null,
  },
};

/**
 * THE STREAM'S VIEW, from the body: the account (resolved), the item, prices, region, kinds and window, and the cursor.
 * `{ error }` for an account no one holds.
 * @param {any} db @param {any} body @param {number} nowS
 */
async function streamView(db, body, nowS) {
  let player = null;
  if (body.target != null || body.name != null) {
    const row = await findAccount(db, { target: body.target, name: body.name });
    if ('error' in row) return row;
    player = row;
  }
  const until = int(body.until, 1, nowS) ?? nowS;
  const since = Math.max(int(body.since, 0, until) ?? 0, until - STREAM_SPAN_DAYS * DAY_S);
  const kinds = Array.isArray(body.kinds) ? STREAM_KINDS.filter((k) => body.kinds.includes(k)) : [...STREAM_KINDS];
  const m = typeof body.before === 'string' ? /^(\d{1,12})\|([A-Za-z0-9_:-]{1,120})$/.exec(body.before) : null;
  return {
    player, kinds, since, until,
    item: str(body.item), priceMin: int(body.priceMin, 0, Number.MAX_SAFE_INTEGER), priceMax: int(body.priceMax, 0, Number.MAX_SAFE_INTEGER),
    region: int(body.region, 0, 61), before: m ? { at: Number(m[1]), k: m[2] } : null,
  };
}

/** The statements one page reads - each source, each side of a player filter, newest first, a row past the page. */
function streamStatements(/** @type {any} */ db, /** @type {any} */ v) {
  const out = [];
  const priced = v.priceMin != null || v.priceMax != null;
  for (const kind of v.kinds) {
    const s = SOURCES[kind];
    if ((v.region != null && !s.region) || (priced && !s.price)) continue;
    for (const side of v.player ? s.sides : [null]) {
      const where = [...(s.where ? [s.where] : []), `${s.at} >= ?`, `${s.at} <= ?`];
      const args = [v.since, v.until];
      if (v.before) { where.push(`(${s.at} < ? OR (${s.at} = ? AND ${s.key} < ?))`); args.push(v.before.at, v.before.at, v.before.k); }
      if (side) { where.push(side); args.push(s.byName ? displayName(v.player) : v.player.id); }
      if (v.item) { where.push(s.item); args.push(...Array(s.itemArgs ?? 1).fill(v.item)); }
      if (v.priceMin != null) { where.push(`${s.price} >= ?`); args.push(v.priceMin); }
      if (v.priceMax != null) { where.push(`${s.price} <= ?`); args.push(v.priceMax); }
      if (v.region != null) { where.push(/** @type {string} */ (s.region)); args.push(...Array(s.regionArgs ?? 1).fill(v.region)); }
      out.push(db.prepare(`SELECT ${s.cols}, ${s.key} AS k, ${s.at} AS at FROM ${s.from} WHERE ${where.join(' AND ')} ORDER BY ${s.at} DESC, k DESC LIMIT ?`)
        .bind(...args, STREAM_PAGE + 1));
    }
  }
  return out;
}

/**
 * THE USUAL PRICES of `materials` in `currency`: a Map of material to { usual, pairs } - the median of each pair of
 * accounts' mean price over MARKET_MEDIAN_DAYS (each pair once; an account's sale to itself never), null under
 * ECON_LIMITS.price.pairs pairs. Kept ECON_KEEP_S a material.
 * @param {any} db @param {'marks'|'gold'} currency @param {string[]} materials @param {number} nowS
 */
export async function usualPrices(db, currency, materials, nowS) {
  const out = new Map();
  const ask = [];
  for (const m of new Set(materials)) {
    const root = db?.[DB_ROOT] ?? db;
    const k = keptBy.get(root)?.get(`usual:${currency}:${m}`);
    if (k && k.until > nowS) out.set(m, await k.value); else ask.push(m);
  }
  if (!ask.length) return out;
  const since = nowS - MARKET_MEDIAN_DAYS * DAY_S;
  // gold's sales only for a gold price, Drakes' sales and fills (an order is Drakes alone) for a Drakes one
  const { results = [] } = await db.prepare(`SELECT material, MIN(buyer, seller) AS x, MAX(buyer, seller) AS y, SUM(units) AS units, SUM(price * units) AS paid FROM (
      SELECT material, buyer, seller, units, price FROM market_sales WHERE material IN (SELECT value FROM json_each(?1)) AND at >= ?2 AND kind = 'material' AND currency = ?3
      UNION ALL
      SELECT material, poster, filler, units, price FROM market_fills WHERE ?3 = 'marks' AND material IN (SELECT value FROM json_each(?1)) AND at >= ?2
    ) WHERE buyer != seller GROUP BY material, x, y`).bind(JSON.stringify(ask), since, currency).all();
  for (const m of ask) {
    const pairs = results.filter((/** @type {any} */ r) => r.material === m && num(r.units) > 0).map((/** @type {any} */ r) => ({ price: num(r.paid) / num(r.units), units: 1 }));
    const value = { usual: pairs.length >= ECON_LIMITS.price.pairs ? medianOf(pairs) : null, pairs: pairs.length };
    out.set(m, value);
    kept(db, `usual:${currency}:${m}`, nowS, ECON_KEEP_S, async () => value);
  }
  return out;
}

/**
 * A PAGE OF THE STREAM, with each row's flags.
 * @param {any} db @param {any} v streamView's @param {number} nowS
 */
export async function streamPage(db, v, nowS) {
  const read = await readAll(db, streamStatements(db, v));
  const seen = new Set();
  const all = read.flat().filter((r) => !seen.has(r.k) && seen.add(r.k))
    .sort((x, y) => y.at - x.at || (y.k > x.k ? 1 : y.k < x.k ? -1 : 0));
  const page = all.slice(0, STREAM_PAGE);
  const last = page[page.length - 1];
  const next = all.length > STREAM_PAGE && last ? `${last.at}|${last.k}` : null;

  // ─── what the flags need, in one trip: the accounts, how often each pair dealt, and the usual prices ───
  const accounts = new Set(page.flatMap((r) => [r.a, r.b]).filter(Boolean));
  const L = ECON_LIMITS;
  const priced = (/** @type {any} */ r) => (r.src === 'sale' && r.what === 'material') || r.src === 'fill';
  const usualOf = (/** @type {'marks'|'gold'} */ cur) => usualPrices(db, cur, page.filter((r) => priced(r) && r.currency === cur).map((r) => r.material), nowS);
  // STAFF-PANEL-SPEED: and each currency's usual prices beside them - none waits on another's answer
  const [[who, pairs], marks, gold] = await Promise.all([accounts.size ? readAll(db, [
    db.prepare('SELECT id, handle, guest_name, created_at FROM players WHERE id IN (SELECT value FROM json_each(?1))').bind(ids(accounts)),
    db.prepare(`SELECT MIN(a, b) AS x, MAX(a, b) AS y, COUNT(*) AS n FROM (
        SELECT buyer AS a, seller AS b FROM market_sales WHERE buyer IN (SELECT value FROM json_each(?1)) AND seller IN (SELECT value FROM json_each(?1)) AND at >= ?2
        UNION ALL SELECT filler, poster FROM market_fills WHERE filler IN (SELECT value FROM json_each(?1)) AND poster IN (SELECT value FROM json_each(?1)) AND at >= ?2
        UNION ALL SELECT a_player, b_player FROM realm_trades WHERE a_player IN (SELECT value FROM json_each(?1)) AND b_player IN (SELECT value FROM json_each(?1))
          AND state = 'done' AND created_at >= ?2
      ) WHERE a != b GROUP BY x, y`).bind(ids(accounts), nowS - L.repeat.days * DAY_S),
  ]) : [[], []], usualOf('marks'), usualOf('gold')]);
  const usual = { marks, gold };
  const people = new Map(who.map((p) => [p.id, p]));
  const dealt = new Map(pairs.map((p) => [pairKey(p.x, p.y), num(p.n)]));
  const fresh = (/** @type {string|null} */ id) => !!id && people.has(id) && num(people.get(id).created_at) >= nowS - L.fresh.days * DAY_S;

  const rows = page.map((r) => {
    /** @type {Array<{ flag: string, why: string, high?: boolean }>} */
    const flags = [];
    const cur = /** @type {'marks'|'gold'|null} */ (r.currency);
    /** @type {any} */
    const row = {
      kind: r.src, at: r.at, id: r.k,
      from: { id: r.a ?? null, name: nameOf(people, r.a) ?? r.a_name ?? null, char: r.a_char ?? null },
      to: { id: r.b ?? null, name: nameOf(people, r.b) ?? r.b_name ?? null, char: r.b_char ?? null },
      currency: cur, region: r.region ?? null, toRegion: r.region2 ?? null,
    };
    if (r.src === 'trade') {
      const res = json(r.result) ?? {};
      const aGave = tradeSideOf(res.b), bGave = tradeSideOf(res.a);
      row.from.charName = r.a_name ?? null; row.to.charName = r.b_name ?? null;
      row.trade = { aGave, bGave };
      const nothing = (/** @type {any} */ s) => s.gold === 0 && s.items === 0;
      const [giver, taker] = nothing(aGave) ? [bGave, row.from] : nothing(bGave) ? [aGave, row.to] : [null, null];
      if (giver && taker && giver.value >= L.oneSided.gold) {
        flags.push({ flag: 'one-sided', why: `${taker.name ?? 'one side'} gave nothing for ${fmt(giver.value)} gold of goods`, high: giver.value >= L.oneSided.high });
      }
      for (const [side, net] of [[row.from, bGave.value - aGave.value], [row.to, aGave.value - bGave.value]]) {
        if (fresh(side.id) && net >= L.fresh.gold) flags.push({ flag: 'new', why: `a new account took ${fmt(net)} gold more than it gave`, high: net >= L.fresh.high });
      }
    } else if (r.src === 'vault') {
      row.guild = { id: r.guild, name: r.guild_name ?? null };
      row.move = r.what;
      row.item = { name: r.name };
      row.units = r.units;
    } else {
      row.item = { what: r.what, material: r.material ?? null, provenance: r.provenance ?? null, name: r.name ?? null };
      row.units = r.units; row.price = r.price; row.total = r.total; row.cut = r.cut;
      if (r.src === 'bid') row.state = r.state;
      const u = priced(r) && cur ? usual[cur].get(r.material) : null;
      if (u) row.usual = u.usual;
      if (u?.usual) {
        const ratio = num(r.price) / u.usual;
        if (ratio >= L.price.ratio || ratio <= 1 / L.price.ratio) {
          const far = ratio >= L.price.high || ratio <= 1 / L.price.high;
          flags.push({ flag: 'price', why: ratio >= 1 ? `${ratio.toFixed(1)}x the usual ${fmt(u.usual)} ${cur}` : `a ${(1 / ratio).toFixed(1)}th of the usual ${fmt(u.usual)} ${cur}`, high: far });
        }
        // what each side took past the usual price: the seller's over it, the buyer's under it
        const over = goldOf((num(r.price) - u.usual) * num(r.units), cur);
        for (const [side, net] of [[row.from, over], [row.to, -over]]) {
          if (fresh(side.id) && net >= L.fresh.gold) flags.push({ flag: 'new', why: `a new account took ${fmt(net)} gold past the usual price`, high: net >= L.fresh.high });
        }
      }
    }
    if (r.a && r.b && r.a !== r.b) {
      const n = dealt.get(pairKey(r.a, r.b)) ?? 0;
      if (n >= L.repeat.n) flags.push({ flag: 'repeat', why: `${n} deals between these two accounts in ${L.repeat.days} days`, high: n >= L.repeat.high });
    }
    row.flags = flags.map(({ flag, why }) => ({ flag, why }));
    row.level = levelOf(flags);
    return row;
  });
  return { rows, next, since: v.since, until: v.until };
}

// ─── NODE ACTIVITY ───────────────────────────────────────────────────

/**
 * A HARVESTER'S LEVEL, and why (design doc, "Node activity": "A bot tends to show the same node loop at even gaps for
 * many hours; the screen puts those players at the top"; weak spot: a node key holds its day, so the loop is a long
 * route of distinct nodes at even gaps). `run` the longest unbroken run of the day (hours, distinct nodes, the gaps'
 * coefficient of variation `even`), `streak` the week's most hours in a row with harvests.
 * @param {{ run: { hours: number, nodes: number, even: number|null }|null, streak: number }} h
 * @returns {{ level: 'high'|'medium'|'low', why: string[], score: number }}
 */
export function harvestLevel({ run, streak }) {
  const H = ECON_LIMITS.harvest;
  const why = [];
  let rank = 0;
  const even = run?.even ?? null;
  if (run && even != null) {
    if (run.hours >= H.runHigh && even <= H.evenHigh && run.nodes >= H.nodesHigh) rank = 2;
    else if (run.hours >= H.runMedium && even <= H.evenMedium) rank = 1;
    if (run.hours >= H.runMedium) why.push(`${run.hours.toFixed(1)} h unbroken over ${run.nodes} nodes, gaps ${even <= H.evenMedium ? 'even' : 'uneven'} (${Math.round(even * 100)}%)`);
  }
  if (streak >= H.weekHigh) rank = 2;
  else if (streak >= H.weekMedium) rank = Math.max(rank, 1);
  if (streak >= H.weekMedium) why.push(`${streak} h in a row with harvests this week`);
  const score = (run ? run.hours * Math.max(0, 1 - Math.min(even ?? 1, 1)) : 0) + streak / 24;
  return { level: /** @type {'high'|'medium'|'low'} */ (LEVELS[rank]), why, score };
}

/** The candidates: the day's busiest harvesters and the week's longest unbroken runs. */
function candidateStatements(/** @type {any} */ db, /** @type {number} */ nowS) {
  return [
    // `+player`: grouped by the account's index, the planner walked the whole table (carried rows stay 30 days) to spare a sort
    db.prepare('SELECT player, COUNT(*) AS n FROM node_harvests WHERE day >= ?1 AND at >= ?2 GROUP BY +player ORDER BY n DESC LIMIT ?3')
      .bind(utcDay(nowS - DAY_S), nowS - DAY_S, HARVEST_DAY_RANKED),
    db.prepare(`WITH h AS (SELECT player, hour / 3600 - ROW_NUMBER() OVER (PARTITION BY player ORDER BY hour) AS grp FROM progress_hours WHERE stream = 'prof' AND hour >= ?1),
        s AS (SELECT player, COUNT(*) AS hours FROM h GROUP BY player, grp)
      SELECT player, MAX(hours) AS streak FROM s GROUP BY player ORDER BY streak DESC LIMIT ?2`).bind(nowS - 7 * DAY_S, HARVEST_WEEK_RANKED),
  ];
}

/**
 * NODE ACTIVITY OF `players`: each one's day (harvests, an hour, distinct nodes, materials, the hour-by-hour line, the
 * longest unbroken run and its gaps) and week (hours with harvests, the longest run of them, claims an hour), levelled.
 * @param {any} db @param {any} env @param {string[]} players @param {number} nowS @param {{ list?: boolean }} [opts]
 */
export async function harvestRows(db, env, players, nowS, { list = false } = {}) {
  if (!players.length) return [];
  const H = ECON_LIMITS.harvest;
  const day = utcDay(nowS - DAY_S), since = nowS - DAY_S, who = JSON.stringify(players);
  const IN = 'player IN (SELECT value FROM json_each(?3))';
  const [runs, totals, mats, hourly, week, people, own] = await readAll(db, [
    // the runs: a gap past breakS starts the next (gaps-and-islands over the day's harvests, ordered by time)
    db.prepare(`WITH h AS (SELECT player, node || '/' || kind AS nk, at, at - LAG(at) OVER (PARTITION BY player ORDER BY at) AS gap
          FROM node_harvests WHERE day >= ?1 AND at >= ?2 AND ${IN}),
        r AS (SELECT player, nk, at, gap, SUM(CASE WHEN gap IS NULL OR gap > ?4 THEN 1 ELSE 0 END) OVER (PARTITION BY player ORDER BY at ROWS UNBOUNDED PRECEDING) AS run FROM h)
      SELECT player, run, COUNT(*) AS n, MIN(at) AS a, MAX(at) AS b, COUNT(DISTINCT nk) AS nodes,
        SUM(CASE WHEN gap <= ?4 THEN gap ELSE 0 END) AS sg, SUM(CASE WHEN gap <= ?4 THEN gap * gap ELSE 0 END) AS sg2, SUM(CASE WHEN gap <= ?4 THEN 1 ELSE 0 END) AS ng
      FROM r GROUP BY player, run`).bind(day, since, who, H.breakS),
    db.prepare(`SELECT player, COUNT(*) AS n, COUNT(DISTINCT node || '/' || kind) AS nodes, MAX(at) AS last FROM node_harvests WHERE day >= ?1 AND at >= ?2 AND ${IN} GROUP BY player`).bind(day, since, who),
    db.prepare(`SELECT player, material, COUNT(*) AS n, SUM(qty) AS qty FROM node_harvests WHERE day >= ?1 AND at >= ?2 AND ${IN} GROUP BY player, material`).bind(day, since, who),
    db.prepare(`SELECT player, CAST((at - ?2) / 3600 AS INTEGER) AS h, COUNT(*) AS n FROM node_harvests WHERE day >= ?1 AND at >= ?2 AND ${IN} GROUP BY player, h`).bind(day, since, who),
    // the week, the service's own hours (progress.js: a harvest is the `prof` stream's claim)
    db.prepare(`WITH h AS (SELECT player, claims, played_s, amount, hour / 3600 - ROW_NUMBER() OVER (PARTITION BY player ORDER BY hour) AS grp
          FROM progress_hours WHERE stream = 'prof' AND hour >= ?1 AND player IN (SELECT value FROM json_each(?2))),
        s AS (SELECT player, COUNT(*) AS hours FROM h GROUP BY player, grp),
        m AS (SELECT player, MAX(hours) AS streak FROM s GROUP BY player)
      SELECT h.player, COUNT(*) AS hours, SUM(h.claims) AS claims, SUM(h.played_s) AS played, SUM(h.amount) AS xp, m.streak
      FROM h JOIN m ON m.player = h.player GROUP BY h.player`).bind(nowS - 7 * DAY_S, who),
    db.prepare('SELECT * FROM players WHERE id IN (SELECT value FROM json_each(?1))').bind(who),
    // one player's own: the day's harvests themselves, which nodes in which order
    ...(list ? [] : [db.prepare(`SELECT node, kind, material, qty, at FROM node_harvests WHERE day >= ?1 AND at >= ?2 AND ${IN} ORDER BY at DESC LIMIT ?4`).bind(day, since, who, HARVEST_ONE_MAX)]),
  ]);
  const by = (/** @type {any[]} */ rows) => { const m = new Map(); for (const r of rows) { const a = m.get(r.player) ?? []; a.push(r); m.set(r.player, a); } return m; };
  const runsBy = by(runs), matsBy = by(mats), hourlyBy = by(hourly);
  const totalOf = new Map(totals.map((t) => [t.player, t])), weekOf = new Map(week.map((w) => [w.player, w])), personOf = new Map(people.map((p) => [p.id, p]));
  return players.filter((id) => personOf.has(id)).map((id) => {
    const p = personOf.get(id);
    const best = (runsBy.get(id) ?? []).map((/** @type {any} */ r) => {
      const ng = num(r.ng), mean = ng ? num(r.sg) / ng : 0;
      const sd = ng ? Math.sqrt(Math.max(0, num(r.sg2) / ng - mean * mean)) : 0;
      return { hours: (num(r.b) - num(r.a)) / 3600, start: num(r.a), end: num(r.b), harvests: num(r.n), nodes: num(r.nodes), gapMean: ng ? mean : null, gapSd: ng ? sd : null, even: ng ? (mean > 0 ? sd / mean : 0) : null };
    }).sort((/** @type {any} */ x, /** @type {any} */ y) => y.hours - x.hours || y.harvests - x.harvests)[0] ?? null;
    const t = totalOf.get(id), w = weekOf.get(id);
    const line = Array(24).fill(0);
    for (const h of hourlyBy.get(id) ?? []) line[Math.min(23, Math.max(0, num(h.h)))] += num(h.n);
    const active = line.filter((n) => n > 0).length;
    const streak = num(w?.streak);
    const lv = harvestLevel({ run: best, streak });
    return {
      id, name: displayName(p), staff: canModerate(p, env), level: lv.level, why: lv.why, score: lv.score,
      day: {
        harvests: num(t?.n), perHour: active ? num(t?.n) / active : 0, nodes: num(t?.nodes), last: t?.last ?? null, hourly: line,
        materials: (matsBy.get(id) ?? []).sort((/** @type {any} */ a, /** @type {any} */ b) => num(b.n) - num(a.n)).slice(0, 5).map((/** @type {any} */ m) => ({ material: m.material, harvests: num(m.n), qty: num(m.qty) })),
      },
      run: best,
      week: { hours: num(w?.hours), streak, claims: num(w?.claims), perHour: num(w?.hours) ? num(w?.claims) / num(w?.hours) : 0, playedS: num(w?.played) },
      ...(list ? {} : { harvests: own ?? [] }),
    };
  });
}

/** THE RANKED LIST, kept HARVEST_KEEP_S: the candidates' rows, most urgent first. */
function harvestRanked(/** @type {any} */ db, /** @type {any} */ env, /** @type {number} */ nowS) {
  return kept(db, 'harvests', nowS, HARVEST_KEEP_S, async () => {
    const [dayTop, weekTop] = await readAll(db, candidateStatements(db, nowS));
    const rows = await harvestRows(db, env, [...new Set([...dayTop, ...weekTop].map((r) => r.player))], nowS, { list: true });
    return { asOf: nowS, rows: rows.sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || b.score - a.score || num(b.day.last) - num(a.day.last)) };
  });
}

// ─── ECONOMY ─────────────────────────────────────────────────────────

/** The guilds, one ranked list by `sort` (GUILD_SORTS), kept ECON_KEEP_S. */
function guildsRanked(/** @type {any} */ db, /** @type {string} */ sort, /** @type {number} */ nowS) {
  return kept(db, `guilds:${sort}`, nowS, ECON_KEEP_S, async () => {
    const { results = [] } = await db.prepare(`SELECT g.id, g.name, g.tag, g.treasury, g.realm_gold, MAX(g.treasury - g.realm_gold, 0) AS legacy, COALESCE(m.balance, 0) AS marks,
        (SELECT COUNT(*) FROM guild_members gm WHERE gm.guild_id = g.id) AS members,
        (SELECT COUNT(*) FROM guild_vault v WHERE v.guild_id = g.id) AS vault_slots,
        (SELECT COALESCE(SUM(v.count), 0) FROM guild_vault v WHERE v.guild_id = g.id) AS vault_items
      FROM guilds g LEFT JOIN guild_marks m ON m.guild_id = g.id ORDER BY ${GUILD_SORTS[/** @type {keyof typeof GUILD_SORTS} */ (sort)]} DESC, g.id LIMIT ?1`).bind(GUILDS_MAX).all();
    return {
      asOf: nowS,
      guilds: results.map((/** @type {any} */ g) => ({
        id: g.id, name: g.name, tag: g.tag, gold: num(g.treasury), realmGold: num(g.realm_gold), legacyGold: num(g.legacy), marks: num(g.marks),
        members: num(g.members), vault: { slots: num(g.vault_slots), items: num(g.vault_items) },
      })),
    };
  });
}

/**
 * THE ECONOMY over the last `days` UTC days (today the last), kept ECON_KEEP_S a `days`: where the gold the service holds
 * sits, the Marks in circulation and escrow, Marks minted and burnt and gold come and gone by kind and by day, and the
 * richest. ONE trip, then the richest guilds' kept list.
 * @param {any} db @param {number} nowS @param {number} days
 */
export function economy(db, nowS, days) {
  return kept(db, `economy:${days}`, nowS, ECON_KEEP_S, async () => {
    const today = utcDay(nowS), fromDay = today - days + 1;
    // STAFF-PANEL-SPEED: the richest guilds' kept list asked beside the batch, never after it
    const [[places, accounts, guilds, escrow, ledger, faucets, sales, games, rich], ranked] = await Promise.all([readAll(db, [
      db.prepare(`SELECT (SELECT COALESCE(SUM(gold), 0) FROM market_gold) AS market_gold, (SELECT COALESCE(SUM(realm_gold), 0) FROM guilds) AS guild_realm,
        (SELECT COALESCE(SUM(MAX(treasury - realm_gold, 0)), 0) FROM guilds) AS guild_legacy, (SELECT COALESCE(SUM(rent_due), 0) FROM homes) AS rent_held`),
      db.prepare('SELECT COALESCE(SUM(balance), 0) AS s, COUNT(*) AS n FROM marks WHERE balance > 0'),
      db.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM guild_marks'),
      // marks.js marksReport's escrow - the ledger's escrow end, what went in less what came out - on 0153's covering index
      db.prepare(`SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount ELSE 0 END), 0) AS s
        FROM marks_ledger WHERE dst_kind = 'escrow' OR src_kind = 'escrow'`),
      db.prepare(`SELECT day, kind, CASE WHEN src_kind = 'mint' THEN 1 ELSE 0 END AS minted, SUM(amount) AS s FROM marks_ledger
        WHERE day >= ?1 AND (src_kind = 'mint' OR dst_kind = 'burn') GROUP BY day, kind, minted`).bind(fromDay),
      // the service's own gold faucets (budget.js FAUCET_KINDS), kept by the hour's number
      db.prepare('SELECT hour / 24 AS day, kind, SUM(gold) AS gold, SUM(n) AS n FROM realm_faucets WHERE hour >= ?1 GROUP BY day, kind').bind(fromDay * 24),
      // gold's market sales: the tax and the fee are burnt (marketLaw.js goldSaleOf)
      db.prepare("SELECT day, SUM(tax) AS tax, SUM(fee) AS fee, SUM(total) AS total, COUNT(*) AS n FROM market_sales WHERE day >= ?1 AND currency = 'gold' GROUP BY day").bind(fromDay),
      // made or spent inside players' games: the gain no witness explained and the losses, by the hour (verdict.js)
      db.prepare('SELECT hour / 86400 AS day, SUM(gain) AS gain, SUM(loss) AS loss FROM realm_wealth_hours WHERE hour >= ?1 GROUP BY day').bind(fromDay * DAY_S),
      db.prepare(`SELECT c.id, c.name, c.player, c.wealth, c.held, c.updated_at, p.handle, p.guest_name,
          (SELECT m.gold FROM market_gold m WHERE m.player = c.player AND m.char_id = c.id) AS market_gold
        FROM realm_characters c LEFT JOIN players p ON p.id = c.player
        WHERE c.wealth >= ${RICH_FLOOR} AND c.dead_at IS NULL ORDER BY c.wealth DESC LIMIT ${RICHEST}`),
    ]), guildsRanked(db, 'gold', nowS)]);
    const p = places[0] ?? {};
    const minted = /** @type {Record<string, number>} */ ({}), burnt = /** @type {Record<string, number>} */ ({});
    const line = new Map();
    for (let d = fromDay; d <= today; d++) line.set(d, { day: d, marksMinted: 0, marksBurnt: 0, goldIn: 0, goldOut: 0, gameGain: 0, gameLoss: 0 });
    const at = (/** @type {unknown} */ d) => line.get(num(d));
    for (const r of ledger) {
      const into = num(r.minted) ? minted : burnt;
      into[r.kind] = (into[r.kind] ?? 0) + num(r.s);
      const d = at(r.day);
      if (d) { if (num(r.minted)) d.marksMinted += num(r.s); else d.marksBurnt += num(r.s); }
    }
    const sources = /** @type {Record<string, { gold: number, n: number }>} */ ({});
    for (const r of faucets) {
      const s = sources[r.kind] ?? (sources[r.kind] = { gold: 0, n: 0 });
      s.gold += num(r.gold); s.n += num(r.n);
      const d = at(r.day); if (d) d.goldIn += num(r.gold);
    }
    let tax = 0, fee = 0;
    for (const r of sales) { tax += num(r.tax); fee += num(r.fee); const d = at(r.day); if (d) d.goldOut += num(r.tax) + num(r.fee); }
    let gain = 0, loss = 0;
    for (const r of games) { gain += num(r.gain); loss += num(r.loss); const d = at(r.day); if (d) { d.gameGain += num(r.gain); d.gameLoss += num(r.loss); } }
    const topGuilds = ranked.guilds.slice(0, RICHEST);
    return {
      asOf: nowS, days, from: fromDay, to: today,
      gold: {
        // where the service itself holds gold; a purse, a bank account and a letter of credit are inside the saves
        held: { market: num(p.market_gold), guildRealm: num(p.guild_realm), guildLegacy: num(p.guild_legacy), rent: num(p.rent_held) },
        sources: Object.entries(sources).map(([kind, s]) => ({ kind, ...s })),
        sinks: [{ kind: 'market-tax', gold: tax }, { kind: 'market-fee', gold: fee }],
        inGames: { gain, loss },
      },
      marks: { accounts: num(accounts[0]?.s), holders: num(accounts[0]?.n), guilds: num(guilds[0]?.s), escrow: num(escrow[0]?.s), minted, burnt },
      daily: [...line.values()],
      richest: {
        characters: rich.map((c) => ({
          id: c.id, name: c.name, player: c.player, owner: displayName(c), wealth: num(c.wealth), marketGold: num(c.market_gold), held: c.held ?? null, savedAt: c.updated_at,
        })),
        floor: RICH_FLOOR,
        guilds: topGuilds,
      },
    };
  });
}

// ─── THE HOME WATCH ──────────────────────────────────────────────────

/** THE MARKET'S WORST OF THE LAST DAY, kept ECON_KEEP_S: the one-sided trades worth a flag, and the pairs of accounts
 *  that dealt ECON_LIMITS.repeat.n times or more in it - two statements, then the names. (A price flag needs every
 *  material's usual price: the stream's rows carry it, the watch does not.) */
function marketWatch(/** @type {any} */ db, /** @type {number} */ nowS) {
  return kept(db, 'market-watch', nowS, ECON_KEEP_S, async () => {
    const L = ECON_LIMITS, since = nowS - DAY_S;
    const nothing = (/** @type {string} */ s) => `(COALESCE(json_extract(t.result, '$.${s}.gold'), 0) = 0 AND COALESCE(json_array_length(t.result, '$.${s}.items'), 0) = 0)`;
    const [trades, pairs] = await readAll(db, [
      db.prepare(`SELECT t.sid, t.created_at AS at, t.a_player, t.b_player, t.result FROM realm_trades t
        WHERE t.state = 'done' AND t.created_at >= ?1 AND (${nothing('a')} OR ${nothing('b')}) ORDER BY t.created_at DESC LIMIT 200`).bind(since),
      db.prepare(`SELECT MIN(a, b) AS x, MAX(a, b) AS y, COUNT(*) AS n FROM (
          SELECT buyer AS a, seller AS b FROM market_sales WHERE at >= ?1
          UNION ALL SELECT filler, poster FROM market_fills WHERE at >= ?1
          UNION ALL SELECT a_player, b_player FROM realm_trades WHERE created_at >= ?1 AND state = 'done'
        ) WHERE a != b GROUP BY x, y HAVING COUNT(*) >= ?2 ORDER BY n DESC LIMIT 50`).bind(since, L.repeat.n),
    ]);
    const gifts = trades.map((t) => {
      const res = json(t.result) ?? {};
      const aGave = tradeSideOf(res.b), bGave = tradeSideOf(res.a);
      return aGave.value >= bGave.value ? { giver: t.a_player, taker: t.b_player, value: aGave.value } : { giver: t.b_player, taker: t.a_player, value: bGave.value };
    }).filter((g) => g.value >= L.oneSided.gold);
    const [people] = await readAll(db, [db.prepare('SELECT id, handle, guest_name, created_at FROM players WHERE id IN (SELECT value FROM json_each(?1))')
      .bind(ids([...gifts.flatMap((g) => [g.giver, g.taker]), ...pairs.flatMap((p) => [p.x, p.y])]))]);
    const who = new Map(people.map((p) => [p.id, p]));
    const items = [
      ...gifts.map((g) => {
        const fresh = num(who.get(g.taker)?.created_at) >= nowS - L.fresh.days * DAY_S;
        return {
          level: g.value >= L.oneSided.high || (fresh && g.value >= L.fresh.gold) ? 'high' : 'medium', sub: g.taker, name: nameOf(who, g.taker),
          why: `took ${fmt(g.value)} gold of goods for nothing from ${nameOf(who, g.giver) ?? 'another account'} in a trade${fresh ? ' (a new account)' : ''}`,
        };
      }),
      ...pairs.map((p) => ({
        level: num(p.n) >= L.repeat.high ? 'high' : 'medium', sub: p.x, name: nameOf(who, p.x),
        why: `${num(p.n)} deals with ${nameOf(who, p.y) ?? 'one other account'} in a day`,
      })),
    ];
    return { asOf: nowS, items };
  });
}

/** STAFF-PANEL HOME (the status builder's roll-up, COMMON contract): the market's worst of the day and the bot-like
 *  harvesters, most urgent first - an Admin's alone. */
export const HOME_WATCH = Object.freeze({
  id: 'economy',
  label: 'Market and harvesting',
  role: 'admin',
  /** @param {any} ctx @param {any} env @param {{ role: string }} who @param {number} n */
  async top(ctx, env, who, n) {
    if (who?.role !== 'admin') return { items: [], high: 0, total: 0 };
    const [market, harvest] = await Promise.all([marketWatch(ctx.db, ctx.nowS), harvestRanked(ctx.db, env, ctx.nowS)]);
    const all = [
      ...market.items,
      ...harvest.rows.filter((/** @type {any} */ r) => r.level !== 'low').map((/** @type {any} */ r) => ({ level: r.level, why: r.why.join(' · '), sub: r.id, name: r.name })),
    ].sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level));
    return { items: all.slice(0, Math.max(0, Number(n) || 0)), high: all.filter((i) => i.level === 'high').length, total: all.length };
  },
});

// ─── THE DOORS ───────────────────────────────────────────────────────

/**
 * THE PANEL'S ECONOMY DOORS - an Admin's alone. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffEconomy(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  if (who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  }

  if (path === '/v1/staff/econ/stream') {
    const v = await streamView(db, body, nowS);
    if ('error' in v) return v;
    // one row a view (its filters), whatever its page or its moving window - STAFF-PANEL-SPEED: sent with the page's first reads
    const [page] = await Promise.all([streamPage(db, v, nowS), audit('market-read', v.player?.id ?? null, {
      item: v.item, priceMin: v.priceMin, priceMax: v.priceMax, region: v.region, kinds: v.kinds.length === STREAM_KINDS.length ? null : v.kinds,
      since: int(body.since, 0, nowS), until: int(body.until, 1, nowS),
    }, { onceIn: READ_ROW_S }).run()]);
    return page;
  }

  if (path === '/v1/staff/econ/harvests') {
    if (body.target != null || body.name != null) {
      const row = await findAccount(db, { target: body.target, name: body.name });
      if ('error' in row) return row;
      const [one] = await harvestRows(db, env, [row.id], nowS);
      await audit('harvests-read', row.id, { name: displayName(row) }, { onceIn: READ_ROW_S }).run();
      return { asOf: nowS, player: one };
    }
    const sort = body.sort === 'newest' ? 'newest' : 'urgent';
    const from = int(body.from, 0, Number.MAX_SAFE_INTEGER) ?? 0;
    const { asOf, rows } = await harvestRanked(db, env, nowS);
    const ranked = sort === 'newest' ? [...rows].sort((a, b) => num(b.day.last) - num(a.day.last)) : rows;
    await audit('harvests-read', null, { sort }, { onceIn: READ_ROW_S }).run();
    return { asOf, sort, players: ranked.slice(from, from + HARVEST_PAGE), next: from + HARVEST_PAGE < ranked.length ? from + HARVEST_PAGE : null, total: ranked.length };
  }

  if (path === '/v1/staff/econ/economy') {
    const days = Math.min(int(body.days, 1, Number.MAX_SAFE_INTEGER) ?? ECON_DAYS_DEFAULT, ECON_DAYS_MAX);
    // STAFF-PANEL-SPEED: the audit row with the economy's reads, one trip
    const [answer] = await Promise.all([economy(db, nowS, days), audit('economy-read', null, { days }, { onceIn: READ_ROW_S }).run()]);
    return answer;
  }

  if (path === '/v1/staff/econ/guilds') {
    const sort = Object.hasOwn(GUILD_SORTS, body.sort) ? body.sort : 'gold';
    const from = int(body.from, 0, Number.MAX_SAFE_INTEGER) ?? 0;
    const { asOf, guilds } = await guildsRanked(db, sort, nowS);
    await audit('guilds-read', null, { sort }, { onceIn: READ_ROW_S }).run();
    return { asOf, sort, guilds: guilds.slice(from, from + GUILDS_PAGE), next: from + GUILDS_PAGE < guilds.length ? from + GUILDS_PAGE : null, total: guilds.length };
  }
  return { error: 'not-found' };
}
