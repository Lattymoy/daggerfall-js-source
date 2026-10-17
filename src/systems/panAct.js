// @ts-check
// PROF9 (2026-10-02) - THE PAN, Cooking's act at the fire (bible/06-Systems/Professions-Arc.md 9.4: "The fire: take the pan
// off in its window (the Skillet's is wider)"). A dish is cooked in recipeLaw panCount pans in turn (three; a feast five),
// each set on the fire cold: its heat climbs from 0 (raw) to 1 (burnt) in PAN_ACT.burnS x a pace the fire draws for that
// pan, and the pan is DONE while its heat stands in the window (recipeLaw panWindow - the rank's, the band's, and C&C's
// Skillet half again). The press takes the pan off: in the window it is done; before it raw. A pan left to burn is taken
// off burnt by the fire itself and the next goes on. Every pan done is a clean act. Pure - a machine the fire's section
// of the Stores page ticks and presses (ui/professions/profPages.js), as the chisel is the mason's bench's (systems/chiselAct.js).
//
// The act is the client's, so it may be lied about: its report moves the service by its bounded step only (5.1's honest
// bound - a dish takes no quality, so a clean pan is half again its Cooking XP; the service reads `clean` and nothing
// else). Gentle acts cook plain: no window is shown, every take counts, none is done, and no act is clean.
import { PAN_ACT } from '../net/recipeLaw.js';
import { PRESS_LEAD_MAX_S } from './stitchAct.js';

/**
 * @param {{ pans?: number, done?: readonly number[], gentle?: boolean, rng?: () => number }} [opts] `pans` the dish's
 *   (recipeLaw panCount), `done` the done band [lo, hi] (recipeLaw panWindow)
 */
export function createPanAct({ pans = PAN_ACT.pans, done = [PAN_ACT.lo, PAN_ACT.lo + PAN_ACT.w], gentle = false, rng = Math.random } = {}) {
  const lo = Number(done[0]), hi = Number(done[1]);
  /** One pan's pace, by one throw of the dice: PAN_ACT.paceLo to paceHi - the fire's own heat under it. */
  const pace = () => PAN_ACT.paceLo + (PAN_ACT.paceHi - PAN_ACT.paceLo) * Math.max(0, Math.min(1, Number(rng()) || 0));
  const st = {
    kind: 'pan', t: 0, need: Math.max(1, pans | 0), lo, hi,
    /** the pan on the fire: its heat (0 raw .. 1 burnt) and how fast it climbs, a second */
    heat: 0, rate: pace() / PAN_ACT.burnS,
    /** each pan as it came off: true done, false raw or burnt; `burnt` how many the fire took */
    takes: /** @type {boolean[]} */ ([]), burnt: 0, lastAt: -Infinity, done: false,
  };
  const inWindow = (h) => !gentle && h >= st.lo && h <= st.hi;
  /** The pan off - `ok` whether done - and the next set on cold (the dish ends at its last). */
  const off = (ok, at) => {
    st.takes.push(ok);
    st.lastAt = at;
    if (st.takes.length >= st.need) { st.done = true; return; }
    st.heat = 0;
    st.rate = pace() / PAN_ACT.burnS;
  };
  return {
    state: st,
    /** Whether the pan on the fire is done now (never under Gentle acts). */
    get inWindow() { return !st.done && inWindow(st.heat); },
    tick(dt) {
      if (st.done || !Number.isFinite(dt) || dt <= 0) return;
      st.t += dt;
      st.heat += st.rate * dt;
      if (st.heat >= 1) { st.burnt++; st.heat = 1; off(false, st.t); }   // left on the fire: burnt, and the next goes on
    },
    /** The pan taken off the fire: true done, false raw (or burnt), null too soon after the last take or the act over.
     *  `lead` - the press's own moment past the act's last frame (AUDIT 32 P1's law, the stitch's): the heat it is judged
     *  at is the heat then. */
    take(lead = 0) {
      const l = Math.max(0, Math.min(PRESS_LEAD_MAX_S, Number(lead) || 0));
      const at = st.t + l;
      if (st.done || at - st.lastAt < PAN_ACT.gapS) return null;
      const ok = inWindow(Math.min(1, st.heat + st.rate * l));
      off(ok, at);
      return ok;
    },
    /** Let go (Esc, or the page shut): no more pans; an act short of its pans is never clean. */
    cancel() { st.done = true; },
    /** The act's report: its pans, the done ones, the burnt ones, and whether it was clean - every pan taken, every one
     *  done (a Gentle act's are none). */
    report() {
      const hits = st.takes.filter(Boolean).length;
      return { pans: st.takes.length, hits, burnt: st.burnt, clean: st.takes.length >= st.need && hits === st.takes.length };
    },
  };
}
