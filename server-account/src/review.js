// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT6 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE REVIEW - what staff read and do about
// the judge's verdicts. Realm-Arc section 4: "the character is flagged for review"; phase 3: "a review tool". A
// developer's alone (titles.js isDeveloper - the developers' list, as the customs pass is), each act written into the
// character's findings with who did it, and said by tools/realmReview.mjs:
//
//   /v1/mod/realm-holds      the characters held or flagged, with their last finding
//   /v1/mod/realm-findings   one character's findings and its wealth by the hour
//   /v1/mod/realm-clear      lift a hold (its strikes with it), clear a flag - and the law's finding standing is EXCUSED
//                            (`law_excused`: staff judged it wrong, and the same signature holds nothing again; a new
//                            one does), the budget's bucket full again
//   /v1/mod/realm-hold       hold a character's trade by hand ('staff')
//   /v1/mod/realm-rollback   the character back to its last checkpoint judged clean (kept by checkpointRealm), its seat
//                            taken from any tab (the lease cleared - the next join loads the clean save). Never past a
//                            move the service made since (`svc_seq` - a sale's piece would come back), nor for the dead
//
// Every act moves the row's `judge_rev`: a checkpoint judging the row as it stood before the act writes no verdict over it.
//   /v1/mod/realm-budget     the measure (gain an hour of play, by level band) and the budget's config; `set` writes it
//   /v1/mod/realm-bodies     INT14: the boss fights' count - each fight's receipts, the mends claimed a minute, and what the
//                            line standing would have cost (bodiesMeasure)
//
// THE MEASURE (Mac: "Measure 7 days, then enforce"). realm_wealth_hours keeps each character's hour - the gain no witness
// explained and the seconds it played. The report reads every hour with play enough to say something (MEASURE_PLAYED_MIN),
// as gold an hour of play, and answers each band's quantiles - the line a budget is set from - beside the `measure`
// findings: who would have been held at the line standing.
// ═══════════════════════════════════════════════════════════════════

import { isDeveloper } from './titles.js';
import { REALM_ID_RE, realmSaveTextOf, dropObjects } from './realm.js';
import { budgetConfig, budgetConfigOf, forgetBudgetConfig, BUDGET_DEFAULT } from './budget.js';
import { wealthOf } from './judge.js';

/** How long the judge's findings are kept (the hourly sweep, cron.js). */
export const REALM_FINDINGS_KEEP_S = 90 * 24 * 3600;
/** How long the wealth's hours are kept - the window the budget's line is set from, and more. */
export const REALM_WEALTH_KEEP_S = 30 * 24 * 3600;
/** An hour that played less than this says too little of a rate to count in the measure. */
export const MEASURE_PLAYED_MIN = 600;
/** How many held or flagged characters one read lists. */
export const HOLDS_LIST_MAX = 200;
/** A note staff leave on an act, cut to this. */
export const NOTE_MAX = 300;
/** The quantiles the measure answers. */
export const MEASURE_QUANTILES = Object.freeze([0.5, 0.9, 0.99, 0.999]);

const noteOf = (/** @type {unknown} */ v) => (typeof v === 'string' ? v.slice(0, NOTE_MAX) : null);
const parse = (/** @type {string} */ t) => { try { return JSON.parse(t); } catch { return null; } };

/** A staff act's own finding: who, what, the note - kept with the judge's. */
const staffFinding = (/** @type {any} */ db, /** @type {any} */ row, /** @type {number} */ nowS, /** @type {any} */ detail) => db.prepare(
  "INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, ?, ?, 0, 'staff', ?)",
).bind(row.player, row.id, row.seq, nowS, JSON.stringify(detail));

/** A character's row, by its id - or null. */
const rowOf = (/** @type {any} */ db, /** @type {unknown} */ id) => (typeof id === 'string' && REALM_ID_RE.test(id)
  ? db.prepare('SELECT * FROM realm_characters WHERE id = ?').bind(id).first() : Promise.resolve(null));

/**
 * ONE REVIEW ACT, by its route's name - `{ error }` 'not-developer' (403), 'body' (400), 'no-realm-character' (404),
 * 'no-clean' (409: no clean checkpoint kept to roll back to), 'service-moved' (409: the service moved the record since
 * it), 'dead' (409), or the act's answer.
 * @param {any} ctx @param {any} player @param {any} env @param {string} act @param {any} body
 */
export async function reviewAct({ db, bucket, nowS }, player, env, act, body = {}) {
  if (!isDeveloper(player, env)) return { error: 'not-developer' };
  const by = player.handle;
  if (act === 'holds') {
    const { results = [] } = await db.prepare(
      `SELECT c.id, c.name, c.player, p.handle, c.held, c.held_at, c.strikes, c.review, c.wealth, c.seq, c.clean_seq,
         (SELECT kind || ':' || detail FROM realm_findings f WHERE f.char_id = c.id ORDER BY f.id DESC LIMIT 1) AS last
       FROM realm_characters c LEFT JOIN players p ON p.id = c.player
       WHERE c.held IS NOT NULL OR c.review IS NOT NULL ORDER BY c.held_at DESC LIMIT ?`,
    ).bind(HOLDS_LIST_MAX).all();
    return { characters: results };
  }
  if (act === 'budget') {
    if (body.set !== undefined) {
      const config = budgetConfigOf(body.set);
      if (!config) return { error: 'body' };
      await db.prepare("INSERT INTO realm_config (key, value, at, by) VALUES ('budget', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, at = excluded.at, by = excluded.by")
        .bind(JSON.stringify(config), nowS, by).run();
      forgetBudgetConfig(db);
    }
    return measure(db, nowS, Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= 30 ? body.days : 7);
  }
  if (act === 'bodies') return bodiesMeasure(db, nowS, Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= 30 ? body.days : 7);
  const row = await rowOf(db, body.id);
  if (!row) return typeof body.id === 'string' ? { error: 'no-realm-character' } : { error: 'body' };
  const note = noteOf(body.note);
  if (act === 'findings') {
    const f = await db.prepare('SELECT seq, at, law, kind, detail FROM realm_findings WHERE char_id = ? ORDER BY id DESC LIMIT 100').bind(row.id).all();
    const h = await db.prepare('SELECT hour, level, gain, loss, played_s, checkpoints FROM realm_wealth_hours WHERE char_id = ? ORDER BY hour DESC LIMIT 336').bind(row.id).all();
    return {
      character: { id: row.id, name: row.name, held: row.held, strikes: row.strikes, review: row.review, wealth: row.wealth, allowance: row.allowance, seq: row.seq, clean_seq: row.clean_seq },
      findings: (f.results ?? []).map((/** @type {any} */ r) => ({ ...r, detail: parse(r.detail) })),
      hours: h.results ?? [],
    };
  }
  if (act === 'clear') {
    // the hold lifted, the flag cleared, the law's standing finding excused (judged by a person and found wrong - the
    // same signature holds nothing again, a new one does), the bucket full again (null: the next judgement fills it)
    await db.batch([
      db.prepare('UPDATE realm_characters SET held = NULL, held_at = NULL, strikes = 0, review = NULL, law_excused = law_sig, allowance = NULL, judge_rev = judge_rev + 1 WHERE id = ?').bind(row.id),
      staffFinding(db, row, nowS, { act: 'clear', by, note, was: row.held, review: row.review, excused: row.law_sig ?? null }),
    ]);
    return { ok: true };
  }
  if (act === 'hold') {
    await db.batch([
      db.prepare("UPDATE realm_characters SET held = 'staff', held_at = ?, judge_rev = judge_rev + 1 WHERE id = ?").bind(nowS, row.id),
      staffFinding(db, row, nowS, { act: 'hold', by, note }),
    ]);
    return { ok: true };
  }
  if (act === 'rollback') {
    if (row.dead_at != null) return { error: 'dead' };
    if (!row.clean_obj || !bucket) return { error: 'no-clean' };
    // never past a move the service made: a sale's piece, a vault's, a trade's would come back while it stands elsewhere
    if (row.svc_seq != null && row.svc_seq > (row.clean_seq ?? 0)) return { error: 'service-moved' };
    const object = await bucket.get(row.clean_obj);
    const text = await realmSaveTextOf(object);
    const save = parse(text ?? '');
    if (!save) return { error: 'no-clean' };
    // the clean save becomes the record, one sequence on, its seat taken from any tab - and the hold lifted with what made it
    const moved = await db.prepare(
      'UPDATE realm_characters SET seq = seq + 1, obj = clean_obj, prev = obj, bytes = ?, lease = NULL, judged_seq = seq + 1, clean_seq = seq + 1, held = NULL, held_at = NULL,'
      + ' strikes = 0, law_sig = NULL, wealth = ?, witnessed = 0, judge_rev = judge_rev + 1, updated_at = ? WHERE id = ? AND clean_obj = ? AND seq = ? AND dead_at IS NULL',
    ).bind(new TextEncoder().encode(text ?? '').byteLength, wealthOf(save), nowS, row.id, row.clean_obj, row.seq).run();
    if (!moved.meta.changes) return { error: 'no-clean' };
    await staffFinding(db, row, nowS, { act: 'rollback', by, note, from: row.seq, to: row.clean_seq }).run();
    await dropObjects(bucket, [row.prev === row.clean_obj ? null : row.prev]);   // the save before the one rolled away: nothing names it now
    return { ok: true, seq: row.seq + 1 };
  }
  return { error: 'body' };
}

/** AUDIT INT14: THE RANKS OF `n` ROWS - each of MEASURE_QUANTILES and the most, every one read by its rank in order (`at`,
 *  one row a rank, asked of the database). The wealth's measure and the boss fights' read their rates by it alike (the
 *  second had copied the first's loop, rank rounding and all). @param {number} n @param {(rank: number) => Promise<any>} at */
async function ranked(n, at) {
  const quantiles = [];
  for (const q of MEASURE_QUANTILES) quantiles.push([q, n ? await at(Math.min(n - 1, Math.ceil(q * n) - 1)) : null]);
  return { quantiles, most: n ? await at(n - 1) : null };
}

/**
 * THE MEASURE over the last `days`: every character-hour that played MEASURE_PLAYED_MIN or more, as gold an hour of play,
 * by the budget's own bands - each band's count, quantiles and most - and the `measure` findings in the window by band
 * (who the line standing would have held), with the config standing.
 * @param {any} db @param {number} nowS @param {number} days
 */
export async function measure(db, nowS, days) {
  const config = await budgetConfig(db);
  const since = nowS - days * 24 * 3600;
  // asked by the database, a band at a time - each quantile one row of the band's rates in order (AUDIT INT: every hour of
  // thirty days was read into the Worker)
  const rate = 'CAST(ROUND(gain * 3600.0 / played_s) AS INTEGER)';
  const where = 'hour >= ?1 AND played_s >= ?2 AND level > ?3 AND level <= ?4';
  const bands = [];
  let lo = 0;
  for (const b of config.bands) {
    const n = Number((await db.prepare(`SELECT COUNT(*) AS n FROM realm_wealth_hours WHERE ${where}`).bind(since, MEASURE_PLAYED_MIN, lo, b.upTo).first())?.n ?? 0);
    const at = async (/** @type {number} */ rank) => (await db.prepare(`SELECT ${rate} AS r FROM realm_wealth_hours WHERE ${where} ORDER BY r LIMIT 1 OFFSET ?5`)
      .bind(since, MEASURE_PLAYED_MIN, lo, b.upTo, rank).first())?.r ?? null;
    const { quantiles, most } = await ranked(n, at);
    const overs = Number((await db.prepare("SELECT COUNT(*) AS n FROM realm_findings WHERE at >= ?1 AND kind IN ('measure', 'budget') AND json_extract(detail, '$.level') > ?2 AND json_extract(detail, '$.level') <= ?3")
      .bind(since, lo, b.upTo).first())?.n ?? 0);
    bands.push({ from: lo + 1, upTo: b.upTo, rate: b.rate, cap: b.cap, hours: n, quantiles, most, overs });
    lo = b.upTo;
  }
  return { days, config, isDefault: config === BUDGET_DEFAULT, bands };
}

/** INT14: the fights whose receipts carry the relay's count, by the table their claims keep it in. */
export const BODY_TABLES = Object.freeze([['gate', 'gate_kills'], ['sd', 'sd_kills'], ['serpent', 'serpent_kills']]);
/** A measure's own seconds stood under this are read as this many (a short stand says too little of a rate). */
export const BODY_MEASURE_S_MIN = 60;

/**
 * INT14 - THE BOSS FIGHTS' MEASURE over the last `days` (Mac, 2026-10-10: "Measure, then enforce"): for each fight, the
 * receipts that carried the relay's count (net/bossBody.js bodyMeasure, kept as each kill row's `body`), the mends
 * each claimed a minute it stood (believed and past the line together, thousandths of a whole - the rate the line is
 * set from) by quantile and at most, how many claimed past the line standing, how many the count felled, and how many
 * receipts it would have cost had a fall by it been a fall (`lost`). The line itself is the relay's (its BOSS_BODY var).
 * @param {any} db @param {number} nowS @param {number} days
 */
export async function bodiesMeasure(db, nowS, days) {
  const since = nowS - days * 24 * 3600;
  const rate = `CAST(ROUND((json_extract(body, '$[1]') + json_extract(body, '$[2]')) * 60.0 / MAX(json_extract(body, '$[5]'), ${BODY_MEASURE_S_MIN})) AS INTEGER)`;
  const fights = [];
  for (const [fight, table] of BODY_TABLES) {
    const where = 'at >= ?1 AND body IS NOT NULL';
    const count = async (/** @type {string} */ more) => Number((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}${more}`).bind(since).first())?.n ?? 0);
    const n = await count('');
    const at = async (/** @type {number} */ rank) => (await db.prepare(`SELECT ${rate} AS r FROM ${table} WHERE ${where} ORDER BY r LIMIT 1 OFFSET ?2`).bind(since, rank).first())?.r ?? null;
    const { quantiles, most } = await ranked(n, at);
    fights.push({
      fight, receipts: n, quantiles, most,
      over: await count(" AND json_extract(body, '$[2]') > 0"),
      fell: await count(" AND json_extract(body, '$[3]') > 0"),
      lost: await count(" AND json_extract(body, '$[4]') = 0"),
    });
  }
  return { days, fights };
}
