// HIT EFFECTS (AUDIT 24, wave 39) - EnemyBlood.ShowBloodSplash.
//
// The port generated `bloodIndex` into ENEMY_BASICS correctly - the
// same six ids DFU gives a 2, everything else left at the struct
// default 0 - and then nothing read it. Not one splash, in any pool,
// for any hit, since the first enemy shipped.
//
// A splash is a ONE-SHOT animated billboard from TEXTURE.380 at ten
// frames a second, nudged 2cm along the struck entity's facing so it
// does not z-fight the sprite it decorates.
//
//     const int bloodArchive = 380;
//     const int sparklesIndex = 3;
//     go.transform.position = bloodPosition + transform.forward * 0.02f;
//     c.OneShot = true;
//     c.FramesPerSecond = 10;
//
// The one-shot clock already existed (render/flatAnimation.js, ported
// for the missile impact) and it is DFU's display-then-advance
// coroutine verbatim, so a splash ends on the frame DFU ends it on.
// What this file adds is the LIFETIME: a finished one-shot has to have
// its batch destroyed, which the FlatAnimator does not do because a
// scene's static flats never finish.
//
// TWO DFU CALL SITES ARE DELIBERATELY NOT PORTED, because they are
// dead in the shipped game and porting them would make the port bleed
// where Daggerfall does not:
//   - DaggerfallEntityBehaviour.cs:173-176, the `showBlood` arm. Every
//     caller in the whole DFU tree passes FALSE (DamageHealth,
//     ContinuousDamageHealth and TransferHealth all pass
//     `false, Vector3.zero`), so spell damage never bleeds.
//   - EnemyHealth.cs:52. `grep EnemyHealth` over the DFU tree returns
//     nothing outside that file - it is a DFTFU-era component no
//     shipped scene carries.
// A third has no port equivalent yet rather than being unported here:
// EnemyAttack.cs:332 is `ApplyDamageToNonPlayer`, foe-vs-foe melee,
// which the port's pools do not do (documented at enemyCasting.js:149
// and dungeonContext.js:1107). When friendly fire lands, its splash is
// `showBloodSplash(targetBloodIndex, bloodCentre(...))`.

import { FlatAnim, isAnimatedFlat } from '../render/flatAnimation.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';

/** EnemyBlood.cs:23. */
export const BLOOD_ARCHIVE = 380;
/** :37 - pinned to ten, not the general five. */
export const BLOOD_FPS = 10;
/** :35 - `+ transform.forward * 0.02f`. */
export const FORWARD_NUDGE = 0.02;

// QUEUED, not ported: ShowMagicSparkles (:41-54) is the same billboard
// at record 3 (`sparklesIndex`), fired from
// EntityEffectManager.cs:2056-2065 whenever the cast's TargetType is
// neither SingleTargetAtRange nor AreaAtRange - so rangeType 0, 1 and
// 3, at the TARGET'S centre + height/8, from the CASTER'S component.
// It is left out rather than half-wired: two of the three arms have a
// target foe to hang it on, but the CasterOnly arm needs the player's
// feet and createPlayerMagic is handed an eye, not a body. A function
// with no caller is a comment, and a function with two callers out of
// three is worse.

/**
 * Where a body bleeds when the hit carries no contact point:
 * `transform.position + controller.center`, then `y += height / 8`
 * (EnemyAttack.cs:326-328, EntityEffectManager.cs:2061-2063). The
 * capsule centre is half the height up, so this is five eighths.
 */
export function bloodCentre(feet, height) {
  return [feet[0], feet[1] + height / 2 + height / 8, feet[2]];
}

/**
 * The pool of live one-shot effect billboards for one host.
 * `tick(dt)` advances them and destroys the ones that have finished;
 * `batches()` hands the host what to draw, on the flats' axis.
 */
export function createHitEffects({ renderer, getTexture, uploadRecordFrame, onSpawn = null, onRetire = null }) {
  // onSpawn/onRetire let a host whose draw list is PERSISTENT (the
  // dungeon's billboardBatches, which the missile impact already
  // pushes into and splices out of) register the batch instead of
  // merging batches() every frame. The exterior hosts rebuild their
  // list per frame and use batches() instead. One pool either way.
  const live = [];   // { batch, anim }

  function spawn(record, pos, facing = null) {
    if (!(record >= 0) || !pos) return null;
    const at = [pos[0], pos[1], pos[2]];
    if (facing) {
      at[0] += facing[0] * FORWARD_NUDGE;
      at[1] += (facing[1] ?? 0) * FORWARD_NUDGE;
      at[2] += facing[2] * FORWARD_NUDGE;
    }
    // record/size/pos live on the ENTRY, not the batch: a recenter has
    // to REBUILD the batch (centres are baked into a STATIC_DRAW
    // buffer) and cannot read them back out of the one it destroys.
    const entry = { batch: null, anim: null, dead: false, record, pos: at, size: null };
    live.push(entry);
    getTexture(BLOOD_ARCHIVE).then((t) => {
      // the pool can be cleared while the archive warms (a scene torn
      // down, a pixel evicted) - the corpse mint's lesson, same shape
      if (entry.dead || !t) return;
      if (t.recordCount != null && record >= t.recordCount) { retire(entry); return; }
      const frameCount = t.getFrameCount?.(record) ?? 1;
      for (let f = 0; f < frameCount; f++) uploadRecordFrame(BLOOD_ARCHIVE, record, f);
      entry.size = scaledBillboardSize(t.getSize(record), t.getScale(record));
      entry.batch = renderer.createBillboardBatch(BLOOD_ARCHIVE, record, entry.size, [entry.pos]);
      entry.batch.frame = 0;
      onSpawn?.(entry.batch);
      // A single-frame record has no wrap to end on, so it would hang
      // in the world for ever. DFU's OneShot billboard destroys itself
      // when the coroutine falls out, and a one-frame coroutine falls
      // out immediately - so a still splash is retired on the next
      // tick rather than kept.
      entry.anim = isAnimatedFlat(frameCount)
        ? new FlatAnim(BLOOD_ARCHIVE, frameCount, true, BLOOD_FPS)
        : null;
    }).catch(() => {});
    return entry;
  }

  function retire(entry) {
    entry.dead = true;
    if (entry.batch) {
      onRetire?.(entry.batch);
      renderer.destroyBillboardBatch(entry.batch);
      entry.batch = null;
    }
    const i = live.indexOf(entry);
    if (i >= 0) live.splice(i, 1);
  }

  return {
    /** ShowBloodSplash (:26-39). `bloodIndex` picks the record, so the
     *  six rows DFU gives a 2 splash differently from everything else. */
    showBloodSplash: (bloodIndex, pos, facing = null) => spawn(bloodIndex ?? 0, pos, facing),
    tick(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i];
        if (!e.batch) continue;             // still warming
        if (!e.anim) { retire(e); continue; }   // single-frame: one tick and gone
        e.batch.frame = e.anim.tick(dt);
        if (e.anim.done) retire(e);
      }
    },
    batches: () => live.map((e) => e.batch).filter(Boolean),
    /** THE FOUR HOSTS RULE: a floating-origin recenter moves these too
     *  - a splash mid-animation must not stay behind in old space. */
    offsetAll(offset) {
      const [dx, dy, dz] = offset;
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i];
        e.pos[0] += dx; e.pos[1] += dy; e.pos[2] += dz;
        // Still warming: the batch would be built from the moved pos
        // anyway, so nothing to rebuild. (The pos array is the one the
        // continuation closes over, so the move carries.)
        if (!e.batch) continue;
        onRetire?.(e.batch);
        renderer.destroyBillboardBatch(e.batch);
        e.batch = renderer.createBillboardBatch(BLOOD_ARCHIVE, e.record, e.size, [e.pos]);
        e.batch.frame = e.anim?.frame ?? 0;
        onSpawn?.(e.batch);
      }
    },
    clear() { for (let i = live.length - 1; i >= 0; i--) retire(live[i]); },
    _live: live,
  };
}
