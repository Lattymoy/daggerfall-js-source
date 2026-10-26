// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIRM1 (2026-10-13; bible/06-Systems/Firmament.md) - WHAT THE FIRMAMENT DOES. The law (net/firmament/firmamentLaw.js) sums and
// caps every channel the stars allocated carry; the tree in force is firmamentLive.js's; this file lays those channels
// onto the seams the Sigil Sets, the loot and the Arcane paths opened - registered here at import, each a no-op for
// anyone but MY entity, the tree in force:
//
//   the attributes, the skills,    the entity FOLD (entityMods.js) - DFU's own formulas read them as they read a ring's:
//   the saving throws, armour,     Mercantile prices the counter, Swimming the water, Long Blade the swing, a saving
//   the carry, standing, warmth,   throw a spell
//   the road's fatigue, the fall
//   a blow's damage                the WEAPON BLOW modifier (the tail of FormulaHelper's weapon damage) - firmamentLaw
//                                  blowPct: every channel the blow is struck in, the group capped, then its conditions
//   a spell's damage, pierce,      the SPELL POWER, PIERCE, COST and SPEED modifiers - a price read in the spell's own
//   price and pace                 school (castCostPct)
//   what lands on me               the DAMAGE modifier (a foe's blow, or everything else), the BLOW EVASION, the
//                                  ABSORPTION chance
//   the kill, the round            the KILL listener, the MAGIC ROUND (regeneration)
//   health and magicka             the ONLINE LAYER beside Renown's (renownLayer.js setOnlineLayerExtra), moved each round
//
// THE COMBAT CHANNELS SLEEP (`awake`) offline (the tree is not in force), in a duel and an arena bout (sigil.js
// sigilDueling - the word every loot and set power sleeps on), while mentoring (SOFTCAP2's `_mentor`, as the Arcane paths
// sleep), and never answer a blow or a spell at a player. A SIEGE AND THE ZONE ARE NOT REFEREED BOUTS (AUDIT UICALM-FIRM1
// L1 M3 - this header had said a siege slept): there, as the loot's and the sets' powers do, the pace, the price and the
// pool act; what lands on a player is rolled with the sky off (below), and the relay's referee holds its harm and its
// casts to its own ceilings. IN THE WROTHGARIAN ZONE the sky FIGHTS ITS BEASTS (the lead dev, 2026-10-13: "this should help
// in the wrotgarian zone against pve"): every channel acts against the zone's foes as anywhere online, and a player
// there is never struck harder for it - a strike or a spell at a player is rolled on my sheet with the sky taken off it
// (withoutFirmament, scenes/world.js wildStrikeOut / wildSpellOut), and a player's blow lands on the referee's vitality,
// never through this file's damage door. The LIFE channels (the counter's, the road's, the weather's) read wherever the tree is in
// force: there is no fight in a price.
// ═══════════════════════════════════════════════════════════════════

import { SKILLS, SKILL_KEYS, permanentSkillValue } from './skills.js';
import { ATTRIBUTES, COMBAT_SKILLS, LIFE_SKILLS, FIRM_ELEMENTS, blowPct, castCostPct, statDef, pctOf } from '../net/firmament/firmamentLaw.js';
import { firmamentStats, onFirmamentChange, firmamentInForce } from './firmamentLive.js';
import { sigilDueling } from './sigil/sigil.js';
import { registerEntityFold, registerWeaponBlowMod, newMods, EMPTY_MODS, NUMBER_BODY_PARTS, STANDING_CHANNELS, computeEntityMods } from './entityMods.js';
import { registerSpellPowerMod, registerSpellPierceMod } from './spell/spellPower.js';
import { registerSpellCostMod, effectSchool } from './spellcost.js';
import { registerCastSpeedMod } from './castSpeed.js';
import { registerPlayerDamageMod, registerPlayerBlowEvasion, playerEntity } from '../characters/playerEntity.js';
import { registerPlayerKillListener } from './playerKills.js';
import { registerMagicRoundHook } from './worldTick.js';
import { registerAbsorptionChance } from './absorption.js';
import { pendingPlayerBlow } from './sigil/sigilSetPowers.js';   // the door's one law of what a foe's blow is
import { foeGroup } from './loot/lootPowers.js';   // the loot's one foe group
import { healMine, manaMine } from './playerHeal.js';
import { playerDoor } from './playerDoor.js';
import { setOnlineLayerExtra, renownHpOf, renownMpOf } from './renownLayer.js';
import { evenHpOf } from './levelEven.js';   // AUDIT LEVEL-EVEN L2-4: the floored body a health star's share is of
import { weaponSkillUsed } from '../characters/weapons.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobile/mobileTypes.js';
import { regenShare } from './courtRules.js';   // AUDIT WORLD-EVENTS L1-3: the Firmament's hpRegen is a natural regeneration - a made level holds it

/** @type {Readonly<Record<string, number>>} */
const NONE = Object.freeze({});
const mine = (e) => !!e?.isPlayer && !e.peer;
/** Whether the sky's COMBAT channels act for `e` now: mine, the tree in force, no refereed fight, not mentoring. */
export const firmamentAwake = (e) => mine(e) && firmamentInForce() && !sigilDueling() && !e?._mentor;
/** The capped channels that act for `e` in a fight now (none asleep). */
const fight = (e) => (!_quiet && firmamentAwake(e) ? firmamentStats() : NONE);
/** The capped channels that act for `e` in a life (the tree in force, mine). */
const life = (e) => (!_quiet && mine(e) && !e?._mentor ? firmamentStats() : NONE);
/** True while a sheet is read with the sky taken off it (withoutFirmament). */
let _quiet = false;
/** THE SKY TAKEN OFF: `fn()` read with none of the tree's channels on `entity` - its fold recomputed without the sky
 *  and put back as it was after, whatever `fn` does. A Wrothgarian strike or spell at a player is rolled under it, so
 *  the sky helps against the zone's beasts and never against its players. */
export function withoutFirmament(entity, fn) {
  if (!entity || !firmamentInForce()) return fn();
  const kept = entity._mods;
  _quiet = true;
  try { computeEntityMods(entity); return fn(); } finally { _quiet = false; entity._mods = kept; }
}

let _rand = Math.random;
/** The fraction a percent of a blow leaves, carried to the next, by weapon (or by my fists). */
let _carry = new WeakMap();
/** AUDIT UICALM-FIRM1 L1 M4: the fraction a damage taken leaves, ONE CARRY A CHANNEL - a blow's and a spell's percents
 *  may have opposite signs, and one shared carry made a lighter spell land harder */
let _takenOwed = { blow: 0, spell: 0 };

/** A percent of `damage`, whole, the fraction carried on `key` - the sets' own law (sigilSetPowers.js setBlow) - kept
 *  unless the blow is the Stats page's estimate (AUDIT MARTIAL L2 F7). */
function shareOf(key, damage, pct, keep = true) {
  const exact = (damage * pct) / 100 + (_carry.get(key) ?? 0);
  const whole = pct >= 0 ? Math.floor(exact + 1e-9) : Math.ceil(exact - 1e-9);
  if (keep) _carry.set(key, exact - whole);
  return whole;
}

// ── the fold ────────────────────────────────────────────────────────

/** `v` held inside channel `key`'s budget (STAT_DEFS) - a key star's raw points and a small star's share are one channel. */
const capAt = (key, v) => { const d = statDef(key); return d ? Math.max(d.min, Math.min(d.max, v)) : v; };

/** An attribute's gain off the stars `read` answers: a key star's raw points and a small star's share of the permanent
 *  value, the two held to the channel's budget together. The fold's, and the online layer's Endurance (LEVEL-EVEN). */
const attributeGain = (entity, a, read) => capAt(a, read(a) + pctOf(entity.stats?.[a], read(`pct.${a}`)));
/** THE ENTITY FOLD: the attributes, the skills, the saving throws, armour on every part, the carry, standing and the
 *  wardrobe's channels - the combat ones while awake, the life ones while in force. */
export function firmamentFold(entity) {
  const f = fight(entity), l = life(entity);
  if (f === NONE && l === NONE) return EMPTY_MODS;
  const mods = newMods();
  const read = (key) => (statDef(key)?.kind === 'life' ? l[key] : f[key]) ?? 0;
  // a key star's raw points, and a small star's share of the character's own (its permanent value: Ascend's points in it)
  // - AUDIT UICALM-FIRM1 L1 H1: the two TOGETHER held to the channel's budget (an attribute +15, a combat skill +15):
  // capped apart they made +21 Strength and a mastered Stealth +53
  // FIRM-MAX (2026-10-15, asked of the port: "all nodes should also work on maxed out stats"): a gain lifts the attribute's
  // live ceiling by itself too, so +2% Speed on a 100 reads 102 - liveStat had held it at MAX_STAT_VALUE, and a star
  // did nothing for a maxed stat. A departure from GetLiveStatValue's ceiling for the sky's gains alone.
  for (const a of ATTRIBUTES) {
    const v = attributeGain(entity, a, read);
    if (v) mods.stats[a] = v;
    if (v > 0) mods.statMax[a] = v;
  }
  for (const n of [...COMBAT_SKILLS, ...LIFE_SKILLS]) {
    const id = SKILLS[n];
    const share = read(`skillPct.${n}`);
    const v = capAt(`skill.${n}`, read(`skill.${n}`) + (share ? pctOf(permanentSkillValue(entity, id), share) : 0));
    if (v) mods.skills[id] = v;
  }
  for (const e of FIRM_ELEMENTS) { const v = read(`resist.${e}`); if (v) mods.resist[e] = v; }
  const armor = read('armor');
  if (armor) for (let p = 0; p < NUMBER_BODY_PARTS; p++) mods.armorParts[p] = armor;
  mods.weightMult = read('carry') / 100;
  const standing = read('standing');
  if (standing) for (let g = 0; g < STANDING_CHANNELS; g++) mods.standing[g] = standing;
  for (const k of ['warmth', 'dry', 'coldDegrees', 'heatDegrees', 'fatigueLess', 'fallLess']) /** @type {any} */ (mods)[k] = read(k);
  return mods;
}

// ── the blow ────────────────────────────────────────────────────────

/** MY weapon's blow at a foe: the percent the sky adds (firmamentLaw.js blowPct), the fraction carried. Nothing for a
 *  miss, a blow at a player, a peer's blow resolved here, a foe's, a ward's - and never below 1 for a blow that landed. */
export function firmamentBlow(weapon, damage, attacker, target, info) {
  if (!(damage > 0) || !target || target.isPlayer || target.warded) return damage;
  const c = fight(attacker);
  if (c === NONE) return damage;
  const skill = weapon ? SKILL_KEYS[weaponSkillUsed(weapon.templateIndex)] ?? null : 'HandToHand';
  const wounded = Number.isFinite(attacker.health) && attacker.maxHealth > 0 && attacker.health < attacker.maxHealth / 2;
  const pct = blowPct(c, { skill, group: foeGroup(target), unaware: !!info?.unaware, wounded });
  if (!pct) return damage;
  return Math.max(1, damage + shareOf(weapon ?? attacker, damage, pct, !info?.estimate));
}

// ── the spell ───────────────────────────────────────────────────────

export const firmamentSpellPower = (caster) => fight(caster).spellPower ?? 0;
export const firmamentSpellPierce = (caster) => fight(caster).spellPierce ?? 0;
export const firmamentCastSpeed = (entity) => fight(entity).castSpeed ?? 0;
/** MY spell's price, the sky's percent off it - the school's own channel where every effect is that school's. */
export function firmamentCastCost(entity, sp, spell = null) {
  const c = fight(entity);
  if (c === NONE) return sp;
  const schools = (spell?.effects ?? []).filter((e) => e && e.type > -1).map((e) => SKILL_KEYS[effectSchool(e)]).filter(Boolean);
  const pct = castCostPct(c, schools);
  return pct ? (sp * (100 - pct)) / 100 : sp;
}

// ── what lands on me ─────────────────────────────────────────────────

/** The damage door: a foe's blow by `blowTaken`, everything else by `spellTaken` - whole points, the fraction carried. */
export function firmamentDamage(entity, dmg) {
  const c = fight(entity);
  if (c === NONE || !(dmg > 0)) return dmg;
  const ch = pendingPlayerBlow() ? 'blow' : 'spell';
  const pct = ch === 'blow' ? (c.blowTaken ?? 0) : (c.spellTaken ?? 0);
  if (!pct) return dmg;
  const exact = (dmg * pct) / 100 + _takenOwed[ch];
  const whole = pct >= 0 ? Math.floor(exact + 1e-9) : Math.ceil(exact - 1e-9);
  _takenOwed[ch] = exact - whole;
  return Math.max(0, dmg + whole);
}
/** A foe's blow, `evade` in a hundred, missing me entirely - asked before any modifier (the door's own order). */
export function firmamentEvade(entity) {
  const c = fight(entity);
  if (!c.evade || !pendingPlayerBlow()) return false;
  return _rand() * 100 < c.evade;
}
/** The chance a destruction spell that strikes me is absorbed. */
export const firmamentAbsorb = (target) => fight(target).absorb ?? 0;

// ── the kill, the round, the layer ───────────────────────────────────

const neverCounts = (e) => !!e?.isPlayer || !!e?.peer || e?.mobileType === KNIGHT_CITY_WATCH || e?.team === 'PlayerAlly' || e?.mobileTeam === 'PlayerAlly';   // a player felled is no beast's kill
const me = () => playerDoor()?.player?.() ?? playerEntity;
/** My kill: `killHeal` and `killMana` percent of my maximum back. */
export function firmamentKill(foe) {
  if (!foe || neverCounts(foe)) return;
  const m = me();
  const c = fight(m);
  if (c.killHeal) healMine(m, (m.maxHealth * c.killHeal) / 100);
  if (c.killMana) manaMine(m, (m.maxMagicka * c.killMana) / 100);
}
/** The magic round: regeneration (tenths of a percent of the maximum), and the layer's health and magicka kept to the
 *  sky as it acts now. */
export function firmamentRound(entity) {
  if (!mine(entity)) return;
  firmamentLayer(entity);
  const c = fight(entity);
  if (c.hpRegen && entity.health > 0 && entity.health < entity.maxHealth) { const held = regenShare((entity.maxHealth * c.hpRegen) / 1000, 'firmament', entity); if (held > 0) healMine(entity, held); }   // AUDIT WORLD-EVENTS L1-3: held in a made level (systems/courtRules.js)
  if (c.mpRegen && entity.magicka < entity.maxMagicka) manaMine(entity, (entity.maxMagicka * c.mpRegen) / 1000);
}
/** The sky's health and magicka on the online layer - none while it sleeps: a key star's raw points, and a small
 *  star's share of the maximum as it stands without the layer (renownLayer.js: the save's own). */
export function firmamentLayer(entity = me()) {
  const c = fight(entity);
  if (!entity) return;
  const baseHp = Number.isFinite(entity.rawMaxHealth) ? entity.rawMaxHealth : (entity.maxHealth ?? 0) - renownHpOf(entity);
  const baseMp = (entity.maxMagicka ?? 0) - renownMpOf(entity);
  // AUDIT UICALM-FIRM1 L1 H1: the raw points and the share together inside the budget (+75 Health, +75 Spell Points)
  // LEVEL-EVEN (systems/levelEven.js): and the stars' Endurance, which the online health floor reads
  const end = attributeGain(entity, 'endurance', (key) => c[key] ?? 0);   // an attribute is a combat channel (firmamentLaw.js statDef)
  // AUDIT LEVEL-EVEN L2-4: a small star's share is of the body the floor stands the stored one at (never of the layer)
  const floored = baseHp + (Number.isFinite(entity.rawMaxHealth) ? evenHpOf(entity, (entity.stats?.endurance ?? NaN) + end) : 0);
  setOnlineLayerExtra(entity, { hp: capAt('hp', (c.hp ?? 0) + pctOf(floored, c.hpPct ?? 0)), mp: capAt('mp', (c.mp ?? 0) + pctOf(baseMp, c.mpPct ?? 0)), end });
}

// ── registered at import ───────────────────────────────────────────
export const FIRMAMENT_POWERS = 'firmament';
registerEntityFold(FIRMAMENT_POWERS, firmamentFold);
registerWeaponBlowMod(FIRMAMENT_POWERS, firmamentBlow);
registerSpellPowerMod(FIRMAMENT_POWERS, firmamentSpellPower);
registerSpellPierceMod(FIRMAMENT_POWERS, firmamentSpellPierce);
registerSpellCostMod(FIRMAMENT_POWERS, firmamentCastCost);
registerCastSpeedMod(FIRMAMENT_POWERS, firmamentCastSpeed);
registerPlayerDamageMod(FIRMAMENT_POWERS, firmamentDamage);
registerPlayerBlowEvasion(FIRMAMENT_POWERS, firmamentEvade);
registerAbsorptionChance(FIRMAMENT_POWERS, firmamentAbsorb);
registerPlayerKillListener(FIRMAMENT_POWERS, firmamentKill);
registerMagicRoundHook(FIRMAMENT_POWERS, firmamentRound);
// the tree changed (a star bought, a refund, online or off): the fold and the layer at once, never a round late
onFirmamentChange(() => {
  const m = me();
  if (!m) return;
  try { computeEntityMods(m); firmamentLayer(m); } catch { /* the entity is the host's */ }
});

/** Tests only: fresh carries, and dice of their own ([0, 1)). */
export function _resetFirmamentPowersForTests() { _carry = new WeakMap(); _takenOwed = { blow: 0, spell: 0 }; }
export function _setFirmamentPowersRandForTests(fn) { _rand = typeof fn === 'function' ? fn : Math.random; }
