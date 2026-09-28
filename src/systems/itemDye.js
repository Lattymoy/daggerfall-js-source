// DW3: DaggerfallUnityItem.dyeColor, AS THE PORT'S ITEMS CARRY IT.
//
// DFU keeps one field on every item and four writers fill it:
//   - SetItem (DaggerfallUnityItem.cs:559): Unchanged, the default;
//   - CreateWeapon (ItemBuilder.cs:412): GetWeaponDyeColor(material);
//   - CreateArmor (ItemBuilder.cs:510): GetArmorDyeColor(material);
//   - the clothing makers (ItemBuilder.cs:148, :174, :203): the dye
//     rolled or asked for;
//   - SetArtifact (DaggerfallUnityItem.cs:611): Unchanged - AFTER the
//     weapon maker ran, so a minted artifact's dye is not its metal's.
// GetItemImage reads that field (ItemHelper.cs:402) and asks the
// replacement door by it (:453, :458), which is what this answers for.
//
// The port's items were minted with the same values under three names:
// a weapon's `dyeColor` (characters/weapons.js weaponDyeColor), a
// clothing item's `dye` (systems/createItem.js), and an armor's is
// derived from its material where it is drawn (ui/paperDoll.js). This
// is the one read.
import { DYE_COLORS, DYE_TARGETS } from '../characters/dyes.js';
import { weaponDyeColor } from '../characters/weapons.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';

/** ItemHelper.GetArmorDyeColor, verbatim (default: Unchanged). */
export function armorDyeColor(material) {
  const M = ARMOR_MATERIAL, D = DYE_COLORS;
  switch (material) {
    case M.Iron: return D.Iron;
    case M.Steel: return D.Steel;
    case M.Silver: return D.Silver;
    case M.Elven: return D.Elven;
    case M.Dwarven: return D.Dwarven;
    case M.Mithril: return D.Mithril;
    case M.Adamantium: return D.Adamantium;
    case M.Ebony: return D.Ebony;
    case M.Orcish: return D.Orcish;
    case M.Daedric: return D.Daedric;
    default: return D.Unchanged;
  }
}

/** DYE-ICON: WHICH SWATCH GetItemImage's ChangeDye dyes (ItemHelper.cs:473-476) - a weapon's or a piece of armour's
 *  metal one (never an artifact's: it wears its own colours, :473 `!item.IsArtifact`), a garment's cloth one, and
 *  anything else none. */
export function itemDyeTarget(item) {
  if (!item) return null;
  if ((item.group === 'Weapons' || item.group === 'Armor') && !item.artifact) return DYE_TARGETS.WeaponsAndArmor;
  if (item.group === 'MensClothing' || item.group === 'WomensClothing') return DYE_TARGETS.Clothing;
  return null;
}

/** The item's dyeColor. */
export function itemDyeColor(item) {
  if (!item) return DYE_COLORS.Unchanged;
  if (item.artifact) return DYE_COLORS.Unchanged;   // SetArtifact :611, the last writer
  if (item.group === 'Weapons') return Number.isFinite(item.dyeColor) ? item.dyeColor : weaponDyeColor(item.material ?? item.nativeMaterialValue);
  if (item.group === 'Armor') return Number.isFinite(item.dyeColor) ? item.dyeColor : armorDyeColor(item.material ?? item.nativeMaterialValue);
  if (item.group === 'MensClothing' || item.group === 'WomensClothing') return Number.isFinite(item.dye) ? item.dye : Number.isFinite(item.dyeColor) ? item.dyeColor : DYE_COLORS.Unchanged;
  return Number.isFinite(item.dyeColor) ? item.dyeColor : DYE_COLORS.Unchanged;
}
