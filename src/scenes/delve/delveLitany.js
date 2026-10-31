// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 5.2): THE LITANY SEEN AND HEARD - each plate's state off the ledger (the
// order shown a plate a second, the lit ones lit as they are worked) and the chime that rises with each numeral (the
// Examination's, ui/eliteGates/egBeats.js EG_RUNE_CHIME). The law judges a step (LITANY-STAND). Not a DFU member (Ledger A:
// DELVE II).
import { DP, LITANY_SHOW_STEP_MS } from '../../net/delve/delveLaw.js';
import { SOUND } from '../../systems/soundClips.js';
import { CRYSTAL_CLIPS } from '../../world/gate/gateBoss.js';

/** A plate's look: dark (waiting), shown (its turn in the order played), lit (worked), wrong (the one stepped on wrongly). */
export const PLATE_LOOK = Object.freeze({ dark: 0, shown: 1, lit: 2, wrong: 3 });
/** The wrong plate's look lasts this long (ms, on the clock its caller reads). */
export const PLATE_WRONG_MS = 700;

/** Each plate's look, off the ledger (null: none started) at the encounter clock `ec`; `wrong` the last wrong plate and
 *  when, or null, on clock `t` (the ledger's own by default; the host's, which a room's state never re-anchors - AUDIT
 *  DLV3 8); filled into `out` (kept by the caller). Pure but for `out`. @param {any} led @param {number} k
 *  @param {{ j: number, at: number }|null} wrong @param {number[]} [out] @param {number} [t] */
export function plateLooks(led, k, wrong = null, out = [], t = led?.ec ?? 0) {
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
  if (wrong && t >= wrong.at && t - wrong.at < PLATE_WRONG_MS && wrong.j >= 0 && wrong.j < k)
    out[wrong.j] = PLATE_LOOK.wrong;
  return out;
}

/** The plate the order shows now (-1 none), for its chime once a step. Pure. */
export function shownPlate(led) {
  if (!led || led.p !== DP.show) return -1;
  const step = Math.floor((led.ec - led.sh) / LITANY_SHOW_STEP_MS);
  return step >= 0 && step < led.order.length ? led.order[step] : -1;
}

/** THE SOUNDS: a plate's chime rising with its numeral (1 the first of the order), the wrong plate's drum, the ward's toll
 *  as it wakes, the fanfare of a win and the pieces' own - Daggerfall's clips (systems/soundClips.js). */
export const DELVE_SOUNDS = Object.freeze({
  chime: (n) => Object.freeze({ rec: SOUND.MakeItem, vol: 0.7, pitch: 0.9 + 0.12 * Math.max(0, (n | 0) - 1) }),
  wrong: Object.freeze({ rec: SOUND.SelectClassDrums, vol: 1, pitch: 0.8 }),
  wake: Object.freeze({ rec: 107, vol: 0.9, pitch: 0.75 }), // the Examination's toll (ui/eliteGates/egBeats.js EG_BEAT_SOUNDS.toll)
  won: Object.freeze({ rec: SOUND.ArenaFanfareLevelUp, vol: 0.9, pitch: 1 }),
  // DLV4: the pieces - a source or seal rising and breaking (the Court's crystals' own, world/gate/gateBoss.js
  // CRYSTAL_CLIPS), a brazier catching, a weight set down
  rise: Object.freeze({ rec: CRYSTAL_CLIPS.rise, vol: 0.8, pitch: 1.2 }),
  shatter: Object.freeze({ rec: CRYSTAL_CLIPS.shatter, vol: 0.9, pitch: 1.3 }),
  ignite: Object.freeze({ rec: SOUND.Ignite, vol: 0.9, pitch: 1 }),
  thud: Object.freeze({ rec: SOUND.BodyFall, vol: 0.8, pitch: 1.4 }),
});
