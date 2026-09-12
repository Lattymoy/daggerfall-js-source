// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer. The goal is
// being able to see others in the world while allowing you to bring
// over one of your own save file ... All I care about is being able to
// see and traverse with other players"): THE SESSION.
//
// THE SHAPE. Every player runs their own world from their own save;
// nothing is shared but presence. This module holds one WebSocket to
// the relay (server/src/index.js on Cloudflare), in one ROOM at a time,
// says hello once with the player's look, sends the player's pose at
// POSE_HZ when it changes, and keeps the peers the room reports -
// each with the pose it last sent and the pose it is DRAWN at, eased
// toward the last one so a peer walks rather than teleports. The
// hosts hand the frame's pose in and draw the peers out through
// net/remotePlayers.js.
//
// ROOMS. The relay's own law (server/src/relay.js): the streaming
// world sharded into WORLD_CELL-pixel cells, a town a room by
// location, a dungeon and an interior each a room by location. The
// key is minted here from what the host knows (roomKeyFor); when it
// changes the socket is closed and a new one opened on the new room.
//
// FRAMES. A world-cell room's pose is in MapsFile world units
// (streamingWorld.worldCoords, NATIVE_PIXEL a map pixel), y the scene's
// own; every other room's pose is the scene's local frame as the host
// holds the player - the peers are in the same scene. Nothing here
// converts: the host hands the pose in its room's frame and takes the
// peers back in it.
//
// Not a DFU member: Daggerfall Unity has no multiplayer. Ledger A row.
import { appStorage } from '../systems/appStorage.js';   // the one storage question - the seam, never the browser's own (a PIN)


/** Poses a second, at most, and only when the pose moved. */
export const POSE_HZ = 10;
/** The relay this port hosts (server/wrangler.toml). */
export const DEFAULT_SERVER = 'wss://daggerfall-online.mackcothran.workers.dev';
/** A peer silent this long is dropped without waiting for the room's leave. */
export const PEER_TIMEOUT_MS = 20000;
/** The streaming world's shard - the relay's WORLD_CELL, kept equal by test. */
export const WORLD_CELL = 16;
/** Reconnect backoff bounds, ms. */
export const BACKOFF_MIN_MS = 1000;
export const BACKOFF_MAX_MS = 8000;

/** A room-key segment: what the relay's key regex admits, bounded. */
export const slug = (s) => String(s ?? '').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 40) || 'x';

/** The streaming world's room for a map pixel (the relay's worldRoom). */
export const worldRoom = (px, py) => `world:${Math.floor(px / WORLD_CELL)},${Math.floor(py / WORLD_CELL)}`;

/**
 * The room the player is in, from what the host knows.
 * @param {object} p
 * @param {'world'|'exterior'} p.host   the streaming world or the fixed city
 * @param {'exterior'|'interior'|'dungeon'} p.mode   the mode machine's mode
 * @param {number} p.regionIndex  the location's region
 * @param {string} p.locationName the location (a town's, a dungeon's, the building's town)
 * @param {number} [p.buildingKey] the interior's building
 * @param {{x:number,y:number}} [p.mapPixel] the player's map pixel (the streaming world's overworld)
 */
export function roomKeyFor({ host, mode, regionIndex = -1, locationName = '', buildingKey = 0, mapPixel = null }) {
  if (mode === 'dungeon') return `dungeon:${regionIndex}.${slug(locationName)}`;
  if (mode === 'interior') return `interior:${regionIndex}.${slug(locationName)}.${buildingKey}`;
  if (host === 'exterior') return `town:${regionIndex}.${slug(locationName)}`;
  if (!mapPixel) return null;
  return worldRoom(mapPixel.x, mapPixel.y);
}

/** Has a pose moved enough to send? Position by EPS units, angles by EPS radians. */
export function poseChanged(a, b, eps = 0.01) {
  if (!a || !b) return true;
  return Math.abs(a.x - b.x) > eps || Math.abs(a.y - b.y) > eps || Math.abs(a.z - b.z) > eps
    || Math.abs(a.yaw - b.yaw) > eps || Math.abs(a.pitch - b.pitch) > eps || (a.mv ? 1 : 0) !== (b.mv ? 1 : 0);
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
  };
}

/** The player's id across sessions: minted once, kept in storage. */
export function peerId(storage = appStorage()) {
  const KEY = 'dagger.online.id';
  try {
    const have = storage?.getItem?.(KEY);
    if (have && /^[A-Za-z0-9_-]{4,40}$/.test(have)) return have;
  } catch { /* storage disabled */ }
  const id = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  try { storage?.setItem?.(KEY, id); } catch { /* storage disabled */ }
  return id;
}

/**
 * One player's connection to the relay: one room at a time, the
 * peers of that room. Pure of the DOM: the WebSocket class and the
 * clock are handed in, so the tests drive it with a fake socket.
 */
export class OnlineSession {
  constructor({ url = DEFAULT_SERVER, name = 'Traveller', look = null, id = null, WebSocketImpl = globalThis.WebSocket, now = () => Date.now() } = {}) {
    this.url = String(url || DEFAULT_SERVER).replace(/\/+$/, '');
    this.name = name;
    this.look = look ?? { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
    this.id = id ?? peerId();
    this._WS = WebSocketImpl;
    this._now = now;
    this.room = null;
    this.status = 'idle';      // idle | connecting | open | closed | error
    this.error = null;
    this.peers = new Map();    // id -> { id, name, look, pose, from, at, shown, seenAt }
    this._ws = null;
    this._lastSent = null;
    this._lastSentAt = -Infinity;
    this._pose = null;
    this._backoff = BACKOFF_MIN_MS;
    this._retryAt = null;
    this._closedByUs = false;
    this.onPeers = null;       // () => void, after the peer set changes
    this.stats = { sent: 0, received: 0, reconnects: 0 };
  }

  /** Enter a room (leaving the last). The pose is the hello's. */
  join(room, pose = null) {
    if (room === this.room && this._ws) return;
    this.leave();
    this.room = room;
    this._pose = pose ?? this._pose;
    this._closedByUs = false;
    this._open();
  }

  /** Leave the room: the socket closes, the peers go. */
  leave() {
    this._closedByUs = true;
    if (this._ws) { try { this._ws.close(1000, 'leaving'); } catch { /* already closed */ } }
    this._ws = null;
    this._retryAt = null;
    this.room = null;
    if (this.peers.size) { this.peers.clear(); this.onPeers?.(); }
    this.status = 'closed';
  }

  _open() {
    if (!this.room || !this._WS) { this.status = 'error'; this.error = 'no WebSocket'; return; }
    let ws;
    try { ws = new this._WS(`${this.url}/room/${this.room}`); } catch (e) { this.status = 'error'; this.error = String(e?.message ?? e); this._scheduleRetry(); return; }
    this._ws = ws;
    this.status = 'connecting';
    ws.onopen = () => {
      if (this._ws !== ws) return;
      this.status = 'open'; this.error = null; this._backoff = BACKOFF_MIN_MS;
      this._lastSent = null;
      this._send({ t: 'hello', id: this.id, name: this.name, look: this.look, pose: this._pose });
    };
    ws.onmessage = (ev) => { if (this._ws === ws) this._receive(ev.data); };
    ws.onclose = () => { if (this._ws !== ws) return; this._ws = null; this.status = 'closed'; if (!this._closedByUs) this._scheduleRetry(); };
    ws.onerror = () => { if (this._ws === ws) { this.status = 'error'; this.error = 'socket error'; } };
  }

  _scheduleRetry() {
    if (this._closedByUs || !this.room) return;
    this._retryAt = this._now() + this._backoff;
    this._backoff = Math.min(BACKOFF_MAX_MS, this._backoff * 2);
  }

  _send(o) {
    if (!this._ws || this.status !== 'open') return false;
    try { this._ws.send(JSON.stringify(o)); this.stats.sent++; return true; } catch { return false; }
  }

  /** The frame's pose: sent at POSE_HZ when it moved. */
  sendPose(pose) {
    this._pose = pose;
    const now = this._now();
    if (now - this._lastSentAt < 1000 / POSE_HZ) return false;
    if (!poseChanged(this._lastSent, pose)) return false;
    if (!this._send({ t: 'pose', p: pose })) return false;
    this._lastSent = { ...pose }; this._lastSentAt = now;
    return true;
  }

  _receive(data) {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    this.stats.received++;
    const now = this._now();
    let changed = false;
    if (m.t === 'welcome') {
      this.peers.clear();
      for (const p of m.peers ?? []) if (p?.id && p.id !== this.id) { this.peers.set(p.id, this._peer(p, now)); changed = true; }
      if (!changed && this.peers.size === 0) changed = true;
    } else if (m.t === 'join') {
      if (m.id && m.id !== this.id) { this.peers.set(m.id, this._peer(m, now)); changed = true; }
    } else if (m.t === 'leave') {
      if (this.peers.delete(m.id)) changed = true;
    } else if (m.t === 'pose') {
      const p = this.peers.get(m.id);
      if (p && m.p) { p.from = p.shown ? { ...p.shown } : p.pose; p.pose = m.p; p.at = now; p.seenAt = now; if (!p.shown) p.shown = { ...m.p }; }
    } else if (m.t === 'error') {
      this.status = 'error'; this.error = String(m.m ?? 'relay error');
    }
    if (changed) this.onPeers?.();
  }

  _peer(p, now) {
    const pose = p.pose ?? null;
    return { id: p.id, name: p.name ?? 'Traveller', look: p.look ?? null, pose, from: pose, at: now, seenAt: now, shown: pose ? { ...pose } : null };
  }

  /** Once a frame: the retry, the timeouts, the easing of every peer
   *  toward its last pose over one send interval. */
  tick(now = this._now()) {
    if (this._retryAt != null && now >= this._retryAt && !this._ws && !this._closedByUs && this.room) { this._retryAt = null; this.stats.reconnects++; this._open(); }
    let changed = false;
    for (const [id, p] of this.peers) {
      if (now - p.seenAt > PEER_TIMEOUT_MS) { this.peers.delete(id); changed = true; continue; }
      if (p.pose) {
        const t = (now - p.at) / (1000 / POSE_HZ);
        p.shown = lerpPose(p.from ?? p.pose, p.pose, t);
      }
    }
    if (changed) this.onPeers?.();
  }

  /** The peers with a pose to draw, as an array. */
  drawable() {
    const out = [];
    for (const p of this.peers.values()) if (p.shown) out.push(p);
    return out;
  }
}
