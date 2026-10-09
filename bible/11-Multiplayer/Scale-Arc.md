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
| SCALE4 | D1 discipline: sweeps moved to a `scheduled()` cron, retention for the tables that only grow, the witness tables redesigned, reads made write-free and served from read replicas (Sessions API), one heartbeat replacing the mail, beat and board polls, 304s | No | **4a-4c built** (2026-10-08, this branch): the joined session read, the cron and retention, reads write-free, the heartbeat. Left: the witness redesign, the replicas, 304s |
| SCALE5 | Past about 1-2k players: the hub split (presence and social state per account, world chat over shard rooms), slimmer or binary poses, pose-only halo frames | Yes | When the metrics say |
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
- **The relay's pose path** (`07-Rendering/Performance-Next.md` 15): a relay deploy, in its own announced window.
