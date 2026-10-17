// @ts-check
// EG-ZF (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 27.6, THE RECAP): THE
// RECAP'S NUMBERS, AS THE DIRECTOR COUNTS THEM -
//   THE DAMAGE CHART AT A LORD'S FALL ("At every lord's fall the damage chart shows as the gate's does ... with its Healed
//     column"): each member's part in a Court, kept on the hall's fight (`F.tl`, laid at a Court's wake and gone with it) -
//     all they dealt in it, the lord's part of it, the blows that landed, the heaviest, how often they fell there, what
//     they healed in others there - said with the Redoubt (`rd`'s `dm`, net/eliteGates/egBrain.js redoubt) and with an end that came
//     at the lord's fall (a Rehearsal's, `end`'s `dm`);
//   THE SHARE AND THE HEALING PER MEMBER ("the company: each member's share, healing, falls, recall and how they left"):
//     each member's damage and healing over the whole breach (`m.dt`, `m.ht` on the member's record), said on every `st`
//     and on the `end` (`ds`) - the recap reads the share off them.
//
// EVERY NUMBER IS THE RELAY'S OWN COUNT, never a screen's: a blow as net/eliteGates/egBrain.js egBlow believed it (`got`, after the
// gate's hand and purse and the lord's weight), a heal as its receiver said it (the healer's peer id named by the room)
// and believed within the receiver's heal bucket - the gate's GATE-HEAL law and its constants (net/gate/gateBrain.js healRef,
// HEAL_REFILL_S, HEAL_DEPTH_X). A figure for the round-up alone: it buys nothing - no receipt, no share of a Redoubt's
// earners (net/eliteGates/egBrain.js keeps its own `dc`), no threat.
//
// Pure: the breach's record in, the wire's compact tables out. Not a DFU member. Ledger A (ELITE-GATES).
import { healRef, HEAL_REFILL_S, HEAL_DEPTH_X } from '../gate/gateBrain.js';

/** The most rows a chart or a tally carries: the company's eight (net/wire.js EG_COMPANY_MAX). */
export const EG_TALLY_ROWS = 8;
/** A Court's part, a member's: `[dealt, on the lord, blows landed, heaviest, falls, healed in others]`. */
const T_D = 0, T_L = 1, T_H = 2, T_B = 3, T_F = 4, T_HL = 5;
const rowOf = (F, sub) => ((F.tl[sub] ??= [0, 0, 0, 0, 0, 0]));
const whole = (v) => Math.max(0, Math.round(v || 0));

/** A hall woken: a Court's fight lays its chart (empty - a member's row is made by their first blow, heal or fall). */
export function egTallyWake(F, kind) {
  if (F && kind === 'court') F.tl = {};
}
/**
 * A blow the director believed (`got` of it, on a lord's body when `lord`): the member's damage over the breach, and in a
 * Court its row of the chart. `F` the hall's fight (a Court's carries `tl`).
 * @param {any} m the member's record @param {any} F @param {string} sub @param {number} got @param {boolean} lord
 */
export function egTallyBlow(m, F, sub, got, lord) {
  if (!m || !(got > 0) || !Number.isFinite(got)) return;
  m.dt = (m.dt ?? 0) + got;
  if (!F?.tl) return;
  const r = rowOf(F, sub);
  r[T_D] += got;
  if (lord) r[T_L] += got;
  r[T_H] += 1;
  r[T_B] = Math.max(r[T_B], got);
}
/** A member fell in the hall: counted on a Court's chart. */
export function egTallyFall(F, sub) {
  if (F?.tl) rowOf(F, sub)[T_F] += 1;
}
/**
 * WHAT COMPANIONS' SPELLS HEALED IN `sub` - `pairs` `[healer's account, points]` (the room's reading of the healers' peer
 * ids; '' for an id it could not name) - credited to each healer: a member of the breach who entered it, never `sub`
 * itself. Believed within `sub`'s heal bucket (a whole reference health refilled over HEAL_REFILL_S, HEAL_DEPTH_X deep -
 * the gate's), from a member still in it (the fallen too: a heal before a fall may be said after it - the gate's law).
 * Answers the points believed.
 * @param {any} B @param {string} sub @param {Array<[string, number]>} pairs @param {number} now
 */
export function egTallyHeal(B, sub, pairs, now) {
  const m = B?.mem?.[sub];
  if (!m || !m.in || m.forsaken || B.end || !Array.isArray(pairs)) return 0;
  const ref = healRef(m.lv), depth = HEAL_DEPTH_X * ref;
  m.hb = Math.min(depth, (Number.isFinite(m.hb) ? m.hb : depth) + (Math.max(0, now - (Number.isFinite(m.hbAt) ? m.hbAt : now)) / 1000) * (ref / HEAL_REFILL_S));
  m.hbAt = now;
  let all = 0;
  for (const [by, n] of pairs) {
    const q = B.mem[by];
    if (!q || !q.in || by === sub || !Number.isFinite(n) || !(n > 0)) continue;
    const got = Math.max(0, Math.min(n, m.hb));
    if (!(got > 0)) continue;
    m.hb -= got;
    q.ht = (q.ht ?? 0) + got;
    if (B.F?.tl) rowOf(B.F, by)[T_HL] += got;
    all += got;
  }
  return all;
}
/**
 * THE COURT'S CHART at its lord's fall (the wire's `dm`): a row for every member with a part in it - a blow, a heal, a fall
 * - and every member standing in it at the fall, most dealt first (ties in the company's order), at most EG_TALLY_ROWS:
 * `[sub, level, dealt, on the lord, blows, heaviest, falls, healed]`, whole numbers (the lord's part and the heaviest are
 * parts of the whole, summed and rounded alike, so never past it - the wire holds them to it). Empty outside a Court.
 * @param {any} B
 */
export function egChartOf(B) {
  const F = B?.F;
  if (!F?.tl) return [];
  const order = B.co.map((c) => c.sub);
  const subs = order.filter((s) => B.mem[s] && (F.tl[s] || (B.mem[s].in && B.mem[s].alive && !B.mem[s].home)));
  return subs.map((s) => {
    const r = F.tl[s] ?? [0, 0, 0, 0, 0, 0], d = whole(r[T_D]);
    return [s, Math.max(1, B.mem[s].lv | 0), d, whole(r[T_L]), r[T_H] | 0, whole(r[T_B]), r[T_F] | 0, whole(r[T_HL])];
  }).sort((a, b) => b[2] - a[2] || order.indexOf(a[0]) - order.indexOf(b[0])).slice(0, EG_TALLY_ROWS);
}
/** EACH MEMBER'S PART IN THE BREACH (the wire's `ds`): every entrant in the company's order, `[sub, dealt, healed]`, whole
 *  numbers. */
export function egTalliesOf(B) {
  return (B?.co ?? []).filter((c) => B.mem[c.sub]?.in).slice(0, EG_TALLY_ROWS).map((c) => [c.sub, whole(B.mem[c.sub].dt), whole(B.mem[c.sub].ht)]);
}
