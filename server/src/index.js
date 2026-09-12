// ONLINE1 (2026-09-12): THE RELAY - a Cloudflare Worker and its Room
// Durable Object. The law is in relay.js (pure, tested); this file is
// the I/O: the upgrade, the hibernatable sockets, the fan-out.
import { roomOf, parseClient, inRange, poseGate, rosterFor } from './relay.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'daggerfall-online', t: Date.now() });
    const key = roomOf(url.pathname);
    if (!key) return json({ error: 'no such room' }, 404);
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426);
    const id = env.ROOMS.idFromName(key);
    return env.ROOMS.get(id).fetch(request);
  },
};

export class Room {
  constructor(state) {
    this.state = state;
    this.key = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    this.key = roomOf(url.pathname);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // hibernation API: the object may sleep between messages; every
    // socket carries its own state in the attachment
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id: null, name: null, look: null, pose: null, bucket: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  _peers() { return this.state.getWebSockets(); }
  _send(ws, o) { try { ws.send(JSON.stringify(o)); } catch { /* a closing socket */ } }
  _attach(ws) { return ws.deserializeAttachment() ?? {}; }

  async webSocketMessage(ws, message) {
    const a = this._attach(ws);
    const m = parseClient(message, { hasHello: !!a.id });
    if (m.error) { this._send(ws, { t: 'error', m: m.error }); try { ws.close(1008, m.error); } catch { /* already closed */ } return; }
    if (m.t === 'ping') { this._send(ws, { t: 'pong' }); return; }
    if (m.t === 'hello') {
      // a second socket claiming the same id (a reconnect) replaces the first
      for (const other of this._peers()) {
        if (other !== ws && this._attach(other).id === m.id) { try { other.close(4000, 'replaced'); } catch { /* gone */ } }
      }
      const me = { ...a, id: m.id, name: m.name, look: m.look, pose: m.pose };
      ws.serializeAttachment(me);
      const roster = rosterFor(this._peers().filter((p) => p !== ws).map((p) => this._attach(p)), m.id);
      this._send(ws, { t: 'welcome', id: m.id, peers: roster });
      const join = { t: 'join', id: m.id, name: m.name, look: m.look, pose: m.pose };
      for (const other of this._peers()) if (other !== ws && this._attach(other).id) this._send(other, join);
      return;
    }
    if (m.t === 'pose') {
      const gate = poseGate(a.bucket, Date.now());
      const me = { ...a, pose: m.p, bucket: gate.bucket };
      ws.serializeAttachment(me);
      if (!gate.pass) return;   // over the rate: kept as the latest, not relayed
      const out = { t: 'pose', id: a.id, p: m.p };
      for (const other of this._peers()) {
        if (other === ws) continue;
        const b = this._attach(other);
        if (b.id && inRange(this.key ?? '', m.p, b.pose)) this._send(other, out);
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    this._leave(ws);
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  async webSocketError(ws) { this._leave(ws); }

  _leave(ws) {
    const a = this._attach(ws);
    if (!a.id) return;
    const out = { t: 'leave', id: a.id };
    for (const other of this._peers()) if (other !== ws && this._attach(other).id) this._send(other, out);
  }
}
