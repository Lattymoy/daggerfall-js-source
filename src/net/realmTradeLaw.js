// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P2.1 — A TRADE IS THE REALM'S: the law both ends read. The
// service settles with it (server-account/src/realmTrade.js); the client
// names its half with it (net/tradeSession.js, systems/realmSaves.js).
//
// Mac: "eliminate duping". The plan is bible/06-Systems/Realm-Arc.md
// section 3: "Escrowed on the service ... Both offers are checked
// against both characters' last checkpoints. The swap is applied to
// both records at once, both `seq`s go up, and both clients load the
// result. This replaces the peer-to-peer commit, which can never be
// atomic."
//
// ═══ WHY THE PEERS NO LONGER HAND THE GOODS OVER ═══════════════════
//
// TRADE1's commit fails toward loss, never duplication - between honest
// clients. It cannot be atomic across two machines, and a client that
// is not honest (a tab closed between the commits, a checkpoint that
// never leaves) keeps what it gave. A realm character's save is the
// service's, so the service can do what two machines cannot: move the
// goods between the two records in one write, or not at all.
//
// Each side sends its HALF - what it gives and what it takes, the two
// offers exactly as its window showed them - under the trade's own sid,
// once it has checkpointed the save as it stood when both confirmed.
// When both halves agree, the service takes each side's goods out of
// ITS OWN copy of that side's save and puts them in the other's. What
// moves is what the giver's record holds, never what a client says it
// holds: an offer the record cannot back is refused, so no trade makes
// an item or a coin.
//
// ═══ AN OLDER BUILD NEVER SETTLES WITH THE REALM ═══════════════════
//
// A realm trade numbers its revisions from REALM_TRADE_REV_BASE
// (net/tradeSession.js). A peer that settles hand to hand (a tab still
// open from before a deploy) numbers from 0, so each side's locks name
// revisions the other never holds and nothing is ever confirmed: nobody
// commits, nothing is lost. The realm side says so at the peer's first
// frame.
// ═══════════════════════════════════════════════════════════════════

import { canon } from './canon.js';
import { TRADE_ITEMS_MAX, TRADE_GOLD_MAX } from './wire.js';
import { isBagItem } from './bagLaw.js';   // BAG1

/** A trade's id: the peers' own sid (wire.js validTradeData's TRADE_SID_RE, which the wire keeps to itself). */
export const REALM_TRADE_SID_RE = /^[A-Za-z0-9]{6,16}$/;
/** How long the first half waits on the service for the second, in seconds. Both sides confirm within a frame of each
 *  other; the checkpoint each makes before its half takes a second or two. */
export const REALM_TRADE_TTL_S = 60;
/** The gold-piece template (systems/inventory.js GOLD_TEMPLATE, pinned equal): gold is offered as gold, never as an item. */
export const GOLD_PIECES_TEMPLATE = 276;
/** AUDIT REALM L1-F1: the rows whose record IS its value - the letter of credit (systems/inventory.js
 *  LETTER_OF_CREDIT_TEMPLATE, pinned equal). Its price is no mere price: two letters differ in nothing else. The wire
 *  keeps it exactly (systems/loot.js validLootItem floors a value at the row's base price, and a letter's is 0). */
export const VALUE_IS_IDENTITY_TEMPLATES = Object.freeze([275]);
/** The fields that are never part of what an item IS: its count and its price (the offer's own, which the wire floors),
 *  and the marks that are the RECEIVER's (systems/loot.js validLootItem strips them). */
export const TRADE_VOLATILE_FIELDS = Object.freeze(['stackCount', 'value', 'equipSlot', 'questItem']);
/** AUDIT REALM2 S4: the most a record a trade moves may be, in JSON characters - the JSON routes' own body (service.js
 *  MAX_BODY_BYTES). A piece the port mints is a few hundred; one with every string at the wire's 128 and ten
 *  enchantments, fifteen hundred. A price is volatile, so without it a million-character one rode along unseen. */
export const REALM_TRADE_RECORD_MAX = 4096;
/** AUDIT REALM F1: THE ROWS THAT BIND EVERY PIECE OF THEIR KIND - systems/itemBound.js isBound's other half (SS1: "Its
 *  template row can say `bound`"), which this Worker cannot read, since the template table is the game's. The Sigil
 *  Stone's row (systems/gateSpoils.js SIGIL_STONE_TEMPLATES) is the one; test/auditrealm.test.js holds this list equal to
 *  every row the game registers with `bound`. The service read `rec.bound` alone, and a stone's record carries no mark
 *  of its own - so two halves naming a stone moved it between two realm characters. */
export const BOUND_TEMPLATES = Object.freeze([570, 571, 572, 580]);   // LOOT9: the Welkynd Shard's row beside the Stone's; PORTAL1: the Portal Stone's beside the shard's; WALLET1: the Wallet's (systems/walletItem.js)
/** A bound record, as systems/itemBound.js isBound reads a piece: its own mark (SS4), or its row's (SS1) - and no field
 *  on the record unbinds what the row binds. */
export const boundRecord = (/** @type {any} */ rec) => rec?.bound === true || BOUND_TEMPLATES.includes(rec?.templateIndex);
/** AUDIT REALM2 T1: COME SAIL AWAY'S BOAT PARTS AND DEED (systems/comeSailAwayItems.js BOAT_PARTS_TEMPLATE and
 *  BOAT_DEED_TEMPLATE, pinned equal) - records that stand for what the giver's save keeps by the item's UID. A deed names
 *  the boat it placed, and a crewed boat keeps its deed (comeSailAway.js takePlaceItem), while a deed whose boat is not
 *  in its holder's world places one (useBoatDeed) - so a deed handed on was a second boat. Parts leave their cargo in
 *  the giver's PackedCargoes, so they arrived empty. Neither ever leaves in a trade. */
export const BOAT_TEMPLATES = Object.freeze([1320, 1321]);

const plain = (/** @type {unknown} */ v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A record's count: its stack, or one. */
export const recordCount = (/** @type {any} */ rec) => (Number.isSafeInteger(rec?.stackCount) && rec.stackCount >= 1 ? rec.stackCount : 1);

/** One side of the table - the wire records its window showed, and its gold - or null. */
export function realmTradeSideOf(/** @type {any} */ v) {
  if (!plain(v)) return null;
  const items = v.items ?? [];
  const gold = v.gold ?? 0;
  if (!Array.isArray(items) || items.length > TRADE_ITEMS_MAX || !items.every(plain)) return null;
  if (!Number.isSafeInteger(gold) || gold < 0 || gold > TRADE_GOLD_MAX) return null;
  return { items, gold };
}

/** AUDIT REALM L1-F1: WHICH OF ITS CHECKPOINT'S RECORDS A SIDE GIVES - for each record it offers, that record's index in
 *  the save's `items` as the half's own checkpoint wrote them (systems/tradePack.js `picks`, read as the goods are
 *  reserved), each index once - or null. The service matched an offer to the FIRST record of its kind, and two records
 *  alike in every field the law compares (two letters of credit, a potion bought at twice the price) are not alike to
 *  the tab that reserved one of them: the service moved the other, and the tab's next checkpoint wrote its own pack over
 *  the settle - a 100,000-gold letter kept and given at once. */
export function realmTradePickOf(/** @type {unknown} */ pick, /** @type {number} */ n) {
  if (!Array.isArray(pick) || pick.length !== n || !pick.every((i) => Number.isSafeInteger(i) && i >= 0)) return null;
  return new Set(pick).size === n ? pick : null;
}

/** A half as the service keeps it - what this side gives and what it takes, and which of its checkpoint's records it
 *  gives (realmTradePickOf) - or null. An empty-for-empty trade is none (TradeSession never locks one). */
export function realmTradeHalfOf(/** @type {any} */ v) {
  if (!plain(v)) return null;
  const give = realmTradeSideOf(v.give), get = realmTradeSideOf(v.get);
  if (!give || !get) return null;
  if (!give.items.length && !give.gold && !get.items.length && !get.gold) return null;
  const pick = realmTradePickOf(v.pick ?? [], give.items.length);
  if (!pick) return null;
  return { give, get, pick };
}

/** Do two halves describe ONE trade - each side taking exactly what the other gives? */
export const halvesAgree = (/** @type {any} */ a, /** @type {any} */ b) => canon(a.give) === canon(b.get) && canon(a.get) === canon(b.give);

/** May this record, as a save holds it, leave in a trade? systems/tradePack.js tradeRefusal's law over plain data. */
export function tradeableRecord(/** @type {any} */ rec) {
  if (!plain(rec)) return false;
  if (rec.equipSlot != null) return false;                       // worn (equip.js isEquipped)
  if (rec.questItem) return false;                               // the quest's
  if ((rec.timeForItemToDisappear ?? 0) !== 0) return false;     // summoned (inventory.js isSummoned)
  if (boundRecord(rec)) return false;                            // bound (itemBound.js isBound): its mark or its row's - AUDIT REALM F1
  if (rec.group === 'Currency' && rec.templateIndex === GOLD_PIECES_TEMPLATE) return false;   // gold (inventory.js isGoldPieces)
  if (BOAT_TEMPLATES.includes(rec.templateIndex)) return false;  // a boat's parts or deed: what it stands for stays in the giver's save - AUDIT REALM2 T1
  if (isBagItem(rec)) return false;   // BAG1: a Materials Bag - its list stays in the giver's save (tradePack.js)
  return true;
}

/** Is `rec` what `offered` describes? The offer must name a template, and every field but the volatile ones is the
 *  same on both - the offer's and the record's alike.
 *  AUDIT REALM2 S4: BOTH WAYS. The fields the offer named were compared, and then the RECORD moved - so the giver chose
 *  what was checked: an offer of a template and a material, which the receiver's window shows as a whole Daedric dagger,
 *  settled against a record at 1 of 400 condition, carrying an enchantment nobody was shown and a million characters of
 *  padding. An honest offer is its record through the wire's projection, and that projection changes only the volatile
 *  fields for anything the port mints (its clamp cuts only a string past 128, a list past 64, a nest past four). */
export function recordIsOffered(/** @type {any} */ rec, /** @type {any} */ offered) {
  if (!Number.isSafeInteger(offered?.templateIndex)) return false;
  for (const k of new Set([...Object.keys(offered), ...(plain(rec) ? Object.keys(rec) : [])])) {
    if (TRADE_VOLATILE_FIELDS.includes(k)) continue;
    if (canon(offered[k]) !== canon(rec?.[k])) return false;
  }
  // AUDIT REALM L1-F1: a letter of credit IS its value - named or not, the offer's must be the record's
  if (VALUE_IS_IDENTITY_TEMPLATES.includes(rec?.templateIndex) && canon(offered.value) !== canon(rec?.value)) return false;
  return true;
}

/**
 * TAKE ONE SIDE'S GOODS out of a save, in place: each offered record from the very record the side picked
 * (realmTradePickOf - AUDIT REALM L1-F1: never the first of its kind), when it may leave and IS what was offered, at no
 * more than it holds (a stack gives part of itself), and the gold from the purse. Answers the records as they leave -
 * the SAVE's own, at the count offered, the receiver's marks stripped - or null when the save cannot back the offer,
 * and then nothing is changed.
 * @param {any} save @param {{ items: any[], gold: number }} side @param {number[]} pick
 */
export function takeTradeGoods(save, side, pick) {
  const items = Array.isArray(save?.items) ? save.items : null;
  if (!items || realmTradePickOf(pick, side.items.length) == null) return null;
  const purse = Number.isSafeInteger(save.goldPieces) ? save.goldPieces : 0;
  if (side.gold > purse) return null;
  const left = items.map((rec) => (tradeableRecord(rec) ? recordCount(rec) : 0));   // what each record may still give
  /** @type {{ at: number, n: number }[]} */
  const picks = [];
  for (let k = 0; k < side.items.length; k++) {
    const offered = side.items[k], at = pick[k], n = recordCount(offered);
    if (!(at < items.length) || left[at] < n || !recordIsOffered(items[at], offered)) return null;
    if (JSON.stringify(items[at]).length > REALM_TRADE_RECORD_MAX) return null;   // AUDIT REALM2 S4: the record that moves, bounded
    left[at] -= n;
    picks.push({ at, n });
  }
  // every offered record was found: only now does anything move
  const moved = picks.map(({ at, n }) => {
    const rec = JSON.parse(JSON.stringify(items[at]));
    if (items[at].stackCount !== undefined || n > 1) rec.stackCount = n;
    delete rec.equipSlot; delete rec.questItem;
    return rec;
  });
  const lit = items[save.lightSourceIndex];
  save.items = items.flatMap((rec, i) => {
    if (left[i] === (tradeableRecord(rec) ? recordCount(rec) : 0)) return [rec];   // untouched
    if (left[i] <= 0) return [];
    rec.stackCount = left[i];
    return [rec];
  });
  // AUDIT REALM2 T7: `lightSourceIndex` is an index into this very list (systems/save.js), so it follows its record to
  // where that now stands, or is -1 once the record left whole - a record the tab never saves over lit the wrong item
  if (Number.isSafeInteger(save.lightSourceIndex)) save.lightSourceIndex = save.items.indexOf(lit);
  save.goldPieces = purse - side.gold;
  return moved;
}

/** PUT a side's goods into a save, in place: the records as they left the giver's save, and the gold to the purse. */
export function giveTradeGoods(/** @type {any} */ save, /** @type {any[]} */ moved, /** @type {number} */ gold) {
  if (!Array.isArray(save.items)) save.items = [];
  save.items.push(...moved);
  save.goldPieces = (Number.isSafeInteger(save.goldPieces) ? save.goldPieces : 0) + gold;
}

/**
 * THE SWAP over the two saves as the service holds them (parsed; never changed - the answer carries the new ones). `a`
 * gives `halfA.give`, which is `halfB.get`, and takes `halfB.give`. Answers `{ ok, a, b, toA, toB }` - the two saves as
 * they are now, and what each side receives, as its client applies it - or `{ why }`: 'mismatch' when the halves are
 * not one trade, 'goods' when either record cannot back its side.
 * @param {any} saveA @param {any} saveB @param {any} halfA @param {any} halfB
 */
export function settleRealmTrade(saveA, saveB, halfA, halfB) {
  if (!halvesAgree(halfA, halfB)) return { why: 'mismatch' };
  const a = JSON.parse(JSON.stringify(saveA)), b = JSON.parse(JSON.stringify(saveB));
  const fromA = takeTradeGoods(a, halfA.give, halfA.pick);
  const fromB = fromA && takeTradeGoods(b, halfB.give, halfB.pick);
  if (!fromA || !fromB) return { why: 'goods' };
  giveTradeGoods(a, fromB, halfB.give.gold);
  giveTradeGoods(b, fromA, halfA.give.gold);
  return { ok: true, a, b, toA: { items: fromB, gold: halfB.give.gold }, toB: { items: fromA, gold: halfA.give.gold } };
}

/** A refusal's words, for the side whose trade did not happen. Nothing moved, on the service or here. */
export function realmTradeRefusalText(/** @type {string} */ why) {
  switch (why) {
    case 'expired': return 'The other side never reached the realm - nothing was traded.';
    case 'mismatch': return 'The two offers did not agree - nothing was traded.';
    case 'goods': return 'The realm could not find the goods offered - nothing was traded.';
    case 'moved': return 'A character moved on before the trade was settled - nothing was traded.';
    case 'offline': return 'The realm could not be reached - nothing was traded.';
    default: return 'The realm refused the trade - nothing was traded.';
  }
}
