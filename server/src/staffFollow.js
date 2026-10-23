// @ts-check
// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow; the law both ends run is
// src/net/staffFollow.js) - THE RELAY'S HALF OF THE WHERE NOTE AND OF FOLLOWING A PLAYER. A module of its own, so the
// hot paths in index.js carry one call each (COMMON: "the fewest lines possible in index.js").
//
// THE BUS (`chat:world`) keeps every account's where note on its hub socket (`pm`, the party pose - SOC1) and now its
// room (`rk`) beside it. It holds the spectators following each account (`_follows`, by the target's verified account),
// each a hub link whose verified token says `fo` (and `hd`, the hidden builder's mark): told `on` at its hello, the
// target's note then and every time its room changes, `in`/`out` when a room says the target came or went, and `gone`
// when the target's last hub link closes. Nobody else is told anything, and nothing of this is ever fanned.
//
// A ROOM (a cell, a dungeon's, a building's, a private one) knows an account is followed only while a spectator
// following it stands in the room (`_fol`, counted from those sockets' tokens), and only then tells the bus that
// account came or went (FOLLOW_INTERNAL_SAY) - nothing for anyone nobody follows, so it costs nothing where nobody
// follows (design doc, Server load: "Costs only while someone follows").
import { FOLLOW_INTERNAL_SAY, FOLLOWERS_MAX, FOLLOWED_MAX, NOTE_STALE_MS, noteWhere, validFollowSay } from '../../src/net/staffFollow.js';
import { isChatRoom, isSocialRoom, SOCIAL_ROOM } from '../../src/net/wire.js';
import { ROOM_CALL_MS } from './relayScale.js';

/** @typedef {{ _attach: (ws: any) => any, _bySub: () => Map<string, Set<any>>, _send: (ws: any, s: string) => boolean, _setAttach: (ws: any, a: any, lazy?: boolean) => boolean, _dead: Set<any>, _gone: Set<any>, env?: any, _follows?: Map<string, Set<any>>, _fol?: Map<string, number> }} FollowRoom */

/** A socket still standing here - neither dead, gone, nor a shard's socket its shard let go (ShardSocket `closed`).
 *  @param {FollowRoom} room @param {any} ws */
const live = (room, ws) => !room._dead.has(ws) && !room._gone.has(ws) && !ws?.closed;
/** The other hello'd sockets of `sub` here, alive. @param {FollowRoom} room @param {string} sub @param {any} [except] */
function socketsOf(room, sub, except = null) {
  const out = [];
  for (const ws of room._bySub().get(sub) ?? []) if (ws !== except && live(room, ws)) out.push(ws);
  return out;
}
/** The spectators following `sub` on the bus, the ones no longer standing let go (a shard's socket can go unsaid).
 *  @param {FollowRoom} room @param {string} sub */
function followersOf(room, sub) {
  const set = room._follows?.get(sub);
  if (!set) return null;
  for (const ws of set) if (!live(room, ws)) set.delete(ws);
  if (!set.size) { room._follows?.delete(sub); return null; }
  return set;
}

/** (the bus) THE HUB'S COPY OF AN ACCOUNT'S WHERE NOTE - the staff-only read, by the verified account: the newest note
 *  among its hub links (as a party's view reads it, `_partyView`), with its room, while NOTE_STALE_MS old at most; else
 *  null (no link, an old build, a game that stopped sending).
 *  @param {FollowRoom} room @param {string} sub @param {number} now @returns {{ p: any, at: number } | null} */
export function noteOf(room, sub, now) {
  let pm = null;
  for (const ws of socketsOf(room, sub)) { const b = room._attach(ws); if (b.pm && (!pm || b.pm.at > pm.at)) pm = b.pm; }
  if (!pm || !(now - pm.at <= NOTE_STALE_MS)) return null;
  const { at, ...p } = pm;
  return { p, at };
}

/** One frame to every spectator following `sub` (the bus). @param {FollowRoom} room @param {string} sub @param {object} frame */
function tell(room, sub, frame) {
  const set = followersOf(room, sub);
  if (!set) return 0;
  const s = JSON.stringify({ t: 'fol', ...frame });
  for (const ws of set) room._send(ws, s);
  return set.size;
}

/** (the bus) A WHERE NOTE KEPT - a party member's or anyone's, already on its socket (`pm`, with its room `rk` inside
 *  it, written by the caller as SOC1 always wrote it): told to the spectators following its account when its room
 *  changed from `a.pm` (the attachment before), and handed back without `rk` for the party's fan - a room is the
 *  staff's to read, never a member's.
 *  @param {FollowRoom} room @param {any} a the attachment before the note @param {any} p the pose, parsed */
export function followNoted(room, a, p) {
  const was = a.pm;
  if (a.sub && room._follows?.has(a.sub) && noteWhere(was) !== noteWhere(p)) tell(room, a.sub, { k: 'note', sub: a.sub, p, ag: 0 });
  const { rk, ...fan } = p;
  void rk;
  return fan;
}

/** (the bus) A member's note as its party's view says it (index.js `_partyView`): a copy without its room (`rk`), the
 *  staff's to read and never a member's - so index.js never names `rk` (the relay reads nothing inside a foes
 *  frame, test/systems/raid2_raidsOnline.test.js: `rk` is a raid's word there). @param {any} p */
export const withoutRoom = (p) => { const { rk, ...rest } = p; void rk; return rest; };

/** (the bus) A HUB LINK'S HELLO - a spectator's (its verified `fo`) is held as one following that account, at most
 *  FOLLOWERS_MAX to an account and FOLLOWED_MAX accounts, and told `on`, then the note the hub holds - or `gone`.
 *  @param {FollowRoom} room @param {any} ws @param {number} now */
export function followHello(room, ws, now) {
  const a = room._attach(ws);
  if (typeof a?.fo !== 'string' || !isSocialRoom(a.key)) return;
  const follows = (room._follows ??= new Map());
  let set = followersOf(room, a.fo);
  if (!set) {
    if (follows.size >= FOLLOWED_MAX) return;   // never told `on`: its game follows nobody
    follows.set(a.fo, set = new Set());
  }
  if (set.size >= FOLLOWERS_MAX) return;
  set.add(ws);
  room._send(ws, JSON.stringify({ t: 'fol', k: 'on', sub: a.fo }));
  const n = noteOf(room, a.fo, now);
  if (n) room._send(ws, JSON.stringify({ t: 'fol', k: 'note', sub: a.fo, p: n.p, ag: Math.floor((now - n.at) / 1000) }));
  else if (!socketsOf(room, a.fo).length) room._send(ws, JSON.stringify({ t: 'fol', k: 'gone', sub: a.fo }));
}

/** (a room) Its word to the bus that a followed account came or went - never awaited, every failure caught here.
 *  STAFF-PANEL5-FOLLOW-FIX (the relay review's finding 1): with the account's socket's id here (`id`), the one name the
 *  spectator's game can find it by - a place room's roster and joins name no account (MOD1), so a follow matched by
 *  account never found its target, and the camera never locked on.
 *  @param {FollowRoom} room @param {string} sub @param {'in'|'out'} k @param {any} a the socket's attachment */
function say(room, sub, k, a) {
  const rooms = room.env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return;
  const body = JSON.stringify({ sub, k, room: a.key, ...(a.ly ? { ly: a.ly } : {}), id: a.id });
  void (async () => {
    try { await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${FOLLOW_INTERNAL_SAY}`, { method: 'POST', body, signal: AbortSignal.timeout(ROOM_CALL_MS) })); }
    catch (e) { console.warn('[follow] the bus did not hear a room', /** @type {any} */ (e)?.message ?? e); }
  })();
}

/** (a room) A HELLO HERE - a spectator's counts its account followed here (and says the account here already, if it
 *  is); an account followed here is said come. The hub and the channels keep their own law (above).
 *  @param {FollowRoom} room @param {any} ws @param {any} a its attachment */
export function followJoined(room, ws, a) {
  if (!a?.id || isChatRoom(a.key) || isSocialRoom(a.key)) return;
  if (typeof a.fo === 'string') {
    const fol = (room._fol ??= new Map());
    fol.set(a.fo, (fol.get(a.fo) ?? 0) + 1);
    const here = socketsOf(room, a.fo, ws)[0];
    if (here) say(room, a.fo, 'in', room._attach(here));
    return;
  }
  if (a.sub && room._fol?.has(a.sub) && socketsOf(room, a.sub, ws).length === 0) say(room, a.sub, 'in', a);
}

/** (any room, the bus included) A SOCKET GONE - a spectator's no longer counts (here) or follows (the bus); a followed
 *  account's last socket here is said gone (a room) or `gone` (the bus).
 *  @param {FollowRoom} room @param {any} ws @param {any} a its attachment */
export function followLeft(room, ws, a) {
  if (!a?.id) return;
  if (typeof a.fo === 'string') {
    const set = room._follows?.get(a.fo);
    if (set?.delete(ws) && !set.size) room._follows?.delete(a.fo);
    const n = room._fol?.get(a.fo);
    if (n != null) { if (n > 1) room._fol?.set(a.fo, n - 1); else room._fol?.delete(a.fo); }
    return;
  }
  // asked of the follow maps first: a leave anywhere nobody follows costs one look-up
  if (!a.sub || !(room._follows?.has(a.sub) || room._fol?.has(a.sub)) || socketsOf(room, a.sub, ws).length) return;
  if (isSocialRoom(a.key)) tell(room, a.sub, { k: 'gone', sub: a.sub });
  else if (!isChatRoom(a.key)) say(room, a.sub, 'out', a);
}

/** (the bus) A ROOM'S WORD, through FOLLOW_INTERNAL_SAY (reached by an object alone: the Worker forwards /room/<key>
 *  alone) - told to the spectators following that account. @param {FollowRoom} room @param {Request} request */
export async function followSayInternal(room, request) {
  let b;
  try { b = validFollowSay(await request.json()); } catch { b = null; }
  if (!b) return Response.json({ error: 'bad' }, { status: 400 });
  return Response.json({ ok: 1, told: tell(room, b.sub, b) });
}
