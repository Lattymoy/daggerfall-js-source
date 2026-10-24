// @ts-check
// PROF10 (2026-10-02) - THE FACET, Jewelcrafting's act at the jeweller's bench (bible/06-Systems/Professions-Arc.md 9.4:
// "The facet: a slow turn stopped where the gem catches the light (a 10-degree window)"). A piece is cut in recipeLaw
// facetCount facets (three; a gemmed piece five), each a slow turn of the stone from 0 degrees at FACET_ACT.degPerS toward
// the light, which stands at a bearing the bench draws for that facet (FACET_ACT.lightLo to lightHi - never where the turn
// begins). The press STOPS the turn: within the window about the light (recipeLaw facetWindow - the rank's and the
// band's) the facet is caught; anywhere else it is lost. A stone let turn FACET_ACT.turns times round loses its facet by
// itself, and the next is begun. Every facet caught is a clean act. Pure - a machine the bench's section of the Stores
// page ticks and presses (ui/professions/profPages.js), as the pan is the fire's (systems/panAct.js).
//
// The act is the client's, so it may be lied about: its report moves the service by its bounded step only (5.1's honest
// bound - one quality step; the service reads `clean` and nothing else). Gentle acts cut plain: no window is shown, every
// stop counts, none is caught, and no act is clean.
import { FACET_ACT, bearingGap } from '../net/recipeLaw.js';
import { PRESS_LEAD_MAX_S } from './stitchAct.js';

/**
 * @param {{ facets?: number, windowDeg?: number, gentle?: boolean, rng?: () => number }} [opts] `facets` the piece's
 *   (recipeLaw facetCount), `windowDeg` the window's whole width (recipeLaw facetWindow - the rank's and the band's)
 */
export function createFacetAct({ facets = FACET_ACT.facets, windowDeg = FACET_ACT.windowDeg, gentle = false, rng = Math.random } = {}) {
  /** The light's bearing for a facet, by one throw of the dice: FACET_ACT.lightLo to lightHi. */
  const light = () => FACET_ACT.lightLo + (FACET_ACT.lightHi - FACET_ACT.lightLo) * Math.max(0, Math.min(1, Number(rng()) || 0));
  const st = {
    kind: 'facet', t: 0, need: Math.max(1, facets | 0), half: Math.max(0, Number(windowDeg) || 0) / 2,
    /** the facet being cut: how far the stone has turned (degrees, from 0 - past 360 the turn goes round), the light */
    turned: 0, light: light(),
    /** each facet as it ended: true caught, false lost; `passed` how many the turn let go round by itself */
    cuts: /** @type {boolean[]} */ ([]), passed: 0, lastAt: -Infinity, done: false,
  };
  /** The stone's bearing now, 0 to 360. */
  const bearing = (turned) => ((turned % 360) + 360) % 360;
  const inWindow = (turned) => !gentle && bearingGap(bearing(turned), st.light) <= st.half;
  /** The facet ended - `ok` whether caught - and the next begun (the piece ends at its last). */
  const end = (ok, at) => {
    st.cuts.push(ok);
    st.lastAt = at;
    if (st.cuts.length >= st.need) { st.done = true; return; }
    st.turned = 0;
    st.light = light();
  };
  return {
    state: st,
    /** The stone's bearing now, degrees. */
    get bearing() { return bearing(st.turned); },
    /** Whether the stone stands in the light now (never under Gentle acts). */
    get inWindow() { return !st.done && inWindow(st.turned); },
    tick(dt) {
      if (st.done || !Number.isFinite(dt) || dt <= 0) return;
      st.t += dt;
      st.turned += FACET_ACT.degPerS * dt;
      if (st.turned >= 360 * FACET_ACT.turns) { st.passed++; end(false, st.t); }   // let go round: the facet lost, the next begun
    },
    /** The turn stopped: true caught, false lost, null too soon after the last stop or the act over. `lead` - the press's
     *  own moment past the act's last frame (AUDIT 32 P1's law, the stitch's): the bearing it is judged at is the one then. */
    stop(lead = 0) {
      const l = Math.max(0, Math.min(PRESS_LEAD_MAX_S, Number(lead) || 0));
      const at = st.t + l;
      if (st.done || at - st.lastAt < FACET_ACT.gapS) return null;
      const ok = inWindow(st.turned + FACET_ACT.degPerS * l);
      end(ok, at);
      return ok;
    },
    /** Let go (Esc, or the page shut): no more facets; an act short of its facets is never clean. */
    cancel() { st.done = true; },
    /** The act's report: its facets, the caught ones, the ones let go round, and whether it was clean - every facet cut,
     *  every one caught (a Gentle act's are none). */
    report() {
      const hits = st.cuts.filter(Boolean).length;
      return { facets: st.cuts.length, hits, passed: st.passed, clean: st.cuts.length >= st.need && hits === st.cuts.length };
    },
  };
}
