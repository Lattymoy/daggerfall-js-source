// @ts-check
// PROF7 (2026-09-29, Mac: "Do it") - THE STITCH, Outfitting's act at the loom (bible/06-Systems/Professions-Arc.md 9.4,
// 29): "presses on a beat, eight in a row". The needle's beat comes every STITCH_ACT.beatS; a stitch pressed while the
// beat stands in the band (recipeLaw STITCH_ACT.bandW, centred on it, x the attribute band) is on the beat. Pure - a
// machine the loom's page ticks and presses (ui/professions/profPages.js), as the heat is the anvil's (systems/heatAct.js).
//
// The act is the client's, so it may be lied about: its report moves the service's roll by one quality step at most
// (5.1's honest bound - the service reads `clean` and nothing else). Gentle acts stitch plain: every stitch counts, none
// is on the beat, and no act is clean.
import { STITCH_ACT, beatAt, onBeat } from '../net/recipeLaw.js';

/** AUDIT 32 P1: the most a press is judged past the act's last frame - a frame and a half at the slowest the loops run. */
export const PRESS_LEAD_MAX_S = 0.1;

/**
 * @param {{ band?: number, gentle?: boolean }} [opts] `band` the attribute band's widening (recipeLaw stitchBand)
 */
export function createStitchAct({ band = 1, gentle = false } = {}) {
  const st = { kind: 'stitch', t: 0, w: STITCH_ACT.bandW * band, stitches: /** @type {boolean[]} */ ([]), lastAt: -Infinity, done: false };
  return {
    state: st,
    /** Where the beat stands now, 0 to 1 - the beat at 0. */
    get beat() { return beatAt(st.t); },
    /** Whether a stitch now would be on the beat. */
    get onBeat() { return onBeat(beatAt(st.t), st.w); },
    tick(dt) { if (!st.done && Number.isFinite(dt) && dt > 0) st.t += dt; },
    /** A stitch: true on the beat, false off it, null when it is too soon after the last or the act is over. The
     *  eighth stitch ends the act. `lead` - AUDIT 32 P1: the press's own moment, seconds past the act's last frame (the
     *  event's time; a tenth of a second at most) - a press was judged at the frame before it. */
    stitch(lead = 0) {
      const at = st.t + Math.max(0, Math.min(PRESS_LEAD_MAX_S, Number(lead) || 0));
      if (st.done || at - st.lastAt < STITCH_ACT.gapS) return null;
      const hit = !gentle && onBeat(beatAt(at), st.w);
      st.stitches.push(hit);
      st.lastAt = at;
      if (st.stitches.length >= STITCH_ACT.stitches) st.done = true;
      return hit;
    },
    /** Let go (Esc, or the page shut): no more stitches; an act of fewer than eight is never clean. */
    cancel() { st.done = true; },
    /** The act's report: its stitches, those on the beat, and whether it was clean - eight, every one on the beat. */
    report() {
      const hits = st.stitches.filter(Boolean).length;
      return { stitches: st.stitches.length, hits, clean: !gentle && st.stitches.length >= STITCH_ACT.stitches && hits === st.stitches.length };
    },
  };
}
