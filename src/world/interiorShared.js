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
import { sharedRecord, validActionRecord } from './actionSystem.js';
import { validLootList, LOOT_LIST_MAX } from '../systems/loot.js';
import { mintSharedStamp } from '../net/wire.js';   // AUDIT WORLD6a B7: one stamp mint at the wire, twelve digits always

/** The room's own key for a building - the SAME spelling roomKeyFor mints for the relay room (the map id unsigned,
 *  AUDIT WORLD34 A2), so the memory's `locationKey` and the room agree by construction. */
export function interiorLocationKey(mapId, buildingKey) {
  const id = Number.isFinite(mapId) ? mapId >>> 0 : 0;
  const key = Number.isFinite(buildingKey) ? buildingKey >>> 0 : 0;
  return id > 0 && key > 0 ? `interior:m${id}.${key}` : null;
}

/** AUDIT WORLD6a A1: THE WIRING BAG, MINTED HERE. The interior mode built its bag with the key spelled `key` and
 *  handed the whole bag to composeInteriorShared, which read `locationKey` - so a building's memory was NEVER
 *  published: every publish answered null, the relay stored nothing for any interior room, and no joiner was ever
 *  handed the building as the host left it, while the only pin on the call site was a source regex that matched
 *  the broken line verbatim. The field names live in ONE home now, the bag is minted here, and the pin executes
 *  the composition through it. `owned`: an owned house (or any ship interior - DFU does not distinguish ships, so
 *  owning one owns them all, and two players in one hull would disagree about whether the room exists) keeps NO
 *  room at all: no key, no memory, no presence room either (the host reports a 0 building key). */
export function mintInteriorShared(locationKey, { owned = false } = {}) {
  return { locationKey: owned ? null : (locationKey ?? null), owned: !!owned, stamp: mintSharedStamp(), seen: new Set(), tooBig: new Set(), applied: false, openKey: null, openWin: null };
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
 *  the container stays this player's own). `tooBig` is the caller's said-once set. */
export function interiorLootRecords(ctx, keys, tooBig = new Set()) {
  const out = [];
  for (const key of keys ?? []) {
    const canon = interiorLootKeyOf(key);
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
    out.push({ k: canon, r: t.items.map((it) => ({ ...it })), d: Number.isFinite(t.stockedDate) ? t.stockedDate : 0 });
  }
  return out;
}

/** The room's word about a building's containers, landed IN PLACE (a window already bound to the array keeps its
 *  rows) - except on the container this player has OPEN (AUDIT WORLD4 C1: yours until you close it, and your close
 *  is the room's newest word). A container this client never opened takes the room's list whole - that is the
 *  point: a second reader adopts the first's roll. Answers how many landed; `seen` gains every key the room spoke. */
export function applyInteriorLoot(ctx, list, { seen = new Set(), openKey = null, today = null } = {}) {
  let n = 0;
  for (const rec of Array.isArray(list) ? list : []) {
    const canon = interiorLootKeyOf(rec?.k);
    if (!canon) continue;
    // AUDIT WORLD6a A2/B2: THE DAY IS PROJECTED LIKE THE LIST. `d` is the one field the interior's record carries
    // that the dungeon's never did, and it landed unread: needsRestock is `stockedDate < today`, so a `d` of 1e15
    // froze a shelf's restock for ever, a `d` of 0 rerolled it on every browse, and either rode the scene cache
    // into the victim's SAVE and the room's memory for thirty days. A record's day must be a whole number no later
    // than tomorrow (the world's day is shared - WORLD5 - so a peer a day ahead is a peer with a clock a day off,
    // not a peer from the future); otherwise the RECORD is refused whole - a list without its day would land and
    // then restock and republish over the room (A2's secondary). And the day only ever moves FORWARD (A3): a stale
    // close from a window opened yesterday must not un-restock a shelf the new day already rolled.
    if (!Number.isFinite(rec.d) || rec.d < 0 || (today != null && rec.d > today + 1)) continue;
    const items = validLootList(rec.r);
    if (!items) continue;
    const t = interiorLootTarget(ctx, canon);
    if (!t) continue;
    seen.add(canon);
    if (canon === openKey) { n++; continue; }
    if (Array.isArray(t.items)) { t.items.length = 0; for (const it of items) t.items.push(it); } else t.items = items;
    t.stockedDate = Math.max(Number.isFinite(t.stockedDate) ? t.stockedDate : 0, Math.floor(rec.d));
    n++;
  }
  return n;
}

/** The building's SHARED world for the room's memory: the opened containers the room knows of (`seen`) and every
 *  action record's shared half; keyed by the building and stamped by the mode's context, so another building's
 *  memory - or this one's own, back from a reconnect's welcome (AUDIT WORLD B1) - is refused. */
export function composeInteriorShared(ctx, { locationKey, stamp, seen = new Set(), tooBig = new Set() } = {}) {
  if (!ctx || !locationKey) return null;
  return {
    locationKey, stamp,
    world: {
      loot: interiorLootRecords(ctx, [...seen], tooBig),
      actions: (ctx.actions?.collectSaveData?.() ?? []).map(sharedRecord),
    },
  };
}

/** The room's memory applied, once per context, never its own: the action records projected and RESTORED (the
 *  memory is where the doors stand as this player walks in - a restore, like the cache's, not a swing heard), the
 *  opened containers through applyInteriorLoot. Answers true when it landed. */
export function applyInteriorShared(ctx, shared, { locationKey, stamp, seen = new Set(), openKey = null, today = null } = {}) {
  if (!ctx || !shared || !locationKey || shared.locationKey !== locationKey || !shared.world || typeof shared.world !== 'object') return false;
  if (shared.stamp === stamp) return false;
  const acts = Array.isArray(shared.world.actions) ? shared.world.actions.map(validActionRecord).filter(Boolean) : [];
  if (acts.length) ctx.actions?.restoreSaveData?.(acts);
  applyInteriorLoot(ctx, shared.world.loot, { seen, openKey, today });
  return true;
}

/** AUDIT WORLD3 A3's seam for a building: the CURRENT shared record of each named object - a door's or a
 *  container's, told apart by the key - for an act the wire refused. */
export function interiorActionRecords(ctx, keys, { locationKey, tooBig = new Set() } = {}) {
  if (!ctx || !locationKey || !Array.isArray(keys) || !keys.length) return null;
  const want = new Set(keys);
  const a = (ctx.actions?.collectSaveData?.() ?? []).filter((r) => want.has(r.key)).map(sharedRecord);
  const l = interiorLootRecords(ctx, keys, tooBig);
  return a.length || l.length ? { k: locationKey, ...(a.length ? { a } : {}), ...(l.length ? { l } : {}) } : null;
}
