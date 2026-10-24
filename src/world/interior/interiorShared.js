// WORLD6a (Mac, 2026-09-14: "Lets tackle #1 next" - towns, cells and
// buildings keep nothing): THE BUILDING IS A WORLD ROOM. A building
// interior has had a relay room of its own since ONLINE1
// (`interior:m<mapId>.<buildingKey>`, net/online.js roomKeyFor) and
// carried presence alone, because the wire's world-room law admitted
// dungeons only. Slice 6a widens the law to interiors and gives the
// interior mode what the dungeon context has had since WORLD1, 3 and 4:
// a MEMORY the host publishes and a joiner restores, the doors as ACTS,
// and a container the room has opened as the ROOM'S.
//
// This module is the pure half - the composition, the projection and the
// landing - so it can be executed on a bare context in a test; the
// interior mode (scenes/worldModes.js) owns the live wiring (the seen
// set, the stamp, the open window, the publish clock) and hands it in.
//
// THE MEMORY MIRRORS THE DUNGEON'S, subtracted the same way:
// - the ACTIONS (doors, and whatever action objects the block carries)
//   as the SHARED record - the picker's own latch stays home (AUDIT
//   WORLD3 B1, `sharedRecord`), and a record off the wire is projected
//   before it lands (AUDIT WORLD3 A2 / WORLD34 C2, `validActionRecord`);
// - the LOOT as WORLD4's law: a shelf or a container NOBODY has opened
//   stays every client's own lazy roll (`items: null`, the cache's own
//   idiom) and the memory says nothing of it; one the room has opened is
//   the room's, with what is left in it and THE DAY IT WAS STOCKED (`d`)
//   - the restock is a day comparison (A2, shopStock needsRestock), the
//   day is the world's (WORLD5), so the day rides the record and every
//   client agrees on when the shelf turns over;
// - nothing of the player's own: the dropped piles and the treasure
//   markers' piles (AUDIT WORLD B3 - a drop is the dropper's; a treasure
//   roll reads the player's level and gender) stay in the scene cache
//   and off the wire. The interior's foes and guards are a quest's or a
//   crime's - the player's own - and are not streamed (recorded).
//
// OUTDOOR-LOOT (2026-10-17, test-harness/outdoor-loot/DESIGN.md section 4): A CUPBOARD IS NO LONGER A WHOLE LIST. WORLD6a's word
// for a container was its list, landed over the reader's by whoever wrote last - a stale close brought a taken piece back
// (a dupe) and erased a put (a loss), and LOOT-BULK made one such close a whole cupboard. A `container:` is now the room's ONE
// list: its first roll a carried base, its word PARTY-LOOT's takes, every take a claim the building's seat judges
// (interiorRoomLoot.js - the cupboards' room law, which `bag.room` holds). This module keeps the doors the host calls
// (interiorLootOpen, interiorLootFrame, interiorLootUnborn, interiorLootRoll and their kin) and the vocabulary; a `shelf:` keeps
// WORLD6a's whole-list law exactly (a purchase is a trade, not a take - DESIGN 4.7, and the shut shop's stealing window has the
// cupboard's race: the recorded follow-up F-1).
//
// HOME1 (2026-09-25): AN ONLINE HOME'S ROOM CARRIES NO LOOT AT ALL. Its
// owner and whoever they let in stand in it together (presence and the
// doors), but its cupboards are the owner's storage, kept in the owner's
// own save - so the memory says nothing of them, a peer's word about one
// never lands (a word about `container:3` would have overwritten the
// owner's chest, and then been published back as the room's), and a
// refused act's records name none. The bag's `home` says so.
import { sharedRecord, validActionRecord } from '../actionSystem.js';
import { validLootList, LOOT_LIST_MAX, LOOT_NEWER_TEXT } from '../../systems/loot/loot.js';   // LOOT_NEWER_TEXT: AUDIT SETS M2 - a shelf the room has spoken about in words this build cannot read
import { peerHanded } from '../../systems/peerWord.js';   // SS3: a bound piece in a room's container never lands; HACKED-GOLD: nor a letter of credit (systems/peerWord.js)
import { clearStolen } from '../../systems/stolenGoods.js';   // STOLEN-GOODS AUDIT S3: a shelf's or a cupboard's piece is its owner's, never stolen
import { mintSharedStamp } from '../../net/wire.js';   // AUDIT WORLD6a B7: one stamp mint at the wire, twelve digits always
import { createInteriorRoomLoot } from './interiorRoomLoot.js';   // OUTDOOR-LOOT: the cupboards' room law

/** The room's own key for a building - the SAME spelling roomKeyFor mints for the relay room (the map id unsigned,
 *  AUDIT WORLD34 A2), so the memory's `locationKey` and the room agree by construction. */
export function interiorLocationKey(mapId, buildingKey, layout = null) {
  const id = Number.isFinite(mapId) ? mapId >>> 0 : 0;
  const key = Number.isFinite(buildingKey) ? buildingKey >>> 0 : 0;
  return id > 0 && key > 0 ? `interior:m${id}.${layoutRoomKey(key, layout)}` : null;
}

/** WD3 (AUDIT WD3 B3): A BUILDING'S ROOM IS ITS LAYOUT'S. A building key names a building only in one layout of its
 *  town, so two players whose town stands in two layouts (a build from before the town mods; a pin one holds) would
 *  share one room from two buildings - its doors, its chests, its memory - and a memory the relay kept from before the
 *  mods would land on another building of the same key. The layout mods serving the town ride in the key's high bits
 *  (a building key is under 2^19; the wire's room takes eight digits): Daggerfall's own town is the key as it always
 *  was, so its rooms and their memories are untouched. */
export const LAYOUT_ROOM_MODS = Object.freeze(['beautiful-villages', 'beautiful-cities']);
export function layoutRoomKey(buildingKey, layout = null) {
  let tag = 0;
  if (typeof layout === 'string') LAYOUT_ROOM_MODS.forEach((m, i) => { if (layout.split('+').some((p) => p.split('@')[0] === m)) tag |= 1 << i; });
  return buildingKey + tag * 0x1000000;
}

/** AUDIT WORLD6a A1: THE WIRING BAG, MINTED HERE. The interior mode built its bag with the key spelled `key` and
 *  handed the whole bag to composeInteriorShared, which read `locationKey` - so a building's memory was NEVER
 *  published: every publish answered null, the relay stored nothing for any interior room, and no joiner was ever
 *  handed the building as the host left it, while the only pin on the call site was a source regex that matched
 *  the broken line verbatim. The field names live in ONE home now, the bag is minted here, and the pin executes
 *  the composition through it. `owned`: an owned house (or any ship interior - DFU does not distinguish ships, so
 *  owning one owns them all, and two players in one hull would disagree about whether the room exists) keeps NO
 *  room at all: no key, no memory, no presence room either (the host reports a 0 building key). */
export function mintInteriorShared(locationKey, { owned = false, home = false, net = null } = {}) {
  const bag = { locationKey: owned ? null : (locationKey ?? null), owned: !!owned, home: !!home, stamp: mintSharedStamp(), seen: new Set(), tooBig: new Set(), unreadable: new Set(), applied: false, openKey: null, openWin: null, net, room: null };   // AUDIT SETS M2: `unreadable` the containers whose room word this build cannot read; OUTDOOR-LOOT: `net` the host's wiring (the act path, the clocks, the seat, the player's hands) and `room` the cupboards' room law
  if (net && !bag.owned && !bag.home && bag.locationKey) bag.room = createInteriorRoomLoot(net, bag);   // HOME1: a home's cupboards are its owner's; an owned house or ship keeps no room - the module is inert there, as the bag is
  return bag;
}

/** The container vocabulary a building shares - the cache's own keys (`shelf:<i>`, `container:<i>`, worldModes
 *  cacheInteriorScene), one spelling per container (AUDIT WORLD4 C4). */
const LOOT_KEY_RE = /^(shelf|container):(0|[1-9][0-9]{0,4})$/;
export function interiorLootKeyOf(key) {
  if (typeof key !== 'string') return null;
  const m = LOOT_KEY_RE.exec(key);
  return m ? `${m[1]}:${Number(m[2])}` : null;
}

/** The shelf or container a loot key names on this context, or null. */
export function interiorLootTarget(ctx, key) {
  const canon = interiorLootKeyOf(key);
  if (!canon || !ctx) return null;
  const [kind, iStr] = canon.split(':');
  const list = kind === 'shelf' ? ctx.shelves : ctx.containers;
  return (Array.isArray(list) && list[Number(iStr)]) || null;
}

/** What this client would tell the room about these containers RIGHT NOW - opened ones alone (`items` an array),
 *  each under the cap the reader obeys (AUDIT WORLD4 A2/B2/D1: what cannot be said is not said, once, out loud, and
 *  the container stays this player's own). `tooBig` is the caller's said-once set. OUTDOOR-LOOT: a cupboard the room
 *  holds (`bag.room`, a live seat) says the module's word - the seat's state, a claimer's claims in flight - never its list;
 *  a shelf, and a cupboard no room holds (a bare context, an offline page), say the whole list as WORLD6a built it. */
export function interiorLootRecords(ctx, keys, tooBig = new Set(), bag = null) {
  const out = [];
  for (const key of keys ?? []) {
    const canon = interiorLootKeyOf(key);
    if (canon && canon.startsWith('container:') && bag?.room?.live()) { out.push(...bag.room.records(ctx, canon)); continue; }
    const t = canon && interiorLootTarget(ctx, canon);
    if (!t || !Array.isArray(t.items)) continue;
    if (t.items.length > LOOT_LIST_MAX) {
      if (!tooBig.has(canon)) {
        tooBig.add(canon);
        console.warn(`[loot] ${canon} holds ${t.items.length} items, more than the room can carry (${LOOT_LIST_MAX}); it stays yours alone`);
      }
      continue;
    }
    tooBig.delete(canon);
    out.push({ k: canon, r: peerHanded(t.items).map((it) => clearStolen({ ...it })), d: Number.isFinite(t.stockedDate) ? t.stockedDate : 0 });   // AUDIT SS: never a bound piece on the wire - a stone left in one before SS3 stays off the room (an older build connected beside this one would land it); HACKED-GOLD: nor a letter of credit; STOLEN-GOODS AUDIT S3: nor a theft's mark (a stash left on a shut shelf is no peer's theft, and an older build would land it)
  }
  return out;
}

/** AUTO-HOLD (2026-10-16, bible/06-Systems/Integrity-Arc.md): `items` without a piece the ledger follows whose key is
 *  among `carried.keys` (the reader's own lists - systems/item/itemIds.js carriedPieces) - and, `stowed` (a shop's shelf:
 *  AUDIT AUTO-HOLD, a piece put in a ship's hold came back off a stale one), among `carried.stowed` too - or repeats an
 *  earlier one's. Never the stowed keys on a container that may BE the stowage (a rented room's chest): its own pieces
 *  land there. The key rule comes in with them (`carried.keyOf`, itemIds.js ledgerKeyOf): this half never imports the
 *  item law, whose registration (systems/loot/loot.js setItemLaw) changes what every reader of the wire lands. No
 *  `carried`: as it came. */
export function withoutCarried(items, carried = null, { stowed = false } = {}) {
  if (typeof carried?.keyOf !== 'function') return items;
  const keys = new Set([...(carried.keys ?? []), ...(stowed ? carried.stowed ?? [] : [])]);
  return items.filter((it) => {
    const k = carried.keyOf(it);
    if (!k) return true;
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
}

/** The room's word about a building's containers, landed IN PLACE (a window already bound to the array keeps its
 *  rows) - except on the container this player has OPEN (AUDIT WORLD4 C1: yours until you close it, and your close
 *  is the room's newest word). A container this client never opened takes the room's list whole - that is the
 *  point: a second reader adopts the first's roll. Answers how many landed; `seen` gains every key the room spoke.
 *  AUTO-HOLD: A PIECE THE READER CARRIES NEVER LANDS BACK (`carried`, its ledger keys). The word is the last writer's,
 *  and one from before the reader took a piece off the shelf - another player's close of a window opened earlier, the
 *  room's memory of an earlier visit - put the piece back: the reader took it again and held one piece twice, a copy
 *  the ledger found at the next checkpoint (a piece sold to a shop and stolen back met it most). A piece the word names
 *  twice lands once. */
export function applyInteriorLoot(ctx, list, { seen = new Set(), openKey = null, today = null, unreadable = null, carried = null, room = null, from = null } = {}) {
  let n = 0;
  for (const rec of Array.isArray(list) ? list : []) {
    const canon = interiorLootKeyOf(rec?.k);
    if (!canon) continue;
    // OUTDOOR-LOOT: a cupboard's word is the room's TAKES, merged - never a list landed over a list (interiorRoomLoot.js). `from`: the
    // sender (null: the room's memory), whose word it is the state, a claim or a birth - and the seat's verdicts leave in this very call.
    if (room?.live() && canon.startsWith('container:')) { n += room.land(ctx, { ...rec, k: canon }, { from, today }) ? 1 : 0; continue; }
    // AUDIT WORLD6a A2/B2: THE DAY IS PROJECTED LIKE THE LIST. `d` is the one field the interior's record carries
    // that the dungeon's never did, and it landed unread: needsRestock is `stockedDate < today`, so a `d` of 1e15
    // froze a shelf's restock for ever, a `d` of 0 rerolled it on every browse, and either rode the scene cache
    // into the victim's SAVE and the room's memory for thirty days. A record's day must be a whole number no later
    // than tomorrow (the world's day is shared - WORLD5 - so a peer a day ahead is a peer with a clock a day off,
    // not a peer from the future); otherwise the RECORD is refused whole - a list without its day would land and
    // then restock and republish over the room (A2's secondary). And the day only ever moves FORWARD (A3): a stale
    // close from a window opened yesterday must not un-restock a shelf the new day already rolled.
    if (!Number.isFinite(rec.d) || rec.d < 0 || (today != null && rec.d > today + 1)) continue;
    const items = peerHanded(validLootList(rec.r));   // SS3: a shelf or a container is the room's - a bound piece in one never lands; HACKED-GOLD: nor a letter of credit, a peer's gold
    // AUDIT SETS M2: a list this build cannot read (a newer game's item) - the room HAS spoken: seen, and never claimed
    // or closed over here (publishWhole below, and the cupboards' room law, read `unreadable`)
    if (!items) { if (unreadable && interiorLootTarget(ctx, canon)) { seen.add(canon); unreadable.add(canon); } continue; }
    const t = interiorLootTarget(ctx, canon);
    if (!t) continue;
    // STOLEN-GOODS AUDIT (2026-10-16, S3): A SHELF'S OR A CUPBOARD'S PIECE IS ITS OWNER'S. No client of this build puts a
    // marked piece in the room's word for a shelf (a stolen piece sold never reaches one - stolenGoods.js landSold), but an
    // older build's sale, a stash left on a shut shelf or a hostile client's word could carry `stolen` - and an honest Buy
    // off that shelf kept it, a stranger's purchase destroyed at its sale and taken at a verdict. Stripped as it lands; a
    // take of it off the stranger's cupboard is marked by the taker's own keeping (itemTransfer.js applyTransfer).
    for (const it of items) clearStolen(it);
    seen.add(canon);
    unreadable?.delete(canon);
    if (canon === openKey) { n++; continue; }
    const lands = withoutCarried(items, carried, { stowed: canon.startsWith('shelf:') });
    if (Array.isArray(t.items)) { t.items.length = 0; for (const it of lands) t.items.push(it); } else t.items = lands;
    t.stockedDate = Math.max(Number.isFinite(t.stockedDate) ? t.stockedDate : 0, Math.floor(rec.d));
    n++;
  }
  return n;
}

/** The building's SHARED world for the room's memory: the opened containers the room knows of (`seen`) and every
 *  action record's shared half; keyed by the building and stamped by the mode's context, so another building's
 *  memory - or this one's own, back from a reconnect's welcome (AUDIT WORLD B1) - is refused. */
export function composeInteriorShared(ctx, { locationKey, stamp, seen = new Set(), tooBig = new Set(), home = false, room = null } = {}) {
  if (!ctx || !locationKey) return null;
  return {
    locationKey, stamp,
    world: {
      loot: home ? [] : interiorLootRecords(ctx, [...seen], tooBig, { room }),   // HOME1: a home's cupboards are its owner's alone
      actions: (ctx.actions?.collectSaveData?.() ?? []).map(sharedRecord),
    },
  };
}

/** The room's memory applied, once per context, never its own: the action records projected and RESTORED (the
 *  memory is where the doors stand as this player walks in - a restore, like the cache's, not a swing heard), the
 *  opened containers through applyInteriorLoot. Answers true when it landed. */
export function applyInteriorShared(ctx, shared, { locationKey, stamp, seen = new Set(), openKey = null, today = null, home = false, carried = null, room = null } = {}) {
  if (!ctx || !shared || !locationKey || shared.locationKey !== locationKey || !shared.world || typeof shared.world !== 'object') return false;
  if (shared.stamp === stamp) return false;
  const acts = Array.isArray(shared.world.actions) ? shared.world.actions.map(validActionRecord).filter(Boolean) : [];
  if (acts.length) ctx.actions?.restoreSaveData?.(acts, { remote: true });   // SPELL-LOCK: a peer's word - no Lock spell's lock lands
  if (!home) applyInteriorLoot(ctx, shared.world.loot, { seen, openKey, today, carried, room, from: null });   // HOME1: no word lands on a home's cupboards; AUTO-HOLD: nor a piece the reader carries; OUTDOOR-LOOT: the memory is the seat's state (a null sender), never a list over a list
  return true;
}

/** AUDIT WORLD3 A3's seam for a building: the CURRENT shared record of each named object - a door's or a
 *  container's, told apart by the key - for an act the wire refused. */
export function interiorActionRecords(ctx, keys, { locationKey, tooBig = new Set(), home = false, room = null } = {}) {
  if (!ctx || !locationKey || !Array.isArray(keys) || !keys.length) return null;
  const want = new Set(keys);
  const a = (ctx.actions?.collectSaveData?.() ?? []).filter((r) => want.has(r.key)).map(sharedRecord);
  const l = home ? [] : interiorLootRecords(ctx, keys, tooBig, { room });   // HOME1; OUTDOOR-LOOT: a cupboard's CURRENT word is the module's - a refused word is re-read from it
  return a.length || l.length ? { k: locationKey, ...(a.length ? { a } : {}), ...(l.length ? { l } : {}) } : null;
}

// ═══ THE DOORS THE HOST CALLS (HOST-SPLIT: WORLD6a's loot block, moved out of createWorldModes - DESIGN 4.9) ═══════════════════
// Plain functions of the context, the key and the bag - no host scope - so the interior mode wires them in a line apiece and a
// test mounts them as the host does. A `container:` the room holds goes to `bag.room` (interiorRoomLoot.js); a `shelf:` keeps
// WORLD6a's whole-list law below, word for word.

/** WORLD4's law for a SHELF (and a container no room holds): the container is the room's - said on the OPEN, which CLAIMS it (a
 *  claim speaks only for a container the room has not spoken about, AUDIT WORLD4 C2/D5), on a RESTOCK (the new day's stock is
 *  the room's, whoever browsed first), and on the CLOSE (what is left). */
function publishWhole(ctx, canon, bag, { claim = false } = {}) {
  if (!bag?.locationKey || !canon || !ctx || bag.home) return false;   // HOME1: a home's cupboards are never the room's
  if (bag.unreadable?.has(canon)) return false;   // AUDIT SETS M2: never over a word this build cannot read
  if (claim && bag.seen.has(canon)) return false;
  const l = interiorLootRecords(ctx, [canon], bag.tooBig);
  if (!l.length) return false;   // never opened, or too large to say - it stays this player's own
  const first = !bag.seen.has(canon);
  bag.seen.add(canon);
  if (first) bag.net?.claimed?.();   // AUDIT WORLD4 D5: the memory goes out now, not up to fifteen seconds from now
  return !!bag.net?.send?.({ k: bag.locationKey, l });
}

/** A window opened on a container: the claim, and the window remembered so its close - through WHICHEVER of the slot's drains
 *  frees it (a trade window has no close hook of its own, X6) - says what is left.
 *  AUDIT WORLD6a A5 (WORLD4 C6 again): a RESTOCK is said HERE, at the window's mount, not where the roll was made - the container
 *  arm rolled a stranger's cupboard before the private-property prompt, so a player who answered No (DFU: "No claims nothing")
 *  had already told the room the cupboard's whole contents; `fresh` is the arm's word that this open rolled the new day's stock,
 *  and then the word is not a claim but the room's new stock. OUTDOOR-LOOT: a cupboard's window is the room's too - nothing is
 *  composed under it (C1) and its takes are claimed as they are made - but its birth was minted at the Yes, ahead of this
 *  (interiorLootBirth: the keeping the window's theft marks read is taken after it). */
export function interiorLootOpen(ctx, key, win, bag, { fresh = false, keeping = null } = {}) {
  const canon = interiorLootKeyOf(key);
  if (!bag?.locationKey || !canon || !win) return;
  if (canon.startsWith('container:') && bag.room?.live()) { bag.room.open(canon, win, keeping); return; }
  if (bag.unreadable?.has(canon)) bag.net?.say?.(LOOT_NEWER_TEXT);   // AUDIT SETS M2: what is shown is this build's own roll, and it is never said to the room
  bag.openKey = canon; bag.openWin = win;
  publishWhole(ctx, canon, bag, { claim: !fresh });
}

/** Every interior frame: the open container's window is GONE - the close's word. AUDIT WORLD6a A3 (CRITICAL): gone means gone
 *  from the STACK, not from the slot. `interiorOverlay` mirrors the TOP of interiorWindows and mountInterior PUSHES (ROAD-B B1),
 *  so a quest popup, an inventory or a text box laid over an open shelf made the slot another window while the shelf's stood
 *  beneath, still bound to its rows: the close went out mid-transaction, `openKey` was cleared, a peer's word then landed under
 *  the live window (AUDIT WORLD4 C1's orphaned rows: an item taken twice), and the two theft comparisons read a shelf the room
 *  had moved - a peer's purchase made this player a thief. `open(win)` asks the stack whether the window still exists. The
 *  cupboards' frame (interiorRoomLoot.js) is the same question asked of each cupboard's own window, and more: the claims'
 *  lapse and re-ask, a seat's change, a put's re-say. */
export function interiorLootFrame(ctx, bag, { now = 0, open = () => true } = {}) {
  if (!bag?.locationKey) return;
  const win = bag.openWin;
  if (win && !(String(bag.openKey).startsWith('container:') && bag.room?.live()) && !(open(win) && !win.done)) {
    const k = bag.openKey;
    bag.openKey = null; bag.openWin = null;
    publishWhole(ctx, k, bag);
  }
  bag.room?.frame(ctx, now, open);
}

/** Whether a cupboard is one this client has not heard of - the plaque (CONTAINER-PEEK) names it and lists nothing: no state
 *  here (the room has not spoken, and this client has not opened it) and no list of its own. "Unborn" is not "no room state": a
 *  cupboard holding its own list lists in the peek, and an online stranger's roll and the scene cache are held aside with `items`
 *  null until the room's word or this client's own birth. One the room spoke of in words this build cannot read is a name too. */
export function interiorLootUnborn(ctx, key, bag) {
  const canon = interiorLootKeyOf(key);
  if (!canon || !canon.startsWith('container:') || !bag?.room?.live()) return false;
  return bag.unreadable.has(canon) || (bag.room.unborn(canon) && !Array.isArray(interiorLootTarget(ctx, canon)?.items));
}

/** The container arm rolled a stranger's cupboard (stockHouseContainer): HELD by the room, never written to the container - the
 *  roll is no one's word until the Yes (a No claims nothing) and the plaque must not paint it. Answers whether it was held; false
 *  where no room is (offline, a bare context): the arm writes it as it always did. */
export function interiorLootRoll(ctx, key, items, bag, today) {
  const canon = interiorLootKeyOf(key);
  return !!(canon && canon.startsWith('container:') && bag?.room?.roll(ctx, canon, items, today));
}

/** The Yes: the held roll is minted as the room's (the earlier mint by the shared clock wins everywhere) and composed into the
 *  container - BEFORE the window's keeping is taken, or a first opener's theft marks would read an empty keeping. */
export function interiorLootBirth(ctx, key, bag) {
  const canon = interiorLootKeyOf(key);
  return !!(canon && canon.startsWith('container:') && bag?.room?.birth(ctx, canon));
}

/** The building's mount: whatever list a stranger's cupboard holds that no word of the room made - the scene cache's - is set
 *  aside (called at the mint and again after the cache has laid its lists); one the room has spoken for is composed back over it. */
export function interiorLootAside(ctx, bag) { bag?.room?.aside(ctx); }

/** D-1/D-1a: the claimer's own teardown (exitInteriorNow, forceExitToExterior - a teleport's and a load's) - ahead of the bag's
 *  drop: a claim in flight and not lapsed goes with its claimer. */
export function interiorLootLeave(ctx, bag) { bag?.room?.leave(ctx); }
