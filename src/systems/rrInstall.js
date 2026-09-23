// RR1 - THE INSTALL: what RoleplayRealism.Awake/InitMod (RoleplayRealism.cs
// :74-258) registers, hooks or replaces, done once at the scene boot in
// InitMod's own order. Each registered arm reads its switch at the call,
// so a pane toggle takes effect at the next roll - except the class
// enemies' appearance, which DFU writes into EnemyBasics at Awake and the
// port writes at install (the Features row says "when the game next
// loads"). The laws themselves are systems/rrRealism.js; this module is
// the one that imports the seams they hang on.
import { registerFormulaOverride, formulaOverride } from '../combat/formulas.js';
import { registerClimbingChanceOverride } from '../player/climbing.js';
import { currentWeaponPose } from '../combat/playerWeapon.js';
import { WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { registerMeleeWeaponAnimTime, CLASSIC_FRAME_UPDATE } from '../characters/weaponStates.js';
import { registerMaxBankLoan } from './banking.js';
import { setShipAvailable } from './ship.js';
import { registerMagicRoundHook } from './worldTick.js';
import { registerEntityFold } from './entityMods.js';
import { overridePotionRecipes } from './potions.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { setUnderworldRule, setGuildExpelledHook, setGuildSkillsOverride } from './guilds.js';
import { setTrainingSkillsOverride } from './guildServices.js';
import { carriedWeight } from './inventory.js';
import { maxEncumbrance } from '../combat/formulas.js';
import { liveStat } from './statMods.js';
import { equipTableOf, EQUIP_SLOTS, lowerCondition } from './equip.js';
import { getItemHands, ITEM_HANDS } from '../characters/equipTable.js';
import { rriAnimTimeOverride } from './rriKits.js';
import { rriModule } from './rriItems.js';
import {
  rrEnabled, rrModule, rrAdjustWeaponHitChanceMod, rrAdjustWeaponAttackDamage, rrClimbingChance, rrMeleeWeaponAnimTime,
  rrWeaponToHit, rrConditionDamageThroughPhysicalHit, rrDamageModifierClassic, rrMaxBankLoan, rrShipAvailable,
  rrEncumbranceEffect, RR_POTION_RECIPES, applyEnemyAppearance, rrUnderworldRule, rrFightersGuildSkills, rrFightersTrainingSkills,
} from './rrRealism.js';

/** The host's seams a registered arm needs and no module can import: the
 *  foe spawner (CreateFoeSpawner, for the underworld guilds' squad). Set
 *  by the world host at mount. */
const _host = { spawnFoe: null };
export function setRrHostSeams(seams = {}) { Object.assign(_host, seams); }
export const rrHostSeams = () => _host;

let _installed = false;
/** Once. Returns true the first time. */
export function installRoleplayRealism() {
  if (_installed) return false;
  _installed = true;

  // advancedArchery (:130-135): the two mod hooks. FormulaHelper.RegisterOverride
  // keys by name and the last registration wins, so a mod that registered the
  // same two earlier (Physical Combat And Armor Overhaul does) yields to this
  // one while advancedArchery is on, exactly as DFU's dictionary would.
  const prevHit = formulaOverride('adjustWeaponHitChanceMod');
  const prevDamage = formulaOverride('adjustWeaponAttackDamage');
  registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, hitChanceMod, weaponAnimTime, weapon) =>
    (rrModule('advancedArchery') ? rrAdjustWeaponHitChanceMod(hitChanceMod, weaponAnimTime, weapon) : prevHit?.(attacker, target, hitChanceMod, weaponAnimTime, weapon)));
  registerFormulaOverride('adjustWeaponAttackDamage', (attacker, target, damage, weaponAnimTime, weapon) =>
    (rrModule('advancedArchery') ? rrAdjustWeaponAttackDamage(damage, weaponAnimTime, weapon) : prevDamage?.(attacker, target, damage, weaponAnimTime, weapon)));

  // encumbranceEffects (:139-142): the OnNewMagicRound subscriber - the fatigue
  // spent each round here, the speed taken off through the port's modifier
  // fold (MergeDirectStatMods' channel, recomputed every round)
  registerMagicRoundHook('roleplay-realism-encumbrance', (entity, { sinks } = {}) => {
    const e = encumbranceOf(entity);
    if (!e) return;
    // DecreaseFatigue(fatigueEffect, false): raw units, no multiplier; SetFatigue clamps
    if (sinks?.drainFatigue && e.fatigueEffect > 0) sinks.drainFatigue(e.fatigueEffect);
    else entity.fatigue = Math.max(0, (entity.fatigue ?? 0) - e.fatigueEffect);
  });
  registerEntityFold('roleplay-realism-encumbrance', (entity) => {
    const e = encumbranceOf(entity);
    return e ? { stats: { speed: -e.speedEffect } } : null;
  });

  // shipPorts (:158-161): TransportManager.ShipAvailiable
  setShipAvailable((q) => rrShipAvailable(q));

  // underworldExpulsion (:162-169) + fightersTeachHandToHand (:214-219): the guild classes
  setUnderworldRule((guildName) => rrUnderworldRule(guildName));
  setGuildExpelledHook((guild, entity) => {
    const rule = rrUnderworldRule(guild?.name);
    if (!rule?.squad || !_host.spawnFoe) return;
    for (const wave of rule.squad(entity?.level ?? 1)) {
      for (let i = 0; i < wave.count; i++) _host.spawnFoe(wave.mobileType, { minDistance: wave.minDistance, maxDistance: wave.maxDistance });
    }
  });
  setGuildSkillsOverride((guildName) => rrFightersGuildSkills(guildName));
  setTrainingSkillsOverride((guildName) => rrFightersTrainingSkills(guildName));

  // climbingRestriction (:170-173): CalculateClimbingChance
  registerClimbingChanceOverride((base, inputs) => {
    if (!rrModule('climbingRestriction')) return null;
    const pose = currentWeaponPose();
    return rrClimbingChance(base, { ...inputs, weaponDrawn: !!pose?.weaponDrawn, weaponMelee: pose == null || pose.weaponType === WEAPON_TYPES.Melee });
  });

  // weaponSpeed (:174-177): GetMeleeWeaponAnimTime, registered only when Roleplay &
  // Realism: Items' weaponBalance is off - both read live here, Items' arm first
  registerMeleeWeaponAnimTime((liveSpeed, ctx, cfu = CLASSIC_FRAME_UPDATE) => {
    const items = rriAnimTimeOverride(liveSpeed, ctx, cfu);
    if (items != null) return items;
    if (!rrModule('weaponSpeed') || rriModule('weaponBalance') || !ctx?.entity) return null;
    const slots = equipTableOf(ctx.entity);
    const weapon = slots?.[ctx.usingRightHand === false ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand] ?? null;
    const hands = weapon ? getItemHands(weapon) : ITEM_HANDS.None;   // ItemHands, the C#'s third argument
    return rrMeleeWeaponAnimTime({ liveSpeed, liveStrength: liveStat(ctx.entity, 'strength'), weaponType: ctx.weaponType, hands: hands === ITEM_HANDS.Both ? 'Both' : 'One' }, cfu);
  });

  // weaponMaterials (:178-181): CalculateWeaponToHit
  registerFormulaOverride('calculateWeaponToHit', (weapon) => (rrModule('weaponMaterials') ? rrWeaponToHit(weapon) : undefined));

  // equipDamage (:182-185): ApplyConditionDamageThroughPhysicalHit
  registerFormulaOverride('applyConditionDamageThroughPhysicalHit', (item, owner, damage, { say = null } = {}) =>
    (rrModule('equipDamage') ? rrConditionDamageThroughPhysicalHit(item, damage, (it, amount) => lowerCondition(it, amount, owner, say)) : false));

  // enemyAppearance (:186-189): EnemyBasics written at Awake - here at install, while the switch is on
  if (rrModule('enemyAppearance')) applyEnemyAppearance(ENEMY_BASICS);

  // purificationPotion (:190-193): the effect template re-registered with its recipes
  overridePotionRecipes(rrModule('purificationPotion') ? RR_POTION_RECIPES : []);

  // classicStrengthDamageBonus (:202-205): DamageModifier
  const prevDamageModifier = formulaOverride('damageModifier');
  registerFormulaOverride('damageModifier', (strength) => (rrModule('classicStrengthDamageBonus') ? rrDamageModifierClassic(strength) : prevDamageModifier?.(strength)));

  // the bank loan (:98, :309-312) rides the mod's Enabled alone
  registerMaxBankLoan((level) => rrMaxBankLoan(level));
  return true;
}

/** EncumbranceEffects_OnNewMagicRound's reads (RoleplayRealism.cs:582-590):
 *  CarriedWeight / MaxEncumbrance (live strength x 1.5), LiveSpeed,
 *  PermanentSpeed, CurrentFatigue - under the guards the port can answer
 *  (not resting, alive; a paused game or a fade runs no round here). */
function encumbranceOf(entity) {
  if (!rrModule('encumbranceEffects') || !entity?.stats || entity.isResting || !((entity.health ?? 0) > 0)) return null;
  return rrEncumbranceEffect({
    carriedWeight: carriedWeight(entity),
    maxEncumbrance: maxEncumbrance(liveStat(entity, 'strength')),
    liveSpeed: liveStat(entity, 'speed'),
    permanentSpeed: entity.stats.speed ?? 50,
    currentFatigue: entity.fatigue ?? 0,
  });
}

/** Test seam. */
export function _resetRoleplayRealism() { _installed = false; }
export const roleplayRealismInstalled = () => _installed;
export { rrEnabled };
