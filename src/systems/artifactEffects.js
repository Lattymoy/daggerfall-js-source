// V3 - THE DAEDRIC ARTIFACT PAYLOADS: the nine SpecialArtifactEffect
// classes (Effects/Special/*, MIT, Daggerfall Workshop), the last
// enchantment type the registry answered with the unknown-key abort.
// One registry row (type 26) sub-dispatches by the enchantment's
// param, which IS the artifact subtype (ItemEnums.ArtifactsSubTypes -
// GetCombinedEnchantmentSettings keys a Special effect by it).
//
// WHAT RIDES WHERE. Azura's Star, Sanguine Rose, the Skull and the
// Oghma Infinium are USED payloads (the inventory's Use ladder);
// Mehrunes' Razor, the Wabbajack and the Mace of Molag Bal are
// STRIKES; the Masque of Clavicus and the Mace's decay ride the
// round; the Ring of Namira rides NO payload flag at all - DFU fires
// its callback by hand at CalculateAttackDamage's tail when an enemy
// strikes the PLAYER, so the port does the same through a registered
// hook (setPlayerStruckHook, worldTick registers - the same
// cycle-avoidance as the racial hit hook).
//
// THE HOST DOORS (all optional, the headless charter): messageBox(id)
// for Azura's TEXT.RSC lines, openCharacterSheet() for the Oghma,
// replaceFoe(target, mobileType) for the Wabbajack's transform,
// spawnAlliedFoe(mobileType) for the two summons - FLAGGED: the port
// has no ally/team combat (every foe fights the player), so NO host
// mounts it yet; the summons check their range and speak their fail
// line, and the spawn arm idles until the team system exists.
//
// MACE STATE is an activeEffects entry (kind 'artifact', key
// 'maceOfMolagBal') - the same shape every other persistent modifier
// takes, so the save carries it for free and liveStat reads its
// strength mod through one added arm. RECORDED: DFU also raises the
// attacker's strength MAX (ChangeStatMaxMod); the port's liveStat
// clamps at 100 and has no max-mod channel, so a 100-strength
// character gains nothing - the drain on the TARGET is exact.

import { savingThrow, ELEMENTS, EFFECT_FLAGS } from './spellcast.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { equipTableOf, lowerCondition } from './equip.js';
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';   // the FallExe enum at its V3 home - never through enchantments.js (cycle)
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { liveStat as liveStatOf } from './statMods.js';

/** ItemEnums.ArtifactsSubTypes (:238-262), the payload-bearing nine
 *  named; Hircine_Ring (3) has no effect class - lycanthropy reads it
 *  directly (isWearingHircineRing). */
export const ARTIFACTS = Object.freeze({
  MasqueOfClavicus: 0, MehrunesRazor: 1, MaceOfMolagBal: 2, HircineRing: 3,
  SanguineRose: 4, OghmaInfinium: 5, Wabbajack: 6, RingOfNamira: 7,
  SkullOfCorruption: 8, AzurasStar: 9,
});

/** AzurasStarEffect.cs:24-25 - the two TEXT.RSC records. */
export const SOUL_RELEASED_TEXT_ID = 32;
export const NO_SOUL_TO_RELEASE_TEXT_ID = 20;
/** SanguineRose/SkullOfCorruption enemyRange (:26 in each). */
export const SUMMON_ENEMY_RANGE = 12;
export const SUMMON_DURABILITY_LOSS = 100;
/** DaggerfallCharacterSheetWindow.cs:44 - the Oghma's fixed pool. */
export const OGHMA_BONUS_POOL = 30;
/** MaceOfMolagBalEffect.cs:36 - strikes decay after 12 game minutes. */
export const MACE_MAX_INCREASE_ROUNDS = 12;
/** The localized noMonstersNearby line, as a literal (the standing
 *  no-localization departure). */
export const NO_MONSTERS_NEARBY_TEXT = 'There are no monsters nearby.';

/** WabbajackEffect.careerIDs (:23-41), the seventeen-entry table in
 *  the effect's own order, over the port's ONE mobile-type home. */
const MT = MOBILE_TYPES;
export const WABBAJACK_CAREER_IDS = Object.freeze([
  MT.Rat, MT.Imp, MT.Spriggan, MT.GiantBat, MT.GrizzlyBear, MT.Spider,
  MT.Nymph, MT.Harpy, MT.SkeletalWarrior, MT.Giant, MT.Zombie,
  MT.GiantScorpion, MT.IronAtronach, MT.FleshAtronach, MT.IceAtronach,
  MT.FireAtronach, MT.Lich,
]);

/** The Mace's incumbent state, as the entry every persistent modifier
 *  is: minted on first strike, read by liveStat's 'artifact' arm. */
export function maceState(entity, mint = false) {
  let entry = (entity.activeEffects ?? []).find((a) => a.kind === 'artifact' && a.key === 'maceOfMolagBal' && !a.ended);
  if (!entry && mint) {
    entry = { kind: 'artifact', key: 'maceOfMolagBal', statMods: {}, maxMagickaIncrease: 0, lastStrikeTime: 0 };
    (entity.activeEffects ??= []).push(entry);
  }
  return entry ?? null;
}

/** IsRingOfNamira / isWearingHircineRing's shape: an EQUIPPED item
 *  carrying SpecialArtifactEffect with the given subtype param. */
export function isWearingArtifact(entity, subtype) {
  const slots = equipTableOf(entity);   // the SLOTS dict itself (equip.js:37)
  if (!slots) return false;
  for (const item of Object.values(slots)) {
    if (item && (item.enchantments ?? []).some((e) => e?.type === ENCHANTMENT_TYPES.SpecialArtifactEffect && e.param === subtype)) return true;
  }
  return false;
}
/** DaggerfallEntityBehaviour.cs:240 - with the Star equipped, EVERY
 *  slain enemy MONSTER's soul is taken (fillEmptyTrap azurasStarOnly,
 *  always successful while the Star is empty), no Soul Trap needed.
 *  The two host death sites read this. */
export const isAzurasStarEquipped = (entity) => isWearingArtifact(entity, ARTIFACTS.AzurasStar);

// ── the nine handlers, keyed by subtype ──────────────────────────
const HANDLERS = new Map([

  /** MasqueOfClavicusEffect.cs - Held round: LivePersonality/5 onto
   *  EVERY social group's reaction mod. The mods array is the one
   *  enchantments' fold clears each round (ClearReactionMods), so the
   *  Masque re-applies exactly as DFU's MagicRound does. */
  [ARTIFACTS.MasqueOfClavicus, {
    magicRound({ entity }) {
      const stats = entity?.stats;
      if (!stats) return;
      const amount = Math.trunc(liveStatOf(entity, 'personality') / 5);
      const mods = (entity.reactionMods ??= new Array(5).fill(0));
      for (let g = 0; g < mods.length; g++) mods[g] += amount;
    },
  }],

  /** MehrunesRazorEffect.cs - Strikes: a failed magic save and the
   *  strike deals the target's WHOLE current health on top of the
   *  weapon's own damage, and the Razor pays the same in condition. */
  [ARTIFACTS.MehrunesRazor, {
    strikes({ target, item, rolls = Math.random }) {
      if (!target || !item) return null;
      if (savingThrow(ELEMENTS.Magic, EFFECT_FLAGS.Magic, target, 0, rolls) !== 0) {
        const healthRemoved = target.health ?? 0;
        return { strikesModulateDamage: healthRemoved, durabilityLoss: healthRemoved };
      }
      return null;
    },
  }],

  /** MaceOfMolagBalEffect.cs - Strikes: while the target has spell
   *  points, drain up to the strike's damage into the wielder, any
   *  OVERFLOW above their max raising max itself; a dry target loses
   *  1d6 strength, which the wielder gains. Held round: 12 game
   *  minutes after the last strike, both increases reset. The
   *  constant fold adds the magicka increase into mods.maxMagicka, so
   *  it SUMS with every other producer through V2c's one modifier. */
  [ARTIFACTS.MaceOfMolagBal, {
    constant({ entity, mods }) {
      const st = maceState(entity);
      if (st?.maxMagickaIncrease) mods.maxMagicka += st.maxMagickaIncrease;
    },
    magicRound({ entity, nowMinutes }) {
      const st = maceState(entity);
      if (st && nowMinutes > (st.lastStrikeTime ?? 0) + MACE_MAX_INCREASE_ROUNDS) {
        st.maxMagickaIncrease = 0;
        st.statMods = {};
      }
    },
    strikes({ entity, target, damage, nowMinutes, rolls = Math.random }) {
      if (!entity || !target || damage === 0) return null;
      if (savingThrow(ELEMENTS.Magic, EFFECT_FLAGS.Magic, target, 0, rolls) === 0) return null;
      const st = maceState(entity, true);
      if ((target.magicka ?? 0) > 0) {
        const drained = Math.min(target.magicka, damage);
        target.magicka -= drained;
        const overflow = (entity.magicka ?? 0) + drained - (entity.maxMagicka ?? 0);
        if (overflow > 0) st.maxMagickaIncrease += overflow;
        entity.magicka = (entity.magicka ?? 0) + drained;
      } else {
        // Random.Range(1, 7) - 1d6
        const strengthDrained = 1 + Math.min(5, Math.floor(rolls() * 6));
        drainStrength(target, strengthDrained);
        st.statMods.strength = (st.statMods.strength ?? 0) + strengthDrained;
      }
      st.lastStrikeTime = nowMinutes;
      return { durabilityLoss: damage };
    },
  }],

  /** SanguineRoseEffect.cs - Used: an enemy inside 12 or the fail
   *  line; the summon is an ALLIED Daedroth. FLAGGED: no host mounts
   *  spawnAlliedFoe - the port has no ally/team combat - so the range
   *  gate and the fail line are live and the spawn arm idles. */
  [ARTIFACTS.SanguineRose, {
    used({ ctx }) {
      const nearby = ctx?.nearbyFoes?.(SUMMON_ENEMY_RANGE) ?? [];
      if (!nearby.length) { ctx?.say?.(NO_MONSTERS_NEARBY_TEXT); return null; }
      ctx?.spawnAlliedFoe?.(MT.Daedroth);
      return { durabilityLoss: SUMMON_DURABILITY_LOSS };
    },
  }],

  /** OghmaInfiniumEffect.cs - Used: ReadyToLevelUp + OghmaLevelUp
   *  (advancement's oghma arm: a 30-point pool with NO Level++ and no
   *  health raise), the char sheet opens, and the book is consumed. */
  [ARTIFACTS.OghmaInfinium, {
    used({ entity, ctx }) {
      if (!entity?.isPlayer) return null;
      entity.readyToLevelUp = true;
      entity.oghmaLevelUp = true;
      ctx?.openCharacterSheet?.();
      return { removeItem: true };
    },
  }],

  /** WabbajackEffect.cs - Strikes: reroll the struck enemy into one
   *  of the seventeen careerIDs (never its own type), damage carried
   *  over, once per creature (wabbajackActive). A quest foe still in
   *  use is left alone - the host's replaceFoe door owns that check
   *  and the swap itself. */
  [ARTIFACTS.Wabbajack, {
    strikes({ target, ctx, rolls = Math.random }) {
      if (!target || target.isPlayer) return null;
      if (target.wabbajackActive) return null;
      let newType;
      do {
        newType = WABBAJACK_CAREER_IDS[Math.min(WABBAJACK_CAREER_IDS.length - 1, Math.floor(rolls() * WABBAJACK_CAREER_IDS.length))];
      } while (newType === target.mobileType);
      ctx?.replaceFoe?.(target, newType);
      return null;
    },
  }],

  /** SkullOfCorruptionEffect.cs - Used: the NEAREST enemy inside 12
   *  is cloned as an allied copy; no enemy, the fail line. The same
   *  spawnAlliedFoe FLAG as the Rose. */
  [ARTIFACTS.SkullOfCorruption, {
    used({ ctx }) {
      const nearby = ctx?.nearbyFoes?.(SUMMON_ENEMY_RANGE) ?? [];
      if (!nearby.length) { ctx?.say?.(NO_MONSTERS_NEARBY_TEXT); return null; }
      let nearest = nearby[0];
      for (const n of nearby.slice(1)) {
        if ((n.distance ?? Infinity) < (nearest.distance ?? Infinity)) nearest = n;
      }
      if (nearest.mobileType == null) { ctx?.say?.(NO_MONSTERS_NEARBY_TEXT); return null; }
      ctx?.spawnAlliedFoe?.(nearest.mobileType);
      return { durabilityLoss: SUMMON_DURABILITY_LOSS };
    },
  }],

  /** AzurasStarEffect.cs - Used: release the trapped soul (TEXT 32)
   *  or say there is none (TEXT 20). The HELD half - every slain
   *  monster taken while equipped - lives at the host death sites
   *  through isAzurasStarEquipped above, because the port's kill runs
   *  there (DaggerfallEntityBehaviour.cs:240's arm). */
  [ARTIFACTS.AzurasStar, {
    used({ item, ctx }) {
      if (!item) return null;
      if ((item.trappedSoulType ?? null) !== null) {
        item.trappedSoulType = null;
        ctx?.messageBox?.(SOUL_RELEASED_TEXT_ID);
      } else {
        ctx?.messageBox?.(NO_SOUL_TO_RELEASE_TEXT_ID);
      }
      return null;
    },
  }],
]);

/** DrainTargetStrength (MaceOfMolagBalEffect.cs:214-227): the TARGET
 *  loses strength through the same entry channel. */
function drainStrength(target, amount) {
  let entry = (target.activeEffects ?? []).find((a) => a.kind === 'artifact' && a.key === 'maceOfMolagBalDrain' && !a.ended);
  if (!entry) {
    entry = { kind: 'artifact', key: 'maceOfMolagBalDrain', statMods: {} };
    (target.activeEffects ??= []).push(entry);
  }
  entry.statMods.strength = (entry.statMods.strength ?? 0) - amount;
}

/** The ONE registry row enchantments.js mounts for type 26: flags are
 *  the union; each hook routes by the enchantment param (= subtype)
 *  and an unknown or hookless subtype idles - the remaining artifacts
 *  (Volendrung and the rest) carry ordinary enchantments only. */
export const SPECIAL_ARTIFACT_HANDLERS = HANDLERS;
export function artifactHook(hookName) {
  return (env) => HANDLERS.get(env.param)?.[hookName]?.(env) ?? null;
}

/**
 * The Ring of Namira, dispatched where DFU dispatches it - the tail
 * of CalculateAttackDamage when an ENEMY damages the PLAYER
 * (FormulaHelper.cs:702-719): either ring slot carrying subtype 7
 * reflects the damage back by the attacker's TEAM - the animal teams
 * take nothing, Daedra half, Undead double, everyone else full - and
 * the ring pays the reflection in condition. The reflected damage
 * lands directly on the attacker's health, as DFU's CurrentHealth
 * write does. Registered by worldTick (the racial hit hook's shape).
 */
export function onPlayerStruckByEnemy(attacker, target, damage, { ctx = null } = {}) {
  if (!target?.isPlayer || !attacker || damage <= 0) return;
  const slots = equipTableOf(target);
  if (!slots) return;
  let ring = null;
  for (const item of Object.values(slots)) {
    if (item && (item.enchantments ?? []).some((e) => e?.type === ENCHANTMENT_TYPES.SpecialArtifactEffect && e.param === ARTIFACTS.RingOfNamira)) { ring = item; break; }
  }
  if (!ring) return;
  const team = ENEMY_BASICS[attacker.mobileType]?.team ?? null;
  let reflected;
  switch (team) {
    case 'Vermin': case 'Spriggans': case 'Bears': case 'Tigers':
    case 'Spiders': case 'Scorpions':
      return;
    case 'Daedra': reflected = Math.trunc(damage / 2); break;
    case 'Undead': reflected = damage * 2; break;
    default: reflected = damage; break;
  }
  attacker.health = (attacker.health ?? 0) - reflected;
  lowerCondition(ring, reflected, target, ctx?.say ?? null);
}
