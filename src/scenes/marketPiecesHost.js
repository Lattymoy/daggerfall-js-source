// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { addItem } from '../systems/inventory.js';
import { asMinted, isCraftedFurniture, mintPiece, mintMarketPiece, pieceOfRecipe } from '../systems/smithItems.js';
import { commissionFilledBy } from '../net/writLaw.js';
import { createMarketGoods, tradeRefusal } from '../systems/tradePack.js';
import { isLocked } from '../systems/item/itemLock.js';
import { itemLongName } from '../systems/item/itemInfo.js';
import { itemPicture } from '../ui/menu/menuPicture.js';
import { playerEntity } from '../characters/playerEntity.js';
import { unequipItem } from '../systems/equip.js';
import { WEAR_WHOLE, wearOf } from '../net/marketLaw.js';
import { createMarketHubs } from '../systems/region/marketHubs.js';   // BAY-LEFT-SEA: the provinces' hubs too

/** @param {any} host */
export function createMarketPieces(host) {
  const {
    marketBook, regionHubs, saveSoon, townSeats, worldPlaces, writBook
  } = host;
  /** AUDIT 31 H5: every list of the save a crafted piece can be in - the pack, the home's things, the wagon, and a
   *  repairer's hands (DFU's OtherItems) - so a piece is minted, put back and dropped once wherever it lies. */
  const pieceLists = () => [playerEntity.items, playerEntity.furnishings, playerEntity.wagonItems, playerEntity.otherItems].filter(Array.isArray);
  const heldProvenances = () => new Set(pieceLists().flat().map((it) => it?.provenance).filter(Boolean));
  /** PROF5: A PIECE FROM THE MARKET (bought here, collected off the road, or come back from a listing): minted from its
   *  record as the anvil mints it, at its wear (smithItems.js mintMarketPiece), into the pack - or, furniture, the home's
   *  things - once by its provenance id. */
  const marketMint = (piece) => {
    if (!piece?.provenance) return;
    if (heldProvenances().has(piece.provenance)) return;
    const it = mintMarketPiece(piece);   // MARKET-LOOK: the mint the board's look shows
    if (!it) return;
    const home = isCraftedFurniture(it);
    if (home) (playerEntity.furnishings ??= []).push(it); else addItem((playerEntity.items ??= []), it, 'back');
    host.townTalk.say(`${itemLongName(it)} is ${home ? 'among your home\'s things' : 'in your pack'}.`);
    saveSoon.changed();
  };
  /** PROF5: a piece's name as its record mints it (the Crafted view's and the road's), kept by its provenance id. */
  const _pieceNames = new Map();
  const marketPieceName = (piece) => {
    if (!piece?.provenance) return 'a crafted piece';
    let n = _pieceNames.get(piece.provenance);
    if (!n) { const it = mintPiece(piece, piece.provenance); n = it ? itemLongName(it) : 'a crafted piece'; _pieceNames.set(piece.provenance, n); }
    return n;
  };
  /** MENU-ORDER: a crafted piece's picture - the piece its record mints, minted once and kept by its provenance id. */
  const _pieceItems = new Map();
  const marketPiecePicture = (piece, wake) => {
    if (!piece?.provenance) return null;
    if (!_pieceItems.has(piece.provenance)) { let it = null; try { it = mintPiece(piece, piece.provenance); } catch { it = null; } _pieceItems.set(piece.provenance, it); }
    return itemPicture(_pieceItems.get(piece.provenance), { onReady: wake });
  };
  /** PROF5: the crafted pieces this character may list - in the pack, none worn, locked or bound (TRADE1's refusals), and
   *  the home's crafted furniture not set down. AUDIT 30 C2: none enchanted since its craft - the market mints a piece
   *  again from its record, and the item maker's work would be lost on the way (smithItems asMinted). */
  /** AUDIT 31 H1: a piece either book keeps an act on (a listing, an auction or a fill whose answer is still to come) - it
   *  is offered to neither again until that answer comes. MARKET-ANY: and the pack's side of a piece from the pack (systems/tradePack.js createMarketGoods). */
  const pieceKept = (pv) => !!marketBook?.holdsPiece(pv) || !!writBook?.holdsPiece(pv); const marketGoods = createMarketGoods(playerEntity, { kept: (pv) => pieceKept(pv), say: (t) => host.townTalk.say(t) });
  const marketPieces = () => [
    ...(playerEntity.items ?? []).filter((it) => it?.provenance && asMinted(it) && !tradeRefusal(it) && !isLocked(it) && !pieceKept(it.provenance))
      .map((item) => ({ item, where: 'pack', name: itemLongName(item) })),
    ...(playerEntity.furnishings ?? []).filter((it) => it?.provenance && asMinted(it) && !pieceKept(it.provenance)).map((item) => ({ item, where: 'home', name: itemLongName(item) })),
  ];
  /** PROF6: the pieces in the save that answer a commission - listable as the market's are (as minted, not worn,
   *  locked or bound), of its recipe (smithItems pieceOfRecipe), at least its quality, and unworn (a commission is new
   *  work, Professions-Arc 28) - each taken out of the save and put back as a listed piece is. AUDIT 31 U7: and, where
   *  the service named the pieces that would fill it (`eligible` - its own make, on no sale), only those, the least
   *  quality first. */
  const commissionPieces = (c) => {
    const named = Array.isArray(c.eligible) ? new Map(c.eligible.map((e, i) => [e.provenance, i])) : null;
    // AUDIT 31 L8: the law's own test of a piece that answers it (writLaw commissionFilledBy), never its clause restated
    const answers = (it) => (!named || named.has(it.provenance))
      && commissionFilledBy(c, { recipe: pieceOfRecipe(it, c.recipe) ? c.recipe : null, quality: it.quality ?? null }) && wearOf(it) === WEAR_WHOLE;
    const out = marketPieces()
      .filter((p) => answers(p.item))
      .sort((a, b) => (named ? named.get(a.item.provenance) - named.get(b.item.provenance) : (a.item.quality ?? 0) - (b.item.quality ?? 0)))
      .map((p) => ({ ...p, quality: p.item.quality ?? null, take: () => marketTake(p.item, p.where), putBack: marketPutBack }));
    // AUDIT 31 H8: one that answers it but will not leave the pack (equipped, locked, bound) - the tab says so
    return Object.assign(out, { blocked: (playerEntity.items ?? []).filter((it) => it?.provenance && answers(it) && (tradeRefusal(it) || isLocked(it))).length });
  };
  /** PROF5: a listed piece out of the save (the book keeps it until the service answers), and back on a refusal. */
  const marketTake = (item, where) => {
    const list = where === 'home' ? playerEntity.furnishings : playerEntity.items;
    const i = (list ?? []).indexOf(item);
    if (i < 0 || (where === 'pack' && (tradeRefusal(item) || isLocked(item)))) return false;
    list.splice(i, 1);
    saveSoon.changed();
    return true;
  };
  /** AUDIT 30 C3: a piece a settled listing took, out of the save - the take was made in a save that may not have been
   *  kept since (a crash, a seat handed over), and the piece would stand both listed and in the pack. */
  const marketDrop = (item) => {
    if (!item?.provenance) return;
    for (const list of pieceLists()) {   // AUDIT 31 H5: the wagon and a repairer's hands too
      const i = list.findIndex((it) => it?.provenance === item.provenance);
      if (i < 0) continue;
      if (list === playerEntity.items) unequipItem(playerEntity, list[i]);
      list.splice(i, 1);
      saveSoon.changed();
    }
  };
  const marketPutBack = (item, where) => {
    if (!item?.provenance) return;
    if (heldProvenances().has(item.provenance)) return;
    if (where === 'home') (playerEntity.furnishings ??= []).push(item); else addItem((playerEntity.items ??= []), item, 'back');
    saveSoon.changed();
  };
  /** PROF5: every region's hub as this client derived it (HUB1) - the courier's road's ends, handed with every market
   *  request for the service to witness (PROF0 26). BAY-LEFT-SEA (systems/region/marketHubs.js): and each province's -
   *  its crown seat's, else its largest listed city's - made again as the seats and the places move: `marketHubs()`. */
  const marketHubs = createMarketHubs({ regionHubs, seats: townSeats, places: worldPlaces });
  return { commissionPieces, heldProvenances, marketDrop, marketGoods, marketHubs, marketMint, marketPieceName, marketPiecePicture, marketPieces, marketPutBack, marketTake, pieceKept };
}
