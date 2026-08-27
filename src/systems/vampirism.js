// V2b - THE VAMPIRISM CURSE: VampirismEffect.cs (MIT, Daggerfall
// Workshop), the second racial override, consuming the pending marker
// V2a left standing loudly. V1 already did the dying: the fake-death
// video, the fortnight clock raise landing at 19:00, the "death is
// not eternal" popup and the CLAN read from the infection region.
// This module is the un-life that follows: the +20/+30 advantages
// (Anthotis minds add Intelligence), silver-to-be-hit and paralysis
// immunity ALWAYS, the blood - a vampire who has not fed in a day
// cannot rest - the clan's own spells under the 'vampire' tag, the
// no-fast-travel-by-day gate, and the cure that remembers which clan
// you were.
//
// SHAPE: V2a's exactly - the curse is an activeEffects entry (the
// CustomSaveData_v1 struct: clan, lastTimeFed,
// hasStartedInitialVampireQuest), the marker entity.racialOverride is
// rebuilt from it on restore, the advantages ride liveStat/skillValue
// through the same racialOverride arms.
//
// FEEDING IS FIGHTING. OnWeaponHitEntity's whole body is
// UpdateSatiation() - ANY landed player attack is a feed, with none
// of lycanthropy's innocence test. DFU's own design: the vampire
// feeds in combat, the werewolf must hunt the innocent.
//
// FLAGGED, with the slice each waits on:
//  - SUN DAMAGE and HOLY DAMAGE (the compound race's
//    SpecialAbilityFlags): the entry carries sunDamage/holyDamage
//    true, and the fast-travel day gate and the sun-averse arrival
//    clamp read them NOW - but the per-round 12-damage-per-4-rounds
//    law lives in PassiveSpecialsEffect, which needs the
//    IsPlayerInSunlight host seam nobody has built (the same seam
//    enchantments' conditional arms idle on). V2c.
//  - the quests ($CUREVAM, the initial P0A01L00, the clan's guild
//    quest line) - quest-bridge work, beside lycanthropy's $CUREWER
//  - the guild swap (guilds.js carries membershipsFor(store,
//    hasVampirism)), the cemetery respawn, the VAMP00I0.CIF head and
//    SCBG08I0 paperdoll art, the gendered attack voices - host work

import { VAMPIRE_CLANS, LYCANTHROPY_TYPES } from './infection.js';
import { MINUTES_PER_DAY, dateFromClassicMinutes, DAWN_HOUR, DUSK_HOUR } from './gameDate.js';
import { spellRecordOfIndex } from './loot.js';
import { SKILLS } from './skills.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { VAMPIRE_SPELL_TAG, endOldLifeEffects } from './lycanthropy.js';

/** VampirismEffect.VampirismCurseKey (:33). */
export const VAMPIRISM_CURSE_KEY = 'Vampirism-Curse';

/** ApplyVampireAdvantages (:274-297), verbatim: +20 on SEVEN stats -
 *  every stat but Intelligence, which only the Anthotis add - and
 *  +30 on six skills (no Swimming: the dead do not float better). */
export const VAMPIRE_STAT_MOD = 20;
export const VAMPIRE_SKILL_MOD = 30;
export const VAMPIRE_STATS = Object.freeze(['strength', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck']);
export const VAMPIRE_SKILLS = Object.freeze([
  SKILLS.Jumping, SKILLS.Running, SKILLS.Stealth, SKILLS.CriticalStrike,
  SKILLS.Climbing, SKILLS.HandToHand,
]);

/** AssignPlayerVampireSpells (PlayerEntity.cs:1080-1140): three base
 *  spells for every clan, then the clan's own. The records are
 *  SPELLS.STD ids; DFU sets MinimumCastingCost on each - the port's
 *  calculateCastCost floors every spell at CAST_COST_FLOOR already,
 *  so the flag is the standing universal floor rather than a
 *  per-spell bit (recorded). */
export const VAMPIRE_BASE_SPELLS = Object.freeze([4, 90, 91]);   // Levitate, Charm Mortal, Calm Humanoid
export const VAMPIRE_CLAN_SPELLS = Object.freeze({
  [VAMPIRE_CLANS.Vraseth]: [85],            // Nimbleness
  [VAMPIRE_CLANS.Khulari]: [50],            // Paralysis
  [VAMPIRE_CLANS.Montalion]: [94],          // Recall
  [VAMPIRE_CLANS.Thrafey]: [64],            // Heal
  [VAMPIRE_CLANS.Garlythi]: [17],           // Shield
  [VAMPIRE_CLANS.Selenu]: [11, 12, 13],     // Resist Cold/Fire/Shock
  [VAMPIRE_CLANS.Lyrezi]: [23, 6],          // Silence, Invisibility
  [VAMPIRE_CLANS.Haarvenu]: [20, 33],       // Ice Storm, Wildfire
});

/** CheckStartRest's refusal (:143-158): TEXT.RSC 36, "you must feed". */
export const NOT_SATED_TEXT_ID = 36;
/** CheckFastTravel's refusal (:129-141) - the localized key
 *  sunlightDamageFastTravelDay, as a literal (the standing
 *  no-localization departure). */
export const SUNLIGHT_TRAVEL_TEXT = 'You cannot travel during the day, the sunlight would destroy you.';

/** The live curse entry, or null. */
export const liveVampirism = (entity) =>
  (entity?.activeEffects ?? []).find((a) => a.kind === 'racialOverride'
    && a.racial === 'vampirism' && !a.ended) ?? null;

/**
 * The deploy: DeployFullBlownVampirism's tail V1 could not own (the
 * clock raise and popup already ran there) + VampirismEffect.Start
 * (:70-82): the curse entry, the clan carried over, CureAll, the
 * clan's spells. Same refusals as the werewolf's.
 */
export function createVampirismCurse(entity, clan, { now = 0 } = {}) {
  if (!entity || liveVampirism(entity) || entity.racialOverride) return null;
  const entry = {
    kind: 'racialOverride',
    racial: 'vampirism',
    key: VAMPIRISM_CURSE_KEY,
    clan: clan || VAMPIRE_CLANS.Lyrezi,
    lastTimeFed: now,                     // UpdateSatiation runs in Start
    hasStartedInitialVampireQuest: false,
    // CreateCompoundRace (:252-261): name, both immunities, SunDamage
    // + HolyDamage - carried as flags the consumers read (see header)
    raceNameOverride: 'Vampire',
    sunDamage: true,
    holyDamage: true,
    immuneParalysis: true,
    statMods: {},
    skillMods: {},
  };
  endOldLifeEffects(entity);   // CureAll (:81) - the same clean start the werewolf gets
  entity.activeEffects = entity.activeEffects || [];
  entity.activeEffects.push(entry);
  entity.racialOverride = entry;
  delete entity.racialOverridePending;
  grantVampireSpells(entity, entry.clan);
  return entry;
}

/** AssignPlayerVampireSpells, through the same registry the werewolf
 *  spell uses; a headless run skips loudly. */
export function grantVampireSpells(entity, clan) {
  const ids = [...VAMPIRE_BASE_SPELLS, ...(VAMPIRE_CLAN_SPELLS[clan] ?? [])];
  let granted = 0;
  entity.spells = entity.spells || [];
  for (const id of ids) {
    const record = spellRecordOfIndex(id);
    if (!record) continue;
    const name = String(record.name ?? record.spellName ?? '').replace(/^!/, '');
    if (entity.spells.some((s) => s.tag === VAMPIRE_SPELL_TAG && s.name === name)) continue;
    entity.spells.push({ ...record, name, tag: VAMPIRE_SPELL_TAG, custom: true });
    granted++;
  }
  if (!granted && !entity.spells.some((s) => s.tag === VAMPIRE_SPELL_TAG)) {
    console.warn('[vampirism] SPELLS.STD unavailable - the clan spells are not granted');
  }
  return granted;
}

/** The V2b half of the pending hand-off: a marker with a CLAN and no
 *  lycanthropy strain is vampirism's. */
export function consumeVampirismPending(entity, { now = 0 } = {}) {
  const pending = entity?.racialOverridePending;
  if (!pending) return null;
  if ((pending.lycanthropy ?? LYCANTHROPY_TYPES.None) !== LYCANTHROPY_TYPES.None) return null;
  if (!pending.clan || pending.clan === VAMPIRE_CLANS.None) return null;
  return createVampirismCurse(entity, pending.clan, { now });
}

/**
 * ConstantEffect (:97-107) + MagicRound (:109-113) at the round
 * cadence: both immunities, silver ALWAYS (no beast form to toggle
 * it), and the advantages re-applied - the Anthotis alone add
 * Intelligence (:295-296).
 */
export function vampirismMagicRound(entity, { nowMinutes = 0 } = {}) {
  const entry = liveVampirism(entity);
  if (!entry) return;
  entry.statMods = {};
  for (const stat of VAMPIRE_STATS) entry.statMods[stat] = VAMPIRE_STAT_MOD;
  if (entry.clan === VAMPIRE_CLANS.Anthotis) entry.statMods.intelligence = VAMPIRE_STAT_MOD;
  entry.skillMods = {};
  for (const skill of VAMPIRE_SKILLS) entry.skillMods[skill] = VAMPIRE_SKILL_MOD;
  entity.minMetalToHit = WEAPON_MATERIALS.Silver;
  entry.satiated = isVampireSatiated(entity, nowMinutes);
}

/** IsSatiated (:238-241): fed within the last classic day, <= not <. */
export function isVampireSatiated(entity, nowMinutes = 0) {
  const entry = liveVampirism(entity);
  if (!entry) return true;
  return nowMinutes - (entry.lastTimeFed ?? 0) <= MINUTES_PER_DAY;
}

/** OnWeaponHitEntity (:125-128): the whole body is UpdateSatiation -
 *  any landed attack feeds. */
export function onVampireHit(entity, nowMinutes = 0) {
  const entry = liveVampirism(entity);
  if (entry) entry.lastTimeFed = nowMinutes;
}

/** CheckStartRest (:143-158): an unfed vampire cannot rest - the
 *  refusal is TEXT.RSC 36, spoken by the caller. Lycanthropy never
 *  blocks (its CheckStartRest is the base's `return true`). Answers
 *  null, or the refusal. */
export function racialRestBlock(entity, nowMinutes = 0) {
  const entry = liveVampirism(entity);
  if (!entry) return null;
  if (isVampireSatiated(entity, nowMinutes)) return null;
  return { textId: NOT_SATED_TEXT_ID };
}

/** IsDay (DaggerfallDateTime:  hour in [6, 18)) off the classic
 *  minutes clock - the fast-travel gate's own read. */
export const isDayFromMinutes = (gameMinutes) => {
  const hour = dateFromClassicMinutes(gameMinutes).hour;
  return hour >= DAWN_HOUR && hour < DUSK_HOUR;
};

/** CheckFastTravel (:129-141), called where DFU calls it - at the
 *  travel map's own door (DaggerfallUI.cs:625): a sun-damaged
 *  override cannot fast travel by day. Answers null, or the refusal
 *  line for the host to speak. */
export function racialFastTravelBlock(entity, nowMinutes = 0) {
  if (!entity?.racialOverride?.sunDamage) return null;
  if (!isDayFromMinutes(nowMinutes)) return null;
  return { text: SUNLIGHT_TRAVEL_TEXT };
}

/**
 * CureVampirism (:243-251): the clan is REMEMBERED
 * (PreviousVampireClan - the clan's quest line and reputations
 * outlive the cure), one classic minute passes, the tagged spells go.
 * The quest tombstone sweep is FLAGGED with the quests.
 */
export function cureVampirism(entity, { advanceMinutes = null } = {}) {
  const entry = liveVampirism(entity);
  if (!entry) return false;
  entry.ended = true;
  entity.racialOverride = null;
  entity.previousVampireClan = entry.clan;
  entity.minMetalToHit = undefined;
  advanceMinutes?.(1);   // RaiseTime(60) - sixty SECONDS, the V2a lesson
  if (entity.spells) entity.spells = entity.spells.filter((s) => s.tag !== VAMPIRE_SPELL_TAG);
  return true;
}
