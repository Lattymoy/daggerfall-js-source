// RR2's TWO RIDING CONTACTS, ONE HOME (AUDIT-RR F15) - EnhancedRiding.cs
// OnTriggerEnter (:135-165, the trample) and OnControllerColliderHit +
// HandleCharge (:167-215, the charge), which the C# runs as a component
// on the player in EVERY exterior. The world host carried them inline;
// the fixed-city host (scenes/exterior.js, MAC-K3's mount) carried
// nothing - no trample, no charge, no crime - and that is the FOUR
// HOSTS RULE's hazard. So the contacts take their reads as deps and
// both hosts stand one.
//
// Unity's trigger is the player controller's capsule against a walker's
// 0.45 cylinder beside the rider's 0.45 - 0.9 units in XZ - and the
// collider hit is the capsule's touch; the port asks both as a proximity
// test each frame while riding and running (the C#'s gates). The charge
// is once per foe (PickpocketByPlayerAttempted is the C#'s latch).
import { rrRidingSetting, rrTrampleOutcome, rrChargeDamage, RR_RIDING } from './rrRealism.js';
import { GENDERS } from '../characters/nameHelper.js';
import { SOUND } from './soundClips.js';
import { CRIMES } from './court.js';
import { FATIGUE_LOSS, liveStat } from './statMods.js';
import { handToHandMinDamage, handToHandMaxDamage } from '../combat/formulas.js';
import { skillValue, SKILLS } from './skills.js';
import { RIDING_VOLUME_SCALE } from './riding.js';

export const RR_TRAMPLE_REACH = 0.9;

/** deps (all the host's own reads):
 *    playerEntity                      - the rider
 *    feet()                            - the rider's feet [x,y,z]
 *    yaw()                             - the look yaw (radians)
 *    livePersons()                     - [{ person, pos }] the street's walkers in world space
 *    foes()                            - the exterior foe records
 *    guards()                          - the watch's records
 *    isGuardRecord(f)                  - whether `f` is the watch's (its damage goes to hurtGuard)
 *    splashBlood(pos, forward)         - EnemyBlood.ShowBloodSplash(0, BloodPos())
 *    playClip(clip, volume)            - AudioSource.PlayOneShot
 *    ridingVolumeScale()               - TransportManager.RidingVolumeScale (0.6; 0 on a journey)
 *    spawnGuards()                     - PlayerEntity.SpawnCityGuards(true)
 *    spawnCityGuard(pos, yaw, feet)    - PlayerEntity.SpawnCityGuard(position, direction), a Promise of the record
 *    setCrime(crime)                   - PlayerEntity.CrimeCommitted = crime
 *    retire(person)                    - mobileNpc.Motor.gameObject.SetActive(false)
 *    hurtGuard(f, damage, feet)        - the watch's DamageHealthFromSource (no knockback of its own)
 *    playVoice(f, v)                   - the heavy pain cry at the foe, `1 + v.pitchLift` (EnemySounds.cs:172-175)
 *    damageFoe(f, damage, feet)        - the foe's
 *    voice(f)                          - EnemySounds.PlayCombatVoice(gender, false, true), answers { clip } or null
 *    rolls                             - UnityEngine.Random.Range's slot */
export function createRrRidingContacts({
  playerEntity, feet, yaw, livePersons, foes, guards, isGuardRecord, splashBlood, playClip, ridingVolumeScale = () => RIDING_VOLUME_SCALE,
  spawnGuards, spawnCityGuard, setCrime, retire, hurtGuard, damageFoe, voice = () => null, playVoice = (f, v) => playClip(v.clip, 1), rolls = Math.random,
}) {
  const forward = () => { const y = yaw(); return [Math.sin(y), 0, Math.cos(y)]; };
  let lastAt = null;
  /** The controller's moveDirection (:173) as the frame's displacement of the feet, normalised on XZ; the look forward
   *  while standing (a charge at rest is a contact the walker made). */
  function moveDirection(at) {
    const prev = lastAt; lastAt = [...at];
    if (!prev) return forward();
    const dx = at[0] - prev[0], dz = at[2] - prev[2];
    const len = Math.hypot(dx, dz);
    return len > 1e-6 ? [dx / len, 0, dz / len] : forward();
  }
  /** HandleCharge (:180-215). */
  function chargeFoe(f, direction) {
    // AUDIT-RR2 G24: `if (!hitEnemyEntity.PickpocketByPlayerAttempted)` (:185) and `= true` (:204) - the SAME latch the
    // pickpocket sets (mobileEnemyActivate.js), so a foe already tried cannot be charged and a charged one refuses the hand
    const latch = f?.entity ?? f;
    if (!f || latch.pickpocketAttempted) return false;
    latch.pickpocketAttempted = true;
    const v = voice(f);   // enemySounds.PlayCombatVoice(gender, false, true) (:195) - the heavy pain cry, no dice
    if (v && v.clip >= 0) playVoice(f, v);   // AUDIT-RR2 G5: on the enemy's own source with EnemySounds' pitch lift (EnemySounds.cs:172-175) - the host's spatial door
    if (f.ai) { f.ai.knockbackSpeed = RR_RIDING.chargeKnockback; f.ai.knockbackDir = [...direction]; }   // (:199-200)
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - FATIGUE_LOSS.Default * RR_RIDING.chargeFatigueMultiplier);   // (:205)
    const h2h = skillValue(playerEntity, SKILLS.HandToHand);
    const damage = rrChargeDamage({ minBase: handToHandMinDamage(h2h), maxBase: handToHandMaxDamage(h2h), agility: liveStat(playerEntity, 'agility'), willpower: liveStat(playerEntity, 'willpower'), roll: rolls() });
    // DamageHealthFromSource(player, damage, true, BloodPos()) (:212) - the blow alone; the knockback above is the
    // component's own and the weapon path's must not run over it (AUDIT-RR F17: no knock direction handed down)
    const at = feet();
    if (isGuardRecord(f)) hurtGuard(f, damage, at);
    else damageFoe(f, damage, at);
    return true;
  }
  /** OnTriggerEnter (:135-165) + OnControllerColliderHit (:167-178), the frame's sweep. */
  function contacts() {
    const at = feet();
    if (!at) return;
    const fwd = forward();
    const reach2 = RR_TRAMPLE_REACH * RR_TRAMPLE_REACH;
    if (rrRidingSetting('TrampleCivilians') === true) {
      for (const seat of livePersons()) {
        const person = seat.person;
        if (!person || person.trampled || !seat.pos) continue;
        const dx = seat.pos[0] - at[0], dz = seat.pos[2] - at[2];
        if (dx * dx + dz * dz > reach2) continue;
        const out = rrTrampleOutcome({ isGuard: !!person.guard, female: person.gender === GENDERS.Female });
        if (out.blood) splashBlood([at[0] + fwd[0] * 2, at[1] + 1, at[2] + fwd[2] * 2], fwd);   // blood.ShowBloodSplash(0, BloodPos()) (:149) - 2 ahead, 1 up
        if (out.clip) playClip(SOUND[out.clip], ridingVolumeScale());   // RidingVolumeScale x SoundVolume (:151) - the master bus carries SoundVolume (AUDIT-RR F16)
        if (out.spawnGuards) spawnGuards();   // SpawnCityGuards(true) (:152)
        if (out.chargeGuard) Promise.resolve(spawnCityGuard([...seat.pos], person.facingYaw ?? yaw(), [...at])).then((g) => { if (g) chargeFoe(g, fwd); }).catch((e) => console.error('[guards]', e));   // SpawnCityGuard + HandleCharge (:156-158)
        setCrime(CRIMES[out.crime]);   // (:160)
        if (out.remove) { person.trampled = true; retire(person); }   // (:161)
      }
    }
    // AUDIT-RR2 G25: OnControllerColliderHit hands `other.moveDirection` (:173) - the controller's own motion, not the
    // look - so a strafing rider knocks the foe the way the horse moves; the guard arm above keeps transform.forward (:158)
    const move = moveDirection(at);
    for (const f of [...foes(), ...guards()]) {
      if (f.dead || f.puppet || (f.entity ?? f).pickpocketAttempted || !f.ai?.feet) continue;
      const dx = f.ai.feet[0] - at[0], dz = f.ai.feet[2] - at[2];
      if (dx * dx + dz * dz > reach2) continue;
      chargeFoe(f, move);
    }
  }
  return { contacts, chargeFoe };
}
