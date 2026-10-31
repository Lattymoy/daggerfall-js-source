# Server Scale

How the relay (`server/`, Durable Objects) and the account service (`server-account/`, one D1 database) carry a large
player base. Players never see this page's work directly: they meet it as a reconnect that waits its turn after a relay
deploy, a city that overflows into a copy of itself, and a tab that stands back while the database is overloaded.

## How it works

### The relay

**The hub is sixteen shards and a bus.** A player's hub link lands on `chat:world.<k>`, where `k` is a hash of the
verified account (`src/net/hubShards.js` `HUB_SHARDS`, `hubOfSubject`). Every tab of an account lands on the same shard.
`chat:world` holds no player sockets of its own: it is the bus that keeps the world's records and laws, and each shard
hands it hellos, frames and closes (`HUB_INTERNAL_UP`). The bus never calls a shard. Each shard keeps one poll open at
the bus (`HUB_INTERNAL_POLL`, held up to `HUB_POLL_MS`), batched both ways every `HUB_BATCH_MS`. A shard re-states its
sockets every `HUB_SYNC_MS`, so a lost hello or close heals.

**Region channels are whole by default.** Each of the 71 region channels (the Bay's 62 and the nine provinces) holds its
own sockets and sleeps between lines. The relay can split a Bay region into four shards by naming it in its
`REGION_SHARDS` var (`regionsSharded`; `all` means the Bay's 62). A province past the Bay has no shard keys
(`REGION_SPLIT`); one whose crowd nears `CHAT_SOCKETS_MAX` is split by raising `REGION_SPLIT`.

**Open-country cells form a tree.** The page always computes its fine 16-pixel cell. The Worker maps that key to the
node that holds it, and the node is the object the cell's sockets share (`src/net/cellTree.js`, levels L0 to
`CELL_LEVEL_MAX`). Each socket keeps its fine key, so every law that reads a cell reads the same key. With the
`cellSeed` setting off the tree is fixed at L0 (every fine cell its own object). Seeded, a node over `CELL_SPLIT_AT`
sockets for `CELL_SPLIT_DWELL_MS` splits into four, and four quiet siblings merge (`server/src/cellMoves.js`
`CELL_LAW_DEFAULT`, overridable from `server/wrangler.toml`). A move hands the node's stored rows to the new nodes
(`server/src/cellHandover.js` `handOver`).

**A crowded place overflows into layers.** A cell, building or dungeon past `SOCKETS_MAX` (256) sends the next player to
a copy, `key#n`, up to `LAYERS_MAX` (8) (`src/net/wire.js`; the Worker's walk in `server/src/relayScale.js`
`layerWalk`). Players in different layers do not see each other. A page may ask for its party's layer (`?ly=`); an
asked layer that is empty is refused, so `?ly=` is never a private copy. Only the last layer's refusal reaches the page
as `room full`. A gate's court copies its crowd instead: copies hand their sockets to the one fight (`COURT_COPY_RE`;
see `World-Bosses.md`).

**Halos hear less.** A player's pose goes to its own cell at `POSE_HZ` but to a neighbouring halo cell only when it is
due: the first pose, a new map pixel, `HALO_STEP_M` (8 m) moved, a stop at a new place, or the heartbeat
(`src/net/online.js` `haloPoseDue`). A halo gets every pose while the player's own cell socket is down, while it reaches
a player who does not hold that cell, or while a referee (a duel, a serpent's fight) may stand in it.

**A lone player lets cells sleep.** With no peer and no referee in any room it holds, a session sends its pose down its
own cell only every `LONE_POSE_MS` (60 s), and none down halos (`src/net/loneSleep.js`). The moment anyone is near, it
says where it stands and returns to `POSE_HZ`. The relay is unchanged by this. A session goes quiet only for a relay
that welcomed it as `LONE_RELAY_MIN` or later.

**The second wire.** A socket whose hello says `w2` hears the room's poses batched every `POSE_BATCH_MS` as one
`{t:'poses'}` frame, each pose slimmed (`slimPose`: default fields left out, place to the centimetre). Channel joins and
leaves batch every `ROSTER_BATCH_MS`. A socket without `w2` hears the first wire byte for byte.

**The foes budget.** A room's foes fan spends at most `FOES_ROOM_BYTES_PER_S`. Deltas stop at a reserve of a quarter
(`FOES_FULL_RESERVE`); a full frame, a handover, or an unheard sender's first frame may borrow below it. Where full
frames alone exceed the budget, a refused first frame is held for its turn, one a sender a turn
(`server/src/foesHold.js`, wired by the Room's `_foesFan` and `_foesDrain`).

**Rooms sleep when drained.** A room's last leave posts every open window (the spawn-grant measure, staff feeds, the
reviewer feed) and clears its timers, so a crossed cell can hibernate (`server/src/drainWindows.js` `flushAtDrain`).

**Hygiene.** The socket index is kept, not re-walked (`IDX_TRUST_MS`). Caches are `Bounded` maps that drop their oldest
entry. Every call to another room has a `ROOM_CALL_MS` (5 s) deadline (`askRoom`).

### The reconnect after a relay deploy

A deploy closes every socket. One token opens all the rooms of a connect and is reused for `TOKEN_REUSE_MS` (60 s); a
room spends a token once (`src/net/accountClient.js`). While mints fail or the busy gate holds, the held token stretches
to `TOKEN_STRETCH_MS`. When two or more sockets drop within `WAVE_WINDOW_MS`, the page waits one random offset over a
window as long as the hub takes to admit everyone online, at most `WAVE_SPREAD_MAX_MS` (`src/net/reconnectWave.js`
`waveSpreadMs`). The account service's sign-in doors stand in one line kept by one object (`server-account/src/admit.js`
`AdmitGate`, `ADMIT_RATE` a second); a line that fails lets everyone in.

### The account service

**Reads on replicas.** Routes in `REPLICA_ROUTES` run on a D1 session (`server-account/src/service.js` `routeDb`). A
session starts from the bookmark the page sends (`x-d1-bookmark`), so a player reads their own writes; with none it
starts at the primary. The token mint always starts at the primary (`PRIMARY_FIRST_ROUTES`). Every answer hands back
its session's newest bookmark. A shed or refused replica read hands back the bookmark it carried. A replica read the
isolate would shed asks any instance instead.

**The busy gate.** An overloaded database answers 503 `server` with a `Retry-After`. The reads in `BUSY_READS`
(`src/net/busyLaw.js`) then stand back at both ends: the client holds them for a wait that doubles from
`BUSY_BASE_MS` to `BUSY_MAX_MS`, and an isolate that met an overload sheds them for `BUSY_SHED_MS` without a statement.
Writes, sign-ins and acts are never held.

**Fewer trips.** The play beat, the letterbox and the town board ride one `/v1/heartbeat` request
(`src/net/heartbeat.js`, `server-account/src/heartbeat.js`). Hot routes believe a signed session pass
(`x-session-pass`, `server-account/src/sessionPass.js`) instead of looking the session up; a pass lives `PASS_TTL_S`
(five minutes) and is renewed `PASS_RENEW_S` before it ends. The periodic realm checkpoint runs every
`ONLINE_CHECKPOINT_MS` (five minutes) (`src/systems/online/onlineCheckpoint.js`); trades, crafts and profession acts save
at once.

**The service's own clock.** `wrangler.toml` names two crons (`server-account/src/cron.js` `runCron`): every minute the
settlements (auctions, writs, contracts, the seats' Turning, the day's Motherlodes and the held map's tiles); every
hour the sweeps and retention (rate windows, idle sessions, old invitations). The reads still settle on their own path,
so a read never answers from a world the clock has not caught up with. Act receipts, `world_witness` and guests with no session are not pruned.

**Kept reads.** Some hot reads are kept in the isolate instead of asked every time: a region's witnessed ground
(`server-account/src/professions.js`), and the day's Motherlodes pick, which one read a window claims
(`server-account/src/motherlodes.js`).

**The held map's ground in tiles** (`server-account/src/witnessTiles.js`). The day's Motherlodes pick already scans
every pixel confirmed before the day began, and its batch lays them as 64-pixel tiles keyed by the world pixel,
dropping earlier days' (`server-account/migrations/0207_witness_tiles.sql`). A day picked before its tiles is laid by
the minute's job with one scan of its own. The map's read, `POST /v1/prof/ground`, names up to `WITNESS_TILES_ASK`
(64) tiles: two primary-key reads in one round trip, on a replica, and a busy read. It never touches `world_witness`.
Before the day is laid it says so, and the client asks again later. A laying statement binds at most
`TILES_LAID_CHARS` characters of pixels.

### Metrics and load tools

Each relay room writes one Analytics Engine point a `METRICS_WINDOW_MS` (five minutes) to `daggerfall_relay`
(`server/src/relayScale.js` `RoomMetrics`). Each account request writes one to `daggerfall_accounts`
(`server-account/src/metrics.js`): route, status, D1 statements, rows, wait and replica share. Nothing in either
identifies a player. `tools/relayLoad.mjs` and `tools/d1Load.mjs` read them (the `relay-load` and `d1-load` workflows).
`tools/loadHarness.mjs` runs a local bot fleet; `tools/foesFirstBench.mjs` and `tools/hubShardBench.mjs` bench the
foes budget and the hub.

## Rules

- **Relay deploys are batched** into as few as possible: each drops every player. The relay deploys at the merge
  (`relay-deploy.yml`), and its version is `src/net/wire.js` `RELAY_VERSION`. A runtime setting is not a deploy: the
  relay's settings are read at run time and set from the hub with `/relay` (`src/net/relayCfg.js` `RELAY_CFG_VARS`).
- **Nothing every player touches is one object.** World state that changes rarely lives on a singleton; a connection
  lands on an object chosen by its account or its place (Mac).
- **A full city overflows into layers** rather than refusing `room full` (Mac).
- **The World tab past one hub** shows the true count and lists the player's own shard, friends and guild, with a search
  by name (Mac).
- **A reconnect still mints a token.** Binding a token to a key the client holds, so a reconnect mints nothing, is
  deferred to about 5,000 online (Mac).
- **A signed session lasts five minutes on the hot routes**: a sign-out, ban or mute reaches their reads within that
  window, and every other route at once (the owner).
- **The periodic checkpoint is five minutes** (the owner).
- **A gate's court seats 256 fighters**; past them players watch from copies and ask for a seat (the owner; see
  `World-Bosses.md`).
- **The account service answers an overload as `server` 503**, never a new word, so every client asks again as it
  already does (`src/net/busyLaw.js` `busyAnswer`).
- **The deploy outlasts an overloaded database**: `account-deploy.yml` asks `migrations apply` again for up to 5.5
  minutes on D1's overload words alone.

## The account Worker's placement

The account Worker runs beside its database's primary, by name: `server-account/wrangler.toml` sets
`[placement] region = "aws:us-west-1"`, never Smart Placement, which ran it an ocean away from the primary. Every
account deploy reports, after its health check, where the Worker answers from (`cf-placement`), what one statement
costs it there, and where D1 says its primary is (`account-deploy.yml`; `test/bible/d1near.test.js`).

## Code and tests

- `server/src/index.js` - the Worker and the Room: the layer walk, shard and bus sockets, the foes fan
- `server/src/relayScale.js` - room deadlines, bounded caches, `RoomMetrics`, `layerWalk`
- `server/src/cellNodes.js`, `server/src/cellMoves.js`, `server/src/cellHandover.js` - the cell tree's directory, moves and handover
- `server/src/foesHold.js`, `server/src/drainWindows.js` - the held full frames; the drain's posts
- `src/net/hubShards.js` - hub and region shards, the bus doors, court copies
- `src/net/cellTree.js` - the cell tree, pure, shared by relay, page and account service
- `src/net/wire.js` - `SOCKETS_MAX`, `LAYERS_MAX`, the second wire, the foes budget, `RELAY_VERSION`
- `src/net/online.js`, `src/net/loneSleep.js`, `src/net/reconnectWave.js` - the client's halos, lone pose and reconnect spread
- `src/net/busyLaw.js`, `src/net/heartbeat.js`, `src/net/accountClient.js` - the busy gate, the heartbeat, token reuse and bookmarks
- `server-account/src/service.js`, `server-account/src/admit.js`, `server-account/src/sessionPass.js`, `server-account/src/cron.js`, `server-account/src/metrics.js` - replicas, the sign-in line, the pass, the clock, the metrics
- `server-account/src/witnessTiles.js`, `src/net/witnessTileLaw.js` - the held map's tiles, laid and read
- `test/net/scale5c.test.js`, `test/net/hubpull.test.js` - the shards and the bus
- `test/net/celltree.test.js`, `test/net/cellrepartition.test.js`, `test/server/cellmoves.test.js` - the cell tree
- `test/net/scale5d.test.js`, `test/net/halothin.test.js`, `test/net/lonesleep.test.js`, `test/net/scale5b.test.js`, `test/net/slimframe.test.js` - layers, halos, the lone pose, the second wire
- `test/net/fb1021_foesfirst.test.js`, `test/net/fb1021b_foeshold.test.js` - the foes budget and hold
- `test/net/scale2c.test.js`, `test/net/busy_gate.test.js`, `test/server/scale4g.test.js`, `test/server/sessionsign.test.js` - reconnect spread, busy gate, replicas, the pass
- `test/net/sleepcost.test.js`, `test/server/cost1_drain.test.js` - what a sleeping room costs, the drain
- `test/tooling/scale4e.test.js`, `test/bible/d1near.test.js` - the account deploy's retry and placement report
- `test/ui/fb1031_witness.test.js` - the tiles' laying and read

## Open

- Every authoritative write still goes to the one D1 primary; moving polled state off it is the owner's choice.
- `world_witness`, the act receipts and orphaned guests grow without a prune (`server-account/src/cron.js` says why).
- Looks by hash on the second wire are not built: a look rides each hello.
- A gate's court with more than 256 fighters (copies holding fighters of their own) is not built.
