// TRADE1 (2026-09-21): THE PACK, AS THE TRADE SEES IT. net/tradeSession.js is pure - it never touches an item - and this
// is the ONE place a trade reaches the player's real inventory: what may be offered, how an offer is written for the
// wire, how the peer's records are minted here, how goods are taken out (reserved) and put back, and whether a lot fits.
//
// THE LAWS IT BORROWS, not rewrites (the same standing rule ui/enhancedTrade.js states for the shop):
//   - the wire projection is systems/loot.js validLootList/validLootItem - the clamp every peer-borne item already goes
//     through (WORLD4): shape and depth bounds, a declared-field kind check, the value floored at what the port itself
//     mints, `equipSlot` and `questItem` stripped (they are the RECEIVER's marks, never the sender's word);
//   - what may not be offered is the pack's own refusals: worn gear (systems/equip.js isEquipped - a staged worn item
//     would leave equip.slots pointing at it, AUDIT 17e F4), quest items (the quest owns them), summoned items (they
//     vanish on a clock), and gold-piece items (gold is offered as gold);
//   - weight is systems/inventory.js's own arithmetic against combat/formulas.js entityMaxEncumbrance.
import { validLootList } from './loot.js';
import { splitStack, addItem, itemWeight, totalWeight, carriedWeight, isSummoned, isGoldPieces, addGoldPieces, goldPiecesOf, GOLD_PIECE_WEIGHT_KG } from './inventory.js';
import { isEquipped } from './equip.js';
import { clearLightSourceOnLeave } from './itemTransfer.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';

/** Why an item may not be put on the table, or null. Words a player can act on. */
export function tradeRefusal(item) {
  if (!item) return 'That is not an item.';
  if (isEquipped(item)) return 'Unequip that first.';
  if (item.questItem) return 'Quest items cannot be traded.';
  if (isSummoned(item)) return 'Summoned items cannot be traded.';
  if (isGoldPieces(item)) return 'Offer gold with the gold box.';
  return null;
}

/** The kilograms an offer takes out of the pack: each entry at the count offered, and the gold. */
function offerWeight(entries, gold) {
  let w = gold * GOLD_PIECE_WEIGHT_KG;
  for (const e of entries) w += itemWeight({ ...e.item, stackCount: e.count });
  return w;
}

/**
 * The adapter over one entity's pack. `entity` is the live player entity (`items`, `goldPieces`).
 * Returns the `pack` object net/tradeSession.js takes.
 */
export function createTradePack(entity) {
  const list = () => (entity.items ??= []);
  return {
    offerable: (item) => tradeRefusal(item),

    /** [{item,count}] -> the records that go on the wire, or null. A partial stack is the origin's record at the count. */
    wire(entries) {
      const recs = entries.map(({ item, count }) => {
        const copy = JSON.parse(JSON.stringify(item));   // a plain-data copy: nothing from the pack rides the frame by reference
        const have = Math.max(1, item.stackCount ?? 1);
        if (have > 1 || count > 1) copy.stackCount = count;
        return copy;
      });
      return validLootList(recs);
    },

    /** The peer's records as this game would mint them - every one through the wire clamp - or null if any is no item. */
    unwire(records) { return validLootList(records); },

    /** Take the goods OUT of the pack (reserve). All-or-nothing: a lot that is not entirely here comes back null. */
    take(entries, gold) {
      const items = list();
      if (!(gold >= 0) || gold > goldPiecesOf(entity)) return null;
      for (const { item, count } of entries) {
        if (!items.includes(item) || count < 1 || count > Math.max(1, item.stackCount ?? 1) || tradeRefusal(item)) return null;
      }
      const taken = [];
      for (const { item, count } of entries) {
        const have = Math.max(1, item.stackCount ?? 1);
        if (count >= have) {
          items.splice(items.indexOf(item), 1);
          clearLightSourceOnLeave(item, entity, true);
          taken.push({ item, origin: null });
        } else {
          // a partial stack: the picked half is minted and pushed by splitStack, then lifted straight back out
          const picked = splitStack(items, item, count);
          if (!picked) { this.restore({ taken, gold: 0 }); return null; }
          items.splice(items.indexOf(picked), 1);
          taken.push({ item: picked, origin: item });
        }
      }
      entity.goldPieces = goldPiecesOf(entity) - gold;
      return { taken, gold };
    },

    /** Put a reserved lot back exactly - a split half rejoins its origin stack, a whole item returns to the pack. */
    restore(handle) {
      const items = list();
      for (const { item, origin } of handle.taken) {
        if (origin && items.includes(origin)) origin.stackCount = (origin.stackCount ?? 1) + (item.stackCount ?? 1);
        else addItem(items, item);
      }
      if (handle.gold) addGoldPieces(entity, handle.gold);
    },

    /** Receive a lot: items merge into the pack as any pickup does, gold goes to the purse. */
    give(received, gold) {
      const items = list();
      for (const it of received) {
        if (isGoldPieces(it)) addGoldPieces(entity, it.stackCount ?? 1);   // a gold pile is a counter, never an item in the pack
        else addItem(items, it);
      }
      if (gold) addGoldPieces(entity, gold);
    },

    /** Could this pack carry the peer's lot once my own offer has left it? (The lock's check; a receive never refuses.) */
    fits(theirItems, theirGold, mineEntries = [], mineGold = 0) {
      const incoming = totalWeight(theirItems) + theirGold * GOLD_PIECE_WEIGHT_KG;
      const after = carriedWeight(entity) - offerWeight(mineEntries, mineGold) + incoming;
      return after <= entityMaxEncumbrance(entity);
    },

    gold: () => goldPiecesOf(entity),
  };
}
