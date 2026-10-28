// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF8 (2026-09-30, Mac: "Continue the arc") - FISHING'S ACT, the net
// (bible/06-Systems/Professions-Arc.md 5.2, 30). A pure machine, as
// herbAct.js and traceAct.js are: the gathering host ticks it with the
// Interact key's level and the attack's edge, and reads its state for the
// meter (ui/professions/profHud.js) and its report for the harvest.
//
//   WIND   hold E: the net winds 0.3-1.5 s; let go and it flies 3-12 m.
//   WAIT   5-30 s - halved in the first and last daylight hours, doubled
//          in a storm (the host's clock).
//   TUG    the floats dip: press E (or attack) inside 600 ms (an
//          Angler's +40%). Missed, the net comes in plain.
//   HAUL   the net's weight wanders the bar; hold E to raise the tension
//          band, let go to let it fall. The weight kept inside fills the
//          meter - a full net, the clean act - within 20 s; 2 s outside,
//          in all, and it comes in plain.
//
// A missed moment never fails the haul - it gives less (PROF0 5.1). Gentle
// acts: no moment at all - the net comes in plain after its wait.
// ═══════════════════════════════════════════════════════════════════

import { FISH_ACT, fishBand, tugWindow, waitMult, throwM } from '../net/professionLaw.js';
import { firmActMult } from './firmamentLive.js';   // FIRM1: the Firmament's patient line (act.fishing)

/** How long the net is in the air, seconds. */
export const FLY_S = 0.6;
/** A wind held past this is thrown at its longest - a key forgotten down is no act held forever. */
export const WIND_HOLD_S = 4;

/**
 * @param {{ rank?: number, band?: number, angler?: boolean, hour?: number, storm?: boolean, gentle?: boolean,
 *   rng?: () => number, schoolAt?: ((m: number) => (0|1|null)) | null, onTug?: (() => void) | null }} o `band` the
 *   attribute band's widening (professionLaw actBand); `hour` the game clock's hour at the cast; `schoolAt(m)` - which
 *   of the day's schools a cast of `m` metres lands in, or null; `onTug` - the floats dip (the host's buzz, TI2)
 */
export function createFishAct({ rank = 0, band = 1, angler = false, hour = 12, storm = false, gentle = false, rng = Math.random, schoolAt = null, onTug = null }) {
  const width = Math.min(0.9, fishBand(rank) * band);
  const st = {
    kind: /** @type {'fish'} */ ('fish'),
    phase: /** @type {'wind'|'fly'|'wait'|'tug'|'haul'} */ ('wind'),
    t: 0, done: false, cancelled: false,
    /** the wind held, 0 to 1 of its range, and the throw it made (m) */
    wind: 0, windS: 0, throwM: 0,
    /** the wait's length and what is left of it; the tug's window and what is left of it */
    waitS: 0, waitLeft: 0, tugS: tugWindow(angler) * firmActMult('fishing') * band, tugLeft: 0, tugged: false,   // FIRM1: the tug's window, the Firmament's longer; AUDIT GATHER F6: and the net's attribute band's, as FORAGE0 14.4-14.5 has it ("within 600 ms x the band")
    /** the haul: the weight's place and speed, the band's centre and width, the meter's fill and the slip, 0 to 1 */
    weight: 0.5, speed: 0, bandAt: 0.2, bandW: width, fill: 0, slip: 0, haulS: 0, slipped: false,
    /** the school the cast landed in, or null */
    school: /** @type {0|1|null} */ (null),
    wasHeld: true,
  };
  /** The net comes in: a full net (clean) or a plain one. */
  const land = (clean, why = null) => { st.done = true; st.clean = clean; st.why = why; };
  st.clean = false;
  st.why = /** @type {string|null} */ (null);

  function throwNet() {
    st.throwM = throwM(st.windS);
    st.school = schoolAt ? schoolAt(st.throwM) : null;
    st.phase = 'fly';
    st.t = 0;
  }

  return {
    state: st,
    /** How far the act has come, 0 to 1 - the phase's own share. */
    get progress() {
      if (st.phase === 'wind') return st.wind;
      if (st.phase === 'wait') return st.waitS ? 1 - st.waitLeft / st.waitS : 0;
      if (st.phase === 'tug') return st.tugS ? 1 - st.tugLeft / st.tugS : 0;
      if (st.phase === 'haul') return st.fill;
      return 0;
    },
    /**
     * One frame. `held` - Interact held; `attack` - attack pressed this frame (an edge).
     * @param {number} dt seconds
     * @param {{ held?: boolean, attack?: boolean }} input
     */
    tick(dt, { held = false, attack = false } = {}) {
      if (st.done || st.cancelled) return st;
      const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
      const pressed = attack || (held && !st.wasHeld);   // an edge of E, or of attack
      st.wasHeld = held;
      if (st.phase === 'wind') {
        if (held && st.windS < WIND_HOLD_S) {
          st.windS += step;
          st.wind = Math.max(0, Math.min(1, (st.windS - FISH_ACT.windMinS) / (FISH_ACT.windMaxS - FISH_ACT.windMinS)));
        } else throwNet();
        return st;
      }
      if (st.phase === 'fly') {
        st.t += step;
        if (st.t >= FLY_S) {
          st.phase = 'wait';
          st.waitS = (FISH_ACT.waitMinS + rng() * (FISH_ACT.waitMaxS - FISH_ACT.waitMinS)) * waitMult(hour, storm);
          st.waitLeft = st.waitS;
        }
        return st;
      }
      if (st.phase === 'wait') {
        st.waitLeft -= step;
        if (st.waitLeft <= 0) {
          if (gentle) { land(false); return st; }   // no moment: the net comes in plain
          st.phase = 'tug';
          st.tugLeft = st.tugS;
          try { onTug?.(); } catch { /* the host's own */ }
        }
        return st;
      }
      if (st.phase === 'tug') {
        if (pressed) {
          st.tugged = true;
          st.phase = 'haul';
          st.bandAt = Math.max(0, st.weight - width / 2);
          return st;
        }
        st.tugLeft -= step;
        if (st.tugLeft <= 0) land(false, 'missed');
        return st;
      }
      // THE HAUL: the weight wanders (a speed that drifts, turned at the bar's ends), the band follows the hand
      st.haulS += step;
      st.speed += (rng() * 2 - 1) * FISH_ACT.drift * 4 * step;
      st.speed = Math.max(-FISH_ACT.drift, Math.min(FISH_ACT.drift, st.speed));
      st.weight += st.speed * step;
      if (st.weight < 0) { st.weight = 0; st.speed = Math.abs(st.speed); }
      if (st.weight > 1) { st.weight = 1; st.speed = -Math.abs(st.speed); }
      st.bandAt += (held ? FISH_ACT.rise : -FISH_ACT.fall) * step;
      st.bandAt = Math.max(0, Math.min(1 - width, st.bandAt));
      const inside = st.weight >= st.bandAt && st.weight <= st.bandAt + width;
      if (inside) st.fill = Math.min(1, st.fill + step / FISH_ACT.fillS);
      else st.slip = Math.min(1, st.slip + step / FISH_ACT.slipS);
      if (st.fill >= 1) land(true);
      else if (st.slip >= 1) { st.slipped = true; land(false, 'slipped'); }
      else if (st.haulS >= FISH_ACT.haulS) land(false, 'slow');
      return st;
    },
    /** Esc: the act ends with nothing lost. */
    cancel() { if (!st.done) st.cancelled = true; return st; },
    /** The report a finished act's harvest carries (professions.js netOf reads it, bounded): a full net `clean`, the
     *  school it landed in; the tug's and the slip's words for the toast. Null before the end or after a cancel. */
    report() {
      if (!st.done || st.cancelled) return null;
      return {
        clean: !gentle && st.clean === true, tugged: st.tugged, slipped: st.slipped, why: st.why,
        ...(st.school === 0 || st.school === 1 ? { school: st.school } : {}), throwM: Math.round(st.throwM * 10) / 10,
      };
    },
  };
}
