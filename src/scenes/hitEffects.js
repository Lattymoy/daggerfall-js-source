// HIT EFFECTS (AUDIT 24, waves 39 and 44) - EnemyBlood.cs, whole.
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
// and dungeonContext.js:1420). When friendly fire lands, its splash is
// `showBloodSplash(targetBloodIndex, bloodCentre(...))`.

import { FlatAnim, isAnimatedFlat, IMPACT_FPS, MISSILE_FPS } from '../render/flatAnimation.js';   // AUDIT 26 F033: ImpactBillboardFramesPerSecond   // FIELD-GUN14: a flying flat's own rate, which is the missile's
import { billboardSize, centredBase } from '../world/rmbFlats.js';
import { BLOODLESS_INDEX } from '../combat/bloodDecals.js';   // BLOOD1a: which foes bleed, for the art hand-off below

/** EnemyBlood.cs:23. */
import { createBleedLedger } from '../combat/bloodBleed.js';   // BLOOD2c
import { flashPlayerBleed } from '../ui/damageFlash.js';   // BLOOD2e: the reference's subtle flash with each of the player's own drips
export const BLOOD_ARCHIVE = 380;
/** BLOOD2d: the player's key in the marks' tracking table (a foe's is its own record). */
export const PLAYER_WALKER = Object.freeze({ player: true });
/** :37 - pinned to ten, not the general five. */
export const BLOOD_FPS = 10;
/** F033: UseSpellBillboardAnims(1, true) - record 1, one-shot. */
export const IMPACT_RECORD = 1;
/** :35 - `+ transform.forward * 0.02f`. */
export const FORWARD_NUDGE = 0.02;

/** :41-54 - ShowMagicSparkles, the same one-shot billboard at record
 *  3 (`sparklesIndex`).
 *
 *  AUDIT 24 (wave 44). Wave 39 cut this rather than half-wire it, on
 *  the reading that it needed the PLAYER's feet - and that reading was
 *  wrong. The one call site is EntityEffectManager.cs:2056-2068, and
 *  it lives inside `EnemyCastReadySpell()`, whose own comment is "For
 *  enemies this is equivalent to PlayerSpellCasting_OnReleaseFrame()".
 *  There is no sparkle on the player's release path at all.
 *
 *  And the position is the CASTER'S, not the target's: `entityBehaviour`
 *  is the manager's own entity (:158) and an EntityEffectManager sits
 *  on the caster, so `entityBehaviour.transform.position +
 *  controller.center` with `y += height/8` is the enemy blooming on
 *  itself. Which is what a self, touch or area-around-caster spell
 *  going off ought to look like. */
export const SPARKLES_RECORD = 3;

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
export function createHitEffects({
  renderer, getTexture, uploadRecordFrame, onSpawn = null, onRetire = null,
  // BLOOD1a: the mark pool, HANDED IN rather than built here.
  //
  // HARD1 threw the first cut out and was right to: this pool is a
  // HAND-OFF (every splash batch goes to the host's list, which is what
  // frees it), and a ring of decal quads is a thing it would OWN - and
  // that gate's three answers are exclusive by design. A splash plays
  // and goes; a mark stays and costs a vertex buffer for the session.
  // Two lifetimes, two bindings, and the host ends the other one by
  // name. Null means no marks and exactly the splash this file always
  // drew.
  marks = null,
  // BLOOD2c: the chance the bleeding ledger rolls its 2..5 s waits with -
  // the game's own unless a pin holds it still.
  rng = Math.random,
} = {}) {
  const bleeding = createBleedLedger({ rng });   // BLOOD2c: per pool, keyed by body
  // onSpawn/onRetire let a host whose draw list is PERSISTENT (the
  // dungeon's billboardBatches, which the missile impact already
  // pushes into and splices out of) register the batch instead of
  // merging batches() every frame. The exterior hosts rebuild their
  // list per frame and use batches() instead. One pool either way.
  const live = [];   // { batch, anim }

  function spawn(record, pos, facing = null, { archive = BLOOD_ARCHIVE, fps = BLOOD_FPS, scale = 1, tracked = false, onTexture = null } = {}) {
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
    // AUDIT 26 F033: `archive` and `fps` ride on the ENTRY for the same
    // reason record/size/pos do - a recenter REBUILDS the batch and
    // cannot read them back out of the one it destroys.
    // FIELD-GUN14: `tracked` is a FLYING flat - one the caller moves
    // and retires itself, rather than a one-shot that ends on its own
    // animation. `at` is its live world position; `pos` stays the
    // position the batch was BUILT at, because a billboard batch bakes
    // its centres into a STATIC_DRAW buffer and flight rides the
    // batch's origin uniform instead (the dungeon missile's own trick -
    // zero GL churn).
    const entry = { batch: null, anim: null, dead: false, record, pos: at, at: [...at], size: null, archive, fps, scale, tracked };
    live.push(entry);
    getTexture(archive).then((t) => {
      // the pool can be cleared while the archive warms (a scene torn
      // down, a pixel evicted) - the corpse mint's lesson, same shape
      if (entry.dead) return;
      if (!t) { retire(entry); return; }   // AUDIT 68 S20-hiteffects-warm-leak: no art, nothing to draw or end on - it leaves the live list
      if (t.recordCount != null && record >= t.recordCount) { retire(entry); return; }
      const frameCount = t.getFrameCount?.(record) ?? 1;
      for (let f = 0; f < frameCount; f++) uploadRecordFrame(archive, record, f);
      // FIELD-GUN17: the archive, once it is warm, to whoever asked for
      // the flat. The pool does not care what a caller does with it -
      // the Thunderlock reduces its orb to one colour and paints its
      // muzzle flash in it - and this is the only moment the texture is
      // in hand, so it is the only place the offer can be made. Never
      // throws into the pool's own warm: a caller's arithmetic is not
      // the reason a splash fails to appear.
      if (onTexture) { try { onTexture(t, archive, record); } catch { /* the flat still flies */ } }
      // BLOOD1a: THE MARK'S ART IS THIS SPLASH'S LAST FRAME, and this
      // is the ONE place that can see the frame count - so it tells the
      // mark pool rather than the mark pool guessing. A splash plays out
      // to the settled splat and then vanishes; that final frame IS the
      // stain, so the mark needs no art of its own and the port ships
      // none: it is TEXTURE.380 out of the player's own ARENA2, where
      // every other pixel here comes from.
      if (archive === BLOOD_ARCHIVE && record !== BLOODLESS_INDEX) marks?.useArt?.(archive, record, frameCount);
      entry.size = billboardSize(t, record);
      // WW1: DoClang/DoThud's localScale x2 - and FIELD-GUN18's orb,
      // which is the same knob asked the other way.
      //
      // THIS BRANCH NEVER RAN CORRECTLY. `billboardSize` answers a
      // {w, h} RECORD (rmbFlats.js:155, and billboardXml's override
      // keeps the shape), and neither arm of the old ternary was that:
      // an object is not an Array, so every scaled flat took
      // `entry.size * scale` - object times number, which is NaN. A
      // NaN size is not a visible wrong size, it is `size.w ===
      // undefined` at the batch and a quad with NaN corners, so the
      // ONE caller that used it - showMissEffect, whose scale is 2 BY
      // DEFAULT - drew nothing at all, at every host, since WW1. A
      // shape the value never had, in a branch nothing measured.
      if (scale !== 1 && entry.size) entry.size = { w: entry.size.w * scale, h: entry.size.h * scale };
      // FIELD-GUN20: the pool's flats are CENTRED on their position - a
      // splash on the wound, an impact on the wall, an orb on the muzzle
      // - where every block flat sits on its base. The renderer anchors
      // at the base for all of them, so the base handed over is half a
      // height under the position (rmbFlats.centredBase, the law's one
      // home). The origin deltas below are centre-to-centre and do not
      // move: the batch's base and its live position shift together.
      entry.batch = renderer.createBillboardBatch(archive, record, entry.size, [centredBase(entry.pos, entry.size)]);
      entry.batch.frame = 0;
      onSpawn?.(entry.batch);
      // A single-frame record has no wrap to end on, so it would hang
      // in the world for ever. DFU's OneShot billboard destroys itself
      // when the coroutine falls out, and a one-frame coroutine falls
      // out immediately - so a still splash is retired on the next
      // tick rather than kept.
      // FIELD-GUN14: ONE WORD, NOT TWO. A tracked flat LOOPS by the
      // same fact that makes it caller-retired: it is a projectile, so
      // there is no "end" for an animation to reach - the flight ends
      // it. Carrying `loop` beside `tracked` would have been two
      // switches that are only ever thrown together, and the second
      // one a guard no test could fail on its own.
      entry.anim = isAnimatedFlat(frameCount)
        ? new FlatAnim(archive, frameCount, !tracked, fps)
        : null;
      // FIELD-GUN14: a flat that arrived mid-flight takes the position
      // it is at NOW, not the one it was asked for a frame ago.
      if (tracked) entry.batch.origin = [entry.at[0] - entry.pos[0], entry.at[1] - entry.pos[1], entry.at[2] - entry.pos[2]];
    }).catch(() => { if (!entry.batch) retire(entry); });   // AUDIT 68 S20-hiteffects-warm-leak: a failed warm (the archive's rejection is cached) left a batchless entry tick() skips for ever
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
    showBloodSplash: (bloodIndex, pos, facing = null, hit = null) => {
      const entry = spawn(bloodIndex ?? 0, pos, facing);
      marks?.place?.(hit?.markIndex ?? bloodIndex, pos, hit);   // BLOOD1a: the splash plays, the mark stays   // BLOOD1 AUDIT 3: a site whose SPLASH index is not the foe's (the fall sites' literal 0) names the mark's own, so the bloodless gate holds
      return entry;
    },

    /**
     * BLOOD2c: A WOUNDED BODY BLEEDS, A DEAD ONE BLEEDS OUT. The host
     * hands the bodies it walks every frame and a VIEW that reads one -
     * { feet, health, maxHealth, bloodIndex, dead, corpse } - and the
     * ledger answers what is due: a drip of small drops at a wounded
     * body's feet every 2..5 s (the reference's cadence, ramped by how
     * hurt it is), and one spreading pool the first frame a body is seen
     * dead with a corpse. Marks only - no splash plays for a drip.
     */
    bleed: (dt, bodies, view) => {
      if (!marks) return 0;
      let n = 0;
      for (const a of bleeding.tick(dt, bodies, view)) {
        if (a.kind === 'drip') { if (marks.drip?.(a.bloodIndex, a.pos, a.count)) n++; }
        else if (a.kind === 'pool') { if (marks.spreadPool?.(a.bloodIndex, a.pos)) n++; }
        else if (a.kind === 'step') { if (marks.step?.(a.body, a.pos, a.forward)) n++; }   // BLOOD2d: a foe treads in blood and tracks it
      }
      return n;
    },

    /** BLOOD2e: THE PLAYER BLEEDS. The reference bleeds the PLAYER -
     *  below the threshold, every 2..5 s, a spawn ramped by how hurt
     *  they are, with a subtle red flash, suppressed at zero health -
     *  and BLOOD2c turned that shape on the foes first. This is the
     *  player's own: the same ledger, keyed by PLAYER_WALKER, read
     *  through a view of the entity's health at the feet the host
     *  hands, with no strides (the footstep machine lays the player's
     *  prints) and no corpse (a dead player is the death screen's, not
     *  a pool's). Each drip that lands flashes. Answers the drips laid. */
    bleedPlayer: (dt, feet, entity) => {
      if (!marks || !feet || !entity) return 0;
      const health = entity.health ?? 0, maxHealth = entity.maxHealth ?? 0;
      const view = () => ({ feet, health, maxHealth, bloodIndex: 0, dead: !(health > 0), corpse: false, strides: false });
      let n = 0;
      for (const a of bleeding.tick(dt, [PLAYER_WALKER], view)) {
        if (a.kind === 'drip' && marks.drip?.(a.bloodIndex, a.pos, a.count)) { n++; flashPlayerBleed(); }
      }
      return n;
    },

    /** BLOOD2d: THE PLAYER'S FOOTFALL - the hosts' footstep machine says
     *  when a foot comes down; this says where. Treading in wet blood
     *  tracks it for a few steps. `forward` is the way the player faces. */
    footfall: (pos, forward = null) => marks?.step?.(PLAYER_WALKER, pos, forward) ?? null,

    /** ShowMagicSparkles (:41-54), record 3. */
    showMagicSparkles: (pos, facing = null) => spawn(SPARKLES_RECORD, pos, facing),
    /** AUDIT 26 F033 - DaggerfallMissile.DoCollision (:364-370):
     *
     *    if (elementType != ElementTypes.None && targetType != ByTouch)
     *    {
     *        UseSpellBillboardAnims(1, true);
     *        myBillboard.FramesPerSecond = ImpactBillboardFramesPerSecond;
     *    }
     *
     *  Record 1 of the missile's OWN element archive (:601
     *  GetMissileTextureArchive), one-shot, at IMPACT_FPS. `facing` is
     *  deliberately null: DFU parents the flash to the missile at
     *  `localPosition = Vector3.zero` (:602), so there is no nudge.
     *  The flash ENDS on FlatAnim.done, which is DFU's OneShot
     *  self-destruct - not the missile's 0.6s lifetime, which governs
     *  the parent rather than the billboard. */
    showImpactFlash: (archive, pos) => spawn(IMPACT_RECORD, pos, null, { archive, fps: IMPACT_FPS }),
    /** WW1: Weapon Widget's DoClang / DoThud (FPSWeaponClone IL 0xe0c,
     *  0xf58): TEXTURE.380 record 2, one-shot at 20 fps, twice its size,
     *  at the point the widget worked out. The CLANG's emissive material
     *  (`_EMISSION` on the billboard) has no twin in this renderer's
     *  flat batches and is not carried. */
    showMissEffect: (kind, pos, { archive = BLOOD_ARCHIVE, record = 2, fps = 20, scale = 2 } = {}) => spawn(record, pos, null, { archive, fps, scale }),
    /**
     * FIELD-GUN14 (Mac: "The projectile that shoots out should be an
     * orb, not an arrow") - A FLAT THAT FLIES.
     *
     * Every other entry in this pool is a one-shot that plays where it
     * was born and ends on its own animation. A projectile does
     * neither: it MOVES, it LOOPS, and what ends it is the flight
     * meeting something. So it is the same pool - the same warm, the
     * same batch, the same recenter, the same teardown, which is the
     * whole reason it is here rather than in a fifth body of billboard
     * bookkeeping - with the caller holding the handle.
     *
     * Answers { move(pos), retire() }, both safe to call before the
     * archive has warmed and after the flat is gone.
     */
    showFlyingFlat(archive, pos, { record = 0, fps = MISSILE_FPS, scale = 1, onTexture = null } = {}) {
      const e = spawn(record, pos, null, { archive, fps, scale, tracked: true, onTexture });
      return {
        move(at) {
          if (!e || e.dead || !at) return;
          e.at[0] = at[0]; e.at[1] = at[1]; e.at[2] = at[2];
          // The batch was built ONCE at the fire position; flight rides
          // the origin uniform (dungeonContext's missile does the same).
          if (e.batch) e.batch.origin = [at[0] - e.pos[0], at[1] - e.pos[1], at[2] - e.pos[2]];
        },
        retire() { if (e && !e.dead) retire(e); },
      };
    },
    tick(dt) {
      // BLOOD1b: THE CHUNKS RIDE THIS, and deliberately rather than
      // through a call of their own - the same reading as `offsetAll`
      // below. Every host that animates its splashes already calls
      // this line each frame; a second one beside it is a line four
      // hosts have to remember, and the one that forgot would leave a
      // gibbed body's chunks hanging in the air for ever.
      marks?.tick?.(dt);
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i];
        if (!e.batch) continue;             // still warming
        // FIELD-GUN14: a TRACKED flat outlives its animation - it is a
        // projectile, and the thing that ends it is the flight, not the
        // clock. A single-frame one is not "one tick and gone" either.
        if (!e.anim) { if (!e.tracked) retire(e); continue; }   // single-frame: one tick and gone - but a PROJECTILE drawn from a one-frame record is still in the air (FIELD-GUN14)
        e.batch.frame = e.anim.tick(dt);
        if (e.anim.done) retire(e);   // never true for a tracked flat: it is not a one-shot
      }
    },
    batches: () => live.map((e) => e.batch).filter(Boolean),
    /** THE FOUR HOSTS RULE: a floating-origin recenter moves these too
     *  - a splash mid-animation must not stay behind in old space. */
    offsetAll(offset) {
      const [dx, dy, dz] = offset;
      // BLOOD1a: THE MARKS RIDE THIS, and deliberately rather than
      // through a call of their own. Every host that shifts its splashes
      // already calls this line; a second one beside it is a line four
      // hosts have to remember, and the one that forgot would strand its
      // blood 819.2 units behind - which is the exact fault AUDIT 17e
      // F23 wrote this block's own comment about.
      marks?.shiftOrigin?.(offset);
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i];
        e.pos[0] += dx; e.pos[1] += dy; e.pos[2] += dz;
        e.at[0] += dx; e.at[1] += dy; e.at[2] += dz;   // FIELD-GUN14: the live position moves with the built one, so the origin delta below is unchanged
        // Still warming: the batch would be built from the moved pos
        // anyway, so nothing to rebuild. (The pos array is the one the
        // continuation closes over, so the move carries.)
        if (!e.batch) continue;
        onRetire?.(e.batch);
        renderer.destroyBillboardBatch(e.batch);
        e.batch = renderer.createBillboardBatch(e.archive, e.record, e.size, [centredBase(e.pos, e.size)]);   // FIELD-GUN20: rebuilt where it was built - centred
        e.batch.frame = e.anim?.frame ?? 0;
        if (e.tracked) e.batch.origin = [e.at[0] - e.pos[0], e.at[1] - e.pos[1], e.at[2] - e.pos[2]];   // FIELD-GUN14: a rebuilt batch starts at its centres again - the flight's delta has to be put back
        onSpawn?.(e.batch);
      }
    },
    /** Retire everything, now. HE1 gave this its second caller and the
     *  reason is worth writing down: worldModes keeps ONE pool across
     *  every building the player walks through, so a splash still
     *  animating when the door closes would be drawn in the NEXT
     *  building, in the previous one's coordinates. DFU needs no
     *  equivalent - its splashes are children of the scene objects
     *  Unity destroys with the interior. */
    clear() {
      for (let i = live.length - 1; i >= 0; i--) retire(live[i]);
      marks?.clear?.();   // BLOOD1a: a room thrown away takes its blood with it, on the call every host already makes
      bleeding.clear();   // BLOOD AUDIT 4: ...and the ledger's memory of who pooled and who walked - the next room's bodies are met fresh
    },
    _live: live,
  };
}
