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
// CHAT1 (2026-09-12): a room in CHAT_ROOMS is a channel (relay.js, CHAT
// ROOMS) - a hello there keeps the secret and nothing else, is told an
// empty roster and announced to no one, a pose there reaches no one,
// and a chat line reaches every socket that said hello, the sender
// included; in a place room a chat line reaches whoever a pose would
// and the sender. The chat gate is CHAT_HZ_MAX a second per socket with
// its own strikes; a chat room holds CHAT_SOCKETS_MAX sockets. The chat
// client heartbeats with pings, which the runtime answers while the
// object sleeps.
//
// AUDIT CHAT (2026-09-12, before the merge): a channel is a whitelist,
// not a prefix, and the Worker opens no object for a chat: key it does
// not know (A1); its hello gate is never off - CHAT_HELLO_HZ_MAX, deeper
// than a place's, because a hello there costs no roster (A1); the room
// spends CHAT_ROOM_HZ_MAX lines a second for everyone, over which a
// line is dropped and no strike counted - the sender's missing echo is
// the word (A2); a pose or a ping is gated and counted BEFORE a channel
// declines to relay it, so ungated ingress is not a channel's privilege
// (A3); a room that drains sweeps its own storage on the way out, since
// a channel never empties on the way in (A7).
//
// WORLD1 (2026-09-12): THE ROOM'S MEMORY. A world room (relay.js
// isWorldRoom - a dungeon by map id) keeps its world in storage under
// world:meta and world:<n> chunks, published by the room's HOST - the
// hello'd socket in the room longest (its hello's stamp rides the
// attachment, so a wake recomputes it, and a reconnect keeps it, so a
// blip keeps the seat - AUDIT WORLD A4) - at most one frame in
// WORLD_MIN_MS of the room's last (the stamp in storage, A5), the
// socket's one FINAL frame excepted (the farewell on the way out, B5);
// from anyone else ignored, and never parsed: a large frame is
// answered before the parse and metered on the pose bucket, or the
// stream's own for a foes frame (A1; AUDIT WORLD2 A3 re-meters a frame
// whose type disagrees with its prefix, A4 refuses one outside a world
// room and strikes a non-host's stream of them). A
// joiner's welcome carries the stored world as it came (spliced in
// raw: the relay parses no world twice) and the host's id; a host
// change is a host frame to everyone. The sweeps that forget a room's
// looks and secrets (the empty hello, the drain) forget those and the
// hello bucket ALONE - the world outlives an empty room, which is the
// whole point of it - until WORLD_TTL_MS after the room last drained
// with no one back (the alarm, A3).
//
// WORLD2 (2026-09-12): THE LIVE FOES. The host streams its changed
// foes ({t:'foes', data}, FOES_HZ_MAX a second on the stream's own
// bucket - _meterFoes) and the room fans them to everyone hello'd but
// the host, under a byte budget on the instance (_roomFoes,
// FOES_ROOM_BYTES_PER_S: the frame times its listeners - AUDIT WORLD2
// A5); a non-host's is ignored unparsed at the door. A blow on the
// host's foe ({t:'hit', data}, on the pose bucket) from anyone but the
// host goes to the host's socket alone, under the room's hit budget
// (_roomHits, HIT_ROOM_HZ_MAX - A6). The relay reads neither.
//
// WORLD3 (2026-09-12): THE LIVE DOORS. A change to the room's doors,
// levers and movers ({t:'act', data}, on its own bucket - _meterActs,
// ACT_HZ_MAX - so a door never starves a pose) from anyone hello'd in a
// world room goes to everyone hello'd but its author, under the room's
// own budget (_roomActs, ACT_ROOM_HZ_MAX); over it the frame is dropped
// and nobody struck. Not the host's alone: a door is whoever
// touched it. The relay reads none of it.
import { roomOf, parseClient, inRange, poseGate, chatGate, tokenGate, rosterFor, isChatRoom, isWorldRoom, HELLO_HZ_MAX, CHAT_HELLO_HZ_MAX, CHAT_ROOM_HZ_MAX, SOCKETS_MAX, CHAT_SOCKETS_MAX, DROP_STRIKES_MAX, CHAT_STRIKES_MAX, WORLD_MIN_MS, WORLD_CHUNK, WORLD_TTL_MS, WORLD_PREFIX, FOES_PREFIX, foesGate, byteGate, FOES_ROOM_BYTES_PER_S, HIT_ROOM_HZ_MAX, ACT_ROOM_HZ_MAX, actGate, MAX_FRAME_BYTES, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY } from './relay.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'daggerfall-online', t: Date.now() });
    const key = roomOf(url.pathname);
    if (!key || (key.startsWith('chat:') && !isChatRoom(key))) return json({ error: 'no such room' }, 404);   // AUDIT CHAT A1: no object is minted for a channel the port does not run
    if (String(request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') return json({ error: 'websocket only' }, 426);
    const id = env.ROOMS.idFromName(key);
    return env.ROOMS.get(id).fetch(request);
  },
};

const lookKey = (id) => `look:${id}`;
const secretKey = (id) => `secret:${id}`;
const WORLD_META = 'world:meta';
const worldChunkKey = (i) => `world:${i}`;

export class Room {
  constructor(state) {
    this.state = state;
    this._idx = null;   // ws -> attachment, read once (A7); rebuilt when the socket set changes
    this._roomChat = null;   // AUDIT CHAT A2: the room's own chat budget - on the instance, since a sleeping room fans nothing
    this._roomFoes = null;   // AUDIT WORLD2 A5: the room's foes byte budget (the frame times its listeners)
    this._roomHits = null;   // AUDIT WORLD2 A6: the room's hit budget onto its host's one socket
    this._roomActs = null;   // WORLD3: the room's action-frame budget (a door, a lever, a platform moved)
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

  /** WORLD1: the room's host - the hello'd socket in the room longest (the earliest hello stamp; ties by id), or null. */
  _hostOf(except = null) {
    let best = null;
    for (const [ws, a] of this._all()) {
      if (ws === except || !a.id) continue;
      if (!best || (a.since ?? 0) < (best.since ?? 0) || ((a.since ?? 0) === (best.since ?? 0) && a.id < best.id)) best = a;
    }
    return best?.id ?? null;
  }
  /** Does this hello'd attachment lead every other (but except's) - is it the room's host? */
  _leads(a, except = null) {
    for (const [ws, b] of this._all()) if (ws !== except && b.id && b.id !== a.id && ((b.since ?? 0) < (a.since ?? 0) || ((b.since ?? 0) === (a.since ?? 0) && b.id < a.id))) return false;
    return true;
  }
  /** The host frame to everyone but skip (whose welcome carries it), the host counted without except (a leaver).
   *  Nothing on the instance: a wake changes no host. */
  _sayHost({ skip = null, except = null } = {}) {
    const host = this._hostOf(except);
    if (!host) return;
    const out = JSON.stringify({ t: 'host', id: host });
    for (const [other, b] of [...this._all()]) if (other !== skip && b.id) this._send(other, out);
  }
  /** The stored world, raw (the JSON the host sent, chunked back together), or null. */
  async _worldRaw() {
    const meta = await this.state.storage.get(WORLD_META);
    if (!meta || !(meta.chunks > 0)) return null;
    const keys = Array.from({ length: meta.chunks }, (_, i) => worldChunkKey(i));
    const parts = await this.state.storage.get(keys);
    let raw = '';
    for (const k of keys) { const c = parts.get(k); if (typeof c !== 'string') return null; raw += c; }
    return raw;
  }
  /** The room forgets its looks and secrets (and its hello bucket) - never its world (WORLD1). */
  async _sweep() {
    const dead = ['hellos'];
    for (const prefix of ['look:', 'secret:']) { const m = await this.state.storage.list({ prefix }); for (const k of m.keys()) dead.push(k); }
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
  }

  /** The frame gate (A8): the socket's pose bucket - a pose, a ping and (AUDIT WORLD A1) a world frame spend it; over
   *  the rate the frame is dropped and a strike counted, past DROP_STRIKES_MAX the socket is closed. Returns the
   *  attachment as written back, or null when the frame is not to be taken. */
  _meter(ws, a, now, patch = {}) {
    const gate = poseGate(a.bucket, now);
    const drops = gate.pass ? 0 : (a.drops ?? 0) + 1;
    const next = { ...a, ...patch, bucket: gate.bucket, drops };
    this._setAttach(ws, next);
    if (!gate.pass) { if (drops > DROP_STRIKES_MAX) this._refuse(ws, 'too many poses'); return null; }
    return next;
  }
  /** WORLD3: the action frames' own bucket (ACT_HZ_MAX), the same strikes - a door beside the poses, never starving them. */
  _meterActs(ws, a, now) {
    const gate = actGate(a.abucket, now);
    const adrops = gate.pass ? 0 : (a.adrops ?? 0) + 1;
    const next = { ...a, abucket: gate.bucket, adrops };
    this._setAttach(ws, next);
    if (!gate.pass) { if (adrops > DROP_STRIKES_MAX) this._refuse(ws, 'too many acts'); return null; }
    return next;
  }
  /** WORLD2: the foes stream's own bucket (FOES_HZ_MAX), the same strikes - a stream beside the poses, never starving them. */
  _meterFoes(ws, a, now) {
    const gate = foesGate(a.fbucket, now);
    const fdrops = gate.pass ? 0 : (a.fdrops ?? 0) + 1;
    const next = { ...a, fbucket: gate.bucket, fdrops };
    this._setAttach(ws, next);
    if (!gate.pass) { if (fdrops > DROP_STRIKES_MAX) this._refuse(ws, 'too many foes'); return null; }
    return next;
  }

  /** AUDIT WORLD A3: a world room's memory is forgotten WORLD_TTL_MS after the room last drained - armed on the
   *  drain, re-armed by every later one - unless someone is in the room when it fires: a world parked in a room
   *  nobody plays would cost storage for ever, and the rooms a client can name are many. */
  async alarm() {
    for (const [, b] of this._all()) if (b.id) return;
    const m = await this.state.storage.list({ prefix: 'world:' });
    const dead = [...m.keys()];
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
  }

  async webSocketMessage(ws, message) {
    let a = this._attach(ws);
    // AUDIT WORLD A1: a large frame - or any frame shaped as a world frame - is the host's memory or nothing, and is
    // answered BEFORE any parse: a socket with no hello is refused, the frame is metered on the pose bucket, and
    // anyone but a world room's host is ignored unparsed (a handover races; parsing 512 KiB for a stranger was the
    // one unmetered cost in the object). The host's own is parsed under the same bucket, one socket per room.
    // WORLD2: the foes frame is the other one, on the stream's own bucket. `doored` names the prefix the door metered
    // by, so an arm whose TYPE disagrees meters again (AUDIT WORLD2 A3: a duplicate-key frame spent the wrong bucket)
    let doored = null;
    if (typeof message === 'string' && (message.length > MAX_FRAME_BYTES || message.startsWith(WORLD_PREFIX) || message.startsWith(FOES_PREFIX))) {
      const foesLike = message.startsWith(FOES_PREFIX);
      if (!a.id) { this._refuse(ws, foesLike ? 'foes before hello' : 'world before hello'); return; }
      // A4: outside a world room no large frame has a home - refused, as the small cap always was, not sunk for free
      if (!isWorldRoom(a.key) && message.length > MAX_FRAME_BYTES) { this._refuse(ws, 'frame too large'); return; }
      a = foesLike ? this._meterFoes(ws, a, Date.now()) : this._meter(ws, a, Date.now());
      if (!a) return;
      if (!isWorldRoom(a.key) || a.id !== this._hostOf()) {
        // anyone but the host: ignored unparsed (a handover races) - and counted, so a stream of them is struck out (A4)
        const junk = (a.junk ?? 0) + 1;
        this._setAttach(ws, { ...a, junk });
        if (junk > DROP_STRIKES_MAX) this._refuse(ws, 'too many frames');
        return;
      }
      doored = foesLike ? 'foes' : 'world';
    }
    const m = parseClient(message, { hasHello: !!a.id });
    if (m.error) { this._refuse(ws, m.error); return; }
    if (m.t === 'hello') {
      const now = Date.now();
      const chat = isChatRoom(a.key);
      // the room's hello gate (A6): a storm is 2N frames a cycle for everyone in a place; a channel's hello costs no roster, so its gate runs deeper - never off (AUDIT CHAT A1)
      const gate = tokenGate(await this.state.storage.get('hellos'), now, chat ? CHAT_HELLO_HZ_MAX : HELLO_HZ_MAX);
      await this.state.storage.put('hellos', gate.bucket);
      if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
      // the id's secret (A3): the first hello mints it, a later one must match
      const held = await this.state.storage.get(secretKey(m.id));
      if (held && held !== m.secret) { this._refuse(ws, 'id taken'); return; }
      // a second socket claiming the same id (a reconnect) replaces the
      // first: the first loses the id now, so its close says no leave
      const before = this._hostOf();   // the seat as it stood, the socket a reconnect replaces still counted
      let replaced = null;   // AUDIT WORLD A4: the reconnect keeps the first hello's stamp - a host whose connection blipped keeps its seat
      for (const [other, b] of this._all()) {
        if (other === ws || b.id !== m.id) continue;
        replaced = b;
        this._setAttach(other, { ...b, id: null, replaced: true });
        try { other.close(CLOSE_REPLACED, 'replaced'); } catch { /* gone */ }
      }
      const others = [];
      for (const [other, b] of this._all()) if (other !== ws && b.id) others.push(b);
      if (!others.length) { await this._sweep(); await this.state.storage.put('hellos', gate.bucket); }   // an empty room forgets every look and secret an unclean close left behind - not its hello gate
      await this.state.storage.put(secretKey(m.id), m.secret);
      if (!chat) await this.state.storage.put(lookKey(m.id), m.look);   // a channel keeps no look: nobody is drawn from it
      if (!this._setAttach(ws, { ...a, id: m.id, name: m.name, pose: chat ? null : m.pose, since: replaced?.since ?? now })) { this._refuse(ws, 'hello too large'); return; }
      if (chat) { this._send(ws, JSON.stringify({ t: 'welcome', id: m.id, peers: [] })); return; }   // told no one, announced to no one: a channel has no roster
      const looks = others.length ? await this.state.storage.get(others.map((b) => lookKey(b.id))) : new Map();
      const roster = rosterFor(others.map((b) => ({ ...b, look: looks.get(lookKey(b.id)) ?? null })), m.id, m.pose);
      // WORLD1: the host and the room's memory ride the welcome - the world raw, never parsed here; a joiner that
      // leads the room (the same-millisecond tie the smaller id wins) is said to the rest - a reconnect that keeps
      // its own seat changed nothing and says nothing (AUDIT WORLD A4)
      const host = this._hostOf();
      if (host !== before && others.length) this._sayHost({ skip: ws });
      const world = isWorldRoom(a.key) ? await this._worldRaw() : null;
      const welcome = `{"t":"welcome","id":${JSON.stringify(m.id)},"peers":${JSON.stringify(roster)},"host":${JSON.stringify(host)},"world":${world ?? 'null'}}`;
      if (!this._send(ws, welcome)) return;
      const join = JSON.stringify({ t: 'join', id: m.id, name: m.name, look: m.look, pose: m.pose });
      for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, join);
      return;
    }
    if (m.t === 'world') {
      // WORLD1: the room's memory - from the host, in a world room (both answered before the parse, above, and again
      // here for a small frame that came without the prefix), at most once in WORLD_MIN_MS of the room's LAST memory
      // (the stamp in storage - AUDIT WORLD A5: on the attachment a reconnect reset it) unless this is the socket's
      // one FINAL frame, the farewell on the way out (B5: the exit's frame fell inside the floor one time in three)
      const now = Date.now();
      if (doored !== 'world') { a = this._meter(ws, a, now); if (!a) return; }   // a small frame without the prefix, or one the door metered as the other kind (A3): metered here
      if (!isWorldRoom(a.key) || a.id !== this._hostOf()) return;
      const old = await this.state.storage.get(WORLD_META);
      const final = m.final && !a.finalUsed;
      if (!final && old && now - old.at < WORLD_MIN_MS) return;
      if (final) this._setAttach(ws, { ...a, finalUsed: true });
      const raw = JSON.stringify(m.data);
      const chunks = Math.max(1, Math.ceil(raw.length / WORLD_CHUNK));
      const puts = {};
      for (let i = 0; i < chunks; i++) puts[worldChunkKey(i)] = raw.slice(i * WORLD_CHUNK, (i + 1) * WORLD_CHUNK);
      puts[WORLD_META] = { chunks, size: raw.length, at: now, by: a.id };
      // A6: the put and the stale tail's delete are ONE write - no await between them, so the runtime coalesces them
      // and a crash between the two leaves no orphan chunk
      const ops = [this.state.storage.put(puts)];
      if (old && old.chunks > chunks) ops.push(this.state.storage.delete(Array.from({ length: old.chunks - chunks }, (_, i) => worldChunkKey(chunks + i))));   // a smaller world leaves no stale tail
      await Promise.all(ops);
      return;
    }
    if (m.t === 'foes') {
      // WORLD2: the host's live foes - from the host, in a world room (answered before the parse for a prefixed
      // frame, again here for a small one), on the stream's own bucket, to everyone hello'd but the host; the
      // relay reads none of it
      const now = Date.now();
      if (doored !== 'foes') { a = this._meterFoes(ws, a, now); if (!a) return; }
      if (!isWorldRoom(a.key) || a.id !== this._hostOf()) return;
      const out = JSON.stringify({ t: 'foes', id: a.id, data: m.data });
      const listeners = [...this._all()].filter(([other, b]) => other !== ws && b.id);
      // A5: the room's byte budget - the fan is the frame times its listeners, and one host into a full room was
      // 191 MiB/s out of one object; over it the frame is dropped and nobody struck (the next full frame heals it)
      const budget = byteGate(this._roomFoes, now, out.length * listeners.length, FOES_ROOM_BYTES_PER_S);
      this._roomFoes = budget.bucket;
      if (!budget.pass) return;
      for (const [other] of listeners) this._send(other, out);
      return;
    }
    if (m.t === 'hit') {
      // WORLD2: a blow on the host's foe - from anyone but the host, in a world room, on the pose bucket, to the
      // host's socket alone (the host applies it through its own damage door and the next foes frame says so)
      const now = Date.now();
      a = this._meter(ws, a, now); if (!a) return;
      if (!isWorldRoom(a.key)) return;
      const host = this._hostOf();
      if (!host || host === a.id) return;
      // A6: the funnel onto the host's ONE socket is the room's to budget - all joiners together, HIT_ROOM_HZ_MAX a
      // second; over it the blow is dropped and nobody struck
      const funnel = tokenGate(this._roomHits, now, HIT_ROOM_HZ_MAX);
      this._roomHits = funnel.bucket;
      if (!funnel.pass) return;
      const out = JSON.stringify({ t: 'hit', id: a.id, data: m.data });
      for (const [other, b] of [...this._all()]) if (other !== ws && b.id === host) { this._send(other, out); break; }
      return;
    }
    if (m.t === 'act') {
      // WORLD3: a door, a lever or a platform moved - from anyone hello'd in a world room, on the actions' own
      // bucket, to everyone hello'd but its author, under the room's own budget (over it dropped, nobody struck)
      const now = Date.now();
      a = this._meterActs(ws, a, now); if (!a) return;
      if (!isWorldRoom(a.key)) return;
      const budget = tokenGate(this._roomActs, now, ACT_ROOM_HZ_MAX);
      this._roomActs = budget.bucket;
      if (!budget.pass) return;
      const out = JSON.stringify({ t: 'act', id: a.id, data: m.data });
      for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, out);
      return;
    }
    if (m.t === 'pose' || m.t === 'ping') {
      // the frame gate (A8): a pose and a ping share the socket's bucket, and a channel's pose is gated and counted
      // BEFORE it is declined (AUDIT CHAT A3: the early return sat above the gate, so a channel took frames unmetered)
      const chat = isChatRoom(a.key);
      if (!this._meter(ws, a, Date.now(), { pose: m.t === 'pose' && !chat ? m.p : a.pose })) return;   // over the rate: kept as the latest, not relayed
      if (m.t === 'ping') { this._send(ws, '{"t":"pong"}'); return; }   // a ping that reached the object (the runtime answers the exact one in its sleep)
      if (chat) return;   // a channel is no place: a pose there is kept by no one and reaches no one
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
      // AUDIT CHAT A2: the room's own budget, over which a line is dropped and nobody is struck - the fan is everyone
      const room = tokenGate(this._roomChat, now, CHAT_ROOM_HZ_MAX);
      this._roomChat = room.bucket;
      if (!room.pass) return;
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
    // AUDIT CHAT A7: a room that drained sweeps its own storage on the way out - the empty-hello sweep never
    // runs in a channel, which is never empty on the way in; what an unclean close left behind goes here
    const last = this.state.getWebSockets().filter((w) => w !== ws).length === 0;
    if (last) { try { await this._sweep(); if (isWorldRoom(a.key)) await this.state.storage.setAlarm(Date.now() + WORLD_TTL_MS); } catch { /* the next drain, or the next empty hello */ } }
    if (!a.id) return;   // never said hello, or replaced - the id lives on in another socket
    if (!last) { try { await this.state.storage.delete([lookKey(a.id), secretKey(a.id)]); } catch { /* the room forgets it on the next empty hello */ } }
    if (isChatRoom(a.key)) return;   // a channel announced no join, so it says no leave
    const out = JSON.stringify({ t: 'leave', id: a.id });
    for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, out);
    if (this._leads(a, ws)) this._sayHost({ skip: ws, except: ws });   // WORLD1: the host left - the next-longest in the room is the host now, said to everyone
  }
}
