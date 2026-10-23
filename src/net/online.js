// @ts-check
import { relaySupportsFoeInventory } from './wire.js';
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
import { validStaffTeleportIn, validStaffTeleportOut, staffTeleportSupported } from './staffTeleport.js';
import { validFollowOut, whereNoteDue, followSupported } from './staffFollow.js';   // STAFF-PANEL5-FOLLOW: the hub's word to a spectator, and the where note's pace
import { validRelayCfgIn, validRelayCfgOut, relayCfgSupported } from './relayCfg.js';
import { relaySupportsSeatLive, seatAskDue, seatStreams } from './seatLive.js';   // FIELD BUGS 2026-10-18d SEAT-LIVE: a dungeon room's seat is a live socket's
import { relaySupportsGrant, relaySupportsGrantStats, relaySupportsStarGrant, grantModeOf, validGrantAsk, validGrantOut, grantGate } from './grantLaw.js';   // GRANT2: the spawn grants' asks (bible/11-Multiplayer/Spawn-Grants.md section 12)   // SCALE5b: the relay's settings, a developer's
import { hubHopOf, isChannelShard, channelOf, hubShardsSupported, HUB_FIND_MAX, HUB_FIND_Q_MAX, HUB_GUILD_WHO_MS, HUB_GUILD_WHO_MAX, HUB_WHO_MS } from './hubShards.js';   // SCALE5c: the hub, sixteen ways
import { CHAT_ROSTER_MAX } from './wire.js';   // SCALE5c: the World tab's list while the hub is small
/** CHAT-FIND-HUB: the chat's search box asks the hub no closer together than this - the relay's own bucket for a socket
 *  is a search a second (three banked), and the World and Guild tabs' asks spend it too. The client's own pace, so here
 *  and not in net/hubShards.js: the relay imports that file, and a constant there is a relay change (RELAY_VERSION). */
export const HUB_FIND_ASK_MS = 1500;
/** CHAT-FIND-HUB: a query that still stands in the box is asked again once its answer is this old (who is online moves). */
export const HUB_FIND_FRESH_MS = 15_000;
import { isLayered, LAYERS_MAX } from './wire.js';   // SCALE5d: a crowded place's layers
import { instanceRoomOf, relaySupportsInstances } from './instanceRoom.js';   // INSTANCES: a place's instance room (bible/11-Multiplayer/Instances.md)
import { layoutRoomKey } from '../world/interior/interiorShared.js';   // WD3 (AUDIT WD3 B3): an interior's room is its layout's
import { tabStorage } from '../systems/appStorage.js';   // the tab's own storage - the seam, never the browser's own (a PIN)
import { STAMP_RE } from './safety/chatStamp.js';   // SAFE2: a line's stamp, carried as the relay said it
import { MUTE_HZ_MAX, CHAT_HZ_MAX, CHAT_MAX, relaySupportsBan } from './wire.js';   // AUDIT SAFE RELAY-2: the order meter and my own lines' pace, the relay's word on my chat's own bucket; RELAY-3: the ban frame's relay
import { REALM_CHARACTER_RE } from './identityToken.js';   // AUDIT LEGACY III O1: a wed frame's stamped realm character, by the token's own shape
import { leaseRoom, relaySupportsLease, LEASE_MS, LEASE_HELD_MS, LEASE_HAND_MIN_MS } from './roomLease.js';   // LEASE1: my hub's lease, handed to every lease room I hold
import { LEASE_WIRE_MAX } from './wire.js';
/** LEASE1: the frames a lease room's socket sends with no lease ahead of them - the runtime's ping, the hello, a lease. */
const LEASE_QUIET_RE = /^\{"t":"(?:ping|hello|lease)"/;
import { wrapAngle } from '../world/mat4.js';   // ONCRASH1: the port's one angle wrap, which cannot loop

import { isGateRoom, PIXEL_M } from './gate/gateLaw.js';   // WB3: a gate's arena is one room of its own
import { isBattleRoom, isRoyalRoom } from './siege/siegeRef.js';   // SEAT2a part four: a siege's battle is one room of its own   // CROWN1 part two: and a Royal Tourney's
import { caravanKeyOf } from './privateInterior.js';   // WAGONS2-VISIT: a caravan's own room (NET-SMOOTH's owned interior is wire.js nativePoseRoom's now, SLIM-FRAME)
import { relaySupportsCaravan, validCaravanData } from './wire.js';   // WAGONS2-VISIT: what a caravan's owner placed, said to its room
import { isArenaRoom, validArenaIn } from './arena/arenaLaw.js';   // ARENA4: the arena's hall and its bouts
import { poseChanged, POSE_TS_MOD, poseTsDiff, SOCKETS_MAX, WORLD_CELL, RANGE_PIXELS, PIXEL_UNITS, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, WORLD_FRAME_MAX, worldFrameMaxFor, isCellRoom, hitOwnerOf, validPose, validLook, sanitizeName, readBadge, readAura, readIcon, readRibbon, sanitizeChat, chatGate, redGate, dmGate, relaySupportsDm, muteGate, subOf, mutedUntilOf, worldRoom, inRange, relayUrl, isWorldRoom, streamsFoes, isChatRoom, foesGate, FOES_FRAME_MAX, MAX_FRAME_BYTES, hitGate, actGate, actFrameFits, whoGate, WHO_RETRY_MS, HEARTBEAT_MS, PING_MS, FOES_FULL_MS, FOES_STALE_MS, relayVersionOf, chatInGate, CHAT_ROOM_HZ_MAX, socialGate, partyGate, validPartyPose, validSocialFrame, validPartyFrame, PARTY_SEND_MS, validSocialAct, socialInGate, noteInGate, partyInGate, SOCIAL_IN_HZ_MAX, NOTE_IN_HZ_MAX, INBOUND_FRAME_MAX, questInGate, validQuestFrame, QUEST_SEND_MS, QUEST_HUB_MIN_MS, PARTY_MAX, tokenGate, validTradeData, tradeGate, tradeInGate, validCastData, castGate, castInGate, CAST_FRAME_MAX, CAST_IN_HZ_MAX, relaySupportsCast, TRADE_IN_HZ_MAX, relaySupportsTrade, TRADE_FRAME_MAX, parkGate, relaySupportsPark, PARK_CELL_MAX, PARK_KEY_RE, PARK_TTL_MS, relaySupportsChannels, relaySupportsLang, relaySupportsTradeChan, CHAT_LINE_CHANNELS, partyChatInGate, PARTY_CHAT_ROOM_HZ_MAX, relaySupportsRoll, rollGate, validRollSpec, validRoll, relaySupportsEmote, validCardData, cardGate, cardInGate, CARD_FRAME_MAX, CARD_IN_HZ_MAX, relaySupportsCard, validPageData, pageGate, pageInGate, PAGE_FRAME_MAX, PAGE_IN_HZ_MAX, relaySupportsPage, validDuelData, duelGate, duelInGate, DUEL_FRAME_MAX, DUEL_IN_HZ_MAX, relaySupportsBossRef, bodyWordGate, relaySupportsDuelRef, validDuelRefOut, validWedData, wedGate, wedInGate, WED_FRAME_MAX, WED_IN_HZ_MAX, relaySupportsWed, readRenown, renownGate, relaySupportsRenown, RENOWN_ORDER_KEEP_MS, RENOWN_RESEND_MS, lookGate, relaySupportsLook, relaySupportsPartyTravel, relaySupportsRestOpt, relaySupportsEvent, relayKnowsLiveEvent, eventGate, validLiveEvent, LIVE_EVENTS, isSocialRoom, validGateIn, validGateOut, gateGate, relaySupportsGate, relaySupportsOwn, relaySupportsGateSpent, relaySupportsGateSite, relaySupportsGateHeal, relaySupportsCourtWatch, relaySupportsPortents, gatePlaceWire, readGuildTag, readHouse, relaySupportsGuild, GUILD_ORDER_KEEP_MS, guildChatInGate, GUILD_CHAT_ROOM_HZ_MAX, validRaidIn, validRaidOut, raidGate, relaySupportsRaid, validRaidTownsIn, isRegionRoom, validTravellerMark, validTravellerFrame, validTravWords, relaySupportsTravellers, travInGate, TRAV_SEND_MIN_MS, TRAV_WELCOME_MAX, TRAV_STALE_MS, relaySupportsPartyWalk, relaySupportsPartyLead, relaySupportsPartyMap, validAmapFrame, amapBody, AMAP_SEND_MS, AMAP_HUB_MIN_MS, validSiegeIn, validSiegeOut, siegeGate, relayFightsBattles, relayRunsRoyal, validRiteIn, validRiteOut, riteGate, relaySupportsRite, validStarIn, validStarOut, starGate, relaySupportsStar, arenaGate, relaySupportsArena, readArenaOut, validWildData, validWildOut, wildDirected, wildGate, wildInGate, WILD_IN_HZ_MAX, WILD_FRAME_MAX, relaySupportsWildRef, validWildRefOut, relaySupportsWdun, relaySupportsWdunGiants, relaySupportsWdunSea, seaVaultCell, validWdunIn, validWdunOut, BUSY_TOKEN_UNREAD, WIRE2_BATCH_MAX, GROUND_LAW, groundRoom, GRANT_HELLO_LAW, validParkYeet, relaySupportsWildCollect, relaySupportsHome, HOME_ORDER_KEEP_MS, validHomeFrame, homeInGate, relaySupportsSeaPvp, SEA_PVP_KINDS } from './wire.js';   // SCALE5a: a busy close's word that the token went unread   // SOC2: the hub's law, at home; AUDIT SOC B3/B11/B20: the act's projection, the inbound gates, the inbound bound
import { relaySupportsHoldem, holdemGate, validHoldemIn, validHoldemOut, relaySupportsIliac, validIliacIn, validIliacOut, relaySupportsGambit, validGambitIn, validGambitOut } from './wire.js';   // CARDS5: the relay's card table, both ways
import { RAID_TOWNS_CHUNK } from './raid/raidLaw.js';   // RAID-ROLL: the towns table's pieces
import { dungeonRoomTag } from './wire.js';   // SD-ONLINE: a dungeon's room carries the size it was built at
import { nativePoseRoom } from './wire.js';   // SLIM-FRAME: the frame a room's poses are in - one home, the relay's slim pose rounds by it
import { validSdIn, validSdOut, sdGate, sdPzGate, relaySupportsSd, sdFightGate, SD_BRAIN_V } from './wire.js';
import { validEgIn, validEgOut, egGate, relaySupportsEg, relaySupportsEgLand, EG_BRAIN_V } from './wire.js';   // EG-PLAY: an Elite Breach's frame - the open to the hub, a member's words to its room; the call, the breach and its fights in
import { egHubGate, EG_HUB_KINDS } from './wire.js';   // AUDIT EG IV (lane3 #5): the hub's breach words on their own bucket
import { isEgRoom } from './eliteGates/egLaw.js';   // SD3: the Super dungeon's frame - a find out, the hub's record in; SD6b: a turn out, the realm's Orrery in
import { isSdRoom } from './superDungeon/sdLaw.js';   // SD6b: the realm's room, where the Orrery's turns go
import { owGate, validOwIn, validOwOut, relaySupportsOverworld, OW_WORD_IDS_MAX, OW_WORD_ROWS_MAX, relaySupportsOwGraves, owGraveGate } from './wire.js';   // GRAVE-PARTY: and the graves' word's relay - AUDIT GRAVE-PARTY G3: and its own bucket
import { validSerpentIn, validSerpentOut, serpentGate, relaySupportsSerpent, relaySupportsSerpentSite } from './wire.js';   // SERPENT1: the sea serpent's frame, both ways   // OW6L: the overworld ledger's frame, both ways
import { owIdInCell, owRowInCell, owRowSane } from './overworldLaw.js';   // OW6L: and the cell's law, held at home before a word is said
import { reconnectWave } from './reconnectWave.js';   // SCALE2c: a relay deploy's reconnect, spread by the hub's count
import { readWatchReceipt } from './watchReceipt.js';   // SEAT1b: the Watch's tick, read (never judged) at home
import { ownerClock, stampedFrameText, applyingOwnerTm } from './ownerClock.js';   // OWNER-CLOCK: a foes frame says when its foes were stepped, and is applied with it in hand
import { t } from '../systems/textManager.js';   // L10N4: the HUD line's words in the player's language (the relay's own words pass as it said them)

export { WORLD_CELL, RANGE_PIXELS, worldRoom };

/** Poses a second, at most, when the pose moved. */
export const POSE_HZ = 10;
/** SLAM3 (2026-09-16, Mac: the 30th-anniversary slam): the floor the crowded rate falls to. Below this a walk reads
 *  as a series of hops however well it is eased. */
export const POSE_HZ_MIN = 4;
/** GUILD1c: the client's spacing of guild frames down one socket, ms - wider than the relay's own gate (GUILD_ORDER_HZ_MAX,
 *  one a second) by the wire's jitter, so a frame is never the one a bunched pair makes the relay drop. */
export const GUILD_SEND_MS = 1_500;
/** GUILD1c: when a guild frame goes down a socket the second and last time, ms after the first - for the one the relay
 *  dropped anyway; the relay answers a repeat with what it already holds, and a removal it holds is a no-op. */
export const GUILD_RESEND_MS = 5_000;
/** SLAM3: peers past which a room counts as a CROWD and the rate starts coming down. Under it nothing changes at
 *  all - ordinary play in the Bay is two or three people and must not pay for an event it is not having. */
export const POSE_CROWD = 24;
/** SLAM3: the bounds on a measured ease interval - a burst must not snap a peer, a silence must not make it crawl. */
/** ACC1d: the whole budget a hello will wait for an identity token.
 *  Past it the connection goes ahead unsigned. Short on purpose: this
 *  sits between the socket opening and the first frame, so it is time a
 *  player spends staring at nothing.
 *  FIELD BUGS 29h (TOKEN-WAIT; the Discord: "stuck in a perpetual 'World: Sign in to play online' & 'World:
 *  Connecting'"): ACC1g put the wall at the door - a hello without a token is REFUSED ("sign in to play online", a
 *  policy close, terminal) - so past this budget there is no connection that works any more, only that refusal, and
 *  the World link's rejoin every thirty seconds met it again: the loop the player saw, for anyone whose token takes
 *  longer than 2.5 s (the token route is eight D1 round trips from the player's edge and a preflighted POST to a second
 *  host, three at once as the page starts). It covers the service's real answer now, and stays under the relay's
 *  HELLO_WAIT_MS (net/wire.js), past which a full room closes a socket that has said nothing. */
export const TOKEN_WAIT_MS = 8000;

export const GAP_MIN_MS = 50;
export const GAP_MAX_MS = 1000;
/** HALO-THIN (2026-10-10, the owner: "For you when you are near a player ... Theres 10 position updates every time.
 *  Multiply it by the times the player is near you and its an insane bottleneck"): A HALO HEARS WHERE I AM, NOT EVERY
 *  STEP. My pose went down my cell's socket AND every halo's at the full rate (sendPose), and a listener holding two,
 *  three or four of those rooms heard each pose once per room it shares - two copies astride a cell's edge, four at its
 *  corner, every one of them parsed, gated and dropped as a copy (NET-SMOOTH 2, SCALE2b's `ts`), and every one fanned by
 *  its room. By WORLD6b-iii(b)'s own symmetry (wire.js cellHaloFor) everyone within range of me holds MY cell, so its
 *  fan alone reaches them all, which is why foes are never streamed to a halo (`_halo`). A halo hears my pose so that its
 *  fan ranges me as a LISTENER (inRange, on the map pixel) and ranks me among its nearest (wire.js poseFan, by ground
 *  distance), and so its roster places me. That needs where I am, not my every step. So a halo hears a pose when it is
 *  due (`haloPoseDue`): its first since its welcome, a new map pixel (the range's own grain, and a raid's word), HALO_STEP_M
 *  moved on the ground since the last it heard (the near tier's ranking), standing at a place it has not heard (a stop),
 *  and the heartbeat. A fall is sendDeath's, down every socket. Every pose still goes to a halo (whole):
 *   - while my own cell's socket takes none (AUDIT WORLD6b-iii(b) A5: the halos carry me then);
 *   - while the halo reaches a player in range who does not hold my cell (`_haloAlone`) - the symmetry is where everyone
 *     WANTS to be, and a socket into my cell still opening, backing off or refused busy leaves its player hearing me
 *     through this halo alone (AUDIT PEER-RANGE + HALO-THIN, B F1);
 *   - while the host says a referee may stand in a halo (`haloWhole`: a duel, a serpent's fight - the relay's duelPose and
 *     a fight's trail read the pose of the room the bout is in, and a duel's room is the one my opponent is heard
 *     through). A word for a referee down a halo (a duel's, a rite's) brings that halo my latest pose first
 *     (`_haloCurrent`), so the judge reads where I am. And a halo is pinged on its own clock (RELAY-H1's cadence), since
 *     its poses no longer keep it busy. */
export const HALO_STEP_M = 8;
/** HALO_STEP_M in the pose's own units - a halo is a world cell's, and a cell's poses are MapsFile's frame. */
export const HALO_STEP_UNITS = HALO_STEP_M * (PIXEL_UNITS / PIXEL_M);
/**
 * HALO-THIN: is `pose` (going out now) due to a halo whose last pose from me was `last` ({ x, z, mv, at }, or null for
 * none since the halo's welcome)? Pure.
 * @param {{ x: number, z: number, mv: number, at: number }|null|undefined} last
 * @param {{ x: number, z: number, mv?: number }} pose
 * @param {number} now
 */
export function haloPoseDue(last, pose, now) {
  if (!last) return true;
  if (now - last.at >= HEARTBEAT_MS) return true;
  if (!(pose.mv | 0) && ((last.mv | 0) !== 0 || pose.x !== last.x || pose.z !== last.z)) return true;   // standing: a stop, or a place the halo has not heard (AUDIT B F3: a walk under the step, then a stop)
  if (Math.floor(pose.x / PIXEL_UNITS) !== Math.floor(last.x / PIXEL_UNITS) || Math.floor(pose.z / PIXEL_UNITS) !== Math.floor(last.z / PIXEL_UNITS)) return true;
  const dx = pose.x - last.x, dz = pose.z - last.z;
  return dx * dx + dz * dz >= HALO_STEP_UNITS * HALO_STEP_UNITS;
}
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
/** AUDIT CONTRIB A2: the fallen remembered at once (one death per life) - the oldest goes first past this. */
export const FALLEN_MAX = 256;
/** The relay this port hosts (server/wrangler.toml). */
/** AUDIT DROPS B3: the most senders the inbound trade gate keeps a bucket for before it forgets them all - a room holds SOCKETS_MAX at most, so an honest map never reaches it. */
const TRADE_IN_SENDERS_MAX = 64;
/** AUDIT 68 S14-quest-inbound-ungated: the quest shares one room passes a second - an honest hub's worst case, every
 *  other seat of my party sharing at the hub's own per-socket cooldown (QUEST_HUB_MIN_MS), with all of them at once for its burst. */
const QUEST_IN_ROOM_HZ = ((PARTY_MAX - 1) * 1000) / QUEST_HUB_MIN_MS;
export const DEFAULT_SERVER = 'wss://daggerfall-online.mackcothran.workers.dev';
/** A peer silent this long is HIDDEN (out of range, or its socket is
 *  gone and the leave is on its way); only the room's leave removes it. */
// RELAY-H1: DERIVED from the heartbeat, never a literal beside it. The silence law hides a peer this long after its
// last pose; SLAM8/13 pin the ratio (a standing peer is heard at least three times before it could vanish), and a
// literal here went quietly wrong the day the heartbeat moved. Four heartbeats, the margin the 20000/5000 pair had.
export const PEER_TIMEOUT_MS = 4 * HEARTBEAT_MS;
/** WILD1: how long a fallen player's room still carries a directed wild frame to them - the zone's body lies two
 *  minutes (systems/wild/wildZone.js WILD_DEATH_HOLD_S), with a margin for the clocks. */
export const WILD_GHOST_MS = 150_000;
/** INT9 (AUDIT): how often my word that I stand in the zone is said again on my cell's socket while it stands - a relay
 *  object that restarted forgot it (and with it every fight there), and the next word makes the fighter again. */
export const WILD_ZONE_KEEP_MS = 15_000;
/** RUN-IN-PLACE (2026-10-06, Mac: "theres a lot of player desync online, including players appearing to run in
 *  place"): how long a peer drawn standing still may go on reading as moving. A body walks off its drawn pose's `mv`
 *  (net/peer/peerClimb.js peerMoving, every on-foot renderer and the footsteps), and the play-out (`tick`) stands a peer at
 *  the end of its path whenever the next pose is late - a sender's hitch, a tab put in the background, a reconnect, a
 *  stall on the line - with the last pose's `mv` still on it: the body ran and stepped in place, for as long as
 *  PEER_TIMEOUT_MS when the poses stopped for good. The sender's own law (scenes/world.js ONLINE_MOVE_HOLD_MS, 250):
 *  moving reads true this long after the last frame that MOVED, so a gap shorter than the hold never restarts a stride
 *  (ONLINE-MVFLICKER1) and a longer one stands the body still. */
export const SHOWN_MOVE_HOLD_MS = 250;
/** SCALE2: a hello refused for its missing token is asked again - unless it had none because this device holds no
 *  sign-in ('no-session') or the service refused the one it holds ('auth'): signing in is the way back from those.
 *  AUDIT SAFE CLIENT-2: nor because the account is banned ('banned') - the service will mint it nothing until the ban
 *  ends, and asking again every few seconds was a refused mint and a refused hello a room, for the ban's length. */
export const tokenRetryable = (/** @type {string|null|undefined} */ why) => typeof why === 'string' && why !== 'no-session' && why !== 'auth' && why !== 'banned';
/** AUDIT SAFE RELAY-2 (2026-10-17): THE RELAY'S WORD ON MY OWN CHAT, a second - `law`, `banned`, `muted` and `slowed`, on a
 *  bucket of their own. They rode the chat lines' inbound bucket (CHAT-G's), so a channel running at its budget dropped
 *  the very frame that said I was muted or banned, or carried the order to my other rooms. Derived, never a literal: an
 *  order a second at the relay's meter (MUTE_HZ_MAX) is two frames (its `law` and its word - `banned` or `muted`), and the
 *  rest answer my own lines, which leave at CHAT_HZ_MAX at most. */
export const LAW_IN_HZ_MAX = 2 * MUTE_HZ_MAX + CHAT_HZ_MAX;
/** AUDIT SAFE RELAY-2: and its depth - the burst it takes at once: a welcome's word and an order's two frames together, and
 *  a moment's answers to my lines, never cut. */
export const LAW_IN_BURST = 2 * LAW_IN_HZ_MAX;
/** AUDIT SAFE CLIENT-7: the frames one peer addresses to me that ASK something of me (`_directedIn`) - what a block holds
 *  back, as it holds back the account's lines, friend requests and party invites. */
export const BLOCKED_KINDS = Object.freeze(['trade', 'card', 'page', 'duel', 'wed']);
/** Reconnect backoff bounds, ms. */
export const BACKOFF_MIN_MS = 1000;
export const BACKOFF_MAX_MS = 8000;
/** AURA-LIVE: a badge said again (`rehello`) at most once this often - a player trying aura after aura costs the room's
 *  hello budget one hello a socket per gap, and it is the LATEST badge that goes. */
export const REHELLO_GAP_MS = 3000;
/** How often a world room's host publishes the room's memory (WORLD1); the relay drops one sooner than WORLD_MIN_MS. */
export const WORLD_PUBLISH_MS = 15000;
/** SCALE2b: a host whose room's memory has not changed says it again at least this often (world.js worldPublish skips
 *  an unchanged memory otherwise - the room already holds it). */
export const WORLD_REPUBLISH_MS = 5 * 60 * 1000;
/** WORLD2: how often the host streams its changed foes (5 a second - under FOES_HZ_MAX with room for a burst). */
export const FOES_MS = 200;
/** WORLD2: the stream's full frame, and AUDIT WORLD2 C5's seat staleness. FIELD BUGS 2026-10-18d SEAT-LIVE: their home is
 *  net/wire.js (the relay elects the seat by the same staleness); re-exported here for the callers that always read them here. */
export { FOES_FULL_MS, FOES_STALE_MS };
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
 * @param {string|null} [p.layout] the interior's town's layout stamp (WD3 - its room is its layout's)
 * @param {string|null} [p.size] the dungeon's built size (smallerDungeons.js builtDungeonSize - SD-ONLINE: its room is its layout's)
 * @param {{owner:string,epoch:string}|null} [p.instance] INSTANCES: the place's instance (net/instanceRoom.js) - its room in place of the public one
 */
export function roomKeyFor({ host, mode, mapId = null, regionIndex = -1, locationName = '', buildingKey = 0, mapPixel = null, layout = null, size = null, instance = null }) {   // INSTANCES: `instance` - { owner, epoch } (net/instanceRoom.js), the place's instance in place of its public room
  // AUDIT WORLD34 A1: the map id is MAPS.BSA's 32-bit integer read SIGNED (formats/mapsFile.js getInt32), so one with
  // bit 31 set read negative here and fell to the name slug - a room the wire keeps no world for. The UNSIGNED value
  // is the id, the same on every client; 0 alone is "no map row" (the probe's fixture)
  const id = Number.isFinite(mapId) ? mapId >>> 0 : 0;
  const loc = id > 0 ? `m${id}` : (locationName && regionIndex >= 0 ? `${regionIndex}.${slug(locationName)}` : null);
  // INSTANCES: an instance's room is its place's public room - a dungeon WHOLE, whatever size the world gives it - with its
  // owner and epoch after it; one that cannot be keyed (no map id, a malformed instance) is NO room, never the public one
  if (instance && (mode === 'dungeon' || mode === 'interior')) {
    const bk0 = Number.isFinite(buildingKey) ? buildingKey >>> 0 : 0;
    const base = mode === 'dungeon' ? (id > 0 ? `dungeon:m${id}` : null) : (id > 0 && bk0 ? `interior:m${id}.${layoutRoomKey(bk0, layout)}` : null);
    return base ? instanceRoomOf(base, instance) : null;
  }
  if (mode === 'dungeon') return loc ? `dungeon:${loc}${dungeonRoomTag(size)}` : null;   // SD-ONLINE: a re-laid dungeon's room is its layout's, `.m` or `.s` (wire.js WORLD_ROOM)
  const bk = Number.isFinite(buildingKey) ? buildingKey >>> 0 : 0;   // AUDIT WORLD6a B5: unsigned, as the id is - the memory's key (interiorLocationKey) spells it so, and the two must agree by construction
  if (mode === 'interior') return loc && bk ? `interior:${loc}.${layoutRoomKey(bk, layout)}` : null;   // WD3 (AUDIT WD3 B3): the building's room in its town's layout (world/interior/interiorShared.js)   // a door the directory cannot key (0) is no room, not a pool of them
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
  // CARDS2b (AUDIT CARDS D6): a sit or a stand is a place taken, not a walk - the seated body drawn sliding to its chair
  // (the seat on at once, the feet still easing) was neither
  const k = (!!from.st !== !!to.st) || t > 1 ? 1 : t < 0 ? 0 : t;
  return {
    x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k,
    yaw: lerpAngle(from.yaw, to.yaw, k), pitch: from.pitch + (to.pitch - from.pitch) * k, mv: to.mv,
    wd: to.wd ?? 0, an: to.an ?? 0, as: to.as ?? 0,   // MAC7 #1: the arm's three ride the drawn pose whole - nothing to ease
    am: to.am ?? 0, sr: to.sr ?? 0, cn: to.cn ?? 0, cr: to.cr ?? 0,   // MAC7 #2: and the other four
    ce: to.ce ?? 4,   // SPELLFX1: the cast's element, whole
    ar: to.ar ?? 0,   // SPELLFX1: and the arrows loosed
    fk: to.fk ?? 0,   // PEER-FS1: the footstep-sound kind - discrete, rides the drawn pose whole like the rest
    ...(to.rd ? { rd: to.rd, rv: to.rv ?? 0, ...(to.hs ? { hs: 1 } : {}), ...(to.rc ? { rc: to.rc } : {}) } : {}),   // COATS1: the horse's coat with it   // RIDE: the mount, discrete, omitted on foot as the wire omits it; DISC7: the half-speed bit with it
    ...(to.lh ? { lh: 1 } : {}),   // DISC12: the LEFT hand in use - discrete, omitted on the right as the wire omits it
    ...(to.wb ? { wb: to.wb } : {}),   // DISC12: the beast form - discrete, omitted in human form
    ...(to.hk ? { hk: to.hk, hp: to.hp, hb: to.hb ?? 0, hq: to.hq ?? 0 } : {}),   // PEERFX1: the landed blows, whole - a count and its point
    ...(to.hu ? { hu: to.hu, uq: to.uq ?? 20 } : {}),   // PEERFX1: and the times struck; PEERFX2: and what it cost
    ...(to.lc ? { lc: 1 } : {}),   // PEERLIGHT2: the Light spell's candle - discrete, omitted while none burns
    ...(to.lt ? { lt: to.lt } : {}),   // PEERLIGHT1: the torch's light - discrete, omitted while nothing burns
    ...(to.hl ? { hl: 1 } : {}),   // HT-WAIST-NET: the lantern at the waist - discrete, omitted without one as the wire omits it
    ...(to.st ? { st: to.st } : {}),   // CARDS2b: the seat - discrete, omitted standing as the wire omits it
    ...(to.cv ? { cv: to.cv } : {}),   // INVIS-NET: the concealment - discrete, omitted when there is none as the wire omits it
    ...(to.cl ? { cl: to.cl, ...(Number.isFinite(to.cw) ? { cw: to.cw } : {}), ...(to.ck ? { ck: to.ck, ...(Number.isFinite(to.cy) ? { cy: to.cy } : {}), ...(to.cd ? { cd: to.cd } : {}) } : {}) } : {}),   // CLIMB6: the move's kind, lip and time, whole   // CLIMB5: the climb and its facing - whole (the body eases its own yaw), omitted off the wall as the wire omits it
    ...(to.ga ? { ga: to.ga, ...(to.gm ? { gm: to.gm } : {}) } : {}), ...(to.gb ? { gb: to.gb } : {}),   // PEER-ACTS: the gathering act and the net's throw, and the beats on their own - discrete, omitted at none as the wire omits them
  };
}

/** The distance between two poses on the ground. */
const groundDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** AUDIT LEGACY III O1: a wed frame's `sc` - the sender's realm character as the relay stamped it off their token (`ci`) -
 *  or null (an older relay stamps none, and a wedding then waits on one that does). */
const scOf = (m) => (typeof m?.sc === 'string' && REALM_CHARACTER_RE.test(m.sc) ? m.sc : null);

// ═══ NET-SMOOTH (2026-10-04, Mac: "Sometimes other players rubberband, I want to continue to improve performance and
// future proof for larger amounts of players") ════════════════════════════════════════════════════════════════════
//
// FOUR CAUSES OF A PEER DRAWN JUMPING BACK OR DASHING, all of them here, none needing the relay:
//   1. THE SNAP IN THE WRONG UNITS. The scene frame's snap (SNAP_SCENE_UNITS, 30 - metres in a dungeon) was taken for
//      every room not named `world:` - but a siege's battle, a Royal Tourney and an owned interior or boat carry their
//      poses in MapsFile's frame too (scenes/world.js `nativeFrame`), 40 to the metre: a 0.75 m snap, so a runner at
//      10 Hz (0.8 m a pose) teleported on nearly every pose. The snap is the ROOM's frame's now (nativePoseRoom).
//   2. ONE POSE, SEVERAL ROOMS, NO ORDER. A player's pose goes down its cell's socket AND each halo it is due to (sendPose, HALO-THIN), each
//      room a Durable Object of its own; a listener sharing two of them hears it twice, and the two copies need not
//      arrive in order. Only an identical copy was dropped (C6) - an OLDER copy landing second was eased toward, and
//      the peer walked backwards. The frame carries no sequence to order them by, so a peer is heard through ONE room
//      at a time (`src`): another room's copy says the peer is alive and moves nothing, until the source falls silent
//      (SOURCE_STALE_GAPS intervals, SOURCE_STALE_MIN_MS at least) or lets the peer go - or the other room proves itself
//      AHEAD, bringing the source's own poses sooner (SOURCE_LEADS in a row), and takes the peer. One socket's frames
//      arrive in the order they were sent.
//   3. A HELLO'S POSE REPLAYED. A peer opening a halo is announced to that room by a `join` carrying the pose it said
//      hello with, and a halo of mine opening hears a roster of the poses that room last held - each older than what
//      the peer's source room is saying. An introduction's pose moves a peer only from its source room, or when no
//      source is live.
//   4. AN EASE THAT RESTARTED ON EVERY POSE. It ran from where the peer was drawn to the newest pose over the newest
//      interval between ARRIVALS (halved at most per pose, SLAM10) - so a stall's backlog, landing in one burst, cut
//      the corners at up to 4x and parked the peer between; and it restarted from where the peer was drawn the frame
//      BEFORE, so every pose cost the peer one frozen frame. A peer is PLAYED OUT now: its poses are waypoints on a
//      path (`path`), spaced in the peer's own time (`c`, ms of its walk), and a cursor (`cur`) walks the path at a
//      rate (`rate`) set at each arrival from how much path is still ahead of it (rateFor) - kept one interval and a
//      jitter cushion ahead, never faster than PLAY_RATE_MAX (twice the peer's pace) to catch up, never slower than PLAY_RATE_MIN
//      to let the cushion fill. The cushion is the farthest of the recent intervals from the cadence (cushionOf). A
//      backlog is walked at twice the pace, never dashed across; a line that jitters walks on its cushion instead of
//      stopping at every late pose.
//      The interval is the MEDIAN of the last CADENCE_SAMPLES intervals between moves (cadenceOf): an interval under
//      GAP_MIN_MS (faster than any client may speak - two poses delivered together) or past PAUSE_MS (a pause) is not
//      counted. A pose's own segment of the path is that interval (segmentFor), unless its own spacing says the rate
//      has changed before the median can: under 1/FAST_SHARE of it, a faster rate (the far tier promoting me); past
//      twice it after a moving pose, a slower rate or a stall - walked over half the silence, at most twice the pace.

/** NET-SMOOTH 1: the rooms whose poses are MapsFile's frame - net/wire.js's since SLIM-FRAME (the relay rounds a slim
 *  pose by it), re-exported here for every caller and pin that knows it as the session's. */
export { nativePoseRoom };
/** NET-SMOOTH 1: the snap distance for a pose heard in this room, in that room's own units. */
export const snapUnitsFor = (key) => (nativePoseRoom(key) ? SNAP_WORLD_UNITS : SNAP_SCENE_UNITS);
/** NET-SMOOTH 4: how many of a peer's last intervals its cadence is the median of - five, so two late or early poses
 *  never move it and a real change of rate (a crowd, the relay's far tier) is taken in three. */
export const CADENCE_SAMPLES = 5;
/** NET-SMOOTH 4: a silence longer than this is a pause (the peer stood still, or its line stalled), not a rate. Twice
 *  GAP_MAX_MS, because GAP_MAX_MS is itself a real rate - the relay's far tier at a crowd's pace is one pose a second
 *  exactly, and its jitter carries some intervals past it; between the two an interval counts as GAP_MAX_MS.
 *  AUDIT 637 C2: an ARRIVAL interval (NET-SMOOTH's, `_arrive`) does - the line's jitter is in it. A TIMED interval
 *  (SCALE2b's, `_arriveTimed`) is the sender's own spacing with no jitter in it, and counts as itself: the sender's gate
 *  (`sendPose`) rounds every interval up to its own frames, so the far tier's one in POSE_FAR_SHARE is 1,000 ms only
 *  from a sender whose frames divide its interval - 1,067 from one at 15 fps, 1,200 at 10, 1,333 at 12. Counted as
 *  GAP_MAX_MS, the play-out walked a second of it and stood the rest, and steered its cursor a second behind poses
 *  that came a third of a second later: such a peer stood 350-570 ms at every pose, which RUN-IN-PLACE drew as a
 *  stride started over 43-48 times a minute and the code before it as running on the spot. */
export const PAUSE_MS = 2 * GAP_MAX_MS;
/** NET-SMOOTH 4: the bounds on the play-out rate - at most twice the peer's pace to catch up (SLAM10's own bound on a
 *  catch-up), at least three quarters of it while the cushion fills. */
export const PLAY_RATE_MAX = 2;
export const PLAY_RATE_MIN = 0.75;
/** NET-SMOOTH 4: a pose spaced under 1/FAST_SHARE of the cadence after the last is a faster rate starting. Three, so a
 *  jittering line's early pose is not mistaken for one. */
export const FAST_SHARE = 3;
/** NET-SMOOTH 4: the most waypoints a peer's path holds - a longer backlog lets its oldest go past the segment being
 *  walked (the path straightens; the peer's time along it is kept, so nothing dashes). */
export const PATH_MAX = 8;
/** NET-SMOOTH 2: a peer's source room is given up after this many of its intervals of silence, and never sooner than
 *  SOURCE_STALE_MIN_MS. */
export const SOURCE_STALE_GAPS = 3;
export const SOURCE_STALE_MIN_MS = 500;
/** NET-SMOOTH 2: another room that brought the source's pose at least SOURCE_LEAD_MIN_MS sooner, SOURCE_LEADS times in a
 *  row, becomes the source; the last LEAD_KEEP poses another room brought are remembered to tell. */
export const SOURCE_LEAD_MIN_MS = 25;
export const SOURCE_LEADS = 3;
export const LEAD_KEEP = 4;
/** SCALE2b: a TIMED pose (one carrying its send time, wire.js `ts`) older than the newest applied is a late copy and
 *  moves nothing - unless nothing newer has been applied for this long, when the sender's clock is taken to have
 *  started over (a clock set back) and its stream is followed from there. */
export const TS_RESYNC_MS = 2000;
/** SCALE2b: how many of a timed peer's arrivals its play-out delay is read off - each one's lateness against its own
 *  send time (`offs`); the earliest is the line's fastest, the spread is its jitter. */
export const OFFSET_SAMPLES = 8;

/** NET-SMOOTH 4: the median of a peer's sampled intervals, or the ordinary interval before any. Pure. */
export function cadenceOf(samples) {
  if (!Array.isArray(samples) || !samples.length) return 1000 / POSE_HZ;
  const s = [...samples].sort((a, b) => a - b), mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
/** NET-SMOOTH 4: the jitter cushion - the farthest of the samples from the cadence, never more than the cadence itself.
 *  The farthest, not a mean: the cushion is there for the late pose, and a cushion of the typical lateness is
 *  overrun by every pose later than typical (on a line jittering 0-60 ms, twice the mean distance stood its peer still
 *  on 12 frames in four seconds, and this on none). Pure. */
export function cushionOf(samples, cadence) {
  if (!Array.isArray(samples) || !samples.length) return 0;
  return Math.min(cadence, Math.max(...samples.map((x) => Math.abs(x - cadence))));
}
/** NET-SMOOTH 4: the length of a new pose's segment, in the peer's own time: the cadence, or what the pose's own spacing
 *  (`since`, null for the first) says before the median can - a faster rate, or after a MOVING pose a slower rate or a
 *  stall, walked over half the silence (GAP_MAX_MS at most). Pure. */
export function segmentFor(since, cadence, wasMoving) {
  if (since == null || !(since >= GAP_MIN_MS)) return cadence;
  if (since < cadence / FAST_SHARE) return since;
  return wasMoving ? Math.max(cadence, Math.min(GAP_MAX_MS, since) / 2) : cadence;
}
/** NET-SMOOTH 4: the play-out rate once a pose lands - the path still ahead (`ahead`, ms of the peer's time) less the
 *  cushion, walked over the next interval (the cadence, or the new segment when that is longer), within PLAY_RATE_MIN and
 *  PLAY_RATE_MAX. A steady stream plays at exactly 1. A slower rate's segment (longer than the cadence: half its silence,
 *  already up to twice the pace) is never played faster than 1. Pure. */
export const rateFor = (ahead, cushion, cadence, segment) => Math.max(PLAY_RATE_MIN, Math.min(segment > cadence ? 1 : PLAY_RATE_MAX, (ahead - cushion) / Math.max(cadence, segment)));
/** NET-SMOOTH 4: the pose drawn at `c` along a path of waypoints `{ pose, c }` (c ascending): the first before it
 *  starts, the last once it is walked, eased between the two it falls between. Pure. */
export function poseAlong(path, c) {
  if (!Array.isArray(path) || !path.length) return null;
  if (c <= path[0].c) return lerpPose(path[0].pose, path[0].pose, 0);
  const last = path[path.length - 1];
  if (c >= last.c) return lerpPose(last.pose, last.pose, 1);
  let i = 0;
  while (i < path.length - 2 && path[i + 1].c <= c) i++;
  const a = path[i], b = path[i + 1];
  return lerpPose(a.pose, b.pose, (c - a.c) / (b.c - a.c));
}

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
 * stamp inside is the handed-in clock's (the page's steadyNow unless
 * told otherwise - AUDIT ONLINE 3 F2); nothing outside passes a time in.
 */
/** ONE-SEAT (Mac: "the player can only have one character only at a time"): the line a superseded session says - another
 *  tab or window of this player went online (or this tab's own id was taken), so this one is out of every room. */
export const SEAT_TEXT = 'online in another tab, window or device, so this one is offline';
/** L10N4: SEAT_TEXT as the player reads it, read when it is said. */
export const seatText = () => t('net.online.seat', SEAT_TEXT);
/** AUDIT ONESEAT C1: how long a claim speaks for the player's act. A claim is the moment a tab went online (or Play online
 *  here was pressed); a first hello that never reached the hub - no network, a lid shut, a mint that timed out - kept
 *  saying it on every retry, however late, and took the seat from the tab the player opened AFTER it. Past this, the
 *  hub link's hello is a reconnect: refused while another tab holds the seat, and the way back is the button. */
export const CLAIM_TTL_MS = 20_000;
/** OL3: the HUD line while the relay's clock and this machine's disagree by more than a year - the world's time is read uncorrected. */
export const CLOCK_WARNING = 'this computer\'s clock is off by more than a year. Set it correctly, or the game time will be wrong';
/** L10N4: CLOCK_WARNING as the player reads it (the console keeps the English). */
export const clockWarningText = () => t('net.online.clock', CLOCK_WARNING);
/** ONCRASH1: how long a contained handler throw is said on the HUD line. Long enough for a player to read and report it,
 *  short enough that one transient frame does not brand the session; `stats.threw` and the console keep the rest. */
export const THREW_SAY_MS = 30000;
/** AUDIT ONCRASH1 A5: distinct throws remembered before the said-once set is emptied - a bound, so a crafted stream of
 *  unique messages cannot grow it without end. */
export const THREW_KINDS_MAX = 32;
/** AUDIT ONCRASH1 A6: a MONOTONIC reading for the HUD's window - never the wall clock, which steps. */
const monoNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
/** AUDIT ONLINE 3 F2: A WALL CLOCK THAT NEVER STEPS BACK. A session's clock was Date.now(), and a machine's clock set back
 *  (OL3's CLOCK_WARNING asks the player to; an OS time sync does it unasked) held every interval measured on it
 *  negative for as long as the step: no pose, no heartbeat, no ping and no retry - the socket 'open' and the player
 *  gone from everyone's screen, or a dropped one 'reconnecting' for the hour - and every pose stamped 1 ms after the
 *  last. This one is the wall's (epoch milliseconds, as every reader of a session's stamps expects, and a sleep counted
 *  as the time it was) plus what it has been set back by: a step back holds it where it was, and it walks on from
 *  there; a step forward is time passing. */
export function steadyClock(wall = () => Date.now()) {
  let last = -Infinity, back = 0;
  return () => {
    const t = wall() + back;
    if (t < last) { back += last - t; return last; }
    return (last = t);
  };
}
/** The page's one: every session on it reads the same clock, so the times they hand the page's wave agree. */
export const steadyNow = steadyClock();

export class OnlineSession {
  constructor({ url = DEFAULT_SERVER, name = 'Traveller', look = null, id = null, secret = null, presence = true, acct = null, asecret = null, mintToken = null, ownerTm = () => ownerClock.tm(), WebSocketImpl = globalThis.WebSocket, now = steadyNow, rand = Math.random, wave = reconnectWave(), wire2 = false } = {}) {
    this.url = relayUrl(url || DEFAULT_SERVER);   // wss:// anywhere, ws:// on localhost alone; anything else is no relay (A16/E11)
    this.secret = secret ?? peerSecret();
    // SOC2: the ACCOUNT rides the hello only when the caller hands both halves in - the hub link's alone (world.js
    // chatStart); a presence session names none, and a session made without them is a build before this slice to
    // the hub. NOT defaulted from storage the way the peer's pair is: a presence room must never be told an account.
    this.acct = acct && asecret ? acct : null;
    this.asecret = acct && asecret ? asecret : null;
    this.onSocial = null;         // SOC2: (frame) => void - a hub frame in, through the wire's door (validSocialFrame): state, presence, party, invite, note, error
    this.onParty = null;          // SOC2: (acct, p) => void - a party member's pose in (never my own account's back)
    this.onQuestShared = null;    // QUEST1: (acct, name, quest) => void - a party member's shared quest in
    this.onAmap = null;           // PARTY-MAP: (acct, name, k, r) => void - a party member's revealed automap rows in
    this.amapOk = false;          // PARTY-MAP: the relay knows the `amap` frame (relaySupportsPartyMap) - an older one closes on it
    this._lastAmapAt = -Infinity; // PARTY-MAP: the client's own floor between two sends (AMAP_SEND_MS)
    this.onStaffTeleport = null;
    this.followOk = false;        // STAFF-PANEL5-FOLLOW: the hub keeps where notes outside a party, and follows (the welcome says)
    this.solo = false;            // STAFF-PANEL5-FOLLOW: in no party (the host says) - sendParty sends my where note, at its own pace
    this.onFollow = null;         // STAFF-PANEL5-FOLLOW: (frame) => void - the hub's `fol` to a spectator's hub link (net/staffFollow.js validFollowOut)
    this.staffTeleportOk = false;
    this._rfOn = new WeakMap();    // SCALE5b: socket -> its cell judges the poses that reach it (`rf`) - a halo's are never thinned then
    this.onFound = null;          // SCALE5c: ({q, l, busy}) => void - the hub's answer to a search of everyone online by name
    this.guildOnline = new Map(); // SCALE5c: id -> my guild's members online on every shard, as the hub last said (`sendGuildWho`)
    this._guildWhoAt = -Infinity; // SCALE5c: when the hub was last asked
    this.hubOnline = new Map();   // SCALE5c: id -> everyone online on every shard, as the bus last said (`sendHubWho`) - the World tab's list while the hub is small
    this._hubWhoAt = -Infinity;
    this.hubFound = null;         // CHAT-FIND-HUB: { q, l, at } - the hub's last answer to a search, the chat's search box reads it (`askFind`)
    this._boxAsks = new Map();    // CHAT-FIND-HUB: q -> when the search box asked it, until its answer (that answer is the box's, not a line)
    this._boxAskAt = -Infinity;
    this._shardMiss = 0;         // SCALE5c: a shard's socket that never opened, in a row (a relay before the shards refuses its key)
    this._opened = new WeakSet(); // AUDIT SCALE II C-2: every socket that fired `open` - a shard's that never did is the miss above
    this._statusAtError = new WeakMap();   // AUDIT SCALE II C-2: my room's socket -> its status when the browser's `error` overwrote it (the `close` after reads it)
    this._hubBus = false;         // SCALE5c: the hub link fell back to the bus - it offers the shards no more this session
    this.layer = 0;               // SCALE5d: the layer of the place my room is (its welcome's `ly`; 0 the place itself)
    this.layerHint = 0;           // SCALE5d: the layer my next room is asked for first (my party's - the host sets it); the Worker walks on past a full one
    this._layerRoom = null;       // SCALE5d: the room `layer` was said in - a reconnect to it asks for its own layer again
    this.onRelayCfg = null;       // SCALE5b: ({k, v}|{k, error}) => void - the hub's answer to a relay setting
    this.relayCfgOk = false;      // SCALE5b: the hub's relay takes a setting (its welcome says, relayCfgSupported)
    /** @type {string|null} */
    this.grantMode = 'off';       // GRANT2 (Spawn-Grants.md section 12): the spawn grants' law in my cell, as its welcome said (`gm`, relaySupportsGrant) - 'off' asks nothing; GRANT6: null while a socket's welcome is owed
    this.findOk = false;          // AUDIT SCALE II C-1: the hub's relay answers `find` - a search, the World tab's list, the Guild tab's (its welcome says, hubShardsSupported)
    this.onTraveller = null;      // TV3: (frame) => void - a traveller's mark in my region (p null: they went in, or hid)
    this.onTravellerRoom = null;  // TV3: (frames) => void - the region room's marks, whole, on its welcome
    this.onTravellerLeft = null;  // TV3: (id) => void - a traveller left my region's room
    this.travOk = false;          // TV3: the relay knows the `trav` frame (relaySupportsTravellers) - an older one closes on it
    this._lastTravAt = -Infinity; // TV3: the client's own floor between two marks (TRAV_SEND_MIN_MS)
    this.onQuestBusy = null;      // AUDIT DISC28 QS-1: (quest) => void - the hub refused my last quest share as 'busy' (try again)
    this._questSent = null;       // AUDIT DISC28 QS-1: { quest, at } - my last quest share that left, until the hub's word on it can no longer come
    this._sbucket = null;         // SOC2: the social acts' own gate at home (SOCIAL_HZ_MAX - an act the hub would drop is never sent)
    this._pbucket = null;         // SOC2: the party poses' own gate at home (PARTY_HZ_MAX)
    this._lastParty = null;       // SOC2: the last party pose that LEFT, and when - an unchanged one is not re-sent, and a socket that reopens re-sends the first (the hub's attachment is fresh)
    this._lastPartyAt = -Infinity;
    this._lastQuestShareAt = -Infinity;   // QUEST1: the client's own floor beside the hub's cooldown (QUEST_SEND_MS)
    this.name = name;
    this.title = null;         // NAME-ADOPT: my own badge, as the service issued it - never asserted by this side
    this.ts = null;            // SEAT1c: my own seat title's claim, beside the title it fits
    this.glyphs = [];
    this.au = null;            // WB9g: my own aura worn, as the service issued it
    this.rb = null;            // SEASON1 part two: my own Season's banner ribbon, as the service issued it
    this.lv = null;            // RENOWN1: my own Renown, as the service signed it (the token's `lv`, or a renown order since)
    this._rnOrder = null;      // AUDIT RENOWN1 WIRE-2: the newest renown order this page holds - { order, lv, until }
    this.gt = null;            // GUILD1c: my own guild's tag, as the service signed it (the mint's word) or a room since said (its echo of my guild order)
    this.guildOk = false;      // GUILD1c: the relay that welcomed my primary socket knows the guild frames and routes a guild's line (relaySupportsGuild)
    this.onGuildGone = null;   // GUILD1c: () => void - a room took my guild off (a removal, a disbanding, my own leave's echo): the host looks again
    this._gdSock = new WeakMap();   // GUILD1c: per SOCKET - its own welcome's word on the guild frames, and its own gate (GUILD_ORDER_HZ_MAX)
    this._gdHeld = [];         // GUILD1c: the guild orders this page carries - [{ frame, until, sent: WeakSet }], a removal first
    // FIELD BUGS 2026-10-14 QUEST-HOME (Mac, 2026-10-15: "Close both"): a home that moved, said to every page online - the
    // home orders this page carries to the hub ([{ frame, until, n, at }]), whether the hub that welcomed my socket knows
    // the frame (relaySupportsHome), when the last went down it, the inbound gate, and the host's ear for the hub's words
    this._hmHeld = [];
    this.homeOk = false;
    this._hmAt = -Infinity;
    this._hmIn = null;
    this.onHome = null;        // (words: [{m, u, d, i}]) => void - the hub's word that town m's buildings u are homes now and d are none
    this._rnSock = new WeakMap();   // AUDIT RENOWN1 WIRE-2/WIRE-3: per SOCKET - its own welcome's word on the frame, the level its room confirmed, its gate
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
    /** SCALE2: sockets whose hello went without a token, and why (`_mint`'s word) - read by their close. */
    this._tokenless = new WeakMap();
    /** DOOR-TOKEN: my room's retry waits on a token - its hello went without one - so it goes the moment the minter holds
     *  one this room can be handed (`tick`), never the backoff and the mint's hold after. A halo's is its entry's. */
    this._tokenRetry = false;
    /** SCALE5a: the token each socket's hello carried - handed back to the minter when the relay refused that hello before
     *  reading it (`_tokenUnread`). */
    this._helloTok = new WeakMap();
    this.presence = !!presence;   // false: a channel's session (CHAT1) - no pose out, a ping for a heartbeat
    this.onChat = null;           // (line) => void: a chat line in - {id, name, text, at, mine}
    this.onRed = null;            // RED1: (line) => void: the SERVER's own line - {text, at}, no id and no name, because nobody is speaking it
    this.onStaffMessage = null;   // STAFF-PANEL5-MESSAGE: (mi) => void: a staff message waits for this account - its id; the words are the account service's
    this.onDm = null;             // TITLE-N: (line) => void: the Dungeon Master's line - {text, at}, as the server's: a voice over the game, not a player in it
    this.dmOk = false;            // TITLE-N: the relay that welcomed this socket carries /dm (relaySupportsDm) - an older one CLOSES the socket on the frame
    this.onEvent = null;          // EVENT1: (ev, {live}) => void - the server-wide live event now ({kind, at}) or null; live: it changed while I watched (a welcome's word is not)
    this.eventOk = false;         // EVENT1: the relay that welcomed this socket knows the `stage` frame (relaySupportsEvent) - an older one CLOSES the socket on it
    this.eventV = null;           // SUNBABY1: the version that welcomed it - which event WORDS it knows (relayKnowsLiveEvent): a word it does not know CLOSES the socket too
    this.liveEvent = null;        // EVENT1: the hub's live event as last said - {kind, at} or null
    this.onLaw = null;            // SAFE4: ({order}) => void - a mute or ban order the hub handed me to carry to every room I hold
    this.onBanned = null;         // SAFE4: ({until}) => void - the relay says my account is banned until then (epoch seconds), or 0: lifted
    this.onLease = null;          // LEASE1: (l) => void - my hub's lease, to hand to every lease room I hold (net/roomLease.js)
    this.leaseOk = false;         // LEASE1: the relay that welcomed this socket knows the lease frame - an older one CLOSES a socket on it
    this._lease = null;           // LEASE1: my hub's newest lease, handed on by each lease room's socket ahead of its next frame (`_leased`)
    this._leaseAt = -Infinity;    // LEASE1: when it came, on my own clock (LEASE_HELD_MS)
    this.onSlowed = null;         // SAFE6: ({ms}) => void - my public line was too soon for a new voice; the next may go in `ms`
    this.onWelcomed = null;       // AUDIT SAFE CLIENT-8: () => void - my room's socket was welcomed (a reconnect's too): what the page reads of the account at a start is read again
    this.banOk = false;           // AUDIT SAFE RELAY-3: the relay that welcomed this socket knows the `ban` frame (relaySupportsBan) - an older one CLOSES the socket on it
    this.courtWatchOk = false;    // AUDIT PLAN-1000 G3: the relay that welcomed this socket says `me` when it seats a fighter (relaySupportsCourtWatch) - before it a full court refuses
    /** AUDIT SAFE CLIENT-2 (2026-10-17): MY ACCOUNT IS BANNED - STICKY, as `superseded` is: no join, rejoin or retry until
     *  `unbar()` (the relay's word that the ban was lifted) or a reload. The page latches every room it holds
     *  (scenes/chatSafetyHost.js) when the relay says `banned`; a socket the relay closes 1008 'banned' latches its own. */
    this.barred = false;
    /** AUDIT SAFE CLIENT-7 (2026-10-17): whether the player hears an account - (sub) => boolean, the host's from the block
     *  list (scenes/chatSafetyHost.js); null hears everyone. A trade, a duel, a wedding, a card or a page asked of me by an
     *  account I blocked never lands, as its chat line never does (net/chat.js ChatLog.hears). */
    this.hears = null;
    /** AUDIT SAFE CLIENT-13 (2026-10-17): whether a chat line may go - (line) => boolean, the host's code of conduct's gate
     *  (scenes/chatSafetyHost.js); null lets every line go. The panel asks before a typed line ever reaches here; this is
     *  the gate for every other door a line has (CHAT-POST's item, posted from the pack, went straight to sendChat). */
    this.mayChat = null;
    this.onMuted = null;          // MOD1: ({until}) => void - the relay says I am muted until then (epoch seconds), or 0: lifted
    this.onFrozen = null;         // STAFF-PANEL5-FREEZE: ({until}) => void - the relay says staff froze my account until then (epoch seconds), or 0: lifted
    this.onStaffNudge = null;     // STAFF-PANEL5-FREEZE: ({sl}) => void - my staff thread has a line `sl` to read from the account service
    this.staffOk = false;         // STAFF-PANEL5-FREEZE: this hub said the staff channel's word (a `frozen`, a nudge) - it routes a staff nudge
    this.onFoes = null;           // WORLD2: (id, data) => void - the host's live foes in (a non-host's, from the room's host alone)
    this.onOwnFoes = null;        // OWN1: (id, data) => void - a peer's OWN foes in my world room (a building's, a dungeon's shared quest's)
    this.tradeOk = false;         // TRADE1: the relay that welcomed this socket routes trade frames (relaySupportsTrade) - an older one CLOSES the socket on the frame, so nothing is sent to it
    this.chanOk = false;          // CHAT-CHAN: the relay that welcomed this socket routes a party's line and opens the region channels (relaySupportsChannels)
    this.langOk = false;          // CHAT-LANG: and opens the language channels (relaySupportsLang)
    this.tradeChanOk = false;     // CHAT-TRADE: and the Trade and LFG channels (relaySupportsTradeChan)
    this.rollOk = false;          // DICE1: ...and rolls dice (relaySupportsRoll) - an older one CLOSES the socket on a roll frame
    this.emoteOk = false;         // EMOTE1: ...and carries an action line (relaySupportsEmote) - an older one would say it as plain words
    this.onHoldem = null;         // CARDS5: (frame) => void - the relay's card table: the room's events and the table, my hole cards, my turn
    this.onRoll = null;           // DICE1: ({id, name, at, mine, sub, ch, roll}) => void - a roll the RELAY made, checked by the dice's law
    this._rollBucket = null;      // DICE1: my own rolls out, rollGate's law
    this.holdemOk = false;        // CARDS5: ...and deals cards (relaySupportsHoldem) - an older one CLOSES the socket on a holdem frame
    this.holdemWelcomes = 0;      // AUDIT CARDS-3 B1: my primary socket's welcomes - the seat a dropped socket held is sat again on the next
    this._holdemBucket = null;    // CARDS5: my words to the card table, holdemGate's law
    this.onIliac = null;          // CARDS10: (frame) => void - the relay's Iliac table: the room's events and the table, my own view, a ranked game's receipt
    this.iliacOk = false;         // CARDS10: ...and deals Iliac Hand (relaySupportsIliac) - an older one CLOSES the socket on an iliac frame
    this._iliacBucket = null;     // CARDS10: my words to the Iliac table, holdemGate's law in a bucket of their own
    this.onGambit = null;         // KG5: (frame) => void - the relay's King's Gambit table: the room's events and the table
    this.gambitOk = false;        // KG5: ...and runs The King's Gambit (relaySupportsGambit) - an older one CLOSES the socket on a gambit frame
    this._gambitBucket = null;    // KG5: my words to the King's Gambit table, holdemGate's law in a bucket of their own
    this.castOk = false;          // AUDIT ALLY-CAST B1: the relay that welcomed this socket routes cast frames (relaySupportsCast) - an older one CLOSES the socket on one
    this.onTrade = null;          // TRADE1: (id, data) => void - a trade frame from a peer, projected by the wire's validTradeData, addressed to ME
    this.onPeerDeath = null;      // PCORPSE1: (peer {id, look, name}, pose, room, how) => void - another player's LAST pose: they fell there; `how` { intro: true } when an introduction said it (AUDIT ONLINE 3 F5)
    this.onCast = null;           // ALLY-CAST: (id, data) => void - a party mate's spell at ME, projected by the wire's validCastData; the host decides what lands
    this.instanceOk = false;      // INSTANCES: the relay that welcomed my primary socket admits an instance (net/instanceRoom.js relaySupportsInstances) - an older one keeps no memory for the key and gates nobody out
    this.caravanOk = false;       // WAGONS2-VISIT: the relay that welcomed my primary socket keeps a caravan's room (relaySupportsCaravan) - an older one closes on `caravan`
    this.onCaravan = null;        // WAGONS2-VISIT: (room, doc|null) => void - what the caravan whose room I stand in holds, from its owner
    this.parkOk = false;          // HCC-PARK: the relay that welcomed my primary socket knows the `park` frame (relaySupportsPark) - an older one closes on it
    this.onPark = null;           // HCC-PARK: (room, { k, id, name, r|null, ttl }) => void - a cell's word about one owner's parked team (my cell's or a halo's)
    this.onParks = null;          // HCC-PARK: (room, [{ k, id, name, r, ttl }]) => void - a cell's whole memory, after its welcome (an empty one included)
    this.onParkYeet = null;       // WARDEN1: (room, { at, from, to }) => void - the town watch threw my parked team (net/wire.js validParkYeet)
    this.welcomes = 0;            // AUDIT HCC-PARK (client C4): every welcome on any socket - a word sent down a socket that died before the relay read it is said again when a socket is welcomed
    this._pkbucket = null;        // HCC-PARK: my park words out, PARK_HZ_MAX a second
    this.restOptOk = false;   // REST-OPT (AUDIT C1): the hub carries a pose's `nr` (relaySupportsRestOpt) - an older one strips it, so the switch waits for it
    this.partyWalkOk = false;   // TV8: the hub carries the party's Overworld walk (`tw`, `ts` - relaySupportsPartyWalk)
    this.partyLeadOk = false;   // PARTY-LEAD: the hub knows `party.lead` (relaySupportsPartyLead) - an older one closes the socket on it
    this.partyTravelOk = false;   // PARTY-TRAVEL: the hub that welcomed this socket carries the party journey's pose fields (relaySupportsPartyTravel) - an older one strips them, so no round is opened through it
    this.lookOk = false;          // PROFILE2: the relay that welcomed my primary socket knows the `look` frame (a halo's own welcome says for the halo)
    this._lookDirty = false;      // PROFILE2: my look changed since the sockets now open said hello - to be said again
    this._lkbucket = null;        // PROFILE2: my looks out, LOOK_HZ_MAX a second (the relay's per-socket gate, never tripped)
    this._rehelloWant = false;    // AURA-LIVE: my badge changed since the sockets now open said hello - to be said again (rehello)
    this._rehelloAt = -Infinity;  // AURA-LIVE: when the last one went (REHELLO_GAP_MS)
    this._swap = new Map();       // AURA-LIVE: room -> { ws, old, since } - a socket opening to take an open one's place, its hello on a fresh token
    this._retired = new Map();    // AURA-LIVE: new socket -> the one it replaced, closed by my own hand once the new is welcomed (or gone)
    this._tbucket = null;         // TRADE1: the trade frames' own gate at home (TRADE_HZ_MAX)
    this._inCastBuckets = new Map();   // ALLY-CAST: the gate on cast frames coming in, per sender - the trade gate's shape
    this._castBucket = null;   // ALLY-CAST: my own casts out, castGate's law. CHAT-CHAN: its OWN field - this was `_cbucket`, the chat gate's own
    this.cardOk = false;          // INSPECT1: the relay that welcomed this socket routes card frames (relaySupportsCard) - an older one CLOSES the socket on one, so no card is asked of it
    this.onCard = null;           // INSPECT1: (id, data) => void - a card frame at ME (an ask for my card, or the answer to mine), projected by the wire's validCardData
    this._cardBucket = null;      // INSPECT1: my own card frames out, asks and answers together - cardGate's law
    this._inCardBuckets = new Map();   // INSPECT1: the gate on card frames coming in, per sender - the cast gate's shape
    this.pageOk = false;          // JOURNAL1: the relay that welcomed this socket routes page frames (relaySupportsPage) - an older one CLOSES the socket on one, so no page is shown through it
    this.onPage = null;           // JOURNAL1: (id, data) => void - a page of another player's journal held out to ME, projected by the wire's validPageData
    this._pageBucket = null;      // JOURNAL1: my own pages out - pageGate's law
    this._inPageBuckets = new Map();   // JOURNAL1: the gate on pages coming in, per sender - the card gate's shape
    this.bossOk = false;          // INT11: the relay that welcomed this socket counts a boss fight's bodies (relaySupportsBossRef) - a body's word (`vt`) goes to none older
    this.duelOk = false;          // DUEL1: the relay that welcomed this socket routes duel frames (relaySupportsDuel) - an older one CLOSES the socket on one, so no challenge is sent through it
    this.onDuel = null;           // DUEL1: (id, data, sub) => void - a duel frame at ME, projected by the wire's validDuelData; `sub` the sender's account as the RELAY verified it (null from a relay that stamps none)
    this.onDuelRef = null;        // INT8: (g, room) => void - the duel referee's word on my bout, projected by the wire's validDuelRefOut, and the room that referees it
    this._duelBucket = null;      // DUEL1: my own duel frames out - duelGate's law
    this._inDuelBuckets = new Map();   // DUEL1: the gate on duel frames coming in, per sender - the directed frames' shape (`_directedIn`)
    this.wedOk = false;           // LEGACY7 part three: the relay that welcomed this socket routes wed frames (relaySupportsWed) - an older one CLOSES the socket on one, so no proposal is sent through it
    this.onWed = null;            // LEGACY7 part three: (id, data, sub, sc) => void - a wed frame at ME, projected by the wire's validWedData; `sub` the sender's account as the RELAY verified it; AUDIT LEGACY III O1: `sc` their realm character, the token's `ci` (scOf)
    this._wedBucket = null;       // LEGACY7 part three: my own wed frames out - wedGate's law
    this._inWedBuckets = new Map();   // LEGACY7 part three: the gate on wed frames coming in, per sender (`_directedIn`)
    this.wdunGiantsOk = false;    // ZONE-GIANTS: the hub keeps the giants' deaths (relaySupportsWdunGiants)
    this.wdunOk = false;          // PVPDUNGEONS: the hub keeps the zone's halls (relaySupportsWdun) - an older one closes the socket on `wdun`
    this.wdunSeaOk = false;       // SEA-VAULTS: the hub reads a vault of the deep's key (relaySupportsWdunSea) - an older one closes the socket on it
    this.onWdun = null;           // PVPDUNGEONS: (word) => void - the hub's word on the zone's halls (wire.js validWdunOut)
    this.wildCollectOk = false;   // MAC (2026-10-14, the two-phase handoff): the relay that welcomed this socket signs a killer's collect of a piece in escrow (relaySupportsWildCollect)
    this.wildOk = false;          // WILD1: the relay that welcomed this socket routes wild frames and, INT9, referees the zone (relaySupportsWildRef) - an older one CLOSES the socket on one, so nothing of the open zone is sent through it
    this.seaPvpOk = false;        // SHIP-PVP: the relay that welcomed this socket referees the open sea's guns (relaySupportsSeaPvp) - an older one closes the socket on their kinds
    this.onWild = null;           // WILD1: (id, data, sub) => void - a directed wild frame at ME (a blow, a fallen's gear, a pick, a gift), projected by the wire's validWildData; `sub` the sender's account as the RELAY verified it
    this.onWildRoom = null;       // WILD1: (word, room) => void - my own room's word on its remains (validWildOut)
    this._wildBucket = null;      // WILD1: my own wild frames out - wildGate's law
    this._wildZone = 0;           // INT9: my word on the open zone (1: I stand in it) - AUDIT INT9: said on my own cell's socket alone (a halo's is 0)
    this._wildZoneAt = -Infinity; // INT9 (AUDIT): when it was last said there - said again every WILD_ZONE_KEEP_MS while it stands
    this.onWildRef = null;        // INT9: (g, room) => void - the zone referee's word (net/wild/wildRef.js), projected by the wire's validWildRefOut, and the room it came from
    this._inWildBuckets = new Map();   // WILD1: the gate on directed wild frames coming in, per sender (`_directedIn`)
    this._fallenIn = new Map();   // WILD1: id -> { room, at } - where a fallen player's death pose came from: a body in the zone is still answered through that room's socket (its owner stays hello'd until it rises - scenes/world.js, the ghost)
    this.ownOk = false;           // OWN1: the relay that welcomed this socket carries a world room's own lane and routes an `own` hit to its owner (relaySupportsOwn) - an older one strikes the frame out, so nothing is sent down it
    this.gateSpentOk = false;     // AUDIT WBX S1: the relay that welcomed this socket hears a `spent` on its hub (relaySupportsGateSpent)
    this.gateSiteOk = false;      // DISCORD-GATES: and a `site` (relaySupportsGateSite)
    this.gateHealOk = false;      // GATE-HEAL: and a gate room's `heal` (relaySupportsGateHeal) - an older relay junks the word
    this._gateSiteSaid = null;    // DISCORD-GATES: the socket and day my `site` last went on - once a socket and day
    this.arenaOk = false;         // ARENA4: the relay that welcomed this socket opens the arena's rooms (relaySupportsArena)
    this.arenaHeard = false;      // FIELD BUGS 2026-10-16b ARENA-WAIT: a primary welcome has said `arenaOk` (sticky) - before it the arena on the online lane waits (scenes/arena/arenaOnline.js waiting)
    this.onArena = null;          // ARENA4: (word, room) => void - the hall's or a bout's word, projected by the wire's readArenaOut
    this._arenaBucket = null;     // ARENA4: my own arena words out - arenaGate's law
    this.gateOk = false;          // WB3: the relay that welcomed this socket runs a gate's boss room (relaySupportsGate) - an older one CLOSES the socket on the frame and holds no fight
    this.portentsOk = false;      // AUDIT WB14 (WIRE-1): and draws a night's portents with its fight (relaySupportsPortents) - before it a portent night's door refuses
    this.onGate = null;           // WB3: (frame, room) => void - a gate room's word (the boss's state, walk, attacks, health, phase, the wrath, the kill, my receipt, a refusal) or the hub's (a kill, my receipt), projected by the wire's validGateOut
    this._gateBucket = null;      // WB3: my own gate frames out - gateGate's law
    // SEAT2a part four: A SIEGE'S ROOM - `mintSiegePass(room)` a fresh pass for each hello into one (the service's 60-second
    // order - a reconnect asks again), `onSiege(frame, room)` its word (net/wire.js validSiegeOut), `siegeOk` the relay
    // that welcomed this socket fights a battle (relayFightsBattles)
    this.mintSiegePass = null;
    this._siegePass = null;
    this.onSiege = null;
    this.siegeOk = false;
    this.royalOk = false;   // CROWN1 part two: the relay that welcomed this socket keeps a Royal Tourney's room (relayRunsRoyal)
    this._siegeBucket = null;
    this.raidOk = false;          // RAID3: the relay that welcomed my primary socket keeps a raid's ledger (relaySupportsRaid) - an older one CLOSES the socket on the frame, and RAID2's law runs the raid
    this.onRite = null;           // WB12d: (word, room) => void - the hub's word of a broken rite, projected by the wire's validRiteOut
    this.onSd = null;             // SD3: (word, room) => void - the hub's word of the Super dungeon (its record), projected by the wire's validSdOut
    this.onSdHall = null;         // SD6b: (word, room) => void - the realm's word of its Orrery (the stones, the fray, the dial, the Concord), from my own realm alone
    this.onEg = null;             // EG-PLAY: (word, room) => void - an Elite Breach's word (net/wire.js validEgOut): the hub's call, my own breach room's state, fights and receipts
    /** EG-H1 (bible/11-Multiplayer/Elite-Gates.md section 10.8 - RIDDEN POSES): () => [i, dx, dy, dz] | null - my pose's ride on
     *  a breach's moving piece, laid on each pose I say (scenes/eliteGates/egClient.js ridePl); and (pose) => void - a peer's drawn place
     *  moved onto its ride at my shared clock (rideDraw), EG-ZL: and a peer on no ride told, never moved (its ghost slab on a
     *  Crumble I have seen fall - section 10.8). Null outside the Spire. */
    this.poseRide = null;
    this.rideAt = null;
    this.onSdFight = null;        // SD8b: (word, room) => void - the realm's word of its fight (net/wire.js validSdOut's fight kinds), from my own realm alone
    this.onSdReceipt = null;      // SD9a: (receipt, room) => void - my Hour receipt (an `h1`), from my own realm at the fall or from the hub
    this.onGrant = null;          // GRANT2: (answer) => void - my own cell's answer to a grant ask (net/grantLaw.js validGrantOut: ok, no or off)
    this.grantSenders = new Set();   // GRANT-DOOR: the peers whose foes frames the relay vouched stand on grants (`g`) - scenes/grantHost.js holds each to them
    this.grantStatsOk = false;    // FOE-BOUNDS: this relay takes a tally's `stats` (net/grantLaw.js relaySupportsGrantStats)
    this.starGrantOk = false;     // AUDIT STAR-TUNE F1: this relay mints the `star` grant kind (net/grantLaw.js relaySupportsStarGrant)
    this.onWatch = null;          // SEAT1b: (receipt, claims) => void - the Watch's tick the relay signed for my account in my own cell (net/watchReceipt.js), carried to the account service by the seats' book
    this.onRaid = null;           // RAID3: (frame, room) => void - a cell's word about a raid (its ledger, its cleanse, my receipt) or the hub's (a cleanse anywhere, the day's cleanses), projected by the wire's validRaidOut
    this._raidBucket = null;      // RAID3: my own raid words out - raidGate's law
    this.serpentSiteOk = false;   // SERPENT2: the hub that welcomed my primary socket takes a serpent's `site` (relaySupportsSerpentSite)
    this._serpentSiteSaid = null; // SERPENT2: the socket and day my serpent `site` last went on - once a socket and day
    this.serpentOk = false;       // SERPENT1: the relay that welcomed my primary socket holds a serpent's fight (relaySupportsSerpent) - an older one CLOSES the socket on the frame
    this.onSerpent = null;        // SERPENT1: (word, room) => void - the serpent's cell's word (its state, its swim, its blows, my receipt) or the hub's (its kill, Bay-wide), projected by the wire's validSerpentOut
    this._serpentBucket = null;   // SERPENT1: my own serpent words out - serpentGate's law
    this._riteBucket = null;      // WB12d: my own rite words out - riteGate's law
    this.starOk = false;          // STAR3: the relay that welcomed my primary socket keeps a fallen star's ledger (relaySupportsStar) - an older one CLOSES the socket on the frame
    this.onStar = null;           // STAR3: (word, room) => void - a star's cell's word (its ledger, its hold, my receipt) or the hub's (a hold anywhere, my receipt, the night's held stars), projected by the wire's validStarOut
    this._starBucket = null;      // STAR3: my own star words out - starGate's law
    this._sdBucket = null;        // SD3: my own Super dungeon words out - sdGate's law
    this._sdPzBucket = null;      // SD6b: my own turns of the Orrery's stones - sdPzGate's law
    this._sdTurnQ = 0;            // SD6b: my last turn's number (the realm takes a number once: a word said twice is one turn)
    this._sdFightBucket = null;   // SD8b: my own fight words - sdFightGate's law
    this._bodyBucket = null;      // AUDIT INT15: my body's word (`vt`), on a bucket of its own - bodyWordGate's law, never a fight's blows'
    this.foeInventoryOk = false;
    this.owOk = false;            // OW6L: the relay that welcomed my primary socket keeps a cell's overworld ledger (relaySupportsOverworld) - an older one CLOSES the socket on the frame, so nothing is said to it
    this.owGraveOk = false;       // GRAVE-PARTY: ...and its graves searched (relaySupportsOwGraves) - an older one closes the socket on a `gr` word
    this.onOverworld = null;      // OW6L: (msg, room) => void - a cell's word on its overworld ledger, `{k:'sp', ids}` or `{k:'dg', rows}` (validOwOut), from my own cell or a halo's, its welcome's half by half
    this._owBucket = null;        // OW6L: my own `ow` words out - owGate's law
    this._grantBucket = null;     // GRANT2: my own grant asks out - grantGate's law, the relay's
    this._owGrBucket = null;      // AUDIT GRAVE-PARTY G3: and my graves' words, on their own - owGraveGate's law, the relay's
    // name (below), so once Local chat went down this session a heal cast at a mate spent a chat line and a chat line a cast
    this._inTradeBuckets = new Map();   // TRADE1: and the gate on trade frames coming IN, per sender (AUDIT DROPS B3) - a peer is chosen by the sender, so a flood is a peer's, never the relay's
    this._inDirectedSaid = new Set();   // AUDIT 68 S14-inbound-directed-gate-dup: the kinds whose flood the console has said, once each (`_directedIn`)
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
    this._ownerTm = ownerTm;   // OWNER-CLOCK: when my foes were last stepped - every foes frame I send says it (net/ownerClock.js)
    this._rand = rand;   // SLAM2: the retry's jitter - injected, as the clock is, so a pin can drive a whole crowd
    this.room = null;
    this.status = 'idle';      // idle | connecting | open | closed | error
    this.error = null;         // what went wrong, for a person
    this.terminal = false;     // the relay closed with a reason a retry will not change (replaced, refused)
    this.terminalAt = null;    // when it did (the session's clock): rejoin() waits on it
    this._welcomed = new WeakSet();   // SD-HELLO: the sockets their room has welcomed - each says its hello, then nothing more until it is here (_send)
    this._haloPosed = new WeakMap();   // HALO-THIN: a halo's socket -> the last pose it heard from me ({ x, z, mv, at }) - a new socket has heard none
    this._haloPinged = new WeakMap();   // HALO-THIN (AUDIT B F2): a halo's socket -> when it was last pinged on its own clock
    /** HALO-THIN: the host's word that a referee may stand in a halo room this frame (a duel, the open zone, a serpent's
     *  fight) - every pose goes to every halo whole while it is true. */
    this.haloWhole = false;
    this._claimAt = null;      // AUDIT ONESEAT C1: when the claim was made (the session's clock), null for none - `claim` below
    this.claim = false;        // ONE-SEAT: the hub link's hello CLAIMS the player's one seat (`cl`) until the hub welcomes it - world.js chatStart sets it, and resume() for "Play online here"
    this.superseded = false;   // ONE-SEAT: another tab of this player took the seat, or this tab's own id was replaced - STICKY: no join, rejoin or retry until resume()
    this.onSuperseded = null;  // ONE-SEAT: () => void - the relay closed this session 4000; the host leaves every room AT ONCE (a hidden tab draws no frame to do it in)
    this._cbucket = null;      // the client's own chat gate (AUDIT CHAT A8): the relay's law, run first
    this._rbucket = null;      // RED1: and the server line's own, well under it - the relay's law again, run first
    this._dbucket = null;      // TITLE-N: the Dungeon Master's line's own - dmGate, the relay's law run first
    this._ebucket = null;      // EVENT1: the stage's own - eventGate, the relay's law run first
    this._mbucket = null;      // MOD1: and a mute order's, the same way
    // CHAT-G: the gate on lines COMING IN, one bucket per room because
    // that is the unit the relay spends by. Room -> bucket; a room let go
    // drops its bucket with the rest of what that room meant (_forgetRoom).
    this._inChat = new Map();
    this._inPartyChat = null;  // CHAT-CHAN: the party lines' own gate coming in (partyChatInGate) - the hub's, one room
    this._inGuildChat = null;  // GUILD1c: and the guild lines' (guildChatInGate) - the hub's own guild budget
    this._inChatSaid = false;  // the console says it ONCE - a flood must not become its own flood
    this._inLaw = new Map();   // AUDIT SAFE RELAY-2: the relay's word on my own chat, its own bucket per room (LAW_IN_HZ_MAX)
    // AUDIT SOC B3: the same law for the hub's frames - the picture's (state, presence, party, invite) on one bucket per
    // room, the LINES (a note, an error - each a chat line nobody sent) on a tighter one, the other members' poses on a
    // third; an honest hub at full tilt passes whole (net/wire.js SOCIAL_IN_HZ_MAX, NOTE_IN_HZ_MAX, PARTY_IN_HZ_MAX)
    this._inSocial = new Map(); this._inNote = new Map(); this._inParty = new Map(); this._inQuest = new Map();
    this._inTrav = new Map();   // TV3: a region's marks in, per room (travInGate)
    this._inQuestRoom = new Map();   // AUDIT 68 S14-quest-inbound-ungated: the quest arm's own per-room gate, ahead of its per-sender cooldown
    this._inAmap = new Map(); this._inAmapRoom = new Map();   // PARTY-MAP: the map shares' per-sender cooldown (room|acct) and per-room gate, the quest arm's pair
    this._inSocialSaid = false;
    this.peers = new Map();    // id -> { id, name, look, pose, from, at, shown, seenAt } - MERGED over every room held (WORLD6b-iii(b))
    this._fallen = new Map();  // AUDIT CONTRIB A2: ids whose death pose was delivered - ONE death per life, however many sockets carry it; AUDIT ONLINE 3 F4: id -> { ts, at }, the death's send time and when it was heard (_diedSince)
    this._rooms = new Map();   // WORLD6b-iii(b): room -> Set<id> - which rooms report which peers; a peer stays in `peers` while any room holds it
    this._halo = new Map();    // WORLD6b-iii(b): room -> { ws, status, retryAt, backoff } - the neighbouring cells within range (hello'd and posed into, listened to, never streamed to: my own cell's fan reaches everyone in range)
    this._ws = null;
    this._lastSent = null;
    this._lastSentAt = -Infinity;
    this._lastPingAt = -Infinity;   // RELAY-H1: the liveness ping's own clock - it must never delay the heartbeat pose
    this._leaseAskAt = -Infinity;   // LEASE1: when this hub link last asked its lease
    this.seatLiveOk = false;        // FIELD BUGS 2026-10-18d SEAT-LIVE: my room's relay names a dungeon's seat among its live sockets (net/seatLive.js, world220 - SEAT_RELAY_MIN)
    this._seatHeardAt = -Infinity;  // SEAT-LIVE: when the named host was last heard - its word (a welcome, a host frame) or its stream's frame
    this._seatAskedAt = -Infinity;  // SEAT-LIVE: when I last asked the relay for the seat (`_askSeat`)
    this._pose = null;
    this._dead = false;   // AUDIT ONLINE 3 (the second read) A7: my death said (sendDeath) and no life since - every hello says it (_helloFrame)
    this._backoff = BACKOFF_MIN_MS;
    this._retryAt = null;
    /** GATE-DOOR: when my room last refused me busy (this session's clock) - a door that answers, not a room gone silent (scenes/gate/gateCourt.js); AUDIT PLAN-1000 B1: and when a court's upgrade failed before it opened */
    this.busyAt = /** @type {number|null} */ (null);
    this.wire2 = wire2;    // SCALE5b: this session's hello says `w2` - the relay batches its poses (wire.js POSE_BATCH_MS) and its channel's roster
    this._wave = wave;     // SCALE2c: the page's view of a relay deploy's wave (net/reconnectWave.js) - the world host hands every session the page's one
    this._dropAt = null;   // SCALE2c: when the open socket dropped - its first retry asks the wave whether to wait for the page's slot
    this._closedByUs = false;
    this.stats = { sent: 0, poses: 0, received: 0, reconnects: 0, chats: 0, worlds: 0, foes: 0, hits: 0, acts: 0, threw: 0, chatsDropped: 0 };
    this.stats.socials = 0; this.stats.parties = 0;   // SOC2: the acts that left, the party poses that left (on their own line: AUDIT WORLD D12 pins the line above as it stands)
    this.stats.socialsDropped = 0; this.stats.partiesDropped = 0; this.stats.oversize = 0; this.stats.haloThinned = 0;   // HALO-THIN: poses a halo was not due   // AUDIT SOC B3/B20: hub frames and party poses refused at the inbound gates; frames dropped unparsed for their size
    /** ONCRASH1: what the last contained handler threw, for a person - `{ kind, text, at }` or null. */
    this.threw = null;
    this._threwKinds = new Set();   // said in full once a kind; the rest are counted
  }

  /** ONE-SEAT: whether the hub link's next hello claims the seat - AUDIT ONESEAT C1: for CLAIM_TTL_MS after it was
   *  made, then never (a claim is the player's act at a moment, not a standing order). */
  get claim() { return this._claimAt != null && this._now() - this._claimAt <= CLAIM_TTL_MS; }
  set claim(v) { this._claimAt = v ? this._now() : null; }

  /** AUDIT SCALE II C-1: my room's socket is open and its relay has answered the hello - so its word on what it keeps
   *  (`findOk` and the rest) is this relay's, not a default waiting for the welcome. */
  get welcomed() { return this.status === 'open' && !!this._ws && this._welcomed.has(this._ws); }

  /** Enter a room (leaving the last). The pose is the hello's. AUDIT WORLD34 D5: said out loud, with whether the
   *  wire keeps a world for it - until now nothing on screen or in the console told a player whether the dungeon
   *  they stood in was shared or merely peopled. */
  join(room, pose = null) {
    if (this.superseded) return;   // ONE-SEAT: the seat is another tab's - nothing joins until the player says Play online here (resume)
    if (this.barred) return;   // AUDIT SAFE CLIENT-2: banned - nothing joins until the ban is lifted or the page reloads
    if (room === this.room && this._ws) return;
    this._threwKinds.clear();   // AUDIT ONCRASH1 A5: a new room says its own throws out loud - the first `world` throw of a session silenced the console for every later dungeon's
    this._who.clear();   // AUDIT WORLD6b-iii(e) B4: a crossing forgets who was asked - an answer lost in the last cell (its socket died, the peer's leave raced the ask) held the stranger unseen for WHO_RETRY_MS in this one
    const h = this._halo.get(room);
    // AUDIT WORLD6b-iii(b) A1/B7/C2: a LIVE, OPEN halo alone is promoted - one dropped and pending its retry (ws null)
    // handed a dead socket to the primary and the next setHalo closed the good one; any other entry is ended by the
    // ordinary join's leave() and the cell's socket stood at once. AUDIT 68 X7/S14-halo-connecting-orphan: it was
    // deleted here first, so a CONNECTING halo's socket was never closed - leave() closes only what `_halo` still holds
    if (h && h.ws && h.status === 'open' && this._ws && isCellRoom(room) && isCellRoom(this.room)) {
      // WORLD6b-iii(b): a crossing into a cell already hello'd as a halo PROMOTES its socket - no close, no reconnect,
      // no roster wiped (the seam crossing was a churn: every puppet gone, every peer re-said); the cell left steps
      // down to a halo, and setHalo lets it go once it is out of range. AUDIT WORLD6b-iii(b) A6: the demoted entry's
      // status is the SOCKET's - open, or still connecting (an 'error' after a relay error frame is a close on its way)
      // AUDIT WB12d (C6): each socket's own relay's word goes with it - the cell crossed into keeps the raid and the rite
      // its welcome said it keeps, and the one stepped down keeps its own (sendRaid/sendRite read the socket's word)
      const old = { ws: this._ws, status: this.status === 'open' ? 'open' : 'connecting', retryAt: null, backoff: BACKOFF_MIN_MS, since: this._now(), raidOk: this.raidOk, riteOk: this.riteOk, serpentOk: this.serpentOk, sdOk: this.sdOk, foeInventoryOk: this.foeInventoryOk, wildOk: this.wildOk, wildCollectOk: this.wildCollectOk, bossOk: this.bossOk };   // SERPENT1: and the serpent's; INT9 (AUDIT): and the zone's; AUDIT INT15: and the count's
      old.egOk = this.egOk;   // EG-PLAY: and the breach's
      old.starOk = this.starOk;   // STAR3: and the star's
      old.seaPvpOk = this.seaPvpOk;   // SHIP-PVP: and the open sea's guns'
      this._halo.delete(room);
      this._halo.set(this.room, old);
      old.ly = this.layer; this.layer = h.ly ?? 0; this._layerRoom = room;   // SCALE5d: each socket's layer goes with it
      this._ws = h.ws; this.status = h.status; this.error = null; this._retryAt = h.retryAt; this._backoff = h.backoff; this._dropAt = h.dropAt ?? null; this._tokenRetry = !!h.tokenRetry;   // DOOR-TOKEN: its wait on a token too
      this.raidOk = !!h.raidOk; this.riteOk = !!h.riteOk; this.serpentOk = !!h.serpentOk; this.sdOk = !!h.sdOk; this.egOk = !!h.egOk;   // SD3: and the find's; EG-PLAY: and the breach's
      this.starOk = !!h.starOk;   // STAR3: and the star's
      this.seaPvpOk = !!h.seaPvpOk;   // SHIP-PVP: and the open sea's guns'
      this.foeInventoryOk = !!h.foeInventoryOk;
      this.wildOk = !!h.wildOk;   // INT9 (AUDIT): the zone's word went with neither socket
      this.wildCollectOk = !!h.wildCollectOk;   // MAC (2026-10-14): nor the collect's
      this.bossOk = !!h.bossOk;   // AUDIT INT15: nor the count's - a body's word goes by the socket it leaves on
      // AUDIT ONLINE 3 F3: nor the look's - the cell stepped down to a halo kept no `lookOk`, so _flushLook never told it
      // a change again (it handed my old coat to everyone it introduced me to), and the cell crossed into kept the old one's
      old.lookOk = this.lookOk; this.lookOk = !!h.lookOk;
      // AUDIT ONLINE 3 (the second read) C-1: nor the overworld's - `ow` goes down the primary alone, so the cell crossed
      // into reads its own relay's word, never the old cell's: a world211 cell sent `gr` closes the socket, terminal
      old.owOk = this.owOk; old.owGraveOk = this.owGraveOk; this.owOk = !!h.owOk; this.owGraveOk = !!h.owGraveOk;
      // INT9 (AUDIT): MY ZONE WORD MOVES WITH MY CELL - the cell stepped down to a halo hears I left it, the one crossed into
      // that I stand in it (a fighter's bar is its own cell's; the hub carries it across)
      if (this._wildZone === 1) {
        if (old.wildOk && old.status === 'open') this._sayZone(old.ws, 0);
        if (this.wildOk && this.status === 'open' && this._welcomed.has(this._ws)) { this._sayZone(this._ws, 1); this._wildZoneAt = this._now(); }
      }
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

  /** ONE-SEAT: this session gives the seat up - another tab or window of the player took it (the hub's close, or the
   *  browser's own word, net/oneSeat.js). Every room is left, and nothing joins, rejoins or retries until resume(). */
  supersede() {
    this.leave();
    this.superseded = true;
    this.terminal = true; this.terminalAt = this._now();
    this.status = 'error'; this.error = seatText();
  }

  /** ONE-SEAT: the player's "Play online here" - the session may join again; the hub link's next hello claims (`claim`). */
  resume({ claim = false } = {}) {
    if (!this.superseded) return;   // AUDIT ONESEAT H2: only a session the seat was taken from - a live one's status was written "closed" over its open socket, every send refused and no join ever made again
    this.superseded = false;
    this.terminal = false; this.terminalAt = null;
    this.status = 'closed'; this.error = null;
    this.claim = !!claim;
  }

  /** AUDIT SAFE CLIENT-2 (2026-10-17): MY ACCOUNT IS BANNED - every room left, and nothing joins, rejoins or retries until
   *  `unbar()` or a reload (`barred`). ONE-SEAT's `supersede` shape: the page's latch, said once on every room it holds. */
  bar() {
    this.leave();
    this.barred = true;
    this.terminal = true; this.terminalAt = this._now();
    this.status = 'error'; this.error = t('net.online.banned', 'this account is banned');
  }

  /** AUDIT SAFE CLIENT-2: the ban lifted (the relay's `banned` with until 0) - the session may join again. */
  unbar() {
    if (!this.barred) return;
    this.barred = false;
    this.terminal = false; this.terminalAt = null;
    this.status = 'closed'; this.error = null;
  }

  /** Leave the room: the socket closes, the peers go - and every halo's with it (WORLD6b-iii(b)). */
  leave() {
    this._closedByUs = true;
    const ws = this._ws;
    this._ws = null;
    if (ws) { try { ws.close(1000, 'leaving'); } catch { /* already closed */ } }
    // AURA-LIVE: a replacement on its way and a socket replaced go with the room - the next hello says the badge
    for (const [, s] of this._swap) { try { s.ws.close(1000, 'leaving'); } catch { /* already closed */ } }
    for (const [, old] of this._retired) { try { old.close(1000, 'leaving'); } catch { /* already closed */ } }
    this._swap.clear(); this._retired.clear(); this._rehelloWant = false;
    this._endHalo();
    // AUDIT ONLINE 3 F7: THE ROOM LEFT IS FORGOTTEN THROUGH THE ONE DOOR. Only a terminal close reached _forgetRoom, so a
    // leave - a room change, a supersede (another tab took the seat) - kept the welcome's count (the World tab said
    // 'Online - 600' over an empty list, and othersHere and sendHubWho read it) and the room's inbound buckets, one a room
    if (this.room != null) this._forgetRoom(this.room);
    this._rooms.clear();
    this._retryAt = null; this._tokenRetry = false;   // DOOR-TOKEN: nothing waits on a token for a room left
    this.room = null;
    this._dead = false;   // AUDIT ONLINE 3 (the second read) A7: the next room's hello is a new life's (the ghost's room let go, a respawn)
    this.peers.clear();
    this._fallen.clear();
    this._fallenIn.clear();   // WILD1
    this._who.clear();   // AUDIT WORLD6b-iii(e) B4: the asked list goes with the room - a stranger asked here is asked at once in the next
    this._forgetHubLists();   // AUDIT SCALE II C-6: and the hub's lists of everyone and my guild online - a leave, a hop, another region
    this.status = 'closed';
    this._setHost(null);   // AUDIT WORLD2 C2: through the one door, so the world host hears the seat go with the room
    this._setEvent(null, false);   // EVENT1: a player who leaves the server leaves its event - it is online's alone
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
    const dead = told ? validPose(p?.pose) : null;   // AUDIT ONLINE 3 F5: below - an introduction may name the fallen
    // AUDIT ONLINE 3 (the second read) A5: AN INTRODUCTION FROM BEFORE THE DEATH STANDS NOBODY - a roster or a join composed
    // before the peer fell and landing after its death stood them on their own body until that room's death copy came:
    // the pose arm's rule (F4, `_diedSince`), at the introductions' door too
    if (dead && !dead.dd && this._diedSince(id, dead, now)) return;
    this._roomSet(room).add(id);
    const have = this.peers.get(id);
    // AUDIT ONLINE 3 (the second read) A4: A DEATH OLDER THAN WHAT I HEAR OF THEM IS OVER - a relay still holding a ghost's
    // socket and its death pose (its close not yet read) named it to me after the player rose, and felled them as they walked
    if (have && dead?.dd && this._heardSince(have, dead)) { if (have.unconfirmed) this._confirm(have, room); return; }
    if (have) { if (have.unconfirmed) this._confirm(have, room); if (told) this._refresh(have, p, now, room); if (dead?.dd) this._fell(id, this.peers.get(id), dead, room, now, true); return; }   // SLAM14 B2: named or heard here - confirmed here; NET-SMOOTH 3: heard in this room
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
    const made = this._peer(knew ? { ...p, name: knew.name, title: knew.title, glyphs: knew.glyphs, lv: knew.lv, gt: knew.gt, au: knew.au, pi: knew.pi, rb: knew.rb, ...(knew.house ?? {}), sub: knew.sub, look: knew.look } : p, now);   // LEGACY7: and the house   // GUILD1c: the tag it was introduced with; WB9g: and the aura
    made.told = told || !!knew;
    made.recall = !told && !!knew;
    if (told) this._remember(id, made);
    this.peers.set(id, made);
    // AUDIT ONLINE 3 F5: AN INTRODUCTION THAT NAMES THE FALLEN IS A DEATH. The relay holds a socket's last pose, and a
    // fallen player's socket stays in the zone's cell while the body lies (WILD_DEATH_HOLD_S) - so its death pose is what a welcome's roster,
    // a halo's, or the who's join hands a newcomer. Only the pose frame read `dd`; these stood a living figure on the
    // body (lerpPose drops `dd`) and no body was ever laid. Introduced dressed first, so the body wears its look.
    if (dead?.dd) this._fell(id, made, dead, room, now, true);
  }
  /** PCORPSE1 + AUDIT CONTRIB A2: A DEATH POSE, HOWEVER IT CAME - a `pose` frame (`intro` false) or an introduction's
   *  held pose (a welcome's roster, a join: AUDIT ONLINE 3 F5). Delivered once per life, whichever room or door carries
   *  it; the death's send time is kept beside the mark (`_diedSince`). `p` is the peer as it stood, for its look. */
  _fell(id, p, pose, room, now, intro = false) {
    if (!this._fallen.has(id)) {
      this._fallen.set(id, { ts: Number.isInteger(pose.ts) ? pose.ts : null, at: now });
      if (this._fallen.size > FALLEN_MAX) this._fallen.delete(this._fallen.keys().next().value);   // the oldest: a fallen player who never came back
      // AUDIT ONLINE 3 F5: an introduction's death is an old one - the body lies where it fell, and its cry was cried before this player came
      this._deliver('peerDeath', () => this.onPeerDeath?.({ id, look: p?.look ?? null, name: p?.name ?? null }, pose, room, intro ? { intro: true } : undefined));
    }
    // PCORPSE2 ("sometimes the dead body isn't appearing"): THE FALLEN LEAVE THE LIST NOW, not when their socket's
    // close is finally fanned as a `leave` - that can be a second or more behind, and for all of it the peer
    // stood drawn on its own body, which the rise rule (remotePlayers: a player standing where their body lies
    // was raised) read as a resurrection and took the body away. A later pose - a real rise - stands them again,
    // dressed from memory (SLAM9's `_known`).
    for (const set of this._rooms.values()) set.delete(id);
    this.peers.delete(id);
    this._fallenIn.set(id, { room, at: now });   // WILD1: a body in the zone is still answered through this room
    if (this._fallenIn.size > 64) this._fallenIn.delete(this._fallenIn.keys().next().value);
  }
  /** AUDIT ONLINE 3 F4: IS THIS LIVING POSE OLDER THAN THE PEER'S DEATH? Room copies are not ordered (NET-SMOOTH 2), so a
   *  slower room's last living pose could land after the faster room's death - and it stood the dead again from memory,
   *  on its own body, and the slower room's death copy that followed was a second death: a second body, cry and foe
   *  handover. A pose sent at or before the death's own send time is that copy - within TS_RESYNC_MS of hearing the
   *  death, past which the send-time clock is not trusted to order anything (_arriveTimed's own rule). */
  _diedSince(id, pose, now) {
    const f = this._fallen.get(id);
    return !!f && f.ts != null && Number.isInteger(pose.ts) && now - f.at <= TS_RESYNC_MS && poseTsDiff(pose.ts, f.ts) <= 0;
  }
  /** AUDIT ONLINE 3 (the second read) A4: was this pose sent before the newest I have heard from the peer `p`? On the
   *  sender's own clock, which only walks on within its session - `tsRaw` once _arriveTimed has timed the peer, the pose
   *  that stood it until then (_arriveTimed's own first reading). */
  _heardSince(p, pose) {
    const last = p.timed ? p.tsRaw : p.pose?.ts;
    return Number.isInteger(pose.ts) && Number.isInteger(last) && poseTsDiff(pose.ts, last) < 0;
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
    this._known.set(id, { name: p.name, title: p.title, glyphs: p.glyphs, lv: p.lv ?? null, gt: p.gt ?? null, au: p.au ?? null, pi: p.pi ?? null, rb: p.rb ?? null, house: p.house ?? null, sub: p.sub, look: p.look });   // LEGACY7: and the house   // GUILD1c: and the guild's tag   // MOD1: the account too, so a re-stood peer can still be named by /mute   // RENOWN1: and the level
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
    if (!ws || !this._welcomed.has(ws)) return false;   // AUDIT SD IV (0): never ahead of its welcome (SD-HELLO) - not marked, so the next round asks
    const gate = whoGate(this._wbucket, now);
    this._wbucket = gate.bucket;
    if (!gate.pass) return false;
    try { ws.send(JSON.stringify({ t: 'who', id })); this.stats.sent++; } catch { return false; }
    if (this._who.size >= 256) for (const [k, t] of [...this._who]) if (now - t >= WHO_RETRY_MS) this._who.delete(k);   // the asked list is bounded by its own retry
    this._who.set(id, now);
    return true;
  }
  /** FIELD BUGS 2026-10-18d SEAT-LIVE (net/seatLive.js): ASKING FOR A SILENT HOST'S SEAT. The relay names a dungeon room's
   *  seat among the sockets it hears, and a joiner standing still says a pose only every HEARTBEAT_MS - so while the named
   *  host's stream has not come for FOES_STALE_MS (its page hidden: the page here has taken its foes), my pose goes every
   *  FOES_FULL_MS, unmoved: the relay hears me, names the seat, and the memory is the room's again. Answers whether it went. */
  _askSeat(now) {
    if (!this.presence || !this._lastSent || !seatAskDue({ streams: seatStreams(this.room), ok: this.seatLiveOk, open: this.status === 'open', host: this.host, mine: this.isHost(), heardAt: this._seatHeardAt, askedAt: this._seatAskedAt, now })) return false;
    this._seatAskedAt = now;
    return this._send({ t: 'pose', p: { ...this._lastSent, ts: this._stampTs() } });
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
    if (p?.src === room) p.src = null;   // NET-SMOOTH 2: the room that spoke for it let it go - the next room heard speaks
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
    if (room === this.room) this.roomCount = null;   // AUDIT SCALE5a (lens C, pre-existing): a room let go takes its count with it - a superseded World tab said 'Online - 600' over an empty list
    if (room === this.room) this._forgetHubLists();   // AUDIT SCALE II C-6: and its lists of everyone online - a terminal close (the seat taken, a refusal) lets the room go here
    this._inChat.delete(room);   // CHAT-G: a room let go takes its bucket with it, or a long session accumulates one per cell it ever walked through
    this._inLaw.delete(room);   // AUDIT SAFE RELAY-2: and the relay's word's
    this._inSocial.delete(room); this._inNote.delete(room); this._inParty.delete(room);   // AUDIT SOC B3: and the hub's three
    for (const k of [...this._inQuest.keys()]) if (k.startsWith(`${room}|`)) this._inQuest.delete(k);   // AUDIT DROPS C2: keyed room|acct
    this._inQuestRoom.delete(room);   // AUDIT 68 S14-quest-inbound-ungated
    for (const k of [...this._inAmap.keys()]) if (k.startsWith(`${room}|`)) this._inAmap.delete(k);   // PARTY-MAP
    this._inAmapRoom.delete(room);
    if (s) for (const id of s) if (!this._held(id)) this.peers.delete(id);
    for (const p of this.peers.values()) if (p.src === room) p.src = null;   // NET-SMOOTH 2: nor is it anyone's source
  }
  /** AUDIT SCALE II C-6: THE HUB'S LISTS GO WITH THE ROOM THEY WERE ASKED IN. `hubOnline` (the World and Region tabs'
   *  everyone, while the channel is small) and `guildOnline` (the Guild tab's) were replaced only by the next answer, and
   *  that is asked only from a welcomed shard - so a link superseded, refused, left, or moved to another region's
   *  channel listed the people of the room it was in, as online, for the life of the page. Each floor goes too, so the
   *  next room's welcome is asked at once. */
  _forgetHubLists() {
    this.hubOnline = new Map(); this._hubWhoAt = -Infinity;
    this.guildOnline = new Map(); this._guildWhoAt = -Infinity;
    this.hubFound = null; this._boxAsks = new Map(); this._boxAskAt = -Infinity;   // CHAT-FIND-HUB: a search's answer is the room's too
  }
  _openHalo(room, backoff = BACKOFF_MIN_MS) {
    if (!this.url || !this._WS) return;
    let ws;
    // AUDIT WORLD6b-iii(b) A7: a socket that cannot be made is an entry with a retry, not nothing (nothing was re-tried every frame)
    try { ws = this._leased(new this._WS(`${this.url}/room/${room}`), room); } catch { this._halo.set(room, { ws: null, status: 'closed', retryAt: this._now() + BACKOFF_MIN_MS + this._rand() * Math.max(BACKOFF_MIN_MS, backoff - BACKOFF_MIN_MS), backoff: Math.min(BACKOFF_MAX_MS, backoff * 2), since: this._now() }); return; }   // SLAM5 (AUDIT SLAM): jittered like the other two halo paths - SLAM2 claimed all three and treated only two
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
    if (data.f !== undefined && !Array.isArray(data.f)) return false;
    if (data.f?.some((r) => r?.it !== undefined) && !this.foeInventoryOk) return false;
    // WORLD6b: in a cell anyone streams (a foe is its spawner's); in a world room the host alone
    if (!(isCellRoom(this.room) || (this.isHost() && isWorldRoom(this.room))) || !this._ws || this.status !== 'open' || !this._welcomed.has(this._ws)) return false;   // SD-HELLO
    const gate = foesGate(this._fbucket, this._now());
    if (!gate.pass) return false;
    const s = stampedFrameText('foes', data, this._ownerTm(), FOES_FRAME_MAX);   // OWNER-CLOCK: the frame says when its foes were where it says
    if (s == null) return false;
    try { this._ws.send(s); } catch { return false; }
    this._fbucket = gate.bucket; this.stats.sent++; this.stats.foes++;
    return true;
  }

  /** OWN1: MY OWN foes in a world room (a building's, a dungeon's shared quest's) - beside the host's stream, from any
   *  socket, only through a relay that knows the lane (an older one strikes the frame out); the foes frame's bucket and
   *  cap. */
  sendOwnFoes(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!this.ownOk || !isWorldRoom(this.room) || !this._ws || this.status !== 'open') return false;
    const gate = foesGate(this._fbucket, this._now());
    if (!gate.pass) return false;
    const s = stampedFrameText('own', data, this._ownerTm(), FOES_FRAME_MAX);   // OWNER-CLOCK: the own lane's too
    if (s == null) return false;
    try { this._ws.send(s); } catch { return false; }
    this._fbucket = gate.bucket; this.stats.sent++; this.stats.foes++;
    return true;
  }

  /** HCC-PARK: my parked team's word out (net/wire.js's park law). It goes down the socket of the CELL the team stands
   *  in when I hold one (my own cell's, or a halo's) - the only room that will keep it; otherwise down my own socket as
   *  the word about WHERE (the anchor alone: a record said through another room is stored nowhere, so it is not sent).
   *  `{ c }` alone: nothing of that character's is parked. Never at a relay that does not know the frame. Answers
   *  'cell' (it went down the cell's own socket), 'room' (the anchor alone, down mine) or false (not sent). */
  sendPark(data, cell = null) {
    if (!this.parkOk || !data || typeof data !== 'object' || typeof data.c !== 'string' || (data.a !== undefined && !Array.isArray(data.a))) return false;
    // FIELD BUGS 2026-10-09b PARK-HELLO: a socket says its hello and nothing more until its room welcomes it (SD-HELLO's
    // law, _send). `parkOk` is the LAST welcome's, so the park went one frame behind every new room's hello - and a room
    // whose hello awaits (the Shattered Hour's: the hub's word on the Hollow) closed on it ('park before hello'), and the
    // Rift cast its player out at the Hollow's door
    // AUDIT SD IV (0): a welcomed socket alone (SD-HELLO). The word is said again in every room joined (world.js
    // hccParkTick), so it went on the first frame after the realm's hello - a park before hello, refused for good
    const primaryOpen = this.status === 'open' && this._ws && this._welcomed.has(this._ws);
    const halo = cell && cell !== this.room ? this._halo.get(cell) : null;
    let ws = null, inCell = false;
    if (cell && cell === this.room && primaryOpen) { ws = this._ws; inCell = true; }
    else if (halo?.status === 'open' && halo.ws && this._welcomed.has(halo.ws)) { ws = halo.ws; inCell = true; }
    else if (primaryOpen) ws = this._ws;
    if (!ws) return false;
    const gate = parkGate(this._pkbucket, this._now());
    if (!gate.pass) return false;
    const out = data.a && !inCell ? { c: data.c, a: data.a } : data;
    try { ws.send(JSON.stringify({ t: 'park', data: out })); } catch { return false; }
    this._pkbucket = gate.bucket; this.stats.sent++;
    return inCell ? 'cell' : 'room';
  }

  /** WAGONS2-VISIT: WHAT I HAVE PLACED IN MY CARAVAN, to its own room (net/wire.js validCaravanData - `c` my character,
   *  `d` the room's document or null) - on my primary socket, welcomed, standing in a caravan's room, at a relay that
   *  keeps one; on the acts' gate (the relay meters it there). The relay keeps it only from the caravan's owner. TRUE
   *  MEANS IT LEFT. */
  sendCaravan(data) {
    const d = validCaravanData(data);
    if (!d || !this.caravanOk || !caravanKeyOf(this.room)) return false;
    const gate = actGate(this._cvBucket ?? null, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'caravan', data: d })) return false;
    this._cvBucket = gate.bucket;
    return true;
  }

  /** PROFILE2: MY LOOK, CHANGED MID-SESSION - a skin chosen on the pause screen, a coat put on. The look rode the hello
   *  alone, so every room I was already in kept drawing the old one until I changed rooms. It is kept here (every hello
   *  from now on carries it: a reconnect, a halo, the next room) and said again on every socket that already said
   *  hello, as the `look` frame - through a relay that knows it (LOOK_RELAY_MIN; an older one closes on an unknown
   *  frame), at most LOOK_HZ_MAX a second: a look held back by the gate goes on a later tick, and it is the LATEST
   *  look that goes, so trying skin after skin says one. True when the look changed. */
  setLook(look) {
    const v = validLook(look);
    if (!v || JSON.stringify(v) === JSON.stringify(validLook(this.look))) return false;
    this.look = v;
    this._lookDirty = true;
    this._flushLook();
    return true;
  }
  _flushLook() {
    if (!this._lookDirty) return;
    const socks = [];
    // PARK-HELLO (FIELD BUGS 2026-10-09b): never ahead of a welcome - a socket whose hello is still out is waited for
    // AUDIT SD IV (0): a socket open and not yet welcomed said its hello with the look before this one, and a look down it
    // now is a look before hello (SD-HELLO) - held, the tick tries again, until every open socket is welcomed
    if (this.status === 'open' && this._ws) { if (!this._welcomed.has(this._ws)) return; if (this.lookOk) socks.push(this._ws); }
    for (const [, h] of this._halo) if (h.status === 'open' && h.ws) { if (!this._welcomed.has(h.ws)) return; if (h.lookOk) socks.push(h.ws); }
    // nothing open that knows the frame: whatever opens next says hello with this look, so nothing is owed
    if (!socks.length) { this._lookDirty = false; return; }
    const gate = lookGate(this._lkbucket, this._now());
    if (!gate.pass) return;   // held: the tick tries again
    this._lkbucket = gate.bucket;
    this._lookDirty = false;
    const s = JSON.stringify({ t: 'look', look: this.look });
    for (const ws of socks) { try { ws.send(s); this.stats.sent++; } catch { /* the close will say; its reconnect's hello carries the look */ } }
  }

  /** AURA-LIVE (2026-10-05, Mac: "Ensure other players can see all auras"): MY BADGE AGAIN, MID-SESSION - an aura worn
   *  or taken off on the account card or at the Broker. The relay reads a badge (the aura, the title, the glyphs) off
   *  the TOKEN alone, and a token rides a hello, so every room I was already in kept drawing the old one until I
   *  changed area. Each open socket says hello again, on a fresh token, through a NEW socket of the same id - which the
   *  relay already takes as a reconnect: the old socket loses the id and is closed CLOSE_REPLACED with no leave said,
   *  the first hello's stamp is kept (a host keeps its seat - AUDIT WORLD A4), and the new hello's JOIN is fanned to
   *  the room, which every peer reads as "this peer's badge is now this" (`_refresh`). The old socket stays this
   *  session's until the new one's hello is ready (`_promote`), so nothing goes unsaid but a hello's round trip, and
   *  its close - my own hand's - is not the one-seat verdict. At most once a REHELLO_GAP_MS (`_flushRehello` on tick).
   *  True when it is owed (a socket open to say it). */
  rehello() {
    if (this.terminal || this._closedByUs || !this.url || !this._WS) return false;
    this._rehelloWant = true;
    this._flushRehello();
    return true;
  }
  _flushRehello() {
    const now = this._now();
    // a replacement that never opens and never closes is not immortal (the halo's A7 law): past the longest backoff it
    // is dropped, the old socket standing - and the badge owed again
    for (const [room, s] of [...this._swap]) if (now - s.since > BACKOFF_MAX_MS) { this._swap.delete(room); this._rehelloWant = true; try { s.ws.close(1000, 'leaving'); } catch { /* already closed */ } }
    if (!this._rehelloWant || this.terminal || this._closedByUs) return;
    if (now - this._rehelloAt < REHELLO_GAP_MS || this._swap.size) return;   // held: the tick tries again, and the latest badge goes
    const open = [];
    if (this._ws && this.status === 'open' && this.room) open.push([this.room, this._ws]);
    for (const [room, h] of this._halo) if (h.ws && h.status === 'open') open.push([room, h.ws]);
    this._rehelloWant = false;
    if (!open.length) return;   // nothing open: whatever opens next says hello on a fresh token, so nothing is owed
    this._rehelloAt = now;
    for (const [room, old] of open) {
      let ws;
      // AUDIT SCALE II R3-10: THE SAME LAYER, the object the old socket stands in. A replacement takes the old socket's
      // place only in ITS object (the relay's reconnect is a room's own), and was opened at the place itself: the Worker's
      // walk landed it wherever there was room, its welcome said that layer, and the player left their party's layer by
      // changing an aura. The primary asks what `_open` asks; a halo the layer its welcome said (`ly`)
      const ly = room === this.room ? (this.room === this._layerRoom && this.layer > 0 ? this.layer : this.layerHint) : (this._halo.get(room)?.ly ?? 0);
      try { ws = this._leased(new this._WS(`${this.url}/room/${room}${isLayered(room) && ly > 0 ? `?ly=${ly}` : ''}`), room); } catch { continue; }   // the old socket stands; the next change asks again
      this._swap.set(room, { ws, old, since: now });
      this._bind(ws);
    }
  }
  /** AURA-LIVE: the room a replacing socket is opening for, or null. */
  _swapRoom(ws) {
    for (const [room, s] of this._swap) if (s.ws === ws) return room;
    return null;
  }
  /** AURA-LIVE: the replacing socket takes the old one's place - only now, its token minted and its hello ready, and
   *  only while the old one is still the room's open socket (a crossing, a leave or a drop in the meantime: the new
   *  one is closed, and the old one's own paths stand). False when it did not. */
  _promote(ws, room) {
    const s = this._swap.get(room);
    if (!s || s.ws !== ws) return false;
    this._swap.delete(room);
    const primary = room === this.room;
    const h = primary ? null : this._halo.get(room);
    const cur = primary ? this._ws : h?.ws;
    const open = primary ? this.status === 'open' : h?.status === 'open';
    if (this.terminal || this._closedByUs || !cur || cur !== s.old || !open) { try { ws.close(1000, 'leaving'); } catch { /* already closed */ } return false; }
    if (primary) { this._ws = ws; this.ownOk = false; } else h.ws = ws;   // the own lane waits for ITS welcome, as `_open`'s does (OWN1 O2)
    this._retired.set(ws, s.old);
    return true;
  }
  /** AURA-LIVE: the socket a replacement took the place of, closed - by the relay already (CLOSE_REPLACED, at the new
   *  hello), or, when the new one was refused, by this hand: its events were ignored from the promotion on. */
  _retire(ws) {
    const old = this._retired.get(ws);
    if (!old) return;
    this._retired.delete(ws);
    try { old.close(1000, 'leaving'); } catch { /* already closed */ }
  }

  /** WORLD2: a blow on the host's foe out - anyone but the host (the host applies its own), in a world room. */
  sendHit(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    // WORLD6b: in a cell the blow names its owner (`to`, a peer, never me); in a world room it goes to the host, as WORLD2 has it
    const cell = isCellRoom(this.room);
    // AUDIT WORLD6b A6: the owner must be a peer I KNOW (the roster's) - a blow to an owner already gone bought the relay's funnel for nothing
    // OWN1: in a world room a blow on a peer's OWN foe (marked `own`) names its owner as a cell's does - through a relay that routes it
    const owned = !cell && data.own === 1;
    if (owned ? (!this.ownOk || !isWorldRoom(this.room) || !hitOwnerOf(data) || hitOwnerOf(data) === this.id || !this.peers.has(hitOwnerOf(data))) : cell ? (!hitOwnerOf(data) || hitOwnerOf(data) === this.id || !this.peers.has(hitOwnerOf(data))) : (this.isHost() || !this.host || !isWorldRoom(this.room))) return false;
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

  /** TRADE1: THE SOCKET A DIRECTED FRAME TO `id` GOES DOWN - my own cell's when it reports them, else a halo's that does; null
   *  when no open socket I hold reports them. The relay routes `to` inside ONE room, so this is the only thing the relay's
   *  geography decides - and it decides no RANGE: two players a few metres apart astride a cell edge are in each other's halo
   *  (wire.cellHaloFor, `hit`'s own reasoning), so the frame simply goes down whichever socket reports the other. How near
   *  is near enough to trade is a matter of metres (net/tradeSession.js TRADE_RANGE_M), judged by the host from the two bodies. */
  _socketFor(id, said = false) {
    if (!id) return null;
    for (const r of [this.room, ...this._halo.keys()]) {
      if (!this._rooms.get(r)?.has(id)) continue;
      const ws = r === this.room ? (this.status === 'open' ? this._ws : null) : (this._halo.get(r)?.status === 'open' ? this._halo.get(r).ws : null);
      if (ws && (said || this._welcomed.has(ws))) return ws;   // AUDIT SD IV (0): a frame goes down a WELCOMED socket alone (SD-HELLO) - a blink keeps the roster, and its retry's hello is open before its welcome
    }
    return null;
  }

  /** TRADE1: can a frame reach `id` at all - some open socket of mine reports them (see _socketFor). Not a distance.
   *  AUDIT SD IV (0): a socket that has said its hello counts, welcomed or not - AURA-LIVE's replacement waits a hello's
   *  round trip for its welcome, and a peer no socket reaches ends a live trade, a duel's asks and a proposal. */
  reachesPeer(id) { return this._socketFor(id, true) !== null; }

  /** TRADE1: one trade frame out - to a peer through the socket that reports them (`_socketFor`: my own cell or a halo), through
   *  the wire's own projection first (what the relay's parser would refuse never leaves this machine), TRADE_HZ_MAX a second
   *  at home. TRUE MEANS THE FRAME LEFT THE SOCKET and nothing else: net/tradeSession.js reserves goods against this
   *  answer (the LOOT-DUP law, net/hitPend.js) - a false is refused to the caller, never queued here, so the session
   *  owns its own retry and its own fate. */
  sendTrade(data) {
    const d = validTradeData(data);
    if (!d || d.to === this.id || !this.tradeOk) return false;
    const ws = this._socketFor(d.to);
    if (!ws) return false;
    const gate = tradeGate(this._tbucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'trade', data: d });
    if (s.length > TRADE_FRAME_MAX) return false;   // AUDIT DROPS B4: the relay's own door on a trade frame, not the general cap - over it the relay closes the socket
    try { ws.send(s); } catch { return false; }
    this._tbucket = gate.bucket; this.stats.sent++; this.stats.trades = (this.stats.trades ?? 0) + 1;
    return true;
  }

  /** ALLY-CAST: one cast frame out - to a party mate through the socket that reports them (`_socketFor`), through the
   *  wire's own projection first, CAST_HZ_MAX a second; false when it cannot go, which the caster reads as "nobody there". */
  sendCast(data) {
    const d = validCastData(data);
    if (!d || d.to === this.id || !this.castOk) return false;   // AUDIT ALLY-CAST B1: never at a relay that would close the socket for it
    const ws = this._socketFor(d.to);
    if (!ws) return false;
    const gate = castGate(this._castBucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'cast', data: d });
    if (s.length > CAST_FRAME_MAX) return false;
    try { ws.send(s); } catch { return false; }
    this._castBucket = gate.bucket; this.stats.sent++; this.stats.casts = (this.stats.casts ?? 0) + 1;
    return true;
  }

  /** INSPECT1: one card frame out - an ask for a peer's card, or my card to one who asked - to the peer through the
   *  socket that reports them (`_socketFor`: my own cell or a halo), through the wire's own projection first, CARD_HZ_MAX
   *  a second, never at a relay that would close the socket for it. False when it cannot go: the asker's profile then
   *  draws what the room already knows. */
  sendCard(data) {
    const d = validCardData(data);
    if (!d || d.to === this.id || !this.cardOk) return false;
    const ws = this._socketFor(d.to);
    if (!ws) return false;
    const gate = cardGate(this._cardBucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'card', data: d });
    if (s.length > CARD_FRAME_MAX) return false;   // the relay's own door on a card frame - over it the relay closes the socket
    try { ws.send(s); } catch { return false; }
    this._cardBucket = gate.bucket; this.stats.sent++; this.stats.cards = (this.stats.cards ?? 0) + 1;
    return true;
  }

  /** JOURNAL1: a page of my journal held out to one peer, through the socket that reports them (`_socketFor`), through
   *  the wire's own law first (validPageData: its words cleaned, refused past its bound), PAGE_HZ_MAX a second, never at
   *  a relay that would close the socket for it. False when it cannot go - the journal then says so. */
  sendPage(data) {
    const d = validPageData(data);
    if (!d || d.to === this.id || !this.pageOk) return false;
    const ws = this._socketFor(d.to);
    if (!ws) return false;
    const gate = pageGate(this._pageBucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'page', data: d });
    if (s.length > PAGE_FRAME_MAX) return false;   // the relay's own door - the law keeps every page under it, and this keeps a frame that is not from ever closing the socket
    try { ws.send(s); } catch { return false; }
    this._pageBucket = gate.bucket; this.stats.sent++; this.stats.pages = (this.stats.pages ?? 0) + 1;
    return true;
  }

  /** DUEL1: one duel frame out - to my opponent (or the player I challenge) through the socket that reports them
   *  (`_socketFor`), through the wire's own projection first, DUEL_HZ_MAX a second, never at a relay that would close
   *  the socket for it. TRUE MEANS THE FRAME LEFT THE SOCKET; false is refused to the caller, never queued here - the
   *  duel's own law (net/duel/duelSession.js) owns its retries and its timeouts. */
  sendDuel(data, { room = null } = {}) {
    const d = validDuelData(data);
    if (!d || d.to === this.id || !this.duelOk) return false;
    // AUDIT INT8: a bout's frames go to the room that referees it (`room`, its `dref`'s) - the opponent's reporting socket
    // moves with a crossing, and a blow sent to another room met no bout
    const h = room && room !== this.room ? this._halo.get(room) : null;
    const ws = room ? (room === this.room ? (this.status === 'open' ? this._ws : null) : (h?.status === 'open' ? h.ws : null)) : this._socketFor(d.to);
    if (!ws) return false;
    const gate = duelGate(this._duelBucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'duel', data: d });
    if (s.length > DUEL_FRAME_MAX) return false;   // the relay's own door on a duel frame - over it the relay closes the socket
    this._haloCurrent(ws);   // HALO-THIN (AUDIT D3): a halo's judge reads where I am
    try { ws.send(s); } catch { return false; }
    this._duelBucket = gate.bucket; this.stats.sent++; this.stats.duels = (this.stats.duels ?? 0) + 1;
    return true;
  }

  /** LEGACY7 part three: one wed frame out - a proposal, its answer, its end or the union's word - to the player through
   *  the socket that reports them, through the wire's own projection first, WED_HZ_MAX a second, never at a relay that
   *  would close the socket for it. TRUE MEANS THE FRAME LEFT THE SOCKET; false is refused to the caller - the
   *  wedding's own law (net/wedSession.js) owns its timeouts. */
  sendWed(data) {
    const d = validWedData(data);
    if (!d || d.to === this.id || !this.wedOk) return false;
    const ws = this._socketFor(d.to);
    if (!ws) return false;
    const gate = wedGate(this._wedBucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'wed', data: d });
    if (s.length > WED_FRAME_MAX) return false;   // the relay's own door on a wed frame
    try { ws.send(s); } catch { return false; }
    this._wedBucket = gate.bucket; this.stats.sent++;
    return true;
  }

  /** WILD1: the socket a directed wild frame for `id` goes down - the one that reports them, or, for a player who fell
   *  within WILD_GHOST_MS, the room their death pose came through (a fallen player in the zone stays hello'd there until
   *  their body is gone, so their killer's pick can still reach them). */
  _wildSocketFor(id) {
    const ws = this._socketFor(id);
    if (ws) return ws;
    const f = this._fallenIn.get(id);
    if (!f || this._now() - f.at > WILD_GHOST_MS) return null;
    if (f.room === this.room) return this.status === 'open' ? this._ws : null;
    const h = this._halo.get(f.room);
    return h?.status === 'open' ? h.ws : null;
  }

  /** MAC (2026-10-14, the two-phase handoff): whether the relay holding `room` (mine, or a halo's) signs a killer's collect
   *  of a piece in escrow - a fall's drop asks the service to escrow its killer's piece only for such a room. */
  wildCollectAt(room) {
    if (room == null) return false;
    if (room === this.room) return !!this.wildCollectOk;
    return !!this._halo.get(room)?.wildCollectOk;
  }

  /** HALO-REMAINS: every room this session holds a socket in now - my own and each halo's (connecting too). */
  heldRooms() { return this.room ? [this.room, ...this._halo.keys()] : []; }

  /** WILD1: one wild frame out - a DIRECTED one (a blow, a fallen's gear) to the player it names through the socket that
   *  reports them (`_wildSocketFor`), or the ROOM's (a deposit, a take; INT9: a pick) on my own room's socket - or on
   *  `room`'s, a halo I hold (INT9: a fall's pick and its deposit go to the room that refereed it) - through the wire's own
   *  projection first, WILD_HZ_MAX a second, never at a relay that would close the socket for it. TRUE MEANS THE FRAME
   *  LEFT THE SOCKET; false is refused to the caller, never queued here. */
  /** SHIP-PVP: whether the relay behind socket `ws` - my cell's or a halo's - referees the open sea's guns (its own welcome's
   *  word, carried with it across a crossing). */
  _seaPvpOn(ws) {
    if (ws === this._ws) return this.seaPvpOk;
    for (const h of this._halo.values()) if (h.ws === ws) return !!h.seaPvpOk;
    return false;
  }

  sendWild(data, { room = null } = {}) {
    const d = validWildData(data);
    if (!d || !this.wildOk || d.k === 'zone') return false;   // INT9: the zone word is setWildZone's, on my cell's socket
    if (wildDirected(d) && d.to === this.id) return false;
    const halo = !wildDirected(d) && room && room !== this.room ? this._halo.get(room) : null;
    if (!wildDirected(d) && room && room !== this.room && !halo) return false;   // INT9 (AUDIT): a room I no longer hold - never my own instead
    const ws = wildDirected(d) ? this._wildSocketFor(d.to) : halo ? (halo.status === 'open' && halo.wildOk ? halo.ws : null) : (this.status === 'open' ? this._ws : null);
    if (!ws) return false;
    if (SEA_PVP_KINDS.includes(d.k) && !this._seaPvpOn(ws)) return false;   // SHIP-PVP: the sea's guns to a relay that referees them alone - the socket's own (a halo's, a shot's or a boarding's room)
    const gate = wildGate(this._wildBucket, this._now());
    if (!gate.pass) return false;
    const s = JSON.stringify({ t: 'wild', data: d });
    if (s.length > WILD_FRAME_MAX) return false;   // the relay's own door on a wild frame
    try { ws.send(s); } catch { return false; }
    this._wildBucket = gate.bucket; this.stats.sent++;
    return true;
  }

  /** INT9: MY WORD ON THE OPEN ZONE (net/wild/wildRef.js - the relay cannot see the map): `z` 1, I stand in it; 0, I have left
   *  it (or fell, or left the world). AUDIT INT9: said on MY OWN CELL'S socket alone - a fighter's bar is the room it
   *  stands in, carried across by the hub as it crosses (every halo said 1 too, and each held a whole bar of its own) -
   *  again on its welcome, at each crossing (join), and every WILD_ZONE_KEEP_MS while it stands (a relay object that
   *  restarted, or the close of a tab's other socket, forgot it). */
  setWildZone(z) {
    const v = z ? 1 : 0;
    const now = this._now();
    if (v === this._wildZone && !(v === 1 && now - this._wildZoneAt >= WILD_ZONE_KEEP_MS)) return;
    this._wildZone = v;
    if (this.status === 'open' && this.wildOk && this._ws && this._welcomed.has(this._ws)) { this._sayZone(this._ws, v); this._wildZoneAt = now; }
  }
  /** One socket told my zone word - outside the frames' shared bucket (it is said once a crossing; the relay's own bucket
   *  for the socket bounds it). */
  _sayZone(ws, z) {
    try { ws.send(JSON.stringify({ t: 'wild', data: { k: 'zone', z } })); this.stats.sent++; } catch { /* a closing socket: its welcome says it again */ }
  }

  /** PVPDUNGEONS: a word on the zone's halls, to the hub (my social socket alone) - true when it left the socket. */
  sendWdun(word) {
    const w = validWdunIn(word);
    if (!w || !this.wdunOk || !isSocialRoom(this.room) || this.status !== 'open' || !this._ws) return false;
    if ((seaVaultCell(w.h) || w.k === 'fk') && !this.wdunSeaOk) return false;   // SEA-VAULTS: a vault of the deep's key to a hub that reads it alone - AUDIT SEA VENTURES A10: and a fleet's sinking (an older hub closes the socket on it)
    try { this._ws.send(JSON.stringify({ t: 'wdun', ...w })); } catch { return false; }
    this.stats.sent++;
    return true;
  }

  /** WB3: one gate frame out - the level claim on entering the arena, or a blow on the boss - on my own room's socket
   *  (a gate's arena is one room, no halo), through the wire's own projection, GATE_HZ_MAX a second, never at a relay
   *  that would close the socket for it, never outside a gate room. TRUE MEANS THE FRAME LEFT THE SOCKET; false is
   *  refused to the caller - the brain on the relay is the judge of every blow, so nothing is queued here. */
  /** ARENA4: my word to the arena's room I stand in (net/arena/arenaLaw.js validArenaIn) - the hall's or a bout's, on this
   *  session's own socket, ARENA_HZ_MAX a second, never at a relay that opens no arena room. TRUE MEANS THE WORD LEFT THE
   *  SOCKET; false is refused to the caller (the relay is the judge of every blow, so nothing is queued here). */
  sendArena(word) {
    const w = validArenaIn(word);
    if (!w || !this.arenaOk || !isArenaRoom(this.room) || this.status !== 'open' || !this._ws) return false;
    const gate = arenaGate(this._arenaBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'arena', ...w })); } catch { return false; }
    this._arenaBucket = gate.bucket; this.stats.sent++;
    return true;
  }

  sendGate(frame) {
    const g = validGateIn(frame);
    if (!g || !this.gateOk || !isGateRoom(this.room) || this.status !== 'open' || !this._ws) return false;
    if (g.k === 'heal' && !this.gateHealOk) return false;   // GATE-HEAL: never at a relay that would junk it
    if (g.k === 'vt') return this._bodySend('gate', g, this._ws, this.bossOk);   // AUDIT INT15: my body's word, on its own bucket
    const gate = gateGate(this._gateBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'gate', ...g })); } catch { return false; }
    this._gateBucket = gate.bucket; this.stats.sent++; this.stats.gates = (this.stats.gates ?? 0) + 1;
    return true;
  }

  /** SEAT2a part four: my word to the siege's room I stand in (net/wire.js validSiegeIn - `in`, a blow, a cast) - on my own
   *  primary socket, at a relay that fights battles, SIEGE_HZ_MAX a second (the relay strikes past it). TRUE MEANS IT LEFT. */
  sendSiege(frame) {
    const g = validSiegeIn(frame);
    // CROWN1 part two: a Royal Tourney's room at a relay that keeps one
    if (!g || !isBattleRoom(this.room) || !(isRoyalRoom(this.room) ? this.royalOk : this.siegeOk) || this.status !== 'open' || !this._ws) return false;
    const gate = siegeGate(this._siegeBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'siege', ...g })); } catch { return false; }
    this._siegeBucket = gate.bucket; this.stats.sent++;
    return true;
  }

  /** RAID3: my word on the raid whose town I stand in (net/wire.js validRaidIn) - down the socket of the CELL the town
   *  stands in (my own cell's, or a halo's: the park's rule, and the only room that keeps its ledger), RAID_HZ_MAX a
   *  second, never at a relay that would close the socket for it, never down another cell's (the relay strikes a word
   *  said in the wrong cell). TRUE MEANS THE WORD LEFT THE SOCKET; false: not sent (the caller says it again). */
  sendRaid(word, cell) {
    const w = validRaidIn(word);
    if (!w || typeof cell !== 'string' || !isCellRoom(cell)) return false;
    const halo = cell !== this.room ? this._halo.get(cell) : null;
    // AUDIT RAID R8b: THE SOCKET'S OWN RELAY'S WORD (AUDIT RENOWN1 WIRE-3's law) - a halo was sent the frame on the
    // primary's, and a halo's object on an older relay (a deploy under way) closes the socket on it
    if (!(cell === this.room ? this.raidOk : halo?.raidOk)) return false;
    const ws = cell === this.room ? (this.status === 'open' ? this._ws : null) : (halo?.status === 'open' ? halo.ws : null);
    if (!ws) return false;
    const gate = raidGate(this._raidBucket, this._now());
    if (!gate.pass) return false;
    try { ws.send(JSON.stringify({ t: 'raid', ...w })); } catch { return false; }
    this._raidBucket = gate.bucket; this.stats.sent++; this.stats.raids = (this.stats.raids ?? 0) + 1;
    return true;
  }

  /** SERPENT1: my word on the sea serpent's fight (net/wire.js validSerpentIn) - down the socket of the CELL its site
   *  stands in (my own cell's or a halo's: the raid's law, and the only room that holds its fight), SERPENT_HZ_MAX a
   *  second, never at a relay that would close the socket for it. TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendSerpent(word, cell) {
    const w = validSerpentIn(word);
    if (!w || typeof cell !== 'string' || !isCellRoom(cell)) return false;
    const halo = cell !== this.room ? this._halo.get(cell) : null;
    if (!(cell === this.room ? this.serpentOk : halo?.serpentOk)) return false;
    const ws = cell === this.room ? (this.status === 'open' ? this._ws : null) : (halo?.status === 'open' ? halo.ws : null);
    if (!ws) return false;
    if (w.k === 'vt') return this._bodySend('serpent', w, ws, cell === this.room ? this.bossOk : !!halo?.bossOk);   // AUDIT INT15: my hull's word - by the relay of the socket it leaves on, never the primary's
    const gate = serpentGate(this._serpentBucket, this._now());
    if (!gate.pass) return false;
    try { ws.send(JSON.stringify({ t: 'serpent', ...w })); } catch { return false; }
    this._serpentBucket = gate.bucket; this.stats.sent++;
    return true;
  }
  /** AUDIT INT15: A BODY'S WORD (`vt` - net/bossBody.js bodySayer's) down `ws` as `{t, ...w}`: only to a relay that
   *  counts it (`ok`, THAT socket's own welcome's - a halo's relay is its own), on the body's own bucket (net/wire.js
   *  bodyWordGate), never a fight's blows'. TRUE MEANS IT LEFT THE SOCKET. */
  _bodySend(t, w, ws, ok) {
    if (!ok || !ws) return false;
    const gate = bodyWordGate(this._bodyBucket, this._now());
    if (!gate.pass) return false;
    try { ws.send(JSON.stringify({ t, ...w })); } catch { return false; }
    this._bodyBucket = gate.bucket; this.stats.sent++;
    return true;
  }
  /** SERPENT2: where this game found the serpent the clock is about (systems/serpent/serpentSite.js - its day, its native point
   *  to the whole unit and the port it lies off), said to the hub, whose Discord herald names the place and posts the
   *  kill at the site the most accounts agree on (net/serpent/serpentHerald.js). ONCE A SOCKET AND DAY (the gate's `site` law);
   *  on the hub's socket alone, under the serpent frames' own bucket; true once it went. */
  sendSerpentSite(day, sx, sz, place) {
    if (this._serpentSiteSaid && this._serpentSiteSaid.ws === this._ws && this._serpentSiteSaid.d === day) return true;
    const w = validSerpentIn({ k: 'site', d: day, sx: Math.round(sx), sz: Math.round(sz), pl: gatePlaceWire(place) });
    if (!w) { this._serpentSiteSaid = { ws: this._ws, d: day }; return false; }   // a site the wire cannot carry: asked no more today
    if (!this.acct || !this.serpentSiteOk || !isSocialRoom(this.room) || this.status !== 'open' || !this._ws) return false;
    const gate = serpentGate(this._serpentBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'serpent', ...w })); } catch { return false; }
    this._serpentBucket = gate.bucket; this.stats.sent++;
    this._serpentSiteSaid = { ws: this._ws, d: day };
    return true;
  }
  /** SERPENT1: whether a word to `cell` would leave a socket now - my own cell's or a halo's, open, at a relay that holds
   *  a serpent's fight (the host asks before it gathers its volleys into a word). */
  serpentReady(cell) {
    if (typeof cell !== 'string' || !isCellRoom(cell)) return false;
    if (cell === this.room) return this.serpentOk && this.status === 'open' && !!this._ws;
    const h = this._halo.get(cell);
    return !!h?.serpentOk && h.status === 'open' && !!h.ws;
  }

  /** WB12d: my word at a breach's faithful rite (net/wire.js validRiteIn) - down the socket of the CELL its circle
   *  stands in (my own cell's or a halo's, the raid's law), RITE_HZ_MAX a second, never at a relay that would close the
   *  socket for it. TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendRite(word, cell) {
    const w = validRiteIn(word);
    if (!w || typeof cell !== 'string' || !isCellRoom(cell)) return false;
    const halo = cell !== this.room ? this._halo.get(cell) : null;
    if (!(cell === this.room ? this.riteOk : halo?.riteOk)) return false;
    const ws = cell === this.room ? (this.status === 'open' ? this._ws : null) : (halo?.status === 'open' ? halo.ws : null);
    if (!ws) return false;
    const gate = riteGate(this._riteBucket, this._now());
    if (!gate.pass) return false;
    this._haloCurrent(ws);   // HALO-THIN (AUDIT D3): riteNear reads the pose this socket last brought
    try { ws.send(JSON.stringify({ t: 'rite', ...w })); } catch { return false; }
    this._riteBucket = gate.bucket; this.stats.sent++;
    return true;
  }

  /** STAR3: my word at a fallen star (net/wire.js validStarIn) - down the socket of the CELL its pixel stands in (my own
   *  cell's or a halo's, the rite's law), STAR_HZ_MAX a second, never at a relay that would close the socket for it.
   *  TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendStar(word, cell) {
    const w = validStarIn(word);
    if (!w || typeof cell !== 'string' || !isCellRoom(cell) || !this.starReady(cell)) return false;
    const ws = cell === this.room ? this._ws : this._halo.get(cell).ws;
    const gate = starGate(this._starBucket, this._now());
    if (!gate.pass) return false;
    this._haloCurrent(ws);   // HALO-THIN (AUDIT D3): starNear reads the pose this socket last brought
    try { ws.send(JSON.stringify({ t: 'star', ...w })); } catch { return false; }
    this._starBucket = gate.bucket; this.stats.sent++;
    return true;
  }
  /** STAR3: whether a star word to `cell` would leave a socket now - my own cell's or a halo's, open, at a relay that keeps
   *  a fallen star (the host asks before it says one, and shows the star as its own machine's alone when none would). */
  starReady(cell) {
    if (typeof cell !== 'string' || !isCellRoom(cell)) return false;
    if (cell === this.room) return this.starOk && this.status === 'open' && !!this._ws;
    const h = this._halo.get(cell);
    return !!h?.starOk && h.status === 'open' && !!h.ws;
  }

  /** SD3: a Super dungeon found (net/wire.js validSdIn - its slot and the map pixel I stand on at its door) - down the
   *  socket of the CELL that pixel is in (my own cell's or a halo's, the rite's law), SD_HZ_MAX a second, never at a relay
   *  that would close the socket for it. TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendSdFound(word, cell) {
    const w = validSdIn({ ...word, k: 'found' });
    if (!w || typeof cell !== 'string' || !isCellRoom(cell)) return false;
    const halo = cell !== this.room ? this._halo.get(cell) : null;
    if (!(cell === this.room ? this.sdOk : halo?.sdOk)) return false;
    const ws = cell === this.room ? (this.status === 'open' ? this._ws : null) : (halo?.status === 'open' ? halo.ws : null);
    if (!ws) return false;
    const gate = sdGate(this._sdBucket, this._now());
    if (!gate.pass) return false;
    try { ws.send(JSON.stringify({ t: 'sd', ...w })); } catch { return false; }
    this._sdBucket = gate.bucket; this.stats.sent++;
    return true;
  }

  /** SD6b: a turn of an Ending-stone (net/wire.js validSdIn - stone `i`, `a` 1 forward or -1 back, my turn's number) - down
   *  my own socket in the Hour's realm, at a relay that keeps it, SD_PZ_HZ a second (the realm strikes past it). The realm
   *  judges it from my own pose and says the hall back to everyone (onSdHall). TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendSdTurn(i, a) {
    const w = validSdIn({ k: 'pz', i, a, q: this._sdTurnQ + 1 });
    if (!w || !this.sdOk || !isSdRoom(this.room) || this.status !== 'open' || !this._ws || !this._welcomed.has(this._ws)) return false;   // SD-HELLO: `sdOk` is the last welcome's
    const gate = sdPzGate(this._sdPzBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'sd', ...w })); } catch { return false; }
    this._sdPzBucket = gate.bucket; this._sdTurnQ = w.q; this.stats.sent++;
    return true;
  }

  /** SD9a: a slot's spoils taken - said to the hub on my own hub socket (net/wire.js validSdIn `spent`), which keeps that
   *  slot's receipt spent and hands it to no other device of mine. TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendSdSpent(s) {
    const w = validSdIn({ k: 'spent', s });
    if (!w || !this.acct || !this.sdOk || !isSocialRoom(this.room) || this.status !== 'open' || !this._ws) return false;
    const toll = sdGate(this._sdBucket, this._now());   // the sd words' own bucket, a find's
    if (!toll.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'sd', ...w })); } catch { return false; }
    this._sdBucket = toll.bucket; this.stats.sent++;
    return true;
  }
  /** SD8b: a fight word down my own socket in the Hour's realm (net/wire.js validSdIn - `in` with my level and my game's
   *  brain; a blow on the Remnant, an Echo or a Heart), at a relay that keeps it, on the fight's own bucket. */
  _sdFightSend(w) {
    if (!w || !this.sdOk || !isSdRoom(this.room) || this.status !== 'open' || !this._ws || !this._welcomed.has(this._ws)) return false;   // SD-HELLO: a reconnect mid-fight said its `in` before its welcome
    if (w.k === 'vt') return this._bodySend('sd', w, this._ws, this.bossOk);   // AUDIT INT15: my body's word, on its own bucket
    const gate = sdFightGate(this._sdFightBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'sd', ...w })); } catch { return false; }
    this._sdFightBucket = gate.bucket; this.stats.sent++;
    return true;
  }
  /** SD8b: I step into the Last Moment's fight - my level, my game's brain (the realm answers with the whole fight, or
   *  `no`). TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendSdIn(lv) { return this._sdFightSend(validSdIn({ k: 'in', lv, bv: SD_BRAIN_V })); }
  /** SD8b: a blow in the Last Moment - `k` 'hit' (the Remnant), 'ehit' (Echo `e`), 'xhit' (Heart `c`), its number `q`, its
   *  damage `d`, its kind `r` (net/gate/gateBrain.js HIT_KINDS). TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendSdBlow(k, fields) { return this._sdFightSend(validSdIn({ ...fields, k })); }

  /** EG-PLAY: AN ELITE BREACH'S WORD down my own socket (net/wire.js validEgIn): the open (`k` 'open', `z` the service's
   *  signed order, `site` where my company answers from) to the hub alone; my admission (`in`), a step through a door
   *  (`down`), the way home (`home`) and my blows (`hit`, `ahit`, `xhit`) to my own breach's room alone - at a relay that
   *  keeps breaches, after its welcome, on the breach's own bucket. TRUE MEANS THE WORD LEFT THE SOCKET. */
  sendEg(k, fields = {}) {
    const w = validEgIn({ ...fields, k, ...(k === 'in' ? { bv: EG_BRAIN_V } : {}) });
    if (!w || !this.egOk || this.status !== 'open' || !this._ws || !this._welcomed.has(this._ws)) return false;
    if (k === 'open' || k === 'void' || k === 'claimed' ? !isSocialRoom(this.room) : !isEgRoom(this.room)) return false;   // EG-ZA: a stake's void and a counted receipt's word, the hub's as the open is
    // AUDIT EG IV (lane3 #5): the hub's own words on the hub's bucket for them (net/wire.js egHubGate) - a word it would refuse
    // is never sent
    const body = k === 'vt', hubWord = EG_HUB_KINDS.includes(k), gate = body ? bodyWordGate(this._egBodyBucket, this._now()) : hubWord ? egHubGate(this._egHubBucket, this._now()) : egGate(this._egBucket, this._now());   // EG-H1: my body's word on a bucket of its own (AUDIT INT15's law)
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'eg', ...w })); } catch { return false; }
    if (body) this._egBodyBucket = gate.bucket; else if (hubWord) this._egHubBucket = gate.bucket; else this._egBucket = gate.bucket;
    this.stats.sent++;
    return true;
  }
  /** RAID-ROLL: the towns table to the hub that asked for it by its pinned hash (`raid` `tw`), in pieces the wire's own
   *  projection takes (net/raid/raidLaw.js RAID_TOWNS_CHUNK) - down this hub socket alone. Answers whether it all went. */
  sendRaidTowns(h, text) {
    if (!isSocialRoom(this.room) || this.status !== 'open' || !this._ws || typeof text !== 'string' || !text.length) return false;
    const n = Math.ceil(text.length / RAID_TOWNS_CHUNK);
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const d = validRaidTownsIn({ h, n, i, c: text.slice(i * RAID_TOWNS_CHUNK, (i + 1) * RAID_TOWNS_CHUNK) });
      if (!d) return false;
      pieces.push(JSON.stringify({ t: 'raidtowns', data: d }));
    }
    try { for (const p of pieces) this._ws.send(p); } catch { return false; }
    this.stats.sent += n;
    return true;
  }

  /**
   * OW6L: my word on my CELL's overworld ledger (net/overworldLaw.js) - `sendOverworld('sp', ids)` the bands and raiders
   * I spent (travelBands.js / seaRaiders.js ids), `sendOverworld('dg', rows)` the spawned dungeons I first saw or cleared
   * (`[px, py, seen, cleared?]`, shared classic minutes - world/spawnedDungeons.js's `wireRow(key)`). Down the socket of
   * my PRIMARY room alone, and only while it is a cell whose relay keeps the ledger (relaySupportsOverworld: an older one
   * closes the socket on the frame) - a halo hears its own cell's players, and my word is about where I stand. THE
   * RELAY'S LAW AT HOME FIRST: an entry my cell would STRIKE (an id's cell or a row's pixel outside its square widened by
   * OW_CELL_MARGIN_PX, a pixel the spawn roll leaves empty, a clear before its sight, a shape the wire refuses) is left
   * out and never sent; the first OW_WORD_IDS_MAX / OW_WORD_ROWS_MAX of the rest go as one word, OW_HZ_MAX a second (the
   * relay's own bucket). Time is the cell's to judge - an id of a life gone, a row out of its window, is dropped there
   * quietly, never struck. ANSWERS THE ENTRIES THAT WENT, projected and in order - an empty list when nothing did (not a
   * cell, an older relay, the socket down, the gate shut, nothing the cell's law takes); the caller says the rest again.
   * GRAVE-PARTY: `sendOverworld('gr', rows)` the headstones I searched (`[px, py, n]`), to a relay that keeps them alone
   * (relaySupportsOwGraves), each stone's pixel inside my cell's widened square - on the graves' own bucket too (AUDIT
   * GRAVE-PARTY G3, owGraveGate: the relay's, so an honest word is never the one it drops).
   * @param {'sp'|'dg'|'gr'} k @param {unknown[]} payload @returns {Array<string|number[]>}
   */
  /** GRANT-DOOR (bible/11-Multiplayer/Spawn-Grants.md section 20): a peer the relay vouched stands on grants (its foes
   *  frame's `g`) - held to them from here (scenes/grantHost.js). Bounded: the oldest forgotten past SOCKETS_MAX's worth. */
  _grantSender(id) {
    if (this.grantSenders.has(id)) return;
    this.grantSenders.add(id);
    if (this.grantSenders.size > 4 * SOCKETS_MAX) this.grantSenders.delete(this.grantSenders.values().next().value);
  }
  /**
   * GRANT2 (bible/11-Multiplayer/Spawn-Grants.md section 12): A SPAWN GRANT ASKED of my own cell - `{ k: 'mint', id, kind,
   * n }` (net/grantLaw.js validGrantAsk), while its welcome said a law that is not off, on the relay's own per-socket
   * bucket (grantGate: the relay drops what passes it, so an honest ask is never the one it drops). Answers whether it
   * went; the answer comes back by `onGrant`.
   * @param {{ k: 'mint', id: number, kind: string, n: number }} ask @returns {boolean}
   */
  sendGrant(ask) {
    if (!this.grantMode || this.grantMode === 'off' || !streamsFoes(this.room) || this.status !== 'open' || !this._ws) return false;   // GRANT4: a world room's own lane too
    const a = validGrantAsk(ask);
    if (!a) return false;
    const gate = grantGate(this._grantBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'grant', ...a })); } catch { return false; }
    this._grantBucket = gate.bucket; this.stats.sent++;
    return true;
  }
  sendOverworld(k, payload) {
    if (!this.owOk || !isCellRoom(this.room) || this.status !== 'open' || !this._ws || !Array.isArray(payload)) return [];
    const room = this.room;
    const w = k === 'sp' ? validOwIn({ k, ids: payload.filter((id) => owIdInCell(id, room)).slice(0, OW_WORD_IDS_MAX) })
      : k === 'dg' ? validOwIn({ k, rows: payload.filter((r) => owRowSane(r) && owRowInCell(r, room)).slice(0, OW_WORD_ROWS_MAX) })
        : k === 'gr' && this.owGraveOk ? validOwIn({ k, rows: payload.filter((r) => owRowInCell(r, room)).slice(0, OW_WORD_ROWS_MAX) }) : null;
    if (!w) return [];
    const gate = owGate(this._owBucket, this._now());
    const gr = w.k === 'gr' ? owGraveGate(this._owGrBucket, this._now()) : null;
    if (!gate.pass || (gr && !gr.pass)) return [];
    try { this._ws.send(JSON.stringify({ t: 'ow', ...w })); } catch { return []; }
    this._owBucket = gate.bucket; this.stats.sent++; this.stats.ow = (this.stats.ow ?? 0) + 1;
    if (gr) this._owGrBucket = gr.bucket;
    return w.k === 'sp' ? w.ids : w.rows;
  }

  /** AUDIT WBX S1: a day's receipt spent on this device - its spoils given - said to the hub, which forgets its kept
   *  copy (net/wire.js GATE_KINDS' `spent`), so no other device, browser or tab of this account is handed it again. On
   *  the hub's socket alone, under the gate frames' own bucket; false when nothing went (the caller says it again the
   *  next time the hub hands it the receipt). */
  sendGateSpent(day) {
    const g = validGateIn({ k: 'spent', d: day });
    if (!g || !this.acct || !this.gateSpentOk || !isSocialRoom(this.room) || this.status !== 'open' || !this._ws) return false;
    const gate = gateGate(this._gateBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'gate', ...g })); } catch { return false; }
    this._gateBucket = gate.bucket; this.stats.sent++;
    return true;
  }

  /** DISCORD-GATES: where this game found the gate the clock is about (systems/gate/gateSite.js - its day, its map pixel and
   *  its place), said to the hub, which names the place in its Discord posts once two accounts agree (net/gate/gateHerald.js).
   *  ONCE A SOCKET AND DAY - a reconnect says it again, to a hub a deploy may have given a herald since. On the hub's
   *  socket alone, under the gate frames' own bucket; true once it went. */
  sendGateSite(day, px, py, place) {
    if (this._gateSiteSaid && this._gateSiteSaid.ws === this._ws && this._gateSiteSaid.d === day) return true;
    const g = validGateIn({ k: 'site', d: day, px, py, pl: gatePlaceWire(place) });
    if (!g) { this._gateSiteSaid = { ws: this._ws, d: day }; return false; }   // a site the wire cannot carry: nothing to say, asked no more today
    if (!this.acct || !this.gateSiteOk || !isSocialRoom(this.room) || this.status !== 'open' || !this._ws) return false;
    const gate = gateGate(this._gateBucket, this._now());
    if (!gate.pass) return false;
    try { this._ws.send(JSON.stringify({ t: 'gate', ...g })); } catch { return false; }
    this._gateBucket = gate.bucket; this.stats.sent++;
    this._gateSiteSaid = { ws: this._ws, d: day };
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
    this._seatHeardAt = this._now();   // SEAT-LIVE: a host named is a host heard
    if (host && isWorldRoom(this.room)) console.info(`[online] host ${host}${host === this.id ? ' (me)' : ''}`);   // AUDIT WORLD34 D5
    this._deliver('host', () => this.onHost?.(host, this.isHost()));   // ONCRASH1: the host change swaps who steps the room's foes - the biggest handler of the lot
  }

  _open() {
    if (!this.url) { this.status = 'error'; this.error = t('net.online.badUrl', 'the server address must start with wss://'); this.terminal = true; this.terminalAt = this._now(); return; }
    if (!this.room || !this._WS) { this.status = 'error'; this.error = t('net.online.noSocket', 'no WebSocket'); return; }
    let ws;
    const ly = this.room === this._layerRoom && this.layer > 0 ? this.layer : this.layerHint;   // SCALE5d: a reconnect to my layer, else my party's
    try { ws = this._leased(new this._WS(`${this.url}/room/${this.room}${isLayered(this.room) && ly > 0 ? `?ly=${ly}` : ''}`), this.room); } catch (e) { this.status = 'error'; this.error = String(e?.message ?? e); this._scheduleRetry(); return; }   // SCALE5d: my party's layer asked first
    this._ws = ws;
    this.status = 'connecting';
    this._tokenRetry = false;   // DOOR-TOKEN: this socket's own hello says whether it waits on one again
    // AUDIT (the pre-merge audit, OWN1 O2): a new socket has no relay's word yet - the own lane waits for ITS welcome.
    // `ownOk` stood from the last socket's, and `status` reads 'open' at the socket's open, before the welcome: a
    // reconnect to a relay rolled back behind the lane sent its own stream (every ~200 ms, unasked) into a relay that
    // closes on it - the socket terminal, the player offline (AUDIT RENOWN1 WIRE-3's law, the renown order's)
    this.ownOk = false;
    this._bind(ws);
  }

  /** The hello as the wire has it - the account beside the peer when this session holds one (SOC2: the hub link's;
   *  a session without it sends the hello every build before SOC1 sent, key for key). */
  _helloFrame(tok = null, room = this.room) {
    const frame = { t: 'hello', id: this.id, secret: this.secret, name: this.name, look: this.look, pose: this.presence && this._pose ? { ...this._pose, ...(this._dead ? { mv: 0, dd: 1 } : {}), ts: this._stampTs() } : null };   // SCALE2b: the hello's pose is a pose said now; AUDIT ONLINE 3 (the second read) A7: a death's, while I lie dead
    // ACC1d: only when there IS one. A `tok: null` would be a malformed
    // token rather than an absent one, and wire.js refuses that - which
    // is right, and is why the key is not written at all when empty.
    if (tok) frame.tok = tok;
    if (this.acct && this.asecret) { frame.acct = this.acct; frame.asecret = this.asecret; frame.ps = 1; }   // AUDIT FRIENDS-SYNC F5: this build reads the player's picture
    if (this.claim) frame.cl = 1;   // ONE-SEAT: a tab going online takes the seat; a reconnect does not
    if (this.wire2) frame.w2 = 1;   // SCALE5b: the second wire - a relay that knows it batches; one before it reads no such field
    if ((isSocialRoom(this.room) || isRegionRoom(this.room)) && !this._hubBus) frame.hs = 1;   // SCALE5c: the shards understood - the hub's and a region's (part two); the bus says which is this account's
    if (isBattleRoom(this.room) && this._siegePass) frame.sp = this._siegePass;   // SEAT2a part four: the battle's pass (CROWN1 part two: a Royal Tourney's too)
    if (groundRoom(room)) frame.gl = GROUND_LAW;   // GROUND-GATE: the ground this build stands on, to a room whose peers stand on it (net/wire.js)
    if (streamsFoes(room)) frame.gv = GRANT_HELLO_LAW;   // GRANT-DOOR: the grants this build stands on, to a room whose foes ride (net/wire.js)
    if (leaseRoom(room)) frame.ls = 1;   // LEASE1: this build hands its hub's lease to the room
    if (isSocialRoom(room)) frame.sm = 1;   // STAFF-PANEL5-MESSAGE: this build shows a staff message's box - a hub link without it is "old game, not shown"
    frame.fv = 1;   // STAFF-PANEL5-FREEZE: this build shows the freeze screen - a relay closes a frozen account's socket from a build that cannot
    return frame;
  }

  /** ACC1d: one token, or null, and never a throw and never a hang - with why there is none (AUDIT ONLINE 3 F6: the
   *  socket's own answer, `{ tok, why }`, never a field of the session's another socket's mint can write).
   *  TOKEN_WAIT_MS is the whole budget: past it the hello goes without
   *  one, which is a connection that works and a name the relay will
   *  not vouch for - strictly better than a player who cannot connect
   *  because a second Worker is having a bad minute. */
  async _mint(room = null) {
    try {
      const late = Symbol('late');
      let timer = null;   // AUDIT ONLINE 3 (the second read): let go with the race, as the siege pass's is - an 8 s timer a connection kept
      const got = await Promise.race([
        Promise.resolve(this.mintToken(room)).catch(() => null),   // SCALE2: the room it opens - a token opens each room once
        new Promise((r) => { timer = setTimeout(() => r(late), TOKEN_WAIT_MS); }),
      ]).finally(() => clearTimeout(timer));
      // TOKEN-WAIT: said, so a player's console can tell a slow service from a missing sign-in (the minter says its own)
      if (got === late) { console.warn(`[online] no identity token within ${TOKEN_WAIT_MS} ms - the hello goes without one, and the relay refuses it`); return { tok: null, why: 'late' }; }
      return got ? { tok: got, why: null } : { tok: null, why: this.mintToken?.lastWhy ?? 'refused' };
    } catch { return { tok: null, why: 'refused' }; }
  }

  /** The one handler set for a socket, the primary's or a halo's - the role is read at event time (_roomOf). */
  _bind(ws) {
    ws.onopen = async () => {
      // AUDIT SCALE II C-2: THIS SOCKET OPENED - remembered before anything else, the role's question included. A shard's
      // socket that closes without it is a relay that refused the key (onclose's fallback reads it, not `status`)
      this._opened.add(ws);
      const room = this._roomOf(ws) ?? this._swapRoom(ws);   // AURA-LIVE: or a socket opening to replace one (rehello)
      if (room == null) return;
      const live = () => this._roomOf(ws) != null || this._swapRoom(ws) != null;
      // ACC1d: A FRESH TOKEN PER CONNECTION, minted here because the
      // relay spends each one once. Awaiting before the hello is safe -
      // the relay says nothing until it has heard one - and it is
      // BOUNDED and SWALLOWED: an account service that is slow or down
      // must cost a connection a moment, never the connection itself.
      // A session with no token is admitted as every build before this
      // slice was (bible ACC1d D1).
      // AUDIT ONLINE 3 F6: THE TOKEN IS THIS SOCKET'S, held here until its hello - it was the session's `this.token`, and
      // a halo's mint that ended while a battle room's socket awaited its pass wrote over it: the siege's hello went
      // without the token it was minted, its tokenless mark unset, and the relay's refusal read as terminal
      let tok = null;
      if (this.mintToken) {
        const minted = await this._mint(room);
        // the socket may have been replaced or closed while we waited
        if (!live()) return;
        tok = minted.tok;
        // SCALE2: why this socket's hello goes without one - its close is read by it (tokenRetryable)
        if (tok) this._tokenless.delete(ws); else this._tokenless.set(ws, minted.why ?? 'refused');
      }
      // SEAT2a part four: A FRESH PASS PER HELLO into a siege's room (an order lives a minute), bounded as the token is
      if (room === this.room && isBattleRoom(room) && this.mintSiegePass) {
        this._siegePass = null;
        let timer = null;
        try {
          this._siegePass = await Promise.race([Promise.resolve(this.mintSiegePass(room)).catch(() => null), new Promise((r) => { timer = setTimeout(() => r(null), TOKEN_WAIT_MS); })]);
        } catch { this._siegePass = null; } finally { clearTimeout(timer); }
        if (!live()) return;
      }
      if (this._roomOf(ws) == null && !this._promote(ws, room)) return;   // AURA-LIVE: a replacement takes its place now, its hello ready
      const frame = this._helloFrame(tok, room);
      // STORM-SHED: the token opens this room NOW - the minter's word for which rooms it has spent itself in. A token that
      // came after TOKEN_WAIT_MS opened nothing (this hello went without it), so the room's next socket is handed it
      if (frame.tok) { this.mintToken?.opened?.(room, frame.tok); this._helloTok.set(ws, frame.tok); }   // SCALE5a: and remembered by its socket
      const hello = JSON.stringify(frame);
      if (room === this.room) {
        this.status = 'open'; this.error = null;   // SLAM12: `_backoff` is reset by the WELCOME (`_receive`), not here - see there
        this._lastSent = null; this._lastSentAt = -Infinity;
        this._lastParty = null; this._lastPartyAt = -Infinity;   // SOC2: a fresh socket is a fresh attachment at the hub - the next party pose goes whole
        this.amapOk = false;   // PARTY-MAP: likewise, the welcome says
        this.staffTeleportOk = false;
        this.followOk = false;   // STAFF-PANEL5-FOLLOW: likewise
        this.instanceOk = false;   // INSTANCES: likewise - a relay rolled back behind world208 keeps no instance
        this.relayCfgOk = false;   // SCALE5b: likewise
        this.grantMode = null;   // GRANT2: likewise - an older relay closes the socket on an ask (GRANT6: null, not yet said - scenes/grantHost.js waits on it a stand's while)
        this.findOk = false;   // AUDIT SCALE II C-1: likewise - a relay rolled back behind the shards closes the hub link on `find`
        this.travOk = false;   // AUDIT DEEP T3-5: this socket's relay says whether it knows `trav` on ITS welcome (a rollback to world121 closes on one)
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
      this._retire(ws);   // AURA-LIVE: a replacement refused - the socket it replaced goes too (the retry below says hello)
      for (const [r, s] of this._swap) if (s.ws === ws) this._swap.delete(r);   // AURA-LIVE: one that never took its place
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
        const noToken = code === CLOSE_POLICY && tokenRetryable(this._tokenless.get(ws));   // SCALE2: refused for a token the service did not give in time - asked again
        if (code === CLOSE_POLICY && ev?.reason === 'banned') { this._halo.delete(room); this.bar(); return; }   // AUDIT SAFE CLIENT-2: the relay's own word - my account is banned, and every room I hold goes with this one
        this._tokenUnread(ws, room, ev);   // SCALE5a: a busy refusal before the token was read leaves it this room's to carry again
        if (code === CLOSE_REPLACED || (code === CLOSE_POLICY && !noToken)) { h.ws = null; h.status = 'terminal'; h.retryAt = null; return; }
        const wasOpen = h.status === 'open';
        h.ws = null; h.status = 'closed';
        h.dropAt = wasOpen && code !== CLOSE_BUSY && !noToken ? this._wave.dropped(this._now()) : null;   // SCALE2c: an open halo's drop is the page's to weigh as a wave
        if (code === CLOSE_BUSY || noToken) h.backoff = Math.max(h.backoff, BACKOFF_MAX_MS / 2);
        h.retryAt = this._now() + BACKOFF_MIN_MS + this._rand() * Math.max(BACKOFF_MIN_MS, h.backoff - BACKOFF_MIN_MS); h.backoff = Math.min(BACKOFF_MAX_MS, h.backoff * 2);   // SLAM2: jittered
        if (noToken) h.retryAt = this._afterMintHold(h.retryAt);   // STORM-SHED: not before the page's next mint may be asked
        h.tokenRetry = noToken;   // DOOR-TOKEN: or the moment a token is held (`tick`)
        return;
      }
      // SCALE5c: A SHARD THAT NEVER OPENED, twice in a row, is a relay before the shards (it refuses the key) - the hub link
      // goes to the hub itself, and offers the shards no more this session (or the bus would send it straight back)
      // AUDIT SCALE II C-2: "never opened" is the SOCKET's own word (`_opened`), not `status`. A browser fails a refused
      // upgrade by firing `error` and THEN `close` (the WebSocket standard's "fail the WebSocket connection"), and
      // `onerror` below writes status 'error' first - so `status === 'connecting'` never held in a browser, and a page that
      // remembered the shards tried its shard for ever after a relay rolled back. Only the pins' close-alone reached it
      if (isChannelShard(room) && !this._opened.has(ws) && !this._closedByUs && ++this._shardMiss >= 2) { this._shardMiss = 0; this._hubBus = true; this._ws = null; this.join(channelOf(room)); return; }
      this._ws = null;
      this._setHost(null);   // AUDIT WORLD2 A2/C2: a dead socket holds no seat - the host is unknown until the next welcome, and the world host hears it (onHost)
      // SLAM12 (AUDIT SLAM): a TERMINAL close forgets the room's peers - no reconnect is coming, and 199 stale records
      // would otherwise be eased by every tick and counted by poseHzFor for the life of the page. A plain drop keeps
      // them ON PURPOSE: through a one-second blip the crowd stays drawn where it was rather than vanishing and
      // re-standing, and the reconnect's welcome merges over it (AUDIT ONLINE B13).
      if (code === CLOSE_REPLACED) { this.superseded = true; this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = seatText(); this._endHalo(); this._forgetRoom(this.room); this._deliver('superseded', () => this.onSuperseded?.()); return; }   // ONE-SEAT: sticky - another tab or window has the seat (the hub's word), or this tab's own id (a duplicated tab)   // AUDIT WORLD6b-iii(b) A4
      // AUDIT SAFE CLIENT-2: CLOSED 1008 'banned' - the relay's word that a ban holds in this room (an order taken, or a hello
      // while one stands). It stays closed: no retry, and no rejoin on CHAT_REJOIN_MS's clock (`barred`)
      if (code === CLOSE_POLICY && ev?.reason === 'banned') { this.bar(); return; }
      // SCALE2: A HELLO REFUSED FOR ITS MISSING TOKEN, WHILE THIS DEVICE IS SIGNED IN, IS ASKED AGAIN. The account service
      // was slow (a relay deploy reconnects every player at once, and every socket asks it for a token) or had a bad
      // minute: the relay refused the tokenless hello and this close was terminal - the player offline until they
      // changed room. Only a missing sign-in ('no-session') or one the service stopped honouring ('auth') is final.
      if (code === CLOSE_POLICY && tokenRetryable(this._tokenless.get(ws))) { this.status = 'closed'; this.error = t('net.online.waitingAccount', 'waiting for the account service'); this._backoff = Math.max(this._backoff, BACKOFF_MAX_MS / 2); this._scheduleRetry(); this._retryAt = this._afterMintHold(this._retryAt); this._tokenRetry = true; return; }   // STORM-SHED: not before the page's next mint may be asked - DOOR-TOKEN: or the moment a token is held (`tick`)
      if (code === CLOSE_POLICY) { this.terminal = true; this.terminalAt = this._now(); this.status = 'error'; this.error = this.error ?? t('net.online.refused', 'the server refused a message'); this._endHalo(); this._forgetRoom(this.room); return; }
      // AUDIT PLAN-1000 B1: AND A COURT'S UPGRADE THE WORKER REFUSED BEFORE IT OPENED (an overloaded object's 503, every copy
      // full) is its door answering too - the browser's 1006 for it says no `busy`, and the court counted it silence and
      // cast its player out at COURT_SILENT_MS; the court's wait (gateCourt.js COURT_DOOR_WAIT_MS) still bounds it
      if (!this._opened.has(ws) && !this._closedByUs && isGateRoom(room)) this.busyAt = this._now();
      if (code === CLOSE_BUSY) { this._tokenUnread(ws, room, ev); this.busyAt = this._now(); this.status = 'closed'; this.error = t('net.online.busy', 'the room is busy'); this._backoff = Math.max(this._backoff, BACKOFF_MAX_MS / 2); this._scheduleRetry(); return; }   // full or gated: back off hard, then try again   // SCALE5a: its token handed back when the relay never read it
      // SCALE2c: an open socket's drop, weighed by the page as a wave. AUDIT SCALE II C-2 (found on the way, the same
      // cause): open as it stood BEFORE the browser's `error` - an unclean close (1006, a deploy's) fires `error` first,
      // which wrote 'error' over 'open', and no socket of a page in a browser was ever weighed: no wave, no spread
      const was = this._statusAtError.get(ws) ?? this.status;
      if (!this._closedByUs) this._dropAt = was === 'open' ? this._wave.dropped(this._now()) : null;
      this.status = 'closed';
      if (!this._closedByUs) this._scheduleRetry();
    };
    ws.onerror = () => { const room = this._roomOf(ws); if (room === this.room && room != null) { if (!this._statusAtError.has(ws)) this._statusAtError.set(ws, this.status); this.status = 'error'; this.error = t('net.online.socketError', 'socket error'); } };   // AUDIT SCALE II C-2: what it stood at, kept for the `close` that follows
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

  /** STORM-SHED: A ROOM REFUSED FOR WANT OF A TOKEN ASKS AGAIN ONLY ONCE A TOKEN MAY BE ASKED FOR. The page's minter holds
   *  its next mint off after a failure (its `coolMs()`), and a hello said before that hold runs out goes without a token
   *  and is refused again - so a retry at `at` waits until it ends, spread over BACKOFF_MIN_MS. Answers the later time;
   *  no retry (null) stays none. */
  _afterMintHold(at) {
    const hold = Number(this.mintToken?.coolMs?.() ?? 0);
    return at != null && hold > 0 ? Math.max(at, this._now() + hold + this._rand() * BACKOFF_MIN_MS) : at;
  }

  /** SCALE5a: A BUSY REFUSAL THE RELAY MADE BEFORE READING THE TOKEN LEAVES IT UNSPENT. A room's hello gate is asked
   *  first, and its close says so in its reason (wire.js BUSY_TOKEN_UNREAD): the token this socket's hello carried is
   *  handed back to the minter for `room`, and the retry carries it again instead of minting - at a relay deploy, the
   *  hub's gate refuses hundreds of the wave, each of them another mint until this. Any other close, or a relay before
   *  this that closes 'busy' alone, hands nothing back. */
  _tokenUnread(ws, room, ev) {
    if (ev?.code !== CLOSE_BUSY || ev?.reason !== BUSY_TOKEN_UNREAD) return;
    const tok = this._helloTok.get(ws);
    if (tok) this.mintToken?.unopened?.(room, tok);
  }

  /** SD-HELLO (2026-10-08, the Discord, of a live Abyss Dungeon: "portal keep teleporting me out of dungeon"): A SOCKET
   *  SAYS ITS HELLO, THEN NOTHING UNTIL ITS ROOM WELCOMES IT. The relay names a socket at the END of its hello, and a
   *  room's hello may wait on another object before that - a Hollow's realm asks the hub for its record
   *  (server/src/index.js _sdAdmit) - while a Durable Object takes the socket's next frame whenever a fetch is out. The
   *  pose this session sent a frame after the hello was read there as a pose BEFORE it, refused for good, and the Hour
   *  cast every newcomer out (world.js sdRealmFrame). A ping is the runtime's own (setWebSocketAutoResponse) and never
   *  reaches the room. */
  _send(o) {
    if (!this._ws || this.status !== 'open') return false;
    if (o?.t !== 'hello' && o?.t !== 'ping' && !this._welcomed.has(this._ws)) return false;   // SD-HELLO
    try { this._ws.send(JSON.stringify(o)); this.stats.sent++; return true; } catch { return false; }
  }

  /** SCALE2b: this session's send time for a pose going out now (wire.js POSE_TS_MOD) - its wall clock in ms, never
   *  less than one past the last it stamped, so two poses said in one millisecond still order. */
  _stampTs() {
    this._tsLast = Math.max((this._tsLast ?? -Infinity) + 1, Math.floor(this._now()));
    return this._tsLast % POSE_TS_MOD;
  }

  /** The frame's pose: sent at POSE_HZ when it moved, and every HEARTBEAT_MS regardless. A channel session refuses it (AUDIT CHAT D3). */
  sendPose(pose) {
    if (!this.presence) return false;
    this._pose = pose; this._dead = false;   // AUDIT ONLINE 3 (the second read) A7: a pose said is a life
    const now = this._now();
    if (now - this._lastSentAt < 1000 / poseHzFor(this.peers.size)) return false;   // SLAM3: a crowd is spoken to less often

    if (now - this._lastSentAt < HEARTBEAT_MS && !poseChanged(this._lastSent, pose)) return false;
    // WORLD6b-iii(b): the halo rooms hear my pose too - their fans range me by it and their rosters place me - each when it
    // is due (HALO-THIN, haloPoseDue); AUDIT WORLD6b-iii(b) A5: through every OPEN socket, my own cell's down or not (the
    // halos rode out nothing while the fan sat behind the primary's send), and then whole
    if (!(this._ws && this.status === 'open') && ![...this._halo.values()].some((h) => h.status === 'open' && h.ws)) return false;   // nowhere to say it: nothing stamped
    const pl = this.poseRide?.() ?? null;   // EG-H1: RIDDEN POSES - my ride on a breach's moving piece, when I stand on one
    const out = { ...pose, ...(pl ? { pl } : {}), ts: this._stampTs() };   // SCALE2b: one send time for every room's copy - that is what lets a listener order them
    let went = this._send({ t: 'pose', p: out });
    // HALO-THIN: a halo hears the pose when it is due - every one while my own cell's socket took none, the host says a
    // referee may stand in a halo, the halo's own cell says one does (SCALE5b's `rf`, the relay's word of its duels, Wild
    // zone and serpent fights), or the halo reaches a player in range who does not hold my cell
    const whole = !went || this.haloWhole;
    let s = null;
    for (const [room, h] of this._halo) {
      if (h.status !== 'open' || !h.ws || !this._welcomed.has(h.ws)) continue;
      if (!whole && !this._rfOn.get(h.ws) && !haloPoseDue(this._haloPosed.get(h.ws), out, now) && !this._haloAlone(room, out)) { this.stats.haloThinned++; continue; }
      try { h.ws.send(s ??= JSON.stringify({ t: 'pose', p: out })); this.stats.sent++; went = true; this._haloPosed.set(h.ws, { x: out.x, z: out.z, mv: out.mv | 0, at: now }); } catch { /* the close will say */ }
    }
    if (!went) return false;
    this._lastSent = { ...pose }; this._lastSentAt = now; this.stats.poses++;
    return true;
  }

  /** HALO-THIN (AUDIT B F1): does this halo room report a player in range of `pose` that my own cell's room does not - one
   *  whose socket into my cell is still opening, backing off or refused busy, and who hears me through this halo alone?
   *  A member my own room has not reported yet (its roster cut, a join on its way) counts: an extra pose, never a lost one. */
  _haloAlone(room, pose) {
    const there = this._rooms.get(room);
    if (!there?.size) return false;
    const mine = this._rooms.get(this.room);
    for (const id of there) {
      if (mine?.has(id)) continue;
      const p = this.peers.get(id);
      const at = p?.shown ?? p?.pose;
      if (at && inRange(room, pose, at)) return true;
    }
    return false;
  }

  /** HALO-THIN (AUDIT D3): a word for a referee down a halo (a duel's, a rite's) - the relay judges it by the pose that socket
   *  last brought (duelOpen's ring, riteNear's reach), so the halo hears my latest pose first when its last is not that. */
  _haloCurrent(ws) {
    const pose = this._pose;
    if (!pose || !ws || ws === this._ws || !this._welcomed.has(ws)) return;
    const last = this._haloPosed.get(ws);
    if (last && last.x === pose.x && last.z === pose.z && (last.mv | 0) === (pose.mv | 0)) return;
    const out = { ...pose, ts: this._stampTs() };
    try { ws.send(JSON.stringify({ t: 'pose', p: out })); this.stats.sent++; this._haloPosed.set(ws, { x: out.x, z: out.z, mv: out.mv | 0, at: this._now() }); } catch { /* the close will say */ }
  }

  /** PCORPSE1: THE LAST POSE. A dying player's body where it fell, flagged `dd`, sent ONCE through every open socket
   *  (the cell's and the halo's - whoever could see me hears it) right before the dead branch leaves the room. Past
   *  the pose rate on purpose: it is the one pose that must not wait for the next tick, because there is none. */
  sendDeath() {
    const last = this._pose ?? this._lastSent;
    if (!this.presence || !last) return false;
    // AUDIT ONLINE 3 (the second read) A7: AND EVERY HELLO AFTER IT SAYS IT. A Wild ghost's socket stays in the cell while
    // my body lies (scenes/world.js `_wildGhost`), and its reconnect - a blip, a relay deploy's wave - sent the hello's pose,
    // which was my last LIVING one: the relay held that, its join stood me up on my own body on every screen (the rise rule
    // took the body), its rosters named a living figure to every newcomer (F5 had no `dd` to read), and its fights counted
    // me among the living. Cleared by a pose (a rise) and by a leave (the next room's hello is a new life's)
    this._dead = true;
    const s = JSON.stringify({ t: 'pose', p: { ...last, mv: 0, dd: 1, ts: this._stampTs() } });
    let went = false;
    if (this._ws && this.status === 'open' && this._welcomed.has(this._ws)) { try { this._ws.send(s); this.stats.sent++; went = true; } catch { /* the close will say */ } }   // SD-HELLO: never ahead of a welcome
    for (const [, h] of this._halo) if (h.status === 'open' && h.ws && this._welcomed.has(h.ws)) { try { h.ws.send(s); this.stats.sent++; went = true; } catch { /* the close will say */ } }
    return went;
  }

  /** A chat line out (CHAT1): sanitized here as the relay sanitizes it, and gated here as the relay gates it
   *  (AUDIT CHAT A8: the relay drops an over-rate line without a word, so the client refuses it first and the
   *  caller keeps the text); false when nothing went - nothing to say, over the rate, or no open socket. */
  sendChat(text, { ch = null, me = false } = {}) {
    const line = sanitizeChat(text);
    if (!line) return false;
    if (this.mayChat && !this.mayChat(line)) return false;   // AUDIT SAFE CLIENT-13: the code of conduct's gate, whatever door the line came by
    // CHAT-CHAN: a line for a channel inside the room (the party's, on the hub link) goes only to a relay that routes
    // it - an older one projects `{t:'chat', text}` and would fan the party's line to everyone online
    if (ch != null && (!CHAT_LINE_CHANNELS.includes(ch) || !(ch === 'guild' ? this.guildOk : this.chanOk))) return false;   // GUILD1c: a guild's line only to a relay that routes it - an older one refuses the channel and closes nothing, but says nothing either
    if (ch === 'staff' && !this.staffOk) return false;   // STAFF-PANEL5-FREEZE: a staff nudge only to a hub that spoke the staff channel's word first (a `frozen`, a nudge)
    // EMOTE1: an action only to a relay that carries one - an older one would say "waves" as a line of its own
    if (me && !this.emoteOk) return false;
    const gate = chatGate(this._cbucket, this._now());
    if (!gate.pass) return false;
    const frame = { t: 'chat', text: line, ...(ch != null ? { ch } : {}), ...(me ? { me: true } : {}) };
    if (!this._send(frame)) return false;
    this._cbucket = gate.bucket;   // the token is spent only on a line that left
    this.stats.chats++;
    return true;
  }

  /** CARDS5: a word to the room's card table (sit, stand, act, look - net/holdemTable.js validHoldemIn), to a relay that
   *  deals; false when it is not one, the word is bad or the gate is shut. */
  sendHoldem(word) {
    const w = validHoldemIn(word);
    if (!w || !this.holdemOk) return false;
    const gate = holdemGate(this._holdemBucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'holdem', ...w })) return false;
    this._holdemBucket = gate.bucket;
    return true;
  }

  /** CARDS10: a word to the room's Iliac table (sit, stand, commit, look - net/iliac/iliacTable.js validIliacIn), to a relay
   *  that deals it; false when it is not one, the word is bad or the gate is shut. */
  sendIliac(word) {
    const w = validIliacIn(word);
    if (!w || !this.iliacOk) return false;
    const gate = holdemGate(this._iliacBucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'iliac', ...w })) return false;
    this._iliacBucket = gate.bucket;
    return true;
  }

  /** KG5: a word to the room's King's Gambit table (sit, ready, unready, act, forfeit, stand, look - net/gambit/gambitTable.js
   *  validGambitIn), to a relay that runs it; false when it is not one, the word is bad or the gate is shut. */
  sendGambit(word) {
    const w = validGambitIn(word);
    if (!w || !this.gambitOk) return false;
    const gate = holdemGate(this._gambitBucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'gambit', ...w })) return false;
    this._gambitBucket = gate.bucket;
    return true;
  }

  /** DICE1: a roll ASKED of the relay (net/dice.js's spec) on the channel this socket's room is, or a party's (`ch`,
   *  the hub link, CHAT-CHAN's law). The relay rolls and says the result to the channel, this socket included - the
   *  receipt is the roll itself. False when nothing went: a spec the dice refuse, a relay that does not roll, the
   *  rate, or no open socket. */
  sendRoll(spec, { ch = null } = {}) {
    if (!validRollSpec(spec) || !this.rollOk) return false;
    if (ch != null && (!CHAT_LINE_CHANNELS.includes(ch) || !(ch === 'guild' ? this.guildOk : this.chanOk))) return false;   // GUILD1c
    const gate = rollGate(this._rollBucket, this._now());
    if (!gate.pass) return false;
    const frame = { t: 'roll', n: spec.n, m: spec.m, k: spec.k };
    if (!this._send(ch != null ? { ...frame, ch } : frame)) return false;
    this._rollBucket = gate.bucket;
    this.stats.rolls = (this.stats.rolls ?? 0) + 1;
    return true;
  }

  /** NAME-ADOPT: WHO THIS SESSION IS, as the account service issued it.
   *
   *  The relay takes the name out of the token and shows it to everybody
   *  else; this is the same answer, taken in for the player themselves.
   *  Without it the session kept the name it was BUILT with - the
   *  character's - and the chat roster, which draws my own row from this
   *  session, showed a name nobody else in the room could see.
   *
   *  Through the wire's own laws, as a peer's name and badge are: this
   *  is the service's word, and the service is trusted, but a name this
   *  side would refuse to draw for a stranger should not be drawn for
   *  me either. Answers whether anything changed.
   *  RENOWN1: and the Renown level the token was signed with (`level`), read through the wire's own bound.
   *  GUILD1c: and my guild's tag (`guild`), through the wire's own reader - a mint's answer that names none takes it off.
   *  WB9g: and my aura worn (`aura`), through the wire's own reader - an answer from a service before it says nothing.
   *  SEAT1c: and my seat title's claim (`ts`), read back beside the title it fits.
   *  SEASON1 part two: and my Season's banner ribbon (`ribbon`), through the wire's own reader - an answer from a service
   *  before it says nothing.
   *  LEGACY7: and my house (`house`, net/houseLaw.js), through the law's own reader - likewise.
   *  @param {{ name?: string, title?: string|null, glyphs?: string[], level?: number|null, guild?: string|null, aura?: string|null, icon?: string|null, ts?: number[]|null, ribbon?: number[]|null, house?: any }} [who] */
  adoptIdentity({ name, title, glyphs, level, guild, aura, icon, ts, ribbon, house } = {}) {
    let changed = false;
    if (typeof name === 'string' && name) {
      const n = sanitizeName(name);
      if (n !== this.name) { this.name = n; changed = true; }
    }
    const b = readBadge({ title, glyphs, ts });
    if (b.title !== (this.title ?? null)) { this.title = b.title; changed = true; }
    if ((b.ts ?? null)?.join('/') !== (this.ts ?? null)?.join('/')) { this.ts = b.ts ?? null; changed = true; }   // SEAT1c: my own seat title's claim
    if (b.glyphs.join('+') !== (this.glyphs ?? []).join('+')) { this.glyphs = b.glyphs; changed = true; }
    const lv = readRenown({ lv: level });
    if (lv !== (this.lv ?? null)) { this.lv = lv; changed = true; }
    if (guild !== undefined) { const gt = readGuildTag({ gt: guild }); if (gt !== (this.gt ?? null)) { this.gt = gt; changed = true; } }   // GUILD1c: an answer from a service before it says nothing
    if (aura !== undefined) { const au = readAura({ au: aura }); if (au !== (this.au ?? null)) { this.au = au; changed = true; } }   // WB9g: likewise
    if (icon !== undefined) { const pi = readIcon({ pi: icon }); if (pi !== (this.pi ?? null)) { this.pi = pi; changed = true; } }   // WITCH1: likewise
    if (ribbon !== undefined) { const rb = readRibbon({ rb: ribbon }); if (rb?.join('/') !== this.rb?.join('/')) { this.rb = rb; changed = true; } }   // SEASON1 part two: likewise
    if (house !== undefined) { const h = readHouse(house); if (JSON.stringify(h) !== JSON.stringify(this.house ?? null)) { this.house = h; changed = true; } }   // LEGACY7: likewise
    return changed;
  }
  /** SEASON1 part two (Seats-Arc 9.1): THE BANNER RIBBON A PLAYER WEARS, BY ID - mine, or a peer's in a room or introduced
   *  - its claim (heraldryLaw.js ribbonColours reads its two colours), or null for none. */
  ribbonOf(id) {
    if (id == null) return null;
    if (id === this.id) return this.rb ?? null;
    return (this.peers.get(id) ?? this._known.get(id))?.rb ?? null;
  }
  /** WB9g: THE AURA A PLAYER WEARS, BY ID - mine, or a peer's in a room or introduced - or null for none. */
  auraOf(id) {
    if (id == null) return null;
    if (id === this.id) return this.au ?? null;
    return (this.peers.get(id) ?? this._known.get(id))?.au ?? null;
  }
  /** WITCH1: THE PROFILE ICON A PLAYER WEARS, BY ID - mine, or a peer's in a room or introduced - or null (the face). */
  iconOf(id) {
    if (id == null) return null;
    if (id === this.id) return this.pi ?? null;
    return (this.peers.get(id) ?? this._known.get(id))?.pi ?? null;
  }

  /** RENOWN1: THE RENOWN A NAME WEARS, BY ID - mine, a peer's in a room, or one this session was introduced
   *  to - or null for none (a peer whose token named no character, an older build, a stranger). Beside `badgeOf`
   *  rather than inside it, so the chat's badge, which has no level, reads exactly what it always read. */
  renownOf(id) {
    if (id == null) return null;
    if (id === this.id) return this.lv ?? null;
    return (this.peers.get(id) ?? this._known.get(id))?.lv ?? null;
  }

  /** GUILD1c: THE GUILD TAG A NAME WEARS, BY ID - mine, a peer's in a room, or one this session was introduced to - or
   *  null for none (a peer in no guild, an older build, a stranger). `renownOf`'s shape. */
  guildTagOf(id) {
    if (id == null) return null;
    if (id === this.id) return this.gt ?? null;
    return (this.peers.get(id) ?? this._known.get(id))?.gt ?? null;
  }

  /** GUILD1c: CARRY A GUILD ORDER the account service signed when my character's guild moved (a founding, a join, a
   *  leaving, a disbanding - or the guild tab's look found it moved) into EVERY room I am in, so the tag beside my name
   *  moves there now and the hub routes the guild's chat to me, or no longer does. RENOWN1's carrier, simpler because
   *  the relay's rule is simpler (NEWEST WINS - the room answers an order it has already heard with what it holds, and a
   *  removal it holds is a no-op again): the page KEEPS the order for GUILD_ORDER_KEEP_MS, and it goes down each socket
   *  once that socket's own welcome has named a relay that knows the frame - one guild frame a socket every
   *  GUILD_SEND_MS, wider than the relay's own gate (one a second, `guild` and `guildout` together) so two frames the
   *  wire bunched are not one the relay drops - and ONCE MORE after GUILD_RESEND_MS, for the one it dropped anyway:
   *  a repeat costs the room nothing. A socket welcomed later gets it on its welcome; a newer order replaces the one
   *  held. Answers whether it went down any socket now. */
  sendGuildOrder(order) { return this._holdGuild('guild', order); }
  /** GUILD1c: CARRY A GUILD-OUT ORDER - a member I removed, or the guild I disbanded - to the room this session holds;
   *  the host hands it to the hub link, the one room every online player holds a socket to. Kept and sent as a guild
   *  order is, AHEAD of one, since it is what closes the guild's chat to somebody else. */
  sendGuildOut(order) { return this._holdGuild('guildout', order); }
  _holdGuild(t, order) {
    if (typeof order !== 'string' || !order || order.length > 1024) return false;
    const now = this._now();
    const held = { t, frame: JSON.stringify({ t, order }), until: now + GUILD_ORDER_KEEP_MS, sent: new WeakMap() };   // socket -> { n, at }: how often it went down that socket, and when first
    // a newer guild order replaces the one held (the relay would answer the older with what it holds); a guild-out is
    // about somebody else, so each is kept, first in line
    this._gdHeld = t === 'guild' ? [...this._gdHeld.filter((h) => h.t !== 'guild'), held] : [held, ...this._gdHeld];
    return this._flushGuild(now) > 0;
  }
  /**
   * QUEST-HOME: CARRY A HOME ORDER the account service signed when my act moved a home (a claim, a deed held or sold, a
   * hall, an arena move, a sale, a character deleted - the host's ear for the service's answers hands each, scenes/world.js) to the hub, the one
   * room every online player holds a socket to, whose fan tells every page online. GUILD1c's carrier, on the hub socket
   * alone: KEPT for HOME_ORDER_KEEP_MS, sent once the hub's welcome names a relay that knows the frame, one frame every
   * GUILD_SEND_MS, and ONCE MORE after GUILD_RESEND_MS - the hub holds a word once, so a repeat costs it nothing. Answers
   * whether it went down now.
   */
  sendHomeOrder(order) {
    if (typeof order !== 'string' || !order || order.length > 1024) return false;
    const now = this._now();
    this._hmHeld.push({ frame: JSON.stringify({ t: 'home', order }), until: now + HOME_ORDER_KEEP_MS, n: 0, at: -Infinity });
    return this._flushHome(now) > 0;
  }
  /** QUEST-HOME: the held home orders down the hub socket - on its welcome, on a new order and on each tick. Answers how
   *  many went down. */
  _flushHome(now = this._now()) {
    this._hmHeld = this._hmHeld.filter((h) => now < h.until && h.n < 2);   // past it the hub would refuse it; twice is enough
    if (!this._hmHeld.length || !this.homeOk || this.status !== 'open' || !this._ws || !isSocialRoom(this.room)) return 0;
    if (now - this._hmAt < GUILD_SEND_MS) return 0;
    const h = this._hmHeld.find((x) => x.n === 0) ?? this._hmHeld.find((x) => x.n === 1 && now - x.at >= GUILD_RESEND_MS);
    if (!h) return 0;
    try { this._ws.send(h.frame); this.stats.sent++; } catch { return 0; }
    this._hmAt = now; h.n++; h.at = now;
    return 1;
  }
  /** GUILD1c: a socket's guild state - its own welcome's word on the frames, and its own gate - made fresh with it. */
  _gdOf(ws) {
    let st = this._gdSock.get(ws);
    if (!st) this._gdSock.set(ws, st = { ok: false, at: -Infinity });
    return st;
  }
  /** GUILD1c: the held orders down every socket that has not had them - on its welcome, on a new order and on each
   *  tick; one frame a socket every GUILD_SEND_MS, each frame twice at most (the second GUILD_RESEND_MS after the
   *  first). Answers how many sockets a frame went down. */
  _flushGuild(now = this._now()) {
    this._gdHeld = this._gdHeld.filter((h) => now < h.until);   // past it the relay would refuse it: the next hello carries the guild
    if (!this._gdHeld.length) return 0;
    let went = 0;
    const down = (ws, open) => {
      if (!ws || !open) return;
      const st = this._gdOf(ws);
      if (!st.ok) return;   // no word yet that this relay knows the frame - an older one closes the socket on it
      if (now - st.at < GUILD_SEND_MS) return;
      const h = this._gdHeld.find((x) => !x.sent.has(ws))
        ?? this._gdHeld.find((x) => x.sent.get(ws).n === 1 && now - x.sent.get(ws).at >= GUILD_RESEND_MS);
      if (!h) return;
      try {
        ws.send(h.frame); this.stats.sent++; st.at = now; went++;
        const was = h.sent.get(ws);
        h.sent.set(ws, { n: (was?.n ?? 0) + 1, at: was?.at ?? now });
      } catch { /* the close will say */ }
    };
    down(this._ws, this.status === 'open');
    for (const [, h] of this._halo) down(h.ws, h.status === 'open');
    return went;
  }

  /** RENOWN1: carry a renown order the account service signed when my own level rose into EVERY room I am in - the cell
   *  and the halo alike, since whoever can see me reads the level beside my name - and take the level as mine. Answers
   *  whether it went down any socket now; the next room's token carries the level either way.
   *
   *  AUDIT RENOWN1 WIRE-2/WIRE-3: IT WAS SENT ONCE, and a rise often never reached every room. The one send went only
   *  down sockets 'open' at that moment, behind one gate for the whole session - two rises inside a second lost the
   *  second (the room stayed at 9 while the page said 11), a halo still minting its token was skipped and then said
   *  hello with the old level, and a relay one version behind heard the frame on a socket whose welcome had not come
   *  yet (the session-wide flag was the LAST relay's word) and closed it. Now the page KEEPS the newest order for its
   *  life (RENOWN_ORDER_KEEP_MS) and each socket is its own: an order goes down a socket once ITS OWN welcome has
   *  named a relay that knows the frame, on ITS OWN gate, and again every RENOWN_RESEND_MS until that room answers
   *  with my level - the relay's echo (a rise, fanned) or its word that the room already holds as much (not a rise,
   *  said to the carrier alone). A socket that opens later gets it on its welcome; one whose gate is spent gets it on
   *  a tick. */
  sendRenownOrder(order, lv = null) {
    const level = readRenown({ lv });
    if (level !== null && level > (this.lv ?? 0)) this.lv = level;   // AUDIT RENOWN1: my own level only rises in a session
    if (typeof order !== 'string' || !order || order.length > 1024 || level === null) return false;
    if (!this._rnOrder || level >= this._rnOrder.lv) this._rnOrder = { order, lv: level, until: this._now() + RENOWN_ORDER_KEEP_MS };
    return this._flushRenown(this._now()) > 0;
  }

  /** AUDIT RENOWN1 WIRE-2: a socket's renown state, made fresh with the socket (a WeakMap on the socket itself, so a
   *  halo promoted to the primary, or the primary demoted to a halo, keeps its own). */
  _rnOf(ws) {
    let st = this._rnSock.get(ws);
    if (!st) this._rnSock.set(ws, st = { ok: false, lv: 0, sent: 0, at: -Infinity, bucket: null });
    return st;
  }

  /** AUDIT RENOWN1 WIRE-2: the held order down every socket whose room has not confirmed it - on the socket's own
   *  welcome, on a new order and on each tick. Answers how many sockets it went down. */
  _flushRenown(now = this._now()) {
    const o = this._rnOrder;
    if (!o) return 0;
    if (!(now < o.until)) { this._rnOrder = null; return 0; }   // the relay would refuse it now; the next hello carries the level
    const frame = JSON.stringify({ t: 'renown', order: o.order });
    let went = 0;
    const down = (ws, open) => {
      if (!ws || !open) return;
      const st = this._rnOf(ws);
      if (!st.ok || st.lv >= o.lv) return;   // no word yet that this relay knows the frame, or the room has the level
      if (st.sent >= o.lv && now - st.at < RENOWN_RESEND_MS) return;   // this order went and has not been answered YET
      const gate = renownGate(st.bucket, now);
      if (!gate.pass) return;
      try { ws.send(frame); this.stats.sent++; st.bucket = gate.bucket; st.at = now; st.sent = o.lv; went++; } catch { /* the close will say */ }
    };
    down(this._ws, this.status === 'open');
    for (const [, h] of this._halo) down(h.ws, h.status === 'open');
    return went;
  }

  /** CHAT-FIT (2026-09-22, Mac: "Glyphs should also show on chat names in the chat itself"): THE BADGE A NAME
   *  WEARS, BY ID - mine (the service's word, adopted above), a peer's in the room, or a peer's this session was
   *  introduced to and has since lost: the chat keeps two hundred lines and the room keeps people only while they
   *  stand in it, so a line said ten minutes ago by someone who left is still signed. Null for a stranger - a line
   *  whose author this session never met wears no badge rather than a guessed one. The chat panel asks through the
   *  host (ui/chatPanel.js `badgeOf`), the way it asks the social picture for a name's colour.
   *  @param {string|null|undefined} id
   *  LEGACY7: and the house (net/houseLaw.js - `{ hn, hc?, hb?, hg? }`), absent for none.
   *  @returns {{ title: string|null, glyphs: string[], gt: string|null, house?: any }|null} */
  badgeOf(id) {
    if (id == null) return null;
    // GUILD1c: and the guild's tag, beside the name in a chat line as it is over a head
    if (id === this.id) return { title: this.title ?? null, glyphs: Array.isArray(this.glyphs) ? this.glyphs : [], gt: this.gt ?? null, ...(this.house ? { house: this.house } : {}) };
    const p = this.peers.get(id) ?? this._known.get(id);
    return p ? { title: p.title ?? null, glyphs: Array.isArray(p.glyphs) ? p.glyphs : [], gt: p.gt ?? null, ...(p.house ? { house: p.house } : {}) } : null;
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

  /** TITLE-N: THE DUNGEON MASTER'S LINE, asked of the relay - sendRed's law exactly. Not guarded by who I am: whether
   *  this player may is their TOKEN's `dm` glyph, which only the relay can verify, and it ignores anybody else in
   *  silence. Sent only to a relay that carries it (an older one closes the socket on the frame); a line refused here
   *  stays in the field. */
  sendDm(text) {
    const line = sanitizeChat(text);
    if (!line || !this.dmOk) return false;
    const gate = dmGate(this._dbucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'narrate', text: line })) return false;
    this._dbucket = gate.bucket;
    return true;
  }

  /** EVENT1: stage a live event for everyone online (`kind` one of LIVE_EVENTS), or end the one staged ('') - asked of
   *  the HUB alone, the one room every online player holds, and of a relay that knows the frame (an older one CLOSES
   *  the socket on it). Whether this player may is the relay's question, asked of the token; a refusal is silence. */
  sendStage(kind) {
    if (kind !== '' && !LIVE_EVENTS.includes(kind)) return false;
    if (kind !== '' && !relayKnowsLiveEvent(this.eventV, kind)) return false;   // SUNBABY1: a word this relay does not know closes the socket
    if (!this.eventOk || !isSocialRoom(this.room ?? '')) return false;
    const gate = eventGate(this._ebucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'stage', kind })) return false;
    this._ebucket = gate.bucket;
    return true;
  }

  /** EVENT1: the one door the live event changes through - said once per change, so a repeat welcome says nothing. */
  _setEvent(ev, live) {
    const cur = this.liveEvent;
    if (cur === ev || (cur && ev && cur.kind === ev.kind && cur.at === ev.at)) return;
    this.liveEvent = ev;
    this._deliver('event', () => this.onEvent?.(ev, { live }));
  }

  /** MOD1: carry a mute order the account service signed into this
   *  room. The room checks the signature; this checks only that there is
   *  one to carry, and the rate, as the relay will. False when nothing went. */
  sendMuteOrder(order) {
    if (typeof order !== 'string' || !order || order.length > 1024) return false;
    const gate = muteGate(this._mbucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'mute', order })) return false;
    this._mbucket = gate.bucket;
    return true;
  }

  /** SAFE4: carry a ban order the account service signed into this room - MOD1's carrier, on the mute order's meter (the
   *  relay spends one bucket for both). False when nothing went. */
  sendBanOrder(order) {
    if (typeof order !== 'string' || !order || order.length > 1024) return false;
    // AUDIT SAFE RELAY-3: only to a relay that knows the frame (world215, BAN_RELAY_MIN) - an older one CLOSES the socket on
    // a frame type it does not know (CLOSE_POLICY, terminal here): a moderator's ban took the channel down with it
    if (!this.banOk) return false;
    const gate = muteGate(this._mbucket, this._now());
    if (!gate.pass) return false;
    if (!this._send({ t: 'ban', order })) return false;
    this._mbucket = gate.bucket;
    return true;
  }

  /** LEASE1 (net/roomLease.js): my hub's lease, kept for this session's lease rooms - its own and each halo's. Nothing goes
   *  now: each lease room's socket hands it just ahead of the next frame it sends there (`_leased`), so a room where I do
   *  nothing is woken by nothing (mob's load check, 07:57Z: "if we affected server performasnce" - every room a player
   *  stood idle in was woken every LEASE_MS). KEPT WHEREVER I STAND (a review of the PR: one that came while I stood in a
   *  dungeon's floor, a gate or my home, or before this socket's welcome, was thrown away, and the next lease room heard
   *  nothing of me until the hub's next) - `_leased` hands it on only in a lease room of a relay that knows the frame.
   *  False when this session takes none now. */
  sendLease(l) {
    if (typeof l !== 'string' || !l) return false;
    this._lease = l;
    this._leaseAt = this._now();
    return this.leaseOk && (leaseRoom(this.room) || [...this._halo.keys()].some(leaseRoom));
  }

  /** LEASE1: a second lane of mine (net/sailingCabinLink.js - no hub link hands it one) takes my session's lease, as old
   *  as it is (the third review: the cabin lane was bound and never leased, so with the door on its boat went unheard). */
  leaseFrom(s) {
    if (typeof s?._lease === 'string' && s._leaseAt > this._leaseAt) { this._lease = s._lease; this._leaseAt = s._leaseAt; }
  }

  /** LEASE1: a lease room's socket, made to hand my newest lease on just ahead of the first frame it sends after that lease
   *  came - a ping, a hello and a lease itself excepted - and never twice. Every frame a room hears from me rides behind a
   *  lease it holds (with the door on, a bound socket with no live lease is heard in nothing); a socket that sends nothing
   *  hands nothing; a lease held past LEASE_HELD_MS is handed on nowhere; and a newer lease waits LEASE_HAND_MIN_MS from the
   *  last one this socket handed, for the frame after (the third review: the room's meter dropped one handed sooner, and
   *  this socket counted it handed, so its live lease lapsed in the room). */
  _leased(ws, room) {
    if (!ws || !leaseRoom(room) || typeof ws.send !== 'function') return ws;
    const send = ws.send.bind(ws);
    let handed = null, handedAt = -Infinity;
    ws.send = (s) => {
      const now = this._now();
      const l = now - this._leaseAt < LEASE_HELD_MS ? this._lease : null;
      if (l && l !== handed && now - handedAt >= LEASE_HAND_MIN_MS && this.leaseOk && this._welcomed.has(ws) && typeof s === 'string' && !LEASE_QUIET_RE.test(s)) { handed = l; handedAt = now; send(JSON.stringify({ t: 'lease', l })); }
      return send(s);
    };
    return ws;
  }

  /** SCALE5b: a relay setting (net/relayCfg.js) to the hub - its answer comes back through `onRelayCfg`. False when this
   *  session is not the hub's, its relay takes none, or the setting is not one. */
  sendRelayCfg(frame) {
    if (!this.relayCfgOk || !isSocialRoom(this.room)) return false;
    const m = validRelayCfgIn(frame);
    return !!m && this._send({ t: 'cfg', ...m });
  }

  /** SCALE5c (Mac's decision 2): a search of everyone online by name, down the hub link - its answer comes back through
   *  `onFound`. False when this session is not the hub's, its relay answers no search, or the search is no search.
   *  AUDIT SCALE II C-1: THE RELAY'S WORD FIRST (`findOk`, its welcome's). The site deploys before the relay, or hours
   *  apart from it, or the relay rolls back: a relay before the shards parses `find` as an unknown message and closes the
   *  hub link 1008, which is terminal - no friends, no party, no world chat until the rejoin's wait. */
  sendFind(q) {
    if (!this.findOk || !isSocialRoom(this.room) || typeof q !== 'string') return false;
    const t = q.trim().slice(0, HUB_FIND_Q_MAX);
    this._boxAsks.delete(t);   // CHAT-FIND-HUB: a /find of the box's own query - its answer is said as a line
    return !!t && this._send({ t: 'find', q: t });
  }
  /** CHAT-FIND-HUB (2026-10-15, Mac: "player search isnt working properly. Even in world tab I try to search for someone
   *  and they can't be found cause it only shows like 25 ppl out of 600"): THE SEARCH BOX ASKS THE HUB. Past
   *  CHAT_ROSTER_MAX online the hub lets `hubOnline` go (sendHubWho) and this link knows its own shard alone, so the box -
   *  which filters what this client knows (CHAT-FIND-ALL) - found nobody on the other fifteen. Asked of the hub's own
   *  search (`find`, /find's) while the box holds a query and this link knows fewer than are online: once a query moves,
   *  again when its answer is HUB_FIND_FRESH_MS old, never closer than HUB_FIND_ASK_MS (the relay drops a search past its
   *  bucket and closes a socket that keeps on). The answer is `hubFound`, never a line. '' (the box cleared) lets the
   *  answer go. A '#' query is a tag, which the hub does not search. False when not asked. */
  askFind(q) {
    const t = String(q ?? '').trim().toLowerCase().slice(0, HUB_FIND_Q_MAX).trim();
    if (!t) { this.hubFound = null; return false; }
    if (t.startsWith('#') || !this.findOk || !isSocialRoom(this.room) || !this._ws || !this._welcomed.has(this._ws)) return false;
    if (this.roomCount == null || this.roomCount <= this.peers.size + this.hubOnline.size + 1) return false;   // everyone is known here: the box filters them
    const now = this._now();
    if (now - this._boxAskAt < HUB_FIND_ASK_MS) return false;
    if (this.hubFound?.q === t && now - this.hubFound.at < HUB_FIND_FRESH_MS) return false;
    for (const [k, at] of this._boxAsks) if (now - at >= HUB_FIND_FRESH_MS) this._boxAsks.delete(k);   // an ask the relay dropped is never answered
    if (this._boxAsks.has(t)) return false;   // asked, the answer on its way
    if (!this._send({ t: 'find', q: t })) return false;
    this._boxAskAt = now;
    this._boxAsks.set(t, now);
    return true;
  }
  /** SCALE5c (Mac's decision 2): everyone online on every shard - asked at most every HUB_WHO_MS by a hub link on a
   *  shard (the World tab asks while it is drawn), and only while the hub's count is no more than a roster says
   *  (CHAT_ROSTER_MAX); past it the list is let go. The answer is `hubOnline`. False when not asked. */
  sendHubWho() {
    if (!isChannelShard(this.room) || !this._ws || !this._welcomed.has(this._ws)) return false;   // part two: a region's link too (the Region tab's list)
    if (this.roomCount != null && this.roomCount > CHAT_ROSTER_MAX) { if (this.hubOnline.size) this.hubOnline = new Map(); return false; }
    const now = this._now();
    if (now - this._hubWhoAt < HUB_WHO_MS) return false;
    this._hubWhoAt = now;
    return this._send({ t: 'find', all: 1 });
  }
  /** SCALE5c: who of my guild is online on every shard - asked at most every HUB_GUILD_WHO_MS (the Guild tab asks while
   *  it is drawn); the answer is `guildOnline`. False when not asked.
   *  AUDIT SCALE II C-1: and only of a relay that answers it (`findOk`) - the Guild tab asks every frame it is drawn, so
   *  on a relay before the shards the hub link was closed, rejoined and closed again for as long as the tab stood open. */
  sendGuildWho() {
    if (!this.findOk || !isSocialRoom(this.room) || !this._ws || !this._welcomed.has(this._ws)) return false;   // after the welcome: a frame before the hello's answer is junk
    const now = this._now();
    if (now - this._guildWhoAt < HUB_GUILD_WHO_MS) return false;
    this._guildWhoAt = now;
    return this._send({ t: 'find', g: 1 });
  }

  /** Exact destinations use only the updated, authenticated global hub. */
  sendStaffTeleport(frame) {
    if (!this.staffTeleportOk || !isSocialRoom(this.room)) return false;
    const m = validStaffTeleportIn(frame);
    return !!m && this._send({ t: 'stp', ...m });
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
    if (shaped.k === 'party.lead' && !this.partyLeadOk) return false;   // PARTY-LEAD: an older hub closes the socket on an act it does not know
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
  sendParty(p, { force = false, urgent = false } = {}) {
    if (!this.acct) return false;
    const pose = validPartyPose(p);
    if (!pose) return false;
    const now = this._now();
    const s = JSON.stringify(pose);
    // STAFF-PANEL5-FOLLOW (design doc "DFO Staff Panel: design", Invisible follow): OUTSIDE A PARTY (`solo`, the host's word)
    // the pose is my WHERE NOTE, which the hub keeps for staff alone - a changed one WHERE_NOTE_MOVING_MS after the last,
    // the same one again WHERE_NOTE_STILL_MS after it (net/staffFollow.js whereNoteDue), and none to a relay before the
    // follow (it would write each one at once for nobody)
    if (this.solo) { if (!this.followOk || !whereNoteDue(now, this._lastPartyAt, this._lastParty !== s)) return false; }
    // PARTY-PING: a ping skips the floor (the marker is a moment) and still spends partyGate. `force` does not.
    else if (!urgent && now - this._lastPartyAt < PARTY_SEND_MS) return false;
    else if (!urgent && !force && this._lastParty === s) return false;
    const gate = partyGate(this._pbucket, now);
    if (!gate.pass) return false;
    if (!this._send({ t: 'party', p: pose })) return false;
    this._pbucket = gate.bucket; this._lastParty = s; this._lastPartyAt = now; this.stats.parties++;
    return true;
  }

  /** TV3: MY TRAVELLER MARK, to my region's room (systems/travellerMarks.js says when) - or null, which takes it out
   *  (indoors, or hidden). Only through a relay that knows the frame, only in a region's channel, and never sooner than
   *  TRAV_SEND_MIN_MS after the last. False when nothing went (the host asks again the next frame). */
  sendTraveller(p) {
    if (!this.travOk || !isRegionRoom(this.room)) return false;
    // OW-CHASE-RANGE: the mark's chase words beside it (`bd`, `sr` - never keys of the mark: AUDIT OW-REVISITED L4-1), each
    // said only as the door will take it - one it would refuse goes unsaid, never the mark with it (L4-9)
    const { bd, sr, ...rest } = p ?? {};
    const mark = p === null ? null : validTravellerMark(rest);
    if (p !== null && !mark) return false;
    const words = {};
    if (mark) for (const [k, w] of [['bd', bd], ['sr', sr]]) { const ok = w?.length ? validTravWords({ [k]: w }, mark) : null; if (ok?.[k]) words[k] = ok[k]; }
    const now = this._now();
    // AUDIT DEEP X-8: a CLEAR goes at once (the relay takes it past the cooldown, one a mark) - the floor is the marks'
    // alone, measured from the last MARK, so the next mark after a clear still waits it out
    if (mark && now - this._lastTravAt < TRAV_SEND_MIN_MS) return false;
    if (!this._send({ t: 'trav', p: mark, ...words })) return false;
    if (mark) this._lastTravAt = now;
    this.stats.travellers = (this.stats.travellers ?? 0) + 1;
    return true;
  }
  /** TV3: how many others share my room - the roster's count when the welcome cut it, else the members held. Zero is
   *  ALONE: a traveller alone in a region sends no mark (the cost law, systems/travellerMarks.js). */
  get othersHere() {
    if (this.roomCount != null) return Math.max(0, this.roomCount - 1);
    return this._rooms.get(this.room)?.size ?? 0;
  }

  /** QUEST1: sharing an accepted quest with the party - systems/quest/questShare.js's own envelope
   *  ({questName, displayName, data}, prepareQuestShare's own shape), sent as-is; the hub resolves "my party" on its
   *  own (the same roster the party pose view already reads), so nothing here names a target. A deliberate,
   *  one-off click, never a stream - QUEST_SEND_MS is the client's own floor beside the hub's own cooldown at half of
   *  it (questShareGate, QUEST_HUB_MIN_MS), the same belt-and-suspenders relationship PARTY_SEND_MS/partyGate already keep.
   *  AUDIT 68 S14-quest-client-gate-redundant: the floor alone - a copy of the hub's cooldown here passed whenever it did. */
  /** @param {{questName?: string, displayName?: string, data?: object}} [share] */
  shareQuest(share = {}) {
    const { questName, displayName, data } = share;
    if (!this.acct) return false;
    if (typeof questName !== 'string' || !questName || !data || typeof data !== 'object') return false;
    const now = this._now();
    if (now - this._lastQuestShareAt < QUEST_SEND_MS) return false;
    const quest = { questName, displayName: typeof displayName === 'string' ? displayName : '', data };
    if (!this._send({ t: 'quest', quest })) return false;
    this._lastQuestShareAt = now; this.stats.questShares = (this.stats.questShares ?? 0) + 1;
    this._questSent = { quest, at: now };
    return true;
  }

  /** PARTY-MAP (2026-09-30, Discord: "share map data between party members"): SHARED CARTOGRAPHY's send - the
   *  automap rows I revealed in dungeon `k` since my last send (systems/party/partyMap.js gathers them), to the hub, which
   *  fans them to my party alone. A background batch, never a click: AMAP_SEND_MS is the client's floor beside the
   *  hub's own cooldown at half of it (amapShareGate), and a relay that does not know the frame is never sent one. */
  shareAutomap(k, r) {
    if (!this.acct || !this.amapOk) return false;
    const body = amapBody({ k, r });
    if (!body) return false;
    const now = this._now();
    if (now - this._lastAmapAt < AMAP_SEND_MS) return false;
    if (!this._send({ t: 'amap', ...body })) return false;
    this._lastAmapAt = now; this.stats.amapShares = (this.stats.amapShares ?? 0) + 1;
    return true;
  }

  /** The one door back for a session nothing else re-joins (AUDIT CHAT A6/B4/B6): a channel never changes
   *  rooms, so a page's goodbye (leave) or a terminal close would otherwise hold for the life of the page.
   *  Joins `room` at once after a leave, and once `afterMs` has passed since a terminal close; false when
   *  the session is fine or the wait is not up. */
  rejoin(room, afterMs) {
    if (this.superseded) return false;   // ONE-SEAT: a superseded session waits for its player, never for a clock
    if (this.barred) return false;   // AUDIT SAFE CLIENT-2: a banned one waits for the ban's lifting, never for a clock (CHAT_REJOIN_MS brought every channel back)
    if (this.room && !this.terminal) return false;
    // SCALE2: THE WAIT IS JITTERED, once a terminal close - anywhere in [afterMs/2, 3afterMs/2). It was the same thirty
    // seconds for everyone, so a relay that closed every channel at once had every tab's channels back in one second.
    if (this.terminal && this._rejoinFor !== this.terminalAt) { this._rejoinFor = this.terminalAt; this._rejoinFactor = 0.5 + this._rand(); }
    if (this.terminal && this._now() - (this.terminalAt ?? 0) < afterMs * (this._rejoinFactor ?? 1)) return false;
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

  /** CHAT-G + CHAT-CHAN: a line coming in (a chat line, a roll) through the gate the relay's own spend is: the room's
   *  (CHAT_ROOM_HZ_MAX) - or the parties' (PARTY_CHAT_ROOM_HZ_MAX) for a party's line, which the hub budgets apart - so an
   *  honest relay at both budgets' full tilt passes whole, and the first line refused is one no honest relay would have
   *  sent. The relay a client talks to is the player's choice; net/chat.js keeps CHAT_KEEP lines, so an ungated stream
   *  is a player's history deleted. Said on the console once. */
  _lineIn(room, ch, now) {
    // GUILD1c: a guild's line on the guilds' own budget, as a party's on the parties'
    const g = ch === 'party' ? partyChatInGate(this._inPartyChat, now) : ch === 'guild' ? guildChatInGate(this._inGuildChat, now) : chatInGate(this._inChat.get(room), now);
    if (ch === 'party') this._inPartyChat = g.bucket; else if (ch === 'guild') this._inGuildChat = g.bucket; else this._inChat.set(room, g.bucket);
    if (g.pass) return true;
    this.stats.chatsDropped++;
    if (!this._inChatSaid) {
      this._inChatSaid = true;
      console.warn(`[online] ${ch ? `${ch} chat` : 'chat'} from ${room} is arriving faster than ${ch === 'party' ? PARTY_CHAT_ROOM_HZ_MAX : ch === 'guild' ? GUILD_CHAT_ROOM_HZ_MAX : CHAT_ROOM_HZ_MAX}/s - lines are being dropped. An honest relay does not do this.`);
    }
    return false;
  }

  /** AUDIT SAFE RELAY-2: the relay's word on my own chat (`law`, `banned`, `muted`, `slowed`) through its own bucket per room
   *  (LAW_IN_HZ_MAX) - an honest relay's at full tilt passes whole, whatever its channel's lines are doing. */
  _lawIn(room, now) {
    const g = tokenGate(this._inLaw.get(room) ?? null, now, LAW_IN_HZ_MAX, LAW_IN_BURST);
    this._inLaw.set(room, g.bucket);
    if (!g.pass) this.stats.chatsDropped++;
    return g.pass;
  }

  /** A frame one peer addressed to ME (a trade, a cast, a card, a page): never my own back, gated coming in PER SENDER
   *  (AUDIT DROPS B3 - one bucket for every sender together let two flooders crowd out my partner's trade commit, whose
   *  goods were already gone; the map forgets every sender past TRADE_IN_SENDERS_MAX), said once a kind on the console,
   *  projected by the wire's own law and delivered only when it names me. AUDIT 68 S14-inbound-directed-gate-dup: one
   *  door - the four arms were one block copied four times. */
  _directedIn(m, now, kind, buckets, gate, hz, valid, deliver) {
    if (typeof m.id !== 'string' || m.id === this.id) return;
    if (buckets.size > TRADE_IN_SENDERS_MAX) buckets.clear();
    const g = gate(buckets.get(m.id) ?? null, now);
    buckets.set(m.id, g.bucket);
    if (!g.pass) {
      if (!this._inDirectedSaid.has(kind)) { this._inDirectedSaid.add(kind); console.warn(`[online] ${kind} frames are arriving faster than ${hz}/s - frames are being dropped.`); }
      return;
    }
    // AUDIT SAFE CLIENT-7: a request from an account I blocked never lands - a trade, a card, a page, a duel, a wedding (the
    // sender's account as the relay verified it). A cast and the open zone's blows are a fight's, never a request: a
    // block that dropped them would let the blocked strike unanswered
    if (this.hears && BLOCKED_KINDS.includes(kind)) { const sub = subOf(m); if (sub && !this.hears(sub)) return; }
    const d = valid(m.data);
    if (d && d.to === this.id) this._deliver(kind, () => deliver(m.id, d));
  }

  _receive(data, room = this.room) {
    // AUDIT SOC B20: a frame wider than an honest relay's widest (net/wire.js INBOUND_FRAME_MAX) is dropped UNPARSED -
    // the parse of a relay's megabytes was the one cost no door below could bound, and the relay is the player's choice
    if (typeof data === 'string' && data.length > INBOUND_FRAME_MAX) { this.stats.oversize++; return; }
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'poses') { this._poses(m, room); return; }   // SCALE5b: the second wire's batch of poses
    if (m.t === 'fb') { this._batch(m, room); return; }      // SCALE5b: and of frames
    this._frame(m, room);
  }

  /** SCALE5b: THE SECOND WIRE'S BATCH OF POSES (wire.js POSE_BATCH_MS) - each entry `[id, slim pose]` read as the one
   *  `pose` frame it stands for, through the one door every pose comes in by (validPose fills back what the slim pose
   *  left out), at most `max` of them; answers how many it took. */
  _poses(m, room, max = WIRE2_BATCH_MAX) {
    const l = Array.isArray(m.l) ? m.l : [];
    let i = 0;
    for (; i < l.length && i < max; i++) {
      const e = l[i];
      if (Array.isArray(e)) this._frame({ t: 'pose', id: e[0], p: e[1] }, room);   // the pose arm's own law reads the rest (validPose, the id's type)
    }
    return i;
  }

  /** SCALE5b: THE SECOND WIRE'S BATCH OF FRAMES (wire.js wire2Batch) - what the room said this socket in its order: each
   *  frame read as if it came alone, a run of poses as its `poses` frame, WIRE2_BATCH_MAX of them all told and no batch
   *  within a batch. */
  _batch(m, room) {
    const f = Array.isArray(m.f) ? m.f : [];
    let left = WIRE2_BATCH_MAX;
    for (let i = 0; i < f.length && left > 0; i++) {
      const x = f[i];
      if (!x || typeof x !== 'object') { left--; continue; }
      if (x.t === 'poses') left -= Math.max(1, this._poses(x, room, left));
      else { left--; if (x.t !== 'fb') this._frame(x, room); }
    }
  }

  /** A frame read: what the room said, by its kind. SCALE5b: parsed by `_receive`, or one entry of a batch. */
  _frame(m, room = this.room) {
    this.stats.received++;
    const now = this._now();
    const primary = room === this.room;   // WORLD6b-iii(b): a halo room's frames place its peers and carry a peer's foes and blows; the host, the clock and the memory are my own room's alone
    if (m.t === 'welcome') {
      if (primary) this._shardMiss = 0;   // SCALE5c: a room that welcomes is a room the relay keeps
      this.welcomes++;   // AUDIT HCC-PARK (client C4)
      { const ws = primary ? this._ws : this._halo.get(room)?.ws; if (ws) this._welcomed.add(ws); }   // SD-HELLO: this socket may say more than its hello now
      // SCALE5d: the layer of the place this socket stands in - the primary's is mine (my party is told it), a halo's kept
      // with it, so a crossing that promotes it carries its layer
      { const ly = isLayered(room) && Number.isInteger(m.ly) && m.ly > 0 && m.ly < LAYERS_MAX ? m.ly : 0; if (primary) { this.layer = ly; this._layerRoom = room; } else { const h = this._halo.get(room); if (h) h.ly = ly; } }
      if (primary) this.claim = false;   // ONE-SEAT: the hub took the claim - a reconnect from here on is a reconnect
      // SLAM12 (AUDIT SLAM): THE BACKOFF IS RESET HERE, BY THE WELCOME, AND NOT BY THE SOCKET OPENING. A full room's
      // CLOSE_BUSY arrives AFTER the socket opens (the relay's hello gate), so a reset at `onopen` undid the hard
      // back-off CLOSE_BUSY had just set: a client against a busy room retried at a fixed 2500 ms for ever, and the
      // doubling SLAM2 was written for never happened in the one case it was written for. A welcome is the relay
      // saying yes; that is when the retry ladder starts over.
      if (primary) this._backoff = BACKOFF_MIN_MS; else { const h = this._halo.get(room); if (h) h.backoff = BACKOFF_MIN_MS; }
      this._retire(primary ? this._ws : this._halo.get(room)?.ws);   // AURA-LIVE: welcomed - the socket it replaced goes (the relay has closed it already)
      // SRV-N: WHICH RELAY IS THIS. Read ABOVE the `primary` gate below on purpose - a halo room's welcome comes off
      // the same Worker as my own room's, and a chat channel's welcome is the only one a chat link ever gets, so
      // gating this on the primary room would have made the chat's own sessions blind to the restart that just
      // dropped them. A relay before this slice carries no `v` at all and is left alone (updateNotice.js: 'unknown').
      // AUDIT-SRVN F1: through the wire's own law, like every other field
      // a welcome carries - a relay is the PLAYER'S choice (`?server=`,
      // the menu's Relay field), so its deploy name is not our word.
      const relayV = relayVersionOf(m.v);
      if (primary) this.foeInventoryOk = relaySupportsFoeInventory(relayV);
      if (primary) { this.seatLiveOk = relaySupportsSeatLive(relayV); this._seatHeardAt = this._now(); }   // SEAT-LIVE: the welcome is the seat's word
      else { const h = this._halo.get(room); if (h) h.foeInventoryOk = relaySupportsFoeInventory(relayV); }
      if (relayV) this._deliver('relay', () => this.onRelay?.(relayV));
      if (primary) this.tradeOk = relaySupportsTrade(relayV);   // TRADE1
      if (primary) this.castOk = relaySupportsCast(relayV);   // AUDIT ALLY-CAST B1
      if (primary) this.chanOk = relaySupportsChannels(relayV);   // CHAT-CHAN
      if (primary) this.langOk = relaySupportsLang(relayV);   // CHAT-LANG
      if (primary) this.tradeChanOk = relaySupportsTradeChan(relayV);   // CHAT-TRADE
      if (primary) this.rollOk = relaySupportsRoll(relayV);   // DICE1
      if (primary) { this.holdemOk = relaySupportsHoldem(relayV); this.holdemWelcomes++; }   // CARDS5; AUDIT CARDS-3 B1: a new welcome is a new socket - the relay stood the old one up
      if (primary) this.gambitOk = relaySupportsGambit(relayV);   // KG5: and runs the third
      if (primary) this.iliacOk = relaySupportsIliac(relayV);   // CARDS10: and deals the second game   // CARDS5; AUDIT CARDS-3 B1: a new welcome is a new socket - the relay stood the old one up
      if (primary) this.emoteOk = relaySupportsEmote(relayV);   // EMOTE1
      if (primary) this.grantStatsOk = relaySupportsGrantStats(relayV);   // FOE-BOUNDS: a tally's `stats` to a relay that knows it
      if (primary) this.starGrantOk = relaySupportsStarGrant(relayV);   // AUDIT STAR-TUNE F1: a star's stands ask `star` of a relay that mints it
      if (primary) this.dmOk = relaySupportsDm(relayV);   // TITLE-N
      if (primary) this.banOk = relaySupportsBan(relayV);   // AUDIT SAFE RELAY-3: the ban frame's relay
      if (primary) this.leaseOk = relaySupportsLease(relayV);   // LEASE1
      if (primary) this.courtWatchOk = relaySupportsCourtWatch(relayV);   // AUDIT PLAN-1000 G3: a full court's watcher, told when it is seated
      if (primary) this._deliver('welcome', () => this.onWelcomed?.());   // AUDIT SAFE CLIENT-8
      if (primary) this.cardOk = relaySupportsCard(relayV);   // INSPECT1
      if (primary) this.pageOk = relaySupportsPage(relayV);   // JOURNAL1
      if (primary) this.bossOk = relaySupportsBossRef(relayV);   // INT11: a relay that COUNTS a boss fight's bodies - before it, a body's word is junk to it
      else { const h = this._halo.get(room); if (h) h.bossOk = relaySupportsBossRef(relayV); }   // AUDIT INT15: a halo's own (a serpent's cell may be one)
      if (primary) this.duelOk = relaySupportsDuelRef(relayV);   // DUEL1; INT8: a relay that REFEREES a duel - before it, a blow would be routed for a defender that resolves none now
      if (primary) this.wedOk = relaySupportsWed(relayV);   // LEGACY7 part three
      if (primary) this.wildOk = relaySupportsWildRef(relayV);   // WILD1; INT9: a relay that REFEREES the zone - before it, a blow would be routed for a defender that resolves none now
      else { const h = this._halo.get(room); if (h) h.wildOk = relaySupportsWildRef(relayV); }   // INT9: a halo says for itself
      if (primary) this.seaPvpOk = relaySupportsSeaPvp(relayV);   // SHIP-PVP: and one that referees the open sea's guns
      else { const h = this._halo.get(room); if (h) h.seaPvpOk = relaySupportsSeaPvp(relayV); }   // SHIP-PVP: a halo says for itself
      if (primary) this.wildCollectOk = relaySupportsWildCollect(relayV);   // MAC (2026-10-14): a relay that signs a killer's collect
      else { const h = this._halo.get(room); if (h) h.wildCollectOk = relaySupportsWildCollect(relayV); }
      if (this._wildZone === 1 && primary && this.wildOk) { this._sayZone(this._ws, 1); this._wildZoneAt = this._now(); }   // INT9: my cell's socket welcomed while I stand in the zone hears so (AUDIT INT9: a halo never)
      if (primary) { this.wdunOk = relaySupportsWdun(relayV); this.wdunGiantsOk = relaySupportsWdunGiants(relayV); this.wdunSeaOk = relaySupportsWdunSea(relayV); }   // PVPDUNGEONS; ZONE-GIANTS; SEA-VAULTS
      if (primary) { this.gateOk = relaySupportsGate(relayV); this.portentsOk = relaySupportsPortents(relayV); }   // WB3; AUDIT WB14 (WIRE-1)
      if (primary) { this.siegeOk = relayFightsBattles(relayV); this.royalOk = relayRunsRoyal(relayV); }   // SEAT2a part four   // CROWN1 part two
      if (primary) { this.arenaOk = relaySupportsArena(relayV); this.arenaHeard = true; }   // ARENA4; ARENA-WAIT: said
      if (primary) this.ownOk = relaySupportsOwn(relayV);   // OWN1
      if (primary) this.gateSpentOk = relaySupportsGateSpent(relayV);   // AUDIT WBX S1: a hub that hears a receipt spent
      if (primary) this.gateSiteOk = relaySupportsGateSite(relayV);   // DISCORD-GATES: and where the gate stands
      if (primary) this.gateHealOk = relaySupportsGateHeal(relayV);   // GATE-HEAL: and what healed a fighter
      if (primary) this.raidOk = relaySupportsRaid(relayV);   // RAID3
      else { const h = this._halo.get(room); if (h) h.raidOk = relaySupportsRaid(relayV); }   // AUDIT RAID R8b: a halo says for itself
      if (primary) this.riteOk = relaySupportsRite(relayV);   // WB12d: the cell keeps the rite - an older relay closes the socket on `rite`
      else { const h = this._halo.get(room); if (h) h.riteOk = relaySupportsRite(relayV); }
      if (primary) this.starOk = relaySupportsStar(relayV);   // STAR3: the cell keeps a fallen star - an older relay closes the socket on `star`
      else { const h = this._halo.get(room); if (h) h.starOk = relaySupportsStar(relayV); }
      if (primary) this.egOk = relaySupportsEg(relayV);   // EG-PLAY: a relay that opens Elite Breaches - an older one closes the socket on `eg`
      if (primary) this.egLandOk = relaySupportsEgLand(relayV);   // FIELD BUGS 2026-10-20f LANDED-WORD: a relay that says what my blows on a breach's bodies land
      if (primary) this.sdOk = relaySupportsSd(relayV);   // SD3: the cell hears a Hollow found - an older relay closes the socket on `sd`
      else { const h = this._halo.get(room); if (h) h.sdOk = relaySupportsSd(relayV); }
      if (primary) this.serpentSiteOk = relaySupportsSerpentSite(relayV);   // SERPENT2: the hub's serpent herald
      if (primary) this.serpentOk = relaySupportsSerpent(relayV);   // SERPENT1: the cell holds a serpent's fight - an older relay closes the socket on `serpent`
      else { const h = this._halo.get(room); if (h) h.serpentOk = relaySupportsSerpent(relayV); }
      if (primary) this.owOk = relaySupportsOverworld(relayV);   // OW6L: the cell keeps the overworld's ledger - an older relay closes the socket on `ow` (the word goes down the primary alone)
      if (primary) this.owGraveOk = relaySupportsOwGraves(relayV);   // GRAVE-PARTY: and its graves searched - an older relay closes the socket on `gr`
      else { const h = this._halo.get(room); if (h) { h.owOk = relaySupportsOverworld(relayV); h.owGraveOk = relaySupportsOwGraves(relayV); } }   // AUDIT ONLINE 3 (the second read) C-1: a halo says for itself, for the crossing that makes it my cell
      // AUDIT RENOWN1 WIRE-3: THIS SOCKET'S OWN WORD, not the session's - a halo's welcome names its own relay, and a
      // socket whose welcome has not come is sent no renown order at all (the frame a relay behind would close it on)
      const _rnWs = primary ? this._ws : this._halo.get(room)?.ws;
      if (_rnWs) { this._rnOf(_rnWs).ok = relaySupportsRenown(relayV); this._flushRenown(now); }   // and a rise this room has not heard goes now
      if (primary) this.guildOk = relaySupportsGuild(relayV);   // GUILD1c
      if (_rnWs) { this._gdOf(_rnWs).ok = relaySupportsGuild(relayV); this._flushGuild(now); }   // GUILD1c: this socket's own word, as renown's - and a held guild order goes now
      if (primary) { this.homeOk = relaySupportsHome(relayV); this._hmAt = -Infinity; this._flushHome(now); }   // QUEST-HOME: the hub's own word - and a held home order goes now
      if (primary) this.parkOk = relaySupportsPark(relayV);   // HCC-PARK: the same law for the park frame
      if (primary) this.caravanOk = relaySupportsCaravan(relayV);   // WAGONS2-VISIT: and for a caravan's room
      if (primary) this.instanceOk = relaySupportsInstances(relayV);   // INSTANCES: and for an instance's (bible/11-Multiplayer/Instances.md)
      if (primary) this.lookOk = relaySupportsLook(relayV);   // PROFILE2
      else { const h = this._halo.get(room); if (h) h.lookOk = relaySupportsLook(relayV); }   // PROFILE2: a halo says for itself (AUDIT ONLINE 3, the second read: under its own line, no longer the party lead's `else`)
      if (primary) this.partyTravelOk = relaySupportsPartyTravel(relayV);   // PARTY-TRAVEL
      if (primary) this.restOptOk = relaySupportsRestOpt(relayV);   // REST-OPT (AUDIT C1)
      if (primary) this.partyWalkOk = relaySupportsPartyWalk(relayV);   // TV8
      if (primary) this.partyLeadOk = relaySupportsPartyLead(relayV);   // PARTY-LEAD
      if (primary) this.staffTeleportOk = staffTeleportSupported(relayV);
      if (primary) this.followOk = followSupported(relayV);   // STAFF-PANEL5-FOLLOW
      if (primary) this.relayCfgOk = relayCfgSupported(relayV);   // SCALE5b
      if (primary) this.grantMode = relaySupportsGrant(relayV) && streamsFoes(room) && typeof m.gm === 'string' ? grantModeOf(m.gm) : 'off';   // GRANT2: my cell's law - a relay before world218 closes on an ask (GRANT4: a world room's too)
      if (primary) this.findOk = hubShardsSupported(relayV);   // AUDIT SCALE II C-1: `find` is the shards' relay's (world192) - one before it parses it as an unknown message and closes the hub link 1008, terminal
      { const ws = primary ? this._ws : this._halo.get(room)?.ws; if (ws) this._rfOn.set(ws, m.rf === 1); }   // SCALE5b: whether its cell judges poses - a halo there hears every one (HALO-THIN)
      if (primary) this.travOk = relaySupportsTravellers(relayV);   // TV3
      if (primary) this.amapOk = relaySupportsPartyMap(relayV);   // PARTY-MAP
      // TV3: A REGION'S WELCOME SAYS ITS TRAVELLERS (`tr`), and says none when there are none - so it REPLACES the book,
      // a region crossed or a room rejoined included. Through the wire's own door, cut at TRAV_WELCOME_MAX. (AUDIT TV C6:
      // below the halo's look line, an `else` of its own `if (primary)`.)
      if (primary && isRegionRoom(room)) {
        const rows = Array.isArray(m.tr) ? m.tr.slice(0, TRAV_WELCOME_MAX) : [];
        // AUDIT DEEP T3-6: each row's age (`ag`, seconds - an older relay says none: fresh), so the book ages it from when
        // it was sent, not from this welcome
        const list = rows.map((r) => { const f = validTravellerFrame({ ...r, t: 'trav' }); return f ? { ...f, ag: Number.isFinite(r?.ag) ? Math.max(0, Math.min(TRAV_STALE_MS / 1000, Math.floor(r.ag))) : 0 } : null; }).filter((f) => f && f.p && f.id !== this.id);
        this._deliver('travellers', () => this.onTravellerRoom?.(list));
      }
      if (primary) this.eventOk = relaySupportsEvent(relayV);   // EVENT1
      if (primary) this.eventV = relayV;   // SUNBABY1: the words it knows (relayKnowsLiveEvent)
      // EVENT1: THE HUB SAYS THE LIVE EVENT ON ITS WELCOME (`ev`), and says nothing when there is none - so a hub
      // welcome without one ENDS any event this session held (a relay restarted without it, or an old relay that
      // knows none). Another room's welcome carries none and says nothing about it.
      if (primary && isSocialRoom(room)) this._setEvent(validLiveEvent(m.ev) ? { kind: m.ev.kind, at: m.ev.at } : null, false);
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
      // OW6L: A CELL'S WELCOME CARRIES ITS OVERWORLD LEDGER (`ow`: {sp, dg} - absent, an empty one), handed on as the
      // cell's own words are - one `sp` and one `dg`, each through the wire's door (validOwOut), each only when it holds
      // something - from ANY cell socket I hold: my own cell's AND A HALO'S, since the halo is how a player at the seam
      // hears the next cell (its bands, its raiders, its dungeons a pixel over the edge - the park's and the raid's rule).
      // A halo's now; my own cell's once the relay's clock below is read, so whatever ages what it hears ages it on it
      const owIn = isCellRoom(room) && m.ow && typeof m.ow === 'object' ? [validOwOut({ k: 'sp', ids: m.ow.sp }), validOwOut({ k: 'dg', rows: m.ow.dg }), validOwOut({ k: 'gr', rows: m.ow.gr })].filter(Boolean) : [];   // GRAVE-PARTY: and its graves searched
      if (!primary) for (const o of owIn) this._deliver('ow', () => this.onOverworld?.(o, room));
      if (!primary) return;
      this._setHost(m.host);   // WORLD1: the room's host, and the room's memory when it keeps one
      if (Number.isFinite(m.now)) {   // WORLD5: the relay's clock - a year off is no clock; OL3: and is SAID, on the console and the HUD line, rather than run uncorrected in silence
        if (Math.abs(m.now - Date.now()) < 366 * 24 * 3600 * 1000) { this.clockOffsetMs = m.now - Date.now(); this.clockRead = true; this.clockWarning = null; this._deliver('clock', () => this.onClock?.(this.clockOffsetMs)); }
        else if (!this.clockWarning) { this.clockWarning = clockWarningText(); console.warn(`[online] ${CLOCK_WARNING} (relay ${new Date(m.now).toISOString()}, this machine ${new Date().toISOString()})`); }
      }
      for (const o of owIn) this._deliver('ow', () => this.onOverworld?.(o, room));   // OW6L: my own cell's ledger, after its clock
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
      if (typeof m.id === 'string' && (isCellRoom(this.room) ? !!this.peers.get(m.id)?.told : m.id === this.host) && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) { if (primary && m.id === this.host) this._seatHeardAt = now; if (m.g === 1) this._grantSender(m.id); this._deliver('foes', () => applyingOwnerTm(m.data, () => this.onFoes?.(m.id, m.data))); }   // SEAT-LIVE: the host's stream is the seat heard; GRANT-DOOR: the relay vouches this sender stands on grants
      else if (isCellRoom(this.room)) this._askWho(room, m.id, now);   // WORLD6b-iii(e): a stranger's foes - asked for, its frames a peer's once the join lands
    } else if (m.t === 'own') {
      // OWN1: a peer's OWN foes in my world room (the room's roster holds it; never my own back)
      if (typeof m.id === 'string' && isWorldRoom(this.room) && m.id !== this.id && this.peers.has(m.id) && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) { if (m.g === 1) this._grantSender(m.id); this._deliver('own', () => applyingOwnerTm(m.data, () => this.onOwnFoes?.(m.id, m.data))); }   // GRANT-DOOR: and on the own lane
    } else if (m.t === 'hit') {
      // WORLD2: a blow on my foe - mine to apply only while I host
      // WORLD6b: in a cell a blow is mine when it names me (the relay routed it, and the frame says so); in a world room while I host
      if ((isCellRoom(this.room) || m.data?.own === 1 ? hitOwnerOf(m.data) === this.id : this.isHost()) && typeof m.id === 'string' && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) { this._deliver('hit', () => this.onHit?.(m.id, m.data)); if (isCellRoom(this.room)) this._askWho(room, m.id, now); }   // WORLD6b-iii(e): a stranger's blow lands (the relay routed it to me) and the striker is asked for, so my foe finds its candidate
    } else if (m.t === 'trade') {
      // TRADE1: a trade frame the relay routed to me - on ANY socket I hold (my own cell's or a halo's: a peer across a cell
      // edge reaches me down the socket that reports me, and a trade is decided by metres, not by which cell I stand in),
      // never my own back, gated coming in (the sender chooses the peer, so an over-rate stream is dropped and said once),
      // projected by the wire's own law, and addressed to ME. The session applies it; nothing is read from it here.
      this._directedIn(m, now, 'trade', this._inTradeBuckets, tradeInGate, TRADE_IN_HZ_MAX, validTradeData, (id, d) => this.onTrade?.(id, d));
    } else if (m.t === 'cast') {
      // ALLY-CAST: a cast frame the relay routed to me - on any socket I hold, never my own back, gated coming in per
      // sender (the trade arm's law), projected by the wire, addressed to ME. The host applies what it trusts of it.
      this._directedIn(m, now, 'cast', this._inCastBuckets, castInGate, CAST_IN_HZ_MAX, validCastData, (id, d) => this.onCast?.(id, d));
    } else if (m.t === 'card') {
      // INSPECT1: a card frame the relay routed to me - an ask for my card or the answer to mine - on any socket I hold,
      // never my own back, gated coming in per sender (the cast arm's law), projected by the wire, addressed to ME
      this._directedIn(m, now, 'card', this._inCardBuckets, cardInGate, CARD_IN_HZ_MAX, validCardData, (id, d) => this.onCard?.(id, d, subOf(m)));   // DUEL1: and the answerer's account as the relay verified it (null from an older relay)
    } else if (m.t === 'page') {
      // JOURNAL1: a page of another player's journal the relay routed to me - on any socket I hold, never my own back,
      // gated coming in per sender (the card arm's law), projected by the wire, addressed to ME. The host holds it for
      // me to read; nothing opens over my game on its own.
      this._directedIn(m, now, 'page', this._inPageBuckets, pageInGate, PAGE_IN_HZ_MAX, validPageData, (id, d) => this.onPage?.(id, d));
    } else if (m.t === 'duel') {
      // DUEL1: a duel frame the relay routed to me - on any socket I hold, never my own back, gated coming in per sender
      // (the directed frames' law), projected by the wire, addressed to ME, with the sender's account as the relay verified
      // it. The duel's law decides what it means; nothing is read from it here.
      this._directedIn(m, now, 'duel', this._inDuelBuckets, duelInGate, DUEL_IN_HZ_MAX, validDuelData, (id, d) => this.onDuel?.(id, d, subOf(m)));
    } else if (m.t === 'dref') {
      // INT8: THE DUEL REFEREE'S WORD on my bout (net/duel/duelRef.js) - the relay's own, never a peer's (it routes no `dref` a
      // client sends), on ANY socket I hold (AUDIT INT8: a bout asked through a halo is refereed there, and its every word
      // was dropped), projected by the wire's own law, with the room it came from; what it means is the duel's to decide
      const g = validDuelRefOut(m);
      if (g) this._deliver('dref', () => this.onDuelRef?.(g, room));
    } else if (m.t === 'wed') {
      // LEGACY7 part three: a wed frame the relay routed to me - the duel's law: on any socket I hold, never my own back,
      // gated coming in per sender, projected by the wire, addressed to ME, with the sender's account as the relay
      // verified it (the account service pairs the two halves of a wedding by it). The wedding's law decides the rest.
      this._directedIn(m, now, 'wed', this._inWedBuckets, wedInGate, WED_IN_HZ_MAX, validWedData, (id, d) => this.onWed?.(id, d, subOf(m), scOf(m)));
    } else if (m.t === 'wild') {
      // WILD1: a DIRECTED wild frame the relay routed to me (it carries the sender's `id` and the frame's `data`) - the
      // duel's law: on any socket I hold, never my own back, gated coming in per sender, projected by the wire,
      // addressed to ME. Or a ROOM's word on its remains (`k`), projected by the wire's own law - my own room's or, since
      // HALO-REMAINS, a halo's, with the room that said it.
      if (m.data !== undefined) {
        this._directedIn(m, now, 'wild', this._inWildBuckets, wildInGate, WILD_IN_HZ_MAX, (d) => { const v = validWildData(d); return v && wildDirected(v) ? v : null; }, (id, d) => this.onWild?.(id, d, subOf(m)));
      } else {
        // HALO-REMAINS (2026-10-09, the owner: "i died in the pvp zone again and still my pile isnt there"): a HALO's
        // room word too, with its room. The relay says a room's remains at a socket's hello alone, and walking back to
        // them a player hello's their cell AS A HALO first (from the cell beside it) - the words were dropped here, and
        // the crossing PROMOTES that socket without a new hello, so they were never said again: the pile never stood
        const o = validWildOut(m);
        if (o) this._deliver('wild', () => this.onWildRoom?.(o, room));
      }
    } else if (m.t === 'wref') {
      // INT9: THE ZONE REFEREE'S WORD (net/wild/wildRef.js) - the relay's own, never a peer's (it routes no `wref` a client
      // sends), on any socket I hold (a fight is refereed in the room the struck stands in), with that room; projected by
      // the wire's own law - what it means is the zone's to decide
      const g = validWildRefOut(m);
      if (g) this._deliver('wref', () => this.onWildRef?.(g, room));
    } else if (m.t === 'arena') {
      // ARENA4: the arena's hall or a bout's room - on my own room's socket (the hall link is a socket of its own),
      // projected by the wire's own law; what it means is the arena's to decide (scenes/arena/arenaOnline.js)
      if (!primary) return;
      const w = readArenaOut(m);
      if (w) this._deliver('arena', () => this.onArena?.(w, room));
    } else if (m.t === 'gate') {
      // WB3: a gate room's word about its boss, or the hub's about a kill - on my own room's socket or the hub's (a
      // channel), never a halo's (a gate's arena has none, and a cell's halo has no boss), projected by the wire's own
      // law; what it means is the arena's (and, for a kill, the gate's in the world) to decide
      if (!primary && !isChatRoom(room)) return;
      const g = validGateOut(m);
      if (g) this._deliver('gate', () => this.onGate?.(g, room));
    } else if (m.t === 'siege') {
      // SEAT2a part four: a siege room's word - my own primary socket's, in a siege's room alone, projected by the wire's
      // own law; what it means is the battle's to decide (net/siege/siegeLink.js)
      if (!primary || !isBattleRoom(room)) return;   // CROWN1 part two: a Royal Tourney's room's words too
      const g = validSiegeOut(m);
      if (g) this._deliver('siege', () => this.onSiege?.(g, room));
    } else if (m.t === 'raid') {
      // RAID3: a cell's word about a raid (its ledger, its cleanse, my receipt - on any cell socket I hold, my own cell's
      // or a halo's) or the hub's (a cleanse anywhere, the day's cleanses at my hello), projected by the wire's own law; a
      // kind from a room that never says it is dropped. What it means is the raid's to decide (systems/raidingParties.js)
      // AUDIT RAID R2: my receipt from the hub too - it keeps an earner's and hands it wherever the earner stands
      const r = validRaidOut(m);
      if (r && (r.k === 'cl' || r.k === 'rc' ? isCellRoom(room) || isSocialRoom(room) : r.k === 'cls' || r.k === 'tw' ? isSocialRoom(room) : isCellRoom(room))) this._deliver('raid', () => this.onRaid?.(r, room));   // RAID-ROLL: `tw` the hub's ask alone
    } else if (m.t === 'serpent') {
      // SERPENT1: the serpent's cell's word (on any cell socket I hold - my own cell's or a halo's) or the hub's (its kill,
      // to everyone online), projected by the wire's own law; the hub says the kill and an account's receipt (AUDIT
      // SERPENT S5 - a fighter away from its cell at the kill) alone, and a cell anything but
      const r = validSerpentOut(m);
      if (r && (isSocialRoom(room) ? r.k === 'fell' || r.k === 'rcpt' : isCellRoom(room))) this._deliver('serpent', () => this.onSerpent?.(r, room));
    } else if (m.t === 'wdun') {
      // PVPDUNGEONS: the hub's word on the zone's halls (the day, my locks, an entry's answer, the crows) - the hub's alone
      const w = isSocialRoom(room) ? validWdunOut(m) : null;
      if (w) this._deliver('wdun', () => this.onWdun?.(w));
    } else if (m.t === 'rite') {
      // WB12d: the hub's word of a broken rite (once, and at my hello while its circle stands), projected by the wire's
      // own law; from any other room it is dropped
      const r = validRiteOut(m);
      if (r && isSocialRoom(room)) this._deliver('rite', () => this.onRite?.(r, room));
    } else if (m.t === 'star') {
      // STAR3: a star's cell's word (its ledger, its hold, my receipt - on any cell socket I hold, my own cell's or a halo's)
      // or the hub's (a hold anywhere, my receipt, the night's held stars at my hello), projected by the wire's own law; a
      // kind from a room that never says it is dropped. What it means is the Starfall's to decide (scenes/starfall/starfallHost.js)
      const r = validStarOut(m);
      if (r && (r.k === 'hd' || r.k === 'rc' ? isCellRoom(room) || isSocialRoom(room) : r.k === 'hds' ? isSocialRoom(room) : isCellRoom(room))) this._deliver('star', () => this.onStar?.(r, room));
    } else if (m.t === 'sd') {
      // SD3: the hub's word of the Super dungeon - its record, at my hello and on every move - projected by the wire's own
      // law; from any other room it is dropped. What it means is the world's to decide (systems/sdWorld.js)
      const r = validSdOut(m);
      // SD6b: the realm's word of its Orrery, from the realm I stand in alone - never a hub's, never another room's
      if (r?.k === 'pz') { if (room === this.room && isSdRoom(room)) this._deliver('sd', () => this.onSdHall?.(r, room)); }
      else if (r?.k === 'rcpt') { if ((room === this.room && isSdRoom(room)) || isSocialRoom(room)) this._deliver('sd', () => this.onSdReceipt?.(r.r, room)); }   // SD9a: my receipt - my own realm's, or the hub's
      else if (r && r.k !== 'ev') { if (room === this.room && isSdRoom(room)) this._deliver('sd', () => this.onSdFight?.(r, room)); }   // SD8b: the realm's fight, from my own realm alone
      else if (r && isSocialRoom(room)) this._deliver('sd', () => this.onSd?.(r, room));
    } else if (m.t === 'eg') {
      // EG-PLAY: an Elite Breach's word - the call from the hub, everything else from the breach room I stand in alone
      const r = validEgOut(m);
      if (r && (isSocialRoom(room) ? r.k === 'call' || r.k === 'no' || r.k === 'rcpt' : room === this.room && isEgRoom(room))) this._deliver('eg', () => this.onEg?.(r, room));   // EG-ZA: and a receipt the hub holds for me (a void it asked, my breach's receipts at my hello)
    } else if (m.t === 'watch') {
      // SEAT1b (Seats-Arc 4.2): THE WATCH'S TICK - my own cell's alone (the relay ticks the socket that stands there, never a
      // halo's), a well-formed `k1` receipt or nothing; what it is worth is the account service's to say
      const w = primary && isCellRoom(room) ? readWatchReceipt(m.r) : null;
      if (w) this._deliver('watch', () => this.onWatch?.(m.r, w));
    } else if (m.t === 'grant') {
      // GRANT2 (Spawn-Grants.md section 12): my own cell's answer to my ask - a grant read whole, a refusal, or `off`
      // (the law turned off since my welcome: I ask no more until the next one says otherwise)
      const g = primary && streamsFoes(room) ? validGrantOut(m) : null;   // AUDIT GRANT A1: a world room's own lane hears its answers too
      if (g?.k === 'off') this.grantMode = 'off';
      else if (g && 'gm' in g && g.gm) this.grantMode = g.gm;   // AUDIT GRANT A10: the law in force as the relay read it at my ask - a cold cell's welcome may have said another
      if (g) this._deliver('grant', () => this.onGrant?.(g));
    } else if (m.t === 'ow') {
      // OW6L: a cell's word on its overworld ledger - the ids it took, the rows it moved, or my own rows' answer - on ANY
      // cell socket I hold (my own cell's, or a halo's: the welcome's rule above), projected by the wire's own law; a
      // cell's alone (no other room keeps one). What it means is the host's to decide (onOverworld)
      const o = isCellRoom(room) ? validOwOut(m) : null;
      if (o) this._deliver('ow', () => this.onOverworld?.(o, room));
    } else if (m.t === 'park') {
      // HCC-PARK: a cell's word about one owner's parked team - on any cell socket I hold (my own cell's or a halo's:
      // a team parked across the seam stands for me too), never my own back; the name is the relay's stamp
      // AUDIT HCC-PARK: keyed by the relay's opaque owner key `k` (the account and the character), which the relay
      // never sends an account for its own records; `ttl` what is left of the record's life on the relay's clock
      if (isCellRoom(room) && typeof m.k === 'string' && PARK_KEY_RE.test(m.k) && typeof m.id === 'string' && m.id !== this.id) {
        // WARDEN1: `y` when the town watch threw it (the cell's clock) - a reader draws it where it landed
        const e = { k: m.k, id: m.id, name: typeof m.name === 'string' ? m.name.slice(0, 32) : '', r: m.data ?? null, ttl: PARK_TTL_MS, ...(m.data && Number.isFinite(m.y) ? { y: m.y } : {}) };
        this._deliver('park', () => this.onPark?.(room, e));
      }
    } else if (m.t === 'parks') {
      // HCC-PARK: a cell's whole memory, after the welcome that reset this socket - an empty list is the whole truth too
      if (isCellRoom(room) && Array.isArray(m.data)) {
        const now = Number.isFinite(m.now) ? m.now : null;
        const list = m.data.slice(0, PARK_CELL_MAX).filter((e) => e && typeof e === 'object' && typeof e.k === 'string' && PARK_KEY_RE.test(e.k) && typeof e.id === 'string' && e.id !== this.id)
          .map((e) => ({ k: e.k, id: e.id, name: typeof e.name === 'string' ? e.name.slice(0, 32) : '', r: e.r ?? null,
            ttl: now !== null && Number.isFinite(e.at) ? Math.max(0, Math.min(PARK_TTL_MS, PARK_TTL_MS - (now - e.at))) : PARK_TTL_MS, ...(Number.isFinite(e.y) ? { y: e.y } : {}) }));
        this._deliver('parks', () => this.onParks?.(room, list));
      }
    } else if (m.t === 'parkYeet') {
      // WARDEN1: the town watch threw MY parked team (net/wire.js validParkYeet) - said by the cell it stood in (my own or
      // a halo's) to the sockets that spoke for it; what it means is the host's (systems/horse/horseCart.js adoptYeet)
      const y = isCellRoom(room) ? validParkYeet(m) : null;
      if (y) this._deliver('parkYeet', () => this.onParkYeet?.(room, y));
    } else if (m.t === 'caravan') {
      // WAGONS2-VISIT: what a caravan's owner placed in it - from the caravan's room I stand in alone (its welcome's, and
      // each word its owner says while I am in it); what it means is the interior host's (systems/caravanVisit.js
      // readCaravanDecor reads the document)
      if (primary && caravanKeyOf(room) && (m.data === null || (m.data && typeof m.data === 'object' && !Array.isArray(m.data)))) this._deliver('caravan', () => this.onCaravan?.(room, m.data));
    } else if (m.t === 'act') {
      // WORLD3: a door, a lever or a platform moved by another in my world room - never my own back, never outside one
      if (primary && isWorldRoom(this.room) && typeof m.id === 'string' && m.id !== this.id && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) this._deliver('act', () => this.onAct?.(m.id, m.data));
    } else if (m.t === 'join') {
      // AUDIT SCALE5a C1-C3: THE ROOM'S OWN COUNT, when the join says it (`n`, as the welcome does) - kept by arithmetic it
      // drifted at every door that says a join without a leave or a leave without a join; a relay before it, the old rule
      if (typeof m.id === 'string' && m.id !== this.id) { if (this.roomCount != null) { if (Number.isSafeInteger(m.n) && m.n >= 1) this.roomCount = m.n; else if (!this.peers.has(m.id)) this.roomCount++; } this._member(room, m.id, m, now); }   // ROSTER-G: a cut count follows the joins
      // AUDIT DEEP T3-3: a join is a FRESH socket, which holds no mark - one that replaced its own older socket (a blip's
      // reconnect) said no leave, so the old socket's mark is taken out here; its first mark follows its join
      if (typeof m.id === 'string' && m.id !== this.id && isRegionRoom(room)) this._deliver('travellers', () => this.onTravellerLeft?.(m.id));
    } else if (m.t === 'leave') {
      // AUDIT SCALE5a C1-C3: the room's own count when the leave says it (`n`); a relay before it, arithmetic - and an
      // unnamed one's leave counts too (one past the welcome's cut was counted in its `n` and never named here, so its leave
      // never came off: past CHAT_ROSTER_MAX the World tab's number only climbed)
      if (typeof m.id === 'string') { if (this.roomCount != null && m.id !== this.id) { if (Number.isSafeInteger(m.n) && m.n >= 1) this.roomCount = m.n; else if (this._rooms.get(room)?.has(m.id) || !this.peers.has(m.id)) this.roomCount = Math.max(0, this.roomCount - 1); } this._unmember(room, m.id); }   // WORLD6b-iii(b): gone from THIS room - kept while another holds it; ROSTER-G: and a cut count follows the leaves
      if (typeof m.id === 'string' && isRegionRoom(room)) this._deliver('travellers', () => this.onTravellerLeft?.(m.id));   // TV3: and their mark with them
    } else if (m.t === 'trav') {
      // TV3: a traveller's mark in my region - at TRAV_IN_HZ_MAX per room (the room's own fan budget, with twice its burst
      // so a room at full tilt that the network bunched passes whole - AUDIT DEEP2 C3), through the wire's door, never
      // my own back
      if (!isRegionRoom(room)) return;
      // AUDIT DEEP T3-1: a CLEAR is never gated - it only takes a mark out, and the relay fans it on its own budget; gated
      // with the marks, the one frame over a busy room's budget was the clear, and the player who went in stayed drawn
      if (m.p !== null) {
        const g = travInGate(this._inTrav.get(room), now);
        this._inTrav.set(room, g.bucket);
        if (!g.pass) { this.stats.travellersDropped = (this.stats.travellersDropped ?? 0) + 1; return; }
      }
      const f = validTravellerFrame(m);
      if (f && f.id !== this.id) this._deliver('travellers', () => this.onTraveller?.(f));
    } else if (m.t === 'renown') {
      // RENOWN1: A PLAYER'S LEVEL ROSE - a signed order the relay checked against that player's own account. Only a number
      // changes (the name layer reads it each frame), so there is nothing to gate: a peer I do not hold is ignored.
      // AUDIT RENOWN1: A RISE ONLY RAISES. The relay fans only a level that raises the carrier's (SEC-3/WIRE-1), but two
      // rooms that hold the same player hear the same rise at different moments - a late frame from the slower room
      // must not step the number back (a peer's lower level after a reconnect as another character comes through the
      // join and the welcome, never through this arm).
      const lv = readRenown(m);
      if (lv === null || typeof m.id !== 'string') return;
      if (m.id === this.id) {
        // MY OWN, from this room: the relay's echo of my rise, or its word that the room already holds as much - this
        // room has confirmed that level, so the held order stops going down its socket (WIRE-2)
        const ws = primary ? this._ws : this._halo.get(room)?.ws;
        if (ws) { const st = this._rnOf(ws); if (lv > st.lv) st.lv = lv; }
        if (lv > (this.lv ?? 0)) this.lv = lv;
        return;
      }
      const p = this.peers.get(m.id);
      if (p && lv > (p.lv ?? 0)) p.lv = lv;
      const k = this._known.get(m.id);
      if (k && lv > (k.lv ?? 0)) k.lv = lv;
    } else if (m.t === 'guild') {
      // GUILD1c: A PLAYER'S GUILD TAG MOVED - a signed order the relay checked (a join, a leave, a removal, a disbanding),
      // `gt` absent for none. Only a tag changes (the name layer and the chat read it each frame), so nothing is gated:
      // a peer I do not hold is ignored. MY OWN is a room's word - its echo of an order I carried, or a removal the hub
      // heard - and one that takes my guild off tells the host, which looks again: my other rooms still wear the tag.
      if (typeof m.id !== 'string') return;
      const gt = readGuildTag(m);
      // AUDIT-SEATS: a Season's banner ribbon is its guild's - a tag that moves takes it off (the relay's row too)
      if (m.id === this.id) {
        const was = this.gt ?? null;
        this.gt = gt;
        if (was !== gt) this.rb = null;
        if (was && !gt) this._deliver('guild', () => this.onGuildGone?.());
        return;
      }
      const p = this.peers.get(m.id);
      if (p) { if ((p.gt ?? null) !== gt) p.rb = null; p.gt = gt; }
      const k = this._known.get(m.id);
      if (k) { if ((k.gt ?? null) !== gt) k.rb = null; k.gt = gt; }
    } else if (m.t === 'pose') {
      // WORLD6b-iii(e): a stranger's pose - a member beyond the welcome's roster, asked for.
      // SLAM6: AND STOOD WHERE IT SAYS IT IS, THIS FRAME. The pose used to be dropped until the `who` answered, and
      // the who is the room's scarcest arm (WHO_HZ_MAX here, WHO_ROOM_HZ_MAX at the relay) - at a full room it is
      // minutes before a stranger is drawn at all, which would have left SLAM6's far tier reaching people nothing
      // could yet draw. A peer with no look composes the doll a look-less peer composes (net/remotePlayers.js
      // peerStubEntity), and every stranger shares that ONE doll until its own answer lands.
      const pose = validPose(m.p);
      if (!pose || typeof m.id !== 'string' || m.id === this.id) return;
      if (!pose.dd && this._diedSince(m.id, pose, now)) return;   // AUDIT ONLINE 3 F4: a slower room's copy of a pose from before the death
      // SLAM9: A POSE IS PROOF OF MEMBERSHIP IN THE ROOM IT ARRIVED ON. `_rooms` was written by a welcome or a join
      // alone, so a peer introduced in my own cell and posing through a halo was never a member of the halo - and the
      // cell's `leave` deleted her while she stood, alive, in the next room over; her next pose re-stood her as a
      // stranger. Every room a peer speaks in holds it now, and `leave` is per room, as WORLD6b-iii(b) meant.
      this._roomSet(room).add(m.id);
      const p = this.peers.get(m.id);
      // PCORPSE1: a peer's LAST pose - it fell here. Handed to the host with the peer's look (the corpse's class and the
      // cry's race and gender); its leave follows on the same socket and takes the living figure away as ever.
      // AUDIT CONTRIB A2: sendDeath speaks down the cell's socket AND every halo's, so one death arrives once per room
      // this session shares with the fallen - and the first copy took the peer off the list, so every later one was
      // a fresh death: a body and a cry per copy (the look gone, a Thief's and a Breton's) and the foes adopted again.
      // A death is delivered once; a living pose after it (a rise, a respawn) is a new life that may die again.
      if (!pose.dd) this._fallen.delete(m.id);
      if (pose.dd) { this._fell(m.id, p, pose, room, now); return; }
      if (p) {
        // SLAM14 (AUDIT SLAM FINAL B1): `heardIn` FOLLOWS THE POSES. It was stamped once, on the pose that stood the
        // stranger, so a peer first heard through my own cell and since heard only through a halo - it walked over
        // the seam - was still asked for down the cell's socket, where the relay no longer holds it and answers
        // nothing; that stranger stayed nameless for as long as it kept to the next room. The ask goes down the socket
        // its latest pose came on.
        if (!p.told || p.recall) p.heardIn = room;
        if (p.unconfirmed) this._confirm(p, room);   // SLAM14 B2: a pose is proof it is still here
        this._arrive(p, pose, now, room); return;   // NET-SMOOTH 2: heard through this room
      }
      this._member(room, m.id, { id: m.id, name: null, look: null, pose: m.p }, now, false);   // sanitizeName's own default stands over its head until the answer lands
      const stood = this.peers.get(m.id);
      if (stood && stood.src == null) { stood.src = room; stood.srcAt = now; }   // NET-SMOOTH 2: stood by a pose, this room speaks for it
      if (stood && (!stood.told || stood.recall)) stood.heardIn = room;   // the socket the ask goes down (`_askRound`) - the one this stranger is heard through
    } else if (m.t === 'chat' && m.ch === 'staff') {
      // STAFF-PANEL5-FREEZE (net/staffChat.js): A STAFF THREAD'S NUDGE - a line's id (`sl`) the account service stored, never
      // its words; the hub's alone, on the relay's word's own bucket. Heard, this hub routes the staff channel (`staffOk`).
      if (!isSocialRoom(room) || !Number.isSafeInteger(m.sl) || m.sl <= 0 || !this._lawIn(room, now)) return;
      this.staffOk = true;
      const sl = m.sl;
      this._deliver('chat', () => this.onStaffNudge?.({ sl }));
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
      const ch = CHAT_LINE_CHANNELS.includes(m.ch) ? m.ch : null;
      if (!this._lineIn(room, ch, now)) return;
      // ACC1d: the line carries the relay's verdict on the NAME beside it,
      // because a chat log is where a name is read and an impersonation
      // is worth doing. A hard boolean for the same reason `_peer` keeps
      // one: never a "maybe".
      // CHAT-CHAN: `ch` is the channel the relay says the line was said in (a party's, on the hub link) - a word the
      // relay composed from its own routing, one of the wire's own, or none
      // EMOTE1: `me` - the relay says the line is an ACTION, and only `true` is one
      // SAFE2: and `sg`, the relay's stamp on the line - carried, never read here: a report hands it to the account service
      // AUDIT SAFE CLIENT-6 (2026-10-17): and on a stamped line, `raw` - the words EXACTLY as the relay signed them. They are
      // sanitizeChat's already (the relay runs it, wire.js parseClient), and it is not idempotent: "n fuck-i-g" is signed
      // "n ****-i-g" and a second pass here reads "* ****-*-*", so the report carried words the stamp never covered and
      // the service refused it whole (report-unwitnessed). The log draws `text`; a report carries `raw` (net/chat.js) - never
      // longer than a line the relay could have signed (CHAT_MAX: the relay is the player's choice, and the log keeps it)
      this._deliver('chat', () => this.onChat?.({ id: m.id, name: sanitizeName(m.name), text, at: Number.isFinite(m.at) ? m.at : now, mine: m.id === this.id, sub: subOf(m), ch, ...(m.me === true ? { me: true } : {}), ...(typeof m.sg === 'string' && STAMP_RE.test(m.sg) ? { sg: m.sg, ...(m.text.length <= CHAT_MAX ? { raw: m.text } : {}) } : {}) }));
    } else if (m.t === 'holdem') {
      // CARDS5: THE RELAY'S CARD TABLE - the room's events and the table as it stands, my own hole cards, or my turn;
      // checked by the table's own law, from the room the player stands in only
      if (!validHoldemOut(m) || (!primary && m.cashout === undefined)) return;   // CARDS6: a cash-out from the room just left too - it is gold
      this._deliver('holdem', () => this.onHoldem?.({ ...m, at: now }));
    } else if (m.t === 'iliac') {
      // CARDS10: THE RELAY'S ILIAC TABLE - the room's events and the table, my own view of the game, or a ranked game's
      // receipt (from the room just left too - it is a result on the board); checked by the table's own law
      if (!validIliacOut(m) || (!primary && m.receipt === undefined)) return;
      this._deliver('iliac', () => this.onIliac?.({ ...m, at: now }));
    } else if (m.t === 'gambit') {
      // KG5: THE RELAY'S KING'S GAMBIT TABLE - the room's events and the table (the whole board: nothing of a dealt game
      // is hidden), or a refusal; checked by the table's own law, from the room the player stands in only - KG6: and a
      // rated game's receipt from the room just left too (it is a result on the board)
      if (!validGambitOut(m) || (!primary && m.receipt === undefined)) return;
      this._deliver('gambit', () => this.onGambit?.({ ...m, at: now }));
    } else if (m.t === 'roll') {
      // DICE1: A ROLL THE RELAY MADE - checked by the dice's own law (n dice, each 1..m, the total their sum plus k):
      // an honest relay rolled it, and a dishonest one's numbers that do not add up are no roll. Gated in on the
      // chat's own budgets, because the relay fans a roll through the chat's own fan (`_sayLine`).
      const roll = { n: m.n, m: m.m, k: m.k, dice: m.dice, total: m.total };
      if (typeof m.id !== 'string' || !validRoll(roll)) return;
      const ch = CHAT_LINE_CHANNELS.includes(m.ch) ? m.ch : null;
      if (!this._lineIn(room, ch, now)) return;
      this._deliver('roll', () => this.onRoll?.({ id: m.id, name: sanitizeName(m.name), at: Number.isFinite(m.at) ? m.at : now, mine: m.id === this.id, sub: subOf(m), ch, roll: { ...roll, dice: [...roll.dice] } }));
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
      if (!this._lineIn(room, null, now)) return;
      this._deliver('chat', () => this.onRed?.({ text, at: Number.isFinite(m.at) ? m.at : now }));
    } else if (m.t === 'smsg') {
      // STAFF-PANEL5-MESSAGE: A STAFF MESSAGE WAITS, by the hub alone, and known by the FRAME TYPE, which only the account
      // service's signed order makes and no player can send. It names the message, never its words: the words come off
      // the account service with this player's own session (net/staffMessages.js), so a relay that lies can only make the
      // game ask again (and the ask is paced there).
      if (!primary || !isSocialRoom(room) || typeof m.mi !== 'string' || m.mi.length > 64) return;
      this._deliver('smsg', () => this.onStaffMessage?.(m.mi));
    } else if (m.t === 'event') {
      // EVENT1: THE LIVE EVENT STAGED OR ENDED, by the hub alone - known by the frame type, as the server's line is. A
      // word this build does not know is no event (LIVE_EVENTS: a new one is safe against an old build).
      if (!primary || !isSocialRoom(room)) return;
      if (m.kind === '') { this._setEvent(null, true); return; }
      const ev = { kind: m.kind, at: m.at };
      if (validLiveEvent(ev)) this._setEvent(ev, m.w !== 1);   // SCALE5c: `w` - the bus saying a shard's joiner the event as a welcome would (not a fresh staging)
    } else if (m.t === 'home') {
      // QUEST-HOME: A HOME THAT MOVED, by the hub alone - its fan of a home order the service signed, or its held words on
      // a welcome. Known by the frame type; gated coming in as a chat line is, the relay being the player's own choice
      if (!primary || !isSocialRoom(room)) return;
      const words = validHomeFrame(m);
      if (!words) return;
      const g = homeInGate(this._hmIn, now);
      this._hmIn = g.bucket;
      if (!g.pass) return;
      this._deliver('home', () => this.onHome?.(words));
    } else if (m.t === 'dm') {
      // TITLE-N: THE DUNGEON MASTER SPEAKING - the red arm's law: known by the FRAME TYPE, no id and no name on it to
      // forge, and gated coming in on the chat line's own bucket, because the relay is the player's own choice.
      const text = typeof m.text === 'string' ? sanitizeChat(m.text) : '';
      if (!text) return;
      const g = chatInGate(this._inChat.get(room), now);
      this._inChat.set(room, g.bucket);
      if (!g.pass) { this.stats.chatsDropped++; return; }
      this._deliver('chat', () => this.onDm?.({ text, at: Number.isFinite(m.at) ? m.at : now }));
    } else if (m.t === 'frozen') {
      // STAFF-PANEL5-FREEZE (net/staffChat.js): STAFF FROZE MY ACCOUNT until then (epoch seconds), or 0: lifted. The screen
      // is mine alone - the relay and the service hold me to it whatever it shows. On the relay's word's own bucket; my hub's
      // next lease asked at once, so every room I hold learns it from my hand as soon as theirs.
      if (!Number.isSafeInteger(m.until) || m.until < 0 || !this._lawIn(room, now)) return;
      if (isSocialRoom(room)) { this.staffOk = true; this._leaseAskAt = -Infinity; }
      const until = m.until;
      this._deliver('chat', () => this.onFrozen?.({ until }));
    } else if (m.t === 'muted') {
      // MOD1: THE RELAY SAYS I AM MUTED (or no longer). On the chat line's
      // own inbound bucket, for CHAT-G's reason: it becomes a line in the
      // log, and the relay is the player's own choice.
      const until = mutedUntilOf(m);
      if (until === null) return;
      if (!this._lawIn(room, now)) return;   // AUDIT SAFE RELAY-2: on the relay's word's own bucket, never a busy channel's
      this._deliver('chat', () => this.onMuted?.({ until }));
    } else if (m.t === 'law' || m.t === 'banned' || m.t === 'slowed') {
      // SAFE4 + SAFE6: THE RELAY'S WORD ON MY OWN CHAT - an order the service pushed, handed to me to carry to my other
      // rooms (`law`); a ban (`banned`, epoch seconds - 0 lifted); a new voice's line refused for its pace (`slowed`, ms).
      // Each a line in the log at most - AUDIT SAFE RELAY-2: on a bucket of their own (LAW_IN_HZ_MAX), never the chat lines':
      // a channel at its budget dropped the order and the ban with the lines
      if (!this._lawIn(room, now)) return;
      if (m.t === 'law' && typeof m.order === 'string' && m.order.length > 0 && m.order.length <= 1024) this._deliver('chat', () => this.onLaw?.({ order: m.order }));
      else if (m.t === 'banned' && Number.isSafeInteger(m.until) && m.until >= 0) this._deliver('chat', () => this.onBanned?.({ until: m.until }));
      else if (m.t === 'slowed' && Number.isSafeInteger(m.ms) && m.ms > 0 && m.ms <= 60_000) this._deliver('chat', () => this.onSlowed?.({ ms: m.ms }));
    } else if (m.t === 'lease') {
      // LEASE1: MY HUB'S LEASE, to hand on to every lease room I hold - the hub's alone, on the relay's word's own bucket
      if (!isSocialRoom(room) || typeof m.l !== 'string' || !m.l || m.l.length > LEASE_WIRE_MAX || !this._lawIn(room, now)) return;
      const l = m.l;
      this._deliver('chat', () => this.onLease?.(l));
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
      // AUDIT DISC28 QS-1: THE HUB'S 'busy' IS A "TRY AGAIN". A quest share the hub refuses for the room's budget
      // (QUEST_ROOM_HZ_MAX, or its bytes) is answered with this social error and nothing else - no id, no ack - after
      // the client counted it sent. One inside the hub's own cooldown of my last share (QUEST_HUB_MIN_MS; the next may
      // not leave for QUEST_SEND_MS) is taken as that share's, once, and the host puts a FINAL back to go again - a
      // social act's 'busy' so read costs one final more, which changes nothing and says nothing at a copy ending or
      // ended. Any other word ('no account', 'account taken') is no invitation to retry.
      if (f?.k === 'error' && f.m === 'busy' && this._questSent && now - this._questSent.at <= QUEST_HUB_MIN_MS) {
        const quest = this._questSent.quest;
        this._questSent = null;
        this._deliver('quest', () => this.onQuestBusy?.(quest));
      }
      if (f) this._deliver('social', () => this.onSocial?.(f));
    } else if (m.t === 'stp') {
      if (!primary || !isSocialRoom(room)) return;
      const f = validStaffTeleportOut(m);
      if (f) this._deliver('staff teleport', () => this.onStaffTeleport?.(f));
    } else if (m.t === 'fol') {
      if (!primary || !isSocialRoom(room)) return;   // STAFF-PANEL5-FOLLOW: the hub alone says it
      const f = validFollowOut(m);
      if (f) this._deliver('staff follow', () => this.onFollow?.(f));
    } else if (m.t === 'rf') {
      // SCALE5b: a cell's word that it judges the poses that reach it now (or no longer) - its socket's, for my halo there
      const ws = primary ? this._ws : this._halo.get(room)?.ws;
      if (ws && (m.on === 1 || m.on === 0)) this._rfOn.set(ws, m.on === 1);
    } else if (m.t === 'hub') {
      // SCALE5c: the hub's word that this account's hub link belongs on another of its objects - its own shard (or, from a
      // shard, the bus): gone there at once, from the hub link alone
      const key = hubHopOf(m);
      if (primary && isChatRoom(room) && key && key !== this.room && channelOf(key) === channelOf(room)) this.join(key);   // part two: a region's link the same - never out of its own channel
    } else if (m.t === 'n') {
      // SCALE5c: the hub's count, moved by the other shards' joins and leaves - kept as a join's `n` keeps it
      if (primary && isChatRoom(room) && Number.isSafeInteger(m.n) && m.n >= 1) this.roomCount = m.n > (this._rooms.get(room)?.size ?? 0) + 1 ? m.n : null;
    } else if (m.t === 'found') {
      // SCALE5c (Mac's decision 2): the hub's answer to a search - each name through the wire's own readers
      if (!primary || !isChatRoom(room) || !Array.isArray(m.l) || (!isSocialRoom(room) && m.all !== 1)) return;   // part two: a region's channel answers everyone online alone
      const read = (n) => m.l.slice(0, n).filter((p) => p && typeof p.id === 'string').map((p) => ({ id: p.id, name: sanitizeName(p.name), sub: subOf(p), ...readBadge(p) }));
      if (m.g === 1) { this.guildOnline = new Map(read(HUB_GUILD_WHO_MAX).map((p) => [p.id, p])); return; }   // the Guild tab's list
      if (m.all === 1) { this.hubOnline = new Map(read(CHAT_ROSTER_MAX).map((p) => [p.id, p])); return; }   // the World tab's, while the hub is small
      if (typeof m.q !== 'string') return;
      const l = read(HUB_FIND_MAX);
      const box = this._boxAsks.delete(m.q);   // CHAT-FIND-HUB: the search box's ask - its answer is the box's, never a line
      if (m.busy !== 1) this.hubFound = { q: m.q, l, at: this._now() };   // a busy hub answered nothing: the box asks again
      if (!box) this._deliver('found', () => this.onFound?.({ q: m.q, l, busy: m.busy === 1 }));
    } else if (m.t === 'cfg') {
      // SCALE5b: the hub's answer to a relay setting - from the hub alone
      if (!primary || !isSocialRoom(room)) return;
      const f = validRelayCfgOut(m);
      if (f) this._deliver('relay setting', () => this.onRelayCfg?.(f));
    } else if (m.t === 'party') {
      // AUDIT SOC B3: the other members' poses, at PARTY_IN_HZ_MAX (PARTY_MAX - 1 members at PARTY_HZ_MAX each) - per room
      const g = partyInGate(this._inParty.get(room), now);
      this._inParty.set(room, g.bucket);
      if (!g.pass) { this.stats.partiesDropped++; return; }
      // SOC2: a party member's pose - never my own account's back (a second tab of mine is not a member to draw; the
      // hub fans to the other members' sockets, and this is the belt for a relay that does not)
      const f = validPartyFrame(m);
      if (f && f.acct !== this.acct) this._deliver('party', () => this.onParty?.(f.acct, f.p));
    } else if (m.t === 'amap') {
      // PARTY-MAP: a party member's revealed automap rows - the quest arm's two gates (per room, then per sender at the
      // hub's own cooldown), never my own account's back
      const f = validAmapFrame(m);
      if (!f || f.acct === this.acct) return;
      const rg = tokenGate(this._inAmapRoom.get(room), now, ((PARTY_MAX - 1) * 1000) / AMAP_HUB_MIN_MS, PARTY_MAX - 1);
      this._inAmapRoom.set(room, rg.bucket);
      if (!rg.pass) { this.stats.amapDropped = (this.stats.amapDropped ?? 0) + 1; return; }
      if (this._inAmap.size > TRADE_IN_SENDERS_MAX) this._inAmap.clear();
      const ak = `${room}|${f.acct}`;
      const last = this._inAmap.get(ak);
      if (last != null && now - last < AMAP_HUB_MIN_MS) { this.stats.amapDropped = (this.stats.amapDropped ?? 0) + 1; return; }
      this._inAmap.set(ak, now);
      this._deliver('amap', () => this.onAmap?.(f.acct, f.name, f.k, f.r));
    } else if (m.t === 'quest') {
      // QUEST1: a party member's shared quest, under questInGate's cooldown per SENDER (AUDIT DROPS C2; QUEST_HUB_MIN_MS,
      // the hub's own) - an honest hub, at most PARTY_MAX-1 senders each held to that cooldown, never trips it; a flood does.
      // never my own account's back, same reasoning as the party pose above
      const f = validQuestFrame(m);
      if (!f || f.acct === this.acct) return;
      // AUDIT 68 S14-quest-inbound-ungated: and PER ROOM first, AUDIT SOC B3's law for every hub arm - the sender's
      // account is the relay's word, so a made-up one per frame passed the per-sender cooldown every time
      const rg = tokenGate(this._inQuestRoom.get(room), now, QUEST_IN_ROOM_HZ, PARTY_MAX - 1);
      this._inQuestRoom.set(room, rg.bucket);
      if (!rg.pass) { this.stats.questSharesDropped = (this.stats.questSharesDropped ?? 0) + 1; return; }
      if (this._inQuest.size > TRADE_IN_SENDERS_MAX) this._inQuest.clear();   // bounded as the directed frames' maps are
      // AUDIT DROPS C2: the cooldown is the SENDER's (their account), so one member's share never costs another's
      const qk = `${room}|${f.acct}`;
      const g = questInGate(this._inQuest.get(qk), now);
      this._inQuest.set(qk, g.at);
      if (!g.pass) { this.stats.questSharesDropped = (this.stats.questSharesDropped ?? 0) + 1; return; }
      this._deliver('quest', () => this.onQuestShared?.(f.acct, f.name, f.quest));
    } else if (m.t === 'error') {
      // AUDIT 68 S14-halo-error-wedges-primary: the session's status is my own room's alone - a halo's refusal is that
      // halo's, and its own onclose (a terminal code remembered, a busy one retried) follows the frame
      if (primary) { this.status = 'error'; this.error = m.m == null ? t('net.online.relayError', 'server error') : String(m.m); }   // the relay's own word as it said it (realmSaves.js realmDoorShut compares it)
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
    const { title, glyphs, ts = null } = readBadge(p);   // SEAT1c: and a seat title's claim
    return { id: p.id, name: sanitizeName(p.name), title, ts, glyphs, au: readAura(p), pi: readIcon(p), rb: readRibbon(p), lv: readRenown(p), gt: readGuildTag(p), house: readHouse(p), sub: subOf(p), look: validLook(p.look), told: true, pose, from: pose, at: now, seenAt: now, shown: pose ? { ...pose } : null };   // GUILD1c: `gt` the guild tag the relay stamped   // MOD1: `sub` the relay-verified account, what /mute names   // RENOWN1: `lv` the level the relay stamped
  }

  /** A known peer said hello again: its name and look are the new ones, its pose arrives as any other. */
  _refresh(p, m, now, room = this.room) {
    p.name = sanitizeName(m.name); p.look = validLook(m.look); p.told = true; p.recall = false;   // SLAM6: an introduction, so the asks stop (SLAM14: the recall's too)
    // ACC3: THE NEWEST HELLO'S BADGE, whatever it is - including none.
    // A player who takes a title off and reconnects must lose it here
    // too, and a peer that kept the FIRST badge it was ever seen with
    // would be wearing a grant the relay has stopped vouching for.
    ({ title: p.title, glyphs: p.glyphs, ts: p.ts = null } = readBadge(m));   // SEAT1c: and a seat title's claim, including none
    p.lv = readRenown(m);   // RENOWN1: the newest hello's level, whatever it is - including none
    p.gt = readGuildTag(m);   // GUILD1c: and the newest hello's guild tag, including none
    p.au = readAura(m);   // WB9g: and the newest hello's aura, including none - one taken off is gone at the next hello
    p.pi = readIcon(m);   // WITCH1: and the newest hello's profile icon, including none
    p.rb = readRibbon(m);   // SEASON1 part two: and the newest hello's ribbon, including none - a Season's end takes it off
    p.house = readHouse(m);   // LEGACY7: and the newest hello's house, including none (a member played now of another line)
    if (subOf(m)) p.sub = subOf(m);   // MOD1: a place room's hello names no account; a channel's does - keep the one we were told
    this._remember(p.id, p);   // SLAM9: and it is kept, so a blip cannot un-introduce it
    const pose = validPose(m.pose);
    if (pose) this._arrive(p, pose, now, room, true); else p.seenAt = now;   // NET-SMOOTH 3: an introduction's pose, from this room
  }

  /** A pose in: eased from where the peer is drawn, or snapped there when it jumped. NET-SMOOTH: heard through `room`,
   *  and `intro` when it rode an introduction (a welcome's roster, a join) rather than a pose frame. */
  _arrive(p, pose, now, room = this.room, intro = false) {
    if (Number.isInteger(pose.ts)) return this._arriveTimed(p, pose, now, room, intro);   // SCALE2b: a pose that says when it was said
    if (p.timed) { p.timed = false; p.path = null; p.cadence = []; }   // SCALE2b: a peer gone back to untimed poses (an older relay) starts its walk over
    // NET-SMOOTH 2/3: ONE ROOM SPEAKS FOR A PEER. Another room's copy of a pose, or an introduction from a room that is
    // not the source, says the peer is alive and moves nothing while the source is live.
    const fromSource = p.src == null || p.src === room;
    if (!fromSource && this._srcLive(p, now)) {
      if (!intro) { (p.alts ??= []).push({ room, pose, at: now }); if (p.alts.length > LEAD_KEEP) p.alts.shift(); }
      p.seenAt = now; return;
    }
    if (!intro) {
      // NET-SMOOTH 2: THE ROOM THAT IS AHEAD SPEAKS. The source is whichever room spoke first, and a slower Durable
      // Object kept the peer late for as long as it lived. A pose the source brings that another room already brought
      // SOURCE_LEAD_MIN_MS sooner is a lead; SOURCE_LEADS of them in a row hand that room the peer - at the moment it
      // has just proven itself ahead, so its next pose is newer than anything the old source said.
      const seen = p.src === room ? p.alts?.find((a) => a.room !== room && !poseChanged(a.pose, pose)) : null;
      if (seen && now - seen.at >= SOURCE_LEAD_MIN_MS) {
        p.leads = seen.room === p.leadRoom ? (p.leads ?? 0) + 1 : 1;
        p.leadRoom = seen.room;
      } else p.leads = 0;
      p.src = room; p.srcAt = now;
      if (p.leads >= SOURCE_LEADS && this._rooms.get(p.leadRoom)?.has(p.id) && this.inRoom(p.leadRoom)) { p.src = p.leadRoom; p.leads = 0; p.alts = []; }
    }
    if (p.pose && !poseChanged(p.pose, pose)) { p.seenAt = now; return; }   // AUDIT WORLD6b-iii(b) C6: the same pose again (through a second room, or a standing heartbeat) is seen, not re-eased
    // SLAM3: the interval this peer keeps between the poses it really moved on, measured MOVE to MOVE (never from the
    // welcome: hearing OF a peer is not an interval it keeps). NET-SMOOTH 4: the median of its last CADENCE_SAMPLES -
    // it was the newest arrival's spacing, halved at most per pose (SLAM10), so a backlog's burst drew it to the floor.
    const since = p.movedAt != null ? now - p.movedAt : null;
    if (since != null && since >= GAP_MIN_MS && since <= PAUSE_MS) {
      (p.cadence ??= []).push(Math.min(GAP_MAX_MS, since));
      if (p.cadence.length > CADENCE_SAMPLES) p.cadence.shift();
      p.gap = cadenceOf(p.cadence);
    }
    const wasMoving = !!(p.pose && (p.pose.mv | 0));
    p.movedAt = now;
    this._play(p, now);
    const shown = (p.path?.length ? poseAlong(p.path, p.cur) : null) ?? p.shown ?? pose;   // where it is drawn NOW, not a frame ago
    if (groundDist(shown, pose) > snapUnitsFor(room)) {   // NET-SMOOTH 1: in the units of the room it was heard in
      p.path = [{ pose: { ...pose }, c: 0 }]; p.cur = 0; p.rate = 1; p.playAt = now;
      p.from = { ...pose }; p.pose = pose; p.at = now; p.seenAt = now; p.shown = { ...pose };
      return;
    }
    // NET-SMOOTH 4: A WAYPOINT, one segment past the last; the rate is set for the path now ahead of the cursor.
    const cadence = p.gap ?? 1000 / POSE_HZ;
    if (!p.path?.length) { p.path = [{ pose: { ...shown }, c: 0 }]; p.cur = 0; p.playAt = now; }
    const end = p.path[p.path.length - 1].c, seg = segmentFor(since, cadence, wasMoving);
    p.path.push({ pose: { ...pose }, c: end + seg });
    if (p.path.length > PATH_MAX) p.path.splice(2, p.path.length - PATH_MAX);   // the oldest ahead past the one being walked
    p.rate = rateFor(end + seg - p.cur, cushionOf(p.cadence, cadence), cadence, seg);
    p.from = { ...shown }; p.pose = pose; p.at = now; p.seenAt = now;
  }

  /** SCALE2b: A TIMED POSE IN - one carrying its send time (wire.js `ts`), which the relay passes from world162 on.
   *  What NET-SMOOTH had to guess, the sender now says:
   *   - ORDER: the newest send time wins, whichever room brings it, and an older or repeated copy moves nothing - so
   *     every pose arrives by the quickest room, and an introduction's old pose (a join, a roster) is simply older;
   *   - SPACING: a waypoint's place on the path (`c`) is its send time, so the path is walked at the pace the sender
   *     kept, not the pace the network delivered;
   *   - DELAY: each arrival's lateness against its send time (`offs`) gives the line's fastest (the earliest) and its
   *     jitter (the spread); the cursor is steered to the send time `now - D`, D = the fastest + one interval + the
   *     jitter (at most one interval) - one interval so there is always a pose ahead of it, the jitter so a late one
   *     still arrives before it is needed. Steady, that is a rate of exactly 1 whatever the line does; behind (a
   *     backlog, a promotion to the near tier), at most PLAY_RATE_MAX; ahead, never under PLAY_RATE_MIN.
   *  A standing peer's silence is not walked: a pose after a still one starts its move one interval before its send
   *  time, and a moving one's segment is at most GAP_MAX_MS - the time before it stands at the last waypoint, and a
   *  cursor waiting at the end of the path is moved across that dead time rather than racing it. AUDIT 637 C2: or at
   *  most the peer's own interval, where that is the longer - a far peer from a slow sender keeps intervals past
   *  GAP_MAX_MS while it walks (PAUSE_MS), and standing out the difference at every pose is not what it did. */
  _arriveTimed(p, pose, now, room, intro) {
    if (!p.timed) {   // first timed pose, or back from untimed ones: the walk starts over from where the peer is drawn
      p.timed = true; p.path = null; p.cadence = []; p.offs = []; p.tsU = null; p.movedU = null;
      if (Number.isInteger(p.pose?.ts)) { p.tsRaw = p.pose.ts; p.tsU = p.pose.ts; p.tsAt = p.seenAt ?? now; }   // a roster's pose is the newest heard so far
    }
    let u;
    if (p.tsU == null) u = pose.ts;
    else {
      const d = poseTsDiff(pose.ts, p.tsRaw);
      if (d > 0) u = p.tsU + d;
      else if (now - (p.tsAt ?? -Infinity) <= TS_RESYNC_MS) { p.seenAt = now; return; }   // a late copy, or the same one again
      else { u = pose.ts; p.path = null; p.cadence = []; p.offs = []; p.movedU = null; }   // the sender's clock started over
    }
    p.tsRaw = pose.ts; p.tsU = u; p.tsAt = now; p.src = room; p.srcAt = now;
    if (!intro) { p.offs.push(now - u); if (p.offs.length > OFFSET_SAMPLES) p.offs.shift(); }   // a roster's pose was said long ago: not a lateness
    if (p.pose && !poseChanged(p.pose, pose)) { p.seenAt = now; return; }   // C6: the same pose, said again
    const dt = p.movedU != null ? u - p.movedU : null;   // the interval the SENDER kept - no jitter in it
    if (dt != null && dt >= GAP_MIN_MS && dt <= PAUSE_MS) {
      p.cadence.push(dt);   // AUDIT 637 C2: the sender's own interval, whole (PAUSE_MS)
      if (p.cadence.length > CADENCE_SAMPLES) p.cadence.shift();
      p.gap = cadenceOf(p.cadence);
    }
    const wasMoving = !!(p.pose && (p.pose.mv | 0));
    p.movedU = u;
    this._play(p, now);
    const shown = (p.path?.length ? poseAlong(p.path, p.cur) : null) ?? p.shown ?? pose;
    if (groundDist(shown, pose) > snapUnitsFor(room)) {   // NET-SMOOTH 1
      p.path = [{ pose: { ...pose }, c: u }]; p.cur = u; p.rate = 1; p.playAt = now;
      p.from = { ...pose }; p.pose = pose; p.at = now; p.seenAt = now; p.shown = { ...pose };
      return;
    }
    const cadence = p.gap ?? 1000 / POSE_HZ;
    if (!p.path?.length) { p.path = [{ pose: { ...shown }, c: u - cadence }]; p.cur = u - cadence; p.playAt = now; }
    const end = p.path[p.path.length - 1].c, at = Math.max(u, end + 1);
    const longest = wasMoving ? Math.max(GAP_MAX_MS, cadence) : cadence;   // AUDIT 637 C2: a moving peer's own interval is walked whole
    if (at - end > longest) p.path.push({ pose: { ...p.path[p.path.length - 1].pose }, c: at - longest });   // stood there till then
    const startsAt = p.path[p.path.length - 1].c;
    p.path.push({ pose: { ...pose }, c: at });
    if (p.path.length > PATH_MAX) p.path.splice(2, p.path.length - PATH_MAX);
    const offs = p.offs.length ? p.offs : [now - u];
    const fastest = Math.min(...offs);
    const target = now - (fastest + cadence + Math.min(cadence, Math.max(...offs) - fastest));
    if (p.cur >= end && !wasMoving) p.cur = Math.max(p.cur, Math.min(target, startsAt));   // waiting at the end: the standing is skipped
    p.rate = Math.max(PLAY_RATE_MIN, Math.min(PLAY_RATE_MAX, 1 + (target - p.cur) / cadence));
    p.from = { ...shown }; p.pose = pose; p.at = now; p.seenAt = now;
  }

  /** NET-SMOOTH 4: the peer's cursor along its path, moved on to `now` at its rate; waypoints behind it let go. */
  _play(p, now) {
    if (!p.path?.length) return;
    const end = p.path[p.path.length - 1].c;
    p.cur = Math.min(end, (p.cur ?? 0) + Math.max(0, now - (p.playAt ?? now)) * (p.rate ?? 1));
    p.playAt = now;
    while (p.path.length > 1 && p.path[1].c <= p.cur) p.path.shift();
  }

  /** NET-SMOOTH 2: is a peer's source room still speaking for it - heard within SOURCE_STALE_GAPS of its intervals
   *  (SOURCE_STALE_MIN_MS at least), still holding the peer, and a room this session still holds? */
  _srcLive(p, now) {
    if (p.src == null || p.srcAt == null) return false;
    if (now - p.srcAt > Math.max(SOURCE_STALE_MIN_MS, SOURCE_STALE_GAPS * (p.gap ?? 1000 / POSE_HZ))) return false;
    return !!this._rooms.get(p.src)?.has(p.id) && this.inRoom(p.src);
  }

  /** Once a frame, on the session's own clock: the retry, the easing
   *  of every peer toward its last pose over one send interval. */
  tick() {
    const now = this._now();
    // DOOR-TOKEN: a hello refused for want of a token asks again the moment the minter holds one for its room - a mint
    // that came after TOKEN_WAIT_MS, the next room's mint gone ahead at its door (the minter's `ahead`), any link's -
    // rather than out the backoff and the mint's hold: the token is the thing it waited for, and costs nothing to carry
    if (this._tokenRetry && this._retryAt != null && now < this._retryAt && this.mintToken?.holds?.(this.room)) this._retryAt = now;
    if (this._retryAt != null && now >= this._retryAt && !this._ws && !this._closedByUs && !this.terminal && this.room) {
      // SCALE2c: a drop inside a relay deploy's wave waits, once, for the page's slot in it (net/reconnectWave.js)
      const hold = this._dropAt != null ? this._wave.holdUntil(this._dropAt, now) : null;
      this._dropAt = null;
      if (hold != null) this._retryAt = hold; else { this._retryAt = null; this.stats.reconnects++; this._open(); }
    }
    for (const [room, h] of [...this._halo]) {   // WORLD6b-iii(b): the halo's retries
      if (h.tokenRetry && !h.ws && h.retryAt != null && now < h.retryAt && this.mintToken?.holds?.(room)) h.retryAt = now;   // DOOR-TOKEN: as the primary's
      if (!h.ws && h.retryAt != null && now >= h.retryAt && !this._closedByUs && !this.terminal) {
        const hold = h.dropAt != null ? this._wave.holdUntil(h.dropAt, now) : null;   // SCALE2c: the halo waits for the same slot, so the page mints once
        h.dropAt = null;
        if (hold != null) { h.retryAt = hold; continue; }
        this._halo.delete(room); this.stats.reconnects++; this._openHalo(room, h.backoff); continue;
      }
      // AUDIT WORLD6b-iii(b) A7: a halo that never opens and never closes is not immortal - past the longest backoff it is dropped and retried
      if (h.ws && h.status === 'connecting' && now - (h.since ?? now) > BACKOFF_MAX_MS) { const ws = h.ws; h.ws = null; h.status = 'closed'; h.retryAt = now + BACKOFF_MIN_MS + this._rand() * Math.max(BACKOFF_MIN_MS, h.backoff - BACKOFF_MIN_MS); h.backoff = Math.min(BACKOFF_MAX_MS, h.backoff * 2); try { ws.close(1000, 'timeout'); } catch { /* already closed */ } }   // SLAM2: a halo's retry is jittered like the primary's - eight rooms a client, all refused together otherwise
    }
    if (!this.presence && this.status === 'open' && now - this._lastSentAt >= HEARTBEAT_MS && this._send({ t: 'ping' })) this._lastSentAt = now;
    if (this.leaseOk && this.status === 'open' && isSocialRoom(this.room) && now - this._leaseAskAt >= LEASE_MS && this._send({ t: 'lease' })) this._leaseAskAt = now;   // LEASE1: my hub's lease, asked every LEASE_MS
    if (this.status === 'open' && isSocialRoom(this.room)) this._wave.noteOnline(this.othersHere + 1);   // SCALE2c: the hub's count sizes a wave's spread
    // RELAY-H1: A STANDING PLAYER IS HEARD BY THE RUNTIME, NOT THE ROOM. The presence session's socket used to prove
    // itself alive with a pose every HEARTBEAT_MS, and every pose woke the Durable Object; the runtime answers this
    // exact ping in the object's sleep (server/src/index.js setWebSocketAutoResponse - test/net/relayh1.test.js holds the
    // two spellings to be one). Sent when nothing else has gone for PING_MS, through the halo sockets too (each is
    // its own room, and each intermediary idles a quiet socket by its own rule). On its own clock: a ping that
    // touched `_lastSentAt` would push the heartbeat pose back by a ping's width every time.
    if (this.presence && this.status === 'open' && now - Math.max(this._lastSentAt, this._lastPingAt) >= PING_MS) {
      const went = this._send({ t: 'ping' });
      for (const [, h] of this._halo) if (h.status === 'open' && h.ws) { try { h.ws.send('{"t":"ping"}'); } catch { /* the halo's own retry */ } }
      if (went) this._lastPingAt = now;
    }   // CHAT1: a channel's keepalive, answered without waking the room
    // HALO-THIN (AUDIT B F2): a halo hears a pose only when it is due, so it keeps RELAY-H1's cadence on its own clock - its
    // last pose, its last ping here, or the shared ping above, whichever was latest
    if (this.presence) for (const [, h] of this._halo) {
      if (h.status !== 'open' || !h.ws) continue;
      if (now - Math.max(this._haloPosed.get(h.ws)?.at ?? -Infinity, this._haloPinged.get(h.ws) ?? -Infinity, this._lastPingAt, h.since ?? -Infinity) < PING_MS) continue;
      try { h.ws.send('{"t":"ping"}'); this._haloPinged.set(h.ws, now); } catch { /* the halo's own retry */ }
    }
    if (this.presence && this.status === 'open') this._askRound(now);   // SLAM9: the fair ask over every peer not yet introduced
    this._askSeat(now);   // SEAT-LIVE: a dungeon's silent host - my pose, so the relay hears who is here to take the seat
    if (this._rnOrder) this._flushRenown(now);   // AUDIT RENOWN1 WIRE-2: a rise a room has not confirmed goes again, on each socket's own gate
    if (this._gdHeld.length) this._flushGuild(now);   // GUILD1c: a held guild order a socket's gate kept back goes now
    if (this._hmHeld.length) this._flushHome(now);   // QUEST-HOME: and a held home order
    this._flushLook();   // PROFILE2: a look the gate held back
    this._flushRehello();   // AURA-LIVE: and a badge
    // SCALE5a: the peers walked in place, never copied - every frame, chat open or not, and the hub link's peers are everyone
    // online: an array of all of them a frame per link. `_unmember` below may drop the peer in hand from the map, which a
    // Map's own iteration takes (an entry gone is not visited again), and nothing here adds one
    for (const p of this.peers.values()) {
      // SLAM14 B2: a peer a welcome left unnamed, and that no pose or join has confirmed since, leaves each such room
      // when the silence law hides it - the moment it would have vanished from the screen in any case
      if (p.unconfirmed && now - p.seenAt > PEER_TIMEOUT_MS) for (const room of Object.keys(p.unconfirmed)) this._unmember(room, p.id);
      if (!p.pose) continue;
      // SLAM3: EASED OVER THE INTERVAL THIS PEER IS ACTUALLY KEEPING, not over an assumed 1/POSE_HZ - a crowded sender
      // deliberately speaks less often. NET-SMOOTH 4: walked along its waypoints (`path`, written by _arrive), the ones
      // already passed let go; a peer with none yet stands at its pose.
      // AUDIT ONLINE 3 F1: seeded on the peer's own clock. A timed peer's waypoints sit at its send times (`tsU`), and the
      // first timed pose clears the path - so a repeat of it (the twin room's copy, the who's join) left none, and this
      // seed at 0 stood the next pose its whole send time away: the peer drawn frozen at PLAY_RATE_MAX for minutes, then snapped
      if (!p.path?.length) { const c = p.timed ? (p.tsU ?? 0) : 0; p.path = [{ pose: { ...(p.shown ?? p.pose) }, c }]; p.cur = c; p.rate = 1; p.playAt = now; }
      this._play(p, now);
      const was = p.drawn, s = poseAlong(p.path, p.cur);
      // RUN-IN-PLACE: THE BODY WALKS WHILE IT IS DRAWN WALKING - a drawn place that has not moved for SHOWN_MOVE_HOLD_MS
      // reads standing, whatever the last pose said; the first drawn step after reads the pose's own `mv` again.
      // AUDIT 637 C1: measured against the place THIS law last drew (`drawn`), never `shown` - an introduction (`_peer`)
      // and a snap write `shown` themselves, so a peer first drawn at its introduction's pose never started the clock
      // and ran in place for the whole PEER_TIMEOUT_MS, and a snap's new place read as no step at all. The clock starts
      // at the first frame this law draws a peer, and a snap is a step.
      if (!was || s.x !== was.x || s.y !== was.y || s.z !== was.z) p.drawnAt = now;
      else if (s.mv && now - p.drawnAt >= SHOWN_MOVE_HOLD_MS) s.mv = 0;   // AUDIT 637 C3: the sender's own edge (world.js: moving while now < moved + the hold)
      p.shown = p.drawn = s;
      if (s.pl && this.rideAt) { const r = { ...s }; this.rideAt(r); p.shown = r; }   // EG-H1: a ridden peer drawn on its piece at my clock (its walk's place left as it was)
      else if (this.rideAt) this.rideAt(s);   // EG-ZL (Elite-Gates.md section 10.8): a peer on no ride told too, never moved - on a Crumble I have seen fall it stands on a ghost slab
    }
  }

  /** Is a peer one to draw: a pose, seen within PEER_TIMEOUT_MS, and
   *  (a world cell) within the relay's range of the player. */
  visible(p, now = this._now()) {
    if (!p.shown || now - p.seenAt > PEER_TIMEOUT_MS) return false;
    return inRange(this.room, this._pose, p.shown);
  }

  /** The peers to draw, as an array. */
  /** AUDIT DISC7 B3: how long ago this peer's newest pose arrived (the session's own clock), 0 before any. */
  poseAgeMs(p) { return p?.at != null ? this._now() - p.at : 0; }

  drawable() {
    const now = this._now();
    const out = [];
    for (const p of this.peers.values()) if (this.visible(p, now)) out.push(p);
    return out;
  }

  /** One line for a person, or null when all is well; `label` names the session (AUDIT CHAT B5: the chat's line is this one, not a remake). */
  statusLine(label = t('net.online.label', 'online')) {   // L10N4: the default label read when the line is
    if (this.status === 'open') {
      if (this.clockWarning) return t('net.online.status', '{label}: {text}', { label, text: this.clockWarning });   // OL3: an open session with a clock a year off says so
      // ONCRASH1: a frame the port could not handle is SAID, not only swallowed - the player reporting "it crashed"
      // now has the line that names which frame, and the console has the stack behind it.
      if (this.threw && monoNow() - this.threw.mono < THREW_SAY_MS) return t('net.online.threw', '{label}: a \'\'{kind}\'\' message from another player was dropped ({text})', { label, kind: this.threw.kind, text: this.threw.text });
      return null;
    }
    if (this.terminal || this.status === 'error') return t('net.online.status', '{label}: {text}', { label, text: this.error ?? t('net.online.error', 'error') });
    if (this.status === 'connecting') return t('net.online.connecting', '{label}: connecting', { label });
    if (this._retryAt != null) return t('net.online.reconnecting', '{label}: reconnecting', { label });
    return null;
  }
}
