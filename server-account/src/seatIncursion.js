// @ts-check
// AUDIT-SEATS (2026-10-01, Mac: "We need to do a comprehensive audit on everything and finish the not done"): A DAEDRIC
// INCURSION'S MARKS (bible/11-Multiplayer/Seats-Arc.md 9.3: "gate kills in the kingdom's regions give double influence,
// and double Marks (PROF0 10.5)"). SEASON1 part two doubled the influence and left the Marks unpaid, because a kill's
// region is the claiming client's word until three claims agree - and a faucet is not doubled on one account's word.
// So the second half is paid at the Turning that settles the week, once the day's region IS agreed
// (seatInfluence.js agreedGateRegions): every account whose claim named the agreed region, in a land whose week rolled
// a Daedric Incursion, and whose gate Marks that day were struck (marks.js gateStrikeStatement's line), is minted the
// same again - once (its own `incursion:<day>` rid), and only where its balance has the room (a full purse is not
// paid; nothing is refused).
import { tideAt } from '../../src/net/tideLaw.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import { gateStrikeRid } from './marks.js';

/** An Incursion's second half's rid, a gate day's. */
export const incursionRid = (gameDay) => `incursion:${gameDay}`;

/**
 * THE STATEMENTS the settle of `week` runs for the Incursion's Marks - `agreed` each gate day of the week to its agreed
 * region (agreedGateRegions), `counted` whether a Season counts the week (a Tide rolls only then).
 * @param {any} db @param {{ week: number, agreed: Map<number, number>, counted: boolean, nowS: number }} o
 */
export function incursionStatements(db, { week, agreed, counted, nowS }) {
  const out = [];
  for (const [day, region] of agreed) {
    if (tideAt(week, region, counted) !== 'daedra') continue;
    out.push(
      db
        .prepare(
          `INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'account', k.account, 'gate-incursion', l.amount, ?3, ?4, k.account, 'Daedric Incursion', ?5
      FROM gate_kills k JOIN marks_ledger l ON l.actor = k.account AND l.rid = ?6 AND l.kind = 'gate'
      WHERE k.day = ?1 AND k.region = ?2
        AND NOT EXISTS (SELECT 1 FROM marks_ledger x WHERE x.actor = k.account AND x.rid = ?5)
        AND COALESCE((SELECT balance FROM marks WHERE account = k.account), 0) + l.amount <= ?7`,
        )
        .bind(day, region, utcDay(nowS), nowS, incursionRid(day), gateStrikeRid(day), MARKS_MAX),
    );
  }
  return out;
}
