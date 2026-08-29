// V2a - THE LYCANTHROPY CURSE: LycanthropyEffect.cs + MorphSelf.cs
// (MIT, Daggerfall Workshop), the racial override V1's infection ramp
// deploys into. V1 ends at `entity.racialOverridePending`; this module
// consumes it, and from that moment the character IS a lycanthrope:
// the +40/+30 advantages, silver-to-be-hit, the once-a-day change, the
// full-moon forced change, the monthly urge to kill an innocent and
// the shrinking health ceiling that enforces it, the free tagged
// Lycanthropy spell the spellbook has been ready for since U42, and
// the cure that takes it all away.
//
// SHAPE. DFU's curse is an incumbent effect with forcedRounds = 1 for
// ever; the port's is an activeEffects ENTRY (kind 'racialOverride') -
// the same shape V1 gave the infection - so the save envelope carries
// it for free and liveStat/skillValue read its mods through one added
// arm each (SetStatMod/SetSkillMod, re-applied every magic round
// exactly as RacialOverrideEffect's constant pass does). The entry IS
// the CustomSaveData_v1 struct: infectionType, lastKilledInnocent,
// lastCastMorphSelf, wearingHircineRing, isTransformed, with the
// compound race reduced to the name override (the port's race is a
// string, not a template - the one flag the template carried,
// disease immunity, rides infectionAccepted's racial-override refusal
// and diseases' own gate).
//
// CLOCKS. DFU mixes classic minutes (the kill period, the once-a-day
// gate) with REAL seconds (the 120s urge nag, the 4-20s move sound).
// The port folds the real-time pair to the round clock and records
// it: the nag repeats every NOTIFY_ROUNDS game minutes, the move
// sound is V2b's host concern (it needs the audio frame anyway).
//
// THE $CUREWER QUEST went live in V2d (racialQuests.js: StartQuest's
// 30% roll on the 84-day cadence with the no-second-instance check,
// and CureLycanthropy's tombstone sweep); vampirism itself shipped in
// V2b (vampirism.js consumes the pending marker).
//
// THE BEAST-FORM HOST LAWS went live in V4: the inventory and talk
// refusals at every door (the two Internal_Strings lines verbatim),
// SuppressCrime through court.js's one setter, the population
// promote-arm hold, the wereclaws rig (WEAPON11.CIF, silent draw,
// high-pitch swing) and the strain-keyed attack voices at all three
// player-hit sites.
//
// THE TRANSFORMED PAPERDOLL AND HEADS went live in V5 (the art laws
// ride vampirism.js's one switch: WOLF00I0/BOAR00I0 backgrounds with
// the whole-body suppression, WERE01I0/WERE00I0 heads).
//
// LM1 SHIPPED THE LAST MEMBER: the 4-20s real-time move-sound loop
// while transformed (lycanthropeMoveSound below). LycanthropyEffect is
// ported whole.

import {
  LYCANTHROPY_TYPES, INFECTION,
} from './infection.js';
import {
  MINUTES_PER_DAY, DAYS_PER_MONTH, isFullMoonFromMinutes,
} from './gameDate.js';
import { EQUIP_SLOTS, equipTableOf, unequipSlot } from './equip.js';
import { spellRecordOfIndex } from './loot.js';
import { SKILLS } from './skills.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';

/** InitMoveSoundTimer (LycanthropyEffect.cs:586-589): Random.Range(4,
 *  20), the FLOAT overload, so any real value in the band and not an
 *  integer count of seconds. */
export const MOVE_SOUND_MIN_SECONDS = 4;
export const MOVE_SOUND_MAX_SECONDS = 20;
const initMoveSoundTimer = (rolls) =>
  MOVE_SOUND_MIN_SECONDS + rolls() * (MOVE_SOUND_MAX_SECONDS - MOVE_SOUND_MIN_SECONDS);
import { ENCHANTMENT_TYPES } from './enchantments.js';
import { cureAllDiseases } from './effects.js';
import { SOUND } from './soundClips.js';   // V4: the transformed attack voices
import { endLycanthropyQuests } from './racialQuests.js';   // V2d: the cure's $CUREWER tombstone sweep

/** LycanthropyEffect.LycanthropyCurseKey (:33). */
export const LYCANTHROPY_CURSE_KEY = 'Lycanthropy-Curse';
/** PlayerEntity.cs:41-42 - the tags the free curse spells carry. The
 *  spellbook's free-cast and delete-refusal laws have read these
 *  since U42; V2a moves their HOME to the systems layer (the UI file
 *  re-exports) because the PRODUCER lives here now. */
export const LYCANTHROPY_SPELL_TAG = 'lycanthrope';
export const VAMPIRE_SPELL_TAG = 'vampire';

// LycanthropyEffect.cs:36-40, verbatim.
export const NEED_TO_KILL_HEALTH_LIMIT_MINIMUM = 4;
export const NEED_TO_KILL_PERIOD = MINUTES_PER_DAY * DAYS_PER_MONTH;   // one classic month
export const NEED_TO_KILL_HEALTH_LOSS_PER_MINUTE = 24.0 / MINUTES_PER_DAY;
/** The 120-REAL-second nag (:37), folded to the round clock - see the
 *  header's CLOCKS note. */
export const NEED_TO_KILL_NOTIFY_ROUNDS = 30;
/** ApplyLycanthropeAdvantages (:520-537), verbatim. */
export const LYCANTHROPE_STAT_MOD = 40;
export const LYCANTHROPE_SKILL_MOD = 30;
export const LYCANTHROPE_STATS = Object.freeze(['strength', 'agility', 'endurance', 'speed']);
export const LYCANTHROPE_SKILLS = Object.freeze([
  SKILLS.Swimming, SKILLS.Running, SKILLS.Stealth, SKILLS.CriticalStrike,
  SKILLS.Climbing, SKILLS.HandToHand, SKILLS.Jumping,
]);
/** AssignPlayerLycanthropySpell (PlayerEntity.cs:1143-1170): classic
 *  SPELLS.STD record 92, the leading '!' stripped from its name. */
export const LYCANTHROPY_SPELL_ID = 92;
/** ArtifactsSubTypes.Hircine_Ring (ItemEnums.cs:244) under the
 *  SpecialArtifactEffect enchantment type. */
export const HIRCINE_RING_SUBTYPE = 3;
/** The HUD strings (localized keys youDreamOfTheMoon,
 *  youNeedToHuntTheInnocent, canOnlyCastOncePerDay) - literal en
 *  values, the port's standing no-localization departure. */
export const YOU_DREAM_OF_THE_MOON = 'You dream of the moon.';
export const YOU_NEED_TO_HUNT = 'You need to hunt the innocent.';
export const ONCE_PER_DAY = 'You may only cast this spell once per day.';

/** PlayerEffectManager.CureAll at a racial override's Start (:120 /
 *  VampirismEffect.cs:81): every effect of the old life ends - the
 *  diseases through their own end law, the rest generically (the
 *  infection that brought us here is already ended by
 *  deployInfection). ONE home for both curses. */
export function endOldLifeEffects(entity) {
  cureAllDiseases(entity);
  for (const a of entity.activeEffects ?? []) {
    if (a.kind === 'disease' || a.kind === 'poison') continue;   // ended above by their own law
    a.ended = true;
  }
}

/** The live curse entry, or null. */
export const liveLycanthropy = (entity) =>
  (entity?.activeEffects ?? []).find((a) => a.kind === 'racialOverride'
    && a.racial === 'lycanthropy' && !a.ended) ?? null;

/** IsWearingHircineRing (:585-597): either ring slot, an artifact
 *  carrying SpecialArtifactEffect param Hircine_Ring. The port's
 *  artifact items carry their MAGIC.DEF enchantment pairs (S1), so
 *  the test is the enchantment array's. */
export function isWearingHircineRing(entity) {
  const table = equipTableOf(entity);
  for (const slot of [EQUIP_SLOTS.Ring0, EQUIP_SLOTS.Ring1]) {
    const item = table?.[slot];
    if (item?.enchantments?.some((e) => e.type === ENCHANTMENT_TYPES.SpecialArtifactEffect
      && e.param === HIRCINE_RING_SUBTYPE)) return true;
  }
  return false;
}

/**
 * DeployFullBlownLycanthropy (WerewolfInfection.cs:34-42 /
 * WereboarInfection.cs:34-42) + LycanthropyEffect.Start (:112-125):
 * assign the curse, carry the infection type over, cure everything
 * else (PlayerEffectManager.CureAll - the new life starts clean), and
 * grant the free spell. Returns the entry, or null if the entity
 * already carries an override.
 */
export function createLycanthropyCurse(entity, infectionType, { now = 0, rolls = Math.random } = {}) {
  if (!entity || liveLycanthropy(entity) || entity.racialOverride) return null;
  const entry = {
    kind: 'racialOverride',
    racial: 'lycanthropy',
    key: LYCANTHROPY_CURSE_KEY,
    infectionType,
    isTransformed: false,
    lastKilledInnocent: now,     // UpdateSatiation runs in Start
    lastCastMorphSelf: 0,
    wearingHircineRing: false,
    urgeToKillRising: false,
    lastUrgeNotify: 0,
    raceNameOverride: null,
    statMods: {},
    skillMods: {},
    // LM1: InitMoveSoundTimer runs in Start (:67) - at the CURSE, not
    // at the first transform and not on the first frame. So the first
    // howl after a morph is already part-way through its wait rather
    // than a fresh 4-20s from the change, and no frame is burned
    // arming it.
    moveSoundTimer: initMoveSoundTimer(rolls),
  };
  endOldLifeEffects(entity);
  entity.activeEffects = entity.activeEffects || [];
  entity.activeEffects.push(entry);
  // the marker infectionAccepted and the disease gate read - REBUILT
  // from activeEffects on restore (save.js), never persisted itself
  entity.racialOverride = entry;
  delete entity.racialOverridePending;
  grantLycanthropySpell(entity);
  return entry;
}

/** AssignPlayerLycanthropySpell (PlayerEntity.cs:1143-1170): record
 *  92, name stripped of its '!', tagged - the tag is what the
 *  spellbook's free-cast and delete-refusal laws key on, and what the
 *  cure deletes by. A headless run with no SPELLS.STD registry skips
 *  LOUDLY (the spell is missing, not silently different). */
export function grantLycanthropySpell(entity) {
  if ((entity.spells ?? []).some((s) => s.tag === LYCANTHROPY_SPELL_TAG)) return true;
  const record = spellRecordOfIndex(LYCANTHROPY_SPELL_ID);
  if (!record) { console.warn('[lycanthropy] SPELLS.STD 92 unavailable - the free spell is not granted'); return false; }
  const name = String(record.name ?? record.spellName ?? 'Lycanthropy').replace(/^!/, '');
  entity.spells = entity.spells || [];
  entity.spells.push({ ...record, name, tag: LYCANTHROPY_SPELL_TAG, custom: true });
  return true;
}

/**
 * The V1 hand-off: consume a pending racial override. Lycanthropy
 * deploys here; a VAMPIRISM pending is left standing - V2b's, and a
 * standing marker is louder than a half-built vampire.
 */
export function consumeRacialOverridePending(entity, { now = 0 } = {}) {
  const pending = entity?.racialOverridePending;
  if (!pending) return null;
  if (pending.lycanthropy && pending.lycanthropy !== LYCANTHROPY_TYPES.None) {
    return createLycanthropyCurse(entity, pending.lycanthropy, { now });
  }
  return null;
}

/**
 * ConstantEffect + MagicRound (:127-158), folded to the round clock:
 * the ring read, the advantages re-applied, silver-to-be-hit, the
 * full-moon forced change, the urge and its health ceiling. `say` is
 * the HUD line seam; `refreshHead` the portrait's (both optional -
 * the headless charter).
 */
export function lycanthropyMagicRound(entity, { nowMinutes = 0, say = null, refreshHead = null } = {}) {
  const entry = liveLycanthropy(entity);
  if (!entry) return;
  entry.wearingHircineRing = isWearingHircineRing(entity);

  // ApplyLycanthropeAdvantages (:520-537) - re-applied every round,
  // DFU's cleared-then-set mod arrays as the entry's own maps
  entry.statMods = {};
  for (const stat of LYCANTHROPE_STATS) entry.statMods[stat] = LYCANTHROPE_STAT_MOD;
  entry.skillMods = {};
  for (const skill of LYCANTHROPE_SKILLS) entry.skillMods[skill] = LYCANTHROPE_SKILL_MOD;

  // ForceTransformDuringFullMoon (:565-575): either moon full, no
  // Hircine ring, not already changed. BEFORE the constant reads
  // below - DFU's ConstantEffect runs every frame so the frame after
  // a forced change already reads the beast; the port's fold is
  // per-round, so the order inside the round is what keeps silver
  // from lagging the change by a round.
  if (!entry.wearingHircineRing && isFullMoonFromMinutes(nowMinutes) && !entry.isTransformed) {
    say?.(YOU_DREAM_OF_THE_MOON);
    morphSelf(entity, { force: true, nowMinutes, refreshHead });
  }

  // ConstantEffect (:139-144): transformed needs silver to be hit,
  // untransformed iron - and either way immune to disease (the gate
  // reads entity.racialOverride)
  entity.minMetalToHit = entry.isTransformed ? WEAPON_MATERIALS.Silver : WEAPON_MATERIALS.Iron;
  entity.isInBeastForm = entry.isTransformed;

  // GetNeedToKill (:577-580) + the urge arm of ConstantEffect
  // (:146-160): a month without an innocent's blood shrinks the
  // health ceiling by 24/day down to the floor of 4
  const sinceKill = nowMinutes - (entry.lastKilledInnocent ?? 0);
  entry.urgeToKillRising = !entry.wearingHircineRing && sinceKill > NEED_TO_KILL_PERIOD;
  if (entry.urgeToKillRising) {
    if (nowMinutes - (entry.lastUrgeNotify ?? 0) >= NEED_TO_KILL_NOTIFY_ROUNDS) {
      entry.lastUrgeNotify = nowMinutes;
      say?.(YOU_NEED_TO_HUNT);
    }
    const urgeMinutes = sinceKill - NEED_TO_KILL_PERIOD;
    let limit = (entity.maxHealth ?? 0) - Math.round(urgeMinutes * NEED_TO_KILL_HEALTH_LOSS_PER_MINUTE);
    if (limit < NEED_TO_KILL_HEALTH_LIMIT_MINIMUM) limit = NEED_TO_KILL_HEALTH_LIMIT_MINIMUM;
    entity.maxHealthLimiter = limit;
    // DFU clamps through the CurrentMaxHealth property continuously;
    // the port clamps at the fold's own cadence (recorded)
    if ((entity.health ?? 0) > limit) entity.health = limit;
  } else {
    entity.maxHealthLimiter = null;
  }
}

/** SetMaxHealthLimiter's read side: the ceiling every full heal
 *  should respect while the urge is rising. */
export const currentMaxHealth = (entity) =>
  Math.min(entity?.maxHealth ?? 0, entity?.maxHealthLimiter ?? Infinity);

/**
 * MorphSelf (:432-470), verbatim: the once-a-day gate (the Hircine
 * ring bypasses it, and a forced change ignores it), both hands
 * unequipped on the way IN, the compound race's name swap, a full
 * heal to the LIMITED max either way, and the cast stamp. Answers
 * { ok } or { refused } with the classic line.
 */
export function morphSelf(entity, { force = false, nowMinutes = 0, refreshHead = null, say = null } = {}) {
  const entry = liveLycanthropy(entity);
  if (!entry) return { ok: false, refused: 'not a lycanthrope' };
  if (!entry.isTransformed) {
    const canCast = entry.wearingHircineRing
      || nowMinutes - (entry.lastCastMorphSelf ?? 0) > MINUTES_PER_DAY;
    if (!canCast && !force) {
      say?.(ONCE_PER_DAY);
      return { ok: false, refused: ONCE_PER_DAY };
    }
    entry.isTransformed = true;
    unequipSlot(entity, EQUIP_SLOTS.RightHand);
    unequipSlot(entity, EQUIP_SLOTS.LeftHand);
    entry.raceNameOverride = entry.infectionType === LYCANTHROPY_TYPES.Wereboar ? 'Wereboar' : 'Werewolf';
  } else {
    entry.isTransformed = false;
    entry.raceNameOverride = null;
  }
  entity.isInBeastForm = entry.isTransformed;
  entity.health = currentMaxHealth(entity);
  entry.lastCastMorphSelf = nowMinutes;
  refreshHead?.();
  return { ok: true };
}

/** UpdateSatiation (:407-412): the innocent's blood resets the clock
 *  and the urge. */
export function updateSatiation(entity, nowMinutes = 0) {
  const entry = liveLycanthropy(entity);
  if (!entry) return;
  entry.lastKilledInnocent = nowMinutes;
  entry.lastUrgeNotify = 0;
  entry.urgeToKillRising = false;
  entity.maxHealthLimiter = null;
}

/** KilledInnocent (:249-267): a CIVILIAN, or the city watch
 *  (Knight_CityWatch), dead at the hit. `target` is the port's foe or
 *  person shape; the caller says which family it came from. */
export function killedInnocent(target, { isCivilian = false, mobileType = null } = {}) {
  if (!target) return false;
  const innocent = isCivilian || mobileType === KNIGHT_CITY_WATCH;
  return innocent && (target.health ?? target.hp ?? 0) <= 0;
}

/** OnWeaponHitEntity's satiation half (:229-247) - the VOICE half is
 *  lycanthropeAttackVoice below (V4), played by the host that owns
 *  the audio frame. Call from the player's landed-hit site. */
export function onLycanthropeHit(entity, target, { nowMinutes = 0, isCivilian = false, mobileType = null } = {}) {
  if (!liveLycanthropy(entity)) return;
  if (killedInnocent(target, { isCivilian, mobileType })) updateSatiation(entity, nowMinutes);
}

// ── V4 - THE TRANSFORMED LAWS (the beast-form host slice) ────────

/** The live entry's isTransformed, the gate every law below shares. */
const isTransformedNow = (entity) => !!liveLycanthropy(entity)?.isTransformed;

/** GetSuppressInventory / GetSuppressTalk (:409-437): while
 *  transformed the inventory and every conversation refuse with DFU's
 *  own two lines (Internal_Strings inventoryWhileShapechanged /
 *  youGetNoResponse - read verbatim from the widened sparse clone).
 *  Answers { text }, or null for every mortal and untransformed
 *  lycanthrope - the racialRestBlock shape, so the hosts consume all
 *  three gates one way. */
export const INVENTORY_WHILE_SHAPECHANGED_TEXT = 'You cannot access the inventory while shapechanged...';
export const NO_RESPONSE_TEXT = 'You get no response.';
export function racialSuppressInventory(entity) {
  return isTransformedNow(entity) ? { text: INVENTORY_WHILE_SHAPECHANGED_TEXT } : null;
}
export function racialSuppressTalk(entity) {
  return isTransformedNow(entity) ? { text: NO_RESPONSE_TEXT } : null;
}
/** SuppressCrime (:121-124): a transformed lycanthrope is never
 *  tagged with a crime - the crime-write sites gate on this. */
export const racialSuppressCrime = (entity) => isTransformedNow(entity);
/** SuppressPopulationSpawns (:129-132): PopulationManager's promote
 *  arm holds while transformed (the streets empty out around the
 *  beast; walkers already out keep walking, DFU's own shape). */
export const racialSuppressPopulationSpawns = (entity) => isTransformedNow(entity);

/** OnWeaponHitEntity's voice half (:349-372): a transformed
 *  lycanthrope's landed hit rolls 10% for the attack cry, ELSE 20%
 *  for the bark - two separate Dice100 rolls, strain-keyed clips.
 *  Answers a DAGGER.SND clip id or null; the host that resolved the
 *  hit plays it (it owns the audio frame). */
export function lycanthropeAttackVoice(entity, rolls = Math.random) {
  const entry = liveLycanthropy(entity);
  if (!entry?.isTransformed) return null;
  const boar = entry.infectionType === LYCANTHROPY_TYPES.Wereboar;
  if (Math.floor(rolls() * 100) < 10) return boar ? SOUND.EnemyWereboarAttack : SOUND.EnemyWerewolfAttack;
  if (Math.floor(rolls() * 100) < 20) return boar ? SOUND.EnemyWereboarBark : SOUND.EnemyWerewolfBark;
  return null;
}

/**
 * LM1 - THE TRANSFORMED MOVE SOUND (LycanthropyEffect.cs:201-211,
 * :586-604), the last member of that effect the port had not carried.
 *
 * While transformed - and ONLY while transformed - a real-time timer
 * counts down, and on expiry the beast makes its move noise and the
 * timer re-arms to a fresh `Random.Range(4, 20)` seconds. It is what
 * makes walking around as a werewolf sound like anything at all; the
 * port had the attack voices and the claws and nothing between them.
 *
 * REAL time, not game time: DFU decrements by Time.deltaTime inside
 * ConstantEffect, so a rested night does not queue up howls, and
 * time-scaled travel does not either.
 *
 * The clip goes out through the SCREEN WEAPON's PlayAttackVoice, the
 * same sink the attack voices use - hosts route it to their own
 * one-shot.
 *
 * @param dt seconds since the last frame
 * @returns the clip id to play this frame, or null
 */
export function lycanthropeMoveSound(entity, dt, rolls = Math.random) {
  const entry = liveLycanthropy(entity);
  // The whole block sits inside `if (isTransformed)`: an untransformed
  // lycanthrope does not tick the timer down, so morphing back mid-wait
  // and returning later resumes it rather than restarting.
  if (!entry?.isTransformed) return null;
  // A curse restored from a save written before LM1 carries no timer.
  // Arm it and take this frame as the arming one - the alternative is
  // a NaN countdown that never fires again for that character.
  if (entry.moveSoundTimer == null) { entry.moveSoundTimer = initMoveSoundTimer(rolls); return null; }
  entry.moveSoundTimer -= dt;
  if (entry.moveSoundTimer >= 0) return null;
  entry.moveSoundTimer = initMoveSoundTimer(rolls);
  return entry.infectionType === LYCANTHROPY_TYPES.Wereboar
    ? SOUND.EnemyWereboarMove : SOUND.EnemyWerewolfMove;
}
/** SetFPSWeapon (:332-345): while transformed the screen weapon IS
 *  the wereclaws - WeaponTypes.Werecreature (the port's WEAPON11.CIF
 *  rig, type 16), metal None, NO draw sound, SwingHighPitch swing,
 *  default reach. The rig consults this every worn-weapon sync; the
 *  marker item is what weaponTypeForItem keys the claws animation
 *  set on. */
export const WERECLAWS_ITEM = Object.freeze({ werecreatureClaws: true, material: 0 });
export function racialFpsWeapon(entity) {
  return isTransformedNow(entity) ? WERECLAWS_ITEM : null;
}

/**
 * CureLycanthropy (:475-490): morph back first, a full RAW heal, the
 * curse ends, one minute passes, the tagged spells go, and every
 * $CUREWER instance is tombstoned (V2d - EndLycanthropyQuests, the
 * cure's last line, through the racialQuests host).
 */
export function cureLycanthropy(entity, { nowMinutes = 0, advanceMinutes = null, refreshHead = null } = {}) {
  const entry = liveLycanthropy(entity);
  if (!entry) return false;
  if (entry.isTransformed) morphSelf(entity, { force: true, nowMinutes, refreshHead });
  entry.ended = true;
  entity.racialOverride = null;
  entity.isInBeastForm = false;
  entity.maxHealthLimiter = null;
  entity.minMetalToHit = undefined;
  entity.health = entity.maxHealth ?? entity.health;
  // RaiseTime(60) is SIXTY SECONDS - one classic minute, not an hour;
  // a port that read the 60 as minutes would jump the clock 60x
  advanceMinutes?.(1);
  if (entity.spells) entity.spells = entity.spells.filter((s) => s.tag !== LYCANTHROPY_SPELL_TAG);
  endLycanthropyQuests();
  return true;
}
