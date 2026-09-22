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
  const kind = pickFootstepKind(ctx);
  return FOOTSTEP_CLIP_SETS[kind];
}

/** Same precedence as pickFootstepSet, but answers the KIND enum rather
 *  than the clip pair - the network send (a peer's own client) only needs
 *  to say WHICH surface it is standing on; the receiving client looks the
 *  clip pair up locally (FOOTSTEP_CLIP_SETS below), so the wire carries one
 *  small int instead of two archive-specific clip ids. */
export const FOOTSTEP_KIND = Object.freeze({ Outside: 0, Snow: 1, Wood: 2, Stone: 3, Submerged: 4, Shallow: 5 });
export function pickFootstepKind(ctx = {}) {
  let kind;
  if (!ctx.inside && !ctx.onStaticGeometry) {
    kind = (ctx.winter && !isSnowFreeClimate(ctx.climateIndex ?? CLIMATES.Woodlands)) ? FOOTSTEP_KIND.Snow : FOOTSTEP_KIND.Outside;
  } else if (ctx.inBuilding) kind = FOOTSTEP_KIND.Wood;
  else kind = FOOTSTEP_KIND.Stone;
  if (ctx.onExteriorWater) kind = FOOTSTEP_KIND.Submerged;
  if (ctx.onExteriorPath) kind = FOOTSTEP_KIND.Stone;
  if (ctx.dungeonSwimming) kind = FOOTSTEP_KIND.Submerged;
  else if (ctx.dungeonShallow) kind = FOOTSTEP_KIND.Shallow;
  return kind;
}
/** The clip-pair table `pickFootstepKind`'s answer indexes into - shared
 *  by the local pickFootstepSet above and any receiver (net/remotePlayers.js)
 *  that only has the kind, not the original ctx. */
export const FOOTSTEP_CLIP_SETS = Object.freeze([
  [FOOTSTEP.Outside1, FOOTSTEP.Outside2],
  [FOOTSTEP.Snow1, FOOTSTEP.Snow2],
  [FOOTSTEP.Wood1, FOOTSTEP.Wood2],
  [FOOTSTEP.Stone1, FOOTSTEP.Stone2],
  [FOOTSTEP.Submerged, FOOTSTEP.Submerged],
  [FOOTSTEP.Shallow, FOOTSTEP.Shallow],
]);

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
  /** EV1: the floating origin moved the WORLD, not the feet - drop
   *  the stride anchor so the next update re-seeds instead of
   *  accumulating the 819.2-unit shift as walked distance (which
   *  fired a spurious footstep at every map-pixel crossing). */
  rebase() { this.last = null; }

  update(pos, m, set) {
    const here = [pos[0], pos[2]];
    if (this.last === null) this.last = here;
    // EOTB-IL: Eye Of The Beholder's SyncFootsteps - once the mod's
    // Initialize has run DisableVanillaFootsteps (every clip index to
    // -1, IL_54f8-IL_554c) the stride is the PICTURE's: PlayFootstep on
    // the sprite's own frames, the CLIP this table's own choice (the mod
    // copies PlayerFootsteps' selection, IL_55e8-IL_585b), at
    // `FootstepVolumeScale * SoundVolume * (FP ? 1 : 2)` (IL_58cd-IL_5928)
    // - no half-speed halving there. The anchor follows the feet so the
    // distance does not pile up under the sprite and fire one long step
    // the frame it hands the stride back (the :245 landing shape).
    if (m.spriteStep?.owns) {
      this.last = here;
      this.distance = 0;
      if (!m.spriteStep.fell) return null;
      const clip = this.alternate ? set[1] : set[0];
      this.alternate = !this.alternate;
      return { clip, volume: FOOTSTEP_VOLUME * (m.spriteStep.volumeScale ?? 1) };
    }
    // on-foot gate (:221-225): levitation always silences; a mount
    // silences unless the player is in exterior water.
    //
    // AUDIT 64 F46: `lastPosition` is written in exactly TWO places in
    // the whole of FixedUpdate - :245 (the lostGrounding landing reset)
    // and :270 (after the accumulation) - plus Start's seed at :89. The
    // three early returns (:221-225, :232-238, :264-265) leave the
    // anchor DELIBERATELY STALE, so the whole horizontal delta covered
    // under the gate lands on the first frame the gate opens and fires
    // one immediate step at :269. The port used to rebase in all three,
    // which suppressed the step DFU plays on dismount, on a levitation
    // that ends grounded, and on a fall that goes straight into water
    // (IsSwimming skips the :230-262 block, so the landing reset never
    // runs). Only `rebase()` above still clears the anchor - the
    // floating origin has no DFU counterpart.
    if (m.levitating || (m.onFoot === false && !m.onExteriorWater)) {
      this.distance = 0;   // :223 - and no lastPosition write
      return null;
    }
    if (!m.swimming) {
      if (!m.grounded) {
        this.distance = 0;          // :235-237 - distance and the flag,
        this.lostGrounding = true;  // never the anchor
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
    if (m.standingStill) return null;   // :264-265, a bare return
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
