// PX31 - THE PACK'S PAGES (2026-09-12).
//
// Mac: "For the enhanced inventory, I think we need more tabs/sections
// for items. Like books currently go in clothing which doesn't make
// sense. Armor and weapons should be separate. Just take some autonomy
// and properly sort out everything."
//
// DFU's inventory has FOUR tabs - Weapons & Armor, Magic, Clothing &
// Misc, Ingredients (DaggerfallInventoryWindow's AddLocalItem, the law
// ui/nativeInventory.js's filterByTab carries) - and the fourth is a
// drawer: books, maps, potions, gems, jewellery, a horse, a torch and
// the shirts all land in it together. The classic pack keeps DFU's
// four (that window IS DFU's). The enhanced pack is the port's own
// screen and gets NINE pages, which is what a player looks for:
//
//   weapons      the Weapons group
//   armor        the Armor group
//   clothing     MensClothing and WomensClothing
//   magic        ENCHANTED anything, and the spellbook - DFU's own
//                Magic page, and it is asked FIRST, as AddLocalItem
//                asks it: an enchanted sword is a magic item, not a
//                weapon, on both skins
//   potions      the potion (UselessItems1's Potion template)
//   ingredients  DFU's isIngredient templates (0..77) - LESS the gems,
//                which DFU counts as ingredients (they are) and a
//                player looks for under valuables (they are that too)
//   books        Books and Maps - the things you read
//   valuables    Gems, Jewellery, Currency, Paintings, Deeds,
//                Artifacts, and the letter of credit - DFU's
//                MiscItems 275, so its group alone sent it to misc
//                until WALLET1 named it - and WALLET1's Wallet, which
//                holds the currencies: while the pack holds a wallet,
//                what it holds leaves the pages for its sheet
//                (ui/enhancedInventory.js packModel)
//   misc         the rest: the drugs, the jars and sacks, the torch
//                and the bandage, the religious items, the soul trap,
//                the recipe, the horse and the cart (which also keep
//                their own strip, PX21a), the quest items
//
// A PARTITION. Every unequipped item lands on exactly one page, and
// the nine pages together hold exactly what DFU's four hold - pinned
// in test/packPages.test.js over a bag with one of everything. Worn
// items leave the list, as FilterLocalItems drops them (U53).

import { isEquipped } from '../systems/equip.js';
import { isEnchanted, LETTER_OF_CREDIT_TEMPLATE } from '../systems/inventory.js';
import { isIngredientTemplate } from './nativeInventory.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../systems/spellMaker.js';
import { POTION_TEMPLATE_INDEX } from '../systems/loot.js';
import { isCardBinder, isIliacCard } from '../systems/iliacItems.js';   // CARDS8: the binder and its cards
import { isWalletItem } from '../systems/walletItem.js';   // WALLET1: the wallet is a valuable

/** The pages, in the order the spine shows them: [id, label]. */
export const PACK_PAGES = Object.freeze([
  ['weapons', 'Weapons'],
  ['armor', 'Armor'],
  ['clothing', 'Clothing'],
  ['magic', 'Magic'],
  ['potions', 'Potions'],
  ['ingredients', 'Ingredients'],
  ['books', 'Books'],
  ['valuables', 'Valuables'],
  ['misc', 'Misc'],
]);
export const PAGE_IDS = Object.freeze(PACK_PAGES.map(([id]) => id));

const VALUABLES = new Set(['Gems', 'Jewellery', 'Currency', 'Paintings', 'Deeds', 'Artifacts']);
const CLOTHING = new Set(['MensClothing', 'WomensClothing']);

/** The page an item lives on. Total: every item answers one page. */
export function pageOf(it) {
  if (!it) return 'misc';
  // DFU's Magic page first, as AddLocalItem asks it (nativeInventory.js
  // filterByTab): enchanted anything, and the spellbook.
  if (isEnchanted(it) || it.templateIndex === SPELLBOOK_TEMPLATE_INDEX) return 'magic';
  const g = it.group;
  if (g === 'Weapons') return 'weapons';
  if (g === 'Armor') return 'armor';
  if (CLOTHING.has(g)) return 'clothing';
  if (g === 'UselessItems1' && it.templateIndex === POTION_TEMPLATE_INDEX) return 'potions';
  // WALLET1: the wallet and the letter of credit, though both are DFU's miscellany (UselessItems2; MiscItems 275) - the
  // letter's group alone filed it under misc while this page's own words promised it here
  if (VALUABLES.has(g) || isWalletItem(it) || (g === 'MiscItems' && it.templateIndex === LETTER_OF_CREDIT_TEMPLATE)) return 'valuables';   // before the ingredient test: a gem is both, and a player looks here
  if (isIngredientTemplate(it.templateIndex)) return 'ingredients';
  if (g === 'Books' || g === 'Maps' || isCardBinder(it) || isIliacCard(it)) return 'books';   // CARDS8: the binder and its cards with the books
  return 'misc';
}

/** FilterLocalItems' first line (a worn item leaves the list), then
 *  the page. */
export const filterByPage = (items, page) => items.filter((it) => !isEquipped(it) && pageOf(it) === page);
