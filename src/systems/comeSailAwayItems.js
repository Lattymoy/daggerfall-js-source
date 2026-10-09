// CSA-H (2026-09-27) - COME SAIL AWAY'S TWO ITEMS: ItemBoatParts (1320) and ItemBoatDeed (1321), the custom classes
// Start registers (ComeSailAway.cs:1079-1080, ItemHelper.RegisterCustomItem(index, UselessItems2, type)).
//
// THE ROWS are the bundle's ItemTemplates.json, carried here field for field: the vendored file keeps the author's
// trailing comma (DFU's fsJsonParser takes it, a strict parser does not - test/csa_registration.test.js), so the rows
// ride as Roleplay Realism: Items' do, and test/csa_items.test.js holds them to the file. Registered at import, as
// Iliac Puddle No More's fish are: a row nobody mints costs nothing, and an item the save carries keeps its name,
// weight and picture whether or not the mod is on.
//
// THE CLASSES. Neither stacks (IsStackable false: the port's rule already answers false for a plain UselessItems2
// row), each saves under its own class name (GetSaveData: the port's save copies the record whole), and each has a
// UseItem - the runtime's (systems/comeSailAway.js useBoatParts / useBoatDeed), which the host hands the item-use
// door. RegisterCustomItem's group puts both on DFU's shelves: `customItemsForGroup('UselessItems2')` answers them
// while the mod is loaded for the game (systems/rriItems.js, the one home of GetCustomItemsForGroup), and the shelf's
// second loop stocks them at the rarity's chance (DaggerfallLoot.cs:255-287).
//
// AN ITEM'S UID. DFU gives every item one at construction (DaggerfallUnity.NextUID) and the mod keys two things off
// it: the placed boat a deed stands for (GetPlacedBoatWithUID) and the cargo a packed boat carries (PackedCargoes).
// The port's items carry none, so the mod's two are minted with one (`mintBoatItem`'s `uid`, the host's; the shelf's
// two by `mintShelfBoatUids`) - DECLARED.
import { registerCustomTemplates, setItemFields, mintCondition, registerCustomItemGroup } from './itemTemplates.js';   // CSA-H: RegisterCustomItem's group, on the shelves' one table (FORAGE1's one home)
import { modSetting, modLatchedOn } from './modSettings.js';
import { registerModEffectKind, WATER_WALKING_SILENT_KIND } from './effects.js';
import { HULL_NAMES, HULL_PRICES, HULL_WEIGHTS, VARIANT_NAMES } from './comeSailAwayHulls.js';   // INT1: the leaf, not the boat's renderer

/** ItemBoatParts.templateIndex and ItemBoatDeed.templateIndex. */
export const BOAT_PARTS_TEMPLATE = 1320;
export const BOAT_DEED_TEMPLATE = 1321;
/** RegisterCustomItem's group for both: (ItemGroups)9. */
export const BOAT_ITEM_GROUP = 'UselessItems2';

/** vendor/come-sail-away/ItemTemplates.json, row for row. */
export const CSA_ITEM_TEMPLATES = Object.freeze([
  Object.freeze({ index: 1320, name: 'Parts of', baseWeight: 120, hitPoints: 1400, capacityOrTarget: 400, basePrice: 4000, enchantmentPoints: 1250, rarity: 1, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 0, worldTextureRecord: 0, playerTextureArchive: 212, playerTextureRecord: 11, hasNoEncumbrance: false }),
  Object.freeze({ index: 1321, name: 'Deed to', baseWeight: 0.5, hitPoints: 1400, capacityOrTarget: 400, basePrice: 6000, enchantmentPoints: 1250, rarity: 1, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: 0, worldTextureRecord: 0, playerTextureArchive: 209, playerTextureRecord: 5, hasNoEncumbrance: false }),
]);
registerCustomTemplates(CSA_ITEM_TEMPLATES);

/** The mod loaded at all: its classes answer only then, as DFU registers them only for a loaded mod. */
const csaLoaded = () => {
  const latched = modLatchedOn('come-sail-away');   // AUDIT PRE-MERGE 0928 S4: loaded for the game - the world host's answer at its mount, so a switch flipped mid-game stocks nothing until the next load
  if (latched !== undefined) return latched;
  try { return modSetting('come-sail-away', 'Enabled') !== false; } catch { return false; }
};
registerCustomItemGroup(BOAT_PARTS_TEMPLATE, BOAT_ITEM_GROUP, csaLoaded);
registerCustomItemGroup(BOAT_DEED_TEMPLATE, BOAT_ITEM_GROUP, csaLoaded);
// AUDIT PRE-MERGE 0928 S3: StartWaterwalking's WaterWalkingSilent is this mod's own effect - with the mod not loaded,
// DFU's broker cannot instantiate it, and a save's restore skips it (systems/save.js restorePlayer)
registerModEffectKind(WATER_WALKING_SILENT_KIND, csaLoaded);

/**
 * ItemBuilder.CreateItem(UselessItems2, templateIndex) for one of the two: SetItem's fields off the row - the name,
 * the template's price and weight - and the item's UID (the host's mint).
 */
export function mintBoatItem(templateIndex, uid) {
  return mintCondition(setItemFields({ group: BOAT_ITEM_GROUP, templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1, UID: uid }));
}

/** An index the C#'s arrays would throw on: IndexOutOfRangeException, as `hullNames[num]` does. */
function at(table, i, what) {
  if (!(Number.isInteger(i) && i >= 0 && i < table.length)) throw new RangeError(`IndexOutOfRangeException: Index was outside the bounds of the array. (${what} ${i})`);
  return table[i];
}
/** `shortName + " " + hullNames[hull] + " '" + variantNames[variant] + "'"` - every writer's one form. */
export const boatItemName = (name, hull, variant) => `${name} ${at(HULL_NAMES, hull, 'hull')} '${at(VARIANT_NAMES, variant, 'variant')}'`;
/** The item's message: `hull * 10 + variant` (PackBoat, giveboat and the shelf alike). */
export const boatItemMessage = (hull, variant) => hull * 10 + variant;

/**
 * SHIP-CLAIM (2026-10-01, the port's own - bible/03-World/Naval-Combat.md SHIP-CLAIM): A DEED TO ONE HULL AND VARIANT,
 * minted as the shelf mints a deed - ItemBuilder.CreateItem (`mintBoatItem`, the host's UID) given the deed arm's
 * message and name (AssignVariantsToShopItems: `hull * 10 + variant`, "Deed to Small Ship 'I'") - at `value` gold: a
 * prize claimed at sea (scenes/navalHost.js claimPrize; her value navalPlunder.js prizeDeedValue). Its weight is the
 * row's half kilogram, as every deed's. A hull or variant the C#'s arrays would throw on throws here too.
 */
export function mintDeed(hull, variant, uid, value) {
  const deed = mintBoatItem(BOAT_DEED_TEMPLATE, uid);
  deed.message = boatItemMessage(hull, variant);
  deed.value = value;
  deed.name = boatItemName(deed.name, hull, variant);
  return deed;
}

/**
 * The shelf's two given the UID DFU's construction gives every item (DaggerfallUnityItem's constructor,
 * DaggerfallUnity.NextUID): the port's shelf mints its items with none, and a deed without one would answer any boat
 * another such deed placed (GetPlacedBoatWithUID). An item that has one keeps it; `uid()` is the host's mint.
 */
export function mintShelfBoatUids(items, uid) {
  for (const item of items) if ((item.templateIndex === BOAT_PARTS_TEMPLATE || item.templateIndex === BOAT_DEED_TEMPLATE) && item.UID == null) item.UID = uid();
  return items;
}

/**
 * OpenCargo's LootTarget (6521-6525): the boat's DaggerfallLoot as the port's pack reads a loot target
 * (systems/inventorySession.js remoteTarget) - `items()`, the live list the pack takes from and stows into (the helm's
 * cargo weight reads the same list); `containerImage()`, the remote panel's picture, the cargo's Merchant (6);
 * `playerOwned`, which the mod sets. Its TextureArchive is nought, so the pack's drop-icon arms stand down, as DFU's do.
 */
export const cargoLootTarget = (cargo) => ({ items: () => cargo.Items, containerImage: () => cargo.ContainerImage, playerOwned: cargo.playerOwned !== false });

/**
 * AssignVariantsToShopItems (6692-6717), PlayerActivate.OnLootSpawned's subscriber (6687): every deed on the shelf
 * a random hull of the three between (Random.Range(1, 4): never the Rowboat or the Carrack), variant I, priced as the
 * hull (its weight the row's half kilogram); every parts a Rowboat 'I', priced and weighed as one. Each item is
 * written in place, as the C#'s are; `range(min, max)` is UnityEngine.Random.Range's int form (max exclusive).
 */
export function assignVariantsToShopItems(items, range) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.templateIndex === BOAT_DEED_TEMPLATE) {
      const num = range(1, 4);
      const num2 = 0;
      item.message = boatItemMessage(num, num2);
      item.value = at(HULL_PRICES, num, 'hull');
      item.name = boatItemName(item.name, num, num2);
    } else if (item.templateIndex === BOAT_PARTS_TEMPLATE) {
      const num3 = 0;
      const num4 = 0;
      item.message = boatItemMessage(num3, num4);
      item.value = HULL_PRICES[num3];
      item.weightInKg = HULL_WEIGHTS[num3];
      item.name = boatItemName(item.name, num3, num4);
    }
  }
  return items;
}
