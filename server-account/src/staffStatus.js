// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL6-STATUS (2026-10-22; design doc "DFO Staff Panel: design", build step 6 - "Server status tiles and Admin-set
// limits"; sections Home, What goes first, Server status and Server load) - THE PANEL'S SERVER STATUS, ITS LIMITS AND
// ITS HOME.
//
// ═══ SERVER STATUS (Admins only): ONE READ, ASKED EVERY 10 SECONDS ═══
//
// Four tiles - players, service load, game activity, health - each grey while normal and amber or red only past a limit
// an Admin set (staff_limits), and each saying where its numbers came from and when (`asOf`, `sources`): a source that
// did not answer is `missing` and one with no credentials `not-configured`, never zero (the design's weak spot: "Missing
// data looks like all quiet"). What turns the health tile red on its own, with no limit: a cron job that failed in the
// last hour, the relay's /health not answering ok, the service's own database read failing, or the AI reviewer failing
// (an open case whose read failed, or a read or a feed batch waiting past AI_WAIT_S while the reviewer is on).
//
// WHERE EACH NUMBER COMES FROM - what the game already records; nothing new is written for this screen:
//   - players: registered accounts at play (a play beat inside PLAY_GRACE_S - players.played_at, by its index), the tabs
//     at play (heartbeats carrying a beat in the last five minutes, from Analytics Engine), the Elite Breaches live (the
//     relay's own public /v1/eg/live, which the relay deploy reads too), and each room kind's sockets over the last five
//     minutes (the relay's own Analytics Engine points, relayScale.js RoomMetrics: an estimate from below, sockets not
//     accounts - `chat` counts a player about four times). Per hub shard, per layer and distinct accounts per room kind
//     are NOT MEASURED: the relay has no door that says them (see `UNMEASURED`).
//   - service load: the account service's own Analytics Engine points (metrics.js) - requests a second, slow ones,
//     refusals (429, 503), other 5xx and the database wait. The SQL API needs a Cloudflare API token (Account Analytics
//     read) the service does not hold today: STAFF_ANALYTICS_TOKEN and STAFF_ANALYTICS_ACCOUNT (the account id); without
//     them every Analytics part says "not configured". Nothing of the token ever leaves the service.
//   - game activity in the last hour: market listings live, sales, guild vault and store moves, player trades done, Marks
//     minted and burned (market_listings, market_sales, guild_vault_log, guild_store_moves, realm_trades, marks_ledger).
//
// CHEAP BY CONSTRUCTION (design doc, Server load; weak spot "The panel goes blank when the database is slow"): each part
// is kept in the isolate for its own time - STATUS_FAST_S for the database's health reads and the relay's /health,
// STATUS_SLOW_S for Analytics Engine and the relay's breach list, STATUS_ACTIVITY_S for the hour's activity (the heavy
// reads) - so a poll every ten seconds costs the session's read and, at most, the fast part's one batch. Only a part's
// answer is kept, never a pending one: a Worker cannot hand one request's I/O to another.
//
// ═══ LIMITS (staff_limits, migration 0155) ═══
//
// Per metric (STATUS_METRICS), an amber and a red line, either or both: a value AT OR PAST a line takes its colour. Every
// staff member may read them; only an Admin sets one, written down in the audit log in the same batch, with what it was.
//
// ═══ HOME (design doc, "Home: only the top of everything"; mob, 03:23Z-03:24Z) ═══
//
// One read: the top 3, 5 or 10 of every watch the caller may see, each item a level (high, medium, low), why, and who,
// each watch with "N high of M", the watches ordered by their worst item. A watch is one plain entry in HOME_WATCHES - a
// module's `HOME_WATCH = { id, label, role, top(ctx, env, who, n) }` answering `{ items: [{ level, why, sub, name }],
// high, total }` (`role` 'moderator' shows it to every staff member, anything else to Admins alone). Moderators see
// Reports only. A watch that throws is answered `failed: true` and sorts as a medium one - never as an empty, quiet one.
import { HOME_WATCH as REPORTS_WATCH, AI_WAIT_S } from './staffCases.js';
import { HOME_WATCH as WATCHLIST_WATCH } from './staffDesk.js';
import { HOME_WATCH as ECONOMY_WATCH } from './staffEconomy.js';
import { HOME_WATCH as GAINS_WATCH } from './staffRealm.js';
import { HOME_WATCH as CONTESTED_WATCH } from './staffCensus.js';
import { HOME_WATCH as BURSTS_WATCH } from './staffNet.js';   // STAFF-PANEL5-FEEDS: packet bursts
import { HOME_WATCH as MONSTERS_WATCH } from './staffMonsters.js';   // STAFF-PANEL5-FEEDS: monster owners
import { HOME_WATCH as FREEZE_WATCH } from './staffFreeze.js';   // STAFF-PANEL5-FREEZE: freezes not live, players waiting
import { modAiOn } from './modAi.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { PLAY_GRACE_S } from '../../src/net/playClock.js';

/** How long each part is kept in the isolate, seconds: the health reads, Analytics Engine and the relay's breach list, and
 *  the hour's activity (the design's "cache 5-10 minutes" for a heavy read). */
export const STATUS_FAST_S = 10;
export const STATUS_SLOW_S = 60;
export const STATUS_ACTIVITY_S = 5 * 60;
/** The window the load and the relay's sockets are read over, seconds - the relay's point a room is five minutes. */
export const STATUS_WINDOW_S = 5 * 60;
/** A request this slow or slower, ms, is a slow one. A starting number to tune. */
export const STATUS_SLOW_MS = 1000;
/** How long one ask of the relay or of Analytics Engine may take, ms. */
export const STATUS_ASK_MS = 3000;
/** The relay's public breach list - its EG_LIVE_PATH (src/net/eliteGates/egDurable.js), spelled here because importing
 *  that module would bundle the relay's graph into this Worker; the status pin holds the two together. */
export const EG_LIVE_PATH = '/v1/eg/live';
/** The Analytics Engine datasets (server-account/wrangler.toml, server/wrangler.toml). */
const ACCOUNT_DATASET = 'daggerfall_accounts';
const RELAY_DATASET = 'daggerfall_relay';
/** Home: how many of each watch, and how often its read is written down. */
export const HOME_TOPS = Object.freeze([3, 5, 10]);
export const HOME_TOP_DEFAULT = 5;
export const HOME_READ_ROW_S = 10 * 60;

export const STATUS_ROUTES = Object.freeze(['/v1/staff/status', '/v1/staff/home', '/v1/staff/limits', '/v1/staff/limit/set']);

/** Every number a limit may be set on, and what it counts. */
export const STATUS_METRICS = Object.freeze({
  'players.registered': 'registered accounts at play (a play beat inside the play clock\'s grace)',
  'players.tabs': 'tabs at play (heartbeats with a beat, last 5 minutes)',
  'players.breaches': 'Elite Breaches live',
  'load.rps': 'requests a second (last 5 minutes)',
  'load.slow': `requests a minute taking ${STATUS_SLOW_MS} ms or more`,
  'load.refused': '429 and 503 answers a minute',
  'load.errors': 'other 5xx answers a minute',
  'load.dbWait': 'database wait, ms a request',
  'activity.listings': 'market listings live',
  'activity.sales': 'market sales, last hour',
  'activity.vault': 'guild vault moves, last hour',
  'activity.store': 'guild store moves, last hour',
  'activity.trades': 'player trades done, last hour',
  'activity.minted': 'Marks minted, last hour',
  'activity.burned': 'Marks burned, last hour',
});
/** What the players tile cannot say until the relay has a door for it (the design's weak spot "Server status tiles have
 *  no readable source"). */
export const UNMEASURED = Object.freeze(['hub shards', 'layers', 'distinct accounts per room kind']);

/** @typedef {{ amber: number|null, red: number|null }} Limit */
/** @typedef {'grey'|'amber'|'red'} TileLevel */

/** A value's colour against its limit: at or past red is red, at or past amber amber, else (or no limit, or no number) grey.
 *  @param {unknown} value @param {Limit|undefined} limit @returns {TileLevel} */
export function levelOf(value, limit) {
  if (!limit || typeof value !== 'number' || !Number.isFinite(value)) return 'grey';
  if (limit.red != null && value >= limit.red) return 'red';
  if (limit.amber != null && value >= limit.amber) return 'amber';
  return 'grey';
}

/** Each part's answer kept in this isolate: key -> { at, value }. shortcut: one isolate's own, so N isolates serving the
 *  panel read N times a window; a shared row if the staff grows past a handful. */
const kept = new Map();
/** Tests stand fresh isolates. */
export const _resetStatusForTests = () => kept.clear();
/** `fn`'s answer, kept `s` seconds. `fn` never throws - each part answers its own failure. */
async function cached(/** @type {string} */ key, /** @type {number} */ s, /** @type {number} */ nowS, /** @type {() => Promise<any>} */ fn) {
  const k = kept.get(key);
  if (k && nowS >= k.at && nowS - k.at < s) return k.value;
  const value = await fn();
  kept.set(key, { at: nowS, value });
  return value;
}

/** A Cloudflare account id: 32 hex, so nothing else reaches the SQL API's address. */
const ACCOUNT_ID = /^[0-9a-f]{32}$/;
/**
 * ONE QUESTION TO ANALYTICS ENGINE'S SQL API (as tools/d1Load.mjs asks it), with the token the service holds - or
 * `not-configured` without one.
 * @param {any} env @param {string} sql @returns {Promise<{ state: 'ok', rows: any[] }|{ state: 'missing'|'not-configured' }>}
 */
async function aeAsk(env, sql) {
  const token = env?.STAFF_ANALYTICS_TOKEN, acct = env?.STAFF_ANALYTICS_ACCOUNT;
  if (typeof token !== 'string' || !token || typeof acct !== 'string' || !ACCOUNT_ID.test(acct)) return { state: 'not-configured' };
  try {
    const res = await globalThis.fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/analytics_engine/sql`,
      { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: `${sql} FORMAT JSON`, signal: AbortSignal.timeout(STATUS_ASK_MS) });
    const said = res.ok ? await res.json().catch(() => null) : null;
    return Array.isArray(said?.data) ? { state: 'ok', rows: said.data } : { state: 'missing' };
  } catch { return { state: 'missing' }; }
}

/**
 * ONE PUBLIC READ OF THE RELAY - its /health, its live breaches - through the `RELAY` service binding where the Worker
 * has it (sanctions.js pushLaw's reason: one Worker fetching another's workers.dev address may be refused), at the host
 * RELAY_LAW_URL names.
 * @param {any} env @param {string} path @returns {Promise<{ state: 'ok', body: any }|{ state: 'missing'|'not-configured' }>}
 */
async function relayAsk(env, path) {
  const law = env?.RELAY_LAW_URL;
  if (typeof law !== 'string' || !law.startsWith('https://')) return { state: 'not-configured' };
  try {
    const url = new URL(path, law).href;
    const init = { signal: AbortSignal.timeout(STATUS_ASK_MS) };
    const res = typeof env.RELAY?.fetch === 'function' ? await env.RELAY.fetch(new Request(url, init)) : await globalThis.fetch(url, init);
    const body = res.ok ? await res.json().catch(() => null) : null;
    return body && typeof body === 'object' ? { state: 'ok', body } : { state: 'missing' };
  } catch { return { state: 'missing' }; }
}

const num = (/** @type {unknown} */ v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
/** `x` over `d`, to two places. */
const per = (/** @type {number} */ x, /** @type {number} */ d) => Math.round((x / d) * 100) / 100;

const LIMITS_SQL = 'SELECT l.metric, l.amber, l.red, l.set_by, l.set_at, p.handle FROM staff_limits l LEFT JOIN players p ON p.id = l.set_by';
/** The limits' rows by metric, with who set each. @param {any[]|undefined} rows */
const limitsFrom = (rows) => {
  /** @type {Record<string, Limit & { by: string|null, byName: string|null, at: number }>} */
  const out = {};
  for (const l of rows ?? []) out[l.metric] = { amber: l.amber ?? null, red: l.red ?? null, by: l.set_by ?? null, byName: l.handle ?? null, at: l.set_at };
  return out;
};
/** THE LIMITS, by metric. @param {any} db */
export const limitsOf = async (db) => limitsFrom((await db.prepare(LIMITS_SQL).all())?.results);

/** The fast part (STATUS_FAST_S): the limits, the database's own health reads in one batch, and the relay's /health. */
async function fastPart(/** @type {any} */ ctx, /** @type {any} */ env) {
  const { db, nowS } = ctx;
  let health = null, limits = {};
  try {
    const [h, l] = await db.batch([
      db.prepare(`SELECT
          (SELECT COUNT(*) FROM players WHERE handle IS NOT NULL AND played_at > ?1) AS registered,
          (SELECT COUNT(*) FROM mod_cases WHERE status = 'open' AND ai_state = 'failed') AS ai_failed,
          (SELECT MIN(updated_at) FROM mod_cases WHERE ai_state IN ('due', 'reading') AND status = 'open') AS case_wait,
          (SELECT MIN(at) FROM mod_feed WHERE state IN ('due', 'reading')) AS feed_wait`).bind(nowS - PLAY_GRACE_S),
      db.prepare(LIMITS_SQL),
    ]);
    health = h?.results?.[0] ?? null;
    limits = limitsFrom(l?.results);
  } catch (e) { console.warn('[staff-status] the database\'s read', /** @type {any} */ (e)?.message ?? e); health = null; }
  return { at: nowS, db: health ? 'ok' : 'missing', health, limits, relay: await relayAsk(env, '/health') };
}

/** The slow part (STATUS_SLOW_S): Analytics Engine's three questions and the relay's breach list. */
async function slowPart(/** @type {any} */ ctx, /** @type {any} */ env) {
  const w = `timestamp > NOW() - INTERVAL '${STATUS_WINDOW_S / 60}' MINUTE`;
  const [load, cron, rooms, breaches] = await Promise.all([
    aeAsk(env, `SELECT SUM(_sample_interval) AS requests, SUM(IF(double1 >= ${STATUS_SLOW_MS}, 1, 0) * _sample_interval) AS slow,
      SUM(IF(blob3 = '429', 1, 0) * _sample_interval) AS r429, SUM(IF(blob3 = '503', 1, 0) * _sample_interval) AS r503,
      SUM(IF(startsWith(blob3, '5'), 1, 0) * _sample_interval) AS r5xx, SUM(double5 * _sample_interval) AS d1_wait_ms,
      SUM(IF(startsWith(blob6, 'beat'), 1, 0) * _sample_interval) AS beats
      FROM ${ACCOUNT_DATASET} WHERE ${w} AND blob2 != 'CRON'`),
    // a cron firing is one point a job (cron.js runCron): its status '200', or '500' for a job that threw
    aeAsk(env, `SELECT blob1 AS job, SUM(IF(blob3 = '200', 0, 1) * _sample_interval) AS failed FROM ${ACCOUNT_DATASET}
      WHERE timestamp > NOW() - INTERVAL '1' HOUR AND blob2 = 'CRON' GROUP BY job ORDER BY failed DESC LIMIT 60`),
    aeAsk(env, `SELECT blob1 AS kind, SUM(double2 * _sample_interval) AS sockets FROM ${RELAY_DATASET} WHERE ${w} GROUP BY kind ORDER BY sockets DESC LIMIT 40`),
    relayAsk(env, EG_LIVE_PATH),
  ]);
  return { at: ctx.nowS, load, cron, rooms, breaches };
}

/** The activity part (STATUS_ACTIVITY_S): the last hour's, in one statement. Sales and Marks are read through their
 *  tables' `day` index (today's rows, and yesterday's while the hour spans midnight), the guild moves through 0155's. */
async function activityPart(/** @type {any} */ ctx) {
  const { db, nowS } = ctx;
  const cut = nowS - 3600;
  try {
    const r = await db.prepare(`SELECT
        (SELECT COUNT(*) FROM market_listings WHERE state = 'open') AS listings,
        (SELECT COUNT(*) FROM market_sales WHERE day IN (?2, ?3) AND at >= ?1) AS sales,
        (SELECT COUNT(*) FROM guild_vault_log WHERE at >= ?1) AS vault,
        (SELECT COUNT(*) FROM guild_store_moves WHERE at >= ?1) AS store,
        (SELECT COUNT(*) FROM realm_trades WHERE created_at >= ?1 AND state = 'done') AS trades,
        (SELECT COALESCE(SUM(amount), 0) FROM marks_ledger WHERE day IN (?2, ?3) AND at >= ?1 AND src_kind = 'mint') AS minted,
        (SELECT COALESCE(SUM(amount), 0) FROM marks_ledger WHERE day IN (?2, ?3) AND at >= ?1 AND dst_kind = 'burn') AS burned`)
      .bind(cut, utcDay(cut), utcDay(nowS)).first();
    return { at: nowS, state: r ? 'ok' : 'missing', row: r ?? null };
  } catch (e) {
    console.warn('[staff-status] the activity read', /** @type {any} */ (e)?.message ?? e);
    return { at: nowS, state: 'missing', row: null };
  }
}

/**
 * A TILE from its values: each limited metric's colour, the worst the tile's, and the words that say why.
 * @param {string} id @param {string} label @param {Record<string, number|null>} values @param {Record<string, Limit>} limits
 * @param {Record<string, string>} sources @param {number} asOf @param {object} [more]
 */
function tile(id, label, values, limits, sources, asOf, more = {}) {
  /** @type {TileLevel} */
  let level = 'grey';
  const why = [];
  for (const [k, v] of Object.entries(values)) {
    const l = levelOf(v, limits[`${id}.${k}`]);
    if (l === 'grey') continue;
    why.push(`${STATUS_METRICS[/** @type {keyof typeof STATUS_METRICS} */ (`${id}.${k}`)] ?? k}: ${v} (${l} at ${l === 'red' ? limits[`${id}.${k}`].red : limits[`${id}.${k}`].amber})`);
    if (l === 'red' || level === 'grey') level = l;
  }
  return { id, label, level, why, values, sources, asOf, ...more };
}

/**
 * THE STATUS, now: every part from its keeping (or read afresh past it), the tiles drawn with the limits.
 * @param {any} ctx @param {any} env
 */
export async function statusNow(ctx, env) {
  const { nowS } = ctx;
  const [fast, slow, act] = await Promise.all([
    cached('fast', STATUS_FAST_S, nowS, () => fastPart(ctx, env)),
    cached('slow', STATUS_SLOW_S, nowS, () => slowPart(ctx, env)),
    cached('activity', STATUS_ACTIVITY_S, nowS, () => activityPart(ctx)),
  ]);
  const limits = fast.limits;
  const h = fast.health;
  const ok = (/** @type {{ state: string }} */ x) => x.state === 'ok';
  const L = ok(slow.load) ? slow.load.rows[0] ?? {} : null;
  const mins = STATUS_WINDOW_S / 60;
  const requests = L ? num(L.requests) : null;

  /** @type {Record<string, number>} */
  const kinds = {};
  if (ok(slow.rooms)) for (const r of slow.rooms.rows) kinds[String(r.kind)] = num(r.sockets);
  const players = tile('players', 'Players', {
    registered: h ? num(h.registered) : null,
    tabs: L ? num(L.beats) : null,
    breaches: ok(slow.breaches) && Number.isSafeInteger(slow.breaches.body.live) ? slow.breaches.body.live : null,
  }, limits, { registered: fast.db, tabs: slow.load.state, breaches: slow.breaches.state, rooms: slow.rooms.state }, Math.min(fast.at, slow.at), {
    // each room kind's sockets over the window - an estimate from below, sockets not accounts (relayLoad.mjs says why)
    rooms: ok(slow.rooms) ? { basis: `${mins}-minute sockets`, kinds, dungeons: kinds.dungeon ?? 0, arenas: kinds.arena ?? 0, breaches: kinds.eg ?? 0 } : null,
    unmeasured: UNMEASURED,
  });
  const load = tile('load', 'Service load', {
    rps: L ? per(num(L.requests), STATUS_WINDOW_S) : null,
    slow: L ? per(num(L.slow), mins) : null,
    refused: L ? per(num(L.r429) + num(L.r503), mins) : null,
    errors: L ? per(num(L.r5xx) - num(L.r503), mins) : null,   // a 503 is a 5xx: counted once, as refused
    dbWait: L && requests ? per(num(L.d1_wait_ms), requests) : L ? 0 : null,
  }, limits, { analytics: slow.load.state }, slow.at);
  const a = act.row;
  const activity = tile('activity', 'Game activity, last hour', {
    listings: a ? num(a.listings) : null, sales: a ? num(a.sales) : null, vault: a ? num(a.vault) : null, store: a ? num(a.store) : null,
    trades: a ? num(a.trades) : null, minted: a ? num(a.minted) : null, burned: a ? num(a.burned) : null,
  }, limits, { db: act.state }, act.at);

  // HEALTH: red on its own, no limit - a failed cron job, the relay or the service not answering, the reviewer failing
  const failedJobs = ok(slow.cron) ? slow.cron.rows.filter((r) => num(r.failed) > 0).map((r) => String(r.job).replace(/^cron:/, '')) : null;
  const aiOn = modAiOn(env);
  const waited = h ? Math.max(0, ...[h.case_wait, h.feed_wait].filter((t) => t != null).map((t) => nowS - Number(t))) : null;
  const checks = [
    { id: 'cron', ok: failedJobs ? !failedJobs.length : null, why: failedJobs ? (failedJobs.length ? `cron failed in the last hour: ${failedJobs.join(', ')}` : '') : `cron: ${slow.cron.state}` },
    { id: 'relay', ok: ok(fast.relay) ? fast.relay.body.ok === true : fast.relay.state === 'missing' ? false : null,
      why: ok(fast.relay) ? (fast.relay.body.ok === true ? '' : 'relay /health not ok') : fast.relay.state === 'missing' ? 'relay /health did not answer' : 'relay: not-configured',
      version: ok(fast.relay) ? fast.relay.body.version ?? null : null },
    { id: 'service', ok: fast.db === 'ok', why: fast.db === 'ok' ? '' : 'the service\'s database read failed' },
    { id: 'ai', ok: !aiOn ? null : h ? !(num(h.ai_failed) > 0) && !(waited != null && waited >= AI_WAIT_S) : null,
      why: !aiOn ? 'reviewer off' : !h ? '' : [num(h.ai_failed) > 0 ? `${num(h.ai_failed)} open case${num(h.ai_failed) === 1 ? '' : 's'} the AI check failed to read` : '',
        waited != null && waited >= AI_WAIT_S ? `AI check waiting ${Math.floor(waited / 60)} min` : ''].filter(Boolean).join(' · '),
      failed: h ? num(h.ai_failed) : null, waitingS: waited },
  ];
  const sick = checks.filter((c) => c.ok === false);
  const health = { id: 'health', label: 'Health', level: /** @type {TileLevel} */ (sick.length ? 'red' : 'grey'), why: sick.map((c) => c.why), checks, asOf: Math.min(fast.at, slow.at) };

  const tiles = [players, load, activity, health];
  const rank = (/** @type {TileLevel} */ l) => ['grey', 'amber', 'red'].indexOf(l);
  return { at: nowS, level: tiles.reduce((w, t) => (rank(t.level) > rank(w) ? t.level : w), /** @type {TileLevel} */ ('grey')), tiles };
}

/** SERVER STATUS AS A HOME WATCH (Admins only): each tile past a limit, red ones high and amber ones medium. */
export const STATUS_WATCH = Object.freeze({
  id: 'status', label: 'Server status', role: 'admin',
  /** @param {any} ctx @param {any} env @param {any} _who @param {number} n */
  async top(ctx, env, _who, n) {
    const hot = (await statusNow(ctx, env)).tiles.filter((t) => t.level !== 'grey')
      .sort((x, y) => (y.level === 'red' ? 1 : 0) - (x.level === 'red' ? 1 : 0));
    return {
      items: hot.slice(0, n).map((t) => ({ level: t.level === 'red' ? 'high' : 'medium', why: t.why.join(' · '), sub: null, name: t.label })),
      high: hot.filter((t) => t.level === 'red').length, total: hot.length,
    };
  },
});

/** THE HOME ROLL-UP's watches, in their usual order - one plain list; a module's HOME_WATCH joins it by one line. */
export const HOME_WATCHES = [REPORTS_WATCH, ECONOMY_WATCH, GAINS_WATCH, CONTESTED_WATCH, BURSTS_WATCH, MONSTERS_WATCH, FREEZE_WATCH, WATCHLIST_WATCH, STATUS_WATCH];   // the design's Home order: reports, then market and harvesting, then the rest

const LEVELS = Object.freeze(['low', 'medium', 'high']);
/**
 * HOME: the first `n` of every watch `who` may see, each with "N high of M", worst first.
 * @param {any} ctx @param {any} env @param {{ player: any, role: string }} who @param {number} n
 * @param {ReadonlyArray<{ id: string, label: string, role: string, top: (ctx: any, env: any, who: any, n: number) => Promise<any> }>} [watches]
 */
export async function homeOf(ctx, env, who, n, watches = HOME_WATCHES) {
  const mine = watches.filter((w) => w.role === 'moderator' || who.role === 'admin');
  const out = await Promise.all(mine.map(async (w, i) => {
    try {
      const r = await w.top(ctx, env, who, n);
      // a watch may say why in parts (staffRealm.js) - Home says it as one line, parts joined as the panel's lists join them
      const items = (r.items ?? []).slice(0, n).map((/** @type {any} */ x) => (Array.isArray(x.why) ? { ...x, why: x.why.join(' · ') } : x));
      return { id: w.id, label: w.label, items, high: num(r.high), total: num(r.total), more: Math.max(0, num(r.total) - items.length),
        worst: Math.max(-1, ...items.map((x) => LEVELS.indexOf(x.level))), i };
    } catch (e) {
      console.warn(`[staff-home] the ${w.id} watch`, /** @type {any} */ (e)?.message ?? e);
      return { id: w.id, label: w.label, items: [], high: 0, total: 0, more: 0, failed: true, worst: LEVELS.indexOf('medium'), i };
    }
  }));
  out.sort((a, b) => b.worst - a.worst || b.high - a.high || a.i - b.i);
  return { n, watches: out.map(({ worst: _w, i: _i, ...w }) => w) };
}

/**
 * THE STATUS DOORS. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 *   /v1/staff/home { n? }                    every staff member: HOME's answer (n 3, 5 or 10; 5 unsaid); audit home-read
 *   /v1/staff/limits {}                      every staff member: { limits: { metric: { amber, red, by, byName, at } }, metrics }
 *   /v1/staff/status {}                      Admins: { at, level, tiles } - polled with `poll: true` (staff.js: a poll
 *                                            is not the staff member's own act)
 *   /v1/staff/limit/set { metric, amber, red }  Admins: a number 0 or more, or null for none (both null clears it);
 *                                            amber at most red; audit limit-set { metric, amber, red, was }
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffStatus(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  if (path === '/v1/staff/home') {
    const n = body.n === undefined ? HOME_TOP_DEFAULT : body.n;
    if (!HOME_TOPS.includes(n)) return { error: 'body' };
    // STAFF-PANEL-SPEED: the audit row with the watches' first reads, one trip
    const [r] = await Promise.all([homeOf(ctx, env, who, n), audit('home-read', null, { n }, { onceIn: HOME_READ_ROW_S }).run()]);
    return r;
  }
  if (path === '/v1/staff/limits') return { limits: await limitsOf(db), metrics: STATUS_METRICS };
  if (who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  }
  if (path === '/v1/staff/status') return statusNow(ctx, env);
  if (path === '/v1/staff/limit/set') {
    const metric = typeof body.metric === 'string' && Object.hasOwn(STATUS_METRICS, body.metric) ? body.metric : null;
    const line = (/** @type {unknown} */ v) => (v == null ? null : typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : NaN);
    const amber = line(body.amber), red = line(body.red);
    if (!metric || Number.isNaN(amber) || Number.isNaN(red) || (amber != null && red != null && amber > red)) {
      await audit('limit-set', null, { metric: typeof body.metric === 'string' ? body.metric.slice(0, 40) : null, error: 'body' }, { outcome: 'failed' }).run();
      return { error: 'body' };
    }
    const was = await db.prepare('SELECT amber, red FROM staff_limits WHERE metric = ?1').bind(metric).first();
    await db.batch([
      amber == null && red == null
        ? db.prepare('DELETE FROM staff_limits WHERE metric = ?1').bind(metric)
        : db.prepare(`INSERT INTO staff_limits (metric, amber, red, set_by, set_at) VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT (metric) DO UPDATE SET amber = ?2, red = ?3, set_by = ?4, set_at = ?5`).bind(metric, amber, red, who.player.id, nowS),
      audit('limit-set', null, { metric, amber, red, was: was ? { amber: was.amber, red: was.red } : null }),
    ]);
    kept.delete('fast');   // this isolate's tiles take the new line at once; another's within STATUS_FAST_S
    return { ok: true, metric, amber, red };
  }
  return { error: 'not-found' };
}
