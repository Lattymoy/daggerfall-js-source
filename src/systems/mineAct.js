// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - MINING'S ACT, the Pick-Axe at a vein or
// a boulder, as a machine the host feeds a frame at a time (bible/
// 06-Systems/Professions-Arc.md 5.2, 23; FORAGE0 14.4). Pure: the host
// hands in the frame's time, whether attack was pressed this frame, and
// where the crosshair points on the node's face - `aim`, the view's
// bearing from the node's centre in degrees ({ yaw, pitch }); the machine
// answers where the act stands and, at its end, the report the harvest
// carries.
//
//   THE STRIKES. A node takes strikesFor(tier) - 4 at tiers 1-2, 5 at
//   3-4, 7 at 5-6 (a boulder is tier 1). Attack strikes, one a swing
//   (MINE_ACT.swingS); a press inside a swing is nothing.
//   THE GLINT. Five points on the face (MINE_POINTS, degrees from its
//   centre); one glints for MINE_ACT.glintS x the Pick-Axe's band
//   ((INT + AGI) / 2, FORAGE0 14.4 - masterGlintS at Master), then moves;
//   it moves after every strike too. A strike with the crosshair within
//   MINE_ACT.radiusDeg of the glinting point counts DOUBLE.
//   THE FINISH. Every strike on the glint is a clean finish (the clean
//   act: +50% XP; Cut Stone at a boulder). The report is the strikes, the
//   ones on the glint, and whether the finish was clean - the service
//   bounds it (professionLaw glintsMax) and rolls a gem on each glint.
//
// GENTLE ACTS (a setting, accessibility - PROF0 5.1): every strike plain,
// no glint to find, no clean finish, no gem.
//
// Esc (the host's `cancel`) ends it, nothing lost: the node stands, no
// tool wears, no harvest is asked.
//
// GATHER-FEEL (2026-10-13): A STRIKE LANDS ON ITS HIT FRAME, as a chop
// does (systems/chopAct.js): `landsIn`, and the swing run out past the
// end so the last strike is drawn and heard landing. AUDIT GATHER-FEEL
// LANDING: and counts its blows landed (`landed`), as a chop does.
// ═══════════════════════════════════════════════════════════════════
import { MINE_ACT, strikesFor } from '../net/professionLaw.js';
import { MELEE_HIT_SHARE } from '../characters/weaponStates.js';

/** AUDIT GATHER-FEEL LANDING: the swing still to run once its blow has landed (s) - the hit frame, MELEE_HIT_SHARE in. */
const MINE_REST_S = MINE_ACT.swingS * (1 - MELEE_HIT_SHARE);

/** The five points on a node's face, degrees from its centre ([yaw, pitch]) - inside MINE_ACT's box. */
export const MINE_POINTS = Object.freeze([
  Object.freeze([0, 0]), Object.freeze([-5, 2.5]), Object.freeze([5, 2.5]), Object.freeze([-4, -2.5]), Object.freeze([4, -2.5]),
]);
/** How far the crosshair is from a point on the face, degrees. @param {{ yaw: number, pitch: number }|null} aim
 *  @param {readonly number[]} point */
export const aimOff = (aim, point) => Math.hypot((aim?.yaw ?? 99) - point[0], (aim?.pitch ?? 99) - point[1]);

/**
 * @param {{ tier: number, band?: number, master?: boolean, gentle?: boolean, rng?: () => number }} o `band` the Pick-Axe's
 *   attribute band's widening (professionLaw pickAxeBand)
 */
export function createMineAct({ tier, band = 1, master = false, gentle = false, rng = Math.random }) {
  const glintS = (master ? MINE_ACT.masterGlintS : MINE_ACT.glintS) * band;
  const need = strikesFor(tier);
  const st = {
    kind: 'mine', need, points: 0, strikes: 0, glints: 0, done: false, cancelled: false, gentle,
    /** the glinting point, how long it has left, and the swing under way; the blows landed */
    glint: -1, glintLeft: 0, glintS, swing: 0, landed: 0,
    /** the last strike: whether it was on the glint (the meter flashes it) */
    last: /** @type {null|'glint'|'plain'} */ (null),
    /** where the crosshair was on the face this frame - the meter's cursor */
    aim: /** @type {{ yaw: number, pitch: number }|null} */ (null),
  };
  const moveGlint = () => {
    if (gentle) { st.glint = -1; return; }
    let g;
    do g = Math.floor(rng() * MINE_POINTS.length); while (g === st.glint && MINE_POINTS.length > 1);
    st.glint = g;
    st.glintLeft = glintS;
  };
  moveGlint();

  return {
    state: st,
    /** How far the act has come, 0 to 1 - the strikes' count against the node's. */
    get progress() { return Math.min(1, st.points / st.need); },
    /** The swing's phase, 0 (none) to 1 (just struck) - the hand draws the strike's frames by it. */
    get swing() { return st.swing > 0 ? st.swing / MINE_ACT.swingS : 0; },
    /** GATHER-FEEL: seconds until the swing under way lands its blow - 0 once it has, or with none under way. */
    get landsIn() { return Math.max(0, st.swing - MINE_REST_S); },
    /**
     * One frame. `attack` - attack pressed this frame (an edge); `aim` - the crosshair's bearing from the node's centre,
     * degrees `{ yaw, pitch }` (yaw to the right, pitch up).
     * @param {number} dt @param {{ attack?: boolean, aim?: { yaw: number, pitch: number }|null }} input
     */
    tick(dt, { attack = false, aim = null } = {}) {
      const aloft = st.swing > MINE_REST_S;
      st.swing = Math.max(0, st.swing - dt);   // GATHER-FEEL: past the end too - the last swing runs out, its blow lands
      if (aloft && !(st.swing > MINE_REST_S)) st.landed++;   // AUDIT GATHER-FEEL LANDING: counted before a press can begin the next swing
      if (st.done || st.cancelled) return;
      st.aim = aim;
      if (!gentle) { st.glintLeft -= dt; if (st.glintLeft <= 0) moveGlint(); }
      if (!attack || st.swing > 0) return;
      st.swing = MINE_ACT.swingS;
      const onGlint = !gentle && st.glint >= 0 && aimOff(aim, MINE_POINTS[st.glint]) <= MINE_ACT.radiusDeg;
      st.strikes++;
      st.points += onGlint ? 2 : 1;
      if (onGlint) st.glints++;
      st.last = onGlint ? 'glint' : 'plain';
      if (st.points >= st.need) { st.done = true; return; }
      moveGlint();
    },
    /** Esc: ended, nothing lost. */
    cancel() { st.cancelled = true; },
    /** The act's report, once it is done: `{ strikes, glints, clean }` - clean when every strike was on the glint. */
    report() {
      if (!st.done) return null;
      return { strikes: st.strikes, glints: st.glints, clean: !gentle && st.glints === st.strikes };
    },
  };
}
