// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-FEEDS (2026-10-22, design doc "DFO Staff Panel: design": Bot check) - THE BOT CHECK'S REACTIONS, KEPT
// AND READ, Admins alone.
//
// mob (03:51Z): the player's game must not be able to tell it is a check, "or thats worthless"; so (04:47Z) the check
// spawns nothing and times every player's own natural encounters, all the time, with no watch list - the relay
// (server/src/staffFeeds.js) times each from the grant ask it already sees, from the poses it already receives, and posts
// the finished episodes here in signed batches (server/src/staffFeedLaw.js), as the grant feed does.
//
// THE DOOR IN: POST /v1/mod/reaction-feed - a batch kept once (reaction_batches), its episodes in encounter_reactions, a
// row each. Once an hour's episodes pass REACT_ROWS_HOUR, the rest of that hour go in one row a player-hour (sums), so
// the hourly sweep (cron.js 'reactions') always deletes what an hour writes. Kept REACT_KEEP_S (14 days, the design's),
// longer only for an account whose rows staff keep as evidence (`keep_until`).
//
// THE READS (every one in the audit log - design doc: "Every read is in the audit log"):
//   /v1/staff/reactions { target|name, before? } - a player's reactions beside the population's (time to first action,
//     time to first blow, struck before acting), its encounters and Renown per played hour (the counter-signal to a
//     modded game that skips grant asks: Renown with no recorded encounters), and its episodes, newest first.
//   /v1/staff/reactions/keep { target|name, keep } - keep the account's rows REACT_EVIDENCE_S as evidence, or let them go
//     at their 14 days again.
// One episode proves little (design doc: "Act on a pattern of 5 or more"), so `pattern` says when there are that many,
// and a reaction time always carries network delay (Weak spots): it can flag a player, never prove botting.
import { openStaffFeed, REACT_FEED_V } from '../../server/src/staffFeedLaw.js';
import { gatePublicKey } from './signing.js';
import { findAccount } from './sanctions.js';
import { displayName } from './accounts.js';

/** The relay's door in - its REACTION_FEED_URL names it (server/src/staffFeeds.js). */
export const REACTION_FEED_PATH = '/v1/mod/reaction-feed';
export const REACTION_ROUTES = Object.freeze(['/v1/staff/reactions', '/v1/staff/reactions/keep']);
/** How long an episode is kept, s (design doc: "kept 14 days unless staff keep an account's rows as evidence"). */
export const REACT_KEEP_S = 14 * 86400;
/** How long rows kept as evidence are kept from the press, s - a starting number for mob to set. */
export const REACT_EVIDENCE_S = 90 * 86400;
/** Episodes an hour kept a row each; past it, a row a player-hour. Below what the hourly sweep deletes (cron.js
 *  SWEEP_ROWS x ROUNDS_MAX, 25,000) - test/server/staffpanel5feeds.test.js holds it there.
 *  shortcut: a rolled hour writes one row a player besides these, fine below ~5,000 players an hour; past that, count the rolled rows too. */
export const REACT_ROWS_HOUR = 20_000;
/** Episodes before a pattern (design doc: "Act on a pattern of 5 or more"). */
export const REACT_PATTERN = 5;
/** The population's numbers: the last day's episodes, the newest this many at most, read again every REACT_POP_CACHE_S
 *  (Server load: heavy reads cached 5-10 minutes). */
export const REACT_POP_S = 24 * 3600;
export const REACT_POP_MAX = 20_000;
export const REACT_POP_CACHE_S = 10 * 60;
/** Episodes one page answers. */
export const REACT_PAGE = 25;
/** The timed fields: the ask to the first pose, the weapon drawn, the first swing or cast, the first blow landed and taken. */
const TIMES = Object.freeze(['p1', 'wd', 'ac', 'hk', 'hu']);
const SUM_COLS = Object.freeze(['n', 'members', 'span_ms', 'poses', ...TIMES.flatMap((k) => [k, `${k}_n`]), 'dd_n', 'drawn', 'struck', 'mv', 'tn']);
const SUMS_SQL = SUM_COLS.map((c) => `COALESCE(SUM(${c}), 0) AS ${c}`).join(', ');

/**
 * AN EPISODE AS A ROW's numbers: each time beside whether it came, the death, drawn at the ask, and struck before acting
 * (a blow taken with no swing or cast before it). Pure. @param {any} r a reaction batch's row
 */
export function episodeRow(r) {
  /** @type {Record<string, number>} */
  const row = { n: 1, members: r.n, span_ms: r.ms, poses: r.ps, dd_n: r.dd === undefined ? 0 : 1, drawn: r.w0, mv: r.mv, tn: r.tn };
  for (const k of TIMES) { row[k] = r[k] ?? 0; row[`${k}_n`] = r[k] === undefined ? 0 : 1; }
  row.struck = r.hu !== undefined && (r.ac === undefined || r.hu < r.ac) ? 1 : 0;
  return row;
}

/**
 * A POSTED BATCH OF EPISODES: kept when the relay's signature holds over a batch young enough, once - `{ ok, read, rows }`
 * (`read` false for one already kept), or `{ error }` (feed-closed, feed-shape, feed-signature, feed-stale).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} env @param {Uint8Array} bytes @param {unknown} sig
 */
export async function takeReactionFeed({ db, nowS, subtle }, env, bytes, sig) {
  const opened = await openStaffFeed(REACT_FEED_V, bytes, sig, await gatePublicKey(env, subtle), { subtle, nowMs: nowS * 1000 });
  if ('error' in opened) return opened;
  const b = opened.batch;
  // STAFF-PANEL5-FEEDS-FIX: THE BATCH'S ID, ITS ROWS AND THE HOUR'S COUNT ARE KEPT IN ONE TRANSACTION (the db.batch below).
  // The id was kept first, alone: a rows write that failed (D1 overloaded, a 5xx) left it kept, and the relay's resend
  // under it read as one already kept, its episodes lost and the hour's count spent on them. Read first, once - one kept
  // already, and the hour's episodes so far (accounts.js overRate's window); batches posted at one moment may each pass
  // REACT_ROWS_HOUR by their rows, far inside the sweep's room past it.
  const hour = nowS - (nowS % 3600);
  const seen = await db.prepare("SELECT (SELECT 1 FROM reaction_batches WHERE id = ?1) AS kept, (SELECT count FROM rate_limits WHERE key = 'react-rows' AND window_start >= ?2) AS count")
    .bind(b.id, hour).first();
  if (seen?.kept) return { ok: true, read: false, rows: 0 };
  const rolled = Number(seen?.count ?? 0) + b.rows.length > REACT_ROWS_HOUR;
  const cols = ['id', 'sub', 'at', 'kind', ...SUM_COLS];
  const marks = cols.map((_, i) => `?${i + 1}`).join(', ');
  const writes = b.rows.map((/** @type {any} */ r, /** @type {number} */ i) => {
    const row = episodeRow(r);
    const at = Math.floor(r.t / 1000);
    const id = rolled ? `h:${r.a}:${at - (at % 3600)}` : `${b.id}:${i}`;
    return db.prepare(`INSERT INTO encounter_reactions (${cols.join(', ')}) VALUES (${marks})
      ON CONFLICT(id) DO UPDATE SET ${SUM_COLS.map((c) => `${c} = ${c} + excluded.${c}`).join(', ')}`)
      .bind(id, r.a, at, r.k, ...SUM_COLS.map((c) => row[c]));
  });
  await db.batch([
    db.prepare('INSERT INTO reaction_batches (id, at) VALUES (?1, ?2)').bind(b.id, nowS),   // never OR IGNORE: two at once, the second's whole batch fails, and its resend reads it kept
    db.prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES ('react-rows', ?1, ?2)
      ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.window_start >= excluded.window_start THEN rate_limits.count + excluded.count ELSE excluded.count END,
        window_start = MAX(rate_limits.window_start, excluded.window_start)`).bind(hour, b.rows.length),
    ...writes,
  ]);
  return { ok: true, read: true, rows: writes.length };
}

/**
 * A ROW'S NUMBERS, or several rows' summed, AS READ: means where an episode had the time (null where none did), and the
 * shares of episodes. Pure. @param {any} s the sums (SUM_COLS)
 */
export function reactionSummary(s) {
  const n = Number(s.n) || 0;
  const mean = (/** @type {string} */ k) => (s[`${k}_n`] > 0 ? Math.round(s[k] / s[`${k}_n`]) : null);
  const share = (/** @type {number} */ x) => (n ? Math.round((1000 * x) / n) / 1000 : null);
  return {
    episodes: n, members: n ? Math.round((10 * s.members) / n) / 10 : null,
    firstPoseMs: mean('p1'), drawMs: mean('wd'), actMs: mean('ac'), blowMs: mean('hk'), takenMs: mean('hu'),
    acted: share(s.ac_n), landed: share(s.hk_n), struckFirst: share(s.struck), drawnAtAsk: share(s.drawn), died: share(s.dd_n),
    movedM: n ? Math.round(s.mv / n) / 10 : null, turnedDeg: n ? Math.round((s.tn / n / 100) * (180 / Math.PI)) : null,
  };
}

/** The population's numbers and when they were read - this isolate's, read again past REACT_POP_CACHE_S. */
let popCache = /** @type {{ at: number, value: any }|null} */ (null);
/** Tests stand fresh isolates. */
export const _resetReactionsForTests = () => { popCache = null; };

/** THE POPULATION'S NUMBERS: every account's last day of episodes, the newest REACT_POP_MAX - the human baseline (design
 *  doc: "every other player is the human baseline"). @param {any} db @param {number} nowS */
async function population(db, nowS) {
  if (popCache && nowS - popCache.at < REACT_POP_CACHE_S) return popCache.value;
  const sums = await db.prepare(`SELECT ${SUMS_SQL}, COUNT(DISTINCT sub) AS players FROM (SELECT * FROM encounter_reactions WHERE at > ?1 ORDER BY at DESC LIMIT ?2)`)
    .bind(nowS - REACT_POP_S, REACT_POP_MAX).first();
  const value = { ...reactionSummary(sums ?? {}), players: Number(sums?.players ?? 0), sinceS: REACT_POP_S, asOf: nowS };
  popCache = { at: nowS, value };
  return value;
}

/** An episode row as the panel reads it. Pure. @param {any} r */
const episodeOf = (r) => ({ id: r.rid, at: r.at, kind: r.kind, ...reactionSummary(r), keptUntil: r.keep_until ?? null });

/**
 * THE PANEL'S BOT CHECK DOORS. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffReactions(ctx, env, path, body, who, audit) {
  if (who.role !== 'admin') { await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run(); return { error: 'staff-admin' }; }
  if (!REACTION_ROUTES.includes(path)) return { error: 'not-found' };
  const { db, nowS } = ctx;
  const row = await findAccount(db, { target: body.target, name: body.name });
  if ('error' in row) return row;
  const name = displayName(row);
  if (path === '/v1/staff/reactions/keep') {
    const keep = body.keep === true;
    const until = keep ? nowS + REACT_EVIDENCE_S : null;
    const r = await db.prepare('UPDATE encounter_reactions SET keep_until = ?1 WHERE sub = ?2').bind(until, row.id).run();
    const rows = Number(r?.meta?.changes ?? 0);
    await audit('reactions-keep', row.id, { name, keep, rows }).run();
    return { ok: true, rows, keptUntil: until };
  }
  const before = Number.isSafeInteger(body.before) && body.before > 0 ? body.before : Number.MAX_SAFE_INTEGER;
  const since = nowS - REACT_KEEP_S;
  const [mine, recent, play, page, pop] = await Promise.all([
    db.prepare(`SELECT ${SUMS_SQL} FROM encounter_reactions WHERE sub = ?1`).bind(row.id).first(),
    db.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM encounter_reactions WHERE sub = ?1 AND at > ?2').bind(row.id, since).first(),
    // played seconds between Renown claims (progress.js spendProgress), and the Renown claimed, over the same days
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS renown, COALESCE(SUM(played_s), 0) AS played FROM progress_hours WHERE player = ?1 AND stream = 'renown' AND hour > ?2").bind(row.id, since).first(),
    db.prepare('SELECT rowid AS rid, * FROM encounter_reactions WHERE sub = ?1 AND rowid < ?2 ORDER BY rowid DESC LIMIT ?3').bind(row.id, before, REACT_PAGE + 1).all(),
    population(db, nowS),
    audit('reactions-read', row.id, { name }, { onceIn: 10 * 60 }).run(),   // STAFF-PANEL-SPEED: the audit row with the reads, one trip
  ]);
  const episodes = (page?.results ?? []).slice(0, REACT_PAGE).map(episodeOf);
  const hours = Number(play?.played ?? 0) / 3600;
  const player = reactionSummary(mine ?? {});
  return {
    sub: row.id, name, player, population: pop, pattern: player.episodes >= REACT_PATTERN,
    perHour: { days: REACT_KEEP_S / 86400, playedH: Math.round(hours * 10) / 10, encounters: Number(recent?.n ?? 0), renown: Number(play?.renown ?? 0),
      encountersPerH: hours > 0 ? Math.round((10 * Number(recent?.n ?? 0)) / hours) / 10 : null, renownPerH: hours > 0 ? Math.round(Number(play?.renown ?? 0) / hours) : null },
    episodes, next: (page?.results?.length ?? 0) > REACT_PAGE ? episodes[episodes.length - 1].id : null,
  };
}
