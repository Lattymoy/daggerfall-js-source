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
//   statMax{name}   FIRM-MAX: points on that attribute's live CEILING (liveStat's maxValue - DFU's StatMaxMods, the
//                   Mace's channel), so a gain lands on a stat already at 100
//   skills{id}      a skill, by id (skillValue)
//   resist{element} a saving-throw bonus per element name
//   weightMult      a fraction on the carrying capacity
//   standing[5]     LOOT14: standing with the five social groups (clothingStanding.js reads it into reactionMods)
//   warmth          LOOT14: degrees of clothing warmth (survival/needs.js hands it to the felt temperature)
//   dry             LOOT14: % less of the weather's soaking (the same)
//   coldDegrees     LOOT15: degrees the cold is felt less (as a spell's frost resistance is, in degrees)
//   heatDegrees     LOOT15: degrees the heat is felt less
//   fatigueLess     LOOT15: % less of the minute's fatigue drain (scenes/shared.js fatigueLossMultiplierFor)
//   fallLess        LOOT15: % less of a fall's damage (scenes/shared.js applyFallLanding)
//   magicka         EG15: points on the maximum magicka - the Battlemage's Bearing (systems/sigil/sigilSetPowers.js); the live
//                   accessor reads it beside Renown's term (systems/chargen.js defineLiveMaxMagicka, through
//                   systems/renownLayer.js foldMpOf), so a save takes it off with Renown's (offlineVitals) and the
//                   magery's third is never taken of it (passiveSpecials.js)
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
import { budgeted, landGain } from './power/powerBudget.js';   // PWR1: every channel summed, then its one curve
export { NUMBER_BODY_PARTS };
/** LOOT14/LOOT15 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md sections 6 and 7): the social groups a standing
 *  channel counts (FactionFile.SocialGroups 0..4), and the wardrobe's plain numbers, summed fold by fold. */
export const STANDING_CHANNELS = 5;
export const WARDROBE_CHANNELS = Object.freeze(['warmth', 'dry', 'coldDegrees', 'heatDegrees', 'fatigueLess', 'fallLess']);
/** The empty record every fold may answer; frozen, shared. */
export const EMPTY_MODS = Object.freeze({
  armorParts: Object.freeze(new Array(NUMBER_BODY_PARTS).fill(0)),
  stats: Object.freeze({}), statMax: Object.freeze({}), skills: Object.freeze({}), resist: Object.freeze({}), weightMult: 0,
  standing: Object.freeze(new Array(STANDING_CHANNELS).fill(0)),
  ...Object.fromEntries(WARDROBE_CHANNELS.map((k) => [k, 0])), magicka: 0,   // EG15: the maximum magicka's points
});
/** A fresh, writable record for a fold to fill. */
export const newMods = () => ({ armorParts: new Array(NUMBER_BODY_PARTS).fill(0), stats: {}, statMax: {}, skills: {}, resist: {}, weightMult: 0,
  standing: new Array(STANDING_CHANNELS).fill(0), ...Object.fromEntries(WARDROBE_CHANNELS.map((k) => [k, 0])), magicka: 0 });

const _folds = new Map();
/** Register a fold by name: `fn(entity) -> mods` (any channel may be
 *  absent). Re-registering a name replaces it; `null` removes it. */
export function registerEntityFold(name, fn) { if (typeof fn === 'function') _folds.set(name, fn); else _folds.delete(name); }
export const entityFoldNames = () => [...(_folds.keys())];

const _weaponMods = new Map();
/** Register a weapon-damage modifier by name: `fn(weapon, damage) -> damage`. */
export function registerWeaponDamageMod(name, fn) { if (typeof fn === 'function') _weaponMods.set(name, fn); else _weaponMods.delete(name); }
const _blowMods = new Map();
/** SIGIL1: register a modifier over a WEAPON BLOW's whole damage - `fn(weapon, damage, attacker, target, info) -> damage`,
 *  read at the tail of FormulaHelper's weapon damage (after the strength, the material and the enemy-type term, before
 *  DFU's mod hook, its last line), where the
 *  attacker and the target are known: the online sigil (systems/sigil/sigil.js) is the one that needs them.
 *  SET2: `info` is what the striker's host knew and the formula could not - `{ unaware }`, the struck foe had not
 *  noticed the striker (its AI's `detected`, read where the foe RECORD is in hand: combat/playerWeapon.js foeUnaware).
 *  AUDIT MARTIAL L2 F7: `{ estimate: true }` - the Stats page's reading of a blow (combat/combatStats.js), no blow at all:
 *  a modifier answers it as it would the blow and KEEPS NOTHING - no fraction carried, no "next blow" window spent (the
 *  page ran every modifier some five hundred times a build, and its reading moved the real blows after it).
 *  Read under EITHER core - DFU's (combat/formulas.js weaponAttackDamage) and PCAAO's (combat/pcaao.js
 *  pcaaoWeaponAttackDamage). */
export function registerWeaponBlowMod(name, fn, { outside = null } = {}) {
  _blowMods.delete(name); _skillBlowMods.delete(name); _flatBlowMods.delete(name);
  if (typeof fn !== 'function') return;
  (outside === 'skill' ? _skillBlowMods : outside === 'flat' ? _flatBlowMods : _blowMods).set(name, fn);
}
/** PWR1 (bible/05-Combat/Power-Arc.md section 4, "what pools and what does not"): OUTSIDE THE SUM - asked AFTER the
 *  channel's sum has landed, on the blow as it landed, in registration order: first `{ outside: 'skill' }`, the weapon
 *  skill's own pay (MARTIAL2's climb past 100, x1.4 at 200 - systems/weaponMastery.js - as the school's potency
 *  multiplies a spell outside the spell channel, spell/spellPower.js spellPowerMult); then `{ outside: 'flat' }`, what
 *  is no percent of the blow - an element's points, the Burning Gate's sear (loot/lootPowers.js lootSear,
 *  sigil/sigilSetPowers.js setSear): two units on one blow, as the thorns are, and flat after the per cents as the sear
 *  always was. */
const _skillBlowMods = new Map();
const _flatBlowMods = new Map();
const NO_BLOW_INFO = Object.freeze({ unaware: false });
/** THE BLOW'S MODIFIERS, SUMMED (PWR1, bible/05-Combat/Power-Arc.md section 4): every registered modifier asked at the
 *  blow's own `damage` - never at what the one before it left - its gain summed, and the sum landed through the blow
 *  channel's curve (systems/power/powerBudget.js landGain: whole to the knee, the hyperbola past it, the fraction
 *  carried on the weapon or the striker's fists). Before PWR1 they ran in a chain, each a percent of the blow the last
 *  had grown: the stacked kit's +169% composed to +318%. A modifier that answers less than it was asked (a keystone's
 *  price) takes its part off the sum. Then what stands outside the sum (the skill's own, then the flat), on the landed blow. */
export function weaponBlowMods(weapon, damage, attacker, target, info = NO_BLOW_INFO) {
  const gained = weaponBlowGain(weapon, damage, attacker, target, info);
  let d = gained ? Math.max(damage > 0 ? 1 : 0, landGain('blow', damage, gained, weapon ?? attacker ?? null, !!info?.estimate)) : damage;
  for (const m of [_skillBlowMods, _flatBlowMods]) {
    for (const fn of m.values()) {
      try { const next = fn(weapon, d, attacker, target, info ?? NO_BLOW_INFO); if (Number.isFinite(next)) d = next; } catch (e) { console.warn('[entityMods] a blow modifier threw', e?.message ?? e); }
    }
  }
  return d;
}

/** PWR1: what every blow modifier in the channel adds to a blow of `damage`, summed (points) - the door lands it
 *  (weaponBlowMods), the Stats page shows it (systems/power/powerSheet.js). */
export function weaponBlowGain(weapon, damage, attacker, target, info = NO_BLOW_INFO) {
  let gained = 0;
  // AUDIT SET L6: a modifier that throws is skipped, as every other seam here skips one - a blow modifier now reaches a
  // second foe's whole damage door and death (SET3's Cleave), and a throw there aborted the swing that carried it
  for (const fn of _blowMods.values()) {
    try { const next = fn(weapon, damage, attacker, target, info ?? NO_BLOW_INFO); if (Number.isFinite(next)) gained += next - damage; } catch (e) { console.warn('[entityMods] a blow modifier threw', e?.message ?? e); }
  }
  return gained;
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
    for (const [k, v] of Object.entries(m.statMax ?? {})) out.statMax[k] = (out.statMax[k] ?? 0) + (v | 0);   // FIRM-MAX
    for (const [k, v] of Object.entries(m.skills ?? {})) out.skills[k] = (out.skills[k] ?? 0) + (v | 0);
    for (const [k, v] of Object.entries(m.resist ?? {})) out.resist[k] = (out.resist[k] ?? 0) + (v | 0);
    out.weightMult += Number(m.weightMult) || 0;
    if (Array.isArray(m.standing)) for (let g = 0; g < STANDING_CHANNELS; g++) out.standing[g] += Number(m.standing[g]) || 0;   // LOOT14
    for (const k of WARDROBE_CHANNELS) out[k] += Number(m[k]) || 0;
    out.magicka += m.magicka | 0;   // EG15: whole points
  }
  if (entity.isPlayer && !entity.peer) budgetFolds(out);   // PWR1: the player's skills, armour and resistances, each through its curve
  entity._mods = out;
  return out;
}
/** PWR1 (bible/05-Combat/Power-Arc.md section 4): what every fold gave ONE skill, ONE body part's armour and ONE
 *  element's resistance, summed above, landed through that channel's curve (systems/power/powerBudget.js budgeted) -
 *  whole points, never more than the sum. The folds' skills had no ceiling at all: the stacked kit's Critical Strike stood
 *  at 192, the climb's 140 and the folds' +52, a critical of x2.90 under PCAAO. A foe's folds (a revenant's adaptations)
 *  are its own law. */
function budgetFolds(out) {
  /** @type {Array<{ channel: string, key: string|number, sum: number, landed: number }>} */
  const cut = [];   // what the curve held back, for the Stats page (systems/power/powerSheet.js)
  const land = (ch, key, v) => {
    if (!(v > 0)) return v;
    const n = Math.floor(budgeted(ch, v) + 1e-9);
    if (n < v) cut.push({ channel: ch, key, sum: v, landed: n });
    return n;
  };
  for (const k of Object.keys(out.skills)) out.skills[k] = land('skill', k, out.skills[k]);
  for (let i = 0; i < NUMBER_BODY_PARTS; i++) out.armorParts[i] = land('armor', i, out.armorParts[i]);
  for (const k of Object.keys(out.resist)) out.resist[k] = land('resist', k, out.resist[k]);
  out.budgetCut = cut;
}
export const entityModsOf = (entity) => entity?._mods ?? EMPTY_MODS;
addEquipChangeListener(computeEntityMods);   // every equipItem/unequipItem, and the save's rebuildEquipState

// ── the accessors: ONE read per channel, DFU's channel included ─────
/** AUDIT SET P-M1: the port's armour POINTS on a struck part alone - an armour affix's, a set's - protection, positive. */
export const entityArmorPoints = (entity, bodyPart) => entityModsOf(entity).armorParts?.[bodyPart] ?? 0;
/** DFU's two enchantment channels alone (FormulaHelper.cs:1158's Increased + Decreased) - for a core that reads them
 *  apart from the port's points (PCAAO's player term). */
export const entityEnchantArmorMod = (entity) => enchantArmorMod(entity);
/** The hit formula's armour modifier for a struck part
 *  (FormulaHelper.cs:1158's Increased + Decreased, MINUS the port's
 *  points on that part). */
export const entityArmorMod = (entity, bodyPart) => enchantArmorMod(entity) - entityArmorPoints(entity, bodyPart);
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
/** The weapon's rolled damage through every registered modifier - PWR1: each asked at the roll itself and its gain
 *  summed (the weapon's damage lines, its gems, its heirloom's generations), landed through the roll channel's curve
 *  (systems/power/powerBudget.js). Before PWR1 a chain, each a percent of what the last had made. */
export function weaponDamageMods(weapon, damage) {
  const gained = weaponDamageGain(weapon, damage);
  return gained ? landGain('roll', damage, gained, null) : damage;
}
/** PWR1: what every weapon-damage modifier adds to a roll of `damage`, summed (points) - landed by weaponDamageMods,
 *  shown by the Stats page. */
export function weaponDamageGain(weapon, damage) {
  let gained = 0;
  for (const fn of _weaponMods.values()) { const next = fn(weapon, damage); if (Number.isFinite(next)) gained += next - damage; }
  return gained;
}
