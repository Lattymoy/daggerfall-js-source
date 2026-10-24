// @ts-check
// FIELD BUGS 2026-10-18d SEAT-LIVE (FloopZe, the bug-reports channel, "Castle Daggerfall guards loot duping": "I am able to
// continuously enter/exit the castle and the loot/corpses respawn, duping the items/gold upon re-entering the castle. (This
// fixed itself after a few exits...)"): A DUNGEON ROOM'S SEAT IS A LIVE SOCKET'S.
//
// Two seats had grown apart. The relay named a room's host as the socket in it longest (WORLD1) and kept the room's
// memory and its foes stream from that socket alone; the page handed the room's foes to a joiner once that host had been
// heard from no more recently than FOES_STALE_MS (AUDIT WORLD2 C2/C5, SEAT-HEAL), and PARTY-LOOT's arbitration goes with
// the foes. A host whose page was hidden - a background tab, a minimised client: the frame loop stops, the socket stays
// open - kept the relay's seat for as long as its tab lived. The joiner who ran the room meanwhile, its kills, the bodies
// it minted, the takes it granted, wrote none of it to the memory, and every walk back in was welcomed with the silent
// host's last memory: the bodies full again, the dead standing. Measured over the dungeon's real doors in Node: 2280,
// 4560, 6840 gold in three visits to one castle.
//
// THE LAW, ONE HOME FOR BOTH ENDS:
// - THE RELAY'S SEAT IS AMONG THE LIVE (server/src/index.js `_hostOf`, `_leads`, `_seatHeard`; `seatOf` here). A dungeon
//   room's socket is live while it has said a frame - a pose, its stream, its own lane, its memory, never a ping (the
//   runtime answers that in the object's sleep) - within FOES_STALE_MS of another socket being there to hear it. Alone it
//   owes nothing. The seniority stands among the live (the earliest hello stamp, ties by id); with none live, the old law.
// - A SOCKET BACK FROM SILENCE IS A JOINER. Its hello stamp is now and it is told whose the seat is; it holds the seat
//   again only when the relay names it - so its frozen world never overwrites the room's.
// - THE PAGE ASKS FOR THE SEAT IT RUNS (net/online.js `_askSeat`): while no frame of the named host has come in for
//   FOES_STALE_MS, its pose goes every FOES_FULL_MS (`seatAskDue`), so a joiner standing still is heard and named.
// - THE PAGE'S OWN ABSENCE SPENDS NO SEAT'S PATIENCE (`createSeatClock`, scenes/world.js dungeonAuthority). A page back
//   from a hidden spell gives the named seat FOES_STALE_MS again before it takes the foes: SEAT-HEAL never hands the seat
//   to a page on its first frame back while the relay names another.
// A building's room keeps the old law: its host streams no foes (AUDIT WORLD6a B8), so a host standing there says no frame
// for minutes, and nothing there takes a seat by silence. Not a DFU member (DFU has no rooms).
import { FOES_FULL_MS, FOES_STALE_MS, FOES_PREFIX, OWN_PREFIX, WORLD_PREFIX, isWorldRoom } from './wire.js';

/** The relay that keeps a dungeon room's seat by liveness - a page asks only that one for the seat (`seatAskDue`). */
export const SEAT_RELAY_MIN = 220;
export const relaySupportsSeatLive = (/** @type {any} */ v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= SEAT_RELAY_MIN;
/** A pose's and a hello's first bytes, as the session writes them (`{ t: 'pose', p }`, `{ t: 'hello', ... }` - net/hubShards.js
 *  shardKeeps reads the same). */
export const POSE_PREFIX = '{"t":"pose"';
export const HELLO_PREFIX = '{"t":"hello"';
/** A room whose seat is a stream: a dungeon's world room - its public room, a re-laid one, an instance of it. */
export const seatStreams = (/** @type {any} */ key) => isWorldRoom(key) && String(key).startsWith('dungeon:');
/** A page's FRAME traffic - what its frame loop alone says (a hidden page says none of it): its hello, its pose, its foes
 *  stream, its own lane, its memory. Read by the first bytes, as the relay's doors read a frame. */
export const seatTraffic = (/** @type {any} */ message) => typeof message === 'string'
  && (message.startsWith(HELLO_PREFIX) || message.startsWith(POSE_PREFIX) || message.startsWith(FOES_PREFIX) || message.startsWith(OWN_PREFIX) || message.startsWith(WORLD_PREFIX));
/** When a socket came into the room: its hello (`hi`), else when it opened (`at`, AUDIT WB A1). */
export const seatInAt = (/** @type {any} */ a) => (Number.isFinite(a?.hi) ? a.hi : Number.isFinite(a?.at) ? a.at : 0);
/** When a socket was last heard: its last frame (`hd`), else its coming in - a socket new to the room is live from it. */
export const seatHeardAt = (/** @type {any} */ a) => (Number.isFinite(a?.hd) ? a.hd : seatInAt(a));
/** Whether the socket `a` is a silent seat at `now`: the room's other sockets have been there since `othersIn` (null or
 *  infinite: it is alone, and owes nothing), and it has said no frame for FOES_STALE_MS of that time. */
export const seatSilent = (/** @type {any} */ a, /** @type {number|null} */ othersIn, /** @type {number} */ now) =>
  othersIn != null && Number.isFinite(othersIn) && now - Math.max(seatHeardAt(a), othersIn) > FOES_STALE_MS;
/** For each of `list`'s attachments, since when another of them has been in the room: the earliest coming in among the
 *  others (`seatInAt`), or null for a socket alone. */
export function othersInOf(/** @type {any[]} */ list) {
  let first = null, second = Infinity;
  for (const a of list) {
    const t = seatInAt(a);
    if (!first || t < seatInAt(first)) { if (first) second = seatInAt(first); first = a; } else if (t < second) second = t;
  }
  return (/** @type {any} */ a) => { if (!first || list.length < 2) return null; return a === first ? second : seatInAt(first); };
}
/** Whether `a` is the elder of two hello'd attachments by WORLD1's seniority: the earlier hello stamp, ties by id. */
export const seatElder = (/** @type {any} */ a, /** @type {any} */ b) => !b || (a.since ?? 0) < (b.since ?? 0) || ((a.since ?? 0) === (b.since ?? 0) && a.id < b.id);
/** THE SEAT among `list` (hello'd attachments) at `now`: the eldest live one (`live`), else the eldest - WORLD1's law
 *  where no socket owes a frame, and for a room whose seat is no stream (`live` false). Its id, or null for none. */
export function seatOf(/** @type {any[]} */ list, /** @type {number} */ now, { live = true } = {}) {
  const hello = list.filter((a) => a?.id);
  const inOf = live ? othersInOf(hello) : null;
  let best = null, bestLive = null;
  for (const a of hello) {
    if (seatElder(a, best)) best = a;
    if (inOf && !seatSilent(a, inOf(a), now) && seatElder(a, bestLive)) bestLive = a;
  }
  return (bestLive ?? best)?.id ?? null;
}
/** THE PAGE'S CLOCK OF THE NAMED SEAT (scenes/world.js dungeonAuthority): heard when its stream lands or its word comes (a
 *  welcome, a host frame); alive while it was heard within `staleMs`. A gap of `staleMs` or more between this page's own
 *  frames is the page's own absence (a hidden tab draws none), and gives the seat its patience again from that frame. */
export function createSeatClock(staleMs = FOES_STALE_MS) {
  let heardAt = -Infinity, frameAt = /** @type {number|null} */ (null);
  return {
    heard(/** @type {number} */ now) { heardAt = now; },
    frame(/** @type {number} */ now) { if (frameAt != null && now - frameAt >= staleMs) heardAt = Math.max(heardAt, now); frameAt = now; },
    live(/** @type {number} */ now) { return now - heardAt < staleMs; },
  };
}
/** Whether the page asks the relay for the seat now (net/online.js `_askSeat`): a dungeon room at a seat-live relay, its
 *  socket open, another named host, whose stream has not come for FOES_STALE_MS, and no ask for FOES_FULL_MS. */
export const seatAskDue = (/** @type {{ streams: boolean, ok: boolean, open: boolean, host: any, mine: boolean, heardAt: number, askedAt: number, now: number }} */ s) =>
  !!(s.streams && s.ok && s.open && s.host && !s.mine && s.now - s.heardAt >= FOES_STALE_MS && s.now - s.askedAt >= FOES_FULL_MS);
