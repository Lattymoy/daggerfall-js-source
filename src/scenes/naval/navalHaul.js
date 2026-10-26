// @ts-check
// BOARD-MAGNET (2026-10-26, the owner: "a prompt to board should show within range and properly magnitize to the other
// ship"; bible/03-World/Naval-Refit.md BOARD-MAGNET and its AUDIT) - THE GRAPPLES' HAUL, wired by the naval host
// (scenes/naval/navalHost.js startBoarding, stepBoarding, wayScale, brake - HOST-SPLIT: the module the host wires, as
// fishHost.js is) over the boarding's own law (systems/naval/navalBoarding.js berthPose, drawHaul, haulBrake). The port's
// own - Daggerfall has no sea.
//
//   THE BERTH  where she lies alongside a boat as it lies now (`berth`): her side of its keel and her heading (its own or
//              its reciprocal) chosen once, where she lay when the lines went over (`start` keeps them, `lie`), and the
//              rest reckoned each frame from the boat as it lies then.
//   THE HAUL   each frame she is drawn toward that berth (`step`, navalBoarding.js drawHaul) - out to its lane and along
//              it, kept clear of the boat's hull - until she lies in it.
//   MY WAY     at my helm the grapples strike my canvas and take my way off over the haul (`start`, haulBrake - on Come
//              Sail Away's `brake` seam, CSA_BRAKE_MAX at most), and nothing drives her on while it runs (`hauling`, the
//              host's wayScale) - from rest as from way: thrown at rest, the oars no longer gather way under the haul.

import { berthPose, berthHull, haulBrake } from '../../systems/naval/navalBoarding.js';
import { CSA_BRAKE_MAX } from '../../systems/comeSailAway/comeSailAway.js';

/**
 * @param {{ csa: () => any, myBoat: () => any, boatPose: (boat: any) => { position: number[], rotation: number[], velocity: number[] },
 *   yawOfRot: (rot: number[]) => number }} deps
 */
export function createNavalHaul({ csa, myBoat, boatPose, yawOfRot }) {
  /** A boat as the haul reads it: where it lies, its heading, its hull. */
  const anchorOf = (boat) => { const p = boatPose(boat); return { pos: p.position, yaw: yawOfRot(p.rotation), hull: boat.hull }; };
  /** Her berth beside `boat` as it lies now - `at` where she lies (her side and heading, unless `lie` keeps them). */
  const berth = (boat, at, hull, lie = null) => { const a = anchorOf(boat); return berthPose(berthHull(a.pos, a.yaw, a.hull), berthHull(at.pos, at.yaw, hull), lie); };
  /** Whether boarding `b` hauls a ship alongside the boat at my helm. */
  const hauling = (b) => !!b && b.phase === 'grapple' && !!b.boat && b.boat === myBoat();
  return {
    berth: (boat, at, hull) => berth(boat, at, hull),
    /** The grapples thrown (`b` from navalBoarding.js createBoarding, its `boat` set; `to` her first berth): her side and
     *  heading kept; at my helm my canvas struck and my way's brake set. */
    start(b, to) {
      b.lie = to.side ? { side: to.side, same: to.same } : null;
      if (!b.boat || b.boat !== myBoat()) return;
      const v = boatPose(b.boat).velocity;
      b.brake = haulBrake(Math.hypot(v[0], v[2]), CSA_BRAKE_MAX);
      if (csa()?.state?.sailPosition > 0) csa().LowerSails?.();
    },
    /** A frame of the haul: her pose, drawn toward her berth beside `b.boat` as it lies now (none - over her rail on foot -
     *  she lies where she is). */
    step(b, hull, dt) {
      if (!b.boat?.GameObject) return b.haul(b.to, null, dt);
      return b.haul(berth(b.boat, b.from, hull, b.lie), anchorOf(b.boat), dt);
    },
    hauling,
    /** Come Sail Away's `brake` while `b` hauls beside my helm (0: her own rate). */
    brake: (b) => (hauling(b) ? b.brake ?? 0 : 0),
  };
}
