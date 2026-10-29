// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 5.2): THE LITANY SEEN AND HEARD - each plate's state off the ledger (the
// order shown a plate a second, the lit ones lit as they are worked), a step said once as a plate is stepped onto (a
// player standing on a plate as its order plays again says nothing until they step off and on), and the chime that
// rises with each numeral (the Examination's, ui/eliteGates/egBeats.js EG_RUNE_CHIME). Not a DFU member (Ledger A: DELVE II).
import { DP, LITANY_SHOW_STEP_MS } from '../../net/delve/delveLaw.js';
import { SOUND } from '../../systems/soundClips.js';

/** A plate's look: dark (waiting), shown (its turn in the order played), lit (worked), wrong (the one stepped on wrongly). */
export const PLATE_LOOK = Object.freeze({ dark: 0, shown: 1, lit: 2, wrong: 3 });
/** The wrong plate's look lasts this long (ms, the encounter clock's). */
export const PLATE_WRONG_MS = 700;

/** Each plate's look, off the ledger (null: none started) at the encounter clock `ec`; `wrong` the last wrong plate and
 *  when, or null; filled into `out` (kept by the caller). Pure but for `out`. @param {any} led @param {number} k
 *  @param {{ j: number, at: number }|null} wrong @param {number[]} [out] */
export function plateLooks(led, k, wrong = null, out = []) {
  out.length = k;
  out.fill(PLATE_LOOK.dark);
  if (!led) return out;
  if (led.p === DP.won) return out.fill(PLATE_LOOK.lit);
  if (led.p === DP.show) {
    const step = Math.floor((led.ec - led.sh) / LITANY_SHOW_STEP_MS);
    if (step >= 0 && step < led.order.length) out[led.order[step]] = PLATE_LOOK.shown;
  } else if (led.p === DP.work) {
    for (let n = 0; n < led.next; n++) out[led.order[n]] = PLATE_LOOK.lit;
  }
  if (wrong && led.ec - wrong.at < PLATE_WRONG_MS && wrong.j >= 0 && wrong.j < k) out[wrong.j] = PLATE_LOOK.wrong;
  return out;
}

/** The plate the order shows now (-1 none), for its chime once a step. Pure. */
export function shownPlate(led) {
  if (!led || led.p !== DP.show) return -1;
  const step = Math.floor((led.ec - led.sh) / LITANY_SHOW_STEP_MS);
  return step >= 0 && step < led.order.length ? led.order[step] : -1;
}

/** A step said once: `at(plate)` the plate stood on this frame (-1 none) - answers it the frame it is stepped onto, else -1. */
export function createPlateSteps() {
  let last = -1;
  return {
    at(plate) { const j = Number.isInteger(plate) ? plate : -1, said = j >= 0 && j !== last ? j : -1; last = j; return said; },
    reset() { last = -1; },
  };
}

/** THE SOUNDS: a plate's chime rising with its numeral (1 the first of the order), the wrong plate's drum, the ward's toll
 *  as it wakes and the fanfare of a win - Daggerfall's own clips (systems/soundClips.js). */
export const DELVE_SOUNDS = Object.freeze({
  chime: (n) => Object.freeze({ rec: SOUND.MakeItem, vol: 0.7, pitch: 0.9 + 0.12 * Math.max(0, (n | 0) - 1) }),
  wrong: Object.freeze({ rec: SOUND.SelectClassDrums, vol: 1, pitch: 0.8 }),
  wake: Object.freeze({ rec: 107, vol: 0.9, pitch: 0.75 }),   // the Examination's toll (ui/eliteGates/egBeats.js EG_BEAT_SOUNDS.toll)
  won: Object.freeze({ rec: SOUND.ArenaFanfareLevelUp, vol: 0.9, pitch: 1 }),
});
