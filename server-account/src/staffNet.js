// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-FEEDS (2026-10-22, design doc "DFO Staff Panel: design": Network bursts and Server load) - THE RELAY'S NET
// FEED, KEPT, AND THE PANEL'S NETWORK BURSTS.
//
// THE DOOR IN: POST /v1/staff/net-feed, a room's window of the players over a limit (server/src/staffFeeds.js), proven by
// the relay's signature over its exact bytes (server/src/staffFeedLaw.js) - the grant feed's kind of door (grants.js),
// never a staff session. A batch is kept once (staff_net_batches), its rows beside it (staff_net_rows; the monsters'
// staff_foe_rows, which staffMonsters.js reads), and the hourly sweep deletes them past STAFF_FEED_KEEP_S: the panel reads
// the latest windows, nothing older.
//
// THE READ (Admins alone): /v1/staff/net { window: '10s'|'1m'|'10m', kind: 'all'|<NET_KINDS>, sort: 'urgent'|'newest',
// from } - each reported player's latest window, its rooms together: the busiest 10 s, the busiest minute and the whole
// ten minutes in frames and bytes, its frames by kind, the frames the relay refused (drops and junk) and its closes for
// "too many frames". Most urgent first (design doc, "What goes first"): a close, then refusals, then the rate the chosen
// window says. ONLY PLAYERS OVER A LIMIT ARE EVER HERE (Server load: the relay reports nobody else), and `asOf` says when
// the last window came - missing data must never look like all quiet (Weak spots, "Missing data looks like all quiet").
// Read from the open panel only, never refreshed by itself: the screen asks when a staff member does.
import { openStaffFeed, NET_FEED_V, NET_KINDS, NET_FEED_MS } from '../../server/src/staffFeedLaw.js';
import { gatePublicKey } from './signing.js';
import { displayName } from './accounts.js';

/** The relay's door in - its STAFF_NET_FEED_URL names it (server/src/staffFeeds.js). */
export const NET_FEED_PATH = '/v1/staff/net-feed';
export const NET_ROUTES = Object.freeze(['/v1/staff/net']);
/** The windows a read takes, s: two of the relay's, so a room that posted late is still in. */
export const NET_READ_S = (2 * NET_FEED_MS) / 1000;
/** A player's rows within this of its newest are one window, its rooms together, s. */
export const NET_WAVE_S = 5 * 60;
/** Rows one read takes at most - only players over a limit post, so a read past this is itself the news. */
export const NET_READ_MAX = 2000;
/** Players one page answers. */
export const NET_PAGE = 25;
/** How long the feed's rows are kept, s (the hourly sweep: cron.js staff-feeds). */
export const STAFF_FEED_KEEP_S = 24 * 3600;
/** A player's refusals and junk in a window past this are high (a starting number to tune). */
export const NET_REFUSED_HIGH = 100;
/** The windows a read ranks by: its frames' and bytes' fields, and its length, s. */
const WINDOWS = Object.freeze({ '10s': ['p10', 'pb10', 10], '1m': ['p60', 'pb60', 60], '10m': ['frames', 'bytes', NET_FEED_MS / 1000] });
const LEVELS = Object.freeze(['low', 'medium', 'high']);
const KIND_COLS = NET_KINDS.map((k) => `k_${k}`);

/**
 * A POSTED WINDOW: kept when the relay's signature holds over a batch young enough, once - `{ ok, read }` (`read` false
 * for one already kept), or `{ error }` (feed-closed: the service holds no relay key; feed-shape; feed-signature; feed-stale).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} env @param {Uint8Array} bytes @param {unknown} sig
 */
export async function takeNetFeed({ db, nowS, subtle }, env, bytes, sig) {
  const opened = await openStaffFeed(NET_FEED_V, bytes, sig, await gatePublicKey(env, subtle), { subtle, nowMs: nowS * 1000 });
  if ('error' in opened) return opened;
  const b = opened.batch;
  // STAFF-PANEL5-FEEDS-FIX: the batch's id is kept IN ONE TRANSACTION WITH ITS ROWS (staffReactions.js takeReactionFeed's
  // way) - kept first, alone, a rows write that failed left the relay's resend under it read as kept, its rows lost
  if (await db.prepare('SELECT 1 AS y FROM staff_net_batches WHERE id = ?1').bind(b.id).first()) return { ok: true, read: false };
  const writes = [
    db.prepare('INSERT INTO staff_net_batches (id, at, q, span_s, ms) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(b.id, nowS, b.q, Math.max(1, Math.round((b.at - b.from) / 1000)), b.ms),   // never OR IGNORE: two at once, the second's whole batch fails
    ...b.net.map((/** @type {any} */ r) => db.prepare(`INSERT INTO staff_net_rows (batch, at, sub, frames, bytes, p10, pb10, p60, pb60, ${KIND_COLS.join(', ')}, refused, junk, closes, close_why)
      VALUES (${Array.from({ length: 20 }, (_, i) => `?${i + 1}`).join(', ')})`).bind(b.id, nowS, r.a, r.n, r.b, r.p10, r.pb10, r.p60, r.pb60, ...r.k, r.nr, r.j, r.c, r.w ?? null)),
    ...b.foe.map((/** @type {any} */ r) => db.prepare('INSERT INTO staff_foe_rows (batch, at, sub, owned, hosted, regular, elite, boss, sea, stripped) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)')
      .bind(b.id, nowS, r.a, r.o, r.h, r.r, r.e, r.bo, r.s, r.x)),
  ];
  await db.batch(writes);
  return { ok: true, read: true };
}

/**
 * A PLAYER'S LEVEL, and why - a close for "too many frames" is high, so are refusals past NET_REFUSED_HIGH; any refusal
 * or junk is medium; a rate alone (the relay's limit) is low. Pure. @param {any} r one player's window
 * @returns {{ level: 'high'|'medium'|'low', why: string[] }}
 */
export function netUrgency(r) {
  const why = [];
  let rank = 0;
  if (r.closes > 0) { rank = 2; why.push(`closed for ${r.closeWhy ?? 'too many frames'}`); }
  const refused = r.refused + r.junk;
  if (refused >= NET_REFUSED_HIGH) { rank = 2; why.push(`${refused} frames refused`); }
  else if (refused > 0) { rank = Math.max(rank, 1); why.push(`${refused} frame${refused === 1 ? '' : 's'} refused`); }
  why.push(`${Math.round(r.p10 / 10)} frames/s at its busiest`);
  return { level: /** @type {'high'|'medium'|'low'} */ (LEVELS[rank]), why };
}

/**
 * THE REPORTED PLAYERS, RANKED: each one's newest window (its rows within NET_WAVE_S of its newest, every room's
 * together), with its level. `window` the one the rate ranks by, `kind` one kind's frames alone (a player who sent none
 * of it is not listed). Answers the list whole and when the last window came.
 * @param {any} db @param {number} nowS @param {{ window?: string, kind?: string, sort?: string }} [how]
 */
export async function netRanked(db, nowS, { window = '10s', kind = 'all', sort = 'urgent' } = {}) {
  const [fCol, bCol, span] = WINDOWS[/** @type {keyof typeof WINDOWS} */ (window)] ?? WINDOWS['10s'];
  // STAFF-PANEL-SPEED: the rows and the last window's time asked together
  const [read, last] = await Promise.all([db.prepare(`SELECT r.*, p.handle, p.guest_name FROM staff_net_rows r LEFT JOIN players p ON p.id = r.sub
    WHERE r.at > ?1 ORDER BY r.at DESC LIMIT ?2`).bind(nowS - NET_READ_S, NET_READ_MAX).all(), db.prepare('SELECT MAX(at) AS at FROM staff_net_batches').first()]);
  const rows = read?.results ?? [];
  const asOf = last?.at ?? null;
  /** @type {Map<string, any>} */
  const by = new Map();
  for (const r of rows) {
    let p = by.get(r.sub);
    if (!p) { p = { sub: r.sub, name: displayName(r), at: r.at, frames: 0, bytes: 0, p10: 0, pb10: 0, p60: 0, pb60: 0, kinds: Object.fromEntries(NET_KINDS.map((k) => [k, 0])), refused: 0, junk: 0, closes: 0, closeWhy: null }; by.set(r.sub, p); }
    if (p.at - r.at > NET_WAVE_S) continue;   // an older window of the same player's
    p.frames += r.frames; p.bytes += r.bytes; p.refused += r.refused; p.junk += r.junk; p.closes += r.closes;
    for (const k of ['p10', 'pb10', 'p60', 'pb60']) p[k] = Math.max(p[k], r[k]);
    NET_KINDS.forEach((k) => { p.kinds[k] += r[`k_${k}`]; });
    p.closeWhy ??= r.close_why;
  }
  const ranked = [...by.values()].filter((p) => kind === 'all' || (p.kinds[kind] ?? 0) > 0).map((p) => {
    const u = netUrgency(p);
    // one kind's frames are counted over the whole window alone (the relay keeps no kind's busiest 10 s)
    const frames = kind === 'all' ? p[fCol] / span : p.kinds[kind] / (NET_FEED_MS / 1000);
    return { ...p, level: u.level, why: u.why, perS: { frames, bytes: p[bCol] / span } };
  });
  const lvl = (/** @type {any} */ x) => LEVELS.indexOf(x.level);
  ranked.sort(sort === 'newest' ? (a, b) => b.at - a.at : (a, b) => lvl(b) - lvl(a) || b.closes - a.closes
    || (b.refused + b.junk) - (a.refused + a.junk) || b.perS.frames - a.perS.frames || b.perS.bytes - a.perS.bytes);
  return { ranked, asOf };
}

/**
 * THE PANEL'S NETWORK BURSTS DOOR. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffNet(ctx, env, path, body, who, audit) {
  if (who.role !== 'admin') { await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run(); return { error: 'staff-admin' }; }
  if (path !== '/v1/staff/net') return { error: 'not-found' };
  const window = Object.hasOwn(WINDOWS, body.window) ? body.window : '10s';
  const kind = NET_KINDS.includes(body.kind) ? body.kind : 'all';
  const sort = body.sort === 'newest' ? 'newest' : 'urgent';
  const from = Number.isSafeInteger(body.from) && body.from > 0 ? body.from : 0;
  // STAFF-PANEL-SPEED: the audit row with the reads, one trip
  const [{ ranked, asOf }] = await Promise.all([netRanked(ctx.db, ctx.nowS, { window, kind, sort }), audit('net-read', null, { window, kind }, { onceIn: 10 * 60 }).run()]);
  return { players: ranked.slice(from, from + NET_PAGE), next: from + NET_PAGE < ranked.length ? from + NET_PAGE : null, total: ranked.length,
    high: ranked.filter((p) => p.level === 'high').length, asOf, windowS: WINDOWS[/** @type {keyof typeof WINDOWS} */ (window)][2] };
}

/** THE HOME ROLL-UP's packet bursts (the status builder's registry): the top `n`, most urgent first. */
export const HOME_WATCH = Object.freeze({
  id: 'bursts', label: 'Packet bursts', role: 'admin',
  /** @param {any} ctx @param {any} env @param {{ role: string }} who @param {number} n */
  async top(ctx, env, who, n) {
    if (who?.role !== 'admin') return { items: [], high: 0, total: 0 };
    const { ranked } = await netRanked(ctx.db, ctx.nowS);
    return { items: ranked.slice(0, n).map((p) => ({ level: p.level, why: p.why.join(' · '), sub: p.sub, name: p.name })), high: ranked.filter((p) => p.level === 'high').length, total: ranked.length };
  },
});
