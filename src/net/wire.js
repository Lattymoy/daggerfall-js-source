// @ts-check
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
//                    {t:'act', data}                    a change to the room's doors, levers, movers and loot, from anyone in it (WORLD3/WORLD4)
//   room -> client:  {t:'welcome', id, peers:[{id,name,look,pose}], host, world, now}   now: the relay's clock, ms (WORLD5)
//                    {t:'join', id, name, look, pose}   {t:'leave', id}
//                    {t:'pose', id, p}                  {t:'pong'}
//                    {t:'chat', id, name, text, at}     to everyone who hears it, the sender included
//                    {t:'host', id}                     the room's host changed (WORLD1)
//                    {t:'world', id, data}              the room's memory, to a socket whose welcome carried none (AUDIT WORLD34 C1)
//                    {t:'foes', id, data}               the host's live foes, to everyone but the host (WORLD2)
//                    {t:'hit', id, data}                a blow on the host's foe, to the host alone (WORLD2)
//                    {t:'act', id, data}                a change to the room's doors, levers, movers and loot, to everyone but its author (WORLD3/WORLD4)
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
// THE LIVE DOORS (WORLD3, 2026-09-12) AND THE ROOM'S LOOT (WORLD4,
// 2026-09-13). Whoever moves a dungeon's door, lever or platform - a click,
// a bash, a pick, a walk onto a trigger, the host's foe opening a door - or
// OPENS one of its containers, sends what changed ({t:'act', data}: the
// changed action records and the containers whose contents are now the
// room's, under the small cap, on the actions' own bucket at the relay -
// ACT_HZ_MAX, a door never starving a pose) and the room fans it to
// everyone hello'd but its author, under the room's own budgets
// (ACT_ROOM_HZ_MAX frames and ACT_ROOM_BYTES_PER_S bytes, the frame times
// its listeners; ACT_HZ_MAX at home too). Every player in a world room may
// send one, not the host alone: a door is whoever touched it, and so is a
// chest. The relay reads none of it - the frame's `data` is opaque to it,
// so WORLD4 needed no relay change and no budget of its own.
//
// THE SHARED CLOCK (WORLD5, 2026-09-13, Mac: "the shared clock and
// weather, and the quest clocks stood down online"). Online, the world's
// time is nobody's to keep: it is a FUNCTION OF WALL TIME, the same on
// every client with no frame to carry it and no host to hand it over -
// ONLINE_EPOCH_MS is the instant the world stood at the classic game
// start (13:30, 4 Morning Star 3E405), and it has run at DFU's default
// TimeScale (12: a game minute every five real seconds, a day every two
// real hours) since. The relay says its own clock in the welcome (`now`,
// ms) so a client whose machine's clock is off reads the world's time
// through the offset, not its own. Nothing local moves it: no rest, no
// fast travel, no sentence, no ?tod, no ?timescale.

import { wrapAngle } from '../world/mat4.js';   // ONCRASH1: the port's one angle wrap. The relay re-exports this module (server/src/relay.js), so this reaches the worker too - mat4.js imports nothing itself.

/** WORLD5: the instant the online world stood at the classic game start - 2026-09-14T00:00:00Z. */
export const ONLINE_EPOCH_MS = Date.UTC(2026, 8, 14, 0, 0, 0);
/** WORLD5: DaggerfallDateTime.classicGameStartTime in classic minutes (gameDate.js CLASSIC_GAME_START_TIME - pinned equal). */
export const ONLINE_EPOCH_MINUTES = 523530;
/** WORLD5: classic minutes per real millisecond at TimeScale 12 (worldTick.js CLASSIC_MINUTES_PER_SECOND / 1000 - pinned equal). */
export const ONLINE_MINUTES_PER_MS = 12 / 60 / 1000;
/** WORLD5: the online world's clock, classic minutes, for a wall-clock instant (ms). One home for every client. */
export const sharedClassicMinutes = (nowMs) => ONLINE_EPOCH_MINUTES + (nowMs - ONLINE_EPOCH_MS) * ONLINE_MINUTES_PER_MS;
/** OL3: the inverse - the relay-clock millisecond at which the shared world reads a classic minute (a room's expiry, a loan's due date, as real time). */
export const wallMsForClassicMinutes = (classicMinutes) => ONLINE_EPOCH_MS + (classicMinutes - ONLINE_EPOCH_MINUTES) / ONLINE_MINUTES_PER_MS;

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
/** AUDIT WORLD6a B3: a BUILDING's memory is a shelf or two and a handful of doors (a shop shelf measured at 2-4 KB;
 *  a whole shop single-digit KB), and the namespace of buildings is 10^18 names an attacker may fill for
 *  WORLD_TTL_MS each - so an interior room stores this much and no more, at both ends. */
export const WORLD_FRAME_MAX_INTERIOR = 64 * 1024;
/** The world-frame cap a ROOM earns once its key is known: an interior's, else the dungeon's. */
export const worldFrameMaxFor = (key) => (String(key ?? '').startsWith('interior:') ? WORLD_FRAME_MAX_INTERIOR : WORLD_FRAME_MAX);
/** AUDIT WORLD6a B7: a context's mark on the memory it publishes (AUDIT WORLD B1) - `Math.random().toString(36)
 *  .slice(2)` could be ONE character, and a collision refused the room's memory in silence; twelve base-36 digits
 *  of the clock and the roll, always. */
export const mintSharedStamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;
/** The least time between two of one host's world frames, ms; a sooner one is dropped. */
export const WORLD_MIN_MS = 5000;
/** The room's storage chunk for a world (a Durable Object value is capped at 128 KiB). */
export const WORLD_CHUNK = 96 * 1024;
/** How a world frame begins on the wire - the one frame admitted past MAX_FRAME_BYTES, told before any parse. */
export const WORLD_PREFIX = '{"t":"world"';
/** A world room's memory is forgotten this long after the room last drained, unless someone came back (AUDIT WORLD A3). */
export const WORLD_TTL_MS = 30 * 24 * 3600 * 1000;
/** WORLD8 (Mac: "I would like dungeons and the world to respawn every hour"): THE HOUR'S RESPAWN - a foe of the
 *  room's layout dead this long, and a container the room emptied this long ago, come back: the foe rebuilt fresh at
 *  its marker by the host (the stream then says so), the container this client's own roll again. The stamps are the
 *  relay's clock (a wall millisecond, the shared clock's own), on the memory's records and on every act; a record
 *  with no stamp (a memory written before WORLD8) is applied as it stands. */
export const RESPAWN_MS = 3600 * 1000;
/** WORLD8: whether a stamp is past the hour by `nowMs` - false for no stamp, no clock (offline), or a stamp ahead. */
export const respawnDue = (stampMs, nowMs) => Number.isFinite(stampMs) && Number.isFinite(nowMs) && nowMs - stampMs >= RESPAWN_MS;
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
/** AUDIT WORLD3 A1: a room's act fan spends this many bytes a second - the frame's size times its listeners, the
 *  same law AUDIT WORLD2 A5 wrote for the foes fan. Counting FRAMES alone left the cost unbounded in bytes: six
 *  hello'd sockets sending the largest act frame at their own rate is 119.6 MiB/s out of one Durable Object, 30x
 *  the foes fan's ceiling. A door's honest traffic is a few kilobytes a second even in a full room, so this sits
 *  well above every real cascade and far below the hole. */
export const ACT_ROOM_BYTES_PER_S = 1024 * 1024;
/** AUDIT WORLD6b-iii(c) C3: the room's HIT bytes a second, fanned - the hit frame carries a corpse's GRANT since
 *  WORLD6b-iii(c) (up to a frame's worth of items), so the arm that was a 150-byte control channel is a bulk one and
 *  counts its bytes as the foes and the acts do (AUDIT WORLD3 A1's law); over it a blow is dropped, nobody struck. */
export const HIT_ROOM_BYTES_PER_S = 256 * 1024;
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
 *  eighty free characters are not.
 *  AUDIT WORLD34 A1 (THE ROOT): the bound was eight digits, and a real MapTableData.MapId is a 32-bit integer -
 *  Privateer's Hold is 187853213, Daggerfall 1291010263 (world/dungeonTextures.js MAIN_STORY_DUNGEON_IDS) - so
 *  every real dungeon failed this law at BOTH ends, was joined all the same, relayed poses and nothing else, and
 *  every player kept stepping their own foes with no word said. Ten digits is the unsigned 32-bit bound. */
//  WORLD6a (Mac, 2026-09-14: "Lets tackle #1 next"): AND A BUILDING - `interior:m<mapId>.<buildingKey>`, the room
//  roomKeyFor has minted for every interior since ONLINE1 (a real map id, unsigned; a building key from
//  BuildingDirectory.MakeBuildingKey, (x<<16)+(y<<8)+i or the 1<<24 sentinel - eight digits at most). A town's cell
//  and the fixed city's room are still no world room: the exterior's memory is the next slice's.
//  AUDIT WORLD6a B4: no zero and no leading zero in either number - roomKeyFor never mints a 0 id ("no map row") or
//  a 0 key ("a door the directory cannot key"), and a padded alias (`m0000000187853213`) was refused by the digit
//  bound alone, which is luck, not law. The wire admits exactly what the game can name, and nothing the relay would
//  pay for that no player can reach.
const WORLD_ROOM = /^(?:dungeon:m[1-9]\d{0,9}|interior:m[1-9]\d{0,9}\.[1-9]\d{0,7})$/;
export const isWorldRoom = (key) => WORLD_ROOM.test(String(key ?? ''));
//  WORLD6b (Mac, 2026-09-14: "Continue"): A CELL STREAMS ITS FOES. The open country's room is a sixteen-pixel cell
//  (worldRoom), and nothing in it is a layout every client builds alike: every foe was one client's roll, near that
//  client, on terrain only the clients near it have built - so a cell has no HOST simulation and keeps no memory
//  (it is no world room), and A FOE IS ITS SPAWNER'S: the spawner steps it and streams it, everyone else in the cell
//  puppets it, and a blow on another's foe goes to its OWNER as a hit (`data.to`). The relay fans a cell's foes frames
//  from ANYONE hello'd (each on its own bucket, under the room's byte budget) and routes a cell's hit to the socket
//  `to` names; a world room keeps WORLD2's host law untouched.
const CELL_ROOM = /^world:\d{1,3},\d{1,3}$/;
export const isCellRoom = (key) => CELL_ROOM.test(String(key ?? ''));
/** A room whose foes ride the wire: a world room (the host's) or a cell (each spawner's). */
export const streamsFoes = (key) => isWorldRoom(key) || isCellRoom(key);
/** WORLD6b: the owner a cell's hit is for - the frame's `to`, a peer id; null when the frame names none.
 *  AUDIT WORLD6b A5: an id is what the wire's own law says an id is (ID_RE) - a `to` no socket could ever carry
 *  named nobody yet bought a funnel token. */
export const hitOwnerOf = (data) => (data && typeof data.to === 'string' && ID_RE.test(data.to) ? data.to : null);
/** WORLD6b-iii(e): the striker's POISON on a hit (`pt`) - the blade's or the shaft's dose, which FormulaHelper inflicts
 *  inside the damage calc and clears from the weapon (formulas.js's onInflictPoison seam), so at a puppet it rides
 *  the hit to the owner's foe instead of dosing the local shadow. The enum is ItemEnums.Poisons, 128..139
 *  (poisons.js's POISON_START_VALUE and TOTAL_POISON_VARIANTS - pinned equal here so the worker's bundle carries no
 *  systems import); a value outside it registers nothing in DFU either (startPoison's refusal). Null when none. */
export const HIT_POISON_MIN = 128;
export const HIT_POISON_MAX = 139;
export const hitPoisonOf = (data) => (data && Number.isInteger(data.pt) && data.pt >= HIT_POISON_MIN && data.pt <= HIT_POISON_MAX ? data.pt : null);
/** WORLD6b-iii(e): a stranger asked for by name (`who`, an id the wire's law admits); null when the frame names none. */
export const whoIdOf = (m) => (m && typeof m.id === 'string' && ID_RE.test(m.id) ? m.id : null);
/** AUDIT WORLD6b B3/C2: A CELL'S FRAME IS BOUNDED, at both ends. A dungeon's frame is the host's alone and keys
 *  into a layout every client built (`i >= _layoutFoes` refuses the rest); a cell's comes from anyone and MINTS a
 *  foe per record it names, so a record is projected like a pose (validPose's own bounds on the feet) and a frame
 *  carries at most CELL_FRAME_RECORDS_MAX records (the owner's live cap plus the corpses still riding), and a
 *  reader stands at most CELL_PUPPETS_MAX live puppets per owner (MAX_ACTIVE_ENCOUNTER_FOES - the only number a
 *  legitimate owner can exceed is by quest foes, which never ride). */
export const CELL_FRAME_RECORDS_MAX = 64;
export const CELL_PUPPETS_MAX = 8;
export const FOE_SEQ_MAX = 1e9;
export const FOE_HEALTH_MAX = 1e5;
export const FOE_LEVEL_MAX = 100;
/** One streamed foe record projected: `i` a whole number in [0, FOE_SEQ_MAX]; `t` a whole number in [0, 255] or
 *  absent; `x`, `d`, `m` 0 or 1 or absent; `f` three finite numbers inside the pose's bounds or absent; `y` finite
 *  or absent; `h` finite in [0, FOE_HEALTH_MAX] or absent; `a` a whole number in [0, 2^31) or absent. Null when
 *  any present field is outside its law - a record is refused whole, never half landed. */
export function validFoeRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (!Number.isInteger(r.i) || r.i < 0 || r.i > FOE_SEQ_MAX) return null;
  const out = { i: r.i };
  if (r.t !== undefined) { if (!Number.isInteger(r.t) || r.t < 0 || r.t > 255) return null; out.t = r.t; }
  for (const k of ['x', 'd', 'm']) if (r[k] !== undefined) { if (r[k] !== 0 && r[k] !== 1) return null; out[k] = r[k]; }
  if (r.f !== undefined) {
    if (!Array.isArray(r.f) || r.f.length !== 3 || !r.f.every(Number.isFinite)) return null;
    if (Math.abs(r.f[0]) > POSE_BOUND || Math.abs(r.f[2]) > POSE_BOUND || Math.abs(r.f[1]) > POSE_Y_BOUND) return null;
    out.f = [r.f[0], r.f[1], r.f[2]];
  }
  if (r.y !== undefined) { if (!Number.isFinite(r.y)) return null; out.y = wrapAngle(r.y); }   // ONCRASH1: the puppet's yaw is bounded as the pose's is - it reaches the same wraps through characters/enemyMotor.js
  if (r.h !== undefined) { if (!Number.isFinite(r.h) || r.h < 0 || r.h > FOE_HEALTH_MAX) return null; out.h = r.h; }
  if (r.a !== undefined) { if (!Number.isInteger(r.a) || r.a < 0 || r.a >= 2 ** 31) return null; out.a = r.a; }
  // WORLD6b-ii: `g` the foe's target - '.' its owner, a peer id, '' none (WORLD3's spelling for the dungeon's stream)
  if (r.g !== undefined) { if (typeof r.g !== 'string' || !(r.g === '' || r.g === '.' || ID_RE.test(r.g))) return null; out.g = r.g; }
  // AUDIT WORLD6b-ii B2/B3: the ATTACKER'S terms ride the record - `l` the foe's level, `w` its right-hand weapon as
  // [templateIndex, material] or null (none) - so a puppet's blow at me is the owner's foe's blow (its level, its
  // weapon), resolved against MY stats; copied, never rolled (AUDIT WORLD6b B14)
  if (r.l !== undefined) { if (!Number.isInteger(r.l) || r.l < 0 || r.l > FOE_LEVEL_MAX) return null; out.l = r.l; }
  // WORLD6b-iii: the cast rides the record - `c` the cast count, `s` the spell index (WORLD3's spelling for the dungeon)
  // AUDIT WORLD6b-iii(a) C8: `s` is a SPELLS.STD record index, a u8 (spellsStd.js reads it as one) - bounded as `t` is
  if (r.c !== undefined) { if (!Number.isInteger(r.c) || r.c < 0 || r.c > 0xffff) return null; out.c = r.c; }
  if (r.s !== undefined) { if (!Number.isInteger(r.s) || r.s < 0 || r.s > 255) return null; out.s = r.s; }
  // AUDIT WORLD6b-iii(a) A3: the RECIPIENT rides with the count - `u` whom the last cast was at, `b` whom the last blow
  // was at, in `g`'s spelling ('.' the owner, a peer id, '' none): `g` is the LIVE hunt when the frame goes out, and a
  // foe that cast at its owner then turned to a peer inside the frame's 200 ms sent the peer a cast it never made
  for (const k of ['u', 'b']) if (r[k] !== undefined) { if (typeof r[k] !== 'string' || !(r[k] === '' || r[k] === '.' || ID_RE.test(r[k]))) return null; out[k] = r[k]; }
  // WORLD6b-iii(c): `o` how many items the corpse's pile holds (0 a live foe, an emptied body) - a peer's body is a loot
  // target while it says more than none; the pile itself travels in the owner's GRANT (a hit frame), never here
  if (r.o !== undefined) { if (!Number.isInteger(r.o) || r.o < 0 || r.o > 255) return null; out.o = r.o; }
  if (r.w !== undefined) {
    if (r.w === null) out.w = null;
    else if (Array.isArray(r.w) && r.w.length === 2 && Number.isInteger(r.w[0]) && r.w[0] >= 0 && r.w[0] <= 1023 && Number.isInteger(r.w[1]) && r.w[1] >= 0 && r.w[1] <= 255) out.w = [r.w[0], r.w[1]];
    else return null;
  }
  return out;
}

/** A pose the room will relay, or null. */
export function validPose(p) {
  if (!p || typeof p !== 'object') return null;
  const { x, y, z, yaw, pitch, mv, wd, an, as, am, sr, cn, cr } = p;
  if (![x, y, z, yaw, pitch].every(finite)) return null;
  if (Math.abs(x) > POSE_BOUND || Math.abs(z) > POSE_BOUND || Math.abs(y) > POSE_Y_BOUND) return null;
  // ONCRASH1 (2026-09-15, Mac: "reports of player browser crashing when
  // online"): AN ANGLE IS BOUNDED LIKE EVERY OTHER FIELD. `finite` alone
  // admitted 1e300, and the sender's own yaw is not wrapped either -
  // player/lookFilter.js ACCUMULATES it, turn after turn, for the life of
  // the session. Downstream, four sites wrapped it with `while (d >
  // Math.PI) d -= 2 * Math.PI`, which at a large angle subtracts nothing
  // and never falls: the READER's tab hangs, not the sender's. The loops
  // are one step now (world/mat4.js wrapAngle) and the door wraps besides,
  // because the wire's law is that it admits what the game can NAME, and
  // no player faces 1e300 radians. Wrapped, not refused: a turn is a turn
  // whatever its winding, and a legitimate accumulated yaw must still
  // arrive. Idempotent - what is already inside (-PI, PI] is untouched.
  //
  // THE YAW ALONE. Pitch reaches no wrap - the peer bodies read a level
  // pitch (net/peerBodies.js peerCamera sets 0) and the dolls read none -
  // so wrapping it would move a field with no defect behind it, and
  // ONLINE1's own bound pin says what it says on purpose. An absurd pitch
  // is recorded, not paid.
  // MAC7: the arm's seven, clamped - a pose from before them reads sheathed, unswung, unarrowed and uncast
  return {
    x, y, z, yaw: wrapAngle(yaw), pitch, mv: mv === 2 ? 2 : mv ? 1 : 0,
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

/** WORLD6b-iii(b) THE CELL SEAM (D9: two players a pixel apart astride a cell edge were in two rooms). The HALO: the
 *  neighbouring cell rooms whose nearest pixel is within `reach` map pixels of (px, py) - Chebyshev, as inRange is -
 *  which a player hellos into besides its own cell. By symmetry everyone within RANGE_PIXELS of me is then a member
 *  of MY cell's room (a peer within range of me is within range of the cell I stand in), so a pose, a foes frame, a
 *  chat line sent to my own cell reaches every peer in range, and a halo room is posed into and listened to alone.
 *  `current` (the rooms held now) and `slack`: a held room stays until it is `reach + slack` away - the hysteresis
 *  that keeps a player pacing the edge from opening and closing a socket every step. The map's edge: no negative
 *  cell (the key regex admits none). */
export function cellHaloFor(px, py, { reach = RANGE_PIXELS, slack = 1, current = null } = {}) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return [];
  const held = current ? new Set(current) : null;
  const cx = Math.floor(px / WORLD_CELL), cy = Math.floor(py / WORLD_CELL);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx > 999 || ny > 999) continue;
    const ddx = dx < 0 ? px - (cx * WORLD_CELL - 1) : dx > 0 ? (cx + 1) * WORLD_CELL - px : 0;
    const ddy = dy < 0 ? py - (cy * WORLD_CELL - 1) : dy > 0 ? (cy + 1) * WORLD_CELL - py : 0;
    const d = Math.max(ddx, ddy);
    const key = `world:${nx},${ny}`;
    if (d <= reach || (held?.has(key) && d <= reach + slack)) out.push(key);
  }
  return out;
}

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

/** One client frame, parsed and checked: {t:'hello'|'pose'|'ping'|'chat'|'world'|'foes'|'hit'|'act'|'who', ...}
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
  if (m.t === 'who') {   // WORLD6b-iii(e): a member beyond the welcome's roster asked for by name, from a hello'd socket
    if (!hasHello) return { error: 'who before hello' };
    const id = whoIdOf(m);   // AUDIT WORLD6b-iii(e) B6: the name's law checked HERE as every scalar is (what the relay refuses the client never sends) - a bad one is an error, not a frame
    return id ? { t: 'who', id } : { error: 'bad who' };
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
/** WORLD6b-iii(e): the asks (`who`) a socket may make a second, at the relay and at home. ROSTER_MAX bounds the WELCOME
 *  (the nearest, AUDIT ONLINE A5), not the room: a member beyond it whose pose, foes or blow reaches me is asked for
 *  by name and answered with its join to the asker alone - a stranger is learned from the relay's own traffic. */
export const WHO_HZ_MAX = 5;   // AUDIT WORLD6b-iii(e) B5: a mass roster loss (a halo let go) re-learns its peers at this rate - at two a second twenty peers took ten seconds
/** AUDIT WORLD6b-iii(e) B1: the asks a ROOM answers a second, every socket together - the one arm past the hello that
 *  reads storage (a look), so it carries the room budget every other arm carries; over it the ask is dropped, nobody
 *  struck. A full room of sockets asking at their own rate was 1280 storage reads a second out of one object, for free. */
export const WHO_ROOM_HZ_MAX = 60;
/** WORLD6b-iii(e): how long a stranger asked for stays asked at home before the next of its frames asks again. */
export const WHO_RETRY_MS = 10_000;
/** AUDIT WORLD6b-iii(e) A1: the most Arrows a foe's body takes from peers' shafts (`ar` on the hit) - a shaft is one
 *  Arrow in DFU (BowDamage), and no fight puts this many into one body; past it the hit lands its blow and no Arrow (a
 *  crafted stream of `ar` frames minted a stack the projection then refused whole, and the pile with it). */
export const HIT_ARROWS_MAX = 255;
/** The who rate gate: WHO_HZ_MAX a second (WORLD6b-iii(e)). */
export const whoGate = (bucket, nowMs) => tokenGate(bucket, nowMs, WHO_HZ_MAX);
/** The action rate gate at home: ACT_HZ_MAX a second (WORLD3). */
export const actGate = (bucket, nowMs) => tokenGate(bucket, nowMs, ACT_HZ_MAX);
/** AUDIT WORLD4 A1: will this act frame FIT? ONE HOME, so a host can tell a refusal it may retry (the rate, which
 *  the next token heals) from one it never can (the size). A size refusal fed to WORLD3's refused-act heal is not a
 *  heal but a LIVE-LOCK: the key is re-read and re-refused every frame, and every later door is folded into the same
 *  oversized union frame and never sent. */
export const actFrameFits = (data) => JSON.stringify({ t: 'act', data }).length <= MAX_FRAME_BYTES;
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
