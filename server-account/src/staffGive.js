// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-GIVE (2026-10-24, mob: "add yes we will work on add as well"; the card's pick "Pick from the item list"; "include
// enchants") - ADD AN ITEM TO A PLAYER, the Remove from a player's twin. Admins alone (staffRealm.js asks the role before
// any door); OFFLINE ONLY until mob tries it live.
//
// The item is MINTED HERE, never written by the panel: staff name a template from the game's own list, a material where
// the kind has one, a count where it stacks, and enchantments from the item maker's own catalogue - and the piece is made
// by the producers the game makes it with (combat/enemyEquipment.js weaponOfMaterial and armorOfMaterial, CreateWeapon's
// arrow arm; itemTemplates.js setItemFields and mintCondition for any other kind; enchanting.js applyEnchantments over
// enchantmentCatalogue.js pickEnchantment's rows, a bound soul's forced rows with it). NOTHING NEW IS JUDGED (mob, 09:22Z:
// "use the validators the server already has"): the piece is asked of the item law (itemLaw.js itemFindings) before it
// is given, and one the law would find - an enchantment past the item's power, a weapon's power on armour - is refused, so
// a gift never holds the player's trade. Enchantments are the item maker's, within its limit, as DFU's window takes them.
//
// The record moves one save on with its seat taken (realm.js seizeRealmRecord - Put back's way, the piece pushed into the
// pack), the piece's worth WITNESSED (prepareRealmRecord), so the wealth past the allowance never counts a gift; a
// valuable piece is given its ledger id (itemIds.js) and the ledger enters it as the record's own. Preview first (no
// `confirm`: the piece as it will be, its findings, its enchantment cost against its power, its worth, whether they are
// playing); then, `confirm: true` with a reason and a note and the `seq` staff looked at, given.
import { itemFindings, itemWorth, lawTemplate, templateGroups, GOLD_INT_MAX } from '../../src/systems/item/itemLaw.js';
import { customTemplateRows, setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { GROUP_TEMPLATE_INDICES } from '../../src/systems/item/itemTemplatesData.js';
import { createWeapon, weaponOfMaterial, armorOfMaterial, ARROW_TEMPLATE } from '../../src/combat/enemyEquipment.js';
import { applyEnchantments, itemEnchantmentPower, MAX_ENCHANTMENTS } from '../../src/systems/enchanting.js';
import {
  pickEnchantment, enchantmentTypes, enchantmentName, enchantmentParamValues, enchantmentParamName, enchantmentCost, isSideEffect,
  hasItemMakerFlag, ITEM_MAKER_FLAGS,
} from '../../src/systems/enchantmentCatalogue.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { isStackable, LETTER_OF_CREDIT_TEMPLATE } from '../../src/systems/inventory.js';
import { valuablePiece, mintItemId } from '../../src/systems/item/itemIds.js';

/** Why staff give: a reward a bug ate, an event's prize, amends for a staff mistake, a test, or another (said in the note). */
export const GIVE_REASONS = Object.freeze(['bug-refund', 'event-prize', 'compensation', 'testing', 'other']);
/** The most enchantments one gift names - the item maker's cap (enchanting.js applyEnchantments keeps eleven rows). */
export const GIVE_ENCHANT_MAX = MAX_ENCHANTMENTS + 1;
/** A weapon's materials and an armour's, by name, as the item list offers them. */
const WEAPON_MATS = Object.freeze(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([name, v]) => [v, name]));
const ARMOR_MATS = Object.freeze(Object.entries(ARMOR_MATERIAL).filter(([k, v]) => v >= 0 && k !== 'Chain2').map(([name, v]) => [v, name]));

/** The groups each template stands in: the classic table's, then the port's own registered rows. */
function templateList() {
  /** @type {Map<number, string[]>} */
  const groups = new Map();
  for (const [g, list] of Object.entries(GROUP_TEMPLATE_INDICES)) for (const i of list) groups.set(i, [...(groups.get(i) ?? []), g]);
  for (const r of customTemplateRows()) if (Number.isInteger(r?.index) && !groups.has(r.index)) groups.set(r.index, templateGroups(r.index));
  return [...groups].map(([i, gs]) => ({ i, name: lawTemplate(i)?.name ?? `#${i}`, groups: gs })).filter((t) => t.name && t.groups.length);
}

/**
 * THE ITEM LIST the panel picks from (cached - the tables are the game's, fixed while the Worker lives): each template
 * with its groups and whether it stacks; the materials a weapon and an armour take; the enchantments, each a power or a
 * side effect, whether it is a weapon's alone, and its settings with their names and costs.
 */
let _catalogue = /** @type {any} */ (null);
export function giveCatalogue() {
  if (_catalogue) return _catalogue;
  const items = templateList().map((t) => ({ ...t, stacks: t.groups.some((group) => isStackable({ group, templateIndex: t.i })) }));
  const enchants = enchantmentTypes().map((key) => ({
    key, name: enchantmentName(key), side: isSideEffect(key), weaponOnly: hasItemMakerFlag(key, ITEM_MAKER_FLAGS.WeaponOnly),
    params: enchantmentParamValues(key).map((p) => [p, enchantmentParamName(key, p), enchantmentCost(key, p)]),
  }));
  _catalogue = { items, letter: LETTER_OF_CREDIT_TEMPLATE, materials: { Weapons: WEAPON_MATS, Armor: ARMOR_MATS }, enchants, enchantMax: GIVE_ENCHANT_MAX, reasons: GIVE_REASONS };
  return _catalogue;
}

/**
 * ONE GIFT, MINTED: `{ template, group?, material?, count?, gold?, enchant?: [{ key, param }] }` made by the game's
 * producers - `gold` a letter of credit's worth (its `value`, what the bank wrote on it), and no other kind's.
 * Answers `{ item, findings, cost, power }` - `findings` the item law's, `cost` the chosen enchantments' against the
 * item's `power` - or `{ error }`: 'staff-item-template' (no such template, a group it does not stand in, a material its
 * kind does not take, a count it cannot hold), 'staff-item-enchant' (a setting the catalogue does not cost, or too many).
 * The ledger id is the caller's to mint (`uid`).
 * @param {any} spec @param {((b: Uint8Array<ArrayBuffer>) => Uint8Array) | undefined} [rand]
 */
export function mintGift(spec, rand = undefined) {
  const i = spec?.template;
  if (!Number.isInteger(i) || !lawTemplate(i)) return { error: 'staff-item-template' };
  const groups = templateGroups(i);
  const group = spec.group === undefined ? groups[0] : spec.group;
  if (!groups.includes(group)) return { error: 'staff-item-template' };
  const count = spec.count === undefined ? 1 : spec.count;
  if (!Number.isSafeInteger(count) || count < 1 || count > GOLD_INT_MAX) return { error: 'staff-item-template' };
  const mats = group === 'Weapons' ? WEAPON_MATS : group === 'Armor' ? ARMOR_MATS : null;
  const material = mats ? (spec.material === undefined ? mats[0][0] : spec.material) : undefined;
  if (mats && !mats.some(([v]) => v === material)) return { error: 'staff-item-template' };
  if (!mats && spec.material !== undefined) return { error: 'staff-item-template' };
  /** @type {any} */
  let item;
  if (group === 'Weapons' && i === ARROW_TEMPLATE) item = { ...createWeapon(ARROW_TEMPLATE, 0, () => 0), stackCount: count };   // CreateWeapon's arrow arm: its stack the count asked
  else if (group === 'Weapons') item = weaponOfMaterial(i, material);
  else if (group === 'Armor') item = armorOfMaterial(i, material);
  else item = mintCondition(setItemFields({ group, templateIndex: i }));
  if (spec.gold !== undefined) {
    if (i !== LETTER_OF_CREDIT_TEMPLATE || !Number.isSafeInteger(spec.gold) || spec.gold < 1 || spec.gold > GOLD_INT_MAX) return { error: 'staff-item-template' };
    item.value = spec.gold;
  }
  if (count > 1) {
    if (!isStackable(item)) return { error: 'staff-item-template' };
    item.stackCount = count;
  }
  const asked = Array.isArray(spec.enchant) ? spec.enchant : [];
  if (asked.length > GIVE_ENCHANT_MAX) return { error: 'staff-item-enchant' };
  /** @type {any[]} */
  const rows = [];
  for (const e of asked) {
    // the item maker's own pick (its catalogue costs no artifact's power): a bound soul brings its forced rows with it
    const pick = typeof e?.key === 'string' ? pickEnchantment(e.key, e.param) : null;
    if (!pick || pick.kind !== 'add') return { error: 'staff-item-enchant' };
    rows.push(pick.settings, ...pick.powers, ...pick.sideEffects);
  }
  if (rows.length > GIVE_ENCHANT_MAX) return { error: 'staff-item-enchant' };
  if (rows.length) applyEnchantments(item, rows);
  if (valuablePiece(item)) item.uid = mintItemId(rand);
  const cost = rows.reduce((s, r) => s + ((r.parentEnchantment ?? 0) === 0 ? r.enchantCost : 0), 0);
  return { item, findings: itemFindings(item), cost, power: rows.length ? itemEnchantmentPower(item, lawTemplate) : 0 };
}

/** What the preview says of a minted gift - its worth as the wealth measure counts it, never a throw. @param {any} item */
export function giftWorth(item) {
  try { return itemWorth(item); } catch { return null; }
}
