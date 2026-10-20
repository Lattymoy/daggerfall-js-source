// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF12 (2026-10-02, Mac: "2 and 4") - A BREW'S POTIONS AS DFU'S OWN
// ITEMS (bible/06-Systems/Professions-Arc.md 9.3, 37): the potions the
// alchemy station's brew makes, minted into the pack as DFU's own maker
// mints one - ItemBuilder.CreatePotion (systems/loot/loot.js createPotion: the
// Glass Bottle carrying its recipe's key, the recipe's price and its
// bottle's picture) - so a brewed Healing IS Daggerfall's Healing: it
// stacks, drinks (DrinkPotion's bundle, potions.js) and sells as DFU's.
//
// A POTENT potion (9.3: "+25% magnitude, named so") carries the port's
// own `potent` field (itemFields.js - its share, 25 or a Master
// Alchemist's 40): its name says so (itemInfo.js itemNameParts), its
// magnitudes are raised as it is drunk (scenes/hostMagic.js drinkPotion,
// alchemyLaw potentEffect - AUDIT PROF12 A3: its duration, and its chance
// where it has one, for the fourteen whose magnitude is DFU's default),
// it stacks only with its own share
// (inventory.js), and - DECIDED - it is worth its share more.
//
// No provenance: a potion is DFU's own consumable and stacks; it is no
// crafted piece the market mints again (NOT YET - Professions-Arc 37).
// ═══════════════════════════════════════════════════════════════════
import { createPotion } from './loot/loot.js';
import { potionById, potentOk, potentLasts, potentAble } from '../net/alchemyLaw.js';

/** What the station says of a brew whose answer did not come (smithItems.js's kept words' shape). */
export const BREW_KEPT_TEXT = 'The cauldron bubbled, but no word came back. The brew is kept and will be bottled when word comes.';
/** The potions a brew's answer makes (`{ potion, count, potent }`), each DFU's own potion - or none for an answer that
 *  names no potion. */
export function brewItems(data) {
  const p = potionById(data?.potion);
  if (!p) return [];
  const n = Number.isSafeInteger(data?.count) ? Math.max(1, Math.min(3, data.count)) : 1;
  const potent = potentOk(data?.potent) && potentAble(p) ? data.potent : 0;   // AUDIT PROF-541 B3: never a Potent Cure - its name and worth +25% for nothing
  const out = [];
  for (let i = 0; i < n; i++) {
    const it = createPotion(p.key);
    if (potent) {
      it.potent = potent;
      it.value = Math.round(((Number(it.value) || 0) * (100 + potent)) / 100);
    }
    out.push(it);
  }
  return out;
}

/** What a brew says: "You brewed 2 Potent Potions of Healing (+25% magnitude)" - AUDIT PROF12 A3: a potion whose
 *  magnitude is DFU's default "(lasts 25% longer)" (alchemyLaw potentLasts). */
export function brewedText(data) {
  const p = potionById(data?.potion);
  if (!p) return 'You brewed nothing.';
  const n = Number.isSafeInteger(data?.count) ? data.count : 1;
  const potent = potentOk(data?.potent) && potentAble(p);   // AUDIT PROF-541 B3
  return `You brewed ${n === 1 ? 'a' : n} ${potent ? 'Potent ' : ''}${n === 1 ? 'Potion' : 'Potions'} of ${p.name}${potent ? (potentLasts(p) ? ` (lasts ${data.potent}% longer)` : ` (+${data.potent}% magnitude)`) : ''}`;
}
