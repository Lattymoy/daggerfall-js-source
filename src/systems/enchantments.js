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
// charter): spellsByIndex(), applySpellToTarget/applySpellToSelf/
// assignHeldSpell/setReadySpell (the cast arms - E2 wires them),
// inSunlight()/inDarkness()/inHolyPlace() (PlayerEnterExit flags -
// FLAGGED: no host computes them yet, so the conditional arms of
// RegensHealth/ItemDeteriorates/UserTakesDamage idle), season(),
// moonPhase() (FLAGGED: lunar phases are a Ledger C row),
// nearbyFoes(range) -> [{ mobileType, hurt(n) }] (PlayerGPS.
// GetNearbyObjects - the affinity classifier lives HERE off
// ENEMY_BASICS), spawnFoe(mobileType) (SoulBound's break, B1's
// spawner), isResting(), allowMagicRepairs (a DFU setting, default
// false), say(msg).

import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { equipTableOf, lowerCondition, setEnchantmentHooks } from './equip.js';
import { MINUTES_PER_DAY } from './gameDate.js';   // the canonical home - worldTick re-exports it and imports the pump below, so this leaf must not close the cycle

/** EnchantmentTypes (ItemsFile.cs:111-141), verbatim. */
export const ENCHANTMENT_TYPES = Object.freeze({
  None: -1,
  CastWhenUsed: 0, CastWhenHeld: 1, CastWhenStrikes: 2, ExtraSpellPts: 3,
  PotentVs: 4, RegensHealth: 5, VampiricEffect: 6, IncreasedWeightAllowance: 7,
  RepairsObjects: 8, AbsorbsSpells: 9, EnhancesSkill: 10, FeatherWeight: 11,
  StrengthensArmor: 12, ImprovesTalents: 13, GoodRepWith: 14, SoulBound: 15,
  ItemDeteriorates: 16, UserTakesDamage: 17, VisionProblems: 18,
  WalkingProblems: 19, LowDamageVs: 20, HealthLeech: 21, BadReactionsFrom: 22,
  ExtraWeight: 23, WeakensArmor: 24, BadRepWith: 25, SpecialArtifactEffect: 26,
});

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
  /** CastWhenHeld.cs - Equipped assigns the held bundle (E2's seam);
   *  MagicRound degrades 1 per 4 rounds (60 while resting) - the
   *  magic-item wear law that makes a Cast-When-Held ring die of use. */
  [T.CastWhenHeld, {
    flags: PAYLOAD.Equipped | PAYLOAD.MagicRound | PAYLOAD.RerollEffect,
    equipped({ param, entity, item, ctx }) {
      const record = ctx?.spellsByIndex?.()?.get?.(param);
      if (record) ctx?.assignHeldSpell?.(record, entity, item);
    },
    unequipped({ entity, item, ctx }) { ctx?.removeHeldSpell?.(entity, item); },
    magicRound({ round, entity, item, ctx }) {
      const rate = ctx?.isResting?.() ? HELD_DEGRADE_RATE_RESTING : HELD_DEGRADE_RATE;
      if (round % rate === 0) lowerCondition(item, 1, entity, ctx?.say);
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
   *  condition holds. Params 0-3 seasons, 4-6 moons (FLAGGED: lunar
   *  phases are a Ledger C row - the moon arms idle), 7-10 near
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
  [T.StrengthensArmor, { flags: PAYLOAD.Held, constant({ mods }) { mods.armorMod += STRENGTHENS_ARMOR_VALUE; } }],
  [T.WeakensArmor, { flags: PAYLOAD.Held, constant({ mods }) { mods.armorMod += WEAKENS_ARMOR_VALUE; } }],
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
  /** ItemDeteriorates.cs - MagicRound: -1 condition every 4 rounds
   *  while in sunlight / a holy place (param 0/1). */
  [T.ItemDeteriorates, {
    flags: PAYLOAD.Held,   // ItemDeteriorates.cs:38
    magicRound({ param, round, entity, item, ctx }) {
      if (round % CONDITION_PER_ROUNDS !== 0) return;
      if (param === 0 && !(ctx?.inSunlight?.() ?? false)) return;
      if (param === 1 && !(ctx?.inHolyPlace?.() ?? false)) return;
      lowerCondition(item, 1, entity, ctx?.say);
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
   *  (:its first gate, before any param logic); WheneverUsed (2)
   *  bills the wearer 8 on a strike / 16 on a use; UnlessUsedDaily(0)
   *  /Weekly(1) leech 1 health every 4 rounds once the item has gone
   *  unused past a day / a week of classic time. */
  [T.HealthLeech, {
    flags: PAYLOAD.Held | PAYLOAD.Used | PAYLOAD.Strikes | PAYLOAD.Enchanted,
    used({ param, item, ctx, nowMinutes }) {
      if (item) item.timeHealthLeechLastUsed = nowMinutes ?? 0;
      if (param === 2) ctx?.hurtSelf?.(LEECH_CAST_AMOUNT);
      return null;
    },
    strikes({ param, item, ctx, nowMinutes }) {
      if (item) item.timeHealthLeechLastUsed = nowMinutes ?? 0;
      if (param === 2) ctx?.hurtSelf?.(LEECH_WEAPON_AMOUNT);
      return null;
    },
    magicRound({ param, round, item, ctx, nowMinutes }) {
      if (param !== 0 && param !== 1) return;
      const since = (nowMinutes ?? 0) - (item?.timeHealthLeechLastUsed ?? 0);
      const active = param === 0 ? since > MINUTES_PER_DAY : since > MINUTES_PER_DAY * 7;
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
        mods.armorMod += BAD_REACTIONS_ARMOR;
        mods.chanceToHitMod += BAD_REACTIONS_HIT;
      }
    },
  }],
  // VisionProblems (18) / WalkingProblems (19): classic types with NO
  // effect class anywhere in DFU - GetCombinedEnchantmentSettings
  // still emits them and the dispatcher's unknown-key quirk below is
  // what handles them, in DFU exactly as here.
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
export function doItemEnchantmentPayloads(flags, item, { entity = null, target = null, damage = 0, round = 0, nowMinutes = 0, ctx = null } = {}) {
  let damageOut = damage;
  const enchantments = itemEnchantments(item);
  if (!enchantments) return damageOut;
  for (const e of enchantments) {
    const row = REGISTRY.get(e.type);
    if (!row) {
      // the unknown-key abort (:985-988) - VisionProblems,
      // WalkingProblems and the artifact subtypes land here until
      // their classes exist, exactly as DFU logs-and-returns
      return Math.max(0, damageOut);
    }
    const env = { param: e.param, entity, target, item, damage, round, nowMinutes, ctx };
    if ((flags & PAYLOAD.Equipped) && (row.flags & PAYLOAD.Equipped)) row.equipped?.(env);
    // Unequipped runs UNGATED by the row's own flags (:1001-1003 -
    // UnequipHeldItem is called for every effect template)
    if (flags & PAYLOAD.Unequipped) row.unequipped?.(env);
    if ((flags & PAYLOAD.Used) && (row.flags & PAYLOAD.Used)) applyResults(row.used?.(env), env);
    if ((flags & PAYLOAD.Strikes) && (row.flags & PAYLOAD.Strikes)) {
      const r = row.strikes?.(env);
      if (r?.strikesModulateDamage) damageOut += r.strikesModulateDamage;
      applyResults(r, env, false);
    }
    if ((flags & PAYLOAD.Breaks) && (row.flags & PAYLOAD.Breaks)) row.breaks?.(env);
    if ((item.currentCondition ?? 1) > 0) {
      // TWO MECHANISMS share the round: a HELD row's MagicRound() is
      // its live bundle's per-round tick (RegensHealth, HealthLeech,
      // ItemDeteriorates... - EntityEffectManager's bundle walk), and
      // a MagicRound-FLAGGED row's is the payload callback :1767
      // fires per active magic item (CastWhenHeld's degrade). The
      // port's pump walks equipped items once per round, so ONE gate
      // admits both - the flags stay verbatim per class.
      if ((flags & PAYLOAD.MagicRound) && (row.flags & (PAYLOAD.MagicRound | PAYLOAD.Held))) row.magicRound?.(env);
      if ((flags & PAYLOAD.Enchanted) && (row.flags & PAYLOAD.Enchanted)) row.enchanted?.(env);
    }
  }
  return Math.max(0, damageOut);
}

function applyResults(r, env, _used = true) {
  if (r?.durabilityLoss) lowerCondition(env.item, r.durabilityLoss, env.entity, env.ctx?.say);
}

/** The constant-effect FOLD (DoConstantEffects at the round cadence):
 *  recompute entity._enchantMods from every EQUIPPED enchanted item.
 *  Channels and their DFU homes:
 *    maxMagicka          - ChangeMaxMagickaModifier (ExtraSpellPts)
 *    armorMod            - Set{Increased,Decreased}ArmorValueModifier
 *                          (Strengthens/WeakensArmor, BadReactionsFrom)
 *    chanceToHitMod      - ChangeChanceToHitModifier (BadReactionsFrom)
 *    absorbsSpells       - IsAbsorbingSpells (AbsorbsSpells)
 *    weightAllowanceMult - SetIncreasedWeightAllowanceMultiplier
 *    skillMods           - SetSkillMod (EnhancesSkill)
 *    improved*           - the ImprovesTalents trio
 *  DFU clamps current magicka to the recomputed max after the pass
 *  (:1700-1702) - the caller owning the magicka pool applies
 *  liveMaxMagicka below and clamps the same way. */
export function computeEnchantmentMods(entity, ctx = null) {
  const mods = {
    maxMagicka: 0, armorMod: 0, chanceToHitMod: 0, absorbsSpells: false,
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
  if (entity.isPlayer) (entity.reactionMods ??= new Array(5).fill(0)).fill(0);   // ClearReactionMods (:1713)
  const items = equippedEnchantedItems(entity);
  if (!items.length) { entity._enchantMods = null; return; }
  computeEnchantmentMods(entity, ctx);
  for (const item of items) {
    doItemEnchantmentPayloads(PAYLOAD.MagicRound, item, { entity, round, nowMinutes, ctx });
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
export const enchantArmorMod = (entity) => entity?._enchantMods?.armorMod ?? 0;
export const enchantSkillMod = (entity, skill) => entity?._enchantMods?.skillMods?.[skill] ?? 0;
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
// follows the worn set the moment it changes - a no-ctx fold, so the
// season/nearby conditions settle at the NEXT pump - and the broken
// edge fires the Breaks payloads. FLAGGED: with no ctx at the break
// edge, SoulBound's soul release idles until E2 threads the hosts'
// enchantCtx through; the fold recompute is ctx-independent for every
// channel but ExtraSpellPts' conditions and BadReactionsFrom's scan.
setEnchantmentHooks({
  onEquipChange: (entity) => { if (entity?._enchantMods || equippedEnchantedItems(entity).length) computeEnchantmentMods(entity); },
  onItemBroken: (item, owner, say) => doItemEnchantmentPayloads(PAYLOAD.Breaks, item, { entity: owner, ctx: { say } }),
});
