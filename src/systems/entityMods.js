// RF1 (2026-09-14, Mac: "is there anything in the codebase that can
// benefit from a refactor. This is our first time going against parity
// with DFU ... Lets tackle each one at a time"): ENTITY MODIFIER
// CHANNELS - the one home for what a wearer carries, read once per
// channel by DFU's formulas.
//
// THE PROBLEM IT REMOVES. Loot rarity (LR1-LR4), the port's first
// departure from DFU's rules, had to add a term of its own INSIDE five
// verbatim formulas beside the enchantment fold's: the hit formula's
// armour line (`+ enchantArmorMod(target) - affixArmor(target, part)`),
// PCAAO's copy of it, the weapon damage roll, liveStat, skillValue, the
// saving throw and the carrying capacity. Two producers, two reads, at
// every site - and the next departure (a set bonus, a blessing, a
// difficulty mode) would be a third term at each of them.
//
// THE SHAPE. Every producer of a modifier is a FOLD: a function of the
// entity that answers one `mods` record of the channels below (or
// EMPTY when its switch is off). The folds are registered here
// (registerEntityFold), run together by computeEntityMods at the two
// seams a worn set changes - equip.js's listener (every equipItem /
// unequipItem and the save's rebuildEquipState) and the magic round
// (worldTick, after DFU's own enchantment fold) - and summed onto ONE
// cached field, `entity._mods`. A formula reads ONE accessor per
// channel; the accessor adds DFU's own enchantment channel (kept
// verbatim in enchantments.js with its min-set quirks) to the sum.
//
// THE CHANNELS (the port's; DFU's own live beside them):
//   armorParts[7]   points OFF a blow's chance to land on that body
//                   part (the hit formula adds the part's armour value)
//   stats{name}     an attribute, by STAT_KEYS_ORDER name (liveStat)
//   skills{id}      a skill, by id (skillValue)
//   resist{element} a saving-throw bonus per element name
//   weightMult      a fraction on the carrying capacity
// and, for the item in hand rather than the wearer:
//   weapon damage   registerWeaponDamageMod - a function over the
//                   weapon's rolled damage (calculateAttackDamage)
//
// statMods.js and skills.js stay IMPORT-FREE LEAVES: they read the one
// field (`entity._mods`) directly, as they read `_enchantMods`.
//
// OFF IS DFU EXACTLY: with no fold registered, or every fold answering
// EMPTY, every accessor answers the enchantment channel alone.

import { enchantArmorMod, enchantArmorDisplayMod, enchantSkillMod, enchantWeightAllowanceMult } from './enchantments.js';
import { addEquipChangeListener } from './equip.js';
import { NUMBER_BODY_PARTS } from './armorMaterials.js';   // one home for the seven (audit24's one-home ratchet)
export { NUMBER_BODY_PARTS };
/** The empty record every fold may answer; frozen, shared. */
export const EMPTY_MODS = Object.freeze({
  armorParts: Object.freeze(new Array(NUMBER_BODY_PARTS).fill(0)),
  stats: Object.freeze({}), skills: Object.freeze({}), resist: Object.freeze({}), weightMult: 0,
});
/** A fresh, writable record for a fold to fill. */
export const newMods = () => ({ armorParts: new Array(NUMBER_BODY_PARTS).fill(0), stats: {}, skills: {}, resist: {}, weightMult: 0 });

const _folds = new Map();
/** Register a fold by name: `fn(entity) -> mods` (any channel may be
 *  absent). Re-registering a name replaces it; `null` removes it. */
export function registerEntityFold(name, fn) { if (typeof fn === 'function') _folds.set(name, fn); else _folds.delete(name); }
export const entityFoldNames = () => [...(_folds.keys())];

const _weaponMods = new Map();
/** Register a weapon-damage modifier by name: `fn(weapon, damage) -> damage`. */
export function registerWeaponDamageMod(name, fn) { if (typeof fn === 'function') _weaponMods.set(name, fn); else _weaponMods.delete(name); }
const _blowMods = new Map();
/** SIGIL1: register a modifier over a WEAPON BLOW's whole damage - `fn(weapon, damage, attacker, target) -> damage`,
 *  read at the tail of FormulaHelper's weapon damage (after the strength, the material and the enemy-type term, before
 *  DFU's mod hook, its last line), where the
 *  attacker and the target are known: the online sigil (systems/sigil.js) is the one that needs them. */
export function registerWeaponBlowMod(name, fn) { if (typeof fn === 'function') _blowMods.set(name, fn); else _blowMods.delete(name); }
/** The blow's damage through every registered blow modifier, in registration order. */
export function weaponBlowMods(weapon, damage, attacker, target) {
  let d = damage;
  for (const fn of _blowMods.values()) d = fn(weapon, d, attacker, target);
  return d;
}

/** Run every fold and sum the channels onto `entity._mods`. Called at
 *  every equip change and every magic round; cheap for an entity that
 *  wears nothing the folds care about. */
export function computeEntityMods(entity) {
  if (!entity) return EMPTY_MODS;
  const out = newMods();
  for (const fn of _folds.values()) {
    let m;
    try { m = fn(entity); } catch (e) { console.warn('[entityMods] a fold threw', e); continue; }
    if (!m) continue;
    if (Array.isArray(m.armorParts)) for (let i = 0; i < NUMBER_BODY_PARTS; i++) out.armorParts[i] += m.armorParts[i] | 0;
    for (const [k, v] of Object.entries(m.stats ?? {})) out.stats[k] = (out.stats[k] ?? 0) + (v | 0);
    for (const [k, v] of Object.entries(m.skills ?? {})) out.skills[k] = (out.skills[k] ?? 0) + (v | 0);
    for (const [k, v] of Object.entries(m.resist ?? {})) out.resist[k] = (out.resist[k] ?? 0) + (v | 0);
    out.weightMult += Number(m.weightMult) || 0;
  }
  entity._mods = out;
  return out;
}
export const entityModsOf = (entity) => entity?._mods ?? EMPTY_MODS;
addEquipChangeListener(computeEntityMods);   // every equipItem/unequipItem, and the save's rebuildEquipState

// ── the accessors: ONE read per channel, DFU's channel included ─────
/** The hit formula's armour modifier for a struck part
 *  (FormulaHelper.cs:1158's Increased + Decreased, MINUS the port's
 *  points on that part). */
export const entityArmorMod = (entity, bodyPart) => enchantArmorMod(entity) - (entityModsOf(entity).armorParts?.[bodyPart] ?? 0);
/** The paperdoll's number for a part (RefreshArmourValues' Decreased
 *  MINUS Increased, PLUS the port's points - the doll's numbers rise
 *  as armour improves). */
export const entityArmorDisplayMod = (entity, bodyPart) => enchantArmorDisplayMod(entity) + (entityModsOf(entity).armorParts?.[bodyPart] ?? 0);
/** The skill modifier (EnhancesSkill's channel plus the port's). */
export const entitySkillMod = (entity, skillId) => enchantSkillMod(entity, skillId) + (entityModsOf(entity).skills?.[skillId] ?? 0);
/** The attribute modifier (the port's; DFU's own stat mods ride
 *  activeEffects, which liveStat sums itself). */
export const entityStatMod = (entity, stat) => entityModsOf(entity).stats?.[stat] ?? 0;
/** The carrying-capacity multiplier (IncreasedWeightAllowance's plus the port's). */
export const entityWeightMult = (entity) => enchantWeightAllowanceMult(entity) + (entityModsOf(entity).weightMult ?? 0);
/** The saving-throw bonus over the elements a spell carries, by name. */
export function entityResistMod(entity, elements) {
  const r = entityModsOf(entity).resist;
  let out = 0;
  for (const el of elements ?? []) if (r?.[el]) out += r[el];
  return out;
}
/** The weapon's rolled damage through every registered modifier, in
 *  registration order. */
export function weaponDamageMods(weapon, damage) {
  let d = damage;
  for (const fn of _weaponMods.values()) d = fn(weapon, d);
  return d;
}
