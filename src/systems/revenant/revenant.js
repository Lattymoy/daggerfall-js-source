// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REVENANTS (2026-10-02, Mac: "the ability for these enemies that kill you, or a very small chance to flee at low
// health. These enemies can return at a later time stronger, with a new name, a chance of more loot and taunt the
// player"; REVENANT-NAME, Mac: "Should instead be something unique" - a foe that RETURNS).
//
// WHO BECOMES ONE. A SPECIAL foe - an elite (systems/eliteFoes.js), a LOOT7 champion (systems/champions.js) or a
// revenant already - that
//   - lands the blow that KILLS the player (melee or an arrow: the blows the struck seam names, formulas.js), or
//   - at under a fifth of its health, wins a small roll (REVENANT_FLEE_CHANCE; a revenant already, more) and RUNS -
//     and is out of reach before its run is spent (scenes/exteriorFoes.js: the open world's foes).
// Never under level 3, the city watch, an ally, a quest's foe or a summons - LOOT7's floor and exclusions.
//
// WHAT IT BECOMES. A record per character (below): a given name from DFU's own name banks (characters/nameHelper.js,
// drawn on a seeded side-stream so the shared DFRandom never moves) and an EPITHET that says what it did - "Grushnak
// the Butcher" for a kill, "Grushnak the Scarred" for an escape. Every deed after the first RANKS IT UP (to
// REVENANT_MAX_RANK) and gives it a NEW epithet; a foe that killed you stands in the world under its new name at once.
//
// ITS RETURN. One to three days later on the character's own clock, an open-world encounter roll may stand it instead
// (REVENANT_RETURN_CHANCE a roll, one revenant at a time): its own kind and sprite, its trait (a champion's) or its
// glow (an elite's, online), and over that its rank - more health, harder blows, a class foe a higher level. In
// sight and near, it TAUNTS - a line that knows what it did and to whom. Slain, it carries a revenant's drop (gold by
// level and rank, a chance of Magic, Rare and Legendary gear that grows with the rank, a Rare always from rank 3) and
// is gone for good. Run from, it slips away and comes back later.
//
// KEPT TWICE. In the save (the per-mod slot, systems/modSaveData.js - it travels with an online character) AND in the
// app's own storage under the character's id (systems/characterId.js), because an offline death ends the run with
// nothing saved and a death is exactly what makes a revenant. Each record carries a revision; the two are merged by
// it, so a reload of an older save never forgets a revenant made since, nor raises one already slain.
//
// OFF IS DFU EXACTLY: with the loot-rarity row off (the Loot arc's switch, as LOOT7's), no revenant is made, flees or
// returns.
//
// RENOWN-GATE (2026-10-12, bible/06-Systems/Revenants.md section 39): ONLINE, REVENANTS WAIT FOR RENOWN 10
// (REVENANT_MIN_RENOWN). Under it a character's are HELD (revenantHeld): every door that makes, stands, spreads or marks
// one answers as the switch's off does, while what is remembered stays on the page and the sworn keep their days.
// Offline nothing is held. And a due one takes two encounter rolls in five, not one in two (REVENANT_RETURN_CHANCE).
//
// UNQUIET (2026-10-17, bible/06-Systems/Revenants.md section 46 - the owner: "harder, rarer, revenants need more of a
// chance to flee instead of relying on player death"): the paragraphs above are the law as it began. Now only a special
// foe carrying THE MARK (systems/revenant/unquietMark.js, one in four) rises, and none while REVENANT_MAX (3) hunt the
// player; a marked foe breaks at the young line on one roll in two and runs as a bolt does; a revenant ranks up at every
// getting-away, at every second tear-away and at every second kill (revenantUnquiet.js TEAR_RANK, BLOOD_RANK); it comes
// back in two to four days, its ranks weigh more, and revenantUnquiet.js keeps the rest - its flight craft, its wounds,
// its ambition and the Dread. AUDIT UNQUIET (section 49) corrected it where it was untrue.
//
// ONLINE: a revenant is its character's own memory; a returning one is my own foe, streamed as any - its kind, health,
// trait, glow and (REVENANT-WIRE) its NAME, the foe record's `nm`, so every puppet is called what its owner calls it.
//
// REVENANT-CARD: everything a revenant says or does is an EVENT (below) - its portrait, its name, its words - which the
// enhanced skin draws as a card (ui/revenant/revenantCard.js, through systems/revenant/revenantVoice.js) and the classic says as a line.
// REVENANT-HARM: a death no blow names (a spell, a lingering effect, a poison) goes to the foe whose harm last reached
// the player (systems/harmMark.js). REVENANT-DUNGEON: a dungeon foe of mine alone may run and escape too.
// REVENANT-PAGE: the pause menu's Stats rail lists them (ui/revenant/revenantPage.js).
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn } from '../loot/lootRarity.js';
import { renownOpens } from '../sigil/sigil.js';   // RENOWN-GATE: the page's Renown, the door every Renown-woken power reads
import { wildHere } from '../wild/wildZone.js';   // PVPDUNGEONS: no revenant is made in, nor returns to, the open zone
import { registerPlayerBlowLanded } from '../sigil/sigilSetPowers.js';
import { registerPlayerHurtListener } from '../../characters/playerEntity.js';   // REVENANT-HARM: a death no blow names
import { registerPlayerStruckListener, registerPlayerStrikeListener } from '../../combat/formulas.js';   // REVENANT-HARM: a foe's blow leaves its mark (its poison's ticks come later); RVN1: my blow, in its fight's ledger
import { markPlayerHarm, playerHarmMark, clearPlayerHarm, HARM_MARK_STRUCK_MS, harmFightSince, markPlayerLow, playerLowSince, endPlayerFights } from '../harmMark.js';   // RVN10: the fight a rout reads
import { playerDoor } from '../playerDoor.js';
import { MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS } from '../rumorMill.js';   // RVN7b: a person's one answer, the mill's own gate
import { compassWord, distanceWord } from '../bounty/bountyBoard.js';   // RVN7b: a town crier's words for where
import { setHuntJournal, HUNT_QUEST_PREFIX } from '../huntJournal.js';   // RVN7c: a hunt in the quest log, and its Abandon
import { MINUTES_PER_DAY } from '../gameDate.js';   // RVN9: the character's day
import { registerModSaveData } from '../modSaveData.js';
import { appStorage } from '../appStorage.js';
import { characterIdOf, mintCharacterId } from '../characterId.js';
import { ownMinutes, skyMinutes } from '../worldTick.js';
import { isNight } from '../../world/worldClock.js';   // RVN1: a fight begun by night
import { tieredGear } from '../eliteFoes.js';
import { legendaryGate, rollerLevel } from '../loot/lootLevelGate.js';   // LOOT-GATE
import { foeSeed } from '../../characters/foeBodies.js';   // FB1012d ALLY-RACE: the person a revenant is born as - the seed its body was drawn by
import { goldStack, isSummoned, isGoldPieces, addItem, addGoldPieces } from '../inventory.js';   // RVN11b: a deserter's pack, handed back   // RVN8: never a summoned piece or gold taken
import { unequipItem, equipTableOf, EQUIP_SLOTS } from '../equip.js';   // RVN8: what it takes, off the hand that held it
import { isLocked } from '../item/itemLock.js';   // RVN8: LOCK1's promise - a locked piece stays yours
import { isBagItem } from '../../net/bagLaw.js';   // RVN8: never the Materials Bag
import { isPackOnly, isRealmLocked } from '../item/itemBound.js';   // AUDIT 625 W2: nor a pack-only piece (the Wallet); AUDIT FB1025i F1: nor a realm-locked one
import { WILD_NEVER_GROUPS } from '../wild/wildLeaf.js';   // STEED-KEPT: nor what never changes hands - a vehicle, a deed (the zone's own leaf - never the drop law's graph)
import { BOAT_TEMPLATES } from '../../net/realm/realmTradeLaw.js';   // STEED-KEPT: nor a ship's deed or parts
import { DECOR_OWN_KEPT_BACK } from '../../net/decorLaw.js';   // STEED-KEPT: nor a deed as Daggerfall files one, nor the spellbook
import { hudTextWhenShown } from '../notify.js';   // STEED-KEPT: a piece home again, said once the world can say it
import { isLetterOfCredit } from '../peerWord.js';   // LETTERS-HOME: nor a letter of credit - its worth is gold
import { itemLongName } from '../item/itemInfo.js';   // RVN8: the piece by the name the pack shows
import { itemValueOf } from '../item/itemTemplates.js';   // RVN8: the most valuable
import { enemyDisplayName, ENEMY_BASICS, isClassEnemyId } from '../../characters/enemy/enemyBasics.js';
import { KNIGHT_CITY_WATCH } from '../../characters/mobile/mobileTypes.js';
import { firstName, monsterName, BANK_TYPES, GENDERS } from '../../characters/nameHelper.js';
import { getSeed, setSeed, srand } from '../../formats/dfRandom.js';
import { personalityFor, isPersonality, personalityLabel, voiceLine, beastBody, possessive, MUTE_KINDS } from './revenantPersonality.js';   // REVENANT-VOICE: who it is, and how it talks
// FEUD, Part B (bible/12-Enhanced-AI/Feud-Arc.md sections 12-26): what a revenant remembers - its record's new fields and
// the draws it is born with (systems/revenant/revenantFeud.js), and the fight's ledger (systems/feudLedger.js, a leaf)
import { ADAPT_HOW, DESERT, deserterSplit, LOYALTY, movedLoyalty, ROUT, FESTER, festersOn, WRATH_MAX, idStream, TOOK_MAX, LAIR_RING_R, RUMOR_CHANCE, RUMOR_PX, RUMOR_WEAK, RUMOR_NAMED, RUMOR_HINTS, weaknessKind, lairAfter, sameLair, feudFields, newFeudFields, feudScars, withScars, weaponFeudClass, drawSignature, sanitizeLoyalty, hashStr, SIG_RANK, lessonOf, withLesson, adaptEdge, adaptBlowClass, ADAPT, isWeakBlow, metalOf, willMatters, WEAK, WEAK_NAMES, FLINCH_LINES, FLINCH_HEALTH, WEAKNESS_ELEMENTS, signatureStamp } from './revenantFeud.js';
import { sanitizeGear, gearItems } from './revenantGear.js';   // RVN-GEAR: a sworn one's kit - its record's, read back; inventory as its pack is
import { sanitizeErrand } from './revenantErrands.js';   // RVN-ERRAND: one abroad, read back
import { rvnHeldStars, rvnLevelOf, rvnStarPoints, rvnLoyaltyMove, rvnXpOf } from './revenantStars.js';   // RVN-STARS: its sky and its level, read back; its loyalty's losses as its oath bears them
import { setUnquietGate, isUnquiet } from './unquietMark.js';   // UNQUIET (section 46): the mark - who may rise
import { BLOOD_DEEDS, deedRanks, sanitizeBlood, sanitizeTears, revenantCraft, craftPace, beginCraft, craftStep, endCraft, woundOf, withWound, sanitizeWounds, woundEffects, woundedEdge, ambitionOf, AMBITION, masteryFestersOn, plunderGold, hoardOf, DREAD, mayAscend, craftFleeWords, woundWords, ambitionRumor, HUNT, trailWarm, trailHours, sanitizeTrail, trailWords, omenWords, healsOn, trainLesson, trainedHow, trainedWords, nearestLair } from './revenantUnquiet.js';   // UNQUIET: born of flight, its craft, its wounds, its ambition, the Dread
import { t } from '../textManager.js';   // AUDIT RVN D7: the new cards' kickers in the player's language
import { tagHit, HIT_TAGS } from '../../ui/hitNumbers.js';   // RVN3: the "Weakness" word on my blow's number
import { SOUND } from '../soundClips.js';   // RVN3: the hiss of a weakness found
import { revenantSay as sayRevenant } from './revenantVoice.js';   // RVN3: the reveal's card (the re-export below binds no local name)
import { registerBlowTakenMod } from '../blowTaken.js';   // RVN2: what its adaptations take off a blow (the leaf the formulas and a spell's landing read)
import { registerEntityFold, newMods, EMPTY_MODS, computeEntityMods } from '../entityMods.js';   // RVN2: its elemental adaptations on the saving throw
import { registerSilverDoubleVeto } from '../../combat/formulas.js';   // RVN2: a Silver-scarred one's double gone
import { setFeudGate, setFeudClock, noteFeudHarm, noteFeudBackstab, takeFeud, setFeudWeakTest, feudWeakBlow, elementFeudClass, feudOf } from '../feudLedger.js';

// ── the numbers ─────────────────────────────────────────────────────
/** A revenant is a foe of this level or more (LOOT7's champion floor, ELITE-FLOOR's). */
export const REVENANT_MIN_LEVEL = 3;
/** RENOWN-GATE (2026-10-12, the owner: "gate elite/revenant spawns behind renown level"; asked, "Elites 5, revenants 10",
 *  offline "Unchanged offline"): online, a character's revenants wait for this Renown (revenantHeld) - an evening's play
 *  past the elites' 5 (eliteFoes.js ELITE_FOE_MIN_RENOWN), so a returning elite always finds elites standing. */
export const REVENANT_MIN_RENOWN = 10;
/** How many living revenants hunt a character. UNQUIET (section 46; the owner: "rarer"): three - and while three hunt the
 *  player none other rises (no foe is marked - systems/revenant/unquietMark.js - and a marked one is no candidate); it was
 *  five, a sixth replacing the weakest, oldest. A deserter or a betrayer past it still buries the weakest, oldest; a
 *  kinsman's killer handed to an heir joins them past it (AUDIT UNQUIET). The Dread hunts no one - it waits at home - and
 *  is not counted (`huntingRevenants`). */
export const REVENANT_MAX = 3;
/** The highest rank a revenant climbs to. */
export const REVENANT_MAX_RANK = 5;
/** Under this share of its health a revenant past its will's rank may run - once, the first time it falls under. */
export const REVENANT_FLEE_HEALTH = 0.2;
/** ...and runs on this roll. UNQUIET (section 46; the owner: "revenants need more of a chance to flee instead of relying on
 *  player death"): a MARKED foe not yet a revenant breaks at the young line (REVENANT_FLEE_HEALTH_YOUNG) on
 *  REVENANT_FLEE_CHANCE - it was an elite's or a champion's "very small chance", 5% at a fifth, so nearly every revenant
 *  was born of the player's death; a revenant past its will's rank on REVENANT_FLEE_CHANCE_REVENANT (it was 15%).
 *  AUDIT UNQUIET (section 49): one roll in two (it was three in four), at REVENANT_FLEE_PACE_MARKED - at the old pace a
 *  fast runner cornered every flight and a slow one let three and a half times as many be born. */
export const REVENANT_FLEE_CHANCE = 0.5;
export const REVENANT_FLEE_CHANCE_REVENANT = 0.35;
/** FLIGHT-FIRST (2026-10-07, Mac: "Player death shouldnt be the common way of revenant growth, it should be more common
 *  for revenants to flee instead of being easily captured"): a revenant UNDER ITS WILL'S RANK (revenantFeud.js
 *  WILL_RANK) has no will to tear away on at the killing blow - its flight is how it lives. It breaks at this share of
 *  its health (one blow rarely carries it past the line, as it did the fifth) and runs on this roll. */
export const REVENANT_FLEE_HEALTH_YOUNG = 0.35;
export const REVENANT_FLEE_CHANCE_YOUNG = 0.8;
/** How long a fleeing foe runs (the motor's flee, characters/enemy/enemyMotor.js) - out of reach when it ends, it escapes. */
export const REVENANT_FLEE_SECONDS = 8;
/** FLIGHT-FIRST: ...at this share of its walk (a revenant's run - UNQUIET: but its craft's, revenantUnquiet.js craftPace,
 *  and a marked foe's REVENANT_FLEE_PACE_MARKED). A foe's walk (4.5-6 m/s) never outran a running player (8.1 m/s at Speed
 *  and Running 50), so every flight was run down and knelt; running for its life it gets away from a chase on foot,
 *  unless the chaser is a fast runner or brings it down from range. */
export const REVENANT_FLEE_PACE = 2;
/** AUDIT UNQUIET (section 49): a MARKED foe's run, not yet a revenant - a bolt's (revenantUnquiet.js CRAFT.BOLT_PACE), so a
 *  birth by flight is the roll's and the chase's, not the chaser's Speed alone. */
export const REVENANT_FLEE_PACE_MARKED = 2.5;
/** ...or the moment it is this far from the player. */
export const REVENANT_ESCAPE_DISTANCE = 45;
/** ...or its run spent past this far (metres). Spent nearer - chased down - it is CORNERED: it turns and fights.
 *  FLIGHT-FIRST: 12 (it was 20) - its run's lead on a chaser at Speed and Running 50 is about 17 m, and that is a
 *  flight that got away, not one run down; a fast runner (about 9 m/s and up) still corners it. */
export const REVENANT_ESCAPE_NEAR = 12;
/** How many slain revenants a character's page keeps (the newest); older ones, and the forgotten, leave a tombstone. */
export const REVENANT_FALLEN_MAX = 12;
/** How many tombstones are kept - each one id and a revision, so an older save never raises what was put down. */
export const REVENANT_TOMBS_MAX = 200;
/** It comes back between two and four days later, on the character's own clock. UNQUIET (section 46; "rarer"): it was
 *  one to three; a revenant of VENGEANCE comes in one to two (revenantUnquiet.js AMBITION.VENGEANCE_DUE). */
export const REVENANT_RETURN_MIN_MINUTES = 2880;
export const REVENANT_RETURN_MAX_MINUTES = 5760;
/** A due revenant takes an open-world encounter roll this often. RENOWN-GATE (the owner: "slighty reduce the spawn rate
 *  of revnants"; asked, "Return chance 50% → 40%"): two rolls in five - it was one in two. */
export const REVENANT_RETURN_CHANCE = 0.4;
/** Out in the world and gone unfought (outrun, a load, a sweep), it waits this long and comes again. */
export const REVENANT_LOST_MINUTES = 360;
/** A claimed stand's grace (wall ms): a body still standing up (its art loading) is not yet missing from its pool
 *  (revenantPresence), nor a stand that never came (revenantForLair's LAIR-HOME). */
export const REVENANT_STAND_GRACE_MS = 15000;
/** Its rank over what it was: health and blows per rank, and a class foe's level per rank. UNQUIET (section 46; "harder"):
 *  0.4, 0.15 and 3 - they were 0.25, 0.1 and 2 (tools/tellDuel.mjs measures the rank's weight). */
export const REVENANT_HEALTH_PER_RANK = 0.4;
export const REVENANT_DAMAGE_PER_RANK = 0.15;
export const REVENANT_LEVEL_PER_RANK = 3;
/** In sight and this near (metres), a returning revenant taunts - once a return. */
export const REVENANT_TAUNT_DISTANCE = 25;
/** Its drop on its death - over its kind's own loot. */
export const REVENANT_LOOT = Object.freeze({
  goldPerLevel: [15, 40],   // times the rank
  magicChance: 0.5,
  rareChance: 0.15, rarePerRank: 0.1,
  legendaryChance: 0.03, legendaryPerRank: 0.03,
  rareFromRank: 3,          // a Rare always, from this rank
});
/** The save slot's vendor, and the app storage's key. */
export const REVENANT_SAVE = 'Revenant';
export const REVENANT_STORE_PREFIX = 'dagger.revenant.';
/** How many deeds a record remembers. */
const HISTORY_MAX = 12;

/** Kinds that do not speak - beasts and the mindless: they bare their teeth where another would taunt (the set is the
 *  voice's, systems/revenant/revenantPersonality.js MUTE_KINDS - who it is leans by it too). */
export const revenantSpeaks = (mobileType) => !MUTE_KINDS.has(mobileType);

// ── the words ───────────────────────────────────────────────────────
// `{p}` is the player's first name (RVN10: `{a}` a felled companion's). An epithet starting "the" follows the given
// name ("Grushnak the Butcher"); any other follows a comma ("Grushnak, Bane of Ayla").
export const REVENANT_EPITHETS = Object.freeze({
  slew: Object.freeze(['the Butcher', 'the Gravedigger', 'the Widowmaker', 'Bloodhand', 'Bane of {p}', 'the Unbowed', 'Who Slew {p}', 'the Reaper']),
  fled: Object.freeze(['the Scarred', 'the Survivor', 'the Cunning', 'the Hunted', 'Half-Dead', 'the Lucky', 'Who Ran', 'the Unbroken']),
  // RVN10 (bible/12-Enhanced-AI/Feud-Arc.md 21): it knocked out my companion (`{a}` the companion's name); I ran from it
  felled: Object.freeze(['Bane of {a}', 'the Companion-Killer', 'Breaker of Oaths']),
  routed: Object.freeze(['Who Made {p} Run', 'the Pursuer']),
  // RVN11b (22.2): it broke its oath - whatever its rank, this is its name
  deserted: Object.freeze(['the Oathbreaker']),
  // RVN11c (22.3): it turned on me
  betrayed: Object.freeze(['the Betrayer']),
  // from rank 3, whatever the deed (UNQUIET: "the Dread" is the ascended's alone now - `dread` below)
  risen: Object.freeze(['the Thrice-Risen', 'the Undying', 'Revenant of {p}', 'the Relentless', '{p}\'s Shadow']),
  // UNQUIET (section 46): a rank-5 revenant that got away once more - gone to ground in its lair for good
  dread: Object.freeze(['the Dread']),
});
// REVENANT-VOICE: what each says, in its own personality's voice, is systems/revenant/revenantPersonality.js's.

// ── the store ───────────────────────────────────────────────────────
/** RVN1 (section 26): the deeds FEUD adds - felled (RVN10), routed (RVN10), festered (RVN9), deserted and betrayed
 *  (RVN11), laststand (RVN4); UNQUIET (section 46): ascended (the Dread).
 *  @typedef {{ deed: 'slew'|'fled'|'returned'|'fell'|'yielded'|'executed'|'spared'|'released'|'felled'|'routed'|'festered'|'deserted'|'betrayed'|'laststand'|'ascended', at: number }} RevenantDeed */
/** REVENANT-COMPANION: a sworn one's place - walking with the player, sent away (called back at will), or resting after
 *  a fall (`until` the character's minute it is fit again) - its health carried between places, and its pack. RVN1:
 *  its `loyalty` (0-100, RVN11's - its personality's start when sworn); RVN11: `rested` (fit after a rest, not yet called)
 *  and `sentDay` (the day it was last sent away). RVN-GEAR: `gear`, its kit (systems/revenant/revenantGear.js - a slot's
 *  key -> the item it wears). RVN-ERRAND: `errand` while its state is 'errand' - abroad (systems/revenant/revenantErrands.js). RVN-STARS:
 *  `xp` its level's, earned at my side, and `stars` its sky (systems/revenant/revenantStars.js).
 *  @typedef {{ state: 'with'|'away'|'resting'|'errand', health: number|null, maxHealth: number|null, until: number|null, items: any[], loyalty: number, rested: boolean, sentDay: number|null, gear: Record<string, any>, errand: any, worn: boolean, paid: number[], xp: number, stars: string[], lossCarry: number }} RevenantCompanion */
/** @typedef {{ id: string, rev: number, mobileType: number, gender: 'male'|'female', given: string, epithet: string,
 *   name: string, rank: number, kills: number, escapes: number, returns: number, trait: string|null, elite: boolean,
 *   born: number, dueAt: number, out: boolean, outAt: number, defeated: boolean, defeatedAt: number|null,
 *   notice: string|null, history: RevenantDeed[], archive: number|null, personality: string, person: number,
 *   fate: 'executed'|'sworn'|'released'|null, sworn: boolean, swornAt: number|null, companion: RevenantCompanion|null,
 *   scars: {k: string, at: number}[], learned: string[], weak: string, weakKnown: 0|1|2, sig: string|null, kin: number[],
 *   lair: {px: number, py: number, name: string, region: number}|null, lairKnown: boolean, took: any[], wrath: number,
 *   fights: number, wounds: string[], blood: number, tears: number, dread: boolean, trail: number, omen: number, woundDay: number, gone?: boolean }} RevenantRecord */
// UNQUIET (section 46): `wounds` what the player left on it (revenantUnquiet.js WOUNDS), `blood` its kills and fellings
// since its last rank (BLOOD_RANK ranks it), `tears` its will's tear-aways since its last rank (TEAR_RANK ranks it - AUDIT
// UNQUIET), `dread` ascended - gone to ground in its lair for good; UNQUIET II (section
// 47): `trail` the minute its escape's trail cools (0 - none), `omen` the due minute its coming was foretold for;
// UNQUIET III (section 48): `woundDay` the character day it took its last wound (-1 - none), its wounds' healing counted from it
// RVN1 (section 26): every field after `companion` is FEUD's, its law and an older record's value systems/revenant/revenantFeud.js
// feudFields; the signature's name, the band's name and the epithets are derived from them, never stored

/** RVN1: `lastDay` - the character's last day festering was counted to (RVN9's), kept with the list.
 *  @type {{ list: RevenantRecord[], mirrorId: string|null, lastDay: number|null }} */
const _state = { list: [], mirrorId: null, lastDay: null };
/** RVN1: a day read back (a save, the mirror) - a whole day, else none. */
const sanitizeDay = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
/** RVN1: two days as one - the later (a reload never counts a day twice). */
const laterDay = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));

export const revenantOn = () => lootRarityOn();
/** RENOWN-GATE: are this page's revenants HELD - online under REVENANT_MIN_RENOWN, or before the page knows its Renown
 *  (sigil.js renownOpens; offline never)? Held, every door that makes, stands, spreads or marks one answers as the
 *  switch's off does - none is made or flees, none returns or keeps its lair, no rumor or hunt points at one, none
 *  festers - and what is remembered stays on the page (ui/revenant/revenantPage.js says it is held) while the sworn keep their days.
 *  @param {{ online?: boolean, renown?: number|null }} [o] */
export const revenantHeld = (o) => !renownOpens(REVENANT_MIN_RENOWN, o);
const nowMinutes = () => { try { return Math.floor(ownMinutes()); } catch { return 0; } };
/** Does the sky read night now (TIME1's sky - the world's offline)? */
const skyIsNight = () => { try { return isNight(skyMinutes()); } catch { return false; } };
/** RVN3: ...and day (a daylight weakness bites while it does; no clock, no day). */
const skyIsDay = () => { try { return !isNight(skyMinutes()); } catch { return false; } };
const firstWord = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'stranger';
const pick = (list, rolls) => list[Math.min(list.length - 1, Math.floor(rolls() * list.length))];
// AUDIT (2026-10-02): `{p}'s` the possessive the trophies spell ("Varis' Shadow"); a function replacement, so a `$` in
// a typed name is a letter, never a pattern
const fill = (s, { p = '', n = '', a = '' } = {}) => s.replace(/\{p\}'s/g, () => possessive(p)).replace(/\{p\}/g, () => p).replace(/\{n\}/g, () => n).replace(/\{a\}/g, () => a);   // RVN10: `{a}` the companion felled
const joinName = (given, epithet) => (/^the /.test(epithet) ? `${given} ${epithet}` : `${given}, ${epithet}`);

/** REVENANT-VOICE: the id a special foe's voice is drawn from - its record's, or (a foe that speaks before it is one: it
 *  breaks and runs) one minted on it then and kept, so the revenant it becomes speaks as it already did. */
const voiceIdOf = (entity) => entity?.revenant?.id ?? (entity._voiceId ??= mintCharacterId());
const isU32 = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
/** FB1012d ALLY-RACE (bible/01-Overview/bugs/Field-Bugs-2026-10-12d.md): ITS PERSON - the seed its Morrowind body's race,
 *  face, head, hair and clothes are drawn by (characters/foeBodies.js ownPerson). Minted once, at its birth, off the body
 *  that did the deed (foeSeed: the man the player saw), and kept on the record, so every return, the kneel, the oath, the
 *  sworn one at the player's side and a betrayal are that one person - each stand drew its own off where it stood, and
 *  the one who knelt rose from its portal another race. A record with none kept (an older save's) is its id's. */
export const revenantPerson = (r) => (isU32(r?.person) ? r.person : hashStr(`${r?.id}|person`));
/** RVN2: what a standing revenant carries of its record - its name and rank (FOE-TITLE, TELL's tier), what it learned and
 *  its weakness, and `edge`, what they do (systems/revenant/revenantFeud.js adaptEdge: the brain, the motor, the doors and the
 *  formulas read it there). */
const revenantStamp = (r) => ({ id: r.id, name: r.name, rank: r.rank, learned: [...(r.learned ?? [])], weak: r.weak ?? null, edge: woundedEdge(adaptEdge(r.learned, r.weak), r.wounds), sigBlow: signatureStamp(r), person: revenantPerson(r), dread: r.dread === true });   // UNQUIET: its wounds in its edge (its poise, its saving throws); the Dread   // RVN5: its signature (rank 2 and up); FB1012d ALLY-RACE: its person, every stand

/** A REVENANT'S GIVEN NAME: DFU's own banks - a monster's from Monster1/Monster2, a class foe's (a person) a first
 *  name from one of the eight races' banks - drawn on a stream SEEDED by the revenant's id, the shared DFRandom put
 *  back after, so making a revenant moves nobody's dice and one id is always one name. */
export function revenantGivenName(id, mobileType, gender = 'male') {
  const saved = getSeed();
  try {
    const h = hashStr(String(id));
    srand(h);
    const g = gender === 'female' ? GENDERS.Female : GENDERS.Male;
    let name = '';
    if (isClassEnemyId(mobileType)) {
      const banks = [BANK_TYPES.Breton, BANK_TYPES.Redguard, BANK_TYPES.Nord, BANK_TYPES.DarkElf, BANK_TYPES.HighElf, BANK_TYPES.WoodElf, BANK_TYPES.Khajiit, BANK_TYPES.Imperial];
      name = firstName(banks[h % banks.length], g);
    } else {
      name = monsterName(/** @type {any} */ (g), () => ((h >>> 8) % 2) / 2);
    }
    name = String(name ?? '').trim();
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Nameless';
  } finally { setSeed(saved); }
}

/** A deed's epithet - from rank 3 the risen ones, whatever the deed - never the one it wears now. RVN10: `ally` the
 *  companion it felled (an epithet naming one is passed over without it). */
export function revenantEpithet(deed, rank, playerName, rolls = Math.random, current = null, ally = '') {
  const named = (rank >= 3 ? REVENANT_EPITHETS.risen : (REVENANT_EPITHETS[deed] ?? REVENANT_EPITHETS.slew)).filter((e) => ally || !e.includes('{a}'));
  const p = capFirst(firstWord(playerName));   // a name in a title is a name - "Bane of Stranger"
  const all = named.map((e) => fill(e, { p, a: ally }));
  const choices = all.filter((e) => e !== current);
  return pick(choices.length ? choices : all, rolls);
}

/** The living revenants that hunt the player (the slain kept in their records, `defeated`; the forgotten are tombstones,
 *  `gone`; REVENANT-COMPANION: the sworn walk with the player, and hunt nobody). */
export const livingRevenants = () => _state.list.filter((r) => !r.defeated && !r.gone && !r.sworn);
/** AUDIT UNQUIET (section 49): the living that HUNT the player - every one but the Dread (it waits at home): the cap's count. */
export const huntingRevenants = () => livingRevenants().filter((r) => !r.dread);
/** REVENANT-COMPANION: the revenants sworn to the player - with it, away, or resting. */
export const swornRevenants = () => _state.list.filter((r) => r.sworn && !r.defeated && !r.gone);
/** Every record, the slain too - a journal's page (never a tombstone). */
export const allRevenants = () => _state.list.filter((r) => !r.gone);
/** REVENANT-PAGE: this character's records (the mirror read in first), the slain too - the pause menu's page. */
export function revenantsFor(player) { ensureMirror(player); mendRevenantLairs(); return allRevenants(); }   // LAIR-DOOR: the page names no lair nobody can enter
export const revenantById = (id) => _state.list.find((r) => r.id === id && !r.gone) ?? null;

const isStr = (v) => typeof v === 'string';
const isNum = (v) => Number.isFinite(v);
/** RVN10: a felled companion's name, as a record keeps it - a short name, else none. */
const ALLY_MAX = 40;
const allyName = (v) => (isStr(v) && v.trim() ? v.trim().slice(0, ALLY_MAX) : null);
/** A deed read back: its name and minute, and (RVN10) a felled companion's name. */
const historyOf = (d) => { const ally = allyName(d.ally); return { deed: d.deed, at: d.at, ...(ally ? { ally } : {}), ...(d.deed === 'fled' && d.unbroken === true ? { unbroken: true } : {}) }; };   // RVN12b: an escape unbroken
const FATES = new Set(['executed', 'sworn', 'released']);
/** REVENANT-COMPANION: a sworn one's place read back - the shape checked; anything odd walks with the player whole. */
function sanitizeCompanion(c, personality = null, rank = 1) {
  const errand = c?.state === 'errand' ? sanitizeErrand(c?.errand) : null;   // RVN-ERRAND: abroad only with an errand it can come back from
  const state = c?.state === 'away' || c?.state === 'resting' ? c.state : errand ? 'errand' : c?.state === 'errand' ? 'away' : 'with';
  const hp = Number(c?.health), max = Number(c?.maxHealth);
  return {
    state, health: c?.health != null && Number.isFinite(hp) && hp > 0 ? hp : null, maxHealth: c?.maxHealth != null && Number.isFinite(max) && max > 0 ? max : null,
    until: state === 'resting' && isNum(c?.until) ? c.until : null,
    items: Array.isArray(c?.items) ? c.items.filter((it) => it && typeof it === 'object') : [],
    loyalty: sanitizeLoyalty(c?.loyalty, personality),   // RVN1 (section 26): 0-100, else its personality's start (RVN11's)
    rested: state === 'away' && c?.rested === true,   // RVN11 (22.1): fit again after a rest and not yet called (its call +10)
    sentDay: Number.isInteger(c?.sentDay) && c.sentDay >= 0 ? c.sentDay : null,   // RVN11 (22.1): the day it was last sent away
    gear: sanitizeGear(c?.gear),   // RVN-GEAR: its kit, the known slots alone
    errand,   // RVN-ERRAND: where it is, and when it is back
    worn: state === 'resting' && c?.worn === true,   // AUDIT RVN F6: resting from a road (a hard errand, a recall) - no call bonus after it
    paid: paidOf(c?.paid),   // AUDIT RVN F7, AUDIT RVN-STARS S4: the seeds of the last PAID_KEEP errands its loyalty and XP were paid for
    xp: rvnXpOf(c?.xp),   // RVN-STARS: its level, earned at my side (AUDIT RVN-STARS S12: whole, to the top level's)
    stars: rvnHeldStars(c?.stars, rvnStarPoints(rvnLevelOf(rvnXpOf(c?.xp)), rank)),   // RVN-STARS: its sky through the law, as its level and its rank allow
    lossCarry: Number.isFinite(c?.lossCarry) ? Math.max(-0.999999, Math.min(0, c.lossCarry)) : 0,   // AUDIT RVN-STARS S6: a loss's fraction its oath carries
  };
}
/** AUDIT RVN-STARS S4: how many errands' seeds a record keeps as paid - one seed was paid again after one more errand and a
 *  reload (the mirror's newer `paid`, the save's errand). */
export const PAID_KEEP = 16;
const paidOf = (v) => (Array.isArray(v) ? v : Number.isInteger(v) ? [v] : []).filter((x) => Number.isInteger(x) && x >= 0).map((x) => x >>> 0).slice(-PAID_KEEP);
/** A record read back (a save, the app's storage) - the shape checked, anything else dropped. */
function sanitize(r) {
  if (r && isStr(r.id) && r.id && r.gone === true) return { id: r.id, rev: isNum(r.rev) ? r.rev : 0, gone: true };   // a tombstone: the id and its revision alone
  if (!r || !isStr(r.id) || !r.id || !Number.isInteger(r.mobileType) || !isStr(r.given) || !isStr(r.epithet)) return null;
  const rank = Math.max(1, Math.min(REVENANT_MAX_RANK, Number.isInteger(r.rank) ? r.rank : 1));
  const personality = isPersonality(r.personality) ? r.personality : personalityFor(r.id, r.mobileType);   // REVENANT-VOICE: an older record's, drawn from its id as a new one's is
  // AUDIT UNQUIET (section 49): "the Dread" is the ascended's alone - a living, unsworn record wearing it unascended (a
  // save from before UNQUIET, when it was a risen name) is given a risen one again, drawn from its id
  const epithet = r.epithet === REVENANT_EPITHETS.dread[0] && r.dread !== true && !r.sworn && !r.defeated ? risenFor(r.id) : r.epithet;
  return {
    id: r.id, rev: isNum(r.rev) ? r.rev : 0, mobileType: r.mobileType, gender: r.gender === 'female' ? 'female' : 'male',
    given: r.given, epithet, name: epithet === r.epithet && isStr(r.name) && r.name ? r.name : joinName(r.given, epithet), rank,
    kills: isNum(r.kills) ? r.kills : 0, escapes: isNum(r.escapes) ? r.escapes : 0, returns: isNum(r.returns) ? r.returns : 0,
    trait: isStr(r.trait) && r.trait ? r.trait : null, elite: !!r.elite,
    born: isNum(r.born) ? r.born : 0, dueAt: isNum(r.dueAt) ? r.dueAt : 0,
    out: false, outAt: 0,   // never out across a load: the foe that stood for it is not in a fresh world
    defeated: !!r.defeated, defeatedAt: isNum(r.defeatedAt) ? r.defeatedAt : null,
    notice: isStr(r.notice) ? r.notice : null,
    archive: Number.isInteger(r.archive) ? r.archive : null,
    personality,
    person: revenantPerson(r),   // FB1012d ALLY-RACE: its person kept (an older record's, its id's)
    // REVENANT-FATE: how it ended (or did not) - executed, sworn to the player, released by the player
    fate: FATES.has(r.fate) ? r.fate : null, sworn: !!r.sworn && !r.defeated, swornAt: isNum(r.swornAt) ? r.swornAt : null,
    companion: r.sworn && !r.defeated ? sanitizeCompanion(r.companion, personality, rank) : null,
    history: Array.isArray(r.history) ? r.history.filter((d) => d && isStr(d.deed) && isNum(d.at)).slice(-HISTORY_MAX).map(historyOf) : [],
    ...feudFields(r, { id: r.id, mobileType: r.mobileType, rank }),   // RVN1 (section 26): FEUD's fields, each by its law
    // UNQUIET (section 46): its wounds, its blood since its last rank, and the Dread (rank 5, never sworn)
    wounds: sanitizeWounds(r.wounds), blood: sanitizeBlood(r.blood), tears: sanitizeTears(r.tears), dread: r.dread === true && !r.sworn && rank >= REVENANT_MAX_RANK,
    trail: sanitizeTrail(r.trail), omen: sanitizeTrail(r.omen === undefined ? r.dueAt : r.omen),   // UNQUIET II: its trail's cooling, its omen's due minute (AUDIT UNQUIET: an older record's, its due minute - foretold, so a load is no burst of omens)
    woundDay: Number.isInteger(r.woundDay) && r.woundDay >= 0 ? r.woundDay : -1,   // UNQUIET III: its last wound's day
  };
}
/** AUDIT UNQUIET: a risen epithet with no player's name in it (the save keeps no player's), drawn from `id`. */
function risenFor(id) {
  const plain = REVENANT_EPITHETS.risen.filter((e) => !e.includes('{p}'));
  return plain[hashStr(`${id}|risen`) % plain.length];
}
/** Two lists as one: per id, the higher revision. */
export function mergeRevenants(a, b) {
  const by = new Map();
  for (const r of [...(a ?? []), ...(b ?? [])]) {
    const s = sanitize(r);
    if (!s) continue;
    const had = by.get(s.id);
    if (!had || s.rev > had.rev) by.set(s.id, s);
  }
  return [...by.values()];
}

const storeKey = (id) => `${REVENANT_STORE_PREFIX}${id}`;
/** The character's mirror merged in, once per character (a load, a new character, the first ask). */
function ensureMirror(player) {
  const id = player ? characterIdOf(player) : null;
  if (!id || _state.mirrorId === id) return;
  let kept = [], keptDay = null;
  try { const raw = appStorage()?.getItem(storeKey(id)); if (raw) { const m = JSON.parse(raw); kept = m?.list ?? []; keptDay = sanitizeDay(m?.lastDay); } } catch { /* a bad mirror is no mirror */ }
  const live = _state.list.map((r) => ({ id: r.id, out: r.out, outAt: r.outAt }));
  // AUDIT (2026-10-02): A SWORN ONE'S PACK IS THE SAVE'S. The mirror outlives a load (a revenant remembers), but a pack
  // is inventory: the save's own copy says what is in it (none, where the save never knew it sworn) - else a load handed
  // back the items the save's own pack also held, or lost ones it never had. And one the save holds sworn with a pack,
  // released after it, comes back as the save had it: its pack is no one's to lose.
  const saved = new Map(_state.list.filter((r) => !r.gone).map((r) => [r.id, r]));
  _state.list = mergeRevenants(_state.list, kept);
  _state.lastDay = laterDay(_state.lastDay, keptDay);   // RVN1: festering's day, the later of the two
  for (const l of live) { const r = revenantById(l.id); if (r) { r.out = l.out; r.outAt = l.outAt; } }   // a live stand is this session's, not the mirror's
  for (let i = 0; i < _state.list.length; i++) {
    const r = _state.list[i], s = saved.get(r.id);
    // RVN11b (22.2): and one that deserted since - its pack was split between its record and the player's, who reloaded
    // to before it: it comes back as the save had it. AUDIT FEUD: a betrayal splits it the same (RVN11c); and one
    // forgotten since (the cap, the fallen's prune) comes back so too - its pack is no one's to lose. AUDIT FEUD 2: by
    // any road (its history keeps twelve deeds - a leaving scrolls off), and at the save's OWN revision: a newer save's
    // copy still wins, and the restore leaks into no other save
    if (s?.sworn && s.companion?.items?.length && !r.sworn) { _state.list[i] = { ...s }; continue; }
    if (s?.sworn && gearItems(s.companion?.gear).length && !r.sworn) { _state.list[i] = { ...s }; continue; }   // RVN-GEAR: and its kit - no one's to lose
    if (s?.sworn && s.companion?.state === 'errand' && s.companion.errand && !r.sworn) { _state.list[i] = { ...s }; continue; }   // AUDIT RVN F9: and one abroad in the save - its haul is no one's to lose
    if (!r.gone && r.companion) r.companion.items = s?.companion?.items ? s.companion.items.slice() : [];
    if (!r.gone && r.companion) r.companion.gear = s?.companion?.gear ? { ...s.companion.gear } : {};   // RVN-GEAR: its kit is the save's too (inventory, as its pack)
    // RVN-ERRAND: an errand is the save's as its haul will be - abroad in the save, abroad again (to come back as it would
    // have); begun since the save, never begun (back where the save had it)
    if (!r.gone && r.companion) {
      const sc = s?.sworn ? s.companion : null;
      if (sc?.state === 'errand' && sc.errand) { r.companion.state = 'errand'; r.companion.errand = { ...sc.errand }; }
      else if (r.companion.state === 'errand') { r.companion.state = sc?.state === 'with' ? 'with' : 'away'; r.companion.errand = null; }
    }
    // AUDIT FEUD: what the save's living, unsworn copy held, on a record the mirror has since seen fall or sworn - the fall
    // dropped it, the oath handed it back, and the reloaded pack never had it: mine again. AUDIT FEUD 2: or forgotten since
    if (player && s?.took?.length && !s.defeated && !s.sworn && (r.gone || r.defeated || r.sworn)) { player.items ??= []; for (const it of s.took) addItem(player.items, it); if (!r.gone) r.took = []; continue; }
    if (r.gone) continue;
    r.took = s?.took ? s.took.slice() : [];   // RVN8 (Feud-Arc.md 19): what it took is inventory too - the save's copy wins (the mirror never brings back a piece the save holds)
    // LETTERS-HOME (FIELD BUGS 2026-10-18b): a letter of credit one took before revenantMayTake refused it is mine again -
    // living, fallen with a body that never carried it, or kept by a deserter. The save's copy, so never one its pack holds.
    // STEED-KEPT (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Exclude, and return taken ones"): and EVERY piece it may
    // no longer take - a horse, a cart, a deed, a ship's deed or parts, the spellbook - into my pack, where the game keeps
    // owned transport (DFU's Items.Contains(Transportation, Horse)), each said once the world can say it
    const home = r.took.filter((it) => !revenantMayTake(it));
    if (home.length) { player.items ??= []; for (const it of home) { addItem(player.items, it); hudTextWhenShown(tookHomeLine(r, it)); } r.took = r.took.filter((it) => revenantMayTake(it)); }
  }
  _state.mirrorId = id;
}
function persist() {
  if (!_state.mirrorId) return;
  try { appStorage()?.setItem(storeKey(_state.mirrorId), JSON.stringify({ v: 1, list: _state.list, lastDay: _state.lastDay })); } catch { /* storage full or gone: the save still keeps it */ }
}
const touch = (r) => { r.rev = (r.rev | 0) + 1; };
/** A record forgotten: its place in the list becomes a tombstone (its id and a newer revision), which a merge keeps over
 *  any older copy of the record. */
function bury(r) {
  const i = _state.list.indexOf(r);
  if (i >= 0) _state.list[i] = /** @type {any} */ ({ id: r.id, rev: (r.rev | 0) + 1, gone: true });
}
/** THE LIST KEPT BOUNDED: the newest REVENANT_FALLEN_MAX slain stay on the page, older ones are buried; the oldest
 *  tombstones past REVENANT_TOMBS_MAX go (a save older than two hundred buryings is the one thing that could raise one). */
function prune() {
  const fallen = _state.list.filter((r) => r.defeated && !r.gone).sort((a, b) => (b.defeatedAt ?? 0) - (a.defeatedAt ?? 0));
  for (const r of fallen.slice(REVENANT_FALLEN_MAX)) bury(r);
  const tombs = _state.list.filter((r) => r.gone);
  if (tombs.length > REVENANT_TOMBS_MAX) {
    const drop = new Set(tombs.slice(0, tombs.length - REVENANT_TOMBS_MAX));
    _state.list = _state.list.filter((r) => !drop.has(r));
  }
}
/** Past the cap: the weakest, oldest living one is forgotten - a tombstone, so no older save raises it again - never
 *  `keep` (one just turned from the sworn - RVN11b), one standing in the world, one holding a piece of mine, or the
 *  Dread (UNQUIET: it hunts no one, and is not counted - `huntingRevenants`). A birth never needs it: none is born past
 *  the cap (revenantDeed). */
function trimLiving(keep) {
  const living = huntingRevenants();
  if (living.length > REVENANT_MAX) {
    const drop = living.filter((x) => x !== keep && !x.out && !x.took?.length).sort((x, y) => x.rank - y.rank || x.born - y.born)[0];   // RVN8: never one holding a piece of mine   // AUDIT (2026-10-02): never one standing in the world   // UNQUIET: never the Dread (AUDIT UNQUIET: not among those that hunt - `living` holds none)
    if (drop) bury(drop);
  }
}
const deed = (r, d, at, extra = null) => { r.history.push({ deed: d, at, ...(extra ?? {}) }); if (r.history.length > HISTORY_MAX) r.history.splice(0, r.history.length - HISTORY_MAX); };   // RVN10: a felling names its companion
/** When it is due again - two to four days on, a revenant of VENGEANCE one to two (UNQUIET: its ambition, by `r`'s
 *  personality). */
const dueFrom = (now, rolls, r = null) => {
  const [lo, hi] = r && ambitionOf(r.personality) === 'vengeance' ? AMBITION.VENGEANCE_DUE : [REVENANT_RETURN_MIN_MINUTES, REVENANT_RETURN_MAX_MINUTES];
  return now + lo + Math.floor(rolls() * (hi - lo + 1));
};

// ── who may become one ──────────────────────────────────────────────
/** A foe that may become (or stay) a revenant: special (an elite, a champion, a revenant already), of the floor's level,
 *  never the watch or an ally; `rec` the pool's record when there is one - never a quest's foe, a summons, or another
 *  client's foe. UNQUIET: one not yet a revenant only with THE MARK, while fewer than REVENANT_MAX hunt the player. */
export function revenantCandidate(entity, rec = null) {
  if (!entity || !revenantOn()) return false;
  if (revenantHeld()) return false;   // RENOWN-GATE: held - none made, none runs (a flight that could make no revenant would only rob a kill), no ledger kept
  if (entity.retinueOf != null) return false;   // RVN6 (Feud-Arc.md 17): a band's follower is its master's, never one itself
  if (entity.wildFoe || entity.wildGiant) return false;   // PVPDUNGEONS (the owner: "No elite or any monster in the zone can be a revenant")
  if (entity.bout) return false;   // AUDIT ARENA-LADDER 2: a fighter on the sand is its bout's - an elite champion never flees it as a revenant, nor becomes one
  const special = !!entity.revenant || !!entity.eliteFoe || (typeof entity.champion === 'string' && !!entity.champion);
  if (!special) return false;
  // UNQUIET (section 46): a foe not yet a revenant rises only with THE MARK (unquietMark.js), and only while fewer than
  // REVENANT_MAX hunt the player - every other elite and champion dies where it falls, whatever it does (the deed asks
  // again of a body that wears a name not mine - revenantDeed)
  if (!entity.revenant && (!isUnquiet(entity) || huntingRevenants().length >= REVENANT_MAX)) return false;
  if ((entity.level | 0) < REVENANT_MIN_LEVEL) return false;
  if (entity.mobileType === KNIGHT_CITY_WATCH || entity.team === 'PlayerAlly' || entity.mobileTeam === 'PlayerAlly') return false;
  if (rec && (rec.questBehaviour || rec.allied || rec.questMarker || rec.puppet || rec.riteRole)) return false;   // AUDIT UNQUIET: never another client's foe - its owner's; nor a rite's faithful (scenes/riteHost.js - an escaped Summoner left its rite unbroken for good)
  return true;
}
// UNQUIET (section 46): THE MARK's gate (systems/revenant/unquietMark.js) - drawn only with the arc on, not held, room for
// another (fewer than REVENANT_MAX living), and on a foe that could ever rise (revenantCandidate's own exclusions)
setUnquietGate((entity) => revenantOn() && !revenantHeld() && huntingRevenants().length < REVENANT_MAX
  && !!entity && !entity.revenant && entity.retinueOf == null && !entity.wildFoe && !entity.wildGiant && !entity.bout
  && (entity.level | 0) >= REVENANT_MIN_LEVEL && entity.mobileType !== KNIGHT_CITY_WATCH && entity.team !== 'PlayerAlly' && entity.mobileTeam !== 'PlayerAlly');

// ── the deeds ───────────────────────────────────────────────────────
/** Make `entity` a revenant for what it just did (`deed` 'slew' or 'fled'), or rank up the one it already is. Answers
 *  the record, or null when it may not be one. `mobileType`/`gender` from the pool's record where the entity lacks
 *  them. */
export function revenantDeed(player, entity, deedName, { mobileType = entity?.mobileType, gender = 'male', rec = null, archive = null, now = nowMinutes(), rolls = Math.random, ally = null, unbroken = false, slip = false } = {}) {   // RVN10: `ally` the companion a felling knocked out; RVN12b: `unbroken` - its will held at the killing blow (RVN3's tear-away); AUDIT UNQUIET: `slip` - it slipped away from the choice
  if (revenantStale(entity)) return null;   // LAIR-HOME (AUDIT FB1019 C2): a body its revenant left does nothing in its name - nor takes its registry back
  // RVN1: the fight is over - its ledger taken whatever the answer (it dies with the fight). AUDIT FEUD: but a felling
  // is no end - the foe fights on, its will read from that ledger (RVN3): it stays whole for the deed that ends the fight
  const ledger = deedName === 'felled' ? null : takeFeud(entity);
  ensureMirror(player);   // AUDIT UNQUIET: the mirror read in before the cap is counted
  mendRevenantLairs();   // AUDIT FB1022d B3: a lair nobody can enter moved as every reader moves it - known as it was - before the deed reads it
  if (!revenantCandidate(entity, rec) || !Number.isInteger(mobileType)) return null;
  const pName = player?.name ?? '';
  let r = entity.revenant?.id ? revenantById(entity.revenant.id) : null;
  // AUDIT (2026-10-02): a judged one - executed, released, sworn - does no deed (a poison of its own finishing the player
  // after it knelt raised it again, under its own id); and a forgotten one's id is never worn again
  if (r && (r.defeated || r.sworn)) return null;
  if (!r && entity.revenant?.id) entity.revenant = null;
  // AUDIT UNQUIET (section 49): A BIRTH is the mark's and the cap's, asked here of the body itself - one wearing a name not
  // mine (a peer's puppet, its owner's revenant; a forgotten one) passed revenantCandidate as "a revenant already", and
  // its kill made a fourth past the cap
  if (!r && (!isUnquiet(entity) || huntingRevenants().length >= REVENANT_MAX)) return null;
  // UNQUIET (section 46): RANKED BY SURVIVING - an existing revenant climbs at every getting-away (revenantUnquiet.js
  // SURVIVING_DEEDS) and at every BLOOD_RANK-th kill of me or companion felled (`blood`, since its last rank); it was
  // every deed after the first
  let rankUp = false;
  const born = !r;
  if (r) {
    if (BLOOD_DEEDS.includes(deedName)) r.blood = (r.blood | 0) + 1;
    if (deedName === 'fled' && unbroken) r.tears = (r.tears | 0) + 1;   // AUDIT UNQUIET: its will's tear-away, counted as blood is
    rankUp = deedRanks(deedName, r.blood, { unbroken, tears: r.tears });
  } else {
    const id = voiceIdOf(entity);   // REVENANT-VOICE: the id its voice was drawn from while it fled, if it spoke before it was one
    const given = revenantGivenName(id, mobileType, gender);
    r = {
      id, rev: 0, mobileType, gender: gender === 'female' ? 'female' : 'male', given,
      epithet: revenantEpithet(deedName, 1, pName, rolls, null, allyName(ally) ?? ''), name: '', rank: 1, kills: 0, escapes: 0, returns: 0,
      trait: typeof entity.champion === 'string' && entity.champion ? entity.champion : null, elite: !!entity.eliteFoe,
      born: now, dueAt: 0, out: false, outAt: 0, defeated: false, defeatedAt: null, notice: null, history: [],
      archive: Number.isInteger(archive) ? archive : null,   // REVENANT-CARD: the sprite it wore (a retextured kind's own), for its portrait
      personality: personalityFor(id, mobileType),   // REVENANT-VOICE: who it is - one per id
      fate: null, sworn: false, swornAt: null, companion: null,   // REVENANT-FATE: not judged yet
      person: rec ? foeSeed(rec) : revenantPerson({ id }),   // FB1012d ALLY-RACE: the body it did the deed in is the person it stays
      ...newFeudFields(id, mobileType, 1, entity.career ?? null),   // RVN1 (section 26): its draws (the weakness never what its career shrugs off), and nothing yet learned
      wounds: [], blood: 0, tears: 0, dread: false, trail: 0, omen: 0, woundDay: -1,   // UNQUIET: nothing left on it yet, no blood or tear-away since a rank, not the Dread; no trail, no omen, no wound to heal
    };
    _state.list.push(r);
  }
  // RVN7 (18.1): ITS LAIR - where the deed was done says where it goes to ground (the host's door: its map pixel and the
  // dungeons in reach, or the dungeon it is in); a lair moved is a lair the player has not heard of. UNQUIET: asked before
  // its rank - the Dread goes to ground in it
  // UNQUIET III (section 48): one that got away in the open goes to ground in the NEAREST den in reach (its trail leads there)
  const here = playerDoor()?.lairHere?.() ?? null;
  const den = deedName === 'fled' && !r.dread && here ? nearestLair(here.px, here.py, here.dungeons) : null;
  const lair = den ?? lairAfter(r, here);   // underground: no map pixel - the lair's own law (that dungeon)
  if (!sameLair(lair, r.lair)) { r.lair = lair; r.lairKnown = false; }
  let ascended = false;
  if (!born && rankUp) {
    r.blood = 0; r.tears = 0;
    if (r.rank < REVENANT_MAX_RANK) {
      r.rank += 1;
      r.epithet = revenantEpithet(deedName, r.rank, pName, rolls, r.epithet, allyName(ally) ?? '');
      if (r.rank >= SIG_RANK && !r.sig) r.sig = drawSignature(r.id, r.mobileType);   // RVN1 (RVN5's field): its signature, drawn on its id at rank 2
    } else if (deedName === 'fled' && !slip && mayAscend(r, REVENANT_MAX_RANK, livingRevenants().filter((x) => x.dread).length)) {
      // UNQUIET: THE DREAD - a rank-5 revenant that got away once more goes to ground in its lair for good, and every town
      // knows where (revenantToReturn never stands it on the road again; revenantForLair always finds it at home).
      // AUDIT UNQUIET: never by a slip from the choice (the player held it beaten), and one Dread at a time (DREAD.MAX)
      r.dread = true; r.lairKnown = true; r.wrath = 0;
      r.epithet = REVENANT_EPITHETS.dread[0];
      ascended = true;
    }
  }
  r.name = joinName(r.given, r.epithet);
  if (deedName === 'slew') { r.kills++; r.notice = 'slew'; _lastSlew = { id: r.id, at: Date.now() }; } else if (deedName === 'fled') { r.escapes++; r.notice = null; }   // RVN8: this death's killer, for the respawn   // RVN10: a felling or a rout is no escape of its own (AUDIT FEUD: nor clears the card a kill left waiting)
  r.dueAt = dueFrom(now, rolls, r);   // UNQUIET: a revenant of vengeance sooner
  deed(r, deedName, now, deedName === 'felled' && allyName(ally) ? { ally: allyName(ally) } : deedName === 'fled' && unbroken ? { unbroken: true } : null);
  if (ascended) deed(r, 'ascended', now);
  // UNQUIET: A WOUND - every getting-away keeps one by the blow that broke it (its ledger's last), the oldest healing
  if (deedName === 'fled') { const w = woundOf(ledger?.last); if (w) { r.wounds = withWound(r.wounds, w); r.woundDay = Math.floor(now / MINUTES_PER_DAY); _newWounds.set(r.id, w); } else _newWounds.delete(r.id); }   // UNQUIET III: its healing counted from the day; AUDIT UNQUIET: none left, none told (an older escape's wound named on this one's card)
  // UNQUIET II (section 47): THE TRAIL - a getting-away with a lair to go to leaves it warm: its lair known at once, and
  // found there before HUNT.MINUTES it is still wounded (applyRevenant). Never the Dread's - it is at home for good.
  // AUDIT UNQUIET: only to the den this escape went to ground in (`den` - in the open, a dungeon in reach): one in a
  // dungeon stays in it (its lair the dungeon it is in - re-entered at once, it was found weakened, again and again), and
  // one with no den in reach leaves no trail to a far lair
  if (den && !r.dread) { r.trail = now + HUNT.MINUTES; r.lairKnown = true; }
  // RVN1 (section 12): the fight folded into its SCARS - its leading source, its lessons, the deed - and counted
  const kinds = feudScars(ledger, deedName);
  r.scars = withScars(r.scars, kinds, now);
  r.fights = (r.fights | 0) + 1;
  // RVN2 (13.1): and one lesson LEARNED of it - at most its rank's adaptations, the oldest forgotten
  const lesson = lessonOf(kinds, r.learned, r.mobileType, entity.career ?? null);
  if (lesson) r.learned = withLesson(r.learned, lesson, r.rank);
  // the foe that did it wears its name at once - while it still stands (a killer over my body), it IS the revenant
  const p2 = entity.revenant?.p2 ?? null;   // AUDIT FEUD 2: a felling in its last stand keeps the stand's phase two
  const blows = entity.revenant?.blows ?? null;   // FEUD WIRE: and the stand's blows it still strikes with
  entity.revenant = revenantStamp(r);   // RVN2: and what it learned, at once
  if (p2) entity.revenant.p2 = p2;
  if (blows) entity.revenant.blows = blows;
  computeEntityMods(entity);
  r.out = deedName === 'slew' || deedName === 'felled';   // RVN10 (21.1): a felling foe still stands, as a killer over my body does
  r.outAt = r.out ? Date.now() : 0;
  bodyStood(r, r.out ? entity : null);   // LAIR-HOME: the foe still standing is its body now; one that got away or was run from leaves none
  touch(r);
  prune();
  persist();
  return r;
}

/** UNQUIET: the wound an escape just left, for its card (this session's; a reload's card says less). */
const _newWounds = new Map();
/** THE KILL. A killing BLOW names its foe (the struck seam's attacker, systems/sigil/sigilSetPowers.js's landed blow); a
 *  death no blow names - a spell's burn, a lingering effect's round, a poison's tick (REVENANT-HARM) - goes to the foe
 *  whose harm last reached the player (systems/harmMark.js). Either is confirmed once the hurt is done (a microtask
 *  after it): a death a Stendarr's mercy undoes made nobody a revenant. */
let _blowKiller = null;
let _deathCheck = false;
function armDeathCheck(entity) {
  if (_deathCheck) return;
  _deathCheck = true;
  Promise.resolve().then(() => {
    _deathCheck = false;
    const killer = _blowKiller ?? playerHarmMark();
    _blowKiller = null;
    if (!(entity.health <= 0) || !killer || killer.isPlayer || !(killer.health > 0)) return;   // a foe I slew is no revenant - a fall after the fight names nobody dead
    const rec = playerDoor()?.foes?.()?.find((x) => x?.entity === killer) ?? null;
    if (rec && (rec.yielded || rec.executing || rec.sparing)) return;   // AUDIT (2026-10-02): a beaten one kneeling claims no kill
    clearPlayerHarm();   // answered: a second death (a Resurrect's, a fall) is not this foe's again
    revenantDeed(entity, killer, 'slew', { mobileType: rec?.mobileType ?? killer.mobileType, gender: rec?.gender ?? 'male', rec, archive: rec?.archive ?? rec?.mobileArchive ?? null });
  });
}
function onBlowLanded(entity, attacker) {
  if (!entity?.isPlayer || entity.peer || !(entity.health <= 0) || !attacker || attacker.isPlayer) return;
  _blowKiller = attacker;
  armDeathCheck(entity);
}
function onPlayerHurt(entity, { after } = /** @type {any} */ ({})) {
  if (!entity?.isPlayer || entity.peer) return;
  // RVN10 (Feud-Arc.md 21.2): a hurt that left me under half is my fights' low; my death ends every fight (no rout after it)
  if (after <= 0) endPlayerFights(); else if (after < (entity.maxHealth || 1) * ROUT.LOW) markPlayerLow();
  if (!(after <= 0)) return;
  armDeathCheck(entity);
}
registerPlayerBlowLanded('revenant', onBlowLanded);
registerPlayerHurtListener('revenant', onPlayerHurt);
registerPlayerStruckListener('revenant', (attacker, target) => {
  if (target?.isPlayer && !target.peer && attacker && !attacker.isPlayer) markPlayerHarm(attacker, { ms: HARM_MARK_STRUCK_MS });
});
// RVN1 (section 12): THE LEDGER OF WOUNDS - a body that may be (or is) a revenant keeps one while I fight it; my landed
// blow and arrow go in it at the formulas' tail (their final damage, by the weapon's class; silver by its metal; a
// backstab), my spells at their landing (scenes/hostMagic.js) and every later round (systems/effects.js), the brain's
// overreach and the doors' staggers and back hits beside them. The deed folds it (revenantDeed).
setFeudGate((entity) => revenantCandidate(entity));
setFeudClock(() => ({ now: nowMinutes(), night: skyIsNight() }));
registerPlayerStrikeListener('feud', (attacker, target, damage, weapon, info) => {
  const { cls, silver } = weaponFeudClass(weapon);
  noteFeudHarm(target, cls, damage, { silver, metal: metalOf(weapon) });   // RVN3: its metal, for a metal weakness
  if (info?.backstab) noteFeudBackstab(target);
});
// RVN3 (section 14.1): ITS WEAKNESS - a blow of it, as the ledger's writers know it ({ cls, metal }) or a door does
// ({ kind, weapon, element, attacker }); the daylight's every blow while the sky reads day
setFeudWeakTest((entity, { cls = null, metal = null, kind = 'melee', weapon = null, element = null, attacker = null } = {}) => {
  const weak = entity?.revenant?.weak;
  if (!weak) return false;
  const c = cls ?? (kind === 'spell' ? (element != null ? elementFeudClass(element) : null) : adaptBlowClass(attacker, weapon, kind));
  return isWeakBlow(weak, c, metal ?? metalOf(weapon), skyIsDay());
}, revealWeakness);
/** RVN3: my blow of its weakness - the "Weakness" word on its number (each blow), and once a stand the hiss and, the
 *  first time it is found, the record's `weakKnown` 2 and its card. */
function revealWeakness(entity, { peer = false } = {}) {
  // after the number the blow raises - my own blow's (AUDIT FEUD 2: a peer's raises none here, and its word is its screen's)
  if (!peer) Promise.resolve().then(() => { try { tagHit(entity, HIT_TAGS.weakness); } catch { /* no numbers mounted */ } });
  if (entity._weakTold) return;
  entity._weakTold = true;
  const door = playerDoor();
  const at = door?.foes?.()?.find((f) => f?.entity === entity)?.ai?.feet ?? null;
  if (at) { try { door?.sfx?.(SOUND.Burning, at); } catch { /* a host with no sound */ } }
  const r = entity.revenant?.id ? revenantById(entity.revenant.id) : null;
  if (!r || r.weakKnown >= 2) return;
  r.weakKnown = 2;
  touch(r);
  persist();
  sayRevenant(revenantWeaknessEvent(r, { found: true }), (l) => door?.say?.(l));
}
// RVN2 (section 13.2): WHAT IT LEARNED, on every blow it takes - a weapon class through the target's registry (the
// formulas' tail and a spell's landing read it; a spell weighs by its element, below), never below x0.6, and never a
// blow of its weakness (RVN3: that is x1.5, ahead of every adaptation)
registerBlowTakenMod('revenant', (attacker, target, weapon, info) => {
  const edge = target?.revenant?.edge;
  if (!edge) return 1;
  // RVN3 (14.1): its weakness - the daylight's on every blow by day (spells too), a class's or a metal's x1.5; an
  // element's is the fold's, below
  if (edge.weak === 'daylight') { if (skyIsDay()) return WEAK.DAYLIGHT; }
  else if (info?.kind !== 'spell' && feudWeakBlow(target, { kind: info?.kind ?? 'melee', weapon, attacker })) return WEAK.STRUCK;
  if (info?.kind === 'spell') return 1;
  return edge.taken[adaptBlowClass(attacker, weapon, info?.kind)] ?? 1;
});
// ...an element on its saving throw (+25, DFU's own Resistant - never immunity: ADAPT.RESIST)
registerEntityFold('revenant', (entity) => {
  const edge = entity?.revenant?.edge;
  const weakEl = edge && WEAKNESS_ELEMENTS.includes(edge.weak) ? edge.weak : null;   // RVN3: its element weakness, -50
  if (!edge || (!Object.keys(edge.resist).length && !weakEl)) return EMPTY_MODS;
  const m = newMods();
  Object.assign(m.resist, edge.resist);
  if (weakEl) m.resist[weakEl] = (m.resist[weakEl] ?? 0) + WEAK.RESIST;
  return m;
});
// ...and a Silver-scarred one's silver double gone (both cores ask, formulas.js silverDoubles)
registerSilverDoubleVeto('revenant', (target) => target?.revenant?.edge?.silverScarred === true);

/** FLIGHT-FIRST: a revenant under its will's rank - its flight its one way out (the line and the roll below). */
const youngRevenant = (entity) => !!entity?.revenant && !willMatters(entity.revenant.rank);
/** THE FLEE ROLL: does this special foe, under its line for the first time, run? UNQUIET (section 46): a marked foe on
 *  REVENANT_FLEE_CHANCE (the only one not yet a revenant that may - revenantCandidate); the Dread never - it is at home. */
export function rollRevenantFlee(entity, rolls = Math.random) {
  if (!revenantCandidate(entity) || entity.revenant?.dread) return false;
  return rolls() < (!entity.revenant ? REVENANT_FLEE_CHANCE : youngRevenant(entity) ? REVENANT_FLEE_CHANCE_YOUNG : REVENANT_FLEE_CHANCE_REVENANT);
}
/** Under the line? (a foe's own share of its health - a young revenant's and, UNQUIET, a marked foe's higher,
 *  FLIGHT-FIRST's; a dead one never) */
export const revenantFleeHealth = (entity) => !!entity && entity.health > 0 && entity.health < (entity.maxHealth || 1) * (!entity.revenant || youngRevenant(entity) ? REVENANT_FLEE_HEALTH_YOUNG : REVENANT_FLEE_HEALTH);

/**
 * THE FLEE, ONE LAW FOR EVERY POOL (scenes/exteriorFoes.js, scenes/dungeonContext.js): one frame of a foe record
 * `f` ({ entity, ai, fleeing?, _fleeRolled? }) against the player's feet. Answers what the host does now:
 *   'start'    - it breaks and runs (the motor's flee, characters/enemy/enemyMotor.js) - say it; no blow, no cast; its walk drawn
 *   'run'      - still running: no blow, no cast; its walk drawn
 *   'escape'   - out of reach (REVENANT_ESCAPE_DISTANCE off, or its run spent past REVENANT_ESCAPE_NEAR): retire it - no
 *                corpse, no kill - and make it a revenant (revenantDeed 'fled')
 *   'cornered' - its run spent with the player close behind: it turns and fights to the end (it never runs again) - say it
 *   null       - nothing: it fights on as ever
 * `onMe()` - whether it fights the player (asked only when it might run); `mayRun` - the host's word that the foe is the
 * player's alone (a room's shared foe never runs: vanishing on one client would leave it standing on the rest).
 * UNQUIET (section 46): from revenantUnquiet.js CRAFT.RANK a revenant breaks away in its own way (`f._craft`) - a bolt
 * at its craft's pace, smoke about it, a blink or a sink through to 'escape' when its body is gone, a sink struck
 * 'cornered'; the distance's verdicts wait while a blink fades or a sink goes under. `now` ms (the wall's); `dt` s, the
 * pool's frame - the craft's clock (without it, the wall's). AUDIT UNQUIET: a flight that can no longer make a
 * revenant (`revenantCandidate`) is 'cornered'.
 */
export function revenantFleeStep(f, feet, { onMe = () => true, mayRun = true, rolls = Math.random, now = Date.now(), dt = null } = {}) {
  if (f.fleeing) {
    // AUDIT UNQUIET (section 49): a flight that can make no revenant any more (the cap filled behind it, the page held)
    // turns and fights - its escape would only take a kill away
    if (!revenantCandidate(f.entity, f)) { f.fleeing = false; if (f.ai) f.ai.fleeLeft = 0; endCraft(f); return 'cornered'; }
    if (f._craft) {
      const v = craftStep(f, now, dt);   // AUDIT UNQUIET: on the pool's clock (`dt`, s)
      if (v === 'gone') { if (f.ai) f.ai.fleeLeft = 0; return 'escape'; }
      if (v === 'broken') { f.fleeing = false; if (f.ai) f.ai.fleeLeft = 0; return 'cornered'; }
      if (f._craft.kind === 'run' && f.ai) f.ai.fleePace = REVENANT_FLEE_PACE;   // a blink put down (held, or struck as it faded) runs plain
      if (f._craft.kind === 'sink' || (f._craft.kind === 'blink' && f._craft.fired)) return 'run';
    }
    const d = Math.hypot(feet[0] - f.ai.feet[0], feet[2] - f.ai.feet[2]);
    if (d > REVENANT_ESCAPE_DISTANCE) return 'escape';
    if (f.ai.fleeLeft > 0) return 'run';
    if (d > REVENANT_ESCAPE_NEAR) return 'escape';
    f.fleeing = false;
    return 'cornered';
  }
  if (!mayRun || f._fleeRolled || !f.ai?.isHostile || !revenantFleeHealth(f.entity) || !onMe() || !revenantCandidate(f.entity, f)) return null;
  f._fleeRolled = true;
  if (!rollRevenantFlee(f.entity, rolls)) return null;
  f.fleeing = true;
  const craft = f.entity.revenant ? revenantCraft(f.entity.mobileType ?? f.mobileType, f.entity.revenant.rank) : null;   // UNQUIET: its flight craft, from CRAFT.RANK
  f.ai.flee(feet, REVENANT_FLEE_SECONDS, f.entity.revenant ? craftPace(craft, REVENANT_FLEE_PACE) : REVENANT_FLEE_PACE_MARKED);   // FLIGHT-FIRST: running for its life (UNQUIET: a bolt faster, a blinker standing to its rift, a sink standing to go under; AUDIT UNQUIET: a marked foe a bolt's)
  if (craft) beginCraft(f, craft, { now });
  return 'start';
}

/** Slain: the record is closed. Answers the record (its name for the line), or null for no revenant. */
export function revenantSlain(player, entity, { now = nowMinutes(), deedName = 'fell' } = {}) {
  const id = entity?.revenant?.id;
  if (!id || revenantStale(entity)) return null;   // LAIR-HOME (AUDIT FB1019 C2): a left body's fall is none of its revenant's
  ensureMirror(player);
  const r = revenantById(id);
  if (!r || r.defeated || r.sworn) return null;   // REVENANT-COMPANION: a sworn one's fall is a knock-out, never this
  r.defeated = true; r.defeatedAt = now; r.out = false; r.notice = null;
  _bodies.delete(r.id); _claims.delete(r.id);   // LAIR-HOME: no body left to keep
  if (entity._tookCarried) r.took = [];   // RVN8: what it took is in its body (executed: in its pile) - the player's again
  deed(r, deedName, now);
  touch(r);
  prune();
  persist();
  return r;
}

// ── REVENANT-FATE: beaten, it yields; judged, it dies or is sworn ─────────────
/** It yields - beaten, held at the edge of death, its fate the player's (a deed of its record). Answers the record. */
export function revenantYielded(player, entity, { now = nowMinutes() } = {}) {
  const r = entity?.revenant?.id && !revenantStale(entity) ? (ensureMirror(player), revenantById(entity.revenant.id)) : null;   // LAIR-HOME (AUDIT FB1019 C2)
  if (!r || r.defeated || r.sworn) return null;
  deed(r, 'yielded', now);
  touch(r);
  persist();
  return r;
}
/** EXECUTED: the player destroyed it - its record closed for good, as a slaying is, its fate written. */
export function revenantExecuted(player, entity, { now = nowMinutes() } = {}) {
  const r = revenantSlain(player, entity, { now, deedName: 'executed' });
  if (r) { r.fate = 'executed'; touch(r); persist(); }
  return r;
}
/** SPARED: sworn to the player - it hunts nobody now; REVENANT-COMPANION keeps it (`state` where it stands). */
export function revenantSpared(player, entity, { now = nowMinutes(), state = 'with', health = null, maxHealth = null } = {}) {
  const r = entity?.revenant?.id && !revenantStale(entity) ? (ensureMirror(player), revenantById(entity.revenant.id)) : null;   // LAIR-HOME (AUDIT FB1019 C2)
  if (!r || r.defeated || r.sworn) return null;
  r.sworn = true; r.fate = 'sworn'; r.swornAt = now; r.out = false; r.notice = null;
  r.dread = false;   // UNQUIET: sworn, the Dread is home no longer - it walks with me
  r.companion = sanitizeCompanion({ state, health, maxHealth }, r.personality, r.rank);   // RVN1: sworn at its personality's loyalty - RVN-STARS: and its rank's stars to set
  deed(r, 'spared', now);
  touch(r);
  persist();
  return r;
}
/** REVENANT-COMPANION: change a sworn one's record (its place, its health, its pack) - kept at once, both places. A
 *  `release` ends it: released, it is gone from the player's side for good (the page's Fallen remembers it). */
export function revenantCompanionUpdate(player, id, change) {
  ensureMirror(player);
  const r = revenantById(id);
  if (!r || !r.sworn || r.defeated) return null;
  r.companion ??= sanitizeCompanion(null, r.personality, r.rank);
  const out = change(r.companion, r);
  if (out === 'release') {
    r.sworn = false; r.fate = 'released'; r.defeated = true; r.defeatedAt = nowMinutes(); r.companion = null;
    deed(r, 'released', nowMinutes());
  }
  touch(r);
  prune();
  persist();
  return r;
}
/** REVENANT-COMPANION: the save's word changed under a live party (a load) - read the record afresh. */
export const revenantRecord = (player, id) => { ensureMirror(player); return revenantById(id); };

// ── LAIR-HOME: one revenant, one body ──────────────────────────────
/** LAIR-HOME (FIELD BUGS 2026-10-19, bible/01-Overview/bugs/Field-Bugs-2026-10-19.md): EACH REVENANT'S BODY - the entity
 *  its latest stand put it in (applyRevenant), or the foe still standing after its deed (revenantDeed: a killer over my
 *  body, a felling foe). One revenant, one body: a body that is not its record's latest is STALE - it went home, or a
 *  later stand took its place - and its pool withdraws it (revenantStale). This session's, never saved: a load stands no
 *  body. */
const _bodies = new Map();
/** AUDIT FB1019 (C1): THE BODIES A REVENANT HAS LEFT - stale for good. Staleness read off the registry alone ended with
 *  its entry: the lair's body slain, fled from or routed, the road's body it had left stood on as the revenant again (its
 *  loot twice, its escapes counted twice, a third body on the road). A body once left stays left. */
let _left = new WeakSet();
/** The claims not yet stood (a lair's, a road's), by id: whether it was out before the claim, and since when - a stand
 *  that stood nobody gives back exactly that (releaseRevenantStand). A body stood ends its claim. */
const _claims = new Map();
/** `entity` is `r`'s body now - or, `entity` null, it has none standing (it got away, I ran from it). */
function bodyStood(r, entity) {
  if (!r?.id) return;
  const was = _bodies.get(r.id);
  if (was && entity && was !== entity) _left.add(was);   // AUDIT FB1019 (C1): the body a later one replaces is left for good
  if (entity) { _bodies.set(r.id, entity); _left.delete(entity); } else _bodies.delete(r.id);
  _claims.delete(r.id);
}
/** LAIR-HOME (AUDIT FB1019): a load or a new game stands no body and keeps no claim. */
function forgetBodies() { _bodies.clear(); _claims.clear(); _left = new WeakSet(); }
function claim(r, wall = Date.now()) {
  if (!_claims.has(r.id)) _claims.set(r.id, { out: !!r.out, outAt: r.outAt || 0 });   // a claim over one never stood keeps what was before it
  r.out = true;
  r.outAt = wall;
}
/** LAIR-HOME: is `entity` a revenant body its record has left - a later stand stood it elsewhere (AUDIT FB1019 C1: for
 *  good, whatever comes of that later body)? Never a sworn one's (a companion is its own law), never a body this session
 *  does not know. Its pool withdraws a stale body, and its band; it does no deed in its revenant's name. */
export function revenantStale(entity) {
  const s = entity?.revenant;
  return !!s?.id && !s.sworn && _left.has(entity);
}
/** LAIR-HOME: may a revenant that is OUT be at home when I enter its lair? Its body stands somewhere else - the road's
 *  return, a killer over my body - and it goes home, the lair standing it and the body it leaves gone stale, UNLESS that
 *  body is here already (in `foes`, the lair's own pool - a stand here this visit), is in a fight with me (its harm reached me within the fight's window,
 *  harmMark.js harmFightSince - it is at the door behind me; AUDIT FB1019 C3: or mine on it, its feud ledger open - a
 *  beaten one chased home is never made whole by its lair), kneels awaiting my judgement (its last deed `yielded`), or
 *  has not stood up yet (a claim pending, within REVENANT_STAND_GRACE_MS - past it, a stand that never came). */
function goesHome(r, wall, foes) {
  const b = _bodies.get(r.id) ?? null;
  if (_claims.has(r.id) || !b) return wall - (r.outAt || 0) >= REVENANT_STAND_GRACE_MS;
  if ((foes ?? []).some((f) => f && !f.dead && f.entity === b)) return false;
  if (harmFightSince(b, wall) != null || feudOf(b, false)) return false;
  return r.history?.[r.history.length - 1]?.deed !== 'yielded';
}

// ── the return ──────────────────────────────────────────────────────
/** An open-world encounter roll's question: does a revenant come instead? The one due (its time come, none of the
 *  character's out in the world already), the highest rank first, on REVENANT_RETURN_CHANCE. Answers the record, or null. */
export function revenantToReturn(player, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!revenantOn() || wildHere()) return null;   // PVPDUNGEONS: none returns in the open zone
  if (revenantHeld()) return null;   // RENOWN-GATE: held - none returns, and none is claimed
  ensureMirror(player);
  const living = livingRevenants();
  if (living.some((r) => r.out)) return null;
  const night = skyIsNight();
  const due = living.filter((r) => !r.dread && r.dueAt <= now && (night || !(r.learned ?? []).includes('nightStalker'))).sort((a, b) => b.rank - a.rank || a.dueAt - b.dueAt);   // RVN2: a Night-stalker comes only by night   // UNQUIET: the Dread never comes on the road - it waits in its lair
  if (!due.length || rolls() >= (ambitionOf(due[0].personality) === 'vengeance' ? AMBITION.VENGEANCE_RETURN : REVENANT_RETURN_CHANCE)) return null;   // UNQUIET: a revenant of vengeance takes more of the rolls
  // CLAIMED from here: its stand crosses awaits (the career's bytes, the sprite) and the next roll must not stand it twice
  claim(due[0]);
  return due[0];
}
// ── RVN8: what it takes (bible/12-Enhanced-AI/Feud-Arc.md 19) ─────────────────────────────────────────────────────
/** This death's killer, by the slew deed - taken (once) at the respawn; AUDIT FEUD: forgotten by a rise that is none
 *  (a Resurrect - forgetLastSlew), a load and a new game. */
let _lastSlew = null;
/** AUDIT FEUD: a rise where I fell (a party member's Resurrect) - no respawn, so its killer takes nothing then or later. */
export function forgetLastSlew() { _lastSlew = null; }
/** RVN8 (19): may it take `item` - never a quest item, a summoned piece, the Materials Bag, gold, or a locked piece
 *  (LOCK1's promise, "A LOCKED PIECE STAYS YOURS"); AUDIT 625 W2: nor a PACK-ONLY piece (systems/item/itemBound.js - the
 *  Wallet's row): what it takes leaves the pack for its record, one that escapes keeps it, and a character is given its
 *  wallet once. LETTERS-HOME (FIELD BUGS 2026-10-18b): nor a LETTER OF CREDIT - a letter is gold (its `value` is the
 *  gold it stands for), and "gold" was the coin alone, so a 500,000-gold letter was the pack's most valuable piece and
 *  the likeliest drawn. STEED-KEPT (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Exclude, and return taken ones"):
 *  nor what never changes hands, as the open zone's death reads it (wildDropLaw.js wildCanLose) - A VEHICLE (the zone's
 *  own groups, WILD_NEVER_GROUPS: a horse, a cart), A DEED (those groups' Deeds, and the decor's kept-back list,
 *  decorLaw.js DECOR_OWN_KEPT_BACK - a house's or a ship's deed as Daggerfall files them, and the spellbook with them:
 *  "Your spellbook never leaves you", KEEP-SPELLBOOK), or A SHIP'S DEED OR PARTS (Come Sail Away's own two,
 *  realmTradeLaw.js BOAT_TEMPLATES - a deed handed on is a second boat): a stable's horse beside a worn longsword was drawn
 *  one death in six. A BOUND piece stays its own (AUDIT 625 W2, "RVN8 names its own exclusions"), decided again: the zone
 *  keeps one because a death's remains are anyone's, and what a revenant takes never rides to another player - its body
 *  hands what it carried to its owner alone (net/bodyLoot.js shareableRecord, peerWord.js neverPeerHanded). AUDIT FB1025i
 *  F1 (FIELD BUGS 2026-10-25i COPY-LIFT): but never a piece THE REALM LOCKED (itemBound.js isRealmLocked - a copy the
 *  ledger wrote down): what it took rides on its record, a list the checkpoint's ledger never reads, and a copy hidden
 *  there while staff's keep lifted the other came back after as a second, live one. One taken before comes home at the
 *  load (ensureMirror), where the ledger reads it. */
export const revenantMayTake = (item) => !!item && typeof item === 'object' && Number.isInteger(item.templateIndex) && !isLetterOfCredit(item)
  && !WILD_NEVER_GROUPS.has(item.group) && !DECOR_OWN_KEPT_BACK.has(item.templateIndex) && !BOAT_TEMPLATES.includes(item.templateIndex)   // STEED-KEPT
  && !isRealmLocked(item)   // AUDIT FB1025i F1: nor a piece the realm locked
  && !item.questItem && !isSummoned(item) && !isGoldPieces(item) && !isBagItem(item) && !isPackOnly(item) && !isLocked(item);
/** AUDIT FEUD: a piece it took, named after "your", "my" or "lovely" - the name the pack shows, its own article gone
 *  (a legendary's "The Glenmoril Bow": "your Glenmoril Bow", never "your The ..."). */
export const takenName = (item) => String(itemLongName(item) ?? '').replace(/^the\s+/i, '');
/** STEED-KEPT (FIELD BUGS 2026-10-19f): a piece it took and may no longer keep, home in my pack at the load - the
 *  words (ensureMirror says each once, through the text core). */
export const tookHomeLine = (r, item) => t('rvn.took.home', '{name} could not keep your {item}. It is back in your pack.', { name: r?.name ?? '', item: takenName(item) });
/** RVN8 (19): the piece it takes - drawn on its id and its kill count from my equipped weapon and my pack's five most
 *  valuable pieces (each takeable). Null with none. */
export function pickTaken(id, kills, weapon, items) {
  const pack = (Array.isArray(items) ? items : []).filter((it) => it !== weapon && revenantMayTake(it)).sort((a, b) => itemValueOf(b) - itemValueOf(a)).slice(0, 5);
  const pool = [...(revenantMayTake(weapon) ? [weapon] : []), ...pack];
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(idStream(id, `took:${kills | 0}`)() * pool.length))];
}
/** RVN8 (19): AT THE RESPAWN - online alone (offline a death ends the run with nothing saved, and the app's mirror
 *  outlives the save: a piece taken offline would come back twice) - when this death was a revenant's kill: one piece,
 *  off the hand that held it, out of my pack, onto its record (and into its standing body's pack); at TOOK_MAX it only
 *  gloats. Answers { r, item, line } (the wake box's line), { r, item: null } for a gloat, or null. */
export function revenantTakes(player, { online = false } = {}) {
  const s = _lastSlew;
  _lastSlew = null;
  if (!online || !s || !revenantOn() || !player) return null;
  const r = revenantById(s.id);
  if (!r || r.defeated || r.sworn) return null;
  if ((r.took?.length ?? 0) >= TOOK_MAX) return { r, item: null, line: null };
  const weapon = equipTableOf(player)[EQUIP_SLOTS.RightHand] ?? null;
  const item = pickTaken(r.id, r.kills, weapon, player.items);
  if (!item) return null;
  unequipItem(player, item);
  const i = (player.items ?? []).indexOf(item);
  if (i >= 0) player.items.splice(i, 1);
  r.took = [...(r.took ?? []), item];
  const body = playerDoor()?.foes?.()?.find((f) => !f?.dead && f?.entity?.revenant?.id === r.id)?.entity ?? null;
  if (body) carryTaken(body);   // the killer standing over my body carries it now
  touch(r);
  persist();
  return { r, item, line: `${r.name} took your ${takenName(item)}.` };
}
/** RVN8 (19): SPARED - what it took handed back at the oath ("It's yours. It always was."). Answers the pieces. */
export function revenantHandBack(player, r, entity = null) {
  const back = r?.took?.length ? r.took.slice() : [];
  if (!back.length || !player) return [];
  player.items = player.items ?? [];
  for (const it of back) {
    if (entity?.items) { const i = entity.items.indexOf(it); if (i >= 0) entity.items.splice(i, 1); }
    player.items.push(it);
  }
  r.took = [];
  touch(r);
  persist();
  return back;
}
/** RVN7d (bible/12-Enhanced-AI/Feud-Arc.md 18.4): WHO IS AT HOME - entering the dungeon at `here` ({ px, py }), the
 *  living, unsworn revenant whose lair it is, not out, and due or its lair known; CLAIMED as a return is (its stand
 *  crosses awaits). Decided here: a Night-stalker is at home at any hour - the dark is its own underground. LAIR-HOME
 *  (FIELD BUGS 2026-10-19): one OUT is at home too, unless its body is here, in a fight with me, kneeling, or still
 *  standing up (goesHome) - a known lair was found empty when the road's return had stood it a moment before. */
export function revenantForLair(player, here, { now = nowMinutes(), dueOnly = false, foes = [] } = {}) {   // `dueOnly`: a rest's answer - due, never merely known; LAIR-HOME: `foes` the lair's own pool
  if (revenantHeld()) return null;   // RENOWN-GATE: held - none is at home, and none is claimed
  if (!revenantOn() || wildHere() || !here || !Number.isInteger(here.px) || !Number.isInteger(here.py)) return null;   // PVPDUNGEONS: no lair in the open zone
  ensureMirror(player);
  const wall = Date.now();
  const r = livingRevenants().filter((x) => (!x.out || goesHome(x, wall, foes)) && x.lair && x.lair.px === here.px && x.lair.py === here.py && (x.dread || x.dueAt <= now || (!dueOnly && x.lairKnown)))   // UNQUIET: the Dread is always at home
    .sort((a, b) => b.rank - a.rank || a.dueAt - b.dueAt)[0] ?? null;
  if (!r) return null;
  claim(r, wall);
  return r;
}
/** A claimed stand that stood nobody (no place for it, the pool full, a sweep) - free to come on a later roll. LAIR-HOME:
 *  a claim on one that was out gives it back as it was - its body still stands where it stood. */
export function releaseRevenantStand(r) {
  if (!r || !r.out || r.defeated || r.gone) return;
  const was = _claims.get(r.id) ?? null;
  _claims.delete(r.id);
  if (was?.out) { r.outAt = was.outAt; return; }
  r.out = false; r.outAt = 0;
}
/** The spawn options a returning revenant stands with (scenes/exteriorFoes.js spawnFoe): its record, its gender, and a
 *  class foe's level over the player's. */
export function revenantSpawnOptions(r, playerLevel) {
  return { revenant: r, gender: isClassEnemyId(r.mobileType) ? r.gender : null, level: isClassEnemyId(r.mobileType) ? Math.max(1, (playerLevel | 0) + r.rank * REVENANT_LEVEL_PER_RANK) : null };   // a monster's sprite is its kind's, whatever its gender
}
/** Stand the record on a freshly built entity (before its loot): its name, its rank's health and blows. The record is
 *  OUT from here until the foe dies, escapes or leaves the world. RVN11c: `turned` - a betrayer standing where it
 *  stood beside me is no return (no `returned` deed, no return counted). */
export function applyRevenant(entity, r, { now = nowMinutes(), turned = false } = {}) {
  if (!entity || !r) return false;
  entity.revenant = revenantStamp(r);   // RVN2: what it learned stands with it
  entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * (1 + REVENANT_HEALTH_PER_RANK * r.rank)));
  entity.health = entity.maxHealth;
  entity.healthMult = (entity.healthMult ?? 1) * (1 + REVENANT_HEALTH_PER_RANK * r.rank);   // TELL1: what was stood on the kind's own health (ai/tells.js kindHealth - its poise)
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * (1 + REVENANT_DAMAGE_PER_RANK * r.rank);
  // RVN9 (Feud-Arc.md 20): its wrath at this stand - health and blows a wrath - and facing it clears it
  const wrath = Math.max(0, Math.min(WRATH_MAX, r.wrath | 0));
  if (wrath) {
    entity.maxHealth = Math.max(1, Math.round(entity.maxHealth * (1 + FESTER.HEALTH * wrath)));
    entity.health = entity.maxHealth;
    entity.healthMult *= 1 + FESTER.HEALTH * wrath;
    entity.damageScale *= 1 + FESTER.BLOWS * wrath;
  }
  r.wrath = 0;
  // UNQUIET (section 46): WHAT THE PLAYER LEFT ON IT (its wounds - revenantUnquiet.js woundEffects: its health, its blows,
  // its Speed; its poise and its saving throws are its edge's, revenantStamp), the Dread's own strength, and its HOARD -
  // the Dread's, and a plunderer's days on the road past its due day (grantRevenantLoot's gold)
  const wnd = woundEffects(r.wounds);
  const hm = wnd.health * (r.dread ? DREAD.HEALTH : 1);
  if (hm !== 1) {
    entity.maxHealth = Math.max(1, Math.round(entity.maxHealth * hm));
    entity.health = entity.maxHealth;
    entity.healthMult *= hm;
  }
  if (wnd.blows !== 1) entity.damageScale *= wnd.blows;
  if (wnd.speed && entity.stats) entity.stats.speed = Math.max(0, (entity.stats.speed ?? 0) + wnd.speed);
  const daysPast = Math.floor((now - (Number.isFinite(r.dueAt) ? r.dueAt : now)) / MINUTES_PER_DAY);
  entity.revenant.hoard = hoardOf(r.dread, ambitionOf(r.personality) === 'plunder' ? plunderGold(daysPast) : 1);   // AUDIT UNQUIET: the Dread's or a plunderer's, never the two multiplied
  // RVN2 (13.2): a Relentless one's Speed (on its stats, at the stand); a Night-stalker's blows (it comes only by night -
  // revenantToReturn); an elemental one's saving throw (the fold, folded now - a stand has had no magic round yet)
  const edge = entity.revenant.edge;
  if (edge.relentless && entity.stats) entity.stats.speed = (entity.stats.speed ?? 0) + ADAPT.RELENTLESS_SPEED;
  if (edge.nightStalker && skyIsNight()) entity.damageScale *= ADAPT.NIGHT_BLOWS;
  entity.revenant.blows = entity.damageScale / prior;   // FEUD WIRE (Feud-Arc.md 25): its stand's blows over its kind's, for its puppets (revenantFeud.js feudWire `rb`)
  computeEntityMods(entity);
  // UNQUIET II (section 47): FOUND ON ITS TRAIL - stood while its escape's trail is warm (in its den, not yet healed), at
  // HUNT.HEALTH of its health; whatever comes of it, the trail is followed
  if (trailWarm(r, now)) entity.health = Math.max(1, Math.round(entity.maxHealth * HUNT.HEALTH));
  r.trail = 0;
  r.out = true; r.outAt = Date.now();
  bodyStood(r, entity);   // LAIR-HOME: its latest body - any other it stood in is stale
  r.fights = (r.fights | 0) + 1;   // RVN1: a return is a fight (an older record's count is kills + escapes + returns)
  if (!turned) { r.returns++; deed(r, 'returned', now); }   // RVN11c: a turning is its own deed (`betrayed`)
  touch(r);
  persist();
  return true;
}
/** Out in the world and no longer there (outrun past the cull, a load, a sweep) - it comes again later. `foes` the
 *  pools' live records ({ entity, dead }). A stand still crossing its awaits has a few seconds' grace. */
export function revenantPresence(foes, { now = nowMinutes(), wall = Date.now() } = {}) {
  let changed = false;
  // the open world's pool and whichever host the player stands in (a dungeon's foe that killed me stands there)
  let pools = null;
  for (const r of _state.list) {
    if (!r.out || r.defeated || r.gone || r.sworn || wall - r.outAt < REVENANT_STAND_GRACE_MS) continue;
    pools ??= [...(foes ?? []), ...(playerDoor()?.foes?.() ?? [])];
    const here = pools.some((f) => f && !f.dead && f.entity?.revenant?.id === r.id && !revenantStale(f.entity));   // LAIR-HOME: a body it left is none
    if (here) continue;
    r.out = false;
    const foretold = r.omen === r.dueAt;
    r.dueAt = Math.max(r.dueAt, now + REVENANT_LOST_MINUTES);
    if (foretold) r.omen = r.dueAt;   // AUDIT UNQUIET: the same absence - its omen said once
    touch(r);
    changed = true;
  }
  if (changed) persist();
  return changed;
}

// ── its drop ────────────────────────────────────────────────────────
/** A revenant's drop, over its kind's: gold by level and rank, and gear on chances that grow with the rank. AUDIT UNQUIET
 *  (section 49): the Dread's too - its Legendary is its trophy (revenantTrophy.js); with a Legendary here as well, it
 *  dropped two. */
export function revenantLoot(level = 1, rank = 1, rolls = Math.random, goldMult = 1) {
  const lv = Math.max(1, level | 0), rk = Math.max(1, Math.min(REVENANT_MAX_RANK, rank | 0));
  const out = [];
  const L = REVENANT_LOOT;
  if (rolls() < L.magicChance) { const it = tieredGear(lv, 'magic', rolls); if (it) out.push(it); }
  if (rk >= L.rareFromRank || rolls() < L.rareChance + L.rarePerRank * rk) { const it = tieredGear(lv, 'rare', rolls); if (it) out.push(it); }
  const at = rollerLevel() ?? lv;   // LOOT-GATE: the player's level holds its Legendary back; AUDIT UPDATE II A3: none registered yet, the level the drop is minted at (the player's at every host)
  if (rolls() < (L.legendaryChance + L.legendaryPerRank * rk) * (at == null ? 1 : legendaryGate(at))) { const it = tieredGear(lv, 'legendary', rolls); if (it) out.push(it); }
  const [lo, hi] = L.goldPerLevel;
  out.push(goldStack(Math.round(lv * rk * (lo + rolls() * (hi - lo)) * (goldMult > 0 ? goldMult : 1))));   // RVN7d: found in its lair, x LAIR_GOLD
  return out;
}
/** Give a returned revenant its drop (once) - RVN7d: its gold x `goldMult` (LAIR_GOLD, found in its lair); UNQUIET: and x
 *  its hoard (applyRevenant - the Dread's, a plunderer's). */
export function grantRevenantLoot(entity, level, rolls = Math.random, { goldMult = 1 } = {}) {
  if (!entity?.revenant || entity._revenantLoot) return;
  entity._revenantLoot = true;
  entity.items = entity.items ?? [];
  const hoard = Number.isFinite(entity.revenant.hoard) && entity.revenant.hoard > 0 ? entity.revenant.hoard : 1;
  entity.items.push(...revenantLoot(level ?? entity.level, entity.revenant.rank ?? 1, rolls, goldMult * hoard));
  carryTaken(entity);   // RVN8: what it took of mine, in its pack at every stand
}
/** RVN8 (bible/12-Enhanced-AI/Feud-Arc.md 19): what it took of mine rides in a standing body's pack - marked, so its
 *  death hands the record's pieces to its body. */
function carryTaken(entity) {
  const r = entity?.revenant?.id ? revenantById(entity.revenant.id) : null;
  if (!r?.took?.length) return;
  entity.items = entity.items ?? [];
  for (const it of r.took) if (!entity.items.includes(it)) entity.items.push(it);   // each piece once, whoever asks again
  entity._tookCarried = true;
}

// ── what is said ────────────────────────────────────────────────────
// Every word below comes two ways: the EVENT a face draws (REVENANT-CARD - ui/revenant/revenantCard.js on the enhanced skin: the
// portrait, the name, what it says in its own voice, what happens in the narrator's) and the one LINE a text surface
// says instead (the classic skin, a page without a document). `revenantSay` hands an event to the face, or its line to
// the host's own `say`.
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** What a returning revenant greets the player with: its words (a speaker's) or what it does (a beast's). */
/** RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): the deeds a return answers to, newest first. */
const TAUNT_DEEDS = new Set(['slew', 'fled', 'felled', 'routed', 'festered']);
/** RVN12a (23): WHAT ITS RETURN SAYS - its newest deed against me speaks first: a companion it felled (`felled_return`,
 *  by name), my flight (`routed_return`), its long wait (`festered`); after a kill, what it took of mine (`stole`, the
 *  piece); every other return (its first, third...), what it learned (`learned`, the habit - its newest); else as ever.
 *  AUDIT FEUD: only deeds since its oath, if it swore one - a deserter or a betrayer with none since speaks its leaving
 *  (`deserted`, `betrayed`). Answers { event, vars }. */
export function tauntMoment(r) {
  // AUDIT FEUD: nothing from before an oath - a deserter's or a betrayer's return speaks of no deed it did before it served me
  const hist = [...(r?.history ?? [])].reverse();
  const oath = hist.findIndex((d) => d.deed === 'spared');
  const since = oath >= 0 ? hist.slice(0, oath) : hist;
  const last = since.find((d) => TAUNT_DEEDS.has(d.deed));
  const left = oath >= 0 ? since.find((d) => d.deed === 'deserted' || d.deed === 'betrayed') : null;
  if (!last && left) return { event: left.deed, vars: {} };   // nothing against me since it left: its leaving speaks
  if (last?.deed === 'felled' && last.ally) return { event: 'felled_return', vars: { ally: last.ally } };
  if (last?.deed === 'routed') return { event: 'routed_return', vars: {} };
  if (last?.deed === 'festered') return { event: 'festered', vars: {} };
  if (last?.deed === 'slew' && r.took?.length) return { event: 'stole', vars: { item: takenName(r.took[r.took.length - 1]) } };
  const how = ADAPT_HOW[r?.learned?.[r.learned.length - 1]];
  if (how && (r.returns | 0) % 2 === 1) return { event: 'learned', vars: { how } };
  const lastSF = since.find((d) => d.deed === 'slew' || d.deed === 'fled')?.deed ?? 'slew';
  // AUDIT (2026-10-02): the risen's taunt counts its kills ("I've killed you so often...") - one that only ever ran has none
  return { event: r.rank >= 3 && (r.kills | 0) >= 2 ? 'taunt_risen' : lastSF === 'fled' ? 'taunt_fled' : 'taunt_slew', vars: {} };
}
function tauntParts(r, playerName, rolls) {
  const m = tauntMoment(r);
  return { ...voiceParts(r, m.event, playerName, rolls, m.vars), moment: m.event };
}
/** REVENANT-VOICE: one moment in its voice - a speaker's words (quoted, its line `Name: "..."`), a beast's deed in its
 *  temperament (the narrator's, its line `Name circles you...`). `r` a record, or what a special foe is before it is
 *  one ({ id, name, mobileType, personality }). */
function voiceParts(r, event, playerName, rolls = Math.random, vars = {}) {   // RVN12a: `vars` the moment's words ({ how, item, move, ally })
  const personality = isPersonality(r.personality) ? r.personality : personalityFor(r.id, r.mobileType);
  if (!revenantSpeaks(r.mobileType)) {
    const body = beastBody(personality, event);
    return { speech: null, body, line: `${r.name} ${body.charAt(0).toLowerCase()}${body.slice(1)}` };
  }
  const speech = voiceLine(personality, event, { p: firstWord(playerName), rolls, ...vars });
  return { speech, body: null, line: speech ? `${r.name}: "${speech}"` : r.name };
}
/** The line a returning revenant greets the player with (a beast's, what it does). */
export function revenantTaunt(r, playerName, rolls = Math.random) {
  return r ? tauntParts(r, playerName, rolls).line : null;
}
/** A special foe breaking and running - its words in its voice (REVENANT-VOICE). */
export function revenantFleeLine(entity, base, rolls = Math.random) {
  const n = entity?.revenant?.name ?? base;
  if (!revenantSpeaks(entity?.mobileType)) return `${n} breaks and runs!`;
  return `${n} breaks and runs! "${voiceLine(personalityOfLive(entity), 'flee', { rolls })}"`;
}
/** REVENANT-VOICE: a live foe's personality - its record's, or the one its voice id draws. */
const personalityOfLive = (entity) => {
  const r = entity?.revenant?.id ? revenantById(entity.revenant.id) : null;
  return r?.personality ?? personalityFor(voiceIdOf(entity), entity?.mobileType);
};
/** Out of reach: it is a revenant now (or a stronger one). */
export const revenantEscapeLine = (r) => t('rvn.unq.escapeLine', '{given} got away. {name} will remember this.', { given: r.given, name: r.name });   // AUDIT UNQUIET: through the text core - UNQUIET's own words end it
/** Slain at last. */
export const revenantSlainLine = (r) => `${r.name} has fallen. Your revenant is no more.`;
/** The line the player meets once alive again after a revenant's kill (online's respawn, the next load). */
export function revenantRiseLine(r) {
  const kind = enemyDisplayName(r.mobileType) ?? 'foe';
  return r.kills > 1
    ? `${r.name} has killed you ${r.kills} times. It grows stronger.`
    : `The ${kind} that killed you lives on as ${r.name}. It will come for you again.`;
}

// ── REVENANT-CARD: the events a face draws ───────────────────────────
const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);
/** A rank as the card writes it (I to V). */
export const revenantRankNumeral = (rank) => ROMAN[Math.max(0, Math.min(REVENANT_MAX_RANK, rank | 0))];
/** The picture a revenant is drawn by: the sprite it wore (`archive` - a retextured kind's own), else its kind's by
 *  gender, and its front-facing record - the idle's (15) where its kind has one, else the walk's (0)
 *  (characters/mobile/mobileUnit.js's tables). Null for a kind with no sprite. */
export function revenantPortrait({ mobileType, gender = 'male', archive = null } = /** @type {any} */ ({})) {
  const b = ENEMY_BASICS[mobileType];
  const a = Number.isInteger(archive) ? archive : (b ? (gender === 'female' && b.femaleTexture ? b.femaleTexture : b.maleTexture) : null);
  if (!Number.isInteger(a)) return null;
  return { archive: a, record: b?.hasIdle ? 15 : 0 };
}
const KICKERS = Object.freeze({
  taunt: 'Revenant', flee: 'Fleeing', cornered: 'Cornered', escape: 'Escaped', slain: 'Revenant slain', rise: 'A revenant rises',
  // REVENANT-FATE: beaten, judged
  yield: 'Yields', executed: 'Executed', spared: 'Sworn to you', slip: 'Slipped away',
  // REVENANT-COMPANION: sworn to the player
  arrive: 'Companion', dismiss: 'Sent away', downed: 'Companion down', kill: 'Companion', battle: 'Companion', release: 'Released',
  // RVN3: its weakness found or hinted; its will unbroken; RVN4: its last stand
  weakness: 'Weakness', unbroken: 'Unbroken', laststand: 'Last stand',
  // RVN5: its signature, called out; RVN7d: found in its lair; RVN9: festered
  signature: 'Signature', lair: 'Its lair', festered: 'Grows bolder',
  // RVN10: it knocked out my companion; I ran from it
  felled: 'Felled', routed: 'Routed',
  // RVN11: a Devoted one's warning; RVN11b: a deserter
  warn: 'Companion', deserted: 'Oathbreaker',
  // RVN11c: a betrayer; RVN12a: a theft's taunt
  betrayed: 'Betrayed', stole: 'It took',
  // RVN-ERRAND: a sworn one sets out and comes back; RVN-ARTS: its art, called out (AUDIT RVN D7: in the player's language)
  get errand() { return t('rvn.kicker.errand', 'Mission'); }, get errand_back() { return t('rvn.kicker.errandBack', 'Returned'); }, get art() { return t('rvn.kicker.art', 'Art'); },
  // UNQUIET (section 46): a rank-5 revenant gone to ground for good
  get ascended() { return t('rvn.kicker.ascended', 'The Dread'); },
  // UNQUIET II (section 47): its coming, foretold
  get omen() { return t('rvn.kicker.omen', 'An omen'); },
  // UNQUIET III (section 48): a revenant of mastery's training
  get trained() { return t('rvn.kicker.trained', 'Trained'); },
});
/** @typedef {{ kind: string, kicker: string, id: string|null, name: string, rank: number, sub: string, mood: string|null,
 *   portrait: { archive: number, record: number } | null, speech: string|null, body: string|null, line: string }} RevenantEvent */
/** One thing a revenant (or a special foe about to become one) says or does, as a face draws it: `kind` (taunt, flee,
 *  escape, slain, rise), its name and what it is (rank, kind, trait, elite), its portrait, what it SAYS (its own voice,
 *  quoted) and what HAPPENS (the narrator's), and `line` - the one sentence a text surface says instead.
 *  @returns {RevenantEvent} */
export function revenantEvent(kind, src, { speech = null, body = null, line = '', archive = null } = /** @type {any} */ ({})) {
  const r = src ?? {};
  const kindName = enemyDisplayName(r.mobileType) ?? '';
  const trait = typeof r.trait === 'string' && r.trait ? capFirst(r.trait) : null;
  return {
    kind, kicker: KICKERS[kind] ?? 'Revenant', id: r.id ?? null, name: r.name || kindName, rank: r.rank | 0,
    sub: [kindName, trait, r.elite ? 'Elite' : null].filter(Boolean).join(' · '),
    mood: personalityLabel(r.personality) ?? (r.id || r.mobileType != null ? personalityLabel(personalityFor(r.id, r.mobileType)) : null),   // REVENANT-VOICE: its personality, the card's chip
    portrait: revenantPortrait({ mobileType: r.mobileType, gender: r.gender, archive: archive ?? r.archive }),
    speech, body, line,
  };
}
/** The record a live foe stands for, or what it is when it is no revenant yet (a special foe running). */
function liveSource(entity, base, gender) {
  const r = entity?.revenant?.id ? revenantById(entity.revenant.id) : null;
  if (r) return r;
  return { id: null, name: entity?.revenant?.name ?? base, rank: entity?.revenant?.rank ?? 0, mobileType: entity?.mobileType, gender,
    trait: typeof entity?.champion === 'string' ? entity.champion : null, elite: !!entity?.eliteFoe,
    personality: personalityOfLive(entity) };   // REVENANT-VOICE: the voice it will keep if it gets away
}
/** A returning revenant, in sight: its taunt. */
export function revenantTauntEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  const t = tauntParts(r, playerName, rolls);
  return revenantEvent(t.moment === 'stole' ? 'stole' : 'taunt', r, { speech: t.speech, body: t.body, line: t.line, archive });   // RVN12a: a theft's taunt wears its own kicker
}
/** A special foe breaking and running. */
export function revenantFleeEvent(entity, base, { gender = 'male', archive = null, rolls = Math.random, playerName = '' } = {}) {
  const src = liveSource(entity, base, gender);
  const v = voiceParts(src, 'flee', src.id ? playerName : '', rolls);   // a revenant knows the player's name; a stranger does not
  // UNQUIET (section 46): its flight craft, in the narrator's words - what it does, and its answer
  const craft = entity?._craft ? craftFleeWords(entity._craft, /** @type {any} */ (src).given ?? src.name) : null;
  if (craft) return revenantEvent('flee', src, { speech: v.speech, body: craft, line: v.speech ? `${craft} "${v.speech}"` : craft, archive });
  return revenantEvent('flee', src, { speech: v.speech, body: v.speech ? null : v.body, line: v.speech ? `${src.name} breaks and runs! "${v.speech}"` : v.line, archive });
}
/** Run down before it got away: it turns and fights. */
export function revenantCorneredEvent(entity, base, { gender = 'male', archive = null, rolls = Math.random, playerName = '' } = {}) {
  const src = liveSource(entity, base, gender);
  const v = voiceParts(src, 'cornered', src.id ? playerName : '', rolls);
  return revenantEvent('cornered', src, {
    speech: v.speech, body: v.speech ? 'Cornered, it turns to fight.' : v.body,
    line: v.speech ? `${src.name} is cornered and turns to fight! "${v.speech}"` : v.line, archive,
  });
}
/** AUDIT UNQUIET (section 49): did its last getting-away make it the Dread? (its card is the ascension's, whatever way it got away) */
export const revenantAscended = (r) => !!r?.dread && r.history?.at(-1)?.deed === 'ascended';
/** UNQUIET: what a getting-away's card ends with - the wound it got away with (said once) and where its trail leads
 *  (UNQUIET II, section 47). AUDIT UNQUIET: every getting-away's card, the tear-away's and the slip's as the escape's. */
export function revenantEscapeTail(r) {
  const w = woundWords(_newWounds.get(r?.id));
  _newWounds.delete(r?.id);
  const marked = w ? ` ${t('rvn.unq.escapeWound', 'It bears the wound you left: {wound}.', { wound: w.name })}` : '';
  const trail = r?.history?.at(-1)?.deed === 'fled' && trailWarm(r, nowMinutes()) && r.lair ? ` ${trailWords(r.lair.name)}` : '';
  return `${marked}${trail}`;
}
/** Out of reach - a revenant now, or a stronger one. */
export function revenantEscapeEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  const speech = voiceParts(r, 'escape', playerName, rolls).speech;
  // UNQUIET (section 46): ascended - the Dread, gone to ground for good
  if (revenantAscended(r)) {
    const body = t('rvn.unq.ascended', '{given} will run no more. It is the Dread now, and waits for you in {lair}.', { given: r.given, lair: r.lair?.name ?? '' });
    _newWounds.delete(r.id);
    return revenantEvent('ascended', r, { speech, body, line: body, archive });
  }
  const tail = revenantEscapeTail(r);
  return revenantEvent('escape', r, {
    speech,
    body: `${r.rank > 1 ? t('rvn.unq.escapeRank', 'Got away and rose to rank {rank}. It will remember this.', { rank: revenantRankNumeral(r.rank) }) : t('rvn.unq.escape', 'Got away. It will remember this.')}${tail}`,
    line: `${revenantEscapeLine(r)}${tail}`, archive,
  });
}
/** RVN3 (14.1): its weakness - found (my blow of it: what it is) or hinted (its flinch: the narrator's line). */
export function revenantWeaknessEvent(r, { found = false, archive = null } = {}) {
  const name = WEAK_NAMES[r?.weak] ?? 'Something';
  const body = found ? `Its weakness laid bare: ${name}.` : (FLINCH_LINES[r?.weak] ?? 'It shies from something.');
  return revenantEvent('weakness', r, { body, line: `${r.name}: ${body}`, archive });
}
/** RVN3 (14.2): its will unbroken - at the killing blow it tears away into the smoke (an escape: it learns, and every
 *  TEAR_RANK-th ranks it up). AUDIT UNQUIET: the Dread's ascension is its own card; the wound and the trail end this one. */
export function revenantUnbrokenEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  if (revenantAscended(r)) return revenantEscapeEvent(r, playerName, { rolls, archive });
  const tail = revenantEscapeTail(r);
  const body = `${t('rvn.unq.unbroken', '{given} staggers into the smoke, unbroken.', { given: r.given })}${tail}`;
  return revenantEvent('unbroken', r, { speech: voiceParts(r, 'escape', playerName, rolls).speech, body, line: body, archive });
}
/** RVN5 (16.1): its signature called out - the first time a stand it winds it up ("Grushnak readies Skullsplitter!" -
 *  its `noun`). */
export function revenantSignatureEvent(r, noun, { archive = null, playerName = '', rolls = Math.random } = {}) {
  const body = `${r.given} readies ${noun ?? 'its signature'}!`;
  const v = voiceParts(r, 'signature', playerName, rolls, { move: noun ?? null });   // RVN12a (23): its words for it
  return revenantEvent('signature', r, { speech: v.speech, body, line: v.speech ? `${body} "${v.speech}"` : body, archive });
}
/** RVN7b (bible/12-Enhanced-AI/Feud-Arc.md 18.2): A TOWN'S NEWS OF A REVENANT - "Any news?" asked `here` ({ px, py,
 *  region }: my map pixel and region) within RUMOR_PX of a living, unsworn revenant's lair, or in its lair's region,
 *  one time in RUMOR_CHANCE is answered with it: "They say a scarred orc called Grushnak the Butcher has been seen near
 *  the Tomb of Vaness, a day's ride to the north-east." It spends the person's one answer as the mill's own does (the
 *  mill's gate first: a person with no news left has none of it either), marks its lair known, and one time in
 *  RUMOR_WEAK carries its weakness - hinted, or one time in RUMOR_NAMED named ("Folk say it can't abide fire.").
 *  Nothing is written into the mill. Answers the words, or null - the mill's turn. */
export function revenantRumor(here, session, { rolls = Math.random } = {}) {
  if (revenantHeld()) return null;   // RENOWN-GATE: held - no word of a lair it is not at; the mill's turn, its answer unspent
  if (!revenantOn() || !here || !session || !Number.isInteger(here.px) || !Number.isInteger(here.py)) return null;
  if (!((session.numAnswersGivenTellMeAboutOrRumors | 0) < MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS || session.isSpyMaster)) return null;
  mendRevenantLairs();   // LAIR-DOOR: no word of a lair nobody can enter
  const inRegion = (r) => Number.isInteger(here.region) && here.region >= 0 && r.lair.region === here.region;
  const near = livingRevenants().filter((r) => r.lair && (r.dread || inRegion(r) || Math.hypot(r.lair.px - here.px, r.lair.py - here.py) <= RUMOR_PX));   // UNQUIET: the Dread is known in every town
  if (!near.length || !(rolls() < RUMOR_CHANCE)) return null;
  const r = near[Math.min(near.length - 1, Math.floor(rolls() * near.length))];
  const dx = r.lair.px - here.px, dy = r.lair.py - here.py, d = Math.max(Math.abs(dx), Math.abs(dy));
  const kind = String(enemyDisplayName(r.mobileType) ?? 'creature').toLowerCase();
  const what = r.scars?.length ? `a scarred ${kind}` : `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`;
  const where = d === 0 ? `in ${r.lair.name}, close by` : `near ${r.lair.name}, ${distanceWord(d)} to the ${compassWord(dx, dy)}`;
  // UNQUIET (section 46): the Dread's word is everywhere it is heard; another's says what it does while it waits
  let words = r.dread
    ? t('rvn.unq.rumor.dread', 'They say {name} has gone to ground in {lair}, and that nobody who goes in comes out.', { name: r.name, lair: r.lair.name })
    : `They say ${what} called ${r.name} has been seen ${where}. ${ambitionRumor(ambitionOf(r.personality))}`.trim();
  if (r.weak && rolls() < RUMOR_WEAK) {
    const named = rolls() < RUMOR_NAMED;
    r.weakKnown = /** @type {0|1|2} */ (Math.max(r.weakKnown | 0, named ? 2 : 1));
    words += named ? ` Folk say it can't abide ${String(WEAK_NAMES[r.weak] ?? r.weak).toLowerCase()}.` : ` Folk say ${RUMOR_HINTS[weaknessKind(r.weak)] ?? 'something hurts it more than the rest'}.`;
  }
  r.lairKnown = true;
  session.numAnswersGivenTellMeAboutOrRumors = (session.numAnswersGivenTellMeAboutOrRumors | 0) + 1;
  touch(r);
  persist();
  return words;
}
/** LAIR-DOOR (FIELD BUGS 2026-10-22d, Zenako through fogs: "the Revenant lair designated on the Revenants page is
 *  inaccessible ... The Stuvam Graveyard"): A LAIR NOBODY CAN ENTER, MOVED. A revenant that went to ground before the host
 *  asked whether a dungeon has a door may hold one of the 28 graveyards whose blocks place none (scenes/lairHost.js). Each
 *  held lair is asked of the host once a session (`lairHere({ x, y })` about its own pixel); one the player cannot go down
 *  into moves to the enterable dungeon nearest it within a rumour's reach (the host's `nearest`, scenes/lairHost.js
 *  LAIR_MEND_PX; a host without it, the ring's nearest - nearestLair) - known as it was known, so the page, the map's
 *  circle, the hunt and the rumours point where it waits - and with none in reach it roams, unheard of (the Dread, which
 *  never comes on the road, keeps it: AUDIT FB1022d B4). A host that cannot say (underground, none running) is asked again
 *  later. AUDIT FB1022d B1: never before the character's mirror is read in - a load's first quest tick ran before the
 *  encounter tick's ensureMirror, and the mirror's newer copy put the lair back for the session; and asked of the RECORD
 *  (a merge makes new ones, which are asked again). Answers how many moved. */
let _lairsAsked = new WeakMap();   // record -> the lair pixel it was asked about
export function mendRevenantLairs(door = playerDoor()) {
  if (!_state.mirrorId) return 0;
  let moved = 0;
  for (const r of livingRevenants()) {
    if (!r.lair) continue;
    const key = `${r.lair.px},${r.lair.py}`;
    if (_lairsAsked.get(r) === key) continue;
    let at = null;
    try { at = door?.lairHere?.({ x: r.lair.px, y: r.lair.py }) ?? null; } catch { at = null; }
    if (typeof at?.enterable !== 'function') continue;
    _lairsAsked.set(r, key);
    if (at.enterable(r.lair.px, r.lair.py) !== false) continue;
    const next = typeof at.nearest === 'function' ? at.nearest(r.lair.px, r.lair.py) : nearestLair(r.lair.px, r.lair.py, at.dungeons);
    if (!next && r.dread) continue;   // B4: the Dread waits where it is rather than nowhere
    r.lair = next;
    if (!r.lair) { r.lairKnown = false; r.trail = 0; }
    touch(r);
    moved++;
  }
  if (moved) persist();
  return moved;
}
/** RVN7c (bible/12-Enhanced-AI/Feud-Arc.md 18.3): THE LAIRS HEARD OF, ON THE MAPS - a circle at each living, unsworn
 *  revenant's lair the player knows (`lairKnown`), named for it (ui/bounty/bountyMapMark.js's shape, in blood red). */
export function revenantMapMarks() {
  if (revenantHeld()) return [];   // RENOWN-GATE: held - no lair marked where none waits
  if (!revenantOn()) return [];
  mendRevenantLairs();   // LAIR-DOOR: no circle round a lair nobody can enter
  return livingRevenants().filter((r) => r.lair && r.lairKnown).map((r) => ({ cx: r.lair.px + 0.5, cy: r.lair.py + 0.5, r: LAIR_RING_R, label: r.given ?? r.name, id: r.id }));
}
/** RVN7c (18.3): THE HUNTS, IN THE QUEST LOG - each lair heard of as an active side quest (scenes/quest/questBridge.js
 *  questLog's shape, BOUNTY1's precedent): "Hunt: Grushnak the Butcher", the way there from `here` (my map pixel), no
 *  clock. Its Abandon (systems/huntJournal.js) forgets the lair. */
export function revenantHuntEntries(here = null, { now = nowMinutes() } = {}) {
  if (revenantHeld()) return [];   // RENOWN-GATE: held - no hunt in the log for a lair none waits in
  if (!revenantOn()) return [];
  mendRevenantLairs();   // LAIR-DOOR: no hunt to a lair nobody can enter
  const line = (text) => ({ formatting: 'text', text });
  return livingRevenants().filter((r) => r.lair && r.lairKnown).map((r) => {
    const dx = Number.isInteger(here?.px) ? r.lair.px - here.px : 0, dy = Number.isInteger(here?.py) ? r.lair.py - here.py : 0;
    const way = dx || dy ? `, ${distanceWord(Math.max(Math.abs(dx), Math.abs(dy)))} to the ${compassWord(dx, dy)}` : '';
    const kind = enemyDisplayName(r.mobileType) ?? 'Revenant';
    const lines = [`${kind}, rank ${revenantRankNumeral(r.rank)}.`, `Its lair: ${r.lair.name}${way}, marked on your map with a red circle.`,
      r.dread ? t('rvn.unq.hunt.dread', 'The Dread will not come to you again. Go to it.') : 'Find it there before it finds you.'];   // UNQUIET: the Dread waits
    // UNQUIET II (section 47): its trail warm - wounded in its den, for a while
    if (trailWarm(r, now)) lines.push(t('rvn.unq.hunt.trail', 'Weakened, it went to ground here to recover. It will be whole again in {hours, plural, one {# hour} other {# hours}}.', { hours: trailHours(r, now) }));
    return { id: `${HUNT_QUEST_PREFIX}${r.id}`, name: `Hunt: ${r.name}`, questName: 'HUNT', hunt: true, clockSeconds: null, messages: [lines.map(line)] };
  });
}
/** RVN7c: a hunt given up - its lair forgotten (heard again, it comes back). */
export function forgetRevenantLair(id) {
  const r = revenantById(id);
  if (!r || !r.lairKnown) return false;
  r.lairKnown = false;
  r.trail = 0;   // AUDIT UNQUIET: and its trail with it - the page said "find it there" of a lair it no longer named
  touch(r);
  persist();
  return true;
}
setHuntJournal({ abandon: (id) => forgetRevenantLair(id) });
/** RVN9 (bible/12-Enhanced-AI/Feud-Arc.md 20): FESTERING - the character's day against the store's `lastDay`, whole days
 *  caught up (FESTER.CATCHUP at most): a living, unsworn, not-out revenant FESTER.DAYS past its due day gains a wrath,
 *  and another every FESTER.EVERY days more; at WRATH_MAX it ranks up on its own (the `festered` deed, a new epithet, its
 *  card's notice) and its wrath goes back to none - never past rank 5, where its wrath stops at three. Asked by the
 *  notice's step in the encounter tick (it knows the player). Online the character's clock stands while the player is
 *  away, so nothing festers between sessions. Answers the records that ranked up. RVN11 (22.1): the same days move each
 *  sworn one's loyalty (with me +2, sent away -1). */
export function revenantFester(player, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!revenantOn()) return [];
  const day = Math.floor(now / MINUTES_PER_DAY);
  if (!Number.isInteger(day) || day < 0) return [];
  // AUDIT UNQUIET (section 49): no clock of a record's runs ahead of the character's (a reload to an older save under the
  // mirror's newer copy): a trail cools within HUNT.MINUTES of now, a wound's day is no later than today
  let clamped = false;
  for (const r of _state.list) {
    if (r.gone) continue;
    if (r.trail > now + HUNT.MINUTES) { r.trail = now + HUNT.MINUTES; touch(r); clamped = true; }
    if (r.woundDay > day) { r.woundDay = day; touch(r); clamped = true; }
  }
  if (_state.lastDay == null) { _state.lastDay = day; persist(); return []; }   // the first count: from here
  if (day <= _state.lastDay) { if (clamped) persist(); return []; }   // the encounter tick's every ask: nothing new. AUDIT FEUD: nor a clock behind it (a reload of an older save) - the mirror counted those days; none counts twice
  const up = [];
  const trained = new Set();   // AUDIT UNQUIET: one lesson a catch-up (one card says it)
  // RENOWN-GATE: held, none festers - none can come, so none is left unfought; its held days pass uncounted (lastDay
  // moves on below, so none is caught up when the gate opens), and the sworn's days run as ever
  const held = revenantHeld();
  for (let d = Math.max(_state.lastDay + 1, day - FESTER.CATCHUP + 1); d <= day; d++) {
    for (const r of held ? [] : livingRevenants()) {
      if (r.out || r.dread) continue;   // UNQUIET: the Dread festers no more - it waits
      // UNQUIET III (section 48): left alone, its oldest wound heals every WOUND.HEAL_DAYS days
      if (r.wounds?.length && healsOn(r.woundDay, d)) { r.wounds = r.wounds.slice(1); touch(r); }
      const dueDay = Math.floor((r.dueAt ?? 0) / MINUTES_PER_DAY);
      if (!(ambitionOf(r.personality) === 'mastery' ? masteryFestersOn(dueDay, d) : festersOn(dueDay, d))) continue;   // UNQUIET: a revenant of mastery trains - it festers every two days, not three
      // UNQUIET III: a revenant of mastery's day of training - a lesson against what I hurt it with most, in a lesson's room
      const lesson = trained.has(r.id) ? null : trainLesson(r);
      if (lesson) { r.learned = withLesson(r.learned, lesson, r.rank); if (!r.notice) r.notice = 'trained'; trained.add(r.id); touch(r); }
      if (r.rank >= REVENANT_MAX_RANK) { r.wrath = Math.min(WRATH_MAX, (r.wrath | 0) + 1); touch(r); continue; }
      r.wrath = (r.wrath | 0) + 1;
      if (r.wrath >= WRATH_MAX) {
        r.rank += 1;
        r.wrath = 0;
        r.blood = 0; r.tears = 0;   // AUDIT UNQUIET: a rank spends what it counted towards one
        r.epithet = revenantEpithet('festered', r.rank, player?.name ?? '', rolls, r.epithet);
        r.name = joinName(r.given, r.epithet);
        if (r.rank >= SIG_RANK && !r.sig) r.sig = drawSignature(r.id, r.mobileType);
        deed(r, 'festered', d * MINUTES_PER_DAY);
        r.notice = 'festered';
        up.push(r);
      }
      touch(r);
    }
    // RVN11 (22.1): THE SWORN'S DAY - a day with me +2, a day sent away -1 (a resting one's day moves nothing; RVN-STARS: a
    // loss as its oath bears it)
    for (const r of swornRevenants()) {
      const st = r.companion?.state;
      if (st !== 'with' && st !== 'away') continue;
      r.companion.loyalty = movedLoyalty(r.companion.loyalty, st === 'with' ? LOYALTY.DAY_WITH : rvnLoyaltyMove(r, LOYALTY.DAY_AWAY));
      touch(r);
    }
    // RVN11b (22.2): DESERTION - under DESERT.AT, once a day (a resting one too), one time in DESERT.CHANCE. AUDIT RVN F9:
    // never abroad - an errand is no way to lose a companion (its loyalty stands while it is gone; the roll waits for it)
    for (const r of swornRevenants()) {
      if (r.companion?.state === 'errand') continue;
      if (r.companion?.loyalty < DESERT.AT && rolls() < DESERT.CHANCE) revenantDeserts(player, r, { now: d * MINUTES_PER_DAY, rolls });
    }
  }
  _state.lastDay = day;
  persist();
  return up;
}
/** RVN11b (bible/12-Enhanced-AI/Feud-Arc.md 22.2): the host's ear for a sworn one leaving the party by its own will (its
 *  member forgotten - systems/revenant/revenantCompanions.js registers it). */
let _swornLeft = null;
export function setSwornLeftListener(fn) { _swornLeft = typeof fn === 'function' ? fn : null; }
/** RVN11b: what a deserter kept and gave back, for its card (this session's; a reload's card says less). */
const _desertWords = new Map();
/** RVN11b (22.2): DESERTED - a sworn one under DESERT.AT leaves: no longer sworn, a living revenant again (its rank kept,
 *  the `deserted` deed, "the Oathbreaker" whatever its rank), due as a return is (UNQUIET: two to four days, one to two by vengeance); its pack split (OPEN 18) - the
 *  more valuable half kept on its record (RVN8's `took`, room for TOOK_MAX: carried at its stands and given back as a
 *  theft is), the rest into my pack and its gold into my purse. Its body leaves through its portal (the companion layer:
 *  no longer the party's); its notice is its card. Answers the record, or null. */
export function revenantDeserts(player, r, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!r?.sworn || r.defeated) return null;
  const { kept, back } = splitPack(player, r);
  r.sworn = false; r.fate = null; r.companion = null; r.out = false;
  if (r.wounds?.length) r.woundDay = Math.floor(now / MINUTES_PER_DAY);   // AUDIT UNQUIET: its wounds heal from the day it is mine to hunt again (an oath stood their count)
  r.epithet = REVENANT_EPITHETS.deserted[0];
  r.name = joinName(r.given, r.epithet);
  r.dueAt = dueFrom(now, rolls, r);   // UNQUIET: by its ambition
  r.notice = 'deserted';
  deed(r, 'deserted', now);
  trimLiving(r);   // a living one again: the cap holds
  _desertWords.set(r.id, { kept: kept.map((it) => takenName(it)), back: back.length });
  touch(r);
  persist();
  try { _swornLeft?.(r.id); } catch { /* the party's bookkeeping is no record's failure */ }
  return r;
}
/** RVN11b/RVN11c (Feud-Arc.md 22.2, 22.3, OPEN 18): a sworn one leaving with its pack - the more valuable half kept on its
 *  record (RVN8's `took`: room TOOK_MAX less what it took), the rest into my pack and its gold into my purse. Answers
 *  { kept, back }. */
function splitPack(player, r) {
  // AUDIT FEUD: it keeps only what RVN8 lets it take (never a locked piece - LOCK1 - a quest item, a summoned one, the
  // Materials Bag); the rest comes back with its gold
  const { kept, back } = deserterSplit([...(r.companion?.items ?? []), ...gearItems(r.companion?.gear)], {   // RVN-GEAR: its kit weighed with its pack
    value: itemValueOf, isGold: (it) => isGoldPieces(it) || !revenantMayTake(it), room: TOOK_MAX - (r.took?.length ?? 0) });
  if (player) {
    player.items ??= [];
    for (const it of back) { if (isGoldPieces(it)) addGoldPieces(player, it.stackCount ?? 1); else addItem(player.items, it); }
  }
  r.took = [...(r.took ?? []), ...kept];
  return { kept, back };
}
/** RVN11c (bible/12-Enhanced-AI/Feud-Arc.md 22.3): BETRAYED - a sworn one under BETRAY.AT, Unhinged, Craven or Brutal,
 *  turns on me: out of the party, its rank up (never past 5; its signature drawn at 2), "the Betrayer" whatever its rank,
 *  the `betrayed` deed; its pack as a deserter's (what it may hold it carries on its record - recovered when it falls -
 *  the rest, and its gold, to me); the cap held; its member forgotten. The host stands it, hostile, where its body stood
 *  (applyRevenant's `turned`). Answers the record, or null. */
export function revenantBetrays(player, r, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (revenantHeld()) return null;   // RENOWN-GATE: held - none turns on me where it stands (a hostile one stood); it stays sworn until the gate opens
  if (!r?.sworn || r.defeated) return null;
  splitPack(player, r);   // its pack as a deserter's
  r.sworn = false; r.fate = null; r.companion = null;
  r.rank = Math.min(REVENANT_MAX_RANK, r.rank + 1);
  r.blood = 0; r.tears = 0;   // AUDIT UNQUIET: a rank spends what it counted towards one
  if (r.wounds?.length) r.woundDay = Math.floor(now / MINUTES_PER_DAY);   // AUDIT UNQUIET: its wounds heal from the day it is mine to hunt again
  if (r.rank >= SIG_RANK && !r.sig) r.sig = drawSignature(r.id, r.mobileType);
  r.epithet = REVENANT_EPITHETS.betrayed[0];
  r.name = joinName(r.given, r.epithet);
  r.dueAt = dueFrom(now, rolls, r);   // should it get away (UNQUIET: by its ambition)
  r.notice = null;
  deed(r, 'betrayed', now);
  trimLiving(r);
  touch(r);
  persist();
  try { _swornLeft?.(r.id); } catch { /* the party's bookkeeping is no record's failure */ }
  return r;
}
/** RVN11c (22.3): the turning, told - "Grushnak turns on you!" */
export function revenantBetrayEvent(r, { archive = null, playerName = '', rolls = Math.random } = {}) {
  const body = `${r.given} turns on you!`;
  return revenantEvent('betrayed', r, { speech: voiceParts(r, 'betrayed', playerName, rolls).speech, body, line: `${r.name} turns on you!`, archive });   // RVN12a (23): its words as it turns
}
/** RVN11b (22.2): the desertion, told - "Grushnak broke its oath and left you. It kept your Ebony Longsword." */
export function revenantDesertEvent(r, { archive = null, playerName = '' } = {}) {
  const w = _desertWords.get(r.id);
  _desertWords.delete(r.id);
  const kept = w?.kept?.length ? ` It kept your ${w.kept.length === 1 ? w.kept[0] : `${w.kept.slice(0, -1).join(', ')} and ${w.kept.at(-1)}`}.` : '';
  const back = w?.back ? ` It left the rest of its pack to you.` : '';
  const body = `${r.given} broke its oath and left you.${kept}${back}`;
  return revenantEvent('deserted', r, { speech: voiceParts(r, 'deserted', playerName, Math.random).speech, body, line: `${r.name}: ${body}`, archive });   // RVN12a (23): its parting words
}
/** RVN9 (20): its rank-up, told - "Grushnak grows bolder - it has waited too long." */
export function revenantFesterEvent(r, { archive = null } = {}) {
  const body = ambitionOf(r.personality) === 'mastery' ? t('rvn.unq.fester.mastery', '{given} grows bolder. It has been training.', { given: r.given }) : `${r.given} grows bolder. It has waited too long.`;   // UNQUIET: a revenant of mastery trained
  return revenantEvent('festered', r, { body, line: body, archive });
}
/** UNQUIET III (section 48): ITS TRAINING, told - "Grushnak has been training - it has learned to answer your blade." (its
 *  newest lesson; null with none). */
export function revenantTrainedEvent(r, { archive = null } = {}) {
  const how = trainedHow(r?.learned?.at(-1));
  if (!how) return null;
  const body = trainedWords(r.given, how);
  return revenantEvent('trained', r, { body, line: body, archive });
}
/** UNQUIET II (section 47): AN OMEN - the day it is due, the player warned in its ambition's words. */
export function revenantOmenEvent(r, { archive = null } = {}) {
  const body = omenWords(ambitionOf(r.personality), r.given);
  return revenantEvent('omen', r, { body, line: body, archive });
}
/** RVN7d (18.4): a rest in its own lair, answered - "You wake to Grushnak standing over you." */
export function revenantWakeEvent(r, { archive = null } = {}) {
  const body = `You wake to ${r.given} standing over you.`;
  return revenantEvent('lair', r, { body, line: body, archive });
}
/** RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.1): A DEVOTED ONE'S WARNING - a wind-up at me begun behind me: "Behind you,
 *  Ayla!" (a beast's, what it does). RVN12 brings its voice's own lines. */
export function revenantWarnEvent(r, playerName, { rolls = Math.random } = {}) {
  const v = voiceParts(r, 'devoted_warn', capFirst(firstWord(playerName)), rolls);   // RVN12a (23): in its own voice
  return revenantEvent('warn', r, { speech: v.speech, body: v.body, line: v.line });
}

// ── RVN10: felled and routed (bible/12-Enhanced-AI/Feud-Arc.md section 21) ─────────────────
/** RVN10 (21.1): FELLED - a special foe's blow knocked out my companion (a sworn revenant, a crew hand ashore): the deed
 *  on its striker (the pool's record the knock-out arm noted - `striker`), the companion's name on it; it still stands,
 *  so it is out. Answers the record, or null (a striker dead or down, a companion unnamed, or no candidate). */
export function revenantFelled(player, striker, ally, { now = nowMinutes(), rolls = Math.random } = {}) {
  const name = allyName(ally);
  if (!striker?.entity || striker.dead || !(striker.entity.health > 0) || striker.yielded || striker.executing || striker.sparing || striker.leaving || !name) return null;   // AUDIT FEUD: nor one held by its fate (kneeling at 1, burning, tearing away)
  return revenantDeed(player, striker.entity, 'felled', {
    mobileType: striker.mobileType ?? striker.entity.mobileType, gender: striker.gender ?? 'male', rec: striker,
    archive: striker.archive ?? striker.mobileArchive ?? null, now, rolls, ally: name,
  });
}
/** RVN10 (21.1): the felling, told - "Grushnak felled Borgakh. It will remember this." */
export function revenantFelledEvent(r, ally, { archive = null } = {}) {
  const who = allyName(ally) ?? 'your companion';
  const body = `${r.given} felled ${who}. ${r.rank > 1 ? `It is rank ${revenantRankNumeral(r.rank)} now, and` : 'It'} will remember this.`;
  return revenantEvent('felled', r, { body, line: `${r.name} felled ${who}.`, archive });
}
/** RVN10 (21.2): may this foe ROUT me - a special foe, alive, hostile and on me (detecting me), neither kneeling nor
 *  running itself, whose fight with me is live (its harm within harmMark's HARM_FIGHT_MS) and saw a hurt leave me under
 *  ROUT.LOW? The street pool asks it past ROUT.DISTANCE; a jump's sweep asks it of the pool I leave. */
export function revenantRoutable(f, { now = Date.now() } = {}) {
  if (!f?.entity || f.dead || f._routed || !(f.entity.health > 0) || f.yielded || f.executing || f.sparing || f.leaving || f.fleeing) return false;   // AUDIT FEUD: a tear-away is its escape, not my rout
  if (!f.ai?.isHostile || !f.ai.detected || f.ai.targetIsLocalPlayer === false) return false;
  if (!revenantCandidate(f.entity, f)) return false;   // AUDIT FEUD: a peer's foe is its owner's - my jump routs none of it (AUDIT UNQUIET: revenantCandidate refuses another client's foe)
  return playerLowSince(harmFightSince(f.entity, now));
}
/** RVN10 (21.2): ROUTED - I ran from it: the deed `routed` (it learns Relentless - revenantFeud.lessonOf asks it first),
 *  the foe marked so no second ask finds it. Its pool takes it after (the cull's own shape, or the jump's sweep). */
export function revenantRouted(player, f, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!f?.entity) return null;
  f._routed = true;
  return revenantDeed(player, f.entity, 'routed', {
    mobileType: f.mobileType ?? f.entity.mobileType, gender: f.gender ?? 'male', rec: f,
    archive: f.archive ?? f.mobileArchive ?? null, now, rolls,
  });
}
/** RVN10 (21.2): A JUMP'S ROUT - a Recall or a teleport taking me out of a fight: each engaged special of `foes` (the pool
 *  I leave - the host's door) routed before the sweep takes it. Answers [{ r, f }], for the host to tell. */
export function revenantRoutSweep(player, foes = playerDoor()?.foes?.() ?? [], { now = nowMinutes(), rolls = Math.random, wall = Date.now() } = {}) {
  const out = [];
  const door = playerDoor();
  for (const f of foes ?? []) {
    if (door?.isPuppet?.(f) || !revenantRoutable(f, { now: wall })) continue;   // AUDIT FEUD 2: a room's puppet (a dungeon's carries no `puppet`) is its host's
    const r = revenantRouted(player, f, { now, rolls });
    if (r) out.push({ r, f });
  }
  return out;
}
/** RVN10 (21.2): the rout, told - "You ran from Grushnak. It will remember this." */
export function revenantRoutedEvent(r, { archive = null } = {}) {
  const body = `You ran from ${r.given}. ${r.rank > 1 ? `It is rank ${revenantRankNumeral(r.rank)} now, and` : 'It'} will remember this.`;
  return revenantEvent('routed', r, { body, line: `You ran from ${r.name}. It will remember this.`, archive });
}
/** RVN4 (section 15): ITS LAST STAND, written on its record - the deed (`laststand`) at the character's minute. Answers
 *  the record, or null for one that is no revenant of mine. */
export function revenantLastStand(player, entity, { now = nowMinutes() } = {}) {
  const r = entity?.revenant?.id ? (ensureMirror(player), revenantById(entity.revenant.id)) : null;
  if (!r || r.defeated || r.sworn) return null;
  deed(r, 'laststand', now);
  touch(r);
  persist();
  return r;
}
/** RVN4: its last stand, as the card says it - it rises again, its words the cornered's. */
export function revenantLastStandEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  const body = `${r.given} rises again for its last stand.`;
  return revenantEvent('laststand', r, { speech: voiceParts(r, 'laststand', playerName, rolls).speech, body, line: body, archive });   // RVN12a (23): its own words
}
/** RVN3 (14.1): ITS FLINCH - a revenant of mine under FLINCH_HEALTH of its health, its weakness unknown, shies from it:
 *  once a stand (`f._flinched`), the record hinted (`weakKnown` 1). Answers the event to say, or null. */
export function revenantFlinch(f, { archive = null } = {}) {
  const e = f?.entity;
  if (!e?.revenant?.id || f._flinched || !(e.health > 0) || !(e.health < (e.maxHealth || 1) * FLINCH_HEALTH)) return null;
  f._flinched = true;
  const r = revenantById(e.revenant.id);
  if (!r || r.defeated || r.sworn || (r.weakKnown | 0) > 0) return null;
  r.weakKnown = 1;
  touch(r);
  persist();
  return revenantWeaknessEvent(r, { archive });
}
/** Slain at last - its last words, a speaker's. */
export function revenantSlainEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  return revenantEvent('slain', r, {
    speech: voiceParts(r, 'slain', playerName, rolls).speech,
    body: 'Has fallen. Your revenant is no more.', line: revenantSlainLine(r), archive,
  });
}
/** Alive again after its kill: it lives on, and gloats. */
export function revenantRiseEvent(r, playerName, { rolls = Math.random } = {}) {
  const kind = enemyDisplayName(r.mobileType) ?? 'foe';
  return revenantEvent('rise', r, {
    speech: voiceParts(r, 'rise', playerName, rolls).speech,
    body: r.kills > 1 ? `Has killed you ${r.kills} times. It grows stronger.` : `The ${kind} that killed you lives on. It will come for you again.`,
    line: revenantRiseLine(r),
  });
}

/** REVENANT-VOICE: any other moment it has a word for (REVENANT-FATE's yield, executed, spared, slip; a companion's
 *  arrive, dismiss, downed, kill, battle, release) - in its voice, with what happens in the narrator's (`body`, when the
 *  moment says more than its words), and its one text line. */
export function revenantMomentEvent(kind, r, playerName, { body = null, line = null, rolls = Math.random, archive = null, as = null } = {}) {
  const v = voiceParts(r, kind, playerName, rolls);
  // AUDIT (2026-10-02): what the moment says (`body` - its trophy, where it will wait, what to do) is kept for a beast
  // after its deed, and on the text line after either's. RVN-ERRAND: `as` - the card's own kind, its voice the moment's
  return revenantEvent(as ?? kind, r, {
    speech: v.speech, body: v.speech ? body : [v.body, body].filter(Boolean).join(' '),
    line: line ?? [v.line, body].filter(Boolean).join(' '), archive,
  });
}

// THE FACE (`setRevenantPresenter`, `revenantSay`) is a leaf's - systems/revenant/revenantVoice.js - so the HUD's card asks it
// without this file's imports.
export { setRevenantPresenter, revenantSay } from './revenantVoice.js';

/** The first pending notice, taken (said once): a revenant's kill, read when the player stands alive again - as the
 *  event a face draws (its `line` the text surfaces'). */
export function takeRevenantNotice(player, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!player || !(player.health > 0)) return null;
  ensureMirror(player);
  revenantFester(player, { now, rolls });   // RVN9: the days it waited, caught up first - a rank-up is its own notice
  const r = _state.list.find((x) => x.notice && !x.defeated);
  if (!r) return revenantOmen(now);   // UNQUIET II: nothing else to say - perhaps its coming
  const ev = r.notice === 'slew' ? revenantRiseEvent(r, player.name) : r.notice === 'festered' ? revenantFesterEvent(r) : r.notice === 'deserted' ? revenantDesertEvent(r, { playerName: player.name }) : r.notice === 'trained' ? revenantTrainedEvent(r) : null;   // RVN11b: a deserter's card; UNQUIET III: its training's
  r.notice = null;
  touch(r);
  persist();
  return ev;
}
/** UNQUIET II (section 47): AN OMEN, once a due day - the first living, unsworn revenant not out, not the Dread, due at
 *  `now` and not yet foretold for this due day (`omen`, its due minute): its card. Held or off, none. AUDIT UNQUIET: nor
 *  a Night-stalker's by day - it comes only by night (revenantToReturn). */
function revenantOmen(now) {
  if (!revenantOn() || revenantHeld()) return null;
  const night = skyIsNight();
  const r = livingRevenants().find((x) => !x.out && !x.dread && x.dueAt <= now && x.omen !== x.dueAt && (night || !(x.learned ?? []).includes('nightStalker')));
  if (!r) return null;
  r.omen = r.dueAt;
  touch(r);
  persist();
  return revenantOmenEvent(r);
}

// ── the save ────────────────────────────────────────────────────────
registerModSaveData(REVENANT_SAVE, {
  newSaveData: () => ({ v: 1, list: [], lastDay: null }),
  // AUDIT (2026-10-02): one standing as the save is made comes back later (REVENANT_LOST_MINUTES), not at once beside
  // the street's copy of it - the street's save leaves it out (scenes/exteriorFoes.js snapshotWorld)
  getSaveData: () => ({ v: 1, list: _state.list.map((r) => (r.gone ? r : { ...r, out: false, outAt: 0, dueAt: r.out ? Math.max(r.dueAt, nowMinutes() + REVENANT_LOST_MINUTES) : r.dueAt })), lastDay: _state.lastDay }),
  restoreSaveData: (rec) => { _state.list = mergeRevenants(rec?.list ?? [], []); _state.lastDay = sanitizeDay(rec?.lastDay); _state.mirrorId = null; _lastSlew = null; clearPlayerHarm(); endPlayerFights(); forgetBodies(); },   // the last game's harm is no one's death in this one (RVN10: nor its fights a rout; AUDIT FEUD: nor its killer a thief)
  newGame: () => { _state.list = []; _state.lastDay = null; _state.mirrorId = null; _lastSlew = null; clearPlayerHarm(); endPlayerFights(); forgetBodies(); },
});

/** LEGACY6 (bible/06-Systems/Legacy-Arc.md section 10, "the killer is remembered"): THE FOE THAT ENDED A CHARACTER -
 *  read off that character's own mirror (the app's storage under its id): the living, unjudged revenant whose kill fell
 *  within KILL_NEAR_MINUTES of `ownAt` (the fallen's own clock as they fell), the latest such. A copy, or null. */
export const KILL_NEAR_MINUTES = 2;
export function killerOf(characterId, ownAt) {
  if (!characterId || !Number.isFinite(ownAt)) return null;
  let list = [];
  try { const raw = appStorage()?.getItem(storeKey(String(characterId))); if (raw) list = JSON.parse(raw)?.list ?? []; } catch { return null; }
  let best = null, bestAt = -Infinity;
  for (const raw of mergeRevenants(list, [])) {
    if (raw.gone || raw.defeated || raw.sworn) continue;
    for (const d of raw.history) if (d.deed === 'slew' && Math.abs(d.at - ownAt) <= KILL_NEAR_MINUTES && d.at > bestAt) { best = raw; bestAt = d.at; }
  }
  return best ? JSON.parse(JSON.stringify(best)) : null;
}
/** LEGACY6: a fallen kinsman's killer HUNTS THE HEIR - its record handed to `player` (their list and their mirror, so a
 *  new game's reset or a load's merge keeps it): not out, its pack and companionship the fallen's own (never the
 *  heir's), due two to four days on the heir's clock (UNQUIET: a revenant of vengeance one to two). A record the heir already holds (a later one, or its tombstone)
 *  stands as it is. Answers whether it was handed. AUDIT UNQUIET (section 49): every clock of it the heir's - the wounds
 *  it carries heal from today, no trail warm, no omen given - and it joins the heir's hunters past the cap if need be,
 *  loaded or not (one rule: none of the heir's is forgotten for it). */
export function inheritRevenant(player, rec, { now = nowMinutes(), rolls = Math.random } = {}) {
  const r = /** @type {any} */ (sanitize(rec));
  const id = player ? characterIdOf(player) : null;
  if (!r || r.gone || r.defeated || r.sworn || !id) return false;
  Object.assign(r, { out: false, outAt: 0, took: [], companion: null, notice: null, dueAt: dueFrom(now, rolls, r),
    trail: 0, omen: 0, woundDay: r.wounds.length ? Math.floor(now / MINUTES_PER_DAY) : -1 });
  let kept = [], keptDay = null;
  try { const raw = appStorage()?.getItem(storeKey(id)); if (raw) { const m = JSON.parse(raw); kept = m?.list ?? []; keptDay = sanitizeDay(m?.lastDay); } } catch { /* a bad mirror is no mirror */ }
  if (kept.some((x) => x?.id === r.id) || (_state.mirrorId === id && _state.list.some((x) => x.id === r.id))) return false;
  try { appStorage()?.setItem(storeKey(id), JSON.stringify({ v: 1, list: [...kept, r], lastDay: keptDay })); } catch { /* storage full or gone: the list below still keeps it */ }
  if (_state.mirrorId === id) { _state.list.push(r); persist(); }
  return true;
}

/** Tests only: forget everything. */
export function _resetRevenantForTests() { _state.list = []; _state.mirrorId = null; _state.lastDay = null; forgetBodies(); _lairsAsked = new WeakMap(); }
