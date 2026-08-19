// Combat formulas (C8 E3b). Verbatim ports from DFU FormulaHelper.cs
// / Dice100.cs / DaggerfallUnityItem.cs / DFCareer.cs (MIT,
// Daggerfall Workshop). Every function cites its source; classic's
// bugs are PRESERVED where DFU preserves them (dodging uses /4 and
// is applied as a flat penalty; the enemy-type bonus that classic
// gated behind max-enchantment weapons follows DFU's always-on port).
// Entity shape (ours): { level, health, maxHealth, armor, skills
// (flat, per SetEnemyCareer), stats: {strength, agility, luck},
// attackModifierFlags (career CFG byte), isPlayer }.
// FLAGGED interims (all documented at their site): adrenaline rush
// (career ability bitfield decode - Systems), biography adjustments
// (chargen), per-part armor (equipment E4) - target.armor is the
// scalar SetEnemyCareer fills every slot with, so [part] == armor.

import { MELEE_DISTANCE } from '../characters/enemyMotor.js';   // single source (EnemyAttack.cs:30)
import { CLASSIC_TO_UNITY_RATIO } from '../player/motor.js';   // C15 knockback units
import { rand } from '../formats/dfRandom.js';   // the monster multi-attack reflex gate (F2)
import { liveStat } from '../systems/statMods.js';   // S14: fortify-aware stat reads
import { skillValue, SKILLS } from '../systems/skills.js';   // S3: real skills (enemies stay flat, verbatim)
import { RACES } from '../systems/races.js';   // CalculateRacialModifiers reads the DFU-numbered race id
import { SPECIAL_ABILITY_BITS } from '../systems/specialAdvantages.js';   // AUDIT 21 F2: the Adrenaline Rush bit
// NOT from rest.js, which re-exports healingRateModifier FROM here - importing
// hasSpecialAbility back out of it makes a cycle, and the ESM binding lands in
// the temporal dead zone: the helper reads `undefined` at call time and the
// bonus silently never applies. specialAdvantages.js is a leaf.
import { weaponMinDamage, weaponMaxDamage, weaponSkillUsed } from '../characters/weapons.js';   // AUDIT 18: GetBaseDamageMin/Max and GetWeaponSkillIDAsShort resolve the TEMPLATE, never a baked field or a display name

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
  // CalculateArmorToHit: per-part when equipped (E4b), the
  // SetEnemyCareer scalar otherwise. Increased/DecreasedArmorValueModifier
  // channels pend their effects (none exist yet) - 0 (audit F5).
  chance += target.armorValues ? target.armorValues[struckBodyPart] ?? 0 : (target.armor ?? 0);
  // AUDIT 21 F2: the adrenaline rush is APPLIED now, in DFU's own slot
  // (FormulaHelper.cs:811, between the armour term and the stats term).
  chance += adrenalineRushToHit(attacker, target);
  // attacker.ChanceToHitModifier (enchantments): pends the enchantment
  // system - 0 (audit F4).
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
export function backstabDamage(damage, backstabbingLevel, roll01 = Math.random()) {
  if (backstabbingLevel > 1 && dice100(backstabbingLevel, roll01)) return damage * 3;
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

export function calculateAttackDamage(attacker, target, { weapon = null, damageMod = 0, toHitMod = 0, backstabChance = 0, rolls = Math.random, dfRand = rand, onMonsterHit = null, onInflictPoison = null } = {}) {
  if (!attacker || !target) return 0;
  if (weapon && (target.minMetalToHit ?? -1) > weapon.material) return 0;   // material too low
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
    }
  } else {
    if (calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
      damage = weaponAttackDamage(attacker, target, damageModifiers, weapon, rolls);
    }
  }
  damage = backstabDamage(damage, backstabChance, rolls());   // applied AFTER the damage calc, verbatim (lines 627/688)
  // Poisoned weapons (S19b): a damaging weapon hit inflicts the
  // poison ONCE and clears it from the weapon (the source's
  // weapon.poisonType = Poisons.None, inside the weapon branch after
  // backstab). onInflictPoison = the scene's InflictPoison seam.
  if (weapon && damage > 0 && (weapon.poisonType ?? -1) !== -1) {
    if (onInflictPoison) onInflictPoison(attacker, target, weapon.poisonType);
    weapon.poisonType = -1;
  }
  return Math.max(0, damage);
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
 *  + Items.GetWeight()*4 term pends item weights (the items arc). */
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
