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
import { verifyToken, verifyOrder, importPublicKeyB64, MAX_TTL_S, ORDER_TTL_S, renownIssuable } from '../../src/net/identityToken.js';   // MOD1: and the mute order, checked with the same key
/** ACC1d/F8: the most spent signatures one room remembers. Every entry
 *  expires within MAX_TTL_S and the hello gate bounds how fast they can
 *  arrive, so honest traffic never comes near this; it is here so a
 *  flood cannot grow the map without end. */
const SPENT_MAX = 4096;
/** MOD1: the most accounts whose latest mute order one room remembers. */
const ORDERS_MAX = 1024;
/** GUILD1c: the most removals and disbandings one room remembers (`_guildOuts`). */
const GUILD_OUTS_MAX = 1024;
/** AUDIT MERGE-PLUS A3: where the room keeps its holds (`_guildOuts`) across a wake, and for how long one matters - a
 *  token's or an order's whole life past it, and twice the verifier's skew: after that nothing minted before the
 *  removal can still be carried in, and the roster (every later token) is the truth. */
const GUILD_OUTS_KEY = 'guildouts';
const GUILD_OUT_KEEP_S = MAX_TTL_S + ORDER_TTL_S + 60;

// ═══ WB3: THE GATE'S BOSS ROOM ═════════════════════════════════════
//
// Mac: "a gate of oblivion which takes place in a large boss arena with an oversized enemy with telegraphed attacks",
// and Option B - the relay's object is the authority over the boss. THREE FILES JOIN THE BUNDLE, paid for once in this
// deploy: net/gateLaw.js (the day's window and the room key - it imports wire.js alone), net/gateBrain.js (the fight,
// pure law - it imports nothing) and net/gateReceipt.js (the kill's receipt, the relay's first signature - it imports
// identityToken.js, already here). bible/11-Multiplayer/World-Bosses.md sections 5, 6 and 8.
import { isGateRoom, gateDayOfRoom, gateAdmits, gateHolds, gateTimes, gateBossOf, gateModsOf, GATE_COLLAPSE_MS, isGateDay } from '../../src/net/gateLaw.js';
import { riteNear, riteHeard, riteStands, cageStands, RITE_HELPERS_MAX } from '../../src/net/gateRite.js';   // WB12d: the faithful's rite; BROKER-CAGE: the Broker's cage, omen to midnight
import { isSiegeRoom, newFighter, isSiegeNpcId, siegeNpcFoe, siegeNpcPose, siegeNpcFell, siegeNpcInReach, siegeNpcProvoked, refereeBlow, refereeCast, refereeStep, siegeHeld, siegeNextWave, siegeRise, SIEGE_WAVE_MS, SIEGE_FIGHTERS_MAX, SIEGE_SPECTATORS_MAX, SIEGE_OPENS_MS, SIEGE_TICK_MS, siegeNextBeat, fieldOf, newBattle, battleStep, honoured, siegeCampPose, siegeFieldFrame, isBattleRoom, isRoyalRoom, battleOfRoom, royalAsk, royalAccept, royalMarks, royalMayStrike, royalStepOk, royalEnd, royalStep, royalLadder, royalNextBeat, ROYAL_RC_KEEP, siegePlaceFree, siegeReturn, royalPrune, worksOf, refereeWorkBlow, siegeWaveMs, siegeRamDown, siegeBreach, SIEGE_WORK_IDS, SIEGE_GATEHOUSE, SIEGE_RAM, siegeGroundOf, siegeOffGround, siegeStepLevel, royalLevel, SIEGE_HEIGHT_M } from '../../src/net/siegeRef.js';   // PVP-REF: a siege's referee - siegeRef.js imports nothing, so the worker's graph stays flat   // SEAT2a: and its battle   // AUDIT-SEATS T3/R5: a side's places, a fighter's return, a tourney's records   // SEAT2b part two (b): the works in battle
import { mintSiegeReceipt, SIEGE_RECEIPT_TTL_S, mintRoyalReceipt } from '../../src/net/siegeReceipt.js';   // SEAT2a: the relay's fourth signature - a fighter's result and Honours
import { newFight, joinFight, applyHit, applyCrystalHit, applyHostHit, applyHeal, stepBrain, stateOf, earned, earnedBy, COURT_CENTRE, BRAIN_TICK_MS, CHECKPOINT_MS, GATE_FIGHTERS_MAX } from '../../src/net/gateBrain.js';
import { mintReceipt, importReceiptKey, readReceipt, RECEIPT_TTL_S } from '../../src/net/gateReceipt.js';
// RAID3 (2026-09-27, Mac, on World Events - Raiding Parties online: "1. Server"): TWO FILES JOIN THE BUNDLE -
// net/raidLaw.js (a town raid's ledger, pure law - it imports nothing) and net/raidReceipt.js (a raid's receipt, the
// relay's second signature under the gate's one key - it imports identityToken.js and raidLaw.js, both here).
// bible/03-World/Raiding-Parties.md, "The relay holds the raid (RAID3)".
import { raidWordFits, raidWordSane, raidSig, raidLedgerId, raidEvictPick, newRaidLedger, foldRaidWord, raidCleansed, raidEarned, raidTop, raidLedgerState, raidLedgerEndMinute, raidDayOfKey, RAID_KEEP_MS, RAID_LEDGERS_MAX, RAID_LEDGERS_BY_MAX, RAID_SAVE_MS, RAID_DAY_MINUTES, RAID_ACCOUNTS_MAX, raidDaySlots, raidOnSlot, raidDayIds, readRaidTowns, raidTownsHash, RAID_TOWNS_SHA_RE } from '../../src/net/raidLaw.js';   // RAID-ROLL: the day's roll
import { mintRaidReceipt, readRaidReceipt } from '../../src/net/raidReceipt.js';
import { mintWatchReceipt, watchDue } from '../../src/net/watchReceipt.js';   // SEAT1b: the Watch's tick and its rhythm - the relay's third signature
// DISCORD-GATES (2026-09-28, Mac: "Discord live gates?" - the omen, 15 minutes before, pinging an opt-in role, and the
// boss slain): ONE FILE JOINS THE BUNDLE - net/gateHerald.js (the posts and when they are owed, pure law - it imports
// gateLaw.js and wire.js, both here). The hub posts off its own alarm; bible/11-Multiplayer/World-Bosses.md, "THE
// HERALD".
import { heraldWebhook, heraldRole, omenPost, fellPost, ritePost, heraldOmenDue, heraldFellLive, gateSiteDayOk, foldGateSite, agreedGateSite, HERALD_RETRY_MS, HERALD_TIMEOUT_MS } from '../../src/net/gateHerald.js';
// OW6L (2026-09-29, the product owner: "Everything needs that persistence between players in the overworld."): ONE FILE
// JOINS THE BUNDLE - net/overworldLaw.js (a cell's overworld ledger: the bands and raiders spent in it, its spawned
// dungeons' clocks - pure law; it imports wire.js, gateLaw.js and raidLaw.js, all three here already).
// ARENA4 (2026-10-02, Mac: "watch AI fights, player fights, join a team (red and blue) and climb esclating tiers of
// opponents, or choose to matchmake for a real opponent to take on in real time"): FOUR FILES JOIN THE BUNDLE -
// net/arenaLaw.js (the rooms, the season, the rating, the queue, the referee's numbers, the words both ways - it imports
// nothing), net/arenaBrain.js (one bout on the relay: the law, the referee, the ladder's AI fighters), the bout law it
// runs (systems/arenaBout.js - pure, and it reaches net/duelSession.js, which reaches wire.js) and net/arenaReceipt.js (a
// bout's receipt, the relay's third signature under the gate's one key). bible/11-Multiplayer/Arena.md "7. Online".
// ARENA4b (2026-10-03, Arena.md 2: "Exhibition - online: yes - the relay runs it, every client sees one bout"): ONE FILE
// JOINS THE BUNDLE - net/arenaExhibition.js (the hour's exhibition as law: the schedule, the pair, the bout's id - moved
// out of systems/arenaLadder.js, which hands it on; it imports arenaLaw.js, here already, and systems/wind.js's seeded
// die, which imports nothing) - and the hour's room `arena:x<hour>` stands beside the bouts'.
import {
  isArenaRoom, isArenaHall, arenaBoutRoom, arenaBoutIdOf, pairQueue, matchBand, arenaRatingOk, MATCH_ACCEPT_MS, MATCH_QUEUE_MAX,
  MATCH_REPAIR_MS, ARENA_TICK_MS, ARENA_KEEP_MS, ARENA_LIVE_MAX, ARENA_HALL,
  isArenaExhibitionRoom, arenaExhibitionHourOf, isArenaFloorRoom, ARENA_EX_KEEP_MS, ARENA_CL_MIN, ARENA_CL_MAX, bannerClaim,
} from '../../src/net/arenaLaw.js';
import { exhibitionOpening, exhibitionBoutId, exhibitionAdmits } from '../../src/net/arenaExhibition.js';
import {
  openBout, joinBout, leaveSeat, poseOf, refBlow, yieldOf, cheerOf, stepBout, fighterGone, stateWord, aiWords, hpWord, liveEntry, boutFinished, fighterOfSub,
} from '../../src/net/arenaBrain.js';
import { mintArenaReceipt } from '../../src/net/arenaReceipt.js';
import { owIdInCell, owRowInCell, owRowSane, owFoldSpent, owFoldRows, owRowsBehind, owPrune, owLedgerOf, owLedgerEmpty, toWelcome } from '../../src/net/overworldLaw.js';

import { roomOf, parseClient, inRange, poseGate, chatGate, redGate, dmGate, muteGate, tokenGate, rosterFor, badged, isChatRoom, isWorldRoom, isCellRoom, streamsFoes, hitOwnerOf, worldFrameMaxFor, CELL_FRAME_RECORDS_MAX, HELLO_HZ_MAX, CHAT_HELLO_HZ_MAX, CHAT_ROOM_HZ_MAX, SOCKETS_MAX, CHAT_SOCKETS_MAX, DROP_STRIKES_MAX, CHAT_STRIKES_MAX, WORLD_MIN_MS, WORLD_CHUNK, WORLD_TTL_MS, WORLD_PREFIX, FOES_PREFIX, OWN_PREFIX, foesGate, byteGate, FOES_ROOM_BYTES_PER_S, HIT_ROOM_HZ_MAX, ACT_ROOM_HZ_MAX, ACT_ROOM_BYTES_PER_S, actGate, MAX_FRAME_BYTES, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, HIT_ROOM_BYTES_PER_S, whoGate, whoIdOf, WHO_ROOM_HZ_MAX, poseFan, poseChanged, RELAY_VERSION, KEEPALIVE_FAN_MS, ACT_SENDER_BYTES_PER_S, CHAT_ROSTER_MAX, isSocialRoom, socialGate, partyGate, SOCIAL_ROOM_HZ_MAX, FRIENDS_MAX, PENDING_MAX, PARTY_MAX, PARTY_INVITES_MAX, INVITE_TTL_MS, PARTY_OFFLINE_MS, ACCOUNT_TABS_MAX, mintPartyId, SOCIAL_REPEAT_MS, ACCOUNT_IDLE_MS, ACCOUNT_SWEEP_MS, SWEEP_STEP_MS, SWEEP_PAGE, questShareGate, amapShareGate, AMAP_ROOM_HZ_MAX, QUEST_ROOM_HZ_MAX, QUEST_ROOM_BYTES_PER_S, QUEST_PREFIX, QUEST_FRAME_MAX, tradeGate, TRADE_ROOM_HZ_MAX, TRADE_ROOM_BYTES_PER_S, castGate, CAST_HZ_MAX, CAST_DEST_SENDERS_MAX, parkGate, parkKey, parkKeyOf, PARK_KEY_RE, parkRegistryRoom, cellRoomOfWire, PARK_INTERNAL_REG, PARK_INTERNAL_DROP, PARK_CELL_MAX, PARK_ACCOUNT_MAX, PARK_TTL_MS, PARK_REFRESH_MS, PARTY_CHAT_ROOM_HZ_MAX, rollGate, rollDice, cardGate, pageGate, duelGate, DUEL_HZ_MAX, renownGate, renownRoomGate, lookGate, eventGate, EVENT_KEY, validLiveEvent, gateGate, siegeGate, SIEGE_IN_MS, GATE_INTERNAL_FELL, SOCIAL_ROOM, validGateOut, HELLO_WAIT_MS, GATE_TELL_RETRY_MS, gateReceiptKey, GATE_BRAIN_MIN, GATE_HERE_HOLD_MS, guildGate, guildRoomGate, GUILD_CHAT_ROOM_HZ_MAX, SEAT_ELSEWHERE, raidGate, RAID_INTERNAL_CLEAN, RAID_INTERNAL_DAY, RAID_DAY_ASK_MS, raidTownsGate, RAID_TELL_RETRY_MS, RAID_CLEANS_MAX, RAID_LEDGER_PREFIX, raidLedgerKey, RAID_RC_PREFIX, raidReceiptKeyOf, RAID_RC_KEEP, RAID_RC_KEEP_MS, mapPixelOfWire, validRaidOut, worldRoom, sharedClassicMinutes, wallMsForClassicMinutes, isRegionRoom, travHubGate, travRoomGate, TRAV_STALE_MS, TRAV_WELCOME_MAX, owGate, owRoomGate, OW_LEDGER_KEY, REALM_DOOR_WORD, riteRelayGate, validRiteOut, sanitizeName, RITE_INTERNAL_BROKEN, RITE_INTERNAL_DAY, RITE_TELL_RETRY_MS, RITE_KEY, RITE_BY_MAX, RITE_CIRCLES_MAX, RITE_HUB_CIRCLES_MAX, RITE_ASK_EVERY_MS, RITE_ASK_TIMEOUT_MS, arenaGate } from './relay.js';

// AUDIT WORLD34 D4: the relay names itself in /health. SLAM13 (AUDIT SLAM A5): the name lives in net/wire.js, so the
// welcome can carry it; /health reads it through the import above. LOCALDEV1: it is NOT re-exported from this module -
// workerd (wrangler dev, 1.20260911) refuses a worker entry whose named export is a string ("Incorrect type for map
// entry 'RELAY_VERSION': the provided value is not of type 'function or ExportedHandler'"), so the local relay would
// not start at all. The production runtime let it through, which is why nothing caught it; the pins read wire.js.

/** DICE1: the relay's own dice - 32 uniform bits from the runtime's CSPRNG a draw (net/dice.js rollDice throws a draw
 *  back past the last whole multiple of the sides, so every face is exactly as likely). Workers carry `crypto`. */
const rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
/** WB3: the boss's dice - a [0,1) draw off the same CSPRNG (net/gateBrain.js takes its randomness as an argument). */
const rand01 = () => rand32() / 4294967296;
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
/** AUDIT WB12d (R1): the circles a day's record stands by - those at the gate's agreed site (net/gateHerald.js
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'daggerfall-online', version: RELAY_VERSION, t: Date.now() });
    const key = roomOf(url.pathname);
    if (!key || (key.startsWith('chat:') && !isChatRoom(key))) return json({ error: 'no such room' }, 404);   // AUDIT CHAT A1: no object is minted for a channel the port does not run
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
    if (String(request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') return json({ error: 'websocket only' }, 426);
    const id = env.ROOMS.idFromName(key);
    return env.ROOMS.get(id).fetch(request);
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
function fanOut(t, id, data, sentLength) {
  let out;
  try { out = JSON.stringify({ t, id, data }); } catch { return null; }
  return out.length > sentLength + id.length + 8 ? null : out;
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
    this._guildOutsLoad = null;   // AUDIT MERGE-PLUS A3: the storage read that fills it, once a wake
    this._roomGuild = null;   // GUILD1c: the room's budget for guild-tag fans (GUILD_ROOM_HZ_MAX)
    this._guildChat = null;   // GUILD1c: the hub's budget for guild lines (GUILD_CHAT_ROOM_HZ_MAX), apart from the room's and the parties'
    this._idx = null;   // ws -> attachment, read once (A7); rebuilt when the socket set changes
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
    // WB3: A GATE ROOM'S FIGHT (net/gateBrain.js), read from storage once per instance life and checkpointed every
    // CHECKPOINT_MS, so an eviction loses that much of it and not the fight; undefined = not read yet, null = none
    this._fight = undefined;
    this._fightSavedAt = 0;
    this._siege = undefined;   // PVP-REF: a siege room's fighters, by account (storage's `siege` after a wake)
    this._siegeSavedAt = 0;
    this._helloBy = new Map();   // AUDIT-SEATS R3: a battle room's hello buckets, by verified account (_battleHelloGate) - a wake forgets them, as the meters
    this._receiptKey = undefined;   // WB3: the relay's signing key (GATE_SIGNING_KEY), imported once; null = none (the receipts go out unsigned)
    this._gateFell = undefined;     // WB3: the hub's last word of a kill, said to a hello while its gate still holds
    this._event = undefined;        // EVENT1: the hub's live event, read once (_liveEvent) - undefined: not read yet
    this._raids = new Map();        // RAID3: a cell's raid ledgers read so far (net/raidLaw.js) - AUDIT RAID R1: its identity (key and signature) -> ledger|null; storage is the truth; R6: at most RAID_CACHE_MAX
    this._raidSavedAt = new Map();  // RAID3: when each ledger was last written (a word that moves nothing writes at most every RAID_SAVE_MS)
    this._raidCleaning = new Set(); // RAID3: the raids whose cleanse is being minted - a word that lands meanwhile is not heard (an input gate holds for storage alone, and the mint awaits crypto)
    this._raidSlots = new Map();    // RAID-ROLL: a cell's copy of each day's slots (net/raidLaw.js raidDaySlots) - a few days at most
    this._raidDays = new Map();     // RAID-ROLL: a cell's copy of each day's whole roll from the hub - day -> { ids: Set|null, at }
    this._raidTownsKept = undefined; // RAID-ROLL: the hub's towns table - undefined unread, null none kept, else the regions
    this._raidDayRolls = new Map(); // RAID-ROLL: the hub's day -> [raid identity] off the kept table - a few days at most
    this._raidTownsUp = new Map();  // RAID-ROLL: the hub's table pieces in flight, a socket's - ws -> { n, parts }
    this._raidCleans = undefined;   // RAID3: the hub's cleansed raids ([key, at, sig] - AUDIT RAID R1), read once - undefined: not read yet
    this._owLoad = null;            // OW6L: a cell's overworld ledger (net/overworldLaw.js) - the one storage read an instance life, its promise shared by every word and hello that lands while it runs; storage is the truth, written at every change
    this._roomOw = null;            // OW6L: a cell's budget for fanning its ledger's changes (OW_ROOM_HZ_MAX) - on the instance, as the chat's is
    this._herald = undefined;       // DISCORD-GATES: the hub's door to Discord ({hook, role}), read once - undefined: not read yet, null: none (no posts)
    this._gateSiteRec = undefined;  // DISCORD-GATES: the hub's record of where the gate stands, as accounts said it (net/gateHerald.js foldGateSite) - undefined: not read yet
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
    if (path === RAID_INTERNAL_CLEAN) return this._raidCleanInternal(request);   // RAID3: a raid's cleanse, said to the hub
    if (path === RAID_INTERNAL_DAY) return this._raidDayInternal(request);   // RAID-ROLL: a cell asking the hub for the day's roll
    if (path === RITE_INTERNAL_BROKEN) return this._riteBrokenInternal(request);   // WB12d: a circle's rite broken, said to the hub
    if (path === RITE_INTERNAL_DAY) return this._riteDayInternal(request);   // WB12d: a breach's room asking the hub for the rite's helpers
    if (path === ARENA_INTERNAL_OPEN) return this._arenaOpenInternal(request);   // ARENA4: the hall opening a matched bout's room
    if (path === ARENA_INTERNAL_LIVE) return this._arenaLiveInternal(request);   // ARENA4: a bout telling the hall it stands (or is done)
    const key = roomOf(new URL(request.url).pathname);
    // AUDIT WB A1: A SEAT IS A HELLO'S. A socket that opened and never said hello kept its seat for as long as it stood
    // open, so one page's loop could fill a room with silence and every player after it was refused 'room full' - a
    // gate's court included, for its whole day. Each socket is stamped as it opens; a full room first closes the silent
    // ones past HELLO_WAIT_MS (busy - a real client retries), and is full only if it still is.
    const cap = isChatRoom(key) ? CHAT_SOCKETS_MAX : SOCKETS_MAX;
    if (this.state.getWebSockets().length >= cap) { this._unseatSilent(Date.now()); if (this.state.getWebSockets().length >= cap) return json({ error: 'room full' }, 503); }   // the runtime drops a socket the object closed from the list at once (AUDIT WORLD34 D1)
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // hibernation API: the object may sleep between messages; every
    // socket carries its own state in the attachment - the room's key
    // included - and the look sits in storage under the id (its meters
    // are the instance's: AUDIT ATTACH)
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ key, id: null, name: null, pose: null, at: Date.now() });   // AUDIT WB A1: when it opened
    this._idx = null;
    return new Response(null, { status: 101, webSocket: client });
  }
  /** AUDIT WB A1: every socket past HELLO_WAIT_MS with no hello closed, busy (a slow client retries and says it); a socket
   *  from before the stamp (an older build's, awake across a deploy) counts from now. */
  _unseatSilent(now) {
    for (const [ws, a] of [...this._all()]) {
      if (a.id || a.replaced || this._dead.has(ws)) continue;
      if (!Number.isFinite(a.at)) { this._setAttach(ws, { ...a, at: now }); continue; }
      if (now - a.at < HELLO_WAIT_MS) continue;
      this._forget(ws);
      try { ws.close(CLOSE_BUSY, 'no hello'); } catch { /* gone */ }
      this._dead.add(ws);
    }
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
  /** ONE-SEAT: the hello'd sockets of another TAB of the verified account `sub` - not `ws`, and not a socket of the
   *  same peer id (the tab's own old socket, which a reconnect replaces). By the verified subject, never the hub's
   *  browser-profile account: a phone and a desk signed in as one player are one player. AUDIT ONESEAT R4: and never
   *  a socket this object already closed (a runtime may list it until the close completes), or the tab that took
   *  the seat would find the one it closed still holding it, and its own reconnect refused. */
  _otherTabsOf(sub, ws, id) {
    const out = [];
    for (const [other, b] of this._all()) if (other !== ws && b.id && b.id !== id && b.sub === sub && !this._dead.has(other) && !this._gone.has(other)) out.push(other);
    return out;
  }
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
    return this._metered(ws, a, pass, patch, passPatch);
  }
  /** AUDIT-SEATS R2: the meter's write, its gate already spent (`pass`) - a battle room's pose spends the gate BEFORE the
   *  referee judges it (the pose arm's note), and is written here only once judged. */
  _metered(ws, a, pass, patch = {}, passPatch = {}) {
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
      for (const [other, b] of [...this._all()]) if (b.id && b.id !== id) this._send(other, out);
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
    if (await this.state.storage.get('hub')) { await this._sweepHub(Date.now()); await this._heraldBeat(Date.now()); return; }   // AUDIT SOC A3: the hub's alarm is its sweep, whoever is in the room; DISCORD-GATES: and its herald's posts
    // AUDIT 68 X8-park-registry-unbounded: an owner's registry (HCC-PARK) is one object per account and character a
    // client names - its word goes PARK_TTL_MS after it was said, as the cell's record it points at does
    const reg = await this.state.storage.get('reg');
    if (reg) { const due = reg.at + PARK_TTL_MS; if (Date.now() >= due) await this.state.storage.delete('reg'); else await this.state.storage.setAlarm(due); return; }
    if (await this._gateTick()) return;   // WB3: a gate room's alarm is its boss's beat
    if (await this._siegeTick()) return;   // PVP-REF: a siege room's alarm is its fallen fighters' waves
    if (await this._arenaTick()) return;   // ARENA4: a bout's beat, or the hall's queue
    const riteDue = await this._riteTellHub(Date.now());   // WB12d: a broken rite its hub has not heard (AUDIT BROKER-CAGE R4: not riteOwed - that is the circle's own test)
    if (await this._raidSweep(Date.now())) { if (riteDue) await this._riteArm(Date.now() + RITE_TELL_RETRY_MS); return; }   // RAID3: a cell's alarm is its raids' ends, and a cleanse its hub has not heard - never past the rite's retry
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
    const cur = (await this.state.storage.get(['sweep:acct', 'sweep:party', 'sweep:gaterc', 'sweep:raidrc']));   // AUDIT WBX2 M9: one read
    const acur = cur.get('sweep:acct') ?? null, pcur = cur.get('sweep:party') ?? null, gcur = cur.get('sweep:gaterc') ?? null, rcur = cur.get('sweep:raidrc') ?? null;
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
    // AUDIT WBX R8: an expired receipt kept for an account that never came back goes too - it was forgotten only by
    // that account's own next hello
    const kept = await this.state.storage.list({ prefix: 'gaterc:', limit: SWEEP_PAGE, ...(gcur ? { startAfter: gcur } : {}) });
    let glast = null;
    for (const [k, r] of kept) { glast = k; if (!r || typeof r !== 'object' || !(Number.isFinite(r.e) && now < r.e * 1000)) dead.push(k); }
    // AUDIT RAID R2: and an account's raid receipts once none is still kept for its hello
    const rcs = await this.state.storage.list({ prefix: RAID_RC_PREFIX, limit: SWEEP_PAGE, ...(rcur ? { startAfter: rcur } : {}) });
    let rlast = null;
    for (const [k, v] of rcs) { rlast = k; if (!raidRcLive(v, now).length) dead.push(k); }
    for (let i = 0; i < dead.length; i += SWEEP_PAGE) await this.state.storage.delete(dead.slice(i, i + SWEEP_PAGE));
    const more = accts.size >= SWEEP_PAGE || parties.size >= SWEEP_PAGE || kept.size >= SWEEP_PAGE || rcs.size >= SWEEP_PAGE;
    await this.state.storage.put({ 'sweep:acct': accts.size >= SWEEP_PAGE ? alast : null, 'sweep:party': parties.size >= SWEEP_PAGE ? plast : null, 'sweep:gaterc': kept.size >= SWEEP_PAGE ? glast : null, 'sweep:raidrc': rcs.size >= SWEEP_PAGE ? rlast : null });
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
    if (c.gi) await this._loadGuildOuts(nowS);   // AUDIT MERGE-PLUS A3: the holds a wake left in storage
    const guild = c.gi && !this._guildOutAfter(c.gi, c.gm, c.i) ? { gi: c.gi, gt: c.gt, gm: c.gm } : {};
    // WB9g: and the aura at their feet - `au`, the one the token signed for (stamped by `badged` beside the title)
    // SEAT1c: `ts`, a seat title's claim; GLYPH-WEAR: `gx`, the glyphs taken off - `badged` leaves them out of every row, `glyphs` stays whole for the rights
    return { name: c.n, kind: c.k, subject: c.s, title: c.t, ts: c.ts, glyphs: c.g, gx: c.gx, au: c.au, rb: c.rb, mu, lv: c.lv, ...guild, gio: c.i, ar: c.ar, cl: c.cl };   // ARENA4: the season's rating, the hall's queue's   // ARENA4b: `cl` the character's level, a ladder fighter's vitality's
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
    if (m.t === 'hello') {
      const now = Date.now();
      const chat = isChatRoom(a.key);
      // AUDIT-SEATS R3: A BATTLE'S DOOR IS NEVER SHUT BY A STRANGER. The room's hello gate below was spent BEFORE the token
      // was read, so twelve tokenless hellos a second made the next real attacker's hello 'busy' - held from ten minutes
      // before the start to ten after it, a forfeit nobody fought. A siege's or a Royal Tourney's room spends its gate only
      // once the token AND the pass are verified (`_battleHelloGate`, below), by account: a hello refused for either
      // touches no bucket.
      const battle = isBattleRoom(a.key);
      let gate = null;
      if (!battle) {
        // the room's hello gate (A6): a storm is 2N frames a cycle for everyone in a place; a channel's hello costs no roster, so its gate runs deeper - never off (AUDIT CHAT A1)
        gate = tokenGate(await this.state.storage.get('hellos'), now, chat ? CHAT_HELLO_HZ_MAX : HELLO_HZ_MAX);
        await this.state.storage.put('hellos', gate.bucket);
        if (!gate.pass) { this._refuse(ws, 'busy', CLOSE_BUSY); return; }
      }
      // ACC1d: the name this socket will wear, and whether the relay vouches for it. AUDIT 68 S01-hello-writes-before-token:
      // asked BEFORE anything is written or replaced (the id's secret, its look, a live holder of the id, the
      // attachment), so a refused hello leaves nothing behind - a tokenless one planted a secret that refused the owner
      const who = await this._named(m, now);
      if (who.error) { this._refuse(ws, who.error); return; }
      // WB3: A GATE'S ROOM ADMITS ONLY INSIDE ITS DAY'S WINDOW, asked before anything is written (the token's law just
      // above): a newcomer while the gate is open and its boss stands, a fighter already in the fight (a reconnect, a
      // player cast out and back) until the wrath's end. The Worker refused the key outside the window already; this is
      // the object's own word, for a socket that opened a moment before the seal.
      if (isGateRoom(a.key)) { const no = await this._gateAdmit(a.key, who.subject, now); if (no) { this._refuse(ws, no); return; } }
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
        if (isSocialRoom(a.key) && b.acct && b.acct !== (m.acct ? (who.subject || m.acct) : null)) { try { await this._leaveAccount(other, b, now); } catch (e) { console.warn('[hub] replaced leave failed', e?.message ?? e); } }
      }
      // AUDIT WB A1: ONE SEAT AN ACCOUNT in a gate's court. The fight is the account's (net/gateBrain.js - its players by
      // account, the newest socket speaking for it), so a second socket is never a second fighter, only a seat the court
      // cannot give anyone else: the older goes, replaced, its leave said.
      if ((isGateRoom(a.key) || isBattleRoom(a.key)) && who.subject) for (const [other, b] of [...this._all()]) if (other !== ws && b.id && b.sub === who.subject) this._refuse(other, 'replaced', CLOSE_REPLACED);   // PVP-REF: and a siege's field, one fighter an account
      // ONE-SEAT: A CLAIM TAKES THE SEAT - every other tab of this account in the hub is closed, the reason said first,
      // and its client leaves every room it holds (net/online.js `superseded`). Their leaves are said at the reap, as
      // every close this object makes is (AUDIT WORLD34 D1).
      if (m.cl) for (const other of seatHeld) this._refuse(other, SEAT_ELSEWHERE, CLOSE_REPLACED);
      const others = [];
      // AUDIT DEEP2 C (ONE-SEAT R4's rule): never a socket this object closed or whose leave is said - the runtime may
      // list it until its close completes, and a joiner handed its mark held a ghost for TRAV_STALE_MS
      for (const [other, b] of this._all()) if (other !== ws && b.id && !this._dead.has(other) && !this._gone.has(other)) others.push(b);
      // AUDIT ONESEAT R1: A SEAT THAT MOVED IS NOT A DRAIN. Nobody else here is an empty room only when nobody's seat
      // carried over - a claim that closed the account's other tabs, or a reconnect that replaced its own old socket,
      // moved a seat the room never lost, and the sweep below took every party in the hub with it (a stranger's too)
      const carried = !!replaced || (!!m.cl && seatHeld.length > 0);
      if (!others.length && !carried) { try { await this._sweep(); } catch (e) { console.warn('[room] sweep failed', e?.message ?? e); } if (gate.bucket) await this.state.storage.put('hellos', gate.bucket); }   // AUDIT-SEATS R3: a battle room's fighter spent no stored bucket   // an empty room forgets every look and secret an unclean close left behind - not its hello gate (AUDIT SOC A2: contained - a failed list here made every first hello into an empty hub throw before its welcome)
      await this.state.storage.put(secretKey(m.id), m.secret);
      if (!chat) { await this.state.storage.put(lookKey(m.id), m.look); this._looks.set(m.id, m.look); }   // a channel keeps no look: nobody is drawn from it
      const guild = who.gi ? { gi: who.gi, gt: who.gt, gm: who.gm } : {};   // GUILD1c: the guild the token carried, when it carried one
      const arena = isArenaRoom(a.key) ? { ar: arenaRatingOk(who.ar), lk: who.kind === 'linked' ? 1 : 0, ...(Number.isSafeInteger(who.cl) && who.cl >= ARENA_CL_MIN && who.cl <= ARENA_CL_MAX ? { cl: who.cl } : {}) } : {};   // ARENA4: the hall queues by the signed rating, and a guest is queued for no rated bout   // ARENA4b: and a ladder bout's vitality is the signed character level's (`cl` - absent from a service before it)
      if (!this._setAttach(ws, { ...a, id: m.id, name: who.name, title: who.title, ...(who.ts ? { ts: who.ts } : {}), glyphs: who.glyphs, gx: who.gx, au: who.au, ...(who.rb ? { rb: who.rb } : {}), lv: who.lv, ...guild, gio: who.gio, sub: who.subject, ...(siegeSide ? { sd: siegeSide } : {}), mu: who.mu, pose: chat ? null : m.pose, since: replaced?.since ?? now, ...arena })) { this._refuse(ws, 'hello too large'); return; }   // MOD1: `sub` the verified account (what a mute names), `mu` until when it may not talk   // RENOWN1: `lv` the Renown level the token carried
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
        // TV3: a region's channel says where its travellers are - the fresh marks on the other sockets' attachments,
        // badged as the roster is, cut at TRAV_WELCOME_MAX; no field is no traveller (an old client reads none)
        // AUDIT DEEP T3-6: each with its AGE (`ag`, whole seconds) - a joiner stamps it that old, so a mark four minutes
        // stale here is not five minutes fresh there
        const tr = isRegionRoom(a.key) ? others.filter((b) => b.tm && now - b.tm.at <= TRAV_STALE_MS).slice(0, TRAV_WELCOME_MAX).map((b) => { const p = { ...b.tm }; delete p.at; return badged({ id: b.id, name: b.name, sub: b.sub, p, ag: Math.max(0, Math.floor((now - b.tm.at) / 1000)) }, b); }) : [];
        if (!this._send(ws, JSON.stringify({ t: 'welcome', id: m.id, peers: named, n: others.length + 1, v: RELAY_VERSION, now: Date.now(), ...(ev ? { ev } : {}), ...(tr.length ? { tr } : {}) }))) return;   // AUDIT SOC B7: the relay's clock rides the channel's welcome too (WORLD5's `now`), so the hub link reads last-seen and an invite's lapse on the relay's time without waiting on the presence session's welcome
        const said = JSON.stringify(badged({ t: 'join', id: m.id, name: who.name, sub: who.subject }, who));
        for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, said);
        // SOC1: the account, in the hub - after the welcome and the join, so a client's session has reset on the
        // welcome before its picture lands; a hello naming none is a build before this slice, admitted as it was
        if (isSocialRoom(a.key) && m.acct) { try { await this._helloAccount(ws, m, now); } catch (e) { console.warn('[hub] account hello failed', e?.message ?? e); } }   // AUDIT SOC A2: contained, as the acts and the leave are
        // WB3: a gate's kill said while this player was away, while that gate still stands - so it collapses on their screen too
        if (isSocialRoom(a.key)) { try { const g = await this._gateFellOf(); if (g && gateHolds(g.d, now)) this._send(ws, JSON.stringify({ t: 'gate', ...g })); } catch (e) { console.warn('[hub] gate word failed', e?.message ?? e); } }
        // AUDIT WB A4: and this account's receipt, while it is good (spent, it goes)
        if (isSocialRoom(a.key) && who.subject) { try { await this._gateReceiptTo(ws, who.subject, now); } catch (e) { console.warn('[hub] gate receipt failed', e?.message ?? e); } }
        // WB12d: the faithful's rite broken while this player was away, while its circle still stands
        // BROKER-CAGE: and its faithful every one fallen - the Broker's cage open - until the Wrath's midnight (cageStands: a
        // Warden fallen early takes the circle, never her)
        if (isSocialRoom(a.key)) {
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
        if (isSocialRoom(a.key)) { try { const l = await this._raidCleansOf(now); if (l.length) this._send(ws, JSON.stringify({ t: 'raid', k: 'cls', l })); } catch (e) { console.warn('[hub] raid word failed', e?.message ?? e); } }
        // AUDIT RAID R2: and this account's raid receipts the hub holds - an earner who was not in the town's cell at the
        // cleanse, or whose link dropped at it, is handed them here (the account service counts each once)
        if (isSocialRoom(a.key) && who.subject) { try { await this._raidReceiptsTo(ws, who.subject, now); } catch (e) { console.warn('[hub] raid receipts failed', e?.message ?? e); } }
        // RAID-ROLL: and, while the hub holds no towns table its operator pinned, the ask for one by its hash - any
        // client whose own table hashes to it hands it over (the relay never holds the game's files)
        if (isSocialRoom(a.key)) { try { const h = await this._raidTownsWanted(); if (h) this._send(ws, JSON.stringify({ t: 'raid', k: 'tw', h })); } catch (e) { console.warn('[hub] raid towns ask failed', e?.message ?? e); } }
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
      // ARENA4: A BOUT'S ROOM DRAWS ITS FIGHTERS ALONE - a spectator has no body (Seats-Arc 6.6), so the roster is the
      // sockets on the sand, and a hello's join is said when its `in` puts it there (_boutWord), never here
      // ARENA4b: the hour's exhibition's too - its sand is the relay's two, so its roster is nobody
      if (isArenaFloorRoom(a.key)) for (let i = others.length - 1; i >= 0; i--) if (!others[i].af) others.splice(i, 1);
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
      const welcome = `{"t":"welcome","id":${JSON.stringify(m.id)},"peers":${JSON.stringify(roster)},"host":${JSON.stringify(host)}${ow},"world":${world ?? 'null'},"now":${Date.now()},"v":${JSON.stringify(RELAY_VERSION)}}`;
      if (!this._send(ws, welcome)) return;
      // HCC-PARK: the cell's parked teams, after the welcome that resets the joiner's session (a halo's hello included)
      // AUDIT HCC-PARK (client C3): ALWAYS, an empty list included - a reconnect's welcome is the whole truth, and a
      // team taken up while this socket was away must go; never the joiner's own account's records (D2)
      if (isCellRoom(a.key)) {
        const now = Date.now(), sub = this._attach(ws)?.sub;
        const parks = (await this._parkList(now)).filter((e) => e.sub !== sub).map((e) => this._parkPublic(e));
        if (!this._send(ws, JSON.stringify({ t: 'parks', now, data: parks }))) return;
      }
      if (isArenaFloorRoom(a.key)) return;   // ARENA4: said at the `in`, for a fighter alone (ARENA4b: an exhibition has none)
      const join = JSON.stringify(badged({ t: 'join', id: m.id, name: who.name, look: m.look, pose: this._drawn({ sub: who.subject, pose: m.pose }, a.key).pose }, who));   // AUDIT-SEATS T2: and a spectator's join stands it nowhere
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
      const out = fanOut('foes', a.id, m.data, message.length);   // AUDIT (pre-merge) O3/O4
      if (out == null) { this._junk(ws); return; }
      for (const [other] of listeners) this._send(other, out);
      return;
    }
    if (m.t === 'own') {
      // OWN1: a socket's OWN foes in a world room - fanned as a cell's foes frame is (every other hello'd socket, the
      // room's own budget, at most CELL_FRAME_RECORDS_MAX records), beside the host's stream; the relay reads none of it
      const now = Date.now();
      if (doored !== 'own') { if (!isWorldRoom(a.key)) { this._junk(ws); return; } a = this._meterFoes(ws, a, now); if (!a) return; }
      if (!Array.isArray(m.data.f) || m.data.f.length > CELL_FRAME_RECORDS_MAX) { this._junk(ws); return; }
      const listeners = [...this._all()].filter(([other, b]) => other !== ws && b.id);
      const budget = byteGate(this._roomOwn, now, (message.length + a.id.length + 8) * listeners.length, FOES_ROOM_BYTES_PER_S);
      this._roomOwn = budget.bucket;
      if (!budget.pass || !listeners.length) return;
      const out = fanOut('own', a.id, m.data, message.length);   // AUDIT (pre-merge) O3/O4
      if (out == null) { this._junk(ws); return; }
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
      // OWN1: in a world room a blow on a socket's OWN foe (the frame marked `own`) goes to its owner as a cell's does
      const owned = cell || m.data.own === 1;
      const host = owned ? hitOwnerOf(m.data) : this._hostOf();
      if (!host || host === a.id) return;
      // AUDIT WORLD6b A1: the ROUTE is resolved before anything is spent - a `to` that names no socket in the room (a
      // peer gone, or a name a hostile client made up) delivers nothing, buys nothing, and is counted as junk (AUDIT
      // WORLD2 A4's instrument), so a stream of them is struck out; a world room's host is always a socket
      const target = [...this._all()].find(([other, b]) => other !== ws && b.id === host) ?? null;
      if (!target) { if (owned) this._junk(ws); return; }
      // A6: the funnel onto the destination's ONE socket - all strikers together, HIT_ROOM_HZ_MAX a second; over it
      // the blow is dropped and nobody struck. AUDIT WORLD6b A1/A2: the budget is the DESTINATION's (its own bucket,
      // among its meters), not the room's - in a cell the blows go to many owners, and one room-wide bucket let six
      // honest fights, or one stream of unroutable blows, silence every other blow in the country
      const [tws] = target;
      const tm = this._meterOf(tws);
      const funnel = tokenGate(tm.hbucket ?? null, now, HIT_ROOM_HZ_MAX);
      tm.hbucket = funnel.bucket;
      if (!funnel.pass) return;
      const out = fanOut('hit', a.id, m.data, message.length);   // AUDIT (pre-merge) O4: a nesting stringify cannot take, junk - it threw out of the handler
      if (out == null) { this._junk(ws); return; }
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
    if (m.t === 'gate') {
      // WB3: A WORD TO A GATE'S BOSS ROOM - the level claim on entering or a blow on the boss. On its own bucket (the
      // same strikes), in a gate room alone (anywhere else junk: a correct client sends none there), credited to the
      // VERIFIED account (`sub`, off the token - never a word of the frame's). The brain judges every blow
      // (net/gateBrain.js applyHit): the relay reads the damage a client claims and believes as much of it as the
      // claimed level's bucket allows, from where the socket's own pose stands.
      const now = Date.now();
      if (!this._spend(ws, now, gateGate, 'gateBucket', 'gateDrops', 'too many gate frames')) return;
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
      try { await this._gateFrame(ws, a, m, now); } catch (e) { console.warn('[gate] frame failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'siege') {
      // PVP-REF: A WORD TO A SIEGE'S ROOM - a fighter's `in`, a blow, a cast - on its own bucket, in a siege's room alone
      // (anywhere else junk), from a VERIFIED account (`sub`, off the token); the referee (net/siegeRef.js) judges it
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
        else if (isArenaFloorRoom(a.key)) await this._boutWord(ws, a, m, now);   // ARENA4b: a bout's room or the hour's exhibition's
        else this._junk(ws);
      } catch (e) { console.warn('[arena] word failed', e?.message ?? e); }
      return;
    }
    if (m.t === 'raid') {
      // RAID3: A WORD ON A TOWN'S RAID - from a player standing in the raided town, to the town's CELL, whose object keeps
      // the raid's ledger (net/raidLaw.js). On its own bucket (the same strikes), in a cell alone (anywhere else junk: a
      // correct client says none there), credited to the VERIFIED account (`sub`, off the token - never the frame's word)
      const now = Date.now();
      if (!this._spend(ws, now, raidGate, 'raidBucket', 'raidDrops', 'too many raid frames')) return;
      if (!isCellRoom(a.key)) { this._junk(ws); return; }
      try { await this._raidWord(ws, a, m, now); } catch (e) { console.warn('[raid] word failed', e?.message ?? e); }
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
      // first saw or cleared (net/overworldLaw.js) - to the cell it stands in, whose object keeps the ledger. On its own
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
      const gate = battleGate ?? tokenGate(await this.state.storage.get('hellos'), now, HELLO_HZ_MAX);
      if (!battleGate) await this.state.storage.put('hellos', gate.bucket);
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
      if (!this._setAttach(ws, m.p ? { ...rest, tm: { ...m.p, at: now } } : rest)) return;
      // AUDIT TV C2: A CLEAR IS SAID (AUDIT DEEP2 C2: at once, or owed below). A mark over the budget is kept and the next refresh carries it; a clear has no
      // next - the client holds nothing to refresh - so a dropped one left the player standing on every screen in the
      // room for TRAV_STALE_MS. AUDIT DEEP T3-2: on its OWN budget, so a room's marks never spend it (nor it theirs).
      const clear = !m.p;
      if (!clear) this._travOwed.delete(a.id);   // a new mark says where they are - the owed clear is moot
      const room = travRoomGate(clear ? this._travClearFan : this._travFan, now);
      if (clear) this._travClearFan = room.bucket; else this._travFan = room.bucket;
      const out = JSON.stringify(badged({ t: 'trav', id: a.id, name: a.name, sub: a.sub, p: m.p ?? null }, a));
      // AUDIT DEEP2 C2: A CLEAR OVER THE BUDGET IS OWED, not lost - the attachment's mark is gone and the client holds
      // nothing to send again, so a dropped one left the player drawn for TRAV_STALE_MS; it is said on the budget's next
      // pass (the room's next traveller frame - a room over the budget has them every moment)
      if (!room.pass) { if (clear) this._oweTravClear(a.id, out); return; }
      for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, out);
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
      if (isBattleRoom(a.key)) await this._siegeOf();   // AUDIT-SEATS T2: who is a body there, read before the answer
      this._send(ws, JSON.stringify(badged({ t: 'join', id: b.id, name: b.name, look, pose: inRange(a.key ?? '', a.pose, b.pose) ? (this._drawn(b, a.key).pose ?? null) : null }, b)));
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
      const turned = posed ? { turn: ((a.turn | 0) + 1) & 0xffff, ...(still ? { kept: now } : {}) } : {};
      const met = battle ? this._metered(ws, a, true, { pose: m.p }, turned) : this._meter(ws, a, now, { pose: posed ? m.p : a.pose }, turned);
      if (!met) return;   // over the rate: kept as the latest, not relayed
      if (m.t === 'ping') { this._send(ws, '{"t":"pong"}'); return; }   // a ping that reached the object (the runtime answers the exact one in its sleep)
      if (chat) return;   // a channel is no place: a pose there is kept by no one and reaches no one
      // AUDIT-SEATS T2 (Seats-Arc 6.6: "no body drawn to fighters, no collider, excluded from every banner count, a free
      // camera over the town"): A SPECTATOR IS NO BODY - in a battle room a socket that is no fighter (a spectator's pass,
      // or a fighter's before its `in`) keeps its camera on its own attachment and is drawn to nobody: the fan below said
      // its every pose, and the fighters drew sixty spectators among them
      if (step === 'eye') return;
      // ARENA4: a bout's room - a fighter's pose is the referee's (its speed checked, its place the reach's), and a
      // spectator's reaches nobody: the stands have no bodies
      if (isArenaFloorRoom(a.key) && m.t === 'pose') {   // ARENA4b: in an exhibition's room no socket is ever on the sand
        const cur = this._attach(ws);
        if (!cur.af) return;
        try { const st = await this._boutOf(); if (st && cur.afid) poseOf(st, cur.afid, m.p.x, m.p.z, now); } catch (e) { console.warn('[arena] pose', e?.message ?? e); }
      }
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
      // SEAT1b (Seats-Arc 4.2): THE WATCH - a verified account standing in a cell, having moved, is ticked every
      // WATCH_TICK_MS with a receipt only the account service counts, and only in a seat's own pixel (net/watchReceipt.js)
      // AUDIT-SEATS R7: in the pose's OWN cell alone - every cell room ticked whatever pixel the pose claimed, a halo's too
      // (the client keeps a halo's `watch` for nothing - net/online.js: "the relay ticks the socket that stands there,
      // never a halo's"), so one player stood in up to four rooms each minting its k1 receipts
      if (isCellRoom(a.key) && cellRoomOfWire(m.p.x, m.p.z) === a.key && typeof met.sub === 'string' && met.sub) await this._watchTick(ws, met.sub, m.p, !unmoved, now);
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
    this._travOwed.delete(a.id);   // AUDIT DEEP2 C2: the leave takes the mark out - an owed clear of it is said
    if (!isChatRoom(a.key) && this._leads(a, ws)) this._sayHost({ skip: ws, except: ws });   // WORLD1: the host left - the next-longest in the room is the host now, said to everyone (ROSTER-G: a channel has no host)
    if (isBattleRoom(a.key) && a.sub) { try { await this._siegeGone(ws, a.sub, Date.now()); } catch (e) { console.warn('[siege] leave failed', e?.message ?? e); } }   // AUDIT-SEATS T3: a fighter's place kept from now
    if (isSocialRoom(a.key) && a.acct) { try { await this._leaveAccount(ws, a, Date.now()); } catch (e) { console.warn('[hub] leave failed', e?.message ?? e); } }   // SOC1: last seen stamped, the friends and the party told
    if (isArenaRoom(a.key) && a.sub) { try { await this._arenaLeave(ws, a, Date.now()); } catch (e) { console.warn('[arena] leave failed', e?.message ?? e); } }   // ARENA4: out of the queue, off the sand, out of the stands
  }


  // ───────────────────────────── ARENA4: THE ARENA ─────────────────────────────
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
    try { const res = await rooms.get(rooms.idFromName(key)).fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body) })); return !!res?.ok; }
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
   *  (net/arenaLaw.js bannerClaim): the token signs no banner, and the pennant is cosmetic only - a banner's points are
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
        // is the account service's signed number"; net/arenaLaw.js pvpVitality reads it), never the word's: the word's `lv`
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
    const outs = words.map((w) => JSON.stringify({ t: 'arena', ...w }));
    for (const [ws, b] of [...this._all()]) if (b.id && (b.af || b.asp)) for (const s of outs) if (!this._send(ws, s)) break;
  }
  /** The whole bout to every socket on its sand or in its stands - each with its own fighter id, '' in the stands. */
  _boutFanState(st) { for (const [ws, b] of [...this._all()]) if (b.id && (b.af || b.asp)) this._arenaSend(ws, stateWord(st, b.afid ?? '')); }
  /** The hall told of this bout - its entry, or done. */
  async _boutTellHall(st, done = false) {
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
      if (!st && exRoom) {
        // ARENA4b: THE HOUR'S EXHIBITION IS OPENED BY ITS FIRST WATCHER - inside its window on the shared clock (the hour's
        // own, the gates open, its first EXHIBITION_START_MINUTES: net/arenaExhibition.js exhibitionOpening), the hour's
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
        // (net/arenaLaw.js ladderVitality - AUDIT PRE-MERGE 1003 S2: the signed level held to the same cap)
        if (m.r !== 'f' || m.tier === undefined) { this._arenaSend(ws, { k: 'no', m: 'no bout' }); return; }
        st = this._bout = openBout({ o: arenaBoutIdOf(a.key), kind: 'pve', f: [{ sub: a.sub, name: a.name, lv: m.lv ?? a.lv ?? 1, cl: a.cl ?? null, title: a.title ?? null, banner: m.b ?? null }], tier: m.tier, bout: m.bout, now });   // ARENA4b: `banner` the word's claim, billed on the list to watch
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
      const j = m.r === 's' && cur.asp && !fighterOfSub(st, a.sub) ? { role: 's' } : joinBout(st, a.sub, m.r, now);
      if (j.no) { this._arenaSend(ws, { k: 'no', m: j.no }); return; }
      if (j.role === 'f') {
        this._setAttach(ws, { ...cur, af: 1, afid: j.id, asp: 0 });
        // the fighter comes onto the sand: its body said to the room now (the hello said nothing)
        const look = this._looks.get(cur.id) ?? (await this.state.storage.get(lookKey(cur.id))) ?? null;
        const join = JSON.stringify(badged({ t: 'join', id: cur.id, name: cur.name, look, pose: cur.pose }, cur));
        if (!cur.af) for (const [other, b] of [...this._all()]) if (other !== ws && b.id) this._send(other, join);
        if (cur.pose) poseOf(st, j.id, cur.pose.x, cur.pose.z, now);
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
      await this._boutSave(now, true);
      if (!boutFinished(st)) await this._boutArm(now);
      return;
    }
    if (!st) { this._junk(ws); return; }
    const cur = this._attach(ws);
    if (m.k === 'hit') {
      if (!cur.af || !cur.afid) { this._junk(ws); return; }
      // the striker's place is its last good pose, as its pose frames said it (_message's pose arm) - never re-stamped
      // here, or a stale place would read as fresh and the next real move as a run too fast to believe
      const r = refBlow(st, cur.afid, m, now);
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
    const st = await this._boutOf();
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
    const st = await this._boutOf();
    if (!st) return false;
    if (boutFinished(st) && st.toldDone) {
      // the bout is over and said: kept ARENA_KEEP_MS for a reconnect's receipt, then forgotten (ARENA4b: an exhibition
      // ARENA_EX_KEEP_MS, a game day, for a bookmaker's verdict)
      const keep = st.kind === 'ex' ? ARENA_EX_KEEP_MS : ARENA_KEEP_MS;
      if (now >= (st.endAt || st.at) + keep) { this._bout = null; await this.state.storage.delete('arenabout'); return true; }
      await this.state.storage.setAlarm((st.endAt || st.at) + keep);
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
    if (boutFinished(st)) {
      st.endAt = Number.isFinite(st.endAt) ? st.endAt : now;
      if (!st.toldDone && (await this._boutTellHall(st, true))) st.toldDone = true;
      await this._boutSave(now, true);
      await this.state.storage.setAlarm(st.toldDone ? st.endAt + (st.kind === 'ex' ? ARENA_EX_KEEP_MS : ARENA_KEEP_MS) : now + 1000);   // ARENA4b: an exhibition's verdict kept a game day
      return true;
    }
    await this._boutSave(now);
    await this.state.storage.setAlarm(now + ARENA_TICK_MS);
    return true;
  }

  // ───────────────────────────── PVP-REF: A SIEGE'S ROOM ─────────────────────────────
  // Seats-Arc 6.1: the relay holds every fighter's vitality and judges every blow, cast and step (net/siegeRef.js). The
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
    const stands = tokenGate(await this.state.storage.get('hellos'), now, HELLO_HZ_MAX);
    await this.state.storage.put('hellos', stands.bucket);
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
    const outs = frames.map((fr) => JSON.stringify({ t: 'siege', ...fr }));
    for (const [ws, b] of [...this._all()]) if (b.id) for (const o of outs) if (!this._send(ws, o)) break;
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
    let target = null;
    for (const [, t] of this._all()) if (t.id === m.to) { target = t; break; }
    const to = target?.sub ? s.fighters[target.sub] : null;
    if (!to) return;   // a spectator, or a socket gone: nothing to strike
    // AUDIT-SEATS R9: ONCE A BATTLE STANDS, A BLOW OR A CAST IS BETWEEN SIDED FIGHTERS ALONE. A developer who entered PVP-REF's
    // ground without a pass before the first pass named the battle stayed unsided, and `by.side && ...` below then skipped
    // the side rule whole - it struck either side, healed either, and was a target whose felling bought Honours
    if (b && (!by.side || !to.side)) return;
    const heal = m.k === 'cast' && m.h === 1;
    if (by.side && b?.kind !== 'royal' && (heal ? to.side !== by.side : to.side === by.side)) return;   // SEAT2a: the sides are kept
    if (b?.kind === 'royal' && (heal || !royalMayStrike(b, a.sub, target.sub, now))) return;   // CROWN1 part two: the bout's two alone, no heal between them
    // the striker's look - the paperdoll every other player draws - names the weapon it holds (a woken object reads it)
    let look = this._looks.get(a.id) ?? null;
    if (!look && m.k === 'blow') { look = (await this.state.storage.get(lookKey(a.id))) ?? null; if (look) this._looks.set(a.id, look); }
    const res = m.k === 'cast'
      ? refereeCast(by, to, { from: by.pose, at: to.pose, d: m.d, heal }, now)
      : refereeBlow(by, to, { from: by.pose, at: to.pose, held: siegeHeld(look, m.w, m.m), d: m.d, r: m.r }, now);
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
   * the Ram (`rm`) a defender's, in full - judged by the referee (net/siegeRef.js refereeWorkBlow: the striker's bucket,
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
      held: siegeHeld(look, m.w, m.m), d: m.d, r: m.r, share: gate ? SIEGE_GATEHOUSE.blowShare : 1 }, now);
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
   * guard, a rebel, the Rebel Captain) - judged by the referee as a blow on a fighter is (net/siegeRef.js refereeBlow,
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
      : refereeBlow(by, n, { from: by.pose, at, held: siegeHeld(look, m.w, m.m), d: m.d, r: m.r }, now);
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
  // Seats-Arc 7.6: DUEL1's ring, every blow the referee's; one bout at a time; the ladder the room's (net/siegeRef.js).
  /** A peer id's account here, or null. */
  _royalSubOf(id) {
    for (const [, t] of this._all()) if (t.id === id && t.sub) return t.sub;
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
    if (this._fight === undefined) { const v = await this.state.storage.get('gatefight'); this._fight = v && typeof v === 'object' ? v : null; }
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
  /** A pose in the arena's dungeon frame, in the court's (net/gateBrain.js COURT_CENTRE). */
  _courtOf(p) { return { x: p.x - COURT_CENTRE[0], z: p.z - COURT_CENTRE[2] }; }
  /** The fight's bodies in the court now: one a fighter (its NEWEST socket speaks for it - AUDIT SOC B9's law), where
   *  its last pose stands, and whether that pose says it died. */
  _gateBodies(f) {
    const newest = new Map();
    for (const [, b] of this._all()) {
      if (!b.id || !b.sub || !b.pose || !f.players[b.sub]) continue;
      const had = newest.get(b.sub);
      if (!had || (b.since ?? 0) >= (had.since ?? 0)) newest.set(b.sub, b);
    }
    return [...newest.values()].map((b) => { const c = this._courtOf(b.pose); return { sub: b.sub, x: c.x, z: c.z, dead: !!b.pose.dd }; });
  }
  /** The brain's frames to everyone in the room, in order. */
  _gateFan(frames) {
    if (!frames.length) return;
    const outs = frames.map((fr) => JSON.stringify({ t: 'gate', ...fr }));
    for (const [ws, b] of [...this._all()]) if (b.id) for (const s of outs) if (!this._send(ws, s)) break;
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
      if (!f) f = this._fight = newFight(day, now, gateTimes(day).wrathAt, gateBossOf(day).id, gateModsOf(day));   // WB8b: the day's marks, kept on the fight
      const joined = !f.players[a.sub];   // AUDIT WB A3: a newcomer - an `in` again (every welcome says one) changes nothing to keep
      const present = new Set();   // AUDIT WB A1: the accounts in the court now - a full fight frees an idle seat, never theirs
      for (const [, b] of this._all()) if (b.id && b.sub) present.add(b.sub);
      if (!joinFight(f, a.sub, a.name ?? '', m.lv, now, gateAdmits(day, now), present)) {
        const no = f.fell || f.wrath ? 'the gate is closing' : Object.keys(f.players).length >= GATE_FIGHTERS_MAX ? 'the court is full' : 'the gate is sealed';
        this._send(ws, JSON.stringify({ t: 'gate', k: 'no', m: no }));
        return;
      }
      this._send(ws, JSON.stringify({ t: 'gate', ...stateOf(f) }));
      const r = f.rc?.[a.sub];
      if (r) this._send(ws, JSON.stringify({ t: 'gate', k: 'rcpt', r }));
      if (joined) await this._gateSave(f, now, true);   // AUDIT WB A3: at once for a newcomer alone - a reconnect storm was a write a frame
      if (!f.fell && !f.wrath) await this._gateArm(now);
      return;
    }
    // a blow: from a fighter (a correct client says `in` first), from where its own pose stands - the dead strike nothing
    if (!f || !f.players[a.sub]) { this._junk(ws); return; }
    // GATE-HEAL: what another's spell healed in this fighter, and whose - the socket in this room the peer id names
    // (another fighter of this fight, else nobody: allies only); believed within its own heal bucket, from its own pose
    // (net/gateBrain.js applyHeal). A figure for the round-up alone: it keeps no beat and wakes nothing.
    if (m.k === 'heal') {
      const pose = a.pose ? this._courtOf(a.pose) : null;   // the fallen too: a heal before a fall may be said after it
      for (const [by, n] of m.h) {
        const healer = [...this._all()].find(([, b]) => b.id === by)?.[1]?.sub ?? null;
        if (healer) applyHeal(f, a.sub, healer, n, pose, now);
      }
      return;
    }
    // WB9c: a blow on a crystal of Oblivion - the brain's caps as a blow on him; a crystal broken, and the Reckoning
    // broken with the last of them, said to the court at once (its health goes out on the beat)
    if (m.k === 'xhit') this._gateFan(applyCrystalHit(f, a.sub, m.c, m.d, m.r, a.pose && !a.pose.dd ? this._courtOf(a.pose) : null, now, m.q));
    // WB11b: a blow on one of his host (the Legion-Lord's) - the same caps; one slain said to the court at once (its
    // health goes out on the beat)
    else if (m.k === 'ahit') this._gateFan(applyHostHit(f, a.sub, m.i, m.d, m.r, a.pose && !a.pose.dd ? this._courtOf(a.pose) : null, now, m.q));
    else {
      applyHit(f, a.sub, m.d, m.r, a.pose && !a.pose.dd ? this._courtOf(a.pose) : null, now, m.q);   // AUDIT WB11 W3: the blow's sequence - once a blow
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
    const end = gateTimes(f.day).wrathAt + GATE_COLLAPSE_MS;
    if (now >= end) { this._fight = null; await this.state.storage.delete('gatefight'); return true; }
    try {
      this._gateFan(stepBrain(f, now, this._gateBodies(f), rand01));
      this._riteAskAhead(f, now);   // AUDIT WB12d (R2, L3): the rite's helpers asked of the hub ahead of the kill, never awaited by the beat
      if (f.fell && !f.said) await this._gateFall(f, now);
      else if (f.said && !f.told) await this._gateTellHubOnce(f, now);   // AUDIT WB A10: the hub told until it answers
      await this._gateSave(f, now, false);
    } catch (e) { console.warn('[gate] beat failed', e?.message ?? e); }
    const here = [...this._all()].some(([, b]) => b.id);
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
      if (!earned(f, sub)) continue;
      try { f.rc[sub] = await mintReceipt({ d: f.day, b: f.boss, s: sub, c: rand32(), x: earnedBy(f, sub), l: f.players[sub].lv, ...(helped.has(sub) ? { r: 1 } : {}) }, key, { subtle: crypto.subtle, nowS }); }   // AUDIT WBX S2: the level the fight admitted it at
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
    f.here = [...new Set([...this._all()].filter(([, b]) => b.id && b.sub && f.rc[b.sub]).map(([, b]) => b.sub))].slice(0, GATE_FIGHTERS_MAX);
    await this._gateSave(f, now, true);
    this._gateFan([{ k: 'fell', at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) }]);   // GATE-UX: the damage chart to the court alone (the hub's word stays the names)
    for (const [ws, b] of [...this._all()]) { const r = b.id && b.sub ? f.rc[b.sub] : null; if (r) this._send(ws, JSON.stringify({ t: 'gate', k: 'rcpt', r })); }
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
    }
    if (moved) w.moved = now;
    if (!watchDue(w, now)) return;
    const [x, y] = mapPixelOfWire(p.x, p.z);
    if (!(x >= 0 && x < 1000 && y >= 0 && y < 500)) return;
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
    try { const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body) })); return !!res?.ok; }
    catch (e) { console.warn('[gate] hub', e?.message ?? e); return false; }
  }
  /** AUDIT WB A4: the hub hands an account's kept receipt to its hello while the receipt is good, and forgets an expired
   *  one. AUDIT WBX S1: and one its account has said is spent (`_gateSpent`) - a receipt said again was NOT harmless: a
   *  second device's store had not spent it, and rolled its spoils again. */
  async _gateReceiptTo(ws, sub, now) {
    const k = gateReceiptKey(sub);
    const kept = await this.state.storage.get(k);
    if (!kept || typeof kept !== 'object') return;
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

  // ───────────────────────────── DISCORD-GATES: THE HERALD ─────────────────────────────
  /** The hub's door to Discord, read once an instance: the channel's webhook (GATE_DISCORD_WEBHOOK, a Worker SECRET) and
   *  the role its omen pings (GATE_DISCORD_ROLE, a var), or null - no webhook, no herald: nothing posted, nothing kept. */
  _heraldOf() {
    if (this._herald === undefined) {
      const hook = heraldWebhook(this.env?.GATE_DISCORD_WEBHOOK);
      if (!hook && this.env?.GATE_DISCORD_WEBHOOK) console.warn('[herald] GATE_DISCORD_WEBHOOK is not a Discord webhook\'s URL - nothing is posted');
      this._herald = hook ? { hook, role: heraldRole(this.env?.GATE_DISCORD_ROLE) } : null;
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
   *  net/gateHerald.js foldGateSite) and kept when it moved it. Nothing kept for a hub with no herald. */
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
  /** The alarm armed for the herald's next post, when it owes one before the sweep's. */
  async _heraldArm(now) {
    if (!this._heraldOf()) return;
    const at = this._heraldNextAt(await this._heraldState(), now);
    if (at != null) await this._hubArm(at);
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

  // ───────────────────────────── RAID3: A TOWN'S RAID ─────────────────────────────
  /** AUDIT RAID R6: a copy kept on the instance, the map bounded. */
  _raidKeep(id, led) { if (this._raids.size >= RAID_CACHE_MAX && !this._raids.has(id)) this._raids.clear(); this._raids.set(id, led); }
  /** A raid's ledger in this cell by its identity (net/raidLaw.js raidLedgerId - AUDIT RAID R1: the key and the
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
    if (this._raidSavedAt.size >= RAID_CACHE_MAX && !this._raidSavedAt.has(id)) this._raidSavedAt.clear();   // AUDIT RAID R6
    this._raidSavedAt.set(id, now);
    await this.state.storage.put(raidLedgerKey(id), led);
    await this._raidArm(led.cl && !led.told ? now + RAID_TELL_RETRY_MS : this._raidEndsAt(led));
  }
  /** A NEW RAID'S PLACE in this cell, for a ledger `by` would make - answers whether there is one. Every ledger past its
   *  end is forgotten first. AUDIT RAID R3: past RAID_LEDGERS_MAX a place was the stalest live ledger's, whatever it
   *  was - a raid being fought (its shares lost, its cap restarted), or one cleansed (its receipts minted again off a
   *  new seed by the next word, its hub never told) - and any word in the cell could ask. Now a place is given only by
   *  a ledger nobody has fought for RAID_LEDGER_BUSY_MS and that is not cleansed, one that counted nothing first
   *  (net/raidLaw.js raidEvictPick); with none, the new raid waits. And one speaker holds RAID_LEDGERS_BY_MAX places
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
   * A PLAYER'S WORD on the raid whose town it stands in (net/raidLaw.js): heard in the town's own cell alone (anywhere
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
  /** THE CLEANSE, SAID ONCE - the gate's fall's law (AUDIT WB A10): each earner's receipt minted (net/raidReceipt.js -
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
    try { const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${RAID_INTERNAL_CLEAN}`, { method: 'POST', body: JSON.stringify(body) })); return !!res?.ok; }
    catch (e) { console.warn('[raid] hub', e?.message ?? e); return false; }
  }
  // ─────────────────────────── WB12d: THE FAITHFUL'S RITE ───────────────────────────
  /** A WORD AT THE RITE (net/gateRite.js): believed from a pose at the circle the day's law places in the word's pixel,
   *  inside the rite's window (and RITE_GRACE_MS past it - a fall seen at its last second), from an account the token
   *  vouched for (a guest's too: the account service keeps a guest's receipt for its week). Who struck the faithful is
   *  kept by account; the Summoner's fall, said, breaks the rite - kept, then the hub told, and told again as more who
   *  struck are said, while its circle stands. AUDIT WB12d (R1): THE CELL KEEPS EACH CIRCLE SAID IN IT (RITE_CIRCLES_MAX)
   *  - a word at one never stands in another's way, and the hub chooses by the gate's agreed site. Honest limit (bible
   *  section 19 D): a word is its player's own - the cell checks where and when it was said, not each blow. */
  async _riteWord(ws, a, m, now) {
    if (worldRoom(m.px, m.py) !== a.key) { this._junk(ws); return; }
    if (!isGateDay(m.d) || !riteHeard(m.d, now)) return;   // outside its window: nothing read, kept or said
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
  /** A cell's copy of a day's slots (net/raidLaw.js raidDaySlots - the draws no game data decides). */
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
        const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${RAID_INTERNAL_DAY}`, { method: 'POST', body: JSON.stringify({ d: day }) }));
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
      if (!up && this._raidTownsUp.size >= 4) this._raidTownsUp.clear();   // a few uploads in flight at most
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
    const k = raidReceiptKeyOf(sub);
    const v = await this.state.storage.get(k);
    if (v === undefined) return;
    const kept = raidRcLive(v, now);
    if (!kept.length) { await this.state.storage.delete(k); return; }
    if (!Array.isArray(v) || kept.length !== v.length) await this.state.storage.put(k, kept);
    for (const e of kept) this._send(ws, JSON.stringify({ t: 'raid', k: 'rc', r: e.r }));
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
      return w.sp.length || w.dg.length ? `,"ow":${JSON.stringify(w)}` : '';
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
  async _owWord(ws, a, m, now) {
    const junk = m.k === 'sp' ? !m.ids.every((id) => owIdInCell(id, a.key)) : !m.rows.every((r) => owRowSane(r) && owRowInCell(r, a.key));
    if (junk) { this._junk(ws); return; }
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
    // FRIENDS-SYNC (field bug: "My friend list is different between devices"): THE SOCIAL ACCOUNT IS THE VERIFIED
    // PLAYER - the token's subject, the same on every device signed in to it - never the browser profile's id
    // (net/social.js accountId, minted per appStorage), which made a laptop and a desktop two hub accounts with two
    // lists, and two players sharing one browser profile one account with one list. The profile pair is now a LEGACY
    // credential alone: proved by its secret, its list is merged into the player's once and the old record retired
    // (the merge ACC1b said belongs here, the one place that holds both credentials at once).
    const me = this._attach(ws).sub || m.acct;
    if (me === m.acct) {   // no verified subject (a build before ACC1g's wall): the profile's own law, as it was
      const held = await this.state.storage.get(acctSecretKey(m.acct));
      if (held && held !== m.asecret) { this._sayError(ws, 'account taken'); return; }
      if (!held) await this.state.storage.put(acctSecretKey(m.acct), m.asecret);
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
      await this._heraldArm(now);   // DISCORD-GATES: and sooner, when the herald owes a post first (an alarm armed before it had a webhook)
    }
    let a = this._attach(ws);
    if (a.id !== m.id) return;   // replaced or gone while storage answered
    // ACC1d: the name the relay DECIDED, off the attachment, not the one
    // the frame asked for - `_named` has already run and `a.name` is
    // its answer. A durable record keyed on an unchecked claim is the
    // shape this slice exists to close.
    let rec = { ...((await this._acct(me)) ?? newAcct(a.name, now)), name: a.name, seen: now };
    let party = null;
    if (rec.party) {
      party = await this._livingParty(rec.party, now);
      if (!party || !party.members.includes(me)) { rec.party = null; party = null; }
      else if (party.away?.[me] != null) { const away = { ...party.away }; delete away[me]; party = { ...party, away }; await this._putParty(party); }
    }
    await this._putAcct(me, rec);
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
    const held = await this.state.storage.get(acctSecretKey(old));
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
    await this.state.storage.delete([acctKey(old), acctSecretKey(old)]);
    for (const [id, r] of Object.entries(puts)) if (id !== me) await this._sayState(id, r, now);   // the others' pictures name the player now (no socket, no frame)
  }
  /** AUDIT FRIENDS-SYNC F1: a record at the player's own id holding a profile secret (planted under the old law), retired
   *  whole - every record it names forgets it, so nothing it befriended keeps the player's presence. */
  async _retireForged(me, now) {
    if ((await this.state.storage.get(acctSecretKey(me))) == null) return;
    const forged = await this._acct(me);
    const puts = {};
    if (forged) {
      const named = await this._accts([...(forged.friends ?? []), ...(forged.in ?? []).map((e) => e.acct), ...(forged.out ?? []).map((e) => e.acct)]);
      for (const [id, r] of named) if (id !== me) puts[id] = { ...r, friends: r.friends.filter((x) => x !== me), in: r.in.filter((e) => e.acct !== me), out: r.out.filter((e) => e.acct !== me) };
      const all = Object.entries(puts);
      for (let i = 0; i < all.length; i += 128) await this._putAccts(Object.fromEntries(all.slice(i, i + 128)));
    }
    this._recs.set(me, null);
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
