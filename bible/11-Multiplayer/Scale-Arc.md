# THE SCALE ARC: the servers, ready for a larger player base (SCALE)

Opened 2026-09-30. Mac: "I think now is the time we take some time and really beef up our server architecture, improve performance and really get detailed. Whatever we can do to really enhance everything and set the stage for a larger player base in the future." Then, of the plan: "This is all you man. Just do whatever is best."

**Target:** about 500 concurrent players within the year, on Workers Paid (Mac's answers, 2026-09-30). **Delivery:** plan first, then reviewable PRs. Nothing reaches players until Mac merges it, because a merge deploys.

## Where things stood (the audit, 2026-09-30)

Four read-only audits covered the relay (`server/src/index.js`), the account service (`server-account/src/`), what one client costs both, and operations. Every figure is arithmetic from the code's own constants. **None has been measured live**; measuring is SCALE3's job.

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
- **Writes inside reads:** reads write (the market settle, the History sweep, the board sweeps, the professions' state sweep, the writ close). That rules out D1 read replicas, and every reader races to run the same sweep. *SCALE4.*
- **Unbounded growth:** `world_witness` rows (one per key per account, never trimmed) are read whole by the market and professions. `rate_limits`, the idempotency tables and abandoned guests are never pruned. There is no cron. *SCALE4.*

**Relay** (Durable Objects)
- **The hub:** `chat:world` is one object every player joins. It has a hard 2,048-socket cap, sends each join and leave to all N sockets, and rebuilds its socket index on every fetch. It is not the limit at 500; it is the limit past about 1-2k. *SCALE5.*
- **O(N) work per frame:** `_all()` and linear `.find` lookups on every frame. Every pose writes its attachment and sorts the room's listeners. *SCALE2.*
- **Storage on the connect path:** the `hellos` bucket and the secret are read and written on every hello, before the gate refuses a busy room. *SCALE2.*
- **Memory:** `_parties`, `_recs` and `_spent` are unbounded or thrash. *SCALE2.*
- **Cross-room calls:** none has a timeout. *SCALE2.*

**Each client**
- **Rooms that never sleep:** the foes stream sends a full frame every 2 s even with nobody else in the room, so the room never hibernates. Dungeon memory publishes every 15 s whether or not it changed. *SCALE2.*
- **Checkpoints:** every 120 s, sent even when the save has not changed. *SCALE2.*
- **Account requests:** about 150-300 per active player-hour: token mints, checkpoints, the mail poll, the play beat, renown, the board. *SCALE4 consolidates them.*
- **Retries:** four books retried `rate` and `maintenance` within 0.4-1.5 s, and the Drakes' book retried with no wait at all. *SCALE1 fixed these.*

**Operations**
- **No visibility:** only uncaught errors were logged, and nothing was measured or alerted on. *SCALE1: account metrics. SCALE2: relay metrics.*
- **No load test:** none exists. *SCALE3.*
- **Ungated deploys:** the relay and account deploys did not wait for the suite. On 2026-09-30 the site's deploy stopped at a red "lint and types" while the service shipped the same commit. *SCALE1 fixed this.*
- **Relay deploys:** the version was bumped 21 times since 09-24, and each bump drops every player. *Policy, below.*
- **Abuse controls:** no Turnstile on guest accounts, rate limits keyed by the full IPv6 address, `ALLOWED_ORIGIN = "*"`, no ban/report/ignore. *SCALE6.*
- **Backups:** R2 keeps each character's current and previous save only. *SCALE6.*

## The slices

| Slice | What | Drops players? | State |
|---|---|---|---|
| SCALE1 | The account service's half: fewer writes per request, metrics, indexes, the 100-parameter fix, gated deploys, D1 bookmark before migrations, client retry discipline | No | **Shipped in this PR** |
| SCALE2 | The reconnect wave, from the client - NO relay deploy: one token for a connect's rooms (reused within a minute, never twice into one room, one mint on the wire), a tokenless refusal asked again while signed in, the channels' rejoin jittered | No | **Shipped** (after SCALE1) |
| SCALE2b | The relay's own, ONE announced relay deploy: the O(1) socket index, the hello path in memory, bounded caches, cross-room timeouts, relay metrics, idle rooms allowed to sleep (foes and memory only when someone else is there) | Yes, once | Next |
| SCALE3 | The load harness: a Node bot fleet (guest → realm character → token → hello, one tab each) against local workerd, then a staging pair; the deploy-storm scenario in both token modes | No | **Shipped** (the storm; poses, chat and checkpoints at rate are its next scenarios) |
| SCALE4 | D1 discipline: sweeps moved to a `scheduled()` cron, retention for the tables that only grow, the witness tables redesigned, reads made write-free and served from read replicas (Sessions API), one heartbeat replacing the mail, beat and board polls, 304s | No | After SCALE3's numbers |
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

## SCALE3: the fleet, and the first measured numbers

`npm run load` (`tools/loadBots.mjs`) stands up both Workers in local workerd, using one throwaway key pair and a throwaway database. It seats N bots, each a guest with a realm character; the relay's door signs `rc` off that character, so a bot without one is refused. Then it runs a relay deploy: every bot opens its four rooms in the same instant, as every tab does when the relay drops everyone. The four rooms are its cell and a halo beside it around Daggerfall city (cell 12,13), the hub, and a region channel. Each bot is one tab: a single peer id in every room, and the connect claims the account's seat (`cl`, ONE-SEAT).

The storm runs in both token modes:
- **per-socket:** the client before SCALE2.
- **per-connect:** SCALE2's minter.

For each mode the report gives mints, mint latency, time to each room's welcome, and every refusal in the relay's own words. Two limits apply:
- **Bots per local run.** The service allows sixty guests per fifteen minutes from one address, so sixty bots is the local ceiling. Each run's database is new.
- **Never production.** `--account`/`--relay` point it at a staging pair; nothing in it names a production address, and a pin holds that.

**2026-09-30, local workerd, 60 bots, 240 sockets** (`scale3.test.js` pins how a run is summed up):

| Mode | Mints | Mint p50 / p95 | Welcome p50 / p95 | Refused |
|---|---|---|---|---|
| per-socket (before SCALE2) | 240 (4 a bot) | 3.9 s / 4.7 s | 5.5 s / 7.2 s | none |
| per-connect (SCALE2) | 60 (1 a bot) | 0.73 s / 0.75 s | 2.1 s / 2.4 s | none |

These times are workerd's D1, which is SQLite on local disk with no network between the Worker and its database. The absolute times are not production's; the ratios are what carry over:
- A quarter of the mints.
- About a sixth of the mint latency.
- About a third of the time to welcome.

The per-socket welcome p95 already stood at 7.2 s, against the client's 8 s `TOKEN_WAIT_MS`, with sixty players on one machine. That margin is what a production D1's network round trips would have spent: past it, the storm's tokenless hellos were refused, and before SCALE2 the players were offline for good.

What the fleet found about itself on the way, each fixed:
- A bot that used a fresh peer id in every room was read by the hub as a second tab and refused ("online in another tab"). A tab's id is one in every room.
- Node reports some of a run's own closing sockets as 1006. They were counted as drops and retried after the run.

**Next scenarios:** poses at 10 Hz in a crowd, chat at its rates, and checkpoints every 120 s. Then a staging pair, where the numbers are production's.
