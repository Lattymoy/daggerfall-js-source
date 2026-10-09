// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT2-INT5 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE VERDICT ON A CHECKPOINT - what the
// judge found (judge.js), what the item ids say (INT4), what the budget says (INT5, budget.js), and the hold they come
// to - as the statements realm.js checkpointRealm lays in the SAME BATCH that moves the character's row to the new save.
// One batch, so a checkpoint that loses its race (a trade settling, a join) writes no verdict either, and a verdict never
// stands for a save that did not land.
//
// ═══ THE HOLD ══════════════════════════════════════════════════════
//
// `held` is the character's, and every route that hands its value to another player reads it (realm.js holdRefusal).
// Its reasons stand in an order - staff's, the law's, the duplicates', the budget's - and each clears its own way:
//   - 'law'    a checkpoint held something no honest client mints. Cleared by the next clean checkpoint - the piece
//              sold to a counter, dropped, gone - until STRIKES_FOR_REVIEW checkpoints have carried a finding; then by
//              staff alone. A false finding costs an honest player their trading until it is gone, never their game.
//   - 'dupe'   DUPES_FOR_HOLD of its pieces' ids have stood in another record at once. Staff alone.
//   - 'budget' (only once staff turn `enforce` on) a gain past the bucket. Cleared when play refills it.
//   - 'staff'  staff's own. Staff alone.
//
// ═══ THE IDS (INT4) ════════════════════════════════════════════════
//
// A valuable piece carries an id from the moment it stands in a realm character's own lists (systems/itemIds.js). The
// ledger (`item_uids`) keeps whose record held it last. A record that shows an id another record still holds CONTESTS
// it: the holder's next checkpoint settles it - without the id, the piece moved (a drop picked up, a chest, a peer's
// hands: no witness, and none needed); still with it, both records held it at once, and the id is a DUPE - no route
// moves that piece again, and the record that made the claim counts one more duplicate. An id a record holds twice is a
// dupe at once. A record that lets an id go marks it gone, and the next record to show it takes it.
// ═══════════════════════════════════════════════════════════════════

import { judgeSave, judgeProducts, STRIKES_FOR_REVIEW, JUDGE_VERSION } from './judge.js';
import { budgetConfig, bandOf, stepBudget } from './budget.js';
import { customsAllowance } from '../../src/net/realmGoldLaw.js';

/** Duplicate ids a character's records have made before its trade is held for staff. */
export const DUPES_FOR_HOLD = 3;
/** INT2's cutover (Mac: "Items judged, wealth baselined"): a character whose first judged wealth stands past this many
 *  of its level's customs allowance (realmGoldLaw.js customsAllowance) is flagged for staff - flagged, never held. */
export const OUTLIER_ALLOWANCES = 10;
/** How many ids one statement asks about - D1 binds at most 100 a statement. */
const UID_CHUNK = 90;
const HOUR_S = 3600;

/**
 * The hold a verdict comes to, from the one before it - pure. `law`: findings this checkpoint; `strikes`: law strikes
 * counted with this one; `dupes`: the character's duplicate count with this one's, `fresh` this checkpoint's new ones - a
 * piece already marked a dupe and still carried is no new one, and a hold staff lifted stays lifted until a new one comes;
 * `over`: the budget's overrun; and `enforce`: whether the budget holds.
 * @param {{ prev: string | null, law: number, strikes: number, dupes: number, fresh: number, over: number, enforce: boolean }} v
 * @returns {string | null}
 */
export function holdOf({ prev, law, strikes, dupes, fresh, over, enforce }) {
  if (prev === 'staff') return 'staff';
  if (law > 0 || (prev === 'law' && strikes >= STRIKES_FOR_REVIEW)) return 'law';
  if (prev === 'dupe' || (fresh > 0 && dupes >= DUPES_FOR_HOLD)) return 'dupe';
  if (enforce && over > 0) return 'budget';
  return null;
}

/**
 * THE DUPLICATE LEDGER'S STEP for one record: its ids against the ledger. Answers the statements and the duplicates this
 * record MADE (`dupes` - ids newly found in two records at once, or twice in this one; an id already marked a dupe and
 * carried still is none).
 * @param {any} db @param {{ player: string, char: string, seq: number, nowS: number }} at @param {string[]} uids
 */
export async function ledgerStep(db, { player, char, seq, nowS }, uids) {
  /** @type {any[]} */
  const steps = [];
  const counts = new Map();
  for (const u of uids) counts.set(u, (counts.get(u) ?? 0) + 1);
  const mine = new Set(counts.keys());
  /** @type {Set<string>} */
  const twice = new Set([...counts].filter(([, n]) => n > 1).map(([u]) => u));
  /** @type {Set<string>} */
  const dupes = new Set();
  // the ledger's rows: every id this record shows, and every id the ledger says this character holds or is contested over
  /** @type {Map<string, any>} */
  const rows = new Map();
  const ids = [...mine];
  for (let i = 0; i < ids.length; i += UID_CHUNK) {
    const chunk = ids.slice(i, i + UID_CHUNK);
    const r = await db.prepare(`SELECT uid, char_id, state, other_char FROM item_uids WHERE uid IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all();
    for (const row of r?.results ?? []) rows.set(row.uid, row);
  }
  const held = await db.prepare("SELECT uid, char_id, state, other_char FROM item_uids WHERE char_id = ? AND state IN ('held', 'contested')").bind(char).all();
  for (const row of held?.results ?? []) rows.set(row.uid, row);
  const set = (/** @type {string} */ uid, /** @type {string} */ owner, /** @type {string} */ ownerPlayer, /** @type {string} */ state, /** @type {string | null} */ other) => steps.push(
    db.prepare('INSERT INTO item_uids (uid, player, char_id, seen_seq, state, other_char, at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      + ' ON CONFLICT (uid) DO UPDATE SET player = excluded.player, char_id = excluded.char_id, seen_seq = excluded.seen_seq, state = excluded.state, other_char = excluded.other_char, at = excluded.at')
      .bind(uid, ownerPlayer, owner, seq, state, other, nowS));
  const mark = (/** @type {string} */ uid, /** @type {string} */ state, /** @type {string | null} */ other) => steps.push(
    db.prepare('UPDATE item_uids SET state = ?, other_char = ?, at = ? WHERE uid = ?').bind(state, other, nowS, uid));
  for (const uid of mine) {
    const r = rows.get(uid);
    if (r?.state === 'dupe') continue;   // marked already: no route moves it, and carrying it on is no new duplicate
    if (twice.has(uid)) { r ? mark(uid, 'dupe', char) : set(uid, char, player, 'dupe', null); dupes.add(uid); continue; }
    if (!r) { set(uid, char, player, 'held', null); continue; }
    if (r.char_id === char) {
      if (r.state === 'contested') { mark(uid, 'dupe', r.other_char); dupes.add(uid); continue; }   // still mine, and another showed it: both held it
      if (r.state === 'escrow') { mark(uid, 'dupe', char); dupes.add(uid); continue; }   // the service holds it, and so do I
      set(uid, char, player, 'held', null);   // held still, or back (gone, then picked up again)
      continue;
    }
    // another character's id
    if (r.state === 'gone') { set(uid, char, player, 'held', null); continue; }   // it moved: no witness needed
    if (r.state === 'held') { mark(uid, 'contested', char); continue; }   // its holder's next checkpoint settles it
    if (r.state === 'contested' && r.other_char === char) continue;   // already contested by me: waiting
    mark(uid, 'dupe', char); dupes.add(uid);   // a third record, or in the service's hands
  }
  // the ids this character held and lets go
  for (const r of rows.values()) {
    if (r.char_id !== char || mine.has(r.uid)) continue;
    if (r.state === 'held') mark(r.uid, 'gone', null);
    else if (r.state === 'contested') steps.push(   // it moved to the record that contested it
      db.prepare("UPDATE item_uids SET char_id = other_char, player = COALESCE((SELECT player FROM realm_characters WHERE id = item_uids.other_char), player), state = 'held', other_char = NULL, at = ? WHERE uid = ?").bind(nowS, r.uid));
  }
  return { steps, dupes: [...dupes] };
}

/**
 * THE VERDICT ON ONE CHECKPOINT: the judge's findings (the character, every item, the crafts' provenances), the id
 * ledger's step, the budget's step and the hold - as the row's new judge columns (`set`, for the UPDATE realm.js makes)
 * and the statements beside it (`steps`). `row` is the character's row as the checkpoint read it; `save` the checkpoint,
 * parsed (null for one that is not a save); `summary` the summary it carries (or the row's).
 * @param {any} ctx @param {{ player: string, char: string, seq: number, key: string }} at @param {any} row @param {any} save @param {any} summary
 */
export async function verdictOn({ db, nowS }, { player, char, seq, key }, row, save, summary) {
  const judged = judgeSave(save, summary);
  const products = judged.provenances.length ? await judgeProducts(db, judged.provenances) : [];
  const law = judged.count + products.length;
  const lawFindings = [...judged.findings, ...products].slice(0, 40);
  const ledger = await ledgerStep(db, { player, char, seq, nowS }, judged.uids);
  // the budget: the rise since the last judgement that no witness explains, against the bucket the time played filled
  const played = await db.prepare('SELECT played_s FROM players WHERE id = ?').bind(player).first();
  const playedS = Number.isSafeInteger(played?.played_s) ? played.played_s : 0;
  const config = await budgetConfig(db);
  const level = Number.isInteger(save?.level) ? save.level : 1;
  const band = bandOf(config, level);
  const first = row.wealth == null;
  const gain = first ? 0 : judged.wealth - row.wealth - (row.witnessed ?? 0);
  const dPlayed = first || row.played_at == null ? 0 : Math.max(0, playedS - row.played_at);
  const budget = stepBudget({ allowance: first ? null : row.allowance ?? null, played: dPlayed, gain, band });
  // the duplicates this character has made, this one's with them
  const fresh = ledger.dupes.length ? 1 : 0;
  const before = fresh ? await db.prepare("SELECT COUNT(*) AS n FROM realm_findings WHERE char_id = ? AND kind = 'dupe'").bind(char).first() : null;
  const dupes = (before?.n ?? 0) + fresh;
  const strikes = (row.strikes ?? 0) + (law > 0 ? 1 : 0);
  const held = holdOf({ prev: row.held ?? null, law, strikes, dupes, fresh, over: budget.over, enforce: config.enforce });
  // the cutover's outlier: a first judgement far past its level's line is flagged for staff, and holds nothing
  const outlier = first && judged.wealth > OUTLIER_ALLOWANCES * customsAllowance(level);
  const clean = law === 0 && ledger.dupes.length === 0;
  /** @type {any[]} */
  const steps = [...ledger.steps];
  const finding = (/** @type {string} */ kind, /** @type {any} */ detail) => steps.push(db.prepare(
    'INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(player, char, seq, nowS, JUDGE_VERSION, kind, JSON.stringify(detail)));
  if (law > 0) finding('law', { count: law, findings: lawFindings });
  if (ledger.dupes.length) finding('dupe', { uids: ledger.dupes.slice(0, 40) });
  // a GAIN that leaves the bucket short is found; a checkpoint that gained nothing while play pays a shortfall back finds
  // nothing new (the hold, under `enforce`, stands until it is paid)
  if (budget.over > 0 && gain > 0) finding(config.enforce ? 'budget' : 'measure', { gain, over: budget.over, level, played: dPlayed, wealth: judged.wealth });
  if (outlier) finding('outlier', { wealth: judged.wealth, level });
  // the hour's measure: what no witness explains, apart by sign, against the seconds played at this level
  if (!first) {
    const hour = Math.floor(nowS / HOUR_S) * HOUR_S;
    steps.push(db.prepare(
      'INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s, checkpoints) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      + ' ON CONFLICT (char_id, hour) DO UPDATE SET level = excluded.level, gain = gain + excluded.gain, loss = loss + excluded.loss,'
      + ' played_s = played_s + excluded.played_s, checkpoints = checkpoints + 1',
    ).bind(char, hour, player, level, Math.max(0, gain), Math.max(0, -gain), dPlayed));
  }
  return {
    set: {
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
    },
    steps,
    clean,
    law,
    dupes: ledger.dupes,
    over: budget.over,
  };
}
