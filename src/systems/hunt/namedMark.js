// @ts-check
// HUNTERS-MARK-II (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.4): THE NAMED MARK, THE SAME ON EVERY CLIENT. A week's
// mark is a pure function of the week and the tier (net/huntLaw.js huntMarkOf), so a peer's foe reads as one off what its
// record already carries - its kind and its traits' mask (net/wire.js validFoeRecord `t`, `bt`). A mate sees the hunter's
// beast under its name, and the wire carries nothing new.
import { BOUNTY_TIERS } from '../bounty/bountyBoard.js';
import { huntMarkOf, huntMarkSeed, huntWeekAt, HUNT_MARK_NAMES } from '../../net/huntLaw.js';
import { rollBossTraits, bossTraitMask } from '../bossTraits.js';
import { eliteRng } from '../eliteFoes.js';
import { trophyTitle } from './trophies.js';

/** A named mark's boss traits: two, as a raid's leader carries. */
export const HUNT_MARK_TRAITS = 2;
/** The week's two traits for a tier, the same on every client. */
export const huntMarkTraits = (/** @type {number} */ week, /** @type {number} */ tier) =>
  rollBossTraits(HUNT_MARK_TRAITS, eliteRng(huntMarkSeed(week, tier)));

/**
 * The week's named mark a peer's leader is - `{ week, tier, foe, nameIndex, title }` - read off its kind and its traits'
 * mask, or null. This week's first, then last week's: a mark stood before the Turning still stands after it.
 * @param {number} mobileType @param {unknown} mask the record's `bt` @param {number} nowMs the event clock's wall instant
 */
export function huntMarkSeen(mobileType, mask, nowMs) {
  const week = huntWeekAt(nowMs);
  for (const w of [week, week - 1]) {
    for (const [tier, row] of BOUNTY_TIERS.entries()) {
      if (!row.foes.includes(mobileType)) continue;
      const { foe, name } = huntMarkOf(w, row.min);
      if (foe !== mobileType || bossTraitMask(huntMarkTraits(w, tier)) !== mask) continue;
      const nameIndex = HUNT_MARK_NAMES.indexOf(name);
      return { week: w, tier, foe, nameIndex, title: trophyTitle(foe, nameIndex) };
    }
  }
  return null;
}
