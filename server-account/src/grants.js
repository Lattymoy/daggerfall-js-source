// @ts-check
// GRANT2 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md section 12): THE SPAWN GRANTS'
// MEASURE, KEPT AND READ. The relay's cells post their windows of grant asks (src/net/grantMeasure.js), signed with the
// relay's receipt key, to POST /v1/mod/grant-feed - a door proven by that signature, never a session (the chat feed's,
// safety.js takeFeed). A developer reads them with /v1/mod/realm-grants (review.js; tools/realmReview.mjs grants):
// per kind, an account's asks an hour - its quantiles and most - what the buckets standing would have refused, and the
// cells' most live granted members. GRANT5 sets the buckets and the ceiling from it after seven days (the owner, question 3):
// each kind's rate and the ceiling come back suggested beside the standing ones (grantRateSuggested, grantCeilingSuggested).
// GRANT7 (section 15): readers' tallies against one sender, from enough accounts at once, open the moderators' case.
// FOE-BOUNDS and GRANT-ASKS (2026-10-19, Mac: "Spec + B + A"; sections 19 and 21): so does the relay's OWN count - a
// record of a sender's it stripped because no builder could give it, and an account's own asks far past its budget.
import { openGrantMeasure, GRANT_RELAY_READER } from '../../src/net/grantMeasure.js';
import { GRANT_KINDS, GRANT_CELL_CEILING, GRANT_CASE_REASONS } from '../../src/net/grantLaw.js';
import { gatePublicKey } from './signing.js';
import { openCaseFor, keepCaseLines, credibleReporter } from './safety.js';
import { displayName, overRate } from './accounts.js';
import { discordOn } from './discord.js';

/** The door's path - the relay's GRANT_FEED_URL names it (server/wrangler.toml). */
export const GRANT_FEED_PATH = '/v1/mod/grant-feed';
/** The shortest window an account's rate is read over, s - a cell that slept a minute after one ask is not sixty an hour. */
export const GRANT_RATE_SPAN_MIN_S = 600;
/** GRANT7 (the owner, 2026-10-18, question 2: "3 accounts / 10 min"): how many readers' accounts, each one that counts
 *  (safety.js credibleReporter: registered, not muted, no sprout), tallying a case's reasons against one sender inside
 *  GRANT_CASE_WINDOW_S open its moderators' case. */
export const GRANT_CASE_READERS = 3;
export const GRANT_CASE_WINDOW_S = 10 * 60;
/** The most senders one batch's tallies are weighed for (a batch holds GRANT_MEASURE_ROWS rows at most). */
export const GRANT_CASE_SENDERS_MAX = 32;
/** The tab a grant case's line is kept under (mod_case_lines.tab; the Discord card prints it). */
export const GRANT_CASE_TAB = 'grant';
/** GRANT-ASKS (Spawn-Grants section 21): an account's own asks of a kind in one cell's window open its case at this many
 *  times the most its budget lets honest play ask in that window (the kind's `cap` and its `rate` over the window, never
 *  under GRANT_RATE_SPAN_MIN_S) - and at least GRANT_ASK_CASE_OVER_MIN asks past it, so a kind whose budget is a handful
 *  is not a case at its fourth. The buckets are GRANT5's to set; both numbers ride with them. */
export const GRANT_ASK_CASE_TIMES = 4;
export const GRANT_ASK_CASE_OVER_MIN = 16;
/** FOE-BOUNDS and GRANT-ASKS: the most cases the relay's own count may OPEN an hour (a case already open takes its line
 *  whatever this says) - a flood of fresh guest accounts never floods #mod-queue (safety.js UNCOUNTED_CASES_HOUR's way). */
export const GRANT_OWN_CASES_HOUR = 30;

/**
 * A POSTED WINDOW: kept when the relay's signature holds over a batch young enough, once - `{ ok, read }` (`read` false
 * for a batch already kept), or `{ error }` (grant-closed: the service holds no relay key; grant-shape; grant-signature;
 * grant-stale).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => void }} ctx @param {any} env @param {Uint8Array} bytes @param {unknown} sig
 * GRANT7: a batch whose tallies name a sender for a case's reason weighs its case (grantCases) - `cases` the ones touched.
 */
export async function takeGrantMeasure({ db, nowS, subtle, rand }, env, bytes, sig) {
  const opened = await openGrantMeasure(bytes, sig, await gatePublicKey(env, subtle), { subtle, nowMs: nowS * 1000 });
  if ('error' in opened) return opened;
  const b = opened.batch;
  const span = Math.max(1, Math.round((b.at - b.from) / 1000));
  const kept = await db.prepare('INSERT OR IGNORE INTO grant_batches (id, at, q, span_s, live) VALUES (?1, ?2, ?3, ?4, ?5)').bind(b.id, nowS, b.q, span, b.live).run();
  if (!kept?.meta?.changes) return { ok: true, read: false };
  const writes = [
    ...b.rows.map((/** @type {any} */ r) => db.prepare('INSERT INTO grant_rows (batch, at, sub, kind, asks, members, bucket, ceiling, span_s) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(b.id, nowS, r.a, r.k, r.asks, r.members, r.bucket, r.ceiling, span)),
    ...b.tl.map((/** @type {any} */ t) => db.prepare('INSERT INTO grant_tallies (batch, at, reader, sender, reason, n) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(b.id, nowS, t.a, t.b, t.r, t.n)),
  ];
  if (writes.length) await db.batch(writes);
  const ctx = { db, nowS, rand };
  /** @type {Map<string, { texts: string[], readers: boolean }>} the sender, its findings - and whether readers' accounts made one */
  const found = new Map();
  const add = (/** @type {string} */ s, /** @type {string} */ text, readers = false) => { const f = found.get(s) ?? { texts: [], readers: false }; f.texts.push(text); f.readers ||= readers; found.set(s, f); };
  const senders = [...new Set(b.tl.filter((/** @type {any} */ t) => GRANT_CASE_REASONS.includes(t.r) && t.a !== GRANT_RELAY_READER).map((/** @type {any} */ t) => String(t.b)))];
  for (const [s, text] of senders.length ? await grantCases(ctx, env, senders) : []) add(s, text, true);
  for (const t of b.tl) if (t.a === GRANT_RELAY_READER && GRANT_CASE_REASONS.includes(t.r)) add(String(t.b), grantRelayText(t));
  for (const r of b.rows) { const text = grantAskText(r, span); if (text) add(String(r.a), text); }
  const cases = found.size ? await grantCaseLines(ctx, env, found) : 0;
  return { ok: true, read: true, ...(cases ? { cases } : {}) };
}

/** FOE-BOUNDS (section 19): the relay's own word on a sender - the records of its it stripped because no builder could
 *  give them, the worst one's type, its claim and its bound (net/foeBounds.js). */
const grantRelayText = (/** @type {any} */ t) => `the relay itself dropped ${t.n} of this account's foes no builder could give${t.e ? ` - the worst a type ${t.e.t} at ${Math.round(t.e.k)} health, its most ${Math.round(t.e.mx)}` : ''} (Spawn-Grants FOE-BOUNDS)`;
/**
 * GRANT-ASKS (section 21): THE RELAY'S OWN COUNT OF AN ACCOUNT'S ASKS - row `r` (an account's asks of a kind in one cell's
 * window of `span` seconds) far past what its budget lets honest play ask there (GRANT_ASK_CASE_TIMES its most, and
 * GRANT_ASK_CASE_OVER_MIN past it): its words, or null. Its asks, not its bucket's refusals - the cell's ceiling is
 * asked first, so a flood that filled the cell is counted `ceiling` from then on, and a rule on `bucket` alone misses it.
 * Pure. @param {any} r @param {number} span
 */
export function grantAskText(r, span) {
  const law = GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (r?.k)];
  if (!law || !Number.isFinite(r.asks)) return null;
  const allow = Math.ceil(law.cap + law.rate * Math.max(span, GRANT_RATE_SPAN_MIN_S));
  if (r.asks < GRANT_ASK_CASE_TIMES * allow || r.asks - allow < GRANT_ASK_CASE_OVER_MIN) return null;
  return `the relay's own count: this account asked ${r.asks} ${r.k} grants in ${Math.round(Math.max(span, 60) / 60)} minutes, ${Math.floor(r.asks / allow)} times the most its budget lets honest play ask (${allow}) (Spawn-Grants GRANT-ASKS)`;
}

/**
 * GRANT7 (Spawn-Grants section 15): THE MODERATORS' CASE, NEVER A BAN. For each sender a batch's tallies name for a case's
 * reason (net/grantLaw.js GRANT_CASE_REASONS - what only a changed client gives), the readers' accounts that tallied
 * against it inside GRANT_CASE_WINDOW_S; GRANT_CASE_READERS of them that count (credibleReporter - the reports' own law,
 * so a ring of fresh guests opens nothing) open its case, or add to the one open: one line under the `grant` tab - how
 * many players' games refused how many of its foes, and why - once a window. The case is the reviewer's own kind
 * (`review`): no report is filed, so the reports' automatic mute (REPORT_AUTO_MUTE) is never reached, and the AI reader
 * (chat's) is not asked; the Discord post is due where it is on. A moderator decides; nothing here sanctions anyone.
 * Answers each sender's line (grantCaseLines writes it). @param {{ db: any, nowS: number, rand: (b: Uint8Array) => void }} ctx
 * @param {any} env @param {string[]} senders
 */
export async function grantCases(ctx, env, senders) {
  const { db, nowS } = ctx;
  const since = nowS - GRANT_CASE_WINDOW_S;
  const inReasons = GRANT_CASE_REASONS.map((_, k) => `?${k + 3}`).join(', ');
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const sender of senders.slice(0, GRANT_CASE_SENDERS_MAX)) {
    const rows = (await db.prepare(`SELECT reader, reason, SUM(n) AS n FROM grant_tallies WHERE sender = ?1 AND at > ?2 AND reason IN (${inReasons}) GROUP BY reader, reason`)
      .bind(sender, since, ...GRANT_CASE_REASONS).all())?.results ?? [];
    const readers = [...new Set(rows.map((/** @type {any} */ r) => String(r.reader)))].filter((r) => r !== sender && r !== GRANT_RELAY_READER);
    if (readers.length < GRANT_CASE_READERS) continue;
    const counted = [];
    for (const id of readers) {
      const p = await db.prepare('SELECT * FROM players WHERE id = ?1').bind(id).first();
      if (p && credibleReporter(p, nowS)) counted.push(id);
    }
    if (counted.length < GRANT_CASE_READERS) continue;
    const why = new Map();
    for (const r of rows) if (counted.includes(String(r.reader))) why.set(String(r.reason), (why.get(String(r.reason)) ?? 0) + Number(r.n));
    const foes = [...why.values()].reduce((a, n) => a + n, 0);
    out.set(sender, `${counted.length} players' games refused ${foes} of this account's foes in ${GRANT_CASE_WINDOW_S / 60} minutes: ${[...why].map(([r, n]) => `${r} ${n}`).join(', ')} (Spawn-Grants GRANT7)`);
  }
  return out;
}

/**
 * GRANT7 and FOE-BOUNDS / GRANT-ASKS: THE CASES WRITTEN - each sender's findings of one batch as ONE line under the
 * `grant` tab (a line is keyed by its case, second and account: two of one batch's would keep the first alone), once a
 * window: its case opened, or the one open added to, the Discord post due where it is on. The relay's own count opens no
 * new case past GRANT_OWN_CASES_HOUR an hour (readers' cases are GRANT7's own law, three accounts that count). Answers
 * how many cases it touched. @param {{ db: any, nowS: number, rand: (b: Uint8Array) => void }} ctx @param {any} env
 * @param {Map<string, { texts: string[], readers: boolean }>} found
 */
export async function grantCaseLines(ctx, env, found) {
  const { db, nowS } = ctx;
  const since = nowS - GRANT_CASE_WINDOW_S;
  let touched = 0;
  for (const [sender, f] of [...found].slice(0, GRANT_CASE_SENDERS_MAX)) {
    const target = await db.prepare('SELECT * FROM players WHERE id = ?1').bind(sender).first();
    if (!target) continue;
    if (!f.readers && !(await db.prepare("SELECT 1 AS y FROM mod_cases WHERE target = ?1 AND kind = 'spawn' AND status = 'open'").bind(sender).first())
      && await overRate(ctx, 'grant-own-cases', GRANT_OWN_CASES_HOUR, 3600)) continue;
    const caseId = await openCaseFor(ctx, env, sender, 'review', 'spawn');   // STAFF-PANEL2-FIX: a spawn case, never a chat report's
    if (await db.prepare('SELECT 1 AS y FROM mod_case_lines WHERE case_id = ?1 AND tab = ?2 AND at > ?3').bind(caseId, GRANT_CASE_TAB, since).first()) continue;   // one line a window
    await keepCaseLines(db, caseId, [{ tab: GRANT_CASE_TAB, sub: sender, name: displayName(target), at: nowS, text: f.texts.join('; ') }], sender);
    await db.prepare("UPDATE mod_cases SET updated_at = ?2, discord_state = CASE WHEN ?3 = 1 THEN 'due' ELSE discord_state END WHERE id = ?1").bind(caseId, nowS, discordOn(env) ? 1 : 0).run();
    touched++;
  }
  return touched;
}

/**
 * THE MEASURE over the last `days`: per kind, every account-window's asks an hour (its window at least
 * GRANT_RATE_SPAN_MIN_S long) - their count, quantiles and most, by `ranked` - with the asks, members and what the
 * bucket and the ceiling would have refused in all; and the cells' most live granted members, ranked the same, beside
 * the ceiling standing. `ranked` is review.js's (the database asked a rank at a time).
 * @param {any} db @param {number} nowS @param {number} days
 * @param {(n: number, at: (rank: number) => Promise<any>) => Promise<{ quantiles: any[], most: any }>} ranked
 */
export async function grantsMeasure(db, nowS, days, ranked) {
  const since = nowS - days * 24 * 3600;
  const rate = `CAST(ROUND(asks * 3600.0 / MAX(span_s, ${GRANT_RATE_SPAN_MIN_S})) AS INTEGER)`;
  const kinds = [];
  for (const kind of Object.keys(GRANT_KINDS)) {
    const sums = await db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(asks), 0) AS asks, COALESCE(SUM(members), 0) AS members, COALESCE(SUM(bucket), 0) AS bucket, COALESCE(SUM(ceiling), 0) AS ceiling FROM grant_rows WHERE at >= ?1 AND kind = ?2')
      .bind(since, kind).first();
    const n = Number(sums?.n ?? 0);
    const at = async (/** @type {number} */ rank) => (await db.prepare(`SELECT ${rate} AS r FROM grant_rows WHERE at >= ?1 AND kind = ?2 ORDER BY r LIMIT 1 OFFSET ?3`).bind(since, kind, rank).first())?.r ?? null;
    const { quantiles, most } = await ranked(n, at);
    const top = quantiles.at(-1)?.[1] ?? null;
    const standing = GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (kind)];
    kinds.push({ kind, windows: n, asks: Number(sums?.asks ?? 0), members: Number(sums?.members ?? 0), bucket: Number(sums?.bucket ?? 0), ceiling: Number(sums?.ceiling ?? 0), perHour: { quantiles, most },
      rate: { standing: standing.rate, suggested: grantRateSuggested(top) } });
  }
  const cellsN = Number((await db.prepare('SELECT COUNT(*) AS n FROM grant_batches WHERE at >= ?1').bind(since).first())?.n ?? 0);
  const live = await ranked(cellsN, async (rank) => (await db.prepare('SELECT live AS r FROM grant_batches WHERE at >= ?1 ORDER BY live LIMIT 1 OFFSET ?2').bind(since, rank).first())?.r ?? null);
  return { days, kinds, cells: { windows: cellsN, live, ceiling: GRANT_CELL_CEILING, suggested: grantCeilingSuggested(live.most) } };
}

/** GRANT5: the room a suggestion leaves past what honest play reached - half again. */
export const GRANT_SUGGEST_ROOM = 1.5;
/** GRANT5: A KIND'S RATE, SUGGESTED from its 0.999 quantile of an account's asks an hour (null with no measure): asks a
 *  second, half again past it - what GRANT_KINDS' `rate` would be set to before `/relay grantMode enforce`. Pure. */
export const grantRateSuggested = (/** @type {number|null} */ perHour) => (Number.isFinite(perHour) && /** @type {number} */ (perHour) > 0 ? (/** @type {number} */ (perHour) * GRANT_SUGGEST_ROOM) / 3600 : null);
/** GRANT5: THE CELL'S CEILING, SUGGESTED from the most live granted hostile members any cell held - half again past it,
 *  whole (null with no measure). Pure. */
export const grantCeilingSuggested = (/** @type {number|null} */ most) => (Number.isFinite(most) && /** @type {number} */ (most) > 0 ? Math.ceil(/** @type {number} */ (most) * GRANT_SUGGEST_ROOM) : null);
