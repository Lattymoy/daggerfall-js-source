// STATS-CARD: the numbers behind the paperdoll's flip side (ui/statsCard.js draws them).
//
// NOTHING HERE IS A NEW LAW. Every term is read through the member the combat core itself uses, and the two cores the
// port can run are both modelled: DFU's stock FormulaHelper (combat/formulas.js) and the Physical Combat And Armor
// Overhaul (combat/pcaao.js, on by default). The dice are replaced by their expectation: a hit chance is the exact
// probability the core's Dice100 rolls give (clamp 3..97, averaged over the struck-part table and over the critical
// roll), and a damage figure is the exact mean over the weapon's integer roll range.
//
// WHAT A FIGURE IS AGAINST. A blow's odds depend on who takes it, so the card scores the swing against REFERENCE FOES:
// a foe of the player's own level (skills = min(100, 5 x level + 30), every stat 50 - enemyEntity's own numbers) in
// four REAL armour classes: three monsters (MobileEnemy.ArmorValue 6, 0 and -10, stored x5 exactly as enemyEntity does -
// the spread of the shipped bestiary, -12..7) and a human (class) foe. The two kinds are scored by their own rules:
// a monster takes the +40 (overhaul +50) adjustment and its per-part armour value; a class foe takes neither, and
// the overhaul reads a flat 60 off it whatever it wears (pcaaoArmorToHit). Damage is shown BEFORE the foe's armour
// reduces it (the overhaul's reduction depends on the foe's materials and the blow's weight, applied after these figures).
import { liveStat } from '../systems/statMods.js';
import { skillValue, SKILLS } from '../systems/skills.js';
import {
  formulaOverride, damageModifier, handToHandMinDamage, handToHandMaxDamage, baseDamageMin, baseDamageMax,
  WEAPON_MATERIAL_MODIFIER, STRUCK_BODY_PARTS, proficiencyModifiers, racialModifiers, adjustWeaponHitChanceMod,
  adjustWeaponAttackDamage, adrenalineRushToHit, statsToHit, adjustmentsToHit, bonusOrPenaltyByEnemyType,
  toHitModifier, hitPointsModifier, healingRateModifier, magicResist, entityMaxEncumbrance,
} from './formulas.js';
import {
  pcaaoModules, pcaaoDamageModifier, pcaaoProficiencyModifiers, pcaaoRacialModifiers, pcaaoWeaponToHit,
  pcaaoAdrenalineRushToHit, pcaaoStatDiffsToHit, pcaaoAdjustmentsToHit, pcaaoAlterDamageBasedOnWepCondition,
  PCAAO_BODY_PARTS, unityRound, pcaaoArmorToHit,
} from './pcaao.js';
import { SWING_MODS } from './playerWeapon.js';
import { enchantChanceToHitMod } from '../systems/enchantments.js';
import { weaponDamageMods, weaponBlowMods } from '../systems/entityMods.js';
import { weaponSkillUsed, WEAPONS } from '../characters/weapons.js';
import { skillsLevel } from '../characters/enemyEntity.js';
import { equipTableOf, EQUIP_SLOTS } from '../systems/equip.js';
import { getItemHands, ITEM_HANDS } from '../characters/equipTable.js';

const int = Math.trunc;
const clamp = (x) => Math.max(3, Math.min(97, x));   // CalculateSuccessfulHit / pcaaoSuccessfulHit: 3..97
const STAT_KEYS = Object.freeze(['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck']);

/** The reference foes. A monster's `armorValue` is MobileEnemy.ArmorValue (lower = harder to hit; the part values are that x5,
 *  enemyEntity.js). The human is an EnemyClass entity in mail: 100 - 5 x 8 = 60 on every part. */
export const REFERENCE_FOES = Object.freeze([
  { id: 'soft', label: 'Soft monster', isClass: false, armorValue: 6, tip: 'A monster with armour value 6 (30 on every part): rats, imps and most of the early bestiary.' },
  { id: 'tough', label: 'Tough monster', isClass: false, armorValue: 0, tip: 'A monster with armour value 0: the middle of the bestiary.' },
  { id: 'armoured', label: 'Armoured monster', isClass: false, armorValue: -10, tip: 'A monster with armour value -10 (-50 on every part): the daedra and the ancient undead.' },
  { id: 'human', label: 'Human foe', isClass: true, armorValue: null, tip: 'A warrior in mail (60 on every part). Class foes get no monster bonus to be hit, and the overhaul reads a flat 60 off them.' },
]);

/** The swings the melee machine offers, and the single release of a bow (WeaponManager: a bow release is StrikeDown). */
export const SWING_LIST = Object.freeze([
  { key: 'StrikeLeft', label: 'Sideways' },
  { key: 'StrikeUp', label: 'Thrust up' },
  { key: 'StrikeDownRight', label: 'Down-right' },
  { key: 'StrikeDownLeft', label: 'Down-left' },
  { key: 'StrikeDown', label: 'Overhead' },
]);

/** A foe of `level` standing as reference foe `def` (a REFERENCE_FOES entry). Skills are enemyEntity's own flat value. */
export function referenceFoe(level, def) {
  const isClass = !!def.isClass;
  const av = isClass ? 60 : (def.armorValue ?? 0) * 5;   // EnemyEntity: a monster's ArmorValue x 5; a class foe's worn gear
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 50]));
  return {
    isPlayer: false, isClass, level, careerIndex: -1, stats, skills: skillsLevel(level),
    health: 100, maxHealth: 100, armorValues: new Array(7).fill(av), career: null,
  };
}

/** Which combat core is in force. The overhaul counts only when its formula is REGISTERED and its armour module is on. */
export function activeCore(modules = pcaaoModules()) {
  return { overhaul: !!formulaOverride('calculateAttackDamage') && !!modules.armorHitFormulaRedone, modules };
}

/** The selected hand, including an empty hand used for unarmed combat. */
export function strikingWeaponOf(entity, usingRightHand = true) {
  const t = equipTableOf(entity);
  const it = t[usingRightHand ? EQUIP_SLOTS.RightHand : EQUIP_SLOTS.LeftHand];
  return it?.group === 'Weapons' ? it : null;
}

const weightsOf = (table) => {
  const w = new Array(7).fill(0);
  for (const p of table) w[p]++;
  return w.map((n) => n / table.length);
};

/** The critical roll as the core in force plays it: its chance, what a success adds to the hit chance and to the damage. */
export function criticalModel(entity, core) {
  const crit = skillValue(entity, SKILLS.CriticalStrike);
  const pct = (n) => Math.max(0, Math.min(100, n)) / 100;
  if (!core.overhaul) return { chance: pct(crit), hitBonus: int(crit / 10), damageMult: 1, kind: 'hit' };   // CalculateSkillsToHit
  if (!core.modules.criticalStrikesIncreaseDamage) return { chance: pct(int(crit / 3)), hitBonus: int(crit / 3), damageMult: 1, kind: 'hit' };
  const luckTerm = Math.floor(Math.fround((liveStat(entity, 'luck') - 50) / 25));
  return {
    chance: pct(int(crit / (4 - luckTerm))), hitBonus: int(crit / 4),
    damageMult: Math.fround(Math.fround(int(crit / 5) * Math.fround(0.05)) + 1), kind: 'damage',
  };
}

/** Everything about the swing that does not depend on the foe. */
function swingContext(entity, weapon, core) {
  const skillId = weapon ? (weaponSkillUsed(weapon.templateIndex) ?? SKILLS.HandToHand) : SKILLS.HandToHand;
  const prof = core.overhaul ? pcaaoProficiencyModifiers(entity, weapon) : proficiencyModifiers(entity, weapon);
  const racial = core.overhaul ? pcaaoRacialModifiers(entity, weapon, entity) : racialModifiers(entity, weapon);
  const isBow = !!weapon && skillId === SKILLS.Archery;
  const twoHanded = !!weapon && getItemHands(weapon) === ITEM_HANDS.Both && weapon.templateIndex !== WEAPONS.Short_Bow && weapon.templateIndex !== WEAPONS.Long_Bow;
  return { entity, weapon, core, skillId, skill: skillValue(entity, skillId), prof, racial, isBow, twoHanded, crit: criticalModel(entity, core) };
}

/** The chance to hit: exact expectation of the core's roll, for one swing against one foe. */
function hitModel(ctx, swing, foe) {
  const { entity, weapon, core, skill, prof, racial, crit } = ctx;
  let base; let other;
  const dodge = skillValue(foe, SKILLS.Dodging);
  if (core.overhaul) {
    base = Math.ceil(Math.fround(skill * 1.5)) + swing.toHit + prof.toHitMod + racial.toHitMod + (weapon ? pcaaoWeaponToHit(weapon) : 0);
    other = pcaaoAdrenalineRushToHit(entity, foe) + enchantChanceToHitMod(entity) + pcaaoStatDiffsToHit(entity, foe)
      - int(dodge / 2) + pcaaoAdjustmentsToHit(foe);
  } else {
    base = skill + swing.toHit + prof.toHitMod + racial.toHitMod;
    if (weapon) {
      base += formulaOverride('calculateWeaponToHit')?.(weapon) ?? (WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0) * 10;
      base = adjustWeaponHitChanceMod(entity, foe, base, 0, weapon);
    }
    other = adrenalineRushToHit(entity, foe) + enchantChanceToHitMod(entity) + statsToHit(entity, foe)
      - Math.floor(dodge / 4) + adjustmentsToHit(foe);
  }
  const weights = weightsOf(core.overhaul ? PCAAO_BODY_PARTS : STRUCK_BODY_PARTS);
  let plain = 0; let crit1 = 0; let armourAvg = 0;
  weights.forEach((w, p) => {
    const a = core.overhaul ? pcaaoArmorToHit(foe, p) : (foe.armorValues[p] ?? 0);   // the overhaul reads a class foe's armour as a flat 60
    armourAvg += w * a;
    plain += w * clamp(base + a + other) / 100;
    crit1 += w * clamp(base + a + other + crit.hitBonus) / 100;
  });
  return {
    hit: (1 - crit.chance) * plain + crit.chance * crit1, hitPlain: plain, hitCrit: crit1,
    terms: { base, armour: armourAvg, other, dodge: core.overhaul ? int(dodge / 2) : Math.floor(dodge / 4) },
  };
}

/** The blow's damage, mean and span over the weapon's integer roll range. Neutral foe (no career bonus or phobia). */
function damageModel(ctx, swing, foe) {
  const { entity, weapon, core, skillId, prof, racial, twoHanded, crit } = ctx;
  const str = liveStat(entity, 'strength');
  const dmgMods = swing.damage + prof.damageMod + racial.damageMod;
  const rolls = [];
  let strMod; let matMod = 0;
  if (!weapon) {
    const h2h = skillValue(entity, SKILLS.HandToHand);
    for (let r = handToHandMinDamage(h2h); r <= handToHandMaxDamage(h2h); r++) rolls.push(r);
    strMod = core.overhaul ? pcaaoDamageModifier(str) : damageModifier(str);
  } else {
    for (let r = baseDamageMin(weapon); r <= baseDamageMax(weapon); r++) rolls.push(weaponDamageMods(weapon, r));
    matMod = WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0;
    strMod = core.overhaul ? pcaaoDamageModifier(str) * (twoHanded ? 2 : 1) : damageModifier(str);
  }
  const one = (roll) => {
    let d = roll + dmgMods + strMod + matMod;
    if (!weapon) { if (core.overhaul && d < 1) d = 0; return d + bonusOrPenaltyByEnemyType(entity, foe); }
    if (d < 1) d = 0;
    d += bonusOrPenaltyByEnemyType(entity, foe);
    d = weaponBlowMods(weapon, d, entity, foe, { unaware: false });
    return core.overhaul ? d : adjustWeaponAttackDamage(entity, foe, d, 0, weapon);
  };
  const finish = (d, critical) => {
    if (!core.overhaul) return d;
    d = Math.max(0, d);
    if (critical && crit.damageMult !== 1) d = unityRound(Math.fround(d * crit.damageMult));
    if (core.modules.conditionBasedEffectiveness && weapon && d >= 1) d = pcaaoAlterDamageBasedOnWepCondition(d, skillId === SKILLS.BluntWeapon, weapon, core.modules.equipmentDamageEnhanced);   // BAL1: the edge rides the mod's wear
    return d;
  };
  const plain = rolls.map((r) => finish(one(r), false));
  const crits = rolls.map((r) => finish(one(r), true));
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  return {
    min: Math.min(...plain), max: Math.max(...plain), avg: mean(plain),
    critMin: Math.min(...crits), critMax: Math.max(...crits), critAvg: mean(crits),
    parts: { roll: [Math.min(...rolls), Math.max(...rolls)], matMod, strMod, prof: prof.damageMod, racial: racial.damageMod, twoHanded },
  };
}

/** The whole card's offence data for `entity`. Pure: reads the entity and the formulas, writes nothing.
 *  opts: { core: 'classic'|'overhaul' (tests), foe: REFERENCE_FOES index }. */
export function computeCombatStats(entity, opts = {}) {
  const modules = opts.modules ?? pcaaoModules();
  const core = opts.core ? { overhaul: opts.core === 'overhaul', modules } : activeCore(modules);
  const weapon = opts.weapon !== undefined ? opts.weapon : strikingWeaponOf(entity, opts.usingRightHand ?? true);
  const level = entity.level ?? 1;
  const ctx = swingContext(entity, weapon, core);
  const headlineKey = ctx.isBow ? 'StrikeDown' : 'StrikeLeft';
  const swingsToShow = ctx.isBow ? [{ key: 'StrikeDown', label: 'Release' }] : SWING_LIST;
  const foes = REFERENCE_FOES.map((f) => ({ ...f, entity: referenceFoe(level, f) }));
  const perFoe = (swingKey, foeEntity) => {
    const swing = SWING_MODS[swingKey] ?? { damage: 0, toHit: 0 };
    const h = hitModel(ctx, swing, foeEntity);
    const d = damageModel(ctx, swing, foeEntity);
    const c = ctx.crit.chance;
    return { ...h, dmg: d, perSwing: (1 - c) * h.hitPlain * d.avg + c * h.hitCrit * d.critAvg };
  };
  const swings = swingsToShow.map((s) => ({
    ...s, mods: SWING_MODS[s.key], byFoe: foes.map((f) => perFoe(s.key, f.entity)),
  }));
  const head = swings.find((s) => s.key === headlineKey) ?? swings[0];
  const backstabSkill = skillValue(entity, SKILLS.Backstabbing);
  const str = liveStat(entity, 'strength');
  const agi = liveStat(entity, 'agility');
  const spd = liveStat(entity, 'speed');
  const lck = liveStat(entity, 'luck');
  const attributes = STAT_KEYS.map((k) => ({ key: k, value: liveStat(entity, k), base: entity.stats?.[k] ?? 0 }));
  const effect = {
    strength: `Damage ${sgn(core.overhaul ? pcaaoDamageModifier(str) * (ctx.twoHanded ? 2 : 1) : damageModifier(str))}`,
    agility: `Hit ${sgn(core.overhaul ? int((agi - 50) / 4) : int((agi - 50) / 10))}`,
    speed: core.overhaul ? `Hit ${sgn(int((spd - 50) / 8))}` : '',
    luck: `Hit ${sgn(int((lck - 50) / 10))}`,
    endurance: `Health ${sgn(hitPointsModifier(liveStat(entity, 'endurance')))} / level`,
    willpower: `Magic resist ${sgn(magicResist(liveStat(entity, 'willpower')))}`,
    intelligence: '', personality: '',
  };
  attributes.forEach((a) => { a.effect = effect[a.key] ?? ''; });
  return {
    core: core.overhaul ? 'overhaul' : 'classic', modules: core.modules, level,
    weapon, weaponName: weapon ? (weapon.name ?? 'Weapon') : null, isBow: ctx.isBow, twoHanded: ctx.twoHanded,
    skillId: ctx.skillId, skill: ctx.skill, foes, swings, head, headlineKey,
    crit: { ...ctx.crit, skill: skillValue(entity, SKILLS.CriticalStrike) },
    backstab: { skill: backstabSkill, chance: backstabSkill > 1 ? Math.min(100, backstabSkill) / 100 : 0, multiplier: 3 },
    dodging: skillValue(entity, SKILLS.Dodging),
    avoidHit: entity.biographyAvoidHitMod ?? 0,
    attributes,
    derived: {
      health: entity.health ?? 0, maxHealth: entity.maxHealth ?? 0,
      carry: entityMaxEncumbrance(entity), toHitMod: toHitModifier(agi), healing: healingRateModifier(liveStat(entity, 'endurance')),
    },
  };
}
function sgn(n) { return n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : '\u00b10'; }
export const signed = sgn;
