// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer. The goal is
// being able to see others in the world while allowing you to bring
// over one of your own save file ... All I care about is being able to
// see and traverse with other players"): THE SESSION.
//
// THE SHAPE. Every player runs their own world from their own save;
// presence is shared (ONLINE1), words (CHAT1), a world room's memory
// (WORLD1 - the host's snapshot of the place, handed to whoever comes
// next) and its live foes (WORLD2 - the host's, streamed to the rest;
// a blow on them goes to the host). This module holds one WebSocket to
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
import { WORLD_CELL, RANGE_PIXELS, PIXEL_UNITS, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, WORLD_FRAME_MAX, validPose, validLook, sanitizeName, sanitizeChat, chatGate, worldRoom, inRange, relayUrl, isWorldRoom, foesGate, FOES_FRAME_MAX, MAX_FRAME_BYTES } from './wire.js';

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
  const loc = Number.isFinite(mapId) && mapId > 0 ? `m${mapId}` : (locationName && regionIndex >= 0 ? `${regionIndex}.${slug(locationName)}` : null);
  if (mode === 'dungeon') return loc ? `dungeon:${loc}` : null;
  if (mode === 'interior') return loc && buildingKey ? `interior:${loc}.${buildingKey}` : null;   // a door the directory cannot key (0) is no room, not a pool of them
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

const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
};

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
export class OnlineSession {
  constructor({ url = DEFAULT_SERVER, name = 'Traveller', look = null, id = null, secret = null, presence = true, WebSocketImpl = globalThis.WebSocket, now = () => Date.now() } = {}) {
    this.url = relayUrl(url || DEFAULT_SERVER);   // wss:// anywhere, ws:// on localhost alone; anything else is no relay (A16/E11)
    this.secret = secret ?? peerSecret();
    this.name = name;
    this.presence = !!presence;   // false: a channel's session (CHAT1) - no pose out, a ping for a heartbeat
    this.onChat = null;           // (line) => void: a chat line in - {id, name, text, at, mine}
    this.onFoes = null;           // WORLD2: (id, data) => void - the host's live foes in (a non-host's, from the room's host alone)
    this.onHit = null;            // WORLD2: (id, data) => void - a blow on my foe in (the host's, from anyone)
    this._fbucket = null;         // WORLD2: the foes stream's own gate, the relay's law kept at home
    this.host = null;             // WORLD1: the room's host, the relay's word; null until the welcome
    this.onHost = null;           // (id, mine) => void: the host changed
    this.onWorld = null;          // (world) => void: the welcome carried the room's memory
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
    this.peers = new Map();    // id -> { id, name, look, pose, from, at, shown, seenAt }
    this._ws = null;
    this._lastSent = null;
    this._lastSentAt = -Infinity;
    this._pose = null;
    this._backoff = BACKOFF_MIN_MS;
    this._retryAt = null;
    this._closedByUs = false;
    this.stats = { sent: 0, poses: 0, received: 0, reconnects: 0, chats: 0, worlds: 0, foes: 0, hits: 0 };
  }

  /** Enter a room (leaving the last). The pose is the hello's. */
  join(room, pose = null) {
    if (room === this.room && this._ws) return;
    this.leave();
    this.room = room;
    this._pose = pose ?? this._pose;
    this._closedByUs = false;
    this.terminal = false;
    this._backoff = BACKOFF_MIN_MS;
    this._open();
  }

  /** Leave the room: the socket closes, the peers go. */
  leave() {
    this._closedByUs = true;
    const ws = this._ws;
    this._ws = null;
    if (ws) { try { ws.close(1000, 'leaving'); } catch { /* already closed */ } }
    this._retryAt = null;
    this.room = null;
    this.peers.clear();
    this.host = null;
    this.status = 'closed';
  }

  /** Am I the room's host (WORLD1)? False until the welcome says so. */
  isHost() { return !!this.id && this.host === this.id; }

  /** The room's memory out (WORLD1): the host's alone - the relay ignores anyone else's - and never a frame past
   *  WORLD_FRAME_MAX, which the relay would refuse with a terminal close. False when nothing went. */
  sendWorld(data, { final = false } = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!this.isHost() || !this._ws || this.status !== 'open') return false;
    const s = JSON.stringify(final ? { t: 'world', data, final: true } : { t: 'world', data });   // final: the socket's one farewell inside the relay's floor (AUDIT WORLD B5)
    if (s.length > WORLD_FRAME_MAX) return false;
    try { this._ws.send(s); this.stats.sent++; this.stats.worlds++; return true; } catch { return false; }
  }

  /** WORLD2: the host's live foes out - the host's alone, in a world room, FOES_HZ_MAX a second on the stream's own
   *  bucket (a frame over it is kept home rather than struck by the relay), never past FOES_FRAME_MAX. */
  sendFoes(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!this.isHost() || !isWorldRoom(this.room) || !this._ws || this.status !== 'open') return false;
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
    if (this.isHost() || !this.host || !isWorldRoom(this.room) || !this._ws || this.status !== 'open') return false;
    const s = JSON.stringify({ t: 'hit', data });
    if (s.length > MAX_FRAME_BYTES) return false;
    try { this._ws.send(s); } catch { return false; }
    this.stats.sent++; this.stats.hits++;
    return true;
  }

  _setHost(id) {
    const host = typeof id === 'string' ? id : null;
    if (host === this.host) return;
    this.host = host;
    this.onHost?.(host, this.isHost());
  }

  _open() {
    if (!this.url) { this.status = 'error'; this.error = 'the relay must be a wss:// address'; this.terminal = true; this.terminalAt = this._now(); return; }
    if (!this.room || !this._WS) { this.status = 'error'; this.error = 'no WebSocket'; return; }
    let ws;
    try { ws = new this._WS(`${this.url}/room/${this.room}`); } catch (e) { this.status = 'error'; this.error = String(e?.message ?? e); this._scheduleRetry(); return; }
    this._ws = ws;
    this.status = 'connecting';
    ws.onopen = () => {
      if (this._ws !== ws) return;
      this.status = 'open'; this.error = null; this._backoff = BACKOFF_MIN_MS;
      this._lastSent = null; this._lastSentAt = -Infinity;
      this._send({ t: 'hello', id: this.id, secret: this.secret, name: this.name, look: this.look, pose: this.presence ? this._pose : null });
      if (!this.presence) this._lastSentAt = this._now();   // the heartbeat clock starts at the hello
    };
    ws.onmessage = (ev) => { if (this._ws === ws) this._receive(ev.data); };
    ws.onclose = (ev) => {
      if (this._ws !== ws) return;
      this._ws = null;
      const code = ev?.code ?? 1005;
      if (code === CLOSE_REPLACED) { this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = 'this character is online in another window'; return; }
      if (code === CLOSE_POLICY) { this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = this.error ?? 'the relay refused a frame'; return; }
      if (code === CLOSE_BUSY) { this.status = 'closed'; this.error = 'the room is busy'; this._backoff = Math.max(this._backoff, BACKOFF_MAX_MS / 2); this._scheduleRetry(); return; }   // full or gated: back off hard, then try again
      this.status = 'closed';
      if (!this._closedByUs) this._scheduleRetry();
    };
    ws.onerror = () => { if (this._ws === ws) { this.status = 'error'; this.error = 'socket error'; } };
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
    if (!this._send({ t: 'pose', p: pose })) return false;
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

  _receive(data) {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    this.stats.received++;
    const now = this._now();
    if (m.t === 'welcome') {
      // merged, not wiped: a peer already known keeps where it is drawn
      const keep = new Set();
      for (const p of Array.isArray(m.peers) ? m.peers : []) {
        if (!p || typeof p.id !== 'string' || p.id === this.id) continue;
        keep.add(p.id);
        const have = this.peers.get(p.id);
        if (have) this._refresh(have, p, now); else this.peers.set(p.id, this._peer(p, now));
      }
      for (const id of [...this.peers.keys()]) if (!keep.has(id)) this.peers.delete(id);
      this._setHost(m.host);   // WORLD1: the room's host, and the room's memory when it keeps one
      if (m.world && typeof m.world === 'object' && !Array.isArray(m.world)) this.onWorld?.(m.world);
    } else if (m.t === 'host') {
      this._setHost(m.id);
    } else if (m.t === 'foes') {
      // WORLD2: the host's live foes - the room's host's alone (a stale frame from a host that just left is not the world)
      if (typeof m.id === 'string' && m.id === this.host && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this.onFoes?.(m.id, m.data);
    } else if (m.t === 'hit') {
      // WORLD2: a blow on my foe - mine to apply only while I host
      if (this.isHost() && typeof m.id === 'string' && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this.onHit?.(m.id, m.data);
    } else if (m.t === 'join') {
      if (typeof m.id === 'string' && m.id !== this.id) {
        const have = this.peers.get(m.id);
        if (have) this._refresh(have, m, now); else this.peers.set(m.id, this._peer(m, now));
      }
    } else if (m.t === 'leave') {
      this.peers.delete(m.id);
    } else if (m.t === 'pose') {
      const p = this.peers.get(m.id);
      const pose = p ? validPose(m.p) : null;
      if (p && pose) this._arrive(p, pose, now);
    } else if (m.t === 'chat') {
      // CHAT1: checked by the relay's own law (B7) - the id's shape, the name's, the line's; `mine` is the sender's own line back
      const text = typeof m.text === 'string' ? sanitizeChat(m.text) : '';
      if (typeof m.id !== 'string' || !text) return;
      this.onChat?.({ id: m.id, name: sanitizeName(m.name), text, at: Number.isFinite(m.at) ? m.at : now, mine: m.id === this.id });
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
    if (this.status === 'open') return null;
    if (this.terminal || this.status === 'error') return `${label}: ${this.error ?? 'error'}`;
    if (this.status === 'connecting') return `${label}: connecting`;
    if (this._retryAt != null) return `${label}: reconnecting`;
    return null;
  }
}
