# AUDIT SCALE - SCALE3 and SCALE4a-c, audited before the merge, 2026-10-08

Mac: *"Do a comprehensive audit on this and ensure perfection"*, of SCALE3 (the load harness), SCALE4a (a session and
its player in one read), SCALE4b (the service's own clock) and SCALE4c (one heartbeat for a tab's three clocks),
`11-Multiplayer/Scale-Arc.md`. The service was acct94 with migration 0090 at the audit; the merge with main renumbered
them acct95 and 0091, past SD9b's. Five lenses:

- **live, in real workerd** (this session's own): `npm run account` 46/46 on the pushed head; both crons fired by
  `wrangler dev --test-scheduled` over a migrated local D1, every job's own metrics point read back (all thirteen 200; a
  stale rate window deleted, a live one kept; a second minute finding nothing due); the deploy's `[triggers]` a
  top-level table under a plain `wrangler deploy`;
- **the account service** (lane A), **the client's heartbeat** (lane B), **the load harness and its numbers** (lane C),
  **the tests' honesty and the record** (lane D) - four independent adversarial reviewers, each reading a snapshot of
  the pushed head (`26594ff5`, a detached worktree) so the fixes never moved under a verdict (Home.md, 17l).

Every finding was reproduced before it was fixed, and every fix is pinned by a test that fails on the code as it stood.
`test/auditscale.test.js` was run against a copy of the snapshot, and the service's and the client's finding pins fail
there: A1, A2, A3/A5, A7, B1, B2, B3, B4 and B6. A4's, A6's, B1's, B7's and C9's pins are the ones they moved in
scale4b, scale4c and scale3 (PIN MOVED, each red on the snapshot). The harness's own (C1, C2, C5, C11-C13) are pinned on
exports the snapshot did not have, so each is proven instead by a mutant putting its old behaviour back. The pins that
hold a law that already held - lane D's forty-five surviving mutants - pass on the code as it stood, and they too are
proven by their mutants. Mutation-proven: `tools/mutants/auditscale.json`, 81 records - lane D's forty-five, re-aimed
where the fixes moved their text, thirty-four reverting the fixes and two reverting the runner's (M1) - 80 dead and one
recorded equivalent (B4's box-only stamp, below). Every older record the fixes moved was re-aimed by content and killed
again, and SCALE4b-sessions-unindexed retired: the law it held is the one A6 reversed. Each fix carries an `AUDIT SCALE`
comment.

## Lane A - the account service

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| A1 | Major | **An auction won under a seat's Tithe could be picked every minute and closed never - and hold every auction behind it.** The due SELECT judged the seller's room by the proceeds with no Tithe (netSql's MARKET_TITHE_PCT is 0); both decisions guard on the proceeds less the seat's real Tithe. A seller within the Tithe of the Marks cap saw the sale wait out the whole grace (seven days) though it fitted, then be picked by every read and every firing - the SELECT said no room, the unsold close said room, nothing changed. Twenty of them filled `LIMIT 20`: no auction after them closed. On main already; the clock asked it every minute. | FIXED (`market.js` closeAuctions): the room decided in JS after the Tithe, by the `gets` both decisions guard on; the candidates every auction that COULD close - unbid, past the grace, or with room at the least any Tithe could leave (`TITHE_PCT_MOST`, 18: the crown's cap and a Market Hall's whole rise) - the surely closable first, so one that waits never holds the page. |
| A2 | Major | **A firing could spend thousands of statements, and repeat a page that changed nothing.** The closers answered what they PICKED, so `rounds()` asked a stuck page again 25 times a minute (A1's twenty: 2,025 statements a minute, 2.9 million a day - the whole database ran 17.4 million the day before YARD-SHED); and with no budget a backlog of sold auctions ran past D1's thousand queries an invocation, failing that job and every one after it. | FIXED: the closers answer what they MOVED (the decisions' own changes); `cron.js` FIRING_STATEMENTS_MAX (600) split among a list's jobs, a settler stopping between items once its share is spent - a firing runs at most that and one item a job, held under the thousand by a pin. |
| A3 | Minor | **closeContracts walked guild_contracts every minute**, a table nothing prunes - neither half of its OR could use 0071's index. | FIXED: 0091 `idx_guild_contracts_open_due` and `idx_guild_contracts_unreturned`, guild_writs' own pair (0043). |
| A4 | Minor | **The arena's clock counted the season's whole board every eight minutes, whatever the play** - 180 counts a day on a world nobody played in, where readers alone made 144 at most; at 20,000 bouts a count walks 80,000 rows. | FIXED (`cron.js` arena-champion): the board moves through a bout alone (claimArena counts it at once; no route deletes an account), so a kept word no bout is newer than is stamped again, not counted. |
| A5 | Minor | **The History's hourly prune was one unbounded batch**, and its auctions' delete walked every bid twice per auction (market_bids had only a partial index): 2,000 old auctions over 80,000 bids ran 21 s, and a batch past D1's 30 s rolls back and only grows. | FIXED: each table's delete a page (`rowid IN (... LIMIT ?)`), asked again while one took a full page; 0091 `idx_market_bids_auction` (the cascade's lookup too). |
| A6 | Minor | **0091's index on sessions(last_seen) doubled the index rows every stale touch writes** - writes D1 bills at a thousand times a read - to spare an hourly walk that finds nothing to delete before 2027-09-21. | FIXED before it shipped: 0091 no longer creates it; the sessions' sweep walks the table. |
| A7 | Minor | **One heartbeat part's throw failed the whole heartbeat** (a D1 error on the board's read: the box lost with it, the beat credited and its answer lost), and the client asked all three again three times. | FIXED (`server-account/src/heartbeat.js`): each part answered on its own - a throw is that part's `{ error: 'server' }`, its route's 500. |
| A8 | Nit | The guild boards' and invitations' hourly sweeps walk their tables. | NAMED: cheaper than the per-read walk they replace, and both tables small; an index would cost a written row at every note and invitation. |
| A9 | Nit | A schedule the module does not name ran nothing, silently; the Motherlodes' memo is per isolate. | FIXED, the first: `jobsFor` says so (the wrangler.toml-to-cron.js pin already holds the two names together). NAMED, the second: two statements a minute on a cold isolate. |

Held, among the rest: WHO_SQL's split and its exits; every job's signature and environment; the reads that stopped
sweeping filter on their own (`expires_at > now`, `day = today`, the History's own window); every overRate window an
hour or less; `scheduled()` awaited by the runtime and handed the firing's moment; the maintenance hold; the
heartbeat's body checks and the per-account bound it sits behind; acct94 and 0090 consistent (acct95 and 0091 after the merge).

## Lane B - the client's heartbeat

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| B1 | Major | **The knock's wait spent the grace that covers a missed knock, and a knock waiting as the page hid was held through the hide.** The service credits a gap of PLAY_GRACE_S or less and nothing for a longer one; the grace is twice the beat so that one dropped knock does not cost the sitting - but after one, the next knock's gap is already the grace, and any wait took it over. Lane B's sessions: a 40 s alt-tab over the ten-minute knock credited 910 s of 1,500; an hour with six short alt-tabs 6% less; heavy background use 20% less. | FIXED (`src/net/heartbeat.js`): the page's first knock goes at once (nothing on the page says how long ago the account last beat); later ones wait only while the last beat this page saw credited leaves room (BEAT_GRACE_MARGIN_MS short of the grace); a knock waiting as the page hides goes then, alone, kept alive past the page - and the world host ticks the heartbeat at `visibilitychange`, so a tab closed first still sends it. Lane B's simulator, re-run on the fixed modules and the world host's new wiring: the 40 s alt-tab credits 1,520 s (main's three clocks 1,500, the audited head 910), a 12 s outage over the knock 1,500 (910), a hide while the knock waited 1,540 (850), and the hour with six alt-tabs 3,243 s an hour over 100 seeds (main 3,198, the head 2,999), for 60.7 requests an hour (60.1). PIN MOVED: AUDIT WORLD7/8's "no hidden-tab timer drives it" refused the word in world.js at all; it holds now that world.js's one `visibilitychange` ticks the heartbeat alone, nothing of the quest machine's. |
| B2 | Major | **/v1/heartbeat had no timeout**: one request that hung held all three clocks for the page - no board, no box, no beat - and a board window waiting on it stayed on "Reading the board..." for good. AUDIT 28 N6's law ("a read or a pin that hangs is given up, never wedged") had been the board's own door's. | FIXED: each try given up after ACCOUNT_ACT_WAIT_MS (`AbortSignal.timeout`), an abort `offline` as `call` answers one. |
| B3 | Minor | **The box could have two looks in flight** - the heartbeat's and the Letters tab's own refresh - and the older answer, landing last, rolled the box back and announced a letter twice. | FIXED (`mail.js`): the part's look in flight is the box's `_looking`, so the tab takes its answer and asks nothing. |
| B4 | Minor | **The pace rule added box looks on a slow service**: both books counted their clocks from the answer, so from a 3 s round trip the board's minute stretched and the box rode its second minute, not its third - up to 28 looks an hour for 20, and a town changed every 20-90 s cost looks with no request saved. | FIXED: each part counts its clock from the send (the board's `e.at` the send's moment; the box not stamped again at the answer). The box's own stamp alone is equivalent under the pace rule (it still rides the board's third minute, early by the round trip, inside its bound) - its mutant is recorded so; the board's is what moved it. |
| B5 | Minor | = A7, the client's half: a part's failure retried the whole heartbeat. | FIXED with A7: a part's error is that part's answer; whole-request failures alone are asked again. |
| B6 | Minor | `send()` was not exception-safe: a part's `body()` that threw left the board's `pending` set for the page (no shipped body throws today). | FIXED: a body that throws does not ride and the others do; every part stamped takes an answer. |
| B7 | Nit | Back from a hide, the held knock went alone a second before the board and the box; at four frames a second or fewer the street's once-a-second stamp, counted by the clamped dt, outran FRAME_LIVE_MS. | FIXED: no knock is held through a hide (B1); the stamp by the wall clock (`world.js`). |
| B8 | Nit | accountPlayBeat's doc said the world host hands it to the play clock; the heartbeat's header said a late beat credits its whole gap; the world host's text pins passed with the old calls put back. | FIXED: the docs say what is true; the pins refuse `mail.poll()`, a board read in the street frame's second and `accountPlayBeat` in the host. |

Residual, named: signing out during a knock's wait drops that knock - at most PLAY_BEAT_S of credit, at the sitting's
end, the tail the play clock already gives up. Held: one heartbeat a page (bootWorld runs once; every exit navigates);
the FOUR HOSTS (exterior.js, worldModes.js and dungeonContext.js keep no clock, on main or here); single-player, a
guest and a signed-out device; a town change mid-flight; a window's read taking the heartbeat's answer.

## Lane C - the load harness and its numbers

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| C1 | Major | **The professions' state clock was invented**: a gatherer asked `/v1/prof/state` every 30 s - the client's floor for a read that FAILED - where the client's book reads it on arrival, at the UTC day's turn and after a refusal. It made 26% of main's statements and ranked first in "where they went". | FIXED (`tools/loadHarness.mjs`): the book's own law - every bot reads it on arrival (a registered one; a guest's refusal again every PROF_CLOSED_RECHECK_MS), again at the day's turn; the `gatherers` knob gone with the poll. Every column re-measured (Scale-Arc.md). |
| C2 | Minor | The fleet's mix was not stated, its roles nested (one spread for every share: every gatherer a fighter, every fighter a mover), and a storm's mints folded into hourly rates read as a deploy every six minutes. | FIXED: each role its own spread; the report states its fleet and the play's totals with the deploy's mints apart. NAMED: the Watch receipts the relay hands are not claimed (no difference in a run's minutes). |
| C3-C8 | Minor | The record's ranking, "-2.3%" across two harness versions, "about every fifth the beat" (every sixth), "the first second" quoting the busiest, the unsupported "61%" and "100% CPU", "Play mints nothing" (standing play in one cell), "rows a statement are the code's own" (they depend on the data and on the isolates). | FIXED in the record, every column measured by the one harness. |
| C5 | Minor | The storm's rows were the loop's iterations (it skipped seconds under a saturated loop) and its shares back were read when the loop looked. | FIXED: every call, statement and refusal bucketed by its own moment; the shares back from the welcomes themselves. |
| C9 | Minor | The fleets' pose reservoirs were pooled unweighted (a million poses at 10 ms beside 150,000 at a second read a p75 of a second). | FIXED: each fleet's kept ages cut to stand for the same number of heard poses. |
| C10 | Minor | The measurement itself was unpinned: eighteen mutants on it survived. | FIXED: the report's arithmetic, the storm's seconds, the clocks, the roles and every counter pinned. |
| C11 | Minor | **Ctrl-C left the throwaway signing pair on disk** (`process.exit` skipped the `finally`) - and one was there, from an interrupted run. | FIXED: an interrupted run takes its state; the private half deleted once the service is up. The leftover removed. |
| C12 | Nit | `--threads 2.5` built fleets past the bots asked; `--setup 0` spun for ever; a share past 1 was taken. | FIXED: counts whole from 1, shares 0 to 1, the storm inside the play. |
| C13 | Nit | The entry's `first(col)` answered a missing column null where workerd throws; `raw()` was not counted; `localFetch` ignored a caller's give-up; "-13.5%" is -13.4%; the hour's cron fires once in a short run. | FIXED, the first three; the record's figures corrected; the hour's firing named in the record (its rows are a fixed cost, not a player's). |

Held: no path reaches anything but the two local Workers; the key never reached the repository; reading `first()` as
`all()` reads the rows `first()` reads; POINTS_MAX unreachable at 30 s drains; every other published number matched
its run's JSON.

## Lane D - the tests' honesty and the record

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| D1 | Major | The client's heartbeat was never checked against the service: its path, its credential and its base all survived. | PINNED: the real heartbeat over the real Worker (TEST THE SHAPE THE PRODUCER MINTS). |
| D2 | Major | `scheduled()`'s seconds unpinned - in milliseconds every session was a year idle and the hour signed everyone out. | PINNED. |
| D3-D6 | Major | = B2, A7, C1, B1. | FIXED with them. |
| D7-D10, D12, D13 | Minor | Laws the slices claimed and no pin held: the quiet world's five statements a minute and seventeen an hour, each sweep's page, the Motherlodes behind `dev`, a metric sink that throws, the arena clock's margin; the rate keep to the second; the guarded probes (an order, a listing ending now, a declined and a crafter's commission), the History's nine tables and its day, the boards' end to the second, the succession with a roster; the client parts' small laws; the harness's counters; the touch by the session's own last_seen. | PINNED, each against its mutant. |
| D11 | Minor | Vacuous assertions (a status that could only be 404, a bound after an equality). | FIXED - one of them this audit's own, caught before it shipped. |
| D14-D16 | Minor | The record's PIN MOVED list incomplete; fourteen version comments naming two slices of three; the FOUR HOSTS named for one host alone; "write-free" for reads that still write when due; the pace rule's reason worded wrong. | FIXED. |
| D17 | Nit | Test comments and a doubled line. | FIXED. Refuted: "the first three columns fired no cron" (main and SCALE4a have no clock; SCALE4b's run fired it) and "50-78" (SCALE4b's re-run had 50). |

## The mutation run

The fixes and the moved pins re-judged every record aimed at a file this audit changed, with the five slices' lists
whole: 435 records. The run itself found two things.

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| M1 | Major | **The mutation runner read "dead" off a test file that could not run.** This audit's own edit to an AUDIT 30 title left an apostrophe unescaped, so `audit30_service.test.js` did not parse. Its baseline failed in the `--jobs` workspaces, so its twenty records were judged in place, on the assumption that the tests pass there. They failed there too, for the same reason, and all twenty read "dead". A serial run had the same blind spot: it never ran a record's tests without the mutant. The lint caught the file; no verdict did. | FIXED (`tools/mutate.mjs`): before any mutant, every test a record names runs here unmutated (with `--jobs`, those that failed in a workspace). A record any of whose tests fails is no verdict - said so by name - and the run fails. Pinned serially and with `--jobs`, red on the old runner (the false "dead" it printed); two records. The title is fixed, and the twenty were re-judged in workspaces: all dead. PIN MOVED: AUDIT 68's interrupt pin now marks the mutant's own run, since the baseline runs its slow test unmutated first. |
| M2 | Minor | **PROF5b-svc-listed-auctioned survived**, on the audited head too, so it predates the audit. The auction post's `listed = 0` was pinned only by posting a listed piece, which the open listing's own guard refuses first. The piece that guard alone holds is one whose auction closed unsold and whose return is still owed. A read brings back SETTLE_MAX returns, and SCALE4b's clock closes auctions while their seller is away, so a seller can come back owing more than one read makes. Posted again with the guard gone, that piece was sold while it was also on its way back - two of it. | PINNED (`prof5b_service.test.js`): SETTLE_MAX + 1 auctions closed by the clock, the last still owed after the post's own settle and refused `market-listed` with no second auction standing, then a delivery once a read brings it back. The record dies. |

After both: 427 dead and 8 equivalent as recorded, with nothing surviving, stale or unapplied - and the two M1 records
dead beside them.

## What was measured again

The harness's numbers changed with C1, C2 and C5, and SCALE4c's code with B1-B6: every column was measured again by the
one corrected harness, each from a worktree of its commit, the final column the audited head. Scale-Arc.md's "What it
measured" is that table.
