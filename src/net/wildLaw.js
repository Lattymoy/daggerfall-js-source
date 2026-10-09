// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md) - THE ROOM'S REMAINS, AS THE RELAY KEEPS THEM.
//
// The owner: "the items lay around for 10 minutes and are marked for you to get them back and other players can take
// em". A player who falls in the open zone drops what their bag and their cart held (never their worn gear, never the
// consumables the zone lets them keep - systems/wildDeath.js says which); the fallen's own game sends the records here
// in `fall` frames (net/wire.js validWildData) and forgets them. From then on THE ROOM'S OBJECT holds them, and it alone
// decides who gets each one: the first `take` of a record wins it, the record goes to its taker alone, and everyone in
// the room hears what left. No client's word can hand out a record twice, because no client holds one.
//
// WHAT A REMAINS IS: `{ r, os, oid, nm, p, at, open, items }` - the fallen's own id for it (`r`), their verified account
// (`os`, null for a guest) and peer id (`oid`), their name, where it lies in the room's own frame (`p`), when it fell
// (`at`, the relay's clock), whether more chunks are still owed (`open`), and its records - a taken one null, so every
// index stays the one the room said.
//
// PURE: nothing here touches a socket or storage. The relay (server/src/index.js `_wild*`) reads and writes; this is
// the law both its arms and the pins read. It imports wire.js alone (already in the bundle).
//
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md): AND WHAT A REMAINS HOLDS IS THE
// ACCOUNT SERVICE'S WORD. The fallen's own game handed its records over, so a crafted one deposited whatever it liked
// for its friends to take. Now the service takes the drop off the fallen's judged record (server-account/src/wild.js)
// and signs it - a `remains` order (net/identityToken.js): the remains' id, how many records and their digest, and the
// killer whose worn piece one of them is. A deposit carries the order; the room keeps the records, and opens the remains
// to takes only when they digest to the order's (`ok`); the killer's piece is the killer's alone. The service fits the
// drop to the room's own bounds first (remainsFit - the same law foldFall keeps), so an honest deposit always digests.
// ═══════════════════════════════════════════════════════════════════
import { WILD_ITEMS_MAX, WILD_REMAINS_ITEMS_MAX, WILD_REMAINS_MS, WILD_ROOM_REMAINS_MAX, sanitizeName, WDUN_DAY_MS, WDUN_LOCK_MS, WDUN_RESET_MS, WDUN_STALE_MS } from './wire.js';

/** A remains' bytes in storage, at most - under the object store's own bound for one value (128 KiB), with room. */
export const WILD_REMAINS_BYTES_MAX = 100 * 1024;
/** Each remains is its own storage key, so one fat bag never crowds out the room's others. */
export const WILD_REMAINS_PREFIX = 'wild:';
export const wildRemainsKey = (r) => `${WILD_REMAINS_PREFIX}${r}`;

/** A new remains - nothing in it yet; its first `fall` fills it. INT9: `wh`, `wn` the order's digest and count (the room
 *  opens it to takes only when its records match), `wk`, `wi` the killer and its piece's place (theirs alone); `lastAt`
 *  its carrier's last chunk (a deposit stalled half-way is another carrier's to lay - remainsTakeover). */
export function newRemains({ r, os = null, oid = null, nm = '', p, now, gi = null, wh = null, wn = 0, wk = null, wi = -1 }) {
  return { r, gi: typeof gi === 'string' && gi ? gi : null, os: typeof os === 'string' && os ? os : null, oid: typeof oid === 'string' && oid ? oid : null, nm: sanitizeName(nm ?? ''), p: [p[0], p[1], p[2]], at: now, lastAt: now, open: true, items: [],
    wh: typeof wh === 'string' ? wh : null, wn: Number.isSafeInteger(wn) ? wn : 0, wk: typeof wk === 'string' && wk ? wk : null, wi: Number.isSafeInteger(wi) ? wi : -1, ok: false };
}
/** INT9 (AUDIT): the most one record's JSON may weigh in a remains - a realm trade's own bound (net/realmTradeLaw.js
 *  REALM_TRADE_RECORD_MAX, pinned equal): a chunk of WILD_ITEMS_MAX of them and its order fit the wire's frame (net/wire.js
 *  WILD_DATA_MAX), where a heavier one was signed and then never fit through it. */
export const WILD_RECORD_BYTES_MAX = 4096;
/** INT9 (AUDIT): how long a remains emptied or let go stays the room's word on its id - a TOMBSTONE, said to nobody - so the
 *  service's order for it (good one minute from its first minting) lays nothing twice; past it a full room may let it go. */
export const WILD_TOMB_MIN_MS = 3 * 60_000;
/** INT9 (AUDIT): how long a deposit may stall half-way before another carrier of a good order lays it instead. */
export const WILD_STALL_MS = 10_000;
/** INT9: THE DROP FITTED TO A REMAINS - the records the room keeps of a list, in order: WILD_REMAINS_ITEMS_MAX of them
 *  and WILD_REMAINS_BYTES_MAX of their JSON, as foldFall keeps them (the rest is let go - "the fallen already let it go").
 *  The account service fits its drop with it before it signs, so every honest deposit is kept whole and digests. */
export function remainsFit(items) {
  const out = [];
  let bytes = 2;   // JSON.stringify([]).length
  for (const it of Array.isArray(items) ? items : []) {
    if (out.length >= WILD_REMAINS_ITEMS_MAX) break;
    const size = JSON.stringify(it).length + 1;
    if (bytes + size > WILD_REMAINS_BYTES_MAX) break;
    bytes += size;
    out.push(it);
  }
  return out;
}
/** INT9 (AUDIT): may this record lie in a remains at all - WILD_RECORD_BYTES_MAX of JSON (a heavier piece stays with the
 *  fallen, as one past the remains' count does). */
export const recordFits = (it) => JSON.stringify(it).length <= WILD_RECORD_BYTES_MAX;

/** Is it still lying here at `now`? */
export const remainsLive = (rec, now) => !!rec && now - rec.at < WILD_REMAINS_MS;
/** Has every record been taken (and no more are owed)? */
export const remainsEmpty = (rec) => !rec.open && rec.items.every((it) => it == null);
/** INT9 (AUDIT): a TOMBSTONE - vouched for and emptied: kept, said to nobody, its id never laid again while it lives (a
 *  remains emptied was let go, and its fall's order laid the same records again - one fall, its drop taken twice). */
export const remainsSpent = (rec) => !!rec?.ok && remainsEmpty(rec);
/** INT9 (AUDIT): a deposit stalled half-way (unvouched, its carrier silent WILD_STALL_MS) is laid afresh by `oid`, another
 *  carrier of the same good order - the first carrier's chunks never closed it, and nobody else's could. True when taken
 *  over (the remains emptied and reopened for `oid`). */
export function remainsTakeover(rec, oid, now) {
  if (!rec || rec.ok || rec.oid === oid || now - (rec.lastAt ?? rec.at) < WILD_STALL_MS) return false;
  rec.oid = oid; rec.items = []; rec.open = true; rec.lastAt = now;
  return true;
}
/** What is left of its life, ms - the `ri` word's `ttl` (the room's clock, never the client's). */
export const remainsTtl = (rec, now) => Math.max(0, Math.min(WILD_REMAINS_MS, rec.at + WILD_REMAINS_MS - now));

/**
 * A `fall` chunk folded in: the records appended, up to WILD_REMAINS_ITEMS_MAX and WILD_REMAINS_BYTES_MAX (the rest of
 * the chunk is not kept - the fallen already let it go; a bag of a hundred is the edge, not the rule). Only the remains'
 * own maker may add to it, and only while it is open. Returns `{ off, items }` - where the kept ones begin and the kept
 * ones - or null when nothing could be taken (a stranger's chunk, a closed remains).
 */
export function foldFall(rec, { oid, items, last }, now = null) {
  if (!rec || !rec.open || rec.oid !== oid) return null;
  if (Number.isFinite(now)) rec.lastAt = now;
  const off = rec.items.length;
  let bytes = JSON.stringify(rec.items).length;
  const kept = [];
  for (const it of items) {
    if (rec.items.length >= WILD_REMAINS_ITEMS_MAX) break;
    const size = JSON.stringify(it).length + 1;
    if (bytes + size > WILD_REMAINS_BYTES_MAX) break;
    bytes += size;
    rec.items.push(it);
    kept.push(it);
  }
  if (last === 1) rec.open = false;
  return { off, items: kept };
}

/**
 * A take: `n` of record `i`, the whole record when `n` reaches its stack. Answers the record as its taker gets it (the
 * stored one whole, or a copy at the count taken) and how many left - or null when there is nothing there to take.
 */
export function takeFrom(rec, i, n, sub = null) {
  if (!rec?.ok) return null;   // INT9: a remains whose records the order never vouched for is nobody's
  if (i === rec.wi && rec.wk && sub !== rec.wk) return null;   // INT9: the killer's worn piece is the killer's alone
  const it = rec?.items?.[i];
  if (!it) return null;
  const stack = Number.isInteger(it.stackCount) && it.stackCount > 1 ? it.stackCount : 1;
  if (n >= stack) { rec.items[i] = null; return { it, n: stack }; }
  it.stackCount = stack - n;
  return { it: { ...it, stackCount: n }, n };
}

/** The room's remains as `ri` words for a socket that just said hello (or for a new chunk): WILD_ITEMS_MAX a word, the
 *  last one `end`. A remains with nothing left says nothing. */
export function remainsWords(rec, now) {
  if (!rec?.ok || !remainsLive(rec, now) || remainsEmpty(rec)) return [];   // INT9: a remains the order never vouched for is said to nobody
  const head = { t: 'wild', k: 'ri', r: rec.r, p: rec.p, nm: rec.nm, os: rec.os, oid: rec.oid, ttl: remainsTtl(rec, now), ...(rec.wk ? { wk: rec.wk, wi: rec.wi } : {}) };
  const out = [];
  const total = rec.items.length;
  if (!total) return [{ ...head, off: 0, items: [], end: rec.open ? 0 : 1 }];
  for (let off = 0; off < total; off += WILD_ITEMS_MAX) {
    const items = rec.items.slice(off, off + WILD_ITEMS_MAX);
    out.push({ ...head, off, items, end: !rec.open && off + WILD_ITEMS_MAX >= total ? 1 : 0 });
  }
  return out;
}

/** Past WILD_ROOM_REMAINS_MAX the oldest makes room: its id; null while there is room. INT9 (AUDIT): a tombstone younger
 *  than WILD_TOMB_MIN_MS is never let go - with nothing else to let go the room is full (`''`: lay nothing). */
export function remainsEvict(map, now = Infinity) {
  if (map.size < WILD_ROOM_REMAINS_MAX) return null;
  let old = null;
  for (const rec of map.values()) {
    if (remainsSpent(rec) && now - rec.at < WILD_TOMB_MIN_MS) continue;
    if (!old || rec.at < old.at) old = rec;
  }
  return old?.r ?? '';
}

/** A remains read back from storage, checked for the shape this file writes - or null. */
export function remainsOf(v) {
  if (!v || typeof v !== 'object' || typeof v.r !== 'string' || !Array.isArray(v.items) || !Array.isArray(v.p) || v.p.length !== 3 || !Number.isFinite(v.at)) return null;
  return { r: v.r, gi: typeof v.gi === 'string' && v.gi ? v.gi : null, os: typeof v.os === 'string' ? v.os : null, oid: typeof v.oid === 'string' ? v.oid : null, nm: typeof v.nm === 'string' ? v.nm : '', p: [Number(v.p[0]) || 0, Number(v.p[1]) || 0, Number(v.p[2]) || 0], at: v.at, lastAt: Number.isFinite(v.lastAt) ? v.lastAt : v.at, open: v.open === true, items: v.items.map((it) => (it && typeof it === 'object' ? it : null)),   // INT9 (AUDIT): the guild kept too - a woken room let the fallen's guildmates take
    wh: typeof v.wh === 'string' ? v.wh : null, wn: Number.isSafeInteger(v.wn) ? v.wn : 0, wk: typeof v.wk === 'string' ? v.wk : null, wi: Number.isSafeInteger(v.wi) ? v.wi : -1, ok: v.ok === true };   // INT9
}


// ═══════════════════════════════════════════════════════════════════
// PVPDUNGEONS (2026-10-08) - THE ZONE'S HALLS, AS THE HUB KEEPS THEM.
//
// One record in the hub's storage (WDUN_KEY), small and bounded: `{ locks, inside, empty, crows, piles }`.
//   locks  { acct: { hall: until } }  - an account may not enter a hall it left (or fell in) for WDUN_LOCK_MS...
//   piles  { acct: { h, until } }     - ...unless its own remains still lie in that hall (the way back to them)
//   inside { hall: { acct: seen } }   - who is in a hall, by heartbeat; a silent one lapses after WDUN_STALE_MS
//   empty  { hall: since }            - when a hall last emptied; past WDUN_RESET_MS its world room is wiped
//   crows  { hall: until }            - a hall a body lies in, told to everyone online until its remains go
// Pure: the hub (server/src/index.js `_wdun*`) reads, calls these and writes; the pins read the same.
// ═══════════════════════════════════════════════════════════════════
export const WDUN_KEY = 'wdun';
export const WDUN_ACCTS_MAX = 20000;
export const wdunDay = (now) => Math.floor(now / WDUN_DAY_MS);
export const wdunEmpty = () => ({ locks: {}, inside: {}, empty: {}, crows: {}, piles: {}, eps: {}, giants: {} });   // ZONE-GIANTS: `giants` - a giant's index -> when it walks again
/** A stored record, made safe (anything malformed is dropped). */
export function wdunOf(v) {
  const out = wdunEmpty();
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(out)) if (v[k] && typeof v[k] === 'object' && !Array.isArray(v[k])) out[k] = v[k];
  return out;
}
/** Everything past its time let go; the halls that lapsed occupants just emptied are returned (their `empty` is set to
 *  the lapsed one's last word). Returns whether anything changed. */
export function wdunPrune(st, now) {
  let moved = false;
  for (const [acct, halls] of Object.entries(st.locks)) {
    for (const [h, until] of Object.entries(halls)) if (!(until > now)) { delete halls[h]; moved = true; }
    if (!Object.keys(halls).length) { delete st.locks[acct]; moved = true; }
  }
  for (const [acct, p] of Object.entries(st.piles)) if (!(p?.until > now)) { delete st.piles[acct]; moved = true; }
  for (const [h, until] of Object.entries(st.crows)) if (!(until > now)) { delete st.crows[h]; moved = true; }
  for (const [g, until] of Object.entries(st.giants ?? {})) if (!(until > now)) { delete st.giants[g]; moved = true; }   // ZONE-GIANTS: up again
  for (const [h, who] of Object.entries(st.inside)) {
    let last = 0;
    for (const [acct, seen] of Object.entries(who)) if (!(now - seen < WDUN_STALE_MS)) { last = Math.max(last, seen); delete who[acct]; moved = true; }
    if (!Object.keys(who).length) { delete st.inside[h]; if (!(st.empty[h] > 0)) st.empty[h] = last || now; moved = true; }
  }
  for (const [h, since] of Object.entries(st.empty)) if (now - since > WDUN_DAY_MS) { delete st.empty[h]; moved = true; }   // a day on, the hall has moved anyway
  for (const [h, e] of Object.entries(st.eps)) if (!(now - (e?.at ?? 0) < 2 * WDUN_DAY_MS)) { delete st.eps[h]; moved = true; }
  return moved;
}
/** My lock on a hall, ms left (0: none). */
export function wdunLockLeft(st, acct, h, now) { const u = st.locks[acct]?.[h] ?? 0; return u > now ? u - now : 0; }
/** May `acct` go into hall `h` now? `{ ok, left, reset }` - `reset` true when the hall stood empty past WDUN_RESET_MS
 *  (the hub wipes its world room before it answers). A lock is lifted while the account's own remains lie there. */
export function wdunEnter(st, acct, h, now) {
  const left = wdunLockLeft(st, acct, h, now);
  const pile = st.piles[acct];
  if (left > 0 && !(pile && pile.h === h && pile.until > now)) return { ok: false, left, reset: false, ep: st.eps[h]?.n ?? 0 };
  const since = st.empty[h];
  const occupied = st.inside[h] && Object.keys(st.inside[h]).length > 0;
  const reset = !occupied && since > 0 && now - since >= WDUN_RESET_MS;
  delete st.empty[h];
  (st.inside[h] ??= {})[acct] = now;
  // the hall's EPOCH: a reset is a new one, and every client keys the hall's chests by it (dungeonContext.js
  // searchLocationKey), so a reset fills them again for everyone, not only for whoever came in first
  const ep = (st.eps[h]?.n ?? 0) + (reset ? 1 : 0);
  st.eps[h] = { n: ep, at: now };
  return { ok: true, left: 0, reset, ep };
}
/** A heartbeat from inside (one the hub never let in is ignored). */
export function wdunHere(st, acct, h, now) { if (st.inside[h]?.[acct] != null) { st.inside[h][acct] = now; return true; } return false; }
/** `acct` left hall `h` (walked out, or fell): its hour's lock starts; the hall, if now empty, starts its reset clock. */
export function wdunLeave(st, acct, h, now) {
  const halls = (st.locks[acct] ??= {});
  halls[h] = now + WDUN_LOCK_MS;
  if (st.inside[h]) { delete st.inside[h][acct]; if (!Object.keys(st.inside[h]).length) { delete st.inside[h]; st.empty[h] = now; } }
  return WDUN_LOCK_MS;
}
/** `acct` fell in hall `h`: it has left it (locked), its remains lie there until `until` (its way back in), and the crows
 *  circle the hall until the last remains in it go. */
export function wdunDie(st, acct, h, now, until = now + WILD_REMAINS_MS) {
  wdunLeave(st, acct, h, now);
  st.piles[acct] = { h, until };
  st.crows[h] = Math.max(st.crows[h] ?? 0, until);
}
/** `acct`'s remains are gone (taken empty, or their time ran out): its way back closes, and the hall's crows go when no
 *  other body lies in it. */
export function wdunGone(st, acct, now) {
  const p = st.piles[acct];
  if (!p) return false;
  delete st.piles[acct];
  const still = Object.values(st.piles).filter((q) => q.h === p.h && q.until > now).reduce((m, q) => Math.max(m, q.until), 0);
  if (still) st.crows[p.h] = still; else delete st.crows[p.h];
  return true;
}
/** The words a socket gets at its hello: the day by the relay's clock, its own locks, and the crows. */
export function wdunState(st, acct, now) {
  return {
    t: 'wdun', k: 'st', day: wdunDay(now), now,
    locks: Object.entries(st.locks[acct] ?? {}).filter(([, u]) => u > now).map(([h, u]) => [h, u - now]),
    crows: wdunCrows(st, now),
    giants: wdunGiants(st, now),
  };
}
export const wdunCrows = (st, now) => Object.entries(st.crows).filter(([, u]) => u > now).map(([h, u]) => [h, u - now]);
/** Bound the record: past WDUN_ACCTS_MAX accounts with locks, the soonest-ending are let go first. */
export function wdunBound(st) {
  const accts = Object.keys(st.locks);
  if (accts.length <= WDUN_ACCTS_MAX) return false;
  const soon = accts.map((a) => /** @type {[string, number]} */ ([a, Math.max(.../** @type {number[]} */ (Object.values(st.locks[a])))])).sort((x, y) => x[1] - y[1]);
  for (const [a] of soon.slice(0, accts.length - WDUN_ACCTS_MAX)) delete st.locks[a];
  return true;
}

// ── ZONE-GIANTS (2026-10-08, the owner: "always spawn 2 giants per tier and make em show on the map"): the hub keeps which
// of the zone's eight giants (systems/wildGiants.js - their walks are every client's own pure pick) is down, and until
// when, so a giant killed is gone for everyone and walks again for everyone at once.
export const WDUN_GIANTS = 8;
export const WDUN_GIANT_DOWN_MS = 30 * 60_000;
/** A giant killed: down WDUN_GIANT_DOWN_MS (a giant already down keeps its time - a second report moves nothing).
 *  Returns whether it was news. */
export function wdunGiantDie(st, g, now) {
  if (!(Number.isSafeInteger(g) && g >= 0 && g < WDUN_GIANTS)) return false;
  st.giants ??= {};
  if (st.giants[g] > now) return false;
  st.giants[g] = now + WDUN_GIANT_DOWN_MS;
  return true;
}
/** The giants down: `[[g, msLeft]]`. */
export const wdunGiants = (st, now) => Object.entries(st.giants ?? {}).filter(([, u]) => u > now).map(([g, u]) => [Number(g), u - now]);
