// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT2-INT5 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; its audit the same day): THE VERDICT ON
// A CHECKPOINT - what the judge found (judge.js), what the ledger says (INT4, ledger.js), what the budget says (INT5,
// budget.js), the level the realm trusts, and the hold they come to - as the statements realm.js checkpointRealm lays in
// the SAME BATCH that moves the character's row to the new save. One batch, so a checkpoint that loses its race (a
// trade settling, a join) writes no verdict either, and a verdict never stands for a save that did not land.
//
// ═══ THE HOLD ══════════════════════════════════════════════════════
//
// `held` is the character's, and every route that hands its value to another player reads it (realm.js holdRefusal).
// Its reasons stand in an order - staff's, the law's, the budget's - and each clears its own way:
//   - 'staff'  staff's own. Staff alone.
//   - 'law'    a checkpoint held something no honest client mints. Cleared by the next clean checkpoint - the piece
//              sold, dropped, gone - until STRIKES_FOR_TIMED holds have come (a strike a hold, never a checkpoint: one
//              piece carried six minutes is one strike, AUDIT INT). That hold is TIMED (AUTO-HOLD): LAW_HOLD_S, and
//              LAW_HOLD_REPEAT_S for each one after it, whatever the checkpoints in it say - a clean one is no way out -
//              and the first checkpoint past its time lifts it as any law hold lifts. The strikes and the timed holds
//              served are forgotten LAW_FADE_S after the last finding that held (or the last timed hold's end). Staff
//              who find the law's word wrong clear it, and the same finding holds nothing again (`law_excused`).
//   - 'budget' (only once staff turn `enforce` on) a gain past the bucket. Cleared when play refills it.
//
// A COPY HOLDS NO CHARACTER (AUTO-HOLD, 2026-10-16 - Mac: "I dont want to have to manually review"). The ledger locks
// the copied PIECE (ledger.js item_dupes - it moves by no route) and the checkpoint's answer names it; the character
// trades on. 'dupe' - DUPES_FOR_HOLD copies, staff alone to lift - is retired: no verdict writes it, a row still holding
// it is lifted by its next checkpoint, and migration 0120 lifted every one standing.
//
// ═══ WHAT A VERDICT WRITES OVER ════════════════════════════════════
//
// The row as the checkpoint READ it (`judge_rev`): a staff act landing in between moves the rev, and this verdict is not
// written - the next checkpoint judges again over the row as it stands
// (AUDIT INT: a staff hold landing mid-checkpoint was written over). The bucket is written as a change, so a win's
// spoils granted in between (budget.js grantSpoils) are kept.
//
// ═══ THE FIRST JUDGEMENT ═══════════════════════════════════════════
//
// Mac's call at the cutover: "Items judged, wealth baselined". The baseline is what the realm ALREADY HELD for the
// character - its stored record, read once - never the save the first judged checkpoint brings: that save is charged
// for what it adds like any other (AUDIT INT: the first judged save could hold anything, and was the baseline). A new
// character's baseline is a newborn's purse (REALM_BIRTH_WEALTH_MAX); one through customs, its level's allowance.
// ═══════════════════════════════════════════════════════════════════

import { judgeSave, judgeProducts, STRIKES_FOR_TIMED, JUDGE_VERSION, FINDINGS_KEPT, WEALTH_VERSION, goodsOf } from './judge.js';
import { ledgerStep, chargeSteps } from './ledger.js';
import { budgetConfig, bandOf, stepBudget } from './budget.js';
import { customsAllowance } from '../../src/net/realm/realmGoldLaw.js';
import { censusStep } from './staffCensus.js';   // STAFF-PANEL4-CENSUS: the census's tally, on the hour's row and the character's latest

/** INT2's cutover (Mac: "Items judged, wealth baselined"): a character whose first judged wealth stands past this many
 *  of its level's customs allowance (realmGoldLaw.js customsAllowance) is flagged for staff - flagged, never held. */
export const OUTLIER_ALLOWANCES = 10;
/** The fewest seconds of play a level takes to rise, as the realm trusts it (the budget's band, a win's spoils) - the
 *  save's own level stands, and lane 4 judges it (Integrity-Arc). Generous: no honest level comes faster. */
export const LEVEL_RISE_S = 300;
const HOUR_S = 3600;
const DAY_S = 24 * HOUR_S;
/** AUTO-HOLD (2026-10-16, Mac's call): the law's timed hold - the first a week, each after it a month - and how long with
 *  nothing found before the strikes and the timed holds served are forgotten. */
export const LAW_HOLD_S = 7 * DAY_S;
export const LAW_HOLD_REPEAT_S = 30 * DAY_S;
export const LAW_FADE_S = 30 * DAY_S;

/**
 * The hold a verdict comes to, from the one before it - pure. `law`: findings this checkpoint that hold (an excused
 * signature's hold none); `until`: the end of the law's timed hold (null for none) and `nowS` the checkpoint's time;
 * `over`: the budget's overrun; and `enforce`: whether the budget holds. A reason no longer written ('dupe') lifts.
 * @param {{ prev: string | null, law: number, until: number | null, nowS: number, over: number, enforce: boolean }} v
 * @returns {string | null}
 */
export function holdOf({ prev, law, until, nowS, over, enforce }) {
  if (prev === 'staff') return 'staff';
  if (law > 0 || (until != null && until > nowS)) return 'law';
  if (enforce && over > 0) return 'budget';
  return null;
}

/**
 * AUTO-HOLD: THE LAW'S COUNT after this checkpoint, from the row's - pure. `rising`: this checkpoint's finding is a new
 * hold (a strike) - none inside a timed hold standing, where no new hold comes (a strike a hold; AUDIT AUTO-HOLD: a piece
 * dropped and taken up three times inside the week was a month's hold); `holding`: it found something that holds. The strikes and the timed holds served fade LAW_FADE_S
 * after `at` (the last finding that held, or the last timed hold's end); the STRIKES_FOR_TIMED-th strike starts a timed
 * hold - LAW_HOLD_S the first, LAW_HOLD_REPEAT_S each after it - and the strikes count again from none. Answers
 * `{ strikes, served, until, at }` - `until` the timed hold's end standing (null for none, or one run out).
 * @param {{ strikes: number | null, served: number | null, until: number | null, at: number | null }} row
 * @param {{ rising: boolean, holding: boolean, nowS: number }} v
 */
export function lawCountOf(row, { rising, holding, nowS }) {
  const standing = row.until != null && row.until > nowS ? row.until : null;
  const faded = row.at != null && nowS - row.at >= LAW_FADE_S;
  const struck = (faded ? 0 : row.strikes ?? 0) + (rising && standing == null ? 1 : 0);
  const served = faded ? 0 : row.served ?? 0;
  // the fade counts from the last finding that held - never from inside a timed hold, whose end is the later
  const at = holding ? Math.max(nowS, standing ?? 0) : faded ? null : row.at;
  if (struck >= STRIKES_FOR_TIMED) {
    const until = nowS + (served > 0 ? LAW_HOLD_REPEAT_S : LAW_HOLD_S);
    return { strikes: 0, served: served + 1, until, at: until };
  }
  return { strikes: struck, served, until: standing, at };
}

/** A law finding's SIGNATURE: what was found, on what templates - the same pieces carried on find the same signature
 *  wherever they lie in the pack. Null for none. */
export const lawSigOf = (/** @type {any[]} */ findings) => (findings.length
  ? [...new Set(findings.map((f) => `${f.code}:${f.t ?? ''}`))].sort().join(',').slice(0, 500) : null);

/**
 * THE LEVEL THE REALM TRUSTS, pure: the save's `level`, never past `seen` (the last trusted) and one more for every
 * LEVEL_RISE_S played since it last rose (`at`, the account's played seconds then; `played`, now). Answers `{ level, at }`.
 * @param {{ seen: number | null, at: number | null, level: unknown, played: number }} v
 */
export function trustedLevel({ seen, at, level, played }) {
  const since = at ?? played;
  if (!Number.isInteger(level) || /** @type {number} */ (level) < 1) return { level: seen ?? 1, at: since };
  const lv = /** @type {number} */ (level);
  if (seen == null || lv <= seen) return { level: lv, at: since };
  const reach = seen + Math.floor(Math.max(0, played - since) / LEVEL_RISE_S);
  const now = Math.min(lv, Math.max(seen, reach));
  return { level: now, at: since + (now - seen) * LEVEL_RISE_S };
}

/**
 * THE VERDICT ON ONE CHECKPOINT: the judge's findings (the character, every piece it holds, the crafts' records), the
 * ledger's step, the trusted level, the budget's step and the hold. Answers `{ steps, set, clean, law, copies, over }`:
 * `steps` the statements realm.js puts in the checkpoint's batch AFTER its row's move - the verdict's own write first
 * (verdictWrite, guarded by the rev the row was read at), then the ledger's, a copy charged, the findings and the hour.
 * `row` is the character's row as the checkpoint read it (its judge columns, and `played_now`, the account's played
 * seconds); `save` the checkpoint, parsed; `summary` the tile it claims; `baseline` the first judgement's (`{ wealth,
 * level }` - null, or a null wealth: this save is its own).
 * @param {any} ctx @param {{ player: string, char: string, seq: number, key: string }} at @param {any} row
 * @param {any} save @param {any} summary @param {{ wealth: number | null, level: number | null } | null} [baseline]
 * @param {{ mine: any, dupes: any, config: any } | null} [known] SAVE-BATCH: the ledger's reads and the config, answered in
 * the checkpoint's first batch (realm.js checkpointRealm) - null, and they are asked here
 */
export async function verdictOn({ db, nowS }, { player, char, seq, key }, row, save, summary, baseline = null, known = null) {
  const first = row.wealth == null;
  const playedS = Number.isSafeInteger(row.played_now) ? row.played_now : 0;
  const lv = trustedLevel({
    seen: first ? baseline?.level ?? null : row.level_seen ?? null,
    at: first ? row.played_at ?? playedS : row.level_at ?? row.played_at ?? playedS,
    level: save?.level, played: playedS,
  });
  const judged = judgeSave(save, summary, { level: lv.level });
  const crafts = judged.provenances.length ? await judgeProducts(db, judged.provenances, player) : { findings: [], arrived: [] };
  const products = crafts.findings;
  const ledger = await ledgerStep(db, { player, char, seq, nowS }, judged.pieces, known);   // SAVE-BATCH: its two reads answered in the checkpoint's first batch
  // AUDIT AUTO-HOLD: a key on another piece names the piece it is on (its template, off its print) - "something it carries"
  // was all its holder heard, and a griefer's planted one was a piece nobody could find
  const printOf = new Map(judged.pieces.map((p) => [p.key, p.fp]));
  const templateOfKey = (/** @type {string} */ k) => { const t = Number(String(printOf.get(k) ?? '').split(':')[0]); return Number.isSafeInteger(t) ? t : null; };
  const lawFindings = [...judged.findings, ...products, ...ledger.forged.map((k) => ({ code: 'uid', at: k, t: templateOfKey(k) }))];
  const law = judged.count + products.length + ledger.forged.length;
  const sig = law > 0 ? lawSigOf(lawFindings) : null;
  const lawHolds = law > 0 && sig !== row.law_excused ? law : 0;
  // the budget: the rise since the last judgement (or the baseline) that no witness explains, against the bucket the
  // time played filled
  const config = known?.config ?? await budgetConfig(db);   // SAVE-BATCH: and the config, where the isolate kept none
  const band = bandOf(config, lv.level);
  // the measure moved (WEALTH_VERSION): the stored record, measured again, is the base - and nothing witnessed since it
  const rebased = !first && baseline != null && baseline.wealth != null;
  const base = first ? baseline?.wealth ?? judged.wealth : rebased ? /** @type {number} */ (baseline.wealth) : row.wealth;
  // a crafted piece the service made or sold to this account, come into the record: witnessed, once (products.credited)
  const arrivedWorth = crafts.arrived.reduce((n, a) => n + a.w, 0);
  const gain = judged.wealth - base - (first || rebased ? 0 : row.witnessed ?? 0) - arrivedWorth;
  const dPlayed = first || row.played_at == null ? 0 : Math.max(0, playedS - row.played_at);
  const budget = stepBudget({ allowance: first ? null : row.allowance ?? null, played: dPlayed, gain, band, enforce: config.enforce });
  // the copies this checkpoint found this record holding - found and counted on the row by chargeSteps, after the
  // verdict's write; they hold nothing (AUTO-HOLD: the pieces are locked, ledger.js)
  const fresh = ledger.copies.length;
  // AUDIT AUTO-HOLD: a key on another piece holds while it is carried, and is NO STRIKE - it is no claim to the piece it was
  // minted for (ledger.js), and a peer can hand one over a body or a chest: three planted were a week's hold for the one
  // who took them up, as a contested claim would have been
  const rising = lawHolds > 0 && lawFindings.some((f) => f.code !== 'uid') && (row.law_sig == null || row.law_sig === row.law_excused);
  const count = lawCountOf({ strikes: row.strikes ?? null, served: row.law_holds ?? null, until: row.held_until ?? null, at: row.law_at ?? null }, { rising, holding: lawHolds > 0, nowS });
  const held = holdOf({ prev: row.held ?? null, law: lawHolds, until: count.until, nowS, over: budget.over, enforce: config.enforce });
  // the cutover's outlier: a first judgement far past its level's line is flagged for staff, and holds nothing
  const outlier = first && judged.wealth > OUTLIER_ALLOWANCES * customsAllowance(lv.level);
  const clean = law === 0 && fresh === 0;
  /** @type {any[]} */
  const after = [...ledger.steps];
  if (fresh) after.push(...chargeSteps(db, char, ledger.copies, nowS));
  for (let i = 0; i < crafts.arrived.length; i += 90) {
    const part = crafts.arrived.slice(i, i + 90).map((a) => a.provenance);
    after.push(db.prepare(`UPDATE products SET credited = 1 WHERE owner = ?1 AND provenance IN (${part.map((_, k) => `?${k + 2}`).join(', ')})`).bind(player, ...part));
  }
  const finding = (/** @type {string} */ kind, /** @type {any} */ detail) => after.push(db.prepare(
    'INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(player, char, seq, nowS, JUDGE_VERSION, kind, JSON.stringify(detail)));
  // a finding once, as it comes or changes - a held character's every checkpoint finds the same pieces
  if (law > 0 && sig !== row.law_sig) finding('law', { count: law, findings: lawFindings.slice(0, FINDINGS_KEPT), ...(lawHolds ? {} : { excused: true }) });
  // a GAIN that leaves the bucket short is found; a checkpoint that gained nothing while play pays a shortfall back finds
  // nothing new (the hold, under `enforce`, stands until it is paid)
  // STAFF-PANEL3-REALM (design doc weak spots: "split gold from item worth"): and the goods of that wealth (judge.js
  // goodsOf - its pieces that are not gold, at the wealth's own worth), so staff read gold - the rest of it, the debt off
  // it - apart from goods in one measure (FLAW REVIEW: customs' gold beside it, the loan never off it, made the goods short)
  // - asked only when this finding is written
  if (budget.over > 0 && gain > 0) finding(config.enforce ? 'budget' : 'measure', { gain, over: budget.over, level: lv.level, played: dPlayed, wealth: judged.wealth, goods: goodsOf(save), ...(first ? { first: true } : {}) });
  if (outlier) finding('outlier', { wealth: judged.wealth, level: lv.level });
  // the hour's measure: what no witness explains, apart by sign, against the seconds played at this level
  const hour = Math.floor(nowS / HOUR_S) * HOUR_S;
  // STAFF-PANEL4-CENSUS (design doc, Server load: "keep a tally on the hourly wealth row the checkpoint already writes,
  // only when it changes"): the census's tally rides this row - null, unchanged, and the row keeps its own - and the
  // character's latest beside it. censusStep never throws: a census that fails is no census, never a lost save
  const census = censusStep(db, { player, char, seq, nowS }, save, row.census_tally ?? null);
  after.push(db.prepare(
    'INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s, checkpoints, tally) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
    + ' ON CONFLICT (char_id, hour) DO UPDATE SET level = excluded.level, gain = gain + excluded.gain, loss = loss + excluded.loss,'
    + ' played_s = played_s + excluded.played_s, checkpoints = checkpoints + 1, tally = COALESCE(excluded.tally, tally)',
  ).bind(char, hour, player, lv.level, Math.max(0, gain), Math.max(0, -gain), dPlayed, census.tally), ...census.steps);
  const set = {
    judged_seq: seq,
    held,
    held_at: held == null ? null : held === row.held ? row.held_at ?? nowS : nowS,
    strikes: count.strikes,
    held_until: count.until,
    law_holds: count.served,
    law_at: count.at,
    review: outlier ? 'outlier' : row.review ?? null,
    wealth: judged.wealth,
    allowance: budget.allowance,
    played_at: playedS,
    clean_obj: clean ? key : row.clean_obj ?? null,
    clean_seq: clean ? seq : row.clean_seq ?? null,
    level_seen: lv.level,
    level_at: lv.at,
    law_sig: sig,
    // INT7: the arms the identity mint signs - the most reach of the lawful weapons in the pack, and a lawful bow
    arms_top: judged.arms[0],
    arms_bow: judged.arms[1],
  };
  // the first thing the law found, for the tab to name the piece to its player (only when it holds) - and a TIMED hold
  // says its end, `until` (AUTO-HOLD): the piece gone or not, that is the way out (the Ring report: held still past the
  // third, and told only "something")
  const found = lawHolds ? (({ code, t }) => ({ code, t: t ?? null }))(lawFindings[0]) : null;
  const why = held !== 'law' ? null : count.until != null ? { code: 'until', t: found?.t ?? null, until: count.until } : found;
  return { steps: [verdictWrite(db, char, row, set), ...after], set, clean, law, copies: ledger.copies, over: budget.over, why, locked: ledger.locked };
}

/**
 * THE VERDICT'S OWN WRITE over the row as the checkpoint read it - its `judge_rev` unmoved, or nothing (the next
 * checkpoint judges again). The bucket written as a change, so spoils granted in between stand.
 * @param {any} db @param {string} char @param {any} row @param {any} s
 */
export function verdictWrite(db, char, row, s) {
  return db.prepare(
    'UPDATE realm_characters SET judged_seq = ?2, held = ?3, held_at = ?4, strikes = ?5, review = ?6, wealth = ?7, witnessed = 0,'
    + ' allowance = CASE WHEN ?8 IS NULL OR allowance IS NULL THEN ?9 ELSE ?9 + (allowance - ?8) END,'
    + ' played_at = ?10, clean_obj = ?11, clean_seq = ?12, level_seen = ?13, level_at = ?14, law_sig = ?15, wealth_v = ?17,'
    + ' arms_top = ?18, arms_bow = ?19, held_until = ?20, law_holds = ?21, law_at = ?22'
    + ' WHERE id = ?1 AND judge_rev = ?16',
  ).bind(char, s.judged_seq, s.held, s.held_at, s.strikes, s.review, s.wealth, row.allowance ?? null, s.allowance, s.played_at,
    s.clean_obj, s.clean_seq, s.level_seen, s.level_at, s.law_sig, row.judge_rev ?? 0, WEALTH_VERSION, s.arms_top ?? null, s.arms_bow ?? null,
    s.held_until ?? null, s.law_holds ?? 0, s.law_at ?? null);
}
