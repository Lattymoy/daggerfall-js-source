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
// ONLINE: a revenant is its character's own memory; a returning one is my own foe, streamed as any - its kind, health,
// trait, glow and (REVENANT-WIRE) its NAME, the foe record's `nm`, so every puppet is called what its owner calls it.
//
// REVENANT-CARD: everything a revenant says or does is an EVENT (below) - its portrait, its name, its words - which the
// enhanced skin draws as a card (ui/revenantCard.js, through systems/revenantVoice.js) and the classic says as a line.
// REVENANT-HARM: a death no blow names (a spell, a lingering effect, a poison) goes to the foe whose harm last reached
// the player (systems/harmMark.js). REVENANT-DUNGEON: a dungeon foe of mine alone may run and escape too.
// REVENANT-PAGE: the pause menu's Stats rail lists them (ui/revenantPage.js).
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn } from './lootRarity.js';
import { registerPlayerBlowLanded } from './sigilSetPowers.js';
import { registerPlayerHurtListener } from '../characters/playerEntity.js';   // REVENANT-HARM: a death no blow names
import { registerPlayerStruckListener, registerPlayerStrikeListener } from '../combat/formulas.js';   // REVENANT-HARM: a foe's blow leaves its mark (its poison's ticks come later); RVN1: my blow, in its fight's ledger
import { markPlayerHarm, playerHarmMark, clearPlayerHarm, HARM_MARK_STRUCK_MS, harmFightSince, markPlayerLow, playerLowSince, endPlayerFights } from './harmMark.js';   // RVN10: the fight a rout reads
import { playerDoor } from './playerDoor.js';
import { MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS } from './rumorMill.js';   // RVN7b: a person's one answer, the mill's own gate
import { compassWord, distanceWord } from './bountyBoard.js';   // RVN7b: a town crier's words for where
import { setHuntJournal, HUNT_QUEST_PREFIX } from './huntJournal.js';   // RVN7c: a hunt in the quest log, and its Abandon
import { MINUTES_PER_DAY } from './gameDate.js';   // RVN9: the character's day
import { registerModSaveData } from './modSaveData.js';
import { appStorage } from './appStorage.js';
import { characterIdOf, mintCharacterId } from './characterId.js';
import { ownMinutes, skyMinutes } from './worldTick.js';
import { isNight } from '../world/worldClock.js';   // RVN1: a fight begun by night
import { tieredGear } from './eliteFoes.js';
import { goldStack, isSummoned, isGoldPieces, addItem, addGoldPieces } from './inventory.js';   // RVN11b: a deserter's pack, handed back   // RVN8: never a summoned piece or gold taken
import { unequipItem, equipTableOf, EQUIP_SLOTS } from './equip.js';   // RVN8: what it takes, off the hand that held it
import { isLocked } from './itemLock.js';   // RVN8: LOCK1's promise - a locked piece stays yours
import { isBagItem } from '../net/bagLaw.js';   // RVN8: never the Materials Bag
import { itemLongName } from './itemInfo.js';   // RVN8: the piece by the name the pack shows
import { itemValueOf } from './itemTemplates.js';   // RVN8: the most valuable
import { enemyDisplayName, ENEMY_BASICS } from '../characters/enemyBasics.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';
import { firstName, monsterName, BANK_TYPES, GENDERS } from '../characters/nameHelper.js';
import { getSeed, setSeed, srand } from '../formats/dfRandom.js';
import { personalityFor, isPersonality, personalityLabel, voiceLine, beastBody, possessive, MUTE_KINDS } from './revenantPersonality.js';   // REVENANT-VOICE: who it is, and how it talks
// FEUD, Part B (bible/12-Enhanced-AI/Feud-Arc.md sections 12-26): what a revenant remembers - its record's new fields and
// the draws it is born with (systems/revenantFeud.js), and the fight's ledger (systems/feudLedger.js, a leaf)
import { ADAPT_HOW, DESERT, deserterSplit, LOYALTY, movedLoyalty, ROUT, FESTER, festersOn, WRATH_MAX, idStream, TOOK_MAX, LAIR_RING_R, RUMOR_CHANCE, RUMOR_PX, RUMOR_WEAK, RUMOR_NAMED, RUMOR_HINTS, weaknessKind, lairAfter, sameLair, feudFields, newFeudFields, feudScars, withScars, weaponFeudClass, drawSignature, sanitizeLoyalty, hashStr, SIG_RANK, lessonOf, withLesson, adaptEdge, adaptBlowClass, ADAPT, isWeakBlow, metalOf, WEAK, WEAK_NAMES, FLINCH_LINES, FLINCH_HEALTH, WEAKNESS_ELEMENTS, signatureStamp } from './revenantFeud.js';
import { tagHit, HIT_TAGS } from '../ui/hitNumbers.js';   // RVN3: the "Weakness" word on my blow's number
import { SOUND } from './soundClips.js';   // RVN3: the hiss of a weakness found
import { revenantSay as sayRevenant } from './revenantVoice.js';   // RVN3: the reveal's card (the re-export below binds no local name)
import { registerBlowTakenMod } from './blowTaken.js';   // RVN2: what its adaptations take off a blow (the leaf the formulas and a spell's landing read)
import { registerEntityFold, newMods, EMPTY_MODS, computeEntityMods } from './entityMods.js';   // RVN2: its elemental adaptations on the saving throw
import { registerSilverDoubleVeto } from '../combat/formulas.js';   // RVN2: a Silver-scarred one's double gone
import { setFeudGate, setFeudClock, noteFeudHarm, noteFeudBackstab, takeFeud, setFeudWeakTest, feudWeakBlow, elementFeudClass } from './feudLedger.js';

// ── the numbers ─────────────────────────────────────────────────────
/** A revenant is a foe of this level or more (LOOT7's champion floor, ELITE-FLOOR's). */
export const REVENANT_MIN_LEVEL = 3;
/** How many living revenants a character keeps; a new one past it replaces the weakest, oldest. */
export const REVENANT_MAX = 5;
/** The highest rank a revenant climbs to. */
export const REVENANT_MAX_RANK = 5;
/** Under this share of its health a special foe may run - once, the first time it falls under. */
export const REVENANT_FLEE_HEALTH = 0.2;
/** ...and runs on this roll: a "very small chance" for an elite or a champion, a better one for a revenant already. */
export const REVENANT_FLEE_CHANCE = 0.05;
export const REVENANT_FLEE_CHANCE_REVENANT = 0.15;
/** How long a fleeing foe runs (the motor's flee, characters/enemyMotor.js) - out of reach when it ends, it escapes. */
export const REVENANT_FLEE_SECONDS = 8;
/** ...or the moment it is this far from the player. */
export const REVENANT_ESCAPE_DISTANCE = 45;
/** ...or its run spent past this far (metres). Spent nearer - chased down - it is CORNERED: it turns and fights. */
export const REVENANT_ESCAPE_NEAR = 20;
/** How many slain revenants a character's page keeps (the newest); older ones, and the forgotten, leave a tombstone. */
export const REVENANT_FALLEN_MAX = 12;
/** How many tombstones are kept - each one id and a revision, so an older save never raises what was put down. */
export const REVENANT_TOMBS_MAX = 200;
/** It comes back between one and three days later, on the character's own clock. */
export const REVENANT_RETURN_MIN_MINUTES = 1440;
export const REVENANT_RETURN_MAX_MINUTES = 4320;
/** A due revenant takes an open-world encounter roll this often. */
export const REVENANT_RETURN_CHANCE = 0.5;
/** Out in the world and gone unfought (outrun, a load, a sweep), it waits this long and comes again. */
export const REVENANT_LOST_MINUTES = 360;
/** Its rank over what it was: health and blows per rank, and a class foe's level per rank. */
export const REVENANT_HEALTH_PER_RANK = 0.25;
export const REVENANT_DAMAGE_PER_RANK = 0.1;
export const REVENANT_LEVEL_PER_RANK = 2;
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
 *  voice's, systems/revenantPersonality.js MUTE_KINDS - who it is leans by it too). */
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
  // from rank 3, whatever the deed
  risen: Object.freeze(['the Thrice-Risen', 'the Undying', 'the Dread', 'Revenant of {p}', 'the Relentless', '{p}\'s Shadow']),
});
// REVENANT-VOICE: what each says, in its own personality's voice, is systems/revenantPersonality.js's.

// ── the store ───────────────────────────────────────────────────────
/** RVN1 (section 26): the deeds FEUD adds - felled (RVN10), routed (RVN10), festered (RVN9), deserted and betrayed
 *  (RVN11), laststand (RVN4).
 *  @typedef {{ deed: 'slew'|'fled'|'returned'|'fell'|'yielded'|'executed'|'spared'|'released'|'felled'|'routed'|'festered'|'deserted'|'betrayed'|'laststand', at: number }} RevenantDeed */
/** REVENANT-COMPANION: a sworn one's place - walking with the player, sent away (called back at will), or resting after
 *  a fall (`until` the character's minute it is fit again) - its health carried between places, and its pack. RVN1:
 *  its `loyalty` (0-100, RVN11's - its personality's start when sworn); RVN11: `rested` (fit after a rest, not yet called)
 *  and `sentDay` (the day it was last sent away).
 *  @typedef {{ state: 'with'|'away'|'resting', health: number|null, maxHealth: number|null, until: number|null, items: any[], loyalty: number, rested: boolean, sentDay: number|null }} RevenantCompanion */
/** @typedef {{ id: string, rev: number, mobileType: number, gender: 'male'|'female', given: string, epithet: string,
 *   name: string, rank: number, kills: number, escapes: number, returns: number, trait: string|null, elite: boolean,
 *   born: number, dueAt: number, out: boolean, outAt: number, defeated: boolean, defeatedAt: number|null,
 *   notice: string|null, history: RevenantDeed[], archive: number|null, personality: string,
 *   fate: 'executed'|'sworn'|'released'|null, sworn: boolean, swornAt: number|null, companion: RevenantCompanion|null,
 *   scars: {k: string, at: number}[], learned: string[], weak: string, weakKnown: 0|1|2, sig: string|null, kin: number[],
 *   lair: {px: number, py: number, name: string, region: number}|null, lairKnown: boolean, took: any[], wrath: number,
 *   fights: number, gone?: boolean }} RevenantRecord */
// RVN1 (section 26): every field after `companion` is FEUD's, its law and an older record's value systems/revenantFeud.js
// feudFields; the signature's name, the band's name and the epithets are derived from them, never stored

/** RVN1: `lastDay` - the character's last day festering was counted to (RVN9's), kept with the list.
 *  @type {{ list: RevenantRecord[], mirrorId: string|null, lastDay: number|null }} */
const _state = { list: [], mirrorId: null, lastDay: null };
/** RVN1: a day read back (a save, the mirror) - a whole day, else none. */
const sanitizeDay = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
/** RVN1: two days as one - the later (a reload never counts a day twice). */
const laterDay = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));

export const revenantOn = () => lootRarityOn();
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
/** RVN2: what a standing revenant carries of its record - its name and rank (FOE-TITLE, TELL's tier), what it learned and
 *  its weakness, and `edge`, what they do (systems/revenantFeud.js adaptEdge: the brain, the motor, the doors and the
 *  formulas read it there). */
const revenantStamp = (r) => ({ id: r.id, name: r.name, rank: r.rank, learned: [...(r.learned ?? [])], weak: r.weak ?? null, edge: adaptEdge(r.learned, r.weak), sigBlow: signatureStamp(r) });   // RVN5: its signature (rank 2 and up)

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
    if (mobileType >= 128) {
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
/** REVENANT-COMPANION: the revenants sworn to the player - with it, away, or resting. */
export const swornRevenants = () => _state.list.filter((r) => r.sworn && !r.defeated && !r.gone);
/** Every record, the slain too - a journal's page (never a tombstone). */
export const allRevenants = () => _state.list.filter((r) => !r.gone);
/** REVENANT-PAGE: this character's records (the mirror read in first), the slain too - the pause menu's page. */
export function revenantsFor(player) { ensureMirror(player); return allRevenants(); }
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
function sanitizeCompanion(c, personality = null) {
  const state = c?.state === 'away' || c?.state === 'resting' ? c.state : 'with';
  const hp = Number(c?.health), max = Number(c?.maxHealth);
  return {
    state, health: c?.health != null && Number.isFinite(hp) && hp > 0 ? hp : null, maxHealth: c?.maxHealth != null && Number.isFinite(max) && max > 0 ? max : null,
    until: state === 'resting' && isNum(c?.until) ? c.until : null,
    items: Array.isArray(c?.items) ? c.items.filter((it) => it && typeof it === 'object') : [],
    loyalty: sanitizeLoyalty(c?.loyalty, personality),   // RVN1 (section 26): 0-100, else its personality's start (RVN11's)
    rested: state === 'away' && c?.rested === true,   // RVN11 (22.1): fit again after a rest and not yet called (its call +10)
    sentDay: Number.isInteger(c?.sentDay) && c.sentDay >= 0 ? c.sentDay : null,   // RVN11 (22.1): the day it was last sent away
  };
}
/** A record read back (a save, the app's storage) - the shape checked, anything else dropped. */
function sanitize(r) {
  if (r && isStr(r.id) && r.id && r.gone === true) return { id: r.id, rev: isNum(r.rev) ? r.rev : 0, gone: true };   // a tombstone: the id and its revision alone
  if (!r || !isStr(r.id) || !r.id || !Number.isInteger(r.mobileType) || !isStr(r.given) || !isStr(r.epithet)) return null;
  const rank = Math.max(1, Math.min(REVENANT_MAX_RANK, Number.isInteger(r.rank) ? r.rank : 1));
  const personality = isPersonality(r.personality) ? r.personality : personalityFor(r.id, r.mobileType);   // REVENANT-VOICE: an older record's, drawn from its id as a new one's is
  return {
    id: r.id, rev: isNum(r.rev) ? r.rev : 0, mobileType: r.mobileType, gender: r.gender === 'female' ? 'female' : 'male',
    given: r.given, epithet: r.epithet, name: isStr(r.name) && r.name ? r.name : joinName(r.given, r.epithet), rank,
    kills: isNum(r.kills) ? r.kills : 0, escapes: isNum(r.escapes) ? r.escapes : 0, returns: isNum(r.returns) ? r.returns : 0,
    trait: isStr(r.trait) && r.trait ? r.trait : null, elite: !!r.elite,
    born: isNum(r.born) ? r.born : 0, dueAt: isNum(r.dueAt) ? r.dueAt : 0,
    out: false, outAt: 0,   // never out across a load: the foe that stood for it is not in a fresh world
    defeated: !!r.defeated, defeatedAt: isNum(r.defeatedAt) ? r.defeatedAt : null,
    notice: isStr(r.notice) ? r.notice : null,
    archive: Number.isInteger(r.archive) ? r.archive : null,
    personality,
    // REVENANT-FATE: how it ended (or did not) - executed, sworn to the player, released by the player
    fate: FATES.has(r.fate) ? r.fate : null, sworn: !!r.sworn && !r.defeated, swornAt: isNum(r.swornAt) ? r.swornAt : null,
    companion: r.sworn && !r.defeated ? sanitizeCompanion(r.companion, personality) : null,
    history: Array.isArray(r.history) ? r.history.filter((d) => d && isStr(d.deed) && isNum(d.at)).slice(-HISTORY_MAX).map(historyOf) : [],
    ...feudFields(r, { id: r.id, mobileType: r.mobileType, rank }),   // RVN1 (section 26): FEUD's fields, each by its law
  };
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
    if (!r.gone && r.companion) r.companion.items = s?.companion?.items ? s.companion.items.slice() : [];
    // AUDIT FEUD: what the save's living, unsworn copy held, on a record the mirror has since seen fall or sworn - the fall
    // dropped it, the oath handed it back, and the reloaded pack never had it: mine again. AUDIT FEUD 2: or forgotten since
    if (player && s?.took?.length && !s.defeated && !s.sworn && (r.gone || r.defeated || r.sworn)) { player.items ??= []; for (const it of s.took) addItem(player.items, it); if (!r.gone) r.took = []; continue; }
    if (r.gone) continue;
    r.took = s?.took ? s.took.slice() : [];   // RVN8 (Feud-Arc.md 19): what it took is inventory too - the save's copy wins (the mirror never brings back a piece the save holds)
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
 *  `keep` (the one just made, or one just turned from the sworn - RVN11b), one standing in the world, or one holding a
 *  piece of mine. */
function trimLiving(keep) {
  const living = livingRevenants();
  if (living.length > REVENANT_MAX) {
    const drop = living.filter((x) => x !== keep && !x.out && !x.took?.length).sort((x, y) => x.rank - y.rank || x.born - y.born)[0];   // RVN8: never one holding a piece of mine   // AUDIT (2026-10-02): never one standing in the world
    if (drop) bury(drop);
  }
}
const deed = (r, d, at, extra = null) => { r.history.push({ deed: d, at, ...(extra ?? {}) }); if (r.history.length > HISTORY_MAX) r.history.splice(0, r.history.length - HISTORY_MAX); };   // RVN10: a felling names its companion
const dueFrom = (now, rolls) => now + REVENANT_RETURN_MIN_MINUTES + Math.floor(rolls() * (REVENANT_RETURN_MAX_MINUTES - REVENANT_RETURN_MIN_MINUTES + 1));

// ── who may become one ──────────────────────────────────────────────
/** A foe that may become (or stay) a revenant: special (an elite, a champion, a revenant already), of the floor's level,
 *  never the watch or an ally; `rec` the pool's record when there is one - never a quest's foe or a summons. */
export function revenantCandidate(entity, rec = null) {
  if (!entity || !revenantOn()) return false;
  if (entity.retinueOf != null) return false;   // RVN6 (Feud-Arc.md 17): a band's follower is its master's, never one itself
  if (entity.bout) return false;   // AUDIT ARENA-LADDER 2: a fighter on the sand is its bout's - an elite champion never flees it as a revenant, nor becomes one
  const special = !!entity.revenant || !!entity.eliteFoe || (typeof entity.champion === 'string' && !!entity.champion);
  if (!special) return false;
  if ((entity.level | 0) < REVENANT_MIN_LEVEL) return false;
  if (entity.mobileType === KNIGHT_CITY_WATCH || entity.team === 'PlayerAlly' || entity.mobileTeam === 'PlayerAlly') return false;
  if (rec && (rec.questBehaviour || rec.allied || rec.questMarker)) return false;
  return true;
}

// ── the deeds ───────────────────────────────────────────────────────
/** Make `entity` a revenant for what it just did (`deed` 'slew' or 'fled'), or rank up the one it already is. Answers
 *  the record, or null when it may not be one. `mobileType`/`gender` from the pool's record where the entity lacks
 *  them. */
export function revenantDeed(player, entity, deedName, { mobileType = entity?.mobileType, gender = 'male', rec = null, archive = null, now = nowMinutes(), rolls = Math.random, ally = null, unbroken = false } = {}) {   // RVN10: `ally` the companion a felling knocked out; RVN12b: `unbroken` - its will held at the killing blow (RVN3's tear-away)
  // RVN1: the fight is over - its ledger taken whatever the answer (it dies with the fight). AUDIT FEUD: but a felling
  // is no end - the foe fights on, its will read from that ledger (RVN3): it stays whole for the deed that ends the fight
  const ledger = deedName === 'felled' ? null : takeFeud(entity);
  if (!revenantCandidate(entity, rec) || !Number.isInteger(mobileType)) return null;
  ensureMirror(player);
  const pName = player?.name ?? '';
  let r = entity.revenant?.id ? revenantById(entity.revenant.id) : null;
  // AUDIT (2026-10-02): a judged one - executed, released, sworn - does no deed (a poison of its own finishing the player
  // after it knelt raised it again, under its own id); and a forgotten one's id is never worn again
  if (r && (r.defeated || r.sworn)) return null;
  if (!r && entity.revenant?.id) entity.revenant = null;
  if (r) {
    r.rank = Math.min(REVENANT_MAX_RANK, r.rank + 1);
    r.epithet = revenantEpithet(deedName, r.rank, pName, rolls, r.epithet, allyName(ally) ?? '');
    if (r.rank >= SIG_RANK && !r.sig) r.sig = drawSignature(r.id, r.mobileType);   // RVN1 (RVN5's field): its signature, drawn on its id at rank 2
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
      ...newFeudFields(id, mobileType, 1, entity.career ?? null),   // RVN1 (section 26): its draws (the weakness never what its career shrugs off), and nothing yet learned
    };
    _state.list.push(r);
    trimLiving(r);
  }
  r.name = joinName(r.given, r.epithet);
  if (deedName === 'slew') { r.kills++; r.notice = 'slew'; _lastSlew = { id: r.id, at: Date.now() }; } else if (deedName === 'fled') { r.escapes++; r.notice = null; }   // RVN8: this death's killer, for the respawn   // RVN10: a felling or a rout is no escape of its own (AUDIT FEUD: nor clears the card a kill left waiting)
  r.dueAt = dueFrom(now, rolls);
  deed(r, deedName, now, deedName === 'felled' && allyName(ally) ? { ally: allyName(ally) } : deedName === 'fled' && unbroken ? { unbroken: true } : null);
  // RVN1 (section 12): the fight folded into its SCARS - its leading source, its lessons, the deed - and counted
  const kinds = feudScars(ledger, deedName);
  r.scars = withScars(r.scars, kinds, now);
  r.fights = (r.fights | 0) + 1;
  // RVN2 (13.1): and one lesson LEARNED of it - at most its rank's adaptations, the oldest forgotten
  const lesson = lessonOf(kinds, r.learned, r.mobileType, entity.career ?? null);
  if (lesson) r.learned = withLesson(r.learned, lesson, r.rank);
  // RVN7 (18.1): ITS LAIR - where the deed was done says where it goes to ground (the host's door: its map pixel and the
  // dungeons in reach, or the dungeon it is in); a lair moved is a lair the player has not heard of
  const lair = lairAfter(r, playerDoor()?.lairHere?.() ?? null);
  if (!sameLair(lair, r.lair)) { r.lair = lair; r.lairKnown = false; }
  // the foe that did it wears its name at once - while it still stands (a killer over my body), it IS the revenant
  const p2 = entity.revenant?.p2 ?? null;   // AUDIT FEUD 2: a felling in its last stand keeps the stand's phase two
  const blows = entity.revenant?.blows ?? null;   // FEUD WIRE: and the stand's blows it still strikes with
  entity.revenant = revenantStamp(r);   // RVN2: and what it learned, at once
  if (p2) entity.revenant.p2 = p2;
  if (blows) entity.revenant.blows = blows;
  computeEntityMods(entity);
  r.out = deedName === 'slew' || deedName === 'felled';   // RVN10 (21.1): a felling foe still stands, as a killer over my body does
  r.outAt = r.out ? Date.now() : 0;
  touch(r);
  prune();
  persist();
  return r;
}

/** THE KILL. A killing BLOW names its foe (the struck seam's attacker, systems/sigilSetPowers.js's landed blow); a
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

/** THE FLEE ROLL: does this special foe, under REVENANT_FLEE_HEALTH of its health for the first time, run? */
export function rollRevenantFlee(entity, rolls = Math.random) {
  if (!revenantCandidate(entity)) return false;
  return rolls() < (entity.revenant ? REVENANT_FLEE_CHANCE_REVENANT : REVENANT_FLEE_CHANCE);
}
/** Under the line? (a foe's own share of its health; a dead one never) */
export const revenantFleeHealth = (entity) => !!entity && entity.health > 0 && entity.health < (entity.maxHealth || 1) * REVENANT_FLEE_HEALTH;

/**
 * THE FLEE, ONE LAW FOR EVERY POOL (scenes/exteriorFoes.js, scenes/dungeonContext.js): one frame of a foe record
 * `f` ({ entity, ai, fleeing?, _fleeRolled? }) against the player's feet. Answers what the host does now:
 *   'start'    - it breaks and runs (the motor's flee, characters/enemyMotor.js) - say it; no blow, no cast; its walk drawn
 *   'run'      - still running: no blow, no cast; its walk drawn
 *   'escape'   - out of reach (REVENANT_ESCAPE_DISTANCE off, or its run spent past REVENANT_ESCAPE_NEAR): retire it - no
 *                corpse, no kill - and make it a revenant (revenantDeed 'fled')
 *   'cornered' - its run spent with the player close behind: it turns and fights to the end (it never runs again) - say it
 *   null       - nothing: it fights on as ever
 * `onMe()` - whether it fights the player (asked only when it might run); `mayRun` - the host's word that the foe is the
 * player's alone (a room's shared foe never runs: vanishing on one client would leave it standing on the rest).
 */
export function revenantFleeStep(f, feet, { onMe = () => true, mayRun = true, rolls = Math.random } = {}) {
  if (f.fleeing) {
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
  f.ai.flee(feet, REVENANT_FLEE_SECONDS);
  return 'start';
}

/** Slain: the record is closed. Answers the record (its name for the line), or null for no revenant. */
export function revenantSlain(player, entity, { now = nowMinutes(), deedName = 'fell' } = {}) {
  const id = entity?.revenant?.id;
  if (!id) return null;
  ensureMirror(player);
  const r = revenantById(id);
  if (!r || r.defeated || r.sworn) return null;   // REVENANT-COMPANION: a sworn one's fall is a knock-out, never this
  r.defeated = true; r.defeatedAt = now; r.out = false; r.notice = null;
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
  const r = entity?.revenant?.id ? (ensureMirror(player), revenantById(entity.revenant.id)) : null;
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
  const r = entity?.revenant?.id ? (ensureMirror(player), revenantById(entity.revenant.id)) : null;
  if (!r || r.defeated || r.sworn) return null;
  r.sworn = true; r.fate = 'sworn'; r.swornAt = now; r.out = false; r.notice = null;
  r.companion = sanitizeCompanion({ state, health, maxHealth }, r.personality);   // RVN1: sworn at its personality's loyalty
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
  r.companion ??= sanitizeCompanion(null, r.personality);
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

// ── the return ──────────────────────────────────────────────────────
/** An open-world encounter roll's question: does a revenant come instead? The one due (its time come, none of the
 *  character's out in the world already), the highest rank first, on REVENANT_RETURN_CHANCE. Answers the record, or null. */
export function revenantToReturn(player, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!revenantOn()) return null;
  ensureMirror(player);
  const living = livingRevenants();
  if (living.some((r) => r.out)) return null;
  const night = skyIsNight();
  const due = living.filter((r) => r.dueAt <= now && (night || !(r.learned ?? []).includes('nightStalker'))).sort((a, b) => b.rank - a.rank || a.dueAt - b.dueAt);   // RVN2: a Night-stalker comes only by night
  if (!due.length || rolls() >= REVENANT_RETURN_CHANCE) return null;
  // CLAIMED from here: its stand crosses awaits (the career's bytes, the sprite) and the next roll must not stand it twice
  due[0].out = true;
  due[0].outAt = Date.now();
  return due[0];
}
// ── RVN8: what it takes (bible/12-Enhanced-AI/Feud-Arc.md 19) ─────────────────────────────────────────────────────
/** This death's killer, by the slew deed - taken (once) at the respawn; AUDIT FEUD: forgotten by a rise that is none
 *  (a Resurrect - forgetLastSlew), a load and a new game. */
let _lastSlew = null;
/** AUDIT FEUD: a rise where I fell (a party member's Resurrect) - no respawn, so its killer takes nothing then or later. */
export function forgetLastSlew() { _lastSlew = null; }
/** RVN8 (19): may it take `item` - never a quest item, a summoned piece, the Materials Bag, gold, or a locked piece
 *  (LOCK1's promise, "A LOCKED PIECE STAYS YOURS"). */
export const revenantMayTake = (item) => !!item && typeof item === 'object' && Number.isInteger(item.templateIndex)
  && !item.questItem && !isSummoned(item) && !isGoldPieces(item) && !isBagItem(item) && !isLocked(item);
/** AUDIT FEUD: a piece it took, named after "your", "my" or "lovely" - the name the pack shows, its own article gone
 *  (a legendary's "The Glenmoril Bow": "your Glenmoril Bow", never "your The ..."). */
export const takenName = (item) => String(itemLongName(item) ?? '').replace(/^the\s+/i, '');
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
 *  crosses awaits). Decided here: a Night-stalker is at home at any hour - the dark is its own underground. */
export function revenantForLair(player, here, { now = nowMinutes(), dueOnly = false } = {}) {   // `dueOnly`: a rest's answer - due, never merely known
  if (!revenantOn() || !here || !Number.isInteger(here.px) || !Number.isInteger(here.py)) return null;
  ensureMirror(player);
  const r = livingRevenants().filter((x) => !x.out && x.lair && x.lair.px === here.px && x.lair.py === here.py && (x.dueAt <= now || (!dueOnly && x.lairKnown)))
    .sort((a, b) => b.rank - a.rank || a.dueAt - b.dueAt)[0] ?? null;
  if (!r) return null;
  r.out = true;
  r.outAt = Date.now();
  return r;
}
/** A claimed stand that stood nobody (no place for it, the pool full, a sweep) - free to come on a later roll. */
export function releaseRevenantStand(r) {
  if (r && r.out && !r.defeated && !r.gone) { r.out = false; r.outAt = 0; }
}
/** The spawn options a returning revenant stands with (scenes/exteriorFoes.js spawnFoe): its record, its gender, and a
 *  class foe's level over the player's. */
export function revenantSpawnOptions(r, playerLevel) {
  return { revenant: r, gender: r.mobileType >= 128 ? r.gender : null, level: r.mobileType >= 128 ? Math.max(1, (playerLevel | 0) + r.rank * REVENANT_LEVEL_PER_RANK) : null };   // a monster's sprite is its kind's, whatever its gender
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
  // RVN2 (13.2): a Relentless one's Speed (on its stats, at the stand); a Night-stalker's blows (it comes only by night -
  // revenantToReturn); an elemental one's saving throw (the fold, folded now - a stand has had no magic round yet)
  const edge = entity.revenant.edge;
  if (edge.relentless && entity.stats) entity.stats.speed = (entity.stats.speed ?? 0) + ADAPT.RELENTLESS_SPEED;
  if (edge.nightStalker && skyIsNight()) entity.damageScale *= ADAPT.NIGHT_BLOWS;
  entity.revenant.blows = entity.damageScale / prior;   // FEUD WIRE (Feud-Arc.md 25): its stand's blows over its kind's, for its puppets (revenantFeud.js feudWire `rb`)
  computeEntityMods(entity);
  r.out = true; r.outAt = Date.now();
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
    if (!r.out || r.defeated || r.gone || r.sworn || wall - r.outAt < 15000) continue;
    pools ??= [...(foes ?? []), ...(playerDoor()?.foes?.() ?? [])];
    const here = pools.some((f) => f && !f.dead && f.entity?.revenant?.id === r.id);
    if (here) continue;
    r.out = false;
    r.dueAt = Math.max(r.dueAt, now + REVENANT_LOST_MINUTES);
    touch(r);
    changed = true;
  }
  if (changed) persist();
  return changed;
}

// ── its drop ────────────────────────────────────────────────────────
/** A revenant's drop, over its kind's: gold by level and rank, and gear on chances that grow with the rank. */
export function revenantLoot(level = 1, rank = 1, rolls = Math.random, goldMult = 1) {
  const lv = Math.max(1, level | 0), rk = Math.max(1, Math.min(REVENANT_MAX_RANK, rank | 0));
  const out = [];
  const L = REVENANT_LOOT;
  if (rolls() < L.magicChance) { const it = tieredGear(lv, 'magic', rolls); if (it) out.push(it); }
  if (rk >= L.rareFromRank || rolls() < L.rareChance + L.rarePerRank * rk) { const it = tieredGear(lv, 'rare', rolls); if (it) out.push(it); }
  if (rolls() < L.legendaryChance + L.legendaryPerRank * rk) { const it = tieredGear(lv, 'legendary', rolls); if (it) out.push(it); }
  const [lo, hi] = L.goldPerLevel;
  out.push(goldStack(Math.round(lv * rk * (lo + rolls() * (hi - lo)) * (goldMult > 0 ? goldMult : 1))));   // RVN7d: found in its lair, x LAIR_GOLD
  return out;
}
/** Give a returned revenant its drop (once) - RVN7d: its gold x `goldMult` (LAIR_GOLD, found in its lair). */
export function grantRevenantLoot(entity, level, rolls = Math.random, { goldMult = 1 } = {}) {
  if (!entity?.revenant || entity._revenantLoot) return;
  entity._revenantLoot = true;
  entity.items = entity.items ?? [];
  entity.items.push(...revenantLoot(level ?? entity.level, entity.revenant.rank ?? 1, rolls, goldMult));
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
// Every word below comes two ways: the EVENT a face draws (REVENANT-CARD - ui/revenantCard.js on the enhanced skin: the
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
export const revenantEscapeLine = (r) => `${r.given} got away. ${r.name} will remember this.`;
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
 *  (characters/mobileUnit.js's tables). Null for a kind with no sprite. */
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
  return revenantEvent('flee', src, { speech: v.speech, body: v.speech ? null : v.body, line: v.speech ? `${src.name} breaks and runs! "${v.speech}"` : v.line, archive });
}
/** Run down before it got away: it turns and fights. */
export function revenantCorneredEvent(entity, base, { gender = 'male', archive = null, rolls = Math.random, playerName = '' } = {}) {
  const src = liveSource(entity, base, gender);
  const v = voiceParts(src, 'cornered', src.id ? playerName : '', rolls);
  return revenantEvent('cornered', src, {
    speech: v.speech, body: v.speech ? 'Cornered - it turns to fight.' : v.body,
    line: v.speech ? `${src.name} is cornered and turns to fight! "${v.speech}"` : v.line, archive,
  });
}
/** Out of reach - a revenant now, or a stronger one. */
export function revenantEscapeEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  return revenantEvent('escape', r, {
    speech: voiceParts(r, 'escape', playerName, rolls).speech,
    body: `Got away. ${r.rank > 1 ? `Now rank ${revenantRankNumeral(r.rank)} - it` : 'It'} will remember this.`,
    line: revenantEscapeLine(r), archive,
  });
}
/** RVN3 (14.1): its weakness - found (my blow of it: what it is) or hinted (its flinch: the narrator's line). */
export function revenantWeaknessEvent(r, { found = false, archive = null } = {}) {
  const name = WEAK_NAMES[r?.weak] ?? 'Something';
  const body = found ? `${name} - its weakness, laid bare.` : (FLINCH_LINES[r?.weak] ?? 'It shies from something.');
  return revenantEvent('weakness', r, { body, line: `${r.name}: ${body}`, archive });
}
/** RVN3 (14.2): its will unbroken - at the killing blow it tears away into the smoke (an escape: it ranks up and learns). */
export function revenantUnbrokenEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  const body = `${r.given} staggers into the smoke, unbroken.`;
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
  if (!revenantOn() || !here || !session || !Number.isInteger(here.px) || !Number.isInteger(here.py)) return null;
  if (!((session.numAnswersGivenTellMeAboutOrRumors | 0) < MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS || session.isSpyMaster)) return null;
  const inRegion = (r) => Number.isInteger(here.region) && here.region >= 0 && r.lair.region === here.region;
  const near = livingRevenants().filter((r) => r.lair && (inRegion(r) || Math.hypot(r.lair.px - here.px, r.lair.py - here.py) <= RUMOR_PX));
  if (!near.length || !(rolls() < RUMOR_CHANCE)) return null;
  const r = near[Math.min(near.length - 1, Math.floor(rolls() * near.length))];
  const dx = r.lair.px - here.px, dy = r.lair.py - here.py, d = Math.max(Math.abs(dx), Math.abs(dy));
  const kind = String(enemyDisplayName(r.mobileType) ?? 'creature').toLowerCase();
  const what = r.scars?.length ? `a scarred ${kind}` : `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`;
  const where = d === 0 ? `in ${r.lair.name}, close by` : `near ${r.lair.name}, ${distanceWord(d)} to the ${compassWord(dx, dy)}`;
  let words = `They say ${what} called ${r.name} has been seen ${where}.`;
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
/** RVN7c (bible/12-Enhanced-AI/Feud-Arc.md 18.3): THE LAIRS HEARD OF, ON THE MAPS - a circle at each living, unsworn
 *  revenant's lair the player knows (`lairKnown`), named for it (ui/bountyMapMark.js's shape, in blood red). */
export function revenantMapMarks() {
  if (!revenantOn()) return [];
  return livingRevenants().filter((r) => r.lair && r.lairKnown).map((r) => ({ cx: r.lair.px + 0.5, cy: r.lair.py + 0.5, r: LAIR_RING_R, label: r.given ?? r.name, id: r.id }));
}
/** RVN7c (18.3): THE HUNTS, IN THE QUEST LOG - each lair heard of as an active side quest (scenes/questBridge.js
 *  questLog's shape, BOUNTY1's precedent): "Hunt: Grushnak the Butcher", the way there from `here` (my map pixel), no
 *  clock. Its Abandon (systems/huntJournal.js) forgets the lair. */
export function revenantHuntEntries(here = null) {
  if (!revenantOn()) return [];
  const line = (text) => ({ formatting: 'text', text });
  return livingRevenants().filter((r) => r.lair && r.lairKnown).map((r) => {
    const dx = Number.isInteger(here?.px) ? r.lair.px - here.px : 0, dy = Number.isInteger(here?.py) ? r.lair.py - here.py : 0;
    const way = dx || dy ? `, ${distanceWord(Math.max(Math.abs(dx), Math.abs(dy)))} to the ${compassWord(dx, dy)}` : '';
    const kind = enemyDisplayName(r.mobileType) ?? 'Revenant';
    const lines = [`${kind}, rank ${revenantRankNumeral(r.rank)}.`, `Its lair: ${r.lair.name}${way} - marked on your map with a red circle.`, 'Find it there before it finds you.'];
    return { id: `${HUNT_QUEST_PREFIX}${r.id}`, name: `Hunt: ${r.name}`, questName: 'HUNT', hunt: true, clockSeconds: null, messages: [lines.map(line)] };
  });
}
/** RVN7c: a hunt given up - its lair forgotten (heard again, it comes back). */
export function forgetRevenantLair(id) {
  const r = revenantById(id);
  if (!r || !r.lairKnown) return false;
  r.lairKnown = false;
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
  if (_state.lastDay == null) { _state.lastDay = day; persist(); return []; }   // the first count: from here
  if (day <= _state.lastDay) return [];   // the encounter tick's every ask: nothing new. AUDIT FEUD: nor a clock behind it (a reload of an older save) - the mirror counted those days; none counts twice
  const up = [];
  for (let d = Math.max(_state.lastDay + 1, day - FESTER.CATCHUP + 1); d <= day; d++) {
    for (const r of livingRevenants()) {
      if (r.out || !festersOn(Math.floor((r.dueAt ?? 0) / MINUTES_PER_DAY), d)) continue;
      if (r.rank >= REVENANT_MAX_RANK) { r.wrath = Math.min(WRATH_MAX, (r.wrath | 0) + 1); touch(r); continue; }
      r.wrath = (r.wrath | 0) + 1;
      if (r.wrath >= WRATH_MAX) {
        r.rank += 1;
        r.wrath = 0;
        r.epithet = revenantEpithet('festered', r.rank, player?.name ?? '', rolls, r.epithet);
        r.name = joinName(r.given, r.epithet);
        if (r.rank >= SIG_RANK && !r.sig) r.sig = drawSignature(r.id, r.mobileType);
        deed(r, 'festered', d * MINUTES_PER_DAY);
        r.notice = 'festered';
        up.push(r);
      }
      touch(r);
    }
    // RVN11 (22.1): THE SWORN'S DAY - a day with me +2, a day sent away -1 (a resting one's day moves nothing)
    for (const r of swornRevenants()) {
      const st = r.companion?.state;
      if (st !== 'with' && st !== 'away') continue;
      r.companion.loyalty = movedLoyalty(r.companion.loyalty, st === 'with' ? LOYALTY.DAY_WITH : LOYALTY.DAY_AWAY);
      touch(r);
    }
    // RVN11b (22.2): DESERTION - under DESERT.AT, once a day (a resting one too), one time in DESERT.CHANCE
    for (const r of swornRevenants()) {
      if (r.companion?.loyalty < DESERT.AT && rolls() < DESERT.CHANCE) revenantDeserts(player, r, { now: d * MINUTES_PER_DAY, rolls });
    }
  }
  _state.lastDay = day;
  persist();
  return up;
}
/** RVN11b (bible/12-Enhanced-AI/Feud-Arc.md 22.2): the host's ear for a sworn one leaving the party by its own will (its
 *  member forgotten - systems/revenantCompanions.js registers it). */
let _swornLeft = null;
export function setSwornLeftListener(fn) { _swornLeft = typeof fn === 'function' ? fn : null; }
/** RVN11b: what a deserter kept and gave back, for its card (this session's; a reload's card says less). */
const _desertWords = new Map();
/** RVN11b (22.2): DESERTED - a sworn one under DESERT.AT leaves: no longer sworn, a living revenant again (its rank kept,
 *  the `deserted` deed, "the Oathbreaker" whatever its rank), due in one to three days; its pack split (OPEN 18) - the
 *  more valuable half kept on its record (RVN8's `took`, room for TOOK_MAX: carried at its stands and given back as a
 *  theft is), the rest into my pack and its gold into my purse. Its body leaves through its portal (the companion layer:
 *  no longer the party's); its notice is its card. Answers the record, or null. */
export function revenantDeserts(player, r, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!r?.sworn || r.defeated) return null;
  const { kept, back } = splitPack(player, r);
  r.sworn = false; r.fate = null; r.companion = null; r.out = false;
  r.epithet = REVENANT_EPITHETS.deserted[0];
  r.name = joinName(r.given, r.epithet);
  r.dueAt = dueFrom(now, rolls);
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
  const { kept, back } = deserterSplit(r.companion?.items ?? [], { value: itemValueOf, isGold: (it) => isGoldPieces(it) || !revenantMayTake(it), room: TOOK_MAX - (r.took?.length ?? 0) });
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
  if (!r?.sworn || r.defeated) return null;
  splitPack(player, r);   // its pack as a deserter's
  r.sworn = false; r.fate = null; r.companion = null;
  r.rank = Math.min(REVENANT_MAX_RANK, r.rank + 1);
  if (r.rank >= SIG_RANK && !r.sig) r.sig = drawSignature(r.id, r.mobileType);
  r.epithet = REVENANT_EPITHETS.betrayed[0];
  r.name = joinName(r.given, r.epithet);
  r.dueAt = dueFrom(now, rolls);   // should it get away
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
  const body = `${r.given} grows bolder - it has waited too long.`;
  return revenantEvent('festered', r, { body, line: body, archive });
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
  const body = `${r.given} felled ${who}. ${r.rank > 1 ? `Now rank ${revenantRankNumeral(r.rank)} - it` : 'It'} will remember this.`;
  return revenantEvent('felled', r, { body, line: `${r.name} felled ${who}.`, archive });
}
/** RVN10 (21.2): may this foe ROUT me - a special foe, alive, hostile and on me (detecting me), neither kneeling nor
 *  running itself, whose fight with me is live (its harm within harmMark's HARM_FIGHT_MS) and saw a hurt leave me under
 *  ROUT.LOW? The street pool asks it past ROUT.DISTANCE; a jump's sweep asks it of the pool I leave. */
export function revenantRoutable(f, { now = Date.now() } = {}) {
  if (!f?.entity || f.dead || f._routed || !(f.entity.health > 0) || f.yielded || f.executing || f.sparing || f.leaving || f.fleeing) return false;   // AUDIT FEUD: a tear-away is its escape, not my rout
  if (f.puppet) return false;   // AUDIT FEUD: a peer's foe is its owner's - my jump routs none of it (the street's distance asks none)
  if (!f.ai?.isHostile || !f.ai.detected || f.ai.targetIsLocalPlayer === false) return false;
  if (!revenantCandidate(f.entity, f)) return false;
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
  const body = `You ran from ${r.given}. ${r.rank > 1 ? `Now rank ${revenantRankNumeral(r.rank)} - it` : 'It'} will remember this.`;
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
  const body = `${r.given} rises again - its last stand.`;
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
export function revenantMomentEvent(kind, r, playerName, { body = null, line = null, rolls = Math.random, archive = null } = {}) {
  const v = voiceParts(r, kind, playerName, rolls);
  // AUDIT (2026-10-02): what the moment says (`body` - its trophy, where it will wait, what to do) is kept for a beast
  // after its deed, and on the text line after either's
  return revenantEvent(kind, r, {
    speech: v.speech, body: v.speech ? body : [v.body, body].filter(Boolean).join(' '),
    line: line ?? [v.line, body].filter(Boolean).join(' '), archive,
  });
}

// THE FACE (`setRevenantPresenter`, `revenantSay`) is a leaf's - systems/revenantVoice.js - so the HUD's card asks it
// without this file's imports.
export { setRevenantPresenter, revenantSay } from './revenantVoice.js';

/** The first pending notice, taken (said once): a revenant's kill, read when the player stands alive again - as the
 *  event a face draws (its `line` the text surfaces'). */
export function takeRevenantNotice(player, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!player || !(player.health > 0)) return null;
  ensureMirror(player);
  revenantFester(player, { now, rolls });   // RVN9: the days it waited, caught up first - a rank-up is its own notice
  const r = _state.list.find((x) => x.notice && !x.defeated);
  if (!r) return null;
  const ev = r.notice === 'slew' ? revenantRiseEvent(r, player.name) : r.notice === 'festered' ? revenantFesterEvent(r) : r.notice === 'deserted' ? revenantDesertEvent(r, { playerName: player.name }) : null;   // RVN11b: a deserter's card
  r.notice = null;
  touch(r);
  persist();
  return ev;
}

// ── the save ────────────────────────────────────────────────────────
registerModSaveData(REVENANT_SAVE, {
  newSaveData: () => ({ v: 1, list: [], lastDay: null }),
  // AUDIT (2026-10-02): one standing as the save is made comes back later (REVENANT_LOST_MINUTES), not at once beside
  // the street's copy of it - the street's save leaves it out (scenes/exteriorFoes.js snapshotWorld)
  getSaveData: () => ({ v: 1, list: _state.list.map((r) => (r.gone ? r : { ...r, out: false, outAt: 0, dueAt: r.out ? Math.max(r.dueAt, nowMinutes() + REVENANT_LOST_MINUTES) : r.dueAt })), lastDay: _state.lastDay }),
  restoreSaveData: (rec) => { _state.list = mergeRevenants(rec?.list ?? [], []); _state.lastDay = sanitizeDay(rec?.lastDay); _state.mirrorId = null; _lastSlew = null; clearPlayerHarm(); endPlayerFights(); },   // the last game's harm is no one's death in this one (RVN10: nor its fights a rout; AUDIT FEUD: nor its killer a thief)
  newGame: () => { _state.list = []; _state.lastDay = null; _state.mirrorId = null; _lastSlew = null; clearPlayerHarm(); endPlayerFights(); },
});

/** Tests only: forget everything. */
export function _resetRevenantForTests() { _state.list = []; _state.mirrorId = null; _state.lastDay = null; }
