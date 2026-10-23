// ONLINE1 (2026-09-12): THE RELAY - a Cloudflare Worker and its Room
// Durable Object. The law is in relay.js (the port's own src/net/wire.js,
// pure, tested); this file is the I/O: the upgrade, the hibernatable
// sockets, the fan-out. test/server/online_relay.test.js drives the Room over
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
//
// ONE-SEAT (2026-09-27, Mac: "the player can only have one character only at a time. Like they shouldnt be able to
// open multiple tabs and join as different characters"): ONE TAB OF AN ACCOUNT ONLINE, decided at the hub - the one
// room every online tab holds - by the token's verified subject. A hub hello that CLAIMS (`cl`, a tab going online)
// closes the account's other tabs in the hub (CLOSE_REPLACED, SEAT_ELSEWHERE said first); one that does not is a
// reconnect, refused while another tab of the account holds the hub. The other rooms are not asked: the client that
// honours the hub's close leaves them all (net/online.js `superseded`), and a gate's court keeps its own one seat.
// ═══ ACC1d: THE RELAY VERIFIES THE NAME IT IS TOLD ════════════════
//
// THIS IMPORT IS THE EXPENSIVE LINE IN THE ARC. It puts
// src/net/identityToken.js in RELAY_GRAPH, so SLAM8's hash changes,
// RELAY_VERSION bumps, and the deploy drops every connected player.
// ACC0 chose two Workers so that account work would NOT cost this; the
// token seam is the one piece that has to be paid for, and it is paid
// once here rather than a little at a time.
import { routeStaffTeleport } from './staffTeleport.js';
import { privateInteriorOf, privateInteriorAdmits, caravanKeyOf } from '../../src/net/privateInterior.js';   // WAGONS2-VISIT: and a caravan's own room
import { isInstanceRoom, instanceOf, instanceAdmission, partyHoldsOwner, INSTANCE_INTERNAL_KIN, INSTANCE_KIN_KEEP_MS, INSTANCE_DOOR_WORD } from '../../src/net/instanceRoom.js';   // INSTANCES: an instance's room, its door and the hub's party answer (bible/11-Multiplayer/Instances.md)
import { isStaff } from '../../src/net/staffCommands.js';
import { RELAY_CFG_TTL_MS, RELAY_INTERNAL_CFG, mayRelayCfg, relayCfgValue } from '../../src/net/relayCfg.js';   // SCALE5b: the relay's settings, at run time
import { leaseKeyOf, mintLease, readLease, leaseRoom, LEASE_FRAME_MIN_MS, LEASE_OLD_REASON } from '../../src/net/roomLease.js';   // LEASE1: the hub's word on every socket, in every room
/** LEASE1 (the fourth review of the PR): a frame of a build that hands on no lease asks the hub's door at most this often -
 *  never once a minute (mob's load), yet one let in before the door went on at the hub is turned away within it. */
const LEASE_OLD_ASK_MS = 10 * RELAY_CFG_TTL_MS;
import { busOf, shardOf, isChannelShard, isChannelBus, isRegionBus, isCourtCopy, courtOfCopy, upOf, HUB_INTERNAL_UP, HUB_INTERNAL_POLL, HUB_POLL_MS, HUB_OUTBOX_MAX, HUB_OUTBOX_BYTES, HUB_BATCH_MS, HUB_SYNC_MS, HUB_COUNT_MS, HUB_BATCH_MAX, CLOSE_HUB, HUB_FIND_MAX, HUB_FIND_ROOM_HZ_MAX, HUB_GUILD_WHO_MAX, HUB_WHO_KEEP_MS, HUB_FRAME_MAX, HUB_UP_HZ_MAX, HUB_UP_BURST, shardKeeps, foldFind, HUB_BATCH_BYTES, HUB_UP_QUEUE_BYTES, HUB_SILENT_MS, SHARD_LAW_KEYS, HUB_KEY_KEY } from '../../src/net/hubShards.js';   // SCALE5c: the hub, sixteen ways
import { verifyToken, verifyOrder, verifyStakeOrderAnyAge, importPublicKeyB64, MAX_TTL_S, ORDER_TTL_S, renownIssuable, deckDigest, remainsDigest, _b64url } from '../../src/net/identityToken.js';   // MOD1: and the mute order, checked with the same key; AUDIT SAFE RELAY-10: and an order's claims read for its kind (`lawKindOf`)
/** ACC1d/F8: the most spent signatures one room remembers. Every entry
 *  expires within MAX_TTL_S and the hello gate bounds how fast they can
 *  arrive, so honest traffic never comes near this; it is here so a
 *  flood cannot grow the map without end. */
const SPENT_MAX = 4096;
/** MOD1: the most accounts whose latest mute order one room remembers. */
const ORDERS_MAX = 1024;
/** SAFE4: the door between the Worker and the hub for an order the account service pushed (SAFE_LAW_PATH). */
const SAFE_INTERNAL_LAW = '/internal/safe/law';
/** AUDIT SAFE RELAY-5/RELAY-7: THE BANS A ROOM HOLDS (`_bans`), apart from MOD1's mutes - the most accounts one room
 *  remembers, oldest out; where it keeps them across a wake; and for how long one matters. A held ban refuses a hello
 *  whose token was minted before it, and no token minted before it is good past its token's life (MAX_TTL_S) nor any
 *  older order past an order's (ORDER_TTL_S), with the verifier's skew twice - GUILD_OUT_KEEP_S's reasoning, which is
 *  why a ban is held minutes and not its days: the service mints a banned account no token at all, so every hello
 *  after that is refused at the account's own door. */
const BANS_MAX = 256;
const BANS_KEY = 'bans';
const BAN_KEEP_S = MAX_TTL_S + ORDER_TTL_S + 60;
/** AUDIT SAFE RELAY-10: the most bytes the law door reads of a post - an order is at most 1024 characters, and `{order}`
 *  around it; a post past this is refused unread (413), so a stranger's megabyte costs the Worker nothing to parse. */
const LAW_BODY_MAX = 2048;
/** AUDIT SAFE RELAY-10: the most orders the Worker's isolate remembers having handed the hub, each until it expires - a
 *  replay of one the hub took is answered here, and wakes nothing. */
const LAW_SEEN_MAX = 256;
/** INT9 (AUDIT): how long a place room keeps the hub's silence on a pair's kinship (kin, while it lasts) before asking again. */
const WDUN_KIN_SILENT_MS = 5_000;
/** GUILD1c: the most removals and disbandings one room remembers (`_guildOuts`). */
const GUILD_OUTS_MAX = 1024;
/** AUDIT MERGE-PLUS A3: where the room keeps its holds (`_guildOuts`) across a wake, and for how long one matters - a
 *  token's or an order's whole life past it, and twice the verifier's skew: after that nothing minted before the
 *  removal can still be carried in, and the roster (every later token) is the truth. */
const GUILD_OUTS_KEY = 'guildouts';
const GUILD_OUT_KEEP_S = MAX_TTL_S + ORDER_TTL_S + 60;

// ═══ SCALE2b (2026-10-04): the relay's half of the scale arc - its constants and helper in ./relayScale.js ═══
import { IDX_TRUST_MS, ATTACH_LAZY_MS, PARTIES_MAX, HUB_KEEP_MAX, ACCT_SEEN_WRITE_MS, ROOM_CALL_MS, Bounded, RoomMetrics, countedState, roomKindOf, layerWalk, askRoom } from './relayScale.js';
import { LAYER_ASK_HEADER, LAYER_EMPTY_HEADER, LAYER_LAST_HEADER, LAYERS_MAX } from './relay.js';   // AUDIT SCALE II R3-3, R1-5, R3-9: an asked layer's emptiness, the walk's last try, and a hall's every layer

// ═══ WB3: THE GATE'S BOSS ROOM ═════════════════════════════════════
//
// Mac: "a gate of oblivion which takes place in a large boss arena with an oversized enemy with telegraphed attacks",
// and Option B - the relay's object is the authority over the boss. THREE FILES JOIN THE BUNDLE, paid for once in this
// deploy: net/gate/gateLaw.js (the day's window and the room key - it imports wire.js alone), net/gate/gateBrain.js (the fight,
// pure law - it imports nothing) and net/gate/gateReceipt.js (the kill's receipt, the relay's first signature - it imports
// identityToken.js, already here). bible/11-Multiplayer/World-Bosses.md sections 5, 6 and 8.
import { isGateRoom, gateDayOfRoom, gateAdmits, gateHolds, gateTimes, gateBossOf, gateModsOf, gatePortentsOf, gateTitheOf, GATE_COLLAPSE_MS, isGateDay } from '../../src/net/gate/gateLaw.js';
import { riteNear, riteHeard, riteStands, cageStands, RITE_HELPERS_MAX } from '../../src/net/gate/gateRite.js';   // WB12d: the faithful's rite; BROKER-CAGE: the Broker's cage, omen to midnight
import { isSiegeRoom, newFighter, armsOk, SIEGE_HIT, ROYAL_RING, isSiegeNpcId, siegeNpcFoe, siegeNpcPose, siegeNpcFell, siegeNpcInReach, siegeNpcProvoked, refereeBlow, refereeCast, refereeStep, siegeHeld, siegeNextWave, siegeRise, SIEGE_WAVE_MS, SIEGE_FIGHTERS_MAX, SIEGE_SPECTATORS_MAX, SIEGE_OPENS_MS, SIEGE_TICK_MS, siegeNextBeat, fieldOf, newBattle, battleStep, honoured, siegeCampPose, siegeFieldFrame, isBattleRoom, isRoyalRoom, battleOfRoom, royalAsk, royalAccept, royalMarks, royalMayStrike, royalStepOk, royalEnd, royalStep, royalLadder, royalNextBeat, ROYAL_RC_KEEP, siegePlaceFree, siegeReturn, royalPrune, worksOf, refereeWorkBlow, siegeWaveMs, siegeRamDown, siegeBreach, SIEGE_WORK_IDS, SIEGE_GATEHOUSE, SIEGE_RAM, siegeGroundOf, siegeOffGround, siegeStepLevel, royalLevel, SIEGE_HEIGHT_M } from '../../src/net/siege/siegeRef.js';   // PVP-REF: a siege's referee - siegeRef.js imports nothing, so the worker's graph stays flat   // SEAT2a: and its battle   // AUDIT-SEATS T3/R5: a side's places, a fighter's return, a tourney's records   // SEAT2b part two (b): the works in battle
import { mintSiegeReceipt, SIEGE_RECEIPT_TTL_S, mintRoyalReceipt } from '../../src/net/siege/siegeReceipt.js';   // SEAT2a: the relay's fourth signature - a fighter's result and Honours
import { newDuelRef, duelNote, duelOpen, duelBoutOf, duelBlow, duelPose, duelEnd, duelForfeit, duelStep, duelVitals } from '../../src/net/duel/duelRef.js';   // INT8: the duel refereed
import { newWildRef, wildZone, wildPose, wildBlow, wildKin, sameGuild, wildPick, wildSigned, wildStep, wildVitals, wildGone, wildCarry, wildCarryOf, wildSignNow, wildFallOf, WILD_FALL_PREFIX, WILD_REF } from '../../src/net/wild/wildRef.js';   // INT9: the open zone refereed
import { mintWildReceipt, mintWildCollect, mintSeaWreck, WILD_RECEIPT_TTL_S, SEA_WRECK_TTL_S } from '../../src/net/wild/wildReceipt.js';   // INT9: a fall, signed; MAC (2026-10-14): and a killer's collect; SHIP-PVP: and a wreck
import { seaHelm, seaShot, seaBoard, seaStep, seaGone, seaCarry, seaWreckOf, SEA_WRECK_PREFIX, SEA_REF } from '../../src/net/sea/seaRef.js';
/** AUDIT SEA VENTURES A8: a signed word owed an account that is away (a fall's receipt, a wreck's) kept in the room's storage
 *  under this prefix as long as a receipt lives - a relay object that slept lost it from its memory, and a captain back
 *  in the zone was handed nothing. */
const WILD_OWED_PREFIX = 'wildowed:';
const WILD_OWED_KEEP_MS = Math.max(WILD_RECEIPT_TTL_S, SEA_WRECK_TTL_S) * 1000;   // SHIP-PVP: the open sea's guns refereed
import { mintDuelReceipt } from '../../src/net/duel/duelReceipt.js';   // INT8: a duel won, signed
import { applyCrystalHit, applyHostHit, applyHeal, healRef, earnedBy, receiptPortents, COURT_CENTRE, BRAIN_TICK_MS, CHECKPOINT_MS, GATE_FIGHTERS_MAX, hasPart, COURT_WATCH_ASK_MS } from '../../src/net/gate/gateBrain.js';
import { mintReceipt, importReceiptKey, readReceipt, RECEIPT_TTL_S } from '../../src/net/gate/gateReceipt.js';
import { bodyConfig, bodyStruck, bodySaid, bodyHealed, bodyLife, bodyCensus, bodyMeasure, bodyOut, bodyDown, bodyTellOwed, HULL_REFLOAT, BODY_TRAIL_MS, BODY_TRAIL_MAX } from '../../src/net/bossBody.js';   // INT11: the body counted
import { BODY_DEFAULT, BODY_LINE_MAX } from '../../src/net/bossBody.js';   // AUDIT SCALE II R1-4: a relay setting's line, refused past it in words
import { GATE_SEAM, SD_SEAM, SERPENT_SEAM } from '../../src/net/bossSeam.js';   // EG-H3 (EG3): THE BOSS SEAM - the Warden, the Brass Remnant and the Sea Serpent born, joined, struck, stepped, said, judged (INT11-INT13) and paid through one contract
// SERPENT1 (2026-10-04, Mac: "a new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean"): FOUR FILES JOIN THE BUNDLE - net/serpent/serpentLaw.js (the day's window - it imports wire.js and
// gateLaw.js, both here), net/serpent/serpentBody.js and net/serpent/serpentBrain.js (the body and the fight, pure law - they import
// each other alone) and net/serpent/serpentReceipt.js (the kill's receipt under the gate's one key). The fight lives in the cell
// its site stands in (bible/11-Multiplayer/Sea-Serpent.md section 6).
import { serpentAt, serpentAdmits, serpentHolds, serpentBossOf, serpentRiseYaw, serpentSiteKey, sameSerpentSite, SERPENT_DIVE_MS, SERPENT_BRAIN_MIN, SERPENT_NATIVE_PER_M } from '../../src/net/serpent/serpentLaw.js';
import * as serpentBrain from '../../src/net/serpent/serpentBrain.js';
import { mintSerpentReceipt, readSerpentReceipt } from '../../src/net/serpent/serpentReceipt.js';
// SERPENT2 (2026-10-04, the owner: "the discord integration needs to happen"): ONE FILE JOINS THE BUNDLE -
// net/serpent/serpentHerald.js (the serpent's Discord posts and when they are owed, pure law - it imports serpentLaw.js,
// gateHerald.js and wire.js, all here). The hub posts off its own alarm, beside the gate's herald.
import { serpentHeraldRole, serpentOmenPost, serpentFellPost, serpentHeraldOmenDue, serpentHeraldKill, serpentSiteDayOk, agreedSerpentSite } from '../../src/net/serpent/serpentHerald.js';
// RAID3 (2026-09-27, Mac, on World Events - Raiding Parties online: "1. Server"): TWO FILES JOIN THE BUNDLE -
// net/raid/raidLaw.js (a town raid's ledger, pure law - it imports nothing) and net/raid/raidReceipt.js (a raid's receipt, the
// relay's second signature under the gate's one key - it imports identityToken.js and raidLaw.js, both here).
// bible/03-World/Raiding-Parties.md, "The relay holds the raid (RAID3)".
import { raidWordFits, raidWordSane, raidSig, raidLedgerId, raidEvictPick, newRaidLedger, foldRaidWord, raidCleansed, raidEarned, raidTop, raidLedgerState, raidLedgerEndMinute, raidDayOfKey, RAID_KEEP_MS, RAID_LEDGERS_MAX, RAID_LEDGERS_BY_MAX, RAID_SAVE_MS, RAID_DAY_MINUTES, RAID_ACCOUNTS_MAX, raidDaySlots, raidOnSlot, raidDayIds, readRaidTowns, raidTownsHash, RAID_TOWNS_SHA_RE } from '../../src/net/raid/raidLaw.js';   // RAID-ROLL: the day's roll
import { mintRaidReceipt, readRaidReceipt } from '../../src/net/raid/raidReceipt.js';
// STAR3 (2026-10-20, the owner: "something coming from the sky and crashing into the ground, where people need to defend
// the objective in a wave based format with a boss topping off the encounter at the end"): TWO FILES JOIN THE BUNDLE -
// net/starfall/starfallLaw.js (when a star falls, where in its pixel, and the ledger its cell keeps - pure law, it imports
// wire.js and gateLaw.js, both here) and net/starfall/starReceipt.js (a star held, the relay's signature again under the
// gate's one key - it imports identityToken.js and starfallLaw.js). bible/11-Multiplayer/Starfall.md section 5.
import { starOk, starHeard, starMayMake, starLostAt, starNear, starTimes, newStarLedger, starLedgerSane, foldStarWord, stepStar, starOver, starSettled, starPlaceFor, starEarned, starTop, starLedgerState, starLedgerId, starHeldWord, starNightGoneAt, P_HELD } from '../../src/net/starfall/starfallLaw.js';
import { mintStarReceipt, readStarReceipt } from '../../src/net/starfall/starReceipt.js';
import { starRelayGate, validStarOut, STAR_INTERNAL_HELD, STAR_TELL_RETRY_MS, STAR_LEDGER_PREFIX, starLedgerKey, STAR_LEDGERS_MAX, STAR_SAVE_MS, STAR_KEEP_MS, STAR_HELD_KEY, STAR_HELD_MAX, STAR_RC_PREFIX, starReceiptKeyOf, STAR_RC_KEEP, STAR_RC_KEEP_MS, STAR_COUNT_MAX } from './relay.js';
import { mintWatchReceipt, watchDue, watchPixelOk } from '../../src/net/watchReceipt.js';
import { newIliacTable, iliacSit, iliacStand, iliacCommit, iliacTick as iliacTableTick, iliacNextAt, iliacEmpty, iliacLook, iliacSeatOf, iliacSitRefusal, iliacVouch, iliacGone, iliacBack, iliacVoid } from '../../src/net/iliac/iliacTable.js';   // CARDS10: THE RELAY DEALS ILIAC HAND - iliacTable.js imports the rules (iliacHand.js, iliacCards.js) and Hold'em's bounds; AUDIT CARDS-6: a sit's refusal asked first, a vouch again, a seat kept for a blink
import { newGambitTable, gambitSit, gambitSitRefusal, gambitReady, gambitReadyRefusal, gambitUnready, gambitCommand, gambitForfeit, gambitStand, gambitVoid, gambitTick as gambitTableTick, gambitNextAt, gambitEmpty, gambitLook, gambitSeatOf, gambitTableValid } from '../../src/net/gambit/gambitTable.js';   // KG5: THE RELAY RUNS THE KING'S GAMBIT - gambitTable.js imports the law (kingsGambit.js, which brings enemyBasics.js and mathf.js) and Hold'em's bounds
import { mintIliacReceipt, ILIAC_RECEIPT_TTL_S } from '../../src/net/iliac/iliacReceipt.js';
import { mintGambitReceipt, GAMBIT_RECEIPT_TTL_S } from '../../src/net/gambit/gambitReceipt.js';   // KG6: a rated King's Gambit's result - the relay's signature again
import { GAMBIT_STAKE_BB } from '../../src/net/gambit/gambitStakes.js';   // KG6: a King's Gambit stake's mark in CARDS6's escrow   // CARDS10: a ranked game's result - the relay's signature again; AUDIT CARDS-6 C1: kept owed for its life
import { mintCardReceipt, CARD_RECEIPT_TTL_S } from '../../src/net/card/cardReceipt.js';   // CARDS6: a staked seat's cash-out - the relay's fourth signature   // SEAT1b: the Watch's tick and its rhythm - the relay's third signature
// DISCORD-GATES (2026-09-28, Mac: "Discord live gates?" - the omen, 15 minutes before, pinging an opt-in role, and the
// boss slain): ONE FILE JOINS THE BUNDLE - net/gate/gateHerald.js (the posts and when they are owed, pure law - it imports
// gateLaw.js and wire.js, both here). The hub posts off its own alarm; bible/11-Multiplayer/World-Bosses.md, "THE
// HERALD".
import { heraldWebhook, heraldRole, omenPost, fellPost, ritePost, heraldOmenDue, heraldFellLive, gateSiteDayOk, foldGateSite, agreedGateSite, HERALD_RETRY_MS, HERALD_TIMEOUT_MS } from '../../src/net/gate/gateHerald.js';
// OW6L (2026-09-29, the product owner: "Everything needs that persistence between players in the overworld."): ONE FILE
// JOINS THE BUNDLE - net/overworldLaw.js (a cell's overworld ledger: the bands and raiders spent in it, its spawned
// dungeons' clocks - pure law; it imports wire.js, gateLaw.js and raidLaw.js, all three here already).
// ARENA4 (2026-10-02, Mac: "watch AI fights, player fights, join a team (red and blue) and climb esclating tiers of
// opponents, or choose to matchmake for a real opponent to take on in real time"): FOUR FILES JOIN THE BUNDLE -
// net/arena/arenaLaw.js (the rooms, the season, the rating, the queue, the referee's numbers, the words both ways - it imports
// nothing), net/arena/arenaBrain.js (one bout on the relay: the law, the referee, the ladder's AI fighters), the bout law it
// runs (systems/arena/arenaBout.js - pure, and it reaches net/duel/duelSession.js, which reaches wire.js) and net/arena/arenaReceipt.js (a
// bout's receipt, the relay's third signature under the gate's one key). bible/11-Multiplayer/Arena.md "7. Online".
// ARENA4b (2026-10-03, Arena.md 2: "Exhibition - online: yes - the relay runs it, every client sees one bout"): ONE FILE
// JOINS THE BUNDLE - net/arena/arenaExhibition.js (the hour's exhibition as law: the schedule, the pair, the bout's id - moved
// out of systems/arena/arenaLadder.js, which hands it on; it imports arenaLaw.js, here already, and systems/wind/wind.js's seeded
// die, which imports nothing) - and the hour's room `arena:x<hour>` stands beside the bouts'.
// ARENA6 (2026-10-03, the owner: "a way to simply host private matches"): NO FILE JOINS - a private session's room
// `arena:p<code>` (net/arena/arenaLaw.js) is a floor room whose bouts its host calls, its session's law in net/arena/arenaBrain.js.
import {
  isArenaRoom, isArenaHall, arenaBoutRoom, arenaBoutIdOf, pairQueue, matchBand, arenaRatingOk, MATCH_ACCEPT_MS, MATCH_QUEUE_MAX,
  MATCH_REPAIR_MS, ARENA_TICK_MS, ARENA_KEEP_MS, ARENA_LIVE_MAX, ARENA_HALL,
  isArenaExhibitionRoom, arenaExhibitionHourOf, isArenaFloorRoom, ARENA_EX_KEEP_MS, ARENA_CL_MIN, ARENA_CL_MAX, bannerClaim,
  isArenaPrivateRoom, arenaPrivateCodeOf, ARENA_PRIVATE_KEEP_MS, ARENA_PRIVATE_JOIN_HZ, privateSessionOver, privateSessionDeadline,   // ARENA6: a private session
} from '../../src/net/arena/arenaLaw.js';
import { exhibitionOpening, exhibitionBoutId, exhibitionAdmits } from '../../src/net/arena/arenaExhibition.js';
import {
  openBout, joinBout, leaveSeat, poseOf, refBlow, yieldOf, cheerOf, stepBout, fighterGone, stateWord, aiWords, hpWord, liveEntry, boutFinished, fighterOfSub,
  seatOnMark, openSession, sessionJoin, sessionPick, sessionGoFighters, sessionKick, sessionHist, sessionWord,   // ARENA6: a private session
} from '../../src/net/arena/arenaBrain.js';
import { mintArenaReceipt } from '../../src/net/arena/arenaReceipt.js';
import { owIdInCell, owRowInCell, owRowSane, owFoldSpent, owFoldRows, owRowsBehind, owPrune, owLedgerOf, owLedgerEmpty, toWelcome, owFoldGraves } from '../../src/net/overworldLaw.js';

import { serpentGate, validSerpentOut, SERPENT_INTERNAL_FELL, SERPENT_TELL_RETRY_MS, SERPENT_FIGHT_KEY, SERPENT_FIGHTS_KEY, SERPENT_SITES_MAX, serpentFightId, SERPENT_FELLS_KEY, SERPENT_FELLS_MAX, SERPENT_RC_PREFIX } from './relay.js';   // SERPENT1: the serpent's frame and its doors (the wire's, through relay.js - walked last, as ever)
import { roomOf, parseClient, GROUND_LAW, GROUND_OLD_REASON, groundRoom, GRANT_HELLO_LAW, GRANT_OLD_REASON, inRange, inRangeOf, poseGate, chatGate, redGate, dmGate, muteGate, tokenGate, rosterFor, badged, isChatRoom, isWorldRoom, isCellRoom, streamsFoes, hitOwnerOf, worldFrameMaxFor, CELL_FRAME_RECORDS_MAX, HELLO_HZ_MAX, CHAT_HELLO_HZ_MAX, CHAT_ROOM_HZ_MAX, SOCKETS_MAX, CHAT_SOCKETS_MAX, DROP_STRIKES_MAX, CHAT_STRIKES_MAX, WORLD_MIN_MS, WORLD_CHUNK, worldTtlMsFor, WORLD_PREFIX, FOES_PREFIX, OWN_PREFIX, foesGate, byteGate, floorGate, FOES_ROOM_BYTES_PER_S, FOES_FULL_RESERVE, FOES_FIRST_MS, FOES_UNHEARD_MS, foesFrameFull, foesFrameHandsOn, HIT_ROOM_HZ_MAX, ACT_ROOM_HZ_MAX, ACT_ROOM_BYTES_PER_S, actGate, MAX_FRAME_BYTES, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, HIT_ROOM_BYTES_PER_S, whoGate, whoIdOf, WHO_ROOM_HZ_MAX, poseFan, poseChanged, RELAY_VERSION, KEEPALIVE_FAN_MS, ACT_SENDER_BYTES_PER_S, CHAT_ROSTER_MAX, isSocialRoom, socialGate, partyGate, SOCIAL_ROOM_HZ_MAX, FRIENDS_MAX, PENDING_MAX, PARTY_MAX, PARTY_INVITES_MAX, INVITE_TTL_MS, PARTY_OFFLINE_MS, ACCOUNT_TABS_MAX, mintPartyId, SOCIAL_REPEAT_MS, ACCOUNT_IDLE_MS, ACCOUNT_SWEEP_MS, SWEEP_STEP_MS, SWEEP_PAGE, questShareGate, amapShareGate, AMAP_ROOM_HZ_MAX, QUEST_ROOM_HZ_MAX, QUEST_ROOM_BYTES_PER_S, QUEST_PREFIX, QUEST_FRAME_MAX, tradeGate, TRADE_ROOM_HZ_MAX, TRADE_ROOM_BYTES_PER_S, castGate, CAST_HZ_MAX, CAST_DEST_SENDERS_MAX, parkGate, parkKey, parkKeyOf, PARK_KEY_RE, CARAVAN_DECOR_KEY, parkRegistryRoom, cellRoomOfWire, PARK_INTERNAL_REG, PARK_INTERNAL_DROP, PARK_CELL_MAX, PARK_ACCOUNT_MAX, PARK_TTL_MS, PARK_REFRESH_MS, CARAVAN_DOC_MIN_MS, PARTY_CHAT_ROOM_HZ_MAX, rollGate, rollDice, cardGate, pageGate, duelGate, DUEL_HZ_MAX, wedGate, WED_HZ_MAX, renownGate, renownRoomGate, lookGate, eventGate, EVENT_KEY, validLiveEvent, gateGate, siegeGate, SIEGE_IN_MS, GATE_INTERNAL_FELL, SOCIAL_ROOM, validGateOut, HELLO_WAIT_MS, GATE_TELL_RETRY_MS, gateReceiptKey, GATE_BRAIN_MIN, GATE_HERE_HOLD_MS, guildGate, homeGate, validHomeWord, HOME_WORDS_KEY, HOME_WORDS_KEEP_MS, HOME_WORDS_MAX, guildRoomGate, GUILD_CHAT_ROOM_HZ_MAX, SEAT_ELSEWHERE, raidGate, RAID_INTERNAL_CLEAN, RAID_INTERNAL_DAY, RAID_DAY_ASK_MS, raidTownsGate, RAID_TELL_RETRY_MS, RAID_CLEANS_MAX, RAID_LEDGER_PREFIX, raidLedgerKey, RAID_RC_PREFIX, raidReceiptKeyOf, RAID_RC_KEEP, RAID_RC_KEEP_MS, mapPixelOfWire, validRaidOut, worldRoom, sharedClassicMinutes, wallMsForClassicMinutes, isRegionRoom, travHubGate, travRoomGate, TRAV_STALE_MS, TRAV_WELCOME_MAX, owGate, owRoomGate, owGraveGate, OW_LEDGER_KEY, REALM_DOOR_WORD, riteRelayGate, validRiteOut, sanitizeName, RITE_INTERNAL_BROKEN, RITE_INTERNAL_DAY, RITE_TELL_RETRY_MS, RITE_KEY, RITE_BY_MAX, RITE_CIRCLES_MAX, RITE_HUB_CIRCLES_MAX, RITE_ASK_EVERY_MS, RITE_ASK_TIMEOUT_MS, arenaGate, bodyWordRelayGate, BUSY_TOKEN_UNREAD, POSE_BATCH_MS, ROSTER_BATCH_MS, WIRE2_BATCH_MAX, slimPose, wire2Batch, isLayered, layerOf, layerName, LAYER_HEADER, LAYER_FULL_HEADER, validPose, wardenVerdicts, wardenDue, parkSameSpot, parkSpotOf, WARDEN_RETRY_MS } from './relay.js';   // AUDIT INT15: bodyWordRelayGate - a body's word on a bucket of its own
import { NEW_VOICE_GAP_MS, SAFE_LAW_PATH } from './relay.js';   // SAFE6: a new voice's pace; SAFE4: the service's door in
import { mintStamp, stampTabOf, PUBLIC_TABS } from '../../src/net/safety/chatStamp.js';   // SAFE2: the relay's stamp on every line it relays
import { sealFeed, FEED_SIG_HEADER, FEED_BATCH, FEED_WAIT_MS, FEED_POST_MS } from '../../src/net/safety/chatFeed.js';   // SAFE5: the reviewer's feed
import { grantGate, grantModeOf, GRANT_MODES, GRANT_CFG_TTL_MS, validGrantAsk, grantMintGate, grantMarksFor, signGrant, grantBucketIdle, GRANT_TTL_MS, GRANT_SKEW_MS, GRANT_TALLY_MS, grantRenewed, grantCarried, grantHanded, grantSignedHere, GRANT_OPEN_KINDS, grantKindRolled, grantMarksAllow } from '../../src/net/grantLaw.js';   // GRANT2: the spawn grant's law (bible/11-Multiplayer/Spawn-Grants.md)
import { newGrantMeasure, foldGrantAsk, foldGrantTally, grantMeasureBatch, sealGrantMeasure, GRANT_MEASURE_MS, GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_POST_MS, GRANT_RELAY_READER } from '../../src/net/grantMeasure.js';   // GRANT2: and its measure, to the service
import { foeStatsRefusal } from '../../src/net/foeBounds.js';   // FOE-BOUNDS: the most health a streamed foe can legally have (GRANT9's strip reads it)
import { seatOf, seatElder, seatStreams, seatTraffic, seatSilent, seatHeardAt, seatInAt, othersInOf } from '../../src/net/seatLive.js';   // FIELD BUGS 2026-10-18d SEAT-LIVE: a dungeon room's seat is a live socket's
import { FOES_STALE_MS } from './relay.js';   // SEAT-LIVE: the seat's staleness, the page's own (net/wire.js)
import { FOES_FULL_MS, isRoomKey } from './relay.js';   // FOES-HOLD: a held sender still streaming; AUDIT FOES-HOLD 1: its beat's key
import { createFoesHold, holdFrame, heldHead, heldOf, unhold, served, FOES_BEAT_SCAN_MS, FOES_LEFT_FLOOR } from './foesHold.js';   // FOES-HOLD: a room's first frames wait their turn
import { holdemGate, holdemSitRoomGate } from './relay.js';   // CARDS5: the card table's gate; AUDIT CARDS-3 A4: the room's sits
import { GATE_HELLO_HZ_MAX } from './relay.js';   // GATE-DOOR: a court's door
import { newTable, topUp as holdemTopUp, sit as holdemSit, sitRefusal as holdemSitRefusal, stand as holdemStand, actAt as holdemAct, tick as holdemTick, nextAt as holdemNextAt, emptyTable as holdemEmpty, tableLook as holdemLook, stateDelta as holdemDelta, holdemGoldTable } from '../../src/net/holdemTable.js';   // CARDS5: THE RELAY DEALS - the room's card tables (holdemTable.js imports only cardLaw.js, which imports only dice.js)
// WILD1 (2026-10-07, the owner: "Wrothgarian mountains need to be turned into a open pvp zone"): ONE FILE JOINS THE
// BUNDLE - net/wild/wildLaw.js (a place room's REMAINS: what a body in the open zone dropped, kept here so the room alone
// decides who takes each record - it imports wire.js alone). bible/11-Multiplayer/Wild-Zone.md.
import { newRemains, foldFall, takeFrom, remainsNamedFor, collectAsk, remainsWords, remainsLive, remainsEmpty, remainsSpent, remainsTakeover, remainsEvict, remainsOf, wildRemainsKey, WILD_REMAINS_PREFIX } from '../../src/net/wild/wildLaw.js';
import { wildGate, wildDirected, WILD_HZ_MAX, WDUN_HZ_MAX, WDUN_HERE_MS, WDUN_INTERNAL_RESET, WDUN_INTERNAL_KIN, WDUN_INTERNAL_GONE, WILD_INTERNAL_VIT, wdunRoomKey, wdunHall, wdunHallOfRoom, seaRoomCell, DUNGEON_ROOM_TAGS, WILD_REMAINS_MS as WDUN_PILE_MS } from './relay.js';
import { WDUN_KEY, wdunOf, wdunPrune, wdunEnter, wdunHere, wdunLeave, wdunDie, wdunGone, wdunState, wdunCrows, wdunBound, wdunGiantDie, wdunGiants, wdunFleetSunk, wdunFleets } from '../../src/net/wild/wildLaw.js';   // PVPDUNGEONS: the zone's halls, kept by the hub
import { validSdRecord, sdRelayGate, validSdFoundTell, chatRegionRoom, SD_INTERNAL_CENSUS, SD_INTERNAL_FOUND, SD_INTERNAL_LIVE, SD_TELL_RETRY_MS, SD_KEY, SD_FOUND_KEY, SD_REALM_KEY, sdDeadKey, SD_REGION_COUNT, SD_FIGHTERS_MAX, sdPzRelayGate, SD_ORRERY_KEY, sdFightRelayGate, SD_BRAIN_MIN, SD_NO_WORDS, SD_FIGHT_KEY, SD_INTERNAL_FELL, validSdFellTell, SD_INTERNAL_IN, validSdInTell, SD_RC_PREFIX, sdReceiptKey, SD_HERE_HOLD_MS, SD_SLOT_KEY, SD_HELD_KEY } from './relay.js';   // SD3: the Super dungeon's frame, its record and its doors (the wire's, through relay.js)
import { sdFirst, sdRise, sdFind, sdEnter, sdFell, sdGone, sdDue, pickSdRegion, sdFindBelieved, sdNearSite, sdHolds, sdAdmits, isSdRoom, sdSlotOfRoom, SD_NO_CLOSED, SD_NO_FULL, SD_NO_FALLEN } from '../../src/net/superDungeon/sdLaw.js';   // SD3: the Super dungeon's law - the director's moves, the census's pick, the find, the realm's room
// SD-HERALD (2026-10-09, the owner: "We need to add discord integration to abyss dungeons"): TWO FILES JOIN THE BUNDLE -
// net/superDungeon/sdHerald.js (the Abyss Dungeon's Discord posts and when they are owed, pure law - it imports sdLaw.js and
// gateHerald.js, both here) and formats/mapsTables.js (MapsFile's verbatim tables, which import nothing - the region a
// post names). The hub posts off its own alarm, after the director's beat.
import { sdHeraldDue, sdHeraldPost, readSdHeraldState } from '../../src/net/superDungeon/sdHerald.js';
import { sdMarksOf } from '../../src/net/superDungeon/sdMarks.js';   // SD18a: a Hollow's marks by its slot - the Remnant's profile and the Orrery's fray
import { orreryOf, orreryJudge, orreryLit, orreryFresh, orreryRightsFresh, orreryTurnerOf, orreryLashed, stoneInReach, dungeonToRealm, SD_STONES, SD_HOURS, SD_FRAY_MAX, SD_STONE_REACH_SLACK } from '../../src/net/superDungeon/sdBrain.js';   // SD6b: the Orrery's law - the realm judges every turn by it; AUDIT SD II (L7 H2): and who may turn while others turn
import { applyEchoHit, applyHeartHit, arenaOf, inArena, SD_ARENA_SLACK, SD_LOST_MS, SD_POSE_FRESH_MS } from '../../src/net/superDungeon/sdRemnant.js';   // SD8b: the Brass Remnant's law - the realm runs its fight by it
import { mintSdReceipt, readSdReceipt, SD_RECEIPT_TTL_S } from '../../src/net/superDungeon/sdReceipt.js';   // SD9a: the Hour's receipt - minted at the Remnant's fall, kept by the hub
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 31, EG-PLAY): THE BREACH JOINS THE
// BUNDLE - net/eliteGates/egLaw.js (the breach's room, clock and hall specs - it imports sdBrain.js), net/eliteGates/egBrain.js (the director)
// and net/eliteGates/egReceipt.js (the `e1` receipt). The hub opens a breach on the service's signed order; its room runs the halls.
// EG-FULL (2026-10-11, Mac: "I said I want everything"): the director's own pieces in place of the gate's - net/eliteGates/egShape.js
// (the FULL shape stamps and their floors), net/eliteGates/egBodies.js (the fight's bodies and blows), net/eliteGates/egLegion.js (the legion's
// sixteen kinds), net/eliteGates/egLords.js (the thirteen lords and the champions), net/eliteGates/egVestige.js and net/eliteGates/egRun.js (the run: the
// Vestiges, the company's word, the decrees, the caches, the Sutler).
import { isEgRoom, egRoomKey, egBreachOfRoom, EG_SEALED_MS, EG_ADMIT_MAX_MS } from '../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egAdmitWord, egStep, egBlow, egDown, egHome, egWord, egStateOf, egFightStateOf, egLive } from '../../src/net/eliteGates/egBrain.js';
// EG-H2 (2026-10-12, Elite-Gates.md section 22): DURABILITY - net/eliteGates/egDurable.js (time across a restart, THE HOLD, the law
// pin, the secret receipt seeds, the live list and its cap); the breach's end and its ground, a hall's spec for `spec`
import { egResume, egHoldDone, egRelease, egBeatGap, egReceiptSeed, EG_LIVE_MAX, EG_LIVE_KEY, EG_LIVE_PATH, EG_INTERNAL_LIVE, EG_INTERNAL_STAGE, EG_LIVE_SAID_MS } from '../../src/net/eliteGates/egDurable.js';   // AUDIT EG III: and how long the live door's answer is kept
import { egEnd, egGeo } from '../../src/net/eliteGates/egBrain.js';
import { egHallOf, egCircleOfHall, EG_LAST_WORD_MS, EG_ABSENT_TRIAL_MS } from '../../src/net/eliteGates/egLaw.js';   // AUDIT EG III: and a closed socket's body held for the absence's window
import { mintEgReceipt } from '../../src/net/eliteGates/egReceipt.js';
// EG-ZA (2026-10-12, Mac: "I said I want everything"; Elite-Gates.md sections 22 and 23): A KEY IS NEVER LOST - the hub's
// open retried and its call told the room, an open the room never took voided by the room (its tombstone first), a client's
// void of a stake no call answered, every receipt held at the hub (`egrc:<sub>`) until its account says it is counted, a
// `force` deploy's void; and THE TICK (net/eliteGates/egDurable.js egTickAt)
import { EG_VOID_MAX_S, EG_DONE_KEY, EG_OPEN_HUB_TRIES, EG_INTERNAL_VOID, EG_INTERNAL_CALLED, EG_INTERNAL_RCPT, EG_RC_PREFIX, EG_RC_TELL_MS, EG_RC_OWED_MAX, egRcKey, egRcId, egRcFold, egRcSpent, egRcLive, egDoneWith, egDoneOf, egVoidable, egTickAt } from '../../src/net/eliteGates/egDurable.js';
import { readEgReceipt, EG_RECEIPT_TTL_S } from '../../src/net/eliteGates/egReceipt.js';
import { verifyEgOpenAnyAge } from '../../src/net/identityToken.js';
// EG-E3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 20): net/eliteGates/egHerald.js
// JOINS THE BUNDLE - the Spire's herald (its posts, the hub's reckoning of the Descent's tops, First of the Spire and the
// seals said; pure - it imports gateHerald.js, egLaw.js and arenaLaw.js, all here). A breach's room tells the hub its news
// (EG_INTERNAL_HERALD), and the hub posts off its alarm beside the other heralds.
import { EG_INTERNAL_HERALD, EG_HERALD_KEY, EG_HERALD_KEEP_MS, EG_HERALD_TELL_MS, validEgHeraldTell, readEgHeraldState, egHeraldFold, egHeraldNext, egHeraldPost } from '../../src/net/eliteGates/egHerald.js';
// EG-H1 (EG8d, 2026-10-12; bible/11-Multiplayer/Elite-Gates.md section 21): WHAT THE RELAY JUDGES - each member's pose at its
// SHARED time (net/eliteGates/egFair.js's time law) onto its socket's trail and THE FAIR TRAIL, the Spire's blows and hazards judged on
// those trails and the body counted, ENFORCED in the Spire (net/eliteGates/egBrain.js egCount - the member's one life), the room's
// heals restored to it, the member's own word of its body (`vt`), the shared clock's ping answered (`clk`)
import { egPoseIn, egCount, egCountHeals, egBodyWord, egFairWoke, EG_BODY_ENFORCE } from '../../src/net/eliteGates/egBrain.js';
import { egHeal } from '../../src/net/eliteGates/egBrain.js';   // EG-ZF (Elite-Gates.md section 27.6): what a companion's spell healed in a member - the recap's healing
import { EG_HEAL_CAST_MS } from '../../src/net/eliteGates/egBrain.js';   // AUDIT EG IV (lane3 #3): how far back a relayed cast corroborates a heal word's healer
import { egPoseClock, egPoseShared, egTrailPush, EG_TRAIL_MS, EG_TS_LAG_MAX_MS } from '../../src/net/eliteGates/egFair.js';   // AUDIT EG V (L4-1): the edge no pose can still land before
import { signEgCall } from '../../src/net/eliteGates/egCallSig.js';   // EG-F: the hub's signature on the call's arch fields
import { egGate, EG_INTERNAL_OPEN, EG_KEY, egCallKey, validEgOpenTell, EG_BRAIN_MIN } from './relay.js';
import { egHubGate, EG_HUB_KINDS } from './relay.js';   // AUDIT EG IV (lane3 #5): the hub's own breach words on a bucket of their own

// AUDIT WORLD34 D4: the relay names itself in /health. SLAM13 (AUDIT SLAM A5): the name lives in net/wire.js, so the
// welcome can carry it; /health reads it through the import above. LOCALDEV1: it is NOT re-exported from this module -
// workerd (wrangler dev, 1.20260911) refuses a worker entry whose named export is a string ("Incorrect type for map
// entry 'RELAY_VERSION': the provided value is not of type 'function or ExportedHandler'"), so the local relay would
// not start at all. The production runtime let it through, which is why nothing caught it; the pins read wire.js.

/** DICE1: the relay's own dice - 32 uniform bits from the runtime's CSPRNG a draw (net/dice.js rollDice throws a draw
 *  back past the last whole multiple of the sides, so every face is exactly as likely). Workers carry `crypto`. */
const rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
/** WB3: the boss's dice - a [0,1) draw off the same CSPRNG (net/gate/gateBrain.js takes its randomness as an argument). */
const rand01 = () => rand32() / 4294967296;
/** SERPENT1: how often a beating serpent's cell runs its other duties (a rite's tell, its raids' ends), and how long it
 *  keeps a fight past its going - a fighter whose link dropped at the kill is handed its receipt at its next `in`. */
const SERPENT_REST_MS = 5000;
const SERPENT_KEEP_MS = 2 * 60 * 60 * 1000;
/** SERPENT1: where a cell keeps a fight (its id `day@site` - wire.js serpentFightId; the ids under SERPENT_FIGHTS_KEY). */
const serpentStoreKey = (id) => `${SERPENT_FIGHT_KEY}:${id}`;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
/** WB12d: the names of those who broke a circle's rite, in the order they were said. */
const riteNames = (c) => Object.values(c?.h ?? {}).filter((n) => typeof n === 'string' && n);
/** WB12d: the hub's word of a broken rite - its day, its circle, when, the first names of those who broke it and (AUDIT
 *  WB12d D4) how many did. */
const riteSaid = (d, c) => ({ k: 'br', d, px: c.px, py: c.py, at: c.at, by: riteNames(c).slice(0, RITE_BY_MAX), n: Object.keys(c.h).length });
/** BROKER-CAGE: the hub's word of a circle's faithful every one fallen - the Broker's cage open - and when. */
const cageSaid = (d, c) => ({ k: 'cl', d, px: c.px, py: c.py, at: c.clAt });
/** WB12d: a cell's circle the hub has not heard all of - its break and who struck since; BROKER-CAGE: or its faithful
 *  every one fallen. */
const riteOwed = (c) => (!!c.f && c.told < Object.keys(c.h).length) || (!!c.cl && !c.clTold);
/** AUDIT WB12d (R1): the circles a day's record stands by - those at the gate's agreed site (net/gate/gateHerald.js
 *  agreedGateSite: two accounts said where it stands) when there is one, else every circle told, the most struck first
 *  (the first told on a tie). A lie at a pixel no breach stands in is a circle the agreed site never names. */
const riteCirclesBy = (r, d, site) => {
  if (!r || r.d !== d) return [];
  const cs = Object.values(r.c ?? {});
  if (site) return cs.filter((c) => c.px === site.px && c.py === site.py);
  return cs.map((c, i) => [c, i]).sort((a, b) => Object.keys(b[0].h).length - Object.keys(a[0].h).length || a[1] - b[1]).map(([c]) => c);
};
/** The accounts paid at a day's kill: those who struck the faithful at the circles the record stands by, at most
 *  RITE_HELPERS_MAX, the first circle's first. */
const riteHelpersBy = (r, d, site) => {
  const out = new Set();
  for (const c of riteCirclesBy(r, d, site)) for (const sub of Object.keys(c.h)) if (out.size < RITE_HELPERS_MAX) out.add(sub);
  return [...out];
};
/** A kept rite record's shape (a cell's ledger or the hub's day): `{ d, c: { 'px,py': circle } }`. */
const riteRecordOk = (v) => !!v && typeof v === 'object' && Number.isSafeInteger(v.d) && !!v.c && typeof v.c === 'object' && !Array.isArray(v.c);
/** AUDIT SCALE II R1-4: WHY THE HUB REFUSES A RELAY SETTING (null: it takes it) - by its consumers' own law, so a setting
 *  answered as now in force is one they run. The hub kept any string of RELAY_CFG_VALUE_MAX and said it was in force,
 *  and each consumer fell back without a word: a role pasted as Discord's mention (`<@&...>`) left the herald pinging
 *  no role (heraldRole), and a BOSS_BODY missing a part's `perS` switched the count's enforcement off (bodyConfig's
 *  default whole). A role is heraldRole's (a Discord id); the line is bodyConfig's and no other - JSON whose every key
 *  is one it reads (a misspelt `enforce` it would ignore), and that it reads as a line rather than as its default.
 *  The words go back in the hub's answer (`error`), which /relay shows its developer. */
const BODY_KEYS = ['enforce', 'body', 'hull'], BODY_LINE_KEYS = ['depth', 'perS'];
/** GROUND-GATE (Field-Bugs-2026-10-17f): the words a build on an older ground is refused with - the error frame's, which
 *  every build shows as its own (net/online.js), so the copy that cannot know why is told what to do. */
const GROUND_OLD_WORDS = 'This copy of the game is older than the world online. Update it to play online: reload the page, or download the latest desktop release.';
/** FOE-BOUNDS: the most stripped records the relay remembers it has counted - a cell's whole stream over a window. */
const GRANT_STRIPS_SEEN_MAX = 4096;
const relayCfgRefusal = (k, v) => {
  if (k === 'egDrain') return v === 'on' || v === 'off' ? null : 'egDrain is on (the Spire\'s road shut - no new breach) or off';   // EG-H2 (Elite-Gates.md section 22): THE DRAIN
  if (k === 'groundGate') return v === 'on' || v === 'off' ? null : 'groundGate is on (a ground room refuses a build on an older ground) or off';   // GROUND-GATE (Field-Bugs-2026-10-17f)
  if (k === 'grantMode') return GRANT_MODES.includes(v) ? null : `grantMode is ${GRANT_MODES.join(', ')} - the spawn grants measure, enforce, or are off`;   // GRANT2 (Spawn-Grants.md section 12)
  if (k === 'grantRoll') return v === 'on' || v === 'off' ? null : 'grantRoll is on (an encounter\'s grant rolls its species from its seed) or off';   // GRANT8 (Spawn-Grants.md section 16)
  if (k === 'grantStrip') return v === 'on' || v === 'off' ? null : 'grantStrip is on (the relay drops a foe record its grant does not stand) or off';   // GRANT9 (Spawn-Grants.md section 16)
  if (k === 'grantDoor') return v === 'on' || v === 'off' ? null : 'grantDoor is on (a foes room refuses a build that does not stand on spawn grants) or off';   // GRANT-DOOR (Spawn-Grants.md section 20)
  if (k === 'leaseDoor') return v === 'on' || v === 'off' ? null : 'leaseDoor is on (a lease room refuses a build that hands on no lease, and hears a socket in nothing but its ping while it holds no live lease) or off';   // LEASE1 (net/roomLease.js)
  if (k !== 'bossBody') return heraldRole(v) === null ? `${k} is a Discord role's id, 15 to 21 digits - not its name or its mention` : null;
  let o = null;
  try { o = JSON.parse(v); } catch { /* refused below */ }
  const known = (x, keys) => !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every((key) => keys.includes(key));
  const ok = known(o, BODY_KEYS) && ['body', 'hull'].every((part) => o[part] === undefined || known(o[part], BODY_LINE_KEYS)) && bodyConfig(v) !== BODY_DEFAULT;
  return ok ? null : `bossBody is JSON {enforce, body: {depth, perS}, hull: {depth, perS}}, each part whole, each number 0 to ${BODY_LINE_MAX}`;
};

/** SD3: how long a realm keeps the hub's answer of its record before it asks again (a hello storm asks once), how soon a
 *  hub beat that failed tries again, and how many region channels the census asks at once (each with its own deadline,
 *  so a call the runtime queues behind others never times out unasked). */
const SD_LIVE_FRESH_MS = 10_000;
const SD_BEAT_RETRY_MS = 60_000;
const SD_CENSUS_BATCH = 6;
/** AUDIT SD II (L3 F2, L7 M5): a realm whose ask of the hub went unanswered asks again no sooner than this (every frame
 *  asked again while the hub struggled - a full realm's 4,096 asks a second into the one object every tab holds), and
 *  keeps the last answer it had this long through the misses (its phases are its own instants: it says itself when the
 *  Hour no longer holds). */
const SD_LIVE_MISS_MS = 2_000;
const SD_LIVE_KEEP_MS = 5 * 60_000;
/** AUDIT SD II (L7 M4): how long a cell believes the hub's last word on which slot its record holds - it tells no other
 *  slot's find meanwhile (well inside the two hours between one Hollow's end and the next one's rise). */
const SD_FIND_KNOWN_MS = 10 * 60_000;
/** AUDIT SD II (L7 M3): how many of a realm's SD_FIGHTERS_MAX seats guests may hold at once (the census's law: a guest is
 *  one click - 256 idle guest sockets held the Hour full for as long as they liked). */
const SD_GUEST_SEATS = 64;
/** AUDIT SD II (L7 H2): how often a refused turner is told so (its socket's own; the presses between are nothing). */
const SD_PZ_WAIT_SAY_MS = 4_000;
/** SD3: the hub's record of the Super dungeon, asked of the hub - the Worker's gate for a realm's key and the realm's own
 *  hello read the same answer. Null when the hub does not answer in time: no realm is minted, and nobody admitted, on a
 *  guess. */
async function sdLiveAsk(rooms, s) {
  if (!rooms?.idFromName || !rooms?.get) return null;
  try {
    const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SD_INTERNAL_LIVE}`, { method: 'POST', body: JSON.stringify({ s }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    if (!res?.ok) return undefined;   // AUDIT SD: no answer is not "no record" - the hub busy or away, asked again
    return validSdRecord((await res.json())?.rec);
  } catch (e) { console.warn('[sd] live', e?.message ?? e); return undefined; }
}
/** AUDIT SD: a realm's refusal while the hub does not answer - the hello's busy close, which the page tries again (never
 *  "The Hour has closed.", which is for good: a deploy's hello storm cast fighters out mid-fight). */
const SD_NO_BUSY = 'busy';
/** AUDIT EG III (lane3 #3): a held body's stand-in poses on its trail, this far apart (ms) - under the judge's
 *  EG_POSE_NEAR_MS, so every landing finds one either side of it. */
const EG_HELD_STEP_MS = 200;
/** AUDIT EG IV (lane3 #3): the most (healer, receiver) casts a breach's room remembers - a company of eight's every pair. */
const EG_CAST_SEEN_MAX = 64;
/**
 * AUDIT EG III (lane3 #3; Elite-Gates.md sections 6.1 and 22): A CLOSED SOCKET'S BODY HELD - an account's trail record (`{ tr,
 * last }`, the room's - `last` its newest real pose) grown to `now` with its last pose, an entry each EG_HELD_STEP_MS
 * (`[t, x, y, z, h, 1]`, from the trail's end, its window's at most), for EG_ABSENT_TRIAL_MS after that pose; past it the
 * trail is left as it is (the absence's fall is the director's). Answers the trail. AUDIT EG V (lane4 L4-1): `now` is
 * where the hold stops - an OPEN socket's is the room's now less EG_TS_LAG_MAX_MS (_egTrails), the edge before which no
 * pose of it can still land.
 * @param {{ tr: number[][], last: number[] }} k @param {number} now
 */
function egTrailHeld(k, now) {
  const r = k.last, tr = k.tr;
  if (!r || now - r[0] > EG_ABSENT_TRIAL_MS) return tr;
  const end = tr.length ? tr[tr.length - 1][0] : r[0];
  for (let t = Math.max(end + EG_HELD_STEP_MS, now - EG_TRAIL_MS); t <= now; t += EG_HELD_STEP_MS) egTrailPush(tr, [t, r[1], r[2], r[3], r[4], 1]);
  return tr;
}
/** EG-H2 (Elite-Gates.md section 22): THE SPIRE'S LIVE BREACHES, asked of the hub - `/v1/eg/live`, public, read by the relay
 *  deploy's hold and drain (.github/workflows/relay-deploy.yml): how many breaches live, whether every one stands between
 *  trials, the spec laws they were opened under, the longest's last word, and whether the road is shut. It names no
 *  breach. A hub that does not answer is said so (503) - never "none live". */
async function egLiveAsk(rooms) {
  if (!rooms?.idFromName || !rooms?.get) return json({ error: 'unavailable' }, 503);
  // AUDIT EG IV (lane3 #17; section 22, THE COST): ONE ASK OF THE HUB IN FLIGHT AN ISOLATE - the door is public and every
  // request on it was a request on the one object every client holds; the requests that come while one is asked are
  // answered by that asking (ASYNC NEVER DROPS: coalesced, never refused), and nothing is kept past its answer, so the
  // hub's own word stands - its EG_LIVE_SAID_MS, a breach it adds counted at once, the road's switch said at once
  let asking = egLiveAsking.get(rooms);
  if (!asking) {
    asking = egLiveRead(rooms).finally(() => { if (egLiveAsking.get(rooms) === asking) egLiveAsking.delete(rooms); });
    egLiveAsking.set(rooms, asking);
  }
  const body = await asking;
  return body ? json(body) : json({ error: 'unavailable' }, 503);
}
/** AUDIT EG IV (lane3 #17): the hub's live answer asked in flight, by the binding asked (an isolate's own). */
const egLiveAsking = new WeakMap();
/** The hub's answer to `/v1/eg/live` - its body, or null when it did not answer. */
async function egLiveRead(rooms) {
  try {
    const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${EG_INTERNAL_LIVE}`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(ROOM_CALL_MS * 4) }));
    return res?.ok ? await res.json() : null;
  } catch (e) { console.warn('[eg] live', e?.message ?? e); return null; }
}

/** SAFE4 (2026-10-17, bible/11-Multiplayer/Chat-Safety-Arc.md section 5): THE SERVICE'S DOOR IN. A moderator's mute or
 *  ban from Discord, or the reviewer's, has no moderator's client to carry its order to the rooms (MOD1's carrier), so the
 *  account service posts it here: `{ order }`, a mute or ban order it signed. The Worker checks the signature with the
 *  key every room checks a token with BEFORE the hub is woken - a stranger's post costs one verify and wakes nothing -
 *  and hands it to the hub, which applies it to its sockets and hands it to its target's own client to carry on
 *  (`_takeOrder`). The door believes the signature and nothing else, as every order's arm does.
 *
 *  AUDIT SAFE RELAY-10: AND A STRANGER'S POST REALLY COSTS ONE VERIFY. The body was read whole before any bound (a
 *  megabyte parsed to be refused) and the order was verified as a ban and then as a mute (two verifies for every mute
 *  and every forgery): the body is read to LAW_BODY_MAX and no further (413 past it, unparsed), and the order's kind is
 *  read off its claims first (`lawKindOf`) so it is verified once, as that kind - `verifyOrder` holds the claims to it
 *  after the signature, so a kind that lies is a refusal. An order the hub took is remembered by the isolate until it
 *  expires (`lawSeen`): its replay is answered here and wakes nothing. AUDIT SAFE RELAY-13a: and the answer is the
 *  HUB'S - it says `{ok}` in its body, and the Worker answered 200 off the status alone while the hub said false (an
 *  order its own key would not take): `{ok: true}` only for an order the hub took, 409 for one it did not. */
async function lawDoor(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const rooms = env.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return json({ error: 'unavailable' }, 503);
  const raw = await bodyCapped(request, LAW_BODY_MAX);
  if (!raw) return json({ error: 'too large' }, 413);
  let body = null;
  try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { body = null; }
  const order = body?.order;
  if (typeof order !== 'string' || !order || order.length > 1024) return json({ error: 'bad law' }, 400);
  const kind = lawKindOf(order);
  if (kind !== 'ban' && kind !== 'mute') return json({ error: 'bad law' }, 403);   // no verify spent on what is no mute or ban
  const key = await lawKeyOf(env);
  if (!key) return json({ error: 'unavailable' }, 503);
  const nowS = Math.floor(Date.now() / 1000);
  const r = await verifyOrder(order, key, { subtle: crypto.subtle, nowS, kind });
  if (!r.ok) return json({ error: 'bad law' }, 403);
  const sig = order.slice(order.lastIndexOf('.') + 1);
  for (const [k, e] of lawSeen) { if (e > nowS) break; lawSeen.delete(k); }   // from the oldest, stopping at the first still good (`_spent`'s walk)
  if (lawSeen.has(sig)) return json({ ok: true });   // the hub took this very order already - a replay wakes nothing
  try {
    const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SAFE_INTERNAL_LAW}`, { method: 'POST', body: JSON.stringify({ order }), signal: AbortSignal.timeout(ROOM_CALL_MS * 4) }));
    if (!res?.ok) return json({ error: 'unavailable' }, 503);
    const said = await res.json().catch(() => null);
    if (said?.ok !== true) return json({ ok: false, error: 'not taken' }, 409);
    if (lawSeen.size >= LAW_SEEN_MAX) lawSeen.delete(lawSeen.keys().next().value);
    lawSeen.set(sig, r.claims.e);
    return json({ ok: true });
  } catch (e) { console.warn('[law] the hub', e?.message ?? e); return json({ error: 'unavailable' }, 503); }
}
/** AUDIT SAFE RELAY-10: the orders this isolate handed the hub and the hub took - signature -> when the order expires,
 *  oldest first. Memory, an isolate's own: a new isolate forgets it, and the hub (which holds the newest order an
 *  account has, `_orders` and `_bans`) answers a replay as it always did. */
const lawSeen = new Map();
/** AUDIT SAFE RELAY-10: an order's kind (`o`), read off its claims BEFORE the signature is checked - only to choose the
 *  ONE verify the order is owed. Nothing else is read off unverified claims, and `verifyOrder(..., { kind })` refuses an
 *  order whose signed `o` is not the kind asked, so a lie here buys a refusal. null for anything that is no order. */
function lawKindOf(order) {
  const parts = typeof order === 'string' ? order.split('.') : [];
  const raw = parts.length === 3 ? _b64url.decode(parts[1]) : null;
  if (!raw) return null;
  try { const o = JSON.parse(new TextDecoder().decode(raw))?.o; return typeof o === 'string' ? o : null; } catch { return null; }
}
/** AUDIT SAFE RELAY-10: a request's body, `max` bytes at most - null past it (a length that says more is refused unread;
 *  a stream that runs past it is cancelled there), the bytes otherwise. */
async function bodyCapped(request, max) {
  const said = Number(request.headers.get('content-length'));
  if (Number.isFinite(said) && said > max) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { try { await reader.cancel(); } catch { /* gone */ } return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}
/** SAFE4: the door's verifying key, imported once an isolate (by the config's text, so a test's new key is a new import). */
let lawKeyHeld = { raw: '', key: /** @type {CryptoKey|null} */ (null) };
async function lawKeyOf(env) {
  const raw = env?.IDENTITY_PUBLIC_KEY;
  if (typeof raw !== 'string' || !raw) return null;
  if (lawKeyHeld.raw !== raw) {
    let key = null;
    try { key = await importPublicKeyB64(raw, { subtle: crypto.subtle }); } catch { key = null; }
    lawKeyHeld = { raw, key };
  }
  return lawKeyHeld.key;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'daggerfall-online', version: RELAY_VERSION, t: Date.now() });
    if (url.pathname === EG_LIVE_PATH) return egLiveAsk(env.ROOMS);   // EG-H2: the Spire's live breaches, for the deploy's hold and drain
    if (url.pathname === SAFE_LAW_PATH) return lawDoor(request, env);   // SAFE4: a mute or ban the account service pushed, for the hub
    const key = roomOf(url.pathname);
    if (!key || (key.startsWith('chat:') && !isChatRoom(key))) return json({ error: 'no such room' }, 404);   // AUDIT CHAT A1: no object is minted for a channel the port does not run
    if (key.startsWith('owned:') && !privateInteriorOf(key)) return json({ error: 'no such private room' }, 404);
    // WB3: a gate's room stands only inside its day's window - no object is minted for a gate the clock did not raise
    // (AUDIT CHAT A1's law, for a key a client could otherwise mint at will: `gate:<any day>`)
    if (key.startsWith('gate:') && !(isGateRoom(key) && gateHolds(gateDayOfRoom(key), Date.now()))) return json({ error: 'the gate is closed' }, 404);
    // PVP-REF: a siege's room stands for its own key alone (`siege:<seat>:<week>`) - no object for a key a client made up
    if (key.startsWith('siege:') && !isSiegeRoom(key)) return json({ error: 'no such siege' }, 404);
    // CROWN1 part two: a Royal Tourney's room, the same - `royal:<crown seat>:<week>` and nothing else
    if (key.startsWith('royal:') && !isRoyalRoom(key)) return json({ error: 'no such tourney' }, 404);
    // ARENA4: the arena's rooms are its hall and its bouts - no object is minted for any other `arena:` key
    if (key.startsWith('arena:') && !isArenaRoom(key)) return json({ error: 'no such room' }, 404);
    // ARENA4b: an exhibition's room stands only for an hour the shared clock is in or has kept (the gate's law for a
    // key a client could otherwise mint at will: `arena:x<any hour>`)
    if (isArenaExhibitionRoom(key) && !exhibitionAdmits(arenaExhibitionHourOf(key), sharedClassicMinutes(Date.now()))) return json({ error: 'no such bout' }, 404);
    // SD3: a Super dungeon's realm is `sd:<slot>` and nothing else (the keys the hub mints - net/superDungeon/sdLaw.js sdRoomKey)
    if (key.startsWith('sd:') && !isSdRoom(key)) return json({ error: 'no such room' }, 404);
    // EG-PLAY: an Elite Breach's room is `eg:<16hex>` and nothing else (net/eliteGates/egLaw.js isEgRoom) - and it admits nobody until
    // the hub has opened it (the room's own record, below)
    if (key.startsWith('eg:') && !isEgRoom(key)) return json({ error: 'no such room' }, 404);
    if (String(request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') return json({ error: 'websocket only' }, 426);
    // SD3: and it stands only while the hub's record holds its slot - found, or fallen and collapsing (the gate's law, read
    // from the hub, after the socket's own check so no other request asks it): no object is minted for a slot the hub
    // never raised, nor for one gone
    if (isSdRoom(key)) { const s = sdSlotOfRoom(key); const rec = await sdLiveAsk(env.ROOMS, s); if (!(rec && rec.s === s && sdHolds(rec, Date.now()))) return json({ error: 'the Hour has closed' }, 404); }
    // SCALE5d: A CROWDED PLACE OVERFLOWS INTO LAYERS (wire.js isLayered) - its own object first, or the layer the page
    // asks for (its party's, `?ly=`), and past a full one the next, round to LAYERS_MAX; each object told which layer
    // it is (LAYER_HEADER, set here whatever the page sent). A refusal for anything but a full room is answered as it was
    if (isLayered(key)) return layerWalk(env.ROOMS, key, request, layerOf(url.searchParams.get('ly')));
    // SCALE5d part two: A GATE'S COURT OVERFLOWS INTO ITS COPIES (hubShards.js isCourtCopy) - the court itself first,
    // always (its fight is there), and past it full the copies, which hand the court their sockets' fight
    if (isGateRoom(key)) return layerWalk(env.ROOMS, key, request, 0);
    return askRoom(env.ROOMS, key, request);   // DO-ASK: a room reset before it ran the upgrade asked once more; what is left a 503, never thrown
  },
};

/** ARENA4: the doors between the arena's objects - the hall opening a matched bout's room, and a bout telling the hall it
 *  stands (its entry on the list of bouts to watch) or is done. The public worker forwards /room/<key> alone. */
const ARENA_INTERNAL_OPEN = '/internal/arena/open';
const ARENA_INTERNAL_LIVE = '/internal/arena/live';
/** ARENA4: how often a waiting queue's band is said again, and the bout room's checkpoint, ms. */
const ARENA_SAY_BAND_MS = 5000;
const ARENA_SAVE_MS = 1000;
/** ARENA4: a bout's place on the list is told the hall no oftener than this (a spectator's seat taken or left). */
const ARENA_LIVE_TELL_MS = 2000;
/** ARENA4: a bout's id, 16 hex off the relay's CSPRNG. */
const arenaId = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');

const lookKey = (id) => `look:${id}`;
const secretKey = (id) => `secret:${id}`;
/** SCALE5a: one socket moved between two keys' sets of a kept index (`from`/`to` null for none) - nothing for a dropped
 *  index (`m` null: it is rebuilt whole) or a socket that did not move. */
const keyMove = (m, ws, from, to) => {
  if (!m || from === to) return;
  if (from != null) { const s = m.get(from); if (s) { s.delete(ws); if (!s.size) m.delete(from); } }
  if (to != null) { let s = m.get(to); if (!s) m.set(to, s = new Set()); s.add(ws); }
};
// CARDS6: a stake the room spent (its seat, its refusal, its void), and the cash-outs an account is owed in this room
const stakeKeyOf = (j) => `cstake:${j}`;
const cashoutKeyOf = (sub) => `cashout:${sub}`;
// AUDIT CARDS-6 C1: the ranked Iliac results an account is owed in this room (Hold'em's cash-outs' way), and their bound -
// one a game, the pair's day and season caps the service's, the oldest going past it
const iliacOwedKeyOf = (sub) => `iowed:${sub}`;
const ILIAC_OWED_MAX = 32;
/** KG6: the rated King's Gambit results owed an account in this room, Iliac Hand's law (`iowed:`). */
const gambitOwedKeyOf = (sub) => `gowed:${sub}`;
/** CARDS6: the oldest stake order a void takes, and how long the room remembers a spent stake past that. AUDIT CARDS-4
 *  C6: a receipt's life (net/card/cardReceipt.js CARD_RECEIPT_TTL_S), not a week - a player away a fortnight still voids. */
const HOLDEM_STAKE_VOID_S = CARD_RECEIPT_TTL_S;
const HOLDEM_STAKE_KEEP_S = HOLDEM_STAKE_VOID_S + 24 * 3600;
/** AUDIT SCALE II R3-3 (c): a layer's door to its place's stakes - a void said in a layer, spent where every stake of the
 *  room is spent (the public worker forwards /room/<key> alone, so no page reaches it). */
const HOLDEM_INTERNAL_VOID = '/internal/holdem/void';
/** CARDS6: the most cash-outs an account is owed in one room (AUDIT CARDS-4 B5: each one a stake of at least
 *  HOLDEM_STAKE_MIN_BB big blinds, so the bound is the account's gold, and past it the oldest goes). */
const HOLDEM_OWED_MAX = 64;
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
/** AUDIT (the pre-merge audit, OWN1 O3/O4): A PEER'S FRAME RE-SERIALISED FOR THE FAN - null when it cannot be or should
 *  not be. The fan's bytes are charged BEFORE this (the sent length times the listeners, AUDIT WORLD6b A3 - a dropped
 *  frame costs no stringify), and an honest frame round-trips at exactly that length plus the stamped id; one that
 *  GREW (`1e20` out as twenty-one digits) fanned up to 4.4x what the room's budget was charged, and one nested deep
 *  enough (JSON.parse takes it, stringify overflows) threw out of the socket's handler with the budget already
 *  spent. Either is junk, counted, as a malformed frame is. */
function fanOut(t, id, data, sentLength, g = false) {
  let out;
  try { out = JSON.stringify(g ? { t, id, g: 1, data } : { t, id, data }); } catch { return null; }   // GRANT-DOOR: `g` 1 - the relay vouches the sender's hello said it stands on spawn grants (net/wire.js GRANT_HELLO_LAW)
  return out.length > sentLength + id.length + 8 + (g ? 6 : 0) ? null : out;
}
const questMeter = (at, now) => { const g = questShareGate(at, now); return { bucket: g.at, pass: g.pass }; };
/** TV3: a traveller mark's cooldown in the meters' shape - travHubGate's stamp as the bucket. */
const travMeter = (at, now) => { const g = travHubGate(at, now); return { bucket: g.at, pass: g.pass }; };
/** PARTY-MAP: a Shared Cartography send's cooldown in the meters' shape - amapShareGate's stamp as the bucket. */
const amapMeter = (at, now) => { const g = amapShareGate(at, now); return { bucket: g.at, pass: g.pass }; };
/** AUDIT SOC A5: the most account records an awake object keeps; over it the cache is emptied (storage is the truth). */
const RECS_MAX = 4096;
/** AUDIT RAID R6: the raid ledgers (and their write moments) a cell's instance keeps copies of - a cell holds a handful
 *  of raids; a flood of invented keys filled the maps without end. */
const RAID_CACHE_MAX = 64;
/** AUDIT RAID R2: an account's receipts the hub keeps, those still good at `now`. */
const raidRcLive = (v, now) => (Array.isArray(v) ? v.filter((e) => e && typeof e === 'object' && typeof e.r === 'string' && Number.isFinite(e.until) && now < e.until) : []);
/** AUDIT SOC A1/A8: the most (kind, from, to) cooldown stamps an awake object keeps; over it they are emptied. */
const COOL_MAX = 4096;
/** AUDIT SOC A3: an account nobody's list names - no friend, no request either way, no live invite. AUDIT 68
 *  S01-stale-party-pointer-blocks-sweep: its party is judged by the sweep against the party's own record, not here. */
const unlisted = (r, now) => !!r && !(r.friends?.length) && !(r.in?.length) && !(r.out?.length) && !(r.invites ?? []).some((i) => now - i.at < INVITE_TTL_MS);

/** AUDIT SCALE II R2-11: what an event a shard owes the bus weighs, bytes - a frame its length, a hello or a pose a
 *  bound on what one says. */
const upBytesOf = (ev) => (typeof ev[2] === 'string' ? ev[2].length : 512);
/** AUDIT SCALE II R2-7: how long after a miss a shard tries the bus again, ms - a hand-up, and (HUB-PULL) a poll, whose
 *  every miss in a row doubles it up to HUB_SYNC_MS / 2. */
const HUB_RETRY_MS = 1000;

/** SCALE5c: A SHARD'S SOCKET, AS THE BUS HOLDS IT (net/hubShards.js). The bus runs every law it always ran - an account's
 *  hello and leave, a friend's act, a party's pose, a world line, a receipt handed to an account's newest socket - over the
 *  sockets in its index, and a player on a shard is one of them: this object, which answers a socket's four calls. A frame
 *  sent it is owed its shard (`_vsend`, the delivery its next poll is answered with - HUB-PULL), a close is said to the shard, which closes the real
 *  socket, and its attachment lives here, never the runtime's (nothing is stored for it - a woken bus is told again). */
class ShardSocket {
  constructor(bus, hub, vid) { this.virtual = true; this.hub = hub; this.vid = vid; this.att = null; this.closed = false; this._bus = bus; }
  send(s) { if (this.closed) throw new Error('closed'); this._bus._vsend(this, s); }
  close(code, reason) { if (this.closed) return; this.closed = true; this._bus._vclose(this, code, reason); }
  serializeAttachment(a) { this.att = a; }
  deserializeAttachment() { return this.att; }
}

export class Room {
  constructor(state, env) {
    this._metrics = new RoomMetrics();   // SCALE2b: the room's counts, written to Analytics Engine a window at a time (relayScale.js)
    this._kind = null;                   // SCALE2b: the room's kind for a metric, from the first attachment it reads
    this.state = countedState(state, this._metrics);   // SCALE2b: the storage counted into the metrics, nothing else changed
    // ACC1d: the runtime hands a Durable Object (state, env) and this
    // class had been taking the first alone. The public key and the TTL
    // ceiling are config (bible ACC1d D2/D3), so the object needs it.
    this.env = env ?? {};
    /** The verifying key, imported once per instance. A CryptoKey
     *  cannot be stored, so this is memory and dies with the object -
     *  which is right: it is derived from a config string that cannot
     *  change without a deploy, and a deploy is a new object. */
    this._verifyKey = undefined;   // undefined = not tried, null = there is none
    /** SEAT1b (Seats-Arc 4.2): THE WATCH - each verified account's last tick and last move in this room, ms. Memory: a
     *  deploy or an eviction forgets it, and the next pose that moves starts it again (the account service's daily cap is
     *  what bounds the ticks, never this). Bounded by the room's own sockets, the oldest let go past SOCKETS_MAX. */
    this._watch = new Map();
    /** ACC1d/F8: THE SIGNATURES THIS ROOM HAS ALREADY HONOURED, and
     *  when each stops mattering. A token is spent once (Mac). PER-ROOM
     *  and in memory, because the relay has no global state a hello
     *  could touch without becoming the bottleneck ACC0 refused for
     *  provider links - the record says exactly what that does and does
     *  not close. */
    this._spent = new Map();
    this._owed = new Map();    // SCALE5b: the second wire's batch - socket -> what the room has said it and not yet sent (`_owe`)
    this._owedSoon = null;     // SCALE5b: the batch's timer while a pose is owed (POSE_BATCH_MS)
    this._owedLate = null;     // SCALE5b: and while only a channel's roster is (ROSTER_BATCH_MS)
    /** MOD1: THE NEWEST MUTE ORDER THIS ROOM HAS APPLIED, per account -
     *  `{i, mu, sig}`. Two jobs: an order older than one already applied
     *  is ignored (so a replayed mute cannot undo an unmute inside its
     *  minute), and a hello whose token was minted BEFORE the newest
     *  order here takes the order's word (so a token minted a moment
     *  before the mute cannot carry its holder past it). Memory, bounded
     *  by ORDERS_MAX, oldest out - the account row is the truth and
     *  every later token carries it, so this only has to cover the gap. */
    this._orders = new Map();
    /** AUDIT SAFE RELAY-5: THE NEWEST BAN ORDER THIS ROOM HAS TAKEN, per account - `{i, bn, sig}` (`bn` 0: lifted),
     *  APART from `_orders`: the two shared MOD1's one row, so a newer unmute lifted a ban and an unban lifted a mute
     *  that stood. A ban here closes the account's sockets and refuses its hello while it stands (`_takeOrder`,
     *  `_bannedHello`); a mute order never touches it, nor it a mute. RELAY-7: kept in storage too (BANS_KEY, read
     *  once a wake by `_loadBans`), BANS_MAX at most, each for BAN_KEEP_S. */
    this._bans = new Map();
    this._bansLoad = null;
    /** AUDIT SAFE RELAY-8: A NEW VOICE'S METER, the ACCOUNT's (`a.sub` -> when its last public line here was said) - a
     *  socket's own meter let K sockets of one account say K lines a gap, and a reconnect start a fresh one. Pruned as
     *  it is spent (`_newVoiceSpends`): an entry older than NEW_VOICE_GAP_MS holds nobody back. */
    this._paces = new Map();
    /** GUILD1c: THE REMOVALS AND DISBANDINGS THIS ROOM HAS APPLIED - `gi` (a guild gone) or `gi:gm` (one member gone)
     *  -> the order's `i`, the newest kept. MOD1's `_orders` job for a guild: a hello whose token was minted before one
     *  takes it off, and a guild order older than one changes nothing - so neither a token minted a moment before a
     *  removal nor a replayed join inside its minute carries the member back into the guild's chat. Memory, bounded by
     *  GUILD_OUTS_MAX, oldest out - the roster is the truth and every later token carries it. */
    this._guildOuts = new Map();
    this._guildOutsLoad = null;   // AUDIT MERGE-PLUS A3: the storage read that fills it, once a wake
    this._roomGuild = null;   // GUILD1c: the room's budget for guild-tag fans (GUILD_ROOM_HZ_MAX)
    this._guildChat = null;   // GUILD1c: the hub's budget for guild lines (GUILD_CHAT_ROOM_HZ_MAX), apart from the room's and the parties'
    this._idx = null;   // ws -> attachment, read once (A7); kept by the doors that change the socket set (SCALE2b)
    this._idxAt = -Infinity;   // SCALE2b: when the index was last walked against the runtime's list
    /** SCALE2b: THE ROOM'S HELLO BUCKET (A6), in memory. It was read from storage and written back on every hello -
     *  before the gate refused a storm, so a storm paid two storage operations a hello for its own refusal. The bucket
     *  is `tokenGate`'s, capped at its rate, so it refills whole in one second; a room sleeps only after a quiet spell
     *  far longer than that, so a wake never had anything to read back. Every bucket of this object's own lives on the
     *  instance for the same reason (AUDIT ATTACH, above); this one was the last in storage. */
    this._hellos = null;
    /** SCALE2b: THE IDS' SECRETS (A3), id -> secret (null: none), read from storage the first time a wake asks for an id
     *  (`_secretOf`) and kept; every write and delete keeps the copy. A hello read its id's secret and wrote it back
     *  every time. Read an id at a time, never listed: a deploy drops sockets without their leave, and a hub that never
     *  drains keeps every secret such a drop left behind - a list of them a wake would grow without end. */
    this._secrets = new Bounded(HUB_KEEP_MAX);
    this._asecrets = new Bounded(HUB_KEEP_MAX);   // SCALE2b: the hub's account id -> profile secret (null: none), read once and kept
    this._noGateRcpt = new Bounded(HUB_KEEP_MAX); // SCALE2b: accounts the hub holds no gate receipt for (dropped whole when one is written)
    this._noSdRcpt = new Bounded(HUB_KEEP_MAX);   // SD9a: and no Hour receipt (dropped whole when one is written)
    this._noEgRc = new Bounded(HUB_KEEP_MAX);   // EG-ZA: and no breach receipt held (dropped whole when one is written)
    this._noSerpentRcpt = new Bounded(HUB_KEEP_MAX);   // SCALE5a: and no serpent receipt - the one receipt every hub hello still read from storage (dropped whole when one is written)
    this._noRaidRcpt = new Bounded(HUB_KEEP_MAX); // SCALE2b: and no raid receipts
    this._noStarRcpt = new Bounded(HUB_KEEP_MAX); // STAR3: and no star receipts (dropped whole when one is written)
    this._worldMemo = undefined;   // SCALE2b: the stored world, raw, as `_worldRaw` read it (undefined: not read this wake)
    this._parks = null;            // SCALE2b: a cell's parked teams, key -> record - a promise of the one list a wake
    this._wardenAt = undefined;    // WARDEN1: when the cell's next road team falls due (null: none waits; undefined: its teams not read this wake)
    this._attachedAt = new WeakMap();   // SCALE2b: ws -> when its attachment was last written to the runtime
    this._roomChat = null;   // AUDIT CHAT A2: the room's own chat budget - on the instance, since a sleeping room fans nothing
    this._travFan = null;   // TV3: a region room's fan budget for traveller marks (TRAV_ROOM_HZ_MAX)
    this._travClearFan = null;   // AUDIT DEEP T3-2: and its clears', apart - a flood of either never starves the other
    this._travOwed = new Map();   // AUDIT DEEP2 C2: the clears the room's budget refused, owed (id -> the frame) and said on its next pass
    this._partyChat = null;   // CHAT-CHAN: the hub's budget for party lines (PARTY_CHAT_ROOM_HZ_MAX), apart from the room's
    this._roomFoes = null;   // AUDIT WORLD2 A5: the room's foes byte budget (the frame times its listeners)
    this._roomFoesIn = null;   // AUDIT WORLD6b A3: a cell's foes INGRESS budget, spent at the door before the parse
    this._roomOwn = null;   // OWN1: a world room's own-lane fan budget (anyone's, as a cell's foes are)
    this._roomOwnIn = null;   // OWN1: and its ingress, spent at the door before the parse
    // AUDIT WORLD6b A1/A2: the hit funnel (AUDIT WORLD2 A6) is the DESTINATION socket's own bucket (`hbucket` among its meters), not the room's
    this._roomActs = null;   // WORLD3: the room's action-frame budget (a door, a lever, a platform moved)
    this._roomWho = null;    // AUDIT WORLD6b-iii(e) B1: the room's ask budget (WHO_ROOM_HZ_MAX) - the one arm past the hello that reads storage
    this._looks = new Map(); // AUDIT WORLD6b-iii(e) B1: the looks said hello with, kept on the instance while it is awake - a repeat ask reads no storage; after a hibernation the storage's copy is read once and kept again
    this._roomActBytes = null;   // AUDIT WORLD3 A1: and its BYTE budget - the frame times its listeners, as the foes fan has
    this._roomQuestBytes = null;   // AUDIT PARTY8: the quest fan's byte budget - a 64 KiB share times fifty-six tabs at eight seats
    this._roomWorld = null;      // SLAM11: the memory push's OWN byte budget, borrowing - it used to charge the foes stream's, and a big memory's debt would have stalled live foes
    this._roomSocial = null;     // SOC1: the hub's budget for social acts (SOCIAL_ROOM_HZ_MAX) - over it an act is refused with 'busy'
    this._roomRenown = null;     // AUDIT RENOWN1 SEC-2/WIRE-1: the room's budget for renown fans (RENOWN_ROOM_HZ_MAX) - on the instance, as the chat's is
    this._acctIdx = null;        // SOC1: account -> its hello'd sockets, built from the index when asked; SCALE5a: then KEPT by the doors that change a socket's account (`_reindex`), rebuilt only when the index itself is re-walked
    this._idxSeq = new WeakMap(); this._idxN = 0;   // SCALE5a: each socket's place in the index's own order (`_enter`) - a per-account set is read back in it
    this._idIdx = null;          // SCALE5b: peer id -> its sockets, kept as the account index is - a directed frame's target without a walk (`_idFirst`)
    this._giIdx = null;          // SCALE5c: guild -> its members' sockets, kept the same way - a guild's line without a walk of the whole hub
    this._folds = new WeakMap();   // SCALE5c: an attachment -> its name as a search folds it (`_findNames`)
    this._findRoom = null;       // SCALE5c: the whole hub's search bucket (HUB_FIND_ROOM_HZ_MAX)
    this._everyone = null;       // SCALE5c: { at, s } - everyone online as the bus last said it (`_everyoneSaid`)
    this._busKey = undefined;    // SCALE5c part two: the channel this bus is (its first shard's), never another's
    this._hostMemo = undefined;  // SCALE5b: the room's host (`_hostOf`), kept until a socket's id or hello stamp moves - undefined: not known
    this._seatSaid = undefined;  // SEAT-LIVE: the host the room was last told (`_sayHost`) - undefined: not known since this object woke
    this._relayCfg = undefined;  // SCALE5b: the relay's settings (net/relayCfg.js) - the hub's from its storage, any other room's as the hub last answered
    this._relayCfgAt = -Infinity;   // SCALE5b: when a room not the hub last asked
    this._relayCfgP = null;         // LEASE1: that ask, in flight or settled (`_leaseHeard` waits on it)
    this._rfSaid = false;        // SCALE5b: whether this cell last said it judges the poses that reach it (`_rfSay`)
    // SCALE5c (the bus): its shards' sockets (`ShardSocket`, by the id each shard gives its own), and what is owed each shard
    this._vsocks = new Map();
    this._vper = new Map();      // shard -> how many ShardSockets of its the bus holds (the shards a frame to everyone reaches)
    this._cper = new Map();      // SCALE5d part two: a court's copy -> how many of its sockets the court holds (its beats' reach)
    this._vshut = new Bounded(HUB_KEEP_MAX);   // SCALE5d part two: the ids of the ShardSockets this object closed - never asked to say their hello again
    this._down = new Map();      // shard -> { s: [frames], i: frame -> its index, seg: [Map vid -> [indexes] | {all: index}], cur: the open Map, close: [[vid, code, reason]] }
    this._downT = null;
    // HUB-PULL (2026-10-16): THE BUS NEVER CALLS A SHARD - a sealed delivery waits in its shard's outbox until the shard's
    // poll is answered with it, and stays until the shard says it ran it (the poll's `ack`)
    this._outbox = new Map();    // shard -> [{ q, body }] in order, unacknowledged; `bytes` on the list
    this._polls = new Map();     // shard -> { done, t }: its poll the bus holds while it owes it nothing
    // (a shard) the bus instance whose `rs` it heard - its polls say so, and until one does the bus says `rs` (HUB-PULL audit);
    // and the wake of a poll backing off after a miss, which a hand-up the bus answered calls
    this._rsBoot = null;
    this._pollWake = null;
    this._toldN = new Map();     // shard -> the count its last delivery carried (every shard the bus has handed anything - a hello's words, at least)
    this._countT = null;         // the count's tell, owed within HUB_COUNT_MS of a hello or a leave
    // SCALE5c (a shard): what it owes the bus, and what it knows of the hub
    this._up = [];               // [vid, kind, payload] in the order they happened
    this._upGate = new WeakMap();   // socket -> its frames' bucket on the way up (HUB_UP_HZ_MAX)
    this._upT = null;
    this._upBusy = null;         // the hand-up in flight
    this._vidIdx = new Map();    // vid -> its socket here (rebuilt from the attachments after a wake - `_byVid`)
    this._vidIdxFull = false;
    this._hubKey = undefined;    // this shard's key (undefined: not known yet; null: no shard)
    this._hubTotal = null;       // the hub's count everywhere, as the bus last said it
    this._hubTotalSaid = null;   // the count last said to this shard's sockets
    this._hubCountT = null;
    this._hubSyncAt = 0;         // when this shard last told the bus every socket it holds
    this._hubAlarmed = false;
    this._vseq = 0;
    // AUDIT SCALE II R2-7: EVERY HAND-UP AND DELIVERY NUMBERED. One delivery in flight each way kept the order, and a lost
    // one was lost for good (a world line, a hello's words, a close the bus decided - the link open and mute); one that
    // landed but whose answer was lost, sent again, would run twice. Each is numbered under its sender's instance (`_boot`);
    // one that did not land goes again as it was, and its receiver runs a number it has run once, never twice
    this._boot = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    this._upSeq = 0;              // (a shard) the last hand-up's number
    this._upRetry = null;         // (a shard) the hand-up that did not land: { q, e, live? }, sent again before anything after it
    this._upInFlight = null;      // (a shard) the events of the hand-up on the wire
    this._upHoldUntil = 0;        // (a shard) after a miss, when the next try goes
    this._upBytes = 0;            // (a shard) AUDIT SCALE II R2-11: what `_up` holds, bytes
    this._upSeen = new Map();     // (the bus) shard -> { b, q }: the newest hand-up of its it ran
    this._downSeq = new Map();    // (the bus) shard -> the last delivery's number
    this._downSeen = null;        // (a shard) { b, q }: the newest delivery it ran - HUB-PULL: its poll's `ack`
    this._downGone = new Set();   // (a shard) HUB-PULL: the ids a delivery named that it no longer holds - its next poll tells the bus
    this._pollOn = false;         // (a shard) HUB-PULL: its poll loop runs (one poll at the bus at a time)
    this._shardSeen = new Map();  // (the bus) AUDIT SCALE II R2-9: shard -> when it last handed anything up
    this._silentAt = 0;           // (the bus) when it last let go of a silent shard's sockets
    this._hubKeyKept = null;      // (a shard) AUDIT SCALE II R2-4: the name it last kept in storage (HUB_KEY_KEY)
    this._swept = false;         // SCALE5b: the drain's sweep ran and nothing has said hello since - the next empty room's hello need not sweep again
    this._subIdx = null;         // SCALE5a: verified account (`sub`) -> its hello'd sockets, kept as the account index is - ONE-SEAT's other tabs (`_otherTabsOf`) without a walk of every socket
    this._parties = new Bounded(PARTIES_MAX);   // SOC1: party id -> record, kept while the object is awake (a party pose reads its party once a second; a wake reads storage once and keeps it again)
    this._recs = new Bounded(RECS_MAX);      // AUDIT SOC A5: account id -> record, kept while the object is awake - every write goes through _putAcct/_putAccts so the copy is the storage's; bounded at RECS_MAX
    this._alarmArmed = false;    // AUDIT SOC A3: the sweep's alarm is armed once per instance life (a storage read otherwise on every hello)
    this._cool = new Bounded(COOL_MAX);      // AUDIT SOC A1/A8: "kind from to" -> when a directed act last went through, on the instance (a flood keeps the object awake; a hibernation is a quiet hub); bounded at COOL_MAX
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
    // WB3: A GATE ROOM'S FIGHT (net/gate/gateBrain.js), read from storage once per instance life and checkpointed every
    // CHECKPOINT_MS, so an eviction loses that much of it and not the fight; undefined = not read yet, null = none
    this._fight = undefined;
    this._fightSavedAt = 0;
    // INT11: the boss fights' trails of their bodies' poses, by socket (_trailPose) - in memory alone. AUDIT INT11: and when
    // this instance began keeping them: until a trail's span on, a body with none is not known to stand anywhere (_trailOf)
    this._trails = null;
    this._trailsAt = Date.now();
    this._siege = undefined;   // PVP-REF: a siege room's fighters, by account (storage's `siege` after a wake)
    this._siegeSavedAt = 0;
    this._helloBy = new Map();   // AUDIT-SEATS R3: a battle room's hello buckets, by verified account (_battleHelloGate) - a wake forgets them, as the meters
    this._receiptKey = undefined;   // WB3: the relay's signing key (GATE_SIGNING_KEY), imported once; null = none (the receipts go out unsigned)
    this._leaseKey = undefined;   // LEASE1: the lease key (net/roomLease.js leaseKeyOf), derived once; null = none (no lease handed out, nobody bound)
    this._grants = null;            // GRANT2 (Spawn-Grants.md section 12): a cell's spawn grants (_grantState) - made at its first ask, in memory alone
    this._gateFell = undefined;     // WB3: the hub's last word of a kill, said to a hello while its gate still holds
    this._serpentSiteRec = undefined; // SERPENT2: the hub's record of where the serpent lies, as accounts said it (net/gate/gateHerald.js foldGateSite) - undefined: not read yet
    this._serpentFells = undefined; // SERPENT1: the hub's kills of the latest serpent day, one a site (SERPENT_FELLS_KEY), said to a hello while that day holds
    this._event = undefined;        // EVENT1: the hub's live event, read once (_liveEvent) - undefined: not read yet
    this._raids = new Bounded(RAID_CACHE_MAX);        // RAID3: a cell's raid ledgers read so far (net/raid/raidLaw.js) - AUDIT RAID R1: its identity (key and signature) -> ledger|null; storage is the truth; R6: at most RAID_CACHE_MAX
    this._raidSavedAt = new Map();  // RAID3: when each ledger was last written (a word that moves nothing writes at most every RAID_SAVE_MS)
    this._raidCleaning = new Set(); // RAID3: the raids whose cleanse is being minted - a word that lands meanwhile is not heard (an input gate holds for storage alone, and the mint awaits crypto)
    this._raidSlots = new Map();    // RAID-ROLL: a cell's copy of each day's slots (net/raid/raidLaw.js raidDaySlots) - a few days at most
    this._raidDays = new Map();     // RAID-ROLL: a cell's copy of each day's whole roll from the hub - day -> { ids: Set|null, at }
    this._raidTownsKept = undefined; // RAID-ROLL: the hub's towns table - undefined unread, null none kept, else the regions
    this._raidDayRolls = new Map(); // RAID-ROLL: the hub's day -> [raid identity] off the kept table - a few days at most
    this._stars = new Bounded(4 * STAR_LEDGERS_MAX);   // STAR3: a cell's star ledgers read so far (net/starfall/starfallLaw.js), identity -> ledger|null - never a settled one (`_starKeep`); storage is the truth
    this._starSavedAt = new Bounded(4 * STAR_LEDGERS_MAX);   // STAR3: when each was last written (a word that moves nothing writes at most every STAR_SAVE_MS)
    this._starHolding = new Set();  // STAR3: the stars whose hold is being minted - a word that lands meanwhile is not heard (the raid's _raidCleaning)
    this._starHeld = undefined;     // STAR3: the hub's held stars of the nights still standing, [n, s, px, py, at] - undefined: not read yet
    this._raidTownsUp = new Map();  // RAID-ROLL: the hub's table pieces in flight, a socket's - ws -> { n, parts }
    this._raidCleans = undefined;   // RAID3: the hub's cleansed raids ([key, at, sig] - AUDIT RAID R1), read once - undefined: not read yet
    this._wdun = null;              // PVPDUNGEONS: the hub's halls record (net/wild/wildLaw.js wdun*) - read once a wake
    this._wdunSavedAt = 0;          // PVPDUNGEONS: a heartbeat writes at most every WDUN_HERE_MS; a lock, a death, a reset at once
    this._wdunRate = new WeakMap(); // PVPDUNGEONS: each socket's own bucket for wdun words
    this._wdunKin = new Map();      // PVPDUNGEONS: a place room's answers from the hub, `taker|owner` -> { kin, at }
    this._instanceKin = new Map();  // INSTANCES: an instance room's yeses from the hub, `subject|owner` -> { kin, at } (INSTANCE_KIN_KEEP_MS)
    this._instanceAsked = new WeakMap();   // INSTANCES (the audit): when a member let in as the owner's party was last asked again (_instanceRecheck)
    this._wildLoad = null;          // WILD1: a place room's remains (net/wild/wildLaw.js) - read from storage once an instance life, by its prefix; storage is the truth, written at every change
    this._owLoad = null;            // OW6L: a cell's overworld ledger (net/overworldLaw.js) - the one storage read an instance life, its promise shared by every word and hello that lands while it runs; storage is the truth, written at every change
    this._roomOw = null;            // OW6L: a cell's budget for fanning its ledger's changes (OW_ROOM_HZ_MAX) - on the instance, as the chat's is
    this._herald = undefined;       // DISCORD-GATES: the hub's door to Discord ({hook, role}), read once - undefined: not read yet, null: none (no posts)
    this._gateSiteRec = undefined;  // DISCORD-GATES: the hub's record of where the gate stands, as accounts said it (net/gate/gateHerald.js foldGateSite) - undefined: not read yet
    this._serpents = undefined;     // SERPENT1: the serpents' fights a cell holds, by id (storage's SERPENT_FIGHTS_KEY after a wake) - undefined: not read yet
    this._serpentSavedAt = new Map(); // SERPENT1: when each was last checkpointed
    this._serpentFalling = new Map(); // SERPENT1: the kills being said (one fall at a time a fight - AUDIT WB12d R2's law)
    this._serpentArmedTo = 0;       // SERPENT1: the beat a blow already armed (a volley a frame never re-arms it)
    this._serpentRestAt = 0;        // SERPENT1: when a beating serpent's cell last ran its other duties (_alarmRest)
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
    if (path === GATE_INTERNAL_FELL) return this._gateFellInternal(request);   // WB3: a gate's kill, said to the hub
    if (path === SERPENT_INTERNAL_FELL) return this._serpentFellInternal(request);   // SERPENT1: the serpent's kill, said to the hub
    if (path === RAID_INTERNAL_CLEAN) return this._raidCleanInternal(request);   // RAID3: a raid's cleanse, said to the hub
    if (path === STAR_INTERNAL_HELD) return this._starHeldInternal(request);   // STAR3: a fallen star held, said to the hub
    if (path === RELAY_INTERNAL_CFG) return json(await this._relayCfgOf());   // SCALE5b: a boss's room asking the hub for the relay's settings
    if (path === HUB_INTERNAL_UP) return this._hubUpInternal(request);   // SCALE5c: a shard's hellos, frames and closes, to the bus
    if (path === HUB_INTERNAL_POLL) return this._hubPollInternal(request);   // HUB-PULL: a shard asking for its sockets' frames - the bus never calls a shard
    if (path === RAID_INTERNAL_DAY) return this._raidDayInternal(request);   // RAID-ROLL: a cell asking the hub for the day's roll
    if (path === WDUN_INTERNAL_RESET) return this._wdunResetInternal(request);   // PVPDUNGEONS: the hub wiping a hall's world room
    if (path === INSTANCE_INTERNAL_KIN) return this._instanceKinInternal(request);   // INSTANCES: an instance room asking the hub whether an account's party holds its owner
    if (path === WDUN_INTERNAL_KIN) return this._wdunKinInternal(request);   // PVPDUNGEONS: a place room asking the hub whether two accounts share a party
    if (path === WDUN_INTERNAL_GONE) return this._wdunGoneInternal(request);   // PVPDUNGEONS: a place room saying a fallen's remains are gone
    if (path === WILD_INTERNAL_VIT) return this._wildVitInternal(request);   // INT9 (AUDIT): a place room keeping, or asking back, a zone fighter's vitality
    if (path === RITE_INTERNAL_BROKEN) return this._riteBrokenInternal(request);   // WB12d: a circle's rite broken, said to the hub
    if (path === RITE_INTERNAL_DAY) return this._riteDayInternal(request);   // WB12d: a breach's room asking the hub for the rite's helpers
    if (path === ARENA_INTERNAL_OPEN) return this._arenaOpenInternal(request);   // ARENA4: the hall opening a matched bout's room
    if (path === ARENA_INTERNAL_LIVE) return this._arenaLiveInternal(request);   // ARENA4: a bout telling the hall it stands (or is done)
    if (path === SD_INTERNAL_CENSUS) return this._sdCensusInternal();   // SD3: the hub asking a region's channel how many stand in it
    if (path === SD_INTERNAL_FOUND) return this._sdFoundInternal(request);   // SD3: a cell telling the hub a Hollow found
    if (path === SD_INTERNAL_LIVE) return this._sdLiveInternal();   // SD3: the Worker or a realm asking the hub its record
    if (path === SD_INTERNAL_FELL) return this._sdFellInternal(request);   // SD8b: a realm telling the hub its Remnant fell
    if (path === SD_INTERNAL_IN) return this._sdInInternal(request);   // SD-THROUGH: a realm telling the hub its first soul stepped through
    if (path === EG_INTERNAL_OPEN) return this._egOpenInternal(request);   // EG-PLAY: the hub opening a breach's room
    if (path === EG_INTERNAL_HERALD) return this._egHeraldInternal(request);   // EG-E3: a breach's room telling the hub its news, for the herald
    if (path === EG_INTERNAL_LIVE) return this._egLiveInternal();   // EG-H2: the Worker asking the hub the Spire's live breaches
    if (path === EG_INTERNAL_STAGE) return this._egStageInternal();   // EG-H2: the hub asking a breach's room where it stands
    if (path === EG_INTERNAL_VOID) return this._egVoidInternal(request);   // EG-ZA: the hub asking a breach's room to void an order it never took
    if (path === EG_INTERNAL_CALLED) return this._egCalledInternal(request);   // EG-ZA: the hub telling a breach's room its call went out
    if (path === EG_INTERNAL_RCPT) return this._egRcInternal(request);   // EG-ZA: a breach's room telling the hub the receipts it minted
    if (path === HOLDEM_INTERNAL_VOID) return this._holdemVoidInternal(request);   // AUDIT SCALE II R3-3 (c): a layer's void, spent by its place
    if (path === SAFE_INTERNAL_LAW) return this._lawInternal(request);   // SAFE4: an order the account service pushed through the Worker's door
    const key = roomOf(new URL(request.url).pathname);
    if (!key || (key.startsWith('owned:') && !privateInteriorOf(key))) return json({ error: 'no such private room' }, 404);
    // AUDIT WB A1: A SEAT IS A HELLO'S. A socket that opened and never said hello kept its seat for as long as it stood
    // open, so one page's loop could fill a room with silence and every player after it was refused 'room full' - a
    // gate's court included, for its whole day. Each socket is stamped as it opens; a full room first closes the silent
    // ones past HELLO_WAIT_MS (busy - a real client retries), and is full only if it still is.
    const cap = isChatRoom(key) ? CHAT_SOCKETS_MAX : SOCKETS_MAX;
    const walked = isLayered(key) || isGateRoom(key);   // SCALE5d: the rooms the Worker's walk reaches (relayScale.js layerWalk)
    // AUDIT SCALE II R3-3: AN ASKED LAYER THAT HOLDS NOBODY IS NO PAGE'S TO OPEN - the walk starts again at the place
    // (LAYER_EMPTY_HEADER), and this layer is admitted only when that walk reaches it in turn
    if (walked && layerOf(request.headers.get(LAYER_HEADER)) > 0 && request.headers.get(LAYER_ASK_HEADER) === '1' && !this.state.getWebSockets().length) { const empty = json({ error: 'layer empty' }, 503); empty.headers.set(LAYER_EMPTY_HEADER, '1'); return empty; }
    // AUDIT SCALE II R1-5: double13 is the sockets refused `room full` - a full layer the walk passes on from refused
    // nobody, so only the walk's last try counts (LAYER_LAST_HEADER), and a room no walk reaches always does
    if (this.state.getWebSockets().length >= cap) { this._unseatSilent(Date.now()); if (this.state.getWebSockets().length >= cap) { if (!walked || request.headers.get(LAYER_LAST_HEADER) === '1') this._metrics.c.full++; this._metricsTick(); const full = json({ error: 'room full' }, 503); full.headers.set(LAYER_FULL_HEADER, '1'); return full; } }   // SCALE5d: said full, so the Worker walks on to the next layer   // SCALE5b: counted   // the runtime drops a socket the object closed from the list at once (AUDIT WORLD34 D1)
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // hibernation API: the object may sleep between messages; every
    // socket carries its own state in the attachment - the room's key
    // included - and the look sits in storage under the id (its meters
    // are the instance's: AUDIT ATTACH)
    this.state.acceptWebSocket(server);
    const ly = isLayered(key) || isGateRoom(key) ? layerOf(request.headers.get(LAYER_HEADER)) : 0;   // SCALE5d part two: and a gate court's copy   // SCALE5d: the layer the Worker says this object is
    const att = { key, id: null, name: null, pose: null, at: Date.now(), ...(ly ? { ly } : {}) };   // AUDIT WB A1: when it opened
    server.serializeAttachment(att);
    this._adopt(server, att);
    return new Response(null, { status: 101, webSocket: client });
  }
  /** SCALE2b: a socket the runtime has just accepted, into the index - the one door a socket comes in by (the index
   *  is never rebuilt for one; a wake's first `_all` reads every socket the runtime holds). */
  _adopt(ws, att) { if (!this._idx) return; const was = this._idx.get(ws); if (!was) this._enter(ws); this._idx.set(ws, att); this._reindex(ws, was, att); if (this._idx.size > this._metrics.c.peak) this._metrics.c.peak = this._idx.size; }   // SCALE5a: its place in the index's order; SCALE5b: and in the kept indexes (a socket accepted with no id moves none)
  /** SCALE5a: a socket NEW to the index takes the next place in its order - the order a walk of the index gives (a Map's
   *  insertion order: a key set again keeps its place, a key deleted and set again goes last, as here). */
  _enter(ws) { this._idxSeq.set(ws, ++this._idxN); }
  /** AUDIT WB A1: every socket past HELLO_WAIT_MS with no hello closed, busy (a slow client retries and says it); a socket
   *  from before the stamp (an older build's, awake across a deploy) counts from now. */
  _unseatSilent(now) {
    for (const [ws, a] of [...this._all()]) {
      if (a.id || a.replaced || this._dead.has(ws)) continue;
      if (!Number.isFinite(a.at)) { this._setAttach(ws, { ...a, at: now }); continue; }
      if (now - a.at < HELLO_WAIT_MS) continue;
      try { ws.close(CLOSE_BUSY, 'no hello'); } catch { /* gone */ }
      this._dead.add(ws);
      this._closed(ws);   // SCALE2b
    }
  }

  /** Every socket with its attachment, read once.
   *  SCALE2b (2026-10-04): KEPT, NOT RE-CHECKED ON EVERY CALL. This asked the runtime for the whole socket list and
   *  walked it against the index on every call - three times a pose, nine a hello - so the index cost O(N) whether or
   *  not anything had changed. The index is kept by the doors that change the set (the accept in `fetch` adds, `_leave`
   *  and `_forget` remove) and trusted for IDX_TRUST_MS; past that, one walk against the runtime's list takes in any
   *  socket the doors did not see and lets go of any it no longer holds - KEEPING the entries it already has, whose
   *  attachments are newer than the stored ones (a pose's write is lazy - `_setAttach`). */
  _all() {
    const now = Date.now();
    if (this._idx && now - this._idxAt < IDX_TRUST_MS) return this._idx;
    const sockets = this.state.getWebSockets();
    if (!this._idx) { this._idx = new Map(); this._acctIdx = null; this._subIdx = null; this._idIdx = null; this._giIdx = null; this._hostMemo = undefined; }
    let moved = false;
    if (this._idx.size) { const live = new Set(sockets); for (const ws of [...this._idx.keys()]) if (!live.has(ws) && !ws.virtual) { this._idx.delete(ws); moved = true; } }   // SCALE5c: a shard's socket is never the runtime's
    for (const ws of sockets) if (!this._idx.has(ws)) { let a; try { a = ws.deserializeAttachment() ?? {}; } catch { a = {}; } this._enter(ws); this._idx.set(ws, a); moved = true; }
    if (moved) { this._acctIdx = null; this._subIdx = null; this._idIdx = null; this._giIdx = null; this._hostMemo = undefined; }   // SOC1: rebuilt with the index; SCALE5a: the subject index too; SCALE5b: the id index and the host
    this._idxAt = now;
    return this._idx;
  }
  /** SOC1: the hello'd sockets of each account - one pass over the index.
   *  SCALE5a (2026-10-10, Mac: "we just hit 500 online people"): AND THEN KEPT. Every hello and every leave changed an
   *  account (`_setAttach`, `_forget`) and dropped this whole, so the next `_socketsOf` - the hub's hello asks it for its
   *  own account, its leave the same - walked every socket again: one O(N) rebuild per hello, so a relay deploy's
   *  reconnect wave at the hub was O(N^2) in this alone. The doors that change a socket's account now move that one
   *  socket (`_reindex`); the whole is rebuilt only when the index is re-walked (`_all`). Each account's sockets are a
   *  set, read back in the index's own order (`_socketsOf`) - the order this walk gave. */
  _byAcct() {
    this._all();   // SCALE5a: kept, it is never staler than the socket index - past IDX_TRUST_MS a walk that finds the runtime's list moved drops it
    if (this._acctIdx) return this._acctIdx;
    const m = new Map();
    for (const [ws, a] of this._all()) if (a.id && a.acct) { let s = m.get(a.acct); if (!s) m.set(a.acct, s = new Set()); s.add(ws); }
    return (this._acctIdx = m);
  }
  /** SCALE5a: one socket's place in the kept account index, from what its attachment was to what it is (either absent) -
   *  a socket is in it while it has said hello with an account. Nothing while the index is dropped: it is rebuilt whole. */
  _reindex(ws, was, a) {
    keyMove(this._acctIdx, ws, was?.id && was.acct ? was.acct : null, a?.id && a.acct ? a.acct : null);
    keyMove(this._subIdx, ws, was?.id && was.sub ? was.sub : null, a?.id && a.sub ? a.sub : null);   // and the subject index
    keyMove(this._idIdx, ws, was?.id || null, a?.id || null);   // SCALE5b: and the id index
    keyMove(this._giIdx, ws, was?.id && was.gi ? was.gi : null, a?.id && a.gi ? a.gi : null);   // SCALE5c: and the guild index
    if ((was?.id || null) !== (a?.id || null) || (was?.since ?? 0) !== (a?.since ?? 0)) this._hostMemo = undefined;   // SCALE5b: the host is asked again once an id or a hello stamp moves
  }
  /** SCALE5a: the hello'd sockets of each verified account (`sub`) - built as `_byAcct` is, kept the same way. */
  _bySub() {
    this._all();   // as `_byAcct`'s
    if (this._subIdx) return this._subIdx;
    const m = new Map();
    for (const [ws, a] of this._all()) if (a.id && a.sub) { let s = m.get(a.sub); if (!s) m.set(a.sub, s = new Set()); s.add(ws); }
    return (this._subIdx = m);
  }
  /** SCALE5b: the sockets of each peer id - built as `_byAcct` is, kept the same way. */
  _byId() {
    this._all();   // as `_byAcct`'s
    if (this._idIdx) return this._idIdx;
    const m = new Map();
    for (const [ws, a] of this._all()) if (a.id) { let s = m.get(a.id); if (!s) m.set(a.id, s = new Set()); s.add(ws); }
    return (this._idIdx = m);
  }
  /** SCALE5c: the hello'd sockets of each guild - built as `_byAcct` is, kept the same way. */
  _byGuild() {
    this._all();   // as `_byAcct`'s
    if (this._giIdx) return this._giIdx;
    const m = new Map();
    for (const [ws, a] of this._all()) if (a.id && a.gi) { let s = m.get(a.gi); if (!s) m.set(a.gi, s = new Set()); s.add(ws); }
    return (this._giIdx = m);
  }
  /** SCALE5b (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
   *  increasing performance"; bible/11-Multiplayer/Scale-Arc.md SCALE5b): A DIRECTED FRAME'S TARGET WITHOUT A WALK. A
   *  blow, a heal, a who's answer and every act at one peer found its socket by copying the whole index and searching
   *  it - O(N) and an array of N a frame, in a full cell at every blow. The first socket but `except` holding `id`, in
   *  the index's order, with its attachment - exactly what `[...this._all()].find(([o, b]) => o !== except && b.id ===
   *  id)` answered - read off the id's own sockets (one, but for a reconnect's moment). */
  _idFirst(id, except = null) {
    if (!id) return null;
    const s = this._byId().get(id);
    if (!s) return null;
    let best = null, seq = Infinity;
    for (const ws of s) { if (ws === except) continue; const q = this._idxSeq.get(ws) ?? 0; if (q < seq) { seq = q; best = ws; } }
    return best ? [best, this._all().get(best)] : null;
  }
  /** SCALE5a: a set's sockets in the index's own order - what a walk of the index would have listed. */
  _inOrder(set) {
    const list = [...set];
    if (list.length > 1) { const seq = this._idxSeq; list.sort((x, y) => (seq.get(x) ?? 0) - (seq.get(y) ?? 0)); }
    return list;
  }
  /** SOC1: an account's hello'd sockets (ACCOUNT_TABS_MAX at most - AUDIT SOC A10), `except` one (a socket on its way out).
   *  SCALE5a: in the index's order, as the walk that built them gave it - a fresh array each ask. */
  _socketsOf(acct, except = null) {
    const s = this._byAcct().get(acct);
    if (!s) return [];
    let list = this._inOrder(s);
    // AUDIT SOC A10: THE BOUND IS THE HUB'S, not the projection's alone - ACCOUNT_TABS_MAX sockets per account, and the
    // NEWEST of them (by the hello's `since`): a ninth tab is the one the player just opened, and the one that drops
    // off the end is the stalest. Sorted only for an account over the bound, which nobody real is.
    if (list.length > ACCOUNT_TABS_MAX) { const idx = this._all(); list.sort((x, y) => (idx.get(y)?.since ?? 0) - (idx.get(x)?.since ?? 0)); list = list.slice(0, ACCOUNT_TABS_MAX); }
    return except ? list.filter((ws) => ws !== except) : list;
  }
  /** ONE-SEAT: the hello'd sockets of another TAB of the verified account `sub` - not `ws`, and not a socket of the
   *  same peer id (the tab's own old socket, which a reconnect replaces). By the verified subject, never the hub's
   *  browser-profile account: a phone and a desk signed in as one player are one player. AUDIT ONESEAT R4: and never
   *  a socket this object already closed (a runtime may list it until the close completes), or the tab that took
   *  the seat would find the one it closed still holding it, and its own reconnect refused. */
  _otherTabsOf(sub, ws, id) {
    const out = [];
    const tabs = this._bySub().get(sub);   // SCALE5a: the account's own sockets, never a walk of every socket in the hub
    if (!tabs) return out;
    const idx = this._all();
    for (const other of this._inOrder(tabs)) { const b = idx.get(other); if (other !== ws && b?.id && b.id !== id && b.sub === sub && !this._dead.has(other) && !this._gone.has(other)) out.push(other); }
    return out;
  }
  /** SCALE5a (PERF-RELAY1's lesson, `_poseFrame`): THE HELLO'S WALKS, METHODS OF THEIR OWN. `_message` is past V8's
   *  ceiling for an optimized function, so a loop written inside it runs in the interpreter for the life of the object -
   *  and a hub's hello walked every socket three times there (its id's other sockets, everyone else, the join's fan).
   *  Each is here, small enough to be optimized, and reads exactly what its loop read. */
  /** The sockets but `ws` holding the id `id` - a reconnect's old socket, which it replaces. A list, made before any is
   *  replaced. */
  _withId(id, ws) {
    const s = id ? this._byId().get(id) : null;   // SCALE5b: the id's own sockets, never a walk of every socket
    if (!s) return [];
    const idx = this._all(), out = [];
    for (const other of this._inOrder(s)) if (other !== ws) out.push([other, idx.get(other)]);
    return out;
  }
  /** Everyone but `ws` the room can name - hello'd, and never a socket this object closed or whose leave is said
   *  (AUDIT DEEP2 C, ONE-SEAT R4's rule): their attachments, in the index's order. */
  _othersOf(ws) {
    const out = [];
    for (const [other, b] of this._all()) if (other !== ws && b.id && !this._dead.has(other) && !this._gone.has(other)) out.push(b);
    return out;
  }
  /** AUDIT SCALE5a C1-C3: how many the room can name - hello'd, never a socket this object closed or whose leave is said
   *  (`_othersOf`'s rule, the joiner's own socket counted): the welcome's `n`, said again on a channel's every leave. */
  _namedCount() { let n = 0; for (const [ws, b] of this._all()) if (b.id && !this._dead.has(ws) && !this._gone.has(ws)) n++; return n; }
  /** One frame to every hello'd socket but `ws` - the index walked in place, never copied: a failed send forgets its
   *  socket mid-walk (`_closed`), which a Map's own iteration takes (the entry gone is not visited), and nothing here
   *  adopts one. */
  _fanBut(ws, out) { for (const [other, b] of this._all()) if (other !== ws && b.id) this._send(other, out); }
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
    this._cool.set(key, now);   // SCALE2b: bounded, the oldest first (the oldest is the most expired) - never a clear that forgets every cooldown
    return false;
  }
  /** One socket's attachment: the index's, or the socket's own when it is already gone from the set (a closing socket still carries its id). */
  _attach(ws) { const idx = this._all(); if (idx.has(ws)) return idx.get(ws); try { return ws.deserializeAttachment() ?? {}; } catch { return {}; } }
  /** SCALE2b: `lazy` - a pose's write. Every pose rewrote the socket's whole attachment (a 2 KiB JSON stored by the
   *  runtime), most of it unchanged; the index - what every reader in this object reads - takes the pose at once, and
   *  the runtime's copy, which only a wake reads, is written at most every ATTACH_LAZY_MS (and at once by any eager
   *  write, which carries the latest pose with it). A wake loses at most that much of a moving player's pose; the
   *  next pose sets it right. */
  _setAttach(ws, a, lazy = false) {
    if (ws.court) { ws.att = a; return true; }   // SCALE5d part two: a copy's socket is the fight's alone - never the court's index, so no crowd walk meets it
    const now = Date.now();
    if (!lazy || !(now - (this._attachedAt.get(ws) ?? -Infinity) < ATTACH_LAZY_MS)) {
      try { ws.serializeAttachment(a); } catch { return false; }
      this._attachedAt.set(ws, now);
    }
    const idx = this._all(), was = idx.get(ws);
    if (ws.virtual && was) this._vlaw(ws, was, a);   // AUDIT SCALE II R2-5: a ShardSocket's law moved - said to its shard
    if (!was) this._enter(ws);   // SCALE5a: new to the index - last in its order
    this._reindex(ws, was, a);   // SOC1: the account index follows the ids alone - a pose's write leaves it standing; SCALE5a: moved, not dropped
    idx.set(ws, a);
    return true;
  }
  _forget(ws) { this._owed.delete(ws); const a = this._idx?.get(ws); if (this._idx?.delete(ws)) this._reindex(ws, a, null); }   // SCALE5b: and owed nothing   // SCALE5a: out of the account index too - not the whole of it dropped

  /** SCALE5b: THE SECOND WIRE'S BATCH (wire.js POSE_BATCH_MS, ROSTER_BATCH_MS, wire2Batch). What the room fans to a
   *  socket whose hello offered `w2` is OWED it, in the order the room said it - a pose as its slim entry (`[id, pose]`,
   *  built once a pose), a channel's join or leave as its whole frame - and goes out as ONE frame: at the batch's end,
   *  or sooner, ahead of any other frame the room sends that socket (`_send`), so nothing the room says overtakes what
   *  it said before. A queue that reaches WIRE2_BATCH_MAX goes out at once - a reader takes no more. */
  _owe(ws, item, ms = POSE_BATCH_MS) {
    let q = this._owed.get(ws);
    if (!q) this._owed.set(ws, q = []);
    q.push(item);
    this._metrics.c.owed++;
    if (q.length >= WIRE2_BATCH_MAX) { this._flushOwedOf(ws); return; }
    if (ms <= POSE_BATCH_MS) { if (!this._owedSoon) this._owedSoon = setTimeout(() => this._flushOwed(), POSE_BATCH_MS); }
    else if (!this._owedSoon && !this._owedLate) this._owedLate = setTimeout(() => this._flushOwed(), ms);
  }
  _flushOwedOf(ws) {
    const q = this._owed.get(ws);
    if (!q) return;
    this._owed.delete(ws);
    this._metrics.c.batches++;
    this._send(ws, wire2Batch(q));
  }
  _flushOwed() {
    clearTimeout(this._owedSoon); clearTimeout(this._owedLate);
    this._owedSoon = this._owedLate = null;
    for (const ws of [...this._owed.keys()]) this._flushOwedOf(ws);
  }
  /** SCALE5b: a channel's join or leave - to a socket of the second wire, owed it for the roster's batch; to any other,
   *  at once, as `_fanBut` says it. */
  _fanRoster(ws, out) { for (const [other, b] of (this._vper.size ? this._reals() : this._all())) if (other !== ws && b.id && !other.virtual) { if (b.w2) this._owe(other, out, ROSTER_BATCH_MS); else this._send(other, out); } }   // SCALE5c: a shard's sockets hear their own shard's roster - the bus's walk is its own sockets'
  /** SCALE5b: DOES THIS CELL JUDGE THE POSES THAT REACH IT - a duel's bout (INT8), the Wild zone's fighters (INT9), a sea
   *  serpent's fight (SERPENT1, INT11's trails and INT13's hulls)? Each reads every pose a fighter's socket here says, a
   *  halo's copy too, and a client thins what it says to a halo that is none of these (online.js haloPoseDue, HALO-THIN) -
   *  so the room says which it is: in its welcome (`rf`) and, when it moves, to the second wire's sockets (`_rfSay`). */
  _refereesPoses() { return !!(this._duelRef?.bouts?.size || this._wildRef?.fighters?.size || this._serpents?.size); }
  /** SCALE5b: the referee's word, said again - `{t:'rf', on}` to every socket of the second wire, each a halo's or a cell's. */
  _rfSay() {
    const rf = this._refereesPoses();
    this._rfSaid = rf;
    const out = JSON.stringify({ t: 'rf', on: rf ? 1 : 0 });
    for (const [ws, b] of this._all()) if (b.id && b.w2) this._send(ws, out);
  }
  /** SCALE5b: A BEAT'S FRAMES, ONE FRAME A LISTENER. A boss's beat (the gate's, a siege's, a Remnant's, a serpent's, a
   *  bout's) said each of its frames as a send of its own to every socket that hears it; a socket of the second wire
   *  hears them as one frame batch (wire.js wire2Batch) - at once, never waiting on a batch's timer - and any other one
   *  send a frame as before, a send that fails ending that socket's (its close is said). The index walked in place. */
  _fanFrames(outs, hears) {
    if (!outs.length) return;
    let one = null;
    for (const [ws, b] of this._all()) {
      if (!hears(b)) continue;
      if (b.w2 && outs.length > 1) { this._metrics.c.owed += outs.length; this._metrics.c.batches++; this._send(ws, one ??= wire2Batch(outs)); }
      else for (const s of outs) if (!this._send(ws, s)) break;
    }
  }
  /** SCALE5c: THE HUB'S WORDS TO A HELLO, after its welcome and its join - the account's picture, the world's kills,
   *  rites, raids and Hour, this account's receipts - said by the bus to a socket of its own or to a shard's
   *  (ShardSocket), the same words either way. Each contained, as they always were. */
  async _hubHelloWords(ws, m, sub, now) {
    // SOC1: the account, in the hub - after the welcome and the join, so a client's session has reset on the
    // welcome before its picture lands; a hello naming none is a build before this slice, admitted as it was
    if (m.acct) { try { await this._helloAccount(ws, m, now); } catch (e) { console.warn('[hub] account hello failed', e?.message ?? e); } }   // AUDIT SOC A2: contained, as the acts and the leave are
    // WB3: a gate's kill said while this player was away, while that gate still stands - so it collapses on their screen too
    { try { const g = await this._gateFellOf(); if (g && gateHolds(g.d, now)) this._send(ws, JSON.stringify({ t: 'gate', ...g })); } catch (e) { console.warn('[hub] gate word failed', e?.message ?? e); } }
    // SERPENT1: and a sea serpent's, while its day holds - its ring on their map reads slain, its lines are not said;
    // AUDIT SERPENT S1: each site's kill (a client hears its own site's); S5: and this account's receipt while it is good
    { try { const g = await this._serpentFellsOf(); if (g && serpentHolds(g.d, now)) for (const fell of g.list) this._send(ws, JSON.stringify({ t: 'serpent', ...fell })); } catch (e) { console.warn('[hub] serpent word failed', e?.message ?? e); } }
    if (sub) { try { await this._serpentReceiptTo(ws, sub, now); } catch (e) { console.warn('[hub] serpent receipt failed', e?.message ?? e); } }
    // AUDIT WB A4: and this account's receipt, while it is good (spent, it goes)
    if (sub) { try { await this._gateReceiptTo(ws, sub, now); } catch (e) { console.warn('[hub] gate receipt failed', e?.message ?? e); } }
    // SD9a: and this account's Hour receipt, while it is good (spent, it goes)
    if (sub) { try { await this._sdReceiptTo(ws, sub, now); } catch (e) { console.warn('[hub] sd receipt failed', e?.message ?? e); } }
    // EG-PLAY: and a breach's call to this account, while its open window stands (a member whose page reloaded hears it again)
    if (sub) { try { await this._egCallTo(ws, sub, now); } catch (e) { console.warn('[hub] eg call failed', e?.message ?? e); } }
    // EG-ZA (section 23): and every breach receipt the hub holds for this account, until its account says each is counted
    if (sub) { try { await this._egReceiptTo(ws, sub, now); } catch (e) { console.warn('[hub] eg receipts failed', e?.message ?? e); } }
    // WB12d: the faithful's rite broken while this player was away, while its circle still stands
    // BROKER-CAGE: and its faithful every one fallen - the Broker's cage open - until the Wrath's midnight (cageStands: a
    // Warden fallen early takes the circle, never her)
    {
      try {
        const r = await this._riteOf();
        if (r) {
          const stands = riteStands(r.d, now, await this._fellAtOf(r.d)), caged = cageStands(r.d, now);
          for (const c of Object.values(r.c)) {
            if (c.said && stands) this._send(ws, JSON.stringify({ t: 'rite', ...riteSaid(r.d, c) }));   // each circle said (a client hears its own)
            if (c.cl && caged) this._send(ws, JSON.stringify({ t: 'rite', ...cageSaid(r.d, c) }));
          }
        }
      } catch (e) { console.warn('[hub] rite word failed', e?.message ?? e); }
    }
    // RAID3: the raids cleansed today and yesterday - so a raid this player's machine still holds open is closed quietly,
    // never said withdrawn (the cleanse's own word went out while they were away)
    { try { const l = await this._raidCleansOf(now); if (l.length) this._send(ws, JSON.stringify({ t: 'raid', k: 'cls', l })); } catch (e) { console.warn('[hub] raid word failed', e?.message ?? e); } }
    // AUDIT RAID R2: and this account's raid receipts the hub holds - an earner who was not in the town's cell at the
    // cleanse, or whose link dropped at it, is handed them here (the account service counts each once)
    if (sub) { try { await this._raidReceiptsTo(ws, sub, now); } catch (e) { console.warn('[hub] raid receipts failed', e?.message ?? e); } }
    // STAR3: the night's held stars - a star this player's machine would stand open is gold, and never sprung again - and
    // this account's star receipts the hub holds (an earner whose link dropped at the hold is handed them here)
    { try { const l = await this._starHeldOf(now); if (l.length) this._send(ws, JSON.stringify({ t: 'star', k: 'hds', l })); } catch (e) { console.warn('[hub] star word failed', e?.message ?? e); } }
    if (sub) { try { await this._starReceiptsTo(ws, sub, now); } catch (e) { console.warn('[hub] star receipts failed', e?.message ?? e); } }
    // RAID-ROLL: and, while the hub holds no towns table its operator pinned, the ask for one by its hash - any
    // client whose own table hashes to it hands it over (the relay never holds the game's files)
    { try { const h = await this._raidTownsWanted(); if (h) this._send(ws, JSON.stringify({ t: 'raid', k: 'tw', h })); } catch (e) { console.warn('[hub] raid towns ask failed', e?.message ?? e); } }
    // SD3: and the Super dungeon's record - a Hollow risen, found, fallen or gone - so a player who joins mid-life stands it
    // (or, inside one gone while they were away, is cast out); an older client drops a frame type it does not know
    { try { const r = await this._sdOf(); if (r && r.s > 0) this._send(ws, JSON.stringify({ t: 'sd', k: 'ev', ...r })); } catch (e) { console.warn('[hub] sd word failed', e?.message ?? e); } }
    // QUEST-HOME: and the homes moved in the last HOME_WORDS_KEEP_MS, in the order they moved - a page whose boot read of
    // every town's homes went out before one and whose hub link opened after it hears it here; an older client drops a
    // frame type it does not know
    {
      try {
        const l = (await this._homeWordsHeld(now)).map((w) => ({ m: w.m, u: w.u, d: w.d, i: w.i }));
        if (l.length) this._send(ws, JSON.stringify({ t: 'home', l }));
      } catch (e) { console.warn('[hub] home words failed', e?.message ?? e); }
    }
  }
  // ─────────────────────── SCALE5c: THE HUB, SIXTEEN WAYS (net/hubShards.js) ───────────────────────
  /** The hub's count as a shard says it: the bus's (everyone on every shard and the bus's own), never under the shard's. */
  _hubN(local) { return this._hubTotal != null ? Math.max(this._hubTotal, local) : local; }
  /** A shard's attachment as the bus keeps it on the ShardSocket - the socket's id, badge and account, never its place,
   *  its room, its wire or the shard's own bookkeeping. */
  _shardAtt(a) { const { key, pose, hm, at, w2, vid, ly, ld, ...att } = a; void key; void pose; void hm; void at; void w2; void vid; void ly; void ld; return att; }   // LEASE1: a socket's lease is its shard's to keep (`ld`)
  /** (a shard) A socket that came to the wrong shard is told the right one, and closed - nothing written. */
  _hubHop(ws, key) {
    this._send(ws, JSON.stringify({ t: 'hub', key }));
    try { ws.close(CLOSE_HUB, 'hub'); } catch { /* already closed */ }
    this._dead.add(ws);
    this._closed(ws);
  }
  /** (a shard) The socket holding `vid`, or null - the index's, rebuilt once after a wake (an instance starts with none). */
  _byVid(vid) {
    const ws = this._vidIdx.get(vid);
    if (ws || this._vidIdxFull) return ws ?? null;
    this._vidIdxFull = true;
    for (const [w, b] of this._all()) if (b.vid && b.id) this._vidIdx.set(b.vid, w);
    return this._vidIdx.get(vid) ?? null;
  }
  /** (a shard) A frame of its socket's, handed to the bus - never past the largest frame the hub takes, and on a gate of
   *  the shard's own (HUB_UP_HZ_MAX), so no socket floods the bus with frames it would only refuse: over it, a junk strike. */
  _hubForward(ws, a, message) {
    if (message.length > HUB_FRAME_MAX) { this._refuse(ws, 'frame too large'); return; }
    const g = tokenGate(this._upGate.get(ws), Date.now(), HUB_UP_HZ_MAX, HUB_UP_BURST);
    this._upGate.set(ws, g.bucket);
    if (!g.pass) { this._junk(ws); return; }
    // AUDIT SCALE II R2-11: a bus that takes nothing (down, or slow) - past HUB_UP_QUEUE_BYTES a frame is dropped and
    // counted, never queued without end
    if (this._upBytes + message.length > HUB_UP_QUEUE_BYTES) { this._metrics.c.drops++; return; }
    this._hubUpOwe(a.vid, 'f', message);
  }
  /** (a shard) What it owes the bus, in the order it happened - handed up within HUB_BATCH_MS. */
  _hubUpOwe(vid, kind, payload) {
    const ev = [vid, kind, payload];
    this._up.push(ev);
    this._upBytes += upBytesOf(ev);   // AUDIT SCALE II R2-11
    if (!this._upT) this._upT = setTimeout(() => { this._upT = null; this._hubUpFlush(); }, HUB_BATCH_MS);
    this._hubPollEnsure();   // HUB-PULL: a shard with anything to say holds a socket - it asks the bus for that socket's frames
  }
  /** (a shard) Every socket it holds, by the id the bus knows it by. */
  _hubLive() { const out = []; for (const [w, b] of this._all()) if (b.id && b.vid && !this._dead.has(w) && !this._gone.has(w)) out.push(b.vid); return out; }
  /** (a shard) A socket the bus says it does not hold (a bus woken, a hello lost): its hello said again. AUDIT SCALE II
   *  R2-1: with the id's secret, which the bus asks as the hub's hello always asked it; R3-6: marked said again (`re`), so
   *  a court admits a socket it held before it woke by the clock alone. Answers the events, for the caller to place. */
  _hubRehelloEvents(vid) {
    const ws = this._byVid(vid);
    if (!ws) return [];
    const a = this._attach(ws);
    if (!a.id) return [];
    const out = [[vid, 'h', { att: this._shardAtt(a), m: { acct: a.hm?.acct ?? null, asecret: a.hm?.as ?? null, ps: a.hm?.ps === 1 ? 1 : 0, cl: 0, secret: a.hm?.sc ?? null, re: 1 } }]];
    if (a.ly && isGateRoom(a.key) && a.pose) out.push([vid, 'p', a.pose]);   // SCALE5d part two: and a court copy's, where it stands
    return out;
  }
  _hubRehello(vid) { for (const ev of this._hubRehelloEvents(vid)) this._hubUpOwe(ev[0], ev[1], ev[2]); }
  /** (a shard, or a copy) AUDIT SCALE II R2-4 = R3-2: THE NAME IT HANDS UP UNDER. A hello said it, and a woken object held
   *  none - a shard that slept held its sockets' frames until its alarm (a minute: a world line, an invite, a copy's
   *  blows), and one whose last socket closed on a woken instance never handed up that leave (the bus counted the player
   *  online for good). Its sockets' attachments say it, and its storage keeps it (HUB_KEY_KEY, written once an instance,
   *  at a hello). Null for an object that is no shard and no copy. */
  async _hubKeyOf() {
    if (this._hubKey) return this._hubKey;
    let k = null, ly = 0;
    for (const [, b] of this._all()) { k = b.key ?? null; ly = b.ly | 0; break; }
    let key = isChannelShard(k) ? k : isGateRoom(k) && ly > 0 ? layerName(k, ly) : null;
    if (!key && this._hubKey === undefined) { try { const v = await this.state.storage.get(HUB_KEY_KEY); key = typeof v === 'string' && upOf(v) != null ? v : null; } catch { key = null; } }
    this._hubKey = key;
    return key;
  }
  /** (a shard) AUDIT SCALE II R2-8: is a close or a replacement of `vid`'s still owed the bus (queued, on the wire, or to
   *  be sent again)? A delivery for it is then not one for a socket gone - the bus hears why in a moment. */
  _vidLeaving(vid) {
    const has = (l) => Array.isArray(l) && l.some((ev) => ev[0] === vid && (ev[1] === 'r' || ev[1] === 'x'));
    return has(this._up) || has(this._upInFlight) || has(this._upRetry?.e);
  }
  /** (a shard) AUDIT SCALE II R2-11: the next hand-up's events - HUB_BATCH_MAX at most and HUB_BATCH_BYTES (one at least). */
  _upTake() {
    let n = 0, bytes = 0;
    while (n < this._up.length && n < HUB_BATCH_MAX) { const w = upBytesOf(this._up[n]); if (n && bytes + w > HUB_BATCH_BYTES) break; bytes += w; n++; }
    this._upBytes = Math.max(0, this._upBytes - bytes);
    return this._up.splice(0, n);
  }
  /** (a shard) The batch to the bus - one in flight at a time, so the bus hears it in the order it happened, and every
   *  HUB_SYNC_MS every socket this shard holds besides (the bus closes any it holds that are not, and asks again for any
   *  it lacks). Answers once this batch, and any it waited on, is handed. */
  _hubUpFlush() {
    if (this._upBusy) return this._upBusy.then(() => (this._up.length || this._upRetry ? this._hubUpFlush() : undefined));
    const rooms = this.env?.ROOMS;
    const now = Date.now();
    const sync = now - this._hubSyncAt >= HUB_SYNC_MS;
    if (!rooms?.get || (!this._up.length && !this._upRetry && !sync)) return Promise.resolve();
    // AUDIT SCALE II R2-7: after a miss, the next try waits HUB_RETRY_MS (a bus that does not answer is never asked in a loop)
    if (now < this._upHoldUntil) { if (!this._upT) this._upT = setTimeout(() => { this._upT = null; this._hubUpFlush(); }, this._upHoldUntil - now); return Promise.resolve(); }
    this._upBusy = (async () => {
      try {
        const hub = await this._hubKeyOf();   // AUDIT SCALE II R2-4: a woken shard's name, read back
        if (upOf(hub) == null) return;   // SCALE5c part two: a region's shard too; SCALE5d part two: and a court's copy
        // AUDIT SCALE II R2-7: one that did not land goes again first, AS IT WAS - never cut again with what came after it
        let body = this._upRetry;
        if (!body) {
          body = { q: ++this._upSeq, e: this._upTake() };
          if (sync) { this._hubSyncAt = now; body.live = this._hubLive(); }
        }
        this._upInFlight = body.e;
        let ans = null;
        try {
          const res = await rooms.get(rooms.idFromName(/** @type {string} */ (upOf(hub)))).fetch(new Request(`https://relay.internal${HUB_INTERNAL_UP}`, { method: 'POST', body: JSON.stringify({ hub, b: this._boot, ...body }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
          ans = res?.ok ? await res.json() : null;   // AUDIT SCALE II R2-7: an answer that is not ok is a miss, as a throw is
        } catch (e) { console.warn('[shard] the bus did not answer', e?.message ?? e); }
        if (!ans) {
          this._upRetry = body;
          this._upHoldUntil = Date.now() + HUB_RETRY_MS;
          this._hubSyncAt = 0;   // the next hand-up after it says every socket again, and the bus asks for what it lacks
          // HUB-PULL audit: its retry armed here - armed after this block, it never was (the `return` skipped it), and a miss
          // waited for the shard's next event or its alarm, a minute on: a woken bus's `rs` handed up by nothing
          if (!this._upT) this._upT = setTimeout(() => { this._upT = null; this._hubUpFlush(); }, HUB_RETRY_MS);
          return;
        }
        this._upRetry = null;
        this._pollWake?.();   // HUB-PULL audit: a bus that answers is a bus a poll backing off may ask now
        if (Number.isSafeInteger(ans.n) && ans.n >= 0) this._hubTotalSet(ans.n);   // AUDIT SCALE II R2-4 (p4d): the hub's count, with every answer
        // AUDIT SCALE II R2-6: A SOCKET THE BUS DID NOT HOLD (a bus woken, a hello lost) - its hello said again, then the
        // frames of this hand-up the bus could not run for it, in their order, ahead of anything since (they were dropped:
        // the first world line, invite or accept after a bus woke was lost)
        const unknown = new Set(Array.isArray(ans.unknown) ? ans.unknown.filter((v) => typeof v === 'string') : []);
        if (unknown.size) {
          const redo = [];
          for (const vid of unknown) { const h = this._hubRehelloEvents(vid); if (!h.length) continue; redo.push(...h); for (const ev of body.e) if (ev[0] === vid && (ev[1] === 'f' || ev[1] === 'p')) redo.push(ev); }
          if (redo.length) { this._up.unshift(...redo); for (const ev of redo) this._upBytes += upBytesOf(ev); }
        }
      } finally { this._upInFlight = null; this._upBusy = null; }
      if (this._up.length || Date.now() - this._hubSyncAt >= HUB_SYNC_MS) await this._hubUpFlush();   // HUB-PULL audit: and a sync made due while this one was on the wire (`rs`)
    })();
    return this._upBusy;
  }
  /** (a shard, or a copy) HUB-PULL (2026-10-16): ITS POLL KEPT AT THE BUS while it holds a socket - one at a time, asked
   *  again the moment one is answered with anything; after a miss HUB_RETRY_MS later (doubling to HUB_SYNC_MS / 2), and
   *  after an answer of nothing (a hold run out, or a bus that does not hold) HUB_BATCH_MS later - never in a loop. Started by anything
   *  owed the bus (a hello first) and by the sync's alarm; it ends when nothing here is the bus's. `env.HUB_POLL` 'driven':
   *  the pins' harness asks each poll itself (`_hubPoll`), never a loop on the side. */
  _hubPollEnsure() {
    if (this._pollOn || !this.env?.ROOMS?.get || this.env.HUB_POLL === 'driven') return;
    this._pollOn = true;
    void this._hubPollLoop();
  }
  async _hubPollLoop() {
    let miss = 0;
    try {
      while (this._hubLive().length || this._downGone.size) {
        let got;
        try { got = await this._hubPoll(true); } catch (e) { console.warn('[shard] a poll threw', e?.message ?? e); got = false; }   // HUB-PULL audit: one throw a miss, never the loop's end
        if (got == null) return;   // not a shard - nothing to ask
        miss = got === false ? miss + 1 : 0;
        if (miss) { if (await this._pollRest(Math.min(HUB_RETRY_MS * 2 ** (miss - 1), HUB_SYNC_MS / 2))) miss = 0; }
        else if (got === 0) await new Promise((r) => setTimeout(r, HUB_BATCH_MS));
      }
    } finally { this._pollOn = false; }
  }
  /** (a shard, or a copy) HUB-PULL audit: a miss's wait - cut short by a hand-up the bus answered (`_pollWake`), the
   *  backoff begun again: a bus back from an outage asked at once, never up to HUB_SYNC_MS / 2 on while it seals what the
   *  shard is owed. Answers whether it was woken. */
  _pollRest(ms) {
    return new Promise((done) => {
      const t = setTimeout(() => { this._pollWake = null; done(false); }, ms);
      this._pollWake = () => { clearTimeout(t); this._pollWake = null; done(true); };
    });
  }
  /** (a shard, or a copy) HUB-PULL: one poll - what it ran (`ack`, the newest delivery's number) and the ids a delivery
   *  named that it no longer holds (`gone`) said; the answer's every delivery run in its order. `wait`: the bus may hold
   *  it until it owes something (HUB_POLL_MS at most). The bus's first answer to a shard says `rs` (a bus woken without
   *  its ShardSockets, or a shard it never heard): every socket held here handed up now, as AUDIT SCALE II R2-6's resync
   *  did. Answers how much of the answer was new (the deliveries it ran - never one run before - and one for `rs`), false
   *  for a miss, or null where there is no bus to ask: an answer of nothing new is paced as an empty one, so a bus that
   *  hands the same deliveries again and again never spins the loop. */
  async _hubPoll(wait = false) {
    const rooms = this.env?.ROOMS;
    const hub = await this._hubKeyOf();
    if (!rooms?.get || upOf(hub) == null) return null;
    const gone = [...this._downGone];
    let ans = null;
    try {
      const res = await rooms.get(rooms.idFromName(/** @type {string} */ (upOf(hub)))).fetch(new Request(`https://relay.internal${HUB_INTERNAL_POLL}`, { method: 'POST', body: JSON.stringify({ hub, b: this._boot, ack: this._downSeen, gone, ...(this._rsBoot ? { rb: this._rsBoot } : {}), ...(wait ? { w: 1 } : {}) }), signal: AbortSignal.timeout(HUB_POLL_MS + ROOM_CALL_MS) }));
      ans = res?.ok ? await res.json() : null;
    } catch (e) { console.warn('[shard] the bus did not answer a poll', e?.message ?? e); }
    if (!ans || !Array.isArray(ans.d)) return false;
    for (const vid of gone) this._downGone.delete(vid);
    let ran = 0;
    for (const d of ans.d) { const left = await this._hubDownApply(d); if (!left) continue; ran++; for (const vid of left) this._downGone.add(vid); }
    if (ans.rs) {
      if (typeof ans.rb === 'string') this._rsBoot = ans.rb;   // HUB-PULL audit: told, so the bus stops saying it
      this._hubSyncAt = 0; this._upHoldUntil = 0;
      // HUB-PULL audit: the held loop never waits on the hand-up - awaited, a shard owing the bus all the while (a reconnect's
      // storm, the rehellos `rs` itself asks) polled nothing until its queue ran dry, and the bus let its outbox's oldest go
      const up = this._hubUpFlush();
      if (!wait) await up;
    }
    return ran + (ans.rs ? 1 : 0);
  }
  /** (a shard) A delivery from the bus: its frames for this shard's sockets, each socket's in the order said, then its
   *  closes, and the hub's count. Answers the ids it no longer holds - its next poll tells the bus, which lets those
   *  ShardSockets go - or null for a delivery it did not run (one it ran already, or none). */
  async _hubDownApply(b) {
    if (!b || typeof b !== 'object' || !Array.isArray(b.s) || !Array.isArray(b.seg)) return null;
    // AUDIT SCALE II R2-7: a delivery already run (handed again on a second poll before the first's ack) is not run twice
    if (typeof b.b === 'string' && Number.isSafeInteger(b.q)) {
      if (this._downSeen && this._downSeen.b === b.b && b.q <= this._downSeen.q) return null;
      this._downSeen = { b: b.b, q: b.q };
    }
    // AUDIT SCALE II R2-5: the bus's word on a socket's law (a mute, a guild worn or taken off, its ribbon, its Renown) -
    // the real socket's attachment, which every hello this shard says again is made of, takes it
    for (const t of Array.isArray(b.att) ? b.att : []) {
      const ws = Array.isArray(t) && typeof t[0] === 'string' ? this._byVid(t[0]) : null;
      if (!ws || !t[1] || typeof t[1] !== 'object' || this._dead.has(ws) || this._gone.has(ws)) continue;
      const next = { ...this._attach(ws) };
      for (const k of SHARD_LAW_KEYS) if (k in t[1]) { if (t[1][k] == null) delete next[k]; else next[k] = t[1][k]; }
      this._setAttach(ws, next);
    }
    const gone = new Set();
    for (const g of b.seg) {
      if (Number.isInteger(g?.all)) {   // to every socket it holds that the bus holds too
        const s = b.s[g.all];
        if (typeof s === 'string') for (const [ws, a] of this._all()) if (a.id && a.vid && a.id !== g.x && !this._dead.has(ws) && !this._gone.has(ws)) this._send(ws, s);
        continue;
      }
      for (const e of Array.isArray(g?.to) ? g.to : []) {
        if (!Array.isArray(e) || typeof e[0] !== 'string' || !Array.isArray(e[1])) continue;
        const ws = this._byVid(e[0]);
        if (!ws || this._dead.has(ws) || this._gone.has(ws)) { if (!this._vidLeaving(e[0])) gone.add(e[0]); continue; }   // AUDIT SCALE II R2-8: a socket whose replacement (a reconnect) or close the bus is about to hear is not one gone - "gone" said its leave and then its join
        for (const k of e[1]) if (typeof b.s[k] === 'string' && !this._send(ws, b.s[k])) break;
      }
    }
    for (const c of Array.isArray(b.close) ? b.close : []) {
      const ws = Array.isArray(c) ? this._byVid(c[0]) : null;
      if (!ws) continue;
      this._vidIdx.delete(c[0]);
      this._setAttach(ws, { ...this._attach(ws), vid: null });   // the bus closed it - its leave tells the bus nothing
      try { ws.close(Number.isInteger(c[1]) ? c[1] : CLOSE_POLICY, typeof c[2] === 'string' ? c[2] : ''); } catch { /* gone */ }
      this._dead.add(ws);
      this._closed(ws);
    }
    if (Number.isSafeInteger(b.n) && b.n >= 0) this._hubTotalSet(b.n);
    await this._reap();
    this._metricsTick();
    return [...gone];
  }
  /** (a shard) The hub's count, from the bus - said to this shard's sockets (`{t:'n'}`) at most every HUB_COUNT_MS. */
  _hubTotalSet(n) {
    const was = this._hubTotal;
    this._hubTotal = n;
    if (n !== was && !this._hubCountT) this._hubCountT = setTimeout(() => { this._hubCountT = null; this._hubCountSay(); }, HUB_COUNT_MS);   // its own count walked when it is said, never at every delivery
  }
  _hubCountSay() {
    const n = this._hubN(this._namedCount());
    if (n === this._hubTotalSaid) return;
    this._hubTotalSaid = n;
    const out = JSON.stringify({ t: 'n', n });
    for (const [ws, b] of this._all()) if (b.id) this._send(ws, out);
  }

  /** (the bus) The hub's count - everyone the bus can name: its shards' sockets (each ShardSocket it holds is one - it
   *  lets one go as its leave is said) and its own, walked. `_namedCount`'s answer without a walk of every ShardSocket. */
  _busCount() {
    let n = this._vsocks.size;
    for (const [ws, b] of this._reals()) if (b.id && !this._dead.has(ws) && !this._gone.has(ws)) n++;
    return n;
  }
  /** (the bus) A hello or a leave moved the hub's count: every shard heard from whose last delivery said another is
   *  told within HUB_COUNT_MS - one delivery a shard a second at most, carrying whatever else it is owed. */
  _busCountMoved() {
    if (!this._toldN.size || this._countT) return;
    this._countT = setTimeout(() => { this._countT = null; this._busCountTell(); }, HUB_COUNT_MS);
  }
  _busCountTell() {
    const n = this._busCount();
    for (const [hub, told] of this._toldN) if (told !== n) this._vbatch(hub);
    return this._downFlush();
  }
  /** (the bus) HUB_INTERNAL_UP: a shard's batch, every event in its order - a hello (`h`: a ShardSocket made and greeted),
   *  a frame (`f`: run over it, as a socket's), a close (`x`: its leave said) or a replacement (`r`: let go, nothing said);
   *  with `live`, every socket the shard holds. Answers the ids it does not hold, so the shard says their hellos again. */
  async _hubUpInternal(request) {
    let b;
    try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
    const hub = b?.hub;
    if (upOf(hub) == null || !Array.isArray(b.e)) return json({ error: 'bad' }, 400);   // SCALE5d part two: a court's copy too
    if (this._busKey === undefined) this._busKey = upOf(hub);   // SCALE5c part two: a bus is the channel its first shard names
    else if (this._busKey !== upOf(hub)) return json({ error: 'bad' }, 400);   // and never another channel's
    this._all();
    const now = Date.now();
    this._shardSeen.set(hub, now);   // AUDIT SCALE II R2-9
    await this._busSilentSweep(now);   // AUDIT SCALE II R2-9: and lets go of a silent one's
    // AUDIT SCALE II R2-7: a hand-up already run (its answer lost on the way back, so sent again) is not run twice
    if (typeof b.b === 'string' && Number.isSafeInteger(b.q)) {
      const seen = this._upSeen.get(hub);
      if (seen && seen.b === b.b && b.q <= seen.q) return json({ ok: 1, unknown: [] });
      this._upSeen.set(hub, { b: b.b, q: b.q });
    }
    const unknown = new Set();
    for (const ev of b.e.slice(0, HUB_BATCH_MAX)) {
      if (!Array.isArray(ev) || typeof ev[0] !== 'string') continue;
      const [vid, kind, p] = ev;
      if (kind === 'h') { if (isCourtCopy(hub)) await this._courtHello(hub, vid, p); else await this._vhello(hub, vid, p); continue; }   // SCALE5d part two
      const vws = this._vsocks.get(vid);
      if (!vws || vws.hub !== hub) { if ((kind === 'f' || kind === 'p') && !this._vshut.has(vid)) unknown.add(vid); continue; }   // SCALE5d part two: never one this object closed; AUDIT SCALE II R2-6: a frame or a pose the bus does not hold its socket for is asked its hello, and handed again behind it
      if (kind === 'p') { if (vws.court) this._courtPose(vws, p); continue; }   // SCALE5d part two: a copy's socket's pose
      if (kind === 'f') { if (typeof p === 'string') await this.webSocketMessage(vws, p); }
      else if (kind === 'x') await this._vgone(vws, true);
      else if (kind === 'r') await this._vgone(vws, false);
    }
    if (Array.isArray(b.live)) {
      const live = new Set(b.live.filter((x) => typeof x === 'string'));
      for (const [vid, vws] of [...this._vsocks]) if (vws.hub === hub && !live.has(vid)) await this._vgone(vws, true);
      for (const vid of live) {
        if (this._vsocks.has(vid)) continue;
        const shut = this._vshut.get(vid);
        // AUDIT SCALE II R2-7: one this object closed that its shard still holds - the close never got there (a delivery
        // lost): said again, never left open and mute; SCALE5d part two: and never asked its hello again
        if (shut) { this._vbatch(hub).close.push([vid, shut.code ?? CLOSE_POLICY, shut.reason ?? '']); this._downArm(); }
        else unknown.add(vid);
      }
    }
    await this._reap();
    return json({ ok: 1, unknown: [...unknown], ...(isCourtCopy(hub) ? {} : { n: this._busCount() }) });   // AUDIT SCALE II R2-4 (p4d): and the hub's count, to a shard (a woken one knows none)
  }
  /** (the bus) A shard's hello: its ShardSocket made, in the index as any socket; ONE-SEAT across the bus's own tabs (a
   *  tab from before the shards holds the hub itself - the shard judged its own); the bus's own sockets told the join, as
   *  its roster always was; the live event; then the hub's words, as to any hello. */
  async _vhello(hub, vid, p) {
    if (this._vsocks.has(vid) || !p || !p.att || typeof p.att !== 'object' || typeof p.att.id !== 'string') return;
    const now = Date.now();
    const m = { id: p.att.id, ...(typeof p.m?.acct === 'string' && typeof p.m?.asecret === 'string' ? { acct: p.m.acct, asecret: p.m.asecret } : {}), ...(p.m?.ps === 1 ? { ps: 1 } : {}), ...(p.m?.cl === 1 ? { cl: 1 } : {}) };   // `id`: the account's hello asks the socket still holds the id it greeted
    const vws = new ShardSocket(this, hub, vid);
    const bus = /** @type {string} */ (busOf(hub)), hubBus = bus === SOCIAL_ROOM;
    let a = { ...p.att, key: bus };
    // AUDIT SCALE II R2-1 / R2-2: THE ID'S SECRET IS THE BUS'S TO ASK, as the hub's hello always asked it (A3). A shard knows
    // its own sockets' secrets alone, so a hello naming a shard player's peer id - on the bus itself (a build from before
    // the shards), or on another shard - passed: the first replaced the player's ShardSocket (the real socket closed
    // `replaced`, which its client takes as for good), the second held the id beside it and took the acts sent by it
    const secret = typeof p.m?.secret === 'string' && p.m.secret ? p.m.secret : null;
    const kept = await this._secretOf(a.id);
    if (kept && kept !== secret) { vws.att = a; this._refuse(vws, 'id taken'); return; }
    // AUDIT SCALE II R2-5: THE BUS'S ORDERS OVER A SHARD'S HELLO. A mute the bus applied after the hello's token was minted,
    // and a guild member removed (or a guild gone) since, win over the token - MOD1's and GUILD1c's laws, as `_named`
    // applies a room's own over a hello said to it; the shard never hears the orders, so its own hello applied none
    const ti = Number.isSafeInteger(a.gio) ? a.gio : 0;
    // AUDIT SAFE RELAY-4: and a ban the bus took after the token was minted refuses it - the bus is where a hub's bans are
    // held (its law door, and every ban a carrier hands a shard, which hands it up), so a shard's own hello asked none
    if (await this._bannedHello(vws, a.sub, ti, now)) return;
    const order = typeof a.sub === 'string' ? this._orders.get(a.sub) : null;
    if (order && order.i > ti) a = { ...a, mu: order.mu, lt: order.i };   // LEASE1: `lt` the time of the room's last word on its mute
    if (a.gi) { await this._loadGuildOuts(Math.floor(now / 1000)); if (this._guildOutAfter(a.gi, a.gm, ti)) a = this._unguild(a); }
    vws.att = a;
    this._vput(vws);
    this._all();
    // AUDIT SCALE II R2-12: the same id held here - the player's tab from before the shards, or its own ShardSocket whose
    // reconnect's `r` has not reached the bus - is replaced by the newer, as the hub's hello replaces one (the secret is the
    // id's, asked above): its id taken off first, so its close says no leave
    for (const [other, b] of this._withId(a.id, vws)) {
      this._setAttach(other, { ...b, id: null, replaced: true });
      try { other.close(CLOSE_REPLACED, 'replaced'); } catch { /* gone */ }
      this._closed(other);
    }
    this._adopt(vws, a);
    if (secret && (kept !== secret || !this._secrets.has(a.id))) { await this.state.storage.put(secretKey(a.id), secret); this._secrets.set(a.id, secret); }   // the hub's own law: written when it is new
    this._vlaw(vws, p.att, a);   // AUDIT SCALE II R2-5: an order applied here is the shard's word too
    this._metrics.c.hellos++;
    const held = hubBus && a.sub ? this._otherTabsOf(a.sub, vws, a.id).filter((o) => !o.virtual) : [];   // ONE-SEAT is the hub's (a region's channel never held a seat)
    if (held.length && !m.cl) { this._refuse(vws, SEAT_ELSEWHERE, CLOSE_REPLACED); return; }
    if (m.cl) for (const o of held) this._refuse(o, SEAT_ELSEWHERE, CLOSE_REPLACED);
    this._busCountMoved();
    this._fanRoster(vws, JSON.stringify(badged({ t: 'join', id: a.id, name: a.name, sub: a.sub, n: this._busCount() }, a)));
    if (!hubBus) { this._travTell(vws, now); return; }   // SCALE5c part two: a region's - its travellers' marks
    const ev = await this._liveEvent();
    if (ev) this._send(vws, JSON.stringify({ t: 'event', kind: ev.kind, at: ev.at, w: 1 }));   // `w`: as a welcome says it - a joiner's, not a fresh staging
    await this._hubHelloWords(vws, m, a.sub, now);
  }
  /** (a region's bus) SCALE5c part two: a shard's joiner told the region's fresh traveller marks (TV3) - its shard's
   *  welcome holds none, the marks being the bus's - TRAV_WELCOME_MAX at most, as a welcome's `tr` is cut. Each as a
   *  `trav` frame, which a client reads as said now: a mark up to TRAV_SEND_MIN_MS old is drawn that much longer. */
  _travTell(vws, now) {
    let n = 0;
    for (const [w, b] of this._all()) {
      if (w === vws || !b.id || !b.tm || now - b.tm.at > TRAV_STALE_MS || this._dead.has(w) || this._gone.has(w)) continue;
      const { bd, sr } = b.tm, p = { ...b.tm };   // OW-CHASE-RANGE: the chase words kept beside the mark, said beside it
      delete p.at; delete p.bd; delete p.sr;
      this._send(vws, JSON.stringify(badged({ t: 'trav', id: b.id, name: b.name, sub: b.sub, p, ...(bd ? { bd } : {}), ...(sr ? { sr } : {}) }, b)));
      if (++n >= TRAV_WELCOME_MAX) break;
    }
  }
  /** (a gate's court) SCALE5d part two: A COPY'S HELLO - its socket made here as a ShardSocket the court's index never
   *  holds (so no walk of its crowd - a pose's fan, a roster, a line - ever reaches it), admitted by the court's own law
   *  as a hello here is (`_gateAdmit`: a fighter of this fight always, a newcomer while the gate admits), else closed with
   *  the court's word; and, as a hello here, the one seat its account holds in the court and every copy - an older one
   *  replaced. Its fight words, beats and receipts are said to it from then on, as to any socket here. */
  async _courtHello(hub, vid, p) {
    if (this._vsocks.has(vid) || !p || !p.att || typeof p.att !== 'object' || typeof p.att.id !== 'string') return;
    const court = /** @type {string} */ (courtOfCopy(hub)), now = Date.now();
    const vws = new ShardSocket(this, hub, vid);
    vws.court = true;
    vws.att = { ...p.att, key: court };
    // AUDIT SCALE II R3-11: JUDGED BEFORE IT IS HELD - a throw (the fight's storage) is a refusal its client asks again
    // (`busy`), never a socket held unjudged: the census's, the beats' and the kill's, past the seal. AUDIT SCALE II R3-6:
    // a hello said again (`re` - the court woke, and the copy says every socket it holds) is a socket this court held, judged
    // by the clock as the copy's own door judges it: every copy watcher was closed `the gate is sealed` at a wake past the
    // seal, while the court's own watchers, held across the same wake, stayed
    let no;
    try { no = p.m?.re === 1 ? (gateHolds(gateDayOfRoom(court), now) ? null : 'the gate is closed') : await this._gateAdmit(court, vws.att.sub, now); } catch (e) { console.warn('[gate] a copy\'s hello', e?.message ?? e); no = 'busy'; }
    if (no) { if (no === 'busy') this._refuse(vws, no, CLOSE_BUSY); else this._refuse(vws, no); return; }
    this._vput(vws);
    if (typeof vws.att.sub === 'string' && vws.att.sub) {
      for (const [other, b] of [...this._all()]) if (b.id && b.sub === vws.att.sub) this._refuse(other, 'replaced', CLOSE_REPLACED);
      this._courtReplace(vws.att.sub, vws);
    }
  }
  /** (a gate's court) SCALE5d part two: a copy's socket's pose - where its body stands for the fight (its census, its
   *  blows' reach) and, while it fights, on its trail as a socket's here is. Shaped as the copy took it; asked again. */
  _courtPose(vws, p) {
    const pose = validPose(p);
    if (!pose || vws.closed) return;
    vws.att = { ...vws.att, pose };
    if (this._trailing(vws.att)) this._trailPose(vws, pose, Date.now());
  }
  /** (a gate's court) SCALE5d part two: the court's one seat an account - its copies' sockets of `sub` but `keep`, replaced. */
  _courtReplace(sub, keep) {
    if (!this._cper.size) return;
    for (const v of [...this._vsocks.values()]) if (v.court && v !== keep && !v.closed && v.att?.sub === sub) this._refuse(v, 'replaced', CLOSE_REPLACED);
  }
  /** (a gate's court) SCALE5d part two: EVERY SOCKET THE FIGHT HEARS - the court's own (its index's) and its copies' -
   *  with their attachments: the fight's census, its present, its kill's `here`, its receipts and its body words. */
  *_courtSockets() {
    yield* this._all();
    if (this._cper.size) for (const v of this._vsocks.values()) if (v.court && !v.closed && v.att) yield [v, v.att];
  }
  /** (a gate's court) SCALE5d part two: the socket a peer id names, in the court or a copy - a heal's healer. */
  _courtIdFirst(id) {
    const here = this._idFirst(id);
    if (here || !this._cper.size || !id) return here;
    for (const v of this._vsocks.values()) if (v.court && !v.closed && v.att?.id === id) return [v, v.att];
    return null;
  }
  /** (a gate's court) SCALE5d part two: one frame to every copy's every socket - one entry a copy, never one a socket. */
  _courtSendAll(s) {
    for (const [hub, n] of this._cper) {
      if (!(n > 0)) continue;
      const b = this._vbatch(hub);
      b.seg.push({ all: this._vframe(b, s) });
      b.cur = null;
    }
    if (this._cper.size) this._downArm();
  }
  /** SCALE5c part two: one frame to everyone the room holds but the peer `id` (and the socket `skip`) - on a bus, one
   *  entry a shard (`_vsendAll`) and a walk of its own sockets, never of its shards'; anywhere else, the walk. */
  _fanAllBut(skip, id, out) {
    if (this._vper.size) { this._vsendAll(out, id); for (const [o, b] of this._reals()) if (o !== skip && b.id && b.id !== id) this._send(o, out); return; }
    for (const [o, b] of [...this._all()]) if (o !== skip && b.id && b.id !== id) this._send(o, out);
  }
  /** (the bus) A ShardSocket gone: closed (`said` - its leave said, as any socket's), or replaced by its own reconnect on
   *  its shard (nothing said: the id lives on in the new one - the hub's own law for a reconnect). */
  async _vgone(vws, said) {
    this._vdrop(vws);
    vws.closed = true;
    if (vws.court) return;   // SCALE5d part two: a copy's socket was never the court's crowd - nobody here is told it went
    this._busCountMoved();
    if (said) { await this.webSocketClose(vws, 1000, ''); return; }
    const a = this._attach(vws);
    this._setAttach(vws, { ...a, id: null, replaced: true });
    this._gone.add(vws);
    this._forget(vws);
  }
  /** (the bus) A frame said to a ShardSocket - owed its shard: each frame once a batch, each socket's list in its order. */
  _vsend(vws, s) {
    const b = this._vbatch(vws.hub);
    const k = this._vframe(b, s);
    if (!b.cur) b.seg.push(b.cur = new Map());
    let l = b.cur.get(vws.vid);
    if (!l) b.cur.set(vws.vid, l = []);
    l.push(k);
    this._downArm();
  }
  /** (the bus) A frame to EVERY ShardSocket - one entry a shard, never one a socket: each shard says it to every socket
   *  it holds. In its batch's order (a segment of its own), so nothing said a socket before it is heard after it. */
  _vsendAll(s, x = null) {
    for (const [hub, n] of this._vper) {
      if (!(n > 0)) continue;
      const b = this._vbatch(hub);
      b.seg.push(x ? { all: this._vframe(b, s), x } : { all: this._vframe(b, s) });   // `x`: a peer it is not said to (a traveller's own mark)
      b.cur = null;
    }
    if (this._vper.size) this._downArm();
  }
  _vframe(b, s) { let k = b.i.get(s); if (k === undefined) { k = b.s.length; b.s.push(s); b.i.set(s, k); } return k; }
  _vput(vws) { this._vsocks.set(vws.vid, vws); const per = vws.court ? this._cper : this._vper; per.set(vws.hub, (per.get(vws.hub) ?? 0) + 1); }   // SCALE5d part two: a court's copies counted apart - no channel's fan reaches them
  _vdrop(vws) { if (this._vsocks.get(vws.vid) !== vws) return; this._vsocks.delete(vws.vid); const per = vws.court ? this._cper : this._vper; const n = (per.get(vws.hub) ?? 1) - 1; if (n > 0) per.set(vws.hub, n); else per.delete(vws.hub); if (vws.court) this._trails?.delete(vws); }
  /** SCALE5c: everyone the room can name but `ws` whose folded name holds `q` - HUB_FIND_MAX at most, badged. Each
   *  attachment's fold kept with it (a new attachment is a new fold), so a search is a walk and no string work. */
  _findNames(ws, q) {
    const l = [];
    if (!q) return l;
    for (const [w, b] of this._all()) {
      if (w === ws || !b.id || this._dead.has(w) || this._gone.has(w)) continue;
      let f = this._folds.get(b);
      if (f === undefined) this._folds.set(b, f = foldFind(b.name));
      if (!f.includes(q)) continue;
      l.push(badged({ id: b.id, name: b.name, sub: b.sub }, b));
      if (l.length >= HUB_FIND_MAX) break;
    }
    return l;
  }
  /** SCALE5c (Mac's decision 2): EVERYONE ONLINE, as a shard's World tab lists them while the hub is small - the room's
   *  roster as a welcome cuts it (CHAT_ROSTER_MAX, the oldest first), or nobody past it (the list is then its own shard's,
   *  its friends, its guild and the search). One frame for HUB_WHO_KEEP_MS: every ask inside it is that frame, which a
   *  shard's batch carries once - the asker's own row among them (its client lists itself once). */
  _everyoneSaid(now) {
    if (this._everyone && now - this._everyone.at < HUB_WHO_KEEP_MS) return this._everyone.s;
    const l = [];
    if ((this._vsocks.size ? this._busCount() : this._namedCount()) <= CHAT_ROSTER_MAX) {
      for (const [w, b] of this._all()) {
        if (!b.id || this._dead.has(w) || this._gone.has(w)) continue;
        l.push(badged({ id: b.id, name: b.name, sub: b.sub }, b));
        if (l.length >= CHAT_ROSTER_MAX) break;
      }
    }
    this._everyone = { at: now, s: JSON.stringify({ t: 'found', all: 1, l }) };
    return this._everyone.s;
  }
  /** SCALE5c: who of `a`'s guild is online, every shard's - never the asker (ONE-SEAT seats an account's one tab, so a
   *  socket is a member). */
  _guildWho(ws, a) {
    const l = [];
    if (!a.gi) return l;
    const idx = this._all();
    for (const w of this._byGuild().get(a.gi) ?? []) {
      const b = idx.get(w);
      if (w === ws || !b?.id || this._dead.has(w) || this._gone.has(w)) continue;
      l.push(badged({ id: b.id, name: b.name, sub: b.sub }, b));
      if (l.length >= HUB_GUILD_WHO_MAX) break;
    }
    return l;
  }
  /** (the bus) Its OWN sockets - a tab from before the shards - with their attachments: the runtime's list, never a walk
   *  of every ShardSocket in the index. */
  *_reals() { const idx = this._all(); for (const ws of this.state.getWebSockets()) { const b = idx.get(ws); if (b) yield [ws, b]; } }
  /** (the bus) A ShardSocket closed here (a refusal, ONE-SEAT, a strike): its shard told to close the real one. */
  _vclose(vws, code, reason) {
    this._vshut.set(vws.vid, { code: code | 0, reason: String(reason ?? '').slice(0, 120) });   // AUDIT SCALE II R2-7: with its word - said again if its shard still holds it; SCALE5d part two: closed here - a frame or a pose of its on the way is not one to ask its hello again for (a refused hello asked again was refused again, for ever)
    this._vdrop(vws);
    this._busCountMoved();
    this._vbatch(vws.hub).close.push([vws.vid, code | 0, String(reason ?? '').slice(0, 120)]);
    this._downArm();
  }
  _vbatch(hub) { let b = this._down.get(hub); if (!b) this._down.set(hub, b = { s: [], i: new Map(), seg: [], cur: null, close: [], att: [] }); return b; }
  /** (the bus) AUDIT SCALE II R2-5: A SHARDSOCKET'S LAW CHANGED HERE (a mute, a guild, its ribbon, its Renown) - said to its
   *  shard (the delivery's `att`), whose own attachment is what a hello said again after a wake is made of: a mute or a
   *  guild's removal lived in the bus's memory alone and was gone at its next wake, and the bus's `_orders` never covered
   *  a reconnect on a shard at all. Only SHARD_LAW_KEYS; nothing is said for none moved. */
  _vlaw(vws, from, to) {
    if (!vws?.virtual || vws.court || vws.closed) return;
    let d = null;
    for (const k of SHARD_LAW_KEYS) { const x = from?.[k], y = to?.[k]; if (x !== y && JSON.stringify(x) !== JSON.stringify(y)) (d ??= {})[k] = y ?? null; }
    if (!d) return;
    this._vbatch(vws.hub).att.push([vws.vid, d]);
    this._downArm();
  }
  /** (the bus, or a court) AUDIT SCALE II R2-9: A SHARD THE BUS HAS NOT HEARD FROM IN HUB_SILENT_MS LOST ITS SOCKETS (an
   *  object reset, no close said - its sync runs only while it holds any): every ShardSocket of its let go, its leaves
   *  said, the count right again. Asked at most every HUB_SYNC_MS / 2, by any shard's hand-up and by the alarm. HUB-PULL:
   *  and what it was owed, which nobody will ask for. */
  async _busSilentSweep(now) {
    if ((!this._vsocks.size && !this._outbox.size) || now - this._silentAt < HUB_SYNC_MS / 2) return;
    this._silentAt = now;
    for (const v of [...this._vsocks.values()]) {
      if (now - (this._shardSeen.get(v.hub) ?? 0) < HUB_SILENT_MS) continue;
      if (v.court) { this._vdrop(v); v.closed = true; } else await this._vgone(v, true);
    }
    for (const hub of [...this._outbox.keys()]) if (now - (this._shardSeen.get(hub) ?? 0) >= HUB_SILENT_MS && !this._polls.has(hub)) this._outbox.delete(hub);
  }
  _downArm() { if (!this._downT) this._downT = setTimeout(() => { this._downT = null; this._downFlush(); }, HUB_BATCH_MS); }
  /** (the bus) Every shard owed anything, its batch sealed into its outbox (HUB-PULL). */
  _downFlush() { for (const hub of [...this._down.keys()]) this._downTo(hub); return Promise.resolve(); }
  /** (the bus) One shard's batch, numbered and sealed into its outbox - HUB-PULL (2026-10-16): THE BUS NEVER CALLS A
   *  SHARD. Its pushes rode the hand-up it was serving and the shard's next hand-up rode the push, a hop deeper each
   *  round, until the runtime refused them (net/hubShards.js HUB_INTERNAL_POLL). A held poll is answered with it now;
   *  else the shard's next poll is. It stays until the shard says it ran it (AUDIT SCALE II R2-7: a delivery whose answer
   *  was lost goes again AS IT WAS, its number with it, and runs once), HUB_OUTBOX_MAX and HUB_OUTBOX_BYTES at most -
   *  past them the oldest is let go, and its shard's next sync says what it holds (a close it never heard said again). */
  _downTo(hub) {
    const b = this._down.get(hub);
    if (b) {
      this._down.delete(hub);
      const court = isCourtCopy(hub), n = court ? null : this._busCount();   // SCALE5d part two: a court's copy is told no channel's count
      if (!court) this._toldN.set(hub, n);
      const q = (this._downSeq.get(hub) ?? 0) + 1;
      this._downSeq.set(hub, q);
      const body = JSON.stringify({ b: this._boot, q, s: b.s, seg: b.seg.map((g) => (g instanceof Map ? { to: [...g] } : g)), close: b.close, ...(b.att.length ? { att: b.att } : {}), ...(court ? {} : { n }) });
      let box = this._outbox.get(hub);
      if (!box) this._outbox.set(hub, box = { l: [], bytes: 0 });
      box.l.push({ q, body });
      box.bytes += body.length;
      while (box.l.length > HUB_OUTBOX_MAX || (box.l.length > 1 && box.bytes > HUB_OUTBOX_BYTES)) { box.bytes -= /** @type {{ body: string }} */ (box.l.shift()).body.length; this._metrics.c.drops++; }
    }
    const held = this._polls.get(hub);
    if (held && this._outbox.get(hub)?.l.length) this._pollAnswer(hub, held);
  }
  /** (the bus, or a court) HUB-PULL: HUB_INTERNAL_POLL - a shard (or a copy) asking for what is owed its sockets. What it
   *  ran (`ack`) leaves its outbox and the ids it no longer holds (`gone`) leave as ShardSockets, their leaves said; then
   *  every delivery it has not acknowledged is its answer - or, asked with `w` and owed nothing, the poll is held until a
   *  delivery is sealed for it or HUB_POLL_MS passes. One held a shard: a newer poll answers the older with nothing (its
   *  shard gave up on it). A shard's first poll to this instance is told to say every socket again (`rs` - AUDIT SCALE
   *  II R2-6: a woken bus holds no ShardSocket, and a shard whose sockets said nothing since would hear nothing it fanned
   *  until its sync, a minute on). */
  async _hubPollInternal(request) {
    let b;
    try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
    const hub = b?.hub;
    if (upOf(hub) == null) return json({ error: 'bad' }, 400);
    if (this._busKey === undefined) this._busKey = upOf(hub);   // SCALE5c part two: a bus is the channel its first shard names - by a poll as by a hand-up
    else if (this._busKey !== upOf(hub)) return json({ error: 'bad' }, 400);   // and answers no other channel's shard
    this._all();
    const box = this._outbox.get(hub), ack = b.ack;
    if (box && ack && ack.b === this._boot && Number.isSafeInteger(ack.q)) while (box.l.length && box.l[0].q <= ack.q) box.bytes -= /** @type {{ body: string }} */ (box.l.shift()).body.length;
    for (const vid of Array.isArray(b.gone) ? b.gone : []) { const v = typeof vid === 'string' ? this._vsocks.get(vid) : null; if (v && v.hub === hub) await this._vgone(v, true); }
    await this._reap();
    const rs = b.rb !== this._boot;   // HUB-PULL audit: said until the shard says it heard it - an `rs` answer lost, or a poll its shard gave up on, never spends it
    const held = this._polls.get(hub);
    if (held) this._pollAnswer(hub, held, false);
    if (rs || !b.w || this._outbox.get(hub)?.l.length) return this._pollReply(hub, rs);
    return new Promise((done) => { const p = { done, t: setTimeout(() => this._pollAnswer(hub, p), HUB_POLL_MS) }; this._polls.set(hub, p); });
  }
  /** (the bus) HUB-PULL: a held poll answered - with what its shard is owed, or (`give` false) with nothing. */
  _pollAnswer(hub, p, give = true) {
    if (this._polls.get(hub) === p) this._polls.delete(hub);
    clearTimeout(p.t);
    p.done(give ? this._pollReply(hub, false) : this._pollReply(null, false));
  }
  /** (the bus) HUB-PULL: a poll's answer - every delivery `hub` has not acknowledged, in its order, HUB_BATCH_BYTES at
   *  most (at least one: the rest go with the next poll, which comes at once). Each is the JSON it was sealed as. */
  _pollReply(hub, rs) {
    const out = [];
    let bytes = 0;
    for (const e of (hub != null && this._outbox.get(hub)?.l) || []) { if (out.length && bytes + e.body.length > HUB_BATCH_BYTES) break; out.push(e.body); bytes += e.body.length; }
    return new Response(`{"ok":1,"d":[${out.join(',')}]${rs ? `,"rs":1,"rb":${JSON.stringify(this._boot)}` : ''}}`, { headers: { 'content-type': 'application/json' } });
  }
  /** SCALE5b (PERF-RELAY1's lesson, `_poseFrame`): THE FOES FRAME'S FAN, A METHOD OF ITS OWN. Written inside `_message`,
   *  which is past V8's ceiling for an optimized function, it ran in the interpreter for the life of the object - at
   *  the rate a full cell's every socket streams its foes. And the room's byte budget is asked BEFORE the walk: a frame
   *  the room cannot afford for even one listener is dropped without one (the budget's bucket left exactly as the walk
   *  and a refusal, or a fan to nobody, would have left it - refilled to now, nothing spent). In a crowded cell, where
   *  the budget drops most frames, that was a copy of the whole index and a range test per socket for nothing.
   *  `kind` 'foes' (a cell's: ranged as the pose is - AUDIT WORLD6b A4; a world room's host's: everyone) or 'own'
   *  (OWN1: everyone); answers the budget's bucket. A5: the fan is the frame times its listeners, and over the budget
   *  the frame is dropped and nobody struck (the next full frame heals it); AUDIT WORLD6b A3: asked before the frame is
   *  re-serialised (the fan's bytes estimated: the frame's plus the envelope's), so a dropped frame costs no stringify.
   *
   *  FOES-FIRST (2026-10-21, bible/11-Multiplayer/Scale-Arc.md FOES-FIRST): THE FULL FRAMES FIRST. The live relay's
   *  `world` rooms dropped 2.8% of their foes frames (double14), every one to this budget, and the readers tallied a
   *  grant never heard 285k times in nine hours: one bucket for every frame let the deltas, small and five a second
   *  from every owner, hold it below what a full frame's fan costs, so the frames that sweep the gone, say the grants
   *  and the sites sprung and hand foes on were the ones that lost. A frame that goes FIRST (`_foesFirst`) may spend
   *  the bucket to minus FOES_FULL_RESERVE; any other stops at plus it (wire.js floorGate). Both asks keep their
   *  places: the one listener's worth before the walk, the whole fan after it. A full frame dropped is counted apart
   *  (blob4, of blob5's full frames asked). `text` is the frame as it came (FOES-HOLD: what a held frame keeps). */
  _foesFan(ws, a, kind, data, text, ranged, bucket, now) {
    const full = foesFrameFull(data), hands = foesFrameHandsOn(data), lane = this._foesLane(ws, kind), length = text.length;
    const urgent = this._foesUrgent(lane, hands, now);
    const first = this._foesFirst(lane, full, urgent, now);
    this._metrics.c.foes++;   // SCALE5b: the frames by type
    if (full) this._metrics.c.fulls++;   // FOES-FIRST: and the full frames among them
    lane.in = now;   // FOES-HOLD: the sender streams on this lane (a held frame's beat asks it)
    const hold = this._foesHoldOf(kind);
    if (hold.entries.length) bucket = this._foesDrain(kind, hold, bucket, now);   // FOES-HOLD: the held frames' turns come first
    // FOES-HOLD: a delta - no handover, nor a full frame to take its sender's held one's place - spends the budget down
    // to the reserve; while any frame is held, it waits behind the full frames, and a sender's own never overtakes its
    // held one: dropped
    if (!first && !hands && !(full && hold.entries.length && heldOf(hold, ws).length)) {
      if (hold.entries.length) return this._foesDropped(full, bucket);
      const sent = this._foesSend(ws, a, kind, data, length, ranged, bucket, now, FOES_FULL_RESERVE, lane);
      return sent.pass ? sent.bucket : this._foesDropped(full, sent.bucket);
    }
    // FOES-HOLD: a frame that goes first spends its turn when it is taken - sent now, or held for its place. A handover
    // is held whatever its cadence: inside it, it asks the reserve's floor and waits its turn past it (the turns are one
    // a sender, so no page that calls every frame a handover buys more than its own)
    if (first && full) lane.first = now;
    if (urgent && hands) lane.hands = now;   // AUDIT FOES-FIRST F1: and a handover's
    if (!hold.entries.length) {
      const sent = this._foesSend(ws, a, kind, data, length, ranged, bucket, now, first ? -FOES_FULL_RESERVE : FOES_FULL_RESERVE, lane);
      if (sent.pass) return sent.bucket;
      bucket = sent.bucket;
      if (sent.fan > FOES_ROOM_BYTES_PER_S + FOES_FULL_RESERVE) return this._foesDropped(full, bucket);   // a fan no bucket can ever take
    }
    // AUDIT FOES-HOLD 2: held as the text it came as - the bytes the hold counts are the bytes it keeps; its `k` beside
    // it for its beat, in a room key's shape or not at all (AUDIT FOES-HOLD 1)
    const { fate, gone } = holdFrame(hold, { ws, text, k: isRoomKey(data.k) ? data.k : null, length, ranged, full, hands, at: now });
    if (fate === 'refused') return this._foesDropped(full, bucket);
    this._metrics.c.held++;
    for (const e of gone) this._foesGone(e, bucket);   // the frame it replaced, and any taken to make it room: never sent
    return bucket;
  }
  /** FOES-HOLD: a held frame out of the hold unsent - replaced, taken for room, gone stale, its sender gone, or its fan
   *  past any bucket: counted gone (blob8; so the held are the sent, the gone and the still held - AUDIT FOES-HOLD 6)
   *  and as the drop it is (a full one apart). Answers the bucket. */
  _foesGone(e, bucket) {
    this._metrics.c.heldGone++;
    return this._foesDropped(e.full, bucket);
  }
  /** FOES-HOLD: a held frame's turn taken - counted sent, its wait summed (blob7, blob9); or, charged and junk at its
   *  re-serialising, counted gone (AUDIT FOES-HOLD 6: it was counted sent, and reached nobody). */
  _foesServed(e, sent, now) {
    if (sent.junk) this._metrics.c.heldGone++;
    else { this._metrics.c.heldSent++; this._metrics.c.heldMs += now - e.since; }
  }
  /** FOES-HOLD: one foes or own frame out to its listeners, if the room's budget takes its fan down to `floor` - one
   *  listener's worth asked before the walk (SCALE5b: a frame dropped costs no walk and no stringify), the whole fan
   *  after it (AUDIT WORLD2 A5). Answers the budget's bucket, whether it passed (a fan to nobody passes, spending
   *  nothing), and the fan it asked - one listener's worth when the first ask refused it - and `junk`, a frame charged
   *  and refused at its re-serialising. `data` is the frame's object, or a held frame's text (AUDIT FOES-HOLD 2), parsed
   *  only once its fan is charged: what parsed when it came parses again. */
  _foesSend(ws, a, kind, data, length, ranged, bucket, now, floor, lane) {
    const per = length + a.id.length + 8;
    const ahead = floorGate(bucket, now, per, FOES_ROOM_BYTES_PER_S, floor);
    if (!ahead.pass) return { bucket: ahead.bucket, pass: false, fan: per };   // SCALE5b: not one listener's worth - no walk
    const listeners = this._foesListeners(ws, a, ranged);
    const budget = floorGate(bucket, now, per * listeners.length, FOES_ROOM_BYTES_PER_S, floor);
    if (!budget.pass) return { bucket: budget.bucket, pass: false, fan: per * listeners.length };
    if (!listeners.length) return { bucket: budget.bucket, pass: true, fan: 0 };
    // AUDIT FOES-FIRST F2: the lane is heard once the fan is CHARGED, before the frame is re-serialised - a frame charged
    // and then junked (one that grew: `1e20` out as twenty-one digits) left its sender unheard, so every frame it sent
    // went first, past both the turn's bound and the unheard rule
    lane.heard = now;
    if (typeof data === 'string') data = JSON.parse(data).data;
    if (relayCfgValue(this._relayCfg, this.env, 'grantStrip') === 'on' && (kind === 'own' || isCellRoom(a.key))) data = this._grantStripped(a, data, kind, now);   // GRANT9: the switch on - a record its grant does not stand goes nowhere; FOE-BOUNDS: nor one no builder could give
    const out = fanOut(kind, a.id, data, length, a.gv === 1);   // AUDIT (pre-merge) O3/O4; GRANT-DOOR: vouched
    if (out == null) { this._junk(ws); return { bucket: budget.bucket, pass: true, fan: 0, junk: true }; }
    for (const other of listeners) this._send(other, out);
    return { bucket: budget.bucket, pass: true, fan: per * listeners.length };
  }
  /** The sockets a foes or own frame of `ws` goes to: every other hello'd one - in a cell, those in range of its pose
   *  (AUDIT WORLD6b A4: ranged as the pose is). */
  _foesListeners(ws, a, ranged) {
    const reach = ranged ? inRangeOf(a.key, a.pose) : null;
    const listeners = [];
    for (const [other, b] of this._all()) if (other !== ws && b.id && (!reach || reach(b.pose))) listeners.push(other);
    return listeners;
  }
  /** FOES-HOLD: a lane's hold (server/src/foesHold.js) - the instance's, as the budget is: a woken room holds nothing. */
  _foesHoldOf(kind) { return ((this._foesHolds ??= {})[kind] ??= createFoesHold()); }
  /** FOES-HOLD: THE HELD FRAMES' TURNS. Each held frame in its turn (foesHold.js heldHead) goes the moment the budget
   *  holds its fan down to minus FOES_FULL_RESERVE, the fan walked where its sender stands now; the first that cannot
   *  waits, and every frame behind it with it. A frame whose sender has gone (its leave gave it a last try,
   *  `_foesLeft`), or a full frame whose words are FOES_STALE_MS old (its sender has said no newer one for that long:
   *  its page hidden, so its readers let its puppets go), leaves the hold unsent; so does one whose fan no bucket can
   *  take. A handover never ages out - the owner has let those foes go. Asked at every foes or own frame the lane
   *  takes: a held frame's sender streams every FOES_MS, so its turn is asked at least that often. Answers the bucket. */
  _foesDrain(kind, hold, bucket, now) {
    for (let e = heldHead(hold); e; e = heldHead(hold)) {
      const a = this._all().get(e.ws);
      if (!a?.id || (!e.hands && now - e.at > FOES_STALE_MS)) { unhold(hold, e); this._foesGone(e, bucket); continue; }
      const sent = this._foesSend(e.ws, a, kind, e.text, e.length, e.ranged, bucket, now, -FOES_FULL_RESERVE, this._foesLane(e.ws, kind));
      bucket = sent.bucket;
      if (!sent.pass) {
        if (sent.fan <= FOES_ROOM_BYTES_PER_S + FOES_FULL_RESERVE) break;   // its turn: the bucket fills for it
        unhold(hold, e); this._foesGone(e, bucket); continue;   // the room grew round it past what any bucket takes
      }
      served(hold, e);
      this._foesServed(e, sent, now);
    }
    return this._foesBeats(kind, hold, bucket, now);
  }
  /** FOES-HOLD: A HELD SENDER IS STILL HEARD. Its readers let an owner's puppets go once they have heard nothing of it
   *  for FOES_STALE_MS (scenes/exteriorFoes.js, dungeonContext.js) - and where the full frames alone are more than the
   *  budget, a sender's turn can come round slower than that. So the relay says for it what it is: a sender whose
   *  frames are held, still streaming (a frame of its on the lane inside FOES_FULL_MS), whose readers have heard
   *  nothing of it for FOES_UNHEARD_MS, is fanned an empty frame of its own - `{ f: [] }`, its held frame's `k` - which
   *  every reader takes as the owner heard (no `n`: it moves no counter; no `full`: it sweeps nothing; no record: it
   *  stands and moves nothing). One beat a sender every FOES_UNHEARD_MS at most, the scan at most every
   *  FOES_BEAT_SCAN_MS. A sender gone quiet (a page hidden) is beaten for no longer than it streams, so its readers let
   *  it go as they did. AUDIT FOES-HOLD 1: a beat is a few dozen bytes a listener because its `k` is a room key's or
   *  none (the sender's own word - repeated at the frame cap's length, four sockets drove the bucket 9.6 MiB into debt
   *  in 40 s and twenty to 4.6 times the budget), and it is charged as any held frame is, to minus FOES_FULL_RESERVE:
   *  a beat that does not fit waits for the next scan, so beats never put the room deeper. Answers the bucket. */
  _foesBeats(kind, hold, bucket, now) {
    if (!hold.entries.length || now - (hold.beatAt ?? -Infinity) < FOES_BEAT_SCAN_MS) return bucket;
    hold.beatAt = now;
    for (const e of hold.entries) {
      const lane = this._foesLane(e.ws, kind);
      if (now - Math.max(lane.heard ?? e.since, lane.beat ?? -Infinity) < FOES_UNHEARD_MS || now - (lane.in ?? -Infinity) > FOES_FULL_MS) continue;   // silent since its last frame went - or, unheard on this instance (a woken room), since it was held
      const a = this._all().get(e.ws);
      if (!a?.id) continue;
      const listeners = this._foesListeners(e.ws, a, e.ranged);
      if (!listeners.length) { lane.beat = now; continue; }
      const data = e.k === null ? { f: [] } : { f: [], k: e.k };
      const out = JSON.stringify(a.gv === 1 ? { t: kind, id: a.id, g: 1, data } : { t: kind, id: a.id, data });
      const beat = floorGate(bucket, now, out.length * listeners.length, FOES_ROOM_BYTES_PER_S, -FOES_FULL_RESERVE);
      bucket = beat.bucket;
      if (!beat.pass) continue;   // the room at its floor: owed still, asked at the next scan
      lane.beat = now;
      for (const other of listeners) this._send(other, out);
      this._metrics.c.beats++;
    }
    return bucket;
  }
  /** FOES-HOLD: A SENDER LEAVING. An owner leaving the cell hands its foes on and closes (world/foeHandover.js), and a
   *  reader takes no foes frame of a peer whose leave it has heard (net/online.js: a cell's frame from a peer `told`) -
   *  so what the sender still holds would reach nobody after its leave. Its handovers are given a last try now, before
   *  the leave is said, on its lane's budget to FOES_LEFT_FLOOR (AUDIT FOES-HOLD 3: one reserve past a first frame's
   *  floor - an owner closes its socket milliseconds after its handover, at a door or a teleport, and in a crowded room
   *  the line keeps the bucket near the first frames' floor; the floor is the room's, so all the leaves together put it
   *  no deeper); the rest of what it held goes with it. */
  _foesLeft(ws, a, now) {
    if (!this._foesHolds || !a?.id) return;
    for (const kind of Object.keys(this._foesHolds)) {
      const hold = this._foesHolds[kind];
      for (const e of heldOf(hold, ws)) {
        unhold(hold, e);
        const field = kind === 'own' ? '_roomOwn' : '_roomFoes';
        if (e.hands) {
          const sent = this._foesSend(ws, a, kind, e.text, e.length, e.ranged, this[field], now, FOES_LEFT_FLOOR, this._foesLane(ws, kind));
          this[field] = sent.bucket;
          if (sent.pass) { this._foesServed(e, sent, now); continue; }
        }
        this._foesGone(e, this[field]);
      }
    }
  }
  /** FOES-FIRST: a sender's clocks on one lane of the foes fan (`foes` or `own`) - when its frame last went out
   *  (`heard`), when its full frame last went first (`first`) and when its handover last did (`hands`) - among its
   *  meters, the instance's (a woken room hears each sender first once more). */
  _foesLane(ws, kind) { const m = this._meterOf(ws); return ((m.fl ??= {})[kind] ??= {}); }
  /** AUDIT FOES-FIRST F1: whether a frame MUST go - a handover (net/wire.js foesFrameHandsOn: the owner has let the foes
   *  go, and a batch dropped is foes gone for everyone), at most once each FOES_FIRST_MS a sender on its lane, or the
   *  first frame of a sender its lane has not heard for FOES_UNHEARD_MS, full or not, so a sender the full frames crowd
   *  out of a room past its budget is still heard inside its readers' FOES_STALE_MS. */
  _foesUrgent(lane, hands, now) { return (hands && now - (lane.hands ?? -Infinity) >= FOES_FIRST_MS) || now - (lane.heard ?? -Infinity) >= FOES_UNHEARD_MS; }
  /** FOES-FIRST: whether a frame goes FIRST on the room's foes budget - a full frame, at most once each FOES_FIRST_MS a
   *  sender on its lane (`full` is the sender's own word: one that says it on every frame earns one a second), or one
   *  that must go (`_foesUrgent`). */
  _foesFirst(lane, full, urgent, now) { return (full && now - (lane.first ?? -Infinity) >= FOES_FIRST_MS) || urgent; }
  /** SCALE5b: a foes frame the room's budget dropped, counted - FOES-FIRST: a full one apart - answering the bucket. */
  _foesDropped(full, bucket) {
    this._metrics.c.drops++;
    if (full) this._metrics.c.fullDrops++;
    return bucket;
  }
  /** WORLD2's blow onto its destination's one socket `tws` - the foe's owner in a cell, the host in a world room - past
   *  the destination's two funnels. FOES-FIRST HIT-DROPS (2026-10-21): written inside `_message` (HOST-SPLIT: its arms
   *  do not grow), and a blow either funnel dropped went silently - counted now (`hitDrops`, the metrics point's blob3).
   *
   *  A6: the funnel onto the destination's ONE socket - all strikers together, HIT_ROOM_HZ_MAX a second; over it the
   *  blow is dropped and nobody struck. AUDIT WORLD6b A1/A2: the budget is the DESTINATION's (its own bucket, among its
   *  meters), not the room's - in a cell the blows go to many owners, and one room-wide bucket let six honest fights, or
   *  one stream of unroutable blows, silence every other blow in the country.
   *
   *  AUDIT WORLD6b-iii(c) C3: the hit bytes - a grant carries a corpse's pile, so the arm counts bytes as the foes and the
   *  acts do; over the budget the frame is dropped, nobody struck (three sockets pushed 720 KiB/s of grants into one
   *  destination through an arm that counted frames alone). AUDIT 68 X8-hit-byte-budget-room-wide-starves-grants: the
   *  DESTINATION's, as the frame funnel is - one room-wide bucket let one socket's junk blows drop every honest grant in
   *  the room, whose items had already left their corpse; and (the pre-merge review) a per-SENDER bucket reopened C3
   *  itself, N senders each their own 256 KiB/s into one socket. Aimed at a destination, a flood spends that
   *  destination's bytes and no one else's. */
  _hitFunnel(ws, a, data, length, tws, now) {
    const tm = this._meterOf(tws);
    const funnel = tokenGate(tm.hbucket ?? null, now, HIT_ROOM_HZ_MAX);
    tm.hbucket = funnel.bucket;
    if (!funnel.pass) { this._metrics.c.hitDrops++; return; }
    const out = fanOut('hit', a.id, data, length);   // AUDIT (pre-merge) O4: a nesting stringify cannot take, junk - it threw out of the handler
    if (out == null) { this._junk(ws); return; }
    const bytes = byteGate(tm.hbytes ?? null, now, out.length, HIT_ROOM_BYTES_PER_S);
    tm.hbytes = bytes.bucket;
    if (!bytes.pass) { this._metrics.c.hitDrops++; return; }
    this._send(tws, out);
  }

  /** A frame to one socket; a socket that will not take it is closed (A10). */
  _send(ws, s) {
    if (this._owed.size && this._owed.has(ws)) this._flushOwedOf(ws);   // SCALE5b: what a socket is owed goes ahead of any other frame to it - its order is the order the room said them in
    try { ws.send(s); this._metrics.c.sends++; this._metrics.c.bytesOut += s.length; return true; } catch {
      try { ws.close(1011, 'send failed'); } catch { /* gone */ }
      this._dead.add(ws);   // AUDIT WORLD34 D1: closed by the object - its leave is ours to say
      this._closed(ws);
      return false;
    }
  }
  /** SCALE2b: a socket this object just closed leaves the index exactly when it leaves the runtime's list - at once
   *  where the runtime drops it, and when the walk finds it gone where the runtime still lists it until its close
   *  completes (AUDIT ONESEAT R4). The index used to re-read the runtime on every call and learnt both for free; it is
   *  asked once now, at the close, which is rare. */
  _closed(ws) { if (!this.state.getWebSockets().includes(ws)) this._forget(ws); }   // SCALE5a: still listed, its attachment and so its account unchanged - the kept index stands (it was dropped and rebuilt the same)
  _refuse(ws, m, code = CLOSE_POLICY, reason = m) {   // SCALE5a: the close's reason the word itself unless a door says more (BUSY_TOKEN_UNREAD)
    this._metrics.c.refusals++; if (m === 'busy') this._metrics.c.busy++;   // SCALE2b
    this._send(ws, JSON.stringify({ t: 'error', m }));
    try { ws.close(code, reason); } catch { /* already closed */ }
    this._dead.add(ws);   // AUDIT WORLD34 D1: the runtime calls no webSocketClose for a close the object made
    this._closed(ws);
  }
  /** AUDIT WORLD34 D1: every socket this object closed itself leaves the room as a peer's close would - the leave
   *  said, the seat re-said, the looks and secrets gone. The runtime delivers webSocketClose for the PEER's close
   *  alone; a refusal or a failed send left the survivors with a phantom host that never streamed again. Awaited on
   *  the way out of every door (webSocketMessage, webSocketClose, webSocketError). */
  async _reap() {
    while (this._dead.size) {
      const [ws] = this._dead;
      this._dead.delete(ws);
      if (ws.court) continue;   // SCALE5d part two: a copy's socket the court closed - its copy says its leave, to its own crowd
      try { await this._leave(ws); } catch { /* the next door reaps again */ }
    }
  }

  /** WORLD1: the room's host - the hello'd socket in the room longest (the earliest hello stamp; ties by id), or null.
   *  SCALE5b: KEPT, NOT WALKED FOR. A world room asked it on every foes frame, every memory write and every blow - a walk
   *  of every socket each - and it moves only when a socket's id or hello stamp does (`_reindex`, `_all`). Asked without
   *  `except`, or with a socket that is not the host's, the kept answer; else the walk. */
  _hostOf(except = null) {
    this._all();   // a walk due past IDX_TRUST_MS runs first, as the walk below would have run it - and forgets the kept host if it finds the room moved
    if (this._hostMemo === undefined || this._seatStale(this._hostMemo)) this._hostMemo = this._hostWalk(null);   // SEAT-LIVE: and a kept host gone quiet is asked again
    const host = this._hostMemo;
    if (except == null || host == null) return host;
    if (this._all().get(except)?.id !== host) return host;
    return this._hostWalk(except);
  }
  /** The walk itself - what `_hostOf` answered before SCALE5b. FIELD BUGS 2026-10-18d SEAT-LIVE (net/seatLive.js): a
   *  dungeon room's seat is the eldest of its LIVE sockets - one silent past FOES_STALE_MS with another there to hear it
   *  holds it no longer - and, none live, the eldest; every other room's, the eldest. */
  _hostWalk(except, live = true) {
    const list = [];
    for (const [ws, a] of this._all()) if (ws !== except && a.id) list.push(a);
    return seatOf(list, Date.now(), { live: live && seatStreams(list[0]?.key) });
  }
  /** Does this hello'd attachment lead every other (but except's) - is it the room's host? SEAT-LIVE: by the seat's own
   *  law (`seatOf`), with `a` counted though its socket has left the index (a leaver's). */
  _leads(a, except = null) {
    const list = [a];
    for (const [ws, b] of this._all()) if (ws !== except && b.id && b !== a) list.push(b);
    return seatOf(list, Date.now(), { live: seatStreams(a.key) }) === a.id;
  }
  /** SEAT-LIVE (AUDIT FB1018D L4-2): whether a leave moves the seat the room knows - the leaver led it, or it was the host
   *  the room was last told (`_seatSaid`): a silent host whose socket closes with no farewell before any frame said the
   *  change. By the live law the joiner already leads, so `_leads` reads the leaver as no host; and `_seatHeard`, finding
   *  the told host gone from the room, would take the new seat as said - the room never told, the seat's page never
   *  streaming nor writing the room's memory. */
  _leaveMovesSeat(a, ws) {
    return this._leads(a, ws) || (seatStreams(a.key) && a.id != null && a.id === this._seatSaid);
  }
  /** SEAT-LIVE: whether the kept host `id` has gone quiet - a dungeon room's, none of its sockets heard within
   *  FOES_STALE_MS (the walk then asks whether another socket was there to hear it). A host still streaming is O(1). */
  _seatStale(id) {
    if (id == null) return false;
    const now = Date.now();
    let any = false;
    for (const ws of this._byId().get(id) ?? []) { const a = this._all().get(ws); if (!a || !seatStreams(a.key)) return false; any = true; if (now - seatHeardAt(a) <= FOES_STALE_MS) return false; }
    return any;
  }
  /** SEAT-LIVE: the seat's own door, at every frame of a dungeon room - BEFORE any door reads the host. A socket's FRAME
   *  (net/seatLive.js seatTraffic: its hello, a pose, its stream, its own lane, its memory - never a ping) stamps it heard
   *  (`hd`, written lazily as a pose is; a hello its coming in, `hi`). One that was silent comes back a JOINER: told whose
   *  the seat is (it may have missed it), and stamped after the live seat when its old stamp would outrank it - so its
   *  frozen world never takes the seat back. The seat as it now stands is said to the room when it is not the one the
   *  room was last told: a host gone quiet is a host change, as a leave is. Answers the attachment as it now stands
   *  (`_message` reads on from it). */
  _seatHeard(ws, a, message, now = Date.now()) {
    if (!a || !seatStreams(a.key)) return a;
    let back = false;
    if (seatTraffic(message)) {
      if (a.id && now - seatHeardAt(a) > FOES_STALE_MS) {   // heard lately: live, and no walk
        const list = [];
        for (const [, b] of this._all()) if (b.id) list.push(b);
        back = seatSilent(a, othersInOf(list)(this._all().get(ws) ?? a), now);
      }
      const since = back ? this._seatAfter(a, now) : a.since;
      const at = { ...a, hd: now, ...(a.id ? {} : { hi: now }), ...(since !== a.since ? { since } : {}) };   // a hello: its coming in, which the hello's own write keeps
      if (this._setAttach(ws, at, since === a.since && !!a.id)) a = at;
    }
    if (this._seatSaid === undefined) this._seatSaid = this._hostWalk(null, false);   // woken: the room was told the eldest (a change this wake then says again - a host frame said twice is nothing)
    const host = this._hostOf();
    let said = false;
    if (host !== this._seatSaid) { if (this._seatSaid != null && this._byId().has(this._seatSaid)) { this._sayHost(); said = true; } else this._seatSaid = host; }   // a host told to nobody here (a drained room) is not said again
    if (back && host && !said) this._send(ws, JSON.stringify({ t: 'host', id: host }));
    return a;
  }
  /** SEAT-LIVE: the hello stamp a socket back from silence takes - its own, unless that would outrank the room's live seat,
   *  when it comes in just after the seat's. */
  _seatAfter(a, now) {
    const seat = this._hostOf();
    let sa = null;
    for (const w of seat && seat !== a.id ? this._byId().get(seat) ?? [] : []) { sa = this._all().get(w) ?? null; if (sa) break; }
    return sa && seatElder(a, sa) ? Math.max(now, (sa.since ?? 0) + 1) : (a.since ?? now);
  }
  /** SEAT-LIVE: a reconnect's hello stamp - the socket it replaces keeps its seat (AUDIT WORLD A4: a host whose connection
   *  blipped) while that socket was live; one back from silence comes in after the live seat (`_seatAfter`). */
  _seatKeep(replaced, now) {
    if (!replaced) return now;
    if (!seatStreams(replaced.key)) return replaced.since ?? now;
    let othersIn = null;   // since when another has been here to hear it (the replaced socket has lost its id by now)
    for (const [, b] of this._all()) if (b.id && b !== replaced) { const t = seatInAt(b); if (othersIn == null || t < othersIn) othersIn = t; }
    return seatSilent(replaced, othersIn, now) ? this._seatAfter(replaced, now) : (replaced.since ?? now);
  }
  /** The host frame to everyone but skip (whose welcome carries it), the host counted without except (a leaver).
   *  Nothing on the instance: a wake changes no host. SEAT-LIVE: what was said is kept (`_seatSaid`). */
  _sayHost({ skip = null, except = null } = {}) {
    const host = this._hostOf(except);
    this._seatSaid = host;
    if (!host) return;
    const out = JSON.stringify({ t: 'host', id: host });
    for (const [other, b] of [...this._all()]) if (other !== skip && b.id) this._send(other, out);
  }
  /** The stored world, raw (the JSON the host sent, chunked back together), or null. */
  async _worldRaw() {
    if (this._worldMemo !== undefined) return this._worldMemo;   // SCALE2b: read once a wake, kept, and set by every write
    this._worldMemo = await this._worldRead();
    return this._worldMemo;
  }
  /** The stored world, raw, read from storage. */
  async _worldRead() {
    const meta = await this.state.storage.get(WORLD_META);
    if (!meta || !(meta.chunks > 0)) return null;
    const keys = Array.from({ length: meta.chunks }, (_, i) => worldChunkKey(i));
    const parts = await this.state.storage.get(keys);
    let raw = '';
    for (const k of keys) { const c = parts.get(k); if (typeof c !== 'string') return null; raw += c; }
    return raw;
  }
  /** QUEST-HOME: the home words the hub holds - the last HOME_WORDS_KEEP_MS of them, HOME_WORDS_MAX at most - read from
   *  its storage once per instance life and kept (an order writes both); anything stored that is not a home word is none. */
  async _homeWordsHeld(now) {
    if (this._homeWords === undefined) {
      const kept = await this.state.storage.get(HOME_WORDS_KEY);
      this._homeWords = Array.isArray(kept) ? kept.filter((w) => validHomeWord(w) && Number.isFinite(w?.at) && typeof w?.sig === 'string') : [];
    }
    this._homeWords = this._homeWords.filter((w) => now - w.at < HOME_WORDS_KEEP_MS).slice(-HOME_WORDS_MAX);
    return this._homeWords;
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
    const dead = ['hellos'];   // SCALE2b: a relay before it kept the hello bucket here - the key goes with the drain
    this._secrets.clear();   // SCALE2b: nothing is left to hold an id (the list below takes the stored ones)
    for (const prefix of ['look:', 'secret:']) { const m = await this.state.storage.list({ prefix }); for (const k of m.keys()) dead.push(k); }
    const tables = await this._holdemOf();   // AUDIT CARDS-3 A3: no seat outlives an empty room - the secrets go, so its id is anyone's
    if (tables.size && this._holdemGhosts(tables, Date.now(), true)) await this._holdemSave();
    const iliac = await this._iliacOf();   // CARDS10: and no Iliac seat either
    if (iliac.size && this._iliacGhosts(iliac, Date.now(), true)) await this._iliacSave();
    const gambit = await this._gambitOf();   // KG5: and no King's Gambit seat - a game under way is no contest
    if (gambit.size && this._gambitGhosts(gambit, Date.now(), true)) await this._gambitSave();
    // CARDS6: a spent stake remembered past the oldest order a void takes, then forgotten
    // AUDIT CARDS-4 B6: read a page at a time (AUDIT SOC A4), and an account's owed cash-outs all past their life go too
    const nowS = Math.floor(Date.now() / 1000), old = nowS - HOLDEM_STAKE_KEEP_S;
    for (const k of await this._keysOf('cstake:')) if (!((await this.state.storage.get(k)) > old)) dead.push(k);
    for (const k of await this._keysOf('cashout:')) if (!((await this.state.storage.get(k)) ?? []).some((x) => x && x.e > nowS)) dead.push(k);
    for (const k of await this._keysOf('iowed:')) if (!((await this.state.storage.get(k)) ?? []).some((x) => x && x.e > nowS)) dead.push(k);   // AUDIT CARDS-6 C1: and its Iliac results
    for (const k of await this._keysOf('gowed:')) if (!((await this.state.storage.get(k)) ?? []).some((x) => x && x.e > nowS)) dead.push(k);   // KG6: and its King's Gambit results
    this._parties.clear(); for (const k of await this._keysOf('party:')) dead.push(k);   // SOC1: the parties go with the drain; acct: and asecret: stay (AUDIT SOC A4: listed in pages - an unbounded list of a namespace a client can grow is the isolate's memory)
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
  }

  /** SCALE2b: an id's secret in this room (null: none) - the kept copy, else storage's, read once and kept. */
  async _secretOf(id) {
    if (this._secrets.has(id)) return this._secrets.get(id);
    const v = await this.state.storage.get(secretKey(id));
    const held = typeof v === 'string' ? v : null;
    if (!this._secrets.has(id)) this._secrets.set(id, held);   // a write that landed while storage answered stands
    return this._secrets.get(id);
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
  /** WAGONS2-VISIT (FINAL AUDIT): A CARAVAN'S DOCUMENT IS OWED TO ITS VISITORS UNTIL IT IS FANNED. The fan is charged as an
   *  act's is - the sender's own borrowing bucket (`abytes`, ACT_SENDER_BYTES_PER_S) first, then the room's
   *  (ACT_ROOM_BYTES_PER_S), a refusal by the room charging the sender nothing. A refused fan was dropped whole, and
   *  nothing said it again (the owner's client says an unchanged document once, and an unchanged one is fanned to
   *  nobody), so its visitors kept the old layout until they walked in again; it waits for the alarm at the time its
   *  bucket has repaid now, and goes then - the last document said, `d` null a forgetting. */
  async _caravanFan(now) {
    const from = this._cvOwed;
    if (!from) return;
    const out = `{"t":"caravan","data":${this._cvDoc ?? 'null'}}`;
    const listeners = [...this._all()].filter(([other, b]) => other !== from && b.id);
    const cost = out.length * listeners.length;
    const meters = this._meterOf(from);
    const mine = byteGate(meters.abytes, now, cost, ACT_SENDER_BYTES_PER_S, true);
    let refused = mine.pass ? null : { bytes: mine.bucket.bytes, rate: ACT_SENDER_BYTES_PER_S };
    if (!refused) {
      const room = byteGate(this._roomActBytes, now, cost, ACT_ROOM_BYTES_PER_S, true);
      this._roomActBytes = room.bucket;
      if (!room.pass) refused = { bytes: room.bucket.bytes, rate: ACT_ROOM_BYTES_PER_S };
    }
    if (refused) {
      if (!mine.pass) meters.abytes = mine.bucket;
      this._cvOwedAt = now + Math.ceil((-refused.bytes / refused.rate) * 1000) + 1;
      await this.state.storage.setAlarm(this._cvOwedAt);
      return;
    }
    meters.abytes = mine.bucket;
    this._cvOwed = null;
    for (const [other] of listeners) this._send(other, out);
  }
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
  _meter(ws, a, now, patch = {}, passPatch = {}, lazy = false) {
    const pass = this._spend(ws, now, poseGate, 'bucket', 'drops', 'too many poses');
    return this._metered(ws, a, pass, patch, passPatch, lazy);
  }
  /** AUDIT-SEATS R2: the meter's write, its gate already spent (`pass`) - a battle room's pose spends the gate BEFORE the
   *  referee judges it (the pose arm's note), and is written here only once judged. */
  _metered(ws, a, pass, patch = {}, passPatch = {}, lazy = false) {
    const write = pass ? { ...patch, ...passPatch } : patch;
    const next = Object.keys(write).length ? { ...a, ...write } : a;
    if (next !== a) this._setAttach(ws, next, lazy);
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
  /** TV3: a traveller mark's own cooldown (travHubGate - an interval, as a quest share's), the same strikes. */
  _meterTrav(ws, a, now) { return this._spend(ws, now, travMeter, 'travAt', 'travDrops', 'too many traveller marks') ? a : null; }
  /** PARTY-MAP: a Shared Cartography send's own cooldown (amapShareGate), the same strikes. */
  _meterAmap(ws, a, now) { return this._spend(ws, now, amapMeter, 'amapAt', 'amapDrops', 'too many map shares') ? a : null; }
  /** AUDIT DEEP2 C2: a clear the room's budget refused, owed - the newest per id, at most TRAV_WELCOME_MAX (the oldest
   *  goes; its player's mark then lapses at TRAV_STALE_MS, as every unsaid mark does). */
  _oweTravClear(id, out) {
    this._travOwed.delete(id);
    if (this._travOwed.size >= TRAV_WELCOME_MAX) this._travOwed.delete(this._travOwed.keys().next().value);
    this._travOwed.set(id, out);
  }
  /** AUDIT DEEP2 C2: the owed clears, oldest first, as far as the clears' own budget allows now. */
  _payTravOwed(now) {
    for (const [id, out] of this._travOwed) {
      const g = travRoomGate(this._travClearFan, now);
      this._travClearFan = g.bucket;
      if (!g.pass) return;
      this._travOwed.delete(id);
      this._fanAllBut(null, id, out);   // SCALE5c part two: on a region's bus, one entry a shard
    }
  }
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
  /** LEGACY7 part three: the wed frames' own bucket (WED_HZ_MAX), the same strikes as a duel's. */
  _meterWed(ws, a, now) { return this._spend(ws, now, wedGate, 'wedBucket', 'wedDrops', 'too many wed frames') ? a : null; }
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
    // SCALE2b: listed from storage once a wake and kept (`_parks`, key -> record) - every cell hello listed the whole
    // namespace; the store and the drop below keep the copy as they write
    this._parks ??= this.state.storage.list({ prefix: 'park:' }).then((got) => new Map(got));
    const m = await this._parks;
    const out = [], dead = [];
    for (const [k, v] of m) { if (!v || typeof v.k !== 'string' || now - (v.at ?? 0) > PARK_TTL_MS) dead.push([k, v]); else out.push(v); }
    for (const [k] of dead) m.delete(k);
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128).map(([k]) => k));
    for (const [, v] of dead) if (v && typeof v.k === 'string') this._parkFan({ t: 'park', k: v.k, id: v.id, data: null }, v.sub);
    return out;
  }
  /** What a reader is told of a record: never the account (a place room names none - MOD1). WARDEN1: and when the town
   *  watch threw it (`y`, this cell's clock), so a joiner draws it where it landed. */
  _parkPublic(v) { return { k: v.k, id: v.id, name: v.name ?? '', r: v.r, at: v.at, ...(Number.isFinite(v.y) ? { y: v.y } : {}) }; }
  /** Fan a park word to every hello'd socket but the OWNER's account's own (its client draws its team off its save;
   *  its other tabs and characters are the same player - AUDIT HCC-PARK D2). */
  _parkFan(o, ownerSub) { const s = JSON.stringify(o); for (const [other, b] of [...this._all()]) if (b.id && b.sub !== ownerSub) this._send(other, s); }
  /** HCC-PARK: the owner's record stands in THIS cell. PARK_ACCOUNT_MAX of one account's (its own stalest goes
   *  first), PARK_CELL_MAX in all (the stalest goes). The same word again is no news: only its time is refreshed,
   *  and nobody is told (a socket repeating itself buys no fan).
   *  WARDEN1 (net/wire.js): a word that keeps the team on its spot (parkSameSpot) keeps when it came to stand there (`since`); a
   *  team the town watch threw keeps its mark (`y`) while its owner re-says the spot it was thrown from - they were
   *  away when it happened - and the record is answered (the caller tells the owner); a word that moved it clears the
   *  mark. Then the watch's round (a fifth team in a town throws the longest parked). Answers the thrown record the
   *  owner re-said, or null. */
  async _parkStore(k, sub, id, name, r, now) {
    const list = await this._parkList(now);
    const had = list.find((e) => e.k === k) ?? null;
    if (had && had.id === id && had.name === name && JSON.stringify(had.r) === JSON.stringify(r)) {
      if (now - (had.at ?? 0) > PARK_REFRESH_MS) { const fresh = { ...had, at: now }; (await this._parks)?.set(parkKey(k), fresh); await this.state.storage.put(parkKey(k), fresh); }
      return Number.isFinite(had.y) ? had : null;
    }
    const same = !!had && parkSameSpot(had.r, r), thrown = same && Number.isFinite(had.y);
    const byAge = (x, y) => (x.at ?? 0) - (y.at ?? 0);
    const mine = list.filter((e) => e.k !== k && e.sub === sub).sort(byAge);
    const gone = new Set();
    for (const e of mine.slice(0, Math.max(0, mine.length - PARK_ACCOUNT_MAX + 1))) { gone.add(e.k); await this._parkDrop(e.k); }
    const others = list.filter((e) => e.k !== k && !gone.has(e.k)).sort(byAge);
    for (const e of others.slice(0, Math.max(0, others.length - PARK_CELL_MAX + 1))) await this._parkDrop(e.k);
    const rec = { k, sub, id, name, r, at: now, since: same && !thrown ? (had.since ?? had.at ?? now) : now, ...(thrown ? { y: had.y } : {}) };
    (await this._parks)?.set(parkKey(k), rec);   // SCALE2b: the kept copy
    await this.state.storage.put(parkKey(k), rec);
    this._parkFan({ t: 'park', k, id, name, at: now, data: r, ...(thrown ? { y: had.y } : {}) }, sub);
    await this._parkWarden(now);
    return thrown ? rec : null;
  }
  /**
   * WARDEN1 (net/wire.js wardenVerdicts): THE TOWN WATCH'S ROUND over this cell's parked teams - each it throws marked
   * (`y`, this cell's clock), fanned to everyone but its owner's account (as every park word is), and told its owner's
   * sockets here (`parkYeet`); the next road team's time kept (`_wardenAt`, null: none waits). Run at every store, every
   * hello's list, and at the first frame past that time - NEVER ON THE ALARM: a cell's alarm is its other duties' (a
   * drained room's firing is its world's forgetting), and a throw nobody is in the room to see is made before the next
   * joiner reads the cell. Answers how many it threw.
   */
  async _parkWarden(now) {
    const list = await this._parkList(now);   // the cell's live teams (a team past its life swept, as a list sweeps it)
    const m = await this._parks;
    const { due, next } = wardenVerdicts(list, now);
    let n = 0;
    for (const k of due) {
      const had = m.get(parkKey(k));
      if (!had || Number.isFinite(had.y)) continue;
      const rec = { ...had, y: now };
      m.set(parkKey(k), rec);
      await this.state.storage.put(parkKey(k), rec);
      this._parkFan({ t: 'park', k, id: rec.id, name: rec.name ?? '', at: rec.at, data: rec.r, y: now }, rec.sub);
      this._parkTellOwner(rec);
      n++;
    }
    this._wardenAt = next;
    return n;
  }
  /** WARDEN1: the town watch threw this record's team - its owner's sockets here that spoke for it (`pk`, the park key
   *  their last park frame named) are told where it stood and where it landed (wire.js validParkYeet); `only` one of
   *  them (the owner re-saying the spot). */
  _parkTellOwner(rec, only = null) {
    const from = parkSpotOf(rec.r), to = rec.r?.ly;
    if (!from || !Array.isArray(to) || !Number.isFinite(rec.y)) return;
    const s = JSON.stringify({ t: 'parkYeet', at: rec.y, from, to, k: rec.k });   // AUDIT WARDEN1 C6: whose team
    for (const [ws, b] of [...this._all()]) if ((only === null || ws === only) && b.id && b.sub === rec.sub && b.pk === rec.k) this._send(ws, s);
  }
  /** HCC-PARK: the owner's record in THIS cell goes (a no-op when there is none), and everyone here is told. `before`:
   *  the registry's word is about a record said no later than it (AUDIT HCC-PARK D4 - a drop that crossed a newer
   *  store in flight leaves the newer one standing). */
  async _parkDrop(k, before = Infinity) {
    const had = await this.state.storage.get(parkKey(k));
    if (!had || (had.at ?? 0) > before) return;
    (await this._parks)?.delete(parkKey(k));   // SCALE2b: the kept copy
    await this.state.storage.delete(parkKey(k));
    this._parkFan({ t: 'park', k, id: had.id, data: null }, had.sub);
  }
  /** HCC-PARK: the owner's registry learns the cell their team stands in (null: nowhere), stamped with when the word
   *  was said. A relay built without the binding (a harness, a local dev worker) keeps the cell's own law and skips
   *  the cross-cell drop. AUDIT SCALE II R3-8: `ly` the layer of the cell whose object keeps the record (SCALE5d) - said
   *  by the object that stored it, its own; left out by one that names a cell it does not hold the record for. */
  async _parkRegister(k, cell, at, ly) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return;
    try {
      await rooms.get(rooms.idFromName(parkRegistryRoom(k))).fetch(new Request(`https://relay.internal${PARK_INTERNAL_REG}`, { method: 'POST', body: JSON.stringify({ owner: k, cell, at, ...(ly !== undefined ? { ly } : {}) }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));   // AUDIT SCALE II R3-8: and the layer the record stands in, when this object holds it
    } catch (e) { console.warn('[park] registry', e?.message ?? e); }
  }
  /** Tell a cell to drop an owner's record said no later than `at`. */
  async _parkTellDrop(cell, k, at) {
    const rooms = this.env?.ROOMS;
    try { await rooms?.get(rooms.idFromName(cell)).fetch(new Request(`https://relay.internal${PARK_INTERNAL_DROP}`, { method: 'POST', body: JSON.stringify({ owner: k, at }), signal: AbortSignal.timeout(ROOM_CALL_MS) })); }
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
    // AUDIT SCALE II R3-8: A RECORD STANDS IN A CELL'S LAYER. The registry kept the cell alone and told the drop to its
    // key - the place itself - so a team parked from a layer, then parked elsewhere, stood on in that layer as a ghost
    // wagon for PARK_TTL_MS (72 h). The registry keeps the layer the storing object said (`ly`), and the drop goes to
    // that layer's object (layerName). A word that names a cell whose record it does not hold says no layer: the one
    // kept for that cell stands. A record from before it carries none - the place itself, as it always was
    const ly = cell === null ? 0 : body.ly !== undefined ? layerOf(body.ly) : prev?.cell === cell ? prev.ly | 0 : 0;
    const where = cell && layerName(cell, ly), was = prev?.cell ? layerName(prev.cell, prev.ly | 0) : null;
    if (prev && (prev.at ?? 0) > at) {
      if (where && where !== was) await this._parkTellDrop(where, k, at);
      return json({ ok: true });
    }
    await this.state.storage.put('reg', { cell, at, ...(ly ? { ly } : {}) });
    await this.state.storage.setAlarm(at + PARK_TTL_MS);   // AUDIT 68 X8-park-registry-unbounded: the word is forgotten when every record it could name has expired
    if (was && was !== where) await this._parkTellDrop(was, k, at);
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
  /** AUDIT MERGE-PLUS A3: THE HOLDS SURVIVE A WAKE. They were instance memory, and a hub hibernates or restarts
   *  whenever it likes: a removal heard, the hub asleep, and a token minted before the removal (five minutes' life)
   *  put the removed member back into the guild's chat for as long as that socket stayed open. The storage copy is
   *  read once a wake, before any hold is asked, and written after each new hold, pruned to what can still matter. */
  _loadGuildOuts(nowS = Math.floor(Date.now() / 1000)) {
    this._guildOutsLoad ??= (async () => {
      const kept = await this.state.storage.get(GUILD_OUTS_KEY);
      if (!kept || typeof kept !== 'object') return;
      for (const [k, i] of Object.entries(kept)) {
        if (typeof k !== 'string' || !Number.isSafeInteger(i) || i < nowS - GUILD_OUT_KEEP_S) continue;
        if (!(this._guildOuts.get(k) >= i)) this._guildOuts.set(k, i);   // a hold heard since the wake is kept if newer
      }
    })();
    return this._guildOutsLoad;
  }
  async _saveGuildOuts(nowS) {
    for (const [k, i] of this._guildOuts) if (i < nowS - GUILD_OUT_KEEP_S) this._guildOuts.delete(k);
    await this.state.storage.put(GUILD_OUTS_KEY, Object.fromEntries(this._guildOuts));
  }
  /** GUILD1c: whether this room heard member `gm` of guild `gi` removed, or the guild gone, AFTER `i` - a token or an
   *  order said at `i` is older than that word and does not put the member back. */
  _guildOutAfter(gi, gm, i) {
    const all = this._guildOuts.get(gi);
    const one = gm === undefined ? undefined : this._guildOuts.get(`${gi}:${gm}`);
    return (all !== undefined && all > i) || (one !== undefined && one > i);
  }
  /** GUILD1c: an attachment with its guild taken off (its id, tag and member row) - AUDIT-SEATS: and its Season's banner
   *  ribbon, which is a guild's (a member who leaves, or changes guild, wears it no more; a token minted since says the
   *  same). */
  _unguild(a) { const b = { ...a }; delete b.gi; delete b.gt; delete b.gm; delete b.rb; return b; }
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
    // AUDIT SAFE RELAY-9 (and RELAY-13b): A LINE IS SIGNED ONCE IT WILL BE FANNED. The stamp and a new voice's meter were
    // spent here first - before the junk checks and every budget below - so a room over its budget signed every line it
    // then dropped (the audit's probe: 106 signatures for 20 lines heard) and a sprout's gap ran from a line nobody
    // heard. Each arm signs after its own checks and budget, just before its fan (`_stamped`); a new voice is asked
    // before the room's budget and metered by a line that budget lets through, and no other. The echo, and the stamp it
    // carries, are as they were.
    const words = frame.t === 'chat';   // a chat line - stamped, and paced in a channel; a roll is neither
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
      if (words) frame = await this._stamped(ws, a, ch, frame);   // SAFE2: a guild's line stamped - never paced (SAFE6)
      if (!frame) return;
      const line = JSON.stringify({ ...frame, ch: 'guild' });
      for (const other of [...(this._byGuild().get(a.gi) ?? [])]) this._send(other, line);   // the sender's own tabs too: the echo is the receipt   // SCALE5c: the guild's own sockets, never a walk of the whole hub (a copy - a failed send forgets its socket)
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
      if (words) frame = await this._stamped(ws, a, ch, frame);   // SAFE2: a party's line stamped - never paced (SAFE6)
      if (!frame) return;
      const line = JSON.stringify({ ...frame, ch: 'party' });
      for (const member of party.members) for (const other of this._socketsOf(member)) this._send(other, line);
      return;
    }
    // AUDIT PRE-MERGE 1003b R4: A PRIVATE SESSION'S ROOM TALKS AMONG ITS MEMBERS - a stranger with the code, or a member
    // removed who kept its socket, neither speaks to the session (its line ignored before it spends the room's budget)
    // nor overhears it
    const S = isArenaPrivateRoom(a.key) ? await this._sessionOf() : null;
    if (isArenaPrivateRoom(a.key) && !S?.members?.[a.sub]) return;
    // SAFE6: a new voice's line too soon is refused to its speaker alone, with how long to wait - never fanned, never
    // struck, and (AUDIT SAFE RELAY-9) before it spends the room's budget
    const wait = words ? this._newVoiceWait(a, now) : 0;
    if (wait > 0) { this._send(ws, JSON.stringify({ t: 'slowed', ms: Math.ceil(wait) })); return; }
    const room = tokenGate(this._roomChat, now, CHAT_ROOM_HZ_MAX);
    this._roomChat = room.bucket;
    if (!room.pass) return;
    if (words) this._newVoiceSpends(a, now);   // SAFE6: the account's meter, spent by a line the room lets through
    if (words) frame = await this._stamped(ws, a, ch, frame);   // SAFE2: the relay's stamp on what it relays
    if (!frame) return;
    const out = JSON.stringify(frame);
    const chat = isChatRoom(a.key);
    if (chat && !S && frame.t === 'chat') this._feedLine(a, ch, frame);   // SAFE5: a public line, for the reviewer's feed
    // SCALE5c: the bus's line to everyone - one entry a shard (`_vsendAll`), and its own sockets walked, never its shards'
    if (chat && !S && this._vper.size) { this._vsendAll(out); for (const [other, b] of this._reals()) if (b.id) this._send(other, out); return; }
    for (const [other, b] of this._all()) {   // SCALE5a: in place, as the join's
      if (!b.id || (S && !S.members[b.sub])) continue;
      if (other === ws || chat || inRange(a.key ?? '', a.pose, b.pose)) this._send(other, out);   // the sender hears its own line back: that is the receipt
    }
  }

  /** SAFE6 (bible/11-Multiplayer/Chat-Safety-Arc.md section 7): A NEW VOICE - a socket whose verified token wears the
   *  sprout (an account younger than SPROUT_S) or, AUDIT SAFE RELAY-11, names a guest (`gu`, off the token's `k` at the
   *  channel's hello): the arc's law is "a guest, or an account younger than SPROUT_S", and the sprout alone left every
   *  guest older than that unpaced - a throwaway made a fortnight ahead flooded at the old rate. */
  _newVoice(a) { return a.gu === 1 || (Array.isArray(a.glyphs) && a.glyphs.includes('sprout')); }
  /** SAFE6: A NEW VOICE'S PACE - how long, ms, until this account may say its next public line here (0 or less: now). A
   *  new voice says one line in a channel every NEW_VOICE_GAP_MS. Party and guild lines never ask (their arms of
   *  `_sayLine` return first, on budgets of their own), and a place's talk is never slowed. AUDIT SAFE RELAY-8: measured
   *  on the ACCOUNT's meter (`_paces`, by `a.sub`) - the socket's own let one account's K sockets say K lines a gap, and a
   *  reconnect start a fresh meter. */
  _newVoiceWait(a, now) {
    if (!isChatRoom(a.key) || !this._newVoice(a)) return 0;
    const at = this._paces.get(a.sub ?? a.id);
    return at === undefined ? 0 : at + NEW_VOICE_GAP_MS - now;
  }
  /** SAFE6: a new voice's line said - its account's meter set, and every meter that holds nobody back any more let go,
   *  oldest first (a meter set again goes to the back, so the walk stops at the first that still counts). Its size is the
   *  room's budget's: CHAT_ROOM_HZ_MAX lines a second, each held NEW_VOICE_GAP_MS. */
  _newVoiceSpends(a, now) {
    if (!isChatRoom(a.key) || !this._newVoice(a)) return;
    for (const [k, at] of this._paces) { if (at + NEW_VOICE_GAP_MS > now) break; this._paces.delete(k); }
    const k = a.sub ?? a.id;
    this._paces.delete(k);
    this._paces.set(k, now);
  }
  /** SAFE2 (bible/11-Multiplayer/Chat-Safety-Arc.md section 3): A LINE, STAMPED - the relay's signature over the line it
   *  is about to relay and the tab it is heard on (net/safety/chatStamp.js), which a report carries to the account
   *  service as the proof that this was said, by this account, then. A relay with no key, or a socket with no verified
   *  account, relays the line as it was: unstamped, and so unreportable. AUDIT SAFE RELAY S3: and null - the line said to
   *  nobody - when this room closed its speaker while it was signed (a ban): the sign is the one await between a line's
   *  budget and its fan, and the speaker it closed was banned there. */
  async _stamped(ws, a, ch, frame) {
    const key = a.sub ? await this._receiptKeyOf() : null;
    const sg = key ? await mintStamp({ tab: stampTabOf(a.key, ch), sub: a.sub, name: frame.name, at: frame.at, text: frame.text }, key, { subtle: crypto.subtle }) : '';
    if (this._dead.has(ws) || this._gone.has(ws)) return null;
    return sg ? { ...frame, sg } : frame;
  }
  /** SAFE5 (bible/11-Multiplayer/Chat-Safety-Arc.md section 6): A PUBLIC LINE, KEPT FOR THE REVIEWER'S FEED - only while
   *  MOD_FEED_URL is set, only a public tab's (chatStamp.js PUBLIC_TABS), never awaited by the line. The room posts a
   *  batch once FEED_BATCH lines wait or the first has waited FEED_WAIT_MS. AUDIT SAFE RELAY-12: FEED_BATCH IS THE WHOLE
   *  BOUND - the post takes the batch's lines the moment its last joins (`_feedFlush` splices them before it awaits
   *  anything), so a room's batch never holds more; the drop-oldest past FEED_LINES_MAX that stood here could never run
   *  (FEED_LINES_MAX is the service's bound on what it reads). Memory: a room that sleeps or is evicted before its post
   *  loses the batch, which a player can still report. */
  _feedLine(a, ch, frame) {
    const url = this.env?.MOD_FEED_URL;
    if (typeof url !== 'string' || !url.startsWith('https://') || !a.sub) return;
    const tab = stampTabOf(a.key, ch);
    if (!PUBLIC_TABS.includes(tab)) return;
    const q = this._feedQ ?? (this._feedQ = { lines: [], timer: null });
    if (!q.lines.length) q.timer = setTimeout(() => { void this._feedFlush(); }, FEED_WAIT_MS);
    q.lines.push({ tab, sub: a.sub, name: frame.name, at: frame.at, text: frame.text });
    if (q.lines.length >= FEED_BATCH) void this._feedFlush();
  }
  /** SAFE5: the waiting batch, signed with the relay's receipt key and posted to MOD_FEED_URL - answered or not, it is
   *  gone (the feed is an assistant's, and the relay never retries a post nor waits on one). Answers whether it went.
   *  AUDIT SAFE RELAY S1: THROUGH THE `ACCOUNTS` SERVICE BINDING where the Worker has it (server/wrangler.toml) - one
   *  Worker fetching another's workers.dev address on the same account may be refused outright (Cloudflare's error
   *  1042), and a post nobody retries or awaits would never say so; the URL then names the path alone. A Worker without
   *  the binding (a test, a local run) fetches the address, as before. */
  async _feedFlush() {
    const q = this._feedQ;
    if (!q?.lines.length) return false;
    if (q.timer) { clearTimeout(q.timer); q.timer = null; }
    const lines = q.lines.splice(0);
    try {
      const id = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const sealed = await sealFeed({ id, at: Date.now(), lines }, await this._receiptKeyOf(), { subtle: crypto.subtle });
      if (!sealed) return false;
      const init = { method: 'POST', headers: { 'content-type': 'application/json', [FEED_SIG_HEADER]: sealed.sig }, body: sealed.body, signal: AbortSignal.timeout(FEED_POST_MS) };
      const svc = this.env?.ACCOUNTS;
      const res = typeof svc?.fetch === 'function' ? await svc.fetch(new Request(this.env.MOD_FEED_URL, init)) : await fetch(this.env.MOD_FEED_URL, init);
      if (!res.ok) console.warn('[feed] the service said', res.status);
      return res.ok;
    } catch (e) { console.warn('[feed] post failed', e?.message ?? e); return false; }
  }
  /** SAFE4: a ban order carried in - a moderator's, or the banned player's own client handing on the hub's `law` - on
   *  the mute order's meter. */
  async _banFrame(ws, m) {
    const now = Date.now();
    if (!this._spend(ws, now, muteGate, 'mbucket', 'mdrops', 'too many mute orders')) return;
    await this._takeOrder(m.order, now, ['ban'], false);
  }
  /** SAFE4: the Worker's door - an order the account service pushed, for this hub to apply and hand on. AUDIT SAFE
   *  RELAY-4: the sockets a ban closed leave the room here - this door is no socket's, and nothing reaps after it. */
  async _lawInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const ok = await this._takeOrder(body?.order, Date.now(), ['ban', 'mute'], true);
    await this._reap();
    return json({ ok });
  }
  /** SAFE4: A MUTE OR BAN ORDER TAKEN - MOD1's arm's law, for every door an order now comes in by. The signature is the
   *  whole of the authority; the newest order for an account wins and the same one twice is one. A mute sets the
   *  account's sockets here to `mu` (`_orders`, MOD1's). `hand`: the hub's door - each of the account's sockets is also
   *  handed the order itself (`law`), so its own client carries it to every room it holds, as a moderator's client
   *  carries a mute. Answers whether it was an order this room believes.
   *
   *  AUDIT SAFE RELAY-4: A BAN TAKES THE ACCOUNT OUT OF THE ROOM. It only silenced: a banned socket stayed, posed, and
   *  heard everything. Each of the account's sockets is handed the order first (`law` - CLIENT-2: the hub said `banned`
   *  first, and the client left on that word before it carried the order anywhere), then told `banned`, then closed
   *  CLOSE_POLICY 'banned'; and while the ban stands its hello is refused (`_bannedHello`). A ban lifted (`bn` 0) closes
   *  nothing and refuses nothing. AUDIT SAFE RELAY-5: THE BAN IS ITS OWN ORDER (`_bans`), never `_orders`' row: a newer
   *  mute or unmute never lifts it, and an unban never lifts a mute that stands. AUDIT SAFE RELAY-7: kept in storage.
   *  AUDIT SAFE RELAY-10: the kind is read off the claims first, so an order costs ONE verify (it cost a ban's, then a
   *  mute's). AUDIT SAFE RELAY-6: A SOCKET WHOSE TOKEN WAS MINTED AFTER THE ORDER IS LEFT ALONE - its token carries the
   *  account's word as of its mint, newer than the order's, and an unmute handed to a client earlier and carried in after
   *  its reconnect lifted the mute its fresh token wore (`_named`'s law at the hello, the other way round). `gio` is the
   *  token's `i` - or a guild order's since, when a guild change inside the order's minute leaves that one socket to its
   *  next token, MOD1's gap. */
  async _takeOrder(order, now, kinds, hand) {
    if (typeof order !== 'string' || !order || order.length > 1024) return false;
    const kind = lawKindOf(order);
    if (!kinds.includes(kind)) return false;
    await this._loadKey();
    if (!this._verifyKey) return false;
    const nowS = Math.floor(now / 1000);
    const r = await verifyOrder(order, this._verifyKey, { subtle: crypto.subtle, nowS, kind });
    if (!r.ok) return false;
    const c = r.claims;
    const ban = c.o === 'ban';
    const sig = order.slice(order.lastIndexOf('.') + 1);
    if (ban) await this._loadBans(nowS);
    const book = ban ? this._bans : this._orders;
    const held = book.get(c.s);
    if (held && (c.i < held.i || held.sig === sig)) return true;
    const bn = ban && c.bn > nowS ? c.bn : 0;   // a ban's end - 0 lifted (or already over)
    book.delete(c.s);
    if (book.size >= (ban ? BANS_MAX : ORDERS_MAX)) book.delete(book.keys().next().value);
    book.set(c.s, ban ? { i: c.i, bn, sig } : { i: c.i, mu: c.mu, sig });
    if (ban) await this._saveBans(nowS);
    const told = JSON.stringify(ban ? { t: 'banned', until: bn } : { t: 'muted', until: c.mu });
    const law = hand ? JSON.stringify({ t: 'law', order }) : null;
    for (const [other, b] of [...this._all()]) {
      if (b.sub !== c.s || b.gio > c.i) continue;   // AUDIT SAFE RELAY-6: a token minted after the order is newer than it
      if (law) this._send(other, law);
      if (!ban) this._setAttach(other, { ...b, mu: c.mu });
      this._send(other, told);
      if (bn) this._banClose(other);
    }
    return true;
  }
  /** AUDIT SAFE RELAY-4: a banned account's socket closed - CLOSE_POLICY, 'banned', after its `law` and its `banned` - and
   *  leaving the room as every socket this object closes does (`_dead`, reaped at the door). A shard's hello the bus
   *  refused before it held its ShardSocket has nothing here to leave: its shard says the leave of the real one. */
  _banClose(ws) {
    try { ws.close(CLOSE_POLICY, 'banned'); } catch { /* gone */ }
    if (ws.virtual && this._vsocks.get(ws.vid) !== ws) return;
    this._dead.add(ws);
    this._closed(ws);
  }
  /** AUDIT SAFE RELAY-4: A BANNED ACCOUNT'S HELLO - refused while this room holds a ban on the account that stands and is
   *  no older than the hello's token (`ti`, the token's `i`): told `{t:'banned', until}`, then closed as `_banClose`
   *  closes. A token minted after the ban is the service's word that the account plays again - it mints a banned one
   *  none - so it is let in even where the unban never arrived (MOD1's law for a mute at the hello, a ban's way; a token
   *  of the ban's own second is the ban's, as `_takeOrder` applies it). Answers whether it refused. */
  async _bannedHello(ws, sub, ti, now) {
    if (typeof sub !== 'string' || !sub) return false;
    const nowS = Math.floor(now / 1000);
    await this._loadBans(nowS);
    const ban = this._bans.get(sub);
    if (!ban || !(ban.bn > nowS) || ban.i < (Number.isSafeInteger(ti) ? ti : 0)) return false;
    this._metrics.c.refusals++;
    this._send(ws, JSON.stringify({ t: 'banned', until: ban.bn }));
    this._banClose(ws);
    return true;
  }
  /** AUDIT SAFE RELAY-7: THE BANS A WAKE LEFT IN STORAGE (BANS_KEY), read once a wake before any ban is asked or taken -
   *  each still inside BAN_KEEP_S kept, unless one heard since the wake is newer. A ban lived in memory alone, and a room
   *  that slept after taking one let a token minted before it back in (the audit's probe). A read that fails is asked
   *  again by the next hello. */
  _loadBans(nowS) {
    this._bansLoad ??= (async () => {
      let kept = null;
      try { kept = await this.state.storage.get(BANS_KEY); } catch (e) { this._bansLoad = null; console.warn('[bans] read', e?.message ?? e); return; }
      if (!kept || typeof kept !== 'object') return;
      for (const [s, v] of Object.entries(kept)) {
        if (!Array.isArray(v) || !Number.isSafeInteger(v[0]) || v[0] < nowS - BAN_KEEP_S) continue;
        if (this._bans.get(s)?.i >= v[0]) continue;   // a ban heard since the wake is kept if newer
        this._bans.set(s, { i: v[0], bn: Number.isSafeInteger(v[1]) ? v[1] : 0, sig: typeof v[2] === 'string' ? v[2] : '' });
      }
    })();
    return this._bansLoad;
  }
  /** AUDIT SAFE RELAY-7: the held bans written back after each new one, pruned to what can still matter (BAN_KEEP_S) -
   *  BANS_MAX entries at most, so the one value stays far inside the runtime's 128 KiB. */
  async _saveBans(nowS) {
    for (const [s, b] of this._bans) if (b.i < nowS - BAN_KEEP_S) this._bans.delete(s);
    try { await this.state.storage.put(BANS_KEY, Object.fromEntries([...this._bans].map(([s, b]) => [s, [b.i, b.bn, b.sig]]))); } catch (e) { console.warn('[bans] write', e?.message ?? e); }
  }

  /** AUDIT WORLD A3: a world room's memory is forgotten WORLD_TTL_MS after the room last drained - armed on the
   *  drain, re-armed by every later one - unless someone is in the room when it fires: a world parked in a room
   *  nobody plays would cost storage for ever, and the rooms a client can name are many. */
  async alarm() {
    await this._busSilentSweep(Date.now());   // AUDIT SCALE II R2-9
    // SCALE5c: a shard's alarm is its sync - every socket it holds told the bus, every HUB_SYNC_MS while it holds any;
    // SCALE5d part two: a court's copy syncs as a shard does. AUDIT SCALE II R2-4: its name read back from its storage when
    // its sockets say none, and the alarm kept while anything is still owed the bus (a last leave on a woken instance)
    if (await this._hubKeyOf()) { this._hubSyncAt = 0; await this._hubUpFlush(); this._hubPollEnsure(); if (this.state.getWebSockets().length || this._up.length || this._upRetry) await this.state.storage.setAlarm(Date.now() + HUB_SYNC_MS); return; }
    await this._seaAlarm(Date.now());   // AUDIT SEA VENTURES A8: a wreck nobody came back to, signed on the room's alarm
    if (await this.state.storage.get('hub')) { await this._relayCfgOf(); await this._sweepHub(Date.now()); await this._heraldBeat(Date.now()); await this._egHeraldBeat(Date.now()); await this._serpentHeraldBeat(Date.now()); await this._sdBeat(Date.now()); await this._sdHeraldBeat(Date.now()); return; }   // AUDIT SOC A3: the hub's alarm is its sweep, whoever is in the room; DISCORD-GATES: and its herald's posts; SERPENT2: and the serpent's; SD3: and the Super dungeon's director; SD-HERALD: and its herald's, after the director's moves; EG-E3: and the Spire's, after the gate's
    // AUDIT 68 X8-park-registry-unbounded: an owner's registry (HCC-PARK) is one object per account and character a
    // client names - its word goes PARK_TTL_MS after it was said, as the cell's record it points at does
    const reg = await this.state.storage.get('reg');
    if (reg) { const due = reg.at + PARK_TTL_MS; if (Date.now() >= due) await this.state.storage.delete('reg'); else await this.state.storage.setAlarm(due); return; }
    // WAGONS2-VISIT: a caravan's room forgets what its owner placed PARK_TTL_MS after they last said it, as the cell forgets the caravan
    const cv = await this.state.storage.get(CARAVAN_DECOR_KEY);
    if (cv) {
      const now = Date.now(), due = (cv.at ?? 0) + PARK_TTL_MS;
      if (now >= due) { this._cvDoc = null; this._cvOwed = null; await this.state.storage.delete(CARAVAN_DECOR_KEY); return; }
      if (this._cvOwed) await this._caravanFan(now);   // FINAL AUDIT: a fan owed goes when its bucket has repaid
      await this.state.storage.setAlarm(this._cvOwed ? Math.min(due, this._cvOwedAt) : due);
      return;
    }
    if (this._cvOwed) { await this._caravanFan(Date.now()); return; }   // a forgetting (`d` null) owed - no document kept to arm for
    if (await this._gateTick()) return;   // WB3: a gate room's alarm is its boss's beat
    if (await this._siegeTick()) return;   // PVP-REF: a siege room's alarm is its fallen fighters' waves
    if (await this._arenaTick()) return;   // ARENA4: a bout's beat, or the hall's queue
    const held = await this._holdemTick();   // CARDS5: a card table's seat clock, or its next deal
    const iheld = await this._iliacTick();   // CARDS10: an Iliac table's turn clock, or its next game
    const gheld = await this._gambitTick();   // KG5: a King's Gambit table's turn clock, its turn's end, or its deal
    if (this._dead.size) await this._reap();   // AUDIT CARDS-3 A3: a send the tick failed closed its socket - no close comes for it
    if (held || iheld || gheld) return;
    await this._sdInBeat(Date.now());   // AUDIT SD-THROUGH (A1): a realm's first soul through, owed the hub
    if (await this._sdFightTick()) return;   // SD8b: a realm's alarm is its Remnant's beat while its fight lives
    if (await this._egTick()) return;   // EG-PLAY: a breach's room's alarm is its director's beat while the breach lives
    // SERPENT1: A CELL WITH A SERPENT'S FIGHT beats it - and its other duties (a rite's tell, its raids' ends) still run,
    // every SERPENT_REST_MS while the fight beats and on every firing once it is over, under one alarm: the soonest of the
    // beat and what they arm
    const sp = await this._serpentTick();
    if (sp) {
      const now = Date.now();
      if (!sp.live || !(now < this._serpentRestAt)) { this._serpentRestAt = now + SERPENT_REST_MS; await this._alarmRest(); }
      const rest = await this.state.storage.getAlarm();
      await this.state.storage.setAlarm(Math.min(sp.at, Number.isFinite(rest) && rest > now ? rest : Infinity));
      return;
    }
    await this._alarmRest();
  }
  /** The alarm's duties past the boss rooms' beats: a rite's tell to its hub, a cell's raids, a world room's forgetting. */
  async _alarmRest() {
    const riteDue = await this._riteTellHub(Date.now());   // WB12d: a broken rite its hub has not heard (AUDIT BROKER-CAGE R4: not riteOwed - that is the circle's own test)
    const sdOwed = await this._sdTellHub(Date.now());   // SD3: a Hollow found its hub has not heard
    const starDue = await this._starSweep(Date.now());   // STAR3: a cell's stars - a deadline passed, a hold its hub has not heard, a ledger to forget
    if (await this._raidSweep(Date.now())) { if (riteDue) await this._riteArm(Date.now() + RITE_TELL_RETRY_MS); if (sdOwed) await this._sdCellArm(Date.now() + SD_TELL_RETRY_MS); if (starDue) await this._starArm(starDue); return; }   // RAID3: a cell's alarm is its raids' ends, and a cleanse its hub has not heard - never past the rite's retry, nor a find's, nor a star's
    if (starDue) return;   // STAR3: a cell that keeps a star forgets nothing yet - its alarm is the star's (armed by its sweep)
    for (const [, b] of this._all()) if (b.id) return;
    const m = await this.state.storage.list({ prefix: 'world:' });
    const dead = [...m.keys()];
    this._worldMemo = undefined;   // SCALE2b: the kept copy goes with the stored one
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
  }
  /** AUDIT SOC A3/A4: ONE PAGE of the hub's storage per firing - the accounts nobody's list names and nobody has seen
   *  for ACCOUNT_IDLE_MS are forgotten with their secrets (an account a list names is never touched: "a friend list
   *  that forgets people is worse than a kilobyte"), and the parties whose every seat has lapsed (no socket, and away
   *  past PARTY_OFFLINE_MS or never stamped) are deleted - a member's record still pointing at one is cleared on their
   *  next hello, as a drain's is. The cursors ride storage; a full page is followed SWEEP_STEP_MS later, an empty one
   *  ACCOUNT_SWEEP_MS later from the start. */
  async _sweepHub(now) {
    const cur = (await this.state.storage.get(['sweep:acct', 'sweep:party', 'sweep:gaterc', 'sweep:raidrc', 'sweep:serpentrc', 'sweep:sdrc', 'sweep:egrc', 'sweep:egcall', 'sweep:starrc']));   // AUDIT WBX2 M9: one read (EG-ZA: and the breach receipts' cursor; AUDIT EG IV: and the calls'; STAR3: and the star receipts')
    const acur = cur.get('sweep:acct') ?? null, pcur = cur.get('sweep:party') ?? null, gcur = cur.get('sweep:gaterc') ?? null, rcur = cur.get('sweep:raidrc') ?? null, scur = cur.get('sweep:serpentrc') ?? null;
    const accts = await this.state.storage.list({ prefix: 'acct:', limit: SWEEP_PAGE, ...(acur ? { startAfter: acur } : {}) });
    const dead = [], idle = []; let alast = null;
    for (const [k, r] of accts) { alast = k; const id = k.slice(5); if (unlisted(r, now) && now - (r.seen ?? 0) >= ACCOUNT_IDLE_MS && !this._socketsOf(id).length) idle.push([k, id, r.party]); }
    // AUDIT 68 S01-stale-party-pointer-blocks-sweep: a pointer lists the account only while its party does - a deleted
    // party leaves its members' pointers standing until their next hello, which an idle account never sends
    const seats = await this._partiesOf(idle.filter(([, , pid]) => pid).map(([, , pid]) => pid));
    for (const [k, id, pid] of idle) { const party = pid ? seats.get(pid) : null; if (party && party.members.includes(id)) continue; dead.push(k, acctSecretKey(id)); this._recs.delete(id); this._asecrets.delete(id); }
    const parties = await this.state.storage.list({ prefix: 'party:', limit: SWEEP_PAGE, ...(pcur ? { startAfter: pcur } : {}) });
    let plast = null;
    for (const [k, p] of parties) {
      plast = k;
      const lapsed = !p || !Array.isArray(p.members) || p.members.every((id) => !this._socketsOf(id).length && (p.away?.[id] == null || now - p.away[id] >= PARTY_OFFLINE_MS));
      if (lapsed) { dead.push(k); this._parties.set(k.slice(6), null); }
    }
    // AUDIT WBX R8: an expired receipt kept for an account that never came back goes too - it was forgotten only by
    // that account's own next hello
    const kept = await this.state.storage.list({ prefix: 'gaterc:', limit: SWEEP_PAGE, ...(gcur ? { startAfter: gcur } : {}) });
    let glast = null;
    for (const [k, r] of kept) { glast = k; if (!r || typeof r !== 'object' || !(Number.isFinite(r.e) && now < r.e * 1000)) dead.push(k); }
    // AUDIT RAID R2: and an account's raid receipts once none is still kept for its hello
    const rcs = await this.state.storage.list({ prefix: RAID_RC_PREFIX, limit: SWEEP_PAGE, ...(rcur ? { startAfter: rcur } : {}) });
    let rlast = null;
    for (const [k, v] of rcs) { rlast = k; if (!raidRcLive(v, now).length) dead.push(k); }
    // AUDIT SERPENT S5: and a serpent receipt kept for an account that never came back, once it has expired
    const src = await this.state.storage.list({ prefix: SERPENT_RC_PREFIX, limit: SWEEP_PAGE, ...(scur ? { startAfter: scur } : {}) });
    let slast = null;
    for (const [k, r] of src) { slast = k; if (!r || typeof r !== 'object' || !(Number.isFinite(r.e) && now < r.e * 1000)) dead.push(k); }
    // SD9a: and an Hour receipt (or its spent mark) kept for an account that never came back, once it has expired
    const dcur = cur.get('sweep:sdrc') ?? null;
    const drc = await this.state.storage.list({ prefix: SD_RC_PREFIX, limit: SWEEP_PAGE, ...(dcur ? { startAfter: dcur } : {}) });
    let dlast = null;
    for (const [k, v] of drc) { dlast = k; if (!v || typeof v !== 'object' || !(Number.isFinite(v.e) && now < v.e * 1000)) dead.push(k); }
    // EG-ZA (Elite-Gates.md section 23, step 5 - "the gaterc sweep, widened by one prefix"): and an account's held breach
    // receipts once every one of them (and every spent mark) has expired
    const ecur = cur.get('sweep:egrc') ?? null;
    const erc = await this.state.storage.list({ prefix: EG_RC_PREFIX, limit: SWEEP_PAGE, ...(ecur ? { startAfter: ecur } : {}) });
    let elast = null;
    for (const [k, v] of erc) { elast = k; if (!egRcFold(v, [], Math.floor(now / 1000)).length) dead.push(k); }
    // AUDIT EG IV (lane3 #9): and a breach's call kept for an account that never came back, once its open window has ended -
    // it was forgotten only by that account's own next hello (_egCallTo), AUDIT WBX R8's case for the receipts
    const ccur = cur.get('sweep:egcall') ?? null;
    const calls = await this.state.storage.list({ prefix: egCallKey(''), limit: SWEEP_PAGE, ...(ccur ? { startAfter: ccur } : {}) });
    let clast = null;
    for (const [k, v] of calls) { clast = k; if (!(v?.until > now)) dead.push(k); }
    // STAR3: and an account's star receipts once none is still kept for its hello (the raid's keep, its own shape)
    const tcur = cur.get('sweep:starrc') ?? null;
    const trc = await this.state.storage.list({ prefix: STAR_RC_PREFIX, limit: SWEEP_PAGE, ...(tcur ? { startAfter: tcur } : {}) });
    let tlast = null;
    for (const [k, v] of trc) { tlast = k; if (!raidRcLive(v, now).length) dead.push(k); }
    for (let i = 0; i < dead.length; i += SWEEP_PAGE) await this.state.storage.delete(dead.slice(i, i + SWEEP_PAGE));
    const more = accts.size >= SWEEP_PAGE || parties.size >= SWEEP_PAGE || kept.size >= SWEEP_PAGE || rcs.size >= SWEEP_PAGE || src.size >= SWEEP_PAGE || drc.size >= SWEEP_PAGE || erc.size >= SWEEP_PAGE || calls.size >= SWEEP_PAGE || trc.size >= SWEEP_PAGE;
    await this.state.storage.put({ 'sweep:acct': accts.size >= SWEEP_PAGE ? alast : null, 'sweep:party': parties.size >= SWEEP_PAGE ? plast : null, 'sweep:gaterc': kept.size >= SWEEP_PAGE ? glast : null, 'sweep:raidrc': rcs.size >= SWEEP_PAGE ? rlast : null, 'sweep:serpentrc': src.size >= SWEEP_PAGE ? slast : null, 'sweep:sdrc': drc.size >= SWEEP_PAGE ? dlast : null, 'sweep:egrc': erc.size >= SWEEP_PAGE ? elast : null, 'sweep:egcall': calls.size >= SWEEP_PAGE ? clast : null, 'sweep:starrc': trc.size >= SWEEP_PAGE ? tlast : null });
    await this.state.storage.setAlarm(now + (more ? SWEEP_STEP_MS : ACCOUNT_SWEEP_MS));
  }

  async webSocketMessage(ws, message) {
    this._metrics.c.frames++; this._metrics.c.bytesIn += typeof message === 'string' ? message.length : (message?.byteLength ?? 0);   // SCALE2b
    try { await this._message(ws, message); } finally { await this._reap(); this._metricsTick(); }
  }
  /** SCALE2b: the window's metrics point, when it is due (or `force`d - a drain) - relayScale.js RoomMetrics. */
  _metricsTick(force = false) {
    const n = this._idx?.size ?? 0;
    if (n > this._metrics.c.peak) this._metrics.c.peak = n;   // SCALE5b: the window's most, seen at every door that ticks (and every socket adopted)
    try { this._metrics.flush(this.env?.METRICS, this._kind ?? 'none', this._idx?.size ?? 0, RELAY_VERSION, Date.now(), force); } catch { /* a metric never costs a frame */ }
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

    // ═══ REALM-DOOR: ONLINE IS THE REALM'S ═══════════════════════
    //
    // The realm's separation was the new build's law alone: its boot
    // never takes a local slot online, and this door never asked. So a
    // build from before the realm - a tab left open, the desktop app's
    // portable exe and macOS copies - played online as it always had,
    // and a character made there after the census froze could never
    // come in (Gryphoth, 2026-09-29). The service now signs whether the
    // character the mint named is one of the account's realm characters
    // (`rc`), and a 0 is refused HERE, in every room, before anything
    // is written - not even the signature is spent. A token with no `rc`
    // is a service from before this slice (the two Workers deploy on
    // their own) and is admitted as it was; the service stamps every
    // mint from acct22 on, and a token lives MAX_TTL_S.
    if (r.claims.rc === 0) return { error: REALM_DOOR_WORD };

    // ═══ SPENT ONCE ══════════════════════════════════════════════
    // The signature is the token's own unique part; `e` says how long
    // this room must remember it, so the set sweeps itself rather than
    // needing a cron that can silently stop running (F9's lesson, one
    // system over).
    const sig = m.tok.slice(m.tok.lastIndexOf('.') + 1);
    for (const [k, until] of this._spent) { if (until > nowS) break; this._spent.delete(k); }   // SCALE2b: from the oldest, stopping at the first still good - spent tokens arrive in about the order they expire, so a hello no longer walks the whole map
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
    const lt = order && order.i > r.claims.i ? order.i : r.claims.i;   // LEASE1: when that word was said - a lease older says nothing of the mute
    // RENOWN1: and Renown, off the same signature - `lv`
    // beside the title and glyphs, stamped by `badged` wherever they are.
    // GUILD1c: and the guild - its id, tag and member row, all three or none - unless this room has since heard that
    // member removed or that guild gone, which wins over a token minted before it. `gio` is when the guild worn was
    // said, so a guild order older than the token changes nothing.
    const c = r.claims;
    if (c.gi) await this._loadGuildOuts(nowS);   // AUDIT MERGE-PLUS A3: the holds a wake left in storage
    const guild = c.gi && !this._guildOutAfter(c.gi, c.gm, c.i) ? { gi: c.gi, gt: c.gt, gm: c.gm } : {};
    // WB9g: and the aura at their feet - `au`, the one the token signed for (stamped by `badged` beside the title)
    // WITCH1: and the profile icon worn - `pi`, the one the token signed for (stamped by `badged` beside the aura)
    // SEAT1c: `ts`, a seat title's claim; GLYPH-WEAR: `gx`, the glyphs taken off - `badged` leaves them out of every row, `glyphs` stays whole for the rights
    // LEGACY7 part two: and the house - `hn`, `hc`, `hb`, `hg`, the line the realm character is of (stamped by `badged`)
    const house = c.hn ? { hn: c.hn, ...(c.hc ? { hc: c.hc } : {}), ...(c.hb ? { hb: c.hb } : {}), ...(c.hg ? { hg: c.hg } : {}) } : {};
    // AUDIT LEGACY III O1: and the realm character itself - `ci`, beside the realm's yes alone (identityToken.js claimsValid)
    // INT7: and its ARMS (`wa`, the judged pack's most reach and its bow) - every referee's clip of a blow between players
    return { name: c.n, kind: c.k, subject: c.s, title: c.t, ts: c.ts, glyphs: c.g, gx: c.gx, au: c.au, pi: c.pi, rb: c.rb, mu, lt, lv: c.lv, ...guild, gio: c.i, ar: c.ar, cl: c.cl, ...house, ci: c.ci, wa: c.wa };   // ARENA4: the season's rating, the hall's queue's   // ARENA4b: `cl` the character's level, a ladder fighter's vitality's
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

  /**
   * PERF-RELAY1 (2026-10-09, Mac: "Yes and audit everything", of PERF-NEXT item 15 - bible/07-Rendering/Performance-Next.md;
   * bible/11-Multiplayer/Scale-Arc.md PERF-RELAY1): A POSE AND A PING, IN A METHOD OF THEIR OWN. They were an arm of
   * `_message`, and `_message` is past V8's ceiling for an optimized function (--max-optimized-bytecode-size): it runs
   * in the interpreter and the baseline compiler for the life of the object, and so did the room's hottest path - every
   * pose of every player, fanned to everyone in range. Here, under the ceiling, it is optimized like any small method;
   * the arm's every line is the arm's, in its order, but the fan's walk and its range test (below), and `_message`
   * hands it the frame as the arm took it.
   * @param {any} ws @param {any} a  the socket's attachment as `_message` read it @param {any} m  the parsed frame
   */
  async _poseFrame(ws, a, m) {
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
    // PVP-REF (Seats-Arc 6.1): A FIGHTER'S STEP IS JUDGED - faster than the referee's ceiling, it is neither kept nor
    // relayed, and the fighter is pulled back to its last good pose
    // AUDIT-SEATS R2/R4: AND THE POSE GATE IS SPENT FIRST, in a battle room. The step was judged BEFORE the meter, so a
    // pose the 20 Hz gate then dropped had already moved the referee's fighter (a burst outran the ceiling it never
    // reached the gate with), and a refused step returned before the meter - 5,000 refused poses in a millisecond bought
    // 5,000 `back` frames and never a strike. Over the rate a fighter's pose is dropped WHOLE now - neither judged, kept
    // nor relayed - and struck; under it, judged, and a refusal has spent its token like any pose.
    const battle = posed && isBattleRoom(a.key) && a.sub;
    if (battle && !this._spend(ws, now, poseGate, 'bucket', 'drops', 'too many poses')) return;
    const step = battle ? await this._siegeStep(ws, a, m.p, now) : null;
    if (battle && !step) return;
    const turned = posed ? { ...(isEgRoom(a.key) ? { eAt: now } : {}), turn: ((a.turn | 0) + 1) & 0xffff, ...(still ? { kept: now } : {}), ...(isSdRoom(a.key) ? { pAt: now } : {}) } : {};   // AUDIT SD III (F3): an Hour's pose, stamped - the fight's census reads its age; EG-PLAY: and a breach's (`eAt`) - its director reads each body's age (`_egBodies`)
    const met = battle ? this._metered(ws, a, true, { pose: m.p }, turned) : this._meter(ws, a, now, { pose: posed ? m.p : a.pose }, turned, posed && !stopped);   // SCALE2b: a pose's write is lazy - a stop's is not, it is where the player stands
    if (!met) return;   // over the rate: kept as the latest, not relayed
    if (m.t === 'ping') { this._send(ws, '{"t":"pong"}'); return; }   // a ping that reached the object (the runtime answers the exact one in its sleep)
    if (chat) return;   // a channel is no place: a pose there is kept by no one and reaches no one
    if (posed) this._metrics.c.poses++;   // SCALE2b: a pose taken - the one a room fans
    if (a.ip) this._instanceRecheck(ws, a, now);   // INSTANCES (the audit): a member let in as the owner's party, asked again while it stays - off a pose the gate took
    // INT8: a duel's fighter's place is the referee's (a run it allows; the ring's edge), and every pose a room with a
    // bout takes beats the bouts - a fighter gone or out ends its bout on the next frame anyone sends
    if (posed && this._duelRef?.bouts.size) { duelPose(this._duelRef, a.sub, m.p, now); await this._duelBeat(now); }
    if (posed && this._wildRef?.fighters.has(a.sub)) { wildPose(this._wildRef, a.sub, m.p, now); await this._wildBeat(now); }   // INT9: the zone's believed place, and a fall waiting on a pick
    if (posed && this._trailing(a)) this._trailPose(ws, m.p, now);   // INT11: where a boss fight's body stood, as its poses came - AUDIT INT11: its socket's, in a fight that lives
    if (posed && isEgRoom(a.key) && typeof a.sub === 'string' && a.sub) this._egPoseIn(ws, a, m.p, now);   // EG-H1: a breach member's pose at its shared time - its trail and THE FAIR TRAIL
    if (posed && a.vid && a.ly && isGateRoom(a.key)) this._hubUpOwe(a.vid, 'p', m.p);   // SCALE5d part two: a court copy's pose is the court's too - where its body stands, and its trail
    if (posed && isCellRoom(a.key) && this._refereesPoses() !== this._rfSaid) this._rfSay();   // SCALE5b: a referee begun or ended here - the halos told
    // AUDIT-SEATS T2 (Seats-Arc 6.6: "no body drawn to fighters, no collider, excluded from every banner count, a free
    // camera over the town"): A SPECTATOR IS NO BODY - in a battle room a socket that is no fighter (a spectator's pass,
    // or a fighter's before its `in`) keeps its camera on its own attachment and is drawn to nobody: the fan below said
    // its every pose, and the fighters drew sixty spectators among them
    if (step === 'eye') return;
    // ARENA4: a bout's room - a fighter's pose is the referee's (its speed checked, its place the reach's); HOTFIX 1003f: a
    // spectator's is fanned as anyone's - the stands are bodies (a private session's stranger's reaches nobody, below)
    if (posed && m.p?.dd && typeof a.sub === 'string' && a.sub && isSdRoom(a.key)) await this._sdMarkFallen(a.key, a.sub);   // SD-ONELIFE: a death in the Hour, kept
    if (isArenaFloorRoom(a.key) && m.t === 'pose') {   // ARENA4b: in an exhibition's room no socket is ever on the sand
      const cur = this._attach(ws);
      if (cur.af) { try { const st = await this._boutOf(); if (st && cur.afid) poseOf(st, cur.afid, m.p.x, m.p.z, now); } catch (e) { console.warn('[arena] pose', e?.message ?? e); } }
    }
    // SCALE5b: the frame built once, as each kind of listener needs it - the whole pose for a socket that said no `w2`,
    // the slim entry for one that did (its batch, `_owe`)
    let out = null, entry = null;
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
    const S = isArenaPrivateRoom(a.key) ? await this._sessionOf() : null;   // AUDIT PRE-MERGE 1003b R4: a session's sand moves for its members alone
    if (isArenaPrivateRoom(a.key) && !S?.members?.[a.sub]) return;   // HOTFIX 1003f: and its stands - a stranger's pose reaches nobody
    // PERF-RELAY1: the index walked in place - nothing below sends, closes or adopts a socket until the fan, so the copy
    // a spread made of it (two hundred pairs at two hundred players, every pose) guarded nothing - and the sender's map
    // pixel derived once for the whole room (wire.js inRangeOf, inRange's own answer), not once a listener
    const reach = inRangeOf(a.key ?? '', m.p);
    for (const [other, b] of this._all()) {
      if (other === ws || !b.id || (S && !S.members[b.sub])) continue;
      if (reach(b.pose)) heard.push([other, b]);
    }
    for (const [other, b] of (still ? heard : poseFan(heard, m.p, (e) => e[1].pose, met.turn, (e) => e[1].id))) {   // SLAM10: the far tier bucketed by the listener's ID, so a moving crowd cannot shuffle who is served
      if (b.w2) this._owe(other, entry ??= JSON.stringify([a.id, slimPose(m.p, a.key)]));   // SCALE5b: the second wire's - batched, slim; SLIM-FRAME: rounded in the units of the room it was said in
      else this._send(other, out ??= JSON.stringify({ t: 'pose', id: a.id, p: m.p }));
    }
    // SEAT1b (Seats-Arc 4.2): THE WATCH - a verified account standing in a cell, having moved, is ticked every
    // WATCH_TICK_MS with a receipt only the account service counts, and only in a seat's own pixel (net/watchReceipt.js)
    // AUDIT-SEATS R7: in the pose's OWN cell alone - every cell room ticked whatever pixel the pose claimed, a halo's too
    // (the client keeps a halo's `watch` for nothing - net/online.js: "the relay ticks the socket that stands there,
    // never a halo's"), so one player stood in up to four rooms each minting its k1 receipts
    if (isCellRoom(a.key) && cellRoomOfWire(m.p.x, m.p.z) === a.key && typeof met.sub === 'string' && met.sub) await this._watchTick(ws, met.sub, m.p, !unmoved, now);
    return;
  }

  async _message(ws, message) {
    let a = this._attach(ws);
    this._kind ??= a.key ? roomKindOf(a.key) : null;   // SCALE2b: a metric names the room's kind, never the room
    // SCALE5c: A SHARD HANDS ON every frame but its socket's hello, ping, pose and lease (a channel keeps no place), AS IT
    // CAME - past the lease door alone, before any other door or parse here: the bus parses it, meters it and strikes for
    // it over the socket's ShardSocket, as the hub always did, and its doors (a quest's, which asks the account only the
    // bus's socket carries) are the bus's
    // LEASE1: past the lease door first (a review of the PR: a region's lines went up unleased) - the lease is the shard's
    // to keep, and the bus's socket for it is the shard's own
    if (a.vid && a.id && typeof message === 'string' && isChannelShard(a.key) && !shardKeeps(message)) { a = await this._leaseHeard(ws, a); if (a) this._hubForward(ws, a, message); return; }
    // SCALE5d part two: A COURT'S COPY HANDS ON its sockets' gate words - the fight is the court's. AUDIT SCALE II R3-1: by
    // what a frame IS, in the gate arm below, never by how it begins (here it was a frame's first bytes, and a gate word
    // in another key order stood a fight on the copy)
    // WARDEN1: a cell's road team whose time has come is thrown at the first frame of anyone in the room (a woken
    // object reads its teams once); every socket here keeps alive, so everyone in sight sees it on time
    // AUDIT WARDEN1 R4: a round that fails (the cell's park list refused) is the round's alone - asked again
    // WARDEN_RETRY_MS on with the list read afresh, and the frame read as ever (a refused list once cached threw at every
    // frame of every socket here)
    if (a.id && isCellRoom(a.key) && wardenDue(this._wardenAt, Date.now())) {
      try { await this._parkWarden(Date.now()); } catch (e) { this._parks = null; this._wardenAt = Date.now() + WARDEN_RETRY_MS; console.warn('[park] the watch', e?.message ?? e); }
    }
    a = this._seatHeard(ws, a, message);   // FIELD BUGS 2026-10-18d SEAT-LIVE: a dungeon room's seat follows its live sockets - before any door reads the host
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
    } else if (typeof message === 'string' && message.startsWith(OWN_PREFIX)) {
      // OWN1: a world room's second lane - ANY hello'd socket's own foes (a building's, a dungeon's shared quest's), so
      // it is budgeted at the door as a cell's stream is (anyone may send it); outside a world room it has no home
      if (!a.id) { this._refuse(ws, 'own before hello'); return; }
      if (!isWorldRoom(a.key)) { this._junk(ws); return; }
      a = this._meterFoes(ws, a, Date.now());
      if (!a) return;
      const ingress = byteGate(this._roomOwnIn, Date.now(), message.length, FOES_ROOM_BYTES_PER_S);
      this._roomOwnIn = ingress.bucket;
      if (!ingress.pass) return;
      doored = 'own';
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
    // AUDIT SCALE II R1-7: A SHARD KEEPS A FRAME BY WHAT IT IS. The door above kept a frame by its first key, and JSON's
    // last duplicate wins - `{"t":"pose","t":"chat",...}` was kept and run here as a line under the shard's own law (a
    // mute the bus applied never reached it). Parsed as anything but the four it keeps, it goes up as it came: the bus
    // parses it as this did, and judges it
    if (a.vid && a.id && isChannelShard(a.key) && m.t !== 'hello' && m.t !== 'ping' && m.t !== 'pose' && m.t !== 'lease') { a = await this._leaseHeard(ws, a); if (a) this._hubForward(ws, a, message); return; }   // LEASE1: as above
    // AUDIT SCALE II R3-7: and a court hears from a copy's socket its gate words alone (the copy hands up nothing else)
    if (ws.court && m.t !== 'gate') { this._junk(ws); return; }
    if (m.t === 'hello') {
      const now = Date.now();
      this._metrics.c.hellos++;   // SCALE2b
      const chat = isChatRoom(a.key);
      // AUDIT-SEATS R3: A BATTLE'S DOOR IS NEVER SHUT BY A STRANGER. The room's hello gate below was spent BEFORE the token
      // was read, so twelve tokenless hellos a second made the next real attacker's hello 'busy' - held from ten minutes
      // before the start to ten after it, a forfeit nobody fought. A siege's or a Royal Tourney's room spends its gate only
      // once the token AND the pass are verified (`_battleHelloGate`, below), by account: a hello refused for either
      // touches no bucket.
      const battle = isBattleRoom(a.key);
      // AUDIT PRE-MERGE 1003b R2: AND AN ARENA FLOOR'S DOOR NEITHER - a private session's code is read out on a stream, and
      // twelve tokenless hellos a second shut the room to every newcomer and to a fighter whose socket blinked (a forfeit
      // after ARENA_GONE_MS). A floor room's gate is spent after the token, by account, as a battle's (`_battleHelloGate`):
      // the session's members and the bout's fighters wait on themselves alone, everyone else on the stands' bucket
      const floor = isArenaFloorRoom(a.key);
      // AUDIT SD II (L7 M1): AND A SUPER DUNGEON'S REALM NEITHER - forty junk tokens a second (the right shape, refused at
      // their version) kept a fighter whose socket blinked out of her own fight for good (0 of 60 tries admitted), and
      // every newcomer with her. A realm's gate is spent after the token, by account (`_battleHelloGate`): an account the
      // realm has admitted before waits on itself alone, a newcomer on the room's bucket too
      const realmRoom = isSdRoom(a.key);
      const instRoom = isInstanceRoom(a.key);   // INSTANCES (the audit): nor an instance's - its key is known to every member it ever had
      const egRoom = isEgRoom(a.key);   // EG-PLAY: an Elite Breach's room - its company admitted by account below, after the room's own gate
      let gate = null;
      if (!battle && !floor && !realmRoom && !instRoom) {
        // the room's hello gate (A6): a storm is 2N frames a cycle for everyone in a place; a channel's hello costs no roster, so its gate runs deeper - never off (AUDIT CHAT A1)
        gate = tokenGate(this._hellos, now, this._helloHz(a.key));   // SCALE2b: in memory - see `_hellos`; GATE-DOOR: a court's (and its copies') door is its opening's
        this._hellos = gate.bucket;
        if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY, BUSY_TOKEN_UNREAD); return; }   // SCALE5a: asked before the token is read - the close says it is unspent, and the client's retry carries it again
      }
      if (await this._doorRefused(ws, a.key, m, now)) return;   // GROUND-GATE: a build on an older ground - GRANT-DOOR: or on no spawn grant while the door is on - refused before anything is written (a method of its own)
      // ACC1d: the name this socket will wear, and whether the relay vouches for it. AUDIT 68 S01-hello-writes-before-token:
      // asked BEFORE anything is written or replaced (the id's secret, its look, a live holder of the id, the
      // attachment), so a refused hello leaves nothing behind - a tokenless one planted a secret that refused the owner
      const who = await this._named(m, now);
      if (who.error) { this._refuse(ws, who.error); return; }
      if (await this._bannedHello(ws, who.subject, who.gio, now)) return;   // AUDIT SAFE RELAY-4: a ban this room took after the token was minted - told `banned` and closed, before anything is written (a method of its own)
      // SCALE5c: A SHARD HOLDS ITS OWN ACCOUNTS - one whose subject lands on another is told which (its client goes there),
      // before anything here is written
      if (isChannelShard(a.key) && shardOf(busOf(a.key), who.subject) !== a.key) { this._hubHop(ws, shardOf(busOf(a.key), who.subject) ?? /** @type {string} */ (busOf(a.key))); return; }   // SCALE5c part two: a region's shards the same
      if (isChannelBus(a.key) && m.hs === 1 && shardOf(a.key, who.subject)) { this._hubHop(ws, /** @type {string} */ (shardOf(a.key, who.subject))); return; }   // SCALE5c: a hub link of a build that knows the shards, said hello to the bus itself (no stored word of them yet), is told its own - before anything is held, so its close says no leave
      if (a.key.startsWith('owned:') && !await privateInteriorAdmits(a.key, who.subject, isStaff(who.glyphs))) {
        this._refuse(ws, 'private room'); return;
      }
      // INSTANCES: AN INSTANCE ADMITS ITS OWNER, STAFF AND THE OWNER'S PARTY - asked before anything is written (the owned
      // room's law above), its hello gate spent first by account (_instanceHello); the hub silent is busy, and the page
      // tries again. A member let in as the party is marked (`ip`) - the room asks again while it stays
      let instParty = false;
      if (instRoom) { const v = await this._instanceHello(a.key, who, now); if (v.no) { this._refuse(ws, v.no, v.no === 'busy' ? CLOSE_BUSY : undefined); return; } instParty = v.as === 'party'; }
      // WB3: A GATE'S ROOM ADMITS ONLY INSIDE ITS DAY'S WINDOW, asked before anything is written (the token's law just
      // above): a newcomer while the gate is open and its boss stands, a fighter already in the fight (a reconnect, a
      // player cast out and back) until the wrath's end. The Worker refused the key outside the window already; this is
      // the object's own word, for a socket that opened a moment before the seal.
      if (isGateRoom(a.key)) { const no = a.ly ? (gateHolds(gateDayOfRoom(a.key), now) ? null : 'the gate is closed') : await this._gateAdmit(a.key, who.subject, now); if (no) { this._refuse(ws, no); return; } }   // SCALE5d part two: a copy holds no fight - it asks the clock, and the court the rest when the hello reaches it
      // SD3: A SUPER DUNGEON'S REALM ADMITS while the hub's record holds its slot - a newcomer while it is found and its boss
      // stands, one who entered it before (a reconnect, a fighter cast out and back) until it is gone - asked before anything
      // is written (the gate's law; the Worker asked the hub already, and this is the object's own word for a socket that
      // opened a moment before the Hour closed)
      if (realmRoom) {
        const known = !!who.subject && (await this._sdRealmOf(sdSlotOfRoom(a.key))).in.includes(who.subject);
        gate = await this._battleHelloGate(who.subject ?? m.id, known ? 'fighter' : 'watch', now);   // AUDIT SD II (L7 M1)
        if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
        const no = await this._sdAdmit(a.key, who.subject, now, who.kind !== 'linked');   // AUDIT SD II (L7 M3): a guest is counted as one
        if (no === SD_NO_BUSY) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }   // AUDIT SD: the hub not answering - busy, tried again
        if (no) { this._refuse(ws, no); return; }
      }
      // EG-PLAY: AN ELITE BREACH'S ROOM ADMITS ITS COMPANY ALONE - a registered member of the company the hub froze, not
      // fallen, not gone home, inside the open window (or already in it: a reload) - asked before anything is written
      if (egRoom) {
        gate = await this._battleHelloGate(who.subject ?? m.id, 'fighter', now);
        if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
        const no = await this._egAdmit(a.key, who, now);
        if (no) { this._refuse(ws, no); return; }
      }
      if (floor) {
        gate = await this._battleHelloGate(who.subject ?? m.id, (await this._floorOwn(a.key, who.subject)) ? 'fighter' : 'watch', now);   // AUDIT PRE-MERGE 1003b R2
        if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
      }
      // PVP-REF: A SIEGE'S ROOM ADMITS THE DEVELOPERS ALONE until SEAT2a schedules its battles and signs its sides - the
      // referee's proving ground and its measurement (Seats-Arc 6.1). SEAT2a: BY ITS PASS - the account service's word
      // (the hello's `sp`) that this account fights on a side, or watches; the developers' ground only while the room
      // holds no battle
      let siegeSide = null;
      if (battle) {
        const v = await this._siegeAdmit(a.key, who, m.sp, now); if (v.no) { this._refuse(ws, v.no); return; } siegeSide = v.side;   // CROWN1 part two: and a Royal Tourney's, by its pass
        gate = await this._battleHelloGate(who.subject, siegeSide, now);   // AUDIT-SEATS R3: the token and the pass verified - now the gate
        if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
      }
      // ONE-SEAT (Mac: "the player can only have one character only at a time"): A HUB HELLO THAT DOES NOT CLAIM IS A
      // RECONNECT, and while another tab of the same account holds the hub the seat is that tab's - refused here, before
      // anything is written, so a tab superseded while its socket was down cannot take the seat back by reconnecting.
      // Its own old socket (the same id) is not another tab: the reconnect below replaces it. The claim is below, once
      // this hello has passed the refusals asked before anything is written (the token, the court, the id's secret).
      // AUDIT ONESEAT T7: two can still come after it - an attachment too large to hold and a welcome that cannot be sent
      // (the claimer's socket died) - and the tabs it closed are then out until a claim takes the seat again; the
      // claimer's own is one, its claim still unspent.
      const seatHeld = isSocialRoom(a.key) && who.subject ? this._otherTabsOf(who.subject, ws, m.id) : [];
      if (seatHeld.length && !m.cl) { this._refuse(ws, SEAT_ELSEWHERE, CLOSE_REPLACED); return; }
      // the id's secret (A3): the first hello mints it, a later one must match
      const held = await this._secretOf(m.id);   // SCALE2b: read once an id a wake, kept - see `_secretOf`
      if (held && held !== m.secret) { this._refuse(ws, 'id taken'); return; }
      // a second socket claiming the same id (a reconnect) replaces the
      // first: the first loses the id now, so its close says no leave
      const before = chat ? null : this._hostOf();   // the seat as it stood, the socket a reconnect replaces still counted; SCALE5a: a channel has no host (ROSTER-G) - it read no `before`, and walked every socket for it
      let replaced = null;   // AUDIT WORLD A4: the reconnect keeps the first hello's stamp - a host whose connection blipped keeps its seat
      for (const [other, b] of this._withId(m.id, ws)) {   // SCALE5a: listed by a method of its own (`_withId`) - `_message`'s own loops run interpreted
        replaced = b;
        if ((isChannelShard(a.key) || (a.ly && isGateRoom(a.key))) && b.vid) { this._vidIdx.delete(b.vid); this._hubUpOwe(b.vid, 'r', 0); }   // SCALE5c: its ShardSocket replaced too - nothing said for its account; SCALE5d part two: a court copy's too
        this._setAttach(other, { ...b, id: null, replaced: true });
        try { other.close(CLOSE_REPLACED, 'replaced'); } catch { /* gone */ }
        this._closed(other);   // SCALE2b
        // AUDIT SOC A7: a replaced socket loses its id BEFORE it closes, so its `_leave` says nothing - which is right for
        // the room (the id lives on) and wrong for its ACCOUNT when the replacing hello names another or none: no
        // last-seen, no presence, no `away` stamp, a seat that could never lapse. Its account leaves here.
        if (isSocialRoom(a.key) && b.acct && b.acct !== (m.acct ? (who.subject || m.acct) : null)) { try { await this._leaveAccount(other, b, now); } catch (e) { console.warn('[hub] replaced leave failed', e?.message ?? e); } }
      }
      // AUDIT WB A1: ONE SEAT AN ACCOUNT in a gate's court. The fight is the account's (net/gate/gateBrain.js - its players by
      // account, the newest socket speaking for it), so a second socket is never a second fighter, only a seat the court
      // cannot give anyone else: the older goes, replaced, its leave said.
      if ((isGateRoom(a.key) || isBattleRoom(a.key) || isSdRoom(a.key) || isCellRoom(a.key) || isWorldRoom(a.key)) && who.subject) for (const [other, b] of [...this._all()]) if (other !== ws && b.id && b.sub === who.subject) this._refuse(other, 'replaced', CLOSE_REPLACED);   // ONE-BODY (FIELD BUGS 2026-10-15c, a player twice in a town after a deploy; Mac: "One body per account"): and a cell's or a dungeon's place, one body an account - the older socket closed as replaced; PVP-REF: and a siege's field, one fighter an account; SD3: and a Super dungeon's realm
      if (egRoom && who.subject) for (const [sock, att] of [...this._all()]) if (sock !== ws && att.id && att.sub === who.subject) this._refuse(sock, 'replaced', CLOSE_REPLACED);   // EG-PLAY: and a breach's - one member an account, its newest socket
      if (isGateRoom(a.key) && !a.ly && who.subject) this._courtReplace(who.subject, null);   // SCALE5d part two: and the court's one seat across its copies
      // ONE-SEAT: A CLAIM TAKES THE SEAT - every other tab of this account in the hub is closed, the reason said first,
      // and its client leaves every room it holds (net/online.js `superseded`). Their leaves are said at the reap, as
      // every close this object makes is (AUDIT WORLD34 D1).
      if (m.cl) for (const other of seatHeld) this._refuse(other, SEAT_ELSEWHERE, CLOSE_REPLACED);
      // AUDIT DEEP2 C (ONE-SEAT R4's rule): never a socket this object closed or whose leave is said - the runtime may
      // list it until its close completes, and a joiner handed its mark held a ghost for TRAV_STALE_MS
      const others = this._othersOf(ws);   // SCALE5a: a method of its own
      // AUDIT ONESEAT R1: A SEAT THAT MOVED IS NOT A DRAIN. Nobody else here is an empty room only when nobody's seat
      // carried over - a claim that closed the account's other tabs, or a reconnect that replaced its own old socket,
      // moved a seat the room never lost, and the sweep below took every party in the hub with it (a stranger's too)
      const carried = !!replaced || (!!m.cl && seatHeld.length > 0);
      if (!others.length && !carried && !this._swept) { try { await this._sweep(); } catch (e) { console.warn('[room] sweep failed', e?.message ?? e); } }   // AUDIT-SEATS R3: a battle room's fighter spent no stored bucket   // an empty room forgets every look and secret an unclean close left behind - not its hello gate (AUDIT SOC A2: contained - a failed list here made every first hello into an empty hub throw before its welcome)   // SCALE5b: not when the drain's sweep already ran and nothing has said hello since - a halo's every step into an empty cell paid both
      this._swept = false;   // SCALE5b: this hello writes
      if (held !== m.secret || !this._secrets.has(m.id)) { await this.state.storage.put(secretKey(m.id), m.secret); this._secrets.set(m.id, m.secret); }   // SCALE2b: written when it is new, not on every hello (or when an empty room's sweep, just above, took it)
      if (!chat && (!this._looks.has(m.id) || JSON.stringify(this._looks.get(m.id)) !== JSON.stringify(m.look))) { await this.state.storage.put(lookKey(m.id), m.look); this._looks.set(m.id, m.look); }   // SCALE2b: and a look when it changed   // a channel keeps no look: nobody is drawn from it
      const guild = who.gi ? { gi: who.gi, gt: who.gt, gm: who.gm } : {};   // GUILD1c: the guild the token carried, when it carried one
      const arena = isArenaRoom(a.key) ? { ar: arenaRatingOk(who.ar), lk: who.kind === 'linked' ? 1 : 0, ...(Number.isSafeInteger(who.cl) && who.cl >= ARENA_CL_MIN && who.cl <= ARENA_CL_MAX ? { cl: who.cl } : {}) } : {};   // ARENA4: the hall queues by the signed rating, and a guest is queued for no rated bout   // ARENA4b: and a ladder bout's vitality is the signed character level's (`cl` - absent from a service before it)
      const linked = (isRegionRoom(a.key) || realmRoom) && who.kind === 'linked' ? { lk: 1 } : {};   // SD3: a region's channel marks a registered account - the census counts those alone (a guest is one click); AUDIT SD II (L7 H2): and a realm's - its stones count every guest as one turner
      const charLv = (isCellRoom(a.key) || realmRoom) && Number.isSafeInteger(who.cl) && who.cl >= 1 ? { cl: who.cl } : {};   // AUDIT SERPENT E4: a cell's serpent fighter's level is never above the token's own character level (`cl` - absent from a service before ARENA4b); AUDIT SD II (L7 M2): and a realm's fighter's level IS it
      if (egRoom && Number.isSafeInteger(who.cl) && who.cl >= 1) charLv.cl = who.cl;   // EG-PLAY: and a breach member's level is its token's character level
      // AUDIT PRE-MERGE 1003b R5: A FLOOR'S PLACE MOVES WITH ITS RECONNECT - a replaced socket loses its id before its close,
      // so its leave frees no seat, and the new socket's `in` took another: every blip a seat gone from the stands (a full
      // session's sixty), every fighter's a second body. The place the old socket held is the new one's
      const placed = floor && replaced ? { af: replaced.af ?? 0, afid: replaced.afid ?? null, asp: replaced.asp ?? 0 } : {};
      // AUDIT PRE-MERGE 1003b R4: a private session's floor is shown to its members - a socket that is none yet is shown
      // the sand when its join makes it one (`_sessionShow`)
      const shown = isArenaPrivateRoom(a.key) ? { shown: (await this._sessionOf())?.members?.[who.subject] ? 1 : 0 } : {};
      // SCALE5c: a shard's socket is the bus's ShardSocket by this id - and keeps what its hello said the bus, to say it again
      const shard = isChannelShard(a.key), copy = !!a.ly && isGateRoom(a.key), vid = shard || copy ? `${m.id}~${now.toString(36)}${(++this._vseq).toString(36)}${crypto.getRandomValues(new Uint16Array(1))[0].toString(36)}` : null;   // SCALE5d part two: a court copy's socket is the court's by this id
      if (shard || copy) {
        this._hubKey = shard ? a.key : layerName(a.key, a.ly);
        // AUDIT SCALE II R2-4: and kept, so a woken instance whose sockets say nothing still knows it
        if (this._hubKeyKept !== this._hubKey) { this._hubKeyKept = this._hubKey; try { await this.state.storage.put(HUB_KEY_KEY, this._hubKey); } catch { this._hubKeyKept = null; } }
      }
      if (!this._setAttach(ws, { ...a, ...placed, ...shown, ...(shard ? { vid, hm: { acct: m.acct ?? null, as: m.asecret ?? null, ps: m.ps === 1 ? 1 : 0, sc: m.secret } } : copy ? { vid } : {}), ...(m.gv >= GRANT_HELLO_LAW && streamsFoes(a.key) ? { gv: 1 } : {}), id: m.id, name: who.name, title: who.title, ...(who.ts ? { ts: who.ts } : {}), glyphs: who.glyphs, gx: who.gx, au: who.au, ...(who.pi ? { pi: who.pi } : {}), ...(who.rb ? { rb: who.rb } : {}), lv: who.lv, ...guild, ...(who.hn ? { hn: who.hn, hc: who.hc, hb: who.hb, hg: who.hg } : {}), ...(who.ci && !chat && !isSocialRoom(a.key) ? { ci: who.ci } : {}), ...(armsOk(who.wa) && !chat && !isSocialRoom(a.key) ? { wa: who.wa } : {}), gio: who.gio, ...(Number.isSafeInteger(who.lt) ? { lt: who.lt } : {}), ...(m.ls === 1 && leaseRoom(a.key) ? { ld: 0 } : {}), sub: who.subject, ...(instParty ? { ip: 1 } : {}), ...(siegeSide ? { sd: siegeSide } : {}), mu: who.mu, pose: chat ? null : m.pose, since: this._seatKeep(replaced, now), ...arena, ...charLv, ...linked, ...(chat && who.kind === 'guest' ? { gu: 1 } : {}), ...(m.w2 === 1 ? { w2: 1 } : {}) })) { this._refuse(ws, 'hello too large'); return; }   // MOD1: `sub` the verified account (what a mute names), `mu` until when it may not talk   // RENOWN1: `lv` the Renown level the token carried   // AUDIT SAFE RELAY-11: `gu`, a guest's socket in a channel - paced as a sprout's (`_newVoiceWait`)
      if (!chat && m.pose && this._trailing({ key: a.key, sub: who.subject })) this._trailPose(ws, m.pose, now);   // AUDIT INT11: a fighter's socket new to the room stands where its hello put it, from now - on its trail, or none says when
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
        const ev = isSocialRoom(a.key) && !shard ? await this._liveEvent() : null;   // SCALE5c: a shard's joiner hears it from the bus   // EVENT1: the hub says the live event staged now, so a player who joins mid-event sees it; no field is no event (an old client reads none)
        // TV3: a region's channel says where its travellers are - the fresh marks on the other sockets' attachments,
        // badged as the roster is, cut at TRAV_WELCOME_MAX; no field is no traveller (an old client reads none)
        // AUDIT DEEP T3-6: each with its AGE (`ag`, whole seconds) - a joiner stamps it that old, so a mark four minutes
        // stale here is not five minutes fresh there
        const tr = isRegionRoom(a.key) ? others.filter((b) => b.tm && now - b.tm.at <= TRAV_STALE_MS).slice(0, TRAV_WELCOME_MAX).map((b) => { const { at, bd, sr, ...p } = b.tm; return badged({ id: b.id, name: b.name, sub: b.sub, p, ...(bd ? { bd } : {}), ...(sr ? { sr } : {}), ag: Math.max(0, Math.floor((now - at) / 1000)) }, b); }) : [];
        if (!this._send(ws, JSON.stringify({ t: 'welcome', id: m.id, peers: named, n: shard ? this._hubN(others.length + 1) : others.length + 1, v: RELAY_VERSION, now: Date.now(), ...(ev ? { ev } : {}), ...(tr.length ? { tr } : {}) }))) return;   // AUDIT SOC B7: the relay's clock rides the channel's welcome too (WORLD5's `now`), so the hub link reads last-seen and an invite's lapse on the relay's time without waiting on the presence session's welcome
        // AUDIT SCALE5a C1-C3: AND THE ROOM'S COUNT, as the welcome says it (`n`). A client whose roster the welcome cut at
        // CHAT_ROSTER_MAX kept the count by arithmetic, a join +1 and a leave -1, and every door that says one without the
        // other moved it for good: a claim's closed tab (its leave said after the claimer's welcome had counted it out), a
        // joiner whose welcome failed (its leave said, no join), a reconnect after its old socket's leave. The count each
        // join and leave carries is the room's own, so nothing can drift (SCALE5a's `re` retired with it).
        // AUDIT SCALE II R2-4 (p4d): a shard woken knows no hub count until the bus says one - its join carries none then
        // (the client counts it), never its own few as the hub's
        const jn = shard ? (this._hubTotal != null ? this._hubN(others.length + 1) : null) : others.length + 1;
        const said = JSON.stringify(badged({ t: 'join', id: m.id, name: who.name, sub: who.subject, ...(jn != null ? { n: jn } : {}) }, who));
        this._fanRoster(ws, said);   // SCALE5a: the index walked in place, by a method of its own; SCALE5b: the second wire's batched
        if (shard) {
          // SCALE5c: A SHARD'S HELLO IS THE BUS'S TOO - its ShardSocket made there, which the account's picture, the
          // world's words and its receipts are said to, and the shard told the hub's count from then on
          this._vidIdx.set(vid, ws);
          this._hubUpOwe(vid, 'h', { att: this._shardAtt(this._attach(ws)), m: { acct: m.acct ?? null, asecret: m.asecret ?? null, ps: m.ps === 1 ? 1 : 0, cl: m.cl ? 1 : 0, secret: m.secret } });   // AUDIT SCALE II R2-1: the id's secret, the bus's to ask
          if (!this._hubAlarmed) { this._hubAlarmed = true; try { if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(now + HUB_SYNC_MS); } catch { /* the next hello arms it */ } }
          return;
        }
        if (isChannelBus(a.key)) this._busCountMoved();   // SCALE5c: the bus's own hello - its shards told the count
        if (isSocialRoom(a.key)) await this._hubHelloWords(ws, m, who.subject, now);
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
      // HOTFIX 1003f (2026-10-03, live: "people join and are alone"; the owner: "Everyone should be shown. Nobody should be
      // invisible."): A FLOOR DRAWS EVERYONE IN IT - a bout's room and the hour's exhibition's roster every socket here, the
      // stands as the sand (ARENA4 drew the fighters alone, so every watcher stood in an empty arena, seen by nobody).
      // AUDIT PRE-MERGE 1003b R4 stands: a private session's floor is its members' - a member is welcomed to the members
      // here, a stranger with the code or a member removed to a room that draws nobody (its join shows it all: `_sessionShow`)
      const unseen = isArenaPrivateRoom(a.key) && !this._attach(ws)?.shown;
      const S = isArenaPrivateRoom(a.key) ? await this._sessionOf() : null;
      if (isArenaPrivateRoom(a.key)) for (let i = others.length - 1; i >= 0; i--) if (unseen || !S?.members?.[others[i].sub]) others.splice(i, 1);
      const near = rosterFor(battle ? others.map((b) => this._drawn(b, a.key)) : others, m.id, m.pose);   // AUDIT-SEATS T2: in a battle room, a spectator's place is said to nobody
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
      // OW6L: a CELL's welcome carries its overworld ledger (`ow`: the bands and raiders spent here, its spawned
      // dungeons' clocks), so a player who walks in later agrees with the ones who were here - a halo's hello too (a
      // player at the seam hears the next cell's). No field is an empty ledger; no other room has one. Read BEFORE the
      // welcome is built, so its `now` stays the build's (AUDIT WORLD5 C11, below), and set before `world`, so the
      // memory, the clock and the version close the frame as they always have
      const ow = isCellRoom(a.key) ? await this._owWelcome(Date.now()) : '';
      // WORLD5: the relay's clock rides the welcome, so a client whose machine's clock is off reads the shared world time through the offset
      // AUDIT WORLD5 C11: stamped as the welcome is BUILT, not as the hello began - four storage awaits sit between the
      // two, and every millisecond of them was an offset the client carried as the relay's clock
      // SRV-N / SLAM13 (AUDIT SLAM A5): the relay's VERSION rides it (`v`, last), so a client can tell a restarted relay from the one it was talking to, and one built against another law can say so
      const gm = streamsFoes(a.key) ? this._grantWelcome() : '';   // GRANT2: the spawn grants' mode, a cell's (GRANT4: and a world room's)
      const rf = isCellRoom(a.key) && this._refereesPoses() ? ',"rf":1' : '';   // SCALE5b: this cell judges the poses that reach it - a halo's at their full rate
      const welcome = `{"t":"welcome","id":${JSON.stringify(m.id)},"peers":${JSON.stringify(roster)},"host":${JSON.stringify(host)}${ow},"world":${world ?? 'null'},"now":${Date.now()},"v":${JSON.stringify(RELAY_VERSION)}${rf}${gm}${a.ly ? `,"ly":${a.ly}` : ''}}`;   // SCALE5d: and which layer of the place this is
      if (!this._send(ws, welcome)) return;
      // AUDIT SCALE II R1-1: `_rfSaid` IS WHAT EVERY SOCKET OF THE SECOND WIRE WAS LAST TOLD - a welcome tells its own
      // socket alone. It was set here from the welcome's word, so a referee begun since the last pose (a Wild zone fighter,
      // a bout, a serpent's fight) and a hello before the next pose left every halo already here never told it: each said
      // its poses thinned while the cell judged them. A word that moved is said to all of them now
      if (isCellRoom(a.key) && this._refereesPoses() !== this._rfSaid) this._rfSay();
      // HCC-PARK: the cell's parked teams, after the welcome that resets the joiner's session (a halo's hello included)
      // AUDIT HCC-PARK (client C3): ALWAYS, an empty list included - a reconnect's welcome is the whole truth, and a
      // team taken up while this socket was away must go; never the joiner's own account's records (D2)
      if (isCellRoom(a.key)) {
        const now = Date.now(), sub = this._attach(ws)?.sub;
        await this._parkWarden(now);   // WARDEN1: a throw an alarm missed is made before the joiner reads the cell
        const parks = (await this._parkList(now)).filter((e) => e.sub !== sub).map((e) => this._parkPublic(e));
        if (!this._send(ws, JSON.stringify({ t: 'parks', now, data: parks }))) return;
        // AUDIT SHIPS B1: a serpent fight this socket hears is beaten again at once - the beat is armed by a serpent word
        // and kept while someone hears the fight, so a fighter back from a dropped socket left it asleep until her next
        // word, and the sleep's resume drew her serpent somewhere else
        try {
          const fights = await this._serpentFights(), b = this._attach(ws);
          for (const [id, f] of fights) if (b && !f.fell && !f.gone && this._serpentHears(id, f, b)) { await this._serpentArm(Date.now()); break; }
        } catch (e) { console.warn('[serpent] hello arm failed', e?.message ?? e); }
      }
      // WAGONS2-VISIT: a caravan's room hands its joiner what its owner placed in it (the `caravan` frame's), after the welcome
      if (caravanKeyOf(a.key)) { const cv = await this.state.storage.get(CARAVAN_DECOR_KEY); if (cv && Date.now() - (cv.at ?? 0) < PARK_TTL_MS && !this._send(ws, JSON.stringify({ t: 'caravan', data: cv.d }))) return; }
      // WILD1: a place room's remains, after the welcome (a halo's hello too - a body across the seam lies there for me
      // as well): every live one, in its chunks
      if (streamsFoes(a.key)) { try { await this._wildHello(ws, Date.now()); } catch (e) { console.warn('[wild] hello failed', e?.message ?? e); } }
      // SD6b: the Orrery's hall as it stands - the stones, the fray, the dial and the Concord - to a soul entering the Hour,
      // after the welcome that resets its session
      if (isSdRoom(a.key)) { try { if (!this._send(ws, this._sdHallWord(await this._sdHallOf(sdSlotOfRoom(a.key))))) return; } catch (e) { console.warn('[sd] hall word failed', e?.message ?? e); } }
      // SD8b: and its fight, while one lives or has fallen - a soul come in mid-fight sees the Remnant where it stands
      if (isSdRoom(a.key)) { try { if (!(await this._sdHelloFight(ws, who.subject, sdSlotOfRoom(a.key), now))) return; } catch (e) { console.warn('[sd] fight word failed', e?.message ?? e); } }
      // EG-PLAY: the breach as it stands, its hall's fight and this member's receipts, to a member entering, after the welcome
      if (egRoom) { try { if (!(await this._egHello(ws, who.subject, now))) return; } catch (e) { console.warn('[eg] hello word failed', e?.message ?? e); } }
      // AUDIT CARDS-6 C7/C1: an interior's Iliac tables - a ranked seat kept for this player's blink is his again, and the
      // ranked results his account is owed here are told again (a game won while his link was down is not lost with it)
      if (String(a.key ?? '').startsWith('interior:') && who.subject) { try { await this._iliacHello(ws, m.id, who.subject, Date.now()); } catch (e) { console.warn('[iliac] hello failed', e?.message ?? e); } }
      if (String(a.key ?? '').startsWith('interior:') && who.subject) { try { await this._gambitOwed(ws, { sub: who.subject }, 0); } catch (e) { console.warn('[gambit] hello failed', e?.message ?? e); } }   // KG6: and the King's Gambit results owed here
      if (unseen) return;   // HOTFIX 1003f: a floor's hello said as anyone's - a private session's stranger's to nobody (a member's join says it: `_sessionShow`)
      const join = JSON.stringify(badged({ t: 'join', id: m.id, name: who.name, look: m.look, pose: this._drawn({ sub: who.subject, pose: m.pose }, a.key).pose }, who));   // AUDIT-SEATS T2: and a spectator's join stands it nowhere
      for (const [other, b] of [...this._all()]) if (other !== ws && b.id && (!S || S.members[b.sub])) this._send(other, join);   // AUDIT PRE-MERGE 1003b R4: a member's to the members alone
      if (copy) {
        // SCALE5d part two: A COPY'S HELLO IS THE COURT'S TOO - its socket made there (admitted by the court's law, or
        // closed by it), and where it stands; its crowd here has met it already
        this._vidIdx.set(vid, ws);
        this._hubUpOwe(vid, 'h', { att: this._shardAtt(this._attach(ws)) });
        if (m.pose) this._hubUpOwe(vid, 'p', m.pose);
        if (!this._hubAlarmed) { this._hubAlarmed = true; try { if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(now + HUB_SYNC_MS); } catch { /* the next hello arms it */ } }
      }
      return;
    }
    // LEASE1 (net/roomLease.js): THE HUB'S WORD, IN EVERY ROOM - a lease asked or handed on (a method of its own), every
    // other frame but a ping past the lease door (`_leaseHeard`: the speaker alone is looked at, never the room - a silent
    // socket moves nothing and says nothing); and a socket the hub holds frozen is heard in nothing it says but its ping
    // and its lease
    if (m.t === 'lease') return this._leaseFrame(ws, a, m, message);
    if (m.t !== 'ping') { a = await this._leaseHeard(ws, a); if (!a) return; }
    if (a.fz && a.fz > Math.floor(Date.now() / 1000) && m.t !== 'ping') return;
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
      this._worldMemo = raw;   // SCALE2b: the welcome's copy is the one just stored
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
      this._roomFoes = this._foesFan(ws, a, 'foes', m.data, message, cell, this._roomFoes, now);   // SCALE5b: a method of its own
      return;
    }
    if (m.t === 'own') {
      // OWN1: a socket's OWN foes in a world room - fanned as a cell's foes frame is (every other hello'd socket, the
      // room's own budget, at most CELL_FRAME_RECORDS_MAX records), beside the host's stream; the relay reads none of it
      const now = Date.now();
      if (doored !== 'own') { if (!isWorldRoom(a.key)) { this._junk(ws); return; } a = this._meterFoes(ws, a, now); if (!a) return; }
      if (!Array.isArray(m.data.f) || m.data.f.length > CELL_FRAME_RECORDS_MAX) { this._junk(ws); return; }
      this._roomOwn = this._foesFan(ws, a, 'own', m.data, message, false, this._roomOwn, now);   // SCALE5b: the foes frame's method
      return;
    }
    if (m.t === 'hit') {
      this._metrics.c.hits++;   // SCALE5b: the frames by type
      // WORLD2: a blow on the host's foe - from anyone but the host, in a world room, on the pose bucket, to the
      // host's socket alone (the host applies it through its own damage door and the next foes frame says so)
      const now = Date.now();
      a = this._meter(ws, a, now); if (!a) return;
      // WORLD6b: in a CELL the blow goes to the foe's OWNER, the socket the frame's `to` names (never the striker's own);
      // in a world room to the host's alone, as WORLD2 has it
      const cell = isCellRoom(a.key);
      if (!cell && !isWorldRoom(a.key)) return;
      // OWN1: in a world room a blow on a socket's OWN foe (the frame marked `own`) goes to its owner as a cell's does
      const owned = cell || m.data.own === 1;
      const host = owned ? hitOwnerOf(m.data) : this._hostOf();
      if (!host || host === a.id) return;
      // AUDIT WORLD6b A1: the ROUTE is resolved before anything is spent - a `to` that names no socket in the room (a
      // peer gone, or a name a hostile client made up) delivers nothing, buys nothing, and is counted as junk (AUDIT
      // WORLD2 A4's instrument), so a stream of them is struck out; a world room's host is always a socket
      const target = this._idFirst(host, ws);
      if (!target) { if (owned) this._junk(ws); return; }
      this._hitFunnel(ws, a, m.data, message.length, target[0], now);   // FOES-FIRST HIT-DROPS: the destination's funnel, a method of its own - its drops counted
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
      const target = this._idFirst(to, ws);
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
      const target = this._idFirst(to, ws);
      if (!target) return;
      const [tws] = target;
      // AUDIT ALLY-CAST B2: the funnel onto the destination is PER SENDER (wire.js CAST_DEST_SENDERS_MAX) - one bucket
      // for everyone let five strangers starve a mate's heals, and this relay cannot tell a mate from a stranger.
      // The stalest sender's slot goes to a newcomer, so a mate always finds a fresh bucket unless they spam it.
      if (!this._senderFunnel(tws, a.id, now)) return;
      this._send(tws, JSON.stringify({ t: 'cast', id: a.id, data: m.data }));
      if (isEgRoom(a.key) && a.sub && target[1]?.sub) this._egCastSeen(a.sub, target[1].sub, now);   // AUDIT EG IV (lane3 #3): a breach's cast relayed, by account, for its heal word's earner
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
      const target = this._idFirst(to, ws);
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
      // INT8 (bible/06-Systems/Integrity-Arc.md lane 2): AND THE RELAY REFEREES IT (net/duel/duelRef.js). The handshake still
      // rides between the two, noted as it passes; a `start` is routed only where a bout is set on it (both fighters
      // whole at the referee's vitality, the `dref` word to each); every strike and spell is the referee's, routed to
      // nobody; a fighter's own end of its bout is its loss once the count has run - and a bout won names its winner in
      // the relay's signed receipt (net/duel/duelReceipt.js `d1`), which the account service counts.
      const now = Date.now();
      a = this._meterDuel(ws, a, now); if (!a) return;
      if (isChatRoom(a.key) || isSocialRoom(a.key)) return;
      const to = m.data.to;
      if (to === a.id) { this._junk(ws); return; }
      await this._duelBeat(now);   // INT8: a bout its fighter left or outran, ended before this frame is read
      const k = m.data.k;
      if (k === 'strike' || k === 'spell') { await this._duelBlow(a, m.data, now); return; }   // INT8: the referee's, routed to nobody
      if ((k === 'end' || k === 'cancel') && await this._duelForfeit(a, m.data, now)) return;   // INT8: a fighter's own end of its bout
      const target = this._idFirst(to, ws);
      if (!target) return;
      const [tws, tb] = target;
      // the funnel onto the destination, per sender - the cast's shape on slots of its own at the duel's rate
      if (!this._senderFunnel(tws, a.id, now, 'duin', DUEL_HZ_MAX)) return;
      if (k === 'ask' || k === 'yes') duelNote(this._duels(), k, a.sub, tb.sub, m.data.s, now);   // INT8: noted as it passes
      const bout = k === 'start' ? this._duelOpen(ws, a, tb, m.data, now) : null;
      if (k === 'start' && !bout) return;   // INT8: a start the referee sets no bout on goes nowhere (its challenger heard `no`)
      this._send(tws, JSON.stringify({ t: 'duel', id: a.id, ...(typeof a.sub === 'string' && a.sub ? { sub: a.sub } : {}), data: m.data }));
      if (bout) this._duelSay(bout, (x) => ({ t: 'dref', k: 'bout', s: bout.s, op: x === bout.a ? bout.b.id : bout.a.id, ms: ROYAL_RING.countdownMs, h: duelVitals(bout) }));
      return;
    }
    if (m.t === 'wed') {
      // LEGACY7 part three: ONE DIRECTED FRAME, the duel arm's own routing - a proposal, its answer, its end or the
      // union's word, from a hello'd socket in a PLACE room (a wedding is two people in one temple; a channel or the hub
      // is nowhere to stand) on the wed bucket, to the socket `to` names in this room and to it alone, the sender's id
      // AND its verified account (`sub`, off the identity token) AND realm character (`sc`, the token's `ci` - AUDIT
      // LEGACY III O1: the character the other player saw, which a half names as the account is named) stamped on it:
      // each side names the other's account and character to the account service by those stamps
      // (server-account/src/legacy.js realmWed), so who wed whom is never a client's own word. The relay reads none of
      // the rest (wire.js validWedData checked the shape - a `sc` a client wrote is never in its projection). A frame at
      // my own id is junk; a peer that is gone is not (a leave races a frame, and the proposal lapses on it).
      const now = Date.now();
      a = this._meterWed(ws, a, now); if (!a) return;
      if (isChatRoom(a.key) || isSocialRoom(a.key)) return;
      const to = m.data.to;
      if (to === a.id) { this._junk(ws); return; }
      const target = this._idFirst(to, ws);
      if (!target) return;
      const [tws] = target;
      // the funnel onto the destination, per sender - the duel's shape on slots of its own at the wedding's rate
      if (!this._senderFunnel(tws, a.id, now, 'wein', WED_HZ_MAX)) return;
      this._send(tws, JSON.stringify({ t: 'wed', id: a.id, ...(typeof a.sub === 'string' && a.sub ? { sub: a.sub } : {}), ...(typeof a.ci === 'string' && a.ci ? { sc: a.ci } : {}), data: m.data }));
      return;
    }
    if (m.t === 'wdun') {
      // PVPDUNGEONS: A WORD ON THE ZONE'S HALLS, to the hub alone, from a socket whose social hello named its account (the
      // verified player, net/social.js) - the lock, the reset and the crows are the hub's, never the client's
      if (!isSocialRoom(a.key) || !(a.acct || a.sub)) { this._junk(ws); return; }
      const now = Date.now();
      const g = tokenGate(this._wdunRate.get(ws) ?? null, now, WDUN_HZ_MAX, 6);
      this._wdunRate.set(ws, g.bucket);
      if (!g.pass) return;
      try { await this._wdunWord(ws, a.acct || a.sub, m, now, a); } catch (e) { console.warn('[wdun] word failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'wild') {
      // WILD1: THE OPEN ZONE'S FRAME, from a hello'd socket in a PLACE room (a cell or a world room - a channel, the hub,
      // an arena or a gate is nowhere a body falls), on its own bucket. DIRECTED (a fallen's gear): the duel arm's routing -
      // to the socket `to` names in this room alone, the sender's id AND its verified account stamped on it, the rest
      // unread (wire.js validWildData checked the shape). THE ROOM'S (a deposit, a take): this object keeps the remains
      // and judges each take (net/wild/wildLaw.js) - the first take of a record wins it.
      // INT9 (bible/06-Systems/Integrity-Arc.md lane 2): AND THE RELAY REFEREES THE ZONE (net/wild/wildRef.js) - a socket's word
      // that it stands in it (`zone`), every strike and spell between two that both said so (routed to nobody), the fall
      // the referee's word, the killer's pick awaited and the fall signed (net/wild/wildReceipt.js `f1`); a deposit kept only
      // on the account service's order (net/wild/wildLaw.js). Only the fallen's offer of its worn gear is routed.
      const now = Date.now();
      if (!this._spend(ws, now, wildGate, 'wildBucket', 'wildDrops', 'too many wild frames')) return;
      if (!streamsFoes(a.key)) { this._junk(ws); return; }
      await this._wildBeat(now);
      const k = m.data.k;
      if (k === 'strike' || k === 'spell') { if (m.data.to === a.id) { this._junk(ws); return; } await this._wildBlow(a, m.data, now); return; }
      if (k === 'helm' || k === 'shot' || k === 'board') { await this._seaWord(a, m.data, now); return; }   // SHIP-PVP: the open sea's guns, the referee's
      if (k === 'zone') { await this._wildZoneWord(a, m.data.z, now); return; }
      if (k === 'pick') { await this._wildPickWord(a, m.data, now); return; }
      if (wildDirected(m.data)) {
        const to = m.data.to;
        if (to === a.id) { this._junk(ws); return; }
        const target = this._idFirst(to, ws);
        if (!target) return;
        const [tws] = target;
        if (!this._senderFunnel(tws, a.id, now, 'wiin', WILD_HZ_MAX)) return;
        this._send(tws, JSON.stringify({ t: 'wild', id: a.id, ...(typeof a.sub === 'string' && a.sub ? { sub: a.sub } : {}), data: m.data }));
        return;
      }
      try { await this._wildWord(ws, a, m.data, now); } catch (e) { console.warn('[wild] word failed', e?.message ?? e); }
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
      const target = this._idFirst(to, ws);
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
      if (a.pk !== k) { a = { ...a, pk: k }; this._setAttach(ws, a); }   // WARDEN1: whose team this socket speaks for - the watch tells it of a throw
      const here = isCellRoom(a.key) ? a.key : null;
      const cell = m.data.a ? cellRoomOfWire(m.data.a[0], m.data.a[1]) : null;
      if (m.data.r && cell === here) {
        const thrown = await this._parkStore(k, a.sub, a.id, a.name ?? '', m.data.r, now);
        if (thrown) this._parkTellOwner(thrown, ws);   // WARDEN1: away when the watch threw it - told now, as they re-say where it stood
      } else if (here && cell !== here) await this._parkDrop(k);   // mine here is superseded: nothing parked, or it stands elsewhere
      await this._parkRegister(k, cell, now, m.data.r && cell === here ? a.ly | 0 : undefined);   // AUDIT SCALE II R3-8: the layer it is kept in, when it is kept here
      return;
    }
    if (m.t === 'caravan') {
      // WAGONS2-VISIT (net/wire.js validCaravanData): WHAT A CARAVAN'S OWNER PLACED IN IT, kept by its room - from a
      // hello'd socket in a caravan's room (net/privateInterior.js caravanKeyOf), on the acts' bucket, and from the
      // caravan's OWNER alone: the account the token verified and the character the frame names hash to the room's own
      // key (parkKeyOf - the key the cell's record of the parked caravan carries); anyone else's is junk. The last is
      // kept until PARK_TTL_MS after it was said (the alarm forgets it), handed to every joiner after its welcome, and
      // fanned to everyone else here; `d` null forgets it.
      const now = Date.now();
      a = this._meterActs(ws, a, now); if (!a) return;
      const ck = caravanKeyOf(a.key);
      if (!ck || typeof a.sub !== 'string' || !a.sub || (await parkKeyOf(a.sub, m.data.c)) !== ck) { this._junk(ws); return; }
      // WAGONS2-VISIT (AUDIT): one document a second from a socket at most (CARAVAN_DOC_MIN_MS - its owner's client says
      // one at most every 1.5 s); an unchanged one neither fanned nor stored again until its lease wants renewing
      // (PARK_REFRESH_MS); and the fan charged to the sender's own act bytes as an act's is - a hostile owner's
      // documents were stored and fanned at the acts' 5 Hz, uncharged
      // FINAL AUDIT: the second is the ROOM's, not a socket's (the owner's account may hello as many sockets into its own
      // room as SOCKETS_MAX lets it, each passing the owner's check - a socket's own second was theirs times N)
      if (now - (this._cvSaidAt ?? -Infinity) < CARAVAN_DOC_MIN_MS) return;
      this._cvSaidAt = now;
      if (m.data.d === null) { this._cvDoc = null; await this.state.storage.delete(CARAVAN_DECOR_KEY); }
      else {
        const doc = JSON.stringify(m.data.d), changed = doc !== this._cvDoc;
        if (!changed && now - (this._cvAt ?? 0) < PARK_REFRESH_MS) return;
        this._cvDoc = doc; this._cvAt = now;
        await this.state.storage.put(CARAVAN_DECOR_KEY, { at: now, d: m.data.d }); await this.state.storage.setAlarm(now + PARK_TTL_MS);
        if (!changed) return;
      }
      this._cvOwed = ws;
      await this._caravanFan(now);
      return;
    }
    if (m.t === 'gate') {
      // WB3: A WORD TO A GATE'S BOSS ROOM - the level claim on entering or a blow on the boss. On its own bucket (the
      // same strikes), in a gate room alone (anywhere else junk: a correct client sends none there), credited to the
      // VERIFIED account (`sub`, off the token - never a word of the frame's). The brain judges every blow
      // (net/gate/gateBrain.js applyHit): the relay reads the damage a client claims and believes as much of it as the
      // claimed level's bucket allows, from where the socket's own pose stands.
      const now = Date.now();
      // AUDIT INT15: a body's word (`vt`) on a bucket of its own - never the blows' (net/wire.js bodyWordRelayGate)
      if (m.k === 'vt' ? !this._spend(ws, now, bodyWordRelayGate, 'bodyBucket', 'bodyDrops', 'too many body words') : !this._spend(ws, now, gateGate, 'gateBucket', 'gateDrops', 'too many gate frames')) return;
      // AUDIT WBX S1: a receipt's spoils taken - the hub forgets its kept copy of that day's (its own word, the account's
      // own socket; anywhere else a `spent` is junk, as any gate frame outside a gate room is)
      if (m.k === 'spent') {
        if (!isSocialRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
        try { await this._gateSpent(a.sub, m.d); } catch (e) { console.warn('[hub] gate spent failed', e?.message ?? e); }
        return;
      }
      // DISCORD-GATES: where this account's game found the gate the clock is about - the hub's alone, as `spent` is
      if (m.k === 'site') {
        if (!isSocialRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
        try { await this._gateSite(a.sub, m, now); } catch (e) { console.warn('[hub] gate site failed', e?.message ?? e); }
        return;
      }
      if (!isGateRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
      // AUDIT SCALE II R3-1: A COPY HOLDS NO FIGHT. Its socket's gate word - whatever order its keys came in, metered
      // above on the copy's own bucket - is handed to the court as one gate frame, written again from what it parsed
      // (`t` first), and is never run here: a copy that ran one stood a fight of its own, which one fighter killed
      // alone and whose fall the hub told everyone online
      if (a.ly) { if (a.vid && a.id) this._hubUpOwe(a.vid, 'f', JSON.stringify({ t: 'gate', ...m })); return; }
      try { await this._gateFrame(ws, a, m, now); } catch (e) { console.warn('[gate] frame failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'siege') {
      // PVP-REF: A WORD TO A SIEGE'S ROOM - a fighter's `in`, a blow, a cast - on its own bucket, in a siege's room alone
      // (anywhere else junk), from a VERIFIED account (`sub`, off the token); the referee (net/siege/siegeRef.js) judges it
      const now = Date.now();
      if (!this._spend(ws, now, siegeGate, 'siegeBucket', 'siegeDrops', 'too many siege frames')) return;
      if (!isBattleRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
      try { await this._siegeFrame(ws, a, m, now); } catch (e) { console.warn('[siege] frame failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'arena') {
      // ARENA4: A WORD TO THE ARENA - the hall (the queue, an offer's answer, the bouts to watch) or a bout's room (on the
      // sand or in the stands, a blow claim, a yield, a cheer). On its own bucket (the gate's depth), credited to the
      // VERIFIED account (`sub`, off the token); in an arena room alone - anywhere else junk.
      const now = Date.now();
      if (!this._spend(ws, now, arenaGate, 'arenaBucket', 'arenaDrops', 'too many arena frames')) return;
      if (typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
      try {
        if (isArenaHall(a.key)) await this._hallWord(ws, a, m, now);
        else if (m.k === 'ps' && isArenaPrivateRoom(a.key)) await this._sessionWord(ws, a, m, now);   // ARENA6: a private session's word, in its room alone
        else if (isArenaFloorRoom(a.key)) await this._boutWord(ws, a, m, now);   // ARENA4b: a bout's room or the hour's exhibition's
        else this._junk(ws);
      } catch (e) { console.warn('[arena] word failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'raid') {
      // RAID3: A WORD ON A TOWN'S RAID - from a player standing in the raided town, to the town's CELL, whose object keeps
      // the raid's ledger (net/raid/raidLaw.js). On its own bucket (the same strikes), in a cell alone (anywhere else junk: a
      // correct client says none there), credited to the VERIFIED account (`sub`, off the token - never the frame's word)
      const now = Date.now();
      if (!this._spend(ws, now, raidGate, 'raidBucket', 'raidDrops', 'too many raid frames')) return;
      if (!isCellRoom(a.key)) { this._junk(ws); return; }
      try { await this._raidWord(ws, a, m, now); } catch (e) { console.warn('[raid] word failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'serpent') {
      // SERPENT1: A WORD ON THE SEA SERPENT'S FIGHT - from a player at its waters, to the CELL its site stands in (the
      // raid's law: its own cell's socket or a halo's), whose object holds the fight (net/serpent/serpentBrain.js). On its own
      // bucket, in a cell alone (anywhere else junk), credited to the VERIFIED account (`sub`, off the token)
      const now = Date.now();
      if (m.k === 'vt' ? !this._spend(ws, now, bodyWordRelayGate, 'bodyBucket', 'bodyDrops', 'too many body words') : !this._spend(ws, now, serpentGate, 'serpentBucket', 'serpentDrops', 'too many serpent frames')) return;   // AUDIT INT15: a hull's word on its own
      // SERPENT2: where this account's game found the serpent the clock is about - the hub's alone (the gate's `site` law)
      if (m.k === 'site') {
        if (!isSocialRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
        try { await this._serpentSite(a.sub, m, now); } catch (e) { console.warn('[hub] serpent site failed', e?.message ?? e); }
        return;
      }
      if (!isCellRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
      try { await this._serpentFrame(ws, a, m, now); } catch (e) { console.warn('[serpent] word failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'rite') {
      // WB12d: A WORD AT THE FAITHFUL'S RITE - from a player at a breach's circle, to the circle's CELL (the raid's law): on
      // its own bucket, in a cell alone (anywhere else junk), credited to the VERIFIED account
      const now = Date.now();
      if (!this._spend(ws, now, riteRelayGate, 'riteBucket', 'riteDrops', 'too many rite frames')) return;   // AUDIT WB12d (L4): a deeper bucket than the client's
      if (!isCellRoom(a.key)) { this._junk(ws); return; }
      try { await this._riteWord(ws, a, m, now); } catch (e) { console.warn('[rite] word failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'star') return this._starFrame(ws, a, m);   // STAR3: a word at a fallen star, to its cell - a method of its own
    if (m.t === 'eg') {
      // EG-PLAY: AN ELITE BREACH - the open, to the hub alone (the service's signed order); a member's admission, door, way
      // home and blows, to its breach's room alone (anywhere else junk), on the breach's own bucket
      const now = Date.now();
      // AUDIT EG IV (lane3 #5): the hub's own words (`open`, `void`, `claimed`) on a bucket of their own at the social rate
      // (net/wire.js egHubGate) - never the breach room's blow bucket
      if (m.k === 'vt' ? !this._spend(ws, now, bodyWordRelayGate, 'bodyBucket', 'bodyDrops', 'too many body words') : EG_HUB_KINDS.includes(m.k) ? !this._spend(ws, now, egHubGate, 'egHubBucket', 'egHubDrops', 'too many breach words') : !this._spend(ws, now, egGate, 'egBucket', 'egDrops', 'too many breach frames')) return;   // EG-H1: a body's word on a bucket of its own (AUDIT INT15's law)
      if (m.k === 'open') {
        if (!isSocialRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
        try { await this._egOpen(ws, a, m, now); } catch (e) { console.warn('[hub] eg open failed', e?.message ?? e); }
        return;
      }
      // EG-ZA (sections 22 and 23): a stake no call answered, asked to be voided; a held receipt the service has counted -
      // the hub's alone, as the open is (anywhere else junk)
      if (m.k === 'void' || m.k === 'claimed') {
        if (!isSocialRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
        try { if (m.k === 'void') await this._egVoid(ws, a, m, now); else await this._egClaimed(a.sub, m, now); } catch (e) { console.warn('[hub] eg word failed', e?.message ?? e); }
        return;
      }
      if (!isEgRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
      try { await this._egFrame(ws, a, m, now); } catch (e) { console.warn('[eg] frame failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'sd') {
      // SD3: A HOLLOW FOUND - from a player at a risen Super dungeon's door, to the CELL it stands in (the rite's law): on its
      // own bucket, in a cell alone (anywhere else junk), said under the VERIFIED name
      const now = Date.now();
      // SD6b: A TURN OF AN ENDING-STONE - in a Hollow's realm alone (anywhere else junk), on the hall's own bucket, judged
      // by the Orrery's law from where the socket's own pose stands (_sdTurn)
      if (m.k === 'pz') {
        if (!this._spend(ws, now, sdPzRelayGate, 'sdPzBucket', 'sdPzDrops', 'too many turns')) return;
        if (!isSdRoom(a.key)) { this._junk(ws); return; }
        try { await this._sdTurn(ws, a, m, now); } catch (e) { console.warn('[sd] turn failed', e?.message ?? e); }
        return;
      }
      // SD8b: THE LAST MOMENT'S FIGHT - in a Hollow's realm alone (anywhere else junk), on the fight's own bucket: an `in`
      // joins it, a blow is believed by the Remnant's law from where the socket's own pose stands (_sdFightFrame)
      if (m.k === 'in' || m.k === 'hit' || m.k === 'ehit' || m.k === 'xhit' || m.k === 'vt') {   // INT12: `vt` - its body, in its own word
        if (m.k === 'vt' ? !this._spend(ws, now, bodyWordRelayGate, 'bodyBucket', 'bodyDrops', 'too many body words') : !this._spend(ws, now, sdFightRelayGate, 'sdFightBucket', 'sdFightDrops', 'too many fight frames')) return;   // AUDIT INT15: a body's word on its own
        if (!isSdRoom(a.key)) { this._junk(ws); return; }
        try { await this._sdFightFrame(ws, a, m, now); } catch (e) { console.warn('[sd] fight failed', e?.message ?? e); }
        return;
      }
      if (!this._spend(ws, now, sdRelayGate, 'sdBucket', 'sdDrops', 'too many sd frames')) return;
      // SD9a: A SLOT'S SPOILS TAKEN - the hub's alone (anywhere else junk, the gate's `spent` law): its kept copy spent
      if (m.k === 'spent') {
        if (!isSocialRoom(a.key) || typeof a.sub !== 'string' || !a.sub) { this._junk(ws); return; }
        try { await this._sdSpent(a.sub, m.s, now); } catch (e) { console.warn('[hub] sd spent failed', e?.message ?? e); }
        return;
      }
      if (!isCellRoom(a.key)) { this._junk(ws); return; }
      try { await this._sdFoundWord(ws, a, m, now); } catch (e) { console.warn('[sd] word failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'raidtowns') {
      // RAID-ROLL: A PIECE OF THE TOWNS TABLE, to the hub that asked for it by its pinned hash (`raid` `tw` at the hello) -
      // on its own bucket (a whole table in one burst), in the hub alone
      const now = Date.now();
      if (!this._spend(ws, now, raidTownsGate, 'raidTownsBucket', 'raidTownsDrops', 'too many raid town frames')) return;
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      try { await this._raidTownsPiece(ws, m); } catch (e) { console.warn('[hub] raid towns failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'ow') {
      // OW6L: A WORD ON THE CELL'S OVERWORLD LEDGER - the bands and raiders its speaker spent, the spawned dungeons it
      // first entered or cleared (net/overworldLaw.js; SPAWN-REBIRTH: each row kept until its spawn stands again) - to the
      // cell it stands in, whose object keeps the ledger. On its own
      // bucket (the same strikes), in a cell alone (anywhere else junk: a correct client says none there)
      const now = Date.now();
      if (!this._spend(ws, now, owGate, 'owBucket', 'owDrops', 'too many overworld frames')) return;
      if (!isCellRoom(a.key)) { this._junk(ws); return; }
      try { await this._owWord(ws, a, m, now); } catch (e) { console.warn('[ow] word failed', e?.message ?? e); }
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
      // AUDIT-SEATS R3: AND IN A BATTLE ROOM THE ACCOUNT'S OWN GATE, as its hello's (`_battleHelloGate`) - the room's stored
      // bucket there is the stands', and a crowd of spectators draining it would refuse a fighter's change of gear 'busy',
      // its socket closed mid-battle
      const battleGate = isBattleRoom(a.key) ? await this._battleHelloGate(a.sub, a.sd, now) : null;
      const gate = battleGate ?? tokenGate(this._hellos, now, this._helloHz(a.key));   // SCALE2b: the room's hello bucket, in memory - AUDIT PLAN-1000 B2: at the room's own rate
      if (!battleGate) this._hellos = gate.bucket;
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
    if (m.t === 'stp') {
      const now = Date.now();
      if (!this._spend(ws, now, (b, t) => tokenGate(b, t, 4, 8), 'tpbucket', 'tpdrops', 'too many teleport requests')) return;
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      const budget = tokenGate(this._roomStaffTp, now, SOCIAL_ROOM_HZ_MAX);
      this._roomStaffTp = budget.bucket;
      if (!budget.pass) {
        if (m.k === 'ask') this._send(ws, JSON.stringify({ t: 'stp', k: 'result', nonce: m.nonce, error: 'busy' }));
        return;
      }
      routeStaffTeleport(this, ws, a, m, now);
      return;
    }
    if (m.t === 'find') {
      // SCALE5c (Mac's decision 2): A SEARCH OF EVERYONE ONLINE BY NAME - the hub's (the bus holds every shard's sockets),
      // on a bucket of its own and the whole hub's (a search walks everyone; past HUB_FIND_ROOM_HZ_MAX it is answered
      // `busy`): the names whose fold holds the search's, HUB_FIND_MAX at most, badged as a roster is. `g`: my guild
      // online instead, every shard's - the Guild tab's list - off the guild's own sockets
      const now = Date.now();
      if (!this._spend(ws, now, (b, t) => tokenGate(b, t, 1, 3), 'findbucket', 'finddrops', 'too many searches')) return;
      if (m.all === 1 && isRegionBus(a.key)) { this._send(ws, this._everyoneSaid(now)); return; }   // SCALE5c part two: a region's too - the Region tab's list
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      if (m.g === 1) { this._send(ws, JSON.stringify({ t: 'found', g: 1, l: this._guildWho(ws, a) })); return; }
      if (m.all === 1) { this._send(ws, this._everyoneSaid(now)); return; }
      const room = tokenGate(this._findRoom, now, HUB_FIND_ROOM_HZ_MAX);
      this._findRoom = room.bucket;
      if (!room.pass) { this._send(ws, JSON.stringify({ t: 'found', q: m.q, l: [], busy: 1 })); return; }
      this._send(ws, JSON.stringify({ t: 'found', q: m.q, l: this._findNames(ws, foldFind(m.q)) }));
      return;
    }
    if (m.t === 'cfg') {
      // SCALE5b: A RELAY SETTING (net/relayCfg.js) - in the hub alone, from a developer's verified glyphs alone, on a bucket
      // of its own: kept in the hub's storage, in force for the hub at once and for a boss's room within RELAY_CFG_TTL_MS.
      // Anyone else is answered in words and struck for nothing - a staff command a Dungeon Master typed is no attack
      const now = Date.now();
      if (!this._spend(ws, now, (b, t) => tokenGate(b, t, 1, 4), 'cfgbucket', 'cfgdrops', 'too many settings')) return;
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      if (!mayRelayCfg(a.glyphs)) { this._send(ws, JSON.stringify({ t: 'cfg', k: m.k, error: 'only a developer may change the relay\'s settings' })); return; }
      const no = m.v === null ? null : relayCfgRefusal(m.k, m.v);   // AUDIT SCALE II R1-4: by its consumers' law, or refused in words - nothing kept
      if (no) { this._send(ws, JSON.stringify({ t: 'cfg', k: m.k, error: no })); return; }
      const cfg = { ...(await this._relayCfgOf()) };
      if (m.v === null) delete cfg[m.k]; else cfg[m.k] = m.v;
      await this.state.storage.put('relaycfg', cfg);
      this._relayCfg = cfg; this._herald = undefined; this._bodyCfg = undefined;
      console.info('[cfg] set', m.k, m.v === null ? '(the var)' : m.v);
      this._send(ws, JSON.stringify({ t: 'cfg', k: m.k, v: relayCfgValue(cfg, this.env, m.k) ?? '' }));
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
    if (m.t === 'trav') {
      // TV3 (bible/06-Systems/Travel-View.md): my traveller mark - in my REGION's channel alone (the world channel is
      // everyone's), on its own cooldown, kept on the attachment (`tm`, stamped: the welcome hands a joiner the fresh
      // ones) or dropped from it (null: indoors, or hidden), and fanned to the room under the room's own budget. Over
      // the budget it is KEPT and not fanned - the next refresh and every welcome carry it. The name is the token's.
      const now = Date.now();
      if (!isRegionRoom(a.key)) { this._junk(ws); return; }
      if (this._travOwed.size) this._payTravOwed(now);   // AUDIT DEEP2 C2: the clears owed go first, as the budget allows
      // AUDIT DEEP T3-2/X-8: A CLEAR TAKES OUT A MARK THAT IS THERE, and only that. One with no mark behind it is said to
      // nobody (a socket that never marked flooded every screen with them); one with a mark goes past the socket's
      // cooldown - at most one a mark, so the marks' own cooldown bounds it, and it goes the moment the player steps
      // in, not TRAV_HUB_MIN_MS after their last mark. AUDIT DEEP2 C1: the one with no mark is METERED as a mark is
      // (AUDIT CHAT A3: gated and counted before it is declined) - unmetered, a socket sent them padded to the frame's
      // limit as fast as it could, each parsed, none struck, the region's one thread spent on them.
      if (m.p || !a.tm) { a = this._meterTrav(ws, a, now); if (!a) return; }
      if (!m.p && !a.tm) return;
      const rest = { ...a };
      delete rest.tm;
      if (!this._setAttach(ws, m.p ? { ...rest, tm: { ...m.p, at: now, ...(m.bd ? { bd: m.bd } : {}), ...(m.sr ? { sr: m.sr } : {}) } } : rest)) return;   // OW-CHASE-RANGE: its chase words kept beside it
      // AUDIT TV C2: A CLEAR IS SAID (AUDIT DEEP2 C2: at once, or owed below). A mark over the budget is kept and the next refresh carries it; a clear has no
      // next - the client holds nothing to refresh - so a dropped one left the player standing on every screen in the
      // room for TRAV_STALE_MS. AUDIT DEEP T3-2: on its OWN budget, so a room's marks never spend it (nor it theirs).
      const clear = !m.p;
      if (!clear) this._travOwed.delete(a.id);   // a new mark says where they are - the owed clear is moot
      const room = travRoomGate(clear ? this._travClearFan : this._travFan, now);
      if (clear) this._travClearFan = room.bucket; else this._travFan = room.bucket;
      const out = JSON.stringify(badged({ t: 'trav', id: a.id, name: a.name, sub: a.sub, p: m.p ?? null, ...(m.bd ? { bd: m.bd } : {}), ...(m.sr ? { sr: m.sr } : {}) }, a));
      // AUDIT DEEP2 C2: A CLEAR OVER THE BUDGET IS OWED, not lost - the attachment's mark is gone and the client holds
      // nothing to send again, so a dropped one left the player drawn for TRAV_STALE_MS; it is said on the budget's next
      // pass (the room's next traveller frame - a room over the budget has them every moment)
      if (!room.pass) { if (clear) this._oweTravClear(a.id, out); return; }
      this._fanAllBut(ws, a.id, out);   // SCALE5c part two: on a region's bus, one entry a shard
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
    if (m.t === 'amap') {
      // PARTY-MAP (2026-09-30, Discord: "share map data between party members"): SHARED CARTOGRAPHY - the automap rows
      // a member revealed, fanned to their party alone, as a quest share is. The relay reads nothing past parseClient's
      // projection (a dungeon key and bounded row keys of the row's shape); whether a mate stands in that dungeon is
      // the receiving client's question. Small by construction (AMAP_KEYS_MAX keys), so no pre-parse door.
      const now = Date.now();
      a = this._meterAmap(ws, a, now); if (!a) return;
      if (!isSocialRoom(a.key) || !a.acct) { this._junk(ws); return; }   // the hub alone, an account alone - the party arm's own law
      if (!a.party) return;   // nobody to reach: spends nothing of the room's budget (AUDIT DROPS C3's rule)
      if (ws !== this._speaker(a.acct)) return;   // AUDIT SOC B9: another tab of mine speaks for the seat
      const budget = tokenGate(this._roomAmap, now, AMAP_ROOM_HZ_MAX);
      this._roomAmap = budget.bucket;
      if (!budget.pass) return;   // a background share, never a click: dropped quietly, the sender's next batch carries on
      let party = null;
      try { party = await this._livingParty(a.party, now); } catch (e) { console.warn('[hub] map share failed', e?.message ?? e); return; }
      if (!party || !party.members.includes(a.acct)) { this._markParty(a.acct, null); return; }
      const mine = await this._acct(a.acct);
      const out = JSON.stringify({ t: 'amap', acct: a.acct, name: mine?.name ?? null, k: m.k, r: m.r });
      for (const member of party.members) { if (member === a.acct) continue; for (const other of this._socketsOf(member)) this._send(other, out); }   // the others alone, never my own tabs
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
      const target = this._idFirst(id, ws);
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
      if (isBattleRoom(a.key)) await this._siegeOf();   // AUDIT-SEATS T2: who is a body there, read before the answer
      this._send(ws, JSON.stringify(badged({ t: 'join', id: b.id, name: b.name, look, pose: inRange(a.key ?? '', a.pose, b.pose) ? (this._drawn(b, a.key).pose ?? null) : null }, b)));
      return;
    }
    if (m.t === 'pose' || m.t === 'ping') return this._poseFrame(ws, a, m);   // PERF-RELAY1: the room's hottest path, a method of its own
    if (m.t === 'chat') {
      this._metrics.c.chats++;   // SCALE5b: the frames by type
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
    if (m.t === 'holdem') {
      // ═══ CARDS5 — THE RELAY DEALS ══════════════════════════════════
      //
      // Tavern-Cards section 5: a deck said by a client is a deck the client chose. A building's room keeps its card
      // tables (net/holdemTable.js): the relay shuffles from its own CSPRNG, keeps the deck in the table, tells each
      // seat its own hole cards alone and the room the public hand, runs whose turn it is and the seat's clock (the
      // alarm), and folds a leaver out of turn. A tavern is an interior: only an interior's room keeps a table.
      const now = Date.now();
      if (!String(a.key ?? '').startsWith('interior:')) return;
      if (!this._spend(ws, now, holdemGate, 'holdemBucket', 'holdemDrops', 'too many card words', CHAT_STRIKES_MAX)) return;
      await this._holdemWord(ws, a, m, now);
      return;
    }
    if (m.t === 'iliac') {
      // ═══ CARDS10 — THE RELAY DEALS ILIAC HAND ═══════════════════════
      //
      // Tavern-Cards section 6.4: online, "the relay running the game exactly as it runs Hold'em - hidden hands, its own
      // shuffle, its own clock". A building's room keeps its Iliac tables beside its Hold'em ones (net/iliac/iliacTable.js),
      // one game a table index at a time; a ranked seat brings the service's deck order. An interior's room only.
      const now = Date.now();
      if (!String(a.key ?? '').startsWith('interior:')) return;
      if (!this._spend(ws, now, holdemGate, 'iliacBucket', 'iliacDrops', 'too many card words', CHAT_STRIKES_MAX)) return;
      await this._iliacWord(ws, a, m, now);
      return;
    }
    if (m.t === 'gambit') {
      // ═══ KG5 — THE RELAY RUNS THE KING'S GAMBIT ═══════════════════════
      //
      // Kings-Gambit.md section 5.8: "a King's Gambit table in the relay beside Hold'em's and Iliac Hand's" - the relay
      // builds the board and rolls every die from its own CSPRNG, a command is the law's, the room told every event, a
      // turn clock (net/gambit/gambitTable.js). An interior's room only; KG6: the red table for gold (CARDS6's escrow).
      const now = Date.now();
      if (!String(a.key ?? '').startsWith('interior:')) return;
      if (!this._spend(ws, now, holdemGate, 'gambitBucket', 'gambitDrops', 'too many card words', CHAT_STRIKES_MAX)) return;
      await this._gambitWord(ws, a, m, now);
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
        if (b.sub !== sub || b.gio > i) continue;   // AUDIT SAFE RELAY-6: a socket whose token was minted after the order already carries the truth (`_takeOrder`'s law)
        this._setAttach(other, { ...b, mu, lt: Math.max(b.lt ?? 0, i) });   // LEASE1: a lease older than this order says nothing of the mute
        this._send(other, told);   // the player hears it at once - muted until, or 0 for lifted
      }
    }
    if (m.t === 'ban') return this._banFrame(ws, m);   // SAFE4: a ban order carried in, a method of its own
    if (m.t === 'grant') return this._grantFrame(ws, a, m);   // GRANT2: a spawn grant asked, a method of its own
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
      if (r.claims.gi) await this._loadGuildOuts(Math.floor(now / 1000));   // AUDIT MERGE-PLUS A3
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
      await this._loadGuildOuts(Math.floor(now / 1000));   // AUDIT MERGE-PLUS A3: the storage copy first, so this write keeps it
      this._holdGuildOut(gi, gm, i);
      await this._saveGuildOuts(Math.floor(now / 1000));
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
    if (m.t === 'home') {
      // ═══ QUEST-HOME — A HOME THAT MOVED, CARRIED IN, SAID TO EVERYONE ONLINE ═══
      //
      // Mac (2026-10-15, of a quest's residence that was another player's home: "Close both"). A page reads every town's
      // homes at its boot, and a house bought after that read was unknown to it - a quest could pick its residence in a
      // stranger's home. The account service signs a HOME ORDER for every act that moves a home (a claim, a deed held, a
      // hall, an arena move, a sale, a character deleted); the acting player's client carries it here, and the room checks
      // the signature with the key it already holds and nothing else - MOD1's law: whoever carried it, the word is the
      // service's. IN THE HUB ALONE (EVENT1's reason): the one room every online player holds a socket to, so its fan IS
      // everyone online, a shard's sockets by the bus. HELD for HOME_WORDS_KEEP_MS (HOME_WORDS_KEY, apart from every
      // prefix a drain or the sweep deletes), so a page whose boot read went out before the act and whose hub link opened
      // after it hears it on the welcome (_hubHelloWords). The same order twice is one word.
      const now = Date.now();
      if (!this._spend(ws, now, homeGate, 'hmbucket', 'hmdrops', 'too many home orders')) return;   // metered before the signature is asked (AUDIT 68)
      if (!isSocialRoom(a.key)) { this._junk(ws); return; }
      await this._loadKey();
      if (!this._verifyKey) return;
      const r = await verifyOrder(m.order, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'home' });
      if (!r.ok) return;   // silently, as the mute arm refuses
      const sig = m.order.slice(m.order.lastIndexOf('.') + 1);
      const held = await this._homeWordsHeld(now);
      if (held.some((w) => w.sig === sig)) return;
      const word = { m: r.claims.bm, u: r.claims.bu ?? [], d: r.claims.bd ?? [], i: r.claims.i };
      this._homeWords = [...held, { ...word, at: now, sig }].slice(-HOME_WORDS_MAX);
      await this.state.storage.put(HOME_WORDS_KEY, this._homeWords);
      const said = JSON.stringify({ t: 'home', l: [word] });
      for (const [other, b] of [...this._all()]) if (b.id) this._send(other, said);   // everyone in the hub, the carrier included - that is the receipt
    }
  }

  async webSocketClose(ws, code, reason) {
    try { await this._leave(ws); } finally { await this._reap(); this._metricsTick(); }
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  async webSocketError(ws) { try { await this._leave(ws); } finally { await this._reap(); } }

  async _leave(ws) {
    if (this._gone.has(ws)) return;   // AUDIT WORLD34 D1: said once - the reap and a runtime's own close are the same leave
    this._gone.add(ws);
    this._dead.delete(ws);
    const a = this._attach(ws);
    this._foesLeft(ws, a, Date.now());   // FOES-HOLD: what its foes lanes still hold, said before its leave
    this._trails?.delete(ws);   // AUDIT INT11: its trail with it
    // AUDIT CHAT A7: a room that drained sweeps its own storage on the way out - the empty-hello sweep never
    // runs in a channel, which is never empty on the way in; what an unclean close left behind goes here
    const listed = this.state.getWebSockets();
    // SCALE2b: out of the index - unless the runtime still lists it (a close this object made, not yet complete: AUDIT
    // ONESEAT R4), when it stays, said gone, as the old index re-read it, until the walk finds it unlisted
    if (!listed.includes(ws)) this._forget(ws);   // SCALE5a: still listed, its place in the kept account index stands
    const last = (listed.length === 0 || (listed.length === 1 && listed[0] === ws)) && !this._vsocks.size;   // SCALE5a: nobody but this one - said without a filtered copy of every socket; SCALE5c: and no shard's either
    if (last) { try { await this._sweep(); this._swept = this.state.getWebSockets().length === 0; if (isWorldRoom(a.key)) await this.state.storage.setAlarm(Date.now() + worldTtlMsFor(a.key)); } catch { /* the next drain, or the next empty hello */ } this._metricsTick(true); }   // SCALE2b: a drained room says its last window
    if (!a.id) return;   // never said hello, or replaced - the id lives on in another socket
    // INT9 (AUDIT): a fighter whose last socket here went is out of the zone (a closed tab kept its `zone` for good, and a
    // room of them refused every newcomer)
    if (a.sub && this._wildRef && ![...this._all()].some(([w, b]) => w !== ws && b.id && b.sub === a.sub)) { wildGone(this._wildRef, a.sub, Date.now()); seaGone(this._wildRef, a.sub, Date.now()); }   // SHIP-PVP: and her ship off the guns (AUDIT SEA VENTURES F1/A1: her bar kept)
    this._looks.delete(a.id);
    if (!last) this._secrets.set(a.id, null);   // SCALE2b: the kept copy goes with the stored one (a drain's sweep clears both)
    this._raidTownsUp.delete(ws);   // SCALE2b: an upload its socket never finished goes with it
    if (!last) { try { await this.state.storage.delete([lookKey(a.id), secretKey(a.id)]); } catch { /* the room forgets it on the next empty hello */ } }
    // ROSTER-G: a channel says its leaves now, as it says its joins - the roster beside the chat is everyone online
    const out = JSON.stringify({ t: 'leave', id: a.id, ...(isChatRoom(a.key) && !(isChannelShard(a.key) && this._hubTotal == null) ? { n: isChannelShard(a.key) ? this._hubN(this._namedCount()) : this._vsocks.size ? this._busCount() : this._namedCount() } : {}) });   // AUDIT SCALE II R2-4 (p4d): and a woken shard's leave none, as its join   // SCALE5c: a shard's, the hub's count   // AUDIT SCALE5a C1-C3: a channel's leave says the room's count, as its join does
    if (isChatRoom(a.key)) this._fanRoster(ws, out); else this._fanBut(ws, out);   // SCALE5a: in place, as the join's; SCALE5b: a channel's, the second wire's batched
    if ((isChannelShard(a.key) || (a.ly && isGateRoom(a.key))) && a.vid) { this._vidIdx.delete(a.vid); this._hubUpOwe(a.vid, 'x', 0); }   // SCALE5d part two: a court copy's too   // SCALE5c: and the bus told it went
    else if (isChannelBus(a.key)) this._busCountMoved();   // SCALE5c: the bus's - its shards told the hub's count
    this._travOwed.delete(a.id);   // AUDIT DEEP2 C2: the leave takes the mark out - an owed clear of it is said
    if (!isChatRoom(a.key) && this._leaveMovesSeat(a, ws)) this._sayHost({ skip: ws, except: ws });   // WORLD1: the host left - the next-longest in the room is the host now, said to everyone (ROSTER-G: a channel has no host)
    if (isBattleRoom(a.key) && a.sub) { try { await this._siegeGone(ws, a.sub, Date.now()); } catch (e) { console.warn('[siege] leave failed', e?.message ?? e); } }   // AUDIT-SEATS T3: a fighter's place kept from now
    if (isSocialRoom(a.key) && a.acct) { try { await this._leaveAccount(ws, a, Date.now()); } catch (e) { console.warn('[hub] leave failed', e?.message ?? e); } }   // SOC1: last seen stamped, the friends and the party told
    if (a.id && String(a.key ?? '').startsWith('interior:')) { try { await this._holdemLeave(a, Date.now()); } catch (e) { console.warn('[holdem] leave failed', e?.message ?? e); } }   // CARDS5: folded out of turn, stood up at the hand's end
    if (a.id && String(a.key ?? '').startsWith('interior:')) { try { await this._iliacLeave(a, Date.now()); } catch (e) { console.warn('[iliac] leave failed', e?.message ?? e); } }   // CARDS10: a game under way conceded
    if (a.id && String(a.key ?? '').startsWith('interior:')) { try { await this._gambitLeave(a, Date.now()); } catch (e) { console.warn('[gambit] leave failed', e?.message ?? e); } }   // KG5: a socket gone forfeits (the mod's FORFEIT)
    if (isArenaRoom(a.key) && a.sub) { try { await this._arenaLeave(ws, a, Date.now()); } catch (e) { console.warn('[arena] leave failed', e?.message ?? e); } }   // ARENA4: out of the queue, off the sand, out of the stands
  }


  // ───────────────────────────── ARENA4: THE ARENA ─────────────────────────────
  // ═══ CARDS5 — THE ROOM'S CARD TABLES ═══════════════════════════════════════════════════════════════════════════
  /** The room's tables (index -> table), read from storage once a wake - a hibernated room keeps its hands. */
  async _holdemOf() {
    if (!this._holdem) {
      const kept = await this.state.storage.get('holdem');
      this._holdem = new Map(kept && typeof kept === 'object' ? Object.entries(kept).map(([k, v]) => [Number(k), v]) : []);
    }
    return this._holdem;
  }
  /** The tables checkpointed (the empty ones forgotten), and the alarm armed for the soonest one due. */
  async _holdemSave() {
    const tables = this._holdem;
    if (!tables) return;
    await this._holdemCashouts(tables);   // CARDS6: what the staked seats left with, signed before the tables are kept
    for (const [k, t] of tables) if (holdemEmpty(t) && !t.cashouts?.length) { tables.delete(k); this._holdemSaid?.delete(k); }   // CARDS-TIDY: a table gone, the room told of it afresh; AUDIT CARDS-4 B4: never with a cash-out unsigned
    if (tables.size) await this.state.storage.put('holdem', Object.fromEntries(tables));
    else await this.state.storage.delete('holdem');
    let at = Infinity;
    for (const t of tables.values()) { const n = holdemNextAt(t); if (n != null) at = Math.min(at, n); }
    if (Number.isFinite(at)) await this._boutArm(Date.now(), at);
  }
  /** A table's messages sent: the room's to every socket in it, a seat's to that player's sockets alone. */
  _holdemSend(index, msgs, now) {
    this._holdemSaid ??= new Map();   // CARDS-TIDY: the last state the room was told of each table - this wake's (a wake tells it whole)
    for (const { to, frame: f } of msgs) {
      let frame = f;
      if (to == null && f.state) {
        // AUDIT CARDS-4 D1: and NUMBERED, a table's room frames one after another - a socket that missed one (a new socket in
        // the same room, a frame dropped) sees the gap and asks for the table whole rather than laying a change on a stale one
        const said = this._holdemSaid.get(index), n = (said?.n ?? -1) + 1;
        const delta = holdemDelta(said?.state, f.state);
        this._holdemSaid.set(index, { state: f.state, n });
        frame = delta ? { events: f.events, delta, n } : { ...f, n };   // the changed fields alone (a look's whole state is its asker's)
      } else if (f.state) frame = { ...f, n: this._holdemSaid.get(index)?.n };   // a look: whole, at the number the room was last told
      const out = JSON.stringify({ t: 'holdem', table: index, now, ...frame });
      for (const [w, b] of this._all()) if (b.id && (to == null || b.id === to)) this._send(w, out);
    }
  }
  /** One player's word to a table: sit (a table opens at the first sitter's chairs and stakes), stand, act, look. */
  async _holdemWord(ws, a, m, now) {
    const tables = await this._holdemOf();
    let t = tables.get(m.table);
    const refuse = (error) => this._send(ws, JSON.stringify({ t: 'holdem', table: m.table, now, error }));
    let msgs;
    if (m.op === 'ack') { await this._holdemAck(a, m.j); return; }   // CARDS6: a cash-out the client holds, kept no longer
    if (m.op === 'void') { await this._holdemVoid(ws, a, m, now, refuse); return; }   // CARDS6
    if (m.op === 'topup') { await this._holdemTopUp(a, m, now, refuse); return; }   // CARDS6 follow-up: a seat's top-up
    if (m.op === 'look') { msgs = t ? holdemLook(t, a.id, now) : []; await this._holdemOwed(ws, a, m.table); }   // CARDS6: and the cash-outs owed this account here
    else if (m.op === 'sit') {
      // CARDS6: A STAKED SIT - the service's order checked and its stake spent first; a sit refused after that hands the
      // whole stake back in a receipt ('refused'), so no gold the service holds is ever stranded by a chair
      let stake = null;
      await this._holdemOwed(ws, a, m.table);   // a returning player hears what he is owed first
      // AUDIT SCALE II R3-3 (c): NO TABLE IN A LAYER. A room's stakes are spent and remembered by its object (`cstake:`),
      // and a layer is another object for the same room (SCALE5d) - an order the place had seated was spent again in a
      // layer that never heard of it, and a cash-out owed in a layer is told only at a look there, which a reconnect
      // walked from the place (R3-3 (a)) may never make again. A layer seats nobody, staked or not, and spends no order:
      // refused before any spend, in the client's own words for a table that cannot take him ('stakes closed', 'bad
      // table' - cardTableHud.js HOLDEM_REFUSALS, both a lost chair in cardRemoteTable.js SIT_REFUSALS). The stake the
      // service holds for that sit is the device's to void (cardStakes.js voidable), which the place spends (_holdemVoid).
      // What a layer already owes - a look's, a sit's cash-outs above - it keeps telling, as it always did
      if (a.ly) { refuse(m.stake !== undefined ? 'stakes closed' : 'bad table'); return; }
      const back = !!t?.seats.some((x) => x?.id === a.id && x.leaving && !x.cashed);   // his own chair, mid-hand: the stake it holds is his - AUDIT CARDS-5 E2: never a chair already cashed out (a new stake there was seated by no one and spent by no one)
      if (m.stake !== undefined && !back) {
        const v = await this._holdemStake(a, m, now);
        if (v.no) { if (v.back) await this._holdemReceipt(m.table, a.id, { ...v.back, w: 'refused' }); refuse(v.no); return; }
        stake = v.stake;
      }
      // AUDIT CARDS-4 B2: the table as it stands NOW - the order's check opened the room to other words (a crypto await is no
      // storage operation), and a table another sitter opened, or the last stand closed, meanwhile is not the one read above
      t = tables.get(m.table);
      const no = async (why) => { if (stake) await this._holdemReceipt(m.table, a.id, { j: stake.j, s: stake.sub, r: stake.amount, w: 'refused' }); refuse(why); };
      // TAVERN-TABLES (section 30): the table's index says what it plays for, never its first sitter - a staked sit at a
      // chips table is handed its stake back, a sit with none at the gold table refused (his own chair, mid-hand, is his)
      if (!back && !!stake !== holdemGoldTable(m.table)) { await no(stake ? 'friendly table' : 'gold table'); return; }
      if (t && (t.chairs !== m.chairs || t.bb !== m.bb)) { await no('table differs'); return; }   // AUDIT CARDS-3 A5: the first sitter never decides another cloth's chairs
      if (a.sub && this._holdemAccountSeated(tables, a)) { await no('account seated'); return; }   // AUDIT CARDS-3 A2: one seat an account - two tabs never see two hands
      const ili = (await this._iliacOf()).get(m.table);
      if (ili && !iliacEmpty(ili)) { await no('other game'); return; }   // CARDS10: a cloth plays one game at a time
      const kg = (await this._gambitOf()).get(m.table);
      if (kg && !gambitEmpty(kg)) { await no('other game'); return; }   // KG5: and The King's Gambit's
      const fresh = !t;
      if (fresh) { t = newTable({ chairs: m.chairs, bb: m.bb, gold: !!stake }); if (!t) { await no('bad table'); return; } }   // CARDS6: the first sitter's stake makes it a gold table
      // AUDIT CARDS-6 C2: the sit's own refusals asked BEFORE the room's budget is spent (nothing awaits between this and
      // the sit) - a socket's sits refused 'taken', four a second, kept every card table in the room 'busy'
      const refused = holdemSitRefusal(t, { id: a.id, chair: m.chair, stake });
      if (refused) { await no(refused); return; }
      const gate = holdemSitRoomGate(this._holdemSitBucket ?? null, now);
      this._holdemSitBucket = gate.bucket;
      if (!gate.pass) { await no('busy'); return; }   // AUDIT CARDS-3 A4
      const r = holdemSit(t, { id: a.id, name: a.name ?? '', chair: m.chair, now, stake });
      if (typeof r === 'string') { await no(r); return; }   // AUDIT CARDS-3 A1: refused before anything moved - no table stood him up unsaid
      if (fresh) tables.set(m.table, t);
      for (const [k, other] of tables) if (k !== m.table) { const up = holdemStand(other, { id: a.id, now }); if (up.length) this._holdemSend(k, up, now); }   // one seat in a room at a time, once this one took
      if (await this._iliacUp(a.id, now)) await this._iliacSave();   // CARDS10: and off an Iliac table
      if (await this._gambitUp(a.id, now)) await this._gambitSave();   // KG5: and off a King's Gambit table
      msgs = r;
    } else if (!t) { refuse('no table'); return; }
    else if (m.op === 'stand') msgs = holdemStand(t, { id: a.id, now });
    else {
      const r = holdemAct(t, { id: a.id, action: m.action, now });
      if (typeof r === 'string') { refuse(r); return; }
      msgs = r;
    }
    if (!msgs.length) return;   // AUDIT CARDS-3 A4: a word that moved nothing (a stand by nobody seated) writes nothing
    this._holdemSend(m.table, msgs, now);
    if (m.op !== 'look') await this._holdemSave();
  }
  /** AUDIT CARDS-3 A2: does another of this account's sockets (another id) hold a seat in this room? */
  _holdemAccountSeated(tables, a) {
    const others = new Set([...this._all()].filter(([, b]) => b.id && b.id !== a.id && b.sub === a.sub).map(([, b]) => b.id));
    if (!others.size) return false;
    for (const t of tables.values()) for (const s of t.seats) if (s && others.has(s.id)) return true;
    return false;
  }
  // ═══ CARDS6: THE STAKES ═══════════════════════════════════════════════════════════════════════════════════════════
  /** A staked sit's order checked (the service's key, the kind, the account, this room and table and stakes) and its
   *  stake SPENT - `{stake}`, or `{no}` (a refusal word) with `back` when a genuine stake was spent and is to be handed
   *  back. A stake is spent once, ever: its seat, its refusal or its void. */
  async _holdemStake(a, m, now) {
    await this._loadKey();
    // AUDIT CARDS-4 B3: and a room that cannot sign a cash-out seats no stake - its receipt would be unsigned, the gold held
    if (!this._verifyKey || !a.sub || !(await this._receiptKeyOf())) return { no: 'stakes closed' };
    const v = await verifyOrder(m.stake, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'stake' });
    if (!v.ok || v.claims.s !== a.sub) return { no: 'stake refused' };
    const c = v.claims;
    // AUDIT CARDS-4 A2/B1: another room's order is that room's to spend - left unspent and nothing handed back here (each
    // room remembers its own spends, so a refund here while the room it names still seats it was a stake paid twice)
    if (c.cr !== a.key) return { no: 'stake elsewhere' };
    if (await this.state.storage.get(stakeKeyOf(c.cj))) return { no: 'stake spent' };
    await this.state.storage.put(stakeKeyOf(c.cj), Math.floor(now / 1000));
    const back = { j: c.cj, s: c.s, r: c.ca };
    if (c.ct !== m.table || c.cb !== m.bb) return { no: 'stake elsewhere', back };   // this room's own, at another table or stakes
    return { stake: { j: c.cj, sub: c.s, amount: c.ca } };
  }
  /** CARDS6 follow-up (Tavern-Cards section 24): A SEAT'S TOP-UP - an order of this account's for this room, table and
   *  stakes, checked against the seat before its stake is spent (a refusal spends nothing: the device voids it back), the
   *  table read again after the order's await (AUDIT CARDS-4 B2), then spent, onto the stack, and settled at once in a
   *  'joined' receipt - its chips come home in the seat's own. */
  async _holdemTopUp(a, m, now, refuse) {
    if (a.ly) { refuse('stakes closed'); return; }   // AUDIT SCALE II R3-3 (c): no table in a layer - its order unspent, the device voids it
    await this._loadKey();
    if (!this._verifyKey || !a.sub || !(await this._receiptKeyOf())) { refuse('stakes closed'); return; }
    const v = await verifyOrder(m.stake, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'stake' });
    if (!v.ok || v.claims.s !== a.sub) { refuse('stake refused'); return; }
    const c = v.claims;
    const t = (await this._holdemOf()).get(m.table);
    if (c.cr !== a.key || c.ct !== m.table || !t || c.cb !== t.bb) { refuse('stake elsewhere'); return; }
    const stake = { j: c.cj, sub: c.s, amount: c.ca };
    const no = holdemTopUp(t, { id: a.id, stake, now }, true);
    if (no) { refuse(no); return; }
    if (await this.state.storage.get(stakeKeyOf(c.cj))) { refuse('stake spent'); return; }
    await this.state.storage.put(stakeKeyOf(c.cj), Math.floor(now / 1000));
    const msgs = holdemTopUp(t, { id: a.id, stake, now });
    if (typeof msgs === 'string') { await this._holdemReceipt(m.table, a.id, { j: c.cj, s: c.s, r: c.ca, w: 'refused' }); refuse(msgs); return; }   // moved under the spend: the whole of it back
    await this._holdemReceipt(m.table, a.id, { j: c.cj, s: c.s, r: 0, w: 'joined' });
    this._holdemSend(m.table, msgs, now);
    await this._holdemSave();
  }
  /** A stake never sat given back: an order of this account for this room, of any age (one past its minute can never be
   *  sat on), whose stake the room never spent - spent now, the whole of it back in a 'void' receipt. */
  async _holdemVoid(ws, a, m, now, refuse) {
    await this._loadKey();
    if (!this._verifyKey || !a.sub || !(await this._receiptKeyOf())) { refuse('stakes closed'); return; }   // AUDIT CARDS-4 B3
    const v = await verifyStakeOrderAnyAge(m.stake, this._verifyKey, { subtle: crypto.subtle });
    if (!v.ok || v.claims.s !== a.sub || v.claims.cr !== a.key) { refuse('stake refused'); return; }
    const c = v.claims, nowS = Math.floor(now / 1000);
    if (nowS - c.i > HOLDEM_STAKE_VOID_S) { refuse('stake too old'); return; }
    // AUDIT SCALE II R3-3 (c): A LAYER SPENDS NO ORDER - the place does. Its memory of a spend is its own object's, so a
    // void in a layer handed back a stake the place had seated (or a seat in the place sat one a layer had voided): the
    // gold paid twice. A layer's void goes to its place, which spends it - once, for every layer - and mints the receipt;
    // so a stake the service holds for a sit a layer refused comes home wherever its device stands
    if (a.ly) {
      const back = await this._holdemVoidAtPlace(a.key, m.stake, a.sub);
      if (back.no) { refuse(back.no); return; }
      await this._holdemKeepReceipt(back.table, a.id, c.s, c.cj, back.receipt);   // and owed here too, till the device says it holds it
      return;
    }
    const no = await this._holdemVoidSpend(c, nowS);
    if (no) { refuse(no); return; }
    await this._holdemReceipt(c.ct, a.id, { j: c.cj, s: c.s, r: c.ca, w: 'void' });
  }
  /** CARDS6: a verified order's void SPENT here, once (`cstake:`) - a refusal word, or null once spent. */
  async _holdemVoidSpend(c, nowS) {
    if (await this.state.storage.get(stakeKeyOf(c.cj))) return 'stake spent';
    await this.state.storage.put(stakeKeyOf(c.cj), nowS);
    return null;
  }
  /** AUDIT SCALE II R3-3 (c): a layer's void, asked of its place (the room's key is the place's own object) - `{receipt,
   *  table}`, or `{no}` in the table's words: the place's refusal, or 'stakes closed' when it did not answer (the device
   *  asks again in a minute). */
  async _holdemVoidAtPlace(key, stake, sub) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return { no: 'stakes closed' };
    try {
      const res = await rooms.get(rooms.idFromName(key)).fetch(new Request(`https://relay.internal${HOLDEM_INTERNAL_VOID}`, { method: 'POST', body: JSON.stringify({ key, stake, sub }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
      const o = await res.json();
      if (typeof o?.receipt === 'string' && Number.isSafeInteger(o.table)) return { receipt: o.receipt, table: o.table };
      return { no: typeof o?.no === 'string' ? o.no : 'stakes closed' };
    } catch (e) { console.warn('[holdem] the place did not answer a void', e?.message ?? e); return { no: 'stakes closed' }; }
  }
  /** AUDIT SCALE II R3-3 (c): THE PLACE'S HALF of a layer's void - the order checked again here (the account, this room,
   *  its age: this object mints the gold's receipt), spent here, and its receipt minted, kept owed here and answered. */
  async _holdemVoidInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const key = typeof body?.key === 'string' ? body.key : null, sub = typeof body?.sub === 'string' && body.sub ? body.sub : null;
    if (!key || !sub || !isLayered(key)) return json({ no: 'stake refused' }, 400);
    await this._loadKey();
    if (!this._verifyKey || !(await this._receiptKeyOf())) return json({ no: 'stakes closed' });
    const v = await verifyStakeOrderAnyAge(body.stake, this._verifyKey, { subtle: crypto.subtle });
    if (!v.ok || v.claims.s !== sub || v.claims.cr !== key) return json({ no: 'stake refused' });
    const c = v.claims, nowS = Math.floor(Date.now() / 1000);
    if (nowS - c.i > HOLDEM_STAKE_VOID_S) return json({ no: 'stake too old' });
    const no = await this._holdemVoidSpend(c, nowS);
    if (no) return json({ no });
    const receipt = await this._holdemReceipt(c.ct, null, { j: c.cj, s: c.s, r: c.ca, w: 'void' });
    return receipt ? json({ receipt, table: c.ct }) : json({ no: 'stakes closed' });
  }
  /** A cash-out signed (net/card/cardReceipt.js), kept for its account (the room may not see it again for a week) and sent to
   *  the seat's sockets now. */
  async _holdemReceipt(index, id, { j, s, r, w }) {
    let receipt;
    try { receipt = await mintCardReceipt({ s, j, r, w }, await this._receiptKeyOf(), { subtle: crypto.subtle, nowS: Math.floor(Date.now() / 1000) }); } catch (e) { console.warn('[holdem] a cash-out would not mint', e?.message ?? e); return false; }
    return this._holdemKeepReceipt(index, id, s, j, receipt);
  }
  /** A cash-out kept owed to its account here and sent to the seat's sockets now - the receipt answered (AUDIT SCALE II
   *  R3-3 (c): a layer keeps the one its place minted for its void, as any it minted itself). */
  async _holdemKeepReceipt(index, id, s, j, receipt) {
    const key = cashoutKeyOf(s), nowS = Math.floor(Date.now() / 1000);
    const kept = ((await this.state.storage.get(key)) ?? []).filter((x) => x && x.e > nowS && x.j !== j);
    kept.push({ j, receipt, e: nowS + CARD_RECEIPT_TTL_S });
    await this.state.storage.put(key, kept.slice(-HOLDEM_OWED_MAX));
    const out = JSON.stringify({ t: 'holdem', table: index, now: Date.now(), cashout: receipt });
    for (const [w, b] of this._all()) if (b.id && (b.id === id || b.sub === s)) this._send(w, out);
    return receipt;
  }
  /** The cash-outs this account is owed in this room, told to the asking socket (a look - the room's way in). */
  async _holdemOwed(ws, a, index) {
    if (!a.sub) return;
    const nowS = Math.floor(Date.now() / 1000);
    for (const x of (await this.state.storage.get(cashoutKeyOf(a.sub))) ?? []) if (x && x.e > nowS) this._send(ws, JSON.stringify({ t: 'holdem', table: index, now: Date.now(), cashout: x.receipt }));
  }
  /** The client holds this cash-out (its claim is the service's to settle now): the room keeps it no longer. */
  async _holdemAck(a, j) {
    if (!a.sub) return;
    const key = cashoutKeyOf(a.sub);
    const kept = (await this.state.storage.get(key)) ?? [];
    const left = kept.filter((x) => x?.j !== j);
    if (left.length === kept.length) return;
    if (left.length) await this.state.storage.put(key, left); else await this.state.storage.delete(key);
  }
  /** Every table's staked seats gone since the last save, signed and owed (the queue rides the table to here). */
  async _holdemCashouts(tables) {
    for (const [k, t] of tables) {
      if (!t.cashouts?.length) continue;
      // AUDIT CARDS-4 B4: each off the queue only once it is signed and kept - a write that threw kept the rest unsigned
      while (t.cashouts.length) {
        let done = false;
        try { done = await this._holdemReceipt(k, t.cashouts[0].to, t.cashouts[0]); } catch (e) { console.warn('[holdem] a cash-out was not kept', e?.message ?? e); }
        if (!done) break;
        t.cashouts.shift();
      }
    }
  }
  /** AUDIT CARDS-3 A3: every seat whose player has no hello'd socket in the room stood up (folded out of turn where a hand
   *  holds him) - a socket this object closed itself has no close of its own, and a ghost's seat dealt for ever on the
   *  alarm, kept the room from forgetting and, once an empty room's hello swept the secrets, let anyone saying its id
   *  take its cards. `everyone`: the room is empty (the sweep) - no seat has a player. True when a seat moved. */
  _holdemGhosts(tables, now, everyone = false) {
    const here = new Set(everyone ? [] : [...this._all()].filter(([, b]) => b.id).map(([, b]) => b.id));
    let moved = false;
    for (const [k, t] of tables) {
      for (const s of [...t.seats]) {
        if (!s || s.leaving || here.has(s.id)) continue;
        const up = holdemStand(t, { id: s.id, now });
        if (up.length) { moved = true; this._holdemSend(k, up, now); }
      }
    }
    return moved;
  }
  /** A player gone from the room: up from every table (folded out of turn where a hand holds him). */
  async _holdemLeave(a, now) {
    const tables = await this._holdemOf();
    if (!tables.size) return;
    let moved = false;
    for (const [k, t] of tables) { const msgs = holdemStand(t, { id: a.id, now }); if (msgs.length) { moved = true; this._holdemSend(k, msgs, now); } }
    if (moved) await this._holdemSave();
  }
  /** The alarm's turn at the tables: a seat whose clock ran out acts by the law's timeout, a paused table deals. True
   *  when the room keeps a table (the alarm is theirs while it does). */
  async _holdemTick() {
    const tables = await this._holdemOf();
    if (!tables.size) return false;
    const now = Date.now();
    this._holdemGhosts(tables, now);   // AUDIT CARDS-3 A3
    for (const [k, t] of tables) { const msgs = holdemTick(t, now, rand32); if (msgs.length) this._holdemSend(k, msgs, now); }
    await this._holdemSave();
    return tables.size > 0;   // AUDIT CARDS-3 A3: the last table gone, the alarm is the room's again (its forgetting)
  }
  // ═══ CARDS10 — THE ROOM'S ILIAC TABLES ══════════════════════════════════════════════════════════════════════════
  /** The room's Iliac tables (index -> table), read from storage once a wake - a hibernated room keeps its games. */
  async _iliacOf() {
    if (!this._iliac) {
      const kept = await this.state.storage.get('iliac');
      this._iliac = new Map(kept && typeof kept === 'object' ? Object.entries(kept).map(([k, v]) => [Number(k), v]) : []);
    }
    return this._iliac;
  }
  /** The tables checkpointed (the empty ones forgotten - never with a ranked result unsigned), the alarm armed. */
  async _iliacSave() {
    const tables = this._iliac;
    if (!tables) return;
    await this._iliacResults(tables);
    for (const [k, t] of tables) if (iliacEmpty(t) && !t.results?.length) tables.delete(k);
    if (tables.size) await this.state.storage.put('iliac', Object.fromEntries(tables));
    else await this.state.storage.delete('iliac');
    let at = Infinity;
    for (const t of tables.values()) { const n = iliacNextAt(t); if (n != null) at = Math.min(at, n); }
    if (Number.isFinite(at)) await this._boutArm(Date.now(), at);
  }
  /** A table's messages sent: the room's to every socket in it, a seat's to that player's sockets alone. */
  _iliacSend(index, msgs, now) {
    for (const { to, frame } of msgs) {
      const out = JSON.stringify({ t: 'iliac', table: index, now, ...frame });
      for (const [w, b] of this._all()) if (b.id && (to == null || b.id === to)) this._send(w, out);
    }
  }
  /** Up from every Iliac table in the room (a game under way conceded) - true when a seat moved. */
  async _iliacUp(id, now) {
    const tables = await this._iliacOf();
    let moved = false;
    for (const [k, t] of tables) { const up = iliacStand(t, { id, now }); if (up.length) { moved = true; this._iliacSend(k, up, now); } }
    return moved;
  }
  /** One player's word to an Iliac table: sit (with his deck - ranked with the service's order for it), stand, commit,
   *  look; AUDIT CARDS-6: vouch (a seated deck's fresh order, C5), ack (a ranked result kept on his device, C1). */
  async _iliacWord(ws, a, m, now) {
    const tables = await this._iliacOf();
    const refuse = (error) => this._send(ws, JSON.stringify({ t: 'iliac', table: m.table, now, error }));
    if (m.op === 'ack') { await this._iliacAck(a, m.j); return; }   // AUDIT CARDS-6 C1: the device holds it - kept here no longer
    if (m.op === 'vouch') { await this._iliacVouch(a, m, now, refuse); return; }   // AUDIT CARDS-6 C5
    let t = tables.get(m.table);
    let msgs;
    if (m.op === 'look') { msgs = t ? iliacLook(t, a.id) : []; await this._iliacOwed(ws, a, m.table); }   // AUDIT CARDS-6 C1: and the results owed this account here
    else if (m.op === 'sit') {
      await this._iliacOwed(ws, a, m.table);   // AUDIT CARDS-6 C1: a returning player hears what he is owed first
      // AUDIT SCALE II R3-3 (c): NO TABLE IN A LAYER - Hold'em's law (_holdemWord): a ranked game's results are owed by the
      // object that dealt it, told at a hello there (_iliacHello) - a layer's never reached again by a reconnect walked
      // from the place. Refused in the client's own words (iliacTableGame.js ILIAC_ONLINE_REFUSALS): a ranked sit
      // 'ranked closed', any other 'busy' (the room is: its place is full). What a layer already owes it keeps telling
      if (a.ly) { refuse(m.order !== undefined ? 'ranked closed' : 'busy'); return; }
      // a ranked seat: the order checked first (its await opens the room to other words, so the table is read after)
      let sub = null, orderE;
      if (m.order !== undefined) {
        // AUDIT CARDS-6 C4: and a room that cannot sign a result seats no ranked game - its end would be unsigned, never
        // counted, though the game was told ranked (Hold'em's 'stakes closed', AUDIT CARDS-4 B3)
        if (!this._verifyKey || !a.sub || !(await this._receiptKeyOf())) { refuse('ranked closed'); return; }
        const v = await verifyOrder(m.order, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'deck' });
        if (!v.ok || v.claims.s !== a.sub) { refuse('deck refused'); return; }
        if (v.claims.dh !== await deckDigest(m.deck, { subtle: crypto.subtle })) { refuse('deck refused'); return; }
        sub = a.sub;
        orderE = v.claims.e;   // AUDIT CARDS-6 C5/D2: it vouches for the first game only while unexpired at its deal
      }
      t = tables.get(m.table);
      if (t && t.chairs !== m.chairs) { refuse('table differs'); return; }
      const hold = (await this._holdemOf()).get(m.table);
      if (hold && !holdemEmpty(hold)) { refuse('other game'); return; }   // a cloth plays one game at a time
      const kg = (await this._gambitOf()).get(m.table);
      if (kg && !gambitEmpty(kg)) { refuse('other game'); return; }   // KG5: The King's Gambit's too
      if (a.sub && [...this._all()].some(([, b]) => b.id && b.id !== a.id && b.sub === a.sub && [...tables.values()].some((x) => iliacSeatOf(x, b.id) >= 0))) { refuse('account seated'); return; }   // one seat an account
      // AUDIT CARDS-6 C2: the sit's own refusals asked BEFORE the room's budget is spent - one socket's refused sits
      // ('seated' at his own chair, four a second) kept every card table in the room 'busy'; only a sit that seats spends
      const fresh = !t;
      if (fresh) { t = newIliacTable({ chairs: m.chairs }); if (!t) { refuse('bad table'); return; } }
      const no = iliacSitRefusal(t, { id: a.id, chair: m.chair, deck: m.deck });
      if (no) { refuse(no); return; }
      const gate = holdemSitRoomGate(this._holdemSitBucket ?? null, now);   // the room's sits, both games' one budget
      this._holdemSitBucket = gate.bucket;
      if (!gate.pass) { refuse('busy'); return; }
      const r = iliacSit(t, { id: a.id, name: a.name ?? '', chair: m.chair, deck: m.deck, now, sub, orderE });
      if (typeof r === 'string') { refuse(r); return; }
      if (fresh) tables.set(m.table, t);
      for (const [k, other] of tables) if (k !== m.table) { const up = iliacStand(other, { id: a.id, now }); if (up.length) this._iliacSend(k, up, now); }   // one seat in a room at a time
      const holdem = await this._holdemOf();
      let stood = false;
      for (const [k, other] of holdem) { const up = holdemStand(other, { id: a.id, now }); if (up.length) { stood = true; this._holdemSend(k, up, now); } }
      if (stood) await this._holdemSave();
      if (await this._gambitUp(a.id, now)) await this._gambitSave();   // KG5: and off a King's Gambit table
      msgs = r;
    } else if (!t) { refuse('no table'); return; }
    else if (m.op === 'stand') msgs = iliacStand(t, { id: a.id, now, gameNo: m.gameNo });   // AUDIT CARDS-6 E13: the game his panel showed
    else {
      const r = iliacCommit(t, { id: a.id, plays: m.plays, now, gameNo: m.gameNo, turn: m.turn });   // AUDIT CARDS-6 C3: the game and turn he saw
      if (typeof r === 'string') { refuse(r); return; }
      msgs = r;
    }
    if (!msgs.length) return;
    this._iliacSend(m.table, msgs, now);
    if (m.op !== 'look') await this._iliacSave();
  }
  /** The ranked results the tables queued, signed (net/iliac/iliacReceipt.js i1) and handed to every socket of either account
   *  in the room - the winner's copy is enough for the service. A result that will not mint is dropped and said.
   *  AUDIT CARDS-6 C1: and KEPT, owed to both accounts for the receipt's life (told again on a look, a sit, a hello, until
   *  the device says it holds it - `ack`): a result sent once to the sockets of that instant was lost with a link that
   *  was down at the end, the winner's only copy left on the loser's client. Off the queue only once it is kept (AUDIT
   *  CARDS-4 B4's rule: a write that threw keeps the rest to sign again). */
  async _iliacResults(tables) {
    const key = await this._receiptKeyOf();
    const nowS = Math.floor(Date.now() / 1000);
    for (const [k, t] of tables) {
      while (t.results?.length) {
        const res = t.results[0];
        let receipt;
        try { receipt = await mintIliacReceipt({ j: res.j, f: res.f, r: res.r, h: res.h }, key, { subtle: crypto.subtle, nowS }); } catch (e) { console.warn('[iliac] a result would not mint', e?.message ?? e); t.results.shift(); continue; }
        try { for (const sub of res.f) await this._iliacKeep(sub, k, res.j, receipt, nowS); } catch (e) { console.warn('[iliac] a result was not kept', e?.message ?? e); break; }
        t.results.shift();
        const out = JSON.stringify({ t: 'iliac', table: k, now: Date.now(), receipt });
        for (const [w, b] of this._all()) if (b.id && (res.to.includes(b.id) || res.f.includes(b.sub))) this._send(w, out);
      }
    }
  }
  /** AUDIT CARDS-6 C1: a ranked result owed to `sub` in this room - one a game, for the receipt's life, ILIAC_OWED_MAX. */
  async _iliacKeep(sub, k, j, receipt, nowS) {
    const key = iliacOwedKeyOf(sub);
    const live = ((await this.state.storage.get(key)) ?? []).filter((x) => x?.j !== j && x?.e > nowS);
    await this.state.storage.put(key, [...live, { j, k, receipt, e: nowS + ILIAC_RECEIPT_TTL_S }].slice(-ILIAC_OWED_MAX));
  }
  /** AUDIT CARDS-6 C1: the ranked results this account is owed in this room, told to the asking socket. */
  async _iliacOwed(ws, a, index) {
    if (!a.sub) return;
    const nowS = Math.floor(Date.now() / 1000);
    const owed = ((await this.state.storage.get(iliacOwedKeyOf(a.sub))) ?? []).filter((x) => x?.e > nowS);
    for (const x of owed) this._send(ws, JSON.stringify({ t: 'iliac', table: Number.isInteger(x.k) ? x.k : index, now: Date.now(), receipt: x.receipt }));
  }
  /** AUDIT CARDS-6 C1: the device holds this result (its claim the service's to count now): the room owes it no longer. */
  async _iliacAck(a, j) {
    if (!a.sub) return;
    const key = iliacOwedKeyOf(a.sub);
    const owed = (await this.state.storage.get(key)) ?? [];
    if (!owed.some((x) => x?.j === j)) return;
    const rest = owed.filter((x) => x?.j !== j);
    await (rest.length ? this.state.storage.put(key, rest) : this.state.storage.delete(key));
  }
  /** AUDIT CARDS-6 C5/D2: a seated deck vouched for again (the room asked, `{t: 'vouch'}`, when it scheduled a ranked
   *  pair's next deal) - the service's order checked exactly as a sit's is (its kind, its account, the digest of the deck
   *  the seat holds, unexpired), the table read after its await - for the next game dealt, while it is unexpired then. */
  async _iliacVouch(a, m, now, refuse) {
    if (!this._verifyKey || !a.sub || !(await this._receiptKeyOf())) { refuse('ranked closed'); return; }
    const v = await verifyOrder(m.order, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'deck' });
    const t = (await this._iliacOf()).get(m.table);
    const seat = t?.seats[iliacSeatOf(t, a.id)];
    if (!seat) { refuse('not seated'); return; }
    if (!v.ok || v.claims.s !== a.sub || v.claims.dh !== await deckDigest(seat.deck, { subtle: crypto.subtle })) { refuse('deck refused'); return; }
    const no = iliacVouch(t, { id: a.id, sub: a.sub, orderE: v.claims.e });
    if (no) { refuse(no); return; }
    await this._iliacSave();
  }
  /** AUDIT CARDS-6 C7/C1: a hello into an interior - a ranked seat kept for this player's blink is his again (told the
   *  table and his own view), and the results his account is owed here are told again. */
  async _iliacHello(ws, id, sub, now) {
    const tables = await this._iliacOf();
    let moved = false;
    for (const [k, t] of tables) { const back = iliacBack(t, { id, sub, now }); if (back.length) { moved = true; this._iliacSend(k, back, now); } }
    if (moved) await this._iliacSave();
    await this._iliacOwed(ws, { sub }, 0);
  }
  /** AUDIT CARDS-3 A3's law for the second game: a seat whose player is gone from the room goes (net/iliac/iliacTable.js
   *  iliacGone - AUDIT CARDS-6 C7: a ranked game's seat kept ILIAC_GONE_MS for him, anyone else's stood up, a game
   *  conceded). `everyone`: the room drained - every game under way had both its players gone, no contest, and every
   *  seat stands. */
  _iliacGhosts(tables, now, everyone = false) {
    const here = new Set(everyone ? [] : [...this._all()].filter(([, b]) => b.id).map(([, b]) => b.id));
    let moved = false;
    for (const [k, t] of tables) {
      if (everyone && t.game) { moved = true; this._iliacSend(k, iliacVoid(t, now), now); }
      for (const s of [...t.seats]) {
        if (!s || here.has(s.id) || (!everyone && s.away)) continue;
        const up = everyone ? iliacStand(t, { id: s.id, now }) : iliacGone(t, { id: s.id, now });
        if (up.length) { moved = true; this._iliacSend(k, up, now); }
      }
    }
    return moved;
  }
  /** A player gone from the room: up from every Iliac table (a game under way conceded) - AUDIT CARDS-6 C7: a ranked
   *  game's seat kept a moment for him first. */
  async _iliacLeave(a, now) {
    const tables = await this._iliacOf();
    if (!tables.size) return;
    let moved = false;
    for (const [k, t] of tables) { const up = iliacGone(t, { id: a.id, now }); if (up.length) { moved = true; this._iliacSend(k, up, now); } }
    if (moved) await this._iliacSave();
  }
  /** The alarm's turn at the Iliac tables: a turn whose clock ran out passes and turns over, a paused table deals. True
   *  when the room keeps a table. */
  async _iliacTick() {
    const tables = await this._iliacOf();
    if (!tables.size) return false;
    const now = Date.now();
    this._iliacGhosts(tables, now);
    for (const [k, t] of tables) { const msgs = iliacTableTick(t, now, rand32); if (msgs.length) this._iliacSend(k, msgs, now); }
    await this._iliacSave();
    return tables.size > 0;
  }
  // ═══ KG5 — THE ROOM'S KING'S GAMBIT TABLES ══════════════════════════════════════════════════════════════════════
  /** The room's King's Gambit tables (index -> table), read from storage once a wake - a hibernated room keeps its
   *  games - and CHECKED (AUDIT KG A4): the law's steps trust the state they are handed and throw on a malformed one, so
   *  a stored table the law did not mint (net/gambit/gambitTable.js gambitTableValid) is dropped, and said on the console. */
  async _gambitOf() {
    if (!this._gambit) {
      const kept = await this.state.storage.get('gambit');
      this._gambit = new Map();
      if (kept && typeof kept === 'object') {
        for (const [k, v] of Object.entries(kept)) {
          if (gambitTableValid(v)) this._gambit.set(Number(k), v);
          else console.warn('[gambit] a stored table the law did not mint, dropped', k);
        }
      }
    }
    return this._gambit;
  }
  /** The tables checkpointed (the empty ones forgotten - KG6: never with a cash-out or a result unsigned), the alarm armed
   *  at the soonest clock. */
  async _gambitSave() {
    const tables = this._gambit;
    if (!tables) return;
    await this._gambitOwedOut(tables);   // KG6: the cash-outs and rated results signed and kept - never an empty table forgotten with one unsigned
    for (const [k, t] of tables) if (gambitEmpty(t) && !t.cashouts?.length && !t.results?.length) tables.delete(k);
    if (tables.size) await this.state.storage.put('gambit', Object.fromEntries(tables));
    else await this.state.storage.delete('gambit');
    let at = Infinity;
    for (const t of tables.values()) { const n = gambitNextAt(t); if (n != null) at = Math.min(at, n); }
    if (Number.isFinite(at)) await this._boutArm(Date.now(), at);
  }
  /** A table's messages sent: the room's to every socket in it (the tavern watches the board), a player's to his alone. */
  _gambitSend(index, msgs, now) {
    for (const { to, frame } of msgs) {
      const out = JSON.stringify({ t: 'gambit', table: index, now, ...frame });
      for (const [w, b] of this._all()) if (b.id && (to == null || b.id === to)) this._send(w, out);
    }
  }
  /** Up from every King's Gambit table in the room (a game under way forfeited) - true when a seat moved. */
  async _gambitUp(id, now) {
    const tables = await this._gambitOf();
    let moved = false;
    for (const [k, t] of tables) { const up = gambitStand(t, { id, now }); if (up.length) { moved = true; this._gambitSend(k, up, now); } }
    return moved;
  }
  /** One player's word to a King's Gambit table: sit (a chair and a crown), ready (an army), unready, act (the law's
   *  command), forfeit, stand, look. Each refusal is the table's own word, said to the asker alone. */
  async _gambitWord(ws, a, m, now) {
    const tables = await this._gambitOf();
    const refuse = (error) => this._send(ws, JSON.stringify({ t: 'gambit', table: m.table, now, error }));
    if (m.op === 'ack') { await this._gambitAck(a, m.j); return; }   // KG6: the device holds a rated result - owed here no longer
    let t = tables.get(m.table);
    let msgs;
    if (m.op === 'look') { msgs = t ? gambitLook(t, a.id) : []; await this._gambitOwed(ws, a, m.table); }   // KG6: and the results owed this account here
    else if (m.op === 'sit') {
      await this._gambitOwed(ws, a, m.table);   // KG6: a returning player hears what he is owed first
      // AUDIT SCALE II R3-3 (c)'s law: no table in a layer (its place is full - 'busy', the client's own word)
      if (a.ly) { refuse('busy'); return; }
      if (t && t.chairs !== m.chairs) { refuse('table differs'); return; }   // the first sitter never decides another cloth's chairs
      const hold = (await this._holdemOf()).get(m.table), ili = (await this._iliacOf()).get(m.table);
      if ((hold && !holdemEmpty(hold)) || (ili && !iliacEmpty(ili))) { refuse('other game'); return; }   // a cloth plays one game at a time
      if (a.sub && [...this._all()].some(([, b]) => b.id && b.id !== a.id && b.sub === a.sub && [...tables.values()].some((x) => gambitSeatOf(x, b.id) >= 0))) { refuse('account seated'); return; }   // one seat an account
      const fresh = !t;
      // KG6 (10.7): the red table is the realm's gold table - every Ready there a stake (the escrow's, CARDS6)
      if (fresh) { t = newGambitTable({ chairs: m.chairs, gold: holdemGoldTable(m.table) }); if (!t) { refuse('bad table'); return; } }
      // AUDIT CARDS-6 C2's law: the sit's own refusals asked BEFORE the room's one sit budget is spent
      const no = gambitSitRefusal(t, { id: a.id, chair: m.chair, crown: m.crown });
      if (no) { refuse(no); return; }
      const gate = holdemSitRoomGate(this._holdemSitBucket ?? null, now);   // the room's sits, every game's one budget
      this._holdemSitBucket = gate.bucket;
      if (!gate.pass) { refuse('busy'); return; }
      const r = gambitSit(t, { id: a.id, name: a.name ?? '', chair: m.chair, crown: m.crown, now, sub: a.sub ?? null });   // KG6: its account - a game between two is rated
      if (typeof r === 'string') { refuse(r); return; }
      if (fresh) tables.set(m.table, t);
      for (const [k, other] of tables) if (k !== m.table) { const up = gambitStand(other, { id: a.id, now }); if (up.length) this._gambitSend(k, up, now); }   // one seat in a room at a time
      const holdem = await this._holdemOf();
      let stood = false;
      for (const [k, other] of holdem) { const up = holdemStand(other, { id: a.id, now }); if (up.length) { stood = true; this._holdemSend(k, up, now); } }
      if (stood) await this._holdemSave();
      if (await this._iliacUp(a.id, now)) await this._iliacSave();
      msgs = r;
    } else if (!t) { refuse('no table'); return; }
    else if (m.op === 'stand') msgs = gambitStand(t, { id: a.id, now, gameNo: m.gameNo });   // AUDIT KG II A1: the game its panel showed
    else {
      const r = m.op === 'ready' ? await this._gambitReady(a, m, now)
        : m.op === 'unready' ? gambitUnready(t, { id: a.id, now })
        : m.op === 'forfeit' ? gambitForfeit(t, { id: a.id, gameNo: m.gameNo, now })
        : gambitCommand(t, { id: a.id, cmd: m.cmd, gameNo: m.gameNo, now, rand32 });   // the game his panel showed; the relay's own dice
      if (typeof r === 'string') { refuse(r); return; }
      msgs = r;
    }
    if (!msgs.length) return;
    this._gambitSend(m.table, msgs, now);
    if (m.op !== 'look') await this._gambitSave();
  }
  /** KG6: A READY - with a stake at the gold table: the service's order checked (its kind, its account, this room, this
   *  table, the game's big blind - net/gambit/gambitStakes.js), the table read again after its await (AUDIT CARDS-4 B2), the
   *  Ready's own refusals asked BEFORE the order is spent (a refusal spends nothing: the device voids it back), then
   *  spent once (`cstake:`) and the seat readied with it - a refusal after the spend hands the whole stake back in a
   *  'refused' cash-out. Answers the messages, or a refusal word. */
  async _gambitReady(a, m, now) {
    const tables = await this._gambitOf();
    let t = tables.get(m.table);
    if (m.stake === undefined) return gambitReady(t, { id: a.id, army: m.army, crown: m.crown, now });
    if (a.ly) return 'stakes closed';   // AUDIT SCALE II R3-3 (c): no stake in a layer - its order unspent, the device voids it
    await this._loadKey();
    // AUDIT CARDS-4 B3's law: a room that cannot sign a cash-out seats no stake
    if (!this._verifyKey || !a.sub || !(await this._receiptKeyOf())) return 'stakes closed';
    const v = await verifyOrder(m.stake, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'stake' });
    if (!v.ok || v.claims.s !== a.sub) return 'stake refused';
    const c = v.claims;
    if (c.cr !== a.key || c.ct !== m.table || c.cb !== GAMBIT_STAKE_BB) return 'stake elsewhere';   // another room's, table's or game's: unspent here
    t = tables.get(m.table);
    if (!t) return 'no table';
    const no = gambitReadyRefusal(t, { id: a.id, army: m.army, crown: m.crown, stake: c.ca });
    if (no) return no;
    if ((await this.state.storage.get(stakeKeyOf(c.cj))) !== undefined) return 'stake spent';   // one order, one Ready, ever
    await this.state.storage.put(stakeKeyOf(c.cj), Math.floor(now / 1000));
    const r = gambitReady(t, { id: a.id, army: m.army, crown: m.crown, now, stake: { j: c.cj, sub: c.s, amount: c.ca } });
    if (typeof r === 'string') await this._holdemReceipt(m.table, a.id, { j: c.cj, s: c.s, r: c.ca, w: 'refused' });   // moved under the spend: the whole of it back
    return r;
  }
  /** KG6: what the tables owe, signed and kept - each cash-out by CARDS6's own (`_holdemReceipt`: kept for its account,
   *  sent to its seat's sockets), each rated result by Iliac Hand's law (kept owed to both accounts for its life, sent to
   *  both) - each off its queue only once kept (AUDIT CARDS-4 B4: a write that threw keeps the rest to sign again). */
  async _gambitOwedOut(tables) {
    for (const [k, t] of tables) {
      while (t.cashouts?.length) {
        let done = false;
        try { done = !!(await this._holdemReceipt(k, t.cashouts[0].to, t.cashouts[0])); } catch (e) { console.warn('[gambit] a cash-out was not kept', e?.message ?? e); }
        if (done === false) break;
        t.cashouts.shift();
      }
      if (!t.results?.length) continue;
      const key = await this._receiptKeyOf();
      const nowS = Math.floor(Date.now() / 1000);
      while (t.results.length) {
        const res = t.results[0];
        let receipt;
        try { receipt = await mintGambitReceipt({ j: res.j, f: res.f, r: res.r, h: res.h }, key, { subtle: crypto.subtle, nowS }); } catch (e) { console.warn('[gambit] a result would not mint', e?.message ?? e); t.results.shift(); continue; }
        try { for (const sub of res.f) await this._gambitKeep(sub, k, res.j, receipt, nowS); } catch (e) { console.warn('[gambit] a result was not kept', e?.message ?? e); break; }
        t.results.shift();
        const out = JSON.stringify({ t: 'gambit', table: k, now: Date.now(), receipt });
        for (const [w, b] of this._all()) if (b.id && (res.f.includes(b.sub) || res.to.includes(b.id))) this._send(w, out);   // both accounts' sockets, and the seats'
      }
    }
  }
  /** KG6: a rated result owed to `sub` in this room - one a game, for the receipt's life, ILIAC_OWED_MAX. */
  async _gambitKeep(sub, k, j, receipt, nowS) {
    const key = gambitOwedKeyOf(sub);
    const live = ((await this.state.storage.get(key)) ?? []).filter((x) => x?.j !== j && x?.e > nowS);
    await this.state.storage.put(key, [...live, { j, k, receipt, e: nowS + GAMBIT_RECEIPT_TTL_S }].slice(-ILIAC_OWED_MAX));
  }
  /** KG6: the rated results this account is owed in this room, told to the asking socket (a look, a sit, a hello). */
  async _gambitOwed(ws, a, index) {
    if (!a.sub) return;
    const nowS = Math.floor(Date.now() / 1000);
    const owed = ((await this.state.storage.get(gambitOwedKeyOf(a.sub))) ?? []).filter((x) => x?.e > nowS);
    for (const x of owed) this._send(ws, JSON.stringify({ t: 'gambit', table: Number.isInteger(x.k) ? x.k : index, now: Date.now(), receipt: x.receipt }));
  }
  /** KG6: the device holds this result (its claim the service's to count now): the room owes it no longer. */
  async _gambitAck(a, j) {
    if (!a.sub) return;
    const key = gambitOwedKeyOf(a.sub);
    const owed = (await this.state.storage.get(key)) ?? [];
    if (!owed.some((x) => x?.j === j)) return;
    const rest = owed.filter((x) => x?.j !== j);
    await (rest.length ? this.state.storage.put(key, rest) : this.state.storage.delete(key));
  }
  /** A seat whose player is gone from the room stands (its game the other's - friendly, no seat is kept). `everyone`:
   *  the room drained - every game under way had both its players gone: no contest, and every seat stands. */
  _gambitGhosts(tables, now, everyone = false) {
    const here = new Set(everyone ? [] : [...this._all()].filter(([, b]) => b.id).map(([, b]) => b.id));
    let moved = false;
    for (const [k, t] of tables) {
      if (everyone && t.game) { moved = true; this._gambitSend(k, gambitVoid(t, now), now); }
      for (const s of [...t.seats]) {
        if (!s || here.has(s.id)) continue;
        const up = gambitStand(t, { id: s.id, now });
        if (up.length) { moved = true; this._gambitSend(k, up, now); }
      }
    }
    return moved;
  }
  /** A player gone from the room: up from every King's Gambit table - a stand or a socket gone forfeits (5.8). */
  async _gambitLeave(a, now) {
    const tables = await this._gambitOf();
    if (!tables.size) return;
    if (await this._gambitUp(a.id, now)) await this._gambitSave();
  }
  /** The alarm's turn at the King's Gambit tables: a turn's end on its beat, a turn run out, a table's deal. True when
   *  the room keeps a table. */
  async _gambitTick() {
    const tables = await this._gambitOf();
    if (!tables.size) return false;
    const now = Date.now();
    this._gambitGhosts(tables, now);
    for (const [k, t] of tables) { const msgs = gambitTableTick(t, now, rand32); if (msgs.length) this._gambitSend(k, msgs, now); }
    await this._gambitSave();
    return tables.size > 0;
  }
  /** An arena word to one socket. */
  _arenaSend(ws, w) { return this._send(ws, JSON.stringify({ t: 'arena', ...w })); }
  /** The hello'd sockets of an account in this room. */
  _arenaSocketsOf(sub) { return [...this._all()].filter(([, b]) => b.id && b.sub === sub).map(([w]) => w); }
  /** A word to an account, every socket of it here. */
  _arenaTell(sub, w) { for (const s of this._arenaSocketsOf(sub)) this._arenaSend(s, w); }
  /** A POST to another arena object (the hall, a bout) - true when it answered ok; a relay built without the binding
   *  (a lone test room) answers true and does nothing. */
  async _arenaPost(key, path, body) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return true;
    try { const res = await rooms.get(rooms.idFromName(key)).fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) })); return !!res?.ok; }
    catch (e) { console.warn('[arena] post', path, e?.message ?? e); return false; }
  }

  // ── THE HALL (`arena:hall`): the queue, the offers, the bouts to watch ──
  /** The hall's book, read once an instance life. `q` the queue `[{ sub, name, rating, title, lv, at }]`, `offers`
   *  `[{ o, a, b, until, ya, yb }]`, `live` the bouts on the sand by id, `apart` the pairs not to offer again yet. */
  async _hallOf() {
    if (this._hall === undefined) {
      const v = await this.state.storage.get('arenahall');
      this._hall = v && typeof v === 'object' ? v : { q: [], offers: [], live: {}, apart: [], said: {} };
    }
    return this._hall;
  }
  async _hallSave() { await this.state.storage.put('arenahall', this._hall); }
  async _hallArm(now) {
    const at = await this.state.storage.getAlarm();
    if (at == null || at > now + 1000) await this.state.storage.setAlarm(now + 1000);
  }
  /** A fighter as the hall bills them to their opponent - ARENA4b: with their banner (`b`), as their queue word claimed it
   *  (net/arena/arenaLaw.js bannerClaim): the token signs no banner, and the pennant is cosmetic only - a banner's points are
   *  the account service's, counted off its own arena_members row, never off this bill. */
  _bill(e) { return { n: e.name, r: e.rating, ...(e.title ? { t: e.title } : {}), ...(e.banner ? { b: e.banner } : {}) }; }
  /** ARENA4b: a casual pair's offer, call and listing say so (`u`) - both of a pair sought the same (pairQueue). */
  _casualWord(e) { return e?.casual ? { u: 1 } : {}; }
  _queueWord(H, now, sub) {
    const e = H.q.find((x) => x.sub === sub);
    return e ? { k: 'qd', n: Math.min(MATCH_QUEUE_MAX, H.q.length), band: matchBand(now - e.at) } : null;
  }
  /** ONE HALL WORD: `q` into the queue (a registered account, one place an account), `x` out of it, `y`/`n` an offer's
   *  answer, `ls` the bouts to watch. */
  async _hallWord(ws, a, m, now) {
    const H = await this._hallOf();
    const sub = a.sub;
    const inOffer = H.offers.find((f) => f.a.sub === sub || f.b.sub === sub) ?? null;
    if (m.k === 'q') {
      if (!a.lk) { this._arenaSend(ws, { k: 'qx', m: 'guest' }); return; }
      if (inOffer) { this._arenaSend(ws, { k: 'of', o: inOffer.o, vs: this._bill(inOffer.a.sub === sub ? inOffer.b : inOffer.a), until: inOffer.until, ...this._casualWord(inOffer.a) }); return; }
      if (!H.q.some((x) => x.sub === sub)) {
        if (H.q.length >= MATCH_QUEUE_MAX) { this._arenaSend(ws, { k: 'qx', m: 'full' }); return; }
        // AUDIT PRE-MERGE 1003 S3: `lv` THE TOKEN'S - the Renown level the account service signed (Seats-Arc 6.1's "the level
        // is the account service's signed number"; net/arena/arenaLaw.js pvpVitality reads it), never the word's: the word's `lv`
        // set a rated bout's health (999 held at sixty - 420 against an honest 302). A word still carrying one is not refused.
        H.q.push({ sub, name: a.name, rating: arenaRatingOk(a.ar), title: a.title ?? null, lv: a.lv ?? 1, banner: bannerClaim(m.b), casual: m.u === 1, at: now });   // ARENA4b: the banner the word claims, billed (_bill); `casual` an unrated bout sought - paired like with like (pairQueue)
        await this._hallSave();
      }
      this._arenaTell(sub, this._queueWord(H, now, sub));
      await this._hallArm(now);
      return;
    }
    if (m.k === 'x') {
      const was = H.q.length;
      H.q = H.q.filter((x) => x.sub !== sub);
      if (inOffer) await this._hallDecline(H, inOffer, sub, now);
      if (H.q.length !== was || inOffer) await this._hallSave();
      this._arenaTell(sub, { k: 'qx', m: 'left' });
      return;
    }
    if (m.k === 'y' || m.k === 'n') {
      if (!inOffer || inOffer.o !== m.o) { this._arenaSend(ws, { k: 'qx', m: 'lapsed' }); return; }
      if (m.k === 'n') { await this._hallDecline(H, inOffer, sub, now); this._arenaTell(sub, { k: 'qx', m: 'left' }); await this._hallSave(); return; }
      if (inOffer.a.sub === sub) inOffer.ya = true; else inOffer.yb = true;
      if (inOffer.ya && inOffer.yb) await this._hallGo(H, inOffer, now);
      await this._hallSave();
      return;
    }
    if (m.k === 'ls') { this._arenaSend(ws, this._liveWord(H, now)); return; }
    this._junk(ws);
  }
  /** The bouts on the sand now, the newest first. */
  _liveWord(H, now) {
    const l = Object.values(H.live).filter((e) => now - e.at < 30 * 60_000).sort((x, y) => y.at - x.at).slice(0, ARENA_LIVE_MAX);
    return { k: 'live', l };
  }
  /** An offer declined (or let lapse) by `sub`: it goes out of the queue, the other back into it with their wait kept,
   *  told so; the pair is not offered again for MATCH_REPAIR_MS. */
  async _hallDecline(H, f, sub, now) {
    H.offers = H.offers.filter((x) => x !== f);
    const other = f.a.sub === sub ? f.b : f.a;
    if (!H.q.some((x) => x.sub === other.sub)) H.q.push(other);
    H.apart.push([f.a.sub, f.b.sub, now + MATCH_REPAIR_MS]);
    this._arenaTell(other.sub, { k: 'qx', m: 'declined' });
    this._arenaTell(other.sub, this._queueWord(H, now, other.sub));
  }
  /** Both said yes: the bout's room opened with its two fighters, each told where to go and whom they meet. */
  async _hallGo(H, f, now) {
    H.offers = H.offers.filter((x) => x !== f);
    // AUDIT PRE-MERGE 1003 S7: THE BOUT'S ROOM IS MINTED HERE, told to the pair only once it is open - never the offer's
    // id, which both hear before either says yes: a ladder room's id is its fighter's own, so one of a pair stood a
    // ladder bout in `arena:b<offer id>`, the open was refused, both were sent back `busy` and paired again, for ever
    const o = arenaId();
    const fighters = [f.a, f.b].map((e) => ({ sub: e.sub, name: e.name, lv: e.lv, rating: e.rating, title: e.title, banner: e.banner ?? null }));   // ARENA4b: and the banner each claimed
    const ok = await this._arenaPost(arenaBoutRoom(o), ARENA_INTERNAL_OPEN, { o, kind: 'pvp', f: fighters, casual: !!f.a.casual, at: now });   // ARENA4b: a casual pair's room owes no receipt
    if (!ok) {
      for (const e of [f.a, f.b]) { if (!H.q.some((x) => x.sub === e.sub)) H.q.push(e); this._arenaTell(e.sub, { k: 'qx', m: 'busy' }); }
      return;
    }
    H.live[o] = { o, kind: 'pvp', a: this._bill(f.a), b: this._bill(f.b), ...this._casualWord(f.a), sp: 0, at: now };
    this._arenaTell(f.a.sub, { k: 'go', o, side: 0, vs: this._bill(f.b), ...this._casualWord(f.a) });
    this._arenaTell(f.b.sub, { k: 'go', o, side: 1, vs: this._bill(f.a), ...this._casualWord(f.a) });
  }
  /** THE HALL'S BEAT, a second: offers lapsed (the one who did not say yes out of the queue, the other back in), the
   *  queue paired (pairQueue - the band widening with the wait), each band said again as it widens, the old forgotten. */
  async _hallTick(now) {
    const H = await this._hallOf();
    for (const f of [...H.offers]) {
      if (now < f.until) continue;
      H.offers = H.offers.filter((x) => x !== f);
      for (const [e, yes] of [[f.a, f.ya], [f.b, f.yb]]) {
        if (yes) { if (!H.q.some((x) => x.sub === e.sub)) H.q.push(e); this._arenaTell(e.sub, { k: 'qx', m: 'lapsed' }); this._arenaTell(e.sub, this._queueWord(H, now, e.sub)); }
        else this._arenaTell(e.sub, { k: 'qx', m: 'lapsed' });
      }
      H.apart.push([f.a.sub, f.b.sub, now + MATCH_REPAIR_MS]);
    }
    H.apart = H.apart.filter((p) => p[2] > now);
    // the queue holds only accounts with a socket in the hall (a tab closed without a word is out)
    H.q = H.q.filter((e) => this._arenaSocketsOf(e.sub).length);
    const apart = (x, y) => H.apart.some((p) => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x));
    for (const [a, b] of pairQueue(H.q, now, apart)) {
      H.q = H.q.filter((x) => x.sub !== a.sub && x.sub !== b.sub);
      const f = { o: arenaId(), a, b, until: now + MATCH_ACCEPT_MS, ya: false, yb: false };
      H.offers.push(f);
      this._arenaTell(a.sub, { k: 'of', o: f.o, vs: this._bill(b), until: f.until, ...this._casualWord(a) });
      this._arenaTell(b.sub, { k: 'of', o: f.o, vs: this._bill(a), until: f.until, ...this._casualWord(a) });
    }
    H.said ??= {};
    for (const e of H.q) {
      const band = matchBand(now - e.at);
      const was = H.said[e.sub];
      if (!was || was.band !== band || now - was.at >= ARENA_SAY_BAND_MS) { H.said[e.sub] = { band, at: now }; this._arenaTell(e.sub, this._queueWord(H, now, e.sub)); }
    }
    for (const k of Object.keys(H.said)) if (!H.q.some((e) => e.sub === k)) delete H.said[k];
    for (const [o, e] of Object.entries(H.live)) if (now - e.at > 30 * 60_000) delete H.live[o];
    await this._hallSave();
    if (H.q.length || H.offers.length) await this.state.storage.setAlarm(now + 1000);
  }
  /** A bout tells the hall where it stands: its entry, or none when it is done. */
  async _arenaLiveInternal(request) {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad' }, 400); }
    if (!body || typeof body.o !== 'string') return json({ error: 'bad' }, 400);
    const H = await this._hallOf();
    if (body.done) delete H.live[body.o];
    else if (body.e && typeof body.e === 'object') H.live[body.o] = { ...body.e, at: Number.isFinite(body.e.at) ? body.e.at : Date.now() };
    await this._hallSave();
    return json({ ok: true });
  }

  // ── A BOUT (`arena:b<id>`) ──
  async _boutOf() {
    if (this._bout === undefined) { const v = await this.state.storage.get('arenabout'); this._bout = v && typeof v === 'object' ? v : null; }
    return this._bout;
  }
  async _boutSave(now, force = false) {
    if (!force && now - (this._boutSavedAt ?? 0) < ARENA_SAVE_MS) return;
    this._boutSavedAt = now;
    await this.state.storage.put('arenabout', this._bout);
  }
  async _boutArm(now, at = now + ARENA_TICK_MS) {
    const cur = await this.state.storage.getAlarm();
    if (cur == null || cur > at) await this.state.storage.setAlarm(at);
  }
  /** Words to every socket on the bout's sand or in its stands. AUDIT PRE-MERGE 1003 S1: theirs alone - the fan was every
   *  hello'd socket, so one told the seats are full heard the whole bout all the same (sixty seats a bound on nothing). */
  _boutFan(words) {
    if (!words?.length) return;
    this._fanFrames(words.map((w) => JSON.stringify({ t: 'arena', ...w })), (b) => b.id && (b.af || b.asp));   // SCALE5b: a beat one frame to the second wire
  }
  /** The whole bout to every socket on its sand or in its stands - each with its own fighter id, '' in the stands. */
  _boutFanState(st) { for (const [ws, b] of [...this._all()]) if (b.id && (b.af || b.asp)) this._arenaSend(ws, stateWord(st, b.afid ?? '')); }
  /** The hall told of this bout - its entry, or done. ARENA6: a private session's bout never - the hall's list is the
   *  realm's to watch, and a session's bouts are its members' (told done, it is said so here and nothing is posted). */
  async _boutTellHall(st, done = false) {
    if (st.priv) return true;
    const e = done ? null : liveEntry(st);
    return this._arenaPost(ARENA_HALL, ARENA_INTERNAL_LIVE, { o: st.o, ...(done ? { done: true } : { e }) });
  }
  /** The hall opens a matched bout here: its two fighters, nobody on the sand yet. */
  async _arenaOpenInternal(request) {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad' }, 400); }
    if (!body || typeof body.o !== 'string' || body.kind !== 'pvp' || !Array.isArray(body.f) || body.f.length !== 2) return json({ error: 'bad' }, 400);
    if (await this._boutOf()) return json({ error: 'taken' }, 409);
    const now = Date.now();
    this._bout = openBout({ o: body.o, kind: 'pvp', f: body.f, casual: body.casual === true, now });
    await this._boutSave(now, true);
    await this._boutArm(now);
    return json({ ok: true });
  }
  /** ONE BOUT WORD: `in` (to the sand or the stands - a ladder bout opened by its own fighter's first `in`), `hit` (a blow
   *  claim, the referee's), `yd` (a yield at the line), `ch` (a spectator's cheer or boo). */
  async _boutWord(ws, a, m, now) {
    let st = await this._boutOf();
    if (m.k === 'in') {
      const exRoom = isArenaExhibitionRoom(a.key);
      if (isArenaPrivateRoom(a.key)) {
        // ARENA6: A PRIVATE SESSION'S SAND AND STANDS ARE ITS MEMBERS' - its bout is opened by its host's go alone (an `in`
        // here never opens a ladder bout), and only a member of the session takes a place at it
        const S = await this._sessionOf();
        const no = !S ? 'no session' : !S.members[a.sub] ? (S.kicked.includes(a.sub) ? 'removed' : 'not member') : !st ? 'no bout' : null;
        if (no) { this._arenaSend(ws, { k: 'no', m: no }); return; }
      }
      if (!st && exRoom) {
        // ARENA4b: THE HOUR'S EXHIBITION IS OPENED BY ITS FIRST WATCHER - inside its window on the shared clock (the hour's
        // own, the gates open, its first EXHIBITION_START_MINUTES: net/arena/arenaExhibition.js exhibitionOpening), the hour's
        // pair, its law begun at once; later the hour is said to have no bout (nobody watched it while it might begin)
        const hour = arenaExhibitionHourOf(a.key);
        const ex = m.r === 's' ? exhibitionOpening(hour, sharedClassicMinutes(now)) : null;
        if (!ex) { this._arenaSend(ws, { k: 'no', m: 'no bout' }); return; }
        st = this._bout = openBout({ o: exhibitionBoutId(hour), kind: 'ex', f: [], ex, now });   // the hall is told as its first seat is taken, below
      } else if (!st) {
        // A LADDER BOUT IS OPENED BY ITS FIGHTER: the `in` names the tier and the bout; whether it is the account's next
        // is the account service's question at the claim (the climb is in order in its write - ARENA4b: the relay does
        // not ask it, the service stays the one arbiter of the climb)
        // ARENA4b: its fighter's vitality is the relay's, off the token's signed character level (`cl`); the word's `lv`
        // stands only for a token from a service before it, held to the tier's cap, and its `mh` is read by nothing
        // (net/arena/arenaLaw.js ladderVitality - AUDIT PRE-MERGE 1003 S2: the signed level held to the same cap)
        if (m.r !== 'f' || m.tier === undefined) { this._arenaSend(ws, { k: 'no', m: 'no bout' }); return; }
        // AUDIT ARENA-LADDER: AND ONLY FOR AN ATTEMPT'S TICKET - the account service's (server-account/src/arena.js
        // arenaAttempt), signed into the receipt (`z`): the service keys the bout's row by it and counts an attempt never
        // claimed as a loss, so a ladder bout lost is lost whether or not its receipt is carried
        // AUDIT ARENA-LADDER 2: every ladder `in` of a site at world169 or later carries its ticket, so one without is an older
        // build's - answered with a word that build ends its bout on ('no bout'), never one it would only print and stand in
        if (typeof m.z !== 'string') { this._arenaSend(ws, { k: 'no', m: 'no bout' }); return; }
        st = this._bout = openBout({ o: arenaBoutIdOf(a.key), kind: 'pve', f: [{ sub: a.sub, name: a.name, lv: m.lv ?? a.lv ?? 1, cl: a.cl ?? null, title: a.title ?? null, banner: m.b ?? null, tk: m.z }], tier: m.tier, bout: m.bout, now });   // ARENA4b: `banner` the word's claim, billed on the list to watch
        await this._boutTellHall(st);
      } else if (boutFinished(st) && (exRoom || fighterOfSub(st, a.sub))) {
        // ARENA4b: a finished exhibition is kept for its verdict (ARENA_EX_KEEP_MS): an `in` is answered with the whole
        // bout, its result in it, and takes no seat - the stands are empty after the healers
        // AUDIT PRE-MERGE 1003 S5: AND A FINISHED BOUT'S OWN FIGHTER, BACK INSIDE ITS KEEP (ARENA_KEEP_MS "for a reconnect's
        // receipt"), is answered with it as theirs - the end and the result, and the receipt the room holds for them (a
        // casual bout's none): joinBout says `no bout` once the healers are past, ~9 s after the end, so a fighter whose
        // socket blinked at the last blow never heard the win the room kept ten minutes for them
        const me = exRoom ? null : fighterOfSub(st, a.sub);
        this._arenaSend(ws, stateWord(st, me?.id ?? ''));
        const r = me ? st.rc?.[a.sub] : null;
        if (r) this._arenaSend(ws, { k: 'rc', r });
        return;
      }
      const before = st.phase;
      const cur = this._attach(ws);
      // AUDIT PRE-MERGE 1003 S1: A SEAT IS A SOCKET'S ONCE - joinBout counts a seat at every `in` it is asked, so a socket
      // already in the stands asking again is answered with the bout and takes no second: one socket's sixty `in`s held
      // all sixty seats of the hour's exhibition (and its close gave back one - 59 phantom seats, the bout blank to the realm)
      const again = m.r === 's' && !!cur.asp && !fighterOfSub(st, a.sub);
      const j = again ? { role: 's' } : joinBout(st, a.sub, m.r, now);
      if (j.no) { this._arenaSend(ws, { k: 'no', m: j.no }); return; }
      if (j.role === 'f') {
        this._setAttach(ws, { ...cur, af: 1, afid: j.id, asp: 0 });
        // HOTFIX 1003f: the fighter's body was said at its hello (a session's member's at its join) as every body on the
        // floor is - its `in` says nothing new (ARENA4 said it here, its hello having said nothing)
        // ARENA6: a session's fighter comes from the stands to its mark (its client stands it there) - the mark is its
        // place, never the terrace its socket last said (net/arena/arenaBrain.js seatOnMark); a fighter back mid-fight keeps its own
        if (!(st.priv && seatOnMark(st, j.id, now)) && cur.pose) poseOf(st, j.id, cur.pose.x, cur.pose.z, now);
      } else if (!cur.asp) {
        this._setAttach(ws, { ...cur, asp: 1 });
        this._boutFan([{ k: 'sp', n: st.spectators }]);
        if (now - (this._boutHallAt ?? 0) >= ARENA_LIVE_TELL_MS) { this._boutHallAt = now; await this._boutTellHall(st); }
      }
      if (before === 'wait' && st.phase === 'law') this._boutFanState(st);
      else this._arenaSend(ws, stateWord(st, j.role === 'f' ? j.id : ''));
      if (st.ai.length) for (const w of aiWords(st, now)) this._arenaSend(ws, w);
      if (st.b) this._arenaSend(ws, hpWord(st));
      const r = st.rc?.[a.sub];
      if (r && j.role === 'f') this._arenaSend(ws, { k: 'rc', r });   // a reconnect after the end: its receipt again
      await this._boutSave(now, !again);   // AUDIT PRE-MERGE 1003b R-f: a seat asked again changed nothing - never a forced write a word
      if (!boutFinished(st)) await this._boutArm(now);
      return;
    }
    if (!st) { this._junk(ws); return; }
    const cur = this._attach(ws);
    if (m.k === 'hit') {
      if (!cur.af || !cur.afid) { this._junk(ws); return; }
      // the striker's place is its last good pose, as its pose frames said it (_message's pose arm) - never re-stamped
      // here, or a stale place would read as fresh and the next real move as a run too fast to believe
      const r = refBlow(st, cur.afid, m, now, cur.wa ?? null);   // INT7: the striker's signed arms, off this room's own token
      this._boutFan(r.words);
      return;
    }
    if (m.k === 'yd') {
      if (!cur.af || !cur.afid) { this._junk(ws); return; }
      const r = yieldOf(st, cur.afid, now);
      this._boutFan(r.words);
      if (r.no === 'early') this._arenaSend(ws, { k: 'no', m: 'early' });
      return;
    }
    if (m.k === 'ch') {
      if (!cur.asp) { this._junk(ws); return; }
      const w = cheerOf(st, cur.id, m.c, now);
      if (w) this._boutFan([w]);
      return;
    }
    if (m.k === 'out') return;   // the socket's close says the rest
    this._junk(ws);
  }
  /** A socket left an arena room: out of the hall's queue and its offer; off the sand (a fighter gone - a forfeit if it
   *  stays gone) or out of the stands. */
  async _arenaLeave(ws, a, now) {
    if (isArenaHall(a.key)) {
      if (this._arenaSocketsOf(a.sub).some((w) => w !== ws)) return;   // another tab of the account still in the hall
      const H = await this._hallOf();
      const f = H.offers.find((x) => x.a.sub === a.sub || x.b.sub === a.sub);
      const was = H.q.length;
      H.q = H.q.filter((x) => x.sub !== a.sub);
      if (f) await this._hallDecline(H, f, a.sub, now);
      if (f || was !== H.q.length) await this._hallSave();
      return;
    }
    // ARENA6: a private session's member gone - its place kept (it comes back to it), and its host's absence stamped: the
    // session ends ARENA_PRIVATE_HOST_GONE_MS after unless they come back (_arenaTick)
    const S = isArenaPrivateRoom(a.key) ? await this._sessionOf() : null;
    // AUDIT PRE-MERGE 1003b R6/S2: the bout read before the session is fanned - a room woken whose first word was a
    // member's close fanned `this._bout` unread (undefined): every member told no bout stood, and both fighters' screens
    // stood themselves back in the stands while the relay fought on
    const st = await this._boutOf();
    if (S && S.members[a.sub] && !this._arenaSocketsOf(a.sub).some((w) => w !== ws)) {
      S.members[a.sub].seen = now;
      if (a.sub === S.host) S.hostGoneAt = now;
      await this._sessionSave();
      if (a.sub === S.host) await this._sessionArm(S, now);
      this._sessionFan(S, ws);
    }
    if (!st) return;
    if (a.af && fighterOfSub(st, a.sub)) {
      if (!this._arenaSocketsOf(a.sub).some((w) => w !== ws)) { fighterGone(st, a.sub, now); await this._boutSave(now, true); }
    } else if (a.asp) {
      leaveSeat(st);
      this._boutFan([{ k: 'sp', n: st.spectators }]);
      if (now - (this._boutHallAt ?? 0) >= ARENA_LIVE_TELL_MS) { this._boutHallAt = now; await this._boutTellHall(st); }
    }
  }
  /** THE ARENA'S ALARM: a bout's beat (the law, the referee's clock, the AI fighters, the end's receipts, the hall told)
   *  or the hall's. False when this object holds neither. */
  async _arenaTick() {
    const now = Date.now();
    if (this._hall !== undefined || (await this.state.storage.get('arenahall'))) { await this._hallTick(now); return true; }
    // ARENA6: A PRIVATE SESSION'S ROOM - its clock first (its host gone too long, its life out: it ends, every member
    // told), then its bout's beat as any bout's, and with no bout its alarm is its clock's next end
    const S = await this._sessionOf();
    if (S && privateSessionOver(S, now)) { await this._sessionEnd(S, 'ended'); return true; }
    const st = await this._boutOf();
    if (!st) { if (!S) return false; await this._sessionArm(S, now); return true; }
    /** How long a finished bout's room keeps it: ARENA_KEEP_MS for a reconnect's receipt (ARENA4b: an exhibition
     *  ARENA_EX_KEEP_MS, a game day, for a bookmaker's verdict; ARENA6: a session's ARENA_PRIVATE_KEEP_MS - it owes no
     *  receipt, and its session is back to choosing). */
    const keep = st.kind === 'ex' ? ARENA_EX_KEEP_MS : st.priv ? ARENA_PRIVATE_KEEP_MS : ARENA_KEEP_MS;
    // AUDIT PRE-MERGE 1003b R7: a session's keep runs from the healers' end (`doneAt`, the bout's first finished beat), as
    // its record says - counted from the result (`endAt`), the healers' seven seconds had spent it before it began
    const keptFrom = (b) => (b.priv ? b.doneAt ?? b.endAt ?? b.at : b.endAt || b.at);
    if (boutFinished(st) && st.toldDone) {
      // the bout is over and said: kept, then forgotten (ARENA6: a session's, cleared - its fighters back in the stands)
      if (now >= keptFrom(st) + keep) {
        if (S) { await this._sessionClear(S, now); return true; }
        this._bout = null; await this.state.storage.delete('arenabout'); return true;
      }
      await this.state.storage.setAlarm(keptFrom(st) + keep);
      return true;
    }
    const ph = st.phase === 'law' ? st.b?.phase : st.phase;
    let words = [];
    try { words = stepBout(st, now, rand01); } catch (e) { console.warn('[arena] beat failed', e?.message ?? e); }
    const ph2 = st.phase === 'law' ? st.b?.phase : st.phase;
    // the AI's blows go to everyone (the stands see them land); the struck player's own game applies its own (`to`)
    this._boutFan(words);
    if (ph2 !== ph) this._boutFanState(st);
    if (st.owed?.length) {
      const key = await this._receiptKeyOf();
      const nowS = Math.floor(now / 1000);
      st.rc = st.rc ?? {};
      for (const w of st.owed) {
        try {
          const r = await mintArenaReceipt(w, key, { subtle: crypto.subtle, nowS });
          for (const sub of w.a === 'p' ? w.f : [w.s]) st.rc[sub] = r;
        } catch (e) { console.warn('[arena] receipt refused', e?.message ?? e); }
      }
      st.owed = [];
      await this._boutSave(now, true);
      for (const [ws, b] of [...this._all()]) { const r = b.id && b.af ? st.rc[b.sub] : null; if (r) this._arenaSend(ws, { k: 'rc', r }); }
    }
    // ARENA6: a session's bout with a result - kept in its recent results once, and every member told
    if (S && st.priv && st.res && !st.histed) { st.histed = true; sessionHist(S, st, now); await this._sessionSave(); this._sessionFan(S); }
    if (boutFinished(st)) {
      st.endAt = Number.isFinite(st.endAt) ? st.endAt : now;
      st.doneAt = Number.isFinite(st.doneAt) ? st.doneAt : now;   // AUDIT PRE-MERGE 1003b R7
      if (!st.toldDone && (await this._boutTellHall(st, true))) st.toldDone = true;
      await this._boutSave(now, true);
      await this.state.storage.setAlarm(st.toldDone ? keptFrom(st) + keep : now + 1000);   // ARENA4b: an exhibition's verdict kept a game day (ARENA6: a session's bout a moment)
      return true;
    }
    await this._boutSave(now);
    await this.state.storage.setAlarm(now + ARENA_TICK_MS);
    return true;
  }

  // ───────────────────────────── ARENA6: A PRIVATE SESSION ─────────────────────────────
  // The owner, 2026-10-03: "a way to simply host private matches ... a session where people can join, watch,
  // participate, and allow the host of the session to choose who is fighting and who is in the crowd". The room
  // `arena:p<code>` keeps one session beside its bout (`arenasession` - net/arena/arenaBrain.js openSession's shape): a
  // registered account opens it and hosts it, anyone joins it (a guest to watch), the host picks the Red and the Blue
  // among the members here and registered and calls the bout - the casual players' bout, refereed by PVP-REF, every
  // fighter equally whole, no receipt, never on the hall's list - and the session keeps its last results. Every member
  // is told the whole session (`pss`) at each change. Design: bible/11-Multiplayer/Arena.md, the ARENA6 record.
  async _sessionOf() {
    if (this._session === undefined) { const v = await this.state.storage.get('arenasession'); this._session = v && typeof v === 'object' ? v : null; }
    return this._session;
  }
  async _sessionSave() {
    if (this._session) await this.state.storage.put('arenasession', this._session);
    else await this.state.storage.delete('arenasession');
  }
  /** The session's clock armed: its next end (its life, its host's absence) - never later than an alarm already set. */
  async _sessionArm(S, now) {
    const at = Math.max(now + 1000, privateSessionDeadline(S));
    const cur = await this.state.storage.getAlarm();
    if (cur == null || cur > at) await this.state.storage.setAlarm(at);
  }
  /** Is an account here - a hello'd socket of it in the room (`gone` the one leaving, not counted). AUDIT PRE-MERGE 1003b
   *  R1: the room's sockets listed ONCE, as a set of the accounts here - asked per member per recipient, a fan to sixty
   *  members listed the room 3,600 times, and half a join's time was this. */
  _sessionHere(gone = null) {
    const at = new Set();
    for (const [w, b] of this._all()) if (w !== gone && b.id && b.sub) at.add(b.sub);
    return (sub) => at.has(sub);
  }
  /** The session told to every member here, each its own word (net/arena/arenaBrain.js sessionWord). AUDIT PRE-MERGE 1003b R1:
   *  with `ask` (the socket whose join this answers), a session nobody else would see changed - the host's own word the
   *  same as the last fanned - is said to `ask` alone: a member's join repeated at the arena gate's sixteen a second
   *  fanned the whole session to every member each time (1.9 MB a second at sixty-two). */
  _sessionFan(S, gone = null, ask = null) {
    const here = this._sessionHere(gone);
    const st = this._bout ?? null;
    const sig = JSON.stringify(sessionWord(S, S.host, here, st));
    if (ask && sig === this._sessionSig) { this._arenaSend(ask, sessionWord(S, this._attach(ask)?.sub, here, st)); return; }
    this._sessionSig = sig;
    for (const [ws, b] of [...this._all()]) if (ws !== gone && b.id && S.members[b.sub]) this._arenaSend(ws, sessionWord(S, b.sub, here, st));
  }
  /** AUDIT PRE-MERGE 1003b R4: A SOCKET MADE A MEMBER IS SHOWN THE FLOOR, as the welcome shows a member's (its hello, a
   *  stranger's then, drew nobody). Once a socket. HOTFIX 1003f: every member here - the stands as the sand - shown to it,
   *  and it to each of them (it showed the fighters alone, and a joiner stood in an empty arena, seen by nobody). */
  async _sessionShow(ws) {
    const cur = this._attach(ws);
    if (!cur || cur.shown) return;
    this._setAttach(ws, { ...cur, shown: 1 });
    const S = await this._sessionOf();
    const lookOf = async (id) => this._looks.get(id) ?? (await this.state.storage.get(lookKey(id))) ?? null;
    const mine = JSON.stringify(badged({ t: 'join', id: cur.id, name: cur.name, look: await lookOf(cur.id), pose: cur.pose }, cur));
    for (const [other, b] of [...this._all()]) {
      if (other === ws || !b.id || !S?.members?.[b.sub]) continue;
      this._send(ws, JSON.stringify(badged({ t: 'join', id: b.id, name: b.name, look: await lookOf(b.id), pose: b.pose }, b)));
      this._send(other, mine);
    }
  }
  /** HOTFIX 1003f: THE SESSION OVER, ITS FLOOR DRAWS NOBODY - every socket it showed said gone to every other screen and
   *  shown again only by a next session's join (`_sessionShow`), so no ghost stands on a screen that stays. */
  _sessionUnshow() {
    for (const [ws, b] of [...this._all()]) {
      if (!b.id || !b.shown) continue;
      const out = JSON.stringify({ t: 'leave', id: b.id });
      for (const [o2, b2] of [...this._all()]) if (o2 !== ws && b2.id) this._send(o2, out);
      this._setAttach(ws, { ...b, shown: 0 });
    }
  }
  /** AUDIT PRE-MERGE 1003b R2: whether an account has its own place on this floor - a private session's member, a bout's
   *  fighter: its hello waits on itself alone, never on the stands' bucket. */
  async _floorOwn(key, sub) {
    if (!sub) return false;
    if (isArenaPrivateRoom(key)) return !!(await this._sessionOf())?.members?.[sub];
    const st = await this._boutOf();
    return !!st && !!fighterOfSub(st, sub);
  }
  /** A word to every member's socket here (a refusal or an end said to all). */
  _sessionSay(S, w) { for (const [ws, b] of [...this._all()]) if (b.id && S.members[b.sub]) this._arenaSend(ws, w); }
  /** THE BOUT LET GO: every socket off the sand and out of the stands, the bout forgotten. HOTFIX 1003f: a fighter's body
   *  stays on the members' screens - a body in the stands again, drawn as every member is (its client walks it up). */
  async _sessionDropBout() {
    for (const [ws, b] of [...this._all()]) {
      if (!b.id) continue;
      if (b.af || b.asp || b.afid) this._setAttach(ws, { ...b, af: 0, afid: null, asp: 0 });
    }
    this._bout = null;
    await this.state.storage.delete('arenabout');
  }
  /** The session's bout cleared (its keep past, or voided by its host): the session back to choosing, every member told. */
  async _sessionClear(S, now) {
    await this._sessionDropBout();
    S.bout = null;
    await this._sessionSave();
    this._sessionFan(S);
    await this._sessionArm(S, now);
  }
  /** THE SESSION ENDS - closed by its host (`closed`) or by its clock (`ended`): every member told, its bout and its
   *  record gone. Each member's screen leaves the room (the floor's instance) on the word. */
  async _sessionEnd(S, why) {
    this._sessionSay(S, { k: 'no', m: why });
    this._sessionUnshow();   // HOTFIX 1003f
    await this._sessionDropBout();
    this._session = null;
    await this._sessionSave();
  }
  /**
   * ONE SESSION WORD (`ps`): `open` - the first registered account's opens it and hosts it (a guest's is refused; the host
   * back re-opens nothing, it is the host again); `join` - a member, or a newcomer while it has room (a removed account
   * refused); and the host's alone: `pick` the Red and the Blue, `go` their bout, `void` it with no result, `kick` a member
   * for the session's life, `close` it. A refusal is a `no` to the asker; every change is every member's `pss`.
   */
  async _sessionWord(ws, a, m, now) {
    let S = await this._sessionOf();
    const sub = a.sub;
    const no = (w) => { this._arenaSend(ws, { k: 'no', m: w }); };
    const here = this._sessionHere();
    const st = await this._boutOf();
    const standing = !!st && !boutFinished(st);
    if (!this._sessionJoinBy) this._sessionJoinBy = new Map();   // AUDIT PRE-MERGE 1003b R1: a member's join budget, by account
    if (m.a === 'open' || m.a === 'join') {
      if (m.a === 'open' && !S) {
        if (!a.lk) { no('host guest'); return; }   // the host is a registered account
        S = this._session = openSession({ code: arenaPrivateCodeOf(a.key), host: { sub, name: a.name, title: a.title ?? null, banner: m.bn ?? null }, now });
        await this._sessionSave();
        await this._sessionArm(S, now);
        this._sessionFan(S);
        await this._sessionShow(ws);
        return;
      }
      if (!S) { no('no session'); return; }
      if (m.a === 'open' && S.host !== sub) { no('taken'); return; }
      // AUDIT PRE-MERGE 1003b R1/S3: A MEMBER'S JOIN IS NO MEGAPHONE. Each was a write and the whole session fanned to
      // every member, at the arena gate's sixteen words a second - a guest in the stands could flood sixty-two screens.
      // A member's changes (its banner, say) are taken ARENA_PRIVATE_JOIN_HZ a second (the bucket's two at once); past
      // that its join is answered to it alone, unchanged. A join that changes nothing is written nowhere, and said to the
      // asker alone (_sessionFan's `ask`)
      const prev = S.members[sub] ? { ...S.members[sub] } : null;
      if (prev) {
        const budget = tokenGate(this._sessionJoinBy.get(sub), now, ARENA_PRIVATE_JOIN_HZ, 2);
        this._sessionJoinBy.delete(sub);
        if (this._sessionJoinBy.size >= SOCKETS_MAX) this._sessionJoinBy.delete(this._sessionJoinBy.keys().next().value);
        this._sessionJoinBy.set(sub, budget.bucket);
        if (!budget.pass) { this._arenaSend(ws, sessionWord(S, sub, here, st)); await this._sessionShow(ws); return; }
      }
      const goneWas = S.hostGoneAt;
      const j = sessionJoin(S, { sub, name: a.name, guest: !a.lk, title: a.title ?? null, banner: m.bn ?? null }, now, here, st ? st.f.map((x) => x.sub) : []);
      if (j.no) { no(j.no); return; }
      const me = S.members[sub];
      const same = !!prev && prev.name === me.name && prev.guest === me.guest && prev.title === me.title && prev.banner === me.banner && goneWas === S.hostGoneAt;
      if (!same) await this._sessionSave();
      this._sessionFan(S, null, ws);
      await this._sessionShow(ws);
      return;
    }
    if (!S) { no('no session'); return; }
    if (S.host !== sub) { no(S.members[sub] ? 'host only' : S.kicked.includes(sub) ? 'removed' : 'not member'); return; }
    // AUDIT PRE-MERGE 1003b R8/S1: a bout is "ended with no result" only while it has none - once its result is in (the
    // verdict, the healers, the keep) a void or a fighter removed was said as "no result" to everyone while the session's
    // results kept the win
    const open = !!st && !st.res && !boutFinished(st);
    if (m.a === 'lock') {
      // AUDIT PRE-MERGE 1003b S4: THE HOST'S LOCK - a removal is the account's, and a guest account is one press away, so
      // the host keeps newcomers out (a member coming back is always let in)
      S.locked = m.l === 1;
      await this._sessionSave();
      this._sessionFan(S);
      return;
    }
    if (m.a === 'pick') {
      const r = sessionPick(S, { r: m.r, b: m.b }, here, standing);
      if (r.no) { no(r.no); return; }
      await this._sessionSave();
      this._sessionFan(S);
      return;
    }
    if (m.a === 'go') {
      const g = sessionGoFighters(S, here, !!st);   // a bout still in its keep stands too: the next waits for the stands to clear
      if (g.no) { no(g.no); return; }
      // THE SESSION'S BOUT: the casual players' bout (no receipt, no rating, nothing kept by the realm), every fighter
      // ARENA_PRIVATE_VITALITY whole (the owner's call: equal health), never on the hall's list (`priv`)
      const o = arenaId();
      this._bout = openBout({ o, kind: 'pvp', f: /** @type {any[]} */ (g.f), casual: true, equal: true, priv: true, now });
      S.bout = o;
      await this._boutSave(now, true);
      await this._sessionSave();
      await this._boutArm(now);
      this._sessionFan(S);
      return;
    }
    if (m.a === 'void') {
      if (!open) { no(st && !boutFinished(st) ? 'has result' : 'no bout'); return; }   // its own word: a bout's `no bout` is its end on a screen
      this._sessionSay(S, { k: 'no', m: 'voided' });
      await this._sessionClear(S, now);
      return;
    }
    if (m.a === 'kick') {
      const k = sessionKick(S, m.m);
      if (k.no) { no(k.no); return; }
      // out of its bout first: a fighter's bout void (nothing kept - said only while it has no result), a seat in the stands
      // given back
      if (st && st.f.some((x) => x.sub === k.sub) && open) this._sessionSay(S, { k: 'no', m: 'voided' });
      let seats = 0;
      for (const [w, b] of [...this._all()]) {
        if (!b.id || b.sub !== k.sub) continue;
        // AUDIT PRE-MERGE 1003b R3/S8: a fighter's body said gone to every other screen first - its `af` cleared below, and
        // the removed one stood on the sand on every screen until its socket closed; HOTFIX 1003f: a member's in the stands
        // too (`shown` cleared below - it is drawn to nobody now, and sees nobody)
        if (b.af || b.shown) { const out = JSON.stringify({ t: 'leave', id: b.id }); for (const [o2, b2] of [...this._all()]) if (o2 !== w && b2.id) this._send(o2, out); }
        // TOLD, AND TAKEN OUT OF THE BOUT - never closed by the relay: a close here is the presence session's whole socket
        // (net/online.js reads a policy close as final - the player offline, not just out of the session); the screen
        // leaves the room on the word, and every word of its after this is refused (`removed`)
        this._arenaSend(w, { k: 'no', m: 'removed' });
        if (b.asp && st) { leaveSeat(st); seats++; }
        if (b.af || b.asp || b.afid || b.shown) this._setAttach(w, { ...b, af: 0, afid: null, asp: 0, shown: 0 });
      }
      if (seats && st) this._boutFan([{ k: 'sp', n: st.spectators }]);
      if (st && st.f.some((x) => x.sub === k.sub)) { await this._sessionClear(S, now); return; }
      await this._sessionSave();
      this._sessionFan(S);
      return;
    }
    if (m.a === 'close') { await this._sessionEnd(S, 'closed'); return; }
    this._junk(ws);
  }

  // ───────────────────────────── PVP-REF: A SIEGE'S ROOM ─────────────────────────────
  // Seats-Arc 6.1: the relay holds every fighter's vitality and judges every blow, cast and step (net/siege/siegeRef.js). The
  // fighters are kept by ACCOUNT (one seat an account, the gate's law), checkpointed as the gate's fight is.
  /** The room's fighters, by account - the instance's while it is awake, storage's after a wake. */
  async _siegeOf() {
    if (this._siege === undefined) {
      const v = await this.state.storage.get('siege'); this._siege = v && typeof v === 'object' ? v : null;
      // A fighter's kept step lives in memory between checkpoints; its socket's attachment, which the runtime keeps across
      // a wake, holds the newest. A woken room takes each fighter's pose from it, or it judges reach from the checkpoint
      // and pulls the fighter back (the merge with WB12: the test Room now copies storage as the runtime does)
      if (this._siege?.fighters) {
        for (const [sub, f] of Object.entries(this._siege.fighters)) {
          const pose = this._siegeSocketOf(sub)?.[1].pose;
          if (f && pose) f.pose = pose;
        }
      }
    }
    return this._siege;
  }
  async _siegeSave(now, force) {
    if (!this._siege || (!force && now - this._siegeSavedAt < CHECKPOINT_MS)) return;
    this._siegeSavedAt = now;
    await this.state.storage.put('siege', this._siege);
  }
  /** The newest socket an account speaks through here, and its attachment. */
  _siegeSocketOf(sub) {
    let best = null;
    for (const [ws, b] of this._all()) if (b.id && b.sub === sub && (!best || (b.since ?? 0) >= (best[1].since ?? 0))) best = [ws, b];
    return best;
  }
  /** AUDIT SEATS-3 B4: every account's newest socket here and its attachment (`_siegeSocketOf`'s rule), in ONE pass over
   *  the sockets - a roll call asked it once per fighter, fighters x sockets for every `in`. */
  _siegeSockets() {
    const out = new Map();
    for (const [ws, b] of this._all()) if (b.id && b.sub) { const best = out.get(b.sub); if (!best || (b.since ?? 0) >= (best[1].since ?? 0)) out.set(b.sub, [ws, b]); }
    return out;
  }
  /** AUDIT-SEATS T2: an attachment as a battle room tells it to others - a fighter's as it is, anyone else's (a spectator, a
   *  fighter before its `in`) standing nowhere (`pose` null: no body drawn - Seats-Arc 6.6). Any other room's as it is. */
  _drawn(b, key) {
    return !isBattleRoom(key) || this._siege?.fighters?.[b.sub] ? b : { ...b, pose: null };
  }
  /** AUDIT PLAN-1000 B2: THE ROOM'S HELLO RATE - one answer for every door that spends its bucket (`_hellos`): a channel's
   *  CHAT_HELLO_HZ_MAX, a gate's court's (and its copies') GATE_HELLO_HZ_MAX, every other room's HELLO_HZ_MAX (a battle room's stands too: _battleHelloGate). A door that
   *  asked another rate of the same bucket clamped it to its own (tokenGate caps a bucket at the rate asked): one change
   *  of gear in a court cut its door from 48 to 10. */
  _helloHz(key) { return isChatRoom(key) ? CHAT_HELLO_HZ_MAX : isGateRoom(key) ? GATE_HELLO_HZ_MAX : HELLO_HZ_MAX; }
  /**
   * AUDIT-SEATS R3: A BATTLE ROOM'S HELLO GATE, spent only once the hello's token and pass are verified (the hello's own
   * note says why), BY ACCOUNT: each its own HELLO_HZ_MAX a second - an account's reconnect loop waits on itself alone -
   * and the stands besides on the room's stored bucket (sixty spectators' hellos bounded together as a room's were); a
   * fighter never waits on the stands. `{ pass, bucket }` - `bucket` the room's, where it was spent.
   */
  async _battleHelloGate(sub, side, now) {
    const own = tokenGate(this._helloBy.get(sub), now, HELLO_HZ_MAX);
    this._helloBy.delete(sub);
    if (this._helloBy.size >= SOCKETS_MAX) this._helloBy.delete(this._helloBy.keys().next().value);   // the stalest account's goes first
    this._helloBy.set(sub, own.bucket);
    if (!own.pass) return { pass: false };
    if (side !== 'watch') return { pass: true };
    const stands = tokenGate(this._hellos, now, HELLO_HZ_MAX);   // SCALE2b: the room's hello bucket, in memory
    this._hellos = stands.bucket;
    return { pass: stands.pass, bucket: stands.bucket };
  }
  /**
   * AUDIT-SEATS T3/R5: WHETHER THE ROOM HAS ROOM FOR A NEW FIGHTER'S RECORD - a refusal's words, or null. A sided fighter:
   * a place free on its side (siegePlaceFree - a fighter gone keeps its own SIEGE_PLACE_KEPT_MS, then a substitute may take
   * it) and the field's records (SIEGE_FIGHTERS_MAX); a Royal Tourney's contender: the contenders IN the room, the records
   * of the gone who hold nothing pruned first (royalPrune - the bound was a count of records never deleted, a week's);
   * anyone else (PVP-REF's ground) the field's records.
   */
  _siegeRoomFor(s, sub, side, now) {
    const here = (x) => !!this._siegeSocketOf(x);
    if (side === 'duel') {
      if (s.battle) royalPrune(s.battle, s.fighters, here);
      let n = 0;
      for (const [, b] of this._all()) if (b.id && b.sd === 'duel' && b.sub !== sub) n++;
      return n >= SIEGE_FIGHTERS_MAX ? 'the field is full' : null;
    }
    if ((side === 'attack' || side === 'defend') && s.battle && !siegePlaceFree(s.fighters, side, s.battle.tier, here, now, sub)) return 'the field is full';
    return Object.keys(s.fighters).length >= SIEGE_FIGHTERS_MAX ? 'the field is full' : null;
  }
  /** AUDIT-SEATS T3: an account's last socket gone from the room - its fighter's leave stamped (`goneAt`): its place kept
   *  SIEGE_PLACE_KEPT_MS from now, its `in` on return at its camp with the next wave. Another socket still speaking for
   *  the account (a reconnect that replaced this one) is no leave. */
  async _siegeGone(ws, sub, now) {
    const s = await this._siegeOf(), f = s?.fighters?.[sub];
    if (!f) return;
    for (const [other, b] of this._all()) if (other !== ws && b.id && b.sub === sub && !this._gone.has(other) && !this._dead.has(other)) return;
    f.goneAt = now;
    await this._siegeSave(now, true);
  }
  /** Frames to everyone in the room. */
  _siegeFan(frames) {
    if (!frames.length) return;
    this._fanFrames(frames.map((fr) => JSON.stringify({ t: 'siege', ...fr })), (b) => b.id);   // SCALE5b: a beat one frame to the second wire
  }
  /** The next fall's wave armed, unless an earlier alarm stands. */
  async _siegeArm(at) {
    const was = await this.state.storage.getAlarm();
    if (was == null || was > at) await this.state.storage.setAlarm(at);
  }
  /** SEAT2a: WHO A SIEGE'S ROOM ADMITS (Seats-Arc 6.2, 6.4, 6.6) - `{ side }` or `{ no }`. Without a pass, a developer,
   *  while the room holds no battle (PVP-REF's ground, unsided). With one: the service's signature over this account
   *  (never another's pass), this room's seat and week, inside the battle's door (SIEGE_OPENS_MS before its start to its
   *  window's close); a fighter on the side it signed (a fighter is always a fighter - never back as a spectator), the
   *  field's room permitting; a spectator, the stands' sixty permitting. The first pass names the battle - its kind,
   *  tier, start and field - and every later one must say the same. */
  async _siegeAdmit(key, who, sp, now) {
    const s = await this._siegeOf();
    if (!sp) return who.subject && Array.isArray(who.glyphs) && who.glyphs.includes('dev') && !s?.battle ? { side: null } : { no: 'the siege is not open' };
    if (!who.subject || !this._verifyKey) return { no: 'the siege is not open' };
    const r = await verifyOrder(sp, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'siege' });
    if (!r.ok) return { no: 'that pass will not do' };
    const c = r.claims, room = battleOfRoom(key);
    if (c.s !== who.subject || !room || c.sk !== room.key || c.sw !== room.week) return { no: 'that pass is for another battle' };
    if ((room.kind === 'royal') !== (c.sn === 'royal')) return { no: 'that pass is for another battle' };   // CROWN1 part two: a Royal Tourney's pass to its own room alone
    if (now < c.sb * 1000 - SIEGE_OPENS_MS) return { no: 'the siege is not open' };
    const of = { sk: c.sk, sw: c.sw, sn: c.sn, st: c.st, sb: c.sb, se: c.se, sf: JSON.stringify(c.sf), sx: JSON.stringify(c.sx ?? null) };   // SEAT2b part two (b): and its works
    if (s?.of && Object.keys(of).some((k) => s.of[k] !== of[k])) return { no: 'that pass is for another battle' };
    const mine = s?.fighters?.[who.subject];
    // AUDIT-SEATS R6: PAST THE WINDOW'S CLOSE, A FIGHTER COMES FOR ITS RECEIPT. The door shut at `se` for everyone, and the
    // service's pass with it - so a crown fighter who dropped at minute 40 and came back at minute 70 never had the `s1`
    // the room kept "a week for a fighter who returns" (its Marks, its Renown, its Spoils). Now the service signs a
    // rostered fighter's pass until the receipt's week is out (server-account/src/seatSiege.js siegePass), and the room
    // admits it past `se` ONLY where the battle is over and holds this account's receipt, on the side it fought - its
    // `in` hands the receipt over; nothing lands after the end (`_siegeFrame`). Anyone else is refused as before.
    if (now >= c.se * 1000) return s?.battle?.result && s.receipts?.[who.subject] && mine?.side === c.sd ? { side: c.sd } : { no: 'the siege is not open' };
    if (c.sd === 'watch') {
      if (mine?.side) return { no: 'a fighter is always a fighter' };
      let watching = 0;
      for (const [, b] of this._all()) if (b.id && b.sd === 'watch' && b.sub !== who.subject) watching++;
      if (watching >= SIEGE_SPECTATORS_MAX) return { no: 'the stands are full' };
    } else if (mine) {
      if (mine.side !== c.sd) return { no: 'that pass is for another side' };
      // AUDIT-SEATS T3: a fighter back after its five minutes has a place only where its side has one free (a substitute
      // may have taken it); inside them, its own is kept (siegePlaceFree counts every place but the asker's)
      // AUDIT SEATS-3 B5: after the result, a fighter the room holds a receipt for comes for it - its place is nothing now
      if (s.battle && !(s.battle.result && s.receipts?.[who.subject]) && (c.sd === 'attack' || c.sd === 'defend') && !siegePlaceFree(s.fighters, c.sd, s.battle.tier, (x) => !!this._siegeSocketOf(x), now, who.subject)) return { no: 'your place was taken' };
      // AUDIT SEATS-3 B3: a contender back is counted with the contenders in the room as a new one is - this branch skipped
      // the count, so a 49th came in and the roll call's 49 rows were more than a client reads (wire.js SIEGE_ROLL_MAX)
      if (c.sd === 'duel') { const no = this._siegeRoomFor(s, who.subject, c.sd, now); if (no) return { no }; }
      // AUDIT SEATS-3 B2: BACK FROM A DROP AT THE DOOR, not at its `in` - a reconnect that never said `in` stood where it
      // dropped, struck and was struck there. Put at its camp and down until its side's wave here (siegeReturn, the `in`
      // arm's law below); its leave's stamp kept for that `in` (the camp said to it) - or for a hello refused after this
      if (s.battle && !s.battle.result && (mine.side === 'attack' || mine.side === 'defend') && Number.isFinite(mine.goneAt)) {
        const gone = mine.goneAt;
        if (siegeReturn(s.battle, mine, now)) await this._siegeArm(mine.upAt);
        mine.goneAt = gone;
        await this._siegeSave(now, true);
      }
    } else if (s) { const no = this._siegeRoomFor(s, who.subject, c.sd, now); if (no) return { no }; }   // AUDIT-SEATS T3/R5: a side's places, a tourney's contenders in the room
    if (!s?.battle) {
      const field = fieldOf(c.sf, c.st, c.sn);
      const works = worksOf(c.sx, c.st, c.sn);   // SEAT2b part two (b): the works the service froze (orderValid read them well made)
      if (!field || !works) return { no: 'that pass will not do' };
      this._siege = { ...(s ?? { fighters: {} }), of, battle: newBattle({ kind: c.sn, tier: c.st, startMs: c.sb * 1000, endMs: c.se * 1000, field, works }) };
      await this._siegeSave(now, true);
      await this._siegeArm(c.sn === 'royal' ? royalNextBeat(this._siege.battle, now) : now + SIEGE_TICK_MS);   // CROWN1 part two: a tourney with no bout on wakes at its week's end
    }
    return { side: c.sd };
  }
  // ───────────────────────────── INT8: THE DUEL REFEREED (net/duel/duelRef.js) ─────────────────────────────
  /** The room's duels - in its memory alone (duelRef.js: a room that restarts mid-bout ends it as a cancel). */
  _duels() { return (this._duelRef ??= newDuelRef()); }
  /** A word to a bout's two fighters, each at its newest socket here - `word(side)` the frame for that side. */
  _duelSay(bout, word) {
    for (const x of [bout.a, bout.b]) {
      const sk = this._siegeSocketOf(x.sub);
      if (sk) this._send(sk[0], JSON.stringify(typeof word === 'function' ? word(x) : word));
    }
  }
  /** A START: the bout set on it (duelRef.js duelOpen), or its challenger told `no` and null. */
  _duelOpen(ws, a, tb, d, now) {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const n = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    const r = duelOpen(this._duels(), { a: { sub: a.sub, id: a.id, pose: a.pose, lv: a.lv }, b: { sub: tb.sub, id: tb.id, pose: tb.pose, lv: tb.lv }, s: d.s, c: d.c, n }, now);
    if (r.no) { this._send(ws, JSON.stringify({ t: 'dref', k: 'no', s: d.s, why: r.no })); return null; }
    return r.bout;
  }
  /** A STRIKE OR A SPELL of a fighter's: judged (duelRef.js duelBlow - the weapon its look holds, the arms its token
   *  signs), the vitality left said to both, a fall the bout's end. Outside a bout, nothing. */
  async _duelBlow(a, d, now) {
    const st = this._duelRef;
    const bout = st ? duelBoutOf(st, a.sub) : null;
    if (!bout) return;
    let look = null;
    if (d.k === 'strike') {
      look = this._looks.get(a.id) ?? null;
      if (!look) { look = (await this.state.storage.get(lookKey(a.id))) ?? null; if (look) this._looks.set(a.id, look); }
    }
    const r = d.k === 'spell' ? SIEGE_HIT.Spell : d.by === 'arrow' ? SIEGE_HIT.Shaft : SIEGE_HIT.Melee;
    const held = d.k === 'strike' ? siegeHeld(look, d.w ? d.w.t : -1, d.w ? d.w.m : 0) : null;
    const res = duelBlow(st, a.sub, d.to, { d: d.d, r, held, wa: a.wa ?? null }, now);
    if (!res.ok || !res.dealt) return;
    this._duelSay(bout, { t: 'dref', k: 'hp', s: bout.s, by: a.id, to: d.to, d: res.dealt, r, h: duelVitals(bout) });
    if (res.fell) await this._duelClose(duelEnd(st, bout, a.sub, 'fell'), now);
  }
  /** A fighter's own `end` or `cancel` naming its bout: the referee's (duelRef.js duelForfeit). False for any other - a
   *  handshake's cancel, routed as it always was. */
  async _duelForfeit(a, d, now) {
    const bout = this._duelRef ? duelBoutOf(this._duelRef, a.sub) : null;
    if (!bout || bout.s !== d.s) return false;
    const end = duelForfeit(this._duelRef, a.sub, d.why, now);
    if (end) await this._duelClose(end, now, bout);
    return true;
  }
  /** The room's bouts beaten (duelRef.js duelStep): the clock's draw, a walkover, a ring left. */
  async _duelBeat(now) {
    if (!this._duelRef?.bouts.size) return;
    const bouts = new Map(this._duelRef.bouts);
    for (const end of duelStep(this._duelRef, (sub) => !!this._siegeSocketOf(sub), now)) await this._duelClose(end, now, bouts.get(end.s));
  }
  /** A BOUT ENDED: said to both its fighters - its winner's id ('' for none), why, and for a bout won the relay's signed
   *  receipt (net/duel/duelReceipt.js `d1`; a room that cannot sign hands an unsigned one, which the service declines). */
  async _duelClose(end, now, bout = null) {
    let rc = null;
    if (end.w != null) {
      try { rc = await mintDuelReceipt({ f: end.f, w: end.w, n: end.n }, await this._receiptKeyOf(), { subtle: globalThis.crypto.subtle, nowS: Math.floor(now / 1000) }); } catch (e) { console.warn('[duel] receipt failed', e?.message ?? e); }
    }
    const word = { t: 'dref', k: 'end', s: end.s, w: end.w == null ? '' : end.ids[end.w], why: end.why, ...(rc ? { rc } : {}) };
    const sides = bout ?? { a: { sub: end.f[0] }, b: { sub: end.f[1] } };
    this._duelSay(sides, word);
  }
  /** A siege frame: `in` makes the account a fighter at its token's Renown and answers every fighter's vitality (SEAT2a:
   *  a sided fighter at its camp; a spectator the field alone; after the end, its receipt); a blow and a cast are judged
   *  on the striker's and the target's last good poses and the striker's look - SEAT2a: never a blow or a harmful cast on
   *  a side-mate, a heal on a side-mate alone, and nothing before the battle is joined or after it ends. */
  async _siegeFrame(ws, a, m, now) {
    const s = (await this._siegeOf()) ?? (this._siege = { fighters: {} });
    const b = s.battle ?? null;
    if (m.k === 'in') {
      // AUDIT SEATS-3 B4: answered once each SIEGE_IN_MS a socket - a client says it once a session, and sixty spectators
      // saying it at the siege gate's 8 Hz each rebuilt the roll call; a repeat inside it is nothing (no strike)
      const mt = this._meterOf(ws);
      if (Number.isFinite(mt.siegeInAt) && now - mt.siegeInAt < SIEGE_IN_MS) return;
      mt.siegeInAt = now;
      const mine = s.fighters[a.sub];
      if (a.sd !== 'watch' && !mine) {
        const side = a.sd === 'attack' || a.sd === 'defend' || a.sd === 'duel' ? a.sd : null;   // CROWN1 part two: a Royal Tourney's contender
        const full = this._siegeRoomFor(s, a.sub, side, now);   // AUDIT-SEATS T3/R5: a side's places, a tourney's contenders in the room, the field's records
        if (full) { this._send(ws, JSON.stringify({ t: 'siege', k: 'no', m: full })); return; }
        const camp = b && (side === 'attack' || side === 'defend');
        const pose = camp ? siegeCampPose(b, side, a.pose) : (a.pose ?? null);
        s.fighters[a.sub] = { ...newFighter(a.lv, now), side, pose, poseAt: now };
        if (camp) this._send(ws, JSON.stringify({ t: 'siege', k: 'back', p: pose }));
        await this._siegeSave(now, true);
      } else if (mine && Number.isFinite(mine.goneAt)) {
        // AUDIT-SEATS T3 (16: "they return at their camp with the next wave"): BACK FROM A DROP - at its camp, down until its
        // side's next wave (siegeReturn), so a drop is never a way out of a fall; after the end, its receipt and nothing more
        const waits = siegeReturn(b, mine, now);
        if (b && !b.result && (mine.side === 'attack' || mine.side === 'defend')) this._send(ws, JSON.stringify({ t: 'siege', k: 'back', p: mine.pose }));
        if (waits) await this._siegeArm(mine.upAt);
        await this._siegeSave(now, true);
      }
      const st = [];
      const socks = this._siegeSockets();   // AUDIT SEATS-3 B4: one pass over the sockets, not one a fighter
      for (const [sub, f] of Object.entries(s.fighters)) { const sk = socks.get(sub); if (sk) st.push([sk[1].id, f.hp, f.max, f.down ? 1 : 0, ...(f.side === 'attack' || f.side === 'defend' ? [f.side === 'attack' ? 1 : 2] : [])]); }   // SEAT2a: a sided fighter's side (1 attacking, 2 defending)
      this._send(ws, JSON.stringify({ t: 'siege', k: 'st', f: st }));
      if (b?.kind === 'royal') { this._royalSay(ws, s, b, a.sub); return; }   // CROWN1 part two: the ladder, the bout on, this contender's receipts - no banners
      if (b) this._send(ws, JSON.stringify({ t: 'siege', ...siegeFieldFrame(b, this._siegeCounts(s), now) }));   // CROWN1 part two: the ladder, the bout on, this contender's receipts   // SEAT2b part two (c): the relay's own fighters where they stand now
      if (b?.result) this._send(ws, JSON.stringify({ t: 'siege', k: 'end', r: b.result, a: b.raised ? 1 : 0, ...(s.receipts?.[a.sub] ? { rc: s.receipts[a.sub] } : {}) }));
      return;
    }
    const by = s.fighters[a.sub];
    if (!by) { this._junk(ws); return; }   // a correct client says `in` first
    if (m.k === 'ask' || m.k === 'yes') { if (b?.kind === 'royal' && by.side === 'duel') await this._royalHand(ws, a, s, b, m, now); else this._junk(ws); return; }   // CROWN1 part two   // AUDIT-SEATS R9: a contender's alone
    if (b && (b.result || now < b.startMs)) return;   // SEAT2a: the battle is not joined yet, or over
    if (m.to === SIEGE_WORK_IDS.gate || m.to === SIEGE_WORK_IDS.ram) { await this._siegeWorkBlow(ws, a, s, b, by, m, now); return; }   // SEAT2b part two (b): a blow on a work
    // AUDIT SEATS-3 B1: and none struck from more than SIEGE_HEIGHT_M off the field's ground (siegeGroundOf - a bout's for
    // its two) - a defender 45 m over the Rebel Captain shot every rebel down where none of their blows reached it
    if (siegeOffGround(siegeGroundOf(b, a.sub), by.pose) > SIEGE_HEIGHT_M) return;
    if (isSiegeNpcId(m.to)) { await this._siegeNpcBlow(ws, a, s, b, by, m, now); return; }   // SEAT2b part two (c): on one of the relay's own fighters
    const target = this._idFirst(m.to)?.[1] ?? null;   // SCALE5b: by the id index
    const to = target?.sub ? s.fighters[target.sub] : null;
    if (!to) return;   // a spectator, or a socket gone: nothing to strike
    // AUDIT-SEATS R9: ONCE A BATTLE STANDS, A BLOW OR A CAST IS BETWEEN SIDED FIGHTERS ALONE. A developer who entered PVP-REF's
    // ground without a pass before the first pass named the battle stayed unsided, and `by.side && ...` below then skipped
    // the side rule whole - it struck either side, healed either, and was a target whose felling bought Honours
    if (b && (!by.side || !to.side)) return;
    const heal = m.k === 'cast' && m.h === 1;
    if (by.side && b?.kind !== 'royal' && (heal ? to.side !== by.side : to.side === by.side)) return;   // SEAT2a: the sides are kept
    // CROWN1 part two: the bout's two alone; INT10 (bible/06-Systems/Integrity-Arc.md lane 2): AND BLOWS ALONE - a Royal
    // Tourney's bout takes no cast (the client sends none: world.js siegeSpellMarks), and a crafted client's damaging one
    // was refereed as a siege's; a heal between them never was
    if (b?.kind === 'royal' && (m.k === 'cast' || !royalMayStrike(b, a.sub, target.sub, now))) return;
    // the striker's look - the paperdoll every other player draws - names the weapon it holds (a woken object reads it)
    let look = this._looks.get(a.id) ?? null;
    if (!look && m.k === 'blow') { look = (await this.state.storage.get(lookKey(a.id))) ?? null; if (look) this._looks.set(a.id, look); }
    const res = m.k === 'cast'
      ? refereeCast(by, to, { from: by.pose, at: to.pose, d: m.d, heal }, now)
      : refereeBlow(by, to, { from: by.pose, at: to.pose, held: siegeHeld(look, m.w, m.m), d: m.d, r: m.r, wa: a.wa ?? null }, now);   // INT7: clipped to the striker's signed arms
    if (!res.ok || !res.dealt) return;
    const frames = [{ k: 'hp', id: m.to, h: to.hp, m: to.max }];
    if (res.fell && b?.kind === 'royal') { this._siegeFan(frames); await this._royalBoutEnd(s, b, royalEnd(b, a.sub, now), now); return; }   // CROWN1 part two: a fall ends the bout
    if (res.fell) {
      by.felled = (by.felled ?? 0) + 1;   // SEAT2a: Honours' other half (6.8)
      to.upAt = siegeNextWave(now, b ? siegeWaveMs(b, to.side) : SIEGE_WAVE_MS.palace);   // SEAT2a: the seat's own tier's wave - SEAT2b part two (b): a defender's the Walls' quicker
      frames.push({ k: 'fell', id: m.to, by: a.id });
      await this._siegeArm(to.upAt);
    }
    this._siegeFan(frames);
    await this._siegeSave(now, res.fell);
  }
  /**
   * SEAT2b part two (b) (Seats-Arc 6.2): A BLOW ON A WORK - the Gatehouse (`gh`) an attacker's, at a tenth of its damage;
   * the Ram (`rm`) a defender's, in full - judged by the referee (net/siege/siegeRef.js refereeWorkBlow: the striker's bucket,
   * a melee blow from the weapon its look holds, within reach of the work's edge, on the field's ground). A Gatehouse at
   * none is breached (the Throne unbarred); a Ram at none is destroyed and the camp's next fielded at the attackers' next
   * wave. A blow at a work that is not there (none raised, breached, no Ram standing) is the honest race - nothing; a
   * blow outside a siege (a Tourney's field, PVP-REF's ground) is junk. The field's frame said at once on a breach or a
   * Ram's end, else at the next beat.
   */
  async _siegeWorkBlow(ws, a, s, b, by, m, now) {
    if (!b || b.kind !== 'siege' || m.k !== 'blow') { this._junk(ws); return; }
    const gate = m.to === SIEGE_WORK_IDS.gate;
    if (by.side !== (gate ? 'attack' : 'defend')) return;   // the sides are kept: a defender batters no gate, an attacker no Ram of its own
    const work = gate ? (b.breached ? null : b.gate) : b.ram;
    if (!work) return;
    let look = this._looks.get(a.id) ?? null;
    if (!look) { look = (await this.state.storage.get(lookKey(a.id))) ?? null; if (look) this._looks.set(a.id, look); }
    const res = refereeWorkBlow(by, work, { point: b.field.throne, size: gate ? SIEGE_GATEHOUSE.sizeM : SIEGE_RAM.sizeM, from: by.pose, ground: b.ground ?? null,
      held: siegeHeld(look, m.w, m.m), d: m.d, r: m.r, share: gate ? SIEGE_GATEHOUSE.blowShare : 1, wa: a.wa ?? null }, now);   // INT7: the striker's signed arms
    if (!res.ok) return;
    if (res.broke) {
      if (gate) siegeBreach(b); else siegeRamDown(b, now);
      this._siegeFan([siegeFieldFrame(b, this._siegeCounts(s), now)]);   // AUDIT SEATS-2 R2: the relay's own fighters where they stand now, not at the last beat
      await this._siegeSave(now, true);
      return;
    }
    await this._siegeSave(now, false);
  }
  /**
   * SEAT2b part two (c) (Seats-Arc 7.5, 7.7): A BLOW OR A CAST ON ONE OF THE RELAY'S OWN FIGHTERS (`n<i>` - a Barracks
   * guard, a rebel, the Rebel Captain) - judged by the referee as a blow on a fighter is (net/siege/siegeRef.js refereeBlow,
   * refereeCast: the striker's bucket, the weapon its look holds, the reach to its body where its walk has carried it, on
   * the field's ground); an enemy of the striker's side alone (siegeNpcFoe - a defender strikes no guard, an attacker no
   * rebel), and a heal reaches none of them. Its vitality fanned; its fall said (`fell`, by the striker), credited to the
   * striker's Honours and the field's frame said at once - a guard to rise with the defenders' wave, a rebel and the
   * Captain for good (the Captain's fall ends a revolt at the next beat). A blow at one already down is the honest race -
   * nothing; at a number the battle never fielded, or outside a battle that fields any, junk.
   */
  async _siegeNpcBlow(ws, a, s, b, by, m, now) {
    const n = b && b.kind !== 'royal' ? (b.npcs ?? []).find((x) => x.id === m.to) ?? null : null;
    if (!n) { this._junk(ws); return; }
    if ((m.k === 'cast' && m.h === 1) || !siegeNpcFoe(n, by.side) || n.down) return;
    if (!siegeNpcInReach(n, by.pose, b.ground ?? null)) return;   // AUDIT SEATS-2 R1: none felled from where it can never answer   // AUDIT SEATS-3 B1: nor from above or below the field
    let look = this._looks.get(a.id) ?? null;
    if (m.k === 'blow' && !look) { look = (await this.state.storage.get(lookKey(a.id))) ?? null; if (look) this._looks.set(a.id, look); }
    const at = siegeNpcPose(n, now, b.ground ?? null, by.pose?.y ?? 0);
    const res = m.k === 'cast'
      ? refereeCast(by, n, { from: by.pose, at, d: m.d }, now)
      : refereeBlow(by, n, { from: by.pose, at, held: siegeHeld(look, m.w, m.m), d: m.d, r: m.r, wa: a.wa ?? null }, now);   // INT7
    if (!res.ok || !res.dealt) return;
    if (res.fell) {
      siegeNpcFell(b, n, now);
      by.felled = (by.felled ?? 0) + 1;   // 6.8: a foe felled - Honours' other half
      this._siegeFan([{ k: 'hp', id: n.id, h: 0, m: n.max }, { k: 'fell', id: n.id, by: a.id }, siegeFieldFrame(b, this._siegeCounts(s), now)]);
      await this._siegeSave(now, true);
      return;
    }
    siegeNpcProvoked(n, a.sub, now);   // AUDIT SEATS-2 R1: it comes for whoever struck it
    this._siegeFan([{ k: 'hp', id: n.id, h: n.hp, m: n.max }]);
    await this._siegeSave(now, false);
  }
  /** SEAT2a: who is in - the two sides' fighters with a socket here, and the spectators. */
  _siegeCounts(s) {
    let attack = 0, defend = 0, watch = 0;
    for (const [, b] of this._all()) {
      if (!b.id) continue;
      if (b.sd === 'watch') { watch++; continue; }
      const side = b.sub ? s.fighters[b.sub]?.side : null;
      if (side === 'attack') attack++; else if (side === 'defend') defend++;
    }
    return [attack, defend, watch];
  }
  /** A fighter's step: kept where the referee allows it ('body' - AUDIT-SEATS T2: a body the room is told of), else the
   *  fighter told its last good pose (false). Not a fighter: 'eye' - its camera is its own, kept and drawn to nobody. */
  async _siegeStep(ws, a, p, now) {
    const s = await this._siegeOf(), f = s?.fighters[a.sub];
    if (!f) return 'eye';   // not a fighter: a spectator's camera is its own
    // CROWN1 part two: and a Royal Tourney's bout kept in its ring - asked first (AUDIT-SEATS R2: a step the ring refuses
    // spends none of the fighter's run); AUDIT-SEATS R1/R2: the referee's step judges the climb, on the fighter's own
    // carried allowance (`f`)
    // AUDIT SEATS-3 B1: AND HELD TO THE FIELD'S GROUND - a step more than SIEGE_HEIGHT_M above or below it refused (one
    // walking back toward it kept: siegeStepLevel), a siege's the field's, a bout's its marks' (siegeGroundOf). The climb
    // cost a run and a fall nothing, so a fighter rose 45 m or sank 100 m and stood where no blow reached it
    if (!siegeStepLevel(siegeGroundOf(s.battle, a.sub), f.pose, p)) { this._send(ws, JSON.stringify({ t: 'siege', k: 'back', p: f.pose })); return false; }
    if (!royalStepOk(s.battle, a.sub, p) || !refereeStep(f.pose, p, now - (f.poseAt ?? now), f)) { this._send(ws, JSON.stringify({ t: 'siege', k: 'back', p: f.pose })); return false; }
    f.pose = p; f.poseAt = now;
    return 'body';
  }
  /** THE WAVES: every fallen fighter whose wave has come rises whole (SEAT2a: at its side's camp), said to the room; the
   *  next wave armed. SEAT2a: THE BATTLE'S BEAT - each second from the first pass to the end, the field moved on and
   *  fanned; at its end each fighter's receipt minted and handed over, kept for the week a receipt lives, then the room's
   *  siege forgotten. False when the room holds no siege (the alarm is somebody else's). */
  async _siegeTick() {
    const s = await this._siegeOf();
    if (!s) return false;
    const now = Date.now();
    const b = s.battle ?? null;
    if (b?.result) {
      if (now >= (s.dropAt ?? 0)) { await this.state.storage.delete('siege'); this._siege = null; } else await this.state.storage.setAlarm(s.dropAt);
      return true;
    }
    if (b?.kind === 'royal') {   // CROWN1 part two: a Royal Tourney's beat - a bout's draw or walkover, the week's end
      for (const e of royalStep(b, (sub) => !!this._siegeSocketOf(sub), now)) {
        if (e.k === 'bout') await this._royalBoutEnd(s, b, e, now);
        else { s.dropAt = now + SIEGE_RECEIPT_TTL_S * 1000; await this._siegeSave(now, true); await this.state.storage.setAlarm(s.dropAt); return true; }
      }
      await this._siegeSave(now, false);
      await this.state.storage.setAlarm(royalNextBeat(b, now));
      return true;
    }
    const frames = [];
    let next = Infinity, felled = false;
    for (const [sub, f] of Object.entries(s.fighters)) {
      if (siegeRise(f, now)) {
        const sk = this._siegeSocketOf(sub);
        if (b && f.side) { f.pose = siegeCampPose(b, f.side, f.pose); f.poseAt = now; }
        if (sk) frames.push({ k: 'up', id: sk[1].id, ...(b && f.side ? { p: f.pose } : {}) }, { k: 'hp', id: sk[1].id, h: f.hp, m: f.max });
      } else if (f.down) next = Math.min(next, f.upAt);
    }
    this._siegeFan(frames);
    if (b) {
      const list = [];
      for (const [sub, f] of Object.entries(s.fighters)) if (f.side) { f.here = !!this._siegeSocketOf(sub); f.sub = sub; list.push(f); if (!f.here && !Number.isFinite(f.goneAt)) f.goneAt = now; }   // AUDIT-SEATS T3: a leave the room never heard (a restarted object's) stamped at its first beat   // SEAT2b part two (c): and its account, the relay's own fighters' mark
      const events = battleStep(b, list, now);
      for (const f of list) { delete f.here; delete f.sub; }
      // SEAT2b part two (c): a blow of the relay's own landed - the fighter's vitality, and its fall (by the one that struck)
      const struck = [];
      for (const e of events) {
        if (e.k !== 'nhit') continue;
        const sk = this._siegeSocketOf(e.to);
        if (!sk) continue;
        struck.push({ k: 'hp', id: sk[1].id, h: e.h, m: e.m });
        if (e.fell) struck.push({ k: 'fell', id: sk[1].id, by: e.n });
      }
      felled = events.some((e) => e.k === 'nup' || (e.k === 'nhit' && e.fell));   // a fall or a rise kept at once, as a fighter's blow's is
      this._siegeFan([...struck, siegeFieldFrame(b, this._siegeCounts(s))]);
      if (events.some((e) => e.k === 'end')) { await this._siegeEnd(s, now); return true; }
      next = Math.min(next, siegeNextBeat(b, now));
    }
    await this._siegeSave(now, frames.length > 0 || felled);
    if (Number.isFinite(next)) await this.state.storage.setAlarm(next);
    return true;
  }
  /** SEAT2a: THE END (6.5, 6.8) - every sided fighter's `s1` receipt minted (the result, whether a banner was raised, its
   *  own Honours), each fighter here handed its own, the result said to everyone; kept a receipt's week for a fighter
   *  who returns for it (17: "its result and Honours are signed receipts the relay keeps"). */
  async _siegeEnd(s, now) {
    const b = s.battle, key = await this._receiptKeyOf(), nowS = Math.floor(now / 1000);
    s.receipts = {};
    for (const [sub, f] of Object.entries(s.fighters)) {
      if (f.side !== 'attack' && f.side !== 'defend') continue;
      try { s.receipts[sub] = await mintSiegeReceipt({ s: sub, sk: s.of.sk, sw: s.of.sw, sd: f.side, r: b.result, a: b.raised ? 1 : 0, h: honoured(f, b) ? 1 : 0, th: b.reached ? 1 : 0 }, key, { subtle: crypto.subtle, nowS }); } catch (e) { console.warn('[siege] receipt failed', e?.message ?? e); }   // AUDIT-SEATS T1: and whether the Throne was reached
    }
    s.dropAt = now + SIEGE_RECEIPT_TTL_S * 1000;
    for (const [ws, att] of [...this._all()]) {
      if (!att.id) continue;
      const rc = att.sub ? s.receipts[att.sub] : undefined;
      this._send(ws, JSON.stringify({ t: 'siege', k: 'end', r: b.result, a: b.raised ? 1 : 0, ...(rc ? { rc } : {}) }));
    }
    await this._siegeSave(now, true);
    await this.state.storage.setAlarm(s.dropAt);
  }

  // ───────────────────────── CROWN1 part two: A ROYAL TOURNEY'S ROOM ─────────────────────────
  // Seats-Arc 7.6: DUEL1's ring, every blow the referee's; one bout at a time; the ladder the room's (net/siege/siegeRef.js).
  /** A peer id's account here, or null. */
  _royalSubOf(id) {
    for (const [, t] of this._withId(id, null)) if (t.sub) return t.sub;   // SCALE5b: the id's own sockets, in the index's order
    return null;
  }
  /** The ladder as the room says it - each contender by its peer id here ('' for one gone). */
  _royalLadderFrame(b) {
    return { k: 'lad', l: royalLadder(b).map(([sub, w, l]) => [this._siegeSocketOf(sub)?.[1].id ?? '', w, l]) };
  }
  /** The bout on, as the room says it - or null. */
  _royalBoutFrame(b) {
    const bt = b.bout;
    if (!bt) return null;
    const ia = this._siegeSocketOf(bt.a)?.[1].id, ib = this._siegeSocketOf(bt.b)?.[1].id;
    return ia && ib ? { k: 'bout', a: ia, b: ib, n: bt.n, s: bt.startMs, e: bt.endMs } : null;
  }
  /** A contender's entry said: every fighter's vitality was sent; the ladder, the bout on, and the receipts this account
   *  won here and was not handed (a reconnect's). */
  _royalSay(ws, s, b, sub) {
    this._send(ws, JSON.stringify({ t: 'siege', ...this._royalLadderFrame(b) }));
    const bout = this._royalBoutFrame(b);
    if (bout) this._send(ws, JSON.stringify({ t: 'siege', ...bout }));
    for (const rc of s.royalRc?.[sub] ?? []) this._send(ws, JSON.stringify({ t: 'siege', k: 'won', rc }));
  }
  /** A CHALLENGE (`ask`, to the one challenged) or its ACCEPT (`yes`, to the challenger): the bout begun - both whole and
   *  on their marks, said to the room - or a refusal in words. */
  async _royalHand(ws, a, s, b, m, now) {
    const other = this._royalSubOf(m.to);
    if (!other || !s.fighters[other]) { this._send(ws, JSON.stringify({ t: 'siege', k: 'no', m: 'no such contender' })); return; }
    if (m.k === 'ask') {
      const no = royalAsk(b, a.sub, other, now);
      if (no) { this._send(ws, JSON.stringify({ t: 'siege', k: 'no', m: no })); return; }
      const sk = this._siegeSocketOf(other);
      if (sk) this._send(sk[0], JSON.stringify({ t: 'siege', k: 'ask', id: a.id }));
      return;
    }
    if (!royalLevel(s.fighters[other].pose, s.fighters[a.sub]?.pose)) { this._send(ws, JSON.stringify({ t: 'siege', k: 'no', m: 'the ring is not level' })); return; }   // AUDIT SEATS-3 B1: no bout begun from where its marks' ground leaves one out of reach
    const r = royalAccept(b, a.sub, other, now);
    if (r.no) { this._send(ws, JSON.stringify({ t: 'siege', k: 'no', m: r.no })); return; }
    const fa = s.fighters[r.bout.a], fb = s.fighters[r.bout.b];
    const [pa, pb] = royalMarks(b, fa.pose, fb.pose);
    const frames = [];
    for (const [sub, f, p] of [[r.bout.a, fa, pa], [r.bout.b, fb, pb]]) {
      Object.assign(f, { pose: p, poseAt: now });   // whole already: a contender's vitality moves in a bout alone, and every bout ends both whole
      const sk = this._siegeSocketOf(sub);
      if (sk) { this._send(sk[0], JSON.stringify({ t: 'siege', k: 'back', p })); frames.push({ k: 'hp', id: sk[1].id, h: f.hp, m: f.max }); }
    }
    const bout = this._royalBoutFrame(b);
    this._siegeFan(bout ? [...frames, bout] : frames);
    await this._siegeSave(now, true);
    await this._siegeArm(royalNextBeat(b, now));
  }
  /** A BOUT OVER (`e` royalEnd's): both whole again, said to the room with the ladder; the winner handed its signed
   *  receipt (`t1`), kept the room's week for a reconnect. */
  async _royalBoutEnd(s, b, e, now) {
    if (!e) return;
    const frames = [];
    for (const sub of [e.a, e.b]) {
      const f = s.fighters[sub];
      if (!f) continue;
      Object.assign(f, { hp: f.max, down: false, upAt: 0 });
      const sk = this._siegeSocketOf(sub);
      if (sk) frames.push({ k: 'hp', id: sk[1].id, h: f.hp, m: f.max });
    }
    const idOf = (sub) => (sub ? this._siegeSocketOf(sub)?.[1].id ?? '' : '');
    const w = idOf(e.w), l = idOf(e.l);
    // a walkover's loser is gone - no socket names it ('' its id); a draw names neither
    frames.push({ k: 'bend', n: e.n, w: e.w ? w : '', l: e.w ? l : '', c: e.counted && w ? 1 : 0 }, this._royalLadderFrame(b));
    this._siegeFan(frames);
    if (e.w && e.l) {
      try {
        const rc = await mintRoyalReceipt({ s: e.w, l: e.l, sk: s.of.sk, sw: s.of.sw, n: e.n }, await this._receiptKeyOf(), { subtle: crypto.subtle, nowS: Math.floor(now / 1000) });
        s.royalRc ??= {};
        s.royalRc[e.w] = [...(s.royalRc[e.w] ?? []), rc].slice(-ROYAL_RC_KEEP);
        const sk = this._siegeSocketOf(e.w);
        if (sk) this._send(sk[0], JSON.stringify({ t: 'siege', k: 'won', rc }));
      } catch (err) { console.warn('[royal] receipt failed', err?.message ?? err); }
    }
    await this._siegeSave(now, true);
  }

  // ───────────────────────────── WB3: THE GATE ─────────────────────────────
  /** The fight this gate room holds, or null - the instance's while it is awake, storage's (the last checkpoint) after
   *  a wake. */
  async _gateFightOf() {
    if (this._fight === undefined) {
      const v = await this.state.storage.get('gatefight');
      this._fight = v && typeof v === 'object' ? v : null;
      // AUDIT WB14 (WIRE-1): A FIGHT FROM BEFORE THE PORTENTS woken on a portent night (a deploy while its gate burned) was
      // fought on floors the screens no longer build (they build the night's plan - the Vanguard's Bridgehead its arrival),
      // so it is let go unfallen and the next `in` begins the night's own; a fallen one keeps its receipts
      if (this._fight && !('pt' in this._fight) && !this._fight.fell && !this._fight.wrath && gatePortentsOf(this._fight.day)) { this._fight = null; await this.state.storage.delete('gatefight'); }
    }
    return this._fight;
  }
  /** Why a hello into a gate's room is refused, or null to admit it (the hello's own note says when). */
  async _gateAdmit(key, sub, now) {
    const day = gateDayOfRoom(key);
    if (!gateHolds(day, now)) return 'the gate is closed';
    const f = await this._gateFightOf();
    if (f?.players[sub]) return null;
    if (f?.fell || f?.wrath) return 'the gate is closing';
    return gateAdmits(day, now) ? null : 'the gate is sealed';
  }
  /** A pose in the arena's dungeon frame, in the court's (net/gate/gateBrain.js COURT_CENTRE). */
  _courtOf(p) { return { x: p.x - COURT_CENTRE[0], z: p.z - COURT_CENTRE[2] }; }
  /** The fight's bodies in the court now: one a fighter (its NEWEST socket speaks for it - AUDIT SOC B9's law), where
   *  its last pose stands, and whether that pose says it died. */
  _gateBodies(f) {
    const newest = new Map();
    for (const [ws, b] of this._courtSockets()) {   // SCALE5d part two: its copies' fighters too
      if (!b.id || !b.sub || !b.pose || !f.players[b.sub]) continue;
      const had = newest.get(b.sub);
      if (!had || (b.since ?? 0) >= (had[1].since ?? 0)) newest.set(b.sub, [ws, b]);
    }
    return [...newest.values()].map(([ws, b]) => { const c = this._courtOf(b.pose); return { sub: b.sub, id: b.id, x: c.x, z: c.z, dead: !!b.pose.dd, tr: this._trailOf(ws, (p) => this._courtOf(p)) }; });   // INT11: and its trail - AUDIT INT11: the trail of the socket that speaks for it
  }
  // ── INT11-INT13: THE BODY COUNTED (net/bossBody.js, net/bossRef.js; bible/06-Systems/Integrity-Arc.md section 6) ──
  /** The line the boss fights' count runs by - the BOSS_BODY var (bodyConfig: a mistyped one is the default, which
   *  measures and enforces nothing), read once an instance. */
  _bodyLine() { return (this._bodyCfg ??= bodyConfig(relayCfgValue(this._relayCfg, this.env, 'bossBody'))); }   // SCALE5b: the hub's setting over the var
  /** SCALE5b: THE RELAY'S SETTINGS (net/relayCfg.js) - the hub's, read from its storage once a wake and kept. */
  async _relayCfgOf() {
    if (this._relayCfg === undefined) { const v = await this.state.storage.get('relaycfg'); this._relayCfg = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    return this._relayCfg;
  }
  /** SCALE5b: a boss's room asks the hub for the settings at most every RELAY_CFG_TTL_MS, at its beat - a hub that does
   *  not answer leaves the last answer standing (or none: the Worker's vars). A setting that moved is in force from here.
   *  AUDIT SCALE II R1-2: NEVER AWAITED BY A BEAT (AUDIT WB12d R2/L3's law, the rite's ask beside it) - the gate's, a
   *  Remnant's and a serpent's beat each awaited this call, so a slow hub froze the fight up to ROOM_CALL_MS once a
   *  minute. The beat asks and goes on with the line it holds; the answer, when it lands, is the next beat's. It is
   *  stamped before it goes (one ask a TTL however many beats run meanwhile) and its every failure caught here, so a
   *  call nobody awaits can neither run twice nor reject unheard. */
  async _relayCfgFresh(now) {
    if (now - this._relayCfgAt < RELAY_CFG_TTL_MS) return;
    this._relayCfgAt = now;
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return;
    await (this._relayCfgP = this._relayCfgAsk(rooms));   // LEASE1: the ask in flight, for the lease door to wait on (`_leaseHeard`)
  }
  /** SCALE5b: _relayCfgFresh's ask of the hub - its every failure caught here. */
  async _relayCfgAsk(rooms) {
    try {
      const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${RELAY_INTERNAL_CFG}`, { signal: AbortSignal.timeout(ROOM_CALL_MS) }));
      const v = res?.ok ? await res.json() : null;
      if (v && typeof v === 'object' && !Array.isArray(v) && JSON.stringify(v) !== JSON.stringify(this._relayCfg ?? {})) { this._relayCfg = v; this._bodyCfg = undefined; }
    } catch (e) { console.warn('[cfg] the hub did not answer', e?.message ?? e); }
  }
  /**
   * GROUND-GATE (FIELD BUGS 2026-10-17f; Mac's call on bible/03-World/Landforms.md C2): A GROUND ROOM'S DOOR. A hello in
   * a room whose peers stand on each client's own ground (net/wire.js groundRoom) from a build on an older ground than
   * this relay's law - its `gl` less than GROUND_LAW, or none - is refused while the setting `groundGate` is on
   * (net/relayCfg.js), so no copy draws the room's peers in the air nor is drawn under the sand. A hello on the ground
   * asks nothing. An old one asks the hub's settings at most once a TTL - awaited while this room has never had an
   * answer, so a cold cell's first hello is not the one let through. Answers whether the hello is refused.
   * @param {string} key @param {any} m the hello, parsed @param {number} now
   */
  async _groundRefusal(key, m, now) {
    if (!groundRoom(key) || m.gl >= GROUND_LAW) return false;
    if (this._relayCfgAt === -Infinity) await this._relayCfgFresh(now);
    else void this._relayCfgFresh(now);
    return relayCfgValue(await this._relayCfgOf(), this.env, 'groundGate') === 'on';
  }  /** GROUND-GATE and GRANT-DOOR: THE HELLO'S DOORS - a build on an older ground (GROUND_OLD_REASON), then one that stands
   *  on no spawn grant while `grantDoor` is on (GRANT_OLD_REASON): the words every build shows, the close, nothing written.
   *  Answers whether the hello was refused. */
  async _doorRefused(ws, key, m, now) {
    if (await this._groundRefusal(key, m, now)) { this._refuse(ws, GROUND_OLD_WORDS, CLOSE_POLICY, GROUND_OLD_REASON); return true; }
    if (await this._grantDoorRefusal(key, m, now)) { this._refuse(ws, GROUND_OLD_WORDS, CLOSE_POLICY, GRANT_OLD_REASON); return true; }
    if (await this._leaseDoorRefusal(key, m, now)) { this._refuse(ws, GROUND_OLD_WORDS, CLOSE_POLICY, LEASE_OLD_REASON); return true; }   // LEASE1: a build that hands on no lease while the door is on
    return false;
  }
  /** LEASE1 (net/roomLease.js): is this hello one the lease door turns away - a lease room's from a build that hands on no
   *  lease (`ls`), while `leaseDoor` is on? GRANT-DOOR's own law, below. */
  async _leaseDoorRefusal(key, m, now) {
    if (!leaseRoom(key) || m.ls === 1) return false;
    return this._leaseDoorOn(now);
  }
  /** LEASE1: is `leaseDoor` on, by what this room holds? NEVER WAITS ON THE HUB (mob, 07:57Z: "we need to test if this
   *  affected load times", "if we affected server performasnce" - every lease room asked the hub's one object once a
   *  minute, and a fresh room's first frame past a hello waited on it): the ask goes beside, and its answer is the next
   *  frame's. `ls` is the game's own word, so a wait would buy no lock. Asked beside at most once a TTL, and with `ask`
   *  false not at all: a frame of a build that hands on no lease asks only once in LEASE_OLD_ASK_MS (a review of the PR:
   *  with the door off, every lease room holding an old build asked the hub once a minute - the load mob would not have;
   *  the fourth: asked only once a wake, one let in before the door went on at the hub was heard for the whole wake).
   *  (A bound socket's frame with no live lease waits on the answer: `_leaseHeard`.) */
  async _leaseDoorOn(now, ask = true) {
    const cfg = await this._relayCfgOf();
    if (ask) void this._relayCfgFresh(now);
    return relayCfgValue(cfg, this.env, 'leaseDoor') === 'on';
  }
  /** LEASE1: THE LEASE DOOR ON A FRAME (any but a ping or a lease; a region's shard asks it before it hands one up to its
   *  bus) - the attachment to hear it under, or null: not heard. A bound socket's frame with no live lease, behind a lease
   *  still being read, waits on that read (`lp`: the honest game hands its lease on just ahead of the frame - its first,
   *  or its first after an idle spell its last lease lapsed in). Then, while `leaseDoor` is on: a bound socket with no live
   *  lease - none yet (`ld` 0), or one that lapsed - is heard in nothing and stands, until its next lease lands: NO GRACE (a
   *  review of the PR: a changed game that reconnected inside one would never be leased, and a token carries no freeze),
   *  and no close (the third review: a close bought an honest game back from a hidden tab nothing but a reconnect, its new
   *  socket as unheard); and one bound to nothing in a lease room (a build that hands on no lease, let in by a room that
   *  did not know the door was on) is turned away as its hello would be. A bound socket's door is never a guess: its frame
   *  waits on the hub's answer in flight, or asks it first in a wake that never has (the reviews: a woken room heard an
   *  unleased frame on the Worker's var, and a second frame during the first's wait did too) - a socket with a live lease
   *  never comes here, so honest play never waits but behind a frame of its own. THE FOURTH REVIEW: a frame that waited
   *  is judged on the socket as it stands after the wait, never as it stood before (a lease that landed meanwhile - its
   *  mute, its freeze - was written back over with the old attachment, door off), and a socket's later frames wait
   *  behind it (`dq`), so they are heard in the order they were said. */
  async _leaseHeard(ws, a) {
    if (ws.virtual) return a;
    const meter = this._meterOf(ws);
    while (meter.dq) { await meter.dq.catch(() => null); if (!(a = this._pastWait(ws))) return null; }
    if (a.ld != null && !(a.ld * 1000 >= Date.now())) { await meter.lp; a = this._attach(ws); }   // closed or replaced meanwhile: its lease untaken (`_leaseRead`), the door's below
    const now = Date.now();
    if (a.ld != null ? a.ld * 1000 >= now : !a.id || !leaseRoom(a.key ?? this._busKey)) return a;
    const door = meter.dq = this._leaseDoor(ws, a.ld != null, now);
    try { return await door; } finally { if (meter.dq === door) meter.dq = null; }
  }
  /** LEASE1: `_leaseHeard`'s wait at the door, for a frame with no live lease - the attachment to hear it under, or null. */
  async _leaseDoor(ws, bound, now) {
    if (bound) await (this._relayCfgAt === -Infinity ? this._relayCfgFresh(now) : this._relayCfgP);
    const on = await this._leaseDoorOn(now, bound || now - this._relayCfgAt >= LEASE_OLD_ASK_MS);
    const a = this._pastWait(ws);
    if (!a) return null;
    if (!on || a.ld * 1000 >= Date.now()) return a;
    if (a.ld == null) this._refuse(ws, GROUND_OLD_WORDS, CLOSE_POLICY, LEASE_OLD_REASON);
    return null;
  }
  /** LEASE1 (the fourth review of the PR): the socket as it stands past a wait, or null - it closed, or a reconnect took its
   *  id, meanwhile: nothing of it is heard, nor its lease taken, after its leave (`_attach` alone always answers). */
  _pastWait(ws) {
    const a = this._dead.has(ws) || this._gone.has(ws) ? null : this._attach(ws);
    return a?.replaced ? null : a;
  }
  /** LEASE1: the lease key, derived once from the relay's secret (a CryptoKey cannot be stored; a deploy is a new object). */
  async _leaseKeyOf() {
    if (this._leaseKey === undefined) this._leaseKey = await leaseKeyOf(this.env?.GATE_SIGNING_KEY, { subtle: crypto.subtle });
    return this._leaseKey;
  }
  /** LEASE1: A LEASE FRAME. An ask, on a hub link - answered with a lease for the socket's own account, its mute and freeze
   *  as the hub holds them now. A lease, in a lease room - for this socket's account, and not lapsed: its socket's lease
   *  renewed, and its mute and freeze taken when it is newer than the room's last word on them (`lt`: its token, an order,
   *  a lease before it); a region's shard hands a change on to its bus, which judges the lines. One a socket every
   *  LEASE_FRAME_MIN_MS whatever it sends - each costs a MAC. */
  async _leaseFrame(ws, a, m, message) {
    const now = Date.now();
    const meter = this._meterOf(ws);   // AUDIT ATTACH: a meter is the instance's, never the attachment's
    if (now - (meter.lq ?? -Infinity) < LEASE_FRAME_MIN_MS) return;
    meter.lq = now;
    let read = () => {};
    meter.lp = new Promise((ok) => { read = ok; });   // a frame behind this lease waits on its read (the hub's door above)
    try { await this._leaseRead(ws, a, m, message, now); } finally { read(); }
  }
  /** LEASE1: _leaseFrame's work, past its meter. */
  async _leaseRead(ws, a, m, message, now) {
    const key = await this._leaseKeyOf();
    if (!key || typeof a.sub !== 'string' || !a.sub) return;
    const room = a.key ?? this._busKey;
    const nowS = Math.floor(now / 1000);
    if (m.l === undefined) {
      if (!isSocialRoom(room)) return;
      const l = await mintLease({ s: a.sub, mu: a.mu ?? 0, fz: a.fz ?? 0, at: nowS }, key, { subtle: crypto.subtle });
      if (l) this._send(ws, JSON.stringify({ t: 'lease', l }));
      return;
    }
    if (!leaseRoom(room)) return;
    const r = await readLease(m.l, key, { subtle: crypto.subtle, nowS });
    const b = this._pastWait(ws);   // read again past the awaits
    if (!r || !b || r.s !== b.sub) return;
    const law = r.at > (b.lt ?? b.gio ?? 0);
    // a token says nothing of a freeze (a review of the PR: a fresh token, then a lease minted before it, dodged one), so
    // an older lease still holds a freeze longer than the room's - it lifts none
    const next = { ...b, ld: Math.max(b.ld ?? 0, r.u), ...(law ? { lt: r.at, mu: r.mu, fz: r.fz } : r.fz > (b.fz ?? 0) ? { fz: r.fz } : {}) };
    if (!this._setAttach(ws, next)) return;
    if (b.vid && isChannelShard(room) && ((b.mu ?? 0) !== (next.mu ?? 0) || (b.fz ?? 0) !== (next.fz ?? 0))) this._hubForward(ws, next, message);
  }
  /** GRANT-DOOR (bible/11-Multiplayer/Spawn-Grants.md section 20): is this hello one the door turns away - a foes room's
   *  (a cell, a world room: net/wire.js streamsFoes) from a build whose hello says no spawn grants (`gv`), while
   *  `grantDoor` is on? GROUND-GATE's own law: a current build's hello asks nothing; a cold room asks the hub before its
   *  first such hello (a cell woken by a changed client must not let it in on the Worker's var). */
  async _grantDoorRefusal(key, m, now) {
    if (!streamsFoes(key) || m.gv >= GRANT_HELLO_LAW) return false;
    if (this._relayCfgAt === -Infinity) await this._relayCfgFresh(now);
    else void this._relayCfgFresh(now);
    return relayCfgValue(await this._relayCfgOf(), this.env, 'grantDoor') === 'on';
  }

  /**
   * AUDIT INT11: DOES THIS SOCKET'S POSE GO ON A TRAIL? A socket of an account a fight here counts, while that fight lives
   * - a gate's court, an Abyss Dungeon's realm, a serpent's waters in its cell (the fights the instance holds awake). A cell
   * whose serpent fell hours ago kept every pose of every player on a trail nobody read, on the path PERF-RELAY1 made its
   * own; a court's watchers too.
   */
  _trailing(a) {
    const sub = a?.sub;
    if (typeof sub !== 'string' || !sub) return false;
    if (isGateRoom(a.key)) { const f = this._fight; return !!f?.players?.[sub] && !f.fell && !f.wrath; }
    if (isSdRoom(a.key)) { const f = this._sdFight; return !!f?.players?.[sub] && !f.fell && !f.lost; }
    if (!this._serpents?.size) return false;
    for (const f of this._serpents.values()) if (f.players?.[sub] && !f.fell && !f.gone) return true;
    return false;
  }
  /** A boss fight's body's pose, kept on its SOCKET's trail (the last BODY_TRAIL_MS, BODY_TRAIL_MAX at most) - where it
   *  stood as its poses came, which the relay judges a landing by (net/bossRef.js posAt). AUDIT INT11: by socket, never by
   *  account - a cell holds an account's sockets apart (a reconnect's, a modified client's second), and one trail of them
   *  all read whichever stood nearest the landing: decoys far off, and no blow ever counted. The census reads the trail of
   *  the socket that speaks for the body. */
  _trailPose(ws, p, now) {
    const all = (this._trails ??= new Map());
    const tr = all.get(ws) ?? [];
    tr.push([now, p.x, p.y ?? 0, p.z]);
    while (tr.length > BODY_TRAIL_MAX || now - tr[0][0] > BODY_TRAIL_MS) tr.shift();
    all.delete(ws); all.set(ws, tr);
    if (all.size > 256) all.delete(all.keys().next().value);   // the longest silent goes first
  }
  /** A socket's trail in a fight's own frame (`frame` - a pose to `{x, z}`). None kept: undefined - it sent no pose since
   *  this instance began keeping them, so it stands where its last put it (posAt); AUDIT INT11: unless the instance is
   *  younger than a trail (woken, its trails lost to its sleep), when where it stood is not known: `[]`. */
  _trailOf(ws, frame) {
    const tr = this._trails?.get(ws);
    if (tr?.length) return tr.map(([t, x, y, z]) => { const c = frame({ x, y, z }); return [t, c.x, c.z, c.y ?? y]; });   // EG-H3 (EG3): THE TRAILS KEEP Y - the height after the frame's own two (net/bossRef.js posYAt reads it; posAt and posAfter read the two as before)
    return Date.now() - this._trailsAt < BODY_TRAIL_MS ? [] : undefined;
  }
  /** AUDIT INT11: a socket that has just become a fighter stands where its last pose put it FROM NOW - on its trail, so a
   *  landing before it is not read off a pose that may have come after. */
  _trailSeed(ws, a, now) { if (a?.pose && !this._trails?.has(ws) && this._trailing(a)) this._trailPose(ws, a.pose, now); }
  /** The fight's bodies for its brain - its census as the count has it, without the trails the judge read. */
  _bodiesBare(bodies) { return bodies.map((b) => { const bare = { ...b }; delete bare.tr; return bare; }); }
  /**
   * The blows the relay judged (net/bossRef.js) taken off each struck fighter's count (`line` - a body's or a hull's);
   * a fall by the count, once `enforce` holds, made the fight's own (`fell` - the Abyss Dungeon's one life, a ship's
   * wreck) and told to the fighter's game (`{t, k: 'bd'}` and `extra`) on each of its sockets here.
   */
  async _bodyCount(t, f, hits, now, line, fell = null, extra = {}) {
    const cfg = this._bodyLine();
    for (const { sub, share } of hits) {
      const p = f.players[sub];
      if (!p || !bodyStruck(p, share, now, line) || !cfg.enforce) continue;
      if (fell) await fell(sub);
      p.bd.ta = now;   // AUDIT INT11: told - bodyTellOwed's clock
      this._bodyWord(t, sub, extra);
    }
  }
  /** The count's fall (`{t, k: 'bd'}` and `extra`) to each of the fighter's sockets here. */
  _bodyWord(t, sub, extra = {}) {
    const word = JSON.stringify({ t, k: 'bd', ...extra });
    for (const [ws, b] of [...this._courtSockets()]) if (b.id && b.sub === sub) this._send(ws, word);   // SCALE5d part two: a copy's fighter's too (the court's own index elsewhere)
  }
  /** AUDIT INT11: THE FALL TOLD AGAIN to each fighter it is owed (bodyTellOwed - fallen by the count, its game not yet
   *  dead by it; `owed` the fight's own acknowledgement besides), once a beat at most every BODY_TELL_MS. */
  _bodyTell(t, f, now, extra = {}, owed = () => true) {
    if (!this._bodyLine().enforce) return;
    for (const [sub, p] of Object.entries(f.players)) if (owed(p) && bodyTellOwed(p, now, true)) this._bodyWord(t, sub, extra);
  }
  /** A fighter's measure for its receipt (bodyMeasure - `kept` the fight's own earning law, asked of it as it stood at
   *  the count's first fall), as the receipt's optional `m`. */
  _bodyMeasureOf(f, sub, earnedFn) {
    const m = bodyMeasure(f.players[sub], (q) => earnedFn({ ...f, players: { ...f.players, [sub]: q } }, sub));
    return m ? { m } : {};
  }
  /** The brain's frames to everyone in the room, in order. */
  _gateFan(frames) {
    if (!frames.length) return;
    // WB14e: a word for one account (`to` - a Tithe-Imp's tithe) goes to that fighter's sockets alone, `to` left off
    if (frames.some((fr) => fr.to != null)) {
      for (const fr of frames) if (fr.to != null) { const { to, ...word } = fr; const s = JSON.stringify({ t: 'gate', ...word }); for (const [ws, b] of [...this._courtSockets()]) if (b.sub === to) this._send(ws, s); }
      frames = frames.filter((fr) => fr.to == null);
      if (!frames.length) return;
    }
    const outs = frames.map((fr) => JSON.stringify({ t: 'gate', ...fr }));
    this._fanFrames(outs, (b) => b.id);   // SCALE5b: a beat one frame to the second wire
    if (this._cper.size) for (const s of outs) this._courtSendAll(s);   // SCALE5d part two: and to every copy, one entry each
  }
  /** AUDIT WB14 (WIRE-2): frames fanned KEPT BEFORE THEY ARE SAID when one is a tithe paid (`to`) - AUDIT WB A10's law for
   *  the receipts: said first, an eviction before the next checkpoint woke a fight whose Imp stood again, and caught again it
   *  paid a fresh seed (a tithe twice). */
  async _gateFanKept(f, frames, now) {
    if (frames.some((fr) => fr.to != null)) await this._gateSave(f, now, true);
    this._gateFan(frames);
  }
  /** The fight to storage - every CHECKPOINT_MS from the beat, at once on a join and on the kill. */
  async _gateSave(f, now, force) {
    if (!force && now - this._fightSavedAt < CHECKPOINT_MS) return;
    this._fightSavedAt = now;
    await this.state.storage.put('gatefight', f);
  }
  /** The beat is armed now unless it already is, sooner. */
  async _gateArm(now) {
    const at = await this.state.storage.getAlarm();
    if (at == null || at > now + BRAIN_TICK_MS) await this.state.storage.setAlarm(now + BRAIN_TICK_MS);
  }
  /** A gate frame in its room: `in` joins the fight and is answered with its whole state (and, after the kill, the
   *  fighter's receipt again); `hit` is a blow the brain judges. */
  async _gateFrame(ws, a, m, now) {
    const day = gateDayOfRoom(a.key);
    let f = await this._gateFightOf();
    if (m.k === 'in') {
      // AUDIT WBX R7: a client that does not know this brain's attacks is not let fight them (a tab loaded before the
      // deploy judged each new one a miss) - refused in words it has, and taken out of the court by its own law
      if (!(m.bv >= GATE_BRAIN_MIN)) { this._send(ws, JSON.stringify({ t: 'gate', k: 'no', m: 'the gate is closed' })); return; }
      if (!f) f = this._fight = GATE_SEAM.new({ day, now, wrathAt: gateTimes(day).wrathAt, boss: gateBossOf(day).id, md: gateModsOf(day), pt: gatePortentsOf(day), ti: gateTitheOf(day) });   // WB8b: the day's marks, kept on the fight; WB14b: and its portents; WB14e: and its Tithe-Imp's moment
      const joined = !f.players[a.sub];   // AUDIT WB A3: a newcomer - an `in` again (every welcome says one) changes nothing to keep
      // AUDIT PLAN-1000 G7: a full court's watcher asks every COURT_WATCH_ASK_MS - one that asks sooner (a modified client)
      // is answered as the last time and takes no seat ahead of the honest asks
      const full = joined && Object.keys(f.players).length >= GATE_FIGHTERS_MAX;
      const asked = (this._watchAsked ??= new WeakMap());
      if (full && now - (asked.get(ws) ?? -Infinity) < COURT_WATCH_ASK_MS - BRAIN_TICK_MS) { this._send(ws, JSON.stringify({ t: 'gate', k: 'no', m: 'the court is full' })); return; }
      const present = new Set();   // AUDIT WB A1: the accounts in the court now - a full fight frees an idle seat, never theirs
      // AUDIT PLAN-1000 G7: walked only when a newcomer meets a full fight with an idle seat to free (freeSeat's own law)
      if (full && Object.values(f.players).some((p) => !hasPart(p))) for (const [, b] of this._courtSockets()) if (b.id && b.sub) present.add(b.sub);   // SCALE5d part two: and in its copies
      if (!GATE_SEAM.join(f, a.sub, a.name ?? '', m.lv, now, present, { admits: gateAdmits(day, now) })) {
        const no = f.fell || f.wrath ? 'the gate is closing' : Object.keys(f.players).length >= GATE_FIGHTERS_MAX ? 'the court is full' : 'the gate is sealed';
        // AUDIT PLAN-1000 G8: a full court's watcher is handed the fight as it stands before the word that keeps it there
        if (no === 'the court is full') { asked.set(ws, now); this._send(ws, JSON.stringify({ t: 'gate', ...GATE_SEAM.stateOf(f) })); }
        this._send(ws, JSON.stringify({ t: 'gate', k: 'no', m: no }));
        return;
      }
      this._send(ws, JSON.stringify({ t: 'gate', ...GATE_SEAM.stateOf(f), me: 1 }));   // COURT-WATCH: the seat is mine - a watcher's `in` answered so fights
      this._trailSeed(ws, a, now);   // AUDIT INT11
      const r = f.rc?.[a.sub];
      if (r) this._send(ws, JSON.stringify({ t: 'gate', k: 'rcpt', r }));
      if (joined) await this._gateSave(f, now, true);   // AUDIT WB A3: at once for a newcomer alone - a reconnect storm was a write a frame
      if (!f.fell && !f.wrath) await this._gateArm(now);
      return;
    }
    // INT11: ITS BODY, in its own word - more than the count is a mend, believed out of its budget (net/bossBody.js); a
    // word from one no fight here counts is no junk (its `in` may be on its way) - it is not heard
    const line = this._bodyLine();
    if (m.k === 'vt') { if (f?.players[a.sub]) bodySaid(f.players[a.sub], m.v / 1000, now, line.body, { enforce: line.enforce }); return; }
    // a blow: from a fighter (a correct client says `in` first), from where its own pose stands - the dead strike nothing
    if (!f || !f.players[a.sub]) { this._junk(ws); return; }
    // GATE-HEAL: what another's spell healed in this fighter, and whose - the socket in this room the peer id names
    // (another fighter of this fight, else nobody: allies only); believed within its own heal bucket, from its own pose
    // (net/gate/gateBrain.js applyHeal). A figure for the round-up alone: it keeps no beat and wakes nothing.
    if (m.k === 'heal') {
      const pose = a.pose ? this._courtOf(a.pose) : null;   // the fallen too: a heal before a fall may be said after it
      const me = f.players[a.sub];
      for (const [by, n] of m.h) {
        const healer = this._courtIdFirst(by)?.[1]?.sub ?? null;   // SCALE5b: by the id index; SCALE5d part two: a copy's healer too
        // AUDIT INT11: and what was believed, the count's too - an ally's mend, never its own budget's (net/bossBody.js
        // bodyHealed), at the brain's own reference health (healRef - generous, so the share it reads is the least)
        const got = healer ? applyHeal(f, a.sub, healer, n, pose, now) : 0;
        if (got > 0) bodyHealed(me, got / healRef(me.lv), now, line.body, { enforce: line.enforce });
      }
      return;
    }
    // WB9c: a blow on a crystal of Oblivion - the brain's caps as a blow on him; a crystal broken, and the Reckoning
    // broken with the last of them, said to the court at once (its health goes out on the beat)
    // INT11: and one the count has fallen strikes nothing once `enforce` holds - the relay's word, as the pose's `dd` is
    const at = a.pose && !a.pose.dd && !bodyOut(f.players[a.sub], line.enforce) ? this._courtOf(a.pose) : null;
    if (m.k === 'xhit') this._gateFan(applyCrystalHit(f, a.sub, m.c, m.d, m.r, at, now, m.q));
    // WB11b: a blow on one of his host (the Legion-Lord's) - the same caps; one slain said to the court at once (its
    // health goes out on the beat)
    else if (m.k === 'ahit') await this._gateFanKept(f, applyHostHit(f, a.sub, m.i, m.d, m.r, at, now, m.q, rand01), now);   // WB14e: a Tithe-Imp caught pays here, by the relay's dice
    else {
      GATE_SEAM.hit(f, a.sub, m.d, m.r, at, now, m.q, m.b === 1 ? { b: 1 } : undefined);   // AUDIT WB11 W3: the blow's sequence - once a blow; WB14d: the half it lands on
      if (f.fell && !f.said) { await this._gateFall(f, now); return; }
    }
    // AUDIT WBX R6: a blow keeps the beat as an `in` does - a court that emptied slept until its day's end, and a client
    // that struck without a word first fought a Warden who never answered. AUDIT WB11 R1: a blow on a crystal or on one
    // of his host too - they returned before it, and a host struck so stood frozen, never walking or Biting
    if (!f.fell && !f.wrath && !(this._beatArmedTo > now)) { this._beatArmedTo = now + BRAIN_TICK_MS; await this._gateArm(now); }
  }
  /** ONE BEAT of a gate room's alarm: the brain stepped over the bodies in the court, its frames fanned, the kill said
   *  once, the fight checkpointed - and the next beat armed while the fight lives and someone is here (a room nobody
   *  stands in sleeps until an `in` wakes it), else the day's end, when the room forgets its fight. False when the room
   *  holds no fight (the alarm is somebody else's). */
  async _gateTick() {
    const f = await this._gateFightOf();
    if (!f) return false;
    const now = Date.now();
    void this._relayCfgFresh(now);   // SCALE5b: the line the count runs by, as the hub holds it - AUDIT SCALE II R1-2: asked ahead, never awaited by the beat
    const end = gateTimes(f.day).wrathAt + GATE_COLLAPSE_MS;
    if (now >= end) { this._fight = null; await this.state.storage.delete('gatefight'); return true; }
    try {
      // INT11: HIS BLOWS JUDGED HERE first, on the census as the count has it (the blows in flight are the ones every
      // screen drew - judged before the brain moves on from them), then the brain steps over it as it stands after
      // AUDIT INT11: the bodies read once a beat - the census run over them again for the brain, after the count moved
      const line = this._bodyLine(), bodies = this._gateBodies(f), census = () => bodyCensus(f, bodies, now, line.body, line.enforce);
      await this._bodyCount('gate', f, GATE_SEAM.judge(f, census(), now), now, line.body);
      this._bodyTell('gate', f, now);   // AUDIT INT11: a fall its game has not taken, told again
      await this._gateFanKept(f, GATE_SEAM.step(f, now, this._bodiesBare(census()), rand01), now);   // AUDIT WB14 (WIRE-2): a tithe owed, kept before it is said
      this._riteAskAhead(f, now);   // AUDIT WB12d (R2, L3): the rite's helpers asked of the hub ahead of the kill, never awaited by the beat
      if (f.fell && !f.said) await this._gateFall(f, now);
      else if (f.said && !f.told) await this._gateTellHubOnce(f, now);   // AUDIT WB A10: the hub told until it answers
      await this._gateSave(f, now, false);
    } catch (e) { console.warn('[gate] beat failed', e?.message ?? e); }
    const here = [...this._courtSockets()].some(([, b]) => b.id);   // SCALE5d part two: a copy's crowd keeps the beat as the court's does
    await this.state.storage.setAlarm(f.said && !f.told ? now + GATE_TELL_RETRY_MS : here && !f.fell && !f.wrath ? now + BRAIN_TICK_MS : end);
    return true;
  }
  /** THE KILL, SAID ONCE: `fell` to everyone in the court, a receipt to each account that earned one (bible section 6 -
   *  one per account, the seed the relay's own), the fight checkpointed with them, and the hub's world line.
   *  AUDIT WB A10: KEPT BEFORE IT IS SAID - the receipts minted and the fight checkpointed with them and its `said`, THEN
   *  the fall fanned and each receipt handed over. Said first, an eviction before the write told the court of a kill
   *  storage never kept (the wake resumed a living Warden) and minted every receipt again on new seeds. The hub is told
   *  until it answers (`told`, kept with the fight; a beat tells it again). */
  async _gateFall(f, now) {
    // AUDIT WB12d (R2, L2): ONE FALL AT A TIME - the hub's answer is a fetch, which lets every blow and beat that lands
    // meanwhile in; each found the Warden fallen and unsaid, and fell him again (new seeds, the kill fanned twice). Any
    // call while one is under way waits on it
    if (this._falling) return this._falling;
    this._falling = this._gateFallOnce(f, now).finally(() => { this._falling = null; });
    return this._falling;
  }
  async _gateFallOnce(f, now) {
    if (f.said) return;
    const key = await this._receiptKeyOf();
    const nowS = Math.floor(now / 1000);
    // WB12d: who broke the faithful's rite - an ember more each. AUDIT WB12d (L3): asked with a bound, and a hub that
    // does not answer leaves the last answer the beats were given (`f.helped`), never none
    const asked = await this._riteHelpersOf(f.day, RITE_ASK_TIMEOUT_MS);
    if (asked) f.helped = [...asked];
    const helped = new Set(f.helped ?? []);
    f.rc = {};
    for (const sub of Object.keys(f.players)) {
      if (!GATE_SEAM.earned(f, sub)) continue;
      try { f.rc[sub] = await mintReceipt({ d: f.day, b: f.boss, s: sub, c: rand32(), x: earnedBy(f, sub), l: f.players[sub].lv, ...(helped.has(sub) ? { r: 1 } : {}), ...this._bodyMeasureOf(f, sub, GATE_SEAM.earned), ...(receiptPortents(f) ? { p: receiptPortents(f) } : {}) }, key, { subtle: crypto.subtle, nowS }); }   // AUDIT WBX S2: the level the fight admitted it at; INT14: the count's measure
      catch (e) { console.warn('[gate] receipt refused', e?.message ?? e); }
    }
    // WB12d: one who broke the rite and took no part in the fight - a receipt of the rite alone (its ember, and nothing else)
    for (const sub of helped) {
      if (f.rc[sub]) continue;
      try { f.rc[sub] = await mintReceipt({ d: f.day, b: f.boss, s: sub, c: rand32(), x: 'rite' }, key, { subtle: crypto.subtle, nowS }); }
      catch (e) { console.warn('[rite] receipt refused', e?.message ?? e); }
    }
    f.said = true;
    // AUDIT WBX S4: who stood in the court at the kill - their spoils are its floor's, so the hub does not hand another
    // tab of theirs the same receipt first (it keeps it for their next hello all the same)
    f.here = [...new Set([...this._courtSockets()].filter(([, b]) => b.id && b.sub && f.rc[b.sub]).map(([, b]) => b.sub))].slice(0, GATE_FIGHTERS_MAX);   // SCALE5d part two: a copy's fighter stood in the court
    await this._gateSave(f, now, true);
    this._gateFan([{ k: 'fell', at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) }]);   // GATE-UX: the damage chart to the court alone (the hub's word stays the names)
    for (const [ws, b] of [...this._courtSockets()]) { const r = b.id && b.sub ? f.rc[b.sub] : null; if (r) this._send(ws, JSON.stringify({ t: 'gate', k: 'rcpt', r })); }   // SCALE5d part two: to a copy's fighter too
    await this._gateTellHubOnce(f, now);
  }
  /** AUDIT WB A10: the hub told of the kill, and it kept - once it has answered. */
  async _gateTellHubOnce(f, now) {
    if (f.told || !f.fell) return;
    if (!(await this._gateTellHub({ d: f.day, at: f.fell.at, top: f.fell.top, n: f.fell.n, rc: Object.entries(f.rc ?? {}), here: f.here ?? [] }))) return;
    f.told = true;
    await this._gateSave(f, now, true);
  }
  /**
   * SEAT1b: THE WATCH'S TICK (Seats-Arc 4.2: "Relay-witnessed socket; the position is the client's own claim, so it is
   * bounded"). `moved` whether this pose moved; a tick is due each WATCH_TICK_MS while the account moved in the last
   * WATCH_MOVED_MS (net/watchReceipt.js watchDue). The receipt names the account and the map pixel the pose stands in -
   * `cellRoomOfWire`'s own arithmetic, no game data - and a fresh nonce; the account service decides whether that pixel is
   * a seat's and whether the account's guild pledged there. A pose off the map mints nothing.
   */
  async _watchTick(ws, sub, p, moved, now) {
    let w = this._watch.get(sub);
    if (!w) {
      if (this._watch.size >= SOCKETS_MAX) this._watch.delete(this._watch.keys().next().value);
      this._watch.set(sub, (w = { at: -Infinity, moved: -Infinity }));
    } else { this._watch.delete(sub); this._watch.set(sub, w); }   // SCALE2b: a watch in use goes to the back - the bound lets the stalest go, never a player still standing here
    if (moved) w.moved = now;
    if (!watchDue(w, now)) return;
    const [x, y] = mapPixelOfWire(p.x, p.z);
    if (!watchPixelOk(x, y)) return;   // AUDIT ETHER-OW C2-1: the Watch's ground, one home (its answers as they were)
    w.at = now;
    let r;
    try { r = await mintWatchReceipt({ s: sub, x, y, c: rand32() }, await this._receiptKeyOf(), { subtle: crypto.subtle, nowS: Math.floor(now / 1000) }); } catch { return; }
    this._send(ws, JSON.stringify({ t: 'watch', r }));
  }
  /** The relay's signing key, imported once (a CryptoKey cannot be stored; a deploy is a new object). */
  async _receiptKeyOf() {
    if (this._receiptKey === undefined) {
      this._receiptKey = await importReceiptKey(this.env.GATE_SIGNING_KEY, { subtle: crypto.subtle });
      if (!this._receiptKey && this.env.GATE_SIGNING_KEY) console.warn('[gate] GATE_SIGNING_KEY will not import - the receipts go out unsigned');
    }
    return this._receiptKey;
  }
  /** The hub's door: the kill and its receipts, to the one room every player online is in. A relay built without the
   *  binding (a harness, a local dev worker) keeps the court's own word. Answers whether the word is where it goes
   *  (AUDIT WB A10: the hub's own `ok`; no binding is nothing to retry). */
  async _gateTellHub(body) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return true;
    try { const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) })); return !!res?.ok; }
    catch (e) { console.warn('[gate] hub', e?.message ?? e); return false; }
  }
  /** AUDIT WB A4: the hub hands an account's kept receipt to its hello while the receipt is good, and forgets an expired
   *  one. AUDIT WBX S1: and one its account has said is spent (`_gateSpent`) - a receipt said again was NOT harmless: a
   *  second device's store had not spent it, and rolled its spoils again. */
  async _gateReceiptTo(ws, sub, now) {
    if (this._noGateRcpt.has(sub)) return;   // SCALE2b: asked before and none held - no write since says otherwise
    const k = gateReceiptKey(sub);
    const kept = await this.state.storage.get(k);
    if (!kept || typeof kept !== 'object') { this._noGateRcpt.set(sub, 1); return; }
    if (!(Number.isFinite(kept.e) && now < kept.e * 1000)) { await this.state.storage.delete(k); return; }
    if (kept.spent) return;   // AUDIT WBX2 M3: its account's word that it is spent, kept in its place
    if (Number.isFinite(kept.hold) && now < kept.hold) return;   // AUDIT WBX2 M4: its fighter's own court spends it first
    if (typeof kept.r !== 'string') { await this.state.storage.delete(k); return; }
    this._send(ws, JSON.stringify({ t: 'gate', k: 'rcpt', r: kept.r }));
  }
  /** AUDIT WBX S1: the account's word that a day's receipt is spent - its kept copy of that day forgotten (a newer
   *  day's is left alone). AUDIT WBX2 M3: forgotten by being REMEMBERED AS SPENT, for a receipt's life - a word that came
   *  before the kill's own (a tell the hub missed, told again GATE_TELL_RETRY_MS later) found nothing to forget, and the
   *  copy stored after it went to the account's every other device for a week. The mark stands in the copy's place: a
   *  hello is handed nothing, and the kill's word stores no copy over it. */
  async _gateSpent(sub, day, now = Date.now()) {
    const k = gateReceiptKey(sub);
    const kept = await this.state.storage.get(k);
    const d = kept && typeof kept === 'object' && Number.isSafeInteger(kept.d) ? kept.d : null;
    if (d !== null && (d > day || (d === day && kept.spent))) return;   // a newer day's is its own; said already
    await this.state.storage.put(k, { d: day, spent: true, e: Math.floor(now / 1000) + RECEIPT_TTL_S });
  }
  /** The hub's last word of a kill (null for none) - the instance's, else storage's. */
  async _gateFellOf() {
    if (this._gateFell === undefined) { const v = await this.state.storage.get('gatefell'); this._gateFell = v && typeof v === 'object' ? v : null; }
    return this._gateFell;
  }
  /** THE HUB'S HALF: a gate's kill, from the gate's own object. Everyone online hears it (their gate collapses, their
   *  chat says it), a fighter outside the court - cast out, or away from it - is handed their receipt here, and the
   *  word is kept for a hello while that gate still holds. Projected through the wire's own law, as a client would. */
  async _gateFellInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const fell = validGateOut({ k: 'fell', d: body?.d, at: body?.at, top: body?.top, n: body?.n });
    if (!fell || fell.d === undefined) return json({ ok: false }, 400);
    this._gateFell = fell;
    await this.state.storage.put('gatefell', fell);
    const said = JSON.stringify({ t: 'gate', ...fell });
    const rc = new Map();
    for (const e of Array.isArray(body.rc) ? body.rc : []) {
      const r = Array.isArray(e) && typeof e[0] === 'string' ? validGateOut({ k: 'rcpt', r: e[1] }) : null;
      if (r) rc.set(e[0], r);
    }
    // AUDIT WBX S4: the court's fighters (`here`) have theirs from the court
    const here = new Set(Array.isArray(body.here) ? body.here.filter((x) => typeof x === 'string').slice(0, 256) : []);
    // AUDIT WB A4: EACH ACCOUNT'S RECEIPT IS KEPT, for its own life (its `e`), and handed to that account's next hello -
    // a fighter who was not online when the kill was said (cast out and gone, a dropped link) had it only if they
    // walked back into the court while it held. One key an account, its latest receipt; 128 a write (storage's own bound).
    // AUDIT WBX2 M3: never over its account's word that this day's is spent (that word may come first), nor over a newer
    // day's; M4: a court fighter's is kept from their hellos GATE_HERE_HOLD_MS - their court's floor spends it
    const now = Date.now();
    const keep = [];
    this._noGateRcpt.clear();   // SCALE2b: receipts are being written - nobody's 'none' stands
    for (const [sub, r] of rc) { const c = readReceipt(r.r); if (c && c.s === sub) keep.push([gateReceiptKey(sub), { d: fell.d, r: r.r, e: c.e, ...(here.has(sub) ? { hold: now + GATE_HERE_HOLD_MS } : {}) }, sub]); }
    const had = new Map();
    for (let i = 0; i < keep.length; i += 128) for (const [k, v] of await this.state.storage.get(keep.slice(i, i + 128).map(([k]) => k))) had.set(k, v);
    const done = new Set();
    const fresh = keep.filter(([k, , sub]) => {
      const v = had.get(k);
      const stale = v && typeof v === 'object' && Number.isSafeInteger(v.d) && (v.d > fell.d || (v.d === fell.d && v.spent));
      if (stale) done.add(sub);
      return !stale;
    });
    for (let i = 0; i < fresh.length; i += 128) await this.state.storage.put(Object.fromEntries(fresh.slice(i, i + 128).map(([k, v]) => [k, v])));
    // AUDIT WBX S4: ONE TAB AN ACCOUNT, AND NOT ONE IN THE COURT. Every socket of the account was handed the receipt, so
    // two tabs both gave its spoils (each checking a store the other had not written yet), and a tab in town gave them
    // before the fighter's own burst on the court's floor found them already spent. Any other account's newest socket
    // (AUDIT SOC B9's law) is handed its receipt - not one whose account has said it is spent (AUDIT WBX2 M3)
    const newest = new Map();
    for (const [ws, b] of [...this._all()]) {
      if (!b.id) continue;
      this._send(ws, said);
      if (!b.sub || !rc.has(b.sub) || here.has(b.sub) || done.has(b.sub)) continue;
      const had = newest.get(b.sub);
      if (!had || (b.since ?? 0) >= (had.b.since ?? 0)) newest.set(b.sub, { ws, b });
    }
    for (const [sub, { ws }] of newest) this._send(ws, JSON.stringify({ t: 'gate', ...rc.get(sub) }));
    try { await this._heraldOwe(fell, now); } catch (e) { console.warn('[herald] kill not kept', e?.message ?? e); }   // DISCORD-GATES: and to the channel
    return json({ ok: true });
  }

  // ───────────────────────────── SERPENT1: THE SEA SERPENT ─────────────────────────────
  // bible/11-Multiplayer/Sea-Serpent.md section 6. A fight lives in the CELL its site stands in (the client finds the
  // site over the map files - systems/serpent/serpentSite.js - and says it with its `in`). AUDIT SERPENT S1: THE SITE IS THE
  // CLIENT'S WORD (the relay holds no map), so the cell keeps ONE FIGHT A SITE (net/serpent/serpentLaw.js serpentSiteKey), at
  // most SERPENT_SITES_MAX a day: a forged site stands a fight of its own, and its kill is said for its own site alone.
  // AUDIT SERPENT 2 F1: every word a fight says names its site (_serpentFan), and a client folds its own site's alone
  // (net/serpent/serpentLink.js) - whichever cell's socket of its hears another's. The beats ride the cell's alarm beside the
  // cell's own duties (alarm()); a fight's words go to the sockets that hear it (_serpentHears).
  /** The fights this cell holds, by id (`day@site`) - the instance's while it is awake, else storage's: each one's last
   *  checkpoint, its attack numbers carried past any it said since (AUDIT SERPENT S9 - serpentWoke). */
  async _serpentFights() {
    if (this._serpents === undefined) {
      const ids = await this.state.storage.get(SERPENT_FIGHTS_KEY);
      const list = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string').slice(0, 4 * SERPENT_SITES_MAX) : [];
      const got = list.length ? await this.state.storage.get(list.map(serpentStoreKey)) : new Map();
      const fights = new Map();
      for (const id of list) { const f = got.get(serpentStoreKey(id)); if (f && typeof f === 'object') fights.set(id, serpentBrain.serpentWoke(f)); }
      this._serpents = fights;
    }
    return this._serpents;
  }
  /** The fights' ids, to storage - a fight born or forgotten. */
  async _serpentIndex(fights) { await this.state.storage.put(SERPENT_FIGHTS_KEY, [...fights.keys()]); }
  /** A fight forgotten - the instance's and storage's. */
  async _serpentForget(fights, id) {
    fights.delete(id);
    this._serpentSavedAt.delete(id);
    await this.state.storage.delete(serpentStoreKey(id));
    await this._serpentIndex(fights);
  }
  /** A pose (native units) in a fight's site frame, metres. */
  _serpentFrameOf(f, p) { return { x: (p.x - f.sx) / SERPENT_NATIVE_PER_M, z: (p.z - f.sz) / SERPENT_NATIVE_PER_M }; }
  /** The fight here that counts this account a fighter - the newest day's - as [id, fight], or null. An account fights at
   *  one site a day in a cell (_serpentIn). */
  _serpentFightBy(fights, sub) {
    let by = null;
    for (const [id, f] of fights) if (f.players[sub] && (!by || f.day > by[1].day)) by = [id, f];
    return by;
  }
  /** A fight's bodies about its waters now: one a fighter (its NEWEST socket speaks for it - AUDIT SOC B9's law, the
   *  roll call's own _siegeSockets), where its last pose stands in the site frame, whether that pose says it died, and
   *  when its sender said it (`ts` - AUDIT SHIPS A1: the serpent leads its marks by the way she makes between them). */
  _serpentBodies(f, trailed = false) {
    const out = [];
    for (const [sub, [ws, b]] of this._siegeSockets()) {
      if (!b.pose || !f.players[sub] || f.players[sub].stale) continue;   // AUDIT SHIPS C2: nor gone at
      const c = this._serpentFrameOf(f, b.pose);
      out.push({ sub, x: c.x, z: c.z, dead: !!b.pose.dd, ...(Number.isFinite(b.pose.ts) ? { ts: b.pose.ts } : {}), ...(trailed ? { tr: this._trailOf(ws, (p) => this._serpentFrameOf(f, p)) } : {}) });   // AUDIT SHIPS A1: the pose's send time - the brain reads her way off it; INT13: `trailed`, the trail of the socket that speaks for her (AUDIT INT11)
    }
    return out;
  }
  /** INT13: a ship the count has wrecked, once `enforce` holds - wrecked by the relay's word (serpentWreck: her share out,
   *  her coil let go), said to the fight. AUDIT INT13: and noted as the count's (`cw`) - the count floats her again, not
   *  her own word, which her game says once, as she floats, and may have said while the count still held her. */
  async _serpentCountWreck(fights, id, f, sub, now) {
    const out = [];
    if (serpentBrain.serpentWreck(f, sub, 1, now, out)) f.players[sub].cw = 1;
    await this._serpentSay(fights, id, f, out, now);
  }
  /** AUDIT INT13: a ship at (`x`, `z`, the site's frame) back at the fight after SERPENT_ABSENT_RETIRE_MS away is a new
   *  hull (bodyLife, her measure kept) - and a wreck the count held her in, afloat (_serpentRefloat). Asked by the beat and
   *  by her `in`, whichever sees her back first (each refreshes `seenAt`). */
  async _serpentHullBack(fights, id, f, sub, x, z, now) {
    const p = f.players[sub];
    if (!p?.bd || Math.hypot(x, z) > serpentBrain.ENGAGE_R || !(now - (p.seenAt ?? p.joinedAt) > serpentBrain.SERPENT_ABSENT_RETIRE_MS)) return;
    bodyLife(p, now, this._bodyLine().hull);
    await this._serpentRefloat(fights, id, f, sub, now);
  }
  /** AUDIT INT13: A SHIP THE COUNT WRECKED, FLOATED BY IT AGAIN (her patches past HULL_REFLOAT, or a new hull - back from
   *  her yard): afloat by the relay's word, her share back - when the wreck is still the count's (`cw`: her game never
   *  said one of its own), or her own `wr 0` came while the count held her (`wf`, kept). Her game says `wr 0` ONCE, as her
   *  machine floats her, and the count's float comes a word later: unheard, it was never said again, and the relay kept
   *  her a wreck for the fight - her share out, never gone at, never struck again. Answers whether she floated. */
  async _serpentRefloat(fights, id, f, sub, now) {
    const p = f.players[sub];
    if (!(p?.cw || p?.wf) || bodyDown(p)) return false;
    delete p.cw; delete p.wf;
    const out = [];
    serpentBrain.serpentWreck(f, sub, 0, now, out);
    await this._serpentSay(fights, id, f, out, now);
    return true;
  }
  /**
   * Does this socket hear the fight `id`? AUDIT SERPENT S1: a socket whose `in` named a site this day (`sps` - a ship
   * refused a seat still watches) hears that site's fight alone; else its account's fight; else a pose within FAN_R of
   * the fight's waters. AUDIT SERPENT 2 F1: two fights about one pose are both heard - each word names its site, and the
   * client folds its own (S1 heard neither, and could not reach a fight in another cell at all).
   */
  _serpentHears(id, f, b) {
    if (!b.id) return false;
    if (b.sps && b.spd === f.day) return b.sps === id;
    if (b.sub && f.players[b.sub]) return true;
    if (!b.pose) return false;
    const c = this._serpentFrameOf(f, b.pose);
    return Math.hypot(c.x, c.z) <= serpentBrain.FAN_R;
  }
  /** A fight's frames to everyone who hears it, in order - AUDIT SERPENT 2 F1: each naming the fight's site. */
  _serpentFan(fights, id, f, frames) {
    if (!frames.length) return;
    this._fanFrames(frames.map((fr) => JSON.stringify({ t: 'serpent', ...fr, sx: f.sx, sz: f.sz })), (b) => this._serpentHears(id, f, b));   // SCALE5b: a beat one frame to the second wire
  }
  /** AUDIT 2 XB6 (2026-10-06): a fight's words said - the fight kept first when one lays what every screen draws
   *  (serpentBrain.js serpentSaysTrack), so a relay restarted wakes it no earlier than any screen holds it. */
  async _serpentSay(fights, id, f, frames, now) {
    if (serpentBrain.serpentSaysTrack(frames)) await this._serpentSave(id, f, now, true);
    this._serpentFan(fights, id, f, frames);
  }
  /** A fight to storage - every CHECKPOINT_MS from the beat, at once on a join, on the kill and before a word that lays its
   *  track (_serpentSay). */
  async _serpentSave(id, f, now, force) {
    if (!force && now - (this._serpentSavedAt.get(id) ?? 0) < serpentBrain.SERPENT_CHECKPOINT_MS) return;
    this._serpentSavedAt.set(id, now);
    await this.state.storage.put(serpentStoreKey(id), f);
  }
  /** The beat armed now unless it already is, sooner (the cell's other duties run on it - alarm()). */
  async _serpentArm(now) {
    if (this._serpentArmedTo > now) return;
    this._serpentArmedTo = now + serpentBrain.SERPENT_TICK_MS;
    const at = await this.state.storage.getAlarm();
    if (at == null || at > now + serpentBrain.SERPENT_TICK_MS) await this.state.storage.setAlarm(now + serpentBrain.SERPENT_TICK_MS);
  }
  /**
   * AUDIT SERPENT S1: room for a new site's fight among the day's: room while it holds fewer than SERPENT_SITES_MAX,
   * else the id of one to let go - one sounded, else one no fighter has a part in and nobody keeps about its waters -
   * else null (the fourth site is refused). AUDIT SERPENT 2 F6: A SLAIN SERPENT IS NEVER LET GO for another site's fight -
   * its waters are slain until the storm seals them, after which no fight is born here at all: let go at its kill, any
   * `in` its hub's word missed stood it again at full health. And a fight one ship keeps is never idle - a lone honest
   * ship's first half-minute (no part yet) gave way to a forged site's, and her next `in` bore it again, over and over.
   */
  _serpentRoomFor(fights, day) {
    const today = [...fights].filter(([, f]) => f.day === day);
    if (today.length < SERPENT_SITES_MAX) return true;
    const over = today.find(([, f]) => f.gone && !f.fell);
    if (over) return over[0];
    const idle = today.find(([, f]) => !f.fell && !Object.values(f.players).some(serpentBrain.serpentHasPart)
      && !this._serpentBodies(f).some((b) => Math.hypot(b.x, b.z) <= serpentBrain.FAN_R));
    return idle ? idle[0] : null;
  }
  /**
   * A serpent word in its cell. `in` (the day, the brain's law, the level, the hull, the site): _serpentIn. `hit`: a
   * gathered volley the brain judges from where the socket's own pose stands. `wr`: the ship wrecked or afloat again.
   * `held`/`esc`: the coiled ship's word. Each goes to the fight its account fights in here - AUDIT SERPENT S7/H1: and a
   * word from an account no fight here counts (a ship refused a seat, its volleys already in the air; a fight let go) is
   * not heard - never junk: a correct client says it.
   */
  async _serpentFrame(ws, a, m, now) {
    // AUDIT SCALE II R3-3: NO SERPENT IN A LAYER. A cell layers (SCALE5d), and a fight is its cell object's: each layer
    // stood a serpent of its own for the same day and site - the same fight id - with its own health, fighters and kill,
    // and a layer's kill told the hub, which said the serpent fell to everyone online while the place's fought on. The
    // fight is the place's alone: a layer's `in` is answered as the waters' own refusal when they hold no more ships
    // (the client's SERPENT_NO_TEXT - true of a place past full), its every other word nothing (it holds no fight to
    // name). Nothing is read or kept in a layer's storage for it
    if (a.ly) { if (m.k === 'in') this._send(ws, JSON.stringify({ t: 'serpent', k: 'no', m: 'the waters are full' })); return; }
    const fights = await this._serpentFights();
    if (m.k === 'in') { await this._serpentIn(ws, a, m, now, fights); return; }
    const by = this._serpentFightBy(fights, a.sub);
    if (!by) return;
    const [id, f] = by;
    if (f.players[a.sub]?.stale) return;   // AUDIT SHIPS C2: a game told to reload is not heard until it has
    // INT13: HER HULL, in her own word (net/bossBody.js - its line the hull's: her carpenters' patches, believed out of a
    // budget, and afloat again past HULL_REFLOAT); and once `enforce` holds a ship the count wrecked fires nothing, nor
    // floats again by her word alone. AUDIT INT13: heard before the fight is taken up - a hull's word, four a second, is no
    // engagement: it woke a sleeping fight and returned before its beat was armed (the serpent swimming, striking nothing)
    const line = this._bodyLine();
    if (m.k === 'vt') {
      bodySaid(f.players[a.sub], m.v / 1000, now, line.hull, { enforce: line.enforce, up: HULL_REFLOAT, hull: true });
      const me = f.players[a.sub];
      if (!(me?.cw || me?.wf) || bodyDown(me)) return;
      await this._serpentSay(fights, id, f, serpentBrain.serpentResume(f, now), now);
      await this._serpentRefloat(fights, id, f, a.sub, now);   // AUDIT INT13: the count floated her
      if (!f.fell && !f.gone) await this._serpentArm(now);
      return;
    }
    await this._serpentSay(fights, id, f, serpentBrain.serpentResume(f, now), now);   // SERPENT3: judged on a fight taken up, never one asleep
    const sunk = line.enforce && !!f.players[a.sub]?.bd?.dn;
    if (m.k === 'hit') {
      // AUDIT INT11: and from the socket that speaks for her body alone (the census's - its newest here): a second socket of
      // hers in this cell, posing far off as the one judged, struck from near
      const own = this._siegeSocketOf(a.sub)?.[0] === ws;
      const pose = a.pose && !a.pose.dd && !sunk && own ? this._serpentFrameOf(f, a.pose) : null;   // the dead strike nothing
      // the kill is said by _serpentFall alone, its receipts minted and kept first (AUDIT WB A10's law) - never the brain's word of it here
      await this._serpentSay(fights, id, f, SERPENT_SEAM.hit(f, a.sub, m.d, m.r, pose, now, null, { z: m.z }).filter((o) => o.k !== 'fell'), now);   // SERPENT4: `r` 1 - a hand's own weapons
      if (f.fell && !f.said) { await this._serpentFall(id, f, now); return; }
    } else if (m.k === 'wr') {
      // AUDIT 2 XC5: a coil holding her lets her go. AUDIT INT13: her own word of a wreck makes it hers (`cw` gone - the
      // count's float floats her no more); her `wr 0` while the count holds her is kept (`wf`) for the float it waits on
      const me = f.players[a.sub];
      if (m.w || !sunk) { delete me.cw; delete me.wf; const out = []; serpentBrain.serpentWreck(f, a.sub, m.w, now, out); await this._serpentSay(fights, id, f, out, now); }
      else me.wf = 1;
    }
    else await this._serpentSay(fights, id, f, serpentBrain.coilWord(f, a.sub, m.k, m.i, m.x, m.z, now), now);
    if (!f.fell && !f.gone) await this._serpentArm(now);
  }
  /**
   * An `in`: its receipt again to a fighter who has one; refused for a game older than the brain, a day the clock is not
   * about, a site in another cell (junk - a correct client says it in the site's own cell), a pose away from its waters,
   * an account already fighting at another site here this day, a fourth site (S1). The site's fight stood at its first
   * `in` while its waters are open, the socket set to hear it (`sps`), the fighter joined - and the whole state to the
   * one who said it either way (a ship that came too late still sees it). AUDIT SERPENT E4: the level is never above the
   * token's own character level (`cl`); S8: only an `in` from within ENGAGE_R counts as being at the fight.
   */
  async _serpentIn(ws, a, m, now, fights) {
    const no = (why) => this._send(ws, JSON.stringify({ t: 'serpent', k: 'no', m: why }));
    const t = serpentAt(now);
    const id = serpentFightId(m.d, serpentSiteKey(m.sx, m.sz));
    let f = fights.get(id) ?? null;
    if (f?.rc?.[a.sub]) this._send(ws, JSON.stringify({ t: 'serpent', k: 'rcpt', r: f.rc[a.sub] }));
    // AUDIT SHIPS C2: a game before the brain's law is told to reload - and until it says an `in` on the law, the account
    // is not heard nor gone at in the fight it is in (a fight read back across the relay's deploy kept its fighters, whose
    // old tabs drew the new law's whirl at the heart and took a pair's blows whole, and fought on)
    const was = this._serpentFightBy(fights, a.sub);
    if (!(m.bv >= SERPENT_BRAIN_MIN)) { if (was) was[1].players[a.sub].stale = true; no('reload'); return; }
    if (was?.[1].players[a.sub]?.stale) delete was[1].players[a.sub].stale;
    if (m.d !== t.day || !serpentHolds(t.day, now)) { if (!f?.rc?.[a.sub]) no('the serpent is gone'); return; }
    if (cellRoomOfWire(m.sx, m.sz) !== a.key) { this._junk(ws); return; }
    if (!a.pose || a.pose.dd) return;
    const site = f ?? { sx: m.sx, sz: m.sz };
    const at = this._serpentFrameOf(site, a.pose), off = Math.hypot(at.x, at.z);
    if (off > serpentBrain.ADMIT_R) { no('too far from its waters'); return; }
    const mine = this._serpentFightBy(fights, a.sub);
    if (mine && mine[0] !== id && mine[1].day === t.day) { no('the waters are full'); return; }
    let born = false;
    if (!f) {
      if (!serpentAdmits(t.day, now)) { no('the serpent is gone'); return; }   // SERPENT4: open until it dives - past that it is gone
      const room = this._serpentRoomFor(fights, t.day);
      if (room === null) { no('the waters are full'); return; }
      if (room !== true) await this._serpentForget(fights, room);
      f = SERPENT_SEAM.new({ day: t.day, now, soundAt: t.soundAt, boss: serpentBossOf(t.day).id, sx: m.sx, sz: m.sz, yaw: serpentRiseYaw(t.day) });
      fights.set(id, f);
      await this._serpentIndex(fights);
      born = true;
    }
    // SERPENT3: a fight its room let sleep (nobody heard it) taken up circling where it was before anyone is told it
    else await this._serpentSay(fights, id, f, serpentBrain.serpentResume(f, now), now);
    this._setAttach(ws, { ...(this._all().get(ws) ?? a), sps: id, spd: t.day });
    const present = new Set();
    for (const [, sock] of this._all()) if (sock.id && sock.sub) present.add(sock.sub);   // the accounts about the cell now - a full fight frees a seat no one holds
    const joined = !f.players[a.sub];
    if (!joined) await this._serpentHullBack(fights, id, f, a.sub, at.x, at.z, now);   // AUDIT INT13: back from her yard - before the join counts her seen
    const lv = Number.isSafeInteger(a.cl) && a.cl >= 1 ? Math.min(m.lv, a.cl) : m.lv;
    if (!SERPENT_SEAM.join(f, a.sub, a.name ?? '', lv, now, present, { hl: m.hl, admits: serpentAdmits(t.day, now), near: off <= serpentBrain.ENGAGE_R })) {
      this._send(ws, JSON.stringify({ t: 'serpent', ...SERPENT_SEAM.stateOf(f) }));
      no(f.fell ? 'it is already slain' : Object.keys(f.players).length >= serpentBrain.SERPENT_FIGHTERS_MAX ? 'the waters are full' : 'the serpent is gone');   // SERPENT4: no storm closes its waters
      return;
    }
    this._send(ws, JSON.stringify({ t: 'serpent', ...SERPENT_SEAM.stateOf(f) }));
    this._trailSeed(ws, a, now);   // AUDIT INT11
    if (joined || born) await this._serpentSave(id, f, now, true);
    if (!f.fell && !f.gone) await this._serpentArm(now);
  }
  /**
   * ONE BEAT of a serpent's cell: each fight's brain stepped over the bodies about it, its frames fanned, its kill said
   * once, it checkpointed - and forgotten at its keeping's end. Answers null when the cell holds no fight (the alarm is
   * the cell's other duties'), else when the next firing is due and whether a fight still beats (`live`): every
   * TICK_MS while one lives and someone hears it, the hub told again while it has not answered, else the soonest end.
   */
  async _serpentTick() {
    const fights = await this._serpentFights();
    if (!fights.size) return null;
    const now = Date.now();
    void this._relayCfgFresh(now);   // SCALE5b: the line the count runs by, as the hub holds it - AUDIT SCALE II R1-2: asked ahead, never awaited by the beat
    let at = Infinity, live = false;
    for (const [id, f] of [...fights]) {
      const end = f.soundAt + SERPENT_DIVE_MS + SERPENT_KEEP_MS;
      if (now >= end) { await this._serpentForget(fights, id); continue; }
      try {
        // AUDIT SERPENT 2 F8: a fight checkpointed as it is stepped (its sounding at once) - a slain or sounded one is
        // still, its kill and its hub's answer saved as they come; every kept one was written again every 2 s
        const stepped = !f.fell && !f.gone;
        if (stepped) {
          // INT13: ITS BLOWS ON HER HULL JUDGED HERE first (net/bossRef.js judgeSerpent) - a wreck by the count, enforced,
          // the fight's own (_serpentCountWreck) and told to her game
          const line = this._bodyLine(), bodies = this._serpentBodies(f, true);   // AUDIT INT11: read once a beat
          // AUDIT INT13: A SHIP BACK AT THE FIGHT after SERPENT_ABSENT_RETIRE_MS away is a NEW HULL - she sailed for her yard,
          // or came on another; the count of the hull she left with is not hers (bodyLife, her measure kept). Kept, a yard's
          // whole hull read as a patch past the line, and the count wrecked a ship whose hull stood at seven tenths
          for (const b of bodies) if (!b.dead) await this._serpentHullBack(fights, id, f, b.sub, b.x, b.z, now);
          await this._bodyCount('serpent', f, SERPENT_SEAM.judge(f, bodies, now), now, line.hull, (sub) => this._serpentCountWreck(fights, id, f, sub, now), { sx: f.sx, sz: f.sz });
          this._bodyTell('serpent', f, now, { sx: f.sx, sz: f.sz }, (p) => !!p.cw);   // AUDIT INT11: her game has not wrecked her (her own `wr 1` takes `cw`)
          const said = SERPENT_SEAM.step(f, now, this._bodiesBare(bodies), rand01);
          // AUDIT 2 XB6 (2026-10-06): kept before it is said when a word lays its track (_serpentSay's law, the beat's
          // own checkpoint with it - written once; its sounding's `gone` is one, so it is written at once)
          await this._serpentSave(id, f, now, serpentBrain.serpentSaysTrack(said));
          this._serpentFan(fights, id, f, said);
        }
        if (f.fell && !f.said) await this._serpentFall(id, f, now);
        else if (f.said && !f.told) await this._serpentTellHubOnce(id, f, now);
      } catch (e) { console.warn('[serpent] beat failed', e?.message ?? e); }
      const heard = [...this._all()].some(([, b]) => this._serpentHears(id, f, b));
      if (f.said && !f.told) at = Math.min(at, now + SERPENT_TELL_RETRY_MS);
      else if (heard && !f.fell && !f.gone) { at = Math.min(at, now + serpentBrain.SERPENT_TICK_MS); live = true; }
      else at = Math.min(at, end);
    }
    return fights.size ? { at, live } : null;
  }
  /** THE KILL, SAID ONCE (the gate's AUDIT WB A10 law): the receipts minted for every account that earned one and the
   *  fight checkpointed with them and its `said`, THEN the fall fanned and each receipt handed to its account's sockets
   *  here, then the hub told (until it answers). One fall at a time a fight (AUDIT WB12d R2). */
  async _serpentFall(id, f, now) {
    const had = this._serpentFalling.get(id);
    if (had) return had;
    const p = this._serpentFallOnce(id, f, now).finally(() => { this._serpentFalling.delete(id); });
    this._serpentFalling.set(id, p);
    return p;
  }
  async _serpentFallOnce(id, f, now) {
    if (f.said) return;
    const key = await this._receiptKeyOf();
    const nowS = Math.floor(now / 1000);
    f.rc = {};
    for (const sub of Object.keys(f.players)) {
      if (!SERPENT_SEAM.earned(f, sub)) continue;
      const p = f.players[sub];
      try { f.rc[sub] = await mintSerpentReceipt({ d: f.day, b: f.boss, s: sub, c: rand32(), x: serpentBrain.serpentEarnedBy(f, sub), h: p.hl, l: p.lv, ...this._bodyMeasureOf(f, sub, SERPENT_SEAM.earned) }, key, { subtle: crypto.subtle, nowS }); }   // INT14: the count's measure
      catch (e) { console.warn('[serpent] receipt refused', e?.message ?? e); }
    }
    f.said = true;   // said once, whatever the next beat finds
    // the accounts handed their receipt here - the hub hands it to every other earner's newest socket (AUDIT SERPENT S5)
    f.here = [...new Set([...this._all()].filter(([, b]) => b.id && b.sub && f.rc[b.sub]).map(([, b]) => b.sub))].slice(0, serpentBrain.SERPENT_FIGHTERS_MAX);
    await this._serpentSave(id, f, now, true);
    const { at: fellAt, top, n, dm } = f.fell;
    this._serpentFan(this._serpents, id, f, [{ k: 'fell', at: fellAt, top, n, ...(dm ? { dm } : {}) }]);
    for (const [ws, b] of [...this._all()]) { const r = b.id && b.sub ? f.rc[b.sub] : null; if (r) this._send(ws, JSON.stringify({ t: 'serpent', k: 'rcpt', r })); }
    await this._serpentTellHubOnce(id, f, now);
  }
  /** The hub told of the kill - its site, and every receipt with the accounts handed theirs here - and it kept, once it
   *  has answered. */
  async _serpentTellHubOnce(id, f, now) {
    if (f.told || !f.fell) return;
    const rooms = this.env?.ROOMS;
    let ok = true;   // a relay built without the binding (a harness, a local worker) keeps the cell's own word
    if (rooms?.idFromName && rooms?.get) {
      try {
        // SERPENT4: and the fight's kin - who came to it and earned nothing of their own - for the hub's party share
        const body = { d: f.day, b: f.boss, at: f.fell.at, top: f.fell.top, n: f.fell.n, sx: f.sx, sz: f.sz, rc: Object.entries(f.rc ?? {}), here: f.here ?? [], kin: serpentBrain.serpentKinOf(f) };
        const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SERPENT_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) }));   // SCALE2b's deadline, at the merge with main
        ok = !!res?.ok;
      } catch (e) { console.warn('[serpent] hub', e?.message ?? e); ok = false; }
    }
    if (!ok) return;
    f.told = true;
    await this._serpentSave(id, f, now, true);
  }
  /** SERPENT1: the hub's kills of the latest serpent day - `{d, list}`, one a site (null for none) - the instance's, else
   *  storage's. */
  async _serpentFellsOf() {
    if (this._serpentFells === undefined) { const v = await this.state.storage.get(SERPENT_FELLS_KEY); this._serpentFells = v && typeof v === 'object' && Array.isArray(v.list) ? v : null; }
    return this._serpentFells;
  }
  /** AUDIT SERPENT S5: the hub hands an account's kept serpent receipt to its hello while it is good, and forgets an
   *  expired one (the account service counts a (day, account) once and gives its hoard to one claim - a receipt said
   *  again settles nothing twice). */
  async _serpentReceiptTo(ws, sub, now) {
    if (this._noSerpentRcpt.has(sub)) return;   // SCALE5a: asked before and none held - no write since says otherwise
    const k = SERPENT_RC_PREFIX + sub;
    const kept = await this.state.storage.get(k);
    if (!kept || typeof kept !== 'object') { this._noSerpentRcpt.set(sub, 1); return; }
    if (!(Number.isFinite(kept.e) && now < kept.e * 1000) || typeof kept.r !== 'string') { await this.state.storage.delete(k); return; }
    this._send(ws, JSON.stringify({ t: 'serpent', k: 'rcpt', r: kept.r }));
  }
  /**
   * THE HUB'S HALF: a serpent's kill, from its cell, projected through the wire's own law as a client would. Each
   * account's receipt is kept for its own life (one key an account, never over a newer day's - AUDIT SERPENT S5) and
   * handed now to the newest socket of every earner its cell did not hand it to. The kill is kept by its day and site
   * (one a site, SERPENT_FELLS_MAX the most - S1: a client hears its own site's) and said to everyone online - AUDIT
   * SERPENT S12: only while its day holds and never an older day's than the kept (a cell that told it late).
   */
  async _serpentFellInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const fell = validSerpentOut({ k: 'fell', d: body?.d, at: body?.at, top: body?.top, n: body?.n, sx: body?.sx, sz: body?.sz });
    if (!fell || fell.d === undefined || fell.sx === undefined) return json({ ok: false }, 400);
    const now = Date.now();
    const rc = new Map();
    for (const e of Array.isArray(body.rc) ? body.rc.slice(0, serpentBrain.SERPENT_FIGHTERS_MAX) : []) {
      const r = Array.isArray(e) && typeof e[0] === 'string' ? validSerpentOut({ k: 'rcpt', r: e[1] }) : null;
      const c = r ? readSerpentReceipt(r.r) : null;
      if (c && c.s === e[0] && c.d === fell.d && Number.isFinite(c.e) && now < c.e * 1000) rc.set(e[0], { r: r.r, e: c.e });
    }
    await this._serpentKinShare(body, fell, rc, now);   // SERPENT4: a party shares its kill
    const keys = [...rc.keys()].map((sub) => SERPENT_RC_PREFIX + sub);
    const had = keys.length ? await this.state.storage.get(keys) : new Map();
    const fresh = [...rc].filter(([sub]) => { const v = had.get(SERPENT_RC_PREFIX + sub); return !(v && typeof v === 'object' && Number.isSafeInteger(v.d) && v.d > fell.d); });
    if (fresh.length) this._noSerpentRcpt.clear();   // SCALE5a: receipts are being written - nobody's 'none' stands
    for (let i = 0; i < fresh.length; i += 128) await this.state.storage.put(Object.fromEntries(fresh.slice(i, i + 128).map(([sub, v]) => [SERPENT_RC_PREFIX + sub, { d: fell.d, r: v.r, e: v.e }])));
    const kept = await this._serpentFellsOf();
    const newer = !kept || fell.d >= kept.d;
    if (newer) {
      const list = kept && kept.d === fell.d ? kept.list.filter((g) => !sameSerpentSite(g, fell)) : [];
      this._serpentFells = { d: fell.d, list: [...list, fell].slice(-SERPENT_FELLS_MAX) };
      await this.state.storage.put(SERPENT_FELLS_KEY, this._serpentFells);
      if (this._heraldOf()) await this._hubArm(now);   // SERPENT2: and to the channel, if it is the agreed site's (_serpentHeraldBeat)
    }
    const said = newer && serpentHolds(fell.d, now) ? JSON.stringify({ t: 'serpent', ...fell }) : null;
    const here = new Set(Array.isArray(body.here) ? body.here.filter((x) => typeof x === 'string').slice(0, serpentBrain.SERPENT_FIGHTERS_MAX) : []);
    const handed = new Set(fresh.map(([sub]) => sub));
    if (said) for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, said);
    // each earner the cell did not hand hers: at its newest socket (AUDIT SOC B9's law, the roll call's _siegeSockets)
    for (const [sub, [ws]] of this._siegeSockets()) if (handed.has(sub) && !here.has(sub)) this._send(ws, JSON.stringify({ t: 'serpent', k: 'rcpt', r: rc.get(sub).r }));
    return json({ ok: true });
  }

  /**
   * SERPENT4 (2026-10-11, the players: "Rewards based on party or individual damage should be given on death"): A PARTY
   * SHARES ITS KILL. The cell knows no party, so it says its fight's kin with the kill (serpentBrain.js serpentKinOf - who
   * came to the fight and earned nothing of their own: `[sub, hull, level]`); the hub, which keeps the parties, mints a
   * stander's receipt for each whose party - as it stands now - holds a dealer's receipt of this kill, into `rc` beside the
   * cell's own, kept and handed as theirs are. A ship thrown out of its reach while her party fought on went home with
   * nothing. Its claims are the cell's word of her (her hull, the level it admitted her at), the boss's the kill's own.
   */
  async _serpentKinShare(body, fell, rc, now) {
    const kin = (Array.isArray(body?.kin) ? body.kin : []).slice(0, serpentBrain.SERPENT_FIGHTERS_MAX)
      .filter((e) => Array.isArray(e) && typeof e[0] === 'string' && e[0] && !rc.has(e[0]) && Number.isInteger(e[1]) && Number.isInteger(e[2]));
    if (!kin.length) return;
    const dealers = new Set();
    for (const [sub, v] of rc) if (readSerpentReceipt(v.r)?.x === 'dealt') dealers.add(sub);
    if (!dealers.size) return;
    const recs = await this._accts(kin.map((e) => e[0]));
    const parties = await this._partiesOf([...recs.values()].map((r) => r.party).filter((pid) => typeof pid === 'string'));
    const key = await this._receiptKeyOf(), nowS = Math.floor(now / 1000);
    const boss = typeof body.b === 'string' ? body.b : serpentBossOf(fell.d).id;
    for (const [sub, h, l] of kin) {
      const party = parties.get(recs.get(sub)?.party);
      if (!party?.members?.some((m) => m !== sub && dealers.has(m))) continue;
      try {
        const r = await mintSerpentReceipt({ d: fell.d, b: boss, s: sub, c: rand32(), x: 'stood', h, l }, key, { subtle: crypto.subtle, nowS });
        const c = readSerpentReceipt(r);
        if (c) rc.set(sub, { r, e: c.e });
      } catch (e) { console.warn('[serpent] kin receipt refused', e?.message ?? e); }
    }
  }

  // ───────────────────────────── DISCORD-GATES: THE HERALD ─────────────────────────────
  /** The hub's door to Discord, read once an instance: the channel's webhook (GATE_DISCORD_WEBHOOK, a Worker SECRET) and
   *  the role its omen pings (GATE_DISCORD_ROLE, a var), or null - no webhook, no herald: nothing posted, nothing kept. */
  _heraldOf() {
    if (this._herald === undefined || this._heraldCfg !== this._relayCfg) {   // SCALE5b: and again once the hub's settings are read, or moved
      this._heraldCfg = this._relayCfg;
      const hook = heraldWebhook(this.env?.GATE_DISCORD_WEBHOOK);
      if (!hook && this.env?.GATE_DISCORD_WEBHOOK) console.warn('[herald] GATE_DISCORD_WEBHOOK is not a Discord webhook\'s URL - nothing is posted');
      // SERPENT2: and the role the serpent's bells ping - SERPENT_DISCORD_ROLE when the operator names one, else the gate's
      // SD-HERALD: and the role the Abyss Dungeon's rise and find ping - SD_DISCORD_ROLE, else the gate's (the serpent's law)
      // SCALE5b: each role the hub's setting when it holds one (net/relayCfg.js), else the var - `_relayCfgOf` read first
      const cfg = this._relayCfg, role = (k) => relayCfgValue(cfg, this.env, k);
      this._herald = hook ? { hook, role: heraldRole(role('gateRole')), serpentRole: serpentHeraldRole(role('serpentRole'), role('gateRole')), sdRole: serpentHeraldRole(role('sdRole'), role('gateRole')) } : null;
    }
    return this._herald;
  }
  /** One post to the channel; true once Discord has taken it - or refused it FOR GOOD (a 4xx but 429: a webhook deleted,
   *  a body it will never take - posted again every HERALD_RETRY_MS, it would only be refused again). */
  async _heraldSend(body) {
    const h = this._heraldOf();
    if (!h) return false;
    try {
      const res = await fetch(h.hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(HERALD_TIMEOUT_MS) });
      if (res.ok) return true;
      console.warn('[herald] Discord said', res.status);
      return res.status >= 400 && res.status < 500 && res.status !== 429;
    } catch (e) { console.warn('[herald] post failed', e?.message ?? e); return false; }
  }
  /** What the herald has posted and owes, in storage: the last day whose omen and whose kill went, and a kill owed. */
  async _heraldState() {
    const v = await this.state.storage.get('herald');
    return { omen: Number.isSafeInteger(v?.omen) ? v.omen : -1, fell: Number.isSafeInteger(v?.fell) ? v.fell : -1, owe: v?.owe && typeof v.owe === 'object' ? v.owe : null,
      rite: Number.isSafeInteger(v?.rite) ? v.rite : -1, riteOwe: v?.riteOwe && typeof v.riteOwe === 'object' ? v.riteOwe : null };   // WB12d: the last rite posted, and one owed
  }
  /** The hub's record of where the gate stands - the instance's, else storage's. */
  async _gateSiteOf() {
    if (this._gateSiteRec === undefined) this._gateSiteRec = (await this.state.storage.get('gatesite')) ?? null;
    return this._gateSiteRec;
  }
  /** An account's word of where the gate the clock is about stands, folded into the record (one word an account a day -
   *  net/gate/gateHerald.js foldGateSite) and kept when it moved it. Nothing kept for a hub with no herald. */
  async _gateSite(sub, m, now) {
    if (!gateSiteDayOk(m.d, now)) return;   // AUDIT WB12d (R1): kept with no herald too - the rite stands by the agreed site
    const had = await this._gateSiteOf();
    const rec = foldGateSite(had, m.d, sub, m.px, m.py, m.pl);
    if (rec === had) return;
    await this.state.storage.put('gatesite', rec);
    this._gateSiteRec = rec;
  }
  /** When the herald next owes a post: a kill owed, now; the next omen at its instant; or null (no herald, nothing). */
  _heraldNextAt(st, now) {
    if (st.owe || st.riteOwe) return now;
    const due = heraldOmenDue(now, st.omen);
    return due ? due.at : null;
  }
  /** The hub's alarm armed for `at` unless it already is, sooner. */
  async _hubArm(at) {
    const had = await this.state.storage.getAlarm();
    if (had == null || had > at) await this.state.storage.setAlarm(at);
  }
  /** The alarm armed for the herald's next post, when it owes one before the sweep's - the gate's, and SERPENT2: the
   *  serpent's (_serpentHeraldArm), and SD-HERALD: the Abyss Dungeon's (_sdHeraldArm). */
  async _heraldArm(now) {
    if (!this._heraldOf()) return;
    const at = this._heraldNextAt(await this._heraldState(), now);
    if (at != null) await this._hubArm(at);
    await this._serpentHeraldArm(now);
    await this._sdHeraldArm(now);
  }
  /** A gate's kill, owed to the channel once a day while it is news: kept first (the alarm posts it, and posts it again
   *  until Discord takes it - one poster, so never twice), the alarm armed now. */
  async _heraldOwe(fell, now) {
    if (!this._heraldOf() || !heraldFellLive(fell.d, now)) return;
    const st = await this._heraldState();
    if (st.fell >= fell.d || st.owe?.d === fell.d) return;
    st.owe = { d: fell.d, top: fell.top, n: fell.n };
    await this.state.storage.put({ herald: st, hub: 1 });
    await this._hubArm(now);
  }
  /** WB12d: a broken rite, owed to the channel once a day while its circle still stands - the kill's law. The circle
   *  and its names are read when it is posted (AUDIT WB12d R6: those said after the first tell are named too). */
  async _heraldRiteOwe(d, now) {
    if (!this._heraldOf() || !riteStands(d, now, await this._fellAtOf(d))) return;
    const st = await this._heraldState();
    if (st.rite >= d || st.riteOwe?.d === d) return;
    st.riteOwe = { d };
    await this.state.storage.put({ herald: st, hub: 1 });
    await this._hubArm(now);
  }
  /** THE HERALD'S BEAT, on the hub's alarm: the kill owed posted (or let go once it is no news), the omen posted in its
   *  window, and the alarm armed for what is owed next - a post Discord did not take, HERALD_RETRY_MS on. */
  async _heraldBeat(now) {
    const h = this._heraldOf();
    if (!h) return;
    try {
      const st = await this._heraldState();
      const was = JSON.stringify(st), read = st.owe, readRite = st.riteOwe;
      let retry = null;
      // WB12d: the rite owed - posted, or let go once its breach no longer holds
      if (st.riteOwe && (st.riteOwe.d <= st.rite || !riteStands(st.riteOwe.d, now, await this._fellAtOf(st.riteOwe.d)))) st.riteOwe = null;
      if (st.riteOwe) {
        const site = agreedGateSite(await this._gateSiteOf(), st.riteOwe.d);
        const c = riteCirclesBy(await this._riteOf(), st.riteOwe.d, site)[0] ?? null;   // AUDIT WB12d (R1): the circle the gate's site agrees with
        if (!c) retry = now + HERALD_RETRY_MS;   // none yet: owed while its circle stands
        else if (await this._heraldSend(ritePost({ day: st.riteOwe.d, place: site?.pl ?? null, by: riteNames(c), n: Object.keys(c.h).length }))) { st.rite = st.riteOwe.d; st.riteOwe = null; }
        else retry = now + HERALD_RETRY_MS;
      }
      if (st.owe && (st.owe.d <= st.fell || !heraldFellLive(st.owe.d, now))) st.owe = null;
      if (st.owe) {
        const site = agreedGateSite(await this._gateSiteOf(), st.owe.d);
        if (await this._heraldSend(fellPost({ day: st.owe.d, place: site?.pl ?? null, top: st.owe.top, n: st.owe.n }))) { st.fell = st.owe.d; st.owe = null; }
        else retry = now + HERALD_RETRY_MS;
      }
      const due = heraldOmenDue(now, st.omen);
      if (due && due.at <= now) {
        const site = agreedGateSite(await this._gateSiteOf(), due.day);
        if (await this._heraldSend(omenPost({ day: due.day, place: site?.pl ?? null, role: h.role }))) st.omen = due.day;
        else retry = now + HERALD_RETRY_MS;
      }
      // WRITTEN OVER WHAT STORAGE HOLDS NOW, not over this beat's read: a kill owed while Discord answered is kept
      if (JSON.stringify(st) !== was) {
        const cur = await this._heraldState();
        st.omen = Math.max(st.omen, cur.omen); st.fell = Math.max(st.fell, cur.fell); st.rite = Math.max(st.rite, cur.rite);
        if (cur.owe && cur.owe.d !== read?.d && cur.owe.d > st.fell) st.owe = cur.owe;
        if (cur.riteOwe && cur.riteOwe.d !== readRite?.d && cur.riteOwe.d > st.rite) st.riteOwe = cur.riteOwe;   // WB12d
        await this.state.storage.put('herald', st);
      }
      const owed = st.owe || st.riteOwe ? null : heraldOmenDue(now, st.omen);
      const next = [retry, owed && owed.at > now ? owed.at : null].filter((x) => x != null);
      if (next.length) await this._hubArm(Math.min(...next));
    } catch (e) { console.warn('[herald] beat failed', e?.message ?? e); await this._hubArm(now + HERALD_RETRY_MS); }
  }

  // ───────────────────────────── SERPENT2: THE SERPENT'S HERALD ─────────────────────────────
  // net/serpent/serpentHerald.js. The gate's channel and door (_heraldOf, _heraldSend); its own record of where the serpent lies
  // (`serpentsite` - the gate's vote law), its own state (`sherald`: the last serpent day whose bells and whose kill
  // went), and the kill read off the hub's own kept kills (_serpentFellsOf - one a site), posted for the agreed site alone.
  /** The hub's record of where the serpent lies - the instance's, else storage's. */
  async _serpentSiteOf() {
    if (this._serpentSiteRec === undefined) this._serpentSiteRec = (await this.state.storage.get('serpentsite')) ?? null;
    return this._serpentSiteRec;
  }
  /** An account's word of where the serpent the clock is about lies, folded into the record (one word an account a day -
   *  net/gate/gateHerald.js foldGateSite, the site's native point in its pixel slots) and kept when it moved it. */
  async _serpentSite(sub, m, now) {
    if (!serpentSiteDayOk(m.d, now)) return;
    const had = await this._serpentSiteOf();
    const rec = foldGateSite(had, m.d, sub, m.sx, m.sz, m.pl);
    if (rec === had) return;
    await this.state.storage.put('serpentsite', rec);
    this._serpentSiteRec = rec;
  }
  /** What the serpent's herald has posted: the last serpent day whose bells and whose kill went. */
  async _serpentHeraldState() {
    const v = await this.state.storage.get('sherald');
    return { omen: Number.isSafeInteger(v?.omen) ? v.omen : -1, fell: Number.isSafeInteger(v?.fell) ? v.fell : -1 };
  }
  /** The alarm armed for the serpent's next bells, when the herald owes them before the sweep's. */
  async _serpentHeraldArm(now) {
    const bells = serpentHeraldOmenDue(now, (await this._serpentHeraldState()).omen);
    if (bells) await this._hubArm(bells.at);
  }
  /** THE SERPENT'S HERALD'S BEAT, on the hub's alarm beside the gate's: the kill at the agreed site posted while it is
   *  news (waited for while none is agreed), the bells posted in their window, and the alarm armed for what is owed next -
   *  a post Discord did not take, HERALD_RETRY_MS on. */
  async _serpentHeraldBeat(now) {
    const h = this._heraldOf();
    if (!h) return;
    try {
      const st = await this._serpentHeraldState();
      const was = JSON.stringify(st);
      let retry = null;
      const rec = await this._serpentSiteOf();
      const kill = serpentHeraldKill(await this._serpentFellsOf(), rec, st.fell, now);
      if (kill?.wait) retry = now + HERALD_RETRY_MS;
      else if (kill) { if (await this._heraldSend(serpentFellPost(kill))) st.fell = kill.day; else retry = now + HERALD_RETRY_MS; }
      const due = serpentHeraldOmenDue(now, st.omen);
      if (due && due.at <= now) {
        const site = agreedSerpentSite(rec, due.day);
        if (await this._heraldSend(serpentOmenPost({ day: due.day, place: site?.place ?? null, role: h.serpentRole }))) st.omen = due.day;
        else retry = now + HERALD_RETRY_MS;
      }
      if (JSON.stringify(st) !== was) await this.state.storage.put('sherald', st);   // the alarm alone writes it (its beats never overlap)
      const owed = serpentHeraldOmenDue(now, st.omen);
      const next = [retry, owed && owed.at > now ? owed.at : null].filter((x) => x != null);
      if (next.length) await this._hubArm(Math.min(...next));
    } catch (e) { console.warn('[herald] serpent beat failed', e?.message ?? e); await this._hubArm(now + HERALD_RETRY_MS); }
  }

  // ───────────────────────────── SD-HERALD: THE ABYSS DUNGEON'S HERALD ─────────────────────────────
  // net/superDungeon/sdHerald.js. The gate's channel and door (_heraldOf, _heraldSend); its own state (`sdherald`: the last slot whose
  // rise, find and end went, or were let go), and every moment read off the director's own record (_sdOf) - the herald
  // keeps nothing else.
  /** What the Abyss Dungeon's herald has posted: the last slot whose rise, find and end went (or were let go). */
  async _sdHeraldState() {
    return readSdHeraldState(await this.state.storage.get('sdherald'));
  }
  /** The alarm armed now when the herald owes a post - at the first hello, and at a find or a fall, which the hub hears
   *  off its alarm (a rise and a fade are the director's own moves, posted by the beat after the one that made them). */
  async _sdHeraldArm(now) {
    if (!this._heraldOf()) return;
    if (sdHeraldDue(await this._sdOf(), await this._sdHeraldState(), now).kind) await this._hubArm(now);
  }
  /** THE ABYSS DUNGEON'S HERALD'S BEAT, on the hub's alarm after the director's: each moment owed posted in the Hollow's
   *  order, every one no longer so let go, and the alarm armed again HERALD_RETRY_MS on for a post Discord did not take. */
  async _sdHeraldBeat(now) {
    const h = this._heraldOf();
    if (!h) return;
    try {
      let st = await this._sdHeraldState();
      const was = JSON.stringify(st);
      let retry = null;
      for (let step = 0; step < 3; step++) {
        const rec = await this._sdOf();
        const due = sdHeraldDue(rec, st, now);
        st = due.st;
        if (!due.kind) break;
        if (!(await this._heraldSend(sdHeraldPost(due.kind, rec, h.sdRole)))) { retry = now + HERALD_RETRY_MS; break; }
        st[due.kind === 'fell' || due.kind === 'fade' ? 'end' : due.kind] = rec.s;
      }
      if (JSON.stringify(st) !== was) await this.state.storage.put('sdherald', st);   // the alarm alone writes it (its beats never overlap)
      if (retry != null) await this._hubArm(retry);
    } catch (e) { console.warn('[herald] abyss beat failed', e?.message ?? e); await this._hubArm(now + HERALD_RETRY_MS); }
  }

  // ───────────────────────────── EG-E3: THE SPIRE'S HERALD ─────────────────────────────
  // net/eliteGates/egHerald.js. The gate's channel and door (_heraldOf, _heraldSend); its own record (EG_HERALD_KEY: the posts owed,
  // First of the Spire's flag, the bands said, the season's Descent tops, the news folded), the news a breach's room tells
  // (EG_INTERNAL_HERALD) folded into it by the herald's law, and the posts it owes posted off the hub's alarm.
  /** THE HUB'S HALF: a breach's news, folded once into the herald's record - the reckoning kept with no herald too (the
   *  first company ever, the season's tops), the posts owed only with one - and the alarm armed now when one is newly
   *  owed. */
  async _egHeraldInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const tell = validEgHeraldTell(body);
    if (!tell) return json({ ok: false }, 400);
    const now = Date.now(), herald = !!this._heraldOf();
    const had = readEgHeraldState(await this.state.storage.get(EG_HERALD_KEY));
    const st = egHeraldFold(had, tell, { nowMs: now, post: herald });
    await this.state.storage.put({ [EG_HERALD_KEY]: st, hub: 1 });
    if (herald && st.n > had.n) await this._hubArm(now);   // a post newly owed: now (one waiting on a retry keeps its time)
    return json({ ok: true });
  }
  /** THE SPIRE'S HERALD'S BEAT, on the hub's alarm after the gate's: each post owed posted in its order, one no longer news
   *  let go, and the alarm armed HERALD_RETRY_MS on for a post Discord did not take. What went is taken off the record
   *  as storage holds it NOW - news folded while Discord answered is kept. */
  async _egHeraldBeat(now) {
    if (!this._heraldOf()) return;
    try {
      const done = new Set();
      let retry = null;
      for (;;) {
        const { p, gone } = egHeraldNext(readEgHeraldState(await this.state.storage.get(EG_HERALD_KEY)), done, now);
        for (const i of gone) done.add(i);
        if (!p) break;
        if (!(await this._heraldSend(egHeraldPost(p)))) { retry = now + HERALD_RETRY_MS; break; }
        done.add(p.i);
      }
      if (done.size) {
        const cur = readEgHeraldState(await this.state.storage.get(EG_HERALD_KEY));
        await this.state.storage.put(EG_HERALD_KEY, { ...cur, q: cur.q.filter((p) => !done.has(p.i)) });
      }
      if (retry !== null) await this._hubArm(retry);
    } catch (e) { console.warn('[herald] spire beat failed', e?.message ?? e); await this._hubArm(now + HERALD_RETRY_MS); }
  }

  // ───────────────────────────── SD3: THE SUPER DUNGEON ─────────────────────────────
  // bible/11-Multiplayer/Super-Dungeons.md sections 2-4 and 14. THE HUB keeps the one record (SD_KEY) and moves it on with
  // net/superDungeon/sdLaw.js's moves on its alarm, beside the sweep and the heralds: the first beat (a hub with no record waits
  // SD_FIRST_RISE_MS), a Hollow's time run out (gone - fanned), and a rise once the rest is over - the census asked of the 62
  // region channels then, never on a timer. Every change is said to everyone online, and the record at every hello. A
  // CELL hears a find from its own socket's pose (sdNearSite) and tells the hub until it answers; the hub believes it while
  // its record says `risen` for that slot (sdFindBelieved). A REALM (`sd:<s>`) admits by the hub's record, asked.
  /** The hub's record - the instance's, else storage's, through the wire's own law. */
  async _sdOf() {
    if (this._sdRec === undefined) { const v = validSdRecord(await this.state.storage.get(SD_KEY)); if (this._sdRec === undefined) this._sdRec = v; }
    return this._sdRec;
  }
  /** AUDIT SD II (L3 F7, L5 F2): the highest slot the hub ever raised - the instance's, else storage's. A slot is a
   *  Hollow's whole identity (its realm's object, its receipts' and spoils' keys); a record that would not read back
   *  (a law's bound moved, a region past the count) made the director start again from slot 1, and every realm, receipt
   *  and spent mark the old numbers held answered the new Hollows - with the old fall, "claimed", and no spoils. */
  async _sdHwOf() {
    if (this._sdHw === undefined) { const v = await this.state.storage.get(SD_SLOT_KEY); if (this._sdHw === undefined) this._sdHw = Number.isSafeInteger(v) && v > 0 ? v : 0; }
    return this._sdHw;
  }
  /** The record kept - and the highest slot with it, in the one write. */
  async _sdSave(rec) {
    const hw = Math.max(await this._sdHwOf(), rec?.s ?? 0);
    this._sdRec = rec; this._sdHw = hw;
    await this.state.storage.put({ [SD_KEY]: rec, [SD_SLOT_KEY]: hw });
  }
  /** A record moved on, to everyone in the hub. */
  _sdFan(rec) {
    const said = JSON.stringify({ t: 'sd', k: 'ev', ...rec });
    for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, said);
  }
  /** The hub's alarm armed for the director's next move, unless it is armed sooner. */
  async _sdArm(now) {
    const due = sdDue(await this._sdOf(), now);
    await this._hubArm(due.act ? now : due.at);
  }
  /** THE DIRECTOR'S BEAT, on the hub's alarm: every move that is due made and fanned (a hub that slept past a Hollow's
   *  end and its rest makes both), then the alarm armed for the next. A rise asks the census first, and reads the record
   *  again after it - the census awaited other objects, and a find or a fall may have been said meanwhile. */
  async _sdBeat(now) {
    try { await this._sdHeldBeat(now); } catch (e) { console.warn('[sd] held beat failed', e?.message ?? e); await this._hubArm(now + SD_BEAT_RETRY_MS); }   // AUDIT SD II (L5 F3)
    try {
      for (let step = 0; step < 4; step++) {
        const rec = await this._sdOf();
        const due = sdDue(rec, now);
        // slot 0 is the hub's own: said to nobody. AUDIT SD II (L3 F7): a hub that raised Hollows before starts again from
        // the highest it raised - its next rise is the one past it
        if (due.act === 'first') { const hw = await this._sdHwOf(); await this._sdSave(hw > 0 ? { ...sdFirst(now), s: hw } : sdFirst(now)); continue; }
        if (due.act === 'gone') { const g = sdGone(rec, now); if (!g) break; await this._sdSave(g); this._sdFan(g); continue; }
        if (due.act === 'rise') {
          const counts = await this._sdCensus();
          const cur = await this._sdOf();
          const risen = sdRise(cur, now, pickSdRegion((cur?.s ?? 0) + 1, counts, cur?.s ? cur.r : -1));
          if (!risen) break;
          await this._sdSave(risen); this._sdFan(risen);
          continue;
        }
        if (due.at != null) await this._hubArm(due.at);
        break;
      }
    } catch (e) { console.warn('[sd] beat failed', e?.message ?? e); await this._hubArm(now + SD_BEAT_RETRY_MS); }
  }
  /** THE CENSUS: how many distinct registered accounts stand in each region's channel now, by region index - asked of
   *  each channel's object, SD_CENSUS_BATCH at a time, each call bounded by ROOM_CALL_MS. A channel that does not answer
   *  in time counts nobody; a relay built without the binding counts nobody anywhere (the Bay's great cities). */
  async _sdCensus() {
    const counts = new Array(SD_REGION_COUNT).fill(0);
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return counts;
    for (let i = 0; i < SD_REGION_COUNT; i += SD_CENSUS_BATCH) {
      await Promise.all(counts.slice(i, i + SD_CENSUS_BATCH).map(async (_, j) => {
        const r = i + j;
        try {
          const res = await rooms.get(rooms.idFromName(chatRegionRoom(r))).fetch(new Request(`https://relay.internal${SD_INTERNAL_CENSUS}`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(ROOM_CALL_MS) }));
          const v = res?.ok ? await res.json() : null;
          if (Number.isSafeInteger(v?.n) && v.n >= 0) counts[r] = Math.min(v.n, CHAT_SOCKETS_MAX);
        } catch (e) { console.warn('[sd] census', r, e?.message ?? e); }
      }));
    }
    return counts;
  }
  /** A REGION CHANNEL'S HALF of the census: the distinct registered accounts among its sockets (`lk`, marked at their
   *  hello - a guest is not counted). It reads the attachments it already holds; nothing is stored. */
  async _sdCensusInternal() {
    const subs = new Set();
    for (const [, b] of this._all()) if (b.id && b.lk && typeof b.sub === 'string' && b.sub) subs.add(b.sub);
    return json({ n: subs.size });
  }
  /** THE HUB'S HALF of a find: believed against the record (the slot risen, the finder near the claimed pixel's centre),
   *  kept and fanned once. Answered ok whether believed or not - a cell tells a find once, and the hub's word is final -
   *  with the slot the record holds (AUDIT SD II, L7 M4: the cell then tells no other slot's for a while) and when the next
   *  may rise (AUDIT SD III, R3: the next slot's find told from then). */
  async _sdFoundInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const c = validSdFoundTell(body);
    if (!c) return json({ ok: false }, 400);
    const now = Date.now();
    const rec = await this._sdOf();
    if (sdFindBelieved(rec, now, c, c)) {
      const found = sdFind(rec, now, c.fb);
      if (found) { await this._sdSave(found); this._sdFan(found); }
      if (found) await this._sdHeraldArm(now);   // SD-HERALD: and to the channel
    }
    const held = await this._sdOf();
    return json({ ok: true, s: held?.s ?? 0, ...(Number.isSafeInteger(held?.next) ? { next: held.next } : {}) });   // AUDIT SD III (R3): and when the next may rise
  }
  /** The hub's record, for the Worker's gate and a realm's hello - a Hollow that rose, or nothing. */
  async _sdLiveInternal() {
    const rec = await this._sdOf();
    return json({ rec: rec && rec.s > 0 ? rec : null });
  }
  /** A CELL'S HALF of a find: the word from its own socket, believed from that socket's pose at the claimed pixel's centre
   *  (the frame must be the cell's own pixel's - anywhere else junk), kept until the hub answers - the first finder's,
   *  while it is owed. */
  async _sdFoundWord(ws, a, m, now) {
    if (worldRoom(m.px, m.py) !== a.key) { this._junk(ws); return; }
    if (!a.pose || !sdNearSite(m, a.pose) || typeof a.sub !== 'string' || !a.sub) return;   // not at its door: nothing kept, nothing said
    // AUDIT SD II (L7 M4): A WORD THAT MOVES NOTHING TELLS NOTHING (the rite's AUDIT WB12d R4 law) - a slot this cell has
    // told and the hub answered is never told again, and while the hub's last answer is fresh a find for any slot but the
    // one it named is not told at all: one account in forty cells made forty hub requests a second, never struck
    if (this._sdTold?.has(m.s)) return;
    // AUDIT SD III (R3): save the NEXT slot once the hub's word says it may have risen (`next`, its record's not-before) -
    // a word for the old slot told a minute before the rise held the new Hollow's every find at this door nine minutes
    const known = this._sdHubSlot;
    if (known && now - known.at < SD_FIND_KNOWN_MS && m.s !== known.s && !(m.s === known.s + 1 && now >= (known.next ?? Infinity))) return;
    const had = await this._sdFoundOf();
    if (had && had.s >= m.s) return;   // this slot's find is owed already - the first finder's (or a later slot's)
    await this._sdFoundSave({ s: m.s, px: m.px, py: m.py, x: a.pose.x, z: a.pose.z, fb: sanitizeName(a.name ?? '') });
    await this._sdTellHub(now);
  }
  /** The find a cell owes its hub - the instance's, else storage's. */
  async _sdFoundOf() {
    if (this._sdFound === undefined) { const v = validSdFoundTell(await this.state.storage.get(SD_FOUND_KEY)); if (this._sdFound === undefined) this._sdFound = v; }
    return this._sdFound;
  }
  async _sdFoundSave(v) {
    this._sdFound = v;
    if (v) await this.state.storage.put(SD_FOUND_KEY, v);
    else await this.state.storage.delete(SD_FOUND_KEY);
  }
  /** THE HUB TOLD of a find - the rite's law: one tell in flight (a word that lands meanwhile is the retry's), the retry
   *  ARMED BEFORE it goes (a reset mid-tell still tells), the owed find let go once the hub answers. Answers whether a
   *  tell is still owed. */
  async _sdTellHub(now) {
    const owed = await this._sdFoundOf();
    if (!owed) return false;
    if (this._sdTelling) { await this._sdCellArm(now + SD_TELL_RETRY_MS); return true; }
    this._sdTelling = true;
    try {
      await this._sdCellArm(now + SD_TELL_RETRY_MS);
      const ans = await this._sdTellHubOf(owed);
      if (!ans) return true;
      // AUDIT SD II (L7 M4): the slot told, and the hub's own, kept (a handful - the cell's memory, not its storage).
      // AUDIT SD III (R1): A SLOT AHEAD OF THE HUB'S IS NOT TOLD FOR GOOD - its Hollow has not risen, and the hub's answer
      // judged nothing of it. A premature word for the next slot (a guest's, at the pixel's centre) was kept as told and
      // answered, and the cell never told that slot's real find once it rose: an hour of honest finds at its door, dropped.
      if (!this._sdTold) this._sdTold = new Set();
      if (this._sdTold.size >= 8) this._sdTold.delete(this._sdTold.values().next().value);
      if (!(Number.isSafeInteger(ans.s) && owed.s > ans.s)) this._sdTold.add(owed.s);
      if (Number.isSafeInteger(ans.s)) this._sdHubSlot = { s: ans.s, at: Date.now(), ...(Number.isSafeInteger(ans.next) ? { next: ans.next } : {}) };   // AUDIT SD III (R3): and when the next may rise
      if (this._sdFound === owed) await this._sdFoundSave(null);   // a later slot's find said meanwhile is the next tell's
      return !!this._sdFound;
    } finally { this._sdTelling = false; }
  }
  /** The cell's alarm armed no later than `at` (never pushed off a sooner one). */
  async _sdCellArm(at) {
    try { const had = await this.state.storage.getAlarm(); if (had == null || had > at) await this.state.storage.setAlarm(at); }
    catch (e) { console.warn('[sd] arm', e?.message ?? e); }
  }
  /** The hub's door: a relay built without the binding keeps the cell's own word. A find the hub refused FOR GOOD (a 4xx -
   *  a body it will never take) is not told again. The hub's answer (AUDIT SD II, L7 M4: `{ s }` the slot its record
   *  holds), or null while it is owed still. */
  async _sdTellHubOf(body) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return {};
    try {
      const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SD_INTERNAL_FOUND}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(SD_TELL_RETRY_MS) }));
      if (!res || !(res.ok || (res.status >= 400 && res.status < 500))) return null;
      try { const v = res.ok ? await res.json() : null; return v && typeof v === 'object' ? v : {}; } catch { return {}; }
    } catch (e) { console.warn('[sd] hub', e?.message ?? e); return null; }
  }
  /** A REALM'S record of the Hollow - the hub's, asked at most every SD_LIVE_FRESH_MS (a hello storm asks once).
   *  AUDIT SD II (L3 F2, L7 M5): ONE ASK IN FLIGHT - every frame meanwhile waits on the same answer - and a miss neither
   *  throws away the last answer (kept SD_LIVE_KEEP_MS: a hello is refused busy only when the realm never had one) nor is
   *  asked again for SD_LIVE_MISS_MS. A miss is never "no record" (AUDIT SD R3). */
  async _sdLiveOf(s, now) {
    const had = this._sdLive?.s === s ? this._sdLive : null;
    if (had && had.rec !== undefined && now - had.at < SD_LIVE_FRESH_MS) return had.rec;
    const kept = had && had.rec !== undefined && now - had.at < SD_LIVE_KEEP_MS ? had.rec : undefined;
    if (had && had.missAt != null && now - had.missAt < SD_LIVE_MISS_MS) return kept;
    if (this._sdAsking?.s === s) return this._sdAsking.p;
    const p = (async () => {
      const rec = await sdLiveAsk(this.env?.ROOMS, s);
      const at = Date.now();
      if (rec !== undefined) { this._sdLive = { s, at, rec }; return rec; }
      this._sdLive = { s, at: had?.at ?? 0, rec: had?.rec, missAt: at };
      return kept;
    })();
    this._sdAsking = { s, p };
    try { return await p; } finally { if (this._sdAsking?.p === p) this._sdAsking = null; }
  }
  /** The accounts a realm has admitted - `{ s, in: [sub] }` - the instance's, else storage's. */
  async _sdRealmOf(s) {
    if (this._sdRealm === undefined) {
      const v = await this.state.storage.get(SD_REALM_KEY);
      const strs = (xs) => (Array.isArray(xs) ? xs.filter((x) => typeof x === 'string').slice(0, SD_FIGHTERS_MAX) : []);
      if (this._sdRealm === undefined) this._sdRealm = v && v.s === s && Array.isArray(v.in) ? { s, in: strs(v.in), gu: strs(v.gu), dead: strs(v.dead) } : { s, in: [], gu: [], dead: [] };   // SD-ONELIFE: `dead` the accounts that died in it   // AUDIT SD II (L7 M3): `gu` the guests among them
    }
    return this._sdRealm;
  }
  /** Why a hello into a realm is refused, or null to admit it: the Hour closed (the slot gone, or another's), a newcomer
   *  after the kill (the hub's record, or SD8b the realm's own fight), the realm full. A newcomer admitted is kept - it may
   *  come back until the Hollow is gone. `guest` - the token's account has no handle. */
  async _sdAdmit(key, sub, now, guest = false) {
    const s = sdSlotOfRoom(key);
    const rec = await this._sdLiveOf(s, now);
    if (rec === undefined) return SD_NO_BUSY;   // AUDIT SD: no answer - try again
    if (!rec || rec.s !== s || !sdHolds(rec, now)) return SD_NO_CLOSED;
    const realm = await this._sdRealmOf(s);
    if (sub && (realm.dead.includes(sub) || (realm.dead.length >= SD_FIGHTERS_MAX && (await this.state.storage.get(sdDeadKey(sub))) != null))) return SD_NO_FALLEN;   // SD-ONELIFE: one life a Hollow; AUDIT SD III (R2): past the list, its own key
    if (sub && realm.in.includes(sub)) { this._sdTellIn(s, rec, now); return null; }   // SD-THROUGH
    if (!sdAdmits(rec, now)) return SD_NO_CLOSED;
    const f = await this._sdFightOf();
    if (f?.fell) return SD_NO_CLOSED;   // SD8b: the realm knows its own kill before the hub's word comes round
    // AUDIT SD: THE SEATS FREE THEMSELVES (the gate's AUDIT WB A1 law): a full realm frees one held by an account with no
    // socket here and no seat in its fight - a hello alone (a guest's, a watcher's) no longer holds a seat for the
    // Hollow's whole life. (A receipt is a fighter's, and a newcomer after the kill was refused above.) AUDIT SD II (L3
    // F3): a seat in a LIVING fight - a fight lost, or one no beat has moved for SD_LOST_MS, seats nobody
    const living = f && !f.lost && !f.fell && now - (f.lastTickAt ?? 0) < SD_LOST_MS ? f : null;
    const present = new Set([...this._all()].map(([, b]) => b.sub).filter(Boolean));
    const guests = new Set(realm.gu);
    const free = (pick) => {
      const i = realm.in.findIndex((x) => pick(x) && !present.has(x) && !living?.players?.[x]);
      if (i < 0) return false;
      const [x] = realm.in.splice(i, 1);
      realm.gu = realm.gu.filter((g) => g !== x); guests.delete(x);
      return true;
    };
    // AUDIT SD II (L7 M3): GUESTS HOLD AT MOST SD_GUEST_SEATS - an idle socket's seat is never freed (its owner is here),
    // and guests cost a click each: 256 of them held the Hour full for as long as they cared to
    if (sub && guest && realm.in.filter((x) => guests.has(x)).length >= SD_GUEST_SEATS && !free((x) => guests.has(x))) return SD_NO_FULL;
    if (realm.in.length >= SD_FIGHTERS_MAX && !free(() => true)) return SD_NO_FULL;
    if (sub && !realm.in.includes(sub)) { realm.in.push(sub); if (guest) realm.gu.push(sub); await this.state.storage.put(SD_REALM_KEY, realm); }
    this._sdTellIn(s, rec, now);   // SD-THROUGH: one went through - the hub hears it, and every Hollow's Way Through stands
    return null;
  }
  /** SD-THROUGH (Super-Dungeons.md section 6): THE HUB TOLD THAT ONE WENT THROUGH - at an admission while the hub's record
   *  is found and has no `inAt`, one tell in flight, UNAWAITED (a hello never waits on it), until the hub has answered for
   *  this slot; the hub's move is the law's (net/superDungeon/sdLaw.js sdEnter), so a second tell moves nothing. AUDIT
   *  SD-THROUGH (A1): A TELL THAT DID NOT LAND IS OWED - told again on the realm's alarm SD_TELL_RETRY_MS on (_sdInBeat),
   *  as a find's is (_sdTellHub): admissions met with a tell in flight were dropped with it, and a lone fighter's lost
   *  tell was never told again. */
  _sdTellIn(s, rec, now) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get || rec?.inAt != null || !sdAdmits(rec, now) || this._sdInTold === s || this._sdInTelling === s) return;
    this._sdInTelling = s;
    const p = this._sdTellInNow(s, rooms).finally(() => { if (this._sdInTelling === s) this._sdInTelling = null; });
    try { this.state.waitUntil?.(p); } catch { /* not every runtime */ }
  }
  /** The tell itself - never told once the realm's own Remnant has fallen (AUDIT SD-THROUGH A4: the hub's record says
   *  found until the fall's tell lands, and a returner's tell in that gap stood a Way Through the collapse refuses); told
   *  for good once the hub answers, a 400 its last word (A5: any other refusal - an older hub's 404 mid-deploy - is owed). */
  async _sdTellInNow(s, rooms) {
    try {
      if ((await this._sdFightOf())?.fell) return;
      const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SD_INTERNAL_IN}`, { method: 'POST', body: JSON.stringify({ s }), signal: AbortSignal.timeout(SD_TELL_RETRY_MS) }));
      if (res && (res.ok || res.status === 400)) { this._sdInTold = s; this._sdInOwed = null; return; }
    } catch (e) { console.warn('[sd] in', e?.message ?? e); }
    this._sdInOwed = s;
    this._sdInRetryAt = Date.now() + SD_TELL_RETRY_MS;
    await this._sdCellArm(this._sdInRetryAt);
  }
  /** AUDIT SD-THROUGH (A1): THE REALM'S ALARM TELLS AN OWED TELL AGAIN, once its retry is due - while the hub's record is
   *  found and unstamped and the realm has admitted someone (_sdTellIn's own law). A woken instance (an eviction forgets
   *  the owed slot) asks once, by its own sockets' room - a realm that admitted none is owed nothing. */
  async _sdInBeat(now) {
    if (this._sdInOwed === undefined) { const key = [...this._all()].map(([, b]) => b.key).find((k) => isSdRoom(k)); this._sdInOwed = key ? sdSlotOfRoom(key) : null; }
    const s = this._sdInOwed;
    if (s == null) return;
    if (now < (this._sdInRetryAt ?? 0)) { await this._sdCellArm(this._sdInRetryAt); return; }   // an alarm sooner than the retry (a fight's beat) spends none of it
    this._sdInOwed = null;
    if (!(await this._sdRealmOf(s)).in.length) return;
    const rec = await this._sdLiveOf(s, now);
    if (rec === undefined) { this._sdInOwed = s; this._sdInRetryAt = now + SD_TELL_RETRY_MS; await this._sdCellArm(this._sdInRetryAt); return; }   // the hub silent: still owed
    this._sdTellIn(s, rec, now);
  }
  /** SD-ONELIFE (Mac: "A death within the rift casts you out and youre unable to re enter. You get one life to prove your
   *  worth"): the account whose dying pose (PCORPSE1's `dd`) came through a realm is kept as dead there - every hello of
   *  its after is refused (SD_NO_FALLEN), whatever its page says. */
  async _sdMarkFallen(key, sub) { return this._sdMarkFallenAt(sdSlotOfRoom(key), sub); }
  /** INT12: the same, by the realm's slot - a fall by the relay's count (enforced) is the one life's, as a `dd` is. */
  async _sdMarkFallenAt(s, sub) {
    const realm = await this._sdRealmOf(s);
    if (realm.dead.includes(sub)) return;
    if (realm.dead.length >= SD_FIGHTERS_MAX) { await this.state.storage.put(sdDeadKey(sub), 1); return; }   // AUDIT SD III (R2): past the list, one key an account - never forgotten
    realm.dead.push(sub);
    await this.state.storage.put(SD_REALM_KEY, realm);
  }
  /** SD6b: THE ORRERY'S HALL in a realm - `{ s, st, f, ok, last }`: the stones' hours, the fray, the Concord, and each
   *  stone's last turn (the relay's clock) - the instance's, else storage's, else fresh from the slot's law. */
  async _sdHallOf(s) {
    if (this._sdHall === undefined || this._sdHall.s !== s) {
      const v = await this.state.storage.get(SD_ORRERY_KEY);
      const hour = (h) => Number.isInteger(h) && h >= 0 && h < SD_HOURS;
      const kept = v && v.s === s && Array.isArray(v.st) && v.st.length === SD_STONES.length && v.st.every(hour) && Number.isInteger(v.f)
        && v.f >= 0 && v.f <= SD_FRAY_MAX && typeof v.ok === 'boolean' && Array.isArray(v.last) && v.last.length === SD_STONES.length && v.last.every(Number.isSafeInteger);
      if (this._sdHall === undefined || this._sdHall.s !== s) this._sdHall = kept ? { s, st: [...v.st], f: v.f, ok: v.ok, last: [...v.last] } : { s, ...orreryFresh(orreryOf(s)), last: SD_STONES.map(() => 0) };
    }
    return this._sdHall;
  }
  /** SD6b: the hall said - its stones, fray, dial and Concord, and a turn's own fields when one made it so. */
  _sdHallWord(hall, turn = {}) {
    return JSON.stringify({ t: 'sd', k: 'pz', s: hall.s, st: hall.st, f: hall.f, lit: orreryLit(orreryOf(hall.s), hall.st), ok: hall.ok, ...turn });
  }
  /**
   * SD6b: A TURN OF AN ENDING-STONE, JUDGED (Super-Dungeons.md section 8): from a verified account alive in the realm, its
   * own pose within reach of the stone (a metre's slack for a pose's lag), the Hour still holding its slot, the stone's
   * gear settled (SD_STONE_SETTLE_MS since its last turn), the turn's number past the last this socket made (a word said
   * twice is one turn) - then the Orrery's law turns it, the hall is kept, and every soul in the realm hears the stones,
   * the fray, the dial and the Concord, with the turn and its turner (`x` when the Hour snapped back, and AUDIT SD II -
   * L7 H2 - `ls` the peers its lash falls on). Anything else is nothing: no word, no strike. Once the Concord holds, a
   * turn is nothing. AUDIT SD II (L7 H2): and THE STONES' RIGHTS (net/superDungeon/sdBrain.js orreryMayTurn) - a turner that has
   * lengthened the road SD_TURN_LONG_MAX times this thread waits while others turn, told so (`w`, to its socket alone, at
   * most every SD_PZ_WAIT_SAY_MS).
   */
  async _sdTurn(ws, a, m, now) {
    if (typeof a.sub !== 'string' || !a.sub || !a.pose || a.pose.dd) return;
    const s = sdSlotOfRoom(a.key), o = orreryOf(s);
    if (!o) return;
    const meter = this._meterOf(ws);
    const [x, , z] = dungeonToRealm(a.pose.x, a.pose.y ?? 0, a.pose.z);
    if (!stoneInReach(m.i, x, z, SD_STONE_REACH_SLACK)) return;
    const rec = await this._sdLiveOf(s, now);
    if (!rec || rec.s !== s || !sdHolds(rec, now)) return;
    const hall = await this._sdHallOf(s);
    // AUDIT SD II (L7 L1): judged at the instant it is judged - the asks above awaited other objects, and a turn of this
    // socket's own may have been judged meanwhile
    now = Date.now();
    if (m.q <= (meter.pzq ?? -1)) return;
    const R = this._sdRightsOf(s), who = orreryTurnerOf(a.sub, !a.lk);
    const res = orreryJudge(o, hall, hall.last, m.i, m.a, now, R, who, a.id);   // EG-H3 (EG4): the Orrery's one judge (net/superDungeon/sdBrain.js) - the settle, THE STONES' RIGHTS, the turn and its turner counted
    if (!res) return;
    if (res.wait) {
      if (!(now - (meter.pzw ?? -Infinity) < SD_PZ_WAIT_SAY_MS)) { meter.pzw = now; this._send(ws, this._sdHallWord(hall, { w: 1 })); }
      return;
    }
    meter.pzq = m.q;
    const lash = res.x ? { x: 1, ls: orreryLashed(R, SD_FIGHTERS_MAX) } : {};
    if (res.x) this._sdRights = { s, R: orreryRightsFresh() };   // the snap begins a fresh thread
    hall.st = res.st; hall.f = res.f; hall.ok = res.ok; hall.last[m.i] = now;
    await this.state.storage.put(SD_ORRERY_KEY, hall);
    const word = this._sdHallWord(hall, { i: m.i, a: m.a, id: a.id, q: m.q, ...lash });
    for (const [other, b] of [...this._all()]) if (b.id) this._send(other, word);
  }
  /** AUDIT SD II (L7 H2): the thread's rights (net/superDungeon/sdBrain.js orreryRightsFresh) - the realm's memory alone: a realm that
   *  wakes begins a fresh thread's. */
  _sdRightsOf(s) {
    if (this._sdRights?.s !== s) this._sdRights = { s, R: orreryRightsFresh() };
    return this._sdRights.R;
  }

  // ───────────────────────────── EG-PLAY: THE ELITE BREACH ─────────────────────────────
  // bible/11-Multiplayer/Elite-Gates.md sections 6, 7 and 23. The HUB opens a breach on the account service's signed order
  // (`egopen`): it freezes the company from the opener's party, draws the breach's seed, opens the breach's room
  // (EG_INTERNAL_OPEN) and says the call to every member. The ROOM (`eg:<16hex>`) admits its company alone, each member
  // with its own signed admission (`egadmit`, spent once), and runs the halls by the director's law (net/eliteGates/egBrain.js) on its
  // alarm: the stages, the count, the legion, the champion and the lord, the falls, the Redoubts, the end - and mints
  // each receipt the breach owes (`e1`, net/eliteGates/egReceipt.js).
  /** The breach this room holds - the instance's, else storage's; null for a room the hub never opened. */
  async _egOf() {
    if (this._eg === undefined) {
      const kept = await this.state.storage.get([EG_KEY, EG_DONE_KEY]);   // EG-ZA: and its tombstone, in the one read
      const v = kept.get(EG_KEY), d = kept.get(EG_DONE_KEY);
      if (this._egDone === undefined) this._egDone = d && typeof d === 'object' && Number.isSafeInteger(d.until) ? d : null;
      if (this._eg === undefined) {
        this._eg = v && typeof v === 'object' && typeof v.b === 'string' ? v : null;
        if (this._eg) await this._egResume(this._eg, Date.now());   // EG-H2: a room that woke - its law, its hold, its time
        if (this._eg) egFairWoke(this._eg, Date.now());   // EG-H1: read from storage, a wake - a hall woken before it opens its door on a saved fair trail, or the first arrival (section 21)
      }
    }
    return this._eg;
  }
  /**
   * EG-H2 (Elite-Gates.md section 22): A BREACH'S ROOM WOKE (its record read from storage - a deploy's restart, an eviction):
   * a law this relay does not draw ends the breach as a void (the stake returned, the Redoubts taken kept - the opener
   * who never entered is handed the void itself); between trials it holds until its company is back (the beat releases
   * it); mid-trial the gap since its last beat is given back (net/eliteGates/egDurable.js egResume). Every member here is told the
   * breach and its fight again, its clocks moved.
   */
  async _egResume(B, now) {
    const how = egResume(B, now, this._egVoidBefore());   // EG-ZA: and THE FORCE VOID - a breach live when a `force` deploy stamped the Worker
    if (how === 'void') {
      const out = [];
      egEnd(B, 'void', now, out);   // EG-ZA: the opener who never entered is owed the void by the end itself (net/eliteGates/egBrain.js egEnd)
      this._egFan(out);
      await this._egMint(B, now);
      await this._egSave(B, now, true);
      return;
    }
    if (how) { this._egFan([egStateOf(B, now), ...(egFightStateOf(B, now) ? [egFightStateOf(B, now)] : [])]); await this._egSave(B, now, true); await this._egArm(now + BRAIN_TICK_MS); }
  }
  /** EG-H2: the accounts of the breach's living members whose body stands in the room now (a fresh pose). */
  _egPresent(B, now) { return new Set(this._egBodies(B, now).map((b) => b.sub)); }
  /** The breach to storage - every CHECKPOINT_MS from the beat, at once on a stage, a fall, an admission or the end. EG-ZA:
   *  an ended breach's order written into the room's tombstone (`egdone`), once. */
  async _egSave(B, now, force) {
    if (!force && now - (this._egSavedAt ?? 0) < CHECKPOINT_MS) return;
    this._egSavedAt = now;
    // AUDIT EG V (lane4 L4-10; section 22, "Storage, not memory"): each member's newest pose kept with the record (`lp`,
    // `[t, x, y, z, h]` - its instant given back with the rest), so a room woken mid-trial still holds the body of a member
    // whose socket is gone (_egTrails) - the trails themselves are memory alone
    for (const [sub, k] of this._egTrailsBy ?? []) if (B.mem?.[sub] && Array.isArray(k?.last)) B.mem[sub].lp = k.last.slice(0, 5);
    if (B.end && !B.tomb) { B.tomb = 1; await this._egDoneWrite(B.ez, B.end, null, now); }
    await this.state.storage.put(EG_KEY, B);
  }
  /** EG-ZA: THE FORCE VOID's stamp - the ms a `force` relay deploy set (`EG_VOID_BEFORE`, .github/workflows/relay-deploy.yml),
   *  0 for none. */
  _egVoidBefore() { const v = Number(this.env?.EG_VOID_BEFORE); return Number.isSafeInteger(v) && v > 0 ? v : 0; }
  /** EG-ZA: the room's tombstone (`egdone` - net/eliteGates/egDurable.js egDoneWith), the instance's, else storage's; null for none. */
  async _egDoneOf() {
    if (this._egDone === undefined) await this._egOf();
    if (this._egDone === undefined) { const d = await this.state.storage.get(EG_DONE_KEY); if (this._egDone === undefined) this._egDone = d && typeof d === 'object' && Number.isSafeInteger(d.until) ? d : null; }
    return this._egDone;
  }
  /** EG-ZA: order `ez` written into the tombstone (`why`, and the void `r` it minted) - kept EG_VOID_MAX_S from now. */
  async _egDoneWrite(ez, why, r, now) {
    this._egDone = egDoneWith(await this._egDoneOf(), ez, why, r, Math.floor(now / 1000));
    await this.state.storage.put(EG_DONE_KEY, this._egDone);
  }
  /**
   * EG-ZA: A ROOM PAST ITS BREACH (ended, nothing owed) or that only voided an order: its tombstone kept until its end - the
   * alarm armed for it - and then the tombstone and the ended breach forgotten. False when it keeps none (the alarm is the
   * room's other duties').
   */
  async _egDoneTick(B) {
    const done = await this._egDoneOf();
    if (!done) return false;
    if (Date.now() >= done.until * 1000) {
      this._egDone = null;
      if (B?.end) this._eg = null;
      await this.state.storage.delete(B?.end ? [EG_DONE_KEY, EG_KEY] : [EG_DONE_KEY]);
      return false;
    }
    await this.state.storage.setAlarm(done.until * 1000);
    return true;
  }
  /** The beat armed at `at` unless the alarm is already sooner. */
  async _egArm(at) {
    const cur = await this.state.storage.getAlarm();
    if (cur == null || cur > at) await this.state.storage.setAlarm(at);
  }
  /** A pose of the dungeon's frame in the Spire's (net/superDungeon/sdBrain.js dungeonToRealm - the court's frame). */
  _egPose(p) { const [sx, y, z] = dungeonToRealm(p.x, p.y ?? 0, p.z); return { sx, y, z }; }   // EG-ZB (section 11.7): the feet's height with it - the fight floor a blow is struck from is read by it
  /** The breach's members in the room now - each one's NEWEST socket speaking for it (the gate's law), a pose older than
   *  SD_POSE_FRESH_MS speaking for no body (AUDIT SD III F3's law): where it stands, whether it died, when it posed. */
  _egBodies(B, now) {
    const newest = new Map();
    for (const [, b] of this._all()) {
      if (!b.id || !b.sub || !b.pose || !B.mem[b.sub]) continue;
      if (now - (b.eAt ?? b.since ?? 0) > SD_POSE_FRESH_MS) continue;
      const had = newest.get(b.sub);
      if (!had || (b.since ?? 0) >= (had.since ?? 0)) newest.set(b.sub, b);
    }
    return [...newest.values()].map((b) => { const p = this._egPose(b.pose); return { sub: b.sub, sx: p.sx, y: p.y, z: p.z, dead: !!b.pose.dd, at: b.eAt ?? now }; });
  }
  // ── EG-H1 (EG8d): WHAT THE RELAY JUDGES (net/eliteGates/egFair.js, net/eliteGates/egBrain.js; Elite-Gates.md section 21) ──
  /** The line the Spire's count runs by: the hub's BOSS_BODY body line (its depth, its pace) - its enforcement the Spire's
   *  own (EG_BODY_ENFORCE), whatever the gate's says. */
  _egLine() { return this._bodyLine().body; }
  /**
   * A MEMBER'S POSE at its SHARED time (net/eliteGates/egFair.js egPoseShared - its own `ts` plus its socket's offset, the least
   * `arrival - ts` over its last poses): onto its SOCKET's trail in the hall's own frame (a ridden pose at its piece's clock
   * position - net/eliteGates/egBrain.js egPoseIn, which feeds THE FAIR TRAIL). In memory alone, as INT11's trails are: a woken
   * instance knows no trail, and judges no body it does not know.
   */
  _egPoseIn(ws, a, p, now) {
    const B = this._eg;
    if (!B || B.end || !B.mem?.[a.sub] || !p) return;
    const clocks = (this._egClocks ??= new Map());
    let c = clocks.get(ws);
    if (!c) { clocks.set(ws, c = egPoseClock()); if (clocks.size > 64) clocks.delete(clocks.keys().next().value); }
    const t = egPoseShared(c, p.ts, now);
    if (t == null) return;   // out of order: it judges nothing
    const [sx, y, z] = dungeonToRealm(p.x, p.y ?? 0, p.z);
    const at = egPoseIn(B, a.sub, { sx, y, z, pl: p.pl ?? null, cl: p.cl ?? 0 }, t);
    if (!at) return;
    // AUDIT EG III (lane3 #3; sections 6.1 and 22): THE TRAIL IS THE ACCOUNT'S, not its socket's - a socket that closes
    // leaves its body standing on it (_egTrails holds its last pose). The newest socket speaks for it (the gate's law), and
    // a pose before the trail's last is no step of it (a reload's clock is its own); the held stand-in it overtakes goes.
    const trails = (this._egTrailsBy ??= new Map());
    const k = trails.get(a.sub);
    if (k && k.ws !== ws && this._siegeSocketOf(a.sub)?.[0] !== ws) return;
    const tr = k?.tr ?? [];
    while (tr.length && tr[tr.length - 1][5] === 1 && tr[tr.length - 1][0] >= t) tr.pop();
    if (tr.length && t < tr[tr.length - 1][0]) return;
    const e = [t, at.x, at.y, at.z, at.h];
    trails.delete(a.sub); trails.set(a.sub, { ws, tr: egTrailPush(tr, e), last: e });
    if (trails.size > 64) trails.delete(trails.keys().next().value);
  }
  /**
   * The members' shared-time trails for the count - each one's NEWEST socket speaking for it (the gate's law). AUDIT EG III
   * (lane3 #3; section 6.1 - "A shape aimed at another member still lands on it, so a tab closed before a blow is not a life
   * saved"; section 22, "A dropped socket"): a living member with NO socket here keeps its body at its last pose for
   * EG_ABSENT_TRIAL_MS from it - its trail held there, an entry each EG_HELD_STEP_MS to now (`[t, x, y, z, h, 1]`), so the
   * judge's poses either side of a landing find it standing where it was. The census walked the sockets alone, and a closed
   * one dropped its body from every blow. No blow is aimed at it: the director's bodies are the fresh poses (_egBodies).
   * AUDIT EG V (lane4 L4-1; sections 6.1 and 21): AND A SILENT SOCKET'S - a client says a pose when it moves (and every
   * HEARTBEAT_MS standing still - net/online.js sendPose), so a member standing still, a backgrounded tab or a client holding
   * its poses back through a wind-up had no pose within EG_POSE_NEAR_MS of any landing and took nothing. Every living
   * member's trail is held at its newest pose: a closed socket's to now, an open one's to now less EG_TS_LAG_MAX_MS - a pose
   * is placed at most that before it arrives (net/eliteGates/egFair.js egPoseShared), so its trail up to there is whole, the stand-ins
   * never stand over a pose still on its way, and the judge still waits for the pose sent after a landing (a dodge in its
   * last round trip is no hit). AUDIT EG V (lane4 L4-10; section 22): a room woken mid-trial holds each body at the pose its
   * record kept (`m.lp`, _egSave), until the member says another.
   */
  _egTrails(B, now = Date.now()) {
    const socks = this._siegeSockets(), out = [];
    for (const [sub, m] of Object.entries(B.mem ?? {})) {
      let k = this._egTrailsBy?.get(sub);
      if (!k && Array.isArray(m?.lp) && m.lp.length === 5) { k = { ws: null, tr: [], last: m.lp }; (this._egTrailsBy ??= new Map()).set(sub, k); }
      const open = socks.has(sub);
      if (!m?.in || !m.alive || m.home || !k?.last) { if (open) out.push({ sub, tr: k?.tr ?? [] }); continue; }
      out.push({ sub, tr: egTrailHeld(k, open ? now - EG_TS_LAG_MAX_MS : now) });
    }
    return out;
  }
  /** The breach's frames to everyone in the room, in order - EG-FULL: a frame carrying `to` (a member's offer, a gift, a
   *  recall) to that member's sockets alone, its `to` taken off. */
  _egFan(frames) {
    if (!frames.length) return;
    if (this._eg) egCountHeals(this._eg, frames, Date.now(), this._egLine());   // EG-H1: what the room heals, the count is restored by
    const all = [], mine = new Map();
    for (const fr of frames) {
      if (typeof fr.to === 'string') { const { to, ...rest } = fr; mine.set(to, [...(mine.get(to) ?? []), JSON.stringify({ t: 'eg', ...rest })]); }
      else all.push(JSON.stringify({ t: 'eg', ...fr }));
    }
    if (all.length) this._fanFrames(all, (b) => b.id);
    for (const [sub, words] of mine) for (const [ws, b] of this._all()) if (b.id && b.sub === sub) for (const w of words) this._send(ws, w);
  }
  /** THE RECEIPTS THE BREACH OWES, minted - each its own seed off the relay's CSPRNG (never the breach's), kept on the
   *  breach for its member's next hello and handed to its newest socket here now. One owing list taken whole before the
   *  first await, so a receipt is never minted twice. EG-ZA: and each told the hub, which holds it until its account says
   *  it is counted (`_egRcTell`); answers the `[sub, receipt]` minted. */
  async _egMint(B, now) {
    if (!B.owe?.length) return [];
    const owed = B.owe;
    B.owe = [];
    const key = await this._receiptKeyOf(), nowS = Math.floor(now / 1000);
    B.rc ??= {};
    const minted = [];
    for (const o of owed) {
      try {
        // EG-H2 (section 22): A SECRET, DETERMINISTIC SEED - HMAC(rs, sub|R|kind), the room's secret drawn at the open and
        // never sent (net/eliteGates/egDurable.js egReceiptSeed): a room woken before its save mints the same roll again, never a
        // second. A void carries none; a breach opened before the secret (none kept) draws its seed as it did.
        const seed = o.claims.q === 'v' ? {} : { c: B.rs ? await egReceiptSeed(B.rs, o.sub, o.claims.q === 'w' ? o.claims.w : 0, o.claims.q, crypto.subtle) : rand32() };
        const r = await mintEgReceipt({ ...o.claims, ...seed }, key, { subtle: crypto.subtle, nowS });
        B.rc[o.sub] = [...(B.rc[o.sub] ?? []), r].slice(-12);
        minted.push([o.sub, r]);
      } catch (e) { console.warn('[eg] receipt refused', e?.message ?? e); }
    }
    if (minted.length) B.rq = [...(B.rq ?? []), ...minted].slice(-EG_RC_OWED_MAX);   // EG-ZA: owed to the hub, kept with the breach
    await this._egSave(B, Date.now(), true);   // EG-H2 (section 22): kept BEFORE the receipts go out
    for (const [sub, r] of minted) { const sock = this._siegeSocketOf(sub); if (sock) this._send(sock[0], JSON.stringify({ t: 'eg', k: 'rcpt', r })); }
    this._egRcAt = 0;   // a new receipt is told at once
    await this._egRcTell(B, Date.now());
    return minted;
  }
  /**
   * EG-ZA (section 23): THE RECEIPTS TOLD THE HUB (EG_INTERNAL_RCPT) - every one the breach minted, with the accounts whose
   * socket stands in this room now (each already handed its own): the hub holds them under `egrc:<sub>` for every hello
   * until its account says it is counted, and hands a member who is elsewhere online theirs at once. Each kept owed (`B.rq`)
   * until the hub has it; a hub that did not answer told again EG_RC_TELL_MS on (an ended breach beats on for it). A relay
   * built without the binding has no hub to tell - the room's own hello hands them.
   */
  async _egRcTell(B, now) {
    if (!B.rq?.length || now < (this._egRcAt ?? 0)) return;
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) { B.rq = []; return; }
    const rc = B.rq;
    const res = await this._egPost(SOCIAL_ROOM, EG_INTERNAL_RCPT, { b: B.b, rc, here: [...this._siegeSockets().keys()] });
    if (!res?.ok) { this._egRcAt = now + EG_RC_TELL_MS; return; }
    const told = new Set(rc.map((e) => e[1]));
    B.rq = (B.rq ?? []).filter((e) => !told.has(e[1]));
    await this._egSave(B, Date.now(), true);
  }
  /** THE HUB OPENS A BREACH'S ROOM (EG_INTERNAL_OPEN): the verified open, the frozen company, the seed and the opener's
   *  landing - kept as the breach's record and its beat armed. The same order told again (the hub's retry) is answered
   *  with the record already kept; another order on a room already opened is refused (409). */
  async _egOpenInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const t = validEgOpenTell(body);
    if (!t) return json({ ok: false }, 400);
    const had = await this._egOf();
    // EG-ZA: an ended breach is never opened again (a retry that came after its void is refused - its stake is its own receipts')
    // AUDIT EG IV (lane3 #12): and the company and the site it froze - the hub calls the breach's own company, never the party
    // as a retry finds it
    if (had) return had.ez === t.ez && !had.end ? json({ ok: true, seed: had.seed, op: had.op, egv: had.egv, co: had.co.map((c) => [c.sub, c.name, c.n]), site: had.site }) : json({ ok: false, error: had.ez === t.ez ? 'done' : 'taken' }, 409);
    if (egDoneOf(await this._egDoneOf(), t.ez)) return json({ ok: false, error: 'void' }, 409);   // EG-ZA: an order this room voided is never opened after (its tombstone was written first)
    const B = egBreachNew(t);
    B.rs = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('');   // EG-H2: the receipts' secret - kept, never sent
    this._eg = B;
    await this._egSave(B, Date.now(), true);
    await this._egArm(egTickAt(B, Date.now(), false));   // EG-ZA (section 22, THE COST): no beat while the arch rises - the first is the open
    return json({ ok: true, seed: B.seed, op: B.op, egv: B.egv, co: B.co.map((c) => [c.sub, c.name, c.n]), site: B.site });
  }
  /**
   * EG-ZA (sections 22 and 23, "A key's loss"): THE HUB ASKS THIS ROOM TO VOID AN OPEN ORDER (EG_INTERNAL_VOID - `{ s, eb,
   * ez, i }`, the order's own claims as the hub verified them, whatever its age - the open's door's trust: no socket and no
   * browser reaches it). Up to EG_VOID_MAX_S after its issue: the breach it opened, while nothing has begun (no call told
   * out, no hall woken, no member in), ends as a void - its opener owed the `v`. An order this room never took is written
   * into its tombstone FIRST, so it can never be opened after, and its `v` minted once: asked again, the same receipt.
   * Answers `{ ok, r }`, or `{ ok: false, no }` - 'held' (the breach took the key: its own receipts settle the stake),
   * 'old', 'shut' (nothing to sign with), 'refused'.
   */
  async _egVoidInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const c = body && typeof body === 'object' ? body : {};
    if (typeof c.s !== 'string' || !c.s || typeof c.eb !== 'string' || !/^[0-9a-f]{16}$/.test(c.eb) || typeof c.ez !== 'string' || !/^[a-z0-9]{16,32}$/.test(c.ez) || !Number.isSafeInteger(c.i)) return json({ ok: false, no: 'refused' }, 400);
    const sub = c.s, now = Date.now(), nowS = Math.floor(now / 1000);
    if (nowS - c.i > EG_VOID_MAX_S) return json({ ok: false, no: 'old' });
    const kept = egDoneOf(await this._egDoneOf(), c.ez);
    if (kept && kept[1] === 'void' && kept[2]) return json({ ok: true, r: kept[2] });   // asked again: the same void, never a second
    const B = await this._egOf();
    if (B && B.ez === c.ez) {
      if (!egVoidable(B)) return json({ ok: false, no: 'held' });
      const out = [];
      egEnd(B, 'void', now, out);
      this._egFan(out);
      const minted = await this._egMint(B, now);
      await this._egSave(B, Date.now(), true);
      const r = minted.find((e) => e[0] === sub && readEgReceipt(e[1])?.q === 'v')?.[1] ?? null;
      if (!r) return json({ ok: false, no: 'shut' });
      await this._egDoneWrite(c.ez, 'void', r, now);
      return json({ ok: true, r });
    }
    if (kept && kept[1] !== 'void') return json({ ok: false, no: 'held' });   // the breach's own end is in the tombstone: its receipts settled it
    // AN ORDER THIS ROOM NEVER TOOK: spent first (the tombstone - already, when a mint before failed), then its void
    if (!kept) await this._egDoneWrite(c.ez, 'void', null, now);
    let r = null;
    try { r = await mintEgReceipt({ q: 'v', b: c.eb, s: sub, z: c.ez }, await this._receiptKeyOf(), { subtle: crypto.subtle, nowS }); } catch (e) { console.warn('[eg] void refused', e?.message ?? e); }
    if (!r) return json({ ok: false, no: 'shut' });
    await this._egDoneWrite(c.ez, 'void', r, now);
    await this._egArm(this._egDone.until * 1000);   // the tombstone's one alarm: its end (section 22, "Unknown rooms")
    return json({ ok: true, r });
  }
  /** EG-ZA: THE HUB SAYS THIS ROOM'S CALL WENT OUT (EG_INTERNAL_CALLED - `{ ez }`, after it kept the call for the company's
   *  hellos): from here a breach nobody answers ends 'empty', its opener's stake spent; before it, a void. */
  async _egCalledInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const B = await this._egOf();
    if (!B || B.end || typeof body?.ez !== 'string' || body.ez !== B.ez) return json({ ok: false }, 400);
    if (!B.called) { B.called = 1; await this._egSave(B, Date.now(), true); }
    return json({ ok: true });
  }
  /** AUDIT EG IV (lane3 #3; section 16.1): THE CASTS THIS BREACH'S ROOM RELAYED - `by` account to `to` account, when (in
   *  memory, as the trails are: a woken room corroborates nothing it did not relay, and a heal said then is no healer's
   *  part), the newest EG_CAST_SEEN_MAX pairs kept. */
  _egCastSeen(by, to, now) {
    const seen = (this._egCasts ??= new Map()), k = `${by}\n${to}`;
    seen.delete(k); seen.set(k, now);
    if (seen.size > EG_CAST_SEEN_MAX) seen.delete(seen.keys().next().value);
  }
  /** AUDIT EG IV: did this room relay a cast from `by` to `to` within EG_HEAL_CAST_MS of `now`? */
  _egCastSaw(by, to, now) {
    const t = this._egCasts?.get(`${by}\n${to}`);
    return t != null && now - t <= EG_HEAL_CAST_MS;
  }
  /** A breach room's own word on a hello: the company's alone (a registered member), by the director's law
   *  (net/eliteGates/egBrain.js egAdmitWord) - or the refusal's words. */
  async _egAdmit(key, who, now) {
    const B = await this._egOf();
    if (!B || B.b !== egBreachOfRoom(key)) return 'the breach is closed';
    if (!who.subject || who.kind !== 'linked') return 'the breach answers only to its company';
    return egAdmitWord(B, who.subject, now);
  }
  /** A member entering told the breach, its hall's fight and its receipts - false when its socket is gone. */
  async _egHello(ws, sub, now) {
    const B = await this._egOf();
    if (!B) return true;
    if (!this._send(ws, JSON.stringify({ t: 'eg', ...egStateOf(B, now) }))) return false;
    const fst = egFightStateOf(B, now);
    if (fst && !this._send(ws, JSON.stringify({ t: 'eg', ...fst }))) return false;
    // AUDIT EG IV (lane3 #2): THE RECEIPTS THE HUB DOES NOT HOLD YET, alone - those still owed it (`B.rq`); the hub is their
    // holder of record (EG-ZA), hands them at its own hello and forgets each its account says was counted, so the room's
    // re-handing every one it ever minted at every hello (a reload, a socket's blip, every deploy) had each claimed again. A
    // relay built without the hub's binding keeps them here alone (_egRcTell), and hands them all.
    const rq = this.env?.ROOMS?.idFromName && this.env.ROOMS.get ? (B.rq ?? []).filter((e) => e[0] === sub).map((e) => e[1]) : ((sub && B.rc?.[sub]) || []);
    for (const r of sub ? rq : []) if (!this._send(ws, JSON.stringify({ t: 'eg', k: 'rcpt', r }))) return false;
    const m = sub ? B.mem?.[sub] : null;   // EG-FULL: an offer still open, and the company's word, said again to a member who reloaded
    if (m?.offer?.length && !this._send(ws, JSON.stringify({ t: 'eg', k: 'offer', v: m.offer, n: m.picks ?? 0 }))) return false;
    for (const q of B.asks ?? []) if (!this._send(ws, JSON.stringify({ t: 'eg', k: 'ask', q: q.q, o: q.o, until: q.until }))) return false;
    if (egLive(B, now)) await this._egArm(now + BRAIN_TICK_MS);
    return true;
  }
  /**
   * A MEMBER'S WORD in its breach's room: `in` (its signed admission - the service's `egadmit` naming this account and
   * this breach, spent once - and its level, the token's character level where it carries one), `down` (a step through
   * the door), `home` (the way home at a Redoubt's rest), and its blows - each judged from where the socket's own pose
   * stands. Re-read after every await (the gate's AUDIT SD II L3 F1 law).
   */
  async _egFrame(ws, a, m, now) {
    let B = await this._egOf();
    if (!B || B.b !== egBreachOfRoom(a.key)) { this._junk(ws); return; }
    const pose = a.pose && !a.pose.dd ? this._egPose(a.pose) : null;
    const no = (w) => { this._send(ws, JSON.stringify({ t: 'eg', k: 'no', m: w })); };
    if (m.k === 'in') {
      if (!(m.bv >= EG_BRAIN_MIN)) { no('the breach is closed'); return; }
      await this._loadKey();
      if (!this._verifyKey) return;
      const r = await verifyOrder(m.z, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'egadmit' });
      // AUDIT EG III (lane3 #9; section 23 - "The room checks `eb` against its own key, `s` against the hello's subject,
      // `ew` against the breach's"): an order for another start is not this breach's - the service signs a member's
      // admission to the start it may make, and a room that read no `ew` took any start's order
      if (!r.ok || r.claims.s !== a.sub || r.claims.eb !== B.b || (r.claims.ew ?? 0) !== (B.ew ?? 0)) { no('the order is not yours'); return; }
      now = Date.now();
      B = this._eg;
      const lv = a.cl > 0 && Number.isSafeInteger(a.cl) ? a.cl : m.lv;   // the token's character level where it carries one
      const w = egEnter(B, a.sub, r.claims.ez, lv, now);
      if (w) { no(w); return; }
      await this._egSave(B, now, true);
      this._egFan([egStateOf(B, now)]);
      await this._egArm(now + BRAIN_TICK_MS);
      return;
    }
    if (m.k === 'clk') { this._send(ws, JSON.stringify({ t: 'eg', k: 'clk', c: m.c, now: Date.now() })); if (Number.isInteger(m.h)) { const all = (this._egClocks ??= new Map()); let c = all.get(ws); if (!c) all.set(ws, c = egPoseClock()); c.h = m.h; } return; }   // EG-H1: the shared clock's ping, answered at once (section 10.8); the delay its corrected clock measured places its poses (net/eliteGates/egFair.js egPoseShared)
    if (m.k === 'vt') { egBodyWord(B, a.sub, m.v, now, this._egLine(), EG_BODY_ENFORCE); return; }   // EG-H1: its body, in its own word
    if (m.k === 'down') { if (egDown(B, a.sub, m.h, pose, now)) await this._egArm(now + BRAIN_TICK_MS); return; }
    if (m.k === 'spec') {
      // EG-H2 (section 22, THE LAW PIN): a hall of this circle (or the next) in the breach's own law's bytes, to the socket
      // that asked - a client whose law is not the breach's builds from them (net/eliteGates/egLaw.js egSpecGive)
      const c = B.h > 0 ? egCircleOfHall(B.h) : 1, hc = egCircleOfHall(m.h);
      if (B.end || (hc !== c && hc !== c + 1)) return;
      this._send(ws, JSON.stringify({ t: 'eg', k: 'spec', egv: B.egv, h: m.h, sp: egHallOf(B.seed, m.h, egGeo(B), B.egv) }));   // EG-ZC: drawn in that law (the law before kept)
      return;
    }
    if (m.k === 'home') {
      const out = [];
      if (egHome(B, a.sub, now, out)) { this._egFan(out); await this._egMint(B, now); await this._egSave(B, now, true); }
      return;
    }
    // EG-ZF (section 27.6): WHAT COMPANIONS' SPELLS HEALED IN THIS MEMBER, and whose - each healer the socket in this room its
    // peer id names (a member of the breach, else nobody: net/eliteGates/egTally.js credits only the company); believed within the
    // member's heal bucket - the recap's healing, a Court's chart, and the count's mend (net/eliteGates/egBrain.js egHeal, the gate's
    // GATE-HEAL and AUDIT INT11 law). A figure for the round-up: it keeps no beat and wakes nothing.
    // AUDIT EG IV (lane3 #3; section 16.1): a healer's part in the hall only where this room relayed its cast to the member
    if (m.k === 'heal') { egHeal(B, a.sub, m.h.map(([id, n]) => [this._idFirst(id)?.[1]?.sub ?? '', n]), now, this._egLine(), EG_BODY_ENFORCE, (by) => this._egCastSaw(by, a.sub, now)); return; }
    if (m.k === 'hit') this._egFan(egBlow(B, a.sub, m, pose, now));
    else {
      // EG-FULL: a member's other words - a Vestige picked, the company's word, a Cantrip, a purchase, a ping, a bequest,
      // forsaking, an Athenaeum's turn (net/eliteGates/egBrain.js egWord)
      const out = egWord(B, a.sub, m, pose, now, rand01);
      this._egFan(out);
      if (m.k === 'forsake' || m.k === 'pick' || m.k === 'fell') { await this._egMint(B, now); await this._egSave(B, now, true); }
    }
    if (!(this._egBeatArmedTo > now)) { this._egBeatArmedTo = now + BRAIN_TICK_MS; await this._egArm(now + BRAIN_TICK_MS); }
  }
  /** ONE BEAT of a breach's alarm while it lives: the director stepped over the members' bodies, its frames fanned, its
   *  receipts minted, the breach checkpointed - the next beat armed (EG-ZA: net/eliteGates/egDurable.js egTickAt - BRAIN_TICK_MS while
   *  a trial runs with anyone here, a second otherwise: the count, the open window and an absent member's fall run on; none
   *  while the arch rises). False when the room holds no live breach nor tombstone - the alarm is the room's other duties'
   *  then. */
  async _egTick() {
    const B = await this._egOf();
    if (!B || (B.end && !B.owe?.length && !B.hq?.length && !B.rq?.length)) return this._egDoneTick(B);   // EG-E3: an ended breach beats on while the hub has not had its news (EG-ZA: nor its receipts) - EG-ZA: and past them keeps its tombstone
    const now = Date.now();
    // EG-H2 (section 22): THE HOLD - a woken room between trials stays still until its living company is back or the hold
    // is spent, then gives the whole gap back; a room that never slept gives back a beat gap past EG_GAP_MS
    if (B.hold) {
      if (!egHoldDone(B, now, this._egPresent(B, now))) { await this.state.storage.setAlarm(now + 1000); return true; }
      egRelease(B, now);
      this._egFan([egStateOf(B, now), ...(egFightStateOf(B, now) ? [egFightStateOf(B, now)] : [])]);
      await this._egSave(B, now, true);
    } else if (egBeatGap(B, now) > 0) this._egFan([egStateOf(B, now), ...(egFightStateOf(B, now) ? [egFightStateOf(B, now)] : [])]);
    try {
      const out = [...egCount(B, now, this._egTrails(B), this._egLine(), EG_BODY_ENFORCE), ...egStep(B, now, this._egBodies(B, now), rand01)];   // EG-H1: the body counted first - a fall by it is the beat's own
      this._egFan(out);
      await this._egMint(B, now);
      await this._egRcTell(B, now);   // EG-ZA: receipts the hub has not taken, told again
      await this._egHeraldTell(B, now);   // EG-E3: the herald's news, to the hub
      await this._egSave(B, now, out.some((f) => f.k === 'sg' || f.k === 'rd' || f.k === 'end' || f.k === 'fall' || f.k === 'rise' || f.k === 'offer'));
    } catch (e) { console.warn('[eg] beat failed', e?.message ?? e); }
    if (B.end) {
      await this._egSave(B, now, true);
      if (!B.hq?.length && !B.rq?.length) return this._egDoneTick(B);
      // EG-E3: told again, until the hub has it - EG-ZA: its news and its receipts, each at its own retry
      await this.state.storage.setAlarm(Math.max(now + 1000, Math.min(B.hq?.length ? (this._egTellAt ?? 0) : Infinity, B.rq?.length ? (this._egRcAt ?? 0) : Infinity)));
      return true;
    }
    // EG-ZA (section 22, THE COST): THE TICK - a trial's beat only while a trial runs with its company here, a second
    // otherwise (never past the stage's end), none while the arch rises (net/eliteGates/egDurable.js egTickAt)
    const here = [...this._all()].some(([, b]) => b.id);
    await this.state.storage.setAlarm(egTickAt(B, now, here));
    return true;
  }
  /** EG-E3: THE HERALD'S NEWS, TOLD THE HUB (EG_INTERNAL_HERALD): the breach's own list (`B.hq`, the director's - its
   *  Valkynaz Redoubts, a Court felled alone, its end as a Descent candidate), each piece kept until the hub has it (the
   *  hub folds news told twice once) and let go once it is no news; a hub that did not answer told again
   *  EG_HERALD_TELL_MS on, never on every beat (a tell waits ROOM_CALL_MS at most, and the beat with it). A relay built
   *  without the binding has no hub to tell. */
  async _egHeraldTell(B, now) {
    if (!B.hq?.length || now < (this._egTellAt ?? 0)) return;
    B.hq = B.hq.filter((e) => now < e.at + EG_HERALD_KEEP_MS);
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) B.hq = [];
    if (!B.hq.length) return;
    const ev = B.hq;
    const res = await this._egPost(SOCIAL_ROOM, EG_INTERNAL_HERALD, { b: B.b, ev });
    if (!res?.ok) { this._egTellAt = now + EG_HERALD_TELL_MS; return; }
    const told = new Set(ev.map((e) => e.i));
    B.hq = (B.hq ?? []).filter((e) => !told.has(e.i));
    await this._egSave(B, Date.now(), true);
  }
  /** One POST to another object's internal door (ROOM_CALL_MS bounded) - its JSON answer, or null. */
  async _egPost(key, path, body) {
    const ans = await this._egAsk(key, path, body);
    return ans?.ok ? ans.body : null;
  }
  /** EG-ZA: the same POST, its answer whole - `{ ok, status, body }` (a refusal is an answer), or null when the object did
   *  not answer at all (no binding, a fault, the bound passed). */
  async _egAsk(key, path, body) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return null;
    try {
      const res = await rooms.get(rooms.idFromName(key)).fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
      if (!res) return null;
      let out = null;
      try { out = await res.json(); } catch { out = null; }
      return { ok: !!res.ok, status: res.status, body: out };
    } catch (e) { console.warn('[hub] eg post', e?.message ?? e); return null; }
  }
  /**
   * THE OPEN, AT THE HUB (section 23): the service's signed order naming this socket's own verified account, the company
   * frozen from the opener's party as the hub holds it (the opener alone when it has none; PARTY_MAX at most, each a
   * numeral in the party's order), the breach's seed drawn here (the relay's CSPRNG), the breach's room opened - and THE
   * CALL said to every member's sockets, and kept for their hellos until the open window ends.
   */
  async _egOpen(ws, a, m, now) {
    const no = () => { this._send(ws, JSON.stringify({ t: 'eg', k: 'no', m: 'the breach is closed' })); };
    await this._loadKey();
    if (!this._verifyKey) { no(); return; }
    const r = await verifyOrder(m.z, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'egopen' });
    if (!r.ok || r.claims.s !== a.sub) { no(); return; }
    const c = r.claims;
    // EG-H2 (section 22): THE DRAIN and THE COST - no new breach while a deploy drains the Spire (the relay setting
    // `egDrain`), nor past EG_LIVE_MAX live at once: refused, and the stake handed straight back (a void receipt)
    // AUDIT EG III (lane3 #5): AT THE CAP, THE ROOMS ASKED - an ended breach stayed on the list until its last word, three
    // hours of a slot; at EG_LIVE_MAX the hub asks each listed room where it stands (the live door's own question, kept
    // EG_LIVE_SAID_MS) and lets the ended ones go before it refuses
    let full = Object.keys(await this._egLiveOf(now)).length >= EG_LIVE_MAX;
    if (full) { await this._egLiveSay(); full = Object.keys(await this._egLiveOf(now)).length >= EG_LIVE_MAX; }
    if ((await this._egDraining()) || full) { await this._egShut(ws, a, c, now); return; }
    const rec = await this._acct(a.sub);
    let members = [a.sub];
    if (rec) { const [party] = await this._myParty(a.sub, rec, now); if (party?.members?.length) members = party.members.includes(a.sub) ? party.members.slice(0, 8) : [a.sub]; }
    if (!members.includes(a.sub)) members = [a.sub, ...members].slice(0, 8);
    const recs = await this._accts(members);
    const co = members.map((sub, i) => [sub, sanitizeName(recs.get(sub)?.name ?? (sub === a.sub ? a.name ?? '' : '')), i + 1]);
    const tell = { b: c.eb, ez: c.ez, s: c.s, o: sanitizeName(a.name ?? rec?.name ?? ''), ew: c.ew, rh: c.rh === 1 ? 1 : 0, seed: rand32(), op: now, co, site: m.site, ...(Array.isArray(c.ewg) ? { wg: c.ewg } : {}) };   // EG-F: the order's Wager to the room (EG-PLAY departure 8 closed)
    if (!validEgOpenTell(tell)) { no(); return; }
    // EG-ZA (section 23, step 3): RETRIED, IDEMPOTENT ON `ez` - the room answers the same order with the record it kept
    let ans = null;
    for (let k = 0; k < EG_OPEN_HUB_TRIES && !ans; k++) ans = await this._egAsk(egRoomKey(c.eb), EG_INTERNAL_OPEN, tell);
    const res = ans?.ok ? ans.body : null;
    if (!res?.ok) {
      // EG-ZA (section 22, "A key's loss"): the room never answered, or refused the order (another's room, or an order it
      // voided) - the stake handed back by the ROOM's void, which writes the order spent first so it can never be opened
      // after; a room that answers that neither leaves it to the opener's client, which holds the stake and asks again
      await this._egVoidAsk(ws, a.sub, c, now);
      no(); return;
    }
    // AUDIT EG IV (lane3 #12): THE COMPANY THE ROOM FROZE - a retried open (the client's EG_OPEN_TRIES) re-read the party as
    // it stood then, and called one who had joined it since into a breach that answers only to its first company (an admit
    // order taken, its `eg_live` held, and refused at the arch); the room's answer says the company and the site it kept
    const kept = validEgOpenTell({ ...tell, co: res.co, site: res.site });
    const company = kept ? kept.co : co, called = company.map((t) => t[0]);
    const call = { k: 'call', b: c.eb, o: tell.o, os: c.s, seed: res.seed ?? tell.seed, op: res.op ?? tell.op, rh: tell.rh, co: company, site: kept ? kept.site : m.site, ew: tell.ew, wg: tell.wg ?? [] };
    // EG-F (section 6.3): THE HUB SIGNS THE ARCH'S FIELDS (net/eliteGates/egCallSig.js) with the receipts' key - the opener's client
    // carries them on its world cell, and a stranger stands the arch only when this verifies
    call.sg = await signEgCall(call, await this._receiptKeyOf(), { subtle: crypto.subtle });
    await this._egLiveAdd(c.eb, { egv: Number.isSafeInteger(res.egv) ? res.egv : 0, until: call.op + EG_LAST_WORD_MS }, now);   // EG-H2: on the hub's live list until its last word
    const until = call.op + EG_SEALED_MS + EG_ADMIT_MAX_MS, word = JSON.stringify({ t: 'eg', ...call });
    await this.state.storage.put(Object.fromEntries(called.map((sub) => [egCallKey(sub), { call, until }])));
    for (const sub of called) this._sayTo(sub, word);
    // EG-ZA (section 22): THE ROOM TOLD ITS CALL WENT OUT - kept for the company's hellos now, so a breach nobody answers is
    // the opener's 'empty' from here; a room never told ends one with no hall woken as a void (the stake back)
    for (let k = 0; k < EG_OPEN_HUB_TRIES; k++) if (await this._egPost(egRoomKey(c.eb), EG_INTERNAL_CALLED, { ez: c.ez })) break;
  }
  /**
   * EG-ZA (sections 22 and 23): A VOID ASKED OF A BREACH'S ROOM for its opener `sub` and its verified order's claims `c`
   * (EG_INTERNAL_VOID, EG_OPEN_HUB_TRIES at most while it does not answer): its `v` handed to the asking socket and held for
   * the account's hellos (`egrc:`) until it says the service counted it. Answers the room's word (`{ ok, r }` / `{ ok:
   * false, no }`), or null when it never answered.
   */
  async _egVoidAsk(ws, sub, c, now) {
    let ans = null;
    for (let k = 0; k < EG_OPEN_HUB_TRIES && !ans; k++) ans = await this._egAsk(egRoomKey(c.eb), EG_INTERNAL_VOID, { s: sub, eb: c.eb, ez: c.ez, i: c.i });
    const r = ans?.body?.ok && typeof ans.body.r === 'string' ? ans.body.r : null;
    const v = r ? readEgReceipt(r) : null;
    if (v && v.q === 'v' && v.s === sub) {
      await this._egRcKeep(new Map([[sub, [{ id: egRcId(v), r, e: v.e }]]]), Math.floor(now / 1000));
      this._send(ws, JSON.stringify({ t: 'eg', k: 'rcpt', r }));
    }
    return ans?.body ?? null;
  }
  /** EG-ZA (section 22): A CLIENT'S VOID (`{k:'void', z}`) - a stake no call answered: its open order, this socket's own
   *  account's, verified whatever its age (up to EG_VOID_MAX_S), asked of its breach's room. Refused in words: another's
   *  order, too old, or one the breach took (its own receipts settle the stake); a room that does not answer is asked again
   *  by the client. */
  async _egVoid(ws, a, m, now) {
    const no = (w) => { this._send(ws, JSON.stringify({ t: 'eg', k: 'no', m: w })); };
    await this._loadKey();
    if (!this._verifyKey) return;
    const v = await verifyEgOpenAnyAge(m.z, this._verifyKey, { subtle: crypto.subtle });
    if (!v.ok || v.claims.s !== a.sub) { no('the order is not yours'); return; }
    if (Math.floor(now / 1000) - v.claims.i > EG_VOID_MAX_S) { no('the void is too old'); return; }
    // AUDIT EG IV (lane3 #5): A VOID ASKED AGAIN, ANSWERED FROM THE HUB'S HELD COPY - the room's void of this order, held for
    // this account and not yet counted, is handed back without asking the room again
    const kept = this._noEgRc.has(a.sub) ? null : await this.state.storage.get(egRcKey(a.sub)), vid = egRcId({ b: v.claims.eb, q: 'v' });
    const held = Array.isArray(kept) ? kept.find((x) => x?.id === vid && !x.spent && typeof x.r === 'string' && x.e > Math.floor(now / 1000) && readEgReceipt(x.r)?.z === v.claims.ez) : null;
    if (held) { this._send(ws, JSON.stringify({ t: 'eg', k: 'rcpt', r: held.r })); return; }
    const said = await this._egVoidAsk(ws, a.sub, v.claims, now);
    if (said?.no === 'held') no('the breach took the key');
    else if (said?.no === 'old') no('the void is too old');
  }
  /** EG-ZA (section 23): THE HUB HOLDS A BREACH'S RECEIPTS - `by` account to `[{ id, r, e }]` folded into each one's
   *  `egrc:<sub>` (net/eliteGates/egDurable.js egRcFold), 128 a batch. Answers what each holds now. */
  async _egRcKeep(by, nowS) {
    const out = new Map();
    if (!by.size) return out;
    this._noEgRc.clear();   // receipts are being written - nobody's 'none' stands
    const keys = [...by.keys()].map(egRcKey), had = new Map();
    for (let i = 0; i < keys.length; i += 128) for (const [k, v] of await this.state.storage.get(keys.slice(i, i + 128))) had.set(k, v);
    for (const [sub, add] of by) out.set(sub, egRcFold(had.get(egRcKey(sub)), add, nowS));
    const pairs = [...out].map(([sub, list]) => [egRcKey(sub), list]);
    for (let i = 0; i < pairs.length; i += 128) await this.state.storage.put(Object.fromEntries(pairs.slice(i, i + 128)));
    return out;
  }
  /** EG-ZA (section 23, step 5): A BREACH'S ROOM TELLS THE HUB ITS RECEIPTS (EG_INTERNAL_RCPT - `{ b, rc: [[sub, r]], here }`):
   *  each well formed and naming its own account and this breach held for that account's hellos; an account with no socket
   *  in the room (`here`) and one online here handed its own at once, on its newest socket. */
  async _egRcInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const b = typeof body?.b === 'string' ? body.b : null;
    if (!b || !Array.isArray(body.rc)) return json({ ok: false }, 400);
    const by = new Map();
    for (const e of body.rc.slice(0, EG_RC_OWED_MAX)) {
      const c = Array.isArray(e) && typeof e[0] === 'string' ? readEgReceipt(e[1]) : null;
      if (!c || c.s !== e[0] || c.b !== b) continue;
      by.set(e[0], [...(by.get(e[0]) ?? []), { id: egRcId(c), r: e[1], e: c.e }]);
    }
    const held = await this._egRcKeep(by, Math.floor(Date.now() / 1000));
    const here = new Set(Array.isArray(body.here) ? body.here.filter((x) => typeof x === 'string').slice(0, 64) : []);
    const socks = this._siegeSockets();
    for (const [sub, add] of by) {
      const s = here.has(sub) ? null : socks.get(sub);
      if (!s) continue;
      const live = new Set(egRcLive(held.get(sub), Math.floor(Date.now() / 1000)));
      for (const x of add) if (live.has(x.r)) this._send(s[0], JSON.stringify({ t: 'eg', k: 'rcpt', r: x.r }));
    }
    return json({ ok: true });
  }
  /** EG-ZA: every breach receipt the hub holds for an account, to its hello while each is good (spent ones not said). */
  async _egReceiptTo(ws, sub, now) {
    if (this._noEgRc.has(sub)) return;   // asked before and none held - no write since says otherwise
    const kept = await this.state.storage.get(egRcKey(sub));
    if (!Array.isArray(kept)) { this._noEgRc.set(sub, 1); return; }
    for (const r of egRcLive(kept, Math.floor(now / 1000))) this._send(ws, JSON.stringify({ t: 'eg', k: 'rcpt', r }));
  }
  /** EG-ZA: AN ACCOUNT'S WORD THAT THE SERVICE COUNTED A RECEIPT (`{k:'claimed', b, q, w}`): its held copy forgotten and
   *  remembered as spent for the receipt's own life (a word that comes before the room's tell stands over it). */
  async _egClaimed(sub, m, now) {
    const k = egRcKey(sub), nowS = Math.floor(now / 1000), id = egRcId(m);
    const kept = await this.state.storage.get(k);
    const e = (Array.isArray(kept) ? kept.find((x) => x?.id === id)?.e : null) ?? nowS + EG_RECEIPT_TTL_S;
    this._noEgRc.clear();
    await this.state.storage.put(k, egRcSpent(kept, id, nowS, e));
  }
  /** EG-H2 (section 22): the hub's list of live breaches (`eglive`: breach -> its law and its last word), those past their
   *  last word taken off as it is read. */
  async _egLiveOf(now) {
    if (this._egLive === undefined) { const v = await this.state.storage.get(EG_LIVE_KEY); if (this._egLive === undefined) this._egLive = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    for (const [b, e] of Object.entries(this._egLive)) if (!(e?.until > now)) delete this._egLive[b];
    return this._egLive;
  }
  async _egLiveAdd(b, e, now) {
    const live = await this._egLiveOf(now);
    live[b] = e;
    this._egLiveSaid = null; this._egLiveGen = (this._egLiveGen ?? 0) + 1;   // AUDIT EG III: a breach added - the kept answer no longer counts it
    await this.state.storage.put(EG_LIVE_KEY, live);
  }
  /** EG-H2: is the Spire's road shut (THE DRAIN - the relay setting `egDrain` 'on', or the Worker's EG_DRAIN var)? */
  async _egDraining() { return relayCfgValue(await this._relayCfgOf(), this.env, 'egDrain') === 'on'; }
  /** EG-H2: AN OPEN REFUSED AT THE HUB - the stake the service took handed straight back (a void receipt to the opener's
   *  socket, which its client carries to the service), and the road said shut. EG-ZA (section 23): the void is the
   *  ROOM's - it writes the order into its tombstone first, so the order can never open a breach after the road reopens
   *  (the hub's own void did not); the hub holds it for the opener's hellos. */
  async _egShut(ws, a, c, now) {
    await this._egVoidAsk(ws, a.sub, c, now);
    this._send(ws, JSON.stringify({ t: 'eg', k: 'no', m: 'the road is shut' }));
  }
  /** EG-H2: THE SPIRE'S LIVE BREACHES (`/v1/eg/live`): each live room asked where it stands (at once), one that answers it
   *  holds no live breach taken off the list; every one between trials (`between` - an unanswered room counts as mid-trial,
   *  so no deploy goes on a guess), their laws, the longest's last word, the road. */
  async _egLiveInternal() { return json({ ...(await this._egLiveSay()), drain: await this._egDraining() }); }   // the road's word read fresh: a developer's switch is said at once
  /**
   * AUDIT EG III (lane3 #19, #5): THE LIVE LIST'S ANSWER, KEPT - `/v1/eg/live` is public and asked every room on the list
   * (up to EG_LIVE_MAX internal calls a request, with no bound on the requests), so the hub keeps its answer EG_LIVE_SAID_MS
   * and every ask meanwhile - a crowd's, a deploy's poll, an open at the cap - is answered by it, one asked at a time and the
   * ones that come while it is asked answered by that same asking (ASYNC NEVER DROPS: coalesced, never refused). The
   * deploy polls every fifteen seconds and goes tens of seconds after it reads, so a two-second answer is no staler than
   * the one it acts on. Answers `{ live, between, laws, until }` (the road's `drain` is the door's, read fresh).
   */
  async _egLiveSay() {
    const now = Date.now(), kept = this._egLiveSaid;
    if (kept?.body && now >= kept.at && now - kept.at < EG_LIVE_SAID_MS) return kept.body;
    if (this._egLiveAsking) return this._egLiveAsking;
    const gen = this._egLiveGen ?? 0;   // a breach added while the rooms are asked: that answer is not kept
    this._egLiveAsking = this._egLiveRead(now).then((body) => { if ((this._egLiveGen ?? 0) === gen) this._egLiveSaid = { at: now, body }; return body; }).finally(() => { this._egLiveAsking = null; });
    return this._egLiveAsking;
  }
  /** EG-H2: the live list asked of its rooms at `now` - the answer `_egLiveSay` keeps. */
  async _egLiveRead(now) {
    const live = await this._egLiveOf(now), list = Object.entries(live);
    const said = await Promise.all(list.map(([b]) => this._egPost(egRoomKey(b), EG_INTERNAL_STAGE, {})));
    let between = true, until = 0, n = 0, gone = false;
    const laws = new Set();
    list.forEach(([b, e], i) => {
      const st = said[i];
      if (st && st.live === false) { delete live[b]; gone = true; return; }
      n++; until = Math.max(until, e.until); laws.add(Number.isSafeInteger(st?.egv) ? st.egv : e.egv);
      if (!st || st.sg === 'trial') between = false;
    });
    if (gone) await this.state.storage.put(EG_LIVE_KEY, live);
    return { live: n, between, laws: [...laws].sort((x, y) => x - y), until };
  }
  /** EG-H2: where this breach's room stands, for the hub's list - its stage, its law, whether it holds; or no live breach. */
  async _egStageInternal() {
    const B = await this._egOf();
    return json(B && !B.end ? { live: true, sg: B.sg, egv: B.egv, wk: B.wk ? 1 : 0, held: B.hold ? 1 : 0 } : { live: false });
  }
  /** A breach's call kept for an account, said to its socket while the open window stands (and forgotten once past). */
  async _egCallTo(ws, sub, now) {
    const v = await this.state.storage.get(egCallKey(sub));
    if (!v) return;
    if (!(v.until > now)) { await this.state.storage.delete(egCallKey(sub)); return; }
    this._send(ws, JSON.stringify({ t: 'eg', ...v.call }));
  }

  // ───────────────────────────── SD8b: THE LAST MOMENT'S FIGHT ─────────────────────────────
  /** The realm's fight - the instance's, else storage's (the gate's law: one room, one fight). */
  async _sdFightOf() {
    if (this._sdFight === undefined) { const v = await this.state.storage.get(SD_FIGHT_KEY); if (this._sdFight === undefined) this._sdFight = v && typeof v === 'object' && Number.isSafeInteger(v.s) ? v : null; }
    return this._sdFight;
  }
  /** The fight to storage - every CHECKPOINT_MS from the beat, at once on a join, the fall and the loss. */
  async _sdFightSave(f, now, force) {
    if (!force && now - (this._sdFightSavedAt ?? 0) < CHECKPOINT_MS) return;
    this._sdFightSavedAt = now;
    await this.state.storage.put(SD_FIGHT_KEY, f);
  }
  /** A pose of the dungeon's frame in the arena's (net/superDungeon/sdBrain.js dungeonToRealm, net/superDungeon/sdRemnant.js arenaOf). */
  _arenaPoseOf(p) { const [x, , z] = dungeonToRealm(p.x, p.y ?? 0, p.z); const [ax, az] = arenaOf(x, z); return { x: ax, z: az }; }
  /** The fight's bodies in the realm now - one a fighter, its NEWEST socket speaking for it (the gate's law): where its
   *  last pose stands in the arena's frame, and whether that pose says it died. AUDIT SD III (F3): a pose older than
   *  SD_POSE_FRESH_MS (its hello's time until it has posed) speaks for no body - a frozen page is absent, not standing. */
  _sdFightBodies(f, now = Date.now()) {
    const newest = new Map();
    for (const [ws, b] of this._all()) {
      if (!b.id || !b.sub || !b.pose || !f.players[b.sub]) continue;
      if (now - (b.pAt ?? b.since ?? 0) > SD_POSE_FRESH_MS) continue;
      const had = newest.get(b.sub);
      if (!had || (b.since ?? 0) >= (had[1].since ?? 0)) newest.set(b.sub, [ws, b]);
    }
    return [...newest.values()].map(([ws, b]) => { const c = this._arenaPoseOf(b.pose); return { sub: b.sub, x: c.x, z: c.z, dead: !!b.pose.dd, tr: this._trailOf(ws, (p) => this._arenaPoseOf(p)) }; });   // INT12: and its trail - AUDIT INT11: its socket's
  }
  /** The fight's frames to everyone in the realm, in order. */
  _sdFightFan(frames) {
    if (!frames.length) return;
    this._fanFrames(frames.map((fr) => JSON.stringify({ t: 'sd', ...fr })), (b) => b.id);   // SCALE5b: a beat one frame to the second wire
  }
  /** The beat is armed now unless it already is, sooner. */
  async _sdFightArm(now) {
    const at = await this.state.storage.getAlarm();
    if (at == null || at > now + BRAIN_TICK_MS) await this.state.storage.setAlarm(now + BRAIN_TICK_MS);
  }
  /** SD8b: a soul entering the realm told its fight, while one lives or has fallen - false when its socket is gone. AUDIT
   *  SD II (L3 F5): a living fight's beat armed by the hello (a realm that had emptied slept, and its fight stood frozen
   *  until someone's `in` or blow), and a fight no beat has moved for SD_LOST_MS lost now (the next `in` makes the fresh
   *  one); (L3 F8) a fallen fight's earner handed its receipt again (an earner who stood here at the kill and whose page
   *  reloaded inside the hub's hold had nothing until its next hub hello). */
  async _sdHelloFight(ws, sub, s, now) {
    const sf = await this._sdFightOf();
    if (!sf || sf.lost || sf.s !== s) return true;
    if (!sf.fell && now - sf.lastTickAt >= SD_LOST_MS) { sf.lost = { at: now }; await this._sdFightSave(sf, now, true); return true; }
    if (!this._send(ws, JSON.stringify({ t: 'sd', ...SD_SEAM.stateOf(sf) }))) return false;
    if (!sf.fell) { await this._sdFightArm(now); return true; }
    const r = sub ? sf.rc?.[sub] : null;
    return !r || this._send(ws, JSON.stringify({ t: 'sd', k: 'rcpt', r }));
  }
  /**
   * A FIGHT WORD in a realm (Super-Dungeons.md section 10): `in` - from a verified account alive in the arena, a game whose
   * brain is the realm's, the Hour still holding its slot - joins the fight (a fight lost, or one no beat has moved for
   * SD_LOST_MS - a realm that emptied - is done: the next is fresh, numbered on) and is answered with its whole state; a
   * fight fallen answers with its state alone. A blow is believed by the Remnant's law from where the socket's own pose
   * stands (the dead strike nothing), and keeps the beat as an `in` does.
   */
  async _sdFightFrame(ws, a, m, now) {
    const s = sdSlotOfRoom(a.key);
    let f = await this._sdFightOf();
    if (f && f.s !== s) f = this._sdFight = null;
    if (m.k === 'in') {
      const no = (w) => { this._send(ws, JSON.stringify({ t: 'sd', k: 'no', m: w })); };
      if (!(m.bv >= SD_BRAIN_MIN)) { no(SD_NO_WORDS[3]); return; }
      const rec = await this._sdLiveOf(s, now);
      if (rec === undefined) return;   // AUDIT SD: the hub did not answer - unanswered, the page says its `in` again
      if (!rec || rec.s !== s || !sdHolds(rec, now)) { no(SD_NO_WORDS[0]); return; }
      if (typeof a.sub !== 'string' || !a.sub || !a.pose || a.pose.dd) return;
      if (!(await this._sdHallOf(s)).ok) return;   // AUDIT SD: past the Orrery alone - the Concord lays the only way to the arena
      // AUDIT SD II (L3 F1): THE FIGHT READ AGAIN after the last await, and decided with none between - two `in`s that
      // awaited the hub together each made a fresh fight off the one they had read before it, numbered alike, and the last
      // replaced the first's fighter (its page fought on believing itself in, its blows junk, until its socket was closed
      // for them). AUDIT SD II (L7 L1): and at the instant it is decided
      now = Date.now();
      f = this._sdFight ?? null;
      if (f && f.s !== s) f = this._sdFight = null;
      const at = this._arenaPoseOf(a.pose);
      if (!inArena(at.x, at.z, SD_ARENA_SLACK)) return;   // from the arena alone (AUDIT SD II, L4 C2: never the Steps)
      if (f?.fell) { this._send(ws, JSON.stringify({ t: 'sd', ...SD_SEAM.stateOf(f) })); if (f.rc?.[a.sub]) this._send(ws, JSON.stringify({ t: 'sd', k: 'rcpt', r: f.rc[a.sub] })); return; }   // SD9a: and its receipt again
      const fresh = !f || f.lost || now - f.lastTickAt >= SD_LOST_MS;
      if (fresh) f = this._sdFight = SD_SEAM.new({ s, fi: (f?.fi ?? 0) + 1, now, mk: sdMarksOf(s) });   // SD18a: its Hollow's marks
      const known = !!f.players[a.sub];
      const present = new Set();
      for (const [, b] of this._all()) if (b.sub && b.id) present.add(b.sub);
      // AUDIT SD II (L7 M2): THE LEVEL IS THE TOKEN'S - its character's, signed (`cl`); the claim stands only from a service
      // that signs none. A claim of 60 from a level-5 character brought a level-60 share (34,125 health) into the Remnant,
      // and a claim of 1 from a level-60 one earned the feat's whole roll for 63 points dealt
      const lv = Number.isSafeInteger(a.cl) && a.cl >= 1 ? a.cl : m.lv;
      if (!SD_SEAM.join(f, a.sub, a.name ?? '', lv, now, present)) { no(f.ended ? SD_NO_WORDS[1] : SD_NO_WORDS[2]); return; }
      this._send(ws, JSON.stringify({ t: 'sd', ...SD_SEAM.stateOf(f), me: 1 }));   // SD8c: `me` - the page blows into a fight that answered it alone
      this._trailSeed(ws, a, now);   // AUDIT INT11
      await this._sdFightSave(f, now, fresh || !known);   // AUDIT SD: a known fighter's `in` again is no write (the gate's AUDIT WB A3)
      await this._sdFightArm(now);
      return;
    }
    // INT12: ITS BODY, in its own word (net/bossBody.js) - asked of no hub; from one this fight does not count, not heard
    // (never junk: its `in` may be on its way)
    if (m.k === 'vt') { const p = f?.players[a.sub], line = this._bodyLine(); if (p) bodySaid(p, m.v / 1000, now, line.body, { enforce: line.enforce }); return; }
    if (!f || !f.players[a.sub]) { this._junk(ws); return; }
    // AUDIT SD: no blow lands once the Hour no longer holds its slot (a page that stayed past its cast-out) - a hub that does
    // not answer stops none
    const live = await this._sdLiveOf(s, now);
    // AUDIT SD II (L3 F1): a blow whose fight was replaced while it awaited the hub is dropped - not junk, it was fair when
    // said (and a fall on the old fight would have been kept over the new one). AUDIT SD II (L7 L1): judged at the instant
    // it lands - an earlier blow's answer coming after a later one's moved the purse's clock backwards, and the same seconds
    // refilled twice (1,755 dealt over 5.25 s where the law allows 1,024)
    if (this._sdFight !== f) return;
    now = Date.now();
    if (live !== undefined && !(live && live.s === s && sdHolds(live, now))) return;
    // INT12: a blow from one the count has fallen lands nothing once `enforce` holds
    const line = this._bodyLine();
    const pose = a.pose && !a.pose.dd && !bodyOut(f.players[a.sub], line.enforce) ? this._arenaPoseOf(a.pose) : null;
    if (m.k === 'ehit') this._sdFightFan(applyEchoHit(f, a.sub, m.e, m.d, m.r, pose, now, m.q));
    else if (m.k === 'xhit') this._sdFightFan(applyHeartHit(f, a.sub, m.c, m.d, m.r, pose, now, m.q));
    else {
      SD_SEAM.hit(f, a.sub, m.d, m.r, pose, now, m.q);
      if (f.fell && !f.said) { await this._sdFightFall(f, now); return; }
    }
    if (!f.fell && !f.lost && !(this._sdBeatArmedTo > now)) { this._sdBeatArmedTo = now + BRAIN_TICK_MS; await this._sdFightArm(now); }
  }
  /** ONE BEAT of a realm's alarm while its fight lives: the Remnant's law stepped over the bodies in the realm, its frames
   *  fanned, the fall said once, the fight checkpointed (at once when it is lost) - and the next beat armed while someone
   *  is here (a realm nobody stands in sleeps: an `in` after SD_LOST_MS finds its fight done). False when the realm holds
   *  no living fight - the alarm is the room's other duties' then. */
  async _sdFightTick() {
    const f = await this._sdFightOf();
    if (!f || f.lost || (f.said && f.told)) return false;
    const now = Date.now();
    void this._relayCfgFresh(now);   // SCALE5b: the line the count runs by, as the hub holds it - AUDIT SCALE II R1-2: asked ahead, never awaited by the beat
    try {
      // INT12: ITS BLOWS JUDGED HERE first, on the census as the count has it - one life: a fall by the count, enforced,
      // is the realm's own (_sdMarkFallenAt), and no death rises again here
      const line = this._bodyLine(), bodies = this._sdFightBodies(f, now), census = () => bodyCensus(f, bodies, now, line.body, line.enforce, { lives: false });   // AUDIT INT11: read once a beat
      await this._bodyCount('sd', f, SD_SEAM.judge(f, census(), now), now, line.body, (sub) => this._sdMarkFallenAt(f.s, sub));
      this._bodyTell('sd', f, now);   // AUDIT INT11: a fall its game has not taken, told again
      this._sdFightFan(SD_SEAM.step(f, now, this._bodiesBare(census()), rand01));
      if (f.fell && !f.said) await this._sdFightFall(f, now);
      else if (f.said && !f.told) await this._sdTellFellOnce(f, now);
      await this._sdFightSave(f, now, !!f.lost);
    } catch (e) { console.warn('[sd] beat failed', e?.message ?? e); }
    if (f.said && !f.told) { await this.state.storage.setAlarm(now + SD_TELL_RETRY_MS); return true; }
    const here = [...this._all()].some(([, b]) => b.id);
    if (here && !f.fell && !f.lost) { await this.state.storage.setAlarm(now + BRAIN_TICK_MS); return true; }
    return false;
  }
  /** THE FALL, SAID ONCE (the gate's law, AUDIT WB A10 - kept before it is said): the fight checkpointed with its `said`,
   *  then `fell` to everyone in the realm, then the hub told until it answers. One at a time (AUDIT WB12d L2). */
  async _sdFightFall(f, now) {
    if (this._sdFalling) return this._sdFalling;
    this._sdFalling = this._sdFightFallOnce(f, now).finally(() => { this._sdFalling = null; });
    return this._sdFalling;
  }
  async _sdFightFallOnce(f, now) {
    if (f.said) return;
    // SD9a: THE RECEIPTS - each fighter who earned it (the gate's `earned`: 2% of its own share dealt, or alive in the arena
    // half the fight), minted before the fall is said and kept with it
    const key = await this._receiptKeyOf(), nowS = Math.floor(now / 1000);
    f.rc = {};
    for (const sub of Object.keys(f.players).filter((x) => SD_SEAM.earned(f, x))) {
      try { f.rc[sub] = await mintSdReceipt({ d: f.s, s: sub, c: rand32(), x: earnedBy(f, sub), l: f.players[sub].lv, ...this._bodyMeasureOf(f, sub, SD_SEAM.earned) }, key, { subtle: crypto.subtle, nowS }); }   // INT14: the count's measure
      catch (e) { console.warn('[sd] receipt refused', e?.message ?? e); }
    }
    f.said = true;   // kept before it is said
    // who stood in the realm at the kill - their spoils are its floor's, so the hub hands their other tabs nothing first
    f.here = [...new Set([...this._all()].filter(([, b]) => b.id && b.sub && f.rc[b.sub]).map(([, b]) => b.sub))].slice(0, SD_FIGHTERS_MAX);
    await this._sdFightSave(f, now, true);
    this._sdFightFan([{ k: 'fell', ...f.fell }]);   // its moment, its best three, its count, its chart
    for (const [ws, b] of [...this._all()]) { const r = b.id && b.sub ? f.rc[b.sub] : null; if (r) this._send(ws, JSON.stringify({ t: 'sd', k: 'rcpt', r })); }
    await this._sdTellFellOnce(f, now);
  }
  /** The hub told of the fall, and it kept - once it has answered (a relay built without the binding keeps its own word).
   *  AUDIT SD II (L3 F6): ONE TELL IN FLIGHT - the fall's own tell and the beat's retry raced, and the hub was told twice
   *  (its receipts handed twice to the same sockets); a second asker waits on the first. */
  async _sdTellFellOnce(f, now) {
    if (f.told || !f.fell) return;
    if (this._sdFellTelling) return this._sdFellTelling;
    this._sdFellTelling = this._sdTellFellNow(f, now).finally(() => { this._sdFellTelling = null; });
    return this._sdFellTelling;
  }
  async _sdTellFellNow(f, now) {
    const rooms = this.env?.ROOMS;
    let ok = !rooms?.idFromName || !rooms?.get;
    if (!ok) {
      try {
        const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: f.s, at: f.fell.at, top: f.fell.top[0] ?? '', n: f.fell.n, rc: Object.entries(f.rc ?? {}), here: f.here ?? [] }), signal: AbortSignal.timeout(SD_TELL_RETRY_MS) }));
        ok = !!res && (res.ok || (res.status >= 400 && res.status < 500));
      } catch (e) { console.warn('[sd] hub', e?.message ?? e); }
    }
    if (!ok) return;
    f.told = true;
    await this._sdFightSave(f, now, true);
  }
  /** SD8b: THE HUB HEARS A FALL - its record moved on (net/superDungeon/sdLaw.js sdFell: the collapse and the rest from now) and said to
   *  everyone online, while it holds that slot found. */
  async _sdFellInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const c = validSdFellTell(body);
    if (!c) return json({ ok: false }, 400);
    const rec = await this._sdOf();
    if (rec && rec.s === c.s) {
      // AUDIT SD II (L3 F4): a kill landed inside the Hour and told after the hub had already said the fade (its tells
      // retried past SD_FADE_GRACE_MS) is the kill it was - the faded record is the found one it was at the kill's instant
      const was = rec.ph === 'gone' && rec.fellAt == null && rec.foundAt != null && c.at < rec.until ? { ...rec, ph: 'found' } : rec;
      const fell = sdFell(was, Math.min(c.at, Date.now()), { top: c.top, n: c.n });   // AUDIT SD: at the fall's own instant - a kill heard late is no kill after its Hour
      if (fell) { await this._sdSave(fell); this._sdFan(fell); await this._sdArm(Date.now()); }   // AUDIT SD: and the director's next move armed from it (its collapse, its rest)
      if (fell) await this._sdHeraldArm(Date.now());   // SD-HERALD: and to the channel
    }
    await this._sdKeepReceipts(c, Date.now());   // SD9a
    return json({ ok: true });
  }
  /** SD-THROUGH: THE HUB HEARS ONE WENT THROUGH - its record stamped (net/superDungeon/sdLaw.js sdEnter: once, while that slot
   *  is found and its boss stands) and said to everyone online. Answered ok whether it moved or not: the realm tells once. */
  async _sdInInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const c = validSdInTell(body);
    if (!c) return json({ ok: false }, 400);
    const rec = await this._sdOf();
    const inn = rec && rec.s === c.s ? sdEnter(rec, Date.now()) : null;
    if (inn) { await this._sdSave(inn); this._sdFan(inn); }
    return json({ ok: true });
  }
  /**
   * SD9a: THE HUB KEEPS EACH EARNER'S HOUR RECEIPT (the gate's AUDIT WB A4 law) for its life, one key an account (its
   * latest), and hands it to that account's next hello - never over a newer slot's, nor over its account's word that this
   * slot's is spent (that word may come first). One that stood in the realm at the kill is held from its hellos
   * SD_HERE_HOLD_MS (the realm's floor spends it); every other earner's newest socket here is handed it now.
   */
  async _sdKeepReceipts(c, now) {
    const here = new Set(c.here);
    const keep = [];
    for (const [sub, r] of c.rc) { const cl = readSdReceipt(r); if (cl && cl.s === sub && cl.d === c.s) keep.push([sub, { s: c.s, r, e: cl.e, ...(here.has(sub) ? { hold: now + SD_HERE_HOLD_MS } : {}) }]); }
    if (!keep.length) return;
    this._noSdRcpt.clear();   // receipts are being written - nobody's 'none' stands
    const had = new Map();
    for (let i = 0; i < keep.length; i += 128) for (const [k, v] of await this.state.storage.get(keep.slice(i, i + 128).map(([sub]) => sdReceiptKey(sub)))) had.set(k, v);
    const fresh = keep.filter(([sub]) => {
      const v = had.get(sdReceiptKey(sub));
      return !(v && typeof v === 'object' && Number.isSafeInteger(v.s) && (v.s > c.s || (v.s === c.s && v.spent)));
    });
    for (let i = 0; i < fresh.length; i += 128) await this.state.storage.put(Object.fromEntries(fresh.slice(i, i + 128).map(([sub, v]) => [sdReceiptKey(sub), v])));
    const owed = new Map(fresh.filter(([sub]) => !here.has(sub)));
    for (const [sub, [ws]] of this._siegeSockets()) if (owed.has(sub)) this._send(ws, JSON.stringify({ t: 'sd', k: 'rcpt', r: owed.get(sub).r }));   // the account's newest socket (AUDIT SOC B9's law)
    // AUDIT SD II (L5 F3): the held ones are handed on when their hold lapses - a fighter whose page crashed at the kill and
    // came back inside the hold was handed nothing until some later hello, hours on
    const held = fresh.filter(([sub]) => here.has(sub)).map(([sub, v]) => [sub, v.hold]);
    if (held.length) {
      const was = await this.state.storage.get(SD_HELD_KEY);
      const by = new Map(Array.isArray(was) ? was.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isSafeInteger(e[1])) : []);
      for (const [sub, at] of held) by.set(sub, at);
      await this.state.storage.put(SD_HELD_KEY, [...by].slice(-SD_FIGHTERS_MAX));
      await this._hubArm(Math.min(...held.map(([, at]) => at)));
    }
  }
  /** AUDIT SD II (L5 F3): THE HELD RECEIPTS' BEAT, on the hub's alarm: each whose hold has lapsed handed to its account's
   *  newest socket here, unless spent meanwhile (an account with none here hears it at its next hello, as before); the
   *  alarm armed for the next. */
  async _sdHeldBeat(now) {
    const was = await this.state.storage.get(SD_HELD_KEY);
    const held = Array.isArray(was) ? was.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isSafeInteger(e[1])) : [];
    if (!held.length) return;
    const rest = held.filter(([, at]) => at > now);
    if (rest.length < held.length) {
      const socks = this._siegeSockets();
      for (const [sub] of held.filter(([, at]) => at <= now)) { const s = socks.get(sub); if (s) { this._noSdRcpt.delete(sub); await this._sdReceiptTo(s[0], sub, now); } }
      if (rest.length) await this.state.storage.put(SD_HELD_KEY, rest); else await this.state.storage.delete(SD_HELD_KEY);
    }
    if (rest.length) await this._hubArm(Math.min(...rest.map(([, at]) => at)));
  }
  /** SD9a: an account's kept Hour receipt to its hello while it is good - an expired one forgotten, a spent one not said, a
   *  realm fighter's held while its floor spends it. */
  async _sdReceiptTo(ws, sub, now) {
    if (this._noSdRcpt.has(sub)) return;
    const k = sdReceiptKey(sub);
    const v = await this.state.storage.get(k);
    if (!v || typeof v !== 'object') { this._noSdRcpt.set(sub, 1); return; }
    if (!(Number.isFinite(v.e) && now < v.e * 1000) || (!v.spent && typeof v.r !== 'string')) { await this.state.storage.delete(k); return; }
    if (v.spent === true || (Number.isFinite(v.hold) && now < v.hold)) return;
    this._send(ws, JSON.stringify({ t: 'sd', k: 'rcpt', r: v.r }));
  }
  /** SD9a: the account's word that a slot's spoils are taken - REMEMBERED AS SPENT in its kept copy's place, for a receipt's
   *  life (the gate's AUDIT WBX2 M3: the word may come before the kill's own, and must stand over it). A newer slot's is
   *  left alone. */
  async _sdSpent(sub, slot, now) {
    // AUDIT SD II (L7 L2): no slot past the hub's own - a rising slot each frame was a storage write each frame, for ever
    if (!(slot <= ((await this._sdOf())?.s ?? 0))) return;
    const k = sdReceiptKey(sub);
    const v = await this.state.storage.get(k);
    const at = v && typeof v === 'object' && Number.isSafeInteger(v.s) ? v.s : null;
    if (at !== null && (at > slot || (at === slot && v.spent === true))) return;
    await this.state.storage.put(k, { s: slot, spent: true, e: Math.floor(now / 1000) + SD_RECEIPT_TTL_S });
  }

  // ───────────────────────────── RAID3: A TOWN'S RAID ─────────────────────────────
  /** AUDIT RAID R6: a copy kept on the instance, the map bounded. */
  _raidKeep(id, led) { this._raids.set(id, led); }   // SCALE2b: bounded at RAID_CACHE_MAX (AUDIT RAID R6), the oldest first
  /** A raid's ledger in this cell by its identity (net/raid/raidLaw.js raidLedgerId - AUDIT RAID R1: the key and the
   *  signature), or null - the instance's copy, else storage's (read once, kept then). */
  async _raidLedgerOf(id) {
    if (this._raids.has(id)) return this._raids.get(id);
    const v = await this.state.storage.get(raidLedgerKey(id));
    const led = v && typeof v === 'object' && typeof v.key === 'string' && raidLedgerId(v) === id ? v : null;
    this._raidKeep(id, led);
    return led;
  }
  /** When a ledger is forgotten, on the relay's clock: its raid's last minute, and RAID_KEEP_MS past it. */
  _raidEndsAt(led) { return wallMsForClassicMinutes(raidLedgerEndMinute(led)) + RAID_KEEP_MS; }
  /** This cell's alarm, armed for `at` unless it already is, sooner. */
  async _raidArm(at) {
    const had = await this.state.storage.getAlarm();
    if (had == null || had > at) await this.state.storage.setAlarm(at);
  }
  /** A ledger to storage, and the alarm armed for the soonest thing it owes: its hub told again, else its end. */
  async _raidSave(led, now) {
    const id = raidLedgerId(led);
    this._raidSavedAt.set(id, now);   // AUDIT RAID R6: bounded (SCALE2b: the oldest first)
    await this.state.storage.put(raidLedgerKey(id), led);
    await this._raidArm(led.cl && !led.told ? now + RAID_TELL_RETRY_MS : this._raidEndsAt(led));
  }
  /** A NEW RAID'S PLACE in this cell, for a ledger `by` would make - answers whether there is one. Every ledger past its
   *  end is forgotten first. AUDIT RAID R3: past RAID_LEDGERS_MAX a place was the stalest live ledger's, whatever it
   *  was - a raid being fought (its shares lost, its cap restarted), or one cleansed (its receipts minted again off a
   *  new seed by the next word, its hub never told) - and any word in the cell could ask. Now a place is given only by
   *  a ledger nobody has fought for RAID_LEDGER_BUSY_MS and that is not cleansed, one that counted nothing first
   *  (net/raid/raidLaw.js raidEvictPick); with none, the new raid waits. And one speaker holds RAID_LEDGERS_BY_MAX places
   *  at most. */
  async _raidMakeRoom(now, by) {
    const m = await this.state.storage.list({ prefix: RAID_LEDGER_PREFIX });
    const live = [], dead = [];
    for (const [k, v] of m) {
      const led = v && typeof v === 'object' && typeof v.key === 'string' ? (this._raids.get(raidLedgerId(v)) ?? v) : null;
      (led && Number.isSafeInteger(led.st) && now < this._raidEndsAt(led) ? live : dead).push([k, led]);
    }
    for (const [k, led] of dead) { await this.state.storage.delete(k); if (led) this._raidKeep(raidLedgerId(led), null); }
    if (live.filter(([, led]) => led.by === by).length >= RAID_LEDGERS_BY_MAX) return false;
    if (live.length < RAID_LEDGERS_MAX) return true;
    const out = raidEvictPick(live.map(([, led]) => led), now);
    if (!out) return false;
    const id = raidLedgerId(out);
    await this.state.storage.delete(raidLedgerKey(id));
    this._raidKeep(id, null);
    return true;
  }
  /**
   * A PLAYER'S WORD on the raid whose town it stands in (net/raid/raidLaw.js): heard in the town's own cell alone (anywhere
   * else it is junk - a correct client says it nowhere else) and inside the raid's day and window. AUDIT RAID: a raid
   * is its whole tuple (R1 - the key and the signature: a word naming another start, target, party or town is another
   * raid, never folded into this one); its ledger is made only by a word whose socket's pose stands on its town's
   * pixel (R1 - any socket in the cell made it), in a place the cell can give (R3); a word no day could roll is junk and
   * one out of its time is dropped, both before any read (R6). A word from the town's pixel is folded in - its deaths
   * credited as far as the cap lets them, its strike, its moment. A count that moved is written and fanned to the cell;
   * one that reached the target is the cleanse. The speaker is answered with the ledger and, its account having earned
   * the cleanse, its receipt again (a reconnect that missed it).
   */
  async _raidWord(ws, a, m, now) {
    if (worldRoom(m.px, m.py) !== a.key) { this._junk(ws); return; }
    if (!raidWordSane(m)) { this._junk(ws); return; }   // AUDIT RAID R6: no honest machine's word
    // AUDIT SCALE II R3-3: NO RAID LEDGER IN A LAYER. A raid's ledger is its town cell's object's, and a layer is another
    // object for the same cell (SCALE5d): it made a ledger of its own for the same raid - its own count, its own cleanse,
    // its own receipts minted, and the hub told the town cleansed while the place's raid went on. A layer's word is
    // nothing at all (the client knows no refusal of a raid word, and an honest one says it here: no strike)
    if (a.ly) return;
    if (!raidWordFits(m, sharedClassicMinutes(now))) return;   // outside its raid's time: nothing read, kept or said
    // RAID-ROLL: a raid the day never rolled is nobody's - its start, target and party against the day's own draws
    // (no game data), and its whole tuple against the day's roll while the hub holds the pinned towns table. Silent:
    // a world whose towns are not the operator's (a data mod) rolls its own raids, and they are its own
    const day = raidDayOfKey(m.key);
    if (!raidOnSlot(m, this._raidSlotsOf(day))) return;
    const rolled = await this._raidDayIdsOf(day, now);
    if (rolled && !rolled.has(raidLedgerId(m))) return;
    const id = raidLedgerId(m);
    if (this._raidCleaning.has(id)) return;   // its cleanse is being minted: said in a moment, to everyone
    const [px, py] = a.pose ? mapPixelOfWire(a.pose.x, a.pose.z) : [-1, -1];
    const here = px === m.px && py === m.py;
    const acct = typeof a.sub === 'string' && a.sub ? a.sub : `id:${a.id}`;
    let led = await this._raidLedgerOf(id);
    const fresh = !led;
    if (!led) {
      if (!here) return;   // AUDIT RAID R1: made only from its town's own pixel
      if (!(await this._raidMakeRoom(now, acct))) return;   // AUDIT RAID R3: no place for it now
      led = newRaidLedger(m, now, acct);
      this._raidKeep(id, led);
    }
    const struckBefore = led.a[acct]?.s === 1;
    const { credited, known } = here ? foldRaidWord(led, acct, a.name ?? '', m, now) : { credited: 0, known: false };
    if (raidCleansed(led) && !led.cl) { await this._raidClean(led, now); return; }   // at the target and not yet stamped - whatever word finds it so (a ledger kept at its target by a write before an eviction)
    const struck = known && !struckBefore && led.a[acct]?.s === 1;
    if (fresh || credited > 0 || struck || (known && now - (this._raidSavedAt.get(id) ?? 0) >= RAID_SAVE_MS)) await this._raidSave(led, now);
    if (credited > 0) this._raidFan(raidLedgerState(led));
    else this._send(ws, JSON.stringify({ t: 'raid', ...raidLedgerState(led) }));
    const r = led.cl && typeof a.sub === 'string' ? led.rc?.[a.sub] : null;
    if (r) this._send(ws, JSON.stringify({ t: 'raid', k: 'rc', r }));
  }
  /** A raid word to everyone hello'd in the cell. */
  _raidFan(o) {
    const s = JSON.stringify({ t: 'raid', ...o });
    for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, s);
  }
  /** THE CLEANSE, SAID ONCE - the gate's fall's law (AUDIT WB A10): each earner's receipt minted (net/raid/raidReceipt.js -
   *  the seed the relay's own) and the ledger kept WITH them before a word of it is said; then `cl` to everyone in the
   *  cell (AUDIT RAID R1: with its signature), each earner's receipt to its account's newest socket here (AUDIT WBX S4:
   *  one tab an account), and the hub told until it answers - AUDIT RAID R2: the receipts ride that word, so the hub
   *  hands each to its account wherever it stands. A socket no account vouched for is on the count and never on the
   *  record. */
  async _raidClean(led, now) {
    const id = raidLedgerId(led);
    this._raidCleaning.add(id);
    try {
      const earned = raidEarned(led, now);
      const key = await this._receiptKeyOf();
      const nowS = Math.floor(now / 1000);
      led.rc = {};
      for (const [acct] of earned) {
        if (acct.startsWith('id:')) continue;
        try { led.rc[acct] = await mintRaidReceipt({ w: led.key, s: acct, c: rand32(), y: led.ty }, key, { subtle: crypto.subtle, nowS }); }
        catch (e) { console.warn('[raid] receipt refused', e?.message ?? e); }
      }
      led.cl = { at: now, top: raidTop(earned), n: earned.length };
      await this._raidSave(led, now);
    } finally { this._raidCleaning.delete(id); }
    this._raidFan({ k: 'cl', key: led.key, ...led.cl, g: raidSig(led) });
    const newest = new Map();
    for (const [ws, b] of [...this._all()]) {
      if (!b.id || typeof b.sub !== 'string' || !led.rc[b.sub]) continue;
      const had = newest.get(b.sub);
      if (!had || (b.since ?? 0) >= (had.b.since ?? 0)) newest.set(b.sub, { ws, b });
    }
    for (const [sub, { ws }] of newest) this._send(ws, JSON.stringify({ t: 'raid', k: 'rc', r: led.rc[sub] }));
    await this._raidTellHubOnce(led, now);
  }
  /** The hub told of a cleanse, and it kept - once it has answered (a beat of the alarm tells it again). */
  async _raidTellHubOnce(led, now) {
    if (led.told || !led.cl) return;
    if (!(await this._raidTellHub({ key: led.key, at: led.cl.at, top: led.cl.top, n: led.cl.n, g: raidSig(led), rc: led.rc ?? {} }))) { await this._raidArm(now + RAID_TELL_RETRY_MS); return; }
    led.told = true;
    await this._raidSave(led, now);
  }
  /** The hub's door (the gate's `_gateTellHub`): a relay built without the binding keeps the cell's own word. */
  async _raidTellHub(body) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return true;
    try { const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${RAID_INTERNAL_CLEAN}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) })); return !!res?.ok; }
    catch (e) { console.warn('[raid] hub', e?.message ?? e); return false; }
  }
  // ─────────────────────────── WB12d: THE FAITHFUL'S RITE ───────────────────────────
  /** A WORD AT THE RITE (net/gate/gateRite.js): believed from a pose at the circle the day's law places in the word's pixel,
   *  inside the rite's window (and RITE_GRACE_MS past it - a fall seen at its last second), from an account the token
   *  vouched for (a guest's too: the account service keeps a guest's receipt for its week). Who struck the faithful is
   *  kept by account; the Summoner's fall, said, breaks the rite - kept, then the hub told, and told again as more who
   *  struck are said, while its circle stands. AUDIT WB12d (R1): THE CELL KEEPS EACH CIRCLE SAID IN IT (RITE_CIRCLES_MAX)
   *  - a word at one never stands in another's way, and the hub chooses by the gate's agreed site. Honest limit (bible
   *  section 19 D): a word is its player's own - the cell checks where and when it was said, not each blow. */
  async _riteWord(ws, a, m, now) {
    if (worldRoom(m.px, m.py) !== a.key) { this._junk(ws); return; }
    if (!isGateDay(m.d) || !riteHeard(m.d, now)) return;   // outside its window: nothing read, kept or said
    // AUDIT SCALE II R3-3 (c): NO CIRCLE IN A LAYER (the serpent's and the raid's law). A circle's ledger is its cell
    // object's, and a layer is another object for the same cell (SCALE5d): it kept a circle of its own and told the hub
    // RITE_INTERNAL_BROKEN, which said the rite broken to everyone online while the place's stood. A layer's word is
    // nothing at all - the rite has no refusal word (RITE_OUT_KINDS: a break and a cage, both the hub's), and the cell
    // never answers its speaker; an honest client says it there, so nobody is struck
    if (a.ly) return;   // the place's circle alone
    if (!a.pose || !riteNear(m.d, m.px, m.py, a.pose.x, a.pose.z)) return;   // not at its circle
    if (typeof a.sub !== 'string' || !a.sub) return;
    const led = await this._riteLedgerOf(m.d);
    if (!led) return;   // an older day's word
    const k = `${m.px},${m.py}`;
    let c = led.c[k];
    if (!c) {
      if (Object.keys(led.c).length >= RITE_CIRCLES_MAX) return;
      c = led.c[k] = { px: m.px, py: m.py, h: {}, f: 0, at: 0, told: -1 };
    }
    let moved = false;
    if (m.s === 1 && !Object.hasOwn(c.h, a.sub) && Object.keys(c.h).length < RITE_HELPERS_MAX) { c.h[a.sub] = sanitizeName(a.name ?? ''); moved = true; }
    if (m.f === 1 && !c.f) { c.f = 1; c.at = now; moved = true; }
    // BROKER-CAGE: every one of the faithful seen to fall - the Summoner among them, so the rite is broken by it too
    if (m.c === 1 && !c.cl) { c.cl = 1; c.clAt = now; if (!c.f) { c.f = 1; c.at = now; } moved = true; }
    if (!moved) return;   // AUDIT WB12d (R4): a word that moves nothing tells nothing - the alarm tells what is owed
    await this._riteSave(led);
    await this._riteTellHub(now);
  }
  /** The cell's ledger - `{ d, c: { 'px,py': { px, py, h, f, at, told, cl?, clAt?, clTold? } } }`, the latest day's. Asked for `day`: an older
   *  day's word is nothing (null), a newer day's starts it again. */
  async _riteLedgerOf(day = null) {
    if (this._riteLed === undefined) { const v = await this.state.storage.get(RITE_KEY); if (this._riteLed === undefined) this._riteLed = riteRecordOk(v) ? v : null; }   // a read never undoes a word kept while it was out
    if (day == null) return this._riteLed;
    if (this._riteLed && this._riteLed.d > day) return null;
    if (!this._riteLed || this._riteLed.d < day) this._riteLed = { d: day, c: {} };
    return this._riteLed;
  }
  async _riteSave(led) { this._riteLed = led; await this.state.storage.put(RITE_KEY, led); }
  /** THE HUB TOLD of each broken circle and who broke it - again when more are said. AUDIT WB12d: ONE TELL IN FLIGHT (a
   *  word that lands meanwhile is told by the alarm - R4), the retry ARMED BEFORE it goes (a reset mid-tell still tells -
   *  R5), and let go once its breach has collapsed (R3). Answers whether a tell is still owed. */
  async _riteTellHub(now) {
    const led = await this._riteLedgerOf();
    const owed = led ? Object.values(led.c).filter(riteOwed) : [];
    if (!owed.length || !riteStands(led.d, now)) return false;
    // AUDIT BROKER-CAGE R2: A TELL IN FLIGHT took what was owed when it went - a word said meanwhile (the faithful's last
    // fall after the Summoner's) is the retry's, armed here; the alarm it armed may have fired already, and arms nothing
    if (this._riteTelling) { await this._riteArm(now + RITE_TELL_RETRY_MS); return true; }
    this._riteTelling = true;
    try {
      await this._riteArm(now + RITE_TELL_RETRY_MS);
      let moved = false;
      for (const c of owed) {
        const n = Object.keys(c.h).length;
        const cl = c.cl ? 1 : 0;   // BROKER-CAGE: the faithful every one fallen, told beside the break
        if (await this._riteTellHubOf({ d: led.d, px: c.px, py: c.py, at: c.at, h: Object.entries(c.h), ...(cl ? { cl, clAt: c.clAt } : {}) })) { c.told = Math.max(c.told, n); if (cl) c.clTold = 1; moved = true; }
      }
      if (moved && this._riteLed === led) await this._riteSave(led);
      return Object.values(led.c).some(riteOwed);
    } finally { this._riteTelling = false; }
  }
  /** The alarm's beat for a rite the hub has not heard: armed no later than `at` (never pushed off a sooner one). */
  async _riteArm(at) {
    try { const had = await this.state.storage.getAlarm(); if (had == null || had > at) await this.state.storage.setAlarm(at); }
    catch (e) { console.warn('[rite] arm', e?.message ?? e); }
  }
  /** The hub's door (the raid's): a relay built without the binding keeps the cell's own word. AUDIT BROKER-CAGE R2: a
   *  tell that hangs is let go at its own retry (a hung one held every later tell off for the object's life) - the hub
   *  folds a tell said twice as once. */
  async _riteTellHubOf(body) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return true;
    try { const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${RITE_INTERNAL_BROKEN}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(RITE_TELL_RETRY_MS) })); return !!res?.ok; }
    catch (e) { console.warn('[rite] hub', e?.message ?? e); return false; }
  }
  /** THE HUB'S HALF: the day's rites - `{ d, c: { 'px,py': { px, py, at, h, said, cl?, clAt? } } }`, each circle a cell told of
   *  (RITE_HUB_CIRCLES_MAX), the latest day's. */
  async _riteOf() {
    if (this._riteHub === undefined) { const v = await this.state.storage.get(RITE_KEY); if (this._riteHub === undefined) this._riteHub = riteRecordOk(v) ? v : null; }
    return this._riteHub;
  }
  /** When the day's Warden fell, as the hub heard it (ms), or null - the breach collapses after it (riteStands). */
  async _fellAtOf(d) { const g = await this._gateFellOf(); return g && g.d === d && Number.isFinite(g.at) ? g.at : null; }
  /** A circle's rite broken: kept beside the day's other circles, said to everyone online the first time (each client
   *  hears its own circle's word), and its helpers folded in each time - the breach's room reads the circles the gate's
   *  agreed site stands by at the kill. Projected through the wire's own law, as a client would. */
  async _riteBrokenInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const o = validRiteOut({ k: 'br', d: body?.d, px: body?.px, py: body?.py, at: body?.at, by: [] });
    if (!o) return json({ ok: false }, 400);
    const now = Date.now();
    await this._riteOf();
    const fellAt = await this._fellAtOf(o.d);
    // AUDIT WB12d (R3): its breach collapsed - nothing left to say of the rite. AUDIT BROKER-CAGE R1: but the Broker's
    // cage stands until midnight (cageStands) - a cleared word told after an early kill's collapse (its cell could not
    // reach this hub until then) is kept and said, and nothing else
    const stands = riteStands(o.d, now, fellAt);
    if (!stands && !(body?.cl === 1 && cageStands(o.d, now))) return json({ ok: true });
    // AUDIT WB12d (S1): read and written with no await between - two tells landing together each saw a fresh day
    let r = this._riteHub;
    if (r && r.d > o.d) return json({ ok: true });   // an older day's
    if (!r || r.d < o.d) r = { d: o.d, c: {} };
    const k = `${o.px},${o.py}`;
    let c = r.c[k];
    if (!c) {
      if (Object.keys(r.c).length >= RITE_HUB_CIRCLES_MAX) return json({ ok: true });
      c = r.c[k] = { px: o.px, py: o.py, at: o.at, h: {}, said: 0 };
    }
    for (const e of Array.isArray(body.h) ? body.h.slice(0, RITE_HELPERS_MAX) : []) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !e[0] || e[0].length > 128) continue;
      if (Object.hasOwn(c.h, e[0]) || Object.keys(c.h).length < RITE_HELPERS_MAX) c.h[e[0]] = sanitizeName(typeof e[1] === 'string' ? e[1] : '');
    }
    const fresh = stands && !c.said;
    if (stands) c.said = 1;
    // BROKER-CAGE: its faithful every one fallen - kept once, with when the cell heard it
    const cleared = body.cl === 1 && !c.cl;
    if (cleared) { c.cl = 1; c.clAt = Number.isSafeInteger(body.clAt) && body.clAt > 0 ? body.clAt : now; }
    this._riteHub = r;
    await this.state.storage.put(RITE_KEY, r);
    if (fresh) {
      const said = JSON.stringify({ t: 'rite', ...riteSaid(r.d, c) });
      for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, said);
      try { await this._heraldRiteOwe(r.d, now); } catch (e) { console.warn('[herald] rite not kept', e?.message ?? e); }   // and to the channel
    }
    if (cleared) {   // the Broker's cage open, said to everyone online once (each client hears its own circle's)
      const said = JSON.stringify({ t: 'rite', ...cageSaid(r.d, c) });
      for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, said);
    }
    return json({ ok: true });
  }
  /** A breach's room asking for the day's helpers: those of the circles the gate's agreed site stands by. */
  async _riteDayInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* none */ }
    const d = Number.isSafeInteger(body?.d) ? body.d : null;
    return json({ h: d == null ? [] : riteHelpersBy(await this._riteOf(), d, agreedGateSite(await this._gateSiteOf(), d)) });
  }
  /** The breach's room's half: the accounts that broke the day's rite, asked of the hub - null when it does not answer
   *  within `timeoutMs` (AUDIT WB12d L3: the caller keeps its last answer, and the kill is never held long for it). */
  async _riteHelpersOf(day, timeoutMs = RITE_ASK_TIMEOUT_MS) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return new Set();
    try {
      const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${RITE_INTERNAL_DAY}`, { method: 'POST', body: JSON.stringify({ d: day }), signal: AbortSignal.timeout(timeoutMs) }));
      const body = res?.ok ? await res.json() : null;
      return Array.isArray(body?.h) ? new Set(body.h.filter((x) => typeof x === 'string' && x).slice(0, RITE_HELPERS_MAX)) : null;
    } catch (e) { console.warn('[rite] helpers', e?.message ?? e); return null; }
  }
  /** AUDIT WB12d (R2, L3): THE HELPERS ASKED AHEAD - from the opening (the words are final then, but for a tell still
   *  owed), every RITE_ASK_EVERY_MS until the kill, the answer kept on the fight; never awaited by the beat. */
  _riteAskAhead(f, now) {
    if (f.fell || this._riteAsking || now < gateTimes(f.day).openAt || now - (this._riteAskedAt ?? -Infinity) < RITE_ASK_EVERY_MS) return;
    this._riteAsking = true; this._riteAskedAt = now;
    this._riteHelpersOf(f.day).then((h) => { if (h && this._fight === f && !f.said) f.helped = [...h]; }).catch(() => {}).finally(() => { this._riteAsking = false; });
  }
  // ─────────────────────────── RAID-ROLL: THE DAY'S ROLL, THE RELAY'S TOO ───────────────────────────
  /** A cell's copy of a day's slots (net/raid/raidLaw.js raidDaySlots - the draws no game data decides). */
  _raidSlotsOf(day) {
    let s = this._raidSlots.get(day);
    if (!s) { if (this._raidSlots.size >= 4) this._raidSlots.clear(); s = raidDaySlots(day); this._raidSlots.set(day, s); }
    return s;
  }
  /** A cell's copy of a day's whole roll, asked of the hub once a day an instance: the Set of its raids' identities, or
   *  null while the hub holds no table (asked again after RAID_DAY_ASK_MS; a hub that did not answer is "none"). */
  async _raidDayIdsOf(day, now) {
    const had = this._raidDays.get(day);
    if (had && (had.ids || now - had.at < RAID_DAY_ASK_MS)) return had.ids;
    let ids = null;
    const rooms = this.env?.ROOMS;
    if (rooms?.idFromName && rooms?.get) {
      try {
        const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${RAID_INTERNAL_DAY}`, { method: 'POST', body: JSON.stringify({ d: day }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
        const body = res?.ok ? await res.json() : null;
        if (Array.isArray(body?.ids)) ids = new Set(body.ids.filter((x) => typeof x === 'string'));
      } catch (e) { console.warn('[raid] day', e?.message ?? e); }
    }
    if (this._raidDays.size >= 4 && !had) this._raidDays.clear();
    this._raidDays.set(day, { ids, at: now });
    return ids;
  }
  /** The hub's pinned hash (the operator's RAID_TOWNS_SHA256, tools/raidTowns.mjs), or null: none pinned, none asked. */
  _raidTownsPin() {
    const h = String(this.env?.RAID_TOWNS_SHA256 ?? '').trim().toLowerCase();
    return RAID_TOWNS_SHA_RE.test(h) ? h : null;
  }
  /** The hub's towns table, read once an instance from storage - only while it is the pinned one - or null. */
  async _raidTowns() {
    const pin = this._raidTownsPin();
    if (!pin) return null;
    if (this._raidTownsKept !== undefined) return this._raidTownsKept;
    let kept = null;
    const head = await this.state.storage.get('raidtowns');
    if (head && head.h === pin && Number.isSafeInteger(head.n) && head.n > 0) {
      const keys = Array.from({ length: head.n }, (_, i) => `raidtowns:${i}`);
      const got = await this.state.storage.get(keys);
      const parts = keys.map((k) => got.get(k));
      if (parts.every((p) => typeof p === 'string')) {
        const text = parts.join('');
        if ((await raidTownsHash(text)) === pin) kept = readRaidTowns(text);
      }
    }
    this._raidTownsKept = kept;
    return kept;
  }
  /** The hash the hub asks a hello for - its pin, while it holds no table - or null. */
  async _raidTownsWanted() { return this._raidTownsPin() && !(await this._raidTowns()) ? this._raidTownsPin() : null; }
  /** A PIECE OF THE TABLE from a hub socket: kept with the socket's others until it has them all, then the whole taken
   *  only if it hashes to the pin and reads as a table - written, and the day's rolls read off it from now. */
  async _raidTownsPiece(ws, m) {
    const pin = this._raidTownsPin();
    if (!pin || m.h !== pin || (await this._raidTowns())) return;   // not asked for, or held already
    let up = this._raidTownsUp.get(ws);
    if (!up || up.n !== m.n) {
      if (!up && this._raidTownsUp.size >= 4) this._raidTownsUp.delete(this._raidTownsUp.keys().next().value);   // a few uploads in flight at most (SCALE2b: the oldest goes, not every one)
      up = { n: m.n, parts: new Array(m.n).fill(null) };
      this._raidTownsUp.set(ws, up);
    }
    up.parts[m.i] = m.c;
    if (up.parts.some((p) => p == null)) return;
    this._raidTownsUp.delete(ws);
    const text = up.parts.join('');
    if ((await raidTownsHash(text)) !== pin) return;   // not the operator's table
    const regions = readRaidTowns(text);
    if (!regions) return;
    const puts = { raidtowns: { h: pin, n: up.n } };
    up.parts.forEach((p, i) => { puts[`raidtowns:${i}`] = p; });
    await this.state.storage.put(puts);
    this._raidTownsKept = regions;
    this._raidDayRolls.clear();
  }
  /** THE HUB'S DOOR for a cell's day: the identities of the raids the day rolled off the kept table, or `ids: null`. */
  async _raidDayInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const day = body?.d;
    if (!Number.isSafeInteger(day) || day < 0 || day > 9999999) return json({ error: 'bad day' }, 400);
    const regions = await this._raidTowns();
    if (!regions) return json({ ids: null });
    let ids = this._raidDayRolls.get(day);
    if (!ids) { if (this._raidDayRolls.size >= 4) this._raidDayRolls.clear(); ids = [...raidDayIds(day, regions)]; this._raidDayRolls.set(day, ids); }
    return json({ ids });
  }
  /** A CELL'S ALARM: every ledger past its end forgotten, a cleanse its hub has not heard told again, and the alarm armed
   *  for the next thing owed. False when this room keeps no raid (the alarm is somebody else's). */
  async _raidSweep(now) {
    const m = await this.state.storage.list({ prefix: RAID_LEDGER_PREFIX });
    if (!m.size) return false;
    let next = Infinity;
    for (const [k, v] of m) {
      const led = v && typeof v === 'object' && typeof v.key === 'string' ? (this._raids.get(raidLedgerId(v)) ?? v) : null;
      if (!led || !Number.isSafeInteger(led.st) || now >= this._raidEndsAt(led)) { await this.state.storage.delete(k); if (led) this._raidKeep(raidLedgerId(led), null); continue; }
      if (led.cl && !led.told) await this._raidTellHubOnce(led, now);
      next = Math.min(next, led.cl && !led.told ? now + RAID_TELL_RETRY_MS : this._raidEndsAt(led));
    }
    if (next < Infinity) await this.state.storage.setAlarm(next);
    return true;
  }
  /** THE HUB'S cleansed raids - today's and yesterday's, `[key, at, sig]` - read once, the older days let go on the way. */
  async _raidCleansOf(now) {
    if (this._raidCleans === undefined) { const v = await this.state.storage.get('raidcl'); this._raidCleans = Array.isArray(v) ? v : []; }
    const today = Math.floor(sharedClassicMinutes(now) / RAID_DAY_MINUTES);
    this._raidCleans = this._raidCleans.filter((e) => Array.isArray(e) && e.length === 3 && (raidDayOfKey(e[0]) ?? -1) >= today - 1);
    return this._raidCleans;
  }
  /** THE HUB'S HALF: a raid's cleanse, from its town's cell. Everyone online hears it once (a player in the raid's region
   *  says it, and nobody's machine says that raid withdrew), and it is kept for a hello while its day is today or
   *  yesterday. Projected through the wire's own law, as a client would. AUDIT RAID R2: the earners' receipts are kept
   *  and handed first - a word told again keeps and hands none twice; R7: the list is written BEFORE the hub's copy
   *  moves (a put that threw left the copy holding a cleanse storage never had - the cell's retry found it known and
   *  nobody was ever told). */
  async _raidCleanInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const cl = validRaidOut({ k: 'cl', key: body?.key, at: body?.at, top: body?.top, n: body?.n, g: body?.g });
    if (!cl) return json({ ok: false }, 400);
    const now = Date.now();
    await this._raidReceiptsKeep(cl, body?.rc, now);
    const list = await this._raidCleansOf(now);
    if (list.some((e) => e[0] === cl.key && e[2] === cl.g)) return json({ ok: true });   // told again: the cell missed the answer, not news
    const next = [...list, [cl.key, cl.at, cl.g]];
    while (next.length > RAID_CLEANS_MAX) next.shift();
    await this.state.storage.put('raidcl', next);
    this._raidCleans = next;
    const said = JSON.stringify({ t: 'raid', ...cl });
    for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, said);
    return json({ ok: true });
  }
  /** AUDIT RAID R2: A CLEANSE'S RECEIPTS, KEPT BY THE HUB for their accounts - each checked for its own account and raid
   *  (the relay's own mint, read back), kept under its account's key (the newest RAID_RC_KEEP, each for RAID_RC_KEEP_MS)
   *  and handed at once to its account's socket here (ONE-SEAT: one tab an account in the hub). One kept already is
   *  neither kept nor handed again. */
  async _raidReceiptsKeep(cl, rc, now) {
    if (!rc || typeof rc !== 'object' || Array.isArray(rc)) return;
    const fresh = [];
    for (const [acct, r] of Object.entries(rc).slice(0, RAID_ACCOUNTS_MAX)) {
      const c = validRaidOut({ k: 'rc', r }) ? readRaidReceipt(r) : null;
      if (c && c.signed && c.s === acct && c.w === cl.key) fresh.push([acct, r]);   // an unsigned one (a relay with no key) no service would take
    }
    if (!fresh.length) return;
    const had = new Map();
    for (let i = 0; i < fresh.length; i += 128) for (const [k, v] of await this.state.storage.get(fresh.slice(i, i + 128).map(([acct]) => raidReceiptKeyOf(acct)))) had.set(k, v);
    const puts = [], hand = [];
    for (const [acct, r] of fresh) {
      const k = raidReceiptKeyOf(acct);
      const kept = raidRcLive(had.get(k), now);
      if (kept.some((e) => e.r === r)) continue;
      puts.push([k, [...kept, { r, until: now + RAID_RC_KEEP_MS }].slice(-RAID_RC_KEEP)]);
      hand.push([acct, r]);
    }
    if (puts.length) this._noRaidRcpt.clear();   // SCALE2b: receipts are being written - nobody's 'none' stands
    for (let i = 0; i < puts.length; i += 128) await this.state.storage.put(Object.fromEntries(puts.slice(i, i + 128)));
    const newest = new Map();
    for (const [ws, b] of [...this._all()]) {
      if (!b.id || typeof b.sub !== 'string') continue;
      const n = newest.get(b.sub);
      if (!n || (b.since ?? 0) >= (n.b.since ?? 0)) newest.set(b.sub, { ws, b });
    }
    for (const [acct, r] of hand) { const n = newest.get(acct); if (n) this._send(n.ws, JSON.stringify({ t: 'raid', k: 'rc', r })); }
  }
  /** AUDIT RAID R2: an account's kept raid receipts to its hello - the good ones handed, the rest let go. */
  async _raidReceiptsTo(ws, sub, now) {
    if (this._noRaidRcpt.has(sub)) return;   // SCALE2b: asked before and none held - no write since says otherwise
    const k = raidReceiptKeyOf(sub);
    const v = await this.state.storage.get(k);
    if (v === undefined) { this._noRaidRcpt.set(sub, 1); return; }
    const kept = raidRcLive(v, now);
    if (!kept.length) { await this.state.storage.delete(k); return; }
    if (!Array.isArray(v) || kept.length !== v.length) await this.state.storage.put(k, kept);
    for (const e of kept) this._send(ws, JSON.stringify({ t: 'raid', k: 'rc', r: e.r }));
  }

  // ───────────────────────────── STAR3: A FALLEN STAR ─────────────────────────────
  /** A WORD AT A FALLEN STAR (`{t:'star', n, k, px, py, lv, s, o, kn, wc, hb, mf}`, net/wire.js validStarIn - bible/11-
   *  Multiplayer/Starfall.md section 5): on its own bucket, deeper than the client's (the same strikes), in a cell alone
   *  (anywhere else junk: a correct client says none there), credited to the VERIFIED account. */
  async _starFrame(ws, a, m) {
    const now = Date.now();
    if (!this._spend(ws, now, starRelayGate, 'starBucket', 'starDrops', 'too many star frames')) return;
    if (!isCellRoom(a.key)) { this._junk(ws); return; }
    try { await this._starWord(ws, a, m, now); } catch (e) { console.warn('[star] word failed', e?.message ?? e); }
  }
  /**
   * THE WORD, JUDGED AND FOLDED (the raid's law and the rite's): heard in the star's own cell alone and never in a layer,
   * inside the star's life (net/starfall/starfallLaw.js starHeard - its landing to its deadline and the grace, inside the
   * window). A star is its whole tuple - the night, the star, its pixel - and its ledger is made only before its deadline
   * (starMayMake) by a word whose socket's pose stands at the star the law places in that pixel (starNear), in a place the
   * cell can give. A word from off the star is heard (its speaker stands there no longer) and counts nothing. A ledger that
   * moved is written and said to the cell, else the speaker is answered with it - the speaker's copy with its own
   * account's credited blows (`hm`); the master's fall holds it (`_starHold`), and a word on a star held from an account
   * that earned it is answered with its receipt again (a reconnect that missed it).
   */
  async _starWord(ws, a, m, now) {
    if (worldRoom(m.px, m.py) !== a.key) { this._junk(ws); return; }
    // NO STAR IN A LAYER (AUDIT SCALE II R3-3, the raid's and the rite's law): a layer is another object for the same cell,
    // and a ledger of its own would be a second fight for one star - its own waves, its own hold, its own receipts. An
    // honest client says its word there, so nobody is struck
    if (a.ly) return;
    if (!starHeard(m.n, m.k, now)) return;   // before its landing, past its deadline and the grace, or outside the window: nothing read, kept or said
    const id = starLedgerId(m);
    const here = !!a.pose && starNear(m.n, m.k, m.px, m.py, a.pose.x, a.pose.z);
    const acct = typeof a.sub === 'string' && a.sub ? a.sub : `id:${a.id}`;
    let led = await this._starLedgerOf(id);
    const fresh = !led;
    if (!led) {
      if (!here) return;   // made only at the star
      if (!starMayMake(m.n, m.k, now)) return;   // never past its deadline: the grace hears a ledger's last words, it makes none
      if (!(await this._starMakeRoom(now, acct))) return;   // no place for it now
      led = newStarLedger(m, now, acct);
      this._stars.set(id, led);
    }
    const moved = foldStarWord(led, acct, a.name ?? '', m, here, now);
    if (led.p === P_HELD && !led.said) { await this._starHold(led, now); return; }   // held: said once its receipts are minted - a word that lands mid-mint is said nothing until then
    if (fresh || moved || (!starOver(led) && now - (this._starSavedAt.get(id) ?? 0) >= STAR_SAVE_MS)) await this._starSave(led, now);
    const mine = starLedgerState(led, acct);   // the speaker's: its own account's credited blows ride it (`hm`)
    if (moved) this._starFan(starLedgerState(led), ws, mine);
    else this._send(ws, JSON.stringify({ t: 'star', ...mine }));
    const r = led.said && typeof a.sub === 'string' ? led.rc[a.sub] : null;
    if (r) this._send(ws, JSON.stringify({ t: 'star', k: 'rc', r }));
  }
  /** A star's ledger in this cell by its identity (starLedgerId), or null - the instance's copy, else storage's (read once,
   *  kept then). */
  async _starLedgerOf(id) {
    if (this._stars.has(id)) return this._stars.get(id);
    const v = await this.state.storage.get(starLedgerKey(id));
    const led = starLedgerSane(v) && starLedgerId(v) === id ? v : null;
    this._starKeep(id, led);
    return led;
  }
  /** A ledger read, kept in hand - or not, once settled (starfallLaw.js starSettled): nothing moves it again, and a cell
   *  may keep hundreds over (starPlaceFor), which would push its live stars' copies out of `_stars`. */
  _starKeep(id, led) { if (!led || !starSettled(led)) this._stars.set(id, led); }
  /** A listed ledger (`k` its key, `v` what storage holds) as the instance holds it - its copy, else the one read, kept
   *  then - or null for a value that is no ledger of the law's under its own key. */
  _starListed(k, v) {
    if (!starLedgerSane(v) || starLedgerKey(starLedgerId(v)) !== k) return null;
    const id = starLedgerId(v);
    const had = this._stars.get(id);
    if (had) return had;
    this._starKeep(id, v);
    return v;
  }
  /** When a ledger is forgotten, on the relay's clock: its deadline, and STAR_KEEP_MS past it. */
  _starEndsAt(led) { return starTimes(led.n, led.k).endAt + STAR_KEEP_MS; }
  /** The soonest thing a ledger owes: its hold minted or its hub told (again), its loss at its deadline and the grace
   *  (starLostAt), else its forgetting. */
  _starDueOf(led, now) {
    if (led.p === P_HELD && !led.told) return now + STAR_TELL_RETRY_MS;
    return starOver(led) ? this._starEndsAt(led) : starLostAt(led.n, led.k);
  }
  /** This cell's alarm, armed for `at` unless it already is, sooner. */
  async _starArm(at) {
    try { const had = await this.state.storage.getAlarm(); if (had == null || had > at) await this.state.storage.setAlarm(at); }
    catch (e) { console.warn('[star] arm', e?.message ?? e); }
  }
  /** A ledger to storage, and the alarm armed for the soonest thing it owes. */
  async _starSave(led, now) {
    const id = starLedgerId(led);
    this._starSavedAt.set(id, now);
    await this.state.storage.put(starLedgerKey(id), led);
    await this._starArm(this._starDueOf(led, now));
  }
  /** A NEW STAR'S PLACE in this cell, for a ledger `by` would make - answers whether there is one. Every ledger past its end
   *  is forgotten first; then the law's place (net/starfall/starfallLaw.js starPlaceFor): a star over costs none and is
   *  kept to its end, so its receipts are never minted twice nor its fight run again (the raid's AUDIT RAID R3); a live
   *  one costs one, and gives it up only when nobody stands at it. With none, the new star waits. */
  async _starMakeRoom(now, by) {
    const m = await this.state.storage.list({ prefix: STAR_LEDGER_PREFIX });
    const kept = [];
    for (const [k, v] of m) {
      const led = this._starListed(k, v);
      if (led && now < this._starEndsAt(led)) { kept.push(led); continue; }
      await this.state.storage.delete(k);
      if (led) this._stars.delete(starLedgerId(led));
    }
    const { ok, out } = starPlaceFor(kept, by, now);
    if (out) { const id = starLedgerId(out); await this.state.storage.delete(starLedgerKey(id)); this._stars.set(id, null); }
    return ok;
  }
  /** A star word to everyone hello'd in the cell - `mine` in its place to the socket `from` that spoke. */
  _starFan(o, from = null, mine = null) {
    const s = JSON.stringify({ t: 'star', ...o }), own = mine ? JSON.stringify({ t: 'star', ...mine }) : s;
    for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, ws === from ? own : s);
  }
  /** Each account's newest hello'd socket here, of the accounts `rc` holds a receipt for (AUDIT WBX S4: one tab an
   *  account). */
  _starNewest(rc) {
    const newest = new Map();
    for (const [ws, b] of [...this._all()]) {
      if (!b.id || typeof b.sub !== 'string' || !Object.hasOwn(rc, b.sub)) continue;
      const had = newest.get(b.sub);
      if (!had || (b.since ?? 0) >= (had.b.since ?? 0)) newest.set(b.sub, { ws, b });
    }
    return newest;
  }
  /** THE HOLD, SAID ONCE - the raid's cleanse's law (AUDIT WB A10): each earner's receipt minted (net/starfall/
   *  starReceipt.js - the seed the relay's own, the level its last word at the star said) and the ledger kept WITH them
   *  before a word of it is said; then the ledger and `hd` to everyone in the cell, each earner's receipt to its account's
   *  newest socket here, and the hub told until it answers - the receipts ride that word, so the hub hands each to its
   *  account wherever it stands. A socket no account vouched for is on the count and never on the record. */
  async _starHold(led, now) {
    const id = starLedgerId(led);
    if (this._starHolding.has(id)) return;   // being minted: the alarm's sweep met it mid-mint (each caller asks `said` first)
    this._starHolding.add(id);
    try {
      const earned = starEarned(led);
      const key = await this._receiptKeyOf();
      const nowS = Math.floor(now / 1000);
      led.rc = {};
      for (const [acct, r] of earned) {
        if (acct.startsWith('id:')) continue;
        try { led.rc[acct] = await mintStarReceipt({ n: led.n, k: led.k, s: acct, c: rand32(), l: r.lv }, key, { subtle: crypto.subtle, nowS }); }
        catch (e) { console.warn('[star] receipt refused', e?.message ?? e); }
      }
      led.top = starTop(earned); led.hn = earned.length; led.said = true;
      await this._starSave(led, now);
    } finally { this._starHolding.delete(id); }
    this._starFan(starLedgerState(led));
    this._starFan(starHeldWord(led));
    for (const [sub, { ws }] of this._starNewest(led.rc)) this._send(ws, JSON.stringify({ t: 'star', k: 'rc', r: led.rc[sub] }));
    await this._starTellHubOnce(led, now);
  }
  /** The hub told of a hold, and it kept - once it has answered (a beat of the alarm tells it again). */
  async _starTellHubOnce(led, now) {
    if (led.told || !led.said) return;
    if (!(await this._starTellHub({ ...starHeldWord(led), rc: led.rc }))) { await this._starArm(now + STAR_TELL_RETRY_MS); return; }
    led.told = true;
    await this._starSave(led, now);
  }
  /** The hub's door (the raid's): a relay built without the binding keeps the cell's own word. */
  async _starTellHub(body) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return true;
    try { const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${STAR_INTERNAL_HELD}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) })); return !!res?.ok; }
    catch (e) { console.warn('[star] hub', e?.message ?? e); return false; }
  }
  /** A CELL'S ALARM for its stars: every ledger past its end forgotten; one past its deadline unheld lost at dawn, and said
   *  (nobody stood there to say a word that would step it); a hold whose mint never finished finished, and one its hub has
   *  not heard told again. Answers when the next is owed - 0 when this room keeps no star (the alarm is somebody else's). */
  async _starSweep(now) {
    const m = await this.state.storage.list({ prefix: STAR_LEDGER_PREFIX });
    if (!m.size) return 0;
    let next = Infinity;
    for (const [k, v] of m) {
      const led = this._starListed(k, v);
      if (!led || now >= this._starEndsAt(led)) { await this.state.storage.delete(k); if (led) this._stars.delete(starLedgerId(led)); continue; }
      if (stepStar(led, now)) { await this._starSave(led, now); this._starFan(starLedgerState(led)); }
      if (led.p === P_HELD && !led.said) await this._starHold(led, now);
      else await this._starTellHubOnce(led, now);
      next = Math.min(next, this._starDueOf(led, now));
    }
    if (next === Infinity) return 0;
    await this._starArm(next);
    return next;
  }
  /** THE HUB'S held stars of the nights still standing - `[n, s, px, py, at]` - read once, a night's let go once its last
   *  star is gone (net/starfall/starfallLaw.js starNightGoneAt). */
  async _starHeldOf(now) {
    if (this._starHeld === undefined) { const v = await this.state.storage.get(STAR_HELD_KEY); if (this._starHeld === undefined) this._starHeld = Array.isArray(v) ? v : []; }   // a read never undoes a hold kept while it was out
    this._starHeld = this._starHeld.filter((e) => Array.isArray(e) && e.length === 5 && starOk(e[0], e[1]) && now < starNightGoneAt(e[0]));
    return this._starHeld;
  }
  /** THE HUB'S HALF: a star held, from its cell. Its earners' receipts are kept and handed first (a word told again keeps
   *  and hands none twice); then, while its night stands, everyone online hears it once and it is kept for a hello - the
   *  list written BEFORE the hub's copy moves (AUDIT RAID R7). Projected through the wire's own law, as a client would. */
  async _starHeldInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { /* refused below */ }
    const hd = validStarOut({ k: 'hd', n: body?.n, s: body?.s, px: body?.px, py: body?.py, at: body?.at, top: body?.top, c: body?.c });
    if (!hd) return json({ ok: false }, 400);
    const now = Date.now();
    await this._starReceiptsKeep(hd, body?.rc, now);
    if (!(now < starNightGoneAt(hd.n))) return json({ ok: true });   // told after its night: its receipts kept, and nothing to say
    const list = await this._starHeldOf(now);
    if (list.some((e) => e[0] === hd.n && e[1] === hd.s && e[2] === hd.px && e[3] === hd.py)) return json({ ok: true });   // told again: the cell missed the answer, not news
    const next = [...list, [hd.n, hd.s, hd.px, hd.py, hd.at]];
    while (next.length > STAR_HELD_MAX) next.shift();
    await this.state.storage.put(STAR_HELD_KEY, next);
    this._starHeld = next;
    const said = JSON.stringify({ t: 'star', ...hd });
    for (const [ws, b] of [...this._all()]) if (b.id) this._send(ws, said);
    return json({ ok: true });
  }
  /** A HOLD'S RECEIPTS, KEPT BY THE HUB for their accounts (the raid's AUDIT RAID R2): each checked for its own account and
   *  star (the relay's own mint, read back - an unsigned one no service would take), kept under its account's key (the
   *  newest STAR_RC_KEEP, each for STAR_RC_KEEP_MS) and handed at once to its account's newest socket here. One kept
   *  already is neither kept nor handed again. */
  async _starReceiptsKeep(hd, rc, now) {
    if (!rc || typeof rc !== 'object' || Array.isArray(rc)) return;
    const fresh = [];
    for (const [acct, r] of Object.entries(rc).slice(0, STAR_COUNT_MAX)) {
      const c = validStarOut({ k: 'rc', r }) ? readStarReceipt(r) : null;
      if (c && c.signed && c.s === acct && c.night === hd.n && c.star === hd.s) fresh.push([acct, r]);
    }
    if (!fresh.length) return;
    const had = new Map();
    for (let i = 0; i < fresh.length; i += 128) for (const [k, v] of await this.state.storage.get(fresh.slice(i, i + 128).map(([acct]) => starReceiptKeyOf(acct)))) had.set(k, v);
    const puts = [], hand = {};
    for (const [acct, r] of fresh) {
      const k = starReceiptKeyOf(acct);
      const kept = raidRcLive(had.get(k), now);   // the raid's keep, its own shape: [{ r, until }]
      if (kept.some((e) => e.r === r)) continue;
      puts.push([k, [...kept, { r, until: now + STAR_RC_KEEP_MS }].slice(-STAR_RC_KEEP)]);
      hand[acct] = r;
    }
    if (puts.length) this._noStarRcpt.clear();   // receipts are being written - nobody's 'none' stands
    for (let i = 0; i < puts.length; i += 128) await this.state.storage.put(Object.fromEntries(puts.slice(i, i + 128)));
    for (const [sub, { ws }] of this._starNewest(hand)) this._send(ws, JSON.stringify({ t: 'star', k: 'rc', r: hand[sub] }));
  }
  /** An account's kept star receipts to its hello - the good ones handed, the rest let go. */
  async _starReceiptsTo(ws, sub, now) {
    if (this._noStarRcpt.has(sub)) return;   // asked before and none held - no write since says otherwise
    const k = starReceiptKeyOf(sub);
    const v = await this.state.storage.get(k);
    if (v === undefined) { this._noStarRcpt.set(sub, 1); return; }
    const kept = raidRcLive(v, now);
    if (!kept.length) { await this.state.storage.delete(k); return; }
    if (!Array.isArray(v) || kept.length !== v.length) await this.state.storage.put(k, kept);
    for (const e of kept) this._send(ws, JSON.stringify({ t: 'star', k: 'rc', r: e.r }));
  }

  // ───────────────────────────── WILD1: THE ROOM'S REMAINS ─────────────────────────────
  /** The room's remains by id (net/wild/wildLaw.js) - read from storage ONCE an instance life (the read's promise shared, the
   *  overworld ledger's law), the dead ones let go as they are read. */
  _wildRemains(now) {
    if (!this._wildLoad) {
      this._wildLoad = (async () => {
        const map = new Map();
        const listed = await this.state.storage.list({ prefix: WILD_REMAINS_PREFIX });
        const dead = [];
        for (const [k, v] of listed) {
          const rec = remainsOf(v);
          if (rec && remainsLive(rec, now) && (!remainsEmpty(rec) || remainsSpent(rec))) map.set(rec.r, rec); else dead.push(k);   // INT9 (AUDIT): a tombstone kept while it lives
        }
        if (dead.length) await this.state.storage.delete(dead);
        return map;
      })();
      this._wildLoad.catch(() => { this._wildLoad = null; });
    }
    return this._wildLoad;
  }
  /** A word to everyone hello'd in this room. */
  _wildFan(word) {
    const out = typeof word === 'string' ? word : JSON.stringify(word);
    for (const [other, b] of [...this._all()]) if (b.id) this._send(other, out);
  }
  /** A remains gone - its key let go, the room told. */
  async _wildDrop(map, r) {
    const spent = remainsSpent(map.get(r));   // INT9 (AUDIT): a tombstone's going was said when it emptied
    if (!spent) this._wdunTellGone(map.get(r)?.os);   // PVPDUNGEONS: the hub's crows over the hall go with the remains
    map.delete(r);
    await this.state.storage.delete(wildRemainsKey(r));
    if (!spent) this._wildFan({ t: 'wild', k: 'gone', r });
  }
  /** The live remains to a socket that just said hello. */
  async _wildHello(ws, now) {
    const map = await this._wildRemains(now);
    for (const rec of [...map.values()]) {
      if (!remainsLive(rec, now)) { await this._wildDrop(map, rec.r); continue; }
      if (remainsSpent(rec)) continue;   // INT9 (AUDIT): a tombstone is said to nobody
      for (const w of remainsWords(rec, now)) if (!this._send(ws, JSON.stringify(w))) return;
    }
  }
  /**
   * A ROOM WORD ON ITS REMAINS. A `fall` makes or fills the sender's own remains (a full room lets its oldest go) and
   * the kept records are said to the room; a `take` is judged - the record or the part of its stack goes to its taker
   * alone (`got`), the room hears what left (`rm`), and an emptied remains goes; a take of nothing is answered `no` to
   * its taker alone (a race lost, a remains gone).
   */
  async _wildWord(ws, a, d, now) {
    const map = await this._wildRemains(now);
    for (const rec of [...map.values()]) if (!remainsLive(rec, now)) await this._wildDrop(map, rec.r);
    if (d.k === 'fall') {
      // INT9: THE ACCOUNT SERVICE'S ORDER on every chunk - its remains' id this one's, signed by the service's key; the
      // remains' owner is the order's account (the fallen), whoever carries it (the fallen, or its killer after the grace)
      const o = this._verifyKey ? await verifyOrder(d.o, this._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'remains' }) : { ok: false };
      if (!o.ok || o.claims.wr !== d.r) { this._junk(ws); return; }
      const c = o.claims;
      // INT9 (AUDIT): THE ORDER NAMES ITS ROOM, and no other keeps it - one fall's order was laid in two
      if (c.wm !== a.key) { this._junk(ws); return; }
      let rec = map.get(d.r);
      // INT9: vouched for already - a second carrier's deposit (the fallen's tab and its killer's seizure, one fall) is
      // nothing, and so is one on a TOMBSTONE (AUDIT INT9: an emptied remains was let go, and its order laid it again)
      if (rec?.ok) return;
      // INT9 (AUDIT): another carrier's, half laid: nothing, quietly (it was junk - the fallen's own tab and its killer
      // carry one order) - unless that carrier has stalled, when this one lays it afresh
      if (rec && rec.oid !== a.id && !remainsTakeover(rec, a.id, now)) return;
      if (!rec) {
        const old = remainsEvict(map, now);
        if (old === '') return;   // INT9 (AUDIT): a room full of young tombstones lays nothing
        if (old) await this._wildDrop(map, old);
        rec = newRemains({ r: d.r, os: c.s, oid: a.id, nm: a.sub === c.s ? (a.name ?? '') : '', p: d.p, now, gi: c.wg ?? null, wh: c.wh, wn: c.wn, wk: c.wk ?? null, wi: c.wi ?? -1, we: c.we === 1 });   // MAC (2026-10-14): `we` - the killer's piece the service's, in escrow   // PVPDUNGEONS: the fallen's guild, so no guildmate takes from it - INT9 (AUDIT): the order's word, whoever carries it (the killer's own guild was written)
        map.set(rec.r, rec);
      }
      if (rec.wh !== c.wh) { this._junk(ws); return; }
      const kept = foldFall(rec, { oid: a.id, items: d.items, last: d.last }, now);
      if (!kept) { this._junk(ws); return; }
      if (!rec.open) {
        // INT9: the last chunk - its records the order's, digest for digest, or the room keeps none of it
        rec.ok = rec.items.length === rec.wn && (await remainsDigest(rec.items, { subtle: crypto.subtle })) === rec.wh;
        if (!rec.ok) { map.delete(rec.r); await this.state.storage.delete(wildRemainsKey(rec.r)); this._junk(ws); return; }
      }
      await this.state.storage.put(wildRemainsKey(rec.r), rec);
      if (rec.ok) for (const w of remainsWords(rec, now)) this._wildFan(w);   // INT9: said once it is vouched for, whole
      return;
    }
    const rec = map.get(d.r);
    // MAC'S DECISION (2026-10-14, the two-phase handoff): THE KILLER'S COLLECT of the piece the service holds in escrow
    // (net/wild/wildLaw.js collectAsk) - no record handed over: the room signs the collect once (net/wild/wildReceipt.js `g1`), the
    // record let go from the remains, and says the same collect to its killer each time it asks; its tab carries it to
    // the service, which commits the piece to the killer's record once (server-account/src/wild.js wildCollect)
    const ask = rec ? collectAsk(rec, d.i, a.sub ?? null) : null;
    if (ask) {
      if (ask === 'mint') {
        const cr = await this._wildCollectMint(rec, a, now);
        if (!cr) { this._send(ws, JSON.stringify({ t: 'wild', k: 'no', r: d.r, i: d.i })); return; }
        const n = Math.max(1, Number.isInteger(rec.items[d.i]?.stackCount) ? rec.items[d.i].stackCount : 1);
        rec.wc = cr; rec.items[d.i] = null;
        if (remainsEmpty(rec)) this._wdunTellGone(rec.os);
        await this.state.storage.put(wildRemainsKey(rec.r), rec);
        this._wildFan({ t: 'wild', k: 'rm', r: d.r, i: d.i, n });
      }
      this._send(ws, JSON.stringify({ t: 'wild', k: 'cr', r: d.r, i: d.i, cr: rec.wc }));
      if (ask === 'mint' && remainsSpent(rec)) this._wildFan({ t: 'wild', k: 'gone', r: d.r });
      return;
    }
    // PVPDUNGEONS (the owner: "Party/guildmembers cant pick it up"): a fallen's remains are theirs and their foes', never
    // their friends' - a guildmate is read off the sockets' own verified guilds, a party member asked of the hub. PVP-LOOT
    // (FIELD BUGS 2026-10-14): the DROP's law - the record the order names (the killer's worn piece, net/wild/wildLaw.js
    // remainsNamedFor) is its account's by the service's word, and takeFrom judges it; the friend law read over it too, a
    // guildmate's kill left the piece the service had taken off the fallen in the remains for nobody
    if (rec && !remainsNamedFor(rec, d.i) && rec.os && a.sub !== rec.os && (sameGuild(rec.gi, a.gi) || (a.sub && await this._wdunKinOf(a.sub, rec.os, now)))) {
      this._send(ws, JSON.stringify({ t: 'wild', k: 'no', r: d.r, i: d.i }));
      return;
    }
    const got = rec ? takeFrom(rec, d.i, d.n, a.sub ?? null) : null;   // INT9: a vouched-for remains alone, the killer's piece the killer's
    if (!got) { this._send(ws, JSON.stringify({ t: 'wild', k: 'no', r: d.r, i: d.i })); return; }
    // INT9 (AUDIT): an emptied remains is kept, said to nobody - a TOMBSTONE while it lives, so its fall's order lays
    // nothing again (it was let go here, and the order laid the same records twice)
    if (remainsEmpty(rec)) this._wdunTellGone(rec.os);
    await this.state.storage.put(wildRemainsKey(rec.r), rec);
    this._send(ws, JSON.stringify({ t: 'wild', k: 'got', r: d.r, i: d.i, it: got.it }));
    this._wildFan({ t: 'wild', k: 'rm', r: d.r, i: d.i, n: got.n });
    if (remainsSpent(rec)) this._wildFan({ t: 'wild', k: 'gone', r: d.r });
  }

  /** MAC (2026-10-14): A KILLER'S COLLECT SIGNED (net/wild/wildReceipt.js `g1`) - for the realm character its socket plays (the
   *  token's `ci`, the record the service commits the piece to), with the key the falls are signed with. Null with none. */
  async _wildCollectMint(rec, a, now) {
    if (!a.sub || typeof a.ci !== 'string' || !a.ci) return null;
    try { return await mintWildCollect({ r: rec.r, k: a.sub, c: a.ci }, await this._receiptKeyOf(), { subtle: globalThis.crypto.subtle, nowS: Math.floor(now / 1000) }); } catch (e) { console.warn('[wild] collect failed', e?.message ?? e); return null; }
  }

  // ───────────────────────────── INT9: THE OPEN ZONE REFEREED (net/wild/wildRef.js) ─────────────────────────────
  /** The room's zone - its fighters in its memory alone (wildRef.js), its falls waiting on a pick in its storage too (AUDIT
   *  INT9: a restarted object signed them never), read back once an instance life. */
  async _wildSt() {
    const st = (this._wildRef ??= newWildRef());
    if (!this._wildFallsRead) {
      this._wildFallsRead = true;
      try {
        for (const [, v] of await this.state.storage.list({ prefix: WILD_FALL_PREFIX })) { const f = wildFallOf(v); if (f && !st.falls.has(f.r)) st.falls.set(f.r, f); }
        for (const [, v] of await this.state.storage.list({ prefix: SEA_WRECK_PREFIX })) { const w = seaWreckOf(v); if (w) (st.wrecks ??= new Map()).set(w.r, w); }   // SHIP-PVP: a wreck awaiting its boarding
      } catch (e) { this._wildFallsRead = false; console.warn('[wild] falls read failed', e?.message ?? e); }
    }
    return st;
  }
  /** A socket's word that it stands in the zone or has left it - and a fall signed while it was away, said again. A
   *  fighter is a realm character in play (AUDIT INT9: one with none fought and dropped nothing - its fall's receipt named
   *  no record); standing in the zone again, it takes the vitality it carries from its last fight in another room. */
  async _wildZoneWord(a, z, now) {
    if (!a.sub || (z === 1 && !a.ci)) return;
    const st = await this._wildSt();
    const was = st.fighters.get(a.sub);
    const carry = z === 1 && (!was || !was.zone) ? await this._wildCarryAsk(a.sub) : null;
    const x = wildZone(st, a.sub, { id: a.id, lv: a.lv, ci: a.ci ?? '', carry }, z === 1, a.pose, now);
    if (x && carry?.sea) x.seaCarry = carry.sea;   // AUDIT SEA VENTURES F1/A1: her ship's bar too, for her next helm word (seaRef.js seaHelm)
    const owed = await this._wildOwedOf(a.sub, now), sk = this._siegeSocketOf(a.sub);
    if (owed && sk) { for (const w of owed) this._send(sk[0], JSON.stringify(w)); this._wildOwed?.delete(a.sub); this._wildOwedKeep(a.sub); }
  }
  /** A STRIKE OR A SPELL in the zone: judged (wildRef.js wildBlow - both said they stand in it, never kin: the hub's party
   *  and its truce, nor a duel's two), the vitality left said to both and kept at the hub, a fall said to the room. */
  async _wildBlow(a, d, now) {
    if (!a.sub) return;
    const st = await this._wildSt();
    const target = this._idFirst(d.to);   // SCALE5b: by the id index
    const tb = target?.[1];
    const fa = st.fighters.get(a.sub), ft = tb?.sub ? st.fighters.get(tb.sub) : null;
    // INT9 (AUDIT): what the referee refuses anyway is refused before the hub is asked (a blow a frame asked it)
    if (!fa || !ft || !fa.zone || !ft.zone || fa.down || ft.down) return;
    const duel = this._duelRef ? duelBoutOf(this._duelRef, a.sub) : null;
    // MAC'S DECISION (2026-10-14, "Guildmates are friends"): KIN is net/wild/wildRef.js wildKin - a duel's two, and one guild
    // (the two sockets' verified guilds) read here; the party and its truce asked of the hub only when neither is
    const duelKin = !!duel && (duel.a.sub === tb.sub || duel.b.sub === tb.sub);
    const kin = wildKin({ duel: duelKin, guilds: [a.gi, tb.gi] }) || wildKin({ party: await this._wdunKinOf(a.sub, tb.sub, now) });
    let look = null;
    if (d.k === 'strike') {
      look = this._looks.get(a.id) ?? null;
      if (!look) { look = (await this.state.storage.get(lookKey(a.id))) ?? null; if (look) this._looks.set(a.id, look); }
    }
    const r = d.k === 'spell' ? SIEGE_HIT.Spell : d.by === 'arrow' ? SIEGE_HIT.Shaft : SIEGE_HIT.Melee;
    const held = d.k === 'strike' ? siegeHeld(look, d.w ? d.w.t : -1, d.w ? d.w.m : 0) : null;
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const rid = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    const res = wildBlow(st, a.sub, tb.sub, { d: d.d, r, held, wa: a.wa ?? null, kin, rid, room: a.key }, now);   // SEA-BOUNTY: the room it fell in
    if (res.evicted) await this._wildSign(res.evicted, now);   // INT9 (AUDIT): a full room's oldest fall, signed without its pick - never forgotten
    if (!res.ok || !res.dealt) return;
    const word = JSON.stringify({ t: 'wref', k: 'hp', by: a.id, to: tb.id, d: res.dealt, r, h: wildVitals(st, a.sub, tb.sub) });
    this._send(target[0], word);
    const mine = this._siegeSocketOf(a.sub);
    if (mine) this._send(mine[0], word);
    this._wildCarryPut(tb.sub, this._zoneCarry(st, tb.sub, now));   // INT9 (AUDIT): the bar it carries into the next room
    if (!res.fell) return;
    try { await this.state.storage.put(`${WILD_FALL_PREFIX}${rid}`, res.fall); } catch (e) { console.warn('[wild] fall kept failed', e?.message ?? e); }
    this._wildFan({ t: 'wref', k: 'fell', id: tb.id, by: a.id, r: rid });
    // INT9 (AUDIT): a building's or a dungeon's room searches no body (the worn offer is the open country's) - its fall is
    // signed at once, never a minute later with the fallen gone from it
    if (!isCellRoom(a.key)) { const f = wildSignNow(st, rid); if (f) await this._wildSign(f, now); }
  }
  /** THE KILLER'S PICK of a fall of its own (`w`, and `t`/`m` what the offer showed there): the fall signed with it. */
  async _wildPickWord(a, d, now) {
    if (!a.sub) return;
    const st = await this._wildSt();
    const fall = wildPick(st, a.sub, d.r, d.w, now, Number.isInteger(d.t) ? [d.t, d.m] : null);
    if (fall) await this._wildSign(fall, now);
  }
  /** The zone's beat on the frames the room takes (wildRef.js wildStep): a fall whose killer never picked, signed
   *  without a piece. */
  async _wildBeat(now) {
    const st = await this._wildSt();
    for (const w of seaStep(st, now)) await this._seaSign(w, now);   // SHIP-PVP: a wreck its killer never boarded, signed unboarded
    if (!st.falls.size) return;
    for (const fall of wildStep(st, now)) await this._wildSign(fall, now);
  }
  /** A FALL SIGNED (net/wild/wildReceipt.js `f1`) and handed to its fallen and its killer - kept for one of them that is away
   *  until its next word on the zone. */
  async _wildSign(fall, now) {
    let rc = null;
    try { rc = await mintWildReceipt({ f: fall.fallen, c: fall.ci, k: fall.killer, r: fall.r, w: fall.w, wt: fall.wt, m: fall.m, kc: fall.kc }, await this._receiptKeyOf(), { subtle: globalThis.crypto.subtle, nowS: Math.floor(now / 1000) }); } catch (e) { console.warn('[wild] receipt failed', e?.message ?? e); }
    wildSigned(this._wildRef, fall.r);
    try { await this.state.storage.delete(`${WILD_FALL_PREFIX}${fall.r}`); } catch { /* read back and signed again: the service takes a fall once */ }
    if (!rc) return;
    this._wildHand([fall.fallen, fall.killer], { t: 'wref', k: 'rc', r: fall.r, rc });
  }
  /** A signed word handed to each account named - kept for one that is away until its next word on the zone. */
  _wildHand(subs, word) {
    for (const sub of subs) {
      const sk = this._siegeSocketOf(sub);
      if (sk) { this._send(sk[0], JSON.stringify(word)); continue; }
      this._wildOwed ??= new Map();
      if (this._wildOwed.size >= 256) this._wildOwed.delete(this._wildOwed.keys().next().value);
      this._wildOwed.set(sub, [...(this._wildOwed.get(sub) ?? []).slice(-3), word]);
      this._wildOwedKeep(sub);   // AUDIT SEA VENTURES A8: and in storage - a woken object kept nothing
    }
  }
  /** AUDIT SEA VENTURES A8: an account's owed words kept in the room's storage as its memory holds them (none: forgotten),
   *  stamped - unawaited, as a carry's put is. */
  _wildOwedKeep(sub) {
    const words = this._wildOwed?.get(sub) ?? [], key = `${WILD_OWED_PREFIX}${sub}`;
    const p = words.length ? this.state.storage.put(key, { at: Date.now(), words }) : this.state.storage.delete(key);
    Promise.resolve(p).catch((e) => console.warn('[wild] owed kept', e?.message ?? e));
  }
  /** The words owed an account back in the zone - this object's memory, else (once an instance life) its storage while a
   *  receipt in them could still live - or null. */
  async _wildOwedOf(sub, now) {
    const had = this._wildOwed?.get(sub);
    if (had) return had;
    this._wildOwedRead ??= new Set();
    if (this._wildOwedRead.has(sub)) return null;
    if (this._wildOwedRead.size >= 4096) this._wildOwedRead.clear();
    this._wildOwedRead.add(sub);
    let v = null;
    try { v = await this.state.storage.get(`${WILD_OWED_PREFIX}${sub}`); } catch { return null; }
    if (!v) return null;
    if (!Array.isArray(v.words) || !(now - v.at < WILD_OWED_KEEP_MS)) { this._wildOwedKeep(sub); return null; }
    return v.words.slice(-4);
  }

  // ───────────────────────────── SHIP-PVP: THE OPEN SEA'S GUNS REFEREED (net/sea/seaRef.js) ─────────────────────────────
  /** A remains' or a wreck's id: twelve hex of the relay's own. */
  _wildRid() {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  /** A CAPTAIN'S WORD AT THE OPEN SEA'S GUNS (bible/03-World/Eltheric-Ocean.md SHIP-PVP): her helm (seaHelm - kept only while
   *  she stands in the zone), her shot on another captain's ship (seaShot - both in the zone at their helms, neither down,
   *  never kin: wildKin's, as a blow's; within a gun's reach; on her own purse), her boarding of her wreck (seaBoard - near
   *  where her captain was believed or where she lay; her captain's socket asked nothing). What a shot landed is said to
   *  both (`hull`), a wreck to the room (`wreck`) and signed once boarded or its time is out. */
  async _seaWord(a, d, now) {
    if (!a.sub) return;
    const st = await this._wildSt();
    if (d.k === 'helm') {
      const res = seaHelm(st, a.sub, { id: a.id, ci: a.ci ?? '', hl: d.hl, t: d.t / 100, u: d.u, h: d.h / 1000 }, now, { rid: this._wildRid(), room: a.key });
      if (res) await this._seaWrecked(res, now);
      return;
    }
    if (d.k === 'board') { const w = seaBoard(st, a.sub, d.r, now); if (w) await this._seaSign(w, now); return; }   // her wreck's, never her socket's: a captain who leaves leaves it
    if (d.to === a.id) return;
    const target = this._idFirst(d.to);
    const tb = target?.[1];
    if (!tb?.sub) return;
    const fa = st.fighters.get(a.sub), ft = st.fighters.get(tb.sub);
    // what the referee refuses anyway is refused before the hub is asked (a shot a frame asked it)
    if (!fa || !ft || !fa.zone || !ft.zone || fa.down || ft.down || !st.ships?.has(a.sub) || !st.ships?.has(tb.sub)) return;
    const bout = this._duelRef ? duelBoutOf(this._duelRef, a.sub) : null;
    // KIN, as a blow's (wildKin): a duel's two and one guild read here, the party and its truce asked of the hub only when neither is
    const kin = wildKin({ guilds: [a.gi, tb.gi], duel: !!bout && (bout.a.sub === tb.sub || bout.b.sub === tb.sub) }) || wildKin({ party: await this._wdunKinOf(a.sub, tb.sub, now) });
    const res = seaShot(st, a.sub, tb.sub, { d: d.d, s: d.s, f: d.f === 1, kin, rid: this._wildRid(), room: a.key }, now);
    if (!res.ok || !(res.frac > 0 || res.sail > 0 || res.fire)) return;
    // AUDIT SEA VENTURES A3: what landed rounded DOWN, her bar left rounded UP - a share rounded up was a thousandth of her
    // bar for a one-point word (ten words a second: her game lost three times the purse); the bar left lays the rest
    const word = JSON.stringify({ t: 'wref', k: 'hull', by: a.id, to: tb.id, d: Math.min(1000, Math.floor(res.frac * 1000)), s: Math.min(1000, Math.floor(res.sail * 1000)), f: res.fire ? 1 : 0, h: Math.min(1000, Math.ceil(res.left * 1000)) });
    this._send(target[0], word);
    const mine = this._siegeSocketOf(a.sub);
    if (mine) this._send(mine[0], word);
    if (res.dealt > 0) this._wildCarryPut(tb.sub, this._zoneCarry(st, tb.sub, now));   // F1/A1: her ship's bar into the next room
    if (res.wreck || res.evicted) await this._seaWrecked(res, now);
  }
  /** A SHIP WRECKED (seaRef.js): kept in the room's storage while her killer may board her, the room's alarm armed for when
   *  he no longer may (AUDIT SEA VENTURES A8), and said to the room - and a full room's oldest wreck, put out for it, signed
   *  unboarded. */
  async _seaWrecked({ wreck, evicted }, now) {
    if (evicted) await this._seaSign(evicted, now);
    if (!wreck) return;
    try { await this.state.storage.put(`${SEA_WRECK_PREFIX}${wreck.r}`, wreck); } catch (e) { console.warn('[sea] wreck kept failed', e?.message ?? e); }
    await this._seaArm(wreck.at + SEA_REF.boardMs + 1000);
    this._wildFan({ t: 'wref', k: 'wreck', id: wreck.fallenId, by: wreck.killerId, r: wreck.r });
  }
  /** AUDIT SEA VENTURES A8: the room's alarm no later than `at`. */
  async _seaArm(at) {
    try { const had = await this.state.storage.getAlarm(); if (had == null || had > at) await this.state.storage.setAlarm(at); }
    catch (e) { console.warn('[sea] arm', e?.message ?? e); }
  }
  /** AUDIT SEA VENTURES A8: A ROOM'S ALARM BEATS ITS WRECKS - a room nobody came back to took no frame to beat on, and its
   *  wreck stayed in storage unsigned (her killer's kill at sea never his to carry): each past its boarding signed, the
   *  alarm armed for the next. A room with none in its memory or its storage asks nothing more. */
  async _seaAlarm(now) {
    if (!this._wildRef?.wrecks?.size) {
      let kept = 0;
      try { kept = (await this.state.storage.list({ prefix: SEA_WRECK_PREFIX, limit: 1 })).size; } catch { return; }
      if (!kept) return;
    }
    const st = await this._wildSt();
    for (const w of seaStep(st, now)) await this._seaSign(w, now);
    let next = Infinity;
    for (const w of st.wrecks?.values() ?? []) next = Math.min(next, w.at + SEA_REF.boardMs + 1000);
    if (Number.isFinite(next)) await this._seaArm(next);
  }
  /** A WRECK SIGNED (net/wild/wildReceipt.js `n1`, boarded or not) and handed to its captain and its killer. A ship with no
   *  uid, or a captain or killer with no realm character, is signed never - no prize, and no kill at sea, to carry. */
  async _seaSign(w, now) {
    let rc = null;
    if (w.ci && w.kc && w.u > 0) {
      try { rc = await mintSeaWreck({ f: w.fallen, c: w.ci, k: w.killer, kc: w.kc, r: w.r, u: w.u, b: w.boarded ? 1 : 0, m: w.m }, await this._receiptKeyOf(), { subtle: globalThis.crypto.subtle, nowS: Math.floor(now / 1000) }); } catch (e) { console.warn('[sea] wreck receipt failed', e?.message ?? e); }
    }
    try { await this.state.storage.delete(`${SEA_WRECK_PREFIX}${w.r}`); } catch { /* read back and signed again: the service takes a wreck once */ }
    if (rc) this._wildHand([w.fallen, w.killer], { t: 'wref', k: 'wc', r: w.r, rc });
  }
  /** What a fighter carries into the next room: its bar (wildRef.js wildCarry) and its ship's (seaRef.js seaCarry - AUDIT SEA
   *  VENTURES F1/A1: a cell's line was a whole ship), one word at the hub (its newest wins). */
  _zoneCarry(st, sub, now) {
    const c = wildCarry(st, sub, now);
    return c ? { ...c, sea: seaCarry(st, sub) } : null;
  }
  /** INT9 (AUDIT): A FIGHTER'S BAR, KEPT AT THE HUB (wildRef.js wildCarry) - unawaited, as a remains' going is told. */
  _wildCarryPut(sub, carry) {
    const rooms = this.env?.ROOMS;
    if (!carry || !rooms?.idFromName || !rooms?.get) return;
    const p = rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${WILD_INTERNAL_VIT}`, { method: 'POST', body: JSON.stringify({ sub, put: carry }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    p.catch((e) => console.warn('[wild] vit put', e?.message ?? e));
    try { this.state.waitUntil?.(p); } catch { /* not every runtime */ }
  }
  /** INT9 (AUDIT): the bar a fighter carries, asked of the hub as it stands in this room's zone - null where none (or the
   *  hub is silent: it stands whole, the law before). */
  async _wildCarryAsk(sub) {
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return null;
    try {
      const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${WILD_INTERNAL_VIT}`, { method: 'POST', body: JSON.stringify({ sub }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
      return res?.ok ? wildCarryOf((await res.json())?.carry) : null;
    } catch (e) { console.warn('[wild] vit ask', e?.message ?? e); return null; }
  }
  /** INT9 (AUDIT): the hub's side - a fighter's bar kept (the newest word wins), or answered. In its memory alone: a hub
   *  that restarts forgets the bars, and each fighter stands whole in its next room (the law before). */
  async _wildVitInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const sub = typeof body?.sub === 'string' && body.sub.length > 0 && body.sub.length <= 128 ? body.sub : null;
    if (!sub) return json({ error: 'bad vit' }, 400);
    this._wildVits ??= new Map();
    if (body.put === undefined) return json({ carry: this._wildVits.get(sub) ?? null });
    const c = wildCarryOf(body.put);
    if (!c) return json({ error: 'bad vit' }, 400);
    const had = this._wildVits.get(sub);
    if (!had || had.at <= c.at) {
      this._wildVits.delete(sub);
      if (this._wildVits.size >= 4096) this._wildVits.delete(this._wildVits.keys().next().value);
      this._wildVits.set(sub, c);
    }
    return json({ ok: true });
  }

  // ───────────────────────────── PVPDUNGEONS: THE ZONE'S HALLS (the hub) ─────────────────────────────
  /** The hub's halls record, read once a wake and pruned as it is read. */
  async _wdunRec(now) {
    if (!this._wdun) this._wdun = wdunOf(await this.state.storage.get(WDUN_KEY));
    const before = JSON.stringify(this._wdun.crows), beforeG = JSON.stringify(this._wdun.giants ?? {});
    if (wdunPrune(this._wdun, now)) {
      await this._wdunSave(now, true);
      if (JSON.stringify(this._wdun.crows) !== before) this._wdunFanCrows(now);
      if (JSON.stringify(this._wdun.giants ?? {}) !== beforeG) this._wildFan({ t: 'wdun', k: 'gd', giants: wdunGiants(this._wdun, now) });   // ZONE-GIANTS: up again
    }
    return this._wdun;
  }
  async _wdunSave(now, force = false) {
    if (!force && now - this._wdunSavedAt < WDUN_HERE_MS) return;
    this._wdunSavedAt = now;
    wdunBound(this._wdun);
    await this.state.storage.put(WDUN_KEY, this._wdun);
  }
  _wdunFanCrows(now, who = null) { this._wildFan({ t: 'wdun', k: 'cr', crows: wdunCrows(this._wdun, now), ...(who ? { who } : {}) }); }   // CROW-NEWS: whose death
  /** One account's word on the halls. */
  async _wdunWord(ws, acct, m, now, a = null) {
    const st = await this._wdunRec(now);
    if (m.k === 'hi') { this._send(ws, JSON.stringify(wdunState(st, acct, now))); return; }
    if (m.k === 'gk') {   // ZONE-GIANTS: a zone giant killed - down for everyone, said to everyone online
      if (wdunGiantDie(st, m.g, now)) { await this._wdunSave(now, true); this._wildFan({ t: 'wdun', k: 'gd', giants: wdunGiants(st, now) }); }
      return;
    }
    if (m.k === 'fk') {   // SEA-EVENTS: a treasure fleet's flagship sunk - its sailing scattered for everyone, said to everyone online
      if (a?.gu) return;   // AUDIT SEA VENTURES A7: never a guest's word - a guest sails no realm ship
      if (wdunFleetSunk(st, m.n, now)) { await this._wdunSave(now, true); this._wildFan({ t: 'wdun', k: 'fd', fleets: wdunFleets(st, now) }); }
      return;
    }
    const h = wdunHall(m.h);
    if (!h) return;
    if (m.k === 'in') {
      const r = wdunEnter(st, acct, h, now);
      if (!r.ok) { this._send(ws, JSON.stringify({ t: 'wdun', k: 'no', h, left: r.left })); return; }
      if (r.reset) await this._wdunWipe(h);   // stood empty WDUN_RESET_MS: its foes and its loot as they were never touched
      await this._wdunSave(now, true);
      this._send(ws, JSON.stringify({ t: 'wdun', k: 'ok', h, ep: r.ep }));
      return;
    }
    if (m.k === 'here') { if (wdunHere(st, acct, h, now)) await this._wdunSave(now); return; }
    if (m.k === 'out') {
      const left = wdunLeave(st, acct, h, now);
      await this._wdunSave(now, true);
      this._send(ws, JSON.stringify({ t: 'wdun', k: 'lk', h, left }));
      return;
    }
    if (m.k === 'die') {
      wdunDie(st, acct, h, now, now + WDUN_PILE_MS);
      await this._wdunSave(now, true);
      this._send(ws, JSON.stringify({ t: 'wdun', k: 'lk', h, left: st.locks[acct]?.[h] ? st.locks[acct][h] - now : 0 }));
      this._wdunFanCrows(now, acct);
    }
  }
  /** A hall's world room wiped (the hub asks the room; the room refuses while anyone stands in it).
   *  AUDIT SCALE II R3-9: AND EVERY LAYER OF IT. A hall's room layers (SCALE5d - `dungeon:m<id>` is a world room), and the
   *  wipe reached the place alone: a layer's slain foes and looted piles were kept WORLD_TTL_MS (30 days), and a player
   *  standing in a layer was never seen. Each layer is asked, at once (one round trip, not eight), and any layer's
   *  refusal (409, someone stands in it) or silence answers that the hall was not wiped whole; each layer nobody stands
   *  in is wiped either way - its memory is its own. Nothing cheaper is correct: the place cannot know which of its
   *  layers ever held anything (a layer's drain sweeps every trace of who stood in it, and a later layer may keep a
   *  memory while an earlier one keeps none), and a layer never used answers from an empty object, which writes
   *  nothing and so is never kept. */
  async _wdunWipe(h) {
    const key = wdunRoomKey(h), rooms = this.env?.ROOMS;
    if (!key || !rooms?.idFromName || !rooms?.get) return false;
    const wipe = async (room, ly) => {
      try {
        const res = await rooms.get(rooms.idFromName(layerName(room, ly))).fetch(new Request(`https://relay.internal${WDUN_INTERNAL_RESET}`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(ROOM_CALL_MS) }));
        return !!res?.ok;
      } catch (e) { console.warn('[wdun] wipe', h, room, ly, e?.message ?? e); return false; }
    };
    // AUDIT SEA VENTURES A5: and at every size it is built at (DUNGEON_ROOM_TAGS - SD-ONLINE: online a dungeon is laid small,
    // medium or whole by its map id, its room tagged for it) - the plain room alone was wiped, while the halls laid medium or
    // small (120 of the mountains' 200, 46 of a fortnight's vaults) kept their foes slain and their chests empty for good
    const sized = [key, ...Object.values(DUNGEON_ROOM_TAGS).map((tag) => `${key}${tag}`)];
    return (await Promise.all(sized.flatMap((room) => Array.from({ length: LAYERS_MAX }, (_, ly) => wipe(room, ly))))).every(Boolean);
  }
  /** The room's side of the wipe: its stored world forgotten, unless someone is hello'd in it. */
  async _wdunResetInternal(_request) {
    for (const [, b] of this._all()) if (b.id) return json({ ok: false, why: 'occupied' }, 409);
    const m = await this.state.storage.list({ prefix: 'world:' });
    const dead = [...m.keys()];
    this._worldMemo = undefined;
    for (let i = 0; i < dead.length; i += 128) await this.state.storage.delete(dead.slice(i, i + 128));
    return json({ ok: true, wiped: dead.length });
  }
  /** The hub's answer: do accounts `a` and `b` share a party? */
  async _wdunKinInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const a = typeof body?.a === 'string' ? body.a : null, b = typeof body?.b === 'string' ? body.b : null;
    if (!a || !b || a.length > 128 || b.length > 128) return json({ error: 'bad kin' }, 400);
    const [ra, rb] = [await this._acct(a), await this._acct(b)];
    // INT9: AND UNDER THE PARTY'S TRUCE - a party one of them left (or both) inside the truce (net/wild/wildRef.js WILD_REF.truceMs), shared with the
    // other's party now or the one it left
    const now = Date.now();
    const parties = (r) => [r?.party, r?.partyWas && now - r.partyWas.at < WILD_REF.truceMs ? r.partyWas.id : null].filter(Boolean);
    const pa = parties(ra), pb = parties(rb);
    return json({ kin: pa.some((x) => pb.includes(x)) });
  }
  /** INSTANCES (bible/11-Multiplayer/Instances.md): an instance room's door for the account `who` names - `{ as }` admitted
   *  (instanceAdmission's right: 'owner', 'staff', 'party'), or `{ no }`: INSTANCE_DOOR_WORD for anyone else, and for
   *  everyone at a zone hall (net/wire.js wdunHallOfRoom - a hall keeps no instance) and at an isle's dungeon (SEA-VAULTS:
   *  seaRoomCell - the open sea keeps none); 'busy' while the hub does not
   *  answer, or past the account's own hello gate. THE GATE IS BY ACCOUNT, after the token (AUDIT SD II L7 M1's, a
   *  realm's): every member an instance ever had knows its key, and the room's own bucket, spent before the token, was a
   *  door any of them could hold shut with junk. */
  async _instanceHello(key, who, now) {
    if (!(await this._battleHelloGate(who?.subject, 'fighter', now)).pass) return { no: 'busy' };
    if (wdunHallOfRoom(instanceOf(key)?.base) || seaRoomCell(instanceOf(key)?.base)) return { no: INSTANCE_DOOR_WORD };
    let silent = false;
    const kin = async (subject, owner) => { const k = await this._instanceKinOf(subject, owner, now); if (k == null) silent = true; return k === true; };
    const as = await instanceAdmission(key, who?.subject, { staff: isStaff(who?.glyphs), kin });
    return as ? { as } : { no: silent ? 'busy' : INSTANCE_DOOR_WORD };
  }
  /** INSTANCES (the audit): A MEMBER LET IN AS THE OWNER'S PARTY IS ASKED AGAIN WHILE IT STAYS - the hello's word was the
   *  party as it stood then; one kicked, lapsed, or whose party the owner left is refused out of the room within
   *  INSTANCE_KIN_KEEP_MS of the hub saying so (the close hands the host's seat on, _leave). Asked off its pose and never
   *  awaited by it (the room's hottest path); the hub silent leaves it in, and a later pose asks again. */
  _instanceRecheck(ws, a, now) {
    const at = this._instanceAsked.get(ws);
    if (at != null && now - at < INSTANCE_KIN_KEEP_MS) return;
    this._instanceAsked.set(ws, now);
    const r = instanceOf(a.key);
    if (!r || !a.sub) return;
    this._instanceKinOf(a.sub, r.owner, now).then(async (kin) => {
      if (kin !== false || this._dead.has(ws) || !this.state.getWebSockets().includes(ws)) return;   // gone on its own meanwhile: its leave was said once
      this._refuse(ws, INSTANCE_DOOR_WORD);
      await this._reap();   // out of any door: its leave said now (the tick's own reap, AUDIT CARDS-3 A3)
    }).catch((e) => console.warn('[instance] recheck', e?.message ?? e));
  }
  /** INSTANCES: the hub's word whether `subject`'s party holds the account whose digest is `owner` - true, false, or null
   *  while the hub does not answer. A yes is kept INSTANCE_KIN_KEEP_MS a pair (the stalest pair goes first); a no never
   *  is - a member just invited is heard at once. */
  async _instanceKinOf(subject, owner, now) {
    const key = `${subject}|${owner}`, had = this._instanceKin.get(key);
    if (had && now - had.at < INSTANCE_KIN_KEEP_MS) return had.kin;
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return false;   // a relay of one room: no hub, no party
    let kin = null;
    try {
      const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${INSTANCE_INTERNAL_KIN}`, { method: 'POST', body: JSON.stringify({ a: subject, o: owner }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
      if (res?.ok) kin = !!(await res.json())?.kin;
    } catch (e) { console.warn('[instance] kin', e?.message ?? e); }
    this._instanceKin.delete(key);
    if (kin !== true) return kin;
    if (this._instanceKin.size >= 512) this._instanceKin.delete(this._instanceKin.keys().next().value);
    this._instanceKin.set(key, { kin, at: now });
    return kin;
  }
  /** INSTANCES: the hub's answer - does account `a`'s party hold another member whose digest is `o`? */
  async _instanceKinInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const a = typeof body?.a === 'string' ? body.a : null, o = typeof body?.o === 'string' ? body.o : null;
    if (!a || !o || a.length > 128 || o.length > 64) return json({ error: 'bad kin' }, 400);
    // the party as it stands (the audit): a seat lapsed past PARTY_OFFLINE_MS is walked out first, as every hub reading of
    // the party walks it (_myParty) - a stored seat nobody had walked yet admitted a lapsed member, and a lapsed owner's party
    const rec = await this._acct(a);
    const [party] = rec ? await this._myParty(a, rec, Date.now()) : [null];
    return json({ kin: await partyHoldsOwner(party?.members ?? null, a, o) });
  }
  /** A place room's question to the hub, kept a minute per pair (a fat remains is many takes). */
  async _wdunKinOf(taker, owner, now) {
    const key = `${taker}|${owner}`, had = this._wdunKin.get(key);
    if (had && now - had.at < 60_000) return had.kin;
    // INT9 (AUDIT): a hub that does not answer is KIN - no blow lands and nothing is taken until it does (it answered
    // "strangers", and a party's blows landed); its silence is kept WDUN_KIN_SILENT_MS alone
    const rooms = this.env?.ROOMS;
    let kin = !!(rooms?.idFromName && rooms?.get), heard = !kin;   // no hub at all (a relay of one room): nobody's kin
    if (kin) {
      try {
        const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${WDUN_INTERNAL_KIN}`, { method: 'POST', body: JSON.stringify({ a: taker, b: owner }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
        if (res?.ok) { kin = !!(await res.json())?.kin; heard = true; }
      } catch (e) { console.warn('[wdun] kin', e?.message ?? e); }
    }
    // the stalest pair goes first, never the whole cache (SCALE2b's law for the relay's bounded caches); a pair asked
    // again moves to the end
    this._wdunKin.delete(key);
    if (this._wdunKin.size >= 512) this._wdunKin.delete(this._wdunKin.keys().next().value);
    this._wdunKin.set(key, { kin, at: heard ? now : now - 60_000 + WDUN_KIN_SILENT_MS });
    return kin;
  }
  /** A remains gone in this room - the hub told, so the hall's crows go when no other body lies in it. Unawaited. */
  _wdunTellGone(os) {
    if (!os) return;
    const rooms = this.env?.ROOMS;
    if (!rooms?.idFromName || !rooms?.get) return;
    const p = rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${WDUN_INTERNAL_GONE}`, { method: 'POST', body: JSON.stringify({ os }), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    p.catch((e) => console.warn('[wdun] gone', e?.message ?? e));
    try { this.state.waitUntil?.(p); } catch { /* not every runtime */ }
  }
  async _wdunGoneInternal(request) {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    if (typeof body?.os !== 'string' || body.os.length > 128) return json({ error: 'bad gone' }, 400);
    const now = Date.now();
    const st = await this._wdunRec(now);
    if (wdunGone(st, body.os, now)) { await this._wdunSave(now, true); this._wdunFanCrows(now); }
    return json({ ok: true });
  }

  // ───────────────────────────── OW6L: THE OVERWORLD'S LEDGER ─────────────────────────────
  /** A cell's overworld ledger (net/overworldLaw.js) - read from storage ONCE an instance life, the read's promise shared
   *  by every word and hello that lands while it runs (two first words racing each read an empty ledger, and the second
   *  wrote over the first); pruned as it is read, and written back when the prune let anything go. A read that failed is
   *  asked again by the next word or hello. The ledger outlives every socket in the cell and the object's own sleep. */
  _owLedger(now) {
    if (!this._owLoad) {
      this._owLoad = (async () => {
        const led = owLedgerOf(await this.state.storage.get(OW_LEDGER_KEY));
        if (owPrune(led, now)) await this._owWrite(led);
        return led;
      })();
      this._owLoad.catch(() => { this._owLoad = null; });
    }
    return this._owLoad;
  }
  /** The ledger to storage - a COPY (owLedgerOf: the runtime keeps what was put, never this instance's live object) - or
   *  its key let go once it holds nothing. */
  async _owWrite(led) {
    if (owLedgerEmpty(led)) await this.state.storage.delete(OW_LEDGER_KEY);
    else await this.state.storage.put(OW_LEDGER_KEY, owLedgerOf(led));
  }
  /** A cell's welcome's `ow` field - `,"ow":{sp, dg}` - or '' when the ledger holds nothing, or could not be read (a
   *  welcome is never refused over it; the next word or hello reads again). */
  async _owWelcome(now) {
    try {
      const w = toWelcome(await this._owLedger(now), now);
      return w.sp.length || w.dg.length || w.gr?.length ? `,"ow":${JSON.stringify(w)}` : '';   // GRAVE-PARTY: a cell whose ledger holds graves alone says them too
    } catch (e) { console.warn('[ow] welcome failed', e?.message ?? e); return ''; }
  }
  /**
   * A PLAYER'S WORD on its cell's overworld ledger (net/overworldLaw.js). JUNK, struck, when anything in it is what no
   * honest machine says in this room: an id whose cell origin lies outside the cell's square widened by
   * OW_CELL_MARGIN_PX, a row off that square, on a pixel the spawn roll leaves empty, or cleared before it was seen (the
   * session holds its word to the same law before it sends, so an honest client is never struck). Otherwise it is
   * folded in - an id of another life, a row out of its time, dropped quietly (a clock at the edge, a stale save). What
   * CHANGED is written, then said to everyone hello'd in the cell - THE SPEAKER TOO, as the raid's count is: its machine
   * min-merges the ledger's word back (the cell's clocks may be earlier than its own), and hearing it is how a speaker
   * knows the cell took it. Over the cell's fan budget a change is said to its speaker alone (the ledger holds it; the
   * next welcome says it to the rest). A row the word was BEHIND is answered to its speaker alone, with the ledger's own
   * (RAID3's law: a word that moves nothing is answered to its speaker) - a machine that forgot a spawn and met it again.
   */
  /** GRANT2 (bible/11-Multiplayer/Spawn-Grants.md section 12): THE LAW'S MODE IN FORCE at an ask - the hub's setting,
   *  else the Worker's GRANT_MODE, else `measure` (net/grantLaw.js grantModeOf: the law measures from its deploy). A
   *  cell's first ask waits on the hub's settings; later ones read the last it had and ask again behind it, at most every
   *  GRANT_CFG_TTL_MS - every cell a player roams asks, so not the boss rooms' minute: the hub is every tab's. */
  async _grantMode(now) {
    if (this._relayCfgAt === -Infinity) await this._relayCfgFresh(now);
    else if (now - this._relayCfgAt >= GRANT_CFG_TTL_MS) void this._relayCfgFresh(now);
    return grantModeOf(relayCfgValue(await this._relayCfgOf(), this.env, 'grantMode'));
  }
  /**
   * GRANT9 (bible/11-Multiplayer/Spawn-Grants.md sections 4.11 and 16): THE RELAY STRIPS RECORDS - while `grantStrip` is
   * on, a foes frame (a cell's, or a world room's own lane) loses each record that names a grant this room does not hold
   * as the sender's, a member past it, or marks past its own (net/grantLaw.js grantMarksAllow), and - from a socket that
   * has stood on a grant here (GRANT-DOOR, section 20: or whose hello says it stands on them) - a live record with no
   * grant that is not its ally (the frame's allied watchmen, crew and companions). A body (`d` 1) and a word with no
   * species (a standing foe's delta) pass: what they name was decided when it first stood. FOE-BOUNDS (section 19): and
   * any record whose health no builder could give it, counted under the relay's own name. The frame back, the same one
   * when nothing went. Off, never called: the foe stream is not read (section 4.6).
   */
  _grantStripped(a, data, kind = 'foes', now = Date.now()) {
    if (!data || !Array.isArray(data.f)) return data;
    const G = this._grants;
    const asker = !!G?.askers?.has(a.id) || a.gv === 1;   // GRANT-DOOR: a socket whose hello says it stands on grants is held to them from its first frame
    const allies = new Set([data.al, data.cw, data.cp].flatMap((x) => (Array.isArray(x) ? x : [])));
    const camps = new Set((Array.isArray(data.cz) ? data.cz : []).map((c) => (Array.isArray(c) ? c[0] : null)));
    let worst = null, stripped = 0;
    const keep = data.f.filter((r) => {
      if (!r || typeof r !== 'object') return false;
      // FOE-BOUNDS (Spawn-Grants section 19): a record no builder could give (net/foeBounds.js) goes nowhere - the relay
      // is the one authority every copy hears, so none stands it, adopts it or passes it on; an ally's is unverified
      const s = allies.has(r.i) ? null : foeStatsRefusal(r, { lane: kind === 'own' ? 'any' : 'street', camp: camps.has(r.i) });
      if (s) { if (this._grantStripSeen(a, r)) stripped++; if (!worst || s.k - s.mx > worst.k - worst.mx) worst = s; return false; }
      if (!Array.isArray(r.gr)) return !asker || r.d === 1 || r.t === undefined || allies.has(r.i);
      const v = G?.live.get(r.gr[0]), i = r.gr[1];
      return !!v && v.gr.o === a.id && Number.isInteger(i) && i >= 0 && i < v.gr.n && (v.gr.h < 0 || i === v.gr.h) && grantMarksAllow(v.gr, i, r);
    });
    if (stripped) this._grantRelayTally(a, stripped, worst, now);
    return keep.length === data.f.length ? data : { ...data, f: keep };
  }
  /** FOE-BOUNDS: a record the relay stripped for its health, counted once a sender, record and claim (bounded - the
   *  oldest forgotten), so a frame said five times a second is one record in the tally, not fifty. */
  _grantStripSeen(a, r) {
    const seen = (this._grantStrips ??= new Set());
    const k = `${a.id}|${r.i}|${r.k ?? r.h}`;
    if (seen.has(k)) return false;
    seen.add(k);
    if (seen.size > GRANT_STRIPS_SEEN_MAX) seen.delete(seen.values().next().value);
    return true;
  }
  /** FOE-BOUNDS: THE RELAY'S OWN TALLY - `n` records of `a`'s it stripped for their health, the worst one's evidence (its
   *  type, its claim, its bound), folded under the relay's own name (net/grantMeasure.js GRANT_RELAY_READER) into the
   *  window it signs: the service opens a case on it alone (server-account/src/grants.js). */
  _grantRelayTally(a, n, e, now) {
    const G = this._grantState(a.key, now);
    this._grantFrom(G, now);
    if (foldGrantTally(G.w, GRANT_RELAY_READER, a.sub || a.id, 'stats', n, e)) void this._grantFlush();
    else if (!G.timer) G.timer = setTimeout(() => { void this._grantFlush(); }, GRANT_MEASURE_MS);
  }
  /** GRANT2: the welcome's word of it, a cell's - `,"gm":"<mode>"`; a client asks only while it is not `off`. NEVER THE
   *  HUB'S CALL: a hello asks nothing - the setting this cell last had, or the Worker's var (a staff `off` reaches a
   *  client at its next ask, answered `off`). */
  _grantWelcome() {
    return `,"gm":${JSON.stringify(grantModeOf(relayCfgValue(this._relayCfg, this.env, 'grantMode')))}`;
  }
  /** GRANT2: A CELL'S GRANTS - its counter (begun anywhere in 31 bits, so a re-woken cell does not number its grants from
   *  its last life's), the live grants it minted (number -> members and expiry) and their members, each account's bucket
   *  per kind (`<account>|<kind>`), and the measure's window. In memory alone: an evicted cell forgets them, and its
   *  window with them (a measure is a sample). */
  _grantState(q, now) {
    return this._grants ??= { q, n: rand32() >>> 1, live: new Map(), liveN: 0, buckets: new Map(), tallied: new Map(), w: newGrantMeasure(now), timer: null };
  }
  /** GRANT2: the expired forgotten - a live grant past its `x` (the ceiling errs high by at most its window: a granted foe
   *  that died early counts until then), a bucket full again (a first ask's is full). */
  _grantPrune(G, now) {
    for (const [g, v] of G.live) if (v.x <= now) { G.live.delete(g); G.liveN -= v.n; }
    for (const [key, b] of G.buckets) if (grantBucketIdle(key.slice(key.lastIndexOf('|') + 1), b, now)) G.buckets.delete(key);
    for (const [id, at] of G.tallied) if (now - at >= GRANT_TALLY_MS) G.tallied.delete(id);
  }
  /**
   * GRANT2-GRANT4 (bible/11-Multiplayer/Spawn-Grants.md sections 4.3, 12-14): A SPAWN GRANT ASKED (`{t:'grant', k, id,
   * ...}`, net/grantLaw.js validGrantAsk) - on its own bucket (the same strikes), in a cell or a world room. Off: `off`, and the
   * client asks no more. Each ask is a method of its own: a mint, a renewal, a free, a carry into this cell, a member
   * handed on, a reader's tally.
   */
  async _grantFrame(ws, a, m) {
    const now = Date.now();
    if (!this._spend(ws, now, grantGate, 'grantBucket', 'grantDrops', 'too many grant asks')) return;
    const ask = validGrantAsk(m);
    if (!ask || !streamsFoes(a.key) || !a.id) { this._junk(ws); return; }   // GRANT4: a cell's, or a world room's own lane
    const mode = await this._grantMode(now);
    if (mode === 'off') { this._send(ws, JSON.stringify({ t: 'grant', k: 'off', id: ask.id })); return; }
    const G = this._grantState(a.key, now);
    this._grantPrune(G, now);
    if (ask.k === 'mint') return this._grantMintAsk(ws, a, ask, G, mode, now);
    if (ask.k === 'renew') return this._grantRenew(ws, a, ask, G, now);
    if (ask.k === 'free') return this._grantFree(a, ask, G);
    if (ask.k === 'carry') return this._grantCarry(ws, a, ask, G, now);
    if (ask.k === 'heir') return this._grantHeir(ws, a, ask, G, now);
    return this._grantTally(a, ask, G, now);
  }
  /** GRANT2: does this socket's pose stand in this cell? A halo's foes are their own cell's, and a pose not yet here is
   *  told `cell` - the owner's own cell mints, and carries. GRANT4: a world room's socket stands in it (a building's or a
   *  dungeon's pose is its own scene's, no map's). */
  _grantHere(ws, a, id) {
    const p = a.pose;
    if (isWorldRoom(a.key) || (p && cellRoomOfWire(p.x, p.z) === a.key)) return true;
    this._send(ws, JSON.stringify({ t: 'grant', k: 'no', id, r: 'cell' }));
    return false;
  }
  /**
   * GRANT2: A MINT. The gate (net/grantLaw.js grantMintGate) is asked every time and its refusal counted; while the law
   * MEASURES every ask is granted, and only while it ENFORCES is a refusal said (`no`). The account's bucket is kept
   * either way, so the measure counts what enforcing would have refused.
   */
  async _grantMintAsk(ws, a, ask, G, mode, now) {
    if (!this._grantHere(ws, a, ask.id)) return;
    if (isWorldRoom(a.key) && GRANT_OPEN_KINDS.includes(ask.kind)) { this._send(ws, JSON.stringify({ t: 'grant', k: 'no', id: ask.id, r: 'kind' })); return; }   // GRANT4: the open country's kinds, never a room's
    const who = a.sub || a.id;   // the account's (a guest's token has its own - the same budget, Spawn-Grants section 10)
    const key = `${who}|${ask.kind}`;
    const gate = grantMintGate(ask.kind, ask.n, G.buckets.get(key), G.liveN, now);
    if (gate.bucket) G.buckets.set(key, gate.bucket);
    if (gate.refusal && mode === 'enforce') {
      this._grantFold(G, who, ask, gate.refusal, now);
      this._send(ws, JSON.stringify({ t: 'grant', k: 'no', id: ask.id, r: gate.refusal, gm: mode }));
      return;
    }
    const gr = await this._grantMint(G, a, ask, now);
    this._grantFold(G, who, ask, gate.refusal, now);
    this._send(ws, JSON.stringify({ t: 'grant', k: 'ok', id: ask.id, gr, gm: mode }));   // AUDIT GRANT A10: the law in force, as this ask read it
  }
  /** GRANT2: THE MINT (Spawn-Grants section 4.2) - the owner's pixel and the world minute as the relay reads them, its
   *  signed level and Renown (0 where its token has none: a guest's - no elite), a fresh seed and the marks it rolls, ten
   *  minutes' life, the relay's signature (none from a relay without a key: the grant goes out unsigned, and no reader
   *  will believe it). Counted live until its `x`. GRANT4: a world room's names no pixel ([0, 0]) - its kinds roll no
   *  table a pixel decides. */
  async _grantMint(G, a, ask, now) {
    const px = isWorldRoom(a.key) ? [0, 0] : mapPixelOfWire(a.pose.x, a.pose.z);
    const l = Number.isSafeInteger(a.cl) ? a.cl : 0, r = renownIssuable(a.lv) ? a.lv : 0;
    const s = rand32(), k = grantKindRolled(ask.kind, relayCfgValue(this._relayCfg, this.env, 'grantRoll') === 'on');   // GRANT8: an encounter's species its seed's, while `grantRoll` is on
    (G.askers ??= new Set()).add(a.id);   // GRANT9: a socket that stands on grants here - a record of its with none is stripped
    const gr = { g: this._grantNext(G), o: a.id, q: a.key, a: a.sub ?? '', k, p: [px[0], px[1]], m: Math.floor(sharedClassicMinutes(now)), l, r, n: ask.n, s, ...grantMarksFor(k, s, ask.n, r), h: -1, x: now + GRANT_TTL_MS };
    return this._grantSign(G, gr, ask.n);
  }
  /** GRANT2-GRANT3: the cell's next grant number. */
  _grantNext(G) { G.n = G.n >= 0x7fffffff ? 0 : G.n + 1; return G.n; }
  /** GRANT3: a grant signed and kept live - its body (to sign again), its expiry, and the members it counts against the
   *  ceiling (`n`; 0 for a member handed on, counted already under its first grant). */
  async _grantSign(G, gr, n) {
    const sg = await signGrant(gr, await this._receiptKeyOf(), { subtle: crypto.subtle });
    const out = sg ? { ...gr, sg } : gr;
    const was = G.live.get(gr.g);
    if (was) G.liveN -= was.n;
    G.live.set(gr.g, { n, x: gr.x, gr, ...(was?.handed ? { handed: was.handed } : {}) });   // AUDIT GRANT A15: a renewal forgets no member it handed on
    G.liveN += n;
    return out;
  }
  /** GRANT3: A RENEWAL (section 4.3) - each of my live grants this cell still holds, signed again with a new expiry; one
   *  this cell holds as another socket's, or not at all, is passed over. */
  async _grantRenew(ws, a, ask, G, now) {
    const grs = [];
    let key;
    for (const gr of ask.grs) {
      const live = G.live.get(gr.g);
      if (live) { if (live.gr.o === a.id) grs.push(await this._grantSign(G, grantRenewed(live.gr, now), live.n)); continue; }
      // AUDIT GRANT A8: one this cell has forgotten (a relay deployed, the object evicted) - mine, this cell's, alive,
      // and this relay's own signature: signed again and counted live, so its foes do not lose their grant
      key ??= await this._receiptKeyOf();
      if (gr.o === a.id && gr.a === (a.sub ?? '') && gr.q === a.key && now <= gr.x && await grantSignedHere(gr, key, { subtle: crypto.subtle })) grs.push(await this._grantSign(G, grantRenewed(gr, now), gr.h >= 0 ? 0 : gr.n));
    }
    this._send(ws, JSON.stringify({ t: 'grant', k: 'renew', id: ask.id, grs }));
  }
  /** GRANT3: A FREE - my grants' members are all gone (AUDIT GRANT A7: a turn's in one ask): believed only downward (a lie
   *  costs only the liar). Says nothing. */
  _grantFree(a, ask, G) {
    for (const g of ask.gs) {
      const live = G.live.get(g);
      if (!live || live.gr.o !== a.id) continue;
      G.live.delete(g);
      G.liveN -= live.n;
    }
  }
  /** GRANT3: A CARRY (section 4.3) - I crossed into this cell with my grants from another: each this relay signed (signed
   *  here again and compared - net/grantLaw.js grantSignedHere), made out to me (this socket and its account), from
   *  another cell, unexpired, is signed again for this cell under its own number. Counted live here (the cell it left
   *  forgets it at its expiry); never refused by the ceiling - its foes already stand. One refused is null. */
  async _grantCarry(ws, a, ask, G, now) {
    if (!this._grantHere(ws, a, ask.id)) return;
    const key = await this._receiptKeyOf(), env = { subtle: crypto.subtle };
    const grs = [];
    for (const gr of ask.grs) {
      const ok = isCellRoom(a.key) && isCellRoom(gr.q) && gr.o === a.id && gr.a === (a.sub ?? '') && gr.q !== a.key && now <= gr.x && await grantSignedHere(gr, key, env);   // GRANT4: cell to cell - a room's grants stay its own
      grs.push(ok ? await this._grantSign(G, grantCarried(gr, a.key, this._grantNext(G), now), gr.h >= 0 ? 0 : gr.n) : null);
    }
    this._send(ws, JSON.stringify({ t: 'grant', k: 'carry', id: ask.id, grs }));
  }
  /** GRANT3: AN HEIR (section 4.8) - member `i` of my grant handed on to socket `to`, who stands in this cell: the same
   *  seed and marks, made out to the heir and standing that one member alone (`h`), said to THE HEIR (my handover frame
   *  goes at once - a death or a door waits on no relay - and the heir's game ties the grant to the foe it took). Each
   *  member is handed on once from this cell's grant; it counts nothing more against the ceiling. AUDIT GRANT A7: a
   *  handover's members in one ask. AUDIT GRANT A15: only from a grant this cell holds live as mine (one freed or
   *  forgotten hands nothing on), its handed members kept across its renewals (_grantSign). Any refused: one `no`. */
  async _grantHeir(ws, a, ask, G, now) {
    const key = await this._receiptKeyOf(), env = { subtle: crypto.subtle };
    let refused = false;
    for (const { gr, i, to } of ask.hs) {
      const heir = [...this._all()].find(([, b]) => b.id === to)?.[0] ?? null;
      const live = G.live.get(gr.g);
      const ok = !!heir && !!live && live.gr.o === a.id && gr.o === a.id && gr.q === a.key && now <= gr.x && !live.handed?.has(i) && await grantSignedHere(gr, key, env);
      if (!ok) { refused = true; continue; }
      (live.handed ??= new Set()).add(i);
      const out = await this._grantSign(G, grantHanded(gr, i, to, this._grantNext(G), now), 0);
      this._send(heir, JSON.stringify({ t: 'grant', k: 'heir', id: ask.id, gr: out }));
    }
    if (refused) this._send(ws, JSON.stringify({ t: 'grant', k: 'no', id: ask.id, r: 'sender' }));
  }
  /** GRANT3: A READER'S TALLY (section 4.7) - what my game refused of each sender's foes since my last tally, by reason:
   *  folded into the measure under my account and the sender's - a socket this cell holds; one gone is passed over (its
   *  account is not known here). One tally a reader GRANT_TALLY_MS (the socket's own clock), the rest dropped unsaid. */
  _grantTally(a, ask, G, now) {
    const last = G.tallied.get(a.id) ?? -Infinity;
    if (now - last < GRANT_TALLY_MS - GRANT_SKEW_MS) return;
    G.tallied.set(a.id, now);
    const reader = a.sub || a.id;
    const subs = new Map([...this._all()].filter(([, b]) => b.id).map(([, b]) => [b.id, b.sub || b.id]));
    let folded = false;
    for (const row of ask.rows) {
      const sender = subs.get(row.o);
      if (!sender || sender === reader) continue;
      this._grantFrom(G, now);
      folded = true;
      if (foldGrantTally(G.w, reader, sender, row.r, row.n)) { void this._grantFlush(); folded = false; }   // AUDIT GRANT A4: posted at its whole bound - the rest begin the next window (_grantFlush swaps it before its first await)
    }
    if (folded && !G.timer) G.timer = setTimeout(() => { void this._grantFlush(); }, GRANT_MEASURE_MS);
  }
  /** GRANT2: an ask folded into the window (net/grantMeasure.js foldGrantAsk), which posts at its whole bound or once its
   *  first ask has waited GRANT_MEASURE_MS - while GRANT_FEED_URL is set; unset, the window is dropped at its bound. */
  _grantFold(G, who, ask, refusal, now) {
    this._grantFrom(G, now);
    const full = foldGrantAsk(G.w, who, ask.kind, ask.n, refusal, G.liveN);
    if (full) void this._grantFlush();
    else if (!G.timer) G.timer = setTimeout(() => { void this._grantFlush(); }, GRANT_MEASURE_MS);
  }
  /** AUDIT GRANT A5: a window begins at its first fold, never at the last post - an idle cell's hours are no asking time
   *  (grantsMeasure reads asks an hour over the window's length). */
  _grantFrom(G, now) { if (!G.w.rows.size && !G.w.tallies.size) G.w.from = now; }
  /** GRANT2: THE WINDOW POSTED - signed with the relay's receipt key, to GRANT_FEED_URL through the ACCOUNTS binding where
   *  the Worker has it (the chat feed's door, _feedFlush); answered or not it is gone, and a new window begins. Answers
   *  whether it went. */
  async _grantFlush() {
    const G = this._grants;
    if (!G) return false;
    if (G.timer) { clearTimeout(G.timer); G.timer = null; }
    const now = Date.now();
    const w = G.w;
    G.w = newGrantMeasure(now);
    const url = this.env?.GRANT_FEED_URL;
    if (typeof url !== 'string' || !url.startsWith('https://')) return false;
    try {
      const id = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const batch = grantMeasureBatch(w, id, G.q, now);
      const sealed = batch && await sealGrantMeasure(batch, await this._receiptKeyOf(), { subtle: crypto.subtle });
      if (!sealed) return false;
      const init = { method: 'POST', headers: { 'content-type': 'application/json', [GRANT_MEASURE_SIG_HEADER]: sealed.sig }, body: sealed.body, signal: AbortSignal.timeout(GRANT_MEASURE_POST_MS) };
      const svc = this.env?.ACCOUNTS;
      const res = typeof svc?.fetch === 'function' ? await svc.fetch(new Request(url, init)) : await fetch(url, init);
      if (!res.ok) console.warn('[grant] the service said', res.status);
      return res.ok;
    } catch (e) { console.warn('[grant] post failed', e?.message ?? e); return false; }
  }
  async _owWord(ws, a, m, now) {
    if (m.k === 'gr') return this._owGraves(ws, a, m, now);   // GRAVE-PARTY: the graves' own law
    const junk = m.k === 'sp' ? !m.ids.every((id) => owIdInCell(id, a.key)) : !m.rows.every((r) => owRowSane(r) && owRowInCell(r, a.key));
    if (junk) { this._junk(ws); return; }
    // AUDIT SCALE II R3-3 (c): A LAYER KEEPS NO LEDGER - every band and raider spent, and every spawned dungeon's clock,
    // is the place's (SCALE5d: a layer is another object for the same cell, and its ledger was one of its own, so a band
    // spent in one copy stood in the others and a dungeon's clocks forked). A layer's word is nothing: nothing written,
    // nothing said (no refusal word - the session counts it said, so it is not owed again). The speaker's own game keeps
    // what it spent (world.js bandSpend), and its foes frame spends it for every player in the layer who hears that
    // (TV7b's band word); one who comes into the layer later meets the band standing again, and the layer's welcome
    // carries no ledger
    if (a.ly) return;   // the place's ledger alone
    const led = await this._owLedger(now);
    const moved = m.k === 'sp' ? owFoldSpent(led, m.ids, now) : owFoldRows(led, m.rows, sharedClassicMinutes(now));
    if (moved.length) {
      owPrune(led, now);
      await this._owWrite(led);
      const out = JSON.stringify(m.k === 'sp' ? { t: 'ow', k: 'sp', ids: moved } : { t: 'ow', k: 'dg', rows: moved });
      const room = owRoomGate(this._roomOw, now);
      this._roomOw = room.bucket;
      if (room.pass) { for (const [other, b] of [...this._all()]) if (b.id) this._send(other, out); }
      else this._send(ws, out);
    }
    if (m.k === 'dg') {
      const behind = owRowsBehind(led, m.rows, moved);
      if (behind.length) this._send(ws, JSON.stringify({ t: 'ow', k: 'dg', rows: behind }));
    }
  }

  /**
   * GRAVE-PARTY (FIELD BUGS 2026-10-16b): A PLAYER'S SEARCHED GRAVES, on its cell's ledger (net/overworldLaw.js
   * owFoldGraves). JUNK, struck, when a stone's pixel lies outside the cell's square widened by OW_CELL_MARGIN_PX (the
   * session holds its word to the same law). Otherwise each stone is taken under the SPEAKER'S verified account (the
   * token's subject - never the word's) at the relay's own minute, written, and the rows taken said to everyone hello'd in
   * the cell, the speaker too - under the cell's fan budget, past it to the speaker alone (the next welcome says the rest).
   * The relay knows no party: each game locks the stones its own party searched. A LAYER KEEPS ITS OWN (unlike the spent
   * and the spawns, which are the place's, AUDIT SCALE II R3-3): a party plays in one layer, and what its members searched
   * is theirs wherever the layer stands. No account, nothing kept. AUDIT GRAVE-PARTY G3: ON ITS OWN BUCKET beside the `ow`
   * frames' (owGraveGate - an honest game's word a second at most, kept at home too), and bounded by its SEARCHER
   * (owFoldGraves: an account's own oldest out past OW_GRAVE_ACCT_ROWS_MAX) - one account's fresh stones wrote the whole
   * ledger four times a second and pushed every other searcher's rows out of the cell. G5: each row names the searching
   * character too (the token's name), so another character of the account is told whose search it was.
   */
  async _owGraves(ws, a, m, now) {
    if (!this._spend(ws, now, owGraveGate, 'owGrBucket', 'owGrDrops', 'too many grave words')) return;
    if (!m.rows.every((r) => owRowInCell(r, a.key))) { this._junk(ws); return; }
    if (typeof a.sub !== 'string' || !a.sub) return;
    const led = await this._owLedger(now);
    const taken = owFoldGraves(led, m.rows, a.sub, sharedClassicMinutes(now), a.name);
    if (!taken.length) return;
    owPrune(led, now);
    await this._owWrite(led);
    const out = JSON.stringify({ t: 'ow', k: 'gr', rows: taken });
    const room = owRoomGate(this._roomOw, now);
    this._roomOw = room.bucket;
    if (room.pass) { for (const [other, b] of [...this._all()]) if (b.id) this._send(other, out); }
    else this._send(ws, out);
  }

  // ───────────────────────────── SOC1: THE HUB ─────────────────────────────
  /** The account's record, or null - the instance's copy while it is awake (AUDIT SOC A5: one act read ~500 keys; the
   *  records this object has read are kept on it, and every write goes through _putAcct/_putAccts so the copy IS the
   *  storage's - no other object writes this room's keys), else storage's, kept then. */
  /** SCALE2b: an account's profile secret in the hub (null: none) - storage's, read once and kept (`_asecrets`); every
   *  write and delete of one keeps the copy. A hub hello read it twice (the forged retire and the legacy merge). */
  async _asecretOf(id) {
    if (this._asecrets.has(id)) return this._asecrets.get(id);
    const v = await this.state.storage.get(acctSecretKey(id));
    const held = typeof v === 'string' ? v : null;
    this._asecrets.set(id, held);
    return held;
  }
  async _acct(id) {
    if (this._recs.has(id)) return this._recs.get(id);
    const r = await this.state.storage.get(acctKey(id));
    const rec = r && typeof r === 'object' ? r : null;
    this._keepRec(id, rec);
    return rec;
  }
  _keepRec(id, rec) { this._recs.set(id, rec); }   // SCALE2b: bounded, the oldest first - never cleared whole
  /** INT9 (PARTY-TRUCE at the relay): a record whose party changed keeps the one it left and when (`partyWas`), so the
   *  zone's referee holds the truce (WILD_REF.truceMs) - the client's own law (systems/wild/wildZone.js createPartyTruce),
   *  never a crafted client's choice. Every write of a record passes here. */
  _truced(id, rec) {
    const had = this._recs.get(id);
    if (!rec || !had?.party || had.party === rec.party) return rec;
    return { ...rec, partyWas: { id: had.party, at: Date.now() } };
  }
  async _putAcct(id, rec) { rec = this._truced(id, rec); this._keepRec(id, rec); await this.state.storage.put(acctKey(id), rec); }
  /** Several records written as one batch (a friendship is two records at once, or none). */
  async _putAccts(recs) { const puts = {}; for (const [id, r] of Object.entries(recs)) { const rec = this._truced(id, r); this._keepRec(id, rec); puts[acctKey(id)] = rec; } await this.state.storage.put(puts); }
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
    // FRIENDS-SYNC (field bug: "My friend list is different between devices"): THE SOCIAL ACCOUNT IS THE VERIFIED
    // PLAYER - the token's subject, the same on every device signed in to it - never the browser profile's id
    // (net/social.js accountId, minted per appStorage), which made a laptop and a desktop two hub accounts with two
    // lists, and two players sharing one browser profile one account with one list. The profile pair is now a LEGACY
    // credential alone: proved by its secret, its list is merged into the player's once and the old record retired
    // (the merge ACC1b said belongs here, the one place that holds both credentials at once).
    const me = this._attach(ws).sub || m.acct;
    if (me === m.acct) {   // no verified subject (a build before ACC1g's wall): the profile's own law, as it was
      const held = await this._asecretOf(m.acct);
      if (held && held !== m.asecret) { this._sayError(ws, 'account taken'); return; }
      if (!held) { await this.state.storage.put(acctSecretKey(m.acct), m.asecret); this._asecrets.set(m.acct, m.asecret); }
    } else {
      // AUDIT FRIENDS-SYNC F1: a profile secret held at the PLAYER's own id was minted by a profile hello that NAMED that
      // id under the old law (a player's id is public: every roster carries `sub`) - that record is nobody's: never
      // inherited by the player, never merged away later by whoever planted its secret.
      await this._retireForged(me, now);
      await this._mergeLegacy(me, m, this._attach(ws).name, now);
    }
    if (!this._alarmArmed) {   // AUDIT SOC A3: the room is marked a hub (its alarm is the sweep's, whoever is in it) and the sweep armed - once per instance life, and never over an alarm already set
      this._alarmArmed = true;
      await this.state.storage.put('hub', 1);
      if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(now + ACCOUNT_SWEEP_MS);
      await this._sdArm(now);   // SD3: and the Super dungeon's director, when its next move comes first
      await this._heraldArm(now);   // DISCORD-GATES: and sooner, when the herald owes a post first (an alarm armed before it had a webhook)
    }
    let a = this._attach(ws);
    if (a.id !== m.id) return;   // replaced or gone while storage answered
    // ACC1d: the name the relay DECIDED, off the attachment, not the one
    // the frame asked for - `_named` has already run and `a.name` is
    // its answer. A durable record keyed on an unchecked claim is the
    // shape this slice exists to close.
    const had = await this._acct(me);
    let rec = { ...(had ?? newAcct(a.name, now)), name: a.name, seen: now };
    let party = null;
    if (rec.party) {
      party = await this._livingParty(rec.party, now);
      if (!party || !party.members.includes(me)) { rec.party = null; party = null; }
      else if (party.away?.[me] != null) { const away = { ...party.away }; delete away[me]; party = { ...party, away }; await this._putParty(party); }
    }
    // SCALE2b: written when it holds news - a new record, a new name, a party let go - or when its last-seen is
    // ACCT_SEEN_WRITE_MS stale; otherwise only the kept copy is stamped (every hub hello wrote it)
    if (!had || had.name !== rec.name || had.party !== rec.party || !(now - (had.seen ?? 0) < ACCT_SEEN_WRITE_MS)) await this._putAcct(me, rec);
    else this._keepRec(me, { ...rec, seen: had.seen });
    a = this._attach(ws);
    if (a.id !== m.id || !this._setAttach(ws, { ...a, acct: me, party: rec.party })) return;
    await this._sayState(me, rec, now, ws);
    if (me !== m.acct && !m.ps) this._sayError(ws, 'update the game to see your friends and party');   // AUDIT FRIENDS-SYNC F5: a build before world142 refuses the picture (B19) - said in words its chat prints
    this._sayPresence(me, rec, now);
    if (party) await this._sayParty(party, now);
  }
  /** FRIENDS-SYNC: a profile account's list brought into the player's - once, proved by the profile's secret, by the
   *  first player to say hello with it after this deploy. A UNION: every friend and request either side held (the
   *  bounds kept, a request both ways already a friend dropped), every record naming the old id renamed to the
   *  player's, the old record and secret retired. Its party seat is not carried: it lapses as any seat whose tabs went
   *  (PARTY_OFFLINE_MS). */
  async _mergeLegacy(me, m, name, now) {
    const old = m.acct;
    const held = await this._asecretOf(old);
    if (!held || held !== m.asecret) return;   // never minted here, or not this device's to bring
    const legacy = await this._acct(old);
    const swap = (id) => (id === old ? me : id);
    const ids = (l, drop) => [...new Set((l ?? []).map(swap))].filter((id) => id !== drop);
    const rows = (l, drop, cap) => { const seen = new Set(); const out = []; for (const e of l ?? []) { const id = swap(e?.acct); if (id === drop || seen.has(id)) continue; seen.add(id); out.push({ ...e, acct: id }); } return out.slice(-cap); };
    const puts = {};
    if (legacy) {
      const mine = (await this._acct(me)) ?? newAcct(name, now);
      const friends = ids([...mine.friends, ...legacy.friends], me).slice(0, FRIENDS_MAX);
      const fr = new Set(friends);
      puts[me] = { ...mine, friends,
        in: rows([...mine.in, ...legacy.in], me, PENDING_MAX).filter((e) => !fr.has(e.acct)),
        out: rows([...mine.out, ...legacy.out], me, PENDING_MAX).filter((e) => !fr.has(e.acct)) };
      // every record that names the old id names the player now (a friend of both is one friend)
      const named = await this._accts([...legacy.friends, ...legacy.in.map((e) => e.acct), ...legacy.out.map((e) => e.acct)]);
      // AUDIT FRIENDS-SYNC F2: what the player's record kept of them is what theirs keeps of the player - a friend or a
      // request the bounds cut is forgotten both ways, never renamed into a one-way friendship
      const myIn = new Set(puts[me].in.map((e) => e.acct)), myOut = new Set(puts[me].out.map((e) => e.acct));
      for (const [id, r] of named) if (id !== me) { const f = ids(r.friends, id).filter((x) => x !== me || fr.has(id)), rf = new Set(f); puts[id] = { ...r, friends: f, in: rows(r.in, id, PENDING_MAX).filter((e) => !rf.has(e.acct) && (e.acct !== me || myOut.has(id))), out: rows(r.out, id, PENDING_MAX).filter((e) => !rf.has(e.acct) && (e.acct !== me || myIn.has(id))) }; }
      const all = Object.entries(puts);
      for (let i = 0; i < all.length; i += 128) await this._putAccts(Object.fromEntries(all.slice(i, i + 128)));   // SLAM5's wall: 1 + 64 friends + 2 x 32 requests is 129 records
    }
    this._recs.set(old, null);
    this._asecrets.set(old, null);   // SCALE2b: the kept copy
    await this.state.storage.delete([acctKey(old), acctSecretKey(old)]);
    for (const [id, r] of Object.entries(puts)) if (id !== me) await this._sayState(id, r, now);   // the others' pictures name the player now (no socket, no frame)
  }
  /** AUDIT FRIENDS-SYNC F1: a record at the player's own id holding a profile secret (planted under the old law), retired
   *  whole - every record it names forgets it, so nothing it befriended keeps the player's presence. */
  async _retireForged(me, now) {
    if ((await this._asecretOf(me)) == null) return;
    const forged = await this._acct(me);
    const puts = {};
    if (forged) {
      const named = await this._accts([...(forged.friends ?? []), ...(forged.in ?? []).map((e) => e.acct), ...(forged.out ?? []).map((e) => e.acct)]);
      for (const [id, r] of named) if (id !== me) puts[id] = { ...r, friends: r.friends.filter((x) => x !== me), in: r.in.filter((e) => e.acct !== me), out: r.out.filter((e) => e.acct !== me) };
      const all = Object.entries(puts);
      for (let i = 0; i < all.length; i += 128) await this._putAccts(Object.fromEntries(all.slice(i, i + 128)));
    }
    this._recs.set(me, null);
    this._asecrets.set(me, null);   // SCALE2b: the kept copy
    await this.state.storage.delete([acctKey(me), acctSecretKey(me)]);
    for (const [id, r] of Object.entries(puts)) await this._sayState(id, r, now);
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
    for (const [, b] of this._withId(m.peer, null)) { if (!b.acct) return { error: 'they have no account' }; return b.acct === me ? { error: 'that is you' } : { acct: b.acct }; }
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
      case 'party.lead': return this._partyLead(me, rec, m.acct, now);   // PARTY-LEAD
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
  /** PARTY-LEAD (2026-10-04, the player: "add a make person party leader option for the leader when in a party"): the
   *  leader hands the lead to a seated member - the leader's alone, as a kick is; never to oneself; and never to a seat
   *  that is away (AUDIT PARTY8: a lead held by an away seat left nobody able to kick). Every member hears the
   *  `party.leader` note the lead's passing on a leave already says, then the party as it stands. */
  async _partyLead(me, rec, them, now) {
    const [party] = await this._myParty(me, rec, now);
    if (!party) return 'you are not in a party';
    if (party.leader !== me) return 'only the leader can do that';
    if (them === me) return 'that is you';
    if (!party.members.includes(them)) return 'they are not in your party';
    if (!this._socketsOf(them).length) return 'they are not online';
    const next = { ...party, leader: them };
    await this._putParty(next);
    const trec = await this._acct(them);
    for (const m of next.members) this._sayNote(m, 'party.leader', them, trec?.name ?? null);
    await this._sayParty(next, now);
    return null;
  }
}
