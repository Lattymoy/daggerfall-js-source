// PLAYER FOOTSTEPS (FS-slice; AUDIT 23 wts-4's residue closes).
// PlayerFootsteps.cs verbatim (MIT, Daggerfall Workshop): the
// sound-SET decision and the stride machine, pure - the hosts feed
// position + motor flags and play what comes back.
//
// The classic stride: 2.5 units per step, WALKING AND RUNNING ALIKE
// ("Matched to classic"), alternating two clips at 0.7 volume
// (halved when moving less than half speed). Losing the ground
// silences the stride; regaining it lands ONE step immediately -
// except the very first grounding after a load/entry, which is
// swallowed (ignoreLostGrounding).

import { CLIMATES } from '../formats/mapsFile.js';
import { isSnowFreeClimate } from '../world/weather.js';

// SoundClips.cs - the footstep pairs + the water steps.
export const FOOTSTEP = Object.freeze({
  Stone1: 309, Stone2: 330,       // PlayerFootstepStone (dungeon + exterior paths)
  Outside1: 310, Outside2: 331,
  Snow1: 311, Snow2: 332,
  Wood1: 313, Wood2: 333,         // buildings
  Shallow: 334,                   // SplashSmallLow - shallow dungeon water
  Submerged: 346,                 // SplashSmall - swimming / exterior water
});
export const WALK_STEP_INTERVAL = 2.5;    // PlayerFootsteps.cs:27-28 - run uses the same
export const FOOTSTEP_VOLUME = 0.7;

/** The sound-set decision (PlayerFootsteps.FixedUpdate:120-208).
 *  ctx: { inside, inBuilding, winter, climateIndex, onExteriorWater,
 *  onExteriorPath, onStaticGeometry, dungeonSwimming, dungeonShallow }.
 *  Returns [clip1, clip2]. The precedence is DFU's own write order:
 *  the base set by place, then exterior water, then exterior path,
 *  then the dungeon water arms. */
export function pickFootstepSet(ctx = {}) {
  let s1, s2;
  if (!ctx.inside && !ctx.onStaticGeometry) {
    if (ctx.winter && !isSnowFreeClimate(ctx.climateIndex ?? CLIMATES.Woodlands)) {
      s1 = FOOTSTEP.Snow1; s2 = FOOTSTEP.Snow2;
    } else {
      s1 = FOOTSTEP.Outside1; s2 = FOOTSTEP.Outside2;
    }
  } else if (ctx.inBuilding) {
    s1 = FOOTSTEP.Wood1; s2 = FOOTSTEP.Wood2;
  } else {
    s1 = FOOTSTEP.Stone1; s2 = FOOTSTEP.Stone2;
  }
  if (ctx.onExteriorWater) { s1 = FOOTSTEP.Submerged; s2 = FOOTSTEP.Submerged; }
  if (ctx.onExteriorPath) { s1 = FOOTSTEP.Stone1; s2 = FOOTSTEP.Stone2; }
  if (ctx.dungeonSwimming) { s1 = FOOTSTEP.Submerged; s2 = FOOTSTEP.Submerged; }
  else if (ctx.dungeonShallow) { s1 = FOOTSTEP.Shallow; s2 = FOOTSTEP.Shallow; }
  return [s1, s2];
}

/** The stride machine. update() per frame with the live position and
 *  motor state; returns a clip id to play or null. */
export class FootstepMachine {
  constructor() {
    this.last = null;           // [x, z]
    this.distance = 0;
    this.alternate = false;
    this.lostGrounding = false;
    this.ignoreLostGrounding = true;   // swallow the first landing (load/entry)
    // AUDIT 26 F090: the dungeon water HYSTERESIS is state, so it
    // lives with the machine that already carries some. See waterStep.
    this.dungeonShallow = false;
  }

  /** PlayerFootsteps' water arms (:189, :199-208), which are NOT one
   *  threshold: shallow steps are ENTERED at `(y - 0.57) < waterY`
   *  and only left at `(y - 0.95) >= waterY` - or when the water
   *  level clears entirely (blockWaterLevel == 10000, which is a null
   *  surface here). BETWEEN the two the current sound STICKS, so
   *  wading out keeps the splash for another 0.38 units. Both dungeon
   *  hosts recomputed the flag from the ENTER threshold alone every
   *  frame - stateless picking cannot express a latch - and so went
   *  back to stone early.
   *
   *  `centreY` is the capsule CENTRE, which is DFU's
   *  transform.position on a CharacterController; the hosts pass
   *  feet + half-height. Returns the latched shallow flag. */
  waterStep(centreY, surf, swimming) {
    if (swimming) return this.dungeonShallow;   // the submerged arm owns this frame
    if (surf == null || (centreY - 0.95) >= surf) this.dungeonShallow = false;
    else if (!this.dungeonShallow && (centreY - 0.57) < surf) this.dungeonShallow = true;
    return this.dungeonShallow;
  }

  /** @param pos [x, y, z]
   *  @param m { grounded, standingStill, swimming, levitating,
   *            onFoot = true, onExteriorWater = false, halfSpeed }
   *  @param set [clip1, clip2] from pickFootstepSet
   *  @returns { clip, volume } | null */
  update(pos, m, set) {
    const here = [pos[0], pos[2]];
    if (this.last === null) this.last = here;
    // on-foot gate (:222-227): levitation always silences; a mount
    // silences unless the player is in exterior water.
    if (m.levitating || (m.onFoot === false && !m.onExteriorWater)) {
      this.distance = 0;
      this.last = here;
      return null;
    }
    if (!m.swimming) {
      if (!m.grounded) {
        this.distance = 0;
        this.lostGrounding = true;
        this.last = here;
        return null;
      }
      if (this.lostGrounding) {
        // the landing step (:240-258): one immediate step on regaining
        // the ground - except the very first, which is swallowed
        this.distance = 0;
        this.last = here;
        this.lostGrounding = false;
        if (this.ignoreLostGrounding) { this.ignoreLostGrounding = false; return null; }
        const clip = this.alternate ? set[1] : set[0];
        this.alternate = !this.alternate;
        return { clip, volume: FOOTSTEP_VOLUME };
      }
    }
    if (m.standingStill) { this.last = here; return null; }
    this.distance += Math.hypot(here[0] - this.last[0], here[1] - this.last[1]);
    this.last = here;
    if (this.distance <= WALK_STEP_INTERVAL) return null;
    let volume = FOOTSTEP_VOLUME;
    if (m.halfSpeed) volume *= 0.5;   // IsMovingLessThanHalfSpeed
    const clip = this.alternate ? set[1] : set[0];
    this.alternate = !this.alternate;
    this.distance = 0;
    return { clip, volume };
  }
}
