// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md) - THE ROOM'S REMAINS, ON MY SIDE.
//
// The room's object keeps every remains (net/wildLaw.js) and says them to me (`ri` chunks at my hello and at each new
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
// The host hands in everything this touches (the pool, the frame, the pack, the clock, the socket), so the pins drive
// it with fakes. The pile's `items` are minted through the item law the host hands in (systems/loot.js validLootList).
// ═══════════════════════════════════════════════════════════════════
import { WILD_REMAINS_ITEMS_MAX } from './wire.js';
import { WILD_TEXT } from '../systems/wildZone.js';

/** The pile's icon: the treasure flat a dropped pile wears (archive 216's sack, randomTreasureIconIndices' first). */
export const WILD_PILE_ICON = Object.freeze({ archive: 216, record: 0 });
/** What a remains pile says when something is put on it. */
export const WILD_NO_STORE = Object.freeze({ kg: 0, name: 'These remains' });

/**
 * @param {object} o
 * @param {(data: any) => boolean} o.send                  online.sendWild
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
 */
export function createWildRemains({ send, pool, toScene, mine, pack, mint, addItem, stacksWith, unequip = () => {}, unpurse = () => 0, canTake = () => true, say = () => {}, now = () => Date.now(), nameOf = () => 'it', me = () => null }) {
  /** @type {Map<string, any>} */
  const recs = new Map();     // r -> { r, p, nm, os, oid, until, items[], end, pile, seen: Map<obj, {i, n}>, mine }
  let room = null;
  let poolNow = null;
  /** @type {Map<string, number>} */
  const asked = new Map();    // `${r}:${i}` -> takes in flight

  const unseed = (rec) => {
    if (rec.pile) { try { rec.poolOf?.removePile(rec.pile); } catch { /* a pool torn down already */ } }
    rec.pile = null; rec.poolOf = null; rec.seen = new Map();
  };
  /** A record's pile in the pool I stand in: what is left of it, minted, each item remembered with its place. */
  const seed = (rec) => {
    unseed(rec);
    const p = poolNow;
    if (!p || rec.items.every((it) => it == null)) return;
    if (!canTake(rec)) return;   // PVPDUNGEONS: a party's or a guild's member's remains are no pile of mine to take
    const live = [];
    const seen = new Map();
    for (let i = 0; i < rec.items.length; i++) {
      const r = rec.items[i];
      if (!r || i === rec.wi) continue;   // INT9: the killer's piece is no pile's - theirs comes by itself (onWord)
      const minted = mint([r])?.[0] ?? null;
      if (!minted) continue;
      live.push(minted);
      seen.set(minted, { i, n: Math.max(1, minted.stackCount ?? 1) });
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

  /** INT9 (AUDIT): every remains' id said here this life - a killer's seizure is never asked of one its fallen laid. */
  const saidIds = new Set();
  /** INT9: the piece I picked off a fallen's body, asked of the room - the whole of it, once it has left. */
  const askMine = (/** @type {any} */ rec) => {
    const it = rec.wk && rec.wk === me() ? rec.items[rec.wi] : null;
    const key = `${rec.r}:${rec.wi}`;
    if (it && !asked.has(key) && send({ k: 'take', r: rec.r, i: rec.wi, n: Math.max(1, it.stackCount ?? 1) })) asked.set(key, 1);
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
    setRoom(key) {
      if (key === room) return;
      room = key;
      for (const rec of recs.values()) unseed(rec);
      recs.clear(); asked.clear();
    },
    /** The host I stand in changed under the same room (a recentre, a mode): the piles are stood again in its pool. */
    setPool(p) {
      if (p === poolNow) return;
      poolNow = p;
      for (const rec of recs.values()) seed(rec);
    },
    /** The room's word (net/wire.js validWildOut). */
    onWord(w) {
      if (w.k === 'ri') {
        let rec = recs.get(w.r);
        if (!rec) {
          rec = { r: w.r, p: w.p, nm: w.nm, os: w.os, oid: w.oid, until: now() + w.ttl, items: [], end: 0, pile: null, poolOf: null, seen: new Map(), mine: false, wk: typeof w.wk === 'string' ? w.wk : null, wi: Number.isInteger(w.wi) ? w.wi : -1 };
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
        const it = rec.items[w.i];
        const stack = Math.max(1, it.stackCount ?? 1);
        if (w.n >= stack) rec.items[w.i] = null; else rec.items[w.i] = { ...it, stackCount: stack - w.n };
        // the pile follows IN PLACE (a window may stand open on it) - unless my own take already moved it (the
        // window's, then my ask's: the room's word on it is that ask's)
        if (asked.has(`${w.r}:${w.i}`)) return;
        for (const [obj, info] of rec.seen) {
          if (info.i !== w.i) continue;
          const left = info.n - w.n;
          if (left > 0) { obj.stackCount = left; info.n = left; }
          else { const at = rec.pile?.items.indexOf(obj) ?? -1; if (at >= 0) rec.pile.items.splice(at, 1); rec.seen.delete(obj); }
          break;
        }
        if (rec.pile && !rec.pile.items.length) unseed(rec);
        return;
      }
      const key = `${w.r}:${w.i}`;
      const left = (asked.get(key) ?? 1) - 1;
      if (left > 0) asked.set(key, left); else asked.delete(key);
      if (w.k === 'got') {
        if (rec && w.i === rec.wi && rec.wk === me()) rec.items[w.i] = null;   // AUDIT INT9: mine, whole - never asked again before the room's `rm`
        const item = mint([w.it])?.[0] ?? null;
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
        for (const [obj, info] of [...rec.seen]) {
          const there = rec.pile.items.includes(obj);
          const cur = there ? Math.max(0, obj.stackCount ?? 1) : 0;
          if (cur >= info.n) continue;
          const k = info.n - cur;
          lift(obj, k);
          if (!send({ k: 'take', r: rec.r, i: info.i, n: k })) {
            // the ask never left (the socket, the gate): it goes back on the pile as it was, and nothing was lost
            obj.stackCount = info.n > 1 || obj.stackCount != null ? info.n : obj.stackCount;
            if (!there) rec.pile.items.push(obj);
            continue;
          }
          const key = `${rec.r}:${info.i}`;
          asked.set(key, (asked.get(key) ?? 0) + 1);
          info.n = cur;
          if (!there) rec.seen.delete(obj);
        }
      }
    },
    /** Every pile down (the host is going). */
    clear() { for (const rec of recs.values()) unseed(rec); recs.clear(); asked.clear(); room = null; },
  };
  return book;
}
