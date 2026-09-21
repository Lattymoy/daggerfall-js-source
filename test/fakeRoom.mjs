// The relay pins' fake Durable Object - ONE home (AUDIT WORLD D10: three copies had to grow list() and the batched
// put() in lockstep, and a fake that lies makes a pin pass that production would fail). A state with sockets and
// storage (get/put/delete/deleteAll/list, the batched put, the alarm), a socket with a bounded attachment (the
// runtime's 2 KiB - AUDIT SOC: this said 16 KiB, and the runtime's serializeAttachment() takes 2048 bytes; a fake
// with a wider wall than production's makes a pin pass that production would fail), and the Room's doors as helpers;
// wake() is what a hibernation wakes into - a fresh Room over the same state, every attachment re-read.
import { Room } from '../server/src/index.js';

export function fakeRoom(key, { now = () => Date.now() } = {}) {
  const sockets = [];
  const store = new Map();
  const alarm = { at: null };
  const state = {
    getWebSockets: () => sockets.slice(),
    acceptWebSocket: (ws) => sockets.push(ws),
    storage: {
      // AUDIT SOC (2026-09-16): THE RUNTIME'S BATCH LIMIT IS A LAW HERE TOO. A Durable Object's batched get takes 128 keys
      // and its batched put 128 pairs; SLAM5 found the 130th player's hello throwing on exactly this wall, and the fake
      // let it pass - a fake that lies makes a pin pass that production would fail (this file's own header).
      async get(k) { if (Array.isArray(k) && k.length > 128) throw new Error(`storage.get(): ${k.length} keys, the runtime takes 128 at most`); return Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k); },
      async put(k, v) { if (k && typeof k === 'object') { const e = Object.entries(k); if (e.length > 128) throw new Error(`storage.put(): ${e.length} pairs, the runtime takes 128 at most`); for (const [kk, vv] of e) store.set(kk, vv); } else store.set(k, v); },
      async delete(k) { if (Array.isArray(k) && k.length > 128) throw new Error(`storage.delete(): ${k.length} keys, the runtime takes 128 at most`); for (const x of Array.isArray(k) ? k : [k]) store.delete(x); },
      async deleteAll() { store.clear(); },
      // AUDIT SOC A4: list() pages as the runtime's does - `limit` keys at most, sorted, after `startAfter` - or a paged
      // sweep over this fake never ends (a page that is always full is always followed)
      async list({ prefix = '', limit = Infinity, startAfter = null } = {}) {
        const keys = [...store.keys()].filter((k) => k.startsWith(prefix) && (startAfter == null || k > startAfter)).sort();
        return new Map(keys.slice(0, limit).map((k) => [k, store.get(k)]));
      },
      async setAlarm(at) { alarm.at = at; },
      async getAlarm() { return alarm.at; },
      async deleteAlarm() { alarm.at = null; },
    },
  };
  let room = new Room(state);
  const wake = () => { room = new Room(state); };
  const connect = () => {
    const ws = { sent: [], closed: null, att: { key, id: null, name: null, pose: null, bucket: null, drops: 0 },
      send(s) { if (this.closed) throw new Error('closed'); this.sent.push(JSON.parse(s)); },
      // the runtime drops a socket the object closed from getWebSockets() and calls no webSocketClose for it
      close(code, reason) { this.closed = { code, reason }; const i = sockets.indexOf(ws); if (i >= 0) sockets.splice(i, 1); },
      serializeAttachment(a) { if (JSON.stringify(a).length > 2048) throw new Error('attachment too large'); this.att = JSON.parse(JSON.stringify(a)); }, deserializeAttachment() { return this.att; } };
    state.acceptWebSocket(ws);
    return ws;
  };
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  /** A hello; the fourth argument is a secret (a string) or extra fields (an object) laid over the frame. */
  const hello = (ws, id, pose = null, extra = {}) => room.webSocketMessage(ws, JSON.stringify({ t: 'hello', id, secret: 'secret-of-' + id, name: id, look, pose, ...(typeof extra === 'string' ? { secret: extra } : extra) }));
  const pose = (ws, p) => room.webSocketMessage(ws, JSON.stringify({ t: 'pose', p }));
  const chat = (ws, text) => room.webSocketMessage(ws, JSON.stringify({ t: 'chat', text }));
  const ping = (ws) => room.webSocketMessage(ws, '{"t":"ping","x":1}');   // not the byte-exact one the runtime answers in its sleep: this one wakes the object
  const world = (ws, data, extra = {}) => room.webSocketMessage(ws, JSON.stringify({ t: 'world', data, ...extra }));
  const raw = (ws, text) => room.webSocketMessage(ws, text);
  const drop = (ws) => { const i = sockets.indexOf(ws); if (i >= 0) sockets.splice(i, 1); return room.webSocketClose(ws, 1005, ''); };
  const fire = () => room.alarm();
  return { get room() { return room; }, state, store, sockets, alarm, connect, hello, pose, chat, ping, world, raw, drop, wake, fire, now, look };
}
