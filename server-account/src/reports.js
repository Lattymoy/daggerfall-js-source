// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PRIVATE-REPORT - THE SERVICE'S SIDE OF A PLAYER'S PRIVATE REPORT.
//
// Mac (2026-10-17): "Can we add a private disclosure method for
// exploits/bugs with the client".
//
// What a report is - its kinds, its bounds, its states - is
// src/net/reportLaw.js. This file is what its two sides do with one:
// a REPORTER (any registered account) sends one and lists their own;
// a READER (a handle REPORT_READER_HANDLES names, wrangler.toml) lists
// every report, opens one and closes it. Nothing here shows a report to
// anybody else - not a moderator, not a developer the list does not
// name - because an exploit read by one more person is one more person
// who can use it before it is fixed.
//
// ═══ A REPORTER SEES THEIR OWN, AND ONLY ITS HEAD ══════════════════
//
// The list names the reporter in the statement (`WHERE from_id = ?`), as
// the letters' and the post's reads do. It answers whether a reader has
// opened each report and how it was closed - never who read it, and
// never the words back (the reporter wrote them).
//
// ═══ THE READERS ARE A LIST IN CONFIG ══════════════════════════════
//
// The developers' own law (titles.js isDeveloper): granting the door is
// a reviewed, deployed edit, read at every call - a handle taken off the
// list loses the inbox on its next request. Empty is a valid answer: the
// reports wait, unread, until a handle is written there.
// ═══════════════════════════════════════════════════════════════════
import { mintId, displayName, overRate } from './accounts.js';
import { handleList } from './titles.js';
import {
  reportWordsOf, reportContextOf, REPORT_ID_RE, REPORT_RID_RE, REPORT_STATES, REPORT_SEND_MAX, REPORT_WINDOW_S,
  REPORT_OPEN_MAX, REPORT_MINE_MAX, REPORT_INBOX_MAX, REPORT_INBOX_PAGES,
} from '../../src/net/reportLaw.js';

/** Does this player read the reports? A guest holds no handle, so never. @param {any} player @param {any} env */
export const isReportReader = (player, env) =>
  typeof player?.handle === 'string' && !!player.handle
  && handleList(env?.REPORT_READER_HANDLES).has(player.handle.toLowerCase());

/** A row's head as its reporter's list shows it. */
const headOf = (/** @type {any} */ row) => ({
  id: row.id, kind: row.kind, subject: row.subject, sentAt: row.sent_at, read: row.read_at != null, state: row.state,
});
/** ...and as a reader's inbox shows it: who sent it too. */
const inboxHeadOf = (/** @type {any} */ row) => ({ ...headOf(row), from: row.handle != null || row.guest_name != null ? displayName(row) : null });

/**
 * SEND ONE: `{ kind, subject, body, context?, rid }` -> `{ ok, id, sentAt }`, or `{ ok, repeat, id, sentAt }` for a send
 * already made under that `rid` (a lost answer asked again). Refusals: `report-rid`, the words' (`report-kind`,
 * `report-subject`, `report-body`), `report-rate` (REPORT_SEND_MAX an hour), `report-full` (REPORT_OPEN_MAX still open).
 * @param {{ db: any, rand: any, nowS: number }} ctx @param {any} reporter the session's player row
 * @param {{ kind?: unknown, subject?: unknown, body?: unknown, context?: unknown, rid?: unknown }} o
 */
export async function sendReport({ db, rand, nowS }, reporter, { kind, subject, body, context, rid } = {}) {
  if (typeof rid !== 'string' || !REPORT_RID_RE.test(rid)) return { error: 'report-rid' };
  const made = () => db.prepare('SELECT id, sent_at FROM private_reports WHERE from_id = ? AND rid = ?').bind(reporter.id, rid).first();
  const prior = await made();
  if (prior) return { ok: true, repeat: true, id: prior.id, sentAt: prior.sent_at };
  const words = reportWordsOf({ kind, subject, body });
  if ('error' in words) return words;
  // AUDIT PRIVATE-REPORT SVC-3: A FULL QUEUE IS SAID BEFORE THE HOUR IS COUNTED - a send refused for it cost one of the
  // hour's five, and a report closed meanwhile was still refused `report-rate`
  const open = await db.prepare("SELECT COUNT(*) AS n FROM private_reports WHERE from_id = ? AND state = 'open'").bind(reporter.id).first();
  if (Number(open?.n ?? 0) >= REPORT_OPEN_MAX) return { error: 'report-full' };
  if (await overRate({ db, nowS }, `report:${reporter.id}`, REPORT_SEND_MAX, REPORT_WINDOW_S)) return { error: 'report-rate' };
  const ctxOf = reportContextOf(context);
  const id = mintId(rand);
  // THE OPEN BOUND IS THE INSERT'S OWN: two sends racing past the count read above could both land past it.
  // AUDIT PRIVATE-REPORT SVC-1: `ON CONFLICT (from_id, rid) DO NOTHING`, never `INSERT OR IGNORE` - OR IGNORE skips a
  // row a CHECK refuses as quietly as a twin's, and a refusal of the words read as a full queue; a CHECK now throws
  // (the service's 500, a law that drifted from its table said aloud)
  const r = await db.prepare(`INSERT INTO private_reports (id, from_id, rid, kind, subject, body, context, sent_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
    WHERE (SELECT COUNT(*) FROM private_reports WHERE from_id = ?2 AND state = 'open') < ?9
    ON CONFLICT (from_id, rid) DO NOTHING`)
    .bind(id, reporter.id, rid, words.kind, words.subject, words.body, ctxOf ? JSON.stringify(ctxOf) : null, nowS, REPORT_OPEN_MAX).run();
  if (r?.meta?.changes) return { ok: true, id, sentAt: nowS };
  // nothing written: a twin under the same rid raced this one (answered as the report it made), or the account is full
  const again = await made();
  return again ? { ok: true, repeat: true, id: again.id, sentAt: again.sent_at } : { error: 'report-full' };
}

/**
 * A REPORTER'S OWN, newest first: `{ reports: [head...], max }` - whether each was read and how it stands.
 * @param {{ db: any }} ctx @param {any} reporter
 */
export async function myReports({ db }, reporter) {
  const { results = [] } = await db.prepare(`SELECT id, kind, subject, sent_at, read_at, state FROM private_reports
    WHERE from_id = ? ORDER BY sent_at DESC, id DESC LIMIT ?`).bind(reporter.id, REPORT_MINE_MAX).all();
  return { reports: results.map(headOf), max: REPORT_MINE_MAX };
}

/** The reader's counts: open reports nobody has opened, and open reports. One statement, over the state index. */
export async function reportCountsOf(/** @type {any} */ db) {
  const row = await db.prepare(`SELECT COUNT(*) AS open, COALESCE(SUM(read_at IS NULL), 0) AS unread
    FROM private_reports WHERE state = 'open'`).first();
  return { unread: Number(row?.unread ?? 0), open: Number(row?.open ?? 0) };
}

/**
 * A READER'S INBOX: `{ which: 'open' | 'closed', page? }` -> `{ which, page, more, reports: [head + from...], unread, open,
 * max }`. Open: the unopened first, then newest. Closed: the last closed first. AUDIT PRIVATE-REPORT SVC-4: A PAGE OF
 * REPORT_INBOX_MAX, and `more` when another follows - a reader past a hundred open reports (five accounts' noise, twenty
 * each) reaches the oldest unopened one by asking for the next page, never by closing the noise one at a time.
 * `not-report-reader` for anybody the list does not name.
 * @param {{ db: any }} ctx @param {any} reader @param {any} env @param {{ which?: unknown, page?: unknown }} [o]
 */
export async function reportInbox({ db }, reader, env, { which = 'open', page = 0 } = {}) {
  if (!isReportReader(reader, env)) return { error: 'not-report-reader' };
  const closed = which === 'closed';
  const p = Number.isSafeInteger(page) && page >= 0 && page < REPORT_INBOX_PAGES ? page : 0;
  const { results = [] } = await db.prepare(`SELECT r.id, r.kind, r.subject, r.sent_at, r.read_at, r.state, p.handle, p.guest_name
    FROM private_reports r LEFT JOIN players p ON p.id = r.from_id
    WHERE ${closed ? "r.state != 'open'" : "r.state = 'open'"}
    ORDER BY ${closed ? 'r.closed_at DESC' : '(r.read_at IS NULL) DESC, r.sent_at DESC'}, r.id DESC LIMIT ? OFFSET ?`)
    .bind(REPORT_INBOX_MAX + 1, p * REPORT_INBOX_MAX).all();
  return {
    which: closed ? 'closed' : 'open', page: p, more: results.length > REPORT_INBOX_MAX,
    reports: results.slice(0, REPORT_INBOX_MAX).map(inboxHeadOf), ...(await reportCountsOf(db)), max: REPORT_INBOX_MAX,
  };
}

/**
 * OPEN ONE, a reader's: the whole report - its words, its context, who sent it - and its first opening stamped with the
 * reader. `no-report` for an id there is no report under.
 * @param {{ db: any, nowS: number }} ctx @param {any} reader @param {any} env @param {unknown} id
 */
export async function readReport({ db, nowS }, reader, env, id) {
  if (!isReportReader(reader, env)) return { error: 'not-report-reader' };
  if (typeof id !== 'string' || !REPORT_ID_RE.test(id)) return { error: 'no-report' };
  const row = await db.prepare(`SELECT r.*, p.handle, p.guest_name FROM private_reports r LEFT JOIN players p ON p.id = r.from_id
    WHERE r.id = ?`).bind(id).first();
  if (!row) return { error: 'no-report' };
  if (row.read_at == null) await db.prepare('UPDATE private_reports SET read_at = ?, read_by = ? WHERE id = ? AND read_at IS NULL').bind(nowS, reader.id, id).run();
  let context = null;
  try { context = row.context ? reportContextOf(JSON.parse(row.context)) : null; } catch { context = null; }
  return { report: { ...inboxHeadOf(row), read: true, body: row.body, context, closedAt: row.closed_at ?? null } };
}

/**
 * CLOSE ONE - or open it again: `{ id, state }`, `state` one of REPORT_STATES. Closing stamps when and by whom (and reads
 * it, if nobody had - the first reader's stamp kept); `open` clears both and reads nothing (AUDIT PRIVATE-REPORT SVC-6:
 * a report opened again unread stays unread - its reporter's list said "Read by the developers" of words nobody read).
 * `report-state` for a word that is no state, `no-report` for no report.
 * @param {{ db: any, nowS: number }} ctx @param {any} reader @param {any} env @param {{ id?: unknown, state?: unknown }} [o]
 */
export async function closeReport({ db, nowS }, reader, env, { id, state } = {}) {
  if (!isReportReader(reader, env)) return { error: 'not-report-reader' };
  if (typeof state !== 'string' || !REPORT_STATES.includes(state)) return { error: 'report-state' };
  if (typeof id !== 'string' || !REPORT_ID_RE.test(id)) return { error: 'no-report' };
  const open = state === 'open';
  const r = await db.prepare(`UPDATE private_reports SET state = ?1, closed_at = ?2, closed_by = ?3,
    read_at = CASE WHEN ?1 = 'open' THEN read_at ELSE COALESCE(read_at, ?4) END,
    read_by = CASE WHEN ?1 = 'open' THEN read_by ELSE COALESCE(read_by, ?5) END WHERE id = ?6`)
    .bind(state, open ? null : nowS, open ? null : reader.id, nowS, reader.id, id).run();
  return r?.meta?.changes ? { ok: true, id, state } : { error: 'no-report' };
}
