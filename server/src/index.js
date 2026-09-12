// ONLINE1 (2026-09-12): THE RELAY - a Cloudflare Worker and its Room
// Durable Object. The law is in relay.js (the port's own src/net/wire.js,
// pure, tested); this file is the I/O: the upgrade, the hibernatable
// sockets, the fan-out. test/online_relay.test.js drives the Room over
// fake sockets and a fake state.
//
// AUDIT ONLINE (2026-09-12): the room's key rides every socket's
// attachment, not the instance (D10/E4/A1: a hibernated object wakes
// with no instance state, and `this.key` gone turned the range gate off
// for the whole cell); a socket replaced by a reconnect with its own id
// and secret loses the id BEFORE it closes, so its leave is never
// broadcast (B6/A2: the reconnected player was joined then left, and
// vanished for everyone); an id the room holds is guarded by the
// secret its first hello minted (A3: any client could kick and
// impersonate any peer); the look lives in the object's storage, not
// the attachment (A4: an attachment is bounded; a hello that overflowed
// it threw after the eviction had already run); the roster is the
// nearest ROSTER_MAX (A5); hellos are gated per room and sockets capped
// (A6); the attachments are read once into an index, not once per
// socket per pose (A7); the payload is stringified once (A9); a failed
// send closes the socket rather than passing for a delivery (A10); an
// over-rate socket that keeps sending is closed (A8), and pings are
// answered by the runtime while the object sleeps.
//
// CHAT1 (2026-09-12): a chat:<name> room is a channel (relay.js, CHAT
// ROOMS) - a hello there keeps the secret and nothing else, is told an
// empty roster and announced to no one, a pose there reaches no one,
// and a chat line reaches every socket that said hello, the sender
// included; in a place room a chat line reaches whoever a pose would.
// The chat gate is CHAT_HZ_MAX a second with its own strikes; a chat
// room holds CHAT_SOCKETS_MAX sockets, and its hello gate is off (the
// cost a hello gate guards - the roster, the join to everyone - a
// channel never pays). The chat client heartbeats with pings, which
// the runtime answers while the object sleeps.
import { roomOf, parseClient, inRange, poseGate, chatGate, tokenGate, rosterFor, isChatRoom, HELLO_HZ_MAX, SOCKETS_MAX, CHAT_SOCKETS_MAX, DROP_STRIKES_MAX, CHAT_STRIKES_MAX, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY } from './relay.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'daggerfall-online', t: Date.now() });
    const key = roomOf(url.pathname);
    if (!key) return json({ error: 'no such room' }, 404);
    if (String(request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') return json({ error: 'websocket only' }, 426);
    const id = env.ROOMS.idFromName(key);
    return env.ROOMS.get(id).fetch(request);
  },
};

const lookKey = (id) => `look:${id}`;
const secretKey = (id) => `secret:${id}`;

export class Room {
  constructor(state) {
    this.state = state;
    this._idx = null;   // ws -> attachment, read once (A7); rebuilt when the socket set changes
    try {
      // the runtime answers the client's ping while the object sleeps
      if (state.setWebSocketAutoResponse && typeof WebSocketRequestResponsePair === 'function') state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    } catch { /* an older runtime */ }
  }

  async fetch(request) {
    const key = roomOf(new URL(request.url).pathname);
    if (this.state.getWebSockets().length >= (isChatRoom(key) ? CHAT_SOCKETS_MAX : SOCKETS_MAX)) return json({ error: 'room full' }, 503);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // hibernation API: the object may sleep between messages; every
    // socket carries its own state in the attachment - the room's key
    // included - and the look sits in storage under the id
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ key, id: null, name: null, pose: null, bucket: null, drops: 0 });
    this._idx = null;
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Every socket with its attachment, read once. */
  _all() {
    const sockets = this.state.getWebSockets();
    if (!this._idx || this._idx.size !== sockets.length || sockets.some((ws) => !this._idx.has(ws))) {
      this._idx = new Map();
      for (const ws of sockets) { let a; try { a = ws.deserializeAttachment() ?? {}; } catch { a = {}; } this._idx.set(ws, a); }
    }
    return this._idx;
  }
  /** One socket's attachment: the index's, or the socket's own when it is already gone from the set (a closing socket still carries its id). */
  _attach(ws) { const idx = this._all(); if (idx.has(ws)) return idx.get(ws); try { return ws.deserializeAttachment() ?? {}; } catch { return {}; } }
  _setAttach(ws, a) { try { ws.serializeAttachment(a); } catch { return false; } this._all().set(ws, a); return true; }
  _forget(ws) { this._idx?.delete(ws); }

  /** A frame to one socket; a socket that will not take it is closed (A10). */
  _send(ws, s) {
    try { ws.send(s); return true; } catch {
      this._forget(ws);
      try { ws.close(1011, 'send failed'); } catch { /* gone */ }
      return false;
    }
  }
  _refuse(ws, m, code = CLOSE_POLICY) {
    this._send(ws, JSON.stringify({ t: 'error', m }));
    try { ws.close(code, m); } catch { /* already closed */ }
  }

  async webSocketMessage(ws, message) {
    const a = this._attach(ws);
    const m = parseClient(message, { hasHello: !!a.id });
    if (m.error) { this._refuse(ws, m.error); return; }
    if (m.t === 'ping') { this._send(ws, '{"t":"pong"}'); return; }
    if (m.t === 'hello') {
      const now = Date.now();
      const chat = isChatRoom(a.key);
      // the room's hello gate (A6): a storm is 2N frames a cycle for everyone - in a place; a channel's hello costs no one anything (CHAT1)
      const gate = chat ? { pass: true, bucket: null } : tokenGate(await this.state.storage.get('hellos'), now, HELLO_HZ_MAX);
      if (!chat) await this.state.storage.put('hellos', gate.bucket);
      if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
      // the id's secret (A3): the first hello mints it, a later one must match
      const held = await this.state.storage.get(secretKey(m.id));
      if (held && held !== m.secret) { this._refuse(ws, 'id taken'); return; }
      // a second socket claiming the same id (a reconnect) replaces the
      // first: the first loses the id now, so its close says no leave
      for (const [other, b] of this._all()) {
        if (other === ws || b.id !== m.id) continue;
        this._setAttach(other, { ...b, id: null, replaced: true });
        try { other.close(CLOSE_REPLACED, 'replaced'); } catch { /* gone */ }
      }
      const others = [];
      for (const [other, b] of this._all()) if (other !== ws && b.id) others.push(b);
      if (!others.length) { await this.state.storage.deleteAll(); if (!chat) await this.state.storage.put('hellos', gate.bucket); }   // an empty room forgets every look and secret an unclean close left behind - not its hello gate
      await this.state.storage.put(secretKey(m.id), m.secret);
      if (!chat) await this.state.storage.put(lookKey(m.id), m.look);   // a channel keeps no look: nobody is drawn from it
      if (!this._setAttach(ws, { ...a, id: m.id, name: m.name, pose: chat ? null : m.pose })) { this._refuse(ws, 'hello too large'); return; }
      if (chat) { this._send(ws, JSON.stringify({ t: 'welcome', id: m.id, peers: [] })); return; }   // told no one, announced to no one: a channel has no roster
      const looks = others.length ? await this.state.storage.get(others.map((b) => lookKey(b.id))) : new Map();
      const roster = rosterFor(others.map((b) => ({ ...b, look: looks.get(lookKey(b.id)) ?? null })), m.id, m.pose);
      if (!this._send(ws, JSON.stringify({ t: 'welcome', id: m.id, peers: roster }))) return;
      const join = JSON.stringify({ t: 'join', id: m.id, name: m.name, look: m.look, pose: m.pose });
      for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, join);
      return;
    }
    if (m.t === 'pose') {
      if (isChatRoom(a.key)) return;   // a channel is no place: a pose there is kept by no one and reaches no one
      const gate = poseGate(a.bucket, Date.now());
      const drops = gate.pass ? 0 : (a.drops ?? 0) + 1;
      this._setAttach(ws, { ...a, pose: m.p, bucket: gate.bucket, drops });
      if (!gate.pass) { if (drops > DROP_STRIKES_MAX) this._refuse(ws, 'too many poses'); return; }   // over the rate: kept as the latest, not relayed
      const out = JSON.stringify({ t: 'pose', id: a.id, p: m.p });
      for (const [other, b] of [...this._all()]) {
        if (other === ws || !b.id) continue;
        if (inRange(a.key ?? '', m.p, b.pose)) this._send(other, out);
      }
      return;
    }
    if (m.t === 'chat') {
      // CHAT1: the chat gate, its own bucket and strikes (a talker is not a mover)
      const now = Date.now();
      const gate = chatGate(a.cbucket, now);
      const cdrops = gate.pass ? 0 : (a.cdrops ?? 0) + 1;
      this._setAttach(ws, { ...a, cbucket: gate.bucket, cdrops });
      if (!gate.pass) { if (cdrops > CHAT_STRIKES_MAX) this._refuse(ws, 'too many lines'); return; }   // over the rate: dropped, never queued
      const out = JSON.stringify({ t: 'chat', id: a.id, name: a.name, text: m.text, at: now });
      const chat = isChatRoom(a.key);
      for (const [other, b] of [...this._all()]) {
        if (!b.id) continue;
        if (other === ws || chat || inRange(a.key ?? '', a.pose, b.pose)) this._send(other, out);   // the sender hears its own line back: that is the receipt
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    await this._leave(ws);
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  async webSocketError(ws) { await this._leave(ws); }

  async _leave(ws) {
    const a = this._attach(ws);
    this._forget(ws);
    if (!a.id) return;   // never said hello, or replaced - the id lives on in another socket
    try { await this.state.storage.delete([lookKey(a.id), secretKey(a.id)]); } catch { /* the room forgets it on the next empty hello */ }
    if (isChatRoom(a.key)) return;   // a channel announced no join, so it says no leave
    const out = JSON.stringify({ t: 'leave', id: a.id });
    for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, out);
  }
}
