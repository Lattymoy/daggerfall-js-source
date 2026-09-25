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
//
// AUDIT SOC (2026-09-16, Mac: "Can we do an audit of everything just
// merged. Just want it to be perfection"): four lenses read the arc as
// merged and the hub's holes were these, every one measured over the
// fake object or workerd. A1 a friend request and its cancel were a
// 40x amplifier aimed at one player (a state frame and a chat line at
// the target per act, outside the chat's room-wide law because a note
// is DIRECTED) - one act of a kind at the same target per
// SOCIAL_REPEAT_MS per account now, and an invite the same (A8). A2
// three arms let a storage throw out of the door while the two beside
// them were wrapped - all five contain now. A3 one script at the hello
// gate's rate minted 4.3 million permanent accounts a day - the alarm
// sweeps, a page at a time, accounts NOBODY'S LIST NAMES and nobody has
// seen for ACCOUNT_IDLE_MS, and parties whose every seat has lapsed
// (A4: a party of one whose maker never returns was reachable by
// nothing), and the drain's sweep lists in pages. A5 one act read ~500
// keys - a state frame for an account with no socket is composed no
// more (it reached nobody), the invites' parties are read in one batch,
// a missing party is a cached miss, and the records an awake object has
// read are kept on it. A6 a stranger could take the hub's presence and
// live peer ids off an unaccepted request - a request or an invite BY
// ACCOUNT needs a relation (a request back, a friend), and a pending
// row carries a name and nothing else. A7 a socket REPLACED by a hello
// naming another account (or none) never ran its account's leave, so
// its seat could never lapse - it leaves at the replacement. A10 the
// tab bound is the hub's (ACCOUNT_TABS_MAX sockets fanned to), A11 the
// refusals are budgeted. B7 the channel's welcome carries the relay's
// clock (`now`), so the hub link reads last-seen on the relay's time
// without the presence session's welcome. B9 two tabs of one account
// in one party fought over the seat's pose - the NEWEST tab speaks for
// the seat. C20 the picture names my own tabs (`peers`), so a second
// tab of mine is no stranger to friend.
// ═══ ACC1d: THE RELAY VERIFIES THE NAME IT IS TOLD ════════════════
//
// THIS IMPORT IS THE EXPENSIVE LINE IN THE ARC. It puts
// src/net/identityToken.js in RELAY_GRAPH, so SLAM8's hash changes,
// RELAY_VERSION bumps, and the deploy drops every connected player.
// ACC0 chose two Workers so that account work would NOT cost this; the
// token seam is the one piece that has to be paid for, and it is paid
// once here rather than a little at a time.
import { verifyToken, verifyOrder, importPublicKeyB64, MAX_TTL_S, renownIssuable } from '../../src/net/identityToken.js';   // MOD1: and the mute order, checked with the same key
/** ACC1d/F8: the most spent signatures one room remembers. Every entry
 *  expires within MAX_TTL_S and the hello gate bounds how fast they can
 *  arrive, so honest traffic never comes near this; it is here so a
 *  flood cannot grow the map without end. */
const SPENT_MAX = 4096;
/** MOD1: the most accounts whose latest mute order one room remembers. */
const ORDERS_MAX = 1024;
/** GUILD1c: the most removals and disbandings one room remembers (`_guildOuts`). */
const GUILD_OUTS_MAX = 1024;

import { roomOf, parseClient, inRange, poseGate, chatGate, redGate, dmGate, muteGate, tokenGate, rosterFor, badged, isChatRoom, isWorldRoom, isCellRoom, streamsFoes, hitOwnerOf, worldFrameMaxFor, CELL_FRAME_RECORDS_MAX, HELLO_HZ_MAX, CHAT_HELLO_HZ_MAX, CHAT_ROOM_HZ_MAX, SOCKETS_MAX, CHAT_SOCKETS_MAX, DROP_STRIKES_MAX, CHAT_STRIKES_MAX, WORLD_MIN_MS, WORLD_CHUNK, WORLD_TTL_MS, WORLD_PREFIX, FOES_PREFIX, foesGate, byteGate, FOES_ROOM_BYTES_PER_S, HIT_ROOM_HZ_MAX, ACT_ROOM_HZ_MAX, ACT_ROOM_BYTES_PER_S, actGate, MAX_FRAME_BYTES, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, HIT_ROOM_BYTES_PER_S, whoGate, whoIdOf, WHO_ROOM_HZ_MAX, poseFan, poseChanged, RELAY_VERSION, KEEPALIVE_FAN_MS, ACT_SENDER_BYTES_PER_S, CHAT_ROSTER_MAX, isSocialRoom, socialGate, partyGate, SOCIAL_ROOM_HZ_MAX, FRIENDS_MAX, PENDING_MAX, PARTY_MAX, PARTY_INVITES_MAX, INVITE_TTL_MS, PARTY_OFFLINE_MS, ACCOUNT_TABS_MAX, mintPartyId, SOCIAL_REPEAT_MS, ACCOUNT_IDLE_MS, ACCOUNT_SWEEP_MS, SWEEP_STEP_MS, SWEEP_PAGE, questShareGate, QUEST_ROOM_HZ_MAX, QUEST_ROOM_BYTES_PER_S, QUEST_PREFIX, QUEST_FRAME_MAX, tradeGate, TRADE_ROOM_HZ_MAX, TRADE_ROOM_BYTES_PER_S, castGate, CAST_HZ_MAX, CAST_DEST_SENDERS_MAX, parkGate, parkKey, parkKeyOf, PARK_KEY_RE, parkRegistryRoom, cellRoomOfWire, PARK_INTERNAL_REG, PARK_INTERNAL_DROP, PARK_CELL_MAX, PARK_ACCOUNT_MAX, PARK_TTL_MS, PARK_REFRESH_MS, PARTY_CHAT_ROOM_HZ_MAX, rollGate, rollDice, cardGate, pageGate, duelGate, DUEL_HZ_MAX, renownGate, renownRoomGate, guildGate, guildRoomGate, GUILD_CHAT_ROOM_HZ_MAX, lookGate, eventGate, EVENT_KEY, validLiveEvent } from './relay.js';

// AUDIT WORLD34 D4: the relay names itself in /health. SLAM13 (AUDIT SLAM A5): the name lives in net/wire.js, so the
// welcome can carry it; /health reads it through the import above. LOCALDEV1: it is NOT re-exported from this module -
// workerd (wrangler dev, 1.20260911) refuses a worker entry whose named export is a string ("Incorrect type for map
// entry 'RELAY_VERSION': the provided value is not of type 'function or ExportedHandler'"), so the local relay would
// not start at all. The production runtime let it through, which is why nothing caught it; the pins read wire.js.

/** DICE1: the relay's own dice - 32 uniform bits from the runtime's CSPRNG a draw (net/dice.js rollDice throws a draw
 *  back past the last whole multiple of the sides, so every face is exactly as likely). Workers carry `crypto`. */
const rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
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
/** AUDIT ATTACH: the quest share's interval gate in a meter's shape - its stamp is what `_spend` keeps as the bucket. */
const questMeter = (at, now) => { const g = questShareGate(at, now); return { bucket: g.at, pass: g.pass }; };
/** AUDIT SOC A5: the most account records an awake object keeps; over it the cache is emptied (storage is the truth). */
const RECS_MAX = 4096;
/** AUDIT SOC A1/A8: the most (kind, from, to) cooldown stamps an awake object keeps; over it they are emptied. */
const COOL_MAX = 4096;
/** AUDIT SOC A3: an account nobody's list names - no friend, no request either way, no live invite. AUDIT 68
 *  S01-stale-party-pointer-blocks-sweep: its party is judged by the sweep against the party's own record, not here. */
const unlisted = (r, now) => !!r && !(r.friends?.length) && !(r.in?.length) && !(r.out?.length) && !(r.invites ?? []).some((i) => now - i.at < INVITE_TTL_MS);

export class Room {
  constructor(state, env) {
    this.state = state;
    // ACC1d: the runtime hands a Durable Object (state, env) and this
    // class had been taking the first alone. The public key and the TTL
    // ceiling are config (bible ACC1d D2/D3), so the object needs it.
    this.env = env ?? {};
    /** The verifying key, imported once per instance. A CryptoKey
     *  cannot be stored, so this is memory and dies with the object -
     *  which is right: it is derived from a config string that cannot
     *  change without a deploy, and a deploy is a new object. */
    this._verifyKey = undefined;   // undefined = not tried, null = there is none
    /** ACC1d/F8: THE SIGNATURES THIS ROOM HAS ALREADY HONOURED, and
     *  when each stops mattering. A token is spent once (Mac). PER-ROOM
     *  and in memory, because the relay has no global state a hello
     *  could touch without becoming the bottleneck ACC0 refused for
     *  provider links - the record says exactly what that does and does
     *  not close. */
    this._spent = new Map();
    /** MOD1: THE NEWEST MUTE ORDER THIS ROOM HAS APPLIED, per account -
     *  `{i, mu, sig}`. Two jobs: an order older than one already applied
     *  is ignored (so a replayed mute cannot undo an unmute inside its
     *  minute), and a hello whose token was minted BEFORE the newest
     *  order here takes the order's word (so a token minted a moment
     *  before the mute cannot carry its holder past it). Memory, bounded
     *  by ORDERS_MAX, oldest out - the account row is the truth and
     *  every later token carries it, so this only has to cover the gap. */
    this._orders = new Map();
    /** GUILD1c: THE REMOVALS AND DISBANDINGS THIS ROOM HAS APPLIED - `gi` (a guild gone) or `gi:gm` (one member gone)
     *  -> the order's `i`, the newest kept. MOD1's `_orders` job for a guild: a hello whose token was minted before one
     *  takes it off, and a guild order older than one changes nothing - so neither a token minted a moment before a
     *  removal nor a replayed join inside its minute carries the member back into the guild's chat. Memory, bounded by
     *  GUILD_OUTS_MAX, oldest out - the roster is the truth and every later token carries it. */
    this._guildOuts = new Map();
    this._roomGuild = null;   // GUILD1c: the room's budget for guild-tag fans (GUILD_ROOM_HZ_MAX)
    this._guildChat = null;   // GUILD1c: the hub's budget for guild lines (GUILD_CHAT_ROOM_HZ_MAX), apart from the room's and the parties'
    this._idx = null;   // ws -> attachment, read once (A7); rebuilt when the socket set changes
    this._roomChat = null;   // AUDIT CHAT A2: the room's own chat budget - on the instance, since a sleeping room fans nothing
    this._partyChat = null;   // CHAT-CHAN: the hub's budget for party lines (PARTY_CHAT_ROOM_HZ_MAX), apart from the room's
    this._roomFoes = null;   // AUDIT WORLD2 A5: the room's foes byte budget (the frame times its listeners)
    this._roomFoesIn = null;   // AUDIT WORLD6b A3: a cell's foes INGRESS budget, spent at the door before the parse
    // AUDIT WORLD6b A1/A2: the hit funnel (AUDIT WORLD2 A6) is the DESTINATION socket's own bucket (`hbucket` among its meters), not the room's
    this._roomActs = null;   // WORLD3: the room's action-frame budget (a door, a lever, a platform moved)
    this._roomWho = null;    // AUDIT WORLD6b-iii(e) B1: the room's ask budget (WHO_ROOM_HZ_MAX) - the one arm past the hello that reads storage
    this._looks = new Map(); // AUDIT WORLD6b-iii(e) B1: the looks said hello with, kept on the instance while it is awake - a repeat ask reads no storage; after a hibernation the storage's copy is read once and kept again
    this._roomActBytes = null;   // AUDIT WORLD3 A1: and its BYTE budget - the frame times its listeners, as the foes fan has
    this._roomQuestBytes = null;   // AUDIT PARTY8: the quest fan's byte budget - a 64 KiB share times fifty-six tabs at eight seats
    this._roomWorld = null;      // SLAM11: the memory push's OWN byte budget, borrowing - it used to charge the foes stream's, and a big memory's debt would have stalled live foes
    this._roomSocial = null;     // SOC1: the hub's budget for social acts (SOCIAL_ROOM_HZ_MAX) - over it an act is refused with 'busy'
    this._roomRenown = null;     // AUDIT RENOWN1 SEC-2/WIRE-1: the room's budget for renown fans (RENOWN_ROOM_HZ_MAX) - on the instance, as the chat's is
    this._acctIdx = null;        // SOC1: account -> its hello'd sockets, built from the index when asked and dropped with it (a socket's account changes on its hello alone)
    this._parties = new Map();   // SOC1: party id -> record, kept while the object is awake (a party pose reads its party once a second; a wake reads storage once and keeps it again)
    this._recs = new Map();      // AUDIT SOC A5: account id -> record, kept while the object is awake - every write goes through _putAcct/_putAccts so the copy is the storage's; bounded at RECS_MAX
    this._alarmArmed = false;    // AUDIT SOC A3: the sweep's alarm is armed once per instance life (a storage read otherwise on every hello)
    this._cool = new Map();      // AUDIT SOC A1/A8: "kind from to" -> when a directed act last went through, on the instance (a flood keeps the object awake; a hibernation is a quiet hub); bounded at COOL_MAX
    this._dead = new Set();      // AUDIT WORLD34 D1: the sockets this object closed itself, whose leave the runtime will not deliver - reaped on the way out of every door
    this._gone = new WeakSet();  // AUDIT WORLD34 D1: and the ones whose leave has been said, so a runtime that does deliver a close says it once
    // AUDIT ATTACH (2026-09-23): EVERY PER-SOCKET METER LIVES HERE, not on the socket's attachment - each arm's bucket
    // and strike count, the junk count, and the funnels onto a destination (`hbucket`, `tinbucket`, `cin`). They rode
    // the attachment, which the runtime caps at 2 KiB and refuses a write past WHOLE, and the widest place socket's
    // (an id and an account at ID_RE's bound, a pose at its bounds, twenty arms' meters, a full funnel) was past it:
    // a meter whose write was refused never advanced, so the arm it gated let everything through. A meter is rate
    // state - the room's own budgets and _cool have always lived here, for the reason that holds for these: a flood
    // keeps the object awake, and it sleeps only after a quiet spell. Every bucket refills whole in two seconds of it
    // (the cast meter, a whole blast deep, is the slowest; the quest floor takes five), so a wake forgets nothing the
    // quiet had not already refilled - but the act share's
    // borrowed debt (SLAM13), which a wake forgives early: that share keeps one sender from holding the room's act
    // budget against the others, and a room that went quiet had no others acting. The attachment keeps what a wake
    // must recompute: the key, who the socket is, where it stands, the hello's stamp and the room's marks.
    this._meters = new WeakMap();   // ws -> its meters (_meterOf)
    this._event = undefined;        // EVENT1: the hub's live event, read once (_liveEvent) - undefined: not read yet
    try {
      // the runtime answers the client's ping while the object sleeps
      if (state.setWebSocketAutoResponse && typeof WebSocketRequestResponsePair === 'function') state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    } catch { /* an older runtime */ }
  }

  async fetch(request) {
    // HCC-PARK: the two doors between objects - the owner's registry and a cell's drop. The public worker forwards
    // /room/<key> alone (the default export above), so no socket and no browser ever reaches these paths.
    const path = new URL(request.url).pathname;
    if (path === PARK_INTERNAL_REG || path === PARK_INTERNAL_DROP) return this._parkInternal(path, request);
    const key = roomOf(new URL(request.url).pathname);
    if (this.state.getWebSockets().length >= (isChatRoom(key) ? CHAT_SOCKETS_MAX : SOCKETS_MAX)) return json({ error: 'room full' }, 503);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // hibernation API: the object may sleep between messages; every
    // socket carries its own state in the attachment - the room's key
    // included - and the look sits in storage under the id (its meters
    // are the instance's: AUDIT ATTACH)
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ key, id: null, name: null, pose: null });
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
    // AUDIT SOC A10: THE BOUND IS THE HUB'S, not the projection's alone - ACCOUNT_TABS_MAX sockets per account, and the
    // NEWEST of them (by the hello's `since`): a ninth tab is the one the player just opened, and the one that drops
    // off the end is the stalest. Sorted only for an account over the bound, which nobody real is.
    const idx = this._all();
    for (const [acct, s] of m) if (s.length > ACCOUNT_TABS_MAX) { s.sort((x, y) => (idx.get(y)?.since ?? 0) - (idx.get(x)?.since ?? 0)); m.set(acct, s.slice(0, ACCOUNT_TABS_MAX)); }
    return (this._acctIdx = m);
  }
  /** SOC1: an account's hello'd sockets (ACCOUNT_TABS_MAX at most - AUDIT SOC A10), `except` one (a socket on its way out). */
  _socketsOf(acct, except = null) { const s = this._byAcct().get(acct); if (!s) return []; return except ? s.filter((ws) => ws !== except) : s; }
  /** AUDIT SOC B9: the socket that SPEAKS for an account's seat - its newest hello'd tab. Two tabs of one account in one
   *  party each sent a pose a second and the other members' card and mark flipped between two places; the newest tab
   *  is the one the player is playing, and the older one's poses are kept on its attachment and fanned to nobody. */
  _speaker(acct, except = null) {
    let best = null, since = -Infinity;
    for (const ws of this._socketsOf(acct, except)) { const b = this._attach(ws); if ((b.since ?? 0) >= since) { best = ws; since = b.since ?? 0; } }
    return best;
  }
  /** AUDIT SOC A1/A8: a DIRECTED act of one kind (a friend request, a party invite) at the same target inside
   *  SOCIAL_REPEAT_MS of the last that went through, from one account - true, and the caller answers 'already asked'
   *  with nothing written and nothing fanned. Asked last, after every other refusal, so a refused act stamps nothing. */
  _repeated(me, kind, them, now) {
    const key = `${kind} ${me} ${them}`;
    const at = this._cool.get(key);
    if (at != null && now - at < SOCIAL_REPEAT_MS) return true;
    if (this._cool.size >= COOL_MAX) this._cool.clear();
    this._cool.set(key, now);
    return false;
  }
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
  /** EVENT1: the live event staged now, or null - read from the hub's storage once per instance life and kept (a stage
   *  writes both); anything stored that is not a live event this relay knows is none. */
  async _liveEvent() {
    if (this._event === undefined) { const e = await this.state.storage.get(EVENT_KEY); this._event = validLiveEvent(e) ? e : null; }
    return this._event;
  }
  /** The room forgets its looks and secrets (and its hello bucket) - never its world (WORLD1). */
  /** SOC1: and its parties - the hub drained, so nobody is online to hold one (a member back inside PARTY_OFFLINE_MS
   *  finds its record pointing at a party that is gone, and the hello clears it); never an account or its secret. */
  async _sweep() {
    this._looks.clear();
    const dead = ['hellos'];
    for (const prefix of ['look:', 'secret:']) { const m = await this.state.storage.list({ prefix }); for (const k of m.keys()) dead.push(k); }
    this._parties.clear(); for (const k of await this._keysOf('party:')) dead.push(k);   // SOC1: the parties go with the drain; acct: and asecret: stay (AUDIT SOC A4: listed in pages - an unbounded list of a namespace a client can grow is the isolate's memory)
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
  }

  /** AUDIT SOC A4: every KEY under a prefix, SWEEP_PAGE at a time - the keys alone; a namespace a client can grow (the
   *  parties) never has its records listed whole into memory. */
  async _keysOf(prefix) {
    const out = [];
    let after = null;
    for (;;) {
      const page = await this.state.storage.list({ prefix, limit: SWEEP_PAGE, ...(after ? { startAfter: after } : {}) });
      for (const k of page.keys()) { out.push(k); after = k; }
      if (page.size < SWEEP_PAGE) return out;
    }
  }
  /** AUDIT ATTACH: one socket's meters - its arms' buckets and strike counts, its junk, the funnels onto it - made on
   *  first use and gone with the socket (a WeakMap) or with a wake (the constructor's note says why that is safe). */
  _meterOf(ws) { let m = this._meters.get(ws); if (!m) this._meters.set(ws, m = {}); return m; }
  /** AUDIT ATTACH: ONE ARM'S METER, SPENT - its bucket (`bucketKey`) through `gate`; over the rate the frame is dropped
   *  and a strike counted (`strikesKey`), a pass forgives them, and past `max` the socket is closed with `why`. True
   *  when the frame is taken. Every meter below is this one with its own gate, fields and words. */
  _spend(ws, now, gate, bucketKey, strikesKey, why, max = DROP_STRIKES_MAX) {
    const m = this._meterOf(ws);
    const g = gate(m[bucketKey], now);
    m[bucketKey] = g.bucket;
    m[strikesKey] = g.pass ? 0 : (m[strikesKey] ?? 0) + 1;
    if (!g.pass && m[strikesKey] > max) this._refuse(ws, why);
    return g.pass;
  }
  /** The frame gate (A8): the socket's pose bucket - a pose, a ping and (AUDIT WORLD A1) a world frame spend it; over
   *  the rate the frame is dropped and a strike counted, past DROP_STRIKES_MAX the socket is closed. Returns the
   *  attachment as written back, or null when the frame is not to be taken. */
  /** SLAM8 (AUDIT SLAM): `patch` is applied whatever the gate says (the latest pose is kept even when it is not
   *  relayed); `passPatch` ONLY when the frame is really let through. Anything that counts what the room DID - the
   *  pose fan's `turn` - belongs in the second, or it counts what the room was merely told. AUDIT ATTACH: the bucket
   *  and its strikes are the socket's meters; the attachment is written only when one of its own fields moved. */
  _meter(ws, a, now, patch = {}, passPatch = {}) {
    const pass = this._spend(ws, now, poseGate, 'bucket', 'drops', 'too many poses');
    const write = pass ? { ...patch, ...passPatch } : patch;
    const next = Object.keys(write).length ? { ...a, ...write } : a;
    if (next !== a) this._setAttach(ws, next);
    return pass ? next : null;
  }
  /** WORLD6b-iii(e): the asks' own bucket (WHO_HZ_MAX), the same strikes - a question beside the poses, never starving
   *  them. Each meter below answers as `_meter` does: the attachment, or null when the frame is not to be taken. */
  _meterWho(ws, a, now) { return this._spend(ws, now, whoGate, 'wbucket', 'wdrops', 'too many asks') ? a : null; }
  /** SOC1: the social acts' own bucket (SOCIAL_HZ_MAX), the same strikes. */
  _meterSocial(ws, a, now) { return this._spend(ws, now, socialGate, 'sbucket', 'sdrops', 'too many social acts') ? a : null; }
  /** SOC1: the party poses' own bucket (PARTY_HZ_MAX), the same strikes. */
  _meterParty(ws, a, now) { return this._spend(ws, now, partyGate, 'pbucket', 'pdrops', 'too many party poses') ? a : null; }
  /** QUEST1: a quest share's own cooldown (questShareGate - a plain interval, not a token bucket; see its own note
   *  in wire.js for why), the same strikes - a rare, deliberate act, so this drops far sooner in practice than the
   *  poses ever would, and a flood off it is a bug or an abusive client either way. */
  _meterQuest(ws, a, now) { return this._spend(ws, now, questMeter, 'qgateAt', 'qdrops', 'too many quest shares') ? a : null; }
  /** TRADE1: the trade frames' own bucket (TRADE_HZ_MAX), the same strikes - an offer beside the poses, never starving them. */
  _meterTrade(ws, a, now) { return this._spend(ws, now, tradeGate, 'tradeBucket', 'tdrops', 'too many trade frames') ? a : null; }
  /** ALLY-CAST: the cast frames' own bucket (CAST_HZ_MAX), the trade meter's shape. CHAT-CHAN: the strikes are the
   *  cast's OWN (`castDrops`) - they were `cdrops`, the chat gate's own field, so once a place room carried Local chat
   *  a pass on either reset the other's strikes, and twenty dropped casts followed by one over-rate line closed the
   *  socket as 'too many lines'. */
  _meterCast(ws, a, now) { return this._spend(ws, now, castGate, 'castBucket', 'castDrops', 'too many cast frames') ? a : null; }
  /** INSPECT1: the card frames' own bucket (CARD_HZ_MAX: asks and answers together), the same strikes as a cast's. */
  _meterCard(ws, a, now) { return this._spend(ws, now, cardGate, 'cardBucket', 'cardDrops', 'too many card frames') ? a : null; }
  /** JOURNAL1: the page frames' own bucket (PAGE_HZ_MAX), the same strikes as a card's. */
  _meterPage(ws, a, now) { return this._spend(ws, now, pageGate, 'pageBucket', 'pageDrops', 'too many page frames') ? a : null; }
  /** DUEL1: the duel frames' own bucket (DUEL_HZ_MAX), the same strikes as a card's - a duel's blows beside the poses, never starving them. */
  _meterDuel(ws, a, now) { return this._spend(ws, now, duelGate, 'duelBucket', 'duelDrops', 'too many duel frames') ? a : null; }
  /** AUDIT ALLY-CAST B2 + INSPECT1 + JOURNAL1: THE FUNNEL ONTO ONE DESTINATION, PER SENDER - a bounded list of sender
   *  buckets among the destination's meters (`cin`), the stalest sender's slot evicted for a newcomer. One bucket for
   *  every sender together let five strangers at their own rate starve a mate's heals, and this relay cannot tell a mate
   *  from a stranger - so each sender waits only on its own spamming. The cast arm's, the card arm's and the page arm's,
   *  ONE for all three: what a destination is made to take from one sender - a spell to apply, a card to answer, a page
   *  to be shown - is bounded once, whatever the directed frame. Answers whether this sender's frame passes. */
  _senderFunnel(tws, senderId, now, field = 'cin', hz = CAST_HZ_MAX) {   // DUEL1: a duel's funnel is this one's shape on its own slots (`field`) at its own rate - a duel's blows are not a spell's, a card's or a page's
    const meters = this._meterOf(tws);
    const slots = meters[field] ??= [];
    let slot = slots.find((c) => c.id === senderId) ?? null;
    if (!slot) {
      if (slots.length >= CAST_DEST_SENDERS_MAX) { slots.sort((x, y) => (x.b?.at ?? 0) - (y.b?.at ?? 0)); slots.shift(); }
      slot = { id: senderId, b: null }; slots.push(slot);
    }
    const funnel = tokenGate(slot.b, now, hz);
    slot.b = funnel.bucket;
    return funnel.pass;
  }
  /** HCC-PARK: the park frames' own bucket (PARK_HZ_MAX), the same strikes. MERGE (AUDIT ATTACH x HCC-PARK): among the
   *  meters, and its strikes its OWN (`parkDrops`) - they were `pdrops`, the party meter's field, so a park frame's pass
   *  forgave a flood of party poses its strikes (CHAT-CHAN's `cdrops`/`castDrops` finding, again). */
  _meterPark(ws, a, now) { return this._spend(ws, now, parkGate, 'parkBucket', 'parkDrops', 'too many park frames') ? a : null; }
  /** PROFILE2: the looks' own bucket (LOOK_HZ_MAX), the same strikes. */
  _meterLook(ws, a, now) { return this._spend(ws, now, lookGate, 'lookBucket', 'lookDrops', 'too many looks') ? a : null; }
  /** HCC-PARK: this cell's parked teams (whole records - the relay's own view, `sub` included), the expired swept on
   *  the way (PARK_TTL_MS since their owner last said so) and SAID gone to whoever is here (AUDIT HCC-PARK D5: a
   *  reader kept drawing an expired team until it reconnected). */
  async _parkList(now) {
    const m = await this.state.storage.list({ prefix: 'park:' });
    const out = [], dead = [];
    for (const [k, v] of m) { if (!v || typeof v.k !== 'string' || now - (v.at ?? 0) > PARK_TTL_MS) dead.push([k, v]); else out.push(v); }
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128).map(([k]) => k));
    for (const [, v] of dead) if (v && typeof v.k === 'string') this._parkFan({ t: 'park', k: v.k, id: v.id, data: null }, v.sub);
    return out;
  }
  /** What a reader is told of a record: never the account (a place room names none - MOD1). */
  _parkPublic(v) { return { k: v.k, id: v.id, name: v.name ?? '', r: v.r, at: v.at }; }
  /** Fan a park word to every hello'd socket but the OWNER's account's own (its client draws its team off its save;
   *  its other tabs and characters are the same player - AUDIT HCC-PARK D2). */
  _parkFan(o, ownerSub) { const s = JSON.stringify(o); for (const [other, b] of [...this._all()]) if (b.id && b.sub !== ownerSub) this._send(other, s); }
  /** HCC-PARK: the owner's record stands in THIS cell. PARK_ACCOUNT_MAX of one account's (its own stalest goes
   *  first), PARK_CELL_MAX in all (the stalest goes). The same word again is no news: only its time is refreshed,
   *  and nobody is told (a socket repeating itself buys no fan). */
  async _parkStore(k, sub, id, name, r, now) {
    const list = await this._parkList(now);
    const had = list.find((e) => e.k === k) ?? null;
    if (had && had.id === id && had.name === name && JSON.stringify(had.r) === JSON.stringify(r)) {
      if (now - (had.at ?? 0) > PARK_REFRESH_MS) await this.state.storage.put(parkKey(k), { ...had, at: now });
      return;
    }
    const byAge = (x, y) => (x.at ?? 0) - (y.at ?? 0);
    const mine = list.filter((e) => e.k !== k && e.sub === sub).sort(byAge);
    const gone = new Set();
    for (const e of mine.slice(0, Math.max(0, mine.length - PARK_ACCOUNT_MAX + 1))) { gone.add(e.k); await this._parkDrop(e.k); }
    const others = list.filter((e) => e.k !== k && !gone.has(e.k)).sort(byAge);
    for (const e of others.slice(0, Math.max(0, others.length - PARK_CELL_MAX + 1))) await this._parkDrop(e.k);
    const rec = { k, sub, id, name, r, at: now };
    await this.state.storage.put(parkKey(k), rec);
    this._parkFan({ t: 'park', k, id, name, at: now, data: r }, sub);
  }
  /** HCC-PARK: the owner's record in THIS cell goes (a no-op when there is none), and everyone here is told. `before`:
   *  the registry's word is about a record said no later than it (AUDIT HCC-PARK D4 - a drop that crossed a newer
   *  store in flight leaves the newer one standing). */
  async _parkDrop(k, before = Infinity) {
    const had = await this.state.storage.get(parkKey(k));
    if (!had || (had.at ?? 0) > before) return;
    await this.state.storage.delete(parkKey(k));
    this._parkFan({ t: 'park', k, id: had.id, data: null }, had.sub);
  }
  /** HCC-PARK: the owner's registry learns the cell their team stands in (null: nowhere), stamped with when the word
   *  was said. A relay built without the binding (a harness, a local dev worker) keeps the cell's own law and skips
   *  the cross-cell drop. */
  async _parkRegister(k, cell, at) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return;
    try {
      await rooms.get(rooms.idFromName(parkRegistryRoom(k))).fetch(new Request(`https://relay.internal${PARK_INTERNAL_REG}`, { method: 'POST', body: JSON.stringify({ owner: k, cell, at }) }));
    } catch (e) { console.warn('[park] registry', e?.message ?? e); }
  }
  /** Tell a cell to drop an owner's record said no later than `at`. */
  async _parkTellDrop(cell, k, at) {
    const rooms = this.env?.ROOMS;
    try { await rooms?.get(rooms.idFromName(cell)).fetch(new Request(`https://relay.internal${PARK_INTERNAL_DROP}`, { method: 'POST', body: JSON.stringify({ owner: k, at }) })); }
    catch (e) { console.warn('[park] drop', e?.message ?? e); }
  }
  /** HCC-PARK: the doors between objects. REG: this object is an owner's registry - a new cell (or none) drops the
   *  record the old cell holds. DROP: this object is a cell - the owner's record here goes.
   *  AUDIT HCC-PARK D4: the registry's word is ORDERED by when the owner said it, and written BEFORE the old cell is
   *  told (an await on another object lets a second registration in): a word older than the one held changes
   *  nothing - and when it names another cell, that cell's record is superseded, so it goes. */
  async _parkInternal(path, request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const k = typeof body?.owner === 'string' && PARK_KEY_RE.test(body.owner) ? body.owner : null;
    const at = Number.isFinite(body?.at) ? body.at : null;
    if (!k || at === null) return json({ ok: false }, 400);
    if (path === PARK_INTERNAL_DROP) { await this._parkDrop(k, at); return json({ ok: true }); }
    const cell = body.cell == null ? null : (isCellRoom(body.cell) ? body.cell : undefined);
    if (cell === undefined) return json({ ok: false }, 400);
    const prev = (await this.state.storage.get('reg')) ?? null;
    if (prev && (prev.at ?? 0) > at) {
      if (cell && cell !== prev.cell) await this._parkTellDrop(cell, k, at);
      return json({ ok: true });
    }
    await this.state.storage.put('reg', { cell, at });
    await this.state.storage.setAlarm(at + PARK_TTL_MS);   // AUDIT 68 X8-park-registry-unbounded: the word is forgotten when every record it could name has expired
    if (prev?.cell && prev.cell !== cell) await this._parkTellDrop(prev.cell, k, at);
    return json({ ok: true });
  }
  /** WORLD3: the action frames' own bucket (ACT_HZ_MAX), the same strikes - a door beside the poses, never starving them. */
  _meterActs(ws, a, now) { return this._spend(ws, now, actGate, 'abucket', 'adrops', 'too many acts') ? a : null; }
  /** WORLD2: the foes stream's own bucket (FOES_HZ_MAX), the same strikes - a stream beside the poses, never starving them. */
  _meterFoes(ws, a, now) { return this._spend(ws, now, foesGate, 'fbucket', 'fdrops', 'too many foes') ? a : null; }
  /** AUDIT WORLD2 A4's instrument, one home (AUDIT WORLD6b A1/B3): a frame that should not have been sent is counted
   *  against its socket, and a stream of them is struck out. AUDIT ATTACH: a count among its meters, so no caller can
   *  write it back over a stale attachment (CHAT-CHAN's party line did, and refunded the chat token its gate spent). */
  _junk(ws) {
    const m = this._meterOf(ws);
    m.junk = (m.junk ?? 0) + 1;
    if (m.junk > DROP_STRIKES_MAX) this._refuse(ws, 'too many frames');
  }
  /** GUILD1c: hold a removal (`gm`) or a disbanding (no `gm`) this room applied, the newest per key (`_guildOuts`). */
  _holdGuildOut(gi, gm, i) {
    const k = gm === undefined ? gi : `${gi}:${gm}`;
    const held = this._guildOuts.get(k);
    if (held !== undefined && held >= i) return;
    this._guildOuts.delete(k);
    if (this._guildOuts.size >= GUILD_OUTS_MAX) this._guildOuts.delete(this._guildOuts.keys().next().value);
    this._guildOuts.set(k, i);
  }
  /** GUILD1c: whether this room heard member `gm` of guild `gi` removed, or the guild gone, AFTER `i` - a token or an
   *  order said at `i` is older than that word and does not put the member back. */
  _guildOutAfter(gi, gm, i) {
    const all = this._guildOuts.get(gi);
    const one = gm === undefined ? undefined : this._guildOuts.get(`${gi}:${gm}`);
    return (all !== undefined && all > i) || (one !== undefined && one > i);
  }
  /** GUILD1c: an attachment with its guild taken off (its id, tag and member row). */
  _unguild(a) { const b = { ...a }; delete b.gi; delete b.gt; delete b.gm; return b; }
  /** GUILD1c: a player's guild tag as a frame - `gt` absent for none. */
  _guildFrame(id, gt) { return JSON.stringify(gt ? { t: 'guild', id, gt } : { t: 'guild', id }); }
  /** CHAT-CHAN + DICE1: A LINE OUT, on the channel it was said on - the chat's and the roll's one fan. `frame` is the
   *  relay's own record of the line; the sender hears it back (the receipt).
   *
   *  A PARTY'S LINE (kurkku: "party chat") is said on the hub link and heard by the party's members alone - every tab
   *  of each. The hub is the one room that knows the seats; anywhere else a party line has no party to reach, and it
   *  is junk rather than a line for the room.
   *  A seat gone since the client last looked says nothing to anyone. Its budget is the parties' own
   *  (PARTY_CHAT_ROOM_HZ_MAX), never the room's: AUDIT CHAT A2 priced that one for a fan of everyone online, and a
   *  party's is its seats. EVERY OTHER LINE is the room's: its budget, over which a line is dropped and nobody is
   *  struck, and its fan - everyone in a channel, those in range in a place. */
  async _sayLine(ws, a, ch, frame, now) {
    if (ch === 'guild') {
      // GUILD1c: A GUILD'S LINE, said on the hub link and heard by every socket there wearing the sender's guild - the
      // verified token's, or a signed guild order's since, never the sender's word. The hub is the one room every
      // online player holds a socket to, so its fan IS the guild online; anywhere else a guild line has no guild to
      // reach and is junk. A sender in no guild is said to nobody. Its budget is the guilds' own.
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      if (!a.gi) return;
      const budget = tokenGate(this._guildChat, now, GUILD_CHAT_ROOM_HZ_MAX);
      this._guildChat = budget.bucket;
      if (!budget.pass) return;
      const line = JSON.stringify({ ...frame, ch: 'guild' });
      for (const [other, b] of [...this._all()]) if (b.id && b.gi === a.gi) this._send(other, line);   // the sender's own tabs too: the echo is the receipt
      return;
    }
    if (ch === 'party') {
      if (!isSocialRoom(a.key) || !a.acct) { this._junk(ws); return; }
      if (!a.party) return;
      const budget = tokenGate(this._partyChat, now, PARTY_CHAT_ROOM_HZ_MAX);
      this._partyChat = budget.bucket;
      if (!budget.pass) return;
      let party = null;
      try { party = await this._livingParty(a.party, now); } catch (e) { console.warn('[hub] party line failed', e?.message ?? e); return; }   // AUDIT SOC A2: contained
      if (!party || !party.members.includes(a.acct)) { this._markParty(a.acct, null); return; }
      const line = JSON.stringify({ ...frame, ch: 'party' });
      for (const member of party.members) for (const other of this._socketsOf(member)) this._send(other, line);
      return;
    }
    const room = tokenGate(this._roomChat, now, CHAT_ROOM_HZ_MAX);
    this._roomChat = room.bucket;
    if (!room.pass) return;
    const out = JSON.stringify(frame);
    const chat = isChatRoom(a.key);
    for (const [other, b] of [...this._all()]) {
      if (!b.id) continue;
      if (other === ws || chat || inRange(a.key ?? '', a.pose, b.pose)) this._send(other, out);   // the sender hears its own line back: that is the receipt
    }
  }

  /** AUDIT WORLD A3: a world room's memory is forgotten WORLD_TTL_MS after the room last drained - armed on the
   *  drain, re-armed by every later one - unless someone is in the room when it fires: a world parked in a room
   *  nobody plays would cost storage for ever, and the rooms a client can name are many. */
  async alarm() {
    if (await this.state.storage.get('hub')) { await this._sweepHub(Date.now()); return; }   // AUDIT SOC A3: the hub's alarm is its sweep, whoever is in the room
    // AUDIT 68 X8-park-registry-unbounded: an owner's registry (HCC-PARK) is one object per account and character a
    // client names - its word goes PARK_TTL_MS after it was said, as the cell's record it points at does
    const reg = await this.state.storage.get('reg');
    if (reg) { const due = reg.at + PARK_TTL_MS; if (Date.now() >= due) await this.state.storage.delete('reg'); else await this.state.storage.setAlarm(due); return; }
    for (const [, b] of this._all()) if (b.id) return;
    const m = await this.state.storage.list({ prefix: 'world:' });
    const dead = [...m.keys()];
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
  }
  /** AUDIT SOC A3/A4: ONE PAGE of the hub's storage per firing - the accounts nobody's list names and nobody has seen
   *  for ACCOUNT_IDLE_MS are forgotten with their secrets (an account a list names is never touched: "a friend list
   *  that forgets people is worse than a kilobyte"), and the parties whose every seat has lapsed (no socket, and away
   *  past PARTY_OFFLINE_MS or never stamped) are deleted - a member's record still pointing at one is cleared on their
   *  next hello, as a drain's is. The cursors ride storage; a full page is followed SWEEP_STEP_MS later, an empty one
   *  ACCOUNT_SWEEP_MS later from the start. */
  async _sweepHub(now) {
    const cur = (await this.state.storage.get(['sweep:acct', 'sweep:party']));
    const acur = cur.get('sweep:acct') ?? null, pcur = cur.get('sweep:party') ?? null;
    const accts = await this.state.storage.list({ prefix: 'acct:', limit: SWEEP_PAGE, ...(acur ? { startAfter: acur } : {}) });
    const dead = [], idle = []; let alast = null;
    for (const [k, r] of accts) { alast = k; const id = k.slice(5); if (unlisted(r, now) && now - (r.seen ?? 0) >= ACCOUNT_IDLE_MS && !this._socketsOf(id).length) idle.push([k, id, r.party]); }
    // AUDIT 68 S01-stale-party-pointer-blocks-sweep: a pointer lists the account only while its party does - a deleted
    // party leaves its members' pointers standing until their next hello, which an idle account never sends
    const seats = await this._partiesOf(idle.filter(([, , pid]) => pid).map(([, , pid]) => pid));
    for (const [k, id, pid] of idle) { const party = pid ? seats.get(pid) : null; if (party && party.members.includes(id)) continue; dead.push(k, acctSecretKey(id)); this._recs.delete(id); }
    const parties = await this.state.storage.list({ prefix: 'party:', limit: SWEEP_PAGE, ...(pcur ? { startAfter: pcur } : {}) });
    let plast = null;
    for (const [k, p] of parties) {
      plast = k;
      const lapsed = !p || !Array.isArray(p.members) || p.members.every((id) => !this._socketsOf(id).length && (p.away?.[id] == null || now - p.away[id] >= PARTY_OFFLINE_MS));
      if (lapsed) { dead.push(k); this._parties.set(k.slice(6), null); }
    }
    for (let i = 0; i < dead.length; i += SWEEP_PAGE) await this.state.storage.delete(dead.slice(i, i + SWEEP_PAGE));
    const more = accts.size >= SWEEP_PAGE || parties.size >= SWEEP_PAGE;
    await this.state.storage.put({ 'sweep:acct': accts.size >= SWEEP_PAGE ? alast : null, 'sweep:party': parties.size >= SWEEP_PAGE ? plast : null });
    await this.state.storage.setAlarm(now + (more ? SWEEP_STEP_MS : ACCOUNT_SWEEP_MS));
  }

  async webSocketMessage(ws, message) {
    try { await this._message(ws, message); } finally { await this._reap(); }
  }

  /**
   * ═══ ACC1d/ACC1g: THE NAME, VERIFIED - OR NO ROOM ═══════════════
   *
   * Answers `{ name, verified: true }` for a hello, or `{ error }` to
   * refuse it. Every arm is a refusal or a plain fact, never a repair -
   * identityToken.js's own law, on this side too.
   *
   *   no token        -> REFUSED. ACC1g (Mac: "You shouldnt be able to
   *                      just type a name and enter anymore"). ACC1d
   *                      admitted this and said out loud that it was
   *                      the wall not yet standing; this is it standing.
   *   no usable key   -> REFUSED. A relay that cannot check cannot tell
   *                      an issued name from a typed one.
   *   token, verified -> the name out of the TOKEN. The frame's own
   *                      `name` is ignored entirely; a signed claim set
   *                      beats a typed one, and now there is no typed
   *                      one to beat.
   *   token, refused  -> REFUSED, loudly.
   *
   * THE LAST ARM IS A REFUSAL AND NOT A DOWNGRADE, which was a real
   * choice before the gate and is forced by it now. Admitting a failed
   * token as "unverified" would mean an expired one silently drops a
   * player to a typed name with nothing on screen saying why, and a
   * REPLAYED one quietly succeeds at exactly the level the attacker
   * wanted. A refusal is recoverable: the client mints a fresh token
   * per connection, so a retry fixes an expiry, and a replay hears no.
   *
   * AND `verified` IS GONE WITH THE OPTIONAL TOKEN. Every socket that
   * gets past this is verified, so a per-name `v` on the wire said the
   * same thing about everybody - the definition of a field carrying no
   * information. It leaves in this same deploy rather than a later one,
   * because a wire change costs a drop and this deploy is already
   * paying for one. ACC1d-MARK, whose only reader it was, is retired
   * with it: a badge on every head is no badge.
   */
  async _named(m, now) {
    // ═══ ACC1g — THE WALL IS AT THE DOOR NOW ═══════════════════════
    //
    // Mac: "You shouldnt be able to just type a name and enter
    // anymore.... this is what the account system is for."
    //
    // This is the flip ACC1d named and did not make. Until here the
    // hello carried a name THE CLIENT WROTE and the relay only
    // sanitised it, and a token merely made a name TRUSTWORTHY rather
    // than MANDATORY - so anyone could type anybody's name and walk in,
    // which is the hole ACC1a opened this arc to close.
    //
    // NO TOKEN, NO ROOM. The name is now the account service's to issue
    // and this room's to verify, and there is no other way to be named.
    // A GUEST IS NOT SHUT OUT: a guest session mints a token like
    // anybody else, so the cost to a new player is one press of
    // Continue as guest, not an email - ACC0's bargain (the only people
    // who can take a name are the people who can be banned) with the
    // door finally standing where it was always drawn.
    if (!m.tok) return { error: 'sign in to play online' };

    await this._loadKey();
    // NO KEY, NO ROOM - AND THIS ARM CHANGED DIRECTION WITH ACC1g.
    // While a token was optional, refusing everybody over a mistyped
    // config was the worse failure and this line admitted them unnamed.
    // With the wall at the door that reading is the hole itself: a
    // relay that cannot verify cannot tell an issued name from a typed
    // one, so admitting everyone reopens exactly what the gate closes.
    // IT FAILS CLOSED, and the protection against that being how the
    // game goes dark is at the DEPLOY rather than here: both workflows
    // check this key against what the account service publishes, and a
    // real disagreement stops the deploy before a player sees it.
    if (!this._verifyKey) return { error: 'sign-ins cannot be checked right now' };

    const nowS = Math.floor(now / 1000);
    // THE CEILING IS CONFIG, BESIDE THE KEY (F8, and bible ACC1d D3).
    // A call site that passes its own is how a generous value comes to
    // grant long-lived tokens where nobody is looking. `MAX_TTL_S` is
    // the module's own hard ceiling and config may only tighten it.
    const configured = Number(this.env.IDENTITY_MAX_TTL_S);
    const maxTtlS = Number.isSafeInteger(configured) && configured > 0
      ? Math.min(configured, MAX_TTL_S) : MAX_TTL_S;

    const r = await verifyToken(m.tok, this._verifyKey, { subtle: crypto.subtle, nowS, maxTtlS });
    if (!r.ok) return { error: `token ${r.why}` };

    // ═══ SPENT ONCE ══════════════════════════════════════════════
    // The signature is the token's own unique part; `e` says how long
    // this room must remember it, so the set sweeps itself rather than
    // needing a cron that can silently stop running (F9's lesson, one
    // system over).
    const sig = m.tok.slice(m.tok.lastIndexOf('.') + 1);
    for (const [k, until] of this._spent) if (until <= nowS) this._spent.delete(k);
    if (this._spent.has(sig)) return { error: 'token spent' };
    // A BOUND, because a map that only grows is a room that eventually
    // stops. At MAX_TTL_S and the hello gate's own rate this cannot be
    // reached by honest traffic; past it the OLDEST goes, so a flood
    // cannot evict the token somebody is about to present.
    if (this._spent.size >= SPENT_MAX) this._spent.delete(this._spent.keys().next().value);
    this._spent.set(sig, r.claims.e);

    // ═══ ACC3: THE BADGE COMES OUT OF THE SIGNATURE ══════════════
    //
    // A title and a glyph are read off the VERIFIED claims, beside the
    // name, and the room never asks a client for either. That is the
    // same law ACC1g just put on the name one slice ago and it matters
    // more here: a name is a thing to be, and a title is a thing to be
    // BELIEVED - "Developer" over somebody's head is a claim every
    // other player in the room reads as this project's own word.
    //
    // `claimsValid` has already checked both against the two closed
    // lists (identityToken.js TITLES and GLYPHS) before `verifyToken`
    // said ok, so what comes out here is one of a handful of known
    // strings or nothing. The room does not re-check and does not need
    // to: an unknown badge cannot have been signed for.
    // MOD1: THE MUTE, off the same signature - and a mute ORDER this
    // room applied after the token was minted wins over the token, so a
    // token minted a moment before a mute cannot carry its holder past
    // it (and one minted before an unmute cannot hold them in it).
    const order = this._orders.get(r.claims.s);
    const mu = order && order.i > r.claims.i ? order.mu : (r.claims.mu ?? 0);
    // RENOWN1: and Renown, off the same signature - `lv`
    // beside the title and glyphs, stamped by `badged` wherever they are.
    // GUILD1c: and the guild - its id, tag and member row, all three or none - unless this room has since heard that
    // member removed or that guild gone, which wins over a token minted before it. `gio` is when the guild worn was
    // said, so a guild order older than the token changes nothing.
    const c = r.claims;
    const guild = c.gi && !this._guildOutAfter(c.gi, c.gm, c.i) ? { gi: c.gi, gt: c.gt, gm: c.gm } : {};
    return { name: c.n, kind: c.k, subject: c.s, title: c.t, glyphs: c.g, mu, lv: c.lv, ...guild, gio: c.i };
  }

  /** The verifying key, imported once. Shared by the hello and by
   *  MOD1's mute order, so there is one key and one way to load it. */
  async _loadKey() {
    if (this._verifyKey === undefined) {
      const raw = this.env.IDENTITY_PUBLIC_KEY;
      this._verifyKey = null;
      if (typeof raw === 'string' && raw) {
        // A BAD KEY IS NOT A CRASH. A mistyped config must not take the
        // room down on its first hello; it leaves the relay unable to
        // vouch for anybody, which the deploy's own check is there to
        // catch before a player ever sees it.
        try { this._verifyKey = await importPublicKeyB64(raw, { subtle: crypto.subtle }); }
        catch (e) { console.warn('[room] IDENTITY_PUBLIC_KEY will not import', e?.message ?? e); }
      }
    }
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
    // QUEST1: the quest-share frame is the THIRD large one, entirely separate from the world-room fast path below -
    // that path's own law is world-room-shaped throughout (host-only frames, a cell's stream ingress budget), and
    // none of it applies to a hub-scoped, per-party frame. Checked and metered here, on its own, before falling
    // through to the ordinary parse+dispatch below (which already answers `m.t === 'quest'`) - an `else if` against
    // the world/foes branch, not a second `if`, so an oversized quest frame is never also treated as a giant world
    // frame just because it is bigger than MAX_FRAME_BYTES.
    if (typeof message === 'string' && message.startsWith(QUEST_PREFIX)) {
      if (!a.acct) { this._refuse(ws, 'quest before hello'); return; }
      if (!isSocialRoom(a.key)) { this._refuse(ws, 'frame too large'); return; }
      if (message.length > QUEST_FRAME_MAX) { this._refuse(ws, 'frame too large'); return; }
      a = this._meterQuest(ws, a, Date.now());
      if (!a) return;
      doored = 'quest';
    } else if (typeof message === 'string' && (message.length > MAX_FRAME_BYTES || message.startsWith(WORLD_PREFIX) || message.startsWith(FOES_PREFIX))) {
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
        this._junk(ws);
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
      // ACC1d: the name this socket will wear, and whether the relay vouches for it. AUDIT 68 S01-hello-writes-before-token:
      // asked BEFORE anything is written or replaced (the id's secret, its look, a live holder of the id, the
      // attachment), so a refused hello leaves nothing behind - a tokenless one planted a secret that refused the owner
      const who = await this._named(m, now);
      if (who.error) { this._refuse(ws, who.error); return; }
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
        // AUDIT SOC A7: a replaced socket loses its id BEFORE it closes, so its `_leave` says nothing - which is right for
        // the room (the id lives on) and wrong for its ACCOUNT when the replacing hello names another or none: no
        // last-seen, no presence, no `away` stamp, a seat that could never lapse. Its account leaves here.
        if (isSocialRoom(a.key) && b.acct && b.acct !== m.acct) { try { await this._leaveAccount(other, b, now); } catch (e) { console.warn('[hub] replaced leave failed', e?.message ?? e); } }
      }
      const others = [];
      for (const [other, b] of this._all()) if (other !== ws && b.id) others.push(b);
      if (!others.length) { try { await this._sweep(); } catch (e) { console.warn('[room] sweep failed', e?.message ?? e); } await this.state.storage.put('hellos', gate.bucket); }   // an empty room forgets every look and secret an unclean close left behind - not its hello gate (AUDIT SOC A2: contained - a failed list here made every first hello into an empty hub throw before its welcome)
      await this.state.storage.put(secretKey(m.id), m.secret);
      if (!chat) { await this.state.storage.put(lookKey(m.id), m.look); this._looks.set(m.id, m.look); }   // a channel keeps no look: nobody is drawn from it
      const guild = who.gi ? { gi: who.gi, gt: who.gt, gm: who.gm } : {};   // GUILD1c: the guild the token carried, when it carried one
      if (!this._setAttach(ws, { ...a, id: m.id, name: who.name, title: who.title, glyphs: who.glyphs, lv: who.lv, ...guild, gio: who.gio, sub: who.subject, mu: who.mu, pose: chat ? null : m.pose, since: replaced?.since ?? now })) { this._refuse(ws, 'hello too large'); return; }   // MOD1: `sub` the verified account (what a mute names), `mu` until when it may not talk   // RENOWN1: `lv` the Renown level the token carried
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
        const named = others.slice(0, CHAT_ROSTER_MAX).map((b) => badged({ id: b.id, name: b.name, sub: b.sub }, b));   // MOD1: and the verified account - what /mute names   // ACC3: and whatever the token vouched for, beside it   // ACC1g: a name and nothing beside it - every name in this room was verified to get in, so a per-name verdict says the same thing about everybody
        const ev = isSocialRoom(a.key) ? await this._liveEvent() : null;   // EVENT1: the hub says the live event staged now, so a player who joins mid-event sees it; no field is no event (an old client reads none)
        if (!this._send(ws, JSON.stringify({ t: 'welcome', id: m.id, peers: named, n: others.length + 1, v: RELAY_VERSION, now: Date.now(), ...(ev ? { ev } : {}) }))) return;   // AUDIT SOC B7: the relay's clock rides the channel's welcome too (WORLD5's `now`), so the hub link reads last-seen and an invite's lapse on the relay's time without waiting on the presence session's welcome
        const said = JSON.stringify(badged({ t: 'join', id: m.id, name: who.name, sub: who.subject }, who));
        for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, said);
        // SOC1: the account, in the hub - after the welcome and the join, so a client's session has reset on the
        // welcome before its picture lands; a hello naming none is a build before this slice, admitted as it was
        if (isSocialRoom(a.key) && m.acct) { try { await this._helloAccount(ws, m, now); } catch (e) { console.warn('[hub] account hello failed', e?.message ?? e); } }   // AUDIT SOC A2: contained, as the acts and the leave are
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
      // HCC-PARK: the cell's parked teams, after the welcome that resets the joiner's session (a halo's hello included)
      // AUDIT HCC-PARK (client C3): ALWAYS, an empty list included - a reconnect's welcome is the whole truth, and a
      // team taken up while this socket was away must go; never the joiner's own account's records (D2)
      if (isCellRoom(a.key)) {
        const now = Date.now(), sub = this._attach(ws)?.sub;
        const parks = (await this._parkList(now)).filter((e) => e.sub !== sub).map((e) => this._parkPublic(e));
        if (!this._send(ws, JSON.stringify({ t: 'parks', now, data: parks }))) return;
      }
      const join = JSON.stringify(badged({ t: 'join', id: m.id, name: who.name, look: m.look, pose: m.pose }, who));
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
      if (cell && (!Array.isArray(m.data.f) || m.data.f.length > CELL_FRAME_RECORDS_MAX)) { this._junk(ws); return; }
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
      if (!target) { if (cell) this._junk(ws); return; }
      // A6: the funnel onto the destination's ONE socket - all strikers together, HIT_ROOM_HZ_MAX a second; over it
      // the blow is dropped and nobody struck. AUDIT WORLD6b A1/A2: the budget is the DESTINATION's (its own bucket,
      // among its meters), not the room's - in a cell the blows go to many owners, and one room-wide bucket let six
      // honest fights, or one stream of unroutable blows, silence every other blow in the country
      const [tws] = target;
      const tm = this._meterOf(tws);
      const funnel = tokenGate(tm.hbucket ?? null, now, HIT_ROOM_HZ_MAX);
      tm.hbucket = funnel.bucket;
      if (!funnel.pass) return;
      const out = JSON.stringify({ t: 'hit', id: a.id, data: m.data });
      // AUDIT WORLD6b-iii(c) C3: the hit bytes - a grant carries a corpse's pile, so the arm counts bytes as the foes
      // and the acts do; over the budget the frame is dropped, nobody struck (three sockets pushed 720 KiB/s of grants
      // into one destination through an arm that counted frames alone). AUDIT 68 X8-hit-byte-budget-room-wide-starves-grants:
      // the DESTINATION's, as the frame funnel above is - one room-wide bucket let one socket's junk blows drop every
      // honest grant in the room, whose items had already left their corpse; and (the pre-merge review) a per-SENDER
      // bucket reopened C3 itself, N senders each their own 256 KiB/s into one socket. Aimed at a destination, a flood
      // spends that destination's bytes and no one else's
      const bytes = byteGate(tm.hbytes ?? null, now, out.length, HIT_ROOM_BYTES_PER_S);
      tm.hbytes = bytes.bucket;
      if (!bytes.pass) return;
      this._send(tws, out);
      return;
    }
    if (m.t === 'trade') {
      // TRADE1: ONE DIRECTED FRAME, THE `hit` FRAME'S OWN ROUTING - from a hello'd socket in a PLACE room (a channel or the
      // hub is no place to stand and trade), on the trade bucket, to the socket `to` names in this room and to it alone,
      // the sender's id stamped on it. The relay reads none of the items (wire.js validTradeData checked the SHAPE;
      // the receiver projects every record through validLootItem before it reads a field). A peer that is gone is not
      // junk - a leave races a frame - and the sender's own session times out on it.
      const now = Date.now();
      a = this._meterTrade(ws, a, now); if (!a) return;
      if (isChatRoom(a.key) || isSocialRoom(a.key)) return;
      const to = m.data.to;
      if (to === a.id) { this._junk(ws); return; }
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === to) ?? null;
      if (!target) return;
      // the funnel onto the destination's ONE socket - every sender together (the hit arm's A6 law, its own bucket)
      const [tws] = target;
      const tm = this._meterOf(tws);
      const funnel = tokenGate(tm.tinbucket ?? null, now, TRADE_ROOM_HZ_MAX);
      tm.tinbucket = funnel.bucket;
      if (!funnel.pass) return;
      const out = JSON.stringify({ t: 'trade', id: a.id, data: m.data });
      // AUDIT DROPS B3: the byte budget is the SENDER's, not the room's - a room-wide bucket let two sockets at
      // TRADE_HZ_MAX x TRADE_FRAME_MAX spend the whole room and drop an honest commit that had already cost its
      // sender their goods (LOOT-DUP: sent means gone). Per sender, a flood only starves the flooder.
      const mine = this._meterOf(ws);
      const bytes = byteGate(mine.tbytes ?? null, now, out.length, TRADE_ROOM_BYTES_PER_S);
      mine.tbytes = bytes.bucket;
      if (!bytes.pass) return;
      this._send(tws, out);
      return;
    }
    if (m.t === 'cast') {
      // ALLY-CAST: ONE DIRECTED FRAME, the trade arm's own routing - from a hello'd socket in a PLACE room, on the cast
      // bucket, to the socket `to` names in this room and to it alone, the sender's id stamped on it. The relay reads
      // none of the spell (wire.js validCastData checked the shape and bounds; the receiver keeps the beneficial
      // families of it alone and applies them itself). A frame at my own id is junk; a peer that is gone is not.
      const now = Date.now();
      a = this._meterCast(ws, a, now); if (!a) return;
      if (isChatRoom(a.key) || isSocialRoom(a.key)) return;
      const to = m.data.to;
      if (to === a.id) { this._junk(ws); return; }
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === to) ?? null;
      if (!target) return;
      const [tws] = target;
      // AUDIT ALLY-CAST B2: the funnel onto the destination is PER SENDER (wire.js CAST_DEST_SENDERS_MAX) - one bucket
      // for everyone let five strangers starve a mate's heals, and this relay cannot tell a mate from a stranger.
      // The stalest sender's slot goes to a newcomer, so a mate always finds a fresh bucket unless they spam it.
      if (!this._senderFunnel(tws, a.id, now)) return;
      this._send(tws, JSON.stringify({ t: 'cast', id: a.id, data: m.data }));
      return;
    }
    if (m.t === 'card') {
      // INSPECT1: ONE DIRECTED FRAME, the cast arm's own routing - an ask for a player's card or its answer, from a
      // hello'd socket in a PLACE room (a channel or the hub is nowhere to stand beside someone) on the card bucket,
      // to the socket `to` names in this room and to it alone, the sender's id stamped on it. The relay reads none of
      // the card (wire.js validCardData checked the shape and bounds); the asker draws it as the answerer's own word.
      // A frame at my own id is junk; a peer that is gone is not (a leave races a frame, and the asker times out).
      const now = Date.now();
      a = this._meterCard(ws, a, now); if (!a) return;
      if (isChatRoom(a.key) || isSocialRoom(a.key)) return;
      const to = m.data.to;
      if (to === a.id) { this._junk(ws); return; }
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === to) ?? null;
      if (!target) return;
      const [tws] = target;
      // THE CAST ARM'S FUNNEL, SHARED - not a second one: one sender, one destination, one bucket, whatever the directed
      // frame (_senderFunnel says why)
      if (!this._senderFunnel(tws, a.id, now)) return;
      // DUEL1: and the answerer's VERIFIED account beside its id (MOD1's `sub`, off the token), so the profile can read
      // the duelling record the account service keeps for that account - never a record the answer claims
      this._send(tws, JSON.stringify({ t: 'card', id: a.id, ...(typeof a.sub === 'string' && a.sub ? { sub: a.sub } : {}), data: m.data }));
      return;
    }
    if (m.t === 'duel') {
      // DUEL1: ONE DIRECTED FRAME, the card arm's own routing - a duel's invite, answer, start, blow, spell, result or end,
      // from a hello'd socket in a PLACE room (a duel is two bodies in one ring; a channel or the hub is nowhere to stand)
      // on the duel bucket, to the socket `to` names in this room and to it alone, the sender's id AND its verified account
      // (`sub`, off the identity token) stamped on it: the loser's client names the winner's account to the account
      // service by that stamp, so whose win it was is never a client's own word. The relay reads none of the rest
      // (wire.js validDuelData checked the shape and bounds; the DEFENDER resolves every blow against its own sheet).
      // A frame at my own id is junk; a peer that is gone is not (a leave races a frame, and the duel times out on it).
      const now = Date.now();
      a = this._meterDuel(ws, a, now); if (!a) return;
      if (isChatRoom(a.key) || isSocialRoom(a.key)) return;
      const to = m.data.to;
      if (to === a.id) { this._junk(ws); return; }
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === to) ?? null;
      if (!target) return;
      const [tws] = target;
      // the funnel onto the destination, per sender - the cast's shape on slots of its own at the duel's rate
      if (!this._senderFunnel(tws, a.id, now, 'duin', DUEL_HZ_MAX)) return;
      this._send(tws, JSON.stringify({ t: 'duel', id: a.id, ...(typeof a.sub === 'string' && a.sub ? { sub: a.sub } : {}), data: m.data }));
      return;
    }
    if (m.t === 'page') {
      // JOURNAL1: ONE DIRECTED FRAME, the card arm's own routing - a page of the sender's journal held out to the socket
      // `to` names, from a hello'd socket in a PLACE room (a page is shown to someone standing there; a channel or the
      // hub is nowhere to stand) on the page bucket, the sender's id stamped on it. A MUTED player's page goes nowhere,
      // and they are told why and until when, as their line is (MOD1) - after the gate, so a muted player hammering
      // Share is struck out exactly as anyone would be. The relay reads nothing of the page but its law (wire.js
      // validPageData cleaned its words and refused it past its bound); the reader draws it as the sender's own word.
      // A frame at my own id is junk; a peer that is gone is not (a leave races a frame).
      const now = Date.now();
      a = this._meterPage(ws, a, now); if (!a) return;
      if (a.mu && a.mu > Math.floor(now / 1000)) { this._send(ws, JSON.stringify({ t: 'muted', until: a.mu })); return; }
      if (isChatRoom(a.key) || isSocialRoom(a.key)) return;
      const to = m.data.to;
      if (to === a.id) { this._junk(ws); return; }
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === to) ?? null;
      if (!target) return;
      const [tws] = target;
      // the funnel onto the destination, per sender - the cast's and the card's ONE (_senderFunnel says why)
      if (!this._senderFunnel(tws, a.id, now)) return;
      this._send(tws, JSON.stringify({ t: 'page', id: a.id, data: m.data }));
      return;
    }
    if (m.t === 'park') {
      // HCC-PARK: my character's parked team (wire.js's header: the cell keeps its own, the registry drops the old
      // cell's). From a hello'd socket in a PLACE room, on the park bucket; the owner is the ACCOUNT the token
      // verified and the character the frame names (AUDIT HCC-PARK D1: never the peer id a client picks), and the
      // name that rides the record is the socket's own verified one, never the frame's.
      const now = Date.now();
      a = this._meterPark(ws, a, now); if (!a) return;
      if (isChatRoom(a.key) || isSocialRoom(a.key) || typeof a.sub !== 'string' || !a.sub) return;
      const k = await parkKeyOf(a.sub, m.data.c);
      const here = isCellRoom(a.key) ? a.key : null;
      const cell = m.data.a ? cellRoomOfWire(m.data.a[0], m.data.a[1]) : null;
      if (m.data.r && cell === here) await this._parkStore(k, a.sub, a.id, a.name ?? '', m.data.r, now);
      else if (here && cell !== here) await this._parkDrop(k);   // mine here is superseded: nothing parked, or it stands elsewhere
      await this._parkRegister(k, cell, now);
      return;
    }
    if (m.t === 'look') {
      // PROFILE2: my look again, mid-session (a skin chosen on the pause screen, a coat put on) - the hello's look
      // without the hello. On the looks' own bucket; a channel keeps no look (nobody is drawn from it). Stored where the
      // hello stored it, so a later welcome's roster and a `who` answer say the new one; and fanned as the hello's JOIN
      // to everyone hello'd here - the frame every client already reads as "this peer's look is now this" (online.js
      // `_refresh`). The pose rides nothing: a join is said to the whole room, and the room's pose fan is the ranged
      // one (the `who` answer's B2 law). The fan is a hello's fan, so it spends the room's HELLO budget, and over it
      // the socket is refused busy exactly as a hello is - its reconnect's hello carries the new look.
      const now = Date.now();
      a = this._meterLook(ws, a, now); if (!a) return;
      if (isChatRoom(a.key)) return;
      const gate = tokenGate(await this.state.storage.get('hellos'), now, HELLO_HZ_MAX);
      await this.state.storage.put('hellos', gate.bucket);
      if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
      await this.state.storage.put(lookKey(a.id), m.look); this._looks.set(a.id, m.look);
      if (this._attach(ws)?.id !== a.id) return;   // replaced while the store was written: the new socket's hello said its own
      const said = JSON.stringify(badged({ t: 'join', id: a.id, name: a.name, look: m.look, pose: null }, a));
      for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, said);
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
      // own borrowing bucket (`abytes`, ACT_SENDER_BYTES_PER_S, among its meters) before the room's, and a frame the
      // sender's bucket refuses charges the room nothing; a frame the room refuses charges the sender nothing either,
      // so an honest sender behind a flooder is not left paying for a door that never opened.
      const cost = out.length * listeners.length;
      const meters = this._meterOf(ws);
      const mine = byteGate(meters.abytes, now, cost, ACT_SENDER_BYTES_PER_S, true);
      if (!mine.pass) { meters.abytes = mine.bucket; return; }
      const bytes = byteGate(this._roomActBytes, now, cost, ACT_ROOM_BYTES_PER_S, true);
      this._roomActBytes = bytes.bucket;
      if (!bytes.pass) { meters.abytes = { bytes: mine.bucket.bytes + cost, at: now }; return; }   // refilled, not charged
      meters.abytes = mine.bucket;
      for (const [other] of listeners) this._send(other, out);
      return;
    }
    if (m.t === 'social') {
      // SOC1: a friend or party act - on the acts' own bucket (the same strikes), in the hub alone (outside it junk: a
      // correct client sends none there), from an account (without one refused in words), under the room's budget
      // (over it 'busy', nobody struck); what it did or why not is the hub's answer, never a close
      const now = Date.now();
      a = this._meterSocial(ws, a, now); if (!a) return;
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      const budget = tokenGate(this._roomSocial, now, SOCIAL_ROOM_HZ_MAX);
      this._roomSocial = budget.bucket;
      if (!budget.pass) { this._sayError(ws, 'busy'); return; }
      if (!a.acct) { this._sayError(ws, 'no account'); return; }   // AUDIT SOC A11: under the room's budget, as every arm's refusal is
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
      if (!isSocialRoom(a.key) || !a.acct) { this._junk(ws); return; }
      this._setAttach(ws, { ...a, pm: { ...m.p, at: now } });
      if (!a.party) return;
      if (this._speaker(a.acct) !== ws) return;   // AUDIT SOC B9: another tab of mine speaks for the seat - this pose is kept, fanned to nobody
      let party = null;
      try { party = await this._livingParty(a.party, now); } catch (e) { console.warn('[hub] party pose failed', e?.message ?? e); return; }   // AUDIT SOC A2: contained
      if (!party || !party.members.includes(a.acct)) { this._markParty(a.acct, null); return; }   // the seat is gone: the attachment forgets it, or every pose would read storage for a party that is not there
      const out = JSON.stringify({ t: 'party', acct: a.acct, p: m.p });
      for (const member of party.members) if (member !== a.acct) for (const other of this._socketsOf(member)) this._send(other, out);
      return;
    }
    if (m.t === 'quest') {
      // QUEST1: a quest shared with my party - its own bucket (metered like the poses), room-budgeted like a social
      // act (an arbitrary-payload, one-off act, not a per-frame stream), fanned to my party's other members alone.
      // The relay reads `m.quest.questName`/`displayName` only to keep them bounded (parseClient already did); the
      // save-data envelope itself is opaque here exactly as 'world'/'foes'/'act' data is - validating a quest's own
      // shape is the quest engine's job, not the relay's.
      const now = Date.now();
      // A3 (WORLD2's own rule, applied here): the pre-parse door may have
      // already metered this frame under QUEST_HZ_MAX (a large one, above)
      // - meter again only if it did not, so a big quest-share never spends
      // two tokens for one message.
      if (doored !== 'quest') { a = this._meterQuest(ws, a, now); if (!a) return; }
      if (!isSocialRoom(a.key) || !a.acct) { this._junk(ws); return; }   // the hub alone, an account alone - the party arm's own law
      // AUDIT DROPS C3: a share with nobody to reach (no party; another tab of mine speaks for the seat - AUDIT SOC
      // B9) spends nothing of the room's budget
      if (!a.party) return;
      if (this._speaker(a.acct) !== ws) return;
      const budget = tokenGate(this._roomQuest, now, QUEST_ROOM_HZ_MAX);
      this._roomQuest = budget.bucket;
      if (!budget.pass) { this._sayError(ws, 'busy'); return; }
      let party = null;
      try { party = await this._livingParty(a.party, now); } catch (e) { console.warn('[hub] quest share failed', e?.message ?? e); return; }
      if (!party || !party.members.includes(a.acct)) { this._markParty(a.acct, null); return; }
      const mine = await this._acct(a.acct);
      const out = JSON.stringify({ t: 'quest', acct: a.acct, name: mine?.name ?? null, quest: m.quest });
      const targets = [];
      for (const member of party.members) if (member !== a.acct) for (const other of this._socketsOf(member)) targets.push(other);
      // AUDIT PARTY8 (2026-09-23): the fan pays in BYTES as the act arm does (AUDIT WORLD3 A1) - a 64 KiB share to
      // seven members' eight tabs each is 3.5 MiB out of the hub for one press, and the room's rate gate alone let
      // eight of those a second through. A frame the budget refuses is 'busy', the same word the rate gate says.
      const bytes = byteGate(this._roomQuestBytes, now, out.length * targets.length, QUEST_ROOM_BYTES_PER_S, true);
      this._roomQuestBytes = bytes.bucket;
      if (!bytes.pass) { this._sayError(ws, 'busy'); return; }
      for (const other of targets) this._send(other, out);
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
      if (!id || id === a.id) { this._junk(ws); return; }
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
      // ACC3: AND THE BADGE, off the attachment, exactly as the welcome
      // and the join carry it. A stranger learned this way is the one
      // peer that would otherwise arrive unbadged while everyone else
      // is badged - a signal true most of the time, which is the shape
      // ACC1d-MARK was retired for being.
      this._send(ws, JSON.stringify(badged({ t: 'join', id: b.id, name: b.name, look, pose: inRange(a.key ?? '', a.pose, b.pose) ? (b.pose ?? null) : null }, b)));
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
      // PEER_TIMEOUT_MS TO THE MILLISECOND (at the day's 5000/20000; RELAY-H1 moved the pair to 20000/80000 and
      // derived the timeout from the heartbeat, so the ratio is the law and this arm is what keeps it from mattering). Zero margin: the silence law hid every standing peer past the bound at
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
      if (!this._spend(ws, now, chatGate, 'cbucket', 'cdrops', 'too many lines', CHAT_STRIKES_MAX)) return;   // over the rate: dropped, never queued
      // MOD1: A MUTED PLAYER'S LINE GOES NOWHERE, and they are told why
      // and until when - after the rate gate, so a muted player hammering
      // the key is struck out exactly as anyone else would be, and a
      // refusal is never a free way to make the room answer.
      if (a.mu && a.mu > Math.floor(now / 1000)) { this._send(ws, JSON.stringify({ t: 'muted', until: a.mu })); return; }
      await this._sayLine(ws, a, m.ch, { t: 'chat', id: a.id, name: a.name, text: m.text, at: now, sub: a.sub, ...(m.me === true ? { me: true } : {}) }, now);   // MOD1: the verified account beside the line; EMOTE1: and an action said as one
      return;
    }
    if (m.t === 'roll') {
      // ═══ DICE1 — THE RELAY ROLLS ════════════════════════════════════
      //
      // Addison Knox: "Chat dice-rolling". A roll the client made would
      // be a number the client chose, so the client ASKS - n dice of m
      // sides, plus k (net/dice.js, checked by parseClient) - and the
      // relay rolls them from its own CSPRNG (crypto.getRandomValues,
      // drawn unbiased) and says the result as a frame of its own TYPE,
      // which no player can send out: a chat line that reads "rolls 2d6:
      // 12" is a chat line. The roll goes where a line would, on the
      // channel it was asked on - `_sayLine`, the chat's own fan - and
      // on its own bucket and strikes, so rolling is never a way to
      // talk past the chat gate, nor talking a way to roll past this one.
      // A muted player's roll goes nowhere, as their line does.
      const now = Date.now();
      if (!this._spend(ws, now, rollGate, 'rollBucket', 'rollDrops', 'too many rolls', CHAT_STRIKES_MAX)) return;
      if (a.mu && a.mu > Math.floor(now / 1000)) { this._send(ws, JSON.stringify({ t: 'muted', until: a.mu })); return; }
      const r = rollDice({ n: m.n, m: m.m, k: m.k }, rand32);
      if (!r) return;
      await this._sayLine(ws, a, m.ch, { t: 'roll', id: a.id, name: a.name, at: now, sub: a.sub, ...r }, now);
      return;
    }
    if (m.t === 'say') {
      // ═══ RED1 — THE SERVER SPEAKING ═══════════════════════════════
      //
      // Mac: "a red text system (kind of like warframe) where I can
      // message chat as the server."
      //
      // THE AUTHORITY IS THE DEV GLYPH THE TOKEN ALREADY CARRIED, and
      // nothing new was invented to hold it. `a.glyphs` was written by
      // `_named` off the VERIFIED claims and can be written by nothing
      // else on this socket - so the right to speak as the server is
      // the same fact as the mark beside the name, granted the same
      // way (a handle in the service's config) and revoked the same
      // way. A handle taken off that list stops being able to do this
      // within one token's life, with nothing here to clear.
      //
      // NO SEPARATE PASSWORD, NO ADMIN ROUTE, NO SECOND KEY. Each of
      // those would be a second thing that can leak and a second thing
      // to revoke; this one is already audited, already signed, and
      // already expires.
      const now = Date.now();
      // ITS OWN BUCKET, well under chat's. A player's line reaches a
      // room; this reaches every player in the game. AUDIT 68
      // X8-v-say-mute-unstruck: spent BEFORE the authority is asked and
      // struck as every arm is (`_spend`) - a stranger's say was metered
      // by nothing, and a flood past the rate was never closed.
      if (!this._spend(ws, now, redGate, 'rbucket', 'rdrops', 'too many lines')) return;
      if (!Array.isArray(a.glyphs) || !a.glyphs.includes('dev')) return;   // silently: a stranger probing this learns nothing from being ignored
      // A LINE NOBODY IS SPEAKING: no id, no name. Its own frame type
      // rather than a flag on a chat line, because a flag on a chat
      // frame is a field, and net/chat.js' own note says why that
      // matters - the client marks this from the TYPE, which no player
      // can send.
      const said = JSON.stringify({ t: 'red', text: m.text, at: now });
      for (const [other, b] of [...this._all()]) if (b.id) this._send(other, said);   // everyone in this room, the sender included - that is the receipt
    }
    if (m.t === 'narrate') {
      // ═══ TITLE-N — THE DUNGEON MASTER SPEAKING ═════════════════════
      //
      // Mac (2026-09-24): "This title allows the user to use the /dm to
      // message chat with orange text (similar to /red)." RED1's law,
      // one glyph over: the right is the `dm` glyph `_named` wrote off
      // the VERIFIED claims - granted by a handle in the account
      // service's config, revoked by taking it off - and nothing else on
      // this socket can write it.
      if (!Array.isArray(a.glyphs) || !a.glyphs.includes('dm')) return;   // silently, as /red is
      const now = Date.now();
      const meters = this._meterOf(ws);
      const gate = dmGate(meters.dbucket, now);   // its own bucket: narrating spends none of the server line's
      meters.dbucket = gate.bucket;
      if (!gate.pass) return;
      // its own FRAME TYPE, for /red's reason: the client marks the line from the type, which no player can send
      const said = JSON.stringify({ t: 'dm', text: m.text, at: now });
      for (const [other, b] of [...this._all()]) if (b.id) this._send(other, said);   // everyone in this room, the sender included
    }
    if (m.t === 'stage') {
      // ═══ EVENT1 — A LIVE EVENT, STAGED FOR EVERYONE ONLINE ═════════
      //
      // Mac: "I wanna do a fun live event for the server ... turn the skies of Daggerfall into a detailed oblivion
      // styled dread in prep for the world bosses."
      //
      // RED1'S AUTHORITY, AND NOTHING NEW TO HOLD IT: the dev glyph off the verified token. IN THE HUB ALONE - the one
      // room every online player holds a socket to (CHAT_TABS' World link), so the hub's fan IS "everyone online",
      // with no cross-room broadcast the relay does not have (it keeps no global state). Anywhere else it is junk: a
      // correct client stages nowhere but the hub.
      //
      // KEPT IN THE HUB'S STORAGE until a dev ends it (EVENT_KEY, apart from every prefix a drain or the sweep
      // deletes), so a player who joins an hour in reads it off the welcome, and a deploy or a quiet night does not end
      // it. The relay carries a WORD (LIVE_EVENTS) and its stamp - never a colour, a rate or a text a stager could
      // shape: what an event looks like is the client's.
      const now = Date.now();
      if (!this._spend(ws, now, eventGate, 'evbucket', 'evdrops', 'too many stages')) return;   // metered before the authority is asked (AUDIT 68)
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      if (!Array.isArray(a.glyphs) || !a.glyphs.includes('dev')) return;   // silently, as RED1's
      const ev = m.kind ? { kind: m.kind, at: now } : null;
      if (ev) await this.state.storage.put(EVENT_KEY, ev); else await this.state.storage.delete(EVENT_KEY);
      this._event = ev;
      const said = JSON.stringify({ t: 'event', kind: m.kind, at: now });
      for (const [other, b] of [...this._all()]) if (b.id) this._send(other, said);   // everyone in the hub, the stager included - that is the receipt
      return;
    }
    if (m.t === 'mute') {
      // ═══ MOD1 — A MUTE ORDER, CARRIED IN ═══════════════════════════
      //
      // Mac: "moderator chat commands" - /mute and /unmute.
      //
      // THE CARRIER IS NOT ASKED WHO THEY ARE. The account service
      // decided the moderator may do this and SIGNED the result; this
      // room checks that signature with the key it already holds and
      // nothing else. So the authority is exactly as strong as the
      // name and the badge - one grant list in the service's config,
      // one signature - and this arm adds no second way to be trusted.
      const now = Date.now();
      if (!this._spend(ws, now, muteGate, 'mbucket', 'mdrops', 'too many mute orders')) return;   // AUDIT 68 X8-v-say-mute-unstruck: struck, as every arm is
      await this._loadKey();
      if (!this._verifyKey) return;
      const r = await verifyOrder(m.order, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'mute' });
      if (!r.ok) return;   // silently, as `say` refuses: a forger learns nothing from being ignored
      const { s: sub, mu, i } = r.claims;
      const sig = m.order.slice(m.order.lastIndexOf('.') + 1);
      // THE NEWEST ORDER WINS, and the same one twice is one order. A
      // replay of an old mute inside its minute cannot undo the unmute
      // that followed it.
      const held = this._orders.get(sub);
      if (held && (i < held.i || held.sig === sig)) return;
      this._orders.delete(sub);
      if (this._orders.size >= ORDERS_MAX) this._orders.delete(this._orders.keys().next().value);
      this._orders.set(sub, { i, mu, sig });
      const told = JSON.stringify({ t: 'muted', until: mu });
      for (const [other, b] of [...this._all()]) {
        if (b.sub !== sub) continue;
        this._setAttach(other, { ...b, mu });
        this._send(other, told);   // the player hears it at once - muted until, or 0 for lifted
      }
    }
    if (m.t === 'renown') {
      // ═══ RENOWN1 — A LEVEL THAT ROSE, CARRIED IN ══════════════════════
      //
      // Mac: "Plus having their level appear on the left side of
      // character name". The level rides the token, and a token is
      // spent once, on a hello - so a level that rises in the middle of
      // a fight would sit stale beside the name until the next room.
      // The account service signs a RENOWN ORDER when it derives a new
      // level, the player's own client carries it here, and the room
      // checks two things only: the signature (with the key it already
      // holds), and that the order names THIS socket's verified
      // account. Nobody carries another player's level, and a level is
      // never the carrier's own word.
      //
      // AUDIT RENOWN1 (SEC-2, SEC-3, WIRE-1): THREE MORE LAWS, each a way this arm was driven.
      //   ONLY A RISE. Any valid order inside its minute was taken, so a carrier holding two of its own (level 2 and
      //   level 3) flapped them - every frame "changed" the level and fanned to the whole room (ten sockets of one
      //   account, 600 frames a second into a room of sixty, and no strike ever counted), and a replayed OLDER order
      //   pulled the level shown DOWN. A level never falls, so an order that does not raise this socket's is answered
      //   to its carrier alone - the level this room holds, which is the carrier's word that its order arrived - and
      //   fans nothing: a socket fans at most once a level, forty-nine times in its life.
      //   NOT IN A CHANNEL OR THE HUB. No client carries one there (a channel draws no level), and the world channel
      //   is two thousand sockets.
      //   THE ROOM'S OWN BUDGET (RENOWN_ROOM_HZ_MAX): the per-socket gate bounds a socket, not the room it fans to.
      //   Over it a rise is dropped unanswered, and the carrier, which has not heard its echo, sends it again.
      const now = Date.now();
      if (!this._spend(ws, now, renownGate, 'rnbucket', 'rndrops', 'too many renown orders')) return;
      const at = this._attach(ws);
      if (!at?.id || isChatRoom(at.key) || isSocialRoom(at.key)) return;
      await this._loadKey();
      if (!this._verifyKey) return;
      const r = await verifyOrder(m.order, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'renown' });
      if (!r.ok) return;   // silently, as the mute arm refuses
      const cur = this._attach(ws);   // read again after the awaits: the socket may have gone
      if (!cur?.id || !cur.sub || r.claims.s !== cur.sub) return;
      if (!(r.claims.lv > (cur.lv ?? 0))) {   // not a rise: its carrier hears what this room holds, and nobody else hears a thing
        if (renownIssuable(cur.lv)) this._send(ws, JSON.stringify({ t: 'renown', id: cur.id, lv: cur.lv }));
        return;
      }
      const budget = renownRoomGate(this._roomRenown, now);
      if (!budget.pass) return;
      this._roomRenown = budget.bucket;
      if (!this._setAttach(ws, { ...cur, lv: r.claims.lv })) return;
      const said = JSON.stringify({ t: 'renown', id: cur.id, lv: r.claims.lv });
      for (const [other, b] of [...this._all()]) if (b.id) this._send(other, said);   // everyone in the room, the carrier included
    }
    if (m.t === 'guild') {
      // ═══ GUILD1c — A CHARACTER'S GUILD, CHANGED, CARRIED IN ════════════
      //
      // Mac: "Do guild1c" - the tag beside the name, and the guild's chat. The guild rides the token, and a token is
      // spent once, on a hello - so a guild founded, joined or left in the middle of a session would sit stale beside
      // the name (and in the hub, in the guild's chat) until the next room. The account service signs a GUILD ORDER
      // when a membership moves - the guild the carrier's character is in NOW, or none - the player's own client
      // carries it here, and the room checks RENOWN1's two things: the signature, and that it names THIS socket's
      // verified account. Nobody carries another player's guild.
      //   NEWEST WINS. An order said before what this socket already wears (its token's, or a later order's) changes
      //   nothing, and neither does one said before a removal this room heard (`_guildOuts`) - so a replayed join
      //   inside its minute cannot undo the leave, or the removal, that followed it. Not news: its carrier hears what
      //   this room holds, and nobody else hears a thing.
      //   THE TAG FANS IN A PLACE ALONE, on the room's own budget, and only when it moved; in a channel or the hub (two
      //   thousand sockets) its carrier alone hears it, as renown's rule is there. Over the budget the change still
      //   lands and its carrier hears it - the others read the tag off their next roster.
      const now = Date.now();
      if (!this._spend(ws, now, guildGate, 'gdbucket', 'gddrops', 'too many guild orders')) return;
      if (!this._attach(ws)?.id) return;
      await this._loadKey();
      if (!this._verifyKey) return;
      const r = await verifyOrder(m.order, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'guild' });
      if (!r.ok) return;   // silently, as the renown arm refuses
      const cur = this._attach(ws);   // read again after the awaits: the socket may have gone
      if (!cur?.id || !cur.sub || r.claims.s !== cur.sub) return;
      const c = r.claims;
      if (!(c.i > (cur.gio ?? 0)) || (c.gi && this._guildOutAfter(c.gi, c.gm, c.i))) { this._send(ws, this._guildFrame(cur.id, cur.gt)); return; }
      if (!this._setAttach(ws, { ...this._unguild(cur), ...(c.gi ? { gi: c.gi, gt: c.gt, gm: c.gm } : {}), gio: c.i })) return;
      const said = this._guildFrame(cur.id, c.gt);
      const place = !isChatRoom(cur.key) && !isSocialRoom(cur.key);
      const budget = place && (cur.gt ?? null) !== (c.gt ?? null) ? guildRoomGate(this._roomGuild, now) : null;
      if (!budget?.pass) { this._send(ws, said); return; }
      this._roomGuild = budget.bucket;
      for (const [other, b] of [...this._all()]) if (b.id) this._send(other, said);   // everyone in the room, the carrier included
    }
    if (m.t === 'guildout') {
      // ═══ GUILD1c — A MEMBER REMOVED, OR A GUILD GONE, CARRIED IN ═══════
      //
      // MOD1's shape: the account service signed it for the officer who removed the member (or the guildmaster who
      // disbanded the guild), and the room believes the signature and never asks the carrier who they are. Every
      // socket here wearing that membership - or that guild - takes it off and hears it: in the hub, where the client
      // carries it, that is the guild's chat closing to them wherever they stand, and their own client hearing it is
      // what sends their rooms the tag gone. And the room holds the word (`_guildOuts`), so a token or an order said
      // before it cannot put them back.
      const now = Date.now();
      if (!this._spend(ws, now, guildGate, 'gdbucket', 'gddrops', 'too many guild orders')) return;
      await this._loadKey();
      if (!this._verifyKey) return;
      const r = await verifyOrder(m.order, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'guildout' });
      if (!r.ok) return;   // silently, as the mute arm refuses
      const { gi, gm, i } = r.claims;
      this._holdGuildOut(gi, gm, i);
      const gone = [];
      for (const [other, b] of [...this._all()]) {
        if (!b.id || b.gi !== gi || (gm !== undefined && b.gm !== gm) || !(i > (b.gio ?? 0))) continue;
        if (this._setAttach(other, { ...this._unguild(b), gio: i })) gone.push([other, b]);
      }
      const place = !isChatRoom(this._attach(ws)?.key) && !isSocialRoom(this._attach(ws)?.key);
      for (const [other, b] of gone) {
        const said = this._guildFrame(b.id, null);
        const budget = place ? guildRoomGate(this._roomGuild, now) : null;
        if (!budget?.pass) { this._send(other, said); continue; }   // in a channel or the hub, or over the budget: that player alone
        this._roomGuild = budget.bucket;
        for (const [each, e] of [...this._all()]) if (e.id) this._send(each, said);
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
  /** The account's record, or null - the instance's copy while it is awake (AUDIT SOC A5: one act read ~500 keys; the
   *  records this object has read are kept on it, and every write goes through _putAcct/_putAccts so the copy IS the
   *  storage's - no other object writes this room's keys), else storage's, kept then. */
  async _acct(id) {
    if (this._recs.has(id)) return this._recs.get(id);
    const r = await this.state.storage.get(acctKey(id));
    const rec = r && typeof r === 'object' ? r : null;
    this._keepRec(id, rec);
    return rec;
  }
  _keepRec(id, rec) { if (this._recs.size >= RECS_MAX) this._recs.clear(); this._recs.set(id, rec); }
  async _putAcct(id, rec) { this._keepRec(id, rec); await this.state.storage.put(acctKey(id), rec); }
  /** Several records written as one batch (a friendship is two records at once, or none). */
  async _putAccts(recs) { const puts = {}; for (const [id, rec] of Object.entries(recs)) { this._keepRec(id, rec); puts[acctKey(id)] = rec; } await this.state.storage.put(puts); }
  /** Several accounts' records at once - the instance's copies, and the rest in the runtime's batches (128 keys at most,
   *  SLAM5's wall); a missing record is kept as a miss, so a friend list naming a swept account reads storage once. */
  async _accts(ids) {
    const out = new Map();
    const missing = [];
    for (const id of new Set(ids)) { if (this._recs.has(id)) { const r = this._recs.get(id); if (r) out.set(id, r); } else missing.push(id); }
    for (let i = 0; i < missing.length; i += 128) {
      const slice = missing.slice(i, i + 128);
      const got = await this.state.storage.get(slice.map(acctKey));
      for (const id of slice) { const v = got.get(acctKey(id)); const rec = v && typeof v === 'object' ? v : null; this._keepRec(id, rec); if (rec) out.set(id, rec); }
    }
    return out;
  }
  /** A party's record - the instance's copy, else storage's (kept then, a MISS too - AUDIT SOC A9: an invite naming a
   *  party a sweep took read storage on every state frame until its TTL); null when there is none. */
  async _party(pid) {
    if (this._parties.has(pid)) return this._parties.get(pid);
    const r = await this.state.storage.get(partyKey(pid));
    const party = r && typeof r === 'object' ? r : null;
    this._parties.set(pid, party);
    return party;
  }
  /** Several parties at once, the instance's copies first and the rest in one batch (AUDIT SOC A5: the state frame's
   *  invites were one read each). */
  async _partiesOf(pids) {
    const out = new Map();
    const missing = [];
    for (const pid of new Set(pids)) { if (this._parties.has(pid)) { const p = this._parties.get(pid); if (p) out.set(pid, p); } else missing.push(pid); }
    for (let i = 0; i < missing.length; i += 128) {
      const slice = missing.slice(i, i + 128);
      const got = await this.state.storage.get(slice.map(partyKey));
      for (const pid of slice) { const v = got.get(partyKey(pid)); const party = v && typeof v === 'object' ? v : null; this._parties.set(pid, party); if (party) out.set(pid, party); }
    }
    return out;
  }
  async _putParty(party) { this._parties.set(party.id, party); await this.state.storage.put(partyKey(party.id), party); }
  async _delParty(pid) { this._parties.set(pid, null); await this.state.storage.delete(partyKey(pid)); }
  /** A party as it stands now: its lapsed seats given up (PARTY_OFFLINE_MS offline - the rest told), null when gone. */
  async _livingParty(pid, now) {
    let party = await this._party(pid);
    if (!party) return null;
    const lapsed = party.members.filter((id) => party.away?.[id] != null && now - party.away[id] >= PARTY_OFFLINE_MS && !this._socketsOf(id).length);
    // AUDIT PARTY8 (2026-09-23): the lead walks down the seats as they lapse, and each step said `party.leader` - seven
    // founding seats lapsing at once (a late joiner idle, sending no pose to prompt an earlier sweep) was fourteen
    // notes in one burst against the client's NOTE_IN_HZ_MAX of ten, and the one dropped was "You lead the party
    // now". The lapses each say their note; the lead is told ONCE, for whoever holds it at the end.
    const leaderBefore = party.leader;
    for (const id of lapsed) { if (!party) break; const rec = await this._acct(id); party = await this._partyOut(id, party, now, 'party.lapsed', rec?.name ?? null, { leaderNote: false }); }
    if (party && party.leader !== leaderBefore) { const lrec = await this._acct(party.leader); for (const m of party.members) this._sayNote(m, 'party.leader', party.leader, lrec?.name ?? null); }
    return party;
  }
  /** The party an account sits in, as it stands - or null, the record's stale pointer cleared (a lapse, a drain, a kick
   *  while it was away). Returns [party, rec] with `rec` written when it changed. */
  async _myParty(acct, rec, now) {
    if (!rec.party) return [null, rec];
    const party = await this._livingParty(rec.party, now);
    if (party && party.members.includes(acct)) return [party, rec];
    const next = { ...rec, party: null };
    await this._putAcct(acct, next);
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
  /** AUDIT SOC A6: a PENDING request's row, either way - the name and nothing else. A stranger's unaccepted request
   *  used to hand them my presence and my live peer ids (the tabs a friend's client marks me by in the world) for as
   *  long as they left it pending; presence is what a friendship grants, and a request is not one yet. */
  _blankRow(acct, rec) { return { acct, name: rec?.name ?? null, online: false, seen: null, peers: [] }; }
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
    const socks = this._socketsOf(acct);
    if (!only && !socks.length) return;   // AUDIT SOC A5: nobody to hand it to - a frame for an account with no socket read every friend's record and reached no one
    const [party, mine] = await this._myParty(acct, rec, now);
    const live = (mine.invites ?? []).filter((i) => now - i.at < INVITE_TTL_MS);
    const parties = await this._partiesOf(live.map((i) => i.party));   // AUDIT SOC A5: one batch, not one read per invite
    const invites = live.filter((i) => parties.has(i.party)).map((i) => [i, parties.get(i.party)]);
    const ids = [...mine.friends, ...mine.in.map((e) => e.acct), ...mine.out.map((e) => e.acct), ...(party?.members ?? [])];
    for (const [i, p] of invites) ids.push(i.from, ...p.members);
    const recs = await this._accts(ids);
    const row = (id) => this._rowOf(id, recs.get(id), now);
    const blank = (id) => this._blankRow(id, recs.get(id));
    const frame = {
      t: 'social', k: 'state', acct, name: mine.name,
      peers: socks.map((ws) => this._attach(ws).id),   // AUDIT SOC C20: the ids MY OWN tabs stand as - a second tab of mine is no stranger to friend
      friends: mine.friends.map(row),
      in: mine.in.map((e) => ({ ...blank(e.acct), at: e.at })),
      out: mine.out.map((e) => ({ ...blank(e.acct), at: e.at })),
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
    if (!this._alarmArmed) {   // AUDIT SOC A3: the room is marked a hub (its alarm is the sweep's, whoever is in it) and the sweep armed - once per instance life, and never over an alarm already set
      this._alarmArmed = true;
      await this.state.storage.put('hub', 1);
      if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(now + ACCOUNT_SWEEP_MS);
    }
    let a = this._attach(ws);
    if (a.id !== m.id) return;   // replaced or gone while storage answered
    // ACC1d: the name the relay DECIDED, off the attachment, not the one
    // the frame asked for - `_named` has already run and `a.name` is
    // its answer. A durable record keyed on an unchecked claim is the
    // shape this slice exists to close.
    let rec = { ...((await this._acct(m.acct)) ?? newAcct(a.name, now)), name: a.name, seen: now };
    let party = null;
    if (rec.party) {
      party = await this._livingParty(rec.party, now);
      if (!party || !party.members.includes(m.acct)) { rec.party = null; party = null; }
      else if (party.away?.[m.acct] != null) { const away = { ...party.away }; delete away[m.acct]; party = { ...party, away }; await this._putParty(party); }
    }
    await this._putAcct(m.acct, rec);
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
    let next = gone ? { ...rec, seen: now } : rec;
    let party = next.party ? await this._livingParty(next.party, now) : null;
    if (party && !party.members.includes(a.acct)) party = null;
    // AUDIT SOC A4: a party of ONE with no live invite out is nobody's to keep a seat in - it goes with my last tab, not
    // PARTY_OFFLINE_MS later at the sweep's pace; one that has asked someone waits out the invite (a refresh mid-invite keeps it)
    if (gone && party && party.members.length === 1 && !(party.invites ?? []).some((i) => now - i.at < INVITE_TTL_MS)) { await this._delParty(party.id); party = null; next = { ...next, party: null }; }
    if (gone) await this._putAcct(a.acct, next);
    this._sayPresence(a.acct, next, now, ws);
    if (!party) return;
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
  async _partyOut(acct, party, now, code, name, { leaderNote = true } = {}) {
    if (!party.members.includes(acct)) return party;
    const members = party.members.filter((m) => m !== acct);
    const away = { ...(party.away ?? {}) }; delete away[acct];
    if (!members.length) { await this._delParty(party.id); return null; }
    // AUDIT PARTY8: the longest-standing seat that is ONLINE - a lead handed to an away seat left nobody able to kick
    // for the whole of PARTY_OFFLINE_MS
    const leader = party.leader === acct ? (members.find((id) => this._socketsOf(id).length) ?? members[0]) : party.leader;
    const next = { ...party, members, leader, away };
    await this._putParty(next);
    for (const m of members) this._sayNote(m, code, acct, name);
    if (leaderNote && leader !== party.leader) { const lrec = await this._acct(leader); for (const m of members) this._sayNote(m, 'party.leader', leader, lrec?.name ?? null); }
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
    if (rec.friends.includes(them)) return 'already friends';
    if (hasEntry(rec.in, them)) return this._friendAccept(me, rec, them, now);   // they asked first: a request back is a yes
    if (hasEntry(rec.out, them)) return 'already asked';
    // AUDIT SOC A6: BY ACCOUNT alone is for someone on my lists (a request back, above); a stranger is met in the world
    // and asked by peer, or the hub is an oracle of which ids exist - said before any record is read, so it tells nothing
    if (m.acct) return 'meet them first';
    const trec = await this._acct(them);
    if (!trec) return 'no such player';
    if (rec.friends.length >= FRIENDS_MAX) return 'your friend list is full';
    if (trec.friends.length >= FRIENDS_MAX) return 'their friend list is full';
    if (rec.out.length >= PENDING_MAX) return 'too many requests out';
    if (trec.in.length >= PENDING_MAX) return 'their inbox is full';
    if (this._repeated(me, 'friend.request', them, now)) return 'already asked';   // AUDIT SOC A1: asked, cancelled, asked again - once per SOCIAL_REPEAT_MS reaches them
    const mine = { ...rec, out: [...rec.out, { acct: them, at: now }] };
    const theirs = { ...trec, in: [...trec.in, { acct: me, at: now }] };
    await this._putAccts({ [me]: mine, [them]: theirs });
    await this._sayState(me, mine, now); await this._sayState(them, theirs, now);
    this._sayNote(them, 'friend.requested', me, mine.name);
    return null;
  }
  async _friendAccept(me, rec, them, now) {
    if (!hasEntry(rec.in, them)) return 'no such request';
    const trec = await this._acct(them);
    if (!trec) { const mine = { ...rec, in: without(rec.in, them) }; await this._putAcct(me, mine); await this._sayState(me, mine, now); return 'no such player'; }
    if (rec.friends.length >= FRIENDS_MAX) return 'your friend list is full';
    if (trec.friends.length >= FRIENDS_MAX) return 'their friend list is full';
    const mine = { ...rec, in: without(rec.in, them), out: without(rec.out, them), friends: rec.friends.includes(them) ? rec.friends : [...rec.friends, them] };
    const theirs = { ...trec, in: without(trec.in, me), out: without(trec.out, me), friends: trec.friends.includes(me) ? trec.friends : [...trec.friends, me] };
    await this._putAccts({ [me]: mine, [them]: theirs });
    await this._sayState(me, mine, now); await this._sayState(them, theirs, now);
    this._sayNote(them, 'friend.accepted', me, mine.name);
    return null;
  }
  /** A decline (mine `in`, theirs `out`) or a cancel (mine `out`, theirs `in`): the request gone from both, quietly. */
  async _friendUnlist(me, rec, them, now, mineList, theirList) {
    if (!hasEntry(rec[mineList], them)) return 'no such request';
    const trec = await this._acct(them);
    const mine = { ...rec, [mineList]: without(rec[mineList], them) };
    const puts = { [me]: mine };
    let theirs = null;
    if (trec) { theirs = { ...trec, [theirList]: without(trec[theirList], me) }; puts[them] = theirs; }
    await this._putAccts(puts);
    await this._sayState(me, mine, now); if (theirs) await this._sayState(them, theirs, now);
    return null;
  }
  async _friendRemove(me, rec, them, now) {
    if (!rec.friends.includes(them)) return 'not a friend';
    const trec = await this._acct(them);
    const mine = { ...rec, friends: without(rec.friends, them) };
    const puts = { [me]: mine };
    let theirs = null;
    if (trec) { theirs = { ...trec, friends: without(trec.friends, me) }; puts[them] = theirs; }
    await this._putAccts(puts);
    await this._sayState(me, mine, now); if (theirs) await this._sayState(them, theirs, now);
    return null;
  }
  async _partyInvite(me, rec, m, now) {
    const t = this._targetOf(me, m);
    if (t.error) return t.error;
    const them = t.acct;
    if (m.acct && !rec.friends.includes(them)) return 'meet them first';   // AUDIT SOC A6: by account alone for a friend (who sees my presence anyway); anyone else is invited in the world, by peer - or 'they are not online' is an oracle on any id
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
    if (this._repeated(me, 'party.invite', them, now)) return 'already asked';   // AUDIT SOC A8: invited, declined, invited again - once per SOCIAL_REPEAT_MS reaches them
    const next = { ...party, invites: [...live, { acct: them, at: now }] };
    const theirs = { ...trec, invites: [...tinv, { party: party.id, from: me, at: now }] };
    await this._putParty(next);
    const puts = { [them]: theirs };
    if (made) puts[me] = mine;
    await this._putAccts(puts);
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
    const refuse = async (why) => { await this._putAcct(me, shed); await this._sayState(me, shed, now); return why; };
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
    await this._putAcct(me, mine);
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
    await this._putAcct(me, mine);
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
    await this._putAcct(me, next);
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
    if (trec) await this._putAcct(them, { ...trec, party: null });
    this._markParty(them, null);
    this._sayTo(them, JSON.stringify({ t: 'social', k: 'party', party: null }));
    this._sayNote(them, 'party.kicked', them, trec?.name ?? null);
    return null;
  }
}
