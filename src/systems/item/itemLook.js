// @ts-check
// PACK-PICK (2026-10-26, feature-feedback "SELLING ITEMS ON THE MARKET IS A PAIN!"): A PIECE LOOKED AT, AWAY FROM THE PACK.
//
// The look the home traders' rows showed a picked piece (scenes/vendorHost.js vendorItemStats, HOME-VENDOR), moved here so
// the Market's List form and the trader's stall read ONE presenter over the same producers (bible/Home.md, ONE DFU
// MEMBER, ONE EXPORT; THE ONE CONSTRUCTION SEAM): the look panel's own stat rows (itemInfo.js itemStatRows - damage,
// armour, hands, material, condition, weight) and the magic as the trade window says it (its tier with its affixes and
// set, and an enchanted piece's powers - or "powers unknown" unidentified). No value row, for itemStatRows' own reason:
// a base value is no shop's price. Pure; null for no piece.
import { isEnchanted } from '../inventory.js';
import { itemIsIdentified } from '../tradeModes.js';
import { itemStatRows } from './itemInfo.js';
import { lootRarityOn, rarityLines } from '../loot/lootRarity.js';
import { magicPowersLines } from './itemPowers.js';
import { isStolen, stolenLine } from '../stolenGoods.js'; // RPT1026-LEDGERLAW: a stolen piece's look says so

/**
 * A piece's look: `{ rows, magic, stolen }` - each row "Label: text" (or the text alone), each magic line as the card writes
 * it, and RPT1026-LEDGERLAW a stolen piece's card line (systems/stolenGoods.js stolenLine), or null.
 * @param {any} it
 * @returns {{ rows: string[], magic: string[], stolen: string | null } | null}
 */
export function itemLookRows(it) {
  if (!it || typeof it !== 'object') return null;
  let rows = [],
    magic = [];
  try {
    rows = itemStatRows(it).map((r) => (r.label ? `${r.label}: ${r.text}` : r.text));
  } catch {
    rows = [];
  }
  try {
    magic = rarityLines(it, { sigil: true, set: true, lore: false });
  } catch {
    magic = [];
  }
  try {
    if (!(it.rarity && lootRarityOn()) && isEnchanted(it)) {
      for (const t of magicPowersLines(it, { identified: itemIsIdentified(it) }))
        if (t && !magic.includes(t)) magic.push(t);
    }
  } catch {
    /* a piece whose powers cannot be read says none */
  }
  return { rows, magic, stolen: isStolen(it) ? stolenLine() : null };
}
