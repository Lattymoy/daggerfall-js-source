// @ts-check
// PROF3 (2026-09-28, Mac: "Lets keep moving") - THE HEAT, Smithing's act at the anvil (bible/06-Systems/Professions-Arc.md
// 9.4, 24): the ingot's glow rises and falls; strike three times while it is in the band. Pure - a machine the anvil's
// page ticks and strikes (ui/professions/profPages.js), as the Pick-Axe's glint is the mine host's (systems/mineAct.js).
//
// The act is the client's, so it may be lied about: its report moves the service's roll by one quality step at most
// (5.1's honest bound - the service reads `clean` and nothing else). Gentle acts (the setting) strike plain: every
// strike counts, none is a hit, and no act is clean.
import { HEAT_ACT, heatWindow, glowAt } from '../net/recipeLaw.js';
import { PRESS_LEAD_MAX_S } from './stitchAct.js';

/**
 * @param {{ band?: number, gentle?: boolean }} [opts] `band` the attribute band's widening (recipeLaw heatBand)
 */
export function createHeatAct({ band = 1, gentle = false } = {}) {
  const [lo, hi] = heatWindow(band);
  const st = { kind: 'heat', t: 0, lo, hi, strikes: /** @type {boolean[]} */ ([]), lastAt: -Infinity, done: false };
  return {
    state: st,
    /** The glow now, 0 cold to 1 white. */
    get glow() { return glowAt(st.t); },
    /** Whether the glow stands in the band now. */
    get inBand() { const g = glowAt(st.t); return g >= st.lo && g <= st.hi; },
    tick(dt) { if (!st.done && Number.isFinite(dt) && dt > 0) st.t += dt; },
    /** A strike: true on the band, false off it, null when it is too soon after the last (a hammer's fall) or the act is
     *  over. The third strike ends the act. `lead` - AUDIT 32 P1: the press's own moment past the act's last frame, as
     *  the stitch's (systems/stitchAct.js PRESS_LEAD_MAX_S). */
    strike(lead = 0) {
      const at = st.t + Math.max(0, Math.min(PRESS_LEAD_MAX_S, Number(lead) || 0));
      if (st.done || at - st.lastAt < HEAT_ACT.gapS) return null;
      const g = glowAt(at);
      const hit = !gentle && g >= st.lo && g <= st.hi;
      st.strikes.push(hit);
      st.lastAt = at;
      if (st.strikes.length >= HEAT_ACT.strikes) st.done = true;
      return hit;
    },
    /** Let go (Esc, or the page shut): no more strikes; an act of fewer than three is never clean. */
    cancel() { st.done = true; },
    /** The act's report: its strikes, its hits, and whether it was clean - three strikes, every one on the band. */
    report() {
      const hits = st.strikes.filter(Boolean).length;
      return { strikes: st.strikes.length, hits, clean: !gentle && st.strikes.length >= HEAT_ACT.strikes && hits === st.strikes.length };
    },
  };
}
