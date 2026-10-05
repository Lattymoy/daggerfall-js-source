// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT7 (2026-10-01) — CHAMPION FOES.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 9; Mac: "Do you
// wanna turn this into an arc and do all of the above?" - "Champion foes.
// Single named foes with visible traits (Fiery, Swift, Vampiric) and a
// guaranteed Rare"). About one foe in fourteen of level 3 or more stands as
// a CHAMPION with one TRAIT: twice its health and its blows a quarter
// harder, its trait on top, its name the trait's and its own. Its loot is
// its own roll (CHAMP-LOOT: no Rare is forced onto its body - Magic and Rare
// at half a plain foe's, its Legendary as LOOT7 left it: systems/lootRarity.js
// championSource).
//
// WHO DECIDES. A dungeon's foes are its LAYOUT's, built on every client
// from the location (the elite's way): `markDungeonChampions` marks the
// layout's records by a HASH of the location and the marker, so every
// client stands the same champion with no wire word, and the mark rides
// the record (`src`) through a rebuild or a respawn. A foe in the street
// or a building is its OWNER's: `rollStreetChampion` hashes it, and the foe
// record carries its trait (`cp`, net/wire.js validFoeRecord) to every
// puppet, which wears the same scaling - a puppet's blow resolved on my
// side is a champion's.
//
// OFF IS DFU EXACTLY: with the loot-rarity row off, no champion stands.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn } from './lootRarity.js';
import { foeTitle } from './foeTitle.js';   // FOE-TITLE: the names' one home
import { registerPlayerStruckListener, registerPlayerStrikeListener } from '../combat/formulas.js';
import { hurtPlayer } from '../characters/playerEntity.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';
import { enemyDisplayName } from '../characters/enemyBasics.js';   // LOOT7-CHECK CHAMP-SAID: the name the death line says
import { popupMessage } from './notify.js';   // LOOT7-CHECK CHAMP-SAID: DaggerfallUI.PopupMessage, the live host's line

/** Per mille of the foes that may be one that stand as a champion (CHAMP-RATE, 2026-10-03, Mac: "buff champion rates
 *  slightly": 70, was 50 - about one in fourteen, was one in twenty). */
export const CHAMPION_PER_MILLE = 70;
/** A champion is a foe of this level or more. */
export const CHAMPION_MIN_LEVEL = 3;
/** Every champion: its health times this, its blows times this. */
export const CHAMPION_HEALTH = 2;
export const CHAMPION_DAMAGE = 1.25;
/** @typedef {{ id: string, name: string, text: string, damage?: number, health?: number, speed?: number, drink?: number, thorns?: number }} ChampionTrait */
/** The traits, in the wire's order (`cp` is the index). @type {ReadonlyArray<Readonly<ChampionTrait>>} */
export const CHAMPION_TRAITS = Object.freeze([
  Object.freeze({ id: 'mighty', name: 'Mighty', text: 'Its blows land half again as hard', damage: 1.5 }),
  Object.freeze({ id: 'stalwart', name: 'Stalwart', text: 'Half again its health, on top of a champion\'s double', health: 1.5 }),
  Object.freeze({ id: 'swift', name: 'Swift', text: 'Thirty more Speed: it closes, and it swings, sooner', speed: 30 }),
  Object.freeze({ id: 'vampiric', name: 'Vampiric', text: 'Half of what its blows take from you heals it', drink: 50 }),
  Object.freeze({ id: 'thorned', name: 'Thorned', text: 'Your blows that land on it hurt you back, a seventh of them', thorns: 7 }),
]);
export const championTrait = (id) => CHAMPION_TRAITS.find((t) => t.id === id) ?? null;
export const championIndex = (id) => CHAMPION_TRAITS.findIndex((t) => t.id === id);
/** A foe's trait, when it stands as a champion, else null. */
export const championOf = (entity) => (entity?.champion ? championTrait(entity.champion) : null);
/** What a champion is called - its trait before its own name ("Mighty Orc Warlord"); FOE-TITLE: an elite's "Elite Orc
 *  Warlord" and a revenant's own name too (systems/foeTitle.js, the one home); anyone else's name as it was. */
export function championName(entity, base) {
  return foeTitle(entity, base);
}

/** AUDIT WB12d (D2): A FOE WITH A NAME OF ITS OWN - a feature's one foe that every line calls by it (WB12d's "the
 *  Summoner", scenes/riteHost.js) - its words as a line begins them, or null. Said with no article: "You see the
 *  Summoner.", "The Summoner just died.", "The Summoner (dead)". */
export function properName(entity) {
  const n = typeof entity?.properName === 'string' ? entity.properName : '';
  return n ? n[0].toUpperCase() + n.slice(1) : null;
}

/** FNV-1a over a few integers - a mixer of the dungeon's own (the same answer on every client, every load). */
function mix(...ns) {
  let h = 0x811c9dc5;
  for (const n of ns) {
    let v = Math.trunc(Number(n) || 0) >>> 0;
    for (let i = 0; i < 4; i++) { h ^= v & 0xff; h = Math.imul(h, 0x01000193) >>> 0; v >>>= 8; }
  }
  return h >>> 0;
}
/** THE DUNGEON'S CHAMPIONS: every layout record a hash of the location and its place in the list says - its trait
 *  index on the record (`champion`), the rest untouched. A quest's foe is never in the layout. Answers how many. */
export function markDungeonChampions(records, locationKey) {
  if (!lootRarityOn() || !Array.isArray(records)) return 0;
  let n = 0;
  records.forEach((e, i) => {
    if (!e || e.allied || e.champion != null) return;
    const h = mix(locationKey, i, 0x10071);
    if (h % 1000 < CHAMPION_PER_MILLE) { e.champion = (h >>> 10) % CHAMPION_TRAITS.length; n++; }
  });
  return n;
}
/** THE STREET'S: an ordinary encounter's foe (never a quest's, a summons, an ally or a placed camp's - the caller says
 *  which) by the same mixer over where it stands, its type and the pool's count of them - never a draw: the pool's
 *  stream (its loot, its kit) draws as it did, and a test's seeded street stands the same foes every run. A trait's
 *  index or null. */
let _streetN = 0;
export function rollStreetChampion(feet = null, mobileType = 0) {
  if (!lootRarityOn()) return null;
  const h = mix(Math.round((Number(feet?.[0]) || 0) * 64), Math.round((Number(feet?.[2]) || 0) * 64), mobileType, ++_streetN, 0x57ee7);
  return h % 1000 < CHAMPION_PER_MILLE ? (h >>> 10) % CHAMPION_TRAITS.length : null;
}
/** Tests only: the street's count back to none. */
export function _resetStreetChampionsForTests() { _streetN = 0; }

/**
 * MAKE IT A CHAMPION - on its entity, in place, right after the entity is built and BEFORE its loot is rolled (the loot
 * reads the mark): its trait, twice its health (the Stalwart's half again more), its blows a quarter harder (the
 * Mighty's half again more) multiplied onto whatever `damageScale` it has (an elite's double stands under it), the
 * Swift's Speed. Nothing for no trait, a foe under CHAMPION_MIN_LEVEL, the city watch, an ally, or with the switch off.
 * Answers whether it stood as one.
 */
export function applyChampion(entity, traitIndex) {
  if (!entity || !Number.isInteger(traitIndex) || !lootRarityOn()) return false;
  const t = CHAMPION_TRAITS[traitIndex];
  if (!t || (entity.level | 0) < CHAMPION_MIN_LEVEL) return false;
  if (entity.mobileType === KNIGHT_CITY_WATCH || entity.team === 'PlayerAlly' || entity.mobileTeam === 'PlayerAlly') return false;
  entity.champion = t.id;
  const hp = CHAMPION_HEALTH * (t.health ?? 1);
  entity.maxHealth = Math.max(1, Math.round((entity.maxHealth ?? 1) * hp));
  entity.health = entity.maxHealth;
  entity.healthMult = (entity.healthMult ?? 1) * hp;   // TELL1: what was stood on the kind's own health (ai/tells.js kindHealth - its poise)
  entity.damageScale = (Number.isFinite(entity.damageScale) ? entity.damageScale : 1) * CHAMPION_DAMAGE * (t.damage ?? 1);
  if (t.speed && entity.stats) entity.stats.speed = Math.min(100, (entity.stats.speed ?? 50) + t.speed);
  return true;
}

// ── the traits that answer a blow ───────────────────────────────────
/** VAMPIRIC: a champion's blow that reached me (formulas.js's struck tail) heals it half of it. */
export function championStruck(attacker, target, damage) {
  const t = championOf(attacker);
  if (!t?.drink || !(damage > 0) || !target?.isPlayer || !(attacker.health > 0)) return;
  attacker.health = Math.min(attacker.maxHealth ?? attacker.health, attacker.health + Math.max(1, Math.round((damage * t.drink) / 100)));
}
/** THORNED: my blow that landed on a champion (formulas.js's strike tail) hurts me a seventh of it, through my one
 *  damage door - a hurt as any other, never a blow of a foe's. */
export function championStrike(attacker, target, damage) {
  const t = championOf(target);
  if (!t?.thorns || !(damage > 0) || !attacker?.isPlayer || attacker.peer) return;
  hurtPlayer(attacker, Math.max(1, Math.round(damage / t.thorns)));
}
export const CHAMPIONS = 'champions';
registerPlayerStruckListener(CHAMPIONS, championStruck);
registerPlayerStrikeListener(CHAMPIONS, championStrike);

// ── LOOT7-CHECK CHAMP-SAID: a champion said, on either skin ─────────
// Mac asked for "single named foes with visible traits", and a LIVING champion was named only on the enhanced skin's
// target frame (ui/hudFoeTarget.js) and its plaque (the World Tooltips plaque is the enhanced skin's - ui/worldPlaque.js
// worldPlaqueOn): on the classic skin nothing said one stood until it died, and no screen anywhere said what its trait
// does (CHAMPION_TRAITS' `text` was read by nothing). So the first blow that lands EITHER WAY - its on me, or mine on
// it - says it on the line every skin draws (notify.js popupMessage: DaggerfallUI.PopupMessage, the line "%s just
// died." is said on), in two rows: who it is, then what its trait does. Once per champion (a rebuild or a load is a
// new one, and says it again at its first blow). The blow seams are the one home every pool already shares - the
// dungeon's, the street's, a building's, a puppet's - so no host stands it. Off, no champion stands and nothing is said.
/** The two rows a champion is said by - its name and that it stands as one, then what its trait does - or null. */
export function championLines(entity) {
  const t = championOf(entity);
  const base = t ? enemyDisplayName(entity.mobileType) : null;
  return base ? [`${championName(entity, base)} stands as a champion.`, `${t.text}.`] : null;
}
const _said = new WeakSet();
/** Say a champion's rows, once per champion (`say` the live host's line unless a caller hands its own). Answers
 *  whether they were said now. */
export function sayChampion(entity, say = popupMessage) {
  if (!entity || _said.has(entity)) return false;
  const lines = championLines(entity);
  if (!lines) return false;
  _said.add(entity);
  for (const line of lines) say(line);
  return true;
}
export const CHAMPIONS_SAID = 'champions-said';
// its blow that reached ME (never a peer's copy: another player's screen is theirs), and mine that landed on it
registerPlayerStruckListener(CHAMPIONS_SAID, (attacker, target, damage) => { if (damage > 0 && target?.isPlayer && !target.peer) sayChampion(attacker); });
registerPlayerStrikeListener(CHAMPIONS_SAID, (attacker, target, damage) => { if (damage > 0 && attacker?.isPlayer && !attacker.peer) sayChampion(target); });
