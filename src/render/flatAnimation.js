// ANIMATED FLATS (FA1) - DaggerfallBillboard.cs's AnimateBillboard
// (:115-166) and the AnimatedMaterial decision at :282-285, ported
// whole. Every fire, brazier, candle flame, tavern hearth and magic
// effect flat in the world had been drawing frame 0 for ever: the
// records carry their frames (TextureFile decodes them lazily and the
// ENEMY sprites already ride them), but nothing ever advanced a static
// flat's frame, so the most repeated moving thing in Daggerfall stood
// still in every dungeon, guild hall and lit street.
//
// DFU runs this as a coroutine per billboard - `yield return new
// WaitForSeconds(1f / speed)` - which is a FIXED-STEP clock, not a
// per-frame lerp: the frame advances on a whole tick and never
// interpolates. The port drives it from the host's dt and holds the
// remainder, so a 144Hz host and a 30Hz host show the same animation
// at the same speed, and a long stall (a tab restored, an interior
// loaded) catches up instead of drifting.

/** The three speeds, verbatim (DaggerfallBillboard.cs:38-39, :46).
 *  Everything runs at the general 5 FPS except the two archives DFU
 *  names: ANIMALS also 5, LIGHTS 12 - the flames are the fast ones. */
export const GENERAL_FPS = 5;      // framesPerSecond (:46)
export const ANIMAL_FPS = 5;       // animalFps (:38)
export const LIGHT_FPS = 12;       // lightFps (:39)

/** TextureReader.cs:35-36. */
export const ANIMALS_TEXTURE_ARCHIVE = 201;
export const LIGHTS_TEXTURE_ARCHIVE = 210;

/** Missile billboards override the general speed - the flying missile
 *  at 5 and the impact flash at 15 (DaggerfallMissile.cs:44-45), the
 *  impact being record 1 and ONE SHOT (:367-368, :591-607). */
export const MISSILE_FPS = 5;
export const IMPACT_FPS = 15;

/**
 * AnimateBillboard's speed pick (:119-121), verbatim including its
 * PRECEDENCE:
 *     float speed = FramesPerSecond;
 *     if (Archive == Animals) speed = animalFps;
 *     else if (Archive == Lights) speed = lightFps;
 * The per-billboard FramesPerSecond is the DEFAULT and the two named
 * archives OVERRIDE it - so a missile flat that happened to live in
 * the lights archive would take 12, not its own 5. That ordering is
 * the reason this takes the rate as an argument rather than picking
 * one and letting callers overwrite it afterwards.
 */
export function flatFps(archive, framesPerSecond = GENERAL_FPS) {
  if (archive === ANIMALS_TEXTURE_ARCHIVE) return ANIMAL_FPS;
  if (archive === LIGHTS_TEXTURE_ARCHIVE) return LIGHT_FPS;
  return framesPerSecond;
}

/** SetMaterial (:282-285): a record with more than one frame animates,
 *  and one with a single frame explicitly does NOT. */
export const isAnimatedFlat = (frameCount) => frameCount > 1;

/**
 * One animated flat's clock. DFU's loop body in order:
 *   1. if (CurrentFrame >= frameCount) { CurrentFrame = 0; ... }
 *   2. draw AtlasIndices[Record].startIndex + CurrentFrame
 *   3. CurrentFrame++
 *   4. wait 1/speed
 * The WRAP TEST RUNS FIRST and tests `>=` against the count, so the
 * displayed frame is always the one BEFORE the increment - the same
 * display-then-advance shape the FLIC player has. Reproduced rather
 * than tidied into a modulo, because the difference shows on the frame
 * a one-shot ends.
 */
export class FlatAnim {
  /**
   * @param {number} archive     the texture archive (picks the speed)
   * @param {number} frameCount  the record's frame count
   * @param {boolean} [oneShot]  DFU's OneShot: stop at the wrap instead of looping
   */
  constructor(archive, frameCount, oneShot = false, framesPerSecond = GENERAL_FPS) {
    this.archive = archive;
    this.frameCount = frameCount;
    this.oneShot = oneShot;
    this.fps = flatFps(archive, framesPerSecond);
    this.currentFrame = 0;
    this.frame = 0;        // what the renderer should draw RIGHT NOW
    this.done = false;
    this._acc = 0;
    this._step();          // the coroutine's first pass runs before its first wait
  }

  /** One pass of the loop body: wrap, publish, advance. */
  _step() {
    if (this.currentFrame >= this.frameCount) {
      this.currentFrame = 0;
      if (this.oneShot) { this.done = true; return; }
    }
    this.frame = this.currentFrame;
    this.currentFrame++;
  }

  /** Spend `dt` seconds of the host's clock on whole 1/fps ticks. */
  tick(dt) {
    if (this.done || !(dt > 0)) return this.frame;
    this._acc += dt;
    const period = 1 / this.fps;
    // A guard, not a law: a host that stalled for a minute would
    // otherwise spin the whole gap one frame at a time. Landing on the
    // right frame matters; replaying every frame of the gap does not.
    if (this._acc > period * this.frameCount) {
      this._acc %= period;
      this._step();
      return this.frame;
    }
    while (this._acc >= period && !this.done) {
      this._acc -= period;
      this._step();
    }
    return this.frame;
  }
}

/**
 * The host's collection: every animated flat batch in one scene, ticked
 * together. Batches with a single frame never enter it, so a scene of
 * still flats costs nothing per frame.
 */
export class FlatAnimator {
  constructor() { this.entries = []; }

  /** @param {object} batch a renderer billboard batch (its `frame` is written each tick) */
  add(batch, archive, frameCount, oneShot = false, framesPerSecond = GENERAL_FPS) {
    if (!isAnimatedFlat(frameCount)) return null;
    const anim = new FlatAnim(archive, frameCount, oneShot, framesPerSecond);
    batch.frame = anim.frame;
    const entry = { batch, anim };
    this.entries.push(entry);
    return entry;
  }

  /** Drop every entry for a batch (a pixel evicted, a scene torn down). */
  remove(batch) {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].batch === batch) this.entries.splice(i, 1);
    }
  }

  /**
   * Has this batch's ONE SHOT finished? DaggerfallBillboard.cs:127-131:
   *   if (CurrentFrame >= frameCount) { CurrentFrame = 0;
   *       if (OneShot) GameObject.Destroy(gameObject); }
   * A one-shot billboard does not merely stop at the wrap - it DESTROYS
   * ITSELF there, so the host that mounted it must stop drawing it on
   * the same tick `done` turns true. A batch this animator never took
   * (a single-frame record, DFU's !AnimatedMaterial: the coroutine never
   * runs and nothing ever destroys it) answers false, and its owner
   * keeps it for as long as it would have.
   */
  done(batch) {
    for (const e of this.entries) if (e.batch === batch) return e.anim.done;
    return false;
  }

  clear() { this.entries.length = 0; }

  tick(dt) {
    for (const e of this.entries) e.batch.frame = e.anim.tick(dt);
  }
}

/**
 * THE ONE ARMING SEAM, called at all four static-flat batch sites
 * (exterior.js, world.js, interiorContext.js, dungeonContext.js). It
 * exists so the four hosts cannot drift: the decision to animate, the
 * frames to upload, and the registration are one function, not four
 * copies of three lines. THE FOUR HOSTS RULE, applied before the fact
 * for once rather than after an audit finds the fourth.
 *
 * @param {object} batch      the renderer billboard batch
 * @param {object} textureFile the archive's TextureFile (frame counts)
 * @param {number} archive
 * @param {number} record
 * @param {FlatAnimator} animator
 * @param {function(number,number,number):void} uploadRecordFrame
 * @returns {boolean} true if the flat animates
 */
export function armFlatAnim(batch, textureFile, archive, record, animator, uploadRecordFrame, opts = {}) {
  const frameCount = textureFile?.getFrameCount?.(record) ?? 1;
  if (!isAnimatedFlat(frameCount) || !animator || !uploadRecordFrame) return false;
  // Every frame is uploaded up front. Counts are small (the lights
  // archive runs to a handful) and the alternative - uploading on the
  // tick that first needs a frame - puts a texture upload inside the
  // frame loop, which is the churn class this renderer's audits keep
  // deleting.
  for (let f = 0; f < frameCount; f++) uploadRecordFrame(archive, record, f);
  animator.add(batch, archive, frameCount, opts.oneShot ?? false, opts.fps ?? GENERAL_FPS);
  return true;
}
