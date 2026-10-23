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

import { accountKind, displayName, isMuted, overRate, muteAccount } from './accounts.js';
import { SPROUT_S, canModerate, isDeveloper } from './titles.js';
import { gatePublicKey } from './signing.js';
import { autoMute, autoMutable, lawOrder, pushLaw, bannedUntil, findAccount, actionStatement, voidAutoMutes, banAccount, unbanAccount, reasonOf, muteMinutesOk } from './sanctions.js';
import { STAFF_IDLE_S, auditStatement, staffRole } from './staff.js';   // STAFF-PANEL2-FIX: a claim lives while the staff session that took it does; an act's audit row (each read at a call, never at load)
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

/** STAFF-PANEL2-FIX (design doc, Weak spots: "Spawn cases share one case with chat reports"): a case's kind - `chat`
 *  (reports, the reviewer's feed) or `spawn` (the spawn grants' count, grants.js). One open case an account a kind. */
export const CASE_KINDS = Object.freeze(['chat', 'spawn']);

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
 * STAFF-PANEL2-FIX: of its `kind` - a spawn grants' case is never a chat report's.
 * @param {{ db: any, nowS: number, rand: (b: Uint8Array) => void }} ctx @param {any} env @param {string} target @param {'report'|'review'} source
 * @param {'chat'|'spawn'} [kind]
 */
export async function openCaseFor({ db, nowS, rand }, env, target, source, kind = 'chat') {
  // ONE OPEN CASE AN ACCOUNT A KIND, by the index (mod_cases_open): two reports at once open one case, the second's
  // insert ignored and the first's case read back
  await db.prepare('INSERT OR IGNORE INTO mod_cases (id, target, source, status, opened_at, updated_at, ai_state, discord_state, kind) VALUES (?1, ?2, ?3, \'open\', ?4, ?4, ?5, ?6, ?7)')
    .bind(caseIdOf(rand), target, source, nowS, source === 'review' ? 'done' : modAiOn(env) ? 'due' : 'off', discordOn(env) ? 'due' : 'off', kind).run();
  const open = await db.prepare("SELECT id FROM mod_cases WHERE target = ?1 AND kind = ?2 AND status = 'open'").bind(target, kind).first();
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
  if (!counted && !(await db.prepare("SELECT 1 AS y FROM mod_cases WHERE target = ?1 AND kind = 'chat' AND status = 'open'").bind(target.id).first())
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

/** THE OPEN CASES, the most reporters who count first - a moderator's: chat cases, and a developer's spawn cases too
 *  (STAFF-PANEL2-FIX). @param {{ db: any }} ctx @param {any} actor @param {any} env */
export async function modCases({ db }, actor, env) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const rows = (await db.prepare(`SELECT c.*, p.handle, p.guest_name FROM mod_cases c JOIN players p ON p.id = c.target WHERE c.status = 'open'
    AND (c.kind = 'chat' OR ?2 = 1) ORDER BY c.credible DESC, c.reports DESC, c.updated_at DESC LIMIT ?1`).bind(CASES_LIST_MAX, isDeveloper(actor, env) ? 1 : 0).all())?.results ?? [];
  const reasons = rows.length ? (await db.prepare(`SELECT case_id, reason FROM mod_reports WHERE case_id IN (${rows.map((_, i) => `?${i + 1}`).join(', ')})`).bind(...rows.map((r) => r.id)).all())?.results ?? [] : [];
  return {
    ok: true,
    cases: rows.map((c) => ({ id: c.id, target: c.target, kind: c.kind, name: displayName(c), reports: c.reports, credible: c.credible,
      reasons: [...new Set(reasons.filter((r) => r.case_id === c.id).map((r) => String(r.reason)))], ai: verdictOf(c), auto: c.auto ?? null, openedAt: c.opened_at, updatedAt: c.updated_at })),
  };
}

/** ONE CASE - the account's open one: its lines, reasons and notes, and the reviewer's verdict with the line it flagged.
 *  STAFF-PANEL2-FIX: the one `caseId` names, else its chat case first - a spawn case a developer's alone. */
export async function modCase({ db }, actor, env, { target, name, caseId = null }) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const row = await findAccount(db, { target, name });
  if ('error' in row) return row;
  const c = await db.prepare(`SELECT * FROM mod_cases WHERE target = ?1 AND status = 'open' AND (?2 IS NULL OR id = ?2) AND (kind = 'chat' OR ?3 = 1)
    ORDER BY kind = 'chat' DESC LIMIT 1`).bind(row.id, typeof caseId === 'string' ? caseId : null, isDeveloper(actor, env) ? 1 : 0).first();
  if (!c) return { error: 'no-case' };
  const [lines, reports] = await Promise.all(caseReads(db, c.id).map(async (st) => (await st.all())?.results ?? []));   // STAFF-PANEL-SPEED: one trip
  return { ok: true, case: caseView(row, c, lines, reports) };
}

/** STAFF-PANEL-SPEED (mob: "The click takes a while before the new page shows (it's waiting on the server)"): ONE CASE'S
 *  READS - its lines, then its reports - for modCase, or for the staff panel's own batch (staffCases.js), and the case
 *  as a moderator reads it from their rows (caseView). @param {any} db @param {string} caseId */
export const caseReads = (db, caseId) => [
  db.prepare('SELECT at, sub, name, tab, text FROM mod_case_lines WHERE case_id = ?1 ORDER BY at, sub').bind(caseId),
  db.prepare('SELECT reason, note FROM mod_reports WHERE case_id = ?1 ORDER BY at').bind(caseId),
];
/** @param {any} row the account @param {any} c its case's row @param {any[]} lines @param {any[]} reports caseReads' rows */
export const caseView = (row, c, lines, reports) => ({ id: c.id, target: row.id, kind: c.kind, name: displayName(row), status: c.status, reports: c.reports, credible: c.credible,
  reasons: [...new Set(reports.map((r) => String(r.reason)))], notes: reports.map((r) => r.note).filter(Boolean), ai: verdictOf(c, true), auto: c.auto ?? null,
  lines: lines.map((l) => ({ at: l.at, sub: l.sub, name: l.name, tab: l.tab, text: l.text })) });

/** DISMISS the account's open case - a moderator's: the act recorded, the case's automatic mutes voided (one still
 *  running lifted - its unmute order answered, for the moderator's client to carry and pushed to the relay's door).
 *  STAFF-PANEL2-FIX: modAct's, so the claim and the one act a case are asked as every door's are. */
export const modDismiss = (ctx, actor, env, { target, name, caseId = null }, { fetchFn = (u, i) => globalThis.fetch(u, i) } = {}) =>
  modAct(ctx, actor, env, { act: 'dismiss', target, name, caseId, from: 'in the game' }, { push: (o) => pushLaw(env, fetchFn, o) });

/* ═══ STAFF-PANEL2-FIX - ONE ACT, FROM EVERY DOOR ═══
 * (2026-10-22; design doc "DFO Staff Panel: design", Weak spots "Sanctions, cases and roles" and "Panel Mute and Ban have
 * no route".) A Mute, Ban, Unban or Dismiss is made HERE, whichever door asked - the staff panel (staffCases.js), the
 * game's moderators (index.js /v1/mod/*), Discord's buttons and /mod (discord.js) - so its rules hold at every door:
 * - ONE CASE, ONE SANCTION ("One case can give two strikes"): a Mute, Ban or Dismiss takes its case first (`act_click`,
 *   migration 0156), in the statement that checks nobody took it - two moderators, two doors or two presses on one case
 *   act once, the other refused (`case-acted` while the first is in flight, `case-closed` once it is done). A press's
 *   one-time id (`click`) sent again is answered as the first (`repeat`), never a second strike. A door that names no
 *   case acts on the account's open case modCase shows it (its chat case, else - for a developer - its spawn case).
 * - THE CLAIM ("claims are checked only on Discord"): a case another staff member holds in the panel (claimHeldSql) is
 *   theirs to act on - `staff-claimed`, asked in the same statement that takes the case.
 * - KINDS ("Moderators see only chat cases"): a spawn case is a developer's (`not-developer`).
 * - THE ADMIN'S SANCTION ("A Moderator can lift an Admin's ban"): lifting or cutting short what an Admin set needs an Admin
 *   (accounts.js muteAccount, sanctions.js banAccount and unbanAccount answer `admin-sanction`).
 * Lifting (an unmute, an unban) is no case's act. Every act lands in the strike history as before (`mod_actions`).
 * STAFF-PANEL2-FIX (the flaw review of PR 1):
 * - THE TAKE IS A LEASE: a refused act and a throw both give the case back; a take older than CASE_ACT_S is any press's.
 * - ONE BATCH: the act, its record (the strike) and the case's close land together or not at all, so no throw and no
 *   Worker cut off mid-act leaves a struck case open for a second strike.
 * - ONE PRESS, ONE STRIKE: a click is UNIQUE in `mod_actions` (mod_actions_click, 0156), so the same press sent twice at
 *   once, with no case to take, strikes once - the second's record refused by the index and answered as the first.
 * - THE AUDIT ROW IS WRITTEN HERE (Weak spots: "Audit rows are written inside the shared act code, so in-game and Discord
 *   acts land in the log too"): one row an act - ok, denied or failed, the door named (`from`) - whichever door asked.
 *   The panel hands in its own writer (its session's role and key); the others write as the actor's staff role. */

/** A press's one-time id, as a door sends it (the panel's own, a Discord interaction's id). */
export const CLICK_RE = /^[\w-]{8,64}$/;
/** STAFF-PANEL2-FIX: how long an act holds the case it took before another press may take it - a lease, so an act that
 *  died before it gave the case back (a Worker cut off mid-act) does not hold it for the case's 90 days. */
export const CASE_ACT_S = 60;
/** STAFF-PANEL2-FIX: the refusals an act's audit row calls `denied` (a role's or a claim's door); every other `failed`. */
const ACT_DENIED = Object.freeze(['staff-claimed', 'not-developer', 'admin-sanction']);

/** SQL true while case row `t`'s staff panel claim stands: held, inside its time, and the staff session that took or last
 *  kept it still alive (staff.js staffSession's law: not past its whole life nor its idle) - design doc, Weak spots: "a
 *  claim ends with the claimer's session". `n` the statement's parameter number holding the clock. */
export const claimHeldSql = (/** @type {string} */ t, /** @type {number} */ n) => `(${t}.claimed_by IS NOT NULL AND ${t}.claim_until > ?${n}
  AND EXISTS (SELECT 1 FROM staff_sessions cs WHERE cs.token_hash = ${t}.claim_session AND cs.expires_at > ?${n} AND cs.last_act + ${STAFF_IDLE_S} > ?${n}))`;

/** A mute's end as the record says it, to the minute, in UTC. @param {number} until */
const utcMinute = (until) => new Date(until * 1000).toISOString().slice(0, 16).replace('T', ' ');

/**
 * ONE MODERATOR'S ACT on an account, found by id or name (findAccount). `act` mute (`minutes`, 0 lifts), ban (`days`,
 * `reason`), unban, dismiss; `caseId` the case it answers (else the one modCase shows the actor); `click` the press's
 * one-time id; `row` the account's row, from a door that found it already (STAFF-PANEL-SPEED: staffCases.js); `actorName`
 * what the record says (the door's words beside the name); `keepLonger` a button's: never shorten what stands
 * (DISCORD-5); `resolution` the case's closing words from the act's answer, else the act's own with `from` (the door:
 * 'staff panel', 'in the game', 'Discord') beside them. The order for the rooms
 * goes to `push` (the relay's door, by default). Answers the act's own answer with `case` and `order`, or `{ error }`.
 * STAFF-PANEL2-FIX: the act's audit row written once, whatever its outcome, by `audit` (the panel's; else as the actor's
 * staff role) - a throw is written down as failed and thrown on. One who is no moderator is answered and not written: the
 * game's /v1/mod doors are every player's to knock at, and the audit log is staff's.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => void }} ctx @param {any} actor @param {any} env
 * @param {{ act: 'mute'|'ban'|'unban'|'dismiss', target?: unknown, name?: unknown, row?: any, caseId?: unknown, click?: unknown, minutes?: any, days?: any,
 *   reason?: unknown, actorName?: string, from?: string, keepLonger?: boolean, resolution?: (r: any) => string }} ask
 * @param {{ push?: (order: string) => unknown, audit?: (act: string, target?: string|null, detail?: object|null, how?: object) => any }} [io]
 */
export async function modAct(ctx, actor, env, ask, { push, audit } = {}) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const { db, nowS } = ctx;
  /** What the act found and did, as it goes: for its give-back and its row. */
  const at = { target: /** @type {string|null} */ (null), name: /** @type {string|null} */ (null), click: /** @type {string|null} */ (null),
    caseId: /** @type {string|null} */ (null), take: /** @type {string|null} */ (null), landed: false };
  // the case given back for the next act - never one this act closed
  const giveBack = () => db.prepare("UPDATE mod_cases SET act_click = NULL, act_at = NULL WHERE id = ?1 AND act_click = ?2 AND status = 'open'").bind(at.caseId, at.take).run();
  const write = audit ?? ((/** @type {string} */ act, /** @type {string|null} */ target, /** @type {object|null} */ detail, /** @type {any} */ how) =>
    auditStatement(db, nowS, { actor, role: staffRole(actor, env), act, target, detail, ...how }));
  const num = (/** @type {unknown} */ v) => (Number.isFinite(v) ? v : null);
  // what the row says: never a chat line (design doc: "Audit rows never copy chat text")
  const detail = (/** @type {any} */ r, extra = {}) => ({ name: at.name, door: ask.from ?? null,
    ...(ask.act === 'mute' ? { minutes: num(ask.minutes) } : ask.act === 'ban' ? { days: num(ask.days), reason: typeof ask.reason === 'string' ? ask.reason.slice(0, 200) : null } : {}),
    ...(at.caseId ? { case: at.caseId } : {}), ...(r?.repeat ? { repeat: true } : {}), ...(r?.error ? { error: r.error } : {}), ...extra });
  /** @type {any} */
  let r;
  try { r = await actOnce(ctx, actor, env, ask, push, at); }
  catch (e) {
    // A THROW GIVES THE CASE BACK, as a refusal does (the flaw review: a D1 error mid-act left the case taken until the
    // 90-day sweep). The act, its record and the case's close are one batch, so a case still open was never struck
    if (at.take) await giveBack().catch(() => {});
    // THE SAME PRESS SENT TWICE AT ONCE: the second's record refused by mod_actions_click - answered as the first was
    const first = !at.landed && at.click ? await db.prepare('SELECT 1 AS y FROM mod_actions WHERE click = ?1').bind(at.click).first().catch(() => null) : null;
    if (!first) {
      await write(ask.act, at.target, detail(null, { error: String(/** @type {any} */ (e)?.message ?? e).slice(0, 200), ...(at.landed ? { landed: true } : {}) }), { outcome: 'failed' }).run().catch(() => {});
      throw e;
    }
    r = { ok: true, repeat: true, target: at.target, name: at.name };
  }
  if (r.error && at.take) await giveBack();
  await write(ask.act, at.target, detail(r), { outcome: r.error ? (ACT_DENIED.includes(r.error) ? 'denied' : 'failed') : 'ok' }).run();
  return r;
}

/** modAct's act itself: `at` told what it found and did as it goes. @param {any} ctx @param {any} actor @param {any} env @param {any} ask
 *  @param {((order: string) => unknown)|undefined} push @param {any} at */
async function actOnce(ctx, actor, env, ask, push, at) {
  const { db, nowS, subtle } = ctx;
  const row = ask.row ?? await findAccount(db, { target: ask.target, name: ask.name });   // STAFF-PANEL-SPEED: the panel's, found already
  if ('error' in row) return row;
  const name = displayName(row);
  at.target = row.id; at.name = name;
  const click = ask.click ?? null;
  if (click !== null && !(typeof click === 'string' && CLICK_RE.test(click))) return { error: 'bad-click' };
  at.click = click;
  const lift = ask.act === 'unban' || (ask.act === 'mute' && ask.minutes === 0);
  // STAFF-PANEL-SPEED: the press's one-time id and the act's case read together, one trip - neither needs the other's answer
  const [seen, c] = await Promise.all([
    click ? db.prepare('SELECT 1 AS y FROM mod_actions WHERE click = ?1').bind(click).first() : null,
    lift ? null : ask.caseId != null
      ? (typeof ask.caseId === 'string' ? db.prepare('SELECT * FROM mod_cases WHERE id = ?1 AND target = ?2').bind(ask.caseId, row.id).first() : null)
      // the case modCase shows this actor: the chat case first, a spawn case a developer's alone
      : db.prepare(`SELECT * FROM mod_cases WHERE target = ?1 AND status = 'open' AND (kind = 'chat' OR ?2 = 1)
      ORDER BY kind = 'chat' DESC LIMIT 1`).bind(row.id, isDeveloper(actor, env) ? 1 : 0).first(),
  ]);
  if (seen) return { ok: true, repeat: true, target: row.id, name };
  if (!lift && ask.caseId != null && !c) return { error: 'no-case' };
  if (ask.act === 'dismiss' && !c) return { error: 'no-case' };
  const take = click ?? caseIdOf(ctx.rand);
  if (c) {
    at.caseId = c.id;
    if (c.status !== 'open') return { error: 'case-closed' };
    if (c.kind !== 'chat' && !isDeveloper(actor, env)) return { error: 'not-developer' };
    // THE CASE TAKEN for this act alone - and never one another member holds in the panel - in one statement. A take
    // older than CASE_ACT_S is an act that died holding it (STAFF-PANEL2-FIX): any press's again
    const took = await db.prepare(`UPDATE mod_cases SET act_click = ?2, act_at = ?3 WHERE id = ?1 AND status = 'open' AND (act_click IS NULL OR act_at < ?3 - ${CASE_ACT_S})
      AND (claimed_by IS ?4 OR NOT ${claimHeldSql('mod_cases', 3)})`).bind(c.id, take, nowS, actor.id).run();
    if (!took.meta.changes) {
      const now = await db.prepare(`SELECT status, claimed_by, ${claimHeldSql('mod_cases', 2)} AS held FROM mod_cases WHERE id = ?1`).bind(c.id, nowS).first();
      return { error: now?.held && now.claimed_by !== actor.id ? 'staff-claimed' : now?.status === 'open' ? 'case-acted' : 'case-closed' };
    }
    at.take = take;
  }
  const by = ask.actorName ?? displayName(actor);
  const caseId = c?.id ?? null;
  // AUDIT SAFE SERVICE-2: a moderator's mute or ban closes the case it answered - as the moderator's act. STAFF-PANEL2-FIX:
  // in the one batch that writes the act and its record (the flaw review: closed after them, a throw or a Worker cut off
  // between left a struck case open for a second strike) - all of it lands, or none
  const closing = (/** @type {any} */ x, /** @type {string} */ said) => (c ? [resolveCase(db, { caseId, status: 'actioned', by: displayName(actor),
    resolution: ask.resolution?.(x) ?? (ask.from ? `${said} (${ask.from})` : said), nowS })] : []);
  const mutedTill = (/** @type {any} */ x) => `muted until ${utcMinute(x.until)} UTC`;
  /** @type {any} */
  let r;
  /** @type {string|null} */
  let order = null;
  if (ask.act === 'mute') {
    const minutes = ask.minutes;
    if (ask.keepLonger && muteMinutesOk(minutes) && minutes && isMuted(row, nowS) && Number(row.muted_until) >= nowS + minutes * 60) {
      // DISCORD-5: a button never shortens a mute that stands longer - its act recorded at the longer end
      r = canModerate(row, env) ? { error: 'protected' } : { ok: true, target: row.id, name, until: Number(row.muted_until), kept: true };
      if (!r.error) {
        await db.batch([actionStatement(db, { target: row.id, kind: 'mute', until: r.until, reason: reasonOf(ask.reason), actor: actor.id, actorName: by, caseId, click, at: nowS }), ...closing(r, mutedTill(r))]);
        at.landed = true;
      }
    } else {
      r = await muteAccount(ctx, actor, env, { target: row.id, minutes, also: (/** @type {any} */ x) => [
        actionStatement(db, { target: row.id, kind: x.until ? 'mute' : 'unmute', until: x.until || null, reason: reasonOf(ask.reason), actor: actor.id, actorName: by, caseId, click, at: nowS }),
        ...closing(x, mutedTill(x))] });   // a lift has no case
      if (!r.error) {
        at.landed = true;
        order = await lawOrder(env, subtle, nowS, { s: row.id, mu: r.until });
      }
    }
  } else if (ask.act === 'ban' || ask.act === 'unban') {
    r = ask.act === 'ban'
      ? await banAccount(ctx, actor, env, { target: row.id, days: ask.days, reason: ask.reason, caseId, click, actorName: by, keepLonger: !!ask.keepLonger, also: (x) => closing(x, 'banned') })
      : await unbanAccount(ctx, actor, env, { target: row.id, actorName: by });
    at.landed = !r.error;   // the row, its record and the case's close in one batch (sanctions.js)
    if (!r.error) order = await lawOrder(env, subtle, nowS, { s: row.id, bn: r.until });
  } else if (ask.act === 'dismiss') {
    await db.batch([resolveCase(db, { caseId, status: 'dismissed', by: displayName(actor), resolution: 'no action', nowS }),
      actionStatement(db, { target: row.id, kind: 'dismiss', actor: actor.id, actorName: by, caseId, click, at: nowS })]);
    at.landed = true;
    order = await voidAutoMutes(ctx, env, { caseId: /** @type {string} */ (caseId), row, actor, actorName: by });
    r = { ok: true, target: row.id, name };
  } else r = { error: 'not-found' };
  if (r.error) return r;   // modAct gives the case back
  if (order) await (push ?? ((/** @type {string} */ o) => pushLaw(env, (u, i) => globalThis.fetch(u, i), o)))(order);
  return { ...r, ...(caseId ? { case: caseId } : {}), order };
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
