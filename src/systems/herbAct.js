// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Active player involvement") - HERBALISM'S
// ACTS, as machines the host feeds a frame at a time (bible/06-Systems/
// Professions-Arc.md 5, 22; FORAGE0 14.6). Pure: the host hands in the
// frame's time, whether Interact is held, whether attack was pressed,
// the view's yaw and pitch and the player's place; the machine answers
// where the act stands and, at its end, the report the harvest carries.
//
//   hand   - a common herb: kneel, and it comes up in HERB_ACT.commonS.
//            No moment: its report is plain.
//   steady - an uncommon or rare herb with the Sickle: hold Interact for
//            HERB_ACT.steadyS while the meter fills. Turning the view
//            more than the window (3 degrees x the band x Botanist's
//            +50%) or moving a quarter of a metre BRUISES it; letting go
//            before the end cancels, nothing lost. Unbruised is clean.
//   basket - the Basket's search: three finds glint one after another,
//            each for BASKET_ACT.glintS x the band (masterGlintS at
//            Master), a short gap between; attack while one glints finds
//            it. The report is the finds.
//
// GENTLE ACTS (a setting, accessibility - PROF0 5.1): every act completes
// at a plain result - no bruise, no clean bonus; the Basket's search runs
// its course with nothing to press, and finds are plain.
//
// Every act is cancelled by Esc (the host's `cancel`), nothing lost: the
// node stands, no tool wears, no harvest is asked.
// ═══════════════════════════════════════════════════════════════════
import { HERB_ACT, BASKET_ACT } from '../net/professionLaw.js';
import { firmActMult } from './firmamentLive.js';   // FIRM1: the Firmament's steadier hand (act.herbalism)

/** Where the Basket's glints show in the act's panel: five spots among the leaves, fractions of the panel. */
export const BASKET_SPOTS = Object.freeze([
  Object.freeze([0.18, 0.32]), Object.freeze([0.5, 0.2]), Object.freeze([0.82, 0.36]), Object.freeze([0.3, 0.72]), Object.freeze([0.7, 0.7]),
]);
/** The shortest angle between two headings, degrees. */
const turnDeg = (a, b) => { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return Math.abs(d); };

/**
 * @param {{ kind: 'hand'|'steady'|'basket', band?: number, botanist?: boolean, master?: boolean, gentle?: boolean,
 *   rng?: () => number }} o `band` the attribute band's widening (professionLaw actBand)
 */
export function createHerbAct({ kind, band = 1, botanist = false, master = false, gentle = false, rng = Math.random }) {
  // FIRM1 (bible/06-Systems/Firmament.md): the Firmament's `act.herbalism` widens (or a keystone's price narrows) both
  // windows - the steady hand's turn and the Basket's glint - 1 with no tree in force
  const sky = firmActMult('herbalism');
  const window = HERB_ACT.steadyDeg * band * (botanist ? HERB_ACT.botanist : 1) * sky;
  const glint = (master ? BASKET_ACT.masterGlintS : BASKET_ACT.glintS) * band * sky;
  const length = kind === 'hand' ? HERB_ACT.commonS : kind === 'steady' ? HERB_ACT.steadyS : BASKET_ACT.finds * (glint + BASKET_ACT.gapS) + BASKET_ACT.gapS;
  const st = {
    kind, t: 0, length, done: false, cancelled: false, bruised: false, window, gentle,   // AUDIT HERB-CURSOR C2: said, as the mine's and the trace's are
    /** the Basket: which find, where it glints, how long it has shown, and what was found */
    find: 0, spot: -1, showing: 0, finds: 0, gap: BASKET_ACT.gapS, glint, early: false, hits: /** @type {boolean[]} */ ([]),
    /** the steady hand's start: the view and the place it measures from */
    from: /** @type {{ yaw: number, pitch: number, x: number, z: number }|null} */ (null),
  };
  const pickSpot = () => { let s; do s = Math.floor(rng() * BASKET_SPOTS.length); while (s === st.spot && BASKET_SPOTS.length > 1); return s; };

  return {
    state: st,
    /** How far the act has come, 0 to 1. */
    get progress() { return Math.min(1, st.t / st.length); },
    /**
     * One frame. `held` - Interact held; `attack` - attack pressed this frame (an edge); `view` - `{ yaw, pitch }` in
     * degrees and `pos` - `{ x, z }` in metres, for the steady hand. Answers the act's state.
     * @param {number} dt seconds
     * @param {{ held?: boolean, attack?: boolean, view?: { yaw: number, pitch: number }, pos?: { x: number, z: number } }} input
     */
    tick(dt, { held = true, attack = false, view = { yaw: 0, pitch: 0 }, pos = { x: 0, z: 0 } } = {}) {
      if (st.done || st.cancelled) return st;
      const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
      if (kind === 'steady') {
        if (!held) { st.cancelled = true; return st; }   // let go before the end: nothing lost
        st.from ??= { yaw: view.yaw, pitch: view.pitch, x: pos.x, z: pos.z };
        const turned = Math.max(turnDeg(view.yaw, st.from.yaw), Math.abs(view.pitch - st.from.pitch));
        const moved = Math.hypot(pos.x - st.from.x, pos.z - st.from.z);
        if (!gentle && (turned > st.window || moved > HERB_ACT.moveM)) st.bruised = true;
      }
      if (kind === 'basket') {
        if (st.spot < 0) {
          // AUDIT 29 C9: a press before the glint shows spends it - mashing attack found every glint without a look
          if (!gentle && attack && st.find < BASKET_ACT.finds) st.early = true;
          st.gap -= step;
          if (st.gap <= 0 && st.find < BASKET_ACT.finds) { st.spot = pickSpot(); st.showing = 0; }
        } else {
          st.showing += step;
          const hit = !gentle && attack && !st.early;
          if (hit || st.early || st.showing >= st.glint) {
            st.hits.push(hit);
            if (hit) st.finds++;
            st.find++;
            st.spot = -1;
            st.gap = BASKET_ACT.gapS;
            st.early = false;
          }
        }
        st.t += step;
        if (st.find >= BASKET_ACT.finds && st.spot < 0) st.done = true;
        return st;
      }
      st.t += step;
      if (st.t >= st.length) st.done = true;
      return st;
    },
    /** Esc: the act ends with nothing lost. */
    cancel() { if (!st.done) st.cancelled = true; return st; },
    /** The report a finished act's harvest carries (professions.js reads it, bounded): the steady hand's
     *  `{ clean, bruised }`, the Basket's `{ finds }`, a hand's plain. Null before the end or after a cancel. */
    report() {
      if (!st.done || st.cancelled) return null;
      if (kind === 'basket') return { finds: gentle ? 0 : st.finds };
      if (kind === 'steady') return { clean: !gentle && !st.bruised, bruised: !gentle && st.bruised };
      return { clean: false, bruised: false };
    },
  };
}
