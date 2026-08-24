// Inventory core (Systems S2). Verbatim rules from DFU
// DaggerfallUnityItem.IsStackable + ItemCollection.AddItem (MIT,
// Daggerfall Workshop):
//   "Only ingredients, potions, gold pieces, oil and arrows are
//    stackable, but equipped items, enchanted ingredients and quest
//    items are never stackable."
// Potions have no group yet (they pend the magic slice) - the rule
// covers them the day they do.
// Weight: template baseWeight, zeroed by the template's
// hasNoEncumbrance bit (EffectiveUnitWeightInKg); weapons scale by
// the ItemBuilder rule "Weight is baseWeight * value / 4" through the
// material multiplier table (already single-sourced in weapons.js).
// Armor material weight is LIVE: leather through the Erisceres
// formula AS CODED (the int division makes Mathf.Round a no-op),
// plate through CalculateWeightForMaterial, chain a verbatim no-op
// (ApplyArmorMaterial's Chain arm touches value only).

import templates from '../characters/itemTemplates.json' with { type: 'json' };
import { weightMultipliersByMaterial } from '../characters/weapons.js';

/** DaggerfallUnityItem.IsEnchanted verbatim
 *  (DaggerfallUnityItem.cs:266-269): DERIVED from the enchantment
 *  arrays, never a stored flag.
 *  AUDIT 17e C2: three consumers (this stacking rule, the inventory
 *  tab router, the FP weapon's enchanted animation set) all read a
 *  property `item.enchanted` that NOTHING ever wrote - loot.js stamps
 *  `magic: true` and the enchantments array. So no item in the game
 *  was ever enchanted: looted magic weapons sat in Weapons & Armor
 *  instead of Magic Items, swung the mundane animation set, and
 *  stacked when DFU forbids it. */
export function isEnchanted(item) {
  return !!(item?.enchantments?.length || item?.customEnchantments?.length);
}

/** Currency.Gold_pieces (ItemEnums.cs:605-608) - template 276, whose
 *  player texture is unset so GetItemImage falls back to the world
 *  pile (216/1). AUDIT 17f / ONE DFU MEMBER, ONE EXPORT: three
 *  producers minted the gold stack by hand (startingGear, court,
 *  talk) with NO template index and two different names ("Gold
 *  Pieces" / "Gold pieces"), so the stack drew no icon at all and its
 *  label changed depending on who created it.
 *
 *  FLAGGED: classic keeps gold in playerEntity.GoldPieces, a counter
 *  the GOLD button reads - it is not an item and never appears in the
 *  list. The port's S2 shape carries it as a bag stack; retiring that
 *  is its own slice (goldAmount/trade/loot all read the stack). */
export const GOLD_TEMPLATE = 276;
export const goldStack = (stackCount = 0) => ({
  group: 'Currency', templateIndex: GOLD_TEMPLATE,
  name: templates.find((t) => t.index === GOLD_TEMPLATE)?.name ?? 'Gold Pieces',
  stackCount,
});

/** MiscItems.Letter_of_credit (ItemEnums.cs) - minted the one place
 *  DFU mints it (DaggerfallTradeWindow.cs:1044-1048): a sale whose
 *  proceeds would push the player past MaxEncumbrance pays in paper
 *  instead of coin, and the letter's VALUE is the whole trade price.
 *  It lives beside goldStack because it is the same kind of thing -
 *  a minter for a currency-shaped item - and because the trade law
 *  decides WHETHER to mint one while the pack decides what one is. */
export const LETTER_OF_CREDIT_TEMPLATE = 275;
export const letterOfCredit = (value = 0) => ({
  group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE,
  name: templates.find((t) => t.index === LETTER_OF_CREDIT_TEMPLATE)?.name ?? 'Letter of credit',
  value, stackCount: 1,
});

/** Weapons.Arrow / UselessItems2.Oil (ItemEnums.cs) - the two
 *  IsOfTemplate arms of IsItemStackable. */
export const ARROW_TEMPLATE = 131;
export const OIL_TEMPLATE = 252;

/** FormulaHelper.IsItemStackable (:2096-2110) behind
 *  DaggerfallUnityItem.IsStackable's three never-stack clauses.
 *
 *  AUDIT 18: the ingredient arm is `item.IsIngredient`, and
 *  DaggerfallUnityItem.cs:250-253 defines that as the TEMPLATE's
 *  isIngredient bit - not a group list. The port hard-coded seven
 *  group names, which silently dropped Gems (templates 0-7) and
 *  MetalIngredients (65-75): both carry isIngredient and both are
 *  shelved by the Alchemist/GemStore/PawnShop stock tables, so ten
 *  bought rubies sat as ten rows. Oil was dropped the same way.
 *
 *  Books are the one arm deliberately NOT ported: IsItemStackable
 *  does name ItemGroups.Books, but ItemCollection.FindExistingStack
 *  (:699-718) additionally requires `checkItem.message == item.message`
 *  - the per-book id the port does not model - so stacking books here
 *  would merge two DIFFERENT books, which DFU never does. */
export function isStackable(item) {
  // AUDIT 17e C2: `item.equipped` was never written either - the port
  // marks worn items with equipSlot (equip.js) - so all three clauses
  // of DFU's rule were no-ops.
  if (item.equipSlot != null || isEnchanted(item) || item.questItem) return false;   // never stack
  if (templates[item.templateIndex]?.isIngredient) return true;   // IsIngredient
  if (item.group === 'Currency') return true;                     // IsOfTemplate(Currency, Gold_pieces)
  if (item.group === 'Weapons' && item.templateIndex === ARROW_TEMPLATE) return true;
  if (item.group === 'UselessItems2' && item.templateIndex === OIL_TEMPLATE) return true;
  // Potions join here when their group exists (the rule names them).
  return false;
}

/** Two records stack when the rule allows and they are the same
 *  thing: group + templateIndex (+ material where it exists). */
export function stacksWith(a, b) {
  return isStackable(a) && isStackable(b) &&
    a.group === b.group && a.templateIndex === b.templateIndex &&
    (a.material ?? null) === (b.material ?? null);
}

/** ItemCollection.AddItem: merge into an existing stack or append. */
export function addItem(list, item) {
  for (const held of list) {
    if (stacksWith(held, item)) {
      held.stackCount = (held.stackCount ?? 1) + (item.stackCount ?? 1);
      return held;
    }
  }
  list.push(item);
  return item;
}

/** Remove ONE item by templateIndex: decrements a stack, splices a
 *  single. Returns true when one was removed (parity audit 2026-08-17:
 *  the player's bow never consumed an Arrow - WeaponManager removes
 *  one per loose). */
export function removeOne(list, templateIndex) {
  const i = list.findIndex((it) => it.templateIndex === templateIndex);
  if (i < 0) return false;
  const it = list[i];
  if ((it.stackCount ?? 1) > 1) it.stackCount--;
  else list.splice(i, 1);
  return true;
}

export function transferAll(fromList, toList) {
  let n = 0;
  for (const item of fromList) { addItem(toList, item); n++; }
  fromList.length = 0;
  return n;
}

/** Unity Mathf.Round: half rounds to EVEN (2.5 -> 2, 3.5 -> 4). */
const roundHalfEven = (x) => {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};

/** Leather armor weight AS CODED in DFU (audit F13): the Erisceres
 *  COMMENT says Round, but the code int-divides - (int)(w*4)/2 -
 *  making Mathf.Round a no-op, so verbatim = truncate. Converges
 *  with half-even on every classic template (only Gauntlets scale
 *  odd, and 5/2 banks to 2 both ways); the shapes split at
 *  scaled = 3 mod 4 (2.75 kg -> 1.25, where Round would give 1.5). */
export const leatherWeight = (weightKg) => Math.trunc(Math.trunc(weightKg * 4) / 2) / 4;

/** ItemBuilder.CalculateWeightForMaterial VERBATIM: quarter-kg
 *  quantized - Round(trunc(w*4) * multiplier / 4) / 4 with Unity's
 *  half-to-even Round. (The weapons.js comment 'baseWeight * value/4'
 *  is the shorthand; this is the exact function - an iron and a
 *  daedric dagger BOTH weigh 0.5 kg because Round(2.5) banks to 2.) */
export function weightForMaterial(weightKg, weaponMaterial) {
  const quarterKgs = Math.trunc(weightKg * 4);
  const matQuarterKgs = (quarterKgs * (weightMultipliersByMaterial[weaponMaterial] ?? 4)) / 4;
  return roundHalfEven(matQuarterKgs) / 4;
}

/** Weight in kg: template baseWeight (x stack), zero when the
 *  template has hasNoEncumbrance; weapons + plate armor through the
 *  verbatim material function; leather through the Erisceres formula
 *  AS CODED - trunc(INT(w*4)/2)/4, the int division making Round a
 *  no-op (F13); chain unchanged (its x2 is a VALUE rule, not weight). */
/** AUDIT 23 (items-8): DFU's weightInKg - the per-unit
 *  MATERIAL-ADJUSTED weight (ItemBuilder bakes it at mint; the port
 *  derives it at read). The info panel's %kg prints THIS x stack
 *  (DaggerfallUnityItemMCP.cs:144-148) - hasNoEncumbrance does not
 *  zero it, that flag gates only encumbrance. */
export function unitWeightInKg(item) {
  const t = templates[item.templateIndex];
  let base = t ? t.baseWeight : 0;
  if (item.group === 'Weapons' && item.name !== 'Arrow' && item.material != null) {
    base = weightForMaterial(base, item.material);
  }
  if (item.group === 'Armor' && item.material != null) {
    if (item.material === 0x0000) base = leatherWeight(base);
    else if (item.material >= 0x0200) base = weightForMaterial(base, item.material - 0x0200); // plate
  }
  return base;
}

/** EffectiveUnitWeightInKg (DaggerfallUnityItem.cs:667-673): 0f for a
 *  hasNoEncumbrance template, else the per-unit material-adjusted
 *  weight. AUDIT 18: the flag ships in itemTemplates.json (horse,
 *  cart, arrows, maps, quest letters) and nothing read it, so a
 *  bought horse added 800 kg to the character sheet. L-slice: named
 *  to DFU's member so the encumbrance gate reads the same value the
 *  weight sum does. */
export function effectiveUnitWeightInKg(item) {
  const t = templates[item.templateIndex];
  if (t?.hasNoEncumbrance) return 0;
  return unitWeightInKg(item);
}

// ItemCollection.GetWeight (:94-101) multiplies the stack by the
// EFFECTIVE unit weight - so the hasNoEncumbrance zero survives the
// stack multiply.
export function itemWeight(item) {
  return effectiveUnitWeightInKg(item) * (item.stackCount ?? 1);
}

export const totalWeight = (list) => list.reduce((a, i) => a + itemWeight(i), 0);

/** WeightInGPUnits (DaggerfallInventoryWindow.cs:1439-1442): classic
 *  stores weight in quarter-kg... x100 - a GOLD-PIECE unit is 0.0025
 *  kg, so kg x 400 lands every legal weight on an integer (Unity's
 *  RoundToInt banker's tie cannot arise on multiples of 1/400). */
export const weightInGPUnits = (kg) => Math.round(kg * 400);

/** DaggerfallBankManager.goldPieceWeightInKg (:82-91) - read off the
 *  Currency template's baseWeight, which ships 0.0025; the obsolete
 *  const beside it in C# names the same number. It lives HERE, with
 *  the rest of the weight law, because two consumers need it and
 *  neither is the other's: the inventory window's wagon-gold clamp
 *  and U40's letter-of-credit gate, which asks whether a sale's
 *  proceeds would push the player past MaxEncumbrance. */
export const GOLD_PIECE_WEIGHT_KG = 0.0025;

/** ComputeCanHoldAmount (DaggerfallInventoryWindow.cs:1444-1455,
 *  L-slice AUDIT 23 items-9): how many units of an item fit under a
 *  capacity, in GP-unit INTEGER arithmetic - `(roundCapacity -
 *  roundLoad) / roundUnitWeight` is C# integer division, so an
 *  over-capacity load yields a negative quotient and the caller's
 *  <=0 refusal reads it. A weightless unit (round weight 0) never
 *  binds - the whole stack fits. */
export function canHoldAmount(unitsAvailable, unitWeightKg, capacityKg, loadKg) {
  let canHold = unitsAvailable;
  const roundUnitWeight = weightInGPUnits(unitWeightKg);
  if (roundUnitWeight > 0) {
    canHold = Math.min(canHold, Math.trunc((weightInGPUnits(capacityKg) - weightInGPUnits(loadKg)) / roundUnitWeight));
  }
  return canHold;
}
