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
//     vanish on a clock), gold-piece items (gold is offered as gold), and bound pieces (SS1, systems/itemBound.js: a
//     Sigil Stone is never handed to another player - and a peer's lot carrying one is refused whole, below), and a
//     Come Sail Away boat's deed or parts (AUDIT REALM2 T1: the realm's own law, net/realmTradeLaw.js BOAT_TEMPLATES);
//   - weight is systems/inventory.js's own arithmetic against combat/formulas.js entityMaxEncumbrance.
import { isBagItem } from '../net/bagLaw.js';   // BAG1
import { activeWagonItem } from './wagonKinds.js';   // WAGONS2 (AUDIT)
import { validLootList } from './loot.js';
import { itemLongName } from './itemInfo.js';   // MARKET-ANY: a pack piece named as the pack names it
import { goodRefusal, GOOD_REFUSAL_WORDS } from '../net/marketLaw.js';   // MARKET-ANY: what may list from the pack
import { splitStack, addItem, itemWeight, totalWeight, carriedWeight, isSummoned, isGoldPieces, addGoldPieces, goldPiecesOf, GOLD_PIECE_WEIGHT_KG } from './inventory.js';
import { isEquipped } from './equip.js';
import { clearLightSourceOnLeave } from './itemTransfer.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';
import { isBound, BOUND_TRADE_TEXT } from './itemBound.js';   // SS1: a bound piece never leaves for another player
import { BOAT_TEMPLATES } from '../net/realmTradeLaw.js';   // AUDIT REALM2 T1: nor a boat's deed or parts - what they stand for stays in the giver's save

/** BAG1: the Materials Bag stays with its owner - a list of its own rides with it (systems/materialsBag.js), which no
 *  trade moves; every General Store sells another. */
export const BAG_TRADE_TEXT = 'Your Materials Bag stays with you. Every General Store sells one.';
/** Why an item may not be put on the table, or null. Words a player can act on. */
export function tradeRefusal(item) {
  if (!item) return 'That is not an item.';
  if (isEquipped(item)) return 'Unequip that first.';
  if (item.questItem) return 'Quest items cannot be traded.';
  if (isSummoned(item)) return 'Summoned items cannot be traded.';
  if (isGoldPieces(item)) return 'Offer gold with the gold box.';
  if (isBound(item)) return BOUND_TRADE_TEXT;   // SS1
  if (BOAT_TEMPLATES.includes(item.templateIndex)) return 'Boat deeds and boat parts cannot be traded.';   // AUDIT REALM2 T1
  if (isBagItem(item)) return BAG_TRADE_TEXT;   // BAG1: the bag is its owner's
  return null;
}
/** WAGONS2 (AUDIT): what the shop's Sell says by dropping the click (systems/tradeModes.js - "Are we trying to sell the
 *  non empty wagon?"), a trade, the market and the vault say in words. */
export const WAGON_LOADED_TRADE_TEXT = 'Empty your wagon before it changes hands.';
/** The market's List form's words for it (GOOD_REFUSAL_WORDS' way). */
export const WAGON_LOADED_MARKET_WORDS = 'your wagon - empty it first';
/** Why an item of `entity`'s pack may not leave it for another player, or null: tradeRefusal's, and the wagon the
 *  player drives while it holds anything (WAGONS2 AUDIT: a loaded caravan traded away left its cargo on the cart the
 *  pack drove next, 2000 kg in a 750 kg store, and the caravan's 2000 kg fresh for its new owner). */
export function packTradeRefusal(item, entity) {
  const refusal = tradeRefusal(item);
  if (refusal) return refusal;
  return wagonLoadedHeld(item, entity) ? WAGON_LOADED_TRADE_TEXT : null;
}
/** WAGONS2 (FINAL AUDIT): THE LOADED WAGON HELD - `item` the wagon `entity` drives (the best owned), with goods in its
 *  store: the one law the pack's refusal above and the keyed shelf's (scenes/worldModes.js loadedWagonHeld) read - the
 *  shelf restated it, pinned by its text alone. */
export const wagonLoadedHeld = (item, entity) => !!item && item === activeWagonItem(entity?.items ?? []) && (entity?.wagonItems?.length ?? 0) > 0;

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
    offerable: (item) => packTradeRefusal(item, entity),   // WAGONS2 (AUDIT): the loaded wagon stays

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

    /** The peer's records as this game would mint them - every one through the wire clamp - or null if any is no item,
     *  or any is BOUND (SS1: a peer that holds one out - an older build, a forged frame - offers what may not change
     *  hands, and the lot is refused whole, the trade's own word for a forgery). */
    unwire(records) { const items = validLootList(records); return items && !items.some(isBound) ? items : null; },

    /** AUDIT REALM L1-F1: where each offered item stands in the pack - its index in the list a save writes as `items`
     *  (systems/save.js snapshotPlayer keeps the order) - read BEFORE the goods are reserved, so a realm trade's half
     *  names the very records its checkpoint holds (net/realmTradeLaw.js realmTradePickOf); -1 for one not here. */
    picks(entries) { const items = list(); return entries.map(({ item }) => items.indexOf(item)); },

    /** Take the goods OUT of the pack (reserve). All-or-nothing: a lot that is not entirely here comes back null. */
    take(entries, gold) {
      const items = list();
      if (!(gold >= 0) || gold > goldPiecesOf(entity)) return null;
      for (const { item, count } of entries) {
        if (!items.includes(item) || count < 1 || count > Math.max(1, item.stackCount ?? 1) || packTradeRefusal(item, entity)) return null;
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

// ─── MARKET-ANY (FIELD BUGS 2026-10-01, the field: "The market doesn't allow you to list any item that isnt bound") ───
//
// THE PACK'S SIDE OF A PIECE FROM THE PACK ON THE MARKET - what the Market tab's List form offers of the pack and why the
// rest may not go, a piece as it lists (its record as the service matches it, its place in the save, its taking), a
// record's name, and a collected piece into the pack. The law is net/marketLaw.js goodRefusal; this adapter does every
// move, as a realm trade's piece moves (REALM P2.1): the service takes the piece out of the seller's record and puts it
// into the buyer's (server-account/src/market.js), and these keep the pack the record's twin. Not a DFU member:
// Daggerfall has no other player to sell to. Ledger A.

/**
 * @param {any} entity the live player entity (`items`)
 * @param {{ kept?: (provenance: string) => boolean, say?: (text: string) => void }} [o] `kept` - a crafted piece another
 *   act of the counting-house holds (net/marketBook.js holdsPiece, the writs' book's), left out; `say` - the HUD's line
 */
export function createMarketGoods(entity, { kept = () => false, say = () => {} } = {}) {
  return {
    /** The pack's pieces as the List form offers them - each with why it may not go, in the form's words, or null. A
     *  crafted piece's way (from the pack, or as a crafted piece) is the service's to say - the tab asks it. */
    goods() {
      const pack = createTradePack(entity);
      return (entity.items ?? []).filter((it) => it && !(typeof it.provenance === 'string' && kept(it.provenance))).map((item) => {
        // a piece the trade's wire will not carry (a row this game does not know) is no piece the service could match
        const why = goodRefusal(item) ?? (pack.wire([{ item, count: Math.max(1, item.stackCount ?? 1) }])?.[0] ? null : 'shape');
        const loaded = !why && packTradeRefusal(item, entity) === WAGON_LOADED_TRADE_TEXT;   // WAGONS2 (AUDIT): the loaded wagon, said
        return { item, name: itemLongName(item), why: why ? (GOOD_REFUSAL_WORDS[/** @type {keyof typeof GOOD_REFUSAL_WORDS} */ (why)] ?? why) : loaded ? WAGON_LOADED_MARKET_WORDS : null };
      });
    },
    /** A piece of the pack as it lists: its record as the trade's wire projects it (what the service matches against
     *  the record - realmTradeLaw recordIsOffered), its index in the list the save writes as `items` (tradePack picks -
     *  AUDIT REALM L1-F1), and its taking - its whole stack out of the pack (tradePack take: the lit light let go) -
     *  answering its undo, or null when the pack no longer holds it where it was, or it may not go. */
    good(/** @type {any} */ item) {
      const pack = createTradePack(entity);
      const entries = [{ item, count: Math.max(1, item?.stackCount ?? 1) }];
      const pick = pack.picks(entries)[0];
      return {
        offered: pack.wire(entries)?.[0] ?? null,
        pick,
        take: () => {
          if ((entity.items ?? [])[pick] !== item || goodRefusal(item)) return null;
          const handle = pack.take(entries, 0);
          return handle ? () => pack.restore(handle) : null;
        },
      };
    },
    /** A pack piece's record named as the pack names it - another player's record through the wire's clamp first. */
    goodName(/** @type {any} */ rec) {
      const it = rec ? validLootList([rec])?.[0] : null;
      return it ? itemLongName(it) : 'a piece';
    },
    /** A piece collected - the record the service put into this character's record - into the pack as a trade's piece
     *  comes (tradePack unwire: the wire's clamp, and a bound piece refused; give). False: this game will not hold it. */
    receive(/** @type {any} */ rec) {
      const pack = createTradePack(entity);
      const items = rec ? pack.unwire([rec]) : null;
      if (!items?.length) return false;
      pack.give(items, 0);
      say(`${itemLongName(items[0])} is in your pack.`);
      return true;
    },
  };
}
