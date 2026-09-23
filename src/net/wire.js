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
//                    {t:'say', text}                    RED1: THE SERVER SPEAKING - only from a socket whose
//                                                       TOKEN carried the dev glyph; fanned as {t:'red', text, at}
//                    {t:'mute', order}                  MOD1: a mute ORDER the account service signed, carried by the moderator
//                                                       who asked for it; the room checks the signature, not the carrier (MUTE_HZ_MAX)
//                    {t:'world', data, final?}          the room's memory, from its host alone (WORLD1); final once, the farewell
//                    {t:'foes', data}                   the host's live foes, FOES_HZ_MAX a second at most (WORLD2)
//                    {t:'hit', data}                    a blow on the host's foe, from anyone but the host (WORLD2)
//                    {t:'act', data}                    a change to the room's doors, levers, movers and loot, from anyone in it (WORLD3/WORLD4)
//                    {t:'social', k, acct?, peer?, party?}   a friend or party act, in the HUB alone (SOC1): SOCIAL_HZ_MAX a second
//                    {t:'party', p}                     my party pose - where I stand and how I fare - to the hub (SOC1): PARTY_HZ_MAX a second
//   room -> client:  {t:'welcome', id, peers:[{id,name,look,pose,title?,glyphs?}], host, world, now}   now: the relay's clock, ms (WORLD5)
//                    {t:'join', id, name, look, pose, title?, glyphs?}   {t:'leave', id}
//                    ACC3: `title` and `glyphs` are read off the hello's VERIFIED token and are absent when there is no badge
//                    {t:'quest', quest:{questName, displayName, data}}   a quest shared with my party, to the hub alone (QUEST1): QUEST_HZ_MAX a second
//                    {t:'pose', id, p}                  {t:'pong'}
//                    {t:'chat', id, name, text, at, sub?}   to everyone who hears it, the sender included
//                    MOD1: `sub` is the sender's VERIFIED account id (the token's `s`), on a chat line and on a channel's
//                    roster rows and joins - what a moderator's /mute names, since a name is not unique and an id is.
//                    NOT `acct`: that word is the social hub's own account (SOC1), a different id with a different law
//                    {t:'muted', until}                 MOD1: to the muted player alone - `until` in epoch seconds, 0 when lifted
//                    {t:'host', id}                     the room's host changed (WORLD1)
//                    {t:'world', id, data}              the room's memory, to a socket whose welcome carried none (AUDIT WORLD34 C1)
//                    {t:'foes', id, data}               the host's live foes, to everyone but the host (WORLD2)
//                    {t:'hit', id, data}                a blow on the host's foe, to the host alone (WORLD2)
//                    {t:'act', id, data}                a change to the room's doors, levers, movers and loot, to everyone but its author (WORLD3/WORLD4)
//                    {t:'error', m}                     then the socket closes
//                    {t:'social', k:'state'|'presence'|'party'|'invite'|'note'|'error', ...}   the hub's word on my friends and my party (SOC1)
//                    {t:'party', acct, p}               a party member's pose, to the party alone (SOC1)
//                    {t:'quest', acct, name, quest:{questName, displayName, data}}   a party member's shared quest, to the party alone (QUEST1)
// A pose is {x, y, z, yaw, pitch, mv, wd, an, as, am, sr, cn, cr, ce, ar} in the room's frame -
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
// cast's range type (spellcast.js TARGET_TYPES' index) - MAC7 #2 - and ce
// its element (spellcast.js ELEMENTS, 0..4 - SPELLFX1: the missile a peer
// draws for it, the Unity co-op's cast visual), and ar the count of arrows
// the sender has loosed (SPELLFX1: the shaft a peer draws). A look is the paperdoll's recipe: race, gender,
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
import { TITLES, GLYPHS, GLYPHS_MAX } from './identityToken.js';   // ACC3: the badge vocabulary, closed - `badged` writes it and `readBadge` checks it back
import { nameAllowed } from './nameFilter.js';   // NAME-F2: the filter runs INSIDE sanitizeName, so the relay carries it - nameFilter.js imports nothing, same as mat4.js above, so the worker's graph stays flat

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
/** SPELLFX1: a cast's element on the wire - the classic element index (fire, frost, poison, shock, magic), the pose's `ce`. */
export const POSE_CAST_ELEMENTS = 5;
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

/** ═══ RED1: THE SERVER'S OWN LINE ════════════════════════════════
 *
 * Mac (2026-09-22): "I want to set up a red text system (kind of like
 * warframe) where I can message chat as the server."
 *
 * A LINE NOBODY IS SPEAKING. It carries no id and no name, because it
 * is not a person - which is also what makes it unforgeable in the
 * one way that matters: `net/chat.js`'s own note says a notice
 * recognised by the string 'Server' would be one rename away from a
 * player announcing a fake one, so this arrives as its OWN FRAME TYPE
 * and the client marks it from the type rather than from any field.
 *
 * IT IS BOUNDED LIKE A CHAT LINE because it IS one - `sanitizeChat`
 * runs on it at both ends. A broadcast is not a licence to put four
 * kilobytes over everybody's screen.
 *
 * RED_HZ_MAX IS DELIBERATELY BELOW CHAT_HZ_MAX. A player's line
 * reaches the room; this reaches EVERY PLAYER IN THE GAME, so the
 * thing that would be merely annoying at chat's rate is the whole
 * population's screen at this one.
 *
 * AND IT IS 1 RATHER THAN THE 0.5 THIS WAS FIRST WRITTEN AS, because
 * `tokenGate` CANNOT EXPRESS A RATE BELOW ONE A SECOND: a fresh bucket
 * starts with `rate` tokens and the gate needs a whole one, so at 0.5
 * the very first frame is refused and every one after it - the feature
 * would have been silently dead rather than slow. The pins caught it;
 * the constraint is now written down at `tokenGate` itself so the next
 * slice that wants "one every ten seconds" meets it before shipping.
 */
export const RED_HZ_MAX = 1;
/** MOD1: mute orders a socket may carry a second. One: an order is a
 *  moderator's deliberate act, and tokenGate cannot go lower. */
export const MUTE_HZ_MAX = 1;
/** Over-rate chat lines dropped in a row before the socket is closed. */
export const CHAT_STRIKES_MAX = 20;
/** The most sockets a CHAT room holds - one room hears the whole world, so it runs deeper than a cell's. */
export const CHAT_SOCKETS_MAX = 2048;
/** The most hellos a CHANNEL admits a second (AUDIT CHAT A1: the gate is never off; a channel's hello costs no look and no storage read, so it runs deeper). */
export const CHAT_HELLO_HZ_MAX = 50;
/** ROSTER-G (2026-09-16, Mac: "Players dont show in online"): THE CHANNEL HAS A ROSTER, and this is how many names its
 *  welcome carries. CHAT-R1 asked for "all currently online players" and the panel was wired to the PRESENCE
 *  session - the peers in the player's own map cell - so a friend two towns over never showed. The one room every
 *  player is in is the world channel (CHAT_WORLD_ROOM), so its welcome names who is in it ({id, name}, no look, no
 *  pose - nothing is drawn from a channel) and its join and leave are said. Nearest-first has no meaning in a channel;
 *  the list is socket order, cut at this many, and `n` in the welcome is the true count so a cut list still says
 *  how many are online. Above the panel's own ROSTER_ROWS_MAX (200) and a full event (SOCKETS_MAX, 256). */
export const CHAT_ROSTER_MAX = 512;
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
export function frameCap(text) { return text.startsWith(WORLD_PREFIX) ? WORLD_FRAME_MAX : text.startsWith(FOES_PREFIX) ? FOES_FRAME_MAX : text.startsWith(QUEST_PREFIX) ? QUEST_FRAME_MAX : MAX_FRAME_BYTES; }
/** AUDIT WORLD2 A5: a room's foes fan spends this many bytes a second - the frame's size times its listeners; one host
 *  at FOES_HZ_MAX and FOES_FRAME_MAX into SOCKETS_MAX listeners would have been 191 MiB/s out of one object. */
export const FOES_ROOM_BYTES_PER_S = 4 * 1024 * 1024;

/** QUEST1 (2026-09-20, revised): sharing an accepted quest with the party - systems/questShare.js's own envelope
 *  (Quest.getSaveData()'s shape). First measured at "a few hundred bytes to a few KB for most quests" - wrong in
 *  practice: a quest with several resources and a handful of full-text messages routinely runs past
 *  MAX_FRAME_BYTES (16 KiB), which a live report caught ("the quest is too complex to share" on an ordinary side
 *  quest, not an edge case). Given its own bigger cap instead, same reasoning FOES_FRAME_MAX gets one over
 *  MAX_FRAME_BYTES - and its OWN isolated arm in the pre-parse oversized-frame gate (_message, server/src/index.js),
 *  built separately from the WORLD_PREFIX/FOES_PREFIX one rather than folded into it: that arm's own law is
 *  world-room-shaped throughout (host-only frames, a cell's stream ingress budget) and none of that applies to a
 *  hub-scoped, per-party frame, so a quest frame is metered and capped on its own before falling through to the
 *  same parse+dispatch the ordinary path already has for `m.t === 'quest'`.
 *  Hub-scoped like 'social'/'party', not world-room-scoped like 'foes'/'act', because party members sharing a quest
 *  may not be standing in the same room at all - the one thing this act needs from the hub is "who is in my party
 *  right now", which the hub already tracks for the party pose view. A deliberate, rare, one-off player action, not
 *  a stream: QUEST_HZ_MAX is a full order of magnitude under even SOCIAL_HZ_MAX.
 *  It also does NOT use the generic social-act shape (whose validator is deliberately a closed
 *  {k, acct?, peer?, party?} set with no room for a payload field, AUDIT SOC B11) - it is its own top-level frame,
 *  same reasoning 'party' (the pose) already gets one instead of riding inside 'social'. */
/** The quest-share frame's own cap - FOES_FRAME_MAX's own scale, not MAX_FRAME_BYTES's: a quest's own save-data
 *  envelope (many resources, several full-text messages) is a state dump, not a chat line. */
export const QUEST_FRAME_MAX = 64 * 1024;
/** How a quest-share frame begins on the wire - same fast-prefix law as WORLD_PREFIX/FOES_PREFIX. */
export const QUEST_PREFIX = '{"t":"quest"';
/** Quest shares a socket may send a second, hub-side and at home - one player's deliberate click, never a stream. */
export const QUEST_HZ_MAX = 0.1;
/** The hub's own per-room bound on quest-share acts, the same shape SOCIAL_ROOM_HZ_MAX gives every other hub act. */
export const QUEST_ROOM_HZ_MAX = 8;
/** The longest a quest's own display name may run (UTF-16 units) - a party-chat note's bound on the words around it. */
export const QUEST_NAME_MAX = 80;
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
/** SLAM13 (2026-09-16, AUDIT SLAM A1): ONE SENDER'S SHARE OF THE ACT FAN. SLAM11 made the room's act bucket borrow so
 *  a big door lands whole - and a borrowing bucket is a bucket one sender can drive into debt on purpose: a modified
 *  client sending the largest act (MAX_FRAME_BYTES) to a full room charged 16 KiB x 255 = 4 MiB against a 1 MiB rate,
 *  four seconds of debt per frame, at ACT_HZ_MAX. Everyone else's doors, levers and chests were refused for as long as
 *  it kept it up. So a sender's fan is charged to ITS OWN borrowing bucket first, at a sixteenth of the room's rate,
 *  and only a frame its own bucket admits is charged to the room's: sixteen honest senders fill the room's rate
 *  exactly, one flooder can hold at most a sixteenth of it, and an honest door (a few KiB to a room) still lands
 *  whole and at once. */
export const ACT_SENDER_BYTES_PER_S = ACT_ROOM_BYTES_PER_S / 16;
/** AUDIT WORLD6b-iii(c) C3: the room's HIT bytes a second, fanned - the hit frame carries a corpse's GRANT since
 *  WORLD6b-iii(c) (up to a frame's worth of items), so the arm that was a 150-byte control channel is a bulk one and
 *  counts its bytes as the foes and the acts do (AUDIT WORLD3 A1's law); over it a blow is dropped, nobody struck. */
export const HIT_ROOM_BYTES_PER_S = 256 * 1024;
/** WORLD3: a client's action frames a second - a click's worth, on their own bucket at the relay (a door never
 *  starves a pose) and refused to the caller at home past it. */
export const ACT_HZ_MAX = 5;
/** A byte budget: `rate` bytes a second, a second's worth at most; passes when the cost fits, spending it. */
/** A byte bucket of `rate` a second.
 *
 *  SLAM11 (2026-09-16, AUDIT SLAM): `borrow`. The bucket is CAPPED at `rate`, so without it a single charge larger than
 *  `rate` can never pass - not slowly, NEVER, however long the caller waits - and three arms charged a whole fan
 *  (`frame x listeners`) indivisibly. The dungeon's memory push at 200 players with a 100 KiB memory was 19.5 MiB
 *  against a 4 MiB cap: 0 of 199 sockets were ever handed the room's memory, it latched nothing and retried the same
 *  unpayable sum on every publish, and doors, levers and emptied containers silently never synced. The act fan had
 *  the same cliff at ~5 KiB while `actFrameFits` told its author 16 KiB would land.
 *
 *  With `borrow`, a frame passes when the bucket is not IN DEBT (`bytes >= 0`) and takes the bucket negative by
 *  whatever it costs; nothing else passes until the rate has repaid the debt. The RATE law holds on average, the
 *  debt is bounded by one fan (nothing passes while negative), and a must-deliver fan lands whole rather than
 *  never. It is for arms whose frame MUST reach everyone and comes rarely - the memory, a door - and NOT for a
 *  continuous stream like the foes, where one oversized fan would block the next second of frames and dropping
 *  the frame whole is the kinder failure (the next full frame heals it). */
export function byteGate(bucket, nowMs, cost, rate, borrow = false) {
  const b = bucket ?? { bytes: rate, at: nowMs };
  const bytes = Math.min(rate, b.bytes + Math.max(0, ((nowMs - b.at) / 1000) * rate));
  if (borrow ? bytes < 0 : bytes < cost) return { bucket: { bytes, at: nowMs }, pass: false };
  return { bucket: { bytes: bytes - cost, at: nowMs }, pass: true };
}
/** Every channel the relay will open (AUDIT CHAT A1: a whitelist - a later tab is a later entry, and nothing else is a channel). */
export const CHAT_ROOMS = Object.freeze(new Set([CHAT_WORLD_ROOM]));

// SOC1 (2026-09-16, Mac: "A social button next to the chat UI ... friend other users, see if they are online/last
// online + be able to invite friends or other individuals to the new 4 person party system"): THE HUB'S LAW.
//
// WHERE SOCIAL STATE LIVES. Every player online holds one socket in the world channel (CHAT_WORLD_ROOM - the chat's
// World tab, ROSTER-G's "the one room every player is in"), so that room's Durable Object is the one place that can
// see everyone at once, and it is THE HUB: friendships, pending requests, presence and last-seen, and the parties
// live in its storage and nowhere else. A presence room (a cell, a dungeon, a building) learns nothing new and is
// changed by nothing here - a party member's name is green because the hub told MY client which peer ids are my
// party's, not because a presence hello said "I am in a party" (a self-declared claim in a room that cannot check it).
//
// TWO IDENTITIES, BOTH GUARDED. A PEER id is a tab's (TABS1: minted per tab, so two tabs are two players), which is
// exactly wrong for a friend list: a friend is a person, and a person is a browser profile that outlives every tab.
// So a hello to the hub may carry an ACCOUNT id (`acct`) and its secret (`asecret`) beside the peer's - the same
// shape and the same law as the peer's pair (ID_RE, SECRET_RE; the first hello mints, a later one must match, AUDIT
// ONLINE A3) - minted once per browser profile (net/online.js accountId, in the app's own storage). The chat link
// already carries the tab's peer id and secret, so the hub verifies BOTH ends of the mapping peer -> account, and
// every frame it sends names peers by the ids the presence rooms already show. A client with no account (a build
// before this slice) is admitted as before: the chat works, the social arms answer 'no account'.
//
// WHAT AN ACT NAMES. A social act names its target as `acct` (an account id, from my own lists) or as `peer` (a peer
// id, the one thing I can see of a stranger in the world - the hub resolves it to the account behind that socket),
// or as `party` (a party id, from an invite). The hub composes no English for the CHAT: a note is a CODE
// (NOTE_CODES) and the client says it in words; an `error` is the hub's refusal of ONE act, in words, and closes
// nothing - a refused friend request is not a protocol violation.
//
// THE BOUNDS. FRIENDS_MAX friends, PENDING_MAX requests each way (and PENDING_MAX party invites held), PARTY_MAX
// in a party, PARTY_INVITES_MAX invites outstanding from one party, an invite good for INVITE_TTL_MS; a seat kept
// PARTY_OFFLINE_MS after its member drops (a refresh, a blip - the hello brings them straight back), and a party
// whose every seat has lapsed is gone. Accounts are never forgotten (a friend list that forgets people is worse than
// the kilobyte a record costs), parties are forgotten when the hub drains (a channel's sweep - nobody is online to
// hold one).
/** The hub: the room whose object keeps the social state. The World channel - the one room everyone online is in. */
export const SOCIAL_ROOM = CHAT_WORLD_ROOM;
/** Is this key the hub's. */
export const isSocialRoom = (key) => String(key ?? '') === SOCIAL_ROOM;
/** The most social acts a socket may send a second (a friend request, an invite, a leave); the same strikes as the poses. */
export const SOCIAL_HZ_MAX = 2;
/** The most social acts the whole HUB answers a second, every socket together - an act is a few storage reads and writes,
 *  and a room-wide bound is what every other arm carries (AUDIT CHAT A2's law); over it the act is refused with 'busy'. */
export const SOCIAL_ROOM_HZ_MAX = 64;
/** The most party poses a socket may send a second; the client sends one a second at most, and only when it changed. */
export const PARTY_HZ_MAX = 2;
/** The client's own floor between two party poses, ms (half the relay's rate, so a late one never trips the gate). */
export const PARTY_SEND_MS = 1000;
/** The client's own floor between two quest shares, ms - QUEST_HZ_MAX's own period (one every ten seconds), so the
 *  client never even tries a send the hub would only drop. */
export const QUEST_SEND_MS = 10_000;
/** The most friends an account keeps. */
export const FRIENDS_MAX = 64;
/** The most requests an account holds each way, and the most party invites it holds. */
export const PENDING_MAX = 32;
/** A party's size. SOC1 shipped Mac's "4 person party system"; PARTY8 (Mac, 2026-09-22: "increase the party limit
 *  to 8") doubles it. Every rate the hub and the client derive from it (PARTY_IN_HZ_MAX, QUEST_IN_HZ_MAX,
 *  QUEST_IN_MIN_MS) follows, and the relay version below moves with it - a party of five is a frame a world93 client
 *  refuses. */
export const PARTY_MAX = 8;
/** The most invites one party has outstanding at once. */
export const PARTY_INVITES_MAX = 8;
/** How long a party invite stands before it is nothing. */
export const INVITE_TTL_MS = 120_000;
/** How long a party seat is kept for a member that went offline - a page refresh, a dropped line - before it lapses. */
export const PARTY_OFFLINE_MS = 5 * 60 * 1000;
/** The most tabs (peer ids) one account is named with in a row - an account with more is not one person. */
export const ACCOUNT_TABS_MAX = 8;
/** A place name's bound on a party pose (UTF-16 units). */
export const PARTY_LOC_MAX = 32;
/** A hub error's bound (UTF-16 units) - the hub's refusal of one act, in words. */
export const SOCIAL_ERROR_MAX = 120;
/** The map's size in pixels - a party pose's `px`/`py` lie on it (MapsFile: 1000 x 500). */
export const MAP_PIXELS_X = 1000;
export const MAP_PIXELS_Y = 500;
/** Every act a client may send the hub, and what each must name: 'acct' an account, 'peer' a peer, 'target' either one, 'party' a party, '' nothing. */
export const SOCIAL_ACTS = Object.freeze({
  'friend.request': 'target', 'friend.accept': 'acct', 'friend.decline': 'acct', 'friend.cancel': 'acct', 'friend.remove': 'acct',
  'party.invite': 'target', 'party.accept': 'party', 'party.decline': 'party', 'party.leave': '', 'party.kick': 'acct',
});
/** Every note the hub says, as a code the CLIENT puts words to (net/social.js noteText) - the relay writes no chat line. */
export const NOTE_CODES = Object.freeze(['friend.requested', 'friend.accepted', 'party.invited', 'party.declined', 'party.joined', 'party.left', 'party.kicked', 'party.leader', 'party.lapsed']);
/** Every frame the hub sends under t:'social'. */
export const SOCIAL_KINDS = Object.freeze(['state', 'presence', 'party', 'invite', 'note', 'error']);

// AUDIT SOC (2026-09-16, Mac: "Can we do an audit of everything just merged. Just want it to be perfection"): the
// hub's four lenses found the bounds SOC1 had not written, and they live here beside the ones it had.
/** AUDIT SOC A1/A8: the least time between two acts of one KIND at the SAME target from one account - a friend
 *  request or a party invite re-sent inside it is 'already asked': nothing written, nothing fanned. The room-wide
 *  chat law bounds what everyone hears; a DIRECTED act costs its target a state frame and a chat line, and a
 *  request/cancel pair measured as a 40x amplifier aimed at one player. */
export const SOCIAL_REPEAT_MS = 60_000;
/** AUDIT SOC A3: an account NOBODY'S LIST NAMES - no friends, no request either way, no live invite, no party - is
 *  forgotten this long after it was last seen. "A friend list that forgets people is worse than a kilobyte" stands
 *  for every account a list names; a record no list names dangles nothing when it goes, and without this one script
 *  at the hello gate's rate minted 4.3 million permanent records a day. */
export const ACCOUNT_IDLE_MS = 30 * 24 * 3600 * 1000;
/** AUDIT SOC A3/A4: the hub sweeps on an alarm this often, one bounded page of records and of parties per firing
 *  (SWEEP_PAGE, the runtime's batch size), and a page that was full is followed SWEEP_STEP_MS later. */
export const ACCOUNT_SWEEP_MS = 6 * 3600 * 1000;
export const SWEEP_STEP_MS = 60_000;
export const SWEEP_PAGE = 128;
/** AUDIT SOC B3: the client's gate on social frames COMING IN, per room - CHAT-G's law, again: the relay is the
 *  player's choice, and a frame it pushes faster than an honest hub could is not the port's. An honest hub spends at
 *  most its room budget in derived frames (SOCIAL_ROOM_HZ_MAX), and the hello gate's rate in presence, so this admits
 *  an honest hub at full tilt. */
export const SOCIAL_IN_HZ_MAX = SOCIAL_ROOM_HZ_MAX;
export const socialInGate = (bucket, nowMs) => tokenGate(bucket, nowMs, SOCIAL_IN_HZ_MAX);
/** AUDIT SOC B3: a note or an error becomes a CHAT LINE (a line nobody sent), and net/chat.js keeps CHAT_KEEP of them -
 *  so those two kinds carry a rate of their own, well under the chat's, because an honest hub's notes are bounded by
 *  the reader's own lists (PENDING_MAX requests, PENDING_MAX invites, a party of PARTY_MAX). */
export const NOTE_IN_HZ_MAX = 10;
export const noteInGate = (bucket, nowMs) => tokenGate(bucket, nowMs, NOTE_IN_HZ_MAX);
/** AUDIT SOC B3: the poses of a party's other members, at PARTY_HZ_MAX each. */
export const PARTY_IN_HZ_MAX = PARTY_HZ_MAX * (PARTY_MAX - 1);
export const partyInGate = (bucket, nowMs) => tokenGate(bucket, nowMs, PARTY_IN_HZ_MAX);
/** QUEST1: the worst case at home - every OTHER party member sharing at their own outgoing rate. */
/** QUEST1 BUG, same flaw as questShareGate's own (above): tokenGate's bucket cap means a sub-1 rate never passes.
 *  This gated the RECEIVER's side - even a successfully-sent quest share would have been silently dropped here,
 *  every time. Fixed the same way: a cooldown between individually-arriving frames rather than a token bucket.
 *  QUEST_IN_HZ_MAX is kept as the worst-case sustained rate this describes (every other party member sharing at
 *  their own throttled rate); QUEST_IN_MIN_MS is the matching per-frame spacing. */
/** AUDIT PARTY8: the hub's quest fan pays in bytes (server/src/index.js, the quest arm) - a share's frame times the
 *  tabs it reaches. Four MiB a second, borrowing, lets one full party's largest share land whole each second and
 *  makes a second one wait, where the rate gate alone let eight 3.5 MiB fans through. (QUEST_IN_HZ_MAX and
 *  QUEST_IN_MIN_MS, the receiver-side rates this comment once named, had no reader; the receiver's own gate is
 *  questInGate below, per sender at QUEST_HUB_MIN_MS.) */
export const QUEST_ROOM_BYTES_PER_S = 4 * 1024 * 1024;
/** AUDIT DROPS C2: keyed PER SENDER (account) at home, not per room - two members sharing within QUEST_IN_MIN_MS
 *  of each other lost the second share to a per-room cooldown the honest hub was said never to trip. Each sender
 *  is held to half their own floor (QUEST_HUB_MIN_MS), the same rule the hub applies. */
export const questInGate = (at, nowMs) => (at != null && nowMs - at < QUEST_HUB_MIN_MS ? { at, pass: false } : { at: nowMs, pass: true });

/** AUDIT SOC B20: the widest frame an honest relay sends a client - a welcome carrying a room's memory (WORLD_FRAME_MAX)
 *  and a full roster of hellos (ROSTER_MAX looks, each under the hello's own MAX_FRAME_BYTES). Past it a frame is
 *  dropped UNPARSED: JSON.parse of a relay's megabytes was the one cost no door bounded, and the relay is the
 *  player's choice. */
export const INBOUND_FRAME_MAX = WORLD_FRAME_MAX + ROSTER_MAX * MAX_FRAME_BYTES;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const uint = (v, max) => (finite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : null);
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{8,64}$/;
/** ACC1d: what an identity token LOOKS like - `v1.<base64url body>.<base64url sig>`,
 *  which is `src/net/identityToken.js`'s own shape. Bounded because an
 *  unbounded string reaches WebCrypto on the relay, and the verifier
 *  refuses an oversized one anyway (TOKEN_MAX there); this is the
 *  cheaper refusal, before a frame is even accepted.
 *
 *  THE VERSION PREFIX IS NOT SPELLED OUT HERE. identityToken.js is the
 *  one home for which version exists and the verifier refuses anything
 *  else before parsing a byte; a second copy of `v1` in this file would
 *  be a second thing to forget on the day there is a v2. */
const TOKEN_RE = /^[A-Za-z0-9]{1,8}\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{1,128}$/;

/** The name a refused one becomes. Not a mask (`C**` is a shape a
 *  player treats as a puzzle) and not an error the relay could not
 *  deliver anyway - just the default everyone starts as. */
export const FALLBACK_NAME = 'Traveller';

/**
 * A name the room will show: printable ASCII, trimmed, bounded, never
 * empty - and NAME-F2, never one the filter refuses.
 *
 * THE FILTER RUNS HERE BECAUSE HERE IS THE ONLY PLACE IT CANNOT BE
 * SKIPPED. The pane refuses a bad name at entry with a reason, which
 * is the half a player sees; this is the half that holds when the
 * client is not ours. `parse` runs it on every `hello` the relay
 * takes, and the client runs it again on every peer name it is told -
 * so a modified client can neither publish a refused name nor be shown
 * one. A check that only lives in the UI is a check that a devtools
 * console removes.
 *
 * Idempotent, as the rest of this module is: what comes out is a name
 * the filter allows, so running it twice changes nothing.
 */
export function sanitizeName(name) {
  let s = '';
  for (const ch of String(name ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) s += ch; }
  s = s.trim().slice(0, NAME_MAX);
  if (!s) return FALLBACK_NAME;
  return nameAllowed(s) ? s : FALLBACK_NAME;
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
/** AUDIT WATCH1 A1: THE WATCH HAS ITS OWN ALLOWANCE. A criminal's frame is its encounter foes AND its watch, and the
 *  watch rides behind the foes - so under one cap of eight a criminal carrying a full encounter roll streamed a watch
 *  no reader ever stood (the cap counts standing puppets, so no later frame could get one in). The watch is counted
 *  apart: SpawnCityGuards stands at most five, but makeNpcGuardsIntoEnemies converts a town's whole wandering-guard
 *  population uncapped, so ten. */
export const CELL_WATCH_PUPPETS_MAX = 10;
export const FOE_SEQ_MAX = 1e9;
export const FOE_HEALTH_MAX = 1e5;
/** AUDIT ONCRASH1 A3: the most effect bundles a stored foe record may carry - the one list in a memory's foe with no other bound. */
export const SHARED_EFFECTS_MAX = 64;
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

/** AUDIT ONCRASH1 A3/B4b: ONE STORED FOE RECORD, PROJECTED - the memory's door, which had none.
 *
 *  `restoreSharedWorld` (scenes/dungeonContext.js) already projects the memory's ACTIONS through
 *  `validActionRecord` and drops its piles, for a reason it writes down: the relay serves a room's stored bytes back
 *  UNPARSED for WORLD_TTL_MS, so one bad record in a memory poisons every joiner for thirty days. Its FOES went
 *  through raw, and `patchFoe` writes `f.entity.health = sf.health`, `f.ai.feet[0] = sf.feet[0]` and
 *  `f.ai.yaw = sf.yaw` with no check at all - an absent `feet` THREW out of the socket handler (the incident is in
 *  that function's own comment, which fixed the ITEMS and left the rest) and a string `yaw` made the foe's facing
 *  NaN for the life of the dungeon.
 *
 *  The vocabulary is exactly what `sharedWorld` writes - `items` is deleted there, so it is not admitted here
 *  ("what this client will not say, it will not hear", AUDIT WORLD4 D3). A field outside its law is DROPPED, not
 *  clamped onto a neighbour; a record with a bad field is refused WHOLE, never half landed. Presence-gated
 *  throughout, because `patchFoe` reads every optional field with `!= null` and a record from an older build carries
 *  fewer.
 *  @param {*} sf
 */
/** RESPAWN1: the longest MobileTeams name is 'PlayerEnemy' at 11; 32 is the
 *  same shape of headroom every other string on this wire is given. */
export const TEAM_NAME_MAX = 32;

export function validSharedFoe(sf) {
  if (!sf || typeof sf !== 'object' || Array.isArray(sf)) return null;
  const out = {};
  // the feet: the pose's own bounds, the same three numbers a pose carries
  if (sf.feet !== undefined) {
    if (!Array.isArray(sf.feet) || sf.feet.length !== 3 || !sf.feet.every(finite)) return null;
    if (Math.abs(sf.feet[0]) > POSE_BOUND || Math.abs(sf.feet[2]) > POSE_BOUND || Math.abs(sf.feet[1]) > POSE_Y_BOUND) return null;
    out.feet = [sf.feet[0], sf.feet[1], sf.feet[2]];
  }
  if (sf.yaw !== undefined) { if (!finite(sf.yaw)) return null; out.yaw = wrapAngle(sf.yaw); }   // ONCRASH1: bounded here too, not at validPose alone
  for (const k of ['health', 'maxHealth', 'magicka', 'fatigue']) {
    if (sf[k] === undefined) continue;
    if (!finite(sf[k]) || sf[k] < -FOE_HEALTH_MAX || sf[k] > FOE_HEALTH_MAX) return null;
    out[k] = sf[k];
  }
  if (sf.died !== undefined && sf.died !== null) { if (!finite(sf.died)) return null; out.died = sf.died; }
  if (sf.mobileType !== undefined) { if (!Number.isInteger(sf.mobileType) || sf.mobileType < 0 || sf.mobileType > 255) return null; out.mobileType = sf.mobileType; }
  if (sf.gender !== undefined && sf.gender !== null) { if (typeof sf.gender !== 'string' || sf.gender.length > 16) return null; out.gender = sf.gender; }
  // RESPAWN1 (2026-09-17, Mac, from a patch he was sent): THE TEAM PAIR IS A
  // STRING, AND THIS ASKED FOR A NUMBER - so every foe record a dungeon ever
  // published was refused WHOLE and the memory came back EMPTY.
  //
  // `entity.team` is `MobileTeams`' NAME in this port, not its ordinal -
  // 'PlayerEnemy', 'PlayerAlly', 'Vermin' (characters/enemyEntity.js:146's
  // default, characters/enemyTargets.js' whole law, `f.entity.team ===
  // 'PlayerAlly'` at combat/playerWeapon.js:230) - and the publisher hands the
  // live field straight over (dungeonContext.js' foe record, AUDIT 63 F26's
  // pair). DFU's own serializer writes the ORDINAL there
  // (SerializableEnemy.cs:125 `(int)entity.Team + 1`), which is where the
  // number in this line came from; the port's records never carried one.
  // EVERY foe carries a team, so `validSharedFoe` answered null for every
  // record, `.filter(Boolean)` dropped the lot (dungeonContext.js' restore),
  // and a dungeon's dead stood up again however correctly the kill had been
  // stamped, stored and sent. The pin that should have caught it passed
  // `team: 2` - it encoded the same wrong reading as the code.
  for (const k of ['team', 'mobileTeam']) {
    if (sf[k] === undefined) continue;
    if (typeof sf[k] !== 'string' || sf[k].length > TEAM_NAME_MAX) return null;
    out[k] = sf[k];
  }
  for (const k of ['dead', 'hostile', 'encountered', 'wabbajackActive', 'specialTransformationCompleted']) if (sf[k] !== undefined) out[k] = !!sf[k];
  if (sf.anchor !== undefined) out.anchor = sf.anchor;   // REVIEW 2026-09-05's stamp: read for its presence alone
  // The effect bundles ride as they are - `patchFoe` copies them shallowly and the effect spine reads them by name -
  // but the LIST is bounded, because it is the one field a memory's foe can grow without bound.
  if (sf.activeEffects !== undefined) {
    if (!Array.isArray(sf.activeEffects)) return null;
    out.activeEffects = sf.activeEffects.filter((a) => a && typeof a === 'object' && !Array.isArray(a)).slice(0, SHARED_EFFECTS_MAX);
  }
  return out;
}

/** SLAM1 (2026-09-16, Mac: Daggerfall's 30th, a streamer's server slam): THE LISTENERS ONE POSE REACHES AT ONCE.
 *
 *  A pose reaches everyone a room holds within range, so a room's cost is N senders times N listeners - measured over
 *  the real Room on the fake Durable Object, a crowd standing together costs 2.4k sends a second at 16 players,
 *  22.6k at 48 and 91.2k at 96 (SLAM13 struck a clause here that claimed to know where a real object stops keeping
 *  up; the fake carries no such limit and nothing has measured the deployed one - see AUDIT SLAM C1). RANGE DOES NOT
 *  SAVE IT: the cull is why a cell is cheap when the country is spread out, and an event is precisely everybody
 *  converging on one spot, where every range test passes.
 *
 *  What saves it is that nobody can SEE two hundred people at once. A name stops at NAME_RANGE (60 scene units), at
 *  most BODIES_MAX (8) peers ever stand in a Morrowind body, and the rest are billboards in a crowd. So this many
 *  listeners - the nearest - hear every pose the sender says. The cost stops being N squared.
 *
 *  SLAM6 (2026-09-16, AUDIT SLAM): AND THE REST HEAR THE SAME POSES LESS OFTEN, which is the half SLAM1 got wrong.
 *  SLAM1 stopped here, and a listener past the bound heard NOTHING from that sender - so the silence law (AUDIT
 *  ONLINE B3/B11/B14) HID it after PEER_TIMEOUT_MS. That is not a peer gone quiet, it is a peer ERASED, and it
 *  falls hardest on exactly the player an event is held for: the bound is a RANK, so the DENSEST player in the room
 *  reaches the SMALLEST radius. Measured over this law at 200 players standing in one town block, the man in the
 *  middle was heard by 32 of 199 and hidden from the other 167, whichever way the crowd was spread. */
export const POSE_FAN_MAX = 32;

/** SLAM6: one pose in this many is heard by a listener past POSE_FAN_MAX - the FAR TIER's share.
 *
 *  NOT A GUESS, and not a budget: it is the largest share the client's own ease can still walk. A peer is eased over
 *  its OWN observed interval (net/online.js `tick`, `_arrive`), and that interval is clamped at GAP_MAX_MS - past it
 *  the ease finishes early and the peer STANDS until the next pose. A far listener's interval is `share / hz`, and
 *  the crowded rate never falls below POSE_HZ_MIN (net/online.js poseHzFor), so the largest share that keeps every
 *  far peer WALKING is POSE_HZ_MIN * GAP_MAX_MS / 1000 = 4. Above the crowd threshold hz is higher and the interval
 *  is shorter still; below it no room is over the bound at all and this never applies.
 *
 *  The cost is arithmetic, not observation: a pose costs at most `POSE_FAN_MAX + ceil((n - 1 - POSE_FAN_MAX)/share)`
 *  sends instead of `n - 1`. At 200 players in one room at 4 Hz that is 59.2k sends a second against 159.2k
 *  unbounded - and against SLAM1's 25.6k, which bought the saving by hiding 84% of the room from each sender. Run
 *  over this law across a 30-second standing, uniform and packed alike: 59.0k a second, every one of the 199
 *  listeners heard the man in the middle, and the longest any of them went without him was 1000ms, exactly
 *  GAP_MAX_MS. At SOCKETS_MAX (256) the same sum is 89.9k - a sum over the law, on the fake; what a deployed object
 *  carries is unmeasured (AUDIT SLAM C1). */
export const POSE_FAR_SHARE = 4;

/** A pose goes out at least this often, moved or not: the peers' clock and the silence law's safety net. SLAM13 moved
 *  it here from net/online.js, because the relay's keepalive floor (KEEPALIVE_FAN_MS) is a fraction of it and the two
 *  must never be tuned apart.
 *
 *  RELAY-H1 (2026-09-20, Mac: "cloudflare hit its limit"): 5000 -> 20000, AND THE SOCKET'S LIVENESS IS NO LONGER THIS
 *  FRAME'S JOB. A pose is a message, a message is an event at the Durable Object, and Cloudflare bills duration for
 *  every second an object is awake; "billable duration does not accrue during hibernation" and "incoming requests
 *  prevent hibernation" are the platform's own words. A standing player sent one every five seconds, so a room with
 *  anyone in it never slept - the whole free tier (13,000 GB-s a day) was ~7 player-hours, and it was gone mid-stream.
 *  The runtime answers `{"t":"ping"}` in the object's SLEEP (server/src/index.js setWebSocketAutoResponse), so the
 *  socket's liveness rides a ping at PING_MS and the pose is sent only when it MOVED, or every HEARTBEAT_MS as the
 *  peers' proof of life. Four times fewer wakes from a standing player, and gaps a hibernation can fit in. */
export const HEARTBEAT_MS = 20000;
/** RELAY-H1: the socket's own keepalive - a ping the runtime answers without waking the object. Derived from the
 *  heartbeat so the two cannot be tuned apart: four pings to a pose, which keeps today's five-second on-wire cadence
 *  (the cadence intermediaries and phones were already proven against) while the object sleeps between poses. */
export const PING_MS = HEARTBEAT_MS / 4;
/** SLAM13 (2026-09-16, AUDIT SLAM A2): A KEEPALIVE IS HEARD BY THE WHOLE CROWD AT MOST THIS OFTEN. SLAM8 fans an
 *  unmoved pose to everyone in range, untiered, because a standing player's heartbeat is the one frame whose whole job
 *  is to be heard - and it assumed that frame comes every HEARTBEAT_MS, which is what the port's client does. A
 *  modified client sends unmoved poses at the pose gate's ceiling (POSE_HZ_MAX, 20 Hz), and every one of them went to
 *  the whole room: 20 x 199 = 3,980 sends a second from ONE socket, 40x what a standing player costs and beyond what
 *  the tier bounds a mover to. So the whole fan is served to a keepalive only when the sender's LAST whole fan is at
 *  least this old; a keepalive inside the floor is tiered like a move. Half the heartbeat, so an honest client's
 *  every heartbeat still clears it with a late one's jitter to spare, and a flood buys nothing past 2 whole fans a
 *  second. The standing margin SLAM8 asserted holds: the whole fan still comes at every heartbeat. */
export const KEEPALIVE_FAN_MS = HEARTBEAT_MS / 2;

/** AUDIT WORLD34 D4: the relay names itself in /health - the deploy is by hand (`npx wrangler deploy`), nothing in
 *  CI does it, and until now nothing said which relay was live. Bump it with every relay-changing slice; since SLAM8
 *  test/relayversion.test.js binds each version to the bytes of the law and fails until the bump is made.
 *
 *  SLAM13 (2026-09-16, AUDIT SLAM A5): moved here from server/src/index.js so BOTH ENDS know the name. The welcome
 *  carries it (`v`), and a client whose wire.js was built against another version says so on the console: the client
 *  is deployed by CI and the relay by hand, so a skew between them is the ordinary state of a release day, and until
 *  now nothing on either end could see it. */
export const RELAY_VERSION = 'world100';   // DISC7 (2026-09-23): the pose's half-speed bit (`hs`, mounted and moving slower than half, omitted at 0) - the peers' clop swaps as the rider's own does - world100. Before it: HCC-PARK + RIDE (2026-09-23): the `park` frame (a cell keeps a parked team past its owner's presence; the owner's registry drops the old cell's record), and the pose's mount (`rd`/`rv`, omitted on foot) - world99. Before it: SPELLFX1 (2026-09-23, the friendly-spells drop): the pose carries the cast's element (`ce`) and the arrows loosed (`ar`), so a peer's missile and shaft can be DRAWN - the Unity co-op's RpcPlayPlayerSpellCastVisual; visual only, it lands nothing, and a pose from before it reads Magic and no shafts; and the sender's cast meter a whole blast deep (CAST_BURST_MAX), since a beneficial blast is one cast and one frame per mate - world98. Before it: AUDIT ALLY-CAST (2026-09-23): the cast frame's honest bounds (level 30, byte components, a touch or a ranged target, the icon), the destination's funnel per sender - world97. Before it: ALLY-CAST (2026-09-23): the `cast` frame - a beneficial spell at a party mate, directed like a trade frame, the receiver deciding what lands - world96. Before it: AUDIT PARTY8 + AUDIT PARTY-REST (2026-09-23): the party pose carries `readyAt` (a vote's shared-clock stamp, read for freshness by every party mate), the quest fan pays in bytes (QUEST_ROOM_BYTES_PER_S), a lapse burst says the lead once and the lead passes to a seat that is online - world95. Before it: PARTY8 (2026-09-22): PARTY_MAX 4 -> 8 - a party frame's member bound, so a world93 client and this hub must not meet - world94. Before it: PARTY-REST DROP (2026-09-22): the party pose grew `rest.kind`, `voteAt`, `restEnemyAt`, `restCancelFor`/`restCancelAt`, `restStartedAt`, and `bk` is a full 32-bit key (PARTY-REST9) - world93. Before it: AUDIT DROPS (2026-09-22): the trade bytes budgeted per sender (B3), the hub's quest cooldown at half the client's floor (C1), the quest budget spent only on a share with a party to reach (C3) - world92. Before it: QUEST1 + TRADE1 + PEER-FS1 (2026-09-22, three drops in one deploy): the quest frame (a party member's quest, shared), the trade frame (a courier between two peers) and the pose's footstep byte. Before them: RELAY-H1: KEEPALIVE_FAN_MS follows HEARTBEAT_MS 5000 -> 20000 (the floor is 10 s now)   // ONLINE-CLASS1: a look carries the character's class name, so a peer without a Morrowind body stands as its class-enemy sprite   // ACC1d: the hello carries an identity token and the relay verifies the name out of it   // ACC1g: and the token is REQUIRED - a hello the relay cannot verify is refused, so a name can no longer be typed   // ACC3: the token carries a TITLE and GLYPHS, and `badged` puts them on the welcome's rows, the join and the channel roster - read off the signature, never off the client   // RED1: the server's own red line - `say` in, `red` out, and the authority is the dev glyph the token already carried   // MOD1: the mute order (`{t:'mute', order}` in, `{t:'muted', until}` out), `sub` on chat lines and a channel's roster, the `mu` claim - world90

/** The listeners sorted by distance from `from`, nearest first; one with no pose yet sorts last, because a peer that
 *  has never said where it is cannot be near. The ordering is Euclidean in the POSE'S OWN FRAME, which is a cell's
 *  world units or a place's scene units - it never leaves one room, so it never has to agree across the two. */
function ranked(list, from, poseOf) {
  const d2 = (x) => {
    const p = poseOf(x);
    if (!p || !from || !finite(p.x) || !finite(p.z)) return Infinity;
    const dx = p.x - from.x, dz = p.z - from.z;
    return dx * dx + dz * dz;
  };
  return list.map((x) => [d2(x), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
}

/** The nearest `max` of `list` to `from`. Under the bound the list is returned AS IT IS (no sort, no copy) - the
 *  whole point is to cost nothing in the rooms that do not need it. The WELCOME's door (rosterFor). */
export function nearestFan(list, from, poseOf, max = POSE_FAN_MAX) {
  if (!Array.isArray(list) || list.length <= max) return list;
  return ranked(list, from, poseOf).slice(0, max);
}

/** SLAM10 (2026-09-16, AUDIT SLAM): a 32-bit FNV-1a over a string. Not for secrecy - for a BUCKET that is a function
 *  of the listener and nothing else, so the far tier's rotation cannot be shuffled by where anybody is standing. */
export function hashKey(s) {
  let h = 0x811c9dc5;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** SLAM6: the listeners THIS pose goes to - the nearest `max`, every pose, and one turn of the far tier; the near
 *  ones simply hear it `share` times as often as the rest. Under the bound the list is returned AS IT IS, exactly as
 *  `nearestFan`.
 *
 *  SLAM10 (AUDIT SLAM): THE FAR TIER IS BUCKETED BY WHO THE LISTENER IS, NOT BY WHERE IT RANKS. SLAM6 cut the far
 *  listeners into `share` slices of a list `ranked()` re-sorts on every pose, and served slice `turn % share`. A rank
 *  is not a stable thing: when the crowd moves, ranks shuffle, a listener crosses a slice boundary between two turns
 *  and is served twice or not at all, and "once every `share` poses" was true only for a crowd standing perfectly
 *  still - which was the one case SLAM6 measured before publishing it as a guarantee. Measured on the shipped law at
 *  200 in one block: never-heard stayed 0 at every speed (SLAM6's erasure fix held), but 15% of sender-listener pairs
 *  went longer than GAP_MAX_MS between poses at a shuffle and 50% at a walk, with worst gaps over 6 s - a far peer
 *  sprinting six seconds of walking in one and then standing frozen for five, which is the exact artefact
 *  POSE_FAR_SHARE was derived to prevent. A listener is now served on the turn `hashKey(keyOf(listener)) % share`,
 *  which depends on its id alone; over any `share` consecutive poses every far listener is served exactly once,
 *  whatever the crowd does, by construction. The near set is still the nearest `max` by distance: that half of the
 *  law is about who can see whom, and distance is the right measure for it. */
export function poseFan(list, from, poseOf, turn = 0, keyOf = (x) => x?.id, max = POSE_FAN_MAX, share = POSE_FAR_SHARE) {
  if (!Array.isArray(list) || list.length <= max) return list;
  const sorted = ranked(list, from, poseOf);
  const bucket = (((turn | 0) % share) + share) % share;
  const out = sorted.slice(0, max);
  for (let i = max; i < sorted.length; i++) if (hashKey(keyOf(sorted[i])) % share === bucket) out.push(sorted[i]);
  return out;
}

/** SLAM8 (2026-09-16, AUDIT SLAM): HAS A POSE MOVED? Moved here from net/online.js, which is the client alone, because
 *  the RELAY has to ask the same question and must get the same answer (the `nearestFan`/`poseFan` rule: one law, both
 *  ends). The client sends a pose when this says yes, and every HEARTBEAT_MS regardless; so a pose for which this says
 *  NO is a KEEPALIVE, and the relay tells the two apart by this and nothing else.
 *
 *  Exact equality would not do. A player standing still with a hand on the mouse drifts by less than `eps`, which this
 *  calls unmoved and `sendPose` therefore does not send - until the heartbeat, which carries those drifted numbers. A
 *  relay comparing fields byte-for-byte would see a MOVE, tier the keepalive, and hand that player straight back the
 *  bug this slice exists to close. The epsilon is the law; the bytes are not.
 *
 *  SLAM13 (AUDIT SLAM A3): and the yaw is compared as an ANGLE. `validPose` wraps the relay's copy into (-PI, PI], so a
 *  player facing due south (yaw = PI) who drifts a hair's breadth reads +3.14 one heartbeat and -3.14 the next - a
 *  difference of 2PI where the eyes see none. The bare difference tiered that player's every keepalive, which is
 *  SLAM8's bug back for one heading; wrapAngle of the difference is the distance between two headings. */
export function poseChanged(a, b, eps = 0.01) {
  if (!a || !b) return true;
  return Math.abs(a.x - b.x) > eps || Math.abs(a.y - b.y) > eps || Math.abs(a.z - b.z) > eps
    || Math.abs(wrapAngle(a.yaw - b.yaw)) > eps || Math.abs(a.pitch - b.pitch) > eps || (a.mv | 0) !== (b.mv | 0)   // SLAM13: the yaw difference is WRAPPED - the relay keeps the pose the door wrapped into (-PI, PI], and a player standing at the seam drifts across it by 2PI, which the bare difference called a move
    || (a.wd | 0) !== (b.wd | 0) || (a.an | 0) !== (b.an | 0)   // MAC7 #1: a draw and a swing go out at once, as a step does
    || (a.am | 0) !== (b.am | 0) || (a.sr | 0) !== (b.sr | 0) || (a.cn | 0) !== (b.cn | 0)   // MAC7 #2: and the arrow, the spell stance, the cast
    || (a.rd | 0) !== (b.rd | 0) || (a.rv | 0) !== (b.rv | 0)   // RIDE: a mount or a dismount goes out at once, as a step does
    || (a.hs | 0) !== (b.hs | 0);   // DISC7: and the clop's swap, as the rider's own swaps on its edge
}

/** A pose the room will relay, or null. */
export function validPose(p) {
  if (!p || typeof p !== 'object') return null;
  const { x, y, z, yaw, pitch, mv, wd, an, as, am, sr, cn, cr, ce, ar, fk, rd, rv, hs } = p;
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
    ce: uint(ce, POSE_CAST_ELEMENTS - 1) ?? 4,   // SPELLFX1: the cast's element - a pose from before it reads Magic
    ar: uint(ar, 65535) ?? 0,   // SPELLFX1: arrows loosed - a peer draws a shaft for each new one
    fk: uint(fk, 5) ?? 0,   // PEER-FS1: the footstep-sound kind (systems/footsteps.js FOOTSTEP_KIND), 0-5
    // RIDE (2026-09-23, Mac: "need to ensure other people see others riding on horses"): THE MOUNT. `rd` is the
    // transport the player is riding - POSE_RIDE's 1 the horse, 2 the cart - and `rv` which of Eye Of The Beholder's
    // five mounted sprite sets they chose (Graphics.OnHorse, 0-4). OMITTED on foot, not written as zeros: a pose on
    // foot serializes to the bytes it always did (validLook's `class` law), so every older pose pin and every deployed
    // client that compares poses sees the shape it has always seen.
    ...rideOf(rd, rv, hs),
  };
}
/** RIDE: the pose's mount - `rd` 1 the horse, 2 the cart (DFU's TransportModes riding), `rv` the mounted sprite set. */
export const POSE_RIDE = Object.freeze({ Foot: 0, Horse: 1, Cart: 2 });
export const POSE_RIDE_SPRITES = 5;
// DISC7 (2026-09-23, Mac: "fix the known gaps"): `hs` - the rider is moving at LESS THAN HALF SPEED
// (PlayerMotor.IsMovingLessThanHalfSpeed, the motor's own flag), the one fact TransportManager swaps the clop on
// (HorseClop below it, HorseClop2 above, the volume halved - :255-269). A receiver cannot derive it: the eased pose's
// speed is in the room's units and catches up at up to twice the real one, and the rider's SPD stat is not on the wire.
// Mounted and moving only, and OMITTED when 0, so a gallop's pose and every pose on foot keep the bytes they had.
const rideOf = (rd, rv, hs) => {
  const r = uint(rd, POSE_RIDE.Cart) ?? 0;
  return r ? { rd: r, rv: uint(rv, POSE_RIDE_SPRITES - 1) ?? 0, ...(uint(hs, 1) ? { hs: 1 } : {}) } : {};   // AUDIT DISC7 B8: uint's law, as rd and rv
};

/** One equipped item as the look carries it - the six fields, clamped - or null. */
export function validLookItem(it) {
  if (!it || typeof it !== 'object') return null;
  const templateIndex = uint(it.templateIndex, 65535), equipSlot = uint(it.equipSlot, 1e6);
  if (templateIndex == null || equipSlot == null || equipSlot >= MAX_LOOK_ITEMS || !LOOK_GROUPS.includes(it.group)) return null;   // a slot past the table is no item, not another slot's
  const out = { templateIndex, group: it.group, equipSlot };
  for (const k of ['material', 'dye', 'variant']) { const v = uint(it[k], 4095); if (v != null) out[k] = v; }
  return out;
}

/** A look the room will keep and repeat: the paperdoll's recipe, bounded and projected.
 *  `class` (2026-09-17, remote-player billboard): the character's career name, so a peer without a Morrowind body
 *  can be drawn as the matching class-enemy sprite (Warrior, Mage, ...) instead of the flat paperdoll - see
 *  net/remotePlayers.js classMobileType. Optional and letters-only, same bound as `race`; an unrecognized or
 *  missing name just falls back to the paperdoll, so this is safe to leave off an older peer's look entirely. */
export function validLook(look) {
  if (!look || typeof look !== 'object') return null;
  const race = typeof look.race === 'string' && /^[A-Za-z]{1,16}$/.test(look.race) ? look.race : 'Breton';
  const gender = look.gender === 'female' ? 'female' : 'male';
  const faceIndex = uint(look.faceIndex, 9) ?? 0;
  const klass = typeof look.class === 'string' && /^[A-Za-z]{1,20}$/.test(look.class) ? look.class : null;
  const items = Array.isArray(look.items) ? look.items.map(validLookItem).filter(Boolean).slice(0, MAX_LOOK_ITEMS) : [];
  // The key is OMITTED, not set to null, when the look names no class. SOC1's
  // own pin names this exact mutant - "the keys added to a hello that named
  // none, which breaks every older hello pin" - and it is a wire law, not a
  // style choice: a peer that never had a class must serialize to the same
  // bytes it always did, or every older pin and every deployed client that
  // compares looks sees a shape it has not seen before.
  return { race, gender, faceIndex, ...(klass ? { class: klass } : {}), items };
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

/** One client frame, parsed and checked: {t:'hello'|'pose'|'ping'|'chat'|'world'|'foes'|'hit'|'act'|'who'|'quest', ...}
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
  if (m.t !== 'world' && m.t !== 'foes' && m.t !== 'quest' && text.length > MAX_FRAME_BYTES) return { error: 'frame too large' };
  if (m.t === 'foes' && text.length > FOES_FRAME_MAX) return { error: 'frame too large' };
  if (m.t === 'quest' && text.length > QUEST_FRAME_MAX) return { error: 'frame too large' };
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
  if (m.t === 'trade') {   // TRADE1: a directed trade frame - one KIND from TRADE_KINDS to one peer, projected by validTradeData; the relay reads none of the items
    if (!hasHello) return { error: 'trade before hello' };
    if (text.length > TRADE_FRAME_MAX) return { error: 'frame too large' };
    const data = validTradeData(m.data);
    return data ? { t: 'trade', data } : { error: 'bad trade' };
  }
  if (m.t === 'cast') {   // ALLY-CAST: a beneficial spell at a party mate - one directed frame, projected by validCastData; the receiver decides what lands
    if (!hasHello) return { error: 'cast before hello' };
    if (text.length > CAST_FRAME_MAX) return { error: 'frame too large' };
    const data = validCastData(m.data);
    return data ? { t: 'cast', data } : { error: 'bad cast' };
  }
  if (m.t === 'park') {   // HCC-PARK: my character's parked team - nothing (no anchor), or its anchor and, when shown, its record
    if (!hasHello) return { error: 'park before hello' };
    const data = validParkData(m.data);
    return data ? { t: 'park', data } : { error: 'bad park' };
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
    const hello = { t: 'hello', id, secret, name: sanitizeName(m.name), look, pose };
    // ═══ ACC1d: THE IDENTITY TOKEN, OPTIONAL, AND ITS SHAPE ONLY ══
    //
    // `parseClient` is SYNC AND PURE and has to stay that way - it is
    // the law both ends run, and a verifier needs WebCrypto, a public
    // key and an await. So this checks that `tok` could be a token and
    // nothing more; server/src/index.js does the arithmetic, because
    // only the relay holds the key.
    //
    // A HELLO WITHOUT ONE IS ADMITTED, exactly as SOC1's account pair
    // is admitted when absent: it is a build from before this slice, or
    // a client that could not reach the account service. ACC1d's record
    // (bible ACC1d D1) says why the token is not required - a second
    // Worker's outage must not take the game offline - and says the
    // honest limit out loud: a token makes a name TRUSTWORTHY, it does
    // not yet make one MANDATORY.
    //
    // A MALFORMED ONE IS AN ERROR, not a quiet drop. A client that
    // meant to send a token and sent rubbish should hear so, the same
    // way a malformed account pair is `bad account` rather than a
    // silent downgrade to no account at all.
    if (m.tok !== undefined) {
      if (typeof m.tok !== 'string' || !TOKEN_RE.test(m.tok)) return { error: 'bad token' };
      hello.tok = m.tok;
    }
    // SOC1: the account, optional - and BOTH or neither. A hello that names an account without its secret, or a
    // malformed either, is not the port's client (accountId/accountSecret mint the shape the law admits), so it is an
    // error like a bad id, not a hello quietly admitted without an account. A hello naming none is a build before
    // this slice, admitted as it always was.
    if (m.acct !== undefined || m.asecret !== undefined) {
      const acct = typeof m.acct === 'string' && ID_RE.test(m.acct) ? m.acct : null;
      const asecret = typeof m.asecret === 'string' && SECRET_RE.test(m.asecret) ? m.asecret : null;
      if (!acct || !asecret) return { error: 'bad account' };
      hello.acct = acct; hello.asecret = asecret;
    }
    return hello;
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
  if (m.t === 'say') {
    // RED1: THE SERVER'S LINE, ASKED FOR. This checks the SHAPE and
    // nothing else - whether this socket may actually speak as the
    // server is a question about a SIGNATURE, and only the relay holds
    // the key. `parseClient` is sync and pure and stays that way, the
    // same split the token itself lives under (ACC1d).
    if (!hasHello) return { error: 'say before hello' };
    const text = typeof m.text === 'string' ? sanitizeChat(m.text) : '';
    return text ? { t: 'say', text } : { error: 'bad say' };
  }
  if (m.t === 'mute') {
    // MOD1: THE SHAPE ONLY, as `say` is. Whether the order is real is a
    // question about a signature, and the relay alone holds the key.
    if (!hasHello) return { error: 'mute before hello' };
    return typeof m.order === 'string' && m.order.length > 0 && m.order.length <= 1024
      ? { t: 'mute', order: m.order } : { error: 'bad mute' };
  }
  if (m.t === 'social') {   // SOC1: a friend or party act - a KIND from SOCIAL_ACTS naming what that kind must name, and nothing else
    if (!hasHello) return { error: 'social before hello' };
    const act = validSocialAct(m);
    return act ? { t: 'social', ...act } : { error: 'bad social' };
  }
  if (m.t === 'party') {   // SOC1: my party pose, to the hub - projected by the pose's own law
    if (!hasHello) return { error: 'party before hello' };
    const p = validPartyPose(m.p);
    return p ? { t: 'party', p } : { error: 'bad party' };
  }
  if (m.t === 'quest') {   // QUEST1: a quest shared with my party, hub-side alone - the hub already knows who my
    // party is (the same roster the party pose view reads), so the frame names no target at all.
    if (!hasHello) return { error: 'quest before hello' };
    const questName = typeof m.quest?.questName === 'string' ? m.quest.questName.slice(0, QUEST_NAME_MAX) : '';
    const displayName = typeof m.quest?.displayName === 'string' ? m.quest.displayName.slice(0, QUEST_NAME_MAX) : '';
    const data = m.quest?.data;
    if (!questName || !data || typeof data !== 'object' || Array.isArray(data)) return { error: 'bad quest' };
    return { t: 'quest', quest: { questName, displayName, data } };
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
/** RED1 FOUND THE FLOOR, so it is stated here rather than rediscovered:
 *  THIS GATE CANNOT EXPRESS A RATE BELOW ONE A SECOND. A fresh bucket
 *  starts with `rate` tokens and a pass costs a whole one, so any rate
 *  under 1 refuses the FIRST frame and every frame after it - a gate
 *  that reads as "slow" and behaves as "off". A slower allowance needs
 *  a different shape (a stamp of the last pass, not a bucket), and
 *  whoever needs one should write that rather than pass a fraction. */
/** FRIENDLY-SPELLS: `cap` is the bucket's depth - the burst it admits at once - and defaults to `rate`, which is
 *  every gate's shape but the cast gate's (a blast is ONE cast and one frame per mate it reaches). */
export function tokenGate(bucket, nowMs, rate = POSE_HZ_MAX, cap = rate) {
  const b = bucket ?? { tokens: cap, at: nowMs };
  const refill = ((nowMs - b.at) / 1000) * rate;
  const tokens = Math.min(cap, b.tokens + Math.max(0, refill));
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
/** AUDIT WORLD6b-iii(e) B1: the asks a ROOM answers a second, every socket together; over it the ask is dropped,
 *  nobody struck.
 *
 *  SLAM9 (2026-09-16, AUDIT SLAM): DERIVED, NOT CHOSEN - and the number it replaces was the single biggest thing wrong
 *  with the branch. This was 60, justified here as bounding STORAGE READS: "the one arm past the hello that reads
 *  storage (a look)... 1280 storage reads a second out of one object, for free". SLAM5 deleted that cost - the hello
 *  now fills `_looks`, so an answer on an awake object is a map hit and one send, and reads nothing. The budget
 *  outlived the expense it was sized for, and it was binding: at 200 players a joiner's welcome names ROSTER_MAX
 *  (64) and the other 135 must be asked for one at a time, so 200 clients offered ~1,000 asks a second against 60
 *  answered. Measured over the real Room: the room took 172 s to finish introducing itself, and the worst client
 *  waited ~148 s - drawn, meanwhile, as the look-less doll every stranger shares.
 *
 *  It is now the sum of every socket's own gate: SOCKETS_MAX x WHO_HZ_MAX. A room full of CORRECT clients asking as
 *  fast as they are allowed is exactly answered, and the room budget binds only when the per-socket gates are somehow
 *  not the whole story - which is what a room-wide bound is for. The cost at that ceiling is 1,280 map hits and sends
 *  a second beside the ~59,000 sends the pose fan already pays; a socket the instance has not seen since it woke
 *  reads one key once and caches it, bounded by the distinct ids in the room. */
export const WHO_ROOM_HZ_MAX = SOCKETS_MAX * WHO_HZ_MAX;
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
/** RED1: the server line's own bucket, well under chat's - see RED_HZ_MAX. */
export const redGate = (bucket, nowMs) => tokenGate(bucket, nowMs, RED_HZ_MAX);
/** MOD1: the mute order's own bucket - see MUTE_HZ_MAX. */
export const muteGate = (bucket, nowMs) => tokenGate(bucket, nowMs, MUTE_HZ_MAX);
/** SOC1: the social acts' gate - SOCIAL_HZ_MAX a second, at the hub and at home (an act the hub would refuse is never sent). */
export const socialGate = (bucket, nowMs) => tokenGate(bucket, nowMs, SOCIAL_HZ_MAX);
/** SOC1: the party poses' gate - PARTY_HZ_MAX a second, at the hub and at home. */
export const partyGate = (bucket, nowMs) => tokenGate(bucket, nowMs, PARTY_HZ_MAX);
/** QUEST1: a quest share's own gate - QUEST_HZ_MAX a second (one every ten), at the hub and at home. */
/** QUEST1 BUG, found live: quest sharing is deliberately rarer than 1/second (once every QUEST_SEND_MS,
 *  QUEST_HZ_MAX = 0.1) - tokenGate's own bucket is capped at the rate itself (`Math.min(rate, ...)`), so a rate
 *  UNDER 1 can never accumulate a full token to spend. Every other rate this helper gates (SOCIAL_HZ_MAX,
 *  PARTY_HZ_MAX - both 2) is at least 1, so this never came up before: fed the same way, a sub-1 rate silently
 *  refused EVERY quest share, forever, no matter how long the wait. Fixed with a plain cooldown instead of a token
 *  bucket - `at` is the timestamp of the last PASS, not a token count: pass once, then refuse until QUEST_SEND_MS
 *  has actually elapsed since. */
/** AUDIT DROPS C1: the hub's own cooldown on one socket's shares - HALF the client's floor (the PARTY_SEND_MS /
 *  partyGate rule: a gate at exactly the client's rate drops the honest client's frame on clock skew - a share at
 *  +9990 ms by the relay's clock was dropped while the client said "Shared"). */
export const QUEST_HUB_MIN_MS = QUEST_SEND_MS / 2;
export const questShareGate = (at, nowMs) => (at != null && nowMs - at < QUEST_HUB_MIN_MS ? { at, pass: false } : { at: nowMs, pass: true });

/** CHAT-G (2026-09-17): THE THIRD SIDE, which nothing counted.
 *
 *  A chat line passes three gates and had only ever had two. The client
 *  gates what it SENDS (`chatGate`, CHAT_HZ_MAX - AUDIT CHAT A8, so a
 *  line the relay would drop is never sent); the relay gates what it
 *  ACCEPTS (the same gate per socket, and CHAT_ROOM_HZ_MAX for the whole
 *  room). Nothing gated what a client RECEIVES - `online.js`'s chat arm
 *  sanitized the text, checked the id was a string and delivered, however
 *  many arrived.
 *
 *  That matters because the relay is the PLAYER'S choice: `?server=` and
 *  the enhanced menu's Relay field point a client at any relay at all,
 *  which is the whole reason every other field on this wire has a law
 *  here. A relay could push lines as fast as it liked and take a
 *  player's chat history with them - `net/chat.js` keeps CHAT_KEEP of
 *  them, so a few thousand frames is the log emptied and refilled with
 *  whatever the relay wanted there instead.
 *
 *  THE RATE IS DERIVED, NOT INVENTED, and that is the point of putting it
 *  beside the relay's own constant. CHAT_ROOM_HZ_MAX is exactly what an
 *  honest relay spends on one room, so this admits an honest room at FULL
 *  TILT and one frame more is a frame that relay would never have sent.
 *  Gating at the sender's CHAT_HZ_MAX instead would have dropped real
 *  lines the moment two people talked at once - a "hardening" that is a
 *  chat bug.
 *
 *  Per ROOM, because that is the unit the relay spends by: a session
 *  listening to its own room and a halo of cells is owed
 *  CHAT_ROOM_HZ_MAX from each of them, and one bucket across all of them
 *  would have made a busy neighbour silence the room you are standing in. */
export const chatInGate = (bucket, nowMs) => tokenGate(bucket, nowMs, CHAT_ROOM_HZ_MAX);

/** The longest a relay may name its deploy, in UTF-16 units (SRV-N).
 *
 *  AUDIT-SRVN F1: `v` shipped as the ONLY field on this wire with no law
 *  in this file. Every other one has been here since its slice - a pose
 *  through `validPose`, a look through `validLook`, a name through
 *  `sanitizeName`, a line through `sanitizeChat`, an owner through
 *  `hitOwnerOf`'s 64-character id bound - and they are all here for the
 *  same reason: `?server=` and the enhanced menu's Relay field mean the
 *  relay a client talks to is the PLAYER'S choice, so nothing arriving
 *  over it is the port's own word. `v` was gated on `typeof` alone, and
 *  a 200 KB deploy name was accepted and held (driven, not read). */
export const RELAY_VERSION_MAX = 32;
/** A deploy name off the wire, or null for anything that is not one.
 *  ONE HOME, BOTH ENDS, like every law above it: the relay stamps a name
 *  this admits (pinned) and the client reads it back through the same
 *  function, so the two cannot disagree about what a deploy is called. */
export const relayVersionOf = (v) => (typeof v === 'string' && v.length > 0 && v.length <= RELAY_VERSION_MAX ? v : null);

/** What a joiner is told: everyone else in the room who has said hello
 *  - the nearest ROSTER_MAX to `near` when there is a pose to measure
 *  from (a world cell), the first ROSTER_MAX otherwise. */
/** ═══ ACC3: THE BADGE ON A WIRE ROW, AND WHY IT IS OMITTED ════════
 *
 * Mac (2026-09-22): "Player titles appear above a player name ... name
 * glyphs appear on the right side of the player name."
 *
 * Both ride BESIDE the name on every row that carries one - a welcome
 * peer, a join, a channel roster - and the relay reads them off the
 * VERIFIED token claims, never off anything a client said about itself
 * (server/src/index.js `_named`). That is ACC1g's law applied to a
 * stronger claim than a name: "Developer" over somebody's head reads
 * as this project's own word about them.
 *
 * THE KEYS ARE ABSENT AND NOT NULL when there is no badge, which is
 * the same discipline `look.class` keeps two hundred lines up and for
 * the same two reasons. Most players wear nothing, so `"title":null`
 * on every row of a 64-peer welcome is bytes paid for saying nothing;
 * and a reader that has to tell "no title" from "the key is not in
 * this build" has one answer instead of two.
 *
 * ONE HOME BOTH ENDS: the relay builds rows with it, and the client
 * reads them, so neither can drift into carrying a field the other
 * does not.
 *
 * @param {any} row  the row so far - returned, mutated, by design
 * @param {any} from anything carrying `title` and `glyphs` (a token's
 *                   claims as `_named` projects them, or an attachment)
 */
export function badged(row, from) {
  const t = from?.title;
  if (typeof t === 'string' && t) row.title = t;
  const g = from?.glyphs;
  if (Array.isArray(g) && g.length) row.glyphs = g;
  return row;
}

/** ═══ AND THE INVERSE, because a reader is half of a field ════════
 *
 * `badged` is what the RELAY writes; this is what a client reads back,
 * and the two live together so a badge cannot be written one way and
 * understood another. The relay itself never calls it - it reads a
 * badge out of a verified token, never off the wire - so this is the
 * client's half of the pair, and it lives here because the alternative
 * is a second spelling of one law in `net/online.js`.
 *
 * IT CHECKS THE VOCABULARY, and that is the point rather than a
 * formality: this is a stranger's word about themselves. The relay
 * only ever sends what a signature carried, so anything else is a
 * relay that is older, newer, or not ours - and a name layer that
 * trusts an unknown string is a name layer somebody paints text with.
 * Duplicates go, and the list is cut at the vocabulary's own size.
 *
 * Answers `{ title, glyphs }` always: `null` and `[]` for no badge, so
 * a caller never has to tell "absent" from "none".
 */
export function readBadge(row) {
  const t = row?.title;
  const title = typeof t === 'string' && TITLES.includes(t) ? t : null;
  const glyphs = [];
  if (Array.isArray(row?.glyphs)) {
    for (const g of row.glyphs) {
      if (typeof g !== 'string' || !GLYPHS.includes(g) || glyphs.includes(g)) continue;
      if (glyphs.length >= GLYPHS_MAX) break;
      glyphs.push(g);
    }
  }
  return { title, glyphs };
}

export function rosterFor(peers, meId, near = null) {
  const out = [];
  // ACC1g: AND `v` IS GONE FROM IT. ACC1d put the relay's verdict on
  // every roster row and on the join beside it, for a good reason at
  // the time - a roster that dropped it would have marked the people
  // who arrive AFTER you and left everybody already standing there
  // unmarked, a signal true half the time. The gate makes the whole
  // field say one thing: every peer in this room was verified to get
  // in, so a per-name verdict carries no information about any of them.
  // ACC3: and the badge, off the attachment the token wrote - omitted, not nulled, when there is none (`badged`).
  for (const p of peers) if (p && p.id && p.id !== meId) out.push(badged({ id: p.id, name: p.name, look: p.look, pose: p.pose ?? null }, p));
  // SLAM5 (2026-09-16, AUDIT SLAM): ONE METRIC. This ranked by `pixelDistance` - Chebyshev on MAP PIXELS, 32768 units
  // wide - while the pose fan ranks by squared Euclidean in the pose's own frame. Two different metrics over the same
  // set DO NOT NEST, so `POSE_FAN_MAX <= ROSTER_MAX` bought nothing: measured at an event standing, only 11 of the 32
  // the fan reaches were among the 64 the welcome names, and 53 of those 64 were peers the joiner would never hear
  // from. Worse, in a place room the poses are SCENE units, so every pixelDistance floors to 0, the sort is a no-op
  // and "the nearest 64" was the first 64 in socket order. `nearestFan` is the one ranking now, at both doors.
  return near ? nearestFan(out, near, (p) => p.pose, ROSTER_MAX) : out.slice(0, ROSTER_MAX);
}

/** SOC1: an id off the wire (ID_RE - a peer's, an account's and a party's are one shape), or null. */
const idOf = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : null);

/** MOD1: the verified account id (`sub`) a row or a line carries, or
 *  null - the wire's own id law, read the same way at both ends. */
export const subOf = (m) => idOf(m?.sub);

/** MOD1: a `muted` frame's `until`, or null for a frame that is not one. */
export const mutedUntilOf = (m) => (Number.isSafeInteger(m?.until) && m.until >= 0 ? m.until : null);

/** SOC1 / AUDIT SOC B11: ONE ACT, PROJECTED - `{k, acct?, peer?, party?}` with exactly what its kind needs (SOCIAL_ACTS:
 *  an account, a peer, either one of the two but never both, a party, nothing) and nothing else, or null. ONE HOME:
 *  the relay's parser runs it (a bad act is a refusal that CLOSES the socket) and the client's sendSocial runs it
 *  first, so an act the relay would close on is never sent - the audit found the client checking the kind and the
 *  rate at home and not the shape, which the record claimed it did. */
export function validSocialAct(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const needs = typeof m.k === 'string' && Object.prototype.hasOwnProperty.call(SOCIAL_ACTS, m.k) ? SOCIAL_ACTS[m.k] : null;
  if (needs == null) return null;
  const acct = m.acct === undefined ? undefined : idOf(m.acct), peer = m.peer === undefined ? undefined : idOf(m.peer), party = m.party === undefined ? undefined : idOf(m.party);
  if (acct === null || peer === null || party === null) return null;   // named, and not by the wire's id law
  const out = { k: m.k };
  if (needs === 'acct' && !acct) return null;
  if (needs === 'party' && !party) return null;
  if (needs === 'target' && (!!acct === !!peer)) return null;   // one of the two, never both and never neither
  if (acct && (needs === 'acct' || needs === 'target')) out.acct = acct;
  if (peer && needs === 'target') out.peer = peer;
  if (party && needs === 'party') out.party = party;
  return out;
}
/** SOC1: a wall-clock stamp off the wire (ms, finite, not negative), or null. */
const stampOf = (v) => (finite(v) && v >= 0 ? v : null);

/** SOC1: a short label the hub will keep and repeat - a place name on a party pose, a hub error's words: printable
 *  ASCII, whitespace collapsed, trimmed, bounded, '' when nothing is left; the name filter over it unless told not to
 *  (a place name a modified client writes is shown to that player's party, so it goes through the same door a name
 *  does; the hub's own error text is nobody's to filter). Idempotent, as the rest of this module is. */
export function sanitizeLabel(text, max = PARTY_LOC_MAX, { filter = true } = {}) {
  let s = '';
  for (const ch of String(text ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) s += ch; }
  s = s.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  if (!s) return '';
  return !filter || nameAllowed(s) ? s : '';
}

/** SOC1: the party id the hub mints - the wire's id law, a `q` first so a reader can tell it from a peer's `p` and an
 *  account's `a` at a glance (nothing checks the letter: one id law, ID_RE). */
export const mintPartyId = (rand = Math.random, nowMs = Date.now()) => 'q' + nowMs.toString(36) + rand().toString(36).slice(2, 10).padEnd(8, '0');

/** PARTY-REST1: a rest/loiter session's live state, mirrored on the leader's own party pose so a nearby member's
 *  screen can show the SAME countdown - `null` when not resting. Mirrors restSession.js's own MAX_REST_HOURS (99)
 *  without importing systems/ code into net/ - a net-layer bound only has to admit what the game can ever produce,
 *  not track the systems module that produces it. */
const PARTY_REST_HOURS_MAX = 99;
/** loiter=0, timed=1, full=2 - restWindow.js's own `this.mode` strings ('loiter'|'timed'|'full'), numbered small
 *  for the wire the way `in` already is. */
const PARTY_REST_MODES = Object.freeze([0, 1, 2]);
const PARTY_REST_KINDS = Object.freeze(['bed', 'camp', 'rough']);   // PARTY-REST4: systems/survival/rest.js's own REST_KIND values, unchanged - null (survival mode off, or not yet resolved) is valid too

/** SOC1: A PARTY POSE the hub will keep and repeat, or null - where a member stands and how they fare, which is what
 *  the party HUD and the map draw of a member who may be a continent away: `px`,`py` the map pixel (in a dungeon or a
 *  building, the pixel of the place - "regardless of their location"); `in` 0 outside, 1 a dungeon, 2 a building;
 *  `loc` the place's name, a label; the six vitals, each finite in [0, FOE_HEALTH_MAX] (an entity's health,
 *  fatigue and magicka are all within it), rounded - a bar reads no fraction; and the portrait's recipe, `race`,
 *  `gender`, `face`, by validLook's own bounds, so the HUD draws the face the doll would. Refused WHOLE when any
 *  named field is outside its law: a member's card is never half landed.
 *
 *  PARTY-REST1 (2026-09-20, per-request: "when the party leader rests everyone in the party gets the resting
 *  screen counting down"): two more fields, both optional and independently defaulted rather than folded into the
 *  refuse-whole law above - a stale client sending neither must still land a valid pose.
 *    `bk` - the building key `in === 2` stands in, so two shops sharing one town pixel are not the same "building"
 *      to a nearby member's proximity check; null (never 0-as-a-fallback - 0 is a REAL building's own key) when
 *      absent or outside a building, so an unset key never accidentally matches another unset key.
 *    `rest` - `{mode, hoursRemaining, totalHours}` while I am resting or loitering for real (never while merely
 *      mirroring someone else's - see world.js composePartyPose), or null. Refused WHOLE like the vitals above:
 *      a rest object with one bad number is no rest object, not a best-effort one a follower's mirrored window
 *      would have to guess the rest of. */
export function validPartyPose(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const px = uint(p.px, MAP_PIXELS_X - 1), py = uint(p.py, MAP_PIXELS_Y - 1);
  if (px == null || py == null) return null;
  const out = { px, py, in: p.in === 1 ? 1 : p.in === 2 ? 2 : 0, loc: sanitizeLabel(p.loc) };
  for (const k of ['h', 'hm', 'f', 'fm', 'm', 'mm']) {
    const v = p[k];
    if (!finite(v) || v < 0 || v > FOE_HEALTH_MAX) return null;
    out[k] = Math.round(v);
  }
  out.race = typeof p.race === 'string' && /^[A-Za-z]{1,16}$/.test(p.race) ? p.race : 'Breton';
  out.gender = p.gender === 'female' ? 'female' : 'male';
  out.face = uint(p.face, 9) ?? 0;
  // PARTY-REST9 (2026-09-21, per-request: "youre not near the leader, you must gather your party i stand in
  // the leader, tried beside him and it still comes up" - the bug this closes): 0xffff (65535) is far too small
  // a cap for a real building key. `net/online.js`'s own `roomKeyFor` computes it as `buildingKey >>> 0` - a
  // full unsigned 32-bit value - and an actual room key logged during this exact bug report
  // (`interior:m206728581.131590`) already carries a building key of 131590, more than DOUBLE the old cap. Every
  // such key got silently clamped down to 65535 on the way through this validator - not refused outright, which
  // would at least have been visible, but SILENTLY CHANGED to a wrong-but-valid-looking number - so two players
  // standing in the exact same building, with the exact same real (unclamped) key on each of their own local
  // `myPartyLocation()`/`composePartyPose()` reads, disagreed the moment either read the OTHER's clamped
  // broadcast value back off the wire: `samePlace`'s own `bk === bk` check (world.js) failed forever, for any
  // building whose key exceeded 65535, no matter how close together the two of them actually stood. Widened to
  // the full unsigned 32-bit range `roomKeyFor` itself already uses, so the wire can never disagree with the
  // room key it already agreed to share.
  out.bk = out.in === 2 ? uint(p.bk, 0xffffffff) : null;
  if (p.rest != null) {
    if (typeof p.rest !== 'object' || Array.isArray(p.rest)) return null;
    const mode = PARTY_REST_MODES.includes(p.rest.mode) ? p.rest.mode : null;
    const hoursRemaining = finite(p.rest.hoursRemaining) ? Math.min(PARTY_REST_HOURS_MAX, Math.max(0, Math.round(p.rest.hoursRemaining))) : null;
    const totalHours = finite(p.rest.totalHours) ? Math.min(PARTY_REST_HOURS_MAX, Math.max(0, Math.round(p.rest.totalHours))) : null;
    if (mode == null || hoursRemaining == null || totalHours == null) return null;
    // PARTY-REST4: the kind the leader is ACTUALLY resting as (bed/camp/rough, systems/survival/rest.js's own
    // REST_KIND) - null is valid (survival mode off, or the field simply absent) and reads as "no kind to
    // inherit", never as a refusal; an unrecognised string is the one thing that still refuses the whole pose,
    // same law every other field in this object already keeps.
    if (p.rest.kind != null && !PARTY_REST_KINDS.includes(p.rest.kind)) return null;
    out.rest = { mode, hoursRemaining, totalHours, kind: p.rest.kind != null ? p.rest.kind : null };
  } else {
    out.rest = null;
  }
  // PARTY-REST2 (2026-09-20, per-request: "we need a party member confirmation like 4/5 party member agree to
  // rest... if not all party members are ready the leader can't rest"): the LEADER's proposed mode+hours, not
  // started for real yet - `restPending` - and every member's own answer to it - `ready`, plain and always
  // present, never null, because "not ready" IS its ordinary value, not an absent one. Same refuse-whole law as
  // `rest`: a bad mode or a bad hour count refuses the whole pose, never a half-landed proposal a leader's own
  // waiting screen would have to guess the rest of.
  if (p.restPending != null) {
    if (typeof p.restPending !== 'object' || Array.isArray(p.restPending)) return null;
    const mode = PARTY_REST_MODES.includes(p.restPending.mode) ? p.restPending.mode : null;
    const hours = finite(p.restPending.hours) ? Math.min(PARTY_REST_HOURS_MAX, Math.max(0, Math.round(p.restPending.hours))) : null;
    if (mode == null || hours == null) return null;
    out.restPending = { mode, hours };
  } else {
    out.restPending = null;
  }
  out.ready = p.ready === true;
  // AUDIT PARTY-REST (2026-09-23, world95): WHEN the vote was cast, on the shared clock - `ready` alone was a bare
  // boolean whose sixty-second expiry ran only on the voter's own frame, so a voter whose window was open when the
  // rest started, or whose tab sat in the background, approved the leader's NEXT rest with a vote cast for the
  // last one. A reader (systems/partyRestLaw.js voteStands) counts `ready` only while `readyAt` is younger than
  // the timeout and later than the last rest that started here. Same bounds as voteAt below; absent reads null,
  // which is "no vote" - a world94 client's `ready` carries none.
  out.readyAt = finite(p.readyAt) ? Math.max(0, Math.round(p.readyAt)) : null;
  // PARTY-REST2e (2026-09-20, per-request: "it only counts down the countdown for the player who initiated it
  // not for the whole group... every one in the group can start a vote and has its own timer" - the bug this
  // closed): the relay's own clock (net/social.js's `now()`, already offset-corrected so every tab reads the
  // SAME moment regardless of whose machine it is), the instant THIS tab's own gate last asked "is everyone
  // ready" and got a no - null the rest of the time, including while merely out of range (a leader alone, or a
  // follower far from the leader, never starts this clock at all - "the vote time also shouldn't start when out
  // of range"). A follower's own gate reads every near member's `voteAt` alongside its own, so ONE cooldown -
  // whoever's is most recent - covers the whole group standing there, not a separate one per person asking.
  out.voteAt = finite(p.voteAt) ? Math.max(0, Math.round(p.voteAt)) : null;
  // PARTY-REST5 (2026-09-21, per-request: "the ones who not initiate need to also stop resting when an enemy
  // appears for the initiator"): a monotonic marker, stamped only on a REAL enemy break
  // (systems/restSession.js's own two call sites) - NOT nested inside `rest` above, deliberately, because a
  // real session moves to 'ended' the same tick the break is discovered, so `rest` may already read null again
  // by the next pose a follower's mirror reads. Same law as `voteAt`: a follower only ever compares this
  // against its own last-seen copy of the SAME sender's value (world.js's `partyRestFollowTick`), never against
  // its own clock, so an unrecognised (non-finite) value reads as "nothing to compare yet" rather than refusing
  // the whole pose.
  out.restEnemyAt = finite(p.restEnemyAt) ? Math.max(0, Math.round(p.restEnemyAt)) : null;
  // PARTY-REST19 (2026-09-22, per-request: "An non initiator MUST cancel the rest for all if he cancels the
  // ongoing resting"): stamped by a follower's own Stop click, naming the ONE account they were mirroring -
  // `restCancelFor` uses the same `idOf` normalizer acct/leader already do, `restCancelAt` the same
  // finite-timestamp law restEnemyAt/voteAt already do. The real rester's own session compares `restCancelFor`
  // against their OWN account id and `restCancelAt` against its own last-seen copy of it (world.js's
  // `canceledByFollower`), never against a local clock - same law as restEnemyAt.
  out.restCancelFor = idOf(p.restCancelFor);
  out.restCancelAt = finite(p.restCancelAt) ? Math.max(0, Math.round(p.restCancelAt)) : null;
  // PARTY-REST21 (2026-09-22, per-request: confirmed by direct testing - "1/2 pops up again in the chat"/
  // "the non initiator presses r again when all ready he starts a new vote... just put a cooldown on being
  // able to start a new rest"): the last time this account's own rest actually started, for real or via
  // mirror - on social.now() like voteAt (compared as a DURATION against it elsewhere, so it has to be the
  // shared relay clock, never a local one), unlike restEnemyAt/restCancelAt above (which are only ever
  // compared against a previously-seen copy of themselves, never against a clock).
  out.restStartedAt = finite(p.restStartedAt) ? Math.max(0, Math.round(p.restStartedAt)) : null;
  return out;
}

/** SOC1: one account as the hub names it to a client - a friend, a request, a party member: the id, the name as the
 *  wire allows it, whether it is online now, when it was last seen (the hub's clock, ms; null for an account the hub
 *  has no record of), and the peer ids its tabs are in the world as (ACCOUNT_TABS_MAX at most). Null for no id. */
export function validSocialRow(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const acct = idOf(r.acct);
  if (!acct) return null;
  const peers = [];
  if (Array.isArray(r.peers)) for (const v of r.peers) { const id = idOf(v); if (id && !peers.includes(id) && peers.length < ACCOUNT_TABS_MAX) peers.push(id); }
  return { acct, name: sanitizeName(r.name), online: !!r.online, seen: stampOf(r.seen), peers };
}
/** SOC1: a row with the stamp a pending request or invite carries (`at`), or null. */
function validPendingRow(r) {
  const row = validSocialRow(r);
  if (!row) return null;
  const at = stampOf(r.at);
  if (at == null) return null;
  return { ...row, at };
}
/** SOC1: a member row - a social row with the member's latest party pose, or null for a member that has sent none. */
function validMemberRow(r) {
  const row = validSocialRow(r);
  if (!row) return null;
  const p = r.p == null ? null : validPartyPose(r.p);
  if (r.p != null && !p) return null;
  return { ...row, p };
}
/** SOC1: A PARTY as the hub shows it to its members: the id, the leader's account and the members (PARTY_MAX at most,
 *  join order - the seat passes to the longest-standing), or null. */
export function validPartyView(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const id = idOf(v.id), leader = idOf(v.leader);
  if (!id || !leader || !Array.isArray(v.members) || v.members.length > PARTY_MAX) return null;
  const members = [];
  for (const r of v.members) { const row = validMemberRow(r); if (!row) return null; members.push(row); }
  if (!members.some((m) => m.acct === leader)) return null;   // the leader is a member: a view that says otherwise is no party
  return { id, leader, members };
}
/** SOC1: AN INVITE as the hub hands it to the invited: the party, who asked, who is in it (PARTY_MAX at most, name and
 *  id alone - the invited is not yet a member and sees no pose), when, and when it lapses. Null for anything else. */
export function validInvite(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const party = idOf(v.party), from = validSocialRow(v.from), at = stampOf(v.at), expires = stampOf(v.expires);
  if (!party || !from || at == null || expires == null || !Array.isArray(v.members) || v.members.length > PARTY_MAX) return null;
  const members = [];
  for (const r of v.members) { const acct = idOf(r?.acct); if (!acct) return null; members.push({ acct, name: sanitizeName(r.name) }); }
  return { party, from: { acct: from.acct, name: from.name }, members, at, expires };
}

/** SOC1: A FRAME FROM THE HUB, projected - the client's door, as CHAT-G's is for a chat line: the relay is the
 *  player's choice (`?server=`, the menu's Relay field), so nothing arriving over it is the port's own word, and a
 *  frame a modified relay shapes is dropped whole rather than half applied. One home for the shape, so the hub's
 *  own pins can assert what it sends passes the door its client reads through. Null for anything else.
 *    state:    {acct, name, peers, friends:[row], in:[row+at], out:[row+at], party: view|null, invites:[invite]}   my whole picture
 *              (AUDIT SOC C20: `peers` the ids MY OWN tabs stand as; AUDIT SOC A6: a pending row carries a name and nothing else)
 *    presence: {...row}                        a friend came online or went (the row's `online`, `seen`, `peers`)
 *    party:    {party: view|null}              my party as it stands, or none
 *    invite:   {...invite}                     a party asks for me
 *    note:     {code, acct, name}              something happened, as a code the client puts words to
 *    error:    {m}                             the hub refused one act, in words */
export function validSocialFrame(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.t !== 'social' || !SOCIAL_KINDS.includes(m.k)) return null;
  const list = (v, max, one) => { if (v == null) return []; if (!Array.isArray(v)) return null; const out = []; for (const r of v.slice(0, max)) { const row = one(r); if (!row) return null; out.push(row); } return out; };
  if (m.k === 'state') {
    const acct = idOf(m.acct);
    if (!acct) return null;
    const friends = list(m.friends, FRIENDS_MAX, validSocialRow), inbox = list(m.in, PENDING_MAX, validPendingRow), outbox = list(m.out, PENDING_MAX, validPendingRow), invites = list(m.invites, PENDING_MAX, validInvite);
    if (!friends || !inbox || !outbox || !invites) return null;
    const party = m.party == null ? null : validPartyView(m.party);
    if (m.party != null && !party) return null;
    return { t: 'social', k: 'state', acct, name: sanitizeName(m.name), peers: validSocialRow(m).peers, friends, in: inbox, out: outbox, party, invites };
  }
  if (m.k === 'presence') { const row = validSocialRow(m); return row ? { t: 'social', k: 'presence', ...row } : null; }
  if (m.k === 'party') { if (m.party == null) return { t: 'social', k: 'party', party: null }; const party = validPartyView(m.party); return party ? { t: 'social', k: 'party', party } : null; }
  if (m.k === 'invite') { const inv = validInvite(m); return inv ? { t: 'social', k: 'invite', ...inv } : null; }
  if (m.k === 'note') { if (!NOTE_CODES.includes(m.code)) return null; return { t: 'social', k: 'note', code: m.code, acct: idOf(m.acct), name: m.name == null ? null : sanitizeName(m.name) }; }
  const text = sanitizeLabel(m.m, SOCIAL_ERROR_MAX, { filter: false });   // 'error'
  return text ? { t: 'social', k: 'error', m: text } : null;
}

/** SOC1: a party member's pose from the hub ({t:'party', acct, p}), projected, or null. */
export function validPartyFrame(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.t !== 'party') return null;
  const acct = idOf(m.acct), p = validPartyPose(m.p);
  return acct && p ? { t: 'party', acct, p } : null;
}

/** QUEST1: a quest shared by a party member, from the hub ({t:'quest', acct, name, quest:{questName, displayName,
 *  data}}), projected, or null. `data` is systems/questShare.js's own envelope - opaque to the wire, exactly as
 *  'world'/'foes'/'act' data is, since validating a quest's own save-data shape is the quest engine's job, not the
 *  wire's. */
export function validQuestFrame(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.t !== 'quest') return null;
  const acct = idOf(m.acct);
  if (!acct) return null;
  const name = m.name == null ? null : sanitizeName(m.name);
  const q = m.quest;
  if (!q || typeof q !== 'object' || Array.isArray(q)) return null;
  const questName = typeof q.questName === 'string' ? q.questName.slice(0, QUEST_NAME_MAX) : '';
  const displayName = typeof q.displayName === 'string' ? q.displayName.slice(0, QUEST_NAME_MAX) : '';
  if (!questName || !q.data || typeof q.data !== 'object' || Array.isArray(q.data)) return null;
  return { t: 'quest', acct, name, quest: { questName, displayName, data: q.data } };
}

// ---- TRADE1 (2026-09-21): PLAYER-TO-PLAYER TRADE ------------------------------------------------------------------
// Pressing F on a player offers "Trade" beside "Add friend" and "Invite to party". The RELAY IS A COURIER HERE: it never
// sees an inventory, it never decides a trade, it carries one directed frame ({t:'trade', data:{to, k, s, ...}}) to the
// peer `to` names, in the room the sender stands in, and stamps the sender's id on it - the `hit` frame's own routing.
// Everything that matters (what may be offered, whether an item is a real item, what fits in a pack) is the CLIENTS' law
// (net/tradeSession.js, systems/loot.js validLootList): "what this client will not say, it will not hear".
//
// A session is bound by `s`, a short id the asker mints; a frame naming another session is nothing. `r` is the revision
// of the SENDER's offer, `o` the revision of the OTHER side's offer that the sender has seen: a lock or a confirm names
// both, so a lock on an offer that has since changed is refused by arithmetic rather than by hope.
/** Every kind a trade frame may carry. ask/yes/no open it; offer stages; lock/confirm agree; commit hands the goods over; cancel ends it. */
export const TRADE_KINDS = Object.freeze(['ask', 'yes', 'no', 'offer', 'lock', 'confirm', 'commit', 'cancel']);
/** The most item records one side's offer (and its commit) may carry. */
export const TRADE_ITEMS_MAX = 16;
/** The most gold one offer may name. */
export const TRADE_GOLD_MAX = 1_000_000_000;
/** The widest trade frame - the grant's own bound (scenes/exteriorFoes.js GRANT_FRAME_MAX), under MAX_FRAME_BYTES. */
export const TRADE_FRAME_MAX = 12 * 1024;
/** AUDIT DROPS B4: the widest trade DATA - the frame's cap less the wrapper the frame and the relay's fan-out put
 *  around it (`{"t":"trade","id":"<16>","data":` and `}`, under 64 bytes). validTradeData bounded the DATA at the
 *  FRAME's cap, so an honest offer of sixteen heavy items could pass at home and be refused at the relay's door as
 *  'frame too large' - which CLOSES the socket. What passes here now fits parseClient at the relay by construction. */
export const TRADE_DATA_MAX = TRADE_FRAME_MAX - 64;
/** The most trade frames a socket may send a second, and the most one socket is sent (the destination's funnel). */
export const TRADE_HZ_MAX = 8;
export const TRADE_ROOM_HZ_MAX = 32;
/** The room's trade BYTES a second, fanned - a commit carries a pack's worth of items, so the room budgets bytes as the hits do. */
export const TRADE_ROOM_BYTES_PER_S = 192 * 1024;
/** Why a trade ended, as a code the client puts words to (net/tradeSession.js tradeWhyText). */
export const TRADE_WHY = Object.freeze(['declined', 'cancelled', 'left', 'busy', 'timeout', 'range', 'refused']);
const TRADE_SID_RE = /^[A-Za-z0-9]{6,16}$/;
const TRADE_REV_MAX = 1_000_000;

export const tradeGate = (bucket, nowMs) => tokenGate(bucket, nowMs, TRADE_HZ_MAX);
/** The client's gate on trade frames COMING IN, per room - twice the send rate: an honest peer never passes it. */
export const TRADE_IN_HZ_MAX = TRADE_HZ_MAX * 2;
export const tradeInGate = (bucket, nowMs) => tokenGate(bucket, nowMs, TRADE_IN_HZ_MAX);

// ALLY-CAST (2026-09-23, Mac: "the use of spells on players ... some sort of ally targeting system"): A SPELL CAST ON A
// PARTY MATE, as ONE DIRECTED FRAME with the trade frame's own routing - `{t:'cast', data:{to, level, spell}}` from a
// hello'd socket in a place room to the socket `to` names, the sender's id stamped on it. The relay reads the SHAPE
// alone (validCastData: a bounded spell record - the classic effect entries SPELLS.STD and the spell maker both
// produce, systems/spellMaker.js buildCustomSpell); the RECEIVER decides what lands (systems/allyCast.js
// allyCastSpell: a party member's cast, its beneficial families alone). A cast costs the caster their magicka as any
// cast does, so the honest rate is a few a second; the funnel onto one destination is the hit arm's shape.
export const CAST_FRAME_MAX = 2 * 1024;
export const CAST_HZ_MAX = 4;
/** AUDIT ALLY-CAST B2: the destination's funnel is PER SENDER - a bounded list of sender buckets on the target's own
 *  attachment (PARTY_MAX slots: a full party's seven mates and one more), the stalest evicted for a newcomer. One
 *  bucket for every sender together let five strangers at their own rate starve a mate's heals (3 of 30 landed),
 *  and the relay cannot tell a mate from a stranger. A mate's cast now waits only on the mate's own spamming. */
export const CAST_DEST_SENDERS_MAX = 8;
export const CAST_IN_HZ_MAX = CAST_HZ_MAX * 2;
/** AUDIT ALLY-CAST B3/C3: the honest ceilings. A player is level 30 at most (classic's cap), SPELLS.STD's components
 *  are bytes (formats/spellsStd.js) and the maker's spinners stop under 100 (spellMaker.js SPINNER_RANGES) - the
 *  first cut's 60 and 1000 let a crafted mate grant a 61,000-point Shield for 42 game days. Nothing on the wire can
 *  vouch for the level (no pose carries one); the bound is what the receiver can refuse. */
export const CAST_LEVEL_MAX = 30;
export const CAST_EFFECTS_MAX = 3;       // spellMaker.js MAX_EFFECTS_PER_SPELL, the classic record's three slots
export const CAST_SETTING_MAX = 255;     // a duration/chance/magnitude component: the classic byte
export const CAST_ICON_MAX = 68;         // spellMaker.js SPELL_ICON_COUNT - 1
export const CAST_NAME_MAX = 32;
/** AUDIT ALLY-CAST B1: the relay that first carries the cast arm. An older one answers a cast with 'unknown message'
 *  and CLOSES the socket (the relay refuses what it cannot parse) - the caster was kicked offline by their own heal.
 *  The link refuses to send until the welcome says the relay can take it, as TRADE1's relaySupportsTrade does. */
export const CAST_RELAY_MIN = 97;
/** HCC-PARK: the first relay that knows the `park` frame (an older one CLOSES the socket on it - the cast arm's law). */
export const PARK_RELAY_MIN = 99;
export const relaySupportsPark = (v) => { const m = /^world(\d+)$/.exec(typeof v === 'string' ? v : ''); return !!m && Number(m[1]) >= PARK_RELAY_MIN; };
export const relaySupportsCast = (v) => { const m = /^world(\d+)$/.exec(typeof v === 'string' ? v : ''); return !!m && Number(m[1]) >= CAST_RELAY_MIN; };
/** FRIENDLY-SPELLS: THE SENDER'S METER HOLDS ONE WHOLE BLAST. The meter was sized when one cast was one frame; a
 *  beneficial blast is ONE cast and one frame for each party mate inside it, so a bucket CAST_HZ_MAX deep gave a
 *  full party's blast to four mates and silently none to the rest. The depth is a party's mates, the refill stays
 *  CAST_HZ_MAX a second, and the destination's per-sender funnel (CAST_HZ_MAX, the relay's cast arm) is untouched -
 *  a blast sends each mate one frame. Client and relay read this one gate, so they agree on it. */
export const CAST_BURST_MAX = PARTY_MAX - 1;
export const castGate = (bucket, nowMs) => tokenGate(bucket, nowMs, CAST_HZ_MAX, CAST_BURST_MAX);
export const castInGate = (bucket, nowMs) => tokenGate(bucket, nowMs, CAST_IN_HZ_MAX);
const CAST_SETTINGS = Object.freeze(['durationBase', 'durationMod', 'durationPerLevel', 'chanceBase', 'chanceMod', 'chancePerLevel',
  'magnitudeBaseLow', 'magnitudeBaseHigh', 'magnitudeLevelBase', 'magnitudeLevelHigh', 'magnitudePerLevel']);
/** The cast frame's data, projected: `to` an id, `level` 1..CAST_LEVEL_MAX, and a spell record whose name is a label,
 *  whose element and range type are the classic five, and whose effects are at most three entries of a classic type
 *  (0..44, no empty slot rides the wire), a sub type (-1..255) and the eleven integer components bounded above.
 *  Anything else refuses the whole frame - a half-landed spell is nobody's to guess. */
export function validCastData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const to = typeof d.to === 'string' && ID_RE.test(d.to) ? d.to : null;
  if (!to) return null;
  const level = Number.isInteger(d.level) && d.level >= 1 && d.level <= CAST_LEVEL_MAX ? d.level : null;
  if (level === null) return null;
  const sp = d.spell;
  if (!sp || typeof sp !== 'object' || Array.isArray(sp)) return null;
  const element = Number.isInteger(sp.element) && sp.element >= 0 && sp.element <= 4 ? sp.element : null;
  // AUDIT ALLY-CAST B4: a touch or a ranged single target - the two an honest frame carries (an area is never
  // redirected, a CasterOnly leaves as a touch); the receiver applies the gift as a self-cast whatever this says
  const rangeType = sp.rangeType === 1 || sp.rangeType === 2 ? sp.rangeType : null;
  if (element === null || rangeType === null) return null;
  const icon = sp.icon == null ? 0 : (Number.isInteger(sp.icon) && sp.icon >= 0 && sp.icon <= CAST_ICON_MAX ? sp.icon : null);
  if (icon === null) return null;
  if (!Array.isArray(sp.effects) || sp.effects.length < 1 || sp.effects.length > CAST_EFFECTS_MAX) return null;
  const effects = [];
  for (const e of sp.effects) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    if (!Number.isInteger(e.type) || e.type < 0 || e.type > 44) return null;
    const subType = Number.isInteger(e.subType) && e.subType >= -1 && e.subType <= 255 ? e.subType : null;
    if (subType === null) return null;
    const out = { type: e.type, subType };
    for (const k of CAST_SETTINGS) {
      const v = e[k] ?? 0;
      if (!Number.isInteger(v) || v < 0 || v > CAST_SETTING_MAX) return null;
      out[k] = v;
    }
    effects.push(out);
  }
  const name = typeof sp.name === 'string' ? sanitizeLabel(sp.name).slice(0, CAST_NAME_MAX) : '';
  return { to, level, spell: { name, element, rangeType, icon, effects } };
}

/** One trade frame's data, PROJECTED: `{to, k, s, ...exactly what its kind carries}` or null. Items are checked for
 *  SHAPE only (an array of at most TRADE_ITEMS_MAX plain objects) - the relay is pure and cannot import the game's item
 *  law; the receiving client projects each through validLootItem before a single field is read. One home: the relay's
 *  parser and the client's sendTrade/receive run this same function. */
export function validTradeData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (typeof d.k !== 'string' || !TRADE_KINDS.includes(d.k)) return null;
  const to = typeof d.to === 'string' && ID_RE.test(d.to) ? d.to : null;
  const s = typeof d.s === 'string' && TRADE_SID_RE.test(d.s) ? d.s : null;
  if (!to || !s) return null;
  const out = { to, k: d.k, s };
  const rev = (v) => (Number.isInteger(v) && v >= 0 && v <= TRADE_REV_MAX ? v : null);
  const items = (v) => {
    if (!Array.isArray(v) || v.length > TRADE_ITEMS_MAX) return null;
    for (const it of v) if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
    return v;
  };
  const gold = (v) => (Number.isInteger(v) && v >= 0 && v <= TRADE_GOLD_MAX ? v : null);
  switch (d.k) {
    case 'ask': case 'yes': case 'no': break;
    case 'offer': {
      const r = rev(d.r), it = items(d.items), g = gold(d.g ?? 0);
      if (r === null || it === null || g === null) return null;
      out.r = r; out.items = it; out.g = g; break;
    }
    case 'lock': {
      const r = rev(d.r), o = rev(d.o);
      if (r === null || o === null || (d.l !== 0 && d.l !== 1)) return null;
      out.r = r; out.o = o; out.l = d.l; break;
    }
    case 'confirm': {
      const r = rev(d.r), o = rev(d.o);
      if (r === null || o === null) return null;
      out.r = r; out.o = o; break;
    }
    case 'commit': {
      const r = rev(d.r), o = rev(d.o), it = items(d.items), g = gold(d.g ?? 0);
      if (r === null || o === null || it === null || g === null) return null;
      out.r = r; out.o = o; out.items = it; out.g = g; break;
    }
    case 'cancel': {
      if (d.why !== undefined) { if (typeof d.why !== 'string' || !TRADE_WHY.includes(d.why)) return null; out.why = d.why; }
      break;
    }
    default: return null;
  }
  if (JSON.stringify(out).length > TRADE_DATA_MAX) return null;   // AUDIT DROPS B4: the data's own cap, so the whole frame fits the relay's
  return out;
}

/** A fresh session id for an ask: the wire's own alphabet, TRADE_SID_RE's length. */
export const mintTradeSid = (rand = Math.random) => {
  let s = '';
  while (s.length < 10) s += rand().toString(36).slice(2);
  return s.slice(0, 10).padEnd(10, '0');
};

/** TRADE1: the first relay deploy that routes trade frames. */
export const TRADE_RELAY_MIN = 91;   // the drop said 84; the deploy that first carries it is world91 (QUEST1 + TRADE1 + PEER-FS1 in one)
/** Does the relay that named itself `v` in its welcome route trade frames? A name that is not `world<N>` is not a relay this can vouch for. */
export const relaySupportsTrade = (v) => { const m = /^world(\d+)$/.exec(typeof v === 'string' ? v : ''); return !!m && Number(m[1]) >= TRADE_RELAY_MIN; };


// ═══ HCC-PARK (2026-09-23, Mac: "I think we should build that") - A PARKED TEAM OUTLIVES ITS OWNER'S PRESENCE ═══
//
// HCC-ONLINE's word (`hv`, systems/horseCartWire.js) rides the owner's own foes frame, so a team stood for the others
// only while its owner was in the cell room to say it: a wagon parked at a shop door vanished the moment its owner
// walked in. A PARKED team is a thing left in the world, so the CELL keeps it: each cell room holds one record per
// owner - the Deployed wagon and the horse standing loose or hitched to it, nothing that moves - in its storage,
// handed to every joiner and fanned on every change, until the owner's word replaces it.
//
// THE OWNER SPEAKS FROM ANYWHERE, THE CELL KEEPS ONLY ITS OWN. A `park` frame names the team's ANCHOR (its natives)
// and, when the owner's client is showing the team, its record. The room the frame lands in STORES it only when the
// anchor stands in that room's own cell (a record cannot be planted in a cell its owner is not in - the camps' and
// the foes' law: a peer speaks only for itself and only where it is); anywhere else the frame is the owner's word
// about WHERE their team is, and nothing is stored. Either way the owner's REGISTRY (one object per owner,
// `parkreg:<key>`) learns the cell, and when that cell changed - or nothing is parked - it tells the old cell to drop
// the record. So a team summoned away, ridden off, re-parked across the map or loaded from an older save leaves no
// ghost, whichever room its owner is standing in when it happens.
//
// WHO THE OWNER IS (AUDIT HCC-PARK D1/D2). Not the socket's peer id: that is the client's own choice, proved only
// inside one room and minted again in every new tab - so a record keyed by it could be dropped or overwritten by
// anyone who said the id somewhere else, and a player returning in a new tab left their old record standing beside
// the new one. The owner is the ACCOUNT the identity token verified (the socket's `sub`) and the CHARACTER the frame
// names (`c`, systems/characterId.js - one account holds several characters, each with its own team): the relay
// keys the record by an opaque hash of the two (parkKeyOf), which is what the others are told. A player can reach
// only their own account's records, and the account's subject never leaves the relay (a place room names no
// account - MOD1). The relay never hands an account its own records back: its client draws its team off its save.
//
// Bounded four ways: PARK_CELL_MAX records a cell (the stalest evicted), PARK_ACCOUNT_MAX of them one account's
// (its own stalest goes first - one account cannot empty a cell of everyone else's), PARK_TTL_MS since the owner last
// said it (an owner who never returns takes theirs with them in the end), PARK_HZ_MAX frames a second a socket.

/** A cell room's record key in its own storage (`k` the owner's parkKeyOf). */
export const parkKey = (k) => `park:${k}`;
/** The owner's registry object's name (a Room instance no park frame stores anything in). */
export const parkRegistryRoom = (k) => `parkreg:${k}`;
/** The owner's key: the account the token verified and the character the frame named, hashed - stable across tabs
 *  and sessions, distinct per character, unforgeable (no one else's socket carries that account), and opaque (the
 *  account's subject is not what the others are told). */
export const PARK_KEY_RE = /^[0-9a-f]{24}$/;
export async function parkKeyOf(sub, c) {
  const bytes = new TextEncoder().encode(`${sub}\n${c}`);
  const d = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  let hex = '';
  for (let i = 0; i < 12; i++) hex += d[i].toString(16).padStart(2, '0');
  return hex;
}
/** A character id as the frame may carry it (characterId.js mints a UUID, or a stamp and a random tail). */
export const PARK_CHAR_RE = /^[A-Za-z0-9-]{8,64}$/;
/** The two internal doors between objects - paths the public worker never forwards (it forwards /room/<key> alone). */
export const PARK_INTERNAL_REG = '/internal/park/registry';
export const PARK_INTERNAL_DROP = '/internal/park/drop';
export const PARK_CELL_MAX = 32;
export const PARK_ACCOUNT_MAX = 4;
export const PARK_TTL_MS = 72 * 3600 * 1000;
/** The same word again refreshes its record's time at most this often (and is fanned to nobody). */
export const PARK_REFRESH_MS = 10 * 60 * 1000;
export const PARK_HZ_MAX = 2;
/** How far (natives, either axis) a record's wagon and horse may stand from its anchor - a hitched horse stands 3.1 m
 *  ahead of its wagon; a quarter of a native pixel is room for any team and no room for a second place. */
export const PARK_REACH = 8192;
/** A world-frame point's cell room - the map pixel off the natives (MapsFile.WorldCoordToMapPixel: x / 32768,
 *  499 - z / 32768) and the cell off the pixel (worldRoom). */
export const cellRoomOfWire = (x, z) => worldRoom(Math.trunc(x / PIXEL_UNITS), 499 - Math.trunc(z / PIXEL_UNITS));
const PARK_TIERS = new Set([0, 25, 50, 75, 90]);
const PARK_KIND_DEPLOYED = 2;
/** The per-socket park gate. */
export const parkGate = (bucket, now) => tokenGate(bucket, now, PARK_HZ_MAX);

/**
 * A `park` frame's data through the door: `{ c, a?: [x, z], r?: { w?, h?, n? } }`. `c` the character (PARK_CHAR_RE);
 * no `a`: nothing of that character's is parked. `a` the anchor in natives, inside the world. `r` the team as shown: `w` a DEPLOYED wagon only ([2, x, y, z, qx, qy, qz, qw, tier, 0] - a unit
 * quaternion, a known tier), `h` a horse standing ([x, y, z, fx, fz, 0] - never walking: a walking horse is not
 * parked), `n` the horse's name through the label door; every part within PARK_REACH of the anchor. Anything else is
 * null - the frame is refused.
 */
export function validParkData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (typeof d.c !== 'string' || !PARK_CHAR_RE.test(d.c)) return null;
  const a = d.a;
  if (a === undefined || a === null) return d.r === undefined || d.r === null ? { c: d.c } : null;
  if (!Array.isArray(a) || a.length !== 2 || !a.every(finite) || a.some((v) => v < 0 || v > POSE_BOUND)) return null;
  const out = { c: d.c, a: [a[0], a[1]] };
  if (d.r === undefined || d.r === null) return out;
  const r = d.r;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const near = (x, z) => Math.abs(x - a[0]) <= PARK_REACH && Math.abs(z - a[1]) <= PARK_REACH;
  const rec = {};
  if (r.w !== undefined) {
    const w = r.w;
    if (!Array.isArray(w) || w.length !== 10 || !w.every(finite) || w[0] !== PARK_KIND_DEPLOYED) return null;
    if (!near(w[1], w[3]) || Math.abs(w[2]) > POSE_Y_BOUND) return null;
    const len = Math.hypot(w[4], w[5], w[6], w[7]);
    if (!(len > 0.5 && len < 2) || !PARK_TIERS.has(w[8])) return null;
    rec.w = [PARK_KIND_DEPLOYED, w[1], w[2], w[3], w[4] / len, w[5] / len, w[6] / len, w[7] / len, w[8], 0];
  }
  if (r.h !== undefined) {
    const h = r.h;
    if (!Array.isArray(h) || h.length !== 6 || !h.every(finite) || h[5] !== 0) return null;
    const fl = Math.hypot(h[3], h[4]);
    if (!near(h[0], h[2]) || Math.abs(h[1]) > POSE_Y_BOUND || !(fl > 1e-6)) return null;
    rec.h = [h[0], h[1], h[2], h[3] / fl, h[4] / fl, 0];   // AUDIT HCC-PARK D5: a facing, so a unit one - 1e300 is stored and fanned no more
  }
  if (r.n !== undefined) {
    if (typeof r.n !== 'string' || r.n.length > 124) return null;
    const n = sanitizeLabel(r.n, 31);
    if (n && rec.h) rec.n = n;
  }
  if (!rec.w && !rec.h) return null;
  out.r = rec;
  return out;
}
