// COMBAT VOICES (C2-slice, AUDIT 23 combat-17). The decision rules
// from DFU DaggerfallEntity.GetRaceGenderAttackSound (:979-1052) /
// GetRaceGenderPainSound (:1054-1110) + EnemySounds.PlayCombatVoice
// (:158-175) and the per-foe voice race roll (:72), ported as data
// (MIT, Daggerfall Workshop). Everything rides DFU's CombatVoices
// SETTING, which ships enabled and is LIVE in the launcher (SETT);
// combatVoicesEnabled() reads the store at the point of use, as DFU
// does. Formerly a pinned constant; the SETT-slice gave it a store.
//
// The gates the callers roll (Dice100):
//   enemy-class ATTACK voice: 20% at the melee damage frame
//     (EnemyAttack.cs:217-226; gender from the mobile, the
//     Knight_CityWatch id forced male)
//   enemy-class PAIN voice on a player hit: 40%, heavyDamage =
//     damage >= maxHealth/4 (WeaponManager.cs:597-607)
//   the PLAYER's attack grunt: 20% at the hit frame, never for a
//     bow (WeaponManager.cs:385-389)

import { RACES } from '../systems/races.js';
import { getBool } from '../systems/settings.js';   // SETT: CombatVoices is a real setting now

/** DaggerfallUnity.Settings.CombatVoices, read AT THE POINT OF USE as
 *  DFU reads it (EnemyAttack.cs:217, WeaponManager.cs:385) - not
 *  latched at import, so changing it in the launcher takes effect on
 *  the next swing rather than the next reload. The SETT-slice made
 *  this a real setting; it was a pinned constant before. */
export const combatVoicesEnabled = () => getBool('Enhancements', 'CombatVoices');

export const ATTACK_VOICE_CHANCE = 20;   // enemy class + player grunt
export const PAIN_VOICE_CHANCE = 40;

/** EnemySounds:72 - each foe's voice race is ROLLED at spawn:
 *  Range(1, 5+1) = Breton..HighElf. */
export const rollVoiceRace = (rolls = Math.random) => 1 + Math.floor(rolls() * 5);

// The classic clip ids (SoundClips.cs). Male voices run in per-race
// pairs from 390; the female set lives in the 43..62 block with the
// shared-clip quirks preserved below.
const MALE_PAIN1 = Object.freeze({
  [RACES.Breton]: 390, [RACES.Redguard]: 393, [RACES.Nord]: 396,
  [RACES.DarkElf]: 399, [RACES.HighElf]: 402, [RACES.WoodElf]: 405,
  [RACES.Khajiit]: 408, [RACES.Argonian]: 411,
});

/** GetRaceGenderAttackSound, verbatim decision (the attack bark IS
 *  the race's Pain1-family pick). Female voices share clips:
 *  Breton/Redguard/Nord roll one of THREE (BretonFemalePain1/2 or
 *  DarkElfFemalePain2); DarkElf/HighElf/WoodElf roll one of TWO
 *  HighElf clips; Khajiit and Argonian their own pairs. */
export function raceGenderAttackSound(race, gender, rolls = Math.random) {
  if (gender === 'male') return MALE_PAIN1[race] ?? -1;
  if (race === RACES.Breton || race === RACES.Redguard || race === RACES.Nord) {
    const r = Math.floor(rolls() * 3);
    return r === 0 ? 43 : r === 1 ? 44 : 53;
  }
  if (race === RACES.DarkElf || race === RACES.HighElf || race === RACES.WoodElf) {
    return Math.floor(rolls() * 2) === 0 ? 55 : 56;
  }
  if (race === RACES.Khajiit) return Math.floor(rolls() * 2) === 0 ? 61 : 62;
  if (race === RACES.Argonian) return Math.floor(rolls() * 2) === 0 ? 425 : 426;
  return -1;
}

/** GetRaceGenderPainSound, verbatim decision: males take the race's
 *  Pain2; females fork on heavyDamage - the big shared group lands
 *  NordFemalePain2 heavy and rolls Redguard/DarkElf Pain1 light;
 *  WoodElf/Khajiit ride the WoodElf pair. */
export function raceGenderPainSound(race, gender, heavyDamage, rolls = Math.random) {
  if (gender === 'male') {
    const p1 = MALE_PAIN1[race];
    return p1 != null ? p1 + 1 : -1;
  }
  if (race === RACES.WoodElf || race === RACES.Khajiit) {
    return heavyDamage ? 59 : 58;
  }
  if (race === RACES.Breton || race === RACES.Redguard || race === RACES.Nord ||
      race === RACES.DarkElf || race === RACES.HighElf || race === RACES.Argonian) {
    if (heavyDamage) return 50;
    return Math.floor(rolls() * 2) === 0 ? 46 : 52;
  }
  return -1;
}

/** EnemySounds.PlayCombatVoice: the male HighElf voice swaps to
 *  WoodElf (the source's own comment - it sounds odd from NPCs), the
 *  clip picks by attack/pain, and the play lifts pitch by a random
 *  0..0.3. Returns { clip, pitchLift } for the host's audio seam;
 *  clip -1 = nothing to play. */
export function combatVoice({ race, gender, isAttack, heavyDamage = false, rolls = Math.random }) {
  let r = race;
  // AUDIT 24 (wave 46): the swap below is EnemySounds.PlayCombatVoice's
  // alone, and its comment says why - "Male high elf sounds sound odd
  // when coming from NPCs". The PLAYER's two voices do not route
  // through it: FPSWeapon.PlayAttackVoice (:315) and
  // PlayerFootsteps.RemoveHealth (:358) both call
  // GetRaceGender*Sound DIRECTLY. So a male High Elf player grunts
  // and screams as a High Elf, and a male High Elf ENEMY as a Wood
  // Elf - use playerVoice() for the player, never this.
  //
  // (DFU's swap also WRITES the field - `RaceForSounds = WoodElf` -
  // so an enemy's voice race changes permanently on the first male
  // call. Not observable: an enemy's gender is fixed per entity, so
  // every later call would swap again anyway. Recorded, not chased.)
  if (gender === 'male' && r === RACES.HighElf) r = RACES.WoodElf;
  const clip = isAttack
    ? raceGenderAttackSound(r, gender, rolls)
    : raceGenderPainSound(r, gender, heavyDamage, rolls);
  return { clip, pitchLift: rolls() * 0.3 };
}

/** WeaponManager.cs:597: heavyDamage = damage >= maxHealth / 4. */
export const isHeavyDamage = (damage, maxHealth) => damage >= Math.trunc(maxHealth / 4);

/**
 * The PLAYER's voice - the same clip tables, none of PlayCombatVoice's
 * NPC handling. FPSWeapon.PlayAttackVoice:308-320 and
 * PlayerFootsteps.RemoveHealth:347-364 are the two call sites, and
 * both read the player's OWN race and gender, roll the same 0..0.3
 * pitch lift, and skip the High Elf swap entirely.
 *
 * AUDIT 39 retired the flag that stood here. It said the port had no
 * racial-override effect to ask, and both curses had already shipped:
 * `GetCustomRaceGenderAttackSoundData` picks the grunt's clip at the
 * CALLER (hostCombat's playerAttackGrunt asks the vampire), and
 * `SuppressOptionalCombatVoices` - the half that was genuinely
 * unported - gates BOTH voices at the same caller, ahead of their
 * Dice100 draws, because that is where DFU tests it
 * (WeaponManager.cs:385-388, PlayerFootsteps.cs:352-354). This
 * function stays what it always was: the clip tables, by race and
 * gender, with none of PlayCombatVoice's NPC handling.
 */
export function playerVoice({ race, gender, isAttack, heavyDamage = false, rolls = Math.random }) {
  const clip = isAttack
    ? raceGenderAttackSound(race, gender, rolls)
    : raceGenderPainSound(race, gender, heavyDamage, rolls);
  return { clip, pitchLift: rolls() * 0.3 };
}
