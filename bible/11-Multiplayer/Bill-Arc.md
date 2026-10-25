# The bill (BILL1)

2026-10-24. Mac, over the month's Cloudflare billing page ($33.43 a day on average, Durable Objects $387.50 of it):
"Wtf. Is this right?", then, of the fixes this page names: "How will that affect the game", then "Do everything now",
then "Audit this" (`01-Overview/audits/Audit-Bill.md` - what it changed is written into the sections below, each under
its finding's id), then, of the D1 writes: "Dig into that on top of this PR" (section 5).

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
| R2 Class A | 4.50 | the saves: the analytics count 578,004 `PutObject` (about $2.60 at R2's $4.50 a million; the 572,679 `DeleteObject` are free) - the rest of the line not accounted for here (AUDIT BILL D7) |
| Workers requests | 3.90 | the account service 12.2 million, the relay 0.9 million |
| Workers CPU | 1.92 | the account service 94,300 CPU-seconds |

About $90 a day, where the cycle's average said $33: the cycle's first days ran inside the plan's allowances.

## 2. The relay: the objects awake

The `Room` namespace's active time, in objects awake around the clock: ~90 a day on 2026-10-12 to -15, 186 on -17, 213
on -18, 343 on -19, 371 on -23. By the hour it steps twice, each at a relay deploy (the versions list):

- **2026-10-16 11:47 UTC, world210 (HUB-PULL, `Scale-Arc.md`):** 96 to 150 within the hour. A shard holding a socket
  keeps a poll at its bus (`src/net/hubShards.js` HUB_POLL_MS, 20 s, asked again the moment it is answered), so neither
  end of it is ever idle long enough to be evicted: every occupied shard and its bus are billed wall-clock, all day, at
  any traffic. On 2026-10-23, 17 objects awake over 20 hours (6 of them the whole day) sent under a thousand frames.
- **2026-10-18 21:27 UTC, world218:** 228 to 390 over two hours. Not explained here - some of it is the evening; world218
  is GRANT2's (`Spawn-Grants.md`). Open.

By room kind (the relay's Analytics Engine windows, 2026-10-23 - windows a room wrote, which overlap the billed active
time rather than equal it: 9,526 h of them against 8,904 h billed): chat 3,479 h (37%), world cells 3,120 h, dungeons
2,080 h, interiors 847 h. The chat rooms - the hub's 16 shards and its bus, and each region's 4 shards and its bus -
were so ~136 of the 371 objects, ~120 of them the regions'. Of the region channels, the busiest evening (2026-10-18
20:20 UTC) held the start region at 842 and every other under a hundred; the hub's bus held 1,140.

**BILL1a, built: a region's channel holds its own links until it is crowded.** `src/net/hubShards.js` REGION_BUS_KEEP
(200), `busSpills` and `linkShardOf`. A page asks the hub's shard at once, as before, and a region's channel itself
(`src/scenes/world.js` channelLinkRoom); the relay's channel keeps a link of a build that knows the shards while it
holds fewer than REGION_BUS_KEEP sockets of its own - its real sockets, the one asking among them, never the
ShardSockets its shards hand it (AUDIT BILL A1) - and tells it its shard once it holds that many
(`server/src/index.js:"_busHops(ws, key, m, subject) {"`, a Room method of its own, AUDIT BILL A6). So the start region
still splits four ways at its evening and a region with three players in it is one object, not four. A shard's own hop
of an account that is not its own is unchanged, so a tab of an older build that asks its region shard at once is kept
there or sent on as before. Relay world256 (world255 on its branch, renumbered past KETCH at the merge).

What is given up (AUDIT BILL A2-A4):
- **A crowded region's arrivals pass its channel's one hello gate.** A page of this build joins a region at its
  channel, which spends its hello gate (CHAT_HELLO_HZ_MAX, 50 a second) and the token's check before telling a
  crowded region's link its shard - where four shards' gates took them before. A wave at the start region over 200 (a
  site deploy reloading every page at its evening) waits its turn at 50 a second, its Region chat a few seconds late;
  a link's own reconnect goes to the shard it was told, never by the channel again.
- **A link told its shard stays on it.** It never comes back to the channel as the region thins: a region that was
  crowded keeps its occupied shards and its bus awake for whoever is still there from the crowd, overnight too.
- **The count is the channel's sockets, said hello or not.** About 200 sockets held open silently on a quiet
  region's channel spill every link there to the shards for as long as they stand; nothing breaks, it costs.

Not taken, and why:
- **The hub's 16 shards.** Everyone online holds a hub link, all day: its bus and every shard are awake whatever the
  pull does, and 1,140 on one object is past what SCALE5c split it for. 17 objects, about $2.30 a day.
- **One object a place with a player in it** (cells, dungeons, interiors - about $30 of the $50). A player moving says
  a pose ten times a second (POSE_HZ), and a room with anyone in it runs its own streams - the foes' every FOES_FULL_MS
  (2 s) among them - so it is never idle long enough to sleep; that is the relay doing its work, and it grows with the
  players. (The 20 s heartbeat of a player standing still is not what does it: it was set to leave gaps a hibernation
  fits in - wire.js RELAY-H1. AUDIT BILL D6.)

Expected: the region channels' ~120 objects to about one an occupied region - near $12 a day, measured again once
world256 is live.

## 3. The account service: what read the most

**BILL1b, built: the decor asked by its index.** The two statements that read 4.4 billion rows on 2026-10-23 -
`server-account/src/writs.js` eligibleHere (3,425 calls, ~838,000 rows each) and `server-account/src/market.js`
pieceWaysRead (850 calls, ~1.8 million each) - and `server-account/src/craftWrits.js`'s piece check (3,023 calls, 54
million rows) each asked `json_extract(item, '$.pv') = p.provenance`. Compared with a column, the comparison takes the
column's TEXT affinity, which the expression index (`idx_home_decor_pv`, migration 0043) does not have, so the planner
scanned the whole index for every piece: `SCAN home_decor USING COVERING INDEX idx_home_decor_pv`, the live database's
own plan. `+p.provenance` is the same value with no affinity, and the plan is `SEARCH ... (<expr>=?)`, asked of the live
database again after. The two spellings part only for a `pv` that is a JSON number spelling a provenance, which
decorPieceOf never writes - and where they would, the new one agrees with every bound-value check that guards the act
itself (AUDIT BILL B3). SCALE1 C's pin asked the expression of a bound `?`, which was always searched, and so passed
over all three; `test/net/bill1_d1.test.js` asks every lookup of the decor against a column. Expected: about $4.40 a day.

**AUDIT BILL B1, built: a piece's maker found by the piece.** The same statements of writs.js and craftWrits.js asked
of every piece whether the reader made it - `EXISTS (... prof_crafts WHERE player = ?1 AND (provenance = p.provenance
OR provenance2 = p.provenance))` - over an index of the player alone, so each piece walked the crafter's whole history of
crafts, which nothing deletes: pieces times crafts (a crafter of 4,000 crafts, 1,000 of them the commission's recipe:
500,500 rows a read). Migration 0167 indexes prof_crafts by (player, provenance) and (player, provenance2), and the
question is asked as one EXISTS a column - the planner takes neither index for the OR: one search a piece (1,000 rows
for that crafter).

**BILL1c, built: the Work tab reads a crafter's pieces only for a commission.** writBoard asked eligibleHere on every
board read; its answer is read only for a commission shown naming this crafter, open, in this region
(`server-account/src/writs.js:"const fitted = (c) =>"`), and the live table held two commissions. Now it is asked only
when one is shown - in either list the board shows, each cut by its own LIMIT (AUDIT BILL B2).

**BILL1d, built: the streamed world asks a town's homes only of a town that may hold one.** `/v1/homes/town` was the
service's busiest route, 3,081,965 asks on 2026-10-23 - five a player a minute under a registry that keeps a town's
answer a minute - because `src/scenes/pixelBuild.js` asked it of every location pixel it built, at every rebuild, and
336 towns held a home (1,842 homes). The boot's read of every town's homes (QUEST-HOME, hearEveryTown) and the hub's
words since (hearHome) already say which; `mayHold` (`src/systems/online/onlineHomes.js:"const mayHold = (mapId) =>"`)
says it, and the build asks no other. A read that reached HOME_KEYS_MAX is not taken as whole. A town the build was
turned from is asked the moment a word names a home in it (AUDIT BILL C1: it was left to the pixel's next rebuild), a
town a word has named stays one the build asks though a read taken before the word lands after it (C2), and a town
whose own answer named no home is turned from like any other (C3). A town walked into is still asked at its gate
(`onlineHomes?.ensure(_musicLoc...)`, held by home1.test.js, "the town asked on arrival" - C4). What is given up: a home
made while this page heard no word of it - its hub link down past HOME_WORDS_KEEP_MS - is not drawn from outside its town
until the walk in.

BILL1b, BILL1c and B1 are the account service's acct182 (`server-account/src/service.js` ACCOUNT_VERSION,
`wrangler.toml`; acct181 on its branch, renumbered past KETCH at the merge), so the site's deploy waits on the service
that runs them; BILL1d is the client's alone.

Not taken: the D1 writes (no one statement over a tenth of them), the saves' R2 writes, and the account service's
other routes (`/v1/prof/pixels` 1.38 million asks, `/v1/homes/yards` 677,000 - homeYards.js asks it of every built town
within reach, home or not; `mayHold` is the same guard for it, when it is taken up). Each is its own reading.

## 5. The D1 writes (BILL2)

Mac, of what BILL1 left: "Dig into that on top of this PR". D1 wrote 11 million rows on 2026-10-23 ($11 - D1 counts a
statement's index rows with its table's). The fifteen statements that wrote the most, by D1's own query insights, wrote
6.3 million of them:

| Rows | Calls | Statement | What it is |
|---|---|---|---|
| 1,125k | 562,736 | `UPDATE realm_characters SET seq = ?, ...` | the checkpoint's row - and realm_characters_player's index, every one |
| 766k | 554,177 | `UPDATE realm_characters SET judged_seq = ?2, ...` | the checkpoint's verdict (verdict.js) |
| 660k | 324,453 | `INSERT INTO rate_limits ... ON CONFLICT` | `overRate`, 92 callers, most a fresh window (its index moves) |
| 646k | 80,825 | `INSERT OR IGNORE INTO node_harvests` | a harvest: its row and seven indexes |
| 492k | 439,332 | `INSERT INTO realm_wealth_hours` | the checkpoint's hour of wealth |
| 425k | 421,839 | `INSERT INTO fest_finds` | the Witches' Festival's finds, every kill - the festival closes 2026-11-08 (festivalLaw.js FESTIVALS) |
| 287k | 278,982 | `INSERT INTO item_census` | the checkpoint's census (an unchanged tally already written nowhere) |
| 277k | 138,533 | `UPDATE players SET played_s = ...` | play time; its index on played_at is the time's own anchor |
| 274k-196k | | renown_tracks, grant_tallies, progress_hours, progress_play, grant_rows, town_econ_seen, writs | one row an act each |

Nearly every row is the record of an act the game keeps; the cron's sweeps delete what expires. What is not one act's
record is THE CHECKPOINT: about 570,000 a day, 5.6 rows each (the account service's own count for the route: 3.39
million rows for 608,000 puts) - a third of the line - and an R2 object each, which is R2's whole Class A line. Every
checkpoint is a save the service must hold, so the rows a checkpoint writes are its law's; the lever is how many go. The
five-minute timer (onlineCheckpoint.js ONLINE_CHECKPOINT_MS, and the idle skip of a save that says nothing new) accounts
for about a fifth of them at ~400 online; the rest are acts' (a trade, a craft, a gold act, a harvest's materials - about
thirty doors ask one), and a page put away (whenPageHides), which always goes. Which of those costs most was never
counted: a put carried no word of why.

**BILL2a, built: `updated_at` touched only when it is ten minutes old.** The checkpoint set it every put, and it is in
realm_characters_player's index (player, updated_at), so every put wrote two rows. What reads it - the account's own list
newest first, its tile's day ("Playing now" is lease_at's, still renewed every put), staff's ordering - reads ten minutes
as well as a second. `server-account/src/realm.js:"const touch = !(Number(row.updated_at) > nowS - REALM_TOUCH_S);"`.
Expected: about half a million rows a day, ~$0.50.

**BILL2b, built: a checkpoint says why it went.** The realm session tells its put (`?w=`, a query - never a header, which
an older or rolled-back service would refuse at the preflight, failing every save) the whys of the checkpoints it
carries: `tick` (the timer, the one call `idle` lets through), `hide` (a page put away) and `act` (every other), sorted
(net/realm/realmSaveCodec.js CHECKPOINT_WHYS, both ends' law). The service's metrics point says it (`parts`, blob6:
`w:tick`). A day after it is live, Analytics Engine answers which costs what:

    SELECT blob6 AS why, sum(_sample_interval) AS puts FROM daggerfall_accounts
    WHERE blob1 = '/v1/realm/:id/data' AND blob2 = 'PUT' AND timestamp > NOW() - INTERVAL '1' DAY GROUP BY why

Not taken until that reading, and why:
- **A page put away skipping a save that says nothing new**, as the timer's does. It would cost a closed tab's player up
  to the idle window's clock and camera (REALM_IDLE_CHECKPOINT_MS, ten minutes) on the next join - SCALE2b kept "never on
  a page going away" for that. Worth it only if `hide` is most of the puts.
- **Acts' saves gathered over a few seconds** (createSaveSoon answers on the next tick): a burst of harvests or crafts
  would be one put, and a crash inside the window would lose what the service already settled - PROF-SAVE's "at once",
  Mac's choice. Worth it only if `act` is most of them.
- **The verdict's UPDATE folded into the save's** (one row a put): the judge's own guard (its rev) would move into the
  save's statement - integrity code, for ~$0.55 a day.
- **The rate limits** (92 callers; which key is hot is not counted) and **node_harvests' seven indexes** (each read by a
  statement of its own; ~$0.16 a day for two). The festival's finds end with it.

## 4. Pins and mutants

- `test/net/bill1_d1.test.js`: the decor asked of a column (BILL1b), the board's gate (BILL1c), its two lists and the
  closed commission (B2), the maker by index (B1).
- `test/systems/online/bill1_homes.test.js`: `mayHold` (BILL1d), C1-C3, and the build's guard (a source pin).
- `test/net/scale5c.test.js`: BILL1a, its own-sockets count (A1), and three pins moved - the session test's and part
  two's `channelLinkRoom` reads (`linkShardOf`), and a region's channel no longer telling a link its shard at once.
- `test/net/auditscale2_client.test.js`: one pin moved - the host's closure takes `linkShardOf`.
- `test/server/bill2_checkpoint.test.js`: the why's law, the session's word on each put and the service's count of it,
  and the touch (BILL2).
- `tools/mutants/bill1.json`: thirty-four, all dead - BILL2's seven: always and never touched, the timer called an act,
  the word left off the put, the service not counting it, a queued checkpoint's why dropped, an unsorted word taken; and
  BILL1's twenty-seven - each `+` dropped, the board always and never reading, either
  list or the open test dropped, the OR put back in either file, either index dropped; `mayHold` always true, the cap
  taken as whole, an answer's own home forgotten, any answer counted, the turned-from town or the word's town
  forgotten, the build unguarded; the channel spilling past the bound rather than at it, never keeping, the bound
  moved, a region link asking its shard, the relay not asking, the shards' sockets or the index counted, and the page
  asking a region's shard at once (a source pin's: `shardOf` is no longer imported there, so it would also throw).
