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

import { poseChanged, SOCKETS_MAX, WORLD_CELL, RANGE_PIXELS, PIXEL_UNITS, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, WORLD_FRAME_MAX, worldFrameMaxFor, isCellRoom, hitOwnerOf, validPose, validLook, sanitizeName, readBadge, sanitizeChat, chatGate, redGate, worldRoom, inRange, relayUrl, isWorldRoom, isChatRoom, foesGate, FOES_FRAME_MAX, MAX_FRAME_BYTES, hitGate, actGate, actFrameFits, whoGate, WHO_RETRY_MS, HEARTBEAT_MS, PING_MS, relayVersionOf, chatInGate, CHAT_ROOM_HZ_MAX, socialGate, partyGate, validPartyPose, validSocialFrame, validPartyFrame, PARTY_SEND_MS, validSocialAct, socialInGate, noteInGate, partyInGate, SOCIAL_IN_HZ_MAX, NOTE_IN_HZ_MAX, INBOUND_FRAME_MAX } from './wire.js';   // SOC2: the hub's law, at home; AUDIT SOC B3/B11/B20: the act's projection, the inbound gates, the inbound bound

export { WORLD_CELL, RANGE_PIXELS, worldRoom };

/** Poses a second, at most, when the pose moved. */
export const POSE_HZ = 10;
/** SLAM3 (2026-09-16, Mac: the 30th-anniversary slam): the floor the crowded rate falls to. Below this a walk reads
 *  as a series of hops however well it is eased. */
export const POSE_HZ_MIN = 4;
/** SLAM3: peers past which a room counts as a CROWD and the rate starts coming down. Under it nothing changes at
 *  all - ordinary play in the Bay is two or three people and must not pay for an event it is not having. */
export const POSE_CROWD = 24;
/** SLAM3: the bounds on a measured ease interval - a burst must not snap a peer, a silence must not make it crawl. */
/** ACC1d: the whole budget a hello will wait for an identity token.
 *  Past it the connection goes ahead unsigned. Short on purpose: this
 *  sits between the socket opening and the first frame, so it is time a
 *  player spends staring at nothing. */
export const TOKEN_WAIT_MS = 2500;

export const GAP_MIN_MS = 50;
export const GAP_MAX_MS = 1000;
/** SLAM3: HOW OFTEN TO SPEAK IN A CROWD.
 *
 *  SLAM1 bounded who hears a pose; this bounds how often one is said. The room's cost is senders x POSE_FAN_MAX x
 *  this, so it is the last of the three terms still fixed - and the one a client can lower without asking anybody.
 *
 *  The product is held roughly constant past the threshold: twice the crowd, half the rate. At 200 players that is
 *  4 Hz rather than 10, which takes a bounded room from 64k pose sends a second to 25.6k.
 *
 *  It costs smoothness, and that cost is paid on purpose: in a crowd of two hundred nobody is reading the gait of
 *  the person across the square, and a peer eased over its OWN observed interval (see `tick`) still walks rather
 *  than hops. */
export const poseHzFor = (peers) => (!(peers > POSE_CROWD) ? POSE_HZ : Math.max(POSE_HZ_MIN, Math.round((POSE_HZ * POSE_CROWD) / peers)));
/** A pose goes out at least this often, moved or not: the socket's keepalive and the peers' clock. SLAM13: its home is
 *  net/wire.js (the relay's keepalive floor is a fraction of it); re-exported here for the callers that always read it here. */
export { HEARTBEAT_MS, PING_MS };
/** SLAM9: the introductions a session remembers (`_known`) - two rooms' worth, the one I am in and the one I just
 *  left, so a blip in either stands its peers as themselves. Past it the stalest is forgotten. */
export const KNOWN_MAX = SOCKETS_MAX * 2;
/** The relay this port hosts (server/wrangler.toml). */
export const DEFAULT_SERVER = 'wss://daggerfall-online.mackcothran.workers.dev';
/** A peer silent this long is HIDDEN (out of range, or its socket is
 *  gone and the leave is on its way); only the room's leave removes it. */
// RELAY-H1: DERIVED from the heartbeat, never a literal beside it. The silence law hides a peer this long after its
// last pose; SLAM8/13 pin the ratio (a standing peer is heard at least three times before it could vanish), and a
// literal here went quietly wrong the day the heartbeat moved. Four heartbeats, the margin the 20000/5000 pair had.
export const PEER_TIMEOUT_MS = 4 * HEARTBEAT_MS;
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

/** Has a pose moved enough to send? Position by EPS units, angles by EPS radians.
 *  SLAM8: the body lives in net/wire.js now - the relay asks the same question of the same numbers (a pose this calls
 *  unmoved is a KEEPALIVE, which the relay must never tier), and a law both ends run has one home. Re-exported here so
 *  every caller and every pin that knows it as the session's keeps working. */
export { poseChanged };

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
export function keptToken(storage, key, re, mint) {   // SOC2: exported for the ACCOUNT's pair (net/social.js accountId) - the same keeping, another storage
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
  constructor({ url = DEFAULT_SERVER, name = 'Traveller', look = null, id = null, secret = null, presence = true, acct = null, asecret = null, mintToken = null, WebSocketImpl = globalThis.WebSocket, now = () => Date.now(), rand = Math.random } = {}) {
    this.url = relayUrl(url || DEFAULT_SERVER);   // wss:// anywhere, ws:// on localhost alone; anything else is no relay (A16/E11)
    this.secret = secret ?? peerSecret();
    // SOC2: the ACCOUNT rides the hello only when the caller hands both halves in - the hub link's alone (world.js
    // chatStart); a presence session names none, and a session made without them is a build before this slice to
    // the hub. NOT defaulted from storage the way the peer's pair is: a presence room must never be told an account.
    this.acct = acct && asecret ? acct : null;
    this.asecret = acct && asecret ? asecret : null;
    this.onSocial = null;         // SOC2: (frame) => void - a hub frame in, through the wire's door (validSocialFrame): state, presence, party, invite, note, error
    this.onParty = null;          // SOC2: (acct, p) => void - a party member's pose in (never my own account's back)
    this._sbucket = null;         // SOC2: the social acts' own gate at home (SOCIAL_HZ_MAX - an act the hub would drop is never sent)
    this._pbucket = null;         // SOC2: the party poses' own gate at home (PARTY_HZ_MAX)
    this._lastParty = null;       // SOC2: the last party pose that LEFT, and when - an unchanged one is not re-sent, and a socket that reopens re-sends the first (the hub's attachment is fresh)
    this._lastPartyAt = -Infinity;
    this.name = name;
    // ═══ ACC1d: THE IDENTITY TOKEN ═════════════════════════════════
    //
    // `mintToken` is an async () => string|null the HOST supplies - the
    // session does not know the account service exists and must not:
    // it is the wire's own object, and giving it a fetch would put the
    // account service in the reconnect path of every room and halo.
    //
    // One token per CONNECTION, minted just before the hello, because
    // the relay spends it once (F8) and a reused one is refused. A
    // session with no minter sends no token and is admitted exactly as
    // every build before this slice was.
    this.mintToken = mintToken;
    this.token = null;
    this.presence = !!presence;   // false: a channel's session (CHAT1) - no pose out, a ping for a heartbeat
    this.onChat = null;           // (line) => void: a chat line in - {id, name, text, at, mine}
    this.onRed = null;            // RED1: (line) => void: the SERVER's own line - {text, at}, no id and no name, because nobody is speaking it
    this.onFoes = null;           // WORLD2: (id, data) => void - the host's live foes in (a non-host's, from the room's host alone)
    this.onHit = null;            // WORLD2: (id, data) => void - a blow on my foe in (the host's, from anyone)
    this.onAct = null;            // WORLD3: (id, data) => void - a door, a lever or a platform moved by another in my room
    this._abucket = null;         // WORLD3: the actions' own gate at home (ACT_HZ_MAX)
    this._fbucket = null;         // WORLD2: the foes stream's own gate, the relay's law kept at home
    this._hbucket = null;         // AUDIT WORLD2 A6: the hits' own gate at home (HIT_HZ_MAX), so a blow never starves the poses at the relay
    this._wbucket = null;         // WORLD6b-iii(e): the asks' own gate at home (WHO_HZ_MAX)
    this._who = new Map();        // WORLD6b-iii(e): id -> when it was asked for (a stranger beyond the welcome's roster, asked once per WHO_RETRY_MS)
    this._askCursor = null;       // SLAM9: the last id the fair ask rotation (`_askRound`) reached - the next tick starts after it
    this._known = new Map();      // SLAM9: id -> { name, look } of every introduction this session has had, bounded at KNOWN_MAX - a stranger this session once knew is stood as itself
    this.host = null;             // WORLD1: the room's host, the relay's word; null until the welcome
    this.onHost = null;           // (id, mine) => void: the host changed
    this.onWorld = null;          // (world) => void: the welcome carried the room's memory, or the host published one after it (AUDIT WORLD34 C1)
    this.clockOffsetMs = 0;       // WORLD5: the relay's clock minus this machine's, from the welcome - the shared world time is read through it
    this.clockRead = false;       // AUDIT SOC B7: whether a welcome has said it - a channel's carries it since AUDIT SOC, and the hub link's is the clock the social picture reads
    this.clockWarning = null;     // OL3: the welcome's clock was a year off this machine's - said on the HUD line while it stands
    this.onClock = null;          // WORLD5: (offsetMs) => void - the welcome said the relay's clock
    // AUDIT-SRVN F4: there WAS a `this.relayVersion` here, written on every
    // welcome and read by nothing but its own test. Which relay this
    // socket is on is a question one home already answers
    // (net/updateNotice.js), and a second copy of it on the session is a
    // second source of truth for a question nobody was asking - the same
    // shape AUDIT-CHATR deleted `whoRows()` for. The hook is the whole
    // seam; the detector owns the memory.
    this.onRelay = null;          // SRV-N: (version) => void - a welcome named the relay's deploy
    this.roomCount = null;        // ROSTER-G: the welcome's `n` when its list was CUT - how many the room holds beyond the names it gave (a channel's; a place's welcome carries none)
    this.look = look ?? { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
    this.id = id ?? peerId();
    this._WS = WebSocketImpl;
    this._now = now;
    this._rand = rand;   // SLAM2: the retry's jitter - injected, as the clock is, so a pin can drive a whole crowd
    this.room = null;
    this.status = 'idle';      // idle | connecting | open | closed | error
    this.error = null;         // what went wrong, for a person
    this.terminal = false;     // the relay closed with a reason a retry will not change (replaced, refused)
    this.terminalAt = null;    // when it did (the session's clock): rejoin() waits on it
    this._cbucket = null;      // the client's own chat gate (AUDIT CHAT A8): the relay's law, run first
    this._rbucket = null;      // RED1: and the server line's own, well under it - the relay's law again, run first
    // CHAT-G: the gate on lines COMING IN, one bucket per room because
    // that is the unit the relay spends by. Room -> bucket; a room let go
    // drops its bucket with the rest of what that room meant (_forgetRoom).
    this._inChat = new Map();
    this._inChatSaid = false;  // the console says it ONCE - a flood must not become its own flood
    // AUDIT SOC B3: the same law for the hub's frames - the picture's (state, presence, party, invite) on one bucket per
    // room, the LINES (a note, an error - each a chat line nobody sent) on a tighter one, the other members' poses on a
    // third; an honest hub at full tilt passes whole (net/wire.js SOCIAL_IN_HZ_MAX, NOTE_IN_HZ_MAX, PARTY_IN_HZ_MAX)
    this._inSocial = new Map(); this._inNote = new Map(); this._inParty = new Map();
    this._inSocialSaid = false;
    this.peers = new Map();    // id -> { id, name, look, pose, from, at, shown, seenAt } - MERGED over every room held (WORLD6b-iii(b))
    this._rooms = new Map();   // WORLD6b-iii(b): room -> Set<id> - which rooms report which peers; a peer stays in `peers` while any room holds it
    this._halo = new Map();    // WORLD6b-iii(b): room -> { ws, status, retryAt, backoff } - the neighbouring cells within range (hello'd and posed into, listened to, never streamed to: my own cell's fan reaches everyone in range)
    this._ws = null;
    this._lastSent = null;
    this._lastSentAt = -Infinity;
    this._lastPingAt = -Infinity;   // RELAY-H1: the liveness ping's own clock - it must never delay the heartbeat pose
    this._pose = null;
    this._backoff = BACKOFF_MIN_MS;
    this._retryAt = null;
    this._closedByUs = false;
    this.stats = { sent: 0, poses: 0, received: 0, reconnects: 0, chats: 0, worlds: 0, foes: 0, hits: 0, acts: 0, threw: 0, chatsDropped: 0 };
    this.stats.socials = 0; this.stats.parties = 0;   // SOC2: the acts that left, the party poses that left (on their own line: AUDIT WORLD D12 pins the line above as it stands)
    this.stats.socialsDropped = 0; this.stats.partiesDropped = 0; this.stats.oversize = 0;   // AUDIT SOC B3/B20: hub frames and party poses refused at the inbound gates; frames dropped unparsed for their size
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
  /** SLAM6: `told` is whether this frame is the relay's own INTRODUCTION - a welcome's roster entry or a `join`,
   *  which carry the peer's name and look. A pose that stands a stranger is not one, and a peer stood by one is
   *  asked for (`_askWho`) until an introduction arrives. Keyed on the introduction rather than on the look because
   *  a look may legitimately be null (a client that hello'd without one), and that peer must not be asked for
   *  forever at WHO_RETRY_MS. */
  _member(room, id, p, now, told = true) {
    this._roomSet(room).add(id);
    const have = this.peers.get(id);
    if (have) { if (have.unconfirmed) this._confirm(have, room); if (told) this._refresh(have, p, now); return; }   // SLAM14 B2: named or heard here - confirmed here
    // SLAM9: A STRANGER THIS SESSION ONCE KNEW IS STOOD AS ITSELF. The welcome names the nearest ROSTER_MAX and prunes
    // the rest of the room's roster (the merge-not-wipe law is about the peers it DOES name); so one socket blip -
    // a Wi-Fi hiccup, a Durable Object eviction - dropped everyone past the nearest 64, and their next pose re-stood
    // each of them nameless and look-less, to be asked for all over again. Measured: 199 named and dressed before the
    // blip, 64 after the welcome, 135 anonymous "Travellers" a moment later. An introduction is a fact about an ID,
    // not about a socket, so it is kept (`_known`, bounded) and a re-stood stranger wears it at once, told.
    // SLAM14 (AUDIT SLAM FINAL B3): AND IS ASKED FOR ONCE MORE. This line used to say the join fan keeps a remembered
    // look current because a peer re-hellos when its gear changes - and it does not: a look is sent with the hello
    // alone, so a peer that changed its gear between two rooms, or during the blip, wore its old look here for as
    // long as it stayed. A peer stood from memory is `told` (drawn dressed at once, its
    // bodies stood, its foes trusted) and `recall`: `_askRound` walks it as it walks a stranger, the relay's join
    // answers with the look it holds now, and `_refresh` clears the flag. One ask per re-stood peer, at the who gate.
    const knew = told ? null : this._known.get(id);
    const made = this._peer(knew ? { ...p, name: knew.name, title: knew.title, glyphs: knew.glyphs, look: knew.look } : p, now);
    made.told = told || !!knew;
    made.recall = !told && !!knew;
    if (told) this._remember(id, made);
    this.peers.set(id, made);
  }
  _roomSet(room) {
    let s = this._rooms.get(room);
    if (!s) this._rooms.set(room, s = new Set());
    return s;
  }
  /** SLAM9: the introductions this session has had, newest last, bounded at KNOWN_MAX (two rooms' worth: the one I am
   *  in and the one I just left) - past it the oldest is forgotten. Re-inserted on every introduction so the bound
   *  forgets by staleness, not by first sight. */
  _remember(id, p) {
    this._known.delete(id);
    this._known.set(id, { name: p.name, title: p.title, glyphs: p.glyphs, look: p.look });
    if (this._known.size > KNOWN_MAX) this._known.delete(this._known.keys().next().value);
  }
  _held(id) { for (const s of this._rooms.values()) if (s.has(id)) return true; return false; }
  /** WORLD6b-iii(e): a frame from an id I hold in NO room - a member beyond the welcome's roster (ROSTER_MAX bounds the
   *  welcome, the nearest; a room holds up to SOCKETS_MAX) whose pose, foes or blow reached me through the relay, which
   *  relays only a hello'd socket's frames. Asked for by name through the socket the frame came on, once per
   *  WHO_RETRY_MS per id and WHO_HZ_MAX a second in all; the relay answers with its join, and the next frame is a
   *  peer's. An ask that cannot be sent (no open socket, the gate) is not marked, so the next frame asks.
   *  SLAM9: a POSE no longer asks from here - `_askRound` does, from tick(), fairly. See it for why. A foes frame or a
   *  blow from a stranger still asks at once: those are rare and the answer is wanted this frame. */
  _askWho(room, id, now) {
    // SLAM6: asked while the peer has not been INTRODUCED, not while it is absent. A stranger's pose now stands the
    // peer at once (`_receive`), so `peers.has(id)` became true on the very first frame and the ask that would have
    // learned its name and its gear was never made again.
    const held = this.peers.get(id);
    if (typeof id !== 'string' || id === this.id || (held?.told && !held.recall)) return false;   // SLAM14 B3: a peer stood from memory is told AND asked once more
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
  /** SLAM9: THE ASK IS A FAIR ROTATION, NOT A REACTION. It used to fire from every stranger's pose as it arrived, and
   *  the far tier delivers those in a STABLE order (a rank), so the same head of that order re-qualified after
   *  WHO_RETRY_MS and won the WHO_HZ_MAX token every time. Measured over a real session, 199 peers, 135 strangers,
   *  ten minutes: 3,004 asks sent, 54 distinct ids ever asked, 81 never asked once - flat from the first minute to the
   *  tenth. Not slow: STUCK. Reshuffling the arrival order made it 135 of 135, which is the proof the order was the
   *  cause. So the asks come from here instead, once a tick, walking every un-introduced peer in turn from where the
   *  last tick stopped, skipping any asked inside WHO_RETRY_MS and stopping when the gate is dry. Every stranger is
   *  reached once per pass, whatever order its poses arrive in; a pass over a full room is ~27 s at WHO_HZ_MAX. */
  _askRound(now) {
    if (!whoGate(this._wbucket, now).pass) return;   // a peek, not a spend: no token this tick, nothing to walk
    const ids = [];
    for (const [id, p] of this.peers) if (!p.told || p.recall) ids.push(id);   // SLAM14 B3: and the ones wearing a remembered look
    if (!ids.length) { this._askCursor = null; return; }
    const from = this._askCursor ? ids.indexOf(this._askCursor) + 1 : 0;   // -1 + 1 = 0 when the cursor's peer is gone
    for (let k = 0; k < ids.length; k++) {
      const id = ids[(from + k) % ids.length];
      if (this._askWho(this.peers.get(id)?.heardIn ?? this.room, id, now)) { this._askCursor = id; continue; }
      if (!whoGate(this._wbucket, now).pass) return;   // the gate is why: done until it refills
      // otherwise `_askWho` declined for its own reasons - inside WHO_RETRY_MS, or no socket for that room right now -
      // and the next id may be due, or heard through another room
    }
  }
  _unmember(room, id) {
    this._rooms.get(room)?.delete(id);
    const p = this.peers.get(id);
    if (p?.unconfirmed) this._confirm(p, room);   // SLAM14 B2: gone from this room is an answer too
    if (!this._held(id)) this.peers.delete(id);
  }
  /** SLAM14 B2: this room has heard from the peer since its welcome left it unnamed - the stamp goes. */
  _confirm(p, room) {
    delete p.unconfirmed[room];
    if (!Object.keys(p.unconfirmed).length) p.unconfirmed = null;
  }
  _forgetRoom(room) {
    const s = this._rooms.get(room);
    this._rooms.delete(room);
    this._inChat.delete(room);   // CHAT-G: a room let go takes its bucket with it, or a long session accumulates one per cell it ever walked through
    this._inSocial.delete(room); this._inNote.delete(room); this._inParty.delete(room);   // AUDIT SOC B3: and the hub's three
    if (s) for (const id of s) if (!this._held(id)) this.peers.delete(id);
  }
  _openHalo(room, backoff = BACKOFF_MIN_MS) {
    if (!this.url || !this._WS) return;
    let ws;
    // AUDIT WORLD6b-iii(b) A7: a socket that cannot be made is an entry with a retry, not nothing (nothing was re-tried every frame)
    try { ws = new this._WS(`${this.url}/room/${room}`); } catch { this._halo.set(room, { ws: null, status: 'closed', retryAt: this._now() + BACKOFF_MIN_MS + this._rand() * Math.max(BACKOFF_MIN_MS, backoff - BACKOFF_MIN_MS), backoff: Math.min(BACKOFF_MAX_MS, backoff * 2), since: this._now() }); return; }   // SLAM5 (AUDIT SLAM): jittered like the other two halo paths - SLAM2 claimed all three and treated only two
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

  /** The hello as the wire has it - the account beside the peer when this session holds one (SOC2: the hub link's;
   *  a session without it sends the hello every build before SOC1 sent, key for key). */
  _helloFrame() {
    const frame = { t: 'hello', id: this.id, secret: this.secret, name: this.name, look: this.look, pose: this.presence ? this._pose : null };
    // ACC1d: only when there IS one. A `tok: null` would be a malformed
    // token rather than an absent one, and wire.js refuses that - which
    // is right, and is why the key is not written at all when empty.
    if (this.token) frame.tok = this.token;
    if (this.acct && this.asecret) { frame.acct = this.acct; frame.asecret = this.asecret; }
    return frame;
  }

  /** ACC1d: one token, or null, and never a throw and never a hang.
   *  TOKEN_WAIT_MS is the whole budget: past it the hello goes without
   *  one, which is a connection that works and a name the relay will
   *  not vouch for - strictly better than a player who cannot connect
   *  because a second Worker is having a bad minute. */
  async _mint() {
    try {
      return await Promise.race([
        Promise.resolve(this.mintToken()).catch(() => null),
        new Promise((r) => setTimeout(() => r(null), TOKEN_WAIT_MS)),
      ]);
    } catch { return null; }
  }

  /** The one handler set for a socket, the primary's or a halo's - the role is read at event time (_roomOf). */
  _bind(ws) {
    ws.onopen = async () => {
      const room = this._roomOf(ws);
      if (room == null) return;
      // ACC1d: A FRESH TOKEN PER CONNECTION, minted here because the
      // relay spends each one once. Awaiting before the hello is safe -
      // the relay says nothing until it has heard one - and it is
      // BOUNDED and SWALLOWED: an account service that is slow or down
      // must cost a connection a moment, never the connection itself.
      // A session with no token is admitted as every build before this
      // slice was (bible ACC1d D1).
      if (this.mintToken) {
        this.token = await this._mint();
        // the socket may have been replaced or closed while we waited
        if (this._roomOf(ws) == null) return;
      }
      const frame = this._helloFrame();
      const hello = JSON.stringify(frame);
      if (room === this.room) {
        this.status = 'open'; this.error = null;   // SLAM12: `_backoff` is reset by the WELCOME (`_receive`), not here - see there
        this._lastSent = null; this._lastSentAt = -Infinity;
        this._lastParty = null; this._lastPartyAt = -Infinity;   // SOC2: a fresh socket is a fresh attachment at the hub - the next party pose goes whole
        this._send(frame);
        if (!this.presence) this._lastSentAt = this._now();   // the heartbeat clock starts at the hello
      } else {
        const h = this._halo.get(room);
        h.status = 'open'; h.retryAt = null;   // SLAM12: a halo's backoff is reset by its welcome too
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
        h.retryAt = this._now() + BACKOFF_MIN_MS + this._rand() * Math.max(BACKOFF_MIN_MS, h.backoff - BACKOFF_MIN_MS); h.backoff = Math.min(BACKOFF_MAX_MS, h.backoff * 2);   // SLAM2: jittered
        return;
      }
      this._ws = null;
      this._setHost(null);   // AUDIT WORLD2 A2/C2: a dead socket holds no seat - the host is unknown until the next welcome, and the world host hears it (onHost)
      // SLAM12 (AUDIT SLAM): a TERMINAL close forgets the room's peers - no reconnect is coming, and 199 stale records
      // would otherwise be eased by every tick and counted by poseHzFor for the life of the page. A plain drop keeps
      // them ON PURPOSE: through a one-second blip the crowd stays drawn where it was rather than vanishing and
      // re-standing, and the reconnect's welcome merges over it (AUDIT ONLINE B13).
      if (code === CLOSE_REPLACED) { this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = 'this character is online in another window'; this._endHalo(); this._forgetRoom(this.room); return; }   // AUDIT WORLD6b-iii(b) A4
      if (code === CLOSE_POLICY) { this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = this.error ?? 'the relay refused a frame'; this._endHalo(); this._forgetRoom(this.room); return; }
      if (code === CLOSE_BUSY) { this.status = 'closed'; this.error = 'the room is busy'; this._backoff = Math.max(this._backoff, BACKOFF_MAX_MS / 2); this._scheduleRetry(); return; }   // full or gated: back off hard, then try again
      this.status = 'closed';
      if (!this._closedByUs) this._scheduleRetry();
    };
    ws.onerror = () => { const room = this._roomOf(ws); if (room === this.room && room != null) { this.status = 'error'; this.error = 'socket error'; } };
  }

  /** SLAM2 (2026-09-16, Mac: Daggerfall's 30th, a streamer's server slam): THE RETRY IS JITTERED.
   *
   *  A room admits HELLO_HZ_MAX hellos a second and refuses the rest with CLOSE_BUSY, which is correct - but every
   *  client refused in the same instant then waited the SAME `_backoff` and came back in the same instant, so the
   *  wave stayed a wave. A stream saying "everyone go here now" is exactly that: hundreds of clients whose retries
   *  are phase-locked from the first refusal, re-colliding at 1s, 2s, 4s, 8s, for as long as it takes - and each
   *  collision spends the room's hello budget on frames it must refuse, which starves the players it could have
   *  admitted.
   *
   *  The fix is the standard one and it is one line: spread the retry uniformly over the window instead of firing
   *  at the end of it. The backoff still DOUBLES, so a relay that is genuinely down is not hammered (driven).
   *
   *  The floor is BACKOFF_MIN_MS so a jittered retry is never an instant one.
   *
   *  AUDIT SLAM WITHDREW TWO CLAIMS THAT STOOD HERE, and both mattered.
   *
   *  "Measured over real sessions against the real relay, a 300-client wave drains in a fraction of the time and
   *  stops re-colliding" - THERE IS NO SUCH HARNESS, in test/ or in tools/, and this slice's own record says the pin
   *  cannot be written against test/fakeRoom.mjs at all. It was the fourth invented performance figure this project
   *  has had to take back. What is pinned here is the client's arithmetic, and nothing about a drain time.
   *
   *  "What changes is that two clients which were refused together no longer return together" - true from the SECOND
   *  retry on, and false for the first, which is the one a wave collides on. `_backoff` starts at BACKOFF_MIN_MS, so
   *  `_backoff - BACKOFF_MIN_MS` is exactly zero and `rand()` is multiplied by nothing: measured over 200 sessions
   *  dropped together, one distinct return instant. Only the CLOSE_BUSY path is jittered on its first retry, because
   *  that path alone raises `_backoff` before scheduling. Recorded, not yet paid (AUDIT SLAM item 5). */
  _scheduleRetry() {
    if (this._closedByUs || this.terminal || !this.room) return;
    // SLAM12 (AUDIT SLAM): THE FIRST RETRY HAS A SPAN. `_backoff` starts at BACKOFF_MIN_MS, so `_backoff - BACKOFF_MIN_MS`
    // was exactly zero on the first retry and `rand()` was multiplied by nothing: measured over 200 sessions dropped in
    // the same instant, ONE distinct return instant. SLAM2's jitter began on the second retry, and a wave collides on
    // the first - a relay restart, a Durable Object eviction, the `room full` 503 (which never opens the socket, so
    // `_backoff` is never raised). The floor of the span is now BACKOFF_MIN_MS: round one is uniform over [1 s, 2 s],
    // every later round is what it was.
    const span = Math.max(BACKOFF_MIN_MS, this._backoff - BACKOFF_MIN_MS);
    this._retryAt = this._now() + BACKOFF_MIN_MS + this._rand() * span;
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
    if (now - this._lastSentAt < 1000 / poseHzFor(this.peers.size)) return false;   // SLAM3: a crowd is spoken to less often

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

  /** RED1: THE SERVER'S OWN LINE OUT. Mac: "a red text system (kind of
   *  like warframe) where I can message chat as the server."
   *
   *  THIS SIDE DOES NOT ASK WHETHER IT MAY. Whether this socket can
   *  speak as the server is a question about the token's signature and
   *  only the relay holds the key - so a client that checked its own
   *  glyphs first would be a second copy of an authority it does not
   *  hold, and a wrong one the moment a grant lapses. It sends; the
   *  relay ignores it from anybody it did not sign for.
   *
   *  Gated here as the relay gates it, so a line the relay would drop
   *  without a word is refused here with a false and the sender keeps
   *  their text - `sendChat`'s own law, for the same reason. */
  sendRed(text) {
    const line = sanitizeChat(text);
    if (!line) return false;
    const gate = redGate(this._rbucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'say', text: line })) return false;
    this._rbucket = gate.bucket;
    return true;
  }

  /** SOC2: a social act out - to the hub, from a session that holds an account: `{k, acct?|peer?|party?}` as
   *  net/wire.js SOCIAL_ACTS has it, gated here as the hub gates it (SOCIAL_HZ_MAX - an act the hub would drop without
   *  a word is refused here with a false, and the panel keeps its button lit); false when nothing went. */
  sendSocial(act) {
    if (!this.acct) return false;
    // AUDIT SOC B11: the wire's OWN projection, run here first (net/wire.js validSocialAct - the hub's parser runs the
    // same one). An act the hub's parser refuses is a CLOSE ('bad social' is CLOSE_POLICY), so a kind with no law, a
    // target named twice or not at all, or an id outside the wire's law never leaves this machine.
    const shaped = validSocialAct(act);
    if (!shaped) return false;
    const gate = socialGate(this._sbucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'social', ...shaped })) return false;
    this._sbucket = gate.bucket;   // the token is spent only on an act that left
    this.stats.socials++;
    return true;
  }

  /** SOC2: my party pose out - projected by the wire's own law first (what the hub would refuse is never sent), no
   *  sooner than PARTY_SEND_MS after the last, and only when it CHANGED (a member standing still with steady vitals
   *  costs the hub nothing; the hub keeps the last on the attachment, and a reopened socket sends the first one whole
   *  because `_helloFrame`'s door forgets the last). `force` sends an unchanged one - the caller's own heartbeat, if it
   *  wants one. False when nothing went. */
  sendParty(p, { force = false } = {}) {
    if (!this.acct) return false;
    const pose = validPartyPose(p);
    if (!pose) return false;
    const now = this._now();
    if (now - this._lastPartyAt < PARTY_SEND_MS) return false;
    const s = JSON.stringify(pose);
    if (!force && this._lastParty === s) return false;
    const gate = partyGate(this._pbucket, now);
    if (!gate.pass) return false;
    if (!this._send({ t: 'party', p: pose })) return false;
    this._pbucket = gate.bucket; this._lastParty = s; this._lastPartyAt = now; this.stats.parties++;
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
    // AUDIT SOC B20: a frame wider than an honest relay's widest (net/wire.js INBOUND_FRAME_MAX) is dropped UNPARSED -
    // the parse of a relay's megabytes was the one cost no door below could bound, and the relay is the player's choice
    if (typeof data === 'string' && data.length > INBOUND_FRAME_MAX) { this.stats.oversize++; return; }
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    this.stats.received++;
    const now = this._now();
    const primary = room === this.room;   // WORLD6b-iii(b): a halo room's frames place its peers and carry a peer's foes and blows; the host, the clock and the memory are my own room's alone
    if (m.t === 'welcome') {
      // SLAM12 (AUDIT SLAM): THE BACKOFF IS RESET HERE, BY THE WELCOME, AND NOT BY THE SOCKET OPENING. A full room's
      // CLOSE_BUSY arrives AFTER the socket opens (the relay's hello gate), so a reset at `onopen` undid the hard
      // back-off CLOSE_BUSY had just set: a client against a busy room retried at a fixed 2500 ms for ever, and the
      // doubling SLAM2 was written for never happened in the one case it was written for. A welcome is the relay
      // saying yes; that is when the retry ladder starts over.
      if (primary) this._backoff = BACKOFF_MIN_MS; else { const h = this._halo.get(room); if (h) h.backoff = BACKOFF_MIN_MS; }
      // SRV-N: WHICH RELAY IS THIS. Read ABOVE the `primary` gate below on purpose - a halo room's welcome comes off
      // the same Worker as my own room's, and a chat channel's welcome is the only one a chat link ever gets, so
      // gating this on the primary room would have made the chat's own sessions blind to the restart that just
      // dropped them. A relay before this slice carries no `v` at all and is left alone (updateNotice.js: 'unknown').
      // AUDIT-SRVN F1: through the wire's own law, like every other field
      // a welcome carries - a relay is the PLAYER'S choice (`?server=`,
      // the menu's Relay field), so its deploy name is not our word.
      const relayV = relayVersionOf(m.v);
      if (relayV) this._deliver('relay', () => this.onRelay?.(relayV));
      // merged, not wiped: a peer already known keeps where it is drawn
      const keep = new Set();
      for (const p of Array.isArray(m.peers) ? m.peers : []) {
        if (!p || typeof p.id !== 'string' || p.id === this.id) continue;
        keep.add(p.id);
        this._member(room, p.id, p, now);
      }
      // SLAM14 (AUDIT SLAM FINAL B2/C4): THE ONES THE ROSTER DOES NOT NAME ARE NOT DROPPED - they are UNCONFIRMED. The
      // roster names the nearest ROSTER_MAX, so on a reconnect this line `_unmember`ed everyone past the nearest 64
      // - measured, 135 of 199 - and their next pose re-stood each (dressed, since SLAM9) a round trip later: a
      // room-wide blink on every blip, when a welcome is the relay saying who is NEAR, not who is HERE. A peer the
      // welcome did not name keeps standing and is stamped `unconfirmed` for this room; its next pose or join in
      // this room confirms it (`_confirm`), and one that never speaks again goes when the silence law would have
      // hidden it anyway (`tick`: PEER_TIMEOUT_MS since it was last seen) - so a peer that left while I was away is
      // pruned, and nobody who is here blinks.
      for (const id of [...(this._rooms.get(room) ?? [])]) if (!keep.has(id)) { const p = this.peers.get(id); if (p) (p.unconfirmed ??= {})[room] = now; }
      // ROSTER-G: a channel's welcome says how many are in it (`n`); the list may be cut at CHAT_ROSTER_MAX, the count
      // is not. Kept ONLY when the list was cut - a whole list counts itself, and a number that outlives the rows goes
      // stale on the first leave (the browser run that found this: three rows, one left, the header still said three).
      // While kept, every join and leave the channel says moves it, so it stays the room's count.
      this.roomCount = Number.isFinite(m.n) && m.n > keep.size + 1 ? m.n : null;
      if (!primary) return;
      this._setHost(m.host);   // WORLD1: the room's host, and the room's memory when it keeps one
      if (Number.isFinite(m.now)) {   // WORLD5: the relay's clock - a year off is no clock; OL3: and is SAID, on the console and the HUD line, rather than run uncorrected in silence
        if (Math.abs(m.now - Date.now()) < 366 * 24 * 3600 * 1000) { this.clockOffsetMs = m.now - Date.now(); this.clockRead = true; this.clockWarning = null; this._deliver('clock', () => this.onClock?.(this.clockOffsetMs)); }
        else if (!this.clockWarning) { this.clockWarning = CLOCK_WARNING; console.warn(`[online] ${CLOCK_WARNING} (relay ${new Date(m.now).toISOString()}, this machine ${new Date().toISOString()})`); }
      }
      if (m.world && typeof m.world === 'object' && !Array.isArray(m.world)) this._deliver('world', () => this.onWorld?.(m.world));
      // SKEW1 (2026-09-16, Mac: "when the relay deploys/server restarts, there are 2 strings of messages that happen
      // outside of the chat box"): SLAM13 A5 compared `v` with this client's RELAY_VERSION here and put a warning on
      // `statusLine` - which the HUD draws top-left for the presence session AND under the chat box for the chat
      // link: two lines, outside the chat, for every player. And the skew it named is the ORDINARY state of a deploy:
      // the relay's drift-deploy landed world75 at 15:00:10 and the client build at 15:02:37, so every reconnect in
      // between saw it, and every tab already open kept it until a reload. SRV-N's notice (above, `onRelay`) already
      // says the server restarted, its build poll already says when to reload, and the drift-deploy closes the one
      // case left (a relay behind its client). The comparison is gone; `v` is SRV-N's to read.
    } else if (m.t === 'host') {
      if (primary) this._setHost(m.id);
    } else if (m.t === 'world') {
      // AUDIT WORLD34 C1: the room's memory pushed after the welcome - the host's alone (the relay says whose), never my own back
      if (primary && typeof m.id === 'string' && m.id === this.host && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this._deliver('world', () => this.onWorld?.(m.data));
    } else if (m.t === 'foes') {
      // WORLD2: the host's live foes - the room's host's alone (a stale frame from a host that just left is not the world)
      // WORLD6b: in a cell every peer's frame is its own foes; in a world room the host's alone
      // AUDIT WORLD6b A8/C6: in a cell a frame is a PEER's - one the roster holds; past ROSTER_MAX a stranger's frames stood puppets the prune took back every frame
      // SLAM6: `told`, not `has`. A stranger's POSE now stands the peer at once, so `has` alone would have let its
      // FOES through on the same frame and re-opened AUDIT WORLD6b A8/C6 - a stream trusted from an id the relay has
      // not yet named. A pose is one figure standing where it says it is; a foes frame is a whole pool, and that
      // still waits for the introduction.
      if (typeof m.id === 'string' && (isCellRoom(this.room) ? !!this.peers.get(m.id)?.told : m.id === this.host) && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this._deliver('foes', () => this.onFoes?.(m.id, m.data));
      else if (isCellRoom(this.room)) this._askWho(room, m.id, now);   // WORLD6b-iii(e): a stranger's foes - asked for, its frames a peer's once the join lands
    } else if (m.t === 'hit') {
      // WORLD2: a blow on my foe - mine to apply only while I host
      // WORLD6b: in a cell a blow is mine when it names me (the relay routed it, and the frame says so); in a world room while I host
      if ((isCellRoom(this.room) ? hitOwnerOf(m.data) === this.id : this.isHost()) && typeof m.id === 'string' && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) { this._deliver('hit', () => this.onHit?.(m.id, m.data)); if (isCellRoom(this.room)) this._askWho(room, m.id, now); }   // WORLD6b-iii(e): a stranger's blow lands (the relay routed it to me) and the striker is asked for, so my foe finds its candidate
    } else if (m.t === 'act') {
      // WORLD3: a door, a lever or a platform moved by another in my world room - never my own back, never outside one
      if (primary && isWorldRoom(this.room) && typeof m.id === 'string' && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this._deliver('act', () => this.onAct?.(m.id, m.data));
    } else if (m.t === 'join') {
      if (typeof m.id === 'string' && m.id !== this.id) { if (this.roomCount != null && !this.peers.has(m.id)) this.roomCount++; this._member(room, m.id, m, now); }   // ROSTER-G: a cut count follows the joins
    } else if (m.t === 'leave') {
      if (typeof m.id === 'string') { if (this.roomCount != null && this._rooms.get(room)?.has(m.id)) this.roomCount = Math.max(0, this.roomCount - 1); this._unmember(room, m.id); }   // WORLD6b-iii(b): gone from THIS room - kept while another holds it; ROSTER-G: and a cut count follows the leaves
    } else if (m.t === 'pose') {
      // WORLD6b-iii(e): a stranger's pose - a member beyond the welcome's roster, asked for.
      // SLAM6: AND STOOD WHERE IT SAYS IT IS, THIS FRAME. The pose used to be dropped until the `who` answered, and
      // the who is the room's scarcest arm (WHO_HZ_MAX here, WHO_ROOM_HZ_MAX at the relay) - at a full room it is
      // minutes before a stranger is drawn at all, which would have left SLAM6's far tier reaching people nothing
      // could yet draw. A peer with no look composes the doll a look-less peer composes (net/remotePlayers.js
      // peerStubEntity), and every stranger shares that ONE doll until its own answer lands.
      const pose = validPose(m.p);
      if (!pose || typeof m.id !== 'string' || m.id === this.id) return;
      // SLAM9: A POSE IS PROOF OF MEMBERSHIP IN THE ROOM IT ARRIVED ON. `_rooms` was written by a welcome or a join
      // alone, so a peer introduced in my own cell and posing through a halo was never a member of the halo - and the
      // cell's `leave` deleted her while she stood, alive, in the next room over; her next pose re-stood her as a
      // stranger. Every room a peer speaks in holds it now, and `leave` is per room, as WORLD6b-iii(b) meant.
      this._roomSet(room).add(m.id);
      const p = this.peers.get(m.id);
      if (p) {
        // SLAM14 (AUDIT SLAM FINAL B1): `heardIn` FOLLOWS THE POSES. It was stamped once, on the pose that stood the
        // stranger, so a peer first heard through my own cell and since heard only through a halo - it walked over
        // the seam - was still asked for down the cell's socket, where the relay no longer holds it and answers
        // nothing; that stranger stayed nameless for as long as it kept to the next room. The ask goes down the socket
        // its latest pose came on.
        if (!p.told || p.recall) p.heardIn = room;
        if (p.unconfirmed) this._confirm(p, room);   // SLAM14 B2: a pose is proof it is still here
        this._arrive(p, pose, now); return;
      }
      this._member(room, m.id, { id: m.id, name: null, look: null, pose: m.p }, now, false);   // sanitizeName's own default stands over its head until the answer lands
      const stood = this.peers.get(m.id);
      if (stood && (!stood.told || stood.recall)) stood.heardIn = room;   // the socket the ask goes down (`_askRound`) - the one this stranger is heard through
    } else if (m.t === 'chat') {
      // CHAT1: checked by the relay's own law (B7) - the id's shape, the name's, the line's; `mine` is the sender's own line back
      const text = typeof m.text === 'string' ? sanitizeChat(m.text) : '';
      if (typeof m.id !== 'string' || !text) return;
      // CHAT-G: ...and COUNTED, which for a year nothing did. The relay a
      // client talks to is the player's choice (`?server=`, the menu's
      // Relay field), so "the relay already gated this" is a sentence
      // about an honest relay only - and net/chat.js keeps CHAT_KEEP
      // lines, so an ungated stream is a player's history deleted. The
      // rate is the relay's OWN per-room spend, so an honest room at full
      // tilt passes whole and the first frame refused is one no honest
      // relay would have sent.
      const g = chatInGate(this._inChat.get(room), now);
      this._inChat.set(room, g.bucket);
      if (!g.pass) {
        this.stats.chatsDropped++;
        if (!this._inChatSaid) {
          this._inChatSaid = true;
          console.warn(`[online] chat from ${room} is arriving faster than ${CHAT_ROOM_HZ_MAX}/s - lines are being dropped. An honest relay does not do this.`);
        }
        return;
      }
      // ACC1d: the line carries the relay's verdict on the NAME beside it,
      // because a chat log is where a name is read and an impersonation
      // is worth doing. A hard boolean for the same reason `_peer` keeps
      // one: never a "maybe".
      this._deliver('chat', () => this.onChat?.({ id: m.id, name: sanitizeName(m.name), text, at: Number.isFinite(m.at) ? m.at : now, mine: m.id === this.id }));
    } else if (m.t === 'red') {
      // RED1: THE SERVER SPEAKING, and the client knows it by the FRAME
      // TYPE rather than by anything on the frame. net/chat.js's own
      // note is the reason: a notice recognised by a name would be one
      // rename away from a player faking one, so this line carries no
      // id and no name at all and there is nothing on it to forge.
      //
      // GATED COMING IN like a chat line, on the SAME bucket, because
      // the relay a client talks to is the player's own choice
      // (`?server=`, the Relay field) - "the relay already gated it" is
      // a sentence about an honest relay only, and this is the one line
      // type a dishonest one would most want to flood.
      const text = typeof m.text === 'string' ? sanitizeChat(m.text) : '';
      if (!text) return;
      const g = chatInGate(this._inChat.get(room), now);
      this._inChat.set(room, g.bucket);
      if (!g.pass) { this.stats.chatsDropped++; return; }
      this._deliver('chat', () => this.onRed?.({ text, at: Number.isFinite(m.at) ? m.at : now }));
    } else if (m.t === 'social') {
      // AUDIT SOC B3: GATED COMING IN, as a chat line is (CHAT-G) - a note or an error becomes a chat line (net/chat.js
      // keeps CHAT_KEEP of them, so an ungated stream is a player's history deleted) and the rest a repaint; the
      // rates are the wire's own, an honest hub at full tilt passes whole, and the console says a flood ONCE
      const line = m.k === 'note' || m.k === 'error';
      const g = line ? noteInGate(this._inNote.get(room), now) : socialInGate(this._inSocial.get(room), now);
      (line ? this._inNote : this._inSocial).set(room, g.bucket);
      if (!g.pass) {
        this.stats.socialsDropped++;
        if (!this._inSocialSaid) { this._inSocialSaid = true; console.warn(`[online] hub frames from ${room} are arriving faster than ${line ? NOTE_IN_HZ_MAX : SOCIAL_IN_HZ_MAX}/s - frames are being dropped. An honest hub does not do this.`); }
        return;
      }
      // SOC2: the hub's word on my friends and my party - through the wire's door (validSocialFrame: CHAT-G's law, the
      // relay is the player's choice and a frame it shapes is dropped whole), delivered contained like every handler
      const f = validSocialFrame(m);
      if (f) this._deliver('social', () => this.onSocial?.(f));
    } else if (m.t === 'party') {
      // AUDIT SOC B3: the other members' poses, at PARTY_IN_HZ_MAX (three members at PARTY_HZ_MAX each) - per room
      const g = partyInGate(this._inParty.get(room), now);
      this._inParty.set(room, g.bucket);
      if (!g.pass) { this.stats.partiesDropped++; return; }
      // SOC2: a party member's pose - never my own account's back (a second tab of mine is not a member to draw; the
      // hub fans to the other members' sockets, and this is the belt for a relay that does not)
      const f = validPartyFrame(m);
      if (f && f.acct !== this.acct) this._deliver('party', () => this.onParty?.(f.acct, f.p));
    } else if (m.t === 'error') {
      this.status = 'error'; this.error = String(m.m ?? 'relay error');
    }
  }

  _peer(p, now) {
    const pose = validPose(p.pose);
    // ACC1g: no `v` on a peer any more - the relay refuses a hello it
    // cannot verify, so every peer in the room is one it verified and a
    // per-peer verdict said the same thing about all of them.
    // ACC3: and the badge, through the wire's own reader - `readBadge`
    // is the inverse of the `badged` the relay wrote, so the vocabulary
    // is checked in ONE place rather than spelled again here. It always
    // answers a title or null and a list or empty, so nothing below
    // ever has to tell "absent" from "none".
    const { title, glyphs } = readBadge(p);
    return { id: p.id, name: sanitizeName(p.name), title, glyphs, look: validLook(p.look), told: true, pose, from: pose, at: now, seenAt: now, shown: pose ? { ...pose } : null };
  }

  /** A known peer said hello again: its name and look are the new ones, its pose arrives as any other. */
  _refresh(p, m, now) {
    p.name = sanitizeName(m.name); p.look = validLook(m.look); p.told = true; p.recall = false;   // SLAM6: an introduction, so the asks stop (SLAM14: the recall's too)
    // ACC3: THE NEWEST HELLO'S BADGE, whatever it is - including none.
    // A player who takes a title off and reconnects must lose it here
    // too, and a peer that kept the FIRST badge it was ever seen with
    // would be wearing a grant the relay has stopped vouching for.
    ({ title: p.title, glyphs: p.glyphs } = readBadge(m));
    this._remember(p.id, p);   // SLAM9: and it is kept, so a blip cannot un-introduce it
    const pose = validPose(m.pose);
    if (pose) this._arrive(p, pose, now); else p.seenAt = now;
  }

  /** A pose in: eased from where the peer is drawn, or snapped there when it jumped. */
  _arrive(p, pose, now) {
    if (p.pose && !poseChanged(p.pose, pose)) { p.seenAt = now; return; }   // AUDIT WORLD6b-iii(b) C6: the same pose again (through a second room, or a standing heartbeat) is seen, not re-eased
    // SLAM3: how long this peer took between the last two poses it really moved on - the interval its own ease runs
    // over. Bounded both ways: a burst must not make it snap, and a long silence must not make it crawl back.
    // Measured MOVE to MOVE, never from the welcome: `at` is also stamped when a roster entry first names this peer,
    // and the time between hearing OF somebody and seeing them move is not an interval they are keeping. A peer's
    // first real move therefore has no gap yet and eases on the default.
    // SLAM10 (AUDIT SLAM): AND THE INTERVAL MAY NOT COLLAPSE FASTER THAN BY HALF. The ease is a lag interpolator -
    // `from` is where the peer is drawn, `to` the newest pose - so the drawn figure trails by one interval. When
    // SLAM6 promotes me into a sender's near tier its interval falls from 1000 ms (one in POSE_FAR_SHARE at the
    // crowd rate) to 250 ms in a single step, and the whole accumulated lag has to be burned inside one 250 ms
    // segment: measured, a peer walking at 5 u/s was drawn at 20.6 u/s for a quarter second - a dash, under
    // JUMP_UNITS so the rig plays the walk at 4x rather than snapping. Halving at most per pose caps the catch-up
    // at twice the peer's real speed and converges in two intervals; growing is unbounded as before (a silence
    // must still ceiling, not crawl), and the steady state is untouched.
    if (p.movedAt != null) {
      const g = Math.min(GAP_MAX_MS, Math.max(GAP_MIN_MS, now - p.movedAt));
      p.gap = p.gap != null ? Math.max(g, p.gap * 0.5) : g;
    }
    p.movedAt = now;
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
      if (h.ws && h.status === 'connecting' && now - (h.since ?? now) > BACKOFF_MAX_MS) { const ws = h.ws; h.ws = null; h.status = 'closed'; h.retryAt = now + BACKOFF_MIN_MS + this._rand() * Math.max(BACKOFF_MIN_MS, h.backoff - BACKOFF_MIN_MS); h.backoff = Math.min(BACKOFF_MAX_MS, h.backoff * 2); try { ws.close(1000, 'timeout'); } catch { /* already closed */ } }   // SLAM2: a halo's retry is jittered like the primary's - eight rooms a client, all refused together otherwise
    }
    if (!this.presence && this.status === 'open' && now - this._lastSentAt >= HEARTBEAT_MS && this._send({ t: 'ping' })) this._lastSentAt = now;
    // RELAY-H1: A STANDING PLAYER IS HEARD BY THE RUNTIME, NOT THE ROOM. The presence session's socket used to prove
    // itself alive with a pose every HEARTBEAT_MS, and every pose woke the Durable Object; the runtime answers this
    // exact ping in the object's sleep (server/src/index.js setWebSocketAutoResponse - test/relayh1.test.js holds the
    // two spellings to be one). Sent when nothing else has gone for PING_MS, through the halo sockets too (each is
    // its own room, and each intermediary idles a quiet socket by its own rule). On its own clock: a ping that
    // touched `_lastSentAt` would push the heartbeat pose back by a ping's width every time.
    if (this.presence && this.status === 'open' && now - Math.max(this._lastSentAt, this._lastPingAt) >= PING_MS) {
      const went = this._send({ t: 'ping' });
      for (const [, h] of this._halo) if (h.status === 'open' && h.ws) { try { h.ws.send('{"t":"ping"}'); } catch { /* the halo's own retry */ } }
      if (went) this._lastPingAt = now;
    }   // CHAT1: a channel's keepalive, answered without waking the room
    if (this.presence && this.status === 'open') this._askRound(now);   // SLAM9: the fair ask over every peer not yet introduced
    for (const p of [...this.peers.values()]) {
      // SLAM14 B2: a peer a welcome left unnamed, and that no pose or join has confirmed since, leaves each such room
      // when the silence law hides it - the moment it would have vanished from the screen in any case
      if (p.unconfirmed && now - p.seenAt > PEER_TIMEOUT_MS) for (const room of Object.keys(p.unconfirmed)) this._unmember(room, p.id);
      if (!p.pose) continue;
      // SLAM3: EASED OVER THE INTERVAL THIS PEER IS ACTUALLY KEEPING, not over an assumed 1/POSE_HZ. The assumption
      // was already wrong for anyone on a slow line or a throttled tab - the ease finished early and the peer stood
      // still until the next pose, which is the stutter AUDIT MWBODY A8 describes for the yaw - and SLAM3 makes it
      // wrong for EVERYONE in a crowd, because a crowded sender deliberately speaks less often. The gap is measured
      // at arrival and bounded, so one late frame cannot make a peer crawl.
      const t = (now - p.at) / (p.gap ?? (1000 / POSE_HZ));
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
