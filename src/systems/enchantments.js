// E1: THE ENCHANTMENT SYSTEM - the largest never-started system in
// AUDIT 25's accounting, at 0% until this slice. Verbatim from DFU's
// Enchanting effect classes + EntityEffectManager.DoItemEnchantmentPayloads
// (MIT, Daggerfall Workshop). The port's magic items have carried their
// MAGIC.DEF enchantment pairs since S1 (loot.js mints
// item.enchantments = [{type, param}]) and NOTHING ever read them -
// every magic item was a label.
//
// SHAPE. DFU runs enchantments through two mechanisms:
//   1. HELD bundles whose ConstantEffect() re-applies cleared entity
//      modifier channels every frame (DoConstantEffects,
//      EntityEffectManager.cs:1678-1702), and
//   2. payload CALLBACKS dispatched per context flag
//      (DoItemEnchantmentPayloads, :962-1035).
// The port folds (1) into a per-magic-round recompute of
// `entity._enchantMods` (computeEnchantmentMods) - the S22 read-time
// idiom at the broker's own cadence; conditions (season, sunlight,
// nearby creatures) change on the minute scale, so the round is the
// honest resolution - and keeps (2) as the dispatcher, law for law,
// including the quirks called out below.
//
// ROUND COUNTER. DFU cadences (`% 4`, `% 60`) run on
// MagicRoundsSinceStartup, a counter that starts at 0 each SESSION -
// its phase is arbitrary. The port passes the absolute classic minute:
// identical cadence, phase pinned to the world clock instead of the
// boot moment (recorded; the same substitution class as Ledger A's
// AmbientEffectsPlayer row).
//
// CTX SEAMS (all optional - an absent seam idles its arm, the headless
// charter). E2: a host mounts them ONCE with setDefaultEnchantCtx and
// every dispatch folds that under any per-call ctx. The seams:
// spellsByIndex(), applySpellToTarget/applySpellToSelf/setReadySpell
// (the cast arms - hostMagic supplies them; assignHeldSpell defaults
// to this module's own over the effects doors), now() (the classic
// minute clock for equip stamps), sinks + rolls (the wearer's effect
// doors for held applies), castingSkillOf(skillId) (the equip
// durability bill's skill read - defaults to the wearer's),
// inSunlight()/inDarkness()/inHolyPlace() (PlayerEnterExit flags -
// V2c: answered off the passiveSpecials host seam at world.js's
// mount, so RegensHealth/ItemDeteriorates/UserTakesDamage's
// conditional arms are live), season(), moonPhase(param) (V2c:
// ExtraSpellPts' IsFull/IsHalf/IsNewMoon over gameDate's lunar law),
// nearbyFoes(range) -> [{ mobileType, hurt(n) }] (PlayerGPS.
// GetNearbyObjects - the affinity classifier lives HERE off
// ENEMY_BASICS), spawnFoe(mobileType) (SoulBound's break, B1's
// spawner), isResting(), allowMagicRepairs (a DFU setting, default
// false), say(msg).

import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { equipTableOf, lowerCondition, setEnchantmentHooks } from './equip.js';
import { MINUTES_PER_DAY } from './gameDate.js';   // the canonical home - worldTick re-exports it and imports the pump below, so this leaf must not close the cycle
import { classicCastingCost } from './spellcost.js';   // E2: CastWhenHeld's equip durability hit IS the spell's classic casting cost
import { skillValue } from './skills.js';
import { enchantmentCost, defaultParam } from './enchantmentCatalogue.js';   // G4: the legacy value sum reads M4's costs
import { artifactHook } from './artifactEffects.js';   // V3: the nine artifact classes' sub-registry

// EnchantmentTypes moved HOME to formats/magicDef.js (V3) - it is
// FallExe's enum and the artifact registry reads it below this module
// in the graph; re-exported for this module's many consumers.
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';
export { ENCHANTMENT_TYPES };

/** EnchantmentSettings.ClassicType (DaggerfallUnityItem.cs:1316-1320).
 *  A settings row names its effect by KEY - DFU's EffectKey is the
 *  enum member's NAME, which is exactly what
 *  enchantmentCatalogue.js keys its cost tables by - and what
 *  SetEnchantments stores on the item is the classic TYPE, the
 *  number. A legacy row minted from MAGIC.DEF already carries the
 *  number and passes straight through. */
export const classicEnchantmentType = (type) =>
  (typeof type === 'string' ? ENCHANTMENT_TYPES[type] ?? ENCHANTMENT_TYPES.None : type);

/** EnchantmentPayloadFlags (MagicAndEffectsEnums.cs:158-177), verbatim. */
export const PAYLOAD = Object.freeze({
  None: 0, Enchanted: 1, Used: 2, Equipped: 4, Unequipped: 8, Held: 16,
  Strikes: 32, Breaks: 64, MagicRound: 128, RerollEffect: 256,
});

// The classic constants, each from its effect class (file:line cited
// at the arm that spends it).
export const REGEN_PER_ROUNDS = 4;            // RegensHealth.cs:25 (VampiricEffect.cs:27 shares the value)
export const CONDITION_PER_ROUNDS = 4;        // RepairsObjects.cs:25 / ItemDeteriorates.cs:29
export const DAMAGE_PER_ROUNDS = 4;           // UserTakesDamage.cs:27
export const TIME_LEECH_PER_ROUNDS = 4;       // HealthLeech.cs:27
export const LEECH_CAST_AMOUNT = 16;          // HealthLeech.cs:29
export const LEECH_WEAPON_AMOUNT = 8;         // HealthLeech.cs:30
export const DURABILITY_LOSS_ON_USE = 10;     // CastWhenUsed.cs:30
export const DURABILITY_LOSS_ON_STRIKE = 10;  // CastWhenStrikes.cs:30
export const HELD_DEGRADE_RATE = 4;           // CastWhenHeld.cs:27
export const HELD_DEGRADE_RATE_RESTING = 60;  // CastWhenHeld.cs:28
export const EXTRA_SPELL_PTS_MAX_INCREASE = 75;   // ExtraSpellPts.cs:84
export const ENHANCE_SKILL_MOD = 15;          // EnhancesSkill.cs:28
export const REP_ADJUSTMENT = 10;             // GoodRepWith.cs:26 (+) / BadRepWith.cs:30 (-)
export const POTENT_VS_DAMAGE = 5;            // PotentVs.cs:27
export const LOW_DAMAGE_VS = -5;              // LowDamageVs.cs:27
export const STRENGTHENS_ARMOR_VALUE = -5;    // StrengthensArmor.cs:25 ("lower armor value equals a stronger rating")
export const WEAKENS_ARMOR_VALUE = 5;         // WeakensArmor.cs:25

/** AUDIT 26 F122/F123. DaggerfallEntity keeps TWO armour channels and
 *  neither one accumulates: both setters are MIN-SETS, assigning only
 *  when the incoming value is lower than the standing one
 *  (DaggerfallEntity.cs:400-416), and both are zeroed on every
 *  constant-effects pass (:841-842). The port folded all three
 *  payloads into one `+=` channel, which diverged three ways:
 *
 *  - Two StrengthensArmor items gave -10 where DFU floors at -5, so
 *    the player was measurably harder to hit than DFU allows. Same
 *    for two BadReactionsFrom sources.
 *  - WeakensArmor calls SetDecreasedArmorValueModifier(+5), and
 *    `5 < 0` is never true from a zeroed channel, so the enchantment
 *    is INERT in DFU. The port added +5 into the shared channel each
 *    round, so the drawback the player took for -700 enchantment
 *    budget cost defence only here. Bug-for-bug: the setter is
 *    written as DFU writes it and WeakensArmor stays inert.
 *  - The two channels are SEPARATE, so a Strengthens item and a
 *    BadReactionsFrom source still reach -10 between them - it is
 *    only repeats WITHIN a channel that stop stacking.
 *
 *  BadReactionsFrom's ChanceToHit term is genuinely additive
 *  (ChangeChanceToHitModifier, :418-421) and keeps its `+=`. */
const setIncreasedArmorValueModifier = (mods, amount) => {
  if (amount < mods.increasedArmorMod) mods.increasedArmorMod = amount;
};
const setDecreasedArmorValueModifier = (mods, amount) => {
  if (amount < mods.decreasedArmorMod) mods.decreasedArmorMod = amount;
};
export const BAD_REACTIONS_RANGE = 8;         // BadReactionsFrom.cs:25
export const BAD_REACTIONS_ARMOR = -5;        // BadReactionsFrom.cs:26
export const BAD_REACTIONS_HIT = -5;          // BadReactionsFrom.cs:27
export const EXTRA_SPELL_PTS_NEARBY_RADIUS = 18;  // ExtraSpellPts.cs:26
export const VAMPIRIC_DRAIN_RANGE = 2.25;     // VampiricEffect.cs:26

/** GetCombinedEnchantmentSettings' legacy walk
 *  (DaggerfallUnityItem.cs:1402-1436): skip None slots; a
 *  SpecialArtifactEffect keys by its artifact subtype (the artifact
 *  effect classes pend their own slice - the registry answers no
 *  handler and the dispatcher's unknown-key quirk below applies,
 *  which is ALSO what stock DFU does for a artifact key when the
 *  Special effect class is missing). */
export function itemEnchantments(item) {
  const list = item?.enchantments;
  if (!list || !list.length) return null;
  const out = list.filter((e) => e && e.type !== ENCHANTMENT_TYPES.None);
  return out.length ? out : null;
}

export const isEnchantedItem = (item) => !!itemEnchantments(item);

// ---- G4: what a LEGACY magic item is WORTH --------------------------
// ItemBuilder.CreateRegularMagicItem's closing sum (:599-635). This
// had been an open flag at its own site since S4c - "a magic item
// still sells at its mundane base until the enchantment cost sum is
// ported" - and M4's catalogue is that sum's missing half, so it
// closed here and stays closed: legacyEnchantmentValue (:222-238) is
// the sum, over VALUE_COUNTS_BELOW (:179), spellEnchantPtCost (:214)
// and the SoulBound/CastWhen arms, and systems/loot.js:259 prices
// every minted legacy item through it.
//
// THE BOUND IS THE ENUM'S OWN ORDER (:604-605): only
// `type < ItemDeteriorates` counts, and ItemDeteriorates is 16. Types
// 16-25 are exactly the drawbacks, so a legacy item's value counts
// its POWERS and nothing else - the same shape M3's GetTotalGoldCost
// takes for a hand-made one. `None` (-1) is skipped by the same test
// only because it also fails `!= None`, which DFU writes out.
//
// AND THE ONE THAT DOES NOT FIT: SoulBound is 15, UNDER the bound, so
// it counts - but it is scored `+ SoulPts` off the enemy table, a
// POSITIVE, where the item maker charges the catalogue's NEGATIVE for
// the same enchantment. DFU's own comment beside it reads "Not sure
// about this. Should be negative? Needs to be tested." So a bound
// soul makes a SHOP item dearer and a HAND-MADE item cheaper, and
// both are verbatim.
//
// THE THREE CastWhen* ARE PRICED TWICE OVER, differently: here it is
// `10 * CalculateCastingCost` of the SPELLS.STD record
// (FormulaHelper.GetSpellEnchantPtCost :2387-2402), where the item
// maker charges the flat classicSpellCosts table M4 gathered. The
// same enchantment is worth one thing bought and another made.
export const VALUE_COUNTS_BELOW = ENCHANTMENT_TYPES.ItemDeteriorates;   // 16

/** The five ItemBuilder routes into enchantmentPointCostsForNonParamTypes
 *  (:615-621), which is indexed by TYPE and ignores the stored param
 *  entirely. Four of them mint at ClassicParam -1, so ignoring the
 *  param and reading the single cost are the same thing. THE FIFTH IS
 *  NOT: EnhancesSkill mints one flat cost across all thirty-five
 *  skills, and its stored param is a real skill id - so reading it at
 *  -1 answers null and the item prices at ZERO. (%it of Venom
 *  Spitting is exactly that item: one EnhancesSkill slot at param 7,
 *  and it was the one record in MAGIC.DEF this scored free.) Reading
 *  each at the FIRST param it mints is the one lookup that is right
 *  for all five, because a flat cost is flat.
 *
 *  DFU's array also holds live-looking values in slots 1-4 that this
 *  arm can never reach - the switch routes those types elsewhere - so
 *  a wholesale transcription of it would be five sixths dead weight
 *  and one sixth a trap. */
const NO_PARAM_VALUE_TYPES = new Set([
  ENCHANTMENT_TYPES.RepairsObjects, ENCHANTMENT_TYPES.AbsorbsSpells,
  ENCHANTMENT_TYPES.EnhancesSkill, ENCHANTMENT_TYPES.FeatherWeight,
  ENCHANTMENT_TYPES.StrengthensArmor,
]);
const CAST_WHEN_TYPES = new Set([
  ENCHANTMENT_TYPES.CastWhenUsed, ENCHANTMENT_TYPES.CastWhenHeld,
  ENCHANTMENT_TYPES.CastWhenStrikes,
]);
const TYPE_NAME = Object.freeze(Object.entries(ENCHANTMENT_TYPES)
  .reduce((a, [k, v]) => { a[v] = k; return a; }, {}));

/** GetSpellEnchantPtCost (:2387-2402): ten times the classic casting
 *  cost of the SPELLS.STD record with that index, at the enchanting
 *  skill of 50. A spell the reader cannot find scores ZERO there -
 *  the loop simply never matches - so an absent SPELLS.STD makes the
 *  cast-when arms free rather than throwing. */
export const spellEnchantPtCost = (spell) => (spell ? 10 * classicCastingCost(spell) : 0);

/**
 * The value ItemBuilder writes onto a freshly minted legacy magic
 * item. Hooks, because the two lookups it needs are host data:
 *   spellOfIndex(index) -> a SPELLS.STD record, or null
 *   soulPointsOf(mobileType) -> SoulPts (defaults to the enemy table)
 */
export function legacyEnchantmentValue(enchantments, { spellOfIndex = null, soulPointsOf = null } = {}) {
  let value = 0;
  for (const e of enchantments ?? []) {
    if (!e || e.type === ENCHANTMENT_TYPES.None) continue;
    if (!(e.type < VALUE_COUNTS_BELOW)) continue;
    if (CAST_WHEN_TYPES.has(e.type)) {
      value += spellEnchantPtCost(spellOfIndex ? spellOfIndex(e.param) : null);
    } else if (e.type === ENCHANTMENT_TYPES.SoulBound) {
      value += soulPointsOf ? (soulPointsOf(e.param) ?? 0) : (ENEMY_BASICS[e.param]?.soulPts ?? 0);
    } else {
      const name = TYPE_NAME[e.type];
      const param = NO_PARAM_VALUE_TYPES.has(e.type) ? defaultParam(name) : e.param;
      value += enchantmentCost(name, param) ?? 0;
    }
  }
  return value;
}

// ---- E2: the HOST ctx and the effects doors -------------------------
// A host mounts ONE enchantCtx for its session (setDefaultEnchantCtx -
// the port-singleton idiom; DFU's arms read GameManager singletons the
// same way) and every dispatch below folds it UNDER any per-call ctx.
// The cast doors (applySpell, the pin sweep) are REGISTERED by
// effects.js at its module tail - effects.js imports this leaf for the
// absorption fold, so the coupling must run upward as a registration,
// the setEnchantmentHooks shape exactly. A consumer that never imports
// effects.js gets idle cast arms, the headless charter.
let _defaultCtx = null;
export function setDefaultEnchantCtx(ctx) { _defaultCtx = ctx; }
const mergeCtx = (ctx) => (ctx && _defaultCtx ? { ..._defaultCtx, ...ctx } : ctx ?? _defaultCtx);
const _fx = { applySpell: null, removeItemPinnedEffects: null };
export function setEnchantmentEffectDoors(doors) { Object.assign(_fx, doors); }

/** rerollMinimumHours (EntityEffectManager.cs:42): a held bundle's
 *  effects re-roll once the item has been worn this many classic
 *  hours since the last roll. */
export const REROLL_MINIMUM_HOURS = 6;
const MINUTES_PER_HOUR = 60;

/** InstantiateSpellBundle (CastWhenHeld.cs:~145-186): the classic
 *  record lands on the WEARER as a HeldMagicItem bundle - pinned to
 *  the item, BypassSavingThrows, caster the wearer itself. On a first
 *  equip (not a recast/reroll) the item pays the spell's CLASSIC
 *  casting cost in condition - at the PLAYER's live skills in DFU
 *  (CalculateCastingCost(spell, false) reads PlayerEntity; the port
 *  reads the WEARER, identical for the only entity that equips).
 *  Either way the equip stamps timeEffectsLastRerolled. */
export function assignHeldSpell(record, entity, item, { ctx = null, nowMinutes = 0, recast = false } = {}) {
  ctx = mergeCtx(ctx);
  _fx.removeItemPinnedEffects?.(entity, item);   // RerollItemEffects' remove-first half; idempotent on first equip
  _fx.applySpell?.(record, entity.level ?? 1, entity, ctx?.sinks ?? {}, ctx?.rolls ?? Math.random, { entity }, { bypassSavingThrows: true, heldItem: item });
  if (!recast) {
    const skillOf = ctx?.castingSkillOf ?? ((sk) => skillValue(entity, sk));
    enchantLowerCondition(item, classicCastingCost(record, skillOf), entity, ctx);
  }
  item.timeEffectsLastRerolled = nowMinutes;
}

/** UnequipHeldItem's bundle half, exported for hosts/probes - the
 *  dispatcher's Unequipped arm runs it itself. */
export function removeHeldSpell(entity, item) { _fx.removeItemPinnedEffects?.(entity, item); }

function instantiateHeldSpell({ param, entity, item, ctx, nowMinutes }, recast) {
  const record = ctx?.spellsByIndex?.()?.get?.(param);
  if (!record) return;
  (ctx?.assignHeldSpell ?? assignHeldSpell)(record, entity, item, { ctx, nowMinutes, recast });
}

/** Every DFU enchantment-payload durability site bills through
 *  LowerCondition(amount, entity, entity.Items) - and LowerCondition's
 *  collection arm REMOVES a broken item from that collection unless
 *  the AllowMagicRepairs setting holds (DaggerfallUnityItem.cs:
 *  LowerCondition). Combat wear passes no collection and keeps the
 *  husk; enchantment wear consumes it. */
function enchantLowerCondition(item, amount, entity, ctx, collection = null) {
  const broke = lowerCondition(item, amount, entity, ctx?.say);
  if (broke && !(ctx?.allowMagicRepairs ?? false)) {
    const col = collection ?? entity?.items;
    const i = col ? col.indexOf(item) : -1;
    if (i >= 0) col.splice(i, 1);
  }
  return broke;
}

// ---- the affinity classifier (PotentVs/LowDamageVs/the nearby arms) --
// MobileEnemy.Affinity off the generated basics table; class enemies
// (128+) are Human in DFU's table.
const AFFINITY_PARAM = Object.freeze({ Undead: 0, Daedra: 1, Humanoid: 2, Animals: 3 });
export function mobileAffinityMatches(mobileType, paramType) {
  const affinity = mobileType >= 128 ? 'Human' : (ENEMY_BASICS[mobileType]?.affinity ?? 'None');
  return (paramType === AFFINITY_PARAM.Undead && affinity === 'Undead')
    || (paramType === AFFINITY_PARAM.Daedra && affinity === 'Daedra')
    || (paramType === AFFINITY_PARAM.Humanoid && affinity === 'Human')
    || (paramType === AFFINITY_PARAM.Animals && affinity === 'Animal');
}

// ---- the payload registry -------------------------------------------
// One row per classic type: the payload flags VERBATIM from each
// class's SetProperties, and the arms. An arm returns
// PayloadCallbackResults ({ strikesModulateDamage, durabilityLoss }) or
// nothing, exactly the C# contract.

const T = ENCHANTMENT_TYPES;

const REGISTRY = new Map([
  /** CastWhenUsed.cs - Used: a broken item answers durability loss
   *  alone (:its condition gate); else the classic spell fires -
   *  CasterOnly assigns to the USER bypassing saves and chance, every
   *  other target type becomes the READIED spell cast for free. E2
   *  wires the cast seams. */
  [T.CastWhenUsed, {
    flags: PAYLOAD.Used,
    used({ param, entity, item, ctx }) {
      if (item && (item.currentCondition ?? 1) <= 0) return { durabilityLoss: DURABILITY_LOSS_ON_USE };
      const record = ctx?.spellsByIndex?.()?.get?.(param);
      if (record) {
        if (record.rangeType === 0) ctx?.applySpellToSelf?.(record, entity, item);
        else ctx?.setReadySpell?.(record, item);
      }
      return { durabilityLoss: DURABILITY_LOSS_ON_USE };
    },
  }],
  /** CastWhenHeld.cs - Equipped assigns the held bundle (E2:
   *  instantiateHeldSpell - the spell rides target.activeEffects
   *  pinned to the item; the dispatcher's Unequipped arm strips it);
   *  RerollEffect recasts it fresh with no durability hit; MagicRound
   *  degrades 1 per 4 rounds (60 while resting) - the magic-item wear
   *  law that makes a Cast-When-Held ring die of use. */
  [T.CastWhenHeld, {
    flags: PAYLOAD.Equipped | PAYLOAD.MagicRound | PAYLOAD.RerollEffect,
    equipped(env) { instantiateHeldSpell(env, false); },
    reroll(env) { instantiateHeldSpell(env, true); },
    magicRound({ round, entity, item, ctx }) {
      // AUDIT 26 F126: the MagicRound item payload is dispatched only
      // for items in activeMagicItemsInRound, and that map is filled
      // solely under `if (IsPlayerEntity)`
      // (EntityEffectManager.cs:1744-1755) - so an ENEMY's
      // Cast-When-Held item never takes the wear, and is looted at
      // its remaining condition rather than degrading and breaking.
      // (The bundle-driven rounds - RegensHealth, ItemDeteriorates,
      // HealthLeech idle - DO run for any entity and stay ungated.)
      if (!entity?.isPlayer) return;
      const rate = ctx?.isResting?.() ? HELD_DEGRADE_RATE_RESTING : HELD_DEGRADE_RATE;
      if (round % rate === 0) enchantLowerCondition(item, 1, entity, ctx);
    },
  }],
  /** CastWhenStrikes.cs - Strikes: no target or zero damage = nothing
   *  (:its guard); else the spell lands on the TARGET with saves
   *  rolled (AssignBundleFlags.ShowNonPlayerFailures - NOT bypassed),
   *  and the weapon pays 10 condition. */
  [T.CastWhenStrikes, {
    flags: PAYLOAD.Strikes,
    strikes({ param, entity, target, damage, ctx }) {
      if (!target || damage === 0) return null;
      const record = ctx?.spellsByIndex?.()?.get?.(param);
      if (record) ctx?.applySpellToTarget?.(record, entity, target);
      return { durabilityLoss: DURABILITY_LOSS_ON_STRIKE };
    },
  }],
  /** ExtraSpellPts.cs - Held constant: +75 max magicka while the
   *  condition holds. Params 0-3 seasons, 4-6 moons (V2c: the host's
   *  moonPhase(param) answers off gameDate's lunar law), 7-10 near
   *  undead/daedra/humanoids/animals inside 18 units. */
  [T.ExtraSpellPts, {
    flags: PAYLOAD.Held,
    constant({ param, ctx, mods }) {
      let apply = false;
      if (param < 4) apply = ctx?.season?.() === param;   // DuringWinter=0..DuringFall=3, the DFU season order the caller supplies
      else if (param <= 6) apply = ctx?.moonPhase?.(param) ?? false;
      else apply = anyNearbyOfAffinity(ctx, param - 7, EXTRA_SPELL_PTS_NEARBY_RADIUS);
      if (apply) mods.maxMagicka += EXTRA_SPELL_PTS_MAX_INCREASE;
    },
  }],
  /** PotentVs.cs - Strikes: +5 damage against the matching affinity. */
  [T.PotentVs, {
    flags: PAYLOAD.Strikes,
    strikes({ param, target }) {
      if (target?.mobileType == null) return null;
      return mobileAffinityMatches(target.mobileType, param) ? { strikesModulateDamage: POTENT_VS_DAMAGE } : null;
    },
  }],
  /** RegensHealth.cs - MagicRound: +1 every 4 rounds while the
   *  condition holds (AllTheTime / InDarkness / InSunlight). */
  [T.RegensHealth, {
    flags: PAYLOAD.Held,   // RegensHealth.cs:34 - the round tick is its held bundle's
    magicRound({ param, round, entity, ctx }) {
      if (round % REGEN_PER_ROUNDS !== 0) return;
      const regen = param === 0
        || (param === 2 && (ctx?.inDarkness?.() ?? false))
        || (param === 1 && (ctx?.inSunlight?.() ?? false));
      if (regen && entity.health < entity.maxHealth) entity.health = Math.min(entity.maxHealth, entity.health + 1);
    },
  }],
  /** VampiricEffect.cs - two params. AtRange (0): every 4 rounds drain
   *  1 health from EVERY foe inside 2.25 (melee reach, the class's own
   *  comment) into the wearer - through the pool's hurt sink, which is
   *  the port's spelling of the CurrentHealth setter's death event.
   *  WhenStrikes (1): the wearer heals the damage dealt. */
  [T.VampiricEffect, {
    flags: PAYLOAD.Held | PAYLOAD.Strikes,
    magicRound({ param, round, entity, ctx }) {
      if (param !== 0 || round % REGEN_PER_ROUNDS !== 0) return;
      const nearby = ctx?.nearbyFoes?.(VAMPIRIC_DRAIN_RANGE) ?? [];
      for (const foe of nearby) {
        foe.hurt?.(1);
        entity.health = Math.min(entity.maxHealth, entity.health + 1);
      }
    },
    strikes({ param, entity, damage }) {
      if (param !== 1) return null;
      entity.health = Math.min(entity.maxHealth, entity.health + damage);
      return null;
    },
  }],
  /** IncreasedWeightAllowance.cs - Held constant: +25%/+50% carry. */
  [T.IncreasedWeightAllowance, {
    flags: PAYLOAD.Held,
    constant({ param, mods }) { mods.weightAllowanceMult = Math.max(mods.weightAllowanceMult, param === 1 ? 0.5 : 0.25); },
  }],
  /** RepairsObjects.cs - MagicRound, player only: every 4 rounds +1
   *  condition on the FIRST damaged item found, skipping enchanted
   *  items unless the AllowMagicRepairs setting says otherwise; one
   *  item per tick (the C# returns inside the loop). */
  [T.RepairsObjects, {
    flags: PAYLOAD.Held,   // RepairsObjects.cs:35
    magicRound({ round, entity, ctx }) {
      if (!entity.isPlayer || round % CONDITION_PER_ROUNDS !== 0) return;
      for (const it of entity.items ?? []) {
        if (it && it.currentCondition != null && it.maxCondition != null && it.currentCondition < it.maxCondition) {
          if (isEnchantedItem(it) && !(ctx?.allowMagicRepairs ?? false)) continue;
          it.currentCondition += 1;
          return;
        }
      }
    },
  }],
  /** AbsorbsSpells.cs - Held constant: IsAbsorbingSpells. */
  [T.AbsorbsSpells, {
    flags: PAYLOAD.Held,
    constant({ mods }) { mods.absorbsSpells = true; },
  }],
  /** EnhancesSkill.cs - Held constant: SetSkillMod(param, 15). */
  [T.EnhancesSkill, {
    flags: PAYLOAD.Held,
    constant({ param, mods }) { mods.skillMods[param] = (mods.skillMods[param] ?? 0) + ENHANCE_SKILL_MOD; },
  }],
  /** FeatherWeight/ExtraWeight - Enchanted-only payloads: the weight
   *  write fires at the ITEM MAKER alone, so a looted magic item's
   *  weight is untouched, verbatim (the flag never fires on a mint). */
  [T.FeatherWeight, { flags: PAYLOAD.Enchanted, enchanted({ item }) { item.weightInKg = 0.25; } }],
  [T.ExtraWeight, { flags: PAYLOAD.Enchanted, enchanted({ item }) { item.weightInKg = (item.weightInKg ?? 0) * 4; } }],
  /** StrengthensArmor/WeakensArmor - Held constants on the armour
   *  channel (FormulaHelper.cs:1158 adds both to ArmorValues[part]). */
  [T.StrengthensArmor, { flags: PAYLOAD.Held, constant({ mods }) { setIncreasedArmorValueModifier(mods, STRENGTHENS_ARMOR_VALUE); } }],
  [T.WeakensArmor, { flags: PAYLOAD.Held, constant({ mods }) { setDecreasedArmorValueModifier(mods, WEAKENS_ARMOR_VALUE); } }],
  /** ImprovesTalents.cs - Held constant, player only: the three
   *  improved-talent flags. */
  [T.ImprovesTalents, {
    flags: PAYLOAD.Held,
    constant({ param, entity, mods }) {
      if (!entity.isPlayer) return;
      if (param === 0) mods.improvedAcuteHearing = true;
      else if (param === 1) mods.improvedAthleticism = true;
      else if (param === 2) mods.improvedAdrenalineRush = true;
    },
  }],
  /** GoodRepWith/BadRepWith - MagicRound, player only: +-10 into the
   *  reaction-mod array the round CLEARED (DoMagicRound:1710-1714 -
   *  Clear then re-apply, so the mod holds exactly while equipped).
   *  Param 5 (All) hits the five social groups. */
  [T.GoodRepWith, {
    flags: PAYLOAD.Held,   // GoodRepWith.cs:34
    magicRound({ param, entity }) { applyRepMod(entity, param, REP_ADJUSTMENT); },
  }],
  [T.BadRepWith, {
    flags: PAYLOAD.Held,   // BadRepWith.cs:38
    magicRound({ param, entity }) { applyRepMod(entity, param, -REP_ADJUSTMENT); },
  }],
  /** SoulBound.cs - Enchanted consumes the filled trap (item maker,
   *  pends); Breaks releases the soul as a live foe
   *  (CreateFoeSpawner(false, soulType, 1) - B1's spawner seam). */
  [T.SoulBound, {
    flags: PAYLOAD.Enchanted | PAYLOAD.Breaks,
    breaks({ param, ctx }) { if (param >= 0) ctx?.spawnFoe?.(param); },
  }],
  /** ItemDeteriorates.cs - MagicRound: -1 condition every 4 rounds.
   *  Params (:112-117) are AllTheTime = 0, InSunlight = 1,
   *  InHolyPlaces = 2, and only the two CONDITIONAL ones gate the
   *  early return (:87-89) - AllTheTime carries no condition at all,
   *  so it degrades every fourth round wherever the wearer is. The
   *  order is the catalogue's own ('all the time', 'in sunlight',
   *  'in holy places' - enchantmentCatalogue.js:80) and the one the
   *  soul-forced sets speak (Daedroth/FrostDaedra/Ghost/Wraith all
   *  force param 2 = InHolyPlaces). */
  [T.ItemDeteriorates, {
    flags: PAYLOAD.Held,   // ItemDeteriorates.cs:38
    magicRound({ param, round, entity, item, ctx }) {
      if (round % CONDITION_PER_ROUNDS !== 0) return;
      if (param === 1 && !(ctx?.inSunlight?.() ?? false)) return;
      if (param === 2 && !(ctx?.inHolyPlace?.() ?? false)) return;
      enchantLowerCondition(item, 1, entity, ctx);
    },
  }],
  /** UserTakesDamage.cs - MagicRound: -1 health every 4 rounds while
   *  in sunlight / a holy place. Through the damage sink so death
   *  fires, DecreaseHealth's own behaviour. */
  [T.UserTakesDamage, {
    flags: PAYLOAD.Held,   // UserTakesDamage.cs:36
    magicRound({ param, round, ctx }) {
      if (round % DAMAGE_PER_ROUNDS !== 0) return;
      if (param === 0 && !(ctx?.inSunlight?.() ?? false)) return;
      if (param === 1 && !(ctx?.inHolyPlace?.() ?? false)) return;
      ctx?.hurtSelf?.(1);
    },
  }],
  /** LowDamageVs.cs - Strikes: -5 against the matching affinity. */
  [T.LowDamageVs, {
    flags: PAYLOAD.Strikes,
    strikes({ param, target }) {
      if (target?.mobileType == null) return null;
      return mobileAffinityMatches(target.mobileType, param) ? { strikesModulateDamage: LOW_DAMAGE_VS } : null;
    },
  }],
  /** HealthLeech.cs - the stamp fires on Strikes/Used/Enchanted
   *  (:78-79, its first gate, before any param logic). Params
   *  (:132-136) are WheneverUsed = 0, UnlessUsedDaily = 1,
   *  UnlessUsedWeekly = 2 - the catalogue's own order
   *  (enchantmentCatalogue.js:77 'Whenever used' / 'Unless used
   *  daily' / 'Unless used weekly'), and the one DaedraSeducer's
   *  forced set speaks (param 2 = UnlessUsedWeekly).
   *  WheneverUsed (0) bills the wearer 8 on a strike / 16 on a use
   *  (:84-89); UnlessUsedDaily (1) / UnlessUsedWeekly (2) leech 1
   *  health every 4 rounds once the item has gone unused past a day /
   *  a week of classic time (:106-113). */
  [T.HealthLeech, {
    flags: PAYLOAD.Held | PAYLOAD.Used | PAYLOAD.Strikes | PAYLOAD.Enchanted,
    /** The Enchanted stamp (SetEnchantments' created-payload callback,
     *  DaggerfallUnityItem.cs:1298-1299): a freshly made item starts
     *  its day/week clock at the moment of enchanting, not at 0. */
    enchanted({ item, nowMinutes }) { if (item) item.timeHealthLeechLastUsed = nowMinutes ?? 0; },
    used({ param, item, ctx, nowMinutes }) {
      if (item) item.timeHealthLeechLastUsed = nowMinutes ?? 0;
      if (param === 0) ctx?.hurtSelf?.(LEECH_CAST_AMOUNT);
      return null;
    },
    strikes({ param, item, ctx, nowMinutes }) {
      if (item) item.timeHealthLeechLastUsed = nowMinutes ?? 0;
      if (param === 0) ctx?.hurtSelf?.(LEECH_WEAPON_AMOUNT);
      return null;
    },
    magicRound({ param, round, item, ctx, nowMinutes }) {
      if (param !== 1 && param !== 2) return;
      const since = (nowMinutes ?? 0) - (item?.timeHealthLeechLastUsed ?? 0);
      const active = param === 1 ? since > MINUTES_PER_DAY : since > MINUTES_PER_DAY * 7;
      if (active && round % TIME_LEECH_PER_ROUNDS === 0) ctx?.hurtSelf?.(1);
    },
  }],
  /** BadReactionsFrom.cs - Held: the round scans 8 units for the
   *  param's affinity and, while affected, the constant applies -5
   *  armour AND -5 chance-to-hit (the one core writer of the
   *  ChanceToHitModifier channel FormulaHelper.cs:814 reads). The port
   *  folds the scan into the constant - one recompute per round either
   *  way. Param: 0 humanoids, 1 animals, 2 daedra (its own enum order,
   *  distinct from PotentVs'). */
  [T.BadReactionsFrom, {
    flags: PAYLOAD.Held,
    constant({ param, ctx, mods }) {
      const affinity = param === 0 ? AFFINITY_PARAM.Humanoid : param === 1 ? AFFINITY_PARAM.Animals : AFFINITY_PARAM.Daedra;
      if (anyNearbyOfAffinity(ctx, affinity, BAD_REACTIONS_RANGE)) {
        setDecreasedArmorValueModifier(mods, BAD_REACTIONS_ARMOR);
        mods.chanceToHitMod += BAD_REACTIONS_HIT;
      }
    },
  }],
  // VisionProblems (18) / WalkingProblems (19): classic types with NO
  // effect class anywhere in DFU - GetCombinedEnchantmentSettings
  // still emits them and the dispatcher's unknown-key quirk below is
  // what handles them, in DFU exactly as here.
  /** V3 - SpecialArtifactEffect: the nine Effects/Special/* artifact
   *  classes, keyed by the enchantment's PARAM (the artifact subtype
   *  - GetCombinedEnchantmentSettings keys a Special row by it). The
   *  registry row carries the union of their flags; each subtype's
   *  own hooks live in systems/artifactEffects.js, and a subtype with
   *  no class (Volendrung and the rest carry ordinary enchantments
   *  only) idles rather than aborting. The Ring of Namira is NOT
   *  here: DFU fires its callback by hand at CalculateAttackDamage's
   *  tail, and so does the port (the registered player-struck hook,
   *  worldTick's). */
  [T.SpecialArtifactEffect, {
    flags: PAYLOAD.Used | PAYLOAD.Held | PAYLOAD.Strikes | PAYLOAD.MagicRound,
    used: artifactHook('used'),
    strikes: artifactHook('strikes'),
    constant: artifactHook('constant'),
    magicRound: artifactHook('magicRound'),
  }],
]);

function applyRepMod(entity, param, amount) {
  if (!entity.isPlayer) return;
  const mods = (entity.reactionMods ??= new Array(5).fill(0));
  if (param === 5) { for (let g = 0; g < 5; g++) mods[g] += amount; }
  else if (param >= 0 && param < 5) mods[param] += amount;
}

function anyNearbyOfAffinity(ctx, affinityParam, range) {
  const nearby = ctx?.nearbyFoes?.(range);
  if (!nearby) return false;
  return nearby.some((f) => mobileAffinityMatches(f.mobileType, affinityParam));
}

/** DoItemEnchantmentPayloads (EntityEffectManager.cs:962-1035),
 *  verbatim - including THE UNKNOWN-KEY ABORT QUIRK: a settings row
 *  whose effect key the broker cannot resolve does not skip, it
 *  RETURNS damageOut mid-walk (:985-988 `return damageOut` inside the
 *  foreach), so an item carrying VisionProblems before a real
 *  enchantment never runs the real one. Strikes results ACCUMULATE
 *  into the damage (+= :1011) and the total clamps at 0 (:1030-1033);
 *  the Breaks arm still fires on a broken item but MagicRound and
 *  RerollEffect are gated behind currentCondition > 0 (:1018).
 *
 *  env: { entity, target, damage, round, nowMinutes, ctx } - entity is
 *  the item's owner (the source side), target the struck entity for
 *  Strikes. Answers the (possibly modulated) damage; durability losses
 *  land on the item through equip.js's lowerCondition, whose Breaks
 *  edge re-enters here with PAYLOAD.Breaks via the onBreak hook. */
export function doItemEnchantmentPayloads(flags, item, { entity = null, target = null, damage = 0, round = 0, nowMinutes = null, ctx = null, collection = null } = {}) {
  let damageOut = damage;
  ctx = mergeCtx(ctx);   // E2: the host's mounted ctx rides under any per-call one
  // AUDIT 39: the mounted classic clock, as doEnchantedPayloads reads
  // it. The stamps written here are read back against the ABSOLUTE
  // minute (HealthLeech's day/week gate), so a caller with no clock of
  // its own must get the host's rather than 0 - the strike site passed
  // a literal 0 and stamped every leech weapon as never used.
  nowMinutes ??= ctx?.now?.() ?? 0;
  const enchantments = itemEnchantments(item);
  if (!enchantments) return damageOut;
  // E2: UnequipHeldItem's bundle sweep (:1074-1084) runs for EVERY
  // effect template, gated only by the flag - so it is one sweep per
  // item here, before the row walk (and before the unknown-key abort
  // can skip it: DFU aborts before its sweep too, but the abort keys
  // - VisionProblems and friends - never pin bundles).
  if (flags & PAYLOAD.Unequipped) _fx.removeItemPinnedEffects?.(entity, item);
  for (const e of enchantments) {
    const row = REGISTRY.get(e.type);
    if (!row) {
      // the unknown-key abort (:985-988) - VisionProblems,
      // WalkingProblems and the artifact subtypes land here until
      // their classes exist, exactly as DFU logs-and-returns
      return Math.max(0, damageOut);
    }
    const env = { param: e.param, entity, target, item, damage, round, nowMinutes, ctx, collection };
    if ((flags & PAYLOAD.Equipped) && (row.flags & PAYLOAD.Equipped)) row.equipped?.(env);
    // Unequipped runs UNGATED by the row's own flags (:1001-1003 -
    // UnequipHeldItem is called for every effect template)
    if (flags & PAYLOAD.Unequipped) row.unequipped?.(env);
    if ((flags & PAYLOAD.Used) && (row.flags & PAYLOAD.Used)) applyResults(row.used?.(env), env);
    if ((flags & PAYLOAD.Strikes) && (row.flags & PAYLOAD.Strikes)) {
      const r = row.strikes?.(env);
      if (r?.strikesModulateDamage) damageOut += r.strikesModulateDamage;
      applyResults(r, env);
    }
    if ((flags & PAYLOAD.Breaks) && (row.flags & PAYLOAD.Breaks)) row.breaks?.(env);
    if ((item.currentCondition ?? 1) > 0) {
      // TWO MECHANISMS share the round: a HELD row's MagicRound() is
      // its live bundle's per-round tick (RegensHealth, HealthLeech,
      // ItemDeteriorates... - EntityEffectManager's bundle walk), and
      // a row carrying the PAYLOAD.MagicRound BIT gets the payload
      // callback :1762-1769 fires per active magic item
      // (CastWhenHeld's degrade) - both are DFU's, and the ticked
      // bundle is :1730-1731's `fromEquippedItem != null`. The
      // port's pump walks equipped items once per round, so ONE gate
      // admits both - the flags stay verbatim per class.
      if ((flags & PAYLOAD.MagicRound) && (row.flags & (PAYLOAD.MagicRound | PAYLOAD.Held))) row.magicRound?.(env);
      if ((flags & PAYLOAD.RerollEffect) && (row.flags & PAYLOAD.RerollEffect)) row.reroll?.(env);   // E2: RerollItemEffects' payload (:2026)
      if ((flags & PAYLOAD.Enchanted) && (row.flags & PAYLOAD.Enchanted)) row.enchanted?.(env);
    }
  }
  return Math.max(0, damageOut);
}

/** SetEnchantments' CREATED-PAYLOAD callback (DaggerfallUnityItem.cs
 *  :1289-1300): as the item maker builds the enchantment lists it
 *  fires EnchantmentPayloadCallback(Enchanted, param, null, null,
 *  this) for every settings row whose effect template carries the
 *  flag. This is NOT DoItemEnchantmentPayloads and must not be
 *  routed through it: SetEnchantments' loop SKIPS a row whose effect
 *  key the broker cannot resolve (`if (effectTemplate != null)`,
 *  :1290) instead of aborting the walk, so the unknown-key quirk
 *  above never reaches the maker. `enchantments` is the settings list
 *  being applied, which the item does not carry yet at the DFU call
 *  site - hence the separate argument. */
export function doEnchantedPayloads(item, enchantments, { entity = null, ctx = null, nowMinutes = null, collection = null } = {}) {
  ctx = mergeCtx(ctx);
  nowMinutes ??= ctx?.now?.() ?? 0;   // E2: the mounted classic-minute clock, as restartHeldEnchantments reads it
  for (const e of enchantments ?? []) {
    // GetEffectTemplate(settings.EffectKey) (:1289) - the row is
    // found by KEY here, so a maker settings list resolves before
    // SetEnchantments has stored anything numeric.
    const row = REGISTRY.get(classicEnchantmentType(e.type));
    if (!row || !(row.flags & PAYLOAD.Enchanted)) continue;
    row.enchanted?.({ param: e.param, entity, target: null, item, damage: 0, round: 0, nowMinutes, ctx, collection });
  }
}

/** UseItem's result contract (:1088-1101): removeItem wins over
 *  durability (`else if`); a durability loss bills through the
 *  collection so a break consumes the item (enchantLowerCondition). */
function applyResults(r, env) {
  if (!r) return;
  if (r.removeItem) {
    const col = env.collection ?? env.entity?.items;
    const i = col ? col.indexOf(env.item) : -1;
    if (i >= 0) col.splice(i, 1);
  } else if (r.durabilityLoss) {
    enchantLowerCondition(env.item, r.durabilityLoss, env.entity, env.ctx, env.collection);
  }
}

/** The constant-effect FOLD (DoConstantEffects at the round cadence):
 *  recompute entity._enchantMods from every EQUIPPED enchanted item.
 *  Channels and their DFU homes:
 *    maxMagicka          - ChangeMaxMagickaModifier (ExtraSpellPts)
 *    increasedArmorMod   - SetIncreasedArmorValueModifier
 *    decreasedArmorMod     (StrengthensArmor / WeakensArmor,
 *                          BadReactionsFrom) - two MIN-SET channels,
 *                          NOT one additive one; see F122/F123 above
 *    chanceToHitMod      - ChangeChanceToHitModifier (BadReactionsFrom)
 *    absorbsSpells       - IsAbsorbingSpells (AbsorbsSpells)
 *    weightAllowanceMult - SetIncreasedWeightAllowanceMultiplier
 *    skillMods           - SetSkillMod (EnhancesSkill)
 *    improved*           - the ImprovesTalents trio
 *  DFU clamps current magicka to the recomputed max after the pass
 *  (:1700-1702) - the caller owning the magicka pool applies
 *  liveMaxMagicka below and clamps the same way. */
export function computeEnchantmentMods(entity, ctx = null) {
  ctx = mergeCtx(ctx);
  const mods = {
    maxMagicka: 0, increasedArmorMod: 0, decreasedArmorMod: 0, chanceToHitMod: 0, absorbsSpells: false,
    weightAllowanceMult: 0, skillMods: {},
    improvedAcuteHearing: false, improvedAthleticism: false, improvedAdrenalineRush: false,
  };
  for (const item of equippedEnchantedItems(entity)) {
    for (const e of itemEnchantments(item)) {
      const row = REGISTRY.get(e.type);
      if (!row) break;   // the same unknown-key abort, per item
      if (row.flags & PAYLOAD.Held) row.constant?.({ param: e.param, entity, item, ctx, mods });
    }
  }
  entity._enchantMods = mods;
  // ChangeMaxMagickaModifier's channel IS the live accessor's own
  // (defineLiveMaxMagicka reads `maxMagickaModifier` - wave 28's
  // accessor, floored at 0): the fold is its one writer, so the
  // eleven `entity.maxMagicka` property reads across four hosts get
  // ExtraSpellPts for free. DFU clamps current magicka to the new max
  // after the pass (:1700-1702).
  entity.maxMagickaModifier = mods.maxMagicka;
  if ((entity.magicka ?? 0) > (entity.maxMagicka ?? 0) && typeof entity.maxMagicka === 'number') entity.magicka = entity.maxMagicka;
  return mods;
}

/** The per-round pump (DoMagicRound:1706-1770): clear the reaction
 *  mods, recompute the constant fold, then the MagicRound payloads for
 *  every equipped enchanted item (activeMagicItemsInRound). Call once
 *  per magic round for any entity that wears items - effects.js's
 *  runMagicRoundsFor owns the call, so every host gets it. */
export function enchantmentMagicRound(entity, round, { nowMinutes = 0, ctx = null } = {}) {
  ctx = mergeCtx(ctx);
  if (entity.isPlayer) (entity.reactionMods ??= new Array(5).fill(0)).fill(0);   // ClearReactionMods (:1713)
  const items = equippedEnchantedItems(entity);
  if (!items.length) { entity._enchantMods = null; return; }
  computeEnchantmentMods(entity, ctx);
  for (const item of items) {
    doItemEnchantmentPayloads(PAYLOAD.MagicRound, item, { entity, round, nowMinutes, ctx });
  }
  // E2: the REROLL scheduler (DoMagicRound :1745-1753 collects, player
  // only, per held item with a live pinned bundle; RerollItemEffects
  // :2001-2034 then strips those bundles and fires the RerollEffect
  // payload if the item is still equipped, restamping the clock). The
  // strip half lives in each row's recast (assignHeldSpell removes
  // before it re-applies), so the port fires the payload directly.
  if (entity.isPlayer && entity.activeEffects?.length) {
    for (const item of items) {
      if (!entity.activeEffects.some((a) => a.heldItem === item)) continue;
      const hours = Math.floor((nowMinutes - (item.timeEffectsLastRerolled ?? nowMinutes)) / MINUTES_PER_HOUR);
      if (hours < REROLL_MINIMUM_HOURS || item.equipSlot == null) continue;
      doItemEnchantmentPayloads(PAYLOAD.RerollEffect, item, { entity, round, nowMinutes, ctx });
      item.timeEffectsLastRerolled = nowMinutes;
    }
  }
}

/** E2: the RESTORE half of the held bundles. DFU serializes each
 *  HeldMagicItem bundle with its item's UID and re-links on load
 *  (:2240/:2307), discarding one whose item cannot resolve (:2312).
 *  The port's save strips pinned entries instead (they carry a live
 *  item reference) and this re-instantiates them from the worn set -
 *  a RECAST, so no durability is billed; the reroll stamp resets to
 *  the load minute (recorded phase drift, the Ledger A class). */
export function restartHeldEnchantments(entity, ctx = null) {
  ctx = mergeCtx(ctx);
  const nowMinutes = ctx?.now?.() ?? 0;
  for (const item of equippedEnchantedItems(entity)) {
    for (const e of itemEnchantments(item)) {
      const row = REGISTRY.get(e.type);
      if (!row) break;   // the unknown-key abort, per item
      if (e.type === T.CastWhenHeld) instantiateHeldSpell({ param: e.param, entity, item, ctx, nowMinutes }, true);
    }
  }
}

function equippedEnchantedItems(entity) {
  const out = [];
  const slots = entity?.equip ? equipTableOf(entity) : null;
  if (slots) {
    for (const it of slots) if (it && isEnchantedItem(it)) out.push(it);
  } else {
    for (const it of entity?.items ?? []) if (it?.equipSlot != null && isEnchantedItem(it)) out.push(it);
  }
  return out;
}

/** The read-time consumers - each answers 0/false with no fold
 *  computed yet, so a host that never pumps stays exactly pre-E1. */
export const enchantChanceToHitMod = (entity) => entity?._enchantMods?.chanceToHitMod ?? 0;
/** The COMBAT read: FormulaHelper.cs:1158 adds BOTH channels to the
 *  struck part's armour value. */
export const enchantArmorMod = (entity) =>
  (entity?._enchantMods?.increasedArmorMod ?? 0) + (entity?._enchantMods?.decreasedArmorMod ?? 0);
/** The DISPLAY read: RefreshArmourValues (PaperDoll.cs:161) shows
 *  `Decreased - Increased` instead - the paperdoll's armour numbers
 *  run the other way, so a Strengthens item reads +5 there and -5 in
 *  the hit chance. */
export const enchantArmorDisplayMod = (entity) =>
  (entity?._enchantMods?.decreasedArmorMod ?? 0) - (entity?._enchantMods?.increasedArmorMod ?? 0);
export const enchantSkillMod = (entity, skill) => entity?._enchantMods?.skillMods?.[skill] ?? 0;
/** The ImprovesTalents trio (ImprovesTalents.cs:75-88), which set the
 *  three entity flags DFU clears on every constant pass. F044 wired
 *  the athleticism one to the fatigue law that had been computing it
 *  and throwing it away. */
export const entityImprovedAthleticism = (entity) => entity?._enchantMods?.improvedAthleticism ?? false;
export const entityImprovedAcuteHearing = (entity) => entity?._enchantMods?.improvedAcuteHearing ?? false;
export const entityImprovedAdrenalineRush = (entity) => entity?._enchantMods?.improvedAdrenalineRush ?? false;
export const entityAbsorbsSpells = (entity) => entity?._enchantMods?.absorbsSpells ?? false;
export const enchantWeightAllowanceMult = (entity) => entity?._enchantMods?.weightAllowanceMult ?? 0;
/** For an entity WITHOUT the wave-28 live accessor (foes, fixtures):
 *  the same sum the accessor computes. An accessor-bearing entity
 *  reads its own property and this answers the identical number. */
export const liveMaxMagicka = (entity) => {
  const desc = entity ? Object.getOwnPropertyDescriptor(entity, 'maxMagicka') : null;
  if (desc?.get) return entity.maxMagicka;
  return (entity?.maxMagicka ?? 0) + (entity?._enchantMods?.maxMagicka ?? 0);
};

// The equip leaf's doors (see setEnchantmentHooks there): the fold
// follows the worn set the moment it changes - a default-ctx fold, so
// the season/nearby conditions settle where the host's seams answer
// and at the NEXT pump otherwise - the broken edge fires the Breaks
// payloads (E2: through the merged host ctx, so SoulBound's soul
// release reaches the host's spawnFoe), and the per-item doors fire
// the Equipped|Held / Unequipped payloads.
setEnchantmentHooks({
  onEquipChange: (entity) => { if (entity?._enchantMods || equippedEnchantedItems(entity).length) computeEnchantmentMods(entity); },
  onItemBroken: (item, owner, say) => doItemEnchantmentPayloads(PAYLOAD.Breaks, item, { entity: owner, ctx: { say } }),
  // E2: ItemEquipTable's payload doors - StartEquippedItem fires
  // Equipped|Held on the arriving item (:149 -> :576) and
  // StopEquippedItem fires Unequipped on every leaver (:163/:202/:231
  // -> :586). nowMinutes is the ctx clock seam (ctx.now) - an
  // unmounted host equips at minute 0, the headless charter.
  onItemEquipped: (entity, item) => {
    if (!isEnchantedItem(item)) return;
    doItemEnchantmentPayloads(PAYLOAD.Equipped | PAYLOAD.Held, item, { entity, nowMinutes: mergeCtx(null)?.now?.() ?? 0 });
  },
  onItemUnequipped: (entity, item) => {
    if (!isEnchantedItem(item)) return;
    doItemEnchantmentPayloads(PAYLOAD.Unequipped, item, { entity });
  },
});
