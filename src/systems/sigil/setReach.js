// @ts-check
// SET-CATCHUP (POWER-CEILING, 2026-10-27, bible/11-Multiplayer/Sigil-Sets.md section 5; the player: "Add more horizontal
// progression please!"): A SET'S REACH. Mac's "grow together" stands - a set's stage is its lowest worn piece's - but a
// piece swapped in fresh no longer costs the whole climb again: a piece below the highest stage the set has stood at for
// this character drinks CATCH_UP_MULT times the XP until it reaches that stage, and never faster past it. The reach is
// the second-best rank among the set's WORN pieces (two worn at a stage are the set standing there), kept here
// at every drink so a piece sold later does not take it away. It rides the character's save (a mod record).

import { SIGIL_STAGES, SIGIL_SET_IDS } from './sigil.js';
import { registerModSaveData } from '../modSaveData.js';

/** How much faster a piece below its set's reach drinks. */
export const CATCH_UP_MULT = 3;
/** The pieces at one stage that make the set stand there - its first tier's count (sigilSets.js SET_TIERS[0]). */
export const REACH_PIECES = 2;
const STAGE_MAX = SIGIL_STAGES.length - 1;

/** @type {Record<string, number>} the highest stage each set has stood at for this character */
let _reach = {};

/** A set's reach from the ranks of its pieces a character wears: the REACH_PIECES-th best, or -1 for fewer. */
export function reachOfRanks(ranks) {
  const sorted = [...ranks].filter(Number.isInteger).sort((a, b) => b - a);
  return sorted.length >= REACH_PIECES ? sorted[REACH_PIECES - 1] : -1;
}
/** The reach recorded for a set, or -1. */
export const recordedReach = (id) => _reach[id] ?? -1;
/** Record what a drink saw: each set's reach from the ranks worn (`Map<id, rank[]>`), never lowered. Answers the reach
 *  each set now has, recorded or worn. */
export function noteReach(worn) {
  /** @type {Map<string, number>} */
  const out = new Map();
  for (const id of SIGIL_SET_IDS) {
    const now = Math.max(recordedReach(id), reachOfRanks(worn.get(id) ?? []));
    if (now > recordedReach(id)) _reach[id] = now;
    if (now >= 0) out.set(id, now);
  }
  return out;
}

/** THE CATCH-UP: the XP a piece with `have` XP drinks of `xp` earned, its set's reach `reach` - CATCH_UP_MULT times while
 *  it stands below that stage's XP, the rest of the drink whole once it gets there. */
export function catchUpXp(xp, have, reach) {
  const gain = Math.max(0, Math.floor(Number(xp) || 0));
  if (!(reach > 0) || !gain) return gain;
  const to = SIGIL_STAGES[Math.min(reach, STAGE_MAX)].xp;
  const was = Math.max(0, Number(have) || 0);
  if (was >= to) return gain;
  const fast = gain * CATCH_UP_MULT;
  if (was + fast <= to) return fast;
  return to - was + Math.max(0, gain - Math.ceil((to - was) / CATCH_UP_MULT));
}

/** The save's slot (systems/modSaveData.js), under this name. */
export const SET_REACH_SAVE_VENDOR = 'SigilSetReach';
/** A record off a save: each named set's reach, a stage 0..4; anything else dropped. */
export function validReachRecord(r) {
  const m =
    r && typeof r === 'object' && r.reach && typeof r.reach === 'object' && !Array.isArray(r.reach) ? r.reach : {};
  /** @type {Record<string, number>} */
  const out = {};
  for (const id of SIGIL_SET_IDS) if (Number.isInteger(m[id]) && m[id] >= 0 && m[id] <= STAGE_MAX) out[id] = m[id];
  return out;
}
registerModSaveData(SET_REACH_SAVE_VENDOR, {
  newSaveData: () => ({ reach: {} }),
  getSaveData: () => ({ reach: { ..._reach } }),
  restoreSaveData: (r) => {
    _reach = validReachRecord(r);
  },
});

/** Tests only: forget every reach. */
export function _resetSetReachForTests() {
  _reach = {};
}
