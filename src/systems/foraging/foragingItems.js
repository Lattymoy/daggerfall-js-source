// @ts-check
// OWN-WORK3 (2026-10-31, the owner: "removing mods from outside authors and instead replacing them with our own work"):
// THE FORAGING ITEMS, OURS. A leaf: the item law (systems/item/itemLaw.js) reads these rows on the account service.
// What is a fact keeps its value: the ids 1600-1611 (saves, quests, recipes), the group, the names every minted item
// carries, and the pictures (the seven archives the art is filed under, and Daggerfall's own five records). The rest
// is our design (bible/06-Systems/Foraging.md, OWN-WORK3): weights, durability, prices and which ones a shop shelves.

/** A tool lasts as many uses as a Standard tool the professions make (net/recipeLaw.js TOOL_LIFE) and the Skinning Knife. */
export const FORAGING_TOOL_USES = 50;
/** A shop shelves a row whose rarity is at most its quality; 100 is never. Fresh food is found, not sold. */
const SHELVED = 10,
  NEVER_SHELVED = 100;

const row = (index, name, baseWeight, hitPoints, basePrice, rarity, picture) =>
  Object.freeze({
    index,
    name,
    baseWeight,
    hitPoints,
    capacityOrTarget: 0,
    basePrice,
    enchantmentPoints: 0,
    rarity,
    variants: 0,
    drawOrderOrEffect: 0,
    isBluntWeapon: false,
    isLiquid: false,
    isOneHanded: false,
    isIngredient: false,
    worldTextureArchive: picture[0],
    worldTextureRecord: picture[1],
    playerTextureArchive: 0,
    playerTextureRecord: 0,
  });

/** The twelve rows, in DFU's ItemTemplates columns. A tool costs about what the knife does (100 gold), the iron-heavy
 *  Pick-Axe most and the wicker Basket least. The Wood Bundle weighs ten arrows' wood (fletching.js weighs a piece in
 *  arrows), and is priced as the rest's Firewood is (8 gold for 1.5 kg). */
export const FORAGING_ITEM_ROWS = Object.freeze([
  row(1600, 'Wood-Axe', 3.0, FORAGING_TOOL_USES, 90, SHELVED, [11600, 0]),
  row(1601, 'Pick-Axe', 3.5, FORAGING_TOOL_USES, 110, SHELVED, [11601, 0]),
  row(1602, 'Sickle', 1.0, FORAGING_TOOL_USES, 60, SHELVED, [11602, 0]),
  row(1603, 'Fishing-Net', 2.0, FORAGING_TOOL_USES, 70, SHELVED, [11603, 0]),
  row(1604, 'Wood Bundle', 2.5, 1, 15, SHELVED, [11604, 0]),
  row(1605, 'Fish', 0.5, 1, 6, NEVER_SHELVED, [211, 9]),
  row(1606, 'Spade', 3.0, FORAGING_TOOL_USES, 80, SHELVED, [11606, 0]),
  row(1607, 'Basket', 0.5, FORAGING_TOOL_USES, 30, SHELVED, [205, 9]),
  row(1608, 'Apple', 0.2, 1, 3, NEVER_SHELVED, [213, 1]),
  row(1609, 'Orange', 0.2, 1, 4, NEVER_SHELVED, [213, 0]),
  row(1610, 'Mushroom', 0.1, 1, 5, NEVER_SHELVED, [504, 23]),
  row(1611, 'Egg', 0.1, 1, 4, NEVER_SHELVED, [11605, 0]),
]);
