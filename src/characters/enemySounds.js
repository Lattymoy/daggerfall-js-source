// ENEMY SOUNDS (AUDIT 24, wave 41) - EnemySounds.cs, whole.
//
// `moveSound` and `barkSound` are in every one of the 62 rows of
// ENEMY_BASICS and had ZERO consumers in the whole of src/. `attackSound`
// had exactly one, inline in the dungeon frame body - so above ground
// nothing barked, nothing moved audibly, and nothing made a noise when
// it swung at you. A watchman's only utterance was a single HALT on the
// detection edge, where DFU runs a 3-9 second attract cadence for as
// long as it is near you.
//
// The dungeon's inline copy had also drifted from its source in three
// ways, which is the usual price of a law living in a frame body:
//   - its mute gate was `!entity.isClass`, where DFU carves the CITY
//     WATCH out of the human mute (:219-226);
//   - no SetVolumeScale, so an attract sound came through walls and
//     doors at full volume;
//   - the sound played on an INVERSE distance model where DFU sets
//     `LinearRolloff = true` and `maxDistance = AttractRadius`.
// One home, three pools, and the drift closed on the way in.

import { ENEMY_BASICS, isClassEnemyId } from './enemyBasics.js';
import { KNIGHT_CITY_WATCH } from './mobileTypes.js';
import { SPECIAL_ABILITY_BITS } from '../systems/specialAdvantages.js';   // CF1: the AcuteHearing career bit

/** CF1 - ACUTE HEARING's one reader (DaggerfallEnemy.Start :53-71,
 *  the last career flag with none). DFU multiplies each enemy
 *  AudioSource's maxDistance once at spawn: x1.25 with the career
 *  flag, x1.5 when the ImprovedAcuteHearing ENCHANTMENT also holds.
 *  The enchantment (ImprovesTalents.cs) is unported, so the ternary
 *  picks the base 1.25 - the ImprovedAdrenalineRush routed-gap
 *  posture, a gap in the enchantment arc rather than here. The port
 *  applies the multiplier at play time on the ONE clip seam
 *  (hostCombat.playEnemyClip) instead of once per spawn - the same
 *  answer, since ATTRACT_RADIUS is the only maxDistance an enemy
 *  source ever has. UESP's reading, which DFU's comment adopts:
 *  "allows you to hear sounds from farther away" - enemy sounds
 *  specifically, so the player is not bombarded with audio. */
export function acuteHearingMultiplier(playerEntity) {
  const bits = playerEntity?.career?.abilityFlagsAndSpellPointsBitfield ?? 0;
  if ((bits & SPECIAL_ABILITY_BITS.acuteHearing) === 0) return 1;
  return playerEntity?.improvedAcuteHearing ? 1.5 : 1.25;
}

/** :26-28 - the fields, verbatim. */
export const ATTRACT_RADIUS = 16;
export const MIN_ATTRACT_DELAY = 3;
export const MAX_ATTRACT_DELAY = 9;
/** :29 - "Human sounds are so bad even Daggerfall doesn't play them." */
export const MUTE_HUMAN_SOUNDS = true;
/** :253 - a wall or an action door between you and it. */
export const OCCLUDED_VOLUME_SCALE = 0.25;
/** :212 - `Random.value > 0.8f` picks MOVE, so bark is the 80% arm.
 *  DFU's own comment is "Random chance favors bark sound". */
export const MOVE_SOUND_THRESHOLD = 0.8;
/** :108 - "Play attack sound only about half the time". */
export const ATTACK_SOUND_THRESHOLD = 0.5;

/**
 * IgnoreHumanSounds (:219-226), verbatim:
 *
 *     if ((mobile.Enemy.ID != Knight_CityWatch && IsClassEnemyId(...))
 *         && MuteHumanSounds) return true;
 *
 * Every class enemy is muted EXCEPT the city watch - which is the pool
 * whose bark the player hears most, and exactly the carve-out the
 * dungeon's inline `!entity.isClass` gate did not have.
 */
export function ignoreHumanSounds(mobileType) {
  return mobileType !== KNIGHT_CITY_WATCH && isClassEnemyId(mobileType) && MUTE_HUMAN_SOUNDS;
}

/** StartWaiting (:196-200): `Random.Range(MinAttractDelay,
 *  MaxAttractDelay + 1)` is the INT overload - inclusive 3..9. */
export function rollAttractDelay(rolls = Math.random) {
  return MIN_ATTRACT_DELAY + Math.floor(rolls() * (MAX_ATTRACT_DELAY + 1 - MIN_ATTRACT_DELAY));
}

/**
 * One enemy's sound source. The host owns the audio device; this owns
 * the CLOCK and the DECISIONS, and hands back `{ clip, volume }` or
 * null - so all three pools ask the same questions in the same order
 * and none of them can quietly answer one differently.
 */
export class EnemySoundSource {
  constructor(mobileType, rolls = Math.random) {
    this.mobileType = mobileType;
    this.rolls = rolls;
    this.muted = ignoreHumanSounds(mobileType);
    // volumeScale is a FIELD on the DFU component, not a local. It is
    // written only by SetVolumeScale, which runs only inside
    // PlayAttractSound - and PlayAttackSound then multiplies by it
    // (:110). So an enemy whose last attract sound was muffled by a
    // wall keeps swinging quietly after it steps into the open, and
    // one that has never played an attract sound swings at full
    // volume. That is DFU's, and it is kept.
    this.volumeScale = 1;
    this.waitCounter = 0;
    this.waitTime = rollAttractDelay(rolls);   // Awake ends with StartWaiting()
  }

  /**
   * FixedUpdate (:79-98). `dist` is the distance to the player and
   * `occluded` the SetVolumeScale probe's answer - the host owns the
   * collider, so it does the cast and passes the verdict.
   *
   * The counter steps whether or not the player is in range, and DFU
   * says why: "Keep stepping even when player not in attract radius.
   * This means the player will get audio feedback the moment an enemy
   * is near." Walk up to a sleeping dungeon and it greets you at once.
   */
  tick(dt, dist, isOccluded = () => false) {
    this.waitCounter += dt > 0 ? dt : 0;
    const inRadius = dist < ATTRACT_RADIUS;
    if (!(this.waitCounter > this.waitTime) || !inRadius) return null;
    const out = this._attract(isOccluded);
    // StartWaiting() runs whether or not the sound was actually played
    // - IgnoreHumanSounds returns from inside PlayAttractSound, after
    // the caller has already committed to the reset (:92-95).
    this.waitCounter = 0;
    this.waitTime = rollAttractDelay(this.rolls);
    return out;
  }

  /** PlayAttractSound (:203-216). `isOccluded` is a THUNK because DFU
   *  makes its point of it: "Only checks when enemy plays attract
   *  sound, so not very expensive" (:234). A muted enemy returns above
   *  it and never casts at all. */
  _attract(isOccluded) {
    if (this.muted) return null;
    // SetVolumeScale (:228-251) - it runs BEFORE the roll, and only
    // here, which is what leaves the field stale for the attack sound.
    this.volumeScale = isOccluded() ? OCCLUDED_VOLUME_SCALE : 1;
    const row = ENEMY_BASICS[this.mobileType];
    if (!row) return null;
    const clip = this.rolls() > MOVE_SOUND_THRESHOLD ? row.moveSound : row.barkSound;
    return clip == null ? null : { clip, volume: this.volumeScale };
  }

  /** PlayAttackSound (:100-113) - about half the time, humans silent,
   *  at whatever volumeScale the last attract sound left behind. */
  attack() {
    if (this.muted) return null;
    if (!(this.rolls() > ATTACK_SOUND_THRESHOLD)) return null;
    const clip = ENEMY_BASICS[this.mobileType]?.attackSound;
    return clip == null ? null : { clip, volume: this.volumeScale };
  }
}
