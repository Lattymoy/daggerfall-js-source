// X11: THE MAGIC CANDLE - what the Light effect (15,255) actually
// DOES. Verbatim from DFU (MIT, Daggerfall Workshop):
//   LightNormal.cs:76-101   - StartLight / StartMagicCandle / EndLight
//   MagicCandleBehaviour.cs - the sprite, the wobble, DestroyCandle
//   Assets/Resources/MagicCandle.prefab - the Light component itself
//
// THE LAW, line by line:
//  - the candle hangs `candleDistance` = 1.4 units in FRONT of the
//    player (:82), with `candlePosition.y += PlayerController.height
//    * 0.25` (:85). DFU's own comment explains the 1.4: classic puts
//    it around 4.5, which in a dungeon is usually through a wall, so
//    DFU deliberately pulls it in. The port keeps DFU's number, not
//    classic's - this is the build being ported.
//  - it is PARENTED to the player object (:91), so it rides along and
//    swings round as the player turns. The port has no transform
//    hierarchy, so the base offset is recomputed from the live facing
//    every frame, which is the same thing.
//  - the Light component is a POINT light (m_Type: 2), white
//    (1,1,1,1), intensity 1, range 15 - the same range the interior
//    lights already use, so it drops straight into the hosts' existing
//    per-light range arrays.
//  - MagicCandleBehaviour.Update (:42-56) wobbles it: pick a target
//    inside a 0.125-radius sphere around the base offset, lerp there
//    at `moveSpeed` = 8 per second, then pick another. moveAmount is
//    NOT clamped before the lerp, so the last frame of a leg can
//    overshoot slightly - Vector3.Lerp clamps t internally, so the
//    visible result is "arrive and hold for the remainder of that
//    frame". The port lerps with the same unclamped accumulator and
//    clamps inside, which is what Unity's Lerp does.
//  - the sprite is archive 210 record 3 (:22-23) - the LIGHTS_ARCHIVE
//    the world already loads for city lanterns.
//  - DestroyCandle also fires on a new game and on a save load
//    (:31-32, :71-78), which the port's scene teardown covers: a host
//    that drops its candle mount drops the candle.
//
// RECORDED DEPARTURE (Ledger A): the jitter offset is added in WORLD
// space rather than player-local space, because the base offset is
// recomputed rather than parented. The two differ only by the yaw
// rotation of a vector shorter than 12cm.
//
// WHO HOLDS IT: the player only. DFU's StartLight gates the candle on
// `entityBehaviour == PlayerEntityBehaviour` (:76-77) - a Light cast
// on a FOE lands its rounds and lights nothing at all. The effect
// entry itself is in systems/effects.js's BUFF_KINDS, which is where
// the rounds live; this module is only ever asked about the player.

import { scaledBillboardSize } from '../world/rmbFlats.js';
import { LIGHTS_ARCHIVE } from '../world/cityLights.js';

/** MagicCandleBehaviour + the prefab's Light, as numbers. */
export const CANDLE = Object.freeze({
  archive: LIGHTS_ARCHIVE,   // 210 (MagicCandleBehaviour.cs:22)
  record: 3,                 // (:23)
  distance: 1.4,             // candleDistance (LightNormal.cs:82)
  heightFraction: 0.25,      // candlePosition.y += height * 0.25 (:85)
  range: 15,                 // MagicCandle.prefab m_Range
  jitterRadius: 0.125,       // Random.insideUnitSphere * 0.125 (:47)
  moveSpeed: 8,              // moveSpeed (:14), lerp units per second
});

/** The unwobbled position: `transform.position + forward * 1.4`, then
 *  `y += height * 0.25`. `feet` is the port's player origin, which is
 *  DFU's transform.position (hitEffects.bloodCentre adds the capsule
 *  centre to it, so the bare value is the foot point in both). */
export function candleBase(feet, height, forward) {
  const f = forward ?? [0, 0, 1];
  return [
    feet[0] + f[0] * CANDLE.distance,
    feet[1] + f[1] * CANDLE.distance + height * CANDLE.heightFraction,
    feet[2] + f[2] * CANDLE.distance,
  ];
}

/** Random.insideUnitSphere - a uniform point in the unit ball, which
 *  is NOT three uniform axes (that fills a cube). Rejection sampling
 *  gives the same distribution Unity's does with no cube corners. */
export function insideUnitSphere(rolls = Math.random) {
  for (let i = 0; i < 32; i++) {
    const x = rolls() * 2 - 1, y = rolls() * 2 - 1, z = rolls() * 2 - 1;
    if (x * x + y * y + z * z <= 1) return [x, y, z];
  }
  return [0, 0, 0];
}

/** The wobble alone, with no renderer in sight: `offset()` is the
 *  current displacement from the base, `tick(dt)` advances the leg. */
export function createCandleWobble(rolls = Math.random) {
  let last = [0, 0, 0];
  let next = null;          // null IS DFU's Vector3.zero sentinel (:44)
  let moveAmount = 0;
  const cur = [0, 0, 0];
  return {
    tick(dt) {
      if (!next) {
        moveAmount = 0;
        const j = insideUnitSphere(rolls);
        next = [j[0] * CANDLE.jitterRadius, j[1] * CANDLE.jitterRadius, j[2] * CANDLE.jitterRadius];
      }
      const t = Math.min(1, Math.max(0, moveAmount));   // Vector3.Lerp clamps t
      cur[0] = last[0] + (next[0] - last[0]) * t;
      cur[1] = last[1] + (next[1] - last[1]) * t;
      cur[2] = last[2] + (next[2] - last[2]) * t;
      moveAmount += CANDLE.moveSpeed * dt;
      if (moveAmount >= 1) { last = next; next = null; }
    },
    offset: () => cur,
  };
}

/**
 * Put a candle at the FRONT of a host's `nearestLights` array.
 *
 * The candle is 1.4 units away, so it is always the nearest light the
 * player has and nearestLights' own distance sort would put it first
 * anyway - prepending saves re-sorting. The renderer's cap is 16
 * vec4s (setPointLights subarrays at 16 * 4), so the last light drops
 * off rather than the array growing past it.
 */
export function withCandleLight(base, light) {
  if (!light) return base;
  const keep = Math.min(15, base.length / 4) * 4;
  const out = new Float32Array(keep + 4);
  out[0] = light.x; out[1] = light.y; out[2] = light.z; out[3] = light.range;
  out.set(base.subarray(0, keep), 4);
  return out;
}

/**
 * One host's candle mount. `update` is called every frame with
 * whether the player currently carries the Light effect; the mount
 * lights, spawns and destroys itself from that one answer, exactly as
 * Start/End do in DFU.
 *
 * deps: renderer, getTexture, uploadRecord - the same three the
 * hitEffects pool takes. A host with no uploadRecord gets the light
 * and no sprite rather than a crash.
 */
export function createMagicCandle({
  renderer, getTexture, uploadRecord = null, rolls = Math.random,
  // The hitEffects pool's shape: a host whose draw list is a standing
  // array registers the batch instead of merging one every frame.
  onSpawn = null, onRetire = null,
}) {
  const wobble = createCandleWobble(rolls);
  const pos = [0, 0, 0];
  let lit = false;
  let batch = null;
  let basePos = null;     // where the batch's baked centre sits
  let warming = false;

  function spawnSprite() {
    if (warming || batch || !uploadRecord) return;
    warming = true;
    getTexture(CANDLE.archive).then((t) => {
      warming = false;
      // The pool can be torn down while the archive warms - the corpse
      // mint's lesson, the same shape hitEffects guards.
      if (!lit || batch || !t) return;
      if (t.recordCount != null && CANDLE.record >= t.recordCount) return;
      uploadRecord(CANDLE.archive, CANDLE.record);
      const size = scaledBillboardSize(t.getSize(CANDLE.record), t.getScale(CANDLE.record));
      basePos = [pos[0], pos[1], pos[2]];
      batch = renderer.createBillboardBatch(CANDLE.archive, CANDLE.record, size, [basePos]);
      onSpawn?.(batch);
    }).catch(() => { warming = false; });
  }

  function dropSprite() {
    if (batch) { onRetire?.(batch); renderer.destroyBillboardBatch(batch); batch = null; }
    basePos = null;
  }

  return {
    /** @param active - hasActiveEffect(playerEntity, 'light') */
    update(dt, { active, feet, height, forward }) {
      if (!active) { if (lit) { lit = false; dropSprite(); } return; }
      lit = true;
      wobble.tick(dt);
      const b = candleBase(feet, height, forward);
      const o = wobble.offset();
      pos[0] = b[0] + o[0]; pos[1] = b[1] + o[1]; pos[2] = b[2] + o[2];
      if (!batch) spawnSprite();
      else batch.origin = [pos[0] - basePos[0], pos[1] - basePos[1], pos[2] - basePos[2]];
    },
    /** The point light, in nearestLights' own shape, or null. */
    light: () => (lit ? { x: pos[0], y: pos[1], z: pos[2], range: CANDLE.range } : null),
    batch: () => batch,
    /** THE FOUR HOSTS RULE: a floating-origin recenter would leave the
     *  candle behind in the old space - its centre is baked into a
     *  STATIC_DRAW buffer and only `origin` moves. So the sprite is
     *  dropped and the next update rebuilds it around the new base;
     *  the archive is already warm by then, so the gap is one frame.
     *  (Unused `offset` kept in the signature: every other host mount
     *  takes one, and a caller that stops passing it should not start
     *  silently working.) */
    offsetAll(offset) {
      if (!offset) return;
      dropSprite();
    },
    clear() { lit = false; dropSprite(); },
    _pos: pos,
  };
}
