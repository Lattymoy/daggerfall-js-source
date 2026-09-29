// AC-COMPARE (FIELD BUGS 2026-09-29d - SylviaBun on the Discord, #suggestions, Althea's idea: "when in the player
// inventory we should be able to see the total AC of equipped items on our characters. Hovering our cursor over an item
// ... should also allow us to see comparative stats ... a straight up + or - stat next to the items stats in green and
// red so we can quickly see what is better or worse"): THE CHARACTER'S ARMOUR, READ AT A GLANCE, AND WHAT A WEAR WOULD
// CHANGE. The enhanced pack only (ui/enhancedInventory.js composes all three drawings below); the classic window keeps
// DFU's doll and its seven labels, untouched.
//
// NOTHING HERE IS A NEW LAW. Every number is one the port already computes, read through the member that computes it:
//   - a part's number is the classic doll's own label (RefreshArmourValues, PaperDoll.cs:154-173 - nativeInventory's
//     armorLabelValue over ArmorValues and entityMods' entityArmorDisplayMod);
//   - the table a wear would leave is DFU's own arithmetic on a copy (UpdateEquippedArmorValues, equip.js), and what
//     the wear takes off is EquipItem's own three arms (equip.js wearLeavers - the list equipItem itself runs);
//   - the port's armour points a wear moves (an armour affix, a set's armour) are every entityMods fold, run as they
//     are at every equip change, over the table the wear would leave;
//   - a weapon's range is the card's own Damage row (DFU's %wdm, itemInfo.weaponDamageRange);
//   - the overall figure weighs the seven by the struck-part table of the combat core in force (formulas.js).
// What this file adds is the reading: which numbers stand where, and the one figure made of them (overallArmour, and
// why it is that figure).
import { BODY_PARTS, NUMBER_BODY_PARTS } from '../systems/armorMaterials.js';
import {
  getEquipSlot, wearLeavers, equipTableOf, armorValuesOf, updateEquippedArmorValues, armorBodyParts,
  isEquipped, isBrokenItem, isForbiddenEquip, EQUIP_SLOTS,
} from '../systems/equip.js';
import { createEquipTable } from '../characters/equipTable.js';
import { computeEntityMods, entityArmorDisplayMod } from '../systems/entityMods.js';
import { struckBodyPartTable } from '../combat/formulas.js';
import { itemDamageLine, weaponDamageRange } from '../systems/itemInfo.js';
import { itemIsIdentified } from '../systems/tradeModes.js';
import { armorLabelValue } from './nativeInventory.js';

/** The seven parts in DFU's BodyParts order (ItemEnums.cs:140-150), named off the enum's own members ("RightArm" says
 *  "Right arm"), so no second list of them stands anywhere. No lookbehind in the split (SAFARI1: a Safari before 16.4
 *  cannot parse a module that carries one). */
export const PART_NAMES = Object.freeze(Object.keys(BODY_PARTS)
  .sort((a, b) => BODY_PARTS[a] - BODY_PARTS[b])
  .map((k) => k.replace(/([a-z])([A-Z])/g, (_, lo, up) => `${lo} ${up.toLowerCase()}`)));

/** THE DOLL'S SEVEN NUMBERS, one a part - the classic window's labels exactly (nativeInventory.js draws
 *  `armorLabelValue(av[i] ?? 100, entityArmorDisplayMod(entity, i))`): (100 - ArmorValues[part]) / 5, plus DFU's two
 *  enchantment channels and the port's points on the part. A part with no value yet reads DFU's "no armour", 100. */
export const dollArmour = (entity) => Array.from({ length: NUMBER_BODY_PARTS },
  (_, part) => armorLabelValue(entity?.armorValues?.[part] ?? 100, entityArmorDisplayMod(entity, part)));

/** How many of a struck-part table's entries name each part (FormulaHelper's twenty: 2, 3, 3, 4, 4, 3, 1). */
export function struckCounts(table = struckBodyPartTable()) {
  const out = new Array(NUMBER_BODY_PARTS).fill(0);
  for (const part of table) out[part]++;
  return out;
}

/** THE OVERALL FIGURE - the "total AC" the report asks for, and why it is this one. DFU keeps no total: its armour is
 *  seven numbers, one a body part (DaggerfallEntity.ArmorValues), and every blow meets exactly ONE of them.
 *  CalculateAttackDamage draws the struck part first (FormulaHelper.cs:616, the table at :869) and CalculateArmorToHit
 *  adds that part's value, and that part's alone, to the chance to hit (:808, :1158) - five points of chance for every
 *  point the doll shows. So the one honest single number is the armour a blow MEETS ON AVERAGE: each part's number
 *  weighed by how often a blow lands there. Under FormulaHelper it is exactly a fifth of the armour term a blow's hit
 *  chance takes on average (the 3..97 clamp aside). A SUM of the seven would count a kite shield three times and a helm
 *  as much as a cuirass, where a blow finds the head half as often as the chest; their plain mean would weigh the feet
 *  (1 blow in 20) like the chest (4 in 20). The combat overhaul (on by default) draws the part from a table of its own
 *  and turns a player's armour into a cut in the damage rather than in the chance, so the table is the core's in force
 *  (formulas.js struckBodyPartTable) and the figure claims only what is true under both: the armour a blow meets on
 *  average. Summed in whole counts and divided once. */
export function overallArmour(parts, table = struckBodyPartTable()) {
  const counts = struckCounts(table);
  return parts.reduce((sum, v, part) => sum + v * counts[part], 0) / table.length;
}
/** A figure to the tenth it is shown at. The figures are twentieths, so a tenth's half is exact (S / 20 x 10 is S / 2)
 *  and rounds up. */
export const tenth = (x) => Math.round(x * 10) / 10;

/** The port's armour points a table of worn pieces carries, a part each: every entityMods fold, summed as
 *  computeEntityMods sums them at every equip change, run on a STAND-IN for the wearer that wears `slots` - the
 *  wearer read through (its career, its stats, its Renown's sets), the table its own - so the sum lands on the
 *  stand-in and the wearer's own `_mods` is never written. */
function foldedPoints(entity, slots) {
  const eq = createEquipTable();
  slots.forEach((it, i) => { eq.slots[i] = it ?? null; });
  const standIn = Object.create(entity);
  standIn.equip = eq;
  return computeEntityMods(standIn).armorParts;
}

/**
 * WHAT WEARING `item` WOULD CHANGE, before it is worn - or null where there is no wear to read: a piece no slot takes
 * (EquipItem's own first refusal), one already worn, and one the pack's window refuses (broken, or forbidden to the
 * wearer's career - DaggerfallInventoryWindow.EquipItem :1330-1381, which comes before its wear).
 *   slot      the slot it would take (getEquipSlot)
 *   replaces  what the wear would take off, in EquipItem's own order (wearLeavers), each piece once
 *   parts     every part the piece covers (armorBodyParts) and every part the wear moves, as the doll's number now and
 *             after: DFU's table with each leaver given back and the piece taken off (UpdateEquippedArmorValues), and the
 *             folds' points over the table it would leave. AN UNIDENTIFIED PIECE'S AFFIXES ARE LEFT OUT: its card says
 *             "Unidentified" and no affix, so its comparison says no more (the affixes work once worn, and the doll
 *             shows them then, as DFU's doll shows an unidentified item's powers).
 *   overall   the overall figure now and after, where any part is listed
 *   damage    a weapon against the weapon it would replace - the one in its own slot, else one it takes off with it (a
 *             two-hander's other hand) - by the card's own Damage row; null with no weapon to set it against
 * DFU's enchantment channels (Strengthens / Weakens Armor, BadReactionsFrom) are read as they stand, not re-run for the
 * wear: they are the magic round's fold, one of their writers waits on the foes nearby, and an unidentified item's own
 * must not be read before it is.
 */
export function wearComparison(entity, item) {
  if (!entity || !item || isEquipped(item)) return null;
  if (isBrokenItem(item) || isForbiddenEquip(entity.career, item)) return null;
  const slot = getEquipSlot(entity, item);
  if (slot === EQUIP_SLOTS.None) return null;
  const table = equipTableOf(entity);
  const leavers = wearLeavers(entity, item, slot);
  const replaces = [];
  for (const s of leavers) { const it = table[s]; if (it && !replaces.includes(it)) replaces.push(it); }
  // DFU's table, as the window's EquipItem leaves it (:1382-1390): each leaver's value given back, the piece's taken off
  const now = armorValuesOf(entity);
  const then = { armorValues: [...now] };
  for (const it of replaces) updateEquippedArmorValues(then, it, false);
  updateEquippedArmorValues(then, item, true);
  // the port's points, over the table as it stands and over the table the wear would leave
  const slotsThen = [...table];
  for (const s of leavers) slotsThen[s] = null;
  slotsThen[slot] = itemIsIdentified(item) ? item : { ...item, affixes: [] };
  const pointsNow = foldedPoints(entity, table);
  const pointsThen = foldedPoints(entity, slotsThen);
  const before = dollArmour(entity);
  const after = before.map((v, p) => v + armorLabelValue(then.armorValues[p]) - armorLabelValue(now[p]) + pointsThen[p] - pointsNow[p]);
  const covered = new Set(armorBodyParts(item));
  const parts = [];
  for (let part = 0; part < NUMBER_BODY_PARTS; part++) {
    if (covered.has(part) || after[part] !== before[part]) parts.push({ part, before: before[part], after: after[part] });
  }
  let damage = null;
  if (itemDamageLine(item) != null) {
    const rival = [table[slot], ...replaces].find((it) => it && itemDamageLine(it) != null);
    if (rival) damage = { against: rival, before: weaponDamageRange(rival), after: weaponDamageRange(item) };
  }
  const tableNow = struckBodyPartTable();
  return {
    slot, replaces, parts, damage,
    overall: parts.length ? { before: overallArmour(before, tableNow), after: overallArmour(after, tableNow) } : null,
  };
}

// ── the drawings ─────────────────────────────────────────────────
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** One signed difference in the kit's two tones - `up` (the wear's green) where the wear is better, `down` (its red)
 *  where it is worse, `same` where it moves nothing. Every number here is better HIGHER. */
function delta(d, digits = 0) {
  const r = digits ? tenth(d) : d;
  return el('span', `cmp-d ${r > 0 ? 'up' : r < 0 ? 'down' : 'same'}`, `${r > 0 ? '+' : r < 0 ? '-' : '±'}${Math.abs(r).toFixed(digits)}`);
}

/** THE PART'S NUMBER ON ITS PANEL - the classic doll's label standing where the enhanced pack draws that body part (the
 *  worn map's panel for the part's own slot: ui/enhancedInventory.js wornPanel, through equip.js bodyPartForSlot). A
 *  panel shows it filled or empty, as the doll labels every part. */
export function armourBadge(entity, part) {
  const v = dollArmour(entity)[part];
  const b = el('span', `wornac${v ? '' : ' nil'}`, String(v));
  b.title = `${PART_NAMES[part]}: armour ${v}`;
  b.setAttribute('aria-label', b.title);
  return b;
}

/** THE OVERALL FIGURE ON THE DOLL - its plaque at the head of the figure's column, and in its words what the figure is
 *  and how the parts are weighed (the table in force, said as it stands). */
export function armourPlaque(entity) {
  const table = struckBodyPartTable();
  const fig = tenth(overallArmour(dollArmour(entity), table)).toFixed(1);
  const n = el('div', 'wornac-total');
  n.append(el('span', 'k', 'Armour'), el('span', 'v', fig));
  const counts = struckCounts(table);
  const weights = PART_NAMES.map((name, p) => `${name.toLowerCase()} ${counts[p]}`).join(', ');
  n.title = `Armour ${fig}: the armour a blow meets on average - each part's number weighed by how often a blow lands there (${weights} in ${table.length})`;
  n.setAttribute('aria-label', `Armour ${fig}`);
  return n;
}

/**
 * THE CARD'S COMPARISON - what wearing the piece would change, beside its own stats (ui/enhancedInventory.js infoCard,
 * the hover card and the picked one alike): the pieces it would take off, then a weapon's damage against the one it
 * would replace, the overall figure, and each part (the doll's number now and after, and the difference - green better,
 * red worse). Null where wearComparison is, and for a piece that is neither armour nor a weapon and moves no part (a
 * ring, a shirt): there is no stat to set against another. `nameOf` names a piece (the pack hands itemLongName).
 */
export function compareBlock(entity, item, nameOf = (it) => String(it?.name ?? 'piece')) {
  const cmp = wearComparison(entity, item);
  if (!cmp) return null;
  if (!cmp.parts.length && !cmp.damage && item.group !== 'Armor' && itemDamageLine(item) == null) return null;
  const box = el('div', 'cmp');
  box.append(el('p', 'cmp-head', cmp.replaces.length ? `Replaces ${cmp.replaces.map(nameOf).join(', ')}` : 'Replaces nothing'));
  const dl = el('dl', 'stats cmp-rows');
  const row = (key, text, ...deltas) => {
    const dd = el('dd');
    dd.append(el('span', 'cmp-v', text));
    deltas.forEach((d, i) => { if (i) dd.append(el('span', 'cmp-sep', '/')); dd.append(d); });
    const g = el('div', 'pair');
    g.append(el('dt', null, key), dd);
    dl.append(g);
  };
  if (cmp.damage) {
    const [b0, b1] = cmp.damage.before, [a0, a1] = cmp.damage.after;
    row('Damage', `${b0} - ${b1} → ${a0} - ${a1}`, delta(a0 - b0), delta(a1 - b1));
  }
  if (cmp.overall) {
    const b = tenth(cmp.overall.before), a = tenth(cmp.overall.after);
    row('Overall', `${b.toFixed(1)} → ${a.toFixed(1)}`, delta(a - b, 1));
  }
  for (const { part, before, after } of cmp.parts) row(PART_NAMES[part], `${before} → ${after}`, delta(after - before));
  box.append(dl);
  return box;
}
