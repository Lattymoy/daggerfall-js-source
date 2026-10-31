// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-FREEZE (2026-10-22; design doc "DFO Staff Panel: design", Freeze player, Server load leases, and their weak
// spots) - FREEZE PLAYER AND THE STAFF CHAT, the relay's half. The account service's half is
// server-account/src/staffFreeze.js; index.js holds the few hooks that call in here.
//
// THE ORDER: the service pushes a signed `freeze` order (`{o:'freeze', s, fz}`, identityToken.js mintFreezeOrder - `fz` its
// end, 0 lifted) through the Worker's law door to the hub, which keeps it in a STORED BOOK OF ITS OWN, as a ban's
// (FREEZES_KEY, read once a wake), newest a account wins. Each of the account's hub sockets whose token is no newer takes
// it (`fz` on the attachment - a shard's through SHARD_LAW_KEYS) and is told `{t:'frozen', until}`; an old build's (no `fv`
// at its hello: it shows no freeze screen) is closed with the reload words. A hello is judged by the token's own `fz`
// (every token minted while a freeze stands carries it - a reload never sheds one) and, at the hub, by the book when its
// order is the newer word. EVERY OTHER ROOM learns it from the lease (net/roomLease.js, LEASE1): the hub mints each lease
// with the freeze as it holds it now, and a lease room takes it. STAFF-PANEL5-FREEZE-FIX (a review: homes, caravans,
// sieges, arenas, gates, breaches and Super dungeon realms were no lease rooms, so a freeze or a lift never reached them):
// every room but the hub's is a lease room now, and a hub shard's lease is its bus's to mint (index.js `_leaseRead`: the
// bus holds the book a fresh hello on a shard has not heard yet) - and while the bus takes nothing the shard hands up, the
// shard's own PASS (net/roomLease.js `p`, `busMissed`): a lease a room reads as older than its own last word, so a bus
// down never leaves every lease room unheard, and a fresh hello's pass lifts nothing the bus's book holds.
//
// A FROZEN SOCKET (mob, 03:05Z: "the player can only look around"; design doc: "The relay drops every frame from that
// player except the camera and their lines on the staff channel"):
//   - is heard in nothing but its ping, its lease, its camera - a pose kept where it stood, only its yaw and pitch new -
//     and its staff channel nudges (`frozenFrame`); a frozen hello in a place stands where its account's socket there stood,
//     never where the hello says, or nowhere (STAFF-PANEL5-FREEZE-FIX: a reconnect was a step - `frozenHello`);
//   - is OUT OF EVERY FIGHT: a blow, a cast, a trade or a duel's word aimed at it is refused (`aimedAtFrozen`; Weak spots:
//     "A frozen player can still be killed and robbed");
//   - IS NEVER A ROOM'S HOST, and the seat moves on when the freeze lands (`seatBarred`, `freezeMoved`; Weak spots: "A
//     frozen player could stay the room's host and stall its monsters"). Barred while any freeze is on its socket - lifted
//     by the next lease or hello, never by the clock alone, so a seat never moves back unsaid;
//   - MUTED BESIDES, it still talks to staff, and only there (index.js: the mute's check passes the staff channel alone).
//
// THE STAFF CHANNEL (`staff`, net/wire.js CHAT_LINE_CHANNELS; Weak spots: "Staff chat members and threads are undefined",
// "Freeze chat and Message on screen have nowhere to be stored"): every line is the account service's, stored there first;
// the relay carries only a NUDGE, never a line's words. A player's game says `{t:'chat', ch:'staff', text: '<line id>'}`
// on its hub link once the service took its line, and the hub tells the thread's members online `{t:'chat', ch:'staff',
// th, sl, id, name, at}` - `th` the thread (the player's account id), `sl` the line's id; a staff line's signed `staffline`
// order (`{o:'staffline', s, sl}`) is told them the same, `st` 1. The MEMBERS are the thread's player (frozen, or joined
// by a staff line this hub heard) and the staff sockets online - a socket whose verified token says it is a staff
// session's (the hidden spectator's claim `hd`, `hid` 1 on its attachment - staffHidden.js isHidden; never a glyph).
//
// OFFLINE ONLY until mob tries it live.
// ═══════════════════════════════════════════════════════════════════

import { SOCIAL_ROOM, CLOSE_POLICY, isSocialRoom, isChatRoom, tokenGate } from '../../src/net/wire.js';
import { MAX_TTL_S, SKEW_S, tokenBodyOf, _b64url } from '../../src/net/identityToken.js';
import { isHidden } from './staffHidden.js';

/** The order kinds this module takes (identityToken.js ORDER_KINDS). */
export const STAFF_ORDER_KINDS = Object.freeze(['freeze', 'staffline']);
/** The hub's stored book of freezes: `{ [sub]: [i, fz, sig] }`. */
export const FREEZES_KEY = 'freezes';
/** The book's most entries (the bans' own bound is 256; a freeze is rarer than a ban, and its entry outlives a ban's). */
export const FREEZES_MAX = 512;
/** The close's reason for an old build's frozen socket (its words are the ground's: the reload text). */
export const FREEZE_OLD_REASON = 'old build frozen';
/** The hub's staff nudges a second, every thread together (a person types them; the chat gate meters each socket). */
export const STAFF_NUDGE_HZ_MAX = 8;
/** The players a staff line joined to their thread that the hub remembers. */
export const STAFF_IN_MAX = 512;
/** The directed frames a player aims at another by its peer id (`data.to`, a siege's `to`). */
const AIMED = new Set(['trade', 'cast', 'duel', 'wild', 'wed', 'siege']);

/** A token's claims as signed - read only off a hello whose token `_named` verified already. @param {any} tok */
const claimsOf = (tok) => { try { return JSON.parse(new TextDecoder().decode(_b64url.decode(tokenBodyOf(tok)))); } catch { return null; } };

/** Whether this attachment is frozen at `nowS`. @param {any} a @param {number} nowS */
export const frozenAt = (a, nowS) => Number(a?.fz) > nowS;
/** Whether a socket is barred from a room's seat: any freeze on it, lapsed or not, until a lease or hello lifts it. @param {any} a */
export const seatBarred = (a) => Number(a?.fz) > 0;

/** A book entry still worth keeping: its freeze stands, or it is new enough to outrank a token minted before it. */
const kept = (/** @type {{ i: number, fz: number }} */ b, /** @type {number} */ nowS) => b.fz > nowS || b.i > nowS - MAX_TTL_S - SKEW_S;

/** THE BOOK, read once a wake from storage (a ban's law, `_loadBans`): an entry heard since the wake wins if newer. A read
 *  that fails is asked again by the next. @param {any} room @param {number} nowS */
export function loadFreezes(room, nowS) {
  room._freezes ??= new Map();
  room._freezesLoad ??= (async () => {
    let book = null;
    try { book = await room.state.storage.get(FREEZES_KEY); } catch (e) { room._freezesLoad = null; console.warn('[freeze] read', /** @type {any} */ (e)?.message ?? e); return; }
    if (!book || typeof book !== 'object') return;
    for (const [s, v] of Object.entries(book)) {
      if (!Array.isArray(v) || !Number.isSafeInteger(v[0]) || !Number.isSafeInteger(v[1])) continue;
      const b = { i: v[0], fz: v[1], sig: typeof v[2] === 'string' ? v[2] : '' };
      if (!kept(b, nowS) || room._freezes.get(s)?.i >= b.i) continue;
      room._freezes.set(s, b);
    }
  })();
  return room._freezesLoad;
}

/** The book written back, pruned to what can still matter. @param {any} room @param {number} nowS */
async function saveFreezes(room, nowS) {
  for (const [s, b] of room._freezes) if (!kept(b, nowS)) room._freezes.delete(s);
  try { await room.state.storage.put(FREEZES_KEY, Object.fromEntries([...room._freezes].map(([s, b]) => [s, [b.i, b.fz, b.sig]]))); } catch (e) { console.warn('[freeze] write', /** @type {any} */ (e)?.message ?? e); }
}

/** The book's freeze for `sub` over a token issued at `ti`: its end (0 lifted) when the order is the newer word (a tie is
 *  the order's, as a ban's), else undefined. @param {any} room @param {string} sub @param {number} ti @param {number} nowS */
async function bookOver(room, sub, ti, nowS) {
  await loadFreezes(room, nowS);
  const b = typeof sub === 'string' ? room._freezes.get(sub) : null;
  return b && b.i >= ti ? (b.fz > nowS ? b.fz : 0) : undefined;
}

/**
 * A SIGNED STAFF ORDER TAKEN (index.js `_takeOrder`, past its verify). `freeze`: the newest an account wins and the same
 * one twice is one; each of the account's sockets here whose token is no newer takes it, is told, and an old build's is
 * closed. `staffline`: the thread's player joined, and its members nudged. Answers true (an order this room believes).
 * @param {any} room @param {any} c the verified claims @param {string} order @param {number} now @param {string} oldWords
 */
export async function takeStaffOrder(room, c, order, now, oldWords) {
  const nowS = Math.floor(now / 1000);
  if (c.o === 'staffline') {
    const joined = room._staffIn ??= new Map();
    joined.delete(c.s);
    if (joined.size >= STAFF_IN_MAX) joined.delete(joined.keys().next().value);
    joined.set(c.s, c.i);
    nudge(room, c.s, { t: 'chat', ch: 'staff', th: c.s, sl: c.sl, st: 1, at: now });
    return true;
  }
  const sig = order.slice(order.lastIndexOf('.') + 1);
  await loadFreezes(room, nowS);
  const held = room._freezes.get(c.s);
  if (held && (c.i < held.i || held.sig === sig)) return true;
  const fz = c.fz > nowS ? c.fz : 0;
  room._freezes.delete(c.s);
  if (room._freezes.size >= FREEZES_MAX) room._freezes.delete(room._freezes.keys().next().value);
  room._freezes.set(c.s, { i: c.i, fz, sig });
  await saveFreezes(room, nowS);
  const told = JSON.stringify({ t: 'frozen', until: fz });
  for (const [ws, b] of [...room._all()]) {
    if (b.sub !== c.s || b.gio > c.i) continue;   // a token minted after the order carries the truth already (`_takeOrder`'s law)
    const next = { ...b, fz };
    room._setAttach(ws, next);
    room._send(ws, told);
    if (fz && b.fv !== 1) room._refuse(ws, oldWords, CLOSE_POLICY, FREEZE_OLD_REASON);   // Weak spots: "Old game builds show no freeze screen"
    else freezeMoved(room, b, next);
  }
  return true;
}

/**
 * A HELLO'S FREEZE (index.js, past the ban's): the token's own (`fz`, off the token `_named` verified), or the hub's book
 * where its order is the newer word - set on `who.fz` for the attachment (0 for none). An old build's frozen hello is
 * refused with the reload words; a frozen one is told so (its screen, after a reload), and one whose token's freeze the
 * book lifted is told that. A frozen hello in a place takes no pose of its own (STAFF-PANEL5-FREEZE-FIX: a frozen client
 * that said hello again somewhere else was seen standing there): it stands where its account's socket in this room stood
 * (the one its reconnect replaces), or nowhere - and `frozenFrame` keeps it there. Answers whether it refused.
 * @param {any} room @param {any} ws @param {string} key @param {any} who `_named`'s answer @param {any} m the hello @param {number} now @param {string} oldWords
 */
export async function frozenHello(room, ws, key, who, m, now, oldWords) {
  const nowS = Math.floor(now / 1000);
  const fz = claimsOf(m.tok)?.fz;
  const own = Number.isSafeInteger(fz) && fz > nowS ? fz : 0;
  const book = key === SOCIAL_ROOM ? await bookOver(room, who.subject, who.gio, nowS) : undefined;   // the hub keeps the book (its law door's)
  who.fz = book ?? own;
  if (who.fz && m.fv !== 1) { room._refuse(ws, oldWords, CLOSE_POLICY, FREEZE_OLD_REASON); return true; }
  if (who.fz && !isChatRoom(key)) m.pose = posedHere(room, who.subject);
  if (who.fz || (book !== undefined && book !== own)) room._send(ws, JSON.stringify({ t: 'frozen', until: who.fz }));   // a reload's screen is told too; a lift the token never heard of, said
  return false;
}

/**
 * (the bus) A SHARD'S HELLO under the bus's book (index.js `_vhello`): the attachment the shard said, with the book's freeze
 * where it is the newer word - or null, refused (an old build frozen).
 * @param {any} room @param {any} vws @param {any} a @param {number} ti @param {number} now @param {string} oldWords
 */
export async function busFreeze(room, vws, a, ti, now, oldWords) {
  const nowS = Math.floor(now / 1000);
  const book = await bookOver(room, a.sub, ti, nowS);
  const next = book === undefined ? a : { ...a, fz: book };
  if (frozenAt(next, nowS) && next.fv !== 1) { vws.att = next; room._refuse(vws, oldWords, CLOSE_POLICY, FREEZE_OLD_REASON); return null; }
  if (book !== undefined && book !== (Number(a.fz) > nowS ? a.fz : 0)) room._send(vws, JSON.stringify({ t: 'frozen', until: book }));
  return next;
}

/** Where `sub`'s socket in this room stands (a camera's pose, no step), or null. @param {any} room @param {unknown} sub */
function posedHere(room, sub) {
  if (typeof sub !== 'string' || !sub) return null;
  for (const [, b] of room._all()) if (b.sub === sub && b.pose && typeof b.pose === 'object') return { ...b.pose, mv: 0 };
  return null;
}

/** THE SEAT MOVES WHEN A FREEZE LANDS OR LIFTS (a lease, an order): in any room with a seat (a channel has none - the
 *  leave's own law, index.js `webSocketClose`) the host is asked again and said to everyone - a host frame said twice is
 *  nothing. @param {any} room @param {any} was @param {any} now the attachment now */
export function freezeMoved(room, was, now) {
  if (seatBarred(was) === seatBarred(now) || isChatRoom(was?.key)) return;
  room._hostMemo = undefined;
  room._sayHost();
}

/**
 * THE FRAME GATE (index.js `_message`, past the lease door): true for a frame dropped. A frozen socket is heard in its
 * ping (and its lease, taken before this), its camera - a pose rebuilt in place where it stands, its yaw and pitch alone
 * new - and its staff channel's nudges alone; any socket's blow, cast, trade or duel word aimed at a frozen one is dropped.
 * @param {any} room @param {any} a @param {any} m the parsed frame (a frozen camera's `p` rewritten)
 */
export function frozenFrame(room, a, m) {
  const nowS = Math.floor(Date.now() / 1000);
  if (frozenAt(a, nowS) && m.t !== 'ping') {
    if (m.t === 'chat' && m.ch === 'staff' && m.me !== true) return false;
    // the camera: the pose it stood in, its yaw and pitch alone new - no step, no swing, no weapon drawn
    if (m.t === 'pose' && a.pose && typeof a.pose === 'object') { m.p = { ...a.pose, yaw: m.p.yaw, pitch: m.p.pitch, mv: 0 }; return false; }
    return true;
  }
  return aimedAtFrozen(room, a, m, nowS);
}

/** Whether a frame aims at a frozen socket here: a directed frame's peer (`data.to`, a siege's `to`), or an arena bout's
 *  blow while its other fighter is frozen. @param {any} room @param {any} a @param {any} m @param {number} nowS */
function aimedAtFrozen(room, a, m, nowS) {
  if (m.t === 'arena' && m.k === 'hit') {
    for (const [, b] of room._all()) if (b !== a && b.af && frozenAt(b, nowS)) return true;
    return false;
  }
  if (!AIMED.has(m.t)) return false;
  const to = m.t === 'siege' ? m.to : m.data?.to;
  if (typeof to !== 'string') return false;
  for (const ws of room._byId().get(to) ?? []) if (frozenAt(room._all().get(ws), nowS)) return true;
  return false;
}

/**
 * A STAFF CHANNEL LINE (index.js `_sayLine`): a nudge, on the hub link alone, from a thread's player - frozen, or joined
 * by a staff line - naming the line the service stored (`text`, its id); its members told. Anything else is junk or
 * nothing. Its budget is the staff channel's own.
 * @param {any} room @param {any} ws @param {any} a @param {any} frame @param {number} now
 */
export function staffLine(room, ws, a, frame, now) {
  if (frame.t !== 'chat' || !isSocialRoom(a.key)) { room._junk(ws); return; }
  const sl = /^[1-9]\d{0,14}$/.test(frame.text) ? Number(frame.text) : 0;
  if (!sl || typeof a.sub !== 'string' || !a.sub) return;
  if (!frozenAt(a, Math.floor(now / 1000)) && !room._staffIn?.has(a.sub)) return;   // no thread of theirs this hub knows
  const budget = tokenGate(room._staffNudges, now, STAFF_NUDGE_HZ_MAX);
  room._staffNudges = budget.bucket;
  if (!budget.pass) return;
  nudge(room, a.sub, { t: 'chat', ch: 'staff', th: a.sub, sl, id: a.id, name: a.name, at: now });
}

/**
 * (a hub shard) ITS BUS DID NOT TAKE A HAND-UP (index.js `_hubUpFlush`, the hand-up's first miss): each lease ask it carried
 * is answered here - a pass off the socket's own attachment (`_leaseRead`, past its meter already, sees `_upRetry` set),
 * never left to wait on a bus that may not come back (STAFF-PANEL5-FREEZE-FIX, round two - a review: with the bus down no
 * shard minted a lease, and inside a lease's life every bound socket in every room but the hub's was heard in nothing).
 * An ask said after the miss is answered the same at once, and never handed up. THE LOAD: nothing while the bus answers -
 * each ask is still the bus's (one bus, 2 lease asks a minute an online player); a pass is one MAC on the shard, and a bus
 * back hears no backlog of asks (the missed hand-up alone goes again, as it was).
 * @param {any} room @param {any[]} events the hand-up's `[vid, kind, payload]`
 */
export async function busMissed(room, events) {
  for (const [vid, kind, said] of Array.isArray(events) ? events : []) {
    if (kind !== 'f' || !said.startsWith('{"t":"lease"')) continue;   // an ask: a shard keeps every lease frame of that shape (hubShards.js shardKeeps), and hands up its asks alone
    const ws = room._byVid(vid), a = ws && room._pastWait(ws);
    if (a) try { await room._leaseRead(ws, a, { t: 'lease' }, said, Date.now()); } catch (e) { console.warn('[freeze] pass', /** @type {any} */ (e)?.message ?? e); }
  }
}

/** A nudge to a thread's members online: its player's sockets and every staff socket (`isHidden`: STAFF-PANEL5-FREEZE-FIX,
 *  three reviews - this asked `hd` 1, which no attachment carries, so staff heard nothing). A walk of the hub, at
 *  STAFF_NUDGE_HZ_MAX at most - shortcut: no index of staff sockets; add one if staff sockets or nudges grow. */
function nudge(/** @type {any} */ room, /** @type {string} */ sub, /** @type {object} */ frame) {
  const out = JSON.stringify(frame);
  for (const [other, b] of [...room._all()]) if (b.id && (b.sub === sub || isHidden(b))) room._send(other, out);
}
