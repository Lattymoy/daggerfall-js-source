// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SAFE5 + SAFE8 (2026-10-17, the chat safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md sections 6 and 9): THE
// CHAT SAFETY'S CLOCK - what no request waits on. Every minute (cron.js MINUTE_JOBS 'safety'):
//   1. the reviewer reads the cases reports opened or grew (TRIAGE_MAX), the most reporters who count first, and gives
//      each its verdict on the reported account's lines - BEFORE the feed (AUDIT SAFE AI-3: the feed spent the day's
//      calls first, and a report went unread);
//   2. the reviewer reads the relay's waiting feed batches - as many as fit FEED_LINES_MAX lines in one call (AI-3: a
//      batch of two lines cost a call of its own), FEED_READS_MAX calls - and opens a case for each speaker it finds
//      breaking the code at FLAG_SEVERITY or worse: their flagged lines and the CONTEXT_BEFORE lines before each;
//   3. every case whose verdict is in (or that has waited REVIEW_WAIT_S since it opened on a reviewer that does not
//      answer) is posted to the moderators' channel, or its card redrawn (POSTS_MAX), the most reporters first.
//
// A READ IS CLAIMED (AI-9): the statement that takes a batch or a case marks it `reading`, so two firings that overlap
// never read one twice; a claim a firing never finished is free again after CLAIM_STALE_S. A batch is DONE only once
// its cases are written (AI-5). Each read asks the firing's statement budget first (cron.js ctx.budget, AI-5: a raid's
// batch cost 1,310 statements against a share of 54), and one read opens at most FEED_SPEAKERS_MAX cases, the worst
// speakers first - the rest go back to the feed to be read again.
//
// A READ THAT CAME BACK UNREAD LOSES NOTHING (AI-4): a reviewer out of its day's calls, unreachable or misconfigured
// leaves its batches and cases for the next minute; one that declined, was cut off or answered out of shape sends its
// lines back as two halves, each read on its own, and a single line it would not read becomes a case of its own for the
// moderators, marked unread. Nothing the model refused is ever dropped unread - the most severe line is the likeliest
// to be refused.
//
// THE REVIEWER NEVER MUTES ON ONE READ (AI-1). With MOD_AI "on", a verdict that acts (modAi.js flagActs) mutes for the
// ladder's first rung only after a SECOND read of the account's own lines and nothing else agrees - no other speaker's
// words reach the read that acts, so a line that frames another ("P1's line hides a slur") frames nobody. It never acts
// on a case that is no longer open (AI-2), and the case is claimed in the statement that marks it (`auto_at`).
//
// Every hour (HOUR_JOBS 'safety-sweep'), each a page asked again while full and the budget holds (AI-7: one page of
// 500 an hour kept the feed's lines past the privacy policy's day): the feed's batches past FEED_KEEP_S; a case left
// open past CASE_OPEN_MAX_S closed as expired; a resolved case's lines, its reports' notes and the reviewer's reason
// past RESOLVED_LINES_KEEP_S - and its card in the moderators' channel redrawn without them (DOC-1: the copy in Discord
// outlived the policy's ninety days); the reviewer's daily counts past AI_DAYS_KEEP.
// ═══════════════════════════════════════════════════════════════════

import { reviewLines, modAiOn, modAiModeOf, flagActs, FLAG_SEVERITY, AI_WAITS } from './modAi.js';
import { discordOn, sendCard, cardOf } from './discord.js';
import { openCaseFor, keepCaseLines } from './safety.js';
import { autoMute, autoMutable, lawOrder, pushLaw } from './sanctions.js';
import { FEED_LINES_MAX } from '../../src/net/safety/chatFeed.js';

/** The calls the reviewer makes on the feed a minute - each reads as many waiting batches as fit FEED_LINES_MAX. */
export const FEED_READS_MAX = 2;
/** The waiting batches one feed read takes up to (their lines bounded by FEED_LINES_MAX). */
export const FEED_COMBINE_ROWS = 20;
/** The cases one feed read opens at most, the worst speakers first - the rest are read again. */
export const FEED_SPEAKERS_MAX = 6;
/** The cases the reviewer reads a minute. */
export const TRIAGE_MAX = 3;
/** The cards posted or redrawn a minute (Discord's own rate is five a channel in five seconds). */
export const POSTS_MAX = 5;
/** The feed's lines kept before each flagged line, for context. */
export const CONTEXT_BEFORE = 3;
/** How long a new case waits on a reviewer that does not answer before it is posted without a verdict, seconds. */
export const REVIEW_WAIT_S = 600;
/** How long a firing's claim on a batch or a case holds before another firing may take it, seconds. */
export const CLAIM_STALE_S = 600;
/** How long the feed's batches are kept (a batch seen twice inside it is read once), seconds. */
export const FEED_KEEP_S = 24 * 3600;
/** How long a resolved case keeps its lines, its reports' notes and the reviewer's reason, seconds. */
export const RESOLVED_LINES_KEEP_S = 90 * 24 * 3600;
/** How long a case may stand open before the clock closes it as expired, seconds. */
export const CASE_OPEN_MAX_S = 90 * 24 * 3600;
/** How many days of the reviewer's counts are kept. */
export const AI_DAYS_KEEP = 31;
/** The rows one page of the sweep takes a table... */
export const SAFETY_SWEEP_ROWS = 500;
/** ...and the pages it asks at most an hour. */
export const SAFETY_SWEEP_ROUNDS = 25;

/** Whether the firing's statement budget holds (a caller with none - a test - always may). */
const more = (ctx) => (typeof ctx.budget === 'function' ? ctx.budget() : true);
/** `?1, ?2, ...` for `n` ids. */
const slots = (n, from = 1) => Array.from({ length: n }, (_, i) => `?${i + from}`).join(', ');
/** A worse flag first: severity, then confidence. */
const worse = (a, b) => (b.severity - a.severity) || (b.confidence - a.confidence);
/** The worst of a set of flags, or null. @param {any[]} flags */
const worstOf = (flags) => [...flags].sort(worse)[0] ?? null;
/** A batch's lines, as kept. @param {unknown} json */
const linesOf = (json) => { try { const v = JSON.parse(String(json ?? '[]')); return Array.isArray(v) ? v : []; } catch { return []; } };

/**
 * A verdict that acts, acted on - with MOD_AI "on", on an open case, on an account an automatic mute may fall on, and
 * only when a second read of the account's OWN lines agrees (AI-1; a read whose lines were the account's alone is its
 * own second read). The case is claimed in the statement that marks it; the order is pushed.
 * @param {any} ctx @param {any} env @param {any} fetchFn @param {string} caseId @param {string} targetId @param {any} flag
 * @param {{ sub: string, tab: string, text: string }[]} lines the lines the verdict read
 */
async function actOn(ctx, env, fetchFn, caseId, targetId, flag, lines) {
  if (modAiModeOf(env) !== 'on' || !flagActs(flag)) return 0;
  const c = await ctx.db.prepare('SELECT status, auto_at FROM mod_cases WHERE id = ?1').bind(caseId).first();
  if (c?.status !== 'open') return 0;
  const row = await ctx.db.prepare('SELECT * FROM players WHERE id = ?1').bind(targetId).first();
  if (!autoMutable(row, env, ctx.nowS)) return 0;
  const own = lines.filter((l) => l.sub === targetId);
  if (own.length < lines.length) {
    const again = await reviewLines(ctx.db, env, fetchFn, { lines: own, focus: targetId, nowS: ctx.nowS });
    if (!('flags' in again) || !flagActs(worstOf(again.flags))) return 0;
  }
  const claimed = await ctx.db.prepare("UPDATE mod_cases SET auto = 'review', auto_at = ?2 WHERE id = ?1 AND status = 'open' AND COALESCE(auto_at, 0) = ?3")
    .bind(caseId, ctx.nowS, Number(c.auto_at ?? 0)).run();
  if (!claimed?.meta?.changes) return 0;
  const until = await autoMute(ctx.db, env, row, { actor: 'auto:review', reason: `reviewer: ${flag.category}, severity ${flag.severity}`, caseId, nowS: ctx.nowS });
  if (!until) return 0;
  await pushLaw(env, fetchFn, await lawOrder(env, crypto.subtle, ctx.nowS, { s: targetId, mu: until }));
  return 1;
}

/**
 * A verdict kept on its case - only ever raised (a worse severity, or the same at more confidence - AI-12), with the
 * line it flagged (AI-10) - and the card due again. A read of the case itself (`read`, the triage's) closes its claim;
 * the feed's verdict on a case a report holds leaves that report's read due (AI-6).
 * @param {any} db @param {string} caseId @param {any} flag @param {{ at: number, sub: string }|null} line
 * @param {string} mode @param {number} nowS @param {{ read: boolean }} how
 */
async function keepVerdict(db, caseId, flag, line, mode, nowS, { read }) {
  await db.prepare(`UPDATE mod_cases SET ai_category = ?2, ai_severity = ?3, ai_confidence = ?4, ai_reason = ?5, ai_mode = ?6, ai_at = ?7,
      ai_line_at = ?8, ai_line_sub = ?9, updated_at = ?7, discord_state = CASE WHEN discord_state = 'off' THEN 'off' ELSE 'due' END
    WHERE id = ?1 AND (ai_severity IS NULL OR ai_severity < ?3 OR (ai_severity = ?3 AND COALESCE(ai_confidence, 0) <= ?4))`)
    .bind(caseId, flag?.category ?? null, flag?.severity ?? 0, flag?.confidence ?? null, flag?.reason ?? null, mode, nowS, line?.at ?? null, line?.sub ?? null).run();
  if (read) {
    await db.prepare("UPDATE mod_cases SET ai_state = 'done', ai_mode = ?2, ai_at = ?3, discord_state = CASE WHEN discord_state = 'off' THEN 'off' ELSE 'due' END WHERE id = ?1 AND ai_state = 'reading'")
      .bind(caseId, mode, nowS).run();
  }
}

/** 1. THE CASES READ: each the reports opened or grew, claimed, its verdict on the reported account's own lines. */
async function triageCases(ctx, env, fetchFn) {
  let n = 0;
  for (let i = 0; i < TRIAGE_MAX && more(ctx); i++) {
    // an open case is due when a report grew it, or when it opened while the reviewer was off and was never read
    const c = await ctx.db.prepare(`UPDATE mod_cases SET ai_state = 'reading', ai_at = ?1 WHERE id = (SELECT id FROM mod_cases WHERE status = 'open'
        AND (ai_state = 'due' OR (ai_state = 'off' AND ai_at IS NULL) OR (ai_state = 'reading' AND ai_at < ?2))
        ORDER BY credible DESC, reports DESC, updated_at LIMIT 1) RETURNING id, target`).bind(ctx.nowS, ctx.nowS - CLAIM_STALE_S).first();
    if (!c) break;
    const lines = (await ctx.db.prepare('SELECT at, sub, tab, text FROM mod_case_lines WHERE case_id = ?1 ORDER BY at, sub').bind(c.id).all())?.results ?? [];
    const r = await reviewLines(ctx.db, env, fetchFn, { lines, focus: c.target, nowS: ctx.nowS });
    if ('error' in r && AI_WAITS.includes(r.error)) {
      await ctx.db.prepare("UPDATE mod_cases SET ai_state = 'due' WHERE id = ?1 AND ai_state = 'reading'").bind(c.id).run();
      break;
    }
    n++;
    if (!('flags' in r)) {
      await ctx.db.prepare("UPDATE mod_cases SET ai_state = 'failed', ai_at = ?2, discord_state = CASE WHEN discord_state = 'off' THEN 'off' ELSE 'due' END WHERE id = ?1 AND ai_state = 'reading'").bind(c.id, ctx.nowS).run();
      continue;
    }
    const worst = worstOf(r.flags.filter((f) => lines[f.line]?.sub === c.target));
    await keepVerdict(ctx.db, c.id, worst, worst ? lines[worst.line] : null, modAiModeOf(env), ctx.nowS, { read: true });
    await actOn(ctx, env, fetchFn, c.id, c.target, worst, lines);
  }
  return n;
}

/** The batches a read took, marked: back to waiting (`due`), or read (`done`, their lines dropped). */
const markFeed = (db, ids, state) => db.prepare(state === 'done'
  ? `UPDATE mod_feed SET state = 'done', lines = NULL, read_at = NULL WHERE id IN (${slots(ids.length)})`
  : `UPDATE mod_feed SET state = 'due', read_at = NULL WHERE id IN (${slots(ids.length)})`).bind(...ids).run();
/** Lines sent back to the feed to be read on their own - a new waiting batch. */
const requeue = (db, id, at, lines) => db.prepare("INSERT OR IGNORE INTO mod_feed (id, at, lines, state) VALUES (?1, ?2, ?3, 'due')").bind(id, at, JSON.stringify(lines));

/** The cases one feed read opens: the worst speakers first, each with its flagged lines and the context before them;
 *  speakers past FEED_SPEAKERS_MAX go back to the feed with their own lines and the context they need. */
async function openFeedCases(ctx, env, fetchFn, head, lines, flags) {
  /** @type {Map<string, any[]>} */
  const bySpeaker = new Map();
  for (const f of flags) if (f.severity >= FLAG_SEVERITY) bySpeaker.set(lines[f.line].sub, [...(bySpeaker.get(lines[f.line].sub) ?? []), f]);
  const ranked = [...bySpeaker].sort(([, a], [, b]) => worse(worstOf(a), worstOf(b)));
  const kept = (fs) => { const keep = new Set(); for (const f of fs) for (let i = Math.max(0, f.line - CONTEXT_BEFORE); i <= f.line; i++) keep.add(i); return [...keep].sort((x, y) => x - y); };
  const later = ranked.slice(FEED_SPEAKERS_MAX);
  if (later.length) await requeue(ctx.db, `${head.id}.r`, head.at, [...new Set(later.flatMap(([, fs]) => kept(fs)))].sort((x, y) => x - y).map((i) => lines[i])).run();
  for (const [sub, fs] of ranked.slice(0, FEED_SPEAKERS_MAX)) {
    if (!(await ctx.db.prepare('SELECT 1 AS y FROM players WHERE id = ?1').bind(sub).first())) continue;
    const mine = kept(fs).map((i) => lines[i]);
    const caseId = await openCaseFor(ctx, env, sub, 'review');
    await keepCaseLines(ctx.db, caseId, mine.map((l) => ({ ...l, sg: null })), sub);
    const worst = worstOf(fs);
    await keepVerdict(ctx.db, caseId, worst, lines[worst.line], modAiModeOf(env), ctx.nowS, { read: false });
    await actOn(ctx, env, fetchFn, caseId, sub, worst, mine);
  }
}

/** 2. THE FEED READ: the waiting batches claimed, as many as fit one call; a case for each speaker found breaking the code. */
async function readFeed(ctx, env, fetchFn) {
  let n = 0;
  for (let read = 0; read < FEED_READS_MAX && more(ctx); read++) {
    const rows = ((await ctx.db.prepare(`UPDATE mod_feed SET state = 'reading', read_at = ?1 WHERE id IN (SELECT id FROM mod_feed
        WHERE state = 'due' OR (state = 'reading' AND read_at < ?2) ORDER BY at, id LIMIT ?3) RETURNING id, at, lines`)
      .bind(ctx.nowS, ctx.nowS - CLAIM_STALE_S, FEED_COMBINE_ROWS).all())?.results ?? []).sort((a, b) => (a.at - b.at) || (a.id < b.id ? -1 : 1));
    if (!rows.length) break;
    const take = [], lines = [];
    for (const r of rows) {
      const ls = linesOf(r.lines);
      if (take.length && lines.length + ls.length > FEED_LINES_MAX) break;
      take.push(r);
      lines.push(...ls);
    }
    const back = rows.slice(take.length).map((r) => r.id);
    if (back.length) await markFeed(ctx.db, back, 'due');
    const ids = take.map((r) => r.id);
    const r = lines.length ? await reviewLines(ctx.db, env, fetchFn, { lines, nowS: ctx.nowS, feed: true }) : { ok: true, flags: [] };
    if ('error' in r && AI_WAITS.includes(r.error)) { await markFeed(ctx.db, ids, 'due'); break; }
    n++;
    if ('flags' in r) await openFeedCases(ctx, env, fetchFn, take[0], lines, r.flags);
    else if (lines.length > 1) {
      const mid = Math.ceil(lines.length / 2);
      await ctx.db.batch([requeue(ctx.db, `${take[0].id}.a`, take[0].at, lines.slice(0, mid)), requeue(ctx.db, `${take[0].id}.b`, take[0].at, lines.slice(mid))]);
    } else if (await ctx.db.prepare('SELECT 1 AS y FROM players WHERE id = ?1').bind(lines[0].sub).first()) {
      // ONE LINE THE REVIEWER WOULD NOT READ: the moderators read it - a case of its own, marked unread
      const caseId = await openCaseFor(ctx, env, lines[0].sub, 'review');
      await keepCaseLines(ctx.db, caseId, [{ ...lines[0], sg: null }], lines[0].sub);
      await ctx.db.prepare("UPDATE mod_cases SET ai_state = 'failed', ai_at = ?2, updated_at = ?2, discord_state = CASE WHEN discord_state = 'off' THEN 'off' ELSE 'due' END WHERE id = ?1 AND ai_severity IS NULL")
        .bind(caseId, ctx.nowS).run();
    }
    await markFeed(ctx.db, ids, 'done');
  }
  return n;
}

/** 3. THE CARDS: each case due (or open and never posted, the queue having been off - DISCORD-6), posted or redrawn
 *  once its verdict is in or it has waited REVIEW_WAIT_S since it opened (AI-11), the most reporters first. A card
 *  Discord refuses is marked and passed over (DISCORD-2: one refused card held the whole queue every minute); a card
 *  whose message is gone is posted again; only an unreachable Discord waits the minute out. A card drawn before a
 *  press or a report changed its case is drawn again (DISCORD-8). */
async function postCards(ctx, env, fetchFn) {
  const due = (await ctx.db.prepare(`SELECT id, discord_msg, updated_at, status FROM mod_cases
      WHERE (discord_state = 'due' OR (discord_state = 'off' AND status = 'open'))
        AND (status != 'open' OR ai_state NOT IN ('due', 'reading') OR opened_at < ?1)
      ORDER BY credible DESC, reports DESC, updated_at LIMIT ?2`).bind(ctx.nowS - REVIEW_WAIT_S, POSTS_MAX).all())?.results ?? [];
  let n = 0;
  for (const c of due) {
    const card = await cardOf(ctx.db, c.id, ctx.nowS);
    if (!card) continue;
    const sent = await sendCard(env, fetchFn, card, c.discord_msg ?? null, { nonce: c.id });
    if ('down' in sent) break;
    if ('gone' in sent) { await ctx.db.prepare('UPDATE mod_cases SET discord_msg = NULL WHERE id = ?1').bind(c.id).run(); continue; }
    if ('refused' in sent) { await ctx.db.prepare("UPDATE mod_cases SET discord_state = 'failed' WHERE id = ?1").bind(c.id).run(); continue; }
    await ctx.db.prepare("UPDATE mod_cases SET discord_msg = ?2, discord_state = CASE WHEN updated_at = ?3 AND status = ?4 THEN 'posted' ELSE 'due' END WHERE id = ?1")
      .bind(c.id, sent.id, c.updated_at, c.status).run();
    n++;
  }
  return n;
}

/**
 * THE MINUTE'S WORK. Answers how much it moved.
 * @param {{ db: any, nowS: number, rand: (b: Uint8Array) => void, budget?: () => boolean }} ctx @param {any} env
 * @param {{ fetchFn?: (url: string, init: any) => Promise<Response> }} [io]
 */
export async function safetyMinute(ctx, env, { fetchFn = (u, i) => globalThis.fetch(u, i) } = {}) {
  let n = 0;
  if (modAiOn(env)) n += (await triageCases(ctx, env, fetchFn)) + (await readFeed(ctx, env, fetchFn));
  if (discordOn(env)) n += await postCards(ctx, env, fetchFn);
  return n;
}

/** THE HOUR'S SWEEP, each statement a page asked again while full and the budget holds. Answers the rows it changed.
 *  @param {{ db: any, nowS: number, budget?: () => boolean }} ctx */
export async function safetySweep(ctx) {
  const { db, nowS } = ctx;
  const paged = async (sql, ...args) => {
    let n = 0;
    for (let i = 0; i < SAFETY_SWEEP_ROUNDS; i++) {
      const got = Number((await db.prepare(sql).bind(...args, SAFETY_SWEEP_ROWS).run())?.meta?.changes ?? 0);
      n += got;
      if (got < SAFETY_SWEEP_ROWS || !more(ctx)) break;
    }
    return n;
  };
  let n = 0;
  n += await paged('DELETE FROM mod_feed WHERE id IN (SELECT id FROM mod_feed WHERE at < ?1 LIMIT ?2)', nowS - FEED_KEEP_S);
  n += await paged(`UPDATE mod_cases SET status = 'dismissed', resolved_by = 'the clock', resolved_at = ?1, resolution = 'expired', updated_at = ?1, claimed_at = NULL,
      ai_state = CASE WHEN ai_state IN ('due', 'reading') THEN 'off' ELSE ai_state END,
      discord_state = CASE WHEN discord_msg IS NULL THEN 'off' ELSE 'due' END
    WHERE id IN (SELECT id FROM mod_cases WHERE status = 'open' AND opened_at < ?2 LIMIT ?3)`, nowS, nowS - CASE_OPEN_MAX_S);
  n += await paged(`UPDATE mod_cases SET lines_kept = 0, ai_reason = NULL, discord_state = CASE WHEN discord_msg IS NULL THEN discord_state ELSE 'due' END
    WHERE id IN (SELECT id FROM mod_cases WHERE lines_kept = 1 AND resolved_at IS NOT NULL AND resolved_at < ?1 AND status != 'open' LIMIT ?2)`, nowS - RESOLVED_LINES_KEEP_S);
  n += await paged(`DELETE FROM mod_case_lines WHERE rowid IN (SELECT l.rowid FROM mod_case_lines l JOIN mod_cases c ON c.id = l.case_id
    WHERE c.lines_kept = 0 LIMIT ?1)`);
  n += await paged(`UPDATE mod_reports SET note = NULL WHERE rowid IN (SELECT r.rowid FROM mod_reports r JOIN mod_cases c ON c.id = r.case_id
    WHERE c.lines_kept = 0 AND r.note IS NOT NULL LIMIT ?1)`);
  n += await paged('DELETE FROM mod_ai_days WHERE day IN (SELECT day FROM mod_ai_days WHERE day < ?1 LIMIT ?2)', new Date((nowS - AI_DAYS_KEEP * 86400) * 1000).toISOString().slice(0, 10));
  return n;
}
