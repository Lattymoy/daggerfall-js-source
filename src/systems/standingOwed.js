// @ts-check
// STANDING-WORDS (2026-10-16, bible/01-Overview/bugs/Field-Bugs-2026-10-15g.md; Mac, asked of the guild system's words: "Standing
// changes shown"): WHAT THE ROLL STILL OWES, AS THE PAGE LAST HEARD IT. Online the Roll credits a guild faction at most
// ROLL_GAIN_DAY_MAX a UTC day and owes the rest (net/npcChapterLaw.js rollCredit); its answer carries the owed
// (`roll.owed`, server-account/src/npcRoll.js viewOf), and nothing on the page kept it - the pace's line said "the rest
// will follow" once, and then nothing said how much. The Roll's tracker (net/npcRollTracker.js) writes it here at every
// adoption and clears it when it stops; the Standing page and the hall's line read it. A leaf: no imports, so a window
// may read it without the online stack. Offline nothing writes it, and every faction owes 0.

/** @type {Record<number, number>} */
let owed = {};

/** The Roll's owed, `{ [faction]: n }` (the positive alone), as its last answer gave it - or nothing (stopped, offline). */
export function setStandingOwed(/** @type {unknown} */ map) {
  /** @type {Record<number, number>} */
  const out = {};
  if (map && typeof map === 'object') {
    for (const [k, v] of Object.entries(map)) if (Number.isSafeInteger(v) && /** @type {number} */ (v) > 0) out[Number(k)] = /** @type {number} */ (v);
  }
  owed = out;
}

/** What the Roll still owes `faction` - 0 offline, before its first word, or when nothing is owed. */
export const standingOwedOf = (/** @type {number} */ faction) => owed[faction] ?? 0;
