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
// SUN AND HOLY DAMAGE went live in V2c: the entry's
// sunDamage/holyDamage flags are the racial-override arm
// passiveSpecials.js's burn reads (12 per 4th round, through the
// IsPlayerInSunlight/IsPlayerInHolyPlace host seam registered by the
// hosts).
//
// VAMP-DAY (2026-09-26, Mac: "do vampires have a negative??? ...
// instead of constant damage taken they should get reduced stats in
// day and get the bonus at night"; asked, "Day -20 / night +20"): THE
// PORT'S DEPARTURE. The sun no longer burns a vampire. The curse's
// stat advantages are the NIGHT's; from 06:00 to 18:00, in the sun the
// burn struck in - never under a roof or underground (FIELD BUGS
// 2026-10-01b, vampireStatMod) - the same stats are 20 DOWN - held
// where the stat is read so a day never zeroes one (statMods.js
// liveStat: a live 0 kills). The skills' +30, holy ground's burn, the
// feeding and the rest it gates, and the travel rules the sunDamage
// flag still keys (no fast travel by day, arriving by night) stand
// as DFU has them - for a bare head (VAMP-HOOD, below).
//
// VAMP-HOOD (2026-09-29, #suggestions, Starempire42: "adds the ability
// to travel during the day if you a wearing a cloak or robe with a hood
// up"; Sir McMobdon: "nice, good idea"; sent in by Mac): THE SECOND DEPARTURE.
// The flag's travel rules ask racialSunAverse, never the flag: under
// a raised hood - a cloak drawn hood up, or plain robes with theirs,
// survival/temperature.js cloakState, the felt temperature's one hood
// law - the sun does not reach the curse, so the map's door opens by
// day and an arrival is not pushed to dusk. Online that is the whole
// complaint: the shared clock's day is one real hour, and neither a
// rest nor a trip moves that clock. The hood is the travel rules'
// alone: the day's -20 is the street's sun on the stats (indoors and
// underground there is none - FIELD BUGS 2026-10-01b), and a hood
// leaves it.
//
// THE QUESTS went live in V2d (racialQuests.js): P0A01L00 on the
// first 50% hit of the 38-day arm with hasStartedInitialVampireQuest
// latched on this entry, the clan's guild-pool quests after it,
// $CUREVAM on the 84-day cure arm's (10,100)<30 roll, and the cure's
// P0* tombstone sweep below.
//
// THE GUILD SWAP AND THE CEMETERY went live in V2e: every membership
// call site reads guilds.js's activeMemberships (the per-read book
// pick), and the deploy's transfer rides infection.js's
// transferToCemetery host arm.
//
// THE ART AND THE VOICE went live in V5: racialOverrideHeadArt /
// racialPaperDollBackground / racialSuppressPaperDollBodyAndItems
// below (both curses' one switch, consumed by hudLarge's head and
// paperDoll's compose) and vampireAttackVoice inside
// playerAttackGrunt's clip pick. The curse is COMPLETE against
// VampirismEffect.cs.

import { VAMPIRE_CLANS, LYCANTHROPY_TYPES } from './infection.js';
import { MINUTES_PER_DAY, isDayFromMinutes } from './gameDate.js';
import { spellRecordOfIndex } from './loot.js';
import { SKILLS } from './skills.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { VAMPIRE_SPELL_TAG, endOldLifeEffects, liveLycanthropy } from './lycanthropy.js';
import { RACES, RACE_TEMPLATES, raceById } from './races.js';        // V5: the BIRTH race id keys the VAMP00I0 head; DISC10-D V5: and the birth template the compound race clones
import { raceDisplayName } from './talkSession.js';   // L10N3d: the birth race's shown name
import { EFFECT_BITS, SPECIAL_ABILITY_BITS } from './specialAdvantages.js';   // DISC10-D V5: DFCareer.EffectFlags / SpecialAbilityFlags, for CreateCompoundRace
import { SOUND } from './soundClips.js';   // V5: the gendered attack voices
import { endVampireQuests } from './racialQuests.js';   // V2d: the cure's P0* tombstone sweep
import { localizedText, localizedTable } from './textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language
import { cloakState } from './survival/temperature.js';   // VAMP-HOOD: the ONE "is the hood up" - the felt temperature's, never a second list
import { isEnhanced } from './uiSkin.js';   // HOOD-SAID: the hint names the skin's own button
import { playerInSunlight } from './passiveSpecials.js';   // FIELD BUGS 2026-10-01b: the day's -20 is the SUN's - IsPlayerInSunlight, the one seam every host registers

/** VampirismEffect.VampirismCurseKey (:33). */
export const VAMPIRISM_CURSE_KEY = 'Vampirism-Curse';

/** ApplyVampireAdvantages (:274-297), verbatim: +20 on SEVEN stats -
 *  every stat but Intelligence, which only the Anthotis add - and
 *  +30 on six skills (no Swimming: the dead do not float better). */
export const VAMPIRE_STAT_MOD = 20;
/** VAMP-DAY: the curse's stat mod at a clock minute - DFU's +20 out of the sun, the same 20 DOWN in it (06:00-18:00,
 *  outside).
 *  FIELD BUGS 2026-10-01b (Mac: "Sunlight debuff applies in interior (Should be buffed in interiors) (Vampires)"): THE
 *  DAY'S -20 IS THE SUN'S, NEVER THE HOUR'S ALONE. It read isDayFromMinutes - "the hour, never the sky or a roof" - so
 *  at noon a vampire in a tavern, a guild hall or a crypt was 20 down where DFU gives him 20 up. The -20 took the
 *  burn's place, and the burn was DamageFromSunlight (PassiveSpecialsEffect.cs:149-172), which strikes only
 *  `if (GameManager.Instance.PlayerEnterExit.IsPlayerInSunlight)` (:168) - `IsDay && !IsPlayerInside &&
 *  !PlayerEntity.InPrison` (PlayerEnterExit.cs:371), IsPlayerInside raised by a building's EnableInteriorParent (:1086)
 *  and a dungeon's EnableDungeonParent (:1110). So the penalty asks that same flag through the seam every host
 *  registers (passiveSpecials.js playerInSunlight: worldModes for the street and its buildings, dungeonContext for a
 *  dungeon), and out of the sun - indoors, underground, in a cell, or by night - the vampire has what DFU gives him at
 *  every hour: ApplyVampireAdvantages' +20 (VampirismEffect.cs:349-359). No bonus past it. */
export const vampireStatMod = (clockMinutes) => (playerInSunlight(clockMinutes) ? -VAMPIRE_STAT_MOD : VAMPIRE_STAT_MOD);
export const VAMPIRE_SKILL_MOD = 30;
export const VAMPIRE_STATS = Object.freeze(['strength', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck']);
export const VAMPIRE_SKILLS = Object.freeze([
  SKILLS.Jumping, SKILLS.Running, SKILLS.Stealth, SKILLS.CriticalStrike,
  SKILLS.Climbing, SKILLS.HandToHand,
]);

/** AssignPlayerVampireSpells (PlayerEntity.cs:1080-1140): three base
 *  spells for every clan, then the clan's own. The records are
 *  SPELLS.STD ids, each granted with MinimumCastingCost set
 *  (:1138) - a flat 5 spell points, whatever the effects price out at.
 *  AUDIT 39: that used to read as equivalent to calculateCastCost's
 *  universal floor. It is not - the floor RAISES a cheap spell to 5,
 *  the flag ASSIGNS 5 (FormulaHelper.cs:2234-2236) - so Khulari's
 *  Paralysis and Haarvenu's Ice Storm were billed in full. */
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
/** CheckFastTravel's refusal (:195-208) - the localized key
 *  sunlightDamageFastTravelDay, carried as DFU's own en value (the
 *  standing no-localization departure is a MECHANISM one: the port
 *  holds the en string where DFU resolves a TextManager lookup, and
 *  the string itself is DFU's).
 *
 *  AUDIT 64 F24: the value is verbatim
 *  StreamingAssets/Text/Master Localization CSV Files/Internal_Strings.csv:657
 *  (`sunlightDamageFastTravelDay,You cannot initiate fast travel during
 *  the day.`), which is what the shipped en table also carries -
 *  Localization/StringTables/Internal_Strings Shared Data.asset:2007
 *  binds the key to m_Id 500 and Internal_Strings_en.asset:2350 gives
 *  that id the same sentence. ONE key, TWO call sites: this refusal
 *  (VampirismEffect.cs:202) and the career DamageFromSunlight box at
 *  the travel map's door (DaggerfallUI.cs:619), so both speak it. */
export const SUNLIGHT_TRAVEL_TEXT = 'You cannot initiate fast travel during the day.';
/** The refusal as the player reads it, for both of its callers. */
export const sunlightTravelText = () => localizedText('sunlightDamageFastTravelDay', SUNLIGHT_TRAVEL_TEXT);
/** VAMP-HOOD: the port's own line, said after DFU's refusal at the map's
 *  door - the rule, where the sun's rule is met.
 *  HOOD-SAID (FIELD BUGS 2026-09-30): AND THE BUTTON THAT DOES IT. The
 *  line sent a player to raise a hood with no button of that name: the
 *  pack's card offered Use, which stepped the cloak through its drawings
 *  and drew nothing. The card carries Raise hood now (ui/enhancedInventory.js),
 *  and the line names it. The classic window has no such button - its
 *  Use on the doll steps DFU's drawings, the doll redrawn at each - so
 *  on that skin the line says that. */
export const VAMPIRE_HOOD_TEXT = 'Raise the hood of a cloak or robe to travel by day - Raise hood, on its card in the pack.';
export const VAMPIRE_HOOD_TEXT_CLASSIC = 'Use a cloak or robe on your doll until its hood is up.';

/** The live curse entry, or null. VU1 moved the DECLARATION into
 *  systems/racialLive.js - an import-free leaf - because
 *  combat/formulas.js needs it and this module cycles back to formulas
 *  through loot.js. Re-exported here so every existing consumer keeps
 *  reading it from the module that owns the subject. */
import { liveVampirism } from './racialLive.js';
export { liveVampirism };

/**
 * The deploy: DeployFullBlownVampirism's tail V1 could not own (the
 * clock raise and popup already ran there) + VampirismEffect.Start
 * (:70-82): the curse entry, the clan carried over, CureAll, the
 * clan's spells. Same refusals as the werewolf's.
 */
export function createVampirismCurse(entity, clan, { now = 0, restore = false } = {}) {
  if (!entity || liveVampirism(entity) || entity.racialOverride) return null;
  const entry = {
    kind: 'racialOverride',
    permanent: true,   // CURSE-PERSIST1: lifelong - ended by its cure, never by the magic-round clock (diseases' and poisons' own flag)
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
  if (!restore) endOldLifeEffects(entity);   // CureAll (:81) - the same clean start the werewolf gets; CURSE-REPAIR1: not on a curse given back
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
    entity.spells.push({ ...record, name, tag: VAMPIRE_SPELL_TAG, custom: true, minimumCastingCost: true });
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
 * Intelligence (:295-296). VAMP-DAY: the sun's -20 on the same stats,
 * DFU's +20 out of it - FIELD BUGS 2026-10-01b: by day only where the
 * sun reaches, the host's roof read through vampireStatMod
 * (`nowMinutes` is the world clock, worldTick's `clockMinutes`).
 */
export function vampirismMagicRound(entity, { nowMinutes = 0, skyMinutes = nowMinutes } = {}) {
  const entry = liveVampirism(entity);
  if (!entry) return;
  const mod = vampireStatMod(skyMinutes);   // LIVED1: VAMP-DAY's day and night are the world's sky; the thirst below is the character's own clock
  entry.statMods = {};
  for (const stat of VAMPIRE_STATS) entry.statMods[stat] = mod;
  if (entry.clan === VAMPIRE_CLANS.Anthotis) entry.statMods.intelligence = mod;
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

// ── V5 - THE CURSE ART + THE VAMPIRE'S VOICE ─────────────────────
// GetCustomHeadImageData / GetCustomPaperDollBackgroundTexture for
// BOTH curses live here (vampirism already imports lycanthropy, and
// the two laws are one switch), consumed by hudLarge's head and
// paperDoll's compose. GetCustomRaceGenderAttackSoundData is the
// vampire's alone - the werewolf voices ride OnWeaponHitEntity (V4).

/** The override HEAD: transformed lycanthropes wear WERE01I0 (wolf) /
 *  WERE00I0 (boar); a vampire ALWAYS wears the clanless VAMP00I0.CIF
 *  face - "one per birth race and gender", females records 0-7,
 *  males 8-15, keyed by BirthRaceTemplate.ID - 1 (VampirismEffect
 *  :149-169). Answers { file, record } or null. */
export function racialOverrideHeadArt(entity) {
  const lyc = liveLycanthropy(entity);
  if (lyc?.isTransformed) {
    return { file: lyc.infectionType === LYCANTHROPY_TYPES.Wereboar ? 'WERE00I0.IMG' : 'WERE01I0.IMG', record: 0 };
  }
  if (liveVampirism(entity)) {
    const raceId = RACES[entity?.race] ?? 1;   // entity.race stays the BIRTH race; the curse only overrides the NAME
    return { file: 'VAMP00I0.CIF', record: (entity?.gender === 'female' ? 0 : 8) + raceId - 1 };
  }
  return null;
}

/** The override PAPERDOLL BACKGROUND (LycanthropyEffect :269-302 /
 *  VampirismEffect :134-147): the transformed beast's full-body art,
 *  or the vampire's crypt - whatever the location context. The same
 *  8,7,110x184 sub-rect law as every SCBG. Answers a filename or
 *  null. */
export function racialPaperDollBackground(entity) {
  const lyc = liveLycanthropy(entity);
  if (lyc?.isTransformed) return lyc.infectionType === LYCANTHROPY_TYPES.Wereboar ? 'BOAR00I0.IMG' : 'WOLF00I0.IMG';
  if (liveVampirism(entity)) return 'SCBG08I0.IMG';
  return null;
}

/** SuppressPaperDollBodyAndItems (LycanthropyEffect :113-116, the
 *  renderer's whole-body skip at PaperDollRenderer :165): while
 *  transformed the panel is the beast background ALONE - no cloaks,
 *  no body, no head, no items, and an empty click mask with them. */
export const racialSuppressPaperDollBodyAndItems = (entity) => !!liveLycanthropy(entity)?.isTransformed;

/** GetCustomRaceGenderAttackSoundData (:171-187): a vampire's attack
 *  grunt is the vampire's own, by GENDER - 20% the bark, else the
 *  attack cry (one roll; unlike the werewolf pair this always answers
 *  a clip). Consumed inside playerAttackGrunt's clip pick - the 20%
 *  FIRE chance stays the caller's, as DFU's does. */
export function vampireAttackVoice(entity, rolls = Math.random) {
  if (!liveVampirism(entity)) return null;
  const bark = Math.floor(rolls() * 100) < 20;
  return entity?.gender === 'female'
    ? (bark ? SOUND.EnemyFemaleVampireBark : SOUND.EnemyFemaleVampireAttack)
    : (bark ? SOUND.EnemyVampireBark : SOUND.EnemyVampireAttack);
}

// ── DISC10-D V5 - THE LIVE RACE TEMPLATE ─────────────────────────

/** PlayerEntity.BirthRaceTemplate: the race the character was MADE as.
 *  Chargen writes the race KEY and a classic save may carry only the id,
 *  so both roads are taken and the display name is accepted too (the
 *  enhanced sheet's MAC-G reader, homed here with its one consumer). */
export function birthRaceTemplate(entity) {
  if (!entity) return null;
  return RACE_TEMPLATES.find((r) => r.key === entity.race || r.name === entity.race)
    ?? raceById(entity.raceId)
    ?? null;
}

// L10N3d: the compound race's Name is GetLocalizedText("vampire") (VampirismEffect.cs:331) or "werewolf"/"wereboar"
// (LycanthropyEffect.cs:514-516), read here by the English name the curse entry keeps.
const OVERRIDE_RACE_NAMES = localizedTable({
  Vampire: ['vampire', 'Vampire'], Werewolf: ['werewolf', 'Werewolf'], Wereboar: ['wereboar', 'Wereboar'],
});
const overrideRaceName = (name) => (Object.hasOwn(OVERRIDE_RACE_NAMES, name) ? OVERRIDE_RACE_NAMES[name] : name);

/**
 * PlayerEntity.RaceTemplate (:151) = GetLiveRaceTemplate (:233-241): the
 * racial override's CustomRace when one is live, else the birth race.
 * Both curses CLONE the birth race (VampirismEffect.cs:326-338,
 * LycanthropyEffect.cs:547-555) and change what they change:
 *  - the vampire: the name "Vampire", immunity to Paralysis and Disease,
 *    SunDamage and HolyDamage;
 *  - the lycanthrope: immunity to Disease, and the name swapped to
 *    "Werewolf"/"Wereboar" while transformed and back on the way out
 *    (MorphSelf, :510-528) - `raceNameOverride` on the curse entry.
 * The character sheet reads this, as DFU's reads RaceTemplate.Name
 * (DaggerfallCharacterSheetWindow.cs:398) and its specials list reads the
 * template's flags (:463). The port wrote the override name on both
 * curses and nothing read it: every vampire's sheet said "Breton".
 * Answers a frozen template, or null when there is no race at all.
 */
/** L10N3d: the race name a sheet shows - a curse's own name (read in the player's language where the curse table
 *  holds it), else the birth race's display name (RaceTemplate.Name through TextManager, talkSession.RACE_DISPLAY_NAME).
 *  The template's `name` stays the English identity saves and matches read. */
export function liveRaceName(entity) {
  const t = liveRaceTemplate(entity);
  return t && t !== birthRaceTemplate(entity) ? t.name : raceDisplayName(t?.key ?? entity?.race);
}

export function liveRaceTemplate(entity) {
  const birth = birthRaceTemplate(entity);
  const vamp = liveVampirism(entity);
  const lyc = vamp ? null : liveLycanthropy(entity);
  if (!vamp && !lyc) return birth;
  const base = birth ?? { name: entity?.race ?? 'Breton', resistanceFlags: 0, immunityFlags: 0, lowToleranceFlags: 0, criticalWeaknessFlags: 0, specialAbilities: 0 };
  if (vamp) {
    return Object.freeze({
      ...base,
      name: overrideRaceName(vamp.raceNameOverride ?? 'Vampire'),
      immunityFlags: (base.immunityFlags ?? 0) | EFFECT_BITS.toParalysis | EFFECT_BITS.toDisease,
      specialAbilities: (base.specialAbilities ?? 0) | SPECIAL_ABILITY_BITS.holyDamage,   // VAMP-DAY: the sun no longer burns, so the sheet no longer says it does
    });
  }
  return Object.freeze({
    ...base,
    name: lyc.raceNameOverride != null ? overrideRaceName(lyc.raceNameOverride) : base.name,
    immunityFlags: (base.immunityFlags ?? 0) | EFFECT_BITS.toDisease,
  });
}

// isDayFromMinutes moved HOME to gameDate.js (V2c) - it is date law,
// and the sunlight seam reads it too; re-exported for this module's
// existing consumers.
export { isDayFromMinutes };

/** VAMP-HOOD: whether the sun reaches a racial override - its SunDamage
 *  flag (CreateCompoundRace), UNLESS the wearer's hood is up. Every
 *  rule the flag keys asks this: the map's door below and the arrival
 *  clamp (world.js sunAverse). The worn table is read as the survival
 *  feed reads it, never minted by the read. */
export function racialSunAverse(entity) {
  if (!entity?.racialOverride?.sunDamage) return false;
  return !cloakState(entity.equip?.slots ?? null).hood;
}

/** CheckFastTravel (:129-141), called where DFU calls it - at the
 *  travel map's own door (DaggerfallUI.cs:625): a sun-damaged
 *  override cannot fast travel by day - VAMP-HOOD: bare-headed. Answers
 *  null, or the refusal line for the host to speak and the hood's
 *  `hint` to speak after it. */
export function racialFastTravelBlock(entity, nowMinutes = 0) {
  if (!racialSunAverse(entity)) return null;
  if (!isDayFromMinutes(nowMinutes)) return null;
  return { text: sunlightTravelText(), hint: isEnhanced() ? VAMPIRE_HOOD_TEXT : VAMPIRE_HOOD_TEXT_CLASSIC };   // HOOD-SAID: the skin's own button
}

/**
 * CureVampirism (:304-312): the clan is REMEMBERED
 * (PreviousVampireClan - the clan's quest line and reputations
 * outlive the cure), one classic minute passes, the tagged spells go,
 * and EVERY P0* quest is tombstoned - the whole clan line leaves with
 * the curse (V2d - EndVampireQuests, through the racialQuests host).
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
  endVampireQuests();
  return true;
}
