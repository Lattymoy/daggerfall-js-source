# THE SCALE ARC: the servers, ready for a larger player base (SCALE)

Opened 2026-09-30. Mac: "I think now is the time we take some time and really beef up our server architecture, improve performance and really get detailed. Whatever we can do to really enhance everything and set the stage for a larger player base in the future." Then, of the plan: "This is all you man. Just do whatever is best."

**Target:** about 500 concurrent players within the year, on Workers Paid (Mac's answers, 2026-09-30). **Delivery:** plan first, then reviewable PRs. Nothing reaches players until Mac merges it, because a merge deploys.

## Where things stood (the audit, 2026-09-30)

Four read-only audits covered the relay (`server/src/index.js`), the account service (`server-account/src/`), what one client costs both, and operations. Every figure is arithmetic from the code's own constants. **None has been measured live**; measuring is SCALE3's job. *SCALE3 measured the account service and the relay locally, 2026-10-08 (below).*

### What breaks first at 500: a relay deploy

1. A relay deploy drops every socket. Each player reconnects **3-6 sockets**: the cell, 0-3 halo cells, the hub `chat:world` and a region channel.
2. Each socket open mints a fresh identity token (`online.js` `onopen` → `_mint`). A mint is about 8 D1 statements plus an Ed25519 signature.
3. So 500 players make about 2,000 mints against one D1 within about two seconds. Retries are uniform over 1-2 s, capped at 8 s.
4. Any mint slower than `TOKEN_WAIT_MS` (8 s) sends a tokenless hello, and the relay refuses it with `CLOSE_POLICY`.
5. The client treats that close as terminal (`online.js`). The player's room session never retries until they change room.
6. Chat links rejoin together every 30 s, with no jitter.

### Everything else found, by where it lives

**Account service** (one D1, one writer)
- **Before any work:** every authenticated request made about 5 D1 statements, 3 of them writes: session and player SELECTs, two `last_seen` UPDATEs, and the rate-limit UPSERT. That was about three quarters of the service's writes. *SCALE1 took two of them.*
- **Full-table scans:** about 12 statements read a whole table (EXPLAIN QUERY PLAN over the real migrations). *SCALE1 indexed them.*
- **Parameter limit:** two market statements could bind more than D1's 100 parameters: the materials view up to 121, the medians up to 101. node:sqlite takes 32,766, so the pins never saw it. *SCALE1 fixed both.*
- **Writes inside reads:** reads write (the market settle, the History sweep, the board sweeps, the professions' state sweep, the writ close). That rules out D1 read replicas, and every reader races to run the same sweep. *SCALE4b moved them to the service's own clock; the replicas are left.*
- **Unbounded growth:** `world_witness` rows (one per key per account, never trimmed) are read whole by the market and professions. `rate_limits`, the idempotency tables and abandoned guests are never pruned. There is no cron. *SCALE4b: the cron, and retention for the rate windows, idle sessions and old invitations; `world_witness`, the act receipts and guests are left, with reasons.*

**Relay** (Durable Objects)
- **The hub:** `chat:world` is one object every player joins. It has a hard 2,048-socket cap, sends each join and leave to all N sockets, and rebuilds its socket index on every fetch. It is not the limit at 500; it is the limit past about 1-2k. *SCALE5.*
- **O(N) work per frame:** `_all()` and linear `.find` lookups on every frame. Every pose writes its attachment and sorts the room's listeners. *SCALE2.*
- **Storage on the connect path:** the `hellos` bucket and the secret are read and written on every hello, before the gate refuses a busy room. *SCALE2.*
- **Memory:** `_parties`, `_recs` and `_spent` are unbounded or thrash. *SCALE2.*
- **Cross-room calls:** none has a timeout. *SCALE2.*

**Each client**
- **Rooms that never sleep:** the foes stream sends a full frame every 2 s even with nobody else in the room, so the room never hibernates. Dungeon memory publishes every 15 s whether or not it changed. *SCALE2.*
- **Checkpoints:** every 120 s, sent even when the save has not changed. *SCALE2.*
- **Account requests:** about 150-300 per active player-hour: token mints, checkpoints, the mail poll, the play beat, renown, the board. *SCALE3 measured 279 a bot-hour; SCALE4c rides the mail, the beat and the board on one request.*
- **Retries:** four books retried `rate` and `maintenance` within 0.4-1.5 s, and the Drakes' book retried with no wait at all. *SCALE1 fixed these.*

**Operations**
- **No visibility:** only uncaught errors were logged, and nothing was measured or alerted on. *SCALE1: account metrics. SCALE2: relay metrics.*
- **No load test:** none exists. *SCALE3 built the local half.*
- **Ungated deploys:** the relay and account deploys did not wait for the suite. On 2026-09-30 the site's deploy stopped at a red "lint and types" while the service shipped the same commit. *SCALE1 fixed this.*
- **Relay deploys:** the version was bumped 21 times since 09-24, and each bump drops every player. *Policy, below.*
- **Abuse controls:** no Turnstile on guest accounts, rate limits keyed by the full IPv6 address, `ALLOWED_ORIGIN = "*"`, no ban/report/ignore. *SCALE6.*
- **Backups:** R2 keeps each character's current and previous save only. *SCALE6.*

## The slices

| Slice | What | Drops players? | State |
|---|---|---|---|
| SCALE1 | The account service's half: fewer writes per request, metrics, indexes, the 100-parameter fix, gated deploys, D1 bookmark before migrations, client retry discipline | No | **Shipped in this PR** |
| SCALE2 | The reconnect wave, from the client - NO relay deploy: one token for a connect's rooms (reused within a minute, never twice into one room, one mint on the wire), a tokenless refusal asked again while signed in, the channels' rejoin jittered | No | **Shipped** (after SCALE1) |
| NET-SMOOTH | Other players drawn without jumping back, from the client - NO relay deploy: the snap in the room's own units, one source room per peer (handed to a room that is ahead), introductions' stale poses ignored, a play-out along waypoints at 0.75x-2x with a jitter cushion | No | **Shipped** (2026-10-04, `06-Systems/Online-Arc.md` NET-SMOOTH) |
| SCALE2b | The relay's own, ONE announced relay deploy: the O(1) socket index, the hello path in memory, bounded caches, cross-room timeouts, relay metrics, idle rooms allowed to sleep (foes and memory only when someone else is there) | Yes, once | **Shipped** (2026-10-04, in world162 beside PRIMARCH; one deploy) |
| SCALE3 | The load harness: a Node bot fleet (guest → token → hello → poses, chat and checkpoints at real rates) against local workerd, then a staging pair; the deploy-storm scenario | No | **Local half built** (2026-10-08, this branch); the staging pair left |
| SCALE4 | D1 discipline: sweeps moved to a `scheduled()` cron, retention for the tables that only grow, the witness tables redesigned, reads made write-free and served from read replicas (Sessions API), one heartbeat replacing the mail, beat and board polls, 304s | No | **4a-4c built** (2026-10-08, this branch): the joined session read, the cron and retention, reads write-free, the heartbeat. Left: the witness redesign, 304s (the replicas: SCALE4d, below) |
| SCALE4d | The token's mint on a D1 session - its first statement the primary's, its reads after it a read replica's - and the deploy turns the database's read replication on | No | **Merged** (2026-10-10, #755); its deploy stopped on an overloaded database - SCALE4e (AUDIT SCALE II D-10: and main's account deploys since carried it) |
| SCALE4e | The account deploy outlasts an overloaded database: `migrations apply` asked again on D1's overload alone, for 5.5 minutes | No | **Built** (2026-10-10, this branch) |
| SCALE5a | At 500 online: the hub's hello and leave without a walk of every socket, a busy refusal that mints nothing, the World tab's count past the roster's cut | Yes, once | **Deployed** (2026-10-10, #755; world189) |
| HALO-THIN | A cell's halos hear my pose when it is due - its first, a new map pixel, 8 m on, standing at a new place, the heartbeat - not every pose; whole while my own cell's socket is down, while a halo reaches a player in range who does not hold my cell, or while a referee may stand in one (a duel, a serpent's fight); a halo pinged on its own clock | No | **Built** (2026-10-10, PR #761; client only) |
| SCALE5 | Past about 1-2k players: the hub split (presence and social state per account, world chat over shard rooms), slimmer or binary poses, pose-only halo frames | Yes | **Planned** as the slices below (THE PLAN PAST 2,000) |
| SCALE2c | The reconnect wave spread by the hub's own count; a full foes frame that says nothing said once - client only | No | **Built** (2026-10-10, this branch) |
| SCALE4f | The mint's realm row read once (four statements in one), and its guild membership once (three in one); every statement's D1 wait, rows and a replica's serving on the metrics point; an overloaded D1 a 503 | No | **Built** (2026-10-10, this branch; acct112) - the writes stay, with their reasons |
| GATHER-SPEED / MARKET-SPEED | The round trips a player waits on: a harvest's reads in its decision's batch (4 trips, was 13-20), the professions' state in one (was 8), a market read in three (was 18-22), a buy's reads asked together; the seats' witness rows for a Levy, a Tithe and a board's Market Hall off the isolate's kept minute; the gathering node gone as its act ends - `06-Systems/Professions-Arc.md` 10.12 | No | **Built** (2026-10-11, this branch - acct119, no migration) |
| SCALE4g | The read routes on read replicas, the client carrying D1's bookmark between its requests | No | **Built** (2026-10-10, this branch; acct112) |
| SCALE5b | The relay's hygiene and metrics, and the wire's second form (quantised, batched poses; channel rosters as deltas), capability-gated | Yes, once | **Built** (2026-10-10, this branch; relay world191 on its branch, folded into world192 past main's WARDEN1; NOT YET DEPLOYED) - with the relay's settings at run time and its word of its referees for a halo (`rf` - HALO-THIN, below, the halos' one law) |
| SCALE5c | The hub split: sixteen hubs by account, `chat:world` the world's bus; then the region channels on the same machinery | Yes, once | **Built** (2026-10-11, this branch; relay world192, NOT YET DEPLOYED) - the hub's sixteen shards and each region's four, the World and Region tabs' lists and the search |
| SCALE5d | Event rooms (the gate's court, the Abyss realm, the arena) as copies around one fight; crowded cells | Yes | **Built** (2026-10-11, this branch; world192) - a crowded place overflows into layers; a gate's court into copies around its one fight (the realm, a siege and the arena are capped below a room by their own laws) |
| SCALE4h | 10k writes: a player's hot state off the one primary (per-account objects or shards) | No | **Built** (2026-10-11, this branch; acct112) - measured first: written less at the source, not moved - Renown coalesced, the session touched hourly, the metrics by table; a token bound to a key considered |
| SLIM-FRAME | The second wire's place in its own units: a pose's height to the centimetre in every room, a dungeon's, a town's and a building's x and z with it, a cell's x and z whole world units - the relay's fan says the room | Yes, once | **Built** (2026-10-11, this branch; relay world194, one drop at the merge) |
| D1-NEAR | The account Worker beside its database's primary, by name (`[placement] region`): Smart Placement ran it in Sydney, a Pacific from the primary, and every statement on the primary paid the crossing; every deploy says where it answers from, what a statement costs it there and where D1 says its primary is | No | **Built** (2026-10-12, this branch - no migration, no version, no drop; audited, AUDIT D1-NEAR) |
| HOMES-SHED | The account database overloaded from 14:11 UTC (2026-10-13): the busiest route one D1 request where it was two (a town's homes and its Open Gates edict in one batch); the siege blackout's question answering a throw as every route does; a town unanswered backing off on the client, YARD-SHED's law | No | **Built** (2026-10-13, this branch - acct127, no migration, no drop) |
| BUSY-GATE | After HOMES-SHED, the class: the reads a tab keeps asking stand back while the database is overloaded - the client holds them for a doubling wait, an isolate that meets an overload sheds them a moment without a statement, every overload answer says its Retry-After; one law at both ends (`src/net/busyLaw.js`) | No | **Built** (2026-10-13, this branch - acct128, no migration, no drop) |
| HUB-PULL / DO-ASK | The live relay's hub refused by the runtime's subrequest depth (the bus's push charged to the hand-up it served, a hop deeper each round): the bus never calls a shard - each shard keeps a poll at its bus, answered with every delivery it has not acknowledged; the Worker asks a room reset before it ran once more, an overloaded one never, and answers what is left as a 503 | Yes, once | **Built** (2026-10-16, this branch; relay world210) |
| PRIMARY-TRIPS | The account database's primary, capped by its round trips, overloaded at 00:00 UTC (2026-10-16): the seats' list, a checkpoint and a badge's honours each one batch, a town's yards off a replica, a heartbeat's reads before its beat, a hall bump off its key's rows - some a quarter of the primary's trips at peak | No | **Built** (2026-10-16, this branch; acct139) |
| DECOR-BATCH | The account database overloaded again through the evening of 2026-10-16: every account deploy since #952 failed its smoke on `/v1/homes/decor` (seven asks of 15 s, no byte back) while `homes/town` answered its one batch in 11 s - a home's room one request where it was three trips in a row, a shunned home's shop one more | No | **Built** (2026-10-16; acct142) |
| BOOKMARK-SPIRAL | The account database's primary overloaded from 13:50 UTC (2026-10-16) and stayed so - every route 5 to 60 s, every deploy's smoke on `/v1/homes/decor` 000, DECOR-BATCH deployed and nothing moved: the page's D1 bookmark is kept only when no call goes between a read and its answer, so a slow primary took the bookmarks away, and every polled display read then started at the primary. The six polled reads with no bookmark start at any instance; a session lookup that misses there asks the primary | No | **Built** (2026-10-16; acct143) |
| BUSY-HEART | After BOOKMARK-SPIRAL deployed and the primary's own load halved, the overload held: it held only while players were in the world (healthy 20:00-20:04 with the relay's players dropped by its deploy, at more primary statements than when it came back), and the heartbeat and the motherlodes - asked again on their own schedules, twice and three times as often - spent the most of the database's time. Both stand back now | No | **Built** (2026-10-16; acct144) |
| SHED-LONG | After BUSY-HEART the overload eased (p50 17-45 s to 5-13 s) and held: a request on a D1 session waited 31 s on the database for every 5.6 s one on the binding did - the replica the longer queue. BOOKMARK-SPIRAL rolled back (the six polled reads at the primary first again, its session lookup's fallback kept), and an overload's shed 10 s where it was 2 | No | **Built** (2026-10-16; acct145) |
| SCALE6 | Abuse and backups: Turnstile on guest creation, /64 IPv6 rate keys, bans, report and ignore, `ALLOWED_ORIGIN`, R2 snapshots, a hub export | Some | Alongside |

**Relay deploy policy (SCALE):** relay changes are batched into as few deploys as possible, each in a window announced beforehand. A deploy drops every player, and until SCALE2 every reconnect is a D1 write storm.

## SCALE1: shipped

**Fewer writes per request.** `resolveSession` writes `sessions.last_seen` and `players.last_seen` only once the session's is `SESSION_TOUCH_S` (10 minutes) stale, both in one batch. Nothing reads the column more finely: the idle bound is a year, and the device list orders by it. A failed touch still never fails the request (AUDIT-ACC F10).

**Metrics.** `server-account/src/metrics.js` is `METRICS`, a Workers Analytics Engine dataset (`daggerfall_accounts`). Every request writes one point:

| Field | Holds |
|---|---|
| `index1` / `blob1` | The route as a template |
| `blob2` | The method |
| `blob3` | The status |
| `blob4` | A refusal's word |
| `double1` | Wall ms |
| `double2` | The status |
| `double3` | The D1 statements the request ran |

No player is named, and a metric never costs a request. The module's header carries the query. Smart Placement was
to run the Worker near its database; nothing said where it ran, and on 2026-10-12 it ran it in Sydney, a Pacific from
the primary - D1-NEAR (below) names the place instead.

**Indexes.** `0043_scale_indexes.sql` holds twelve indexes, each found by the planner and pinned by it (`test/net/scale1.test.js` C). `node_harvests` has been rebuilt four times to widen its CHECK, so a fifth rebuild must recreate `idx_node_harvests_day`.

**D1's hundred parameters.** The market's materials view and its medians bind their keys as one JSON array (`IN (SELECT value FROM json_each(?))`). The planner still uses `idx_market_open`, and tighter than before. The pin runs the whole catalogue (113 materials) through a D1 that refuses past 100.

**Deploys.**
- `account-deploy.yml` runs the suite (`verify.yml`) before it deploys.
- `relay-deploy.yml` runs the suite only when the relay's version differs from the live one, and deploys only if the suite passed.
- The account deploy writes the database's Time Travel bookmark to the run summary before the migrations.

**Retries.** `src/net/backoff.js` holds `jittered` (a wait anywhere from half to one and a half times itself) and `ASK_AGAIN_NOW` (only `offline` and `server` are asked again within one press). The professions', market's and writs' books send `rate` and `maintenance` straight back, kept for their slower pumps. The Drakes' book waits between its asks.

**Pins.** `test/net/scale1.test.js` (10). `tools/mutants/scale1.json`: 35 mutants, 35 dead. `npm run account`: 46/46 in workerd, with `METRICS` bound locally, so the counting proxy ran over a real D1. The service is `acct43`.

## SCALE2: shipped (client only, no relay deploy)

The relay was split out of SCALE2 on reading: every piece of the reconnect storm the client causes, it can stop causing without a relay deploy.

**One mint per connect** (`net/accountClient.js` `accountTokenMinter`, `TOKEN_REUSE_MS`)
- The relay spends a token once *in a room* (`_spent`, one set per room, in memory), so the one token may open the cell, its halos, the hub and the region channel of a single connect.
- The minter now takes the room each socket opens, and hands a token minted within `TOKEN_REUSE_MS` (60 s) to every other room asked under the same sign-in and character.
- A room the token has already opened always gets a fresh one. That is the reconnect ACC1d's "never cached" protected.
- Sockets opening together share the one mint on the wire.
- A call that names no room is minted fresh, as before.
- Effect: mints per connect drop from 3-6 to 1, and so do mints per deploy wave.
- The minute bounds how stale a level, title or guild signed in the token can be when it opens another room.

**A missing-token refusal is asked again** (`net/online.js` `tokenRetryable`)
- The minter now says why it answered null (`lastWhy`), and a session remembers why each hello went without a token.
- The relay refuses such a hello (`CLOSE_POLICY`). If the device is signed in (the service was slow, rate-limited or down), the primary retries backed off hard, as for a busy room, and a halo is retried rather than remembered terminal. (DOOR-TOKEN, below, departs from this: either asks again the moment the minter holds a token for its room.)
- Only no sign-in (`no-session`) or a sign-in the service refused (`auth`) stays final. Signing in is the way back from those.

**The channels' rejoin is jittered** (`OnlineSession.rejoin`)
- After a terminal close, the wait is drawn once, anywhere in [half, one and a half) of `CHAT_REJOIN_MS`.
- Before, every tab's channels came back on the same thirtieth second.

**Pins.** `test/net/scale2.test.js` (8). `tools/mutants/scale2.json`: 19 mutants, 19 dead. Re-aimed, still dead:
- ACC1d-8 / 9 / 10 / 12
- the three TOKEN-WAIT mutants
- RENOWN1's character mutant

## DOOR-TOKEN: shipped (client only, no relay deploy)

FIELD BUGS 2026-10-16b, the Discord: "Friend invivible and randomly popping up"; "Partied players popping in and out
randomly after leaving tombs at graveyard ... also partied players inside tombs are invisible for a time". The record is
`01-Overview/bugs/Field-Bugs-2026-10-16b.md` DOOR-TOKEN.

SCALE2's minter answers a room's socket as it opens, and every place change is a new room, so the hello waited on a
mint whenever the token held could not open the room: past its minute, or already spent there (the cell a crypt's door
leads back out to was opened by the token held when the player went in). A mint is seconds for a player (TOKEN-WAIT),
and for those seconds neither side of the door could see the other.

- **The next room's token is minted at the door** (`scenes/doorTokenHost.js`, the minter's
  `accountClient.js:"    ahead: (/** @type {string|null} */ room = null, withinMs = 0) => {"`). The host says a place
  change is coming, and when the next room's socket will ask, and the minter's `ahead` mints then:
  - a door in (worldModes' `onPreTransition`), while the place builds;
  - a door out (`onDungeonLeave`, `onInteriorLeave`);
  - any jump (world.js `_teleportToPixel`: a fast travel, a teleport, a recall, a respawn), while the destination streams;
  - the walk back to an exit door: within `EXIT_NEAR_M` (16 m) after standing `EXIT_ARM_M` (32 m) from every one, once
    a visit. An exit is a click with nothing to build behind it, so the walk is the mint's only time.
- **It mints only when the held token could not open the next room by the time its socket asks**: none held, spent
  there, or its minute out within the door's own margin. A door's margin is
  `doorTokenHost.js:"export const DOOR_SOON_MS = 2_000;"` (a frame, the join's 500 ms hold, a socket's open), asked again
  every frame of the place change until its room is joined (at most `DOOR_PENDING_MS`, 30 s), so a long build or stream
  needs no guessed bound; the walk's is `doorTokenHost.js:"export const EXIT_WALK_MS = 8_000;"` (16 m at the slowest
  walk, the door's click, `DOOR_SOON_MS`). Never through a failure's hold (STORM-SHED), never while a mint is on the
  wire, never offline.
- **AUDIT (2026-10-16, A2): the margin was one 20 s (`TOKEN_AHEAD_MS`) at every door**, and the record said "the next
  room's own mint simply goes early". It did not: the next socket asks within a frame or a build, so every door met with
  the held token 40-60 s old minted though that token would still have opened the room - twice the mints at a 40-55 s
  door gap, half again at 30-60 s (the auditor's walk over the real minter) - and the walk out re-armed on every
  approach, so a fight pacing 10-35 m from a dungeon's exit minted 13 times in ten minutes (none before). Re-measured over
  the real host and minter, a 3 s mint: building hops (a 1.5 s build, walking back to the door) mint x1.00-1.06 of
  before at every gap from 10-30 s to 45-58 s, while the time sockets waited on a mint falls to a third; the pacing fight
  mints once. What is left is the price of the latency win itself: a token minted at a door is older, by the build, at
  the next one - a 6 s dungeon build with every gap at 45-58 s mints x1.22 (x1.03 over a 10-120 s spread), a 12 s one
  x1.58, against sockets that never wait.
- **A missing-token refusal is asked again the moment a token is held**
  (`online.js:"if (this._tokenRetry && this._retryAt != null && now < this._retryAt"`). This departs from SCALE2's "the
  primary retries backed off hard": a token that came past TOKEN_WAIT_MS had arrived and the session still waited out a
  1-4 s backoff and the mint's hold. The primary and each halo now ask again the frame the minter `holds` one for their
  room. The hard backoff stands for every other wait.

Measured over two real sessions and the real Room, with a mint taking 3 s: a party member walking into a crypt past the
reuse minute was seen 3.1 s after the room changed, now 0.5 s (the build covers the rest; 0.7 s before the audit's
re-ask through the build); walking back out, 3.1 s, now 0.1 s. The pages minted five tokens on the same walk either way.

**Pins.** `test/net/fb1016b_doortoken.test.js` (6 - THE RATE, the audit's: the door hops and the pacing fight over the real
host and minter). `tools/mutants/fb1016b_doortoken.json`: 36 mutants, 36 dead.

## NET-SMOOTH: shipped (client only, no relay deploy)

Mac, 2026-10-04: "Sometimes other players rubberband, I want to continue to improve performance and future proof for
larger amounts of players". Asked, Mac chose client fixes first and a batched relay deploy later. The record is
`06-Systems/Online-Arc.md` NET-SMOOTH. For scale it matters in three ways:
- **A crowd degrades smoothly.** SLAM3 slows a crowded sender and SLAM6 gives far listeners one pose in four. Before,
  the rate changes as a peer crossed a tier made the peer dash; now a backlog or a promotion is walked at no more than
  twice the pace, and a demotion is walked over its own interval.
- **More halos, no more jumping.** Every halo a player holds was another copy of every nearby pose (HALO-THIN, below: a
  halo now hears a pose only when it is due). One source room per peer makes the copies harmless however many rooms
  overlap.
- **The relay batch is unchanged by it.** SCALE2b still owns the relay's O(N) work and the hello path. A sequence and a
  send time on the pose belong to that deploy, and NET-SMOOTH is written to read them when they come.

## SCALE2b: shipped (the one relay deploy)

Mac, 2026-10-04, of the phase NET-SMOOTH left for later: "I definitely want to do all these changes in full. No
exceptions". Every item of the SCALE2b row, plus the pose's send time NET-SMOOTH was waiting for, rides **world162** -
PRIMARCH's version, never deployed - so they cost players one drop between them. The relay's constants and its one
helper are `server/src/relayScale.js`, not the entrypoint: a module Worker reads every named export of its entrypoint
as an entrypoint (the account probe's lesson).

**The socket index** (`_all`). It asked the runtime for the whole socket list and walked it against the index on every
call - three times a pose, nine a hello - O(N) whether or not anything had changed. It is kept now by the doors that
change the set: the accept in `fetch` adopts (`_adopt`), a leave forgets, and a close this object makes asks the
runtime once (`_closed`) - a socket it still lists until the close completes (AUDIT ONESEAT R4) stays, as the old
index re-read it. Trusted for `IDX_TRUST_MS` (1 s); past that one walk takes in anything missed and keeps every entry it
has (an entry's attachment is newer than the stored one - below).

**The hello path in memory.**
- The room's hello bucket was read from storage and written back on every hello, a storm included. It refills whole
  in a second, so it is the instance's now (`_hellos`) - the last of the object's own buckets that was in storage.
- An id's secret is read once a wake and kept (`_secretOf`) - an id at a time, never listed: a deploy drops sockets
  without their leave, and a hub that never drains keeps every secret such a drop left behind. A secret is written when
  it is new, a look when it changed. A reconnect wrote both every time.
- A place's memory was read whole (up to 512 KiB) on every hello. It is read once a wake and set by every publish
  (`_worldMemo`).
- A cell's parked teams were listed on every hello. Listed once a wake, kept by the store and the drop (`_parks`).
- The hub: an account record is written when it holds news or its last-seen is `ACCT_SEEN_WRITE_MS` (10 min) stale -
  the leave stamps it exactly and an online row reads the frame's clock; the profile secrets are kept (`_asecretOf`);
  an account with no gate receipt or raid receipts is remembered as such until one is written.
- Measured on the fake object: a reconnect's hello writes nothing and reads nothing (it was a bucket read and write,
  a secret read and write, a look write and a parks list).

**The pose path.** A pose rewrote the socket's whole attachment (about 2 KiB stored by the runtime). The index takes it
at once - every reader reads that - and the runtime's copy, which only a wake reads, is written at most every
`ATTACH_LAZY_MS` (2 s), and at once for a stop (where a player stands is what a wake must see). The fan picked the
nearest `POSE_FAN_MAX` by sorting every listener on every moving pose; it selects them now in linear time and sorts the
32 alone - the same set in the same order, ties in list order (pinned against the old sort on random rooms).

**Bounded caches.** `Bounded` (relayScale.js): past its bound the OLDEST goes, never the whole map. `_recs` and `_cool`
cleared themselves whole when full - a read storm and a spam window; `_parties` had no bound (`PARTIES_MAX` now);
the raid caches cleared at 64; the Watch's map now keeps a player in use at the back; an unfinished towns upload goes
with its socket; the spent-token sweep stops at the first still good instead of walking the map every hello.

**Deadlines.** Six calls between rooms had none - the park registry and its drop, an arena post, a gate's kill, a raid's
cleanse and its day - and an awaited call holds its handler. Each carries `AbortSignal.timeout(ROOM_CALL_MS)` (5 s);
every caller already treated a failure as a miss to retry or let lapse.

**Metrics.** `RoomMetrics` writes one Analytics Engine point (`METRICS`, dataset `daggerfall_relay`) per room per
`METRICS_WINDOW_MS` (5 min) in which anything happened, and at a drain: the room's kind and the relay's version beside
counts - hellos, busy refusals, frames and bytes in, poses, frames and bytes out, storage reads and writes, refusals.
The storage is counted through a Proxy over the state (`countedState`). Nothing names a player. Five minutes keeps a
thousand live rooms inside the plan's included ten million points a month.

**The pose's send time** (`ts`, wire.js `POSE_TS_MOD`): see `06-Systems/Online-Arc.md` SCALE2b. One field orders every
room's copy of a pose and spaces a peer's waypoints by the time its sender kept.

**Rooms that sleep** (the audit's "Each client" list, the client half):
- the foes stream and the own lane say nothing to a room with nobody else in it (`othersHere`), and owe their next
  frame full - the first after a joiner arrives carries every foe;
- an unchanged memory is not published again inside `WORLD_REPUBLISH_MS` (5 min) - after a welcome or a host change,
  or a change, it goes at once;
- the periodic realm checkpoint of a save that says nothing new (the landed one but for its clock and its look -
  `idleKeyOf`) is answered without a put, inside `REALM_IDLE_CHECKPOINT_MS` (10 min); an act's checkpoint, an exit's
  and a hidden page's always go (`realmSession.idle`);
- the party map and its minute's resync go only with a mate online; the cabin lane's boat record only while someone is
  in that cell.

**Not done here:** the hub split, binary poses and the load harness are SCALE3 and SCALE5, unchanged. Nothing here has
been measured live - the metrics above are how it will be.

**Pins.** `test/net/scale2b.test.js` (15). `tools/mutants/scale2b.json`. Re-aimed: the hello bucket's storage pins
(online_relay, chat1, world1, profile2), ONLINE1's and CHAT1's pose-frame pins (the send time), SOC1's last-seen pin,
CHAT1's meter regex, REALM P0.5's checkpoint regex; `test/fakeRoom.mjs` and slam5's harness bring a socket in by the
object's own door (`_adopt`), as `fetch` does.

## SCALE3 and SCALE4a-c: built (2026-10-08, this branch)

Mac, 2026-10-08, asked "How can we continue to improve server performance and overall game performance", and then, of
the list it was answered with, "Do 1 2 and 3": the account service's two reads made one (SCALE4a), SCALE4 (here 4b and
4c), and SCALE3. The service is **acct95** with migration **0091** (acct94 and 0090 until the merge with main, where
SD9b had taken both); it deploys with the site, which waits for it. No relay change. All four were audited before the
merge (AUDIT SCALE, `01-Overview/audits/Audit-Scale.md`); what it found is written into each section below, and every account
figure here was measured again after it. The relay's could not be, on the boot that did (below).

### SCALE3: the load harness (the local half)

(AUDIT SCALE II L2, L3, L5, 2026-10-11: since ADMIT-LINE (#766) the harness could not boot the account service - its
entry exported no AdmitGate - nor set up a fleet past the line's burst; it exports every Durable Object class the
service's entry does, and each bot's guest waits its place in the line. Its three sessions now share one reconnect wave
and offer the second wire (`--wire 1` runs the first), and its tally reads `poses` and `fb` batches - every figure below
was taken on the first wire with a wave a session, before SCALE5b and SCALE2c; the audit's own live storm is in
`01-Overview/audits/Audit-Scale-II.md`.)

`tools/loadHarness.mjs` (`npm run load`; `--help` names every knob) runs a fleet of bots against the REAL relay and the
REAL account service, both in local workerd (`wrangler dev`; the service behind `tools/loadAccountEntry.mjs`).

**A bot is the client's own modules, never a model of them:**
- a guest registered through the service's own doors, from its own address;
- a realm character and its first save, made by the realm's own client calls;
- the three rooms the world host holds - the cell with its halo, the hub and the region channel - as `OnlineSession`s
  sharing one `accountTokenMinter`;
- poses through `sendPose`, and chat;
- every account call the client makes on its own clocks, at the client's own constants, each clock at a random phase.
  Where the tree has the heartbeat (SCALE4c), the bot keeps the beat, the box and the board through it, with the
  client's own `MailBox`, notice book and play clock;
- the professions' state as the client's book reads it: on arrival, and again at the UTC day's turn. A guest's refusal
  is asked again every `PROF_CLOSED_RECHECK_MS`. (AUDIT SCALE C1: the harness had asked it every 30 s of a gatherer's -
  the client's floor for a read that FAILED - thirty times the client, a quarter of main's statements.)
- Each role - walking, fighting, registered - is its own spread over the fleet, and the report states the mix it
  measured.

**What it measures:**
- the account service by route: requests a bot-hour, statuses, latency, and D1 statements a request (the service's own
  metrics point, which the entry keeps in the isolate where a deploy writes it to Analytics Engine);
- D1's rows read and written, by statement - the figure YARD-SHED and STORM-SHED read off `wrangler d1 insights`;
- the relay at the bots: frames and bytes a bot-second by type, a pose's age from its sender's stamp, closes, refusals;
- `--scenario storm`: the relay's process is killed under the fleet and started again on the same state, as a deploy
  restarts every Durable Object, and the reconnect wave is counted second by second.

**How it runs:**
- The service's own clock is fired as the deploy fires it: the hour's jobs as play begins, the minute's every minute.
  A six-minute run fires the hour's list once. Its statements count with the rest; they are the world's, a fixed cost,
  not a player's.
- A storm's seconds are counted by each call's, statement's and refusal's own moment, and its shares back from the
  welcomes themselves.
- `--threads` spreads the fleet over worker threads, so the bots' own event loop is not what is measured.
- It refuses every address but its own two.
- A run serves its tree live (`wrangler dev` rebuilds on every source change), so each column below ran from a
  `git worktree` of its commit.

**What it is not.** Local workerd is not Cloudflare: D1 is one SQLite file with no queue and no network, and the fleet
shares four cores with both Workers. Latency here is relative. The counts are the code's own: statements a request,
requests a bot-hour and frames a bot-second. Rows a statement are only partly so, since they also depend on the data the
run built and on what each isolate kept (the yards, the Motherlodes' pick). **The staging pair** (the same harness
pointed at deployed Workers) is not built: it needs a second deploy of both Workers and a database on Mac's account.

**Pins.** `test/net/scale3.test.js` (5) pins the parts that stand without a toolchain; `tools/mutants/scale3.json`: 11
mutants, 11 dead. AUDIT SCALE pinned the measurement itself (`test/net/auditscale.test.js` section C: the report's
arithmetic, the storm's seconds, the clocks, the roles and every counter), and moved scale3's merge pin (C9: the fleets'
pose reservoirs pooled unweighted read a 75th percentile of a second for 10 ms). The harness itself is not in the suite,
for the account probe's reason (`tools/accountProbe.mjs`). Two of its findings were fixed because it needed them:
- `npm run account` died at its migrations step: wrangler reprints its summary after every migration, and at 89 the
  output passed execFile's 1 MiB buffer.
- Node's WebSocket fires no close after a connect it could not make, where a browser fires 1006. The client's retry
  waits on that close, so under Node a fleet never came back from a storm; the harness's socket closes as a browser's.

### What it measured

100 bots, 6 minutes of play in one town cell, the storm at 70%, one thread. Every column was measured again after AUDIT
SCALE by the one corrected harness, each from a `git worktree` of its commit, the last the audited head (`ffb03972`).
The fleet: 70 walking, 49 fighting, all 100 registered, each role its own spread. "The play" leaves out the storm's
token mints, since a storm folded into an hourly rate reads as a deploy every six minutes.

| | main | + SCALE4a | + SCALE4b | + SCALE4c, audited |
|---|---|---|---|---|
| Account requests a bot-hour | 243.3 | 244.4 | 242.1 | 209.8 (-13.8%) |
| of them the play's | 227.9 | 227.7 | 226.7 | 195.1 (-14.4%) |
| D1 statements a bot-hour | 1,149.1 | 982.5 (-14.5%) | 847.7 (-26.2%) | 805.4 (-29.9%) |
| of them the play's | 964.2 | 798.7 (-17.2%) | 678.2 (-29.7%) | 643.6 (-33.2%) |
| D1 rows read a bot-hour | 1,564 | 1,582 | 1,340 | 1,267 (-19.0%) |
| D1 rows written a bot-hour | 175 | 175 | 175 | 172 |
| The storm's `busy` refusals, and its mints | 54, 154 | 67, 167 | 54, 154 | 47, 147 |

The percentages are on main. A run's storm varies (47-67 refusals here), and its mints with it: SCALE4a's extra 13 mints
are 16 statements a bot-hour of its total, none of the play's.

Where main's statements went, a bot-hour:
- the Notice Board, 420 (every minute in a town, 7 a request);
- Renown, 204 (the 49 fighters' reports, 7 a request);
- the token mint, 185 (12 a mint, every one of them the storm's);
- the realm checkpoint, 120;
- the Motherlodes 85, the letterbox 60, the seats 37, the play beat 37;
- the yards almost nothing for their 60 requests: the isolate keeps them (YARD-SHED).

The professions' state and the towns' layouts are read once, on arrival, before the measured play begins: at one
arrival an hour, two requests a bot-hour more.

**Findings:**
- **The audit's estimate held:** about 240 account requests a player-hour on main (it said 150-300).
- **Standing play in one cell mints nothing; a storm mints one per bot plus one per busy refusal.** Every run's tokens
  were the storm's: 154, 167, 154 and 147 for 100 bots, exactly 100 plus that run's 54, 67, 54 and 47 `busy`
  refusals. A cell's hello gate is asked before the token is read, so a refused hello's token was never spent; but the
  client counts a room it handed a token to as opened (`accountTokenMinter` `opened`) and mints afresh for the retry.
  **Left:** a siege's and an arena floor's gate is asked *after* the token is spent, so the client cannot tell the two
  cases from the close (1013) alone. The relay saying so is a relay deploy; the client knowing which rooms do which
  couples it to the relay's order. It is about one mint in three of a storm on one thread, and 88 of 188 threaded.
- **One thread is not enough for 100 bots in one cell, and on the boot that measured these columns neither were three.**
  On one thread a pose's age (p50 58-63 s) is the harness's own queue. Over three threads, on the boot that measured
  SCALE4c's tree before the audit, each bot heard **132 frames a second (28.7 KB)**, 131 of them poses - the fan's 32
  nearest (`POSE_FAN_MAX`) at the sender's 2.7 a second, and the far listeners' one in four (`POSE_FAR_SHARE`) - and
  sent 2.8 (340 B). **A pose's age: p50 19 ms, p95 54 ms, p99 78 ms.** The boot that measured these columns is slower.
  Its bots sent the same 2.8 frames a second, but the snapshot's own tree and harness, run the same hour as a control,
  heard 109 a second at p50 4.8 s, and the audited head 88 at 6.4 s. Those ages are the fleets' own queues again, and
  no relay code changed in these slices, so the relay's figures stand as the earlier boot measured them. A pose's age
  on Cloudflare is the staging pair's to say.
- **The storm's recovery is the client's own law.** On the audited head over three threads, the relay answered again
  2.4 s after it went down. The busiest second carried 56 mints and 616 statements, and there were 88 `busy`
  refusals. Half the fleet was back in 6.6 s, nine in ten in 11.8 s and every bot in 19.9 s, the stragglers waiting out
  their own backoff (the fleet's queue adds to those times on this boot). None of the slices moves it, and none was
  meant to.

### SCALE4a: a session and its player in one read

Every authenticated request resolved its secret in two reads, one after the other: the session by its hash, then its
player by id. The day before YARD-SHED those two were 4.86 and 4.73 million of the database's 17.4 million reads.
`resolveSession` (`accounts.js`) now asks one statement, `WHO_SQL`: the session's six columns under an `s.` prefix
(`SESSION_COLUMNS`) beside `p.*`, LEFT JOINed so every exit the two reads had is met in the same order - a session idle
past its year deleted first, an orphan refused, the stale touch unchanged.

**Measured:** one statement off every request that carries a session (all but the yards): -14.5% of the statements,
-17.2% of the play's (964 to 799 a bot-hour).

**Left, Mac's call:** a session kept in the isolate for a few seconds would take most of the session reads left, but a
sign-out or a revoked device would then take effect up to that long later on every other isolate.

**Pins.** `test/server/scale4a.test.js` (3): the two old reads are the oracle. `tools/mutants/scale4a.json`: 6 mutants, 6
dead.

### SCALE4b: the service's own clock

The service had no scheduled job, so what keeps its database small ran inside reads:
- the Notice Board swept its expired notes on every look, and a guild's board the same;
- the professions' state pruned old harvests on every gatherer's ask;
- the market's History ran nine deletes before it answered.

Those were writes on the busiest reads, every reader racing every other to run the same sweep, and none of those reads
could be served by a D1 read replica. And the tables nothing swept grew for ever.

**The clock** (`server-account/src/cron.js`; `wrangler.toml` `[triggers]`, `* * * * *` and `41 * * * *`):
- **Every minute** (`MINUTE_JOBS`): the settlements nobody's read should wait on - the auctions past their end, the
  guilds' writs and contracts past theirs, the seats' weekly Turning (while `SEATS_OPEN` is `on`), the season's #1
  before its kept word ages out (`ARENA_CHAMPION_CLOCK_S`), and the day's Motherlodes. Every one still runs on its read
  too, which finds it done: a read never answers from a world the clock has not caught up with.
- **Every hour** (`HOUR_JOBS`): the sweeps the reads no longer run, each its module's own law exported beside its table
  (`sweepBoard`, `sweepGuildNotes`, `sweepHarvests`, `pruneMarketHistory`, each delete a page), and the retention the
  tables never had - a rate window a day past its start, a session idle past `SESSION_IDLE_S`, and a guild invitation
  past its week.
- **A firing stays under D1's thousand statements an invocation** (AUDIT SCALE A2). Each job has its share of
  `FIRING_STATEMENTS_MAX` (600), and a settler stops between items once its share is spent. A closer counts what it
  moved, never what it picked, so a page that changed nothing is not asked again.
- The auctions' candidates are every auction that could close, the surely closable first (AUDIT SCALE A1: a sale under
  a seat's Tithe was judged without it, and twenty that could not close held the page). The season's #1 is counted
  again only after a bout; otherwise its kept word is stamped again (A4).
- Migration 0091 indexes what the clock asks every minute or hour: the contracts past their days or owed their escrow,
  and an old auction's bids (A3, A5). It does not index `sessions.last_seen`: that index would cost a written row at
  every stale touch to spare one hourly walk, and the sweep walks the table (A6).
- A job never stops another; each writes one metrics point (`cron:<job>`); a service held for maintenance runs nothing.
- The market's, the Work tab's and every guild's read used to issue their updates (expiry, the commissions, the
  succession) every time. They ask first now, so a read with nothing due writes nothing.

**Not pruned, and why** (also in `cron.js`'s header):
- **The act receipts:** a client asks an unanswered act again with no age bound (`net/profBook.js`), so a pruned receipt
  is an act that would run twice.
- **A guest with no session left:** unreachable, but its rows cascade through the realm, and its characters' objects in
  R2 would be orphaned (`deleteRealm` is the one door that cleans both).
- **`world_witness`:** compacted by meaning (the first agreeing witnesses decide a fact), not by age, and the seats'
  audit reads it. Its redesign is its own slice.

**Measured:** -13.7% statements on SCALE4a's (-15.1% of the play's) and -15.3% rows read. The board's read went from 6
statements to 4, and the sweeps' scans are gone from the rows read. The clock itself cost 4.4 statements a bot-hour
here: six minutes' firings and one hour's. On a quiet world it is about five statements a minute and seventeen an hour,
however many play (pinned, AUDIT SCALE D7) - twenty since INT2/INT5's two sweeps and INT9's (`06-Systems/Integrity-Arc.md`).

**Pins.** `test/server/scale4b.test.js` (6), over the real Worker. `tools/mutants/scale4b.json`: 27 mutants, 27 dead
(SCALE4b-sessions-unindexed retired by AUDIT SCALE A6); five earlier records re-aimed by content, and the 18 aimed into
the changed code all still die. PIN MOVED: AUDIT 30 S3, BAG1's AUDIT2 S1 and NOTICE1's expiry now run the hour's
firing; AUDIT SCALE moved scale4b's arena clock (A4) and its sessions plan (A6).

### SCALE4c: one heartbeat for a tab's three clocks

A tab at play asked the service on three clocks of its own, each its own request with its own session to resolve:
- the play beat every five minutes (`/v1/account/played`);
- the letterbox every three (`/v1/mail/inbox`);
- the Notice Board of the town it stands in every minute (`/v1/board/read`, for the count over its boards).

That was 92 requests a player-hour in a town. `src/net/heartbeat.js` carries whichever is due in one request to
`/v1/heartbeat` (`server-account/src/heartbeat.js`), which answers each part exactly as its own route does - the same
function, the same refusal word - so each book takes the answer it always took. Every clock keeps its own pace:
- A part goes when its clock says, and rides a heartbeat that is going anyway when it is due within `RIDE_EARLY_MS`
  (5 s).
- **The clocks fall into step from any phase.** A slower clock (its `every` no shorter) rides this heartbeat early when
  it would fall due before the soonest of the going clocks' periods, less `RIDE_EARLY_MS`. The going clocks start again
  as they go (each part counts its clock from the send), so it would otherwise go alone between their heartbeats.
  Entering a town starts the board's minute again, and the box's next look rides the board's heartbeat early rather
  than going alone every three minutes from then on. A faster clock never rides a slower one's early: it goes again
  within its own period anyway.
- **The knock waits for a ride, up to `BEAT_RIDE_MS` (2 minutes), and never past the grace.** The service credits a gap
  of `PLAY_GRACE_S` or less and nothing for a longer one, so a knock waits only while the last beat this page saw
  credited leaves room (`BEAT_GRACE_MARGIN_MS` short of the grace). The page's first knock goes at once, since nothing
  says how long ago the account last beat; so does the one after a dropped knock, and one where nothing will ride (a
  single-player world). (AUDIT SCALE B1: the wait had spent the grace that covers a missed knock - a 40 s alt-tab over
  the knock credited 910 s of a sitting's 1,500.)
- A hidden page sends no part, but a knock made while it was seen goes as it hides, kept alive past the page; the world
  host ticks the heartbeat at `visibilitychange`, so a tab closed first still sends it.
- A lost answer is asked again, `NOTICE_TRIES` in all, the board's own discipline. Each try is given up after
  `ACCOUNT_ACT_WAIT_MS` (AUDIT SCALE B2: one request that hung held all three clocks for the page), and a part whose
  service half throws is answered that part's `{ error: 'server' }`, the others theirs (A7).

The books join through small parts beside their own doors (`MailBox.heartbeatPart`, the notice book's
`heartbeatPart`), each saying its period. The box's look in flight on a heartbeat is the box's look, so the Letters tab
opened meanwhile takes its answer and asks nothing (AUDIT SCALE B3). The world host makes one heartbeat a page. Its
street frame stamps the town underfoot once a second by the wall clock, and its online lane stamps that it runs, so the
board is read and the box looked at exactly where and while they were. Of the four hosts, `world.js` alone keeps any
of the three: `exterior.js`, `worldModes.js` and `dungeonContext.js` keep none. The three routes stand, for the doors
that ask them alone.

**Measured:** in a town the three routes' 91.8 requests a bot-hour (303 statements) became 60 heartbeats (270): -35% of
those requests and -11% of their statements. Each heartbeat carries the board, every third the box and about every sixth
the beat, 4.5 statements a heartbeat, since one session read is saved for each request folded in. Like for like on
SCALE4b: -13.3% requests (-13.9% of the play's), -5.0% statements, -5.4% rows read. The harness's bots stay in one town,
so their clocks start in step and stay there; the falling into step is pinned instead: twenty-two requests in fifteen
minutes for a town entered half a minute into the box's three, seventeen now.

**Pins.** `test/net/scale4c.test.js` (8); `tools/mutants/scale4c.json`: 28 mutants, 28 dead. Re-aimed by content, still
dead: MAIL1's BOX-auth-kept and HOST-never-polled, NOTICE1-19, and eight of scale4c's own after AUDIT SCALE. PIN MOVED:
ACC4's play-clock host pin and MAIL1's host pin; AUDIT DROPS F's and CHAT1's host pins (the lane's stamp); AUDIT SCALE
moved scale4c's first knock (B1) and its street stamp (B7), and AUDIT WORLD7/8's hidden-tab pin to world.js's one
`visibilitychange`, the heartbeat's.

### Left, each with its reason

- **The session cache** (SCALE4a): Mac's call, above.
- **Read replicas:** SCALE4b's reads write nothing while nothing is due, so most of their calls could be served by a
  replica. A read that finds something due still writes, and must reach the primary. Routing them needs D1's Sessions
  API on every request, and a bookmark the client carries between its requests so a player reads their own writes;
  turning replication on is a setting on the database. Its own slice.
- **The board's 304:** its read is per reader (a muted author's notes shown to that author, a reporter's reports hidden
  from them, a moderator's view), so a kept or versioned board must still filter per reader. Its 180 statements a
  bot-hour (three in each heartbeat) are the largest single share left, just above Renown's 176. Its own slice.
- **`world_witness`, the act receipts, guests:** not pruned, for the reasons above.
- **The busy refusal's second mint:** found by SCALE3, above.
- **The staging pair:** SCALE3's second half, above.
- **The relay's pose path** (`07-Rendering/Performance-Next.md` 15): a relay deploy, in its own announced window -
  built as PERF-RELAY1, below.

## PERF-RELAY1: built (2026-10-09, its own branch - world184, NOT YET DEPLOYED)

Mac, of `07-Rendering/Performance-Next.md` item 15 ("needs its own pull request in a window you announce. Want me to
prepare it?"): "Yes and audit everything". Its own branch, `claude/relay-pose-path-ex6ce1`, so the deploy goes when Mac
says: merged to main, `.github/workflows/relay-deploy.yml` deploys **world184** (world183 on its branch, renumbered past
main's CHAP4c world183 at the merge), and every player is dropped once.

**What a pose cost.** `Room._message` is one method for every frame the room takes, and V8 will not optimize a function
past `--max-optimized-bytecode-size` (61,440 bytes of bytecode in node 22): `_message` is 76,752. So the room's hottest
path - every pose of every player, fanned to everyone in range - ran in the interpreter and the baseline compiler for
the life of the object. Inside it, every pose also copied the socket index into an array (`[...this._all()]`: two
hundred pairs at two hundred players) and derived the sender's map pixel again for every listener (`inRange`).

**The change, three parts, no behaviour of its own.**
- The pose-and-ping arm is a method of its own, `Room._poseFrame` (2,204 bytes of bytecode); `_message` hands it the
  frame as the arm took it
  (`server/src/index.js:"if (m.t === 'pose' || m.t === 'ping') return this._poseFrame(ws, a, m);"`). Every line of the
  arm is the arm's, in its order, but the two below - the fan's walk and its range test.
- The fan walks the index in place: nothing between the walk and the sends sends, closes or adopts a socket, so the copy
  guarded nothing.
- `net/wire.js` `inRangeOf(roomKey, from)` is inRange with its `from` fixed - a predicate over `to`, the sender's pixel
  derived once a fan (`src/net/wire.js:"export function inRangeOf(roomKey, from) {"`).

And POSE_FAR_SHARE's doc carries AUDIT 637 C2's correction (item 19): the clamp it describes is an arrival interval's;
a timed one (SCALE2b's `ts`) counts as itself. The file's bytes are the relay's version, so the correction waited for
a deploy; this is one.

**Measured** (`tools/relayPoseBench.mjs`, `N=50,100,200,256 POSES=4000`: the real Room over the pins' fake object,
counting sockets that parse nothing, every hello a real token, one moving pose a socket a round; the bench copied into a
worktree of the base, `e40f6dbb`, and the two run one after the other, three times each, the frames sent identical - at
the default POSES=3000 the 50's is 36.2, a round fewer):

| in one map pixel | us a moving pose, base (3 runs) | after (3 runs) | median | frames sent a pose (both) |
|---|---|---|---|---|
| 50 | 31.5 / 36.6 / 41.0 | 21.6 / 26.8 / 36.0 | 36.6 -> 26.8 | 36.3 |
| 100 | 56.6 / 52.4 / 59.4 | 32.0 / 33.7 / 37.8 | 56.6 -> 33.7 | 48.7 |
| 200 | 80.2 / 81.9 / 95.9 | 43.3 / 47.2 / 47.9 | 81.9 -> 47.2 | 73.8 |
| 256 | 106.3 / 89.9 / 95.7 | 45.6 / 51.2 / 50.3 | 95.7 -> 50.3 | 87.7 |

Node's CPU, relative only: a real object's sends cost what the runtime's sockets cost, which this does not measure. The
method of its own carries most of the saving, and the walk's two lines add to it once the method is optimized (AUDIT
PERF-RELAY1, each half alone, three alternating runs' medians, us a moving pose: at 200 the base 76.8, the method alone
50.8, the walk's lines alone 76.8, both 39.0; at 256 109.5, 65.2, 85.5 and 39.0 - in the interpreter the copy and the
per-listener pixel cost nothing it could see). PERF-NEXT's prototype measured 108.5 -> 39.3 at 200 with the arm
tightened further; this changes two of its lines.

**Pins.** `test/server/perfrelay1.test.js` (3): inRangeOf answers inRange over every key kind and pose shape (absent, empty,
NaN, infinite, a pixel edge, either side of zero); over a room of 60 past POSE_FAN_MAX, with listeners out of range and
listeners walking the range's edge and an id-less socket with a pose, every moving pose reaches exactly the listeners
`poseFan` names over those inRange hears, and a keepalive exactly everyone in range; `_poseFrame`'s bytecode is under
the ceiling and `_message`'s over it (a fold back leaves no `_poseFrame` to print). `tools/mutants/perfrelay1.json`:
8 mutants, 8 dead. `test/net/relayversion.test.js` carries world184's law; PIN MOVED: the files that pin RELAY_VERSION (35, 37 at
the merge of main),
`disc7`'s list of versions, `soc1.json`'s S38 record, and CHAT1's pin on the arm's order (`test/net/chat1.test.js`, read
off `_poseFrame` now, with the dispatch pinned beside it). Re-aimed by content, the arm one indent shallower, all dead:
ARENA4-STANDS-POSE-NOBODY, AUDIT1003b-R4-POSES-TO-ALL, AUDIT-SEATS-R2-gate-not-first, AUDIT-SEATS-T2-eye-fanned,
HOTFIX1003f-STRANGER-POSE-FANNED, PVPREF-relay-step-unjudged, SEAT1b-relay-a-channel-ticks.

### AUDIT PERF-RELAY1 (2026-10-09)

Mac's "audit everything", over this change: a cold adversarial reader of a frozen snapshot (4b6a53dd), told to reproduce
every finding. No HIGH or MEDIUM. The move is the arm's (a scope analysis: the arm read `ws`, `a` and `m` of `_message`
alone, wrote none; nothing in `_message` runs after it, no try or finally holds it, and `webSocketMessage` awaits the
method's promise before `_reap()` as it awaited the arm); the walk in place reads only, every await before it, every send
after it; `inRangeOf` against `inRange` over 300,000 fuzzed cases (NaN, both infinities, -0, 1e308, strings, arrays, a
missing axis, odd keys): no difference, the throws included. 27 of 27 existing mutant records inside `_poseFrame` dead,
perfrelay1's 8, the 7 re-aimed and S38; `--trace-opt` compiles `_poseFrame` by TurboFan and never `_message`. Its bench,
five alternating runs: 38.6 -> 27.4 us at 50, 57.1 -> 31.7 at 100, 87.4 -> 38.9 at 200, 107.0 -> 43.3 at 256.

| # | Finding | Verdict |
|---|---|---|
| L1 | The bytecode pin imported the relay by a path relative to the directory the suite ran from: from `test/` it failed | FIXED: by its URL; passes from anywhere |
| L2 | The pin measured the first function the filter printed, and failed on a better relay (`_message` under the ceiling) | FIXED: exactly one `_poseFrame` in the graph, under the ceiling and an eighth of it; `_message`'s size said, not pinned |
| L3 | The 50's frames sent, 36.3, reproduced as 36.2 | The bench's parameters: 36.3 at POSES=4000 (the record's), 36.2 at the default 3,000 - the record names them now |
| L4 | The record credited the saving to the walk's two lines; the method of its own carries most of it | FIXED: above, with the audit's halves |
| L5 | PERF-NEXT 15's note and `_poseFrame`'s doc said the arm's every line was its own (two changed); the Testing row's "an eighth" (under one); the bench's crowds and the base's copy unsaid | FIXED: the doc (re-hashed in place, undeployed), the note, the row, the parameters |


## SCALE4d and SCALE5a: merged (2026-10-10, #755 - world189 deployed; acct106's deploy stopped, SCALE4e)

Mac, 2026-10-10: "So we just hit 500 online people. I think its time to scale up our server and improve performance for
more people". That was the arc's target. There is no bigger server to move to. Every room is its own Durable Object,
and both Workers scale by request, so the limits are the two places where ONE thing serves everyone: the hub
(`chat:world`, where every player online holds a socket) and the account service's one D1 primary. Both were measured
before anything changed. The merge deploys the relay (world189, which drops every player once) and the account service
(acct106, no migration). Deploy the account service first, or in the same merge: it asks nothing of the relay, and the
relay asks nothing new of it.

### What 500 costs, measured

**The account database is the ceiling the field has already hit.** It overloaded twice on 2026-10-06 (YARD-SHED,
STORM-SHED). The worst five minutes held 3,658 token mints (STORM-SHED's 20:10), a failing service asked again and
again, in waves that had begun at a relay deploy (world174, 18:00). (AUDIT SCALE5a D13: this said the 3,658 were the
five minutes after a deploy; the record does not tie them to one.)
- **One mint, counted on the real Worker over node:sqlite.** A registered player's realm character runs 9 statements
  with the seats closed: the session, the Grand Champion's row, Renown, the guild, three reads of the character's realm
  row, the rating and the house. With the seats open (production's `SEATS_OPEN`) it is 12. In a cold isolate it is 17,
  one of them a write: a kept #1 missing or stale is counted again and stored. A guest naming no character runs 3 with
  the seats open, 1 with them closed. (AUDIT SCALE5a D12: this said every statement was a read, and the guest's 3 for
  either.)
- **The busy refusal's second mint** (SCALE3's "Left", above). A storm minted once per player, plus once more for every
  busy refusal. The hub's hello gate is asked BEFORE the token is read (a refused hello costs no signature check), so
  every one of those tokens was unspent, and the client minted afresh anyway.
- **How many that is.** `tools/hubWaveModel.mjs` models one deploy's wave: the client's own retry ladder
  (`_scheduleRetry`, BACKOFF_MIN_MS, BACKOFF_MAX_MS, the busy floor and its jitter) against the hub's own gate
  (`tokenGate` at CHAT_HELLO_HZ_MAX, burst the same), every socket dropped at once, no connect or mint time. It is a
  model, not a measurement, over twenty seeds: 624-642 busy refusals for 500 players (half welcomed by 5.0 s, the last
  by 13.3 s), 2,287-2,381 for 1,000, and 9,034-9,172 for 2,000 (the last by 44 s). Each was one more mint's dozen reads,
  all landing in the minute the database is busiest. (AUDIT SCALE5a D10: this quoted 400-600 and 6,500-8,600 from a model
  nothing in the tree could run again; the committed one, and the audit's own, say these.)

**The hub** (`tools/relayHubBench.mjs`: the real Room over the pins' fake object, every hello a signed token with an
account and a claim, as a hub hello is). Before this slice, each hub hello did six things that grew with the room:
- walked every socket for ONE-SEAT's other tabs (`_otherTabsOf`);
- walked every socket for a host, which a channel never reads (`_hostOf`);
- walked every socket for its id's old socket;
- walked every socket to list everyone else;
- copied the whole index to fan its join;
- dropped the account index whole, so `_helloAccount`'s first ask rebuilt it with another walk.

Each leave did three more passes and a rebuild. So a relay deploy's reconnect wave was O(N^2) in CPU on top of its
N^2/2 join frames. `_message` is past V8's optimizing ceiling (PERF-RELAY1), so its own loops ran interpreted.

### SCALE4d - the token's reads off the one primary

- **On one D1 session.** The mint (`/v1/auth/token`, `server-account/src/service.js` REPLICA_ROUTES) runs on one
  session (`replicaDb`, D1's Sessions API).
- **Opened `first-primary`** (REPLICA_CONSTRAINT). Its first statement, the session lookup, is the primary's. Every read
  after it may be served by a read replica at least as new as that answer: one session is sequentially consistent. So a
  mint reads exactly what the primary held when it began.
- **Why not `first-unconstrained`.** A guest made a moment ago would be refused `auth` by a replica that has not yet
  seen its session, and the client takes `auth` as final. A realm character created a moment ago would mint `rc` 0,
  which the relay refuses at its door.
- **Writes.** A write in a session (a stale session's touch, a region's chapters written over the version they read)
  goes to the primary. Replicas take no writes.
- **The honours on the binding** (AUDIT SCALE4d A1). The one read-then-write a mint makes is the arena's and Iliac
  Hand's #1, counted again and stored when the kept one is missing or stale (`arena.js` championNow, `iliac.js` the
  same). Counted off a replica as new as the session lookup, the store put back a #1 that a rated bout had just moved
  past, and the clock only re-stamps a kept #1. `withArenaHonours` and `withIliacHonours` run on the binding, as before
  SCALE4d; the claim reads ride the session.
- **Everything else is unchanged.** Every other route stays on the binding, the primary, as before. Nothing else was
  reasoned about for a replica.
- **Counted the same.** `metrics.js` countedDb opens the session through itself, so a mint's statements still count on
  its metrics point.
- **One store per isolate.** The session answers DB_ROOT with the binding it came from, so what an isolate keeps beside
  its database (the seats' rows, the towns' layouts) stays one store.
- **No sessions, no change.** A binding without sessions (a harness, an older runtime) is answered as it stands.
- **The switch.** `account-deploy.yml` turns the database's read replication on at every deploy, after the migrations:
  `PUT /accounts/{account}/d1/database/{id}` with `{"read_replication":{"mode":"auto"}}`, the same token that creates
  the database. A PUT of the mode it already has changes nothing. A refusal is a warning, never a stop: without
  replicas, every statement of a session is the primary's, which is exactly today.
- **The wealth budget's config, kept by the binding** (`budget.js`, found reading the caches for this slice). It kept
  its config a minute by the `db` object a request handed in. A deployed service counts every request through a Proxy
  made for that request (`countedDb`), so it kept nothing past its own request, and every realm checkpoint read
  `realm_config` again. It is keyed by DB_ROOT now, as STORM-SHED's seat rows are.
- **Unmeasured.** The account Worker ran under Smart Placement, which SCALE1 took to be beside its primary (D1-NEAR
  measured it in Sydney, bounds the primary to western North America, and places it beside the primary by name). Whether a
  replica takes the mint's reads from there, or the nearest instance is the primary itself, is Cloudflare's to say. The service's
  metrics will show whether a deploy's wave still overloads the primary. Correctness does not depend on it: a
  `first-primary` session reads what the primary would.

### SCALE5a - the hub without a walk of every socket, and a busy refusal that mints nothing

**The relay** (world189):
- **The account index is kept, not rebuilt.** The doors that move a socket's account move that one socket: `_setAttach`
  and `_forget` call `_reindex`, through the module's `keyMove`. A subject index sits beside it (`_bySub`), so
  ONE-SEAT's other tabs are read off it with no walk.
- **Same order as a walk.** Each account's sockets are a set, read back in the index's own order. That order is the
  order a walk gave: each socket is stamped as it enters the index (`_enter`), and goes last when deleted and set again,
  as a Map does.
- **Rebuilt only when the index is re-walked**, and never staler than the socket index: `_byAcct` and `_bySub` ask
  `_all()` first. The pins' oracle found the kept index answering past IDX_TRUST_MS. The old one had the same shortcut,
  but rebuilt so often that it rarely showed.
- **A channel's hello asks no host.** `before` is a place room's question.
- **The hello's walks are methods of their own**: `_withId`, `_othersOf` and `_fanBut`. This is PERF-RELAY1's remedy:
  small enough to optimize, each reading exactly what its loop read.
- **The fans walk the index in place.** This covers the join's and the leave's (`_fanBut`) and a channel's line and a
  guild's. A failed send forgets its socket mid-walk, which a Map's iteration takes.
- **A drain without a copy.** The leave tells "the room drained" from the runtime's list without a filtered copy of
  every socket.
- **A hub hello reads its serpent receipt once.** `_noSerpentRcpt` works as the gate's, the Abyss's and the raid's
  receipt sets do, dropped whole when a kill writes receipts. It was the one storage read every hub hello still made.

**The busy refusal mints nothing:**
- The room's hello gate, asked before the token, closes 1013 with the reason `BUSY_TOKEN_UNREAD` (`net/wire.js`).
- The session remembers which token each socket's hello carried. On that close it hands the token back to the minter
  (`OnlineSession._tokenUnread`, `accountTokenMinter` `unopened`), and the room's retry carries it again within
  TOKEN_REUSE_MS instead of minting.
- A gate asked after the token (a battle's, a floor's, an Abyss realm's) still closes 'busy' alone: its token is spent,
  and handing it back would be refused as a replay.
- Only the reason is new, never the code, so a client from before reads 1013 and mints as it did.
- This covers every cell, halo, hub and region channel: every room whose gate comes first.

**The World tab's count past the cut** (the client audit, 2026-10-10; built again by AUDIT SCALE5a, below). The hub's
welcome names the first CHAT_ROSTER_MAX (512) sockets and counts the rest (`n`). At 500 online the hub is at the cut.
Past it, the client kept the count by arithmetic, a join +1 and a leave -1 for the ids it knew, and the header only
climbed: an unnamed player's leave never came off, and an unnamed player's reconnect (a join, with no leave for the
socket it replaced) counted again.
- **The room says its own count.** A channel's join and its leave carry the count the room can name (`n`, as the
  welcome does: hello'd sockets, never one the object closed or whose leave is said - `_namedCount`), and the client
  takes it (`online.js`). Nothing it is told can drift it: the audit found three doors that moved the arithmetic for good
  - a claim's closed tab, a joiner whose welcome failed, a reconnect after its old socket's leave - and a fix for each
  door would have left the next one.
- **A relay before it**, which says no count, gets the arithmetic: a leave of an id this list never held counts too.
- **A room let go takes its count with it** (`_forgetRoom`): a World tab superseded by another device's claim said
  "Online - 600" over an empty list (before this slice too).

**And the frame.** The client's `tick()` walks its peers in place. The hub link's peers are everyone online, and the
copy was an array of all of them a frame, per link, with the chat closed too.

### Measured

`tools/relayHubBench.mjs` over the base (`68ba8b63`, a worktree) and this tree after its audit, one after the other,
three alternating runs each, medians. Every hello is a reconnect's, with no claim, as a deploy's wave of them is (AUDIT
SCALE5a D15: the first measurement's hellos claimed). These are Node's CPU on this container's four cores, relative only.
The bench's sockets count what they are sent and copy nothing, which makes a send free; a runtime's send costs a copy at
least, so `COPY=1` copies each frame as it is sent (AUDIT SCALE5a D6), and both are given:

| hub | the wave, ms (all N hellos) | a hello, median us | the drain, ms (all N leaves) | the same three, each send copying its frame |
|---|---|---|---|---|
| 500 | 449 -> 345 | 851 -> 640 | 53 -> 18 | 482 -> 379, 969 -> 710, 74 -> 32 |
| 1,000 | 1,193 -> 891 | 1,142 -> 818 | 170 -> 56 | 1,342 -> 889, 1,301 -> 803, 247 -> 102 |
| 2,000 | 3,434 -> 1,898 | 1,767 -> 901 | 730 -> 243 | 3,858 -> 2,102, 1,921 -> 1,008, 1,044 -> 461 |

- **A hello still climbs with the room, by far less.** 640, 818 and 901 us at 500, 1,000 and 2,000 (+41%), where it
  was 851, 1,767 at 2,000 (+108%). What is left of the climb is the join's N sends. A hello's floor is its token's
  Ed25519 verify, the same in both arms. (AUDIT SCALE5a D11: this said a hello's cost no longer climbed.)
- **With every send copying**, a hello at 2,000 is about half the base's and the drain about 44%. Without the copy, the
  drain is a third.
- **The audit's own cost.** Each channel leave now counts the room once (`_namedCount`), so the drain at 2,000 is 243 ms
  where the first measurement's was 180, and the `n` on every channel join adds about 9% to the wave's bytes (180.7 ->
  197.3 MB at 2,000; 15.0 -> 16.0 at 500). The frames sent are the same in both arms: 125,750 at 500, 501,500 at 1,000
  and 2,003,000 at 2,000.
- **The welcome's largest frame** is the cut roster's, 28-29 KB in both arms.

### Left, each with its reason

- **The join's N sends.** Each hello still sends one join to every socket, so a wave is N^2/2 frames: 125,750 at 500
  (15 MB from one object) and 2,003,000 at 2,000 (181 MB). Coalescing the joins into one frame a moment is a wire change
  every client must learn (an old tab would miss the roster until it reloads), and it is the hub split's to do.
- **CHAT_SOCKETS_MAX (2,048).** Every tab online holds a hub socket, and one connecting counts too, so past about 2,000
  online the hub refuses 'room full' during a wave. The hub split (SCALE5) is the answer. It is four times today's
  count away, and the relay's metrics (`daggerfall_relay`, the hub's `chat` kind) will say when.
- **CHAT_HELLO_HZ_MAX, unchanged (50).** A busy refusal now costs no mint, so the gate's price is a player's wait for
  the hub, not the database's load: half welcomed by 5.0 s at 500, by the model (`tools/hubWaveModel.mjs`). Raising it moves the same sends into
  fewer seconds.
- **The World tab** shows 200 rows (ROSTER_ROWS_MAX) and has no search, and past 512 sockets the welcome names the
  oldest 512 only. Its count now holds; who it lists is a UI slice.
- **A `wdun` word** ('die', and the crows' and the giants' lapses) fans to every hub socket with no room budget: one
  client can make two sends a second per socket. It is a referee's arm (PVPDUNGEONS), left for a slice with its law in
  hand.
- **The traveller fan and a place room's look-change join** still copy the index. Neither is the hub's.
- **Whether a replica serves the mint** beside the primary (D1-NEAR's placement): unmeasured, above.

### Pins

- **`test/server/scale4d.test.js` (7).** The mint runs on one session opened `first-primary`, the session lookup first, every
  claim read through it, and the honours alone on the binding (A1). No other route opens one: the play beat, the
  heartbeat, Renown's report and the realm's list, each answered 200 (D3). The claims are byte for byte the binding's,
  the same token. The metrics point counts the session's statements and the honours'. DB_ROOT is the binding, through
  the counter too, and a binding with no sessions is answered as it stands; the fake's session is a class that reads
  its own fields (D8). The budget's config is read once across two requests' Proxies, and forgotten for both by a staff
  change. The deploy turns replication on after the migrations and before the Worker, mode auto, never a stop (D5).
- **`test/net/scale5a.test.js` (13).**
  - The kept account and subject indexes answer EXACTLY what the old walks answered: over six seeded stories of the
    hub's own doors (hellos, reconnects, claims, drops) and four at the index's own doors. The latter adopt, set,
    clear, forget and set again, let a socket go unannounced past IDX_TRUST_MS, and run an account past
    ACCOUNT_TABS_MAX. The old walks are the oracle.
  - A hub hello and leave keep the index object, and a channel walks for no host.
  - The join and the leave reach every hello'd socket but the one they name, including through a send that fails
    mid-walk.
  - A channel's join and each of its leaves say the room's count; seeded stories of real channel links over the real hub
    past the cut (claims, failed welcomes, reconnects after a leave, closes the runtime keeps listed) hold every link's
    count at the room's after every door.
  - A hello the gate refuses carries an unspent token: the same token opens the room once the gate refills, where a
    spent one is refused. Only that one door says so.
  - The minter's `unopened`, and the session's hand-back on that reason alone - a halo's too (D4).
  - Each leave of two sockets that die in one fan says the count without the other; a superseded link lets its count
    go.
  - No empty set is kept in either index after any door of the index stories (D7).
  - The serpent receipt is asked once, and handed over once one is written.
  - The drain is told while the runtime still lists the last socket.
- **`tools/mutants/scale4d.json`**: 12 mutants, 12 dead. **`tools/mutants/scale5a.json`**: 32 mutants, 32 dead (the
  three of `re` retired with it; six of the room's count and four of the audit's gaps added).
- **PIN MOVED:**
  - ACCOUNT_VERSION's pins (acct106), 18 files and KNIGHT-HOUSE-version-unmoved.
  - RELAY_VERSION's pins (world189), 38 files, `disc7`'s list, `soc1.json`'s version record, and `relayversion`'s row.
  - `accountdeploy`'s verifier pin reads a step's live lines (the replicas' PUT is no `v1/` of the service's).
  - ROSTER-G's count pin: a leave for an id the cut list never held now counts; a join and a leave that say the room's
    count are believed (the audit).
  - ROSTER-G's and CHAT1's frame pins: a channel's join and leave carry `n`.
  - SOC1's and AUDIT DEEP2 C's source pins (`_fanBut`, `_othersOf`).
- **Re-aimed by content, every one still dead:** A10-bound-keeps-the-stalest-tabs, A10-bound-off,
  FA-F4-the-fan-bound-one-socket, FA-F4-the-bound-three-short, GATEKEYS-the-empty-var-back,
  GUILD1c-guild-line-to-everyone, ONESEAT-own-socket-counted, G2-channel-join-not-said, G4-channel-join-carries-the-look,
  G13-count-not-moved-by-leave, G14-count-moved-by-a-repeat-join, AUDIT-DEEP2-C-welcome-ghosts,
  SCALE2b-socket-not-adopted, S37-picture-before-the-welcome, STORM-SHED-hello-unsaid; the audit re-aimed G4, G13, G14
  and S37 again (the count on the join and leave) and CARDS10-service-honours-door (the honours on the binding).

### AUDIT SCALE4d + SCALE5a (2026-10-10)

Mac: "Lets audit what we have." Five cold lenses over a frozen snapshot of the pull request's head (`48ebeb52`, a
worktree), each told to reproduce every finding against the base (`68ba8b63`) and to say what it found sound: the
relay's indexes, walks and fans (R); the unread token, end to end (T); the account service's session, cache and deploy
step (A); the client's count and frame (C); the record, its pins, mutants and measurements (D). The tree was not
touched while they read; their scripts are not committed.

Sound, as reproduced:
- **The relay's indexes** against the old relay in one clock, 200 seeds of 250 doors each (R). Every frame, close code
  and stored key matched but the `re` field, and `_socketsOf`, `_otherTabsOf` and `_speaker` answered a fresh walk at
  every step. The base's own cached index disagreed with its own walk 64 times; the kept one never did.
- **The in-place fans.** Nothing a fan's send calls adds to the index or re-walks it.
- **The unread token** (T). It is said at one door, before `_named`, in every gate-first room (cell, town, dungeon,
  interior, the hub, a region's channel, the arena's hall, a private interior, a caravan). A spent token's replay is
  refused `token spent`, and no path hands one back. A swapped socket, a halo and a demoted socket each hand back their
  own. There is no tight loop, and either half alone behaves as before.
- **The mint on a session** (A, over a fake shaped as workerd's `D1DatabaseSession`, a replica served from a snapshot at
  the bookmark). The same token as the binding's; every claim read off the replica after a primary session lookup; a
  guest made a moment ago welcome under `first-primary` and refused `auth` under `first-unconstrained`. Writes reach
  the primary (the touch, the chapters over their version).
- **The figures.** The statement counts and the bench's direction reproduced. The tick's in-place walk is the old one,
  1,500 peers and 750 pruned.

| # | Lens | Sev | Finding | Verdict |
|---|---|---|---|---|
| C1 = T2 = D1 | C, T, D | MEDIUM | A ONE-SEAT claim's closed tab: its leave reached the claimer after a welcome that had already counted it out, and the new leave rule took it off again - one low per claim, past the cut | FIXED: the room's count on every channel join and leave (`n`, `_namedCount`); the client takes it |
| C2 = R2a | C, R | MEDIUM | A joiner whose welcome failed: its leave said, no join ever - every cut count one low | FIXED: as C1 |
| C3 = T1 = R1 = D2 | C, T, R, D | MEDIUM | `re` said for a reconnect whose old socket's leave was already said (a socket the runtime still listed) - one low, named players too | FIXED: `re` retired; the join says the room's count |
| R2b | R | LOW | After a wake, a closed socket's leave said a second time (`_gone` is the instance's) | FIXED: as C1 - the leave says the count, not a difference |
| C-pre | C | LOW | A superseded World tab kept "Online - 600" over an empty list (before this slice too) | FIXED: `_forgetRoom` lets the count go with the room |
| A1 | A | LOW | The mint counted a stale #1 off the replica and stored it on the primary, over a #1 a rated bout had just moved past | FIXED: the honours on the binding |
| A2 | A | LOW | REPLICA_ROUTES' doc said the mint writes nothing but a touch | FIXED: the doc names its writes |
| A3 | A | LOW | The replicas step logged `HTTP 000000` on a refused connection, `auto` for an answer without a mode, no Cloudflare error | FIXED |
| D3 | D | MEDIUM | scale4d's "no other route opens a session" probed two routes the service never served (404) | FIXED: real routes, each 200 |
| D4 | D | MEDIUM | A halo's hand-back unpinned - its mutant lived | PINNED |
| D5 | D | MEDIUM | The deploy's replication switch unpinned - `"mode":"disabled"` lived through every workflow pin | PINNED: its place, its PUT, its body, no stop |
| D6 | D | MEDIUM | The patch notes gave CPU ratios from a bench whose sends are free, and a database effect the record calls unmeasured | FIXED: the notes say what the server does |
| D7 | D | MEDIUM | `keyMove` letting an empty set go - the law of an index that lives as long as the object - unpinned | PINNED |
| D8 | D | LOW | The fake session's methods ignored `this`, so a `replicaDb` that dropped its bind lived | FIXED: the fake a class with private fields, as workerd's |
| D9 | D | LOW | The hub story's doc said shared profiles ran an account past its bound - they never did | FIXED: the doc; the bound is the index story's |
| D10 | D | LOW | The busy refusals quoted from a model not in the tree, and low | FIXED: `tools/hubWaveModel.mjs`, the figures its own |
| D11 | D | LOW | "A hello's cost no longer climbs" over numbers that climb | FIXED: the measurement below |
| D12 | D | LOW | "Every statement is a read" (a cold mint stores the #1), the guest's 3 for either seat setting | FIXED |
| D13 | D | LOW | The 3,658 mints tied to a deploy the record does not tie them to | FIXED |
| D14 | D | LOW | SCALE4's row still left the replicas | FIXED |
| D15 | D | LOW | The bench's hellos claimed the seat; a wave's are reconnects | FIXED: the bench's are reconnects |
| D16 | D | LOW | A mutant named in scale5a's title with no record of its own | FIXED: AUDIT-SCALE5a-D16-bound-unread |
| D17 | D | LOW | Commit 4f6eff6b's message says scale4d (5) and 7/7 - the next commit made them 6 and 8 | RECORDED: a pushed history is not rewritten; this record's counts are the tree's |
| D18 | D | LOW | Active-Arcs called both overloads a reconnect wave - YARD-SHED's was the yards | FIXED |

Considered, not reproduced, each with its reason:
- **A hello landing between another's `_othersOf` and its id** (T) used to leave the count one off. It is harmless now:
  every later join or leave says the room's count.
- **A replica read entering an isolate cache.** A session answers DB_ROOT with the binding, so a cache keyed by it could
  take a replica's read (A). No function on the mint's path reads one; a route added to REPLICA_ROUTES must be read
  for it.
- **A mint's second statement waiting for a replica** to reach the primary's bookmark (A). This is unmeasured, as
  above.
- **A serpent receipt's stale "none"** needs a handler between its read and its set (R). Cloudflare's input gates
  allow none.

Re-measured after the fixes: the table under "Measured", above. Pins, below.

## HALO-THIN: built (client only, no relay deploy)

The owner, 2026-10-10, after PEER-RANGE (`07-Rendering/Performance-Priority.md`): *"For you when you are near a player
within 41 pixels. Theres 10 position updates every time. Multiply it by the times the player is near you and its an
insane bottleneck."*

**Found.** WORLD6b-iii(b) gave a player near a cell's edge a halo socket into each neighbouring cell within range
(`wire.js` `cellHaloFor`): one along an edge, three at a corner. A cell is 16 map pixels and a halo opens within 3
of its edge, so about three fifths of the map holds one and about one in seven places (the corners) holds three.
`OnlineSession.sendPose` sent every pose down the cell's socket AND every halo's. A neighbour holding the same rooms
heard each pose once per room it shares: two copies astride an edge, four at a corner. Each copy was fanned by its own
room, carried, parsed and gated. SCALE2b's `ts` applies the first to arrive and drops the rest - so a copy bought only
the quickest room's head start, and multiplied the relay's fan work, the bytes and the receiving client's parses by
the rooms shared.

**Why a halo hears a pose at all.** By `cellHaloFor`'s own symmetry everyone within range of me WANTS my cell, so its
fan alone reaches them all. That is why foes are never streamed to a halo (`online.js` `_halo`). A halo needs my pose
for:
- its fan ranging me as a LISTENER, on the map pixel (`inRangeOf`);
- its near tier ranking me among a sender's POSE_FAN_MAX nearest, by ground distance (`poseFan`);
- its roster placing me for a newcomer's introduction;
- the relay's judges of a word sent down that socket: a duel's opening ring (`duelOpen`, 12 m) and its bout
  (`duelPose`) - a duel's frames go to the room my opponent is heard through (`sendDuel` -> `_socketFor`); a rite's call
  (`riteNear`, 60 m, down the circle's cell socket); a serpent fight's trail (`_trailing`); a raid's word (my pixel);
  an Abyss find (160 m of the pixel's centre). The open zone's referee is not among them: it holds a fighter by the zone
  word, which `setWildZone` says down my own cell's socket alone (AUDIT B F4).

**The law** (`net/online.js` `haloPoseDue`). A halo hears a pose when it is due:
- its first since its welcome (per SOCKET - a reconnect's new socket, or AURA-LIVE's swapped one, has heard nothing);
- a new map pixel, either way (the range's own grain, and the raid's word);
- HALO_STEP_M (8 m) moved on the ground since the last it heard (the near tier's ranking);
- standing at a place it has not heard - a stop, or a walk under the step then a stop (AUDIT B F3);
- the heartbeat. A fall is `sendDeath`'s, down every socket as before.

It goes whole - every pose, the law before this - while my own cell's socket took none (AUDIT WORLD6b-iii(b) A5); while
it reaches a player in range who does not hold my cell (`_haloAlone`: a member of that room, within range of me, that
my own room does not report - their socket into my cell still opening, backing off or refused busy, who hears me
through the halo alone; AUDIT B F1); and while the host says a referee may stand in one: `haloWhole`, raised by
`scenes/world.js` for a duel (`duelMgr.duel`) and this frame's serpent fight (`_serpentFight`). A duel's or a rite's word
sent down a halo first brings it my latest pose when its last is not that (`_haloCurrent`, AUDIT D3), so the judge reads
where I am. And a halo is pinged on its own clock (AUDIT B F2): its poses no longer keep it busy, so it holds RELAY-H1's
PING_MS cadence like every socket.

THE FOUR HOSTS: `scenes/world.js` WIRED - its online frame runs the one session, raises `haloWhole` and reads
`_serpentFight`. `scenes/worldModes.js` and `scenes/dungeonContext.js` send no pose of their own: the interior's and
the dungeon's ride `world.js`'s online frame. `scenes/exterior.js` runs no online session.

**Measured** (`tools/haloThinProbe.mjs`: the real `OnlineSession`, its own gate and clock, over `test/fakeSocket.mjs`,
60 frames a second, 60 s a run; the counts exact; "copies" the most a neighbour holding all the same rooms can get - the
far tier may serve it fewer):

| where | pace | frames sent a second, before -> after | copies a neighbour gets of each pose, before -> after |
|---|---|---|---|
| a corner (3 halos) | walk 4 m/s | 35.4 -> 10.3 | 4.00 -> 1.16 |
| a corner | run 8 m/s | 35.4 -> 11.8 | 4.00 -> 1.33 |
| a corner | ride 16 m/s | 35.4 -> 14.1 | 4.00 -> 1.59 |
| an edge (1 halo) | walk 4 m/s | 17.7 -> 9.3 | 2.00 -> 1.05 |
| an edge | run 8 m/s | 17.7 -> 9.8 | 2.00 -> 1.11 |
| an edge | ride 16 m/s | 17.7 -> 10.6 | 2.00 -> 1.19 |

What one inbound pose costs a client was measured beside it (node 22, the real session's `_receive` over the fake
socket, this container's CPU): 2-8 us. In a crowd a sender speaks less (SLAM3's `poseHzFor`: 4 a second at 120 peers),
so 120 neighbours at a corner were 1,920 copies a second - and 480, plus the due ones, after. PERF-ON4's own figures
work out to about 19 us a message in real Chromium on this container (its inbound column over the messages its crowd
sent): a derivation, not a measurement. The relay's side is each halo room's fan of each copy, gone with it.

**What a player sees.** Movement as before: a neighbour holding my cell hears every pose from it. Three differences,
none a jump: one who held two of my rooms got whichever copy came first, and now gets my cell's (a quicker halo's head
start is gone); in a crowd past 32, a halo ranks me as a listener by a pose up to 8 m old; and a neighbour whose socket
into my cell is opening or refused gets every pose through the halo, as before.

**Left.**
- The far tier by DISTANCE is still a relay deploy. SLAM6's far tier serves one pose in four to listeners past a
  sender's 32 nearest, by rank. A listener past every draw distance (PEER-RANGE's 600 m) still hears a near crowd's every
  pose. Serving such listeners one in POSE_FAR_SHARE, or none past a bound, is the relay's `_poseFrame`, and it waits for
  the next announced relay batch (with PERF-RELAY1's and SCALE5a's).
- Found beside it, not this change's (AUDIT B F4): a duel asked across a cell's edge never opens - each side's word goes
  down the socket the other is heard through, so the ask and the yes land in two Durable Objects; and a blow in the open
  zone across an edge lands in a room where its striker is no fighter. Both want one room for a pair; recorded, not built
  here.

**Pins.** `test/net/halothin.test.js` (11):
- the step, and the law, every arm of it;
- the real session at a corner - its own cell every pose, each halo one each 8 m, the stop and the heartbeat;
- standing and turning - the halo hears the place once (the stop the session records);
- whole under `haloWhole` and with its own cell's socket really dropped;
- alone - a halo whose room reports a player in range my own does not;
- AURA-LIVE's swapped socket and a real reconnect each hearing the next pose, and a fall;
- never ahead of a welcome;
- the halos' own keepalive;
- a referee's word bringing the halo current;
- the host's word, said before the frame's pose, and the zone word's socket.

Mutants: `tools/mutants/halothin.json`, 32 dead. SCALE2b's stamp-per-room record re-aimed by content at the halo's send
(dead). The word moved one line up after CI: WAGONS2-VISIT holds `caravanVisitLink.close()` against `if (!key)`.

AUDITED the same day (`01-Overview/audits/Audit-Peer-Range-Halo-Thin.md`): what it changed is written into this section as it
now stands.

## SCALE4e: built (2026-10-10, this branch - the account deploy outlasts an overloaded database)

PR #755's merge deployed the relay (world189) and the account service (acct106) at once. The relay's deploy dropped
every player at about 20:23 UTC, their reconnect wave minted a token each against the one D1 primary, and the account
deploy's `migrations apply` - its first query, with no migration pending - landed 23 s into the wave:
`D1 DB is overloaded. Requests queued for too long. [code: 7429]`. The step failed, so nothing after it ran: no
replication switch, no Worker. world189 asks nothing new of the service, so nothing broke, but SCALE4d did not ship.
It is the arc's thesis measured once more, in production: at about 500 online, one relay deploy still overloads the
primary within half a minute.

- **The fix.** `Apply migrations` asks again on D1's overload alone - D1 refusing to queue a query that never ran, so
  asking again is safe - after 20, 40, 60, 90 and 120 s (5.5 minutes, the 2026-10-06 storm's worst five), and stops at
  once on any other failure, as before. It names what it saw: a warning per wait, an error that says to re-run once
  the database settles.
- **What it does not fix.** The wave itself. That is SCALE2c and SCALE4f, below.
- **Merging it deploys acct106.** The workflow deploys on a change to itself (`account-deploy.yml` lists its own path),
  so this merge re-runs the deploy that stopped - with SCALE4d in it, since main already carries it. (AUDIT SCALE II
  D-10: written at acct106. Main's own account deploys since (acct107-111) each carried SCALE4d already; this merge's is
  acct112.)

**Pins.** `test/tooling/scale4e.test.js` (4) runs the step's own script under bash, as the runner does, over a fake wrangler
that answers as D1 did and a fake `sleep`: an overload asked again after each wait and the deploy going on once the
database answers; a migration that fails for any other reason stopping it at once; a database overloaded past the
last wait stopping it with the error; the one apply line and the step's place. `tools/mutants/scale4e.json`: 5
mutants, 5 dead. Re-aimed by content, still dead: ACC1CI-4 (the migrations listed again), whose apply line now
sits inside the retry.

## SCALE2c: built (2026-10-10, this branch - the client's half, no relay deploy)

The plan's first slice: two changes to the client that the relay and the account service need nothing for. The site's
deploy ships them; nobody is dropped.

### A relay deploy's reconnect, spread by the hub's own count

**The cause.** A relay deploy closes every socket of every player at once, and each page's first retry was uniform
over [1 s, 2 s] (`_scheduleRetry`). A page mints one token for its sockets (SCALE2), so every player online asked the
account service for one inside the same second or two - 500 at once at today's count. #755's deploy measured what
follows: the primary overloaded 23 s in (SCALE4e).

**The fix** (`src/net/reconnectWave.js`, one per page, which the world host hands to the presence session and every
chat link):
- **A wave** is two or more of the page's open sockets dropped within WAVE_WINDOW_MS (2 s) of each other while the
  browser says it is online. A deploy closes them all in one instant. One room's object restarting closes one, and a
  lost network takes the browser offline first; neither is held. (AUDIT SCALE II C-2b: an unclean close fires `error`
  before `close` in a browser, and the error overwrote the status the drop was read from - no page in a browser formed a
  wave; the drop is read off the status as it stood before the error.)
- **The spread** is as long as the hub takes to admit everyone online at its own gate: `n / CHAT_HELLO_HZ_MAX`
  seconds (WAVE_MINTS_PER_S), from the count the hub link already hears (`n`), capped at WAVE_SPREAD_MAX_MS (40 s) so
  it stays inside TOKEN_REUSE_MS and a page's sockets still share one token.
- **Each page draws one offset** in it, once a wave. At a socket's first retry after the drop (the cell's, a halo's,
  the hub's, the region's), it waits until the page's slot if that is later. The slot is the same instant for every
  socket of the page, so the page still mints once.
- A busy refusal, a tokenless one and a terminal close are not drops: their ladders are unchanged. A session made
  without the page's wave (a test's, a tool's) weighs only its own sockets and knows no count, so it spreads nothing.

**Measured** with `tools/hubWaveModel.mjs` (a model: every socket dropped at once, no connect or mint time; twenty
seeds, the median), which now counts each page's mint and takes `SPREAD=1`:

| players | busy refusals at the hub | the busiest second's mints | hub welcomes, median / last |
|---|---|---|---|
| 500 | 635 -> 32 | 500 -> 102 | 5.0 / 13.3 s -> 5.2 / 12.9 s |
| 1,000 | 2,329 -> 81 | 1,000 -> 102 | 10.0 / 24.6 s -> 10.2 / 23.0 s |
| 2,000 | 9,108 -> 163 | 2,000 -> 102 | 20.0 / 44.4 s -> 20.1 / 42.9 s |
| 5,000 | 56,119 -> 35,256 | 5,000 -> 254 | the hub's own gate and cap (SCALE5c) |

The hub could not welcome them faster anyway, so nobody waits longer for the hub. **The cost** is the cell: a page
that saw the wave comes back to its own cell at its slot, not in a second or two - at 500 online, five seconds later
on average, ten at most. (AUDIT SCALE II D-9: the slot is that late; the delay it adds to the retry before it averages
3.6 s and peaks at 9.0 s. The 5,000 row said 56,138 and 257; the model, run again, says 56,119 and 254.)

**AUDIT SCALE II D-4 and L4 - two doors this did not weigh.** SCALE5c (below) gives the hub sixteen gates, so after
world192 the hub alone welcomes a wave far faster than `n / CHAT_HELLO_HZ_MAX` (a model of sixteen gates at 2,000: the
last at 6 s with no spread, at 40 s with it). And main's ADMIT-LINE, merged into this branch, holds every token mint in
one line let in ADMIT_RATE a second (5, a burst of 25, `server-account/src/admit.js`): a wave of N players is minted in
about (N - 25) / 5 s whatever the spread - 95 s at 500, 395 s at 2,000, half an hour at the arc's 10,000. While the line
is the slower door the spread costs nobody a token; it only spreads the line's arrivals and the cells' hellos. Live (60
bots, the real relay and account service in local workerd, the relay restarted under them): 51 of 111 mints answered
`queue`, every bot back in its cell in 13-17 s. The minter now waits the line's own `wait` (AUDIT SCALE II L4a). Which
door sets a reconnect's pace - the line's rate for a mint, or the spread - is Mac's (`01-Overview/audits/Audit-Scale-II.md`,
L4). Before this, at 500, the mints overloaded the database, and a page whose mint failed waited
out STORM-SHED's cooling instead.

### A full foes frame that says nothing, said once

**The cause.** In a cell every client streams its own foes whenever anyone else is there, and a full frame went every
FOES_FULL_MS (2 s) even from a player with nothing in the world: no foe, no camp, no horse, no boat, no ring, no
portal. Its whole word was "none". In a crowded city that is about 128 frames a second to each client, and they spend
the room's 4 MiB/s foes budget, past which the relay drops frames silently, real fights' among them.

**The fix** (`src/net/foesQuiet.js`):
- `quietFoesFrame` reads a built frame as quiet when every field but its own bookkeeping (`n`, `k`, `full`) is
  absent, null or an empty list. A field it does not know, with any other value, is news, so the frame goes.
- `quietFoesGate`, the cell stream's memory, leaves a quiet full frame unsaid only when the same room's last frame
  from it was a quiet full one. So "none" is said once to each room, the first after anything else (which is what
  takes the owner's last foe down at a reader), and a reader's own staleness sweep (FOES_STALE_MS) lets the owner go
  with nothing to take.
- Deltas, the own lane, a dungeon host's stream (its frames are the readers' heartbeat of the host) and a refused send
  are untouched.

**Pins.** `test/net/scale2c.test.js` (8):
- the spread's law;
- the wave's rules;
- a page's cell, halo and hub driven over the pins' fake socket, held to one slot and reopened in one instant;
- a lone drop, two busy refusals, and a drop with the browser offline back at the old retry;
- the world host handing the page's wave to all three sessions;
- an idle player's frame built from its producers (the pool, the horse's word, the riders') read as quiet, and
  each kind of news read as news;
- the gate's memory per room, delta, refusal and world room;
- the cell stream asking it.

`tools/mutants/scale2c.json`: 17 mutants, 17 dead. One more survived its first run, `sent` checking a cell that `skip`
already checks. It was redundant, so it is gone.

## SCALE4f: built (2026-10-10, this branch - acct112, no migration)

acct107, then acct108 and acct109, on the branch: main's LW15 (#749) took acct107 first, TECH1 (#746) acct108 and
PATRON-LOAD (#763) acct109, PATRON-LOAD II (#767) acct110 and HOME-VOTE (#762) acct111, so the merges moved this
deploy to acct112 and every ACCOUNT_VERSION pin with it.

The account service's half of the plan, first part.

### The mint's realm row, read once

A mint asked four statements of the same `realm_characters` row:
- whether the named character is the account's realm character in play (`rc`, realmCharacterHeld);
- its level (`cl`, realmLevelOf);
- its arms (`wa`, realmArmsOf);
- its house, through its line (legacy.js realmHouseOf).

`server-account/src/realm.js` realmMintFacts asks one: the row and its line in one `LEFT JOIN`. It answers the four's
answers, the three behind `rc` as the mint asked them. The four are gone from the service, so the law has one home.
Their reasons (REALM-DOOR, INT9's lease, LEGACY7's tombstone, ARENA4b's and INT7's level, INT7's arms, LEGACY7's house)
are carried into the fold's own comment.

Measured on the real Worker over node:sqlite (test/accountDb.mjs), a realm character's mint on its session:

| | before | after |
|---|---|---|
| seats closed | 8 | 5 |
| seats open (production) | 11 | 8 |
| plus the honours on the binding (AUDIT SCALE4d A1) | 1-3 | 1-3 |

The guild's reads (the guild badge, the seat badge, the ribbon - three reads of one membership) and the write
coalescing are left, with their reasons below.

### How busy the one primary is

**Before.** The metrics point counted a request's statements (`double3`). It never said how long D1 made the request
wait, and a primary going under shows first as that wait: a queue D1 exposes nowhere else.

**Now** `server-account/src/metrics.js` countedDb wraps each statement it prepares (timedStatement):
- every way of running one (`first`, `all`, `run`, `raw`) and every batch is timed;
- an answer's `meta` gives its rows read and written, and whether a read replica served it (`served_by_primary` false);
- a `first()` answers a row with no meta, so its rows go uncounted, but its wait does not.

Each method is called on the statement itself, and D1's batch is handed its own statements back. workerd's are a class
with private fields, and AUDIT SCALE4d D8's law holds one level down too.

The point grows four doubles after its three:

| Double | Holds |
|---|---|
| `double4` | rows written (a cron point's `double4` is the rows its job changed: the same measure) |
| `double5` | the D1 wait, in ms |
| `double6` | rows read |
| `double7` | the statements a replica served |

The last says, for the first time, whether SCALE4d's replicas serve the mint at all.

### An overloaded D1, counted apart

**Before.** #755's deploy met D1's overload (SCALE4e), and the service answered an overload as any other fault:
`server`, 500.

**Now** it is still `server`. Every book asks that again, and a new word would be a final refusal to the eight books
whose retry lists do not know it - an act dropped, not kept. But it is 503 (service.js d1Overloaded: D1's "overloaded",
"queued for too long", its code 7429), so the metrics count an overload apart from a bug.

### Part two: the mint's guild membership, read once

The guild's badge (guilds.js guildBadgeOf), the seat badge (seatTurning.js seatBadgeOf) and the Season's ribbon
(seatRibbons.js ribbonOf) each read the named character's `guild_members` row for itself: three statements of one row.

`guilds.js` mintMemberOf now reads it once: the member row (its rowid, guild, rank and when it joined) and its guild's
(id, tag and heraldry, through a `LEFT JOIN`). Each of the three takes it as `member` and keeps its own law over it:
- the badge needs the guild's row;
- the seat badge reads the guild's holds and the member's rank;
- the ribbon asks the Season's ribbon of the member's guild, earned no earlier than the member joined - the old join's
  own `m.joined_at <= r.at` - in the guild's colours as they are now.

Asked without `member`, each reads as it always has, so each law still has one home.

A realm character's mint with the seats open:

| | before | after |
|---|---|---|
| a character in no guild, where a Season stands | 9 | 7 |
| a character in no guild, with no Season | 8 | 7 |
| a member | 9 | 8 |

**The writes, each left with its reason:**
- **The session's touch.** Its second statement writes `players.last_seen`, which nothing reads. Its own comment records
  the decision to keep it - a column that silently stops being maintained is worse than one that costs a write, and
  dropping it is a migration - and the column is NOT NULL in every insert and fixture. It is about 2% of writes, so it
  stays.
- **The checkpoint's four writes.** They are one batch, one transaction, carrying the Integrity arc's verdict and its
  guards (a rev, `mustChange`). Folding them would rewrite the judge's own steps.
- **Renown's report every minute** (AUDIT SCALE II A-N4: SCALE4h, below, coalesced it after all - by what the answer would say, the bar's ghost drawing the rest). Its answer draws the page's own bar, so its pace is the player's to notice, and a
  slower report is a gameplay change.
- **`TOKEN_REUSE_MS`**: as the plan says. A room would hear a level or a guild up to four minutes stale.

**Pins.** `test/server/scale4f_guild.test.js` (2):
- the three asked with the one read held to each reading for itself, over twelve membership states and every Season;
  the states are none, a member, the guildmaster with a palace and a crown seat, a ribbon earned while a member, before
  it joined and the instant it joined, another Season's, two Seasons', no heraldry, heraldry that is no JSON, and a
  member whose guild is gone (D1 refuses to leave one; the read is held to it all the same);
- the mint reading the character's membership once, its tag signed.

`tools/mutants/scale4f_guild.json`: 7 mutants, 7 dead. The banner's own law made one survive its first run: a test
banner the law refused read as the plain ribbon either way. The pin now flies a lawful one. Re-aimed by content, all dead: AUDIT MERGE-PLUS
A6, GUILD1c-mint-guild-off-the-body and -every-character-the-accounts-guild (now aimed at mintMemberOf's read), and
SEASON1-idx-badge-season.

**Pins.**
- `test/server/scale4f.test.js` (5):
  - the fold held to the four, frozen as they stood at acct106 and copied into the test, over fourteen states of four
    characters for two askers, every arm reached on both sides;
  - the mint asking its realm row once, with its token as it was;
  - every statement's wait, rows and a replica's serving, over a D1 shaped as workerd's (private fields, a batch that
    refuses what it did not make);
  - the point's seven doubles;
  - an overload a 503 `server` and any other throw a 500.
- `tools/mutants/scale4f.json`: 16 mutants, 16 dead. Two more survived their first run:
  - a tombstone's lease, which no death writes, so the oracle now stands one;
  - the house asked behind its line, where houseOn already answers null, so that check is gone.

PIN MOVED:
- scale4d's two statement counts (eight to five).
- ARENA4b's, INT7's, LEGACY7's and REALM-DOOR's direct asks of the four, now asks of the fold's fields.
- Nine mutant records re-aimed by content onto the fold: ARENA4B-TOK-ANOTHERS, -SUMMARY-UNREAD, -BOUND and -OFFLINE,
  INT7-AUDIT-REALM-ANOTHERS-ARMS and -THE-LEVEL-UNJUDGED, LEGACY7-dead-held-at-the-door (still equivalent: a death clears
  the lease) and -tomb-wears-house, LEGACY7-mint-no-house, and REALM-DOOR-rc-any-realm-shaped-id and -rc-any-account.
  All dead. And SCALE1-B-statements-uncounted, whose prepare is timed now.
- ACCOUNT_VERSION's pins (18 files, and the fb1004d and gatekeys records) to acct107, then acct108 at the merge past LW15, then acct109 at the merge past TECH1, then acct110 at the merge past PATRON-LOAD, then acct111 at the merge past PATRON-LOAD II, then acct112 at the merge past
  HOME-VOTE.

**Found on the way, fixed.** LEGACY7-model-rewritten survived, on main too: a line's model change sent with the stored
copy's `base` reached the UPDATE, which keeps the model column, and would have written a record that says another
model. Only a write with no `base` was pinned, and the stale path refused that one. `test/server/legacy7_service.test.js` now
sends one made from the stored copy, and the mutant dies.

## SCALE4g: built (2026-10-10, this branch - acct112, beside SCALE4f; no migration)

SCALE4d put the mint's reads on a D1 session opened `first-primary`. The reads a tab keeps asking - the heartbeat
(every minute in a town), the account view, the realm's list, the professions' state and the day's motherlodes - still
all read the one primary. They read the player's own writes back, so a replica could only serve them once the tab can
say how new a replica must be.

**The service** (`server-account/src/service.js`):
- REPLICA_ROUTES is now route AND method: the mint (POST), the heartbeat (POST), the account view (GET), the realm's
  list (GET), the professions' state (POST) and the day's motherlodes (POST).
- `routeDb` runs such a request on a D1 session started from the bookmark it carries (`x-d1-bookmark`, d1BookmarkOf).
  Every read is then at least as new as everything that tab has seen and written. A request with no bookmark starts at
  the primary, as does one whose bookmark D1 will not take. (AUDIT SCALE II A-1: that held for what the tab READ - a
  write on a route of the binding (a realm's join, a checkpoint, a sale) answers no bookmark, so a mint after the tab's
  own join could read a replica from before it: `rc` 0, which the relay's door takes as final, or a lease since moved
  still signed. The mint now always starts at the primary (PRIMARY_FIRST_ROUTES), SCALE4d's guarantee; the client keeps
  the others in step, below.)
- `fetch` wraps `route` and hands the session's newest bookmark back on the answer, exposed to the page. The preflight
  allows the header.
- Each route's writes stay the primary's:
  - the beat is a single `UPDATE`, which a session sends to the primary;
  - the motherlodes' pick is an `INSERT OR IGNORE` of a pure roll, read back on the session after it. (AUDIT SCALE II
    A-5: a roll over witnesses a stale replica read, kept for the day - the pick now asks the primary's day mark, then
    reads, writes and reads back on the primary; a kept day is read on the session.)
- The one read-then-store - the arena's and Iliac Hand's #1, counted again and STORED where stale - runs on the binding
  wherever a session route asks it, as AUDIT SCALE4d A1 put the mint's there: the letterbox's and the board's authors'
  honours through `ctx.primary` (letters.js, board.js).
- The seats list stays on the binding. Its isolate keeps its rows a minute, and a replica's read could refill that
  cache with rows older than the Turning that just emptied it.

**The client** (`src/net/accountClient.js` `call`, the one door every account call goes through):
- It keeps the newest bookmark any answer under its session secret has said, and sends it on every call. (AUDIT SCALE
  II A-2, A-6, C-7: on the service's bookmark reads alone (`D1_BOOKMARK_READS`, REPLICA_ROUTES twinned, the mint among
  them). Any other call forgets it, as it goes and as it is answered, and a read sent before a forget keeps nothing; an
  offline call, a body that never came and a bookmark read answered with none forget it too; the realm's and the cloud
  saves' writes, which do not go through `call`, the same. A tab's reads ride a replica only between its own writes: a
  Sigil Broker sale whose answer was lost read back off a replica from before it handed the stones back while the
  service kept the sale, and a service rolled back to acct111, whose preflight refuses the header, failed every call.)
- D1's bookmarks begin with fixed-width hex positions, so an answer that arrives out of order never replaces a newer
  one.
- It belongs to its secret: a sign-in, a new guest or another account starts with none. A session made a moment ago is
  therefore never looked for on a replica that has not heard of it - SCALE4d's reason for `first-primary`, kept.
- It lives in memory, so a new page starts at the primary.

**What it moves.** By the service survey's model, about 55-62% of the reads a playing tab asks leave the primary once
replicas serve. SCALE4f's `double7` will say whether they do. With the Worker beside the primary (D1-NEAR - Smart
Placement had run it in Sydney), whether D1 then serves a session from a replica is the open question SCALE4d named.

**Pins.**
- `test/server/scale4g.test.js` (4):
  - the routes by route and method, and the session's start (the bookmark, none, one D1 refuses);
  - the header's law;
  - over the real Worker: a heartbeat's session started from its bookmark and its answer carrying the newer position
    its beat wrote, exposed; the account view and the realm's list on sessions; a write route opening none and saying
    none; the preflight;
  - a heartbeat's letterbox badging its sender's honours on the binding and none on the session (and by source, the
    board's);
  - the client: none at first, the answer's kept and sent back, an older one never over a newer, a malformed one never
    kept, another session starting with none.
- `test/accountDb.mjs`'s fake sessions now answer the database's position as their bookmark (`d1Position`).
- `tools/mutants/scale4g.json`: 13 mutants, 13 dead.

PIN MOVED:
- scale4d's route list and its "every other route" probe (the heartbeat and the realm's list ride sessions now).
- Re-aimed by content, all dead: SCALE4d-routes-empty, -mint-on-binding and -every-route-on-session;
  ACC1b-24 and REALM1-cors-shut (the preflight's header list); AUDIT1003-S8's two (the honours, now `{ db: primary }`).

**Also fixed:** SCALE4f's `d1Overloaded` had been inserted between SCALE4d's comment and the constant it describes.
They stand together again.

## SCALE5b: built (2026-10-10, this branch - relay world191 on it, folded into world192 past main's WARDEN1; NOT YET DEPLOYED: one announced drop)

The plan's fifth slice: the relay's hygiene and the wire's second form, in the one relay deploy it costs. A socket that
offers nothing hears every frame byte for byte as world190 said it, so an open tab from before it keeps playing. (AUDIT
SCALE II R1-6 and D-11: but for a cell's welcome, which says `rf` to every socket, the second wire's or not; the relay
before this is main's world191, WARDEN1; and the pins hold the frames parsed and in their order, not their bytes.)

**The second wire** (`src/net/wire.js` POSE_BATCH_MS, ROSTER_BATCH_MS, WIRE2_BATCH_MAX, slimPose, wire2Batch):
- **Offered by the hello.** A session asked for it (`wire2`, which the world host asks on every socket the page holds -
  the presence session, its halo, each chat link and the hall) says `w2: 1` in its hello. The relay keeps it on the
  socket's attachment. Any other value is read as no offer rather than refused, so a later build's third form still
  gets in on the wire both know. A relay before world192 (main's WARDEN1 world191 among them) reads no such field and speaks the first wire, which the
  client still reads.
- **A room's poses, batched and slim.** A pose fanned to a `w2` socket is owed it as a slim entry `[id, pose]`, built
  once a pose, and every socket's owed entries go out as one `{t:'poses', l}` frame each POSE_BATCH_MS (50 ms, one
  timer a room). `slimPose` leaves out the fields at the value validPose would fill them with, and rounds the place to
  what a reader can see - a native room's x and z to whole world units (2.5 cm), the height and every other room's place
  to the centimetre (SLIM-FRAME, below: as built here it rounded all three to whole units in every room, and a height is
  metres) - and the turn to a ten-thousandth of a radian; validPose reads it back as the pose it was. A standing pose
  goes from about 157 bytes to 66 (two or three more since SLIM-FRAME: the height's centimetres).
- **A channel's roster, batched a second.** A channel's join and leave to a `w2` socket are owed it for ROSTER_BATCH_MS
  (a second): a hub's reconnect wave of N joins was N^2/2 frames, one a join a listener.
- **One order.** Everything owed a socket is one queue in the order the room said it, and goes out ahead of any other
  frame the room sends that socket (`_send`), so a leave never overtakes the pose said before it. Poses alone are a
  `poses` frame; anything else is one frame batch (`{t:'fb', f}`) with each run of poses one `poses` frame where it fell;
  one frame alone is itself. A queue that reaches WIRE2_BATCH_MAX goes out at once, and a reader takes no more from a
  batch, nor reads a batch within one.
- **A boss's beat, one frame.** The gate's, a siege's, a Remnant's, a serpent's and a bout's beats sent each of their
  frames as a send of its own to every socket; a `w2` socket hears them as one frame batch, at once (`_fanFrames`).

Measured on the real Room over the pins' fake object (`node tools/wire2Bench.mjs`, every socket on one wire, then on the
other):

| Scene | First wire | Second wire |
|---|---|---|
| 120 players moving in one block, 5 s at 20 Hz | 129,024 sends/s, 24.8 MB/s | 2,462 sends/s, 10.8 MB/s |
| 600 players arriving at a region's channel at its gate | 180,300 sends | 4,907 sends (the bytes the same) |

A send is what the runtime charges a Durable Object for: the cell's fan is about fifty times cheaper, and its bytes
under half. The client parses the same frames either way.

**The relay's hygiene** (`server/src/index.js`):
- **The host kept, not walked for.** A world room asked `_hostOf` on every foes frame, memory write and blow - a walk of
  every socket each. It keeps its answer until a socket's id or hello stamp moves (`_reindex`) or the index's re-walk
  finds the room moved, and walks only for the one question it cannot answer from that (the host asked without itself).
- **Directed frames by an id index.** A blow, a heal, a who's answer, a trade, a cast, a card, a wedding's word, a page,
  a duel's and a siege's blow each found its target by copying the whole index and searching it - O(N) and an array of N
  a frame. `_idFirst`/`_withId` read an id index kept as SCALE5a's account index is, and answer exactly what the search
  answered: the first socket but the sender holding the id, in the index's order.
- **The foes fan, a method with its budget asked first.** The foes and own arms ran inside `_message`, which is past
  V8's optimizing ceiling (PERF-RELAY1), so their walks ran interpreted. `_foesFan` is a method, and a frame the room
  cannot afford for even one listener is dropped before any walk - in a crowded cell, where the budget drops most of
  them, that was a copy of the index and a range test a socket for nothing. The bucket is left exactly where the old
  law left it (refilled to now, nothing spent).
- **The drain's sweep, not paid twice.** A room's last leave sweeps it, and its next first hello swept it again: a
  halo's every step into an empty cell paid both. A room now remembers, while awake, that its drain swept and nothing
  has said hello since. A woken room, or one a socket left with nothing said, sweeps as before.

**The metrics point**, `double13` on (Analytics Engine takes twenty; these are the last eight):

| Double | Holds |
|---|---|
| `double13` | sockets refused `room full` - the door that refused them counted nothing before (AUDIT SCALE II R1-5: the Worker's walk's last refusal alone - a layer the walk passes, full, counts nothing) |
| `double14` | frames the room's byte budgets dropped (foes and own) |
| `double15` | the most sockets the room held in the window |
| `double16` | foes frames (and OWN1's own lane, AUDIT SCALE II R1-6) |
| `double17` | blows |
| `double18` | chat lines |
| `double19` | items the second wire carried in batches |
| `double20` | the batch frames that carried them (items over batches: the sends saved) |

**The relay's settings, at run time** (`src/net/relayCfg.js`). BOSS_BODY (the line the boss fights' count runs by) and
the herald's three Discord roles were the Worker's vars alone, and a var changed is a Worker redeployed - every player
online dropped, to move one number. A developer now sets each in game, `/relay <setting> <value>` (a staff command, the
Developer's alone - a token whose glyphs say `dev`), and `/relay <setting> -` hands it back to the var:
- the hub keeps it in its storage and answers what is now in force; anyone else is answered in words and struck for
  nothing; outside the hub the frame is junk. (AUDIT SCALE II R1-4: a value its consumers would not read - a role not
  a role id, a bossBody not a body line - is refused in words and nothing kept);
- the hub's herald reads it at once (the herald is rebuilt when the settings are read or move);
- a boss's room - the gate's court, an Abyss realm, a serpent's cell - asks the hub at its beat at most every
  RELAY_CFG_TTL_MS (a minute), and a hub that does not answer leaves the last answer standing (AUDIT SCALE II R1-2:
  asked, never awaited - the answer is the next beat's; a slow hub froze a fight up to 5 s a minute);
- the var is the setting while the hub holds none.

**A halo told when its cell judges poses** (`server/src/index.js` _refereesPoses, `_rfSay`). SCALE2c moved a halo's
pose rate here because the relay judges fights off the poses that reach each cell, a halo's copies too:
- a cell that judges them - a duel's bout, the Wild zone's fighters, a serpent's fight - says so in its welcome (`rf`)
  and, when that moves, to the second wire's sockets (`{t:'rf', on}`);
- a halo to such a cell hears every pose.

SCALE5b first built its own thinning beside that word: a halo heard a pose that only moved at most every 250 ms
(`HALO_POSE_MS`, `poseSaysMore`). Main's HALO-THIN (above, PR #761, client only, audited) landed first and thins the
same copies by a better grain - a new map pixel, 8 m on, a stop, the heartbeat. At the merge, HALO-THIN became the
halos' one law, and SCALE5b's thinning, its constants and its relay-version gate were taken out. The relay's `rf` is
kept as one more reason a halo goes whole beside the host's `haloWhole`: the relay knows its own referees, the Wild
zone's among them.

**Pins.**
- `test/net/scale5b.test.js` (22):
  - slimPose's round trip over every field the wire carries;
  - the relay's batch: one frame of slim entries in order, the first wire byte for byte, the hello's offer, owed frames
    ahead of any other, a closed socket owed nothing, one timer a room, the bound;
  - wire2Batch's runs; a channel's roster batched a second and flushed ahead of a line; the client's frame batch read
    frame by frame against the same frames said one at a time;
  - the host, the id index and `_withId` held to their walks over random stories of hellos, reconnects, closes, silent
    closes, wakes and re-walks;
  - the drain's marker; a beat one frame; the foes fan held to its law over budgets below one listener's worth,
    between one's and all of theirs, and above - and the index never walked for a frame refused below one's;
  - the metrics; the settings' law, the hub's keeping, the herald's roles, a boss's room's ask and its minute, the
    client and `/relay`;
  - the relay's referee word, and the session hearing it: a halo whose cell judges poses hears every one.
- `tools/mutants/scale5b.json`: 90 mutants, 88 dead, 2 equivalent as recorded (a hello stamp never moves without its
  id; an id never held by two sockets where `_idFirst` is asked). Five went with the thinning at the merge past
  HALO-THIN, and the referee word's was re-aimed by content at HALO-THIN's condition.
- `tools/wire2Bench.mjs`: the table above.

PIN MOVED, each a pin that read a line SCALE5b moved:
- RELAY_VERSION's pins (39 files and the soc1 record) to world191; `test/net/relayversion.test.js` holds world191's law,
  and `src/net/relayCfg.js` joins the relay's import graph.
- The chat links' constructor (chat1, chatroster_namefilter, scale2c's default), the join and leave fans (scale5a,
  soc1_hub), the healer's lookup (gateheal), the herald's roles (discordgates, sdherald, serpent2_herald), the staff
  commands' list (staff1), the calls between rooms (scale2b: nineteen, fifteen on ROOM_CALL_MS), the metrics point's
  doubles (scale2b), parseClient's doc (`cfg`), and serpent1_auditbooks' failing hub (it fails the kill's tells alone -
  the cell's beat asks the hub for the settings too).
- `.github/workflows/account-deploy.yml` lists `src/net/relayCfg.js`: wire.js imports it, so the account Worker
  bundles it.
- Re-aimed by content, all dead: AC-relay-fans-to-the-room, AUDIT1003-S1 x2, AOWN x2, GATE-HEAL-the-peer-never-read,
  JRN-relay-self-not-junk, ONESEAT-R1 x2, OWN1 x3, G2-channel-join-not-said, SCALE2b-socket-not-adopted,
  SCALE2b-stamp-per-room, SCALE2c-link-own-wave, SCALE5a-adopt-unplaced, U7-foes-borrows (now killed by the band
  between one listener's worth and all of theirs, which slam11's own pin cannot reach past the budget asked first),
  Q10-budget-after-scan, DISCORD-GATES-the-herald-ignores-its-door, INT11-RELAY-ENFORCE-DEFAULT, SD-HERALD-own-role-unread,
  SERPENT2-own-role-unread, X12-welcome-without-v.

**Found on the way, fixed:** the kept host first answered over a room whose index walk was due - its oracle caught it
before it shipped (`_hostOf` now asks `_all()` first, as its walk did).

**The deploy.** One announced relay drop: SCALE2c spreads its reconnect wave, SCALE4e's deploy outlasts the database's
overload, and the account service (acct108) ships first or with it. Nothing in it needs a database migration. (AUDIT
SCALE II L1: not by hand - `.github/workflows/relay-deploy.yml` deploys on every push to main whose RELAY_VERSION is not
the live relay's, a siege's blackout aside, so the MERGE is the drop. The account service is acct112.)

## SCALE5c part one: built (2026-10-11, this branch - relay world192, NOT YET DEPLOYED: one announced drop with SCALE5b's)

The plan's sixth slice, its hub half. Every player online held one socket in ONE object, the hub (`chat:world`): 2,048
sockets at most, and every hello, leave, line and friend act ran through it. A hub link now lands on one of sixteen
shards, which holds it; `chat:world` is the world's bus, and runs every law it ran before over a socket of its own for
each shard's.

**The shards and the bus** (`src/net/hubShards.js`; `server/src/index.js` ShardSocket):
- **Which shard.** `chat:world.<k>`, k the verified account's subject hashed (FNV-1a, `shardHash`) mod HUB_SHARDS
  (16). Every tab of one account lands on one shard, so ONE-SEAT, the account's newest tab and its receipts stay one
  object's to judge. At 10,000 online that is about 625 sockets a shard.
- **A shard holds the socket**, its roster (its own shard's), its joins and its leaves, and answers a socket's hello,
  ping and pose itself. Every other frame goes to the bus as it came, unparsed, in a batch every HUB_BATCH_MS (25 ms),
  on a gate of the shard's own (HUB_UP_HZ_MAX, 16 a second, a burst of 32 - past it a junk strike) and never past
  HUB_FRAME_MAX (the hub's largest frame, a shared quest's).
- **The bus keeps everything it kept** - every account's record, the parties, the receipts, the world's state - and
  runs each frame over the socket's ShardSocket: an object that answers a socket's four calls, whose sends are owed
  its shard and whose close closes the real socket there. Nothing is migrated and no law moved. A tab from before this
  build still joins `chat:world`, and the bus keeps it as the hub always did.
- **Between them**, a shard's hellos, frames and closes go up (`/internal/hub/up`) and the bus's frames come down
  (`/internal/hub/down`), each frame once a batch and each socket's in the order said, with one delivery in flight a
  shard so nothing overtakes. A frame for everyone (a world line, a roll, a red line) is one entry a shard, never one
  a socket; a guild's line goes to the guild's own sockets (a guild index, kept as the account index is).
- **The plan said fat hubs** (each fetching its accounts' records from the bus, and calling the others hub to hub).
  Built instead: thin shards and a fat bus. Nothing moves, the laws are where they were, and the bus's share of a
  hello and a world line is measured flat to 10,000 (below). Its steady load is the party poses; that is the number
  to watch. (AUDIT SCALE II D-6: "flat" said too much - the table's own world line is 1.31 ms at 2,000 and 2.39 ms at
  10,000, and one sample of it swings 2.6 times between runs. What the shards take off the bus is SENDS - a world line
  one entry a shard - which the bench counts and its fake socket makes free; read the sends, and the times as one run's.)
- **The doors.** A hello on the wrong shard is told the right one (`{t:'hub', key}`) and closed (CLOSE_HUB, 4001),
  nothing written. A hello of this build to the bus itself (`hs: 1`) is told its shard the same way, before anything
  is held, so its close says no leave. A hello that offers nothing is the bus's to keep.
- **ONE-SEAT across them**: a claim on a shard closes the account's tab on the bus. A reconnect on its shard replaces
  its ShardSocket with nothing said.
- **The hub's count** is the bus's: its ShardSockets and its own sockets, never a walk of every socket. Each shard
  hears it on every delivery, and within HUB_COUNT_MS of any hello or leave. A shard says it to its sockets
  (`{t:'n', n}`) at most every HUB_COUNT_MS, and its welcome, joins and leaves carry it.
- **Healing.** A bus woken without its ShardSockets answers a shard's frame for one it lost `unknown`, and the shard
  says that socket's hello again. Every HUB_SYNC_MS (the shard's alarm) a shard hands up every socket it holds, and
  the bus lets go of any it does not.

**The client** (`src/net/online.js`, `src/scenes/world.js`): the hub link's hello offers the shards (`hs: 1`) and goes
where the hub says (`hub`). The page keeps whether its relay has them (`dfjs.hubShards`, read off every welcome's
version), so the next page goes straight to its own shard. A shard that never opens twice in a row is a relay before
them: the link goes to the bus and offers the shards no more that session. (AUDIT SCALE II C-2: the word is kept per
relay URL (`dfjs.hubShards@<url>`); "never opens" is a socket that never fired `open` - a browser fires `error` before
the `close`, and the status test never matched; and a relay without the shards moves every unwelcomed shard link to its
channel at once.)

**The World tab (Mac's decision 2).** The count is the hub's. The list:
- its own shard's members, live;
- while the hub holds no more than a roster says (CHAT_ROSTER_MAX, 512), everyone, asked of the bus at most every
  HUB_WHO_MS (15 s) while the tab is drawn. The bus keeps its answer a second, so a batch carries one frame. At today's
  numbers the list is the whole hub, as it was;
- friends, as the social panel already lists them, every shard's;
- the Guild tab adds the guild online on every shard (`find` with `g`, every HUB_GUILD_WHO_MS);
- a search of everyone online by name: `/find <name>` or `/who <name>`. (AUDIT SCALE II C-1: both on a relay with the
  shards alone - `findOk`. A relay before them closes a hub link that says `find` (`unknown message`, for good); on one
  the line says it needs a newer relay.) The bus answers HUB_FIND_MAX names whose
  folded name holds the search's (case, spaces and apostrophes dropped), on a socket's bucket and the hub's
  (HUB_FIND_ROOM_HZ_MAX, 10 a second). Past it the answer is "too many are searching", said.

**Found on the way, fixed before it shipped:**
- A shard ran its own pre-parse doors first. The shared quest's door asks the socket's account, which only the bus's
  ShardSocket carries, so every quest share would have closed its sender's hub link. The forward now comes before
  every door.
- The name filter over a party pose's place name was half of what a pose cost the hub (measured). The filter is a
  pure function of the text, so its verdict is kept (`wire.js` labelAllowed, 512 at most).
- The bus's count walked every socket on every hello and leave: 0.73 ms a hello at 10,000. It is O(the bus's own
  sockets) now.
- A guild ask's dedup by account was code no pin could reach (ONE-SEAT seats an account's one tab), so it was taken out.

**Measured** on the real Room over the pins' fake object (`node tools/hubShardBench.mjs`; each object's own calls
timed apart, the doors between them stubbed and fed what the other handed it, the token signing not counted):

| | One hub, 2,000 | Sharded, 2,000 | Sharded, 10,000 |
|---|---|---|---|
| A hello | 1.23 ms, 2,001 sends | 0.90 ms on its shard, 0.14 ms on the bus | 1.25 ms on its shard, 0.10 ms on the bus |
| A reconnect wave, whole | - | 279 ms of the bus's, 171 ms of the busiest shard's | 988 ms of the bus's, 822 ms of the busiest shard's |
| A world line | 3.90 ms, 2,000 sends, one object's | 1.31 ms on the bus (2.8 KiB to the shards), 0.31 ms on the busiest shard | 2.39 ms on the bus (2.8 KiB), 0.83 ms on the busiest shard |
| Party poses, everyone in a four, one a second | - | 0.046 ms a pose on the bus: 92 ms of its second | 0.032 ms a pose: 317 ms of its second |

At 10,000 everyone's reconnect costs the bus about one second of work spread over the wave. Its share of a world
line does not grow with the hub (AUDIT SCALE II D-6: in sends; its time is one sample's, above). Party poses are its steady load: a third of a core if every player online is in a
party, which nobody is. If the bus's metrics run hot, the next step is party poses shard to shard.

**Pins.**
- `test/net/scale5c.test.js` (12): the law; the bus running a shard's socket as its own (welcome, picture, a world line
  everywhere, a friend request across shards); a shard's roster and the hub's count, told and said; the hops; ONE-SEAT
  and a reconnect; the woken bus, a lost hello and the alarm's sync; the search; the session; the bus's fans (a
  world line one entry a shard in its batch's order, a guild's line, the guild online, the hub's search budget); the
  World and Guild tabs; a shard's forward (before its doors, bounded, gated); the World tab while the hub is small.
- `tools/mutants/scale5c.json`: 70 mutants, all dead.
- `tools/hubShardBench.mjs`: the table above.

PIN MOVED, each a pin that read a line SCALE5c moved:
- RELAY_VERSION's pins (40 files and the soc1 record) to world192. `test/net/relayversion.test.js` holds world192's law,
  and `src/net/hubShards.js` joins the relay's import graph.
- `.github/workflows/account-deploy.yml` lists `src/net/hubShards.js`: wire.js imports it.
- The channel whitelist (chat1, chatchan: sixteen more). The hub's hello words moved into `_hubHelloWords` (auditraid,
  sd3, sd9a, soc1). The welcome and join counts (srvn). The attachment's row (wb9g). The roster fan (scale5a). The
  calls between rooms (scale2b: twenty-one, seventeen on ROOM_CALL_MS). The session's hello (soc2: `hs`). The hub
  link's room in world.js (chat1, oneseat and its host harness). The Guild tab's ask (chatfit, guild1c). The relay
  version's read (set7).
- Re-aimed by content, all dead: B7-channel-welcome-without-the-clock, AUDWB-A4-the-hello-handed-nothing,
  EVENT1-relay-every-channel-says-it, GUILD1c-guild-line-to-everyone, RAID3-relay-hello-list-unsaid,
  G4-channel-join-carries-the-look, G6-count-from-the-cut-list, SCALE2b-walk-keeps-the-unlisted,
  SCALE5a-last-only-when-unlisted, AUDIT-SCALE5a-n-off-the-join, AUDIT-SCALE5a-n-off-the-leave,
  SCALE5b-host-kept-past-walk, SCALE5b-id-index-kept-past-walk, SD9A-the-hello-hands-nothing,
  AUDIT-SERPENT-S5-hello-receipt, S37-picture-before-the-welcome, S6-place-unfiltered (the filter's kept verdict).
  AUDIT-WB12d-T-relay-hello-word-in-every-room
  re-aimed and still equivalent, as recorded.

**The deploy.** One announced relay drop, world192, carrying SCALE5b (neither is deployed). The account service (acct112)
ships first or with it. No database migration. (AUDIT SCALE II L1: the merge is the drop - relay-deploy.yml deploys
world192 as main moves to it, a siege's blackout aside; the site and the account service deploy from the same merge.)

**Left:** nothing of the slice - part two, below, is the region channels.

### SCALE5c part two: a region's channel, four ways (2026-10-11, this branch - the same world192, re-hashed)

A region's channel (`chat:region.<r>`) held every player standing in the region behind one door: 2,048 sockets, and a
start region's whole reconnect wave through one hello gate. It is split the way the hub is, on the same machinery
(`src/net/hubShards.js` REGION_SHARDS, busOf, shardOf, channelOf):
- **Four shards a region**, `chat:region.<r>.<k>`, k from the verified account as the hub's. The region's own channel
  is its bus: its lines, its travellers' marks (TV3) and its census (SD3) run over a ShardSocket for each shard's
  socket. Each shard has its own gate and cap, so the region's door is four times as wide and holds four times as many.
- **The machinery, by channel.** A shard hands its frames to its own channel's bus. A bus takes a shard of its own
  channel alone (the first shard that speaks names it, and any other channel's is refused). The hub's laws stay the
  hub's: ONE-SEAT, the live event and the account's words are said by the hub's bus alone.
- **A traveller's mark** is one entry a shard that skips its sender (`{all, x}`). Its owed clears go the same way.
  A shard's joiner is told the region's fresh marks by the bus (`_travTell`, TRAV_WELCOME_MAX at most). Each arrives
  as a `trav` frame, which a client reads as said now, so a mark up to TRAV_SEND_MIN_MS old is drawn that much longer.
- **The census** counts every shard's registered accounts: their ShardSockets carry the hello's `lk`.
- **The Region tab** lists its own shard's members live, and everyone in the region while it holds no more than a
  roster says: the region's bus answers `find` with `all`, as the hub's does.
- **The client.** The Region tab's link offers the shards, joins its own shard once the page has seen a relay with
  them (`channelLinkRoom`), follows a hop only within its own channel, and falls back to the region's channel after two
  shard sockets that never open. A traveller's mark is sent only while the link stands in the region's channel, on
  whichever of its shards (`channelOf`).

**Measured** (`node tools/hubShardBench.mjs REGION_N=2000`): one region's channel, 2,000 arriving - the 2,000th hello
3.78 ms and 2,000 sends (AUDIT SCALE II D-6: ONE hello, the last - an average one is 1.0-1.4 ms; the 2,000 sends are
the difference), a region line 0.81 ms; the same region on its four shards - a hello 1.24 ms on its shard
(500 a shard) and 0.08 ms on the bus, the whole wave 156 ms of the bus's, a region line 0.56 ms on the bus and 0.7 KiB
to the shards.

**Pins.** `test/net/scale5c.test.js`'s thirteenth: the law (every region shard a channel and a region's room, never a
hub's; the bus of a shard and the channel of a key), and over real Rooms a region line and a traveller's mark from one
shard heard on another and on a tab from before (the mark one entry a shard, never back to its sender), a shard's
joiner told the marks, the census over every shard, everyone for the Region tab, the hops, a bus refusing another
channel's shard; the session's offer, hop and fallback; the host's wiring. `tools/mutants/scale5c.json` 85, all dead.

PIN MOVED: the channel whitelist again (chat1, chatchan: each region's four); the hub link's room, now any channel's
(`channelLinkRoom` - chat1, oneseat and its harness); the Region tab's join (chatchan); a traveller's mark's region
check (tv3, two). Re-aimed by content, all dead: TV3-host-switch-ignored, AUDIT-TV-C4-told-to-the-region-left,
AUDIT-SCALE5a-n-off-the-leave.

## SCALE5d part one: built (2026-10-11, this branch - a crowded place overflows into layers; the same world192, re-hashed)

Mac's decision 3: a full city overflows into a layer rather than refusing `room full`. A room of the open world, a
building or a dungeon held 256 sockets (everyone's halo socket counts), and the 257th was refused at the Worker's door
and tried the same key again for as long as the crowd stood.

**Measured first** (`node tools/wire2Bench.mjs CELL_N=256`): a full cell on the second wire sends 5,219 frames (AUDIT SCALE II
D-9: this said 5,368; the bench says 26,095 in its 5 s, deterministically) and 37.5 MB a second out of one object, about 146 KB a second to each client; at 120 it was 10.8 MB. A room's cost grows with
the square of its crowd, so SOCKETS_MAX stays at 256 and a crowd past it goes to another object.

**The layers** (`src/net/wire.js` isLayered, layerOf, layerName; `server/src/relayScale.js` layerWalk):
- **A layer is another object for the same key.** A room is still its key everywhere - every law that reads, parses or
  compares a key reads the one it always did (a raid's pixel, a park's anchor, a serpent's cell). AUDIT SCALE II R3-3:
  and an event is the place's alone - a layer stands no serpent's fight, keeps no raid ledger, rite, overworld ledger or
  card table (a layer's own serpent was killed alone and its kill told the hub `fell` while the place's fought on). A
  layer's void of a card stake is spent by its place (HOLDEM_INTERNAL_VOID): one memory of every spend. The Worker picks the
  object: `key` itself for the place, `key#n` for its layers, n up to LAYERS_MAX - 1 (7).
- **The Worker walks them.** It forwards the upgrade to the asked layer (0 unless the page asks), and past a full one to
  the next, round to LAYERS_MAX. (AUDIT SCALE II R3-3: an asked layer nobody stands in answers empty, `x-df-empty`, and
  the walk goes from the place - `?ly=k` handed anyone a private copy of any place.) A full room's refusal says it is full (LAYER_FULL_HEADER); any other answer, a refusal
  included, is the answer. Every layer full is `room full`, as one room's was. There is no hop back to the page, so no
  token is minted twice.
- **The object knows its layer** from the Worker's header (LAYER_HEADER - set by the Worker whatever the page sent). It
  keeps it on each socket's attachment and says it in its welcome (`ly`).
- **What layers:** an open-world cell, a building and a dungeon (isLayered). A channel has its shards, and a fight is one
  object's (part two). Every internal call addressed to a room by its key (a park's registry, a hub's word) reaches
  the place itself. (AUDIT SCALE II R3-8, R3-9: but a park registry's drop reaches the layer its team stands in, and the
  hub's wipe of a zone hall every layer.)
- **The page.** A session asks for its party's layer first (`layerHint`, `?ly=`), and a reconnect asks for its own. Its
  welcome tells it the layer it holds (`layer`); a halo's is kept with it, and a crossing that promotes the halo carries
  it. A halo asks for the place itself, and the Worker walks it on if that is full.
- **A party stays together.** The party pose carries the member's layer (`ly`, validPartyPose). The host asks for its
  leader's layer, else any mate's, when the mate stands in the open air within a cell of the place it joins
  (`partyLayerAt`). (AUDIT SCALE II R3-4: IN the cell it joins - a neighbour's layer number is another place's. R3-10: a
  badge said again asks the layer its old socket stands in, the primary's and a halo's.)

**Pins.** `test/net/scale5d.test.js` (4): the law; the Worker's walk (the asked layer first, round past the last, only a
full room's refusal walked past, each object told its layer whatever the page sent, every layer full `room full`); the
room (a full room said full, the layer kept on a socket only where the room layers, its welcome's `ly`); the session
(the hint, a reconnect's own layer, the welcome, a halo's layer carried by a crossing, a channel never asked) and the
party pose; the host's wiring. `tools/mutants/scale5d.json`: 24, all dead.

PIN MOVED: the host's join (mwbody1: its party's layer asked first); the relay's graph (relayversion SLAM8:
relayScale.js reaches relay.js first now). Re-aimed by content, all dead: AUDWB-A1-a-socket-unstamped,
SCALE5b-full-uncounted, X12-welcome-without-v.

**Found on the way, fixed.** The walk was first written in `server/src/index.js` as an exported function, which the
pins could import. workerd reads every named export of an entrypoint as an entrypoint, and a function there stops the
relay starting. AUDIT-ACC F2's pin (test/server/accountdeploy.test.js) failed on it before any deploy, and the walk moved to
`server/src/relayScale.js`, where the relay's helpers live for that reason.

**Left:** part two - the event rooms (a gate's court, a Super dungeon's realm) as copies around one fight. Only those two
can fill: a siege seats 48 fighters and 60 watchers, and the arena 60 watchers and a bout's two.

### SCALE5d part two: a gate's court, copied (2026-10-11, this branch - the same world192, re-hashed)

**Which rooms can fill, read off their own laws first** (a read-only survey of the gate's court and the Super dungeon's
realm):
- **A Super dungeon's realm** admits SD_FIGHTERS_MAX accounts (256) by its own admission list, and the wire carries no
  more (`n <= 256`). One seat an account, so its sockets never pass SOCKETS_MAX: the 257th account is the realm's
  `full`, not the room's. Copies would add nothing there. Raising the realm's count is a game decision.
- **A siege and the arena** are capped lower by their laws (48 + 60, 60 + 2).
- **A gate's court** admits anyone while its gate admits, and any fighter of its fight after. Its fighters are capped at
  GATE_FIGHTERS_MAX (256) by its brain, but its watchers are not. So the 257th was refused `room full` at the door,
  even with fighter seats free.

**The design** (`src/net/hubShards.js` isCourtCopy, courtOfCopy, upOf, courtHands; `server/src/index.js` _courtHello,
_courtPose, _courtSockets, _courtSendAll):
- **The court stays as it was.** It keeps its fight and its first SOCKETS_MAX sockets. A court that never fills runs no
  new line: every path below is asked only while it holds a copy's socket.
- **Past it, its copies.** The Worker walks a gate's key as it walks a crowded place (part one's layerWalk), from the
  court itself whatever the page asks. A copy is `gate:<n>#<k>`. Each copy is a crowd of its own: its sockets see each
  other, never the court's or another copy's.
- **A copy hands the court its fight, over the shards' machinery:**
  - each socket's hello (`h`), after the copy's own welcome;
  - its poses (`p`) as its own room takes them, unfanned there;
  - its gate words (`f`) as they came;
  - its leaves (`x`, `r`).

  The court makes each a ShardSocket, metered and struck by the court's own gates.
- **Admission is the court's.** A copy asks only the clock (gateHolds). The court asks its own law (_gateAdmit: a
  fighter always, a newcomer while the gate admits) and refuses in its own words, closed through the copy. One seat an
  account across the court and every copy: the newer hello replaces the older, wherever each stands.
- **The court hands back:** each answer and receipt to its socket, each beat once per copy (`{all}`), and its closes.
- **A copy's socket is never the court's index** (`_setAttach` keeps it on the ShardSocket). So no crowd walk there - a
  pose's fan, a roster, a line, a leave - can reach it. Only the fight's own paths read it, through _courtSockets:
  - the census (bodies, its trails for the judge);
  - who is present when a full fight frees a seat;
  - the beat's `here`;
  - the kill's `here` and its receipts;
  - the count's body words;
  - a heal's healer (_courtIdFirst).
- **A copy holds no fight.** Its gate words go up, so it never mints one.
- **A woken court holds no copy's socket.** Each copy's sync (its alarm) says them again, as a shard's does.

**Found on the way, fixed - in SCALE5c's machinery too.** A ShardSocket the bus closed (a refusal) was asked its hello
again by the next pose or frame of its on the way ("unknown"). The hello was refused again, and asked again, in a loop
that starved every timer. The bus now remembers what it closed (`_vshut`). A pose alone asks nothing; the socket's next
frame or the sync does.

**What a player sees.** In a court past 256, a newcomer lands in a copy. It hears the boss, fights him (while the brain
has a seat), earns his receipt and sees the kill, beside the copy's crowd but not the court's. The court's own crowd is
unchanged.

**Pins.** `test/net/scale5d_court.test.js` (7):
- the law;
- the Worker's walk (the court first);
- a copy's socket: welcomed by its copy, held by the court outside its index, joining the one fight, hearing the same
  beats, the crowds apart;
- the fight hearing a copy's fighter: its blow from its pose, its trail, the census, a copy-mate's heal, the kill's
  `here` and receipt, its trail gone with it;
- the door: the court's law through a copy, a refused socket never asked again, one seat across the court and two
  copies, a copy's leave said to its own crowd alone;
- a court without copies unchanged, a copy minting no fight;
- a woken court told again by a woken copy's sync.

`tools/mutants/scale5d_court.json`: 28, all dead. Five survived their first run and their pins were made to reach
them: one seat across two copies, a trail followed past its seed, a write of an attachment kept out of the index, a
copy-mate's leave (the first pin's joined after the seal and was refused), and a refused socket's frame on its way.

PIN MOVED: gateheal's healer (now _courtIdFirst); gatereload's hello door (a copy asks the clock alone). Re-aimed by
content, all dead:
- AUDWB-A1-nobody-present;
- GATE-HEAL-the-peer-never-read;
- GATE-RELOAD-the-window-said-in-a-no;
- INT11-RELAY-NO-BD;
- SCALE5c-told-unkept, -unknown-unsaid, -census-the-bus-own and -bus-any-channel;
- SCALE5d-layer-unread and -channel-given-layer.

## SCALE4h: built (2026-10-11, this branch - acct112, no migration, no drop)

The plan's eighth slice: "A player's hot rows (the session, the play clock, the Renown tally, the rate windows) off the
one primary: per-account objects or account shards, chosen once SCALE4f's metrics say how busy the primary really is."
SCALE4f's metrics are not deployed yet (acct112 is on this branch), so the slice measured first, with a tool of its own.

**Measured first** (`node tools/hotWritesBench.mjs`): one player-hour through the real account Worker over node:sqlite
(test/accountDb.mjs), each clock the client's own constant - the heartbeat at the board's pace with the box, the post
and the play beat riding it, the realm checkpoint, and a fighter's Renown through the client's own tracker at SCALE3's
40 XP a minute - with every statement counted and its rows changed charged to its table. On the tree before:

| an hour of | statements | rows changed | of them |
|---|---|---|---|
| a walker in a town | 166 | 36 | the heartbeat 121 / 21, the idle checkpoint 45 / 15 |
| a fighter | 736 | 226 | **Renown 354 / 118 (59 reports)**, the checkpoint 261 / 87, the heartbeat 121 / 21 |

By table, the fighter's rows: `players` 75, `renown_tracks` 59, `realm_characters` 58, `realm_wealth_hours` 29,
`sessions` 5. The Renown tally was half of everything a fighting hour wrote. The session's touch was 12 rows an hour
(both its rows, six times). The play beat was 12. The rate windows wrote nothing: ACCT-RATE-MEM had moved the
account's into isolate memory, and the sign-in windows (`ip:`, `login:`) are written only by a sign-in.

**The choice.** Neither objects nor shards. Every row named is one D1 must keep:
- **The Renown tally** has five writers - the report, a raid's and a serpent's reward (each charging the same hour's
  window, `renown_last_credit`), a writ's, a siege's - and each credit is one transaction with its receipt or its
  writ. A per-account object owning the tally would split each of those transactions in two, or rewrite all five.
- **The play clock** is read by the INT5 wealth budget at every checkpoint (`played_s`). Held in an object, it would
  have to be written back before each checkpoint, which comes as often as the beat.
- **The session** is read by every authenticated request (`WHO_SQL`). A session held elsewhere is a call on every
  request instead of a read.

What the numbers ask is fewer writes at the source.

**Renown, coalesced** (`src/net/renownTracker.js` renownReportSoon, `src/net/renown.js` RENOWN_COALESCE_MS):
- A report goes at the minute's pace (RENOWN_REPORT_MS) only while its answer says something the page cannot know:
  - the hour's bound is spent;
  - the track's total, or the hour's room, has not been said yet;
  - what is earned reaches the hour's room - the bound's word and the sigils' stop come as promptly as before;
  - what is earned completes the level - the rise, and its signed order to the rooms, come as promptly as before.

  - (AUDIT SCALE II C-4) the hour has RENOWN_REPORT_MS or less left - what is held never crosses into the next hour's
    window, where a player just under the bound lost it.

  Otherwise what is earned waits RENOWN_COALESCE_MS (5 minutes). The bar draws it all the while as its ghost
  (ui/hud/hudRenown.js, RENOWN4), and a report's worth (5,000) still goes at once.
- **The service says the room** (`server-account/src/renownTracks.js`): each answer carries `room`, what the account's
  open hour still takes. It is read back by the report's own decision, so it counts every writer's spend so far.
- **The host keeps the room with the hour and the total it was said at** (`scenes/world.js` `_renownRoom`). Another
  hour, or a total another door moved (a raid's, a writ's), makes the room unknown, and the next report goes at the
  minute's pace to learn it.
- **A spent hour earns nothing.** The service credits nothing in it, the sigils drink nothing and the bar draws no
  ghost, each as the page last heard it. The tracker no longer earns there either, rather than reporting every minute
  to be credited nothing. One edge moves: XP earned in a spent hour's last minute and reported after the hour turned
  was credited by the next hour's window; the page's hour (the shared clock's, AUDIT SET D7) now says it was earned in
  the spent one. (AUDIT SCALE II C-3: a capped answer counts for the hour its report was SENT in - one sent at 10:59:59
  and answered at 11:00:00 marked hour 11 spent, and all of it went unearned.)
- A tracker given no word reports at the minute's pace, as every one did.

**The session, touched hourly** (`server-account/src/accounts.js` SESSION_TOUCH_S, 10 minutes to an hour). Nothing
reads `last_seen` finer: the idle bound is a year, and the device list orders by it.

**The metrics that say which rows** (`server-account/src/metrics.js`):
- **A `first()`'s rows, counted.** A `first()` answers a row with no meta, so the beat's write (`creditPlay`, an
  UPDATE ... RETURNING) never showed in rows written. It is now run as the statement's own `all()`, which sends D1 the
  same query (the binding's `first()` is its `all()`'s first row), and its first row is answered. A `first(column)` is
  the runtime's own.
- **Rows written by table.** Each statement's rows written are charged to the table it writes (tableOf):
  - `blob5`: every table written, "table:rows", most first;
  - `double8`-`double11`: the plan's hot rows, by table - `players`, `sessions`, `renown_tracks`, `realm_characters`.
- **A heartbeat's parts** (`blob6`: "beat,board,mail,post", the ones its body asked), read off a copy of the request
  before the service reads its own. (AUDIT SCALE II A-3: whole, unbounded and before any session - a 64 MiB stranger's
  POST cost 325 MiB of the isolate, AUDIT 68 X8 undone. The parts are now the heartbeat route's word on the body it read,
  capped and behind the session; a refused heartbeat says none.) The beat, the board and the box are apart at last.

**After** (the same bench, the tree as built):

| an hour of | statements | rows changed | Renown reports |
|---|---|---|---|
| a walker in a town | 166 -> 156 | 36 -> 26 (28 once its session is an hour old: one touch, not six) | - |
| a fighter, 40 XP a minute at Renown 20 | 736 -> 450 (-39%) | 226 -> 124 (-45%) | 59 -> 13 |
| at Renown 3 (a rise every few minutes) | 736 -> 462 | 226 -> 128 | 59 -> 15 |
| at 400 XP a minute (the hour spent at 37 minutes) | 736 -> 426 | 226 -> 116 | 59 -> 9 |
| at 2,000 XP a minute (the hour spent at 8 minutes) | 736 -> 402 | 226 -> 108 | 59 -> 5 |

SCALE3's fleet (half of it fighting) wrote 172 rows a bot-hour; Renown was a third of them.

`npm run test:changed`: 23,899 pass; its two failures were pins this slice moved (below).

**Mac's decision 1, considered: a token bound to a key.** A reconnect's token is spent once (`server/src/index.js`
`_spent`, a room's own memory), so every reconnect after a relay deploy is a mint. A token bound to a key the page
holds could be presented again until it expires, proven by a signature over the room and the moment. What it costs:
- **One announced relay drop.** `identityToken.js` and `wire.js` are in the relay's bundle.
- **The token's size.** Its body is capped at 800 characters, and the widest is 794 today, so a 32-byte key does not
  fit beside it. The cap and the wire's `TOKEN_RE` grow, or the claims slim.
- **A proof in every hello.** The relay says nothing before a hello, so the proof signs the room, the time and the
  token within the clock's skew, or the hello gains a round trip.
- **Staleness.** A room sees a badge at most a minute old today (TOKEN_REUSE_MS) and a token at most five
  (MAX_TTL_S). A longer life leaves a title, glyphs, a house and arms stale for it, and those have no override order.
- **Revocation.** A closed session stops new mints today, and its tokens die within five minutes. (AUDIT SCALE II A-4:
  SCALE4g had let a mint start from an old bookmark, served by a replica that had not heard the close; the mint starts at
  the primary again. The bookmark reads - the heartbeat, the account and realm lists, the professions' state, the
  motherlodes - may answer a closed session's secret carrying an old bookmark while a replica lags, seconds, then `auth`.) A longer token
  needs a way to revoke it.

What it buys is a mint per reconnect. SCALE2c spreads those over the hub's own admission, ADMIT-LINE queues them, and
SCALE4d/4f made each about 4 statements on a replica session (AUDIT SCALE II D-9: 5 with the seats closed, 7-9 with them
open, as production runs). Decision 1 recommends it at 5,000, not before. It stays
the plan for that point, built when `/v1/auth/token`'s D1 wait (`double5`, SCALE4f) climbs in a deploy's wave.

**Left, each with its reason:**
- **The checkpoint** is now 59% of a fighting hour's statements and 71% of its rows. Each is one batch: the realm row
  twice (the save's UPDATE and the verdict's), `realm_wealth_hours` once, and the ledger's reads. Folding the two
  UPDATEs rewrites the INT5 judge's own guards (SCALE4f). The pace (ONLINE_CHECKPOINT_MS, 2 minutes while the save
  moves) is how much a crash loses. It is the next lever, chosen by `double11` once acct112 is deployed.
- **The play beat** stays every five minutes: the budget reads `played_s` at each checkpoint, and a coarser clock is
  a coarser allowance.
- **A crash's loss.** A page that dies without `pagehide` loses what it earned since its last report: up to five
  minutes of Renown, not one. The page's last word still goes by `keepalive` on every ordinary close - (AUDIT SCALE II
  C-5) every region's pending, a report each, the held report last (the service keeps one `last_rid`: a page the
  back-forward cache restores sends that last one again, and it is answered as a repeat).

**Pins.**
- `test/server/scale4h.test.js` (8):
  - the law, every arm;
  - the tracker's pace (coalesced, the minute, a word that throws, none given, a report's worth, a refusal's own
    backoff);
  - the service's room (across characters, a repeat, a spent hour, a new hour, the route, the page's plan);
  - the host's wiring;
  - a fighter's measured hour;
  - the hourly touch;
  - a `first()`'s rows and rows by table;
  - the point's tables, hot rows and heartbeat parts, over the real Worker too.
- `tools/mutants/scale4h.json`: 30 mutants, 30 dead. One survived its first run, a negative count unclamped, because
  no pin asked it against a spent room; the pin now does.

PIN MOVED:
- `renown1`'s, `auditrenown1`'s and `renown_char`'s answers carry `room`, and `renown4`'s reading of the host's answer
  keeps the room between the total and the level;
- `scale1`'s bound on the touch (an hour, from fifteen minutes);
- `scale4f`'s metrics pins: a `first()`'s wait and rows are now its `all()`'s, and the point's first seven doubles
  are SCALE4f's;
- `oneseat`'s Renown door: a tab out of the seat, and now a spent hour, earns nothing.

Re-aimed by content, all dead: AUDIT-RENOWN1-tracker-no-backoff, ONESEAT-renown-in-any-tab,
RENOWN1-hour-spend-matches-nothing, SCALE1-B-statements-uncounted, and SCALE4f-batch-wait-uncounted, -bind-untimed and
-point-as-before.

The pins' D1 (test/accountDb.mjs) answers `rows_written` in its meta, as D1's does, so a point can be read over it.

## SLIM-FRAME: built (2026-10-11, this branch - relay world194, one drop at the merge)

The owner: *"I notice some players look like they are walking off the ground."*

**The cause.** SCALE5b's second wire rounds each pose it batches (`src/net/wire.js` slimPose), and it rounded x, y and z
to whole units, reading all three as MapsFile's world unit - 32768 to a map pixel, 2.5 cm. That is true of one thing:
the x and z of a pose said in a native room (a world cell, a siege's battle or a Royal Tourney, an owned interior or
boat - nativePoseRoom). A pose's HEIGHT is the scene's metres in every room: `scenes/world.js` sends
`player.pos[1] - state.compensation[1]`, the feet with only the floating origin shed, and its reader adds the origin back
(`onlineToScene`). So every peer a client heard on the second wire - every peer, since the world host offers `w2` on
every socket and every relay from world192 on answers it - stood on a whole metre of height: up to half a metre in the air or
sunk to the shins, and stepping a metre at a time up a slope. Which players floated depended on where they stood (a
player at 34.6 m drew at 35, one at 34.4 drew at 34), hence "some players". Off the overworld it was worse and had not
been reported yet: a dungeon's, a town's or a building's x and z are metres too, and a peer there walked a one-metre
grid. The first wire never rounded, and the renderers all stand a peer at the pose's feet (`net/remotePlayers.js`,
`peerBodies.js`, `peerRiders.js`), so nothing on the client could see the loss.

**The law.** `slimPose(p, key)` rounds in the units of the room the pose was said in: a native room's x and z to whole
world units, as SCALE5b meant; the height in every room, and x and z in every other, to the centimetre
(`SLIM_SCENE_STEPS`, 100). A pose handed no room is rounded as the scene's - finer, never wrong. `nativePoseRoom` moved
from `net/online.js` into `wire.js` (`online.js` re-exports it for every caller and pin that knew it there), so the relay
asks the same question the session's snap asks, of one law; the relay's fan hands it the sender's room
(`server/src/index.js`, `slimPose(m.p, a.key)`). The cost, measured over 5,000 drawn poses: a cell's slim pose 79.2 bytes
to 82.1, a dungeon's 70.0 to 78.6 - still well under half the first wire's.

**The deploy.** The relay's law changed, so RELAY_VERSION is world194 and relay-deploy.yml drops every player once at
the merge. A client from before it reads the new relay's poses through the same door; a client after it against the
old relay sees the old rounding until the deploy lands.

**Pinned** (`test/net/slimframe.test.js`, 2; `tools/mutants/slimframe.json`, 6, all dead): the law over every room kind
(a height within half a centimetre everywhere, x and z whole in a native room and within half a centimetre elsewhere,
one nativePoseRoom for session and relay), and the relay to the screen - a speaker in a cell and in a dungeon at heights
and places that are no whole metre, each pose's batch entry kept, and the peer a second-wire session stands within half
a centimetre of where a first-wire session stands them. Mutants: SCALE5b's rounding verbatim, the height whole, a scene
room's place whole, the room unread, the relay's fan unkeyed, the steps coarse. PIN MOVED: SCALE5b's slimPose pin read
the height whole (`"y":-1412` for -1412.25 - the bug, pinned); it reads the centimetre now, and its batch pins name the
room. `SCALE5b-place-unrounded`, the three relay-fan records and the two `NETSMOOTH-1` records (to `wire.js`) re-aimed by
content. The relay's version pins moved to world194.

## D1-NEAR: built (2026-10-12, this branch - no migration, no version, no drop; audited, `01-Overview/audits/Audit-D1-Near.md`)

From play: *"I notice a lot of UI elements that utilize the server (like searching players, the guild menu, etc) take
an insane amount of time to load."*

**The cause.** SCALE1 set `[placement] mode = "smart"` on the word that Cloudflare would run the account Worker near
its database, and SCALE4d and SCALE4g reasoned from it. Nothing said where the Worker ran: the metrics have kept every
request's D1 wait since SCALE4f (`double5`), and nobody read it for that (AUDIT D1-NEAR M13). An answer says where it
ran (`cf-placement`), and on 2026-10-12 2,208 answers of 2,238 said `remote-SYD`: Smart Placement ran the Worker in
Sydney. Read-only probes from one client entering at Newark (EWR), against two public routes and one sign-in door -
probe A (17:09-17:15 UTC, 400 rounds), probe B (17:23-17:35, 1,200 reads), probe C (17:36, 60 rounds):

| | Worker in Sydney (`remote-SYD`) | Worker at Newark (`local-EWR`, Smart Placement's 1% baseline) |
|---|---|---|
| `/v1/health` - no statement | A: p50 278 ms, p10 270 (n=393); C: p50 269, min 261 (n=59) | A: p50 67 ms, p10 59 (n=6) |
| `/v1/seats/sieges/live` - one statement, on the primary | A: p50 457 ms, p10 433 (n=394); B: p50 442, min 411 (n=1,195) | A: p50 199 ms, min 148 (n=5); B: p50 337, min 281 (n=5) |
| `POST /v1/auth/token` with no credential - the sign-in line asked (ADMIT-LINE's `AdmitGate`), no statement | C: p50 428 ms, min 417 (n=60) | - |

B's health answers in Sydney ran slow throughout (p50 664 ms) and are set aside; twelve of B's answers carried no
`cf-placement` at all.

**Where the primary is - by bounds, not by a fit** (AUDIT D1-NEAR M1, M2). Noise only ever adds to an answer, so the
fastest answers bound the distance, and a slow one excludes nothing.
- From Sydney a statement on the primary costs ~150-180 ms (B's fastest read less C's fastest health, 411 - 261; A's
  medians, 457 - 278): the primary is at most ~160 ms from Sydney. That rules out the east of North America (200 ms and
  more) and Europe (260 and more), and leaves western North America or East Asia.
- From Newark the fastest local read took 148 ms all told: counting nothing even for the trip to Newark, the primary is
  at most 148 ms from it, and East Asia is 165 ms and more. That rules it out - on probe A's five local reads alone; B's
  five were slower (a local answer runs on a rarely-warm isolate at Newark, and a slow sample only adds) and move
  neither bound.
- So: western North America. Los Angeles, San Jose and Seattle fit the bounds alike; which one, these measurements
  cannot say. D1 can: an answer's `meta` names the data centre that served it (`served_by_colo`) and whether that was the
  primary (`served_by_primary`, D1's API reference) - and every deploy now reads it (below).
- The sign-in line's Durable Object costs the Worker ~156-159 ms from Sydney too (C, 60 pairs): as far from Sydney as
  the primary - measured from Sydney alone.

**What it cost.** A route's wait was its round trips, one after another, times the crossing - before any load, and for
the statements on the primary (AUDIT D1-NEAR M4: the reads SCALE4d's and SCALE4g's sessions hand to a replica may have
been answered near Sydney; `double7` says):
- the Guild tab's look (`/v1/guilds/mine`): thirteen statements for a member, fourteen for an officer or the guildmaster
  (fifteen when the hourly session touch or a succession write lands; three for a character in no guild) - the session,
  the tombstone, the member and the succession, the member again unless the guildmaster, the guild, the roster, the
  hall, the vault's count, the invitations (an officer's), the ledger, the Marks, the Marks ledger, the deeds, the holds
  (the guildmaster's) - some 2-2.5 s (AUDIT D1-NEAR M6);
- a seat board, nineteen to thirty-five (Field-Bugs-2026-10-11h D1-LOAD): 3-6 s;
- a token's mint, the sign-in line's ask and its own statements - and every connect's hello waits on one mint (its
  sockets share it: SCALE2, `online.js` `_mint`), so the chat's player list and the friends list, which come over the
  hub link, waited on the crossing too (AUDIT D1-NEAR M10);
- the seats' Turning, several hundred reads: a minute and more, past its client's 15-second wait - what SEAT-LEASE met.

D1-LOAD's floor ("a one-row read took 0.6 to 6.6 seconds where a route that asks the database nothing took 0.2") was
measured the day before these probes: if the Worker stood in Sydney then too, the crossing was part of it - how much,
measurements taken after D1-LOAD's fixes cannot say (AUDIT D1-NEAR M5). Why Smart Placement chose Sydney, Cloudflare
does not say: its docs say it weighs request durations among places the Worker has already run
(`workers/configuration/placement`).

**The law.** `server-account/wrangler.toml` `[placement] region = "aws:us-west-1"`: Cloudflare runs the Worker in its
data centre nearest that cloud region, Northern California - central to western North America, some 10-25 ms from any
of its candidates. A player pays one trip to it - some 70 ms from the east of North America, 140-150 from Sydney or
London - and every statement after it costs D1's own time and a short hop. D1's own time is not known: the probes leave
room for 5 to some 40 ms a statement (AUDIT D1-NEAR M3), so by the arithmetic the Guild tab's look goes from some 2-2.5 s
to some 0.15-0.9 s, D1's own time deciding where - to be read off the metrics once it deploys: the D1 wait over the
statements by route (`double5` / `double3`, `node tools/d1Load.mjs`'s routes question), `/v1/seats/sieges/live`'s being
one statement's own. Nothing in the service's law moved: no migration, no route, no ACCOUNT_VERSION. wrangler 4's own
checks take the line (AUDIT D1-NEAR P4: it uploads `{"mode":"targeted","region":"aws:us-west-1"}`); whether Cloudflare's
API takes it for this account, the deploy says - a refusal fails the Deploy step and leaves the old Worker serving.
- **Not `smart`**: the measurement above.
- **Not left at the edge** (no placement): every statement would pay the player's own distance to the primary - better
  than Sydney in the east of North America, no better in Oceania or Europe.
- **Who pays more** (AUDIT D1-NEAR P2, M4): a player in Oceania or South-East Asia, about 150 ms on the few answers that
  ask the database nothing (the health, the public key, a preflight, a town's kept yards) and on any read a replica
  near Sydney served; about even on a route of one statement; ahead on every route of two or more, which is nearly every
  one.
- **The primary does not currently move** (AUDIT D1-NEAR P5): D1 placed it when the database was made (a location hint
  is taken at creation - `d1/configuration/data-location`), and the Durable Objects D1 stands on do not currently move
  once made (`durable-objects/reference/data-location`). This line moves with the database, and the deploy's readout
  says when.
- **What it does not reach.** "Placement only affects the execution of fetch event handlers"
  (`workers/configuration/placement`): the clock's `scheduled()` (SCALE4b) runs where Cron Triggers run, "on
  underutilized machines" (`workers/configuration/cron-triggers`), as it did under Smart Placement. Its jobs are small
  settlers; the one long chain is the weekly Turning's settle, under its lease (SEAT-LEASE).

**Said on every deploy** (`account-deploy.yml`, "Report where the account Worker runs" - hardened by AUDIT D1-NEAR
T1-T7). After the health check and before the smoke steps:
- where the Worker answers from: five health answers' `cf-placement` (`none` where an answer carries none - Cloudflare
  says the header may go);
- what a statement costs it there: the median of five one-statement reads on the primary less the median of five health
  answers, each curl bounded (`--max-time 10`) and failing on an error answer (`-f`: a 503 is no statement), only the
  answers that came counted, and how many said;
- where the primary is, by D1's own word: a `SELECT 1` through `wrangler d1 execute --remote --json`, its answer's
  `served_by_colo` where `served_by_primary` says it was the primary.

A report and never a gate: the step is `continue-on-error` and bounded by `timeout-minutes`. A primary's data centre far
from the region the toml names, or a statement costing tens of ms more than the first deploy's, is the cue to change
the line. SCALE1's word stood because nothing said where the Worker ran; every deploy says it now.

**Pinned.** `test/bible/d1near.test.js` (2): the toml's one `[placement]` table holds `region` alone, the region this record
names; its comment is D1-NEAR's; none of the three sentences that took Smart Placement's word stands on any page of the
bible outside a quote; the report step, run by bash as the runner runs it over a fake curl and a fake wrangler
(`test/d1nearStep.mjs`), says five answers' placements - an HTTP/2 header in lower case and an HTTP/1.1 one capitalised
alike, an answer without it `none` - the statement's cost off the medians and the data centre D1's primary answered
from, all asked of the deploy's own base; nothing reached, it ends green, the cost unmeasured and D1 unsaid.
`tools/mutants/d1near.json` (9, all dead): SCALE1's smart placement back, the Worker placed in Sydney, the table dropped,
the summary unwritten, the header read case-sensitively, an answer without the header unsaid, the cost not less the
health, the slowest answer taken for the middle, SCALE1's sentence back on this page. The audit's own pins and mutants
are its page's.

**Left.**
- **The round trips themselves** (AUDIT D1-NEAR M3). Beside the primary a statement costs D1's own time, so the Guild
  tab's thirteen or fourteen may still be most of a second. Folding viewOf's reads into one batch (GATHER-SPEED's shape)
  would make them one trip; `/v1/guilds/mine`'s D1 wait over its statements after the deploy says whether it is owed.
- **D1's own queue under load** (D1-LOAD's spikes): untouched - this line takes away the distance, not the database's
  load.
- **The replicas' share** (AUDIT D1-NEAR P3): beside the primary, the reads SCALE4d's sessions offer a replica may land
  on the primary itself - `double7` over `double3` for the mint and the heartbeat, a day either side of the deploy, says.
- **Where the clock runs** (above): its own metrics points say it (`cron:<job>`, the D1 wait by job).

## HOMES-SHED: built (2026-10-13, this branch - acct127, no migration, no drop)

From play, 2026-10-13: the account database overloaded from 14:11 UTC ("servers are under really heavy load. Fix
whatever you can and quick"). The Account database load run at 14:29 read the hour before it: the D1 wait went from
714-856 s a minute at 14:09-14:10 (about 0.2 s a request) to 20,000-178,000 s a minute from 14:11 (9 s a request at
14:11, 31 s at 14:14) while the statements a minute fell, every route's p95 10 to 95 seconds - past the client's own
waits, so each ask failed and was asked again. `/v1/homes/town` led the hour: 88,079 asks, six times the heartbeat's
15,091, carrying 324,034 of the hour's some 920,000 statements and 328,039 s of its D1 wait. From outside,
`/v1/seats/sieges/live` answered 11 of 25 asks at 14:30 with a bare 500 in about 0.3 s, no body at all.

What it was not: no deploy, cron or workflow ran at 14:11 (the account crons fire each minute and at :41), Cloudflare's
status named no D1 incident, and the update before it (#868 GATHER-FEEL I-II) changed no call to the account service.
What tipped the database at 14:11 is NOT found here (left, below). What kept it down, and what this slice takes away:

- **The busiest route asked the database twice.** `homesInTown` read the town's Open Gates edict in a request of its
  own before the homes read, on every ask while the seats are open (production's `SEATS_OPEN`) - D1's query insights
  counted the two at 1.63 million a day each. Now `seatHolding.js:"export const openGatesRead"` is the edict's
  statement and `homesInTown` sends it in the homes read's own batch: one request where there were two, the answer the
  same.
- **A town unanswered was asked six times as often.** `onlineHomes.js` asked a failed town again every `HOME_RETRY_MS`
  (10 s) where an answered one waits `HOME_TOWN_TTL_MS` (60 s) - YARD-SHED's fault on the yards (`homeYards.js`
  `yardRetryMs`), never taken away from the homes. Now `homeRetryMs` doubles each failure in a row to
  `HOME_RETRY_MAX_MS` (five minutes) and an answer starts the count again; a forced ask (a write of mine read back) is
  never held. A client change: a tab takes it at its next load.
- **The siege blackout's question threw past the service.** `/v1/seats/sieges/live` is the one route above the
  service's try that asks the database, so an overloaded D1's throw left the Worker as a bare 500 - no body, no log
  line and no metrics point (`measured()` never reached its write). Now `server-account/src/index.js:"const thrown = (path, e, origin) =>"`
  is the service's one answer to a throw, the try's catch and that route's alike: an overload a 503 `server`, any
  other throw a 500, each logged with its path and counted. SCALE4f's two catch mutants follow it there.

Left, each with its reason:
- **What tipped the database at 14:11.** NARROWED by SEAT-REPLICA, which read the minutes: from 13:56 to 14:10 the
  service's asks held at 3,300-4,300 a minute and the primary's statements at 13,000-17,700, and the one burst was
  14:09's - some 3.5 million rows read where the minutes beside it read 1.2-1.7 million, nearly all of them the arena's
  standings - on a primary already near its ceiling. What kept it down is SEAT-REPLICA's (below); a single cause of the
  tip is still not found, and whether 13:28's relay deploy (world200) had a part was not read.
- **Every other caller that asks harder when the service fails.** Market, marks, notices, writs and the professions
  retry twice within 1.5 s; several others on a fixed 1-5 s. One rule in `accountClient.js` - an overload's 503, or no
  answer, backing every read off together, a write delayed and never dropped - is the fix for the class, and it
  touches every caller: the owner's call, not this slice's.
- **The healthy rate.** `HOME_TOWN_TTL_MS` is what sets the route's rate when the service answers; a longer one cuts it
  further and shows another player's changes to a home later - also the owner's call.

Pins: `test/systems/online/homes_shed.test.js` (3); `tools/mutants/homes_shed.json` (8 dead); SCALE4f's `overload-unread` and
`every-fault-503` re-aimed at `thrown` (both dead).

## BUSY-GATE: built (2026-10-13, this branch - acct128, no migration, no drop)

From the HOMES-SHED outage, the owner: "Build whatever can harden our server." HOMES-SHED took the busiest book's flat
retry away; this takes the class away. The one D1 primary overloaded from 14:11 UTC on 2026-10-13 and stayed down for
over an hour because every book asked again on its own schedule the moment its answer failed - market, marks, notices,
writs and the professions twice within 1.5 s, others on a fixed 1-5 s - and a release that sent players back to load
(#869's desktop release, published 14:45) knocked it down again as it recovered: 12 asks of 12 answered at 14:41, 5 of
15 refused at 14:51. Any burst tips a database that already runs near its ceiling (What 500 costs, above); the asking
harder is what kept it down.

- **One law, both ends.** `src/net/busyLaw.js` names the reads that stand back while the service is overloaded:
  fourteen display reads, each checked statement by statement to write nothing - a town's homes, yards and layouts, the
  caller's homes, a home's rooms and pieces, a pixel's nodes, the seats, a region's traders, the Marks held, the
  invitations waiting, the lineages, the unions and the saves' list. They were some 157,000 of the outage hour's
  250,000 asks. Left out: every write, sign-in and act, which must land; the heartbeat; a read that may settle
  something on its way (the market's read, the chapters' list, the arena's board); and the reads a replica serves
  (`REPLICA_ROUTES`), which the primary's queue does not slow.
- **The client's gate.** `accountClient.js` `call`: an overload answer - a 503 that says `server`, or `queue`, the
  sign-in line - holds those reads for a wait that doubles with each such answer in a row, from `BUSY_BASE_MS` (5 s) to
  `BUSY_MAX_MS` (60 s), spread over its upper half so the clients one overload told do not all ask again in one second,
  and never shorter than the answer's own Retry-After. A held read is answered as the service would have answered it -
  `server`, 503, which every book asks again (SCALE4f) - without the request, and after `BUSY_HOLD_MS`, so a book that
  asks again the moment it is refused is not a loop that spins. An answer starts the count again; a hold already
  running runs out. A 500, a fault, and `offline`, the player's own line, hold nothing. A client change: a tab takes it
  at its next load.
- **The service's shed.** For the clients from before the gate: an isolate that meets an overloaded database (index.js
  `thrown`) answers the same reads `server`, 503, for `BUSY_SHED_MS` (2 s) - each overload met keeping it open - before
  the session's lookup or any statement (`server-account/src/service.js:"export const shedding"`), so every ask of them
  costs the primary nothing while it drains. And every overload answer now says its Retry-After,
  `BUSY_RETRY_AFTER_S` (5 s), which the gate reads.

Left, each with its reason:
- **What tipped the database at 14:11** - HOMES-SHED's, still open.
- **The heartbeat, the sign-in and the acts keep their own retries.** A write must land, not wait on a gate; the
  sign-in has its own line (ADMIT-LINE) and its own doubling (`MINT_COOL_MS` to `MINT_COOL_MAX_MS`).
- **A slow database that is not yet refusing opens neither gate.** Both key on D1's own overload word; a breaker keyed
  on latency would shed answers the database could still give, and needs a measured threshold first.

Pins: `test/net/busy_gate.test.js` (3); `tools/mutants/busy_gate.json` (15 dead); SCALE4f's two catch mutants re-aimed at
`thrown`'s guard (both dead).

## SEAT-REPLICA: built (2026-10-13, this branch - no migration, no version, no drop)

The owner, with the database still overloaded at 18:10 UTC, four hours on: "find out why the server isnt working
properly", then "Do it". Read off D1's own query insights and the service's metrics (Analytics Engine) for the day.

### Measured

- **At 14:11 every route waited, and nothing it ran was slower.** The service's mean wall time went from some 0.2 s to
  8.7 s at 14:11 and 32 s by 14:13, while the primary's statement p99 went from 4 ms to some 11 ms; past 14:15 it was
  mostly 60-70 ms. The primary's statement time was 7-10% of each hour from 08:00 to 13:00 and 25-27% of each from 14:00 to
  17:00, its statements fewer by a third and its rows answered 25-55 million an hour before and 105-117 million after.
  The read replicas (WNAM) served some 15-20% of the reads throughout at a p99 of 2-3 ms; every other read was the
  primary's - the binding is D1's always-primary session, and only `REPLICA_ROUTES` open one of their own.
- **The seats' witness rows were most of it.** One read, `SELECT key, account, report, at FROM world_witness WHERE kind =
  'seat'` (townSeats.js `allSeatRows`), was 15,899 rows on the day - 4,050 at STORM-SHED, the rows never trimmed. From
  16:00 to 18:00 it ran 12,455 times, every one on the primary: 1,044 s of the primary's 1,894 s of statements (55%) and
  197.9 million of the 213.7 million rows it answered (93%). From 13:40 to 14:10 it ran 972 times at 52 ms; from 14:10 to
  14:40, 3,224 times at 76 ms - a slow database holds each request longer, Cloudflare stands more isolates for them, and
  each new isolate's kept copy starts empty.
- **The isolate's kept copy missed two lists in three before any of that.** From 12:00 to 14:00, 5,161 lists read 54.9
  million rows - some 3,450 whole reads. STORM-SHED's minute is one isolate's, and the asks are spread over more
  isolates than a minute brings each of them. And every counted witness's report let its isolate's copy go, though a
  witness's first answer stands and the same report again writes nothing.
- **The lists asked harder as they failed.** `/v1/seats/list` was asked some 44 times a minute before 14:10 and some 290
  after, nine in ten of them answered 503 - BUSY-GATE's class, which the client's gate holds back at its next load.

### Built

- **The kept read is a replica's.** `server-account/src/townSeats.js:"export const SEAT_ROWS_FROM = 'first-unconstrained';"`:
  seatRowsOf reads on a D1 session of its own (service.js `replicaDb`, counted on the request's point as the binding's
  statements are) - the first any instance's, each one after a kept read from the bookmark that one ended at, so a
  replica behind what this isolate already read never answers it; and the read after this isolate's own write (a
  witness's new report, a strike) `first-primary`, which has it, then from its bookmark. A read that failed leaves its
  bookmark, never a newer read's; a session D1 will not open is the request's database, as before. A developer's list and the Turning's still
  read the binding, the table as it stands. The primary keeps only the read after an isolate's own write: at most some
  200 an hour (2,005 seat reports from 08:00 to 18:00), where it ran some 6,000 an hour in the outage.
- **A report the table already held lets nothing go.** `witnessSeat` lets the kept rows go only when its INSERT OR
  IGNORE wrote a row (`meta.changes`); a harness or runtime that says nothing lets them go, as before.

### Left, each with its reason

- **A copy every isolate shares.** The kept copy is still one isolate's, so the read still runs once a minute in each
  isolate a list reaches, now on a replica. One read a minute for the whole service needs a store the Worker does not
  have (KV, or the minute's cron writing a compact copy the lists read) - a change of what the service keeps, not of
  where it reads.
- **`/v1/homes/town` on a replica.** The busiest route (some 1,500 asks a minute before the outage) is one batch on the
  primary. A write route answers no bookmark (AUDIT SCALE II A-1), so a home claimed and read back could be read off a
  replica from before the claim; it waits on the write routes answering bookmarks, and the client sending one for it.
- **Trimming the seats' rows.** Each row is a witness's report a seat's confirmation rests on; trimming them moves which
  seats stand and who is ignored (seatIgnoredAccounts) - the owner's call, not a load fix.
- **The replica's own ceiling.** At the outage's rate the read is some 14% of one instance's time (1.8 reads a second at
  76 ms); the replica took none of it before.

Pins: `test/server/seat_replica.test.js` (3); `tools/mutants/seat_replica.json` (12 dead); STORM-SHED's
`STORM-SHED-report-unforgotten` and `STORM-SHED-write-unasked` re-aimed at the new lines (both dead).

## DISPLAY-REPLICA: built (2026-10-13, this branch - no migration, no version, no drop)

The owner, with SEAT-REPLICA deployed at 18:59 and the service still slow ("the server is still insanely slow for
people"): "1, 2 and 3" - the display reads on the replicas the first of them to ship.

### Measured

- **The primary has a ceiling since 14:11, and our statements are not what reach it.** At 02:00 the primary served
  1.03 million batches an hour at a median wall time of 0.2 s. From 14:00 to 19:00 it served 490,000-550,000 an hour,
  every route waiting on it, whatever the batches cost: after SEAT-REPLICA its answers fell from some 10 GB an hour to
  1.5 GB, its batch p99 from 67 ms to 9 ms and its p999 from 119 ms to 34 ms, and from 19:15 the service's mean wall
  time was still 11.4 s on `/v1/homes/town`, 9.3 s on the heartbeat and 9.0 s on the mint - nearly all of it D1's
  wait. No deploy, cron or workflow ran at 14:11 (the last account deploy before it, #868's at 13:29, changed no
  server code); what holds the primary to some 150 batches a second is not visible from here.
- **Much of what asks it is display.** From 19:15 to 19:40, six of the reads moved here were among the sixteen busiest
  routes - 37,800 of their 84,700 asks, 1.6-6.9 statements each (a town's homes 3.4), every one of them the primary's.

### Built

- **The display reads are replica routes.** `server-account/src/service.js:"export const REPLICA_ROUTES = new Map(["`
  names them beside the mint and the heartbeat: a town's homes, the caller's homes, a home's rooms and pieces, a
  pixel's nodes, a region's traders, the Marks held, the invitations waiting, the lineages, the unions, the saves' list
  and the arena's board. Each writes nothing (BUSY-GATE checked them statement by statement; the board's #1 is stored
  on the doors `ARENA_HONOUR_PATHS` names) and keeps nothing an isolate shares. With the bookmark a tab carries, every
  statement is a replica's; with none - a page from before this, or the read after a write - the session's first
  statement (the lookup) is the primary's and every one after it a replica's at least as new, so a caller reads its
  own writes. The client mirrors the list (`D1_BOOKMARK_READS`, AUDIT SCALE II's pin), and already forgets its
  bookmark on every other call (AUDIT SCALE II A-2). The page's display reads used to forget it too, on every ask; now
  they keep it, so the heartbeat and the mint start from it more often.
- **The three an isolate keeps stay on the binding.** A town's yards, every town's layouts and the seats' list keep
  an answer for every caller of the isolate; a replica's answer kept there could be older than a write another caller
  just made here.
- **A seat read from a request on a session opens its own off the binding.** A market's or a pixel's read asks the
  seats (a Market Hall's cap, a Levy's seat); SEAT-REPLICA's read opened its session from the request's database, and
  a request already on a session has none to open - so the read after a write here would have ridden the request's
  bookmark, not the primary.

### Left, each with its reason

- **What holds the primary to some 150 batches a second.** Not our statements' cost (above). It is Cloudflare's to
  answer: the database's id, the hour it began (14:11 UTC) and the batch counts before and after are the report.
- **The pages from before this.** Without a bookmark each display read still asks the primary its first statement;
  a page takes the client half at its next load.
- **The replica's ceiling.** The display reads are some 75 statements a second at this hour, on the one WNAM replica
  the pinned Worker is nearest (D1-NEAR); a replica is one instance as the primary is.

Pins: `test/server/display_replica.test.js` (3); `tools/mutants/display_replica.json` (4 dead); SCALE4g's route list,
SCALE4d's example of a read on the binding (the yards, where it was the lineages) and BUSY-GATE's rule that a held read
is never a replica's - each PIN MOVED.

## SEAT-FACTS: built (2026-10-13, this branch - migration 0112, no version, no drop)

The owner's "1, 2 and 3", the first of them: one read of the seats' rows a minute for the whole service.

### Measured

- **SEAT-REPLICA moved the read, not its count.** From 18:55 the seats' witness read ran on the replica - 408-572
  reads every five minutes, 15,899 rows each - and the replica's batch p99 went from 2-4 ms to 47-60 ms with them; the
  heartbeat and the mint read there after their first statement. Each read is one isolate's minute: the isolates are
  many, and each asks its own.
- **And every ask counted the facts again.** `seatFacts` walked every row on each list, Watch claim, witness's report
  and every caller of `confirmedSeats` (a Levy's seat, a Tithe's, a Market Hall's cap, a siege, a pledge) - the kept
  rows saved the read, never the count.

### Built

- **The clock keeps the facts.** `server-account/src/townSeats.js:"export async function keepSeatFacts("` - a minute's
  job (`cron.js` `seat-facts`, while the seats are not `off`) reads every seat row on the binding and keeps what they
  say in `seat_facts_kept`'s one row (migration 0112): the seats that stand (a disputed one too) by key, state and
  report, and the accounts ignored - two statements a minute, where every isolate read the rows.
- **The isolates read the row.** A player's list, `confirmedSeats` and a witness's standing ask `keptSeatFacts`: the
  row, on a session of its own, kept SEAT_ROWS_KEPT_S as the rows were. It answers only while it is fresh
  (SEAT_FACTS_FRESH_S, 180 s: a stopped clock is no answer) and newer than this isolate's last report or strike - its
  own second is not after it; otherwise the rows are read as before (SEAT-REPLICA's law: the primary's after a write
  here), and a row unfit to answer is not asked again for SEAT_ROWS_KEPT_S. Any text that is not the clock's is no row;
  an overload is the overload's, never taken for no row. A developer's list and the Turning's read the table as it
  stands.

### Left, each with its reason

- **The seats' rows still grow.** 4,050 at STORM-SHED, 15,899 on the day, now read twice a minute rather than in every
  isolate; trimming them moves which seats stand - the owner's call.
- **Another isolate's report reaches a list up to a minute and SEAT_ROWS_KEPT_S later** (the clock's minute, then the
  isolate's keep), where it was SEAT_ROWS_KEPT_S - a confirmation is three witnesses' and the facts move by the week.

Pins: `test/server/seat_facts.test.js` (3); `tools/mutants/seat_facts.json` (10 dead); AUDIT SCALE D7's quiet minute (eight
statements, where it was six), SEAT-REPLICA's counted point (two statements, the row asked first) and ACC1b's tables
(`seat_facts_kept`) - each PIN MOVED.

## HUB-PULL and DO-ASK: built (2026-10-16, this branch - relay world210, one drop at the merge)

Mac: "Is the server okay?", then, of what it found: "Yes and do any other improvements along the way. I really wanna
continue to beef up the server". Read off the live relay (`/health`), Cloudflare's GraphQL analytics and Workers
Observability (the relay's own logs), with the account's token.

### Measured (2026-10-16, 00:30 UTC)

- **Up, and the version main names.** The relay's `/health` answered `world207` and the account service's `/v1/health`
  `acct138`, both main's. In the 24 hours before: the account service 6.9 million requests and no error; the relay some
  670,000 invocations and 1,082 thrown (0.16%), rising on 2026-10-15 with its four relay deploys (16:48, 20:14, 21:44 and
  22:57 UTC - each drops every socket).
- **The hub's machinery refused by the runtime.** Every one of the relay's `Subrequest depth limit exceeded` errors was
  a shard's hand-up (`[shard] the bus did not answer`): 485,616 in 72 hours by Observability's sampled count, at their
  worst tens of thousands in each 72-minute bucket (01:12-04:48 UTC on 10-14 and 10-15). The refused hand-ups ran inside
  `/internal/hub/down` (the bus's push, on 16 shards and more), `/internal/hub/resync`, and - on one region shard,
  `chat:region.23.2` - in its own sockets' events, 29 of 100 sampled: a retry armed inside a refused call is armed where
  the next is refused too.
- **Why.** A Durable Object has one I/O context, and every call it makes is charged to the newest call it is serving
  (workerd `io-context.h`, `getCurrentIncomingRequest`: "Any resource usage on the part of the actor, including
  outgoing subrequests, is attributed to the current request"). The bus is served all day by its shards' hand-ups, so
  its push to a shard rode the hand-up it was serving, one hop deeper; the shard's next hand-up rode that push; and
  round after round the chain grew until the runtime refused it. No code awaited a call
  inside another, so nothing in the source said so: it is the runtime's accounting, and only the live logs showed it.
- **What a fix may cost.** The hub's shards were awake 21-23 hours of the 24 already (the GraphQL `durableObjectsPeriodicGroups`
  active time of the same objects the errors named), so a shard that keeps a call open to its bus keeps nothing awake
  that slept.
- **Elsewhere, the runtime's own.** A crowded cell overloaded (`world:30,0`, six in ten minutes), 23 storage resets of a
  region channel, a lost connection: Cloudflare's, and rare - but each was thrown out of the Worker as an exception,
  and a reset before anything ran cost its player a reconnect's backoff (DO-ASK, below).

### Built

- **HUB-PULL - THE BUS NEVER CALLS A SHARD** (`src/net/hubShards.js` HUB_INTERNAL_POLL, `server/src/index.js`
  `_hubPollEnsure`, `_hubPollLoop`, `_hubPoll`, `_hubDownApply`, `_downTo`, `_hubPollInternal`, `_pollAnswer`,
  `_pollReply`). A shard (or a court's copy) keeps one poll at its bus while it holds a socket, started by anything it
  owes the bus (a hello first) and by its sync's alarm. The bus seals each batch it owes a shard into that shard's
  outbox, numbered as before (AUDIT SCALE II R2-7), and answers the shard's held poll with every delivery it has not
  acknowledged - or with nothing after HUB_POLL_MS (20 s). The poll says what the shard ran (`ack`, its newest
  delivery's number), and the bus lets those go; and the ids a delivery named that the shard no longer holds (`gone`),
  which the bus lets go as ShardSockets, as the push's answer did. A newer poll answers an older one with nothing (its
  shard gave up on it). The up half is as it was. Nothing the bus sends a shard is a call, so no round trip nests in
  another; the bus's calls to its shards (`/internal/hub/down`, `/internal/hub/resync`) are gone.
- **A woken bus's resync is its first answer.** AUDIT SCALE II R2-6's resync called every shard the bus had heard from
  (kept in storage, `vhubs`). Now a shard's first poll to a bus instance is answered `rs`, and the shard hands up every
  socket it holds at once. A bus that woke holds no poll, so every shard holding a socket asks it within a retry, and
  the bus writes nothing to remember them. The answer names the bus instance (`rb`) and every poll after it says the
  one it heard; until a poll does, `rs` is said again (the audit, below: a lost answer never spends it) - so a woken
  shard, which says none, is told it too.
- **Kept until it ran, and bounded.** A delivery stays in its outbox until its shard's `ack` says it ran: a poll whose
  answer was lost is answered with it again, and a delivery handed twice runs once (`_downSeen`, as before). An outbox
  holds HUB_OUTBOX_MAX (1024) deliveries and HUB_OUTBOX_BYTES (2 MiB) at most - past either the oldest is let go and the
  shard's next sync heals it (a close it never heard said again) - and the silent sweep (R2-9) lets a silent shard's go.
  The count is a delivery every HUB_BATCH_MS for as long as a poll may be out (HUB_POLL_MS + ROOM_CALL_MS); the bytes keep
  a bus's worst, every one of its HUB_SHARDS stalled at once, to a quarter of an object's 128 MB.
- **The loop never spins.** A miss is asked again HUB_RETRY_MS later, doubling to HUB_SYNC_MS / 2 - or at once when a
  hand-up of the shard's is answered meanwhile (the bus is back); an answer with nothing new - empty, or only deliveries
  the shard ran already - HUB_BATCH_MS later. A mutant that asked again at once hung the pins' process (a loop of
  promises starves the clock), which is the hazard the pacing answers. A poll that throws is a miss, never the loop's end.
- **Within the runtime's count.** A shard's polls are charged to its newest incoming event (a socket's frame, a call,
  its sync's alarm every HUB_SYNC_MS). A shard whose sockets say nothing while the hub is busy polls at most once a
  batch - some 2,400 polls to one alarm - under the 10,000 subrequests an invocation of the paid plan
  (workers/platform/limits).
- **DO-ASK - THE WORKER'S ASK OF A ROOM** (`server/src/relayScale.js` askRoom; the Worker's door and `layerWalk`). A
  Durable Object's error says `retryable` where the object was reset or its connection lost before it ran anything,
  and `overloaded` where its queue ran too long. Every ask the Worker makes is a socket's upgrade, so a retryable one
  is asked once more on a fresh stub and an overloaded one never; what is left is a 503 (`busy` or `unavailable`,
  `retry-after: 2`) that the page's backoff answers - never an exception thrown out of the Worker.
- **The pins' harness asks each poll itself.** `test/fakeRoom.mjs` fakeRooms sets `env.HUB_POLL` 'driven', and each
  world's settle calls `_hubPoll` on every shard after the buses seal; `poll: 'held'` runs the loop the runtime runs,
  on the real clock (`test/net/hubpull.test.js`).

### Pins

- `test/net/hubpull.test.js` (6): the held loop (one poll a shard at the bus, a delivery answering it, a line crossing
  shards with no hand driving it, every call between the objects TO the bus); a miss asked again later with its
  deliveries still owed, an empty or stale answer paced; the poll's door (held, the older answered at the newer, a
  delivery answering the held one, the `ack` letting go, the first poll's `rs` and `rs` said until heard); `gone`; and
  the audit's two (A1-A5, below). `tools/mutants/hubpull.json`: 20.
- `test/server/doask.test.js` (2): the Worker's door and the walk - a retryable error asked again once, an overloaded one
  never, what is left a 503. `tools/mutants/doask.json`.
- PIN MOVED: `test/net/auditscale2_bus.test.js` R2-6 (a woken bus's resync now the first poll's `rs`), R2-7 (a delivery's
  answer lost and handed twice, by poll; a close the bus let go of a shard cut off past HUB_SILENT_MS said again at its
  sync), R2-8 (the poll carrying a wrong `gone` reaches the bus before the reconnect's hand-up, so its guard stays
  pinned), R2-9 (the shard heard from keeps its very ShardSockets), R3-6 (a woken court's copy resynced by its first
  poll), D-7 (settled, so a second greeting would reach the socket), D-8 (HUB_POLL_MS and the outbox's bounds);
  `test/net/scale5c.test.js`'s count (the shard asks after the bus's tell); `test/net/scale2b.test.js`'s calls between rooms
  (twenty-three, eighteen on ROOM_CALL_MS after the merge of main - its INSTANCES twenty-four and twenty, less the push
  and the resync, the poll on its own deadline);
  `tools/mutants/auditscale2_bus.json` re-aimed by content (the resync's three to the poll's `rs`, the delivery's miss
  to its `ack`), `vhubs`' record retired with the storage it pinned, and the outbox's bounds and the silent sweep's
  purge added; `tools/hubShardBench.mjs` reads the bus's outbox where it read its pushes.
- RELAY_VERSION world210, its hash in `test/net/relayversion.test.js` and every pin on world209 moved. It was world208 on
  this branch until the merge of main, whose INSTANCES (`11-Multiplayer/Instances.md`) took world208 first, and world209
  until the next, whose WEAPON-GLOW1 (`05-Combat/Weapon-Glow.md`) took world209.

### The audit (2026-10-16, Mac: "Audit this and ensure perfection")

Two read-only lenses over the branch - the relay's HUB-PULL and DO-ASK, the account's PRIMARY-TRIPS (below) - each
finding reproduced against the branch and, where it was there, the merge base. The relay's:

| # | Found | Fixed | Pin |
|---|---|---|---|
| A1 | An `rs` answer awaited the hand-up it asked, and `_hubUpFlush` resolves only once the shard owes the bus nothing - a busy shard (a reconnect's storm, the rehellos `rs` itself asks) polled nothing meanwhile, and past HUB_OUTBOX_MAX (then 256, 6.4 s of batches) the bus let its oldest deliveries go: 63 of 320 lines lost in the repro | the held poll never waits on it (a single poll the harness drives still does) | hubpull audit (1), mutant rs-awaited |
| A2 | A sync `rs` made due while a hand-up was on the wire was never handed - the woken bus held none of the shard's quiet sockets until the alarm | the hand-up's tail hands a due sync too | hubpull audit (2), mutant due-sync-left |
| A3 | On main already: a hand-up's miss set its retry after a `return`, so it was never armed - a miss waited for the shard's next event or its alarm, a minute on | armed in the miss | hubpull audit (3), mutant miss-unretried |
| A4 | A poll backing off (to HUB_SYNC_MS / 2) was never cut short by a bus come back, while it sealed what the shard was owed | a hand-up the bus answers wakes it (`_pollRest`) | hubpull audit, the backoff; mutant backoff-unwoken |
| A5 | One throw (a delivery's run) ended the loop until the next owed event or the alarm | a throw is a miss | hubpull audit, the throw; mutant throw-ends-loop |
| A6 | `rs` was spent at the bus before it reached the shard - a lost answer, or a poll its shard gave up on, left the resync to the shard's sync | said until a poll names the instance it heard (`rb`) | the poll's door; mutants rb-unsaid, rb-unkept, rb-unnamed, rs-once |
| A7 | 256 deliveries were 6.4 s of a busy hub's batches, and 4 MiB a shard was half an object's memory for sixteen | 1024 (a poll's whole deadline) and 2 MiB | D-8's numbers and their relations |

Read and left: a shard reset with deliveries answered but not yet acknowledged has them handed again to its new instance
(its sockets, where they outlived it, hear them twice - the window is one poll); a held poll keeps a live shard resident
(the shards were active 21-23 hours a day already, above). DO-ASK was sound: only a socket's upgrade reaches askRoom
(the 426 comes first), so a second ask sends no body twice. The relay law's hash (then `world209`) moved with the fixes, before any deploy
(`test/net/relayversion.test.js` notes the first).

### The deploy

One relay drop, world210, at the merge (relay-deploy.yml) - every socket closes once, as every relay deploy does. No
account-service change, no migration. The old storage key `vhubs` stays in the buses' storage, read by nothing.

### Left, each with its reason

- **Every other call between rooms** is one-way at a time - a cell telling the hub, the hub asking a region's channel
  its census or wiping a hall - and none was refused in the 72 hours read. The rule HUB-PULL learned holds for all of
  them: an object that is called all day must not call back the objects calling it.
- **The runtime's overloads and resets** are its own; DO-ASK answers them, and the crowded cell that overloaded is
  SCALE5d's layers' to spread (it overloaded for ten minutes, once).
- **The account database, overloaded the same night** - PRIMARY-TRIPS, below.

## PRIMARY-TRIPS: built (2026-10-16, this branch - acct139, no migration, no drop)

The account database overloaded at 00:00 UTC on 2026-10-16, found while HUB-PULL read the relay (Mac: "Is the server
okay?"); Mac: "Keep this all in one PR. Start #2". Read off the service's metrics (Analytics Engine `daggerfall_accounts`)
and D1's own analytics and query insights.

### Measured

- **At 00:00 the requests' D1 wait went from some 0.5 s to 7.5 s in one five-minute bucket**, and stayed between 1 and 12
  s for the next hour and more (p50 wall up to 10 s; 31,045 refusals of 503 in the 00:00 hour), with the requests (37-41
  thousand every five minutes) and their statements (150-160 thousand) flat.
- **The primary is capped by its round trips, not its rows.** Its batches a second were 180-187 from 18:00 to 23:00 and
  224 at 00:00, every one of them 0.4 ms at p50 and 6-9 ms at p99 - DISPLAY-REPLICA's ceiling again. Each earlier hour of
  the same (10-14 at 14:00, 201 a second; 10-15 at 18:00, 180) tipped near the same count. Statements run some 1.2 to a
  batch, so nearly every statement is a trip of its own.
- **What moved at midnight was the replica's share.** The replica's batches fell from 215-227 a second to 168 and its p99
  went from 4 ms to 7-12 ms, while the primary's rose by the same: `/v1/homes/town` asked less (117,087 an hour to
  104,475) and sent the primary three times the statements (25,030 to 76,586), `/v1/prof/pixels` the same (14,024 to
  32,937). A session sends a read to the primary when no replica has caught up with its bookmark. What slowed the
  replica is D1's own; what the service can do is leave the primary room.
- **Where the primary's trips went** at the evening's peak (22:00, statements a second): a realm checkpoint 68.6 (8.96 a
  checkpoint), the heartbeat 18.2 (2.64 a heartbeat, a replica route), the token's mint 18.1 (5.14 a mint, a replica
  route), a harvest 11.7, Renown 11.1, a chapter's claim 10.9, the seats' list 9.7 (8.02 a list), a town's yards 7.8 (one
  read a request: the isolate's kept answer almost never there), a town's homes 7.5, the chapters' list 7.2 - some 200.
  Counted over the service on node:sqlite (the pins below count it so), a checkpoint was five trips (the lookup, its
  record's row, the ledger's two reads of the character's rows, the write's batch), a list ten, a mint twelve.
- **And the reads that scan.** A hall witness's version bump (`npcHalls.js` bumpRegions) read some 19,000 rows to touch a
  town's own handful: SQLite answered its `DISTINCT region` off the `(kind, region)` index, walking every hall report.

### Built

- **SEAT-BATCH.** The seats' list asks its holders, the week's battles and revolts, the Edicts, the works and the red
  lines in ONE batch (`server-account/src/seatTurning.js:"export async function seatsBoard("`) - where each was a trip -
  and answers them as before: `{ seats, red }`. Each reader's statement and its answer are apart (`holdsRead`/`holdsFrom`,
  `battlesRead`/`battlesFrom`, `edictsRead`/`edictsFrom`, `redRead`/`redFrom`) and the old readers keep their callers.
  Ten trips to five a list (four once the clock's facts row is fresh), three of them the primary's.
- **YARDS-REPLICA.** A town's yards read on a session of their own (`decor.js` YARDS_FROM) - SEAT-REPLICA's law a town at
  a time: any instance's first, then from the last kept read's bookmark, and the primary's right after this isolate's
  own decor write there. The isolate's kept answer still answers YARDS_KEPT_S. `bookmarkOf` moved to `service.js`, one
  reader for both. Some 500,000 primary reads a day of some 1,100 rows each, the most statement time of any read but the
  session's lookup, off the primary. Past YARDS_KEPT_MAX towns the newest bookmark let go is the floor every unmarked
  town reads from (the audit, below). Another isolate's write reaches this isolate's answer YARDS_KEPT_S and a replica's
  lag late, where it was YARDS_KEPT_S - so the owner's page holds its own writes over ANY answer YARD_WRITE_HOLD_MS
  (`scenes/homeYards.js`), not only one asked before them.
- **SAVE-BATCH.** A checkpoint reads its record's row, the ledger's two reads of the character's own rows (`ledger.js`
  ledgerReads) and - where the isolate kept none - the budget's config (`budget.js` budgetKept, budgetRead, budgetFrom)
  in ONE batch, one snapshot, before anything is judged; the verdict takes them as `known` (`verdict.js` verdictOn,
  `ledger.js` ledgerStep). Five trips to three.
- **SIGN-BATCH.** The doors that read a badge (`arena.js` ARENA_HONOUR_PATHS, the mint first) ask the arena's, Iliac
  Hand's and The King's Gambit's honours in ONE batch on the binding (`server-account/src/honours.js`
  withHonours over `arenaHonoursPlan`, `iliacHonoursPlan`, `gambitHonoursPlan`) - the Grand Champion's row, and each
  game's kept #1 and (Iliac's, the Gambit's) whether its season was played, where this Worker kept none - and each game's
  answer is read from its own, a stale #1 counted and stored after it as before (AUDIT SCALE4d A1: never off a replica).
  Six trips to one.
- **BEAT-LAST.** A heartbeat asks the box, the board and the post before its beat (`heartbeat.js`): a D1 session sends
  every statement after a write to the primary, and the beat, asked first, sent them there. None of them reads what the
  beat writes.
- **HALL-PLAN.** The bump's `SELECT DISTINCT +region` - the unary plus leaves the `(kind, key)` index the planner's, the
  answer the same.
- Estimated at the evening's peak, from the counts above: the seats' list -6 primary trips a second, the yards -8, a
  checkpoint -15, a mint -10 to -14, the heartbeat -10 - some -50 of 200, a quarter of the primary.

### The audit (2026-10-16, Mac: "Audit this and ensure perfection")

Each finding reproduced over the service on node:sqlite, against the branch and the merge base:

| # | Found | Fixed | Pin |
|---|---|---|---|
| B1 | YARDS-REPLICA moved an answer: an isolate's first read of a town was the primary's and saw every write; now it is a replica's, and another isolate's write - the owner's own, their next ask landing elsewhere - can miss it, kept YARDS_KEPT_S. Its comment said the lag was "less"; it is added | the owner's page holds its writes over any answer YARD_WRITE_HOLD_MS (a minute: the kept answer and a lag inside it), not only one asked before them - and FB1001 YARD-STALE's 30 s gap of another isolate's kept answer closes with it; the comment corrected | `test/scenes/fb1001_yard.test.js` PRIMARY-TRIPS audit, mutants hold-dropped and YARD-STALE's re-aimed |
| B2 | Past YARDS_KEPT_MAX towns (anyone can ask 4,096) every bookmark went with the kept answers, so a town's next read could be a replica's from before this isolate's own write or its last answer | the newest bookmark let go is a floor (D1's bookmarks sort oldest to newest - d1/reference/time-travel); a floor whose read fails is let go | primary_trips audit (yards), mutants floor-unkept, floor-oldest, floor-unread, floor-refused-kept |
| B3 | SAVE-BATCH read the budget's config in its batch but kept it after the save's opening and the baseline's R2 read: a staff change forgotten meanwhile was undone by the older row, kept a minute | kept the moment the batch lands | primary_trips audit (config), mutant config-kept-late |
| B4 | SIGN-BATCH decided a #1 was kept when it planned and read it after the batch: another request counting a new season meanwhile stood in its place (the last second of a season) | each plan keeps the id it saw | primary_trips audit (#1), mutants arena-, iliac-, gambit-kept-late |
| B5 | Two pins of a race between a checkpoint's reads and its write (`test/server/int2_judge.test.js` a staff hold, `test/server/int5_budget.test.js` a win's spoils) hooked the checkpoint's FIRST batch - SAVE-BATCH made the reads that batch, so the race landed before them and the guards they pin (the write's `judge_rev`, the grant's arithmetic) went unchecked: int_audit's INTA-the-rev-unguarded and INTA-the-grant-lost survived on the branch, dead on main | hooked at the object's put, which runs between the reads and the write, and the hook's firing asserted | both mutants dead again |

Read and left: a yards read that fails from a bookmark fails that one request (the bookmark is D1's own; the next starts
from none); a checkpoint refused early (a lease, a sequence) reads the ledger's and the config's rows in its batch for
nothing - a read, never an answer. SEAT-BATCH, BEAT-LAST, HALL-PLAN and the ledger's half of SAVE-BATCH: clean.

### Left, each with its reason

- **The session's lookup** is the first statement of every route not a replica's, some 3.3 million a day on the
  primary - each request's own; folding it into a route's first batch changes how every route authenticates.
- **The token's mint and the heartbeat start at the primary** where a tab carries no bookmark (SCALE4g's design, AUDIT
  SCALE II A-1's for the mint), and a lagging replica sends a session's reads back there: D1's to answer.
- **A harvest (25 statements), Renown (8) and a chapter's claim (9)** are writes, each a batch already in part; the next
  trips to take, one route at a time.
- **The chapters' list** (6.5 a list, 1.1 a second) and a hall witness's region read (some 9,400 rows a witness, every
  report of the region's towns, never trimmed) - small in trips; the read's rows are the witnesses' own.
- **What slowed the replica at midnight.** Not visible from here: D1's.

### Pins

- `test/server/primary_trips.test.js` (6): each slice counted over the service - the list's one batch of six, the yards'
  sessions (any instance's, the bookmark's, the primary's after a write), a checkpoint's three trips and its batch with
  and without the kept config, the mint's one honours batch on the binding and the kept #1s left out, the beat after
  every read, the bump's plan; and the audit's three (B2-B4). `tools/mutants/primary_trips.json`: 21 mutants, all dead.
- PIN MOVED: `test/ui/seat1c_client.test.js` and `test/net/crown2_client.test.js` (the list's line is seatsBoard's);
  `test/server/scale4d.test.js` (the yards ride one session of their own); thirteen account pins' own D1 fakes gain D1's `batch`
  (acc3titles, acc4played, accountworker, audit68_backend, audit_recoveryset, cloudsaves, founder3, founder4, mod1,
  recoverop, recoveryset, terms1, wb5b_gate_claim - a fake without it was a database D1 never is); ACCOUNT_VERSION acct139
  and every pin and mutant record on acct138.

## DECOR-BATCH - a home's room in one request (2026-10-16, acct142)

The owner's screenshots of every account deploy after #952 (AUTO-HOLD) merged: `/v1/homes/decor did not answer a
home's pieces (000)` - seven asks, 15 s each, no byte back, one `503 server` among them. The Worker had deployed and
every other smoke call answered, slowly: `played` and `renown/xp` 503 then 200, `homes/town` 11 s. The database was
overloaded again (BUSY-GATE's 503s, read off the live service the same hour: a one-row read 1.1-2.0 s, five 503s in a
row), and decor was the route that crossed 15 s first, because its read was the most trips IN A ROW: the room's pieces,
then whether the caller is shown them (homeVotes.js `homeShownTo`, HOME-VOTE A3), then what its owner took out
(BASE-HIDE) - three waits in the primary's queue, behind the session's own lookup, for a read every visitor at a door
makes. `homes/town` had been made one batch for the same reason (HOMES-SHED).

- **The room is one request** (`decor.js` `decorOf`): the three reads are one `db.batch` - the statements are the ones
  they were (`homeShownRead`/`homeShownOf`, `hiddenRead`/`hiddenListOf`, `vendorStockedRead`/`stockedOf` split each
  read from its answer so a batch can carry it), and every answer is the one it was. A palace's Charter Room (SEAT-HALL)
  is one read and stays one.
- **A shunned home's shop is one more** (`shopOf`): its hired traders' stock, one batch for all of them - it had been a
  trip a trader.
- What this does not do: the overload itself. The route read most often still asks the same rows; which reads fill the
  primary is the `Account database load` workflow's to say (`d1-load.yml`, the operator's - this session's GitHub App
  is refused its dispatch).

### Pins

- `test/net/homevote.test.js` (13: DECOR-BATCH's one): every round trip the service asks of its database counted where the
  Worker asks it (PRIMARY-TRIPS' count) - a visitor's room `batch 3`, the shunned room `batch 3` then `batch 2` (its two
  traders), the owner's `batch 3`; every answer as it was. `tools/mutants/homevote.json`: DECOR-BATCH's three (the three
  trips back, the shop a trip a trader, the hidden list dropped from the batch), all dead; HOME-VOTE's room-handed-out
  and II A1 licence-kept and `basehide.json`'s list-unread re-aimed onto the batch, all dead.
- ACCOUNT_VERSION acct142, and every pin and mutant record on acct141 (each pin's PIN MOVED history kept).

## BOOKMARK-SPIRAL - the polled reads start anywhere without a bookmark (2026-10-16, acct143)

The owner, after DECOR-BATCH: "Stop for the love of God avoiding this. Fix this" - the next deploy's smoke on
`/v1/homes/decor` 000 again (seven asks, 15 s each), and the owner's Cloudflare token handed over to read the live
service with. What it read:

- **The whole service, not decor.** From 13:50 UTC every route waited: p50 5-16 s, p90 25-66 s, half of all requests
  past 5 s, each on 1-10 ms of CPU, and the Worker's log `D1_ERROR: D1 DB is overloaded. Requests queued for too long.`
  on the heartbeat, the pixels, the town, the token's mint and the rest. Its statements were fast (p90 about 1 ms, no
  statement past 90 ms) and no more of them than the night before, which had been well at 120 requests a second
  against 100 now. The 16:25-18:25 episode of 2026-10-15 matches Cloudflare's own Durable Objects incident; this one
  matches none.
- **Where the requests went changed.** The session lookup (`accounts.js` WHO_SQL, every request's first statement)
  was the primary's 30 a second and the replica's 31 until 13:00; from 14:00 the primary's 61-68 and the replica's 1.
  Requests carrying an `x-d1-bookmark`: three in four of the town's reads at 10:00, one in a hundred of all reads
  at 16:00.
- **Why: a loop.** The page forgets its bookmark at every call that is not a bookmark read, and keeps a read's answer
  only if no forget went between the read and its answer (`accountClient.js` `_d1Era`, AUDIT SCALE II A-2). While the
  primary answered in a fraction of a second that almost always held. Once it answered in seconds, some other call
  nearly always went between, the bookmark was never kept again, and every display read started at the primary
  (`first-primary`, the law for a request with none) - which kept the primary slow. An overload's 503 does not do it:
  a session started from a bookmark answers that bookmark back even when its statement fails (workerd's
  `D1DatabaseSession.getBookmark`).

- **The six polled display reads, asked with no bookmark, start at any instance** (`service.js` ANY_REPLICA_ROUTES,
  REPLICA_ANY `first-unconstrained`): the heartbeat, the pixels, the motherlodes, a town's homes, the market's vendors
  and the arena's board - each asked again on the page's own clock, none of them a read a caller asks back at once
  after its own write (a beat's and a pick's write go to the primary in their session as before; BEAT-LAST reads the
  box, the board and the post first). With a bookmark, from it, as before. Every other replica read with none - the
  account view, the realm, the mint, a room's decor, a home's rooms, the caller's homes, its Marks, its invites, its
  saves, its lineages and unions - keeps the primary first, so the read after a write still reads it.
- **A session lookup that misses there asks the primary** (`accounts.js` `resolveSession`, the session's DB_ANY): a
  guest minted a moment ago is not on a replica yet, and a refused `auth` the client takes as final. A secret nobody
  holds costs the replica's ask and the primary's.
- The price: one of the six may answer from a replica a moment older than the caller's last write - the board without
  the note just posted until the next beat, a node still standing on the pixels a moment after it was cut. The
  write itself is the primary's and refuses what it must.

### Pins

- `test/server/bookmark_spiral.test.js` (3): the six named and nothing past them, each a replica route and not the mint;
  every replica route's session with no bookmark, with one, and with one D1 refuses; a heartbeat and a town read with
  no bookmark looking the session up on the replica and the primary asked for neither, the account view still the
  primary's (laggyD1's replica); a guest minted after the replica's last catch-up found, the primary asked once, and a
  secret nobody holds refused. `tools/mutants/bookmark_spiral.json`: 9, all dead.
- `test/server/display_replica.test.js`: its pin on the display reads with no bookmark moved - the polled ones at any instance.
  `scale4g.json`'s two records and `scale4d.json`'s D8 re-aimed by content, all dead.
- ACCOUNT_VERSION acct143, and every pin and mutant record on acct142 (each pin's PIN MOVED history kept).

## BUSY-HEART - the heartbeat and the motherlodes stand back (2026-10-16, acct144)

BOOKMARK-SPIRAL deployed at 20:07 UTC and did what it was for - the session lookup off the primary (74 a second there
and none on the replica, to 36 and 49), the primary's statements down from some 195 a second to 105 - and the overload
held: half of all requests past 5 s, the Worker's log still `D1 DB is overloaded`, now on the replica's sessions too.

- **It held while players were in the world.** The relay's deploy at 19:58 dropped every player; from 20:00 to 20:04,
  while they came back, the account service was well - p50 0.2-0.7 s - at some 245 primary statements a second, more
  than when the overload returned at 20:05 with them. The writes were the same in both windows (13.7 and 13.2 thousand,
  the realm's checkpoints 552 and 594). So it was not the database's statements: once slow, it stayed slow.
- **What kept it so** (the service's own metrics, `daggerfall_accounts`, D1 wait by route over the two windows): the
  heartbeat, 1,695 asks in the well window and 3,827 in the overload, the most of the database's time of any route;
  the day's motherlodes 495 and 1,550. Neither stood back (BUSY-GATE had left them out as reads the tab's bookmark
  keeps off the primary's queue - and the page kept none), and the heartbeat asks again on `server` or `offline` three
  times in 2 s (net/heartbeat.js, NOTICE_RETRY_MS).

- **Both stand back now** (`net/busyLaw.js` BUSY_READS, one law at both ends): an isolate that meets an overload sheds
  them for BUSY_SHED_MS, no statement asked, for every client today; a client from this build holds them for the
  doubling wait. What a shed ask loses is what a failed one lost already: a beat's play credit (net/playClock.js, a beat
  that fails is dropped) and a pick the next ask rolls again (INSERT OR IGNORE of a pure roll).

### Pins

- `test/net/busy_heart.test.js` (2): the client holds both after an overload answer and asks at the wait's end; an isolate
  that met an overload answers both `server` 503 with a Retry-After and not one statement, and asks again after
  BUSY_SHED_MS. `tools/mutants/busy_heart.json`: 2, both dead; `busy_gate.json` all dead.
- `test/net/busy_gate.test.js`: the law's list, its always-goes list and the client's goes list moved.
- ACCOUNT_VERSION acct144, and every pin and mutant record on acct143 (each pin's PIN MOVED history kept).

## SHED-LONG - BOOKMARK-SPIRAL rolled back, the shed 10 s (2026-10-16, acct145)

BUSY-HEART deployed at 21:07 UTC (run 263, dispatched by the owner after #961's pins): the account Worker's p50 went
from 17-45 s to 5-13 s and its p90 from 42-105 s to 25-35 s, at the same traffic - eased, not well. The service's own
metrics from 21:07:30 (D1 wait by route, its answered requests only): every route on a D1 session waited 31 s on the
database on average, every route on the binding 5.6 s - town 26 s, pixels 24 s, heartbeat 32 s, motherlodes 58 s,
the mint 74 s; a realm checkpoint 10 s, renown 13 s. The replica was the longer queue, and had been before
BOOKMARK-SPIRAL too (16:00-16:30: sessions 21-47 s, the binding 1-13 s) - BOOKMARK-SPIRAL had moved some 40 session
lookups a second onto it, while the primary, answering in a fifth of the time, had shown 245 statements a second well
(20:00-20:04).

- **BOOKMARK-SPIRAL rolled back** (`service.js` ANY_REPLICA_ROUTES, now empty): every replica route with no bookmark
  starts at the primary first again, as DISPLAY-REPLICA made it. Kept: `replicaDb`'s DB_ANY and `resolveSession`'s
  miss asking the primary - so a session opened at any instance (REPLICA_ANY) never refuses a session minted a
  moment ago, wherever one is opened.
- **An overload's shed is 10 s** (`net/busyLaw.js` BUSY_SHED_MS, was 2 s): sheds were answering (544 of the town's
  6,475 asks, 628 of the heartbeat's 5,122), and still every answered read waited half a minute - two seconds' rest
  let the next wave of the same reads in before the queue had drained.

### Pins

- `test/server/bookmark_spiral.test.js` (3, rewritten): no route at any instance; every replica route with no bookmark, and
  one D1 refuses, at the primary; with one, at it; a heartbeat and a town read looking their session up on the primary
  (laggyD1); on a session at any instance, a session the replica holds found there and the primary never asked, one
  minted after the replica's last catch-up found on the primary (asked once), a secret nobody holds refused.
  `tools/mutants/bookmark_spiral.json` re-made for the rollback: 6.
- `test/net/busy_gate.test.js`: BUSY_SHED_MS 10 s.
- ACCOUNT_VERSION acct145, and every pin and mutant record on acct144 (each pin's PIN MOVED history kept).

## THE PLAN PAST 2,000 (2026-10-10)

Mac, after #755's merge: "Alright lets now tackle the bigger work. I want to go deep and really future proof our
archetecture while also increasing performance". **Design target: 10,000 concurrent, each limit grown by adding
objects, never by a rewrite.** Four read-only surveys measured the tree first: the hub's every duty, every other room
kind, the account service's load, and what one client costs. Their scratch benches and models are not committed; each
slice below measures again with a tool of its own in the tree.

### What breaks, and when

| | 2,000 | 5,000 | 10,000 |
|---|---|---|---|
| **A relay deploy** | 2,000 mints of 13 statements in seconds - the primary overloads (it did at 500, above) | | 10k mints, about 40k socket hellos |
| **The account primary**, steady (a model: 197 requests, 1,073 reads and 264 writes a player-hour) | 743 statements/s | 1,857 statements/s - past what one primary answers at 1 ms a query | 3,714 statements/s, 733 writes/s |
| **The hub** (`chat:world`) | full: 2,048 sockets, a tab connecting counts | | |
| **A region channel** (one per region, 2,048) | the start region's wave: 2,332 busy refusals, 500k frames at 1,000 | the start region full | |
| **A crowded cell** (256 sockets, everyone's halo socket counts) | a capital full; about 90k pose sends/s and 20 MB/s out of one object; 87-99% of foes frames dropped by the room's budget | | |
| **Event rooms** (the gate's court, the Abyss realm, the arena's hall and exhibition: one object each, 256) | a popular court full | | |

### The principles

1. **Nothing every player touches is one object.** A singleton keeps world state that changes rarely (a kill, a
   herald, the day's roll); a player's connection lands on an object chosen by their account or their place.
2. **A relay deploy does not storm the database.** The reconnect is spread by the room's own count, and a mint is
   cheap. Past that, a reconnect needs no mint at all (Mac's decision 1, below).
3. **The wire fans less.** Poses are quantised and batched per listener, channel rosters move as deltas, and a halo
   hears a player's pose at a walking rate, not its full one.
4. **Measured before and after.** Every slice adds the metric that says when its limit is near, so the next slice is
   chosen by the field, not by a model.
5. **Fewer drops.** Relay changes ride as few announced deploys as possible. A setting is not a deploy.

### The slices, in order

1. **SCALE4e** (built, above): the deploy outlasts an overloaded database.
2. **SCALE2c - the client's half, no relay deploy** (built, below).
   - A relay deploy's reconnect waits for the page's one slot in a window as long as the hub takes to admit everyone
     online, so the mints arrive at the hub's rate, not all in two seconds.
   - A full foes frame that says nothing is said once, not every two seconds.
   - (Moved to SCALE5b: a halo hearing a player's pose at the keepalive's rate. The relay judges serpent fights,
     trails, duels and the Wild zone off the poses that reach each cell, halo copies included, so the thinning is the
     relay's to do with those referees in hand, not the client's alone.)
3. **SCALE4f - the account's half, no drop** (its first part built, below).
   - The mint folded from 13 statements to about 4: the character's four realm rows, its Renown and its guild in one
     keyed read; the week's seat titles kept.
   - The metrics the primary's ceiling needs: SQL time per request (how busy the primary is), rows read and written,
     whether a replica served it, and D1's overload as its own refusal, not `server`.
   - The writes coalesced: the session touch one statement, Renown reported less often or at a level, the
     checkpoint's judge folded into its UPDATE.
   - Whether TOKEN_REUSE_MS rises toward the token's five minutes: about 10-30 mints a player-hour come from doors
     and room changes, not deploys, but a room would then hear a level or a guild up to four minutes stale (it is a
     minute today).
4. **SCALE4g - replicas for the read routes, no drop** (built, below; AUDIT SCALE II D-10: the seats list stayed on the binding). The heartbeat, motherlodes, the seats list, professions and
   the account view on a D1 session that starts from the bookmark the client carries back from its last request, so a
   player always reads their own writes. About 55-62% of reads leave the primary.
5. **SCALE5b - the relay's hygiene and the wire's second form, ONE announced drop.**
   - The foes arm out of `_message` (it runs interpreted) and its budget asked before its walk; directed frames by an
     id map; the host kept, not walked for; an empty room's sweep not paid on every entry; a boss's beat one frame.
   - Metrics: `room full` (the Worker refuses it before any metric today), budget drops, peak sockets, frames by type.
   - The wire's second form, offered by the hello and gated on the welcome's version, so an old tab keeps the first:
     quantised poses without default fields, batched per listener a tick (88 sends a pose become about one a
     listener a tick), channel joins and leaves as one roster delta a tick (the N^2/2 wave gone), looks by hash (AUDIT SCALE II D-10: NOT
built - left; a look rides each hello as it did, and nothing measured asks for it yet).
   - `BOSS_BODY` and the Discord settings read at run time, so changing one no longer drops every player.
   - A halo hearing a player's pose at a walking rate, with the referees that read halo poses (the serpent's fight,
     INT11's trails, duels, the Wild zone) kept at full rate.
6. **SCALE5c - the hub split, ONE announced drop** (built, above - thin shards and a fat bus, the hub's and each region's).
   - **Sixteen hubs, chosen by the account** (`chat:world.<k>`, k from the account's subject). An account's every tab
     lands on the same hub, so ONE-SEAT, the account's record, its receipts and its tabs stay on one object. At 10k
     that is about 625 sockets a hub, room for 32k.
   - **`chat:world` becomes the world's bus**, holding no sockets: it keeps the world's state it already has in its
     storage (the gate's and serpent's kills, the rite, the raids, the Abyss record and director, the heralds, the
     wild halls), takes the other rooms' calls as it does today, and fans each word, line and broadcast to the
     sixteen hubs, batched a tick. Each hub fetches an account's record from the bus the first time it sees it, so
     nothing is migrated in bulk.
   - **Across hubs**: a friend's presence, a party's poses, quests and maps, and a social act go hub to hub by
     internal call - the target's hub is computed, not looked up. Staff lookups by name ask the sixteen.
   - **The World tab** says the true count (summed by the bus) and lists the people on its hub, friends and guild
     (Mac's decision 2).
   - Then **the region channels** on the same machinery: a region's channel split by account, its lines and marks
     through a region bus.
7. **SCALE5d - event rooms and crowds, by the metrics.** The gate's court, the Abyss realm and the arena as copies
   around one fight object that takes their blows batched and fans the boss's state back. Crowded cells: SOCKETS_MAX
   raised as far as SCALE5b's batching measures room for, then layering (Mac's decision 3). (Built, above: layers for a
   crowded place; copies for a gate's court, the one event room whose law admits past a room.)
8. **SCALE4h - 10k writes, by the metrics.** A player's hot rows (the session, the play clock, the Renown tally, the
   rate windows) off the one primary: per-account objects or account shards, chosen once SCALE4f's metrics say how
   busy the primary really is. (Built, above: measured, the tally and the touch written less at the source, and the metrics
   by table.)

**Deploys:** SCALE2c, 4f, 4g and 4h drop nobody. SCALE5b and 5c are one announced relay deploy each, and the
account service ships before either (SCALE4e makes it survive the wave either way). (AUDIT SCALE II L1 and D-10: as
built, SCALE5b, 5c and 5d are ONE relay deploy, world192, and it is not by hand: relay-deploy.yml runs it at the merge,
with the site's and the account service's (acct112).)

### Mac's decisions

1. **A reconnect's token.** Today a token is spent once (Mac, 2026-09-21: replay closed), so every reconnect after a
   deploy is a mint. SCALE2c and SCALE4f make that affordable to about 5,000. Past it, either the mint stays
   (spread over longer and longer waits) or the token is bound to a key the client holds, so presenting it proves
   possession and it can be presented again until it expires. A reconnect then mints nothing, and replay stays
   closed. Recommended at 5,000, not before.
2. **The World tab past one hub.** The count stays true. The list shows the people on the player's own hub (about 625
   of 10,000), their friends and their guild, with a search by name. Today it already names only the oldest 512.
3. **A full city.** Past what one object can fan, either a city's crowd is split into layers (copies of the same
   place whose players do not see each other, as many MMOs do) or the city refuses `room full` as it does today.
