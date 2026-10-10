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
| SCALE4d | The token's mint on a D1 session - its first statement the primary's, its reads after it a read replica's - and the deploy turns the database's read replication on | No | **Built** (2026-10-10, this branch; acct106) |
| SCALE5a | At 500 online: the hub's hello and leave without a walk of every socket, a busy refusal that mints nothing, the World tab's count past the roster's cut | Yes, once | **Built** (2026-10-10, this branch; world189 - NOT YET DEPLOYED) |
| SCALE5 | Past about 1-2k players: the hub split (presence and social state per account, world chat over shard rooms), slimmer or binary poses, pose-only halo frames | Yes | When the metrics say - SCALE5a measured where the hub's wall is |
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

No player is named, and a metric never costs a request. The module's header carries the query. Smart Placement runs the Worker near its database.

**Indexes.** `0043_scale_indexes.sql` holds twelve indexes, each found by the planner and pinned by it (`test/scale1.test.js` C). `node_harvests` has been rebuilt four times to widen its CHECK, so a fifth rebuild must recreate `idx_node_harvests_day`.

**D1's hundred parameters.** The market's materials view and its medians bind their keys as one JSON array (`IN (SELECT value FROM json_each(?))`). The planner still uses `idx_market_open`, and tighter than before. The pin runs the whole catalogue (113 materials) through a D1 that refuses past 100.

**Deploys.**
- `account-deploy.yml` runs the suite (`verify.yml`) before it deploys.
- `relay-deploy.yml` runs the suite only when the relay's version differs from the live one, and deploys only if the suite passed.
- The account deploy writes the database's Time Travel bookmark to the run summary before the migrations.

**Retries.** `src/net/backoff.js` holds `jittered` (a wait anywhere from half to one and a half times itself) and `ASK_AGAIN_NOW` (only `offline` and `server` are asked again within one press). The professions', market's and writs' books send `rate` and `maintenance` straight back, kept for their slower pumps. The Drakes' book waits between its asks.

**Pins.** `test/scale1.test.js` (10). `tools/mutants/scale1.json`: 35 mutants, 35 dead. `npm run account`: 46/46 in workerd, with `METRICS` bound locally, so the counting proxy ran over a real D1. The service is `acct43`.

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
- The relay refuses such a hello (`CLOSE_POLICY`). If the device is signed in (the service was slow, rate-limited or down), the primary retries backed off hard, as for a busy room, and a halo is retried rather than remembered terminal.
- Only no sign-in (`no-session`) or a sign-in the service refused (`auth`) stays final. Signing in is the way back from those.

**The channels' rejoin is jittered** (`OnlineSession.rejoin`)
- After a terminal close, the wait is drawn once, anywhere in [half, one and a half) of `CHAT_REJOIN_MS`.
- Before, every tab's channels came back on the same thirtieth second.

**Pins.** `test/scale2.test.js` (8). `tools/mutants/scale2.json`: 19 mutants, 19 dead. Re-aimed, still dead:
- ACC1d-8 / 9 / 10 / 12
- the three TOKEN-WAIT mutants
- RENOWN1's character mutant

## NET-SMOOTH: shipped (client only, no relay deploy)

Mac, 2026-10-04: "Sometimes other players rubberband, I want to continue to improve performance and future proof for
larger amounts of players". Asked, Mac chose client fixes first and a batched relay deploy later. The record is
`06-Systems/Online-Arc.md` NET-SMOOTH. For scale it matters in three ways:
- **A crowd degrades smoothly.** SLAM3 slows a crowded sender and SLAM6 gives far listeners one pose in four. Before,
  the rate changes as a peer crossed a tier made the peer dash; now a backlog or a promotion is walked at no more than
  twice the pace, and a demotion is walked over its own interval.
- **More halos, no more jumping.** Every halo a player holds is another copy of every nearby pose. One source room per
  peer makes the copies harmless however many rooms overlap.
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

**Pins.** `test/scale2b.test.js` (15). `tools/mutants/scale2b.json`. Re-aimed: the hello bucket's storage pins
(online_relay, chat1, world1, profile2), ONLINE1's and CHAT1's pose-frame pins (the send time), SOC1's last-seen pin,
CHAT1's meter regex, REALM P0.5's checkpoint regex; `test/fakeRoom.mjs` and slam5's harness bring a socket in by the
object's own door (`_adopt`), as `fetch` does.

## SCALE3 and SCALE4a-c: built (2026-10-08, this branch)

Mac, 2026-10-08, asked "How can we continue to improve server performance and overall game performance", and then, of
the list it was answered with, "Do 1 2 and 3": the account service's two reads made one (SCALE4a), SCALE4 (here 4b and
4c), and SCALE3. The service is **acct95** with migration **0091** (acct94 and 0090 until the merge with main, where
SD9b had taken both); it deploys with the site, which waits for it. No relay change. All four were audited before the
merge (AUDIT SCALE, `01-Overview/Audit-Scale.md`); what it found is written into each section below, and every account
figure here was measured again after it. The relay's could not be, on the boot that did (below).

### SCALE3: the load harness (the local half)

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

**Pins.** `test/scale3.test.js` (5) pins the parts that stand without a toolchain; `tools/mutants/scale3.json`: 11
mutants, 11 dead. AUDIT SCALE pinned the measurement itself (`test/auditscale.test.js` section C: the report's
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

**Pins.** `test/scale4a.test.js` (3): the two old reads are the oracle. `tools/mutants/scale4a.json`: 6 mutants, 6
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

**Pins.** `test/scale4b.test.js` (6), over the real Worker. `tools/mutants/scale4b.json`: 27 mutants, 27 dead
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

**Pins.** `test/scale4c.test.js` (8); `tools/mutants/scale4c.json`: 28 mutants, 28 dead. Re-aimed by content, still
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

**Pins.** `test/perfrelay1.test.js` (3): inRangeOf answers inRange over every key kind and pose shape (absent, empty,
NaN, infinite, a pixel edge, either side of zero); over a room of 60 past POSE_FAN_MAX, with listeners out of range and
listeners walking the range's edge and an id-less socket with a pose, every moving pose reaches exactly the listeners
`poseFan` names over those inRange hears, and a keepalive exactly everyone in range; `_poseFrame`'s bytecode is under
the ceiling and `_message`'s over it (a fold back leaves no `_poseFrame` to print). `tools/mutants/perfrelay1.json`:
8 mutants, 8 dead. `test/relayversion.test.js` carries world184's law; PIN MOVED: the files that pin RELAY_VERSION (35, 37 at
the merge of main),
`disc7`'s list of versions, `soc1.json`'s S38 record, and CHAT1's pin on the arm's order (`test/chat1.test.js`, read
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


## SCALE4d and SCALE5a: built (2026-10-10, this branch - acct106 and world189, NOT YET DEPLOYED)

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
- **Unmeasured.** The account Worker runs under Smart Placement, beside its primary (SCALE1). Whether a replica takes
  the mint's reads from there, or the nearest instance is the primary itself, is Cloudflare's to say. The service's
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
- **Whether a replica serves the mint** under Smart Placement: unmeasured, above.

### Pins

- **`test/scale4d.test.js` (7).** The mint runs on one session opened `first-primary`, the session lookup first, every
  claim read through it, and the honours alone on the binding (A1). No other route opens one: the play beat, the
  heartbeat, Renown's report and the realm's list, each answered 200 (D3). The claims are byte for byte the binding's,
  the same token. The metrics point counts the session's statements and the honours'. DB_ROOT is the binding, through
  the counter too, and a binding with no sessions is answered as it stands; the fake's session is a class that reads
  its own fields (D8). The budget's config is read once across two requests' Proxies, and forgotten for both by a staff
  change. The deploy turns replication on after the migrations and before the Worker, mode auto, never a stop (D5).
- **`test/scale5a.test.js` (13).**
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
