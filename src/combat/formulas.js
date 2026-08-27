// Combat formulas (C8 E3b). Verbatim ports from DFU FormulaHelper.cs
// / Dice100.cs / DaggerfallUnityItem.cs / DFCareer.cs (MIT,
// Daggerfall Workshop). Every function cites its source; classic's
// bugs are PRESERVED where DFU preserves them (dodging uses /4 and
// is applied as a flat penalty; the enemy-type bonus that classic
// gated behind max-enchantment weapons follows DFU's always-on port).
// Entity shape (ours): { level, health, maxHealth, armor, skills
// (flat, per SetEnemyCareer), stats: {strength, agility, luck},
// attackModifierFlags (career CFG byte), isPlayer }.
// FLAGGED interims (all documented at their site): proficiency
// modifiers and the enchantment channels. (AUDIT 23: adrenaline rush,
// biography adjustments and per-part armor SHIPPED - the first two
// live in this very file.)

import { MELEE_DISTANCE } from '../characters/enemyMotor.js';   // single source (EnemyAttack.cs:30)
import { CLASSIC_TO_UNITY_RATIO } from '../player/motor.js';   // C15 knockback units
import { rand } from '../formats/dfRandom.js';
import { enchantArmorMod, enchantChanceToHitMod, enchantWeightAllowanceMult, doItemEnchantmentPayloads, PAYLOAD, isEnchantedItem } from '../systems/enchantments.js';   // E1: the enchantment channels + the Strikes payload   // the monster multi-attack reflex gate (F2)
import { liveStat } from '../systems/statMods.js';   // S14: fortify-aware stat reads
import { skillValue, SKILLS } from '../systems/skills.js';   // S3: real skills (enemies stay flat, verbatim)
import { RACES } from '../systems/races.js';   // CalculateRacialModifiers reads the DFU-numbered race id
import { SPECIAL_ABILITY_BITS } from '../systems/specialAdvantages.js';   // AUDIT 21 F2: the Adrenaline Rush bit
// NOT from rest.js, which re-exports healingRateModifier FROM here - importing
// hasSpecialAbility back out of it makes a cycle, and the ESM binding lands in
// the temporal dead zone: the helper reads `undefined` at call time and the
// bonus silently never applies. specialAdvantages.js is a leaf.
import { weaponMinDamage, weaponMaxDamage, weaponSkillUsed } from '../characters/weapons.js';   // AUDIT 18: GetBaseDamageMin/Max and GetWeaponSkillIDAsShort resolve the TEMPLATE, never a baked field or a display name
import { equipTableOf, lowerCondition, slotForBodyPart, EQUIP_SLOTS } from '../systems/equip.js';   // C-slice: DamageEquipment
import { SHIELD_PARTS } from '../systems/armorMaterials.js';
import { breakNormalPowerConcealment } from '../systems/concealment.js';   // wave 31: BreakNormalPowerConcealmentEffects, in its own leaf so this import cannot cycle

// ---- Dice100.cs verbatim ----
export const dice100 = (chance, roll01 = Math.random()) => Math.floor(roll01 * 100) < chance;   // Random.Range(0,100) < chance

// ---- FormulaHelper.DamageModifier ----
export const damageModifier = (strength) => Math.floor((strength - 50) / 5);

// ---- U10 / ONE DFU MEMBER, ONE EXPORT: the rest of FormulaHelper's
// DERIVED STATS (FormulaHelper.cs:66-125). The chargen bonus-stats
// screen shows all seven in one block, and the port had them
// scattered - MaxEncumbrance inline in charsheet.js, MagicResist
// inline in spellcast.js, HealingRateModifier in rest.js, SpellPoints
// in chargen.js - with ToHitModifier and HitPointsModifier missing
// entirely. They live here, beside DamageModifier, and the old sites
// import them.
export const maxEncumbrance = (strength) => Math.floor(strength * 1.5);
/** DaggerfallEntity.GetMaxEncumbrance (:501-507) and the
 *  `MaxEncumbrance` property that is its one reader (:272). The
 *  ENTITY's ceiling is the formula above over live strength PLUS the
 *  IncreasedWeightAllowance multiplier the enchantment fold holds
 *  (`amount += (int)(amount * multiplier)` - the cast truncates, and
 *  the multiplier is only added when > 0).
 *
 *  Which of the two a call site wants is DFU's own split: everything
 *  reading a LIVE entity (inventory, character sheet, the bank's gold
 *  weight gate, the trade window's proceeds) reads this; the chargen
 *  bonus-stats screen reads the raw formula off working stats
 *  (CreateCharAddBonusStats.cs:157), because there is no entity yet. */
export const entityMaxEncumbrance = (entity) => {
  const amount = maxEncumbrance(liveStat(entity, 'strength'));
  const mult = enchantWeightAllowanceMult(entity);
  return mult > 0 ? amount + Math.trunc(amount * mult) : amount;
};
/** L-slice (combat-16): the HUD line for a weapon whose material
 *  cannot bite the target (key "materialIneffective"; prose ours). */
export const MATERIAL_INEFFECTIVE_TEXT = 'Your weapon is ineffective against this creature.';
export const spellPointsFor = (intelligence, multiplier) => Math.floor(intelligence * multiplier);
export const magicResist = (willpower) => Math.floor(willpower / 10);
export const toHitModifier = (agility) => Math.floor(agility / 10) - 5;
export const hitPointsModifier = (endurance) => Math.floor(endurance / 10) - 5;
/** DFU deliberately skips classic's negative-modifier-plus-one bug;
 *  so do we (the note rest.js carried since S20). */
export const healingRateModifier = (endurance) => Math.floor(endurance / 10) - 5;

// ---- CalculateHandToHandMin/MaxDamage (int division) ----
export const handToHandMinDamage = (skill) => Math.floor(skill / 10) + 1;
export const handToHandMaxDamage = (skill) => Math.floor(skill / 5) + 1;   // the character-sheet rule, not the Chronicles table

// ---- CalculateWeaponMin/MaxDamage switch tables ----
export const WEAPON_MIN_DAMAGE = Object.freeze({
  Dagger: 1, Tanto: 1, Wakazashi: 1, Shortsword: 1, Broadsword: 1, Staff: 1, Mace: 1,
  Longsword: 2, Claymore: 2, 'Battle Axe': 2, 'War Axe': 2, Flail: 2,
  Saber: 3, Katana: 3, 'Dai-Katana': 3, Warhammer: 3,
  'Short Bow': 4, 'Long Bow': 4,
});
export const WEAPON_MAX_DAMAGE = Object.freeze({
  Dagger: 6, Tanto: 8, Shortsword: 8, Staff: 8, Wakazashi: 10,
  Broadsword: 12, Saber: 12, 'Battle Axe': 12, Mace: 12, Flail: 14,
  Longsword: 16, Katana: 16, 'War Axe': 16, 'Short Bow': 16,
  Claymore: 18, Warhammer: 18, 'Long Bow': 18, 'Dai-Katana': 21,
});

/** DaggerfallUnityItem.GetBaseDamageMin/GetBaseDamageMax
 *  (DaggerfallUnityItem.cs:969-977), verbatim: DFU NEVER stores a
 *  weapon's damage on the item - it resolves the TEMPLATE INDEX
 *  through CalculateWeaponMin/MaxDamage on every swing.
 *
 *  AUDIT 18 F1: the port read `weapon.minDamage`/`weapon.maxDamage`
 *  instead, fields only enemyEquipment.createWeapon and the retired
 *  INTERIM_WEAPON ever baked. S3d's assignStartingGear mints its
 *  weapons from the item templates - {group, templateIndex, material,
 *  name, value} - so the moment starting gear replaced the interim
 *  dagger, EVERY armed player swing computed `undefined + ...` = NaN.
 *  Deriving from the template, as DFU does, is both the fix and the
 *  reason a baked field can never rot again. */
export const baseDamageMin = (weapon) => weaponMinDamage(weapon?.templateIndex);
export const baseDamageMax = (weapon) => weaponMaxDamage(weapon?.templateIndex);

// ---- DaggerfallUnityItem.GetWeaponMaterialModifier (index = material 0..9) ----
export const WEAPON_MATERIAL_MODIFIER = Object.freeze([-1, 0, 0, 1, 2, 3, 3, 4, 5, 6]);

// ---- CalculateStruckBodyPart ----
const BODY_PARTS = Object.freeze([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6]);
export const calculateStruckBodyPart = (roll01 = Math.random()) => BODY_PARTS[Math.floor(roll01 * BODY_PARTS.length)];

// ---- DFCareer.StructureData attack-modifier bit table ----
export const ENEMY_GROUPS = Object.freeze({ None: -1, Undead: 0, Daedra: 1, Humanoid: 2, Animals: 3 });
const GROUP_BITS = Object.freeze([[0x01, 0x10], [0x02, 0x20], [0x04, 0x40], [0x08, 0x80]]);   // [bonus, phobia] per group
/** DFCareer.GetAttackModifier (DFCareer.cs:817-848), verbatim: the two
 *  bits are decoded EXCLUSIVELY, bonus first - `if (HasFlags(0x01))
 *  result = Bonus; else if (HasFlags(0x10)) result = Phobia;`. The
 *  resolved AttackModifier enum (Normal 0 / Bonus 1 / Phobia 2) is
 *  what GetBonusOrPenaltyByEnemyType then masks, so a career carrying
 *  BOTH bits for one group is a BONUS in DFU, never a wash.
 *  AUDIT 18: the port summed the raw bits instead (+1 and -1 netting
 *  0) and its comment asserted the inverse of the C#. Vanilla data
 *  never sets both (every CLASS*.CFG and ENEMY*.CFG byte in ARENA2 is
 *  0x00 or 0x04), but U20b's custom-class builder ORs them
 *  independently, so "Bonus to hit: Undead" + "Phobia: Undead" = 0x11
 *  reaches here. */
export function careerAttackModifier(attackModifierFlags, group) {
  const [bonus, phobia] = GROUP_BITS[group] ?? [];
  if (bonus == null) return 0;                                     // EnemyGroups.None
  if ((attackModifierFlags & bonus) === bonus) return 1;
  if ((attackModifierFlags & phobia) === phobia) return -1;
  return 0;
}

/** FormulaHelper.GetEnemyEntityEnemyGroup (FormulaHelper.cs:2746-2805),
 *  verbatim: the switch is on CareerIndex, NOT on MobileEnemy.Affinity.
 *  The four atronachs, the horse and every unlisted career are None.
 *  (Careers whose classic grouping disagrees carry DFU's own comment.) */
const ENEMY_GROUP_BY_CAREER = Object.freeze({
  0: 3, 3: 3, 4: 3, 5: 3, 6: 3, 11: 3, 20: 3, 34: 3, 39: 3, 40: 3,          // Animals (39/40 "grouped as undead in classic")
  1: 2, 2: 2, 7: 2, 8: 2, 9: 2, 10: 2, 12: 2, 13: 2, 14: 2, 16: 2,          // Humanoid
  21: 2, 22: 2, 24: 2, 41: 2, 42: 2,                                        // (41/42 "grouped as undead in classic")
  15: 0, 17: 0, 18: 0, 19: 0, 23: 0, 28: 0, 30: 0, 32: 0, 33: 0,            // Undead (17 "grouped as animal in classic")
  25: 1, 26: 1, 27: 1, 29: 1, 31: 1,                                        // Daedra
});
export function enemyEntityGroup(careerIndex) {
  return ENEMY_GROUP_BY_CAREER[careerIndex] ?? ENEMY_GROUPS.None;
}

// ---- GetBonusOrPenaltyByEnemyType (the DFU always-on port) ----
/** FormulaHelper.cs:993-1057, verbatim including the ladder's ORDER.
 *
 *  AUDIT 17n wired the ATTACKER half (DFU reads
 *  attacker.Career.<group>AttackModifier for every attacker; the port
 *  had flattened the byte onto the entity and only the foe builder
 *  ever set it). AUDIT 18 wires the TARGET half, which had two holes:
 *
 *  1. the port pre-resolved ONE group from the target's affinity and
 *     handed the callee a number. DFU uses TWO discriminants - the
 *     Humanoid arm keys on `MobileEnemy.Affinity == MobileAffinity.
 *     Human` (so an Orc, whose group IS Humanoid but whose affinity is
 *     Darkness, gets NOTHING - a DFU quirk, reproduced) while the
 *     Undead/Daedra/Animals arms key on GetEnemyGroup(). The two
 *     disagree for Slaughterfish 11, Vampire 28, Vampire Ancient 30
 *     and both Dragonlings 34/40, which the port scored 0.
 *  2. `target is PlayerEntity` had no port at all: every enemy->player
 *     site passed a null group, so the "player is assumed humanoid"
 *     arm never fired. Every 0x04 (Humanoid bonus) career in the real
 *     MONSTER.BSA - both vampires, all four atronachs, dragonling,
 *     dreugh, lamia - is an ATTACKER on the player, so that arm is
 *     where the whole modifier lives.
 *
 *  FLAGGED: DFU's player arm takes the UNDEAD modifier while the
 *  player HasVampirism(); the vampirism effect is not ported, so only
 *  the humanoid arm exists here. */
export function bonusOrPenaltyByEnemyType(attacker, target) {
  if (!attacker || !target) return 0;
  const flags = attacker.attackModifierFlags ?? attacker.career?.attackModifierFlags ?? null;
  if (flags == null) return 0;
  let group = ENEMY_GROUPS.None;
  if (target.isPlayer) {
    group = ENEMY_GROUPS.Humanoid;   // "Player is assumed humanoid" (:1048)
  } else if (target.affinity === 'Human') {
    group = ENEMY_GROUPS.Humanoid;
  } else {
    const g = enemyEntityGroup(target.careerIndex);
    // the else-if ladder has no Humanoid arm: a non-Human-affinity
    // enemy whose GROUP is Humanoid falls through to 0, verbatim
    if (g === ENEMY_GROUPS.Undead || g === ENEMY_GROUPS.Daedra || g === ENEMY_GROUPS.Animals) group = g;
  }
  if (group === ENEMY_GROUPS.None) return 0;
  return careerAttackModifier(flags, group) * attacker.level;
}

/** FormulaHelper.CalculateRacialModifiers (FormulaHelper.cs:933-962),
 *  verbatim - INCLUDING the else-if ladder, which is load-bearing:
 *  a Dark Elf ARCHER takes the DarkElf arm (Level/4, not Level/3), and
 *  a Redguard ARCHER takes the archery arm, fails the WoodElf test and
 *  gets NOTHING. Applied to the player only, and only with a weapon.
 *  AUDIT 18: not ported at all before now - the site note claiming the
 *  entity "has no career/race yet" went stale when chargen shipped
 *  (chargen.applyCharacter writes the DFU-numbered raceId). */
export function racialModifiers(attacker, weapon) {
  const mods = { damageMod: 0, toHitMod: 0 };
  if (!weapon) return mods;
  const set = (n) => { mods.damageMod = n; mods.toHitMod = n; };
  if (attacker.raceId === RACES.DarkElf) set(Math.trunc(attacker.level / 4));
  else if (weaponSkillUsed(weapon.templateIndex) === SKILLS.Archery) {
    if (attacker.raceId === RACES.WoodElf) set(Math.trunc(attacker.level / 3));
  } else if (attacker.raceId === RACES.Redguard) set(Math.trunc(attacker.level / 3));
  return mods;
}

// ---- CalculateStatsToHit ----
export const statsToHit = (a, t) =>
  Math.trunc((liveStat(a, 'luck') - liveStat(t, 'luck')) / 10) + Math.trunc((liveStat(a, 'agility') - liveStat(t, 'agility')) / 10);

// ---- CalculateSkillsToHit (classic's /4 dodging; crit roll adds crit/10) ----
export function skillsToHit(a, t, roll01 = Math.random()) {
  let mod = -Math.floor(skillValue(t, SKILLS.Dodging) / 4);            // classic's /4 bug preserved
  const crit = skillValue(a, SKILLS.CriticalStrike);
  if (dice100(crit, roll01)) mod += Math.floor(crit / 10);
  return mod;
}

// ---- CalculateAdjustmentsToHit (2026-08-13 parity audit F1) ----
// Verbatim: biography avoid-hit (pending chargen biography - 0),
// +40 when the TARGET is an enemy MONSTER, then a flat -50 always
// ("DF Chronicles says -60 ... it actually seems to be -50").
export function adjustmentsToHit(target) {
  let mod = 0;
  // AUDIT 21 F3: THE BIOGRAPHY MODIFIER, which was minted and never read.
  //     if (target == player) chanceToHitMod -= player.BiographyAvoidHitMod;
  // (FormulaHelper.cs:1236-1239.) The comment that stood here said the
  // chargen biography was "pending". It shipped in S3e/U13:
  // applyBiographyEffects runs inside finishChargen, biography.js mints
  // biographyAvoidHitMod from the real BIOG*.TXT, and save.js has persisted
  // it since AUDIT 17h. Every populated BIOG*.TXT that carries the answer
  // carries TH -5, and 14 of the 18 class biographies have one - so a
  // character who answered "Fighting without magic" was a flat 5 points
  // harder to hit than the one the player built, for the whole game.
  //
  // Note the SIGN: DFU SUBTRACTS the modifier, so a negative TH is a
  // PENALTY to the player - the answer makes them easier to hit, not safer.
  if (target.isPlayer) mod -= (target.biographyAvoidHitMod ?? 0);
  if (!target.isPlayer && target.isClass === false) mod += 40;   // EntityTypes.EnemyMonster
  mod -= 50;
  return mod;
}

/** CalculateAdrenalineRushToHit (FormulaHelper.cs:1163-1183), called from
 *  CalculateSuccessfulHit at :811.
 *
 *  AUDIT 21 F2. The Ledger listed Adrenaline Rush as INERT "because the
 *  consuming subsystem does not exist" - but the consumer IS
 *  CalculateSuccessfulHit, which is live, and every input was already here:
 *  the bit decodes (specialAdvantages.js, rest.js), and health/maxHealth are
 *  on both entity shapes. No effect, no enchantment and no window involved.
 *
 *  CLASS09.CFG (Acrobat) ships bitfield 0x1406 with bit 4 set, so a VANILLA
 *  Acrobat has it; ten monster careers do too (Werewolf, Vampire Ancient, all
 *  four atronachs, horse, dragonling, dreugh, Lamia). The enemy half only
 *  works once the career is stored - AUDIT 21 F1.
 *
 *  ImprovedAdrenalineRush is an unported enchantment, so the improved
 *  modifier (8) is unreachable and the base (5) stands. That is a routed gap,
 *  not a blocker: DFU's ternary picks the base whenever it is false. */
export const ADRENALINE_RUSH_MODIFIER = 5;
export const IMPROVED_ADRENALINE_RUSH_MODIFIER = 8;
/** DFCareer.HasSpecialAbility: the flag masked against the bitfield's LOW
 *  BYTE (rest.js's hasSpecialAbility, restated here to keep this file a
 *  leaf-ward importer - see the import note above). */
const hasAbility = (career, flag) => ((career?.abilityFlagsAndSpellPointsBitfield ?? 0) & flag) === flag;
const inAdrenalineRush = (e) => Boolean(e)
  && hasAbility(e.career, SPECIAL_ABILITY_BITS.adrenalineRush)
  && (e.health ?? 0) < Math.trunc((e.maxHealth ?? 0) / 8);   // C# integer division
export function adrenalineRushToHit(attacker, target) {
  let mod = 0;
  if (inAdrenalineRush(attacker)) {
    mod += attacker.improvedAdrenalineRush ? IMPROVED_ADRENALINE_RUSH_MODIFIER : ADRENALINE_RUSH_MODIFIER;
  }
  if (inAdrenalineRush(target)) {
    mod -= target.improvedAdrenalineRush ? IMPROVED_ADRENALINE_RUSH_MODIFIER : ADRENALINE_RUSH_MODIFIER;
  }
  return mod;
}

// ---- CalculateSuccessfulHit (clamp 3..97) ----
export function calculateSuccessfulHit(attacker, target, chanceToHitMod, struckBodyPart, rolls = Math.random) {
  let chance = chanceToHitMod;
  // CalculateArmorToHit (FormulaHelper.cs:1149-1161): the per-part
  // table, always. Increased/DecreasedArmorValueModifier channels pend
  // their effects (none exist yet) - 0 (audit F5).
  //
  // AUDIT 24 (wave 28): the old scalar-armour fallback was an
  // INVENTION - DFU has no scalar-armour path, because every entity
  // carries ArmorValues from creation (CharacterDocument.cs:86-88 for
  // the player, EnemyEntity.cs:264-267/:409-413 for enemies). It read
  // 0 for a fresh character whose chargen had nulled the array, and 0
  // is a hundred points of chance-to-hit below DFU's unarmoured 100.
  // E1: FormulaHelper.cs:1158 - armorValue = ArmorValues[part] +
  // IncreasedArmorValueModifier + DecreasedArmorValueModifier. The
  // channels are the enchantment fold's (Strengthens/WeakensArmor,
  // BadReactionsFrom) - the audit-F5 zeros, live at last.
  chance += (target.armorValues?.[struckBodyPart] ?? 0) + enchantArmorMod(target);
  // AUDIT 21 F2: the adrenaline rush is APPLIED now, in DFU's own slot
  // (FormulaHelper.cs:811, between the armour term and the stats term).
  chance += adrenalineRushToHit(attacker, target);
  // E1: attacker.ChanceToHitModifier (FormulaHelper.cs:814) - the
  // audit-F4 zero. BadReactionsFrom is its one core writer.
  chance += enchantChanceToHitMod(attacker);
  chance += statsToHit(attacker, target);
  chance += skillsToHit(attacker, target, rolls());
  chance += adjustmentsToHit(target);   // the +40 monster mod and flat -50 (F1)
  chance = Math.max(3, Math.min(97, chance));
  return dice100(chance, rolls());
}

// ---- CalculateHandToHandAttackDamage ----
export function handToHandAttackDamage(attacker, target, damageMod, isPlayer, rolls = Math.random) {
  const h2h = skillValue(attacker, SKILLS.HandToHand);
  const min = handToHandMinDamage(h2h);
  const max = handToHandMaxDamage(h2h);
  let damage = min + Math.floor(rolls() * (max + 1 - min));  // Range(min, max+1)
  damage += damageMod;
  // FormulaHelper.cs:786 reads Stats.LiveStrength here exactly as the
  // weapon path does (:755) - AUDIT 18: this arm read the RAW stat, so
  // a strength drain (diseases.js writes signed statMods) moved a
  // player's weapon damage and left their fists untouched.
  if (isPlayer) damage += damageModifier(liveStat(attacker, 'strength'));   // "not applied in classic" for AI - DFU preserves that
  damage += bonusOrPenaltyByEnemyType(attacker, target);
  return damage;
}

export const SKELETAL_WARRIOR_INDEX = 15;   // MonsterCareers.SkeletalWarrior

// ---- CalculateWeaponAttackDamage ----
/** AUDIT 18: the pre-resolved `targetGroup` parameter is GONE. DFU
 *  passes the TARGET ENTITY to GetBonusOrPenaltyByEnemyType
 *  (FormulaHelper.cs:763) and derives the group inside it; the port
 *  had lifted a single group number into a parameter, which could not
 *  express DFU's two discriminants and left `target.group` - a field
 *  NOTHING in the codebase mints - as this arm's fallback. */
export function weaponAttackDamage(attacker, target, damageMod, weapon, rolls = Math.random) {
  const wMin = baseDamageMin(weapon), wMax = baseDamageMax(weapon);
  let damage = wMin + Math.floor(rolls() * (wMax + 1 - wMin)) + damageMod;
  if (!target.isPlayer && target.careerIndex === SKELETAL_WARRIOR_INDEX) {
    if ((weapon.flags & 0x10) === 0) damage = Math.trunc(damage / 2);   // edged-weapon rule
    if (weapon.material === 2) damage *= 2;                             // Silver
  }
  damage += damageModifier(liveStat(attacker, 'strength'));
  damage += WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0;   // half of the in-game display, per the source comment
  if (damage < 1) damage = 0;
  damage += bonusOrPenaltyByEnemyType(attacker, target);
  return damage;
}

// ---- CalculateBackstabDamage ----
/** C2-slice (AUDIT 23 combat-12): the Dice100 rolls ONLY behind the
 *  level > 1 gate (the source short-circuits at :984) - the old
 *  eager roll01 argument burned a draw on every non-backstab swing.
 *  A landed backstab speaks (key "successfulBackstab", prose ours). */
export const SUCCESSFUL_BACKSTAB_TEXT = 'You backstab your opponent!';
export function backstabDamage(damage, backstabbingLevel, rolls = Math.random, say = null) {
  if (backstabbingLevel > 1 && dice100(backstabbingLevel, rolls())) {
    say?.(SUCCESSFUL_BACKSTAB_TEXT);
    return damage * 3;
  }
  return damage;
}

/**
 * The CalculateAttackDamage orchestration for our reachable branches:
 * class-enemy hand-to-hand vs the player (equipment E4), player
 * weapon/hand-to-hand vs foes (input wiring E3c), monster multi-attack
 * (rigs E4). chanceToHitMod = the attacker's live weapon skill
 * (flat skills here). Swing/proficiency/racial player mods: E3c with
 * the in-world weapon.
 */
/** CalculateAttackDamage's enemy weapon-vs-weaponless choice: classic
 *  weapon-wielders use weapon damage, but DFU lets them keep the
 *  weaponless attack when its AVERAGE is higher (source comment: some
 *  enemies' weapons undershoot similar-tier monsters). */
export function chooseEnemyWeapon(weapon, basics) {
  if (!weapon) return null;
  const weaponAvg = Math.trunc((baseDamageMin(weapon) + baseDamageMax(weapon)) / 2);
  const noWeaponAvg = Math.trunc(((basics?.minDamage ?? 0) + (basics?.maxDamage ?? 0)) / 2);
  return noWeaponAvg > weaponAvg ? null : weapon;
}

/** FormulaHelper.DamageEquipment (:1080-1118) +
 *  ApplyConditionDamageThroughPhysicalHit (:1123-1138), verbatim
 *  (C-slice, AUDIT 23 combat-1). Runs at CalculateAttackDamage's
 *  tail for every attack; the body gates on a WEAPON hit that dealt
 *  damage, so hand-to-hand and monster natural attacks degrade
 *  nothing. The attacker's weapon always takes (10*damage+50)/100
 *  condition (int division; a 20% floor roll turns 0 into 1, rolled
 *  PER ITEM); the struck side routes to an equipped shield COVERING
 *  the struck part - DFU's own improvement, its comment notes
 *  classic never damaged shields - else to the struck part's armor
 *  slot. Breaks speak and unequip through lowerCondition. */
export function damageEquipment(attacker, target, damage, weapon, struckBodyPart, { rolls = Math.random, say = null } = {}) {
  if (!weapon || damage <= 0) return;
  const hit = (item, owner) => {
    let amount = Math.trunc((10 * damage + 50) / 100);
    if (amount === 0 && dice100(20, rolls())) amount = 1;
    lowerCondition(item, amount, owner, say);
  };
  hit(weapon, attacker);
  const slots = equipTableOf(target);
  const shield = slots[EQUIP_SLOTS.LeftHand];
  const covered = shield ? SHIELD_PARTS.get(shield.templateIndex) ?? [] : [];
  if (covered.includes(struckBodyPart)) hit(shield, target);
  else {
    const slot = slotForBodyPart(struckBodyPart);
    const armor = slot !== EQUIP_SLOTS.None ? slots[slot] : null;
    if (armor) hit(armor, target);
  }
}

export function calculateAttackDamage(attacker, target, { weapon = null, damageMod = 0, toHitMod = 0, backstabChance = 0, rolls = Math.random, dfRand = rand, onMonsterHit = null, onInflictPoison = null, say = null, enchantCtx = null } = {}) {
  if (!attacker || !target) return 0;
  if (weapon && (target.minMetalToHit ?? -1) > weapon.material) {
    // L-slice (AUDIT 23 combat-16): FormulaHelper.cs:576-583 - a
    // too-low weapon material returns 0, and when the attacker is
    // the PLAYER the HUD says so (key "materialIneffective";
    // Unity-side localization, prose ours). Enemies fail silently.
    if (attacker.isPlayer) say?.(MATERIAL_INEFFECTIVE_TEXT);
    return 0;
  }
  // source: chanceToHitMod = skill, then player swing/proficiency/
  // racial toHit mods add on; damageModifiers ride INTO the damage
  // calls (before the skeletal rules and the <1 floor)
  // chanceToHitMod = the LIVE skill for the attack in hand (weapon's
  // skill or HandToHand), + player mods. Enemies read the same value
  // for every skill (flat, SetEnemyCareer verbatim).
  const attackSkill = weapon ? (weaponSkillUsed(weapon.templateIndex) ?? SKILLS.HandToHand) : SKILLS.HandToHand;
  let chanceToHitMod = skillValue(attacker, attackSkill) + toHitMod;
  let damageModifiers = damageMod;
  // FormulaHelper.cs:594-613, the `attacker == player` block, in DFU's
  // order: swing mods (the caller's damageMod/toHitMod - they need the
  // screen weapon's state), then proficiency, then racial, then
  // backstab onto chanceToHitMod alone.
  // FLAGGED: CalculateProficiencyModifiers pends the career
  // proficiency flags (Port-Ledger "Expertise In") - 0.
  if (attacker.isPlayer) {
    const racial = racialModifiers(attacker, weapon);
    damageModifiers += racial.damageMod;
    chanceToHitMod += racial.toHitMod;
  }
  chanceToHitMod += backstabChance;
  // CalculateWeaponToHit: material modifier x 10 rides the WEAPON
  // branch only, verbatim (audit F3).
  if (weapon) chanceToHitMod += (WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0) * 10;
  const struck = calculateStruckBodyPart(rolls());
  let damage = 0;
  if (!weapon) {
    // Monster weaponless attacks (audit F2): DFU's multi-attack loop
    // over MobileEnemy.MinDamage/2/3 - NOT the H2H skill formula
    // (that branch is player + class enemies only). Per attack: the
    // reflex gate DFRandom.rand() % 100 < 50 - 10*(reflexes-2), then
    // the shared hit roll; damage Range(min, max+1); the enemy-type
    // bonus lands PER HIT. onMonsterHit = the special-attack rider
    // seam (S18 diseases.js) - fired per hit BEFORE the damage sums,
    // exactly at FormulaHelper.cs:662.
    if (!attacker.isPlayer && attacker.isClass === false && attacker.basics) {
      const b = attacker.basics;
      const spans = [
        [b.minDamage ?? 0, b.maxDamage ?? 0],
        [b.minDamage2 ?? 0, b.maxDamage2 ?? 0],
        [b.minDamage3 ?? 0, b.maxDamage3 ?? 0],
      ];
      const reflexesChance = 50 - 10 * ((target.reflexes ?? 2) - 2);
      for (const [min, max] of spans) {
        let hitDamage = 0;
        if (dfRand() % 100 < reflexesChance && min > 0 &&
            calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
          hitDamage = min + Math.floor(rolls() * (max + 1 - min));   // Range(min, max+1)
          if (hitDamage > 0 && onMonsterHit) onMonsterHit(attacker, target, hitDamage);
          damage += hitDamage;
        }
        if (hitDamage > 0) damage += bonusOrPenaltyByEnemyType(attacker, target);
      }
    } else if (calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
      damage = handToHandAttackDamage(attacker, target, damageModifiers, !!attacker.isPlayer, rolls);
      // INSIDE the hit, exactly as :627 - see the note below
      damage = backstabDamage(damage, backstabChance, rolls, say);
    }
  } else {
    if (calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
      damage = weaponAttackDamage(attacker, target, damageModifiers, weapon, rolls);
      damage = backstabDamage(damage, backstabChance, rolls, say);   // :688
    }
  }
  // THE BACKSTAB IS INSIDE THE HIT. Both C# call sites (:627 for hand
  // to hand, :688 for weapons) sit within their own
  // `if (CalculateSuccessfulHit(...))` block, so a MISS never reaches
  // the backstab at all. This used to run unconditionally after both
  // branches, on the reading that the roll was gated by the damage -
  // but backstabDamage's gate is `backstabbingLevel > 1`, the
  // attacker's SKILL, not the damage. So a missing thief with any
  // Backstabbing skill drew a roll C# never draws (desyncing every
  // later roll in the shared stream) and, on a success, printed "You
  // backstab your opponent!" over an attack that did nothing.
  // Poisoned weapons (S19b): a damaging weapon hit inflicts the
  // poison ONCE and clears it from the weapon (the source's
  // weapon.poisonType = Poisons.None, inside the weapon branch after
  // backstab). onInflictPoison = the scene's InflictPoison seam.
  if (weapon && damage > 0 && (weapon.poisonType ?? -1) !== -1) {
    if (onInflictPoison) onInflictPoison(attacker, target, weapon.poisonType);
    weapon.poisonType = -1;
  }
  damage = Math.max(0, damage);
  // FormulaHelper.cs:699-701: the equipment damages at the TAIL with
  // the clamped value, whatever the hit rolled.
  damageEquipment(attacker, target, damage, weapon, struck, { rolls, say });
  // AUDIT 24 (wave 31) - A LANDED HIT ENDS THE ATTACKER'S NORMAL-POWER
  // CONCEALMENT, and it was unported at every door.
  //
  // DFU writes this in the CALLERS, not here:
  //     if (playerEntity.IsMagicallyConcealedNormalPower && damage > 0)
  //         EntityEffectManager.BreakNormalPowerConcealmentEffects(...)
  // - WeaponManager.cs:549-552 for the player's swing AND the player's
  // arrow (DaggerfallMissile.AssignBowDamageToTarget routes a bow hit
  // back through WeaponDamage), EnemyAttack.cs:255-257 for a foe hitting
  // the player and :316-318 for a foe hitting anything else. Those three
  // are the ENTIRE caller set of CalculateAttackDamage in the DFU tree
  // and all three carry the same two-line guard, so the law is "any
  // attack that lands damage" - and the tail of the formula is ONE home
  // for it instead of seven a later door can forget. Two hosts had
  // already forgotten OnMonsterHit exactly that way; wave 30 is the
  // receipt. audit24_wave31 pins the equivalence against the C# rather
  // than against this comment.
  //
  // Without it the concealments - live since S21, and read by the S21
  // senses gate - survived a whole fight: cast the cheap Invisibility
  // and clear a dungeon without ever being seen, or be beaten to death
  // by a Nightblade you can never see. The TRUE powers are untouched,
  // which is what the normal/true split exists for.
  if (damage > 0) breakNormalPowerConcealment(attacker);
  // E1: the STRIKES enchantment payload, at the tail for the same
  // one-home reason as OnMonsterHit above. DFU runs it at the callers
  // with ASYMMETRIC gates: the player's strike runs it on any hit
  // resolution, damage 0 included (WeaponManager.cs:618-625 - the
  // block also owns the zero-damage swing sound), an enemy's only
  // when damage > 0 (EnemyAttack.cs:263-269). CastWhenStrikes gates
  // itself on sourceDamage == 0 either way; what the player gate
  // admits at zero is HealthLeech's use-stamp. The payloads can
  // modulate the damage (PotentVs +5, LowDamageVs -5) and the total
  // clamps at 0 inside the dispatcher.
  if (weapon && isEnchantedItem(weapon) && (attacker.isPlayer || damage > 0)) {
    damage = doItemEnchantmentPayloads(PAYLOAD.Strikes, weapon, {
      entity: attacker, target, damage,
      nowMinutes: enchantCtx?.nowMinutes ?? 0, ctx: enchantCtx,
    });
  }
  // V2a/V2b: RacialOverrideEffect.OnWeaponHitEntity, at the same tail
  // for the same one-home reason - DFU calls it from the player's
  // strike resolution (WeaponManager.cs:616-618). The vampire FEEDS on
  // any landed hit; the werewolf's satiation asks whether the dead
  // target was an INNOCENT (a civilian, or the city watch by
  // mobileType - carried by every foe entity this formula ever sees).
  // A REGISTERED hook, not an import: the curses import effects.js,
  // which imports this file's dice100 - a direct import here closes
  // that cycle. worldTick registers it, and every host loads worldTick.
  if (attacker.isPlayer && attacker.racialOverride) {
    _racialHitHook?.(attacker, target, {
      nowMinutes: enchantCtx?.nowMinutes ?? 0,
      mobileType: target?.mobileType ?? null,
      isCivilian: !!enchantCtx?.targetIsCivilian,
    });
  }
  // V3: the Ring of Namira, at DFU's own dispatch site - the tail of
  // CalculateAttackDamage when an ENEMY damages the PLAYER
  // (FormulaHelper.cs:702-719). The same registered-hook shape as
  // above: artifactEffects imports this file's savingThrow chain, so
  // a direct import here would close a cycle; worldTick registers.
  if (target?.isPlayer && !attacker.isPlayer && damage > 0) {
    _playerStruckHook?.(attacker, target, damage);
  }
  return damage;
}

let _racialHitHook = null;
/** worldTick's registration seam for the racial-override hit hook. */
export function setRacialHitHook(fn) { _racialHitHook = fn ?? null; }
let _playerStruckHook = null;
/** worldTick's registration seam for the enemy-damages-player tail
 *  (V3: the Ring of Namira's reflection). */
export function setPlayerStruckHook(fn) { _playerStruckHook = fn ?? null; }

// ---- GetEnemyEntityLanguageSkill (FormulaHelper.cs:2808-2880) ----
// Class enemies: the six stealth careers speak Streetwise, the rest
// Etiquette (DFU's BCHG - classic used Etiquette for all; the port
// follows its source). Monsters: the tongue table; None = -1.
const CLASS_STREETWISE = new Set([7, 8, 9, 10, 11, 5]);   // Burglar, Rogue, Acrobat, Thief, Assassin, Nightblade
const MONSTER_LANGUAGE = new Map([
  [7, SKILLS.Orcish], [12, SKILLS.Orcish], [21, SKILLS.Orcish], [24, SKILLS.Orcish],
  [13, SKILLS.Harpy],
  [16, SKILLS.Giantish], [22, SKILLS.Giantish],
  [34, SKILLS.Dragonish], [40, SKILLS.Dragonish],
  [10, SKILLS.Nymph], [42, SKILLS.Nymph],
  [25, SKILLS.Daedric], [26, SKILLS.Daedric], [27, SKILLS.Daedric], [29, SKILLS.Daedric], [31, SKILLS.Daedric],
  [2, SKILLS.Spriggan],
  [8, SKILLS.Centaurian],
  [1, SKILLS.Impish], [41, SKILLS.Impish],
  [28, SKILLS.Etiquette], [30, SKILLS.Etiquette], [32, SKILLS.Etiquette], [33, SKILLS.Etiquette],
]);
export function enemyLanguageSkill(entity) {
  if (entity?.isClass) return CLASS_STREETWISE.has(entity.careerIndex) ? SKILLS.Streetwise : SKILLS.Etiquette;
  return MONSTER_LANGUAGE.get(entity?.careerIndex) ?? -1;
}

// ---- CalculateEnemyPacification (FormulaHelper.cs:357-391) ----
/** C-slice (AUDIT 23 characters-2). Etiquette/Streetwise read
 *  skill/10 + personality/5 (C# INT divisions); a monster tongue
 *  reads the FULL skill + personality/10 - fluency in Orcish counts
 *  for far more than manners. A sheathed weapon adds 10, a drawn one
 *  costs 25. Roll Random.Range(0, 200) < chance.
 *
 *  X11: the LAST term is the Comprehend Languages effect's ChanceValue
 *  (:377-380), and this doc comment carried "rides the effect arc (no
 *  incumbent exists yet)" until that effect went live. It arrives as
 *  an ARGUMENT rather than a global read for the same reason
 *  `sheathed` does - DFU reads WeaponManager.Sheathed inside the
 *  formula and this port passes it in - and here there is a second
 *  reason: reading it here would mean importing systems/effects.js,
 *  and effects -> spellcast -> formulas is the cycle this file's
 *  concealment leaf exists to avoid. scenes/hostCombat.js supplies
 *  it, at the one seam all three enemy pools already share. */
export function calculateEnemyPacification(player, languageSkill, sheathed, roll01 = Math.random(), comprehendBonus = 0) {
  let chance = 0;
  if (languageSkill === SKILLS.Etiquette || languageSkill === SKILLS.Streetwise) {
    chance += Math.trunc(skillValue(player, languageSkill) / 10);
    chance += Math.trunc(liveStat(player, 'personality') / 5);
  } else {
    chance += skillValue(player, languageSkill);
    chance += Math.trunc(liveStat(player, 'personality') / 10);
  }
  chance += sheathed ? 10 : -25;
  chance += comprehendBonus;
  return Math.floor(roll01 * 200) < chance;
}

// ---- EnemyAttack.MeleeDamage hit gate, "matched to classic" ----
export const MELEE_HIT_YAW_DEG = 35.156;
export function meleeHitConnects(dist, inSight, withinHitYaw) {
  return inSight && (dist <= 0.25 || (dist <= MELEE_DISTANCE && withinHitYaw));
}

// ---- C15: knockback (WeaponManager.WeaponDamage + FormulaHelper) ----
// PlayerSpeedChanger.classicToUnitySpeedUnitRatio / 10 - every
// knockback constant divides through this (single source: motor.js,
// imported at the top).
export const KB_UNIT = CLASSIC_TO_UNITY_RATIO / 10;   // 3.95

/** GetEnemyEntityWeightInClassicUnits, verbatim shape: monster =
 *  MobileEnemy.Weight, class = female 240 / male 350. FLAGGED: the
 *  + (int)(Items.GetWeight() * 4) term is still absent - item weights
 *  themselves SHIPPED (AUDIT 23 corrected the stale blocker); the
 *  term needs the call sites to hand the foe's item list through. */
export function enemyWeightClassicUnits(isClass, gender, mobileWeight) {
  if (!isClass) return mobileWeight ?? 0;
  return gender === 'female' ? 240 : 350;
}

// ---- T3a: CalculatePickpocketingChance, verbatim ----
// chance = live Pickpocket skill; vs an enemy mobile add
// 5 * (playerLevel - targetLevel); clamp 5..95. targetLevel = null
// for a townsperson (no level modifier).
export function calculatePickpocketingChance(pickpocketSkill, playerLevel, targetLevel = null) {
  let chance = pickpocketSkill;
  if (targetLevel != null) chance += 5 * (playerLevel - targetLevel);
  return Math.max(5, Math.min(95, chance));
}

/**
 * WeaponManager.cs:578-581's GATE, which is a precedence trap:
 *
 *     if (enemyMotor.KnockbackSpeed <= (5 / ratio) &&
 *         entityBehaviour.EntityType == EntityTypes.EnemyClass ||
 *         enemyEntity.MobileEnemy.Weight > 0)
 *
 * `&&` binds tighter than `||` in C#, so this reads
 * `(speed <= 5/ratio && isClass) || Weight > 0` - a monster with ANY
 * weight is knocked back by every hit that lands, while a class enemy
 * (whose MobileEnemy.Weight is 0 for every row in the table) must wait
 * for the current shove to decay under the threshold first.
 *
 * The `Weight > 0` arm is also what keeps the formula defined. It is
 * undefined at zero - (10d/0) * (2d - 2d) is an Infinity times a zero
 * - and Ghost (18) and Wraith (23) are the only two rows that carry
 * Weight 0, which is exactly why DFU never reaches it for them.
 *
 * AUDIT 24 (wave 38): three pools wrote three different subsets of
 * this. One home.
 */
export function weaponKnockbackApplies(knockbackSpeed, isClass, mobileWeight) {
  return (knockbackSpeed <= 5 / KB_UNIT && !!isClass) || (mobileWeight ?? 0) > 0;
}

/**
 * MT-ii: the SAME guard one component over, and it is NOT the same
 * expression. EnemyAttack.ApplyDamageToNonPlayer:336-337 writes the
 * parentheses DFU's player-side arm leaves out:
 *
 *   if (targetMotor && (targetMotor.KnockbackSpeed <= (5 / ratio)
 *           && (entityBehaviour.EntityType == EntityTypes.EnemyClass
 *               || targetEntity.MobileEnemy.Weight > 0)))
 *
 * Two differences from weaponKnockbackApplies above, both real:
 *   1. THE BINDING. The player's arm is `speed <= 5 && targetIsClass
 *      || weight > 0`, so a weighted monster is shoved by every
 *      landed hit however hard it is already flying. The foe's arm
 *      is `speed <= 5 && (isClass || weight > 0)`, so the decay
 *      threshold governs EVERY foe-dealt knockback - one enemy never
 *      chain-shoves another.
 *   2. WHOSE class. `entityBehaviour` in WeaponManager is the enemy
 *      being hit; in EnemyAttack it is the ATTACKER. So the class
 *      test names the attacker here and the target there.
 * One home each, because they are two laws that merely look alike.
 */
export function enemyKnockbackApplies(knockbackSpeed, attackerIsClass, targetMobileWeight) {
  return knockbackSpeed <= 5 / KB_UNIT && (!!attackerIsClass || (targetMobileWeight ?? 0) > 0);
}

/** The WeaponManager player-hit knockback speed, verbatim:
 *  kb = ((10d - w) * 256) / (w + 10d) * 2d;
 *  speed = (10d / w) * (2d - kb/256), through the ratio, floored at
 *  15 classic units. Caller owns the weight-0 gate. */
export function weaponKnockbackSpeed(damage, weightClassic) {
  const ten = damage * 10, two = damage * 2;
  const kb = ((ten - weightClassic) * 256) / (weightClassic + ten) * two;
  let ks = (ten / weightClassic) * (two - kb / 256);
  ks /= KB_UNIT;
  const floor = 15 / KB_UNIT;
  return ks < floor ? floor : ks;
}
