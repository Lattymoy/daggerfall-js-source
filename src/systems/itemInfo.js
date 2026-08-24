// U25: THE ITEM INFO PANEL'S TEXT. 1:1 from ItemHelper.GetItemInfo
// (:748-817) and the %-macros DaggerfallUnityItemMCP binds for it
// (:117-165). MIT, Daggerfall Workshop.
//
// U8e's inventory shipped an INTERIM info panel that made up its own
// three lines (name / weight / value). This is the real thing: DFU
// picks one of thirteen TEXT.RSC records by the item's GROUP and
// TEMPLATE, and each record is a macro string the item fills in. The
// panel therefore reads differently for a sword, a shield, an arrow,
// a soul trap and a letter of credit - which is most of what the
// panel is FOR.
//
// ── the record switch (:764-816) ──────────────────────────────────
// Armor and weapons each have a WITH- and WITHOUT-material record,
// and which one draws is not cosmetic: an ARTIFACT never shows its
// material, and arrows have a record of their own with no condition
// line at all. MiscItems is four special templates before its
// default. The final `default:` arm catches potions (a filled glass
// bottle) before falling back to the misc record.
import { unitWeightInKg } from './inventory.js';   // AUDIT 23 (items-8)
import { enemyDisplayName } from '../characters/enemyBasics.js';   // X5: %hs, the trapped soul's name
import { itemIsIdentified } from './tradeModes.js';   // X7: the DERIVED identified state
import { templateByIndex, itemBaseValue } from './itemTemplates.js';
import { isPotion, isPotionRecipe, TEMPLATES } from './useItem.js';
import { materialArmorValue, isShieldTemplate } from './armorMaterials.js';
import { weaponMaterialModifier, weaponMinDamage, weaponMaxDamage, WEAPON_MATERIALS } from '../characters/weapons.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';

/** The thirteen ids GetItemInfo names as constants (:750-762). */
export const INFO_TEXT = Object.freeze({
  painting: 250,
  armor: 1000,
  weapon: 1001,
  misc: 1003,
  soulTrap: 1004,
  letterOfCredit: 1007,
  potion: 1008,
  book: 1009,
  arrow: 1011,
  weaponNoMaterial: 1012,
  armorNoMaterial: 1014,
  oghmaInfinium: 1015,
  houseDeed: 1073,
});

/** ArmorShouldShowMaterial (:822-848). The HelmAndShieldMaterialDisplay
 *  setting has four values and DFU's DEFAULT is 0 - "classic
 *  behavior", where a helm or a shield never shows its material. The
 *  port has no settings layer, so it ships classic's answer; an
 *  artifact never shows one either way. */
export const HELM_AND_SHIELD_MATERIAL_DISPLAY = 0;
export function armorShouldShowMaterial(item) {
  // `artifact`/`oghmaInfinium`/`azurasStar` are minted by loot.js's
  // createArtifact since Q2b-ii (the quest Item mint's artifact arm) -
  // AUDIT 22 F11's producerless-flags pin retired that day, replaced
  // by producer-shape pins in test/iteminfo.test.js.
  if (item?.artifact) return false;
  const isHelmOrShield = isShieldTemplate(item?.templateIndex) || item?.templateIndex === TEMPLATES.Helm;
  if (isHelmOrShield) {
    // every arm of the setting switch is false at 0
    return HELM_AND_SHIELD_MATERIAL_DISPLAY === 3;
  }
  return true;
}

/** GetItemInfo (:748-817), as the TEXT.RSC id it resolves to. */
export function itemInfoTextId(item) {
  if (!item) return INFO_TEXT.misc;
  switch (item.group) {
    case 'Armor':
      return armorShouldShowMaterial(item) ? INFO_TEXT.armor : INFO_TEXT.armorNoMaterial;
    case 'Weapons':
      if (item.templateIndex === TEMPLATES.Arrow) return INFO_TEXT.arrow;
      if (item.artifact) return INFO_TEXT.weaponNoMaterial;
      return INFO_TEXT.weapon;
    case 'Books':
      return item.oghmaInfinium ? INFO_TEXT.oghmaInfinium : INFO_TEXT.book;
    case 'Paintings':
      return INFO_TEXT.painting;
    case 'MiscItems':
      if (isPotionRecipe(item)) return INFO_TEXT.misc;   // DFU builds recipe tokens by hand - FLAGGED
      if (item.templateIndex === TEMPLATES.House_Deed) return INFO_TEXT.houseDeed;
      if (item.templateIndex === TEMPLATES.Soul_trap) return INFO_TEXT.soulTrap;
      if (item.templateIndex === TEMPLATES.Letter_of_credit) return INFO_TEXT.letterOfCredit;
      return INFO_TEXT.misc;
    default:
      if (isPotion(item)) return INFO_TEXT.potion;
      if (item.azurasStar) return INFO_TEXT.soulTrap;
      return INFO_TEXT.misc;
  }
}

// ── the macros the panel fills (DaggerfallUnityItemMCP :117-165) ──

/** Condition() (:130-142). Eight words over seven thresholds, and the
 *  walk is `while (percentage > threshold[i]) i++` - so the bands are
 *  keyed on the FIRST threshold the percentage does not exceed. An
 *  item whose condition is ABOVE its maximum falls out of the ladder
 *  entirely and prints the raw number. */
export const CONDITION_WORDS = Object.freeze(['Broken', 'Useless', 'Battered', 'Worn',
  'Used', 'Slightly Used', 'Almost New', 'New']);
export const CONDITION_THRESHOLDS = Object.freeze([1, 5, 15, 40, 60, 75, 91, 101]);

/** ConditionPercentage (:460-463): `100 * current / max`, C# integer
 *  division, and 100 when the item has no maximum at all. */
export const conditionPercentage = (item) => ((item?.maxCondition ?? 0) > 0
  ? Math.trunc(100 * (item.currentCondition ?? 0) / item.maxCondition)
  : 100);

export function conditionWord(item) {
  const max = item?.maxCondition ?? 0;
  if (!(max > 0 && (item.currentCondition ?? 0) <= max)) return String(item?.currentCondition ?? 0);
  const pct = conditionPercentage(item);
  let i = 0;
  while (i < CONDITION_THRESHOLDS.length - 1 && pct > CONDITION_THRESHOLDS[i]) i++;
  return CONDITION_WORDS[i];
}

/** Weight() (:144-148): the STACK's weight, printed with no decimals
 *  when it is whole and two when it is not. */
export function weightString(item) {
  // AUDIT 23 (items-8): weightInKg is MATERIAL-ADJUSTED (a daedric
  // dagger is not an iron one) - the old read took the raw template
  // weight off a field nothing ever wrote.
  const weight = unitWeightInKg(item) * (item?.stackCount ?? 1);
  return weight % 1 === 0 ? String(weight) : weight.toFixed(2);
}

/** WeaponDamage() (:150-154): "min - max", both shifted by the
 *  material modifier. */
export function weaponDamageString(item) {
  const mod = weaponMaterialModifier(item?.material ?? WEAPON_MATERIALS.Iron);
  return `${weaponMinDamage(item.templateIndex) + mod} - ${weaponMaxDamage(item.templateIndex) + mod}`;
}

/** ArmourMod() (:157-160): GetMaterialArmorValue with a C# "+0;-0;0"
 *  format - a PLUS SIGN on a positive value, and a bare 0 on zero.
 *  DFU's own comment: "Armour mod is double what classic displays,
 *  but this is correct according to Allofich." */
export function armourModString(item) {
  const v = materialArmorValue(item?.material ?? ARMOR_MATERIAL.Leather);
  return v > 0 ? `+${v}` : v < 0 ? `-${Math.abs(v)}` : '0';
}

/** The material NAMES the %mat macro resolves (TextProvider's
 *  GetArmorMaterialName / GetWeaponMaterialName). Armor's enum is
 *  bit-packed (0x0200 | tier) where the weapon's is a plain 0..9, so
 *  the two tables are keyed differently and share their words. */
export const MATERIAL_NAMES = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven',
  'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
export function materialName(item) {
  const m = item?.material;
  if (item?.group === 'Armor') {
    if (m === ARMOR_MATERIAL.Leather) return 'Leather';
    if (m === ARMOR_MATERIAL.Chain || m === ARMOR_MATERIAL.Chain2) return 'Chain';
    return MATERIAL_NAMES[(m ?? 0) & 0xff] ?? '';
  }
  return MATERIAL_NAMES[m ?? 0] ?? '';
}

/** The panel's macro pass. Everything the port can compute is filled;
 *  the ones it cannot are named rather than left raw: %po the potion's
 *  recipe name, %bt/%ba the book's title and author (BOOKS.BSA has no
 *  reader yet). Each falls back to the item's own name or a dash,
 *  which is what an unfilled macro would otherwise print raw on
 *  screen. FLAGGED as a group - they land with their own arcs.
 *
 *  X5: %hs LEFT THAT GROUP. It is the trapped soul's name, and it had
 *  no producer because nothing could fill a soul trap; now the trap
 *  fires, so the default resolves the item's own trappedSoulType
 *  through the bestiary rather than printing "Nothing" over a full
 *  gem. An explicit `soul` still wins, and an EMPTY trap still reads
 *  "Nothing" - which is the right word for it. */
export function expandItemInfo(text, item, { name = null, soul = null, potion = null, bookTitle = null, bookAuthor = null } = {}) {
  const t = templateByIndex(item?.templateIndex);
  // X7: ResolveItemName (:265-292) and ResolveItemLongName (:296-303).
  // An UNIDENTIFIED item gives up two things at once: its own name
  // falls back to the bare TEMPLATE name - so an enchanted blade reads
  // "Broadsword" rather than whatever its shortName calls it - and the
  // long name drops the MATERIAL prefix as well, so a Daedric one does
  // not announce itself either. Both are the same `if (!IsIdentified)`
  // early return in DFU, one per function.
  //
  // An ARTIFACT shares the material half of that (`!IsIdentified ||
  // IsArtifact` at :302) - Azura's Star is not "an Ebony Amulet".
  const identified = itemIsIdentified(item);
  const itemName = identified
    ? (name ?? item?.name ?? t?.name ?? '')
    : (t?.name ?? '');
  const soulName = soul ?? (item?.trappedSoulType != null ? enemyDisplayName(item.trappedSoulType) : null);
  return (text ?? '')
    .replaceAll('%it', itemName)
    .replaceAll('%arm', itemName)
    .replaceAll('%wep', itemName)
    .replaceAll('%bt', bookTitle ?? itemName)
    .replaceAll('%ba', bookAuthor ?? 'Anonymous')
    .replaceAll('%po', potion ?? itemName)
    .replaceAll('%hs', soulName ?? 'Nothing')
    .replaceAll('%mat', identified && !item?.artifact ? materialName(item) : '')
    .replaceAll('%qua', conditionWord(item))
    .replaceAll('%kg', weightString(item))
    .replaceAll('%wth', String((item?.value ?? itemBaseValue(item)) * (item?.stackCount ?? 1)))   // AUDIT 23 (items-7): Worth() = value x stackCount
    .replaceAll('%wdm', item?.group === 'Weapons' ? weaponDamageString(item) : '')
    .replaceAll('%mod', item?.group === 'Armor' ? armourModString(item) : '');
}

/** The panel's rows: the record, expanded, split on its own breaks.
 *  `rows(id)` is the host's TEXT.RSC reader. */
export function itemInfoRows(item, rows, macros = {}) {
  return (rows(itemInfoTextId(item)) ?? [])
    .map((r) => ({ ...r, text: expandItemInfo(r.text, item, macros) }))
    .filter((r) => r.text.trim() !== '');
}
