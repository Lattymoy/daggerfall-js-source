// DEX4b (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 9) - DAGGERFALL ENEMY EXPANSION'S COMBAT HOOKS, the
// FormulaHelper overrides its Start registers (BestiaryMod.cs:182-190) and its OnLootSpawned handler's forced gender:
//   - OnMonsterHit (:1449-1585): DFU's own switch become a chain - each of DFU's nine arms taken where the attacker is
//     its classic monster OR its row's `OnHit` names the arm's number, in DFU's order - and four arms of the mod's own
//     (10-13), each readying a spell on the attacker: the Blood Spider's Blood Leech (500), the Gloom Wraith's Silence
//     (23), the Fire Daemon's Daemon Touch (501), the Will-o'-wisp's Wrack (502). The arms are systems/diseases.js's.
//   - CalculateWeaponAttackDamage (:1587-1630): DFU's body, the Skeletal Warrior's rule for a row the mod says is
//     skeletal too - combat/formulas.js registerSkeletalTarget.
//   - GetEnemyEntityEnemyGroup and GetEnemyEntityLanguageSkill (:1980-2119): its own fifty's from their rows, DFU's
//     switch for every other enemy (the C# restates it) - combat/formulas.js registerEnemyGroup / registerEnemyLanguage.
//   - The forced gender (:1364-1392) - characters/mobile/mobileUnit.js registerForcedGender.
// A row's properties are dexInstall.js dexProperties's (a classic id's while the mod is loaded, a mod id's), as
// GetCustomProperties is; the group and the language read the fifty alone, as the C#'s `customEnemies` lookup does.

import { runMonsterHitArm, CLASSIC_HIT_ARM, MONSTER_HIT_ARMS } from '../diseases.js';
import { ENEMY_GROUPS, SKELETAL_WARRIOR_INDEX } from '../../combat/formulas.js';   // the career's number, the ID the mod compares (MonsterCareers.SkeletalWarrior)
import { CAREER_SKILLS } from './dexTables.js';

/** BestiaryEnemySpells (BestiaryEnemySpells.cs): the spells the mod's own arms ready, by arm. */
export const DEX_HIT_SPELLS = Object.freeze(new Map([[10, 500], [11, 23], [12, 501], [13, 502]]));

/** OnMonsterHit's override: `propsOf(mobileType)` the row's properties. The attacker's id is the C#'s
 *  `attacker.MobileEnemy.ID` (a classic monster's is its career). */
export function createDexMonsterHit(propsOf) {
  return (attacker, target, damage, deps = {}) => {
    const customEffect = propsOf(attacker.mobileType)?.onHitEffect ?? 0;
    const classicArm = CLASSIC_HIT_ARM[attacker.mobileType] ?? 0;
    for (let arm = 1; arm <= MONSTER_HIT_ARMS; arm++) {
      if (classicArm === arm || customEffect === arm) { runMonsterHitArm(arm, attacker, target, damage, deps); return; }
    }
    const spell = DEX_HIT_SPELLS.get(customEffect);   // "Custom effects start at 10"
    if (spell != null) deps.readySpell?.(spell);
  };
}

/** A row's enum cell as the port's value: a name parseEnum kept, or the number it could not name. */
const valueOf = (table, v) => (typeof v === 'number' ? v : table[v]);

/** The four doors' answers over the read (`enemies`: the fifty, dexTables.js readEnemyTables) and `propsOf`. */
export function createDexCombatDoors(enemies, propsOf) {
  return {
    monsterHit: createDexMonsterHit(propsOf),
    /** registerSkeletalTarget, the override's whole test (:1593-1601): the Skeletal Warrior by its ID - not its career, so
     *  no class rides its slot (AUDIT DEX C2) - or a row whose Affinity cell read `Skeletal` (dexTables.js), the
     *  classic's or a mod id's. */
    skeletal: (target) => target?.mobileType === SKELETAL_WARRIOR_INDEX || propsOf(target?.mobileType)?.isSkeletal === true,
    /** registerEnemyGroup: the fifty's row (a mod's career index is its id), null for DFU's switch. */
    group: (careerIndex) => { const e = enemies.get(careerIndex); return e ? valueOf(ENEMY_GROUPS, e.props.group) : null; },
    /** registerEnemyLanguage: the fifty's row, null for DFU's. */
    language: (entity) => { const e = enemies.get(entity?.mobileType); return e ? valueOf(CAREER_SKILLS, e.props.language) : null; },
    /** registerForcedGender: DFBlock.EnemyGenders' Male or Female over the unit's. */
    gender: (mobileType) => { const g = propsOf(mobileType)?.forcedGender; return g === 'Male' ? 'male' : g === 'Female' ? 'female' : null; },
  };
}
