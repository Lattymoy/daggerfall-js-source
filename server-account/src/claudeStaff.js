// @ts-check
// CLAUDE (STAFF): reads what the service already stored about players and writes SUGGESTIONS for staff to accept or
// dismiss. It never acts: a suggestion names one existing staff act, and a member decides (staffClaude.js). It has no
// session and no key: it runs on the minute clock like the reviewer (modAi.js) and writes as CLAUDE_STAFF_HANDLE, which
// can never sign in to the panel. Off (CLAUDE_STAFF, no ANTHROPIC_API_KEY, no CLAUDE_STAFF_PROMPT) it calls nothing.
// Players' words reach the model as escaped JSON with speakers as labels. Calls are capped by CLAUDE_STAFF_DAILY_MAX a
// UTC day (mod_ai_days, key '<day>:claude'). The sweep runs every SWEEP_S, or every QUIET_SWEEP_S with fewer than
// CLAUDE_STAFF_QUIET_MIN players online, covering everything since the last run.
import { messagesCall, dayOf, AI_ERRORS, AI_WAITS, linesMessage } from './modAi.js';
import { sendCard } from './discord.js';
import { claimHeldSql } from './safety.js';
import { NET_REFUSED_HIGH } from './staffNet.js';
import { monstersRanked } from './staffMonsters.js';
import { reactionSummary, REACT_PATTERN } from './staffReactions.js';
import { handleList } from './titles.js';
import { PLAY_GRACE_S } from '../../src/net/playClock.js';

export const CLAUDE_KINDS = Object.freeze(['report', 'bot-ring', 'net', 'monster', 'dupe', 'gains', 'hold', 'reactions']);
/** The acts a suggestion may name, each an existing staff door; the panel runs it, never this module. */
export const CLAUDE_ACTS = Object.freeze({
  mute: '/v1/staff/mute',
  hold: '/v1/staff/trade-hold',
  watch: '/v1/staff/watch/add',
});
export const CLAUDE_SWITCH_DEFAULT = 'off';
export const CLAUDE_MODEL_DEFAULT = 'claude-sonnet-5-5';
export const CLAUDE_DAILY_DEFAULT = 200;
export const CLAUDE_QUIET_MIN_DEFAULT = 50;
/** The sweep's gap, s, and its gap when few are online. */
export const SWEEP_S = 15 * 60;
export const QUIET_SWEEP_S = 2 * 3600;
/** Rows kept 30 days, like the staff audit log. */
export const CLAUDE_KEEP_S = 30 * 24 * 3600;
export const CLAUDE_MAX_TOKENS = 4096;
/** The most items one call carries, and lines of a case it reads. */
export const ITEMS_MAX = 40;
export const CASE_LINES_MAX = 20;
export const SUMMARY_MAX = 400;
/** A mute Claude may suggest, minutes: its first rung (sanctions.js) up to a day. */
export const MUTE_MIN = 5;
export const MUTE_MAX = 1440;
/** The bot check's mean time from an ask to the first swing, ms, under which no hand did it (a starting number to tune). */
export const REACT_FAST_MS = 200;

/** Whether Claude runs: switched "on" AND holding the reviewer's key and its own brief. @param {any} env */
export const claudeOn = (env) =>
  env?.CLAUDE_STAFF === 'on' && typeof env?.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.length > 0 && claudePrompt(env).length > 0;
/** The staff account it writes as. @param {any} env */
export const claudeHandle = (env) => (typeof env?.CLAUDE_STAFF_HANDLE === 'string' && env.CLAUDE_STAFF_HANDLE.trim() ? env.CLAUDE_STAFF_HANDLE.trim() : 'Claude');
const whole = (/** @type {any} */ raw, /** @type {number} */ dflt) => {
  if (raw === undefined || raw === null || String(raw).trim() === '') return dflt;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : dflt;
};
/** @param {any} env */
export const claudeDailyMax = (env) => whole(env?.CLAUDE_STAFF_DAILY_MAX, CLAUDE_DAILY_DEFAULT);
/** @param {any} env */
export const claudeQuietMin = (env) => whole(env?.CLAUDE_STAFF_QUIET_MIN, CLAUDE_QUIET_MIN_DEFAULT);
/** Whether a handle is one the order list names (members who decide suggestions). @param {any} env @param {any} player */
export const isClaudeOrder = (env, player) => typeof player?.handle === 'string' && handleList(env?.CLAUDE_ORDER_HANDLES).has(player.handle.toLowerCase());

// ── THE BOT-RING QUERY: no model needed to find a candidate. All three signals, or none. ──
/** How far back trades and harvests are read, s. */
export const RING_WINDOW_S = 7 * 86400;
/** A giver whose trade brought back at most this much gold and no goods gave it free. */
export const RING_BACK_GOLD = 50;
/** Free trades one giver must have made to one receiver, and givers a receiver needs: one gift is a friend's, one giver a guild's. */
export const RING_FREE_MIN = 3;
export const RING_FEEDERS_MIN = 2;
/** A giver played this many of the window's 168 hours: nobody plays 21 hours a day. */
export const RING_AROUND_HOURS = 150;
/** Gaps between a giver's harvests: at least this many, and the spread (stdev over mean) under this: a loop, not a hand. */
export const RING_GAPS_MIN = 20;
export const RING_GAP_CV = 0.1;
/** The same four-hour block, starting in the UTC small hours, on this many days, with this share of the hours in it.
 *  shortcut: the service keeps no timezone per account, so a night owl in the block counts; the other two signals must agree. */
export const RING_NIGHT_DAYS = 5;
export const RING_NIGHT_SHARE = 0.9;
export const RING_NIGHT_BLOCK_H = 4;
export const RING_NIGHT_START_MAX = 5;
/** A receiver that has claimed more than this from raids, bounties and camps in the window does more than collect. */
export const RING_ELSE_MAX = 5;
/** Receivers read and givers read for each, so one busy week is never a table scan. */
export const RING_RECEIVERS_MAX = 10;
export const RING_FEEDERS_READ = 8;

/**
 * WHICH SCRIPTED SIGNS A GIVER SHOWS. `hours` the epoch-second starts of the hours it played in the window, `ats` the
 * seconds of its harvests. Pure. @param {number[]} hours @param {number[]} ats
 * @returns {string[]} 'round-the-clock', 'even-gaps' and 'nightly'
 */
export function scriptedSigns(hours, ats) {
  /** @type {string[]} */
  const out = [];
  const set = [...new Set(hours)];
  if (set.length >= RING_AROUND_HOURS) out.push('round-the-clock');
  const sorted = [...ats].sort((a, b) => a - b);
  if (sorted.length > RING_GAPS_MIN) {
    const gaps = sorted.slice(1).map((stamp, i) => stamp - sorted[i]);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const spread = Math.sqrt(gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length);
    if (mean > 0 && spread / mean <= RING_GAP_CV) out.push('even-gaps');
  }
  const days = new Set(set.map((hour) => Math.floor(hour / 86400)));
  if (set.length && days.size >= RING_NIGHT_DAYS)
    for (let b = 0; b <= RING_NIGHT_START_MAX; b++) {
      const inBlock = set.filter((hour) => ((hour % 86400) / 3600 - b + 24) % 24 < RING_NIGHT_BLOCK_H).length;
      if (inBlock / set.length >= RING_NIGHT_SHARE) {
        out.push('nightly');
        break;
      }
    }
  return out;
}

/** What one side of a finished trade received, from its stored result. @param {any} side */
const gotOf = (side) => ({ items: Array.isArray(side?.items) ? side.items.length : 0, gold: Number(side?.gold) || 0 });

/**
 * THE BOT RINGS: a receiver that got goods through free one-way trades from RING_FEEDERS_MIN or more givers, each of whom
 * played a scripted pattern, and that claimed little else. Free trades alone are normal and flag nothing.
 * @param {any} db @param {number} nowS
 * @returns {Promise<{ receiver: string, facts: any }[]>}
 */
export async function botRings(db, nowS) {
  const since = nowS - RING_WINDOW_S;
  const trades = (await db.prepare("SELECT a_player, b_player, result FROM realm_trades WHERE state = 'done' AND created_at > ?1 LIMIT 5000").bind(since).all())?.results ?? [];
  /** @type {Map<string, Map<string, number>>} receiver -> giver -> free trades */
  const free = new Map();
  for (const trade of trades) {
    let result = null;
    try { result = JSON.parse(trade.result); } catch { continue; }
    const a = gotOf(result?.a), b = gotOf(result?.b);
    const one = (/** @type {string} */ to, /** @type {string} */ from, /** @type {{items: number, gold: number}} */ got, /** @type {{items: number, gold: number}} */ back) => {
      if (!to || !from || to === from || got.items + got.gold === 0 || back.items > 0 || back.gold > RING_BACK_GOLD) return;
      const givers = free.get(to) ?? new Map();
      givers.set(from, (givers.get(from) ?? 0) + 1);
      free.set(to, givers);
    };
    one(trade.a_player, trade.b_player, a, b);
    one(trade.b_player, trade.a_player, b, a);
  }
  const rings = [];
  const receivers = [...free].map(([to, givers]) => [to, [...givers].filter(([, n]) => n >= RING_FREE_MIN)]).filter(([, givers]) => givers.length >= RING_FEEDERS_MIN);
  for (const [receiver, givers] of receivers.slice(0, RING_RECEIVERS_MAX)) {
    const feeders = [];
    for (const [id, trades] of givers.slice(0, RING_FEEDERS_READ)) {
      const [hourRows, a] = await Promise.all([
        db.prepare('SELECT DISTINCT hour FROM progress_hours WHERE player = ?1 AND hour > ?2 AND (claims > 0 OR played_s > 0)').bind(id, since).all(),
        db.prepare('SELECT at FROM node_harvests WHERE player = ?1 AND at > ?2 ORDER BY at LIMIT 500').bind(id, since).all(),
      ]);
      const hours = (hourRows?.results ?? []).map((/** @type {any} */ row) => row.hour);
      const signs = scriptedSigns(hours, (a?.results ?? []).map((/** @type {any} */ row) => row.at));
      if (signs.length) feeders.push({ id, freeTrades: trades, hoursPlayed: new Set(hours).size, signs });
    }
    if (feeders.length < RING_FEEDERS_MIN) continue;
    const elseRow = await db.prepare("SELECT COALESCE(SUM(claims), 0) AS n FROM progress_hours WHERE player = ?1 AND hour > ?2 AND stream IN ('raid', 'bounty', 'camp')").bind(receiver, since).first();
    if (Number(elseRow?.n) > RING_ELSE_MAX) continue;
    rings.push({ receiver, facts: { windowDays: RING_WINDOW_S / 86400, feeders, receiverFightClaims: Number(elseRow?.n) || 0 } });
  }
  return rings;
}

/** @typedef {{ kind: string, subject: string, caseId?: string|null, facts: any, lines?: { sub: string, at: number, tab: string, name: string, text: string }[] }} Item */

/** @param {any} db @param {() => Promise<any>} f @param {string} what */
const safely = async (db, read, what) => {
  try {
    return (await read()) ?? [];
  } catch (e) {
    console.warn(`[claude] ${what}`, /** @type {any} */ (e)?.message ?? e);
    return [];
  }
};

/**
 * WHAT IS NEW since `since`, from the feeds the service stores - Claude invents no check where a stored result exists.
 * @param {any} db @param {number} since @param {number} nowS @returns {Promise<Item[]>}
 */
export async function gather(db, since, nowS) {
  const rows = async (/** @type {string} */ sql, /** @type {any[]} */ ...args) => (await db.prepare(sql).bind(...args).all())?.results ?? [];
  const [reports, net, monsters, reactions, dupes, gains, holds, rings] = await Promise.all([
    safely(db, async () => {
      const cases = await rows("SELECT id, target, reports, credible, ai_category, ai_severity, ai_confidence, ai_reason, ai_mode FROM mod_cases WHERE source = 'report' AND status = 'open' AND ai_state != 'due' AND ai_state != 'reading' AND updated_at > ?1 ORDER BY credible DESC, updated_at DESC LIMIT 10", since);
      return Promise.all(cases.map(async (/** @type {any} */ report) => ({
        kind: 'report', subject: report.target, caseId: report.id,
        facts: { reports: report.reports, credible: report.credible, reviewerShadow: report.ai_category ? { category: report.ai_category, severity: report.ai_severity, confidence: report.ai_confidence, reason: report.ai_reason, mode: report.ai_mode } : null },
        lines: (await rows('SELECT sub, at, tab, name, text FROM mod_case_lines WHERE case_id = ?1 ORDER BY at DESC LIMIT ?2', report.id, CASE_LINES_MAX)).reverse(),
      })));
    }, 'reports'),
    safely(db, async () => (await rows('SELECT sub, SUM(closes) AS closes, SUM(refused + junk) AS refused, MAX(p10) AS peak10, MAX(p60) AS peak60 FROM staff_net_rows WHERE at > ?1 GROUP BY sub HAVING SUM(closes) > 0 OR SUM(refused + junk) >= ?2 LIMIT 10', since, NET_REFUSED_HIGH))
      .map((/** @type {any} */ row) => ({ kind: 'net', subject: row.sub, facts: { closes: row.closes, refused: row.refused, framesPer10s: row.peak10, framesPerMinute: row.peak60 } })), 'net'),
    safely(db, async () => (await monstersRanked(db, nowS)).ranked.filter((/** @type {any} */ ranked) => ranked.level !== 'low').slice(0, 10)
      .map((/** @type {any} */ ranked) => ({ kind: 'monster', subject: ranked.sub, facts: { level: ranked.level, why: ranked.why } })), 'monster'),
    safely(db, async () => (await rows('SELECT sub, SUM(n) AS n, SUM(members) AS members, SUM(p1) AS p1, SUM(p1_n) AS p1_n, SUM(wd) AS wd, SUM(wd_n) AS wd_n, SUM(ac) AS ac, SUM(ac_n) AS ac_n, SUM(hk) AS hk, SUM(hk_n) AS hk_n, SUM(hu) AS hu, SUM(hu_n) AS hu_n, SUM(dd_n) AS dd_n, SUM(drawn) AS drawn, SUM(struck) AS struck, SUM(mv) AS mv, SUM(tn) AS tn FROM encounter_reactions WHERE at > ?1 GROUP BY sub HAVING SUM(n) >= ?2 LIMIT 100', since, REACT_PATTERN))
      .map((/** @type {any} */ row) => ({ kind: 'reactions', subject: row.sub, facts: reactionSummary(row) }))
      .filter((/** @type {any} */ i) => i.facts.actMs !== null && i.facts.actMs < REACT_FAST_MS).slice(0, 10), 'reactions'),
    safely(db, async () => (await rows('SELECT c.player AS sub, COUNT(*) AS n FROM item_dupes d JOIN realm_characters c ON c.id = d.char_id WHERE d.at > ?1 GROUP BY c.player LIMIT 10', since))
      .map((/** @type {any} */ row) => ({ kind: 'dupe', subject: row.sub, facts: { copiesFound: row.n } })), 'dupes'),
    safely(db, async () => (await rows("SELECT player AS sub, COUNT(*) AS n, MAX(detail) AS detail FROM realm_findings WHERE kind IN ('budget', 'measure') AND at > ?1 GROUP BY player LIMIT 10", since))
      .map((/** @type {any} */ row) => ({ kind: 'gains', subject: row.sub, facts: { findings: row.n, detail: String(row.detail ?? '').slice(0, 400) } })), 'gains'),
    safely(db, async () => (await rows("SELECT player AS sub, COUNT(*) AS n, GROUP_CONCAT(DISTINCT held) AS why FROM realm_characters WHERE held IS NOT NULL AND held != 'staff' AND held_at > ?1 GROUP BY player LIMIT 10", since))
      .map((/** @type {any} */ row) => ({ kind: 'hold', subject: row.sub, facts: { characters: row.n, why: row.why } })), 'holds'),
    safely(db, async () => (await botRings(db, nowS)).map((ring) => ({ kind: 'bot-ring', subject: ring.receiver, facts: ring.facts })), 'bot-ring'),
  ]);
  return [...reports, ...net, ...monsters, ...reactions, ...dupes, ...gains, ...holds, ...rings].slice(0, ITEMS_MAX);
}

/** CLAUDE'S BRIEF: the CLAUDE_STAFF_PROMPT secret, kept out of the public repository. '' without it. @param {any} env */
export const claudePrompt = (env) =>
  typeof env?.CLAUDE_STAFF_PROMPT === 'string' ? env.CLAUDE_STAFF_PROMPT.replace(/\r\n?/g, '\n').trim() : '';

export const SUGGESTION_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'integer' },
          urgent: { type: 'boolean' },
          summary: { type: 'string' },
          act: { type: 'string', enum: ['none', 'mute', 'hold', 'watch'] },
          minutes: { type: 'integer' },
        },
        required: ['item', 'urgent', 'summary', 'act', 'minutes'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
});

/** The items as the model reads them: accounts as P1, P2 in the order met; the lines as speaker, tab and words. @param {Item[]} items */
export function itemsPayload(items) {
  /** @type {Map<string, string>} */
  const label = new Map();
  const tag = (/** @type {string} */ sub) => {
    if (!label.has(sub)) label.set(sub, `P${label.size + 1}`);
    return /** @type {string} */ (label.get(sub));
  };
  return {
    items: items.map((it, i) => ({
      i, kind: it.kind, subject: tag(it.subject), facts: JSON.parse(JSON.stringify(it.facts, (k, value) => (k === 'id' && typeof value === 'string' ? tag(value) : value))),
      ...(it.lines ? { lines: it.lines.map((line) => ({ speaker: tag(line.sub), tab: line.tab, text: line.text })) } : {}),
    })),
  };
}

/** The day's budget row for Claude. @param {number} nowS */
const budgetKey = (nowS) => `${dayOf(nowS)}:claude`;
/** Spend one of the day's calls - false when they are spent. @param {any} db @param {any} env @param {number} nowS */
export async function spendClaudeCall(db, env, nowS) {
  const cap = claudeDailyMax(env);
  if (cap < 1) return false;
  const spent = await db
    .prepare('INSERT INTO mod_ai_days (day, calls) VALUES (?1, 1) ON CONFLICT (day) DO UPDATE SET calls = calls + 1 WHERE calls < ?2 RETURNING calls')
    .bind(budgetKey(nowS), cap)
    .first();
  return !!spent;
}

/** One call: spend, ask, hold the answer to its schema. `{ verdict }` or `{ error }`. @param {any} db @param {any} env @param {any} fetchFn @param {number} nowS @param {{ system: string, payload: any, tag: string, schema: any }} ask */
async function ask(db, env, fetchFn, nowS, { system, payload, tag, schema }) {
  if (!(await spendClaudeCall(db, env, nowS))) return { error: AI_ERRORS.budget };
  const body = linesMessage(payload);
  const message = `<${tag}>${body.slice('<chat_lines>'.length, -'</chat_lines>'.length)}</${tag}>`;
  return messagesCall(db, env, fetchFn, {
    model: typeof env.CLAUDE_STAFF_MODEL === 'string' && env.CLAUDE_STAFF_MODEL ? env.CLAUDE_STAFF_MODEL : CLAUDE_MODEL_DEFAULT,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: message }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
  }, budgetKey(nowS));
}

/** A suggestion's action as stored: one existing staff act and its arguments, or null. @param {Item} item @param {any} s */
export function actionOf(item, said) {
  if (said.act === 'mute' && item.kind === 'report')
    return { act: 'mute', path: CLAUDE_ACTS.mute, args: { target: item.subject, minutes: Math.min(MUTE_MAX, Math.max(MUTE_MIN, Math.trunc(Number(said.minutes)) || 30)), ...(item.caseId ? { case: item.caseId } : {}) } };
  if (said.act === 'hold' || said.act === 'watch') return { act: said.act, path: CLAUDE_ACTS[/** @type {'hold'|'watch'} */ (said.act)], args: { target: item.subject } };
  return null;
}

/** The sweep's suggestions from a verdict: only items it was given, one row each, never an act run. @param {any} db @param {Item[]} items @param {any} verdict @param {number} nowS @returns {Promise<{ kind: string, urgent: boolean }[]>} the rows written */
async function writeSuggestions(db, items, verdict, nowS) {
  const wrote = [];
  const held = await heldBack(db, nowS); // a case claimed, or a freeze laid, while the model read
  for (const said of Array.isArray(verdict?.suggestions) ? verdict.suggestions : []) {
    const item = Number.isSafeInteger(said?.item) ? items[said.item] : null;
    const summary = typeof said?.summary === 'string' ? said.summary.replace(/\s+/g, ' ').trim().slice(0, SUMMARY_MAX) : '';
    if (!item || !summary || held.has(item.subject)) continue;
    const evidence = JSON.stringify({ facts: item.facts, ...(item.lines ? { lines: item.lines.map((line) => ({ at: line.at, tab: line.tab, name: line.name, text: line.text, target: line.sub === item.subject })) } : {}) });
    const action = actionOf(item, said);
    // a subject that is no account row (a stale feed id) fails the foreign key: skipped, never a thrown sweep
    const written = await db
      .prepare('INSERT OR IGNORE INTO claude_suggestions (kind, subject, case_id, urgency, summary, evidence, action, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(item.kind, item.subject, item.caseId ?? null, said.urgent === true ? 'urgent' : 'normal', summary, evidence, action ? JSON.stringify(action) : null, nowS)
      .run()
      .catch(() => null);
    if (written?.meta?.changes) wrote.push({ kind: item.kind, urgent: said.urgent === true });
  }
  return wrote;
}

/** The subjects staff already hold: an open case with a live claim, or an active freeze. Claude writes nothing about them, pings nothing and leaves their cases alone. @param {any} db @param {number} nowS @returns {Promise<Set<string>>} */
export async function heldBack(db, nowS) {
  const [claimed, frozen] = await Promise.all([
    db.prepare(`SELECT target FROM mod_cases WHERE status = 'open' AND ${claimHeldSql('mod_cases', 1)}`).bind(nowS).all(),
    db.prepare('SELECT id FROM players WHERE frozen_until > ?1').bind(nowS).all(),
  ]);
  return new Set([...(claimed?.results ?? []).map((/** @type {any} */ claim) => claim.target), ...(frozen?.results ?? []).map((/** @type {any} */ player) => player.id)]);
}

/** An urgent suggestion's card: the kind and urgency only - no lines, no player text. @param {string} kind */
export const urgentCard = (kind) => ({ content: `New urgent case from Claude (${kind}). See the Staff Panel.`, allowed_mentions: { parse: [] } });

/**
 * THE SWEEP, on the minute clock: nothing while Claude is off; otherwise, once the gap since the last run is up, one batched
 * call over what is new. Answers how many rows it wrote.
 * @param {{ db: any, nowS: number }} ctx @param {any} env @param {{ fetchFn?: (url: string, init: any) => Promise<Response> }} [opt]
 */
export async function claudeSweep(ctx, env, { fetchFn = (url, i) => globalThis.fetch(url, i) } = {}) {
  if (!claudeOn(env)) {
    if (env?.CLAUDE_STAFF === 'on' && env?.ANTHROPIC_API_KEY && !claudePrompt(env))
      console.warn('[claude] switched on with no CLAUDE_STAFF_PROMPT brief - nothing is read');
    return 0;
  }
  const { db, nowS } = ctx;
  const last = (await db.prepare('SELECT last_run FROM claude_state WHERE id = 1').first())?.last_run ?? null;
  const online = Number((await db.prepare('SELECT COUNT(*) AS n FROM players WHERE played_at > ?1').bind(nowS - PLAY_GRACE_S).first())?.n) || 0;
  if (last !== null && nowS - last < (online < claudeQuietMin(env) ? QUIET_SWEEP_S : SWEEP_S)) return 0;
  const held = await heldBack(db, nowS);
  const items = (await gather(db, last ?? nowS - QUIET_SWEEP_S, nowS)).filter((i) => !held.has(i.subject));
  let n = 0;
  let wait = false;
  if (items.length) {
    const answer = await ask(db, env, fetchFn, nowS, { system: claudePrompt(env), tag: 'data', schema: SUGGESTION_SCHEMA, payload: itemsPayload(items) });
    if ('error' in answer) wait = /** @type {readonly string[]} */ (AI_WAITS).includes(answer.error);
    else {
      const wrote = await writeSuggestions(db, items, answer.verdict, nowS);
      n += wrote.length;
      for (const w of wrote.filter((x) => x.urgent)) await sendCard(env, fetchFn, urgentCard(w.kind));
    }
  }
  // a call the API never answered leaves the window for the next minute; one it answered, however badly, is spent
  if (!wait) await db.prepare('INSERT INTO claude_state (id, last_run) VALUES (1, ?1) ON CONFLICT (id) DO UPDATE SET last_run = ?1').bind(nowS).run();
  return n;
}

/** The hourly job: suggestions past their 30 days. @param {{ db: any, nowS: number }} ctx */
export async function claudeKeep({ db, nowS }) {
  const old = nowS - CLAUDE_KEEP_S;
  const results = await db.batch([
    db.prepare('DELETE FROM claude_suggestions WHERE created_at < ?1').bind(old),
  ]);
  return results.reduce((sum, result) => sum + (Number(result?.meta?.changes) || 0), 0);
}
