// @ts-check
// WALLET1 (2026-10-05, Mac: "We need to develop a wallet item that holds forms of currency and sits in the inventory"):
// THE WALLET - a piece every character carries in the pack that holds its currencies. Design and record:
// bible/06-Systems/Wallet.md.
//
// AN ORGANIZER, NEVER A SECOND LIST. The pieces it holds - DFU's letters of credit (template 275), the gate's Deadlands
// Embers (570) and the Welkynd Shards salvage gives (571) - stay in the pack's own collection (`entity.items`), so every
// door that reads or spends one reads it where it always did: the bank's letters and the court's fines
// (systems/banking.js, court.js), the Broker's embers (sigilBroker.js), the Reforge's shards (reforge.js), the save, the
// realm's customs and its gold law. What the wallet changes is where the ENHANCED pack shows them - in the wallet's
// sheet, not on its pages (ui/enhancedInventory.js packModel) - beside the two currencies that are no pieces at all: the
// purse's gold (`entity.goldPieces`, E4's counter) and the account's silver (online, the marks book's balance -
// `setWalletSilver`). The classic window is DFU's and keeps DFU's four tabs; there the wallet's Use says what it holds.
//
// THE PIECE: DFU's Small Sack's picture and price (ItemTemplates 86: TEXTURE.205 record 18, 1 gold - the picture is DFU's
// own), no weight (`hasNoEncumbrance`, the Small Cart's column), one to a slot. BOUND (systems/itemBound.js - never
// dropped, traded or sold; net/realmTradeLaw.js BOUND_TEMPLATES names it) and PACK-ONLY (`packOnly` - not even the wagon
// or the player's own storage take it: a wallet that left the pack would leave its pieces back on the pages). EVERY
// CHARACTER HAS ONE: a new character's starting kit holds it (startingGear.js addSurvivalProvisions, the port's own tail -
// DFU's kit and a mod's alike), and every character made before it is given one, once - PORTAL-GIFT's shape
// (systems/gateSpoils.js): a save's `walletGift` mark says it has had it, a save from before the wallet carries none, and
// the gift is given as the save is restored (save.js restorePlayer - every load, offline and online, the realm's boot
// among them).
//
// Not a DFU member: Daggerfall's currencies are its gold and its letters, in the pack's lists. Ledger A (WALLET1).
import { registerCustomTemplates, setItemFields, mintCondition, registerItemUseHandler } from './itemTemplates.js';
import { addItem, LETTER_OF_CREDIT_TEMPLATE } from './inventory.js';
import { SIGIL_STONE_TEMPLATE, WELKYND_SHARD_TEMPLATE } from './gateSpoils.js';
import { isEquipped } from './equip.js';

/** The wallet's template - the port's own, beside the gate's 570-572 and below the professions' reserved 600. */
export const WALLET_TEMPLATE = 580;
/** Its row, in the port's template columns. Rarity 20: no shelf and no loot table rolls it - every character is given
 *  its one. */
export const WALLET_ROW = Object.freeze({
  index: WALLET_TEMPLATE, name: 'Wallet', baseWeight: 0, hitPoints: 0, capacityOrTarget: 0, basePrice: 1,
  enchantmentPoints: 0, rarity: 20, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 205, worldTextureRecord: 18,
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: false, hasNoEncumbrance: true,
  bound: true, packOnly: true,
});
registerCustomTemplates([WALLET_ROW]);

/** Whether a record IS a wallet - its template and its group, the one spelling every rule reads. */
export const isWalletItem = (/** @type {any} */ item) => item?.templateIndex === WALLET_TEMPLATE && item?.group === 'UselessItems2';
/** Whether a list (the pack) holds one. */
export const hasWallet = (/** @type {any} */ items) => Array.isArray(items) && items.some(isWalletItem);

/** The pieces a wallet holds, by template: DFU's Letter of Credit, the Deadlands Ember, the Welkynd Shard. */
export const WALLET_HOLDS = Object.freeze([LETTER_OF_CREDIT_TEMPLATE, SIGIL_STONE_TEMPLATE, WELKYND_SHARD_TEMPLATE]);
/** Whether a piece is one the wallet holds. */
export const walletHolds = (/** @type {any} */ item) => !!item && WALLET_HOLDS.includes(item.templateIndex);

/** A wallet, minted on its own row. */
export function mintWallet() {
  return mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: WALLET_TEMPLATE }));
}
/** A character with no wallet in its pack is given one (the pack made a list where it had none). Answers 1 for a wallet
 *  given, 0 for one already carried. */
export function giveWallet(/** @type {any} */ entity) {
  if (!entity || typeof entity !== 'object') return 0;
  if (!Array.isArray(entity.items)) entity.items = [];
  if (hasWallet(entity.items)) return 0;
  addItem(entity.items, mintWallet());
  return 1;
}
/** The wallet's gift, PORTAL-GIFT's shape: the mark a save carries once its character has been given one. */
export const WALLET_GIFT = 1;
/** A character from before the wallet (its save's mark short of WALLET_GIFT) is given one, once - and marked, so a
 *  character given it is never given it again. Answers giveWallet's count. */
export function giveWalletGift(/** @type {any} */ entity) {
  if (!entity || typeof entity !== 'object') return 0;
  if ((Number.isSafeInteger(entity.walletGift) ? entity.walletGift : 0) >= WALLET_GIFT) return 0;
  entity.walletGift = WALLET_GIFT;
  return giveWallet(entity);
}

/** The account's silver, as the host knows it - online, the marks book's: its balance, null while it is not known yet,
 *  false for an account that holds none (a guest's, or silver not struck yet) - or no host at all (offline, the bench);
 *  and the host's ask to learn it afresh (the book's refresh). */
/** @type {(() => (number|null|false)) | null} */
let _silver = null;
/** @type {(() => any) | null} */
let _refresh = null;
/** AUDIT 625 W5: the one ask in flight - a look while it is out waits on it, never asks again beside it. */
/** @type {Promise<void> | null} */
let _asking = null;
export function setWalletSilver(/** @type {any} */ read, /** @type {any} */ refresh = null) {
  _silver = typeof read === 'function' ? read : null;
  _refresh = typeof refresh === 'function' ? refresh : null;
  _asking = null;
}
/** The silver asked afresh of the host, as the wallet is looked at - a promise that settles when the host has answered
 *  (or could not), never one that rejects; while an ask is out, that ask. */
export function refreshWalletSilver() {
  if (_asking) return _asking;
  let ask;
  try { ask = Promise.resolve(_refresh?.()).then(() => undefined, () => undefined); } catch { return Promise.resolve(); }
  const mine = ask.then(() => { if (_asking === mine) _asking = null; });
  _asking = mine;
  return mine;
}
/** AUDIT 625 W5: whether this page counts the account's silver at all - a host told it how (online). */
export const walletSilverHere = () => _silver != null;
/** The silver the wallet counts: a whole number of it; false where the account holds none; null where it is not known
 *  here. */
export function walletSilver() {
  try {
    const n = _silver?.() ?? null;
    if (n === false) return false;
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  } catch { return null; }
}

/**
 * WHAT THE WALLET HOLDS, from the pack (`items`) and the purse (`entity`): the gold, the silver (null where it is not
 * counted here, and `silverWhy` why - AUDIT 625 W5), the letters of credit (how many, and the gold they are worth), the
 * embers and the shards (their counts, every stack together), and the pieces themselves (`held`, in the pack's own order
 * - worn ones aside, as the pages leave them).
 * @param {any[]} items @param {any} entity
 */
export function walletContents(items, entity, { silver = walletSilver(), here = walletSilverHere() } = {}) {
  const held = (Array.isArray(items) ? items : []).filter((it) => walletHolds(it) && !isEquipped(it));
  const count = (t) => held.reduce((n, it) => n + (it.templateIndex === t ? Math.max(1, Math.trunc(Number(it.stackCount) || 1)) : 0), 0);
  const letters = held.filter((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);
  return {
    gold: Math.max(0, Math.trunc(Number(entity?.goldPieces) || 0)),
    silver: typeof silver === 'number' && Number.isSafeInteger(silver) ? silver : null,   // a count, or none counted (`false` is the account's none: silverWhy says so)
    // AUDIT 625 W5: why none is counted - offline the account keeps it online; online the page is asking (every look asks
    // afresh), or the account holds none
    silverWhy: Number.isSafeInteger(silver) ? null : !here ? 'offline' : silver === false ? 'none' : 'asking',
    letters: { count: letters.length, gold: letters.reduce((g, it) => g + Math.max(0, Math.trunc(Number(it.value) || 0)), 0) },
    embers: count(SIGIL_STONE_TEMPLATE),
    shards: count(WELKYND_SHARD_TEMPLATE),
    held,
  };
}

const num = (/** @type {number} */ n) => Number(n).toLocaleString('en-US');
/** AUDIT 625 W5: the silver's words where no figure is counted, by why (walletContents' `silverWhy`): offline the
 *  account keeps it; online the page is asking it (every look asks afresh - the sheet, the classic box, the hotbar); an
 *  account that holds none (a guest's, the counting-houses not striking yet). The online wait once said the offline
 *  words. */
export const SILVER_WHY = Object.freeze({ offline: 'kept by your account online', asking: 'asking your account', none: 'none' });
/** The wallet's lines, as the classic window's box says them (and the enhanced sheet's figures): every currency, a
 *  `none` where it holds none, the silver's where it is not counted here said why. */
export function walletLines(/** @type {ReturnType<typeof walletContents>} */ c) {
  return [
    'Your wallet holds:',
    `Gold: ${num(c.gold)}`,
    `Silver: ${c.silver == null ? SILVER_WHY[c.silverWhy] ?? SILVER_WHY.offline : num(c.silver)}`,
    `Letters of credit: ${c.letters.count ? `${num(c.letters.count)}, worth ${num(c.letters.gold)} gold` : 'none'}`,
    `Deadlands Embers: ${c.embers ? num(c.embers) : 'none'}`,
    `Welkynd Shards: ${c.shards ? num(c.shards) : 'none'}`,
  ];
}

/** The card's lines (systems/itemInfo.js): what a wallet is for. */
export const WALLET_CARD_LINES = Object.freeze([
  'Holds your letters of credit, Deadlands Embers and Welkynd Shards,',
  'and counts your gold and your silver.',
]);

/** The pack's Use: the wallet opened - its sheet on the enhanced skin, its box on the classic (the readers route
 *  'wallet'). */
registerItemUseHandler(WALLET_TEMPLATE, (item) => ({ kind: 'wallet', item }));

/** Tests only: no silver known, none asked. */
export function _resetWalletForTests() { _silver = null; _refresh = null; _asking = null; }
