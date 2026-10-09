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
// Its reasons stand in an order - staff's, the copies', the law's, the budget's - and each clears its own way:
//   - 'staff'  staff's own. Staff alone.
//   - 'dupe'   DUPES_FOR_HOLD copies found in its records (ledger.js). Staff alone - a breach of the law over it is no
//              way out (AUDIT INT: a 'law' checkpoint stepped a 'dupe' hold down, and the next clean one lifted it).
//   - 'law'    a checkpoint held something no honest client mints. Cleared by the next clean checkpoint - the piece
//              sold, dropped, gone - until STRIKES_FOR_REVIEW holds have come (a strike a hold, never a checkpoint: one
//              piece carried six minutes is one strike, AUDIT INT); then by staff alone. Staff who find the law's word
//              wrong clear it, and the same finding holds nothing again (`law_excused`).
//   - 'budget' (only once staff turn `enforce` on) a gain past the bucket. Cleared when play refills it.
//
// ═══ WHAT A VERDICT WRITES OVER ════════════════════════════════════
//
// The row as the checkpoint READ it (`judge_rev`): a staff act or a copy charged by another's checkpoint landing in
// between moves the rev, and this verdict is not written - the next checkpoint judges again over the row as it stands
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

import { judgeSave, judgeProducts, STRIKES_FOR_REVIEW, JUDGE_VERSION, FINDINGS_KEPT, WEALTH_VERSION } from './judge.js';
import { ledgerStep, chargeSteps, DUPES_FOR_HOLD } from './ledger.js';
import { budgetConfig, bandOf, stepBudget } from './budget.js';
import { customsAllowance } from '../../src/net/realmGoldLaw.js';

/** INT2's cutover (Mac: "Items judged, wealth baselined"): a character whose first judged wealth stands past this many
 *  of its level's customs allowance (realmGoldLaw.js customsAllowance) is flagged for staff - flagged, never held. */
export const OUTLIER_ALLOWANCES = 10;
/** The fewest seconds of play a level takes to rise, as the realm trusts it (the budget's band, a win's spoils) - the
 *  save's own level stands, and lane 4 judges it (Integrity-Arc). Generous: no honest level comes faster. */
export const LEVEL_RISE_S = 300;
const HOUR_S = 3600;

/**
 * The hold a verdict comes to, from the one before it - pure. `law`: findings this checkpoint that hold (an excused
 * signature's hold none); `strikes`: the holds the law has come to, this one's with them; `dupes`: the copies the
 * character has been found holding, `fresh` this checkpoint's - a hold staff lifted stays lifted until a new one comes;
 * `over`: the budget's overrun; and `enforce`: whether the budget holds.
 * @param {{ prev: string | null, law: number, strikes: number, dupes: number, fresh: number, over: number, enforce: boolean }} v
 * @returns {string | null}
 */
export function holdOf({ prev, law, strikes, dupes, fresh, over, enforce }) {
  if (prev === 'staff') return 'staff';
  if (prev === 'dupe' || (fresh > 0 && dupes >= DUPES_FOR_HOLD)) return 'dupe';
  if (law > 0 || (prev === 'law' && strikes >= STRIKES_FOR_REVIEW)) return 'law';
  if (enforce && over > 0) return 'budget';
  return null;
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
 */
export async function verdictOn({ db, nowS }, { player, char, seq, key }, row, save, summary, baseline = null) {
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
  const ledger = await ledgerStep(db, { player, char, seq, nowS }, judged.pieces);
  const lawFindings = [...judged.findings, ...products, ...ledger.forged.map((k) => ({ code: 'uid', at: k }))];
  const law = judged.count + products.length + ledger.forged.length;
  const sig = law > 0 ? lawSigOf(lawFindings) : null;
  const lawHolds = law > 0 && sig !== row.law_excused ? law : 0;
  // the budget: the rise since the last judgement (or the baseline) that no witness explains, against the bucket the
  // time played filled
  const config = await budgetConfig(db);
  const band = bandOf(config, lv.level);
  // the measure moved (WEALTH_VERSION): the stored record, measured again, is the base - and nothing witnessed since it
  const rebased = !first && baseline != null && baseline.wealth != null;
  const base = first ? baseline?.wealth ?? judged.wealth : rebased ? /** @type {number} */ (baseline.wealth) : row.wealth;
  // a crafted piece the service made or sold to this account, come into the record: witnessed, once (products.credited)
  const arrivedWorth = crafts.arrived.reduce((n, a) => n + a.w, 0);
  const gain = judged.wealth - base - (first || rebased ? 0 : row.witnessed ?? 0) - arrivedWorth;
  const dPlayed = first || row.played_at == null ? 0 : Math.max(0, playedS - row.played_at);
  const budget = stepBudget({ allowance: first ? null : row.allowance ?? null, played: dPlayed, gain, band, enforce: config.enforce });
  // the copies this checkpoint found this record holding - counted on the row by chargeSteps, after the verdict's write
  const fresh = ledger.copies.length;
  const dupes = (row.dupes ?? 0) + fresh;
  const rising = lawHolds > 0 && (row.law_sig == null || row.law_sig === row.law_excused);
  const strikes = (row.strikes ?? 0) + (rising ? 1 : 0);
  const held = holdOf({ prev: row.held ?? null, law: lawHolds, strikes, dupes, fresh, over: budget.over, enforce: config.enforce });
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
  if (budget.over > 0 && gain > 0) finding(config.enforce ? 'budget' : 'measure', { gain, over: budget.over, level: lv.level, played: dPlayed, wealth: judged.wealth, ...(first ? { first: true } : {}) });
  if (outlier) finding('outlier', { wealth: judged.wealth, level: lv.level });
  // the hour's measure: what no witness explains, apart by sign, against the seconds played at this level
  const hour = Math.floor(nowS / HOUR_S) * HOUR_S;
  after.push(db.prepare(
    'INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s, checkpoints) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    + ' ON CONFLICT (char_id, hour) DO UPDATE SET level = excluded.level, gain = gain + excluded.gain, loss = loss + excluded.loss,'
    + ' played_s = played_s + excluded.played_s, checkpoints = checkpoints + 1',
  ).bind(char, hour, player, lv.level, Math.max(0, gain), Math.max(0, -gain), dPlayed));
  const set = {
    judged_seq: seq,
    held,
    held_at: held == null ? null : held === row.held ? row.held_at ?? nowS : nowS,
    strikes,
    review: outlier ? 'outlier' : row.review ?? null,
    wealth: judged.wealth,
    allowance: budget.allowance,
    played_at: playedS,
    clean_obj: clean ? key : row.clean_obj ?? null,
    clean_seq: clean ? seq : row.clean_seq ?? null,
    level_seen: lv.level,
    level_at: lv.at,
    law_sig: sig,
  };
  // the first thing the law found, for the tab to name the piece to its player (only when it holds)
  const why = held === 'law' && lawHolds ? (({ code, t }) => ({ code, t: t ?? null }))(lawFindings[0]) : null;
  return { steps: [verdictWrite(db, char, row, set), ...after], set, clean, law, copies: ledger.copies, over: budget.over, why };
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
    + ' played_at = ?10, clean_obj = ?11, clean_seq = ?12, level_seen = ?13, level_at = ?14, law_sig = ?15, wealth_v = ?17'
    + ' WHERE id = ?1 AND judge_rev = ?16',
  ).bind(char, s.judged_seq, s.held, s.held_at, s.strikes, s.review, s.wealth, row.allowance ?? null, s.allowance, s.played_at,
    s.clean_obj, s.clean_seq, s.level_seen, s.level_at, s.law_sig, row.judge_rev ?? 0, WEALTH_VERSION);
}
