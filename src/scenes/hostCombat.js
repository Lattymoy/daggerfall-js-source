// AUDIT 18 (hosts): the combat/spawn laws that the four scene hosts
// each carried a private copy of - or, more often, that ONE host
// carried and the others silently dropped. Everything here is a
// verbatim DFU translation with no scene state of its own, so a host
// cannot half-apply it any more.
//
// DFU sources: WeaponManager.cs, EnemyMotor.cs, EnemyEntity.cs,
// FormulaHelper.cs, DaggerfallUnityItem.cs, PlayerActivate.cs
// (MIT, Daggerfall Workshop).

import { SKILLS, tallySkill, skillValue, SKILL_NAMES } from '../systems/skills.js';
import { vampireAttackVoice } from '../systems/vampirism.js';   // V5: GetCustomRaceGenderAttackSoundData
import { liveLycanthropy } from '../systems/lycanthropy.js';   // AUDIT 39: SuppressOptionalCombatVoices, the racial override's own gate
import {
  ENEMY_GROUPS, dice100,
  enemyKnockbackApplies, weaponKnockbackSpeed, enemyWeightClassicUnits,   // MT-ii: ApplyDamageToNonPlayer's knockback
} from '../combat/formulas.js';
import { combatVoicesEnabled, ATTACK_VOICE_CHANCE, PAIN_VOICE_CHANCE, combatVoice, playerVoice, rollVoiceRace, isHeavyDamage } from '../combat/combatVoices.js';   // C2-slice; playerVoice AUDIT 24 (wave 46)
import { RACES } from '../systems/races.js';   // C2-slice: the player grunt's race
import { assignEnemyEquipment, equipmentVariantFor, equipmentItems } from '../combat/enemyEquipment.js';
import { rollEnemyWeaponPoison } from '../systems/poisons.js';
import { EQUIP_SLOTS, equipTableOf, getEquipSlot } from '../systems/equip.js';   // AUDIT 54: ItemHelper's EquipItem half - a foe's equip table is what DamageEquipment's struck side reads
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { swingSoundFor, hitSoundFor } from '../systems/soundClips.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';
import { ATTRACT_RADIUS } from '../characters/enemySounds.js';   // AUDIT 24 (wave 41)
import { enemyDisplayName } from '../characters/enemyBasics.js';   // AUDIT 24 (wave 42)
import { comprehendLanguagesChance } from '../systems/effects.js';   // X11: the pacification bonus DFU reads inside its own formula

// ---- DaggerfallUnityItem.GetWeaponSkillUsed / GetWeaponSkillIDAsShort ----
/** The attack skill is a property of the weapon TEMPLATE, never of its
 *  display name. Reading the skill out of a display-name table
 *  (what every host
 *  did) misses every renamed item: createRegularMagicItem overwrites
 *  `name` with the enchantment's magic-item name, so an enchanted
 *  Longsword trained - and rolled to hit with - Hand-to-Hand for the
 *  rest of the game. DaggerfallUnityItem.cs:910-941 + :943-962,
 *  keyed on Weapons (ItemEnums.cs:113..130). */
export const WEAPON_SKILL_BY_TEMPLATE = Object.freeze({
  113: SKILLS.ShortBlade,   // Dagger
  114: SKILLS.ShortBlade,   // Tanto
  115: SKILLS.BluntWeapon,  // Staff
  116: SKILLS.ShortBlade,   // Shortsword
  117: SKILLS.ShortBlade,   // Wakazashi
  118: SKILLS.LongBlade,    // Broadsword
  119: SKILLS.LongBlade,    // Saber
  120: SKILLS.LongBlade,    // Longsword
  121: SKILLS.LongBlade,    // Katana
  122: SKILLS.LongBlade,    // Claymore
  123: SKILLS.LongBlade,    // Dai-Katana
  124: SKILLS.BluntWeapon,  // Mace
  125: SKILLS.BluntWeapon,  // Flail
  126: SKILLS.BluntWeapon,  // Warhammer
  127: SKILLS.Axe,          // Battle Axe
  128: SKILLS.Axe,          // War Axe
  129: SKILLS.Archery,      // Short Bow
  130: SKILLS.Archery,      // Long Bow
});

/** GetWeaponSkillIDAsShort: null (Skills.None) for anything that is
 *  not one of the 18 weapon templates. */
export function weaponSkillUsed(templateIndex) {
  return WEAPON_SKILL_BY_TEMPLATE[templateIndex] ?? null;
}

/** CalculateAttackDamage's skillID pick (FormulaHelper.cs:573-590):
 *  the weapon's skill, or HandToHand with no weapon. */
export function attackSkillOf(weapon) {
  return weaponSkillUsed(weapon?.templateIndex) ?? SKILLS.HandToHand;
}

/** WeaponManager's `ScreenWeapon.WeaponType == WeaponTypes.Bow` test,
 *  read off the item rather than the viewmodel. */
export const isBowWeapon = (weapon) => attackSkillOf(weapon) === SKILLS.Archery;

// ---- EnemyMotor.cs:131-137 ----
/** A mobile has a bow attack if it has RangedAttack1 and does not cast
 *  magic, or has BOTH ranged flags. NOTHING about the enemy's
 *  inventory enters this: AssignEnemyStartingEquipment never rolls a
 *  bow, so minting `rangedAttack` from an equipped bow (what every
 *  host did) meant no enemy in the game could ever fire one. */
export const hasBowAttack = (basics) =>
  !!basics?.hasRangedAttack1 && (!basics?.castsMagic || !!basics?.hasRangedAttack2);

// ---- EnemyEntity.SetEnemyCareer, the equipment chain (EnemyEntity.cs:330-347) ----
/** DFU runs the equipment chain by careerIndex BEFORE the class arm:
 *  Orc(7)/OrcShaman(21) -> SetEnemyEquipment(0), Centaur(8)/
 *  OrcSergeant(12) -> (1), OrcWarlord(24) -> (2), and only then
 *  EnemyClass -> Random.Range(0,2). equipmentVariantFor already
 *  carries that whole table; the monster spawn path just never called
 *  it, so five equipment-using monsters walked in naked.
 *
 *  Order note: GenerateItems(LootTableKey) runs FIRST (EnemyEntity.cs:
 *  328) and the equipment items are appended after - callers must have
 *  filled `entity.items` before calling this. */
export function equipEnemy(entity, mobileType, playerLevel) {
  const variant = equipmentVariantFor(entity.careerIndex, entity.isClass);
  if (variant === null) return null;
  const eq = assignEnemyEquipment(entity, variant, playerLevel);
  entity.armorValues = eq.armorValues;
  entity.weapon = eq.rightHand;
  // S19b: ItemHelper's poisoned-weapon roll rides the spawn -
  // class enemies + Orc/Centaur/OrcSergeant, 5% (Assassin 60%)
  if (entity.weapon) {
    const pt = rollEnemyWeaponPoison(mobileType, playerLevel);
    if (pt != null) entity.weapon.poisonType = pt;
  }
  // AssignEnemyStartingEquipment adds every equipped piece to the
  // entity's items - the corpse's droppable loot.
  entity.items = entity.items ?? [];
  const worn = equipmentItems(eq);
  entity.items.push(...worn);
  // AUDIT 54: AND IT PUTS THEM ON. ItemHelper.cs:1382/:1392/:1400 and
  // :1421-1450 pair every roll with
  // `enemyEntity.ItemEquipTable.EquipItem(item, true, false)` before
  // `Items.AddItem(item)` - a foe's table is genuinely worn, and
  // EnemyEntity.cs:414-421 walks it. The port wrote only the summary
  // arrays, so `equipTableOf(target)` handed back the lazy all-null
  // table (equip.js:40-41) for every enemy in the game and
  // FormulaHelper.DamageEquipment's STRUCK side - the shield at
  // FormulaHelper.cs:1095 and the struck part's armour at :1113 -
  // could not fire once: only the attacker's own weapon ever took
  // condition off a foe.
  //
  // The placement is DFU's `playEquipSounds: false` load arm, the
  // shape rebuildEquipState already uses: the slot takes the item and
  // nothing else runs. It does NOT go through equipItem, because that
  // would re-derive armorValues through the generic
  // updateEquippedArmorValues and double-subtract over the
  // SetEnemyEquipment pass above, which owns the Feet-exclusive bound
  // (EnemyEntity.cs:414) and the class/monster clamps.
  //
  // The port's `item.equipSlot` mark is deliberately NOT written: it
  // is this port's device for the PLAYER's list filter
  // (FilterLocalItems) and the save relink, and DFU's items carry no
  // such field - the equip state lives in the entity's table, which
  // dies with the entity. Marking a foe's gear would hide its own
  // corpse's loot from every inventory tab. Nothing needs the mark:
  // DamageEquipment reads the table, and a break unequips through
  // DaggerfallUnityItem.UnequipItem's identity scan (equip.js's
  // unequipItem), which is how DFU finds the slot too.
  const slots = equipTableOf(entity);
  for (const it of worn) {
    const slot = getEquipSlot(entity, it);   // GetEquipSlot routes the shield to LeftHand and each piece to its own slot
    if (slot === EQUIP_SLOTS.None || slots[slot]) continue;
    slots[slot] = it;
  }
  return eq;
}

// ---- WeaponManager.cs:72 / :419-436 ----
/** "According to DF Chronicles and verified in classic." Spent on
 *  EVERY swing that reaches the hit frame, hit or miss. */
export const SWING_WEAPON_FATIGUE_LOSS = 11;

/** The tally half of the same block: the weapon's own skill (or
 *  HandToHand for a bare-handed/werecreature swing) AND CriticalStrike,
 *  once per connecting swing. CriticalStrike was tallied nowhere in the
 *  port, so a skill that feeds every to-hit roll could never advance. */
export function tallySwingSkills(player, weapon) {
  tallySkill(player, attackSkillOf(weapon), 1);
  tallySkill(player, SKILLS.CriticalStrike, 1);
}

// ---- FormulaHelper.CalculateBackstabChance (FormulaHelper.cs:975-990) ----
/** The tally is INSIDE the chance calculation in DFU, so every
 *  back-facing swing counts a Backstabbing use whether or not the x3
 *  roll lands. No host tallied it, so Backstabbing could never rise. */
export function backstabChanceOf(player, isEnemyFacingAwayFromPlayer) {
  if (!isEnemyFacingAwayFromPlayer) return 0;
  tallySkill(player, SKILLS.Backstabbing, 1);
  return skillValue(player, SKILLS.Backstabbing);
}

// ---- GetBonusOrPenaltyByEnemyType, the PlayerEntity arm (FormulaHelper.cs:1037-1053) ----
/** DFU: `else if (target is PlayerEntity)` -> Undead when the player
 *  has vampirism, otherwise "Player is assumed humanoid". The port has
 *  no vampirism (diseases.js routes stage-one infection away), so the
 *  Undead arm is unreachable and the player is always Humanoid.
 *  Passing `targetGroup: null` - what all three enemy-vs-player call
 *  sites did - made the whole modifier dead against the player. */
// AUDIT 18: retired. calculateAttackDamage no longer takes a targetGroup -
// bonusOrPenaltyByEnemyType derives it from the TARGET ENTITY, and the
// player's isPlayer flag selects DFU's "player is assumed humanoid" arm
// (FormulaHelper.cs:1048). Passing a group in was an ignored key.

// ---- WeaponManager.cs:609-615, the ZERO-damage connected swing ----
export const PARRY_1 = 428;          // SoundClips.Parry1
export const PARRY_SOUND_COUNT = 9;  // Random.Range(0, 9)

/**
 * A swing that CONNECTED but dealt no damage. DFU:
 *   if ((!arrowHit && !enemy.ParrySounds) || strikingWeapon == null)
 *       ScreenWeapon.PlaySwingSound();
 *   else if (enemy.ParrySounds)
 *       enemySounds.PlayParrySound();     // Parry1 + Range(0,9), at the ENEMY
 * The hosts instead played WeaponManager.cs:483's WALL-hit pair
 * (Hit2 / Parry6) - a branch DFU's own comment marks "not in classic".
 * @returns {{sound:number, at:'player'|'enemy'}|null}
 */
export function zeroDamageHitSound({ weapon = null, arrowHit = false, parrySounds = false, roll = 0 } = {}) {
  if ((!arrowHit && !parrySounds) || !weapon) return { sound: swingSoundFor(weapon), at: 'player' };
  if (parrySounds) return { sound: PARRY_1 + Math.floor(roll * PARRY_SOUND_COUNT), at: 'enemy' };
  return null;
}

// ---- C2-slice (AUDIT 23 combat-9/17): the enemy melee frame's sound
// tail + the combat voices, shared so every host speaks the same. ----

/** EnemySounds.PlayMissSound: an attack that whiffed (out of reach)
 *  or lost the hit roll - armed foes ring their weapon's swing clip,
 *  barehanded the high pitch (swingSoundFor's null arm IS that). */
export const enemyMissSound = (weapon) => swingSoundFor(weapon);

/** MobileTypes.Knight_CityWatch - the one class id whose voice is
 *  FORCED male whatever the mobile rolled (EnemyAttack.cs:220/:357). */
export { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';   // AUDIT 24 (wave 41): one home

/** The foe's voice gender per the source's pick: the mobile's
 *  gender, with the city-watch knight forced male. */
const foeVoiceGender = (f) =>
  (f.gender === 'female' && f.mobileType !== KNIGHT_CITY_WATCH ? 'female' : 'male');

/** The foe's spawn-rolled voice race (EnemySounds:72 rolls it once
 *  per foe); the port rolls lazily at first use and caches - one
 *  race per foe, same as the spawn roll. */
const foeVoiceRace = (f, rolls) => (f.voiceRace ??= rollVoiceRace(rolls));

/** The 20% enemy-class ATTACK voice at the melee damage frame
 *  (EnemyAttack.cs:217-226), behind the CombatVoices setting.
 *  Returns { clip, pitchLift } or null. */
export function enemyAttackVoice(f, rolls = Math.random) {
  if (!combatVoicesEnabled() || !f.entity?.isClass) return null;
  if (!dice100(ATTACK_VOICE_CHANCE, rolls())) return null;
  return combatVoice({ race: foeVoiceRace(f, rolls), gender: foeVoiceGender(f), isAttack: true, rolls });
}

/** The 40% enemy-class PAIN voice when the player's hit lands
 *  (WeaponManager.cs:597-607); heavyDamage = damage >= maxHealth/4.
 *  Returns { clip, pitchLift } or null. */
export function enemyPainVoice(f, damage, rolls = Math.random) {
  if (!combatVoicesEnabled() || !f.entity?.isClass || damage <= 0) return null;
  if (!dice100(PAIN_VOICE_CHANCE, rolls())) return null;
  return combatVoice({
    race: foeVoiceRace(f, rolls), gender: foeVoiceGender(f), isAttack: false,
    heavyDamage: isHeavyDamage(damage, f.entity.maxHealth ?? 0), rolls,
  });
}

/** RacialOverrideEffect.SuppressOptionalCombatVoices
 *  (RacialOverrideEffect.cs:37-40, false by default). LycanthropyEffect
 *  .cs:105-108 is the ONE override and it returns isTransformed - a
 *  transformed lycanthrope has its own attack voices (the beast bark
 *  the hosts play on a landed hit), so the human grunt and scream are
 *  silenced while the beast is out. Vampirism does not override it; it
 *  overrides the CLIP instead (the grunt below). Asked AHEAD of the
 *  Dice100 draw at both sites, exactly as DFU asks it, so the roll
 *  stream is unchanged. */
export const suppressOptionalCombatVoices = (entity) => !!liveLycanthropy(entity)?.isTransformed;

/** The PLAYER's 20% attack grunt at the hit frame - never for a bow
 *  (WeaponManager.cs:385-389). V5: the racial override's clip rides
 *  GetRaceGenderAttackSound's own order (DaggerfallEntity.cs:979-988)
 *  - the 20% FIRE chance stays here, the OVERRIDE picks the clip, so
 *  a vampire grunts as a vampire, by gender. Returns
 *  { clip, pitchLift } or null. */
export function playerAttackGrunt(playerEntity, isBow, rolls = Math.random) {
  if (!combatVoicesEnabled() || suppressOptionalCombatVoices(playerEntity) || isBow) return null;
  if (!dice100(ATTACK_VOICE_CHANCE, rolls())) return null;
  const vamp = vampireAttackVoice(playerEntity, rolls);
  if (vamp != null) return { clip: vamp, pitchLift: 0 };
  // AUDIT 24 (wave 46): playerVoice, not combatVoice. FPSWeapon
  // .PlayAttackVoice:315 calls GetRaceGenderAttackSound DIRECTLY and
  // never touches PlayCombatVoice, so the male High Elf -> Wood Elf
  // swap does NOT apply to the player - it is EnemySounds' handling
  // of NPCs, by its own comment. A male High Elf player has been
  // grunting as a Wood Elf since the C2 slice.
  return playerVoice({
    race: RACES[playerEntity.race] ?? 1, gender: playerEntity.gender ?? 'male', isAttack: true, rolls,
  });
}

/**
 * PlayerFootsteps.RemoveHealth (:347-364) - the player's pain voice,
 * which the port had never played. The clip tables were ported with
 * the C2 slice and the ENEMY side has used them since; the player
 * took every hit in the game in silence.
 *
 * Forty percent, the player's own race and gender, heavyDamage at a
 * quarter of MAX health, and the same 0..0.3 pitch lift. Returns
 * `{ clip, pitchLift }` or null - the host owns the audio device.
 *
 * WHICH HITS SCREAM is narrower than "the player was damaged", and it
 * is not the same set the damage FLASH rides. Both hang off the
 * `RemoveHealth` message, but Unity's SendMessage reaches every
 * component and a direct C# call reaches one:
 *
 *   - EnemyAttack.cs:406 SENDS it -> PlayerHealth (flash) AND
 *     PlayerFootsteps (voice). A blow, or an arrow through BowDamage.
 *   - DaggerfallAction.cs:739/:768 SEND it -> both. The damage traps.
 *   - PlayerHealth.cs:57 CALLS ITS OWN RemoveHealth for fall damage
 *     -> the flash only. PlayerFootsteps never hears it; its own
 *     ApplyPlayerFallDamage arm (:306-311) plays the FallDamage clip
 *     and nothing else.
 *
 * So a fall flashes the screen and does not make you cry out, and
 * that is a real distinction in the source rather than an oversight
 * in the port.
 */
export function playerPainVoice(playerEntity, damage, rolls = Math.random) {
  if (!combatVoicesEnabled() || suppressOptionalCombatVoices(playerEntity) || !(damage > 0)) return null;
  if (!dice100(PAIN_VOICE_CHANCE, rolls())) return null;
  return playerVoice({
    race: RACES[playerEntity.race] ?? 1,
    gender: playerEntity.gender ?? 'male',
    isAttack: false,
    heavyDamage: isHeavyDamage(damage, playerEntity.maxHealth ?? 0),
    rolls,
  });
}

/** The two player-voice sites play the same way - one shot, at the
 *  listener, pitch-lifted. `audio.playOneShot` takes no pitch yet, so
 *  the lift is RECORDED on the returned object and dropped here; when
 *  the audio seam grows a pitch argument this is the one place that
 *  has to learn it. */
export function playPlayerVoice(audio, voice) {
  if (!voice || !(voice.clip >= 0)) return null;
  audio?.playOneShot?.(voice.clip, 1);
  return voice.clip;
}

// ---- PlayerActivate.cs:85 ----
/** CorpseActivationDistance = 150 * GlobalScale = 3.75. The hosts left
 *  corpses on activationTargets' 128-unit default (3.2), so a body was
 *  out of reach over half a metre before DFU says it is. */
// AUDIT 24 (wave 24): PlayerActivate.cs's reach constants have one
// home in player/activate.js.
export { CORPSE_ACTIVATION_DISTANCE } from '../player/activate.js';

// ---- EnemySounds through the host's devices (AUDIT 24, wave 41) ----
// The decisions and the clock live in characters/enemySounds.js; these
// two are the seam where a pool's collider and audio device meet them,
// so all three pools cast the same ray and play at the same rolloff.

/** SetVolumeScale's probe (:236-251) - the port's collider holds
 *  static geometry and action doors and nothing else, which is
 *  precisely the two things DFU dampens for, so a clear cast to the
 *  player IS "nothing between". DFU's ray is unbounded and returns
 *  first-hit, then ignores a hit on the player; bounding it at the
 *  player's distance is the same test with the same answer. */
export function enemySoundOccluded(collider, feet, playerFeet) {
  if (!collider?.raycast || !playerFeet) return false;
  const dx = playerFeet[0] - feet[0], dy = playerFeet[1] - feet[1], dz = playerFeet[2] - feet[2];
  const d = Math.hypot(dx, dy, dz);
  if (!(d > 1e-6)) return false;
  const hit = collider.raycast(feet, [dx / d, dy / d, dz / d], d);
  return Number.isFinite(hit) && hit < d - 1e-3;
}

/**
 * One foe's FixedUpdate (:79-98) plus the play. Returns the clip
 * played, or null.
 *
 * The source sits a metre above the feet - the port's established
 * enemy-sound height, which the dungeon's inline copy already used -
 * and rolls off LINEARLY to the attract radius, because that is what
 * `LinearRolloff = true` with `maxDistance = AttractRadius` (:57-60)
 * means and DFU's own comment says why: an inverse curve leaves the
 * sound "audible almost everywhere".
 */
export function tickEnemySound(source, feet, playerFeet, dt, { audio = null, collider = null, hearing = 1 } = {}) {
  if (!source || !feet) return null;
  const dx = (playerFeet?.[0] ?? 0) - feet[0];
  const dy = (playerFeet?.[1] ?? 0) - feet[1];
  const dz = (playerFeet?.[2] ?? 0) - feet[2];
  // No player position yet: the counter still steps, exactly as DFU's
  // does with playerInAttractRadius false.
  const dist = playerFeet ? Math.hypot(dx, dy, dz) : Infinity;
  const out = source.tick(dt, dist, () => enemySoundOccluded(collider, feet, playerFeet));
  if (out) playEnemyClip(audio, out, feet, hearing);
  return out;
}

/** PlayAttackSound's play, and the attract one's - the same device
 *  settings, because in DFU they are the same AudioSource. CF1:
 *  `hearing` is acuteHearingMultiplier(playerEntity) - DFU scales the
 *  enemy AudioSource's maxDistance at spawn (DaggerfallEnemy.Start
 *  :62-70); the port scales it here, on the one seam every enemy
 *  clip rides. */
export function playEnemyClip(audio, out, feet, hearing = 1) {
  if (!out || out.clip == null) return null;
  audio?.play3d?.(out.clip, [feet[0], feet[1] + 1, feet[2]], out.volume,
    { maxDistance: ATTRACT_RADIUS * hearing, distanceModel: 'linear' });
  return out.clip;
}

// ---- MT-ii: ApplyDamageToNonPlayer (EnemyAttack.cs:303-392) ----
/**
 * One enemy's blow landing on ANOTHER enemy - the whole payload DFU
 * runs when senses.Target is a foe rather than the player. It lived
 * nowhere in the port, because until MT-i no foe could hold a foe as
 * its target.
 *
 * Everything the source does, in its order: the damage roll, the
 * attacker's own normal-power concealment break, the hit sound,
 * blood, knockback (its OWN guard - see enemyKnockbackApplies), the
 * 40% class pain voice, the miss/parry fork, the Strikes payload,
 * the health write, and MakeEnemyHostileToAttacker on the target.
 *
 * THREE THINGS DFU DOES *NOT* DO HERE, and the port must not either:
 *   - onMonsterHit. FormulaHelper calls it in the weaponless MONSTER
 *     arm against the PLAYER only; a rat biting an orc infects
 *     nothing. (The exterior pool's own comment already records the
 *     same rule for its arrow and city-watch paths.)
 *   - the damage FLASH. That is the player's ShowPlayerDamage.
 *   - the Dodging tally. The player's, at the player's own hit.
 *
 * The caller owns its pool's death handling: `dealDamage(target,
 * damage)` is the target pool's damageFoe, so a foe killed by
 * another foe runs the same soul-trap/corpse/notice chain a
 * player-killed one does - EnemyEntity.DecreaseHealth is one method
 * in DFU and this is the port's one seam onto it.
 *
 * @returns the damage dealt (0 for a miss), as the source returns it.
 */
export function applyDamageToNonPlayer(attacker, target, {
  weapon = null, direction = null, bowAttack = false,
  dealDamage, calculateAttackDamage, audio = null, rolls = Math.random,
  hitEffects = null,
  // AUDIT 54: THE TWO SEAMS CalculateAttackDamage OWNS AND THIS
  // PAYLOAD NEVER OFFERED. FormulaHelper.cs:691-696 inflicts the
  // weapon's poison inside the formula for EVERY attacker/target pair
  // - `if (damage > 0 && weapon.poisonType != Poisons.None) {
  // InflictPoison(attacker, target, weapon.poisonType, false);
  // weapon.poisonType = Poisons.None; }` - with no player gate, and
  // EnemyAttack.cs:314 routes foe-vs-foe damage straight through it.
  // The port hoisted the inflict onto a hook but kept the CLEAR
  // unconditional (formulas.js), so with no hook the blade's dose was
  // SPENT and nothing was poisoned. `say` is DamageEquipment's break
  // line: ItemBreaks PopupMessages whatever the owner
  // (DaggerfallUnityItem.cs:1198-1203), so a foe's shield breaking
  // speaks in DFU too.
  onInflictPoison = null, say = null,
} = {}) {
  if (!target || !attacker) return 0;   // :305-306, `senses.Target == null`
  const aEnt = attacker.entity, tEnt = target.entity;
  // AUDIT 39: the monster multi-attack gate reads the PLAYER's Reflexes
  // setting even when the player is nowhere in the strike
  // (FormulaHelper.cs:551/:654), and neither entity here carries it.
  // Every pool seeds its striker's melee timer from the same field
  // (`new EnemyAttack({ ..., reflexes: playerEntity.reflexes })`), so
  // the value the game holds is already on the attacker's record.
  const damage = calculateAttackDamage(aEnt, tEnt, { weapon, rolls, playerReflexes: attacker.attack?.reflexes ?? null, onInflictPoison, say });
  // :316-317 - the ATTACKER's normal-power concealment breaks on a
  // landed blow, whoever it landed on.
  if (damage > 0 && attacker.breakConcealment) attacker.breakConcealment();
  const at = target.ai?.feet ?? [0, 0, 0];
  const mid = [at[0], at[1] + (target.ai?.height ?? 1.8) / 2, at[2]];
  if (damage > 0) {
    // :323 PlayHitSound at the TARGET (hitSoundFor is the port's one
    // home for EnemySounds.PlayHitSound's weapon-aware clip), then
    // :325-333 the blood splash at the target's centre + height/8.
    audio?.play3d?.(hitSoundFor(weapon), at, 1.1, { maxDistance: 16 });
    hitEffects?.showBloodSplash?.(tEnt?.basics?.bloodIndex ?? 0,
      [at[0], at[1] + (target.ai?.height ?? 1.8) / 8, at[2]]);
    // :336-350 - the knockback, on the ATTACKER-class guard
    if (target.ai && enemyKnockbackApplies(target.ai.knockbackSpeed ?? 0, aEnt?.isClass,
      tEnt?.basics?.weight)) {
      // EW1: the TARGET's kit, not the attacker's
      const w = enemyWeightClassicUnits(tEnt?.isClass, tEnt?.gender, tEnt?.basics?.weight, tEnt?.items);
      if (w > 0) {
        target.ai.knockbackSpeed = weaponKnockbackSpeed(damage, w);
        target.ai.knockbackDir = direction ?? target.ai.knockbackDir;
      }
    }
    // :353-363 - the 40% pain voice, class targets only, the
    // Knight_CityWatch id forced male (enemyPainVoice IS that law)
    const v = enemyPainVoice(target, damage, rolls);
    if (v && v.clip >= 0) audio?.play3d?.(v.clip, mid, 1, { maxDistance: 16 });
  } else {
    // :366-375 - the miss/parry fork. The MISS rings at the ATTACKER
    // (`sounds`, its own component); the PARRY at the target.
    const parries = !!tEnt?.basics?.parrySounds;
    const z = zeroDamageHitSound({ weapon, arrowHit: bowAttack, parrySounds: parries, roll: rolls() });
    if (z) {
      const where = z.at === 'enemy' ? at : (attacker.ai?.feet ?? at);
      audio?.play3d?.(z.sound, where, 1, { maxDistance: 16 });
    }
  }
  // :378-385 the Strikes payload, then :387 DecreaseHealth. The
  // enchantment door is the caller's (it owns the item seam); the
  // health write is the pool's own damageFoe, so death runs whole.
  dealDamage?.(target, damage);
  // :389-391 - and the struck foe turns on whoever hit it.
  target.ai?.makeEnemyHostileToAttacker?.(attacker, attacker.ai?.feet ?? null);
  return damage;
}

// ---- GameManager.MakeEnemiesHostile (ROAD-B, hostility model) ----
/**
 * GameManager.cs:790-806, verbatim - "Make all enemies in an area go
 * hostile":
 *
 *     foreach (DaggerfallEntityBehaviour entityBehaviour in
 *              ActiveGameObjectDatabase.GetActiveEnemyBehaviours())
 *         if (EntityType == EnemyMonster || EntityType == EnemyClass)
 *             if (enemyMotor) enemyMotor.IsHostile = true;
 *
 * ONE field, and nothing else. No target, no GiveUpTimer, no
 * remembered position - that is MakeEnemyHostileToAttacker, which DFU
 * calls SEPARATELY, right after this one, at both sites that want both
 * (DaggerfallEntityBehaviour.cs:250-261, PlayerActivate.cs:1662-1671).
 * The port's own `makeHostileToPlayer` is that other law; calling it
 * from here would give every foe in the room the player's position for
 * free, which is exactly the bug the two-call shape avoids.
 *
 * The EntityTypes filter is satisfied by construction here: every
 * record in a port pool is an EnemyEntity of one of those two types
 * (EnemyMonster or EnemyClass) - the pools mint nothing else. The
 * `if (enemyMotor)` guard is NOT free, so it stays: a record whose AI
 * has not landed yet (cityGuards' spawn crosses two awaits) has no
 * motor to write, and a dead one is not in ActiveGameObjectDatabase at
 * all (EnemyDeath destroys the GameObject).
 *
 * "In an area" is the ACTIVE DATABASE, which is one database for the
 * whole scene - so a caller hands this the union of every live pool
 * its host owns, the same join `questFoeInstances` makes.
 *
 * @param {Iterable} foes live pool records ({ ai, dead })
 * @returns {number} how many were NOT already hostile (the wiring's
 *   test seam; DFU's own loop returns nothing and writes blind)
 */
export function makeEnemiesHostile(foes) {
  let flipped = 0;
  for (const f of foes ?? []) {
    if (!f || f.dead || !f.ai) continue;
    if (!f.ai.isHostile) flipped++;
    f.ai.isHostile = true;
  }
  return flipped;
}

// ---- First-encounter language pacification (AUDIT 24, wave 42) ----
/**
 * EnemySenses.cs:504-527. On the FIRST time an enemy detects the
 * player, its language skill is rolled: a success stands it down
 * (`motor.IsHostile = false`) and tallies the skill by THREE - DFU's
 * BCHG over classic's one, "to make raising language skills easier" -
 * and a failure tallies ONE, except for Etiquette and Streetwise,
 * which get nothing for failing.
 *
 * The port had the formulas (`enemyLanguageSkill`,
 * `calculateEnemyPacification`) and the motor raised `justEncountered`
 * for every pool - and exactly one caller consumed it, inline in the
 * dungeon frame body. Above ground no monster and no watchman was ever
 * talked down, in a game where language skills are a third of the
 * stealth build.
 *
 * DFU's guards: `!questBehaviour` (a quest foe cannot be pacified) and
 * the entity being EnemyMonster or EnemyClass. `isQuestFoe` carries
 * the first; the pools only ever hold the second.
 */
export function tryLanguagePacification(ai, entity, mobileType, playerEntity, {
  sheathed = false, enemyLanguageSkill, calculateEnemyPacification, say = () => {}, isQuestFoe = false,
} = {}) {
  if (!ai?.justEncountered) return null;
  ai.justEncountered = false;   // the EDGE is consumed whatever happens next
  if (isQuestFoe) return null;
  const lang = enemyLanguageSkill(entity);
  if (lang === -1) return null;   // Skills.None - most monsters have no tongue
  // X11: COMPREHEND LANGUAGES. DFU reads the live effect off
  // PlayerEffectManager inside CalculateEnemyPacification itself
  // (FormulaHelper.cs:377-380); the port hands it in, because
  // combat/formulas.js cannot import systems/effects.js without the
  // cycle its concealment leaf exists to dodge. This is the one seam
  // all three enemy pools share, so one read covers dungeon foes,
  // exterior foes and the city watch alike.
  const comprehend = comprehendLanguagesChance(playerEntity);
  if (calculateEnemyPacification(playerEntity, lang, sheathed, undefined, comprehend)) {
    ai.isHostile = false;
    say(`${enemyDisplayName(mobileType) ?? 'The enemy'} is pacified by your ${SKILL_NAMES[lang]} skill.`);   // languagePacified %e/%s
    tallySkill(playerEntity, lang, 3);
    return { pacified: true, lang };
  }
  // :525-526 - a failed roll still counts as USING a monster tongue,
  // but Etiquette and Streetwise get nothing for being ignored.
  if (lang !== SKILLS.Etiquette && lang !== SKILLS.Streetwise) tallySkill(playerEntity, lang, 1);
  return { pacified: false, lang };
}

