// RR1 - THE INSTALL: what RoleplayRealism.Awake/InitMod (RoleplayRealism.cs
// :74-258) registers, hooks or replaces, done once at the scene boot in
// InitMod's own order. Each registered arm reads its switch at the call,
// so a pane toggle takes effect at the next roll - except the class
// enemies' appearance, which DFU writes into EnemyBasics at Awake and the
// port writes at install (the Features row says "when the game next
// loads"). The laws themselves are systems/rrRealism.js; this module is
// the one that imports the seams they hang on.
import { registerFormulaOverride, formulaOverride, maxEncumbrance } from '../combat/formulas.js';
import { registerClimbingChanceOverride } from '../player/climbing.js';
import { currentWeaponPose } from '../combat/playerWeapon.js';
import { WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { registerMeleeWeaponAnimTime, CLASSIC_FRAME_UPDATE } from '../characters/weaponStates.js';
import { registerMaxBankLoan } from './banking.js';
import { setShipAvailable } from './ship.js';
import { registerMagicRoundHook } from './worldTick.js';
import { syntheticTimeIncrease } from './effectBroker.js';   // AUDIT-RR2 G20: the encumbrance round's synthetic-time gate (RoleplayRealism.cs:587)
import { registerEntityFold } from './entityMods.js';
import { overridePotionRecipes } from './potions.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { setUnderworldRule, setGuildExpelledHook, setGuildSkillsOverride } from './guilds.js';
import { setTrainingSkillsOverride, registerMerchantService } from './guildServices.js';
import { carriedWeight } from './inventory.js';
import { liveStat, maxFatigue } from './statMods.js';
import { equipTableOf, EQUIP_SLOTS, lowerCondition } from './equip.js';
import { getItemHands, ITEM_HANDS } from '../characters/equipTable.js';
import { rriAnimTimeOverride } from './rriKits.js';
import { rriModule } from './rriItems.js';
import { setCanRunOverride } from './transport.js';
import { setAxisLimitsProvider } from '../player/moveAxes.js';
import { installRoleplayRealismArt } from './rrVariants.js';
import { registerQuestList } from './quest/questLists.js';
import { addIntoQuestTables } from './quest/tables.js';
import { registerCustomFaction } from '../formats/factionFile.js';
import { RR_QUEST_LIST, RR_CUSTOM_FACTIONS, RR_PLACES_TABLE, RR_FACTIONS_TABLE, RR_FACTION_IDS, RR_TEXT, rrCustomArmorService } from './rrQuestLine.js';
import {
  rrEnabled, rrModule, rrAdjustWeaponHitChanceMod, rrAdjustWeaponAttackDamage, rrClimbingChance, rrMeleeWeaponAnimTime,
  rrWeaponToHit, rrConditionDamageThroughPhysicalHit, rrDamageModifierClassic, rrMaxBankLoan, rrShipAvailable,
  rrEncumbranceEffect, RR_POTION_RECIPES, applyEnemyAppearance, rrUnderworldRule, rrFightersGuildSkills, rrFightersTrainingSkills,
  rrRidingOn, rrRidingSetting, rrCanRunRiding, rrRidingInputLimits,
} from './rrRealism.js';

/** The host's seams a registered arm needs and no module can import: the
 *  foe spawner (CreateFoeSpawner, for the underworld guilds' squad), and
 *  RR2's riding reads (PlayerGPS.IsPlayerInTown, TransportManager's mode,
 *  PlayerMotor.IsRiding). Set by the world hosts at mount. */
const _host = { spawnFoe: null, inTown: null, transportMode: null, riding: null };
/** AUDIT-RR F4: FoeSpawner.cs never gives up (:53-80, one try per frame); the port's
 *  placer is a loop, so the squad's budget is a long one - 600 tries, ten seconds
 *  of DFU's frames. */
export const RR_SQUAD_PLACE_ATTEMPTS = 600;
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
    else entity.fatigue = Math.min(maxFatigue(entity), Math.max(0, (entity.fatigue ?? 0) - e.fatigueEffect));   // AUDIT-RR F8: SetFatigue's two clamps (DaggerfallEntity.cs:350-360)
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
      // AUDIT-RR F4: CreateFoeSpawner(false, type, n, min, max) - no line-of-sight check, the mod's own
      // distances, and FoeSpawner retries every frame until every foe stands (FoeSpawner.cs:53-80); the
      // port's placer takes an attempt budget, so the squad is given a long one rather than the 12 a
      // conjured foe gets
      for (let i = 0; i < wave.count; i++) _host.spawnFoe(wave.mobileType, { minDistance: wave.minDistance, maxDistance: wave.maxDistance, lineOfSightCheck: false, attempts: RR_SQUAD_PLACE_ATTEMPTS });
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

  // purificationPotion (:190-193): the effect template re-registered with its recipes. AUDIT-RR F9: read ONCE, here -
  // which is the C#'s cadence for every switch (InitMod reads them into statics; a pane change waits for the next load),
  // so this arm and enemyAppearance are the two that keep DFU's own timing while the rest read live
  overridePotionRecipes(rrModule('purificationPotion') ? RR_POTION_RECIPES : []);

  // classicStrengthDamageBonus (:202-205): DamageModifier
  const prevDamageModifier = formulaOverride('damageModifier');
  registerFormulaOverride('damageModifier', (strength) => (rrModule('classicStrengthDamageBonus') ? rrDamageModifierClassic(strength) : prevDamageModifier?.(strength)));

  // the bank loan (:98, :309-312) rides the mod's Enabled alone
  registerMaxBankLoan((level) => rrMaxBankLoan(level));

  // RR2 - enhancedRiding (:236-247): the EnhancedRiding component. Its
  // PlayerMotor.CanRun arm (EnhancedRiding.cs:106-112) and the
  // RealisticMovement axis limits (:128-136) register here; the terrain
  // follow, the look floor and the mount's draw ride the mount rig's deps.
  setCanRunOverride((mode) => (rrRidingOn()
    ? rrCanRunRiding({ mode, riding: !!_host.riding?.(), inTown: !!_host.inTown?.(), gallopingInTowns: rrRidingSetting('GallopingInTowns') === true })
    : null));
  setAxisLimitsProvider(() => (rrRidingOn() && rrRidingSetting('RealisticMovement') === true
    ? rrRidingInputLimits({ riding: !!_host.riding?.(), mode: _host.transportMode?.() ?? 'Foot' })
    : null));

  // RR2 - variantNpcs / variantResidents (:220-235) and refinedTraining's
  // "5 Days" button (:250-256): the mod's own art on its doors
  installRoleplayRealismArt();

  // RR3 - the Master Armorer quest line (:241-256): the quest list, the
  // three factions, the two table additions, the custom armor service.
  // None of these read a switch in the C# - they ride the mod's presence,
  // which is its Enabled here: the list and the service carry it as
  // their gate (read at the load and at the click), the factions are
  // registered while it is on (the dictionary is built at the load, so
  // a toggle takes effect when the game next loads, as the Features row
  // says), the table rows are names and stand either way.
  if (!registerQuestList(RR_QUEST_LIST, () => rrEnabled())) throw new Error('Quest list name is already in use, unable to register RoleplayRealism quest list.');
  if (rrEnabled()) for (const f of RR_CUSTOM_FACTIONS) registerCustomFaction(f.id, f);
  addIntoQuestTables({ places: [...RR_PLACES_TABLE], factions: [...RR_FACTIONS_TABLE] });
  registerMerchantService(RR_FACTION_IDS.OrthusDharjen, (window, entity) => rrCustomArmorService(window, entity), RR_TEXT.customArmor, () => rrEnabled());
  return true;
}

/** EncumbranceEffects_OnNewMagicRound's reads (RoleplayRealism.cs:582-590):
 *  CarriedWeight / MaxEncumbrance (live strength x 1.5), LiveSpeed,
 *  PermanentSpeed, CurrentFatigue - under the guards the port can answer
 *  (not resting, alive; a paused game or a fade runs no round here). */
function encumbranceOf(entity) {
  if (!rrModule('encumbranceEffects') || !entity?.isPlayer || !entity?.stats || entity.isResting || !((entity.health ?? 0) > 0) || syntheticTimeIncrease()) return null;   // AUDIT-RR2 G20: `!EntityEffectBroker.SyntheticTimeIncrease` (:587) - a fast travel's catch-up rounds drain nothing   // AUDIT-RR F5: the C# reads GameManager.Instance.PlayerEntity alone (:582) - a foe's loot is not its burden
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
