// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SHELF-HOLD (FIELD BUGS 2026-10-22d, bible/01-Overview/bugs/Field-Bugs-2026-10-22d.md; a private report: a piece sold
// to a shop, the game closed before it saved, and the piece was back in the pack AND on the shop's shelf for anyone to
// buy - "this also works the reverse way"): A SHOP'S SHELF SAYS ONLY WHAT THE RECORD BACKS.
//
// Online a building's shelf is the room's (world/interior/interiorShared.js, WORLD6a's whole-list law): its word goes to
// the relay at the window's open and close, in the seat's memory, and in a refused act's heal, and the relay keeps the
// memory for the next visitor. The character's pack and purse are the realm record's, written by a checkpoint - every
// five minutes (systems/online/onlineCheckpoint.js ONLINE_CHECKPOINT_MS), or as the page hides, whose put a closing
// window cuts off. A sale put the piece on the room's shelf at once and in the record minutes later: a game closed
// between left the room's shelf holding the piece and the record holding it too - a copy, on sale to every player.
//
// So a piece put on a shop's shelf FROM THE PLAYER'S OWN LISTS - a sale at the counter (DaggerfallTradeWindow's
// remoteItems, landed by worldModes.js commitTrade and the keyed list's doSell), a piece left on a shut shop's shelf
// (the stealing window, SetShopShelfStealing) - is held out of every word the room hears until a checkpoint composed
// after it has LANDED (the realm's yes on the put that carried it). Killed between, the room never heard the piece and
// the record still holds it: both stand where they stood. A stack a put merged into is said at its count before the
// put. A TAKE is said as it always was - a piece bought is checkpointed at once instead (interiorShared.js
// interiorShelfDealt), so the record holds it a round trip later and the hidden page's device copy (RESCUE-SAVE)
// carries it.
//
// This half is the ledger alone - no clock, no network, no host. Daggerfall Unity has nothing to depart from: its
// shops belong to one player and one save.
// ═══════════════════════════════════════════════════════════════════

import { piecesOf } from '../../systems/stolenGoods.js';   // a stack counts its own: the one rule the theft's basket counts by

/** How often a hold no checkpoint has released asks again while its building stands (a refused checkpoint - a duel, a
 *  journey, the death screen - or a put the service did not take). A refusal costs nothing; a put is a write, so it is
 *  never asked faster than this. */
export const SHELF_HOLD_RETRY_MS = 30_000;

/** A piece's count: one, or its stack's (systems/stolenGoods.js piecesOf). */
const countOf = (/** @type {any} */ it) => piecesOf([it]);

/**
 * The puts a building's shelves hold out of the room's word, for one visit (interiorShared.js mintInteriorShared puts one
 * on the bag). Every put is numbered as it is made; a checkpoint asked is told the number it covers (`covers()`), and
 * its landing (`landed(n)`) backs every put up to it.
 */
export function createShelfHold() {
  /** @type {WeakMap<any, { g: number, n: number }[]>} a piece -> its puts not yet backed (their number and count) */
  const putsOf = new WeakMap();
  /** @type {Map<string, number>} a shelf's key -> the number of its latest put */
  const keys = new Map();
  let made = 0;
  let backed = 0;
  /** @type {null | { target: any, canon: string, seen: Map<any, number> }} the shut shelf's window, watched */
  let watch = null;
  const countsOf = (/** @type {any[] | null | undefined} */ items) => {
    const m = new Map();
    for (const it of Array.isArray(items) ? items : []) if (it && typeof it === 'object') m.set(it, (m.get(it) ?? 0) + countOf(it));
    return m;
  };
  const hold = {
    /** A checkpoint is out (its answer not yet in). */
    asking: false,
    /** A change came while it was out: ask again once it answers. */
    again: false,
    /** A put was made since the last ask. */
    dirty: false,
    /** When the last checkpoint was asked (the host's clock). */
    askedAt: -Infinity,
    /** A piece put on the shelf `canon` (its `shelf` target) from the player's own lists - `n` of its count. */
    put(/** @type {any} */ item, /** @type {number} */ n, /** @type {string} */ canon, /** @type {any} */ shelf = null) {
      if (!item || typeof item !== 'object' || !(n > 0) || typeof canon !== 'string') return;
      const g = ++made;
      const rows = putsOf.get(item) ?? [];
      rows.push({ g, n });
      putsOf.set(item, rows);
      keys.set(canon, g);
      if (watch && shelf === watch.target) watch.seen.set(item, (watch.seen.get(item) ?? 0) + n);   // put by a door, not a window: never counted twice
      hold.dirty = true;
    },
    /** How much of this piece's count the room may not hear yet. */
    withheld(/** @type {any} */ item) {
      const rows = item && typeof item === 'object' ? putsOf.get(item) : null;
      if (!rows) return 0;
      let n = 0;
      for (const r of rows) if (r.g > backed) n += r.n;
      if (n === 0) putsOf.delete(item);
      return n;
    },
    /** What the room hears of a shelf: its pieces less every put not yet backed - a piece put whole is left out, a stack
     *  a put merged into is said at its count before it. A watched shelf is looked at first, so no put is ever said
     *  before it is counted. */
    heard(/** @type {any} */ target, /** @type {string} */ canon) {
      if (watch && target === watch.target) hold.look();
      const out = [];
      for (const it of Array.isArray(target?.items) ? target.items : []) {
        const w = hold.withheld(it);
        if (w === 0) { out.push(it); continue; }
        const n = countOf(it) - w;
        if (n > 0) out.push({ ...it, stackCount: n });
      }
      return out;
    },
    /** The number a checkpoint composed now covers. */
    covers: () => made,
    /** A checkpoint that covered `g` landed: the shelves whose every put it backs, now said whole. */
    landed(/** @type {number} */ g) {
      if (!(g > backed)) return [];
      backed = g;
      const out = [];
      for (const [k, at] of keys) if (at <= backed) { out.push(k); keys.delete(k); }
      return out;
    },
    /** Whether a put waits for a landing. */
    get waiting() { return made > backed; },
    /** The shut shelf's window (`target`, `canon`): every piece its shelf gains while it is open came out of the
     *  player's own lists - there is no basket there - and is a put. Counted from what it holds now. */
    watch(/** @type {any} */ target, /** @type {string} */ canon) {
      watch = target && typeof canon === 'string' ? { target, canon, seen: countsOf(target.items) } : null;
    },
    /** Its window is gone: looked at a last time, then let go. */
    unwatch() { if (watch) { hold.look(); watch = null; } },
    get watching() { return watch?.canon ?? null; },
    /** The watched shelf looked at: each piece it gained since it was last looked at is put. Answers whether one was. */
    look() {
      if (!watch) return false;
      const now = countsOf(watch.target.items);
      let any = false;
      for (const [it, c] of now) {
        const was = watch.seen.get(it) ?? 0;
        if (c > was) { hold.put(it, c - was, watch.canon); any = true; }
      }
      watch.seen = now;
      return any;
    },
  };
  return hold;
}
