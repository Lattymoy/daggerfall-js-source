// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF4 (2026-09-28, Mac: "Continue") - LOGGING'S ACT, the Wood-Axe at a
// tree, as a machine the host feeds a frame at a time (bible/06-Systems/
// Professions-Arc.md 5.2, 25; FORAGE0 14.4). Pure: the host hands in the
// frame's time and whether attack was pressed this frame; the machine
// answers where the act stands - the ring the meter draws - and, at its
// end, the report the harvest carries.
//
//   THE CHOPS. A tree takes chopsFor(tier) - 5 at tiers 1-2, 6 at 3-4, 8
//   at 5-6, a Lumberjack two fewer and three at least. Attack chops, one
//   a swing (CHOP_ACT.swingS); a press inside a swing is nothing.
//   THE RING. A circle shrinks from CHOP_ACT.ringFrom times the notch's
//   radius onto it over CHOP_ACT.ringS and on past it to ringTo, then
//   starts again; it starts again after every chop too. A chop while it
//   stands within the band of the notch (professionLaw ringBand: 12% of
//   its radius at Novice to 20% at Master, x the Wood-Axe's band) is a
//   CLEAN CUT, worth two chops.
//   THE FINISH. Every chop a Clean Cut is the clean act (+50% XP); each
//   Clean Cut a Heartwood chance, the service's (the report's `cuts`,
//   bounded there by cutsMax). The tree creaks at half its chops.
//
// GENTLE ACTS (a setting, accessibility - PROF0 5.1): every chop plain,
// no ring to catch, no clean act, no Heartwood.
//
// Esc (the host's `cancel`) ends it, nothing lost: the tree stands, no
// tool wears, no harvest is asked.
//
// GATHER-FEEL (2026-10-13): A CHOP LANDS ON ITS HIT FRAME. The count is
// the press's; the blow the hand draws lands MELEE_HIT_SHARE into its
// swing (`landsIn`), and the swing runs out after the act's end, so the
// last chop is drawn landing (scenes/gatherHost.js's follow-through) and
// heard as it lands (systems/gatherSounds.js).
// AUDIT GATHER-FEEL LANDING: and the machine counts its blows landed
// (`landed`) as its swing passes the hit frame - the one clock the host
// feels a blow on and the ear says it on, true in a frame long enough to
// land one blow and begin the next swing.
// ═══════════════════════════════════════════════════════════════════
import { CHOP_ACT, chopsFor, ringBand } from '../net/professionLaw.js';
import { MELEE_HIT_SHARE } from '../characters/weaponStates.js';

/** AUDIT GATHER-FEEL LANDING: the swing still to run once its blow has landed (s) - the hit frame, MELEE_HIT_SHARE in. */
const CHOP_REST_S = CHOP_ACT.swingS * (1 - MELEE_HIT_SHARE);

/** The ring's radius, in the notch's radii, `t` seconds into a pass: ringFrom down to ringTo, one speed. */
export const ringAt = (t) => CHOP_ACT.ringFrom - ((CHOP_ACT.ringFrom - 1) * t) / CHOP_ACT.ringS;
/** How long a pass lasts before the ring starts again: from ringFrom to ringTo. */
export const RING_PASS_S = (CHOP_ACT.ringS * (CHOP_ACT.ringFrom - CHOP_ACT.ringTo)) / (CHOP_ACT.ringFrom - 1);

/**
 * @param {{ tier: number, rank?: number, band?: number, lumberjack?: boolean, gentle?: boolean }} o `band` the
 *   Wood-Axe's attribute band's widening (professionLaw woodAxeBand)
 */
export function createChopAct({ tier, rank = 0, band = 1, lumberjack = false, gentle = false }) {
  const need = chopsFor(tier, lumberjack);
  const st = {
    kind: 'chop', need, points: 0, chops: 0, cuts: 0, done: false, cancelled: false, gentle,
    /** the ring's pass so far, and the band a Clean Cut stands in (a share of the notch's radius) */
    ring: 0, band: gentle ? 0 : ringBand(rank, band),
    /** the swing under way, and the last chop - whether it was clean (the meter flashes it); the blows landed */
    swing: 0, last: /** @type {null|'clean'|'plain'} */ (null), landed: 0,
    /** the tree has creaked (half its chops) - the host plays it once */
    creaked: false,
  };

  return {
    state: st,
    /** How far the act has come, 0 to 1 - the chops' count against the tree's. */
    get progress() { return Math.min(1, st.points / st.need); },
    /** The ring's radius now, in the notch's radii. */
    get ring() { return ringAt(st.ring); },
    /** Whether the ring stands in the band now - a chop now would be clean. */
    get inBand() { return !gentle && Math.abs(ringAt(st.ring) - 1) <= st.band; },
    /** The swing's phase, 0 (none) to 1 (just struck) - the hand draws the chop's frames by it. */
    get swing() { return st.swing > 0 ? st.swing / CHOP_ACT.swingS : 0; },
    /** GATHER-FEEL: seconds until the swing under way lands its blow - 0 once it has, or with none under way. */
    get landsIn() { return Math.max(0, st.swing - CHOP_REST_S); },
    /** One frame. `attack` - attack pressed this frame (an edge). @param {number} dt @param {{ attack?: boolean }} input */
    tick(dt, { attack = false } = {}) {
      const aloft = st.swing > CHOP_REST_S;
      st.swing = Math.max(0, st.swing - dt);   // GATHER-FEEL: past the end too - the last swing runs out, its blow lands
      if (aloft && !(st.swing > CHOP_REST_S)) st.landed++;   // AUDIT GATHER-FEEL LANDING: counted before a press can begin the next swing
      if (st.done || st.cancelled) return;
      if (Number.isFinite(dt) && dt > 0) { st.ring += dt; if (st.ring >= RING_PASS_S) st.ring -= RING_PASS_S; }
      if (!attack || st.swing > 0) return;
      st.swing = CHOP_ACT.swingS;
      const clean = this.inBand;
      st.chops++;
      st.points += clean ? 2 : 1;
      if (clean) st.cuts++;
      st.last = clean ? 'clean' : 'plain';
      st.ring = 0;   // the ring starts again after a chop
      if (!st.creaked && st.points >= st.need * CHOP_ACT.creakAt) st.creaked = true;
      if (st.points >= st.need) st.done = true;
    },
    /** Esc: ended, nothing lost. */
    cancel() { st.cancelled = true; },
    /** The act's report, once it is done: `{ chops, cuts, clean }` - clean when every chop was a Clean Cut. */
    report() {
      if (!st.done) return null;
      return { chops: st.chops, cuts: st.cuts, clean: !gentle && st.cuts === st.chops };
    },
  };
}
