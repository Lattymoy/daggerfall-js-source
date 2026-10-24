// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT6 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE REVIEW - what staff read and do about
// the judge's verdicts. Realm-Arc section 4: "the character is flagged for review"; phase 3: "a review tool". A
// developer's alone (titles.js isDeveloper - the developers' list, as the customs pass is), each act written into the
// character's findings with who did it, and said by tools/realmReview.mjs:
//
//   /v1/mod/realm-holds      the characters held or flagged, with their last finding (and a law hold's end, when timed -
//                            AUTO-HOLD: no hold waits on this tool to lift; staff's own aside, each lifts on its own)
//   /v1/mod/realm-findings   one character's findings and its wealth by the hour
//   /v1/mod/realm-clear      lift a hold (its strikes and timed holds with it), clear a flag - and the law's finding standing is EXCUSED
//                            (`law_excused`: staff judged it wrong, and the same signature holds nothing again; a new
//                            one does), the budget's bucket full again
//   /v1/mod/realm-hold       hold a character's trade by hand ('staff')
//   /v1/mod/realm-rollback   the character back to its last checkpoint judged clean (kept by checkpointRealm), its seat
//                            taken from any tab (the lease cleared - the next join loads the clean save). Never past a
//                            move the service made since (`svc_seq` - a sale's piece would come back), nor for the dead
//
// Every act moves the row's `judge_rev`: a checkpoint judging the row as it stood before the act writes no verdict over it.
//   /v1/mod/realm-budget     the measure (gain an hour of play, by level band), the service's own faucets' gold over its
//                            window (a patron's purchases - AUDIT LW-II-2 S6) and the budget's config; `set` writes it
//   /v1/mod/realm-bodies     INT14: the boss fights' count - each fight's receipts, the mends claimed a minute, and what the
//                            line standing would have cost (bodiesMeasure)
//   /v1/mod/realm-grants     GRANT2: the spawn grants' asks - per kind, an account's asks an hour (quantiles, most), what
//                            the buckets and the ceiling would have refused, the cells' most live (grants.js grantsMeasure)
//   /v1/mod/realm-progress   INT17: the progression claims' measure - each stream's claims an hour of play, its quantiles
//                            and most, who went past the line standing - and the line's config; `set` writes it
//   /v1/mod/realm-gains      HACKED-GOLD: who gained past the bucket in a window, largest first (gainsMeasure) - while the
//                            budget only measures nothing is held, so `holds` lists none of them
//   /v1/mod/realm-trades     HACKED-GOLD: one character's realm trades, newest first - whom it traded with, and what each
//                            gave (tradesOf): a trade is witnessed on both rows, so no finding names its receiver
//   /v1/mod/realm-characters SUMMON-REPAIR: an account's realm characters by its handle - the id every act above names
//   /v1/mod/realm-repair     SUMMON-REPAIR (FIELD BUGS 2026-10-14 SUMMON-OFFER): one of FactionFile's flag bits cleared on
//                            one faction of the record and gold given back as a letter of credit (net/repairLaw.js), once
//                            a ticket (`realm_repairs`); the record moves one sequence on with its seat taken from any tab
//                            (realm.js seizeRealmRecord - the rollback's way), so the playing tab writes it over never and
//                            its next join plays it. The gold is the service's own faucet (`repair`) and witnessed
//   /v1/mod/realm-mend       PURSE-MEND (FIELD BUGS 2026-10-19f): a purse a wrapped sale left below nothing set to nothing
//                            and what the character is owed given as one letter of credit (net/repairLaw.js), the
//                            repair's way and once a ticket with it - and the law's hold lifted when the purse was all
//                            it held on (`realm-findings` says the purse a mend is reckoned from)
//   `bank`                   STAFF-SET-BANK (2026-10-23, mob: "we need a set bank setting"): a character's bank, still the
//                            total staff read, set to the gold they name (net/repairLaw.js), the repair's way and once a
//                            ticket with it - the Staff Panel's act alone (staffRealm.js /v1/staff/fix/bank), no door here
//
// THE MEASURE (Mac: "Measure 7 days, then enforce"). realm_wealth_hours keeps each character's hour - the gain no witness
// explained and the seconds it played. The report reads every hour with play enough to say something (MEASURE_PLAYED_MIN),
// as gold an hour of play, and answers each band's quantiles - the line a budget is set from - beside the `measure`
// findings: who would have been held at the line standing.
// ═══════════════════════════════════════════════════════════════════

import { isDeveloper } from './titles.js';
import { REALM_ID_RE, REALM_PLAYING_S, realmSaveTextOf, dropObjects, seizeRealmRecord, dropIfUnnamed, mustChange } from './realm.js';
import { budgetConfig, budgetConfigOf, forgetBudgetConfig, BUDGET_DEFAULT, FAUCET_KINDS, faucetStatement } from './budget.js';   // AUDIT LW-II-2 S6: and the service's own faucets; SUMMON-REPAIR: a refund is one
import { repairOf, applyRepair, purseMendOf, applyPurseMend, bankSetOf, applyBankSet } from '../../src/net/repairLaw.js';   // SUMMON-REPAIR: the repair's law, the tool's too; PURSE-MEND: the mend's; STAFF-SET-BANK: the bank set's
import { lawSigOf } from './verdict.js';   // PURSE-MEND: the signature the purse's finding stands under
import { isHandleShaped } from '../../src/net/handleShape.js';   // SUMMON-REPAIR: an account named by its handle
import { wealthOf, goldOf } from './judge.js';   // STAFF-SET-BANK: and a bank's gold as the judge counts it
import { grantsMeasure } from './grants.js';   // GRANT2: the spawn grants' measure (bible/11-Multiplayer/Spawn-Grants.md section 12)
import { progressConfig, progressConfigOf, forgetProgressConfig, PROGRESS_LINE, PROGRESS_STREAMS } from './progress.js';   // INT17: the progression claims' line
import { REALM_LETTER_TEMPLATE } from '../../src/net/realm/realmGoldLaw.js';   // HACKED-GOLD: a trade's letters, at their worth

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
/** HACKED-GOLD: how many characters one read of the gains lists, and how many trades one character's. */
export const GAINS_LIST_MAX = 200;
export const TRADES_LIST_MAX = 200;
/** SUMMON-REPAIR: a repair's row, as its answer says it. */
const repairAnswer = (/** @type {any} */ r, /** @type {boolean} */ repeat) => ({
  ok: true, repeat, ticket: r.ticket, seq: r.seq, faction: r.faction, flag: r.flag, was: r.was, cleared: (r.was & r.flag) !== 0, gold: r.gold, by: r.by_handle, at: r.at,
});
/** PURSE-MEND: a mend's row, as its answer says it - the purse it found, the letter it gave, and the hold its character
 *  stands under now (null: none). */
const mendAnswer = (/** @type {any} */ r, /** @type {boolean} */ repeat) => ({
  ok: true, repeat, ticket: r.ticket, seq: r.seq, was: r.was, gold: r.gold, held: r.held_now ?? null, by: r.by_handle, at: r.at,
});
/** STAFF-SET-BANK: a bank set's row, as its answer says it - the total it found, the bank it set, and the hold its
 *  character stands under now (null: none; a set lifts none). */
const bankAnswer = (/** @type {any} */ r, /** @type {boolean} */ repeat) => ({
  ok: true, repeat, ticket: r.ticket, seq: r.seq, was: r.was, gold: r.gold, held: r.held_now ?? null, by: r.by_handle, at: r.at,
});
/** PURSE-MEND: a `realm_repairs` row is a mend's when it names no faction - a repair's is 1 or more (net/repairLaw.js
 *  repairOf), so the two share the ticket's key and a ticket names one act on a character. STAFF-SET-BANK: and a bank
 *  set's names BANK_SET_FACTION, below every faction a repair or a mend names - no migration: every row written before it
 *  reads as the kind it was. */
export const BANK_SET_FACTION = -1;
const rowKindOf = (/** @type {any} */ r) => (r.faction === 0 ? 'mend' : r.faction === BANK_SET_FACTION ? 'bank' : 'repair');
/** PURSE-MEND: the law finding's signature a purse below nothing stands under alone (verdict.js lawSigOf over the judge's
 *  `gold` - judge.js characterFindings). */
export const PURSE_SIG = lawSigOf([{ code: 'gold' }]);

const noteOf = (/** @type {unknown} */ v) => (typeof v === 'string' ? v.slice(0, NOTE_MAX) : null);
const parse = (/** @type {string} */ t) => { try { return JSON.parse(t); } catch { return null; } };

/** A staff act's own finding: who, what, the note - kept with the judge's. STAFF-PANEL3-REALM: the panel's own acts write
 *  theirs too (staffRealm.js). */
export const staffFinding = (/** @type {any} */ db, /** @type {any} */ row, /** @type {number} */ nowS, /** @type {any} */ detail) => db.prepare(
  "INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, ?, ?, 0, 'staff', ?)",
).bind(row.player, row.id, row.seq, nowS, JSON.stringify(detail));

/** A character's row, by its id - or null. */
const rowOf = (/** @type {any} */ db, /** @type {unknown} */ id) => (typeof id === 'string' && REALM_ID_RE.test(id)
  ? db.prepare('SELECT * FROM realm_characters WHERE id = ?').bind(id).first() : Promise.resolve(null));

/**
 * ONE REVIEW ACT, by its route's name - `{ error }` 'not-developer' (403), 'body' (400), 'no-realm-character' (404),
 * 'no-clean' (409: no clean checkpoint kept to roll back to), 'service-moved' (409: the service moved the record since
 * it), 'dead' (409), SUMMON-REPAIR's 'no-player' (404: no account by that handle), 'repair-no-faction' (409: the record
 * holds no such faction), 'repair-not-set' (409: its faction does not carry the bit - the wrong character?) and 'seq'
 * (409: the record moved while the repair was written - ask again), PURSE-MEND's 'mend-not-negative' (409: the record's
 * purse is not below nothing), 'mend-moved' (409: not the purse the mend was reckoned from) and 'repair-ticket' (409: the
 * ticket names another kind of act on this character), STAFF-SET-BANK's 'bank-none' (409: the record keeps no Empire
 * account) and 'bank-moved' (409: not the bank total staff read), or the act's answer.
 * @param {any} ctx @param {any} player @param {any} env @param {string} act @param {any} body
 */
export async function reviewAct(ctx, player, env, act, body = {}) {
  const { db, bucket, nowS } = ctx;
  if (!isDeveloper(player, env)) return { error: 'not-developer' };
  const by = player.handle;
  if (act === 'holds') {
    const { results = [] } = await db.prepare(
      `SELECT c.id, c.name, c.player, p.handle, c.held, c.held_at, c.held_until, c.strikes, c.law_holds, c.review, c.wealth, c.seq, c.clean_seq,
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
  if (act === 'progress') {
    // INT17: the progression claims' line - read, and written by a developer (MEASURE first: the owner, "Measure first")
    if (body.set !== undefined) {
      const config = progressConfigOf(body.set);
      if (!config) return { error: 'body' };
      await db.prepare("INSERT INTO realm_config (key, value, at, by) VALUES ('progress', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, at = excluded.at, by = excluded.by")
        .bind(JSON.stringify(config), nowS, by).run();
      forgetProgressConfig(db);
    }
    return progressMeasure(db, nowS, Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= 30 ? body.days : 7);
  }
  if (act === 'bodies') return bodiesMeasure(db, nowS, Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= 30 ? body.days : 7);
  if (act === 'grants') return grantsMeasure(db, nowS, Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= 30 ? body.days : 7, ranked);   // GRANT2: the spawn grants' measure
  if (act === 'gains') return gainsMeasure(db, nowS, Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= 30 ? body.days : 7);
  if (act === 'characters') {
    // SUMMON-REPAIR: the account by its handle as the service folds it (the customs pass's way), and its realm characters -
    // the dead too, said so - with the id every act on one names
    if (!isHandleShaped(body.name)) return { error: 'body' };
    const account = await db.prepare('SELECT id, handle FROM players WHERE handle_lc = ? AND handle IS NOT NULL').bind(body.name.toLowerCase()).first();
    if (!account) return { error: 'no-player' };
    const { results = [] } = await db.prepare('SELECT id, name, seq, lease, lease_at, dead_at, held, created_at, updated_at FROM realm_characters WHERE player = ? ORDER BY created_at')
      .bind(account.id).all();
    return {
      player: { id: account.id, handle: account.handle },
      characters: results.map((/** @type {any} */ c) => ({
        id: c.id, name: c.name, seq: c.seq, playing: !!c.lease && nowS - (c.lease_at ?? 0) < REALM_PLAYING_S, dead: c.dead_at != null, held: c.held, createdAt: c.created_at, updatedAt: c.updated_at,
      })),
    };
  }
  const row = await rowOf(db, body.id);
  if (!row) return typeof body.id === 'string' ? { error: 'no-realm-character' } : { error: 'body' };
  const note = noteOf(body.note);
  if (act === 'trades') return tradesOf(db, row);
  if (act === 'findings') {
    const f = await db.prepare('SELECT seq, at, law, kind, detail FROM realm_findings WHERE char_id = ? ORDER BY id DESC LIMIT 100').bind(row.id).all();
    const h = await db.prepare('SELECT hour, level, gain, loss, played_s, checkpoints FROM realm_wealth_hours WHERE char_id = ? ORDER BY hour DESC LIMIT 336').bind(row.id).all();
    // PURSE-MEND: and the purse the record holds now - the one a mend is reckoned from and names (`was`); the wealth counts
    // a purse below nothing as none, so nothing else here says it
    let record = null;
    try { record = bucket && row.obj ? parse(await realmSaveTextOf(await bucket.get(row.obj)) ?? '') : null; } catch { record = null; }
    return {
      character: { id: row.id, name: row.name, held: row.held, heldUntil: row.held_until ?? null, strikes: row.strikes, lawHolds: row.law_holds ?? 0, dupes: row.dupes ?? 0, review: row.review, wealth: row.wealth, allowance: row.allowance, seq: row.seq, clean_seq: row.clean_seq, purse: record?.goldPieces ?? null },
      findings: (f.results ?? []).map((/** @type {any} */ r) => ({ ...r, detail: parse(r.detail) })),
      hours: h.results ?? [],
    };
  }
  if (act === 'clear') {
    // the hold lifted, the flag cleared, the law's standing finding excused (judged by a person and found wrong - the
    // same signature holds nothing again, a new one does), the bucket full again (null: the next judgement fills it)
    await db.batch([
      db.prepare('UPDATE realm_characters SET held = NULL, held_at = NULL, held_until = NULL, strikes = 0, law_holds = 0, law_at = NULL, review = NULL, law_excused = law_sig, allowance = NULL, judge_rev = judge_rev + 1 WHERE id = ?').bind(row.id),
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
  if (act === 'repair') return repairAct(ctx, row, by, note, body);
  if (act === 'mend') return mendAct(ctx, row, by, note, body);   // PURSE-MEND
  if (act === 'bank') return bankAct(ctx, row, by, note, body);   // STAFF-SET-BANK
  if (act === 'rollback') {
    if (row.dead_at != null) return { error: 'dead' };
    if (!row.clean_obj || !bucket) return { error: 'no-clean' };
    // never past a move the service made: a sale's piece, a vault's, a trade's would come back while it stands elsewhere
    if (row.svc_seq != null && row.svc_seq > (row.clean_seq ?? 0)) return { error: 'service-moved' };
    const object = await bucket.get(row.clean_obj);
    const text = await realmSaveTextOf(object);
    const save = parse(text ?? '');
    if (!save) return { error: 'no-clean' };
    // the clean save becomes the record, one sequence on, its seat taken from any tab - and the hold lifted with what made it.
    // STAFF-PANEL3-REALM (design doc weak spots, "Items, census and economy": "keep staff holds through it"): staff's own
    // hold is a person's word, never the save's - it stands through a rollback, and only a clear lifts it
    const moved = await db.prepare(
      'UPDATE realm_characters SET seq = seq + 1, obj = clean_obj, prev = obj, bytes = ?, lease = NULL, judged_seq = seq + 1, clean_seq = seq + 1,'
      + " held = CASE WHEN held = 'staff' THEN 'staff' END, held_at = CASE WHEN held = 'staff' THEN held_at END,"
      + ' held_until = NULL, strikes = 0, law_holds = 0, law_at = NULL, law_sig = NULL, wealth = ?, witnessed = 0, judge_rev = judge_rev + 1, updated_at = ? WHERE id = ? AND clean_obj = ? AND seq = ? AND dead_at IS NULL',
    ).bind(new TextEncoder().encode(text ?? '').byteLength, wealthOf(save), nowS, row.id, row.clean_obj, row.seq).run();
    if (!moved.meta.changes) return { error: 'no-clean' };
    await staffFinding(db, row, nowS, { act: 'rollback', by, note, from: row.seq, to: row.clean_seq }).run();
    await dropObjects(bucket, [row.prev === row.clean_obj ? null : row.prev]);   // the save before the one rolled away: nothing names it now
    return { ok: true, seq: row.seq + 1 };
  }
  return { error: 'body' };
}

/**
 * SUMMON-REPAIR, PURSE-MEND: ONE REALM CHARACTER'S RECORD MENDED BY STAFF, ONCE A TICKET - what the repair and the mend
 * share; the dead mended never. ONCE A TICKET: a ticket this character's `realm_repairs` already holds answers its row
 * again (`repeat`) and moves nothing - a row of another kind is 'repair-ticket', a ticket naming one act. Otherwise the
 * record is SEIZED (realm.js seizeRealmRecord, INT9's and the rollback's way): read where it stands, `change(save)` applied
 * (the act's law - its refusal's word, or null), written one sequence on with the lease cleared - so the tab playing it can
 * write over it never (its next checkpoint is refused, its device's copy follows a sequence the record has left, and its
 * next join plays the mended record) - and the gold given back is WITNESSED (the judge charges no gain the service made).
 * `steps(seq)` are the act's own, in the record's own batch: its row (the ticket's key - two asked at once, one rolls
 * back), the staff finding (who, the note, the ticket, what was mended and given) and the gold as the service's own
 * faucet, `repair`. The answer is the row as it landed (`answer`), with the hold its character stands under.
 * STAFF-SET-BANK: the bank set runs it too (`bank`) - the bank's gold moved either way, witnessed the same.
 * @param {any} ctx @param {any} row the character's row @param {'repair' | 'mend' | 'bank'} kind @param {string} ticket
 * @param {(save: any) => string | null} change @param {(seq: number) => any[]} steps @param {(r: any, repeat: boolean) => any} answer
 */
async function staffMend(ctx, row, kind, ticket, change, steps, answer) {
  const { db, bucket } = ctx;
  if (row.dead_at != null) return { error: 'dead' };
  const done = () => db.prepare('SELECT r.*, c.held AS held_now FROM realm_repairs r JOIN realm_characters c ON c.id = r.char_id WHERE r.char_id = ? AND r.ticket = ?').bind(row.id, ticket).first();
  const said = (/** @type {any} */ r, /** @type {boolean} */ repeat) => (rowKindOf(r) === kind ? answer(r, repeat) : { error: 'repair-ticket' });
  const had = await done();
  if (had) return said(had, true);
  const prep = await seizeRealmRecord({ ...ctx, bucket }, row.player, row.id, change, { escrow: false });
  if ('error' in prep) return { error: prep.error };
  try {
    await db.batch([...prep.steps, ...steps(prep.seq)]);
  } catch {
    await dropIfUnnamed(db, bucket, row.player, row.id, prep.key);
    // the same ticket landed meanwhile (asked twice at once): that one is the act; else the record moved under it
    const landed = await done();
    return landed ? said(landed, true) : { error: 'seq' };
  }
  await dropObjects(bucket, [prep.prev]);
  const landed = await done();
  return landed ? said(landed, false) : { error: 'seq' };
}

/**
 * SUMMON-REPAIR: ONE OF FACTIONFILE'S FLAG BITS CLEARED ON ONE FACTION OF THE RECORD AND GOLD GIVEN BACK (net/repairLaw.js)
 * - `{ ticket, faction, flag, gold }` as the body names them, checked by the law - the staff mend's way (staffMend).
 * @param {any} ctx @param {any} row the character's row @param {string} by @param {string | null} note @param {any} body
 */
async function repairAct(ctx, row, by, note, body) {
  const { db, nowS } = ctx;
  const repair = repairOf(body);
  if (!repair) return { error: 'body' };
  let was = 0;
  return staffMend(ctx, row, 'repair', repair.ticket, (save) => {
    const r = applyRepair(save, repair);
    if (typeof r === 'string') return r;
    was = r.was;
    return null;
  }, (seq) => [
    db.prepare('INSERT INTO realm_repairs (char_id, ticket, player, by_handle, at, faction, flag, was, gold, seq, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(row.id, repair.ticket, row.player, by, nowS, repair.faction, repair.flag, was, repair.gold, seq, note),
    staffFinding(db, row, nowS, { act: 'repair', by, note, ticket: repair.ticket, faction: repair.faction, flag: repair.flag, was, gold: repair.gold, from: row.seq, to: seq }),
    ...(repair.gold > 0 ? [faucetStatement(db, 'repair', Math.floor(nowS / 3600), repair.gold)] : []),
  ], repairAnswer);
}

/**
 * PURSE-MEND (FIELD BUGS 2026-10-19f): A PURSE A WRAPPED SALE LEFT BELOW NOTHING, MENDED BY STAFF (net/repairLaw.js) -
 * `{ ticket, was, gold }` as the body names them, checked by the law: the record's purse, still the `was` staff reckoned
 * from, set to nothing and `gold` given as one letter of credit - the repair's machinery (staffMend), its row in
 * `realm_repairs` naming no faction and no bit (0 and 0), `was` the purse it found and `gold` the letter.
 * AND THE HOLD THE PURSE MADE, LIFTED WITH IT: when the judge's hold is the law's, the finding it stands on the purse's
 * alone (PURSE_SIG) and no timed hold stands, the mend lifts it as the next clean checkpoint would - the hold and its
 * signature gone, the row's `judge_rev` one on (its strike stands, fading as every strike does: verdict.js LAW_FADE_S;
 * which strike the purse struck the row does not say) - guarded on the judgement the act read, so a verdict or a staff act
 * landing in between moves nothing ('seq': ask again). Any other hold stays: the law's beside another finding, and a
 * timed one, are the next checkpoint's to judge; staff's own is staff's.
 * @param {any} ctx @param {any} row the character's row @param {string} by @param {string | null} note @param {any} body
 */
async function mendAct(ctx, row, by, note, body) {
  const { db, nowS } = ctx;
  const mend = purseMendOf(body);
  if (!mend) return { error: 'body' };
  const lift = row.held === 'law' && row.law_sig === PURSE_SIG && !(row.held_until > nowS);
  return staffMend(ctx, row, 'mend', mend.ticket, (save) => {
    const r = applyPurseMend(save, mend);
    return typeof r === 'string' ? r : null;
  }, (seq) => [
    ...(lift ? [
      db.prepare('UPDATE realm_characters SET held = NULL, held_at = NULL, law_sig = NULL, judge_rev = judge_rev + 1 WHERE id = ? AND judge_rev = ? AND judged_seq IS ?')
        .bind(row.id, row.judge_rev, row.judged_seq),
      mustChange(db),
    ] : []),
    db.prepare('INSERT INTO realm_repairs (char_id, ticket, player, by_handle, at, faction, flag, was, gold, seq, note) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)')
      .bind(row.id, mend.ticket, row.player, by, nowS, mend.was, mend.gold, seq, note),
    staffFinding(db, row, nowS, { act: 'mend', by, note, ticket: mend.ticket, was: mend.was, gold: mend.gold, lifted: lift, from: row.seq, to: seq }),
    ...(mend.gold > 0 ? [faucetStatement(db, 'repair', Math.floor(nowS / 3600), mend.gold)] : []),
  ], mendAnswer);
}

/**
 * STAFF-SET-BANK (2026-10-23, mob: "we need a set bank setting"): A REALM CHARACTER'S BANK, SET BY STAFF (net/repairLaw.js)
 * - `{ ticket, was, gold }` as the body names them, checked by the law: the record's bank, still the total `was` staff
 * read, made the Empire's account holding `gold` with no other branch holding any, every loan where it stands - the
 * repair's machinery (staffMend), its row in `realm_repairs` naming BANK_SET_FACTION and no bit, `was` the total it found
 * and `gold` the bank it set. THE JUDGE CHARGES NONE OF IT: the record's wealth moves by what the set moved, and
 * prepareRealmRecord writes that into the row's `witnessed` in the record's own step, so the next checkpoint's gain
 * (verdict.js: the wealth less the last judged, less what was witnessed) is the player's alone - a set up charges no
 * gain, a set down hides none after it. THE ECONOMY: what the set raised the bank by is the service's own faucet,
 * `repair`, as a mend's letter is - the bank before counted as the judge counts it (judge.js goldOf, wealthOf: a branch
 * below nothing, a fraction or a count past every safe integer is none), so the faucet is the gold the set witnessed
 * (REVIEW, 2026-10-23: reckoned from `was`, a branch below nothing beside gold booked a faucet for no gold, and a hacked
 * bank set down to honest gold booked none for the gold it made); what a set down takes is written in the finding and
 * the panel's audit row alone - the service keeps no sink for staff's removals. No hold is lifted (the mend's lift is the
 * purse's alone): the next checkpoint judges the record as it stands.
 * @param {any} ctx @param {any} row the character's row @param {string} by @param {string | null} note @param {any} body
 */
async function bankAct(ctx, row, by, note, body) {
  const { db, nowS } = ctx;
  const set = bankSetOf(body);
  if (!set) return { error: 'body' };
  let up = 0;
  return staffMend(ctx, row, 'bank', set.ticket, (save) => {
    up = set.gold - (Array.isArray(save.bankAccounts) ? save.bankAccounts : []).reduce((/** @type {number} */ g, /** @type {any} */ a) => g + goldOf(a?.accountGold), 0);
    const r = applyBankSet(save, set);
    return typeof r === 'string' ? r : null;
  }, (seq) => [
    db.prepare('INSERT INTO realm_repairs (char_id, ticket, player, by_handle, at, faction, flag, was, gold, seq, note) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)')
      .bind(row.id, set.ticket, row.player, by, nowS, BANK_SET_FACTION, set.was, set.gold, seq, note),
    staffFinding(db, row, nowS, { act: 'bank', by, note, ticket: set.ticket, was: set.was, gold: set.gold, from: row.seq, to: seq }),
    ...(up > 0 ? [faucetStatement(db, 'repair', Math.floor(nowS / 3600), up)] : []),
  ], bankAnswer);
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
  // AUDIT LW-II-2 S6 (Living World II decision 7: the patrons' gold "written where the wealth measure counts it"): the
  // service's own faucets over the window - the gold it paid that no player paid (budget.js FAUCET_KINDS), each kind
  // named, none left unread (realm_faucets was written and nothing read it)
  const { results: paid = [] } = await db.prepare('SELECT kind, SUM(gold) AS gold, SUM(n) AS n FROM realm_faucets WHERE hour >= ?1 GROUP BY kind')
    .bind(Math.floor(since / 3600)).all();
  const faucets = FAUCET_KINDS.map((kind) => {
    const r = paid.find((/** @type {any} */ x) => x.kind === kind);
    return { kind, gold: Number(r?.gold ?? 0), n: Number(r?.n ?? 0) };
  });
  return { days, config, isDefault: config === BUDGET_DEFAULT, bands, faucets };
}

/**
 * INT17 - THE PROGRESSION CLAIMS' MEASURE over the last `days`, a stream at a time: every account-hour that played
 * MEASURE_PLAYED_MIN or more, as the stream's units an hour of play - its count, quantiles and most, asked of the
 * database a quantile at a time (the budget's way) - and the hours a claim went past the bucket the line standing
 * filled (`overs`, and how many accounts), with the line itself.
 * @param {any} db @param {number} nowS @param {number} days
 */
export async function progressMeasure(db, nowS, days) {
  const config = await progressConfig(db);
  const since = nowS - days * 24 * 3600;
  const rate = 'CAST(ROUND(amount * 3600.0 / played_s) AS INTEGER)';
  const where = 'stream = ?1 AND hour >= ?2 AND played_s >= ?3';
  const streams = [];
  for (const stream of PROGRESS_STREAMS) {
    const n = Number((await db.prepare(`SELECT COUNT(*) AS n FROM progress_hours WHERE ${where}`).bind(stream, since, MEASURE_PLAYED_MIN).first())?.n ?? 0);
    const at = async (/** @type {number} */ rank) => (await db.prepare(`SELECT ${rate} AS r FROM progress_hours WHERE ${where} ORDER BY r LIMIT 1 OFFSET ?4`)
      .bind(stream, since, MEASURE_PLAYED_MIN, rank).first())?.r ?? null;
    const { quantiles, most } = await ranked(n, at);
    const over = await db.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT player) AS accounts, COALESCE(SUM(over), 0) AS units FROM progress_hours WHERE stream = ?1 AND hour >= ?2 AND over > 0')
      .bind(stream, since).first();
    streams.push({ stream, ...config.streams[stream], hours: n, quantiles, most, overs: Number(over?.n ?? 0), accounts: Number(over?.accounts ?? 0), past: Number(over?.units ?? 0) });
  }
  return { days, enforce: config.enforce, isDefault: config === PROGRESS_LINE, streams };
}

/**
 * HACKED-GOLD - WHO GAINED PAST THE BUCKET over the last `days`: every character whose rise no witness explained went past
 * the bucket its play filled (verdict.js: a `measure` finding while the budget only measures, a `budget` one once it
 * holds), largest first, with its account, its hold, its wealth now, how many times, and its largest gain. While the
 * budget only measures nothing is held, so `holds` lists none of them: a character that had made itself nine quadrillion
 * gold stood in no list a developer could read, and neither did one that took a peer's forged gold. This one does.
 * @param {any} db @param {number} nowS @param {number} days
 */
export async function gainsMeasure(db, nowS, days) {
  const since = nowS - days * 24 * 3600;
  const { results = [] } = await db.prepare(
    `SELECT f.char_id AS id, c.name, c.player, p.handle, c.held, c.wealth, COUNT(*) AS n,
       MAX(CAST(json_extract(f.detail, '$.gain') AS INTEGER)) AS gain, MAX(f.at) AS last
     FROM realm_findings f JOIN realm_characters c ON c.id = f.char_id LEFT JOIN players p ON p.id = c.player
     WHERE f.at >= ?1 AND f.kind IN ('measure', 'budget')
     GROUP BY f.char_id ORDER BY gain DESC LIMIT ?2`,
  ).bind(since, GAINS_LIST_MAX).all();
  return { days, characters: results };
}

/** What one side of a settled trade received (realmTradeLaw.js settleRealmTrade's `toA`/`toB`, kept in the row's `result`):
 *  its gold, its letters of credit at their worth, and how many pieces. STAFF-PANEL3-PLAYERS: the panel's Trades tab reads
 *  a trade's sides by it too (staffPlayers.js). */
export const receiptOf = (/** @type {any} */ side) => {
  const items = Array.isArray(side?.items) ? side.items : [];
  const letters = items.filter((/** @type {any} */ it) => it?.templateIndex === REALM_LETTER_TEMPLATE).reduce((/** @type {number} */ n, /** @type {any} */ it) => n + (Number(it.value) || 0), 0);
  return { gold: Number(side?.gold) || 0, letters, pieces: items.length };
};

/**
 * HACKED-GOLD - ONE CHARACTER'S TRADES: every realm trade it settled that the service still keeps (realmTrade.js
 * REALM_TRADE_KEEP_S), newest first - the character on the other side and its account, and what each side gave. A trade's
 * gold is witnessed on both rows (the budget charges neither), so this is the trail from one who made gold to the hands
 * it reached. @param {any} db @param {any} row
 */
export async function tradesOf(db, row) {
  const { results = [] } = await db.prepare(
    `SELECT t.sid, t.created_at AS at, t.a_char, t.b_char, t.a_player, t.b_player, t.result,
       ca.name AS a_name, cb.name AS b_name, pa.handle AS a_handle, pb.handle AS b_handle
     FROM realm_trades t
       LEFT JOIN realm_characters ca ON ca.id = t.a_char LEFT JOIN realm_characters cb ON cb.id = t.b_char
       LEFT JOIN players pa ON pa.id = t.a_player LEFT JOIN players pb ON pb.id = t.b_player
     WHERE t.state = 'done' AND (t.a_char = ?1 OR t.b_char = ?1) ORDER BY t.created_at DESC LIMIT ?2`,
  ).bind(row.id, TRADES_LIST_MAX).all();
  const trades = results.map((/** @type {any} */ t) => {
    const r = parse(t.result) ?? {};
    const mine = t.a_char === row.id ? 'a' : 'b', theirs = mine === 'a' ? 'b' : 'a';
    // the row keeps what each side RECEIVED, so what I gave is what the other side got
    return {
      sid: t.sid, at: t.at,
      with: { id: t[`${theirs}_char`] ?? null, name: t[`${theirs}_name`] ?? null, player: t[`${theirs}_player`] ?? null, handle: t[`${theirs}_handle`] ?? null },
      gave: receiptOf(r[theirs]), got: receiptOf(r[mine]),
    };
  });
  return { character: { id: row.id, name: row.name }, trades };
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
