// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SAFE1, SAFE3, SAFE5, SAFE7 (2026-10-17, Mac: "Lets do every single thing here. I want a full fledged future proof
// system"; the chat safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md): A PLAYER'S BLOCK LIST, A REPORT AND ITS CASE,
// THE REVIEWER'S FEED IN, AND THE CODE OF CONDUCT AGREED.
//
// SAFE1 - THE BLOCK LIST. An account's own list of accounts it no longer hears (`blocks`), kept here so it follows the
// player to every device and applied by the client (net/chat.js and net/social.js `hears`, src/scenes/chatSafetyHost.js).
// Never told to the blocked account.
// Community-Arc's "No block list: a moderator's mute and the per-reader rate are the walls" was the right call for the
// pages (SOC-PAGE); a chat that grew past what three moderators can watch needs the player's own wall too.
//
// SAFE3 - A REPORT IS EVIDENCE OR IT IS NOTHING. A report carries the lines as the reporter heard them, each with the
// relay's stamp (net/safety/chatStamp.js), and every stamp is checked with the relay's public half (GATE_PUBLIC_KEY)
// before a word is kept: a line of the reported account the relay did not relay, or relayed as something else, refuses
// the whole report; another speaker's line that fails is left out (AUDIT SAFE CLIENT-6). Reports
// about one account gather into one open CASE (`mod_cases`), its lines kept once (`mod_case_lines`), its reporters once
// each (`mod_reports`). A case is what a moderator acts on - in Discord (discord.js) or in the game (/cases, /case,
// /dismiss - moderators' own routes), sorted by the reviewer (modAi.js); a moderator's mute or ban of the account closes
// it (resolveCase).
//
// A CASE'S EVIDENCE CANNOT BE CROWDED OUT (AUDIT SAFE SERVICE-1): a reporter's second report adds nothing, and when a
// case is full the account's OWN words come first - the room is made by dropping the oldest lines of others, then the
// account's own oldest (keepCaseLines). Four guest alts filing small talk once filled a case, and the slur three regulars
// reported after it was never kept.
//
// THE AUTOMATIC MUTE, and why it is hard to reach: REPORT_AUTO_MUTE reporters who COUNT (credible: a registered account,
// not muted, no sprout - the Notice Board's law, AUDIT 28 N3 - within REPORT_AUTO_WINDOW_S) mute the account for the
// ladder's first rung (sanctions.js autoMute), never a moderator. Five guests made a minute ago cannot mute anybody;
// three regulars who saw the same line can, for half an hour, and a moderator reads why. ONE MUTE FOR ONE WAVE: the case
// is claimed in the statement that marks it (`auto_at`), so two reports at once mute once (SERVICE-5), and three more
// who count, AFTER that mute, may mute again (SERVICE-2 - it was once a case, and a case stood open ninety days).
// A moderator who DISMISSES the case voids its automatic mutes - the record keeps them, the strikes do not count them,
// and one still running is lifted (SERVICE-6).
//
// A FLOOD OF THE UNCOUNTED (SERVICE-3): reports that do not count open at most UNCOUNTED_CASES_HOUR new cases an hour,
// service-wide - a report on a case already open is always taken - and the reviewer and the cards take the cases with
// the most reporters who count first.
//
// SAFE5 - THE REVIEWER'S FEED IN. The relay posts its public channels' lines, a signed batch (net/safety/chatFeed.js);
// the batch is checked and kept (`mod_feed`) for the minute's clock (safetyClock.js), which has the reviewer read it.
// While the reviewer is off nothing is kept and nothing is checked.
//
// SAFE7 - THE CODE OF CONDUCT AGREED: the version a player agreed to (`players.conduct_v`), which the token's mint says
// back (`conduct`), so the client asks before a first line and again when the code changes.
// ═══════════════════════════════════════════════════════════════════

import { accountKind, displayName, isMuted, overRate } from './accounts.js';
import { SPROUT_S, canModerate } from './titles.js';
import { gatePublicKey } from './signing.js';
import { autoMute, autoMutable, lawOrder, pushLaw, bannedUntil, findAccount, actionStatement, voidAutoMutes } from './sanctions.js';
import { modAiOn } from './modAi.js';
import { discordOn } from './discord.js';
import { ID_RE } from '../../src/net/identityToken.js';
import { verifyStamp } from '../../src/net/safety/chatStamp.js';
import { openFeed } from '../../src/net/safety/chatFeed.js';
import { BLOCKS_MAX, reportShape } from '../../src/net/safety/safetyLaw.js';
import { CONDUCT_VERSION } from '../../src/net/safety/conduct.js';

/** Reports one account may file in REPORT_WINDOW_S. */
export const REPORT_RATE_MAX = 12;
export const REPORT_WINDOW_S = 3600;
/** Blocks and unblocks one account may ask in BLOCK_WINDOW_S. */
export const BLOCK_RATE_MAX = 60;
export const BLOCK_WINDOW_S = 3600;
/** Credible reporters within REPORT_AUTO_WINDOW_S that mute the account they report (the ladder's first rung). */
export const REPORT_AUTO_MUTE = 3;
export const REPORT_AUTO_WINDOW_S = 3600;
/** The most bytes a report's body may be - REPORT_LINES_MAX stamped lines of the longest chat line, and room. */
export const REPORT_BODY_MAX = 24 * 1024;
/** The most lines one case keeps - the account's own first (keepCaseLines). */
export const CASE_LINES_MAX = 60;
/** The new cases reports that do not count may open an hour, service-wide (AUDIT SAFE SERVICE-3). */
export const UNCOUNTED_CASES_HOUR = 60;
/** How long a moderator's press holds a case before another may act on it, seconds (AUDIT SAFE DISCORD-3). */
export const CASE_CLAIM_S = 60;

/** A case's id: 16 hex off the service's random source. @param {(b: Uint8Array) => void} rand */
export const caseIdOf = (rand) => { const b = new Uint8Array(8); rand(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };

/* ═══ SAFE1 - THE BLOCK LIST ═══ */

/** The accounts `player` has blocked, newest first, each with the name a player reads. */
export async function blocksOf({ db }, player) {
  const rows = (await db.prepare('SELECT b.blocked, b.at, p.handle, p.guest_name FROM blocks b JOIN players p ON p.id = b.blocked WHERE b.player = ?1 ORDER BY b.at DESC LIMIT ?2').bind(player.id, BLOCKS_MAX).all())?.results ?? [];
  return { ok: true, blocks: rows.map((r) => ({ sub: r.blocked, name: displayName(r), at: r.at })) };
}

/** BLOCK an account - never oneself, never past BLOCKS_MAX; blocking one already blocked is the list as it was. */
export async function blockAccount(ctx, player, { target }) {
  const { db, nowS } = ctx;
  if (typeof target !== 'string' || !ID_RE.test(target)) return { error: 'no-player' };
  if (target === player.id) return { error: 'block-self' };
  if (await overRate(ctx, `safety-block:${player.id}`, BLOCK_RATE_MAX, BLOCK_WINDOW_S)) return { error: 'rate' };
  const row = await db.prepare('SELECT id FROM players WHERE id = ?1').bind(target).first();
  if (!row) return { error: 'no-player' };
  // ONE STATEMENT DECIDES the bound: the row is written only while fewer than BLOCKS_MAX stand
  const r = await db.prepare('INSERT OR IGNORE INTO blocks (player, blocked, at) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM blocks WHERE player = ?1) < ?4')
    .bind(player.id, target, nowS, BLOCKS_MAX).run();
  if (!r?.meta?.changes) {
    const had = await db.prepare('SELECT 1 AS y FROM blocks WHERE player = ?1 AND blocked = ?2').bind(player.id, target).first();
    if (!had) return { error: 'blocks-full' };
  }
  return blocksOf(ctx, player);
}

/** UNBLOCK an account - one not blocked is the list as it was. */
export async function unblockAccount(ctx, player, { target }) {
  if (typeof target !== 'string' || !ID_RE.test(target)) return { error: 'no-player' };
  if (await overRate(ctx, `safety-block:${player.id}`, BLOCK_RATE_MAX, BLOCK_WINDOW_S)) return { error: 'rate' };
  await ctx.db.prepare('DELETE FROM blocks WHERE player = ?1 AND blocked = ?2').bind(player.id, target).run();
  return blocksOf(ctx, player);
}

/* ═══ SAFE7 - THE CODE OF CONDUCT ═══ */

/** Whether the player has agreed to the code as it stands. @param {any} player */
export const conductAgreed = (player) => player?.conduct_v === CONDUCT_VERSION;

/** AGREE to the code - the version the client showed must be the one this service holds, or the player read old words. */
export async function agreeConduct({ db }, player, { v }) {
  if (v !== CONDUCT_VERSION) return { error: 'conduct-stale' };
  await db.prepare('UPDATE players SET conduct_v = ?1 WHERE id = ?2').bind(CONDUCT_VERSION, player.id).run();
  return { ok: true, conduct: CONDUCT_VERSION };
}

/* ═══ SAFE3 - A REPORT AND ITS CASE ═══ */

/** Whether a reporter COUNTS toward the automatic mute (the Notice Board's law): registered, not muted, no sprout. */
export const credibleReporter = (player, nowS) => accountKind(player) === 'linked' && !isMuted(player, nowS) && Number(player?.created_at) <= nowS - SPROUT_S;

/**
 * The account's open case, or a new one. A case opened by a report is the reports'; one the reviewer opened is the
 * reviewer's (`source`). The Discord post starts `due` when it is on, `off` otherwise; the reviewer's read too - but a
 * case the reviewer opened from the feed starts READ (`done`): that read was its verdict (AUDIT SAFE AI-6).
 * @param {{ db: any, nowS: number, rand: (b: Uint8Array) => void }} ctx @param {any} env @param {string} target @param {'report'|'review'} source
 */
export async function openCaseFor({ db, nowS, rand }, env, target, source) {
  // ONE OPEN CASE AN ACCOUNT, by the index (mod_cases_open): two reports at once open one case, the second's insert
  // ignored and the first's case read back
  await db.prepare('INSERT OR IGNORE INTO mod_cases (id, target, source, status, opened_at, updated_at, ai_state, discord_state) VALUES (?1, ?2, ?3, \'open\', ?4, ?4, ?5, ?6)')
    .bind(caseIdOf(rand), target, source, nowS, source === 'review' ? 'done' : modAiOn(env) ? 'due' : 'off', discordOn(env) ? 'due' : 'off').run();
  const open = await db.prepare("SELECT id FROM mod_cases WHERE target = ?1 AND status = 'open'").bind(target).first();
  return String(open.id);
}

/**
 * A case's lines kept - each once, never past CASE_LINES_MAX, and THE ACCOUNT'S OWN FIRST (AUDIT SAFE SERVICE-1): lines
 * the case holds already are not counted twice; when the account's new lines need room, the case drops the oldest lines
 * of others, then the account's own oldest; the lines of others come in only where room is left, the newest.
 * Answers how many it added. @param {any} db @param {string} caseId
 * @param {{tab: string, sub: string, name: string, at: number, text: string, sg?: string|null}[]} lines
 * @param {string|null} [target] the account the case is about - null keeps the lines as they come
 */
export async function keepCaseLines(db, caseId, lines, target = null) {
  if (!lines.length) return 0;
  const held = (await db.prepare('SELECT at, sub FROM mod_case_lines WHERE case_id = ?1').bind(caseId).all())?.results ?? [];
  const key = (l) => `${l.at}|${l.sub}`;
  const have = new Set(held.map(key));
  const fresh = lines.filter((l) => !have.has(key(l)));
  const own = (target ? fresh.filter((l) => l.sub === target) : fresh).slice(-CASE_LINES_MAX);
  const others = target ? fresh.filter((l) => l.sub !== target) : [];
  let room = CASE_LINES_MAX - held.length;
  const out = [];
  if (own.length > room) {
    out.push(db.prepare('DELETE FROM mod_case_lines WHERE rowid IN (SELECT rowid FROM mod_case_lines WHERE case_id = ?1 ORDER BY (sub = ?2), at LIMIT ?3)')
      .bind(caseId, target ?? '', own.length - room));
    room = own.length;
  }
  const add = [...own, ...(room > own.length ? others.slice(-(room - own.length)) : [])];
  if (!add.length) return 0;
  await db.batch([...out, ...add.map((l) => db.prepare('INSERT OR IGNORE INTO mod_case_lines (case_id, at, sub, name, tab, text, sg) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(caseId, l.at, l.sub, l.name, l.tab, l.text, l.sg ?? null))]);
  return add.length;
}

/** A case touched by a new report: its counts again, and the reviewer and the post due again where each is on now - a
 *  case opened while one was off is taken up once it is on (AUDIT SAFE DISCORD-6). */
export const touchCase = (db, env, caseId, nowS) => db.prepare(`UPDATE mod_cases SET updated_at = ?2,
    reports = (SELECT COUNT(*) FROM mod_reports WHERE case_id = ?1),
    credible = (SELECT COUNT(*) FROM mod_reports WHERE case_id = ?1 AND counted = 1 AND at > ?3),
    ai_state = CASE WHEN ?4 = 1 THEN 'due' ELSE ai_state END,
    discord_state = CASE WHEN ?5 = 1 THEN 'due' ELSE discord_state END
  WHERE id = ?1`).bind(caseId, nowS, nowS - REPORT_AUTO_WINDOW_S, modAiOn(env) ? 1 : 0, discordOn(env) ? 1 : 0).run();

/**
 * A CASE CLOSED - by its id, or the account's open one: actioned or dismissed, by whom and how. The reviewer's read is
 * no longer wanted (AUDIT SAFE AI-2: a dismissed case was read and muted after), and a card that was posted is redrawn
 * without its buttons (DISCORD-8, DISCORD-11); one never posted stays so. A statement, for the caller's batch.
 * @param {any} db @param {{ caseId?: string|null, target?: string|null, status: 'actioned'|'dismissed', by: string, resolution: string, nowS: number }} r
 */
export const resolveCase = (db, { caseId = null, target = null, status, by, resolution, nowS }) => db.prepare(`UPDATE mod_cases SET status = ?3,
    resolved_by = ?4, resolved_at = ?5, resolution = ?6, updated_at = ?5, claimed_at = NULL,
    ai_state = CASE WHEN ai_state IN ('due', 'reading') THEN 'off' ELSE ai_state END,
    discord_state = CASE WHEN discord_msg IS NULL THEN 'off' ELSE 'due' END
  WHERE status = 'open' AND (id = ?1 OR target = ?2)`).bind(caseId, target, status, by, nowS, resolution);

/**
 * FILE A REPORT. `body` is net/safety/safetyLaw.js reportShape's: the account, a reason, a note, and the lines as heard,
 * each stamped. Answers `{ ok, case, repeat?, muted?, order? }` - `order` a mute order the reporter's client carries to
 * its rooms when this report was the one that muted the account (MOD1's carrier), which the relay's door also hears.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => void }} ctx @param {any} reporter @param {any} env @param {any} body
 * @param {{ fetchFn?: (url: string, init: any) => Promise<Response> }} [io]
 */
export async function fileReport(ctx, reporter, env, body, { fetchFn = (u, i) => globalThis.fetch(u, i) } = {}) {
  const { db, nowS, subtle } = ctx;
  const shape = reportShape(body, nowS * 1000);
  if ('error' in shape) return shape;
  if (shape.target === reporter.id) return { error: 'report-self' };
  if (await overRate(ctx, `safety-report:${reporter.id}`, REPORT_RATE_MAX, REPORT_WINDOW_S)) return { error: 'rate' };
  const key = await gatePublicKey(env, subtle);
  if (!key) return { error: 'report-closed' };
  // THE TARGET'S OWN LINES MUST HOLD; ANOTHER SPEAKER'S MAY NOT (AUDIT SAFE CLIENT-6): a context line whose stamp fails
  // is left out, never the report - a client that read one line differently from the relay lost every report it carried
  /** @type {typeof shape.lines} */
  const lines = [];
  for (const l of shape.lines) {
    if (await verifyStamp(l, l.sg, key, { subtle })) lines.push(l);
    else if (l.sub === shape.target) return { error: 'report-unwitnessed' };
  }
  const target = await db.prepare('SELECT * FROM players WHERE id = ?1').bind(shape.target).first();
  if (!target) return { error: 'no-player' };
  const counted = credibleReporter(reporter, nowS) ? 1 : 0;
  if (!counted && !(await db.prepare("SELECT 1 AS y FROM mod_cases WHERE target = ?1 AND status = 'open'").bind(target.id).first())
    && await overRate(ctx, 'safety-uncounted-cases', UNCOUNTED_CASES_HOUR, 3600)) return { error: 'rate' };
  const caseId = await openCaseFor(ctx, env, target.id, 'report');
  const filed = await db.prepare('INSERT OR IGNORE INTO mod_reports (case_id, reporter, reason, note, at, counted) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(caseId, reporter.id, shape.reason, shape.note || null, nowS, counted).run();
  // A REPEAT ADDS NOTHING (AUDIT SAFE SERVICE-1, SERVICE-3): its reporter's lines are in already, and it puts the case
  // back in no queue
  if (!filed?.meta?.changes) return { ok: true, case: caseId, repeat: true };
  await keepCaseLines(db, caseId, lines, target.id);
  await touchCase(db, env, caseId, nowS);
  let order = null, until = 0;
  const row = await db.prepare('SELECT auto_at FROM mod_cases WHERE id = ?1').bind(caseId).first();
  const since = Math.max(nowS - REPORT_AUTO_WINDOW_S, Number(row?.auto_at ?? 0));
  const wave = await db.prepare('SELECT COUNT(*) AS n FROM mod_reports WHERE case_id = ?1 AND counted = 1 AND at > ?2').bind(caseId, since).first();
  if (Number(wave?.n) >= REPORT_AUTO_MUTE && autoMutable(target, env, nowS)) {
    // THE CLAIM: the statement that marks the case decides who mutes - two reports at once mute once
    const claimed = await db.prepare("UPDATE mod_cases SET auto = 'reports', auto_at = ?2 WHERE id = ?1 AND COALESCE(auto_at, 0) = ?3").bind(caseId, nowS, Number(row?.auto_at ?? 0)).run();
    if (claimed?.meta?.changes) {
      until = await autoMute(db, env, target, { actor: 'auto:reports', reason: `${wave.n} reports: ${shape.reason}`, caseId, nowS });
      if (until) {
        order = await lawOrder(env, subtle, nowS, { s: target.id, mu: until });
        await pushLaw(env, fetchFn, order);
      }
    }
  }
  return { ok: true, case: caseId, ...(until ? { muted: until } : {}), ...(order ? { order } : {}) };
}

/* ═══ AUDIT SAFE DOC-4 - THE CASES, READ IN THE GAME ═══
 * A report reached no moderator until Discord was set up ("Moderators read every report" was the code of conduct's word,
 * and the reporter was told "The moderators will see it"). A moderator reads the open cases in the game too (/cases),
 * one case's lines, reports, notes and the reviewer's verdict with the line it flagged (/case), and dismisses one
 * (/dismiss) - which voids its automatic mutes; a moderator's /mute or /ban of the account closes its case. */

/** The open cases one look lists. */
export const CASES_LIST_MAX = 10;
/** The reviewer's word on a case as a moderator reads it, or null. @param {any} c @param {boolean} [full] */
const verdictOf = (c, full = false) => (c.ai_state === 'done' && c.ai_category
  ? { category: c.ai_category, severity: c.ai_severity, confidence: c.ai_confidence, mode: c.ai_mode ?? null,
    ...(full ? { reason: c.ai_reason ?? null, line: c.ai_line_at != null ? { at: c.ai_line_at, sub: c.ai_line_sub } : null } : {}) }
  : null);

/** THE OPEN CASES, the most reporters who count first - a moderator's. @param {{ db: any }} ctx @param {any} actor @param {any} env */
export async function modCases({ db }, actor, env) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const rows = (await db.prepare(`SELECT c.*, p.handle, p.guest_name FROM mod_cases c JOIN players p ON p.id = c.target WHERE c.status = 'open'
    ORDER BY c.credible DESC, c.reports DESC, c.updated_at DESC LIMIT ?1`).bind(CASES_LIST_MAX).all())?.results ?? [];
  const reasons = rows.length ? (await db.prepare(`SELECT case_id, reason FROM mod_reports WHERE case_id IN (${rows.map((_, i) => `?${i + 1}`).join(', ')})`).bind(...rows.map((r) => r.id)).all())?.results ?? [] : [];
  return {
    ok: true,
    cases: rows.map((c) => ({ id: c.id, target: c.target, name: displayName(c), reports: c.reports, credible: c.credible,
      reasons: [...new Set(reasons.filter((r) => r.case_id === c.id).map((r) => String(r.reason)))], ai: verdictOf(c), auto: c.auto ?? null, openedAt: c.opened_at, updatedAt: c.updated_at })),
  };
}

/** ONE CASE - the account's open one: its lines, reasons and notes, and the reviewer's verdict with the line it flagged. */
export async function modCase({ db }, actor, env, { target, name }) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const row = await findAccount(db, { target, name });
  if ('error' in row) return row;
  const c = await db.prepare("SELECT * FROM mod_cases WHERE target = ?1 AND status = 'open'").bind(row.id).first();
  if (!c) return { error: 'no-case' };
  const lines = (await db.prepare('SELECT at, sub, name, tab, text FROM mod_case_lines WHERE case_id = ?1 ORDER BY at, sub').bind(c.id).all())?.results ?? [];
  const reports = (await db.prepare('SELECT reason, note FROM mod_reports WHERE case_id = ?1 ORDER BY at').bind(c.id).all())?.results ?? [];
  return {
    ok: true,
    case: { id: c.id, target: row.id, name: displayName(row), status: c.status, reports: c.reports, credible: c.credible,
      reasons: [...new Set(reports.map((r) => String(r.reason)))], notes: reports.map((r) => r.note).filter(Boolean), ai: verdictOf(c, true), auto: c.auto ?? null,
      lines: lines.map((l) => ({ at: l.at, sub: l.sub, name: l.name, tab: l.tab, text: l.text })) },
  };
}

/** DISMISS the account's open case - a moderator's: the act recorded, the case's automatic mutes voided (one still
 *  running lifted - its unmute order answered, for the moderator's client to carry and pushed to the relay's door). */
export async function modDismiss(ctx, actor, env, { target, name }, { fetchFn = (u, i) => globalThis.fetch(u, i) } = {}) {
  const { db, nowS } = ctx;
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const row = await findAccount(db, { target, name });
  if ('error' in row) return row;
  const c = await db.prepare("SELECT id FROM mod_cases WHERE target = ?1 AND status = 'open'").bind(row.id).first();
  if (!c) return { error: 'no-case' };
  const closed = await resolveCase(db, { caseId: c.id, status: 'dismissed', by: displayName(actor), resolution: 'no action', nowS }).run();
  if (!closed?.meta?.changes) return { error: 'no-case' };
  await actionStatement(db, { target: row.id, kind: 'dismiss', actor: actor.id, actorName: displayName(actor), caseId: c.id, at: nowS }).run();
  const order = await voidAutoMutes(ctx, env, { caseId: c.id, row, actor, actorName: displayName(actor) });
  if (order) await pushLaw(env, fetchFn, order);
  return { ok: true, case: c.id, name: displayName(row), ...(order ? { order } : {}) };
}

/* ═══ SAFE5 - THE REVIEWER'S FEED IN ═══ */

/**
 * A BATCH OF PUBLIC LINES, from the relay: kept for the minute's clock while the reviewer is on - checked with the
 * relay's public half first, a batch seen before kept once. While the reviewer is off it is answered and dropped
 * unread. @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} env @param {Uint8Array} bytes @param {unknown} sig
 */
export async function takeFeed({ db, nowS, subtle }, env, bytes, sig) {
  if (!modAiOn(env)) return { ok: true, read: false };
  const opened = await openFeed(bytes, sig, await gatePublicKey(env, subtle), { subtle, nowMs: nowS * 1000 });
  if ('error' in opened) return opened;
  await db.prepare("INSERT OR IGNORE INTO mod_feed (id, at, lines, state) VALUES (?1, ?2, ?3, 'due')").bind(opened.batch.id, nowS, JSON.stringify(opened.batch.lines)).run();
  return { ok: true, read: true };
}

/** What a banned account is told on every door it knocks at. @param {any} player */
export const bannedAnswer = (player) => ({ error: 'banned', until: bannedUntil(player), reason: player?.ban_reason ?? null });
