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
import { registerPlayerStruckListener } from '../combat/formulas.js';   // REVENANT-HARM: a foe's blow leaves its mark (its poison's ticks come later)
import { markPlayerHarm, playerHarmMark, clearPlayerHarm, HARM_MARK_STRUCK_MS } from './harmMark.js';
import { playerDoor } from './playerDoor.js';
import { registerModSaveData } from './modSaveData.js';
import { appStorage } from './appStorage.js';
import { characterIdOf, mintCharacterId } from './characterId.js';
import { ownMinutes } from './worldTick.js';
import { tieredGear } from './eliteFoes.js';
import { goldStack } from './inventory.js';
import { enemyDisplayName, ENEMY_BASICS } from '../characters/enemyBasics.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';
import { firstName, monsterName, BANK_TYPES, GENDERS } from '../characters/nameHelper.js';
import { getSeed, setSeed, srand } from '../formats/dfRandom.js';
import { personalityFor, isPersonality, personalityLabel, voiceLine, beastBody, possessive, MUTE_KINDS } from './revenantPersonality.js';   // REVENANT-VOICE: who it is, and how it talks

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
// `{p}` is the player's first name. An epithet starting "the" follows the given name ("Grushnak the Butcher"); any
// other follows a comma ("Grushnak, Bane of Ayla").
export const REVENANT_EPITHETS = Object.freeze({
  slew: Object.freeze(['the Butcher', 'the Gravedigger', 'the Widowmaker', 'Bloodhand', 'Bane of {p}', 'the Unbowed', 'Who Slew {p}', 'the Reaper']),
  fled: Object.freeze(['the Scarred', 'the Survivor', 'the Cunning', 'the Hunted', 'Half-Dead', 'the Lucky', 'Who Ran', 'the Unbroken']),
  // from rank 3, whatever the deed
  risen: Object.freeze(['the Thrice-Risen', 'the Undying', 'the Dread', 'Revenant of {p}', 'the Relentless', '{p}\'s Shadow']),
});
// REVENANT-VOICE: what each says, in its own personality's voice, is systems/revenantPersonality.js's.

// ── the store ───────────────────────────────────────────────────────
/** @typedef {{ deed: 'slew'|'fled'|'returned'|'fell'|'yielded'|'executed'|'spared'|'released', at: number }} RevenantDeed */
/** REVENANT-COMPANION: a sworn one's place - walking with the player, sent away (called back at will), or resting after
 *  a fall (`until` the character's minute it is fit again) - its health carried between places, and its pack.
 *  @typedef {{ state: 'with'|'away'|'resting', health: number|null, maxHealth: number|null, until: number|null, items: any[] }} RevenantCompanion */
/** @typedef {{ id: string, rev: number, mobileType: number, gender: 'male'|'female', given: string, epithet: string,
 *   name: string, rank: number, kills: number, escapes: number, returns: number, trait: string|null, elite: boolean,
 *   born: number, dueAt: number, out: boolean, outAt: number, defeated: boolean, defeatedAt: number|null,
 *   notice: string|null, history: RevenantDeed[], archive: number|null, personality: string,
 *   fate: 'executed'|'sworn'|'released'|null, sworn: boolean, swornAt: number|null, companion: RevenantCompanion|null,
 *   gone?: boolean }} RevenantRecord */

/** @type {{ list: RevenantRecord[], mirrorId: string|null }} */
const _state = { list: [], mirrorId: null };

export const revenantOn = () => lootRarityOn();
const nowMinutes = () => { try { return Math.floor(ownMinutes()); } catch { return 0; } };
const firstWord = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'stranger';
const pick = (list, rolls) => list[Math.min(list.length - 1, Math.floor(rolls() * list.length))];
// AUDIT (2026-10-02): `{p}'s` the possessive the trophies spell ("Varis' Shadow"); a function replacement, so a `$` in
// a typed name is a letter, never a pattern
const fill = (s, { p = '', n = '' } = {}) => s.replace(/\{p\}'s/g, () => possessive(p)).replace(/\{p\}/g, () => p).replace(/\{n\}/g, () => n);
const joinName = (given, epithet) => (/^the /.test(epithet) ? `${given} ${epithet}` : `${given}, ${epithet}`);

/** A small stable hash (FNV-1a) of a string - a name's seed. */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** REVENANT-VOICE: the id a special foe's voice is drawn from - its record's, or (a foe that speaks before it is one: it
 *  breaks and runs) one minted on it then and kept, so the revenant it becomes speaks as it already did. */
const voiceIdOf = (entity) => entity?.revenant?.id ?? (entity._voiceId ??= mintCharacterId());

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

/** A deed's epithet - from rank 3 the risen ones, whatever the deed - never the one it wears now. */
export function revenantEpithet(deed, rank, playerName, rolls = Math.random, current = null) {
  const pool = rank >= 3 ? REVENANT_EPITHETS.risen : (REVENANT_EPITHETS[deed] ?? REVENANT_EPITHETS.slew);
  const p = capFirst(firstWord(playerName));   // a name in a title is a name - "Bane of Stranger"
  const choices = pool.map((e) => fill(e, { p })).filter((e) => e !== current);
  return pick(choices.length ? choices : pool.map((e) => fill(e, { p })), rolls);
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
const FATES = new Set(['executed', 'sworn', 'released']);
/** REVENANT-COMPANION: a sworn one's place read back - the shape checked; anything odd walks with the player whole. */
function sanitizeCompanion(c) {
  const state = c?.state === 'away' || c?.state === 'resting' ? c.state : 'with';
  const hp = Number(c?.health), max = Number(c?.maxHealth);
  return {
    state, health: c?.health != null && Number.isFinite(hp) && hp > 0 ? hp : null, maxHealth: c?.maxHealth != null && Number.isFinite(max) && max > 0 ? max : null,
    until: state === 'resting' && isNum(c?.until) ? c.until : null,
    items: Array.isArray(c?.items) ? c.items.filter((it) => it && typeof it === 'object') : [],
  };
}
/** A record read back (a save, the app's storage) - the shape checked, anything else dropped. */
function sanitize(r) {
  if (r && isStr(r.id) && r.id && r.gone === true) return { id: r.id, rev: isNum(r.rev) ? r.rev : 0, gone: true };   // a tombstone: the id and its revision alone
  if (!r || !isStr(r.id) || !r.id || !Number.isInteger(r.mobileType) || !isStr(r.given) || !isStr(r.epithet)) return null;
  const rank = Math.max(1, Math.min(REVENANT_MAX_RANK, Number.isInteger(r.rank) ? r.rank : 1));
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
    personality: isPersonality(r.personality) ? r.personality : personalityFor(r.id, r.mobileType),   // REVENANT-VOICE: an older record's, drawn from its id as a new one's is
    // REVENANT-FATE: how it ended (or did not) - executed, sworn to the player, released by the player
    fate: FATES.has(r.fate) ? r.fate : null, sworn: !!r.sworn && !r.defeated, swornAt: isNum(r.swornAt) ? r.swornAt : null,
    companion: r.sworn && !r.defeated ? sanitizeCompanion(r.companion) : null,
    history: Array.isArray(r.history) ? r.history.filter((d) => d && isStr(d.deed) && isNum(d.at)).slice(-HISTORY_MAX) : [],
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
  let kept = [];
  try { const raw = appStorage()?.getItem(storeKey(id)); if (raw) kept = JSON.parse(raw)?.list ?? []; } catch { /* a bad mirror is no mirror */ }
  const live = _state.list.map((r) => ({ id: r.id, out: r.out, outAt: r.outAt }));
  // AUDIT (2026-10-02): A SWORN ONE'S PACK IS THE SAVE'S. The mirror outlives a load (a revenant remembers), but a pack
  // is inventory: the save's own copy says what is in it (none, where the save never knew it sworn) - else a load handed
  // back the items the save's own pack also held, or lost ones it never had. And one the save holds sworn with a pack,
  // released after it, comes back as the save had it: its pack is no one's to lose.
  const saved = new Map(_state.list.filter((r) => !r.gone).map((r) => [r.id, r]));
  _state.list = mergeRevenants(_state.list, kept);
  for (const l of live) { const r = revenantById(l.id); if (r) { r.out = l.out; r.outAt = l.outAt; } }   // a live stand is this session's, not the mirror's
  for (let i = 0; i < _state.list.length; i++) {
    const r = _state.list[i], s = saved.get(r.id);
    if (r.gone) continue;
    if (s?.sworn && s.companion?.items?.length && !r.sworn && r.fate === 'released') { _state.list[i] = { ...s, rev: (r.rev | 0) + 1 }; continue; }
    if (r.companion) r.companion.items = s?.companion?.items ? s.companion.items.slice() : [];
  }
  _state.mirrorId = id;
}
function persist() {
  if (!_state.mirrorId) return;
  try { appStorage()?.setItem(storeKey(_state.mirrorId), JSON.stringify({ v: 1, list: _state.list })); } catch { /* storage full or gone: the save still keeps it */ }
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
const deed = (r, d, at) => { r.history.push({ deed: d, at }); if (r.history.length > HISTORY_MAX) r.history.splice(0, r.history.length - HISTORY_MAX); };
const dueFrom = (now, rolls) => now + REVENANT_RETURN_MIN_MINUTES + Math.floor(rolls() * (REVENANT_RETURN_MAX_MINUTES - REVENANT_RETURN_MIN_MINUTES + 1));

// ── who may become one ──────────────────────────────────────────────
/** A foe that may become (or stay) a revenant: special (an elite, a champion, a revenant already), of the floor's level,
 *  never the watch or an ally; `rec` the pool's record when there is one - never a quest's foe or a summons. */
export function revenantCandidate(entity, rec = null) {
  if (!entity || !revenantOn()) return false;
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
export function revenantDeed(player, entity, deedName, { mobileType = entity?.mobileType, gender = 'male', rec = null, archive = null, now = nowMinutes(), rolls = Math.random } = {}) {
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
    r.epithet = revenantEpithet(deedName, r.rank, pName, rolls, r.epithet);
  } else {
    const id = voiceIdOf(entity);   // REVENANT-VOICE: the id its voice was drawn from while it fled, if it spoke before it was one
    const given = revenantGivenName(id, mobileType, gender);
    r = {
      id, rev: 0, mobileType, gender: gender === 'female' ? 'female' : 'male', given,
      epithet: revenantEpithet(deedName, 1, pName, rolls), name: '', rank: 1, kills: 0, escapes: 0, returns: 0,
      trait: typeof entity.champion === 'string' && entity.champion ? entity.champion : null, elite: !!entity.eliteFoe,
      born: now, dueAt: 0, out: false, outAt: 0, defeated: false, defeatedAt: null, notice: null, history: [],
      archive: Number.isInteger(archive) ? archive : null,   // REVENANT-CARD: the sprite it wore (a retextured kind's own), for its portrait
      personality: personalityFor(id, mobileType),   // REVENANT-VOICE: who it is - one per id
      fate: null, sworn: false, swornAt: null, companion: null,   // REVENANT-FATE: not judged yet
    };
    _state.list.push(r);
    // past the cap: the weakest, oldest living one is forgotten - a tombstone, so no older save raises it again
    const living = livingRevenants();
    if (living.length > REVENANT_MAX) {
      const drop = living.filter((x) => x !== r && !x.out).sort((x, y) => x.rank - y.rank || x.born - y.born)[0];   // AUDIT (2026-10-02): never one standing in the world
      if (drop) bury(drop);
    }
  }
  r.name = joinName(r.given, r.epithet);
  if (deedName === 'slew') { r.kills++; r.notice = 'slew'; } else { r.escapes++; r.notice = null; }
  r.dueAt = dueFrom(now, rolls);
  deed(r, deedName, now);
  // the foe that did it wears its name at once - while it still stands (a killer over my body), it IS the revenant
  entity.revenant = { id: r.id, name: r.name, rank: r.rank };
  r.out = deedName === 'slew';
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
  if (!entity?.isPlayer || entity.peer || !(after <= 0)) return;
  armDeathCheck(entity);
}
registerPlayerBlowLanded('revenant', onBlowLanded);
registerPlayerHurtListener('revenant', onPlayerHurt);
registerPlayerStruckListener('revenant', (attacker, target) => {
  if (target?.isPlayer && !target.peer && attacker && !attacker.isPlayer) markPlayerHarm(attacker, { ms: HARM_MARK_STRUCK_MS });
});

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
  r.companion = sanitizeCompanion({ state, health, maxHealth });
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
  r.companion ??= sanitizeCompanion(null);
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
  const due = living.filter((r) => r.dueAt <= now).sort((a, b) => b.rank - a.rank || a.dueAt - b.dueAt);
  if (!due.length || rolls() >= REVENANT_RETURN_CHANCE) return null;
  // CLAIMED from here: its stand crosses awaits (the career's bytes, the sprite) and the next roll must not stand it twice
  due[0].out = true;
  due[0].outAt = Date.now();
  return due[0];
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
 *  OUT from here until the foe dies, escapes or leaves the world. */
export function applyRevenant(entity, r, { now = nowMinutes() } = {}) {
  if (!entity || !r) return false;
  entity.revenant = { id: r.id, name: r.name, rank: r.rank };
  entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * (1 + REVENANT_HEALTH_PER_RANK * r.rank)));
  entity.health = entity.maxHealth;
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * (1 + REVENANT_DAMAGE_PER_RANK * r.rank);
  r.out = true; r.outAt = Date.now(); r.returns++;
  deed(r, 'returned', now);
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
export function revenantLoot(level = 1, rank = 1, rolls = Math.random) {
  const lv = Math.max(1, level | 0), rk = Math.max(1, Math.min(REVENANT_MAX_RANK, rank | 0));
  const out = [];
  const L = REVENANT_LOOT;
  if (rolls() < L.magicChance) { const it = tieredGear(lv, 'magic', rolls); if (it) out.push(it); }
  if (rk >= L.rareFromRank || rolls() < L.rareChance + L.rarePerRank * rk) { const it = tieredGear(lv, 'rare', rolls); if (it) out.push(it); }
  if (rolls() < L.legendaryChance + L.legendaryPerRank * rk) { const it = tieredGear(lv, 'legendary', rolls); if (it) out.push(it); }
  const [lo, hi] = L.goldPerLevel;
  out.push(goldStack(Math.round(lv * rk * (lo + rolls() * (hi - lo)))));
  return out;
}
/** Give a returned revenant its drop (once). */
export function grantRevenantLoot(entity, level, rolls = Math.random) {
  if (!entity?.revenant || entity._revenantLoot) return;
  entity._revenantLoot = true;
  entity.items = entity.items ?? [];
  entity.items.push(...revenantLoot(level ?? entity.level, entity.revenant.rank ?? 1, rolls));
}

// ── what is said ────────────────────────────────────────────────────
// Every word below comes two ways: the EVENT a face draws (REVENANT-CARD - ui/revenantCard.js on the enhanced skin: the
// portrait, the name, what it says in its own voice, what happens in the narrator's) and the one LINE a text surface
// says instead (the classic skin, a page without a document). `revenantSay` hands an event to the face, or its line to
// the host's own `say`.
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** What a returning revenant greets the player with: its words (a speaker's) or what it does (a beast's). */
function tauntParts(r, playerName, rolls) {
  const last = [...(r.history ?? [])].reverse().find((d) => d.deed === 'slew' || d.deed === 'fled')?.deed ?? 'slew';
  // AUDIT (2026-10-02): the risen's taunt counts its kills ("I've killed you so often...") - one that only ever ran has none
  return voiceParts(r, r.rank >= 3 && (r.kills | 0) >= 2 ? 'taunt_risen' : last === 'fled' ? 'taunt_fled' : 'taunt_slew', playerName, rolls);
}
/** REVENANT-VOICE: one moment in its voice - a speaker's words (quoted, its line `Name: "..."`), a beast's deed in its
 *  temperament (the narrator's, its line `Name circles you...`). `r` a record, or what a special foe is before it is
 *  one ({ id, name, mobileType, personality }). */
function voiceParts(r, event, playerName, rolls = Math.random) {
  const personality = isPersonality(r.personality) ? r.personality : personalityFor(r.id, r.mobileType);
  if (!revenantSpeaks(r.mobileType)) {
    const body = beastBody(personality, event);
    return { speech: null, body, line: `${r.name} ${body.charAt(0).toLowerCase()}${body.slice(1)}` };
  }
  const speech = voiceLine(personality, event, { p: firstWord(playerName), rolls });
  return { speech, body: null, line: `${r.name}: "${speech}"` };
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
  return revenantEvent('taunt', r, { speech: t.speech, body: t.body, line: t.line, archive });
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
export function takeRevenantNotice(player) {
  if (!player || !(player.health > 0)) return null;
  ensureMirror(player);
  const r = _state.list.find((x) => x.notice && !x.defeated);
  if (!r) return null;
  const ev = r.notice === 'slew' ? revenantRiseEvent(r, player.name) : null;
  r.notice = null;
  touch(r);
  persist();
  return ev;
}

// ── the save ────────────────────────────────────────────────────────
registerModSaveData(REVENANT_SAVE, {
  newSaveData: () => ({ v: 1, list: [] }),
  // AUDIT (2026-10-02): one standing as the save is made comes back later (REVENANT_LOST_MINUTES), not at once beside
  // the street's copy of it - the street's save leaves it out (scenes/exteriorFoes.js snapshotWorld)
  getSaveData: () => ({ v: 1, list: _state.list.map((r) => (r.gone ? r : { ...r, out: false, outAt: 0, dueAt: r.out ? Math.max(r.dueAt, nowMinutes() + REVENANT_LOST_MINUTES) : r.dueAt })) }),
  restoreSaveData: (rec) => { _state.list = mergeRevenants(rec?.list ?? [], []); _state.mirrorId = null; clearPlayerHarm(); },   // the last game's harm is no one's death in this one
  newGame: () => { _state.list = []; _state.mirrorId = null; clearPlayerHarm(); },
});

/** Tests only: forget everything. */
export function _resetRevenantForTests() { _state.list = []; _state.mirrorId = null; }
