// E1 economy: shop shelf stock + cost math (DFU DaggerfallLoot.
// StockShopShelf / DaggerfallLootDataTables / FormulaHelper.
// CalculateCost, MIT Daggerfall Workshop). Node-pure; the interior
// host mounts the shelves (E2).
//
// - THE STOCK LAW (verbatim): each shop type carries (group, chance)
//   pairs; per template in a group, stock requires rarity <= shop
//   quality and a Dice100 roll under chance*5*(21-rarity)/100.
//   Books ride the quality ladder ((q+3)/5, the >=4 step-down, +1);
//   general stores always shelve a Horse and a Small Cart; clothing
//   swaps to the player's gender; Furniture/UselessItems1 skip.
// - THE COST LAW (verbatim): clamp value to >=1, apply the regional
//   price adjustment (value*adj/1000, floor 1), then
//   2*(cost*(quality-10)/100 + cost) in C# integer math.
// - Regional prices initialize Random.Range(0,501)+750 per region
//   (RandomizeInitialRegionalPrices - engine PRNG in DFU too, the
//   approved uniform-roll slot) and then DRIFT once per elapsed day
//   through UpdateRegionalPrices (S41), which the day-change block in
//   worldTick.js drives. The condition-flag half of that member
//   (PricesHigh/PricesLow) pends the region-conditions arc.
//
// - THE RESTOCK LAW (verbatim): a container carries a stockedDate
//   stamp, `(Year * 1000) + DayOfYear` (DaggerfallLoot.CreateStockedDate
//   :68-71), written by StockShopShelf (:152) and StockHouseContainer
//   (:293). Activation restocks when `stockedDate < CreateStockedDate(
//   Now)` (PlayerActivate.cs:882 for shelves, :911 for house
//   containers) - so a shop's shelf regenerates once per GAME DAY, and
//   an emptied shelf is bare until the next day rolls over.
//
// INTERIM (loud): MagicItems stock is SKIPPED (the loot MI interim);
// book items carry the template price (classic prices each BOOK FILE
// - pends the books arc).

import { dice100 } from '../combat/formulas.js';
import { rand } from '../formats/dfRandom.js';   // AUDIT 26: StockHouseContainer's continue-chance draw is DaggerfallLoot's ONE DFRandom use
import { randomMaterial, randomArmorMaterial, createWeapon } from '../combat/enemyEquipment.js';
import { groupTemplates, GROUP_TEMPLATE_INDICES, itemBaseValue, ITEM_TEMPLATES, mintCondition, rollPaintingMessage } from './itemTemplates.js';
import { isLeather, isPlate } from './armorMaterials.js';
import { CLOTHING_DYES } from '../characters/dyes.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { MINUTES_PER_DAY, dayOfYear } from './gameDate.js';   // X6: the soul-gem stock's daily seed   // the restock stamp's DayOfYear, one home
import { SOUL_TRAP_TEMPLATE } from './mysticism.js';   // X6: one home for the template id (X5 put it there with fillEmptyTrap)
import { FACTION_TYPES } from '../formats/factionFile.js';        // S41: UpdateRegionalPrices' type-7 region walk
import { findFactionByTypeAndRegion } from './talk.js';           // S41: PersistentFactionData.FindFactionByTypeAndRegion, one home
import { MERCHANTS_FACTION_ID } from './guilds.js';               // S41: FactionIDs.The_Merchants, one home
import { turnOnConditionFlag, turnOffConditionFlag, REGION_FLAGS, REGION_COUNT } from './regionConditions.js';   // S42: the store S41's flag was waiting on

// ItemGroups ids used by the shelf tables (DaggerfallUnityEnums).
const GROUP_NAMES = Object.freeze({
  0: 'Drugs', 1: 'UselessItems1', 2: 'Armor', 3: 'Weapons', 4: 'MagicItems',
  6: 'MensClothing', 7: 'Books', 8: 'Furniture', 9: 'UselessItems2',
  10: 'ReligiousItems', 11: 'Maps', 12: 'WomensClothing', 13: 'Paintings',
  14: 'Gems', 15: 'PlantIngredients1', 16: 'PlantIngredients2',
  17: 'CreatureIngredients1', 18: 'CreatureIngredients2', 19: 'CreatureIngredients3',
  20: 'MiscellaneousIngredients1', 21: 'MetalIngredients', 22: 'MiscellaneousIngredients2',
  23: 'Transportation', 25: 'Jewellery',
});

// DaggerfallLootDataTables.itemGroups* - (groupId, chance) byte pairs.
export const SHOP_ITEM_GROUPS = Object.freeze({
  [BUILDING_TYPES.Alchemist]: [0x0E, 0x1E, 0x0F, 0x32, 0x10, 0x32, 0x11, 0x1E, 0x12, 0x14, 0x13, 0x14, 0x14, 0x3C, 0x15, 0x28, 0x16, 0x1E],
  [BUILDING_TYPES.Armorer]: [0x02, 0x50, 0x03, 0x14],
  [BUILDING_TYPES.Bookseller]: [0x07, 0x28, 0x0B, 0x05],
  [BUILDING_TYPES.ClothingStore]: [0x06, 0x32, 0x0C, 0x32],
  [BUILDING_TYPES.GemStore]: [0x0E, 0x28, 0x19, 0x32],
  [BUILDING_TYPES.GeneralStore]: [0x03, 0x14, 0x06, 0x0A, 0x07, 0x0A, 0x09, 0x32, 0x17, 0x00, 0x0C, 0x0A, 0x04, 0x00],
  [BUILDING_TYPES.PawnShop]: [0x02, 0x0A, 0x03, 0x0A, 0x04, 0x0A, 0x07, 0x0A, 0x09, 0x14, 0x0D, 0x05, 0x0E, 0x0A, 0x19, 0x0A, 0x0A, 0x0A],
  [BUILDING_TYPES.WeaponSmith]: [0x02, 0x1E, 0x03, 0x46],
});

// E3: DaggerfallTradeWindow.storeBuysItemType, verbatim - the item
// groups each storefront BUYS from the player.
export const SHOP_BUYS_GROUPS = Object.freeze({
  [BUILDING_TYPES.Alchemist]: ['Gems', 'CreatureIngredients1', 'CreatureIngredients2', 'CreatureIngredients3', 'PlantIngredients1', 'PlantIngredients2', 'MiscellaneousIngredients1', 'MiscellaneousIngredients2', 'MetalIngredients'],
  [BUILDING_TYPES.Armorer]: ['Armor', 'Weapons'],
  [BUILDING_TYPES.Bookseller]: ['Books'],
  [BUILDING_TYPES.ClothingStore]: ['MensClothing', 'WomensClothing'],
  [BUILDING_TYPES.FurnitureStore]: ['Furniture'],
  [BUILDING_TYPES.GemStore]: ['Gems', 'Jewellery'],
  [BUILDING_TYPES.GeneralStore]: ['Books', 'MensClothing', 'WomensClothing', 'Transportation', 'Jewellery', 'Weapons', 'UselessItems2'],
  [BUILDING_TYPES.PawnShop]: ['Armor', 'Books', 'MensClothing', 'WomensClothing', 'Gems', 'Jewellery', 'ReligiousItems', 'Weapons', 'UselessItems2', 'Paintings'],
  [BUILDING_TYPES.WeaponSmith]: ['Armor', 'Weapons'],
});
export const shopBuysItem = (buildingType, item) => (SHOP_BUYS_GROUPS[buildingType] ?? []).includes(item.group);

/** RMBLayout.IsShop, verbatim (the nine stocked storefronts). */
export function isShop(buildingType) {
  return buildingType === BUILDING_TYPES.Alchemist || buildingType === BUILDING_TYPES.Armorer
    || buildingType === BUILDING_TYPES.Bookseller || buildingType === BUILDING_TYPES.ClothingStore
    || buildingType === BUILDING_TYPES.FurnitureStore || buildingType === BUILDING_TYPES.GemStore
    || buildingType === BUILDING_TYPES.GeneralStore || buildingType === BUILDING_TYPES.PawnShop
    || buildingType === BUILDING_TYPES.WeaponSmith;
}

/** RMBLayout.IsRepairShop (:787-797). The three shops that will mend
 *  your gear; PlayerActivate routes their merchant to the repair
 *  popup instead of the sell one. */
export function isRepairShop(buildingType) {
  return buildingType === BUILDING_TYPES.Armorer
    || buildingType === BUILDING_TYPES.GeneralStore
    || buildingType === BUILDING_TYPES.WeaponSmith;
}

// DaggerfallInterior: interior models 41000+i with i in this set are
// shop shelves (loot containers when the building IsShop).
export const CONTAINER_MODEL_OFFSET = 41000;
export const SHOP_SHELF_MODEL_INDICES = Object.freeze(new Set([5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 26, 28, 29, 31, 35, 36, 37, 40, 41, 42, 44, 46, 47, 48, 49, 808]));
export const isShopShelfModel = (modelId) => SHOP_SHELF_MODEL_INDICES.has(modelId - CONTAINER_MODEL_OFFSET);

export const TRANSPORT_HORSE = 94;        // Transportation.Horse (template)
export const TRANSPORT_SMALL_CART = 93;   // Transportation.Small_cart
// AUDIT 24 (wave 24): Books.Book0..Book3 all resolve to 277 - one
// constant, declared here and in loot.js.
import { BOOK_TEMPLATE, createRandomBook, createRandomWeapon, createRandomArmor, createRandomClothing, createRegularMagicItem, createRandomPotion, randomlyAddPotionRecipe } from './loot.js';   // G4: the guild shelves' two minters   // AUDIT 26: StockHouseContainer's five ItemBuilder minters
import { SPELLBOOK_TEMPLATE_INDEX } from './spellMaker.js';   // G4: one home for MiscItems 132

export { BOOK_TEMPLATE };

/** ItemBuilder.RandomizeArmorVariant (:813-844) - the branch
 *  ApplyArmorSettings takes when CreateArmor is called with its
 *  DEFAULT variant of -1, which is exactly how DaggerfallLoot.cs:228
 *  stocks a shop shelf. (CreateRandomArmor, the LOOT path, passes
 *  ApplyArmorSettings' default 0 and takes SetVariant instead - so
 *  loot armor is variant 0 and must NOT take this roll.)
 *
 *  The picked value then goes through SetVariant, whose material
 *  clamps live in armorMaterials.clampArmorVariant and which the port
 *  applies at DRAW time; every range below is already inside the
 *  template's variant count, so SetVariant's out-of-range early-out
 *  can never fire here. */
export function randomizeArmorVariant(templateIndex, material, rolls = Math.random) {
  const range = (lo, hi) => lo + Math.floor(rolls() * (hi - lo));   // UnityEngine.Random.Range(int, int)
  if (templateIndex === 102 && isPlate(material)) return range(1, 4);                    // Cuirass
  if (templateIndex === 104) {                                                           // Greaves
    if (isLeather(material)) return range(0, 2);
    if (isPlate(material)) return range(2, 6);
    return 0;
  }
  if ((templateIndex === 105 || templateIndex === 106) && isPlate(material)) return range(1, 4);   // Pauldrons
  if (templateIndex === 108 && isPlate(material)) return range(1, 3);                    // Boots
  if (templateIndex === 107) return range(0, ITEM_TEMPLATES[107]?.variants ?? 0);        // Helm
  return 0;
}

/** One stocked item, finished the way DaggerfallUnityItem's own
 *  constructor finishes it: the TEMPLATE's name for every plain item
 *  (only magic items and weapons carry their own) - AUDIT 18 found the
 *  shelf minting rows with none, so the item list labelled a bought Oil
 *  "UselessItems2" - the template base value (AUDIT 23 items-5), and
 *  mintCondition's hit points.
 *
 *  SetItem's other draw (DaggerfallUnityItem.cs:571) rides here too: a
 *  Paintings item is born with its message, and both the pawn shop's
 *  shelf (group 13 on the PawnShop pair table) and a private house
 *  container (0x0D on four of the five private-property tables) can
 *  mint one. Minted with none, every painting seeds InitPaintingInfo
 *  from 0 and they are all the same picture.
 *
 *  ONE home for the two stock arms (AUDIT 26): a second copy is how a
 *  cupboard's painting ends up nameless while a shelf's is not. */
function stockedItem(item, rolls) {
  const it = mintCondition({ ...item, name: item.name ?? ITEM_TEMPLATES[item.templateIndex]?.name, value: item.value ?? itemBaseValue(item) });
  if (it.group === 'Paintings' && it.message == null) it.message = rollPaintingMessage(rolls);
  return it;
}

/** StockShopShelf, verbatim. Returns the item list; every item
 *  carries value = its DaggerfallUnityItem base value. */
export function stockShopShelf({ buildingType, quality }, playerEntity = {}, { rolls = Math.random } = {}) {
  const items = [];
  // DaggerfallUnityItem.ItemName is the TEMPLATE's name for every
  // plain item; AUDIT 18: the shelf minted rows with none, so the
  // dungeon-style item list labelled a bought Oil "UselessItems2".
  const add = (item) => { items.push(stockedItem(item, rolls)); };
  const pairs = SHOP_ITEM_GROUPS[buildingType] ?? [0];
  if (buildingType === BUILDING_TYPES.Alchemist) {
    // DaggerfallLoot.cs:163-166 - the Alchemist arm alone rolls a
    // recipe onto the shelf, before the group loop and at 25%. This is
    // the only place in the game a recipe can be BOUGHT (the enemy and
    // pile arms roll 2%). loot.js owns the roll and the twenty-key
    // pick; the shelf's own finishing - the template name and base
    // value AUDIT 18 found missing - is stockedItem's, so the recipe
    // lands through the same door as every other stocked row.
    const recipes = [];
    randomlyAddPotionRecipe(25, recipes, rolls);
    for (const r of recipes) add(r);
  }
  if (buildingType === BUILDING_TYPES.GeneralStore) {
    add({ group: 'Transportation', templateIndex: TRANSPORT_HORSE });
    add({ group: 'Transportation', templateIndex: TRANSPORT_SMALL_CART });
  }
  const level = playerEntity.level ?? 1;
  const female = playerEntity.gender === 'female';
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    let group = GROUP_NAMES[pairs[i]];
    const chanceMod = pairs[i + 1];
    if (!group) continue;   // Maps/etc. groups outside the stocked set resolve to nothing
    if (group === 'MensClothing' && female) group = 'WomensClothing';
    if (group === 'WomensClothing' && !female) group = 'MensClothing';
    if (group === 'Furniture' || group === 'UselessItems1') continue;
    if (group === 'MagicItems') continue;   // INTERIM loud (the loot MI interim)
    if (group === 'Books') {
      let qualityMod = Math.trunc((quality + 3) / 5);
      if (qualityMod >= 4) --qualityMod;
      qualityMod++;
      for (let j = 0; j <= qualityMod; ++j) {
        // CreateRandomBook: Range(0, book.TotalVariants) = the
        // template's variant count (2), NOT the 4 Books enum names.
        // ONE home for that member since AUDIT 26 (StockHouseContainer
        // below is its second caller): loot.createRandomBook.
        add(createRandomBook(rolls));   // B1: message = the book id (CreateRandomBook); book-file pricing pends (loud)
      }
      continue;
    }
    const metas = groupTemplates(group);
    for (let j = 0; j < metas.length; ++j) {
      const t = metas[j];
      if (t.rarity > quality) continue;
      const stockChance = Math.trunc(chanceMod * 5 * (21 - t.rarity) / 100);
      if (!dice100(stockChance, rolls())) continue;
      if (group === 'Weapons') {
        const templateIndex = GROUP_TEMPLATE_INDICES.Weapons[j];
        if (templateIndex === 131) add({ group: 'Weapons', name: 'Arrow', templateIndex, material: 0, stackCount: 1 + Math.floor(rolls() * 20) });   // AUDIT 17e F14: CreateWeapon's arrow branch takes NO material roll and DFU stocks a real stack (loot.js already had this right)
        else add({ group: 'Weapons', ...createWeapon(templateIndex, randomMaterial(level, rolls)) });
      } else if (group === 'Armor') {
        // CreateArmor(gender, race, piece, RandomArmorMaterial(level))
        // - the material roll, THEN RandomizeArmorVariant's roll.
        const templateIndex = GROUP_TEMPLATE_INDICES.Armor[j];
        const material = randomArmorMaterial(level, rolls);
        add({ group: 'Armor', templateIndex, material, variant: randomizeArmorVariant(templateIndex, material, rolls) });
      } else if (group === 'MensClothing' || group === 'WomensClothing') {
        // CreateMensClothing/CreateWomensClothing roll the VARIANT
        // over the template's own count (Range(0, variants)); the
        // shelf then assigns RandomClothingDye - variant roll first,
        // dye roll second (the reverse of loot's CreateRandomClothing).
        const templateIndex = GROUP_TEMPLATE_INDICES[group][j];
        const variant = Math.floor(rolls() * (ITEM_TEMPLATES[templateIndex]?.variants ?? 0));
        add({ group, templateIndex, variant, dye: CLOTHING_DYES[Math.floor(rolls() * CLOTHING_DYES.length)] });
      } else {
        add({ group, templateIndex: GROUP_TEMPLATE_INDICES[group][j] });
      }
    }
  }
  return items;
}

/** RandomizeInitialRegionalPrices: 750..1250 per region, lazily. */
export function regionPriceAdjustment(playerEntity, regionIndex, rolls = Math.random) {
  playerEntity.regionPrices ??= {};
  playerEntity.regionPrices[regionIndex] ??= 750 + Math.floor(rolls() * 501);
  return playerEntity.regionPrices[regionIndex];
}

// ONE DFU MEMBER, ONE EXPORT: REGION_COUNT is PlayerEntity.regionData's
// length (:99), so S42 took it into regionConditions.js beside the rest
// of that record. S41 declared it here first and the two collided; the
// re-export keeps this file's readers working off the one home.
export { REGION_COUNT } from './regionConditions.js';

/** Mathf.Clamp(PriceAdjustment, 250, 4000) (FormulaHelper.cs:2074). */
export const PRICE_ADJUSTMENT_MIN = 250;
export const PRICE_ADJUSTMENT_MAX = 4000;

/**
 * S41 - FormulaHelper.UpdateRegionalPrices (:2053-2089), THE DAILY
 * DRIFT, which the port did not have at all.
 *
 * Every price in the game runs through calculateCost's
 * ApplyRegionalPriceAdjustment term, and the port set that term ONCE
 * per region - RandomizeInitialRegionalPrices' 750..1250 - and then
 * never moved it again. A region that rolled 780 at boot sold at 78%
 * for the rest of the character's life, and one that rolled 1240 at
 * 124%; no amount of play could change either, and the merchants'
 * faction power - the whole point of the formula - had no consumer.
 * This file's own header carried an open flag against the drift,
 * pending the calendar; the calendar exists now, so it ships and
 * the flag is retired.
 *
 * The walk, verbatim: bail entirely if The Merchants is missing from
 * the dictionary; else for each region that HAS a Province (type 7)
 * faction, run `times` independent steps of
 *
 *     chance = (merchantsPower - regionPower) / 5
 *              + 50 - (adjustment - 1000) / 25
 *
 * and move the adjustment to 49/50ths of itself on a FAILED roll or
 * 51/50ths on a passed one, then clamp to [250, 4000]. Both divisions
 * can go negative (powers are 1..100 either way round; the adjustment
 * runs 250..4000 against a 1000 pivot) so both are Math.trunc, C#'s
 * truncate-toward-zero, not Math.floor.
 *
 * Note the sign: a HIGH adjustment lowers `chance`, so a passed roll
 * - the 51/50 RISE - gets rarer as prices climb. It is a mean-
 * reverting walk around 1000 that the merchants' power tilts.
 *
 * THE CONDITION-FLAG HALF SHIPS (:2075-2087). S41 had to flag this
 * because the port had no RegionDataFlags store to write into; S42
 * built one (systems/regionConditions.js), so the three arms land
 * here now, in DFU's own shape: at or under 2000 and at or over 500
 * turns BOTH flags off, under 500 turns PricesLow on, and over 2000
 * turns PricesHigh on. Note the asymmetry DFU has and this keeps -
 * the "normal" band clears both flags every single step, while the
 * two extremes only ever turn their own on.
 *
 * The flags are written through turnOnConditionFlag, which DRAWS a
 * roll of its own for the condition's duration, so a region sitting
 * at an extreme consumes one extra draw per day. That is DFU's
 * stream, not an addition: the same call does the same thing there.
 *
 * DEVIATION (recorded): DFU fills all 62 adjustments at game start,
 * so this walk draws no init rolls. The port's regionPriceAdjustment
 * is lazy, so the first drift of a session materialises whatever the
 * shops have not touched yet, and each of those draws one roll here
 * where DFU drew it at StartGameBehaviour. Same distribution, a
 * different position in the stream.
 *
 * @param {object} playerEntity  carries regionPrices
 * @param {Map}    factionDict   the live faction store's dict
 * @param {number} times         daysPast - DFU's own loop bound
 * @param {object[]} conditions   the region-condition store (S42). Null
 *        skips the flag half - the price walk itself is unchanged.
 */
export function updateRegionalPrices(playerEntity, factionDict, times, rolls = Math.random, conditions = null) {
  if (!factionDict || !(times > 0)) return;
  // GetFactionData(The_Merchants) - `if (!...) return`, so a missing
  // merchants faction stops the WHOLE walk, not just one region.
  const merchants = factionDict.get(MERCHANTS_FACTION_ID);
  if (!merchants) return;
  for (let i = 0; i < REGION_COUNT; i++) {
    const regionFaction = findFactionByTypeAndRegion(factionDict, FACTION_TYPES.Province, i);
    if (!regionFaction) continue;
    for (let j = 0; j < times; j++) {
      const adj = regionPriceAdjustment(playerEntity, i, rolls);
      const chanceOfPriceRise = Math.trunc((merchants.power - regionFaction.power) / 5)
        + 50 - Math.trunc((adj - 1000) / 25);
      // Dice100.FailedRoll(chance) is !SuccessRoll(chance), and
      // dice100() here IS SuccessRoll - one roll drawn either way,
      // which is why the negation is on the RESULT and not a second
      // draw.
      const next = dice100(chanceOfPriceRise, rolls())
        ? Math.trunc(51 * adj / 50)
        : Math.trunc(49 * adj / 50);
      const adjusted = Math.min(PRICE_ADJUSTMENT_MAX, Math.max(PRICE_ADJUSTMENT_MIN, next));
      playerEntity.regionPrices[i] = adjusted;
      // :2075-2087, verbatim including the nesting.
      if (!conditions) continue;
      if (adjusted <= 2000) {
        if (adjusted >= 500) {
          turnOffConditionFlag(conditions, i, REGION_FLAGS.PricesHigh);
          turnOffConditionFlag(conditions, i, REGION_FLAGS.PricesLow);
        } else {
          turnOnConditionFlag(conditions, i, REGION_FLAGS.PricesLow, rolls);
        }
      } else {
        turnOnConditionFlag(conditions, i, REGION_FLAGS.PricesHigh, rolls);
      }
    }
  }
}

/** FormulaHelper.CalculateCost, verbatim C# integer math. */
export function calculateCost(baseValue, shopQuality, priceAdjustment = 1000) {
  let cost = baseValue;
  if (cost < 1) cost = 1;
  cost = Math.trunc(cost * priceAdjustment / 1000);   // ApplyRegionalPriceAdjustment
  if (cost < 1) cost = 1;
  cost = 2 * (Math.trunc(cost * (shopQuality - 10) / 100) + cost);
  return cost;
}

/** FormulaHelper.CalculateTradePrice, verbatim - the classic
 *  fixed-point haggle over the merchant's quality-derived levels vs
 *  the player's Mercantile + Personality. selling=false is the BUY
 *  price of a shelf item (applied over CalculateCost's cost). */
export function calculateTradePrice(cost, shopQuality, { mercantile = 0, personality = 50 } = {}, selling = false) {
  const merchantLevel = 5 * (shopQuality - 10) + 50;   // mercantile and personality alike
  let dm, dp;
  if (selling) {
    dm = ((Math.trunc(((100 - merchantLevel) << 8) / 200) + 128) * (Math.trunc((mercantile << 8) / 200) + 128)) >> 8;
    dp = ((Math.trunc(((100 - merchantLevel) << 8) / 200) + 128) * (Math.trunc((personality << 8) / 200) + 128)) >> 8;
    return ((((179 * dm) >> 8) + ((51 * dp) >> 8)) * cost) >> 8;
  }
  dm = ((Math.trunc((merchantLevel << 8) / 200) + 128) * (Math.trunc(((100 - mercantile) << 8) / 200) + 128)) >> 8;
  dp = (((Math.trunc((merchantLevel << 8) / 200) + 128) * (Math.trunc(((100 - personality) << 8) / 200) + 128)) >> 8) << 6;
  return ((((192 * dm) >> 8) + (dp >> 8)) * cost) >> 8;
}


// ── X6: THE SOUL GEM STOCK (the Mages Guild's Buy Soulgems service) ──
//
// X5 made Soul Trap fire, and then could not be reached in play: no
// code path in the port MINTED a soul trap item, so there was never
// an empty gem for a caught soul to enter. DFU has exactly three
// minting sites for MiscItems.Soul_trap, and only one of them is a
// way for the player to ACQUIRE one - the guild service stock
// (DaggerfallGuildServicePopupWindow.cs:247-266). The other two are
// SoulBound's own reads. So this is that stock.
//
// GetMerchantMagicItems(onlySoulGems: true) (:221-268), verbatim:
//   - numOfItems = trunc(quality / 2) + 1;
//   - the loop is `for (i = 0; i <= numOfItems; i++)` - INCLUSIVE, so
//     it mints numOfItems + 1 gems, not numOfItems. stockShopShelf
//     above already honours the same off-by-one in its own quality
//     ladder, so the port has the precedent;
//   - each gem: Dice100.FailedRoll(25) -> an EMPTY trap worth a flat
//     5000; otherwise a randomly filled one. FailedRoll(25) is
//     `Random.Range(0,100) >= 25`, i.e. TRUE three times in four - so
//     the stock is 75% EMPTY gems and only 25% filled, which reads
//     backwards until you notice an empty gem is the useful one for a
//     Soul Trap caster.
//
// THE DAILY SEED. DFU calls Random.InitState with
// ToClassicDaggerfallTime() / MinutesPerDay - the day number - so the
// stock is deterministic and rotates every 24 game hours, and the
// window can be reopened without re-rolling. DFU's own comment admits
// this is a stand-in: "Doesn't match classic exactly as classic
// stocking method unknown, but should be good enough for now". The
// port injects `rolls` rather than seeding a global stream, so
// dailyStockRolls below is the equivalent - xorshift32 over the day,
// the same substitution dungeonEnemies.makeSlotRng already makes for
// Unity's seeded stream (a recorded Ledger A departure).

/** A deterministic [0,1) stream for one game day. */
export function dailyStockRolls(dayIndex) {
  let s = ((dayIndex >>> 0) || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/** The classic day number DFU seeds from: whole days of game time. */
export const stockDayIndex = (gameMinutes) => Math.floor((gameMinutes ?? 0) / MINUTES_PER_DAY);

/** DaggerfallLoot.CreateStockedDate (:68-71), verbatim:
 *  `(date.Year * 1000) + date.DayOfYear`. One packed integer per game
 *  day, which is what makes the restock test a plain `<`. */
export const createStockedDate = (date) => (date.year * 1000) + dayOfYear(date);

/** The restock condition PlayerActivate writes inline at both of its
 *  container arms - `loot.stockedDate < DaggerfallLoot.CreateStockedDate(
 *  DaggerfallUnity.Instance.WorldTime.Now)` (PlayerActivate.cs:882 for
 *  ShopShelves, :911 for HouseContainers). A never-stocked container
 *  carries 0 (DaggerfallLoot.cs:45) and so always stocks on first
 *  access; after that the stamp holds until the day of year moves on.
 *  ONE home for both arms, because two copies of a `<` is how a shelf
 *  and a cupboard end up restocking on different schedules. */
export const needsRestock = (stockedDate, date) => (stockedDate ?? 0) < createStockedDate(date);

/** The ShopShelves arm of PlayerActivate.ActivateLootContainer
 *  (:879-886), whole:
 *
 *      if (loot.stockedDate < DaggerfallLoot.CreateStockedDate(Now))
 *          loot.StockShopShelf(playerEnterExit.BuildingDiscoveryData);
 *
 *  with StockShopShelf's own first two lines (DaggerfallLoot.cs:152-153)
 *  - stamp the date, CLEAR the collection - folded in, because they are
 *  what makes this a RESTOCK rather than a top-up: yesterday's leftovers
 *  do not survive into today's shelf, and an emptied shelf comes back
 *  full when the day rolls over.
 *
 *  It lives here rather than in the interior host so the host has one
 *  call and this law has one home; the host owns only the shelf object
 *  and the clock it reads `date` off.
 *
 *  A non-shop building answers an EMPTY shelf and still takes the
 *  stamp - DFU never reaches this arm for one (the shelf models only
 *  mount in shops), and stamping keeps a sold-into collection from
 *  being re-cleared on every activation. */
export function restockShopShelfIfDue(shelf, { buildingType, quality }, date, playerEntity = {}, { rolls = Math.random } = {}) {
  if (!needsRestock(shelf.stockedDate ?? 0, date)) return false;
  shelf.stockedDate = createStockedDate(date);
  shelf.items = isShop(buildingType)
    ? stockShopShelf({ buildingType, quality }, playerEntity, { rolls })
    : [];
  return true;
}

// ---------------------------------------------------------------------
// S2b: THE PRIVATE PROPERTY TABLES + StockHouseContainer.
// DaggerfallLootDataTables.privatePropertyItems* - five (groupId) byte
// rows per DFLocation.BuildingTypes, 24 rows each (Alchemist 0 ..
// Town23 23), picked by the container model's TextureRecord band.
// ---------------------------------------------------------------------

export const PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1 = Object.freeze([
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x02, 0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x02, 0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x02, 0x06, 0x0C]),
  Object.freeze([0x02, 0x06, 0x0C]),
  Object.freeze([0x02, 0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x02, 0x06, 0x0C]),
  Object.freeze([0x02, 0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
  Object.freeze([0x06, 0x0C]),
]);

export const PRIVATE_PROPERTY_ITEMS_MODELS_2_TO_3 = Object.freeze([
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x03, 0x06, 0x09, 0x0C]),
  Object.freeze([0x07, 0x09, 0x0B]),
  Object.freeze([0x09, 0x0A, 0x0B, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x19]),
  Object.freeze([0x07, 0x09, 0x0B]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x09, 0x0B, 0x0E, 0x19]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09, 0x0B]),
  Object.freeze([0x03, 0x09, 0x0A, 0x0B]),
  Object.freeze([0x03, 0x09, 0x0B]),
  Object.freeze([0x03, 0x09]),
  Object.freeze([0x07, 0x09, 0x0A, 0x0B, 0x0E]),
  Object.freeze([0x03, 0x09, 0x0A]),
  Object.freeze([0x03, 0x09, 0x0A, 0x0B, 0x19]),
  Object.freeze([0x03, 0x09, 0x0A, 0x0B]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
]);

export const PRIVATE_PROPERTY_ITEMS_MODELS_4_TO_10 = Object.freeze([
  Object.freeze([0x07, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x15]),
  Object.freeze([0x09, 0x15]),
  Object.freeze([0x09, 0x15]),
  Object.freeze([0x07, 0x19]),
  Object.freeze([0x09, 0x0A, 0x0B, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14]),
  Object.freeze([0x07, 0x09, 0x0A, 0x0B]),
  Object.freeze([0x06, 0x09, 0x0A, 0x0C, 0x0F, 0x10]),
  Object.freeze([0x09]),
  Object.freeze([0x07, 0x09, 0x0A, 0x15]),
  Object.freeze([0x09]),
  Object.freeze([0x09, 0x0D]),
  Object.freeze([0x09, 0x0A, 0x0D]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09, 0x0A, 0x15]),
  Object.freeze([0x04, 0x09, 0x0A, 0x14]),
  Object.freeze([0x09, 0x0F, 0x10]),
  Object.freeze([0x07, 0x09, 0x0D, 0x14]),
  Object.freeze([0x07, 0x09, 0x0D, 0x14]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09, 0x0A]),
]);

export const PRIVATE_PROPERTY_ITEMS_MODELS_11_TO_14 = Object.freeze([
  Object.freeze([0x07, 0x09, 0x14]),
  Object.freeze([0x07, 0x09, 0x14]),
  Object.freeze([0x03, 0x06, 0x09, 0x0C]),
  Object.freeze([0x09, 0x0D, 0x0E]),
  Object.freeze([0x02, 0x03, 0x09]),
  Object.freeze([0x07, 0x09]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x09]),
  Object.freeze([0x03, 0x09, 0x15, 0x0E]),
  Object.freeze([0x09, 0x0A]),
  Object.freeze([0x09]),
  Object.freeze([0x09, 0x03, 0x0E]),
  Object.freeze([0x09, 0x0D, 0x19]),
  Object.freeze([0x03, 0x09, 0x0A, 0x15]),
  Object.freeze([0x07, 0x09, 0x0A]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x04, 0x07, 0x09, 0x0D, 0x19]),
  Object.freeze([0x07, 0x09, 0x0D, 0x19]),
  Object.freeze([0x03, 0x09]),
  Object.freeze([0x03, 0x09]),
  Object.freeze([0x03, 0x09]),
  Object.freeze([0x03, 0x09]),
  Object.freeze([0x03, 0x09]),
  Object.freeze([0x03, 0x09]),
]);

export const PRIVATE_PROPERTY_ITEMS_MODELS_15_AND_UP = Object.freeze([
  Object.freeze([0x0F, 0x10, 0x11, 0x12, 0x13, 0x15]),
  Object.freeze([0x02, 0x15]),
  Object.freeze([0x02, 0x15]),
  Object.freeze([0x0D, 0x19]),
  Object.freeze([0x02, 0x03, 0x04, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x15]),
  Object.freeze([0x07, 0x0D]),
  Object.freeze([0x06, 0x09, 0x0C, 0x0F, 0x10]),
  Object.freeze([0x09, 0x0D]),
  Object.freeze([0x09, 0x15]),
  Object.freeze([0x09]),
  Object.freeze([0x09, 0x0D]),
  Object.freeze([0x02, 0x09, 0x0D]),
  Object.freeze([0x02, 0x03, 0x09]),
  Object.freeze([0x03, 0x09, 0x15]),
  Object.freeze([0x09, 0x0A, 0x0D]),
  Object.freeze([0x09, 0x0F, 0x10]),
  Object.freeze([0x09, 0x0D, 0x19]),
  Object.freeze([0x09, 0x0D, 0x19]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
  Object.freeze([0x06, 0x09, 0x0C]),
]);

/** The band ladder of StockHouseContainer (DaggerfallLoot.cs:303-334),
 *  verbatim, including its `<= Town23` gate: a Ship, a Special or any
 *  of DaggerfallUnity's own wildcards has no private-property row at
 *  all and stocks nothing. `modelIndex` is the container's
 *  TextureRecord, which is `modelId % 100` (systems/containers.js). */
export function privatePropertyItemList(buildingType, modelIndex) {
  if (!(buildingType <= BUILDING_TYPES.Town23)) return null;
  let table;
  if (modelIndex >= 2) {
    if (modelIndex >= 4) {
      if (modelIndex >= 11) {
        table = modelIndex >= 15
          ? PRIVATE_PROPERTY_ITEMS_MODELS_15_AND_UP
          : PRIVATE_PROPERTY_ITEMS_MODELS_11_TO_14;
      } else table = PRIVATE_PROPERTY_ITEMS_MODELS_4_TO_10;
    } else table = PRIVATE_PROPERTY_ITEMS_MODELS_2_TO_3;
  } else table = PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1;
  return table[buildingType] ?? null;
}

/** StockHouseContainer (DaggerfallLoot.cs:291-375), verbatim.
 *
 *  ONE group is drawn for the whole container - Range(0, list.Length)
 *  over that row - and then items of that group are minted in a loop
 *  whose HALVING continue chance is DaggerfallLoot's only DFRandom
 *  draw:
 *
 *      continueChance >>= 1;
 *      if (DFRandom.rand() % 100 > continueChance) keepGoing = false;
 *      items.AddItem(item);
 *
 *  The add comes AFTER the test, so a container is never empty: the
 *  first item is always minted, then 50% for a second, 25% for a third,
 *  and so on. `rolls` is the engine PRNG (Random.Range) and `dfRand` is
 *  the classic LCG - two different streams, as in DFU.
 *
 *  Note what this does NOT do that the shop shelf does: no gender swap
 *  on the clothing groups. Both 0x06 and 0x0C route to
 *  CreateRandomClothing, which picks the group off the PLAYER's gender
 *  (ItemBuilder.cs:184-208), so the row's men/women split has no effect
 *  here at all.
 *
 *  FLAGGED: the MagicItems arm (0x04, on three of the five tables)
 *  needs MAGIC.DEF - `magicItemTemplates` - and mints nothing without
 *  it, the same interim the shop shelf's MagicItems arm carries. */
export function stockHouseContainer({ buildingType, textureRecord } = {}, playerEntity = {},
  { rolls = Math.random, dfRand = rand, magicItemTemplates = null } = {}) {
  const items = [];
  const list = privatePropertyItemList(buildingType, textureRecord >>> 0);
  if (!list) return items;
  const group = GROUP_NAMES[list[Math.floor(rolls() * list.length)]];
  const level = playerEntity.level ?? 1;
  const gender = playerEntity.gender ?? 'male';
  let continueChance = 100;
  let keepGoing = true;
  while (keepGoing) {
    let item = null;
    if (group !== 'MensClothing' && group !== 'WomensClothing') {
      if (group === 'MagicItems') {
        item = magicItemTemplates ? createRegularMagicItem(magicItemTemplates, level, gender, rolls) : null;
      } else if (group === 'Books') {
        item = createRandomBook(rolls);
      } else if (group === 'Weapons') {
        item = createRandomWeapon(level, rolls);
      } else if (group === 'Armor') {
        item = createRandomArmor(level, rolls);
      } else {
        // `new DaggerfallUnityItem(itemGroup, Random.Range(0,
        // enumArray.Length))` - a uniform pick over the GROUP's enum,
        // which is exactly GROUP_TEMPLATE_INDICES' row.
        const indices = GROUP_TEMPLATE_INDICES[group] ?? [];
        if (indices.length) item = { group, templateIndex: indices[Math.floor(rolls() * indices.length)] };
      }
    } else {
      item = createRandomClothing(gender, rolls);
    }
    continueChance >>= 1;
    if (dfRand() % 100 > continueChance) keepGoing = false;
    if (item) items.push(stockedItem(item, rolls));
  }
  return items;
}

/** The HouseContainers arm of PlayerActivate.ActivateLootContainer
 *  (:900-923), the restock half - the same shape restockShopShelfIfDue
 *  gives the ShopShelves arm, over the same `needsRestock` law:
 *
 *      if (loot.stockedDate < DaggerfallLoot.CreateStockedDate(Now))
 *          loot.StockHouseContainer(BuildingDiscoveryData);
 *
 *  with StockHouseContainer's own first two lines (:293-294) - stamp
 *  the date, CLEAR the collection - folded in.
 *
 *  `playerOwned` is the arm ABOVE it (:903-908): a house the player has
 *  bought (or their own ship) sets `stockedDate = 1` and BREAKS without
 *  stocking, which is what makes an owned house's furniture the
 *  player's own storage instead of a fresh pile of someone else's
 *  clothes every game day. */
export function restockHouseContainerIfDue(container, { buildingType, playerOwned = false } = {},
  date, playerEntity = {}, opts = {}) {
  if (playerOwned) { container.stockedDate = 1; return false; }
  if (!needsRestock(container.stockedDate ?? 0, date)) return false;
  container.stockedDate = createStockedDate(date);
  container.items = stockHouseContainer(
    { buildingType, textureRecord: container.record ?? 0 }, playerEntity, opts);
  return true;
}

/** ItemBuilder.CreateRandomlyFilledSoulTrap (:285-306).
 *
 *  The soul is drawn from Range(Rat, Lamia + 1) - the WHOLE monster
 *  range, 0..42 inclusive - and re-drawn while it lands on one of two
 *  excluded ids. DFU's note explains the pair: Horse_Invalid (39) is
 *  an unused career with no texture, and Dragonling (34) "is soulless,
 *  only soul of Dragonling_Alternate (40) from B0B70Y16 has a soul".
 *
 *  Note what is NOT excluded: the nine other creatures whose SoulPts
 *  are zero (Rat, Giant Bat, Grizzly Bear, Sabertooth, Spider,
 *  Slaughterfish, Skeletal Warrior, Zombie, Giant Scorpion) are all
 *  fair draws, and a trap filled with one of them is worth 5000 +
 *  0 - exactly what an EMPTY trap is worth. That is DFU behaviour,
 *  not an oversight here. */
export const SOUL_TRAP_BASE_VALUE = 5000;
const SOULLESS_DRAWS = new Set([34, 39]);   // Dragonling, Horse_Invalid

export function createRandomlyFilledSoulTrap(rolls = Math.random, soulPointsOf = null) {
  let soul = -1;
  // Range(Rat, Lamia + 1) = 0..42 inclusive, redrawn on the two vetoes.
  // Bounded rather than `while (true)`: 41 of 43 draws are valid, so a
  // stream that somehow never yields one is a broken stream, not a
  // reason to hang the frame.
  for (let i = 0; i < 64 && soul < 0; i++) {
    const draw = Math.floor(rolls() * 43);
    if (!SOULLESS_DRAWS.has(draw)) soul = draw;
  }
  if (soul < 0) soul = 0;   // Rat: the first valid draw, so a dead stream still mints a legal gem
  const pts = soulPointsOf ? (soulPointsOf(soul) ?? 0) : 0;
  return mintCondition({
    group: 'MiscItems',
    templateIndex: SOUL_TRAP_TEMPLATE,
    trappedSoulType: soul,
    value: SOUL_TRAP_BASE_VALUE + pts,
  });
}

/** An EMPTY trap as the service stocks it - a FLAT 5000, written onto
 *  the item rather than left to the template's own 500 basePrice
 *  (:255-257 sets value explicitly). */
export function createEmptySoulTrap() {
  return mintCondition({
    group: 'MiscItems',
    templateIndex: SOUL_TRAP_TEMPLATE,
    trappedSoulType: null,
    value: SOUL_TRAP_BASE_VALUE,
  });
}

/**
 * GetMerchantMagicItems (DaggerfallGuildServicePopupWindow:221-271) -
 * ONE function serving TWO services, which is why they share a shelf
 * size and a seed and why this is not two functions here either.
 *
 *   numOfItems = trunc(quality / 2) + 1, and both loops are
 *   `i <= numOfItems` - INCLUSIVE, so each carries numOfItems + 1.
 *
 *   The seed is the DAY (classic minutes / minutes-per-day), so the
 *   shelf is stable for twenty-four game hours and rotates after -
 *   DFU's own note says classic's stocking method is unknown and this
 *   is "good enough".
 *
 * THE MAGIC ARM RUNS FIRST AND CONSUMES DRAWS, so a guild that offers
 * BOTH services shows DIFFERENT soul gems on its Buy Magic Items
 * shelf than on its Buy Soulgems shelf, on the same day, from the
 * same seed. That is the single random sequence being walked to two
 * different depths, and it is observable.
 *
 * ...and the soul-gem arm runs whether or not `onlySoulGems` was
 * asked for: a guild that sells gems sells them ON the magic shelf
 * too, with a SPELLBOOK between the two runs.
 */
export function stockGuildMagicItems({ quality = 0, gameMinutes = 0, sellsSoulGems = false, onlySoulGems = false } = {},
  { magicItemTemplates = null, playerLevel = 1, gender = 0, soulPointsOf = null } = {}) {
  const rolls = dailyStockRolls(stockDayIndex(gameMinutes));
  const numOfItems = Math.trunc(quality / 2) + 1;
  const out = [];
  if (!onlySoulGems) {
    for (let i = 0; i <= numOfItems; i++) {   // INCLUSIVE
      // A shop's magic item arrives ALREADY IDENTIFIED (:242), which
      // is why the Identify service never has anything to do with the
      // stock of the guild that sells it.
      if (!magicItemTemplates) break;
      const it = createRegularMagicItem(magicItemTemplates, playerLevel, gender, rolls);
      it.isIdentified = true;
      out.push(it);
    }
    out.push(mintCondition({ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }));
  }
  if (sellsSoulGems) {
    for (let i = 0; i <= numOfItems; i++) {   // INCLUSIVE - numOfItems + 1 gems
      // Dice100.FailedRoll(25): Random.Range(0,100) >= 25, true 75% of
      // the time, and the true branch is the EMPTY gem.
      out.push(Math.floor(rolls() * 100) >= 25
        ? createEmptySoulTrap()
        : createRandomlyFilledSoulTrap(rolls, soulPointsOf));
    }
  }
  return out;
}

/** The Buy Soulgems shelf - GetMerchantMagicItems(onlySoulGems: true).
 *  X6's own entry point, kept as the name its callers use. */
export function stockSoulGems({ quality = 0, gameMinutes = 0 } = {}, { soulPointsOf = null } = {}) {
  return stockGuildMagicItems({ quality, gameMinutes, sellsSoulGems: true, onlySoulGems: true }, { soulPointsOf });
}

/**
 * GetMerchantPotions (:273-280). `n = quality; while (n-- >= 0)` is
 * quality + 1 potions, and it does NOT reseed - it walks on from
 * wherever the sequence stands, so the potion shelf is not stable the
 * way the magic one is. Seeded on the day here anyway, because the
 * port has no ambient global stream to walk on from and a shelf that
 * rerolled on every open would restock itself for free.
 *
 * AND THE DISCARDED DRAW: DFU passes `Random.Range(1, 5)` as
 * CreateRandomPotion's stackSize, and CreateRandomPotion
 * (ItemBuilder:761-766) NEVER READS stackSize - the argument is
 * dropped on the floor. The DRAW still happens though, and it still
 * advances the sequence, so the potion that comes back is the one
 * AFTER it. Consumed here for that reason and for no other.
 */
export function stockGuildPotions({ quality = 0, gameMinutes = 0 } = {}) {
  const rolls = dailyStockRolls(stockDayIndex(gameMinutes));
  const out = [];
  for (let n = quality; n >= 0; n--) {   // quality + 1 potions
    rolls();                              // Range(1, 5) - drawn, discarded, still counted
    out.push(createRandomPotion(rolls));
  }
  return out;
}
