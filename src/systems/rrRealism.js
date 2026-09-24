// RR1 - ROLEPLAY & REALISM 1.8 (Hazelnut, MIT; vendor/roleplay-realism/
// Scripts/RoleplayRealism.cs and the four small classes beside it): the
// laws InitMod (:108-258) registers, hooks or replaces under each
// module switch, restated one function per C# member. The formula
// overrides (archery, climbing, weapon speed, weapon materials,
// equipment damage, the classic strength bonus, the bank loan), the
// ship gate, the encumbrance penalty, the douse on leaving a dungeon,
// the purification potion, the class enemies' appearance, the
// underworld guilds' expulsion, the Fighters' hand-to-hand, the bed.
// The variant NPC sprites, enhanced riding and the refined training
// window are RR2; the Master Armorer quest line, its fort and its
// factions are RR3.
//
// A leaf: modSettings (the switches), weapons (a material's modifier),
// mobileTypes and skills (the tables' keys). Everything that reads an
// entity or the scene is handed in by its caller, and rrInstall.js
// registers the seams.
import { modSetting } from './modSettings.js';
import { WEAPONS, weaponMaterialModifier } from '../characters/weapons.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { SKILLS } from './skills.js';

export const RR_VENDOR = 'roleplay-realism';
export const RR_MOD = Object.freeze({ title: 'RoleplayRealism', version: '1.8', guid: 'd828b782-46e9-40e7-8ae6-19cde308032e' });
export const rrEnabled = () => modSetting(RR_VENDOR, 'Enabled') === true;
/** `settings.GetBool("Modules", key)` (:77-93) - the mod's own switch,
 *  under the mod's own. */
export const rrModule = (key) => rrEnabled() && modSetting(RR_VENDOR, key) === true;
export const rrSetting = (key) => modSetting(RR_VENDOR, key);

// ---- constants (:20-22, :39, :41) ---------------------------------------
export const ENC_EFFECT_SCALE_FACTOR = 2;
/** `loanVals` (:41): the nine choices of loanAmountPerLevel. */
export const LOAN_VALUES = Object.freeze([2000, 4000, 6000, 8000, 10000, 20000, 30000, 40000, 50000]);
/** `PlayerActivate.RegisterCustomActivation(mod, 41000..41002, BedActivation)` (:126-128). */
export const BED_MODELS = Object.freeze([41000, 41001, 41002]);

// ---- advancedArchery (:530-578) -----------------------------------------
const isBow = (weapon) => weapon?.templateIndex === WEAPONS.Short_Bow || weapon?.templateIndex === WEAPONS.Long_Bow;
/** AdjustWeaponHitChanceMod: a drawn bow's hit chance by how long it was
 *  held - the ladder as written, the `> 5000` arm shadowing the `> 8000`
 *  one (an `else if` chain: nothing past 5000 ever reaches -20).
 *  Verbatim, shadow included. */
export function rrAdjustWeaponHitChanceMod(hitChanceMod, weaponAnimTime, weapon) {
  if (!(weaponAnimTime > 0 && isBow(weapon))) return hitChanceMod;
  let adjusted = hitChanceMod;
  if (weaponAnimTime < 200) adjusted -= 40;
  else if (weaponAnimTime < 500) adjusted -= 10;
  else if (weaponAnimTime < 1000) adjusted = hitChanceMod;
  else if (weaponAnimTime < 2000) adjusted += 10;
  else if (weaponAnimTime > 5000) adjusted -= 10;
  else if (weaponAnimTime > 8000) adjusted -= 20;   // unreachable behind the arm above - the C#'s own shape
  return adjusted;
}
/** AdjustWeaponAttackDamage: a short draw scales the damage down by
 *  `t / 800`, a long hold by 0.85 / 0.75 / 0.5 / 0.25; the C# int cast. */
export function rrAdjustWeaponAttackDamage(damage, weaponAnimTime, weapon) {
  if (!(weaponAnimTime > 0 && isBow(weapon))) return damage;
  let adjusted = damage;
  if (weaponAnimTime < 800) adjusted *= weaponAnimTime / 800;
  else if (weaponAnimTime < 5000) adjusted = damage;
  else if (weaponAnimTime < 6000) adjusted *= 0.85;
  else if (weaponAnimTime < 8000) adjusted *= 0.75;
  else if (weaponAnimTime < 9000) adjusted *= 0.5;
  else if (weaponAnimTime >= 9000) adjusted *= 0.25;
  return Math.trunc(adjusted);
}

// ---- climbingRestriction (:320-348) ---------------------------------------
/** CalculateClimbingChance, the override: "Fail to climb if weapon not
 *  sheathed" - a drawn weapon that is not bare hands answers 0 and says
 *  so mid-screen; otherwise DFU's own formula, restated (skill + 30 for
 *  a Khajiit, x2 under the Climbing effect, clamped 5..95; Lerp(base,
 *  100, skill%) + Lerp(0, 10, luck%), the C# int cast). */
export const NO_CLIMB_HOLDING_WEAPON = "You can't climb whilst holding your weapon.";   // RoleplayRealismModData.csv noClimbHoldingWeapon
export function rrClimbingChance(base, { climbing = 0, luck = 0, khajiit = false, enhanced = false, weaponDrawn = false, weaponMelee = true, say = null } = {}) {
  if (weaponDrawn && !weaponMelee) { say?.(NO_CLIMB_HOLDING_WEAPON); return 0; }
  let skill = climbing + (khajiit ? 30 : 0);
  if (enhanced) skill *= 2;
  skill = Math.min(95, Math.max(5, skill));
  const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
  const luckFactor = lerp(0, 10, luck * 0.01);
  return Math.trunc(lerp(base, 100, skill * 0.01) + luckFactor);
}

// ---- weaponSpeed (:350-387) ---------------------------------------------
/** GetMeleeWeaponAnimTime, the override: the swing speed blends the live
 *  speed and strength by the weapon's hands - both hands 50/50, a dagger
 *  90/10, bare hands the speed alone, anything else 80/20 - each ratio
 *  capped by 0.15 / 0.03 / 0 / 0.08 once its stat passes 70; then DFU's
 *  `3 * (115 - blend)` over the classic frame update. `hands` is
 *  ItemHands ('Both' for a two-hander); `weaponType` DFU's WeaponTypes
 *  (Dagger 4, Dagger_Magic 5, Melee 15). Registered only when Roleplay &
 *  Realism: Items' weaponBalance is off (:171). */
export function rrMeleeWeaponAnimTime({ liveSpeed, liveStrength, weaponType = -1, hands = 'One' }, classicFrameUpdate) {
  let spdRatio = 0.8, strRatio = 0.2, capRatio = 0.08;
  if (hands === 'Both') { spdRatio = 0.5; strRatio = 0.5; capRatio = 0.15; }
  else if (weaponType === 4 || weaponType === 5) { spdRatio = 0.9; strRatio = 0.1; capRatio = 0.03; }
  else if (weaponType === 15) { spdRatio = 1; strRatio = 0; capRatio = 0; }
  if (liveSpeed > 70) spdRatio -= capRatio;
  if (liveStrength > 70) strRatio -= capRatio;
  const frameSpeed = 3 * (115 - ((liveSpeed * spdRatio) + (liveStrength * strRatio)));
  return frameSpeed / classicFrameUpdate;
}

// ---- weaponMaterials (:389-392) -------------------------------------------
/** CalculateWeaponToHit, the override: the material's modifier x3, not
 *  DFU's x10 - "so skill remains key factor". */
export const rrWeaponToHit = (weapon) => weaponMaterialModifier(weapon?.material ?? 0) * 3;

// ---- equipDamage (:394-407) --------------------------------------------------
/** ApplyConditionDamageThroughPhysicalHit, the override: ARMOR takes
 *  `damage * 5` condition ("proportional to max condition" - the
 *  same points off a bigger pool) and the override answers true; a
 *  weapon answers false and DFU's own arm runs. `lower(item, amount)`
 *  is LowerCondition at the caller's seam. */
export function rrConditionDamageThroughPhysicalHit(item, damage, lower) {
  if (item?.group !== 'Armor') return false;
  lower(item, damage * 5);
  return true;
}

// ---- classicStrengthDamageBonus (:314-317) ------------------------------
/** DamageModifier_classicDisplay: `Floor((strength - 50) / 10)` - the
 *  mod names it a display change; the member it overrides is the one
 *  CalculateWeaponAttackDamage adds, so the blow carries it too. */
export const rrDamageModifierClassic = (strength) => Math.floor((strength - 50) / 10);

// ---- loanAmountPerLevel (:98, :309-312) ----------------------------------
/** `loanMaxPerLevel = loanVals[settings.GetInt("Modules", "loanAmountPerLevel")]`. */
export const rrLoanMaxPerLevel = () => LOAN_VALUES[rrSetting('loanAmountPerLevel') ?? 4] ?? LOAN_VALUES[4];
/** CalculateMaxBankLoan, the override: `Level * loanMaxPerLevel`. Always
 *  registered while the mod is on (InitMod has no switch for it). */
export const rrMaxBankLoan = (level) => (rrEnabled() ? (level | 0) * rrLoanMaxPerLevel() : null);

// ---- shipPorts (:610-631) ---------------------------------------------------
/** IsShipAvailiable, `TransportManager.ShipAvailiable`'s replacement:
 *  on the ship, yes; in a loaded location, a port town
 *  (`PortTownAndUnknown != 0`) AND an owned ship; otherwise no. (The
 *  Travel Options arm - the same question to that mod's port table -
 *  is the port's own `portTown` answer where a host has one.) `null`
 *  for a host that cannot say where it stands hands the question back. */
export function rrShipAvailable({ onShip = false, locationLoaded = false, portTown = null, ownsShip = false } = {}) {
  if (!rrModule('shipPorts')) return null;
  if (onShip) return true;
  if (locationLoaded) {
    if (portTown == null) return null;
    return portTown && ownsShip;
  }
  return false;
}

// ---- encumbranceEffects (:580-598) ------------------------------------------
/** EncumbranceEffects_OnNewMagicRound: past three quarters of MaxEncumbrance
 *  the excess (capped at 120%) times 2 is the fraction of the PERMANENT
 *  speed taken off the live one (never below 2) and the fatigue spent
 *  (`Min(CurrentFatigue - 100, over * 100)`, raw fatigue units - which
 *  goes NEGATIVE under 100 fatigue and DecreaseFatigue then adds; the
 *  C#'s own arithmetic). Answers null under the threshold. */
export function rrEncumbranceEffect({ carriedWeight = 0, maxEncumbrance = 1, liveSpeed = 50, permanentSpeed = 50, currentFatigue = 0 } = {}) {
  // AUDIT-RR F7: the C# is float arithmetic (:590-595) - fround at every step, or a band edge lands one off
  const encPc = Math.fround(Math.min(maxEncumbrance > 0 ? Math.fround(carriedWeight / maxEncumbrance) : 0, 1.2));
  const encOver = Math.fround(Math.fround(Math.max(Math.fround(encPc - 0.75), 0)) * ENC_EFFECT_SCALE_FACTOR);
  if (!(encOver > 0)) return null;
  const speedEffect = Math.min(liveSpeed - 2, Math.trunc(Math.fround(permanentSpeed * encOver)));
  const fatigueEffect = Math.min(currentFatigue - 100, Math.trunc(Math.fround(encOver * 100)));
  return { encPc, encOver, speedEffect, fatigueEffect };
}

// ---- bandaging (:150-153, :600-608) ----------------------------------------
/** UseBandage, THIS mod's: `medical / 2`, and RemoveItem (the whole
 *  record, not one off a stack). Registered only `if (rrItemsMod == null
 *  && bandaging)` - and the port carries Roleplay & Realism: Items
 *  always, so this arm never registers here (RRI2's is the one that
 *  runs). Ported for the record. */
export const rrBandageHeal = (medical, maxHealth) => Math.trunc(Math.min(Math.trunc(medical / 2), maxHealth * 0.4));

// ---- autoExtinguishLight (:633-640) ---------------------------------------------
/** OnTransitionToDungeonExterior_ExtinguishLight: leaving a dungeon by
 *  day with a light source lit douses it, with the light's own
 *  "You douse the %it." box. Answers the doused item, or null. */
export function rrDouseOnDungeonExit(entity, { isDay = false } = {}) {
  if (!rrModule('autoExtinguishLight') || !entity?.lightSource || !isDay) return null;
  const item = entity.lightSource;
  entity.lightSource = null;
  return item;
}

// ---- purificationPotion (CureDiseasePotionRR.cs) ---------------------------------
/** CureDiseasePotionRR.SetPotionProperties: the Cure Disease effect's two
 *  recipes re-declared - cureDisease as it is, and purification with
 *  HealHealth and CURE POISON as its secondaries where DFU's carries
 *  HealHealth and Invisibility (CureDisease.cs:61-70 vs the mod's
 *  :34-46). The rows are the port's recipe shape (systems/potions.js),
 *  keyed by the same eight ingredients. */
export const RR_POTION_RECIPES = Object.freeze([
  Object.freeze({ name: 'cureDisease', price: 100, ingredients: [31, 56, 62], effect: '3,0', displayName: 'Cure Disease', textureRecord: 35, settings: { chanceMod: 10 } }),
  Object.freeze({ name: 'purification', price: 500, ingredients: [3, 31, 39, 49, 56, 60, 62, 63], effect: '3,0', displayName: 'Purification', textureRecord: 35, settings: { chanceMod: 10, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 19, magnitudeLevelHigh: 19 }, secondary: ['10,8', '3,1'] }),   // HealHealth (10,8), CurePoison (3,1) - CurePoison.cs:28
]);

// ---- enemyAppearance (:697-773) -----------------------------------------------
/** UpdateEnemyClassAppearances: eight class rows of EnemyBasics.Enemies
 *  re-textured (the Sorcerer to 475/476 and made a caster with a spell
 *  animation, the Bard and Barbarian to 481/482, the Rogue to 487/488,
 *  the Archer and Ranger to 479/480, the Warrior and Knight to 477/478)
 *  with their attack frames. The keys are the port's basics fields
 *  (characters/enemyBasics.js); DFU writes the table at Awake and so
 *  does the port at install, keeping the originals to restore. */
export const RR_ENEMY_APPEARANCE = Object.freeze({
  [MOBILE_TYPES.Sorcerer]: Object.freeze({
    maleTexture: 476, femaleTexture: 475, hasRangedAttack1: false, castsMagic: true,
    primaryAttackAnimFrames: [0, 1, -1, 2, 3, 4, 5], chanceForAttack2: 33, primaryAttackAnimFrames2: [5, 4, 3, -1, 2, 1, 0],
    chanceForAttack3: 33, primaryAttackAnimFrames3: [0, 1, -1, 2, 2, 1, 0], hasSpellAnimation: true, spellAnimFrames: [0, 1, 2, 3, 3],
  }),
  [MOBILE_TYPES.Bard]: Object.freeze({
    maleTexture: 482, femaleTexture: 481, primaryAttackAnimFrames: [0, 1, -1, 2, 3, 4, -1, 5],
    chanceForAttack2: 50, primaryAttackAnimFrames2: [3, 4, -1, 5, 0], chanceForAttack3: 0,
  }),
  [MOBILE_TYPES.Rogue]: Object.freeze({
    maleTexture: 488, femaleTexture: 487, primaryAttackAnimFrames: [0, 0, 1, -1, 2, 2, 1, 0],
    primaryAttackAnimFrames2: [0, 1, -1, 2, 3, 4, 5], primaryAttackAnimFrames3: [5, 5, 3, -1, 2, 1, 0],
  }),
  [MOBILE_TYPES.Archer]: Object.freeze({
    maleTexture: 480, femaleTexture: 479, primaryAttackAnimFrames: [0, 1, -1, 2, 3, 4, -1, 5, 0],
    chanceForAttack2: 33, primaryAttackAnimFrames2: [4, 4, -1, 5, 0, 0], chanceForAttack3: 33, primaryAttackAnimFrames3: [4, -1, 5, 0, 0, 1, -1, 2, 3, 4, -1, 5, 0],
  }),
  [MOBILE_TYPES.Ranger]: Object.freeze({
    maleTexture: 480, femaleTexture: 479, primaryAttackAnimFrames: [0, 1, -1, 2, 3, 4, -1, 5, 0],
    chanceForAttack2: 33, primaryAttackAnimFrames2: [4, 4, -1, 5, 0, 0], chanceForAttack3: 33, primaryAttackAnimFrames3: [4, -1, 5, 0, 0, 1, -1, 2, 3, 4, -1, 5, 0],
  }),
  [MOBILE_TYPES.Barbarian]: Object.freeze({
    maleTexture: 482, femaleTexture: 481, primaryAttackAnimFrames: [0, 1, -1, 2, 3, 4, -1, 5],
    chanceForAttack2: 50, primaryAttackAnimFrames2: [3, 4, -1, 5, 0], chanceForAttack3: 0,
  }),
  [MOBILE_TYPES.Warrior]: Object.freeze({
    maleTexture: 478, femaleTexture: 477, primaryAttackAnimFrames: [0, 1, 2, -1, 3, 4, 5],
    chanceForAttack2: 50, primaryAttackAnimFrames2: [4, 5, -1, 3, 2, 1, 0], chanceForAttack3: 0,
  }),
  [MOBILE_TYPES.Knight]: Object.freeze({
    maleTexture: 478, femaleTexture: 477, primaryAttackAnimFrames: [0, 1, 2, -1, 3, 4, 5],
    chanceForAttack2: 50, primaryAttackAnimFrames2: [4, 5, -1, 3, 2, 1, 0], chanceForAttack3: 0,
  }),
});
const _appearanceOriginals = new Map();
/** Write the eight rows over `basics` (the port's ENEMY_BASICS, whose rows
 *  are plain objects as DFU's array entries are). Once; answers the rows
 *  touched. */
export function applyEnemyAppearance(basics) {
  if (_appearanceOriginals.size) return 0;
  let n = 0;
  for (const [id, row] of Object.entries(RR_ENEMY_APPEARANCE)) {
    const target = basics?.[id];
    if (!target || Object.isFrozen(target)) { if (target) console.warn(`[rr] enemyAppearance: ENEMY_BASICS row ${id} is frozen - the mod's appearance cannot be written`); continue; }   // AUDIT-RR F10
    const saved = {};
    for (const k of Object.keys(row)) saved[k] = Object.hasOwn(target, k) ? target[k] : undefined;
    _appearanceOriginals.set(id, saved);
    for (const [k, v] of Object.entries(row)) target[k] = Array.isArray(v) ? [...v] : v;
    n++;
  }
  return n;
}
/** Restore what applyEnemyAppearance wrote (the test seam, and a pane
 *  toggle's "next load"). */
export function revertEnemyAppearance(basics) {
  for (const [id, saved] of _appearanceOriginals) {
    const target = basics?.[id];
    if (!target) continue;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete target[k]; else target[k] = v; }
  }
  _appearanceOriginals.clear();
}
export const enemyAppearanceApplied = () => _appearanceOriginals.size > 0;

// ---- underworldExpulsion (ThievesGuildRR.cs, DarkBrotherhoodRR.cs) --------------------
/** The two guild classes: AllowGuildExpulsion answers the rank as it
 *  comes (DFU's clamps a negative to 0 - ThievesGuild.cs:128-131,
 *  DarkBrotherhood.cs:132-135); Join floors the reputation at 2 ("a 1
 *  quest failure buffer"); Leave sends the death squad
 *  (`CreateFoeSpawner(false, type, count, min, max)`); TokensExpulsion
 *  is the mod's own text (RoleplayRealismModData.csv). */
export const RR_UNDERWORLD = Object.freeze({
  ThievesGuild: Object.freeze({
    joinReputationFloor: 2,
    squad: (level) => [{ mobileType: MOBILE_TYPES.Rogue, count: 4 + Math.trunc(level / 1.5), minDistance: 1, maxDistance: 8 }, { mobileType: MOBILE_TYPES.Thief, count: 4 + Math.trunc(level / 1.5), minDistance: 1, maxDistance: 4 }],
    // TokensExpulsion (ThievesGuildRR.cs:24-37): five centred lines, a
    // blank one before the last; %pcn is the player's name, expanded
    // by the box (MacroHelper)
    expulsion: Object.freeze([
      "%pcn, you've disappointed us yet again with your bleedin'",
      'shoddy work and our patience has run as dry as a desert.',
      "An' without bringing in nearly enough dough or gaining",
      'powerful connections, is not sufficient to save your skin.',
      '',
      "You're bloody done as a thief, get 'em lads!",
    ]),
  }),
  DarkBrotherhood: Object.freeze({
    joinReputationFloor: 2,
    squad: (level) => [{ mobileType: MOBILE_TYPES.Assassin, count: 4 + Math.trunc(level / 2), minDistance: 1, maxDistance: 5 }, { mobileType: MOBILE_TYPES.Nightblade, count: 4 + Math.trunc(level / 2), minDistance: 4, maxDistance: 16 }],
    // TokensExpulsion (DarkBrotherhoodRR.cs:24-35): four centred lines, a
    // blank one after the second
    expulsion: Object.freeze([
      "%pcn, you have disappointed us yet again, and you've not",
      'made powerful enough connections to save your reputation.',
      '',
      "Our patience is limited and it's worn thin. Now your",
      'membership, and by extension your life, is forfeit!',
    ]),
  }),
});
export const rrUnderworldRule = (guildName) => (rrModule('underworldExpulsion') ? RR_UNDERWORLD[guildName] ?? null : null);

// ---- fightersTeachHandToHand (FightersGuildRR.cs) - RETIRED -------------------------
// FGH2H-R (2026-09-24, Mac: "retire it"): FGH2H put HandToHand in the Fighters Guild's
// base lists beside Giantish, so this module's lists (HandToHand in Giantish's place)
// only took Giantish away. The switch is off the pane (modSettings.js RETIRED_KEYS) and
// the guild reads its own lists; the Port-Ledger's FGH2H row records the departure.

// ---- bedSleeping (:126-128, :464-506) ------------------------------------------
/** A bed is one of the three furniture models; clicking one runs
 *  DaggerfallUI's rest gate (enemies nearby / swimming or not grounded /
 *  the prevented-rest message / the racial override) and opens the
 *  rest window - the port's host `toggleRest`, which is that gate. */
export const isBedModel = (modelIdNum) => BED_MODELS.includes(modelIdNum);
export const bedSleepingOn = () => rrModule('bedSleeping');

// ======================================================================
// RR2 - the laws past the rule modules: enhanced riding (EnhancedRiding.cs)
// and the refined training service (GuildServiceTrainingRR.cs). The NPC
// sprite variants are systems/rrVariants.js (they read tables this leaf
// must not import).
// ======================================================================

// ---- EnhancedRiding.cs -------------------------------------------------
export const RR_RIDING = Object.freeze({
  lookPitchRatio: 2.6,      // LookPitchRatio (:17)
  extX: 0.06, extW: 0.78,   // the neck band's texcoords (:18-19)
  samples: 16,              // the terrain angle ring (:22)
  pitchMaxOffset: 18,       // `PitchMaxLimit = terrainAngle + 18` (:251)
  chargeKnockback: 100,     // `KnockbackSpeed = 100` (:199)
  chargeFatigueMultiplier: 15,   // `DecreaseFatigue(DefaultFatigueLoss * 15)` (:205)
});
export const rrRidingOn = () => rrEnabled() && rrSetting('EnhancedRiding.enhancedRiding') === true;
export const rrRidingSetting = (key) => rrSetting(`EnhancedRiding.${key}`);
/** CanRunUnlessRidingCart (:57-61): `!((mode == Cart || inTownNoGallop) &&
 *  IsRiding)` - no galloping with the cart, nor in a town unless
 *  GallopingInTowns. `riding` is PlayerMotor.IsRiding. */
export function rrCanRunRiding({ mode = 'Foot', riding = false, inTown = false, gallopingInTowns = false } = {}) {
  const inTownNoGallop = inTown && !gallopingInTowns;
  return !((mode === 'Cart' || inTownNoGallop) && riding);
}
/** Update's RealisticMovement arm (:105-131): InputManager's axis limits
 *  while riding - backwards 0.5 (a cart 0.2), sideways 0.4 (a cart 0.1);
 *  off the mount, all three back to 1. */
export function rrRidingInputLimits({ riding = false, mode = 'Foot' } = {}) {
  if (!riding) return { negVertical: 1, negHorizontal: 1, posHorizontal: 1 };
  const cart = mode === 'Cart';
  return { negVertical: cart ? 0.2 : 0.5, negHorizontal: cart ? 0.1 : 0.4, posHorizontal: cart ? 0.1 : 0.4 };
}
/** Update's terrain sample (:108-118): the ground under the player against
 *  the ground one unit ahead, `Atan2(heightDiff, 1) * 100`. */
export const rrTerrainAngle = (hereY, aheadY) => Math.atan2(hereY - aheadY, 1) * 100;
/** OnGUI's average (:241-249): the ring's sum over `samples + softenFollow`
 *  when TerrainFollowing, else 0. */
export function rrTerrainFollow(samples, softenFollow = 0, following = true) {
  if (!following || !samples?.length) return 0;
  let sum = 0;
  for (const a of samples) sum += a;
  return sum / (samples.length + softenFollow);
}
/** `yAdj = (Pitch - terrainAngle - 10) * LookPitchRatio` (:252) - the
 *  mount's sprite rises and falls with the look; `pitchDegrees` is
 *  PlayerMouseLook.Pitch (up negative in DFU's convention). */
export const rrRidingYAdj = (pitchDegrees, terrainAngle) => (pitchDegrees - terrainAngle - 10) * RR_RIDING.lookPitchRatio;
/** OnGUI's neck band (:266-278): when the sprite's bottom lifts off the
 *  screen bottom, the gap is filled with a strip of the riding texture
 *  itself (no neck CFA imported here: TryImportCifRci answers nothing
 *  for the port) - `yAdjNeck = yAdj / 100` of the texture from 0.2 down,
 *  `extX .. extX + extW` across, `width - 14` wide. */
export function rrRidingNeckBand(yAdj) {
  const yAdjNeck = yAdj / 100;
  // AUDIT-RR F14: `Rect(extX, 0.2 - yAdjNeck, extW, yAdjNeck)` is in Unity texcoords, v = 0 at the BOTTOM row (DFBitmap
  // .GetColor32 flips rows on upload) - the band is the bottom fifth of the sprite, the neck and chest. The port's
  // screen quad samples v = 0 at the TOP row, so the same rows are 0.8 .. 0.8 + yAdjNeck here.
  return { u0: RR_RIDING.extX, u1: RR_RIDING.extX + RR_RIDING.extW, v0: 0.8, v1: 0.8 + yAdjNeck, widthTrim: 14 };
}
/** HandleCharge's blow (:206-210): CalculateHandToHandMin/MaxDamage over
 *  the live skill, `Range(min, max + 1)`, plus Agility / 10 and
 *  Willpower / 10 (C# int division). `roll` is Random.Range's slot. */
export function rrChargeDamage({ minBase = 1, maxBase = 1, agility = 50, willpower = 50, roll = 0 } = {}) {
  let damage = minBase + Math.floor(roll * (maxBase + 1 - minBase));
  damage += Math.trunc(agility / 10);
  damage += Math.trunc(willpower / 10);
  return damage;
}
/** OnTriggerEnter's trample (:157-186): a running ride into a townsperson -
 *  a civilian bleeds, cries the Breton pain clip of their gender, the
 *  watch is called and the crime is Assault ("Nearest to manslaughter");
 *  a guard is charged instead (a fresh guard stands where they were) and
 *  the crime is the same. Either way the person is taken off the street. */
export function rrTrampleOutcome({ isGuard = false, female = false } = {}) {
  return isGuard
    ? { chargeGuard: true, spawnGuards: false, blood: false, clip: null, crime: 'Assault', remove: true }
    : { chargeGuard: false, spawnGuards: true, blood: true, clip: female ? 'BretonFemalePain3' : 'BretonMalePain3', crime: 'Assault', remove: true };
}

// ---- GuildServiceTrainingRR.cs ---------------------------------------------
export const RR_WEEK_BUTTON = 21;   // `weekButton = (MessageBoxButtons)21` - the mod's own BUTTONS.RCI record ("5 Days")
export const RR_INTENSIVE_DAYS = 4;          // `RaiseTime(SecondsPerDay * 4)` then the fifth session
export const RR_INTENSIVE_SKILL_POINTS = 4;  // `SetPermanentSkillValue(skill, value + 4)`
export const rrRefinedTrainingOn = () => rrEnabled() && rrSetting('RefinedTraining.refinedTraining') === true;
/** TrainingSkillPicker_OnItemPicked (:62-66): `trainingCost -=
 *  (int)(trainingCost * skillOfMax / 2)` with `skillOfMax = 1 - skill /
 *  max` under variableTrainingPrice - a raw skill trains for half. */
export function rrTrainingCost(baseCost, skillValue, trainingMax, variable = true) {
  if (!variable || !(trainingMax > 0)) return baseCost;
  const skillOfMax = Math.fround(1 - Math.fround(skillValue / trainingMax));   // AUDIT-RR F26: float32, as the C#'s `(float)skillValue / trainingMax`
  return baseCost - Math.trunc(Math.fround(baseCost * skillOfMax / 2));
}
/** `intensiveCost = (trainingCost + (Level * 8) + 72) * 5` (:71). */
export const rrIntensiveCost = (trainingCost, level) => (trainingCost + level * 8 + 72) * 5;
/** The week button is offered `if (intensive && skillValue < trainingMax - 4)` (:86). */
export const rrIntensiveOffered = (intensive, skillValue, trainingMax) => !!intensive && skillValue < trainingMax - 4;
/** RoleplayRealismModData.csv - the training window's lines; `{0}` the
 *  skill name or the intensive cost, `%a` the session's cost. */
export const RR_TRAINING_LINES = Object.freeze({
  trainingSkill1: 'Training your {0} skill will cost %a gold for a single session.',
  trainingSkill2: 'You can also pay extra to train intensively for five days if you wish,',
  trainingSkill3: 'with a training session each day, this will cost {0} gold in total.',
  trainingSkill4: 'So, would you like to train your {0} skill with me?',
  trainingSkillIntense1: 'You have spent the last 4 days intensively training your ',
  trainingSkillIntense2: '{0} skill, and have improved it significantly.',
  trainingSkillIntense3: "Now it's time to begin your fifth and final session...",
});
