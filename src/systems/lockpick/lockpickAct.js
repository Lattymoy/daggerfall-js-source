// @ts-check
// LOCKPICK (2026-10-26, the owner: "I want to build a detailed lock picking minigame and introduce a lockpick item";
// bible/06-Systems/Lockpicking.md): THE TUMBLERS, as a machine the lock's window feeds a frame at a time - pure, the
// gathering acts' shape (systems/herbAct.js): the window hands in the frame's time and the player's presses; the machine
// answers where every pin stands and what each press did.
//
// A LOCK is a row of pins (lockpickLaw.js pinsFor) that bind in the lock's own order (bindingOrder). The pick sits under
// one pin at a time (`move`, `aim`). A press LIFTS a pin at rest:
//   - the BINDING pin (the next in the order) rises to the shear line (riseS, each lift its own - riseJitter), HANGS
//     there for the lock's window (setWindowS - DFU's chance, the Agility band) and falls back (fallS);
//   - any other pin is FREE: it springs up and back at once (springS) and never hangs - the feel that tells it apart -
//     and forcing it may snap the pick (freeRisk of a slip's chance), so probing for the binding pin costs something.
// A press while a pin moves is a SET: the binding pin pressed while it hangs (graceS either side) SETS - it stays up and
// the next pin binds; a SPOOL (spoolPins) only false-sets the first time, clunking back to rest to be set again. Pressed
// anywhere else - rising, falling, a free pin mid-bounce - it SLIPS: the pick may snap (slipBreakChance); if it holds,
// the last pin set drops; if it snaps, every set pin drops and the next pick starts over. Every pin set opens the lock.
// THE AUTO ATTEMPT is DFU's own roll (autoOpens): it opens, or the pick snaps.
//
// The machine counts what snapped (`broken`); the pack's picks are the window's (ui/lockpickDoor.js), which takes one
// for every snap and ends the attempt when none are left. Nothing here reads the clock, the dice or the page: `rng` is
// handed in.
import { LOCKPICK_ACT, pinsFor, spoolsFor, setWindowS, slipBreakChance, bindingOrder, spoolPins, sensesBinding, autoOpens } from './lockpickLaw.js';

/** A pin's phases: at rest, lifted (rising, hanging at the shear line, falling), bouncing free, set. */
export const PIN = Object.freeze({ rest: 'rest', rise: 'rise', hang: 'hang', fall: 'fall', spring: 'spring', set: 'set' });

/**
 * @param {{ lock: number, chance: number, seed: number, band?: number, skill?: number, exterior?: boolean,
 *   rng?: () => number }} o `chance` DFU's for this lock at this site (5..95); `band` the Agility band (lockBand);
 *   `skill` the live Lockpicking; `exterior` a building's front door (the Auto attempt's roll is its own)
 */
export function createLockpickAct({ lock, chance, seed, band = 1, skill = 0, exterior = false, rng = Math.random }) {
  const A = LOCKPICK_ACT;
  const n = pinsFor(lock);
  const order = bindingOrder(n, seed);
  const spool = spoolPins(n, spoolsFor(lock), seed);
  const window = setWindowS(chance, band);
  const breakChance = slipBreakChance(chance);
  /** @typedef {{ phase: string, t: number, y: number, rise: number, spool: boolean, falseSet: boolean }} LockPin */
  /** @type {LockPin[]} - each pin's phase and its time in it, its place (0 at rest, 1 at the shear line), its lift's rise */
  const pins = Array.from({ length: n }, (_, i) => ({ phase: /** @type {string} */ (PIN.rest), t: 0, y: 0, rise: /** @type {number} */ (A.riseS), spool: spool[i], falseSet: false }));
  const st = {
    lock, chance, n, order, pins, window, breakChance, exterior,
    sense: sensesBinding(skill),
    /** where the pick stands, a pin's index */
    pos: 0,
    /** how many pins are set - the binding pin is order[next] */
    next: 0,
    open: false, done: false,
    /** picks snapped this attempt, slips survived, pins set (true sets only) */
    broken: 0, slips: 0, sets: 0,
    /** the last press's answer (`press`, `auto`) and its pin, for the window's draw and its ear */
    last: /** @type {string|null} */ (null), lastPin: -1,
  };
  /** The binding pin's index, or -1 once the lock is open. */
  const binding = () => (st.next < n ? order[st.next] : -1);
  /** Every pin set dropped back to rest, the order begun again - a snapped pick, a fresh one in. */
  const dropAll = () => {
    for (const p of pins) { p.phase = PIN.rest; p.t = 0; p.y = 0; p.falseSet = false; }
    st.next = 0;
  };
  /** The pin's place, 0 at rest to 1 at the shear line, by its phase and its time in it. */
  const place = (p) => {
    switch (p.phase) {
      case PIN.rise: return Math.min(1, p.t / p.rise);
      case PIN.hang: case PIN.set: return 1;
      case PIN.fall: return Math.max(0, 1 - p.t / A.fallS);
      case PIN.spring: { const h = p.t / A.springS; return Math.max(0, h < 0.5 ? h * 2 : 2 - h * 2) * 0.85; }
      default: return 0;
    }
  };
  /** Whether a press now sets pin `p` - it hangs, or stands within the grace of the hang either side. */
  const inWindow = (p) => p.phase === PIN.hang || (p.phase === PIN.rise && p.t >= p.rise - A.graceS) || (p.phase === PIN.fall && p.t <= A.graceS);
  const answer = (what, i) => { st.last = what; st.lastPin = i; return what; };
  /** A slip: the pick may snap - every set pin down; if it holds, the last pin set drops, and the tension it lost takes
   *  any spool's false set with it. */
  const slip = (i) => {
    const moving = pins[i];
    moving.phase = PIN.rest; moving.t = 0; moving.y = 0;
    if (rng() < breakChance) { st.broken++; dropAll(); return answer('break', i); }
    st.slips++;
    if (st.next > 0) {
      const back = pins[order[st.next - 1]];
      back.phase = PIN.rest; back.t = 0; back.y = 0;
      st.next--;
    }
    for (const q of pins) if (q.phase !== PIN.set) q.falseSet = false;
    return answer('slip', i);
  };

  return {
    state: st,
    /** The binding pin now (-1 once open) - the window marks it for a hand that senses it (`state.sense`). */
    get binding() { return binding(); },
    /** One frame: every moving pin goes on - a binding pin past its hang falls, a fallen one rests, a free one lands. */
    tick(dt) {
      if (st.done) return st;
      const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
      for (const p of pins) {
        if (p.phase === PIN.rest || p.phase === PIN.set) { p.y = place(p); continue; }
        p.t += step;
        if (p.phase === PIN.rise && p.t >= p.rise) { p.t -= p.rise; p.phase = PIN.hang; }
        if (p.phase === PIN.hang && p.t >= st.window) { p.t -= st.window; p.phase = PIN.fall; }
        if (p.phase === PIN.fall && p.t >= A.fallS) { p.t = 0; p.phase = PIN.rest; }
        if (p.phase === PIN.spring && p.t >= A.springS) { p.t = 0; p.phase = PIN.rest; }
        p.y = place(p);
      }
      return st;
    },
    /** The pick moved `d` pins along (held to the lock). */
    move(d) { if (!st.done) st.pos = Math.max(0, Math.min(n - 1, st.pos + Math.sign(Number(d) || 0))); return st.pos; },
    /** The pick put under pin `i`. */
    aim(i) { if (!st.done && Number.isInteger(i) && i >= 0 && i < n) st.pos = i; return st.pos; },
    /**
     * THE PRESS under the pick: 'lift' (the binding pin lifted), 'springy' (a free pin bounced), 'set', 'false-set' (a
     * spool), 'open' (the last pin set), 'already' (a set pin), 'slip' or 'break' - or null once the attempt is over.
     */
    press() {
      if (st.done) return null;
      const i = st.pos, p = pins[i];
      if (p.phase === PIN.set) return answer('already', i);
      if (p.phase === PIN.rest) {
        if (i === binding()) { p.phase = PIN.rise; p.t = 0; p.rise = A.riseS * (1 + A.riseJitter * (2 * rng() - 1)); return answer('lift', i); }
        if (rng() < breakChance * A.freeRisk) { st.broken++; dropAll(); return answer('break', i); }   // a free pin forced
        p.phase = PIN.spring; p.t = 0;
        return answer('springy', i);
      }
      if (i !== binding() || !inWindow(p)) return slip(i);
      if (p.spool && !p.falseSet) {
        p.falseSet = true; p.phase = PIN.rest; p.t = 0; p.y = 0;
        return answer('false-set', i);
      }
      p.phase = PIN.set; p.t = 0; p.y = 1;
      st.next++; st.sets++;
      if (st.next >= n) { st.open = true; st.done = true; return answer('open', i); }
      return answer('set', i);
    },
    /** THE AUTO ATTEMPT - DFU's roll: 'open', or 'break' (every set pin down, a fresh pick next). */
    auto() {
      if (st.done) return null;
      if (autoOpens(st.chance, rng(), st.exterior)) {
        for (const p of pins) { p.phase = PIN.set; p.t = 0; p.y = 1; }
        st.next = n; st.open = true; st.done = true;
        return answer('open', -1);
      }
      st.broken++; dropAll();
      return answer('break', -1);
    },
    /** The attempt over with nothing more to do - the picks gone, or the player walked away. */
    cancel() { st.done = true; return st; },
    /** What the attempt came to: open or not, picks snapped, pins set, slips survived. */
    report() { return { open: st.open, broken: st.broken, sets: st.sets, slips: st.slips }; },
  };
}
