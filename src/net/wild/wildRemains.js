// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md) - THE ROOM'S REMAINS, ON MY SIDE.
//
// The room's object keeps every remains (net/wild/wildLaw.js) and says them to me (`ri` chunks at my hello and at each new
// fall, `rm` as records leave, `gone` when one is no more). Here they become ordinary ground piles in whichever host I
// stand in (scenes/droppedLoot.js's pool - the street's, a building's, a dungeon's: THE FOUR HOSTS RULE's three online
// hosts; the fixed city is offline and has none), so they are drawn, aimed at and opened with the very window every
// pile opens with - the Enhanced Plus pack, or the classic one under GrimoireUI's dress - and nothing new to learn.
//
// A TAKE IS THE ROOM'S TO GRANT. The window moves a record out of the pile into my pack as it moves any pile's; this
// book SEES it leave (each frame it compares the pile with what the room said) and, at once:
//   - takes what arrived back OUT of my pack (the piece, or the count of it that merged into a stack of mine), and
//   - asks the room for it (`take`, the record's index and the count).
// The room answers `got` with the record - it goes into my pack then - or `no` (someone was first): nothing to give
// back, because nothing was kept. So a take is never a copy, whatever the window did and however the race went.
// Nothing can be PUT on remains: the pile says it can carry nothing (its `noStore`, droppedLootHooks' capacity).
//
// MINE: a remains whose owner the room named as me (my account, or my peer id for a guest) is marked - its pile's
// line of light (scenes/lootLines.js) and the world map's mark - so I can find my things again.
//
// INT9: THE KILLER'S PIECE. A remains the account service signed for a fall at another player's hand holds the worn piece
// the killer picked off the body (the room's `wk` and `wi`: whose, and which record) - the room grants it to that account
// alone. So it is no pile of anyone else's, and the killer's own game asks for it the moment the room says it: their
// pick off the body was the choice, and this is the piece arriving.
//
// MAC'S DECISION (2026-10-14, "Yes, build it" - the two-phase handoff): where the service holds that piece in ESCROW, the
// room hands no record for it - it answers the killer's ask with its signed COLLECT (`cr`, net/wild/wildReceipt.js `g1`), and
// this book hands that to the host (`collect`), whose tab carries it to the service: the piece arrives as the service's
// answer, committed to the killer's record (server-account/src/wild.js wildCollect), never as the room's copy of it.
//
// The host hands in everything this touches (the pool, the frame, the pack, the clock, the socket), so the pins drive
// it with fakes. The pile's `items` are minted through the item law the host hands in (systems/loot/loot.js validLootList)
// - all but the coin, minted by its count (REMAINS-GOLD, below).
//
// FIELD BUGS 2026-10-20h (bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md), "the PvP remains and gold pile":
//   - REMAINS-GOLD: the gold a death drops is ONE pile, half the purse and the cart's coin (systems/wild/wildDropLaw.js
//     takeWildGold), and the host's mint is the stranger's projection, whose stack bound is the wire's 65,535
//     (loot.js LOOT_STACK_MAX). A pile past it was no item there: it never stood, and the gold lay in the room for nobody.
//   - REMAINS-TAKE: a pile stands AS THE ROOM HOLDS IT, LESS MY TAKES IN FLIGHT. The room answers my take with `got` and
//     then says its `rm` to everyone, me too; the `got` had already ended the take, so a take of part of a stack - the
//     gold a pack has no room for (CanCarryAmount, DaggerfallInventoryWindow.cs:1414-1422; the how-many popup's split,
//     DaggerfallInventoryWindow.cs:1510-1559) - was taken off the pile twice.
// ═══════════════════════════════════════════════════════════════════
import { WILD_REMAINS_ITEMS_MAX } from '../wire.js';
import { WILD_TEXT } from '../../systems/wild/wildZone.js';
import { goldStack, isGoldPieces } from '../../systems/inventory.js';
import { GOLD_INT_MAX } from '../../systems/item/itemLaw.js';

/** The pile's icon: the treasure flat a dropped pile wears (archive 216's sack, randomTreasureIconIndices' first). */
export const WILD_PILE_ICON = Object.freeze({ archive: 216, record: 0 });
/** What a remains pile says when something is put on it. */
export const WILD_NO_STORE = Object.freeze({ kg: 0, name: 'These remains' });

/**
 * @param {object} o
 * @param {(data: any, room?: string|null) => boolean} o.send   online.sendWild - a take to the room that keeps the pile (HALO-REMAINS)
 * @param {() => any} o.pool                                the host's dropped-loot pool I stand in now (or null)
 * @param {(p: number[]) => number[]} o.toScene              a room point to this scene's
 * @param {(rec: { os: string|null, oid: string|null }) => boolean} o.mine   is this remains mine
 * @param {() => any[]} o.pack                              my pack's list (entity.items)
 * @param {(list: any[]) => any[]|null} o.mint              the wire's records to items (validLootList)
 * @param {(list: any[], item: any) => any} o.addItem        the pack's add (inventory.js addItem - it stacks)
 * @param {(a: any, b: any) => boolean} o.stacksWith         the pack's stack rule (inventory.js stacksWith)
 * @param {(item: any) => void} [o.unequip]                  take a piece off before it leaves the pack
 * @param {(n: number) => number} [o.unpurse]               take n gold back out of the purse; how much was there
 * @param {(rec: any) => boolean} [o.canTake]              may I take from this remains
 * @param {(text: string) => void} [o.say]
 * @param {() => number} [o.now]                            a monotonic clock, ms
 * @param {(item: any) => string} [o.nameOf]
 * @param {() => string|null} [o.me]                       my account, as the relay knows it (INT9: the killer's piece)
 * @param {(cr: string, at: { r: string, i: number, rec: any }) => void} [o.collect]   MAC (2026-10-14): the room's collect of
 *   my piece in escrow, for the host to carry to the service (once a remains)
 */
export function createWildRemains({ send, pool, toScene, mine, pack, mint, addItem, stacksWith, unequip = () => {}, unpurse = () => 0, canTake = () => true, say = () => {}, now = () => Date.now(), nameOf = () => 'it', me = () => null, collect = () => {} }) {
  /** @type {Map<string, any>} */
  const recs = new Map();     // r -> { r, p, nm, os, oid, until, items[], end, pile, seen: Map<obj, {i, n}>, mine }
  // HALO-REMAINS: the rooms I hold - my own and the halo's (the cells beside mine); each record is its room's
  let rooms = new Set();
  let poolNow = null;
  /** @type {Map<string, number[]>} */
  const asked = new Map();    // `${r}:${i}` -> the counts of my takes in flight, in the order asked (the room answers in order)
  const ask = (/** @type {string} */ key, /** @type {number} */ n) => { const l = asked.get(key); if (l) l.push(n); else asked.set(key, [n]); };
  /** One take answered (`got`, `no`, `cr`): the oldest in flight. */
  const answered = (/** @type {string} */ key) => { const l = asked.get(key); if (!l) return; l.shift(); if (!l.length) asked.delete(key); };
  /** REMAINS-TAKE: how much of record `i` my takes in flight hold - the pile stands without it. */
  const inFlight = (/** @type {string} */ r, /** @type {number} */ i) => (asked.get(`${r}:${i}`) ?? []).reduce((a, n) => a + n, 0);
  const countOf = (/** @type {any} */ it) => Math.max(1, it?.stackCount ?? 1);
  /**
   * REMAINS-GOLD: ONE RECORD MINTED. A coin pile is minted by its count (inventory.js goldStack - the service's own minter,
   * wildDropLaw.js takeWildGold), any whole count to the item law's one count (itemLaw.js GOLD_INT_MAX): DFU keeps a pile's
   * count in an int (DaggerfallUnityItem.cs:51; ItemBuilder.CreateGoldPieces, ItemBuilder.cs:790-797). The remains are the
   * service's word, never a peer's - the room says a remains only once its records digest to the service's order (INT9,
   * net/wild/wildLaw.js) - so the wire's 65,535 (the stranger's bound, HACKED-GOLD) is not theirs. Every other record is
   * the host's mint.
   */
  const mintOne = (/** @type {any} */ r) => {
    if (!isGoldPieces(r)) return mint([r])?.[0] ?? null;
    const n = r.stackCount ?? 1;
    return Number.isSafeInteger(n) && n >= 1 && n <= GOLD_INT_MAX ? goldStack(n) : null;
  };

  const unseed = (rec) => {
    if (rec.pile) { try { rec.poolOf?.removePile(rec.pile); } catch { /* a pool torn down already */ } }
    rec.pile = null; rec.poolOf = null; rec.seen = new Map();
  };
  /** A record's pile in the pool I stand in: what is left of it, minted, each item remembered with its place. REMAINS-TAKE:
   *  what is left is the room's word less my takes in flight. */
  const seed = (rec) => {
    settle(rec);   // REMAINS-TAKE: a take the window made off the pile standing now is asked before it goes
    unseed(rec);
    const p = poolNow;
    if (!p || rec.items.every((it) => it == null)) return;
    if (!canTake(rec)) return;   // PVPDUNGEONS: a party's or a guild's member's remains are no pile of mine to take
    const live = [];
    const seen = new Map();
    for (let i = 0; i < rec.items.length; i++) {
      const r = rec.items[i];
      if (!r || i === rec.wi) continue;   // INT9: the killer's piece is no pile's - theirs comes by itself (onWord)
      const n = countOf(r) - inFlight(rec.r, i);
      const minted = n > 0 ? mintOne(r) : null;
      if (!minted) continue;
      if (n !== countOf(minted)) minted.stackCount = n;
      live.push(minted);
      seen.set(minted, { i, n });
    }
    if (!live.length) return;
    // PVPFIX (the owner: \"place the pile next to the body not on top of it\" - on top it was hidden in the body and could not be aimed at):
    // a fixed step to the side of where they fell, the same for every client
    const f0 = toScene(rec.p);
    const feet = [f0[0] + 1.8, f0[1], f0[2] + 1.2];
    const pile = p.seedPile(live, feet, WILD_PILE_ICON, null, null, { unsaved: true, owner: 'wild' });
    pile.noStore = WILD_NO_STORE;   // droppedLootHooks: nothing is put on remains
    pile.wild = { r: rec.r, name: rec.nm, mine: rec.mine };
    pile.label = rec.mine ? WILD_TEXT.mine : WILD_TEXT.remainsName(rec.nm);   // the plaque's name for it (droppedLoot labelFor)
    rec.pile = pile; rec.poolOf = p; rec.seen = seen;
  };
  /** Take `n` of `item` back out of my pack - the very record, or (it merged) as much of a stack it joined. */
  const lift = (item, n) => {
    const list = pack() ?? [];
    let left = n;
    const at = list.indexOf(item);
    if (at >= 0) {
      const have = Math.max(1, item.stackCount ?? 1);
      if (have <= left) { try { unequip(item); } catch { /* not worn */ } list.splice(at, 1); left -= have; }
      else { item.stackCount = have - left; left = 0; }
    }
    for (let i = list.length - 1; i >= 0 && left > 0; i--) {
      const held = list[i];
      if (held === item || !stacksWith(held, item)) continue;
      const have = Math.max(1, held.stackCount ?? 1);
      if (have <= left) { try { unequip(held); } catch { /* not worn */ } list.splice(i, 1); left -= have; }
      else { held.stackCount = have - left; left = 0; }
    }
    if (left > 0 && item?.group === 'Currency') left -= unpurse(left);   // WILD GOLD: the window's take of coin went to the purse
  };
  /** What the window took off a record's pile since the last look - lifted back out of my pack and asked of the room. The
   *  host's frame looks (tick), and so does a room word before it moves the pile (REMAINS-TAKE: a word that came between a
   *  take and the frame set the piece's count over a take nothing had asked yet - a copy, the room's and mine). */
  const settle = (rec) => {
    if (!rec.pile || rec.pile.dead) return;
    for (const [obj, info] of [...rec.seen]) {
      const there = rec.pile.items.includes(obj);
      const cur = there ? Math.max(0, obj.stackCount ?? 1) : 0;
      if (cur >= info.n) continue;
      const k = info.n - cur;
      lift(obj, k);
      if (!send({ k: 'take', r: rec.r, i: info.i, n: k }, rec.room)) {   // HALO-REMAINS: to the room that keeps it
        // the ask never left (the socket, the gate): it goes back on the pile as it was, and nothing was lost
        obj.stackCount = info.n > 1 || obj.stackCount != null ? info.n : obj.stackCount;
        if (!there) rec.pile.items.push(obj);
        continue;
      }
      ask(`${rec.r}:${info.i}`, k);
      info.n = cur;
      if (!there) rec.seen.delete(obj);
    }
  };
  /** REMAINS-TAKE: record `i`'s piece on the pile, IN PLACE (a window may stand open on it), as the room holds it less my
   *  takes in flight - its count set, or the piece gone at nothing. My own take's `rm` moves nothing so: the `got` before
   *  it ended the take, and the room's word took the same count off. */
  const follow = (rec, i) => {
    if (!rec.pile || rec.pile.dead) return;
    const want = (rec.items[i] ? countOf(rec.items[i]) : 0) - inFlight(rec.r, i);
    for (const [obj, info] of rec.seen) {
      if (info.i !== i) continue;
      if (want > 0) { if (want !== info.n) { obj.stackCount = want; info.n = want; } }
      else { const at = rec.pile.items.indexOf(obj); if (at >= 0) rec.pile.items.splice(at, 1); rec.seen.delete(obj); }
      break;
    }
    if (!rec.pile.items.length) unseed(rec);
  };

  /** INT9 (AUDIT): every remains' id said here this life - a killer's seizure is never asked of one its fallen laid. */
  const saidIds = new Set();
  /** MAC (2026-10-14): the remains whose collect this book has handed the host - once each, however often the room says it. */
  const collected = new Set();
  /** INT9: the piece I picked off a fallen's body, asked of the room - the whole of it, once it has left. */
  const askMine = (/** @type {any} */ rec) => {
    const it = rec.wk && rec.wk === me() ? rec.items[rec.wi] : null;
    const key = `${rec.r}:${rec.wi}`;
    if (it && !asked.has(key) && send({ k: 'take', r: rec.r, i: rec.wi, n: countOf(it) }, rec.room)) ask(key, countOf(it));   // HALO-REMAINS: to the room that keeps it
  };

  const book = {
    /** The remains I may see now, for the maps (mine marked): `{ r, p, nm, mine, until }`. */
    list() { return [...recs.values()].filter((r) => r.items.some(Boolean)).map((r) => ({ r: r.r, p: r.p, nm: r.nm, mine: r.mine, until: r.until })); },
    /** INT9: has remains `r` been said in this room (a killer's seizure waits on it) - AUDIT INT9: ever, an emptied one too. */
    has(r) { return recs.has(r) || saidIds.has(r); },
    /** Mine, in this room. */
    mineHere() { return book.list().filter((r) => r.mine); },
    /** Whether any remains of mine stand here - the loot lines' door with the rarity row off (scenes/lootLines.js). */
    hasMine() { for (const r of recs.values()) if (r.mine && r.items.some(Boolean)) return true; return false; },
    /** The room I stand in changed (or I left the world): every pile goes; the new room says its own at its hello. */
    setRoom(key) { book.setRooms(key == null ? [] : [key]); },
    /** HALO-REMAINS: the rooms I hold now (my own and the halo's). A room let go takes its piles; a room still held
     *  keeps them - a crossing into a halo's cell PROMOTES its socket, and no hello says its remains again. */
    setRooms(keys) {
      const next = new Set((keys ?? []).filter((k) => k != null));
      if (next.size === rooms.size && [...next].every((k) => rooms.has(k))) return;
      rooms = next;
      for (const rec of [...recs.values()]) {
        if (rooms.has(rec.room)) continue;
        unseed(rec); recs.delete(rec.r);
        for (const k of [...asked.keys()]) if (k.startsWith(`${rec.r}:`)) asked.delete(k);
      }
    },
    /** The host I stand in changed under the same room (a recentre, a mode): the piles are stood again in its pool. */
    setPool(p) {
      if (p === poolNow) return;
      poolNow = p;
      for (const rec of recs.values()) seed(rec);
    },
    /** The room's word (net/wire.js validWildOut) - `from` the room that said it (mine, when there is one and none is named). */
    onWord(w, from = rooms.size === 1 ? [...rooms][0] : null) {
      if (w.k === 'ri') {
        let rec = recs.get(w.r);
        if (!rec) {
          rec = { r: w.r, room: from, p: w.p, nm: w.nm, os: w.os, oid: w.oid, until: now() + w.ttl, items: [], end: 0, pile: null, poolOf: null, seen: new Map(), mine: false, wk: typeof w.wk === 'string' ? w.wk : null, wi: Number.isInteger(w.wi) ? w.wi : -1 };
          rec.mine = !!mine(rec);
          recs.set(w.r, rec);
        }
        for (let k = 0; k < w.items.length && w.off + k < WILD_REMAINS_ITEMS_MAX; k++) rec.items[w.off + k] = w.items[k] ?? null;
        rec.end = w.end;
        rec.until = now() + w.ttl;
        saidIds.add(w.r);
        if (saidIds.size > 64) saidIds.delete(saidIds.values().next().value);
        seed(rec);
        askMine(rec);   // INT9: the piece I picked off this fallen's body - asked for at once, the whole of it
        return;
      }
      const rec = recs.get(w.r);
      if (w.k === 'gone') { if (rec) { unseed(rec); recs.delete(w.r); } return; }
      if (w.k === 'rm') {
        if (!rec || !rec.items[w.i]) return;
        settle(rec);   // REMAINS-TAKE: what the window took since the frame's look, asked before the room's word moves the pile
        const it = rec.items[w.i];
        const stack = countOf(it);
        if (w.n >= stack) rec.items[w.i] = null; else rec.items[w.i] = { ...it, stackCount: stack - w.n };
        // the pile follows IN PLACE (a window may stand open on it): the room's count less my takes in flight - REMAINS-TAKE:
        // it skipped every `rm` while a take of mine was in flight and subtracted any other from what it showed, so my
        // own take's `rm`, heard after its `got`, came off the pile a second time
        follow(rec, w.i);
        return;
      }
      answered(`${w.r}:${w.i}`);
      if (w.k === 'cr') {
        // MAC (2026-10-14): MY COLLECT - the piece the service holds in escrow is mine once the service commits it; the
        // room's record of it is nobody's to add
        const it = rec && w.i === rec.wi && rec.wk === me() ? rec.items[w.i] : null;
        if (rec && w.i === rec.wi && rec.wk === me()) rec.items[w.i] = null;   // never asked again
        if (!collected.has(w.r)) {
          collected.add(w.r);
          if (collected.size > 64) collected.delete(collected.values().next().value);
          try { collect(w.cr, { r: w.r, i: w.i, rec: it }); } catch { /* the host's */ }
        }
        return;
      }
      if (w.k === 'got') {
        if (rec && w.i === rec.wi && rec.wk === me()) rec.items[w.i] = null;   // AUDIT INT9: mine, whole - never asked again before the room's `rm`
        const item = mintOne(w.it);   // REMAINS-GOLD: a coin pile by its count
        if (item) { addItem(pack(), item); say(`You take ${nameOf(item)}.`); }
      } else if (w.k === 'no') {
        say('Someone took that first.');   // nothing comes back: nothing was kept (the room's `rm` for the winner's take moved the pile)
      }
    },
    /** The host's frame: a pile the window took from is asked of the room; a remains whose time is up goes. */
    tick() {
      const t = now();
      for (const rec of [...recs.values()]) {
        if (t >= rec.until) { unseed(rec); recs.delete(rec.r); continue; }
        askMine(rec);   // AUDIT INT9: an ask that never left (the socket, the gate) is asked again - it was asked once, at the word
        // a pile its pool let go under me (a building's cache restored, a dungeon rebuilt) is stood again from the room's word
        if (!rec.pile || rec.pile.dead) { rec.pile = null; if (poolNow && rec.items.some(Boolean)) seed(rec); continue; }
        settle(rec);
      }
    },
    /** Every pile down (the host is going). */
    clear() { for (const rec of recs.values()) unseed(rec); recs.clear(); asked.clear(); rooms = new Set(); },
  };
  return book;
}
