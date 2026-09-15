// @ts-check
// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer. The goal is
// being able to see others in the world while allowing you to bring
// over one of your own save file ... All I care about is being able to
// see and traverse with other players"): THE SESSION.
//
// THE SHAPE. Every player runs their own world from their own save;
// presence is shared (ONLINE1), words (CHAT1), a world room's memory
// (WORLD1 - the host's snapshot of the place, handed to whoever comes
// next) and its live foes (WORLD2 - the host's, streamed to the rest;
// a blow on them goes to the host) and its live doors (WORLD3 - a door,
// a lever or a platform moved by anyone, told to everyone else). This
// module holds one WebSocket to
// the relay (server/src/index.js on Cloudflare), in one ROOM at a time,
// says hello once with the player's look, sends the player's pose at
// POSE_HZ when it changes (and a heartbeat pose every HEARTBEAT_MS
// regardless), and keeps the peers the room reports - each with the
// pose it last sent and the pose it is DRAWN at, eased toward the last
// one so a peer walks rather than teleports. The hosts hand the frame's
// pose in and draw the peers out through net/remotePlayers.js.
//
// ROOMS. The wire's law (net/wire.js, the relay's one home): the
// streaming world sharded into WORLD_CELL-pixel cells, a town a room by
// location, a dungeon and an interior each a room by location. The key
// is minted here from what the host knows (roomKeyFor); when it changes
// the socket is closed and a new one opened on the new room.
//
// FRAMES. A world-cell room's pose is in MapsFile world units
// (streamingWorld.worldCoords, NATIVE_PIXEL a map pixel), y the scene's
// own; every other room's pose is the scene's local frame as the host
// holds the player - the peers are in the same scene. Nothing here
// converts: the host hands the pose in its room's frame and takes the
// peers back in it.
//
// AUDIT ONLINE (2026-09-12, the deep audit before the merge) rewrote the
// clock (B1: the hosts fed the rAF clock into Date.now() stamps - every
// peer stood frozen at its first pose, the timeout never fired and a
// dropped socket never reconnected), the silence law (B3/B11/B14: a peer
// standing still is not gone - only the room's leave removes a peer, a
// silent one is HIDDEN, and a heartbeat pose keeps the socket and the
// peers' clocks alive), the close codes (B4/B5: the relay's 1008 and
// 4000 are terminal, not a reconnect storm), the frames the relay sends
// (B7: checked by the same law the relay applies), the welcome (B13:
// merged, not wiped), the teleport (B12: a jump snaps, a walk eases),
// and the room key (B10: a location's map id, never a slug that could
// collide or a '-1.x' fallback that pooled the unknown).
//
// CHAT1 (2026-09-12, Mac: "the live chat in enhanced format ... one
// world tab with the ability to add more tabs at a later time"): a
// session opened with `presence: false` is a CHANNEL's - it says hello
// with no pose, sends no pose, heartbeats with a ping the relay's
// runtime answers in its sleep, and carries chat lines both ways:
// sendChat out, onChat in (net/chat.js keeps them, ui/chatPanel.js
// shows them). One such session per tab; the World tab's room is
// CHAT_WORLD_ROOM. The presence session can carry chat too (a place
// room relays a line as far as a pose) - the local tab, when it comes.
// AUDIT CHAT (2026-09-12): a channel session refuses a pose outright
// (D3); sendChat runs the relay's own chat gate first, so a line the
// relay would drop is refused here and the field keeps it (A8/B2); a
// terminal close is stamped, and rejoin() is the one door back for a
// session that never changes rooms (A6/B6) or was left by the page's
// goodbye (B4); statusLine takes its label (B5).
//
// WORLD1 (2026-09-12, Mac: "The world is the server ... True
// persistence"): the room's HOST - the relay's word, in the welcome
// and in a host frame - and the room's MEMORY: a welcome may carry
// the world the room keeps (onWorld), and the host publishes its own
// through sendWorld (the host of a world room alone; the relay ignores
// the rest). WORLD_PUBLISH_MS is how often.
//
// Not a DFU member: Daggerfall Unity has no multiplayer. Ledger A row.
import { tabStorage } from '../systems/appStorage.js';   // the tab's own storage - the seam, never the browser's own (a PIN)
import { wrapAngle } from '../world/mat4.js';   // ONCRASH1: the port's one angle wrap, which cannot loop

import { WORLD_CELL, RANGE_PIXELS, PIXEL_UNITS, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, WORLD_FRAME_MAX, worldFrameMaxFor, isCellRoom, hitOwnerOf, validPose, validLook, sanitizeName, sanitizeChat, chatGate, worldRoom, inRange, relayUrl, isWorldRoom, isChatRoom, foesGate, FOES_FRAME_MAX, MAX_FRAME_BYTES, hitGate, actGate, actFrameFits, whoGate, WHO_RETRY_MS } from './wire.js';

export { WORLD_CELL, RANGE_PIXELS, worldRoom };

/** Poses a second, at most, when the pose moved. */
export const POSE_HZ = 10;
/** A pose goes out at least this often, moved or not: the socket's keepalive and the peers' clock. */
export const HEARTBEAT_MS = 5000;
/** The relay this port hosts (server/wrangler.toml). */
export const DEFAULT_SERVER = 'wss://daggerfall-online.mackcothran.workers.dev';
/** A peer silent this long is HIDDEN (out of range, or its socket is
 *  gone and the leave is on its way); only the room's leave removes it. */
export const PEER_TIMEOUT_MS = 20000;
/** Reconnect backoff bounds, ms. */
export const BACKOFF_MIN_MS = 1000;
export const BACKOFF_MAX_MS = 8000;
/** How often a world room's host publishes the room's memory (WORLD1); the relay drops one sooner than WORLD_MIN_MS. */
export const WORLD_PUBLISH_MS = 15000;
/** WORLD2: how often the host streams its changed foes (5 a second - under FOES_HZ_MAX with room for a burst). */
export const FOES_MS = 200;
/** WORLD2: how often the stream carries EVERY layout foe, not the changed alone - a dropped delta heals within it. */
export const FOES_FULL_MS = 2000;
/** AUDIT WORLD2 C5: a seat heard from no more recently than this (its stream, or its word in the welcome) is not a
 *  live seat - the joiner steps its own foes rather than stand among frozen ones. */
export const FOES_STALE_MS = 3 * FOES_FULL_MS;
/** A pose farther than this from the drawn one is a teleport: the peer snaps rather than sweeps (world frame / scene frame). */
export const SNAP_WORLD_UNITS = PIXEL_UNITS / 8;
export const SNAP_SCENE_UNITS = 30;

/** A room-key segment: what the relay's key regex admits, bounded. */
export const slug = (s) => String(s ?? '').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 40) || 'x';

/**
 * The room the player is in, from what the host knows, or null when
 * it does not know enough (no room: no join, rather than a pooled
 * room of the unknown).
 * @param {object} p
 * @param {'world'|'exterior'} p.host   the streaming world or the fixed city
 * @param {'exterior'|'interior'|'dungeon'} p.mode   the mode machine's mode
 * @param {number} [p.mapId]       the location's MapTableData.MapId - unique across the Bay, the key of choice
 * @param {number} [p.regionIndex] the location's region, with its name, when there is no map id
 * @param {string} [p.locationName]
 * @param {number} [p.buildingKey] the interior's building
 * @param {{x:number,y:number}} [p.mapPixel] the player's map pixel (the streaming world's overworld)
 */
export function roomKeyFor({ host, mode, mapId = null, regionIndex = -1, locationName = '', buildingKey = 0, mapPixel = null }) {
  // AUDIT WORLD34 A1: the map id is MAPS.BSA's 32-bit integer read SIGNED (formats/mapsFile.js getInt32), so one with
  // bit 31 set read negative here and fell to the name slug - a room the wire keeps no world for. The UNSIGNED value
  // is the id, the same on every client; 0 alone is "no map row" (the probe's fixture)
  const id = Number.isFinite(mapId) ? mapId >>> 0 : 0;
  const loc = id > 0 ? `m${id}` : (locationName && regionIndex >= 0 ? `${regionIndex}.${slug(locationName)}` : null);
  if (mode === 'dungeon') return loc ? `dungeon:${loc}` : null;
  const bk = Number.isFinite(buildingKey) ? buildingKey >>> 0 : 0;   // AUDIT WORLD6a B5: unsigned, as the id is - the memory's key (interiorLocationKey) spells it so, and the two must agree by construction
  if (mode === 'interior') return loc && bk ? `interior:${loc}.${bk}` : null;   // a door the directory cannot key (0) is no room, not a pool of them
  if (host === 'exterior') return loc ? `town:${loc}` : null;
  if (!mapPixel) return null;
  return worldRoom(mapPixel.x, mapPixel.y);
}

/** Has a pose moved enough to send? Position by EPS units, angles by EPS radians. */
export function poseChanged(a, b, eps = 0.01) {
  if (!a || !b) return true;
  return Math.abs(a.x - b.x) > eps || Math.abs(a.y - b.y) > eps || Math.abs(a.z - b.z) > eps
    || Math.abs(a.yaw - b.yaw) > eps || Math.abs(a.pitch - b.pitch) > eps || (a.mv | 0) !== (b.mv | 0)
    || (a.wd | 0) !== (b.wd | 0) || (a.an | 0) !== (b.an | 0)   // MAC7 #1: a draw and a swing go out at once, as a step does
    || (a.am | 0) !== (b.am | 0) || (a.sr | 0) !== (b.sr | 0) || (a.cn | 0) !== (b.cn | 0);   // MAC7 #2: and the arrow, the spell stance, the cast
}

// ONCRASH1 (2026-09-15, Mac: "reports of player browser crashing when
// online"): the short arc, in ONE STEP. This was two `while` loops, and
// the angle they wrapped is a PEER'S YAW - a number this session takes
// from the relay and checked only for being finite. At a large one,
// `d - 2 * Math.PI === d` in doubles and the loop never falls: the tab
// stops answering and the browser kills it. Not the sender's tab, every
// OTHER tab in the room, which is why it read as random. The wrap is
// world/mat4.js's now (the port's one), and the door bounds the angle
// besides (net/wire.js validPose).
const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;

/** The pose between two, t in 0..1 (the yaw by the shorter arc). */
export function lerpPose(from, to, t) {
  if (!from) return { ...to };
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k,
    yaw: lerpAngle(from.yaw, to.yaw, k), pitch: from.pitch + (to.pitch - from.pitch) * k, mv: to.mv,
    wd: to.wd ?? 0, an: to.an ?? 0, as: to.as ?? 0,   // MAC7 #1: the arm's three ride the drawn pose whole - nothing to ease
    am: to.am ?? 0, sr: to.sr ?? 0, cn: to.cn ?? 0, cr: to.cr ?? 0,   // MAC7 #2: and the other four
  };
}

/** The distance between two poses on the ground. */
const groundDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** A token minted once and kept in storage under `key`, or fresh when storage will not keep it. */
function keptToken(storage, key, re, mint) {
  try {
    const have = storage?.getItem?.(key);
    if (have && re.test(have)) return have;
  } catch { /* storage disabled */ }
  const v = mint();
  try { storage?.setItem?.(key, v); } catch { /* storage disabled */ }
  return v;
}

/** The player's id: minted once per TAB and kept for its life (TABS1: two
 *  tabs of one browser are two players, whatever each loaded; a reload of
 *  the tab keeps the id, so a reconnect replaces its own old socket). */
export const peerId = (storage = tabStorage()) => keptToken(storage, 'dagger.online.id', /^[A-Za-z0-9_-]{4,40}$/,
  () => 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4));

/** The id's secret (AUDIT ONLINE A3): minted beside it, kept beside it, sent only in the hello. */
export const peerSecret = (storage = tabStorage()) => keptToken(storage, 'dagger.online.secret', /^[A-Za-z0-9_-]{8,64}$/,
  () => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join(''));

/**
 * One player's connection to the relay: one room at a time, the
 * peers of that room. Pure of the DOM: the WebSocket class and the
 * clock are handed in, so the tests drive it with a fake socket. Every
 * stamp inside is the handed-in clock's (Date.now() unless told
 * otherwise); nothing outside passes a time in.
 */
/** OL3: the HUD line while the relay's clock and this machine's disagree by more than a year - the world's time is read uncorrected. */
export const CLOCK_WARNING = 'this machine\'s clock is more than a year from the world\'s - set it, or the shared time is wrong here';
/** ONCRASH1: how long a contained handler throw is said on the HUD line. Long enough for a player to read and report it,
 *  short enough that one transient frame does not brand the session; `stats.threw` and the console keep the rest. */
export const THREW_SAY_MS = 30000;
/** AUDIT ONCRASH1 A5: distinct throws remembered before the said-once set is emptied - a bound, so a crafted stream of
 *  unique messages cannot grow it without end. */
export const THREW_KINDS_MAX = 32;
/** AUDIT ONCRASH1 A6: a MONOTONIC reading for the HUD's window - never the wall clock, which steps. */
const monoNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

export class OnlineSession {
  constructor({ url = DEFAULT_SERVER, name = 'Traveller', look = null, id = null, secret = null, presence = true, WebSocketImpl = globalThis.WebSocket, now = () => Date.now() } = {}) {
    this.url = relayUrl(url || DEFAULT_SERVER);   // wss:// anywhere, ws:// on localhost alone; anything else is no relay (A16/E11)
    this.secret = secret ?? peerSecret();
    this.name = name;
    this.presence = !!presence;   // false: a channel's session (CHAT1) - no pose out, a ping for a heartbeat
    this.onChat = null;           // (line) => void: a chat line in - {id, name, text, at, mine}
    this.onFoes = null;           // WORLD2: (id, data) => void - the host's live foes in (a non-host's, from the room's host alone)
    this.onHit = null;            // WORLD2: (id, data) => void - a blow on my foe in (the host's, from anyone)
    this.onAct = null;            // WORLD3: (id, data) => void - a door, a lever or a platform moved by another in my room
    this._abucket = null;         // WORLD3: the actions' own gate at home (ACT_HZ_MAX)
    this._fbucket = null;         // WORLD2: the foes stream's own gate, the relay's law kept at home
    this._hbucket = null;         // AUDIT WORLD2 A6: the hits' own gate at home (HIT_HZ_MAX), so a blow never starves the poses at the relay
    this._wbucket = null;         // WORLD6b-iii(e): the asks' own gate at home (WHO_HZ_MAX)
    this._who = new Map();        // WORLD6b-iii(e): id -> when it was asked for (a stranger beyond the welcome's roster, asked once per WHO_RETRY_MS)
    this.host = null;             // WORLD1: the room's host, the relay's word; null until the welcome
    this.onHost = null;           // (id, mine) => void: the host changed
    this.onWorld = null;          // (world) => void: the welcome carried the room's memory, or the host published one after it (AUDIT WORLD34 C1)
    this.clockOffsetMs = 0;       // WORLD5: the relay's clock minus this machine's, from the welcome - the shared world time is read through it
    this.clockWarning = null;     // OL3: the welcome's clock was a year off this machine's - said on the HUD line while it stands
    this.onClock = null;          // WORLD5: (offsetMs) => void - the welcome said the relay's clock
    this.look = look ?? { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
    this.id = id ?? peerId();
    this._WS = WebSocketImpl;
    this._now = now;
    this.room = null;
    this.status = 'idle';      // idle | connecting | open | closed | error
    this.error = null;         // what went wrong, for a person
    this.terminal = false;     // the relay closed with a reason a retry will not change (replaced, refused)
    this.terminalAt = null;    // when it did (the session's clock): rejoin() waits on it
    this._cbucket = null;      // the client's own chat gate (AUDIT CHAT A8): the relay's law, run first
    this.peers = new Map();    // id -> { id, name, look, pose, from, at, shown, seenAt } - MERGED over every room held (WORLD6b-iii(b))
    this._rooms = new Map();   // WORLD6b-iii(b): room -> Set<id> - which rooms report which peers; a peer stays in `peers` while any room holds it
    this._halo = new Map();    // WORLD6b-iii(b): room -> { ws, status, retryAt, backoff } - the neighbouring cells within range (hello'd and posed into, listened to, never streamed to: my own cell's fan reaches everyone in range)
    this._ws = null;
    this._lastSent = null;
    this._lastSentAt = -Infinity;
    this._pose = null;
    this._backoff = BACKOFF_MIN_MS;
    this._retryAt = null;
    this._closedByUs = false;
    this.stats = { sent: 0, poses: 0, received: 0, reconnects: 0, chats: 0, worlds: 0, foes: 0, hits: 0, acts: 0, threw: 0 };
    /** ONCRASH1: what the last contained handler threw, for a person - `{ kind, text, at }` or null. */
    this.threw = null;
    this._threwKinds = new Set();   // said in full once a kind; the rest are counted
  }

  /** Enter a room (leaving the last). The pose is the hello's. AUDIT WORLD34 D5: said out loud, with whether the
   *  wire keeps a world for it - until now nothing on screen or in the console told a player whether the dungeon
   *  they stood in was shared or merely peopled. */
  join(room, pose = null) {
    if (room === this.room && this._ws) return;
    this._threwKinds.clear();   // AUDIT ONCRASH1 A5: a new room says its own throws out loud - the first `world` throw of a session silenced the console for every later dungeon's
    this._who.clear();   // AUDIT WORLD6b-iii(e) B4: a crossing forgets who was asked - an answer lost in the last cell (its socket died, the peer's leave raced the ask) held the stranger unseen for WHO_RETRY_MS in this one
    const h = this._halo.get(room);
    // AUDIT WORLD6b-iii(b) A1/B7/C2: a LIVE, OPEN halo alone is promoted - one dropped and pending its retry (ws null)
    // handed a dead socket to the primary and the next setHalo closed the good one; a stale entry is dropped and the
    // ordinary join stands the cell's socket at once
    if (h && !(h.ws && h.status === 'open')) this._halo.delete(room);
    if (h && h.ws && h.status === 'open' && this._ws && isCellRoom(room) && isCellRoom(this.room)) {
      // WORLD6b-iii(b): a crossing into a cell already hello'd as a halo PROMOTES its socket - no close, no reconnect,
      // no roster wiped (the seam crossing was a churn: every puppet gone, every peer re-said); the cell left steps
      // down to a halo, and setHalo lets it go once it is out of range. AUDIT WORLD6b-iii(b) A6: the demoted entry's
      // status is the SOCKET's - open, or still connecting (an 'error' after a relay error frame is a close on its way)
      const old = { ws: this._ws, status: this.status === 'open' ? 'open' : 'connecting', retryAt: null, backoff: BACKOFF_MIN_MS, since: this._now() };
      this._halo.delete(room);
      this._halo.set(this.room, old);
      this._ws = h.ws; this.status = h.status; this.error = null; this._retryAt = h.retryAt; this._backoff = h.backoff;
      this.room = room;
      this._pose = pose ?? this._pose;
      this._lastSent = null; this._lastSentAt = -Infinity;
      this._setHost(null);   // a cell keeps no host
      console.info(`[online] room ${room} - shared country (each player's foes are everyone's), crossed`);
      return;
    }
    this.leave();
    this.room = room;
    console.info(`[online] room ${room} - ${isWorldRoom(room) ? 'a shared world' : isCellRoom(room) ? 'shared country (each player\'s foes are everyone\'s)' : isChatRoom(room) ? 'a chat channel' : 'presence only'}`);   // WORLD6b: a cell says what it shares
    this._pose = pose ?? this._pose;
    this._closedByUs = false;
    this.terminal = false;
    this._backoff = BACKOFF_MIN_MS;
    this._open();
  }

  /** Leave the room: the socket closes, the peers go - and every halo's with it (WORLD6b-iii(b)). */
  leave() {
    this._closedByUs = true;
    const ws = this._ws;
    this._ws = null;
    if (ws) { try { ws.close(1000, 'leaving'); } catch { /* already closed */ } }
    this._endHalo();
    this._rooms.clear();
    this._retryAt = null;
    this.room = null;
    this.peers.clear();
    this._who.clear();   // AUDIT WORLD6b-iii(e) B4: the asked list goes with the room - a stranger asked here is asked at once in the next
    this.status = 'closed';
    this._setHost(null);   // AUDIT WORLD2 C2: through the one door, so the world host hears the seat go with the room
  }

  /** WORLD6b-iii(b): the HALO - the neighbouring cell rooms to hold besides my own (wire.cellHaloFor's list): a room
   *  wanted and not held is hello'd into, a room held and not wanted is left (its peers go unless another room holds
   *  them). Only a cell has a halo; anywhere else the list is emptied. */
  setHalo(rooms) {
    // AUDIT WORLD6b-iii(b) A5: the halo's life is the ROOM's, not the primary socket's - a one-second blip of my own
    // cell's socket closed every halo, wiped the seam's roster and re-hello'd the neighbours on the way back
    const want = new Set(isCellRoom(this.room) && !this.terminal ? (rooms ?? []).filter((r) => isCellRoom(r) && r !== this.room) : []);
    for (const [room, h] of [...this._halo]) {
      if (want.has(room)) continue;
      this._halo.delete(room);
      try { h.ws?.close(1000, 'leaving'); } catch { /* already closed */ }
      this._forgetRoom(room);
    }
    for (const room of want) if (!this._halo.has(room)) this._openHalo(room);
  }
  /** AUDIT WORLD6b-iii(b) A4: every halo ended - leave's, and the primary's terminal close (the verdict is the
   *  session's, not one socket's; the halos posed my ghost and stood puppets I could not strike back until now). */
  _endHalo() {
    for (const [room, h] of this._halo) { try { h.ws?.close(1000, 'leaving'); } catch { /* already closed */ } this._forgetRoom(room); }
    this._halo.clear();
  }
  /** WORLD6b-iii(b): the halo rooms held now (for the next cellHaloFor, its hysteresis). */
  haloRooms() { return [...this._halo.keys()]; }
  /** WORLD6b-iii(b): do I hold a socket in this room - my own cell, or a halo's? A foes frame keyed to a halo room is
   *  the world (its owner's cell), one keyed to a room I am not in is not. */
  inRoom(key) { return !!key && ((key === this.room && !!this._ws) || this._halo.get(key)?.status === 'open'); }
  _member(room, id, p, now) {
    let s = this._rooms.get(room);
    if (!s) this._rooms.set(room, s = new Set());
    s.add(id);
    const have = this.peers.get(id);
    if (have) this._refresh(have, p, now); else this.peers.set(id, this._peer(p, now));
  }
  _held(id) { for (const s of this._rooms.values()) if (s.has(id)) return true; return false; }
  /** WORLD6b-iii(e): a frame from an id I hold in NO room - a member beyond the welcome's roster (ROSTER_MAX bounds the
   *  welcome, the nearest; a room holds up to SOCKETS_MAX) whose pose, foes or blow reached me through the relay, which
   *  relays only a hello'd socket's frames. Asked for by name through the socket the frame came on, once per
   *  WHO_RETRY_MS per id and WHO_HZ_MAX a second in all; the relay answers with its join, and the next frame is a
   *  peer's. An ask that cannot be sent (no open socket, the gate) is not marked, so the next frame asks. */
  _askWho(room, id, now) {
    if (typeof id !== 'string' || id === this.id || this.peers.has(id)) return false;
    const at = this._who.get(id);
    if (at != null && now - at < WHO_RETRY_MS) return false;
    const ws = room === this.room ? (this.status === 'open' ? this._ws : null) : (this._halo.get(room)?.status === 'open' ? this._halo.get(room).ws : null);
    if (!ws) return false;
    const gate = whoGate(this._wbucket, now);
    this._wbucket = gate.bucket;
    if (!gate.pass) return false;
    try { ws.send(JSON.stringify({ t: 'who', id })); this.stats.sent++; } catch { return false; }
    if (this._who.size >= 256) for (const [k, t] of [...this._who]) if (now - t >= WHO_RETRY_MS) this._who.delete(k);   // the asked list is bounded by its own retry
    this._who.set(id, now);
    return true;
  }
  _unmember(room, id) {
    this._rooms.get(room)?.delete(id);
    if (!this._held(id)) this.peers.delete(id);
  }
  _forgetRoom(room) {
    const s = this._rooms.get(room);
    this._rooms.delete(room);
    if (s) for (const id of s) if (!this._held(id)) this.peers.delete(id);
  }
  _openHalo(room, backoff = BACKOFF_MIN_MS) {
    if (!this.url || !this._WS) return;
    let ws;
    // AUDIT WORLD6b-iii(b) A7: a socket that cannot be made is an entry with a retry, not nothing (nothing was re-tried every frame)
    try { ws = new this._WS(`${this.url}/room/${room}`); } catch { this._halo.set(room, { ws: null, status: 'closed', retryAt: this._now() + backoff, backoff: Math.min(BACKOFF_MAX_MS, backoff * 2), since: this._now() }); return; }
    this._halo.set(room, { ws, status: 'connecting', retryAt: null, backoff, since: this._now() });
    this._bind(ws);
  }
  /** Which room a socket serves NOW - the primary's, a halo's, or none (a stale socket's events are ignored). The
   *  role is read at event time, so a promoted or demoted socket keeps its handlers (WORLD6b-iii(b)). */
  _roomOf(ws) {
    if (ws && this._ws === ws) return this.room;
    for (const [room, h] of this._halo) if (h.ws === ws) return room;
    return null;
  }

  /** Am I the room's host (WORLD1)? False until the welcome says so. */
  isHost() { return !!this.id && this.host === this.id; }

  /** The room's memory out (WORLD1): the host's alone - the relay ignores anyone else's - and never a frame past
   *  WORLD_FRAME_MAX, which the relay would refuse with a terminal close. False when nothing went. */
  sendWorld(data, { final = false } = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!this.isHost() || !isWorldRoom(this.room) || !this._ws || this.status !== 'open') return false;   // AUDIT WORLD34 D3: the one out-frame without the room's guard said true where the relay kept nothing
    const s = JSON.stringify(final ? { t: 'world', data, final: true } : { t: 'world', data });   // final: the socket's one farewell inside the relay's floor (AUDIT WORLD B5)
    if (s.length > worldFrameMaxFor(this.room)) return false;   // AUDIT WORLD6a B3: a building's memory has its own, smaller cap
    try { this._ws.send(s); this.stats.sent++; this.stats.worlds++; return true; } catch { return false; }
  }

  /** WORLD2: the host's live foes out - the host's alone, in a world room, FOES_HZ_MAX a second on the stream's own
   *  bucket (a frame over it is kept home rather than struck by the relay), never past FOES_FRAME_MAX. */
  sendFoes(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    // WORLD6b: in a cell anyone streams (a foe is its spawner's); in a world room the host alone
    if (!(isCellRoom(this.room) || (this.isHost() && isWorldRoom(this.room))) || !this._ws || this.status !== 'open') return false;
    const gate = foesGate(this._fbucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'foes', data });
    if (s.length > FOES_FRAME_MAX) return false;
    try { this._ws.send(s); } catch { return false; }
    this._fbucket = gate.bucket; this.stats.sent++; this.stats.foes++;
    return true;
  }

  /** WORLD2: a blow on the host's foe out - anyone but the host (the host applies its own), in a world room. */
  sendHit(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    // WORLD6b: in a cell the blow names its owner (`to`, a peer, never me); in a world room it goes to the host, as WORLD2 has it
    const cell = isCellRoom(this.room);
    // AUDIT WORLD6b A6: the owner must be a peer I KNOW (the roster's) - a blow to an owner already gone bought the relay's funnel for nothing
    if (cell ? (!hitOwnerOf(data) || hitOwnerOf(data) === this.id || !this.peers.has(hitOwnerOf(data))) : (this.isHost() || !this.host || !isWorldRoom(this.room))) return false;
    // AUDIT FOES FOE3 (2026-09-15, Mac relaying players: "certain enemies cant be
    // damaged"): THE PRIMARY SOCKET IS NOT THE ONLY WAY OUT, AND THIS ASKED FOR IT
    // FIRST. A cell's blow is routed below, over the owner's own cell, mine, or any
    // HALO - and this line vetoed the frame before that loop could pick one. So while
    // my own cell's socket was down (reconnecting, a room at SOCKETS_MAX, the RTT of
    // any crossing that is not a halo promotion) every foe owned by every peer went
    // bullet-proof, while its stream kept arriving through the halo and it kept
    // walking and swinging. sendPose learned this exact lesson at AUDIT
    // WORLD6b-iii(b) A5 ("through every OPEN socket, my own cell's down or not");
    // sendHit never did. In a cell the ROUTING LOOP is the check - it tests each
    // socket's own status and refuses when none is open. A world room still goes out
    // of the one socket it has.
    if (!cell && (!this._ws || this.status !== 'open')) return false;
    // WORLD6b-iii(b): in a cell the blow goes through the OWNER's cell - the room its frame was keyed to (`k`), where its
    // socket is; a halo's when that is not my own. The owner must be reported there (the relay routes `to` inside the
    // one room); an owner in no room I hold is not mine to strike
    let ws = this._ws;
    if (cell) {
      // AUDIT WORLD6b-iii(b) A3: the frame's cell is a PREFERENCE, not a veto - an owner that crossed since the frame
      // that keyed my blow is struck where it is REPORTED: its cell, then my own, then any halo; a blow was refused
      // for a foes interval at every crossing until now, and silently
      const owner = hitOwnerOf(data), k = typeof data.k === 'string' ? data.k : this.room;
      const has = (r) => !!this._rooms.get(r)?.has(owner);
      const sock = (r) => (r === this.room ? (this.status === 'open' ? this._ws : null) : (this._halo.get(r)?.status === 'open' ? this._halo.get(r).ws : null));
      let via = null;
      for (const r of [k, this.room, ...this._halo.keys()]) if (has(r) && sock(r)) { via = sock(r); break; }
      if (!via) return false;
      ws = via;
    }
    const gate = hitGate(this._hbucket, this._now());   // AUDIT WORLD2 A6: HIT_HZ_MAX a second at home - refused to the caller, never dropped by the relay unseen
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'hit', data });
    if (s.length > MAX_FRAME_BYTES) return false;
    try { ws.send(s); } catch { return false; }
    this._hbucket = gate.bucket; this.stats.sent++; this.stats.hits++;
    return true;
  }

  /** WORLD3: a change to my room's doors, levers or movers out - anyone's, in a world room, ACT_HZ_MAX a second at
   *  home (refused to the caller past it), under the small cap. */
  sendAct(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!isWorldRoom(this.room) || !this._ws || this.status !== 'open') return false;
    const gate = actGate(this._abucket, this._now());
    if (!gate.pass) return false;
    if (!actFrameFits(data)) return false;   // AUDIT WORLD4 A1: the one home the host reads too
    const s = JSON.stringify({ t: 'act', data });
    try { this._ws.send(s); } catch { return false; }
    this._abucket = gate.bucket; this.stats.sent++; this.stats.acts++;
    return true;
  }

  _setHost(id) {
    const host = typeof id === 'string' ? id : null;
    if (host === this.host) return;
    this.host = host;
    if (host && isWorldRoom(this.room)) console.info(`[online] host ${host}${host === this.id ? ' (me)' : ''}`);   // AUDIT WORLD34 D5
    this._deliver('host', () => this.onHost?.(host, this.isHost()));   // ONCRASH1: the host change swaps who steps the room's foes - the biggest handler of the lot
  }

  _open() {
    if (!this.url) { this.status = 'error'; this.error = 'the relay must be a wss:// address'; this.terminal = true; this.terminalAt = this._now(); return; }
    if (!this.room || !this._WS) { this.status = 'error'; this.error = 'no WebSocket'; return; }
    let ws;
    try { ws = new this._WS(`${this.url}/room/${this.room}`); } catch (e) { this.status = 'error'; this.error = String(e?.message ?? e); this._scheduleRetry(); return; }
    this._ws = ws;
    this.status = 'connecting';
    this._bind(ws);
  }

  /** The one handler set for a socket, the primary's or a halo's - the role is read at event time (_roomOf). */
  _bind(ws) {
    ws.onopen = () => {
      const room = this._roomOf(ws);
      if (room == null) return;
      const hello = JSON.stringify({ t: 'hello', id: this.id, secret: this.secret, name: this.name, look: this.look, pose: this.presence ? this._pose : null });
      if (room === this.room) {
        this.status = 'open'; this.error = null; this._backoff = BACKOFF_MIN_MS;
        this._lastSent = null; this._lastSentAt = -Infinity;
        this._send({ t: 'hello', id: this.id, secret: this.secret, name: this.name, look: this.look, pose: this.presence ? this._pose : null });
        if (!this.presence) this._lastSentAt = this._now();   // the heartbeat clock starts at the hello
      } else {
        const h = this._halo.get(room);
        h.status = 'open'; h.backoff = BACKOFF_MIN_MS; h.retryAt = null;
        try { ws.send(hello); this.stats.sent++; } catch { /* the close will say */ }
      }
    };
    // AUDIT ONCRASH1 C3: THE DOOR IS HERE, and the first cut left it open. `_deliver` wrapped the handler CALLS, so a
    // throw in `_receive`'s own body - the roster prune, `_member`, `_askWho`, a projection - still reached the window
    // and painted the overlay. Driven in a real browser to prove it. The frame is one contained act from the outside in.
    ws.onmessage = (ev) => this._deliver('frame', () => { const room = this._roomOf(ws); if (room != null) this._receive(ev.data, room); });
    ws.onclose = (ev) => {
      const room = this._roomOf(ws);
      if (room == null) return;
      const code = ev?.code ?? 1005;
      if (room !== this.room) {
        // WORLD6b-iii(b): a halo's socket closed - its peers go unless another room holds them; a terminal close ends
        // the halo (the primary hears the same verdict on its own socket), a busy or dropped one is retried on tick
        const h = this._halo.get(room);
        this._forgetRoom(room);
        if (this._closedByUs) { this._halo.delete(room); return; }
        // AUDIT WORLD6b-iii(b) A2: a terminal verdict is REMEMBERED (ws null, no retry) - the entry deleted, setHalo
        // re-opened the room the next frame, and a refused hello became connect-hello-refuse at the wire's rate
        if (code === CLOSE_REPLACED || code === CLOSE_POLICY) { h.ws = null; h.status = 'terminal'; h.retryAt = null; return; }
        h.ws = null; h.status = 'closed';
        if (code === CLOSE_BUSY) h.backoff = Math.max(h.backoff, BACKOFF_MAX_MS / 2);
        h.retryAt = this._now() + h.backoff; h.backoff = Math.min(BACKOFF_MAX_MS, h.backoff * 2);
        return;
      }
      this._ws = null;
      this._setHost(null);   // AUDIT WORLD2 A2/C2: a dead socket holds no seat - the host is unknown until the next welcome, and the world host hears it (onHost)
      if (code === CLOSE_REPLACED) { this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = 'this character is online in another window'; this._endHalo(); return; }   // AUDIT WORLD6b-iii(b) A4
      if (code === CLOSE_POLICY) { this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = this.error ?? 'the relay refused a frame'; this._endHalo(); return; }
      if (code === CLOSE_BUSY) { this.status = 'closed'; this.error = 'the room is busy'; this._backoff = Math.max(this._backoff, BACKOFF_MAX_MS / 2); this._scheduleRetry(); return; }   // full or gated: back off hard, then try again
      this.status = 'closed';
      if (!this._closedByUs) this._scheduleRetry();
    };
    ws.onerror = () => { const room = this._roomOf(ws); if (room === this.room && room != null) { this.status = 'error'; this.error = 'socket error'; } };
  }

  _scheduleRetry() {
    if (this._closedByUs || this.terminal || !this.room) return;
    this._retryAt = this._now() + this._backoff;
    this._backoff = Math.min(BACKOFF_MAX_MS, this._backoff * 2);
  }

  _send(o) {
    if (!this._ws || this.status !== 'open') return false;
    try { this._ws.send(JSON.stringify(o)); this.stats.sent++; return true; } catch { return false; }
  }

  /** The frame's pose: sent at POSE_HZ when it moved, and every HEARTBEAT_MS regardless. A channel session refuses it (AUDIT CHAT D3). */
  sendPose(pose) {
    if (!this.presence) return false;
    this._pose = pose;
    const now = this._now();
    if (now - this._lastSentAt < 1000 / POSE_HZ) return false;
    if (now - this._lastSentAt < HEARTBEAT_MS && !poseChanged(this._lastSent, pose)) return false;
    // WORLD6b-iii(b): the halo rooms hear my pose too - their fans range me by it and their rosters place me. AUDIT
    // WORLD6b-iii(b) A5: through every OPEN socket, my own cell's down or not (the halos rode out nothing while the
    // fan sat behind the primary's send)
    let went = this._send({ t: 'pose', p: pose });
    if (this._halo.size) { const s = JSON.stringify({ t: 'pose', p: pose }); for (const [, h] of this._halo) if (h.status === 'open' && h.ws) { try { h.ws.send(s); this.stats.sent++; went = true; } catch { /* the close will say */ } } }
    if (!went) return false;
    this._lastSent = { ...pose }; this._lastSentAt = now; this.stats.poses++;
    return true;
  }

  /** A chat line out (CHAT1): sanitized here as the relay sanitizes it, and gated here as the relay gates it
   *  (AUDIT CHAT A8: the relay drops an over-rate line without a word, so the client refuses it first and the
   *  caller keeps the text); false when nothing went - nothing to say, over the rate, or no open socket. */
  sendChat(text) {
    const line = sanitizeChat(text);
    if (!line) return false;
    const gate = chatGate(this._cbucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'chat', text: line })) return false;
    this._cbucket = gate.bucket;   // the token is spent only on a line that left
    this.stats.chats++;
    return true;
  }

  /** The one door back for a session nothing else re-joins (AUDIT CHAT A6/B4/B6): a channel never changes
   *  rooms, so a page's goodbye (leave) or a terminal close would otherwise hold for the life of the page.
   *  Joins `room` at once after a leave, and once `afterMs` has passed since a terminal close; false when
   *  the session is fine or the wait is not up. */
  rejoin(room, afterMs) {
    if (this.room && !this.terminal) return false;
    if (this.terminal && this._now() - (this.terminalAt ?? 0) < afterMs) return false;
    this.join(room);
    return true;
  }

  /** ONCRASH1 (2026-09-15, Mac: "reports of player browser crashing when
   *  online"): THE HANDLER'S THROW IS CONTAINED HERE, AND SAID.
   *
   *  `_receive` runs inside the WebSocket's `onmessage`, and the handlers
   *  it calls are not small: `onFoes` stands and steps puppets, `onWorld`
   *  applies a whole room's memory, `onAct` moves doors and platforms,
   *  `onHit` lands damage and mints loot - the port's entire foe, world
   *  and door machinery, reached from a callback with nothing around it.
   *  A throw anywhere in there had no catch between it and the event
   *  loop, so it arrived at main.js's `addEventListener('error')` as an
   *  UNCAUGHT error and put the red CRASH overlay over the run. Online,
   *  always: offline, none of this code is reached from a socket.
   *
   *  So one player's malformed or unexpected frame ended everybody's
   *  session, and the same frame repeated on the next stream tick ended
   *  it again. A relay frame is ANOTHER PLAYER'S WORD, and the port
   *  already knows what to do with a throw from one - AUDIT MWBODY A1:
   *  "a throw from one peer's rig is that peer's doll, never the frame's
   *  end". This is that law at the wire's own door.
   *
   *  IT IS NOT A CATCH-AND-FORGET. The frame is dropped, the session
   *  stands, and the throw is counted in `stats.threw`, kept in `threw`
   *  for `statusLine` to say on the HUD, and printed in FULL the first
   *  time each kind throws - once a kind, because a stream that throws
   *  throws at FOES_HZ_MAX and a console flood is its own outage. What
   *  threw is still a bug; this stops it being everyone's crash while it
   *  is found. */
  /** AUDIT ONCRASH1 A1: AND THE ASYNC TAIL, which the first cut let through.
   *  `_deliver` returned the moment `fn` did, and three sites reached from
   *  inside `onWorld`/`onFoes` start a promise whose `.then` body is deep
   *  game code with no `.catch` (dungeonContext.js retypeFoe's arms). The
   *  throw landed one microtask later as an UNHANDLED REJECTION - main.js
   *  listens for those too, so it was the same red overlay on the same
   *  wire input, out of the same handler. A handler that hands back a
   *  thenable is followed to its end. */
  _deliver(kind, fn) {
    try {
      const r = fn();
      if (r && typeof r.then === 'function') r.then(null, (e) => this._contain(kind, e));
    } catch (e) { this._contain(kind, e); }
  }
  /** AUDIT ONCRASH1 A5: SAID ONCE PER THROW, not once per KIND. The first
   *  cut gated the console on the kind alone, so the second, usually more
   *  informative `foes` throw was never printed - while `threw` (the HUD's
   *  text) was overwritten by it. The player read error B off the screen
   *  and the console held the stack for error A, which is precisely the
   *  pairing this was built to prevent. The gate is the kind AND the text,
   *  bounded (a crafted message stream is its own flood) and emptied with
   *  the room. */
  _contain(kind, e) {
    this.stats.threw++;
    const text = `${e?.name ?? 'Error'}: ${e?.message ?? e}`;
    // AUDIT ONCRASH1 A6: the HUD's window is measured on a MONOTONIC reading. `_now` is wall time, and a backwards
    // clock step - which is what a player does right after OL3's CLOCK_WARNING tells them to fix their clock - made
    // `now - at` negative, so the line never went away.
    this.threw = { kind, text, at: this._now(), mono: monoNow() };
    const key = `${kind}:${text}`;
    if (this._threwKinds.has(key)) return;
    if (this._threwKinds.size >= THREW_KINDS_MAX) this._threwKinds.clear();
    this._threwKinds.add(key);
    console.error(`[online] a '${kind}' frame threw - the frame is dropped, the session stands: ${text}`, e);
  }

  _receive(data, room = this.room) {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    this.stats.received++;
    const now = this._now();
    const primary = room === this.room;   // WORLD6b-iii(b): a halo room's frames place its peers and carry a peer's foes and blows; the host, the clock and the memory are my own room's alone
    if (m.t === 'welcome') {
      // merged, not wiped: a peer already known keeps where it is drawn
      const keep = new Set();
      for (const p of Array.isArray(m.peers) ? m.peers : []) {
        if (!p || typeof p.id !== 'string' || p.id === this.id) continue;
        keep.add(p.id);
        this._member(room, p.id, p, now);
      }
      for (const id of [...(this._rooms.get(room) ?? [])]) if (!keep.has(id)) this._unmember(room, id);
      if (!primary) return;
      this._setHost(m.host);   // WORLD1: the room's host, and the room's memory when it keeps one
      if (Number.isFinite(m.now)) {   // WORLD5: the relay's clock - a year off is no clock; OL3: and is SAID, on the console and the HUD line, rather than run uncorrected in silence
        if (Math.abs(m.now - Date.now()) < 366 * 24 * 3600 * 1000) { this.clockOffsetMs = m.now - Date.now(); this.clockWarning = null; this._deliver('clock', () => this.onClock?.(this.clockOffsetMs)); }
        else if (!this.clockWarning) { this.clockWarning = CLOCK_WARNING; console.warn(`[online] ${CLOCK_WARNING} (relay ${new Date(m.now).toISOString()}, this machine ${new Date().toISOString()})`); }
      }
      if (m.world && typeof m.world === 'object' && !Array.isArray(m.world)) this._deliver('world', () => this.onWorld?.(m.world));
    } else if (m.t === 'host') {
      if (primary) this._setHost(m.id);
    } else if (m.t === 'world') {
      // AUDIT WORLD34 C1: the room's memory pushed after the welcome - the host's alone (the relay says whose), never my own back
      if (primary && typeof m.id === 'string' && m.id === this.host && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this._deliver('world', () => this.onWorld?.(m.data));
    } else if (m.t === 'foes') {
      // WORLD2: the host's live foes - the room's host's alone (a stale frame from a host that just left is not the world)
      // WORLD6b: in a cell every peer's frame is its own foes; in a world room the host's alone
      // AUDIT WORLD6b A8/C6: in a cell a frame is a PEER's - one the roster holds; past ROSTER_MAX a stranger's frames stood puppets the prune took back every frame
      if (typeof m.id === 'string' && (isCellRoom(this.room) ? this.peers.has(m.id) : m.id === this.host) && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this._deliver('foes', () => this.onFoes?.(m.id, m.data));
      else if (isCellRoom(this.room)) this._askWho(room, m.id, now);   // WORLD6b-iii(e): a stranger's foes - asked for, its frames a peer's once the join lands
    } else if (m.t === 'hit') {
      // WORLD2: a blow on my foe - mine to apply only while I host
      // WORLD6b: in a cell a blow is mine when it names me (the relay routed it, and the frame says so); in a world room while I host
      if ((isCellRoom(this.room) ? hitOwnerOf(m.data) === this.id : this.isHost()) && typeof m.id === 'string' && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) { this._deliver('hit', () => this.onHit?.(m.id, m.data)); if (isCellRoom(this.room)) this._askWho(room, m.id, now); }   // WORLD6b-iii(e): a stranger's blow lands (the relay routed it to me) and the striker is asked for, so my foe finds its candidate
    } else if (m.t === 'act') {
      // WORLD3: a door, a lever or a platform moved by another in my world room - never my own back, never outside one
      if (primary && isWorldRoom(this.room) && typeof m.id === 'string' && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this._deliver('act', () => this.onAct?.(m.id, m.data));
    } else if (m.t === 'join') {
      if (typeof m.id === 'string' && m.id !== this.id) this._member(room, m.id, m, now);
    } else if (m.t === 'leave') {
      if (typeof m.id === 'string') this._unmember(room, m.id);   // WORLD6b-iii(b): gone from THIS room - kept while another holds it
    } else if (m.t === 'pose') {
      const p = this.peers.get(m.id);
      const pose = p ? validPose(m.p) : null;
      if (p && pose) this._arrive(p, pose, now);
      else if (!p) this._askWho(room, m.id, now);   // WORLD6b-iii(e): a stranger's pose - a member beyond the welcome's roster, asked for
    } else if (m.t === 'chat') {
      // CHAT1: checked by the relay's own law (B7) - the id's shape, the name's, the line's; `mine` is the sender's own line back
      const text = typeof m.text === 'string' ? sanitizeChat(m.text) : '';
      if (typeof m.id !== 'string' || !text) return;
      this._deliver('chat', () => this.onChat?.({ id: m.id, name: sanitizeName(m.name), text, at: Number.isFinite(m.at) ? m.at : now, mine: m.id === this.id }));
    } else if (m.t === 'error') {
      this.status = 'error'; this.error = String(m.m ?? 'relay error');
    }
  }

  _peer(p, now) {
    const pose = validPose(p.pose);
    return { id: p.id, name: sanitizeName(p.name), look: validLook(p.look), pose, from: pose, at: now, seenAt: now, shown: pose ? { ...pose } : null };
  }

  /** A known peer said hello again: its name and look are the new ones, its pose arrives as any other. */
  _refresh(p, m, now) {
    p.name = sanitizeName(m.name); p.look = validLook(m.look);
    const pose = validPose(m.pose);
    if (pose) this._arrive(p, pose, now); else p.seenAt = now;
  }

  /** A pose in: eased from where the peer is drawn, or snapped there when it jumped. */
  _arrive(p, pose, now) {
    if (p.pose && !poseChanged(p.pose, pose)) { p.seenAt = now; return; }   // AUDIT WORLD6b-iii(b) C6: the same pose again (through a second room, or a standing heartbeat) is seen, not re-eased
    const snap = String(this.room ?? '').startsWith('world:') ? SNAP_WORLD_UNITS : SNAP_SCENE_UNITS;
    const from = p.shown && groundDist(p.shown, pose) <= snap ? { ...p.shown } : { ...pose };
    p.from = from; p.pose = pose; p.at = now; p.seenAt = now;
    p.shown = { ...from };
  }

  /** Once a frame, on the session's own clock: the retry, the easing
   *  of every peer toward its last pose over one send interval. */
  tick() {
    const now = this._now();
    if (this._retryAt != null && now >= this._retryAt && !this._ws && !this._closedByUs && !this.terminal && this.room) { this._retryAt = null; this.stats.reconnects++; this._open(); }
    for (const [room, h] of [...this._halo]) {   // WORLD6b-iii(b): the halo's retries
      if (!h.ws && h.retryAt != null && now >= h.retryAt && !this._closedByUs && !this.terminal) { this._halo.delete(room); this.stats.reconnects++; this._openHalo(room, h.backoff); continue; }
      // AUDIT WORLD6b-iii(b) A7: a halo that never opens and never closes is not immortal - past the longest backoff it is dropped and retried
      if (h.ws && h.status === 'connecting' && now - (h.since ?? now) > BACKOFF_MAX_MS) { const ws = h.ws; h.ws = null; h.status = 'closed'; h.retryAt = now + h.backoff; h.backoff = Math.min(BACKOFF_MAX_MS, h.backoff * 2); try { ws.close(1000, 'timeout'); } catch { /* already closed */ } }
    }
    if (!this.presence && this.status === 'open' && now - this._lastSentAt >= HEARTBEAT_MS && this._send({ t: 'ping' })) this._lastSentAt = now;   // CHAT1: a channel's keepalive, answered without waking the room
    for (const p of this.peers.values()) {
      if (!p.pose) continue;
      const t = (now - p.at) / (1000 / POSE_HZ);
      p.shown = lerpPose(p.from ?? p.pose, p.pose, t);
    }
  }

  /** Is a peer one to draw: a pose, seen within PEER_TIMEOUT_MS, and
   *  (a world cell) within the relay's range of the player. */
  visible(p, now = this._now()) {
    if (!p.shown || now - p.seenAt > PEER_TIMEOUT_MS) return false;
    return inRange(this.room, this._pose, p.shown);
  }

  /** The peers to draw, as an array. */
  drawable() {
    const now = this._now();
    const out = [];
    for (const p of this.peers.values()) if (this.visible(p, now)) out.push(p);
    return out;
  }

  /** One line for a person, or null when all is well; `label` names the session (AUDIT CHAT B5: the chat's line is this one, not a remake). */
  statusLine(label = 'online') {
    if (this.status === 'open') {
      if (this.clockWarning) return `${label}: ${this.clockWarning}`;   // OL3: an open session with a clock a year off says so
      // ONCRASH1: a frame the port could not handle is SAID, not only swallowed - the player reporting "it crashed"
      // now has the line that names which frame, and the console has the stack behind it.
      if (this.threw && monoNow() - this.threw.mono < THREW_SAY_MS) return `${label}: a '${this.threw.kind}' frame from another player was dropped - ${this.threw.text}`;
      return null;
    }
    if (this.terminal || this.status === 'error') return `${label}: ${this.error ?? 'error'}`;
    if (this.status === 'connecting') return `${label}: connecting`;
    if (this._retryAt != null) return `${label}: reconnecting`;
    return null;
  }
}
