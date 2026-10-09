// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT6 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE REVIEW - what staff read and do about
// the judge's verdicts. Realm-Arc section 4: "the character is flagged for review"; phase 3: "a review tool". A
// developer's alone (titles.js isDeveloper - the developers' list, as the customs pass is), each act written into the
// character's findings with who did it, and said by tools/realmReview.mjs:
//
//   /v1/mod/realm-holds      the characters held or flagged, with their last finding
//   /v1/mod/realm-findings   one character's findings and its wealth by the hour
//   /v1/mod/realm-clear      lift a hold (its strikes with it), clear a flag
//   /v1/mod/realm-hold       hold a character's trade by hand ('staff')
//   /v1/mod/realm-rollback   the character back to its last checkpoint judged clean (kept by checkpointRealm), its seat
//                            taken from any tab (the lease cleared - the next join loads the clean save)
//   /v1/mod/realm-budget     the measure (gain an hour of play, by level band) and the budget's config; `set` writes it
//
// THE MEASURE (Mac: "Measure 7 days, then enforce"). realm_wealth_hours keeps each character's hour - the gain no witness
// explained and the seconds it played. The report reads every hour with play enough to say something (MEASURE_PLAYED_MIN),
// as gold an hour of play, and answers each band's quantiles - the line a budget is set from - beside the `measure`
// findings: who would have been held at the line standing.
// ═══════════════════════════════════════════════════════════════════

import { isDeveloper } from './titles.js';
import { REALM_ID_RE, realmSaveTextOf, dropObjects } from './realm.js';
import { budgetConfig, budgetConfigOf, BUDGET_DEFAULT } from './budget.js';
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
 * 'no-clean' (409: no clean checkpoint kept to roll back to), or the act's answer.
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
    }
    return measure(db, nowS, Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= 30 ? body.days : 7);
  }
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
    await db.batch([
      db.prepare('UPDATE realm_characters SET held = NULL, held_at = NULL, strikes = 0, review = NULL WHERE id = ?').bind(row.id),
      staffFinding(db, row, nowS, { act: 'clear', by, note, was: row.held, review: row.review }),
    ]);
    return { ok: true };
  }
  if (act === 'hold') {
    await db.batch([
      db.prepare("UPDATE realm_characters SET held = 'staff', held_at = ? WHERE id = ?").bind(nowS, row.id),
      staffFinding(db, row, nowS, { act: 'hold', by, note }),
    ]);
    return { ok: true };
  }
  if (act === 'rollback') {
    if (!row.clean_obj || !bucket) return { error: 'no-clean' };
    const object = await bucket.get(row.clean_obj);
    const save = parse(await realmSaveTextOf(object) ?? '');
    if (!save) return { error: 'no-clean' };
    // the clean save becomes the record, one sequence on, its seat taken from any tab - and the hold lifted with what made it
    const moved = await db.prepare(
      'UPDATE realm_characters SET seq = seq + 1, obj = clean_obj, prev = obj, lease = NULL, judged_seq = seq + 1, held = NULL, held_at = NULL, strikes = 0,'
      + ' wealth = ?, witnessed = 0, updated_at = ? WHERE id = ? AND clean_obj = ? AND seq = ?',
    ).bind(wealthOf(save), nowS, row.id, row.clean_obj, row.seq).run();
    if (!moved.meta.changes) return { error: 'no-clean' };
    await staffFinding(db, row, nowS, { act: 'rollback', by, note, from: row.seq, to: row.clean_seq }).run();
    await dropObjects(bucket, [row.prev === row.clean_obj ? null : row.prev]);   // the save before the one rolled away: nothing names it now
    return { ok: true, seq: row.seq + 1 };
  }
  return { error: 'body' };
}

/** The value at quantile `q` of a sorted list (the nearest rank). */
const quantile = (/** @type {number[]} */ sorted, /** @type {number} */ q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] : null);

/**
 * THE MEASURE over the last `days`: every character-hour that played MEASURE_PLAYED_MIN or more, as gold an hour of play,
 * by the budget's own bands - each band's count, quantiles and most - and the `measure` findings in the window by band
 * (who the line standing would have held), with the config standing.
 * @param {any} db @param {number} nowS @param {number} days
 */
export async function measure(db, nowS, days) {
  const config = await budgetConfig(db);
  const since = nowS - days * 24 * 3600;
  const { results = [] } = await db.prepare('SELECT level, gain, played_s FROM realm_wealth_hours WHERE hour >= ? AND played_s >= ?').bind(since, MEASURE_PLAYED_MIN).all();
  const would = await db.prepare("SELECT detail FROM realm_findings WHERE at >= ? AND kind IN ('measure', 'budget')").bind(since).all();
  let lo = 0;
  const bands = config.bands.map((/** @type {any} */ b) => {
    const rates = results.filter((/** @type {any} */ r) => r.level > lo && r.level <= b.upTo).map((/** @type {any} */ r) => Math.round((r.gain * 3600) / r.played_s)).sort((x, y) => x - y);
    const over = (would.results ?? []).map((/** @type {any} */ r) => parse(r.detail)).filter((d) => d && d.level > lo && d.level <= b.upTo).length;
    const out = { from: lo + 1, upTo: b.upTo, rate: b.rate, cap: b.cap, hours: rates.length, quantiles: MEASURE_QUANTILES.map((q) => [q, quantile(rates, q)]), most: rates.length ? rates[rates.length - 1] : null, overs: over };
    lo = b.upTo;
    return out;
  });
  return { days, config, isDefault: config === BUDGET_DEFAULT, bands };
}
