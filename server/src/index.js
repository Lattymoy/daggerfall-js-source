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
// ROOMS) - a hello there keeps the secret and nothing else (ROSTER-G: and
// is told who is in the channel by NAME, cut at CHAT_ROSTER_MAX with the
// true count beside it, and its join and leave are said - the roster
// beside the chat is everyone online), a pose there reaches no one,
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
// (the destination socket's own `hbucket`, HIT_ROOM_HZ_MAX - A6; AUDIT WORLD6b A1). The relay reads neither.
//
// WORLD3 (2026-09-12): THE LIVE DOORS, and WORLD4 (2026-09-13): THE
// ROOM'S LOOT. A change to the room's doors, levers, movers and
// containers ({t:'act', data}, on its own bucket - _meterActs,
// ACT_HZ_MAX - so a door never starves a pose) from anyone hello'd in a
// world room goes to everyone hello'd but its author, under the room's own
// budgets (_roomActs ACT_ROOM_HZ_MAX frames, _roomActBytes
// ACT_ROOM_BYTES_PER_S bytes times its listeners - AUDIT WORLD3 A1, the
// foes fan's law); over either the frame is dropped and nobody struck. Not the host's alone: a door is whoever
// touched it. The relay reads none of it.
//
// AUDIT WORLD34 (2026-09-13, Mac: "enemies, doors, and everything else
// doesn't persist between connected players"): the root was the wire's
// own law (relay.js isWorldRoom: eight digits, and a real map id has
// nine or ten), so nothing here changed for it - but the relay must be
// REDEPLOYED, since it refuses by the same regex. Three relay findings
// beside it: a socket the ROOM closes (a refusal, a failed send) got no
// webSocketClose from the runtime, so its leave and its seat were never
// said and the survivors kept a phantom host (D1 - every door out of the
// object now reaps through _leave); the memory's floor read the room's
// last stamp whoever wrote it, so a new host's first publish after a
// handover was dropped while its client believed it went (D2 - the
// floor is per author); and the memory rode the welcome ALONE, so two
// players entering together were both handed null and never re-synced
// (C1 - a stored memory is now pushed once to every hello'd socket whose
// welcome carried none, as {t:'world', id, data}). /health says which
// relay this is (RELAY_VERSION), so a stale deploy can be told from a
// browser tab.
//
// WORLD5 (2026-09-13): THE SHARED CLOCK is a function of wall time (relay.js
// sharedClassicMinutes) and needs no frame; the welcome carries the relay's
// own `now` so a client corrects for its machine's clock. Nothing else here.
//
// SOC1 (2026-09-16, Mac: "A social button next to the chat UI ... friend
// other users, see if they are online/last online + be able to invite
// friends or other individuals to the new 4 person party system"): THE
// HUB. The world channel's object (relay.js SOCIAL_ROOM - the one room
// every player online is in) keeps the social state in its storage:
// acct:<id> an account's record (its last name, when it was last seen,
// its friends, its requests each way, its party invites, its party),
// asecret:<id> the account's secret (the first hello mints it, a later
// one must match - a hello that fails it is admitted WITHOUT its
// account and told so), party:<id> a party (its leader, its members in
// join order, its invites out, its seats gone away). A hello there that
// names an account is handed its whole picture ({t:'social', k:'state'})
// and every friend and party member hears it came ({k:'presence'} to
// the friends, {k:'party'} to the party); a leave stamps last-seen and
// says the same. An act ({t:'social', k}) rides the acts' own bucket
// (_meterSocial, SOCIAL_HZ_MAX) under the room's own budget
// (SOCIAL_ROOM_HZ_MAX), and a refused act is answered in words
// ({k:'error', m}) - a full friend list is not a protocol violation and
// closes nothing. A party pose ({t:'party', p}, _meterParty) is kept on
// the sender's attachment (`pm`) and fanned to its party's other
// members alone. Presence rooms are untouched: nothing a client says in
// a cell makes it anyone's friend or party. Parties are forgotten when
// the hub drains (the sweep); accounts never are.
import { roomOf, parseClient, inRange, poseGate, chatGate, tokenGate, rosterFor, isChatRoom, isWorldRoom, isCellRoom, streamsFoes, hitOwnerOf, worldFrameMaxFor, CELL_FRAME_RECORDS_MAX, HELLO_HZ_MAX, CHAT_HELLO_HZ_MAX, CHAT_ROOM_HZ_MAX, SOCKETS_MAX, CHAT_SOCKETS_MAX, DROP_STRIKES_MAX, CHAT_STRIKES_MAX, WORLD_MIN_MS, WORLD_CHUNK, WORLD_TTL_MS, WORLD_PREFIX, FOES_PREFIX, foesGate, byteGate, FOES_ROOM_BYTES_PER_S, HIT_ROOM_HZ_MAX, ACT_ROOM_HZ_MAX, ACT_ROOM_BYTES_PER_S, actGate, MAX_FRAME_BYTES, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, HIT_ROOM_BYTES_PER_S, whoGate, whoIdOf, WHO_ROOM_HZ_MAX, poseFan, poseChanged, RELAY_VERSION, KEEPALIVE_FAN_MS, ACT_SENDER_BYTES_PER_S, CHAT_ROSTER_MAX, isSocialRoom, socialGate, partyGate, SOCIAL_ROOM_HZ_MAX, FRIENDS_MAX, PENDING_MAX, PARTY_MAX, PARTY_INVITES_MAX, INVITE_TTL_MS, PARTY_OFFLINE_MS, ACCOUNT_TABS_MAX, mintPartyId } from './relay.js';

// AUDIT WORLD34 D4: the relay names itself in /health. SLAM13 (AUDIT SLAM A5): the name lives in net/wire.js, so the
// welcome can carry it; /health reads it through the import above. LOCALDEV1: it is NOT re-exported from this module -
// workerd (wrangler dev, 1.20260911) refuses a worker entry whose named export is a string ("Incorrect type for map
// entry 'RELAY_VERSION': the provided value is not of type 'function or ExportedHandler'"), so the local relay would
// not start at all. The production runtime let it through, which is why nothing caught it; the pins read wire.js.

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'daggerfall-online', version: RELAY_VERSION, t: Date.now() });
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
// SOC1: the hub's keys - an account's record, its secret, a party
const acctKey = (id) => `acct:${id}`;
const acctSecretKey = (id) => `asecret:${id}`;
const partyKey = (id) => `party:${id}`;
/** SOC1: a fresh account record - the durable half of a player: the last name they said hello with, when they were last
 *  seen (the relay's clock), their friends (account ids), their requests each way and their party invites ({acct|party,
 *  at}), and the party they sit in. */
const newAcct = (name, now) => ({ name, seen: now, friends: [], in: [], out: [], invites: [], party: null });
/** A list of ids or of {acct} entries without one account. */
const without = (list, acct) => (Array.isArray(list) ? list : []).filter((e) => (typeof e === 'string' ? e : e?.acct) !== acct);
const hasEntry = (list, acct) => (Array.isArray(list) ? list : []).some((e) => (typeof e === 'string' ? e : e?.acct) === acct);

export class Room {
  constructor(state) {
    this.state = state;
    this._idx = null;   // ws -> attachment, read once (A7); rebuilt when the socket set changes
    this._roomChat = null;   // AUDIT CHAT A2: the room's own chat budget - on the instance, since a sleeping room fans nothing
    this._roomFoes = null;   // AUDIT WORLD2 A5: the room's foes byte budget (the frame times its listeners)
    this._roomFoesIn = null;   // AUDIT WORLD6b A3: a cell's foes INGRESS budget, spent at the door before the parse
    // AUDIT WORLD6b A1/A2: the hit funnel (AUDIT WORLD2 A6) is the DESTINATION socket's own bucket (`hbucket` on its attachment), not the room's
    this._roomActs = null;   // WORLD3: the room's action-frame budget (a door, a lever, a platform moved)
    this._roomHits = null;   // AUDIT WORLD6b-iii(c) C3: the room's hit BYTES budget (a grant is a frame's worth of items)
    this._roomWho = null;    // AUDIT WORLD6b-iii(e) B1: the room's ask budget (WHO_ROOM_HZ_MAX) - the one arm past the hello that reads storage
    this._looks = new Map(); // AUDIT WORLD6b-iii(e) B1: the looks said hello with, kept on the instance while it is awake - a repeat ask reads no storage; after a hibernation the storage's copy is read once and kept again
    this._roomActBytes = null;   // AUDIT WORLD3 A1: and its BYTE budget - the frame times its listeners, as the foes fan has
    this._roomWorld = null;      // SLAM11: the memory push's OWN byte budget, borrowing - it used to charge the foes stream's, and a big memory's debt would have stalled live foes
    this._roomSocial = null;     // SOC1: the hub's budget for social acts (SOCIAL_ROOM_HZ_MAX) - over it an act is refused with 'busy'
    this._acctIdx = null;        // SOC1: account -> its hello'd sockets, built from the index when asked and dropped with it (a socket's account changes on its hello alone)
    this._parties = new Map();   // SOC1: party id -> record, kept while the object is awake (a party pose reads its party once a second; a wake reads storage once and keeps it again)
    this._dead = new Set();      // AUDIT WORLD34 D1: the sockets this object closed itself, whose leave the runtime will not deliver - reaped on the way out of every door
    this._gone = new WeakSet();  // AUDIT WORLD34 D1: and the ones whose leave has been said, so a runtime that does deliver a close says it once
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
      this._acctIdx = null;   // SOC1: rebuilt with the index
      for (const ws of sockets) { let a; try { a = ws.deserializeAttachment() ?? {}; } catch { a = {}; } this._idx.set(ws, a); }
    }
    return this._idx;
  }
  /** SOC1: the hello'd sockets of each account - one pass over the index, kept until the index or an account changes. */
  _byAcct() {
    if (this._acctIdx) return this._acctIdx;
    const m = new Map();
    for (const [ws, a] of this._all()) if (a.id && a.acct) { let s = m.get(a.acct); if (!s) m.set(a.acct, s = []); s.push(ws); }
    return (this._acctIdx = m);
  }
  /** SOC1: an account's hello'd sockets, `except` one (a socket on its way out). */
  _socketsOf(acct, except = null) { const s = this._byAcct().get(acct); return s ? (except ? s.filter((ws) => ws !== except) : s) : []; }
  /** One socket's attachment: the index's, or the socket's own when it is already gone from the set (a closing socket still carries its id). */
  _attach(ws) { const idx = this._all(); if (idx.has(ws)) return idx.get(ws); try { return ws.deserializeAttachment() ?? {}; } catch { return {}; } }
  _setAttach(ws, a) {
    try { ws.serializeAttachment(a); } catch { return false; }
    const idx = this._all(), was = idx.get(ws);
    if (!was || was.id !== a.id || was.acct !== a.acct) this._acctIdx = null;   // SOC1: the account index follows the ids alone - a pose's write leaves it standing
    idx.set(ws, a);
    return true;
  }
  _forget(ws) { this._idx?.delete(ws); this._acctIdx = null; }

  /** A frame to one socket; a socket that will not take it is closed (A10). */
  _send(ws, s) {
    try { ws.send(s); return true; } catch {
      this._forget(ws);
      try { ws.close(1011, 'send failed'); } catch { /* gone */ }
      this._dead.add(ws);   // AUDIT WORLD34 D1: closed by the object - its leave is ours to say
      return false;
    }
  }
  _refuse(ws, m, code = CLOSE_POLICY) {
    this._send(ws, JSON.stringify({ t: 'error', m }));
    try { ws.close(code, m); } catch { /* already closed */ }
    this._dead.add(ws);   // AUDIT WORLD34 D1: the runtime calls no webSocketClose for a close the object made
  }
  /** AUDIT WORLD34 D1: every socket this object closed itself leaves the room as a peer's close would - the leave
   *  said, the seat re-said, the looks and secrets gone. The runtime delivers webSocketClose for the PEER's close
   *  alone; a refusal or a failed send left the survivors with a phantom host that never streamed again. Awaited on
   *  the way out of every door (webSocketMessage, webSocketClose, webSocketError). */
  async _reap() {
    while (this._dead.size) {
      const [ws] = this._dead;
      this._dead.delete(ws);
      try { await this._leave(ws); } catch { /* the next door reaps again */ }
    }
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
  /** SOC1: and its parties - the hub drained, so nobody is online to hold one (a member back inside PARTY_OFFLINE_MS
   *  finds its record pointing at a party that is gone, and the hello clears it); never an account or its secret. */
  async _sweep() {
    this._looks.clear();
    const dead = ['hellos'];
    for (const prefix of ['look:', 'secret:']) { const m = await this.state.storage.list({ prefix }); for (const k of m.keys()) dead.push(k); }
    this._parties.clear(); for (const k of (await this.state.storage.list({ prefix: 'party:' })).keys()) dead.push(k);   // SOC1: the parties go with the drain; acct: and asecret: stay
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
  }

  /** The frame gate (A8): the socket's pose bucket - a pose, a ping and (AUDIT WORLD A1) a world frame spend it; over
   *  the rate the frame is dropped and a strike counted, past DROP_STRIKES_MAX the socket is closed. Returns the
   *  attachment as written back, or null when the frame is not to be taken. */
  /** SLAM8 (AUDIT SLAM): `patch` is applied whatever the gate says (the latest pose is kept even when it is not
   *  relayed); `passPatch` ONLY when the frame is really let through. Anything that counts what the room DID - the
   *  pose fan's `turn` - belongs in the second, or it counts what the room was merely told. */
  _meter(ws, a, now, patch = {}, passPatch = {}) {
    const gate = poseGate(a.bucket, now);
    const drops = gate.pass ? 0 : (a.drops ?? 0) + 1;
    const next = { ...a, ...patch, ...(gate.pass ? passPatch : {}), bucket: gate.bucket, drops };
    this._setAttach(ws, next);
    if (!gate.pass) { if (drops > DROP_STRIKES_MAX) this._refuse(ws, 'too many poses'); return null; }
    return next;
  }
  /** WORLD6b-iii(e): the asks' own bucket (WHO_HZ_MAX), the same strikes - a question beside the poses, never starving them. */
  _meterWho(ws, a, now) {
    const gate = whoGate(a.wbucket, now);
    const wdrops = gate.pass ? 0 : (a.wdrops ?? 0) + 1;
    const next = { ...a, wbucket: gate.bucket, wdrops };
    this._setAttach(ws, next);
    if (!gate.pass) { if (wdrops > DROP_STRIKES_MAX) this._refuse(ws, 'too many asks'); return null; }
    return next;
  }
  /** SOC1: the social acts' own bucket (SOCIAL_HZ_MAX), the same strikes. */
  _meterSocial(ws, a, now) {
    const gate = socialGate(a.sbucket, now);
    const sdrops = gate.pass ? 0 : (a.sdrops ?? 0) + 1;
    const next = { ...a, sbucket: gate.bucket, sdrops };
    this._setAttach(ws, next);
    if (!gate.pass) { if (sdrops > DROP_STRIKES_MAX) this._refuse(ws, 'too many social acts'); return null; }
    return next;
  }
  /** SOC1: the party poses' own bucket (PARTY_HZ_MAX), the same strikes. */
  _meterParty(ws, a, now) {
    const gate = partyGate(a.pbucket, now);
    const pdrops = gate.pass ? 0 : (a.pdrops ?? 0) + 1;
    const next = { ...a, pbucket: gate.bucket, pdrops };
    this._setAttach(ws, next);
    if (!gate.pass) { if (pdrops > DROP_STRIKES_MAX) this._refuse(ws, 'too many party poses'); return null; }
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
  /** AUDIT WORLD2 A4's instrument, one home (AUDIT WORLD6b A1/B3): a frame that should not have been sent is counted
   *  against its socket, and a stream of them is struck out. */
  _junk(ws, a) {
    const junk = (a.junk ?? 0) + 1;
    this._setAttach(ws, { ...a, junk });
    if (junk > DROP_STRIKES_MAX) this._refuse(ws, 'too many frames');
  }
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
    try { await this._message(ws, message); } finally { await this._reap(); }
  }

  async _message(ws, message) {
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
      // WORLD6b: a cell's foes frame has the stream's own cap too (a world room's memory or stream, a cell's stream; nothing else is large)
      if (!(foesLike ? streamsFoes(a.key) : isWorldRoom(a.key)) && message.length > MAX_FRAME_BYTES) { this._refuse(ws, 'frame too large'); return; }
      a = foesLike ? this._meterFoes(ws, a, Date.now()) : this._meter(ws, a, Date.now());
      if (!a) return;
      // AUDIT WORLD6b A3: a CELL's stream is anyone's, so the room budgets its INGRESS here, before the parse - over it
      // the frame is dropped unread and nobody struck (the fan's own law, AUDIT WORLD2 A5); a world room's stream is
      // one socket's, the host's, and bounded by its own bucket already
      if (foesLike && isCellRoom(a.key)) { const ingress = byteGate(this._roomFoesIn, Date.now(), message.length, FOES_ROOM_BYTES_PER_S); this._roomFoesIn = ingress.bucket; if (!ingress.pass) return; }
      if (!(foesLike && isCellRoom(a.key)) && (!isWorldRoom(a.key) || a.id !== this._hostOf())) {   // WORLD6b: a cell's foes frame is anyone's
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
      if (!chat) { await this.state.storage.put(lookKey(m.id), m.look); this._looks.set(m.id, m.look); }   // a channel keeps no look: nobody is drawn from it
      if (!this._setAttach(ws, { ...a, id: m.id, name: m.name, pose: chat ? null : m.pose, since: replaced?.since ?? now })) { this._refuse(ws, 'hello too large'); return; }
      // SRV-N: `v` rides EVERY welcome, a channel's included. A player in the enhanced skin holds a presence socket
      // and one chat socket per tab; whichever reconnects first after a hand deploy is the one that notices, and the
      // client's detector (net/updateNotice.js) is a Set so the rest of them say nothing. SLAM13 (AUDIT SLAM A5): and
      // the SESSION compares it with the law it was built against, and says a skew once.
      if (chat) {
        // ROSTER-G (Mac: "Players dont show in online"): A CHANNEL HAS A ROSTER - names alone. This line used to say
        // `peers: []` and announce nobody, so the one room every player is in could not say who was online, and the
        // panel read the player's own cell instead. The names are on the attachments already (no look, no storage
        // read - the hello path stays as cheap as AUDIT CHAT A1 priced it); socket order, cut at CHAT_ROSTER_MAX, with
        // `n` the true count. The join below is said here too, with the name and nothing else.
        const named = others.slice(0, CHAT_ROSTER_MAX).map((b) => ({ id: b.id, name: b.name }));
        if (!this._send(ws, JSON.stringify({ t: 'welcome', id: m.id, peers: named, n: others.length + 1, v: RELAY_VERSION }))) return;
        const said = JSON.stringify({ t: 'join', id: m.id, name: m.name });
        for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, said);
        // SOC1: the account, in the hub - after the welcome and the join, so a client's session has reset on the
        // welcome before its picture lands; a hello naming none is a build before this slice, admitted as it was
        if (isSocialRoom(a.key) && m.acct) await this._helloAccount(ws, m, now);
        return;
      }
      // SLAM5 (2026-09-16, AUDIT SLAM): THE ROSTER IS CHOSEN BEFORE THE LOOKS ARE READ, and this was a hard wall.
      //
      // This used to read a look for EVERY hello'd socket - up to SOCKETS_MAX-1 = 255 keys in one
      // `storage.get(keys)` - only for `rosterFor` to throw all but ROSTER_MAX away. A Durable Object's batched get
      // takes at most 128 keys, which this file already knows: `_sweep` and `alarm` both chunk their deletes at 128.
      // So the 130th player to join a room made the get throw, AFTER `_setAttach` had already marked them present
      // and BEFORE the welcome or the join fan - leaving them connected with an empty roster, no host and no clock,
      // invisible to a room that was never told they arrived. An event does not degrade at 130; it stops.
      //
      // Selecting first fixes the breach and the waste together: at most ROSTER_MAX keys are ever asked for, and an
      // awake object usually asks for none, because `_looks` already holds what every hello said (the `who` path
      // has read it that way since AUDIT WORLD6b-iii(e) B1 - the hello path just never did).
      const near = rosterFor(others, m.id, m.pose);
      const missing = near.filter((b) => !this._looks.has(b.id)).map((b) => lookKey(b.id));
      const fetched = missing.length ? await this.state.storage.get(missing) : new Map();
      const roster = near.map((b) => {
        const look = this._looks.get(b.id) ?? fetched.get(lookKey(b.id)) ?? null;
        if (look && !this._looks.has(b.id)) this._looks.set(b.id, look);
        return { ...b, look };
      });
      // WORLD1: the host and the room's memory ride the welcome - the world raw, never parsed here; a joiner that
      // leads the room (the same-millisecond tie the smaller id wins) is said to the rest - a reconnect that keeps
      // its own seat changed nothing and says nothing (AUDIT WORLD A4)
      const host = this._hostOf();
      if (host !== before && others.length) this._sayHost({ skip: ws });
      const world = isWorldRoom(a.key) ? await this._worldRaw() : null;
      // AUDIT WORLD34 C1: whether this welcome carried a memory rides the attachment - a socket whose welcome carried
      // NONE (the room was empty-handed, or the host had not published yet) is handed the next one the host publishes
      if (isWorldRoom(a.key)) this._setAttach(ws, { ...this._attach(ws), worldSeen: !!world });
      // WORLD5: the relay's clock rides the welcome, so a client whose machine's clock is off reads the shared world time through the offset
      // AUDIT WORLD5 C11: stamped as the welcome is BUILT, not as the hello began - four storage awaits sit between the
      // two, and every millisecond of them was an offset the client carried as the relay's clock
      // SRV-N / SLAM13 (AUDIT SLAM A5): the relay's VERSION rides it (`v`, last), so a client can tell a restarted relay from the one it was talking to, and one built against another law can say so
      const welcome = `{"t":"welcome","id":${JSON.stringify(m.id)},"peers":${JSON.stringify(roster)},"host":${JSON.stringify(host)},"world":${world ?? 'null'},"now":${Date.now()},"v":${JSON.stringify(RELAY_VERSION)}}`;
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
      if (message.length > worldFrameMaxFor(a.key)) return;   // AUDIT WORLD6a B3: a building's memory past its own cap is ignored, not stored - the prefix door knows no room, this does
      const old = await this.state.storage.get(WORLD_META);
      const final = m.final && !a.finalUsed;
      // AUDIT WORLD34 D2: the floor is the AUTHOR's - a new host's first memory after a handover fell inside the old
      // host's stamp and was dropped, while its client had already spent its publish clock on it
      if (!final && old && old.by === a.id && now - old.at < WORLD_MIN_MS) return;
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
      // AUDIT WORLD34 C1: the memory rode the welcome ALONE, so two players entering a room together were both handed
      // null and nothing ever re-synced what stood before they touched it. Everyone hello'd whose welcome carried no
      // memory is handed this one, once ({t:'world', id, data} - the host's id, the client checks it), under the foes
      // fan's byte budget (it is the foes' snapshot, and a socket is handed at most one in its life)
      const unseen = [...this._all()].filter(([other, b]) => other !== ws && b.id && !b.worldSeen);
      if (unseen.length) {
        const out = `{"t":"world","id":${JSON.stringify(a.id)},"data":${raw}}`;
        // SLAM11 (AUDIT SLAM): ITS OWN BUCKET, AND IT BORROWS. This charged the FOES bucket one indivisible sum -
        // the whole memory times every unseen socket - against a cap of FOES_ROOM_BYTES_PER_S, and byteGate caps at
        // the rate: a sum past the cap never passes however long it waits. At 200 players with a 100 KiB memory that
        // is 19.5 MiB against 4 MiB, so 0 of 199 were ever handed the room's memory, `worldSeen` latched nothing,
        // and every publish re-attempted the same unpayable fan for ever - doors, levers and emptied containers
        // silently never synced, and the memory has to be under ~21 KiB for a full room to receive it at all.
        // Pre-existing since WORLD34 C1, reachable from ~40 players. The push now borrows (net/wire.js byteGate):
        // it lands whole and leaves its bucket in debt until the rate repays it - which is fine for a frame that is
        // handed to each socket ONCE and comes every WORLD_PUBLISH_MS. And it is its OWN bucket, because a 100 KiB
        // memory's debt would have blocked the foes STREAM it used to share a bucket with for seconds.
        //
        // SLAM13 (AUDIT SLAM A4): A LISTENER AT A TIME, not the whole fan as one charge. SLAM11 borrowed the fan whole,
        // and whole is the memory times every unseen socket - the largest memory (WORLD_FRAME_MAX, 512 KiB) into a
        // full room is 127 MiB queued onto sockets in ONE tick, which is the object's whole memory. Served one
        // listener at a time, each charged as it goes and the debt bounded by ONE FRAME: the rate's worth of sockets
        // (a second of FOES_ROOM_BYTES_PER_S, then one more) are handed the memory on this publish, the rest stay
        // UNSEEN and are handed it on the next (WORLD_PUBLISH_MS, by which time the rate has repaid the debt in full).
        // A 100 KiB memory reaches forty listeners a publish; a 20 KiB one, the whole room in one.
        let bucket = this._roomWorld;
        for (const [other, b] of unseen) {
          const budget = byteGate(bucket, now, out.length, FOES_ROOM_BYTES_PER_S, true);
          bucket = budget.bucket;
          if (!budget.pass) break;   // in debt: the ones not yet served wait for the next publish, unseen
          this._setAttach(other, { ...b, worldSeen: true }); this._send(other, out);
        }
        this._roomWorld = bucket;
      }
      return;
    }
    if (m.t === 'foes') {
      // WORLD2: the host's live foes - from the host, in a world room (answered before the parse for a prefixed
      // frame, again here for a small one), on the stream's own bucket, to everyone hello'd but the host; the
      // relay reads none of it
      const now = Date.now();
      if (doored !== 'foes') { a = this._meterFoes(ws, a, now); if (!a) return; }
      // WORLD6b: in a CELL every hello'd socket streams its own foes (a foe is its spawner's); a world room's are the host's alone
      const cell = isCellRoom(a.key);
      if (!cell && (!isWorldRoom(a.key) || a.id !== this._hostOf())) return;
      // AUDIT WORLD6b B3: a cell's frame carries at most CELL_FRAME_RECORDS_MAX records - each one MINTS a foe at every
      // reader, and a dungeon's bound (`i >= _layoutFoes`, a layout every client built) has no cell equivalent; over
      // it the frame is junk, counted (the relay still reads nothing inside a record)
      if (cell && (!Array.isArray(m.data.f) || m.data.f.length > CELL_FRAME_RECORDS_MAX)) { this._junk(ws, a); return; }
      // AUDIT WORLD6b A4: a cell's fan is RANGED as the pose's is (RANGE_PIXELS inside a sixteen-pixel cell) - a foe
      // nobody near me can see stands nowhere on my screen; a dungeon's reaches every socket in the place
      const listeners = [...this._all()].filter(([other, b]) => other !== ws && b.id && (!cell || inRange(a.key, a.pose, b.pose)));
      // A5: the room's byte budget - the fan is the frame times its listeners, and one host into a full room was
      // 191 MiB/s out of one object; over it the frame is dropped and nobody struck (the next full frame heals it).
      // AUDIT WORLD6b A3: the budget is asked BEFORE the frame is re-serialised (the fan's bytes are the frame's plus
      // the envelope's, estimated), so a dropped frame costs no stringify
      const budget = byteGate(this._roomFoes, now, (message.length + a.id.length + 8) * listeners.length, FOES_ROOM_BYTES_PER_S);
      this._roomFoes = budget.bucket;
      if (!budget.pass || !listeners.length) return;
      const out = JSON.stringify({ t: 'foes', id: a.id, data: m.data });
      for (const [other] of listeners) this._send(other, out);
      return;
    }
    if (m.t === 'hit') {
      // WORLD2: a blow on the host's foe - from anyone but the host, in a world room, on the pose bucket, to the
      // host's socket alone (the host applies it through its own damage door and the next foes frame says so)
      const now = Date.now();
      a = this._meter(ws, a, now); if (!a) return;
      // WORLD6b: in a CELL the blow goes to the foe's OWNER, the socket the frame's `to` names (never the striker's own);
      // in a world room to the host's alone, as WORLD2 has it
      const cell = isCellRoom(a.key);
      if (!cell && !isWorldRoom(a.key)) return;
      const host = cell ? hitOwnerOf(m.data) : this._hostOf();
      if (!host || host === a.id) return;
      // AUDIT WORLD6b A1: the ROUTE is resolved before anything is spent - a `to` that names no socket in the room (a
      // peer gone, or a name a hostile client made up) delivers nothing, buys nothing, and is counted as junk (AUDIT
      // WORLD2 A4's instrument), so a stream of them is struck out; a world room's host is always a socket
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === host) ?? null;
      if (!target) { if (cell) this._junk(ws, a); return; }
      // A6: the funnel onto the destination's ONE socket - all strikers together, HIT_ROOM_HZ_MAX a second; over it
      // the blow is dropped and nobody struck. AUDIT WORLD6b A1/A2: the budget is the DESTINATION's (its attachment's
      // own bucket), not the room's - in a cell the blows go to many owners, and one room-wide bucket let six honest
      // fights, or one stream of unroutable blows, silence every other blow in the country
      const [tws, tb] = target;
      const funnel = tokenGate(tb.hbucket ?? null, now, HIT_ROOM_HZ_MAX);
      this._setAttach(tws, { ...tb, hbucket: funnel.bucket });
      if (!funnel.pass) return;
      const out = JSON.stringify({ t: 'hit', id: a.id, data: m.data });
      // AUDIT WORLD6b-iii(c) C3: the room's hit bytes - a grant carries a corpse's pile, so the arm counts bytes as the
      // foes and the acts do; over the budget the frame is dropped, nobody struck (three sockets pushed 720 KiB/s of
      // grants into one destination through an arm that counted frames alone)
      const bytes = byteGate(this._roomHits, now, out.length, HIT_ROOM_BYTES_PER_S);
      this._roomHits = bytes.bucket;
      if (!bytes.pass) return;
      this._send(tws, out);
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
      const listeners = [...this._all()].filter(([other, b]) => other !== ws && b.id);
      // AUDIT WORLD3 A1: the fan is the frame times its listeners, and a frame count is no bound on it.
      // SLAM11 (AUDIT SLAM): AND IT BORROWS. byteGate caps at the rate, so an act whose fan cost more than one
      // second of ACT_ROOM_BYTES_PER_S could never land - a 6 KiB act to 199 listeners was dropped whole, silently,
      // for ever, while `actFrameFits` told its author anything up to MAX_FRAME_BYTES would. A door is not
      // self-healing: nothing re-sends it. It lands whole now and the bucket is in debt until the rate repays it -
      // at most one fan's worth, MAX_FRAME_BYTES x SOCKETS_MAX, four seconds of acts - and the frame gate beside it
      // (ACT_ROOM_HZ_MAX) still bounds how many come.
      // SLAM13 (AUDIT SLAM A1): THE SENDER'S OWN SHARE FIRST. A borrowing room bucket is one that ONE sender can hold
      // in debt on purpose - the largest act into a full room is four seconds of the room's rate per frame, at
      // ACT_HZ_MAX - and every other door in the room was refused while it did. So the fan is charged to the sender's
      // own borrowing bucket (`abytes`, ACT_SENDER_BYTES_PER_S, on the attachment) before the room's, and a frame the
      // sender's bucket refuses charges the room nothing; a frame the room refuses charges the sender nothing either,
      // so an honest sender behind a flooder is not left paying for a door that never opened.
      const cost = out.length * listeners.length;
      const mine = byteGate(a.abytes, now, cost, ACT_SENDER_BYTES_PER_S, true);
      if (!mine.pass) { this._setAttach(ws, { ...a, abytes: mine.bucket }); return; }
      const bytes = byteGate(this._roomActBytes, now, cost, ACT_ROOM_BYTES_PER_S, true);
      this._roomActBytes = bytes.bucket;
      if (!bytes.pass) { this._setAttach(ws, { ...a, abytes: { bytes: mine.bucket.bytes + cost, at: now } }); return; }   // refilled, not charged
      this._setAttach(ws, { ...a, abytes: mine.bucket });
      for (const [other] of listeners) this._send(other, out);
      return;
    }
    if (m.t === 'social') {
      // SOC1: a friend or party act - on the acts' own bucket (the same strikes), in the hub alone (outside it junk: a
      // correct client sends none there), from an account (without one refused in words), under the room's budget
      // (over it 'busy', nobody struck); what it did or why not is the hub's answer, never a close
      const now = Date.now();
      a = this._meterSocial(ws, a, now); if (!a) return;
      if (!isSocialRoom(a.key)) { this._junk(ws, a); return; }
      if (!a.acct) { this._sayError(ws, 'no account'); return; }
      const budget = tokenGate(this._roomSocial, now, SOCIAL_ROOM_HZ_MAX);
      this._roomSocial = budget.bucket;
      if (!budget.pass) { this._sayError(ws, 'busy'); return; }
      let err;
      try { err = await this._social(ws, a, m, now); } catch (e) { console.warn('[hub] social act failed', m.k, e?.message ?? e); err = 'the hub stumbled - try again'; }
      if (err) this._sayError(ws, err);
      return;
    }
    if (m.t === 'party') {
      // SOC1: my party pose - on the poses' own bucket, in the hub alone, kept on the attachment (`pm`: the seat I may
      // yet take reads it) and fanned to my party's other members alone; the relay reads nothing inside it past the
      // door's projection
      const now = Date.now();
      a = this._meterParty(ws, a, now); if (!a) return;
      if (!isSocialRoom(a.key) || !a.acct) { this._junk(ws, a); return; }
      this._setAttach(ws, { ...a, pm: { ...m.p, at: now } });
      if (!a.party) return;
      const party = await this._livingParty(a.party, now);
      if (!party || !party.members.includes(a.acct)) return;
      const out = JSON.stringify({ t: 'party', acct: a.acct, p: m.p });
      for (const member of party.members) if (member !== a.acct) for (const other of this._socketsOf(member)) this._send(other, out);
      return;
    }
    if (m.t === 'who') {
      // WORLD6b-iii(e): a member beyond the welcome's roster (ROSTER_MAX, the nearest - AUDIT ONLINE A5's bound on the
      // WELCOME, not on the room) asked for by name, on the asks' own bucket (WHO_HZ_MAX, the same strikes); answered
      // to the asker alone with the member's JOIN (its hello's name and look, its latest pose) - the frame the
      // session already reads. A name that is no hello'd socket in the room (gone, or made up) answers nothing and is
      // counted as junk (AUDIT WORLD2 A4's instrument), so a stream of them is struck out; one's own name likewise.
      const now = Date.now();
      a = this._meterWho(ws, a, now); if (!a) return;
      if (isChatRoom(a.key)) return;   // a channel has no roster and no doll
      const id = whoIdOf(m);
      // AUDIT WORLD6b-iii(e) B3: junk is what a CORRECT client never sends - one's own name (the parser refused a bad
      // one); a name that left between the frame that asked and the ask is the honest race, and answers nothing
      if (!id || id === a.id) { this._junk(ws, a); return; }
      // B1: the room's own budget, every asker together - a room-wide bound is what every other arm carries.
      // SLAM9: spent BEFORE the scan for the target, not after it. The scan is a fresh SOCKETS_MAX-entry array and a
      // linear search, and it ran for every ask the budget was about to refuse - so the "room budget" bounded the
      // sends and the storage reads and left the object's own work unbounded, which is the wrong half to bound.
      const budget = tokenGate(this._roomWho, now, WHO_ROOM_HZ_MAX);
      this._roomWho = budget.bucket;
      if (!budget.pass) return;
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === id) ?? null;
      if (!target) return;
      const [tws, b] = target;
      let look = this._looks.get(b.id) ?? null;
      if (!look) { look = (await this.state.storage.get(lookKey(b.id))) ?? null; if (look) this._looks.set(b.id, look); }
      // B9: the socket asked for is read again after the await - a member gone meanwhile is not said to have joined
      if (this._attach(tws)?.id !== b.id) return;
      // B2: the pose rides only WITHIN RANGE - the pose fan's own law (a stranger heard through that fan is in range by
      // construction; a room without the law, a dungeon's, says it); past the range the answer named a member's
      // position the fan had refused to say, a radar over the whole cell
      this._send(ws, JSON.stringify({ t: 'join', id: b.id, name: b.name, look, pose: inRange(a.key ?? '', a.pose, b.pose) ? (b.pose ?? null) : null }));
      return;
    }
    if (m.t === 'pose' || m.t === 'ping') {
      // the frame gate (A8): a pose and a ping share the socket's bucket, and a channel's pose is gated and counted
      // BEFORE it is declined (AUDIT CHAT A3: the early return sat above the gate, so a channel took frames unmetered)
      const chat = isChatRoom(a.key);
      const posed = m.t === 'pose' && !chat;
      // SLAM8 (AUDIT SLAM): a KEEPALIVE is a pose the sender did not move (net/wire.js poseChanged, the client's own
      // law for not sending one). Read BEFORE the meter, because the meter overwrites `a.pose` with this very frame.
      // SLAM13 (AUDIT SLAM A2): AND THE WHOLE FAN HAS A FLOOR. The port's client sends an unmoved pose every
      // HEARTBEAT_MS and no sooner; a modified one sends them at the pose gate's ceiling, and each went to the whole
      // room - 20 x 199 sends a second from one socket, beyond what the tier bounds a MOVER to. A keepalive is heard
      // whole only when the sender's last whole fan (`kept`, on the PASS patch as `turn` is) is KEEPALIVE_FAN_MS
      // old; inside the floor it is tiered like a move. An honest heartbeat always clears half its own period.
      const now = Date.now();
      // SLAM15 (AUDIT SLAM FINAL A6): AND A STOP IS HEARD WHOLE TOO. The pose that ends a walk - the first with `mv`
      // 0 after one that moved - carries the place the player actually stopped, and under the tier three far slices
      // in four never heard it: they eased to the last pose they were served, up to a second of walking short of
      // where the player stands, and stood there wrong until the next heartbeat corrected it five seconds on. A
      // stop is one frame per walk, so it is fanned whole like a keepalive, under the same floor: a client toggling
      // `mv` at the gate's ceiling buys the same two whole fans a second a keepalive flood does, and no more.
      const unmoved = posed && !!a.pose && !poseChanged(a.pose, m.p);
      const stopped = posed && !!a.pose && (a.pose.mv | 0) !== 0 && (m.p.mv | 0) === 0;
      const still = (unmoved || stopped) && now - (a.kept ?? 0) >= KEEPALIVE_FAN_MS;
      // SLAM6: `turn` is the sender's own pose counter, and the only state the far tier needs - which slice of the
      // listeners past POSE_FAN_MAX this pose serves. Masked, so an attachment a socket carries for a day stays small.
      // SLAM8: and it rides the PASS patch. `_meter` writes its ordinary patch back whether or not the gate passed, so
      // a counter put there counted poses RECEIVED while the fan below serves poses RELAYED. Any drop pattern sharing
      // a factor with POSE_FAR_SHARE then pinned the served slice to one parity and starved the rest - at exactly
      // twice the gate the bucket settles into pass/fail alternation, so two of the four slices were never served and
      // half the far tier heard that sender no more. The port's own client cannot reach that rate; a modified one can,
      // and an event is where those turn up.
      const met = this._meter(ws, a, now, { pose: posed ? m.p : a.pose }, posed ? { turn: ((a.turn | 0) + 1) & 0xffff, ...(still ? { kept: now } : {}) } : {});
      if (!met) return;   // over the rate: kept as the latest, not relayed
      if (m.t === 'ping') { this._send(ws, '{"t":"pong"}'); return; }   // a ping that reached the object (the runtime answers the exact one in its sleep)
      if (chat) return;   // a channel is no place: a pose there is kept by no one and reaches no one
      const out = JSON.stringify({ t: 'pose', id: a.id, p: m.p });
      // SLAM1: the fan is BOUNDED. A room's cost was N senders times N listeners, and the range cull does not help
      // the one case that matters - an event, where everybody stands in one place and every range test passes.
      // Measured on the fake object: 91k sends a second at 96 players (SLAM13 struck a claim here about where a real
      // one stops; nothing has measured it - AUDIT SLAM C1).
      // SLAM6: the nearest POSE_FAN_MAX hear every pose and THE REST HEAR ONE IN POSE_FAR_SHARE, by turns. SLAM1
      // sent the rest nothing at all, so the silence law HID every sender from every listener past the bound -
      // measured at 200 in one town block, each player was seen by 32 and erased for 167. The bound is a rank, so
      // the loss fell hardest on the most crowded player in the room, which at an event is the one everybody came
      // to see.
      // SLAM8: AND A KEEPALIVE IS NEVER TIERED. A standing player sends only on the heartbeat, so a far listener under
      // SLAM6 heard one in POSE_FAR_SHARE of those - HEARTBEAT_MS * POSE_FAR_SHARE = 20000ms, which is
      // PEER_TIMEOUT_MS TO THE MILLISECOND. Zero margin: the silence law hid every standing peer past the bound at
      // the exact moment its next pose was due, so a crowd standing still to listen to somebody - which is what an
      // event IS - watched itself blink in and out, and one late heartbeat hid a peer for a full twenty seconds.
      // The tier is a bandwidth saving for MOTION; a keepalive is the one frame whose whole job is to be heard, and
      // a pose nobody has to ease is the cheapest frame in the room. At 200 standing that is 200 * 199 / 5s = 7,960
      // sends a second, beside the 59,000 the moving case already pays.
      const heard = [];
      for (const [other, b] of [...this._all()]) {
        if (other === ws || !b.id) continue;
        if (inRange(a.key ?? '', m.p, b.pose)) heard.push([other, b]);
      }
      for (const [other] of (still ? heard : poseFan(heard, m.p, (e) => e[1].pose, met.turn, (e) => e[1].id))) this._send(other, out);   // SLAM10: the far tier bucketed by the listener's ID, so a moving crowd cannot shuffle who is served
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
    try { await this._leave(ws); } finally { await this._reap(); }
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  async webSocketError(ws) { try { await this._leave(ws); } finally { await this._reap(); } }

  async _leave(ws) {
    if (this._gone.has(ws)) return;   // AUDIT WORLD34 D1: said once - the reap and a runtime's own close are the same leave
    this._gone.add(ws);
    this._dead.delete(ws);
    const a = this._attach(ws);
    this._forget(ws);
    // AUDIT CHAT A7: a room that drained sweeps its own storage on the way out - the empty-hello sweep never
    // runs in a channel, which is never empty on the way in; what an unclean close left behind goes here
    const last = this.state.getWebSockets().filter((w) => w !== ws).length === 0;
    if (last) { try { await this._sweep(); if (isWorldRoom(a.key)) await this.state.storage.setAlarm(Date.now() + WORLD_TTL_MS); } catch { /* the next drain, or the next empty hello */ } }
    if (!a.id) return;   // never said hello, or replaced - the id lives on in another socket
    this._looks.delete(a.id);
    if (!last) { try { await this.state.storage.delete([lookKey(a.id), secretKey(a.id)]); } catch { /* the room forgets it on the next empty hello */ } }
    // ROSTER-G: a channel says its leaves now, as it says its joins - the roster beside the chat is everyone online
    const out = JSON.stringify({ t: 'leave', id: a.id });
    for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, out);
    if (!isChatRoom(a.key) && this._leads(a, ws)) this._sayHost({ skip: ws, except: ws });   // WORLD1: the host left - the next-longest in the room is the host now, said to everyone (ROSTER-G: a channel has no host)
    if (isSocialRoom(a.key) && a.acct) { try { await this._leaveAccount(ws, a, Date.now()); } catch (e) { console.warn('[hub] leave failed', e?.message ?? e); } }   // SOC1: last seen stamped, the friends and the party told
  }

  // ───────────────────────────── SOC1: THE HUB ─────────────────────────────
  /** The account's record, or null. */
  async _acct(id) { const r = await this.state.storage.get(acctKey(id)); return r && typeof r === 'object' ? r : null; }
  /** Several accounts' records at once - a Durable Object's batched get takes 128 keys at most (SLAM5's wall), so chunked. */
  async _accts(ids) {
    const out = new Map();
    const keys = [...new Set(ids)].map(acctKey);
    for (let i = 0; i < keys.length; i += 128) { const got = await this.state.storage.get(keys.slice(i, i + 128)); for (const [k, v] of got) if (v && typeof v === 'object') out.set(k.slice(5), v); }
    return out;
  }
  /** A party's record - the instance's copy, else storage's (kept then); null when there is none. */
  async _party(pid) {
    const held = this._parties.get(pid);
    if (held) return held;
    const r = await this.state.storage.get(partyKey(pid));
    if (r && typeof r === 'object') { this._parties.set(pid, r); return r; }
    return null;
  }
  async _putParty(party) { this._parties.set(party.id, party); await this.state.storage.put(partyKey(party.id), party); }
  async _delParty(pid) { this._parties.delete(pid); await this.state.storage.delete(partyKey(pid)); }
  /** A party as it stands now: its lapsed seats given up (PARTY_OFFLINE_MS offline - the rest told), null when gone. */
  async _livingParty(pid, now) {
    let party = await this._party(pid);
    if (!party) return null;
    const lapsed = party.members.filter((id) => party.away?.[id] != null && now - party.away[id] >= PARTY_OFFLINE_MS && !this._socketsOf(id).length);
    for (const id of lapsed) { if (!party) break; const rec = await this._acct(id); party = await this._partyOut(id, party, now, 'party.lapsed', rec?.name ?? null); }
    return party;
  }
  /** The party an account sits in, as it stands - or null, the record's stale pointer cleared (a lapse, a drain, a kick
   *  while it was away). Returns [party, rec] with `rec` written when it changed. */
  async _myParty(acct, rec, now) {
    if (!rec.party) return [null, rec];
    const party = await this._livingParty(rec.party, now);
    if (party && party.members.includes(acct)) return [party, rec];
    const next = { ...rec, party: null };
    await this.state.storage.put(acctKey(acct), next);
    this._markParty(acct, null);
    return [null, next];
  }
  /** The party id on every socket of an account - the party pose's fan reads it, so it never reads storage for the seat. */
  _markParty(acct, pid) { for (const ws of this._socketsOf(acct)) { const b = this._attach(ws); if ((b.party ?? null) !== pid) this._setAttach(ws, { ...b, party: pid }); } }
  /** One frame to every hello'd socket of an account, `except` one. */
  _sayTo(acct, s, except = null) { for (const ws of this._socketsOf(acct, except)) this._send(ws, s); }
  _sayError(ws, m) { this._send(ws, JSON.stringify({ t: 'social', k: 'error', m })); }
  /** A note - a code the client puts words to; `acct`/`name` its subject. */
  _sayNote(to, code, acct, name) { this._sayTo(to, JSON.stringify({ t: 'social', k: 'note', code, acct, name: name ?? null })); }
  /** An account as the hub names it: online when any of its sockets is here, its peers those sockets' ids, seen now while online. */
  _rowOf(acct, rec, now, except = null) {
    const socks = this._socketsOf(acct, except);
    return { acct, name: rec?.name ?? null, online: socks.length > 0, seen: socks.length ? now : (rec?.seen ?? null), peers: socks.slice(0, ACCOUNT_TABS_MAX).map((ws) => this._attach(ws).id) };
  }
  /** A party as its members see it: the rows and each member's latest pose (the newest `pm` among its sockets). */
  _partyView(party, recs, now, except = null) {
    const members = party.members.map((id) => {
      let pm = null;
      for (const ws of this._socketsOf(id, except)) { const b = this._attach(ws); if (b.pm && (!pm || b.pm.at > pm.at)) pm = b.pm; }
      let p = null;
      if (pm) { p = { ...pm }; delete p.at; }
      return { ...this._rowOf(id, recs.get(id), now, except), p };
    });
    return { id: party.id, leader: party.leader, members };
  }
  /** The party to every member's sockets, `except` one. */
  async _sayParty(party, now, except = null) {
    const recs = await this._accts(party.members);
    const out = JSON.stringify({ t: 'social', k: 'party', party: this._partyView(party, recs, now, except) });
    for (const id of party.members) this._sayTo(id, out, except);
  }
  /** An account's whole picture, to `only` or to every socket it holds. */
  async _sayState(acct, rec, now, only = null) {
    const [party, mine] = await this._myParty(acct, rec, now);
    const invites = [];
    for (const i of mine.invites ?? []) { if (now - i.at >= INVITE_TTL_MS) continue; const p = await this._party(i.party); if (p) invites.push([i, p]); }
    const ids = [...mine.friends, ...mine.in.map((e) => e.acct), ...mine.out.map((e) => e.acct), ...(party?.members ?? [])];
    for (const [i, p] of invites) ids.push(i.from, ...p.members);
    const recs = await this._accts(ids);
    const row = (id) => this._rowOf(id, recs.get(id), now);
    const frame = {
      t: 'social', k: 'state', acct, name: mine.name,
      friends: mine.friends.map(row),
      in: mine.in.map((e) => ({ ...row(e.acct), at: e.at })),
      out: mine.out.map((e) => ({ ...row(e.acct), at: e.at })),
      party: party ? this._partyView(party, recs, now) : null,
      invites: invites.map(([i, p]) => ({ party: p.id, from: { acct: i.from, name: recs.get(i.from)?.name ?? null }, members: p.members.map((id) => ({ acct: id, name: recs.get(id)?.name ?? null })), at: i.at, expires: i.at + INVITE_TTL_MS })),
    };
    const s = JSON.stringify(frame);
    if (only) this._send(only, s); else this._sayTo(acct, s);
  }
  /** An account came or went: its friends hear the row (online, seen, the peer ids its tabs stand as). */
  _sayPresence(acct, rec, now, except = null) {
    const out = JSON.stringify({ t: 'social', k: 'presence', ...this._rowOf(acct, rec, now, except) });
    for (const f of rec.friends) this._sayTo(f, out, except);
  }
  /** The hello's account: guarded by its secret (the first hello mints it), its record made or refreshed (the name it
   *  said, seen now), its party's seat taken back (`away` cleared) or found gone, and its whole picture handed to this
   *  socket; then the friends and the party told - on EVERY hello, a second tab's too, since the peer ids my tabs
   *  stand as are what a friend's client marks me by in the world. */
  async _helloAccount(ws, m, now) {
    const held = await this.state.storage.get(acctSecretKey(m.acct));
    if (held && held !== m.asecret) { this._sayError(ws, 'account taken'); return; }
    if (!held) await this.state.storage.put(acctSecretKey(m.acct), m.asecret);
    let a = this._attach(ws);
    if (a.id !== m.id) return;   // replaced or gone while storage answered
    let rec = { ...((await this._acct(m.acct)) ?? newAcct(m.name, now)), name: m.name, seen: now };
    let party = null;
    if (rec.party) {
      party = await this._livingParty(rec.party, now);
      if (!party || !party.members.includes(m.acct)) { rec.party = null; party = null; }
      else if (party.away?.[m.acct] != null) { const away = { ...party.away }; delete away[m.acct]; party = { ...party, away }; await this._putParty(party); }
    }
    await this.state.storage.put(acctKey(m.acct), rec);
    a = this._attach(ws);
    if (a.id !== m.id || !this._setAttach(ws, { ...a, acct: m.acct, party: rec.party })) return;
    await this._sayState(m.acct, rec, now, ws);
    this._sayPresence(m.acct, rec, now);
    if (party) await this._sayParty(party, now);
  }
  /** The account behind a closing socket: last seen stamped when its last tab went, the friends and the party told (a
   *  seat is kept `away` for PARTY_OFFLINE_MS - a refresh brings it straight back). */
  async _leaveAccount(ws, a, now) {
    const rec = await this._acct(a.acct);
    if (!rec) return;
    const gone = this._socketsOf(a.acct, ws).length === 0;
    const next = gone ? { ...rec, seen: now } : rec;
    if (gone) await this.state.storage.put(acctKey(a.acct), next);
    this._sayPresence(a.acct, next, now, ws);
    if (!next.party) return;
    let party = await this._livingParty(next.party, now);
    if (!party || !party.members.includes(a.acct)) return;
    if (gone) { party = { ...party, away: { ...(party.away ?? {}), [a.acct]: now } }; await this._putParty(party); }
    await this._sayParty(party, now, ws);
  }
  /** The account an act names: `acct` as given, `peer` through the hub socket that holds that id; never oneself. */
  _targetOf(me, m) {
    if (m.acct) return m.acct === me ? { error: 'that is you' } : { acct: m.acct };
    for (const [, b] of this._all()) if (b.id === m.peer) { if (!b.acct) return { error: 'they have no account' }; return b.acct === me ? { error: 'that is you' } : { acct: b.acct }; }
    return { error: 'they are not online' };
  }
  /** An account out of a party - by choice, by the leader's hand, by a yes to another, by a lapsed seat: the seat passes to
   *  the longest-standing member when the leader goes, the party is deleted when nobody is left; the rest are told
   *  (`code` names why, then the party as it stands). Returns the party after, or null when gone. The account's own
   *  record is the caller's to write. */
  async _partyOut(acct, party, now, code, name) {
    if (!party.members.includes(acct)) return party;
    const members = party.members.filter((m) => m !== acct);
    const away = { ...(party.away ?? {}) }; delete away[acct];
    if (!members.length) { await this._delParty(party.id); return null; }
    const leader = party.leader === acct ? members[0] : party.leader;
    const next = { ...party, members, leader, away };
    await this._putParty(next);
    for (const m of members) this._sayNote(m, code, acct, name);
    if (leader !== party.leader) { const lrec = await this._acct(leader); for (const m of members) this._sayNote(m, 'party.leader', leader, lrec?.name ?? null); }
    await this._sayParty(next, now);
    return next;
  }
  /** One act, from an account: null when done, else the refusal in words. */
  async _social(ws, a, m, now) {
    const me = a.acct;
    const rec = await this._acct(me);
    if (!rec) return 'no account';
    switch (m.k) {
      case 'friend.request': return this._friendRequest(me, rec, m, now);
      case 'friend.accept': return this._friendAccept(me, rec, m.acct, now);
      case 'friend.decline': return this._friendUnlist(me, rec, m.acct, now, 'in', 'out');
      case 'friend.cancel': return this._friendUnlist(me, rec, m.acct, now, 'out', 'in');
      case 'friend.remove': return this._friendRemove(me, rec, m.acct, now);
      case 'party.invite': return this._partyInvite(me, rec, m, now);
      case 'party.accept': return this._partyAccept(me, rec, m.party, now);
      case 'party.decline': return this._partyDecline(me, rec, m.party, now);
      case 'party.leave': return this._partyLeave(me, rec, now);
      case 'party.kick': return this._partyKick(me, rec, m.acct, now);
      default: return 'unknown act';
    }
  }
  async _friendRequest(me, rec, m, now) {
    const t = this._targetOf(me, m);
    if (t.error) return t.error;
    const them = t.acct;
    const trec = await this._acct(them);
    if (!trec) return 'no such player';
    if (rec.friends.includes(them)) return 'already friends';
    if (hasEntry(rec.in, them)) return this._friendAccept(me, rec, them, now);   // they asked first: a request back is a yes
    if (hasEntry(rec.out, them)) return 'already asked';
    if (rec.friends.length >= FRIENDS_MAX) return 'your friend list is full';
    if (trec.friends.length >= FRIENDS_MAX) return 'their friend list is full';
    if (rec.out.length >= PENDING_MAX) return 'too many requests out';
    if (trec.in.length >= PENDING_MAX) return 'their inbox is full';
    const mine = { ...rec, out: [...rec.out, { acct: them, at: now }] };
    const theirs = { ...trec, in: [...trec.in, { acct: me, at: now }] };
    await this.state.storage.put({ [acctKey(me)]: mine, [acctKey(them)]: theirs });
    await this._sayState(me, mine, now); await this._sayState(them, theirs, now);
    this._sayNote(them, 'friend.requested', me, mine.name);
    return null;
  }
  async _friendAccept(me, rec, them, now) {
    if (!hasEntry(rec.in, them)) return 'no such request';
    const trec = await this._acct(them);
    if (!trec) { const mine = { ...rec, in: without(rec.in, them) }; await this.state.storage.put(acctKey(me), mine); await this._sayState(me, mine, now); return 'no such player'; }
    if (rec.friends.length >= FRIENDS_MAX) return 'your friend list is full';
    if (trec.friends.length >= FRIENDS_MAX) return 'their friend list is full';
    const mine = { ...rec, in: without(rec.in, them), out: without(rec.out, them), friends: rec.friends.includes(them) ? rec.friends : [...rec.friends, them] };
    const theirs = { ...trec, in: without(trec.in, me), out: without(trec.out, me), friends: trec.friends.includes(me) ? trec.friends : [...trec.friends, me] };
    await this.state.storage.put({ [acctKey(me)]: mine, [acctKey(them)]: theirs });
    await this._sayState(me, mine, now); await this._sayState(them, theirs, now);
    this._sayNote(them, 'friend.accepted', me, mine.name);
    return null;
  }
  /** A decline (mine `in`, theirs `out`) or a cancel (mine `out`, theirs `in`): the request gone from both, quietly. */
  async _friendUnlist(me, rec, them, now, mineList, theirList) {
    if (!hasEntry(rec[mineList], them)) return 'no such request';
    const trec = await this._acct(them);
    const mine = { ...rec, [mineList]: without(rec[mineList], them) };
    const puts = { [acctKey(me)]: mine };
    let theirs = null;
    if (trec) { theirs = { ...trec, [theirList]: without(trec[theirList], me) }; puts[acctKey(them)] = theirs; }
    await this.state.storage.put(puts);
    await this._sayState(me, mine, now); if (theirs) await this._sayState(them, theirs, now);
    return null;
  }
  async _friendRemove(me, rec, them, now) {
    if (!rec.friends.includes(them)) return 'not a friend';
    const trec = await this._acct(them);
    const mine = { ...rec, friends: without(rec.friends, them) };
    const puts = { [acctKey(me)]: mine };
    let theirs = null;
    if (trec) { theirs = { ...trec, friends: without(trec.friends, me) }; puts[acctKey(them)] = theirs; }
    await this.state.storage.put(puts);
    await this._sayState(me, mine, now); if (theirs) await this._sayState(them, theirs, now);
    return null;
  }
  async _partyInvite(me, rec, m, now) {
    const t = this._targetOf(me, m);
    if (t.error) return t.error;
    const them = t.acct;
    if (!this._socketsOf(them).length) return 'they are not online';
    const trec = await this._acct(them);
    if (!trec) return 'no such player';
    let [party, mine] = await this._myParty(me, rec, now);
    let made = false;
    if (!party) {   // no party yet: mine is made now, with me in the seat
      party = { id: mintPartyId(Math.random, now), leader: me, members: [me], invites: [], away: {}, at: now };
      mine = { ...mine, party: party.id };
      made = true;
    }
    if (party.members.includes(them)) return 'already in your party';
    if (party.members.length >= PARTY_MAX) return 'the party is full';
    const live = party.invites.filter((i) => now - i.at < INVITE_TTL_MS && i.acct !== them);
    if (live.length >= PARTY_INVITES_MAX) return 'too many invites out';
    const tinv = (trec.invites ?? []).filter((i) => now - i.at < INVITE_TTL_MS && i.party !== party.id);
    if (tinv.length >= PENDING_MAX) return 'their invites are full';
    const next = { ...party, invites: [...live, { acct: them, at: now }] };
    const theirs = { ...trec, invites: [...tinv, { party: party.id, from: me, at: now }] };
    await this._putParty(next);
    const puts = { [acctKey(them)]: theirs };
    if (made) puts[acctKey(me)] = mine;
    await this.state.storage.put(puts);
    if (made) this._markParty(me, next.id);
    const recs = await this._accts(next.members);
    this._sayTo(them, JSON.stringify({ t: 'social', k: 'invite', party: next.id, from: { acct: me, name: mine.name }, members: next.members.map((id) => ({ acct: id, name: recs.get(id)?.name ?? null })), at: now, expires: now + INVITE_TTL_MS }));
    if (made) await this._sayParty(next, now);
    this._sayNote(me, 'party.invited', them, trec.name);
    return null;
  }
  async _partyAccept(me, rec, pid, now) {
    const inv = (rec.invites ?? []).find((i) => i.party === pid);
    if (!inv) return 'no such invite';
    const shed = { ...rec, invites: rec.invites.filter((i) => i.party !== pid) };
    const refuse = async (why) => { await this.state.storage.put(acctKey(me), shed); await this._sayState(me, shed, now); return why; };
    if (now - inv.at >= INVITE_TTL_MS) return refuse('that invite has lapsed');
    const party = await this._livingParty(pid, now);
    if (!party) return refuse('that party is gone');
    if (party.members.includes(me)) return refuse('you are in that party already');
    if (party.members.length >= PARTY_MAX) return refuse('the party is full');
    // out of my own party first - a yes to a new one is a no to the old
    let mine = shed;
    const [old] = await this._myParty(me, mine, now);
    if (old) await this._partyOut(me, old, now, 'party.left', mine.name);
    const away = { ...(party.away ?? {}) }; delete away[me];
    const next = { ...party, members: [...party.members, me], invites: party.invites.filter((i) => i.acct !== me), away };
    mine = { ...mine, party: pid };
    await this._putParty(next);
    await this.state.storage.put(acctKey(me), mine);
    this._markParty(me, pid);
    await this._sayState(me, mine, now);
    for (const member of party.members) this._sayNote(member, 'party.joined', me, mine.name);
    await this._sayParty(next, now);
    return null;
  }
  async _partyDecline(me, rec, pid, now) {
    const inv = (rec.invites ?? []).find((i) => i.party === pid);
    if (!inv) return 'no such invite';
    const mine = { ...rec, invites: rec.invites.filter((i) => i.party !== pid) };
    await this.state.storage.put(acctKey(me), mine);
    const party = await this._party(pid);
    if (party) await this._putParty({ ...party, invites: party.invites.filter((i) => i.acct !== me) });
    await this._sayState(me, mine, now);
    if (now - inv.at < INVITE_TTL_MS && party?.members.includes(inv.from)) this._sayNote(inv.from, 'party.declined', me, mine.name);
    return null;
  }
  async _partyLeave(me, rec, now) {
    const [party, mine] = await this._myParty(me, rec, now);
    if (!party) return 'you are not in a party';
    await this._partyOut(me, party, now, 'party.left', mine.name);
    const next = { ...mine, party: null };
    await this.state.storage.put(acctKey(me), next);
    this._markParty(me, null);
    this._sayTo(me, JSON.stringify({ t: 'social', k: 'party', party: null }));
    return null;
  }
  async _partyKick(me, rec, them, now) {
    const [party] = await this._myParty(me, rec, now);
    if (!party) return 'you are not in a party';
    if (party.leader !== me) return 'only the leader can do that';
    if (them === me) return 'that is you';
    if (!party.members.includes(them)) return 'they are not in your party';
    const trec = await this._acct(them);
    await this._partyOut(them, party, now, 'party.kicked', trec?.name ?? null);
    if (trec) await this.state.storage.put(acctKey(them), { ...trec, party: null });
    this._markParty(them, null);
    this._sayTo(them, JSON.stringify({ t: 'social', k: 'party', party: null }));
    this._sayNote(them, 'party.kicked', them, trec?.name ?? null);
    return null;
  }
}
