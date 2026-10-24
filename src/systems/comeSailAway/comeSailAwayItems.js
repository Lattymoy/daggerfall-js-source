// CSA-H (2026-09-27) - COME SAIL AWAY'S TWO ITEMS: ItemBoatParts (1320) and ItemBoatDeed (1321), the custom classes
// Start registers (ComeSailAway.cs:1079-1080, ItemHelper.RegisterCustomItem(index, UselessItems2, type)).
//
// THE ROWS are the bundle's ItemTemplates.json, carried here field for field: the vendored file keeps the author's
// trailing comma (DFU's fsJsonParser takes it, a strict parser does not - test/systems/csa_registration.test.js), so the rows
// ride as Roleplay Realism: Items' do, and test/systems/csa_items.test.js holds them to the file. Registered at import, as
// Iliac Puddle No More's fish are: a row nobody mints costs nothing, and an item the save carries keeps its name,
// weight and picture whether or not the mod is on.
//
// THE CLASSES. Neither stacks (IsStackable false: the port's rule already answers false for a plain UselessItems2
// row), each saves under its own class name (GetSaveData: the port's save copies the record whole), and each has a
// UseItem - the runtime's (systems/comeSailAway/comeSailAway.js useBoatParts / useBoatDeed), which the host hands the item-use
// door. RegisterCustomItem's group put both on DFU's shelves (the shelf's second loop stocked them at the rarity's
// chance, DaggerfallLoot.cs:255-287) until SHIPYARDS (2026-10-11) took them off every shelf: a port town's shipyard
// sells every hull now (systems/shipyards.js) - a DECLARED departure.
//
// AN ITEM'S UID. DFU gives every item one at construction (DaggerfallUnity.NextUID) and the mod keys two things off
// it: the placed boat a deed stands for (GetPlacedBoatWithUID) and the cargo a packed boat carries (PackedCargoes).
// The port's items carry none, so the mod's two are minted with one (`mintBoatItem`'s `uid`, the host's; the shelf's
// two by `mintShelfBoatUids`) - DECLARED.
import { registerCustomTemplates, setItemFields, mintCondition } from '../item/itemTemplates.js';   // CSA-H: the rows' one table; SHIPYARDS: RegisterCustomItem's group no longer stocks them (below)
import { modSetting, modLatchedOn } from '../modSettings.js';
import { registerModEffectKind, WATER_WALKING_SILENT_KIND } from '../effects.js';
import { HULL_NAMES, HULL_PRICES, HULL_WEIGHTS, VARIANT_NAMES } from './comeSailAwayHulls.js';   // INT1: the leaf, not the boat's renderer
import { packedHullWeight, hullFromMessage } from './comeSailAwayHulls.js';   // PARTS-WEIGHT: the load's repair, from the leaf too

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
// SHIPYARDS (2026-10-11, Mac: "Shipyard only"): THE TWO ROWS ON NO SHELF. A port town's shipyard sells every hull and
// buys them back (systems/shipyards.js), so RegisterCustomItem's group no longer stocks them on a General Store's or a
// Pawn Shop's shelf (the shelf's second loop, DaggerfallLoot.cs:255-287), and no shop buys them (systems/shopStock.js
// shopBuysItem) - a DECLARED departure from the mod (Ledger A, SHIPYARDS), as MERCHANT-YARDS took DFU's horse and cart
// off the General Store. AssignVariantsToShopItems stands, ported: a shelf stocked before (a save's) is still rewritten.
// AUDIT PRE-MERGE 0928 S3: StartWaterwalking's WaterWalkingSilent is this mod's own effect - with the mod not loaded,
// DFU's broker cannot instantiate it, and a save's restore skips it (systems/save/save.js restorePlayer)
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
 * prize claimed at sea (scenes/naval/navalHost.js claimPrize; her value navalPlunder.js prizeDeedValue). Its weight is the
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
 * SHIPYARDS (2026-10-11, the port's own - bible/03-World/Shipyards.md): A BOAT'S PARTS OF ONE HULL AND VARIANT, minted as
 * the shelf's parts were (AssignVariantsToShopItems' parts arm: `hull * 10 + variant`, the hull's price and weight,
 * "Parts of Rowboat 'I'") - the shipyard's Rowboat (systems/shipyards.js). A hull or variant the C#'s arrays would
 * throw on throws here too.
 */
export function mintParts(hull, variant, uid) {
  const parts = mintBoatItem(BOAT_PARTS_TEMPLATE, uid);
  parts.message = boatItemMessage(hull, variant);
  parts.value = at(HULL_PRICES, hull, 'hull');
  parts.weightInKg = HULL_WEIGHTS[hull];
  parts.name = boatItemName(parts.name, hull, variant);
  return parts;
}

/**
 * PARTS-WEIGHT (FIELD BUGS 2026-10-18e, the port's own): THE LOAD'S REPAIR OF A BOAT'S PARTS - each given its hull's
 * packed weight (comeSailAwayHulls.js packedHullWeight), in place. Before PARTS-WEIGHT her hold rode her
 * parts (PackBoat's sum, and the hold door's), so parts a stow had grown sat in chests no take could lift them from - a
 * Large Galley's past an emptied pack. Her hold is kept under her number all along (PackedCargoes), so nothing is lost.
 * A hull the table has no row for is left. Answers how many it made right; a second run makes none.
 * @param {any[]} list
 */
export function repairPartsWeights(list) {
  let n = 0;
  for (const item of Array.isArray(list) ? list : []) {
    if (item?.templateIndex !== BOAT_PARTS_TEMPLATE) continue;
    const kg = packedHullWeight(hullFromMessage(item.message | 0));
    if (Number.isFinite(kg) && item.weightInKg !== kg) { item.weightInKg = kg; n++; }
  }
  return n;
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
 * CARGO-ANYWHERE (2026-10-17, bible/03-World/Naval-Refit.md): `storage` - the player's own (SHIP-STORE's word,
 * ui/enhanced/enhancedInventory.js remoteModel): the Enhanced skins opened a hold TAKE-ONLY, the pile's frame alone, so
 * nothing could be stowed in it there; the classic skin was always two-way, as the mod's own window is.
 */
export const cargoLootTarget = (cargo) => ({ items: () => cargo.Items, containerImage: () => cargo.ContainerImage, playerOwned: cargo.playerOwned !== false, storage: true });

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
