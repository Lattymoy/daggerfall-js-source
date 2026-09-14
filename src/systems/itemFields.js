// RF5 (2026-09-14, Mac's refactor pass, the fifth): THE ITEM FIELD
// SCHEMA - one declaration of every field an item record may carry,
// with its kind and its bounds.
//
// THE PROBLEM IT REMOVES. An item record is an OPEN shape - the
// inventory arc grew it, a magic item carries its enchantments, loot
// rarity added `rarity`, `affixes` and `legendary` - and the knowledge
// of what each field IS lived only in its readers. The wire's
// validator (loot.js validLootItem) therefore typed a record as
// "primitives, arrays and plain objects, bounded" and then carried a
// hand list of exceptions: the three array fields a reader indexes
// with an array method (AUDIT WORLD4 B1, one string in a chest froze
// the tab), the affix list's own check (LR4), the templateIndex's
// bounds. Every new field the port departs from DFU with would have
// been another hand line there - or, more likely, none, and the next
// frozen tab.
//
// THE SHAPE. ITEM_FIELDS declares each known field once: `int` (with
// optional min/max), `number`, `bool`, `string` (bounded), `enum`
// (a value list), `array` (an element validator) or `object` (a
// record validator). validItemField(name, value) answers the value as
// the port would carry it - a string cut to its bound - or undefined
// when it is not that kind. A declared field's SHAPE is closed even
// though the record stays open: a field nobody declared still passes
// the wire's bounded clamp (refusing it would be a behaviour change
// and is not this refactor's), but a declared one is checked here,
// and the array list the validator used to carry by hand is derived
// from the kinds.
//
// WHAT DECLARES A FIELD. Every field the port's own mints write
// (loot.js's factories, books, potions, gold, the classic importer,
// equip, repair, loot rarity) is here; test/rf5_itemfields.test.js
// runs the mints and pins that no undeclared key appears.

import { GROUP_TEMPLATE_INDICES } from './itemTemplatesData.js';
import { validAffix, RARITY_ORDER } from './lootRarity.js';

/** The longest string a field carries; the wire's own bound (loot.js LOOT_STR_MAX reads it). */
export const ITEM_STR_MAX = 128;
/** DFU's equip table has 27 slots (paperdoll.js EQUIP_SLOTS). */
export const ITEM_EQUIP_SLOTS = 27;

const int = (o = {}) => ({ kind: 'int', ...o });
const num = () => ({ kind: 'number' });
const bool = () => ({ kind: 'bool' });
const str = () => ({ kind: 'string', max: ITEM_STR_MAX });
const oneOf = (values) => ({ kind: 'enum', values: Object.freeze([...values]) });
const list = (of) => ({ kind: 'array', of });
const rec = (check) => ({ kind: 'object', check });

/** An enchantment as the port carries it (formats/magicDef.js): two small integers. */
export const validEnchantment = (e) => !!e && typeof e === 'object' && !Array.isArray(e)
  && Number.isInteger(e.type) && Number.isInteger(e.param);
/** A repair ticket (repairService.js): the shop's key and two minutes. */
export const validRepairData = (r) => !!r && typeof r === 'object' && !Array.isArray(r)
  && typeof r.buildingKey === 'string' && Number.isInteger(r.timeStarted) && Number.isInteger(r.repairTime);

/** The declared fields, by name. Frozen: a new field is a new line here, not a reader's private knowledge. */
export const ITEM_FIELDS = Object.freeze({
  // identity (DaggerfallUnityItem's, minted by every factory)
  templateIndex: int({ min: 0, max: 65535 }),
  group: oneOf(Object.keys(GROUP_TEMPLATE_INDICES)),
  name: str(),
  material: int(),                 // nativeMaterialValue: weapons 0..9, armor 0x0200-flagged
  dye: int({ min: 0 }),
  variant: int({ min: 0 }),
  flags: int(),
  value: num(),                    // the wire's floor (itemBaseValue) runs after the kind check
  currentCondition: int({ min: 0 }),
  maxCondition: int({ min: 0 }),
  minDamage: int(),
  maxDamage: int(),
  message: int(),
  stackCount: int({ min: 0 }),
  weightInKg: num(),
  typeDependentData: int(),
  enchantmentPoints: int(),
  potionRecipeKey: int({ min: 0 }),
  playerTextureArchive: int({ min: 0 }),
  playerTextureRecord: int({ min: 0 }),
  worldTextureArchive: int({ min: 0 }),
  worldTextureRecord: int({ min: 0 }),
  // state
  equipSlot: int({ min: 0, max: ITEM_EQUIP_SLOTS - 1 }),
  magic: bool(),
  artifact: bool(),
  isIdentified: bool(),
  artifactIndexBitfield: int(),
  enchantments: list(validEnchantment),
  customEnchantments: list(validEnchantment),
  poisonType: int({ min: -1 }),
  trappedSoulType: int(),
  timeForItemToDisappear: int({ min: 0 }),
  timeHealthLeechLastUsed: int({ min: 0 }),
  timeEffectsLastRerolled: int({ min: 0 }),
  stockedDate: int({ min: 0 }),
  repairData: rec(validRepairData),
  // quests (systems/quest/item.js)
  questItem: bool(),
  questUID: int({ min: 0 }),
  questSymbol: rec((s) => typeof s.name === 'string'),
  // the port's own (loot rarity, LR1-LR4)
  rarity: oneOf(RARITY_ORDER),
  legendary: str(),
  affixes: list(validAffix),
});

/** The declared names, and those of one kind. */
export const ITEM_FIELD_NAMES = Object.freeze(Object.keys(ITEM_FIELDS));
export const itemFieldsOfKind = (kind) => ITEM_FIELD_NAMES.filter((k) => ITEM_FIELDS[k].kind === kind);
export const isDeclaredItemField = (name) => Object.hasOwn(ITEM_FIELDS, name);

/** The value as the port would carry it, or undefined when it is not
 *  the declared kind. `null` is "absent" for every field and passes.
 *  An undeclared name passes its value through untouched: the wire's
 *  bounded clamp is the law there. */
export function validItemField(name, v) {
  const d = ITEM_FIELDS[name];
  if (!d) return v;
  if (v == null) return v;
  switch (d.kind) {
    case 'int':
      if (!Number.isInteger(v)) return undefined;
      if (d.min != null && v < d.min) return undefined;
      if (d.max != null && v > d.max) return undefined;
      return v;
    case 'number': return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    case 'bool': return typeof v === 'boolean' ? v : undefined;
    case 'string': return typeof v === 'string' ? (v.length > d.max ? v.slice(0, d.max) : v) : undefined;
    case 'enum': return d.values.includes(v) ? v : undefined;
    case 'array': return Array.isArray(v) && v.every(d.of) ? v : undefined;
    case 'object': return !!v && typeof v === 'object' && !Array.isArray(v) && d.check(v) ? v : undefined;
    default: return undefined;
  }
}

/** Every declared field of a record checked; the record with each
 *  value as carried, or null naming nothing when one is not its kind.
 *  Undeclared fields ride through. */
export function validItemFields(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  for (const k of Object.keys(item)) {
    if (!isDeclaredItemField(k)) continue;
    const c = validItemField(k, item[k]);
    if (c === undefined) return null;
    item[k] = c;
  }
  return item;
}
