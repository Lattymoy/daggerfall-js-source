// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer ... being
// able to see and traverse with other players"): THE WIRE'S LAW, pure,
// ONE HOME (AUDIT ONLINE B7/B8). The relay (server/src/relay.js) re-exports
// this file and the session (net/online.js) imports it, so what the
// relay refuses the client never sends, what the relay may send the
// client checks the same way, and the world's bounds are one number.
// No I/O: test/online_relay.test.js executes it.
//
// THE WIRE. JSON text frames, one message each.
//   client -> room:  {t:'hello', id, secret, name, look, pose}   once, first
//                    {t:'pose', p}                       POSE_HZ_MAX a second at most
//                    {t:'ping'}
//                    {t:'chat', text}                   CHAT_HZ_MAX a second at most (CHAT1)
//                    {t:'world', data, final?}          the room's memory, from its host alone (WORLD1); final once, the farewell
//                    {t:'foes', data}                   the host's live foes, FOES_HZ_MAX a second at most (WORLD2)
//                    {t:'hit', data}                    a blow on the host's foe, from anyone but the host (WORLD2)
//                    {t:'act', data}                    a change to the room's doors, levers and movers, from anyone in it (WORLD3)
//   room -> client:  {t:'welcome', id, peers:[{id,name,look,pose}], host, world}
//                    {t:'join', id, name, look, pose}   {t:'leave', id}
//                    {t:'pose', id, p}                  {t:'pong'}
//                    {t:'chat', id, name, text, at}     to everyone who hears it, the sender included
//                    {t:'host', id}                     the room's host changed (WORLD1)
//                    {t:'foes', id, data}               the host's live foes, to everyone but the host (WORLD2)
//                    {t:'hit', id, data}                a blow on the host's foe, to the host alone (WORLD2)
//                    {t:'act', id, data}                a change to the room's doors, levers and movers, to everyone but its author (WORLD3)
//                    {t:'error', m}                     then the socket closes
// A pose is {x, y, z, yaw, pitch, mv, wd, an, as, am, sr, cn, cr} in the room's frame -
// a world cell's in MapsFile world units (the streaming world's
// map-pixel origin, PIXEL_UNITS a pixel), every other room's in the
// scene's own - mv 1 when walking, 2 when running (the sender's own
// isRunning - AUDIT MWBODY B3: a speed guess sat under every walk); wd 1
// while the sender's weapon is drawn, 2 while a bow is held at full
// draw (MAC7 #2); an the sender's swing count (a peer plays a swing
// when it changes) and as the swing's WeaponStates index
// (POSE_STRIKES) - MAC7 #1: a peer's body stood with its weapon
// sheathed and never swung, since nothing of either travelled; am 1
// while the sender has arrows (the look carries no inventory), sr 1
// while a spell is readied, cn the sender's cast count and cr the
// cast's range type (spellcast.js TARGET_TYPES' index) - MAC7 #2. A look is the paperdoll's recipe: race, gender,
// face, and the equipped items projected onto the six fields the doll
// art reads (AUDIT ONLINE A12: nothing else travels, so a look is small
// by construction and never a stranger's junk rebroadcast).
//
// THE ID AND ITS SECRET (AUDIT ONLINE A3). Ids are public - every pose
// carries one - so a hello with an id the room already holds must
// carry the secret the first hello minted, or it is refused; a
// reconnect with the same id and secret replaces its old socket.
// Without this any client could kick and impersonate any peer.
//
// ROOMS. The client names the room in the path: /room/<key>. The
// streaming world is sharded into WORLD_CELL-pixel cells
// (world:<cx>,<cy>); a town, a dungeon and an interior are each a room
// by location. Inside a world cell a pose reaches only the peers within
// RANGE_PIXELS of the sender (interest management: a cell may hold
// many, a player sees the few around them); every other room is small
// and hears everything.
//
// CHAT ROOMS (CHAT1, 2026-09-12, Mac: "the live chat in enhanced format
// ... one world tab with the ability to add more tabs at a later
// time"). A channel is a room in CHAT_ROOMS - a WHITELIST, not a
// prefix (AUDIT CHAT A1: a prefix let anyone mint a room with a
// channel's privileges) - and not a place: it keeps no looks and no
// roster, says no join and no leave, relays no pose (gated and counted
// all the same, A3), and hands every chat line to every socket that
// said hello - the sender included, which is how the sender learns the
// line was taken. The World tab is chat:world; a later tab is a later
// room in the list. A channel admits CHAT_HELLO_HZ_MAX hellos a second
// (a channel's hello costs the roster nothing, so it runs deeper than a
// place's) and spends CHAT_ROOM_HZ_MAX lines a second for the whole
// room (A2: the fan is every line to everyone, so without a room-wide
// budget one object owes talkers times listeners a second); a line
// over the room's budget is dropped, and the sender's missing echo is
// the only word of it. A chat line in a PLACE room reaches whoever a
// pose would, and the sender besides, so a local tab can ride the
// presence socket when it comes.
//
// THE ROOM'S MEMORY (WORLD1, 2026-09-12, Mac: "The world is the server
// and every player should inhabit that world while also being able to
// continue their progress ... True persistence"). A WORLD ROOM - a
// dungeon, today - keeps a snapshot of its world in the object's own
// storage: the foes the layout placed and how they stand, the piles,
// the dropped loot, the actions and the door locks. The room's HOST
// publishes it (the hello'd socket that has been in the room longest;
// the relay says who in the welcome and in a host frame when it
// changes) and a joiner is handed it in the welcome, so a dungeon one
// player cleared is cleared for the next, and stays so through an empty
// room. The relay reads none of it: a world frame is an object of
// bounded size from the host, stored as it came, served as it came.
// A frame from anyone else is ignored, not refused - a handover races.
//
// THE LIVE FOES (WORLD2, 2026-09-12). The host of a world room streams
// its changed foes ({t:'foes', data} - the other frame admitted past
// MAX_FRAME_BYTES, by its prefix, up to FOES_FRAME_MAX; FOES_HZ_MAX a
// second on the stream's own bucket) and the room fans them to
// everyone but the host, under a byte budget (FOES_ROOM_BYTES_PER_S:
// the frame times its listeners). A blow on the host's foe from anyone
// else ({t:'hit', data}, under the small cap, on the pose bucket) goes
// to the host's socket alone, under the room's hit budget
// (HIT_ROOM_HZ_MAX) and the joiner's own gate at home (HIT_HZ_MAX).
// The relay reads neither; the client checks the sender.
//
// THE LIVE DOORS (WORLD3, 2026-09-12). Whoever moves a dungeon's door, lever
// or platform - a click, a bash, a pick, a walk onto a trigger, the host's
// foe opening a door - sends what changed ({t:'act', data}: the changed
// action records, under the small cap, on the actions' own bucket at the
// relay - ACT_HZ_MAX, a door never starving a pose) and the room fans it
// to everyone hello'd but its author, under the room's own budget
// (ACT_ROOM_HZ_MAX; ACT_HZ_MAX at home too). Every player in a world room may
// send one, not the host alone: a door is whoever touched it. The relay
// reads none of it.

/** The streaming world's shard: a square of map pixels. */
export const WORLD_CELL = 16;
/** How far, in map pixels, a pose travels inside a world cell. */
export const RANGE_PIXELS = 3;
/** The most poses a client may send per second; the rest are dropped. */
export const POSE_HZ_MAX = 20;
/** The most hellos a ROOM admits per second (AUDIT ONLINE A6: a reconnect storm is 2N frames a cycle for everyone). */
export const HELLO_HZ_MAX = 10;
/** The most sockets one room holds; past it the upgrade is refused. */
export const SOCKETS_MAX = 256;
/** The most peers a welcome carries: the nearest, in a world cell (AUDIT ONLINE A5). */
export const ROSTER_MAX = 64;
/** Over-rate poses dropped in a row before the socket is closed (AUDIT ONLINE A8: ungated ingress is a bill). */
export const DROP_STRIKES_MAX = 200;
/** The largest frame the room reads (UTF-16 units); bigger ones close the socket. */
export const MAX_FRAME_BYTES = 16 * 1024;
/** The most equipped items a look may carry (DFU's equip table has 27 slots). */
export const MAX_LOOK_ITEMS = 27;
/** The fields of an equipped item the doll art reads - all a look carries per item. */
export const LOOK_ITEM_FIELDS = Object.freeze(['templateIndex', 'group', 'material', 'dye', 'variant', 'equipSlot']);
/** The item groups the doll art knows; anything else draws nothing and is dropped. */
export const LOOK_GROUPS = Object.freeze(['MensClothing', 'WomensClothing', 'Armor', 'Weapons', 'Jewellery']);
/** A display name's bounds. */
export const NAME_MAX = 24;
/** A swing's kind on the wire: DFU's WeaponStates order (combat/fpsWeapon.js STATE_INDEX), the pose's `as` an index into it (MAC7 #1). */
export const POSE_STRIKES = Object.freeze(['Idle', 'StrikeDown', 'StrikeDownLeft', 'StrikeLeft', 'StrikeRight', 'StrikeDownRight', 'StrikeUp']);
/** A cast's range on the wire: DFU's TargetTypes order (systems/spellcast.js TARGET_TYPES), the pose's `cr` an index into it (MAC7 #2). */
export const POSE_CAST_RANGES = 5;
/** World units per map pixel in the frame the streaming world's poses
 *  travel in: MapsFile's (world/streamingWorld.js NATIVE_PIXEL). */
export const PIXEL_UNITS = 32768;
/** The map is 1000 x 500 pixels; a pose's x and z lie within this
 *  (AUDIT ONLINE B2/E2: the first bound, 1e7, refused most of the Bay
 *  - the classic start included - and the relay closed every mover). */
export const POSE_BOUND = 1024 * PIXEL_UNITS;
/** A pose's height bound, the scene's own units. */
export const POSE_Y_BOUND = 1e5;
/** The relay's close codes with a meaning of their own. */
export const CLOSE_REPLACED = 4000;   // another socket said hello with this id and its secret
export const CLOSE_POLICY = 1008;     // a frame the relay refused; it said why in an error frame first
export const CLOSE_BUSY = 1013;       // the room is full or its hello gate is shut: try again later
/** A chat line's bound (UTF-16 units) - CHAT1. */
export const CHAT_MAX = 240;
/** The most chat lines a client may send a second; the bucket's burst is the same number. */
export const CHAT_HZ_MAX = 2;
/** Over-rate chat lines dropped in a row before the socket is closed. */
export const CHAT_STRIKES_MAX = 20;
/** The most sockets a CHAT room holds - one room hears the whole world, so it runs deeper than a cell's. */
export const CHAT_SOCKETS_MAX = 2048;
/** The most hellos a CHANNEL admits a second (AUDIT CHAT A1: the gate is never off; a channel's hello costs no roster, so it runs deeper). */
export const CHAT_HELLO_HZ_MAX = 50;
/** The most chat lines a whole CHANNEL relays a second (AUDIT CHAT A2: the fan is every line to everyone - the room's budget, not the socket's). */
export const CHAT_ROOM_HZ_MAX = 20;
/** The World tab's room: the one chat channel there is. */
export const CHAT_WORLD_ROOM = 'chat:world';
/** The largest world frame the room stores (UTF-16 units) - WORLD1; anything else keeps MAX_FRAME_BYTES. */
export const WORLD_FRAME_MAX = 512 * 1024;
/** The least time between two of one host's world frames, ms; a sooner one is dropped. */
export const WORLD_MIN_MS = 5000;
/** The room's storage chunk for a world (a Durable Object value is capped at 128 KiB). */
export const WORLD_CHUNK = 96 * 1024;
/** How a world frame begins on the wire - the one frame admitted past MAX_FRAME_BYTES, told before any parse. */
export const WORLD_PREFIX = '{"t":"world"';
/** A world room's memory is forgotten this long after the room last drained, unless someone came back (AUDIT WORLD A3). */
export const WORLD_TTL_MS = 30 * 24 * 3600 * 1000;
/** WORLD2: the largest foes frame (UTF-16 units) - the host's live foes, a delta a few times a second. */
export const FOES_FRAME_MAX = 64 * 1024;
/** WORLD2: foes frames a second at most, on their own bucket (a stream beside the poses, never starving them). */
export const FOES_HZ_MAX = 12;
/** How a foes frame begins on the wire - the other frame admitted past MAX_FRAME_BYTES, told before any parse. */
export const FOES_PREFIX = '{"t":"foes"';
/** The cap a frame's PREFIX earns before any parse (WORLD1/WORLD2): a world frame WORLD_FRAME_MAX, a foes frame
 *  FOES_FRAME_MAX, anything else MAX_FRAME_BYTES; the type keeps the cap after the parse (AUDIT WORLD A2). */
export function frameCap(text) { return text.startsWith(WORLD_PREFIX) ? WORLD_FRAME_MAX : text.startsWith(FOES_PREFIX) ? FOES_FRAME_MAX : MAX_FRAME_BYTES; }
/** AUDIT WORLD2 A5: a room's foes fan spends this many bytes a second - the frame's size times its listeners; one host
 *  at FOES_HZ_MAX and FOES_FRAME_MAX into SOCKETS_MAX listeners would have been 191 MiB/s out of one object. */
export const FOES_ROOM_BYTES_PER_S = 4 * 1024 * 1024;
/** AUDIT WORLD2 A6: the hits a room forwards onto its host's one socket a second, all joiners together. */
export const HIT_ROOM_HZ_MAX = 60;
/** AUDIT WORLD2 A6: a joiner's own hits a second, at home - the pose bucket's headroom over the client's POSE_HZ (10),
 *  so a blow never starves the joiner's poses at the relay and an over-rate blow is refused to its caller. */
export const HIT_HZ_MAX = 10;
/** WORLD3: the action frames a room fans a second, all senders together - a door, a lever, a platform moved. */
export const ACT_ROOM_HZ_MAX = 30;
/** WORLD3: a client's action frames a second - a click's worth, on their own bucket at the relay (a door never
 *  starves a pose) and refused to the caller at home past it. */
export const ACT_HZ_MAX = 5;
/** A byte budget: `rate` bytes a second, a second's worth at most; passes when the cost fits, spending it. */
export function byteGate(bucket, nowMs, cost, rate) {
  const b = bucket ?? { bytes: rate, at: nowMs };
  const bytes = Math.min(rate, b.bytes + Math.max(0, ((nowMs - b.at) / 1000) * rate));
  if (bytes < cost) return { bucket: { bytes, at: nowMs }, pass: false };
  return { bucket: { bytes: bytes - cost, at: nowMs }, pass: true };
}
/** Every channel the relay will open (AUDIT CHAT A1: a whitelist - a later tab is a later entry, and nothing else is a channel). */
export const CHAT_ROOMS = Object.freeze(new Set([CHAT_WORLD_ROOM]));

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const uint = (v, max) => (finite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : null);
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** A name the room will show: printable ASCII, trimmed, bounded, never empty. */
export function sanitizeName(name) {
  let s = '';
  for (const ch of String(name ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) s += ch; }
  s = s.trim().slice(0, NAME_MAX);
  return s || 'Traveller';
}

/** What a chat line may not carry: every FORMAT character (Unicode Cf -
 *  the bidi controls, the zero widths, the joiners, the soft hyphen, the
 *  tag block, the BOM: AUDIT CHAT A4 - five hand-written ranges missed
 *  U+061C and the tags) and the variation selectors bar U+FE0F, which
 *  emoji presentation needs. */
const INVISIBLE = /[\p{Cf}\uFE00-\uFE0E\u{E0100}-\u{E01EF}]/u;

/** A chat line the room will relay: control and format characters
 *  gone (a line cannot rewrite the line before it, or hide in zero
 *  width), a lone surrogate gone (B3: half a character is not a
 *  character, and the one guard on the cut was not idempotent with two
 *  of them), a stack of combining marks cut to three (A4: two hundred
 *  on one letter paint over the game), whitespace collapsed, trimmed,
 *  bounded - or '' when nothing is left to say. Idempotent, so what the
 *  client sends the relay takes. Every other character is a person's
 *  own (the panel is DOM text: nothing here is markup). */
export function sanitizeChat(text) {
  let s = '';
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0);
    if (c < 32 || (c >= 0x7f && c <= 0x9f) || (c >= 0xd800 && c <= 0xdfff) || INVISIBLE.test(ch)) continue;
    s += ch;
  }
  s = s.replace(/\s+/g, ' ').replace(/(\p{M}{3})\p{M}+/gu, '$1').trim().slice(0, CHAT_MAX);
  if (/[\uD800-\uDBFF]$/.test(s)) s = s.slice(0, -1);   // the bound fell inside a pair: no half of a character
  return s.trim();
}

/** Is this key a channel's: one of CHAT_ROOMS - no poses relayed, no roster, every line to everyone. */
export const isChatRoom = (key) => CHAT_ROOMS.has(String(key ?? ''));

/** Does this room keep a world (WORLD1): a dungeon's, today - the one place whose world is one self-contained
 *  snapshot with a restore arm at both hosts; towns, cells and buildings are the next rooms. The key is a MAP ID's
 *  (roomKeyFor's `dungeon:m<mapId>`), not a prefix (AUDIT WORLD A3): a client can name any room, and a world room
 *  is a Durable Object that keeps up to WORLD_FRAME_MAX for WORLD_TTL_MS - the Bay's dungeons are a bounded set,
 *  eighty free characters are not. */
const WORLD_ROOM = /^dungeon:m\d{1,8}$/;
export const isWorldRoom = (key) => WORLD_ROOM.test(String(key ?? ''));

/** A pose the room will relay, or null. */
export function validPose(p) {
  if (!p || typeof p !== 'object') return null;
  const { x, y, z, yaw, pitch, mv, wd, an, as, am, sr, cn, cr } = p;
  if (![x, y, z, yaw, pitch].every(finite)) return null;
  if (Math.abs(x) > POSE_BOUND || Math.abs(z) > POSE_BOUND || Math.abs(y) > POSE_Y_BOUND) return null;
  // MAC7: the arm's seven, clamped - a pose from before them reads sheathed, unswung, unarrowed and uncast
  return {
    x, y, z, yaw, pitch, mv: mv === 2 ? 2 : mv ? 1 : 0,
    wd: wd === 2 ? 2 : wd ? 1 : 0, an: uint(an, 65535) ?? 0, as: uint(as, POSE_STRIKES.length - 1) ?? 0,
    am: am ? 1 : 0, sr: sr ? 1 : 0, cn: uint(cn, 65535) ?? 0, cr: uint(cr, POSE_CAST_RANGES - 1) ?? 0,
  };
}

/** One equipped item as the look carries it - the six fields, clamped - or null. */
export function validLookItem(it) {
  if (!it || typeof it !== 'object') return null;
  const templateIndex = uint(it.templateIndex, 65535), equipSlot = uint(it.equipSlot, 1e6);
  if (templateIndex == null || equipSlot == null || equipSlot >= MAX_LOOK_ITEMS || !LOOK_GROUPS.includes(it.group)) return null;   // a slot past the table is no item, not another slot's
  const out = { templateIndex, group: it.group, equipSlot };
  for (const k of ['material', 'dye', 'variant']) { const v = uint(it[k], 4095); if (v != null) out[k] = v; }
  return out;
}

/** A look the room will keep and repeat: the paperdoll's recipe, bounded and projected. */
export function validLook(look) {
  if (!look || typeof look !== 'object') return null;
  const race = typeof look.race === 'string' && /^[A-Za-z]{1,16}$/.test(look.race) ? look.race : 'Breton';
  const gender = look.gender === 'female' ? 'female' : 'male';
  const faceIndex = uint(look.faceIndex, 9) ?? 0;
  const items = Array.isArray(look.items) ? look.items.map(validLookItem).filter(Boolean).slice(0, MAX_LOOK_ITEMS) : [];
  return { race, gender, faceIndex, items };
}

/** The room's key from the request path: /room/<key>, or null. */
export function roomOf(pathname) {
  const m = /^\/room\/([A-Za-z0-9_.,:+-]{1,80})$/.exec(pathname);
  return m ? m[1] : null;
}

/** A relay the client may connect to: wss:// anywhere, ws:// on localhost only (AUDIT ONLINE A16/E11). */
export function relayUrl(url) {
  const s = String(url ?? '').trim().replace(/\/+$/, '');
  if (/^wss:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/.test(s)) return s;
  if (/^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/.test(s)) return s;
  return null;
}

/** The streaming world's room for a MAP PIXEL (the client mints it; the relay only reads the key). */
export const worldRoom = (px, py) => `world:${Math.floor(px / WORLD_CELL)},${Math.floor(py / WORLD_CELL)}`;

/** A world-frame pose's cell coordinates - floor(x / PIXEL_UNITS),
 *  floor(z / PIXEL_UNITS). NOT the map pixel (the map's y runs the
 *  other way, 499 - this); distances between two of these equal map
 *  pixel distances, which is all inRange asks (AUDIT ONLINE B8). */
export const pixelOf = (p) => [Math.floor(p.x / PIXEL_UNITS), Math.floor(p.z / PIXEL_UNITS)];

/** The Chebyshev distance between two poses, in map pixels. */
export function pixelDistance(a, b) {
  const [ax, ay] = pixelOf(a), [bx, by] = pixelOf(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Does a pose from `from` reach `to`? Inside a world cell, within
 *  RANGE_PIXELS by Chebyshev distance; in every other room, always. */
export function inRange(roomKey, from, to) {
  if (!String(roomKey ?? '').startsWith('world:')) return true;
  if (!from || !to) return false;
  return pixelDistance(from, to) <= RANGE_PIXELS;
}

/** One client frame, parsed and checked: {t:'hello'|'pose'|'ping'|'chat'|'world'|'foes'|'hit'|'act', ...}
 *  or {error} - the caller closes on an error. */
export function parseClient(text, { hasHello = false } = {}) {
  if (typeof text !== 'string') return { error: 'text frames only' };
  // WORLD1/WORLD2: the frames past MAX_FRAME_BYTES are the world frame and the foes frame, told by their prefix
  // before any parse (the client mints them with t first) and capped by it; everything else keeps the small cap,
  // refused unparsed
  if (text.length > frameCap(text)) return { error: 'frame too large' };
  let m;
  try { m = JSON.parse(text); } catch { return { error: 'not JSON' }; }
  if (!m || typeof m !== 'object') return { error: 'not an object' };
  // AUDIT WORLD A2: the prefix admitted the size, the TYPE keeps the cap - JSON's last duplicate key wins, so a frame
  // that began {"t":"world" and ended "t":"pose" parsed as a 512 KiB pose under the pose gate
  if (m.t !== 'world' && m.t !== 'foes' && text.length > MAX_FRAME_BYTES) return { error: 'frame too large' };
  if (m.t === 'foes' && text.length > FOES_FRAME_MAX) return { error: 'frame too large' };
  if (m.t === 'world') {   // the room's memory, an object from a hello'd socket; final marks the socket's one farewell (B5)
    if (!hasHello) return { error: 'world before hello' };
    if (!m.data || typeof m.data !== 'object' || Array.isArray(m.data)) return { error: 'bad world' };
    return { t: 'world', data: m.data, final: m.final === true };
  }
  if (m.t === 'foes' || m.t === 'hit' || m.t === 'act') {   // WORLD2: the host's live foes out, a blow on them in; WORLD3: a door moved - objects from a hello'd socket, read by no relay
    if (!hasHello) return { error: `${m.t} before hello` };
    if (!m.data || typeof m.data !== 'object' || Array.isArray(m.data)) return { error: `bad ${m.t}` };
    return { t: m.t, data: m.data };
  }
  if (m.t === 'ping') return { t: 'ping' };
  if (m.t === 'hello') {
    if (hasHello) return { error: 'hello twice' };
    const id = typeof m.id === 'string' && ID_RE.test(m.id) ? m.id : null;
    if (!id) return { error: 'bad id' };
    const secret = typeof m.secret === 'string' && SECRET_RE.test(m.secret) ? m.secret : null;
    if (!secret) return { error: 'bad secret' };
    const look = validLook(m.look);
    if (!look) return { error: 'bad look' };
    const pose = validPose(m.pose);
    return { t: 'hello', id, secret, name: sanitizeName(m.name), look, pose };
  }
  if (m.t === 'pose') {
    if (!hasHello) return { error: 'pose before hello' };
    const p = validPose(m.p);
    return p ? { t: 'pose', p } : { error: 'bad pose' };
  }
  if (m.t === 'chat') {
    if (!hasHello) return { error: 'chat before hello' };
    const text = typeof m.text === 'string' ? sanitizeChat(m.text) : '';
    return text ? { t: 'chat', text } : { error: 'bad chat' };   // the client sanitizes before it sends, so an empty line here is not the port's client
  }
  return { error: 'unknown message' };
}

/** A token bucket of `rate` a second: the bucket after the frame and
 *  whether the frame passes. The pose gate and the hello gate ride it. */
export function tokenGate(bucket, nowMs, rate = POSE_HZ_MAX) {
  const b = bucket ?? { tokens: rate, at: nowMs };
  const refill = ((nowMs - b.at) / 1000) * rate;
  const tokens = Math.min(rate, b.tokens + Math.max(0, refill));
  if (tokens < 1) return { bucket: { tokens, at: nowMs }, pass: false };
  return { bucket: { tokens: tokens - 1, at: nowMs }, pass: true };
}

/** The pose rate gate: POSE_HZ_MAX a second. */
export const poseGate = (bucket, nowMs) => tokenGate(bucket, nowMs, POSE_HZ_MAX);
/** The foes rate gate: FOES_HZ_MAX a second (WORLD2), the stream's own bucket. */
export const foesGate = (bucket, nowMs) => tokenGate(bucket, nowMs, FOES_HZ_MAX);
/** The hit rate gate at home: HIT_HZ_MAX a second (AUDIT WORLD2 A6). */
export const hitGate = (bucket, nowMs) => tokenGate(bucket, nowMs, HIT_HZ_MAX);
/** The action rate gate at home: ACT_HZ_MAX a second (WORLD3). */
export const actGate = (bucket, nowMs) => tokenGate(bucket, nowMs, ACT_HZ_MAX);
/** The chat rate gate: CHAT_HZ_MAX a second (CHAT1). */
export const chatGate = (bucket, nowMs) => tokenGate(bucket, nowMs, CHAT_HZ_MAX);

/** What a joiner is told: everyone else in the room who has said hello
 *  - the nearest ROSTER_MAX to `near` when there is a pose to measure
 *  from (a world cell), the first ROSTER_MAX otherwise. */
export function rosterFor(peers, meId, near = null) {
  const out = [];
  for (const p of peers) if (p && p.id && p.id !== meId) out.push({ id: p.id, name: p.name, look: p.look, pose: p.pose ?? null });
  if (near && out.length > ROSTER_MAX) out.sort((a, b) => (a.pose ? pixelDistance(near, a.pose) : Infinity) - (b.pose ? pixelDistance(near, b.pose) : Infinity));
  return out.slice(0, ROSTER_MAX);
}
