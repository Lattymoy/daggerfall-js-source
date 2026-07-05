// Static poses for the neutral rig. A pose sets per-limb joint angles
// in the SAME sagittal transform the walk cycle uses (viewer
// animateTarget): each limb rotates about its root pivot (hip /
// shoulder) by `sw` after bending about its mid joint (knee / elbow)
// by `bd`. Signs: sw NEGATIVE swings the limb FORWARD (+z) for arms
// and legs alike; bd POSITIVE is the anatomical bend - knee folds the
// shin BACK, elbow folds the forearm FORWARD. Radians.
//
// Arms in a pose HOLD their angles during the walk cycle (the figure
// keeps its grip while moving); legs use the pose stance at rest and
// hand over to the gait when walking.

export const POSES = {
  // 1H melee ready: weapon arm folded up so the fist sits beside the
  // chest (blade would point up-forward), off arm forward as a low
  // guard, feet in a small ready stagger (left lead, trail knee soft).
  melee1H: {
    armR: { sw: -0.38, bd: 1.95 },
    armL: { sw: -0.35, bd: 1.25 },
    legL: { sw: -0.13, bd: 0.10 },
    legR: { sw: 0.11, bd: 0.18 },
  },
};
