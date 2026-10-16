// @ts-check
// PROF11 (2026-10-01) - THE CHISEL, Masonry's act at the mason's bench (bible/06-Systems/Professions-Arc.md 9.4: "strikes
// on marked lines that the glint's rule moves"). The stone is scored with CHISEL_ACT.lines lines; one is MARKED at a time,
// for chiselMarkS (1.2 s, 2.0 s at Master, x the band) and then the mark moves to another line - and it moves after every
// strike too: the Pick-Axe's glint's rule (systems/mineAct.js), a line for a point. The chisel is set on a line (the
// pointer's press names one; the arrows move it; the digits name one) and a strike lands there: on the marked line it is
// true. A cut or a mix takes four strikes, a carving seven (recipeLaw chiselStrikes); every one true is a clean act. Pure
// - a machine the bench's page ticks and strikes (ui/professions/profPages.js), as the heat is the anvil's (systems/heatAct.js).
//
// The act is the client's, so it may be lied about: its report moves the service by its bounded step only (5.1's honest
// bound - a carving's one quality step; a cut's or a mix's half again of its XP, the Stores keeping no quality - the
// service reads `clean` and nothing else). Gentle acts strike plain: no line is marked, every strike counts, none is true,
// and no act is clean.
import { CHISEL_ACT } from '../net/recipeLaw.js';
import { PRESS_LEAD_MAX_S } from './stitchAct.js';

/**
 * @param {{ strikes?: number, markS?: number, gentle?: boolean, rng?: () => number }} [opts] `strikes` the work's
 *   (recipeLaw chiselStrikes), `markS` how long a mark stands (recipeLaw chiselMarkS - the rank's and the band's)
 */
export function createChiselAct({ strikes = CHISEL_ACT.strikes, markS = CHISEL_ACT.markS, gentle = false, rng = Math.random } = {}) {
  const lines = CHISEL_ACT.lines;
  /** Another line than `not` (any, for none), by one throw of the dice - the glint's moveGlint, never a second throw:
   *  the lines but `not`, evenly. */
  const other = (not) => {
    const u = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
    if (not < 0) return Math.floor(u * lines);
    const g = Math.floor(u * (lines - 1));
    return g >= not ? g + 1 : g;
  };
  const st = {
    kind: 'chisel', t: 0, lines, need: Math.max(1, strikes | 0), markS,
    /** the marked line (-1 under Gentle acts), the one it moves to next, and how long it stands yet */
    mark: -1, next: -1, markLeft: markS,
    /** the line the chisel is set on - the middle one first */
    at: Math.floor(lines / 2),
    strikes: /** @type {boolean[]} */ ([]), lastAt: -Infinity, done: false,
  };
  /** The mark moved on from `from` - a line other than it, and the one after that drawn now (so a press past the
   *  mark's end is judged against the line it moved to). */
  const moveMark = (from) => {
    if (gentle) return;
    st.mark = other(from);
    st.next = other(st.mark);
    st.markLeft = st.markS;
  };
  moveMark(-1);
  /** @param {number} i */
  function aim(i) { if (!st.done && Number.isInteger(i)) st.at = Math.max(0, Math.min(lines - 1, i)); }
  return {
    state: st,
    /** The marked line now, or -1 (Gentle acts). */
    get mark() { return st.mark; },
    /** Whether the chisel is set on the marked line now. */
    get onMark() { return !gentle && st.mark >= 0 && st.at === st.mark; },
    tick(dt) {
      if (st.done || !Number.isFinite(dt) || dt <= 0) return;
      st.t += dt;
      if (gentle) return;
      st.markLeft -= dt;
      while (st.markLeft <= 0) { const left = st.markLeft; st.mark = st.next; st.next = other(st.mark); st.markLeft = left + st.markS; }
    },
    /** Set the chisel on line `i` (the pointer's, a digit's) - clamped to the stone. */
    aim,
    /** Move the chisel `d` lines (the arrows). */
    move(d) { if (Number.isInteger(d)) aim(st.at + d); },
    /** A strike where the chisel is set: true on the marked line, false off it, null when it is too soon after the last
     *  (the mallet's fall) or the act is over. `lead` - the press's own moment past the act's last frame (AUDIT 32 P1's
     *  law, the stitch's): a press after the mark's end is judged against the line it moved to. The last strike ends the
     *  act; any other moves the mark (the glint's rule). */
    strike(lead = 0) {
      const l = Math.max(0, Math.min(PRESS_LEAD_MAX_S, Number(lead) || 0));
      const at = st.t + l;
      if (st.done || at - st.lastAt < CHISEL_ACT.gapS) return null;
      const marked = l >= st.markLeft ? st.next : st.mark;
      const hit = st.at === marked;   // Gentle acts mark no line (-1, and their mark never ends): never true
      st.strikes.push(hit);
      st.lastAt = at;
      if (st.strikes.length >= st.need) st.done = true;
      else moveMark(marked);
      return hit;
    },
    /** Let go (Esc, or the page shut): no more strikes; an act short of its strikes is never clean. */
    cancel() { st.done = true; },
    /** The act's report: its strikes, the true ones, and whether it was clean - every strike made, every one true (a
     *  Gentle act's are none). */
    report() {
      const hits = st.strikes.filter(Boolean).length;
      return { strikes: st.strikes.length, hits, clean: st.strikes.length >= st.need && hits === st.strikes.length };
    },
  };
}
