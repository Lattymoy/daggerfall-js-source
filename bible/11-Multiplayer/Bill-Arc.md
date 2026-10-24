# The bill (BILL1)

2026-10-24. Mac, over the month's Cloudflare billing page ($33.43 a day on average, Durable Objects $387.50 of it):
"Wtf. Is this right?", then, of the fixes this page names: "How will that affect the game", then "Do everything now".

Read off Cloudflare's own analytics with the account's token - GraphQL (`durableObjectsPeriodicGroups`,
`d1QueriesAdaptiveGroups`, `r2OperationsAdaptiveGroups`, `workersInvocationsAdaptive`), both Workers Analytics Engine
datasets (`daggerfall_relay`, `daggerfall_accounts`), the Workers versions list, and `EXPLAIN QUERY PLAN` asked of the
live database. Read only: nothing was written to the account.

## 1. The bill is right

It is what was used. 2026-10-23, the line items against their usage:

| Line | $ that day | What it was |
|---|---|---|
| Durable Objects duration | 50.00 | the relay's `Room` objects awake 371 object-days (371 x 86,400 s x 128 MB at $12.50 a million GB-s is $50.09) |
| D1 rows written | 11.00 | 11 million, across many tables - no one statement |
| D1 rows read | 7.42 | 7.4 billion; two statements 4.4 billion of them (section 3) |
| Durable Objects storage rows written | 6.00 | the rooms' own storage |
| Durable Objects requests | 4.95 | |
| R2 Class A | 4.50 | the saves: 578,004 `PutObject` (and 572,679 `DeleteObject`) |
| Workers requests | 3.90 | the account service 12.2 million, the relay 0.9 million |
| Workers CPU | 1.92 | the account service 94,300 CPU-seconds |

About $90 a day, where the cycle's average said $33: the cycle's first days ran inside the plan's allowances.

## 2. The relay: the objects awake

The `Room` namespace's active time, in objects awake around the clock: ~90 a day on 2026-10-12 to -15, 186 on -17, 213
on -18, 343 on -19, 371 on -23. By the hour it steps twice, each at a relay deploy (the versions list):

- **2026-10-16 11:47 UTC, world210 (HUB-PULL, `Scale-Arc.md`):** 96 to 150 within the hour. A shard holding a socket
  keeps a poll at its bus (`src/net/hubShards.js` HUB_POLL_MS, 20 s, asked again the moment it is answered), so neither
  end of it is ever idle long enough to be evicted: every occupied shard and its bus are billed wall-clock, all day, at
  any traffic. On 2026-10-23, 17 objects awake 24 hours sent under a thousand frames.
- **2026-10-18 21:27 UTC, world218:** 228 to 390 over two hours. Not explained here - some of it is the evening; world218
  is GRANT2's (`Spawn-Grants.md`). Open.

By room kind (the relay's Analytics Engine windows, 2026-10-23): chat 3,479 h, world cells 3,120 h, dungeons 2,080 h,
interiors 847 h. The chat rooms - the hub's 16 shards and its bus, and each region's 4 shards and its bus - were ~145 of
the 371. Of the region channels, the busiest evening (2026-10-18 20:20 UTC) held the start region at 842 and every other
under a hundred; the hub's bus held 1,140.

**BILL1a, built: a region's channel holds its own links until it is crowded.** `src/net/hubShards.js` REGION_BUS_KEEP
(200), `busSpills` and `linkShardOf`. A page asks the hub's shard at once, as before, and a region's channel itself
(`src/scenes/world.js` channelLinkRoom); the relay's channel keeps a link of a build that knows the shards while it
holds fewer than REGION_BUS_KEEP sockets of its own and tells it its shard past them
(`server/src/index.js:"if (isChannelBus(a.key) && m.hs === 1 && shardOf(a.key, who.subject) && busSpills("`). So the
start region still splits four ways at its evening and a region with three players in it is one object, not four. A
shard's own hop of an account that is not its own is unchanged, so a tab of an older build that asks its region shard
at once is kept there or sent on as before. Relay world255.

Not taken, and why:
- **The hub's 16 shards.** Everyone online holds a hub link, all day: its bus and every shard are awake whatever the
  pull does, and 1,140 on one object is past what SCALE5c split it for. 17 objects, about $2.30 a day.
- **One object a place with a player in it** (cells, dungeons, interiors - about $30 of the $50). A pose every 100 ms
  while moving and every 20 s while still (HEARTBEAT_MS) keeps a room that holds anyone awake; that is the relay doing
  its work, and it grows with the players.

Expected: the region channels' ~120 objects to about one an occupied region - near $12 a day, measured again once
world255 is live.

## 3. The account service: what read the most

**BILL1b, built: the decor asked by its index.** The two statements that read 4.4 billion rows on 2026-10-23 -
`server-account/src/writs.js` eligibleHere (3,425 calls, ~838,000 rows each) and `server-account/src/market.js`
pieceWaysRead (850 calls, ~1.8 million each) - and `server-account/src/craftWrits.js`'s piece check (3,023 calls, 54
million rows) each asked `json_extract(item, '$.pv') = p.provenance`. Compared with a column, the comparison takes the
column's TEXT affinity, which the expression index (`idx_home_decor_pv`, migration 0043) does not have, so the planner
scanned the whole index for every piece: `SCAN home_decor USING COVERING INDEX idx_home_decor_pv`, the live database's
own plan. `+p.provenance` is the same value with no affinity, and the plan is `SEARCH ... (<expr>=?)`, asked of the live
database again after. SCALE1 C's pin asked the expression of a bound `?`, which was always searched, and so passed over
all three; `test/net/bill1_d1.test.js` asks every lookup of the decor against a column. Expected: about $4.40 a day.

**BILL1c, built: the Work tab reads a crafter's pieces only for a commission.** writBoard asked eligibleHere on every
board read; its answer is read only for a commission shown naming this crafter, open, in this region
(`server-account/src/writs.js:"const fitted = (c) =>"`), and the live table held two commissions. Now it is asked only
when one is shown.

**BILL1d, built: the streamed world asks a town's homes only of a town that may hold one.** `/v1/homes/town` was the
service's busiest route, 3,081,965 asks on 2026-10-23 - five a player a minute under a registry that keeps a town's
answer a minute - because `src/scenes/pixelBuild.js` asked it of every location pixel it built, at every rebuild, and
336 towns held a home (1,842 homes). The boot's read of every town's homes (QUEST-HOME, hearEveryTown) and the hub's
words since (hearHome) already say which; `mayHold` (`src/systems/online/onlineHomes.js:"const mayHold = (mapId) =>"`)
says it, and the build asks no other. A read that reached HOME_KEYS_MAX is not taken as whole. A town walked into is
still asked at its gate (`fb1014_questhome.test.js` holds it): a home bought while a page heard no word of it reaches
that page there. What is given up: such a home's paint, seen from outside its town before walking in, waits for the
walk in.

BILL1b and BILL1c are the account service's acct181 (`server-account/src/service.js` ACCOUNT_VERSION, `wrangler.toml`), so the
site's deploy waits on the service that runs them; BILL1d is the client's alone.

Not taken: the D1 writes (no one statement over a tenth of them), the saves' R2 writes, and the account service's
other routes (`/v1/prof/pixels` 1.38 million asks, `/v1/homes/yards` 677,000). Each is its own reading.

## 4. Pins and mutants

`test/net/bill1_d1.test.js`, `test/systems/online/bill1_homes.test.js` and `test/net/scale5c.test.js` (BILL1, and two
pins moved: a region's channel told a link its shard at once). `tools/mutants/bill1.json`: fifteen, all dead - each `+`
dropped, the board always and never reading, `mayHold` always true, the cap taken as whole, an answer's own home
forgotten, the build unguarded; the channel spilling past the bound rather than at it, never keeping, the bound moved, a
region link asking its shard, the relay not asking, and the page asking a region's shard at once.
